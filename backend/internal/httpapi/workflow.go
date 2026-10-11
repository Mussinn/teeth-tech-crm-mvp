package httpapi

import (
	"net/http"
	"strconv"

	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/orders"
	"teethtech.local/crm/internal/pagination"
	"teethtech.local/crm/internal/workflow"
)

func registerOrderOptions(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "PATCH", "/orders/{id}/status", "OrderController.updateStatus", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		return nil, 204, o.Orders.DeactivateOrder(r.Context(), r.PathValue("id"), actor)
	})
	domainRoute(mux, o, "GET", "/orders/{id}/kanban", "OrderController.getKanbanBoard", []string{"ADMIN", "DISPATCHER", "CHIEF_TECHNICIAN"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Orders.Kanban(r.Context(), r.PathValue("id"), actor)
		return v, 200, e
	})
	for _, method := range []string{"PATCH", "DELETE"} {
		roles := []string{"ADMIN", "DISPATCHER"}
		action := "OrderController.update"
		status := 200
		if method == "DELETE" {
			roles = []string{"ADMIN"}
			action = "OrderController.deleteById"
			status = 204
		}
		domainRoute(mux, o, method, "/orders/{id}", action, roles, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.OrderUpdate
			if method == "PATCH" && !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			v, e := o.Orders.WriteOrder(r.Context(), r.PathValue("id"), request, method == "DELETE", actor)
			return v, status, e
		})
	}
	domainRoute(mux, o, "POST", "/orders", "OrderController.createOrder", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		var request orders.CreateRequest
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, e := o.Orders.Create(r.Context(), request, actor)
		return v, 201, e
	})
	domainRoute(mux, o, "GET", "/orders", "OrderController.getAllActiveOrder", []string{"ADMIN", "DISPATCHER", "CHIEF_TECHNICIAN"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		v, e := o.Orders.Active(r.Context(), actor, pagination.Parse(r.URL.Query(), 10, "createdAt,desc"))
		return v, 200, e
	})
	for _, prefix := range []string{"/tasks", "/order-tasks"} {
		domainRoute(mux, o, "GET", prefix+"/calendar/my", "OrderTaskController.getMyCalendar", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			year, err := strconv.ParseInt(r.URL.Query().Get("year"), 10, 32)
			if err != nil {
				return nil, 200, validation("Некорректный year")
			}
			month, err := strconv.ParseInt(r.URL.Query().Get("month"), 10, 32)
			if err != nil {
				return nil, 200, validation("Некорректный month")
			}
			v, e := o.Orders.Calendar(r.Context(), actor.ID, int(year), int(month))
			return v, 200, e
		})
		domainRoute(mux, o, "GET", prefix+"/{taskId}/rework-options", "OrderTaskController.getReworkOptions", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			v, e := o.Orders.ReworkOptions(r.Context(), r.PathValue("taskId"), actor)
			return v, 200, e
		})
		domainRoute(mux, o, "POST", prefix+"/{taskId}/return-for-rework", "OrderTaskController.returnForRework", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.ReworkRequest
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			v, e := o.Orders.ReturnForRework(r.Context(), r.PathValue("taskId"), request, actor)
			return v, 201, e
		})
		domainRoute(mux, o, "PATCH", prefix+"/{taskId}/status", "OrderTaskController.updateTaskStatus", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.StatusUpdate
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			return nil, 204, o.Orders.Transition(r.Context(), r.PathValue("taskId"), request, actor)
		})

		domainRoute(mux, o, "GET", prefix+"/kanban/my", "OrderTaskController.getMyKanbanBoard", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			v, e := o.Orders.EmployeeKanban(r.Context(), "", actor)
			return v, 200, e
		})
		domainRoute(mux, o, "GET", prefix+"/order/{orderId}/kanban/employee", "OrderTaskController.getEmployeeKanbanBoard", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			if !uuidPattern.MatchString(r.PathValue("orderId")) {
				return nil, 200, validation("Некорректный orderId")
			}
			v, e := o.Orders.EmployeeKanban(r.Context(), r.PathValue("orderId"), actor)
			return v, 200, e
		})

		domainRoute(mux, o, "PATCH", prefix+"/{taskId}/materials", "OrderTaskController.updateMaterials", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request struct {
				Materials []string `json:"materialIds"`
			}
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			if !uuidPattern.MatchString(r.PathValue("taskId")) {
				return nil, 204, validation("Некорректный taskId")
			}
			return nil, 204, o.Orders.UpdateMaterials(r.Context(), r.PathValue("taskId"), request.Materials, actor)
		})
		domainRoute(mux, o, "DELETE", prefix+"/{taskId}", "OrderTaskController.delete", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			if !uuidPattern.MatchString(r.PathValue("taskId")) {
				return nil, 204, validation("Некорректный taskId")
			}
			return nil, 204, o.Orders.DeleteTask(r.Context(), r.PathValue("taskId"), actor)
		})
		domainRoute(mux, o, "PATCH", prefix+"/{taskId}", "OrderTaskController.update", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.TaskUpdate
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			if !uuidPattern.MatchString(r.PathValue("taskId")) {
				return nil, 204, validation("Некорректный taskId")
			}
			return nil, 204, o.Orders.UpdateTask(r.Context(), r.PathValue("taskId"), request, actor)
		})
		domainRoute(mux, o, "POST", prefix, "OrderTaskController.create", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.CreateTask
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			v, e := o.Orders.CreateTask(r.Context(), request, actor)
			return v, 201, e
		})
		domainRoute(mux, o, "PATCH", prefix+"/{taskId}/assignment", "OrderTaskController.updateAssignmentPlan", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			var request orders.AssignmentUpdate
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			if !uuidPattern.MatchString(r.PathValue("taskId")) {
				return nil, 200, validation("Некорректный taskId")
			}
			for _, a := range request.Assignees {
				if a == nil || !uuidPattern.MatchString(a.StatusID) || !uuidPattern.MatchString(a.UserID) {
					return nil, 200, validation("Некорректное назначение")
				}
			}
			v, e := o.Orders.UpdateAssignment(r.Context(), r.PathValue("taskId"), "", request, actor)
			return v, 200, e
		})
		domainRoute(mux, o, "PATCH", prefix+"/{taskId}/assign/{userId}", "OrderTaskController.assignTechnician", []string{"ADMIN", "DISPATCHER"}, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			if !uuidPattern.MatchString(r.PathValue("taskId")) || !uuidPattern.MatchString(r.PathValue("userId")) {
				return nil, 204, validation("Некорректный UUID")
			}
			_, e := o.Orders.UpdateAssignment(r.Context(), r.PathValue("taskId"), r.PathValue("userId"), orders.AssignmentUpdate{}, actor)
			return nil, 204, e
		})
		domainRoute(mux, o, "GET", prefix+"/work-types/{workTypeId}/assignable-statuses", "OrderTaskController.getAssignableStatuses", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			id := r.PathValue("workTypeId")
			if !uuidPattern.MatchString(id) {
				return nil, 200, validation("Некорректный workTypeId")
			}
			v, e := o.Orders.AssignableStatuses(r.Context(), id)
			return v, 200, e
		})
		for _, view := range []string{"assignment", "assignees", "next-step-assignees"} {
			action := map[string]string{"assignment": "getAssignmentPlan", "assignees": "getAssigneesForCurrentTask", "next-step-assignees": "getAssigneesForNextStep"}[view]
			domainRoute(mux, o, "GET", prefix+"/{taskId}/"+view, "OrderTaskController."+action, nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
				id, next := r.PathValue("taskId"), r.URL.Query().Get("nextStatusId")
				if !uuidPattern.MatchString(id) || (view == "next-step-assignees" && !uuidPattern.MatchString(next)) {
					return nil, 200, validation("Некорректный UUID задачи или следующего статуса")
				}
				v, e := o.Orders.AssignmentView(r.Context(), id, view, next, actor)
				return v, 200, e
			})
		}
		for _, view := range []string{"material-plan", "material-usages", "material-accounting"} {
			action := map[string]string{"material-plan": "getMaterialPlan", "material-usages": "getMaterialUsages", "material-accounting": "getMaterialAccounting"}[view]
			domainRoute(mux, o, "GET", prefix+"/{taskId}/"+view, "OrderTaskController."+action, nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
				id := r.PathValue("taskId")
				if !uuidPattern.MatchString(id) {
					return nil, 200, validation("Некорректный taskId")
				}
				v, e := o.Orders.MaterialView(r.Context(), id, view, actor)
				return v, 200, e
			})
		}
		domainRoute(mux, o, "GET", prefix+"/{taskId}/history", "OrderTaskController.getTaskHistory", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
			id := r.PathValue("taskId")
			if !uuidPattern.MatchString(id) {
				return nil, 200, validation("Некорректный taskId")
			}
			page, size := int64(0), int64(20)
			for _, parameter := range []struct {
				key    string
				target *int64
			}{{"page", &page}, {"size", &size}} {
				if raw := r.URL.Query().Get(parameter.key); raw != "" {
					value, err := strconv.ParseInt(raw, 10, 32)
					if err != nil {
						return nil, 200, validation("Некорректный параметр страницы")
					}
					*parameter.target = value
				}
			}
			v, e := o.Orders.History(r.Context(), id, actor, int(page), int(size))
			return v, 200, e
		})
	}
	for _, kind := range []string{"people", "materials", "work-types", "colors"} {
		action := map[string]string{"people": "people", "materials": "materials", "work-types": "workTypes", "colors": "colors"}[kind]
		roles := []string(nil)
		if kind == "people" {
			roles = []string{"ADMIN", "DISPATCHER"}
		}
		domainRoute(mux, o, "GET", "/orders/form-options/"+kind, "OrderFormOptionsController."+action, roles, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			q := r.URL.Query()
			limit := 20
			if raw := q.Get("limit"); raw != "" {
				n, err := strconv.Atoi(raw)
				if err != nil || n < 1 || n > 50 {
					return nil, 200, validation("limit должен быть от 1 до 50")
				}
				limit = n
			}
			if kind == "people" {
				if !uuidPattern.MatchString(q.Get("clinicId")) {
					return nil, 200, validation("Некорректный clinicId")
				}
				if q.Get("role") != "PATIENT" && q.Get("role") != "DOCTOR" {
					return nil, 200, validation("role должен быть PATIENT или DOCTOR")
				}
			}
			v, e := o.Orders.FormOptions(r.Context(), kind, q.Get("clinicId"), q.Get("role"), q.Get("q"), limit)
			return v, 200, e
		})
	}
}
func registerWorkflow(mux *http.ServeMux, o Options) {
	registerSLA(mux, o)
	staff := []string{"ADMIN", "CHIEF_TECHNICIAN"}
	domainRoute(mux, o, "PATCH", "/order-statuses/{id}/activation", "OrderStatusController.activation", []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request struct {
			Active *bool `json:"active"`
		}
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		if request.Active == nil {
			return nil, 400, validation("active обязателен")
		}
		v, e := o.Workflow.SetStatusActive(r.Context(), r.PathValue("id"), *request.Active)
		return v, 200, e
	})
	for _, path := range []string{"/order-statuses", "/workflow/statuses"} {
		action := "OrderStatusController.getAll"
		if path == "/workflow/statuses" {
			action = "WorkflowStepController.getAllStatuses"
		}
		domainRoute(mux, o, "GET", path, action, nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			v, e := o.Workflow.Statuses(r.Context(), path == "/workflow/statuses")
			return v, 200, e
		})
	}
	for _, method := range []string{"POST", "PUT"} {
		path, action, status := "/order-statuses", "create", 201
		if method == "PUT" {
			path += "/{id}"
			action, status = "update", 200
		}
		domainRoute(mux, o, method, path, "OrderStatusController."+action, []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
			var request workflow.Status
			if !decodeRequest(w, r, &request) {
				return nil, 0, nil
			}
			v, e := o.Workflow.SaveStatus(r.Context(), r.PathValue("id"), request)
			return v, status, e
		})
	}
	domainRoute(mux, o, "DELETE", "/order-statuses/{id}", "OrderStatusController.deleteById", []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		return nil, 204, o.Workflow.DeleteStatus(r.Context(), r.PathValue("id"))
	})
	domainRoute(mux, o, "GET", "/admin/workflow/steps", "WorkflowAdminController.getSteps", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		id := r.URL.Query().Get("workTypeId")
		if !uuidPattern.MatchString(id) {
			return nil, 200, validation("Некорректный workTypeId")
		}
		v, e := o.Workflow.Steps(r.Context(), id)
		return v, 200, e
	})
	domainRoute(mux, o, "POST", "/admin/workflow/steps", "WorkflowAdminController.createStep", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request workflow.StepRequest
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		if !uuidPattern.MatchString(request.WorkTypeID) || !uuidPattern.MatchString(request.FromStatusID) || !uuidPattern.MatchString(request.ToStatusID) {
			return nil, 201, validation("Тип работы и оба статуса должны быть UUID")
		}
		v, e := o.Workflow.CreateStep(r.Context(), request)
		return v, 201, e
	})
	domainRoute(mux, o, "DELETE", "/admin/workflow/steps/{id}", "WorkflowAdminController.deleteStep", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		return nil, 204, o.Workflow.DeleteStep(r.Context(), r.PathValue("id"))
	})
	domainRoute(mux, o, "POST", "/admin/workflow/work-types", "WorkflowAdminController.createWorkTypeWithWorkflow", staff, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request workflow.Template
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, e := o.Workflow.CreateTemplate(r.Context(), request)
		return v, 201, e
	})
	domainRoute(mux, o, "GET", "/workflow/{workType}/available-transitions/{currentStatusId}", "WorkflowStepController.getAvailableTransitions", nil, func(w http.ResponseWriter, r *http.Request, actor identity.User) (any, int, error) {
		id := r.PathValue("currentStatusId")
		if !uuidPattern.MatchString(id) {
			return nil, 200, validation("Некорректный currentStatusId")
		}
		v, e := o.Workflow.Transitions(r.Context(), r.PathValue("workType"), id, actor.Roles)
		return v, 200, e
	})
}
