'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import {useTranslations} from 'next-intl';

import {
    dismissNotification,
    type AppNotification,
} from '@/src/features/notifications/notificationsSlice';
import type { AppDispatch, RootState } from '@/src/lib/store';

const EXIT_ANIMATION_MS = 260;

function StatusIcon({ tone }: Pick<AppNotification, 'tone'>) {
	if (tone === 'message') {
		return (
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
				<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}

    if (tone === 'success') {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="m5 12.5 4.2 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M12 7.5v5.25M12 16.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M10.2 4.45 2.85 17.1A2 2 0 0 0 4.58 20h14.84a2 2 0 0 0 1.73-2.9L13.8 4.45a2.08 2.08 0 0 0-3.6 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

function NotificationToast({ notification }: { notification: AppNotification }) {
    const t = useTranslations('common.notifications');
    const dispatch = useDispatch<AppDispatch>();
	const router = useRouter();
    const [isLeaving, setIsLeaving] = useState(false);
    const isLeavingRef = useRef(false);
    const removeTimerRef = useRef<number | null>(null);

    const dismiss = useCallback(() => {
        if (isLeavingRef.current) return;

        isLeavingRef.current = true;
        setIsLeaving(true);
        removeTimerRef.current = window.setTimeout(() => {
            dispatch(dismissNotification(notification.id));
        }, EXIT_ANIMATION_MS);
    }, [dispatch, notification.id]);

    useEffect(() => {
        const leaveTimer = window.setTimeout(
            dismiss,
            Math.max(notification.duration - EXIT_ANIMATION_MS, 0)
        );

        return () => {
            window.clearTimeout(leaveTimer);
            if (removeTimerRef.current !== null) {
                window.clearTimeout(removeTimerRef.current);
            }
        };
    }, [dismiss, notification.duration]);

    const isSuccess = notification.tone === 'success';
	const isMessage = notification.tone === 'message';
    const displayTitle = notification.title || (
        isSuccess ? t('successTitle') : isMessage ? t('newMessage') : t('errorTitle')
    );
	const openNotification = () => {
		if (!notification.href) return;
		router.push(notification.href);
		dismiss();
	};

    return (
        <article
            role={notification.tone === 'error' ? 'alert' : 'status'}
			aria-live={notification.tone === 'error' ? 'assertive' : 'polite'}
            tabIndex={notification.href ? 0 : undefined}
			onClick={openNotification}
            onKeyDown={(event) => {
                if (notification.href && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
					openNotification();
                }
            }}
            className={`notification-toast relative w-full overflow-hidden rounded-2xl border bg-white/95 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:bg-slate-900/95 dark:shadow-[0_18px_50px_-18px_rgba(0,0,0,0.8)] ${notification.href ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500' : ''} ${
                isLeaving ? 'notification-toast--leaving' : 'notification-toast--entering'
            } ${
                isMessage
                    ? 'border-blue-200/90 dark:border-blue-800/80'
                    : isSuccess
                      ? 'border-emerald-200/90 dark:border-emerald-800/80'
                      : 'border-red-200/90 dark:border-red-800/80'
            }`}
        >
            <div className="flex items-start gap-3.5 px-4 pb-4 pt-4 sm:px-5">
                <div
					className={`flex h-11 w-11 shrink-0 items-center justify-center ${isMessage ? 'rounded-full text-sm font-black' : 'rounded-xl'} ${
						isMessage
							? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
							: isSuccess
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                    }`}
                >
					{isMessage ? (
						displayTitle.trim().slice(0, 1).toLocaleUpperCase() || '•'
					) : (
						<StatusIcon tone={notification.tone} />
					)}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
					{isMessage ? (
						<p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
							{t('newMessage')}
						</p>
					) : null}
                    <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                        {displayTitle}
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                        {notification.message}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        dismiss();
                    }}
                    aria-label={t('close')}
                    className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                    &times;
                </button>
            </div>

			<div className={`h-1 w-full ${isMessage ? 'bg-blue-100' : isSuccess ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <div
                    className={`notification-toast__progress h-full ${
						isMessage ? 'bg-blue-600' : isSuccess ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ animationDuration: `${notification.duration}ms` }}
                />
            </div>
        </article>
    );
}

export default function NotificationViewport() {
    const t = useTranslations('common.notifications');
    const notifications = useSelector((state: RootState) => state.notifications.items);

    return (
        <div
            aria-label={t('region')}
			className="pointer-events-none fixed inset-x-3 top-3 z-[120] flex flex-col items-center gap-3 sm:left-auto sm:right-5 sm:top-5 sm:w-[min(26rem,calc(100vw-2.5rem))] sm:items-stretch"
        >
            {notifications.map((notification) => (
                <div key={notification.id} className="pointer-events-auto w-full max-w-md sm:max-w-none">
                    <NotificationToast notification={notification} />
                </div>
            ))}
        </div>
    );
}
