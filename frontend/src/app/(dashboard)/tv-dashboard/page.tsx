'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useAppTheme } from '@/src/hooks/useAppTheme';
import { useAppFormatters, useAppLocale } from '@/src/i18n/provider';
import { useGetTasksDashboardQuery } from '@/src/services/api/tasksDashboardApi';
import type { TaskDashboardTask } from '@/src/types/task.types';

const COLUMNS_PER_SCREEN = 5;
const TASKS_PER_COLUMN = 8;
const SCREEN_ROTATION_MS = 15_000;

const columnThemes = [
    { line: 'bg-slate-400', badge: 'bg-slate-700', glow: 'from-slate-500/15' },
    { line: 'bg-blue-400', badge: 'bg-blue-600', glow: 'from-blue-500/15' },
    { line: 'bg-cyan-400', badge: 'bg-cyan-600', glow: 'from-cyan-500/15' },
    { line: 'bg-amber-400', badge: 'bg-amber-500', glow: 'from-amber-500/15' },
    { line: 'bg-violet-400', badge: 'bg-violet-600', glow: 'from-violet-500/15' },
    { line: 'bg-emerald-400', badge: 'bg-emerald-600', glow: 'from-emerald-500/15' },
];

function formatDeadline(value: string | null, locale: string, labels: {noDeadline: string; today: string; tomorrow: string}) {
    if (!value) return labels.noDeadline;
    const source = value.includes('T') ? value : `${value}T23:59:59`;
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return value;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dateKey = date.toDateString();
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);

    if (dateKey === today.toDateString()) return `${labels.today} · ${time}`;
    if (dateKey === tomorrow.toDateString()) return `${labels.tomorrow} · ${time}`;
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

function maskPatient(name: string, fallback: string) {
    const parts = name.trim().split(/\s+/u).filter(Boolean);
    if (!parts.length) return fallback;
    return `${parts[0]}${parts[1]?.[0] ? ` ${parts[1][0]}.` : ''}`;
}

function shortOrder(task: TaskDashboardTask) {
    return task.orderNumber || task.orderId.slice(0, 8);
}

function TvTaskCard({
    task,
    light,
    labels,
    locale,
}: {
    task: TaskDashboardTask;
    light: boolean;
    locale: string;
    labels: {
        noDeadline: string;
        today: string;
        tomorrow: string;
        patientMissing: string;
        order: (number: string) => string;
        technicalWork: string;
        overdue: string;
        teeth: (numbers: string) => string;
        items: (count: number) => string;
    };
}) {
    return (
        <article className={`relative overflow-hidden rounded-xl border px-3 py-2.5 shadow-sm transition ${light ? 'bg-white shadow-slate-200/60' : 'bg-slate-900/80'} ${task.isOverdue ? 'border-red-400' : light ? 'border-slate-200' : 'border-slate-700'}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${task.isOverdue ? 'bg-red-500' : 'bg-violet-500'}`} />
            <div className="flex items-start justify-between gap-2 pl-1">
                <div className="min-w-0">
                    <p className={`truncate text-[10px] font-black uppercase tracking-wider ${light ? 'text-violet-600' : 'text-violet-300'}`}>{labels.order(shortOrder(task))}</p>
                    <h3 className={`mt-0.5 truncate text-sm font-black ${light ? 'text-slate-900' : 'text-white'}`}>{task.workTypeName || labels.technicalWork}</h3>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-black ${task.isOverdue ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                    {task.isOverdue ? labels.overdue : formatDeadline(task.deadline, locale, labels)}
                </span>
            </div>
            <div className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 pl-1 text-[10px] ${light ? 'border-slate-100' : 'border-slate-700/70'}`}>
                <span className={`min-w-0 truncate font-bold ${light ? 'text-slate-600' : 'text-slate-300'}`}>{maskPatient(task.patientName, labels.patientMissing)}</span>
                <span className={`shrink-0 ${light ? 'text-slate-400' : 'text-slate-500'}`}>{task.toothNumbers.length ? labels.teeth(task.toothNumbers.join(', ')) : labels.items(task.quantity)}</span>
            </div>
        </article>
    );
}

function Metric({
    label,
    value,
    tone,
    light,
}: {
    label: string;
    value: string;
    tone: string;
    light: boolean;
}) {
    return (
        <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 ${light ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[.06]'}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_16px_currentColor] sm:h-3 sm:w-3 ${tone}`} />
            <div className="min-w-0"><p className="truncate text-[9px] font-black uppercase tracking-wider text-slate-400 sm:text-[10px]">{label}</p><p className={`text-xl font-black leading-none sm:text-3xl ${light ? 'text-slate-950' : 'text-white'}`}>{value}</p></div>
        </div>
    );
}

export default function TvDashboardPage() {
    const t = useTranslations('tvDashboard');
    const formats = useAppFormatters();
    const { locale } = useAppLocale();
    const [now, setNow] = useState(() => new Date());
    const [screen, setScreen] = useState(0);
    const [rotationCycle, setRotationCycle] = useState(0);
    const { theme, setTheme } = useAppTheme();
    const light = theme === 'light';
    const { data, isLoading, isError, isFetching, refetch } = useGetTasksDashboardQuery(undefined, {
        pollingInterval: 30_000,
        refetchOnFocus: true,
        refetchOnReconnect: true,
    });
    const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
    const screenCount = Math.max(1, Math.ceil(columns.length / COLUMNS_PER_SCREEN));
    const safeScreen = screen % screenCount;
    const visibleColumns = columns.slice(safeScreen * COLUMNS_PER_SCREEN, (safeScreen + 1) * COLUMNS_PER_SCREEN);
    const overdueTasks = useMemo(
        () => columns.flatMap((column) => column.tasks.map((task) => ({ ...task, statusName: column.statusName }))).filter((task) => task.isOverdue),
        [columns],
    );

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (screenCount <= 1) return;
        const timer = window.setTimeout(() => {
            setScreen((current) => (current + 1) % screenCount);
            setRotationCycle((current) => current + 1);
        }, SCREEN_ROTATION_MS);
        return () => window.clearTimeout(timer);
    }, [rotationCycle, screenCount]);

    const selectScreen = (index: number) => {
        setScreen(index);
        setRotationCycle((current) => current + 1);
    };

    const openFullscreen = async () => {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
    };

    return (
        <div className={`fixed inset-0 z-[200] flex min-h-screen flex-col overflow-hidden transition-colors ${light ? 'bg-[#f4f6fb] text-slate-950' : 'bg-[#070b14] text-white'}`}>
            <header className={`shrink-0 border-b px-3 py-2 shadow-sm sm:px-5 sm:py-3 ${light ? 'border-slate-200 bg-white/95' : 'border-white/10 bg-slate-950/95'}`}>
                <div className="grid items-center gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-600/25 sm:h-11 sm:w-11 sm:rounded-2xl">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 sm:h-6 sm:w-6"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeWidth="1.8"/></svg>
                        </span>
                        <div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[.16em] sm:text-[10px] sm:tracking-[.2em] ${light ? 'text-violet-600' : 'text-violet-300'}`}>{t('eyebrow')}</p><h1 className="truncate text-base font-black sm:text-xl">{t('title')}</h1></div>
                    </div>

                    <div className="order-3 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:order-none">
                        <Metric light={light} label={t('metrics.total')} value={formats.number(data?.totalTasksCount ?? 0)} tone="bg-slate-400 text-slate-400" />
                        <Metric light={light} label={t('metrics.inProgress')} value={formats.number(data?.inProgressTasksCount ?? 0)} tone="bg-blue-500 text-blue-500" />
                        <Metric light={light} label={t('metrics.review')} value={formats.number(data?.onReviewTasksCount ?? 0)} tone="bg-violet-500 text-violet-500" />
                        <Metric light={light} label={t('metrics.overdue')} value={formats.number(data?.overdueTasksCount ?? 0)} tone="bg-red-500 text-red-500" />
                    </div>

                    <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
                        <div className="mr-auto min-w-0 sm:mr-0"><p className="text-lg font-black tabular-nums sm:text-2xl">{formats.dateTime(now, {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</p><p className="hidden truncate text-[10px] capitalize text-slate-400 sm:block">{formats.date(now, {weekday: 'long', day: 'numeric', month: 'long'})}</p></div>
                        <div className={`hidden rounded-xl border p-1 sm:flex ${light ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-white/5'}`}>
                            <button type="button" onClick={() => setTheme('light')} className={`rounded-lg px-2.5 py-2 text-[10px] font-black transition ${light ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`} aria-label={t('lightTheme')}>☀ {t('light')}</button>
                            <button type="button" onClick={() => setTheme('dark')} className={`rounded-lg px-2.5 py-2 text-[10px] font-black transition ${!light ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400'}`} aria-label={t('darkTheme')}>● {t('dark')}</button>
                        </div>
                        <button type="button" onClick={() => void openFullscreen()} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${light ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`} title={t('fullscreen')} aria-label={t('fullscreen')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" strokeWidth="2" strokeLinecap="round"/></svg></button>
                        <Link href="/" className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${light ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`} title={t('close')} aria-label={t('close')}>×</Link>
                    </div>
                </div>
            </header>

            {overdueTasks.length > 0 && (
                <div className={`flex shrink-0 items-center gap-3 overflow-x-auto border-b border-red-500/30 px-3 py-2 sm:px-5 ${light ? 'bg-red-50' : 'bg-red-950/50'}`}>
                    <span className="shrink-0 rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-black uppercase">{t('attention')}</span>
                    <div className="flex min-w-max flex-1 gap-6">
                        {overdueTasks.slice(0, 5).map((task) => (
                            <span key={task.id} className={`shrink-0 text-xs font-bold ${light ? 'text-red-800' : 'text-red-100'}`}>#{shortOrder(task)} · {task.workTypeName} · {task.statusName}</span>
                        ))}
                    </div>
                    <span className="shrink-0 text-[10px] text-red-300">{t('overdueCount', {count: overdueTasks.length})}</span>
                </div>
            )}

            <main className="min-h-0 flex-1 overflow-x-auto overscroll-x-contain p-3">
                {isLoading ? (
                    <div className="flex h-full min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className={`w-[calc(100vw-1.5rem)] shrink-0 animate-pulse rounded-2xl border sm:w-72 lg:w-auto ${light ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'}`} />)}</div>
                ) : isError ? (
                    <div className="flex h-full items-center justify-center"><div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-8 text-center"><p className="text-xl font-black">{t('loadError')}</p><button type="button" onClick={() => void refetch()} className="mt-4 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-black">{t('retry')}</button></div></div>
                ) : (
                    <div className="flex h-full min-w-max gap-3 lg:grid lg:min-w-0" style={{ gridTemplateColumns: `repeat(${Math.max(visibleColumns.length, 1)}, minmax(0, 1fr))` }}>
                        {visibleColumns.map((column, columnIndex) => {
                            const theme = columnThemes[(safeScreen * COLUMNS_PER_SCREEN + columnIndex) % columnThemes.length];
                            const hiddenCount = Math.max(0, column.tasks.length - TASKS_PER_COLUMN);
                            return (
                                <section key={column.statusId || column.statusCode} className={`flex w-[calc(100vw-1.5rem)] shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm sm:w-72 lg:w-auto lg:min-w-0 ${light ? 'border-slate-200 bg-[#eef1f6]' : 'border-slate-800 bg-slate-950/70'}`}>
                                    <header className={`relative shrink-0 overflow-hidden border-b bg-gradient-to-br ${theme.glow} to-transparent px-4 py-3 ${light ? 'border-slate-200 bg-white' : 'border-slate-800'}`}>
                                        <span className={`absolute inset-x-0 top-0 h-1 ${theme.line}`} />
                                        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-black">{column.statusName || column.statusCode}</h2><p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{column.statusCode}</p></div><span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-lg font-black text-white ${theme.badge}`}>{column.count}</span></div>
                                    </header>
                                    <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2">
                                        {column.tasks.slice(0, TASKS_PER_COLUMN).map((task) => <TvTaskCard key={task.id} task={task} light={light} locale={locale} labels={{noDeadline: t('noDeadline'), today: t('today'), tomorrow: t('tomorrow'), patientMissing: t('patientMissing'), order: (number) => t('order', {number}), technicalWork: t('technicalWork'), overdue: t('overdueUpper'), teeth: (numbers) => t('teeth', {numbers}), items: (count) => t('items', {count})}} />)}
                                        {column.tasks.length === 0 && <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-xs font-bold ${light ? 'border-slate-300 bg-white/50 text-slate-400' : 'border-slate-800 text-slate-600'}`}>{t('noTasks')}</div>}
                                    </div>
                                    {hiddenCount > 0 && <div className={`shrink-0 border-t px-3 py-2 text-center text-[10px] font-black text-slate-400 ${light ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'}`}>{t('moreTasks', {count: hiddenCount})}</div>}
                                </section>
                            );
                        })}
                    </div>
                )}
            </main>

            {screenCount > 1 && (
                <div
                    className={`relative h-2 shrink-0 overflow-hidden border-y ${light ? 'border-violet-200 bg-violet-100' : 'border-violet-400/20 bg-slate-900'}`}
                    role="progressbar"
                    aria-label={t('rotationAria')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <span
                        key={`${safeScreen}-${rotationCycle}`}
                        className="tv-dashboard-rotation-progress absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400"
                        style={{ animationDuration: `${SCREEN_ROTATION_MS}ms` }}
                    />
                </div>
            )}

            <footer className={`flex h-9 shrink-0 items-center justify-between gap-3 border-t px-3 text-[10px] font-bold text-slate-500 sm:px-5 ${light ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950'}`}>
                <span className="flex min-w-0 items-center gap-2 truncate"><i className={`h-2 w-2 shrink-0 rounded-full ${isFetching ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} /><span className="truncate">{isFetching ? t('updating') : t('current')}<span className="hidden sm:inline"> · {t('autoUpdate')}</span></span></span>
                {screenCount > 1 && <div className="flex shrink-0 items-center gap-2"><span>{t('screen', {current: safeScreen + 1, total: screenCount})}</span>{Array.from({ length: screenCount }).map((_, index) => <button key={index} type="button" onClick={() => selectScreen(index)} className={`h-3 rounded-full transition-all sm:h-2 ${safeScreen === index ? 'w-6 bg-violet-500' : light ? 'w-3 bg-slate-300 sm:w-2' : 'w-3 bg-slate-700 sm:w-2'}`} aria-label={t('screenAria', {number: index + 1})} />)}</div>}
                <span className="hidden lg:inline">{t('visibleLimit', {count: TASKS_PER_COLUMN})}</span>
            </footer>
        </div>
    );
}
