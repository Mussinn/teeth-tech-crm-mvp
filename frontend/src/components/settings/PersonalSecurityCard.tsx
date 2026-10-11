'use client';

import { type FormEvent, useState } from 'react';
import {useTranslations} from 'next-intl';
import { useChangeUserPasswordMutation } from '@/src/services/api/usersApi';

export default function PersonalSecurityCard({ userId }: { userId: string | null }) {
    const t = useTranslations('settings.security');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [changePassword, { isLoading }] = useChangeUserPasswordMutation();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');
        if (!userId) return setFormError(t('userMissing'));
        if (newPassword.trim().length < 6) return setFormError(t('shortPassword'));
        if (newPassword !== confirmPassword) return setFormError(t('mismatch'));
        try {
            await changePassword({ id: userId, newPassword }).unwrap();
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            // API notifications display the server error.
        }
    };

    return <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white p-5 dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-900 sm:p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/20"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" strokeLinecap="round"/></svg></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('badge')}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t('title')}</h2><p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p></div></div>
        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-slate-600 dark:text-slate-300">{t('newPassword')}<input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800" /></label><label className="text-xs font-black text-slate-600 dark:text-slate-300">{t('repeatPassword')}<input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800" /></label></div>
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-violet-600" />{t('showPassword')}</label><button type="submit" disabled={isLoading || !newPassword || !confirmPassword} className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-500/20 disabled:opacity-40">{isLoading ? t('saving') : t('submit')}</button></div>{formError ? <p className="text-sm font-bold text-red-600">{formError}</p> : null}
        </form>
    </section>;
}
