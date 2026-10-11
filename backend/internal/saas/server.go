// Package saas controls isolated pilot installations; it never queries laboratory business data.
package saas

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/http/httputil"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

//go:embed schema.sql web/*
var assets embed.FS

type Config struct {
	PublicURL, BaseDomain, OwnerEmail, OwnerPassword, WorkerSecret string
	PortBase                                                       int
}
type Server struct {
	pool     *pgxpool.Pool
	cfg      Config
	public   *url.URL
	mux      *http.ServeMux
	mu       sync.Mutex
	attempts map[string][]time.Time
}
type Lab struct {
	Slot      int        `json:"slot"`
	Slug      string     `json:"slug"`
	Name      string     `json:"name"`
	Email     string     `json:"email"`
	Status    string     `json:"status"`
	URL       string     `json:"url"`
	TrialEnds *time.Time `json:"trialEnds"`
	Error     string     `json:"error"`
	Created   time.Time  `json:"createdAt"`
}
type failure struct {
	status  int
	message string
}

func (e *failure) Error() string { return e.message }
func bad(message string) error   { return &failure{400, message} }
func hash(raw string) string     { h := sha256.Sum256([]byte(raw)); return hex.EncodeToString(h[:]) }
func secret() string             { return rand.Text() + rand.Text() }
func email(raw string) (string, error) {
	raw = strings.ToLower(strings.TrimSpace(raw))
	e, err := mail.ParseAddress(raw)
	if err != nil || e.Address != raw || len(raw) > 254 {
		return "", bad("Укажите корректный email")
	}
	return raw, nil
}
func validName(raw string) bool { return len(strings.TrimSpace(raw)) >= 2 && len(raw) <= 200 }
func New(ctx context.Context, pool *pgxpool.Pool, c Config) (*Server, error) {
	u, e := url.Parse(c.PublicURL)
	if e != nil || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return nil, errors.New("invalid SAAS_PUBLIC_URL")
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1")) {
		return nil, errors.New("public SaaS requires HTTPS; HTTP is only allowed on localhost")
	}
	c.PublicURL = strings.TrimRight(c.PublicURL, "/")
	c.BaseDomain = strings.ToLower(c.BaseDomain)
	if !regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$`).MatchString(c.BaseDomain) || strings.Contains(c.BaseDomain, "..") {
		return nil, errors.New("invalid SAAS_BASE_DOMAIN")
	}
	if c.PortBase < 1024 || c.PortBase > 65000 || len(c.WorkerSecret) < 32 {
		return nil, errors.New("invalid worker secret or port base")
	}
	c.OwnerEmail, e = email(c.OwnerEmail)
	if e != nil {
		return nil, e
	}
	if len(c.OwnerPassword) < 12 || len(c.OwnerPassword) > 72 {
		return nil, errors.New("owner password requires 12..72 bytes")
	}
	tx, e := pool.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(942671001)`); e != nil {
		return nil, e
	}
	raw, _ := assets.ReadFile("schema.sql")
	if _, e = tx.Exec(ctx, string(raw), pgx.QueryExecModeSimpleProtocol); e != nil {
		return nil, e
	}
	var exists bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM saas_owner WHERE id=1)`).Scan(&exists); e != nil {
		return nil, e
	}
	if !exists {
		h, e := bcrypt.GenerateFromPassword([]byte(c.OwnerPassword), 12)
		if e != nil {
			return nil, e
		}
		if _, e = tx.Exec(ctx, `INSERT INTO saas_owner VALUES(1,$1,$2)`, c.OwnerEmail, string(h)); e != nil {
			return nil, e
		}
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	s := &Server{pool: pool, cfg: c, public: u, mux: http.NewServeMux(), attempts: map[string][]time.Time{}}
	s.mux.HandleFunc("GET /health", s.wrap(s.health))
	s.registerMFA()
	s.mux.HandleFunc("POST /api/login", s.wrap(s.login))
	s.mux.HandleFunc("POST /api/logout", s.wrap(s.logout))
	s.mux.HandleFunc("GET /api/owner/labs", s.wrap(s.owner(s.list)))
	s.mux.HandleFunc("POST /api/owner/invitations", s.wrap(s.owner(s.invite)))
	s.mux.HandleFunc("POST /api/owner/labs/{slot}/{action}", s.wrap(s.owner(s.manage)))
	s.mux.HandleFunc("GET /api/owner/events", s.wrap(s.owner(s.events)))
	s.mux.HandleFunc("GET /api/invitations/{token}", s.wrap(s.invitation))
	s.mux.HandleFunc("POST /api/invitations/{token}/register", s.wrap(s.register))
	s.mux.HandleFunc("POST /internal/jobs/claim", s.wrap(s.worker(s.claim)))
	s.mux.HandleFunc("POST /internal/heartbeat", s.wrap(s.worker(s.heartbeat)))
	s.mux.HandleFunc("POST /internal/jobs/{id}/complete", s.wrap(s.worker(s.complete)))
	s.registerPlatform()
	web, _ := fs.Sub(assets, "web")
	s.mux.Handle("GET /", http.FileServer(http.FS(web)))
	return s, nil
}

type endpoint func(http.ResponseWriter, *http.Request) error

func (s *Server) wrap(f endpoint) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if e := f(w, r); e != nil {
			var x *failure
			if errors.As(e, &x) {
				reply(w, x.status, map[string]string{"message": x.message})
			} else {
				reply(w, 500, map[string]string{"message": "Ошибка сервера. Сообщите владельцу."})
			}
		}
	}
}
func reply(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func read(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 16384)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return bad("Некорректные данные")
	}
	if d.Decode(new(any)) != io.EOF {
		return bad("Некорректные данные")
	}
	return nil
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Frame-Options", "DENY")
	if s.public.Scheme == "https" {
		w.Header().Set("Strict-Transport-Security", "max-age=31536000")
	}
	host := strings.ToLower(r.Host)
	if host != strings.ToLower(s.public.Host) {
		s.tenant(w, r)
		return
	}
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
	if r.Method != "GET" && r.Method != "HEAD" && !strings.HasPrefix(r.URL.Path, "/internal/") && r.Header.Get("Origin") != s.cfg.PublicURL {
		reply(w, 403, map[string]string{"message": "Запрос должен идти из панели"})
		return
	}
	s.mux.ServeHTTP(w, r)
}
func (s *Server) owner(f endpoint) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		c, e := r.Cookie("teethtechOwner")
		if e != nil {
			return &failure{401, "Войдите в панель владельца"}
		}
		var ok bool
		e = s.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM saas_sessions WHERE token_hash=$1 AND expires_at>now())`, hash(c.Value)).Scan(&ok)
		if e != nil {
			return e
		}
		if !ok {
			return &failure{401, "Войдите в панель владельца"}
		}
		return f(w, r)
	}
}
func (s *Server) worker(f endpoint) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		h, _, e := net.SplitHostPort(r.RemoteAddr)
		ip := net.ParseIP(h)
		if e != nil || ip == nil || !ip.IsLoopback() || r.Header.Get("X-Forwarded-For") != "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.cfg.WorkerSecret)) != 1 {
			return &failure{403, "Доступ закрыт"}
		}
		return f(w, r)
	}
}
func (s *Server) throttle(key string, limit int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if _, exists := s.attempts[key]; !exists && len(s.attempts) >= 10000 {
		for k, values := range s.attempts {
			if len(values) == 0 || now.Sub(values[len(values)-1]) >= time.Minute {
				delete(s.attempts, k)
			}
		}
		if len(s.attempts) >= 10000 {
			return false
		}
	}
	times := s.attempts[key][:0]
	for _, t := range s.attempts[key] {
		if now.Sub(t) < time.Minute {
			times = append(times, t)
		}
	}
	if len(times) >= limit {
		return false
	}
	s.attempts[key] = append(times, now)
	return true
}
func requestIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return "unknown"
	}
	ip := net.ParseIP(host)
	// Only the local edge is trusted. Take the rightmost address it appends,
	// never an attacker-controlled address at the start of the chain.
	if ip != nil && ip.IsLoopback() {
		chain := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		last := net.ParseIP(strings.TrimSpace(chain[len(chain)-1]))
		if last != nil {
			return last.String()
		}
	}
	return host
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) error {
	if !s.throttle("owner-login:"+requestIP(r), 6) || !s.throttle("owner-login-global", 60) {
		w.Header().Set("Retry-After", "60")
		return &failure{429, "Слишком много попыток. Подождите минуту."}
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if e := read(w, r, &in); e != nil {
		return e
	}
	var em, h string
	if e := s.pool.QueryRow(r.Context(), `SELECT email,password_hash FROM saas_owner WHERE id=1`).Scan(&em, &h); e != nil {
		return e
	}
	match := bcrypt.CompareHashAndPassword([]byte(h), []byte(in.Password))
	if strings.ToLower(strings.TrimSpace(in.Email)) != em || match != nil {
		return &failure{401, "Неверный email или пароль"}
	}
	if e := s.verifyOwnerOTP(r, strings.TrimSpace(in.Code)); e != nil {
		return e
	}
	token := secret()
	if _, e := s.pool.Exec(r.Context(), `DELETE FROM saas_sessions WHERE expires_at<=now()`); e != nil {
		return e
	}
	if _, e := s.pool.Exec(r.Context(), `INSERT INTO saas_sessions VALUES($1,now()+interval '8 hours')`, hash(token)); e != nil {
		return e
	}
	http.SetCookie(w, &http.Cookie{Name: "teethtechOwner", Value: token, Path: "/", HttpOnly: true, Secure: s.public.Scheme == "https", SameSite: http.SameSiteStrictMode, MaxAge: 28800})
	reply(w, 200, map[string]bool{"ok": true})
	return nil
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	if c, e := r.Cookie("teethtechOwner"); e == nil {
		if _, e = s.pool.Exec(r.Context(), `DELETE FROM saas_sessions WHERE token_hash=$1`, hash(c.Value)); e != nil {
			return e
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "teethtechOwner", Path: "/", HttpOnly: true, Secure: s.public.Scheme == "https", SameSite: http.SameSiteStrictMode, MaxAge: -1})
	reply(w, 200, map[string]bool{"ok": true})
	return nil
}
func (s *Server) health(w http.ResponseWriter, r *http.Request) error {
	if e := s.pool.Ping(r.Context()); e != nil {
		return e
	}
	reply(w, 200, map[string]string{"status": "UP"})
	return nil
}

func (s *Server) heartbeat(w http.ResponseWriter, r *http.Request) error {
	_, e := s.pool.Exec(r.Context(), `INSERT INTO saas_worker VALUES(1,now()) ON CONFLICT(id) DO UPDATE SET last_seen=now()`)
	if e != nil {
		return e
	}
	w.WriteHeader(204)
	return nil
}
func (s *Server) labURL(slot int) string {
	host := fmt.Sprintf("lab%d.%s", slot, s.cfg.BaseDomain)
	if p := s.public.Port(); p != "" {
		host += ":" + p
	}
	return s.public.Scheme + "://" + host
}
func scanLab(row pgx.Row) (Lab, error) {
	var l Lab
	e := row.Scan(&l.Slot, &l.Name, &l.Email, &l.Status, &l.TrialEnds, &l.Error, &l.Created)
	return l, e
}

const labColumns = `slot,name,contact_email,status,trial_ends_at,error,created_at`

func (s *Server) decorate(l Lab) Lab {
	l.Slug = fmt.Sprintf("lab%d", l.Slot)
	l.URL = s.labURL(l.Slot)
	return l
}
func (s *Server) list(w http.ResponseWriter, r *http.Request) error {
	rows, e := s.pool.Query(r.Context(), `SELECT `+labColumns+` FROM saas_labs ORDER BY slot`)
	if e != nil {
		return e
	}
	defer rows.Close()
	out := []Lab{}
	for rows.Next() {
		l, e := scanLab(rows)
		if e != nil {
			return e
		}
		out = append(out, s.decorate(l))
	}
	if e = rows.Err(); e != nil {
		return e
	}
	var seen *time.Time
	if e = s.pool.QueryRow(r.Context(), `SELECT max(last_seen) FROM saas_worker`).Scan(&seen); e != nil {
		return e
	}
	reply(w, 200, map[string]any{"labs": out, "workerLastSeen": seen, "capacity": 3})
	return nil
}
func event(ctx context.Context, tx pgx.Tx, slot int, action string) error {
	_, e := tx.Exec(ctx, `INSERT INTO saas_events(slot,action) VALUES($1,$2)`, slot, action)
	return e
}
func enqueue(ctx context.Context, tx pgx.Tx, slot int, action string) error {
	_, e := tx.Exec(ctx, `INSERT INTO saas_jobs(slot,action) VALUES($1,$2)`, slot, action)
	return e
}
func (s *Server) invite(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Days  int    `json:"days"`
	}
	if e := read(w, r, &in); e != nil {
		return e
	}
	em, e := email(in.Email)
	if e != nil {
		return e
	}
	if !validName(in.Name) || in.Days < 1 || in.Days > 90 {
		return bad("Название: 2..200 символов; пилот: 1..90 дней")
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	if _, e = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(942671002)`); e != nil {
		return e
	}
	var slot int
	e = tx.QueryRow(r.Context(), `SELECT n FROM generate_series(1,3)n WHERE NOT EXISTS(SELECT 1 FROM saas_labs WHERE slot=n) ORDER BY n LIMIT 1`).Scan(&slot)
	if e == pgx.ErrNoRows {
		return &failure{409, "Все три места пилота заняты"}
	}
	if e != nil {
		return e
	}
	token := secret()
	if _, e = tx.Exec(r.Context(), `INSERT INTO saas_labs(slot,name,contact_email,invite_hash,invite_expires_at,trial_days) VALUES($1,$2,$3,$4,now()+interval '7 days',$5)`, slot, strings.TrimSpace(in.Name), em, hash(token), in.Days); e != nil {
		return e
	}
	if e = event(r.Context(), tx, slot, "INVITED"); e != nil {
		return e
	}
	if e = tx.Commit(r.Context()); e != nil {
		return e
	}
	reply(w, 201, map[string]any{"slot": slot, "inviteUrl": s.cfg.PublicURL + "/invite.html#" + token})
	return nil
}
func (s *Server) invitation(w http.ResponseWriter, r *http.Request) error {
	l, e := scanLab(s.pool.QueryRow(r.Context(), `SELECT `+labColumns+` FROM saas_labs WHERE invite_hash=$1 AND (invite_expires_at>now() OR registered_at IS NOT NULL)`, hash(r.PathValue("token"))))
	if e == pgx.ErrNoRows {
		return &failure{404, "Приглашение не найдено или истекло"}
	}
	if e != nil {
		return e
	}
	// Do not disclose the contact email to holders of a setup link.
	l.Email = ""
	l.Error = ""
	reply(w, 200, s.decorate(l))
	return nil
}
func (s *Server) register(w http.ResponseWriter, r *http.Request) error {
	if !s.throttle("register:"+requestIP(r), 6) || !s.throttle("register-global", 60) {
		return &failure{429, "Подождите минуту перед следующей попыткой"}
	}
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if e := read(w, r, &in); e != nil {
		return e
	}
	em, e := email(in.Email)
	if e != nil {
		return e
	}
	if !validName(in.Name) || len(in.Password) < 12 || len(in.Password) > 72 {
		return bad("Укажите имя и пароль длиной 12..72 байта")
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	var slot int
	var expected, status string
	var valid bool
	e = tx.QueryRow(r.Context(), `SELECT slot,contact_email,status,invite_expires_at>now() FROM saas_labs WHERE invite_hash=$1 FOR UPDATE`, hash(r.PathValue("token"))).Scan(&slot, &expected, &status, &valid)
	if e == pgx.ErrNoRows {
		return &failure{404, "Приглашение не найдено"}
	}
	if e != nil {
		return e
	}
	if !valid || status != "INVITED" {
		return &failure{409, "Приглашение уже использовано, отменено или истекло"}
	}
	if em != expected {
		return bad("Используйте email, на который владелец выдал приглашение")
	}
	h, e := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if e != nil {
		return e
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_labs SET admin_name=$2,admin_hash=$3,status='PROVISIONING',registered_at=now(),updated_at=now() WHERE slot=$1`, slot, strings.TrimSpace(in.Name), string(h)); e != nil {
		return e
	}
	if e = enqueue(r.Context(), tx, slot, "CREATE"); e != nil {
		return e
	}
	if e = event(r.Context(), tx, slot, "REGISTERED"); e != nil {
		return e
	}
	if e = tx.Commit(r.Context()); e != nil {
		return e
	}
	reply(w, 202, map[string]string{"status": "PROVISIONING"})
	return nil
}
func (s *Server) manage(w http.ResponseWriter, r *http.Request) error {
	slot, e := strconv.Atoi(r.PathValue("slot"))
	if e != nil || slot < 1 || slot > 3 {
		return bad("Некорректная лаборатория")
	}
	action := r.PathValue("action")
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	var status string
	var trial *time.Time
	e = tx.QueryRow(r.Context(), `SELECT status,trial_ends_at FROM saas_labs WHERE slot=$1 FOR UPDATE`, slot).Scan(&status, &trial)
	if e == pgx.ErrNoRows {
		return &failure{404, "Лаборатория не найдена"}
	}
	if e != nil {
		return e
	}
	switch action {
	case "suspend":
		if status != "READY" {
			return &failure{409, "Остановить можно работающую лабораторию"}
		}
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='STOPPING',updated_at=now() WHERE slot=$1`, slot)
		if e == nil {
			e = enqueue(r.Context(), tx, slot, "STOP")
		}
	case "resume":
		if status != "SUSPENDED" || trial == nil || !trial.After(time.Now()) {
			return &failure{409, "Сначала продлите пилот; запуск доступен для приостановленной лаборатории"}
		}
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='STARTING',updated_at=now() WHERE slot=$1`, slot)
		if e == nil {
			e = enqueue(r.Context(), tx, slot, "START")
		}
	case "retry":
		if status != "FAILED" {
			return &failure{409, "Повторный запуск доступен после ошибки"}
		}
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='PROVISIONING',error='',updated_at=now() WHERE slot=$1`, slot)
		if e == nil {
			e = enqueue(r.Context(), tx, slot, "CREATE")
		}
	case "extend":
		var in struct {
			Days int `json:"days"`
		}
		if e = read(w, r, &in); e != nil {
			return e
		}
		if in.Days < 1 || in.Days > 90 {
			return bad("Продление: 1..90 дней")
		}
		if trial == nil {
			return &failure{409, "Пилот ещё не начался"}
		}
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET trial_ends_at=GREATEST(trial_ends_at,now())+make_interval(days=>$2),updated_at=now() WHERE slot=$1`, slot, in.Days)
	case "renew-invite":
		if status != "INVITED" && status != "REVOKED" {
			return &failure{409, "Руководитель уже зарегистрирован"}
		}
		token := secret()
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET invite_hash=$2,invite_expires_at=now()+interval '7 days',status='INVITED',updated_at=now() WHERE slot=$1`, slot, hash(token))
		if e != nil {
			return e
		}
		if e = event(r.Context(), tx, slot, "INVITE_RENEWED"); e != nil {
			return e
		}
		if e = tx.Commit(r.Context()); e != nil {
			return e
		}
		reply(w, 200, map[string]string{"inviteUrl": s.cfg.PublicURL + "/invite.html#" + token})
		return nil
	case "revoke":
		if status != "INVITED" {
			return &failure{409, "Отменить можно неиспользованное приглашение"}
		}
		_, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='REVOKED',invite_expires_at=now(),updated_at=now() WHERE slot=$1`, slot)
	default:
		return bad("Неизвестное действие")
	}
	if e != nil {
		return e
	}
	if e = event(r.Context(), tx, slot, strings.ToUpper(action)); e != nil {
		return e
	}
	if e = tx.Commit(r.Context()); e != nil {
		return e
	}
	reply(w, 200, map[string]bool{"ok": true})
	return nil
}
func (s *Server) events(w http.ResponseWriter, r *http.Request) error {
	rows, e := s.pool.Query(r.Context(), `SELECT slot,action,created_at FROM saas_events ORDER BY id DESC LIMIT 100`)
	if e != nil {
		return e
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var slot int
		var action string
		var at time.Time
		if e = rows.Scan(&slot, &action, &at); e != nil {
			return e
		}
		out = append(out, map[string]any{"slot": slot, "action": action, "at": at})
	}
	if e = rows.Err(); e != nil {
		return e
	}
	reply(w, 200, out)
	return nil
}

// Claim serializes installation jobs. Expired leases become retryable errors instead of silently running twice.
func (s *Server) claim(w http.ResponseWriter, r *http.Request) error {
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	if _, e = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(942671003)`); e != nil {
		return e
	}
	if _, e = tx.Exec(r.Context(), `INSERT INTO saas_worker VALUES(1,now()) ON CONFLICT(id) DO UPDATE SET last_seen=now()`); e != nil {
		return e
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='FAILED',error='Задание не завершилось вовремя. Проверьте worker перед повторным запуском.',updated_at=now() WHERE slot IN(SELECT slot FROM saas_jobs WHERE state='RUNNING' AND lease_until<now())`); e != nil {
		return e
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_jobs SET state='FAILED',finished_at=now() WHERE state='RUNNING' AND lease_until<now()`); e != nil {
		return e
	}
	rows, e := tx.Query(r.Context(), `SELECT slot FROM saas_labs WHERE status='READY' AND trial_ends_at<=now() FOR UPDATE`)
	if e != nil {
		return e
	}
	expired := []int{}
	for rows.Next() {
		var slot int
		if e = rows.Scan(&slot); e != nil {
			rows.Close()
			return e
		}
		expired = append(expired, slot)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, slot := range expired {
		if _, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status='STOPPING',updated_at=now() WHERE slot=$1`, slot); e != nil {
			return e
		}
		if e = enqueue(r.Context(), tx, slot, "STOP"); e != nil {
			return e
		}
		if e = event(r.Context(), tx, slot, "TRIAL_EXPIRED"); e != nil {
			return e
		}
	}
	var id int64
	var slot int
	var action string
	e = tx.QueryRow(r.Context(), `SELECT id,slot,action FROM saas_jobs WHERE state='PENDING' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id, &slot, &action)
	if e == pgx.ErrNoRows {
		if e = tx.Commit(r.Context()); e != nil {
			return e
		}
		w.WriteHeader(204)
		return nil
	}
	if e != nil {
		return e
	}
	lease := secret()
	if _, e = tx.Exec(r.Context(), `UPDATE saas_jobs SET state='RUNNING',lease_hash=$2,lease_until=now()+interval '20 minutes' WHERE id=$1`, id, hash(lease)); e != nil {
		return e
	}
	var name, em, admin, h string
	if e = tx.QueryRow(r.Context(), `SELECT name,contact_email,admin_name,admin_hash FROM saas_labs WHERE slot=$1`, slot).Scan(&name, &em, &admin, &h); e != nil {
		return e
	}
	if e = tx.Commit(r.Context()); e != nil {
		return e
	}
	reply(w, 200, map[string]any{"id": id, "slot": slot, "slug": fmt.Sprintf("lab%d", slot), "name": name, "email": em, "adminName": admin, "adminHash": h, "action": action, "lease": lease, "port": s.cfg.PortBase + slot, "url": s.labURL(slot)})
	return nil
}
func (s *Server) complete(w http.ResponseWriter, r *http.Request) error {
	id, e := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if e != nil {
		return bad("Некорректное задание")
	}
	var in struct {
		Lease   string `json:"lease"`
		Success bool   `json:"success"`
	}
	if e = read(w, r, &in); e != nil {
		return e
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	var slot int
	var action string
	e = tx.QueryRow(r.Context(), `SELECT slot,action FROM saas_jobs WHERE id=$1 AND state='RUNNING' AND lease_hash=$2 AND lease_until>now() FOR UPDATE`, id, hash(in.Lease)).Scan(&slot, &action)
	if e == pgx.ErrNoRows {
		return &failure{409, "Задание устарело"}
	}
	if e != nil {
		return e
	}
	status := "READY"
	if action == "STOP" {
		status = "SUSPENDED"
	}
	state := "DONE"
	msg := ""
	if !in.Success {
		status = "FAILED"
		state = "FAILED"
		msg = "Не удалось выполнить действие. Проверьте приватный журнал worker и повторите запуск."
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_labs SET status=$2,error=$3,trial_ends_at=CASE WHEN $2='READY' THEN COALESCE(trial_ends_at,now()+make_interval(days=>trial_days)) ELSE trial_ends_at END,updated_at=now() WHERE slot=$1`, slot, status, msg); e != nil {
		return e
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_jobs SET state=$2,finished_at=now(),lease_hash='' WHERE id=$1`, id, state); e != nil {
		return e
	}
	if e = event(r.Context(), tx, slot, status); e != nil {
		return e
	}
	if e = tx.Commit(r.Context()); e != nil {
		return e
	}
	reply(w, 200, map[string]bool{"ok": true})
	return nil
}
func (s *Server) tenant(w http.ResponseWriter, r *http.Request) {
	slot := 0
	for n := 1; n <= 3; n++ {
		u, _ := url.Parse(s.labURL(n))
		if strings.EqualFold(r.Host, u.Host) {
			slot = n
			break
		}
	}
	if slot == 0 {
		http.NotFound(w, r)
		return
	}
	var ok bool
	e := s.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM saas_labs WHERE slot=$1 AND status='READY' AND trial_ends_at>now())`, slot).Scan(&ok)
	if e != nil || !ok {
		http.Error(w, "Лаборатория ещё готовится или доступ приостановлен. Данные не удаляются автоматически. Для возобновления доступа или получения выгрузки свяжитесь с владельцем сервиса.", http.StatusServiceUnavailable)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/platform/") {
		s.wrap(func(w http.ResponseWriter, r *http.Request) error { return s.platform(w, r, slot) })(w, r)
		return
	}
	// Upstream is derived from a fixed slot, never from a request URL. Forwarded host/proto are replaced.
	target, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", s.cfg.PortBase+slot))
	p := &httputil.ReverseProxy{Rewrite: func(pr *httputil.ProxyRequest) {
		pr.SetURL(target)
		pr.Out.Host = r.Host
		pr.Out.Header.Set("X-Forwarded-Host", r.Host)
		pr.Out.Header.Set("X-Forwarded-Proto", s.public.Scheme)
		pr.SetXForwarded()
		pr.Out.Header.Set("X-Forwarded-Proto", s.public.Scheme)
	}, ErrorHandler: func(w http.ResponseWriter, r *http.Request, e error) {
		http.Error(w, "CRM временно недоступна. Свяжитесь с владельцем сервиса.", 502)
	}}
	p.ServeHTTP(w, r)
}
