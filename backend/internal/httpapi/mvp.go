package httpapi

import (
	"net/http"
	"strconv"
	"teethtech.local/crm/internal/identity"
)

func registerMVP(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "GET", "/auth/current", "Auth.current", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) { return a, 200, nil })
	domainRoute(mux, o, "GET", "/tasks/dashboard", "Tasks.dashboard", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		q := r.URL.Query()
		status := q.Get("statusId")
		if status != "" && !uuidPattern.MatchString(status) {
			return nil, 200, validation("Некорректный статус")
		}
		v, e := o.Orders.Dashboard(r.Context(), a, q.Get("search"), q.Get("workTypeCode"), status)
		return v, 200, e
	})

	domainRoute(mux, o, "GET", "/orders/{id}", "OrderController.get", []string{"ADMIN", "DISPATCHER", "CHIEF_TECHNICIAN"}, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Orders.ReadOrder(r.Context(), r.PathValue("id"), a)
		return v, 200, e
	})
	for _, path := range []string{"/kpi", "/kpi/my"} {
		roles := []string{"ADMIN", "CHIEF_TECHNICIAN"}
		if path == "/kpi/my" {
			roles = nil
		}
		domainRoute(mux, o, "GET", path, "KpiController.report", roles, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
			q := r.URL.Query()
			employee := q.Get("employeeId")
			if path == "/kpi/my" {
				employee = a.ID
			}
			if employee != "" && !uuidPattern.MatchString(employee) {
				return nil, 200, validation("Некорректный employeeId")
			}
			page, size := 0, 50
			var e error
			if q.Has("page") {
				page, e = strconv.Atoi(q.Get("page"))
				if e != nil {
					return nil, 200, validation("Некорректная страница")
				}
			}
			if q.Has("size") {
				size, e = strconv.Atoi(q.Get("size"))
				if e != nil {
					return nil, 200, validation("Некорректный размер страницы")
				}
			}
			v, e := o.KPI.Report(r.Context(), q.Get("from"), q.Get("to"), employee, page, size)
			return v, 200, e
		})
	}
}
