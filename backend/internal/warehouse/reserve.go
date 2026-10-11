// Package warehouse contains transactional warehouse operations. Callers own
// the transaction and must roll it back on failure, including the new order.
package warehouse

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

// ErrInventoryLocked identifies the warehouse guard without matching message text.
var ErrInventoryLocked = dbx.Business("Склад заблокирован инвентаризацией")

// ReserveOrder snapshots the initial material plan of a newly created order.
// Use a Read Committed transaction, as Java does, so the availability query
// observes the previous holder's commit after the warehouse lock is acquired.
// This is not a replacement/release operation and cannot overwrite a plan.
func ReserveOrder(ctx context.Context, tx pgx.Tx, orderID string) error {
	return reserve(ctx, tx, orderID, "")
}

// LockCreation acquires the warehouse lock before any parent row/FK locks.
func LockCreation(ctx context.Context, tx pgx.Tx) error {
	var isolation string
	if err := tx.QueryRow(ctx, `SHOW transaction_isolation`).Scan(&isolation); err != nil {
		return err
	}
	if isolation != "read committed" {
		return dbx.Business("Резервирование требует транзакции Read Committed")
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(846321)`); err != nil {
		return err
	}
	var locked bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_inventory_check i JOIN public.t_inventory_status_rules s ON s.code=i.status WHERE s.locks_warehouse)`).Scan(&locked); err != nil {
		return err
	}
	if locked {
		return ErrInventoryLocked
	}
	return nil
}

// ReserveTask snapshots only a newly inserted task, preserving existing plans.
func ReserveTask(ctx context.Context, tx pgx.Tx, orderID, taskID string) error {
	if taskID == "" {
		return dbx.Validation("Не указана задача")
	}
	return reserve(ctx, tx, orderID, taskID)
}
func reserve(ctx context.Context, tx pgx.Tx, orderID, taskID string) error {
	if err := LockCreation(ctx, tx); err != nil {
		return err
	}
	var id string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM public.t_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, orderID).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dbx.Missing("Заказ не найден")
		}
		return err
	}
	if taskID != "" {
		var found string
		err := tx.QueryRow(ctx, `SELECT id::text FROM public.t_order_tasks WHERE id=$1 AND order_id=$2 AND deleted_at IS NULL FOR UPDATE`, taskID, orderID).Scan(&found)
		if errors.Is(err, pgx.ErrNoRows) {
			return dbx.Missing("Задача не найдена в заказе")
		}
		if err != nil {
			return err
		}
	}
	var invalid bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_order_tasks t WHERE t.order_id=$1 AND ($2='' OR t.id=NULLIF($2,'')::uuid) AND t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.t_order_task_materials m WHERE m.order_task_id=t.id))`, orderID, taskID).Scan(&invalid); err != nil {
		return err
	}
	if invalid {
		return dbx.Business("У производственной задачи не выбраны материалы")
	}
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_stock_reserves WHERE order_id=$1 AND ($2='' OR order_task_id=NULLIF($2,'')::uuid)) OR EXISTS(SELECT 1 FROM public.t_task_material_plan p JOIN public.t_order_tasks t ON t.id=p.order_task_id WHERE t.order_id=$1 AND ($2='' OR t.id=NULLIF($2,'')::uuid))`, orderID, taskID).Scan(&invalid); err != nil {
		return err
	}
	if invalid {
		return dbx.Business("Материальный план или резерв заказа уже существует")
	}
	// Norm.deleted_at is intentionally not used: Java's norm entity extends
	// BaseEntity, not SoftDeleteBaseEntity, and reads these rows too.
	rows, err := tx.Query(ctx, `WITH components AS (
 SELECT t.id task_id,m.nomenclature_id fallback,n.nomenclature_id component,
 CASE WHEN n.id IS NULL THEN t.quantity::numeric ELSE n.norm_quantity*t.quantity END standard,
 CASE WHEN n.id IS NULL THEN 0 ELSE round(n.norm_quantity*t.quantity*n.waste_percent/100,4) END waste
 FROM public.t_order_tasks t JOIN public.t_order_task_materials tm ON tm.order_task_id=t.id
 JOIN public.t_materials m ON m.id=tm.material_id
 LEFT JOIN public.t_nomenclature_consumption_norms n ON n.material_id=m.id AND n.work_type_id=t.work_type_id
 WHERE t.order_id=$1 AND ($2='' OR t.id=NULLIF($2,'')::uuid) AND t.deleted_at IS NULL)
 SELECT task_id::text,coalesce(component,fallback)::text,sum(standard)::text,sum(waste)::text
 FROM components WHERE coalesce(component,fallback) IS NOT NULL GROUP BY task_id,coalesce(component,fallback)
 ORDER BY coalesce(component,fallback),task_id`, orderID, taskID)
	if err != nil {
		return err
	}
	type component struct{ task, nomenclature, standard, waste string }
	items := []component{}
	for rows.Next() {
		var item component
		if err = rows.Scan(&item.task, &item.nomenclature, &item.standard, &item.waste); err != nil {
			rows.Close()
			return err
		}
		items = append(items, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, item := range items {
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_stock_balance(nomenclature_id,quantity) VALUES($1,0) ON CONFLICT(nomenclature_id) DO NOTHING`, item.nomenclature); err != nil {
			return dbx.Constraint(err)
		}
		var balance string
		if err = tx.QueryRow(ctx, `SELECT quantity::text FROM public.t_stock_balance WHERE nomenclature_id=$1 FOR UPDATE`, item.nomenclature).Scan(&balance); err != nil {
			return err
		}
		var available bool
		if err = tx.QueryRow(ctx, `SELECT $2::numeric-coalesce(sum(reserved_quantity),0)>=$3::numeric+$4::numeric FROM public.t_stock_reserves WHERE nomenclature_id=$1`, item.nomenclature, balance, item.standard, item.waste).Scan(&available); err != nil {
			return err
		}
		if !available {
			return dbx.Business("Недостаточно свободного остатка номенклатуры " + item.nomenclature)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_stock_reserves(order_id,order_task_id,nomenclature_id,standard_quantity,waste_quantity,reserved_quantity) VALUES($1,$2,$3,$4::numeric,$5::numeric,$4::numeric+$5::numeric)`, orderID, item.task, item.nomenclature, item.standard, item.waste); err != nil {
			return dbx.Constraint(err)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_task_material_plan(order_task_id,nomenclature_id,standard_quantity,waste_quantity,planned_quantity) VALUES($1,$2,$3::numeric,$4::numeric,$3::numeric+$4::numeric)`, item.task, item.nomenclature, item.standard, item.waste); err != nil {
			return dbx.Constraint(err)
		}
	}
	return nil
}
