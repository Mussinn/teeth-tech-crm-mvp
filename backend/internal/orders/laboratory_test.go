package orders

import (
	"teethtech.local/crm/internal/identity"
	"testing"
	"time"
)

func TestLaboratoryGuards(t *testing.T) {
	admin := identity.User{ID: "admin", Email: "admin@lab", Roles: []string{"ROLE_ADMIN"}}
	dispatcher := identity.User{ID: "dispatcher", Roles: []string{"ROLE_DISPATCHER"}}
	base := defaultLabState()
	base.Details.Prescription = "Документированное задание врача"
	base.Details.BatchReferences = "Zirconia LOT 123"
	base.Intake = "ACCEPTED"
	intake := map[string]string{"prescription": "PASS", "records": "PASS", "components": "PASS"}
	quality := map[string]string{"prescription": "PASS", "fit": "PASS", "function": "PASS", "appearance": "NA", "traceability": "PASS"}
	packing := map[string]string{"identity": "PASS", "packaging": "PASS", "disinfection": "PASS", "documents": "PASS"}
	cases := []struct {
		name                     string
		state                    LabState
		request                  LabAction
		actor                    identity.User
		ready, incident, allowed bool
	}{
		{"digital intake", base, LabAction{Action: "ACCEPT", Checks: intake}, admin, false, false, true},
		{"intake checklist missing", base, LabAction{Action: "ACCEPT"}, admin, false, false, false},
		{"quality before production", base, LabAction{Action: "QC_PASS", Note: "Проверено", Checks: quality}, admin, false, false, false},
		{"quality correct", base, LabAction{Action: "QC_PASS", Note: "Внешний вид неприменим к модели", Checks: quality}, admin, true, false, true},
		{"quality requires manager", base, LabAction{Action: "QC_PASS", Note: "Проверено", Checks: quality}, dispatcher, true, false, false},
		{"quality with unresolved incident", base, LabAction{Action: "QC_PASS", Note: "Проверено", Checks: quality}, admin, true, true, false},
		{"quality failure documented", base, LabAction{Action: "QC_FAIL", Note: "Контакт не соответствует заданию"}, admin, true, false, true},
		{"quality failure without reason", base, LabAction{Action: "QC_FAIL"}, admin, true, false, false},
		{"dispatch before quality", base, LabAction{Action: "DISPATCH", Recipient: "Клиника", Checks: packing}, admin, true, false, false},
		{"delivery before dispatch", base, LabAction{Action: "DELIVER", Recipient: "Врач", Note: "Получено"}, admin, true, false, false},
		{"hold reason required", base, LabAction{Action: "HOLD"}, admin, false, false, false},
		{"documented hold", base, LabAction{Action: "HOLD", Note: "Нужен новый скан"}, admin, false, false, true},
		{"approval evidence", base, LabAction{Action: "APPROVE_DESIGN", Clinician: "Врач", Note: "Подтверждение во вложении"}, admin, false, false, true},
		{"approval evidence missing", base, LabAction{Action: "APPROVE_DESIGN", Clinician: "Врач"}, admin, false, false, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := applyLabAction(c.state, c.request, c.actor, c.ready, c.incident, time.Now())
			if (err == nil) != c.allowed {
				t.Fatalf("allowed=%v err=%v", c.allowed, err)
			}
		})
	}
	t.Run("physical material disinfection", func(t *testing.T) {
		s := base
		s.Details.Channel = "PHYSICAL"
		if _, e := applyLabAction(s, LabAction{Action: "ACCEPT", Checks: intake}, admin, false, false, time.Now()); e == nil {
			t.Fatal("unchecked physical materials accepted")
		}
	})
	t.Run("implant identification", func(t *testing.T) {
		s := base
		s.Details.Family = "IMPLANT"
		if _, e := applyLabAction(s, LabAction{Action: "ACCEPT", Checks: intake}, admin, false, false, time.Now()); e == nil {
			t.Fatal("implant without system/platform accepted")
		}
	})
	t.Run("mandatory quality cannot be NA", func(t *testing.T) {
		q := map[string]string{}
		for k, v := range quality {
			q[k] = v
		}
		q["traceability"] = "NA"
		if _, e := applyLabAction(base, LabAction{Action: "QC_PASS", Note: "Проверено", Checks: q}, admin, true, false, time.Now()); e == nil {
			t.Fatal("traceability skipped")
		}
	})
	t.Run("logistics edit preserves clinical acceptance", func(t *testing.T) {
		s := base
		s.Quality = "PASSED"
		d := s.Details
		d.Appointment = "2026-11-01"
		d.Rush = true
		r, e := applyLabAction(s, LabAction{Action: "SAVE", Details: &d}, admin, true, false, time.Now())
		if e != nil || r.Intake != "ACCEPTED" || r.Quality != "PASSED" {
			t.Fatal(r, e)
		}
	})
	t.Run("prescription edit invalidates acceptance and quality", func(t *testing.T) {
		s := base
		s.Quality = "PASSED"
		d := s.Details
		d.Prescription = "Изменённый дизайн"
		r, e := applyLabAction(s, LabAction{Action: "SAVE", Details: &d}, admin, true, false, time.Now())
		if e != nil || r.Intake != "PENDING" || r.Quality != "PENDING" {
			t.Fatal(r, e)
		}
	})
	t.Run("delivered product requires return before editing", func(t *testing.T) {
		s := base
		s.Delivery = "DELIVERED"
		d := s.Details
		if _, e := applyLabAction(s, LabAction{Action: "SAVE", Details: &d}, admin, true, false, time.Now()); e == nil {
			t.Fatal("delivered case edited")
		}
		r, e := applyLabAction(s, LabAction{Action: "RETURN", Reason: "CLINIC_CHANGE", Note: "Новый оттенок по просьбе врача"}, admin, true, false, time.Now())
		if e != nil || r.Delivery != "RETURNED" || r.Quality != "PENDING" || r.Intake != "PENDING" {
			t.Fatal(r, e)
		}
	})
}
