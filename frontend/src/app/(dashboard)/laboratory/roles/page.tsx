'use client';

import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSelector } from 'react-redux';

import RoleCreateModal from '@/src/components/roles/RoleCreateModal';
import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import type { RootState } from '@/src/lib/store';
import {
    useDeleteRoleMutation,
    useGetRolesQuery,
    useUpdateRoleMutation,
} from '@/src/services/api/rolesApi';
import type { Role } from '@/src/types/role.types';
import { useAppLocale } from '@/src/i18n/provider';
import { intlLocaleByLocale } from '@/src/i18n/config';

function normalizedJwtRoles(roles: string[]) {
    return roles.map((role) => role.toUpperCase().replace(/^ROLE_/u, ''));
}

type RoleTranslator = ReturnType<typeof useTranslations<'laboratory.roleManagement'>>;

function deleteUnavailableReason(role: Role, t: RoleTranslator) {
    if (role.systemManaged) return t('systemDeleteBlocked');
    if (role.assignedUsers > 0) return t('assignedDeleteBlocked', {count: role.assignedUsers});
    if (role.workflowSteps > 0) return t('workflowDeleteBlocked', {count: role.workflowSteps});
    return t('backendDeleteBlocked');
}

function RoleSkeleton() {
    const t = useTranslations('laboratory.roleManagement');
    return (
        <div className="space-y-3" aria-busy="true" aria-label={t('loading')}>
            {[0, 1, 2].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
        </div>
    );
}

function RoleCounters({ role }: { role: Role }) {
    const t = useTranslations('laboratory.roleManagement');
    return (
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                {t('employees', {count: role.assignedUsers})}
            </span>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                {t('transitions', {count: role.workflowSteps})}
            </span>
        </div>
    );
}

export default function RolesManagementPage() {
    const t = useTranslations('laboratory.roleManagement');
    const commonT = useTranslations('common');
    const {locale} = useAppLocale();
    const intlLocale = intlLocaleByLocale[locale];
    const jwtRoles = useSelector((state: RootState) => state.auth.roles);
    const normalizedRoles = normalizedJwtRoles(jwtRoles);
    const isAdmin = normalizedRoles.includes('ADMIN');
    const canView = isAdmin || normalizedRoles.includes('CHIEF_TECHNICIAN');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [editingName, setEditingName] = useState('');
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
    const {
        data: roles = [],
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useGetRolesQuery(undefined, { skip: !canView });
    const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
    const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

    const groupedRoles = useMemo(() => {
        const byName = (left: Role, right: Role) => left.name.localeCompare(right.name, intlLocale);
        return {
            system: roles.filter((role) => role.systemManaged).sort(byName),
            production: roles.filter((role) => !role.systemManaged).sort(byName),
        };
    }, [intlLocale, roles]);

    if (!canView) {
        return (
            <section className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-lg font-black text-red-800">{t('forbidden')}</h1>
                <p className="mt-2 text-sm text-red-700">{t('forbiddenHint')}</p>
            </section>
        );
    }

    const openEditor = (role: Role) => {
        if (!isAdmin || role.systemManaged) return;
        setEditingRole(role);
        setEditingName(role.name);
    };

    const saveRoleName = async () => {
        if (!editingRole || isUpdating || !editingName.trim()) return;
        try {
            await updateRole({
                roleId: editingRole.id,
                body: { name: editingName.trim() },
            }).unwrap();
            setEditingRole(null);
        } catch (error) {
            if ((error as FetchBaseQueryError)?.status === 404) void refetch();
            console.error('Role update failed:', error);
        }
    };

    const handleDelete = async () => {
        if (!roleToDelete || !isAdmin || roleToDelete.systemManaged || !roleToDelete.deletable || isDeleting) return;
        try {
            await deleteRole(roleToDelete.id).unwrap();
            setRoleToDelete(null);
        } catch (error) {
            if ((error as FetchBaseQueryError)?.status === 404) void refetch();
            console.error('Role delete failed:', error);
        }
    };

    const renderRole = (role: Role) => (
        <article key={role.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {role.systemManaged && (
                            <span title={t('systemManaged')} aria-label={t('systemRole')} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm">🔒</span>
                        )}
                        <h3 className="truncate font-bold text-slate-950">{role.name}</h3>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">{role.code}</p>
                    {role.systemManaged && <p className="mt-2 text-xs font-semibold text-slate-500">{t('systemManaged')}</p>}
                    <div className="mt-3"><RoleCounters role={role} /></div>
                </div>

                {role.systemManaged ? (
                    <span title={t('editUnavailableHint')} className="inline-flex cursor-help items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
                        {t('editUnavailable')}
                    </span>
                ) : isAdmin ? (
                    <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => openEditor(role)} disabled={isUpdating || isDeleting} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            {t('edit')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleToDelete(role)}
                            disabled={!role.deletable || isDeleting || isUpdating}
                            title={role.deletable ? t('delete') : deleteUnavailableReason(role, t)}
                            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                        >
                            {isDeleting ? t('deleting') : commonT('actions.delete')}
                        </button>
                    </div>
                ) : null}
            </div>
        </article>
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
            <header className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">{t('badge')}</p>
                    <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{t('title')}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">{t('subtitle')}</p>
                </div>
                {isAdmin && (
                    <button type="button" onClick={() => setIsCreateOpen(true)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700">
                        {t('create')}
                    </button>
                )}
            </header>

            {isError && (
                <QueryErrorNotice message={t('loadError')} onRetry={() => void refetch()} isRetrying={isFetching} />
            )}

            {isLoading ? <RoleSkeleton /> : (
                <>
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-black text-slate-950">{t('systemTitle')}</h2>
                            <p className="mt-1 text-xs text-slate-500">{t('systemHint')}</p>
                        </div>
                        {groupedRoles.system.map(renderRole)}
                        {groupedRoles.system.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{t('systemEmpty')}</p>}
                    </section>

                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-black text-slate-950">{t('productionTitle')}</h2>
                            <p className="mt-1 text-xs text-slate-500">{t('productionHint')}</p>
                        </div>
                        {groupedRoles.production.map(renderRole)}
                        {groupedRoles.production.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{t('productionEmpty')}</p>}
                    </section>
                </>
            )}

            {isCreateOpen && <RoleCreateModal onClose={() => setIsCreateOpen(false)} />}

            {editingRole && (
                <Modal contentClassName="max-w-md p-0">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-lg font-black text-slate-950">{t('editTitle')}</h2>
                        <p className="mt-1 font-mono text-xs text-slate-400">{editingRole.code}</p>
                    </div>
                    <div className="px-5 py-5">
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('name')}</span>
                            <input autoFocus required maxLength={255} value={editingName} onChange={(event) => setEditingName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:bg-white" />
                        </label>
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
                        <button type="button" onClick={() => setEditingRole(null)} disabled={isUpdating} className="min-h-11 rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">{commonT('actions.cancel')}</button>
                        <button type="button" onClick={() => void saveRoleName()} disabled={isUpdating || !editingName.trim()} className="min-h-11 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-slate-300">
                            {isUpdating ? t('saving') : commonT('actions.save')}
                        </button>
                    </div>
                </Modal>
            )}
            <ConfirmDialog
                open={roleToDelete !== null}
                title={t('deleteTitle')}
                description={t('deleteDescription', {name: roleToDelete?.name ?? ''})}
                confirmLabel={t('deleteConfirm')}
                isLoading={isDeleting}
                onClose={() => setRoleToDelete(null)}
                onConfirm={handleDelete}
            />
        </div>
    );
}
