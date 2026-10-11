'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useGetClinicsQuery } from '@/src/services/api/clinicsApi';
import { useLazySearchPatientsQuery } from '@/src/services/api/patientHistoryApi';

export default function ClinicPatientsPage() {
    const t = useTranslations('patientHistory.search');
    const [clinicId, setClinicId] = useState('');
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query, 400);
    const clinicsQuery = useGetClinicsQuery({ page: 0, size: 50, sort: 'name,ASC' });
    const [searchPatients, patientsQuery] = useLazySearchPatientsQuery();

    useEffect(() => {
        if (!clinicId) return;

        const request = searchPatients({
            clinicId,
            query: debouncedQuery,
            limit: 20,
        });

        return () => request.abort();
    }, [clinicId, debouncedQuery, searchPatients]);

    const retrySearch = () => {
        if (clinicId) {
            void searchPatients({ clinicId, query: debouncedQuery, limit: 20 });
        }
    };

    return (
        <div className="mx-auto max-w-5xl space-y-5 pb-8">
            <header>
                <h1 className="text-2xl font-black tracking-tight text-slate-950">{t('title')}</h1>
                <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
            </header>

            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
                <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('clinic')}</span>
                    <select
                        value={clinicId}
                        onChange={(event) => {
                            setClinicId(event.target.value);
                            setQuery('');
                        }}
                        disabled={clinicsQuery.isLoading || clinicsQuery.isError}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                    >
                        <option value="">{clinicsQuery.isLoading ? t('loadingClinics') : t('selectClinic')}</option>
                        {(clinicsQuery.data?.content ?? []).map((clinic) => (
                            <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                        ))}
                    </select>
                    {clinicsQuery.isError && <p className="mt-2 text-xs font-semibold text-red-600">{t('clinicsError')}</p>}
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">{t('query')}</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('queryPlaceholder')}
                        disabled={!clinicId}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                    />
                </label>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {patientsQuery.isFetching ? (
                    <div className="space-y-3 p-5" aria-label={t('loading')} aria-busy="true">
                        {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
                    </div>
                ) : patientsQuery.isError ? (
                    <div className="p-8 text-center">
                        <p className="text-sm font-semibold text-red-700">{t('loadError')}</p>
                        <button type="button" onClick={retrySearch} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{t('retry')}</button>
                    </div>
                ) : !clinicId ? (
                    <p className="p-10 text-center text-sm text-slate-500">{t('selectHint')}</p>
                ) : patientsQuery.data?.content.length ? (
                    <div className="divide-y divide-slate-100">
                        {patientsQuery.data.content.map((patient) => (
                            <Link
                                key={patient.id}
                                href={`/patients/${patient.id}`}
                                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-violet-50/50"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-900">{patient.label}</p>
                                    {patient.description ? <p className="mt-1 truncate text-xs text-slate-500">{patient.description}</p> : null}
                                </div>
                                <span className="shrink-0 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">{t('open')}</span>
                            </Link>
                        ))}
                    </div>
                ) : patientsQuery.isSuccess ? (
                    <p className="p-10 text-center text-sm text-slate-500">{t('empty')}</p>
                ) : null}
            </section>
        </div>
    );
}
