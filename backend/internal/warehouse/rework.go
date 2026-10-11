package warehouse

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

type ReworkWriteOff struct {
	NomenclatureID string      `json:"nomenclatureId"`
	Quantity       json.Number `json:"quantity"`
}

func ValidateReworkWriteOffs(items []*ReworkWriteOff) error {
	for _, item := range items {
		if item == nil || !materialUUID.MatchString(item.NomenclatureID) || !validQuantity(item.Quantity, true) {
			return dbx.Validation("Для списания нужны UUID и положительное количество с точностью до 4 знаков")
		}
	}
	return nil
}

// WriteOffRework consumes additional material without spending any task's
// reserved stock. The caller owns the transaction and task lock.
func WriteOffRework(ctx context.Context, tx pgx.Tx, incidentID string, items []*ReworkWriteOff) error {
	if err := ValidateReworkWriteOffs(items); err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}
	if err := LockCreation(ctx, tx); err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, item := range items {
		id := strings.ToLower(item.NomenclatureID)
		if seen[id] {
			return dbx.Business("Одна номенклатура не должна повторяться в списке материалов для переделки")
		}
		seen[id] = true
	}
	for _, item := range items {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_nomenclature WHERE id=$1 AND deleted_at IS NULL)`, item.NomenclatureID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return dbx.Missing("Номенклатура не найдена")
		}
		if err := writeOffStock(ctx, tx, "QUALITY_INCIDENT_REWORK", incidentID, "", item.NomenclatureID, string(item.Quantity), string(item.Quantity), "0"); err != nil {
			return err
		}
	}
	return nil
}
