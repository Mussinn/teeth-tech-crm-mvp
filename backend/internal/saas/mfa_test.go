package saas

import (
	"testing"
	"time"
)

func TestTOTPAndReplay(t *testing.T) {
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	at := time.Unix(59, 0)
	counter, ok := totp(secret, "287082", at, -1)
	if !ok || counter != 1 {
		t.Fatal("RFC code failed")
	}
	if _, ok = totp(secret, "287082", at, counter); ok {
		t.Fatal("replay allowed")
	}
	if _, ok = totp(secret, "000000", at, -1); ok {
		t.Fatal("wrong code allowed")
	}
}
func TestOTPSecretProtection(t *testing.T) {
	s := &Server{cfg: Config{WorkerSecret: "private-test-key"}}
	a, e := s.sealOTP("SECRET")
	if e != nil {
		t.Fatal(e)
	}
	plain, e := s.openOTP(a)
	if e != nil || plain != "SECRET" {
		t.Fatal("roundtrip failed")
	}
	s.cfg.WorkerSecret = "other-key"
	if _, e = s.openOTP(a); e == nil {
		t.Fatal("wrong key allowed")
	}
}
