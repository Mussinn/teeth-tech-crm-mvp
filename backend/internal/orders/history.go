package orders

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

type ChangedBy struct {
	UserID   string  `json:"userId"`
	FullName *string `json:"fullName"`
	Initials string  `json:"initials"`
}
type HistoryEvent struct {
	ID        string     `json:"id"`
	EventType string     `json:"eventType"`
	FieldName *string    `json:"fieldName"`
	OldValue  *string    `json:"oldValue"`
	NewValue  *string    `json:"newValue"`
	ChangedAt time.Time  `json:"changedAt"`
	ChangedBy *ChangedBy `json:"changedBy"`
}
type HistoryPage struct {
	Content []HistoryEvent `json:"content"`
	Page    int            `json:"page"`
	Size    int            `json:"size"`
	HasNext bool           `json:"hasNext"`
}

func hasRole(actor identity.User, role string) bool {
	for _, r := range actor.Roles {
		if r == "ROLE_"+role {
			return true
		}
	}
	return false
}

// The dispatcher branch takes precedence over technician assignment, as in
// Java's TaskAccessGuard. Missing tasks are not disclosed to restricted roles.
func requireTaskAccess(ctx context.Context, tx pgx.Tx, taskID string, actor identity.User) error {
	unrestricted := hasRole(actor, "ADMIN") || hasRole(actor, "CHIEF_TECHNICIAN")
	var exists, allowed bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_order_tasks WHERE id=$1 AND deleted_at IS NULL),
 EXISTS(SELECT 1 FROM public.t_order_tasks t WHERE t.id=$1 AND t.deleted_at IS NULL AND
 ($2 OR ($3 AND EXISTS(SELECT 1 FROM public.t_user_work_directions d WHERE d.user_id=$4 AND d.work_direction_id=t.work_direction_id)) OR (NOT $3 AND t.dental_technician_id=$4)))`, taskID, unrestricted, hasRole(actor, "DISPATCHER"), actor.ID).Scan(&exists, &allowed)
	if err != nil {
		return err
	}
	if unrestricted && !exists {
		return dbx.Missing("Task not found: " + taskID)
	}
	if !allowed {
		return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	return nil
}
func initials(name *string) string {
	if name == nil {
		return "?"
	}
	parts := strings.Fields(*name)
	if len(parts) == 0 {
		return "?"
	}
	result := string([]rune(parts[0])[0])
	if len(parts) > 1 {
		result += string([]rune(parts[1])[0])
	}
	return strings.ToUpper(result)
}
func (s *Service) History(ctx context.Context, taskID string, actor identity.User, page, size int) (result HistoryPage, err error) {
	if page < 0 || size < 1 {
		return result, dbx.Validation("page должен быть неотрицательным, size — положительным")
	}
	size = min(size, 100)
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if err = requireTaskAccess(ctx, tx, taskID, actor); err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, `SELECT h.id::text,h.field_name,h.old_value,h.new_value,h.created_at,u.id::text,u.name
 FROM public.t_order_task_history h LEFT JOIN public.t_users u ON u.id=h.changed_by
 WHERE h.task_id=$1 ORDER BY h.created_at DESC,h.id LIMIT $2 OFFSET $3`, taskID, size+1, int64(page)*int64(size))
	if err != nil {
		return result, err
	}
	defer rows.Close()
	result = HistoryPage{Content: []HistoryEvent{}, Page: page, Size: size}
	for rows.Next() {
		var item HistoryEvent
		var userID, name *string
		if err = rows.Scan(&item.ID, &item.FieldName, &item.OldValue, &item.NewValue, &item.ChangedAt, &userID, &name); err != nil {
			return result, err
		}
		item.ChangedAt = item.ChangedAt.UTC()
		item.EventType = "FIELD_CHANGED"
		if item.FieldName == nil {
			item.EventType = "CREATED"
		} else if *item.FieldName == "status_id" {
			item.EventType = "STATUS_CHANGED"
		} else if *item.FieldName == "dental_technician_id" {
			item.EventType = "ASSIGNED"
		}
		if userID != nil {
			item.ChangedBy = &ChangedBy{*userID, name, initials(name)}
		}
		result.Content = append(result.Content, item)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	if len(result.Content) > size {
		result.HasNext = true
		result.Content = result.Content[:size]
	}
	return result, tx.Commit(ctx)
}

// RequireTaskAccess shares the exact order-task guard with attachment operations.
func RequireTaskAccess(ctx context.Context, tx pgx.Tx, id string, actor identity.User) error {
	if !createUUID.MatchString(id) {
		return dbx.Validation("Некорректный taskId")
	}
	return requireTaskAccess(ctx, tx, id, actor)
}
