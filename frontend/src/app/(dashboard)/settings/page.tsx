'use client';

import Link from 'next/link';
import {mvpModules} from '@/src/lib/mvp';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {useTranslations} from 'next-intl';
import PersonalSecurityCard from '@/src/components/settings/PersonalSecurityCard';
import PersonalNotesCard from '@/src/components/settings/PersonalNotesCard';
import TelegramNotificationsCard from '@/src/components/settings/TelegramNotificationsCard';
import type { RootState } from '@/src/lib/store';
import { useGetUsersQuery } from '@/src/services/api/usersApi';

type Tab = 'profile' | 'notes' | 'notifications' | 'security';

function Icon({ name }: { name: Tab | 'plug' }) {
    const paths = { profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, notes: <><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h6M9 16h6"/></>, notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>, security: <><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, plug: <><path d="M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-10 0V8Z"/><path d="M12 16v5"/></> };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name]}</svg>;
}

export default function SettingsPage() {
    const t = useTranslations('settings.page');
    const searchParams = useSearchParams();
    const initial = searchParams.get('tab');
    const { id, name, role } = useSelector((state: RootState) => state.auth);
    const activeTab: Tab = initial === 'security' ? 'security' : initial === 'notifications' && mvpModules.integrations ? 'notifications' : initial === 'notes' ? 'notes' : 'profile';
    const { data: users = [] } = useGetUsersQuery();
    const user = users.find((item) => item.id === id);
    const initials = (user?.fullName || name || 'TT').split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const tabs: Array<{ id: Tab; label: string; hint: string }> = [
        { id: 'profile', label: t('tabs.profile'), hint: t('tabs.profileHint') },
        { id: 'notes', label: t('tabs.notes'), hint: t('tabs.notesHint') },
        ...(mvpModules.integrations ? [{ id: 'notifications' as const, label: t('tabs.notifications'), hint: t('tabs.notificationsHint') }] : []),
        { id: 'security', label: t('tabs.security'), hint: t('tabs.securityHint') },
    ];

    return <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-10">
        <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-100 blur-3xl dark:bg-violet-600/10"/><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600 sm:text-xs">{t('badge')}</p><h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-4xl">{t('title')}</h1><p className="mt-2 text-sm text-slate-500">{t('subtitle')}</p></div><div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:pr-5 dark:border-slate-700 dark:bg-slate-800"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 font-black text-white">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{user?.fullName || name}</p><p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{role}</p></div></div></div></header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="lg:sticky lg:top-4 lg:self-start"><nav className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">{tabs.map((tab) => <Link key={tab.id} href={`/settings?tab=${tab.id}`} className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${activeTab === tab.id ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeTab === tab.id ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}><Icon name={tab.id}/></span><span className="min-w-0 flex-1"><b className="block text-sm">{tab.label}</b><small className="text-[10px] text-slate-400">{tab.hint}</small></span><span>›</span></Link>)}{mvpModules.integrations && (<Link href="/settings/integrations" className="flex items-center gap-3 rounded-2xl p-3 text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><Icon name="plug"/></span><span className="flex-1 text-sm font-bold">{t('integrations')}</span><span>›</span></Link>)}</nav></aside>

            <main className="min-w-0">{activeTab === 'profile' ? <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-center gap-4 border-b border-slate-100 pb-5 dark:border-slate-800"><span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-violet-600 to-indigo-600 text-xl font-black text-white">{initials}</span><div><p className="text-xl font-black text-slate-950 dark:text-white">{user?.fullName || name}</p><p className="mt-1 text-sm text-slate-500">{t('accountInfo')}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label={t('fullName')} value={user?.fullName || name} emptyLabel={t('unspecified')}/><Info label={t('email')} value={user?.email} emptyLabel={t('unspecified')}/><Info label={t('phone')} value={user?.phone} emptyLabel={t('unspecified')}/><Info label={t('specialization')} value={user?.specialization} emptyLabel={t('unspecified')}/><Info label={t('role')} value={user?.role || role} emptyLabel={t('unspecified')}/><Info label={t('status')} value={user?.status} emptyLabel={t('unspecified')}/></div></section> : null}
                <div className={activeTab === 'notes' ? 'block' : 'hidden'}>
                    <PersonalNotesCard/>
                </div>
                {activeTab === 'notifications' ? <TelegramNotificationsCard/> : null}
                {activeTab === 'security' ? <PersonalSecurityCard userId={id}/> : null}
            </main>
        </div>
    </div>;
}

function Info({ label, value, emptyLabel }: { label: string; value?: string | null; emptyLabel: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-sm font-bold text-slate-800 dark:text-white">{value || emptyLabel}</p></div>; }
