package orders

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

// MaterialView reads authorization and accounting from one consistent snapshot.
// Quantities and costs stay PostgreSQL numeric values all the way to JSON.
func (s *Service) MaterialView(ctx context.Context, taskID, view string, actor identity.User) (any, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireTaskAccess(ctx, tx, taskID, actor); err != nil {
		return nil, err
	}
	var result any
	switch view {
	case "material-plan":
		result, err = dbx.List(ctx, tx, `SELECT jsonb_build_object(
 'nomenclatureId',n.id,'nomenclatureName',n.name,'unit',n.unit,
 'remainingStandardQuantity',p.standard_quantity,'remainingWasteQuantity',p.waste_quantity,
 'remainingReservedQuantity',p.planned_quantity)
 FROM public.t_task_material_plan p JOIN public.t_nomenclature n ON n.id=p.nomenclature_id
 WHERE p.order_task_id=$1 ORDER BY n.name,n.id`, taskID)
	case "material-usages":
		// Scan dates separately to use the same RFC3339 representation as Java.
		var rows pgx.Rows
		rows, err = tx.Query(ctx, `SELECT jsonb_build_object('id',u.id,'reportId',u.report_id,
 'workflowStepId',u.workflow_step_id,'fromStatus',f.code,'toStatus',t.code,
 'nomenclatureId',n.id,'nomenclatureName',n.name,'actorId',u.actor_id,
 'issuedQuantity',u.issued_quantity,'consumedQuantity',u.consumed_quantity,
 'wasteQuantity',u.waste_quantity,'returnedQuantity',u.returned_quantity,'note',u.note),u.created_at
 FROM public.t_task_stage_material_usage u JOIN public.t_nomenclature n ON n.id=u.nomenclature_id
 JOIN public.t_order_statuses f ON f.id=u.from_status_id JOIN public.t_order_statuses t ON t.id=u.to_status_id
 WHERE u.order_task_id=$1 ORDER BY u.created_at,u.id`, taskID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		items := []map[string]json.RawMessage{}
		for rows.Next() {
			var raw []byte
			var at time.Time
			if err = rows.Scan(&raw, &at); err != nil {
				return nil, err
			}
			var item map[string]json.RawMessage
			if err = json.Unmarshal(raw, &item); err != nil {
				return nil, err
			}
			item["createdAt"], err = json.Marshal(at.UTC().Format(time.RFC3339Nano))
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		err = rows.Err()
		result = items
	case "material-accounting":
		var finalized *time.Time
		if err = tx.QueryRow(ctx, `SELECT materials_finalized_at FROM public.t_order_tasks WHERE id=$1`, taskID).Scan(&finalized); err != nil {
			return nil, err
		}
		var items []json.RawMessage
		items, err = dbx.List(ctx, tx, `WITH actual AS (
 SELECT nomenclature_id,sum(issued_quantity) issued,sum(consumed_quantity) consumed,
 sum(waste_quantity) waste,sum(returned_quantity) returned,min(created_at) first_usage
 FROM public.t_task_stage_material_usage WHERE order_task_id=$1 GROUP BY nomenclature_id),
 plan AS (SELECT * FROM public.t_task_material_plan WHERE order_task_id=$1),
 combined AS (SELECT coalesce(p.nomenclature_id,a.nomenclature_id) id,p.id plan_id,
 coalesce(p.standard_quantity,0) standard,coalesce(p.waste_quantity,0) planned_waste,
 coalesce(p.planned_quantity,0) planned,coalesce(a.issued,0) issued,coalesce(a.consumed,0) consumed,
 coalesce(a.waste,0) waste,coalesce(a.returned,0) returned,a.first_usage
 FROM plan p FULL JOIN actual a USING(nomenclature_id))
 SELECT jsonb_build_object('nomenclatureId',n.id,'nomenclatureName',n.name,'unit',n.unit,
 'plannedStandardQuantity',v.standard,'plannedWasteQuantity',v.planned_waste,'plannedTotalQuantity',v.planned,
 'issuedQuantity',v.issued,'actualConsumedQuantity',v.consumed,'actualWasteQuantity',v.waste,
 'returnedQuantity',v.returned,'actualWriteOffQuantity',v.consumed+v.waste,
 'varianceQuantity',v.consumed+v.waste-v.planned,'finalizedCost',CASE WHEN $2 THEN (
 SELECT coalesce(sum(m.total_cost),0) FROM public.t_stock_movement m
 JOIN public.t_stock_movement_types mt ON mt.code=m.movement_type
 WHERE m.nomenclature_id=n.id AND mt.decreases_stock AND (
 (m.reference_type='TASK_MATERIAL_FINALIZED' AND m.reference_id=$1) OR
 (m.reference_type='ORDER_STAGE_USAGE' AND (EXISTS (
 SELECT 1 FROM public.t_task_stage_material_usage u WHERE u.order_task_id=$1 AND u.nomenclature_id=n.id AND u.id=m.reference_id)
 OR (m.reference_id=$1 AND NOT EXISTS (SELECT 1 FROM public.t_task_stage_material_usage u WHERE u.order_task_id=$1 AND u.nomenclature_id=n.id)))))) ELSE 0 END)
 FROM combined v JOIN public.t_nomenclature n ON n.id=v.id
 ORDER BY (v.plan_id IS NULL),CASE WHEN v.plan_id IS NOT NULL THEN n.name END,v.first_usage,n.id`, taskID, finalized != nil)
		var finalizedAt any
		if finalized != nil {
			finalizedAt = finalized.UTC().Format(time.RFC3339Nano)
		}
		result = map[string]any{"taskId": taskID, "finalized": finalized != nil, "finalizedAt": finalizedAt, "items": items}
	default:
		return nil, fmt.Errorf("unknown material view: %s", view)
	}
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
