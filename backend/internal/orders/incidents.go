package orders

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/pagination"
)

type IncidentRequest struct {
	IncidentType          string       `json:"incidentType"`
	ReasonCode            string       `json:"reasonCode"`
	Description           string       `json:"description"`
	AssignedTo            *string      `json:"assignedTo"`
	MaterialLossAmount    *json.Number `json:"materialLossAmount"`
	SalaryDeductionAmount *json.Number `json:"salaryDeductionAmount"`
}

const incidentProjection = `jsonb_build_object('id',i.id,'taskId',i.task_id,'incidentType',i.incident_type,'status',i.status,'reasonCode',i.reason_code,'description',i.description,'reportedBy',i.reported_by,'assignedTo',i.assigned_to,'materialLossAmount',i.material_loss_amount,'salaryDeductionAmount',i.salary_deduction_amount,'createdAt',i.created_at,'resolvedAt',i.resolved_at,'resolutionComment',i.resolution_comment)`

func incidentJSON(raw json.RawMessage) (json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, err
	}
	for _, field := range []string{"createdAt", "resolvedAt"} {
		if string(fields[field]) == "null" {
			continue
		}
		var timestamp time.Time
		if err := json.Unmarshal(fields[field], &timestamp); err != nil {
			return nil, err
		}
		fields[field], _ = json.Marshal(timestamp.UTC())
	}
	return json.Marshal(fields)
}

// Quality operations share the task mutation lock order so a task cannot be
// reassigned/deleted while an incident is created or resolved against it.
func lockIncidentTask(ctx context.Context, tx pgx.Tx, task string, actor identity.User) (*string, error) {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(846321)`); err != nil {
		return nil, err
	}
	if err := requireTaskAccess(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	var order string
	err := tx.QueryRow(ctx, `SELECT o.id::text FROM t_orders o JOIN t_order_tasks t ON t.order_id=o.id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL FOR UPDATE OF o`, task).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Задача или её заказ не найдены")
	}
	if err != nil {
		return nil, err
	}
	var technician *string
	err = tx.QueryRow(ctx, `SELECT dental_technician_id::text FROM t_order_tasks WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, task).Scan(&technician)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return nil, err
	}
	return technician, requireTaskAccess(ctx, tx, task, actor)
}

func (s *Service) CreateIncident(ctx context.Context, task string, r IncidentRequest, actor identity.User) (result json.RawMessage, err error) {
	if !createUUID.MatchString(task) || (r.AssignedTo != nil && !createUUID.MatchString(*r.AssignedTo)) || strings.TrimSpace(r.IncidentType) == "" || strings.TrimSpace(r.ReasonCode) == "" || strings.TrimSpace(r.Description) == "" {
		return nil, dbx.Validation("Некорректный UUID или пустые тип, причина, описание инцидента")
	}
	if !s.financeEnabled {
		r.MaterialLossAmount = nil
		r.SalaryDeductionAmount = nil
	}
	defer func() { err = dbx.Constraint(err) }()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	recipient, err := lockIncidentTask(ctx, tx, task, actor)
	if err != nil {
		return nil, err
	}
	if r.AssignedTo != nil {
		recipient = r.AssignedTo
	}
	if recipient != nil {
		var id string
		err = tx.QueryRow(ctx, `SELECT id::text FROM t_users WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, *recipient).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, dbx.Missing("Сотрудник не найден")
		}
		if err != nil {
			return nil, err
		}
	}
	number := func(n *json.Number) any {
		if n == nil {
			return nil
		}
		return string(*n)
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO t_quality_incidents(task_id,reported_by,assigned_to,incident_type,reason_code,description,material_loss_amount,salary_deduction_amount) VALUES($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric) RETURNING id::text`, task, actor.ID, r.AssignedTo, strings.ToUpper(strings.TrimSpace(r.IncidentType)), strings.ToUpper(strings.TrimSpace(r.ReasonCode)), r.Description, number(r.MaterialLossAmount), number(r.SalaryDeductionAmount)).Scan(&id)
	if err != nil {
		return nil, err
	}
	if recipient != nil {
		if err = notifyRework(ctx, tx, task, *recipient, r.Description); err != nil {
			return nil, err
		}
	}
	raw, err := dbx.One(ctx, tx, `SELECT `+incidentProjection+` FROM t_quality_incidents i WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	result, err = incidentJSON(raw)
	if err != nil {
		return nil, err
	}
	// Java returns input BigDecimals on creation, before a later read observes
	// the database's two-place rounding. Preserve that response contract.
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(result, &fields); err != nil {
		return nil, err
	}
	fields["materialLossAmount"], _ = json.Marshal(r.MaterialLossAmount)
	fields["salaryDeductionAmount"], _ = json.Marshal(r.SalaryDeductionAmount)
	result, err = json.Marshal(fields)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

func (s *Service) Incidents(ctx context.Context, task string, actor identity.User, p pagination.Page) (any, error) {
	if !createUUID.MatchString(task) {
		return nil, dbx.Validation("Некорректный taskId")
	}
	order, err := p.Order(map[string]string{"id": "i.id", "incidentType": "i.incident_type", "status": "i.status", "reasonCode": "i.reason_code", "description": "i.description", "createdAt": "i.created_at", "resolvedAt": "i.resolved_at", "resolutionComment": "i.resolution_comment", "materialLossAmount": "i.material_loss_amount", "salaryDeductionAmount": "i.salary_deduction_amount"}, "i.id")
	if err != nil {
		return nil, dbx.Business("Неподдерживаемое поле сортировки инцидентов")
	}
	// Spring's derived OrderByCreatedAtDesc precedes the pageable sort.
	order = " ORDER BY i.created_at DESC," + strings.TrimPrefix(order, " ORDER BY ")
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireTaskAccess(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL)`, task).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, dbx.Missing("Задача или её заказ не найдены")
	}
	var total int64
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM t_quality_incidents WHERE task_id=$1`, task).Scan(&total); err != nil {
		return nil, err
	}
	items, err := dbx.List(ctx, tx, `SELECT `+incidentProjection+` FROM t_quality_incidents i WHERE task_id=$1`+order+` LIMIT $2 OFFSET $3`, task, p.Size, p.Offset())
	if err != nil {
		return nil, err
	}
	for index, raw := range items {
		items[index], err = incidentJSON(raw)
		if err != nil {
			return nil, err
		}
	}
	result := p.Slice(items).(map[string]any)
	pages := (total + int64(p.Size) - 1) / int64(p.Size)
	result["totalElements"], result["totalPages"] = total, pages
	result["last"] = int64(p.Number)+1 >= pages
	return result, tx.Commit(ctx)
}

func (s *Service) ResolveIncident(ctx context.Context, task, id, comment string, actor identity.User) (result json.RawMessage, err error) {
	if !createUUID.MatchString(task) || !createUUID.MatchString(id) || strings.TrimSpace(comment) == "" {
		return nil, dbx.Validation("Нужны UUID задачи, инцидента и комментарий решения")
	}
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "CHIEF_TECHNICIAN") && !hasRole(actor, "DISPATCHER") {
		return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	defer func() { err = dbx.Constraint(err) }()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = lockIncidentTask(ctx, tx, task, actor); err != nil {
		return nil, err
	}
	raw, err := dbx.One(ctx, tx, `UPDATE t_quality_incidents i SET status='RESOLVED',resolved_at=clock_timestamp(),resolution_comment=$3 WHERE id=$1 AND task_id=$2 RETURNING `+incidentProjection, id, task, comment)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Инцидент качества не найден в задаче")
	}
	if err != nil {
		return nil, err
	}
	result, err = incidentJSON(raw)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
