export type PatientStatus = 'ACTIVE' | 'ARCHIVED';

export interface PatientFile {
    id: string;
    name: string;
    type: 'FILE' | 'IMAGE' | 'VIDEO';
    url: string;
    createdAt: string;
}

export interface PatientOrder {
    id: string;
    orderNumber: string;
    workType: string;
    clinicName: string;
    doctorName: string;
    status: string;
    createdAt: string;
    deadline: string;
}

export interface MedicalNote {
    id: string;
    title: string;
    description: string;
    createdAt: string;
}

export interface Patient {
    id: string;
    fullName: string;
    phone?: string;
    birthDate?: string;
    clinicName: string;
    doctorName: string;
    status: PatientStatus;
    notes: MedicalNote[];
    orders: PatientOrder[];
    files: PatientFile[];
}

export interface PatientSearchOption {
    id: string;
    label: string;
    code?: string | null;
    description?: string | null;
}

export interface PatientSearchResponse {
    content: PatientSearchOption[];
    number: number;
    size: number;
    numberOfElements: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface PatientTreatmentHistoryItem {
    taskId: string;
    orderId: string;
    orderNumber: string;
    orderedAt: string;
    deadline: string | null;
    completedAt: string | null;
    orderActive: boolean;
    doctorName: string;
    workDirectionId: string;
    workDirectionName: string;
    workDirectionCode: string;
    workTypeId: string;
    workTypeName: string;
    workTypeCode: string;
    materialIds: string[];
    materialNames: string[];
    toothNumbers: number[];
    quantity: number;
    statusId: string;
    statusName: string;
    statusCode: string;
    technicianName: string;
    comment: string | null;
}

export interface PatientHistoryResponse {
    patientId: string;
    patientFullName: string;
    clinicId: string;
    clinicName: string;
    totalTreatments: number;
    totalOrders: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    treatments: PatientTreatmentHistoryItem[];
}

export type SearchPatientsArgs = {
    clinicId: string;
    query: string;
    limit?: number;
};

export type GetPatientHistoryArgs = {
    patientId: string;
    page: number;
    size?: number;
};
