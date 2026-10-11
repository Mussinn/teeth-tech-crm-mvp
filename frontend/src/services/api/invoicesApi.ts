import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    BillingSummary,
    CreateInvoiceRequest,
    GetInvoicesRequest,
    Invoice,
    PageRequest,
    PageResponse,
    Payment,
    RegisterPaymentRequest,
    ReversePaymentRequest,
} from '@/src/types/invoice.types';

const DEFAULT_PAGE_SIZE = 30;

export const invoicesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getPendingInvoicing: builder.query<PageResponse<BillingSummary>, PageRequest>({
            query: ({ page = 0, size = DEFAULT_PAGE_SIZE }) => ({
                url: '/finance/invoices/orders/pending-invoicing',
                method: 'GET',
                params: { page, size },
            }),
            providesTags: (result) => [
                'PendingInvoicing',
                ...(result?.content.map(({ orderId }) => ({
                    type: 'BillingSummary' as const,
                    id: orderId,
                })) ?? []),
            ],
        }),
        getBillingSummary: builder.query<BillingSummary, string>({
            query: (orderId) => ({
                url: `/finance/invoices/orders/${orderId}/billing-summary`,
                method: 'GET',
            }),
            providesTags: (_result, _error, orderId) => [
                { type: 'BillingSummary', id: orderId },
            ],
        }),
        getInvoices: builder.query<PageResponse<Invoice>, GetInvoicesRequest>({
            query: ({ page = 0, size = DEFAULT_PAGE_SIZE, orderId, clinicId }) => ({
                url: '/finance/invoices',
                method: 'GET',
                params: {
                    page,
                    size,
                    ...(orderId ? { orderId } : {}),
                    ...(clinicId ? { clinicId } : {}),
                },
            }),
            providesTags: (result) => [
                'Invoices',
                ...(result?.content.map(({ id }) => ({
                    type: 'Invoices' as const,
                    id,
                })) ?? []),
            ],
        }),
        createInvoice: builder.mutation<Invoice, CreateInvoiceRequest>({
            query: (body) => ({
                url: '/finance/invoices',
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { orderId }) => [
                'Invoices',
                'PendingInvoicing',
                { type: 'BillingSummary', id: orderId },
            ],
        }),
        issueInvoice: builder.mutation<Invoice, Invoice>({
            query: ({ id }) => ({
                url: `/finance/invoices/${id}/issue`,
                method: 'PATCH',
            }),
            invalidatesTags: (_result, _error, invoice) => [
                'Invoices',
                'PendingInvoicing',
                { type: 'Invoices', id: invoice.id },
                ...(invoice.orderId
                    ? [{ type: 'BillingSummary' as const, id: invoice.orderId }]
                    : []),
            ],
        }),
        getInvoicePayments: builder.query<Payment[], string>({
            query: (invoiceId) => ({
                url: `/finance/invoices/${invoiceId}/payments`,
                method: 'GET',
            }),
            providesTags: (_result, _error, invoiceId) => [
                { type: 'InvoicePayments', id: invoiceId },
            ],
        }),
        registerPayment: builder.mutation<Payment, RegisterPaymentRequest>({
            query: ({ invoiceId, body }) => ({
                url: `/finance/invoices/${invoiceId}/payments`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { invoiceId }) => [
                'Invoices',
                'PendingInvoicing',
                { type: 'Invoices', id: invoiceId },
                { type: 'InvoicePayments', id: invoiceId },
            ],
        }),
        reversePayment: builder.mutation<Payment, ReversePaymentRequest>({
            query: ({ paymentId, reason }) => ({
                url: `/finance/invoices/payments/${paymentId}/reverse`,
                method: 'POST',
                body: { reason },
            }),
            invalidatesTags: (_result, _error, { invoiceId, orderId }) => [
                'Invoices',
                'PendingInvoicing',
                { type: 'Invoices', id: invoiceId },
                { type: 'InvoicePayments', id: invoiceId },
                ...(orderId
                    ? [{ type: 'BillingSummary' as const, id: orderId }]
                    : []),
            ],
        }),
    }),
});

export const {
    useGetPendingInvoicingQuery,
    useLazyGetBillingSummaryQuery,
    useGetInvoicesQuery,
    useCreateInvoiceMutation,
    useIssueInvoiceMutation,
    useGetInvoicePaymentsQuery,
    useRegisterPaymentMutation,
    useReversePaymentMutation,
} = invoicesApi;
