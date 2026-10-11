import type { ReactNode } from 'react';
import {useTranslations} from 'next-intl';

type ErrorStateProps = {
    children: ReactNode;
    title?: string;
    compact?: boolean;
    onRetry?: () => void;
    isRetrying?: boolean;
};

export default function ErrorState({
    children,
    title,
    compact = false,
    onRetry,
    isRetrying = false,
}: ErrorStateProps) {
    const tActions = useTranslations('common.actions');
    const tStates = useTranslations('common.states');
    return (
        <section
            role="alert"
            className={`mx-auto w-full rounded-2xl border border-red-200 bg-white shadow-sm ${
                compact ? 'p-4' : 'max-w-2xl p-6 sm:p-8'
            }`}
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                        <path d="M12 7.5v5.25M12 16.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M10.2 4.45 2.85 17.1A2 2 0 0 0 4.58 20h14.84a2 2 0 0 0 1.73-2.9L13.8 4.45a2.08 2.08 0 0 0-3.6 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-base font-extrabold text-slate-900 sm:text-lg">{title ?? tStates('loadFailed')}</h1>
                    <div className="mt-1.5 text-sm leading-6 text-slate-600">{children}</div>
                    {onRetry ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            disabled={isRetrying}
                            className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:bg-red-300"
                        >
                            {isRetrying ? tActions('retrying') : tActions('retry')}
                        </button>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
