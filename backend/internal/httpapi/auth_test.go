package httpapi

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestClientIPDoesNotTrustSpoofedForwardingHeaders(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "192.0.2.4:2345"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := clientIP(r, nil); got != "192.0.2.4" {
		t.Fatalf("spoofed IP: %s", got)
	}
	trusted := []netip.Prefix{netip.MustParsePrefix("192.0.2.0/24")}
	r.Header.Set("X-Forwarded-For", "1.2.3.4, 198.51.100.8, 192.0.2.5")
	if got := clientIP(r, trusted); got != "198.51.100.8" {
		t.Fatalf("trusted chain: %s", got)
	}
}

func TestConcurrentRateLimit(t *testing.T) {
	l := &limiter{limit: 5}
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for range 30 {
		wg.Go(func() {
			if l.allow("192.0.2.1") {
				accepted.Add(1)
			}
		})
	}
	wg.Wait()
	if accepted.Load() != 5 {
		t.Fatalf("accepted %d", accepted.Load())
	}
}

func TestCorsAndJSONBoundary(t *testing.T) {
	handler := New(Options{AllowedOrigins: []string{"http://localhost:3000"}})
	for _, tc := range []struct {
		origin string
		status int
	}{{"http://localhost:3000", 200}, {"https://untrusted.invalid", 403}} {
		r := httptest.NewRequest(http.MethodOptions, Prefix+"/auth/sessions", nil)
		r.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("CORS: %d", w.Code)
		}
		if tc.status == 200 && w.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Fatal("missing credential policy")
		}
	}
	for _, tc := range []struct {
		body, media string
		status      int
	}{
		{`{"email":"x"} {"email":"y"}`, "application/json", 400},
		{`{`, "application/json", 400}, {`{}`, "text/plain", 415},
		{`{"email":"` + strings.Repeat("x", 1<<20) + `"}`, "application/json", 413},
	} {
		r := httptest.NewRequest("POST", "/", strings.NewReader(tc.body))
		r.Header.Set("Content-Type", tc.media)
		w := httptest.NewRecorder()
		var request struct{ Email string }
		if decodeRequest(w, r, &request) || w.Code != tc.status {
			t.Fatalf("unexpected decode result %d", w.Code)
		}
	}
}
