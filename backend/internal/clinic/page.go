package clinic

import (
	"net/url"
	"teethtech.local/crm/internal/pagination"
)

// Keep existing clinic callers compatible while sharing Spring Slice encoding.
type Page = pagination.Page

func ParsePage(q url.Values, size int, defaultSort string) Page {
	return pagination.Parse(q, size, defaultSort)
}
