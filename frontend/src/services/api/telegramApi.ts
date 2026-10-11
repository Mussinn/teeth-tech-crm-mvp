import { teethTechApi } from '@/src/services/teethTechApi';
import type {
    TelegramLink,
    TelegramLinkStatus,
    TelegramSettings,
    TelegramSettingsUpdate,
    TelegramTokenUpdate,
} from '@/src/types/telegram.types';

export const telegramApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getTelegramLinkStatus: builder.query<TelegramLinkStatus, void>({
            query: () => '/notifications/telegram-link',
            providesTags: ['TelegramLink'],
        }),
        createTelegramLink: builder.mutation<TelegramLink, void>({
            query: () => ({
                url: '/notifications/telegram-link',
                method: 'POST',
                notification: { success: false },
            }),
        }),
        unlinkTelegram: builder.mutation<void, void>({
            query: () => ({
                url: '/notifications/telegram-link',
                method: 'DELETE',
            }),
            async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    dispatch(
                        telegramApi.util.updateQueryData(
                            'getTelegramLinkStatus',
                            undefined,
                            (status) => {
                                status.connected = false;
                                status.chatIdMask = null;
                            }
                        )
                    );
                } catch {
                    // Глобальный baseQuery показывает ошибку пользователю.
                }
            },
        }),
        getTelegramSettings: builder.query<TelegramSettings, void>({
            query: () => '/admin/integrations/telegram',
            providesTags: ['TelegramIntegration'],
        }),
        updateTelegramSettings: builder.mutation<
            TelegramSettings,
            TelegramSettingsUpdate
        >({
            query: (body) => ({
                url: '/admin/integrations/telegram',
                method: 'PUT',
                body,
            }),
        }),
        updateTelegramToken: builder.mutation<
            TelegramSettings,
            TelegramTokenUpdate
        >({
            query: (body) => ({
                url: '/admin/integrations/telegram/token',
                method: 'PUT',
                body,
            }),
        }),
        regenerateTelegramWebhookSecret: builder.mutation<TelegramSettings, void>({
            query: () => ({
                url: '/admin/integrations/telegram/webhook-secret/regenerate',
                method: 'POST',
            }),
        }),
        connectTelegramIntegration: builder.mutation<TelegramSettings, void>({
            query: () => ({
                url: '/admin/integrations/telegram/connect',
                method: 'POST',
            }),
        }),
        disconnectTelegramIntegration: builder.mutation<TelegramSettings, void>({
            query: () => ({
                url: '/admin/integrations/telegram/disconnect',
                method: 'POST',
            }),
        }),
    }),
});

export const {
    useGetTelegramLinkStatusQuery,
    useCreateTelegramLinkMutation,
    useUnlinkTelegramMutation,
    useGetTelegramSettingsQuery,
    useUpdateTelegramSettingsMutation,
    useUpdateTelegramTokenMutation,
    useRegenerateTelegramWebhookSecretMutation,
    useConnectTelegramIntegrationMutation,
    useDisconnectTelegramIntegrationMutation,
} = telegramApi;
