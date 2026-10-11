'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import Modal from '@/src/components/ui/Modal';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import type { RootState } from '@/src/lib/store';
import { useGetWorkTypesQuery } from '@/src/services/api/laboratory/workTypesApi';
import {
    useCreateFlexibleSalaryStatementMutation,
    useCreateSalaryPlanRuleMutation,
    useDeleteSalaryRuleMutation,
    useGetSalaryEmployeesQuery,
    useGetSalaryPlanQuery,
    useLazyGetSalaryCalculationPreviewQuery,
    useUpdateSalaryRuleMutation,
    useUpsertSalaryPlanMutation,
} from '@/src/services/api/salariesApi';
import { useGetOrderStatusesQuery } from '@/src/services/api/workflowApi';
import { getApiErrorMessage } from '@/src/services/apiNotifications';
import type {
    SalaryCalculationType,
    SalaryCapMode,
    SalaryPlan,
    SalaryPlanRule,
    SalaryRuleTreatment,
    UpsertSalaryRuleRequest,
} from '@/src/types/finance.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';
import {useSearchParams} from 'next/navigation';

const inputClass =
    'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-violet-500 dark:focus:ring-violet-500/20 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';
const LAB_TIMEZONE_OFFSET = '+05:00';

const treatmentCodes: SalaryRuleTreatment[] = ['INCLUDED_IN_BASE', 'PAID_EXTRA', 'NOT_PAYABLE', 'REQUIRES_REVIEW'];
const calculationCodes: SalaryCalculationType[] = ['ONCE_PER_STAGE', 'TASK_QUANTITY', 'TEETH_COUNT', 'PERCENT_OF_TASK'];

type ApiError = FetchBaseQueryError & {
    data?: { message?: string; detail?: string; error?: string } | string;
};

type PlanDraft = {
    name: string;
    baseSalary: string;
    capEnabled: boolean;
    monthlyCap: string;
    capMode: SalaryCapMode;
    carryForward: boolean;
    effectiveFrom: string;
    effectiveTo: string;
    active: boolean;
};

type RuleDraft = {
    name: string;
    workTypeId: string;
    statusId: string;
    treatment: SalaryRuleTreatment;
    calculationType: SalaryCalculationType;
    rate: string;
    priority: string;
    effectiveFrom: string;
    effectiveTo: string;
    active: boolean;
};

const emptyPlan = (): PlanDraft => ({
    name: '',
    baseSalary: '',
    capEnabled: false,
    monthlyCap: '',
    capMode: 'TOTAL',
    carryForward: false,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    active: true,
});

const emptyRule = (effectiveFrom = new Date().toISOString().slice(0, 10)): RuleDraft => ({
    name: '',
    workTypeId: '',
    statusId: '',
    treatment: 'PAID_EXTRA',
    calculationType: 'TASK_QUANTITY',
    rate: '',
    priority: '100',
    effectiveFrom,
    effectiveTo: '',
    active: true,
});

function planToDraft(plan: SalaryPlan): PlanDraft {
    return {
        name: plan.name ?? '',
        baseSalary: String(plan.baseSalary ?? ''),
        capEnabled: plan.monthlyCap !== null && plan.monthlyCap !== undefined,
        monthlyCap: plan.monthlyCap === null || plan.monthlyCap === undefined
            ? ''
            : String(plan.monthlyCap),
        capMode: plan.capMode ?? 'TOTAL',
        carryForward: Boolean(plan.carryForward),
        effectiveFrom: plan.effectiveFrom ?? '',
        effectiveTo: plan.effectiveTo ?? '',
        active: Boolean(plan.active),
    };
}

function ruleToDraft(rule: SalaryPlanRule): RuleDraft {
    return {
        name: rule.name,
        workTypeId: rule.workTypeId ?? '',
        statusId: rule.statusId ?? '',
        treatment: rule.treatment,
        calculationType: rule.calculationType,
        rate: String(rule.rate ?? 0),
        priority: String(rule.priority ?? 100),
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo ?? '',
        active: rule.active,
    };
}

function parseDecimal(value: string) {
    return Number(value.trim().replace(/\s/gu, '').replace(',', '.'));
}

function toOffsetIso(value: string, endOfDay = false) {
    if (!value) return '';
    return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}${LAB_TIMEZONE_OFFSET}`;
}

function getErrorStatus(error: unknown) {
    return error && typeof error === 'object' && 'status' in error
        ? (error as ApiError).status
        : undefined;
}

function getLocalError(error: unknown, fallback: string, forbidden = fallback) {
    if (getErrorStatus(error) === 403) {
        return forbidden;
    }
    return getApiErrorMessage(error, fallback);
}

function getRuleKey(rule: Pick<
    SalaryPlanRule,
    'statusId' | 'workTypeId' | 'effectiveFrom' | 'effectiveTo' | 'priority'
>) {
    return [
        rule.statusId ?? '*',
        rule.workTypeId ?? '*',
        rule.effectiveFrom,
        rule.effectiveTo ?? '',
        rule.priority,
    ].join('|');
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            {children}
        </span>
    );
}

function Toggle({
    checked,
    onChange,
    label,
    disabled,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 accent-blue-600"
            />
            {label}
        </label>
    );
}

function StateNotice({
    tone,
    children,
}: {
    tone: 'loading' | 'error' | 'empty' | 'info';
    children: React.ReactNode;
}) {
    const styles = {
        loading: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
        error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
        empty: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
        info: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    };
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles[tone]}`}>
            {children}
        </div>
    );
}

function RuleEditor({
    plan,
    rule,
    userId,
    canEdit,
    onClose,
}: {
    plan: SalaryPlan;
    rule: SalaryPlanRule | null;
    userId: string;
    canEdit: boolean;
    onClose: () => void;
}) {
    const t = useTranslations('accounting.payroll');
    const commonT = useTranslations('common.actions');
    const { notifySuccess } = useNotifications();
    const [draft, setDraft] = useState<RuleDraft>(() =>
        rule ? ruleToDraft(rule) : emptyRule(plan.effectiveFrom)
    );
    const [error, setError] = useState('');
    const statusesQuery = useGetOrderStatusesQuery();
    const workTypesQuery = useGetWorkTypesQuery();
    const [createRule, createState] = useCreateSalaryPlanRuleMutation();
    const [updateRule, updateState] = useUpdateSalaryRuleMutation();
    const isSaving = createState.isLoading || updateState.isLoading;
    const isZeroRate = ['INCLUDED_IN_BASE', 'NOT_PAYABLE'].includes(draft.treatment);

    const update = <Key extends keyof RuleDraft>(key: Key, value: RuleDraft[Key]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');

        const rate = isZeroRate ? 0 : parseDecimal(draft.rate);
        const priority = Number(draft.priority);
        if (!draft.name.trim()) return setError(t('rule.validation.name'));
        if (!draft.effectiveFrom) return setError(t('rule.validation.start'));
        if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) {
            return setError(t('rule.validation.dates'));
        }
        if (draft.treatment === 'PAID_EXTRA' && (!Number.isFinite(rate) || rate <= 0)) {
            return setError(t('rule.validation.extraRate'));
        }
        if (!Number.isFinite(rate) || rate < 0) return setError(t('rule.validation.rate'));
        if (!Number.isInteger(priority)) return setError(t('rule.validation.priority'));

        const body: UpsertSalaryRuleRequest = {
            name: draft.name.trim(),
            workTypeId: draft.workTypeId || null,
            statusId: draft.statusId || null,
            treatment: draft.treatment,
            calculationType: draft.calculationType,
            rate,
            priority,
            effectiveFrom: draft.effectiveFrom,
            effectiveTo: draft.effectiveTo || null,
            active: draft.active,
        };

        try {
            if (rule) {
                await updateRule({ ruleId: rule.id, userId, body }).unwrap();
                notifySuccess(t('rule.updated'));
            } else {
                await createRule({ planId: plan.id, userId, body }).unwrap();
                notifySuccess(t('rule.created'));
            }
            onClose();
        } catch (submitError) {
            setError(getLocalError(submitError, t('rule.saveError'), t('forbidden')));
        }
    };

    return (
        <Modal contentClassName="max-w-3xl p-5 sm:p-6">
            <form onSubmit={handleSubmit}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                            {t('rule.eyebrow')}
                        </p>
                        <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                            {rule ? t('rule.edit') : t('rule.create')}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                        {t('rule.close')}
                    </button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                        <Label>{t('rule.name')}</Label>
                        <input className={inputClass} value={draft.name} onChange={(e) => update('name', e.target.value)} />
                    </label>
                    <label>
                        <Label>{t('rule.stage')}</Label>
                        <select className={inputClass} value={draft.statusId} onChange={(e) => update('statusId', e.target.value)}>
                            <option value="">{t('rule.anyStage')}</option>
                            {statusesQuery.data?.map((status) => (
                                <option key={status.id} value={status.id}>{status.code} — {status.name}</option>
                            ))}
                        </select>
                        {statusesQuery.isFetching && <span className="mt-1 block text-xs text-slate-400">{t('rule.loadingStages')}</span>}
                        {statusesQuery.isError && <span className="mt-1 block text-xs text-red-600">{t('rule.stagesError')}</span>}
                    </label>
                    <label>
                        <Label>{t('rule.workType')}</Label>
                        <select className={inputClass} value={draft.workTypeId} onChange={(e) => update('workTypeId', e.target.value)}>
                            <option value="">{t('rule.anyWorkType')}</option>
                            {workTypesQuery.data?.map((workType) => (
                                <option key={workType.id} value={workType.id}>{workType.code} — {workType.name}</option>
                            ))}
                        </select>
                        {workTypesQuery.isFetching && <span className="mt-1 block text-xs text-slate-400">{t('rule.loadingWorkTypes')}</span>}
                        {workTypesQuery.isError && <span className="mt-1 block text-xs text-red-600">{t('rule.workTypesError')}</span>}
                    </label>
                    <label>
                        <Label>{t('rule.mode')}</Label>
                        <select
                            className={inputClass}
                            value={draft.treatment}
                            onChange={(e) => {
                                const treatment = e.target.value as SalaryRuleTreatment;
                                setDraft((current) => ({
                                    ...current,
                                    treatment,
                                    rate: ['INCLUDED_IN_BASE', 'NOT_PAYABLE'].includes(treatment)
                                        ? '0'
                                        : current.rate,
                                }));
                            }}
                        >
                            {treatmentCodes.map((value) => (
                                <option key={value} value={value}>{t(`treatments.${value}`)}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <Label>{t('rule.calculation')}</Label>
                        <select
                            className={inputClass}
                            value={draft.calculationType}
                            onChange={(e) => update('calculationType', e.target.value as SalaryCalculationType)}
                        >
                            {calculationCodes.map((value) => (
                                <option key={value} value={value}>{t(`calculations.${value}`)}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <Label>{t('rule.rate', {unit: draft.calculationType === 'PERCENT_OF_TASK' ? '%' : 'KZT'})}</Label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass}
                            disabled={isZeroRate}
                            value={isZeroRate ? '0' : draft.rate}
                            onChange={(e) => update('rate', e.target.value)}
                        />
                    </label>
                    <label>
                        <Label>{t('rule.priority')}</Label>
                        <input type="number" step="1" className={inputClass} value={draft.priority} onChange={(e) => update('priority', e.target.value)} />
                    </label>
                    <label>
                        <Label>{t('rule.effectiveFrom')}</Label>
                        <input type="date" className={inputClass} value={draft.effectiveFrom} onChange={(e) => update('effectiveFrom', e.target.value)} />
                    </label>
                    <label>
                        <Label>{t('rule.effectiveTo')}</Label>
                        <input type="date" className={inputClass} value={draft.effectiveTo} onChange={(e) => update('effectiveTo', e.target.value)} />
                    </label>
                    <div className="sm:col-span-2">
                        <Toggle checked={draft.active} onChange={(value) => update('active', value)} label={t('rule.active')} />
                    </div>
                </div>

                {error && <div className="mt-4"><StateNotice tone="error">{error}</StateNotice></div>}
                {!canEdit && <div className="mt-4"><StateNotice tone="error">{t('rule.forbidden')}</StateNotice></div>}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        {commonT('cancel')}
                    </button>
                    {canEdit && (
                        <button disabled={isSaving} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
                            {isSaving ? t('rule.saving') : commonT('save')}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
}

export default function FlexiblePayrollPage() {
    const searchParams = useSearchParams();
    const t = useTranslations('accounting.payroll');
    const commonT = useTranslations('common.actions');
    const {currency, date} = useAppFormatters();
    const localizedMoney = (value?: number | null) =>
        value === null || value === undefined ? t('noLimit') : currency(value);
    const localizedDate = (value?: string | null) =>
        value ? date(value, {day: '2-digit', month: '2-digit', year: 'numeric'}) : t('indefinitely');
    const { notifySuccess } = useNotifications();
    const auth = useSelector((state: RootState) => state.auth);
    const normalizedRoles = useMemo(
        () => [auth.role, ...auth.roles]
            .filter(Boolean)
            .map((role) => String(role).toUpperCase().replace(/^ROLE_/u, '')),
        [auth.role, auth.roles]
    );
    const canEdit = normalizedRoles.some((role) => ['ADMIN', 'FINANCIER'].includes(role));
    const [activeSection, setActiveSection] = useState<'calculate' | 'settings'>(() =>
        ['payrollPlan', 'payrollRules'].includes(searchParams.get('tour') ?? '')
            ? 'settings'
            : 'calculate'
    );

    const employeesQuery = useGetSalaryEmployeesQuery();
    const [selectedEmployeeChoice, setSelectedEmployeeChoice] = useState('');
    const selectedEmployeeId =
        selectedEmployeeChoice || employeesQuery.data?.[0]?.id || '';
    const selectedEmployee = employeesQuery.data?.find((employee) => employee.id === selectedEmployeeId);
    const planQuery = useGetSalaryPlanQuery(selectedEmployeeId, { skip: !selectedEmployeeId });
    const statusesQuery = useGetOrderStatusesQuery();
    const workTypesQuery = useGetWorkTypesQuery();
    const planNotFound = getErrorStatus(planQuery.error) === 404;
    const [planDraft, setPlanDraft] = useState<PlanDraft>(emptyPlan);
    const [planError, setPlanError] = useState('');
    const [savePlan, savePlanState] = useUpsertSalaryPlanMutation();

    const [editingRule, setEditingRule] = useState<SalaryPlanRule | null | undefined>(undefined);
    const [deletingRule, setDeletingRule] = useState<SalaryPlanRule | null>(null);
    const [deleteRule, deleteRuleState] = useDeleteSalaryRuleMutation();
    const [ruleError, setRuleError] = useState('');

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEndDate = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    const [previewStart, setPreviewStart] = useState(monthStart);
    const [previewEnd, setPreviewEnd] = useState(monthEnd);
    const [previewPeriodError, setPreviewPeriodError] = useState('');
    const [runPreview, previewQuery] = useLazyGetSalaryCalculationPreviewQuery();
    const [statementComment, setStatementComment] = useState('');
    const [showStatementConfirm, setShowStatementConfirm] = useState(false);
    const [statementResult, setStatementResult] = useState<{ statementId: string; status: string } | null>(null);
    const [createStatement, statementState] = useCreateFlexibleSalaryStatementMutation();

    useEffect(() => {
        // The server response is the source of truth when another employee or plan is loaded.
        if (planQuery.data) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPlanDraft(planToDraft(planQuery.data));
        } else if (planNotFound) {
            setPlanDraft(emptyPlan());
        }
    }, [planNotFound, planQuery.data]);

    const rules = useMemo(() => planQuery.data?.rules ?? [], [planQuery.data?.rules]);
    const statusesById = useMemo(
        () => new Map(statusesQuery.data?.map((status) => [status.id, status]) ?? []),
        [statusesQuery.data]
    );
    const workTypesById = useMemo(
        () => new Map(workTypesQuery.data?.map((workType) => [workType.id, workType]) ?? []),
        [workTypesQuery.data]
    );
    const duplicateKeys = useMemo(() => {
        const counts = new Map<string, number>();
        rules.filter((rule) => rule.active).forEach((rule) => {
            const key = getRuleKey(rule);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
    }, [rules]);

    const updatePlan = <Key extends keyof PlanDraft>(key: Key, value: PlanDraft[Key]) => {
        setPlanDraft((current) => ({ ...current, [key]: value }));
    };

    const handleEmployeeChange = (employeeId: string) => {
        setSelectedEmployeeChoice(employeeId);
        setPlanError('');
        setRuleError('');
        setStatementResult(null);
        setPreviewPeriodError('');
        previewQuery.reset();
    };

    const handleSavePlan = async (event: FormEvent) => {
        event.preventDefault();
        setPlanError('');
        if (!selectedEmployeeId) return;
        const baseSalary = parseDecimal(planDraft.baseSalary);
        const monthlyCap = planDraft.capEnabled ? parseDecimal(planDraft.monthlyCap) : null;
        if (!planDraft.name.trim()) return setPlanError(t('plan.validation.name'));
        if (!Number.isFinite(baseSalary) || baseSalary < 0) return setPlanError(t('plan.validation.salary'));
        if (planDraft.capEnabled && (!Number.isFinite(monthlyCap) || Number(monthlyCap) <= 0)) {
            return setPlanError(t('plan.validation.cap'));
        }
        if (!planDraft.effectiveFrom) return setPlanError(t('plan.validation.start'));
        if (planDraft.effectiveTo && planDraft.effectiveTo < planDraft.effectiveFrom) {
            return setPlanError(t('plan.validation.dates'));
        }

        try {
            await savePlan({
                userId: selectedEmployeeId,
                body: {
                    userId: selectedEmployeeId,
                    name: planDraft.name.trim(),
                    baseSalary,
                    monthlyCap,
                    capMode: planDraft.capMode,
                    carryForward: planDraft.carryForward,
                    effectiveFrom: planDraft.effectiveFrom,
                    effectiveTo: planDraft.effectiveTo || null,
                    active: planDraft.active,
                },
            }).unwrap();
            notifySuccess(planNotFound ? t('plan.created') : t('plan.saved'));
        } catch (error) {
            setPlanError(getLocalError(error, t('plan.saveError'), t('forbidden')));
        }
    };

    const handleDeleteRule = async () => {
        if (!deletingRule || !selectedEmployeeId) return;
        setRuleError('');
        try {
            await deleteRule({ ruleId: deletingRule.id, userId: selectedEmployeeId }).unwrap();
            notifySuccess(t('extras.deleted'));
            setDeletingRule(null);
        } catch (error) {
            setRuleError(getLocalError(error, t('extras.deleteError')));
            setDeletingRule(null);
        }
    };

    const handlePreview = async () => {
        setPreviewPeriodError('');
        setStatementResult(null);
        if (!selectedEmployeeId) return setPreviewPeriodError(t('preview.employeeRequired'));
        if (!previewStart || !previewEnd) return setPreviewPeriodError(t('preview.periodRequired'));
        if (previewEnd < previewStart) return setPreviewPeriodError(t('preview.datesInvalid'));
        try {
            await runPreview({
                employeeId: selectedEmployeeId,
                start: toOffsetIso(previewStart),
                end: toOffsetIso(previewEnd, true),
            }).unwrap();
        } catch (error) {
            setPreviewPeriodError(getLocalError(error, t('preview.calculateError')));
        }
    };

    const handleCreateStatement = async () => {
        if (!previewQuery.data || !selectedEmployeeId) return;
        setPreviewPeriodError('');
        try {
            const result = await createStatement({
                employeeId: selectedEmployeeId,
                start: toOffsetIso(previewStart),
                end: toOffsetIso(previewEnd, true),
                comment: statementComment.trim() || null,
            }).unwrap();
            setStatementResult(result);
            setShowStatementConfirm(false);
            notifySuccess(t('preview.statementCreated'));
        } catch (error) {
            setShowStatementConfirm(false);
            setPreviewPeriodError(getLocalError(error, t('preview.statementError')));
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1550px] space-y-6 pb-10">
            <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">{t('page.eyebrow')}</p>
                        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{t('page.title')}</h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                            {t('page.subtitle')}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-950 sm:flex">
                        <button
                            type="button"
                            onClick={() => setActiveSection('calculate')}
                            className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-black transition sm:px-4 sm:text-sm ${activeSection === 'calculate' ? 'bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-950' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            {t('page.calculate')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSection('settings')}
                            className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-black transition sm:px-4 sm:text-sm ${activeSection === 'settings' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            {t('page.settings')}
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/70">
                    {[
                        ['1', t('page.steps.employee')],
                        ['2', activeSection === 'calculate' ? t('page.steps.period') : t('page.steps.payment')],
                        ['3', activeSection === 'calculate' ? t('page.steps.review') : t('page.steps.save')],
                    ].map(([number, label]) => (
                        <div key={number} className="flex items-center justify-center gap-2 border-r border-slate-100 px-2 py-3 last:border-r-0 dark:border-slate-800">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{number}</span>
                            <span className="hidden text-xs font-bold text-slate-600 dark:text-slate-300 sm:block">{label}</span>
                        </div>
                    ))}
                </div>
            </header>

            <section data-tour="payroll-employee" className="rounded-[22px] border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-5 shadow-sm dark:border-violet-500/30 dark:from-violet-950/35 dark:to-slate-900">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                    <label>
                        <Label>{t('page.employee')}</Label>
                        <select
                            className={inputClass}
                            value={selectedEmployeeId}
                            disabled={employeesQuery.isFetching}
                            onChange={(event) => handleEmployeeChange(event.target.value)}
                        >
                            {!employeesQuery.data?.length && <option value="">{t('page.noEmployees')}</option>}
                            {employeesQuery.data?.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.name || employee.email || employee.id}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-400">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('page.account')}</span>
                        <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">{selectedEmployee?.email || t('page.notSelected')}</p>
                    </div>
                </div>
                {employeesQuery.isFetching && <div className="mt-4"><StateNotice tone="loading">{t('page.loadingEmployees')}</StateNotice></div>}
                {employeesQuery.isError && <div className="mt-4"><StateNotice tone="error">{getLocalError(employeesQuery.error, t('page.employeesError'), t('forbidden'))}</StateNotice></div>}
                {!employeesQuery.isFetching && !employeesQuery.isError && employeesQuery.data?.length === 0 && (
                    <div className="mt-4"><StateNotice tone="empty">{t('page.employeesEmpty')}</StateNotice></div>
                )}
            </section>

            {activeSection === 'settings' && <>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
                <p className="text-sm font-black text-blue-900 dark:text-violet-200">{t('page.warningTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-blue-700 dark:text-violet-300">{t('page.warningText')}</p>
            </div>

            <form data-tour="payroll-plan" onSubmit={handleSavePlan} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('plan.title')}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('plan.subtitle')}</p>
                    </div>
                    {planQuery.data && (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${planQuery.data.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {planQuery.data.active ? t('plan.active') : t('plan.inactive')}
                        </span>
                    )}
                </div>

                {planQuery.isFetching && <div className="mt-5"><StateNotice tone="loading">{t('plan.loading')}</StateNotice></div>}
                {planNotFound && <div className="mt-5"><StateNotice tone="empty">{t('plan.empty')}</StateNotice></div>}
                {planQuery.isError && !planNotFound && (
                    <div className="mt-5"><StateNotice tone="error">{getLocalError(planQuery.error, t('plan.loadError'), t('forbidden'))}</StateNotice></div>
                )}

                {!planQuery.isFetching && (!planQuery.isError || planNotFound) && selectedEmployeeId && (
                    <>
                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <label className="md:col-span-2">
                                <Label>{t('plan.name')}</Label>
                                <input disabled={!canEdit} className={inputClass} value={planDraft.name} onChange={(e) => updatePlan('name', e.target.value)} />
                            </label>
                            <label>
                                <Label>{t('plan.salary')}</Label>
                                <input disabled={!canEdit} type="text" inputMode="decimal" className={inputClass} value={planDraft.baseSalary} onChange={(e) => updatePlan('baseSalary', e.target.value)} />
                            </label>
                            <div data-tour="payroll-cap">
                                <Label>{t('plan.cap')}</Label>
                                <Toggle disabled={!canEdit} checked={planDraft.capEnabled} onChange={(value) => updatePlan('capEnabled', value)} label={t('plan.capEnabled')} />
                            </div>
                            {planDraft.capEnabled && (
                                <>
                                    <label>
                                        <Label>{t('plan.capAmount')}</Label>
                                        <input disabled={!canEdit} type="text" inputMode="decimal" className={inputClass} value={planDraft.monthlyCap} onChange={(e) => updatePlan('monthlyCap', e.target.value)} />
                                    </label>
                                    <label>
                                        <Label>{t('plan.capMode')}</Label>
                                        <select disabled={!canEdit} className={inputClass} value={planDraft.capMode} onChange={(e) => updatePlan('capMode', e.target.value as SalaryCapMode)}>
                                            <option value="TOTAL">{t('plan.capTotal')}</option>
                                            <option value="VARIABLE_ONLY">{t('plan.capVariable')}</option>
                                        </select>
                                    </label>
                                    <div data-tour="payroll-carry" className="md:col-span-2">
                                        <Label>{t('plan.excess')}</Label>
                                        <Toggle disabled={!canEdit} checked={planDraft.carryForward} onChange={(value) => updatePlan('carryForward', value)} label={t('plan.carry')} />
                                    </div>
                                </>
                            )}
                            <label>
                                <Label>{t('plan.effectiveFrom')}</Label>
                                <input disabled={!canEdit} type="date" className={inputClass} value={planDraft.effectiveFrom} onChange={(e) => updatePlan('effectiveFrom', e.target.value)} />
                            </label>
                            <label>
                                <Label>{t('plan.effectiveTo')}</Label>
                                <input disabled={!canEdit} type="date" className={inputClass} value={planDraft.effectiveTo} onChange={(e) => updatePlan('effectiveTo', e.target.value)} />
                            </label>
                            <div className="md:col-span-2">
                                <Label>{t('plan.state')}</Label>
                                <Toggle disabled={!canEdit} checked={planDraft.active} onChange={(value) => updatePlan('active', value)} label={t('plan.planActive')} />
                            </div>
                        </div>
                        {planError && <div className="mt-4"><StateNotice tone="error">{planError}</StateNotice></div>}
                        {canEdit && (
                            <button data-tour="payroll-save" disabled={savePlanState.isLoading} className="mt-5 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:bg-slate-300">
                                {savePlanState.isLoading ? t('plan.saving') : planNotFound ? t('plan.create') : t('plan.save')}
                            </button>
                        )}
                    </>
                )}
            </form>

            <section data-tour="payroll-rules" className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('extras.title')}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('extras.subtitle')}</p>
                    </div>
                    {canEdit && planQuery.data && (
                        <button type="button" onClick={() => setEditingRule(null)} className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
                            {t('extras.add')}
                        </button>
                    )}
                </div>

                {planQuery.isFetching && <div className="p-5"><StateNotice tone="loading">{t('extras.loading')}</StateNotice></div>}
                {planNotFound && <div className="p-5"><StateNotice tone="empty">{t('extras.planRequired')}</StateNotice></div>}
                {planQuery.isError && !planNotFound && <div className="p-5"><StateNotice tone="error">{t('extras.loadError')}</StateNotice></div>}
                {duplicateKeys.size > 0 && (
                    <div className="p-5 pb-0">
                        <StateNotice tone="info">
                            {t('extras.duplicates')}
                        </StateNotice>
                    </div>
                )}
                {ruleError && <div className="p-5 pb-0"><StateNotice tone="error">{ruleError}</StateNotice></div>}

                {planQuery.data && rules.length === 0 && (
                    <div className="p-8"><StateNotice tone="empty">{t('extras.empty')}</StateNotice></div>
                )}
                {rules.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1350px] text-left">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500">
                                <tr>
                                    {[t('extras.columns.name'), t('extras.columns.stage'), t('extras.columns.workType'), t('extras.columns.mode'), t('extras.columns.calculation'), t('extras.columns.rate'), t('extras.columns.priority'), t('extras.columns.period'), t('extras.columns.active'), t('extras.columns.actions')].map((title) => (
                                        <th key={title} className="p-4 font-bold">{title}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rules.map((rule) => {
                                    const duplicate = rule.active && duplicateKeys.has(getRuleKey(rule));
                                    return (
                                        <tr key={rule.id} className={duplicate ? 'bg-amber-50/70 dark:bg-amber-500/10' : 'hover:bg-blue-50/30 dark:hover:bg-violet-500/5'}>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{rule.name}</div>
                                                {duplicate && <span className="mt-1 inline-block text-xs font-semibold text-amber-700">{t('extras.ambiguous')}</span>}
                                            </td>
                                            <td className="p-4">
                                                {rule.statusId ? (
                                                    <div>
                                                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">{statusesById.get(rule.statusId)?.code || t('extras.codeMissing')}</span>
                                                        <p className="mt-1.5 text-xs font-semibold text-slate-600">{rule.statusName || statusesById.get(rule.statusId)?.name || t('extras.stageDeleted')}</p>
                                                    </div>
                                                ) : <span className="text-sm text-slate-500">{t('extras.anyStage')}</span>}
                                            </td>
                                            <td className="p-4">
                                                {rule.workTypeId ? (
                                                    <div>
                                                        <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-700">{workTypesById.get(rule.workTypeId)?.code || t('extras.codeMissing')}</span>
                                                        <p className="mt-1.5 text-xs font-semibold text-slate-600">{rule.workTypeName || workTypesById.get(rule.workTypeId)?.name || t('extras.workTypeDeleted')}</p>
                                                    </div>
                                                ) : <span className="text-sm text-slate-500">{t('extras.anyWorkType')}</span>}
                                            </td>
                                            <td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{t(`treatments.${rule.treatment}`)}</span></td>
                                            <td className="p-4 text-sm text-slate-600">{t(`calculations.${rule.calculationType}`)}</td>
                                            <td className="p-4 text-sm font-black text-slate-800">{rule.calculationType === 'PERCENT_OF_TASK' ? `${rule.rate}%` : localizedMoney(rule.rate)}</td>
                                            <td className="p-4 text-sm font-bold text-slate-700">{rule.priority}</td>
                                            <td className="p-4 text-sm text-slate-500">{localizedDate(rule.effectiveFrom)} — {localizedDate(rule.effectiveTo)}</td>
                                            <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rule.active ? t('extras.active') : t('extras.inactive')}</span></td>
                                            <td className="p-4">
                                                {canEdit && (
                                                    <div className="flex gap-2">
                                                        <button type="button" onClick={() => setEditingRule(rule)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{commonT('edit')}</button>
                                                        <button type="button" onClick={() => setDeletingRule(rule)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">{commonT('delete')}</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
            </>}

            {activeSection === 'calculate' && <section data-tour="payroll-preview" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400">{t('preview.step')}</p>
                            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{t('preview.title')}</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('preview.subtitle')}</p>
                        </div>
                        {planQuery.data ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">{t('preview.usingPlan')}</p>
                                <p className="text-xs font-black text-emerald-900 dark:text-emerald-200">{planQuery.data.name}</p>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                    <label>
                        <Label>{t('preview.start')}</Label>
                        <input type="date" className={inputClass} value={previewStart} onChange={(e) => setPreviewStart(e.target.value)} />
                    </label>
                    <label>
                        <Label>{t('preview.end')}</Label>
                        <input type="date" className={inputClass} value={previewEnd} onChange={(e) => setPreviewEnd(e.target.value)} />
                    </label>
                    <button type="button" onClick={handlePreview} disabled={previewQuery.isFetching || !selectedEmployeeId} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
                        {previewQuery.isFetching ? t('preview.calculating') : t('preview.calculate')}
                    </button>
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('preview.rangeHint')}</p>
                {previewPeriodError && <div className="mt-4"><StateNotice tone="error">{previewPeriodError}</StateNotice></div>}
                {!previewQuery.data && !previewQuery.isFetching && !previewPeriodError && (
                    <div className="mt-5"><StateNotice tone="empty">{t('preview.startHint')}</StateNotice></div>
                )}
                {previewQuery.isFetching && <div className="mt-5"><StateNotice tone="loading">{t('preview.loading')}</StateNotice></div>}

                {previewQuery.data && (
                    <>
                        <div data-tour="payroll-preview-result" className="mt-6 grid gap-3 lg:grid-cols-[1.25fr_1fr_1fr]">
                            <article className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-950/50">
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">{t('preview.payable')}</p>
                                <p className="mt-2 text-3xl font-black">{localizedMoney(previewQuery.data.payable)}</p>
                                <p className="mt-2 text-xs leading-5 text-emerald-100">{t('preview.payableHint')}</p>
                            </article>
                            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('preview.earned')}</p>
                                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{localizedMoney(previewQuery.data.grossAccrued)}</p>
                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('preview.earnedHint')}</p>
                            </article>
                            <article className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/30 dark:bg-violet-500/10">
                                <p className="text-xs font-bold text-violet-700 dark:text-violet-300">{t('preview.breakdown')}</p>
                                <div className="mt-3 space-y-2 text-xs">
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{t('preview.salary')}</span><strong className="text-slate-900 dark:text-white">{localizedMoney(previewQuery.data.baseSalary)}</strong></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{t('preview.extras')}</span><strong className="text-violet-800 dark:text-violet-300">{localizedMoney(previewQuery.data.extraAccrued)}</strong></div>
                                </div>
                            </article>
                        </div>

                        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200">
                                {t('preview.limits')}
                            </summary>
                            <dl className="grid gap-3 border-t border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    [t('preview.carryIn'), previewQuery.data.carryIn],
                                    [t('preview.available'), previewQuery.data.available],
                                    [t('preview.monthlyCap'), previewQuery.data.monthlyCap],
                                    [t('preview.carryOut'), previewQuery.data.carryOut],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-xl bg-white p-3 dark:bg-slate-900">
                                        <dt className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{label}</dt>
                                        <dd className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{localizedMoney(value as number | null)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </details>

                        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"><p className="font-bold text-slate-800 dark:text-slate-100">{t('preview.detailsTitle')}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('preview.detailsHint')}</p></div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-left">
                                    <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:text-slate-500">
                                        <tr>
                                            {[t('preview.columns.rule'), t('preview.columns.stage'), t('preview.columns.workType'), t('preview.columns.method'), t('preview.columns.volume'), t('preview.columns.rate'), t('preview.columns.amount'), t('preview.columns.state')].map((title) => (
                                                <th key={title} className="p-4 font-bold">{title}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {previewQuery.data.accruals?.map((accrual, index) => {
                                            const isReview = accrual.treatment === 'REQUIRES_REVIEW';
                                            const isIncluded = accrual.treatment === 'INCLUDED_IN_BASE';
                                            return (
                                                <tr key={accrual.id ?? `${accrual.taskId}-${index}`} className={isReview ? 'bg-amber-50/60 dark:bg-amber-500/10' : ''}>
                                                    <td className="p-4">
                                                        <div className="text-sm font-bold text-slate-800">{accrual.ruleName || accrual.taskId || t('preview.accrual')}</div>
                                                        {accrual.orderNumber && <div className="mt-1 text-xs text-slate-400">{accrual.orderNumber}</div>}
                                                    </td>
                                                    <td className="p-4">
                                                        {accrual.statusId ? (
                                                            <div><span className="text-[10px] font-black uppercase text-blue-700">{statusesById.get(accrual.statusId)?.code || '—'}</span><p className="mt-1 text-xs text-slate-600">{accrual.statusName || statusesById.get(accrual.statusId)?.name || t('preview.stage')}</p></div>
                                                        ) : <span className="text-sm text-slate-500">{t('preview.anyStage')}</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        {accrual.workTypeId ? (
                                                            <div><span className="text-[10px] font-black uppercase text-violet-700">{workTypesById.get(accrual.workTypeId)?.code || '—'}</span><p className="mt-1 text-xs text-slate-600">{accrual.workTypeName || workTypesById.get(accrual.workTypeId)?.name || t('preview.workType')}</p></div>
                                                        ) : <span className="text-sm text-slate-500">{t('preview.anyWorkType')}</span>}
                                                    </td>
                                                    <td className="p-4 text-sm text-slate-600">{accrual.calculationType ? t(`calculations.${accrual.calculationType}`) : '—'}</td>
                                                    <td className="p-4 text-sm text-slate-600">{accrual.quantity ?? '—'}</td>
                                                    <td className="p-4 text-sm text-slate-600">{accrual.rate === null || accrual.rate === undefined ? '—' : localizedMoney(accrual.rate)}</td>
                                                    <td className={`p-4 text-sm font-black ${isReview ? 'text-slate-400' : 'text-emerald-700'}`}>{localizedMoney(isIncluded ? 0 : accrual.amount)}</td>
                                                    <td className="p-4">
                                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isReview ? 'bg-amber-100 text-amber-800' : isIncluded ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                            {isReview ? t('preview.review') : t(`treatments.${accrual.treatment}`)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!previewQuery.data.accruals?.length && (
                                            <tr><td colSpan={8} className="p-8 text-center text-sm text-slate-400">{t('preview.empty')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {canEdit && (
                            <div data-tour="payroll-statement" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                <label>
                                    <Label>{t('preview.statementComment')}</Label>
                                    <input className={inputClass} value={statementComment} onChange={(e) => setStatementComment(e.target.value)} placeholder={t('preview.statementPlaceholder')} />
                                </label>
                                <button type="button" onClick={() => setShowStatementConfirm(true)} disabled={statementState.isLoading} className="mt-4 min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300">
                                    {t('preview.continue')}
                                </button>
                            </div>
                        )}
                        {statementResult && (
                            <div className="mt-4"><StateNotice tone="info">{t('preview.created', {id: statementResult.statementId, status: statementResult.status})}</StateNotice></div>
                        )}
                    </>
                )}
            </section>}

            {editingRule !== undefined && planQuery.data && (
                <RuleEditor
                    plan={planQuery.data}
                    rule={editingRule}
                    userId={selectedEmployeeId}
                    canEdit={canEdit}
                    onClose={() => setEditingRule(undefined)}
                />
            )}

            {deletingRule && (
                <Modal>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('preview.deleteRuleTitle')}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {t('preview.deleteRuleDescription', {name: deletingRule.name})}
                    </p>
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => setDeletingRule(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{commonT('cancel')}</button>
                        <button type="button" onClick={handleDeleteRule} disabled={deleteRuleState.isLoading} className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white disabled:bg-slate-300">
                            {deleteRuleState.isLoading ? t('preview.deleting') : commonT('delete')}
                        </button>
                    </div>
                </Modal>
            )}

            {showStatementConfirm && previewQuery.data && (
                <Modal>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('preview.confirmTitle')}</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('preview.confirmHint')}</p>
                    <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950">
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">{t('preview.accrued')}</dt><dd className="font-black text-slate-900">{localizedMoney(previewQuery.data.grossAccrued)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">{t('preview.toPay')}</dt><dd className="font-black text-emerald-700">{localizedMoney(previewQuery.data.payable)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">{t('preview.carryOut')}</dt><dd className="font-black text-amber-700">{localizedMoney(previewQuery.data.carryOut)}</dd></div>
                    </dl>
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => setShowStatementConfirm(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{commonT('cancel')}</button>
                        <button type="button" onClick={handleCreateStatement} disabled={statementState.isLoading} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:bg-slate-300">
                            {statementState.isLoading ? t('preview.forming') : commonT('confirm')}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
