'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/src/components/ui/Modal';
import { getApiErrorMessage } from '@/src/services/apiNotifications';
import {
    useGetTaskMaterialAccountingQuery,
    useGetTaskMaterialPlanQuery,
    useGetTaskMaterialUsagesQuery,
    useUpdateTaskStatusMutation,
} from '@/src/services/api/ordersApi';
import { useGetNomenclatureQuery } from '@/src/services/api/warehouseApi';
import {
    useGetWorkflowStatusesQuery,
} from '@/src/services/api/workflowApi';
import type {
    MaterialAccountingItem,
    MaterialPlanItem,
    MaterialUsageHistoryItem,
    MaterialUsageRequest,
} from '@/src/types/task.types';
import { createMaterialReportId } from '@/src/utils/materialAccounting';
import { useAppFormatters, useAppLocale } from '@/src/i18n/provider';
import { intlLocaleByLocale } from '@/src/i18n/config';

type QuantityField =
    | 'issuedQuantity'
    | 'consumedQuantity'
    | 'wasteQuantity'
    | 'returnedQuantity';

type ReportRow = {
    key: string;
    nomenclatureId: string;
    nomenclatureName: string;
    unit: string;
    plannedTaskQuantity: number;
    plannedWasteQuantity: number;
    remainingPlannedWasteQuantity: number;
    alreadyConsumedQuantity: number;
    alreadyWasteQuantity: number;
    remainingReservedQuantity: number;
    wasteLimitPercent?: number | null;
    isPlanned: boolean;
    issuedQuantity: string;
    consumedQuantity: string;
    wasteQuantity: string;
    returnedQuantity: string;
    note: string;
};

const QUANTITY_FIELDS: QuantityField[] = [
    'issuedQuantity',
    'consumedQuantity',
    'wasteQuantity',
    'returnedQuantity',
];
const QUANTITY_PATTERN = /^\d+(?:[.,]\d{1,4})?$/u;

function parseQuantity(value: string) {
    if (!QUANTITY_PATTERN.test(value.trim())) return null;
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function quantityUnits(value: string) {
    const normalized = value.trim().replace(',', '.');
    if (!QUANTITY_PATTERN.test(normalized)) return null;
    const [integer, fraction = ''] = normalized.split('.');
    return Number(integer) * 10_000 + Number(fraction.padEnd(4, '0'));
}

function getUsageTotals(
    usages: MaterialUsageHistoryItem[],
    nomenclatureId: string
) {
    return usages
        .filter((usage) => usage.nomenclatureId === nomenclatureId)
        .reduce(
            (total, usage) => ({
                consumed: total.consumed + usage.consumedQuantity,
                waste: total.waste + usage.wasteQuantity,
                returned: total.returned + usage.returnedQuantity,
            }),
            { consumed: 0, waste: 0, returned: 0 }
        );
}

function createRow(
    plan: MaterialPlanItem,
    accounting: MaterialAccountingItem | undefined,
    usages: MaterialUsageHistoryItem[]
): ReportRow {
    const usageTotals = getUsageTotals(usages, plan.nomenclatureId);
    const alreadyConsumed = accounting?.actualConsumedQuantity ?? usageTotals.consumed;
    const alreadyWaste = accounting?.actualWasteQuantity ?? usageTotals.waste;
    const alreadyReturned = accounting?.returnedQuantity ?? usageTotals.returned;
    const plannedTaskQuantity = accounting?.plannedTotalQuantity
        ?? plan.remainingStandardQuantity + plan.remainingWasteQuantity;

    return {
        key: plan.nomenclatureId,
        nomenclatureId: plan.nomenclatureId,
        nomenclatureName: plan.nomenclatureName,
        unit: plan.unit,
        plannedTaskQuantity,
        plannedWasteQuantity: accounting?.plannedWasteQuantity ?? plan.remainingWasteQuantity,
        remainingPlannedWasteQuantity: plan.remainingWasteQuantity,
        alreadyConsumedQuantity: alreadyConsumed,
        alreadyWasteQuantity: alreadyWaste,
        remainingReservedQuantity: accounting?.remainingReservedQuantity
            ?? plan.remainingReservedQuantity
            ?? Math.max(0, plannedTaskQuantity - alreadyConsumed - alreadyWaste - alreadyReturned),
        wasteLimitPercent: plan.wasteLimitPercent ?? accounting?.wasteLimitPercent,
        isPlanned: true,
        issuedQuantity: '',
        consumedQuantity: '',
        wasteQuantity: '',
        returnedQuantity: '',
        note: '',
    };
}

function toUsage(row: ReportRow): MaterialUsageRequest {
    return {
        nomenclatureId: row.nomenclatureId,
        issuedQuantity: parseQuantity(row.issuedQuantity) ?? 0,
        consumedQuantity: parseQuantity(row.consumedQuantity) ?? 0,
        wasteQuantity: parseQuantity(row.wasteQuantity) ?? 0,
        returnedQuantity: parseQuantity(row.returnedQuantity) ?? 0,
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
    };
}

type TransitionTranslator = ReturnType<typeof useTranslations<'tasks.transition'>>;

function getRowError(row: ReportRow, t: TransitionTranslator) {
    const values = QUANTITY_FIELDS.map((field) => row[field]);
    if (values.some((value) => value.trim().startsWith('-'))) {
        return t('negative');
    }
    if (values.some((value) => !QUANTITY_PATTERN.test(value.trim()))) {
        return t('invalidPrecision');
    }

    const issued = quantityUnits(row.issuedQuantity) ?? 0;
    const consumed = quantityUnits(row.consumedQuantity) ?? 0;
    const waste = quantityUnits(row.wasteQuantity) ?? 0;
    const returned = quantityUnits(row.returnedQuantity) ?? 0;

    if (issued <= 0) return t('issuedPositive');
    if (issued !== consumed + waste + returned) {
        return t('totalsMismatch');
    }
    if (waste > 0 && !row.note.trim()) {
        return t('wasteReason');
    }
    return '';
}

function QuantityInput({
    label,
    unit,
    value,
    onChange,
    disabled,
}: {
    label: string;
    unit: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    return (
        <label className="block min-w-32">
            <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">
                {label}
            </span>
            <span className="flex overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-violet-500">
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                    placeholder="0,0000"
                    aria-label={`${label}, ${unit}`}
                    className="min-w-0 flex-1 px-2 py-2 text-xs outline-none disabled:bg-slate-100"
                />
                <span className="flex items-center border-l border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-500">
                    {unit}
                </span>
            </span>
        </label>
    );
}

export default function WarehouseTransitionModal({
    taskId,
    nextStatusId,
    assignedUserId,
    defaultComment = '',
    onClose,
    onSuccess,
}: {
    taskId: string;
    nextStatusId: string;
    assignedUserId?: string;
    defaultComment?: string;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const t = useTranslations('tasks.transition');
    const commonT = useTranslations('common');
    const formats = useAppFormatters();
    const { locale } = useAppLocale();
    const intlLocale = intlLocaleByLocale[locale];
    const [materialReportId] = useState(createMaterialReportId);
    const [screen, setScreen] = useState<'form' | 'review'>('form');
    const [comment, setComment] = useState(defaultComment);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [measurementConfirmed, setMeasurementConfirmed] = useState(false);
    const [selectedNomenclatureId, setSelectedNomenclatureId] = useState('');
    const [nomenclatureSearch, setNomenclatureSearch] = useState('');
    const [submitError, setSubmitError] = useState('');
    const planQuery = useGetTaskMaterialPlanQuery(taskId, {
        refetchOnMountOrArgChange: true,
    });
    const usagesQuery = useGetTaskMaterialUsagesQuery(taskId, {
        refetchOnMountOrArgChange: true,
    });
    const accountingQuery = useGetTaskMaterialAccountingQuery(taskId, {
        refetchOnMountOrArgChange: true,
    });
    const statusesQuery = useGetWorkflowStatusesQuery();
    const [updateTaskStatus, { isLoading: isSubmitting }] = useUpdateTaskStatusMutation();

    const plan = useMemo(() => planQuery.data ?? [], [planQuery.data]);
    const usages = useMemo(() => usagesQuery.data ?? [], [usagesQuery.data]);
    const accounting = accountingQuery.data;
    const statuses = useMemo(() => statusesQuery.data ?? [], [statusesQuery.data]);
    const isTerminal = statuses.some(
        (status) => status.id === nextStatusId && status.terminal
    );
    // The employee kanban already returns role-filtered allowedNextStatusIds.
    // The public transition endpoint returns only OrderStatus objects and does
    // not expose workflow material flags, so it cannot validate this modal.
    const allowUnplannedMaterials = false;
    const materialReportRequired = false;
    const nomenclatureQuery = useGetNomenclatureQuery(
        { activeOnly: true, page: 0, size: 200, sort: 'name,ASC' },
        { skip: !allowUnplannedMaterials }
    );
    const nomenclature = useMemo(
        () => nomenclatureQuery.data ?? [],
        [nomenclatureQuery.data]
    );

    const isReportLoading = planQuery.isLoading
        || usagesQuery.isLoading
        || accountingQuery.isLoading;
    const hasReportLoadError = planQuery.isError
        || usagesQuery.isError
        || accountingQuery.isError;
    const duplicateIds = rows.length !== new Set(
        rows.map((row) => row.nomenclatureId)
    ).size;
    const rowErrors = rows.map((row) => getRowError(row, t));
    const formError = duplicateIds
        ? t('duplicate')
        : rowErrors.find(Boolean) ?? '';
    const canReview = (!materialReportRequired || rows.length > 0)
        && !formError
        && (rows.length === 0 || measurementConfirmed)
        && (rows.length === 0 || (
            !accounting?.finalized
            && !isReportLoading
            && !hasReportLoadError
        ));
    const availablePlan = useMemo(() => plan.filter(
        (item) => !rows.some((row) => row.nomenclatureId === item.nomenclatureId)
    ), [plan, rows]);
    const availableNomenclature = useMemo(() => {
        const search = nomenclatureSearch.trim().toLocaleLowerCase(intlLocale);
        return nomenclature.filter((item) => (
            !rows.some((row) => row.nomenclatureId === item.id)
            && (!search || `${item.name} ${item.code}`.toLocaleLowerCase(intlLocale).includes(search))
        ));
    }, [intlLocale, nomenclature, nomenclatureSearch, rows]);

    const updateRow = (
        key: string,
        field: QuantityField | 'note',
        value: string
    ) => {
        setRows((current) => current.map((row) => (
            row.key === key ? { ...row, [field]: value } : row
        )));
        setMeasurementConfirmed(false);
        setSubmitError('');
    };

    const addPlannedMaterial = () => {
        if (
            !selectedNomenclatureId
            || rows.some((row) => row.nomenclatureId === selectedNomenclatureId)
        ) return;
        const item = plan.find(
            (candidate) => candidate.nomenclatureId === selectedNomenclatureId
        );
        if (!item) return;
        const accountingItem = accounting?.items.find(
            (candidate) => candidate.nomenclatureId === item.nomenclatureId
        );
        setRows((current) => [...current, createRow(item, accountingItem, usages)]);
        setSelectedNomenclatureId('');
        setMeasurementConfirmed(false);
    };

    const addUnplannedMaterial = () => {
        if (
            !selectedNomenclatureId
            || rows.some((row) => row.nomenclatureId === selectedNomenclatureId)
        ) return;
        const item = nomenclature.find(
            (candidate) => candidate.id === selectedNomenclatureId
        );
        if (!item) return;
        setRows((current) => [...current, {
            key: `extra-${item.id}`,
            nomenclatureId: item.id,
            nomenclatureName: item.name,
            unit: item.unit,
            plannedTaskQuantity: 0,
            plannedWasteQuantity: 0,
            remainingPlannedWasteQuantity: 0,
            alreadyConsumedQuantity: 0,
            alreadyWasteQuantity: 0,
            remainingReservedQuantity: 0,
            isPlanned: false,
            issuedQuantity: '',
            consumedQuantity: '',
            wasteQuantity: '',
            returnedQuantity: '',
            note: '',
        }]);
        setSelectedNomenclatureId('');
        setMeasurementConfirmed(false);
    };

    const removeMaterial = (key: string) => {
        setRows((current) => current.filter((row) => row.key !== key));
        setMeasurementConfirmed(false);
        setSubmitError('');
    };

    const retryLoading = () => {
        void planQuery.refetch();
        void usagesQuery.refetch();
        void accountingQuery.refetch();
        void statusesQuery.refetch();
    };

    const openReview = () => {
        if (!canReview) return;
        setSubmitError('');
        setScreen('review');
    };

    const submit = async () => {
        if (!canReview || isSubmitting) return;
        try {
            await updateTaskStatus({
                taskId,
                body: {
                    nextStatusId,
                    ...(assignedUserId ? { assignedUserId } : {}),
                    ...(comment.trim() ? { comment: comment.trim() } : {}),
                    ...(rows.length > 0 || materialReportRequired ? {
                        materialReportId,
                        materialUsages: rows.map(toUsage),
                    } : {}),
                },
                notification: { error: false },
            }).unwrap();
            onSuccess?.();
            onClose();
        } catch (error) {
            setSubmitError(getApiErrorMessage(error, 'updateTaskStatus'));
        }
    };

    return (
        <Modal contentClassName="max-w-7xl overflow-hidden p-0">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white p-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">
                        {t('badge')}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                        {t('title')}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {screen === 'form' ? t('formStep') : t('reviewStep')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
                >
                    {commonT('actions.close')}
                </button>
            </header>

            <div data-tour="material-report" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {hasReportLoadError ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                        {t('loadError')}
                        <button type="button" className="ml-2 font-black underline" onClick={retryLoading}>
                            {commonT('actions.retry')}
                        </button>
                    </div>
                ) : null}

                {accounting?.finalized ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900" role="status">
                        {t('finalized')}
                    </div>
                ) : null}

                {isTerminal ? (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <strong>{t('irreversibleTitle')}</strong>{' '}
                        {t('irreversibleHint')}
                    </div>
                ) : null}

                {submitError ? (
                    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">
                        {submitError}
                    </div>
                ) : null}

                {screen === 'form' ? (
                    <>
                        <p className="mb-4 text-sm text-slate-600">
                            {t('selectionHint')}
                        </p>

                        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:flex-row">
                            <select
                                value={selectedNomenclatureId}
                                onChange={(event) => setSelectedNomenclatureId(event.target.value)}
                                className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                            >
                                <option value="">{t('materialPlaceholder')}</option>
                                {availablePlan.map((item) => (
                                    <option key={item.nomenclatureId} value={item.nomenclatureId}>
                                        {item.nomenclatureName} · {item.unit}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={addPlannedMaterial}
                                disabled={!selectedNomenclatureId}
                                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300"
                            >
                                {t('addToReport')}
                            </button>
                        </div>

                        {allowUnplannedMaterials ? (
                            <div className="mb-4 grid gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-[minmax(180px,.8fr)_minmax(220px,1fr)_auto]">
                                <input
                                    value={nomenclatureSearch}
                                    onChange={(event) => {
                                        setNomenclatureSearch(event.target.value);
                                        setSelectedNomenclatureId('');
                                    }}
                                    placeholder={t('search')}
                                    className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
                                />
                                <select
                                    value={selectedNomenclatureId}
                                    onChange={(event) => setSelectedNomenclatureId(event.target.value)}
                                    className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                                >
                                    <option value="">{t('unplannedPlaceholder')}</option>
                                    {availableNomenclature.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} · {item.unit}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={addUnplannedMaterial}
                                    disabled={!selectedNomenclatureId || nomenclatureQuery.isLoading}
                                    className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300"
                                >
                                    {t('addMaterial')}
                                </button>
                            </div>
                        ) : null}

                        {isReportLoading ? (
                            <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                                {t('loading')}
                            </div>
                        ) : rows.length ? (
                            <div className="space-y-3">
                                {rows.map((row, index) => {
                                    const error = rowErrors[index];
                                    return (
                                        <article
                                            key={row.key}
                                            className={`rounded-2xl border p-4 ${error ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-900">
                                                        {row.nomenclatureName}
                                                    </h3>
                                                    <p className="mt-1 text-xs font-bold text-slate-500">
                                                        {t('unit', {unit: row.unit})}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeMaterial(row.key)}
                                                    className="text-xs font-bold text-red-600"
                                                >
                                                    {t('remove')}
                                                </button>
                                            </div>

                                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <QuantityInput
                                                    label={t('issued')}
                                                    unit={row.unit}
                                                    value={row.issuedQuantity}
                                                    onChange={(value) => updateRow(row.key, 'issuedQuantity', value)}
                                                    disabled={Boolean(accounting?.finalized)}
                                                />
                                                <QuantityInput
                                                    label={t('used')}
                                                    unit={row.unit}
                                                    value={row.consumedQuantity}
                                                    onChange={(value) => updateRow(row.key, 'consumedQuantity', value)}
                                                    disabled={Boolean(accounting?.finalized)}
                                                />
                                                <QuantityInput
                                                    label={t('waste')}
                                                    unit={row.unit}
                                                    value={row.wasteQuantity}
                                                    onChange={(value) => updateRow(row.key, 'wasteQuantity', value)}
                                                    disabled={Boolean(accounting?.finalized)}
                                                />
                                                <QuantityInput
                                                    label={t('returned')}
                                                    unit={row.unit}
                                                    value={row.returnedQuantity}
                                                    onChange={(value) => updateRow(row.key, 'returnedQuantity', value)}
                                                    disabled={Boolean(accounting?.finalized)}
                                                />
                                            </div>

                                            <label className="mt-3 block">
                                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                    {(parseQuantity(row.wasteQuantity) ?? 0) > 0 ? t('wasteComment') : t('comment')}
                                                </span>
                                                <input
                                                    value={row.note}
                                                    onChange={(event) => updateRow(row.key, 'note', event.target.value)}
                                                    disabled={Boolean(accounting?.finalized)}
                                                    placeholder={t('commentPlaceholder')}
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500 disabled:bg-slate-100"
                                                />
                                            </label>

                                            {error ? (
                                                <p className="mt-3 text-xs font-bold text-red-700" role="alert">
                                                    {error}
                                                </p>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className={`rounded-xl border p-4 text-sm font-bold ${
                                materialReportRequired
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}>
                                {materialReportRequired
                                    ? t('reportRequired')
                                    : t('reportOptional')}
                            </p>
                        )}

                        {formError ? (
                            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                                {formError}
                            </p>
                        ) : null}

                        {rows.length > 0 ? (
                            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                                <input
                                    type="checkbox"
                                    checked={measurementConfirmed}
                                    onChange={(event) => setMeasurementConfirmed(event.target.checked)}
                                    disabled={Boolean(accounting?.finalized)}
                                    className="mt-0.5 h-4 w-4 accent-violet-600"
                                />
                                <span className="text-sm font-bold text-slate-800">
                                    {t('confirmation')}
                                </span>
                            </label>
                        ) : null}

                        <label className="mt-4 block">
                            <span className="mb-1 block text-xs font-bold text-slate-500">
                                {t('transitionComment')}
                            </span>
                            <textarea
                                value={comment}
                                onChange={(event) => setComment(event.target.value)}
                                className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-500"
                            />
                        </label>
                    </>
                ) : (
                    <>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
                            {rows.length > 0
                                ? t('reviewFinalized')
                                : t('reviewOptional')}
                        </div>
                        {rows.length > 0 ? (
                            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-[760px] w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                                        <tr>
                                            {[t('material'), t('issued'), t('used'), t('waste'), t('returned')].map((label) => (
                                                <th key={label} className="px-3 py-3 font-black">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.key} className="border-t border-slate-100">
                                                <td className="px-3 py-3 font-black text-slate-800">
                                                    {row.nomenclatureName}
                                                </td>
                                                {QUANTITY_FIELDS.map((field) => (
                                                    <td key={field} className="px-3 py-3">
                                                        {formats.number(parseQuantity(row[field]) ?? 0, {maximumFractionDigits: 4})} {row.unit}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        <dl className="mt-4 rounded-xl bg-slate-50 p-4 text-xs">
                            <dt className="font-black uppercase tracking-wide text-slate-400">
                                {t('transitionComment')}
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap text-slate-700">
                                {comment.trim() || t('noComment')}
                            </dd>
                        </dl>
                    </>
                )}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
                {screen === 'review' ? (
                    <button
                        type="button"
                        onClick={() => setScreen('form')}
                        disabled={isSubmitting}
                        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
                    >
                        {t('backToForm')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600"
                    >
                        {commonT('actions.cancel')}
                    </button>
                )}
                {screen === 'form' ? (
                    <button
                        type="button"
                        disabled={!canReview}
                        onClick={openReview}
                        className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {t('review')}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={!canReview || isSubmitting}
                        onClick={() => void submit()}
                        className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {isSubmitting
                            ? t('sending')
                            : isTerminal
                                ? t('submitFinal')
                                : t('submit')}
                    </button>
                )}
            </footer>
        </Modal>
    );
}
