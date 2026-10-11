package orders

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

type TaskUpdate struct {
	Direction *string           `json:"workDirectionId"`
	WorkType  *string           `json:"workTypeId"`
	Quantity  *int32            `json:"quantity"`
	Color     *string           `json:"colorId"`
	Materials []string          `json:"materialIds"`
	Price     *json.Number      `json:"pricePerUnit"`
	Discount  *json.Number      `json:"discountPercent"`
	Teeth     []int             `json:"toothNumbers"`
	Mode      *string           `json:"assignmentMode"`
	Assignees []*AssigneeUpdate `json:"statusAssignees"`
}

func (r TaskUpdate) validate() error {
	for _, id := range []*string{r.Direction, r.WorkType, r.Color} {
		if id != nil && !createUUID.MatchString(*id) {
			return dbx.Validation("Некорректный UUID")
		}
	}
	if r.Quantity != nil && *r.Quantity < 1 {
		return dbx.Validation("Количество должно быть положительным")
	}
	if r.Price != nil && !validAmount(*r.Price, "99999999.99") || r.Discount != nil && !validAmount(*r.Discount, "100") {
		return dbx.Validation("Некорректная цена или скидка")
	}
	if r.Mode != nil && *r.Mode != "AUTO" && *r.Mode != "PREASSIGNED" {
		return dbx.Validation("Некорректный режим назначения")
	}
	if r.Materials != nil && len(r.Materials) == 0 {
		return dbx.Validation("Выберите хотя бы один материал")
	}
	seen := map[string]bool{}
	for _, id := range r.Materials {
		key := strings.ToLower(id)
		if !createUUID.MatchString(id) || seen[key] {
			return dbx.Validation("Некорректный или повторяющийся материал")
		}
		seen[key] = true
	}
	teeth := map[int]bool{}
	for _, n := range r.Teeth {
		if n/10 < 1 || n/10 > 4 || n%10 < 1 || n%10 > 8 || teeth[n] {
			return dbx.Validation("Некорректный или повторяющийся номер зуба")
		}
		teeth[n] = true
	}
	for _, a := range r.Assignees {
		if a == nil || !createUUID.MatchString(a.StatusID) || !createUUID.MatchString(a.UserID) {
			return dbx.Validation("Некорректное назначение")
		}
	}
	return nil
}
func (s *Service) UpdateTask(ctx context.Context, id string, r TaskUpdate, actor identity.User) error {
	return s.updateTask(ctx, id, r, actor, false)
}

func (s *Service) UpdateMaterials(ctx context.Context, id string, materials []string, actor identity.User) error {
	if len(materials) == 0 {
		return dbx.Validation("Выберите хотя бы один материал")
	}
	return s.updateTask(ctx, id, TaskUpdate{Materials: materials}, actor, true)
}

func (s *Service) updateTask(ctx context.Context, id string, r TaskUpdate, actor identity.User, materialsOnly bool) (err error) {
	if !materialsOnly && !hasRole(actor, "ADMIN") && !hasRole(actor, "DISPATCHER") {
		return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	if err = r.validate(); err != nil {
		return err
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
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return err
	}
	if materialsOnly {
		if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
			return err
		}
	}
	// Inventory blocks stock changes, but must not prevent price-only edits.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(846321)`); err != nil {
		return err
	}
	var order string
	err = tx.QueryRow(ctx, `SELECT order_id::text FROM t_order_tasks WHERE id=$1 AND deleted_at IS NULL`, id).Scan(&order)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return err
	}
	var lockedOrder string
	err = tx.QueryRow(ctx, `SELECT id::text FROM t_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, order).Scan(&lockedOrder)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Заказ не найден")
	}
	if err != nil {
		return err
	}
	var wt, dir *string
	var qty int32
	var mode, status string
	var finalized bool
	err = tx.QueryRow(ctx, `SELECT t.work_type_id::text,t.work_direction_id::text,t.quantity,t.assignment_mode,s.code,t.materials_finalized_at IS NOT NULL FROM t_order_tasks t JOIN t_order_statuses s ON s.id=t.status_id WHERE t.id=$1 AND t.deleted_at IS NULL FOR UPDATE OF t`, id).Scan(&wt, &dir, &qty, &mode, &status, &finalized)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Задача не найдена")
	}
	if err != nil {
		return err
	}
	if materialsOnly {
		if err = requireTaskAccess(ctx, tx, id, actor); err != nil {
			return err
		}
	} else if !hasRole(actor, "ADMIN") {
		for _, direction := range []*string{dir, r.Direction} {
			if direction == nil {
				continue
			}
			var allowed bool
			if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_user_work_directions WHERE user_id=$1 AND work_direction_id=$2)`, actor.ID, *direction).Scan(&allowed); err != nil {
				return err
			}
			if !allowed {
				return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа к направлению работ"}
			}
		}
	}
	for _, d := range []struct {
		id    *string
		table string
	}{{r.WorkType, "t_work_types"}, {r.Direction, "t_work_directions"}, {r.Color, "t_colors"}} {
		if d.id == nil {
			continue
		}
		var found string
		err = tx.QueryRow(ctx, `SELECT id::text FROM `+d.table+` WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, *d.id).Scan(&found)
		if errors.Is(err, pgx.ErrNoRows) {
			return dbx.Missing("Справочник не найден")
		}
		if err != nil {
			return err
		}
	}
	typeChanged := r.WorkType != nil && (wt == nil || !strings.EqualFold(*wt, *r.WorkType))
	reserveChanged := typeChanged || r.Quantity != nil && qty != *r.Quantity
	if r.Materials != nil {
		rows, e := tx.Query(ctx, `SELECT material_id::text FROM t_order_task_materials WHERE order_task_id=$1 ORDER BY material_id`, id)
		if e != nil {
			return e
		}
		old, e := pgx.CollectRows(rows, pgx.RowTo[string])
		if e != nil {
			return e
		}
		current := make([]string, len(r.Materials))
		for i, m := range r.Materials {
			current[i] = strings.ToLower(m)
			var found string
			err = tx.QueryRow(ctx, `SELECT id::text FROM t_materials WHERE id=$1 AND is_active AND deleted_at IS NULL FOR SHARE`, m).Scan(&found)
			if errors.Is(err, pgx.ErrNoRows) {
				return dbx.Missing("Материал не найден")
			}
			if err != nil {
				return err
			}
		}
		slices.Sort(current)
		reserveChanged = reserveChanged || !slices.Equal(old, current)
	}
	if reserveChanged || materialsOnly {
		var used bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_task_stage_material_usage WHERE order_task_id=$1)`, id).Scan(&used); err != nil {
			return err
		}
		if used || finalized {
			return dbx.Business("Нельзя менять вид работы, материалы или количество после учёта расхода")
		}
	}
	if materialsOnly && !reserveChanged {
		return tx.Commit(ctx)
	}
	var price, discount *string
	if r.Price != nil {
		v := string(*r.Price)
		price = &v
	}
	if r.Discount != nil {
		v := string(*r.Discount)
		discount = &v
	}
	if err = invalidateLabQuality(ctx, tx, order, actor.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_tasks SET work_type_id=coalesce($2::uuid,work_type_id),work_direction_id=coalesce($3::uuid,work_direction_id),color_id=coalesce($4::uuid,color_id),quantity=coalesce($5,quantity),price_per_unit=coalesce($6::numeric,price_per_unit),discount_percent=coalesce($7::numeric,discount_percent),updated_at=now() WHERE id=$1`, id, r.WorkType, r.Direction, r.Color, r.Quantity, price, discount); err != nil {
		return err
	}
	if r.Materials != nil {
		if _, err = tx.Exec(ctx, `DELETE FROM t_order_task_materials WHERE order_task_id=$1`, id); err != nil {
			return err
		}
		for _, m := range r.Materials {
			if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_materials(order_task_id,material_id) VALUES($1,$2)`, id, m); err != nil {
				return err
			}
		}
	}
	if r.Teeth != nil {
		if _, err = tx.Exec(ctx, `DELETE FROM t_order_task_teeth WHERE order_task_id=$1`, id); err != nil {
			return err
		}
		for _, n := range r.Teeth {
			if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_teeth(order_task_id,tooth_number) VALUES($1,$2)`, id, n); err != nil {
				return err
			}
		}
	}
	if r.Mode != nil || r.Assignees != nil || typeChanged {
		if r.WorkType != nil {
			wt = r.WorkType
		}
		if r.Mode != nil {
			mode = *r.Mode
		} else if r.Assignees == nil && typeChanged {
			mode = "AUTO"
		}
		if _, err = tx.Exec(ctx, `DELETE FROM t_order_task_status_assignees WHERE order_task_id=$1`, id); err != nil {
			return err
		}
		workType := ""
		if wt != nil {
			workType = *wt
		}
		if mode == "PREASSIGNED" && workType == "" {
			return dbx.Business("Для плана требуется вид работы")
		}
		if err = applyAssignmentPlan(ctx, tx, id, workType, AssignmentUpdate{Mode: mode, Assignees: r.Assignees}); err != nil {
			return err
		}
	}
	if reserveChanged {
		if _, err = tx.Exec(ctx, `DELETE FROM t_stock_reserves WHERE order_task_id=$1`, id); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `DELETE FROM t_task_material_plan WHERE order_task_id=$1`, id); err != nil {
			return err
		}

		if s.warehouseEnabled {
			if err = warehouse.ReserveTask(ctx, tx, order, id); err != nil {
				if materialsOnly && errors.Is(err, warehouse.ErrInventoryLocked) {
					return &identity.Failure{Status: 409, Code: "WHS_001", Message: "Склад заблокирован: идёт инвентаризация. Дождитесь её завершения."}
				}
				return err
			}
		}

	}
	if !materialsOnly {
		if _, err = tx.Exec(ctx, `UPDATE t_orders SET total_amount=(SELECT coalesce(sum(price_per_unit*quantity*(1-round(discount_percent/100,4))),0) FROM t_order_tasks WHERE order_id=$1 AND deleted_at IS NULL),updated_at=now() WHERE id=$1`, order); err != nil {
			return err
		}
	}
	payload, _ := json.Marshal(map[string]any{"eventType": "TASK_UPDATED", "entityId": id, "statusCode": status})
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER_TASK',$1,$2)`, id, string(payload)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
