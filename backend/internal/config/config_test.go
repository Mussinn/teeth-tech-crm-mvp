package config

import (
	"testing"
	"time"
)

func TestDefaultPortDoesNotReplaceJava(t *testing.T) {
	cfg, err := Load(func(string) string { return "" })
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTPAddr != "127.0.0.1:8082" || cfg.ShutdownTimeout != 15*time.Second {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestRejectInvalidConfig(t *testing.T) {
	for _, tc := range []struct{ key, value string }{
		{"HTTP_ADDR", "8082"}, {"HTTP_ADDR", "localhost:0"},
		{"HTTP_ADDR", "localhost:65536"}, {"HTTP_ADDR", "localhost:http"},
		{"HTTP_SHUTDOWN_TIMEOUT", "0s"}, {"HTTP_READ_HEADER_TIMEOUT", "-1s"},
		{"HTTP_IDLE_TIMEOUT", "wrong"},
		{"PERSONAL_NOTES_RETENTION_DAYS", "0"}, {"PERSONAL_NOTES_MAX_ACTIVE_PER_USER", "-1"},
		{"DATABASE_URL", "postgres://test@localhost/test"},
		{"JWT_EXPIRATION", "999"}, {"JWT_EXPIRATION", "9223372036854775807"},
		{"JWT_REFRESH_EXPIRATION", "-1"}, {"LOGIN_MAX_FAILED_ATTEMPTS", "0"},
		{"AUTH_RATE_LIMIT_PER_MINUTE", "0"}, {"CORS_ALLOWED_ORIGINS", "*"},
		{"TRUSTED_PROXY_CIDRS", "not-a-network"},
	} {
		t.Run(tc.key+"="+tc.value, func(t *testing.T) {
			_, err := Load(func(key string) string {
				if key == tc.key {
					return tc.value
				}
				return ""
			})
			if err == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
}

func TestKanbanLimitMatchesJavaClamp(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want int
	}{{"", 300}, {"-1", 1}, {"0", 1}, {"15", 15}, {"1001", 1000}} {
		cfg, err := Load(func(key string) string {
			if key == "KANBAN_MAX_CARDS" {
				return tc.raw
			}
			return ""
		})
		if err != nil || cfg.MaxKanbanCards != tc.want {
			t.Fatalf("limit %q: %d, %v", tc.raw, cfg.MaxKanbanCards, err)
		}
	}
	if _, err := Load(func(key string) string {
		if key == "KANBAN_MAX_CARDS" {
			return "invalid"
		}
		return ""
	}); err == nil {
		t.Fatal("invalid limit accepted")
	}
}

func TestPersonalNoteSettings(t *testing.T) {
	for _, custom := range []bool{false, true} {
		cfg, err := Load(func(key string) string {
			if custom {
				switch key {
				case "PERSONAL_NOTES_RETENTION_DAYS":
					return "7"
				case "PERSONAL_NOTES_MAX_ACTIVE_PER_USER":
					return "2"
				}
			}
			return ""
		})
		days, limit := 30, 100
		if custom {
			days, limit = 7, 2
		}
		if err != nil || cfg.PersonalNotesRetentionDays != days || cfg.PersonalNotesMaxActive != limit {
			t.Fatalf("settings: %+v %v", cfg, err)
		}
	}
}
