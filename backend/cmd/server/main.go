package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"teethtech.local/crm/internal/adminops"
	"teethtech.local/crm/internal/bootstrap"
	"teethtech.local/crm/internal/catalog"
	"teethtech.local/crm/internal/clinic"
	"teethtech.local/crm/internal/config"
	"teethtech.local/crm/internal/files"
	"teethtech.local/crm/internal/httpapi"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/jobs"
	"teethtech.local/crm/internal/kpi"
	"teethtech.local/crm/internal/notes"
	"teethtech.local/crm/internal/notifications"
	"teethtech.local/crm/internal/orders"
	"teethtech.local/crm/internal/workflow"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if e := run(logger); e != nil {
		logger.Error("server stopped", "error", e)
		os.Exit(1)
	}
}
func run(logger *slog.Logger) error {
	cfg, e := config.Load(os.Getenv)
	if e != nil {
		return e
	}
	if cfg.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL required")
	}
	// Modules are extension points; accounting is intentionally unavailable in this MVP.
	if os.Getenv("MVP_FINANCE_ENABLED") == "true" || os.Getenv("MVP_WAREHOUSE_ENABLED") == "true" {
		return fmt.Errorf("warehouse and finance are outside this MVP; keep module flags false")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pc, e := pgxpool.ParseConfig(cfg.DatabaseURL)
	if e != nil {
		return fmt.Errorf("invalid DATABASE_URL")
	}
	pc.MaxConns = 10
	pc.ConnConfig.ConnectTimeout = 5 * time.Second
	pc.ConnConfig.RuntimeParams["application_name"] = "teethtech-mvp-go"
	pc.ConnConfig.RuntimeParams["search_path"] = "public"
	pool, e := pgxpool.NewWithConfig(ctx, pc)
	if e != nil {
		return e
	}
	defer pool.Close()
	startup, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	if e = pool.Ping(startup); e != nil {
		return fmt.Errorf("database unavailable")
	}
	if e = bootstrap.Migrate(startup, pool); e != nil {
		return e
	}
	if os.Getenv("MVP_ADMIN_EMAIL") != "" {
		e = bootstrap.AccountsForLaboratory(startup, pool, os.Getenv("MVP_ADMIN_PASSWORD_HASH"), bootstrap.LaboratoryProfile{Email: os.Getenv("MVP_ADMIN_EMAIL"), Name: os.Getenv("MVP_ADMIN_NAME")})
	} else {
		e = bootstrap.AccountsForMVP(startup, pool, os.Getenv("MVP_ADMIN_PASSWORD"), os.Getenv("MVP_ADMIN_PASSWORD_HASH"), os.Getenv("MVP_TRAINING_PASSWORD"))
	}
	if e != nil {
		return e
	}
	tokens, e := identity.NewTokens(cfg.JWTSecret, cfg.AccessTTL)
	if e != nil {
		return e
	}
	auth, e := identity.NewService(pool, tokens, identity.Settings{RefreshTTL: cfg.RefreshTTL, MaxFailed: cfg.MaxFailedLogins, LockDuration: cfg.LoginLockDuration})
	if e != nil {
		return e
	}
	storage, e := files.New(pool, os.Getenv("AWS_S3_ENDPOINT"), os.Getenv("AWS_S3_ACCESS_KEY"), os.Getenv("AWS_S3_SECRET_KEY"), os.Getenv("AWS_S3_BUCKET_NAME"))
	if e != nil {
		return e
	}
	if e = storage.Initialize(startup); e != nil {
		return fmt.Errorf("initialize attachment storage: %w", e)
	}
	orderService := orders.NewWithKanbanLimit(pool, cfg.MaxKanbanCards)
	orderService.ConfigureMVP(false, false)
	worker := jobs.New(pool, logger)
	workerCtx, workerStop := context.WithCancel(ctx)
	defer workerStop()
	done := make(chan struct{})
	go func() { defer close(done); worker.Run(workerCtx) }()
	defer func() { workerStop(); <-done }()
	ready := func(ctx context.Context) error {
		if e := pool.Ping(ctx); e != nil {
			return e
		}
		return storage.Ready(ctx)
	}
	handler := httpapi.New(httpapi.Options{Identity: auth, Admin: adminops.New(pool), Catalog: catalog.New(pool), Clinics: clinic.New(pool), Orders: orderService, Workflow: workflow.New(pool), Notes: notes.NewWithLimits(pool, cfg.PersonalNotesRetentionDays, cfg.PersonalNotesMaxActive), Notifications: notifications.New(pool), KPI: kpi.New(pool), Files: storage, Ready: ready, AuthRateLimit: cfg.AuthRateLimit, AllowedOrigins: cfg.AllowedOrigins, TrustedProxies: cfg.TrustedProxies})
	server := &http.Server{Addr: cfg.HTTPAddr, Handler: handler, ReadHeaderTimeout: cfg.ReadHeaderTimeout, IdleTimeout: cfg.IdleTimeout, MaxHeaderBytes: 1 << 20}
	result := make(chan error, 1)
	go func() { result <- server.ListenAndServe() }()
	logger.Info("starting TeethTech CRM MVP", "backend", "Go", "address", cfg.HTTPAddr)
	select {
	case e := <-result:
		if errors.Is(e, http.ErrServerClosed) {
			return nil
		}
		return e
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if e := server.Shutdown(shutdown); e != nil {
			server.Close()
			return e
		}
		return nil
	}
}
