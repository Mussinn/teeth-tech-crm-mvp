'use client'

import {ReactNode, useEffect, useRef, useState} from "react";
import {Provider} from "react-redux";
import {useTranslations} from 'next-intl';
import {finishAuthHydration, setUser} from '@/src/features/auth/authSlice';
import {enqueueNotification} from '@/src/features/notifications/notificationsSlice';
import {normalizeAuthRole} from '@/src/features/auth/authUtils';
import type {AuthSession} from '@/src/types/auth.types';
import NotificationViewport from '@/src/components/ui/NotificationViewport';
import {makeStore} from '../lib/store';
import {resetChatRealtime} from '@/src/services/chatRealtimeService';
import {
    INACTIVE_ACCOUNT_STORAGE_KEY,
    isInactiveAccountPayload,
} from '@/src/lib/inactiveAccount';

export default function StoreProvider({children}: {children: ReactNode}){
 const t = useTranslations('common.notifications');
 const tRef = useRef(t);
 const [store] = useState(makeStore);

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    useEffect(() => {
        let isMounted = true;

        const hydrateAuth = async () => {
            try {
                const response = await fetch('/api/auth/session', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                });

                if (!isMounted) return;

                if (!response.ok) {
                    if (response.status === 401) {
                        const payload = await response.json().catch(() => null);
                        if (isInactiveAccountPayload(payload)) {
                            window.sessionStorage.setItem(INACTIVE_ACCOUNT_STORAGE_KEY, '1');
                            window.location.replace('/auth/login?reason=inactive');
                        }
                    }
                    if (response.status !== 401) {
                        store.dispatch(
                            enqueueNotification({
                                tone: 'error',
                                message: tRef.current('sessionCheckFailed'),
                            })
                        );
                    }
                    store.dispatch(finishAuthHydration());
                    return;
                }

                const session = (await response.json()) as AuthSession;
                const role = normalizeAuthRole(session.roles);

                store.dispatch(
                    setUser({
                        id: session.id,
                        name: session.email,
                        role,
                        avatarUrl: '',
                        roles: session.roles,
                    })
                );
            } catch (error) {
                if (isMounted) {
                    console.error('Auth session hydration failed:', error);
                    store.dispatch(
                        enqueueNotification({
                            tone: 'error',
                            message: tRef.current('authServerUnavailable'),
                        })
                    );
                    store.dispatch(finishAuthHydration());
                }
            }
        };

        hydrateAuth();

        return () => {
            isMounted = false;
        };
    }, [store]);

    useEffect(() => {
        let previousUserId = store.getState().auth.id;

        return store.subscribe(() => {
            const nextUserId = store.getState().auth.id;

            if (previousUserId && previousUserId !== nextUserId) {
                resetChatRealtime();
            }

            previousUserId = nextUserId;
        });
    }, [store]);

    return (
        <Provider store={store}>
            {children}
            <NotificationViewport />
        </Provider>
    );
}
