export type Sort = {
    sorted: boolean;
    empty: boolean;
    unsorted: boolean;
}

export type Pageable = {
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    sort: Sort;
    offset: number;
    unpaged: boolean;
}

export type Clinic = {
    id: string;
    name: string;
    address: string;
    phone: string;
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
}

export type ClinicGetApiResponse = {
    pageable: Pageable;
    first: boolean;
    sort: Sort;
    size: number;
    content: Clinic[];
    number: number;
    numberOfElements: number;
    last: boolean;
    empty: boolean;
}

export type ClinicSearchItem = {
    id: string;
    name: string;
    address: string;
    phone: string;
}

export type ClinicSearchResponse = {
    pageable: Pageable;
    first: boolean;
    sort: Sort;
    size: number;
    content: ClinicSearchItem[];
    number: number;
    numberOfElements: number;
    last: boolean;
    empty: boolean;
}

export type ClinicRelatedPageResponse<T> = {
    pageable: Pageable;
    first: boolean;
    sort: Sort;
    size: number;
    content: T[];
    number: number;
    numberOfElements: number;
    last: boolean;
    empty: boolean;
    totalElements?: number;
    totalPages?: number;
}

export type ClinicDoctor = {
    fullName: string;
}

export type ClinicPatient = {
    id?: string;
    fullName: string;
}

export type ClinicOrder = {
    id: string;
    patientName: string;
    summaryWork: string;
    isActive: boolean;
    totalAmount: number;
    paidAmount: number;
}

export type CreateClinicDto = {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    bin: string;
}

export type ClinicDetailedInfo = {
    id: string,
    totalOrdersCount: number,
    totalAmount: number,
    totalPaid: number,
    totalDebt: number,
    name: string,
    phone: string,
    address: string,
    contactPerson: string,
    email: string,
    priceType: string,
    discountPercent: number,
    bin: string;
    doctors?: ClinicDoctor[],
    orders?: ClinicOrder[],
}

export type UpdateClinicDto =
    Partial<ClinicDetailedInfo>;
