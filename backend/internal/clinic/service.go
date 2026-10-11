package clinic

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"teethtech.local/crm/internal/dbx"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Request struct {
	Name          string  `json:"name"`
	Address       *string `json:"address"`
	Phone         *string `json:"phone"`
	Email         *string `json:"email"`
	ContactPerson *string `json:"contactPerson"`
	Bin           *string `json:"bin"`
}

func trim(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}
func missing(id string) error {
	return dbx.Missing("Клиника с ID " + id + " не найдена")
}

const detailSelect = `SELECT jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'address',c.address,'contactPerson',c.contact_person,
 'email',c.email,'priceType','Общий прайс','discountPercent',c.discount_percent,'bin',c.bin,
 'totalOrdersCount',stats.n,'totalAmount',stats.amount,'totalPaid',stats.paid,'totalDebt',stats.amount-stats.paid)
 FROM public.t_clinics c CROSS JOIN LATERAL (
 SELECT count(*) n,coalesce(sum(o.total_amount),0) amount,coalesce(sum(o.paid_amount),0) paid
 FROM public.t_orders o JOIN public.t_clinic_user_cards p ON p.id=o.patient_card_id
 WHERE p.clinic_id=c.id AND o.deleted_at IS NULL) stats WHERE c.id=$1 AND c.deleted_at IS NULL`

func (s *Service) Details(ctx context.Context, id string) (json.RawMessage, error) {
	v, err := dbx.One(ctx, s.pool, detailSelect, id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = missing(id)
	}
	return v, err
}
func (s *Service) Create(ctx context.Context, r Request) (id string, err error) {
	r.Bin = trim(r.Bin)
	if r.Bin != nil {
		var exists bool
		if err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.t_clinics WHERE bin=$1 AND deleted_at IS NULL)`, r.Bin).Scan(&exists); err != nil {
			return "", err
		}
		if exists {
			return "", dbx.Business("Клиника с БИН " + *r.Bin + " уже зарегистрирована в Казахстане")
		}
	}
	err = s.pool.QueryRow(ctx, `INSERT INTO public.t_clinics(name,address,phone,email,contact_person,bin) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text`, r.Name, trim(r.Address), trim(r.Phone), trim(r.Email), trim(r.ContactPerson), r.Bin).Scan(&id)
	return id, dbx.Constraint(err)
}
func (s *Service) Update(ctx context.Context, id string, r Request) (json.RawMessage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE public.t_clinics SET name=$2,address=coalesce($3,address),phone=coalesce($4,phone),email=coalesce($5,email),contact_person=coalesce($6,contact_person),bin=coalesce($7,bin),updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, id, r.Name, r.Address, r.Phone, r.Email, r.ContactPerson, r.Bin)
	if err != nil {
		return nil, dbx.Constraint(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, missing(id)
	}
	result, err := dbx.One(ctx, tx, detailSelect, id)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
func (s *Service) Delete(ctx context.Context, id string, card bool) error {
	table := "public.t_clinics"
	if card {
		table = "public.t_clinic_user_cards"
	}
	tag, err := s.pool.Exec(ctx, "UPDATE "+table+" SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL", id)
	if err == nil && tag.RowsAffected() == 0 {
		if card {
			return dbx.Missing("Карточка пациента с ID " + id + " не найдена")
		}
		return missing(id)
	}
	return err
}
func (s *Service) List(ctx context.Context, p Page, search *string) (any, error) {
	order, err := p.Order(map[string]string{"id": "c.id", "name": "c.name", "address": "c.address", "phone": "c.phone", "email": "c.email", "bin": "c.bin", "contactPerson": "c.contact_person", "discountPercent": "c.discount_percent", "createdAt": "c.created_at", "updatedAt": "c.updated_at"}, "c.id")
	if err != nil {
		return nil, err
	}
	projection := `jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'phone',c.phone)`
	join := ""
	if search == nil {
		// Match the Java native count query, including archived orders in list counters.
		projection = `jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'phone',c.phone,'totalOrders',s.n,'activeOrders',s.active,'completedOrders',s.n-s.active)`
		join = ` CROSS JOIN LATERAL (SELECT count(*) n,count(*) FILTER(WHERE o.is_active) active FROM public.t_orders o JOIN public.t_clinic_user_cards u ON u.id=o.patient_card_id WHERE u.clinic_id=c.id) s`
	}
	query := ""
	if search != nil {
		query = *search
	}
	items, err := dbx.List(ctx, s.pool, "SELECT "+projection+" FROM public.t_clinics c"+join+" WHERE c.deleted_at IS NULL AND strpos(lower(c.name),lower($1))>0"+order+" LIMIT $2 OFFSET $3", query, p.Size+1, p.Offset())
	if err != nil {
		return nil, err
	}
	return p.Slice(items), nil
}
func (s *Service) Related(ctx context.Context, id, kind string, p Page) (any, error) {
	columns := map[string]string{"id": "u.id", "fullName": "u.full_name", "createdAt": "u.created_at", "updatedAt": "u.updated_at", "role": "u.role"}
	fallback := "u.id"
	if kind == "orders" {
		columns = map[string]string{"id": "o.id", "orderNumber": "o.order_number", "createdAt": "o.created_at", "updatedAt": "o.updated_at", "deadline": "o.deadline", "totalAmount": "o.total_amount", "paidAmount": "o.paid_amount", "active": "o.is_active"}
		fallback = "o.id"
	}
	order, err := p.Order(columns, fallback)
	if err != nil {
		return nil, err
	}
	var items []json.RawMessage
	if kind == "orders" {
		items, err = dbx.List(ctx, s.pool, `SELECT jsonb_build_object('id',o.order_number,'patientName',u.full_name,'summaryWork',o.comment,'isActive',o.is_active,'totalAmount',o.total_amount,'paidAmount',o.paid_amount) FROM public.t_orders o JOIN public.t_clinic_user_cards u ON u.id=o.patient_card_id WHERE u.clinic_id=$1 AND o.deleted_at IS NULL`+order+` LIMIT $2 OFFSET $3`, id, p.Size+1, p.Offset())
	} else {
		role := "patient"
		if kind == "doctors" {
			role = "doctor"
		}
		items, err = dbx.List(ctx, s.pool, `SELECT jsonb_build_object('id',u.id,'fullName',u.full_name) FROM public.t_clinic_user_cards u WHERE u.clinic_id=$1 AND u.role=$2 AND u.deleted_at IS NULL`+order+` LIMIT $3 OFFSET $4`, id, role, p.Size+1, p.Offset())
	}
	if err != nil {
		return nil, err
	}
	return p.Slice(items), nil
}
