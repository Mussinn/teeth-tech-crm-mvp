package orders

import (
	"context"
	"github.com/jackc/pgx/v5"
)

// Snapshot the employee before resolving the assignee of the next stage.
func recordCompletion(ctx context.Context, tx pgx.Tx, task, actor, old, next string) error {
	_, err := tx.Exec(ctx, `INSERT INTO mvp_task_completions(id,task_id,order_id,order_number,work_name,quantity,employee_id,employee_name,closed_by,closed_by_name,from_status,to_status,terminal,completed_at)
 SELECT gen_random_uuid(),t.id,o.id,o.order_number,w.name,t.quantity,u.id,u.name,a.id,a.name,old.code,next.code,next.is_terminal,clock_timestamp()
 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id JOIN t_work_types w ON w.id=t.work_type_id
 JOIN t_users u ON u.id=coalesce(t.dental_technician_id,$2::uuid) JOIN t_users a ON a.id=$2
 JOIN t_order_statuses old ON old.id=$3 JOIN t_order_statuses next ON next.id=$4
 WHERE t.id=$1 AND `+routePosition("t.work_type_id", "next.id")+`>`+routePosition("t.work_type_id", "old.id"), task, actor, old, next)
	return err
}
