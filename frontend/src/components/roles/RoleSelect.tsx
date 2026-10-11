'use client';

import { useEffect, useRef, useState } from 'react';
import {useTranslations} from 'next-intl';

import type { Role } from '@/src/types/role.types';

type RoleSelectProps = {
    value: string;
    roles: Role[];
    onChange: (code: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    canCreate?: boolean;
    onCreateRequest?: () => void;
    className?: string;
};

export default function RoleSelect({
    value,
    roles,
    onChange,
    isLoading = false,
    disabled = false,
    required = false,
    placeholder,
    canCreate = false,
    onCreateRequest,
    className = '',
}: RoleSelectProps) {
    const t = useTranslations('laboratory.roles.select');
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = roles.find((role) => role.code === value);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled || isLoading}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((current) => !current)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-left outline-none transition hover:bg-white focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
                {isLoading ? (
                    <span className="text-sm text-slate-400">{t('loading')}</span>
                ) : selected ? (
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{selected.name}</span>
                        <span className="block truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">{selected.code}</span>
                    </span>
                ) : value ? (
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{t('unavailable')}</span>
                        <span className="block truncate font-mono text-[10px] text-slate-400">{value}</span>
                    </span>
                ) : (
                    <span className="text-sm text-slate-400">{placeholder ?? t('placeholder')}</span>
                )}
                <span className={`shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
            </button>

            {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => undefined} className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0" />}

            {isOpen && (
                <div role="listbox" className="absolute z-50 mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 sm:min-w-[16rem]">
                    {!required && (
                        <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                            {t('none')}
                        </button>
                    )}
                    {roles.map((role) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={role.code === value}
                            key={role.id}
                            onClick={() => { onChange(role.code); setIsOpen(false); }}
                            className={`w-full rounded-lg px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-500/15 ${role.code === value ? 'bg-violet-50 dark:bg-violet-500/15' : ''}`}
                        >
                            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{role.name}</span>
                            <span className="block font-mono text-[10px] text-slate-400 dark:text-slate-500">{role.code}</span>
                        </button>
                    ))}
                    {roles.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">{t('empty')}</p>}
                    {(canCreate || onCreateRequest) && (
                        <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
                            {canCreate ? (
                                <button type="button" onClick={() => { setIsOpen(false); onCreateRequest?.(); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-violet-600 hover:bg-violet-50">
                                    {t('create')}
                                </button>
                            ) : (
                                <p className="px-3 py-2 text-xs text-slate-400">{t('contactAdmin')}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
