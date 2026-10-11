package main

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"teethtech.local/crm/internal/saas"
	"time"
)

func main() {
	if e := run(); e != nil {
		log.Print(e)
		os.Exit(1)
	}
}
func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, e := pgxpool.ParseConfig(os.Getenv("SAAS_DATABASE_URL"))
	if e != nil {
		return fmt.Errorf("invalid SAAS_DATABASE_URL")
	}
	cfg.MaxConns = 6
	pool, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		return e
	}
	defer pool.Close()
	startup, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	if e = pool.Ping(startup); e != nil {
		return fmt.Errorf("SaaS database unavailable")
	}
	base, _ := strconv.Atoi(os.Getenv("SAAS_LAB_PORT_BASE"))
	handler, e := saas.New(startup, pool, saas.Config{PublicURL: os.Getenv("SAAS_PUBLIC_URL"), BaseDomain: os.Getenv("SAAS_BASE_DOMAIN"), OwnerEmail: os.Getenv("SAAS_OWNER_EMAIL"), OwnerPassword: os.Getenv("SAAS_OWNER_PASSWORD"), WorkerSecret: os.Getenv("SAAS_WORKER_SECRET"), PortBase: base})
	if e != nil {
		return e
	}
	addr := os.Getenv("SAAS_HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8099"
	}
	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 120 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	done := make(chan error, 1)
	go func() { done <- srv.ListenAndServe() }()
	log.Print("SaaS pilot portal started")
	select {
	case e := <-done:
		if e == http.ErrServerClosed {
			return nil
		}
		return e
	case <-ctx.Done():
		end, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(end)
	}
}
