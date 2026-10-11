package warehouse

import (
	"encoding/json"
	"testing"
)

func TestStageUsageQuantityPrecision(t *testing.T) {
	for _, tc := range []struct {
		value          string
		positive, want bool
	}{
		{"0", false, true}, {"0", true, false}, {"0.0001", true, true}, {"999999999999999.9999", true, true},
		{"1e-4", true, true}, {"1e15", true, false}, {"0.00001", false, false}, {"1.00000", false, false},
		{"-0.0001", false, false}, {"1/2", false, false}, {"NaN", false, false}, {"", false, false},
	} {
		if got := validQuantity(json.Number(tc.value), tc.positive); got != tc.want {
			t.Errorf("%s positive=%v: %v", tc.value, tc.positive, got)
		}
	}
	if ValidateStageUsages([]*StageUsage{nil}) == nil {
		t.Fatal("null report item accepted")
	}
}
