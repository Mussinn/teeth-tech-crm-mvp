//go:build mvp

package integration_test

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"os"
	"teethtech.local/crm/internal/bootstrap"
	"testing"
)

func TestLaboratoryBootstrap(t *testing.T) {
	ctx := t.Context()
	cfg, e := pgxpool.ParseConfig(os.Getenv("MVP_TEST_DATABASE_URL"))
	if e != nil || cfg.ConnConfig.Database != "teethtech_mvp_go_test" {
		t.Fatal("refusing non-test database")
	}
	manager, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer manager.Close()
	const db = "teethtech_mvp_profile_test"
	if _, e = manager.Exec(ctx, `CREATE DATABASE `+db); e != nil {
		t.Fatal(e)
	}
	defer manager.Exec(ctx, `DROP DATABASE `+db+` WITH (FORCE)`)
	cfg = cfg.Copy()
	cfg.ConnConfig.Database = db
	pool, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	if e = bootstrap.Migrate(ctx, pool); e != nil {
		t.Fatal(e)
	}
	h, e := bcrypt.GenerateFromPassword([]byte("PilotChiefPassword2026"), 12)
	if e != nil {
		t.Fatal(e)
	}
	// A registered chief may use an address that previously belonged to a synthetic account.
	profile := bootstrap.LaboratoryProfile{Email: "dispatcher@teethtech.kz", Name: "Registered chief"}
	if e = bootstrap.AccountsForLaboratory(ctx, pool, string(h), profile); e != nil {
		t.Fatal(e)
	}
	var users, clinics, orders int
	var saved string
	if e = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM t_users WHERE deleted_at IS NULL),(SELECT count(*) FROM t_clinics WHERE deleted_at IS NULL),(SELECT count(*) FROM t_orders)`).Scan(&users, &clinics, &orders); e != nil {
		t.Fatal(e)
	}
	if users != 1 || clinics != 0 || orders != 0 {
		t.Fatal("synthetic workspace data exposed", users, clinics, orders)
	}
	if e = pool.QueryRow(ctx, `SELECT password_hash FROM t_users WHERE email=$1 AND deleted_at IS NULL`, profile.Email).Scan(&saved); e != nil {
		t.Fatal(e)
	}
	if saved != string(h) {
		t.Fatal("registered password changed")
	}
	if e = bootstrap.AccountsForLaboratory(ctx, pool, string(h), bootstrap.LaboratoryProfile{Email: "new@example.test", Name: "Different name"}); e != nil {
		t.Fatal(e)
	}
	var email string
	if e = pool.QueryRow(ctx, `SELECT email FROM t_users WHERE deleted_at IS NULL`).Scan(&email); e != nil {
		t.Fatal(e)
	}
	if email != profile.Email {
		t.Fatal("restart replaced administrator")
	}
}
