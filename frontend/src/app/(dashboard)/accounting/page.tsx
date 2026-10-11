'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useGetFinanceReportQuery } from '@/src/services/api/financeApi';
import FinanceReportDashboard from '@/src/components/accounting/FinanceReportDashboard';
import {
    useConfirmSalaryStatementMutation,
    useCreateSalaryStatementMutation,
    useDeleteSalaryStatementMutation,
    useGetSalaryConfigQuery,
    useGetSalaryEmployeesQuery,
    useGetSalaryStatementsHistoryQuery,
    useGetSalaryStatementTasksQuery,
    useUpsertSalaryConfigMutation,
} from '@/src/services/api/salariesApi';
import type {
    FinanceReport,
    SalaryEmployee,
    SalaryPaymentType,
    SalaryStatement,
    SalaryStatementTask,
} from '@/src/types/finance.types';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type SalaryUserOption = {
    id: string;
    fullName: string;
    email?: string;
    role?: string | null;
    roles?: string[];
    specialization?: string | null;
    salaryType?: 'FIXED' | 'PER_UNIT';
    salary?: number;
};

const emptyReport: FinanceReport = {
    startDate: '',
    endDate: '',
    totalCompletedTasks: 0,
    grossRevenue: 0,
    totalDiscounts: 0,
    netRevenue: 0,
    totalPayroll: 0,
    grossProfit: 0,
    marginPercentage: 0,
};

const roleKeyByCode = {
    ADMIN: 'roles.ADMIN',
    DISPATCHER: 'roles.DISPATCHER',
    TECHNICIAN: 'roles.TECHNICIAN',
    FINANCIER: 'roles.FINANCIER',
    HEAD_TECHNICIAN: 'roles.HEAD_TECHNICIAN',
    ROLE_ADMIN: 'roles.ADMIN',
    ROLE_DISPATCHER: 'roles.DISPATCHER',
    ROLE_TECHNICIAN: 'roles.TECHNICIAN',
} as const;

function padDatePart(value: number) {
    return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date: Date) {
    return [
        date.getFullYear(),
        padDatePart(date.getMonth() + 1),
        padDatePart(date.getDate()),
    ].join('-') + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function getDefaultStartDate() {
    const now = new Date();
    return toDatetimeLocalValue(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0));
}

function getDefaultEndDate() {
    return toDatetimeLocalValue(new Date());
}

function toApiDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getSalaryEmployeeName(employee: SalaryEmployee) {
    return employee.name || employee.email || employee.id;
}

type LegacyPayrollTranslator = ReturnType<typeof useTranslations<'accounting.payroll.legacy'>>;

function getUserRole(user: SalaryUserOption, t: LegacyPayrollTranslator) {
    const role = user.role || user.roles?.[0] || user.specialization;
    if (!role) return t('noRole');
    const roleKey = roleKeyByCode[role as keyof typeof roleKeyByCode];
    return roleKey ? t(roleKey) : role;
}

function getUserName(users: SalaryUserOption[], userId: string, fallback: string) {
    return users.find((user) => user.id === userId)?.fullName ?? fallback;
}

function getInitialPaymentType(user?: SalaryUserOption): SalaryPaymentType {
    if (user?.salaryType === 'PER_UNIT') return 'PIECEWORK';
    return 'FIXED';
}

function UserSelect({
    id,
    value,
    users,
    onChange,
    disabled,
    emptyLabel,
}: {
    id: string;
    value: string;
    users: SalaryUserOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
    emptyLabel: string;
}) {
    return (
        <select
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled || users.length === 0}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
            {users.length === 0 ? (
                <option value="">{emptyLabel}</option>
            ) : (
                users.map((user) => (
                    <option key={user.id} value={user.id}>
                        {user.fullName}
                    </option>
                ))
            )}
        </select>
    );
}

export default function AccountingPage() {
    const t = useTranslations('accounting.main');
    const payrollT = useTranslations('accounting.payroll.legacy');
    const reportT = useTranslations('accounting.report');
    const {currency: formatMoney, dateTime: formatDateTime} = useAppFormatters();
    const pathname = usePathname();
    const isPayrollPage = pathname === '/accounting/payroll';
    const [reportStart, setReportStart] = useState(getDefaultStartDate);
    const [reportEnd, setReportEnd] = useState(getDefaultEndDate);
    const [reportRequest, setReportRequest] = useState(() => ({
        startDate: toApiDate(getDefaultStartDate()),
        endDate: toApiDate(getDefaultEndDate()),
    }));
    const [selectedConfigUserId, setSelectedConfigUserId] = useState('');
    const [paymentTypeDraft, setPaymentTypeDraft] = useState<SalaryPaymentType | undefined>();
    const [baseSalaryDraft, setBaseSalaryDraft] = useState<string | undefined>();
    const [commissionPercentDraft, setCommissionPercentDraft] = useState<string | undefined>();
    const [configError, setConfigError] = useState('');
    const [selectedStatementEmployeeId, setSelectedStatementEmployeeId] = useState('');
    const [statementStart, setStatementStart] = useState(getDefaultStartDate);
    const [statementEnd, setStatementEnd] = useState(getDefaultEndDate);
    const [statementComment, setStatementComment] = useState('');
    const [statement, setStatement] = useState<SalaryStatement | null>(null);
    const [statementError, setStatementError] = useState('');
    const [statementAction, setStatementAction] = useState<'confirm' | 'delete' | null>(null);

    const {
        data: salaryEmployees = [],
        isLoading: isUsersLoading,
        isError: isUsersError,
    } = useGetSalaryEmployeesQuery(undefined, { skip: !isPayrollPage });
    const users = useMemo<SalaryUserOption[]>(
        () => salaryEmployees.map((employee) => ({
            id: employee.id,
            fullName: getSalaryEmployeeName(employee),
            email: employee.email,
        })),
        [salaryEmployees]
    );
    const firstUserId = users[0]?.id ?? '';
    const configUserId = selectedConfigUserId || firstUserId;
    const statementEmployeeId = selectedStatementEmployeeId || firstUserId;
    const historyRequest = useMemo(
        () => ({
            start: toApiDate(statementStart),
            end: toApiDate(statementEnd),
        }),
        [statementEnd, statementStart]
    );
    const {
        data: reportData,
        isFetching: isReportFetching,
        isError: isReportError,
        refetch: refetchReport,
    } = useGetFinanceReportQuery(reportRequest, { skip: isPayrollPage });
    const selectedConfigUser = useMemo(
        () => users.find((user) => user.id === configUserId),
        [configUserId, users]
    );
    const {
        data: salaryConfig,
        isFetching: isConfigFetching,
        isError: isConfigLoadError,
    } = useGetSalaryConfigQuery(configUserId, {
        skip: !isPayrollPage || !configUserId,
    });
    const [upsertSalaryConfig, { isLoading: isSavingConfig }] = useUpsertSalaryConfigMutation();
    const [createSalaryStatement, { isLoading: isCreatingStatement }] = useCreateSalaryStatementMutation();
    const [confirmSalaryStatement, { isLoading: isConfirmingStatement }] = useConfirmSalaryStatementMutation();
    const [deleteSalaryStatement, { isLoading: isDeletingStatement }] = useDeleteSalaryStatementMutation();
    const {
        data: statementTasks,
        isFetching: isStatementTasksFetching,
        isError: isStatementTasksError,
    } = useGetSalaryStatementTasksQuery(statement?.statementId ?? '', {
        skip: !isPayrollPage || !statement?.statementId,
    });
    const {
        data: salaryStatementsHistory = [],
        isFetching: isHistoryFetching,
        isError: isHistoryError,
    } = useGetSalaryStatementsHistoryQuery(historyRequest, {
        skip: !isPayrollPage,
    });

    const report = reportData ?? emptyReport;
    const paymentType = paymentTypeDraft ?? salaryConfig?.paymentType ?? getInitialPaymentType(selectedConfigUser);
    const baseSalary = baseSalaryDraft ?? String(salaryConfig?.baseSalary ?? selectedConfigUser?.salary ?? 0);
    const commissionPercent = commissionPercentDraft ?? String(salaryConfig?.commissionPercent ?? 0);
    const statementEmployeeName = statementEmployeeId
        ? getUserName(users, statementEmployeeId, payrollT('employee'))
        : payrollT('employee');
    const displayedStatementTasks: SalaryStatementTask[] = statementTasks ?? statement?.tasks ?? [];
    const handleGenerateReport = () => {
        const nextRequest = {
            startDate: toApiDate(reportStart),
            endDate: toApiDate(reportEnd),
        };
        if (
            nextRequest.startDate === reportRequest.startDate
            && nextRequest.endDate === reportRequest.endDate
        ) {
            void refetchReport();
            return;
        }
        setReportRequest(nextRequest);
    };

    const handleConfigUserChange = (userId: string) => {
        setSelectedConfigUserId(userId);
        setPaymentTypeDraft(undefined);
        setBaseSalaryDraft(undefined);
        setCommissionPercentDraft(undefined);
        setConfigError('');
    };

    const handleConfigSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setConfigError('');

        if (!configUserId) {
            setConfigError(payrollT('selectEmployee'));
            return;
        }

        try {
            await upsertSalaryConfig({
                userId: configUserId,
                paymentType,
                baseSalary: Number(baseSalary) || 0,
                commissionPercent: Number(commissionPercent) || 0,
            }).unwrap();
        } catch (error) {
            console.error('Salary config save failed:', error);
        }
    };

    const handleStatementSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatementError('');
        setStatement(null);

        if (!statementEmployeeId) {
            setStatementError(payrollT('selectEmployee'));
            return;
        }

        try {
            const createdStatement = await createSalaryStatement({
                employeeId: statementEmployeeId,
                startDate: toApiDate(statementStart),
                endDate: toApiDate(statementEnd),
                comment: statementComment.trim() || undefined,
            }).unwrap();
            setStatement(createdStatement);
        } catch (error) {
            console.error('Salary statement create failed:', error);
        }
    };

    const handleConfirmStatement = async () => {
        if (!statement?.statementId) return;

        setStatementError('');

        try {
            await confirmSalaryStatement(statement.statementId).unwrap();
            setStatement((current) => current ? { ...current, status: 'PAID' } : current);
            setStatementAction(null);
        } catch (error) {
            console.error('Salary statement confirm failed:', error);
        }
    };

    const handleDeleteStatement = async () => {
        if (!statement?.statementId || statement.status !== 'DRAFT') return;

        setStatementError('');

        try {
            await deleteSalaryStatement(statement.statementId).unwrap();
            setStatement(null);
            setStatementAction(null);
        } catch (error) {
            console.error('Salary statement delete failed:', error);
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-8">
            {!isPayrollPage && (
                <>
            <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:flex lg:items-end lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('eyebrow')}</p><h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{t('title')}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('subtitle')}
                    </p>
                </div>

                <div className={`mt-4 rounded-xl border px-4 py-3 text-sm shadow-sm lg:mt-0 ${
                    report.grossProfit >= 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                    {t('received', {amount: formatMoney(report.netRevenue)})}
                </div>
            </header>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            {t('start')}
                        </span>
                        <input
                            type="datetime-local"
                            value={reportStart}
                            onChange={(event) => setReportStart(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            {t('end')}
                        </span>
                        <input
                            type="datetime-local"
                            value={reportEnd}
                            onChange={(event) => setReportEnd(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={isReportFetching}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {isReportFetching ? t('generating') : t('generate')}
                    </button>
                </div>

                {isReportError && (
                    <p className="mt-3 text-sm font-semibold text-red-600">
                        {t('loadError')}
                    </p>
                )}

                <p className="mt-3 text-xs text-slate-400">
                    {t('period', {
                        start: formatDateTime(report.startDate || reportRequest.startDate),
                        end: formatDateTime(report.endDate || reportRequest.endDate),
                    })}
                </p>
            </section>

            <div data-tour="accounting-report">
                <FinanceReportDashboard report={report} isLoading={isReportFetching} />
            </div>
                </>
            )}

            {isPayrollPage && (
                <>
            <header>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                    {payrollT('badge')}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">{payrollT('title')}</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {payrollT('subtitle')}
                </p>
            </header>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <form
                    onSubmit={handleConfigSubmit}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">{payrollT('configTitle')}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {payrollT('configSubtitle')}
                            </p>
                        </div>
                        {isConfigFetching && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                {payrollT('loading')}
                            </span>
                        )}
                    </div>

                    <div className="mt-5 space-y-4">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                {payrollT('employeeField')}
                            </span>
                            <UserSelect
                                id="salary-config-user"
                                value={configUserId}
                                users={users}
                                emptyLabel={payrollT('noEmployees')}
                                disabled={isUsersLoading}
                                onChange={handleConfigUserChange}
                            />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                    {payrollT('paymentType')}
                                </span>
                                <select
                                    value={paymentType}
                                    onChange={(event) => setPaymentTypeDraft(event.target.value as SalaryPaymentType)}
                                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="FIXED">{reportT('paymentTypes.FIXED')}</option>
                                    <option value="PIECEWORK">{reportT('paymentTypes.PIECEWORK')}</option>
                                    <option value="HYBRID">{reportT('paymentTypes.HYBRID')}</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                    {payrollT('salary')}
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={baseSalary}
                                    onChange={(event) => setBaseSalaryDraft(event.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                    {payrollT('percent')}
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={commissionPercent}
                                    onChange={(event) => setCommissionPercentDraft(event.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <span className="font-bold text-slate-800">
                                {selectedConfigUser?.fullName ?? payrollT('employee')}
                            </span>
                            <span className="mx-2 text-slate-300">/</span>
                            {selectedConfigUser ? getUserRole(selectedConfigUser, payrollT) : payrollT('roleMissing')}
                            <span className="mx-2 text-slate-300">/</span>
                            {isConfigLoadError ? payrollT('configMissing') : reportT(`paymentTypes.${paymentType}`)}
                        </div>

                        {configError && (
                            <p className="text-sm font-semibold text-red-600">
                                {configError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSavingConfig || !configUserId}
                            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                        >
                            {isSavingConfig ? payrollT('saving') : payrollT('saveConfig')}
                        </button>
                    </div>
                </form>

                <form
                    onSubmit={handleStatementSubmit}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                    <h2 className="font-bold text-slate-900">{payrollT('statementTitle')}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {payrollT('statementSubtitle')}
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <label className="block md:col-span-2">
                            <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                {payrollT('employeeField')}
                            </span>
                            <UserSelect
                                id="salary-statement-user"
                                value={statementEmployeeId}
                                users={users}
                                emptyLabel={payrollT('noEmployees')}
                                disabled={isUsersLoading}
                                onChange={setSelectedStatementEmployeeId}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                {payrollT('start')}
                            </span>
                            <input
                                type="datetime-local"
                                value={statementStart}
                                onChange={(event) => setStatementStart(event.target.value)}
                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                {payrollT('end')}
                            </span>
                            <input
                                type="datetime-local"
                                value={statementEnd}
                                onChange={(event) => setStatementEnd(event.target.value)}
                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <label className="block md:col-span-2">
                            <span className="mb-1.5 block text-xs font-bold text-slate-500">
                                {payrollT('comment')}
                            </span>
                            <textarea
                                value={statementComment}
                                onChange={(event) => setStatementComment(event.target.value)}
                                rows={3}
                                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    {statementError && (
                        <p className="mt-3 text-sm font-semibold text-red-600">
                            {statementError}
                        </p>
                    )}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="submit"
                            disabled={isCreatingStatement || !statementEmployeeId}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {isCreatingStatement ? payrollT('calculating') : payrollT('createStatement')}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStatementAction('confirm')}
                            disabled={!statement?.statementId || statement.status === 'PAID' || isConfirmingStatement}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-600 px-5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                            {isConfirmingStatement ? payrollT('confirming') : payrollT('confirmPayment')}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStatementAction('delete')}
                            disabled={!statement?.statementId || statement.status !== 'DRAFT' || isDeletingStatement}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500 px-5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                            {isDeletingStatement ? payrollT('deleting') : payrollT('deleteDraft')}
                        </button>
                    </div>
                </form>
            </section>

            {isUsersError && (
                <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {payrollT('usersError')}
                </section>
            )}

            {statement && (
                <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">
                                {payrollT('statement', {employee: statement.employeeName || statementEmployeeName})}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {formatDateTime(statement.startDate)} - {formatDateTime(statement.endDate)}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                                {reportT(`paymentTypes.${statement.paymentType}`)}
                            </span>
                            <span className={`rounded-full px-3 py-1.5 ${
                                statement.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                                {statement.status === 'PAID' ? payrollT('paid') : payrollT('draft')}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-px bg-slate-100 md:grid-cols-4">
                        <div className="bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{payrollT('salary')}</p>
                            <p className="mt-2 text-xl font-black text-slate-900">{formatMoney(statement.baseSalaryAmount)}</p>
                        </div>
                        <div className="bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{payrollT('piecework')}</p>
                            <p className="mt-2 text-xl font-black text-slate-900">{formatMoney(statement.pieceworkAmount)}</p>
                        </div>
                        <div className="bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{payrollT('tasks')}</p>
                            <p className="mt-2 text-xl font-black text-slate-900">{statement.totalTaskCount}</p>
                        </div>
                        <div className="bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{payrollT('total')}</p>
                            <p className="mt-2 text-xl font-black text-emerald-700">{formatMoney(statement.totalAmount)}</p>
                        </div>
                    </div>

                    {(isStatementTasksFetching || isStatementTasksError) && (
                        <div className={`border-b border-slate-100 px-5 py-3 text-sm font-semibold ${
                            isStatementTasksError ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                            {isStatementTasksError ? payrollT('tasksError') : payrollT('tasksLoading')}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-left">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="p-4 font-bold">{payrollT('columns.task')}</th>
                                    <th className="p-4 font-bold">{payrollT('columns.order')}</th>
                                    <th className="p-4 font-bold">{payrollT('columns.work')}</th>
                                    <th className="p-4 font-bold">{payrollT('columns.quantity')}</th>
                                    <th className="p-4 font-bold">{payrollT('columns.taskAmount')}</th>
                                    <th className="p-4 font-bold">{payrollT('columns.accrued')}</th>
                                    <th className="p-4 text-right font-bold">{payrollT('columns.completed')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayedStatementTasks.map((task) => (
                                    <tr key={task.taskId} className="transition hover:bg-blue-50/30">
                                        <td className="p-4 font-mono text-xs font-bold text-slate-500">
                                            {task.taskId}
                                        </td>
                                        <td className="p-4 text-sm font-semibold text-slate-700">
                                            {task.orderNumber}
                                        </td>
                                        <td className="p-4 text-sm text-slate-700">
                                            {task.workTypeName}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {task.quantity}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-800">
                                            {formatMoney(task.taskAmount)}
                                        </td>
                                        <td className="p-4 text-sm font-black text-emerald-700">
                                            {formatMoney(task.earnedAmount)}
                                        </td>
                                        <td className="p-4 text-right text-sm text-slate-500">
                                            {formatDateTime(task.completedAt)}
                                        </td>
                                    </tr>
                                ))}

                                {displayedStatementTasks.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-sm text-slate-400">
                                            {payrollT('noTasks')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900">{payrollT('history')}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {formatDateTime(historyRequest.start)} - {formatDateTime(historyRequest.end)}
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {isHistoryFetching ? payrollT('loading') : payrollT('count', {count: salaryStatementsHistory.length})}
                    </span>
                </div>

                {isHistoryError && (
                    <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
                        {payrollT('historyError')}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400">
                            <tr>
                                <th className="p-4 font-bold">{payrollT('employeeField')}</th>
                                <th className="p-4 font-bold">{payrollT('period')}</th>
                                <th className="p-4 font-bold">{payrollT('type')}</th>
                                <th className="p-4 font-bold">{payrollT('status')}</th>
                                <th className="p-4 font-bold">{payrollT('tasks')}</th>
                                <th className="p-4 text-right font-bold">{payrollT('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {salaryStatementsHistory.map((historyItem) => (
                                <tr key={historyItem.statementId} className="transition hover:bg-blue-50/30">
                                    <td className="p-4 text-sm font-bold text-slate-800">
                                        {historyItem.employeeName || getUserName(users, historyItem.employeeId, payrollT('employee'))}
                                    </td>
                                    <td className="p-4 text-sm text-slate-500">
                                        {formatDateTime(historyItem.startDate)} - {formatDateTime(historyItem.endDate)}
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {reportT(`paymentTypes.${historyItem.paymentType}`)}
                                    </td>
                                    <td className="p-4">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                            historyItem.status === 'PAID'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {historyItem.status === 'PAID' ? payrollT('paid') : payrollT('draft')}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm font-semibold text-slate-700">
                                        {historyItem.totalTaskCount}
                                    </td>
                                    <td className="p-4 text-right text-sm font-black text-emerald-700">
                                        {formatMoney(historyItem.totalAmount)}
                                    </td>
                                </tr>
                            ))}

                            {!isHistoryFetching && salaryStatementsHistory.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-sm text-slate-400">
                                        {payrollT('historyEmpty')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
                </>
            )}
            <ConfirmDialog
                open={statementAction === 'confirm'}
                title={payrollT('confirmTitle')}
                description={payrollT('confirmDescription')}
                confirmLabel={payrollT('confirmLabel')}
                tone="primary"
                isLoading={isConfirmingStatement}
                onClose={() => setStatementAction(null)}
                onConfirm={handleConfirmStatement}
            />
            <ConfirmDialog
                open={statementAction === 'delete'}
                title={payrollT('deleteTitle')}
                description={payrollT('deleteDescription')}
                confirmLabel={payrollT('deleteLabel')}
                isLoading={isDeletingStatement}
                onClose={() => setStatementAction(null)}
                onConfirm={handleDeleteStatement}
            />
        </div>
    );
}
