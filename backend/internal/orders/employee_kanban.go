package orders

import (
	"context"
	"encoding/json"

	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

// EmployeeKanban classifies within each work type before applying the personal board cap.
// An empty orderID selects the personal board; an order board includes terminal cards.
func (s *Service) EmployeeKanban(ctx context.Context, orderID string, actor identity.User) (json.RawMessage, error) {
	return dbx.One(ctx, s.pool, `WITH steps AS (
 SELECT w.* FROM t_workflow_steps w JOIN t_work_types wt ON wt.id=w.work_type_id
 WHERE w.deleted_at IS NULL AND wt.deleted_at IS NULL AND wt.is_active
 ),current_stages AS (
 SELECT DISTINCT work_type_id,from_status_id status_id FROM steps WHERE required_role=ANY($4::text[])
 ), classified AS (
 SELECT t.*,CASE WHEN $1='' THEN o.deadline ELSE NULL END deadline,
 wt.name work_name,wt.code work_code,d.name direction_name,d.code direction_code,c.code color_code,
 st.name status_name,st.code status_code,st.is_terminal,u.name technician,
 CASE WHEN EXISTS(SELECT 1 FROM current_stages cur WHERE cur.work_type_id=t.work_type_id AND cur.status_id=t.status_id)
 THEN CASE WHEN t.dental_technician_id IS NULL OR t.dental_technician_id=$3 THEN 'CURRENT' END
 WHEN EXISTS(SELECT 1 FROM steps w JOIN current_stages cur ON cur.work_type_id=w.work_type_id AND cur.status_id=w.to_status_id
             WHERE w.work_type_id=t.work_type_id AND w.from_status_id=t.status_id) THEN 'PREVIOUS'
 WHEN EXISTS(SELECT 1 FROM steps w JOIN current_stages cur ON cur.work_type_id=w.work_type_id AND cur.status_id=w.from_status_id
             WHERE w.work_type_id=t.work_type_id AND w.to_status_id=t.status_id) THEN 'NEXT' END board_column
 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id AND o.deleted_at IS NULL
 JOIN t_work_types wt ON wt.id=t.work_type_id JOIN t_work_directions d ON d.id=t.work_direction_id
 LEFT JOIN t_colors c ON c.id=t.color_id JOIN t_order_statuses st ON st.id=t.status_id LEFT JOIN t_users u ON u.id=t.dental_technician_id
 WHERE t.deleted_at IS NULL AND (($1='' AND NOT st.is_terminal) OR (t.order_id=NULLIF($1,'')::uuid AND c.id IS NOT NULL))
 AND (NOT $2 OR EXISTS(SELECT 1 FROM t_user_work_directions ud WHERE ud.user_id=$3 AND ud.work_direction_id=t.work_direction_id))
 ), tasks AS (
 SELECT * FROM classified WHERE board_column IS NOT NULL ORDER BY deadline,created_at,id LIMIT CASE WHEN $1='' THEN $5::int END
 ), cards AS (SELECT t.board_column,t.deadline,t.created_at,t.id,`+kanbanCardSQL+` body FROM tasks t),
 columns AS (SELECT key,jsonb_build_object('statusName',code,'title',CASE WHEN EXISTS(SELECT 1 FROM cards) THEN full_title ELSE empty_title END,
 'taskCount',(SELECT count(*) FROM cards WHERE board_column=code),
 'tasks',coalesce((SELECT jsonb_agg(body ORDER BY deadline,created_at,id) FROM cards WHERE board_column=code),'[]'::jsonb)) body
 FROM (VALUES
 ('previousColumn','PREVIOUS','Предыдущий этап','Предыдущий этап (На подходе / На исправление)'),
 ('currentColumn','CURRENT','В работе (Ваш этап)','Текущий этап (В вашей работе)'),
 ('nextColumn','NEXT','Следующий этап','Следующий этап (Передано дальше)')
 ) labels(key,code,empty_title,full_title)) SELECT jsonb_object_agg(key,body) FROM columns`,
		orderID, hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN"), actor.ID, actor.Roles, s.maxKanbanCards)
}
