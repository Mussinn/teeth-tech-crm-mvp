'use client';

import type { ReactNode } from 'react';
import {useTranslations} from 'next-intl';

import Modal from '@/src/components/ui/Modal';

type ConfirmDialogTone = 'danger' | 'warning' | 'primary';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    tone?: ConfirmDialogTone;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

const toneStyles: Record<ConfirmDialogTone, {
    icon: string;
    iconClassName: string;
    buttonClassName: string;
}> = {
    danger: {
        icon: '!',
        iconClassName: 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
        buttonClassName: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300',
    },
    warning: {
        icon: '!',
        iconClassName: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
        buttonClassName: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-300',
    },
    primary: {
        icon: '✓',
        iconClassName: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60',
        buttonClassName: 'bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-300',
    },
};

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    isLoading = false,
    tone = 'danger',
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const t = useTranslations('common.actions');
    if (!open) return null;

    const styles = toneStyles[tone];
    const resolvedConfirmLabel = confirmLabel ?? t('confirm');
    const resolvedCancelLabel = cancelLabel ?? t('cancel');

    return (
        <Modal contentClassName="max-w-md overflow-hidden p-0">
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <div className="flex gap-4 p-5 sm:p-6">
                    <span
                        aria-hidden="true"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ring-1 ${styles.iconClassName}`}
                    >
                        {styles.icon}
                    </span>
                    <div className="min-w-0">
                        <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-950 dark:text-white">
                            {title}
                        </h2>
                        <div id="confirm-dialog-description" className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {description}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {resolvedCancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => void onConfirm()}
                        disabled={isLoading}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${styles.buttonClassName}`}
                    >
                        {isLoading ? t('processing') : resolvedConfirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
