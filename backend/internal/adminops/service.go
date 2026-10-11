package adminops

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/pagination"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool} }

func (s *Service) Page(ctx context.Context, dead bool, p pagination.Page) (any, error) {
	columns := map[string]string{"id": "id", "occurredAt": "occurred_at", "actorUserId": "actor_user_id", "actorEmail": "actor_email", "action": "action", "resourceType": "resource_type", "resourceId": "resource_id", "httpMethod": "http_method", "requestPath": "request_path", "requestId": "request_id", "ipAddress": "ip_address", "success": "success", "errorCode": "error_code", "metadata": "metadata"}
	source, primary := "t_business_audit_events", "occurred_at"
	projection := `jsonb_build_object('id',id,'occurredAt',occurred_at,'actorUserId',actor_user_id,'actorEmail',actor_email,'action',action,'resourceType',resource_type,'resourceId',resource_id,'httpMethod',http_method,'requestPath',request_path,'requestId',request_id,'ipAddress',ip_address,'success',success,'errorCode',error_code,'metadata',metadata)`
	times := []string{"occurredAt"}
	if dead {
		columns = map[string]string{"id": "id", "eventType": "event_type", "aggregateType": "aggregate_type", "aggregateId": "aggregate_id", "status": "status", "attempts": "attempts", "nextAttemptAt": "next_attempt_at", "lastError": "last_error", "createdAt": "created_at", "publishedAt": "published_at"}
		source, primary = "t_outbox_events WHERE status='DEAD_LETTER'", "created_at"
		projection = `jsonb_build_object('id',id,'eventType',event_type,'aggregateType',aggregate_type,'aggregateId',aggregate_id,'status',status,'attempts',attempts,'nextAttemptAt',next_attempt_at,'lastError',last_error,'createdAt',created_at,'publishedAt',published_at)`
		times = []string{"nextAttemptAt", "createdAt", "publishedAt"}
	}
	order, err := p.Order(columns, "id")
	if err != nil {
		return nil, dbx.Business("Неподдерживаемое поле сортировки")
	}
	order = " ORDER BY " + primary + " DESC," + order[len(" ORDER BY "):]
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var total int64
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM `+source).Scan(&total); err != nil {
		return nil, err
	}
	items, err := dbx.List(ctx, tx, `SELECT `+projection+` FROM `+source+order+` LIMIT $1 OFFSET $2`, p.Size, p.Offset())
	if err != nil {
		return nil, err
	}
	for i, item := range items {
		var fields map[string]json.RawMessage
		if err = json.Unmarshal(item, &fields); err != nil {
			return nil, err
		}
		for _, key := range times {
			if string(fields[key]) == "null" {
				continue
			}
			var stamp time.Time
			if err = json.Unmarshal(fields[key], &stamp); err != nil {
				return nil, err
			}
			fields[key], err = json.Marshal(stamp.UTC())
			if err != nil {
				return nil, err
			}
		}
		items[i], err = json.Marshal(fields)
		if err != nil {
			return nil, err
		}
	}
	result := p.Slice(items).(map[string]any)
	pages := (total + int64(p.Size) - 1) / int64(p.Size)
	result["totalElements"], result["totalPages"], result["last"] = total, pages, int64(p.Number)+1 >= pages
	return result, tx.Commit(ctx)
}
func (s *Service) Retry(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var status string
	var published *time.Time
	err = tx.QueryRow(ctx, `SELECT status,published_at FROM t_outbox_events WHERE id=$1 FOR UPDATE`, id).Scan(&status, &published)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Событие outbox не найдено")
	}
	if err != nil {
		return err
	}
	if published != nil || (status != "PENDING" && status != "RETRY" && status != "DEAD_LETTER") {
		return dbx.Business("Событие нельзя вернуть в очередь доставки")
	}
	if _, err = tx.Exec(ctx, `UPDATE t_outbox_events SET status='RETRY',attempts=0,last_error=NULL,next_attempt_at=clock_timestamp() WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
