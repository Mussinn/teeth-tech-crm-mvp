package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Failure struct {
	Status        int
	Code, Message string
}

func (e *Failure) Error() string { return e.Message }

var InvalidRefresh = &Failure{401, "AUTH_401", "Refresh-сессия недействительна или истекла"}
var Inactive = &Failure{400, "BUS_001", "Учетная запись неактивна"}
var InvalidAccess = &Failure{401, "AUTH_401", "JWT недействителен или истёк"}

type User struct {
	ID               string   `json:"id"`
	Email            string   `json:"email"`
	Roles            []string `json:"roles"`
	password, status string
	failed           int
	locked           *time.Time
}
type SessionResponse struct {
	UserID            string   `json:"userId"`
	Email             string   `json:"email"`
	AccessToken       string   `json:"accessToken"`
	RefreshToken      string   `json:"refreshToken"`
	AccessExpiresInMs int64    `json:"accessExpiresInMs"`
	Roles             []string `json:"roles"`
}
type LoginResponse struct {
	ID    string   `json:"id"`
	Email string   `json:"email"`
	Token string   `json:"token"`
	Roles []string `json:"roles"`
}
type Metadata struct{ UserAgent, IP string }
type Settings struct {
	RefreshTTL   time.Duration
	MaxFailed    int
	LockDuration time.Duration
}
type Service struct {
	pool     *pgxpool.Pool
	tokens   *Tokens
	settings Settings
}

func NewService(pool *pgxpool.Pool, tokens *Tokens, settings Settings) (*Service, error) {
	if pool == nil || tokens == nil || settings.RefreshTTL < time.Second || settings.MaxFailed < 1 || settings.LockDuration <= 0 {
		return nil, errors.New("invalid identity configuration")
	}
	return &Service{pool, tokens, settings}, nil
}

// Queries explicitly target public so dump migrations and connection search_path
// cannot silently change the schema used for credentials.
const userColumns = `id::text,email,password_hash,status,failed_login_attempts,locked_until`

func loadUser(ctx context.Context, tx pgx.Tx, condition string, key string, lock bool) (User, error) {
	var user User
	query := `SELECT ` + userColumns + ` FROM public.t_users WHERE deleted_at IS NULL AND ` + condition
	if lock {
		query += ` FOR UPDATE`
	}
	err := tx.QueryRow(ctx, query, key).Scan(&user.ID, &user.Email, &user.password, &user.status, &user.failed, &user.locked)
	if err != nil {
		return user, err
	}
	rows, err := tx.Query(ctx, `SELECT r.code FROM public.t_roles r JOIN public.t_user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1 ORDER BY r.code`, user.ID)
	if err != nil {
		return user, err
	}
	defer rows.Close()
	user.Roles = []string{}
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return user, err
		}
		user.Roles = append(user.Roles, role)
	}
	return user, rows.Err()
}

func (s *Service) Login(ctx context.Context, email, password string, meta Metadata, session bool) (any, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(context.Background())
	user, err := loadUser(ctx, tx, "email=$1", email, true)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &Failure{404, "ENT_001", "Сотрудник с email " + email + " не найден"}
	}
	if err != nil {
		return nil, err
	}
	if user.status != "ACTIVE" {
		return nil, Inactive
	}
	now := time.Now().UTC()
	if user.locked != nil && user.locked.After(now) {
		return nil, &Failure{400, "BUS_001", "Слишком много попыток входа. Повторите позже"}
	}
	if bcrypt.CompareHashAndPassword([]byte(user.password), []byte(password)) != nil {
		failed := user.failed + 1
		var locked *time.Time
		if failed >= s.settings.MaxFailed {
			until := now.Add(s.settings.LockDuration)
			locked = &until
			failed = 0
		}
		if _, err = tx.Exec(ctx, `UPDATE public.t_users SET failed_login_attempts=$2,locked_until=$3,updated_at=$4 WHERE id=$1`, user.ID, failed, locked, now); err != nil {
			return nil, err
		}
		// Commit the security counter even though the request is rejected.
		if err = tx.Commit(ctx); err != nil {
			return nil, err
		}
		return nil, &Failure{400, "BUS_001", "Не правильный пароль"}
	}
	if user.failed != 0 || user.locked != nil {
		if _, err = tx.Exec(ctx, `UPDATE public.t_users SET failed_login_attempts=0,locked_until=NULL,updated_at=$2 WHERE id=$1`, user.ID, now); err != nil {
			return nil, err
		}
	}
	var result any
	if session {
		response, _, issueErr := s.issue(ctx, tx, user, meta, now)
		if issueErr != nil {
			return nil, issueErr
		}
		result = response
	} else {
		token, issueErr := s.tokens.Issue(user.Email, now)
		if issueErr != nil {
			return nil, issueErr
		}
		result = LoginResponse{user.ID, user.Email, token, user.Roles}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Service) issue(ctx context.Context, tx pgx.Tx, user User, meta Metadata, now time.Time) (SessionResponse, string, error) {
	var response SessionResponse
	bytes := make([]byte, 48)
	if _, err := rand.Read(bytes); err != nil {
		return response, "", err
	}
	raw := base64.RawURLEncoding.EncodeToString(bytes)
	access, err := s.tokens.Issue(user.Email, now)
	if err != nil {
		return response, "", err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO public.t_refresh_sessions(id,user_id,token_hash,expires_at,user_agent,ip_address,created_at)
		VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6) RETURNING id::text`, user.ID, hash(raw), now.Add(s.settings.RefreshTTL), truncate(meta.UserAgent, 500), truncate(meta.IP, 64), now).Scan(&id)
	if err != nil {
		return response, "", err
	}
	return SessionResponse{user.ID, user.Email, access, raw, s.tokens.ttl.Milliseconds(), user.Roles}, id, nil
}

func (s *Service) Refresh(ctx context.Context, raw string, meta Metadata) (SessionResponse, error) {
	var response SessionResponse
	if strings.TrimSpace(raw) == "" {
		return response, InvalidRefresh
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return response, err
	}
	defer tx.Rollback(context.Background())
	var userID string
	err = tx.QueryRow(ctx, `SELECT user_id::text FROM public.t_refresh_sessions WHERE token_hash=$1`, hash(raw)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return response, InvalidRefresh
	}
	if err != nil {
		return response, err
	}
	// Lock user first in every credential mutation. This serializes refresh with
	// logout-all and login; the token is rechecked only after acquiring the lock.
	user, err := loadUser(ctx, tx, "id=$1", userID, true)
	if errors.Is(err, pgx.ErrNoRows) {
		return response, InvalidRefresh
	}
	if err != nil {
		return response, err
	}
	if user.status != "ACTIVE" {
		return response, InvalidRefresh
	}
	var id string
	var expires time.Time
	var revoked *time.Time
	err = tx.QueryRow(ctx, `SELECT id::text,expires_at,revoked_at FROM public.t_refresh_sessions WHERE token_hash=$1 FOR UPDATE`, hash(raw)).Scan(&id, &expires, &revoked)
	if errors.Is(err, pgx.ErrNoRows) {
		return response, InvalidRefresh
	}
	if err != nil {
		return response, err
	}
	now := time.Now().UTC()
	if revoked != nil || !expires.After(now) {
		return response, InvalidRefresh
	}
	response, replacement, err := s.issue(ctx, tx, user, meta, now)
	if err != nil {
		return response, err
	}
	if _, err = tx.Exec(ctx, `UPDATE public.t_refresh_sessions SET revoked_at=$2,last_used_at=$2,replaced_by_id=$3 WHERE id=$1`, id, now, replacement); err != nil {
		return response, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResponse{}, err
	}
	return response, nil
}

func (s *Service) Logout(ctx context.Context, raw string) error {
	if strings.TrimSpace(raw) == "" {
		return InvalidRefresh
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var userID string
	err = tx.QueryRow(ctx, `SELECT user_id::text FROM public.t_refresh_sessions WHERE token_hash=$1`, hash(raw)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `SELECT id FROM public.t_users WHERE id=$1 FOR UPDATE`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE public.t_refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1`, hash(raw)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) LogoutAll(ctx context.Context, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SELECT id FROM public.t_users WHERE id=$1 FOR UPDATE`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE public.t_refresh_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Authenticate(ctx context.Context, raw string) (User, error) {
	email, err := s.tokens.Subject(raw)
	if err != nil {
		return User{}, InvalidAccess
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(context.Background())
	user, err := loadUser(ctx, tx, "email=$1", email, false)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, &Failure{401, "AUTH_401", "Пользователь из JWT не найден или недоступен"}
	}
	if err != nil {
		return User{}, err
	}
	if user.status != "ACTIVE" {
		return User{}, &Failure{401, "AUTH_401", "Учетная запись неактивна"}
	}
	if err = tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return user, nil
}

func hash(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(digest[:])
}
func truncate(value string, length int) string {
	runes := []rune(value)
	if len(runes) > length {
		runes = runes[:length]
	}
	return string(runes)
}

// ValidateSchema verifies the autonomous MVP tables after embedded migrations.
func ValidateSchema(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `SELECT `+userColumns+` FROM public.t_users LIMIT 0`)
	if err != nil {
		return errors.New("identity schema is incompatible")
	}
	rows.Close()
	var complete bool
	if err = pool.QueryRow(ctx, `SELECT to_regclass('public.mvp_task_completions') IS NOT NULL AND to_regclass('public.mvp_file_uploads') IS NOT NULL`).Scan(&complete); err != nil || !complete {
		return errors.New("MVP schema is incomplete")
	}
	return nil
}
