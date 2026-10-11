package orders

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/pagination"
)

type Service struct {
	pool             *pgxpool.Pool
	maxKanbanCards   int
	warehouseEnabled bool
	financeEnabled   bool
	kpiEnabled       bool
}

func New(pool *pgxpool.Pool) *Service { return NewWithKanbanLimit(pool, 300) }

func NewWithKanbanLimit(pool *pgxpool.Pool, limit int) *Service {
	return &Service{pool: pool, warehouseEnabled: true, financeEnabled: true, maxKanbanCards: max(1, min(limit, 1000))}
}

// FormOptions keeps Java's LIKE search semantics (% and _ are wildcards),
// but every value is a bound parameter, never part of the SQL statement.
func (s *Service) FormOptions(ctx context.Context, kind, clinicID, role, query string, limit int) (any, error) {
	if limit < 1 || limit > 50 {
		return nil, dbx.Validation("limit должен быть от 1 до 50")
	}
	query = strings.ToLower(strings.TrimSpace(query))
	var sql string
	args := []any{"%" + query + "%", limit + 1}
	switch kind {
	case "people":
		var exists bool
		if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_clinics WHERE id=$1 AND deleted_at IS NULL)`, clinicID).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			return nil, dbx.Missing("Клиника с ID " + clinicID + " не найдена")
		}
		args = append(args, clinicID, strings.ToLower(role))
		sql = `SELECT jsonb_build_object('id',id,'label',full_name,'code',role,'description',CASE WHEN role='patient' THEN (SELECT 'Последний заказ: '||o.order_number||' · '||o.created_at::date::text FROM t_orders o WHERE o.patient_card_id=t_clinic_user_cards.id AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1) ELSE NULL END) FROM public.t_clinic_user_cards WHERE clinic_id=$3 AND role=$4 AND deleted_at IS NULL AND lower(full_name) LIKE $1 ESCAPE '' ORDER BY full_name,id LIMIT $2`
	case "materials":
		sql = `SELECT jsonb_build_object('id',m.id,'label',m.name,'code',n.code,'description',m.description) FROM public.t_materials m LEFT JOIN public.t_nomenclature n ON n.id=m.nomenclature_id WHERE m.is_active AND m.deleted_at IS NULL AND (lower(m.name) LIKE $1 ESCAPE '' OR lower(coalesce(n.code,'')) LIKE $1 ESCAPE '') ORDER BY m.name,m.id LIMIT $2`
	case "work-types":
		sql = `SELECT jsonb_build_object('id',id,'label',name,'code',code,'description',description) FROM public.t_work_types WHERE is_active AND deleted_at IS NULL AND (lower(name) LIKE $1 ESCAPE '' OR lower(code) LIKE $1 ESCAPE '') ORDER BY name,id LIMIT $2`
	case "colors":
		sql = `SELECT jsonb_build_object('id',id,'label',code,'code',code,'description',name) FROM public.t_colors WHERE is_active AND deleted_at IS NULL AND (lower(code) LIKE $1 ESCAPE '' OR lower(coalesce(name,'')) LIKE $1 ESCAPE '') ORDER BY code,id LIMIT $2`
	default:
		return nil, fmt.Errorf("unknown form option")
	}
	items, err := dbx.List(ctx, s.pool, sql, args...)
	if err != nil {
		return nil, err
	}
	return (pagination.Page{Size: limit}).Slice(items), nil
}

func (s *Service) ConfigureMVP(warehouse, finance bool) {
	s.warehouseEnabled = warehouse
	s.financeEnabled = finance
	s.kpiEnabled = true
}
