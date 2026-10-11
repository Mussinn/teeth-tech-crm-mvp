package httpapi

import (
	"net/http"

	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/pagination"
)

func registerAdminOps(mux *http.ServeMux, o Options) {
	for _, dead := range []bool{false, true} {
		path, action := "/admin/audit", "BusinessAuditController.getAll"
		if dead {
			path, action = "/admin/outbox/dead-letters", "OutboxAdminController.dead"
		}
		domainRoute(mux, o, "GET", path, action, []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			v, e := o.Admin.Page(r.Context(), dead, pagination.Parse(r.URL.Query(), 50, ""))
			return v, 200, e
		})
	}
	domainRoute(mux, o, "POST", "/admin/outbox/{id}/retry", "OutboxAdminController.retry", []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		return nil, 204, o.Admin.Retry(r.Context(), r.PathValue("id"))
	})
}
