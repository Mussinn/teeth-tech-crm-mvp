'use client';

import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useState} from 'react';
import EditClinicModal from '@/src/components/Modals/EditClinicModal';
import {
    useGetClinicDoctorsQuery,
    useGetClinicOrdersQuery,
    useGetClinicPatientsQuery,
    useGetClinicsByIdQuery,
} from '@/src/services/api/clinicsApi';
import InfoItem from '@/src/components/ui/InfoItem'
import DeleteClinicApproval from "@/src/components/Modals/DeleteClinicApproval";
import ErrorState from '@/src/components/ui/ErrorState';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

const DEFAULT_RELATED_PAGE_SIZE = 10;
const DOCTORS_SORT = 'fullName,ASC';
const ORDERS_SORT = 'createdAt,DESC';
const PATIENTS_SORT = 'fullName,ASC';

function getOrderStatusClass(isActive: boolean) {
    return isActive
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-600';
}

function RelatedPager({
                          pageInfo,
                          isLoading,
                          onPrevious,
                          onNext,
                      }: {
    pageInfo?: {
        number: number;
        totalPages?: number;
        first: boolean;
        last: boolean;
    };
    isLoading: boolean;
    onPrevious: () => void;
    onNext: () => void;
}) {
    const t = useTranslations('clinics.details');
    const commonT = useTranslations('common.pagination');
    const page = (pageInfo?.number ?? 0) + 1;
    const total = pageInfo?.totalPages ?? page;
    return (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <button
                type="button"
                disabled={isLoading || !pageInfo || pageInfo.first}
                onClick={onPrevious}
                className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {commonT('previous')}
            </button>
            <span className="min-w-20 text-center">
                {t('pageOf', {page, total})}
            </span>
            <button
                type="button"
                disabled={isLoading || !pageInfo || pageInfo.last}
                onClick={onNext}
                className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {commonT('next')}
            </button>
        </div>
    );
}

export default function ClinicDetailsPage() {
    const t = useTranslations('clinics.details');
    const {currency: formatCurrency} = useAppFormatters();
    const params = useParams();
    const id = params.id as string;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [doctorsPage, setDoctorsPage] = useState(0);
    const [ordersPage, setOrdersPage] = useState(0);
    const [patientsPage, setPatientsPage] = useState(0);

    const {
        data: clinic,
        isLoading,
        isFetching,
        isError,
        refetch: refetchClinic,
    } = useGetClinicsByIdQuery(id);
    const {
        data: doctorsData,
        isFetching: isDoctorsLoading,
        isError: isDoctorsError,
        refetch: refetchDoctors,
    } = useGetClinicDoctorsQuery({
        id,
        page: doctorsPage,
        size: DEFAULT_RELATED_PAGE_SIZE,
        sort: DOCTORS_SORT,
    }, {skip: !id});
    const {
        data: ordersData,
        isFetching: isOrdersLoading,
        isError: isOrdersError,
        refetch: refetchOrders,
    } = useGetClinicOrdersQuery({
        id,
        page: ordersPage,
        size: DEFAULT_RELATED_PAGE_SIZE,
        sort: ORDERS_SORT,
    }, {skip: !id});
    const {
        data: patientsData,
        isFetching: isPatientsLoading,
        isError: isPatientsError,
        refetch: refetchPatients,
    } = useGetClinicPatientsQuery({
        id,
        page: patientsPage,
        size: DEFAULT_RELATED_PAGE_SIZE,
        sort: PATIENTS_SORT,
    }, {skip: !id});

    if (isLoading) return <p>{t('loading')}</p>;
    if (isError) {
        return (
            <ErrorState
                onRetry={() => void refetchClinic()}
                isRetrying={isFetching}
            >
                {t('loadError')}
            </ErrorState>
        );
    }


    if (!clinic) {
        return (
            <ErrorState title={t('notFound')}>
                <div className="space-y-4">
                    <p>{t('notFoundHint')}</p>
                    <Link
                        href="/clinics"
                        className="text-sm font-bold text-blue-600 hover:underline"
                    >
                        ← {t('back')}
                    </Link>
                </div>
            </ErrorState>
        );
    }

    const doctors = doctorsData?.content ?? [];
    const clinicOrders = ordersData?.content ?? [];
    const patients = patientsData?.content ?? [];
    const totalOrdersCount = clinic.totalOrdersCount ?? ordersData?.numberOfElements ?? 0;
    const totalOrdersSum = clinic.totalAmount ?? 0;
    const totalPaidSum = clinic.totalPaid ?? 0;
    const debt = clinic.totalDebt ?? totalOrdersSum - totalPaidSum;
    const paidShare = totalOrdersSum > 0 ? Math.min(100, Math.round(totalPaidSum / totalOrdersSum * 100)) : 0;

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 pb-6">
            <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500" />
                <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl font-black text-white shadow-lg shadow-violet-950/20">{clinic.name.trim().charAt(0).toLocaleUpperCase()}</span>
                    <div className="min-w-0">
                    <Link
                        href="/clinics"
                        className="mb-1 inline-block text-[10px] font-bold uppercase tracking-wider text-violet-600 hover:underline"
                    >
                        ← {t('back')}
                    </Link>

                    <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl" title={clinic.name}>
                        {clinic.name}
                    </h1>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="text-violet-500">●</span>{clinic.address || t('addressMissing')}</span><span>{clinic.phone || t('phoneMissing')}</span><span>{clinic.email || t('emailMissing')}</span></div>
                    </div>
                </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition hover:bg-violet-700 active:scale-95 sm:w-auto"
                    >
                        {t('edit')}
                    </button>
                    <button
                        onClick={() => setIsApproveModalOpen(true)}
                        className="w-full rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95 sm:w-auto"
                    >
                        {t('delete')}
                    </button>
                </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                    <p className="text-xs font-bold uppercase text-slate-400">
                        {t('totalOrders')}
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                        {totalOrdersCount}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                    <p className="text-xs font-bold uppercase text-slate-400">
                        {t('totalAmount')}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                        {formatCurrency(totalOrdersSum)}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                    <p className="text-xs font-bold uppercase text-slate-400">
                        {t('paid')}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                        {formatCurrency(totalPaidSum)}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200">
                    <p className="text-xs font-bold uppercase text-slate-400">
                        {t('debt')}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                        {formatCurrency(debt)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
                <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                    <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-600 to-fuchsia-500" />
                    <h2 className="text-lg font-bold text-slate-900">
                        {t('profile')}
                    </h2>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <InfoItem label={t('name')} value={clinic.name}/>
                        <InfoItem label={t('contactPerson')} value={clinic.contactPerson}/>
                        <InfoItem label={t('phone')} value={clinic.phone}/>
                        <InfoItem label="Email" value={clinic.email}/>
                        <InfoItem label={t('address')} value={clinic.address}/>
                        <InfoItem label={t('priceType')} value={clinic.priceType}/>
                    </div>
                </section>

                <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">{t('paymentStatus')}</h2><p className="mt-1 text-xs text-slate-400">{t('allOrders')}</p></div><span className="text-2xl font-black text-violet-600">{paidShare}%</span></div>
                    <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all" style={{width: `${paidShare}%`}} /></div>
                    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{t('paid')}</p><p className="mt-1 truncate text-sm font-black text-slate-950" title={formatCurrency(totalPaidSum)}>{formatCurrency(totalPaidSum)}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{t('balance')}</p><p className="mt-1 truncate text-sm font-black text-slate-950" title={formatCurrency(debt)}>{formatCurrency(debt)}</p></div></div>
                    <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">{t('priceType')}</span><span className="rounded-lg bg-violet-50 px-2.5 py-1 font-bold text-violet-700">{clinic.priceType || t('unspecified')}</span></div></div>
                </aside>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            {t('doctors')}
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                            {t('onPage', {count: doctors.length})}
                        </p>
                    </div>

                    <RelatedPager
                        pageInfo={doctorsData}
                        isLoading={isDoctorsLoading}
                        onPrevious={() => setDoctorsPage((currentPage) => Math.max(currentPage - 1, 0))}
                        onNext={() => setDoctorsPage((currentPage) => currentPage + 1)}
                    />
                </div>

                <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto p-4 sm:p-5 md:grid-cols-2">
                    {isDoctorsError && (
                        <QueryErrorNotice
                            className="md:col-span-2"
                            message={t('doctorsError')}
                            onRetry={() => void refetchDoctors()}
                            isRetrying={isDoctorsLoading}
                        />
                    )}

                    {isDoctorsLoading && !doctorsData && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 md:col-span-2">
                            {t('loadingDoctors')}
                        </div>
                    )}

                    {!isDoctorsLoading && !isDoctorsError && doctors.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 md:col-span-2">
                            {t('noDoctors')}
                        </div>
                    )}

                    {doctors.map((doctor) => (
                        <div
                            key={doctor.fullName}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:shadow-sm"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">{doctor.fullName.trim().charAt(0).toLocaleUpperCase()}</span><p className="font-bold text-slate-900">
                                {doctor.fullName}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            {t('patients')}
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                            {t('onPage', {count: patients.length})}
                        </p>
                    </div>

                    <RelatedPager
                        pageInfo={patientsData}
                        isLoading={isPatientsLoading}
                        onPrevious={() => setPatientsPage((currentPage) => Math.max(currentPage - 1, 0))}
                        onNext={() => setPatientsPage((currentPage) => currentPage + 1)}
                    />
                </div>

                <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto p-4 sm:p-5 md:grid-cols-2">
                    {isPatientsError && (
                        <QueryErrorNotice
                            className="md:col-span-2"
                            message={t('patientsError')}
                            onRetry={() => void refetchPatients()}
                            isRetrying={isPatientsLoading}
                        />
                    )}

                    {isPatientsLoading && !patientsData && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 md:col-span-2">
                            {t('loadingPatients')}
                        </div>
                    )}

                    {!isPatientsLoading && !isPatientsError && patients.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 md:col-span-2">
                            {t('noPatients')}
                        </div>
                    )}

                    {patients.map((patient) => (
                        <div
                            key={patient.fullName}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:shadow-sm"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">{patient.fullName.trim().charAt(0).toLocaleUpperCase()}</span><p className="font-bold text-slate-900">
                                {patient.fullName}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            {t('orders')}
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                            {t('onPage', {count: clinicOrders.length})}
                        </p>
                    </div>

                    <RelatedPager
                        pageInfo={ordersData}
                        isLoading={isOrdersLoading}
                        onPrevious={() => setOrdersPage((currentPage) => Math.max(currentPage - 1, 0))}
                        onNext={() => setOrdersPage((currentPage) => currentPage + 1)}
                    />
                </div>

                <div className="max-h-[520px] overflow-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left lg:min-w-[800px]">
                        <thead
                            className="border-b border-slate-200 bg-slate-50 text-[.7rem] uppercase tracking-widest text-slate-400">
                        <tr>
                            <th className="p-4 font-bold">ID</th>
                            <th className="p-4 font-bold">{t('patient')}</th>
                            <th className="p-4 font-bold">{t('workType')}</th>
                            <th className="p-4 font-bold">{t('status')}</th>
                            <th className="p-4 font-bold">{t('amount')}</th>
                            <th className="p-4 font-bold">{t('paid')}</th>
                            <th className="p-4 font-bold text-right">{t('action')}</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                        {isOrdersError && (
                            <tr>
                                <td colSpan={7} className="p-4">
                                    <QueryErrorNotice
                                        message={t('ordersError')}
                                        onRetry={() => void refetchOrders()}
                                        isRetrying={isOrdersLoading}
                                    />
                                </td>
                            </tr>
                        )}

                        {isOrdersLoading && !ordersData && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-sm text-slate-400">
                                    {t('loadingOrders')}
                                </td>
                            </tr>
                        )}

                        {!isOrdersLoading && !isOrdersError && clinicOrders.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-sm text-slate-400">
                                    {t('noOrders')}
                                </td>
                            </tr>
                        )}

                        {clinicOrders.map((order) => (
                            <tr
                                key={order.id}
                            className="transition hover:bg-violet-50/50"
                            >
                                <td className="p-4 font-mono text-sm text-slate-400">
                                    #{order.id}
                                </td>

                                <td className="p-4 font-bold text-slate-800">
                                    {order.patientName}
                                </td>

                                <td className="p-4 text-sm text-slate-600">
                                    {order.summaryWork}
                                </td>

                                <td className="p-4">
                                        <span
                                            className={`${getOrderStatusClass(order.isActive)} rounded-lg px-2 py-1 text-[10px] font-bold uppercase`}>
                                            {order.isActive ? t('active') : t('closed')}
                                        </span>
                                </td>

                                <td className="p-4 text-sm font-bold text-slate-700">
                                    {formatCurrency(order.totalAmount)}
                                </td>

                                <td className="p-4 text-sm font-bold text-green-600">
                                    {formatCurrency(order.paidAmount)}
                                </td>

                                <td className="p-4 text-right">
                                    <Link
                                        href={`/orders/${order.id}`}
                                        className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white"
                                    >
                                        {t('openOrder')}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <EditClinicModal
                isOpen={isEditModalOpen}
                clinic={clinic}
                onClose={() => setIsEditModalOpen(false)}
            />

            <DeleteClinicApproval
                clinicId={id}
                isOpen={isApproveModalOpen}
                onClose={() => setIsApproveModalOpen(false)}
            />
        </div>
    );
}
