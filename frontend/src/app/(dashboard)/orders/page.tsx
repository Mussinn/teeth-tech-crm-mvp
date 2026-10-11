'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CreateOrderModal from '@/src/components/Modals/CreateOrderModal';
import type {
    CreateOrderDto,
    CreateOrderResponse,
    OrderApiListItem,
    OrderListItem,
} from '@/src/types/order.types';
import type { TaskFileAttachmentType } from '@/src/types/task.types';
import {
    useCreateOrderMutation,
    useDeleteOrderMutation,
    useGetOrdersQuery,
} from '@/src/services/api/ordersApi';
import {
    useAbortMultipartTaskFileUploadMutation,
    useCompleteMultipartTaskFileUploadMutation,
    useInitMultipartTaskFileUploadMutation,
    useUploadMultipartTaskFilePartMutation,
    useUploadTaskFileMutation,
} from '@/src/services/api/taskFilesApi';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import { getApiErrorMessage } from '@/src/services/apiNotifications';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';
import { useSelector } from 'react-redux';
import { useGetUsersQuery } from '@/src/services/api/usersApi';
import { normalizeAuthRoles } from '@/src/features/auth/authUtils';
import type { RootState } from '@/src/lib/store';
import { isWorkDirectionAccessError } from '@/src/utils/workDirections';

const DEFAULT_ORDER_SORT = 'deadline,ASC';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SIMPLE_UPLOAD_LIMIT = 10 * 1024 * 1024;
const MULTIPART_CHUNK_SIZE = SIMPLE_UPLOAD_LIMIT;
const COMPOSITE_NOTIFICATION = { error: false, success: false } as const;

type UploadTaskFileTrigger = ReturnType<typeof useUploadTaskFileMutation>[0];
type InitMultipartUploadTrigger = ReturnType<typeof useInitMultipartTaskFileUploadMutation>[0];
type UploadMultipartPartTrigger = ReturnType<typeof useUploadMultipartTaskFilePartMutation>[0];
type CompleteMultipartUploadTrigger = ReturnType<typeof useCompleteMultipartTaskFileUploadMutation>[0];
type AbortMultipartUploadTrigger = ReturnType<typeof useAbortMultipartTaskFileUploadMutation>[0];

function mapApiOrderToListItem(order: OrderApiListItem): OrderListItem {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        patient: order.patientFullName,
        doctor: order.doctorFullName ?? '',
        work: order.summaryWorkType,
        workType: order.summaryWorkType,
        status: order.isActive ? 'ACTIVE' : 'CLOSED',
        units: order.quantity,
        unitPrice: order.pricePerUnit,
        discount: order.discount,
        discountPercent: 0,
        total: order.totalPrice,
        paid: 0,
        unpaid: order.totalPrice,
        date: order.createdAt ?? order.deadline ?? '',
    };
}

function getStatusBadgeClass(status: string) {
    if (status === 'ACTIVE') {
        return 'bg-emerald-100 text-emerald-700';
    }

    return 'bg-slate-100 text-slate-600';
}

function stripOrderFiles(payload: CreateOrderDto): CreateOrderDto {
    return {
        ...payload,
        tasks: payload.tasks.map((task) => ({
            workDirectionId: task.workDirectionId,
            workTypeId: task.workTypeId,
            quantity: task.quantity,
            toothNumbers: task.toothNumbers,
            orderId: task.orderId,
            colorId: task.colorId,
            materialIds: task.materialIds,
            pricePerUnit: task.pricePerUnit,
            discount: task.discount,
            discountPercent: 0,
            assignmentMode: task.assignmentMode,
            statusAssignees: task.statusAssignees,
        })),
    };
}

async function uploadCreatedOrderFiles({
    payload,
    createdOrder,
    uploadTaskFile,
    initMultipartUpload,
    uploadMultipartPart,
    completeMultipartUpload,
    abortMultipartUpload,
}: {
    payload: CreateOrderDto;
    createdOrder: CreateOrderResponse;
    uploadTaskFile: UploadTaskFileTrigger;
    initMultipartUpload: InitMultipartUploadTrigger;
    uploadMultipartPart: UploadMultipartPartTrigger;
    completeMultipartUpload: CompleteMultipartUploadTrigger;
    abortMultipartUpload: AbortMultipartUploadTrigger;
}) {
    const hasFiles = payload.tasks.some(
        (task) => Boolean(task.images?.length || task.attachments?.length)
    );

    if (!hasFiles) return;

    const taskIds = createdOrder.taskIds ?? [];

    if (taskIds.length < payload.tasks.length) {
        throw new Error('Server did not return taskIds for every order task.');
    }

    for (let taskIndex = 0; taskIndex < payload.tasks.length; taskIndex += 1) {
        const task = payload.tasks[taskIndex];
        const taskId = taskIds[taskIndex];

        if (!taskId) continue;

        for (const image of task.images ?? []) {
            if (image.file) {
                await uploadOrderTaskFile({
                    taskId,
                    file: image.file,
                    type: 'SCREEN',
                    uploadTaskFile,
                    initMultipartUpload,
                    uploadMultipartPart,
                    completeMultipartUpload,
                    abortMultipartUpload,
                });
            }
        }

        for (const attachment of task.attachments ?? []) {
            if (attachment.file) {
                await uploadOrderTaskFile({
                    taskId,
                    file: attachment.file,
                    type: 'FILE',
                    uploadTaskFile,
                    initMultipartUpload,
                    uploadMultipartPart,
                    completeMultipartUpload,
                    abortMultipartUpload,
                });
            }
        }
    }
}

async function uploadOrderTaskFile({
    taskId,
    file,
    type,
    uploadTaskFile,
    initMultipartUpload,
    uploadMultipartPart,
    completeMultipartUpload,
    abortMultipartUpload,
}: {
    taskId: string;
    file: File;
    type: TaskFileAttachmentType;
    uploadTaskFile: UploadTaskFileTrigger;
    initMultipartUpload: InitMultipartUploadTrigger;
    uploadMultipartPart: UploadMultipartPartTrigger;
    completeMultipartUpload: CompleteMultipartUploadTrigger;
    abortMultipartUpload: AbortMultipartUploadTrigger;
}) {
    if (file.size < SIMPLE_UPLOAD_LIMIT) {
        await uploadTaskFile({
            taskId,
            file,
            type,
            notification: COMPOSITE_NOTIFICATION,
        }).unwrap();
        return;
    }

    const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
    let multipartFileId = '';

    try {
        const multipartUpload = await initMultipartUpload({
            taskId,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            totalParts,
            notification: COMPOSITE_NOTIFICATION,
        }).unwrap();

        multipartFileId = multipartUpload.fileId;

        for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
            const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
            const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            await uploadMultipartPart({
                taskId,
                fileId: multipartUpload.fileId,
                partNumber,
                file: chunk,
                fileName: file.name,
                notification: COMPOSITE_NOTIFICATION,
            }).unwrap();
        }

        await completeMultipartUpload({
            taskId,
            fileId: multipartUpload.fileId,
            notification: COMPOSITE_NOTIFICATION,
        }).unwrap();
    } catch (error) {
        if (multipartFileId) {
            await abortMultipartUpload({
                taskId,
                fileId: multipartFileId,
            }).unwrap().catch((abortError) => {
                console.warn('Multipart upload cleanup failed:', abortError);
            });
        }

        throw error;
    }
}

export default function OrdersPage() {
    const t = useTranslations('orders');
    const tCommon = useTranslations('common');
    const format = useAppFormatters();
    const formatMoney = (value?: number) => format.currency(value ?? 0);
    const getStatusLabel = (status: string) => (
        status === 'ACTIVE' ? t('statuses.ACTIVE') : t('statuses.CLOSED')
    );
    const { notifyError, notifySuccess } = useNotifications();
    const { id: currentUserId, role, roles } = useSelector((state: RootState) => state.auth);
    const normalizedRoles = normalizeAuthRoles(roles.length > 0 ? roles : role ? [role] : []);
    const isAdmin = normalizedRoles.includes('ADMIN');
    const isDispatcher = normalizedRoles.includes('DISPATCHER');
    const usersQuery = useGetUsersQuery(undefined, { skip: !isDispatcher || isAdmin });
    const currentUser = usersQuery.data?.find((user) => user.id === currentUserId);
    const dispatcherScopePending = isDispatcher && !isAdmin && (usersQuery.isLoading || usersQuery.isFetching);
    const dispatcherHasNoDirections = isDispatcher
        && !isAdmin
        && !dispatcherScopePending
        && !usersQuery.isError
        && (currentUser?.workDirections?.filter((direction) => direction.active).length ?? 0) === 0;
    const [createOrder, { isLoading: isCreatingOrder }] = useCreateOrderMutation();
    const [deleteOrder, { isLoading: isDeletingOrder }] = useDeleteOrderMutation();
    const [uploadTaskFile] = useUploadTaskFileMutation();
    const [initMultipartUpload] = useInitMultipartTaskFileUploadMutation();
    const [uploadMultipartPart] = useUploadMultipartTaskFilePartMutation();
    const [completeMultipartUpload] = useCompleteMultipartTaskFileUploadMutation();
    const [abortMultipartUpload] = useAbortMultipartTaskFileUploadMutation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<OrderListItem | null>(null);
    const [isUploadingOrderFiles, setIsUploadingOrderFiles] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
    const [sort, setSort] = useState(DEFAULT_ORDER_SORT);
    const {
        data: ordersPage,
        isFetching: isOrdersLoading,
        isError: isOrdersError,
        error: ordersError,
        refetch: refetchOrders,
    } = useGetOrdersQuery({
        page,
        size,
        sort,
    }, { pollingInterval: 10000, skipPollingIfUnfocused: true, skip: dispatcherScopePending || dispatcherHasNoDirections || usersQuery.isError });

    const orders = useMemo(
        () => ordersPage?.content.map(mapApiOrderToListItem) ?? [],
        [ordersPage]
    );

    const statuses = Array.from(new Set(orders.map((order) => order.status)));

    const filteredOrders = orders.filter((order) => {
        const searchValue = search.toLowerCase();

        const matchesSearch =
            order.id.toLowerCase().includes(searchValue) ||
            (order.orderNumber ?? '').toLowerCase().includes(searchValue) ||
            order.patient.toLowerCase().includes(searchValue) ||
            (order.work ?? order.workType ?? '').toLowerCase().includes(searchValue) ||
            getStatusLabel(order.status).toLowerCase().includes(searchValue);

        const matchesStatus =
            statusFilter === 'all' || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const activeOrdersCount = orders.filter((order) => order.status === 'ACTIVE').length;
    const pageUnitsCount = orders.reduce((sum, order) => sum + (order.units ?? 0), 0);
    const pageTotal = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setSort(DEFAULT_ORDER_SORT);
        setSize(DEFAULT_PAGE_SIZE);
        setPage(0);
    };

    const handleSizeChange = (nextSize: number) => {
        setSize(nextSize);
        setPage(0);
    };

    const handleSortChange = (nextSort: string) => {
        setSort(nextSort);
        setPage(0);
    };

    const handleCreateOrder = async (payload: CreateOrderDto) => {
        let createdOrder: CreateOrderResponse;

        try {
            createdOrder = await createOrder({
                ...stripOrderFiles(payload),
                notification: COMPOSITE_NOTIFICATION,
            }).unwrap();
        } catch (error) {
            notifyError(getApiErrorMessage(error, 'createOrder'));
            throw error;
        }

        const fileCount = payload.tasks.reduce(
            (count, task) => count + (task.images?.length ?? 0) + (task.attachments?.length ?? 0),
            0
        );

        setIsUploadingOrderFiles(true);

        try {
            await uploadCreatedOrderFiles({
                payload,
                createdOrder,
                uploadTaskFile,
                initMultipartUpload,
                uploadMultipartPart,
                completeMultipartUpload,
                abortMultipartUpload,
            });
            notifySuccess(
                fileCount > 0
                    ? t('notifications.createdWithFiles')
                    : t('notifications.created')
            );
        } catch (error) {
            console.error('Order file upload failed:', error);
            notifyError(
                t('notifications.partialUpload'),
                { duration: 9000 }
            );
        } finally {
            setIsUploadingOrderFiles(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!orderToDelete) return;
        try {
            await deleteOrder(orderToDelete.id).unwrap();
            setOrderToDelete(null);
        } catch (error) {
            console.error('Order deletion failed:', error);
        }
    };

    if (dispatcherScopePending) {
        return <div className="text-sm text-slate-500">{t('list.loading')}</div>;
    }

    if (dispatcherHasNoDirections) {
        return (
            <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                <h1 className="text-lg font-black text-amber-900">{t('list.noAssignedDirections')}</h1>
                <p className="mt-2 text-sm text-amber-800">{t('list.noAssignedDirectionsHint')}</p>
            </section>
        );
    }

    const isDirectionForbidden = isWorkDirectionAccessError(ordersError);

    return (
        <div className="relative mx-auto max-w-[1600px] space-y-5 pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t('list.title')}</h1>
                    <p className="mt-1 text-sm text-slate-500">{t('list.subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    data-tour="orders-create"
                    className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/15 transition-all hover:bg-violet-700 active:scale-95 sm:w-auto"
                >
                    + {t('list.create')}
                </button>
            </div>

            {isDirectionForbidden && (
                <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {t('details.directionForbidden')}
                </section>
            )}

            {isOrdersError && !isDirectionForbidden && (
                <QueryErrorNotice
                    message={t('list.loadError')}
                    onRetry={() => void refetchOrders()}
                    isRetrying={isOrdersLoading}
                />
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: t('list.metrics.total'), value: ordersPage?.totalElements ?? orders.length, note: t('list.metrics.registry'), color: 'bg-violet-500' },
                    { label: t('list.metrics.active'), value: activeOrdersCount, note: t('list.metrics.page'), color: 'bg-emerald-500' },
                    { label: t('list.metrics.units'), value: pageUnitsCount, note: t('list.metrics.page'), color: 'bg-blue-500' },
                    { label: t('list.metrics.amount'), value: formatMoney(pageTotal), note: t('list.metrics.page'), color: 'bg-amber-500' },
                ].map((metric) => (
                    <article key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/5 sm:p-5">
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{metric.label}</p><span className={`h-2.5 w-2.5 rounded-full ${metric.color}`} /></div>
                        <p className="mt-5 truncate text-2xl font-black tracking-tight text-slate-950" title={String(metric.value)}>{metric.value}</p>
                        <p className="mt-2 text-[11px] text-slate-400">{metric.note}</p>
                    </article>
                ))}
            </section>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('list.filters.searchPlaceholder')}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 md:col-span-2"
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    >
                        <option value="all">{t('list.filters.allStatuses')}</option>
                        {statuses.map((status) => (
                            <option key={status} value={status}>
                                {getStatusLabel(status)}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sort}
                        onChange={(e) => handleSortChange(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    >
                        <option value="deadline,ASC">{t('list.filters.deadlineAsc')}</option>
                        <option value="deadline,DESC">{t('list.filters.deadlineDesc')}</option>
                    </select>

                    <select
                        value={size}
                        onChange={(e) => handleSizeChange(Number(e.target.value))}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    >
                        {PAGE_SIZE_OPTIONS.map((pageSize) => (
                            <option key={pageSize} value={pageSize}>
                                {t('list.filters.perPage', {count: pageSize})}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                        {t('list.pageSummary', {count: filteredOrders.length})}
                        {ordersPage && (
                            <span className="text-slate-400">{t('list.pageTotal', {count: ordersPage.numberOfElements})}</span>
                        )}
                        {isOrdersLoading && <span className="ml-2 text-blue-600">{t('list.loading')}</span>}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={resetFilters}
                            className="min-h-11 rounded-lg px-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-blue-600"
                        >
                            {t('list.filters.reset')}
                        </button>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <button
                                type="button"
                                disabled={isOrdersLoading || !ordersPage || ordersPage.first}
                                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
                                className="min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {tCommon('pagination.previous')}
                            </button>
                            <span className="min-w-20 text-center">
                                {t('list.pageNumber', {page: (ordersPage?.number ?? page) + 1})}
                                {ordersPage?.totalPages ? t('list.pageCount', {count: ordersPage.totalPages}) : ''}
                            </span>
                            <button
                                type="button"
                                disabled={isOrdersLoading || !ordersPage || ordersPage.last}
                                onClick={() => setPage((currentPage) => currentPage + 1)}
                                className="min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {tCommon('pagination.next')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="space-y-3 p-3 md:hidden">
                    {isOrdersLoading && !ordersPage && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                            {t('list.loading')}
                        </div>
                    )}

                    {filteredOrders.map((order) => (
                        <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-mono text-xs text-slate-400" title={`#${order.orderNumber ?? order.id}`}>
                                        #{order.orderNumber ?? order.id}
                                    </p>
                                    <h2 className="mt-1 break-words text-base font-black text-slate-900">
                                        {order.patient}
                                    </h2>
                                </div>
                                <span className={`${getStatusBadgeClass(order.status)} max-w-[45%] shrink-0 break-words rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase`}>
                                    {getStatusLabel(order.status)}
                                </span>
                            </div>

                            <p className="mt-3 break-words text-sm text-slate-600">{order.work}</p>

                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-2.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('list.fields.quantity')}</dt>
                                    <dd className="mt-1 font-black text-slate-800">{order.units}</dd>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('list.fields.total')}</dt>
                                    <dd className="mt-1 truncate font-black text-slate-800" title={formatMoney(order.total)}>{formatMoney(order.total)}</dd>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('list.fields.unitPrice')}</dt>
                                    <dd className="mt-1 truncate font-semibold text-slate-700" title={formatMoney(order.unitPrice)}>{formatMoney(order.unitPrice)}</dd>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('list.fields.discount')}</dt>
                                    <dd className="mt-1 truncate font-semibold text-slate-700" title={formatMoney(order.discount)}>{formatMoney(order.discount)}</dd>
                                </div>
                            </dl>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <Link
                                    href={`/orders/${order.id}`}
                                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-3 text-sm font-bold text-white"
                                >
                                    {tCommon('actions.open')}
                                </Link>
                                <button
                                    type="button"
                                    disabled={isDeletingOrder}
                                    onClick={() => setOrderToDelete(order)}
                                    className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon('actions.delete')}
                                </button>
                            </div>
                        </article>
                    ))}

                    {!isOrdersLoading && filteredOrders.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                            {t('list.empty')}
                        </div>
                    )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[860px] border-collapse text-left lg:min-w-[980px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-widest">
                        <tr>
                            <th className="p-4 font-bold">ID</th>
                            <th className="p-4 font-bold">{t('list.fields.patient')}</th>
                            <th className="p-4 font-bold">{t('list.fields.workType')}</th>
                            <th className="p-4 font-bold">{t('list.fields.status')}</th>
                            <th className="p-4 font-bold">{t('list.fields.quantityShort')}</th>
                            <th className="p-4 font-bold">{t('list.fields.unitPrice')}</th>
                            <th className="p-4 font-bold">{t('list.fields.discount')}</th>
                            <th className="p-4 font-bold">{t('list.fields.total')}</th>
                            <th className="p-4 font-bold text-right">{t('list.fields.actions')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {isOrdersLoading && !ordersPage && (
                            <tr>
                                <td colSpan={9} className="p-10 text-center text-sm text-slate-400">
                                    {t('list.loading')}
                                </td>
                            </tr>
                        )}

                        {filteredOrders.map((order) => (
                            <tr key={order.id} className="group transition hover:bg-violet-50/50">
                                <td className="p-4 text-sm font-mono text-slate-400">
                                    #{order.orderNumber ?? order.id}
                                </td>
                                <td className="p-4 text-sm font-bold text-slate-800">{order.patient}</td>
                                <td className="p-4 text-sm text-slate-600">{order.work}</td>
                                <td className="p-4">
                                    <span className={`${getStatusBadgeClass(order.status)} px-2 py-1 rounded-md text-[10px] font-bold uppercase`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </td>
                                <td className="p-4 text-sm">{order.units}</td>
                                <td className="p-4 text-sm">{formatMoney(order.unitPrice)}</td>
                                <td className="p-4 text-sm">{formatMoney(order.discount)}</td>
                                <td className="p-4 text-sm font-bold">{formatMoney(order.total)}</td>
                                <td className="p-4">
                                    <div className="flex justify-end gap-2">
                                        <Link
                                            href={`/orders/${order.id}`}
                                            className="rounded-lg border border-violet-500 px-3 py-1.5 text-xs font-bold text-violet-600 transition hover:bg-violet-600 hover:text-white"
                                        >
                                            {tCommon('actions.open')}
                                        </Link>
                                        <button
                                            type="button"
                                            disabled={isDeletingOrder}
                                            onClick={() => setOrderToDelete(order)}
                                            className="text-red-600 hover:bg-red-600 hover:text-white border border-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {tCommon('actions.delete')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {!isOrdersLoading && filteredOrders.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-10 text-center text-sm text-slate-400">
                                    {t('list.empty')}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateOrderModal
                isOpen={isModalOpen}
                isSubmitting={isCreatingOrder || isUploadingOrderFiles}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleCreateOrder}
            />
            <ConfirmDialog
                open={orderToDelete !== null}
                title={t('list.deleteTitle')}
                description={t('list.deleteDescription', {
                    number: orderToDelete?.orderNumber ?? orderToDelete?.id ?? '',
                    patient: orderToDelete?.patient ? ` · ${orderToDelete.patient}` : '',
                })}
                confirmLabel={t('list.deleteConfirm')}
                isLoading={isDeletingOrder}
                onClose={() => setOrderToDelete(null)}
                onConfirm={handleDeleteOrder}
            />
        </div>
    );
}
