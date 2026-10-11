package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf16"

	"github.com/jackc/pgx/v5"
	"teethtech.local/crm/internal/dbx"
)

type SLARule struct {
	ID             *string `json:"id"`
	WorkTypeID     *string `json:"workTypeId"`
	StatusID       *string `json:"statusId"`
	WarningMinutes *int32  `json:"warningMinutes"`
	BreachMinutes  *int32  `json:"breachMinutes"`
	EscalationRole *string `json:"escalationRole"`
	Active         bool    `json:"active"`
}

const slaObject = `jsonb_build_object('id',id,'workTypeId',work_type_id,'statusId',status_id,'warningMinutes',warning_minutes,'breachMinutes',breach_minutes,'escalationRole',escalation_role,'active',active)`

func (s *Service) SLARules(ctx context.Context) ([]json.RawMessage, error) {
	return dbx.List(ctx, s.pool, `SELECT `+slaObject+` FROM t_sla_rules ORDER BY id`)
}

// POST preserves Java's legacy save-by-body-ID behavior. PUT always targets the URL ID.
func (s *Service) SaveSLARule(ctx context.Context, id string, r SLARule) (result json.RawMessage, err error) {
	if r.EscalationRole != nil && len(utf16.Encode([]rune(*r.EscalationRole))) > 100 {
		return nil, dbx.Validation("Роль эскалации — до 100 символов")
	}
	if id != "" {
		if r.ID != nil && !strings.EqualFold(*r.ID, id) {
			return nil, dbx.Business("ID правила в адресе и теле запроса не совпадают")
		}
		r.ID = &id
	}
	if r.WarningMinutes == nil || r.BreachMinutes == nil || *r.WarningMinutes <= 0 || *r.BreachMinutes <= *r.WarningMinutes {
		return nil, dbx.Business("Некорректные интервалы SLA")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	defer func() { err = dbx.Constraint(err) }()
	if r.ID != nil {
		var exists bool
		if err = tx.QueryRow(ctx, `SELECT true FROM t_sla_rules WHERE id=$1 FOR UPDATE`, *r.ID).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
			return nil, dbx.Missing("Правило SLA не найдено")
		}
		if err != nil {
			return nil, err
		}
	}
	for _, ref := range []struct {
		id           *string
		sql, message string
	}{
		{r.WorkTypeID, `SELECT true FROM t_work_types WHERE id=$1 AND deleted_at IS NULL`, "Тип работы не найден"},
		{r.StatusID, `SELECT true FROM t_order_statuses WHERE id=$1`, "Статус заказа не найден"},
	} {
		if ref.id != nil {
			var exists bool
			err = tx.QueryRow(ctx, ref.sql, *ref.id).Scan(&exists)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, dbx.Missing(ref.message)
			}
			if err != nil {
				return nil, err
			}
		}
	}
	if r.ID == nil {
		result, err = dbx.One(ctx, tx, `INSERT INTO t_sla_rules(work_type_id,status_id,warning_minutes,breach_minutes,escalation_role,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING `+slaObject, r.WorkTypeID, r.StatusID, r.WarningMinutes, r.BreachMinutes, r.EscalationRole, r.Active)
	} else {
		result, err = dbx.One(ctx, tx, `UPDATE t_sla_rules SET work_type_id=$2,status_id=$3,warning_minutes=$4,breach_minutes=$5,escalation_role=$6,active=$7,updated_at=now() WHERE id=$1 RETURNING `+slaObject, *r.ID, r.WorkTypeID, r.StatusID, r.WarningMinutes, r.BreachMinutes, r.EscalationRole, r.Active)
	}
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
