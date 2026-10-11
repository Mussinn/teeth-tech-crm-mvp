package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/netip"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"teethtech.local/crm/internal/adminops"
	"teethtech.local/crm/internal/catalog"
	"teethtech.local/crm/internal/clinic"
	"teethtech.local/crm/internal/files"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/kpi"
	"teethtech.local/crm/internal/notes"
	"teethtech.local/crm/internal/notifications"
	"teethtech.local/crm/internal/orders"
	"teethtech.local/crm/internal/warehouse"
	"teethtech.local/crm/internal/workflow"
)

type Options struct {
	Ready          func(context.Context) error
	KPI            *kpi.Service
	Files          *files.Service
	Stock          *warehouse.Service
	Admin          *adminops.Service
	Notifications  *notifications.Service
	Notes          *notes.Service
	Identity       *identity.Service
	Catalog        *catalog.Service
	Clinics        *clinic.Service
	Orders         *orders.Service
	Workflow       *workflow.Service
	AuthRateLimit  int
	AllowedOrigins []string
	TrustedProxies []netip.Prefix
}

type limiter struct {
	sync.Mutex
	minute int64
	counts map[string]int
	limit  int
}

func (l *limiter) allow(ip string) bool {
	l.Lock()
	defer l.Unlock()
	minute := time.Now().Unix() / 60
	if l.minute != minute {
		l.minute = minute
		l.counts = make(map[string]int)
	}
	if _, exists := l.counts[ip]; !exists && len(l.counts) >= 10000 {
		return false
	}
	l.counts[ip]++
	return l.counts[ip] <= l.limit
}

func registerAuth(mux *http.ServeMux, options Options) {
	limit := options.AuthRateLimit
	if limit < 1 {
		limit = 20
	}
	throttle := &limiter{limit: limit}
	for _, path := range []string{"/auth/login", "/auth/sessions", "/auth/sessions/refresh", "/auth/sessions/logout", "/auth/sessions/logout-all"} {
		mux.HandleFunc("POST "+Prefix+path, func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
			ip := clientIP(r, options.TrustedProxies)
			if (path == "/auth/login" || path == "/auth/sessions" || path == "/auth/sessions/refresh") && !throttle.allow(ip) {
				w.Header().Set("Retry-After", "60")
				writeJSON(w, 429, map[string]any{"status": 429, "code": "RATE_LIMIT", "message": "Слишком много запросов. Повторите позже"})
				return
			}
			var user identity.User
			if header := r.Header.Get("Authorization"); strings.HasPrefix(header, "Bearer ") {
				var err error
				user, err = options.Identity.Authenticate(ctx, strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
				if err != nil {
					writeIdentityError(w, err, true)
					return
				}
			}
			meta := identity.Metadata{UserAgent: r.Header.Get("User-Agent"), IP: ip}
			audit := func(action string, operationError error) {
				auditCtx, auditCancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer auditCancel()
				if err := options.Identity.RecordAuthAudit(auditCtx, action, r.URL.Path, w.Header().Get("X-Request-Id"), ip, user, operationError); err != nil {
					slog.Error("auth audit write failed", "action", action, "requestId", w.Header().Get("X-Request-Id"))
				}
			}
			if path == "/auth/sessions/logout-all" {
				if user.ID == "" {
					writeIdentityError(w, identity.InvalidAccess, true)
					return
				}
				err := options.Identity.LogoutAll(ctx, user.ID)
				audit("logoutEverywhere", err)
				if err != nil {
					writeIdentityError(w, err, false)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if path == "/auth/login" || path == "/auth/sessions" {
				var request struct {
					Email    string `json:"email"`
					Password string `json:"password"`
				}
				if !decodeRequest(w, r, &request) {
					return
				}
				var messages []string
				if strings.TrimSpace(request.Email) == "" {
					messages = append(messages, "Email обязателен для заполнения")
				} else if address, err := mail.ParseAddress(request.Email); err != nil || address.Address != request.Email {
					messages = append(messages, "Некорректный формат email адреса")
				}
				if utf8.RuneCountInString(request.Email) > 255 {
					messages = append(messages, "Email не должен превышать 255 символов")
				}
				if strings.TrimSpace(request.Password) == "" {
					messages = append(messages, "Пароль обязателен для заполнения")
				}
				if len(messages) > 0 {
					writeIdentityError(w, &identity.Failure{Status: 400, Code: "VAL_001", Message: strings.Join(messages, ", ")}, false)
					return
				}
				result, err := options.Identity.Login(ctx, request.Email, request.Password, meta, path == "/auth/sessions")
				action := "login"
				if path == "/auth/sessions" {
					action = "createSession"
				}
				audit(action, err)
				if err != nil {
					writeIdentityError(w, err, false)
					return
				}
				writeJSON(w, 200, result)
				return
			}
			var request struct {
				RefreshToken string `json:"refreshToken"`
			}
			if !decodeRequest(w, r, &request) {
				return
			}
			if strings.TrimSpace(request.RefreshToken) == "" {
				writeIdentityError(w, &identity.Failure{Status: 400, Code: "VAL_001", Message: "must not be blank"}, false)
				return
			}
			if path == "/auth/sessions/logout" {
				err := options.Identity.Logout(ctx, request.RefreshToken)
				audit("logout", err)
				if err != nil {
					writeIdentityError(w, err, false)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			response, err := options.Identity.Refresh(ctx, request.RefreshToken, meta)
			audit("refresh", err)
			if err != nil {
				writeIdentityError(w, err, false)
				return
			}
			writeJSON(w, 200, response)
		})
	}
}

func decodeRequest(w http.ResponseWriter, r *http.Request, target any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || (mediaType != "application/json" && !(strings.HasPrefix(mediaType, "application/") && strings.HasSuffix(mediaType, "+json"))) {
		writeIdentityError(w, &identity.Failure{Status: 415, Code: "HTTP_415", Message: "Требуется application/json"}, false)
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(target); err != nil {
		writeDecodeError(w, err)
		return false
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeDecodeError(w, err)
		return false
	}
	return true
}

func writeDecodeError(w http.ResponseWriter, err error) {
	status := 400
	code := "VAL_001"
	message := "Некорректный JSON запроса"
	var limit *http.MaxBytesError
	if errors.As(err, &limit) {
		status = 413
		code = "HTTP_413"
		message = "Превышен размер запроса"
	}
	writeIdentityError(w, &identity.Failure{Status: status, Code: code, Message: message}, false)
}

func writeIdentityError(w http.ResponseWriter, err error, filter bool) {
	failure := &identity.Failure{Status: 500, Code: "SYS_500", Message: "Произошла внутренняя ошибка сервера. Обратитесь к администратору."}
	var domain *identity.Failure
	if errors.As(err, &domain) {
		failure = domain
	}
	if filter && failure.Status == 401 {
		writeJSON(w, failure.Status, map[string]any{"status": failure.Status, "code": failure.Code, "message": failure.Message})
		return
	}
	writeJSON(w, failure.Status, map[string]any{"timestamp": time.Now().UTC().Format("2006-01-02T15:04:05.999999999"), "status": failure.Status, "errorCode": failure.Code, "message": failure.Message})
}

func clientIP(r *http.Request, trusted []netip.Prefix) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	peer = peer.Unmap()
	isTrusted := func(addr netip.Addr) bool {
		for _, prefix := range trusted {
			if prefix.Contains(addr) {
				return true
			}
		}
		return false
	}
	if !isTrusted(peer) {
		return peer.String()
	}
	// Walk from our trusted peer toward the client, stopping at the first
	// untrusted hop; an arbitrary leftmost X-Forwarded-For value is not trusted.
	parts := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(parts) - 1; i >= 0; i-- {
		addr, err := netip.ParseAddr(strings.TrimSpace(parts[i]))
		if err != nil {
			return peer.String()
		}
		peer = addr.Unmap()
		if !isTrusted(peer) {
			break
		}
	}
	return peer.String()
}

func cors(next http.Handler, origins []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		requestID := r.Header.Get("X-Request-Id")
		if strings.TrimSpace(requestID) == "" || len(requestID) > 100 {
			requestID = rand.Text()
		}
		w.Header().Set("X-Request-Id", requestID)
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Add("Vary", "Origin")
			allowed := false
			for _, candidate := range origins {
				if candidate == origin {
					allowed = true
					break
				}
			}
			if !allowed {
				writeIdentityError(w, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Origin запрещён"}, false)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Expose-Headers", "Authorization")
		}
		if r.Method == http.MethodOptions {
			w.Header().Add("Vary", "Access-Control-Request-Method")
			w.Header().Add("Vary", "Access-Control-Request-Headers")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", r.Header.Get("Access-Control-Request-Headers"))
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
