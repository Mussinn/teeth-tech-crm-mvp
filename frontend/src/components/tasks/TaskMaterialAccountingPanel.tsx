'use client';

import { useMemo, useState } from 'react';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

import MaterialChips from '@/src/components/tasks/MaterialChips';
import { getApiErrorMessage } from '@/src/services/apiNotifications';
import {
    useGetTaskMaterialAccountingQuery,
    useGetTaskMaterialUsagesQuery,
    useUpdateTaskMaterialsMutation,
} from '@/src/services/api/ordersApi';
import { useGetMaterialsQuery } from '@/src/services/api/laboratory/materialApi';
import type { MaterialUsageHistoryItem } from '@/src/types/task.types';
import { normalizeMaterialIds, validateMaterialIds } from '@/src/utils/materialAccounting';

function groupUsages(items: MaterialUsageHistoryItem[]) {
    const groups = new Map<string, MaterialUsageHistoryItem[]>();
    for (const item of items) {
        groups.set(item.materialReportId, [...(groups.get(item.materialReportId) ?? []), item]);
    }
    return Array.from(groups.entries());
}

export default function TaskMaterialAccountingPanel({
    taskId,
    materialIds,
    materialNames,
}: {
    taskId: string;
    materialIds: string[];
    materialNames: string[];
}) {
    const t = useTranslations('tasks.materialAccounting');
    const commonT = useTranslations('common.actions');
    const formatters = useAppFormatters();
    const quantity = (value: number, unit: string) => `${formatters.number(value, {maximumFractionDigits: 4})} ${unit}`;
    const accountingQuery = useGetTaskMaterialAccountingQuery(taskId, { refetchOnMountOrArgChange: true });
    const usagesQuery = useGetTaskMaterialUsagesQuery(taskId, { refetchOnMountOrArgChange: true });
    const { data: accounting, isLoading: isAccountingLoading } = accountingQuery;
    const { data: usages = [], isLoading: isUsagesLoading } = usagesQuery;
    const { data: materials = [] } = useGetMaterialsQuery();
    const [updateTaskMaterials, { isLoading: isSavingMaterials }] = useUpdateTaskMaterialsMutation();
    const [isEditing, setIsEditing] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => normalizeMaterialIds(materialIds));
    const [saveError, setSaveError] = useState('');
    const materialError = validateMaterialIds(selectedIds);
    const usageGroups = useMemo(() => groupUsages(usages), [usages]);
    const materialsLocked = Boolean(accounting?.finalized || usages.length > 0);

    const saveMaterials = async () => {
        if (materialError) return;
        setSaveError('');
        try {
            await updateTaskMaterials({ taskId, materialIds: normalizeMaterialIds(selectedIds) }).unwrap();
            setIsEditing(false);
        } catch (error) {
            setSaveError(getApiErrorMessage(error, 'updateTaskMaterials'));
        }
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{t('title')}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                        {accounting?.finalized ? t('finalized', {date: accounting.finalizedAt ? formatters.dateTime(accounting.finalizedAt) : '—'}) : t('preliminary')}
                    </p>
                </div>
                {!materialsLocked && !isAccountingLoading && !isUsagesLoading ? (
                    <button type="button" onClick={() => { if (isEditing) setSelectedIds(normalizeMaterialIds(materialIds)); setIsEditing((value) => !value); }} className="rounded-lg border border-violet-200 px-3 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-50">
                        {isEditing ? commonT('cancel') : t('edit')}
                    </button>
                ) : null}
            </div>

            <div className="mt-3">
                <MaterialChips materialNames={materialNames} />
            </div>

            {materialsLocked ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                    {accounting?.finalized
                        ? t('finalizedHint')
                        : t('startedHint')}
                </p>
            ) : null}

            {accountingQuery.isError || usagesQuery.isError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800" role="alert">
                    {t('loadError')}
                    <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() => {
                            void accountingQuery.refetch();
                            void usagesQuery.refetch();
                        }}
                    >
                        {commonT('retry')}
                    </button>
                </div>
            ) : null}

            {isEditing ? (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('newSet')}</p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {materials.filter((material) => material.isActive).map((material) => {
                            const selected = selectedIds.includes(material.id);
                            return (
                                <label key={material.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
                                    <input type="checkbox" checked={selected} onChange={() => setSelectedIds((ids) => selected ? ids.filter((id) => id !== material.id) : normalizeMaterialIds([...ids, material.id]))} className="accent-violet-600" />
                                    {material.name}
                                </label>
                            );
                        })}
                    </div>
                    {materialError ? <p className="mt-2 text-xs font-semibold text-red-600">{t(materialError === 'required' ? 'materialRequired' : 'materialDuplicate')}</p> : null}
                    {saveError ? <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{saveError}</p> : null}
                    <button type="button" disabled={Boolean(materialError) || isSavingMaterials} onClick={() => void saveMaterials()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300">
                        {isSavingMaterials ? t('saving') : t('saveSet')}
                    </button>
                </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{t('planFact')}</h4>
                {isAccountingLoading ? <p className="py-4 text-center text-xs text-slate-400">{t('loadingPlanFact')}</p> : accounting?.items.length ? (
                    <table className="min-w-[1120px] w-full text-left text-[10px]">
                        <thead className="text-slate-400"><tr>{[t('columns.material'), t('columns.norm'), t('columns.plannedWaste'), t('columns.plannedTotal'), t('columns.issued'), t('columns.used'), t('columns.actualWaste'), t('columns.returned'), t('columns.writeOff'), t('columns.variance'), t('columns.cost')].map((label) => <th key={label} className="border-b border-slate-200 px-2 py-2 font-black uppercase">{label}</th>)}</tr></thead>
                        <tbody>{accounting.items.map((item) => (
                            <tr key={item.nomenclatureId} className="border-b border-slate-100 text-slate-700">
                                <td className="px-2 py-2 font-bold">{item.nomenclatureName}<span className="ml-1 text-slate-400">({item.unit})</span></td>
                                {[item.plannedStandardQuantity, item.plannedWasteQuantity, item.plannedTotalQuantity, item.issuedQuantity, item.actualConsumedQuantity, item.actualWasteQuantity, item.returnedQuantity, item.actualWriteOffQuantity].map((value, index) => <td key={index} className="px-2 py-2">{quantity(value, item.unit)}</td>)}
                                <td className={`px-2 py-2 font-black ${item.varianceQuantity > 0 ? 'text-red-600' : item.varianceQuantity < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{quantity(item.varianceQuantity, item.unit)}{item.varianceQuantity > 0 ? ` · ${t('overrun')}` : item.varianceQuantity < 0 ? ` · ${t('savingValue')}` : ''}</td>
                                <td className="px-2 py-2 font-bold">{accounting.finalized ? formatters.currency(item.finalizedCost) : t('afterFinalization')}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                ) : <p className="py-4 text-center text-xs text-slate-400">{t('planFactEmpty')}</p>}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('usageHistory')}</h4>
                {isUsagesLoading ? <p className="mt-3 text-xs text-slate-400">{t('loadingHistory')}</p> : usageGroups.length ? (
                    <div className="mt-3 space-y-3">{usageGroups.map(([reportId, rows]) => {
                        const first = rows[0];
                        return (
                            <article key={reportId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-slate-800">{first.previousStatusName} → {first.nextStatusName}</p><p className="mt-0.5 text-[10px] text-slate-400">{formatters.dateTime(first.createdAt)} · {first.employeeName}</p></div><code className="text-[9px] text-slate-400">{reportId.slice(0, 8)}</code></div>
                                <div className="mt-2 space-y-1">{rows.map((row, index) => <div key={row.id ?? `${row.nomenclatureId}-${index}`} className="grid gap-1 rounded-lg bg-white px-2.5 py-2 text-[10px] text-slate-600 sm:grid-cols-[minmax(120px,1fr)_repeat(4,auto)]"><strong className="text-slate-800">{row.nomenclatureName}</strong><span>{t('usage.issued', {quantity: quantity(row.issuedQuantity, row.unit)})}</span><span>{t('usage.used', {quantity: quantity(row.consumedQuantity, row.unit)})}</span><span>{t('usage.waste', {quantity: quantity(row.wasteQuantity, row.unit)})}</span><span>{t('usage.returned', {quantity: quantity(row.returnedQuantity, row.unit)})}</span>{row.note ? <p className="sm:col-span-5 text-slate-400">{row.note}</p> : null}</div>)}</div>
                            </article>
                        );
                    })}</div>
                ) : <p className="mt-3 text-xs text-slate-400">{t('usageEmpty')}</p>}
            </div>
        </section>
    );
}
