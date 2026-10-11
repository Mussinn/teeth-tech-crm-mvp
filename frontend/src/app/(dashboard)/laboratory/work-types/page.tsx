'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {
    useDeleteWorkTypeMutation,
    useGetWorkTypesQuery,
} from '@/src/services/api/laboratory/workTypesApi';

import CreateWorkTypeStages from '@/src/components/Modals/CreateWorkTypeStages';
import WorkTypeDetailsModal from '@/src/components/laboratory/WorkTypeDetailsModal';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import ErrorState from '@/src/components/ui/ErrorState';
import type {WorkTypes} from '@/src/types/laboratory-types/workTypes.types';
import {useAppLocale} from '@/src/i18n/provider';
import {intlLocaleByLocale} from '@/src/i18n/config';

export default function LaboratoryWorkTypesPage() {
    const t = useTranslations('laboratory.workTypes');
    const commonT = useTranslations('common');
    const {locale} = useAppLocale();
    const intlLocale = intlLocaleByLocale[locale];
    const [stagesModalOpen, setStagesModalOpen] = useState(false);
    const [selectedWorkType, setSelectedWorkType] = useState<WorkTypes | null>(null);
    const [workTypeToDelete, setWorkTypeToDelete] = useState<WorkTypes | null>(null);
    const [search, setSearch] = useState('');

    const {
        data: items = [],
        isLoading,
        isError,
    } = useGetWorkTypesQuery();
    const [deleteWorkType, {isLoading: isDeleting}] =
        useDeleteWorkTypeMutation();

    const handleDeleteWorkType = async () => {
        if (!workTypeToDelete) return;

        try {
            await deleteWorkType(workTypeToDelete.id).unwrap();

            if (selectedWorkType?.id === workTypeToDelete.id) {
                setSelectedWorkType(null);
            }

            setWorkTypeToDelete(null);
        } catch {
            // Ошибка уже отображается глобальным обработчиком API.
        }
    };

    const filteredItems = useMemo(() => {
        const query = search
            .trim()
            .toLocaleLowerCase(intlLocale);

        if (!query) {
            return items;
        }

        return items.filter((item) =>
            [
                item.name,
                item.code,
                item.description,
            ].some((value) =>
                value
                    ?.toLocaleLowerCase(intlLocale)
                    .includes(query),
            ),
        );
    }, [intlLocale, items, search]);

    const hasActivation = items.some(
        (item) => typeof item.isActive === 'boolean',
    );

    const activeCount = hasActivation
        ? items.filter((item) => item.isActive).length
        : items.length;

    const inactiveCount = hasActivation
        ? items.length - activeCount
        : 0;

    return (
        <>
            <main className="mx-auto min-h-full w-full max-w-[1600px] space-y-5 pb-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">
                            {t('badge')}
                        </p>

                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                            {t('title')}
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            {t('subtitle')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setStagesModalOpen(true)}
                        data-tour="work-type-create"
                        className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition hover:bg-violet-700 active:scale-95 sm:w-auto"
                    >
                        {t('create')}
                    </button>
                </header>

                <section
                    className={`grid gap-4 ${
                        hasActivation
                            ? 'sm:grid-cols-3'
                            : 'sm:grid-cols-2'
                    }`}
                >
                    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-500">
                                {t('total')}
                            </p>

                            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                        </div>

                        <p className="mt-4 text-2xl font-black text-slate-950">
                            {items.length}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                            {t('totalHint')}
                        </p>
                    </article>

                    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-500">
                                {t('available')}
                            </p>

                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </div>

                        <p className="mt-4 text-2xl font-black text-slate-950">
                            {activeCount}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                            {t('availableHint')}
                        </p>
                    </article>

                    {hasActivation && (
                        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-500">
                                    {t('disabled')}
                                </p>

                                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                            </div>

                            <p className="mt-4 text-2xl font-black text-slate-950">
                                {inactiveCount}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                                {t('disabledHint')}
                            </p>
                        </article>
                    )}
                </section>

                <section data-tour="work-types-list" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">
                                {t('list')}
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                {t('shown', {shown: filteredItems.length, total: items.length})}
                            </p>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder={t('search')}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                            />

                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-400 transition hover:text-slate-700"
                                    aria-label={t('clearSearch')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-4 sm:p-5">
                        {isLoading && (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {Array.from({length: 6}).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-36 animate-pulse rounded-2xl bg-slate-100"
                                    />
                                ))}
                            </div>
                        )}

                        {isError && (
                            <ErrorState compact>
                                {t('loadError')}
                            </ErrorState>
                        )}

                        {!isLoading &&
                            !isError &&
                            items.length === 0 && (
                                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl font-black text-violet-600">
                                        +
                                    </div>

                                    <h3 className="mt-4 text-sm font-bold text-slate-800">
                                        {t('empty')}
                                    </h3>

                                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                                        {t('emptyHint')}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setStagesModalOpen(true)
                                        }
                                        className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
                                    >
                                        {t('createFirst')}
                                    </button>
                                </div>
                            )}

                        {!isLoading &&
                            !isError &&
                            items.length > 0 &&
                            filteredItems.length === 0 && (
                                <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                                    <h3 className="text-sm font-bold text-slate-700">
                                        {t('noResults')}
                                    </h3>

                                    <p className="mt-1 text-sm text-slate-500">
                                        {t('noResultsHint')}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-violet-600 transition hover:bg-violet-50"
                                    >
                                        {t('clearSearch')}
                                    </button>
                                </div>
                            )}

                        {!isLoading &&
                            !isError &&
                            filteredItems.length > 0 && (
                                <div className="grid max-h-[65dvh] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:max-h-[650px] xl:grid-cols-3">
                                    {filteredItems.map((item) => (
                                        <article
                                            key={item.id}
                                            className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                                                        {item.name
                                                            .trim()
                                                            .charAt(0)
                                                            .toLocaleUpperCase(intlLocale)}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-violet-700">
                                                            {item.name}
                                                        </h3>

                                                        {item.code && (
                                                            <p className="mt-1 truncate font-mono text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                                                {item.code}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {typeof item.isActive ===
                                                    'boolean' && (
                                                        <span
                                                            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                                                                item.isActive
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                        >
                                                        {item.isActive
                                                            ? t('active')
                                                            : t('inactive')}
                                                    </span>
                                                    )}
                                            </div>

                                            <div className="mt-4 flex-1">
                                                {item.description ? (
                                                    <p className="line-clamp-3 text-sm leading-5 text-slate-500">
                                                        {item.description}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm italic text-slate-400">
                                                        {t('noDescription')}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {t('type')}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setWorkTypeToDelete(item)}
                                                        aria-label={t('deleteAria', {name: item.name})}
                                                        className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        {commonT('actions.delete')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedWorkType(item)}
                                                        className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                                                    >
                                                        {t('details')}
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                    </div>
                </section>
            </main>

            <CreateWorkTypeStages
                isOpen={stagesModalOpen}
                onClose={() => setStagesModalOpen(false)}
            />

            {selectedWorkType && (
                <WorkTypeDetailsModal
                    workType={selectedWorkType}
                    onClose={() => setSelectedWorkType(null)}
                    onDelete={setWorkTypeToDelete}
                />
            )}

            <ConfirmDialog
                open={workTypeToDelete !== null}
                title={t('deleteTitle')}
                description={t('deleteDescription', {name: workTypeToDelete?.name ?? ''})}
                confirmLabel={t('deleteConfirm')}
                isLoading={isDeleting}
                onClose={() => setWorkTypeToDelete(null)}
                onConfirm={handleDeleteWorkType}
            />
        </>
    );
}
