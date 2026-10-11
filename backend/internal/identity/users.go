package identity

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type CreateEmployee struct {
	FullName   string   `json:"fullName"`
	Email      string   `json:"email"`
	Phone      string   `json:"phone"`
	Role       string   `json:"role"`
	Password   string   `json:"password"`
	Directions []string `json:"workDirectionIds"`
}
type UpdateEmployee struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
	Phone *string `json:"phone"`
}
type AdminEmployee struct {
	Roles      []string `json:"roles"`
	Status     string   `json:"status"`
	Directions []string `json:"workDirectionIds"`
}

func business(message string) error { return &Failure{400, "BUS_001", message} }
func employeeMissing(id string) error {
	return &Failure{404, "ENT_001", "Сотрудник с ID " + id + " не найден"}
}
func roleMissing(code string) error {
	return &Failure{404, "ENT_001", "Роль " + code + " не найдена"}
}
func roleCode(raw string) string {
	code := strings.ToUpper(raw)
	if !strings.HasPrefix(code, "ROLE_") {
		code = "ROLE_" + code
	}
	return code
}
func duplicateEmail(err error, email string) error {
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23505" {
		return business("Пользователь с email " + email + " уже существует в системе")
	}
	return err
}

// All mutations lock the user row, using the same order as refresh/logout-all.
func (s *Service) mutateEmployee(ctx context.Context, id string, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var locked string
	err = tx.QueryRow(ctx, `SELECT id::text FROM public.t_users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, id).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return employeeMissing(id)
	}
	if err != nil {
		return err
	}
	if err = fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) CreateEmployees(ctx context.Context, requests []CreateEmployee) ([]string, error) {
	// Hash before acquiring DB locks; BCrypt remains compatible with Spring.
	hashes := make([]string, len(requests))
	for i, r := range requests {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		value, err := bcrypt.GenerateFromPassword([]byte(r.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hashes[i] = string(value)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(context.Background())
	ids := make([]string, 0, len(requests))
	for i, r := range requests {
		var id string
		err = tx.QueryRow(ctx, `INSERT INTO public.t_users(id,email,name,phone,password_hash,status) VALUES(gen_random_uuid(),$1,$2,$3,$4,'ACTIVE') RETURNING id::text`, r.Email, r.FullName, r.Phone, hashes[i]).Scan(&id)
		if err != nil {
			return nil, duplicateEmail(err, r.Email)
		}
		if err = assignRoles(ctx, tx, id, []string{r.Role}); err != nil {
			return nil, err
		}
		if err = assignDirections(ctx, tx, id, r.Directions); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ids, nil
}

func assignRoles(ctx context.Context, tx pgx.Tx, id string, codes []string) error {
	// Stable ordering prevents cross-role lock inversions in concurrent batches.
	normalized := map[string]bool{}
	for _, code := range codes {
		normalized[roleCode(code)] = true
	}
	keys := make([]string, 0, len(normalized))
	for code := range normalized {
		keys = append(keys, code)
	}
	// KEY SHARE holds roles through assignment; role deletion takes FOR UPDATE
	// before counting usage (the FK alone would allow cascading link deletion).
	rows, err := tx.Query(ctx, `SELECT id::text,code FROM public.t_roles WHERE code=ANY($1) ORDER BY code FOR KEY SHARE`, keys)
	if err != nil {
		return err
	}
	roleIDs := []string{}
	for rows.Next() {
		var rid, code string
		if err = rows.Scan(&rid, &code); err != nil {
			rows.Close()
			return err
		}
		roleIDs = append(roleIDs, rid)
		delete(normalized, code)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(normalized) > 0 {
		for _, code := range keys {
			if normalized[code] {
				return roleMissing(code)
			}
		}
	}
	if _, err = tx.Exec(ctx, `DELETE FROM public.t_user_roles WHERE user_id=$1`, id); err != nil {
		return err
	}
	for _, rid := range roleIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_user_roles(user_id,role_id) VALUES($1,$2)`, id, rid); err != nil {
			return err
		}
	}
	return nil
}

func assignDirections(ctx context.Context, tx pgx.Tx, id string, directions []string) error {
	// Validate the complete set before replacing links; [] means clear, nil is
	// interpreted by the caller (create: empty; admin patch: leave unchanged).
	seen := map[string]bool{}
	for _, direction := range directions {
		seen[strings.ToLower(direction)] = true
	}
	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	rows, err := tx.Query(ctx, `SELECT id::text FROM public.t_work_directions WHERE id::text=ANY($1) AND deleted_at IS NULL ORDER BY id FOR KEY SHARE`, keys)
	if err != nil {
		return err
	}
	found := []string{}
	for rows.Next() {
		var value string
		if err = rows.Scan(&value); err != nil {
			rows.Close()
			return err
		}
		found = append(found, value)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(found) != len(seen) {
		return &Failure{404, "ENT_001", "Одно или несколько направлений работ не найдены"}
	}
	if _, err = tx.Exec(ctx, `DELETE FROM public.t_user_work_directions WHERE user_id=$1`, id); err != nil {
		return err
	}
	for _, direction := range found {
		if _, err = tx.Exec(ctx, `INSERT INTO public.t_user_work_directions(user_id,work_direction_id) VALUES($1,$2)`, id, direction); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) UpdateEmployee(ctx context.Context, id string, r UpdateEmployee) error {
	return s.mutateEmployee(ctx, id, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE public.t_users SET name=COALESCE($2,name),email=COALESCE($3,email),phone=COALESCE($4,phone),updated_at=now() WHERE id=$1`, id, r.Name, r.Email, r.Phone)
		if r.Email != nil {
			return duplicateEmail(err, *r.Email)
		}
		return err
	})
}
func (s *Service) ChangePassword(ctx context.Context, id, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.mutateEmployee(ctx, id, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE public.t_users SET password_hash=$2,updated_at=now() WHERE id=$1`, id, string(hash))
		return err
	})
}
func (s *Service) AdminEmployee(ctx context.Context, id string, r AdminEmployee) error {
	return s.mutateEmployee(ctx, id, func(tx pgx.Tx) error {
		if err := assignRoles(ctx, tx, id, r.Roles); err != nil {
			return err
		}
		if r.Directions != nil {
			if err := assignDirections(ctx, tx, id, r.Directions); err != nil {
				return err
			}
		}
		return setStatus(ctx, tx, id, strings.ToUpper(r.Status), false)
	})
}
func (s *Service) SetEmployeeStatus(ctx context.Context, id, status string, deleted bool) error {
	return s.mutateEmployee(ctx, id, func(tx pgx.Tx) error { return setStatus(ctx, tx, id, status, deleted) })
}
func setStatus(ctx context.Context, tx pgx.Tx, id, status string, deleted bool) error {
	if status != "ACTIVE" && status != "INACTIVE" {
		return business("Допустимые статусы сотрудника: ACTIVE, INACTIVE")
	}
	if _, err := tx.Exec(ctx, `UPDATE public.t_users SET status=$2,deleted_at=CASE WHEN $3 THEN now() ELSE deleted_at END,updated_at=now() WHERE id=$1`, id, status, deleted); err != nil {
		return err
	}
	if status == "INACTIVE" {
		_, err := tx.Exec(ctx, `UPDATE public.t_refresh_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, id)
		return err
	}
	return nil
}

func (s *Service) Employees(ctx context.Context) (json.RawMessage, error) {
	// Count current tasks; completion timestamps come from the immutable KPI ledger.
	const query = `SELECT COALESCE(jsonb_agg(employee ORDER BY employee->>'fullName',employee->>'id'),'[]'::jsonb) FROM (
 SELECT jsonb_build_object('id',u.id,'fullName',u.name,'status',u.status,
 'roles',COALESCE((SELECT jsonb_agg(r.code ORDER BY r.code) FROM public.t_roles r JOIN public.t_user_roles ur ON ur.role_id=r.id WHERE ur.user_id=u.id),'[]'::jsonb),
 'workDirections',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'code',d.code,'description',d.description,'active',d.is_active) ORDER BY d.name,d.id) FROM public.t_work_directions d JOIN public.t_user_work_directions ud ON ud.work_direction_id=d.id WHERE ud.user_id=u.id AND d.deleted_at IS NULL),'[]'::jsonb),
 'stats',(SELECT jsonb_build_object('completed',count(*) FILTER(WHERE os.is_terminal),
 'inProgress',count(*) FILTER(WHERE o.is_active AND NOT os.is_terminal),
 'overdue',count(*) FILTER(WHERE o.is_active AND NOT os.is_terminal AND o.deadline<(now() AT TIME ZONE 'Asia/Aqtobe')::date),
 'totalTasks',count(*),
 'avgDays',coalesce(round(avg(extract(epoch FROM (h.finished_at-t.created_at))/86400) FILTER(WHERE os.is_terminal AND h.finished_at IS NOT NULL)::numeric,1),0),
 'timelyPercent',coalesce(round(100.0*count(*) FILTER(WHERE os.is_terminal AND (h.finished_at AT TIME ZONE 'Asia/Aqtobe')::date<=o.deadline)/nullif(count(*) FILTER(WHERE os.is_terminal AND h.finished_at IS NOT NULL AND o.deadline IS NOT NULL),0),1),0))
 FROM public.t_order_tasks t JOIN public.t_orders o ON o.id=t.order_id AND o.deleted_at IS NULL JOIN public.t_order_statuses os ON os.id=t.status_id
 LEFT JOIN LATERAL(SELECT max(completed_at) finished_at FROM mvp_task_completions WHERE task_id=t.id AND terminal) h ON true
 WHERE t.dental_technician_id=u.id AND t.deleted_at IS NULL)
 ) employee FROM public.t_users u WHERE u.deleted_at IS NULL) employees`
	var raw []byte
	err := s.pool.QueryRow(ctx, query).Scan(&raw)
	return json.RawMessage(raw), err
}
