'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {useTranslations} from 'next-intl';

import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import { isTelegramUrl, openSafeExternalUrl } from '@/src/lib/safeUrl';
import {
    useCreateTelegramLinkMutation,
    useGetTelegramLinkStatusQuery,
    useUnlinkTelegramMutation,
} from '@/src/services/api/telegramApi';

const TELEGRAM_POLL_INTERVAL_MS = 4_000;

function isUnauthorized(error: unknown) {
    return Boolean(
        error &&
            typeof error === 'object' &&
            'status' in error &&
            error.status === 401
    );
}

function getSafeChatIdMask(value?: string | null) {
    if (!value) return null;
    const visibleSuffix = value.replace(/[^\d]/gu, '').slice(-4);

    return visibleSuffix ? `••••${visibleSuffix}` : null;
}

export default function TelegramNotificationsCard() {
    const t = useTranslations('settings.telegramNotifications');
    const commonT = useTranslations('common.actions');
    const creatingLinkRef = useRef(false);
    const [pollingEnabled, setPollingEnabled] = useState(false);
    const [linkExpiresAt, setLinkExpiresAt] = useState<number | null>(null);
    const [linkExpired, setLinkExpired] = useState(false);
    const [showUnlinkConfirmation, setShowUnlinkConfirmation] = useState(false);
    const { notifyError } = useNotifications();

    const {
        data: status,
        error: statusError,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetTelegramLinkStatusQuery(undefined, {
        pollingInterval: pollingEnabled ? TELEGRAM_POLL_INTERVAL_MS : 0,
        skipPollingIfUnfocused: true,
    });
    const [createLink, { isLoading: isCreatingLink, reset: resetCreateLink }] =
        useCreateTelegramLinkMutation();
    const [unlinkTelegram, { isLoading: isUnlinking }] =
        useUnlinkTelegramMutation();

    const chatIdMask = useMemo(
        () => getSafeChatIdMask(status?.chatIdMask),
        [status?.chatIdMask]
    );
    const hasActiveLink = linkExpiresAt !== null && !linkExpired;

    useEffect(() => {
        if (!status?.connected) return;

        setPollingEnabled(false);
        setLinkExpiresAt(null);
        setLinkExpired(false);
    }, [status?.connected]);

    useEffect(() => {
        if (!isUnauthorized(statusError)) return;

        setPollingEnabled(false);
    }, [statusError]);

    useEffect(() => {
        if (linkExpiresAt === null) return;

        const remainingMs = linkExpiresAt - Date.now();

        if (remainingMs <= 0) {
            setLinkExpired(true);
            setPollingEnabled(false);
            return;
        }

        const expiryTimer = window.setTimeout(() => {
            setLinkExpired(true);
            setPollingEnabled(false);
        }, remainingMs);

        return () => window.clearTimeout(expiryTimer);
    }, [linkExpiresAt]);

    const handleCreateLink = async () => {
        if (creatingLinkRef.current || isCreatingLink || hasActiveLink) return;
        creatingLinkRef.current = true;

        try {
            const link = await createLink().unwrap();
            const expiresAt = Date.parse(link.expiresAt);

            setLinkExpiresAt(Number.isNaN(expiresAt) ? Date.now() : expiresAt);
            setLinkExpired(Number.isNaN(expiresAt) || expiresAt <= Date.now());
            setPollingEnabled(!Number.isNaN(expiresAt) && expiresAt > Date.now());

            const safeUrl = isTelegramUrl(link.url);

            if (!safeUrl) {
                notifyError(t('invalidLink'));
                setPollingEnabled(false);
                return;
            }

            const openedWindow = openSafeExternalUrl(safeUrl, new Set(['t.me', 'telegram.me']));

            if (!openedWindow) {
                notifyError(
                    t('popupBlocked')
                );
            }
        } catch {
            // Ошибка уже показана общей системой API-уведомлений.
        } finally {
            // Удаляем одноразовый URL из mutation cache сразу после использования.
            resetCreateLink();
            creatingLinkRef.current = false;
        }
    };

    const handleUnlink = async () => {
        if (isUnlinking) return;

        try {
            await unlinkTelegram().unwrap();
            setShowUnlinkConfirmation(false);
            setPollingEnabled(false);
            setLinkExpiresAt(null);
            setLinkExpired(false);
        } catch {
            // Ошибка уже показана общей системой API-уведомлений.
        }
    };

    return (
        <section
            aria-labelledby="telegram-notifications-title"
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-sky-50/50 p-5 dark:border-slate-800 dark:from-slate-900 dark:to-sky-950/20 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                            <path d="M21.7 3.4a1.3 1.3 0 0 0-1.35-.2L2.9 9.93c-1.19.46-1.17 1.13-.22 1.42l4.48 1.4 1.72 5.3c.2.55.1.77.68.77.45 0 .65-.2.9-.44l2.16-2.1 4.5 3.33c.83.46 1.43.22 1.64-.77l2.97-14c.3-1.2-.46-1.74-.03-1.44ZM8.2 12.43l10.4-6.56c.52-.31 1-.14.6.22l-8.58 7.74-.33 3.55-2.09-4.95Z" />
                        </svg>
                    </div>
                    <div>
                        <h2 id="telegram-notifications-title" className="text-lg font-black text-slate-950 dark:text-white">
                            {t('title')}
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>

                {status?.connected ? (
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('connected')}
                    </span>
                ) : null}
            </div>

            <div className="p-5 sm:p-6">
                {isLoading ? (
                    <div aria-label={t('loading')} className="space-y-3 animate-pulse">
                        <div className="h-5 w-56 rounded bg-slate-200" />
                        <div className="h-10 w-48 rounded-xl bg-slate-100" />
                    </div>
                ) : isError && !status ? (
                    <QueryErrorNotice
                        message={t('loadError')}
                        onRetry={() => refetch()}
                        isRetrying={isFetching}
                    />
                ) : status?.connected ? (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                            <p className="font-bold text-emerald-900">{t('connected')}</p>
                            {chatIdMask ? (
                                <p className="mt-1 text-sm text-emerald-700">
                                    {t('chatId', {id: chatIdMask})}
                                </p>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowUnlinkConfirmation(true)}
                            disabled={isUnlinking}
                            className="min-h-11 rounded-xl border border-red-200 bg-red-50/50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                        >
                            {t('disconnect')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {!status?.enabled ? (
                            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                {t('disabledByAdmin')}
                            </p>
                        ) : null}

                        {hasActiveLink ? (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                                <p className="font-bold text-sky-900">
                                    {t('startTitle')}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-sky-700">
                                    {t('startHint')}
                                </p>
                            </div>
                        ) : null}

                        {linkExpired ? (
                            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                                {t('expired')}
                            </p>
                        ) : null}

                        <div className="flex flex-col gap-3 sm:flex-row">
                            {!hasActiveLink ? (
                                <button
                                    type="button"
                                    onClick={handleCreateLink}
                                    disabled={isCreatingLink || status?.enabled === false}
                                    className="min-h-11 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-300"
                                >
                                    {isCreatingLink ? t('creatingLink') : linkExpired ? t('createLink') : t('connect')}
                                </button>
                            ) : null}

                            {hasActiveLink ? (
                                <button
                                    type="button"
                                    onClick={() => refetch()}
                                    disabled={isFetching}
                                    className="min-h-11 rounded-xl border border-sky-200 px-5 text-sm font-bold text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {isFetching ? t('checking') : t('check')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {showUnlinkConfirmation ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="unlink-telegram-title"
                    className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                >
                    <div className="w-full rounded-t-[28px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-md sm:rounded-[28px] sm:p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M12 9v4M12 17h.01" strokeLinecap="round"/><path d="M10.3 3.8 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.8a2 2 0 0 0-3.4 0Z" strokeLinejoin="round"/></svg></div><h3 id="unlink-telegram-title" className="mt-4 text-xl font-black text-slate-950 dark:text-white">
                            {t('disconnectTitle')}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {t('disconnectHint')}
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowUnlinkConfirmation(false)}
                                disabled={isUnlinking}
                                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                                {commonT('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleUnlink}
                                disabled={isUnlinking}
                                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-wait disabled:bg-red-300"
                            >
                                {isUnlinking ? t('disconnecting') : t('disconnect')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
