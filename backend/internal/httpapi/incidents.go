package httpapi

import (
	"net/http"

	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/orders"
	"teethtech.local/crm/internal/pagination"
)

func registerIncidents(mux *http.ServeMux, o Options) {
	const path = "/tasks/{taskId}/quality-incidents"
	domainRoute(mux, o, "POST", path, "QualityIncidentController.create", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		var request orders.IncidentRequest
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, e := o.Orders.CreateIncident(r.Context(), r.PathValue("taskId"), request, actor)
		return v, 200, e
	})
	domainRoute(mux, o, "GET", path, "QualityIncidentController.all", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Orders.Incidents(r.Context(), r.PathValue("taskId"), actor, pagination.Parse(r.URL.Query(), 20, ""))
		return v, 200, e
	})
	domainRoute(mux, o, "PATCH", path+"/{incidentId}/resolve", "QualityIncidentController.resolve", []string{"ADMIN", "DISPATCHER", "CHIEF_TECHNICIAN"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		var request struct {
			Comment string `json:"resolutionComment"`
		}
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, e := o.Orders.ResolveIncident(r.Context(), r.PathValue("taskId"), r.PathValue("incidentId"), request.Comment, actor)
		return v, 200, e
	})
}
