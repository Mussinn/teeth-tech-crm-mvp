import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationTone = 'error' | 'success' | 'message';

export type AppNotification = {
    id: string;
    tone: NotificationTone;
    title: string;
    message: string;
    duration: number;
    href?: string;
};

type NotificationInput = {
    tone: NotificationTone;
    message: string;
    title?: string;
    duration?: number;
    href?: string;
};

type NotificationsState = {
    items: AppNotification[];
};

const DEFAULT_DURATION: Record<NotificationTone, number> = {
    success: 4000,
    error: 6000,
    message: 6500,
};

const initialState: NotificationsState = {
    items: [],
};

let notificationSequence = 0;

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        enqueueNotification: {
            reducer: (state, action: PayloadAction<AppNotification>) => {
                const duplicate = state.items.some(
                    (item) =>
                        item.tone === action.payload.tone &&
                        item.message === action.payload.message
                );

                if (duplicate) return;

                state.items.push(action.payload);

                if (state.items.length > 4) {
                    state.items.shift();
                }
            },
            prepare: ({ tone, message, title, duration, href }: NotificationInput) => ({
                payload: {
                    id: `notification-${Date.now()}-${++notificationSequence}`,
                    tone,
                    title: title ?? '',
                    message,
                    duration: duration ?? DEFAULT_DURATION[tone],
                    href,
                },
            }),
        },
        dismissNotification: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter((item) => item.id !== action.payload);
        },
        clearNotifications: (state) => {
            state.items = [];
        },
    },
});

export const {
    enqueueNotification,
    dismissNotification,
    clearNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
