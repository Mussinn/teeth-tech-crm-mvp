package notifications

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

type Notification struct {
	ID           string     `json:"id"`
	Type         string     `json:"type"`
	Title        string     `json:"title"`
	Message      string     `json:"message"`
	ResourceType *string    `json:"resourceType"`
	ResourceID   *string    `json:"resourceId"`
	ReadAt       *time.Time `json:"readAt"`
	CreatedAt    time.Time  `json:"createdAt"`
}

func (s *Service) Mine(ctx context.Context, owner string, p pagination.Page) (any, error) {
	order, err := p.Order(map[string]string{"id": "id", "type": "type", "title": "title", "message": "message", "resourceType": "resource_type", "resourceId": "resource_id", "readAt": "read_at", "createdAt": "created_at"}, "id")
	if err != nil {
		return nil, dbx.Business("Неподдерживаемое поле сортировки уведомлений")
	}
	// Java's derived query always puts createdAt DESC before the requested sort.
	order = " ORDER BY created_at DESC," + order[len(" ORDER BY "):]
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var total int64
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM t_notifications WHERE user_id=$1`, owner).Scan(&total); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT id::text,type,title,message,resource_type,resource_id::text,read_at,created_at FROM t_notifications WHERE user_id=$1`+order+` LIMIT $2 OFFSET $3`, owner, p.Size, p.Offset())
	if err != nil {
		return nil, err
	}
	items := []json.RawMessage{}
	for rows.Next() {
		var n Notification
		if err = rows.Scan(&n.ID, &n.Type, &n.Title, &n.Message, &n.ResourceType, &n.ResourceID, &n.ReadAt, &n.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		n.CreatedAt = n.CreatedAt.UTC()
		if n.ReadAt != nil {
			v := n.ReadAt.UTC()
			n.ReadAt = &v
		}
		raw, e := json.Marshal(n)
		if e != nil {
			rows.Close()
			return nil, e
		}
		items = append(items, raw)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	result := p.Slice(items).(map[string]any)
	pages := (total + int64(p.Size) - 1) / int64(p.Size)
	result["totalElements"], result["totalPages"], result["last"] = total, pages, int64(p.Number)+1 >= pages
	return result, tx.Commit(ctx)
}
func (s *Service) Unread(ctx context.Context, owner string) (map[string]int64, error) {
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM t_notifications WHERE user_id=$1 AND read_at IS NULL`, owner).Scan(&n)
	return map[string]int64{"count": n}, err
}
func (s *Service) Read(ctx context.Context, owner, id string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE t_notifications SET read_at=coalesce(read_at,clock_timestamp()) WHERE id=$1 AND user_id=$2`, id, owner)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return dbx.Missing("Уведомление не найдено: " + id)
	}
	return nil
}

type Preference struct {
	InAppEnabled    bool    `json:"inAppEnabled"`
	EmailEnabled    bool    `json:"emailEnabled"`
	TelegramEnabled bool    `json:"telegramEnabled"`
	TelegramChatID  *string `json:"telegramChatId"`
	TaskAssigned    bool    `json:"taskAssigned"`
	DeadlineWarning bool    `json:"deadlineWarning"`
	TaskOverdue     bool    `json:"taskOverdue"`
	QualityIncident bool    `json:"qualityIncident"`
	StockWarning    bool    `json:"stockWarning"`
}

const preferenceColumns = `in_app_enabled,email_enabled,telegram_enabled,telegram_chat_id,task_assigned,deadline_warning,task_overdue,quality_incident,stock_warning`

func scanPreference(row pgx.Row) (Preference, error) {
	var p Preference
	err := row.Scan(&p.InAppEnabled, &p.EmailEnabled, &p.TelegramEnabled, &p.TelegramChatID, &p.TaskAssigned, &p.DeadlineWarning, &p.TaskOverdue, &p.QualityIncident, &p.StockWarning)
	if errors.Is(err, pgx.ErrNoRows) {
		return Preference{InAppEnabled: true, TaskAssigned: true, DeadlineWarning: true, TaskOverdue: true, QualityIncident: true, StockWarning: true}, nil
	}
	return p, err
}
func (s *Service) Preference(ctx context.Context, owner string) (Preference, error) {
	return scanPreference(s.pool.QueryRow(ctx, `SELECT `+preferenceColumns+` FROM t_notification_preferences WHERE user_id=$1`, owner))
}
func (s *Service) SavePreference(ctx context.Context, owner string, p Preference) (result Preference, err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	// Same lock as Java preference writes and Telegram link/unlink operations.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,2)`); err != nil {
		return result, err
	}
	current, err := scanPreference(tx.QueryRow(ctx, `SELECT `+preferenceColumns+` FROM t_notification_preferences WHERE user_id=$1`, owner))
	if err != nil {
		return result, err
	}
	if p.TelegramEnabled && current.TelegramChatID == nil {
		return result, dbx.Business("Сначала подключите Telegram через одноразовую ссылку")
	}
	// Client-supplied telegramChatId is deliberately ignored, including null.
	result, err = scanPreference(tx.QueryRow(ctx, `INSERT INTO t_notification_preferences(user_id,in_app_enabled,email_enabled,telegram_enabled,task_assigned,deadline_warning,task_overdue,quality_incident,stock_warning) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id) DO UPDATE SET in_app_enabled=excluded.in_app_enabled,email_enabled=excluded.email_enabled,telegram_enabled=excluded.telegram_enabled,task_assigned=excluded.task_assigned,deadline_warning=excluded.deadline_warning,task_overdue=excluded.task_overdue,quality_incident=excluded.quality_incident,stock_warning=excluded.stock_warning,updated_at=now() RETURNING `+preferenceColumns, owner, p.InAppEnabled, p.EmailEnabled, p.TelegramEnabled, p.TaskAssigned, p.DeadlineWarning, p.TaskOverdue, p.QualityIncident, p.StockWarning))
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
