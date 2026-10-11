package warehouse

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

// StageUsage preserves decimal input until PostgreSQL performs exact arithmetic.
type StageUsage struct {
	NomenclatureID string      `json:"nomenclatureId"`
	Issued         json.Number `json:"issuedQuantity"`
	Consumed       json.Number `json:"consumedQuantity"`
	Waste          json.Number `json:"wasteQuantity"`
	Returned       json.Number `json:"returnedQuantity"`
	Note           *string     `json:"note"`
}

var materialUUID = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var quantityNumber = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]{1,3})?$`)

func validQuantity(n json.Number, positive bool) bool {
	s := string(n)
	if len(s) > 100 || !quantityNumber.MatchString(s) {
		return false
	}
	mantissa, exponent := s, 0
	if i := strings.IndexAny(s, "eE"); i >= 0 {
		mantissa = s[:i]
		exponent, _ = strconv.Atoi(s[i+1:])
	}
	scale := 0
	if i := strings.IndexByte(mantissa, '.'); i >= 0 {
		scale = len(mantissa) - i - 1
	}
	if scale-exponent > 4 {
		return false
	}
	value, ok := new(big.Rat).SetString(s)
	if !ok || value.Sign() < 0 || value.Cmp(big.NewRat(1000000000000000, 1)) >= 0 {
		return false
	}
	return !positive || value.Cmp(big.NewRat(1, 10000)) >= 0
}

// ValidateStageUsages matches the HTTP bean validation; conservation and recipe
// restrictions are business checks inside the caller's transaction.
func ValidateStageUsages(inputs []*StageUsage) error {
	for _, v := range inputs {
		if v == nil || !materialUUID.MatchString(v.NomenclatureID) || !validQuantity(v.Issued, true) || !validQuantity(v.Consumed, false) || !validQuantity(v.Waste, false) || !validQuantity(v.Returned, false) {
			return dbx.Validation("Отчёт по материалам требует UUID и неотрицательные количества с точностью до 4 знаков; выданное количество должно быть положительным")
		}
	}
	return nil
}

// lockMaterialTask must precede all order/task/stock row locks. Callers must use
// Read Committed and roll back the WHOLE transaction on any returned error.
// Acquiring the lock alone does not reject an empty report during inventory.
func lockMaterialTask(ctx context.Context, tx pgx.Tx, taskID string) (bool, error) {
	if !materialUUID.MatchString(taskID) {
		return false, dbx.Validation("Некорректный taskId")
	}
	var isolation string
	if err := tx.QueryRow(ctx, `SHOW transaction_isolation`).Scan(&isolation); err != nil {
		return false, err
	}
	if isolation != "read committed" {
		return false, dbx.Business("Материальные операции требуют транзакции Read Committed")
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(846321)`); err != nil {
		return false, err
	}
	var orderID string
	err := tx.QueryRow(ctx, `SELECT o.id::text FROM t_orders o JOIN t_order_tasks t ON t.order_id=o.id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL FOR UPDATE OF o`, taskID).Scan(&orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, dbx.Missing("Задача или её заказ не найдены")
	}
	if err != nil {
		return false, err
	}
	var finalized bool
	err = tx.QueryRow(ctx, `SELECT materials_finalized_at IS NOT NULL FROM t_order_tasks WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, taskID).Scan(&finalized)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, dbx.Missing("Задача не найдена")
	}
	return finalized, err
}

// RecordStageUsage declares consumption without changing stock or reserves.
// It is a building block, not a status transition: the caller authorizes the
// actor, validates the workflow edge and changes status in this same transaction.
func RecordStageUsage(ctx context.Context, tx pgx.Tx, taskID, stepID, actorID, reportID string, inputs []*StageUsage) (err error) {
	if err = ValidateStageUsages(inputs); err != nil {
		return err
	}
	if !materialUUID.MatchString(stepID) || !materialUUID.MatchString(actorID) || (reportID != "" && !materialUUID.MatchString(reportID)) {
		return dbx.Validation("Некорректный UUID отчёта")
	}
	finalized, err := lockMaterialTask(ctx, tx, taskID)
	if err != nil {
		return err
	}
	if finalized {
		if len(inputs) > 0 {
			return dbx.Business("Материальные расходы задачи уже окончательно зафиксированы")
		}
		return nil
	}
	var required, unplanned bool
	err = tx.QueryRow(ctx, `SELECT w.material_report_required,w.allow_unplanned_materials FROM t_workflow_steps w JOIN t_order_tasks t ON t.work_type_id=w.work_type_id AND t.status_id=w.from_status_id WHERE w.id=$1 AND t.id=$2 AND w.deleted_at IS NULL`, stepID, taskID).Scan(&required, &unplanned)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Business("Шаг не соответствует текущему этапу задачи")
	}
	if err != nil {
		return err
	}
	if required && len(inputs) == 0 {
		return dbx.Business("Для перехода на следующий этап обязателен отчёт по материалам")
	}
	if len(inputs) == 0 {
		return nil
	}
	if err = LockCreation(ctx, tx); err != nil {
		return err
	}
	if reportID == "" {
		if err = tx.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&reportID); err != nil {
			return err
		}
	}
	var existingTask, existingStep string
	err = tx.QueryRow(ctx, `SELECT order_task_id::text,workflow_step_id::text FROM t_task_stage_material_usage WHERE report_id=$1 LIMIT 1`, reportID).Scan(&existingTask, &existingStep)
	if err == nil {
		if !strings.EqualFold(existingTask, taskID) || !strings.EqualFold(existingStep, stepID) {
			return dbx.Business("materialReportId уже использован для другой операции")
		}
		return nil // Java-compatible replay of a report for the same task and step.
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	seen := map[string]bool{}
	for _, v := range inputs {
		id := strings.ToLower(v.NomenclatureID)
		if seen[id] {
			return dbx.Business("Одна номенклатура не должна повторяться в отчёте этапа")
		}
		seen[id] = true
		var conserved bool
		if err = tx.QueryRow(ctx, `SELECT $1::numeric=$2::numeric+$3::numeric+$4::numeric`, string(v.Issued), string(v.Consumed), string(v.Waste), string(v.Returned)).Scan(&conserved); err != nil {
			return err
		}
		if !conserved {
			return dbx.Business("Выданное количество должно равняться использованному + потерям + возврату")
		}
		var active bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_nomenclature WHERE id=$1 AND active AND deleted_at IS NULL)`, id).Scan(&active); err != nil {
			return err
		}
		if !active {
			return dbx.Missing("Номенклатура не найдена")
		}
		if _, err = tx.Exec(ctx, `INSERT INTO t_stock_balance(nomenclature_id,quantity) VALUES($1,0) ON CONFLICT(nomenclature_id) DO NOTHING`, id); err != nil {
			return err
		}
		var physical string
		if err = tx.QueryRow(ctx, `SELECT quantity::text FROM t_stock_balance WHERE nomenclature_id=$1 FOR UPDATE`, id).Scan(&physical); err != nil {
			return err
		}
		var planned, enough, withinReserve bool
		err = tx.QueryRow(ctx, `WITH r AS (SELECT reserved_quantity FROM t_stock_reserves WHERE order_task_id=$1 AND nomenclature_id=$2), fact AS (SELECT coalesce(sum(consumed_quantity+waste_quantity),0)+$3::numeric+$4::numeric total FROM t_task_stage_material_usage WHERE order_task_id=$1 AND nomenclature_id=$2)
  SELECT EXISTS(SELECT 1 FROM r),fact.total<=coalesce((SELECT reserved_quantity FROM r),0)+greatest($5::numeric-(SELECT coalesce(sum(reserved_quantity),0) FROM t_stock_reserves WHERE nomenclature_id=$2),0),fact.total<=coalesce((SELECT reserved_quantity FROM r),0) FROM fact`, taskID, id, string(v.Consumed), string(v.Waste), physical).Scan(&planned, &enough, &withinReserve)
		if err != nil {
			return err
		}
		if !unplanned && !planned {
			return dbx.Business("Материал отсутствует в рецепте задачи, а внеплановый расход запрещён")
		}
		if !enough {
			return dbx.Business("Недостаточно материала с учётом резервов других заказов")
		}
		if !unplanned && !withinReserve {
			return dbx.Business("Фактический расход превышает резерв задачи. Перерасход запрещён настройкой этапа")
		}
		_, err = tx.Exec(ctx, `INSERT INTO t_task_stage_material_usage(report_id,order_task_id,workflow_step_id,from_status_id,to_status_id,nomenclature_id,actor_id,issued_quantity,consumed_quantity,waste_quantity,returned_quantity,note) SELECT $1,$2,w.id,w.from_status_id,w.to_status_id,$4,$5,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10 FROM t_workflow_steps w WHERE w.id=$3`, reportID, taskID, stepID, id, actorID, string(v.Issued), string(v.Consumed), string(v.Waste), string(v.Returned), v.Note)
		if err != nil {
			return dbx.Constraint(err)
		}
	}
	return nil
}

// FinalizeTaskMaterials freezes actual consumption, or the immutable plan when
// no declarations exist. It does not change task/order status or issue events.
func FinalizeTaskMaterials(ctx context.Context, tx pgx.Tx, taskID string) (err error) {
	finalized, err := lockMaterialTask(ctx, tx, taskID)
	if err != nil || finalized {
		return err
	}
	if err = LockCreation(ctx, tx); err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `WITH actual AS (SELECT nomenclature_id,sum(consumed_quantity) standard,sum(waste_quantity) waste FROM t_task_stage_material_usage WHERE order_task_id=$1 GROUP BY nomenclature_id),totals AS (
 SELECT * FROM actual UNION ALL SELECT nomenclature_id,standard_quantity,waste_quantity FROM t_task_material_plan WHERE order_task_id=$1 AND NOT EXISTS(SELECT 1 FROM actual)
 ),remaining AS (SELECT t.*,coalesce((SELECT sum(m.quantity) FROM t_stock_movement m JOIN t_stock_movement_types mt ON mt.code=m.movement_type AND mt.decreases_stock WHERE m.nomenclature_id=t.nomenclature_id AND m.reference_type='ORDER_STAGE_USAGE' AND m.reference_id IN(SELECT id FROM t_task_stage_material_usage WHERE order_task_id=$1 AND nomenclature_id=t.nomenclature_id)),0) written FROM totals t)
 SELECT nomenclature_id::text,(standard+waste-written)::text,greatest(standard-written,0)::text,(standard+waste-written-greatest(standard-written,0))::text,standard+waste<written,standard+waste>written FROM remaining ORDER BY nomenclature_id`, taskID)
	if err != nil {
		return err
	}
	type amount struct {
		id, total, standard, waste string
		invalid, positive          bool
	}
	var amounts []amount
	for rows.Next() {
		var v amount
		if err = rows.Scan(&v.id, &v.total, &v.standard, &v.waste, &v.invalid, &v.positive); err != nil {
			rows.Close()
			return err
		}
		amounts = append(amounts, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, v := range amounts {
		if v.invalid {
			return dbx.Business("Историческое списание превышает зафиксированный факт задачи")
		}
		if v.positive {
			if err = finalizeWriteOff(ctx, tx, taskID, v.id, v.total, v.standard, v.waste); err != nil {
				return err
			}
		}
	}
	if _, err = tx.Exec(ctx, `DELETE FROM t_stock_reserves WHERE order_task_id=$1`, taskID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE t_order_tasks SET materials_finalized_at=now(),updated_at=now() WHERE id=$1`, taskID)
	return err
}

func finalizeWriteOff(ctx context.Context, tx pgx.Tx, taskID, id, total, standard, waste string) error {
	return writeOffStock(ctx, tx, "TASK_MATERIAL_FINALIZED", taskID, taskID, id, total, standard, waste)
}

func writeOffStock(ctx context.Context, tx pgx.Tx, referenceType, referenceID, excludedTask, id, total, standard, waste string) error {
	var movementType string
	// The scalar subquery intentionally fails for ambiguous movement configuration.
	if err := tx.QueryRow(ctx, `SELECT (SELECT code FROM t_stock_movement_types WHERE decreases_stock AND is_active)`).Scan(&movementType); err != nil {
		return err
	}
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_stock_movement WHERE nomenclature_id=$1 AND reference_type=$4 AND reference_id=$2 AND movement_type=$3)`, id, referenceID, movementType, referenceType).Scan(&exists); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO t_stock_balance(nomenclature_id,quantity) VALUES($1,0) ON CONFLICT(nomenclature_id) DO NOTHING`, id); err != nil {
		return err
	}
	var balance string
	if err := tx.QueryRow(ctx, `SELECT quantity::text FROM t_stock_balance WHERE nomenclature_id=$1 FOR UPDATE`, id).Scan(&balance); err != nil {
		return err
	}
	var enough bool
	if err := tx.QueryRow(ctx, `SELECT $3::numeric-coalesce(sum(reserved_quantity),0)>=$4::numeric FROM t_stock_reserves WHERE nomenclature_id=$1 AND ($2='' OR order_task_id<>NULLIF($2,'')::uuid)`, id, excludedTask, balance, total).Scan(&enough); err != nil {
		return err
	}
	if !enough {
		return dbx.Business("Недостаточно материала для окончательного списания с учётом резервов других задач")
	}
	if exists {
		return nil
	}
	if err := tx.QueryRow(ctx, `UPDATE t_stock_balance SET quantity=quantity-$2::numeric,updated_at=now() WHERE nomenclature_id=$1 RETURNING quantity::text`, id, total).Scan(&balance); err != nil {
		return err
	}
	lots, err := tx.Query(ctx, `SELECT id::text FROM t_stock_lots WHERE nomenclature_id=$1 AND remaining_quantity>0 ORDER BY expires_at NULLS LAST,created_at,id FOR UPDATE`, id)
	if err != nil {
		return err
	}
	var ids []string
	for lots.Next() {
		var lot string
		if err = lots.Scan(&lot); err != nil {
			lots.Close()
			return err
		}
		ids = append(ids, lot)
	}
	err = lots.Err()
	lots.Close()
	if err != nil {
		return err
	}
	originalStandard, originalWaste := standard, waste
	standardCost, wasteCost := "0", "0"
	for _, lot := range ids {
		var done bool
		err = tx.QueryRow(ctx, `WITH take AS (SELECT id,unit_cost,least(remaining_quantity,$2::numeric) s,least(greatest(remaining_quantity-$2::numeric,0),$3::numeric) w FROM t_stock_lots WHERE id=$1), updated AS (UPDATE t_stock_lots l SET remaining_quantity=l.remaining_quantity-t.s-t.w FROM take t WHERE l.id=t.id RETURNING l.id)
  SELECT ($2::numeric-t.s)::text,($3::numeric-t.w)::text,($4::numeric+t.s*t.unit_cost)::text,($5::numeric+t.w*t.unit_cost)::text,$2::numeric=t.s AND $3::numeric=t.w FROM take t JOIN updated u ON u.id=t.id`, lot, standard, waste, standardCost, wasteCost).Scan(&standard, &waste, &standardCost, &wasteCost, &done)
		if err != nil {
			return err
		}
		if done {
			break
		}
	}
	// Round components first so their sum always satisfies the cost invariant.
	_, err = tx.Exec(ctx, `INSERT INTO t_stock_movement(nomenclature_id,movement_type,quantity,reason,reference_type,reference_id,balance_after,standard_quantity,waste_quantity,standard_cost,waste_cost,total_cost)
 VALUES($1,$2,$3::numeric,'Списание: '||$10::text,$10,$4,$5::numeric,$6::numeric,$7::numeric,round($8::numeric,4),round($9::numeric,4),round($8::numeric,4)+round($9::numeric,4))`, id, movementType, total, referenceID, balance,
		originalStandard, originalWaste, standardCost, wasteCost, referenceType)
	return err
}
