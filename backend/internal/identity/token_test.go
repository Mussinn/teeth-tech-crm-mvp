package identity

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func TestJavaTokenAndBCryptCompatibility(t *testing.T) {
	raw, err := os.ReadFile("testdata/java-auth.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct{ Secret, Token, Subject, Password, PasswordHash string }
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	tokens, err := NewTokens(fixture.Secret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	subject, err := tokens.Subject(fixture.Token)
	if err != nil || subject != fixture.Subject {
		t.Fatal("Java JWT rejected", err)
	}
	if err = bcrypt.CompareHashAndPassword([]byte(fixture.PasswordHash), []byte(fixture.Password)); err != nil {
		t.Fatal("Spring BCrypt rejected", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(fixture.PasswordHash), []byte("incorrect")) == nil {
		t.Fatal("incorrect password accepted")
	}
}

func TestTokenRejectsUnsafeClaimsAndAlgorithms(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	tokens, err := NewTokens(base64.StdEncoding.EncodeToString(key), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		method jwt.SigningMethod
		claims jwt.RegisteredClaims
		key    any
	}{
		{"expired", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "user", ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))}, key},
		{"no_expiry", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "user"}, key},
		{"no_subject", jwt.SigningMethodHS256, jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}, key},
		{"wrong_algorithm", jwt.SigningMethodHS384, jwt.RegisteredClaims{Subject: "user", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}, key},
		{"wrong_key", jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "user", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}, []byte("fedcba9876543210fedcba9876543210")},
		{"unsigned", jwt.SigningMethodNone, jwt.RegisteredClaims{Subject: "user", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}, jwt.UnsafeAllowNoneSignatureType},
	} {
		t.Run(tc.name, func(t *testing.T) {
			token, err := jwt.NewWithClaims(tc.method, tc.claims).SignedString(tc.key)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = tokens.Subject(token); err == nil {
				t.Fatal("invalid token accepted")
			}
		})
	}
	if _, err = tokens.Subject("not-a-token"); err == nil {
		t.Fatal("malformed token accepted")
	}
	raw, err := tokens.Issue("user@example.invalid", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if sub, err := tokens.Subject(raw); err != nil || sub != "user@example.invalid" {
		t.Fatal("issued token rejected")
	}
}

func TestRejectWeakJWTConfiguration(t *testing.T) {
	for _, secret := range []string{"not base64", base64.StdEncoding.EncodeToString([]byte("short"))} {
		if _, err := NewTokens(secret, time.Hour); err == nil {
			t.Fatal("weak configuration accepted")
		}
	}
}
