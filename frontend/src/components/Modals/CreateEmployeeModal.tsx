import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

import RoleSelect from '@/src/components/roles/RoleSelect';
import Modal from '@/src/components/ui/Modal';
import PhoneInput from '@/src/components/ui/PhoneInput';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import WorkDirectionMultiSelect from '@/src/components/work-directions/WorkDirectionMultiSelect';
import { hasAuthRole } from '@/src/features/auth/authUtils';
import { useRegisterUserMutation } from '@/src/services/api/authApi';
import { useGetRolesQuery } from '@/src/services/api/rolesApi';
import { useUpdateUserAdminSetupMutation } from '@/src/services/api/usersApi';
import { useGetWorkDirectionsQuery } from '@/src/services/api/workDirectionsApi';
import type { Register } from '@/src/types/auth.types';
import type { EmployeeStatus } from '@/src/types/user.types';

type CreateEmployeeModalProps = {
    onClose: () => void;
};

type CreateEmployeeWithRolesOptions = {
    employee: Omit<Register, 'role'>;
    roles: string[];
    createEmployee: (body: Register) => Promise<string>;
    updateAdminSetup: (
        id: string,
        body: { roles: string[]; status: EmployeeStatus; workDirectionIds: string[] }
    ) => Promise<void>;
};

export async function createEmployeeWithRoles({
    employee,
    roles,
    createEmployee,
    updateAdminSetup,
}: CreateEmployeeWithRolesOptions) {
    const [primaryRole] = roles;

    if (!primaryRole) {
        throw new Error('At least one employee role is required');
    }

    const employeeId = await createEmployee({
        ...employee,
        role: primaryRole,
    });

    if (roles.length > 1 || hasAuthRole(roles, 'DISPATCHER')) {
        await updateAdminSetup(employeeId, {
            roles,
            status: 'ACTIVE',
            workDirectionIds: employee.workDirectionIds ?? [],
        });
    }

    return employeeId;
}

export default function CreateEmployeeModal({ onClose }: CreateEmployeeModalProps) {
    const t = useTranslations('employees.create');
    const commonT = useTranslations('common');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [workDirectionIds, setWorkDirectionIds] = useState<string[]>([]);
    const [formError, setFormError] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const {
        data: roles = [],
        isLoading: isRolesLoading,
        isFetching: isRolesFetching,
        isError: isRolesError,
        refetch: refetchRoles,
    } = useGetRolesQuery();
    const isDispatcher = hasAuthRole(selectedRoles, 'DISPATCHER');
    const directionsQuery = useGetWorkDirectionsQuery(undefined, { skip: !isDispatcher });
    const [registerUser, { isLoading: isCreatingUser }] = useRegisterUserMutation();
    const [
        updateUserAdminSetup,
        { isLoading: isAssigningRoles },
    ] = useUpdateUserAdminSetupMutation();
    const isLoading = isCreatingUser || isAssigningRoles;
    const unselectedRoles = roles.filter(
        (role) => !selectedRoles.includes(role.code)
    );

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isLoading || selectedRoles.length === 0) return;
        if (isDispatcher && workDirectionIds.length === 0) {
            setFormError(t('directionRequired'));
            return;
        }
        setFormError('');

        try {
            await createEmployeeWithRoles({
                employee: {
                    fullName: name,
                    email,
                    phone,
                    password: tempPassword,
                    workDirectionIds,
                },
                roles: selectedRoles,
                createEmployee: (body) => registerUser(body).unwrap(),
                updateAdminSetup: (id, body) =>
                    updateUserAdminSetup({ id, body }).unwrap(),
            });
            onClose();
        } catch (error) {
            console.error('Failed to create employee:', error);
        }
    };

    return (
        <Modal contentClassName="max-w-3xl overflow-hidden p-0">
            <form onSubmit={handleSubmit}>
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">{t('badge')}</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t('title')}</h2>
                        <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
                    </div>
                    <button
                        type="button"
                        className="rounded-lg px-2 text-xl font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                        onClick={onClose}
                        aria-label={commonT('actions.close')}
                    >
                        ×
                    </button>
                </header>

                <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                    {isRolesError && (
                        <QueryErrorNotice
                            message={t('rolesError')}
                            onRetry={() => void refetchRoles()}
                            isRetrying={isRolesFetching}
                        />
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t('name')}</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder={t('namePlaceholder')}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="employee@example.com"
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t('phone')}</span>
                            <PhoneInput
                                value={phone}
                                onValueChange={setPhone}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t('password')}</span>
                            <input
                                type="text"
                                value={tempPassword}
                                onChange={(event) => setTempPassword(event.target.value)}
                                placeholder={t('passwordPlaceholder')}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                            />
                        </label>
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70 sm:p-5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">{t('roles')}</h3>
                                <p className="mt-1 text-xs text-slate-500">{t('rolesHint')}</p>
                            </div>
                            <span className="text-xs font-bold text-violet-600">{t('selected', {count: selectedRoles.length})}</span>
                        </div>

                        {selectedRoles.length > 0 && (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                {selectedRoles.map((code) => {
                                    const role = roles.find((item) => item.code === code);

                                    return (
                                        <div key={code} className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white px-3 py-2.5 dark:border-violet-500/40 dark:bg-slate-900">
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{role?.name ?? code}</span>
                                                <span className="block truncate font-mono text-[10px] text-slate-400">{code}</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRoles((current) => current.filter((item) => item !== code))}
                                                disabled={isLoading}
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                aria-label={t('removeRole', {role: role?.name ?? code})}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-4">
                            <RoleSelect
                                value=""
                                onChange={(code) => {
                                    if (!code) return;
                                    setSelectedRoles((current) =>
                                        current.includes(code) ? current : [...current, code]
                                    );
                                }}
                                roles={unselectedRoles}
                                isLoading={isRolesLoading}
                                disabled={isRolesError || unselectedRoles.length === 0}
                                placeholder={
                                    selectedRoles.length > 0 && unselectedRoles.length === 0
                                        ? t('allSelected')
                                        : isRolesError
                                            ? t('rolesUnavailable')
                                            : t('addRole')
                                }
                            />
                        </div>

                        {selectedRoles.length === 0 && (
                            <p className="mt-2 text-xs font-medium text-amber-600">{t('roleRequired')}</p>
                        )}
                    </section>

                    {isDispatcher && (
                        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70 sm:p-5">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">{t('workDirections')}</h3>
                                <p className="mt-1 text-xs text-slate-500">{t('workDirectionsHint')}</p>
                            </div>
                            <div className="mt-4">
                                {directionsQuery.isError ? (
                                    <QueryErrorNotice
                                        message={t('directionsError')}
                                        onRetry={() => void directionsQuery.refetch()}
                                        isRetrying={directionsQuery.isFetching}
                                    />
                                ) : (
                                    <WorkDirectionMultiSelect
                                        directions={directionsQuery.data ?? []}
                                        value={workDirectionIds}
                                        onChange={(ids) => {
                                            setWorkDirectionIds(ids);
                                            if (ids.length > 0) setFormError('');
                                        }}
                                        disabled={directionsQuery.isLoading || isLoading}
                                        emptyText={t('directionsEmpty')}
                                    />
                                )}
                            </div>
                            {workDirectionIds.length === 0 && (
                                <p className="mt-2 text-xs font-semibold text-red-600">{t('directionRequired')}</p>
                            )}
                        </section>
                    )}

                    {formError && <p role="alert" className="text-sm font-semibold text-red-600">{formError}</p>}
                </div>

                <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:px-7">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="min-h-11 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                        {commonT('actions.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || isRolesError || selectedRoles.length === 0 || (isDispatcher && (directionsQuery.isError || workDirectionIds.length === 0))}
                        className="min-h-11 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-w-40"
                    >
                        {isLoading ? t('creating') : t('submit')}
                    </button>
                </footer>
            </form>
        </Modal>
    );
}
