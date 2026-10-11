// Package bootstrap owns the autonomous Go MVP schema and one-time account setup.
package bootstrap

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"fmt"
	"hash/crc32"
	"io/fs"
	"net/mail"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrate applies embedded SQL in one transaction under a cross-process lock.
// Existing Java MVP installations are adopted only when every Flyway checksum matches.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(746382910)`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS public.mvp_schema_migrations(version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	var legacy bool
	if err = tx.QueryRow(ctx, `SELECT to_regclass('public.flyway_schema_history') IS NOT NULL`).Scan(&legacy); err != nil {
		return err
	}
	entries, err := fs.ReadDir(migrations, "migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool { return version(entries[i].Name()) < version(entries[j].Name()) })
	for _, entry := range entries {
		v := version(entry.Name())
		raw, err := migrations.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return err
		}
		checksum := fmt.Sprintf("%x", sha256.Sum256(raw))
		var saved string
		err = tx.QueryRow(ctx, `SELECT checksum FROM public.mvp_schema_migrations WHERE version=$1`, v).Scan(&saved)
		if err == nil {
			if saved != checksum {
				return fmt.Errorf("migration %d checksum changed", v)
			}
			continue
		}
		if err != pgx.ErrNoRows {
			return err
		}
		adopted := false
		if legacy {
			var oldChecksum int32
			var script string
			err = tx.QueryRow(ctx, `SELECT checksum,script FROM public.flyway_schema_history WHERE success AND version=$1`, strconv.Itoa(v)).Scan(&oldChecksum, &script)
			if err == nil {
				// Flyway CRC32 hashes UTF-8 lines without newline separators.
				normalized := strings.ReplaceAll(strings.TrimPrefix(string(raw), "\ufeff"), "\r\n", "\n")
				crc := crc32.NewIEEE()
				for _, line := range strings.Split(normalized, "\n") {
					crc.Write([]byte(line))
				}
				if script != entry.Name() || int32(crc.Sum32()) != oldChecksum {
					return fmt.Errorf("legacy migration %d checksum differs", v)
				}
				adopted = true
			} else if err != pgx.ErrNoRows {
				return err
			}
		}
		if !adopted {
			if _, err = tx.Exec(ctx, string(raw), pgx.QueryExecModeSimpleProtocol); err != nil {
				return fmt.Errorf("migration %d: %w", v, err)
			}
		}
		// A pg_dump changes search_path; reset it before subsequent runtime queries.
		if _, err = tx.Exec(ctx, `SET search_path TO public`); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO public.mvp_schema_migrations(version,checksum) VALUES($1,$2)`, v, checksum); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func version(name string) int {
	n, _ := strconv.Atoi(strings.Split(strings.TrimPrefix(name, "V"), "__")[0])
	return n
}

func Accounts(ctx context.Context, pool *pgxpool.Pool, adminPassword, trainingPassword string) error {
	return AccountsWithHash(ctx, pool, adminPassword, "", trainingPassword)
}

// AccountsWithHash accepts an existing BCrypt hash without hashing it again.
func AccountsWithHash(ctx context.Context, pool *pgxpool.Pool, adminPassword, suppliedHash, trainingPassword string) error {
	return accounts(ctx, pool, adminPassword, suppliedHash, trainingPassword, false)
}

// AccountsForMVP initializes a new installation with no training orders or working stages.
func AccountsForMVP(ctx context.Context, pool *pgxpool.Pool, adminPassword, suppliedHash, trainingPassword string) error {
	return accounts(ctx, pool, adminPassword, suppliedHash, trainingPassword, true)
}

//go:embed empty_workflow.sql
var emptyWorkflowSQL string

func accounts(ctx context.Context, pool *pgxpool.Pool, adminPassword, suppliedHash, trainingPassword string, emptyWorkflow bool) error {
	return accountsProfile(ctx, pool, adminPassword, suppliedHash, trainingPassword, emptyWorkflow, nil)
}

// LaboratoryProfile is applied once, only on a fresh isolated SaaS installation.
type LaboratoryProfile struct{ Email, Name string }

func AccountsForLaboratory(ctx context.Context, pool *pgxpool.Pool, suppliedHash string, profile LaboratoryProfile) error {
	parsed, err := mail.ParseAddress(profile.Email)
	if err != nil || parsed.Address != profile.Email || len(profile.Name) < 2 || len(profile.Name) > 200 {
		return fmt.Errorf("invalid laboratory administrator profile")
	}
	return accountsProfile(ctx, pool, "", suppliedHash, "", true, &profile)
}

func accountsProfile(ctx context.Context, pool *pgxpool.Pool, adminPassword, suppliedHash, trainingPassword string, emptyWorkflow bool, profile *LaboratoryProfile) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(746382911)`); err != nil {
		return err
	}
	var done bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM mvp_bootstrap WHERE id=1)`).Scan(&done); err != nil {
		return err
	}
	if done {
		return tx.Commit(ctx)
	}
	if profile != nil {
		var legacy bool
		if err = tx.QueryRow(ctx, `SELECT to_regclass('public.flyway_schema_history') IS NOT NULL`).Scan(&legacy); err != nil {
			return err
		}
		if legacy {
			return fmt.Errorf("laboratory profile requires a fresh Go installation")
		}
	}
	if emptyWorkflow {
		var legacy bool
		if err = tx.QueryRow(ctx, `SELECT to_regclass('public.flyway_schema_history') IS NOT NULL`).Scan(&legacy); err != nil {
			return err
		}
		if !legacy {
			if _, err = tx.Exec(ctx, emptyWorkflowSQL, pgx.QueryExecModeSimpleProtocol); err != nil {
				return fmt.Errorf("initialize empty workflow: %w", err)
			}
		}
	}
	if trainingPassword == "" {
		trainingPassword = rand.Text()
	}
	if (suppliedHash == "" && (len(adminPassword) < 12 || len(adminPassword) > 72)) || len(trainingPassword) < 12 || len(trainingPassword) > 72 {
		return fmt.Errorf("MVP account passwords must contain 12..72 bytes; run setup")
	}
	adminHash := []byte(suppliedHash)
	if suppliedHash != "" {
		if len(adminHash) != 60 {
			return fmt.Errorf("invalid MVP_ADMIN_PASSWORD_HASH length")
		}
		if _, err = bcrypt.Cost(adminHash); err != nil {
			return fmt.Errorf("invalid MVP_ADMIN_PASSWORD_HASH: %w", err)
		}
	} else {
		adminHash, err = bcrypt.GenerateFromPassword([]byte(adminPassword), 12)
		if err != nil {
			return err
		}
	}
	trainingHash, err := bcrypt.GenerateFromPassword([]byte(trainingPassword), 12)
	if err != nil {
		return err
	}
	// V2 contains synthetic training accounts only. Protect fresh data before serving HTTP.
	if _, err = tx.Exec(ctx, `UPDATE t_users SET password_hash=CASE WHEN email='admin@teethtech.kz' THEN $1 ELSE $2 END,credentials_changed_at=now(),failed_login_attempts=0,locked_until=NULL`, string(adminHash), string(trainingHash)); err != nil {
		return err
	}
	if profile != nil {
		// Remove synthetic accounts from the employee list without breaking seeded foreign keys.
		if _, err = tx.Exec(ctx, `UPDATE t_users SET status='INACTIVE',deleted_at=now(),email='disabled-'||id::text||'@invalid.teethtech.local',phone='' WHERE email<>'admin@teethtech.kz'`); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE t_users SET email=$1,name=$2,phone='' WHERE email='admin@teethtech.kz'`, profile.Email, profile.Name); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE t_clinics SET deleted_at=now()`); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO mvp_bootstrap(id) VALUES(1)`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
