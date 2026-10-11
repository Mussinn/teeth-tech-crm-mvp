'use client';

import {type FormEvent, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import Modal from '@/src/components/ui/Modal';
import PhoneInput from '@/src/components/ui/PhoneInput';
import {
    useCreateProcurementOrderMutation,
    useCreateProcurementSupplierMutation,
    useGetNomenclatureQuery,
    useGetProcurementOrdersQuery,
    useGetProcurementSuppliersQuery,
    useReceiveProcurementOrderMutation,
    useSubmitProcurementOrderMutation,
    useUpdateProcurementSupplierMutation,
} from '@/src/services/api/warehouseApi';
import type {
    NomenclatureItem,
    ProcurementOrder,
    ProcurementOrderItem,
    ProcurementSupplier,
} from '@/src/types/warehouse.types';
import {getApiErrorMessage, shortId} from './warehouseUtils';
import {useAppFormatters, useAppLocale} from '@/src/i18n/provider';
import {intlLocaleByLocale} from '@/src/i18n/config';
import {createClientId} from '@/src/utils/clientId';

type ProcurementView = 'orders' | 'suppliers';

type OrderItemDraft = {
    key: string;
    nomenclatureId: string;
    quantity: string;
    unitPrice: string;
};

type ReceiptItemDraft = {
    quantity: string;
    lotNumber: string;
    expiresAt: string;
};

const PAGE_SIZE = 20;
const fieldClassName = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100';

function normalizeOrderStatus(status: string) {
    return status.trim().toUpperCase();
}

function getOrderStatusKey(status: string) {
    const normalized = normalizeOrderStatus(status);
    if (normalized === 'PARTIAL_RECEIPT') return 'statuses.PARTIALLY_RECEIVED' as const;
    if (normalized === 'CANCELED') return 'statuses.CANCELLED' as const;
    if (normalized === 'DRAFT') return 'statuses.DRAFT' as const;
    if (normalized === 'NEW') return 'statuses.NEW' as const;
    if (normalized === 'CREATED') return 'statuses.CREATED' as const;
    if (normalized === 'SUBMITTED') return 'statuses.SUBMITTED' as const;
    if (normalized === 'IN_PROGRESS') return 'statuses.IN_PROGRESS' as const;
    if (normalized === 'PARTIALLY_RECEIVED') return 'statuses.PARTIALLY_RECEIVED' as const;
    if (normalized === 'RECEIVED') return 'statuses.RECEIVED' as const;
    if (normalized === 'COMPLETED') return 'statuses.COMPLETED' as const;
    if (normalized === 'CANCELLED') return 'statuses.CANCELLED' as const;
    return null;
}

function getOrderStatusClasses(status: string) {
    const normalized = normalizeOrderStatus(status);
    if (['RECEIVED', 'COMPLETED'].includes(normalized)) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (['CANCELLED', 'CANCELED'].includes(normalized)) {
        return 'border-red-200 bg-red-50 text-red-700';
    }
    if (['PARTIALLY_RECEIVED', 'PARTIAL_RECEIPT'].includes(normalized)) {
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }
    if (['SUBMITTED', 'IN_PROGRESS'].includes(normalized)) {
        return 'border-blue-200 bg-blue-50 text-blue-700';
    }
    return 'border-slate-200 bg-slate-100 text-slate-700';
}

function isDraftOrder(order: ProcurementOrder) {
    return ['DRAFT', 'NEW', 'CREATED'].includes(normalizeOrderStatus(order.status));
}

function isTerminalOrder(order: ProcurementOrder) {
    return ['RECEIVED', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(
        normalizeOrderStatus(order.status)
    );
}

function getRemainingQuantity(item: ProcurementOrderItem) {
    return Math.max(0, item.orderedQuantity - item.receivedQuantity);
}

function useProcurementFormatters() {
    const formatters = useAppFormatters();
    return {
        money: (value: number | null | undefined) =>
            value === null || value === undefined || !Number.isFinite(value)
                ? '—'
                : formatters.currency(value, {maximumFractionDigits: 2}),
        quantity: (value: number | null | undefined, unit?: string) =>
            value === null || value === undefined || !Number.isFinite(value)
                ? '—'
                : `${formatters.number(value, {maximumFractionDigits: 3})}${unit ? ` ${unit}` : ''}`,
        dateTime: (value: string | null | undefined) => value ? formatters.dateTime(value) : '—',
    };
}

function getDefaultExpectedAt() {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function CreateOrderModal({
                              suppliers,
                              nomenclature,
                              onClose,
                              onCreated,
                          }: {
    suppliers: ProcurementSupplier[];
    nomenclature: NomenclatureItem[];
    onClose: () => void;
    onCreated: (order: ProcurementOrder) => void;
}) {
    const t = useTranslations('warehouse.procurement');
    const commonT = useTranslations('common.actions');
    const {money} = useProcurementFormatters();
    const [supplierId, setSupplierId] = useState('');
    const [expectedAt, setExpectedAt] = useState(getDefaultExpectedAt);
    const [items, setItems] = useState<OrderItemDraft[]>([
        {key: 'item-0', nomenclatureId: '', quantity: '', unitPrice: '0'},
    ]);
    const [nextItemKey, setNextItemKey] = useState(1);
    const [error, setError] = useState('');
    const [createOrder, createState] = useCreateProcurementOrderMutation();

    const estimatedTotal = items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return sum + (Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0);
    }, 0);

    const updateItem = (key: string, field: keyof Omit<OrderItemDraft, 'key'>, value: string) => {
        setItems((current) => current.map((item) => item.key === key ? {...item, [field]: value} : item));
    };

    const addItem = () => {
        setItems((current) => [
            ...current,
            {key: `item-${nextItemKey}`, nomenclatureId: '', quantity: '', unitPrice: '0'},
        ]);
        setNextItemKey((current) => current + 1);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');

        if (!supplierId || !expectedAt) {
            setError(t('validation.supplierAndDate'));
            return;
        }

        const parsedItems = items.map((item) => ({
            nomenclatureId: item.nomenclatureId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
        }));

        if (parsedItems.some((item) => !item.nomenclatureId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
            setError(t('validation.itemRequired'));
            return;
        }
        if (parsedItems.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
            setError(t('validation.invalidPrice'));
            return;
        }
        if (new Set(parsedItems.map((item) => item.nomenclatureId)).size !== parsedItems.length) {
            setError(t('validation.duplicateItem'));
            return;
        }

        const expectedDate = new Date(expectedAt);
        if (Number.isNaN(expectedDate.getTime())) {
            setError(t('validation.invalidDate'));
            return;
        }

        try {
            const created = await createOrder({
                supplierId,
                expectedAt: expectedDate.toISOString(),
                items: parsedItems,
            }).unwrap();
            onCreated(created);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    return (
        <Modal contentClassName="max-w-5xl p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                    <h2 className="text-lg font-black text-slate-900">{t('create.title')}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t('create.hint')}</p>
                </div>
                <button type="button" onClick={onClose} disabled={createState.isLoading}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕
                </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
                <div className="space-y-5 p-5 sm:p-6">
                    {error && <div
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                            <span>{t('create.supplier')}</span>
                            <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}
                                    className={fieldClassName}>
                                <option value="">{t('create.supplierPlaceholder')}</option>
                                {suppliers.filter((supplier) => supplier.active).map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                            <span>{t('create.expected')}</span>
                            <input required type="datetime-local" value={expectedAt}
                                   onChange={(event) => setExpectedAt(event.target.value)} className={fieldClassName}/>
                        </label>
                    </div>

                    <section className="overflow-hidden rounded-2xl border border-slate-200">
                        <div
                            className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900">{t('create.items')}</h3>
                                <p className="mt-0.5 text-xs text-slate-500">{t('create.fractional')}</p>
                            </div>
                            <button type="button" onClick={addItem}
                                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50">+
                                {t('create.add')}
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {items.map((item, index) => (
                                <div key={item.key}
                                     className="grid gap-3 p-4 md:grid-cols-[minmax(260px,1fr)_150px_170px_40px] md:items-end">
                                    <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                        <span>{t('create.item', {number: index + 1})}</span>
                                        <select required value={item.nomenclatureId}
                                                onChange={(event) => updateItem(item.key, 'nomenclatureId', event.target.value)}
                                                className={fieldClassName}>
                                            <option value="">{t('create.itemPlaceholder')}</option>
                                            {nomenclature.map((position) => (
                                                <option key={position.id}
                                                        value={position.id}>{position.code} · {position.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                        <span>{t('create.quantity')}</span>
                                        <input required type="number" min="0.0001" step="0.0001" value={item.quantity}
                                               onChange={(event) => updateItem(item.key, 'quantity', event.target.value)}
                                               className={fieldClassName}/>
                                    </label>
                                    <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                        <span>{t('create.unitPrice')}</span>
                                        <input required type="number" min="0" step="0.01" value={item.unitPrice}
                                               onChange={(event) => updateItem(item.key, 'unitPrice', event.target.value)}
                                               className={fieldClassName}/>
                                    </label>
                                    <button type="button" aria-label={t('create.removeItem')} disabled={items.length === 1}
                                            onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))}
                                            className="h-10 rounded-xl text-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div
                    className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-sm text-slate-500">{t('create.estimated', {amount: money(estimatedTotal)})}</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} disabled={createState.isLoading}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{commonT('cancel')}
                        </button>
                        <button type="submit" disabled={createState.isLoading}
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">{createState.isLoading ? t('create.creating') : t('create.submit')}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function SupplierModal({
                           supplier,
                           onClose,
                           onSaved,
                       }: {
    supplier?: ProcurementSupplier;
    onClose: () => void;
    onSaved: (supplier: ProcurementSupplier) => void;
}) {
    const t = useTranslations('warehouse.procurement');
    const commonT = useTranslations('common.actions');

    const [name, setName] = useState(supplier?.name ?? '');
    const [bin, setBin] = useState(supplier?.bin ?? '');
    const [phone, setPhone] = useState(supplier?.phone ?? '');
    const [email, setEmail] = useState(supplier?.email ?? '');
    const [active, setActive] = useState(supplier?.active ?? true);
    const [error, setError] = useState('');

    const [createSupplier, createState] =
        useCreateProcurementSupplierMutation();

    const [updateSupplier, updateState] =
        useUpdateProcurementSupplierMutation();

    const isSaving =
        createState.isLoading ||
        updateState.isLoading;

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setError('');

        const normalizedBin = bin.replace(/\D/g, '');

        if (!name.trim()) {
            setError(t('validation.supplierName'));
            return;
        }

        if (normalizedBin.length !== 12) {
            setError(t('validation.invalidBin'));
            return;
        }

        const body = {
            name: name.trim(),
            bin: normalizedBin,
            phone: phone.trim(),
            email: email.trim(),
            active,
        };

        try {
            const saved = supplier
                ? await updateSupplier({
                    id: supplier.id,
                    body,
                }).unwrap()
                : await createSupplier(body).unwrap();

            onSaved(saved);
        } catch (requestError) {
            console.error(
                'Supplier request failed:',
                requestError,
            );

            setError(
                getApiErrorMessage(
                    requestError,
                    supplier
                        ? t('supplier.updateError')
                        : t('supplier.createError'),
                ),
            );
        }
    };

    return (
        <Modal>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-slate-900">{supplier ? t('supplier.editTitle') : t('supplier.newTitle')}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t('supplier.hint')}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                    ✕
                </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && <div
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <label className="block space-y-1.5 text-sm font-bold text-slate-700">
                    <span>{t('supplier.name')}</span>
                    <input required value={name} onChange={(event) => setName(event.target.value)}
                           placeholder={t('supplier.namePlaceholder')} className={fieldClassName}/>
                </label>
                <label className="block space-y-1.5 text-sm font-bold text-slate-700">
                    <span>{t('supplier.bin')}</span>
                    <input required value={bin} onChange={(event) => setBin(event.target.value)} placeholder={t('supplier.binPlaceholder')}
                           inputMode="numeric" className={fieldClassName}/>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-bold text-slate-700">
                        <span>{t('supplier.phone')}</span>
                        <PhoneInput value={phone} onValueChange={setPhone} className={fieldClassName}/>
                    </label>
                    <label className="block space-y-1.5 text-sm font-bold text-slate-700">
                        <span>Email</span>
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                               placeholder="orders@example.kz" className={fieldClassName}/>
                    </label>
                </div>
                <label
                    className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)}
                           className="h-4 w-4 accent-blue-600"/>
                    {t('supplier.active')}
                </label>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {commonT('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSaving ? t('supplier.saving') : commonT('save')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function ReceiptModal({
                          order,
                          onClose,
                          onReceived,
                      }: {
    order: ProcurementOrder;
    onClose: () => void;
    onReceived: (order: ProcurementOrder) => void;
}) {
    const t = useTranslations('warehouse.procurement');
    const commonT = useTranslations('common.actions');
    const {quantity} = useProcurementFormatters();
    const [items, setItems] = useState<Record<string, ReceiptItemDraft>>(() =>
        Object.fromEntries(order.items.map((item) => [
            item.id,
            {quantity: '', lotNumber: '', expiresAt: ''},
        ]))
    );
    const [error, setError] = useState('');
    const [receiptId] = useState(() => createClientId('receipt'));
    const [receiveOrder, receiveState] = useReceiveProcurementOrderMutation();

    const updateItem = (itemId: string, field: keyof ReceiptItemDraft, value: string) => {
        setItems((current) => ({
            ...current,
            [itemId]: {...current[itemId], [field]: value},
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');

        const selectedItems = order.items.flatMap((orderItem) => {
            const draft = items[orderItem.id];
            const quantity = Number(draft.quantity);
            if (!draft.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) return [];
            return [{
                itemId: orderItem.id,
                quantity,
                lotNumber: draft.lotNumber.trim(),
                expiresAt: draft.expiresAt,
                remaining: getRemainingQuantity(orderItem),
            }];
        });

        if (selectedItems.length === 0) {
            setError(t('validation.receiptItem'));
            return;
        }
        if (selectedItems.some((item) => item.quantity > item.remaining)) {
            setError(t('validation.receiptOverflow'));
            return;
        }
        if (selectedItems.some((item) => !item.lotNumber || !item.expiresAt)) {
            setError(t('validation.receiptDetails'));
            return;
        }

        try {
            const received = await receiveOrder({
                id: order.id,
                body: {
                    receiptId,
                    items: selectedItems.map(({itemId, quantity, lotNumber, expiresAt}) => ({
                        itemId,
                        quantity,
                        lotNumber,
                        expiresAt,
                    })),
                },
            }).unwrap();
            onReceived(received);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    return (
        <Modal contentClassName="max-w-5xl p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                    <h2 className="text-lg font-black text-slate-900">{t('receipt.title', {number: order.number || `#${shortId(order.id)}`})}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t('receipt.hint')}</p>
                </div>
                <button type="button" onClick={onClose} disabled={receiveState.isLoading}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕
                </button>
            </div>
            <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
                <div className="space-y-4 p-5 sm:p-6">
                    {error && <div
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                    <div className="space-y-3">
                        {order.items.map((item) => {
                            const remaining = getRemainingQuantity(item);
                            const disabled = remaining <= 0;
                            return (
                                <article key={item.id}
                                         className={`rounded-2xl border p-4 ${disabled ? 'border-slate-100 bg-slate-50 opacity-65' : 'border-slate-200'}`}>
                                    <div
                                        className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900">{item.name}</h3>
                                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">#{shortId(item.id)}</p>
                                        </div>
                                        <p className="text-xs text-slate-500">{t('receipt.quantities', {ordered: quantity(item.orderedQuantity), received: quantity(item.receivedQuantity), remaining: quantity(remaining)})}</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                            <span>{t('receipt.now')}</span>
                                            <input disabled={disabled} type="number" min="0" max={remaining}
                                                   step="0.0001" value={items[item.id].quantity}
                                                   onChange={(event) => updateItem(item.id, 'quantity', event.target.value)}
                                                   placeholder="0" className={fieldClassName}/>
                                        </label>
                                        <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                            <span>{t('receipt.lot')}</span>
                                            <input disabled={disabled} value={items[item.id].lotNumber}
                                                   onChange={(event) => updateItem(item.id, 'lotNumber', event.target.value)}
                                                   placeholder="LOT-2026-001" className={fieldClassName}/>
                                        </label>
                                        <label className="space-y-1.5 text-xs font-bold text-slate-600">
                                            <span>{t('receipt.expires')}</span>
                                            <input disabled={disabled} type="date" value={items[item.id].expiresAt}
                                                   onChange={(event) => updateItem(item.id, 'expiresAt', event.target.value)}
                                                   className={fieldClassName}/>
                                        </label>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" onClick={onClose} disabled={receiveState.isLoading}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{commonT('cancel')}
                    </button>
                    <button type="submit" disabled={receiveState.isLoading}
                            className="min-h-11 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{receiveState.isLoading ? t('receipt.receiving') : t('receipt.submit')}</button>
                </div>
            </form>
        </Modal>
    );
}

function OrderDetailModal({
                              order,
                              actionLoading,
                              onClose,
                              onSubmit,
                              onReceive,
                          }: {
    order: ProcurementOrder;
    actionLoading: boolean;
    onClose: () => void;
    onSubmit: () => void;
    onReceive: () => void;
}) {
    const t = useTranslations('warehouse.procurement');
    const commonT = useTranslations('common.actions');
    const {money, quantity, dateTime} = useProcurementFormatters();
    const statusKey = getOrderStatusKey(order.status);
    const remainingTotal = order.items.reduce((sum, item) => sum + getRemainingQuantity(item), 0);
    const canSubmit = isDraftOrder(order);
    const canReceive = remainingTotal > 0 && !isDraftOrder(order) && !isTerminalOrder(order);

    return (
        <Modal contentClassName="max-w-5xl p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-slate-900">{t('detail.title', {number: order.number || `#${shortId(order.id)}`})}</h2>
                        <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getOrderStatusClasses(order.status)}`}>{statusKey ? t(statusKey) : order.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t('detail.supplier', {name: order.supplierName || `#${shortId(order.supplierId)}`})}</p>
                </div>
                <button type="button" onClick={onClose} disabled={actionLoading}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕
                </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                        [t('detail.expected'), dateTime(order.expectedAt)],
                        [t('detail.received'), dateTime(order.receivedAt)],
                        [t('detail.amount'), money(order.totalAmount)],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                            <p className="mt-1 break-all text-sm font-bold text-slate-800">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[720px] text-left">
                        <thead
                            className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-bold">{t('detail.position')}</th>
                            <th className="px-4 py-3 font-bold">{t('detail.ordered')}</th>
                            <th className="px-4 py-3 font-bold">{t('detail.receivedQuantity')}</th>
                            <th className="px-4 py-3 font-bold">{t('detail.remaining')}</th>
                            <th className="px-4 py-3 text-right font-bold">{t('detail.price')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {order.items.map((item) => (
                            <tr key={item.id}>
                                <td className="px-4 py-3 text-sm font-bold text-slate-900">{item.name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{quantity(item.orderedQuantity)}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{quantity(item.receivedQuantity)}</td>
                                <td className="px-4 py-3 text-sm font-bold text-slate-800">{quantity(getRemainingQuantity(item))}</td>
                                <td className="px-4 py-3 text-right text-sm text-slate-600">{money(item.unitPrice)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <button type="button" onClick={onClose} disabled={actionLoading}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{commonT('close')}
                </button>
                {canSubmit && <button type="button" onClick={onSubmit} disabled={actionLoading}
                                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{actionLoading ? t('detail.sending') : t('detail.submit')}</button>}
                {canReceive && <button type="button" onClick={onReceive} disabled={actionLoading}
                                       className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{t('detail.receive')}</button>}
            </div>
        </Modal>
    );
}

export default function ProcurementPanel() {
    const t = useTranslations('warehouse.procurement');
    const commonT = useTranslations('common.actions');
    const paginationT = useTranslations('common.pagination');
    const {locale} = useAppLocale();
    const {money, quantity, dateTime} = useProcurementFormatters();
    const [view, setView] = useState<ProcurementView>('orders');
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [createOrderOpen, setCreateOrderOpen] = useState(false);
    const [supplierModalOpen, setSupplierModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<ProcurementSupplier | undefined>();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [receiptOrder, setReceiptOrder] = useState<ProcurementOrder | null>(null);

    const ordersQuery = useGetProcurementOrdersQuery({page, size: PAGE_SIZE});
    const suppliersQuery = useGetProcurementSuppliersQuery();
    const nomenclatureQuery = useGetNomenclatureQuery({activeOnly: true, page: 0, size: 1000});
    const [submitOrder, submitState] = useSubmitProcurementOrderMutation();
    const orders = useMemo(
        () => ordersQuery.data?.content ?? [],
        [ordersQuery.data?.content]
    );
    const suppliers = suppliersQuery.data ?? [];
    const selectedOrder = orders.find((order) => order.id === selectedOrderId);
    const filteredOrders = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase(intlLocaleByLocale[locale]);
        if (!needle) return orders;
        return orders.filter((order) =>
            `${order.number} ${order.supplierName} ${order.status}`.toLocaleLowerCase(intlLocaleByLocale[locale]).includes(needle)
        );
    }, [locale, orders, search]);
    const draftCount = orders.filter(isDraftOrder).length;
    const receivableCount = orders.filter((order) => !isDraftOrder(order) && !isTerminalOrder(order)).length;
    const loadError =
        ordersQuery.error
        ?? suppliersQuery.error
        ?? nomenclatureQuery.error;
    const handleSubmitOrder = async () => {
        if (!selectedOrder) return;
        try {
            await submitOrder(selectedOrder.id).unwrap();
            setSelectedOrderId(null);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const closeSupplierModal = () => {
        setSupplierModalOpen(false);
        setEditingSupplier(undefined);
    };

    return (
        <div className="space-y-5">
            {loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {getApiErrorMessage(loadError, t('loadError'))}
                </div>
            )}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    [t('metrics.total'), ordersQuery.data?.totalElements ?? '—', t('metrics.totalHint')],
                    [t('metrics.drafts'), draftCount, t('metrics.pageHint')],
                    [t('metrics.receivable'), receivableCount, t('metrics.workHint')],
                    [t('metrics.suppliers'), suppliers.length, t('metrics.active', {count: suppliers.filter((supplier) => supplier.active).length})],
                ].map(([label, value, note]) => (
                    <article key={label}
                             className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/5">
                        <div className="flex items-center justify-between"><p
                            className="text-xs font-bold text-slate-500">{label}</p><span
                            className="h-2.5 w-2.5 rounded-full bg-violet-500"/></div>
                        <p className="mt-5 text-2xl font-black tracking-tight text-slate-950">{value}</p>
                        <p className="mt-2 text-[11px] text-slate-400">{note}</p>
                    </article>
                ))}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div
                    className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
                        {([
                            ['orders', t('tabs.orders')],
                            ['suppliers', t('tabs.suppliers')],
                        ] as Array<[ProcurementView, string]>).map(([id, label]) => (
                            <button key={id} type="button" onClick={() => setView(id)}
                                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
                        ))}
                    </div>

                    {view === 'orders' ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                                   placeholder={t('search')} className={`${fieldClassName} sm:w-64`}/>
                            <button type="button" onClick={() => setCreateOrderOpen(true)} disabled={
                                suppliersQuery.isLoading
                                || nomenclatureQuery.isLoading
                                || suppliers.filter((supplier) => supplier.active).length === 0
                                || (nomenclatureQuery.data?.length ?? 0) === 0
                            }
                                    title={
                                        suppliers.filter((supplier) => supplier.active).length === 0
                                            ? t('supplierFirst')
                                            : undefined
                                    }
                                    className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">+
                                {t('newOrder')}
                            </button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => {
                            setEditingSupplier(undefined);
                            setSupplierModalOpen(true);
                        }}
                                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 hover:bg-violet-700">+
                            {t('newSupplier')}</button>
                    )}
                </div>

                {view === 'orders' ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left">
                                <thead
                                    className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-5 py-3 font-bold">{t('table.order')}</th>
                                    <th className="px-5 py-3 font-bold">{t('table.supplier')}</th>
                                    <th className="px-5 py-3 font-bold">{t('table.delivery')}</th>
                                    <th className="px-5 py-3 font-bold">{t('table.progress')}</th>
                                    <th className="px-5 py-3 font-bold">{t('table.amount')}</th>
                                    <th className="px-5 py-3 text-right font-bold">{t('table.status')}</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {filteredOrders.map((order) => {
                                    const ordered = order.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
                                    const received = order.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
                                    const progress = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
                                    const statusKey = getOrderStatusKey(order.status);
                                    return (
                                        <tr key={order.id} onClick={() => setSelectedOrderId(order.id)}
                                            className="cursor-pointer transition hover:bg-violet-50/50">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-slate-900">{order.number || `#${shortId(order.id)}`}</p>
                                                <p className="mt-1 text-[10px] font-bold text-slate-400">{t('table.positions', {count: order.items.length})}</p>
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-slate-700">{order.supplierName || `#${shortId(order.supplierId)}`}</td>
                                            <td className="px-5 py-4 text-sm text-slate-600">{dateTime(order.expectedAt)}</td>
                                            <td className="px-5 py-4">
                                                <div className="w-32">
                                                    <div
                                                        className="mb-1 flex justify-between text-[10px] text-slate-400">
                                                        <span>{quantity(received)} / {quantity(ordered)}</span><span>{progress}%</span>
                                                    </div>
                                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-emerald-500"
                                                             style={{width: `${progress}%`}}/>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-slate-700">{money(order.totalAmount)}</td>
                                            <td className="px-5 py-4 text-right"><span
                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getOrderStatusClasses(order.status)}`}>{statusKey ? t(statusKey) : order.status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        {ordersQuery.isLoading &&
                            <div className="px-5 py-16 text-center text-sm text-slate-500">{t('loadingOrders')}</div>}
                        {!ordersQuery.isLoading && filteredOrders.length === 0 && <div
                            className="px-5 py-16 text-center text-sm text-slate-500">{search ? t('noSearchResults') : t('noOrders')}</div>}

                        {(ordersQuery.data?.totalPages ?? 0) > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                                <p className="text-xs text-slate-500">{t('page', {current: page + 1, total: ordersQuery.data?.totalPages ?? 1})}</p>
                                <div className="flex gap-2">
                                    <button type="button" disabled={ordersQuery.data?.first || ordersQuery.isFetching}
                                            onClick={() => setPage((current) => Math.max(0, current - 1))}
                                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{commonT('back')}
                                    </button>
                                    <button type="button" disabled={ordersQuery.data?.last || ordersQuery.isFetching}
                                            onClick={() => setPage((current) => current + 1)}
                                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{paginationT('next')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                            {suppliers.map((supplier) => (
                                <article key={supplier.id}
                                         className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-sm font-black text-slate-900">{supplier.name}</h3>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${supplier.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{supplier.active ? t('supplier.activeStatus') : t('supplier.inactiveStatus')}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{t('supplier.binValue', {bin: supplier.bin || '—'})}</p>
                                        </div>
                                        <button type="button" onClick={() => {
                                            setEditingSupplier(supplier);
                                            setSupplierModalOpen(true);
                                        }}
                                                className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700">{commonT('edit')}
                                        </button>
                                    </div>
                                    <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                                        <p>{supplier.phone || t('supplier.phoneMissing')}</p>
                                        <p className="truncate">{supplier.email || t('supplier.emailMissing')}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                        {suppliersQuery.isLoading &&
                            <div className="px-5 py-16 text-center text-sm text-slate-500">{t('supplier.loading')}</div>}
                        {!suppliersQuery.isLoading && suppliers.length === 0 &&
                            <div className="px-5 py-16 text-center text-sm text-slate-500">{t('supplier.empty')}</div>}
                    </>
                )}
            </section>

            {createOrderOpen && (
                <CreateOrderModal
                    suppliers={suppliers}
                    nomenclature={nomenclatureQuery.data ?? []}
                    onClose={() => setCreateOrderOpen(false)}
                    onCreated={() => {
                        setCreateOrderOpen(false);
                    }}
                />
            )}
            {supplierModalOpen && (
                <SupplierModal
                    key={editingSupplier?.id ?? 'new'}
                    supplier={editingSupplier}
                    onClose={closeSupplierModal}
                    onSaved={closeSupplierModal}
                />
            )}
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    actionLoading={submitState.isLoading}
                    onClose={() => setSelectedOrderId(null)}
                    onSubmit={handleSubmitOrder}
                    onReceive={() => {
                        setReceiptOrder(selectedOrder);
                        setSelectedOrderId(null);
                    }}
                />
            )}
            {receiptOrder && (
                <ReceiptModal
                    order={receiptOrder}
                    onClose={() => setReceiptOrder(null)}
                    onReceived={() => {
                        setReceiptOrder(null);
                    }}
                />
            )}
        </div>
    );
}
