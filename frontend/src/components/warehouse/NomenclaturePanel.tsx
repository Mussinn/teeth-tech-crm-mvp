'use client';

import { type FormEvent, useMemo, useState } from 'react';
import {useTranslations} from 'next-intl';

import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import { useGetMaterialsQuery } from '@/src/services/api/laboratory/materialApi';
import { useGetWorkTypesQuery } from '@/src/services/api/laboratory/workTypesApi';
import {
    useCreateWarehouseMaterialMutation,
    useDeleteNomenclatureNormMutation,
    useGetInventoryChecksQuery,
    useGetInventoryStatusRulesQuery,
    useGetNomenclatureItemQuery,
    useGetNomenclatureQuery,
    useGetStockBalanceQuery,
    useReceiveStockMutation,
    useUpsertNomenclatureNormMutation,
} from '@/src/services/api/warehouseApi';
import { getApiErrorMessage } from './warehouseUtils';
import {useAppFormatters, useAppLocale} from '@/src/i18n/provider';
import {intlLocaleByLocale} from '@/src/i18n/config';

export default function NomenclaturePanel() {
    const t = useTranslations('warehouse.nomenclature');
    const inventoryT = useTranslations('warehouse.inventory');
    const commonT = useTranslations('common.actions');
    const formatters = useAppFormatters();
    const {locale} = useAppLocale();
    const quantityLabel = (value: number | null | undefined, unit?: string) =>
        value === null || value === undefined || !Number.isFinite(value)
            ? '—'
            : `${formatters.number(value, {maximumFractionDigits: 3})}${unit ? ` ${unit}` : ''}`;
    const inventoryStatusLabel = (statusCode: string, fallback?: string) => {
        if (statusCode === 'DRAFT') return inventoryT('statuses.DRAFT');
        if (statusCode === 'IN_PROGRESS') return inventoryT('statuses.IN_PROGRESS');
        if (statusCode === 'COMPLETED') return inventoryT('statuses.COMPLETED');
        if (statusCode === 'CANCELLED') return inventoryT('statuses.CANCELLED');
        return fallback || statusCode;
    };
    const [activeOnly, setActiveOnly] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [formError, setFormError] = useState('');
    const [createMaterialOpen, setCreateMaterialOpen] = useState(false);
    const [materialName, setMaterialName] = useState('');
    const [materialDescription, setMaterialDescription] = useState('');
    const [materialCode, setMaterialCode] = useState('');
    const [materialUnit, setMaterialUnit] = useState('');
    const [createMaterialError, setCreateMaterialError] = useState('');
    const [normWorkTypeId, setNormWorkTypeId] = useState('');
    const [normMaterialId, setNormMaterialId] = useState('');
    const [normQuantity, setNormQuantity] = useState('');
    const [normIdToDelete, setNormIdToDelete] = useState('');
    const [normError, setNormError] = useState('');
    const [isDeleteNormConfirmOpen, setIsDeleteNormConfirmOpen] = useState(false);

    const listQuery = useGetNomenclatureQuery({ activeOnly });
    const inventoryChecksQuery = useGetInventoryChecksQuery();
    const inventoryStatusRulesQuery = useGetInventoryStatusRulesQuery();
    const detailQuery = useGetNomenclatureItemQuery(selectedId ?? '', { skip: !selectedId });
    const balanceQuery = useGetStockBalanceQuery(selectedId ?? '', { skip: !selectedId });
    const {
        data: workTypes = [],
        isLoading: isWorkTypesLoading,
        isFetching: isWorkTypesFetching,
        isError: isWorkTypesError,
        refetch: refetchWorkTypes,
    } = useGetWorkTypesQuery();
    const {
        data: materials = [],
        isLoading: isMaterialsLoading,
        isFetching: isMaterialsFetching,
        isError: isMaterialsError,
        refetch: refetchMaterials,
    } = useGetMaterialsQuery();
    const [receiveStock, receiveState] = useReceiveStockMutation();
    const [createWarehouseMaterial, createMaterialState] = useCreateWarehouseMaterialMutation();
    const [upsertNomenclatureNorm, upsertNormState] = useUpsertNomenclatureNormMutation();
    const [deleteNomenclatureNorm, deleteNormState] = useDeleteNomenclatureNormMutation();

    const filteredItems = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase(intlLocaleByLocale[locale]);
        if (!needle) return listQuery.data ?? [];
        return (listQuery.data ?? []).filter((item) =>
            `${item.code} ${item.name}`.toLocaleLowerCase(intlLocaleByLocale[locale]).includes(needle)
        );
    }, [listQuery.data, locale, search]);

    const selectedFromList = listQuery.data?.find((item) => item.id === selectedId);
    const selectedItem = detailQuery.data ?? selectedFromList;
    const inventoryStatusRulesByCode = useMemo(
        () => new Map((inventoryStatusRulesQuery.data ?? []).map((rule) => [rule.code, rule])),
        [inventoryStatusRulesQuery.data]
    );
    const lockingInventoryCheck = inventoryChecksQuery.data?.find(
        (item) => inventoryStatusRulesByCode.get(item.statusCode)?.locksWarehouse
            ?? (item.statusCode === 'IN_PROGRESS' || (Boolean(item.startedAt) && !item.completedAt))
    );
    const hasInventoryControlError = inventoryChecksQuery.isError
        || inventoryStatusRulesQuery.isError;
    const inventoryLockMessage = lockingInventoryCheck
        ? t('inventoryLock', {status: inventoryStatusLabel(lockingInventoryCheck.statusCode, inventoryStatusRulesByCode.get(lockingInventoryCheck.statusCode)?.name)})
        : '';

    const openItem = (id: string) => {
        setSelectedId(id);
        setQuantity('');
        setReason('');
        setFormError('');
        setNormWorkTypeId('');
        setNormMaterialId('');
        setNormQuantity('');
        setNormIdToDelete('');
        setNormError('');
    };

    const closeItem = () => {
        if (receiveState.isLoading) return;
        setSelectedId(null);
    };

    const resetMaterialForm = () => {
        setMaterialName('');
        setMaterialDescription('');
        setMaterialCode('');
        setMaterialUnit('');
        setCreateMaterialError('');
    };

    const closeCreateMaterial = () => {
        if (createMaterialState.isLoading) return;
        setCreateMaterialOpen(false);
        resetMaterialForm();
    };

    const handleCreateMaterial = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCreateMaterialError('');

        const name = materialName.trim();
        const description = materialDescription.trim();
        const nomenclatureCode = materialCode.trim();
        const unit = materialUnit.trim();

        if (!name || !nomenclatureCode || !unit) {
            setCreateMaterialError(t('validation.materialRequired'));
            return;
        }

        try {
            await createWarehouseMaterial({
                name,
                description,
                nomenclatureCode,
                unit,
            }).unwrap();
            setCreateMaterialOpen(false);
            resetMaterialForm();
            setSearch('');
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const handleReceive = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedId) return;
        setFormError('');

        if (inventoryLockMessage) {
            setFormError(inventoryLockMessage);
            return;
        }

        const parsedQuantity = Number(quantity);
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            setFormError(t('validation.positiveQuantity'));
            return;
        }
        if (!reason.trim()) {
            setFormError(t('validation.receiptReason'));
            return;
        }

        try {
            await receiveStock({
                nomenclatureId: selectedId,
                body: { quantity: parsedQuantity, reason: reason.trim() },
            }).unwrap();
            setQuantity('');
            setReason('');
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const handleUpsertNorm = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedId) return;

        setNormError('');

        const parsedQuantity = Number(normQuantity);

        if (!normWorkTypeId || !normMaterialId) {
            setNormError(t('validation.normReferences'));
            return;
        }

        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            setNormError(t('validation.positiveNorm'));
            return;
        }

        try {
            await upsertNomenclatureNorm({
                workTypeId: normWorkTypeId,
                materialId: normMaterialId,
                nomenclatureId: selectedId,
                normQuantity: parsedQuantity,
            }).unwrap();
            setNormQuantity('');
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const handleDeleteNorm = async () => {
        const normId = normIdToDelete.trim();

        if (!normId) {
            setNormError(t('validation.normId'));
            return;
        }

        setNormError('');

        try {
            await deleteNomenclatureNorm(normId).unwrap();
            setNormIdToDelete('');
            setIsDeleteNormConfirmOpen(false);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900">{t('title')}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            {t('subtitle')}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="relative block">
                            <span className="sr-only">{t('searchAria')}</span>
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
                                <path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                            </svg>
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('search')}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:w-64"
                            />
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
                            <input
                                type="checkbox"
                                checked={activeOnly}
                                onChange={(event) => setActiveOnly(event.target.checked)}
                                className="h-4 w-4 accent-violet-600"
                            />
                            {t('activeOnly')}
                        </label>

                        <button
                            type="button"
                            onClick={() => {
                                setCreateMaterialOpen(true);
                                setCreateMaterialError('');
                            }}
                            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition hover:bg-violet-700"
                        >
                            {t('addMaterial')}
                        </button>
                    </div>
                </div>

                {listQuery.isError && (
                    <QueryErrorNotice
                        className="m-4"
                        message={getApiErrorMessage(listQuery.error, t('loadError'))}
                        onRetry={() => void listQuery.refetch()}
                        isRetrying={listQuery.isFetching}
                    />
                )}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-3 font-bold">{t('columns.code')}</th>
                                <th className="px-5 py-3 font-bold">{t('columns.name')}</th>
                                <th className="px-5 py-3 font-bold">{t('columns.balance')}</th>
                                <th className="px-5 py-3 font-bold">{t('columns.minimum')}</th>
                                <th className="px-5 py-3 font-bold">{t('columns.state')}</th>
                                <th className="px-5 py-3 text-right font-bold">{t('columns.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.map((item) => {
                                const low = item.currentStock <= item.minStockLevel;
                                return (
                                    <tr key={item.id} className="transition hover:bg-violet-50/50">
                                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-500">{item.code}</td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                            <p className="mt-0.5 text-xs text-slate-400">{t('unit', {unit: item.unit})}</p>
                                        </td>
                                        <td className={`px-5 py-4 text-sm font-black ${low ? 'text-red-600' : 'text-slate-800'}`}>
                                            {quantityLabel(item.currentStock, item.unit)}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-500">
                                            {quantityLabel(item.minStockLevel, item.unit)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {item.active ? t('active') : t('inactive')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openItem(item.id)}
                                            className="rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                                            >
                                                {t('openReceipt')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {listQuery.isLoading && (
                    <div className="px-5 py-12 text-center text-sm text-slate-500">{t('loading')}</div>
                )}
                {!listQuery.isLoading && filteredItems.length === 0 && (
                    <div className="px-5 py-12 text-center text-sm text-slate-500">
                        {t('empty')}
                    </div>
                )}
            </section>

            {createMaterialOpen && (
                <Modal contentClassName="max-w-2xl p-0">
                    <form onSubmit={handleCreateMaterial}>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{t('create.badge')}</p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900">{t('create.title')}</h2>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {t('create.hint')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCreateMaterial}
                                disabled={createMaterialState.isLoading}
                                aria-label={commonT('close')}
                                className="text-2xl leading-none text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-4 p-5 sm:p-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('create.name')}</span>
                                    <input
                                        required
                                        value={materialName}
                                        onChange={(event) => setMaterialName(event.target.value)}
                                        placeholder={t('create.namePlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                                    />
                                </label>

                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('create.code')}</span>
                                    <input
                                        required
                                        value={materialCode}
                                        onChange={(event) => setMaterialCode(event.target.value)}
                                        placeholder={t('create.codePlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('create.description')}</span>
                                    <input
                                        value={materialDescription}
                                        onChange={(event) => setMaterialDescription(event.target.value)}
                                        placeholder={t('create.descriptionPlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                                    />
                                </label>

                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('create.unit')}</span>
                                    <input
                                        required
                                        value={materialUnit}
                                        onChange={(event) => setMaterialUnit(event.target.value)}
                                        placeholder={t('create.unitPlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                                    />
                                </label>
                            </div>

                            {createMaterialError && (
                                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {createMaterialError}
                                </p>
                            )}

                            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeCreateMaterial}
                                    disabled={createMaterialState.isLoading}
                                    className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                    {commonT('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMaterialState.isLoading}
                                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                >
                                    {createMaterialState.isLoading ? t('create.creating') : t('create.submit')}
                                </button>
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {selectedId && (
                <Modal contentClassName="max-w-2xl p-0">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{t('detail.badge')}</p>
                            <h2 className="mt-1 text-lg font-bold text-slate-900">
                                {selectedItem?.name ?? t('detail.loading')}
                            </h2>
                            {selectedItem && (
                                <p className="mt-1 font-mono text-xs text-slate-400">{selectedItem.code}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={closeItem}
                            aria-label={commonT('close')}
                            className="text-2xl leading-none text-slate-400 transition hover:text-slate-700"
                        >
                            &times;
                        </button>
                    </div>

                    <div className="space-y-5 p-5 sm:p-6">
                        {detailQuery.isError && (
                            <QueryErrorNotice
                                message={getApiErrorMessage(detailQuery.error, t('detail.notFound'))}
                                onRetry={() => void detailQuery.refetch()}
                                isRetrying={detailQuery.isFetching}
                            />
                        )}

                        {balanceQuery.isError && (
                            <QueryErrorNotice
                                message={t('detail.balanceError')}
                                onRetry={() => void balanceQuery.refetch()}
                                isRetrying={balanceQuery.isFetching}
                            />
                        )}

                        {hasInventoryControlError && (
                            <QueryErrorNotice
                                message={t('detail.inventoryError')}
                                onRetry={() => {
                                    if (inventoryChecksQuery.isError) void inventoryChecksQuery.refetch();
                                    if (inventoryStatusRulesQuery.isError) void inventoryStatusRulesQuery.refetch();
                                }}
                                isRetrying={inventoryChecksQuery.isFetching || inventoryStatusRulesQuery.isFetching}
                            />
                        )}

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">{t('detail.balance')}</p>
                                <p className="mt-1 text-xl font-black text-slate-900">
                                    {balanceQuery.isFetching
                                        ? '…'
                                        : quantityLabel(balanceQuery.data ?? selectedItem?.currentStock, selectedItem?.unit)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">{t('detail.minimum')}</p>
                                <p className="mt-1 text-xl font-black text-slate-900">
                                    {quantityLabel(selectedItem?.minStockLevel, selectedItem?.unit)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">{t('detail.status')}</p>
                                <p className={`mt-1 text-sm font-bold ${selectedItem?.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                                    {selectedItem?.active ? t('active') : t('inactive')}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleReceive} className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
                            <div>
                                <h3 className="font-bold text-slate-900">{t('receipt.title')}</h3>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    {t('receipt.warning')}
                                </p>
                            </div>

                            {inventoryLockMessage && (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                                    {inventoryLockMessage}
                                </p>
                            )}

                            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('receipt.quantity')}</span>
                                    <div className="relative">
                                        <input
                                            required
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            value={quantity}
                                            onChange={(event) => setQuantity(event.target.value)}
                                            disabled={Boolean(inventoryLockMessage) || hasInventoryControlError}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                            {selectedItem?.unit}
                                        </span>
                                    </div>
                                </label>
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('receipt.reason')}</span>
                                    <input
                                        required
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder={t('receipt.reasonPlaceholder')}
                                        disabled={Boolean(inventoryLockMessage) || hasInventoryControlError}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                </label>
                            </div>

                            {formError && (
                                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{formError}</p>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={receiveState.isLoading || !selectedItem?.active || Boolean(inventoryLockMessage) || hasInventoryControlError}
                                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                >
                                    {receiveState.isLoading ? t('receipt.processing') : t('receipt.submit')}
                                </button>
                            </div>
                        </form>

                        <form onSubmit={handleUpsertNorm} className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                            <div>
                                <h3 className="font-bold text-slate-900">{t('norm.title')}</h3>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    {t('norm.hint')}
                                </p>
                            </div>

                            {(isWorkTypesError || isMaterialsError) && (
                                <QueryErrorNotice
                                    message={t('norm.referencesError')}
                                    onRetry={() => {
                                        if (isWorkTypesError) void refetchWorkTypes();
                                        if (isMaterialsError) void refetchMaterials();
                                    }}
                                    isRetrying={isWorkTypesFetching || isMaterialsFetching}
                                />
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('norm.workType')}</span>
                                    <select
                                        required
                                        value={normWorkTypeId}
                                        onChange={(event) => setNormWorkTypeId(event.target.value)}
                                        disabled={isWorkTypesLoading || isWorkTypesError}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    >
                                        <option value="">{t('norm.workTypePlaceholder')}</option>
                                        {workTypes.map((workType) => (
                                            <option key={workType.id} value={workType.id}>
                                                {workType.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('norm.material')}</span>
                                    <select
                                        required
                                        value={normMaterialId}
                                        onChange={(event) => setNormMaterialId(event.target.value)}
                                        disabled={isMaterialsLoading || isMaterialsError}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    >
                                        <option value="">{t('norm.materialPlaceholder')}</option>
                                        {materials.map((material) => (
                                            <option key={material.id} value={material.id}>
                                                {material.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <label>
                                <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('norm.quantity')}</span>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        value={normQuantity}
                                        onChange={(event) => setNormQuantity(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 text-sm outline-none focus:border-emerald-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {selectedItem?.unit}
                                    </span>
                                </div>
                            </label>

                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <label>
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('norm.id')}</span>
                                    <input
                                        value={normIdToDelete}
                                        onChange={(event) => setNormIdToDelete(event.target.value)}
                                        placeholder={t('norm.idPlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm outline-none focus:border-red-500"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!normIdToDelete.trim()) {
                                            setNormError(t('validation.normId'));
                                            return;
                                        }
                                        setIsDeleteNormConfirmOpen(true);
                                    }}
                                    disabled={deleteNormState.isLoading}
                                    className="mt-3 rounded-xl border border-red-500 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                                >
                                    {deleteNormState.isLoading ? t('norm.deleting') : t('norm.delete')}
                                </button>
                            </div>

                            {normError && (
                                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{normError}</p>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={upsertNormState.isLoading || isWorkTypesError || isMaterialsError}
                                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                >
                                    {upsertNormState.isLoading ? t('norm.saving') : t('norm.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
            <ConfirmDialog
                open={isDeleteNormConfirmOpen}
                title={t('norm.deleteTitle')}
                description={t('norm.deleteDescription', {id: normIdToDelete})}
                confirmLabel={t('norm.delete')}
                isLoading={deleteNormState.isLoading}
                onClose={() => setIsDeleteNormConfirmOpen(false)}
                onConfirm={handleDeleteNorm}
            />
        </div>
    );
}
