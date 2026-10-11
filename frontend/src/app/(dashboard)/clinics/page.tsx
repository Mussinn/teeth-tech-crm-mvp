'use client';

import {useMemo, useState} from 'react';
import Section from '@/src/components/ui/Section';
import CreateClinicModal from '@/src/components/Modals/CreateClinicModal';
import Link from 'next/link';
import ErrorState from '@/src/components/ui/ErrorState';
import {useGetClinicsQuery} from "@/src/services/api/clinicsApi";
import {useTranslations} from 'next-intl';

type ClinicTableRow = {
    id: string | number;
    name: string;
    address: string;
    phone: string;
    ordersCount: number;
    activeOrders: number;
    completedOrders: number;
};

export default function ClinicsPage() {
    const t = useTranslations('clinics');
    const commonT = useTranslations('common');

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [sort, setSort] = useState('name,ASC');
    const [search, setSearch] = useState('');

    const {data, isLoading, isError} = useGetClinicsQuery({
        page,
        size,
        sort
    });


    const clinics = useMemo<ClinicTableRow[]>(() => {
        const apiClinics = data?.content.map((clinic) => ({
            id: clinic.id,
            name: clinic.name,
            address: clinic.address,
            phone: clinic.phone,
            ordersCount: clinic.totalOrders,
            activeOrders: clinic.activeOrders,
            completedOrders: clinic.completedOrders,
        })) ?? [];

        return apiClinics;

    }, [ data]);

    const visibleClinics = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return clinics;
        return clinics.filter((clinic) => [clinic.name, clinic.address, clinic.phone]
            .some((value) => value?.toLocaleLowerCase().includes(query)));
    }, [clinics, search]);
    const pageOrders = clinics.reduce((sum, clinic) => sum + clinic.ordersCount, 0);
    const pageActiveOrders = clinics.reduce((sum, clinic) => sum + clinic.activeOrders, 0);
    const pageCompletedOrders = clinics.reduce((sum, clinic) => sum + clinic.completedOrders, 0);

    if (isLoading) return <p>{t('loading')}</p>
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

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition-all hover:bg-violet-700 active:scale-95 md:w-auto"
                >
                    + {t('add')}
                </button>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    [t('metrics.clinics'), data?.numberOfElements ?? clinics.length, t('metrics.currentSelection'), 'bg-violet-500'],
                    [t('metrics.orders'), pageOrders, t('metrics.currentPage'), 'bg-blue-500'],
                    [t('metrics.activeOrders'), pageActiveOrders, t('metrics.inProgress'), 'bg-amber-500'],
                    [t('metrics.completed'), pageCompletedOrders, t('metrics.currentPage'), 'bg-emerald-500'],
                ].map(([label, value, note, color]) => <article key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`} /></div><p className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:mt-5 sm:text-3xl">{value}</p><p className="mt-2 text-[11px] text-slate-400">{note}</p></article>)}
            </section>

            <Section style="py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('filters.search')}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 lg:max-w-md"
                    />

                    <select
                        value={sort}
                        onChange={(event) => { setSort(event.target.value); setPage(0); }}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white lg:w-56">
                        <option value="name,ASC">{t('filters.nameAsc')}</option>
                        <option value="name,DESC">{t('filters.nameDesc')}</option>
                    </select>
                    <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white lg:w-44"><option value={10}>{t('filters.perPage', {count: 10})}</option><option value={20}>{t('filters.perPage', {count: 20})}</option><option value={50}>{t('filters.perPage', {count: 50})}</option></select>
                    <p className="ml-auto text-xs text-slate-400">{t('filters.shown', {count: visibleClinics.length})}</p>
                </div>
            </Section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                    <div><h2 className="text-sm font-bold text-slate-900">{t('registry.title')}</h2><p className="mt-1 text-xs text-slate-400">{t('registry.subtitle')}</p></div>
                    <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{t('registry.count', {count: data?.numberOfElements ?? clinics.length})}</span>
                </div>

                <div className="grid max-h-[70dvh] gap-3 overflow-y-auto p-3 md:hidden">
                    {visibleClinics.map((clinic) => (
                        <Link
                            key={clinic.id}
                            href={`/clinics/${clinic.id}`}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition active:bg-violet-50"
                        >
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                                    {clinic.name.trim().charAt(0).toLocaleUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="break-words text-sm font-black text-slate-900">{clinic.name}</h3>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">{clinic.address || t('registry.addressMissing')}</p>
                                    <p className="mt-1 break-all text-xs font-semibold text-slate-600">{clinic.phone || t('registry.phoneMissing')}</p>
                                </div>
                                <span aria-hidden="true" className="shrink-0 text-slate-300">›</span>
                            </div>
                            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl bg-slate-50 p-2">
                                    <dt className="text-[9px] uppercase text-slate-400">{t('registry.total')}</dt>
                                    <dd className="mt-1 text-sm font-black text-slate-900">{clinic.ordersCount}</dd>
                                </div>
                                <div className="rounded-xl bg-amber-50 p-2">
                                    <dt className="text-[9px] uppercase text-amber-600">{t('registry.active')}</dt>
                                    <dd className="mt-1 text-sm font-black text-amber-700">{clinic.activeOrders}</dd>
                                </div>
                                <div className="rounded-xl bg-emerald-50 p-2">
                                    <dt className="text-[9px] uppercase text-emerald-600">{t('registry.ready')}</dt>
                                    <dd className="mt-1 text-sm font-black text-emerald-700">{clinic.completedOrders}</dd>
                                </div>
                            </dl>
                        </Link>
                    ))}
                </div>

                <div className="hidden max-h-[620px] overflow-auto md:block">
                    <table className="w-full min-w-[760px] border-collapse text-left lg:min-w-[900px]">
                        <thead
                            className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 text-[.65rem] uppercase tracking-widest text-slate-400 backdrop-blur">
                        <tr>
                            <th className="p-4 font-bold">{t('registry.name')}</th>
                            <th className="p-4 font-bold">{t('registry.address')}</th>
                            <th className="p-4 font-bold">{t('registry.phone')}</th>
                            <th className="p-4 font-bold">{t('registry.orders')}</th>
                            <th className="p-4 font-bold">{t('registry.activeOrders')}</th>
                            <th className="p-4 font-bold">{t('registry.completedOrders')}</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                        {visibleClinics.map((clinic) => (
                            <tr
                                key={clinic.id}
                                className="transition hover:bg-violet-50/50"
                            >
                                <td className="p-4 font-bold text-slate-800">
                                    <Link
                                        href={`/clinics/${clinic.id}`}
                                        className="group flex items-center gap-3 text-slate-900"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">{clinic.name.trim().charAt(0).toLocaleUpperCase()}</span><span className="group-hover:text-violet-600">{clinic.name}</span>
                                    </Link>
                                </td>
                                <td className="p-4">{clinic.address}</td>
                                <td className="p-4">{clinic.phone}</td>
                                <td className="p-4 font-bold text-slate-900">{clinic.ordersCount}</td>
                                <td className="p-4"><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{clinic.activeOrders}</span></td>
                                <td className="p-4"><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{clinic.completedOrders}</span></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-4 sm:px-5"><p className="text-xs text-slate-500">{t('registry.page', {page: (data?.number ?? page) + 1})}</p><div className="flex gap-2"><button type="button" disabled={!data || data.first} onClick={() => setPage((current) => Math.max(0, current - 1))} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{commonT('pagination.previous')}</button><button type="button" disabled={!data || data.last} onClick={() => setPage((current) => current + 1)} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{commonT('pagination.next')}</button></div></div>
            </section>

            <CreateClinicModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}
