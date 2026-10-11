'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import EmployeeMiniCalendar from '@/src/components/employee/EmployeeMiniCalendar';
import EmployeeTasksKanban from '@/src/components/employee/EmployeeTasksKanban';
import type { RootState } from '@/src/lib/store';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

export default function EmployeePage() {
    const t = useTranslations('workspace.home');
    const {date} = useAppFormatters();
    const { name } = useSelector((state: RootState) => state.auth);

    const today = date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
    return <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-6 pb-10">
        <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"><div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-100 blur-3xl dark:bg-violet-600/10"/><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{today}</p><h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-4xl">{t('title')}</h1><p className="mt-2 text-sm text-slate-500">{t('subtitle', {name: name ?? ''})}</p></div><div className="grid grid-cols-1 gap-2 sm:flex"><Link href="/employee/calendar" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-center text-xs font-black text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">{t('calendar')}</Link><Link href="/settings" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-center text-xs font-black text-white dark:bg-violet-600">{t('profile')}</Link></div></div></header>
        <EmployeeMiniCalendar />
        <EmployeeTasksKanban />
    </div>;
}
