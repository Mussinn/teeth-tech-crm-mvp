'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import EmployeeAnalyticsPanel from '@/src/components/analytics/EmployeeAnalyticsPanel';
import ErrorState from '@/src/components/ui/ErrorState';
import { mockTasksByEmployee } from '@/src/mock/employeeTasks';
import { useGetUsersQuery } from '@/src/services/api/usersApi';
import type {
    EmployeeRole,
    EmployeeStatus,
    EmployeeTask,
    TaskStatus,
} from '@/src/types/employee.types';
import { mapUserToEmployee } from '@/src/utils/employeesUtils';
import { useAppFormatters } from '@/src/i18n/provider';

type ProfileTab = 'overview' | 'analytics';

function getRoleBadge(role: EmployeeRole) {
    switch (role) {
        case 'TECHNICIAN':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'OPERATOR':
            return 'border-violet-200 bg-violet-50 text-violet-700';
        case 'DISPATCHER':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        default:
            return 'border-slate-200 bg-slate-100 text-slate-700';
    }
}

function getStatusBadge(status: EmployeeStatus) {
    return status === 'ACTIVE'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-100 text-slate-500';
}

function getTaskStatusBadge(status: TaskStatus) {
    switch (status) {
        case 'MODELING':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'MILLING':
            return 'border-violet-200 bg-violet-50 text-violet-700';
        case 'POST_PROCESSING':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'DONE':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        default:
            return 'border-slate-200 bg-slate-100 text-slate-700';
    }
}

function getPriorityMeta(priority: EmployeeTask['priority']) {
    const meta = {
        LOW: { className: 'bg-slate-100 text-slate-600' },
        MEDIUM: { className: 'bg-blue-50 text-blue-700' },
        HIGH: { className: 'bg-amber-50 text-amber-700' },
        URGENT: { className: 'bg-red-50 text-red-700' },
    };
    return meta[priority];
}

function OverviewStat({ label, value, caption, tone = 'slate' }: {
    label: string;
    value: string | number;
    caption: string;
    tone?: 'slate' | 'blue' | 'red' | 'emerald';
}) {
    const valueTone = {
        slate: 'text-slate-950',
        blue: 'text-blue-700',
        red: 'text-red-600',
        emerald: 'text-emerald-600',
    }[tone];

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${valueTone}`}>{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{caption}</p>
        </div>
    );
}

export default function EmployeeDetailsPage() {
    const t = useTranslations('employees.detail');
    const formats = useAppFormatters();
    const formatDate = (value: string) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? value
            : formats.date(parsed, {day: '2-digit', month: 'short', year: 'numeric'});
    };
    const params = useParams<{ id: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
    const { data: users = [], isLoading, isFetching, isError, refetch } = useGetUsersQuery();

    const employee = useMemo(() => {
        const user = users.find((item) => item.id === id);
        return user ? mapUserToEmployee(user) : undefined;
    }, [id, users]);

    const tasks = useMemo(() => mockTasksByEmployee[id] ?? [], [id]);

    if (isLoading) {
        return (
            <div className="space-y-4" aria-busy="true">
                <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
                <div className="grid gap-4 md:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <ErrorState title={t('unavailable')} onRetry={() => void refetch()} isRetrying={isFetching}>
                {t('loadError')}
            </ErrorState>
        );
    }

    if (!employee) {
        return (
            <ErrorState title={t('notFound')}>
                <div className="space-y-4">
                    <p>{t('notFoundHint')}</p>
                    <Link href="/employees" className="inline-flex text-sm font-semibold text-blue-600 hover:underline">
                        {t('back')}
                    </Link>
                </div>
            </ErrorState>
        );
    }

    const doneTasks = tasks.filter((task) => task.status === 'DONE').length;
    const activeTasks = tasks.filter((task) => task.status !== 'DONE').length;
    const urgentTasks = tasks.filter((task) => task.priority === 'URGENT').length;
    const onTimeRate = employee.stats.onTimeRate ?? employee.stats.timelyPercent ?? 0;
    const averageDays = employee.stats.averageDays ?? employee.stats.avgDays ?? 0;

    return (
        <div className="space-y-5 pb-6">
            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
                <div className="p-5 sm:p-6">
                    <Link href="/employees" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600 hover:text-blue-700">
                        {t('employees')}
                    </Link>

                    <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700 sm:h-20 sm:w-20 sm:text-3xl">
                                {employee.name.trim().charAt(0).toUpperCase() || t('avatarFallback')}
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{employee.name}</h1>
                                <p className="mt-1 truncate text-sm text-slate-500">{employee.specialization || t('specializationMissing')}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoleBadge(employee.role)}`}>
                                        {employee.role === 'TECHNICIAN' || employee.role === 'OPERATOR' || employee.role === 'DISPATCHER' || employee.role === 'ADMIN'
                                            ? t(`roles.${employee.role}`)
                                            : employee.role}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadge(employee.status)}`}>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        {employee.status === 'ACTIVE' ? t('statuses.ACTIVE') : t('statuses.INACTIVE')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:flex">
                            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center sm:min-w-28">
                                <p className="text-2xl font-bold text-slate-950">{employee.stats.inProgress}</p>
                                <p className="text-xs text-slate-500">{t('inWork')}</p>
                            </div>
                            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center sm:min-w-28">
                                <p className="text-2xl font-bold text-emerald-700">{onTimeRate}%</p>
                                <p className="text-xs text-emerald-700/70">{t('onTime')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 border-t border-slate-200 bg-slate-50 px-3 pt-2 sm:px-5" role="tablist" aria-label={t('tabsAria')}>
                    {([
                        { id: 'overview' as const, label: t('overview') },
                        { id: 'analytics' as const, label: t('analytics') },
                    ]).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative rounded-t-lg px-4 py-3 text-sm font-semibold transition ${
                                activeTab === tab.id ? 'bg-white text-blue-700' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600" />}
                        </button>
                    ))}
                </div>
            </header>

            {activeTab === 'analytics' ? (
                <EmployeeAnalyticsPanel employee={employee} tasks={tasks} />
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <OverviewStat label={t('completed')} value={employee.stats.completed} caption={t('completedHint')} tone="emerald" />
                        <OverviewStat label={t('inProgress')} value={employee.stats.inProgress} caption={t('inProgressHint')} tone="blue" />
                        <OverviewStat label={t('overdue')} value={employee.stats.overdue} caption={t('overdueHint')} tone={employee.stats.overdue > 0 ? 'red' : 'slate'} />
                        <OverviewStat label={t('average')} value={`${averageDays} ${t('days')}`} caption={t('averageHint')} />
                    </section>

                    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                                <div>
                                    <h2 className="font-bold text-slate-950">{t('tasksTitle')}</h2>
                                    <p className="mt-1 text-xs text-slate-500">{t('tasksHint')}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tasks.length}</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px] text-left">
                                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        <tr>
                                            <th className="px-5 py-3">{t('columns.order')}</th>
                                            <th className="px-5 py-3">{t('columns.patientWork')}</th>
                                            <th className="px-5 py-3">{t('columns.material')}</th>
                                            <th className="px-5 py-3">{t('columns.deadline')}</th>
                                            <th className="px-5 py-3">{t('columns.status')}</th>
                                            <th className="px-5 py-3">{t('columns.priority')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tasks.map((task) => {
                                            const priority = getPriorityMeta(task.priority);
                                            return (
                                                <tr key={task.id} className="transition hover:bg-slate-50/80">
                                                    <td className="px-5 py-4 text-sm font-mono font-medium text-slate-500">{task.id}</td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-semibold text-slate-900">{task.patient}</p>
                                                        <p className="mt-1 text-xs text-slate-500">{task.workType}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{task.material}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{formatDate(task.deadline)}</td>
                                                    <td className="px-5 py-4">
                                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTaskStatusBadge(task.status)}`}>
                                                            {t(`stages.${task.status}`)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priority.className}`}>{t(`priorities.${task.priority}`)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {tasks.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">{t('noTasks')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="font-bold text-slate-950">{t('contacts')}</h2>
                                <div className="mt-5 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('phone')}</p>
                                        <p className="mt-1 break-words text-sm font-medium text-slate-700">{employee.phone || t('unspecified')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</p>
                                        <p className="mt-1 break-all text-sm font-medium text-slate-700">{employee.email || t('unspecified')}</p>
                                    </div>
                                    {employee.joinedAt && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('joined')}</p>
                                            <p className="mt-1 text-sm font-medium text-slate-700">{employee.joinedAt}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="font-bold text-slate-950">{t('summary')}</h2>
                                    <button type="button" onClick={() => setActiveTab('analytics')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                                        {t('details')} →
                                    </button>
                                </div>
                                <div className="mt-4 divide-y divide-slate-100">
                                    {[
                                        [t('activeTasks'), activeTasks],
                                        [t('doneListed'), doneTasks],
                                        [t('urgentTasks'), urgentTasks],
                                        [t('completedOnTime'), `${onTimeRate}%`],
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                                            <span className="text-sm text-slate-500">{label}</span>
                                            <span className="text-sm font-bold text-slate-950">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
