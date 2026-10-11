'use client';

import { type FormEvent, useState } from 'react';

import Modal from '@/src/components/ui/Modal';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import {
    useCreateInvoiceMutation,
    useGetInvoicePaymentsQuery,
    useGetInvoicesQuery,
    useGetPendingInvoicingQuery,
    useIssueInvoiceMutation,
    useLazyGetBillingSummaryQuery,
    useRegisterPaymentMutation,
    useReversePaymentMutation,
} from '@/src/services/api/invoicesApi';
import type {
    BillingSummary,
    Invoice,
    InvoiceStatus,
    Payment,
} from '@/src/types/invoice.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

const PAGE_SIZE = 30;

const invoiceStatusClasses: Record<string, string> = {
    DRAFT: 'border-slate-200 bg-slate-100 text-slate-700',
    ISSUED: 'border-blue-200 bg-blue-50 text-blue-700',
    PARTIALLY_PAID: 'border-amber-200 bg-amber-50 text-amber-700',
    PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CANCELLED: 'border-red-200 bg-red-50 text-red-700',
};

type ApiErrorShape = {
    status?: number | string;
    data?: {
        message?: string;
        error?: string;
    } | string;
    message?: string;
};

function padDatePart(value: number) {
    return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date: Date) {
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function getDefaultDueAt() {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    date.setHours(18, 0, 0, 0);
    return toDatetimeLocalValue(date);
}

function toKazakhstanIso(value: string) {
    if (!value) return null;
    return `${value.length === 16 ? `${value}:00` : value}+05:00`;
}

function parseAmount(value: string) {
    return Number(value.replace(/\s/gu, '').replace(',', '.'));
}

function validateAmount(
    value: string,
    availableAmount: number,
    messages: {required: string; positive: string; maximum: string}
) {
    const amount = parseAmount(value);

    if (!value.trim() || !Number.isFinite(amount)) {
        return messages.required;
    }

    if (amount <= 0) {
        return messages.positive;
    }

    if (amount > availableAmount) {
        return messages.maximum;
    }

    return null;
}

function getApiErrorMessage(
    error: unknown,
    fallback: string,
    statusMessages: Record<'403' | '404' | '500', string>
) {
    if (!error || typeof error !== 'object') return fallback;

    const apiError = error as ApiErrorShape;
    if (typeof apiError.data === 'object' && apiError.data) {
        return apiError.data.message ?? apiError.data.error ?? fallback;
    }

    if (typeof apiError.data === 'string' && apiError.data) {
        return apiError.data;
    }

    if (apiError.status === 403) return statusMessages['403'];
    if (apiError.status === 404) return statusMessages['404'];
    if (apiError.status === 500) return statusMessages['500'];

    return apiError.message ?? fallback;
}

function getInvoiceBalance(invoice: Invoice) {
    return Math.max(0, invoice.amount - invoice.paidAmount);
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
    const t = useTranslations('accounting.invoices.statuses');
    const label = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'].includes(status)
        ? t(status as 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED')
        : status;
    return (
        <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                invoiceStatusClasses[status] ?? 'border-violet-200 bg-violet-50 text-violet-700'
            }`}
        >
            {label}
        </span>
    );
}

function Pagination({
    page,
    totalPages,
    onChange,
}: {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
}) {
    const t = useTranslations('accounting.invoices');
    const commonT = useTranslations('common.pagination');
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
            <button
                type="button"
                onClick={() => onChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {commonT('previous')}
            </button>
            <span className="text-sm text-slate-500">
                {t('pagination', {page: page + 1, total: totalPages})}
            </span>
            <button
                type="button"
                onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {commonT('next')}
            </button>
        </div>
    );
}

function Notice({
    tone,
    children,
}: {
    tone: 'success' | 'error' | 'info';
    children: React.ReactNode;
}) {
    const styles = {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        error: 'border-red-200 bg-red-50 text-red-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
    };

    return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles[tone]}`}>
            {children}
        </div>
    );
}

export default function InvoicesPage() {
    const t = useTranslations('accounting.invoices');
    const commonT = useTranslations('common.actions');
    const {currency: formatMoney, date, dateTime} = useAppFormatters();
    const formatDate = (value?: string | null, includeTime = false) => {
        if (!value) return t('unspecified');
        return includeTime
            ? dateTime(value, {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})
            : date(value, {day: '2-digit', month: '2-digit', year: 'numeric'});
    };
    const { notifyError } = useNotifications();
    const [pendingPage, setPendingPage] = useState(0);
    const [invoicesPage, setInvoicesPage] = useState(0);

    const [selectedSummary, setSelectedSummary] = useState<BillingSummary | null>(null);
    const [invoiceAmount, setInvoiceAmount] = useState('');
    const [invoiceDueAt, setInvoiceDueAt] = useState(getDefaultDueAt);
    const [invoiceComment, setInvoiceComment] = useState('');
    const [createdDraft, setCreatedDraft] = useState<Invoice | null>(null);

    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoiceContext, setInvoiceContext] = useState<BillingSummary | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
    const [paymentPaidAt, setPaymentPaidAt] = useState(() => toDatetimeLocalValue(new Date()));
    const [paymentReference, setPaymentReference] = useState('');
    const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null);
    const [reversalReason, setReversalReason] = useState('');

    const pendingQuery = useGetPendingInvoicingQuery({
        page: pendingPage,
        size: PAGE_SIZE,
    });
    const invoicesQuery = useGetInvoicesQuery({
        page: invoicesPage,
        size: PAGE_SIZE,
    });
    const [getBillingSummary, billingSummaryState] = useLazyGetBillingSummaryQuery();
    const [createInvoice, createInvoiceState] = useCreateInvoiceMutation();
    const [issueInvoice, issueInvoiceState] = useIssueInvoiceMutation();
    const [registerPayment, registerPaymentState] = useRegisterPaymentMutation();
    const [reversePayment, reversePaymentState] = useReversePaymentMutation();
    const paymentsQuery = useGetInvoicePaymentsQuery(selectedInvoice?.id ?? '', {
        skip: !selectedInvoice,
    });

    const pendingSummaries = pendingQuery.data?.content ?? [];
    const invoices = invoicesQuery.data?.content ?? [];
    const payments = paymentsQuery.data ?? [];
    const selectedInvoiceBalance = selectedInvoice ? getInvoiceBalance(selectedInvoice) : 0;
    const canRegisterPayment = selectedInvoice
        ? ['ISSUED', 'PARTIALLY_PAID'].includes(selectedInvoice.status) && selectedInvoiceBalance > 0
        : false;

    const pageTotals = {
        remainingToInvoice: pendingSummaries.reduce(
            (total, summary) => total + summary.remainingToInvoice,
            0
        ),
        outstanding: pendingSummaries.reduce(
            (total, summary) => total + summary.outstandingAmount,
            0
        ),
    };

    const refreshLists = async () => {
        await Promise.allSettled([
            pendingQuery.refetch(),
            invoicesQuery.refetch(),
        ]);
    };

    const refreshSummary = async (orderId: string) => {
        const latest = await getBillingSummary(orderId, false).unwrap();
        setSelectedSummary(latest);
        return latest;
    };

    const refreshSelectedInvoice = async (invoice: Invoice) => {
        await refreshLists();

        if (!invoice.orderId) return;

        try {
            const latest = await getBillingSummary(invoice.orderId, false).unwrap();
            setInvoiceContext(latest);
            const updatedInvoice = latest.invoices.find((item) => item.id === invoice.id);
            if (updatedInvoice) {
                setSelectedInvoice(updatedInvoice);
                setPaymentAmount(String(getInvoiceBalance(updatedInvoice)));
            }
        } catch {
            // The completed mutation is kept visible even if the follow-up refresh fails.
        }
    };

    const openSummary = async (orderId: string) => {
        setCreatedDraft(null);

        try {
            const summary = await getBillingSummary(orderId, false).unwrap();
            setSelectedSummary(summary);
            setInvoiceAmount(String(summary.remainingToInvoice));
            setInvoiceDueAt(getDefaultDueAt());
            setInvoiceComment('');
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const closeSummary = () => {
        setSelectedSummary(null);
        setCreatedDraft(null);
    };

    const openInvoice = async (invoice: Invoice, context?: BillingSummary) => {
        setSelectedSummary(null);
        setSelectedInvoice(invoice);
        setInvoiceContext(context ?? null);
        setPaymentAmount(String(getInvoiceBalance(invoice)));
        setPaymentMethod('BANK_TRANSFER');
        setPaymentPaidAt(toDatetimeLocalValue(new Date()));
        setPaymentReference('');
        setReversingPaymentId(null);
        setReversalReason('');

        if (!context && invoice.orderId) {
            try {
                const latest = await getBillingSummary(invoice.orderId, false).unwrap();
                setInvoiceContext(latest);
                const updatedInvoice = latest.invoices.find((item) => item.id === invoice.id) ?? invoice;
                setSelectedInvoice(updatedInvoice);
                setPaymentAmount(String(getInvoiceBalance(updatedInvoice)));
            } catch {
                // Invoice details remain usable without the optional order context.
            }
        }
    };

    const closeInvoice = () => {
        setSelectedInvoice(null);
        setInvoiceContext(null);
        setReversingPaymentId(null);
    };

    const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedSummary) return;

        const validationError = validateAmount(
            invoiceAmount,
            selectedSummary.remainingToInvoice,
            {
                required: t('validation.amount', {subject: t('validation.invoice')}),
                positive: t('validation.positive'),
                maximum: t('validation.maximum', {amount: formatMoney(selectedSummary.remainingToInvoice)}),
            }
        );
        if (validationError) {
            notifyError(validationError);
            return;
        }

        try {
            const draft = await createInvoice({
                clinicId: selectedSummary.clinicId,
                orderId: selectedSummary.orderId,
                amount: parseAmount(invoiceAmount),
                dueAt: toKazakhstanIso(invoiceDueAt),
                comment: invoiceComment.trim() || null,
            }).unwrap();

            setCreatedDraft(draft);
            await Promise.allSettled([
                refreshSummary(selectedSummary.orderId),
                refreshLists(),
            ]);
        } catch {
            try {
                const latest = await refreshSummary(selectedSummary.orderId);
                setInvoiceAmount(String(latest.remainingToInvoice));
            } catch {
                // The backend error remains the primary message.
            }
        }
    };

    const handleIssueInvoice = async (invoice: Invoice, source: 'summary' | 'detail') => {
        try {
            const issued = await issueInvoice(invoice).unwrap();

            if (source === 'summary') {
                setCreatedDraft(issued);
                if (issued.orderId) await refreshSummary(issued.orderId);
                await refreshLists();
            } else {
                setSelectedInvoice(issued);
                setPaymentAmount(String(getInvoiceBalance(issued)));
                await refreshSelectedInvoice(issued);
            }
        } catch {
            if (source === 'summary') {
                if (invoice.orderId) {
                    await Promise.allSettled([refreshSummary(invoice.orderId), refreshLists()]);
                }
            } else {
                await refreshSelectedInvoice(invoice);
            }
        }
    };

    const handleRegisterPayment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedInvoice) return;

        const validationError = validateAmount(
            paymentAmount,
            selectedInvoiceBalance,
            {
                required: t('validation.amount', {subject: t('validation.payment')}),
                positive: t('validation.positive'),
                maximum: t('validation.maximum', {amount: formatMoney(selectedInvoiceBalance)}),
            }
        );
        if (validationError) {
            notifyError(validationError);
            return;
        }

        try {
            await registerPayment({
                invoiceId: selectedInvoice.id,
                body: {
                    amount: parseAmount(paymentAmount),
                    paymentMethod,
                    externalReference: paymentReference.trim() || null,
                    paidAt: toKazakhstanIso(paymentPaidAt),
                },
            }).unwrap();

            await Promise.allSettled([
                paymentsQuery.refetch(),
                refreshSelectedInvoice(selectedInvoice),
            ]);
        } catch {
            await Promise.allSettled([
                paymentsQuery.refetch(),
                refreshSelectedInvoice(selectedInvoice),
            ]);
        }
    };

    const handleReversePayment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedInvoice || !reversingPaymentId) return;

        const reason = reversalReason.trim();
        if (!reason) {
            notifyError(t('validation.reversal'));
            return;
        }

        try {
            await reversePayment({
                paymentId: reversingPaymentId,
                invoiceId: selectedInvoice.id,
                orderId: selectedInvoice.orderId,
                reason,
            }).unwrap();

            setReversingPaymentId(null);
            setReversalReason('');
            await Promise.allSettled([
                paymentsQuery.refetch(),
                refreshSelectedInvoice(selectedInvoice),
            ]);
        } catch {
            await Promise.allSettled([
                paymentsQuery.refetch(),
                refreshSelectedInvoice(selectedInvoice),
            ]);
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-8">
            <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:flex lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                        {t('eyebrow')}
                    </p>
                    <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{t('title')}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('subtitle')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        pendingQuery.refetch();
                        invoicesQuery.refetch();
                    }}
                    disabled={pendingQuery.isFetching || invoicesQuery.isFetching}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto lg:mt-0"
                >
                    {t('refresh')}
                </button>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('metrics.pending')}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                        {pendingQuery.data?.totalElements ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('metrics.pendingNote')}</p>
                </article>
                <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('metrics.remaining')}</p>
                    <p className="mt-2 text-xl font-black text-blue-700">
                        {formatMoney(pageTotals.remainingToInvoice)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('metrics.pageNote')}</p>
                </article>
                <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('metrics.debt')}</p>
                    <p className="mt-2 text-xl font-black text-amber-700">
                        {formatMoney(pageTotals.outstanding)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('metrics.ordersNote')}</p>
                </article>
                <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('metrics.total')}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                        {invoicesQuery.data?.totalElements ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('metrics.statusesNote')}</p>
                </article>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                    <h2 className="font-bold text-slate-900">{t('pending.title')}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('pending.subtitle')}
                    </p>
                </div>

                        {pendingQuery.isLoading ? (
                            <div className="p-10 text-center text-sm text-slate-500">{t('pending.loading')}</div>
                        ) : pendingQuery.isError ? (
                            <div className="p-5">
                                <Notice tone="error">
                                    {getApiErrorMessage(pendingQuery.error, t('pending.error'), {'403': t('errors.forbidden'), '404': t('errors.notFound'), '500': t('errors.unavailable')})}
                                </Notice>
                            </div>
                        ) : pendingSummaries.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="font-bold text-slate-800">{t('pending.empty')}</p>
                                <p className="mt-1 text-sm text-slate-500">{t('pending.emptyHint')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[980px] w-full text-left">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 font-bold">{t('columns.order')}</th>
                                            <th className="px-4 py-3 font-bold">{t('columns.clinicPatient')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.cost')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.invoiced')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.paid')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.remaining')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pendingSummaries.map((summary) => (
                                            <tr key={summary.orderId} className="transition hover:bg-slate-50/80">
                                                <td className="px-4 py-4">
                                                    <span className="font-bold text-slate-900">{summary.orderNumber}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-semibold text-slate-800">{summary.clinicName}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">{summary.patientName}</p>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700">
                                                    {formatMoney(summary.orderTotalAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700">
                                                    {formatMoney(summary.invoicedAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-700">
                                                    {formatMoney(summary.paidAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-blue-700">
                                                    {formatMoney(summary.remainingToInvoice)}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openSummary(summary.orderId)}
                                                        disabled={summary.remainingToInvoice <= 0 || billingSummaryState.isFetching}
                                                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                    >
                                                        {t('pending.create')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <Pagination
                            page={pendingQuery.data?.number ?? pendingPage}
                            totalPages={pendingQuery.data?.totalPages ?? 0}
                            onChange={setPendingPage}
                        />
            </section>

            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                    <h2 className="font-bold text-slate-900">{t('all.title')}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('all.subtitle')}
                    </p>
                </div>

                        {invoicesQuery.isLoading ? (
                            <div className="p-10 text-center text-sm text-slate-500">{t('all.loading')}</div>
                        ) : invoicesQuery.isError ? (
                            <div className="p-5">
                                <Notice tone="error">
                                    {getApiErrorMessage(invoicesQuery.error, t('all.error'), {'403': t('errors.forbidden'), '404': t('errors.notFound'), '500': t('errors.unavailable')})}
                                </Notice>
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="font-bold text-slate-800">{t('all.empty')}</p>
                                <p className="mt-1 text-sm text-slate-500">{t('all.emptyHint')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[900px] w-full text-left">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 font-bold">{t('columns.invoice')}</th>
                                            <th className="px-4 py-3 font-bold">{t('columns.status')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.amount')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.paid')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.remaining')}</th>
                                            <th className="px-4 py-3 font-bold">{t('columns.dueAt')}</th>
                                            <th className="px-4 py-3 text-right font-bold">{t('columns.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                                                <td className="px-4 py-4 font-bold text-slate-900">{invoice.number}</td>
                                                <td className="px-4 py-4"><StatusBadge status={invoice.status} /></td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700">{formatMoney(invoice.amount)}</td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-700">{formatMoney(invoice.paidAmount)}</td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatMoney(getInvoiceBalance(invoice))}</td>
                                                <td className="px-4 py-4 text-sm text-slate-600">{formatDate(invoice.dueAt)}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openInvoice(invoice)}
                                                        className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                                                    >
                                                        {t('all.open')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <Pagination
                            page={invoicesQuery.data?.number ?? invoicesPage}
                            totalPages={invoicesQuery.data?.totalPages ?? 0}
                            onChange={setInvoicesPage}
                        />
            </section>

            {selectedSummary && (
                <Modal contentClassName="max-w-5xl p-0">
                    <div role="dialog" aria-modal="true" aria-labelledby="invoice-create-title">
                        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{t('create.eyebrow')}</p>
                                <h2 id="invoice-create-title" className="mt-1 text-xl font-black text-slate-900">
                                    {selectedSummary.orderNumber}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {selectedSummary.clinicName} · {selectedSummary.patientName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSummary}
                                aria-label={t('create.close')}
                                className="text-3xl leading-none text-slate-400 transition hover:text-slate-700"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-6 p-4 sm:p-6">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                {[
                                    [t('create.orderCost'), selectedSummary.orderTotalAmount],
                                    [t('create.invoiced'), selectedSummary.invoicedAmount],
                                    [t('create.paid'), selectedSummary.paidAmount],
                                    [t('create.remaining'), selectedSummary.remainingToInvoice],
                                    [t('create.debt'), selectedSummary.outstandingAmount],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-medium text-slate-500">{label}</p>
                                        <p className="mt-1 text-sm font-black text-slate-900 sm:text-base">
                                            {formatMoney(Number(value))}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {createdDraft ? (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-black text-slate-900">{createdDraft.number}</p>
                                                <StatusBadge status={createdDraft.status} />
                                            </div>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {t('create.amountCreated', {amount: formatMoney(createdDraft.amount)})}{' '}
                                                {createdDraft.status === 'DRAFT'
                                                    ? t('create.draftHint')
                                                    : t('create.issuedHint', {date: formatDate(createdDraft.issuedAt, true)})}
                                            </p>
                                        </div>
                                        {createdDraft.status === 'DRAFT' && (
                                            <button
                                                type="button"
                                                onClick={() => handleIssueInvoice(createdDraft, 'summary')}
                                                disabled={issueInvoiceState.isLoading}
                                                className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                            >
                                                {issueInvoiceState.isLoading ? t('create.issuing') : t('create.issueClinic')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : selectedSummary.remainingToInvoice > 0 ? (
                                <form onSubmit={handleCreateInvoice} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                                    <h3 className="font-bold text-slate-900">{t('create.parameters')}</h3>
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('create.amount')}</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={invoiceAmount}
                                                onChange={(event) => setInvoiceAmount(event.target.value)}
                                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                            <span className="mt-1 block text-xs text-slate-400">
                                                {t('create.maximum', {amount: formatMoney(selectedSummary.remainingToInvoice)})}
                                            </span>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('create.dueAt')}</span>
                                            <input
                                                type="datetime-local"
                                                value={invoiceDueAt}
                                                onChange={(event) => setInvoiceDueAt(event.target.value)}
                                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                    <label className="mt-4 block">
                                        <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('create.comment')}</span>
                                        <textarea
                                            value={invoiceComment}
                                            onChange={(event) => setInvoiceComment(event.target.value)}
                                            rows={3}
                                            placeholder={t('create.commentPlaceholder', {order: selectedSummary.orderNumber})}
                                            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <div className="mt-5 flex">
                                        <button
                                            type="submit"
                                            disabled={createInvoiceState.isLoading}
                                            className="min-h-11 w-full rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:ml-auto sm:w-auto"
                                        >
                                            {createInvoiceState.isLoading ? t('create.creating') : t('create.createDraft')}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <Notice tone="info">{t('create.fullyInvoiced')}</Notice>
                            )}

                            <div>
                                <h3 className="font-bold text-slate-900">{t('create.orderInvoices')}</h3>
                                {selectedSummary.invoices.length === 0 ? (
                                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                                        {t('create.noInvoices')}
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {selectedSummary.invoices.map((invoice) => (
                                            <div key={invoice.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-slate-900">{invoice.number}</span>
                                                        <StatusBadge status={invoice.status} />
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {t('create.paidAmount', {amount: formatMoney(invoice.amount), paid: formatMoney(invoice.paidAmount)})}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => openInvoice(invoice, selectedSummary)}
                                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
                                                >
                                                    {t('create.openInvoice')}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {selectedInvoice && (
                <Modal contentClassName="max-w-5xl p-0">
                    <div role="dialog" aria-modal="true" aria-labelledby="invoice-details-title">
                        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 id="invoice-details-title" className="text-xl font-black text-slate-900">
                                        {selectedInvoice.number}
                                    </h2>
                                    <StatusBadge status={selectedInvoice.status} />
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                    {invoiceContext
                                        ? `${invoiceContext.clinicName} · ${invoiceContext.orderNumber}`
                                        : t('detail.clinic', {id: selectedInvoice.clinicId})}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeInvoice}
                                aria-label={t('detail.close')}
                                className="text-3xl leading-none text-slate-400 transition hover:text-slate-700"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-6 p-4 sm:p-6">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">{t('detail.amount')}</p>
                                    <p className="mt-1 font-black text-slate-900">{formatMoney(selectedInvoice.amount)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">{t('detail.paid')}</p>
                                    <p className="mt-1 font-black text-emerald-700">{formatMoney(selectedInvoice.paidAmount)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">{t('detail.remaining')}</p>
                                    <p className="mt-1 font-black text-amber-700">{formatMoney(selectedInvoiceBalance)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">{t('detail.dueAt')}</p>
                                    <p className="mt-1 font-bold text-slate-900">{formatDate(selectedInvoice.dueAt)}</p>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                <div><span className="text-slate-500">{t('detail.patient')}</span> <strong>{invoiceContext?.patientName ?? t('unspecified')}</strong></div>
                                <div><span className="text-slate-500">{t('detail.issued')}</span> <strong>{formatDate(selectedInvoice.issuedAt, true)}</strong></div>
                                <div><span className="text-slate-500">{t('detail.comment')}</span> <strong>{selectedInvoice.comment || t('none')}</strong></div>
                            </div>

                            {selectedInvoice.status === 'DRAFT' && (
                                <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-blue-800">
                                        {t('detail.draftHint')}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleIssueInvoice(selectedInvoice, 'detail')}
                                        disabled={issueInvoiceState.isLoading}
                                        className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                                    >
                                        {issueInvoiceState.isLoading ? t('detail.issuing') : t('detail.issue')}
                                    </button>
                                </div>
                            )}

                            {canRegisterPayment && (
                                <form onSubmit={handleRegisterPayment} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                                    <div>
                                        <h3 className="font-bold text-slate-900">{t('detail.register')}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {t('detail.remainingPayment', {amount: formatMoney(selectedInvoiceBalance)})}
                                        </p>
                                    </div>
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('detail.paymentAmount')}</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={paymentAmount}
                                                onChange={(event) => setPaymentAmount(event.target.value)}
                                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('detail.method')}</span>
                                            <select
                                                value={paymentMethod}
                                                onChange={(event) => setPaymentMethod(event.target.value)}
                                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            >
                                                {(['CASH', 'BANK_TRANSFER', 'CARD'] as const).map((code) => (
                                                    <option key={code} value={code}>{t(`methods.${code}`)}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('detail.paidAt')}</span>
                                            <input
                                                type="datetime-local"
                                                value={paymentPaidAt}
                                                onChange={(event) => setPaymentPaidAt(event.target.value)}
                                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('detail.reference')}</span>
                                            <input
                                                type="text"
                                                value={paymentReference}
                                                onChange={(event) => setPaymentReference(event.target.value)}
                                                placeholder="BANK-000123"
                                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                    <div className="mt-5 flex">
                                        <button
                                            type="submit"
                                            disabled={registerPaymentState.isLoading}
                                            className="min-h-11 w-full rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300 sm:ml-auto sm:w-auto"
                                        >
                                            {registerPaymentState.isLoading ? t('detail.saving') : t('detail.savePayment')}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-slate-900">{t('detail.history')}</h3>
                                    {paymentsQuery.isFetching && <span className="text-xs text-slate-400">{t('detail.refreshing')}</span>}
                                </div>

                                {paymentsQuery.isError ? (
                                    <div className="mt-3">
                                        <Notice tone="error">
                                            {getApiErrorMessage(paymentsQuery.error, t('detail.paymentsError'), {'403': t('errors.forbidden'), '404': t('errors.notFound'), '500': t('errors.unavailable')})}
                                        </Notice>
                                    </div>
                                ) : payments.length === 0 ? (
                                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('detail.noPayments')}</p>
                                ) : (
                                    <div className="mt-3 space-y-3">
                                        {payments.map((payment: Payment) => (
                                            <div key={payment.id} className={`rounded-xl border p-4 ${payment.reversedAt ? 'border-red-200 bg-red-50/60' : 'border-slate-200'}`}>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-black text-slate-900">{formatMoney(payment.amount)}</span>
                                                            {payment.reversedAt && (
                                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{t('detail.reversed')}</span>
                                                            )}
                                                        </div>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {(['CASH', 'BANK_TRANSFER', 'CARD'] as string[]).includes(payment.paymentMethod) ? t(`methods.${payment.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CARD'}`) : payment.paymentMethod} · {formatDate(payment.paidAt, true)}
                                                            {payment.externalReference ? ` · ${payment.externalReference}` : ''}
                                                        </p>
                                                        {payment.reversalReason && (
                                                            <p className="mt-2 text-sm font-medium text-red-700">{t('detail.reversalReason', {reason: payment.reversalReason})}</p>
                                                        )}
                                                    </div>
                                                    {!payment.reversedAt && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setReversingPaymentId(payment.id);
                                                                setReversalReason('');
                                                            }}
                                                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                                        >
                                                            {t('detail.reverse')}
                                                        </button>
                                                    )}
                                                </div>

                                                {reversingPaymentId === payment.id && (
                                                    <form onSubmit={handleReversePayment} className="mt-4 border-t border-red-200 pt-4">
                                                        <label className="block">
                                                            <span className="mb-1.5 block text-xs font-bold text-red-700">{t('detail.reason')}</span>
                                                            <textarea
                                                                value={reversalReason}
                                                                onChange={(event) => setReversalReason(event.target.value)}
                                                                rows={2}
                                                                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                            />
                                                        </label>
                                                        <div className="mt-3 flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setReversingPaymentId(null)}
                                                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                                                            >
                                                                {commonT('cancel')}
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                disabled={reversePaymentState.isLoading}
                                                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                                                            >
                                                                {reversePaymentState.isLoading ? t('detail.reversing') : commonT('confirm')}
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
