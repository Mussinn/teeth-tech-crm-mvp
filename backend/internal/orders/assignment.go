package orders

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

// Candidate load follows Java: every nondeleted, nonterminal task counts,
// including tasks in inactive orders. User status is not filtered by Java.
const candidateLoad = `(SELECT count(*) FROM public.t_order_tasks t
 JOIN public.t_order_statuses s ON s.id=t.status_id
 WHERE t.dental_technician_id=u.id AND t.deleted_at IS NULL AND NOT s.is_terminal)`

func (s *Service) AssignableStatuses(ctx context.Context, workTypeID string) (any, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_work_types WHERE id=$1 AND deleted_at IS NULL)`, workTypeID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, dbx.Missing("Вид работы не найден: " + workTypeID)
	}
	items, err := dbx.List(ctx, tx, `WITH steps AS (
 SELECT * FROM public.t_workflow_steps WHERE work_type_id=$1 AND deleted_at IS NULL),
 required AS (SELECT DISTINCT ON (a.from_status_id) a.* FROM steps a
 WHERE EXISTS(SELECT 1 FROM steps b WHERE b.to_status_id=a.from_status_id)
 ORDER BY a.from_status_id,a.sort_order,a.id)
 SELECT jsonb_build_object('statusId',st.id,'statusCode',st.code,'statusName',st.name,
 'requiredRole',r.required_role,'sortOrder',r.sort_order,'eligibleAssignees',coalesce((
 SELECT jsonb_agg(jsonb_build_object('userId',c.id,'fullName',c.name,'activeTaskCount',c.load,'isCurrent',false) ORDER BY c.load,c.id)
 FROM (SELECT u.id,u.name,`+candidateLoad+` AS load FROM public.t_users u
 WHERE u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.t_user_roles ur
 JOIN public.t_roles role ON role.id=ur.role_id WHERE ur.user_id=u.id AND role.code=r.required_role)) c),'[]'::jsonb))
 FROM required r JOIN public.t_order_statuses st ON st.id=r.from_status_id ORDER BY r.sort_order,st.id`, workTypeID)
	if err != nil {
		return nil, err
	}
	return items, tx.Commit(ctx)
}

func (s *Service) AssignmentView(ctx context.Context, taskID, view, nextStatusID string, actor identity.User) (any, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireTaskAccess(ctx, tx, taskID, actor); err != nil {
		return nil, err
	}
	var mode string
	var workType, status, technician *string
	if err = tx.QueryRow(ctx, `SELECT assignment_mode,work_type_id::text,status_id::text,dental_technician_id::text
 FROM public.t_order_tasks WHERE id=$1`, taskID).Scan(&mode, &workType, &status, &technician); err != nil {
		return nil, err
	}
	var result any
	if view == "assignment" {
		var items []json.RawMessage
		items, err = dbx.List(ctx, tx, `SELECT jsonb_build_object('statusId',st.id,'statusCode',st.code,
 'statusName',st.name,'userId',u.id,'userFullName',u.name)
 FROM public.t_order_task_status_assignees a JOIN public.t_order_statuses st ON st.id=a.status_id
 JOIN public.t_users u ON u.id=a.user_id WHERE a.order_task_id=$1 ORDER BY st.sort_order,st.id`, taskID)
		result = map[string]any{"assignmentMode": mode, "statusAssignees": items}
	} else {
		var role string
		if view == "next-step-assignees" {
			err = tx.QueryRow(ctx, `SELECT coalesce((SELECT n.required_role FROM public.t_workflow_steps n WHERE n.work_type_id=w.work_type_id AND n.from_status_id=w.to_status_id AND n.deleted_at IS NULL ORDER BY n.sort_order,n.id LIMIT 1),w.required_role) FROM public.t_workflow_steps w
 WHERE w.work_type_id=$1 AND w.from_status_id=$2 AND w.to_status_id=$3 AND w.deleted_at IS NULL`, workType, status, nextStatusID).Scan(&role)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, dbx.Business("Для данного перехода не определена роль")
			}
		} else {
			err = tx.QueryRow(ctx, `SELECT required_role FROM public.t_workflow_steps
 WHERE work_type_id=$1 AND (from_status_id=$2 OR to_status_id=$2) AND deleted_at IS NULL ORDER BY (from_status_id=$2) DESC,sort_order,id LIMIT 1`, workType, status).Scan(&role)
			if errors.Is(err, pgx.ErrNoRows) {
				return []json.RawMessage{}, tx.Commit(ctx)
			}
		}
		if err != nil {
			return nil, err
		}
		result, err = dbx.List(ctx, tx, `SELECT jsonb_build_object('userId',c.id,'fullName',c.name,
 'activeTaskCount',c.load,'isCurrent',c.current) FROM (
 SELECT u.id,u.name,`+candidateLoad+` AS load,coalesce(u.id=$2::uuid,false) AS current
 FROM public.t_users u WHERE u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.t_user_roles ur
 JOIN public.t_roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code=$1)) c
 ORDER BY CASE WHEN $3 THEN c.current ELSE false END DESC,c.load,c.id`, role, technician, view == "next-step-assignees")
	}
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
