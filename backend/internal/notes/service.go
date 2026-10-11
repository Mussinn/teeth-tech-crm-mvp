package notes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/pagination"
)

type Service struct {
	pool             *pgxpool.Pool
	retention, limit int
}

func New(pool *pgxpool.Pool) *Service { return NewWithLimits(pool, 30, 100) }
func NewWithLimits(pool *pgxpool.Pool, retention, limit int) *Service {
	return &Service{pool, retention, limit}
}

type Request struct {
	Title   *string `json:"title"`
	Content *string `json:"content"`
}
type Note struct {
	ID        string    `json:"id"`
	Title     *string   `json:"title"`
	Content   *string   `json:"content"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

const columns = `id::text,title,content,expires_at,created_at,updated_at`

func scan(row pgx.Row) (Note, error) {
	var n Note
	err := row.Scan(&n.ID, &n.Title, &n.Content, &n.ExpiresAt, &n.CreatedAt, &n.UpdatedAt)
	n.ExpiresAt = n.ExpiresAt.UTC()
	n.CreatedAt = n.CreatedAt.UTC()
	n.UpdatedAt = n.UpdatedAt.UTC()
	return n, err
}
func javaTrim(s string) string { return strings.TrimFunc(s, func(r rune) bool { return r <= 0x20 }) }
func trimmed(s *string) *string {
	if s == nil {
		return nil
	}
	v := javaTrim(*s)
	if v == "" {
		return nil
	}
	return &v
}
func validate(r Request) error {
	for _, v := range []struct {
		p   *string
		max int
	}{{r.Title, 120}, {r.Content, 5000}} {
		if v.p != nil && len(utf16.Encode([]rune(*v.p))) > v.max {
			return dbx.Validation("Превышена длина заголовка или текста заметки")
		}
	}
	if trimmed(r.Title) == nil && trimmed(r.Content) == nil {
		return dbx.Business("Заметка не должна быть пустой")
	}
	return nil
}
func (s *Service) Mine(ctx context.Context, owner, query string, p pagination.Page) (any, error) {
	p.Size = min(p.Size, 50)
	p.Sort = nil // Java ignores requested sort and uses its own order.
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	now := time.Now()
	q := strings.ToLower(javaTrim(query))
	const where = ` WHERE owner_id=$1 AND expires_at>$2 AND ($3='' OR lower(coalesce(title,'')) LIKE '%'||$3||'%' ESCAPE '' OR lower(coalesce(content,'')) LIKE '%'||$3||'%' ESCAPE '')`
	var total int64
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM t_personal_notes`+where, owner, now, q).Scan(&total); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT `+columns+` FROM t_personal_notes`+where+` ORDER BY updated_at DESC,id LIMIT $4 OFFSET $5`, owner, now, q, p.Size, p.Offset())
	if err != nil {
		return nil, err
	}
	items := []json.RawMessage{}
	for rows.Next() {
		n, e := scan(rows)
		if e != nil {
			rows.Close()
			return nil, e
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

// Writes serialize per owner in both backends, including the quota check.
// Expiry is checked after row-lock waits; an expired note cannot be revived.
func (s *Service) Write(ctx context.Context, owner, id, method string, r Request) (result Note, err error) {
	if method != "DELETE" {
		if err = validate(r); err != nil {
			return result, err
		}
	}
	defer func() { err = dbx.Constraint(err) }()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('personal-notes:'||$1::uuid::text,0))`, owner); err != nil {
		return result, err
	}
	if id != "" {
		var expires time.Time
		err = tx.QueryRow(ctx, `SELECT expires_at FROM t_personal_notes WHERE id=$1 AND owner_id=$2 FOR UPDATE`, id, owner).Scan(&expires)
		if errors.Is(err, pgx.ErrNoRows) {
			return result, dbx.Missing("Личная заметка не найдена")
		}
		if err != nil {
			return result, err
		}
		if !expires.After(time.Now()) {
			return result, dbx.Missing("Личная заметка не найдена")
		}
	}
	now := time.Now()
	expires := now.AddDate(0, 0, s.retention)
	switch method {
	case "POST":
		var count int
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM t_personal_notes WHERE owner_id=$1 AND expires_at>$2`, owner, now).Scan(&count); err != nil {
			return result, err
		}
		if count >= s.limit {
			return result, dbx.Business(fmt.Sprintf("Достигнут лимит личных заметок: %d", s.limit))
		}
		result, err = scan(tx.QueryRow(ctx, `INSERT INTO t_personal_notes(owner_id,title,content,expires_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5) RETURNING `+columns, owner, trimmed(r.Title), trimmed(r.Content), expires, now))
	case "PUT":
		result, err = scan(tx.QueryRow(ctx, `UPDATE t_personal_notes SET title=$3,content=$4,expires_at=$5,updated_at=$6 WHERE id=$1 AND owner_id=$2 RETURNING `+columns, id, owner, trimmed(r.Title), trimmed(r.Content), expires, now))
	case "DELETE":
		_, err = tx.Exec(ctx, `DELETE FROM t_personal_notes WHERE id=$1 AND owner_id=$2`, id, owner)
	default:
		return result, dbx.Business("Неподдерживаемая операция")
	}
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
