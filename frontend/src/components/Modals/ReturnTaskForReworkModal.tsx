'use client';

import { FormEvent, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/src/components/ui/Modal';
import {
    useGetTaskReworkOptionsQuery,
    useReturnTaskForReworkMutation,
} from '@/src/services/api/tasksReworkApi';
import {mvpModules} from '@/src/lib/mvp';
import { useGetStockOverviewQuery } from '@/src/services/api/warehouseApi';
import type { QualityIncidentType } from '@/src/types/task.types';
import { useAppFormatters } from '@/src/i18n/provider';

const INCIDENT_TYPES: QualityIncidentType[] = ['REWORK', 'DEFECT'];

const REASON_CODES = [
    'QUALITY_DEFECT',
    'WRONG_SIZE',
    'WRONG_COLOR',
    'DAMAGED',
    'TECHNOLOGY_VIOLATION',
    'OTHER',
] as const;

type ReturnTaskForReworkModalProps = {
    taskId: string;
    onClose: () => void;
    onSuccess: (statusName: string) => void;
};

type StockWriteOffDraft = {
    id: number;
    nomenclatureId: string;
    quantity: string;
};

export default function ReturnTaskForReworkModal({
    taskId,
    onClose,
    onSuccess,
}: ReturnTaskForReworkModalProps) {
    const t = useTranslations('tasks.rework');
    const qualityT = useTranslations('tasks.quality');
    const commonT = useTranslations('common');
    const formats = useAppFormatters();
    const titleId = useId();
    const [selectedStatusId, setSelectedStatusId] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [incidentType, setIncidentType] = useState<QualityIncidentType | ''>('');
    const [reasonCode, setReasonCode] = useState('');
    const [description, setDescription] = useState('');
    const [materialLossAmount, setMaterialLossAmount] = useState('');
    const [salaryDeductionAmount, setSalaryDeductionAmount] = useState('');
    const [stockWriteOffs, setStockWriteOffs] = useState<StockWriteOffDraft[]>([]);
    const [formError, setFormError] = useState('');
    const nextStockWriteOffId = useRef(1);
    const {
        data: reworkOptions = [],
        error: optionsError,
        isError: isOptionsError,
        isFetching: isOptionsFetching,
        isLoading: isOptionsLoading,
        refetch: refetchOptions,
    } = useGetTaskReworkOptionsQuery(taskId, {
        refetchOnMountOrArgChange: true,
    });
    const stockOverviewQuery = useGetStockOverviewQuery(undefined, {
        skip: !mvpModules.warehouse,
        refetchOnMountOrArgChange: true,
    });
    const [returnTaskForRework, { isLoading: isSubmitting }] = useReturnTaskForReworkMutation();
    const selectedOption = useMemo(
        () => reworkOptions.find((option) => option.statusId === selectedStatusId),
        [reworkOptions, selectedStatusId]
    );
    const employees = selectedOption?.eligibleAssignees ?? [];
    const stockItems = useMemo(
        () => stockOverviewQuery.data?.items ?? [],
        [stockOverviewQuery.data?.items]
    );
    const stockItemsById = useMemo(
        () => new Map(stockItems.map((item) => [item.nomenclatureId, item])),
        [stockItems]
    );
    const selectedNomenclatureIds = useMemo(
        () => new Set(stockWriteOffs.map((item) => item.nomenclatureId).filter(Boolean)),
        [stockWriteOffs]
    );
    const stockWriteOffValidationError = getStockWriteOffValidationError(stockWriteOffs, t);
    const isFormValid = Boolean(
        selectedStatusId
        && assignedTo
        && incidentType
        && reasonCode
        && description.trim()
        && !stockWriteOffValidationError
    );

    const handleStatusChange = (statusId: string) => {
        setSelectedStatusId(statusId);
        setAssignedTo('');
        setFormError('');
    };

    const handleAddStockWriteOff = () => {
        setStockWriteOffs((current) => [
            ...current,
            {
                id: nextStockWriteOffId.current++,
                nomenclatureId: '',
                quantity: '',
            },
        ]);
        setFormError('');
    };

    const handleNomenclatureChange = (id: number, nomenclatureId: string) => {
        if (
            nomenclatureId
            && stockWriteOffs.some((item) => item.id !== id && item.nomenclatureId === nomenclatureId)
        ) {
            setFormError(t('duplicate'));
            return;
        }

        setStockWriteOffs((current) => current.map((item) => (
            item.id === id ? { ...item, nomenclatureId } : item
        )));
        setFormError('');
    };

    const handleQuantityChange = (id: number, quantity: string) => {
        setStockWriteOffs((current) => current.map((item) => (
            item.id === id ? { ...item, quantity } : item
        )));
        setFormError('');
    };

    const handleRemoveStockWriteOff = (id: number) => {
        setStockWriteOffs((current) => current.filter((item) => item.id !== id));
        setFormError('');
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');

        if (!isFormValid || !selectedOption || !incidentType) {
            setFormError(
                stockWriteOffValidationError
                || t('required')
            );
            return;
        }

        if (!employees.some((employee) => employee.userId === assignedTo)) {
            setAssignedTo('');
            setFormError(t('employeeUnavailable'));
            void refetchOptions();
            return;
        }

        try {
            await returnTaskForRework({
                taskId,
                body: {
                    targetStatusId: selectedStatusId,
                    assignedTo,
                    incidentType,
                    reasonCode,
                    description: description.trim(),
                    ...toOptionalAmount('materialLossAmount', materialLossAmount),
                    ...toOptionalAmount('salaryDeductionAmount', salaryDeductionAmount),
                    ...(stockWriteOffs.length > 0
                        ? {
                            stockWriteOffs: stockWriteOffs.map((item) => ({
                                nomenclatureId: item.nomenclatureId,
                                quantity: Number(item.quantity),
                            })),
                        }
                        : {}),
                },
            }).unwrap();

            onSuccess(selectedOption.statusName);
        } catch (error) {
            if (isReworkConflict(error)) {
                setAssignedTo('');
                await refetchOptions();
            }
            setFormError(getReworkApiErrorMessage(error, t));
        }
    };

    return (
        <Modal contentClassName="max-w-3xl p-0">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex min-h-0 flex-col"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white p-5 dark:border-slate-700 dark:from-amber-950/20 dark:to-slate-900 sm:p-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
                            {t('badge')}
                        </p>
                        <h2 id={titleId} className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                            {t('title')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {t('subtitle')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label={commonT('actions.close')}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl font-bold leading-none text-slate-400 shadow-sm transition hover:bg-slate-100 disabled:cursor-wait dark:bg-slate-800"
                    >
                        &times;
                    </button>
                </header>

                {isOptionsLoading ? (
                    <div className="space-y-3 p-5 sm:p-6" aria-busy="true">
                        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                        <p className="text-center text-sm font-semibold text-slate-500">
                            {t('loadingOptions')}
                        </p>
                    </div>
                ) : null}

                {!isOptionsLoading && isOptionsError ? (
                    <div className="p-5 sm:p-6">
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                            <p className="text-sm font-bold text-red-800">
                                {getReworkApiErrorMessage(optionsError, t, t('optionsError'))}
                            </p>
                            <button
                                type="button"
                                onClick={() => void refetchOptions()}
                                disabled={isOptionsFetching}
                                className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                            >
                                {isOptionsFetching ? t('updating') : commonT('actions.retry')}
                            </button>
                        </div>
                    </div>
                ) : null}

                {!isOptionsLoading && !isOptionsError && reworkOptions.length === 0 ? (
                    <div className="p-5 sm:p-6">
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="font-bold text-slate-700">{t('noStages')}</p>
                            <p className="mt-1 text-sm text-slate-500">
                                {t('noStagesHint')}
                            </p>
                        </div>
                    </div>
                ) : null}

                {!isOptionsLoading && !isOptionsError && reworkOptions.length > 0 ? (
                    <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-5 sm:p-6">
                        <div className="space-y-5">
                            <Field label={t('startStage')} required>
                                <select
                                    value={selectedStatusId}
                                    onChange={(event) => handleStatusChange(event.target.value)}
                                    className={inputClassName}
                                    required
                                >
                                    <option value="">{t('stagePlaceholder')}</option>
                                    {reworkOptions.map((option) => (
                                        <option key={option.statusId} value={option.statusId}>
                                            {option.statusName}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label={t('responsible')} required>
                                <select
                                    value={assignedTo}
                                    onChange={(event) => {
                                        setAssignedTo(event.target.value);
                                        setFormError('');
                                    }}
                                    className={inputClassName}
                                    disabled={!selectedStatusId || employees.length === 0}
                                    required
                                >
                                    <option value="">
                                        {!selectedStatusId ? t('employeeBeforeStage') : t('employeePlaceholder')}
                                    </option>
                                    {employees.map((employee) => (
                                        <option key={employee.userId} value={employee.userId}>
                                            {employee.fullName}
                                            {employee.isCurrent ? ` — ${t('currentEmployee')}` : ''}
                                            {' — '}{t('activeTasks', {count: employee.activeTaskCount})}
                                        </option>
                                    ))}
                                </select>
                                {selectedStatusId && employees.length === 0 ? (
                                    <p className="mt-2 text-xs font-bold text-amber-700">
                                        {t('noEmployees')}
                                    </p>
                                ) : null}
                            </Field>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t('incidentType')} required>
                                    <select
                                        value={incidentType}
                                        onChange={(event) => setIncidentType(event.target.value as QualityIncidentType | '')}
                                        className={inputClassName}
                                        required
                                    >
                                        <option value="">{t('typePlaceholder')}</option>
                                        {INCIDENT_TYPES.map((option) => (
                                            <option key={option} value={option}>{qualityT(`incidentTypes.${option}`)}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label={t('reason')} required>
                                    <select
                                        value={reasonCode}
                                        onChange={(event) => setReasonCode(event.target.value)}
                                        className={inputClassName}
                                        required
                                    >
                                        <option value="">{t('reasonPlaceholder')}</option>
                                        {REASON_CODES.map((option) => (
                                            <option key={option} value={option}>{qualityT(`reasons.${option}`)}</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>

                            <Field label={t('description')} required>
                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder={t('descriptionPlaceholder')}
                                    className={`${inputClassName} min-h-28 resize-y`}
                                    required
                                />
                            </Field>

                            {mvpModules.finance && <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t('materialLoss')}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={materialLossAmount}
                                        onChange={(event) => setMaterialLossAmount(event.target.value)}
                                        placeholder="0"
                                        className={inputClassName}
                                    />
                                </Field>

                                <Field label={t('deduction')}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={salaryDeductionAmount}
                                        onChange={(event) => setSalaryDeductionAmount(event.target.value)}
                                        placeholder="0"
                                        className={inputClassName}
                                    />
                                </Field>
                            </div>}

                            {mvpModules.warehouse && <section
                                aria-labelledby={`${titleId}-materials`}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 id={`${titleId}-materials`} className="text-sm font-black text-slate-900">
                                            {t('extraMaterials')}
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {t('extraMaterialsHint')}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddStockWriteOff}
                                        disabled={
                                            isSubmitting
                                            || stockOverviewQuery.isLoading
                                            || stockOverviewQuery.isError
                                            || stockItems.length === 0
                                            || selectedNomenclatureIds.size >= stockItems.length
                                        }
                                        className="shrink-0 rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                    >
                                        {t('addItem')}
                                    </button>
                                </div>

                                {stockOverviewQuery.isLoading ? (
                                    <p className="mt-4 text-xs font-semibold text-slate-500" aria-live="polite">
                                        {t('loadingStock')}
                                    </p>
                                ) : null}

                                {stockOverviewQuery.isError ? (
                                    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs font-bold text-red-700">
                                            {t('stockError')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void stockOverviewQuery.refetch()}
                                            disabled={stockOverviewQuery.isFetching}
                                            className="shrink-0 text-xs font-black text-red-700 underline underline-offset-2 disabled:cursor-wait disabled:opacity-60"
                                        >
                                            {stockOverviewQuery.isFetching ? t('updating') : commonT('actions.retry')}
                                        </button>
                                    </div>
                                ) : null}

                                {!stockOverviewQuery.isLoading
                                    && !stockOverviewQuery.isError
                                    && stockItems.length === 0 ? (
                                        <p className="mt-4 text-xs font-semibold text-slate-500">
                                            {t('emptyStock')}
                                        </p>
                                    ) : null}

                                {stockWriteOffs.length > 0 ? (
                                    <div className="mt-4 space-y-3">
                                        {stockWriteOffs.map((item, index) => {
                                            const stockItem = stockItemsById.get(item.nomenclatureId);
                                            const quantity = Number(item.quantity);
                                            const hasInvalidQuantity = Boolean(
                                                item.quantity && !isPositiveQuantity(item.quantity)
                                            );
                                            const exceedsCurrentStock = Boolean(
                                                stockItem
                                                && isPositiveQuantity(item.quantity)
                                                && quantity > stockItem.currentQuantity
                                            );

                                            return (
                                                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs font-black text-slate-700">
                                                            {t('item', {number: index + 1})}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStockWriteOff(item.id)}
                                                            disabled={isSubmitting}
                                                            aria-label={t('removeAria', {number: index + 1})}
                                                            className="text-xs font-bold text-slate-400 transition hover:text-red-600 disabled:cursor-wait"
                                                        >
                                                            {commonT('actions.delete')}
                                                        </button>
                                                    </div>

                                                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,.38fr)]">
                                                        <label className="block">
                                                            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                                {t('nomenclature')} <span className="text-red-500">*</span>
                                                            </span>
                                                            <select
                                                                value={item.nomenclatureId}
                                                                onChange={(event) => handleNomenclatureChange(item.id, event.target.value)}
                                                                className={inputClassName}
                                                                required
                                                            >
                                                                <option value="">{t('itemPlaceholder')}</option>
                                                                {stockItems.map((option) => (
                                                                    <option
                                                                        key={option.nomenclatureId}
                                                                        value={option.nomenclatureId}
                                                                        disabled={
                                                                            option.nomenclatureId !== item.nomenclatureId
                                                                            && selectedNomenclatureIds.has(option.nomenclatureId)
                                                                        }
                                                                    >
                                                                        {option.name} — {formats.number(option.currentQuantity, {maximumFractionDigits: 3})} {option.unit}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {stockItem ? (
                                                                <p className="mt-1.5 text-[11px] text-slate-500">
                                                                    {t('currentStock', {quantity: `${formats.number(stockItem.currentQuantity, {maximumFractionDigits: 3})} ${stockItem.unit}`})}
                                                                </p>
                                                            ) : null}
                                                        </label>

                                                        <label className="block">
                                                            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                                {t('quantity')} <span className="text-red-500">*</span>
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0.000001"
                                                                step="any"
                                                                value={item.quantity}
                                                                onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                                                                placeholder="0"
                                                                className={inputClassName}
                                                                required
                                                            />
                                                            {stockItem ? (
                                                                <p className="mt-1.5 text-[11px] text-slate-500">
                                                                    {t('unit', {unit: stockItem.unit})}
                                                                </p>
                                                            ) : null}
                                                        </label>
                                                    </div>

                                                    {hasInvalidQuantity ? (
                                                        <p className="mt-2 text-xs font-bold text-red-600" role="alert">
                                                            {t('quantityPositive')}
                                                        </p>
                                                    ) : null}

                                                    {exceedsCurrentStock ? (
                                                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" role="status">
                                                            {t('quantityOverflow')}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">
                                        {t('noMaterials')}
                                    </p>
                                )}
                            </section>}

                            {formError ? (
                                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
                                    {formError}
                                </p>
                            ) : null}
                        </div>

                        <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                            >
                                {commonT('actions.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={!isFormValid || employees.length === 0 || isSubmitting}
                                className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {isSubmitting ? t('submitting') : t('submit')}
                            </button>
                        </footer>
                    </form>
                ) : null}
            </div>
        </Modal>
    );
}

const inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

function Field({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            {children}
        </label>
    );
}

function toOptionalAmount<Key extends 'materialLossAmount' | 'salaryDeductionAmount'>(
    key: Key,
    value: string
): Partial<Record<Key, number>> {
    if (!value.trim()) return {};

    const amount = Number(value);

    return Number.isFinite(amount) && amount >= 0 ? { [key]: amount } as Record<Key, number> : {};
}

function isPositiveQuantity(value: string) {
    if (!value.trim()) return false;

    const quantity = Number(value);

    return Number.isFinite(quantity) && quantity > 0;
}

type ReworkTranslator = ReturnType<typeof useTranslations<'tasks.rework'>>;

function getStockWriteOffValidationError(
    items: StockWriteOffDraft[],
    t: ReworkTranslator
) {
    if (items.some((item) => !item.nomenclatureId)) {
        return t('selectAllItems');
    }

    if (items.some((item) => !isPositiveQuantity(item.quantity))) {
        return t('allPositive');
    }

    const nomenclatureIds = items.map((item) => item.nomenclatureId);

    if (new Set(nomenclatureIds).size !== nomenclatureIds.length) {
        return t('noDuplicates');
    }

    return '';
}

function getErrorStatus(error: unknown) {
    if (!isRecord(error)) return undefined;

    return typeof error.status === 'number' ? error.status : undefined;
}

function getReworkApiErrorMessage(
    error: unknown,
    t: ReworkTranslator,
    fallback = t('submitError')
) {
    const status = getErrorStatus(error);
    const serverMessage = getServerMessage(error);

    if (status === 400) return serverMessage || t('errors.badRequest');
    if (status === 401) return t('errors.unauthorized');
    if (status === 403) return t('errors.forbidden');
    if (status === 404) return t('errors.notFound');
    if (status === 409) return t('errors.conflict');
    if (status === 500) return t('errors.server');

    return serverMessage || fallback;
}

function isReworkConflict(error: unknown) {
    const status = getErrorStatus(error);

    if (status === 409) return true;
    if (!isRecord(error) || !isRecord(error.data)) return false;

    const code = String(error.data.code ?? error.data.errorCode ?? '').toUpperCase();

    return ['REWORK', 'ASSIGNEE', 'STATUS', 'ROLE', 'CONFLICT'].some((part) => code.includes(part));
}

function getServerMessage(error: unknown) {
    if (!isRecord(error) || !isRecord(error.data)) return '';

    const message = error.data.message ?? error.data.detail ?? error.data.error;

    return typeof message === 'string' ? message : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
