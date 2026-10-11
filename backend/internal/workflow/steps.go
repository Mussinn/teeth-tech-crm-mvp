package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

type StepRequest struct {
	WorkTypeID              string `json:"workTypeId"`
	FromStatusID            string `json:"fromStatusId"`
	ToStatusID              string `json:"toStatusId"`
	RequiredRole            string `json:"requiredRole"`
	SortOrder               int32  `json:"sortOrder"`
	MaterialReportRequired  bool   `json:"materialReportRequired"`
	AllowUnplannedMaterials bool   `json:"allowUnplannedMaterials"`
}

const stepSelect = `SELECT jsonb_build_object('id',w.id,'workTypeId',wt.id,'workTypeName',wt.name,'fromStatusId',f.id,'fromStatusCode',f.code,'fromStatusName',f.name,'toStatusId',t.id,'toStatusCode',t.code,'toStatusName',t.name,'requiredRole',w.required_role,'sortOrder',w.sort_order,'materialReportRequired',w.material_report_required,'allowUnplannedMaterials',w.allow_unplanned_materials)
 FROM public.t_workflow_steps w JOIN public.t_work_types wt ON wt.id=w.work_type_id JOIN public.t_order_statuses f ON f.id=w.from_status_id JOIN public.t_order_statuses t ON t.id=w.to_status_id`

func (s *Service) Steps(ctx context.Context, workTypeID string) ([]json.RawMessage, error) {
	return dbx.List(ctx, s.pool, stepSelect+` WHERE w.work_type_id=$1 AND w.deleted_at IS NULL ORDER BY w.sort_order,w.id`, workTypeID)
}
func (s *Service) DeleteStep(ctx context.Context, id string) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE public.t_workflow_steps SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return dbx.Missing("Перемещение с ID " + id + " не найден")
	}
	return tx.Commit(ctx)
}
func saveStep(ctx context.Context, tx pgx.Tx, r StepRequest) (json.RawMessage, error) {
	var id string
	err := tx.QueryRow(ctx, `INSERT INTO public.t_workflow_steps(work_type_id,from_status_id,to_status_id,required_role,sort_order,material_report_required,allow_unplanned_materials) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`, r.WorkTypeID, r.FromStatusID, r.ToStatusID, r.RequiredRole, r.SortOrder, r.MaterialReportRequired, r.AllowUnplannedMaterials).Scan(&id)
	if err != nil {
		return nil, err
	}
	return dbx.One(ctx, tx, stepSelect+` WHERE w.id=$1`, id)
}
func (s *Service) CreateStep(ctx context.Context, r StepRequest) (result json.RawMessage, err error) {
	if strings.EqualFold(r.FromStatusID, r.ToStatusID) {
		return nil, dbx.Business("Начальный и целевой статусы не могут совпадать")
	}
	if strings.TrimSpace(r.RequiredRole) == "" || !fits(normalizeRole(r.RequiredRole), 50) {
		return nil, dbx.Validation("Роль исполнителя обязательна и должна занимать не более 50 символов")
	}
	r.RequiredRole = normalizeRole(r.RequiredRole)
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	var id string
	err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_work_types WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, r.WorkTypeID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Business("Указанный тип работы не найден")
	}
	if err != nil {
		return nil, err
	}
	for _, value := range []struct{ id, message string }{{r.FromStatusID, "Начальный статус не найден"}, {r.ToStatusID, "Целевой статус не найден"}} {
		err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_order_statuses WHERE id=$1 AND is_active FOR SHARE`, value.id).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, dbx.Business(value.message)
		}
		if err != nil {
			return nil, err
		}
	}
	if err = lockRole(ctx, tx, r.RequiredRole); err != nil {
		return nil, err
	}
	result, err = saveStep(ctx, tx, r)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

type Stage struct {
	Code                    string  `json:"code"`
	Name                    string  `json:"name"`
	Description             *string `json:"description"`
	ColorHex                *string `json:"colorHex"`
	RequiredRole            string  `json:"requiredRole"`
	MaterialReportRequired  bool    `json:"materialReportRequired"`
	AllowUnplannedMaterials bool    `json:"allowUnplannedMaterials"`
}
type Template struct {
	Code        string   `json:"workTypeCode"`
	Name        string   `json:"workTypeName"`
	Description *string  `json:"description"`
	Stages      []*Stage `json:"stages"`
}
type TemplateResponse struct {
	ID    string            `json:"workTypeId"`
	Code  string            `json:"workTypeCode"`
	Name  string            `json:"workTypeName"`
	Steps []json.RawMessage `json:"steps"`
}

func validateTemplate(r Template) error {
	if strings.TrimSpace(r.Code) == "" || strings.TrimSpace(r.Name) == "" || !fits(normalize(r.Code), 255) || !fits(strings.TrimSpace(r.Name), 255) {
		return dbx.Validation("Код и название вида работы обязательны (до 255 символов)")
	}
	if len(r.Stages) == 0 || len(r.Stages) > 100 {
		return dbx.Validation("Workflow должен содержать от 1 до 100 промежуточных этапов")
	}
	codes := map[string]bool{}
	for _, stage := range r.Stages {
		if stage == nil {
			return dbx.Validation("Промежуточный этап не может быть null")
		}
		if err := validateStatus(Status{Code: stage.Code, Name: strings.TrimSpace(stage.Name), ColorHex: stage.ColorHex}); err != nil {
			return err
		}
		if strings.TrimSpace(stage.RequiredRole) == "" || !fits(normalizeRole(stage.RequiredRole), 50) {
			return dbx.Validation("Для каждого перехода requiredRole обязателен (до 50 символов)")
		}
		code := normalize(stage.Code)
		if code == "TODO" || code == "WAITING_FOR_APPROVAL" || code == "ORDER_CLOSED" {
			return dbx.Business("Статус " + code + " является системным и добавляется backend автоматически")
		}
		if codes[code] {
			return dbx.Business("Код статуса повторяется: " + stage.Code)
		}
		codes[code] = true
	}
	return nil
}
func (s *Service) CreateTemplate(ctx context.Context, r Template) (result TemplateResponse, err error) {
	if err = validateTemplate(r); err != nil {
		return result, err
	}
	tx, err := s.begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	roles := map[string]bool{"ROLE_DISPATCHER": true}
	for _, stage := range r.Stages {
		roles[normalizeRole(stage.RequiredRole)] = true
	}
	roleCodes := []string{}
	for role := range roles {
		roleCodes = append(roleCodes, role)
	}
	sort.Strings(roleCodes)
	for _, role := range roleCodes {
		if err = lockRole(ctx, tx, role); err != nil {
			return result, err
		}
	}
	result.Code, result.Name = normalize(r.Code), strings.TrimSpace(r.Name)
	err = tx.QueryRow(ctx, `INSERT INTO public.t_work_types(code,name,description,is_active) VALUES($1,$2,$3,true) RETURNING id::text`, result.Code, result.Name, r.Description).Scan(&result.ID)
	if err != nil {
		return result, err
	}
	system := map[string]string{}
	for _, expected := range []struct {
		code                      string
		initial, terminal, review bool
	}{{"TODO", true, false, false}, {"WAITING_FOR_APPROVAL", false, false, true}, {"ORDER_CLOSED", false, true, false}} {
		var id string
		var initial, terminal, review bool
		err = tx.QueryRow(ctx, `SELECT id::text,is_initial,is_terminal,is_review FROM public.t_order_statuses WHERE code=$1 FOR SHARE`, expected.code).Scan(&id, &initial, &terminal, &review)
		if errors.Is(err, pgx.ErrNoRows) {
			return result, dbx.Business("Обязательный системный статус отсутствует: " + expected.code)
		}
		if err != nil {
			return result, err
		}
		if initial != expected.initial || terminal != expected.terminal || review != expected.review {
			return result, dbx.Business("Некорректные системные флаги статуса " + expected.code)
		}
		system[expected.code] = id
	}
	ids := []string{}
	for i, stage := range r.Stages {
		var id string
		var initial, terminal, review bool
		code := normalize(stage.Code)
		err = tx.QueryRow(ctx, `SELECT id::text,is_initial,is_terminal,is_review FROM public.t_order_statuses WHERE code=$1 FOR SHARE`, code).Scan(&id, &initial, &terminal, &review)
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `INSERT INTO public.t_order_statuses(code,name,description,color_hex,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING id::text`, code, strings.TrimSpace(stage.Name), stage.Description, stage.ColorHex, i+2).Scan(&id)
		} else if err == nil && (initial || terminal || review) {
			return result, dbx.Business("Существующий статус " + code + " не является промежуточным")
		}
		if err != nil {
			return result, err
		}
		var active bool
		if err = tx.QueryRow(ctx, `SELECT is_active FROM t_order_statuses WHERE id=$1`, id).Scan(&active); err != nil {
			return result, err
		}
		if !active {
			return result, dbx.Business("Сначала активируйте статус " + code)
		}
		ids = append(ids, id)
	}
	steps := []StepRequest{{WorkTypeID: result.ID, FromStatusID: system["TODO"], ToStatusID: ids[0], RequiredRole: "ROLE_DISPATCHER", SortOrder: 1}}
	for i, stage := range r.Stages {
		to, role := system["WAITING_FOR_APPROVAL"], normalizeRole(stage.RequiredRole)
		if i+1 < len(ids) {
			to = ids[i+1]
		}
		steps = append(steps, StepRequest{result.ID, ids[i], to, role, int32(i + 2), stage.MaterialReportRequired, stage.AllowUnplannedMaterials})
	}
	steps = append(steps, StepRequest{WorkTypeID: result.ID, FromStatusID: system["WAITING_FOR_APPROVAL"], ToStatusID: system["ORDER_CLOSED"], RequiredRole: "ROLE_DISPATCHER", SortOrder: int32(len(ids) + 2)})
	for _, step := range steps {
		var item json.RawMessage
		item, err = saveStep(ctx, tx, step)
		if err != nil {
			return result, err
		}
		result.Steps = append(result.Steps, item)
	}
	return result, tx.Commit(ctx)
}
