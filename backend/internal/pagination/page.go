package pagination

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
	"teethtech.local/crm/internal/dbx"
)

type Page struct {
	Number, Size int
	Sort         []string
}

func Parse(q url.Values, size int, defaultSort string) Page {
	p := Page{Size: size}
	if n, err := strconv.ParseInt(q.Get("page"), 10, 32); err == nil && n >= 0 {
		p.Number = int(n)
	}
	if n, err := strconv.ParseInt(q.Get("size"), 10, 32); err == nil && n > 0 {
		// application.yaml sets spring.data.web.pageable.max-page-size=100.
		p.Size = min(int(n), 100)
	}
	p.Sort = q["sort"]
	if len(p.Sort) == 0 && defaultSort != "" {
		p.Sort = []string{defaultSort}
	}
	return p
}
func (p Page) Order(columns map[string]string, fallback string) (string, error) {
	parts := []string{}
	for _, value := range p.Sort {
		fields := strings.Split(value, ",")
		direction := "ASC"
		if last := strings.ToUpper(fields[len(fields)-1]); last == "ASC" || last == "DESC" {
			direction = last
			fields = fields[:len(fields)-1]
		}
		for _, field := range fields {
			if field == "" {
				continue
			}
			column, ok := columns[field]
			if !ok {
				return "", dbx.Validation("Неподдерживаемое поле сортировки: " + field)
			}
			parts = append(parts, column+" "+direction)
		}
	}
	parts = append(parts, fallback)
	return " ORDER BY " + strings.Join(parts, ","), nil
}
func (p Page) Offset() int64 { return int64(p.Number) * int64(p.Size) }
func (p Page) Slice(items []json.RawMessage) any {
	next := len(items) > p.Size
	if next {
		items = items[:p.Size]
	}
	sorted := false
	for _, v := range p.Sort {
		if v != "" {
			sorted = true
		}
	}
	sort := map[string]bool{"sorted": sorted, "unsorted": !sorted, "empty": !sorted}
	return map[string]any{"content": items, "pageable": map[string]any{"pageNumber": p.Number, "pageSize": p.Size, "sort": sort, "offset": p.Offset(), "paged": true, "unpaged": false}, "last": !next, "size": p.Size, "number": p.Number, "sort": sort, "first": p.Number == 0, "numberOfElements": len(items), "empty": len(items) == 0}
}
