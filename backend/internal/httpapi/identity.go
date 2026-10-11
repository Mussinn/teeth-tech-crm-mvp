package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"teethtech.local/crm/internal/identity"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var phonePattern = regexp.MustCompile(`^(\+7|8)?\s?\(?7\d{2}\)?\s?\d{3}\s?\d{2}\s?\d{2}$`)

func hasRole(user identity.User, roles ...string) bool {
	for _, actual := range user.Roles {
		for _, role := range roles {
			if strings.TrimPrefix(actual, "ROLE_") == role {
				return true
			}
		}
	}
	return false
}
func validation(message string) error {
	return &identity.Failure{Status: 400, Code: "VAL_001", Message: message}
}
func validEmail(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && address.Address == value && utf8.RuneCountInString(value) <= 255
}
func directionsValid(ids []string) bool {
	for _, id := range ids {
		if !uuidPattern.MatchString(id) {
			return false
		}
	}
	return true
}
func validateCreate(r identity.CreateEmployee) error {
	if strings.TrimSpace(r.FullName) == "" || utf8.RuneCountInString(r.FullName) > 255 {
		return validation("Имя сотрудника обязательно и не должно превышать 255 символов")
	}
	if !validEmail(r.Email) {
		return validation("Неверный формат электронной почты")
	}
	if !phonePattern.MatchString(r.Phone) {
		return validation("Неверный формат номера телефона")
	}
	if strings.TrimSpace(r.Role) == "" {
		return validation("Необходимо выбрать роль сотрудника")
	}
	if strings.TrimSpace(r.Password) == "" || len([]byte(r.Password)) > 72 {
		return validation("Пароль обязателен и должен занимать не более 72 байт UTF-8")
	}
	if !directionsValid(r.Directions) {
		return validation("Некорректный идентификатор направления")
	}
	return nil
}

func registerIdentity(mux *http.ServeMux, options Options) {
	type endpoint struct {
		method, path, action string
		roles                []string
		self                 bool
	}
	for _, ep := range []endpoint{
		{"GET", "/users", "UserController.getAllEmployee", nil, false},
		{"POST", "/users", "UserController.createEmployee", []string{"ADMIN", "DISPATCHER"}, false},
		{"POST", "/users/batch", "UserController.createEmployeesBatch", []string{"ADMIN"}, false},
		{"PATCH", "/users/{id}", "UserController.updateUser", []string{"ADMIN"}, true},
		{"POST", "/users/{id}/change-password", "UserController.changePassword", []string{"ADMIN"}, true},
		{"PATCH", "/users/{id}/admin-setup", "UserController.adminUpdateUser", []string{"ADMIN"}, false},
		{"PATCH", "/users/{id}/status", "UserController.updateStatus", []string{"ADMIN"}, false},
		{"DELETE", "/users/{id}", "UserController.deleteById", []string{"ADMIN"}, false},
		{"GET", "/roles", "RoleController.getAllRoles", []string{"ADMIN", "CHIEF_TECHNICIAN"}, false},
		{"POST", "/roles", "RoleController.create", []string{"ADMIN"}, false},
		{"PATCH", "/roles/{id}", "RoleController.update", []string{"ADMIN"}, false},
		{"DELETE", "/roles/{id}", "RoleController.delete", []string{"ADMIN"}, false},
	} {
		mux.HandleFunc(ep.method+" "+Prefix+ep.path, func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				writeIdentityError(w, identity.InvalidAccess, true)
				return
			}
			actor, err := options.Identity.Authenticate(ctx, strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
			if err != nil {
				writeIdentityError(w, err, true)
				return
			}
			id := r.PathValue("id")
			if id != "" && !uuidPattern.MatchString(id) {
				writeIdentityError(w, validation("Некорректный UUID"), false)
				return
			}
			if len(ep.roles) > 0 && !hasRole(actor, ep.roles...) && !(ep.self && strings.EqualFold(actor.ID, id)) {
				writeIdentityError(w, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}, false)
				return
			}
			var result any
			status := http.StatusNoContent
			switch ep.action {
			case "UserController.getAllEmployee":
				result, err = options.Identity.Employees(ctx)
				status = 200
			case "RoleController.getAllRoles":
				result, err = options.Identity.Roles(ctx)
				status = 200
			case "UserController.createEmployee", "UserController.createEmployeesBatch":
				requests := []identity.CreateEmployee{}
				if ep.path == "/users" {
					var request identity.CreateEmployee
					if !decodeRequest(w, r, &request) {
						return
					}
					requests = append(requests, request)
				} else {
					var request struct {
						Employees []identity.CreateEmployee `json:"employees"`
					}
					if !decodeRequest(w, r, &request) {
						return
					}
					requests = request.Employees
				}
				if len(requests) < 1 || len(requests) > 100 {
					err = validation("Пакет должен содержать от 1 до 100 сотрудников")
					break
				}
				for _, request := range requests {
					if err = validateCreate(request); err != nil {
						break
					}
				}
				if err != nil {
					break
				}
				var ids []string
				ids, err = options.Identity.CreateEmployees(ctx, requests)
				result = ids
				if ep.path == "/users" && len(ids) > 0 {
					result = ids[0]
				}
				status = 201
			case "UserController.updateUser":
				var request identity.UpdateEmployee
				if !decodeRequest(w, r, &request) {
					return
				}
				if request.Email != nil && !validEmail(*request.Email) {
					err = validation("Некорректный формат email адреса")
					break
				}
				if request.Name != nil && utf8.RuneCountInString(*request.Name) > 255 {
					err = validation("Имя не должно превышать 255 символов")
					break
				}
				if request.Phone != nil && !phonePattern.MatchString(*request.Phone) {
					err = validation("Неверный формат номера телефона")
					break
				}
				err = options.Identity.UpdateEmployee(ctx, id, request)
			case "UserController.changePassword":
				var request struct {
					Password string `json:"newPassword"`
				}
				if !decodeRequest(w, r, &request) {
					return
				}
				if strings.TrimSpace(request.Password) == "" || utf8.RuneCountInString(request.Password) < 6 || len([]byte(request.Password)) > 72 {
					err = validation("Пароль должен содержать не менее 6 символов и занимать не более 72 байт UTF-8")
					break
				}
				err = options.Identity.ChangePassword(ctx, id, request.Password)
			case "UserController.adminUpdateUser":
				var request identity.AdminEmployee
				if !decodeRequest(w, r, &request) {
					return
				}
				if len(request.Roles) == 0 {
					err = validation("Список ролей не может быть пустым")
					break
				}
				for _, role := range request.Roles {
					if strings.TrimSpace(role) == "" {
						err = validation("Код роли обязателен")
					}
				}
				if err != nil {
					break
				}
				if strings.ToUpper(request.Status) != "ACTIVE" && strings.ToUpper(request.Status) != "INACTIVE" {
					err = validation("Допустимые статусы сотрудника: ACTIVE, INACTIVE")
					break
				}
				if !directionsValid(request.Directions) {
					err = validation("Некорректный идентификатор направления")
					break
				}
				err = options.Identity.AdminEmployee(ctx, id, request)
			case "UserController.updateStatus":
				var request struct {
					Status string `json:"status"`
				}
				if !decodeRequest(w, r, &request) {
					return
				}
				if request.Status != "ACTIVE" && request.Status != "INACTIVE" {
					err = validation("Допустимые статусы сотрудника: ACTIVE, INACTIVE")
					break
				}
				err = options.Identity.SetEmployeeStatus(ctx, id, request.Status, false)
			case "UserController.deleteById":
				err = options.Identity.SetEmployeeStatus(ctx, id, "INACTIVE", true)
			case "RoleController.create", "RoleController.update":
				var request struct {
					Code string `json:"code"`
					Name string `json:"name"`
				}
				if !decodeRequest(w, r, &request) {
					return
				}
				if strings.TrimSpace(request.Name) == "" || utf8.RuneCountInString(request.Name) > 255 {
					err = validation("Название роли обязательно и не должно превышать 255 символов")
					break
				}
				if ep.method == "POST" {
					if strings.TrimSpace(request.Code) == "" || utf8.RuneCountInString(request.Code) > 45 {
						err = validation("Код роли обязателен и не должен превышать 45 символов")
						break
					}
					result, err = options.Identity.CreateRole(ctx, request.Code, request.Name)
					status = 201
				} else {
					result, err = options.Identity.MutateRole(ctx, id, &request.Name)
					status = 200
				}
			case "RoleController.delete":
				_, err = options.Identity.MutateRole(ctx, id, nil)
			}
			if ep.method != "GET" {
				auditCtx, auditCancel := context.WithTimeout(context.Background(), 2*time.Second)
				auditErr := options.Identity.RecordIdentityAudit(auditCtx, ep.action, ep.method, r.URL.Path, id, w.Header().Get("X-Request-Id"), clientIP(r, options.TrustedProxies), actor, err)
				auditCancel()
				if auditErr != nil {
					slog.Error("identity audit failed", "action", ep.action)
				}
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
}
