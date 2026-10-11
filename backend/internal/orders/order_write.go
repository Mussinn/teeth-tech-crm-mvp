package orders

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

type OrderUpdate struct {
	Deadline *string `json:"deadline"`
	Comment  *string `json:"comment"`
}

func (s *Service) WriteOrder(ctx context.Context, id string, r OrderUpdate, remove bool, actor identity.User) (any, error) {
	return s.writeOrder(ctx, id, r, remove, false, actor)
}
func (s *Service) DeactivateOrder(ctx context.Context, id string, actor identity.User) error {
	_, err := s.writeOrder(ctx, id, OrderUpdate{}, false, true, actor)
	return err
}
func (s *Service) writeOrder(ctx context.Context, id string, r OrderUpdate, remove, deactivate bool, actor identity.User) (result any, err error) {
	if !hasRole(actor, "ADMIN") && (remove || !hasRole(actor, "DISPATCHER")) {
		return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	if r.Deadline != nil {
		if _, e := time.Parse("2006-01-02", *r.Deadline); e != nil {
			return nil, dbx.Validation("Некорректный срок заказа")
		}
	}
	defer func() { err = dbx.Constraint(err) }()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return nil, err
	}
	if remove || deactivate {

		if s.warehouseEnabled {
			if err = warehouse.LockCreation(ctx, tx); err != nil {
				if errors.Is(err, warehouse.ErrInventoryLocked) {
					return nil, &identity.Failure{Status: 409, Code: "WHS_001", Message: "Склад заблокирован: идёт инвентаризация. Дождитесь её завершения."}
				}
				return nil, err
			}
		}

	}
	var order string
	err = tx.QueryRow(ctx, `SELECT id::text FROM t_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, id).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Заказ не найден")
	}
	if err != nil {
		return nil, err
	}
	// A dispatcher must be able to access every remaining task, and at least one.
	if !hasRole(actor, "ADMIN") {
		var allowed bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_user_work_directions d ON d.work_direction_id=t.work_direction_id AND d.user_id=$2 WHERE t.order_id=$1 AND t.deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM t_order_tasks t WHERE t.order_id=$1 AND t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM t_user_work_directions d WHERE d.user_id=$2 AND d.work_direction_id=t.work_direction_id))`, id, actor.ID).Scan(&allowed)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа ко всем направлениям заказа"}
		}
	}
	event := "ORDER_UPDATED"
	if remove || deactivate {
		if _, err = tx.Exec(ctx, `DELETE FROM t_stock_reserves WHERE order_id=$1`, id); err != nil {
			return nil, err
		}
		if _, err = tx.Exec(ctx, `UPDATE t_orders SET is_active=false,deleted_at=CASE WHEN $2 THEN now() ELSE deleted_at END,updated_at=now() WHERE id=$1`, id, remove); err != nil {
			return nil, err
		}
		if remove {
			event = "ORDER_DELETED"
		}
	} else {
		if _, err = tx.Exec(ctx, `UPDATE t_orders SET deadline=coalesce($2::date,deadline),comment=coalesce($3,comment),updated_at=now() WHERE id=$1`, id, r.Deadline, r.Comment); err != nil {
			return nil, err
		}
		result, err = orderResponse(ctx, tx, id)
		if err != nil {
			return nil, err
		}
	}
	payload, _ := json.Marshal(map[string]any{"eventType": event, "entityId": id, "statusCode": nil})
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER',$1,$2)`, id, string(payload)); err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
