package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Status struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int32  `json:"sortOrder"`
	ColorHex    *string `json:"colorHex"`
	Initial     bool    `json:"initial"`
	Terminal    bool    `json:"terminal"`
	Review      bool    `json:"review"`
}

const statusObject = `jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'description',s.description,'sortOrder',s.sort_order,'colorHex',s.color_hex,'initial',s.is_initial,'terminal',s.is_terminal,'review',s.is_review,'active',s.is_active)`

var codeSymbols = regexp.MustCompile(`[^A-Z0-9]+`)

func normalize(code string) string {
	return codeSymbols.ReplaceAllString(strings.ToUpper(strings.TrimSpace(code)), "_")
}
func normalizeRole(role string) string {
	role = normalize(role)
	if !strings.HasPrefix(role, "ROLE_") {
		role = "ROLE_" + role
	}
	return role
}
func fits(value string, max int) bool { return utf8.RuneCountInString(value) <= max }
func validateStatus(r Status) error {
	if strings.TrimSpace(r.Code) == "" || strings.TrimSpace(r.Name) == "" {
		return dbx.Validation("Код и название статуса обязательны")
	}
	if !fits(normalize(r.Code), 50) || !fits(r.Name, 50) || (r.ColorHex != nil && !fits(*r.ColorHex, 7)) {
		return dbx.Validation("Код и название статуса — до 50 символов, цвет — до 7")
	}
	return nil
}

// Configuration writes are rare. A transaction-scoped lock serializes Go
// configuration changes, including creation/reuse of shared intermediate statuses.
// Reads and production task writes do not acquire this lock.
func (s *Service) begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}
func (s *Service) Statuses(ctx context.Context, workflowOnly bool) ([]json.RawMessage, error) {
	if !workflowOnly {
		return dbx.List(ctx, s.pool, `SELECT `+statusObject+` FROM public.t_order_statuses s ORDER BY s.sort_order,s.id`)
	}
	// Java deduplicates target statuses in step order, not status.sortOrder.
	return dbx.List(ctx, s.pool, `SELECT `+statusObject+` FROM public.t_order_statuses s JOIN (SELECT to_status_id,min(sort_order) position FROM public.t_workflow_steps WHERE deleted_at IS NULL GROUP BY to_status_id) w ON w.to_status_id=s.id WHERE s.is_active ORDER BY w.position,s.id`)
}
func (s *Service) SaveStatus(ctx context.Context, id string, r Status) (result json.RawMessage, err error) {
	if err = validateStatus(r); err != nil {
		return nil, err
	}
	if id != "" && r.SortOrder == nil {
		return nil, dbx.Validation("sortOrder обязателен при обновлении статуса")
	}
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	if id != "" {
		var code string
		var initial, terminal, review bool
		if err = tx.QueryRow(ctx, `SELECT code,is_initial,is_terminal,is_review FROM t_order_statuses WHERE id=$1 FOR UPDATE`, id).Scan(&code, &initial, &terminal, &review); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, dbx.Missing("Статус не найден")
			}
			return nil, err
		}
		if systemStatus(code) && (initial != r.Initial || terminal != r.Terminal || review != r.Review) {
			return nil, dbx.Business("Системные флаги статуса изменять нельзя")
		}
	}
	if id == "" {
		err = tx.QueryRow(ctx, `INSERT INTO public.t_order_statuses(code,name,description,sort_order,color_hex,is_initial,is_terminal,is_review) VALUES($1,$2,$3,coalesce($4,0),$5,$6,$7,$8) RETURNING id::text`, normalize(r.Code), r.Name, r.Description, r.SortOrder, r.ColorHex, r.Initial, r.Terminal, r.Review).Scan(&id)
	} else {
		tag, e := tx.Exec(ctx, `UPDATE public.t_order_statuses SET name=$2,description=$3,sort_order=$4,color_hex=$5,is_initial=$6,is_terminal=$7,is_review=$8,updated_at=now() WHERE id=$1`, id, r.Name, r.Description, r.SortOrder, r.ColorHex, r.Initial, r.Terminal, r.Review)
		err = e
		if err == nil && tag.RowsAffected() == 0 {
			return nil, dbx.Missing("Статус заказа с ID " + id + " не найден")
		}
	}
	if err != nil {
		return nil, err
	}
	result, err = dbx.One(ctx, tx, `SELECT `+statusObject+` FROM public.t_order_statuses s WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
func (s *Service) DeleteStatus(ctx context.Context, id string) (err error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	var code string
	if err = tx.QueryRow(ctx, `SELECT code FROM t_order_statuses WHERE id=$1 FOR UPDATE`, id).Scan(&code); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dbx.Missing("Статус не найден")
		}
		return err
	}
	if systemStatus(code) {
		return dbx.Business("Системный статус удалять нельзя")
	}
	tag, err := tx.Exec(ctx, `DELETE FROM public.t_order_statuses WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return dbx.Missing("Статус заказа с ID " + id + " не найден")
	}
	return tx.Commit(ctx)
}

// A work type code takes precedence over a legacy display name. Role checks are
// exact: ADMIN has no implicit override of a transition's requiredRole in Java.
func (s *Service) Transitions(ctx context.Context, workType, statusID string, roles []string) ([]json.RawMessage, error) {
	if roles == nil {
		roles = []string{}
	}
	items, err := dbx.List(ctx, s.pool, `SELECT `+statusObject+` || jsonb_build_object('createdAt',to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z','updatedAt',to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z')
 FROM public.t_workflow_steps w JOIN public.t_order_statuses s ON s.id=w.to_status_id
 WHERE s.is_active AND w.deleted_at IS NULL AND w.from_status_id=$2 AND w.required_role=ANY($3::text[]) AND w.work_type_id=(
 SELECT id FROM public.t_work_types WHERE deleted_at IS NULL AND (code=$1 OR name=$1) ORDER BY (code=$1) DESC,id LIMIT 1)
 ORDER BY w.sort_order,w.id`, workType, statusID, roles)
	if err != nil {
		return nil, err
	}
	for i, item := range items {
		var value map[string]json.RawMessage
		if err = json.Unmarshal(item, &value); err != nil {
			return nil, err
		}
		for _, key := range []string{"createdAt", "updatedAt"} {
			var raw string
			if err = json.Unmarshal(value[key], &raw); err != nil {
				return nil, err
			}
			instant, e := time.Parse(time.RFC3339Nano, raw)
			if e != nil {
				return nil, e
			}
			value[key], err = json.Marshal(instant.UTC().Format(time.RFC3339Nano))
			if err != nil {
				return nil, err
			}
		}
		items[i], err = json.Marshal(value)
		if err != nil {
			return nil, err
		}
	}
	return items, nil
}

func lockRole(ctx context.Context, tx pgx.Tx, role string) error {
	var id string
	err := tx.QueryRow(ctx, `SELECT id::text FROM public.t_roles WHERE code=$1 FOR KEY SHARE`, role).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbx.Business("Роль отсутствует в БД: " + role)
	}
	return err
}

func systemStatus(code string) bool {
	return code == "TODO" || code == "WAITING_FOR_APPROVAL" || code == "ORDER_CLOSED"
}
func (s *Service) SetStatusActive(ctx context.Context, id string, active bool) (json.RawMessage, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var code string
	err = tx.QueryRow(ctx, `SELECT code FROM t_order_statuses WHERE id=$1 FOR UPDATE`, id).Scan(&code)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Статус не найден")
	}
	if err != nil {
		return nil, err
	}
	if !active {
		if systemStatus(code) {
			return nil, dbx.Business("Системный статус отключать нельзя")
		}
		var used bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id WHERE t.status_id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL)`, id).Scan(&used); err != nil {
			return nil, err
		}
		if used {
			return nil, dbx.Business("На этом этапе есть задачи: сначала переведите их на другой этап")
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE t_order_statuses SET is_active=$2,updated_at=now() WHERE id=$1`, id, active); err != nil {
		return nil, err
	}
	result, err := dbx.One(ctx, tx, `SELECT `+statusObject+` FROM t_order_statuses s WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
