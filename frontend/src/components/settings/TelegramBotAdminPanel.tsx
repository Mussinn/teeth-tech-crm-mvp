'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import {useTranslations} from 'next-intl';

import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import type { RootState } from '@/src/lib/store';
import {
    useConnectTelegramIntegrationMutation,
    useDisconnectTelegramIntegrationMutation,
    useGetTelegramSettingsQuery,
    useRegenerateTelegramWebhookSecretMutation,
    useUpdateTelegramSettingsMutation,
    useUpdateTelegramTokenMutation,
} from '@/src/services/api/telegramApi';
import type { TelegramCommand } from '@/src/types/telegram.types';
import {useAppFormatters} from '@/src/i18n/provider';

type ConfirmationAction = 'token' | 'secret' | 'disconnect' | null;

function getErrorStatus(error: unknown) {
    if (!error || typeof error !== 'object' || !('status' in error)) return null;
    return error.status;
}

function getSafeTokenMask(value?: string | null) {
    if (!value) return null;
    if (value.length <= 8) return '••••';

    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default function TelegramBotAdminPanel() {
    const t = useTranslations('settings.telegramAdmin');
    const commonT = useTranslations('common.actions');
    const formatters = useAppFormatters();
    const formatUpdatedAt = (value?: string | null) => {
        if (!value || Number.isNaN(new Date(value).getTime())) return t('noData');
        return formatters.dateTime(value);
    };
    const role = useSelector((state: RootState) => state.auth.role);
    const isAdmin = role === 'ADMIN';
    const {
        data: settings,
        error,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetTelegramSettingsQuery(undefined, { skip: !isAdmin });
    const [updateSettings, { isLoading: isSavingSettings }] =
        useUpdateTelegramSettingsMutation();
    const [updateToken, { isLoading: isSavingToken }] =
        useUpdateTelegramTokenMutation();
    const [regenerateSecret, { isLoading: isRegeneratingSecret }] =
        useRegenerateTelegramWebhookSecretMutation();
    const [connectIntegration, { isLoading: isConnecting }] =
        useConnectTelegramIntegrationMutation();
    const [disconnectIntegration, { isLoading: isDisconnecting }] =
        useDisconnectTelegramIntegrationMutation();

    const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
    const [webhookUrlOverride, setWebhookUrlOverride] = useState<string | null>(null);
    const [commandsOverride, setCommandsOverride] = useState<TelegramCommand[] | null>(null);
    const [newToken, setNewToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [confirmationAction, setConfirmationAction] =
        useState<ConfirmationAction>(null);

    if (!isAdmin) {
        return (
            <section role="alert" className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-extrabold text-slate-900">{t('denied')}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t('deniedHint')}
                </p>
            </section>
        );
    }

    if (isLoading) {
        return (
            <div aria-label={t('loading')} className="space-y-4 animate-pulse">
                <div className="h-28 rounded-2xl bg-white" />
                <div className="h-64 rounded-2xl bg-white" />
            </div>
        );
    }

    if (isError && !settings) {
        const isForbidden = getErrorStatus(error) === 403;

        return (
            <QueryErrorNotice
                message={
                    isForbidden
                        ? t('forbidden')
                        : t('loadError')
                }
                onRetry={isForbidden ? undefined : () => refetch()}
                isRetrying={isFetching}
            />
        );
    }

    const isBusy =
        isSavingSettings ||
        isSavingToken ||
        isRegeneratingSecret ||
        isConnecting ||
        isDisconnecting;
    const enabled = enabledOverride ?? settings?.enabled ?? false;
    const webhookUrl = webhookUrlOverride ?? settings?.webhookUrl ?? '';
    const commands = commandsOverride ?? settings?.commands ?? [];
    const tokenMask = getSafeTokenMask(settings?.tokenMask);

    const refreshAfter = async (operation: Promise<unknown>) => {
        try {
            await operation;
            await refetch();
            return true;
        } catch {
            return false;
        }
    };

    const saveSettings = async () => {
        if (isBusy) return;

        const normalizedCommands = commands
            .map((command) => ({
                command: command.command.trim().replace(/^\//u, ''),
                description: command.description.trim(),
            }))
            .filter((command) => command.command || command.description);

        const saved = await refreshAfter(
            updateSettings({
                enabled,
                webhookUrl: webhookUrl.trim(),
                commands: normalizedCommands,
            }).unwrap()
        );

        if (saved) {
            setEnabledOverride(null);
            setWebhookUrlOverride(null);
            setCommandsOverride(null);
        }
    };

    const saveToken = async () => {
        const token = newToken.trim();
        if (!token || isBusy) return;

        const saved = await refreshAfter(updateToken({ token }).unwrap());

        if (saved) {
            setNewToken('');
            setShowToken(false);
            setConfirmationAction(null);
        }
    };

    const handleTokenSubmit = () => {
        if (!newToken.trim() || isBusy) return;

        if (settings?.tokenConfigured) {
            setConfirmationAction('token');
        } else {
            void saveToken();
        }
    };

    const confirmAction = async () => {
        if (confirmationAction === 'token') {
            await saveToken();
            return;
        }

        if (confirmationAction === 'secret') {
            const saved = await refreshAfter(regenerateSecret().unwrap());
            if (saved) setConfirmationAction(null);
            return;
        }

        if (confirmationAction === 'disconnect') {
            const saved = await refreshAfter(disconnectIntegration().unwrap());
            if (saved) setConfirmationAction(null);
        }
    };

    const updateCommand = (
        index: number,
        field: keyof TelegramCommand,
        value: string
    ) => {
        setCommandsOverride(
            commands.map((command, commandIndex) =>
                commandIndex === index ? { ...command, [field]: value } : command
            )
        );
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-extrabold text-slate-900">Telegram Bot</h2>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${settings?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {settings?.enabled ? t('enabled') : t('disabled')}
                            </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {t('summary')}
                        </p>
                    </div>

                    <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 lg:min-w-[24rem]">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('bot')}</dt>
                            <dd className="mt-1 truncate font-semibold text-slate-800">
                                {settings?.botUsername ? `@${settings.botUsername.replace(/^@/u, '')}` : t('unknownBot')}
                            </dd>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('updated')}</dt>
                            <dd className="mt-1 font-semibold text-slate-800">{formatUpdatedAt(settings?.updatedAt)}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section aria-labelledby="telegram-token-title" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h2 id="telegram-token-title" className="text-lg font-extrabold text-slate-900">{t('tokenTitle')}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                    {t('tokenHint')}
                </p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <span className="font-semibold text-slate-700">
                        {settings?.tokenConfigured ? t('tokenConfigured') : t('tokenMissing')}
                    </span>
                    {settings?.tokenConfigured && tokenMask ? (
                        <span className="ml-2 font-mono text-slate-500">{tokenMask}</span>
                    ) : null}
                </div>

                <label htmlFor="telegram-new-token" className="mt-5 block text-sm font-bold text-slate-700">
                    {settings?.tokenConfigured ? t('replacementToken') : t('botToken')}
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                        <input
                            id="telegram-new-token"
                            type={showToken ? 'text' : 'password'}
                            value={newToken}
                            onChange={(event) => setNewToken(event.target.value)}
                            maxLength={200}
                            autoComplete="new-password"
                            spellCheck={false}
                            placeholder="123456789:AA..."
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 pr-24 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                            type="button"
                            onClick={() => setShowToken((value) => !value)}
                            disabled={!newToken}
                            aria-pressed={showToken}
                            className="absolute inset-y-1 right-1 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
                        >
                            {showToken ? t('hide') : t('show')}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleTokenSubmit}
                        disabled={!newToken.trim() || isBusy}
                        className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {isSavingToken ? t('saving') : settings?.tokenConfigured ? t('replaceToken') : t('saveToken')}
                    </button>
                </div>
            </section>

            <section aria-labelledby="telegram-webhook-title" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h2 id="telegram-webhook-title" className="text-lg font-extrabold text-slate-900">{t('webhookTitle')}</h2>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                        <span className="text-sm font-bold text-slate-700">Webhook URL</span>
                        <input
                            type="url"
                            value={webhookUrl}
                            onChange={(event) => setWebhookUrlOverride(event.target.value)}
                            maxLength={500}
                            placeholder="https://crm.example.com/api/v1/integrations/telegram/webhook"
                            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Webhook secret</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                            {settings?.webhookSecretConfigured ? t('configuredHidden') : t('notConfigured')}
                        </p>
                        <button
                            type="button"
                            onClick={() => setConfirmationAction('secret')}
                            disabled={isBusy}
                            className="mt-3 min-h-10 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                        >
                            {t('updateSecret')}
                        </button>
                    </div>
                </div>

                <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => setEnabledOverride(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-slate-700">{t('enable')}</span>
                </label>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                        type="button"
                        onClick={saveSettings}
                        disabled={isBusy}
                        className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                    >
                        {isSavingSettings ? t('saving') : t('saveSettings')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void refreshAfter(connectIntegration().unwrap())}
                        disabled={isBusy || !settings?.tokenConfigured}
                        className="min-h-11 rounded-xl border border-emerald-200 px-5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isConnecting ? t('registering') : t('registerWebhook')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmationAction('disconnect')}
                        disabled={isBusy}
                        className="min-h-11 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                        {t('disconnectWebhook')}
                    </button>
                </div>
            </section>

            <section aria-labelledby="telegram-commands-title" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 id="telegram-commands-title" className="text-lg font-extrabold text-slate-900">{t('commandsTitle')}</h2>
                        <p className="mt-1 text-sm text-slate-500">{t('commandsHint')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCommandsOverride([...commands, { command: '', description: '' }])}
                        disabled={commands.length >= 100 || isBusy}
                        className="min-h-10 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                        {t('addCommand')}
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    {commands.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{t('commandsEmpty')}</p>
                    ) : (
                        commands.map((command, index) => (
                            <div key={`${index}-${command.command}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.5fr)_auto] sm:items-end">
                                <label className="block">
                                    <span className="text-xs font-bold text-slate-500">{t('command')}</span>
                                    <div className="relative mt-1">
                                        <span aria-hidden="true" className="absolute inset-y-0 left-3 flex items-center text-slate-400">/</span>
                                        <input
                                            value={command.command}
                                            onChange={(event) => updateCommand(index, 'command', event.target.value.replace(/[^a-z0-9_]/gu, ''))}
                                            maxLength={32}
                                            aria-label={t('commandAria', {number: index + 1})}
                                            className="min-h-10 w-full rounded-lg border border-slate-200 pl-7 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-bold text-slate-500">{t('description')}</span>
                                    <input
                                        value={command.description}
                                        onChange={(event) => updateCommand(index, 'description', event.target.value)}
                                        maxLength={256}
                                        aria-label={t('descriptionAria', {number: index + 1})}
                                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setCommandsOverride(commands.filter((_, commandIndex) => commandIndex !== index))}
                                    aria-label={t('deleteCommandAria', {number: index + 1})}
                                    className="min-h-10 rounded-lg border border-red-100 px-3 text-sm font-bold text-red-600 hover:bg-red-50"
                                >
                                    {commonT('delete')}
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <button
                    type="button"
                    onClick={saveSettings}
                    disabled={isBusy}
                    className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                    {isSavingSettings ? t('saving') : t('saveCommands')}
                </button>
            </section>

            {confirmationAction ? (
                <div role="dialog" aria-modal="true" aria-labelledby="telegram-confirmation-title" className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                    <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
                        <h2 id="telegram-confirmation-title" className="text-lg font-extrabold text-slate-900">
                            {confirmationAction === 'token' ? t('replaceTokenTitle') : confirmationAction === 'secret' ? t('updateSecretTitle') : t('disconnectWebhookTitle')}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {confirmationAction === 'token'
                                ? t('replaceTokenHint')
                                : confirmationAction === 'secret'
                                  ? t('updateSecretHint')
                                  : t('disconnectWebhookHint')}
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setConfirmationAction(null)} disabled={isBusy} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{commonT('cancel')}</button>
                            <button type="button" onClick={() => void confirmAction()} disabled={isBusy} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:bg-red-300">
                                {isBusy ? commonT('processing') : commonT('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
