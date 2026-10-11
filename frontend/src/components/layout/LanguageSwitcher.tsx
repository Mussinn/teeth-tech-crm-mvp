'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';

import {
    localeLabels,
    localeShortLabels,
    locales,
    type Locale,
} from '@/src/i18n/config';
import {useAppLocale} from '@/src/i18n/provider';

type LanguageSwitcherProps = {
    compact?: boolean;
};

export default function LanguageSwitcher({compact = false}: LanguageSwitcherProps) {
    const t = useTranslations('common.language');
    const {locale, isChangingLocale, setLocale} = useAppLocale();
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    const chooseLocale = async (nextLocale: Locale) => {
        setIsOpen(false);
        await setLocale(nextLocale);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                disabled={isChangingLocale}
                aria-label={t('label')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white font-black text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${
                    compact ? 'w-10 text-[11px]' : 'min-w-24 px-3 text-xs'
                }`}
            >
                {isChangingLocale ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                ) : (
                    <span>{localeShortLabels[locale]}</span>
                )}
                {!compact && (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="m6 8 4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </button>

            {isOpen && (
                <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-[90] min-w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                    {locales.map((item) => (
                        <button
                            key={item}
                            type="button"
                            role="menuitemradio"
                            aria-checked={item === locale}
                            onClick={() => void chooseLocale(item)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition ${
                                item === locale
                                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                            aria-label={t('switchTo', {language: localeLabels[item]})}
                        >
                            <span>{localeLabels[item]}</span>
                            <span className="text-[10px] uppercase text-slate-400">{localeShortLabels[item]}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
