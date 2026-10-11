import { type FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import WorkDirectionMultiSelect from '@/src/components/work-directions/WorkDirectionMultiSelect';
import { hasAuthRole } from '@/src/features/auth/authUtils';
import { useGetRolesQuery } from '@/src/services/api/rolesApi';
import { useUpdateUserAdminSetupMutation } from '@/src/services/api/usersApi';
import { useGetWorkDirectionsQuery } from '@/src/services/api/workDirectionsApi';
import type { User } from '@/src/types/user.types';
import { normalizeEmployeeStatus } from '@/src/utils/employeesUtils';

type EditEmployeeAdminSetupModalProps = {
    user: User;
    onClose: () => void;
};

export default function EditEmployeeAdminSetupModal({
    user,
    onClose,
}: EditEmployeeAdminSetupModalProps) {
    const t = useTranslations('employees.edit');
    const commonT = useTranslations('common.actions');
    const initialRoles = useMemo(
        () => user.roles?.length ? user.roles : user.role ? [user.role] : [],
        [user.role, user.roles]
    );
    const [roles, setRoles] = useState(initialRoles);
    const [status, setStatus] = useState(() => normalizeEmployeeStatus(user.status));
    const [workDirectionIds, setWorkDirectionIds] = useState(
        () => user.workDirections?.map((direction) => direction.id) ?? []
    );
    const [formError, setFormError] = useState('');
    const rolesQuery = useGetRolesQuery();
    const directionsQuery = useGetWorkDirectionsQuery({ includeInactive: true });
    const [updateSetup, updateState] = useUpdateUserAdminSetupMutation();
    const isDispatcher = hasAuthRole(roles, 'DISPATCHER');

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (roles.length === 0) {
            setFormError(t('roleRequired'));
            return;
        }

        if (isDispatcher && workDirectionIds.length === 0) {
            setFormError(t('directionRequired'));
            return;
        }

        setFormError('');

        try {
            await updateSetup({
                id: user.id,
                body: { roles, status, workDirectionIds },
            }).unwrap();
            onClose();
        } catch {
            // Сообщение backend уже отображается глобальным обработчиком API.
        }
    };

    return (
        <Modal contentClassName="max-w-3xl overflow-hidden p-0">
            <form onSubmit={handleSubmit}>
                <header className="border-b border-slate-100 px-5 py-5 sm:px-7">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">{t('badge')}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{t('title')}</h2>
                    <p className="mt-1 text-xs text-slate-500">{user.fullName}</p>
                </header>

                <div className="max-h-[70dvh] space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('status')}</span>
                        <select value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500">
                            {(['ACTIVE', 'INACTIVE'] as const).map((value) => (
                                <option key={value} value={value}>{t(`statuses.${value}`)}</option>
                            ))}
                        </select>
                    </label>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-black text-slate-900">{t('roles')}</h3>
                        {rolesQuery.isError ? (
                            <div className="mt-3"><QueryErrorNotice message={t('rolesError')} onRetry={() => void rolesQuery.refetch()} isRetrying={rolesQuery.isFetching} /></div>
                        ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {(rolesQuery.data ?? []).map((role) => {
                                    const checked = hasAuthRole(roles, role.code);
                                    return (
                                        <label key={role.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => setRoles((current) => checked
                                                    ? current.filter((code) => !hasAuthRole([code], role.code))
                                                    : [...current, role.code]
                                                )}
                                                className="h-4 w-4 accent-violet-600"
                                            />
                                            <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{role.name}</span><span className="block truncate font-mono text-[10px] text-slate-400">{role.code}</span></span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {isDispatcher ? (
                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-black text-slate-900">{t('workDirections')}</h3>
                            <p className="mt-1 text-xs text-slate-500">{t('workDirectionsHint')}</p>
                            <div className="mt-3">
                                {directionsQuery.isError ? (
                                    <QueryErrorNotice message={t('directionsError')} onRetry={() => void directionsQuery.refetch()} isRetrying={directionsQuery.isFetching} />
                                ) : (
                                    <WorkDirectionMultiSelect
                                        directions={directionsQuery.data ?? []}
                                        value={workDirectionIds}
                                        onChange={(ids) => {
                                            setWorkDirectionIds(ids);
                                            if (ids.length > 0) setFormError('');
                                        }}
                                        disabled={directionsQuery.isLoading || updateState.isLoading}
                                        emptyText={t('directionsEmpty')}
                                    />
                                )}
                            </div>
                        </section>
                    ) : workDirectionIds.length > 0 ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                            {t('directionsPreserved', { count: workDirectionIds.length })}
                        </p>
                    ) : null}

                    {formError && <p role="alert" className="text-sm font-semibold text-red-600">{formError}</p>}
                </div>

                <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                    <button type="button" onClick={onClose} disabled={updateState.isLoading} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">{commonT('cancel')}</button>
                    <button type="submit" disabled={updateState.isLoading || rolesQuery.isError || (isDispatcher && directionsQuery.isError)} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-slate-300">{updateState.isLoading ? t('saving') : commonT('save')}</button>
                </footer>
            </form>
        </Modal>
    );
}
