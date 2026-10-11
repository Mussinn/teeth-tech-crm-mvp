// Package dbx contains small PostgreSQL helpers shared by migrated domains.
package dbx

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"teethtech.local/crm/internal/identity"
)

type Querier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func List(ctx context.Context, q Querier, sql string, args ...any) ([]json.RawMessage, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []json.RawMessage{}
	for rows.Next() {
		var item json.RawMessage
		if err := rows.Scan(&item); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func One(ctx context.Context, q Querier, sql string, args ...any) (json.RawMessage, error) {
	var result json.RawMessage
	err := q.QueryRow(ctx, sql, args...).Scan(&result)
	return result, err
}

func Missing(message string) error {
	return &identity.Failure{Status: 404, Code: "ENT_001", Message: message}
}
func Business(message string) error {
	return &identity.Failure{Status: 400, Code: "BUS_001", Message: message}
}
func Validation(message string) error {
	return &identity.Failure{Status: 400, Code: "VAL_001", Message: message}
}

// Constraint errors must not disclose SQL or database details to clients.
func Constraint(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505":
			return Business("Запись с такими уникальными реквизитами уже существует")
		case "23503":
			return Business("Операция нарушает связь с другой записью")
		case "22001", "23502", "23514":
			return Validation("Некорректное значение поля")
		}
	}
	return err
}
