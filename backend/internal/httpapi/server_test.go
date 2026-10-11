package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthCannotAdvertiseUnimplementedBackendAsReady(t *testing.T) {
	handler := New()
	for _, tc := range []struct {
		path   string
		code   int
		status string
	}{
		{"/actuator/health/liveness", http.StatusOK, "UP"},
		{"/actuator/health/readiness", http.StatusServiceUnavailable, "DOWN"},
		{"/actuator/health", http.StatusServiceUnavailable, "DOWN"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			r := httptest.NewRecorder()
			handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, Prefix+tc.path, nil))
			var body struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if r.Code != tc.code || body.Status != tc.status {
				t.Fatalf("%d %s", r.Code, r.Body.String())
			}
			if r.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("health must not be cached")
			}
		})
	}
}

func TestUnportedRoutesDoNotReturnSuccessfulPlaceholders(t *testing.T) {
	for _, path := range []string{"/api/v1/orders", "/api/v1/auth/sessions", "/actuator/health"} {
		r := httptest.NewRecorder()
		New().ServeHTTP(r, httptest.NewRequest(http.MethodGet, path, nil))
		if r.Code != http.StatusNotFound {
			t.Fatalf("%s: %d", path, r.Code)
		}
	}
}
