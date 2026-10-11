package clinic

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

// History uses one read snapshot so totals and the page cannot drift during a
// concurrent order update. Dispatcher scope is applied before both counting and paging.
func (s *Service) History(ctx context.Context, id, actorID string, scoped bool, p Page) (any,
	error) {
	p.Size = min(p.Size, 100)
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var name, clinicID, clinicName string
	err = tx.QueryRow(ctx, `SELECT p.full_name,c.id::text,c.name FROM public.t_clinic_user_cards p JOIN public.t_clinics c ON c.id=p.clinic_id WHERE p.id=$1 AND lower(p.role)='patient' AND p.deleted_at IS NULL`, id).Scan(&name, &clinicID, &clinicName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Карточка пациента с ID " + id + " не найдена")
	}
	if err != nil {
		return nil, err
	}
	// Historical references remain readable after catalog soft deletion, as in Java.
	const from = ` FROM public.t_order_tasks t JOIN public.t_orders o ON o.id=t.order_id`
	const where = ` WHERE o.patient_card_id=$1 AND o.deleted_at IS NULL AND t.deleted_at IS NULL
 AND (NOT $2 OR EXISTS(SELECT 1 FROM public.t_user_work_directions ud WHERE ud.user_id=$3 AND ud.work_direction_id=t.work_direction_id))`
	var total, orders int64
	err = tx.QueryRow(ctx, `SELECT count(*),count(DISTINCT o.id)`+from+where, id, scoped, actorID).Scan(&total, &orders)
	if err != nil {
		return nil, err
	}
	items, err := dbx.List(ctx, tx, `SELECT jsonb_build_object(
 'taskId',t.id,'orderId',o.id,'orderNumber',o.order_number,'orderedAt',o.created_at,'deadline',o.deadline,'completedAt',o.completed_at,'orderActive',o.is_active,
 'doctorName',coalesce(doctor.full_name,'-'),'workDirectionId',d.id,'workDirectionName',d.name,'workDirectionCode',d.code,
 'workTypeId',w.id,'workTypeName',w.name,'workTypeCode',w.code,
 'materialIds',coalesce((SELECT jsonb_agg(m.id ORDER BY m.name,m.id) FROM public.t_order_task_materials tm JOIN public.t_materials m ON m.id=tm.material_id WHERE tm.order_task_id=t.id),'[]'::jsonb),
 'materialNames',coalesce((SELECT jsonb_agg(m.name ORDER BY m.name,m.id) FROM public.t_order_task_materials tm JOIN public.t_materials m ON m.id=tm.material_id WHERE tm.order_task_id=t.id),'[]'::jsonb),
 'toothNumbers',coalesce((SELECT jsonb_agg(teeth.tooth_number) FROM public.t_order_task_teeth teeth WHERE teeth.order_task_id=t.id),'[]'::jsonb),
 'quantity',t.quantity,'statusId',st.id,'statusName',st.name,'statusCode',st.code,'technicianName',coalesce(tech.name,'Не назначен'),'comment',o.comment)`+from+`
 JOIN public.t_work_directions d ON d.id=t.work_direction_id JOIN public.t_work_types w ON w.id=t.work_type_id JOIN public.t_order_statuses st ON st.id=t.status_id
 LEFT JOIN public.t_clinic_user_cards doctor ON doctor.id=o.doctor_card_id LEFT JOIN public.t_users tech ON tech.id=t.dental_technician_id`+where+`
 ORDER BY o.created_at DESC,t.created_at DESC,t.id LIMIT $4 OFFSET $5`, id, scoped, actorID, p.Size, p.Offset())
	if err != nil {
		return nil, err
	}
	for i, item := range items {
		var fields map[string]json.RawMessage
		if err = json.Unmarshal(item, &fields); err != nil {
			return nil, err
		}
		for _, field := range []string{"orderedAt", "completedAt"} {
			var value string
			if string(fields[field]) == "null" {
				continue
			}
			if err = json.Unmarshal(fields[field], &value); err != nil {
				return nil, err
			}
			parsed, e := time.Parse(time.RFC3339Nano, value)
			if e != nil {
				return nil, e
			}
			fields[field], err = json.Marshal(parsed.UTC().Format(time.RFC3339Nano))
			if err != nil {
				return nil, err
			}
		}
		items[i], err = json.Marshal(fields)
		if err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"patientId": id, "patientFullName": name, "clinicId": clinicID, "clinicName": clinicName, "totalTreatments": total, "totalOrders": orders, "page": p.Number, "size": p.Size, "totalPages": (total + int64(p.Size) - 1) / int64(p.Size), "hasNext": p.Offset()+int64(p.Size) < total, "treatments": items}, nil
}
