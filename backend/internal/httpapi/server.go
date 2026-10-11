package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

const Prefix = "/api/v1"

// New registers the migrated modules supplied through Options. Global readiness
// stays DOWN until all required modules and dependencies can replace Java.
func New(settings ...Options) http.Handler {
	options := Options{}
	if len(settings) > 0 {
		options = settings[0]
	}
	mux := http.NewServeMux()
	if options.Identity != nil {
		registerAuth(mux, options)
		if options.KPI != nil {
			registerMVP(mux, options)
		}
		if options.Files != nil {
			registerFiles(mux, options)
		}
		registerIdentity(mux, options)
		if options.Stock != nil {
			registerStock(mux, options)
		}
		if options.Admin != nil {
			registerAdminOps(mux, options)
		}
		if options.Notifications != nil {
			registerNotifications(mux, options)
		}
		if options.Notes != nil {
			registerNotes(mux, options)
		}
		if options.Orders != nil {
			registerOrderOptions(mux, options)
			registerLaboratoryCases(mux, options)
			registerIncidents(mux, options)
		}
		if options.Workflow != nil {
			registerWorkflow(mux, options)
		}
		if options.Catalog != nil {
			registerCatalog(mux, options)
			registerNomenclature(mux, options)
		}
		if options.Clinics != nil {
			registerClinics(mux, options)
		}
	}
	mux.HandleFunc("GET "+Prefix+"/actuator/health/liveness", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, struct {
			Status string `json:"status"`
		}{"UP"})
	})
	for _, path := range []string{"/actuator/health", "/actuator/health/readiness"} {
		mux.HandleFunc("GET "+Prefix+path, func(w http.ResponseWriter, r *http.Request) {
			status, code := "DOWN", http.StatusServiceUnavailable
			if options.Ready != nil {
				ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
				defer cancel()
				if options.Ready(ctx) == nil {
					status = "UP"
					code = 200
				}
			}
			writeJSON(w, code, struct {
				Status string `json:"status"`
			}{status})
		})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, struct {
			Timestamp string `json:"timestamp"`
			Status    int    `json:"status"`
			ErrorCode string `json:"errorCode"`
			Message   string `json:"message"`
		}{time.Now().UTC().Format("2006-01-02T15:04:05.999999999"), 404, "HTTP_404", "Запрошенный ресурс не найден"})
	})
	return cors(mux, options.AllowedOrigins)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
