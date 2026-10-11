export type GetClinicsParams = {
    page: number;
    size: number;
    sort?: string;
};

export type SearchClinicsParams = {
    name?: string;
    page?: number;
    size?: number;
    sort?: string | string[];
};

export type GetOrdersParams = {
    page: number;
    size: number;
    sort?: string;
};

export type GetClinicRelatedParams = {
    id: string;
    page: number;
    size: number;
    sort?: string;
};
