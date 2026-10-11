'use client';
import {mvpModules} from '@/src/lib/mvp';

import { FormEvent, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

import { RootState } from '@/src/lib/store';
import {
    useGetTaskQualityIncidentsQuery,
    useResolveTaskQualityIncidentMutation,
} from '@/src/services/api/tasksReworkApi';
import type { QualityIncident } from '@/src/types/task.types';

const PAGE_SIZE = 20;

type QualityIncidentsPanelProps = {
    taskId: string;
    className?: string;
};

export default function QualityIncidentsPanel({
    taskId,
    className = '',
}: QualityIncidentsPanelProps) {
    const t = useTranslations('tasks.quality');
    const commonT = useTranslations('common.actions');
    const paginationT = useTranslations('common.pagination');
    const { role, roles } = useSelector((state: RootState) => state.auth);
    const [pagination, setPagination] = useState({ taskId: '', page: 0 });
    const [resolvingIncidentId, setResolvingIncidentId] = useState('');
    const [resolutionComment, setResolutionComment] = useState('');
    const [resolveError, setResolveError] = useState('');
    const page = pagination.taskId === taskId ? pagination.page : 0;
    const {
        data,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetTaskQualityIncidentsQuery({ taskId, page, size: PAGE_SIZE });
    const [resolveIncident, { isLoading: isResolving }] = useResolveTaskQualityIncidentMutation();
    const incidents = useMemo(() => data?.content ?? [], [data?.content]);
    const openIncidents = useMemo(
        () => incidents.filter((incident) => incident.status === 'OPEN'),
        [incidents]
    );
    const normalizedRoles = roles.map((userRole) => userRole.toUpperCase().replace(/^ROLE_/u, ''));
    const canResolve = role === 'ADMIN'
        || role === 'DISPATCHER'
        || normalizedRoles.includes('CHIEF_TECHNICIAN');
    const currentPage = data?.page ?? data?.number ?? page;
    const hasNext = data?.hasNext ?? data?.last === false;

    const changePage = (nextPage: number) => {
        setPagination({ taskId, page: Math.max(nextPage, 0) });
        setResolvingIncidentId('');
        setResolutionComment('');
        setResolveError('');
    };

    const startResolving = (incidentId: string) => {
        setResolvingIncidentId(incidentId);
        setResolutionComment('');
        setResolveError('');
    };

    const handleResolve = async (event: FormEvent<HTMLFormElement>, incidentId: string) => {
        event.preventDefault();
        const comment = resolutionComment.trim();

        if (!comment) {
            setResolveError(t('commentRequired'));
            return;
        }

        setResolveError('');

        try {
            await resolveIncident({ taskId, incidentId, resolutionComment: comment }).unwrap();
            setResolvingIncidentId('');
            setResolutionComment('');
        } catch (error) {
            if (getErrorStatus(error) === 409) {
                void refetch();
            }
        }
    };

    return (
        <section className={className}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {t('title')}
                    </p>
                    <div className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
                        {t('count', {count: openIncidents.length})}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void refetch()}
                    disabled={isFetching}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                    {isFetching ? commonT('processing') : commonT('refresh')}
                </button>
            </div>

            {isLoading ? (
                <div className="mt-4 space-y-3" aria-busy="true">
                    <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : null}

            {isError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                    <p className="text-sm font-bold text-red-700">
                        {t('loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800"
                    >
                        {commonT('retry')}
                    </button>
                </div>
            ) : null}

            {!isLoading && !isError && incidents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">
                    {t('empty')}
                </div>
            ) : null}

            {!isError && incidents.length > 0 ? (
                <div className="mt-4 space-y-3">
                    {incidents.map((incident) => (
                        <IncidentCard
                            key={incident.id}
                            incident={incident}
                            canResolve={canResolve}
                            isResolveFormOpen={resolvingIncidentId === incident.id}
                            isResolving={isResolving && resolvingIncidentId === incident.id}
                            resolutionComment={resolutionComment}
                            resolveError={resolvingIncidentId === incident.id ? resolveError : ''}
                            onStartResolving={() => startResolving(incident.id)}
                            onCancelResolving={() => {
                                setResolvingIncidentId('');
                                setResolutionComment('');
                                setResolveError('');
                            }}
                            onResolutionCommentChange={setResolutionComment}
                            onResolve={(event) => void handleResolve(event, incident.id)}
                        />
                    ))}
                </div>
            ) : null}

            {!isError && incidents.length > 0 ? (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <button
                        type="button"
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 0 || isFetching}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {commonT('back')}
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {t('page', {page: currentPage + 1})}
                    </span>
                    <button
                        type="button"
                        onClick={() => changePage(currentPage + 1)}
                        disabled={!hasNext || isFetching}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {paginationT('next')}
                    </button>
                </div>
            ) : null}
        </section>
    );
}

type IncidentCardProps = {
    incident: QualityIncident;
    canResolve: boolean;
    isResolveFormOpen: boolean;
    isResolving: boolean;
    resolutionComment: string;
    resolveError: string;
    onStartResolving: () => void;
    onCancelResolving: () => void;
    onResolutionCommentChange: (value: string) => void;
    onResolve: (event: FormEvent<HTMLFormElement>) => void;
};

function IncidentCard({
    incident,
    canResolve,
    isResolveFormOpen,
    isResolving,
    resolutionComment,
    resolveError,
    onStartResolving,
    onCancelResolving,
    onResolutionCommentChange,
    onResolve,
}: IncidentCardProps) {
    const t = useTranslations('tasks.quality');
    const commonT = useTranslations('common.actions');
    const formatters = useAppFormatters();
    const isOpen = incident.status === 'OPEN';
    const incidentType = incident.incidentType === 'REWORK'
        ? t('incidentTypes.REWORK')
        : incident.incidentType === 'DEFECT' ? t('incidentTypes.DEFECT') : incident.incidentType;
    const reason = incident.reasonCode === 'QUALITY_DEFECT' ? t('reasons.QUALITY_DEFECT')
        : incident.reasonCode === 'WRONG_SIZE' ? t('reasons.WRONG_SIZE')
        : incident.reasonCode === 'WRONG_COLOR' ? t('reasons.WRONG_COLOR')
        : incident.reasonCode === 'DAMAGED' ? t('reasons.DAMAGED')
        : incident.reasonCode === 'TECHNOLOGY_VIOLATION' ? t('reasons.TECHNOLOGY_VIOLATION')
        : incident.reasonCode === 'OTHER' ? t('reasons.OTHER') : incident.reasonCode;

    return (
        <article className={`rounded-xl border p-4 ${isOpen ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-black text-slate-900">
                        {incidentType}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {reason}
                    </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isOpen ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>
                    {isOpen ? t('open') : t('closed')}
                </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                {incident.description}
            </p>

            {mvpModules.finance && <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <IncidentMetric label={t('materialLoss')} value={formatAmount(incident.materialLossAmount, formatters.number)} />
                <IncidentMetric label={t('deduction')} value={formatAmount(incident.salaryDeductionAmount, formatters.number)} />
            </dl>}

            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-200/70 pt-3 text-[10px] font-semibold text-slate-500">
                <span>{t('created', {date: formatters.dateTime(incident.createdAt)})}</span>
                <span>{t('responsible', {id: shortId(incident.assignedTo)})}</span>
            </div>

            {!isOpen && incident.resolutionComment ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 p-3">
                    <p className="text-[10px] font-black uppercase text-emerald-700">{t('result')}</p>
                    <p className="mt-1 text-sm text-slate-700">{incident.resolutionComment}</p>
                    {incident.resolvedAt ? (
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                            {formatters.dateTime(incident.resolvedAt)}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {isOpen && canResolve && !isResolveFormOpen ? (
                <button
                    type="button"
                    onClick={onStartResolving}
                    className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                    {t('closeIncident')}
                </button>
            ) : null}

            {isOpen && canResolve && isResolveFormOpen ? (
                <form onSubmit={onResolve} className="mt-3 space-y-3 border-t border-amber-200 pt-3">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                            {t('resolutionComment')}
                        </span>
                        <textarea
                            value={resolutionComment}
                            onChange={(event) => onResolutionCommentChange(event.target.value)}
                            placeholder={t('resolutionPlaceholder')}
                            className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            required
                        />
                    </label>
                    {resolveError ? (
                        <p className="text-xs font-bold text-red-700" role="alert">{resolveError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="submit"
                            disabled={!resolutionComment.trim() || isResolving}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {isResolving ? t('resolving') : t('confirmResolution')}
                        </button>
                        <button
                            type="button"
                            onClick={onCancelResolving}
                            disabled={isResolving}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-wait"
                        >
                            {commonT('cancel')}
                        </button>
                    </div>
                </form>
            ) : null}
        </article>
    );
}

function IncidentMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white/70 p-2.5">
            <dt className="text-[9px] font-black uppercase text-slate-400">{label}</dt>
            <dd className="mt-1 font-bold text-slate-700">{value}</dd>
        </div>
    );
}

function formatAmount(value: number | null | undefined, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
    if (value === undefined || value === null) return '—';

    return formatNumber(value);
}

function shortId(value: string | null) {
    if (value === null) return '—';
    return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function getErrorStatus(error: unknown) {
    if (!isRecord(error)) return undefined;

    return typeof error.status === 'number' ? error.status : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
