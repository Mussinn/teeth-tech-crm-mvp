package identity

import (
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Tokens struct {
	key []byte
	ttl time.Duration
}

func NewTokens(secret string, ttl time.Duration) (*Tokens, error) {
	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil || len(key) < 32 {
		return nil, errors.New("JWT_SECRET must be Base64 encoding of at least 32 bytes")
	}
	if ttl < time.Second {
		return nil, errors.New("JWT_EXPIRATION must be at least 1000 milliseconds")
	}
	return &Tokens{key: key, ttl: ttl}, nil
}

func (t *Tokens) Issue(email string, now time.Time) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject: email, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
	}).SignedString(t.key)
}

func (t *Tokens) Subject(raw string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) { return t.key, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || claims.Subject == "" {
		return "", errors.New("invalid access token")
	}
	return claims.Subject, nil
}
