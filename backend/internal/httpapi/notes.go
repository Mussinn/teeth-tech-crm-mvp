package httpapi

import (
	"net/http"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/notes"
	"teethtech.local/crm/internal/pagination"
)

func registerNotes(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "GET", "/personal-notes", "PersonalNoteController.mine", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Notes.Mine(r.Context(), actor.ID, r.URL.Query().Get("q"), pagination.Parse(r.URL.Query(), 20, ""))
		return v, 200, e
	})
	for _, method := range []string{"POST", "PUT", "DELETE"} {
		path, action, status := "/personal-notes", "create", 201
		if method == "PUT" {
			path += "/{id}"
			action, status = "update", 200
		}
		if method == "DELETE" {
			path += "/{id}"
			action, status = "delete", 204
		}
		domainRoute(mux, o, method, path, "PersonalNoteController."+action, nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request notes.Request
			if method != "DELETE" && !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			v, e := o.Notes.Write(r.Context(), actor.ID, r.PathValue("id"), method, request)
			return v, status, e
		})
	}
}
