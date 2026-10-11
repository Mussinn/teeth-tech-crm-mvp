package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

func registerStock(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "GET", "/stock/{id}/balance", "StockController.getBalance", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, err := o.Stock.Balance(r.Context(), r.PathValue("id"))
		return v, 200, err
	})
	domainRoute(mux, o, "GET", "/stock/overview", "StockController.getOverview", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, err := o.Stock.Overview(r.Context())
		return v, 200, err
	})
	domainRoute(mux, o, "GET", "/stock/movements/recent", "StockController.getRecentMovements", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		limit := 10
		if raw := r.URL.Query().Get("limit"); raw != "" {
			n, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 32)
			if err != nil {
				return nil, 200, dbx.Validation("Некорректный limit")
			}
			limit = int(n)
		}
		v, err := o.Stock.RecentMovements(r.Context(), limit)
		return v, 200, err
	})
}
