//go:build mvp

package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"image"
	"image/png"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"teethtech.local/crm/internal/saas"
	"testing"
)

func exercisePlatform(t *testing.T, pool *pgxpool.Pool, s *saas.Server, ownerCookie *http.Cookie) {
	t.Helper()
	ctx := t.Context()
	_, e := pool.Exec(ctx, `UPDATE saas_labs SET status='READY',trial_ends_at=now()+interval '1 day' WHERE slot=2`)
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Exec(ctx, `UPDATE saas_labs SET status='INVITED',trial_ends_at=NULL WHERE slot=2`)
	for n := 1; n <= 2; n++ {
		slot := n
		listener, e := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", 24000+n))
		if e != nil {
			t.Fatal(e)
		}
		server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, e := r.Cookie("teethTechJwt")
			if r.URL.Path != "/api/backend/auth/current" || e != nil || c.Value != fmt.Sprintf("lab%d-valid-token", slot) {
				w.WriteHeader(401)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"id": fmt.Sprintf("user-%d", slot), "roles": []string{"ROLE_ADMIN"}})
		}))
		server.Listener = listener
		server.Start()
		defer server.Close()
	}
	request := func(slot int, path, method string, body any, expected int) []byte {
		t.Helper()
		raw, _ := json.Marshal(body)
		host := "localhost:18099"
		if slot > 0 {
			host = fmt.Sprintf("lab%d.localhost:18099", slot)
		}
		r := httptest.NewRequest(method, "http://"+host+path, bytes.NewReader(raw))
		r.Header.Set("Origin", "http://"+host)
		if slot == 0 {
			r.AddCookie(ownerCookie)
		} else {
			r.AddCookie(&http.Cookie{Name: "teethTechJwt", Value: fmt.Sprintf("lab%d-valid-token", slot)})
		}
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		if w.Code != expected {
			t.Fatalf("%s %s: %d expected %d: %s", method, path, w.Code, expected, w.Body.String())
		}
		return w.Body.Bytes()
	}
	decodeID := func(raw []byte) string { var v map[string]any; json.Unmarshal(raw, &v); return fmt.Sprint(v["id"]) }
	ticket := decodeID(request(1, "/api/platform/tickets", "POST", map[string]string{"title": "Помощь", "body": "Не могу завершить этап", "page": "/orders"}, 201))
	request(2, "/api/platform/tickets/"+ticket, "GET", nil, 404)
	request(2, "/api/platform/tickets/"+ticket+"/messages", "POST", map[string]string{"body": "Чужой ответ"}, 404)
	ownerDetail := request(0, "/api/owner/support/"+ticket, "GET", nil, 200)
	if !bytes.Contains(ownerDetail, []byte("Не могу завершить этап")) {
		t.Fatal("owner cannot see request")
	}
	request(0, "/api/owner/support/"+ticket+"/messages", "POST", map[string]string{"body": "Проверьте входной контроль", "status": "RESOLVED"}, 201)
	request(1, "/api/platform/tickets/"+ticket+"/messages", "POST", map[string]string{"body": "Ещё вопрос"}, 201)
	if !bytes.Contains(request(1, "/api/platform/tickets/"+ticket, "GET", nil, 200), []byte(`"status":"OPEN"`)) {
		t.Fatal("follow-up did not reopen ticket")
	}
	var imageData bytes.Buffer
	png.Encode(&imageData, image.NewRGBA(image.Rect(0, 0, 2, 2)))
	var upload bytes.Buffer
	writer := multipart.NewWriter(&upload)
	f, _ := writer.CreateFormFile("file", "screenshot.png")
	f.Write(imageData.Bytes())
	writer.Close()
	r := httptest.NewRequest("POST", "http://lab1.localhost:18099/api/platform/tickets/"+ticket+"/attachments", &upload)
	r.Header.Set("Origin", "http://lab1.localhost:18099")
	r.Header.Set("Content-Type", writer.FormDataContentType())
	r.AddCookie(&http.Cookie{Name: "teethTechJwt", Value: "lab1-valid-token"})
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 201 {
		t.Fatal("screenshot rejected", w.Body.String())
	}
	var fileID int
	pool.QueryRow(ctx, `SELECT id FROM saas_support_files WHERE ticket_id=$1`, ticket).Scan(&fileID)
	request(2, fmt.Sprintf("/api/platform/tickets/%s/attachments/%d", ticket, fileID), "GET", nil, 404)
	request(0, fmt.Sprintf("/api/owner/support/%s/attachments/%d", ticket, fileID), "GET", nil, 200)
	request(1, "/api/platform/community", "GET", nil, 403)
	for slot := 1; slot <= 2; slot++ {
		request(slot, "/api/platform/community/profile", "POST", map[string]any{"name": fmt.Sprintf("Публичная лаборатория %d", slot), "city": "Актобе", "enabled": true}, 200)
	}
	post := decodeID(request(1, "/api/platform/community", "POST", map[string]string{"title": "Вопрос", "body": "Как вы распределяете работу?", "category": "QUESTIONS"}, 201))
	feed := request(2, "/api/platform/community", "GET", nil, 200)
	if !bytes.Contains(feed, []byte("Как вы распределяете")) || bytes.Contains(feed, []byte("user-1")) {
		t.Fatal("community disclosure contract")
	}
	request(2, "/api/platform/community/"+post+"/hide", "POST", map[string]any{}, 403)
	request(2, "/api/platform/community/"+post+"/comments", "POST", map[string]string{"body": "По загрузке"}, 201)
	request(2, "/api/platform/community/"+post+"/report", "POST", map[string]string{"reason": "Проверка модерации"}, 201)
	ownerFeed := request(0, "/api/owner/community", "GET", nil, 200)
	if !bytes.Contains(ownerFeed, []byte("Проверка модерации")) {
		t.Fatal("report not available to moderator")
	}
	request(0, "/api/owner/community/"+post+"/hide", "POST", map[string]any{}, 200)
	if bytes.Contains(request(2, "/api/platform/community", "GET", nil, 200), []byte("Как вы распределяете")) {
		t.Fatal("hidden post remains public")
	}
	request(1, "/api/platform/community/profile", "POST", map[string]any{"name": "Публичная лаборатория 1", "enabled": false}, 200)
	request(1, "/api/platform/community", "GET", nil, 403)
	for _, tc := range []struct {
		cookie, origin string
		code           int
	}{{"lab2-valid-token", "http://lab1.localhost:18099", 401}, {"lab1-valid-token", "http://evil.test", 403}} {
		r := httptest.NewRequest("POST", "http://lab1.localhost:18099/api/platform/tickets", strings.NewReader(`{"title":"Test","body":"Test"}`))
		r.AddCookie(&http.Cookie{Name: "teethTechJwt", Value: tc.cookie})
		r.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		if w.Code != tc.code {
			t.Fatalf("identity/CSRF isolation: %d expected %d", w.Code, tc.code)
		}
	}
	t.Log("Support isolation, owner replies, screenshots, community opt-in, comments, reports, moderation and cookie isolation verified")
}
