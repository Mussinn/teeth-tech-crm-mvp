'use client';

import Link from 'next/link';
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useGetTasksDashboardQuery} from '@/src/services/api/tasksDashboardApi';
import ErrorState from '@/src/components/ui/ErrorState';
import ProductionCharts from '@/src/components/analytics/ProductionCharts';
import AppIcon from '@/src/components/ui/AppIcon';

export default function AnalyticsPage() {
    const t = useTranslations('analytics.board');
    const {data, isLoading, isFetching, isError, refetch} = useGetTasksDashboardQuery(undefined, {pollingInterval: 60000, skipPollingIfUnfocused: true});
    const [focus, setFocus] = useState<'all' | 'overdue' | 'unassigned' | 'stalled'>('all');
    if (isLoading) return <div aria-busy="true" className="space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /></div>;
    if (isError || !data) return <ErrorState title={t('error')} onRetry={() => void refetch()} isRetrying={isFetching}>{t('errorHelp')}</ErrorState>;
    const stages = data.columns.filter(column => column.count > 0).map(column => ({name: column.statusName, count: column.count}));
    const attention = (data.attentionTasks ?? []).filter(task => focus === 'all' || (focus === 'overdue' && task.isOverdue) || (focus === 'unassigned' && task.unassigned) || (focus === 'stalled' && task.stageDays >= 3));
    const metrics = [
        {label: t('active'), value: data.totalTasksCount, help: t('activeHelp'), color: 'text-violet-600'},
        {label: t('overdue'), value: data.overdueTasksCount, help: t('overdueHelp'), color: 'text-rose-600'},
        {label: t('today'), value: data.dueTodayCount ?? 0, help: t('soon', {count: data.dueSoonCount ?? 0}), color: 'text-amber-600'},
        {label: t('review'), value: data.onReviewTasksCount, help: t('reviewHelp'), color: 'text-sky-600'},
        {label: t('completedMonth'), value: data.completedThisMonth ?? 0, help: t('completedHelp'), color: 'text-emerald-600'},
        {label: t('average'), value: data.averageCompletionDays ?? 0, help: t('averageHelp'), color: 'text-slate-700 dark:text-slate-200'},
    ];
    return <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-600">{t('eyebrow')}</p><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t('title')}</h1><p className="mt-2 text-sm text-slate-500">{t('subtitle')}</p></div><div className="flex gap-2"><Link href="/kpi" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 dark:bg-slate-900"><AppIcon name="kpi" className="h-4 w-4" />{t('kpi')}</Link><button onClick={() => void refetch()} disabled={isFetching} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isFetching ? t('refreshing') : t('refresh')}</button></div></header>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(metric => <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-slate-500">{metric.label}</p><p className={`mt-3 text-4xl font-bold tracking-tight ${metric.color}`}>{metric.value}</p><p className="mt-3 text-xs text-slate-500">{metric.help}</p></article>)}</section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800"><div><h2 className="font-bold text-slate-900 dark:text-white">{t('attention')}</h2><p className="mt-1 text-xs text-slate-500">{t('attentionHelp')}</p></div><div className="flex flex-wrap gap-2">{(['all', 'overdue', 'unassigned', 'stalled'] as const).map(value => <button key={value} onClick={() => setFocus(value)} aria-pressed={focus === value} className={`rounded-lg px-3 py-2 text-xs font-semibold ${focus === value ? 'bg-violet-100 text-violet-700' : 'bg-slate-50 text-slate-500 dark:bg-slate-800'}`}>{t(value)}{value === 'unassigned' ? ` · ${data.unassignedTasksCount ?? 0}` : value === 'stalled' ? ` · ${data.stalledTasksCount ?? 0}` : ''}</button>)}</div></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{attention.length ? attention.map(task => <Link key={task.id} href={`/orders/${task.orderId}`} className="grid gap-3 p-4 transition hover:bg-violet-50/50 sm:grid-cols-[1.3fr_1fr_1fr] dark:hover:bg-slate-800"><div><p className="text-sm font-bold text-violet-700">{task.orderNumber} · {task.workTypeName}</p><p className="mt-1 text-xs text-slate-500">{task.clinicName}</p></div><div><p className="text-sm text-slate-700 dark:text-slate-300">{task.statusName}</p><p className="mt-1 text-xs text-slate-500">{task.technicianName} · {t('stageDays', {count: task.stageDays})}</p></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="text-xs text-slate-500">{task.deadline ?? t('noDeadline')}</span>{task.isOverdue && <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">{t('overdue')}</span>}{task.unassigned && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{t('unassigned')}</span>}</div></Link>) : <p className="p-8 text-center text-sm text-slate-500">{t('clear')}</p>}</div></section>
        <ProductionCharts stages={stages} team={data.technicianLoads ?? []} clinics={data.clinicLoads ?? []} materials={data.materialLoads ?? []}/>
        <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-violet-50 p-4 text-xs text-violet-700 dark:bg-violet-950/40"><span>{t('note')}</span><Link href="/" className="font-bold underline">{t('production')}</Link></div>
    </div>;
}
