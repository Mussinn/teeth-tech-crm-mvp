'use client';

import type { Employee, EmployeeTask, TaskStatus } from '@/src/types/employee.types';
import {useTranslations} from 'next-intl';

type EmployeeAnalyticsPanelProps = {
    employee: Employee;
    tasks: EmployeeTask[];
};

const statusMeta: Record<TaskStatus, { color: string; bar: string }> = {
    TODO: { color: '#94a3b8', bar: 'bg-slate-400' },
    MODELING: { color: '#2563eb', bar: 'bg-blue-600' },
    MILLING: { color: '#7c3aed', bar: 'bg-violet-600' },
    POST_PROCESSING: { color: '#f59e0b', bar: 'bg-amber-500' },
    DONE: { color: '#10b981', bar: 'bg-emerald-500' },
};

function MetricCard({
    label,
    value,
    caption,
    tone = 'slate',
}: {
    label: string;
    value: string | number;
    caption: string;
    tone?: 'slate' | 'blue' | 'amber' | 'emerald';
}) {
    const tones = {
        slate: 'bg-slate-100 text-slate-700',
        blue: 'bg-blue-50 text-blue-700',
        amber: 'bg-amber-50 text-amber-700',
        emerald: 'bg-emerald-50 text-emerald-700',
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${tones[tone]}`} aria-hidden="true">
                {tone === 'emerald' ? '✓' : tone === 'amber' ? '!' : tone === 'blue' ? '↗' : '•'}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{caption}</p>
        </div>
    );
}

export default function EmployeeAnalyticsPanel({ employee, tasks }: EmployeeAnalyticsPanelProps) {
    const t = useTranslations('analytics.employee');
    const tStages = useTranslations('analytics.stages.codes');
    const getStatusLabel = (status: TaskStatus) => {
        switch (status) {
            case 'TODO': return tStages('TODO');
            case 'MODELING': return tStages('MODELING');
            case 'MILLING': return tStages('MILLING');
            case 'POST_PROCESSING': return tStages('POST_PROCESSING');
            case 'DONE': return tStages('DONE');
        }
    };
    const completed = employee.stats.completed ?? 0;
    const inProgress = employee.stats.inProgress ?? 0;
    const overdue = employee.stats.overdue ?? 0;
    const total = employee.stats.totalTasks ?? employee.stats.totalAssigned ?? completed + inProgress;
    const onTimeRate = employee.stats.onTimeRate ?? employee.stats.timelyPercent ?? 0;
    const averageDays = employee.stats.averageDays ?? employee.stats.avgDays ?? 0;
    const urgentTasks = tasks.filter((task) => task.priority === 'URGENT').length;

    const statusData = (Object.keys(statusMeta) as TaskStatus[])
        .map((status) => ({
            status,
            name: getStatusLabel(status),
            value: tasks.filter((task) => task.status === status).length,
            color: statusMeta[status].color,
        }))
        .filter((item) => item.value > 0);

    const taskTotal = tasks.length;
    let gradientCursor = 0;
    const statusGradient = statusData.length > 0
        ? `conic-gradient(${statusData.map((item) => {
            const start = gradientCursor;
            gradientCursor += taskTotal > 0 ? (item.value / taskTotal) * 100 : 0;
            return `${item.color} ${start}% ${gradientCursor}%`;
        }).join(', ')})`
        : 'conic-gradient(#e2e8f0 0 100%)';
    const qualityTone = onTimeRate >= 90 ? 'text-emerald-600' : onTimeRate >= 75 ? 'text-amber-600' : 'text-red-600';
    const qualityTrack = onTimeRate >= 90 ? '#10b981' : onTimeRate >= 75 ? '#f59e0b' : '#ef4444';
    const gaugeRadius = 54;
    const gaugeLength = 2 * Math.PI * gaugeRadius;
    const gaugeOffset = gaugeLength * (1 - Math.min(Math.max(onTimeRate, 0), 100) / 100);

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={t('total')} value={total} caption={t('totalCaption')} />
                <MetricCard label={t('completed')} value={completed} caption={t('completedCaption')} tone="emerald" />
                <MetricCard label={t('inProgress')} value={inProgress} caption={t('inProgressCaption')} tone="blue" />
                <MetricCard label={t('overdue')} value={overdue} caption={t('overdueCaption')} tone={overdue > 0 ? 'amber' : 'slate'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-950">{t('structure')}</h2>
                        <p className="mt-1 text-sm text-slate-500">{t('structureSubtitle')}</p>
                    </div>

                    {statusData.length > 0 ? (
                        <div className="mt-6 grid items-center gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
                            <div
                                className="relative mx-auto h-[184px] w-[184px] rounded-full shadow-inner sm:h-[210px] sm:w-[210px]"
                                style={{ background: statusGradient }}
                                role="img"
                                aria-label={t('distribution', {count: taskTotal})}
                            >
                                <div className="absolute inset-[25%] rounded-full bg-white shadow-sm" />
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-slate-950">{taskTotal}</span>
                                    <span className="text-xs text-slate-400">{t('inList')}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {statusData.map((item) => {
                                    const share = taskTotal > 0 ? (item.value / taskTotal) * 100 : 0;
                                    return (
                                        <div key={item.status}>
                                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                                    <span className="truncate font-medium text-slate-700">{item.name}</span>
                                                </div>
                                                <span className="font-bold text-slate-950">{item.value}</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: item.color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                            {t('noCurrentTasks')}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('deadlines')}</p>
                            <h2 className="mt-2 text-xl font-bold">{t('quality')}</h2>
                        </div>
                        <span className={`rounded-full bg-white px-2.5 py-1 text-xs font-bold ${qualityTone}`}>KPI</span>
                    </div>

                    <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
                        <div className="relative h-40 w-40 shrink-0">
                            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
                                <circle cx="64" cy="64" r={gaugeRadius} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="11" />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r={gaugeRadius}
                                    fill="none"
                                    stroke={qualityTrack}
                                    strokeWidth="11"
                                    strokeLinecap="round"
                                    strokeDasharray={gaugeLength}
                                    strokeDashoffset={gaugeOffset}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold">{onTimeRate}%</span>
                                <span className="text-xs text-slate-400">{t('onTime')}</span>
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            <div className="rounded-xl bg-white/5 p-4">
                                <p className="text-xs text-slate-400">{t('averageDuration')}</p>
                                <p className="mt-1 text-xl font-bold">{averageDays}</p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-4">
                                <p className="text-xs text-slate-400">{t('overdueTasks')}</p>
                                <p className="mt-1 text-xl font-bold">{overdue}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-950">{t('managerSignals')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('managerSignalsSubtitle')}</p>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    <div className={`rounded-xl border p-4 ${overdue > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <p className={`text-sm font-bold ${overdue > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {overdue > 0 ? t('deadlineRisk') : t('deadlinesControlled')}
                        </p>
                        <p className={`mt-1 text-xs leading-5 ${overdue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {overdue > 0 ? t('overdueAdvice', {count: overdue}) : t('noOverdue')}
                        </p>
                    </div>

                    <div className={`rounded-xl border p-4 ${urgentTasks > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-sm font-bold ${urgentTasks > 0 ? 'text-red-900' : 'text-slate-800'}`}>
                            {urgentTasks > 0 ? t('urgentQueue') : t('noUrgent')}
                        </p>
                        <p className={`mt-1 text-xs leading-5 ${urgentTasks > 0 ? 'text-red-700' : 'text-slate-600'}`}>
                            {urgentTasks > 0 ? t('urgentAdvice', {count: urgentTasks}) : t('noUrgentDescription')}
                        </p>
                    </div>

                    <div className={`rounded-xl border p-4 ${onTimeRate >= 90 ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
                        <p className={`text-sm font-bold ${onTimeRate >= 90 ? 'text-emerald-900' : 'text-blue-900'}`}>
                            {onTimeRate >= 90 ? t('highDiscipline') : t('kpiImprovement')}
                        </p>
                        <p className={`mt-1 text-xs leading-5 ${onTimeRate >= 90 ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {onTimeRate >= 90 ? t('highDisciplineDescription') : t('currentOnTimeRate', {rate: onTimeRate})}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
