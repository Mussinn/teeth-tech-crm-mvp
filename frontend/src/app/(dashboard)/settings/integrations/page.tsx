'use client';

import TelegramBotAdminPanel from '@/src/components/settings/TelegramBotAdminPanel';
import type { RootState } from '@/src/lib/store';
import { useSelector } from 'react-redux';
import { useState } from 'react';
import {useTranslations} from 'next-intl';

const channels = [
    { id: 'telegram', name: 'Telegram', color: 'from-sky-500 to-blue-600', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7"><path d="M21.7 3.4a1.3 1.3 0 0 0-1.35-.2L2.9 9.93c-1.19.46-1.17 1.13-.22 1.42l4.48 1.4 1.72 5.3c.2.55.1.77.68.77.45 0 .65-.2.9-.44l2.16-2.1 4.5 3.33c.83.46 1.43.22 1.64-.77l2.97-14c.3-1.2-.46-1.74-.03-1.44ZM8.2 12.43l10.4-6.56c.52-.31 1-.14.6.22l-8.58 7.74-.33 3.55-2.09-4.95Z" /></svg> },
    { id: 'whatsapp', name: 'WhatsApp', color: 'from-emerald-500 to-green-600', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7"><path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.4-4.9A8.4 8.4 0 1 1 20.5 11.7Z" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.1 7.6c.2-.5.5-.5.8-.5h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.7c-.2.2-.1.4 0 .6.8 1.4 1.9 2.4 3.4 3 .2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .3-.2 1.5-1 2.1-.7.6-1.6.9-2.6.6-1-.2-2.7-.9-4.5-2.5-1.4-1.3-2.4-2.8-2.7-3.8-.3-.9 0-2.5.4-3.2Z" fill="currentColor" stroke="none" /></svg> },
    { id: 'instagram', name: 'Instagram', color: 'from-fuchsia-500 via-pink-500 to-orange-400', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7"><rect x="3" y="3" width="18" height="18" rx="5" strokeWidth="1.9" /><circle cx="12" cy="12" r="4" strokeWidth="1.9" /><circle cx="17.4" cy="6.8" r="1.1" fill="currentColor" stroke="none" /></svg> },
    { id: 'website', name: 'Website', color: 'from-violet-600 to-purple-500', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7"><circle cx="12" cy="12" r="9" strokeWidth="1.8" /><path d="M3.5 9h17M3.5 15h17M12 3c2.1 2.3 3.1 5.3 3.1 9S14.1 18.7 12 21M12 3c-2.1 2.3-3.1 5.3-3.1 9s1 6.7 3.1 9" strokeWidth="1.6" strokeLinecap="round" /></svg> },
] as const;

export default function IntegrationsSettingsPage() {
    const t = useTranslations('settings.integrations');
    const role = useSelector((state: RootState) => state.auth.role);
    const [activeChannel, setActiveChannel] = useState('telegram');

    if (role !== 'ADMIN') {
        return <TelegramBotAdminPanel />;
    }

    return (
        <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{t('badge')}</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{t('title')}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">{t('subtitle')}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">{t('summary', {available: 1, planned: 3})}</div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {channels.map((channel) => {
                    const available = channel.id === 'telegram';
                    const active = activeChannel === channel.id;
                    return <article key={channel.id} className={`relative overflow-hidden rounded-2xl border bg-white p-5 transition ${active ? 'border-violet-300 shadow-lg shadow-violet-950/10 ring-1 ring-violet-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md'} ${!available ? 'opacity-80' : ''}`}>
                        <div className="flex items-start justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${channel.color}`}>{channel.icon}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />{available ? t('available') : t('soon')}</span></div>
                        <h2 className="mt-5 text-base font-black text-slate-900">{channel.name}</h2><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{t(`channels.${channel.id}`)}</p>
                        <button type="button" disabled={!available} onClick={() => setActiveChannel(channel.id)} className={`mt-5 w-full rounded-xl px-4 py-2.5 text-xs font-bold transition ${available ? active ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}>{available ? active ? t('opened') : t('configure') : t('later')}</button>
                    </article>;
                })}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between gap-3 px-1"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600">{t('activeChannel')}</p><h2 className="mt-1 text-base font-black text-slate-900">{t('telegramSetup')}</h2></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">{t('administrator')}</span></div>
                {activeChannel === 'telegram' && <TelegramBotAdminPanel />}
            </section>
        </div>
    );
}
