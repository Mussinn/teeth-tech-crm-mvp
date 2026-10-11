package orders

import (
	"context"
	"encoding/json"

	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

// Kanban projects one snapshot, including terminal and historical current columns.
func (s *Service) Kanban(ctx context.Context, id string, actor identity.User) ([]json.RawMessage, error) {
	return dbx.List(ctx, s.pool, `WITH tasks AS (
 SELECT t.*,wt.name work_name,wt.code work_code,d.name direction_name,d.code direction_code,c.code color_code,st.name status_name,st.code status_code,st.is_terminal,u.name technician
 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id AND o.deleted_at IS NULL
 JOIN t_work_types wt ON wt.id=t.work_type_id JOIN t_work_directions d ON d.id=t.work_direction_id
 LEFT JOIN t_colors c ON c.id=t.color_id JOIN t_order_statuses st ON st.id=t.status_id LEFT JOIN t_users u ON u.id=t.dental_technician_id
 WHERE t.order_id=$1 AND t.deleted_at IS NULL AND (NOT $2 OR EXISTS(SELECT 1 FROM t_user_work_directions ud WHERE ud.user_id=$3 AND ud.work_direction_id=t.work_direction_id))
 ),steps AS (SELECT w.* FROM t_workflow_steps w WHERE w.deleted_at IS NULL AND w.work_type_id IN(SELECT work_type_id FROM tasks)),
 statuses AS (SELECT status_id id FROM tasks UNION SELECT from_status_id FROM steps UNION SELECT to_status_id FROM steps),
 cards AS (SELECT t.status_id,t.created_at,t.id,`+kanbanCardSQL+` body FROM tasks t)
 SELECT jsonb_build_object('statusName',s.code,'title',s.name,'taskCount',(SELECT count(*) FROM cards WHERE status_id=s.id),'tasks',coalesce((SELECT jsonb_agg(body ORDER BY created_at,id) FROM cards WHERE status_id=s.id),'[]'::jsonb))
 FROM t_order_statuses s JOIN statuses selected ON selected.id=s.id ORDER BY s.sort_order,s.id`, id, hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN"), actor.ID, actor.Roles)
}

const kanbanCardSQL = `jsonb_build_object(
 'id',t.id,'orderId',t.order_id,'workTypeId',t.work_type_id,'currentStatusId',t.status_id,'isCompleted',t.is_terminal,
 'hasAccess',('ROLE_ADMIN'=ANY($4::text[]) OR 'ROLE_CHIEF_TECHNICIAN'=ANY($4::text[]) OR t.dental_technician_id=$3::uuid OR ('ROLE_DISPATCHER'=ANY($4::text[]) AND EXISTS(SELECT 1 FROM t_user_work_directions d WHERE d.user_id=$3 AND d.work_direction_id=t.work_direction_id))),'workDirectionId',t.work_direction_id,'workDirectionName',t.direction_name,'workDirectionCode',t.direction_code,
 'workTypeName',t.work_name,'workTypeCode',t.work_code,
 'materialIds',coalesce((SELECT jsonb_agg(m.id ORDER BY m.name COLLATE "C",m.id) FROM t_order_task_materials tm JOIN t_materials m ON m.id=tm.material_id WHERE tm.order_task_id=t.id),'[]'::jsonb),
 'materialNames',coalesce((SELECT jsonb_agg(m.name ORDER BY m.name COLLATE "C",m.id) FROM t_order_task_materials tm JOIN t_materials m ON m.id=tm.material_id WHERE tm.order_task_id=t.id),'[]'::jsonb),
 'colorCode',t.color_code,'quantity',t.quantity,'totalAmount',t.total_task,'currentStatusFormName',t.status_name,'currentStatusCode',t.status_code,
 'dentalTechnicianFullName',coalesce(t.technician,'Не назначен'),
 'toothNumbers',coalesce((SELECT jsonb_agg(tooth_number ORDER BY tooth_number) FROM t_order_task_teeth WHERE order_task_id=t.id),'[]'::jsonb),
 'allowedNextStatusIds',coalesce((SELECT jsonb_agg(w.to_status_id ORDER BY w.sort_order,w.id) FROM steps w WHERE w.work_type_id=t.work_type_id AND w.from_status_id=t.status_id AND w.required_role=ANY($4::text[])),'[]'::jsonb)
 )`
