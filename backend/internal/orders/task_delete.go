package orders

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

// DeleteTask retains the task and its history, releasing only unconsumed plans.
func (s *Service) DeleteTask(ctx context.Context, id string, actor identity.User) (err error) {
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "DISPATCHER") {
		return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return err
	}
	if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
		return err
	}

	if s.warehouseEnabled {
		if err = warehouse.LockCreation(ctx, tx); err != nil {
			if errors.Is(err, warehouse.ErrInventoryLocked) {
				return &identity.Failure{Status: 409, Code: "WHS_001", Message: "Склад заблокирован: идёт инвентаризация. Дождитесь её завершения."}
			}
			return err
		}
	}

	var order string
	err = tx.QueryRow(ctx, `SELECT order_id::text FROM t_order_tasks WHERE id=$1 AND deleted_at IS NULL`, id).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return err
	}
	var parent string
	err = tx.QueryRow(ctx, `SELECT id::text FROM t_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, order).Scan(&parent)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Заказ не найден")
	}
	if err != nil {
		return err
	}
	var finalized bool
	var status string
	err = tx.QueryRow(ctx, `SELECT t.materials_finalized_at IS NOT NULL,s.code FROM t_order_tasks t JOIN t_order_statuses s ON s.id=t.status_id WHERE t.id=$1 AND t.deleted_at IS NULL FOR UPDATE OF t`, id).Scan(&finalized, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return err
	}
	if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
		return err
	}
	var used bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_task_stage_material_usage WHERE order_task_id=$1)`, id).Scan(&used); err != nil {
		return err
	}
	if finalized || used {
		return dbx.Business("Нельзя удалить задачу после учёта расхода или финализации материалов")
	}
	if _, err = tx.Exec(ctx, `DELETE FROM t_stock_reserves WHERE order_task_id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM t_task_material_plan WHERE order_task_id=$1`, id); err != nil {
		return err
	}
	if err = invalidateLabQuality(ctx, tx, order, actor.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_tasks SET deleted_at=now(),updated_at=now() WHERE id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_orders SET total_amount=(SELECT coalesce(sum(price_per_unit*quantity*(1-round(discount_percent/100,4))),0) FROM t_order_tasks WHERE order_id=$1 AND deleted_at IS NULL),updated_at=now() WHERE id=$1`, order); err != nil {
		return err
	}
	payload, _ := json.Marshal(map[string]any{"eventType": "TASK_DELETED", "entityId": id, "statusCode": status})
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,$2)`, id, string(payload)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
