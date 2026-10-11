package kpi

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
	"time"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool} }

var local = time.FixedZone("Asia/Aqtobe", 5*60*60)

func Period(from, to string) (time.Time, time.Time, error) {
	a, e := time.ParseInLocation("2006-01-02", from, local)
	if e != nil {
		return a, a, dbx.Validation("Некорректная начальная дата")
	}
	b, e := time.ParseInLocation("2006-01-02", to, local)
	if e != nil {
		return a, a, dbx.Validation("Некорректная конечная дата")
	}
	b = b.AddDate(0, 0, 1)
	if !b.After(a) || b.Sub(a) > 367*24*time.Hour {
		return a, b, dbx.Validation("Период должен быть от 1 до 367 дней")
	}
	return a, b, nil
}
func (s *Service) Report(ctx context.Context, from, to, employee string, page, size int) (any, error) {
	a, b, e := Period(from, to)
	if e != nil {
		return nil, e
	}
	if page < 0 || page > 100000 || size < 1 || size > 200 {
		return nil, dbx.Validation("Некорректная страница")
	}
	tx, e := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	summaries, e := dbx.List(ctx, tx, `WITH events AS (SELECT * FROM mvp_task_completions WHERE completed_at >=$1 AND completed_at<$2 AND ($3='' OR employee_id::text=$3)),
 terminal_tasks AS (SELECT DISTINCT ON(employee_id,task_id) employee_id,task_id,quantity FROM events WHERE terminal ORDER BY employee_id,task_id,completed_at DESC,id DESC)
 SELECT jsonb_build_object('employeeId',employee_id,'employeeName',(array_agg(employee_name ORDER BY completed_at DESC,id DESC))[1],
 'completedTasks',count(DISTINCT task_id) FILTER(WHERE terminal),'completedStages',count(*),
 'units',coalesce((SELECT sum(quantity) FROM terminal_tasks t WHERE t.employee_id=e.employee_id),0)) FROM events e GROUP BY employee_id ORDER BY max(employee_name),employee_id`, a, b, employee)
	if e != nil {
		return nil, e
	}
	events, e := dbx.List(ctx, tx, `SELECT jsonb_build_object('id',id,'taskId',task_id,'orderId',order_id,'orderNumber',order_number,'workName',work_name,'quantity',quantity,'employeeId',employee_id,'employeeName',employee_name,'closedByName',closed_by_name,'fromStatus',from_status,'toStatus',to_status,'terminal',terminal,'completedAt',completed_at) FROM mvp_task_completions WHERE completed_at >=$1 AND completed_at<$2 AND ($3='' OR employee_id::text=$3) ORDER BY completed_at DESC,id DESC LIMIT $4 OFFSET $5`, a, b, employee, size+1, page*size)
	if e != nil {
		return nil, e
	}
	hasNext := len(events) > size
	if hasNext {
		events = events[:size]
	}
	if events == nil {
		events = []json.RawMessage{}
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	return map[string]any{"employees": summaries, "completions": events, "page": page, "hasNext": hasNext}, nil
}
