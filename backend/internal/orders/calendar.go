package orders

import (
	"context"
	"encoding/json"
	"time"

	"teethtech.local/crm/internal/dbx"
)

type CalendarDay struct {
	Date      string            `json:"date"`
	TaskCount int               `json:"taskCount"`
	Tasks     []json.RawMessage `json:"tasks"`
}

type EmployeeCalendar struct {
	Year  int           `json:"year"`
	Month int           `json:"month"`
	Days  []CalendarDay `json:"days"`
}

// Calendar is personal even for administrators and dispatchers. Historical
// terminal tasks and inactive orders remain visible, matching the Java calendar.
func (s *Service) Calendar(ctx context.Context, employee string, year, month int) (EmployeeCalendar, error) {
	result := EmployeeCalendar{Year: year, Month: month, Days: []CalendarDay{}}
	if year < 1 || year > 9999 || month < 1 || month > 12 {
		return result, dbx.Business("Год должен быть от 1 до 9999, месяц — от 1 до 12")
	}
	from := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	// One query gives a consistent month snapshot. Use dates without timezone
	// conversion and the same inner joins and ordering as Java's DTO projection.
	rows, err := s.pool.Query(ctx, `SELECT o.deadline::text,jsonb_build_object(
 'taskId',t.id,'orderId',o.id,'orderNumber',o.order_number,'deadline',o.deadline,
 'patientName',p.full_name,'clinicName',c.name,'workTypeName',w.name,'workTypeCode',w.code,
 'statusName',st.name,'statusCode',st.code,'statusColor',st.color_hex,'quantity',t.quantity)
 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id
 JOIN t_clinic_user_cards p ON p.id=o.patient_card_id JOIN t_clinics c ON c.id=p.clinic_id
 JOIN t_work_types w ON w.id=t.work_type_id JOIN t_order_statuses st ON st.id=t.status_id
 WHERE t.dental_technician_id=$1 AND o.deadline>=$2::date AND o.deadline<$3::date AND t.deleted_at IS NULL AND o.deleted_at IS NULL
 ORDER BY o.deadline,o.order_number,t.id`, employee, from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var date string
		var task json.RawMessage
		if err = rows.Scan(&date, &task); err != nil {
			return result, err
		}
		if len(result.Days) == 0 || result.Days[len(result.Days)-1].Date != date {
			result.Days = append(result.Days, CalendarDay{Date: date, Tasks: []json.RawMessage{}})
		}
		day := &result.Days[len(result.Days)-1]
		day.Tasks = append(day.Tasks, task)
		day.TaskCount++
	}
	return result, rows.Err()
}
