//go:build mvp

package integration_test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"teethtech.local/crm/internal/saas"
	"testing"
	"time"
)

func TestSaaSPilot(t *testing.T) {
	ctx := t.Context()
	pool, e := pgxpool.New(ctx, os.Getenv("MVP_TEST_DATABASE_URL"))
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	var db string
	if e = pool.QueryRow(ctx, `SELECT current_database()`).Scan(&db); e != nil || db != "teethtech_mvp_go_test" {
		t.Fatal("refusing non-test database")
	}
	defer pool.Exec(ctx, `DROP TABLE IF EXISTS saas_owner_mfa,saas_support_files,saas_support_messages,saas_support_tickets,saas_community_reports,saas_community_comments,saas_community_posts,saas_community_profiles,saas_events,saas_jobs,saas_labs,saas_sessions,saas_owner,saas_worker CASCADE`)
	s, e := saas.New(ctx, pool, saas.Config{PublicURL: "http://localhost:18099", BaseDomain: "localhost", OwnerEmail: "owner@example.test", OwnerPassword: "OwnerTestPassword2026", WorkerSecret: strings.Repeat("x", 40), PortBase: 24000})
	if e != nil {
		t.Fatal(e)
	}
	var cookie *http.Cookie
	call := func(method, path string, data any, owner, worker bool) (int, map[string]any) {
		t.Helper()
		raw, _ := json.Marshal(data)
		r := httptest.NewRequest(method, "http://localhost:18099"+path, bytes.NewReader(raw))
		r.Header.Set("Origin", "http://localhost:18099")
		r.RemoteAddr = "127.0.0.1:5000"
		if owner && cookie != nil {
			r.AddCookie(cookie)
		}
		if worker {
			r.Header.Set("Authorization", "Bearer "+strings.Repeat("x", 40))
		}
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		out := map[string]any{}
		json.Unmarshal(w.Body.Bytes(), &out)
		if path == "/api/login" && w.Code == 200 {
			cookie = w.Result().Cookies()[0]
		}
		return w.Code, out
	}
	expect := func(code, want int) {
		t.Helper()
		if code != want {
			t.Fatalf("status %d, want %d", code, want)
		}
	}
	code, _ := call("GET", "/api/owner/labs", nil, false, false)
	expect(code, 401)
	code, _ = call("POST", "/api/login", map[string]string{"email": "owner@example.test", "password": "OwnerTestPassword2026"}, false, false)
	expect(code, 200)
	t.Run("security boundaries", func(t *testing.T) {
		cases := []struct {
			name, method, path, body, origin, remote, forwarded string
			want                                                int
		}{
			{"missing origin", "POST", "/api/owner/invitations", `{}`, "", "127.0.0.1:5000", "", 403},
			{"foreign origin", "POST", "/api/owner/invitations", `{}`, "https://evil.test", "127.0.0.1:5000", "", 403},
			{"unknown JSON field", "POST", "/api/owner/invitations", `{"admin":true}`, "http://localhost:18099", "127.0.0.1:5000", "", 400},
			{"oversized JSON", "POST", "/api/owner/invitations", `{"name":"` + strings.Repeat("x", 20000) + `"}`, "http://localhost:18099", "127.0.0.1:5000", "", 400},
			{"public worker with valid secret", "POST", "/internal/jobs/claim", `{}`, "", "203.0.113.10:5000", "", 403},
			{"proxied worker with valid secret", "POST", "/internal/jobs/claim", `{}`, "", "127.0.0.1:5000", "203.0.113.10", 403},
			{"untrusted host", "GET", "/api/owner/labs", ``, "", "127.0.0.1:5000", "", 404},
		}
		for _, c := range cases {
			t.Run(c.name, func(t *testing.T) {
				r := httptest.NewRequest(c.method, "http://localhost:18099"+c.path, strings.NewReader(c.body))
				r.RemoteAddr = c.remote
				r.Header.Set("Origin", c.origin)
				r.Header.Set("X-Forwarded-For", c.forwarded)
				r.Header.Set("Authorization", "Bearer "+strings.Repeat("x", 40))
				r.AddCookie(cookie)
				if c.name == "untrusted host" {
					r.Host = "evil.test"
				}
				w := httptest.NewRecorder()
				s.ServeHTTP(w, r)
				if w.Code != c.want {
					t.Fatalf("status %d, want %d", w.Code, c.want)
				}
				if w.Header().Get("X-Content-Type-Options") != "nosniff" || w.Header().Get("X-Frame-Options") != "DENY" {
					t.Fatal("security headers missing")
				}
			})
		}
		secure, err := saas.New(ctx, pool, saas.Config{PublicURL: "https://crm.example.test", BaseDomain: "example.test", OwnerEmail: "owner@example.test", OwnerPassword: "OwnerTestPassword2026", WorkerSecret: strings.Repeat("x", 40), PortBase: 24000})
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest("POST", "https://crm.example.test/api/login", strings.NewReader(`{"email":"owner@example.test","password":"OwnerTestPassword2026"}`))
		r.Header.Set("Origin", "https://crm.example.test")
		w := httptest.NewRecorder()
		secure.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatal("HTTPS login failed")
		}
		c := w.Result().Cookies()[0]
		if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteStrictMode || c.Domain != "" {
			t.Fatal("insecure owner cookie")
		}
		if w.Header().Get("Strict-Transport-Security") == "" {
			t.Fatal("HTTPS HSTS missing")
		}
	})
	tokens := []string{}
	for i := 1; i <= 3; i++ {
		code, out := call("POST", "/api/owner/invitations", map[string]any{"name": "Pilot test", "email": "chief@example.test", "days": 30}, true, false)
		expect(code, 201)
		tokens = append(tokens, strings.Split(out["inviteUrl"].(string), "#")[1])
	}
	code, _ = call("POST", "/api/owner/invitations", map[string]any{"name": "Fourth", "email": "chief@example.test", "days": 30}, true, false)
	expect(code, 409)
	register := map[string]string{"name": "Chief technician", "email": "chief@example.test", "password": "ChiefTestPassword2026"}
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for n := 0; n < 2; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := call("POST", "/api/invitations/"+tokens[0]+"/register", register, false, false)
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	seen := map[int]int{}
	for c := range codes {
		seen[c]++
	}
	if seen[202] != 1 || seen[409] != 1 {
		t.Fatal("invitation consumed more than once", seen)
	}
	code, _ = call("POST", "/internal/jobs/claim", nil, false, false)
	expect(code, 403)
	code, job := call("POST", "/internal/jobs/claim", nil, false, true)
	expect(code, 200)
	if job["action"] != "CREATE" || job["port"] != float64(24001) || len(job["adminHash"].(string)) != 60 {
		t.Fatal("invalid provisioning payload")
	}
	code, _ = call("POST", "/internal/jobs/claim", nil, false, true)
	expect(code, 204)
	id := "1"
	code, _ = call("POST", "/internal/jobs/"+id+"/complete", map[string]any{"lease": "wrong", "success": true}, false, true)
	expect(code, 409)
	code, _ = call("POST", "/internal/jobs/"+id+"/complete", map[string]any{"lease": job["lease"], "success": true}, false, true)
	expect(code, 200)
	code, out := call("GET", "/api/owner/labs", nil, true, false)
	expect(code, 200)
	if bytes.Contains(mustJSON(out), []byte("adminHash")) || bytes.Contains(mustJSON(out), []byte(tokens[0])) {
		t.Fatal("owner response leaks setup secrets")
	}
	exercisePlatform(t, pool, s, cookie)
	code, _ = call("POST", "/api/owner/labs/1/suspend", map[string]any{}, true, false)
	expect(code, 200)
	code, job = call("POST", "/internal/jobs/claim", nil, false, true)
	expect(code, 200)
	if job["action"] != "STOP" {
		t.Fatal(job)
	}
	code, _ = call("POST", "/internal/jobs/2/complete", map[string]any{"lease": job["lease"], "success": true}, false, true)
	expect(code, 200)
	code, _ = call("POST", "/api/owner/labs/1/extend", map[string]any{"days": 30}, true, false)
	expect(code, 200)
	code, _ = call("POST", "/api/owner/labs/1/resume", map[string]any{}, true, false)
	expect(code, 200)
	code, job = call("POST", "/internal/jobs/claim", nil, false, true)
	expect(code, 200)
	code, _ = call("POST", "/internal/jobs/3/complete", map[string]any{"lease": job["lease"], "success": true}, false, true)
	expect(code, 200)
	_, e = pool.Exec(ctx, `UPDATE saas_labs SET trial_ends_at=now()-interval '1 minute' WHERE slot=1`)
	if e != nil {
		t.Fatal(e)
	}
	req := httptest.NewRequest("GET", "http://lab1.localhost:18099/api/owner/labs", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	s.ServeHTTP(rec, req)
	expect(rec.Code, 503)
	code, job = call("POST", "/internal/jobs/claim", nil, false, true)
	expect(code, 200)
	if job["action"] != "STOP" {
		t.Fatal("expired trial wasn't stopped")
	}
	code, _ = call("POST", "/api/owner/labs/2/revoke", map[string]any{}, true, false)
	expect(code, 200)
	code, _ = call("POST", "/api/invitations/"+tokens[1]+"/register", register, false, false)
	expect(code, 409)
	code, renew := call("POST", "/api/owner/labs/2/renew-invite", map[string]any{}, true, false)
	expect(code, 200)
	if renew["inviteUrl"] == "http://localhost:18099/invite.html#"+tokens[1] {
		t.Fatal("renewed token unchanged")
	}
	code, _ = call("GET", "/api/invitations/"+tokens[1], nil, false, false)
	expect(code, 404)
	r := httptest.NewRequest("POST", "http://localhost:18099/api/owner/labs/1/extend", bytes.NewBufferString(`{"days":30}`))
	r.AddCookie(cookie)
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	expect(w.Code, 403)

	code, setupMFA := call("POST", "/api/owner/mfa/begin", map[string]string{"password": "OwnerTestPassword2026"}, true, false)
	expect(code, 200)
	otpSecret := setupMFA["secret"].(string)
	otpCode := integrationOTP(otpSecret, time.Now())
	code, _ = call("POST", "/api/owner/mfa/confirm", map[string]string{"password": "OwnerTestPassword2026", "code": otpCode}, true, false)
	expect(code, 200)
	code, _ = call("POST", "/api/login", map[string]string{"email": "owner@example.test", "password": "OwnerTestPassword2026"}, false, false)
	expect(code, 401)
	code, _ = call("POST", "/api/login", map[string]string{"email": "owner@example.test", "password": "OwnerTestPassword2026", "code": otpCode}, false, false)
	expect(code, 401)
	code, _ = call("POST", "/api/login", map[string]string{"email": "owner@example.test", "password": "OwnerTestPassword2026", "code": integrationOTP(otpSecret, time.Now().Add(30*time.Second))}, false, false)
	expect(code, 200)
	code, _ = call("POST", "/api/logout", map[string]any{}, true, false)
	expect(code, 200)
	code, _ = call("GET", "/api/owner/labs", nil, true, false)
	expect(code, 401)
	for i := 0; i < 7; i++ {
		code, _ = call("POST", "/api/login", map[string]string{"email": "owner@example.test", "password": "incorrect"}, false, false)
	}
	expect(code, 429)
}
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }

func integrationOTP(secret string, now time.Time) string {
	key, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(now.Unix()/30))
	m := hmac.New(sha1.New, key)
	m.Write(b[:])
	sum := m.Sum(nil)
	n := sum[len(sum)-1] & 15
	return fmt.Sprintf("%06d", (binary.BigEndian.Uint32(sum[n:n+4])&0x7fffffff)%1000000)
}
