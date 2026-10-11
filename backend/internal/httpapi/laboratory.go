package httpapi

import (
	"net/http"
	"strconv"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/orders"
)

func registerLaboratoryCases(mux *http.ServeMux, o Options) {
	roles := []string{"ADMIN", "DISPATCHER", "CHIEF_TECHNICIAN"}
	domainRoute(mux, o, "GET", "/laboratory/cases", "Laboratory.queue", roles, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		v, e := o.Orders.LaboratoryQueue(r.Context(), a, orders.QueueOptions{Offset: offset, Limit: limit, Search: r.URL.Query().Get("search"), Phase: r.URL.Query().Get("phase")})
		return v, 200, e
	})
	domainRoute(mux, o, "GET", "/orders/{id}/laboratory", "Laboratory.read", roles, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Orders.LaboratoryCase(r.Context(), r.PathValue("id"), a)
		return v, 200, e
	})
	domainRoute(mux, o, "POST", "/orders/{id}/laboratory/actions", "Laboratory.action", roles, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		var q orders.LabAction
		if !decodeRequest(w, r, &q) {
			return nil, 0, nil
		}
		v, e := o.Orders.LaboratoryAction(r.Context(), r.PathValue("id"), q, a)
		return v, 200, e
	})
}
