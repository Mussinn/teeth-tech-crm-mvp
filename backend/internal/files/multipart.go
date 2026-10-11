package files

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/minio/minio-go/v7"
	"io"
	"path"
	"strings"
	"teethtech.local/crm/internal/dbx"
	"teethtech.local/crm/internal/identity"
)

type upload struct {
	ID, Task, User, Name, Content, Object, UploadID string
	Total                                           int
}

func (s *Service) Init(ctx context.Context, task, name, content string, total int, a identity.User) (any, error) {
	name = path.Base(strings.ReplaceAll(name, "\\", "/"))
	if e := validate(name, content); e != nil {
		return nil, e
	}
	if total < 1 || total > 10000 {
		return nil, dbx.Validation("Некорректное количество частей")
	}
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	id := uuid.NewString()
	object := "tasks/" + task + "/" + id + "/" + name
	remote, e := s.core.NewMultipartUpload(ctx, s.bucket, object, minio.PutObjectOptions{ContentType: content})
	if e != nil {
		return nil, e
	}
	_, e = tx.Exec(ctx, `INSERT INTO mvp_file_uploads(id,task_id,user_id,file_name,content_type,storage_path,upload_id,total_parts) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, id, task, a.ID, name, content, object, remote, total)
	if e == nil {
		e = tx.Commit(ctx)
	}
	if e != nil {
		s.core.AbortMultipartUpload(context.WithoutCancel(ctx), s.bucket, object, remote)
		return nil, e
	}
	return map[string]any{"fileId": id, "uploadId": remote, "filePath": object}, nil
}
func (s *Service) load(ctx context.Context, tx pgx.Tx, task, id string, a identity.User) (upload, error) {
	var u upload
	if _, e := uuid.Parse(id); e != nil {
		return u, dbx.Validation("Некорректный ID загрузки")
	}
	e := tx.QueryRow(ctx, `SELECT id::text,task_id::text,user_id::text,file_name,content_type,storage_path,upload_id,total_parts FROM mvp_file_uploads WHERE id=$1 FOR UPDATE`, id).Scan(&u.ID, &u.Task, &u.User, &u.Name, &u.Content, &u.Object, &u.UploadID, &u.Total)
	if errors.Is(e, pgx.ErrNoRows) {
		return u, dbx.Missing("Загрузка не найдена")
	}
	if e != nil {
		return u, e
	}
	if u.Task != task || u.User != a.ID {
		return u, &identity.Failure{Status: 403, Code: "AUTH_403", Message: "Нет доступа к загрузке"}
	}
	return u, nil
}
func (s *Service) Part(ctx context.Context, task, id string, part int, size int64, body io.Reader, a identity.User) error {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	u, e := s.load(ctx, tx, task, id, a)
	if e != nil {
		return e
	}
	if part < 1 || part > u.Total || size < 0 || size > 64<<20 {
		return dbx.Validation("Некорректная часть файла (максимум 64 МБ)")
	}
	var current int64
	if e = tx.QueryRow(ctx, `SELECT coalesce(sum(file_size),0) FROM mvp_file_parts WHERE upload_id=$1 AND part_number<>$2`, id, part).Scan(&current); e != nil {
		return e
	}
	if current+size > MaxFileSize {
		return dbx.Validation("Максимальный размер файла 1 ГБ")
	}
	info, e := s.core.PutObjectPart(ctx, s.bucket, u.Object, u.UploadID, part, body, size, minio.PutObjectPartOptions{})
	if e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `INSERT INTO mvp_file_parts(upload_id,part_number,etag,file_size) VALUES($1,$2,$3,$4) ON CONFLICT(upload_id,part_number) DO UPDATE SET etag=excluded.etag,file_size=excluded.file_size`, id, part, info.ETag, size); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Service) Progress(ctx context.Context, task, id string, a identity.User) (any, error) {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	u, e := s.load(ctx, tx, task, id, a)
	if e != nil {
		return nil, e
	}
	var n int
	if e = tx.QueryRow(ctx, `SELECT count(*) FROM mvp_file_parts WHERE upload_id=$1`, id).Scan(&n); e != nil {
		return nil, e
	}
	return map[string]any{"fileId": id, "uploadedParts": n, "totalParts": u.Total, "progressPercent": 100 * n / u.Total}, nil
}
func (s *Service) Complete(ctx context.Context, task, id string, a identity.User) (any, error) {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	u, e := s.load(ctx, tx, task, id, a)
	if e != nil {
		return nil, e
	}
	rows, e := tx.Query(ctx, `SELECT part_number,etag FROM mvp_file_parts WHERE upload_id=$1 ORDER BY part_number`, id)
	if e != nil {
		return nil, e
	}
	parts := []minio.CompletePart{}
	for rows.Next() {
		var p minio.CompletePart
		if e = rows.Scan(&p.PartNumber, &p.ETag); e != nil {
			rows.Close()
			return nil, e
		}
		parts = append(parts, p)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return nil, e
	}
	if len(parts) != u.Total {
		return nil, dbx.Business("Загрузите все части файла")
	}
	// A completed S3 object can survive a database commit failure; allow retry using Stat.
	stat, statErr := s.client.StatObject(ctx, s.bucket, u.Object, minio.StatObjectOptions{})
	if statErr != nil {
		if _, e = s.core.CompleteMultipartUpload(ctx, s.bucket, u.Object, u.UploadID, parts, minio.PutObjectOptions{ContentType: u.Content}); e != nil {
			return nil, e
		}
		stat, e = s.client.StatObject(ctx, s.bucket, u.Object, minio.StatObjectOptions{})
		if e != nil {
			return nil, e
		}
	}
	if stat.Size > MaxFileSize {
		return nil, dbx.Validation("Максимальный размер файла 1 ГБ")
	}
	v, e := insert(ctx, tx, task, u.Name, u.Content, "FILE", u.Object, stat.Size, a.ID)
	if e != nil {
		return nil, e
	}
	if _, e = tx.Exec(ctx, `DELETE FROM mvp_file_uploads WHERE id=$1`, id); e != nil {
		return nil, e
	}
	return v, tx.Commit(ctx)
}
func (s *Service) Abort(ctx context.Context, task, id string, a identity.User) error {
	tx, e := s.begin(ctx, task, a)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	u, e := s.load(ctx, tx, task, id, a)
	if e != nil {
		return e
	}
	if e = s.core.AbortMultipartUpload(ctx, s.bucket, u.Object, u.UploadID); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `DELETE FROM mvp_file_uploads WHERE id=$1`, id); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
