'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import ErrorState from '@/src/components/ui/ErrorState';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type FormValue = string | number | boolean;
type FormState = Record<string, FormValue>;

type FieldConfig = {
    name: string;
    label: string;
    placeholder?: string;
    type: 'text' | 'number' | 'textarea' | 'checkbox';
    required?: boolean;
    min?: number;
    max?: number;
    step?: number | string;
};

type DictionaryItem = {
    id: string;
    name: string;
    code?: string;
    description?: string;
    price?: number;
    isActive?: boolean;
};

type QueryResult<TItem> = {
    data?: TItem[];
    isLoading: boolean;
    isError: boolean;
};

type MutationResult = {
    unwrap: () => Promise<unknown>;
};

type MutationState = {
    isLoading: boolean;
};

type Props<
    TItem extends DictionaryItem,
    TQueryArg = void,
    TCreateBody = unknown,
    TUpdateBody = unknown
> = {
    pageTitle: string;
    pageDescription: string;

    formTitle: string;
    formDescription: string;

    listTitle: string;
    emptyTitle: string;
    emptyDescription: string;

    fields: FieldConfig[];
    initialFormState: FormState;

    useGetQuery: (arg?: TQueryArg) => QueryResult<TItem>;
    queryArg?: TQueryArg;

    useCreateMutation: () => readonly [
        (body: TCreateBody) => MutationResult,
        MutationState
    ];

    useUpdateMutation: () => readonly [
        (args: { id: string; body: TUpdateBody }) => MutationResult,
        MutationState
    ];

    useDeleteMutation: () => readonly [
        (id: string) => MutationResult,
        MutationState
    ];

    getEditForm: (item: TItem) => FormState;
    getCreateBody: (form: FormState) => TCreateBody;
    getUpdateBody: (form: FormState) => TUpdateBody;
};

export default function LaboratoryCrudPage<
    TItem extends DictionaryItem,
    TQueryArg = void,
    TCreateBody = unknown,
    TUpdateBody = unknown
>({
                                                                             pageTitle,
                                                                             pageDescription,
                                                                             formTitle,
                                                                             formDescription,
                                                                             listTitle,
                                                                             emptyTitle,
                                                                             emptyDescription,
                                                                             fields,
                                                                             initialFormState,
                                                                             useGetQuery,
                                                                             queryArg,
                                                                             useCreateMutation,
                                                                             useUpdateMutation,
                                                                             useDeleteMutation,
                                                                             getEditForm,
                                                                             getCreateBody,
                                                                             getUpdateBody,
                                                                         }: Props<TItem, TQueryArg, TCreateBody, TUpdateBody>) {
    const t = useTranslations('laboratory.directory');
    const commonT = useTranslations('common.actions');
    const {currency} = useAppFormatters();
    const {
        data: items = [],
        isLoading,
        isError,
    } = useGetQuery(queryArg);

    const [createItem, { isLoading: isCreating }] = useCreateMutation();
    const [updateItem, { isLoading: isUpdating }] = useUpdateMutation();
    const [deleteItem, { isLoading: isDeleting }] = useDeleteMutation();

    const [form, setForm] = useState<FormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [itemToDelete, setItemToDelete] = useState<TItem | null>(null);
    const { notifyError } = useNotifications();

    const isSubmitting = isCreating || isUpdating;
    const filteredItems = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return items;
        return items.filter((item) => [item.name, item.code, item.description]
            .some((value) => value?.toLocaleLowerCase().includes(query)));
    }, [items, search]);
    const hasActivation = items.some((item) => typeof item.isActive === 'boolean');
    const activeCount = hasActivation ? items.filter((item) => item.isActive).length : items.length;
    const inactiveCount = hasActivation ? items.length - activeCount : 0;

    const handleChange = (fieldName: string, value: FormValue) => {
        setForm((prev) => ({
            ...prev,
            [fieldName]: value,
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const hasEmptyRequiredField = fields.some((field) => {
            if (!field.required) return false;

            const value = form[field.name];

            if (typeof value === 'string') return !value.trim();
            if (typeof value === 'number') return !Number.isFinite(value);

            return false;
        });

        if (hasEmptyRequiredField) {
            notifyError(t('required'));
            return;
        }

        try {
            if (editingId) {
                await updateItem({
                    id: editingId,
                    body: getUpdateBody(form),
                }).unwrap();
            } else {
                await createItem(getCreateBody(form)).unwrap();
            }

            setForm(initialFormState);
            setEditingId(null);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    const handleEdit = (item: TItem) => {
        setEditingId(item.id);
        setForm(getEditForm(item));
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(initialFormState);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteItem(itemToDelete.id).unwrap();

            if (editingId === itemToDelete.id) {
                handleCancelEdit();
            }
            setItemToDelete(null);
        } catch {
            // API errors are displayed by the global notification handler.
        }
    };

    return (
        <>
            <section className="min-h-full w-full space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                    {pageTitle}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    {pageDescription}
                </p>
                </div>
                <span className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500">{t('badge')}</span>
            </div>

            <section className={`grid gap-4 ${hasActivation ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {[
                    [t('total'), items.length, t('inDirectory'), 'bg-violet-500'],
                    [t('available'), activeCount, hasActivation ? t('activeRecords') : t('forUse'), 'bg-emerald-500'],
                    ...(hasActivation ? [[t('disabled'), inactiveCount, t('hidden'), 'bg-slate-400']] : []),
                ].map(([label, value, note, color]) => <article key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`} /></div><p className="mt-4 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-400">{note}</p></article>)}
            </section>

            <section className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(18rem,420px)_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-5">
                        <div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${editingId ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>{editingId ? '✎' : '+'}</span><div><h2 className="text-base font-bold text-slate-900">
                            {editingId ? t('editing') : t('addNamed', {name: formTitle})}
                        </h2>

                        <p className="mt-0.5 text-xs text-slate-500">
                            {formDescription}
                        </p></div></div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
                        {fields.map((field) => {
                            const value = form[field.name];

                            if (field.type === 'textarea') {
                                return (
                                    <div key={field.name} className="flex flex-col gap-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">
                                            {field.label}
                                        </label>

                                        <textarea
                                            value={String(value ?? '')}
                                            onChange={(event) =>
                                                handleChange(field.name, event.target.value)
                                            }
                                            placeholder={field.placeholder}
                                            rows={4}
                                            className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                                        />
                                    </div>
                                );
                            }

                            if (field.type === 'checkbox') {
                                return (
                                    <label
                                        key={field.name}
                                        className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                                    >
                                        <span className="text-sm font-medium text-slate-700">
                                            {field.label}
                                        </span>

                                        <input
                                            type="checkbox"
                                            checked={Boolean(value)}
                                            onChange={(event) =>
                                                handleChange(field.name, event.target.checked)
                                            }
                                            className="h-4 w-4 cursor-pointer accent-violet-600"
                                        />
                                    </label>
                                );
                            }

                            return (
                                <div key={field.name} className="flex flex-col gap-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">
                                        {field.label}
                                    </label>

                                    <input
                                        type={field.type === 'number' ? 'number' : 'text'}
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                        value={String(value ?? '')}
                                        onChange={(event) =>
                                            handleChange(
                                                field.name,
                                                field.type === 'number' && event.target.value !== ''
                                                    ? Number(event.target.value)
                                                    : event.target.value
                                            )
                                        }
                                        placeholder={field.placeholder}
                                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                                    />
                                </div>
                            );
                        })}

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-11 flex-1 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {editingId ? commonT('save') : commonT('add')}
                            </button>

                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                                >
                                    {commonT('cancel')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">
                                {listTitle}
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                {t('shown', {shown: filteredItems.length, total: items.length})}
                            </p>
                        </div>
                        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:w-64" />
                    </div>

                    {isLoading && (
                        <div className="rounded-2xl bg-slate-100 px-4 py-8 text-center text-sm text-slate-500">
                            {t('loading')}
                        </div>
                    )}

                    {isError && (
                        <ErrorState compact>
                            {t('loadError')}
                        </ErrorState>
                    )}

                    {!isLoading && !isError && items.length === 0 && (
                        <div className="rounded-2xl bg-slate-100 px-4 py-10 text-center">
                            <h3 className="text-sm font-medium text-slate-700">
                                {emptyTitle}
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                {emptyDescription}
                            </p>
                        </div>
                    )}

                    {!isLoading && !isError && items.length > 0 && filteredItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-400">{t('noResults')}</div>
                    )}

                    {!isLoading && !isError && filteredItems.length > 0 && (
                        <div className="grid max-h-[70dvh] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:max-h-[620px]">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-3 flex items-center gap-2">
                                                {item.code && (
                                                    <span className="rounded-lg bg-violet-50 px-2.5 py-1 font-mono text-xs font-bold text-violet-700">
                                                        {item.code}
                                                    </span>
                                                )}

                                                {typeof item.isActive === 'boolean' && (
                                                    <span
                                                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                                            item.isActive
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-red-100 text-red-700'
                                                        }`}
                                                    >
                                                        {item.isActive ? t('active') : t('inactive')}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-base font-semibold text-slate-900">
                                                {item.name}
                                            </h3>

                                            {item.description && (
                                                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                                    {item.description}
                                                </p>
                                            )}

                                            {typeof item.price === 'number' && Number.isFinite(item.price) && (
                                                <p className="mt-2 text-sm font-bold text-slate-700">
                                                    {t('price', {price: currency(item.price)})}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(item)}
                                                className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-700"
                                            >
                                                {t('edit')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setItemToDelete(item)}
                                                disabled={isDeleting}
                                                className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                                            >
                                                {t('delete')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
            <ConfirmDialog
                open={itemToDelete !== null}
                title={t('deleteTitle')}
                description={t('deleteDescription', {name: itemToDelete?.name ?? ''})}
                confirmLabel={t('deleteConfirm')}
                isLoading={isDeleting}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
            />
            </section>
        </>
    );
}
