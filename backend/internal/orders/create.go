package orders

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/warehouse"
)

type CreateRequest struct {
	PatientCardID string        `json:"patientCardId"`
	NewPatient    bool          `json:"newPatient"`
	ClinicID      string        `json:"clinicId"`
	Patient       string        `json:"patientFullName"`
	Doctor        string        `json:"doctorFullName"`
	Deadline      string        `json:"deadline"`
	Comment       *string       `json:"comment"`
	Tasks         []*CreateTask `json:"tasks"`
}
type CreateTask struct {
	OrderID         string      `json:"orderId"`
	WorkDirectionID string      `json:"workDirectionId"`
	WorkTypeID      string      `json:"workTypeId"`
	Quantity        int32       `json:"quantity"`
	Teeth           []int       `json:"toothNumbers"`
	ColorID         string      `json:"colorId"`
	MaterialIDs     []string    `json:"materialIds"`
	Price           json.Number `json:"pricePerUnit"`
	Discount        json.Number `json:"discountPercent"`
	AssignmentUpdate
}

var createUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var decimalNumber = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]{1,3})?$`)

func validAmount(n json.Number, max string) bool {
	if len(n) > 100 || !decimalNumber.MatchString(string(n)) {
		return false
	}
	v, ok := new(big.Rat).SetString(string(n))
	limit, _ := new(big.Rat).SetString(max)
	return ok && v.Sign() >= 0 && v.Cmp(limit) <= 0
}
func (r *CreateRequest) validate() error {
	if (r.PatientCardID != "" && !createUUID.MatchString(r.PatientCardID)) || (r.PatientCardID != "" && r.NewPatient) {
		return dbx.Validation("Выберите пациента или создание новой карточки")
	}
	r.Patient = strings.Join(strings.Fields(r.Patient), " ")
	r.Doctor = strings.Join(strings.Fields(r.Doctor), " ")
	if !createUUID.MatchString(r.ClinicID) || r.Patient == "" || r.Doctor == "" || len([]rune(r.Patient)) > 255 || len([]rune(r.Doctor)) > 255 || len(r.Tasks) == 0 {
		return dbx.Validation("Укажите клинику, пациента, врача и задачи")
	}
	if _, err := time.Parse("2006-01-02", r.Deadline); err != nil {
		return dbx.Validation("Некорректный срок заказа")
	}
	for _, t := range r.Tasks {
		if err := t.validate(); err != nil {
			return err
		}
	}
	return nil
}

func (t *CreateTask) validate() error {
	if t == nil {
		return dbx.Validation("Задача не может быть null")
	}
	if !createUUID.MatchString(t.WorkDirectionID) || !createUUID.MatchString(t.WorkTypeID) || (t.ColorID != "" && !createUUID.MatchString(t.ColorID)) || t.Quantity < 1 || len(t.MaterialIDs) == 0 || !validAmount(t.Price, "99999999.99") || !validAmount(t.Discount, "100") {
		return dbx.Validation("Некорректные параметры задачи")
	}
	seen := map[string]bool{}
	for _, id := range t.MaterialIDs {
		key := strings.ToLower(id)
		if !createUUID.MatchString(id) || seen[key] {
			return dbx.Validation("Некорректный или повторяющийся материал")
		}
		seen[key] = true
	}
	teeth := map[int]bool{}
	for _, n := range t.Teeth {
		if n/10 < 1 || n/10 > 4 || n%10 < 1 || n%10 > 8 || teeth[n] {
			return dbx.Validation("Некорректный или повторяющийся номер зуба")
		}
		teeth[n] = true
	}
	if t.Mode == "" {
		t.Mode = "AUTO"
	}
	if t.Mode != "AUTO" && t.Mode != "PREASSIGNED" {
		return dbx.Validation("Некорректный режим назначения")
	}
	for _, a := range t.Assignees {
		if a == nil || !createUUID.MatchString(a.StatusID) || !createUUID.MatchString(a.UserID) {
			return dbx.Validation("Некорректное назначение")
		}
	}
	return nil
}

// Create commits the entire order, including reservations and its durable event.
func (s *Service) Create(ctx context.Context, r CreateRequest, actor identity.User) (result any, err error) {
	if !hasRole(actor, "ADMIN") && !hasRole(actor, "DISPATCHER") {
		return nil, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Доступ запрещён"}
	}
	if err = r.validate(); err != nil {
		return nil, err
	}
	defer func() {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "22003" {
			err = dbx.Validation("Сумма превышает допустимый размер")
		} else {
			err = dbx.Constraint(err)
		}
	}()
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// Serialize with Go workflow/assignment writers and card creation by other Go orders.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(841337,1)`); err != nil {
		return nil, err
	}
	var clinic string
	err = tx.QueryRow(ctx, `SELECT name FROM t_clinics WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, r.ClinicID).Scan(&clinic)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, dbx.Missing("Клиника не найдена")
	}
	if err != nil {
		return nil, err
	}
	patient, patientName, err := patientCard(ctx, tx, r)
	if err != nil {
		return nil, err
	}
	doctor, _, err := orderCard(ctx, tx, r.ClinicID, r.Doctor, "doctor")
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(r.Tasks)
	if err != nil {
		return nil, err
	}
	var total string
	err = tx.QueryRow(ctx, `SELECT sum((v->>'pricePerUnit')::numeric*(v->>'quantity')::integer*(1-round((v->>'discountPercent')::numeric/100,4)))::text FROM jsonb_array_elements($1::jsonb) v`, string(raw)).Scan(&total)
	if err != nil {
		return nil, err
	}
	var orderID, number string
	err = tx.QueryRow(ctx, `INSERT INTO t_orders(order_number,patient_card_id,doctor_card_id,deadline,comment,total_amount) VALUES('ORD-'||upper(left(gen_random_uuid()::text,8)),$1,$2,$3::date,$4,$5::numeric) RETURNING id::text,order_number`, patient, doctor, r.Deadline, r.Comment, total).Scan(&orderID, &number)
	if err != nil {
		return nil, err
	}
	ids := []string{}
	names := []string{}
	seenNames := map[string]bool{}
	var quantity int64
	for _, t := range r.Tasks {
		taskID, name, e := insertTask(ctx, tx, orderID, t, actor)
		if e != nil {
			return nil, e
		}
		_, err = tx.Exec(ctx, `INSERT INTO t_order_task_history(task_id,field_name,new_value,comment) SELECT $1,'STATUS',code,'Первичное создание задачи при оформлении заказа' FROM t_order_statuses WHERE id=(SELECT status_id FROM t_order_tasks WHERE id=$1)`, taskID)
		if err != nil {
			return nil, err
		}
		ids = append(ids, taskID)
		quantity += int64(t.Quantity)
		if strings.TrimSpace(name) != "" && !seenNames[name] {
			names = append(names, name)
			seenNames[name] = true
		}
	}

	if s.warehouseEnabled {
		if err = warehouse.ReserveOrder(ctx, tx, orderID); err != nil {
			return nil, err
		}
	}

	payload, _ := json.Marshal(map[string]any{"eventType": "ORDER_CREATED", "entityId": orderID, "statusCode": nil})
	if _, err = tx.Exec(ctx, `INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('DASHBOARD','ORDER',$1,$2)`, orderID, string(payload)); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO mvp_lab_cases(order_id) VALUES($1)`, orderID); err != nil {
		return nil, err
	}
	result = map[string]any{"id": orderID, "orderNumber": number, "patientFullName": patientName, "summaryWorkType": strings.Join(names, ", "), "isActive": true, "quantity": quantity, "pricePerUnit": r.Tasks[0].Price, "discount": r.Tasks[0].Discount, "totalPrice": json.Number(total), "taskIds": ids, "clinic": clinic}
	return result, tx.Commit(ctx)
}
func orderCard(ctx context.Context, tx pgx.Tx, clinic, name, role string) (id, storedName string, err error) {
	err = tx.QueryRow(ctx, `SELECT id::text,full_name FROM t_clinic_user_cards WHERE clinic_id=$1 AND role=$2 AND deleted_at IS NULL AND (full_name=$3 OR lower(trim(full_name))=lower(trim($3))) ORDER BY (full_name=$3) DESC,id LIMIT 1 FOR SHARE`, clinic, role, name).Scan(&id, &storedName)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO t_clinic_user_cards(clinic_id,role,full_name) VALUES($1,$2,$3) RETURNING id::text,full_name`, clinic, role, name).Scan(&id, &storedName)
	}
	return
}

// insertTask shares dictionary, direction and assignment checks with order creation.
func insertTask(ctx context.Context, tx pgx.Tx, orderID string, t *CreateTask, actor identity.User) (string, string, error) {
	var name string
	err := tx.QueryRow(ctx, `SELECT w.name FROM t_work_types w JOIN t_work_directions d ON d.id=$2 AND d.deleted_at IS NULL AND d.is_active WHERE w.id=$1 AND w.deleted_at IS NULL AND w.is_active FOR SHARE OF w,d`, t.WorkTypeID, t.WorkDirectionID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", dbx.Missing("Вид работы, направление или цвет не найден")
	}
	if err != nil {
		return "", "", err
	}
	if t.ColorID != "" {
		var color string
		if err = tx.QueryRow(ctx, `SELECT id::text FROM t_colors WHERE id=$1 AND deleted_at IS NULL AND is_active FOR SHARE`, t.ColorID).Scan(&color); errors.Is(err, pgx.ErrNoRows) {
			return "", "", dbx.Missing("Цвет не найден")
		} else if err != nil {
			return "", "", err
		}
	}
	if !hasRole(actor, "ADMIN") {
		var allowed bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_user_work_directions WHERE user_id=$1 AND work_direction_id=$2)`, actor.ID, t.WorkDirectionID).Scan(&allowed)
		if err != nil {
			return "", "", err
		}
		if !allowed {
			return "", "", &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа к направлению работ"}
		}
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock_shared(841337,1)`); err != nil {
		return "", "", err
	}
	var disabled bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_workflow_steps w JOIN t_order_statuses f ON f.id=w.from_status_id JOIN t_order_statuses t ON t.id=w.to_status_id WHERE w.work_type_id=$1 AND w.deleted_at IS NULL AND (NOT f.is_active OR NOT t.is_active))`, t.WorkTypeID).Scan(&disabled); err != nil {
		return "", "", err
	}
	if disabled {
		return "", "", dbx.Business("В маршруте есть отключённые статусы. Активируйте этапы перед созданием заказа")
	}
	var statuses []string
	rows, e := tx.Query(ctx, `SELECT s.id::text FROM t_workflow_steps w JOIN t_order_statuses s ON s.id=w.from_status_id WHERE w.work_type_id=$1 AND w.deleted_at IS NULL AND s.is_initial=true ORDER BY w.sort_order`, t.WorkTypeID)
	if e != nil {
		return "", "", e
	}
	statuses, e = pgx.CollectRows(rows, pgx.RowTo[string])
	if e != nil {
		return "", "", e
	}
	if len(statuses) != 1 {
		return "", "", dbx.Business("Для вида работы должен быть ровно один начальный статус")
	}
	var taskID string
	err = tx.QueryRow(ctx, `INSERT INTO t_order_tasks(order_id,status_id,work_type_id,work_direction_id,quantity,color_id,price_per_unit,discount_percent) VALUES($1,$2,$3,$4,$5,NULLIF($6,'')::uuid,$7::numeric,$8::numeric) RETURNING id::text`, orderID, statuses[0], t.WorkTypeID, t.WorkDirectionID, t.Quantity, t.ColorID, string(t.Price), string(t.Discount)).Scan(&taskID)
	if err != nil {
		return "", "", err
	}
	for _, m := range t.MaterialIDs {
		var found string
		err = tx.QueryRow(ctx, `SELECT id::text FROM t_materials WHERE id=$1 AND is_active AND deleted_at IS NULL FOR SHARE`, m).Scan(&found)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", dbx.Missing("Материал не найден")
		}
		if err != nil {
			return "", "", err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_materials(order_task_id,material_id) VALUES($1,$2)`, taskID, m); err != nil {
			return "", "", err
		}
	}
	for _, n := range t.Teeth {
		if _, err = tx.Exec(ctx, `INSERT INTO t_order_task_teeth(order_task_id,tooth_number) VALUES($1,$2)`, taskID, n); err != nil {
			return "", "", err
		}
	}
	if err = applyAssignmentPlan(ctx, tx, taskID, t.WorkTypeID, t.AssignmentUpdate); err != nil {
		return "", "", err
	}
	return taskID, name, nil
}

// Patient names are not unique identities. Never choose arbitrarily among homonyms.
func patientCard(ctx context.Context, tx pgx.Tx, r CreateRequest) (id, name string, err error) {
	if r.PatientCardID != "" {
		err = tx.QueryRow(ctx, `SELECT id::text,full_name FROM t_clinic_user_cards WHERE id=$1 AND clinic_id=$2 AND role='patient' AND deleted_at IS NULL FOR SHARE`, r.PatientCardID, r.ClinicID).Scan(&id, &name)
		if errors.Is(err, pgx.ErrNoRows) {
			err = dbx.Validation("Выбранный пациент не относится к этой клинике или недоступен")
		}
		return
	}
	if !r.NewPatient {
		rows, e := tx.Query(ctx, `SELECT id::text,full_name FROM t_clinic_user_cards WHERE clinic_id=$1 AND role='patient' AND deleted_at IS NULL AND lower(regexp_replace(trim(full_name),'\s+',' ','g'))=lower($2) ORDER BY id LIMIT 2 FOR SHARE`, r.ClinicID, r.Patient)
		if e != nil {
			return "", "", e
		}
		defer rows.Close()
		count := 0
		for rows.Next() {
			if e = rows.Scan(&id, &name); e != nil {
				return "", "", e
			}
			count++
		}
		if e = rows.Err(); e != nil {
			return "", "", e
		}
		rows.Close()
		if count > 1 {
			return "", "", dbx.Validation("Найдено несколько пациентов с этим именем. Выберите карточку или отметьте нового пациента")
		}
		if count == 1 {
			return id, name, nil
		}
	}
	err = tx.QueryRow(ctx, `INSERT INTO t_clinic_user_cards(clinic_id,role,full_name) VALUES($1,'patient',$2) RETURNING id::text,full_name`, r.ClinicID, r.Patient).Scan(&id, &name)
	return
}
