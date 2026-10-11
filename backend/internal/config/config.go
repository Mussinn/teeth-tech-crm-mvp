package config

import (
	"fmt"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	PersonalNotesRetentionDays int
	PersonalNotesMaxActive     int
	MaxKanbanCards             int
	HTTPAddr                   string
	ReadHeaderTimeout          time.Duration
	IdleTimeout                time.Duration
	ShutdownTimeout            time.Duration
	DatabaseURL                string
	JWTSecret                  string
	AccessTTL                  time.Duration
	RefreshTTL                 time.Duration
	MaxFailedLogins            int
	LoginLockDuration          time.Duration
	AuthRateLimit              int
	AllowedOrigins             []string
	TrustedProxies             []netip.Prefix
}

// Load accepts an explicit environment reader so tests never alter process state.
func Load(getenv func(string) string) (Config, error) {
	c := Config{HTTPAddr: "127.0.0.1:8082"}
	if value := getenv("HTTP_ADDR"); value != "" {
		c.HTTPAddr = value
	}
	_, port, err := net.SplitHostPort(c.HTTPAddr)
	if err != nil {
		return Config{}, fmt.Errorf("HTTP_ADDR must be host:port")
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		return Config{}, fmt.Errorf("HTTP_ADDR requires a port between 1 and 65535")
	}
	for _, setting := range []struct {
		name     string
		fallback time.Duration
		target   *time.Duration
	}{
		{"HTTP_READ_HEADER_TIMEOUT", 5 * time.Second, &c.ReadHeaderTimeout},
		{"HTTP_IDLE_TIMEOUT", 60 * time.Second, &c.IdleTimeout},
		{"HTTP_SHUTDOWN_TIMEOUT", 15 * time.Second, &c.ShutdownTimeout},
	} {
		*setting.target = setting.fallback
		if value := getenv(setting.name); value != "" {
			duration, err := time.ParseDuration(value)
			if err != nil || duration <= 0 {
				return Config{}, fmt.Errorf("%s must be a positive duration", setting.name)
			}
			*setting.target = duration
		}
	}
	c.DatabaseURL = getenv("DATABASE_URL")
	c.JWTSecret = getenv("JWT_SECRET")
	if c.DatabaseURL != "" && c.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required with DATABASE_URL")
	}
	for _, setting := range []struct {
		name          string
		fallback, max int64
		target        *time.Duration
		unit          time.Duration
	}{
		{"JWT_EXPIRATION", 86400000, 31536000000, &c.AccessTTL, time.Millisecond},
		{"JWT_REFRESH_EXPIRATION", 2592000000, 31536000000, &c.RefreshTTL, time.Millisecond},
		{"LOGIN_LOCK_MINUTES", 15, 1440, &c.LoginLockDuration, time.Minute},
	} {
		n := setting.fallback
		if value := getenv(setting.name); value != "" {
			var err error
			n, err = strconv.ParseInt(value, 10, 64)
			if err != nil || n < 1 || n > setting.max {
				return Config{}, fmt.Errorf("invalid %s", setting.name)
			}
		}
		*setting.target = time.Duration(n) * setting.unit
	}
	if c.AccessTTL < time.Second || c.RefreshTTL < time.Second {
		return Config{}, fmt.Errorf("token expiration must be at least 1000 milliseconds")
	}
	for _, setting := range []struct {
		name     string
		fallback int
		target   *int
	}{
		{"PERSONAL_NOTES_RETENTION_DAYS", 30, &c.PersonalNotesRetentionDays}, {"PERSONAL_NOTES_MAX_ACTIVE_PER_USER", 100, &c.PersonalNotesMaxActive},
		{"LOGIN_MAX_FAILED_ATTEMPTS", 5, &c.MaxFailedLogins}, {"AUTH_RATE_LIMIT_PER_MINUTE", 20, &c.AuthRateLimit},
	} {
		*setting.target = setting.fallback
		if value := getenv(setting.name); value != "" {
			n, err := strconv.Atoi(value)
			if err != nil || n < 1 || n > 100000 {
				return Config{}, fmt.Errorf("invalid %s", setting.name)
			}
			*setting.target = n
		}
	}
	c.MaxKanbanCards = 300
	if value := getenv("KANBAN_MAX_CARDS"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil {
			return Config{}, fmt.Errorf("invalid KANBAN_MAX_CARDS")
		}
		c.MaxKanbanCards = max(1, min(n, 1000))
	}
	c.AllowedOrigins = []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"}
	if raw := getenv("CORS_ALLOWED_ORIGINS"); raw != "" {
		c.AllowedOrigins = nil
		for _, origin := range strings.Split(raw, ",") {
			origin = strings.TrimSpace(origin)
			if origin == "" || origin == "*" {
				return Config{}, fmt.Errorf("CORS_ALLOWED_ORIGINS requires explicit origins")
			}
			c.AllowedOrigins = append(c.AllowedOrigins, origin)
		}
	}
	if raw := getenv("TRUSTED_PROXY_CIDRS"); raw != "" {
		for _, value := range strings.Split(raw, ",") {
			prefix, err := netip.ParsePrefix(strings.TrimSpace(value))
			if err != nil {
				return Config{}, fmt.Errorf("invalid TRUSTED_PROXY_CIDRS")
			}
			c.TrustedProxies = append(c.TrustedProxies, prefix)
		}
	}
	return c, nil
}
