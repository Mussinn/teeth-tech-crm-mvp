package orders

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

func (s *Service) CreateTask(ctx context.Context, r CreateTask, actor identity.User) (result string, err error) {
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "DISPATCHER") {
		return "", &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	if !createUUID.MatchString(r.OrderID) {
		return "", dbx.Validation("Некорректный orderId")
	}
	if err = r.validate(); err != nil {
		return "", err
	}
	defer func() {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "22003" {
			err = dbx.Validation("Сумма превышает допустимый размер")
		} else {
			err = dbx.Constraint(err)
		}
	}()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return "", err
	}

	if s.warehouseEnabled {
		if err = warehouse.LockCreation(ctx, tx); err != nil {
			return "", err
		}
	}

	var order string
	err = tx.QueryRow(ctx, `SELECT id::text FROM t_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, r.OrderID).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", dbx.Missing("Заказ не найден")
	}
	if err != nil {
		return "", err
	}
	if err = invalidateLabQuality(ctx, tx, order, actor.ID); err != nil {
		return "", err
	}
	task, _, err := insertTask(ctx, tx, order, &r, actor)
	if err != nil {
		return "", err
	}

	if s.warehouseEnabled {
		if err = warehouse.ReserveTask(ctx, tx, order, task); err != nil {
			return "", err
		}
	}

	// Recompute from persisted decimal values; exclude soft-deleted tasks.
	if _, err = tx.Exec(ctx, `UPDATE t_orders SET is_active=true,completed_at=NULL,total_amount=(SELECT coalesce(sum(price_per_unit*quantity*(1-round(discount_percent/100,4))),0) FROM t_order_tasks WHERE order_id=$1 AND deleted_at IS NULL),updated_at=now() WHERE id=$1`, order); err != nil {
		return "", err
	}
	var status string
	if err = tx.QueryRow(ctx, `SELECT s.code FROM t_order_tasks t JOIN t_order_statuses s ON s.id=t.status_id WHERE t.id=$1`, task).Scan(&status); err != nil {
		return "", err
	}
	payload, _ := json.Marshal(map[string]any{"eventType": "TASK_CREATED", "entityId": task, "statusCode": status})
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,$2)`, task, string(payload)); err != nil {
		return "", err
	}
	return task, tx.Commit(ctx)
}
