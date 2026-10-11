import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {ReactNode} from 'react';

import TelegramBotAdminPanel from '@/src/components/settings/TelegramBotAdminPanel';
import TelegramNotificationsCard from '@/src/components/settings/TelegramNotificationsCard';
import authReducer, { setUser } from '@/src/features/auth/authSlice';
import ruMessages from '@/src/messages/ru';
import {AppI18nProvider} from '@/src/i18n/provider';

function render(ui: ReactNode) {
    return rtlRender(ui, {
        wrapper: ({children}) => (
            <AppI18nProvider initialLocale="ru" initialMessages={ruMessages}>
                {children}
            </AppI18nProvider>
        ),
    });
}

const mocks = vi.hoisted(() => ({
    linkQuery: vi.fn(),
    createLinkHook: vi.fn(),
    unlinkHook: vi.fn(),
    settingsQuery: vi.fn(),
    updateSettingsHook: vi.fn(),
    updateTokenHook: vi.fn(),
    regenerateSecretHook: vi.fn(),
    connectHook: vi.fn(),
    disconnectHook: vi.fn(),
    notifyError: vi.fn(),
}));

vi.mock('@/src/services/api/telegramApi', () => ({
    useGetTelegramLinkStatusQuery: (...args: unknown[]) => mocks.linkQuery(...args),
    useCreateTelegramLinkMutation: () => mocks.createLinkHook(),
    useUnlinkTelegramMutation: () => mocks.unlinkHook(),
    useGetTelegramSettingsQuery: (...args: unknown[]) => mocks.settingsQuery(...args),
    useUpdateTelegramSettingsMutation: () => mocks.updateSettingsHook(),
    useUpdateTelegramTokenMutation: () => mocks.updateTokenHook(),
    useRegenerateTelegramWebhookSecretMutation: () => mocks.regenerateSecretHook(),
    useConnectTelegramIntegrationMutation: () => mocks.connectHook(),
    useDisconnectTelegramIntegrationMutation: () => mocks.disconnectHook(),
}));

vi.mock('@/src/features/notifications/useNotifications', () => ({
    useNotifications: () => ({ notifyError: mocks.notifyError }),
}));

const disconnectedStatus = {
    connected: false,
    enabled: true,
    chatIdMask: null,
};

const connectedStatus = {
    connected: true,
    enabled: true,
    chatIdMask: '123456789',
};

const adminSettings = {
    enabled: true,
    tokenConfigured: true,
    tokenMask: '1234…WXYZ',
    webhookSecretConfigured: true,
    webhookUrl: 'https://crm.example.com/api/v1/integrations/telegram/webhook',
    botUsername: 'teethtech_bot',
    commands: [{ command: 'start', description: 'Запуск' }],
    updatedAt: '2026-07-19T12:00:00Z',
    updatedBy: '1c6fa22f-0056-4a25-b982-c2c2f7e608d9',
};

function mutationHook(trigger = vi.fn(() => ({ unwrap: () => Promise.resolve(adminSettings) }))) {
    return [trigger, { isLoading: false, reset: vi.fn() }] as const;
}

function renderAdmin(role: 'ADMIN' | 'TECHNICIAN') {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(
        setUser({
            id: 'user-1',
            name: 'Test User',
            role,
            roles: [role],
        })
    );

    return render(
        <Provider store={store}>
            <TelegramBotAdminPanel />
        </Provider>
    );
}

beforeEach(() => {
    const refetch = vi.fn(() => Promise.resolve({ data: disconnectedStatus }));
    mocks.linkQuery.mockReturnValue({
        data: disconnectedStatus,
        error: undefined,
        isError: false,
        isFetching: false,
        isLoading: false,
        refetch,
    });
    mocks.createLinkHook.mockReturnValue(mutationHook());
    mocks.unlinkHook.mockReturnValue(mutationHook());
    mocks.settingsQuery.mockReturnValue({
        data: adminSettings,
        error: undefined,
        isError: false,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(() => Promise.resolve({ data: adminSettings })),
    });
    mocks.updateSettingsHook.mockReturnValue(mutationHook());
    mocks.updateTokenHook.mockReturnValue(mutationHook());
    mocks.regenerateSecretHook.mockReturnValue(mutationHook());
    mocks.connectHook.mockReturnValue(mutationHook());
    mocks.disconnectHook.mockReturnValue(mutationHook());
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe('Telegram notifications for current user', () => {
    it('renders disconnected state', () => {
        render(<TelegramNotificationsCard />);

        expect(screen.getByRole('button', { name: 'Подключить Telegram' })).toBeInTheDocument();
        expect(screen.queryByText('Telegram подключён')).not.toBeInTheDocument();
    });

    it('renders connected state and masks chat id', () => {
        mocks.linkQuery.mockReturnValue({
            data: connectedStatus,
            isError: false,
            isFetching: false,
            isLoading: false,
            refetch: vi.fn(),
        });

        render(<TelegramNotificationsCard />);

        expect(screen.getAllByText('Telegram подключён')).toHaveLength(2);
        expect(screen.getByText(/••••6789/u)).toBeInTheDocument();
        expect(screen.queryByText('123456789')).not.toBeInTheDocument();
    });

    it('creates and opens a one-time link once without repeating POST on rerender', async () => {
        const trigger = vi.fn(() => ({
            unwrap: () =>
                Promise.resolve({
                    url: 'https://t.me/teethtech_bot?start=secret-code',
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                }),
        }));
        const reset = vi.fn();
        mocks.createLinkHook.mockReturnValue([trigger, { isLoading: false, reset }]);

        const view = render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));

        await screen.findByRole('button', { name: 'Проверить подключение' });
        expect(trigger).toHaveBeenCalledTimes(1);
        expect(window.open).toHaveBeenCalledWith(
            'https://t.me/teethtech_bot?start=secret-code',
            '_blank',
            'noopener,noreferrer'
        );
        expect(reset).toHaveBeenCalledTimes(1);

        view.rerender(<TelegramNotificationsCard />);
        expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('checks connection again with GET', async () => {
        const refetch = vi.fn(() => Promise.resolve({ data: disconnectedStatus }));
        mocks.linkQuery.mockReturnValue({
            data: disconnectedStatus,
            isError: false,
            isFetching: false,
            isLoading: false,
            refetch,
        });
        mocks.createLinkHook.mockReturnValue([
            vi.fn(() => ({
                unwrap: () => Promise.resolve({
                    url: 'https://t.me/bot?start=code',
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                }),
            })),
            { isLoading: false, reset: vi.fn() },
        ]);

        render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Проверить подключение' }));

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('unlinks Telegram after confirmation', async () => {
        const unlink = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
        mocks.linkQuery.mockReturnValue({
            data: connectedStatus,
            isError: false,
            isFetching: false,
            isLoading: false,
            refetch: vi.fn(),
        });
        mocks.unlinkHook.mockReturnValue([unlink, { isLoading: false }]);

        render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));
        const dialog = screen.getByRole('dialog', { name: 'Отключить Telegram?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Отключить' }));

        await waitFor(() => expect(unlink).toHaveBeenCalledTimes(1));
    });

    it('stops polling when the link expires', async () => {
        vi.useFakeTimers();
        const expiresAt = new Date(Date.now() + 1_000).toISOString();
        mocks.createLinkHook.mockReturnValue([
            vi.fn(() => ({ unwrap: () => Promise.resolve({ url: 'https://t.me/bot?start=code', expiresAt }) })),
            { isLoading: false, reset: vi.fn() },
        ]);

        render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
        await act(async () => Promise.resolve());

        expect(mocks.linkQuery.mock.calls.at(-1)?.[1]).toMatchObject({ pollingInterval: 4_000 });

        act(() => vi.advanceTimersByTime(1_001));

        expect(screen.getByRole('alert')).toHaveTextContent('Срок действия ссылки истёк');
        expect(mocks.linkQuery.mock.calls.at(-1)?.[1]).toMatchObject({ pollingInterval: 0 });
    });

    it('stops polling after Telegram becomes connected', async () => {
        let currentStatus: typeof disconnectedStatus | typeof connectedStatus =
            disconnectedStatus;
        mocks.linkQuery.mockImplementation(() => ({
            data: currentStatus,
            error: undefined,
            isError: false,
            isFetching: false,
            isLoading: false,
            refetch: vi.fn(),
        }));
        mocks.createLinkHook.mockReturnValue([
            vi.fn(() => ({
                unwrap: () => Promise.resolve({
                    url: 'https://t.me/bot?start=code',
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                }),
            })),
            { isLoading: false, reset: vi.fn() },
        ]);

        const view = render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
        await screen.findByRole('button', { name: 'Проверить подключение' });
        expect(mocks.linkQuery.mock.calls.at(-1)?.[1]).toMatchObject({ pollingInterval: 4_000 });

        currentStatus = connectedStatus;
        view.rerender(<TelegramNotificationsCard />);

        await waitFor(() =>
            expect(mocks.linkQuery.mock.calls.at(-1)?.[1]).toMatchObject({ pollingInterval: 0 })
        );
    });

    it('shows a query error and allows retry', () => {
        const refetch = vi.fn();
        mocks.linkQuery.mockReturnValue({
            data: undefined,
            error: { status: 500 },
            isError: true,
            isFetching: false,
            isLoading: false,
            refetch,
        });

        render(<TelegramNotificationsCard />);
        expect(screen.getByRole('alert')).toHaveTextContent('Не удалось получить состояние');
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('does not write a one-time URL to storage or logs', async () => {
        const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const url = 'https://t.me/bot?start=private-code';
        mocks.createLinkHook.mockReturnValue([
            vi.fn(() => ({ unwrap: () => Promise.resolve({ url, expiresAt: new Date(Date.now() + 60_000).toISOString() }) })),
            { isLoading: false, reset: vi.fn() },
        ]);

        render(<TelegramNotificationsCard />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
        await screen.findByRole('button', { name: 'Проверить подключение' });

        expect(storageSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
    });
});

describe('Telegram bot administration', () => {
    it('does not render admin controls for a regular user', () => {
        renderAdmin('TECHNICIAN');

        expect(screen.getByText('Нет доступа')).toBeInTheDocument();
        expect(screen.queryByText('Telegram Bot')).not.toBeInTheDocument();
        expect(mocks.settingsQuery).toHaveBeenCalledWith(undefined, { skip: true });
    });

    it('saves a new bot token after administrator confirmation', async () => {
        const updateToken = vi.fn(() => ({ unwrap: () => Promise.resolve(adminSettings) }));
        mocks.updateTokenHook.mockReturnValue([updateToken, { isLoading: false }]);
        const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        renderAdmin('ADMIN');
        const tokenInput = screen.getByLabelText('Новый токен для замены');
        fireEvent.change(tokenInput, { target: { value: '123456789:AA_PRIVATE_TOKEN' } });
        fireEvent.click(screen.getByRole('button', { name: 'Заменить токен' }));
        const dialog = screen.getByRole('dialog', { name: 'Заменить токен бота?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));

        await waitFor(() =>
            expect(updateToken).toHaveBeenCalledWith({ token: '123456789:AA_PRIVATE_TOKEN' })
        );
        await waitFor(() => expect(tokenInput).toHaveValue(''));
        expect(storageSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
    });
});
