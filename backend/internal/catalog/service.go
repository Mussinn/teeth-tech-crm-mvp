package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Entry struct {
	Code        *string `json:"code"`
	Name        *string `json:"name"`
	Description *string `json:"description"`
	IsActive    bool    `json:"isActive"`
	Active      bool    `json:"active"`
}
type spec struct{ table, label, projection string }

// All SQL identifiers are constants; route input only selects a known specification.
var specs = map[string]spec{
	"implants":        {"public.mvp_implants", "Имплант", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active)`},
	"model-systems":   {"public.mvp_model_systems", "Модельная система", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active)`},
	"tooth-sets":      {"public.mvp_tooth_sets", "Гарнитура зубов", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active)`},
	"shade-systems":   {"public.mvp_shade_systems", "Расцветка", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active)`},
	"colors":          {"public.t_colors", "Цвет", `jsonb_build_object('id',id,'code',code,'name',name,'isActive',is_active)`},
	"work-types":      {"public.t_work_types", "Тип работы", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active)`},
	"work-directions": {"public.t_work_directions", "Направление работ", `jsonb_build_object('id',id,'code',code,'name',name,'description',description,'active',is_active)`},
}

func (s *Service) List(ctx context.Context, kind string, onlyActive bool) ([]json.RawMessage, error) {
	v, ok := specs[kind]
	if !ok {
		return nil, fmt.Errorf("unknown catalog")
	}
	return dbx.List(ctx, s.pool, "SELECT "+v.projection+" FROM "+v.table+" WHERE deleted_at IS NULL AND (NOT $1 OR is_active) ORDER BY name,id", onlyActive)
}
func str(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
func max(v *string, n int) bool { return utf8.RuneCountInString(str(v)) <= n }

var codeSymbols = regexp.MustCompile(`[^A-Z0-9]+`)

func (s *Service) Save(ctx context.Context, kind, id string, r Entry) (result json.RawMessage, err error) {
	v, ok := specs[kind]
	if !ok {
		return nil, fmt.Errorf("unknown catalog")
	}
	if !max(r.Description, 8000) || !max(r.Code, 255) {
		return nil, dbx.Validation("Слишком длинный код или описание")
	}
	if kind == "colors" {
		if strings.TrimSpace(str(r.Code)) == "" || !max(r.Code, 20) || !max(r.Name, 100) {
			return nil, dbx.Validation("Код цвета обязателен (до 20 символов), название — до 100 символов")
		}
	} else if strings.TrimSpace(str(r.Name)) == "" || !max(r.Name, 255) {
		return nil, dbx.Validation("Название обязательно и не должно превышать 255 символов")
	}
	if kind == "work-directions" && (strings.TrimSpace(str(r.Code)) == "" || !max(r.Code, 100) || !max(r.Description, 500)) {
		return nil, dbx.Validation("Код направления обязателен (до 100 символов), описание — до 500 символов")
	}
	if kind == "work-types" && !max(r.Code, 255) {
		return nil, dbx.Validation("Код типа работы слишком длинный")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	if id != "" {
		var locked string
		err = tx.QueryRow(ctx, "SELECT id::text FROM "+v.table+" WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", id).Scan(&locked)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, missing(v.label, id)
		}
		if err != nil {
			return nil, err
		}
	}
	if kind == "work-directions" {
		name, code := strings.TrimSpace(str(r.Name)), strings.ToUpper(strings.TrimSpace(str(r.Code)))
		if id == "" {
			err = tx.QueryRow(ctx, `INSERT INTO public.t_work_directions(id,name,code,description,is_active,created_at,updated_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,now(),now()) RETURNING id::text`, name, code, r.Description, r.Active).Scan(&id)
		} else {
			_, err = tx.Exec(ctx, `UPDATE public.t_work_directions SET name=$2,code=$3,description=$4,is_active=$5,updated_at=now() WHERE id=$1`, id, name, code, r.Description, r.Active)
		}
	} else if id == "" {
		column, value := "name", str(r.Name)
		if kind == "colors" {
			column, value = "code", str(r.Code)
		}
		var exists bool
		err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM "+v.table+" WHERE "+column+"=$1 AND deleted_at IS NULL)", value).Scan(&exists)
		if err != nil {
			return nil, err
		}
		if exists {
			label := v.label
			if kind == "colors" {
				label = "Цвет с таким кодом уже существует"
			}
			return nil, dbx.Missing("В справочнике [" + label + "] уже есть запись: " + value)
		}
		if kind == "colors" {
			err = tx.QueryRow(ctx, `INSERT INTO public.t_colors(code,name,is_active) VALUES($1,$2,true) RETURNING id::text`, r.Code, r.Name).Scan(&id)
		} else if kind == "work-types" {
			code := str(r.Code)
			if r.Code == nil {
				code = str(r.Name)
			}
			code = codeSymbols.ReplaceAllString(strings.ToUpper(strings.TrimSpace(code)), "_")
			err = tx.QueryRow(ctx, `INSERT INTO public.t_work_types(code,name,description,is_active) VALUES($1,$2,$3,true) RETURNING id::text`, code, r.Name, r.Description).Scan(&id)
		}
		if err == nil && kind != "colors" && kind != "work-types" {
			err = tx.QueryRow(ctx, "INSERT INTO "+v.table+"(code,name,description,is_active) VALUES($1,$2,$3,coalesce($4,true)) RETURNING id::text", str(r.Code), strings.TrimSpace(str(r.Name)), r.Description, r.IsActive).Scan(&id)
		}
	} else if kind == "colors" {
		_, err = tx.Exec(ctx, `UPDATE public.t_colors SET code=$2,name=$3,is_active=$4,updated_at=now() WHERE id=$1`, id, r.Code, r.Name, r.IsActive)
	} else if kind != "work-types" {
		_, err = tx.Exec(ctx, "UPDATE "+v.table+" SET code=$2,name=$3,description=$4,is_active=coalesce($5,is_active),updated_at=now() WHERE id=$1", id, str(r.Code), strings.TrimSpace(str(r.Name)), r.Description, r.IsActive)
	} else {
		// Java deliberately keeps a work type's original code on update.
		_, err = tx.Exec(ctx, `UPDATE public.t_work_types SET name=$2,description=$3,is_active=$4,updated_at=now() WHERE id=$1`, id, r.Name, r.Description, r.IsActive)
	}
	if err != nil {
		return nil, err
	}
	result, err = dbx.One(ctx, tx, "SELECT "+v.projection+" FROM "+v.table+" WHERE id=$1", id)
	if err != nil {
		return nil, err
	}
	err = tx.Commit(ctx)
	return result, err
}
func missing(label, id string) error {
	return dbx.Missing("В справочнике [" + label + "] не найдена запись с ID: " + id)
}
func (s *Service) Delete(ctx context.Context, kind, id string) error {
	v, ok := specs[kind]
	if !ok || kind == "work-directions" {
		return fmt.Errorf("unknown deletable catalog")
	}
	tag, err := s.pool.Exec(ctx, "UPDATE "+v.table+" SET is_active=false,deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL", id)
	if err == nil && tag.RowsAffected() == 0 {
		return missing(v.label, id)
	}
	return err
}
