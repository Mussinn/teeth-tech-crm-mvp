package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

type NormRequest struct {
	WorkTypeID     string      `json:"workTypeId"`
	MaterialID     string      `json:"materialId"`
	NomenclatureID string      `json:"nomenclatureId"`
	NormQuantity   json.Number `json:"normQuantity"`
	WastePercent   json.Number `json:"wastePercent"`
}

type Norm struct {
	NormRequest
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

var normUUID = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func (s *Service) SaveNorm(ctx context.Context, r NormRequest) (result Norm, err error) {
	if !normUUID.MatchString(r.WorkTypeID) || !normUUID.MatchString(r.MaterialID) || !normUUID.MatchString(r.NomenclatureID) {
		return result, dbx.Validation("Для нормы расхода обязательны UUID типа работы, материала и номенклатуры")
	}
	if !validStockDecimal(r.NormQuantity, 15, 4) {
		return result, dbx.Validation("Норма расхода должна быть положительной: до 15 целых и 4 дробных знаков")
	}
	quantity, _ := new(big.Rat).SetString(string(r.NormQuantity))
	if quantity.Sign() <= 0 {
		return result, dbx.Validation("Норма расхода должна быть строго больше нуля")
	}
	if r.WastePercent == "" {
		r.WastePercent = "0"
	}
	if !validStockDecimal(r.WastePercent, 3, 2) {
		return result, dbx.Validation("Процент потерь: от 0 до 100, до 2 дробных знаков")
	}
	waste, _ := new(big.Rat).SetString(string(r.WastePercent))
	if waste.Cmp(big.NewRat(100, 1)) > 0 {
		return result, dbx.Validation("Процент потерь не может превышать 100")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	for _, ref := range []struct{ table, field, id string }{{"t_work_types", "workTypeId", r.WorkTypeID}, {"t_materials", "materialId", r.MaterialID}, {"t_nomenclature", "nomenclatureId", r.NomenclatureID}} {
		var id string
		err = tx.QueryRow(ctx, `SELECT id::text FROM public.`+ref.table+` WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, ref.id).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return result, dbx.Missing("Ссылка нормы расхода не найдена: " + ref.field)
		}
		if err != nil {
			return result, err
		}
	}
	var amount, percent string
	err = tx.QueryRow(ctx, `INSERT INTO public.t_nomenclature_consumption_norms(work_type_id,material_id,nomenclature_id,norm_quantity,waste_percent)
 VALUES($1,$2,$3,$4::numeric,$5::numeric)
 ON CONFLICT(work_type_id,material_id,nomenclature_id) DO UPDATE SET norm_quantity=EXCLUDED.norm_quantity,waste_percent=EXCLUDED.waste_percent,updated_at=clock_timestamp()
 RETURNING id::text,work_type_id::text,material_id::text,nomenclature_id::text,norm_quantity::text,waste_percent::text,created_at,updated_at`, r.WorkTypeID, r.MaterialID, r.NomenclatureID, string(r.NormQuantity), string(r.WastePercent)).Scan(&result.ID, &result.WorkTypeID, &result.MaterialID, &result.NomenclatureID, &amount, &percent, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		return result, err
	}
	result.NormQuantity, result.WastePercent = json.Number(amount), json.Number(percent)
	result.CreatedAt, result.UpdatedAt = result.CreatedAt.UTC(), result.UpdatedAt.UTC()
	err = tx.Commit(ctx)
	return result, err
}

func (s *Service) DeleteNorm(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.t_nomenclature_consumption_norms WHERE id=$1`, id)
	return dbx.Constraint(err)
}
