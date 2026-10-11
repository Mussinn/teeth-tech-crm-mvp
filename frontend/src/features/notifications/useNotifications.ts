'use client';

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import {
    enqueueNotification,
    type NotificationTone,
} from '@/src/features/notifications/notificationsSlice';
import type { AppDispatch } from '@/src/lib/store';

type NotifyOptions = {
    title?: string;
    duration?: number;
};

export function useNotifications() {
    const dispatch = useDispatch<AppDispatch>();

    const notify = useCallback(
        (tone: NotificationTone, message: string, options?: NotifyOptions) => {
            dispatch(
                enqueueNotification({
                    tone,
                    message,
                    title: options?.title,
                    duration: options?.duration,
                })
            );
        },
        [dispatch]
    );

    const notifyError = useCallback(
        (message: string, options?: NotifyOptions) => notify('error', message, options),
        [notify]
    );

    const notifySuccess = useCallback(
        (message: string, options?: NotifyOptions) => notify('success', message, options),
        [notify]
    );

    return { notify, notifyError, notifySuccess };
}
