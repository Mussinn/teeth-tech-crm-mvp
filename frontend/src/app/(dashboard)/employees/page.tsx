'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSelector } from 'react-redux';

import {
    getKpiColor,
    getStatusBadge,
    isEmployeeActive,
} from '@/src/utils/employeesUtils';
import CreateEmployeeModal from '@/src/components/Modals/CreateEmployeeModal';
import EditEmployeeAdminSetupModal from '@/src/components/Modals/EditEmployeeAdminSetupModal';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import { useGetUsersQuery, useUpdateUserStatusMutation } from "@/src/services/api/usersApi";
import ErrorState from '@/src/components/ui/ErrorState';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import { useGetRolesQuery } from '@/src/services/api/rolesApi';
import { getDisplayRoleNames } from '@/src/features/auth/authUtils';
import type { RootState } from '@/src/lib/store';
import { useAppLocale } from '@/src/i18n/provider';
import { intlLocaleByLocale } from '@/src/i18n/config';
import type { User } from '@/src/types/user.types';


function StatCard({
                      title,
                      value,
                      description,
                  }: {
    title: string;
    value: string | number;
    description: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{title}</p><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /></div>
            <p className="mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
            <p className="mt-2 text-xs text-slate-400">{description}</p>
        </div>
    );
}

export default function EmployeesPage() {
    const t = useTranslations('employees.list');
    const detailT = useTranslations('employees.detail');
    const commonT = useTranslations('common');
    const {locale} = useAppLocale();
    const intlLocale = intlLocaleByLocale[locale];
    const [search, setSearch] = useState('');
    const [selectedRole, setSelectedRole] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [employeeToDeactivate, setEmployeeToDeactivate] = useState<{ id: string; fullName: string } | null>(null);
    const [employeeToEdit, setEmployeeToEdit] = useState<User | null>(null);

    const {
        data: users = [],
        isLoading,
        isError,
    } = useGetUsersQuery();
    const jwtRoles = useSelector((state: RootState) => state.auth.roles);
    const isAdmin = jwtRoles.some(
        (role) => role.toUpperCase().replace(/^ROLE_/u, '') === 'ADMIN'
    );
    const { data: availableRoles = [] } = useGetRolesQuery(undefined, {
        skip: !isAdmin,
    });
    const [updateUserStatus, updateStatusState] = useUpdateUserStatusMutation();
    const filteredEmployees = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return users.filter((employee) => {
            const matchesRole =
                selectedRole === 'ALL'
                || employee.roles?.includes(selectedRole)
                || employee.role === selectedRole;

            const matchesSearch =
                employee.fullName.toLowerCase().includes(normalizedSearch) ||
                employee.specialization?.toLowerCase().includes(normalizedSearch);

            const active = isEmployeeActive(employee.status);
            const matchesStatus = statusFilter === 'ALL'
                || (statusFilter === 'ACTIVE' ? active : !active);

            return matchesRole && matchesSearch && matchesStatus;
        });
    }, [users, search, selectedRole, statusFilter]);

    const summary = useMemo(() => {
        const totalEmployees = filteredEmployees.length;

        const activeEmployees = filteredEmployees.filter(
            (employee) => isEmployeeActive(employee.status)
        ).length;

        const totalInProgress = filteredEmployees.reduce(
            (sum, employee) => sum + employee.stats.inProgress,
            0
        );

        const averageOnTimeRate =
            totalEmployees > 0
                ? Math.round(
                    filteredEmployees.reduce(
                        (sum, employee) => sum + employee.stats.timelyPercent,
                        0
                    ) / totalEmployees
                )
                : 0;

        return {
            totalEmployees,
            activeEmployees,
            totalInProgress,
            averageOnTimeRate,
        };
    }, [filteredEmployees]);

    const changeStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
        try {
            await updateUserStatus({ id, status }).unwrap();
            setEmployeeToDeactivate(null);
        } catch (error) {
            console.error('User status update failed:', error);
        }
    };

    const handleDeactivateUser = async () => {
        if (!employeeToDeactivate) return;
        await changeStatus(employeeToDeactivate.id, 'INACTIVE');
    };

    if (isLoading) {
        return <div className="text-sm text-slate-500">{t('loading')}</div>;
    }

    if (isError) {
        return (
            <ErrorState>
                {t('loadError')}
            </ErrorState>
        );
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 pb-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t('title')}</h1>
                    <p className="text-sm text-slate-500">
                        {t('subtitle')}
                    </p>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition-all hover:bg-violet-700 active:scale-95 md:w-auto"
                    >
                        {t('add')}
                    </button>
                )}
            </header>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatCard
                    title={t('metrics.total')}
                    value={summary.totalEmployees}
                    description={t('metrics.totalHint')}
                />
                <StatCard
                    title={t('metrics.active')}
                    value={summary.activeEmployees}
                    description={t('metrics.activeHint')}
                />
                <StatCard
                    title={t('metrics.inProgress')}
                    value={summary.totalInProgress}
                    description={t('metrics.inProgressHint')}
                />
                <StatCard
                    title={t('metrics.kpi')}
                    value={`${summary.averageOnTimeRate}%`}
                    description={t('metrics.kpiHint')}
                />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                        <input
                            type="text"
                            placeholder={t('search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:max-w-sm"
                        />

                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white sm:w-56"
                        >
                            <option value="ALL">{t('allRoles')}</option>
                            {availableRoles.map((option) => (
                                <option key={option.id} value={option.code}>
                                    {option.name} — {option.code}
                                </option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white sm:w-48"
                        >
                            <option value="ALL">{t('statusFilters.all')}</option>
                            <option value="ACTIVE">{t('statusFilters.active')}</option>
                            <option value="INACTIVE">{t('statusFilters.inactive')}</option>
                        </select>
                    </div>
                    <div className="text-xs font-medium text-slate-400">
                        {t('found', {count: filteredEmployees.length})}
                    </div>
                </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div><h2 className="text-sm font-bold text-slate-900">{t('team')}</h2><p className="mt-1 text-xs text-slate-400">{t('teamHint')}</p></div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{t('employeeCount', {count: filteredEmployees.length})}</span>
                </div>

                <div className="grid max-h-[760px] gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredEmployees.map((employee) => (
                            <article
                                key={employee.id}
                                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-950/5"
                            >
                                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 opacity-0 transition group-hover:opacity-100" />
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 text-sm font-black text-violet-700">
                                            {employee.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toLocaleUpperCase(intlLocale)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-black text-slate-900" title={employee.fullName}>
                                                {employee.fullName}
                                            </p><span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase ${getStatusBadge(employee.status)}`}>{isEmployeeActive(employee.status) ? detailT('statuses.ACTIVE') : detailT('statuses.INACTIVE')}</span></div>
                                            <p className="mt-1 truncate text-xs text-slate-500">{employee.specialization || t('specializationMissing')}</p>
                                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                                                {getDisplayRoleNames([
                                                    ...(employee.roles ?? []),
                                                    ...(employee.role ? [employee.role] : []),
                                                ]).join(', ') || t('roleMissing')}
                                            </p>
                                            {employee.workDirections?.length ? (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {employee.workDirections.map((direction) => (
                                                        <WorkDirectionBadge key={direction.id} code={direction.code} name={direction.name} />
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] uppercase text-slate-400">{t('completed')}</p><p className="mt-1 text-lg font-black text-slate-900">{employee.stats.completed}</p></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] uppercase text-slate-400">{t('inWork')}</p><p className="mt-1 text-lg font-black text-slate-900">{employee.stats.inProgress}</p></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] uppercase text-slate-400">{t('overdue')}</p><p className={`mt-1 text-lg font-black ${employee.stats.overdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>{employee.stats.overdue}</p></div></div>

                                <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="text-slate-400">{t('onTime')}</span><span className={`rounded-md px-2 py-0.5 font-bold ${getKpiColor(employee.stats.timelyPercent)}`}>{employee.stats.timelyPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{width: `${Math.max(0, Math.min(100, employee.stats.timelyPercent))}%`}} /></div></div>

                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><div className="text-[10px] text-slate-400"><span>{t('taskCount', {count: employee.stats.totalTasks})}</span><span className="mx-1.5">·</span><span>{t('averageDays', {days: employee.stats.avgDays})}</span></div><div className="flex gap-1.5">
                                        <Link
                                            href={`/employees/${employee.id}`}
                                            className="rounded-lg bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700 transition hover:bg-violet-600 hover:text-white"
                                        >
                                            {t('open')}
                                        </Link>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => setEmployeeToEdit(employee)}
                                                className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
                                            >
                                                {commonT('actions.edit')}
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isEmployeeActive(employee.status)) {
                                                        setEmployeeToDeactivate({ id: employee.id, fullName: employee.fullName });
                                                    } else {
                                                        void changeStatus(employee.id, 'ACTIVE');
                                                    }
                                                }}
                                                disabled={updateStatusState.isLoading}
                                                className={`rounded-lg px-2 py-1.5 text-[10px] font-bold transition disabled:opacity-40 ${isEmployeeActive(employee.status) ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-emerald-700 hover:bg-emerald-50'}`}
                                            >
                                                {isEmployeeActive(employee.status) ? t('deactivate') : t('activate')}
                                            </button>
                                        )}
                                    </div></div>
                            </article>
                        ))}

                        {filteredEmployees.length === 0 && (
                            <div className="col-span-full p-12 text-center text-sm text-slate-400">
                                    {t('empty')}
                            </div>
                        )}
                </div>
            </section>
            {isAdmin && isCreateModalOpen && (
                <CreateEmployeeModal onClose={() => setIsCreateModalOpen(false)} />
            )}
            {isAdmin && employeeToEdit && (
                <EditEmployeeAdminSetupModal
                    user={employeeToEdit}
                    onClose={() => setEmployeeToEdit(null)}
                />
            )}
            <ConfirmDialog
                open={employeeToDeactivate !== null}
                title={t('deactivateTitle')}
                description={t('deactivateDescription')}
                confirmLabel={t('deactivate')}
                isLoading={updateStatusState.isLoading}
                onClose={() => setEmployeeToDeactivate(null)}
                onConfirm={handleDeactivateUser}
            />
        </div>
    );
}
