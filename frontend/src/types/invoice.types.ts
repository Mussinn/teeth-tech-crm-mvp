export type InvoiceStatus =
    | 'DRAFT'
    | 'ISSUED'
    | 'PARTIALLY_PAID'
    | 'PAID'
    | 'CANCELLED'
    | (string & {});

export interface Invoice {
    id: string;
    number: string;
    clinicId: string;
    orderId: string | null;
    status: InvoiceStatus;
    amount: number;
    paidAmount: number;
    issuedAt: string | null;
    dueAt: string | null;
    comment: string | null;
}

export interface BillingSummary {
    orderId: string;
    orderNumber: string;
    clinicId: string;
    clinicName: string;
    patientName: string;
    orderTotalAmount: number;
    invoicedAmount: number;
    paidAmount: number;
    remainingToInvoice: number;
    outstandingAmount: number;
    invoices: Invoice[];
}

export interface PageResponse<T> {
    content: T[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
}

export interface PageRequest {
    page?: number;
    size?: number;
}

export interface GetInvoicesRequest extends PageRequest {
    orderId?: string;
    clinicId?: string;
}

export interface CreateInvoiceRequest {
    clinicId: string;
    orderId: string;
    amount: number;
    dueAt: string | null;
    comment: string | null;
}

export interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    externalReference: string | null;
    paidAt: string;
    reversedAt: string | null;
    reversalReason: string | null;
}

export interface CreatePaymentRequest {
    amount: number;
    paymentMethod: string;
    externalReference?: string | null;
    paidAt?: string | null;
}

export interface RegisterPaymentRequest {
    invoiceId: string;
    body: CreatePaymentRequest;
}

export interface ReversePaymentRequest {
    paymentId: string;
    invoiceId: string;
    orderId?: string | null;
    reason: string;
}
