//go:build mvp

package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"teethtech.local/crm/internal/bootstrap"
	"teethtech.local/crm/internal/catalog"
	"teethtech.local/crm/internal/clinic"
	"teethtech.local/crm/internal/files"
	"teethtech.local/crm/internal/httpapi"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/jobs"
	"teethtech.local/crm/internal/kpi"
	"teethtech.local/crm/internal/notes"
	"teethtech.local/crm/internal/notifications"
	"teethtech.local/crm/internal/orders"
	"teethtech.local/crm/internal/workflow"
	"testing"
	"time"
)

func TestStandaloneMVP(t *testing.T) {
	ctx := t.Context()
	pool, e := pgxpool.New(ctx, os.Getenv("MVP_TEST_DATABASE_URL"))
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	var db string
	if e = pool.QueryRow(ctx, `SELECT current_database()`).Scan(&db); e != nil || db != "teethtech_mvp_go_test" {
		t.Fatal("refusing non-test database", e)
	}
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	sql := func(q string, args ...any) { t.Helper(); _, e := pool.Exec(ctx, q, args...); must(e) }
	var tables int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`).Scan(&tables))
	if tables != 0 {
		t.Fatal("requires an empty isolated database")
	}
	must(bootstrap.Migrate(ctx, pool))
	must(bootstrap.Migrate(ctx, pool))
	password := "MVPIntegrationPassword2026"
	suppliedHash, e := bcrypt.GenerateFromPassword([]byte(password), 12)
	must(e)
	if bootstrap.AccountsWithHash(ctx, pool, "", "invalid-hash", password) == nil {
		t.Fatal("malformed hash accepted")
	}
	must(bootstrap.AccountsForMVP(ctx, pool, "", string(suppliedHash), password))
	var remainingStages, remainingSteps, remainingOrders, remainingWorkTypes int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_order_statuses WHERE code NOT IN('TODO','WAITING_FOR_APPROVAL','ORDER_CLOSED')`).Scan(&remainingStages))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_workflow_steps`).Scan(&remainingSteps))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_orders`).Scan(&remainingOrders))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_work_types WHERE deleted_at IS NULL`).Scan(&remainingWorkTypes))
	if remainingStages != 0 || remainingSteps != 0 || remainingOrders != 0 || remainingWorkTypes != 0 {
		t.Fatal("fresh workspace contains demo workflow")
	}
	must(bootstrap.AccountsForMVP(ctx, pool, "different-password", "", "different-password"))
	must(bootstrap.Accounts(ctx, pool, "different-password", "different-password"))
	var hash string
	must(pool.QueryRow(ctx, `SELECT password_hash FROM t_users WHERE email='admin@teethtech.kz'`).Scan(&hash))
	if hash != string(suppliedHash) {
		t.Fatal("supplied hash changed")
	}
	must(bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)))
	tokens, e := identity.NewTokens(strings.Repeat("A", 64), time.Hour)
	must(e)
	auth, e := identity.NewService(pool, tokens, identity.Settings{RefreshTTL: time.Hour, MaxFailed: 5, LockDuration: time.Minute})
	must(e)
	storage, e := files.New(pool, os.Getenv("AWS_S3_ENDPOINT"), os.Getenv("AWS_S3_ACCESS_KEY"), os.Getenv("AWS_S3_SECRET_KEY"), "teethtech-mvp-go-test")
	must(e)
	must(storage.Initialize(ctx))
	order := orders.New(pool)
	order.ConfigureMVP(false, false)
	server := httptest.NewServer(httpapi.New(httpapi.Options{Identity: auth, Orders: order, Workflow: workflow.New(pool), Catalog: catalog.New(pool), Clinics: clinic.New(pool), Notes: notes.New(pool), Notifications: notifications.New(pool), KPI: kpi.New(pool), Files: storage, AuthRateLimit: 1000, Ready: pool.Ping}))
	defer server.Close()
	call := func(method, path, token string, value any, code int) map[string]any {
		t.Helper()
		var body io.Reader
		if value != nil {
			raw, e := json.Marshal(value)
			must(e)
			body = bytes.NewReader(raw)
		}
		req, e := http.NewRequest(method, server.URL+httpapi.Prefix+path, body)
		must(e)
		if value != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, e := http.DefaultClient.Do(req)
		must(e)
		defer resp.Body.Close()
		raw, e := io.ReadAll(resp.Body)
		must(e)
		if resp.StatusCode != code {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, resp.StatusCode, code, raw)
		}
		result := map[string]any{}
		if len(raw) > 0 && raw[0] == '{' {
			must(json.Unmarshal(raw, &result))
		}
		return result
	}
	login := func(email string) map[string]any {
		return call("POST", "/auth/sessions", "", map[string]any{"email": email, "password": password}, 200)
	}
	adminSession := login("admin@teethtech.kz")
	admin := adminSession["accessToken"].(string)
	currentIdentity := call("GET", "/auth/current", admin, nil, 200)
	if currentIdentity["id"] != adminSession["userId"] {
		t.Fatal("verified platform identity mismatch")
	}
	adminID := adminSession["userId"].(string)
	labAction := func(orderID, token string, body map[string]any, expected int) map[string]any {
		current := call("GET", "/orders/"+orderID+"/laboratory", admin, nil, 200)
		body["version"] = current["version"]
		return call("POST", "/orders/"+orderID+"/laboratory/actions", token, body, expected)
	}
	acceptLab := func(orderID string) {
		labAction(orderID, admin, map[string]any{"action": "SAVE", "details": orders.LabDetails{Channel: "DIGITAL", Family: "FIXED", Prescription: "Задание врача: коронка по скану, заданный цвет и зуб", BatchReferences: "Zirconia LOT TEST-123"}}, 200)
		labAction(orderID, admin, map[string]any{"action": "ACCEPT", "checks": map[string]string{"prescription": "PASS", "records": "PASS", "components": "PASS"}}, 200)
	}

	techSession := login("plasterer@teethtech.kz")
	tech := techSession["accessToken"].(string)
	techID := techSession["userId"].(string)
	call("GET", "/actuator/health/readiness", "", nil, 200)
	today := time.Now().In(time.FixedZone("Aqtobe", 5*3600)).Format("2006-01-02")
	period := "?from=" + today + "&to=" + today
	call("GET", "/kpi"+period, "", nil, 401)
	call("GET", "/kpi"+period, tech, nil, 403)
	call("GET", "/kpi/my"+period, tech, nil, 200)
	for _, path := range []string{"/stock/balances", "/finance/transactions", "/salary-plans"} {
		call("GET", path, admin, nil, 404)
	}
	var clinicID, direction, color, material, initial string
	must(pool.QueryRow(ctx, `SELECT id::text FROM t_clinics WHERE deleted_at IS NULL LIMIT 1`).Scan(&clinicID))
	must(pool.QueryRow(ctx, `SELECT id::text FROM t_work_directions WHERE deleted_at IS NULL LIMIT 1`).Scan(&direction))
	must(pool.QueryRow(ctx, `SELECT id::text FROM t_colors WHERE deleted_at IS NULL LIMIT 1`).Scan(&color))
	must(pool.QueryRow(ctx, `SELECT id::text FROM t_materials WHERE deleted_at IS NULL LIMIT 1`).Scan(&material))
	must(pool.QueryRow(ctx, `SELECT id::text FROM t_order_statuses WHERE is_initial LIMIT 1`).Scan(&initial))
	work, middle, end := uuid.NewString(), uuid.NewString(), uuid.NewString()
	sql(`INSERT INTO t_work_types(id,name,code) VALUES($1,'Go MVP integration crown','GO_MVP_TEST')`, work)
	sql(`INSERT INTO t_order_statuses(id,code,name,sort_order,is_terminal) VALUES($1,'GO_MVP_MIDDLE','Go mid',10001,false),($2,'GO_MVP_END','Go end',10002,true)`, middle, end)
	sql(`INSERT INTO t_workflow_steps(work_type_id,from_status_id,to_status_id,required_role,sort_order,material_report_required) VALUES($1,$2,$3,'ROLE_ADMIN',1,true),($1,$3,$4,'ROLE_ADMIN',2,true)`, work, initial, middle, end)
	call("PATCH", "/order-statuses/"+middle+"/activation", tech, map[string]any{"active": false}, 403)
	call("PATCH", "/order-statuses/"+initial+"/activation", admin, map[string]any{"active": false}, 400)
	call("DELETE", "/order-statuses/"+initial, admin, nil, 400)
	call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{}, 400)
	disabled := call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{"active": false}, 200)
	if disabled["active"] != false {
		t.Fatal("status not disabled")
	}
	call("POST", "/orders", admin, map[string]any{"clinicId": clinicID, "patientFullName": "Учебный пациент Go", "doctorFullName": "Учебный врач Go", "deadline": today, "comment": "Go only", "tasks": []any{map[string]any{"workDirectionId": direction, "workTypeId": work, "quantity": 2, "toothNumbers": []int{11, 12}, "colorId": color, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}}}, 400)
	call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{"active": true}, 200)
	created := call("POST", "/orders", admin, map[string]any{"clinicId": clinicID, "patientFullName": "Учебный пациент Go", "doctorFullName": "Учебный врач Go", "deadline": today, "comment": "Go only", "tasks": []any{map[string]any{"workDirectionId": direction, "workTypeId": work, "quantity": 2, "toothNumbers": []int{11, 12}, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}}}, 201)
	id := created["id"].(string)
	task := created["taskIds"].([]any)[0].(string)

	// A task without a shade remains visible on the order board.
	var optionalColor *string
	must(pool.QueryRow(ctx, `SELECT color_id::text FROM t_order_tasks WHERE id=$1`, task).Scan(&optionalColor))
	if optionalColor != nil {
		t.Fatal("unexpected mandatory shade")
	}
	call("GET", "/orders/"+id+"/kanban", admin, nil, 200)
	var originalAssignee *string
	must(pool.QueryRow(ctx, `SELECT dental_technician_id::text FROM t_order_tasks WHERE id=$1`, task).Scan(&originalAssignee))
	sql(`UPDATE t_order_tasks SET dental_technician_id=$2 WHERE id=$1`, task, techID)
	checkStats := func(progress, overdue float64) {
		raw, e := auth.Employees(ctx)
		must(e)
		var rows []map[string]any
		must(json.Unmarshal(raw, &rows))
		for _, row := range rows {
			if row["id"] == techID {
				stats := row["stats"].(map[string]any)
				if stats["inProgress"] != progress || stats["overdue"] != overdue || stats["completed"] != float64(0) {
					t.Fatal("wrong employee metrics", stats)
				}
				return
			}
		}
		t.Fatal("employee missing")
	}
	checkStats(1, 0)
	sql(`UPDATE t_orders SET deadline=CURRENT_DATE-1 WHERE id=$1`, id)
	checkStats(1, 1)
	sql(`UPDATE t_orders SET deadline=$2::date WHERE id=$1`, id, today)
	sql(`UPDATE t_order_tasks SET dental_technician_id=$2 WHERE id=$1`, task, originalAssignee)
	// Search and pagination must reach orders after the former 200-record cap.
	sql(`INSERT INTO t_orders(order_number,patient_card_id,doctor_card_id,deadline) SELECT 'QUEUE-'||g,patient_card_id,doctor_card_id,deadline FROM t_orders CROSS JOIN generate_series(1,205) g WHERE id=$1`, id)
	user := identity.User{ID: adminID, Roles: []string{"ROLE_ADMIN"}}
	rawQueue, e := order.LaboratoryQueue(ctx, user, orders.QueueOptions{Search: "QUEUE-", Limit: 50, Offset: 200, Phase: "INTAKE"})
	must(e)
	encoded, e := json.Marshal(rawQueue)
	must(e)
	var queue []map[string]any
	must(json.Unmarshal(encoded, &queue))
	if len(queue) != 5 {
		t.Fatalf("pagination beyond 200: got %d", len(queue))
	}
	call("GET", "/laboratory/cases?search=QUEUE-&offset=200&limit=50&phase=INTAKE", admin, nil, 200)
	sql(`DELETE FROM t_orders WHERE order_number LIKE 'QUEUE-%'`)

	for _, kind := range []string{"implants", "model-systems", "tooth-sets", "shade-systems"} {
		body := map[string]any{"name": "Test " + kind, "code": "BRAND-01", "description": "Производитель / платформа", "isActive": true}
		call("POST", "/"+kind, tech, body, 403)
		entry := call("POST", "/"+kind, admin, body, 201)
		entryID := entry["id"].(string)
		body["description"] = "Обновлённые параметры"
		changed := call("PUT", "/"+kind+"/"+entryID, admin, body, 200)
		if changed["description"] != body["description"] {
			t.Fatal("catalogue update failed")
		}
		call("GET", "/"+kind, admin, nil, 200)
		if kind == "model-systems" {
			labAction(id, admin, map[string]any{"action": "SAVE", "details": orders.LabDetails{Channel: "DIGITAL", Family: "FIXED", ModelSystem: "Test model-systems · BRAND-01"}}, 200)
		}
		call("DELETE", "/"+kind+"/"+entryID, admin, nil, 204)
	}
	snapshot := call("GET", "/orders/"+id+"/laboratory", admin, nil, 200)
	if snapshot["state"].(map[string]any)["details"].(map[string]any)["modelSystem"] != "Test model-systems · BRAND-01" {
		t.Fatal("catalogue deletion changed order snapshot")
	}
	sql(`UPDATE t_order_tasks SET created_at=now()-interval '5 days',dental_technician_id=NULL WHERE id=$1`, task)
	sql(`UPDATE t_order_task_history SET changed_at=now()-interval '4 days' WHERE task_id=$1 AND field_name='STATUS'`, task)
	sql(`INSERT INTO t_order_task_history(task_id,field_name,new_value,changed_at) VALUES($1,'STATUS','TODO',now()-interval '4 days')`, task)
	dashRaw, e := order.Dashboard(ctx, user, "", "", "")
	must(e)
	var dash map[string]any
	must(json.Unmarshal(dashRaw, &dash))
	if dash["stalledTasksCount"] != float64(1) || dash["unassignedTasksCount"] != float64(1) {
		t.Fatal("missing attention counters", dash)
	}
	if dash["dueTodayCount"] != float64(1) || len(dash["attentionTasks"].([]any)) != 1 {
		t.Fatal("analytics deadline/attention mismatch", dash)
	}
	loads := dash["technicianLoads"].([]any)
	if len(loads) != 1 || loads[0].(map[string]any)["id"] != nil || loads[0].(map[string]any)["count"] != float64(1) {
		t.Fatal("unassigned analytics workload mismatch", loads)
	}
	foundAge := false
	for _, column := range dash["columns"].([]any) {
		for _, entry := range column.(map[string]any)["tasks"].([]any) {
			card := entry.(map[string]any)
			if card["id"] == task {
				foundAge = card["stageDays"] == float64(4)
			}
		}
	}
	if !foundAge {
		t.Fatal("stage age was not returned")
	}
	sql(`DELETE FROM t_order_task_history WHERE task_id=$1 AND changed_at<now()-interval '3 days'`, task)
	sql(`UPDATE t_order_tasks SET created_at=now(),dental_technician_id=$2 WHERE id=$1`, task, originalAssignee)
	call("GET", "/laboratory/cases", tech, nil, 403)
	call("GET", "/orders/"+id+"/laboratory", tech, nil, 403)
	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": middle}, 400)
	acceptLab(id)
	call("POST", "/orders/"+id+"/laboratory/actions", admin, map[string]any{"version": 0, "action": "HOLD", "note": "Stale change"}, 409)
	labAction(id, admin, map[string]any{"action": "HOLD", "note": "Клиника присылает уточнение"}, 200)
	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": middle}, 400)
	sql(`INSERT INTO t_task_sla_states(task_id,status_id,entered_at,warning_at,breach_at) VALUES($1,$2,now()-interval '30 minutes',now()-interval '1 minute',now()-interval '1 minute')`, task, initial)
	pausedWorker := jobs.New(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	must(pausedWorker.Tick(ctx))
	var notified bool
	must(pool.QueryRow(ctx, `SELECT warned_at IS NOT NULL OR breached_at IS NOT NULL FROM t_task_sla_states WHERE task_id=$1`, task).Scan(&notified))
	if notified {
		t.Fatal("paused case produced SLA notifications")
	}
	sql(`UPDATE mvp_lab_cases SET state=jsonb_set(state,'{pausedAt}',to_jsonb(now()-interval '10 minutes')) WHERE order_id=$1`, id)
	labAction(id, admin, map[string]any{"action": "RESUME", "note": "Уточнение получено"}, 200)
	var shifted bool
	must(pool.QueryRow(ctx, `SELECT warning_at>now() AND breach_at>now() FROM t_task_sla_states WHERE task_id=$1`, task).Scan(&shifted))
	if !shifted {
		t.Fatal("hold duration not excluded from stage SLA")
	}
	sql(`DELETE FROM t_task_sla_states WHERE task_id=$1`, task)

	labAction(id, admin, map[string]any{"action": "QC_PASS", "note": "Проверено"}, 400)
	labAction(id, admin, map[string]any{"action": "SAVE", "details": orders.LabDetails{Channel: "DIGITAL", Family: "FIXED", Prescription: "Задание врача: коронка по скану, заданный цвет и зуб", BatchReferences: "Zirconia LOT TEST-123", DesignRequired: true, ApprovalGateStatusID: middle}}, 200)
	labAction(id, admin, map[string]any{"action": "ACCEPT", "checks": map[string]string{"prescription": "PASS", "records": "PASS", "components": "PASS"}}, 200)

	// A missing bootstrap marker must never turn real orders into disposable seed data.
	sql(`DELETE FROM mvp_bootstrap`)
	if bootstrap.AccountsForMVP(ctx, pool, "different-password", "", "different-password") == nil {
		t.Fatal("non-seed customer data was accepted for initialization cleanup")
	}
	var retainedOrder bool
	must(pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_orders WHERE id=$1)`, id).Scan(&retainedOrder))
	if !retainedOrder {
		t.Fatal("customer order removed during initialization")
	}
	sql(`INSERT INTO mvp_bootstrap(id) VALUES(1)`)

	details := call("GET", "/orders/"+id, admin, nil, 200)
	if details["doctorFullName"] != "Учебный врач Go" || details["deadline"] != today {
		t.Fatal("order metadata lost", details)
	}
	call("GET", "/orders/"+id, tech, nil, 403)
	call("PATCH", "/orders/"+id, admin, map[string]any{"comment": "Updated Go note"}, 200)
	call("GET", "/tasks/dashboard", admin, nil, 200)
	call("GET", "/orders/"+id+"/kanban", admin, nil, 200)
	call("GET", "/orders/"+id+"/kanban", tech, nil, 403)
	call("GET", "/tasks/kanban/my", tech, nil, 200)
	// Attachments: bytes round-trip, multipart, task ownership and personal access.
	upload := func(path, token, name string, data []byte, code int) map[string]any {
		t.Helper()
		var b bytes.Buffer
		mw := multipart.NewWriter(&b)
		part, e := mw.CreateFormFile("file", name)
		must(e)
		_, e = part.Write(data)
		must(e)
		must(mw.Close())
		req, e := http.NewRequest("POST", server.URL+httpapi.Prefix+path, &b)
		must(e)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+token)
		resp, e := http.DefaultClient.Do(req)
		must(e)
		defer resp.Body.Close()
		raw, e := io.ReadAll(resp.Body)
		must(e)
		if resp.StatusCode != code {
			t.Fatalf("upload: %d %s", resp.StatusCode, raw)
		}
		result := map[string]any{}
		if len(raw) > 0 {
			must(json.Unmarshal(raw, &result))
		}
		return result
	}
	data := []byte("%PDF-Go-MVP attachment test")
	file := upload("/tasks/"+task+"/files/upload?type=FILE", admin, "учебный.pdf", data, 201)
	fileID := file["id"].(string)
	call("GET", "/tasks/"+task+"/files/"+fileID+"/url", admin, nil, 200)
	download := func(fid string, want []byte) {
		t.Helper()
		req, e := http.NewRequest("GET", server.URL+httpapi.Prefix+"/tasks/"+task+"/files/"+fid+"/download", nil)
		must(e)
		req.Header.Set("Authorization", "Bearer "+admin)
		resp, e := http.DefaultClient.Do(req)
		must(e)
		defer resp.Body.Close()
		got, e := io.ReadAll(resp.Body)
		must(e)
		if resp.StatusCode != 200 || !bytes.Equal(got, want) {
			t.Fatal("file roundtrip failed", resp.StatusCode)
		}
	}
	download(fileID, data)
	other := uuid.NewString()
	sql(`INSERT INTO t_order_tasks(id,order_id,work_direction_id,work_type_id,status_id,color_id,quantity,price_per_unit,discount_percent) VALUES($1,$2,$3,$4,$5,$6,1,0,0)`, other, id, direction, work, initial, color)
	for _, suffix := range []string{"/url", "/download", ""} {
		method, code := "GET", 403
		if suffix == "" {
			method = "DELETE"
		}
		call(method, "/tasks/"+other+"/files/"+fileID+suffix, admin, nil, code)
	}
	call("GET", "/tasks/"+task+"/files", tech, nil, 403)
	mp := call("POST", "/tasks/"+task+"/files/multipart/init?fileName=large.stl&contentType=application/octet-stream&totalParts=2", admin, nil, 200)
	mpID := mp["fileId"].(string)
	prefix := "/tasks/" + task + "/files/multipart/" + mpID
	call("POST", prefix+"/complete", admin, nil, 400)
	first := bytes.Repeat([]byte("A"), 5<<20)
	second := []byte("last part")
	upload(prefix+"/part?partNumber=1", admin, "part", first, 204)
	upload(prefix+"/part?partNumber=2", admin, "part", second, 204)
	progress := call("GET", prefix+"/progress", admin, nil, 200)
	if progress["progressPercent"] != float64(100) {
		t.Fatal(progress)
	}
	merged := call("POST", prefix+"/complete", admin, nil, 200)
	download(merged["id"].(string), append(first, second...))
	call("DELETE", "/tasks/"+task+"/files/"+fileID, admin, nil, 204)
	call("GET", "/tasks/"+task+"/files/"+fileID+"/url", admin, nil, 404)
	call("DELETE", "/tasks/"+other, admin, nil, 204)
	// Attribute stage closure to the original assignee, even when admin clicks.
	sql(`UPDATE t_order_tasks SET dental_technician_id=$2 WHERE id=$1`, task, techID)
	call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{"active": false}, 200)
	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": middle}, 404)
	call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{"active": true}, 200)
	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": middle, "assignedUserId": adminID, "comment": "First stage"}, 204)
	refreshed := call("GET", "/tasks/dashboard", admin, nil, 200)
	for _, column := range refreshed["columns"].([]any) {
		for _, entry := range column.(map[string]any)["tasks"].([]any) {
			card := entry.(map[string]any)
			if card["id"] == task && card["stageDays"] != float64(0) {
				t.Fatal("stage timer did not reset")
			}
		}
	}
	call("PATCH", "/order-statuses/"+middle+"/activation", admin, map[string]any{"active": false}, 400)

	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": end, "assignedUserId": adminID}, 400)
	labAction(id, admin, map[string]any{"action": "APPROVE_DESIGN", "clinician": "Врач клиники"}, 400)
	labAction(id, admin, map[string]any{"action": "APPROVE_DESIGN", "clinician": "Врач клиники", "note": "Макет согласован, подтверждение сохранено во вложении"}, 200)
	call("PATCH", "/tasks/"+task+"/status", admin, map[string]any{"nextStatusId": end, "assignedUserId": adminID}, 204)
	closed := call("GET", "/orders/"+id, admin, nil, 200)
	if closed["isActive"] != false || closed["completedAt"] == nil {
		t.Fatal("order not closed", closed)
	}
	report := call("GET", "/kpi"+period, admin, nil, 200)
	if len(report["completions"].([]any)) != 2 {
		t.Fatal("completion history missing", report)
	}
	mine := call("GET", "/kpi/my"+period+"&employeeId="+adminID, tech, nil, 200)
	if len(mine["completions"].([]any)) != 1 {
		t.Fatal("personal scope ignored", mine)
	}
	var stockWrites, salaryWrites int
	must(pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM t_stock_reserves WHERE order_id=$1)+(SELECT count(*) FROM t_task_stage_material_usage WHERE order_task_id=$2)`, id, task).Scan(&stockWrites))
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_salary_accruals WHERE order_task_id=$1`, task).Scan(&salaryWrites))
	if stockWrites != 0 || salaryWrites != 0 {
		t.Fatal("disabled accounting mutated")
	}
	labAction(id, admin, map[string]any{"action": "QC_PASS", "note": "Все пункты проверены", "checks": map[string]string{"prescription": "PASS", "fit": "PASS", "function": "PASS", "appearance": "PASS", "traceability": "PASS"}}, 200)
	call("POST", "/tasks/"+task+"/return-for-rework", admin, map[string]any{"targetStatusId": middle, "assignedTo": adminID, "incidentType": "REWORK", "reasonCode": "TRAINING", "description": "Return closed order"}, 201)
	afterRework := call("GET", "/orders/"+id+"/laboratory", admin, nil, 200)
	if afterRework["state"].(map[string]any)["quality"] != "PENDING" {
		t.Fatal("rework retained obsolete quality approval")
	}
	reopened := call("GET", "/orders/"+id, admin, nil, 200)
	if reopened["isActive"] != true || reopened["completedAt"] != nil {
		t.Fatal("rework did not reopen order")
	}
	// Two simultaneous closures must produce exactly one event.
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for range 2 {
		wg.Go(func() {
			raw, _ := json.Marshal(map[string]any{"nextStatusId": end, "assignedUserId": adminID})
			req, _ := http.NewRequest("PATCH", server.URL+httpapi.Prefix+"/tasks/"+task+"/status", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+admin)
			resp, e := http.DefaultClient.Do(req)
			if e != nil {
				codes <- 0
				return
			}
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			codes <- resp.StatusCode
		})
	}
	wg.Wait()
	close(codes)
	success := 0
	for code := range codes {
		if code == 204 {
			success++
		} else if code != 400 {
			t.Fatal("unexpected concurrent status", code)
		}
	}
	if success != 1 {
		t.Fatal("concurrent closure not serialized")
	}
	report = call("GET", "/kpi"+period+"&employeeId="+adminID+"&size=1", admin, nil, 200)
	summary := report["employees"].([]any)[0].(map[string]any)
	if summary["completedTasks"] != float64(1) || summary["units"] != float64(2) || summary["completedStages"] != float64(2) || report["hasNext"] != true {
		t.Fatal("KPI dedup or pagination", report)
	}
	call("GET", "/kpi?from=2026-12-31&to=2026-01-01", admin, nil, 400)
	note := call("POST", "/personal-notes", admin, map[string]any{"title": "Admin private", "content": "Учебная заметка"}, 201)
	call("PUT", "/personal-notes/"+note["id"].(string), tech, map[string]any{"title": "Hijack"}, 404)
	call("GET", "/tasks/"+task+"/history", admin, nil, 200)
	// Background delivery works in Go without Java, Redis or an outbox consumer.
	sql(`INSERT INTO t_outbox_events(event_type,aggregate_type,aggregate_id,payload) VALUES('NOTIFICATION','TASK',$1,jsonb_build_object('userId',$2::uuid,'type','TASK_ASSIGNED','title','Go outbox idempotence','message','Only once','resourceType','TASK','resourceId',$1::uuid)::text)`, task, techID)
	worker := jobs.New(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	must(worker.Tick(ctx))
	must(worker.Tick(ctx))
	var delivered int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_notifications WHERE title='Go outbox idempotence' AND user_id=$1`, techID).Scan(&delivered))
	if delivered != 1 {
		t.Fatal("outbox duplicate or missing", delivered)
	}
	call("POST", "/auth/sessions/logout", "", map[string]any{"refreshToken": adminSession["refreshToken"]}, 204)
	call("POST", "/auth/sessions/refresh", "", map[string]any{"refreshToken": adminSession["refreshToken"]}, 401)
	call("DELETE", "/orders/"+id, admin, nil, 204)
	call("GET", "/orders/"+id, admin, nil, 404)
	retained := call("GET", "/kpi"+period, admin, nil, 200)
	if len(retained["completions"].([]any)) != 3 {
		t.Fatal("deleted order lost KPI", retained)
	}

	// Build a complete route in the empty workspace and exercise each employee's stage.
	template := call("POST", "/admin/workflow/work-types", admin, map[string]any{"workTypeCode": "MVP_PHYSICAL", "workTypeName": "Учебный маршрут", "stages": []any{
		map[string]any{"code": "PLASTERING", "name": "Гипсовка", "requiredRole": "ROLE_PLASTERER"},
		map[string]any{"code": "SCANNING", "name": "Сканирование", "requiredRole": "ROLE_SCANNER"},
		map[string]any{"code": "MODELING", "name": "Моделирование", "requiredRole": "ROLE_OPERATOR"},
		map[string]any{"code": "CERAMICS", "name": "Керамика", "requiredRole": "ROLE_CERAMIST"},
	}}, 201)
	physical := template["workTypeId"].(string)
	// Shared dictionary positions can be equal across different routes.
	sql(`UPDATE t_order_statuses SET sort_order=1 WHERE id IN(SELECT from_status_id FROM t_workflow_steps WHERE work_type_id=$1 UNION SELECT to_status_id FROM t_workflow_steps WHERE work_type_id=$1)`, physical)
	must(bootstrap.AccountsForMVP(ctx, pool, "different-password", "", "different-password"))
	var configuredSteps int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM t_workflow_steps WHERE work_type_id=$1`, physical).Scan(&configuredSteps))
	if configuredSteps != 6 {
		t.Fatal("restart deleted configured workflow")
	}
	call("PUT", "/order-statuses/"+initial, admin, map[string]any{"code": "TODO", "name": "Broken initial", "sortOrder": 1, "initial": false}, 400)
	call("PATCH", "/order-statuses/"+uuid.NewString()+"/activation", admin, map[string]any{"active": false}, 404)
	call("PATCH", "/order-statuses/invalid/activation", admin, map[string]any{"active": false}, 400)
	routeOrder := call("POST", "/orders", admin, map[string]any{"clinicId": clinicID, "patientFullName": "Реальный учебный маршрут", "doctorFullName": "Учебный врач", "deadline": today, "tasks": []any{map[string]any{"workDirectionId": direction, "workTypeId": physical, "quantity": 1, "toothNumbers": []int{21}, "colorId": color, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}}}, 201)
	routeTask := routeOrder["taskIds"].([]any)[0].(string)
	acceptLab(routeOrder["id"].(string))
	for i, phase := range []struct{ email, status, nextEmail string }{
		{"dispatcher@teethtech.kz", "PLASTERING", "plasterer@teethtech.kz"},
		{"plasterer@teethtech.kz", "SCANNING", "scanner@teethtech.kz"},
		{"scanner@teethtech.kz", "MODELING", "operator@teethtech.kz"},
		{"operator@teethtech.kz", "CERAMICS", "ceramist@teethtech.kz"},
		{"ceramist@teethtech.kz", "WAITING_FOR_APPROVAL", "dispatcher@teethtech.kz"},
		{"dispatcher@teethtech.kz", "ORDER_CLOSED", "dispatcher@teethtech.kz"},
	} {
		actorEmail := phase.email
		if i > 0 {
			must(pool.QueryRow(ctx, `SELECT u.email FROM t_order_tasks t JOIN t_users u ON u.id=t.dental_technician_id WHERE t.id=$1`, routeTask).Scan(&actorEmail))
		}
		session := login(actorEmail)
		token := session["accessToken"].(string)
		var target string
		must(pool.QueryRow(ctx, `SELECT id::text FROM t_order_statuses WHERE code=$1`, phase.status).Scan(&target))
		candidates := call("GET", "/tasks/"+routeTask+"/assignment", token, nil, 200)
		if candidates["assignmentMode"] != "AUTO" {
			t.Fatal("unexpected assignment", candidates)
		}
		call("PATCH", "/tasks/"+routeTask+"/status", token, map[string]any{"nextStatusId": target}, 204)
		var actualEmail string
		must(pool.QueryRow(ctx, `SELECT u.email FROM t_order_tasks t JOIN t_users u ON u.id=t.dental_technician_id WHERE t.id=$1`, routeTask).Scan(&actualEmail))
		if actualEmail != phase.nextEmail && !(phase.nextEmail == "ceramist@teethtech.kz" && actualEmail == "ceramist2@teethtech.kz") {
			t.Fatalf("stage %d assigned to %s; want %s", i, actualEmail, phase.nextEmail)
		}
		if i < 5 {
			nextSession := login(actualEmail)
			board := call("GET", "/tasks/kanban/my", nextSession["accessToken"].(string), nil, 200)
			found := false
			for _, v := range board["currentColumn"].(map[string]any)["tasks"].([]any) {
				card := v.(map[string]any)
				if card["id"] == routeTask {
					found = true
					if card["hasAccess"] != true || card["currentStatusId"] != target || card["workTypeId"] != physical {
						t.Fatal("employee card contract", card)
					}
				}
			}
			if !found {
				t.Fatal("next employee did not receive task", phase.nextEmail)
			}
		}
	}
	var completions int
	must(pool.QueryRow(ctx, `SELECT count(*) FROM mvp_task_completions WHERE task_id=$1`, routeTask).Scan(&completions))
	if completions != 6 {
		t.Fatalf("route completions with equal dictionary positions: %d", completions)
	}
	reworkRequest, e := http.NewRequest("GET", server.URL+httpapi.Prefix+"/tasks/"+routeTask+"/rework-options", nil)
	must(e)
	reworkRequest.Header.Set("Authorization", "Bearer "+admin)
	reworkResponse, e := http.DefaultClient.Do(reworkRequest)
	must(e)
	var earlierStages []map[string]any
	must(json.NewDecoder(reworkResponse.Body).Decode(&earlierStages))
	reworkResponse.Body.Close()
	if reworkResponse.StatusCode != 200 || len(earlierStages) != 5 {
		t.Fatalf("previous route stages with equal dictionary positions: %d, HTTP %d", len(earlierStages), reworkResponse.StatusCode)
	}
	routeClosed := call("GET", "/orders/"+routeOrder["id"].(string), admin, nil, 200)
	if routeClosed["isActive"] != false {
		t.Fatal("real workflow did not close order")
	}
	routeID := routeOrder["id"].(string)
	labAction(routeID, admin, map[string]any{"action": "DISPATCH", "recipient": "Клиника"}, 400)
	labAction(routeID, tech, map[string]any{"action": "QC_PASS", "note": "Запрещённая проверка"}, 403)
	labAction(routeID, admin, map[string]any{"action": "QC_PASS", "note": "Все применимые пункты проверены", "checks": map[string]string{"prescription": "PASS", "fit": "PASS", "function": "PASS", "appearance": "PASS", "traceability": "PASS"}}, 200)
	labAction(routeID, admin, map[string]any{"action": "DISPATCH", "recipient": "Курьер лаборатории", "tracking": "TRACK-TEST", "checks": map[string]string{"identity": "PASS", "packaging": "PASS", "disinfection": "PASS", "documents": "PASS"}}, 200)
	labAction(routeID, admin, map[string]any{"action": "DELIVER", "recipient": "Врач клиники", "note": "Получение подтверждено"}, 200)
	call("POST", "/tasks", admin, map[string]any{"orderId": routeID, "workDirectionId": direction, "workTypeId": physical, "quantity": 1, "toothNumbers": []int{22}, "colorId": color, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}, 409)
	returned := labAction(routeID, admin, map[string]any{"action": "RETURN", "reason": "CLINIC_CHANGE", "note": "Изменение оттенка по просьбе врача"}, 200)
	if returned["state"].(map[string]any)["quality"] != "PENDING" {
		t.Fatal("return kept previous QC")
	}
	added := call("POST", "/tasks", admin, map[string]any{"orderId": routeOrder["id"], "workDirectionId": direction, "workTypeId": physical, "quantity": 1, "toothNumbers": []int{22}, "colorId": color, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}, 201)
	_ = added
	revived := call("GET", "/orders/"+routeOrder["id"].(string), admin, nil, 200)
	if revived["isActive"] != true || revived["completedAt"] != nil {
		t.Fatal("new task on a closed order did not reopen it")
	}
	call("DELETE", "/orders/"+routeOrder["id"].(string), admin, nil, 204)

	// Patient identity: repeat orders reuse one card, homonyms require explicit choice.
	var firstPatient string
	must(pool.QueryRow(ctx, `INSERT INTO t_clinic_user_cards(clinic_id,role,full_name) VALUES($1,'patient','Patient Privacy Test') RETURNING id::text`, clinicID).Scan(&firstPatient))
	patientRequest := map[string]any{"clinicId": clinicID, "patientFullName": "Patient Privacy Test", "doctorFullName": "Учебный врач Go", "deadline": today, "tasks": []any{map[string]any{"workDirectionId": direction, "workTypeId": physical, "quantity": 1, "toothNumbers": []int{11}, "materialIds": []string{material}, "pricePerUnit": 0, "discountPercent": 0}}}
	repeat := call("POST", "/orders", admin, patientRequest, 201)
	var linked string
	must(pool.QueryRow(ctx, `SELECT patient_card_id::text FROM t_orders WHERE id=$1`, repeat["id"]).Scan(&linked))
	if linked != firstPatient {
		t.Fatal("repeat order created another patient")
	}
	patientRequest["newPatient"] = true
	privacyOtherOrder := call("POST", "/orders", admin, patientRequest, 201)
	must(pool.QueryRow(ctx, `SELECT patient_card_id::text FROM t_orders WHERE id=$1`, privacyOtherOrder["id"]).Scan(&linked))
	if linked == firstPatient {
		t.Fatal("homonyms were merged")
	}
	patientRequest["newPatient"] = false
	call("POST", "/orders", admin, patientRequest, 400)
	patientRequest["patientCardId"] = firstPatient
	chosen := call("POST", "/orders", admin, patientRequest, 201)
	must(pool.QueryRow(ctx, `SELECT patient_card_id::text FROM t_orders WHERE id=$1`, chosen["id"]).Scan(&linked))
	if linked != firstPatient {
		t.Fatal("explicit patient choice lost")
	}
	var foreignPatient string
	must(pool.QueryRow(ctx, `WITH c AS (INSERT INTO t_clinics(name) VALUES('Privacy other clinic') RETURNING id) INSERT INTO t_clinic_user_cards(clinic_id,role,full_name) SELECT id,'patient','Privacy foreign patient' FROM c RETURNING id::text`).Scan(&foreignPatient))
	patientRequest["patientCardId"] = foreignPatient
	call("POST", "/orders", admin, patientRequest, 400)
	patientRequest["patientCardId"] = uuid.NewString()
	call("POST", "/orders", admin, patientRequest, 400)
	fmt.Println("Autonomous Go MVP verified: fresh migrations, bootstrap, auth, orders, files/multipart, access, KPI, rework, concurrency, notes and jobs")
}
