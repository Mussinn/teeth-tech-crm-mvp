'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSelector } from 'react-redux';

import { RootState } from '@/src/lib/store';
import { useGetMyTasksCalendarQuery } from '@/src/services/api/tasksCalendarApi';
import type { EmployeeCalendarTask } from '@/src/types/task.types';
import { useAppFormatters } from '@/src/i18n/provider';

function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function isSameDay(dateA: Date, dateB: Date) {
    return formatDateKey(dateA) === formatDateKey(dateB);
}

function getTaskTitle(task: EmployeeCalendarTask, fallback: string) {
    return task.workTypeName || task.workTypeCode || fallback;
}

function getStatusLabel(task: EmployeeCalendarTask, fallback: string) {
    return task.statusName || task.statusCode || fallback;
}

function CalendarLoadingGrid({ calendarDays }: { calendarDays: Array<Date | null> }) {
    const t = useTranslations('employees.calendar');
    return (
        <div className="grid grid-cols-7" aria-label={t('loadingAria')}>
            {calendarDays.map((date, index) => (
                <div
                    key={date ? formatDateKey(date) : `loading-empty-${index}`}
                    className="min-h-[86px] border-b border-r border-slate-100 bg-white p-2 sm:min-h-[120px]"
                >
                    {date && (
                        <>
                            <div className="h-7 w-7 animate-pulse rounded-full bg-slate-200" />
                            <div className="mt-3 h-5 animate-pulse rounded-md bg-slate-100" />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function EmployeeCalendarPage() {
    const t = useTranslations('employees.calendar');
    const commonT = useTranslations('common');
    const formats = useAppFormatters();
    const { name } = useSelector((state: RootState) => state.auth);
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const {
        data,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetMyTasksCalendarQuery({
        year: currentYear,
        month: currentMonth + 1,
    });

    const monthLabel = formats.date(currentDate, {
        month: 'long',
        year: 'numeric',
    });

    const calendarDays = useMemo(() => {
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startDay = startOfMonth.getDay() === 0 ? 7 : startOfMonth.getDay();
        const days: Array<Date | null> = [];

        for (let index = 1; index < startDay; index += 1) {
            days.push(null);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            days.push(new Date(currentYear, currentMonth, day));
        }

        return days;
    }, [currentMonth, currentYear]);

    const daysByDate = useMemo(
        () => new Map((data?.days ?? []).map((day) => [day.date, day])),
        [data]
    );
    const selectedDateTasks = daysByDate.get(formatDateKey(selectedDate))?.tasks ?? [];

    const changeMonth = (offset: number) => {
        const nextMonth = new Date(currentYear, currentMonth + offset, 1);

        setCurrentDate(nextMonth);
        setSelectedDate(nextMonth);
    };

    return (
        <div className="mx-auto w-full max-w-[1450px] space-y-6 pb-8">
            <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:flex lg:items-center lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('badge')}</p><h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{t('title')}</h1>
                    <p className="text-sm text-slate-500">
                        {t('subtitle', {name: name ?? '—'})}
                    </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        {t('previous')}
                    </button>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-bold capitalize text-slate-800 shadow-sm sm:min-w-[180px]">
                        {monthLabel}
                    </div>

                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        {t('next')}
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div
                    className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2"
                    aria-busy={isFetching}
                >
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:text-[11px]">
                        {[t('weekdays.mon'), t('weekdays.tue'), t('weekdays.wed'), t('weekdays.thu'), t('weekdays.fri'), t('weekdays.sat'), t('weekdays.sun')].map((day) => (
                            <div key={day} className="p-2 sm:p-4">
                                {day}
                            </div>
                        ))}
                    </div>

                    {isLoading ? (
                        <CalendarLoadingGrid calendarDays={calendarDays} />
                    ) : isError ? (
                        <div className="px-5 py-16 text-center" role="alert">
                            <h2 className="font-bold text-red-700">
                                {t('loadError')}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {t('loadErrorHint')}
                            </p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
                            >
                                {commonT('actions.retry')}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-7">
                            {calendarDays.map((date, index) => {
                                if (!date) {
                                    return (
                                        <div
                                            key={`empty-${index}`}
                                            className="min-h-[86px] border-b border-r border-slate-100 bg-slate-50/50 sm:min-h-[120px]"
                                        />
                                    );
                                }

                                const day = daysByDate.get(formatDateKey(date));
                                const tasks = day?.tasks ?? [];
                                const taskCount = day?.taskCount ?? tasks.length;
                                const isSelected = isSameDay(date, selectedDate);
                                const isToday = isSameDay(date, new Date());

                                return (
                                    <button
                                        key={formatDateKey(date)}
                                        type="button"
                                        onClick={() => setSelectedDate(date)}
                                        className={`min-h-[86px] border-b border-r border-slate-100 p-1.5 text-left align-top transition sm:min-h-[120px] sm:p-2 ${
                                            isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${
                                                    isToday
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-700'
                                                }`}
                                            >
                                                {date.getDate()}
                                            </span>

                                            {taskCount > 0 && (
                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">
                                                    {taskCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-2 hidden space-y-1 sm:block">
                                            {tasks.slice(0, 2).map((task) => (
                                                <div
                                                    key={task.taskId}
                                                    className="flex items-center gap-1.5 truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700"
                                                >
                                                    <span
                                                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                                                        style={{ backgroundColor: task.statusColor || undefined }}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="truncate">{getTaskTitle(task, t('taskFallback', {id: task.taskId.slice(0, 8)}))}</span>
                                                </div>
                                            ))}

                                            {taskCount > 2 && (
                                                <div className="text-[10px] font-bold text-blue-600">
                                                    {t('more', {count: taskCount - 2})}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            {t('tasksOn', {date: formats.date(selectedDate, {
                                day: 'numeric',
                                month: 'long',
                            })})}
                        </h2>
                        {isFetching && !isLoading && (
                            <span className="text-[10px] font-bold uppercase text-blue-600">
                                {t('updating')}
                            </span>
                        )}
                    </div>

                    <div className="space-y-4 p-5">
                        {isLoading ? (
                            <p className="text-sm text-slate-400">{t('tasksLoading')}</p>
                        ) : isError ? (
                            <p className="text-sm text-red-600">{t('tasksUnavailable')}</p>
                        ) : selectedDateTasks.length > 0 ? (
                            selectedDateTasks.map((task) => (
                                <article
                                    key={task.taskId}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="rounded bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                                            {task.workTypeCode || task.taskId.slice(0, 8)}
                                        </span>

                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                                            style={{ borderColor: task.statusColor || undefined }}
                                        >
                                            <span
                                                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                                                style={{ backgroundColor: task.statusColor || undefined }}
                                                aria-hidden="true"
                                            />
                                            {getStatusLabel(task, t('statusMissing'))}
                                        </span>
                                    </div>

                                    <h3 className="mt-3 text-sm font-bold text-slate-900">
                                        {getTaskTitle(task, t('taskFallback', {id: task.taskId.slice(0, 8)}))}
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {t('patient', {name: task.patientName || t('unspecifiedMale')})}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {t('clinic', {name: task.clinicName || t('unspecifiedFemale')})}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {t('quantity', {count: task.quantity})}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {t('order', {number: task.orderNumber || task.orderId})}
                                    </p>

                                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                                        <Link
                                            href={`/orders/${task.orderId}`}
                                            className="text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            {t('openOrder')}
                                        </Link>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <p className="text-sm text-slate-400">
                                {t('empty')}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
