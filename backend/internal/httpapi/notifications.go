package httpapi

import (
	"net/http"

	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/notifications"
	"teethtech.local/crm/internal/pagination"
)

func registerNotifications(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "GET", "/notifications", "NotificationController.mine", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Notifications.Mine(r.Context(), actor.ID, pagination.Parse(r.URL.Query(), 30, ""))
		return v, 200, e
	})
	domainRoute(mux, o, "GET", "/notifications/unread-count", "NotificationController.unread", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Notifications.Unread(r.Context(), actor.ID)
		return v, 200, e
	})
	domainRoute(mux, o, "PATCH", "/notifications/{id}/read", "NotificationController.read", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		return nil, 204, o.Notifications.Read(r.Context(), actor.ID, r.PathValue("id"))
	})
	domainRoute(mux, o, "GET", "/notifications/preferences", "NotificationController.preference", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Notifications.Preference(r.Context(), actor.ID)
		return v, 200, e
	})
	domainRoute(mux, o, "PUT", "/notifications/preferences", "NotificationController.preference", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		var p notifications.Preference
		if !decodeRequest(w, r, &p) {
			return nil, 0, nil
		}
		v, e := o.Notifications.SavePreference(r.Context(), actor.ID, p)
		return v, 200, e
	})
}
