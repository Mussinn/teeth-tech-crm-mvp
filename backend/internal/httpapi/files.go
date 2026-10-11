package httpapi

import (
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"
	"teethtech.local/crm/internal/files"
	"teethtech.local/crm/internal/identity"
)

func readFile(w http.ResponseWriter, r *http.Request, max int64) (multipart.File, *multipart.FileHeader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, max+1<<20)
	if e := r.ParseMultipartForm(8 << 20); e != nil {
		if r.MultipartForm != nil {
			r.MultipartForm.RemoveAll()
		}
		writeIdentityError(w, validation("Некорректный файл или превышен размер загрузки"), false)
		return nil, nil, false
	}
	f, h, e := r.FormFile("file")
	if e != nil {
		r.MultipartForm.RemoveAll()
		writeIdentityError(w, validation("Прикрепите файл"), false)
		return nil, nil, false
	}
	return f, h, true
}
func registerFiles(mux *http.ServeMux, o Options) {
	const base = "/tasks/{taskId}/files"
	domainRoute(mux, o, "GET", base, "Files.list", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Files.List(r.Context(), r.PathValue("taskId"), r.URL.Query().Get("type"), a)
		return v, 200, e
	})
	domainRoute(mux, o, "POST", base+"/upload", "Files.upload", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		f, h, ok := readFile(w, r, files.MaxFileSize)
		if !ok {
			return nil, 0, nil
		}
		defer f.Close()
		defer r.MultipartForm.RemoveAll()
		kind := r.URL.Query().Get("type")
		if kind == "" {
			kind = "FILE"
		}
		v, e := o.Files.Upload(r.Context(), r.PathValue("taskId"), h.Filename, h.Header.Get("Content-Type"), kind, h.Size, f, a)
		return v, 201, e
	})
	domainRoute(mux, o, "GET", base+"/{attachmentId}/url", "Files.url", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Files.URL(r.Context(), r.PathValue("taskId"), r.PathValue("attachmentId"), a)
		return v, 200, e
	})
	domainRoute(mux, o, "GET", base+"/{attachmentId}/download", "Files.download", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		f, body, e := o.Files.Download(r.Context(), r.PathValue("taskId"), r.PathValue("attachmentId"), a)
		if e != nil {
			return nil, 200, e
		}
		defer body.Close()
		w.Header().Set("Content-Type", f.Content)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": f.Name}))
		w.Header().Set("Content-Length", strconv.FormatInt(f.Size, 10))
		w.WriteHeader(200)
		io.Copy(w, body)
		return nil, 0, nil
	})
	domainRoute(mux, o, "DELETE", base+"/{attachmentId}", "Files.delete", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		return nil, 204, o.Files.Delete(r.Context(), r.PathValue("taskId"), r.PathValue("attachmentId"), a)
	})
	domainRoute(mux, o, "POST", base+"/multipart/init", "Files.init", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		q := r.URL.Query()
		total, e := strconv.Atoi(q.Get("totalParts"))
		if e != nil {
			return nil, 200, validation("Некорректное количество частей")
		}
		v, e := o.Files.Init(r.Context(), r.PathValue("taskId"), q.Get("fileName"), q.Get("contentType"), total, a)
		return v, 200, e
	})
	domainRoute(mux, o, "POST", base+"/multipart/{fileId}/part", "Files.part", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		part, e := strconv.Atoi(r.URL.Query().Get("partNumber"))
		if e != nil {
			return nil, 200, validation("Некорректная часть")
		}
		f, h, ok := readFile(w, r, 64<<20)
		if !ok {
			return nil, 0, nil
		}
		defer f.Close()
		defer r.MultipartForm.RemoveAll()
		return nil, 204, o.Files.Part(r.Context(), r.PathValue("taskId"), r.PathValue("fileId"), part, h.Size, f, a)
	})
	domainRoute(mux, o, "GET", base+"/multipart/{fileId}/progress", "Files.progress", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Files.Progress(r.Context(), r.PathValue("taskId"), r.PathValue("fileId"), a)
		return v, 200, e
	})
	domainRoute(mux, o, "POST", base+"/multipart/{fileId}/complete", "Files.complete", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		v, e := o.Files.Complete(r.Context(), r.PathValue("taskId"), r.PathValue("fileId"), a)
		return v, 200, e
	})
	domainRoute(mux, o, "DELETE", base+"/multipart/{fileId}/abort", "Files.abort", nil, func(w http.ResponseWriter, r *http.Request, a identity.User) (any, int, error) {
		return nil, 204, o.Files.Abort(r.Context(), r.PathValue("taskId"), r.PathValue("fileId"), a)
	})
}
