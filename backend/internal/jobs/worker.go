// Package jobs delivers in-app order notifications and evaluates task deadlines.
package jobs

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"time"
)

type Worker struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, logger *slog.Logger) *Worker { return &Worker{pool, logger} }
func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		work, cancel := context.WithTimeout(ctx, 10*time.Second)
		e := w.Tick(work)
		cancel()
		if e != nil && ctx.Err() == nil {
			w.logger.Error("background delivery failed", "error", e)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (w *Worker) Tick(ctx context.Context) error {
	tx, e := w.pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	// Serialize against transitions and other replicas to avoid duplicate delivery.
	var acquired bool
	if e = tx.QueryRow(ctx, `SELECT pg_try_advisory_xact_lock(841337,1)`).Scan(&acquired); e != nil {
		return e
	}
	if !acquired {
		return nil
	}
	_, e = tx.Exec(ctx, `WITH due AS (SELECT id,payload::jsonb p FROM t_outbox_events WHERE status IN('PENDING','RETRY') AND event_type='NOTIFICATION' AND next_attempt_at<=now() ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED),
 delivered AS (INSERT INTO t_notifications(user_id,type,title,message,resource_type,resource_id)
 SELECT (d.p->>'userId')::uuid,d.p->>'type',d.p->>'title',d.p->>'message',d.p->>'resourceType',(d.p->>'resourceId')::uuid FROM due d JOIN t_users u ON u.id=(d.p->>'userId')::uuid AND u.deleted_at IS NULL LEFT JOIN t_notification_preferences p ON p.user_id=u.id WHERE coalesce(p.in_app_enabled,true) AND (d.p->>'type'<>'TASK_ASSIGNED' OR coalesce(p.task_assigned,true)) RETURNING id)
 UPDATE t_outbox_events SET status='PUBLISHED',published_at=now(),last_error=NULL WHERE id IN(SELECT id FROM due)`)
	if e != nil {
		return e
	}
	// Boards refresh through authenticated HTTP polling; no external delivery is configured.
	_, e = tx.Exec(ctx, `UPDATE t_outbox_events SET status='PUBLISHED',published_at=now() WHERE id IN(SELECT id FROM t_outbox_events WHERE status IN('PENDING','RETRY') AND event_type='DASHBOARD' ORDER BY created_at LIMIT 100)`)
	if e != nil {
		return e
	}
	for _, breach := range []bool{false, true} {
		column, event, title, preference := "warning_at", "DEADLINE_WARNING", "Приближается срок этапа", "deadline_warning"
		sent := "warned_at"
		if breach {
			column = "breach_at"
			sent = "breached_at"
			event = "TASK_OVERDUE"
			title = "Этап просрочен"
			preference = "task_overdue"
		}
		_, e = tx.Exec(ctx, `WITH due AS (SELECT s.task_id,t.dental_technician_id employee FROM t_task_sla_states s JOIN t_order_tasks t ON t.id=s.task_id AND t.status_id=s.status_id JOIN t_orders o ON o.id=t.order_id JOIN t_order_statuses st ON st.id=t.status_id WHERE s.`+column+`<=now() AND s.`+sent+` IS NULL AND t.deleted_at IS NULL AND o.deleted_at IS NULL AND o.is_active AND NOT st.is_terminal AND NOT EXISTS(SELECT 1 FROM mvp_lab_cases l WHERE l.order_id=o.id AND (coalesce((l.state->>'onHold')::boolean,false) OR coalesce(l.state->>'intake','PENDING')<>'ACCEPTED')) LIMIT 100),
 delivered AS (INSERT INTO t_notifications(user_id,type,title,message,resource_type,resource_id) SELECT d.employee,$1,$2,'Проверьте задачу в рабочей зоне','TASK',d.task_id FROM due d LEFT JOIN t_notification_preferences p ON p.user_id=d.employee WHERE d.employee IS NOT NULL AND coalesce(p.in_app_enabled,true) AND coalesce(p.`+preference+`,true) RETURNING id)
 UPDATE t_task_sla_states SET `+sent+`=now(),updated_at=now() WHERE task_id IN(SELECT task_id FROM due)`, event, title)
		if e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}
