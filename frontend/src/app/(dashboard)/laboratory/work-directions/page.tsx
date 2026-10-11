'use client';

import { type FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSelector } from 'react-redux';

import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import { normalizeAuthRoles } from '@/src/features/auth/authUtils';
import type { RootState } from '@/src/lib/store';
import {
    useCreateWorkDirectionMutation,
    useGetWorkDirectionsQuery,
    useUpdateWorkDirectionMutation,
} from '@/src/services/api/workDirectionsApi';
import type { WorkDirection, WorkDirectionRequest } from '@/src/types/workDirection.types';

const emptyDraft: WorkDirectionRequest = {
    name: '',
    code: '',
    description: null,
    active: true,
};

const latinCodePattern = /^[A-Za-z][A-Za-z0-9_]*$/u;

export default function WorkDirectionsPage() {
    const t = useTranslations('workDirections.management');
    const commonT = useTranslations('common.actions');
    const roles = useSelector((state: RootState) => state.auth.roles);
    const isAdmin = normalizeAuthRoles(roles).includes('ADMIN');
    const [editing, setEditing] = useState<WorkDirection | null | undefined>(undefined);
    const [draft, setDraft] = useState<WorkDirectionRequest>(emptyDraft);
    const [validationError, setValidationError] = useState('');
    const query = useGetWorkDirectionsQuery(
        { includeInactive: true },
        { skip: !isAdmin }
    );
    const [createDirection, createState] = useCreateWorkDirectionMutation();
    const [updateDirection, updateState] = useUpdateWorkDirectionMutation();
    const isSaving = createState.isLoading || updateState.isLoading;

    const openCreate = () => {
        setEditing(null);
        setDraft(emptyDraft);
        setValidationError('');
    };

    const openEdit = (direction: WorkDirection) => {
        setEditing(direction);
        setDraft({
            name: direction.name,
            code: direction.code,
            description: direction.description,
            active: direction.active,
        });
        setValidationError('');
    };

    const closeModal = () => {
        if (!isSaving) setEditing(undefined);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = draft.name.trim();
        const code = draft.code.trim();

        if (!name) {
            setValidationError(t('nameRequired'));
            return;
        }

        if (!latinCodePattern.test(code)) {
            setValidationError(t('codeInvalid'));
            return;
        }

        const body: WorkDirectionRequest = {
            name,
            code,
            description: draft.description?.trim() || null,
            active: draft.active,
        };

        try {
            if (editing) {
                await updateDirection({ id: editing.id, body }).unwrap();
            } else {
                await createDirection(body).unwrap();
            }
            setEditing(undefined);
        } catch {
            // Глобальный обработчик API уже показывает сообщение backend.
        }
    };

    if (!isAdmin) {
        return (
            <section className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-lg font-black text-red-800">{t('forbidden')}</h1>
                <p className="mt-2 text-sm text-red-700">{t('forbiddenHint')}</p>
            </section>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-5 pb-8">
            <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('badge')}</p>
                    <h1 className="mt-1 text-2xl font-black text-slate-950">{t('title')}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">{t('subtitle')}</p>
                </div>
                <button type="button" onClick={openCreate} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700">
                    {t('create')}
                </button>
            </header>

            {query.isError && (
                <QueryErrorNotice
                    message={t('loadError')}
                    onRetry={() => void query.refetch()}
                    isRetrying={query.isFetching}
                />
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-3">{t('name')}</th>
                                <th className="px-5 py-3">{t('code')}</th>
                                <th className="px-5 py-3">{t('description')}</th>
                                <th className="px-5 py-3">{t('status')}</th>
                                <th className="px-5 py-3 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {query.isLoading && (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">{t('loading')}</td></tr>
                            )}
                            {!query.isLoading && !query.isError && (query.data ?? []).map((direction) => (
                                <tr key={direction.id} className="hover:bg-slate-50/70">
                                    <td className="px-5 py-4 font-bold text-slate-900">{direction.name}</td>
                                    <td className="px-5 py-4 font-mono text-xs uppercase text-slate-600">{direction.code}</td>
                                    <td className="max-w-md px-5 py-4 text-slate-500">{direction.description || t('noDescription')}</td>
                                    <td className="px-5 py-4"><WorkDirectionBadge code={direction.code} name={direction.active ? t('active') : t('inactive')} /></td>
                                    <td className="px-5 py-4 text-right">
                                        <button type="button" onClick={() => openEdit(direction)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                                            {commonT('edit')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!query.isLoading && !query.isError && (query.data ?? []).length === 0 && (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">{t('empty')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {editing !== undefined && (
                <Modal contentClassName="max-w-xl overflow-hidden p-0">
                    <form onSubmit={handleSubmit}>
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="text-lg font-black text-slate-950">{editing ? t('editTitle') : t('createTitle')}</h2>
                        </div>
                        <div className="space-y-4 px-5 py-5">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('name')}</span>
                                <input autoFocus required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500" />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('code')}</span>
                                <input required value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.replace(/[^A-Za-z0-9_]/gu, '') }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-violet-500" />
                                <span className="mt-1 block text-[11px] text-slate-400">{t('codeHint')}</span>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('description')}</span>
                                <textarea rows={3} value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500" />
                            </label>
                            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                                <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-violet-600" />
                                {t('activeField')}
                            </label>
                            {validationError && <p role="alert" className="text-sm font-semibold text-red-600">{validationError}</p>}
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={closeModal} disabled={isSaving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">{commonT('cancel')}</button>
                            <button type="submit" disabled={isSaving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-slate-300">{isSaving ? t('saving') : commonT('save')}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
