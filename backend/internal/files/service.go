// Package files provides task attachments and resumable S3 uploads.
package files

import (
	"context"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"io"
	"path"
	"strings"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/orders"
	"unicode/utf8"
)

const MaxFileSize int64 = 1 << 30
const fileJSON = `jsonb_build_object('id',id,'fileName',file_name,'storagePath',storage_path,'contentType',content_type,'fileSize',file_size,'attachmentType',attachment_type)`

type Service struct {
	pool   *pgxpool.Pool
	client *minio.Client
	core   minio.Core
	bucket string
}

func New(pool *pgxpool.Pool, endpoint, key, secret, bucket string) (*Service, error) {
	secure := strings.HasPrefix(endpoint, "https://")
	endpoint = strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	client, e := minio.New(endpoint, &minio.Options{Creds: credentials.NewStaticV4(key, secret, ""), Secure: secure})
	if e != nil {
		return nil, e
	}
	return &Service{pool: pool, client: client, core: minio.Core{Client: client}, bucket: bucket}, nil
}
func (s *Service) Initialize(ctx context.Context) error {
	exists, e := s.client.BucketExists(ctx, s.bucket)
	if e != nil {
		return e
	}
	if exists {
		return nil
	}
	e = s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
	if minio.ToErrorResponse(e).Code == "BucketAlreadyOwnedByYou" {
		return nil
	}
	return e
}
func (s *Service) Ready(ctx context.Context) error {
	exists, e := s.client.BucketExists(ctx, s.bucket)
	if e != nil {
		return e
	}
	if !exists {
		return fmt.Errorf("attachment bucket missing")
	}
	return nil
}
func (s *Service) begin(ctx context.Context, task string, a identity.User) (pgx.Tx, error) {
	tx, e := s.pool.Begin(ctx)
	if e != nil {
		return nil, e
	}
	if e = orders.RequireTaskAccess(ctx, tx, task, a); e != nil {
		tx.Rollback(ctx)
		return nil, e
	}
	// Keep assignment and deletion stable through the attachment operation.
	if _, e = tx.Exec(ctx, `SELECT t.id FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL FOR SHARE OF o,t`, task); e != nil {
		tx.Rollback(ctx)
		return nil, e
	}
	var active bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM t_order_tasks t JOIN t_orders o ON o.id=t.order_id WHERE t.id=$1 AND t.deleted_at IS NULL AND o.deleted_at IS NULL)`, task).Scan(&active); e != nil {
		tx.Rollback(ctx)
		return nil, e
	}
	if !active {
		tx.Rollback(ctx)
		return nil, dbx.Missing("Задача не найдена")
	}
	if e = orders.RequireTaskAccess(ctx, tx, task, a); e != nil {
		tx.Rollback(ctx)
		return nil, e
	}
	return tx, nil
}
func (s *Service) List(ctx context.Context, task, kind string, a identity.User) (any, error) {
	if kind != "" && kind != "FILE" && kind != "SCREEN" {
		return nil, dbx.Validation("Некорректный тип вложения")
	}
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	v, e := dbx.List(ctx, tx, `SELECT `+fileJSON+` FROM attachments WHERE task_id=$1 AND deleted_at IS NULL AND is_active AND ($2='' OR attachment_type=$2) ORDER BY created_at,id`, task, kind)
	return v, e
}
func validate(name, content string) error {
	if strings.TrimSpace(name) == "" || utf8.RuneCountInString(name) > 255 || strings.ContainsAny(name, "\r\n\x00") || len(content) > 100 || strings.ContainsAny(content, "\r\n\x00") {
		return dbx.Validation("Некорректное имя или тип файла")
	}
	return nil
}
func (s *Service) Upload(ctx context.Context, task, name, content, kind string, size int64, body io.Reader, a identity.User) (any, error) {
	name = path.Base(strings.ReplaceAll(name, "\\", "/"))
	if content == "" {
		content = "application/octet-stream"
	}
	if e := validate(name, content); e != nil {
		return nil, e
	}
	if kind != "FILE" && kind != "SCREEN" || size < 0 || size > MaxFileSize {
		return nil, dbx.Validation("Тип FILE/SCREEN, максимальный размер файла 1 ГБ")
	}
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	object := "tasks/" + task + "/" + uuid.NewString() + "/" + name
	if _, e = s.client.PutObject(ctx, s.bucket, object, body, size, minio.PutObjectOptions{ContentType: content}); e != nil {
		return nil, e
	}
	v, e := insert(ctx, tx, task, name, content, kind, object, size, a.ID)
	if e == nil {
		e = tx.Commit(ctx)
	}
	if e != nil {
		cleanup, cancel := context.WithCancel(context.WithoutCancel(ctx))
		defer cancel()
		s.client.RemoveObject(cleanup, s.bucket, object, minio.RemoveObjectOptions{})
	}
	return v, e
}
func insert(ctx context.Context, tx pgx.Tx, task, name, content, kind, object string, size int64, actor string) (any, error) {
	v, e := dbx.One(ctx, tx, `INSERT INTO attachments(task_id,file_name,storage_path,content_type,file_size,attachment_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING `+fileJSON, task, name, object, content, size, kind)
	if e != nil {
		return nil, e
	}
	_, e = tx.Exec(ctx, `INSERT INTO t_order_task_history(task_id,field_name,new_value,changed_by) VALUES($1,'FILE_ADDED',$2,$3)`, task, name, actor)
	return v, e
}

type Attachment struct {
	Name, Content, Object string
	Size                  int64
}

func (s *Service) attachment(ctx context.Context, tx pgx.Tx, task, id string) (Attachment, error) {
	var f Attachment
	if _, e := uuid.Parse(id); e != nil {
		return f, dbx.Validation("Некорректный ID вложения")
	}
	var owner string
	e := tx.QueryRow(ctx, `SELECT task_id::text,file_name,content_type,storage_path,coalesce(file_size,0) FROM attachments WHERE id=$1 AND deleted_at IS NULL AND is_active`, id).Scan(&owner, &f.Name, &f.Content, &f.Object, &f.Size)
	if errors.Is(e, pgx.ErrNoRows) {
		return f, dbx.Missing("Вложение не найдено")
	}
	if e != nil {
		return f, e
	}
	if owner != task {
		return f, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Вложение принадлежит другой задаче"}
	}
	return f, nil
}
func (s *Service) URL(ctx context.Context, task, id string, a identity.User) (any, error) {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	if _, e = s.attachment(ctx, tx, task, id); e != nil {
		return nil, e
	}
	return map[string]any{"url": "/api/backend/tasks/" + task + "/files/" + id + "/download", "expiresInSeconds": 0}, nil
}
func (s *Service) Download(ctx context.Context, task, id string, a identity.User) (Attachment, io.ReadCloser, error) {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return Attachment{}, nil, e
	}
	defer tx.Rollback(ctx)
	f, e := s.attachment(ctx, tx, task, id)
	if e != nil {
		return f, nil, e
	}
	obj, e := s.client.GetObject(ctx, s.bucket, f.Object, minio.GetObjectOptions{})
	if e != nil {
		return f, nil, e
	}
	if _, e = obj.Stat(); e != nil {
		obj.Close()
		return f, nil, e
	}
	return f, obj, nil
}
func (s *Service) Delete(ctx context.Context, task, id string, a identity.User) error {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	f, e := s.attachment(ctx, tx, task, id)
	if e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `UPDATE attachments SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1`, id); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `INSERT INTO t_order_task_history(task_id,field_name,old_value,changed_by) VALUES($1,'FILE_REMOVED',$2,$3)`, task, f.Name, a.ID); e != nil {
		return e
	}
	// Keep bytes for recovery; the application's attachment guard hides deleted files.
	return tx.Commit(ctx)
}
