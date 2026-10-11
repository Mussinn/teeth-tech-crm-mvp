'use client';

import type { ReactNode } from 'react';
import {useTranslations} from 'next-intl';

type QueryErrorNoticeProps = {
    message: ReactNode;
    onRetry?: () => void;
    isRetrying?: boolean;
    className?: string;
};

export default function QueryErrorNotice({
    message,
    onRetry,
    isRetrying = false,
    className = '',
}: QueryErrorNoticeProps) {
    const t = useTranslations('common.actions');
    return (
        <div
            role="alert"
            className={`flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between ${className}`}
        >
            <p className="font-semibold leading-5">{message}</p>
            {onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:bg-red-300"
                >
                    {isRetrying ? t('retrying') : t('retry')}
                </button>
            ) : null}
        </div>
    );
}
