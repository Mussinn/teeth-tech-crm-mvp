package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

type Material struct {
	Name             *string `json:"name"`
	Description      *string `json:"description"`
	NomenclatureCode *string `json:"nomenclatureCode"`
	Unit             *string `json:"unit"`
	IsActive         *bool   `json:"isActive"`
}

const materialSelect = `SELECT jsonb_build_object('id',m.id,'name',m.name,'description',m.description,'isActive',m.is_active,
 'nomenclatureId',n.id,'nomenclatureCode',n.code,'unit',n.unit,'currentStock',coalesce(b.quantity,0))
 FROM public.t_materials m LEFT JOIN public.t_nomenclature n ON n.id=m.nomenclature_id
 LEFT JOIN public.t_stock_balance b ON b.nomenclature_id=n.id`

func (s *Service) Materials(ctx context.Context, active bool) ([]json.RawMessage, error) {
	return dbx.List(ctx, s.pool, materialSelect+` WHERE m.deleted_at IS NULL AND (NOT $1 OR m.is_active) ORDER BY m.name,m.id`, active)
}

func (s *Service) Material(ctx context.Context, id string) (json.RawMessage, error) {
	result, err := dbx.One(ctx, s.pool, materialSelect+` WHERE m.id=$1 AND m.deleted_at IS NULL`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = missing("Материал", id)
	}
	return result, err
}

func (s *Service) SaveMaterial(ctx context.Context, id string, r Material, deleted bool) (result json.RawMessage, err error) {
	if !deleted {
		if !max(r.Name, 100) || !max(r.NomenclatureCode, 100) || !max(r.Unit, 50) {
			return nil, dbx.Validation("Название, артикул или единица измерения слишком длинные")
		}
		if id == "" && (strings.TrimSpace(str(r.Name)) == "" || strings.TrimSpace(str(r.NomenclatureCode)) == "" || strings.TrimSpace(str(r.Unit)) == "") {
			return nil, dbx.Validation("Название, артикул и единица измерения обязательны")
		}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	var nomenclature *string
	if id == "" {
		var exists bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_materials WHERE name=$1 AND deleted_at IS NULL)`, r.Name).Scan(&exists)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, dbx.Missing("В справочнике [Материал] уже есть запись: " + str(r.Name))
		}
		var nid string
		err = tx.QueryRow(ctx, `INSERT INTO public.t_nomenclature(code,name,unit,min_stock_level,active) VALUES($1,$2,$3,0,true) RETURNING id::text`, r.NomenclatureCode, r.Name, r.Unit).Scan(&nid)
		if err != nil {
			return nil, err
		}
		nomenclature = &nid
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_stock_balance(nomenclature_id,quantity) VALUES($1,0)`, nid); err != nil {
			return nil, err
		}
		err = tx.QueryRow(ctx, `INSERT INTO public.t_materials(name,description,is_active,nomenclature_id) VALUES($1,$2,true,$3) RETURNING id::text`, r.Name, r.Description, nid).Scan(&id)
		if err != nil {
			return nil, err
		}
	} else {
		err = tx.QueryRow(ctx, `SELECT nomenclature_id::text FROM public.t_materials WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, id).Scan(&nomenclature)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, missing("Материал", id)
		}
		if err != nil {
			return nil, err
		}
		if nomenclature != nil {
			var locked string
			if err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_nomenclature WHERE id=$1 FOR UPDATE`, *nomenclature).Scan(&locked); err != nil {
				return nil, err
			}
		}
		if deleted {
			_, err = tx.Exec(ctx, `UPDATE public.t_materials SET is_active=false,deleted_at=now(),updated_at=now() WHERE id=$1`, id)
		} else {
			_, err = tx.Exec(ctx, `UPDATE public.t_materials SET name=coalesce($2,name),description=coalesce($3,description),is_active=coalesce($4,is_active),updated_at=now() WHERE id=$1`, id, r.Name, r.Description, r.IsActive)
		}
		if err != nil {
			return nil, err
		}
		if nomenclature != nil {
			// Match Java: enabling a material does not automatically reactivate its stock item.
			_, err = tx.Exec(ctx, `UPDATE public.t_nomenclature SET name=coalesce($2,name),unit=coalesce($3,unit),active=CASE WHEN $4 THEN false ELSE active END,updated_at=now() WHERE id=$1`, *nomenclature, r.Name, r.Unit, deleted || (r.IsActive != nil && !*r.IsActive))
			if err != nil {
				return nil, err
			}
		}
	}
	if !deleted {
		result, err = dbx.One(ctx, tx, materialSelect+` WHERE m.id=$1`, id)
		if err != nil {
			return nil, err
		}
	}
	err = tx.Commit(ctx)
	return result, err
}
