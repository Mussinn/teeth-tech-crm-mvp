'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {useTranslations} from 'next-intl';
import { useSelector } from 'react-redux';

import { useGetTasksDashboardQuery } from '@/src/services/api/tasksDashboardApi';
import { useGetUsersQuery } from '@/src/services/api/usersApi';
import { useGetWorkDirectionsQuery } from '@/src/services/api/workDirectionsApi';
import { useGetWorkTypesQuery } from '@/src/services/api/laboratory/workTypesApi';
import MaterialChips from '@/src/components/tasks/MaterialChips';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import {useAppFormatters, useAppLocale} from '@/src/i18n/provider';
import { normalizeAuthRoles } from '@/src/features/auth/authUtils';
import type { RootState } from '@/src/lib/store';
import { taskMatchesMaterialSearch } from '@/src/utils/materialAccounting';
import { isWorkDirectionAccessError } from '@/src/utils/workDirections';
import type {
    TaskDashboardColumn,
    TaskDashboardTask,
} from '@/src/types/task.types';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';

type StatusOption = {
    value: string;
    label: string;
    statusId?: string;
};

const statusThemes = [
    { border: 'border-slate-300 dark:border-slate-700', dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', glow: 'from-slate-500/10 dark:from-slate-500/15' },
    { border: 'border-blue-300 dark:border-blue-500/40', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', glow: 'from-blue-500/10 dark:from-blue-500/15' },
    { border: 'border-cyan-300 dark:border-cyan-500/40', dot: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300', glow: 'from-cyan-500/10 dark:from-cyan-500/15' },
    { border: 'border-amber-300 dark:border-amber-500/40', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', glow: 'from-amber-500/10 dark:from-amber-500/15' },
    { border: 'border-violet-300 dark:border-violet-500/40', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', glow: 'from-violet-500/10 dark:from-violet-500/15' },
    { border: 'border-emerald-300 dark:border-emerald-500/40', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', glow: 'from-emerald-500/10 dark:from-emerald-500/15' },
    { border: 'border-rose-300 dark:border-rose-500/40', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', glow: 'from-rose-500/10 dark:from-rose-500/15' },
];

function getColumnTheme(index: number) {
    return statusThemes[index % statusThemes.length];
}

function getTaskTitle(task: TaskDashboardTask, fallback: string) {
    return task.workTypeName || task.materialNames?.[0] || fallback;
}

function getOrderLabel(task: TaskDashboardTask, fallback: string) {
    return task.orderNumber || fallback;
}

function getTeethLabel(task: TaskDashboardTask, fallback: string) {
    return task.toothNumbers.length > 0
        ? task.toothNumbers.join(', ')
        : fallback;
}

function buildStatusOptions(columns: TaskDashboardColumn[]) {
    const used = new Set<string>();

    return columns.reduce<StatusOption[]>((options, column) => {
        const value = column.statusId || column.statusCode;

        if (!value || used.has(value)) return options;

        used.add(value);
        options.push({
            value,
            label: column.statusName || column.statusCode,
            statusId: column.statusId,
        });

        return options;
    }, []);
}

function MetricCard({
    label,
    value,
    accentClassName,
    toneClassName,
}: {
    label: string;
    value: number;
    accentClassName: string;
    toneClassName: string;
}) {
    const t = useTranslations('dashboard');
    const format = useAppFormatters();
    return (
        <article className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/5">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <span className={`h-2.5 w-2.5 rounded-full ${accentClassName}`} />
            </div>
            <p className={`mt-5 text-3xl font-black tracking-tight ${toneClassName}`}>
                {format.number(value)}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">{t('currentData')}</p>
        </article>
    );
}

function TaskCard({ task }: { task: TaskDashboardTask }) {
    const t = useTranslations('dashboard');
    const format = useAppFormatters();
    const patientFallback = t('patientMissing');
    const patientInitial = (task.patientName || patientFallback).trim().charAt(0).toLocaleUpperCase();
    const deadline = task.deadline
        ? format.date(`${task.deadline}T00:00:00`, {day: 'numeric', month: 'short', year: 'numeric'})
        : t('noDeadline');

    return (
        <Link
            href={`/orders/${task.orderId}`}
            className={`group relative block overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-950/10 dark:bg-slate-900 dark:hover:border-violet-500/60 dark:hover:shadow-black/30 ${
                task.isOverdue ? 'border-red-200 dark:border-red-500/50' : 'border-slate-200 dark:border-slate-700'
            }`}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${task.isOverdue ? 'bg-red-500' : 'bg-violet-500 opacity-0 transition group-hover:opacity-100'}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                        {t('order', {number: getOrderLabel(task, t('orderMissing'))})}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                        {getTaskTitle(task, t('taskFallback'))}
                    </h3>
                    <div className="mt-2">
                        <WorkDirectionBadge code={task.workDirectionCode} name={task.workDirectionName} />
                    </div>
                </div>

                <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                        task.isOverdue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" aria-hidden="true"><circle cx="12" cy="12" r="9" strokeWidth="2" /><path d="M12 7v5l3 2" strokeWidth="2" strokeLinecap="round" /></svg>
                    {deadline}
                </span>
            </div>

            <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">{patientInitial}</span>
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{task.patientName || t('patientMissing')}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{task.clinicName || t('clinicMissing')}</p>
                </div>
            </div>

            <p className="mt-2 text-xs text-amber-700" title="Календарное время с последнего перехода; включает ожидание">{task.stageDays ?? 0} дн. на этапе</p>
            <dl className="mt-2.5 space-y-1.5 text-[10px] text-slate-500">
                <div className="flex justify-between gap-3">
                    <dt>{t('doctor')}</dt>
                    <dd className="max-w-36 truncate text-right font-semibold text-slate-700" title={task.doctorName || t('doctorMissing')}>
                        {task.doctorName || t('doctorMissing')}
                    </dd>
                </div>
                <div className="flex justify-between gap-3">
                    <dt>{t('technician')}</dt>
                    <dd className="max-w-36 truncate text-right font-semibold text-slate-700" title={task.technicianName || t('technicianMissing')}>
                        {task.technicianName || t('technicianMissing')}
                    </dd>
                </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-2.5 text-[9px] font-semibold text-slate-600">
                <MaterialChips materialNames={task.materialNames} compact />
                <span className="rounded-md bg-slate-100 px-2 py-1">{t('color', {color: task.colorCode || '—'})}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">{t('units', {count: format.number(task.quantity)})}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">{t('teeth', {teeth: getTeethLabel(task, t('teethMissing'))})}</span>
            </div>
        </Link>
    );
}

function CompactTaskCard({ task }: { task: TaskDashboardTask }) {
    const t = useTranslations('dashboard');
    const format = useAppFormatters();
    const deadline = task.deadline
        ? format.date(`${task.deadline}T00:00:00`, {day: 'numeric', month: 'short', year: 'numeric'})
        : t('noDeadline');
    return (
        <Link
            href={`/orders/${task.orderId}`}
            className={`group flex min-w-0 items-center gap-2.5 rounded-xl border bg-white p-2.5 transition hover:border-violet-300 hover:shadow-md dark:bg-slate-900/90 dark:hover:border-violet-500/60 ${
                task.isOverdue ? 'border-red-200 bg-red-50/40 dark:border-red-500/50 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'
            }`}
        >
            <span className={`h-8 w-1 shrink-0 rounded-full ${task.isOverdue ? 'bg-red-500' : 'bg-violet-500'}`} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[9px] font-black uppercase text-violet-600">
                        {getOrderLabel(task, t('orderMissing'))}
                    </span>
                    <span className="truncate text-[9px] font-semibold text-slate-400">
                        {task.clinicName || t('noClinic')}
                    </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-slate-100">
                    {getTaskTitle(task, t('taskFallback'))}
                </p>
                <div className="mt-1"><WorkDirectionBadge code={task.workDirectionCode} name={task.workDirectionName} /></div>
            </div>
            <div className="shrink-0 text-right">
                <p className={`text-[9px] font-black ${task.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                    {task.isOverdue ? t('overdue') : deadline}
                </p>
                <p className="mt-0.5 max-w-24 truncate text-[9px] text-slate-400">
                    {task.technicianName || t('technicianMissing')}
                </p>
            </div>
        </Link>
    );
}

function DashboardSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
            ))}
        </div>
    );
}

export default function Dashboard() {
    const t = useTranslations('dashboard');
    const tCommon = useTranslations('common.actions');
    const format = useAppFormatters();
    const {locale} = useAppLocale();
    const { id: currentUserId, role, roles } = useSelector((state: RootState) => state.auth);
    const normalizedRoles = normalizeAuthRoles(roles.length > 0 ? roles : role ? [role] : []);
    const isAdmin = normalizedRoles.includes('ADMIN');
    const isDispatcher = normalizedRoles.includes('DISPATCHER');
    const [search, setSearch] = useState('');
    const [workTypeCode, setWorkTypeCode] = useState('');
    const [selectedStatusKey, setSelectedStatusKey] = useState('');
    const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>();
    const [selectedStatusLabel, setSelectedStatusLabel] = useState('');
    const [flowView, setFlowView] = useState<'compact' | 'kanban'>('compact');
    const [selectedDirectionId, setSelectedDirectionId] = useState('');
    const debouncedSearch = useDebouncedValue(search, 400);
    const usersQuery = useGetUsersQuery(undefined, { skip: !isDispatcher });
    const directionsQuery = useGetWorkDirectionsQuery();
    const workTypesQuery = useGetWorkTypesQuery();
    const currentUser = usersQuery.data?.find((user) => user.id === currentUserId);
    const directionOptions = useMemo(
        () => isAdmin
            ? (directionsQuery.data ?? [])
            : (currentUser?.workDirections ?? []).filter((direction) => direction.active),
        [currentUser?.workDirections, directionsQuery.data, isAdmin]
    );
    const dispatcherDirectionsPending = isDispatcher && (usersQuery.isLoading || usersQuery.isFetching);
    const dispatcherHasNoDirections = isDispatcher
        && !dispatcherDirectionsPending
        && !usersQuery.isError
        && directionOptions.length === 0;

    const dashboardFilters = useMemo(
        () => ({
            search: debouncedSearch,
            workTypeCode,
            statusId: selectedStatusId,
        }),
        [debouncedSearch, workTypeCode, selectedStatusId]
    );

    const {
        data,
        isError,
        isFetching,
        isLoading,
        refetch,
        error: dashboardError,
    } = useGetTasksDashboardQuery(dashboardFilters, {
 pollingInterval: 10000, skipPollingIfUnfocused: true,
        skip: dispatcherDirectionsPending || dispatcherHasNoDirections || usersQuery.isError,
    });

    const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
    const statusOptions = useMemo(() => buildStatusOptions(columns), [columns]);
    const visibleStatusOptions = useMemo(() => {
        if (
            !selectedStatusKey ||
            statusOptions.some((option) => option.value === selectedStatusKey)
        ) {
            return statusOptions;
        }

        return [
            {
                value: selectedStatusKey,
                label: selectedStatusLabel || t('filters.selectedStatus'),
                statusId: selectedStatusId,
            },
            ...statusOptions,
        ];
    }, [selectedStatusId, selectedStatusKey, selectedStatusLabel, statusOptions, t]);

    const visibleColumns = useMemo(() => {
        const directionColumns = !selectedDirectionId ? columns : columns.map((column) => {
            const tasks = column.tasks.filter((task) => task.workDirectionId === selectedDirectionId);
            return { ...column, tasks, count: tasks.length };
        });
        const statusColumns = !selectedStatusKey || selectedStatusId ? directionColumns : directionColumns.filter((column) => {
            const value = column.statusId || column.statusCode;

            return value === selectedStatusKey;
        });

        if (!search.trim()) return statusColumns;

        return statusColumns.map((column) => {
            const tasks = column.tasks.filter((task) => taskMatchesMaterialSearch(task, search, locale));
            return { ...column, tasks, count: tasks.length };
        });
    }, [columns, locale, search, selectedDirectionId, selectedStatusId, selectedStatusKey]);

    const visibleTaskCount = visibleColumns.reduce(
        (count, column) => count + column.tasks.length,
        0
    );
    const hasFilters = Boolean(
        search.trim() || workTypeCode.trim() || selectedStatusKey || selectedDirectionId
    );

    const handleStatusChange = (value: string) => {
        const option = statusOptions.find((item) => item.value === value);

        setSelectedStatusKey(value);
        setSelectedStatusId(option?.statusId);
        setSelectedStatusLabel(option?.label ?? '');
    };

    const resetFilters = () => {
        setSearch('');
        setWorkTypeCode('');
        setSelectedStatusKey('');
        setSelectedStatusId(undefined);
        setSelectedStatusLabel('');
        setSelectedDirectionId('');
    };

    const selectedDirection = directionOptions.find((direction) => direction.id === selectedDirectionId);
    const visibleRecentCompleted = (data?.recentCompletedTasks ?? []).filter(
        (task) => !selectedDirection || task.workDirectionName === selectedDirection.name
    );
    const isDirectionForbidden = isWorkDirectionAccessError(dashboardError);

    if (dispatcherDirectionsPending) {
        return <DashboardSkeleton />;
    }

    if (dispatcherHasNoDirections) {
        return (
            <div className="mx-auto max-w-3xl py-10">
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <h1 className="text-lg font-black text-amber-900">{t('noAssignedDirections')}</h1>
                    <p className="mt-2 text-sm text-amber-800">{t('noAssignedDirectionsHint')}</p>
                </section>
            </div>
        );
    }

    if (usersQuery.isError) {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                <p className="font-semibold">{t('profileLoadError')}</p>
                <button type="button" onClick={() => void usersQuery.refetch()} className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-bold text-white">{tCommon('retry')}</button>
            </section>
        );
    }

    return (
        <div className="mx-auto max-w-[1920px] space-y-5 pb-6">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                        {t('title')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    {isFetching && !isLoading
                        ? t('updating')
                        : t('shownTasks', {count: format.number(visibleTaskCount)})}
                </div>
            </header>

            <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-lg border bg-white p-3">Без исполнителя: {data?.unassignedTasksCount??0}</span><span className="rounded-lg border bg-amber-50 p-3" title="Календарное время, включая ожидание">На этапе 3 дня и дольше: {data?.stalledTasksCount??0}</span></div>
            {isLoading ? (
                <DashboardSkeleton />
            ) : (
                <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <MetricCard
                        label={t('metrics.total')}
                        value={data?.totalTasksCount ?? 0}
                        accentClassName="bg-slate-500"
                        toneClassName="text-slate-900"
                    />
                    <MetricCard
                        label={t('metrics.inProgress')}
                        value={data?.inProgressTasksCount ?? 0}
                        accentClassName="bg-blue-500"
                        toneClassName="text-blue-700"
                    />
                    <MetricCard
                        label={t('metrics.review')}
                        value={data?.onReviewTasksCount ?? 0}
                        accentClassName="bg-violet-500"
                        toneClassName="text-violet-700"
                    />
                    <MetricCard
                        label={t('metrics.overdue')}
                        value={data?.overdueTasksCount ?? 0}
                        accentClassName="bg-red-500"
                        toneClassName="text-red-700"
                    />
                </section>
            )}

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="mb-4 border-b border-slate-100 pb-4">
                    <p className="mb-2 text-xs font-bold text-slate-500">{t('filters.workDirection')}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedDirectionId('')}
                            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${!selectedDirectionId ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}
                        >
                            {isAdmin ? t('filters.allDirections') : t('filters.allMine')}
                        </button>
                        {directionOptions.map((direction) => (
                            <button
                                key={direction.id}
                                type="button"
                                onClick={() => setSelectedDirectionId(direction.id)}
                                className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selectedDirectionId === direction.id ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}
                            >
                                {direction.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_auto]">
                    <label className="block">
                        <span className="mb-1 block text-xs font-bold text-slate-500">
                            {t('filters.search')}
                        </span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('filters.searchPlaceholder')}
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-bold text-slate-500">
                            {t('filters.workTypeCode')}
                        </span>
                        <select
                            value={workTypeCode}
                            onChange={(event) => setWorkTypeCode(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        >
                            <option value="">{t('filters.allWorkTypes')}</option>
                            {(workTypesQuery.data ?? []).filter((workType) => workType.isActive).map((workType) => (
                                <option key={workType.id} value={workType.code}>{workType.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-bold text-slate-500">
                            {t('filters.status')}
                        </span>
                        <select
                            value={selectedStatusKey}
                            onChange={(event) => handleStatusChange(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        >
                            <option value="">{t('filters.allStatuses')}</option>
                            {visibleStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={resetFilters}
                            disabled={!hasFilters}
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 lg:w-auto"
                        >
                            {t('filters.reset')}
                        </button>
                    </div>
                </div>
            </section>

            {data?.cardsTruncated && (
                <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    {t('cardsTruncated')}
                </section>
            )}

            {isDirectionForbidden && (
                <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    <p className="font-semibold">{t('directionForbidden')}</p>
                </section>
            )}

            {isError && !isDirectionForbidden && (
                <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold">
                            {t('loadError')}
                        </p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
                        >
                            {tCommon('retry')}
                        </button>
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div>
                        <div className="flex items-center gap-2.5"><h2 className="text-sm font-bold text-slate-900">{t('productionFlow')}</h2><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{t('stagesCount', {count: visibleColumns.length})}</span></div>
                        <p className="mt-1 text-xs text-slate-400">{t('tasksByStatus')}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-[10px] text-slate-400">{t('visibleTasks')}</span><strong className="ml-2 text-sm text-slate-900">{format.number(visibleTaskCount)}</strong></div>
                        {hasFilters && <span className="rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-700">{t('filters.active')}</span>}
                        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setFlowView('compact')}
                                className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition ${flowView === 'compact' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {t('compact')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlowView('kanban')}
                                className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition ${flowView === 'kanban' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {t('columns')}
                            </button>
                        </div>
                    </div>
                </div>

                {flowView === 'compact' ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleColumns.map((column, index) => {
                            const theme = getColumnTheme(index);
                            const visibleTasks = column.tasks.slice(0, 5);
                            const hiddenCount = Math.max(0, column.tasks.length - visibleTasks.length);

                            return (
                                <section
                                    key={column.statusId || column.statusCode || column.statusName}
                                    className={`min-w-0 overflow-hidden rounded-2xl border bg-slate-50/80 shadow-sm dark:bg-slate-950/70 dark:shadow-black/20 ${theme.border}`}
                                >
                                    <header className={`border-b border-slate-200 bg-gradient-to-r ${theme.glow} to-white px-3 py-2.5 dark:border-slate-800 dark:to-slate-900`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{column.statusName || column.statusCode}</h3>
                                                    <p className="truncate text-[9px] uppercase tracking-wider text-slate-400">{column.statusCode}</p>
                                                </div>
                                            </div>
                                            <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${theme.badge}`}>{format.number(column.count)}</span>
                                        </div>
                                    </header>
                                    <div className="space-y-1.5 p-2">
                                        {visibleTasks.map((task) => <CompactTaskCard key={task.id} task={task} />)}
                                        {visibleTasks.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-7 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-500">{t('noTasks')}</div>
                                        )}
                                    </div>
                                    {hiddenCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleStatusChange(column.statusId || column.statusCode);
                                                setFlowView('kanban');
                                            }}
                                            className="w-full border-t border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-50 dark:border-slate-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-500/10"
                                        >
                                            {t('showMoreTasks', {count: hiddenCount})}
                                        </button>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                <div className="overflow-x-auto pb-3">
                <div className="flex min-w-max snap-x snap-mandatory gap-3 pb-2">
                    {visibleColumns.map((column, index) => {
                        const theme = getColumnTheme(index);
                        return (
                        <div
                            key={column.statusId || column.statusCode || column.statusName}
                            className={`flex h-[min(680px,72dvh)] w-[16.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-slate-50 shadow-sm dark:bg-slate-950 2xl:w-[17rem] ${theme.border}`}
                        >
                            <div className={`sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-br ${theme.glow} to-white p-3 backdrop-blur dark:border-slate-700 dark:to-slate-900`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className={`h-3 w-3 shrink-0 rounded-full shadow-sm ring-4 ring-white dark:ring-slate-800 ${theme.dot}`} />
                                        <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                                            {column.statusName || column.statusCode}
                                        </h2>
                                        {column.statusCode && (
                                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                                                {column.statusCode}
                                            </p>
                                        )}</div>
                                    </div>

                                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${theme.badge}`}>
                                        {format.number(column.count)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
                                {column.tasks.length === 0 ? (
                                    <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-500">
                                        {t('noTasksAtStage')}
                                    </div>
                                ) : (
                                    column.tasks.map((task) => (
                                        <TaskCard key={task.id} task={task} />
                                    ))
                                )}
                            </div>
                        </div>
                    );})}
                </div>
                </div>
                )}

                {!isLoading && !isError && visibleColumns.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">
                        {t('noFilteredTasks')}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900">
                            {t('recentCompleted')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {t('completedTotal', {count: format.number(data?.totalCompletedCount ?? 0)})}
                        </p>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {visibleRecentCompleted.length === 0 ? (
                        <div className="p-6 text-sm text-slate-400">
                            {t('noCompleted')}
                        </div>
                    ) : (
                        visibleRecentCompleted.map((task) => (
                            <div
                                key={task.id}
                                className="grid grid-cols-1 gap-3 p-4 text-sm md:grid-cols-[1.3fr_1fr_1fr_1fr] md:items-center"
                            >
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900">
                                        {task.workTypeName || t('completedTaskFallback')}
                                    </p>
                                    <p className="mt-1 text-xs text-blue-600">
                                        {t('order', {number: task.orderNumber || t('orderMissing')})}
                                    </p>
                                    {task.workDirectionName && (
                                        <div className="mt-2">
                                            <WorkDirectionBadge
                                                code={directionOptions.find((direction) => direction.name === task.workDirectionName)?.code ?? task.workDirectionName}
                                                name={task.workDirectionName}
                                            />
                                        </div>
                                    )}
                                </div>

                                <p className="text-slate-600">
                                    {task.patientName || t('patientMissing')}
                                </p>

                                <p className="text-slate-600">
                                    {task.technicianName || t('technicianNotSpecified')}
                                </p>

                                <p className="text-left font-semibold text-emerald-700 md:text-right">
                                    {task.completedAt
                                        ? format.dateTime(task.completedAt, {day: 'numeric', month: 'short'})
                                        : t('dateMissing')}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
