'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useGetTaskHistoryQuery} from '@/src/services/api/ordersApi';
import type {TaskHistoryItem} from '@/src/types/task.types';
import {useAppFormatters} from '@/src/i18n/provider';

const HISTORY_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FIELD_KEYS = {
    status: 'fields.status',
    currentStatus: 'fields.status',
    currentStatusCode: 'fields.status',
    currentStatusFormName: 'fields.status',
    technicianId: 'fields.technician',
    dentalTechnicianId: 'fields.technician',
    dentalTechnicianFullName: 'fields.technician',
    operatorId: 'fields.operator',
    cadCamOperatorId: 'fields.operator',
    patientFullName: 'fields.patient',
    doctorFullName: 'fields.doctor',
    deadline: 'fields.deadline',
    quantity: 'fields.quantity',
    toothNumbers: 'fields.teeth',
    workTypeId: 'fields.workType',
    workTypeName: 'fields.workType',
    materialIds: 'fields.materials',
    materialNames: 'fields.materials',
    colorId: 'fields.color',
    colorCode: 'fields.color',
    pricePerUnit: 'fields.unitPrice',
    unitPrice: 'fields.unitPrice',
    discount: 'fields.discount',
    discountPercent: 'fields.discount',
    totalPrice: 'fields.total',
    totalAmount: 'fields.total',
    comment: 'fields.comment',
} as const;

const EVENT_KEYS = {
    CREATED: 'events.CREATED',
    UPDATED: 'events.UPDATED',
    FIELD_CHANGED: 'events.FIELD_CHANGED',
    VALUE_CHANGED: 'events.FIELD_CHANGED',
    STATUS_CHANGED: 'events.STATUS_CHANGED',
    STATUS_UPDATED: 'events.STATUS_CHANGED',
    ASSIGNED: 'events.ASSIGNED',
    TECHNICIAN_ASSIGNED: 'events.TECHNICIAN_ASSIGNED',
    OPERATOR_ASSIGNED: 'events.OPERATOR_ASSIGNED',
    COMMENT_ADDED: 'events.COMMENT_ADDED',
    ATTACHMENT_ADDED: 'events.ATTACHMENT_ADDED',
    DELETED: 'events.DELETED',
} as const;

const EVENT_DOT_CLASSES: Record<string, string> = {
    CREATED: 'border-green-200 bg-green-500 ring-green-100',
    STATUS_CHANGED: 'border-blue-200 bg-blue-500 ring-blue-100',
    STATUS_UPDATED: 'border-blue-200 bg-blue-500 ring-blue-100',
    ASSIGNED: 'border-violet-200 bg-violet-500 ring-violet-100',
    TECHNICIAN_ASSIGNED: 'border-violet-200 bg-violet-500 ring-violet-100',
    OPERATOR_ASSIGNED: 'border-violet-200 bg-violet-500 ring-violet-100',
    DELETED: 'border-red-200 bg-red-500 ring-red-100',
};

type TaskHistoryTimelineProps = {
    taskId?: string | null;
    fallbackItems?: TaskHistoryItem[];
    className?: string;
    compact?: boolean;
    onOpenDetails?: () => void;
};

export default function TaskHistoryTimeline({
                                                taskId,
                                                fallbackItems = [],
                                                className = '',
                                                compact = false,
                                                onOpenDetails,
                                            }: TaskHistoryTimelineProps) {
    const t = useTranslations('tasks.history');
    const commonT = useTranslations('common');
    const activeTaskId = taskId ?? '';
    const [pagination, setPagination] = useState({taskId: '', page: 0});
    const canLoadHistory = Boolean(taskId && UUID_PATTERN.test(taskId));
    const page = pagination.taskId === activeTaskId ? pagination.page : 0;
    const changePage = (updater: (currentPage: number) => number) => {
        setPagination((currentPagination) => {
            const currentPage = currentPagination.taskId === activeTaskId
                ? currentPagination.page
                : 0;

            return {
                taskId: activeTaskId,
                page: Math.max(updater(currentPage), 0),
            };
        });
    };

    const {
        data,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetTaskHistoryQuery(
        {taskId: taskId ?? '', page, size: HISTORY_PAGE_SIZE},
        {skip: !canLoadHistory}
    );

    const events = useMemo(() => data?.content ?? [], [data?.content]);
    const participantCount = useMemo(() => {
        return new Set(
            events
                .map((event) => event.changedBy?.userId ?? event.changedBy?.fullName)
                .filter(Boolean)
        ).size;
    }, [events]);

    if (!taskId) {
        return (
            <section className={className}>
                <HistoryHeader eventCount={0} participantCount={0} />
                <EmptyState text={t('selectTask')} />
            </section>
        );
    }

    if (!canLoadHistory) {
        return (
            <section className={className}>
                {compact ? <CompactHistoryHeader eventCount={fallbackItems.length} /> : <HistoryHeader
                    eventCount={fallbackItems.length}
                    participantCount={new Set(
                        fallbackItems
                            .map((event) => event.changedBy?.userId ?? event.changedBy?.fullName)
                            .filter(Boolean)
                    ).size}
                />}
                {fallbackItems.length ? compact ? (
                    <CompactHistory events={fallbackItems} onOpenDetails={onOpenDetails} />
                ) : (
                    <div className="mt-5 space-y-4">
                        {fallbackItems.map((event, index) => (
                            <HistoryEventCard
                                key={event.id}
                                event={event}
                                isLast={index === fallbackItems.length - 1}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState text={t('empty')} />
                )}
            </section>
        );
    }

    return (
        <section className={className}>
            <div className="flex items-start justify-between gap-3">
                {compact ? <CompactHistoryHeader eventCount={events.length} /> : <HistoryHeader eventCount={events.length} participantCount={participantCount} />}

                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                    {commonT('actions.refresh')}
                </button>
            </div>

            {isLoading ? (
                <div className="mt-4 space-y-3">
                    {Array.from({length: 3}).map((_, index) => (
                        <div
                            key={index}
                            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                        />
                    ))}
                </div>
            ) : null}

            {isError ? (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-bold text-red-700">
                        {t('loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-red-700"
                    >
                        {commonT('actions.retry')}
                    </button>
                </div>
            ) : null}

            {!isLoading && !isError && events.length === 0 ? (
                <EmptyState text={t('empty')} />
            ) : null}

            {!isError && events.length > 0 && compact ? (
                <CompactHistory events={events} onOpenDetails={onOpenDetails} />
            ) : null}

            {!isError && events.length > 0 && !compact ? (
                <>
                    <div className="mt-5 space-y-4">
                        {events.map((event, index) => (
                            <HistoryEventCard
                                key={event.id}
                                event={event}
                                isLast={index === events.length - 1}
                            />
                        ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={() => changePage((currentPage) => currentPage - 1)}
                            disabled={page === 0 || isFetching}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {commonT('actions.back')}
                        </button>

                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {t('page', {page: (data?.page ?? page) + 1})}
                        </span>

                        <button
                            type="button"
                            onClick={() => changePage((currentPage) => currentPage + 1)}
                            disabled={!data?.hasNext || isFetching}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {commonT('pagination.next')}
                        </button>
                    </div>
                </>
            ) : null}
        </section>
    );
}

function CompactHistory({ events, onOpenDetails }: { events: TaskHistoryItem[]; onOpenDetails?: () => void }) {
    const t = useTranslations('tasks.history');
    const formats = useAppFormatters();
    return (
        <div className="mt-4">
            <div className="relative space-y-1 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
                {events.slice(0, 3).map((event) => {
                    const { dateLabel, timeLabel } = formatChangedAt(event.changedAt, formats);
                    const dotClassName = EVENT_DOT_CLASSES[event.eventType] ?? 'border-amber-200 bg-amber-500 ring-amber-100';
                    return (
                        <article key={event.id} className="relative flex gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/70">
                            <span className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ring-4 ${dotClassName}`} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-black text-slate-800 dark:text-slate-100">{getEventTitle(event, t)}</p><time className="shrink-0 text-[9px] font-bold text-slate-400">{dateLabel} · {timeLabel}</time></div>
                                <div className="line-clamp-1 text-[11px] text-slate-500"><HistoryValueChange event={event} /></div>
                            </div>
                        </article>
                    );
                })}
            </div>
            <button type="button" onClick={onOpenDetails} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25">
                {t('fullHistory')} <span aria-hidden="true">→</span>
            </button>
        </div>
    );
}

function HistoryHeader({
                           eventCount,
                           participantCount,
                       }: {
    eventCount: number;
    participantCount: number;
}) {
    const t = useTranslations('tasks.history');
    return (
        <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                {t('title')}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric label={t('eventsMetric')} value={eventCount} />
                <Metric label={t('participants')} value={participantCount || '-'} />
            </div>
        </div>
    );
}

function CompactHistoryHeader({ eventCount }: { eventCount: number }) {
    const t = useTranslations('tasks.history');
    return <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round"/><path d="M3 4v5h5M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg></span><div><p className="text-sm font-black text-slate-900 dark:text-white">{t('title')}</p><p className="text-[11px] font-semibold text-slate-400">{t('summary', {count: eventCount})}</p></div></div></div>;
}

function Metric({label, value}: { label: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">
                {value}
            </p>
        </div>
    );
}

function HistoryEventCard({event, isLast}: { event: TaskHistoryItem; isLast: boolean }) {
    const t = useTranslations('tasks.history');
    const formats = useAppFormatters();
    const {dateLabel, timeLabel} = formatChangedAt(event.changedAt, formats);
    const title = getEventTitle(event, t);
    const dotClassName = EVENT_DOT_CLASSES[event.eventType] ?? 'border-amber-200 bg-amber-500 ring-amber-100';
    const fullName = event.changedBy?.fullName ?? t('unknownUser');
    const initials = event.changedBy?.initials || getInitials(fullName);

    return (
        <article className="grid grid-cols-[4.75rem_1.25rem_minmax(0,1fr)] gap-3">
            <time className="pt-1 text-right" dateTime={event.changedAt}>
                <span className="block text-xs font-black text-slate-700">
                    {dateLabel}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-400">
                    {timeLabel}
                </span>
            </time>

            <div className="relative flex justify-center">
                {!isLast ? (
                    <span className="absolute bottom-[-1rem] top-4 w-px bg-slate-200" />
                ) : null}
                <span className={`relative mt-1 h-3.5 w-3.5 rounded-full border-2 ring-4 ${dotClassName}`} />
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900">
                            {title}
                        </h4>
                        <HistoryValueChange event={event} />
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-700">
                            {initials}
                        </span>
                        <span className="hidden max-w-28 truncate text-xs font-bold text-slate-500 sm:block">
                            {fullName}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}

function HistoryValueChange({event}: { event: TaskHistoryItem }) {
    const t = useTranslations('tasks.history');
    const oldValue = normalizeHistoryValue(event.oldValue);
    const newValue = normalizeHistoryValue(event.newValue);
    const fieldName = event.fieldName ? getFieldLabel(event.fieldName, t) : null;

    if (!oldValue && !newValue) {
        return fieldName ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">
                {t('field', {field: fieldName})}
            </p>
        ) : null;
    }

    if (!oldValue) {
        return (
            <p className="mt-2 text-sm text-slate-600">
                {fieldName ? `${capitalize(fieldName)}: ` : ''}
                <span className="font-bold text-slate-900">{newValue}</span>
            </p>
        );
    }

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-400 line-through">
                {oldValue}
            </span>
            {newValue ? (
                <>
                    <span className="font-bold text-slate-400">→</span>
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-black text-blue-700">
                        {newValue}
                    </span>
                </>
            ) : null}
        </div>
    );
}

function EmptyState({text}: { text: string }) {
    return (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">
            {text}
        </div>
    );
}

type HistoryTranslator = ReturnType<typeof useTranslations<'tasks.history'>>;

function getEventTitle(event: TaskHistoryItem, t: HistoryTranslator) {
    if (isStatusField(event.fieldName)) {
        return t('events.STATUS_CHANGED');
    }

    if (event.eventType === 'CREATED') {
        return t('events.CREATED');
    }

    if (event.fieldName) {
        return t('fieldChanged', {field: getFieldLabel(event.fieldName, t)});
    }

    const eventKey = EVENT_KEYS[event.eventType as keyof typeof EVENT_KEYS];
    return eventKey ? t(eventKey) : humanizeEventType(event.eventType);
}

function isStatusField(fieldName?: string | null) {
    return Boolean(fieldName && ['status', 'currentStatus', 'currentStatusCode', 'currentStatusFormName'].includes(fieldName));
}

function getFieldLabel(fieldName: string, t: HistoryTranslator) {
    const fieldKey = FIELD_KEYS[fieldName as keyof typeof FIELD_KEYS];
    return fieldKey ? t(fieldKey) : fieldName;
}

function normalizeHistoryValue(value?: string | null) {
    if (value === undefined || value === null) return '';

    const trimmedValue = String(value).trim();

    return trimmedValue || '';
}

function formatChangedAt(value: string, formats: ReturnType<typeof useAppFormatters>) {
    const changedAt = new Date(value);

    if (Number.isNaN(changedAt.getTime())) {
        return {
            dateLabel: '-',
            timeLabel: '',
        };
    }

    return {
        dateLabel: formats.date(changedAt, {
            day: 'numeric',
            month: 'short',
        }),
        timeLabel: formats.date(changedAt, {
            hour: '2-digit',
            minute: '2-digit',
        }),
    };
}

function getInitials(fullName: string) {
    return fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?';
}

function humanizeEventType(eventType: string) {
    return eventType
        .toLowerCase()
        .split('_')
        .map(capitalize)
        .join(' ');
}

function capitalize(value: string) {
    if (!value) return value;

    return value[0].toUpperCase() + value.slice(1);
}
