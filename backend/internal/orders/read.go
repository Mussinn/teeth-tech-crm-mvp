package orders

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

func (s *Service) ReadOrder(ctx context.Context, id string, actor identity.User) (any, error) {
	tx, e := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	var exists bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_orders WHERE id=$1 AND deleted_at IS NULL)`, id).Scan(&exists); e != nil {
		return nil, e
	}
	if !exists {
		return nil, dbx.Missing("Заказ не найден")
	}
	if hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN") {
		var allowed bool
		if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_user_work_directions d ON d.work_direction_id=t.work_direction_id AND d.user_id=$2 WHERE t.order_id=$1 AND t.deleted_at IS NULL)`, id, actor.ID).Scan(&allowed); e != nil {
			return nil, e
		}
		if !allowed {
			return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
		}
	}
	result, e := orderResponse(ctx, tx, id, actor)
	if errors.Is(e, pgx.ErrNoRows) {
		return nil, dbx.Missing("Заказ не найден")
	}
	if e != nil {
		return nil, e
	}
	return result, tx.Commit(ctx)
}
