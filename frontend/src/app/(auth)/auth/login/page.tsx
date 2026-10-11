'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import TeethTechLogo from '@/src/components/branding/TeethTechLogo';
import LanguageSwitcher from '@/src/components/layout/LanguageSwitcher';
import ThemeToggle from '@/src/components/layout/ThemeToggle';
import { setUser } from '@/src/features/auth/authSlice';
import {
    getAuthRedirectPath,
    normalizeAuthRole,
    WORKSPACE_STORAGE_KEY,
} from '@/src/features/auth/authUtils';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import type { AppDispatch } from '@/src/lib/store';
import { useLoginUserMutation } from '@/src/services/api/authApi';
import {
    INACTIVE_ACCOUNT_MESSAGE,
    INACTIVE_ACCOUNT_STORAGE_KEY,
} from '@/src/lib/inactiveAccount';

function DentalTechAnimation() {
    return (
        <div
            aria-hidden="true"
            className="login-dental-scene pointer-events-none absolute h-44 w-52 opacity-60 xl:h-48 xl:w-56"
            style={{ right: '1.5rem', top: '4.5rem' }}
        >
            <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-white/[0.025]" />
            <span className="absolute left-4 top-4 h-4 w-4 border-l border-t border-violet-200/45" />
            <span className="absolute right-4 top-4 h-4 w-4 border-r border-t border-violet-200/45" />
            <span className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-violet-200/35" />
            <div className="login-dental-grid absolute inset-x-8 bottom-14 top-8 opacity-10" />
            <div className="login-dental-orbit absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-violet-200/25">
                <span className="absolute -top-1 left-1/2 h-2 w-2 rounded-full bg-violet-200 shadow-[0_0_12px_rgba(221,214,254,.65)]" />
                <span className="absolute bottom-3 left-2 h-1.5 w-1.5 rounded-full bg-indigo-200/80" />
            </div>
            <div className="login-dental-chip absolute right-3 top-8 rounded-md border border-white/10 px-2 py-1 text-[7px] font-black tracking-widest text-violet-100/70">
                3D · CAD
            </div>
            <div className="absolute left-4 top-12 space-y-1">
                {[72, 48, 62].map((width, index) => (
                    <span key={width} className="block h-0.5 rounded-full bg-violet-200/35" style={{ width: `${width / 2}px`, animationDelay: `${index * 180}ms` }} />
                ))}
            </div>
            <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 overflow-hidden">
                <div className="login-dental-tooth relative h-full w-full">
                <svg
                    viewBox="0 0 180 190"
                    className="h-full w-full drop-shadow-[0_18px_30px_rgba(30,27,75,.35)]"
                >
                    <defs>
                        <linearGradient id="login-tooth-fill" x1="35" y1="20" x2="145" y2="170" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ffffff" />
                            <stop offset="1" stopColor="#ddd6fe" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M90 22c-17-11-42-9-55 8-14 18-8 43 0 62 9 22 13 61 27 70 16 10 15-39 28-39s12 49 28 39c14-9 18-48 27-70 8-19 14-44 0-62-13-17-38-19-55-8Z"
                        fill="url(#login-tooth-fill)"
                        stroke="white"
                        strokeWidth="4"
                    />
                    <path d="M61 57c12-12 39-16 58 0" fill="none" stroke="#a78bfa" strokeWidth="5" strokeLinecap="round" opacity=".55" />
                    <path d="M68 79c10-7 34-9 45 0" fill="none" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round" opacity=".45" />
                </svg>
                <div className="login-dental-scan absolute inset-x-2 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent shadow-[0_0_12px_rgba(221,214,254,.7)]" />
                </div>
            </div>
            <div className="absolute bottom-4 left-5 flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.16em] text-violet-100/75">
                <span className="login-dental-pulse h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Digital workflow
            </div>
            <div className="absolute bottom-9 right-5 w-14">
                <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-wider text-violet-100/80">
                    <span>Scan</span><span>98%</span>
                </div>
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/10">
                    <span className="login-dental-progress block h-full rounded-full bg-gradient-to-r from-violet-300 to-indigo-200" />
                </div>
            </div>
            <span className="login-dental-float absolute left-5 top-5 h-2 w-2 rounded-full bg-violet-200/70" />
            <span className="login-dental-float login-dental-float-delay absolute right-6 top-9 h-2.5 w-2.5 rounded-full border border-violet-200/40" />
        </div>
    );
}

export default function LoginPage() {
    const t = useTranslations('auth.login');
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const [loginUser, { isLoading }] = useLoginUserMutation();
    const { notifyError } = useNotifications();

    useEffect(() => {
        const shouldNotify = new URLSearchParams(window.location.search).get('reason') === 'inactive'
            || window.sessionStorage.getItem(INACTIVE_ACCOUNT_STORAGE_KEY) === '1';

        if (!shouldNotify) return;

        window.sessionStorage.removeItem(INACTIVE_ACCOUNT_STORAGE_KEY);
        notifyError(INACTIVE_ACCOUNT_MESSAGE, { duration: 8000 });
        window.history.replaceState(null, '', '/auth/login');
    }, [notifyError]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const platformFeatures = [
        t('features.production'),
        t('features.team'),
        t('features.insights'),
    ];

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const emailValue = email.trim();
        const passwordValue = password;

        if (!emailValue || !passwordValue) {
            notifyError(t('required'));
            return;
        }

        try {
            const response = await loginUser({
                email: emailValue,
                password: passwordValue,
            }).unwrap();

            const role = normalizeAuthRole(response.roles);

            dispatch(
                setUser({
                    id: response.id,
                    name: response.email,
                    role,
                    avatarUrl: '',
                    roles: response.roles,
                })
            );

            router.push(
                getAuthRedirectPath(
                    role,
                    response.roles,
                    window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
                )
            );
        } catch (requestError) {
            console.error('Login failed:', requestError);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 dark:bg-[#09090b] sm:px-6 sm:py-8 lg:p-10">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-600/10"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -right-28 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl dark:bg-indigo-600/10"
            />

            <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6 lg:right-10 lg:top-10">
                <LanguageSwitcher />
                <ThemeToggle />
            </div>

            <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center sm:min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
                <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-[#18181b] dark:shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="relative hidden min-h-[650px] overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
                        <div
                            aria-hidden="true"
                            className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[48px] border-white/[0.06]"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/[0.05]"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute bottom-20 right-14 h-24 w-24 rounded-3xl border border-white/10 bg-white/[0.04] rotate-12"
                        />

                        <div className="relative z-20">
                            <TeethTechLogo
                                className="w-64"
                                onDarkBackground
                                priority
                            />
                        </div>

                        <DentalTechAnimation />

                        <div className="relative z-10 max-w-lg">
                            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-violet-100 backdrop-blur-sm">
                                {t('workspaceBadge')}
                            </span>
                            <h1 className="mt-6 text-4xl font-black leading-[1.12] tracking-tight xl:text-[2.75rem]">
                                {t('marketingTitle')}
                            </h1>
                            <p className="mt-5 max-w-md text-sm leading-6 text-violet-100/80">
                                {t('marketingDescription')}
                            </p>

                            <ul className="mt-8 space-y-3">
                                {platformFeatures.map((feature) => (
                                    <li
                                        key={feature}
                                        className="flex items-center gap-3 text-sm font-medium text-white/90"
                                    >
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                            <svg
                                                aria-hidden="true"
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                stroke="currentColor"
                                                className="h-3.5 w-3.5"
                                            >
                                                <path
                                                    d="m5 10 3 3 7-7"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="relative text-xs text-violet-200/70">
                            © 2026 TeethTech CRM
                        </p>
                    </section>

                    <section className="flex min-h-[620px] items-center justify-center p-6 sm:p-10 lg:min-h-[650px] lg:p-12 xl:p-16">
                        <div className="w-full max-w-sm">
                            <div className="mb-10 pr-12 lg:hidden">
                                <TeethTechLogo className="w-52" priority />
                                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                    {t('mobileSubtitle')}
                                </p>
                            </div>

                            <div className="mb-8">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        className="h-5 w-5"
                                    >
                                        <path
                                            d="M8 10V8a4 4 0 0 1 8 0v2m-9 0h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2Z"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </span>
                                <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                                    {t('welcome')}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {t('welcomeDescription')}
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                                    >
                                        {t('email')}
                                    </label>
                                    <div className="relative">
                                        <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                                        >
                                            <rect x="3" y="5" width="18" height="14" rx="3" strokeWidth="1.7" />
                                            <path d="m5 7 7 6 7-6" strokeWidth="1.7" strokeLinejoin="round" />
                                        </svg>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('emailPlaceholder')}
                                            autoComplete="email"
                                            disabled={isLoading}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600 dark:focus:border-violet-500 dark:focus:bg-slate-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                                    >
                                        {t('password')}
                                    </label>
                                    <div className="relative">
                                        <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                                        >
                                            <rect x="4" y="10" width="16" height="11" rx="3" strokeWidth="1.7" />
                                            <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeWidth="1.7" strokeLinecap="round" />
                                        </svg>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={t('passwordPlaceholder')}
                                            autoComplete="current-password"
                                            disabled={isLoading}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600 dark:focus:border-violet-500 dark:focus:bg-slate-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((current) => !current)}
                                            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                                            aria-pressed={showPassword}
                                        >
                                            <svg
                                                aria-hidden="true"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                className="h-5 w-5"
                                            >
                                                {showPassword ? (
                                                    <>
                                                        <path d="M3 3l18 18" strokeWidth="1.8" strokeLinecap="round" />
                                                        <path d="M10.7 10.8a2 2 0 0 0 2.5 2.5M9.5 5.4A10.5 10.5 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-2.2 3.2M6.1 6.1C4.2 7.5 3 9.6 3 12c0 0 3.5 7 9 7 1.2 0 2.3-.3 3.3-.8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" strokeWidth="1.8" strokeLinejoin="round" />
                                                        <circle cx="12" cy="12" r="2.5" strokeWidth="1.8" />
                                                    </>
                                                )}
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 hover:shadow-violet-600/30 active:scale-[0.99] disabled:cursor-wait disabled:bg-violet-400 disabled:shadow-none dark:bg-violet-600 dark:hover:bg-violet-500"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            {t('submitting')}
                                        </>
                                    ) : (
                                        <>
                                            {t('submit')}
                                            <svg
                                                aria-hidden="true"
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                stroke="currentColor"
                                                className="h-4 w-4"
                                            >
                                                <path d="M4 10h12m-4-4 4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    stroke="currentColor"
                                    className="h-4 w-4"
                                >
                                    <path d="M6 8V6a4 4 0 0 1 8 0v2m-9 0h10v8H5V8Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {t('secureLogin')}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
