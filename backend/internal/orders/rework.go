package orders

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

type ReworkRequest struct {
	TargetStatusID        string                      `json:"targetStatusId"`
	AssignedTo            string                      `json:"assignedTo"`
	IncidentType          string                      `json:"incidentType"`
	ReasonCode            string                      `json:"reasonCode"`
	Description           string                      `json:"description"`
	MaterialLossAmount    *json.Number                `json:"materialLossAmount"`
	SalaryDeductionAmount *json.Number                `json:"salaryDeductionAmount"`
	StockWriteOffs        []*warehouse.ReworkWriteOff `json:"stockWriteOffs"`
}

func (s *Service) ReworkOptions(ctx context.Context, task string, actor identity.User) (any, error) {
	if !createUUID.MatchString(task) {
		return nil, dbx.Validation("Некорректный taskId")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireTaskAccess(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	var wt string
	var currentOrder int
	err = tx.QueryRow(ctx, `SELECT t.work_type_id::text,`+routePosition("t.work_type_id", "st.id")+` FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id AND o.deleted_at IS NULL JOIN t_order_statuses st ON st.id=t.status_id WHERE t.id=$1 AND t.deleted_at IS NULL`, task).Scan(&wt, &currentOrder)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Задача или её заказ не найдены")
	}
	if err != nil {
		return nil, err
	}
	items, err := dbx.List(ctx, tx, `WITH stages AS (
 SELECT DISTINCT ON(from_status_id) * FROM t_workflow_steps WHERE work_type_id=$1 AND deleted_at IS NULL ORDER BY from_status_id,sort_order,id)
 SELECT jsonb_build_object('statusId',st.id,'statusCode',st.code,'statusName',st.name,'sortOrder',s.sort_order,'requiredRole',s.required_role,
 'eligibleAssignees',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',c.id,'fullName',c.name,'activeTaskCount',c.load,'isCurrent',false) ORDER BY c.load,c.id)
 FROM (SELECT u.id,u.name,`+candidateLoad+` load FROM t_users u WHERE u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM t_user_roles ur JOIN t_roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code=s.required_role)) c),'[]'::jsonb))
 FROM stages s JOIN t_order_statuses st ON st.id=s.from_status_id WHERE st.is_active AND NOT st.is_initial AND NOT st.is_terminal AND s.sort_order<$2 ORDER BY s.sort_order,s.id`, wt, currentOrder)
	if err != nil {
		return nil, err
	}
	return items, tx.Commit(ctx)
}

func (s *Service) ReturnForRework(ctx context.Context, task string, r ReworkRequest, actor identity.User) (result json.RawMessage, err error) {
	if !createUUID.MatchString(task) || !createUUID.MatchString(r.TargetStatusID) || !createUUID.MatchString(r.AssignedTo) || strings.TrimSpace(r.IncidentType) == "" || strings.TrimSpace(r.ReasonCode) == "" || strings.TrimSpace(r.Description) == "" {
		return nil, dbx.Validation("Нужны UUID задачи, статуса и сотрудника, тип, причина и описание инцидента")
	}
	if err = warehouse.ValidateReworkWriteOffs(r.StockWriteOffs); err != nil {
		return nil, err
	}
	defer func() {
		if errors.Is(err, warehouse.ErrInventoryLocked) {
			err = &identity.Failure{Status: 409, Code: "WHS_001", Message: "Склад заблокирован инвентаризацией"}
		} else {
			err = dbx.Constraint(err)
		}
	}()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, sql := range []string{`SELECT pg_advisory_xact_lock(841337,1)`, `SELECT pg_advisory_xact_lock(846321)`} {
		if _, err = tx.Exec(ctx, sql); err != nil {
			return nil, err
		}
	}
	if err = requireTaskAccess(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	var order, wt, oldCode string
	var oldOrder int
	err = tx.QueryRow(ctx, `SELECT o.id::text FROM t_orders o JOIN t_order_tasks t ON t.order_id=o.id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL FOR UPDATE OF o`, task).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Задача или её заказ не найдены")
	}
	if err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx, `SELECT t.work_type_id::text,st.code,`+routePosition("t.work_type_id", "st.id")+` FROM t_order_tasks t JOIN t_order_statuses st ON st.id=t.status_id WHERE t.id=$1 AND t.deleted_at IS NULL FOR UPDATE OF t`, task).Scan(&wt, &oldCode, &oldOrder)
	if err != nil {
		return nil, err
	}
	if err = requireTaskAccess(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	var user string
	err = tx.QueryRow(ctx, `SELECT id::text FROM t_users WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, r.AssignedTo).Scan(&user)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Сотрудник не найден")
	}
	if err != nil {
		return nil, err
	}
	var code string
	var targetOrder int
	err = tx.QueryRow(ctx, `SELECT code,`+routePosition("$2::uuid", "t_order_statuses.id")+` FROM t_order_statuses WHERE id=$1 AND is_active FOR SHARE`, r.TargetStatusID, wt).Scan(&code, &targetOrder)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Статус заказа не найден")
	}
	if err != nil {
		return nil, err
	}
	var role string
	err = tx.QueryRow(ctx, `SELECT required_role FROM t_workflow_steps WHERE work_type_id=$1 AND deleted_at IS NULL AND (from_status_id=$2 OR to_status_id=$2) ORDER BY (from_status_id=$2) DESC,sort_order,id LIMIT 1`, wt, r.TargetStatusID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) || targetOrder >= oldOrder {
		return nil, dbx.Business("Недопустимый переход из " + oldCode + " в " + code)
	}
	if err != nil {
		return nil, err
	}
	var eligible bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_user_roles ur JOIN t_roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code=$2)`, user, role).Scan(&eligible); err != nil {
		return nil, err
	}
	if !eligible {
		return nil, dbx.Business("Сотрудник не имеет роли " + role + " для выбранного этапа")
	}
	if !s.financeEnabled {
		r.MaterialLossAmount = nil
		r.SalaryDeductionAmount = nil
	}
	number := func(n *json.Number) any {
		if n == nil {
			return nil
		}
		return string(*n)
	}
	var incident string
	// Monetary fields are incident metadata, not automatic payroll deductions.
	err = tx.QueryRow(ctx, `INSERT INTO t_quality_incidents(task_id,reported_by,assigned_to,incident_type,reason_code,description,material_loss_amount,salary_deduction_amount)
 VALUES($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric) RETURNING id::text`, task, actor.ID, user, strings.ToUpper(strings.TrimSpace(r.IncidentType)), strings.ToUpper(strings.TrimSpace(r.ReasonCode)), r.Description, number(r.MaterialLossAmount), number(r.SalaryDeductionAmount)).Scan(&incident)
	if err != nil {
		return nil, err
	}

	if s.warehouseEnabled {
		if err = warehouse.WriteOffRework(ctx, tx, incident, r.StockWriteOffs); err != nil {
			return nil, err
		}
	}

	if err = invalidateLabQuality(ctx, tx, order, actor.ID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_tasks SET status_id=$2,dental_technician_id=$3,updated_at=now() WHERE id=$1`, task, r.TargetStatusID, user); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_orders SET is_active=true, completed_at=NULL,updated_at=now() WHERE id=$1`, order); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_history(task_id,field_name,old_value,new_value,changed_by,comment) VALUES($1,'STATUS',$2,$3,$4,$5)`, task, oldCode, code, actor.ID, "Возврат на переделку: "+r.Description); err != nil {
		return nil, err
	}
	if err = restartTaskSLA(ctx, tx, task); err != nil {
		return nil, err
	}
	for _, event := range []string{"TASK_UPDATED", "TASK_RETURNED_FOR_REWORK"} {
		if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,jsonb_build_object('eventType',$2::text,'entityId',$1::uuid,'statusCode',$3::text)::text)`, task, event, code); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) SELECT 'NOTIFICATION','TASK',$1,jsonb_build_object('userId',$2::uuid,'type','TASK_ASSIGNED','title','Назначена задача','message','Задача перешла в статус '||$3::text,'resourceType','TASK','resourceId',$1::uuid)::text WHERE $2::uuid<>$4::uuid`, task, user, code, actor.ID); err != nil {
		return nil, err
	}
	if err = notifyRework(ctx, tx, task, user, r.Description); err != nil {
		return nil, err
	}
	result, err = dbx.One(ctx, tx, `SELECT jsonb_build_object('id',id,'taskId',task_id,'incidentType',incident_type,'status',status,'reasonCode',reason_code,'description',description,'reportedBy',reported_by,'assignedTo',assigned_to,'materialLossAmount',$2::numeric,'salaryDeductionAmount',$3::numeric,'createdAt',created_at,'resolvedAt',resolved_at,'resolutionComment',resolution_comment) FROM t_quality_incidents WHERE id=$1`, incident, number(r.MaterialLossAmount), number(r.SalaryDeductionAmount))
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

// Match Java's synchronous in-app notification and queued external deliveries,
// including preferences. External delivery remains the Java outbox's job.
func notifyRework(ctx context.Context, tx pgx.Tx, task, user, description string) error {
	_, err := tx.Exec(ctx, `INSERT INTO t_notifications(user_id,type,title,message,resource_type,resource_id)
 SELECT u.id,'QUALITY_INCIDENT','Зарегистрирован брак/переделка',$3,'TASK',$1 FROM t_users u LEFT JOIN t_notification_preferences p ON p.user_id=u.id WHERE u.id=$2 AND coalesce(p.quality_incident,true) AND coalesce(p.in_app_enabled,true)`, task, user, description)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload)
 SELECT 'NOTIFICATION_EMAIL','TASK',$1::uuid,jsonb_build_object('email',u.email,'telegramChatId',NULL,'title','Зарегистрирован брак/переделка','message',$3::text)::text FROM t_users u JOIN t_notification_preferences p ON p.user_id=u.id WHERE u.id=$2 AND p.quality_incident AND p.email_enabled
 UNION ALL SELECT 'NOTIFICATION_TELEGRAM','TASK',$1::uuid,jsonb_build_object('email',NULL,'telegramChatId',p.telegram_chat_id,'title','Зарегистрирован брак/переделка','message',$3::text)::text FROM t_notification_preferences p WHERE p.user_id=$2 AND p.quality_incident AND p.telegram_enabled AND p.telegram_chat_id IS NOT NULL`, task, user, description)
	return err
}

// Positions belong to a work type's route, not the shared status dictionary.
func routePosition(workType, status string) string {
	return `COALESCE((SELECT min(wp.sort_order) FROM t_workflow_steps wp WHERE wp.work_type_id=` + workType + ` AND wp.from_status_id=` + status + ` AND wp.deleted_at IS NULL),(SELECT min(wp.sort_order)+1 FROM t_workflow_steps wp WHERE wp.work_type_id=` + workType + ` AND wp.to_status_id=` + status + ` AND wp.deleted_at IS NULL),2147483647)`
}
