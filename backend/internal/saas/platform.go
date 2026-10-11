package saas

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

type platformActor struct {
	Slot  int
	ID    string
	Roles []string
	Owner bool
}

func (a platformActor) manager() bool {
	for _, r := range a.Roles {
		if r == "ROLE_ADMIN" || r == "ROLE_CHIEF_TECHNICIAN" {
			return true
		}
	}
	return false
}
func (s *Server) platformIdentity(r *http.Request, slot int) (platformActor, error) {
	a := platformActor{Slot: slot}
	cookie, e := r.Cookie("teethTechJwt")
	if e != nil {
		return a, &failure{401, "Войдите в CRM"}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	req, e := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("http://127.0.0.1:%d/api/backend/auth/current", s.cfg.PortBase+slot), nil)
	if e != nil {
		return a, e
	}
	req.Host = r.Host
	req.AddCookie(cookie)
	req.Header.Set("X-Forwarded-Proto", s.public.Scheme)
	client := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, e := client.Do(req)
	if e != nil {
		return a, &failure{503, "Не удалось проверить вход в CRM"}
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return a, &failure{401, "Сессия CRM истекла. Войдите снова"}
	}
	var user struct {
		ID    string   `json:"id"`
		Roles []string `json:"roles"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 16384)).Decode(&user) != nil || user.ID == "" {
		return a, &failure{401, "Не удалось проверить пользователя"}
	}
	a.ID = user.ID
	a.Roles = user.Roles
	return a, nil
}
func (s *Server) registerPlatform() {
	for _, path := range []string{"/api/owner/support", "/api/owner/support/{id}", "/api/owner/support/{id}/messages", "/api/owner/support/{id}/attachments/{file}", "/api/owner/community", "/api/owner/community/{id}/hide"} {
		for _, method := range []string{"GET", "POST"} {
			s.mux.HandleFunc(method+" "+path, s.wrap(s.owner(func(w http.ResponseWriter, r *http.Request) error {
				return s.platformRequest(w, r, platformActor{Owner: true, ID: "Владелец сервиса"})
			})))
		}
	}
}
func (s *Server) platform(w http.ResponseWriter, r *http.Request, slot int) error {
	if r.Method != "GET" && r.Header.Get("Origin") != strings.TrimRight(s.labURL(slot), "/") {
		return &failure{403, "Запрос должен идти из вашей CRM"}
	}
	a, e := s.platformIdentity(r, slot)
	if e != nil {
		return e
	}
	return s.platformRequest(w, r, a)
}
func readPlatform(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 40000)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil || d.Decode(new(any)) != io.EOF {
		return bad("Некорректные данные")
	}
	return nil
}
func bounded(v string, n int) bool {
	return strings.TrimSpace(v) != "" && utf8.RuneCountInString(v) <= n
}
func (s *Server) platformRequest(w http.ResponseWriter, r *http.Request, a platformActor) error {
	if r.Method != "GET" && !s.throttle(fmt.Sprintf("platform:%d:%s", a.Slot, a.ID), 30) {
		return &failure{429, "Слишком много действий. Подождите минуту"}
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/platform/")
	if a.Owner {
		path = strings.TrimPrefix(r.URL.Path, "/api/owner/")
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return &failure{404, "Не найдено"}
	}
	if parts[0] == "tickets" || parts[0] == "support" {
		return s.support(w, r, a, parts)
	}
	if parts[0] == "community" {
		return s.community(w, r, a, parts)
	}
	return &failure{404, "Не найдено"}
}
func rowsJSON(ctx context.Context, tx interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, q string, args ...any) ([]json.RawMessage, error) {
	rows, e := tx.Query(ctx, q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []json.RawMessage{}
	for rows.Next() {
		var raw []byte
		if e = rows.Scan(&raw); e != nil {
			return nil, e
		}
		out = append(out, json.RawMessage(raw))
	}
	return out, rows.Err()
}
func (s *Server) ticketAccess(ctx context.Context, a platformActor, id int64) error {
	var allowed bool
	e := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM saas_support_tickets WHERE id=$1 AND ($2 OR (slot=$3 AND ($4 OR requester=$5))))`, id, a.Owner, a.Slot, a.manager(), a.ID).Scan(&allowed)
	if e != nil {
		return e
	}
	if !allowed {
		return &failure{404, "Заявка не найдена"}
	}
	return nil
}
func (s *Server) support(w http.ResponseWriter, r *http.Request, a platformActor, p []string) error {
	ctx := r.Context()
	if len(p) == 1 {
		if r.Method == "GET" {
			result, e := rowsJSON(ctx, s.pool, `SELECT jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'page',t.page,'lab',l.name,'slot',t.slot,'createdAt',t.created_at,'updatedAt',t.updated_at) FROM saas_support_tickets t JOIN saas_labs l ON l.slot=t.slot WHERE ($1 OR (t.slot=$2 AND ($3 OR t.requester=$4))) ORDER BY t.updated_at DESC,t.id DESC LIMIT 51 OFFSET $5`, a.Owner, a.Slot, a.manager(), a.ID, platformOffset(r))
			if e != nil {
				return e
			}
			reply(w, 200, result)
			return nil
		}
		if r.Method == "POST" && !a.Owner {
			var in struct{ Title, Body, Page string }
			if e := readPlatform(w, r, &in); e != nil {
				return e
			}
			if !bounded(in.Title, 200) || !bounded(in.Body, 8000) || len(in.Page) > 500 || strings.ContainsAny(in.Page, "?#") {
				return bad("Укажите тему и описание. Страница должна быть без параметров и токенов")
			}
			tx, e := s.pool.Begin(ctx)
			if e != nil {
				return e
			}
			defer tx.Rollback(ctx)
			var id int64
			e = tx.QueryRow(ctx, `INSERT INTO saas_support_tickets(slot,requester,title,page) VALUES($1,$2,$3,$4) RETURNING id`, a.Slot, a.ID, strings.TrimSpace(in.Title), in.Page).Scan(&id)
			if e != nil {
				return e
			}
			if _, e = tx.Exec(ctx, `INSERT INTO saas_support_messages(ticket_id,author,body) VALUES($1,'Сотрудник лаборатории',$2)`, id, strings.TrimSpace(in.Body)); e != nil {
				return e
			}
			if e = tx.Commit(ctx); e != nil {
				return e
			}
			reply(w, 201, map[string]any{"id": id})
			return nil
		}
		return &failure{405, "Метод не поддерживается"}
	}
	id, e := strconv.ParseInt(p[1], 10, 64)
	if e != nil || id < 1 {
		return bad("Некорректная заявка")
	}
	if e = s.ticketAccess(ctx, a, id); e != nil {
		return e
	}
	if len(p) == 2 && r.Method == "GET" {
		messages, e := rowsJSON(ctx, s.pool, `SELECT jsonb_build_object('id',id,'author',author,'owner',owner_reply,'body',body,'createdAt',created_at) FROM saas_support_messages WHERE ticket_id=$1 ORDER BY id`, id)
		if e != nil {
			return e
		}
		files, e := rowsJSON(ctx, s.pool, `SELECT jsonb_build_object('id',id,'name',filename) FROM saas_support_files WHERE ticket_id=$1 ORDER BY id`, id)
		if e != nil {
			return e
		}
		var raw []byte
		e = s.pool.QueryRow(ctx, `SELECT jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'page',t.page,'lab',l.name) FROM saas_support_tickets t JOIN saas_labs l ON l.slot=t.slot WHERE t.id=$1`, id).Scan(&raw)
		if e != nil {
			return e
		}
		reply(w, 200, map[string]any{"ticket": json.RawMessage(raw), "messages": messages, "files": files})
		return nil
	}
	if len(p) == 3 && p[2] == "messages" && r.Method == "POST" {
		var in struct{ Body, Status string }
		if e = readPlatform(w, r, &in); e != nil {
			return e
		}
		if !bounded(in.Body, 8000) {
			return bad("Введите сообщение (до 8000 символов)")
		}
		if in.Status != "" && (!a.Owner || !onePlatformStatus(in.Status)) {
			return bad("Статус меняет только поддержка")
		}
		tx, e := s.pool.Begin(ctx)
		if e != nil {
			return e
		}
		defer tx.Rollback(ctx)
		var status string
		if e = tx.QueryRow(ctx, `SELECT status FROM saas_support_tickets WHERE id=$1 FOR UPDATE`, id).Scan(&status); e != nil {
			return e
		}
		if in.Status != "" {
			status = in.Status
		} else if !a.Owner && status == "RESOLVED" {
			status = "OPEN"
		}
		label := "Сотрудник лаборатории"
		if a.Owner {
			label = "Поддержка"
		}
		if _, e = tx.Exec(ctx, `INSERT INTO saas_support_messages(ticket_id,author,owner_reply,body) VALUES($1,$2,$3,$4)`, id, label, a.Owner, strings.TrimSpace(in.Body)); e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, `UPDATE saas_support_tickets SET status=$2,updated_at=now() WHERE id=$1`, id, status); e != nil {
			return e
		}
		if e = tx.Commit(ctx); e != nil {
			return e
		}
		reply(w, 201, map[string]bool{"ok": true})
		return nil
	}
	if len(p) == 3 && p[2] == "attachments" && r.Method == "POST" && !a.Owner {
		r.Body = http.MaxBytesReader(w, r.Body, 1024*1024+8192)
		if e = r.ParseMultipartForm(1024 * 1024); e != nil {
			return bad("Прикрепите PNG или JPEG до 1 МБ")
		}
		if r.MultipartForm != nil {
			defer r.MultipartForm.RemoveAll()
		}
		f, h, e := r.FormFile("file")
		if e != nil {
			return bad("Файл обязателен")
		}
		defer f.Close()
		raw, e := io.ReadAll(io.LimitReader(f, 1024*1024+1))
		if e != nil {
			return e
		}
		if len(raw) > 1024*1024 {
			return bad("Файл больше 1 МБ")
		}
		config, format, e := image.DecodeConfig(bytes.NewReader(raw))
		if e != nil || (format != "png" && format != "jpeg") || config.Width > 10000 || config.Height > 10000 {
			return bad("Нужен PNG или JPEG с допустимым размером")
		}
		var count int
		tx, e := s.pool.Begin(ctx)
		if e != nil {
			return e
		}
		defer tx.Rollback(ctx)
		if _, e = tx.Exec(ctx, `SELECT id FROM saas_support_tickets WHERE id=$1 FOR UPDATE`, id); e != nil {
			return e
		}
		if e = tx.QueryRow(ctx, `SELECT count(*) FROM saas_support_files WHERE ticket_id=$1`, id).Scan(&count); e != nil {
			return e
		}
		if count >= 3 {
			return bad("Не больше трёх скриншотов на заявку")
		}
		name := strings.Map(func(c rune) rune {
			if c < ' ' || c == '/' || c == '\\' {
				return -1
			}
			return c
		}, h.Filename)
		if len(name) > 200 {
			name = "screenshot." + format
		}
		if _, e = tx.Exec(ctx, `INSERT INTO saas_support_files(ticket_id,filename,mime,data) VALUES($1,$2,$3,$4)`, id, name, "image/"+format, raw); e != nil {
			return e
		}
		if e = tx.Commit(ctx); e != nil {
			return e
		}
		reply(w, 201, map[string]bool{"ok": true})
		return nil
	}
	if len(p) == 4 && p[2] == "attachments" && r.Method == "GET" {
		file, e := strconv.ParseInt(p[3], 10, 64)
		if e != nil {
			return bad("Некорректный файл")
		}
		var data []byte
		var name, kind string
		e = s.pool.QueryRow(ctx, `SELECT data,filename,mime FROM saas_support_files WHERE id=$1 AND ticket_id=$2`, file, id).Scan(&data, &name, &kind)
		if e == pgx.ErrNoRows {
			return &failure{404, "Файл не найден"}
		}
		if e != nil {
			return e
		}
		w.Header().Set("Content-Type", kind)
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
		w.Write(data)
		return nil
	}
	return &failure{405, "Метод не поддерживается"}
}
func onePlatformStatus(v string) bool {
	return v == "OPEN" || v == "IN_PROGRESS" || v == "WAITING" || v == "RESOLVED"
}
func platformOffset(r *http.Request) int {
	n, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if n < 0 {
		return 0
	}
	return n
}
func (s *Server) community(w http.ResponseWriter, r *http.Request, a platformActor, p []string) error {
	ctx := r.Context()
	if len(p) == 2 && p[1] == "profile" && !a.Owner {
		if r.Method == "GET" {
			var name, city string
			var enabled bool
			e := s.pool.QueryRow(ctx, `SELECT public_name,city,enabled FROM saas_community_profiles WHERE slot=$1`, a.Slot).Scan(&name, &city, &enabled)
			if e != nil && e != pgx.ErrNoRows {
				return e
			}
			reply(w, 200, map[string]any{"name": name, "city": city, "enabled": enabled, "canManage": a.manager()})
			return nil
		}
		if r.Method == "POST" {
			if !a.manager() {
				return &failure{403, "Участие лаборатории настраивает руководитель"}
			}
			var in struct {
				Name, City string
				Enabled    bool
			}
			if e := readPlatform(w, r, &in); e != nil {
				return e
			}
			if !bounded(in.Name, 200) || utf8.RuneCountInString(in.City) > 100 {
				return bad("Укажите публичное название лаборатории")
			}
			_, e := s.pool.Exec(ctx, `INSERT INTO saas_community_profiles(slot,public_name,city,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(slot) DO UPDATE SET public_name=$2,city=$3,enabled=$4`, a.Slot, strings.TrimSpace(in.Name), strings.TrimSpace(in.City), in.Enabled)
			if e != nil {
				return e
			}
			reply(w, 200, map[string]bool{"ok": true})
			return nil
		}
	}
	if !a.Owner {
		var enabled bool
		e := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM saas_community_profiles WHERE slot=$1 AND enabled)`, a.Slot).Scan(&enabled)
		if e != nil {
			return e
		}
		if !enabled {
			return &failure{403, "Лаборатория ещё не присоединилась к сообществу"}
		}
	}
	if len(p) == 1 && r.Method == "GET" {
		posts, e := rowsJSON(ctx, s.pool, `SELECT jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'category',p.category,'lab',c.public_name,'city',c.city,'createdAt',p.created_at,'hidden',p.hidden,'canDelete',($1 OR (p.slot=$2 AND p.author=$3)),'reportReasons',CASE WHEN $1 THEN coalesce((SELECT jsonb_agg(reason ORDER BY id) FROM saas_community_reports r WHERE r.post_id=p.id),'[]'::jsonb) ELSE '[]'::jsonb END,'reports',(SELECT count(*) FROM saas_community_reports r WHERE r.post_id=p.id),'comments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'lab',cp.public_name,'createdAt',m.created_at) ORDER BY m.id) FROM saas_community_comments m JOIN saas_community_profiles cp ON cp.slot=m.slot WHERE m.post_id=p.id AND ($1 OR cp.enabled)),'[]'::jsonb)) FROM saas_community_posts p JOIN saas_community_profiles c ON c.slot=p.slot WHERE $1 OR (c.enabled AND NOT p.hidden) ORDER BY p.id DESC LIMIT 21 OFFSET $4`, a.Owner, a.Slot, a.ID, platformOffset(r))
		if e != nil {
			return e
		}
		reply(w, 200, posts)
		return nil
	}
	if len(p) == 1 && r.Method == "POST" && !a.Owner {
		var in struct{ Title, Body, Category string }
		if e := readPlatform(w, r, &in); e != nil {
			return e
		}
		if !bounded(in.Title, 200) || !bounded(in.Body, 8000) || !(in.Category == "QUESTIONS" || in.Category == "JOBS" || in.Category == "PARTNERSHIP" || in.Category == "NEWS") {
			return bad("Укажите тему, текст и раздел")
		}
		var id int64
		e := s.pool.QueryRow(ctx, `INSERT INTO saas_community_posts(slot,author,category,title,body) VALUES($1,$2,$3,$4,$5) RETURNING id`, a.Slot, a.ID, in.Category, strings.TrimSpace(in.Title), strings.TrimSpace(in.Body)).Scan(&id)
		if e != nil {
			return e
		}
		reply(w, 201, map[string]any{"id": id})
		return nil
	}
	if len(p) == 3 {
		id, e := strconv.ParseInt(p[1], 10, 64)
		if e != nil {
			return bad("Некорректная публикация")
		}
		var allowed bool
		e = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM saas_community_posts p JOIN saas_community_profiles c ON c.slot=p.slot WHERE p.id=$1 AND ($2 OR (NOT p.hidden AND c.enabled)))`, id, a.Owner).Scan(&allowed)
		if e != nil {
			return e
		}
		if !allowed {
			return &failure{404, "Публикация не найдена"}
		}
		if p[2] == "hide" && r.Method == "POST" {
			tag, e := s.pool.Exec(ctx, `UPDATE saas_community_posts SET hidden=true WHERE id=$1 AND ($2 OR (slot=$3 AND author=$4))`, id, a.Owner, a.Slot, a.ID)
			if e != nil {
				return e
			}
			if tag.RowsAffected() == 0 {
				return &failure{403, "Можно удалить только свою публикацию"}
			}
			reply(w, 200, map[string]bool{"ok": true})
			return nil
		}
		if p[2] == "comments" && r.Method == "POST" && !a.Owner {
			var in struct{ Body string }
			if e = readPlatform(w, r, &in); e != nil {
				return e
			}
			if !bounded(in.Body, 2000) {
				return bad("Комментарий: до 2000 символов")
			}
			var n int
			if e = s.pool.QueryRow(ctx, `SELECT count(*) FROM saas_community_comments WHERE post_id=$1`, id).Scan(&n); e != nil {
				return e
			}
			if n >= 100 {
				return bad("Достигнут лимит комментариев")
			}
			_, e = s.pool.Exec(ctx, `INSERT INTO saas_community_comments(post_id,slot,body) VALUES($1,$2,$3)`, id, a.Slot, strings.TrimSpace(in.Body))
			if e != nil {
				return e
			}
			reply(w, 201, map[string]bool{"ok": true})
			return nil
		}
		if p[2] == "report" && r.Method == "POST" && !a.Owner {
			var in struct{ Reason string }
			if e = readPlatform(w, r, &in); e != nil {
				return e
			}
			if !bounded(in.Reason, 1000) {
				return bad("Укажите причину жалобы")
			}
			_, e = s.pool.Exec(ctx, `INSERT INTO saas_community_reports(post_id,slot,reason) VALUES($1,$2,$3) ON CONFLICT(post_id,slot) DO UPDATE SET reason=$3`, id, a.Slot, in.Reason)
			if e != nil {
				return e
			}
			reply(w, 201, map[string]bool{"ok": true})
			return nil
		}
	}
	return &failure{405, "Метод не поддерживается"}
}
