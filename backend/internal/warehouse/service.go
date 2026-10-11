package warehouse

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// Balance preserves Java's numeric response and zero for an absent balance.
func (s *Service) Balance(ctx context.Context, id string) (json.Number, error) {
	var quantity string
	err := s.pool.QueryRow(ctx, `SELECT coalesce((SELECT quantity FROM public.t_stock_balance WHERE nomenclature_id=$1),0)::text`, id).Scan(&quantity)
	return json.Number(quantity), err
}

type Overview struct {
	TotalPositionsCount int               `json:"totalPositionsCount"`
	LowStockCount       int               `json:"lowStockCount"`
	Items               []json.RawMessage `json:"items"`
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	result := Overview{Items: []json.RawMessage{}}
	// Rules and balances share one statement snapshot. PostgreSQL round(numeric)
	// matches BigDecimal HALF_UP at the rule boundaries.
	rows, err := s.pool.Query(ctx, `SELECT jsonb_build_object('nomenclatureId',n.id,'name',n.name,'unit',n.unit,
 'currentQuantity',coalesce(b.quantity,0),'minStockLevel',n.min_stock_level,'statusCode',rule.code),rule.code,coalesce(rule.counts_as_low,false)
 FROM public.t_nomenclature n LEFT JOIN public.t_stock_balance b ON b.nomenclature_id=n.id
 LEFT JOIN LATERAL (
 SELECT r.code,r.counts_as_low FROM public.t_stock_level_rules r
 WHERE r.is_active AND r.min_ratio<=CASE WHEN n.min_stock_level<=0 THEN 1 ELSE round(coalesce(b.quantity,0)/n.min_stock_level,4) END
 AND (r.max_ratio IS NULL OR r.max_ratio>CASE WHEN n.min_stock_level<=0 THEN 1 ELSE round(coalesce(b.quantity,0)/n.min_stock_level,4) END)
 ORDER BY r.sort_order,r.code LIMIT 1
 ) rule ON true
 WHERE n.active AND n.deleted_at IS NULL ORDER BY n.name,n.id`)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var item json.RawMessage
		var code *string
		var low bool
		if err = rows.Scan(&item, &code, &low); err != nil {
			return result, err
		}
		if code == nil {
			return result, dbx.Business("Для коэффициента остатка не найдено активное правило")
		}
		result.Items = append(result.Items, item)
		if low {
			result.LowStockCount++
		}
	}
	result.TotalPositionsCount = len(result.Items)
	return result, rows.Err()
}

func (s *Service) RecentMovements(ctx context.Context, limit int) ([]json.RawMessage, error) {
	if limit < 1 {
		return nil, dbx.Business("Количество движений должно быть положительным")
	}
	rows, err := s.pool.Query(ctx, `SELECT jsonb_build_object('id',m.id,'nomenclatureName',n.name,
 'movementTypeCode',m.movement_type,'quantity',m.quantity,'reason',m.reason),m.created_at
 FROM public.t_stock_movement m JOIN public.t_nomenclature n ON n.id=m.nomenclature_id
 ORDER BY m.created_at DESC,m.id LIMIT $1`, min(limit, 100))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []json.RawMessage{}
	for rows.Next() {
		var raw json.RawMessage
		var at time.Time
		if err = rows.Scan(&raw, &at); err != nil {
			return nil, err
		}
		var fields map[string]json.RawMessage
		if err = json.Unmarshal(raw, &fields); err != nil {
			return nil, err
		}
		fields["createdAt"], err = json.Marshal(at.UTC())
		if err != nil {
			return nil, err
		}
		raw, err = json.Marshal(fields)
		if err != nil {
			return nil, err
		}
		result = append(result, raw)
	}
	return result, rows.Err()
}
