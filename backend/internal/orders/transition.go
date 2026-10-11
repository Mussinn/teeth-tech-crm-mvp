package orders

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

type StatusUpdate struct {
	NextStatusID     string                  `json:"nextStatusId"`
	Comment          *string                 `json:"comment"`
	AssignedUserID   *string                 `json:"assignedUserId"`
	MaterialReportID *string                 `json:"materialReportId"`
	MaterialUsages   []*warehouse.StageUsage `json:"materialUsages"`
}

// Transition commits status, material accounting, assignment and event records
// together. The Go background worker delivers queued in-app notifications.
func (s *Service) Transition(ctx context.Context, id string, r StatusUpdate, actor identity.User) (err error) {
	if !createUUID.MatchString(id) || !createUUID.MatchString(r.NextStatusID) {
		return dbx.Validation("Новый статус и taskId должны быть UUID")
	}
	for _, v := range []*string{r.AssignedUserID, r.MaterialReportID} {
		if v != nil && !createUUID.MatchString(*v) {
			return dbx.Validation("Некорректный UUID")
		}
	}
	if err = warehouse.ValidateStageUsages(r.MaterialUsages); err != nil {
		return err
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
		return err
	}
	defer tx.Rollback(ctx)
	for _, sql := range []string{`SELECT pg_advisory_xact_lock(841337,1)`, `SELECT pg_advisory_xact_lock(846321)`} {
		if _, err = tx.Exec(ctx, sql); err != nil {
			return err
		}
	}
	if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
		return err
	}
	var order, workType, oldID, oldCode, mode string
	err = tx.QueryRow(ctx, `SELECT o.id::text FROM t_orders o JOIN t_order_tasks t ON t.order_id=o.id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL FOR UPDATE OF o`, id).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача или её заказ не найдены")
	}
	if err != nil {
		return err
	}
	if err = checkLabProduction(ctx, tx, order); err != nil {
		return err
	}
	err = tx.QueryRow(ctx, `SELECT t.work_type_id::text,t.status_id::text,st.code,t.assignment_mode FROM t_order_tasks t JOIN t_order_statuses st ON st.id=t.status_id WHERE t.id=$1 AND t.deleted_at IS NULL FOR UPDATE OF t`, id).Scan(&workType, &oldID, &oldCode, &mode)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return err
	}
	// Authorization is rechecked after waiting for the task lock (assignment can change).
	if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
		return err
	}
	var nextCode string
	var terminal bool
	err = tx.QueryRow(ctx, `SELECT code,is_terminal FROM t_order_statuses WHERE id=$1 AND is_active FOR SHARE`, r.NextStatusID).Scan(&nextCode, &terminal)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Статус заказа не найден")
	}
	if err != nil {
		return err
	}
	var step, role string
	err = tx.QueryRow(ctx, `SELECT id::text,required_role FROM t_workflow_steps WHERE work_type_id=$1 AND from_status_id=$2 AND to_status_id=$3 AND deleted_at IS NULL AND required_role=ANY($4::text[])`, workType, oldID, r.NextStatusID, actor.Roles).Scan(&step, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Business("Недопустимый переход из " + oldCode + " в " + nextCode)
	}
	if err != nil {
		return err
	}
	if err = checkLabDesign(ctx, tx, order, oldID, terminal); err != nil {
		return err
	}
	report := ""
	if r.MaterialReportID != nil {
		report = *r.MaterialReportID
	}

	if s.warehouseEnabled {
		if err = warehouse.RecordStageUsage(ctx, tx, id, step, actor.ID, report, r.MaterialUsages); err != nil {
			return err
		}
	}

	if terminal {

		if s.warehouseEnabled {
			if err = warehouse.FinalizeTaskMaterials(ctx, tx, id); err != nil {
				return err
			}
		}

	}
	if s.kpiEnabled {
		if err = recordCompletion(ctx, tx, id, actor.ID, oldID, r.NextStatusID); err != nil {
			return err
		}
	}
	// Java flushes the new status before calculating employee load. Match that
	// behavior, including excluding review/terminal tasks from the load.
	if err = invalidateLabQuality(ctx, tx, order, actor.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_tasks SET status_id=$2,updated_at=now() WHERE id=$1`, id, r.NextStatusID); err != nil {
		return err
	}
	assignee, err := resolveTransitionAssignee(ctx, tx, id, r.NextStatusID, mode, role, r.AssignedUserID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_tasks SET dental_technician_id=$2 WHERE id=$1`, id, assignee); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_history(task_id,field_name,old_value,new_value,changed_by,comment) VALUES($1,'STATUS',$2,$3,$4,$5)`, id, oldCode, nextCode, actor.ID, r.Comment); err != nil {
		return err
	}
	// Use the application's local calendar date, as Java LocalDate.now() does.
	if s.financeEnabled {
		if err = recordStageSalary(ctx, tx, id, oldID, r.NextStatusID, actor.ID, r.Comment, time.Now().Format("2006-01-02")); err != nil {
			return err
		}
	}

	if err = restartTaskSLA(ctx, tx, id); err != nil {
		return err
	}
	if terminal {
		tag, e := tx.Exec(ctx, `UPDATE t_orders o SET is_active=false,completed_at=now(),updated_at=now() WHERE o.id=$1 AND o.is_active AND NOT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_order_statuses st ON st.id=t.status_id WHERE t.order_id=o.id AND t.deleted_at IS NULL AND (NOT st.is_terminal OR ($2 AND t.materials_finalized_at IS NULL)))`, order, s.warehouseEnabled)
		if e != nil {
			return e
		}
		if tag.RowsAffected() > 0 {
			if _, err = tx.Exec(ctx, `DELETE FROM t_stock_reserves WHERE order_id=$1`, order); err != nil {
				return err
			}
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,jsonb_build_object('eventType','TASK_UPDATED','entityId',$1::uuid,'statusCode',$2::text)::text)`, id, nextCode); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) SELECT 'NOTIFICATION','TASK',$1,jsonb_build_object('userId',$2::uuid,'type','TASK_ASSIGNED','title','Назначена задача','message','Задача перешла в статус '||$3::text,'resourceType','TASK','resourceId',$1::uuid)::text WHERE $2::uuid<>$4::uuid`, id, assignee, nextCode, actor.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func resolveTransitionAssignee(ctx context.Context, tx pgx.Tx, task, next, mode, role string, explicit *string) (string, error) {
	var id string
	// The outgoing edge from the new status identifies the next stage's employee.
	var nextRole string
	e := tx.QueryRow(ctx, `SELECT required_role FROM t_workflow_steps w JOIN t_order_tasks t ON t.work_type_id=w.work_type_id WHERE t.id=$1 AND w.from_status_id=$2 AND w.deleted_at IS NULL ORDER BY w.sort_order,w.id LIMIT 1`, task, next).Scan(&nextRole)
	if e == nil {
		role = nextRole
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return "", e
	} else if explicit == nil {
		// Terminal stages keep the employee who performed the work.
		e = tx.QueryRow(ctx, `SELECT dental_technician_id::text FROM t_order_tasks WHERE id=$1 AND dental_technician_id IS NOT NULL`, task).Scan(&id)
		if e == nil {
			return id, nil
		}
		if !errors.Is(e, pgx.ErrNoRows) {
			return "", e
		}
	}
	if explicit != nil {
		err := tx.QueryRow(ctx, `SELECT u.id::text FROM t_users u WHERE u.id=$1 AND u.deleted_at IS NULL AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM t_user_roles ur JOIN t_roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code=$2) FOR SHARE OF u`, *explicit, role).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", dbx.Business("Сотрудник недоступен или не имеет нужной роли: " + *explicit)
		}
		return id, err
	}
	if mode == "PREASSIGNED" {
		err := tx.QueryRow(ctx, `SELECT u.id::text FROM t_order_task_status_assignees a JOIN t_users u ON u.id=a.user_id AND u.deleted_at IS NULL WHERE a.order_task_id=$1 AND a.status_id=$2 FOR SHARE OF u`, task, next).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return "", err
		}
	}
	// Select an active employee for the stage being entered.
	err := tx.QueryRow(ctx, `SELECT u.id::text FROM t_users u WHERE u.deleted_at IS NULL AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM t_user_roles ur JOIN t_roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code=$1)
 ORDER BY EXISTS(SELECT 1 FROM t_user_roles ur JOIN t_roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ROLE_ADMIN'),(SELECT count(*) FROM t_order_tasks t JOIN t_order_statuses st ON st.id=t.status_id WHERE t.dental_technician_id=u.id AND t.deleted_at IS NULL AND NOT st.is_terminal AND NOT st.is_review),u.id LIMIT 1 FOR SHARE OF u`, role).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", dbx.Business("Нет доступного сотрудника для роли " + role)
	}
	return id, err
}

func recordStageSalary(ctx context.Context, tx pgx.Tx, task, old, next, actor string, comment *string, date string) error {
	_, err := tx.Exec(ctx, `WITH candidate AS (
 SELECT r.*,t.quantity task_quantity,t.price_per_unit,
 CASE r.calculation_type WHEN 'TASK_QUANTITY' THEN t.quantity WHEN 'PERCENT_OF_TASK' THEN t.quantity WHEN 'TEETH_COUNT' THEN (SELECT count(*) FROM t_order_task_teeth WHERE order_task_id=t.id) ELSE 1 END units
 FROM t_order_tasks t JOIN t_order_statuses old ON old.id=$2 JOIN t_order_statuses next ON next.id=$3
 JOIN t_salary_plans p ON p.user_id=$4 AND p.active AND p.deleted_at IS NULL AND p.effective_from<=$6::date AND (p.effective_to IS NULL OR p.effective_to>=$6::date)
 JOIN t_salary_stage_rules r ON r.plan_id=p.id AND r.active AND r.deleted_at IS NULL AND r.effective_from<=$6::date AND (r.effective_to IS NULL OR r.effective_to>=$6::date)
 WHERE t.id=$1 AND next.sort_order>old.sort_order AND (r.work_type_id IS NULL OR r.work_type_id=t.work_type_id) AND (r.status_id IS NULL OR r.status_id=old.id)
 ORDER BY ((r.status_id IS NOT NULL)::int*2+(r.work_type_id IS NOT NULL)::int) DESC,r.priority DESC,r.id LIMIT 1
 ) INSERT INTO t_salary_accruals(employee_id,order_task_id,status_id,rule_id,treatment,calculation_type,quantity,rate,amount,earned_at,comment)
 SELECT $4,$1,$2,id,treatment,calculation_type,units,rate,
 CASE WHEN treatment NOT IN('PAID_EXTRA','REQUIRES_REVIEW') THEN 0 WHEN calculation_type='PERCENT_OF_TASK' THEN round(price_per_unit*units*rate/100,2) ELSE round(rate*units,2) END,clock_timestamp(),$5 FROM candidate`, task, old, next, actor, comment, date)
	return err
}

func restartTaskSLA(ctx context.Context, tx pgx.Tx, task string) error {
	_, err := tx.Exec(ctx, `WITH instant AS (SELECT clock_timestamp() occurred_at)
 INSERT INTO t_task_sla_states(task_id,status_id,entered_at,warning_at,breach_at)
 SELECT t.id,t.status_id,i.occurred_at,i.occurred_at+r.warning_minutes*interval '1 minute',i.occurred_at+r.breach_minutes*interval '1 minute'
 FROM t_order_tasks t CROSS JOIN instant i LEFT JOIN LATERAL(SELECT * FROM t_sla_rules r WHERE r.active AND (r.work_type_id IS NULL OR r.work_type_id=t.work_type_id) AND (r.status_id IS NULL OR r.status_id=t.status_id) ORDER BY ((r.work_type_id IS NOT NULL)::int+(r.status_id IS NOT NULL)::int) DESC,r.id LIMIT 1) r ON true WHERE t.id=$1
 ON CONFLICT(task_id) DO UPDATE SET status_id=excluded.status_id,entered_at=excluded.entered_at,warning_at=excluded.warning_at,breach_at=excluded.breach_at,warned_at=NULL,breached_at=NULL,updated_at=now()`, task)
	return err
}
