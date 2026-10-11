'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import { useAppFormatters } from '@/src/i18n/provider';
import { useGetPatientHistoryQuery } from '@/src/services/api/patientHistoryApi';

const PAGE_SIZE = 20;

function getErrorStatus(error: unknown) {
    if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
    return (error as { status?: number | string }).status;
}

function HistorySkeleton({ label }: { label: string }) {
    return (
        <div className="space-y-4" aria-label={label} aria-busy="true">
            <div className="h-36 animate-pulse rounded-2xl bg-slate-200" />
            {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
    );
}

export default function PatientHistoryPage() {
    const t = useTranslations('patientHistory.history');
    const params = useParams<{ id: string | string[] }>();
    const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
    const [page, setPage] = useState(0);
    const formats = useAppFormatters();
    const historyQuery = useGetPatientHistoryQuery({ patientId, page, size: PAGE_SIZE }, { skip: !patientId });
    const treatments = useMemo(
        () => [...(historyQuery.data?.treatments ?? [])].sort(
            (first, second) => new Date(second.orderedAt).getTime() - new Date(first.orderedAt).getTime()
        ),
        [historyQuery.data?.treatments]
    );

    if (historyQuery.isLoading) return <HistorySkeleton label={t('loading')} />;

    if (historyQuery.isError) {
        const status = getErrorStatus(historyQuery.error);
        const message = status === 403 ? t('forbidden') : status === 404 ? t('notFound') : t('loadError');

        return (
            <section className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                <h1 className="font-black text-red-900">{message}</h1>
                {status !== 403 && status !== 404 ? (
                    <button type="button" onClick={() => void historyQuery.refetch()} className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">{t('retry')}</button>
                ) : null}
            </section>
        );
    }

    const history = historyQuery.data;
    if (!history) return null;

    return (
        <div className="mx-auto max-w-6xl space-y-5 pb-8">
            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500" />
                <div className="p-5 sm:p-6">
                    <Link href="/clinics/patients" className="text-xs font-bold uppercase tracking-wider text-violet-600 hover:underline">← {t('back')}</Link>
                    <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('title')}</p>
                            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{history.patientFullName}</h1>
                            <p className="mt-2 text-sm text-slate-500">{t('clinic')}: <span className="font-bold text-slate-700">{history.clinicName}</span></p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Metric label={t('orders')} value={history.totalOrders} />
                            <Metric label={t('treatments')} value={history.totalTreatments} />
                        </div>
                    </div>
                </div>
            </header>

            {treatments.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">{t('empty')}</section>
            ) : (
                <section className="relative space-y-4 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-violet-200 sm:before:left-6">
                    {treatments.map((item) => (
                        <article key={item.taskId} className="relative ml-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:ml-12 sm:p-6">
                            <span className="absolute -left-[2.08rem] top-7 h-3.5 w-3.5 rounded-full border-2 border-white bg-violet-600 ring-4 ring-violet-100 sm:-left-[2.55rem]" />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-violet-600">{t('order', { number: item.orderNumber })}</p>
                                    <h2 className="mt-1 text-lg font-black text-slate-950">{item.workTypeName}</h2>
                                    <div className="mt-2"><WorkDirectionBadge code={item.workDirectionCode} name={item.workDirectionName} /></div>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{item.statusName}</span>
                            </div>

                            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <Info label={t('doctor')} value={item.doctorName} />
                                <Info label={t('technician')} value={item.technicianName || t('unassigned')} />
                                <Info label={t('quantity')} value={formats.number(item.quantity)} />
                                <Info label={t('materials')} value={item.materialNames.length ? item.materialNames.join(', ') : t('noMaterials')} />
                                <Info label={t('teeth')} value={item.toothNumbers.length ? item.toothNumbers.join(', ') : t('noTeeth')} />
                                <Info label={t('orderedAt')} value={formats.dateTime(item.orderedAt)} />
                                <Info label={t('deadline')} value={item.deadline ? formats.date(item.deadline) : t('noDeadline')} />
                                <Info label={t('completedAt')} value={item.completedAt ? formats.dateTime(item.completedAt) : t('notCompleted')} />
                            </dl>

                            {item.comment ? (
                                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-bold text-slate-800">{t('comment')}:</span> {item.comment}</div>
                            ) : null}

                            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                <Link href={`/orders/${item.orderId}`} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">{t('openOrder')}</Link>
                                <Link href={`/orders/${item.orderId}?taskId=${item.taskId}`} className="rounded-xl border border-violet-200 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">{t('openTask')}</Link>
                            </div>
                        </article>
                    ))}
                </section>
            )}

            {history.totalPages > 1 ? (
                <nav className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row" aria-label={t('page', { page: history.page + 1, total: history.totalPages })}>
                    <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || historyQuery.isFetching} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">{t('previous')}</button>
                    <span className="text-sm font-semibold text-slate-500">{t('page', { page: history.page + 1, total: history.totalPages })}</span>
                    <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!history.hasNext || historyQuery.isFetching} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">{t('next')}</button>
                </nav>
            ) : null}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return <div className="min-w-28 rounded-xl bg-violet-50 px-4 py-3"><p className="text-2xl font-black text-violet-900">{value}</p><p className="text-xs font-semibold text-violet-600">{label}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</dd></div>;
}
