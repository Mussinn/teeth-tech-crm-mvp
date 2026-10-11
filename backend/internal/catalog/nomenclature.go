package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf16"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/pagination"
)

type NomenclatureRequest struct {
	Code          string      `json:"code"`
	Name          string      `json:"name"`
	Unit          string      `json:"unit"`
	MinStockLevel json.Number `json:"minStockLevel"`
}

const nomenclatureSelect = `SELECT jsonb_build_object('id',n.id,'code',n.code,'name',n.name,'unit',n.unit,
 'minStockLevel',n.min_stock_level,'active',n.active,'currentStock',coalesce(b.quantity,0))
 FROM public.t_nomenclature n LEFT JOIN public.t_stock_balance b ON b.nomenclature_id=n.id`

func (s *Service) NomenclaturePage(ctx context.Context, active bool, p pagination.Page) (any, error) {
	order, err := p.Order(map[string]string{"id": "n.id", "code": "n.code", "name": "n.name", "unit": "n.unit",
		"minStockLevel": "n.min_stock_level", "active": "n.active", "createdAt": "n.created_at", "updatedAt": "n.updated_at"}, "n.id")
	if err != nil {
		return nil, dbx.Business("Неподдерживаемое поле сортировки")
	}
	items, err := dbx.List(ctx, s.pool, nomenclatureSelect+` WHERE n.deleted_at IS NULL AND (NOT $1 OR n.active)`+order+` LIMIT $2 OFFSET $3`, active, p.Size+1, p.Offset())
	return p.Slice(items), err
}

func (s *Service) Nomenclature(ctx context.Context, id string) (json.RawMessage, error) {
	v, err := dbx.One(ctx, s.pool, nomenclatureSelect+` WHERE n.id=$1 AND n.deleted_at IS NULL`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = dbx.Missing("Номенклатура с ID [" + id + "] не найдена")
	}
	return v, err
}

var stockDecimal = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$`)

// Match BigDecimal @Digits before sending exact decimal text to PostgreSQL.
func validMinStock(n json.Number) bool {
	return n == "" || validStockDecimal(n, 15, 4)
}

func validStockDecimal(n json.Number, integerDigits, fractionDigits int) bool {
	s := string(n)
	if len(s) > 100 || !stockDecimal.MatchString(s) {
		return false
	}
	mantissa, exponent := s, 0
	if i := strings.IndexAny(s, "eE"); i >= 0 {
		var err error
		exponent, err = strconv.Atoi(s[i+1:])
		if err != nil || exponent > 100 || exponent < -100 {
			return false
		}
		mantissa = s[:i]
	}
	scale := 0
	if i := strings.IndexByte(mantissa, '.'); i >= 0 {
		scale = len(mantissa) - i - 1
	}
	digits := strings.TrimLeft(strings.ReplaceAll(strings.TrimPrefix(mantissa, "-"), ".", ""), "0")
	precision := len(digits)
	if precision == 0 {
		precision = 1
	}
	if scale-exponent > fractionDigits || precision-scale+exponent > integerDigits {
		return false
	}
	v, ok := new(big.Rat).SetString(s)
	return ok && v.Sign() >= 0
}

func validateNomenclature(r NomenclatureRequest) error {
	for _, v := range []struct {
		s     string
		limit int
	}{{r.Code, 100}, {r.Name, 255}, {r.Unit, 50}} {
		// Java Character.isWhitespace excludes nonbreaking spaces and NEL.
		blank := strings.TrimFunc(v.s, func(c rune) bool {
			return (unicode.IsSpace(c) && c != 0x85 && c != 0xa0 && c != 0x2007 && c != 0x202f) || c >= 0x1c && c <= 0x1f
		}) == ""
		if blank || len(utf16.Encode([]rune(v.s))) > v.limit {
			return dbx.Validation("Артикул, название и единица измерения обязательны; превышена допустимая длина")
		}
	}
	if !validMinStock(r.MinStockLevel) {
		return dbx.Validation("Минимальный остаток должен быть неотрицательным: до 15 целых и 4 дробных знаков")
	}
	return nil
}

func (s *Service) CreateNomenclature(ctx context.Context, r NomenclatureRequest) (result json.RawMessage, err error) {
	if err = validateNomenclature(r); err != nil {
		return nil, err
	}
	trim := func(v string) string { return strings.TrimFunc(v, func(c rune) bool { return c <= 0x20 }) }
	r.Code, r.Name, r.Unit = trim(r.Code), trim(r.Name), trim(r.Unit)
	minimum := string(r.MinStockLevel)
	if minimum == "" {
		minimum = "0"
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_nomenclature WHERE code=$1 AND deleted_at IS NULL)`, r.Code).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, dbx.Missing("В справочнике [Номенклатура с артикулом] уже есть запись: " + r.Code)
	}
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO public.t_nomenclature(code,name,unit,min_stock_level,active) VALUES($1,$2,$3,$4::numeric,true) RETURNING id::text`, r.Code, r.Name, r.Unit, minimum).Scan(&id); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO public.t_stock_balance(nomenclature_id,quantity) VALUES($1,0)`, id); err != nil {
		return nil, err
	}
	result, err = dbx.One(ctx, tx, nomenclatureSelect+` WHERE n.id=$1`, id)
	if err != nil {
		return nil, err
	}
	err = tx.Commit(ctx)
	return result, err
}
