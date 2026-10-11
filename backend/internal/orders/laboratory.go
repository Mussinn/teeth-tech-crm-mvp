package orders

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

type LabDetails struct {
	ModelSystem          string `json:"modelSystem"`
	ToothSet             string `json:"toothSet"`
	ShadeSystem          string `json:"shadeSystem"`
	Channel              string `json:"channel"`
	Family               string `json:"family"`
	Prescription         string `json:"prescription"`
	Appointment          string `json:"appointment"`
	ImplantSystem        string `json:"implantSystem"`
	ImplantPlatform      string `json:"implantPlatform"`
	ShadeNotes           string `json:"shadeNotes"`
	IncomingItems        string `json:"incomingItems"`
	BatchReferences      string `json:"batchReferences"`
	ShippingAddress      string `json:"shippingAddress"`
	Rush                 bool   `json:"rush"`
	DesignRequired       bool   `json:"designRequired"`
	ApprovalGateStatusID string `json:"approvalGateStatusId"`
}
type LabState struct {
	Details          LabDetails `json:"details"`
	Intake           string     `json:"intake"`
	AcceptedAt       *time.Time `json:"acceptedAt,omitempty"`
	PausedAt         *time.Time `json:"pausedAt,omitempty"`
	OnHold           bool       `json:"onHold"`
	HoldReason       string     `json:"holdReason"`
	Design           string     `json:"design"`
	DesignApprovedBy string     `json:"designApprovedBy"`
	Quality          string     `json:"quality"`
	QualityAt        *time.Time `json:"qualityAt,omitempty"`
	QualityBy        string     `json:"qualityBy"`
	Delivery         string     `json:"delivery"`
	Tracking         string     `json:"tracking"`
	Recipient        string     `json:"recipient"`
	ShippedAt        *time.Time `json:"shippedAt,omitempty"`
	DeliveredAt      *time.Time `json:"deliveredAt,omitempty"`
}
type LabAction struct {
	Version   *int              `json:"version"`
	Action    string            `json:"action"`
	Details   *LabDetails       `json:"details"`
	Checks    map[string]string `json:"checks"`
	Note      string            `json:"note"`
	Clinician string            `json:"clinician"`
	Tracking  string            `json:"tracking"`
	Recipient string            `json:"recipient"`
	Reason    string            `json:"reason"`
}

func defaultLabState() LabState {
	return LabState{Details: LabDetails{Channel: "DIGITAL", Family: "FIXED"}, Intake: "PENDING", Design: "PENDING", Quality: "PENDING", Delivery: "NOT_SENT"}
}
func decodeLabState(raw []byte) (LabState, error) {
	s := defaultLabState()
	err := json.Unmarshal(raw, &s)
	return s, err
}
func labConflict(message string) error {
	return &identity.Failure{Status: 409, Code: "LAB_409", Message: message}
}
func validateLabDetails(d LabDetails) error {
	if len(d.ModelSystem) > 8000 || len(d.ToothSet) > 8000 || len(d.ShadeSystem) > 8000 {
		return dbx.Validation("Слишком длинные реквизиты изделия")
	}
	if !oneOf(d.Channel, "DIGITAL", "PHYSICAL", "HYBRID") || !oneOf(d.Family, "FIXED", "REMOVABLE", "IMPLANT", "ORTHODONTIC", "OTHER") {
		return dbx.Validation("Выберите способ получения и тип изделия")
	}
	for _, v := range []string{d.Prescription, d.ImplantSystem, d.ImplantPlatform, d.ShadeNotes, d.IncomingItems, d.BatchReferences, d.ShippingAddress} {
		if len(v) > 8000 {
			return dbx.Validation("Поле задания слишком длинное")
		}
	}
	if d.ApprovalGateStatusID != "" && !createUUID.MatchString(d.ApprovalGateStatusID) {
		return dbx.Validation("Некорректный этап согласования")
	}
	if d.Appointment != "" {
		if _, err := time.Parse("2006-01-02", d.Appointment); err != nil {
			return dbx.Validation("Некорректная дата приёма пациента")
		}
	}
	return nil
}
func oneOf(v string, values ...string) bool {
	for _, x := range values {
		if v == x {
			return true
		}
	}
	return false
}
func labChecks(checks map[string]string, keys []string, allowNA bool) error {
	for _, k := range keys {
		v := checks[k]
		if v != "PASS" && !(allowNA && v == "NA" && k != "prescription" && k != "traceability") {
			return dbx.Business("Подтвердите все пункты проверки; неприменимые пункты качества отметьте отдельно")
		}
	}
	return nil
}
func applyLabAction(s LabState, r LabAction, actor identity.User, ready, incidents bool, now time.Time) (LabState, error) {
	action := strings.ToUpper(strings.TrimSpace(r.Action))
	note := strings.TrimSpace(r.Note)
	qc := hasRole(actor, "ADMIN") || hasRole(actor, "CHIEF_TECHNICIAN")
	logistics := hasRole(actor, "ADMIN") || hasRole(actor, "DISPATCHER")
	if len(note) > 8000 || len(r.Clinician) > 300 || len(r.Recipient) > 300 || len(r.Tracking) > 1000 {
		return s, dbx.Validation("Слишком длинный комментарий или реквизиты")
	}
	if s.Delivery == "DELIVERED" && action != "RETURN" {
		return s, labConflict("Изделие уже передано клинике. Сначала оформите возврат")
	}
	if s.Delivery == "SHIPPED" && !oneOf(action, "DELIVER", "RETURN") {
		return s, labConflict("Изделие уже отправлено. Сначала оформите возврат")
	}
	switch action {
	case "SAVE":
		if r.Details == nil {
			return s, dbx.Validation("Задание обязательно")
		}
		if err := validateLabDetails(*r.Details); err != nil {
			return s, err
		}

		old := s.Details
		next := *r.Details
		clinicalChange := old.ModelSystem != next.ModelSystem || old.ToothSet != next.ToothSet || old.ShadeSystem != next.ShadeSystem || old.Channel != next.Channel || old.Family != next.Family || old.Prescription != next.Prescription || old.ImplantSystem != next.ImplantSystem || old.ImplantPlatform != next.ImplantPlatform || old.ShadeNotes != next.ShadeNotes || old.IncomingItems != next.IncomingItems || old.DesignRequired != next.DesignRequired || old.ApprovalGateStatusID != next.ApprovalGateStatusID
		s.Details = next
		if clinicalChange {
			s.Intake = "PENDING"
			s.AcceptedAt = nil
			s.Design = "PENDING"
			s.DesignApprovedBy = ""
		}
		if clinicalChange || old.BatchReferences != next.BatchReferences {
			s.Quality = "PENDING"
			s.QualityAt = nil
			s.QualityBy = ""
		}

	case "ACCEPT":
		if !logistics {
			return s, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Приём задания выполняет диспетчер"}
		}
		if s.OnHold {
			return s, dbx.Business("Сначала снимите заказ с ожидания")
		}
		if strings.TrimSpace(s.Details.Prescription) == "" {
			return s, dbx.Business("Заполните задание врача")
		}
		if s.Details.Family == "IMPLANT" && (strings.TrimSpace(s.Details.ImplantSystem) == "" || strings.TrimSpace(s.Details.ImplantPlatform) == "") {
			return s, dbx.Business("Для имплантной работы укажите систему и платформу/соединение")
		}
		keys := []string{"prescription", "records", "components"}
		if s.Details.Channel != "DIGITAL" {
			keys = append(keys, "disinfection")
		}
		if err := labChecks(r.Checks, keys, false); err != nil {
			return s, err
		}
		s.Intake = "ACCEPTED"
		s.AcceptedAt = &now
	case "HOLD":
		if note == "" {
			return s, dbx.Validation("Укажите причину ожидания")
		}
		s.OnHold = true
		s.HoldReason = note
	case "RESUME":
		if !s.OnHold {
			return s, dbx.Business("Заказ не находится на ожидании")
		}
		if note == "" {
			return s, dbx.Validation("Укажите, как устранена причина ожидания")
		}
		s.OnHold = false
		s.HoldReason = ""
	case "APPROVE_DESIGN":
		if s.Intake != "ACCEPTED" || s.OnHold {
			return s, dbx.Business("Сначала примите задание и снимите ожидание")
		}
		if strings.TrimSpace(r.Clinician) == "" || note == "" {
			return s, dbx.Validation("Укажите врача и подтверждение согласования: комментарий или ссылку на приложенный файл")
		}
		s.Design = "APPROVED"
		s.DesignApprovedBy = strings.TrimSpace(r.Clinician)
	case "QC_PASS", "QC_FAIL":
		if !qc {
			return s, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Контроль качества выполняет главный техник или администратор"}
		}
		if !ready || s.Intake != "ACCEPTED" || s.OnHold {
			return s, dbx.Business("Для проверки завершите производство, примите задание и снимите ожидание")
		}
		if note == "" {
			return s, dbx.Validation("Оставьте результат проверки качества")
		}
		if action == "QC_PASS" {
			if incidents {
				return s, dbx.Business("Сначала закройте открытые инциденты качества")
			}
			if s.Details.DesignRequired && s.Design != "APPROVED" {
				return s, dbx.Business("Согласуйте дизайн с врачом")
			}
			if strings.TrimSpace(s.Details.BatchReferences) == "" {
				return s, dbx.Business("Укажите материалы, партии или серийные номера компонентов")
			}
			if err := labChecks(r.Checks, []string{"prescription", "fit", "function", "appearance", "traceability"}, true); err != nil {
				return s, err
			}
			s.Quality = "PASSED"
		} else {
			s.Quality = "FAILED"
		}
		s.QualityAt = &now
		s.QualityBy = actor.Email
	case "DISPATCH":
		if !logistics {
			return s, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Выдачу оформляет диспетчер"}
		}
		if !ready || s.Intake != "ACCEPTED" || s.OnHold || s.Quality != "PASSED" || incidents {
			return s, dbx.Business("Выдача возможна после завершения производства и успешного контроля качества без открытых инцидентов")
		}
		if s.Details.DesignRequired && s.Design != "APPROVED" {
			return s, dbx.Business("Сначала согласуйте дизайн")
		}
		if strings.TrimSpace(r.Recipient) == "" {
			return s, dbx.Validation("Укажите получателя или службу доставки")
		}
		if err := labChecks(r.Checks, []string{"identity", "packaging", "disinfection", "documents"}, false); err != nil {
			return s, err
		}
		s.Delivery = "SHIPPED"
		s.Tracking = strings.TrimSpace(r.Tracking)
		s.Recipient = strings.TrimSpace(r.Recipient)
		s.ShippedAt = &now
		s.DeliveredAt = nil
	case "DELIVER":
		if !logistics {
			return s, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Получение подтверждает диспетчер"}
		}
		if s.Delivery != "SHIPPED" {
			return s, dbx.Business("Сначала оформите выдачу/отправку")
		}
		if strings.TrimSpace(r.Recipient) == "" || note == "" {
			return s, dbx.Validation("Укажите, кто получил изделие, и подтверждение получения")
		}
		s.Delivery = "DELIVERED"
		s.Recipient = strings.TrimSpace(r.Recipient)
		s.DeliveredAt = &now
	case "RETURN":
		if !oneOf(s.Delivery, "SHIPPED", "DELIVERED") {
			return s, dbx.Business("Возврат доступен после выдачи")
		}
		if !oneOf(r.Reason, "LAB_ERROR", "CLINIC_CHANGE", "NEW_RECORDS", "FIT_SHADE", "TRANSPORT_DAMAGE", "OTHER") || note == "" {
			return s, dbx.Validation("Укажите категорию и причину возврата")
		}
		s.Delivery = "RETURNED"
		s.Quality = "PENDING"
		s.QualityAt = nil
		s.QualityBy = ""
		s.Design = "PENDING"
		s.DesignApprovedBy = ""
		s.Intake = "PENDING"
		s.AcceptedAt = nil
	default:
		return s, dbx.Validation("Неизвестное действие лаборатории")
	}
	return s, nil
}

func labOrderAccess(ctx context.Context, tx pgx.Tx, order string, actor identity.User, lock bool) error {
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "CHIEF_TECHNICIAN") && !hasRole(actor, "DISPATCHER") {
		return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ к лабораторному заданию запрещён"}
	}
	q := `SELECT id::text FROM t_orders WHERE id=$1 AND deleted_at IS NULL`
	if lock {
		q += ` FOR UPDATE`
	}
	var found string
	if err := tx.QueryRow(ctx, q, order).Scan(&found); errors.Is(err, pgx.ErrNoRows) {
		return dbx.Missing("Заказ не найден")
	} else if err != nil {
		return err
	}
	if hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN") && !hasRole(actor, "CHIEF_TECHNICIAN") {
		var allowed bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks WHERE order_id=$1 AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM t_order_tasks t WHERE t.order_id=$1 AND t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM t_user_work_directions d WHERE d.user_id=$2 AND d.work_direction_id=t.work_direction_id))`, order, actor.ID).Scan(&allowed); err != nil {
			return err
		}
		if !allowed {
			return &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа ко всем направлениям заказа"}
		}
	}
	return nil
}
func labReady(ctx context.Context, tx pgx.Tx, order string) (bool, bool, error) {
	var ready, incidents bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks WHERE order_id=$1 AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_order_statuses s ON s.id=t.status_id WHERE t.order_id=$1 AND t.deleted_at IS NULL AND NOT s.is_terminal),EXISTS(SELECT 1 FROM t_quality_incidents i JOIN t_order_tasks t ON t.id=i.task_id WHERE t.order_id=$1 AND t.deleted_at IS NULL AND i.status<>'RESOLVED')`, order).Scan(&ready, &incidents)
	return ready, incidents, err
}
func labResponse(ctx context.Context, tx pgx.Tx, order string) (any, error) {
	s := defaultLabState()
	version := 0
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT state,version FROM mvp_lab_cases WHERE order_id=$1`, order).Scan(&raw, &version)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		if s, err = decodeLabState(raw); err != nil {
			return nil, err
		}
	}
	ready, incidents, err := labReady(ctx, tx, order)
	if err != nil {
		return nil, err
	}
	events, err := dbx.List(ctx, tx, `SELECT jsonb_build_object('id',id,'action',event_type,'actor',actor_name,'details',details,'createdAt',created_at) FROM mvp_lab_case_events WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`, order)
	if err != nil {
		return nil, err
	}
	return map[string]any{"orderId": order, "version": version, "state": s, "productionReady": ready, "openIncidents": incidents, "events": events}, nil
}
func (s *Service) LaboratoryCase(ctx context.Context, order string, actor identity.User) (any, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = labOrderAccess(ctx, tx, order, actor, false); err != nil {
		return nil, err
	}
	result, err := labResponse(ctx, tx, order)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
func (s *Service) LaboratoryAction(ctx context.Context, order string, r LabAction, actor identity.User) (any, error) {
	r.Action = strings.ToUpper(strings.TrimSpace(r.Action))
	if r.Action == "SAVE" && r.Details != nil {
		if err := validateLabDetails(*r.Details); err != nil {
			return nil, err
		}
	}
	if r.Version == nil || *r.Version < 0 {
		return nil, dbx.Validation("Нужна текущая версия карточки")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, q := range []string{`SELECT pg_advisory_xact_lock(841337,1)`, `SELECT pg_advisory_xact_lock(846321)`} {
		if _, err = tx.Exec(ctx, q); err != nil {
			return nil, err
		}
	}
	if err = labOrderAccess(ctx, tx, order, actor, true); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO mvp_lab_cases(order_id) VALUES($1) ON CONFLICT DO NOTHING`, order); err != nil {
		return nil, err
	}
	var raw []byte
	var version int
	var updatedAt time.Time
	if err = tx.QueryRow(ctx, `SELECT state,version,updated_at FROM mvp_lab_cases WHERE order_id=$1 FOR UPDATE`, order).Scan(&raw, &version, &updatedAt); err != nil {
		return nil, err
	}
	if version != *r.Version {
		return nil, labConflict("Карточка изменена другим сотрудником. Обновите её и повторите действие")
	}
	state, err := decodeLabState(raw)
	if err != nil {
		return nil, err
	}
	ready, incidents, err := labReady(ctx, tx, order)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(r.Action, "SAVE") && r.Details != nil && r.Details.ApprovalGateStatusID != "" {
		var valid bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_workflow_steps w ON w.work_type_id=t.work_type_id AND w.deleted_at IS NULL JOIN t_order_statuses st ON st.id=w.from_status_id AND st.is_active WHERE t.order_id=$1 AND t.deleted_at IS NULL AND w.from_status_id=$2 AND NOT st.is_terminal)`, order, r.Details.ApprovalGateStatusID).Scan(&valid); err != nil {
			return nil, err
		}
		if !valid {
			return nil, dbx.Validation("Этап согласования должен входить в маршрут этого заказа")
		}
	}
	previousPaused := state.OnHold || state.Intake != "ACCEPTED"
	previousPauseAt := state.PausedAt
	if previousPaused && previousPauseAt == nil {
		previousPauseAt = &updatedAt
	}
	now := time.Now().UTC()
	state, err = applyLabAction(state, r, actor, ready, incidents, now)
	if err != nil {
		return nil, err
	}
	paused := state.OnHold || state.Intake != "ACCEPTED"
	if paused {
		if previousPaused {
			state.PausedAt = previousPauseAt
		} else {
			state.PausedAt = &now
		}
	} else {
		state.PausedAt = nil
		if previousPaused && previousPauseAt != nil {
			if _, err = tx.Exec(ctx, `UPDATE t_task_sla_states s SET warning_at=s.warning_at+greatest(interval '0 seconds',$3::timestamptz-greatest(s.entered_at,$2::timestamptz)),breach_at=s.breach_at+greatest(interval '0 seconds',$3::timestamptz-greatest(s.entered_at,$2::timestamptz)),updated_at=now() FROM t_order_tasks t WHERE t.id=s.task_id AND t.order_id=$1 AND t.deleted_at IS NULL AND t.status_id=s.status_id`, order, *previousPauseAt, now); err != nil {
				return nil, err
			}
		}
	}
	raw, err = json.Marshal(state)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE mvp_lab_cases SET state=$2,version=version+1,updated_at=now() WHERE order_id=$1`, order, raw); err != nil {
		return nil, err
	}
	detail, _ := json.Marshal(r)
	if _, err = tx.Exec(ctx, `INSERT INTO mvp_lab_case_events(order_id,event_type,actor_id,actor_name,details) SELECT $1,$2,id,name,$4 FROM t_users WHERE id=$3`, order, strings.ToUpper(strings.TrimSpace(r.Action)), actor.ID, detail); err != nil {
		return nil, err
	}
	result, err := labResponse(ctx, tx, order)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

// Existing cases without a laboratory card remain compatible. New orders start at intake.
func checkLabProduction(ctx context.Context, tx pgx.Tx, order string) error {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT state FROM mvp_lab_cases WHERE order_id=$1`, order).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	s, err := decodeLabState(raw)
	if err != nil {
		return err
	}
	if s.Delivery == "SHIPPED" || s.Delivery == "DELIVERED" {
		return labConflict("Изделие уже выдано. Сначала оформите возврат в карточке заказа")
	}
	if s.OnHold {
		return dbx.Business("Заказ на ожидании: " + s.HoldReason)
	}
	if s.Intake != "ACCEPTED" {
		return dbx.Business("Сначала проверьте и примите задание в карточке заказа")
	}

	return nil
}
func invalidateLabQuality(ctx context.Context, tx pgx.Tx, order, actor string) error {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT state FROM mvp_lab_cases WHERE order_id=$1`, order).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	s, err := decodeLabState(raw)
	if err != nil {
		return err
	}
	if s.Delivery == "SHIPPED" || s.Delivery == "DELIVERED" {
		return labConflict("Изделие уже выдано. Сначала оформите возврат")
	}
	if s.Quality == "PENDING" {
		return nil
	}
	s.Quality = "PENDING"
	s.QualityAt = nil
	s.QualityBy = ""
	raw, err = json.Marshal(s)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE mvp_lab_cases SET state=$2,version=version+1,updated_at=now() WHERE order_id=$1`, order, raw); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO mvp_lab_case_events(order_id,event_type,actor_id,actor_name,details) SELECT $1,'QC_INVALIDATED',id,name,'{"note":"Состав или состояние задач изменилось; нужна повторная проверка"}'::jsonb FROM t_users WHERE id=$2`, order, actor)
	return err
}

type QueueOptions struct {
	Offset, Limit int
	Search, Phase string
}

func (s *Service) LaboratoryQueue(ctx context.Context, actor identity.User, options ...QueueOptions) (any, error) {
	q := QueueOptions{Limit: 50}
	if len(options) > 0 {
		q = options[0]
	}
	if q.Limit < 1 || q.Limit > 200 {
		q.Limit = 50
	}
	if q.Offset < 0 {
		q.Offset = 0
	}
	return dbx.List(ctx, s.pool, `WITH items AS (SELECT jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'patient',p.full_name,'clinic',c.name,'deadline',o.deadline,'appointment',l.state->'details'->>'appointment','rush',coalesce((l.state->'details'->>'rush')::boolean,false),'onHold',coalesce((l.state->>'onHold')::boolean,false),'holdReason',l.state->>'holdReason','intake',coalesce(l.state->>'intake','PENDING'),'quality',coalesce(l.state->>'quality','PENDING'),'delivery',coalesce(l.state->>'delivery','NOT_SENT'),'productionReady',NOT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_order_statuses s ON s.id=t.status_id WHERE t.order_id=o.id AND t.deleted_at IS NULL AND NOT s.is_terminal) AND EXISTS(SELECT 1 FROM t_order_tasks WHERE order_id=o.id AND deleted_at IS NULL)) AS item FROM t_orders o LEFT JOIN mvp_lab_cases l ON l.order_id=o.id LEFT JOIN t_clinic_user_cards p ON p.id=o.patient_card_id LEFT JOIN t_clinics c ON c.id=p.clinic_id WHERE o.deleted_at IS NULL AND (NOT $1 OR (EXISTS(SELECT 1 FROM t_order_tasks WHERE order_id=o.id AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM t_order_tasks t WHERE t.order_id=o.id AND t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM t_user_work_directions d WHERE d.user_id=$2 AND d.work_direction_id=t.work_direction_id))))), phases AS (SELECT item, CASE
 WHEN item->>'delivery' IN ('DELIVERED','SHIPPED','RETURNED') THEN item->>'delivery'
 WHEN (item->>'onHold')::boolean THEN 'HOLD'
 WHEN item->>'intake'<>'ACCEPTED' THEN 'INTAKE'
 WHEN NOT (item->>'productionReady')::boolean THEN 'PRODUCTION'
 WHEN item->>'quality'<>'PASSED' THEN 'QC' ELSE 'READY' END phase FROM items)
 SELECT item FROM phases WHERE ($3='' OR strpos(lower(concat_ws(' ',item->>'orderNumber',item->>'patient',item->>'clinic')),lower($3))>0)
 AND ($4='' OR $4='ALL' OR ($4='OPEN' AND phase<>'DELIVERED') OR phase=$4)
 ORDER BY (phase='DELIVERED'),(item->>'rush')::boolean DESC,(item->>'deadline')::date NULLS LAST,item->>'orderId'
 LIMIT $5 OFFSET $6`, hasRole(actor, "DISPATCHER") && !hasRole(actor, "ADMIN") && !hasRole(actor, "CHIEF_TECHNICIAN"), actor.ID, q.Search, q.Phase, q.Limit, q.Offset)
}

func checkLabDesign(ctx context.Context, tx pgx.Tx, order, from string, terminal bool) error {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT state FROM mvp_lab_cases WHERE order_id=$1`, order).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	s, err := decodeLabState(raw)
	if err != nil {
		return err
	}
	if s.Details.DesignRequired && s.Design != "APPROVED" && (terminal || s.Details.ApprovalGateStatusID == from) {
		return dbx.Business("Для этого перехода требуется согласование дизайна/примерки с врачом")
	}
	return nil
}
