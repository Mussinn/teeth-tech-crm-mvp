package saas

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func totp(secret, code string, now time.Time, last int64) (int64, bool) {
	key, e := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if e != nil || len(code) != 6 {
		return 0, false
	}
	for offset := int64(-1); offset <= 1; offset++ {
		counter := now.Unix()/30 + offset
		if counter <= last {
			continue
		}
		var b [8]byte
		binary.BigEndian.PutUint64(b[:], uint64(counter))
		m := hmac.New(sha1.New, key)
		m.Write(b[:])
		sum := m.Sum(nil)
		n := sum[len(sum)-1] & 15
		value := (binary.BigEndian.Uint32(sum[n:n+4]) & 0x7fffffff) % 1000000
		if subtle.ConstantTimeCompare([]byte(fmt.Sprintf("%06d", value)), []byte(code)) == 1 {
			return counter, true
		}
	}
	return 0, false
}
func (s *Server) otpCipher() (cipher.AEAD, error) {
	key := sha256.Sum256([]byte("teethtech-owner-mfa:" + s.cfg.WorkerSecret))
	b, e := aes.NewCipher(key[:])
	if e != nil {
		return nil, e
	}
	return cipher.NewGCM(b)
}
func (s *Server) sealOTP(secret string) (string, error) {
	g, e := s.otpCipher()
	if e != nil {
		return "", e
	}
	nonce := make([]byte, g.NonceSize())
	if _, e = rand.Read(nonce); e != nil {
		return "", e
	}
	return base64.RawStdEncoding.EncodeToString(g.Seal(nonce, nonce, []byte(secret), []byte("owner-mfa-v1"))), nil
}
func (s *Server) openOTP(value string) (string, error) {
	g, e := s.otpCipher()
	if e != nil {
		return "", e
	}
	data, e := base64.RawStdEncoding.DecodeString(value)
	if e != nil || len(data) < g.NonceSize() {
		return "", fmt.Errorf("invalid mfa secret")
	}
	plain, e := g.Open(nil, data[:g.NonceSize()], data[g.NonceSize():], []byte("owner-mfa-v1"))
	return string(plain), e
}
func (s *Server) passwordOK(r *http.Request, password string) bool {
	var hash string
	return s.pool.QueryRow(r.Context(), `SELECT password_hash FROM saas_owner WHERE id=1`).Scan(&hash) == nil && bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
func (s *Server) verifyOwnerOTP(r *http.Request, code string) error {
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(r.Context())
	var encrypted string
	var last int64
	e = tx.QueryRow(r.Context(), `SELECT secret,last_counter FROM saas_owner_mfa WHERE id=1 AND enabled FOR UPDATE`).Scan(&encrypted, &last)
	if e == pgx.ErrNoRows {
		return nil
	}
	if e != nil {
		return e
	}
	key, e := s.openOTP(encrypted)
	if e != nil {
		return e
	}
	counter, ok := totp(key, code, time.Now(), last)
	if !ok {
		return &failure{401, "Введите новый шестизначный код из приложения-аутентификатора"}
	}
	if _, e = tx.Exec(r.Context(), `UPDATE saas_owner_mfa SET last_counter=$1 WHERE id=1`, counter); e != nil {
		return e
	}
	return tx.Commit(r.Context())
}
func (s *Server) registerMFA() {
	s.mux.HandleFunc("GET /api/owner/mfa", s.wrap(s.owner(func(w http.ResponseWriter, r *http.Request) error {
		var enabled bool
		e := s.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM saas_owner_mfa WHERE enabled)`).Scan(&enabled)
		if e != nil {
			return e
		}
		reply(w, 200, map[string]bool{"enabled": enabled})
		return nil
	})))
	for _, action := range []string{"begin", "confirm", "disable"} {
		action := action
		s.mux.HandleFunc("POST /api/owner/mfa/"+action, s.wrap(s.owner(func(w http.ResponseWriter, r *http.Request) error {
			if !s.throttle("owner-mfa:"+requestIP(r), 6) {
				return &failure{429, "Подождите минуту перед повторной попыткой"}
			}
			var in struct {
				Password string `json:"password"`
				Code     string `json:"code"`
			}
			if e := read(w, r, &in); e != nil {
				return e
			}
			if !s.passwordOK(r, in.Password) {
				return &failure{401, "Неверный пароль владельца"}
			}
			tx, e := s.pool.Begin(r.Context())
			if e != nil {
				return e
			}
			defer tx.Rollback(r.Context())
			if _, e = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(841338,1)`); e != nil {
				return e
			}
			var enabled bool
			var encrypted string
			var until time.Time
			var last int64
			e = tx.QueryRow(r.Context(), `SELECT enabled,secret,pending_until,last_counter FROM saas_owner_mfa WHERE id=1 FOR UPDATE`).Scan(&enabled, &encrypted, &until, &last)
			if e != nil && e != pgx.ErrNoRows {
				return e
			}
			if action == "begin" {
				if enabled {
					return &failure{409, "Двухфакторный вход уже включён"}
				}
				raw := make([]byte, 20)
				if _, e = rand.Read(raw); e != nil {
					return e
				}
				secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
				sealed, e := s.sealOTP(secret)
				if e != nil {
					return e
				}
				if _, e = tx.Exec(r.Context(), `INSERT INTO saas_owner_mfa(id,secret,pending_until) VALUES(1,$1,now()+interval '10 minutes') ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,pending_until=excluded.pending_until,last_counter=-1`, sealed); e != nil {
					return e
				}
				if e = tx.Commit(r.Context()); e != nil {
					return e
				}
				reply(w, 200, map[string]string{"secret": secret, "uri": "otpauth://totp/" + url.PathEscape("TeethTech:"+s.cfg.OwnerEmail) + "?secret=" + secret + "&issuer=TeethTech"})
				return nil
			}
			if e == pgx.ErrNoRows || (!enabled && time.Now().After(until)) || (action == "confirm" && enabled) || (action == "disable" && !enabled) {
				return &failure{409, "Настройка недоступна или истекла. Начните заново"}
			}
			key, e := s.openOTP(encrypted)
			if e != nil {
				return e
			}
			counter, ok := totp(key, strings.TrimSpace(in.Code), time.Now(), last)
			if !ok {
				return &failure{400, "Неверный или уже использованный код"}
			}
			if action == "confirm" {
				_, e = tx.Exec(r.Context(), `UPDATE saas_owner_mfa SET enabled=true,last_counter=$1 WHERE id=1`, counter)
			} else {
				_, e = tx.Exec(r.Context(), `DELETE FROM saas_owner_mfa WHERE id=1`)
			}
			if e != nil {
				return e
			}
			cookie, e := r.Cookie("teethtechOwner")
			if e != nil {
				return e
			}
			if _, e = tx.Exec(r.Context(), `DELETE FROM saas_sessions WHERE token_hash<>$1`, hash(cookie.Value)); e != nil {
				return e
			}
			if e = tx.Commit(r.Context()); e != nil {
				return e
			}
			reply(w, 200, map[string]bool{"ok": true})
			return nil
		})))
	}
}
