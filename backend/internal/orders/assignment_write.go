package orders

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

type AssigneeUpdate struct {
	StatusID string `json:"statusId"`
	UserID   string `json:"userId"`
}
type AssignmentUpdate struct {
	Mode      string            `json:"assignmentMode"`
	Assignees []*AssigneeUpdate `json:"statusAssignees"`
}

// UpdateAssignment serializes changes to one task. The outbox insert commits
// with the mutation, so a failed write can never publish a dashboard event.
func (s *Service) UpdateAssignment(ctx context.Context, taskID, technicianID string, request AssignmentUpdate, actor identity.User) (result any, err error) {
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "DISPATCHER") {
		return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	if technicianID == "" && request.Mode != "AUTO" && request.Mode != "PREASSIGNED" {
		return nil, dbx.Validation("Укажите режим AUTO или PREASSIGNED")
	}
	for _, a := range request.Assignees {
		if a == nil {
			return nil, dbx.Validation("Назначение не может быть null")
		}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// Same lock as workflow configuration writers: required roles cannot change
	// while a Go plan is being validated and saved.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return nil, err
	}
	var workType, status string
	var direction *string
	err = tx.QueryRow(ctx, `SELECT t.work_type_id::text,s.code,t.work_direction_id::text
 FROM public.t_order_tasks t JOIN public.t_order_statuses s ON s.id=t.status_id
 WHERE t.id=$1 AND t.deleted_at IS NULL FOR UPDATE OF t`, taskID).Scan(&workType, &status, &direction)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Task not found: " + taskID)
	}
	if err != nil {
		return nil, err
	}
	if !hasRole(actor, "ADMIN") {
		var allowed bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_user_work_directions WHERE user_id=$1 AND work_direction_id=$2)`, actor.ID, direction).Scan(&allowed)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа к направлению работ"}
		}
	}
	event := "TASK_ASSIGNMENT_UPDATED"
	if technicianID != "" {
		var id string
		err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_users WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, technicianID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, dbx.Missing("Пользователь не найден")
		}
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx, `UPDATE public.t_order_tasks SET dental_technician_id=$2,updated_at=now() WHERE id=$1`, taskID, id)
		event = "TASK_ASSIGNED"
	} else {
		err = applyAssignmentPlan(ctx, tx, taskID, workType, request)
		if err != nil {
			return nil, err
		}
		items, e := dbx.List(ctx, tx, `SELECT jsonb_build_object('statusId',s.id,'statusCode',s.code,'statusName',s.name,'userId',u.id,'userFullName',u.name) FROM public.t_order_task_status_assignees p JOIN public.t_order_statuses s ON s.id=p.status_id JOIN public.t_users u ON u.id=p.user_id WHERE p.order_task_id=$1 ORDER BY s.sort_order,s.id`, taskID)
		if e != nil {
			return nil, e
		}
		result = map[string]any{"assignmentMode": request.Mode, "statusAssignees": items}
	}
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(map[string]any{"eventType": event, "entityId": taskID, "statusCode": status})
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO public.t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,$2)`, taskID, string(payload))
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

// applyAssignmentPlan participates in the caller transaction and publishes no event.
func applyAssignmentPlan(ctx context.Context, tx pgx.Tx, taskID, workType string, request AssignmentUpdate) error {
	var err error
	if request.Mode == "AUTO" {
		_, err = tx.Exec(ctx, `DELETE FROM public.t_order_task_status_assignees WHERE order_task_id=$1`, taskID)
	} else {
		var existingType string
		err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_work_types WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, workType).Scan(&existingType)
		if errors.Is(err, pgx.ErrNoRows) {
			return dbx.Missing("Вид работы не найден")
		}
		if err != nil {
			return err
		}
		var required int
		err = tx.QueryRow(ctx, `SELECT count(DISTINCT a.from_status_id) FROM public.t_workflow_steps a WHERE a.work_type_id=$1 AND a.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.t_workflow_steps b WHERE b.work_type_id=$1 AND b.deleted_at IS NULL AND b.to_status_id=a.from_status_id)`, workType).Scan(&required)
		if err != nil {
			return err
		}
		// Java ignores the plan when the graph has no intermediate stages.
		if required > 0 {
			seen := map[string]bool{}
			for _, a := range request.Assignees {
				key := strings.ToLower(a.StatusID)
				if seen[key] {
					return dbx.Business("Дублируется назначение для одного статуса")
				}
				seen[key] = true
				var role string
				err = tx.QueryRow(ctx, `SELECT required_role FROM public.t_workflow_steps a WHERE a.work_type_id=$1 AND a.from_status_id=$2 AND a.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.t_workflow_steps b WHERE b.work_type_id=$1 AND b.to_status_id=a.from_status_id AND b.deleted_at IS NULL) ORDER BY a.sort_order,a.id LIMIT 1`, workType, a.StatusID).Scan(&role)
				if errors.Is(err, pgx.ErrNoRows) {
					return dbx.Business("Статус вне промежуточных этапов workflow")
				}
				if err != nil {
					return err
				}
				var user string
				err = tx.QueryRow(ctx, `SELECT u.id::text FROM public.t_users u WHERE u.id=$1 AND u.deleted_at IS NULL FOR SHARE OF u`, a.UserID).Scan(&user)
				if errors.Is(err, pgx.ErrNoRows) {
					return dbx.Business("Сотрудник не найден или не имеет требуемой роли")
				}
				if err != nil {
					return err
				}
				var eligible bool
				err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_user_roles ur JOIN public.t_roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code=$2)`, user, role).Scan(&eligible)
				if err != nil {
					return err
				}
				if !eligible {
					return dbx.Business("Сотрудник не имеет требуемой роли")
				}
				_, err = tx.Exec(ctx, `INSERT INTO public.t_order_task_status_assignees(order_task_id,status_id,user_id) VALUES($1,$2,$3) ON CONFLICT(order_task_id,status_id) DO UPDATE SET user_id=excluded.user_id,updated_at=now()`, taskID, a.StatusID, user)
				if err != nil {
					return dbx.Constraint(err)
				}
			}
			var missing bool
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_workflow_steps a WHERE a.work_type_id=$1 AND a.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.t_workflow_steps b WHERE b.work_type_id=$1 AND b.deleted_at IS NULL AND b.to_status_id=a.from_status_id) AND NOT EXISTS(SELECT 1 FROM public.t_order_task_status_assignees p WHERE p.order_task_id=$2 AND p.status_id=a.from_status_id))`, workType, taskID).Scan(&missing)
			if err != nil {
				return err
			}
			if missing {
				return dbx.Business("Не назначены ответственные для всех промежуточных статусов")
			}
		}
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE public.t_order_tasks SET assignment_mode=$2,updated_at=now() WHERE id=$1`, taskID, request.Mode)
	if err != nil {
		return err
	}
	return nil
}
