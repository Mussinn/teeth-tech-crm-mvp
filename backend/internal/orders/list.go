package orders

import (
	"context"

	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/pagination"
)

// Active preserves the dispatcher-specific projection: both tasks and the
// displayed total are restricted to the user's directions, not just orders.
func (s *Service) Active(ctx context.Context, actor identity.User, page pagination.Page) (any, error) {
	order, err := page.Order(map[string]string{
		"id": "o.id", "orderNumber": "o.order_number", "createdAt": "o.created_at",
		"updatedAt": "o.updated_at", "deadline": "o.deadline", "totalAmount": "o.total_amount",
		"paidAmount": "o.paid_amount", "active": "o.is_active", "completedAt": "o.completed_at",
	}, "o.id DESC")
	if err != nil {
		return nil, err
	}
	scoped := hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN")
	items, err := dbx.List(ctx, s.pool, `
 WITH selected_orders AS (
 SELECT o.* FROM public.t_orders o WHERE o.is_active AND o.deleted_at IS NULL AND
 (NOT $1 OR EXISTS (SELECT 1 FROM public.t_order_tasks t
 JOIN public.t_user_work_directions d ON d.work_direction_id=t.work_direction_id AND d.user_id=$2
 WHERE t.order_id=o.id AND t.deleted_at IS NULL))
 `+order+` LIMIT $3 OFFSET $4), visible_tasks AS (
 SELECT t.*, w.name AS work_type_name FROM public.t_order_tasks t
 JOIN selected_orders selected ON selected.id=t.order_id
 LEFT JOIN public.t_work_types w ON w.id=t.work_type_id
 WHERE t.deleted_at IS NULL AND (NOT $1 OR EXISTS (
 SELECT 1 FROM public.t_user_work_directions d WHERE d.user_id=$2 AND d.work_direction_id=t.work_direction_id)))
 SELECT jsonb_build_object('id',o.id,'orderNumber',o.order_number,
 'patientFullName',coalesce(p.full_name,'-'),'clinic',coalesce(c.name,'-'),
 'clinicId',p.clinic_id,'doctorFullName',(SELECT full_name FROM t_clinic_user_cards WHERE id=o.doctor_card_id),'deadline',o.deadline,'comment',o.comment,'createdAt',o.created_at,'completedAt',o.completed_at,
 'isActive',o.is_active,'quantity',coalesce(v.quantity,0),
 'pricePerUnit',coalesce(v.price,0),'discount',coalesce(v.discount,0),
 'summaryWorkType',CASE WHEN v.count=0 THEN 'Без задач' ELSE coalesce(v.names,'') END,
 'totalPrice',CASE WHEN $1 THEN coalesce(v.total,0) ELSE o.total_amount END,
 'taskIds',coalesce(v.ids,'[]'::jsonb))
 FROM selected_orders o LEFT JOIN public.t_clinic_user_cards p ON p.id=o.patient_card_id
 LEFT JOIN public.t_clinics c ON c.id=p.clinic_id
 CROSS JOIN LATERAL (
 SELECT count(*) AS count, sum(t.quantity) AS quantity,
 (array_agg(t.price_per_unit ORDER BY t.created_at,t.id))[1] AS price,
 (array_agg(t.discount_percent ORDER BY t.created_at,t.id))[1] AS discount,
 sum(round(t.price_per_unit*t.quantity*(1-round(t.discount_percent/100,4)),2)) AS total,
 jsonb_agg(t.id ORDER BY t.created_at,t.id) AS ids,
 (SELECT string_agg(n.work_type_name,', ' ORDER BY n.first_created,n.first_id)
 FROM (SELECT DISTINCT ON (x.work_type_name) x.work_type_name,x.created_at AS first_created,x.id AS first_id
 FROM visible_tasks x WHERE x.order_id=o.id AND nullif(btrim(x.work_type_name),'') IS NOT NULL
 ORDER BY x.work_type_name,x.created_at,x.id) n) AS names
 FROM visible_tasks t WHERE t.order_id=o.id) v
 `+order, scoped, actor.ID, page.Size+1, page.Offset())
	if err != nil {
		return nil, err
	}
	return page.Slice(items), nil
}
