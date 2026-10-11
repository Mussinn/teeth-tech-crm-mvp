package identity

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Role struct {
	ID            string  `json:"id"`
	Code          string  `json:"code"`
	Name          *string `json:"name"`
	SystemManaged bool    `json:"systemManaged"`
	AssignedUsers int64   `json:"assignedUsers"`
	WorkflowSteps int64   `json:"workflowSteps"`
	Deletable     bool    `json:"deletable"`
}

var separators = regexp.MustCompile(`[^A-Z0-9]+`)

func NormalizeRole(raw string) (string, error) {
	value := strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(raw)), "ROLE_")
	value = strings.Trim(separators.ReplaceAllString(value, "_"), "_")
	if value == "" {
		return "", business("Код роли должен содержать латинские буквы или цифры")
	}
	value = "ROLE_" + value
	if len(value) > 50 {
		return "", business("Код роли не должен превышать 50 символов")
	}
	return value, nil
}

const roleSelect = `SELECT r.id::text,r.code,r.description,r.system_managed,
 (SELECT count(DISTINCT u.id) FROM public.t_user_roles ur JOIN public.t_users u ON u.id=ur.user_id WHERE ur.role_id=r.id AND u.deleted_at IS NULL),
 (SELECT count(*) FROM public.t_workflow_steps w WHERE w.required_role=r.code AND w.deleted_at IS NULL)
 FROM public.t_roles r `

func scanRole(row pgx.Row) (Role, error) {
	var r Role
	err := row.Scan(&r.ID, &r.Code, &r.Name, &r.SystemManaged, &r.AssignedUsers, &r.WorkflowSteps)
	r.Deletable = !r.SystemManaged && r.AssignedUsers == 0 && r.WorkflowSteps == 0
	return r, err
}
func (s *Service) Roles(ctx context.Context) ([]Role, error) {
	rows, err := s.pool.Query(ctx, roleSelect+`ORDER BY r.system_managed DESC,r.code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Role{}
	for rows.Next() {
		r, err := scanRole(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}
func (s *Service) CreateRole(ctx context.Context, raw, name string) (Role, error) {
	code, err := NormalizeRole(raw)
	if err != nil {
		return Role{}, err
	}
	var id string
	err = s.pool.QueryRow(ctx, `INSERT INTO public.t_roles(id,code,description,system_managed) VALUES(gen_random_uuid(),$1,$2,false) RETURNING id::text`, code, strings.TrimSpace(name)).Scan(&id)
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23505" {
		return Role{}, business("Роль с кодом " + code + " уже существует")
	}
	if err != nil {
		return Role{}, err
	}
	name = strings.TrimSpace(name)
	return Role{ID: id, Code: code, Name: &name, Deletable: true}, nil
}
func (s *Service) MutateRole(ctx context.Context, id string, name *string) (Role, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Role{}, err
	}
	defer tx.Rollback(context.Background())
	var lockedID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_roles WHERE id=$1 FOR UPDATE`, id).Scan(&lockedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, roleMissing(id)
	}
	if err != nil {
		return Role{}, err
	}
	// Separate statement: after waiting for an assignment's KEY SHARE lock,
	// counts must use a fresh READ COMMITTED snapshot, not the pre-wait snapshot.
	role, err := scanRole(tx.QueryRow(ctx, roleSelect+`WHERE r.id=$1`, id))
	if err != nil {
		return Role{}, err
	}
	if role.SystemManaged {
		return Role{}, business("Системную роль нельзя изменять или удалять")
	}
	if name != nil {
		value := strings.TrimSpace(*name)
		role.Name = &value
		if _, err = tx.Exec(ctx, `UPDATE public.t_roles SET description=$2 WHERE id=$1`, id, value); err != nil {
			return Role{}, err
		}
	} else {
		if role.AssignedUsers > 0 || role.WorkflowSteps > 0 {
			return Role{}, business("Нельзя удалить используемую роль")
		}
		if _, err = tx.Exec(ctx, `DELETE FROM public.t_roles WHERE id=$1`, id); err != nil {
			var pgerr *pgconn.PgError
			if errors.As(err, &pgerr) && pgerr.Code == "23503" {
				return Role{}, business("Нельзя удалить роль: существуют связанные записи")
			}
			return Role{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Role{}, err
	}
	return role, nil
}
