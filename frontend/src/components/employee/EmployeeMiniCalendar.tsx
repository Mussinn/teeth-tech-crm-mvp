'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useGetMyTasksCalendarQuery } from '@/src/services/api/tasksCalendarApi';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export default function EmployeeMiniCalendar() {
    const t = useTranslations('workspace.calendar');
    const {date} = useAppFormatters();
    const today = useMemo(() => new Date(), []);
    const { data, isLoading } = useGetMyTasksCalendarQuery({ year: today.getFullYear(), month: today.getMonth() + 1 });
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() + index); return date; });
    const taskMap = new Map((data?.days ?? []).map((day) => [day.date, day.tasks]));
    const todayTasks = taskMap.get(dateKey(today)) ?? [];

    return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('nextDays')}</p><h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{t('mini')}</h3></div><Link href="/employee/calendar" className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">{t('full')} →</Link></div>
        <div className="mt-5 grid grid-cols-7 gap-1.5">{days.map((calendarDate, index) => { const count = taskMap.get(dateKey(calendarDate))?.length ?? 0; return <div key={dateKey(calendarDate)} className={`rounded-xl border p-2 text-center ${index === 0 ? 'border-violet-300 bg-violet-50 dark:bg-violet-500/15' : 'border-slate-200 dark:border-slate-700'}`}><p className="text-[9px] font-black uppercase text-slate-400">{date(calendarDate, { weekday: 'short' })}</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{calendarDate.getDate()}</p><span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${count ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-700'}`} /></div>; })}</div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex items-center justify-between"><p className="text-xs font-black text-slate-800 dark:text-white">{t('today')}</p><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{t('taskCount', {count: todayTasks.length})}</span></div>{isLoading ? <p className="mt-3 text-xs text-slate-400">{t('loading')}</p> : todayTasks.length ? <div className="mt-3 space-y-2">{todayTasks.slice(0, 3).map((task) => <div key={task.taskId} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-violet-500"/><span className="min-w-0 flex-1 truncate font-bold text-slate-700 dark:text-slate-200">{task.workTypeName || task.workTypeCode || t('task')}</span><span className="text-[9px] text-slate-400">{task.statusName || task.statusCode}</span></div>)}</div> : <p className="mt-3 text-xs text-slate-400">{t('emptyToday')}</p>}</div>
    </section>;
}
