package httpapi

import (
	"net/http"

	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/workflow"
)

func registerSLA(mux *http.ServeMux, o Options) {
	roles := []string{"ADMIN", "CHIEF_TECHNICIAN"}
	domainRoute(mux, o, "GET", "/admin/sla-rules", "SlaAdminController.all", roles, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, e := o.Workflow.SLARules(r.Context())
		return v, 200, e
	})
	for _, method := range []string{"POST", "PUT"} {
		path, action := "/admin/sla-rules", "save"
		if method == "PUT" {
			path += "/{id}"
			action = "update"
		}
		domainRoute(mux, o, method, path, "SlaAdminController."+action, roles, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			var request workflow.SLARule
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			for _, id := range []*string{request.ID, request.WorkTypeID, request.StatusID} {
				if id != nil && !uuidPattern.MatchString(*id) {
					return nil, 200, validation("Некорректный UUID")
				}
			}
			v, e := o.Workflow.SaveSLARule(r.Context(), r.PathValue("id"), request)
			return v, 200, e
		})
	}
}
