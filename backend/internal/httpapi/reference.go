package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"teethtech.local/crm/internal/catalog"
	"teethtech.local/crm/internal/clinic"
	"teethtech.local/crm/internal/identity"
)

type domainHandler func(http.ResponseWriter, *http.Request, identity.User) (any, int, error)

func domainRoute(mux *http.ServeMux, o Options, method, path, action string, roles []string, fn domainHandler) {
	mux.HandleFunc(method+" "+Prefix+path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		timeout := 15 * time.Second
		if strings.HasPrefix(action, "Files.") {
			timeout = 5 * time.Minute
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		r = r.WithContext(ctx)
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeIdentityError(w, identity.InvalidAccess, true)
			return
		}
		actor, err := o.Identity.Authenticate(ctx, strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
		if err != nil {
			writeIdentityError(w, err, true)
			return
		}
		if len(roles) > 0 && !hasRole(actor, roles...) {
			writeIdentityError(w, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}, false)
			return
		}
		id := r.PathValue("id")
		if id != "" && !uuidPattern.MatchString(id) {
			writeIdentityError(w, validation("Некорректный UUID"), false)
			return
		}
		result, status, err := fn(w, r, actor)
		if status == 0 && action != "Files.download" {
			return
		}
		if method != "GET" || action == "Files.download" || action == "Files.url" || action == "ClinicUserCardController.getHistory" {
			auditCtx, auditCancel := context.WithTimeout(context.Background(), 2*time.Second)
			auditErr := o.Identity.RecordIdentityAudit(auditCtx, action, method, r.URL.Path, id, w.Header().Get("X-Request-Id"), clientIP(r, o.TrustedProxies), actor, err)
			auditCancel()
			if auditErr != nil {
				slog.Error("domain audit failed", "action", action)
			}
		}
		if status == 0 {
			return
		}
		if err != nil {
			writeIdentityError(w, err, false)
			return
		}
		if status == 204 {
			w.WriteHeader(status)
		} else {
			writeJSON(w, status, result)
		}
	})
}
func queryBool(r *http.Request, key string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(r.URL.Query().Get(key))) {
	case "", "false", "off", "no", "0":
		return false, nil
	case "true", "on", "yes", "1":
		return true, nil
	default:
		return false, validation("Некорректный логический параметр: " + key)
	}
}
func registerCatalog(mux *http.ServeMux, o Options) {
	for _, kind := range []string{"colors", "work-types", "work-directions", "materials", "implants", "model-systems", "tooth-sets", "shade-systems"} {
		controller := map[string]string{"colors": "ColorController", "work-types": "WorkTypeController", "work-directions": "WorkDirectionController", "materials": "MaterialController"}[kind]
		if controller == "" {
			controller = "TechnicalCatalog"
		}
		listAction := "getAll"
		if kind == "work-directions" {
			listAction = "findAll"
		}
		domainRoute(mux, o, "GET", "/"+kind, controller+"."+listAction, nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			key := "activeOnly"
			if kind == "work-directions" {
				key = "includeInactive"
			}
			active, err := queryBool(r, key)
			if err != nil {
				return nil, 200, err
			}
			if kind == "work-directions" {
				active = !active
			}
			if kind == "materials" {
				v, e := o.Catalog.Materials(r.Context(), active)
				return v, 200, e
			}
			v, e := o.Catalog.List(r.Context(), kind, active)
			return v, 200, e
		})
		for _, method := range []string{"POST", "PUT", "DELETE"} {
			if kind == "work-directions" && method == "DELETE" {
				continue
			}
			verb, path, action, status := method, "/"+kind, "create", 201
			if method != "POST" {
				path += "/{id}"
				action = "update"
				status = 200
			}
			if method == "DELETE" {
				action = "deleteById"
				status = 204
				if kind == "materials" {
					action = "delete"
				}
			}
			if kind == "work-directions" && method == "PUT" {
				verb = "PATCH"
			}
			domainRoute(mux, o, verb, path, controller+"."+action, []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
				id := r.PathValue("id")
				if kind == "materials" {
					var request catalog.Material
					if method != "DELETE" && !decodeRequest(w, r, &request) {
						return nil, 0, nil
					}
					v, e := o.Catalog.SaveMaterial(r.Context(), id, request, method == "DELETE")
					return v, status, e
				}
				if method == "DELETE" {
					return nil, status, o.Catalog.Delete(r.Context(), kind, id)
				}
				var request catalog.Entry
				if !decodeRequest(w, r, &request) {
					return nil, 0, nil
				}
				v, e := o.Catalog.Save(r.Context(), kind, id, request)
				return v, status, e
			})
		}
	}
	domainRoute(mux, o, "GET", "/materials/{id}", "MaterialController.getById", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, e := o.Catalog.Material(r.Context(), r.PathValue("id"))
		return v, 200, e
	})
}

var clinicPhone = regexp.MustCompile(`^$|^(?:\+?7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}$`)
var clinicBin = regexp.MustCompile(`^$|^\d{12}$`)

func validateClinic(r clinic.Request, create bool) error {
	if strings.TrimSpace(r.Name) == "" || utf8.RuneCountInString(r.Name) > 255 {
		return validation("Название клиники обязательно и не должно превышать 255 символов")
	}
	for _, field := range []struct {
		v   *string
		max int
	}{{r.ContactPerson, 255}, {r.Email, 255}, {r.Phone, 50}, {r.Bin, 50}} {
		if field.v != nil && utf8.RuneCountInString(*field.v) > field.max {
			return validation("Значение поля слишком длинное")
		}
	}
	if create {
		if r.Phone != nil && !clinicPhone.MatchString(*r.Phone) {
			return validation("Неверный формат номера телефона")
		}
		if r.Bin != nil && !clinicBin.MatchString(*r.Bin) {
			return validation("БИН должен состоять ровно из 12 цифр")
		}
		if r.Email != nil && *r.Email != "" && !validEmail(*r.Email) {
			return validation("Некорректный формат email адреса")
		}
		if r.Address != nil && utf8.RuneCountInString(*r.Address) > 500 {
			return validation("Адрес не должен превышать 500 символов")
		}
	}
	return nil
}
func registerClinics(mux *http.ServeMux, o Options) {
	staff := []string{"ADMIN", "DISPATCHER"}
	domainRoute(mux, o, "POST", "/clinics", "ClinicController.createClinic", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request clinic.Request
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		if err := validateClinic(request, true); err != nil {
			return nil, 201, err
		}
		v, e := o.Clinics.Create(r.Context(), request)
		return v, 201, e
	})
	domainRoute(mux, o, "PATCH", "/clinics/{id}", "ClinicController.updateClinic", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request clinic.Request
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		if err := validateClinic(request, false); err != nil {
			return nil, 200, err
		}
		v, e := o.Clinics.Update(r.Context(), r.PathValue("id"), request)
		return v, 200, e
	})
	domainRoute(mux, o, "GET", "/clinics", "ClinicController.getAllClinic", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, e := o.Clinics.List(r.Context(), clinic.ParsePage(r.URL.Query(), 10, "name,ASC"), nil)
		return v, 200, e
	})
	domainRoute(mux, o, "GET", "/clinics/search", "ClinicController.search", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		name := r.URL.Query().Get("name")
		v, e := o.Clinics.List(r.Context(), clinic.ParsePage(r.URL.Query(), 10, ""), &name)
		return v, 200, e
	})
	domainRoute(mux, o, "GET", "/clinics/{id}", "ClinicController.getDetails", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, e := o.Clinics.Details(r.Context(), r.PathValue("id"))
		return v, 200, e
	})
	for _, kind := range []string{"doctors", "patients", "orders"} {
		action := map[string]string{"doctors": "getDoctors", "patients": "getPatients", "orders": "getOrders"}[kind]
		domainRoute(mux, o, "GET", "/clinics/{id}/"+kind, "ClinicController."+action, staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			sort := "fullName,ASC"
			if kind == "orders" {
				sort = "createdAt,DESC"
			}
			v, e := o.Clinics.Related(r.Context(), r.PathValue("id"), kind, clinic.ParsePage(r.URL.Query(), 10, sort))
			return v, 200, e
		})
	}
	for _, card := range []bool{false, true} {
		path, controller := "/clinics/{id}", "ClinicController"
		if card {
			path, controller = "/patientCard/{id}", "ClinicUserCardController"
		}
		domainRoute(mux, o, "DELETE", path, controller+".deleteById", []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			return nil, 204, o.Clinics.Delete(r.Context(), r.PathValue("id"), card)
		})
	}
	domainRoute(mux, o, "GET", "/patientCard/{id}/history", "ClinicUserCardController.getHistory", staff, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Clinics.History(r.Context(), strings.ToLower(r.PathValue("id")), actor.ID, !hasRole(actor, "ADMIN"), clinic.ParsePage(r.URL.Query(), 20, ""))
		return v, 200, e
	})
}
