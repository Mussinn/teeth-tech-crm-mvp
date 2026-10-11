package orders

import (
	"encoding/json"
	"testing"
)

func TestCreateAmountValidation(t *testing.T) {
	for _, tc := range []struct {
		value string
		valid bool
	}{
		{"0", true}, {"0.005", true}, {"1e-4", true}, {"99999999.99", true}, {"100000000", false}, {"-0.01", false}, {"", false}, {"1/2", false}, {"NaN", false}, {"1e999999999", false},
	} {
		if got := validAmount(json.Number(tc.value), "99999999.99"); got != tc.valid {
			t.Errorf("%q: got %v", tc.value, got)
		}
	}
}

func TestCreateValidationRejectsNullTaskAndDuplicateTeeth(t *testing.T) {
	const id = "00000000-0000-0000-0000-000000000001"
	r := CreateRequest{ClinicID: id, Patient: "  Patient   Name  ", Doctor: "Doctor", Deadline: "2030-01-01", Tasks: []*CreateTask{nil}}
	if r.validate() == nil {
		t.Fatal("null task accepted")
	}
	task := &CreateTask{WorkDirectionID: id, WorkTypeID: id, ColorID: id, Quantity: 1, MaterialIDs: []string{id}, Price: "0", Discount: "0", Teeth: []int{11, 11}}
	r.Tasks = []*CreateTask{task}
	if r.validate() == nil {
		t.Fatal("duplicate teeth accepted")
	}
	task.Teeth = []int{11, 28, 31, 48}
	if err := r.validate(); err != nil {
		t.Fatal(err)
	}
	if r.Patient != "Patient Name" || task.Mode != "AUTO" {
		t.Fatal("normalization/default mismatch")
	}
	task.Discount = "100.0001"
	if r.validate() == nil {
		t.Fatal("discount above 100 accepted")
	}
}
