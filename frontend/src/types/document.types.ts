export type CompletedWorkActRequest = {
    startDate: string;
    endDate: string;
    clinicId?: string;
};

export type CompletedWorkActCandidate = {
    orderId: string;
    orderNumber: string;
    clinicId: string;
    clinicName: string;
    patientName: string;
    doctorName: string;
    completedAt: string;
    taskCount: number;
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    actStatus: string;
    actNumber?: string | null;
};

export type CompletedWorkActPreviewRequest = {
    orderIds: string[];
};

export type CompletedWorkActLine = {
    taskId: string;
    workType: string;
    quantity: number;
    pricePerUnit: number;
    discountPercent: number;
    discountAmount: number;
    totalAmount: number;
};

export type CompletedWorkActOrder = {
    orderId: string;
    orderNumber: string;
    completedAt: string;
    patientName: string;
    doctorName: string;
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    lines: CompletedWorkActLine[];
};

export type CompletedWorkActClinic = {
    clinicId: string;
    clinicName: string;
    bin?: string | null;
    address?: string | null;
    phone?: string | null;
    orderCount: number;
    taskCount: number;
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    orders: CompletedWorkActOrder[];
};

export type CompletedWorkAct = {
    documentNumber: string;
    title: string;
    generatedAt: string;
    startDate: string;
    endDate: string;
    clinicCount: number;
    orderCount: number;
    taskCount: number;
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    clinics: CompletedWorkActClinic[];
};
