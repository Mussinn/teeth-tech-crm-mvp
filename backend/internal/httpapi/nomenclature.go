package httpapi

import (
	"net/http"
	"teethtech.local/crm/internal/catalog"
	"teethtech.local/crm/internal/identity"
	"teethtech.local/crm/internal/pagination"
)

func registerNomenclature(mux *http.ServeMux, o Options) {
	domainRoute(mux, o, "POST", "/nomenclature-norms", "NomenclatureConsumptionNormController.saveNorm", []string{"ADMIN", "STOREKEEPER"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request catalog.NormRequest
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, err := o.Catalog.SaveNorm(r.Context(), request)
		return v, 201, err
	})
	domainRoute(mux, o, "DELETE", "/nomenclature-norms/{id}", "NomenclatureConsumptionNormController.deleteNorm", []string{"ADMIN", "STOREKEEPER"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		return nil, 204, o.Catalog.DeleteNorm(r.Context(), r.PathValue("id"))
	})
	domainRoute(mux, o, "GET", "/nomenclature", "NomenclatureController.getAll", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		active, err := queryBool(r, "activeOnly")
		if err != nil {
			return nil, 200, err
		}
		v, err := o.Catalog.NomenclaturePage(r.Context(), active, pagination.Parse(r.URL.Query(), 20, "name,asc"))
		return v, 200, err
	})
	domainRoute(mux, o, "GET", "/nomenclature/{id}", "NomenclatureController.getById", nil, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		v, err := o.Catalog.Nomenclature(r.Context(), r.PathValue("id"))
		return v, 200, err
	})
	domainRoute(mux, o, "POST", "/nomenclature", "NomenclatureController.create", []string{"ADMIN"}, func(w http.ResponseWriter, r *http.Request, _ identity.User) (any, int, error) {
		var request catalog.NomenclatureRequest
		if !decodeRequest(w, r, &request) {
			return nil, 0, nil
		}
		v, err := o.Catalog.CreateNomenclature(r.Context(), request)
		return v, 201, err
	})
}
