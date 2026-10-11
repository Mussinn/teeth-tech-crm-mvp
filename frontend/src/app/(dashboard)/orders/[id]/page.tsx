'use client';

import {useMemo, useState} from 'react';
import LaboratoryCasePanel from '@/src/components/laboratory/LaboratoryCasePanel';
import {useParams, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {useSelector} from 'react-redux';
import TaskDetailsSidebar from '@/src/components/layout/TaskDetailsSidebar';
import TaskAssignmentModal from '@/src/components/Modals/TaskAssignmentModal';
import MaterialChips from '@/src/components/tasks/MaterialChips';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import TaskMaterialTransitionModal from '@/src/components/tasks/TaskMaterialTransitionModal';
import {RootState} from '@/src/lib/store';
import type {Task} from '@/src/types/task.types';
import type {OrderApiListItem, OrderDetails, OrderKanbanColumn, OrderKanbanTask} from '@/src/types/order.types';
import type {User} from '@/src/types/user.types';
import type {WorkflowStatus} from '@/src/types/workflow.types';
import ErrorState from '@/src/components/ui/ErrorState';
import {
    useAssignTaskMutation,
    useGetOrderKanbanQuery,
    useGetOrderDetailsQuery,
    useGetTaskAssignmentQuery,
    useUpdateTaskStatusMutation,
} from '@/src/services/api/ordersApi';
import {useGetUsersQuery} from '@/src/services/api/usersApi';
import {useGetWorkflowStatusesQuery} from '@/src/services/api/workflowApi';
import {useNotifications} from '@/src/features/notifications/useNotifications';
import {getApiErrorMessage} from '@/src/services/apiNotifications';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';
import {isWorkDirectionAccessError} from '@/src/utils/workDirections';
import {normalizeAuthRoles} from '@/src/features/auth/authUtils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPOSITE_NOTIFICATION = { error: false, success: false } as const;
const REVIEW_STATUS_CODE = 'WAITING_FOR_APPROVAL';
const CLOSED_STATUS_CODE = 'ORDER_CLOSED';

function isUuid(value: string | null | undefined) {
    return Boolean(value && UUID_PATTERN.test(value));
}

type ServerOrderInfo = OrderApiListItem | OrderDetails;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getNameValue(value: unknown) {
    if (typeof value === 'string') return value;

    if (!isRecord(value)) return '';

    const name = value.name ?? value.fullName;

    return typeof name === 'string' ? name : '';
}

function getStringValue(source: unknown, keys: string[]) {
    if (!isRecord(source)) return '';

    for (const key of keys) {
        const value = source[key];
        const nameValue = getNameValue(value);

        if (nameValue) return nameValue;
    }

    return '';
}

function getNumberValue(source: unknown, keys: string[]) {
    if (!isRecord(source)) return 0;

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const numericValue = Number(value);

            if (Number.isFinite(numericValue)) {
                return numericValue;
            }
        }
    }

    return 0;
}

function collectUnique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function getOrderDetailTasks(order?: ServerOrderInfo) {
    if (!isRecord(order) || !Array.isArray(order.tasks)) return [];

    return order.tasks.filter(isRecord) as unknown as OrderKanbanTask[];
}

function getColumnsTasks(columns: OrderKanbanColumn[]) {
    return columns.flatMap((column) => column.tasks);
}

function isCompletedTask(task: OrderKanbanTask, closedStatus: WorkflowStatus) {
    return task.isCompleted === true
        || task.currentStatusId === closedStatus.id
        || task.currentStatusCode?.trim().toUpperCase() === closedStatus.code;
}

function isCompletedColumn(column: OrderKanbanColumn, closedStatus: WorkflowStatus) {
    const closedValues = [closedStatus.code, closedStatus.name].map(normalizeStageValue);
    const columnValues = [column.statusName, column.title].map(normalizeStageValue);

    return column.statusId === closedStatus.id
        || columnValues.some((value) => closedValues.includes(value));
}

function buildOrderKanbanColumns(
    columns: OrderKanbanColumn[],
    order: ServerOrderInfo | undefined,
    closedStatus: WorkflowStatus | undefined
) {
    if (!closedStatus) return columns;

    const completedTasksById = new Map<string, OrderKanbanTask>();

    for (const task of getOrderDetailTasks(order)) {
        if (isCompletedTask(task, closedStatus)) {
            completedTasksById.set(task.id, task);
        }
    }

    for (const task of getColumnsTasks(columns)) {
        if (isCompletedTask(task, closedStatus)) {
            completedTasksById.set(task.id, task);
        }
    }

    const activeColumns = columns
        .filter((column) => !isCompletedColumn(column, closedStatus))
        .map((column) => {
            const tasks = column.tasks.filter((task) => !isCompletedTask(task, closedStatus));

            return {
                ...column,
                taskCount: tasks.length,
                tasks,
            };
        });
    const completedTasks = Array.from(completedTasksById.values());

    return [
        ...activeColumns,
        {
            statusId: closedStatus.id,
            statusName: closedStatus.name,
            title: closedStatus.name,
            taskCount: completedTasks.length,
            tasks: completedTasks,
        },
    ];
}

function getTaskColor(task: OrderKanbanTask) {
    return task.colorCode || getStringValue(task, ['colorName', 'color']);
}

const orderColumnThemes = [
    { border: 'border-slate-300', dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700', glow: 'from-slate-500/10' },
    { border: 'border-blue-300', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700', glow: 'from-blue-500/10' },
    { border: 'border-cyan-300', dot: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700', glow: 'from-cyan-500/10' },
    { border: 'border-amber-300', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', glow: 'from-amber-500/10' },
    { border: 'border-violet-300', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700', glow: 'from-violet-500/10' },
    { border: 'border-emerald-300', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', glow: 'from-emerald-500/10' },
];

function getOrderColumnTheme(index: number) {
    return orderColumnThemes[index % orderColumnThemes.length];
}

function normalizeStageValue(value: string | undefined | null) {
    return (value ?? '').toLowerCase().replace(/[-_/]+/g, ' ').trim();
}

function isNewTaskStage(column: OrderKanbanColumn, task: OrderKanbanTask) {
    void column;
    const statusCode = task.currentStatusCode?.trim().toUpperCase();
    return statusCode === 'TODO' || statusCode === 'NEW_TASK';
}

function isReviewTaskStage(task: OrderKanbanTask) {
    return task.currentStatusCode?.trim().toUpperCase() === REVIEW_STATUS_CODE;
}

function CompleteTaskButton({
    task,
    closedStatusId,
    isClosedStatusLoading,
}: {
    task: OrderKanbanTask;
    closedStatusId?: string;
    isClosedStatusLoading: boolean;
}) {
    const t = useTranslations('orders.taskActions');
    const [isOpen, setIsOpen] = useState(false);
    const isTransitionAllowed = Boolean(
        closedStatusId && task.allowedNextStatusIds?.includes(closedStatusId)
    );

    if (isClosedStatusLoading) {
        return (
            <button
                type="button"
                disabled
                className="w-full cursor-wait rounded-lg bg-slate-200 px-3 py-2.5 text-xs font-black text-slate-500"
            >
                {t('checkingCompletion')}
            </button>
        );
    }

    if (!closedStatusId || !isTransitionAllowed) {
        return (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-[10px] font-bold text-amber-700">
                {t('completionUnavailable')}
            </p>
        );
    }

    return <>
        <button type="button" onClick={() => setIsOpen(true)} className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-700">{t('complete')}</button>
        {isOpen && closedStatusId ? <TaskMaterialTransitionModal taskId={task.id} nextStatusId={closedStatusId} defaultComment={t('finalCheckComment')} onClose={() => setIsOpen(false)} /> : null}
    </>;
}

function StartTaskButton({
    orderId,
    task,
    nextColumnStatusId,
    nextColumnStatusName,
    onConfigureAssignments,
}: {
    orderId: string;
    task: OrderKanbanTask;
    nextColumnStatusId?: string;
    nextColumnStatusName?: string;
    onConfigureAssignments: () => void;
}) {
    const t = useTranslations('orders.taskActions');
    const tCommon = useTranslations('common.actions');
    const {notifyError, notifySuccess} = useNotifications();
    const [hasAssignedForStart, setHasAssignedForStart] = useState(false);
    const {
        data: assignment,
        isFetching: isAssignmentFetching,
        isError: isAssignmentError,
        refetch,
    } = useGetTaskAssignmentQuery(task.id);
    const [assignTask, { isLoading: isAssigning }] = useAssignTaskMutation();
    const [updateTaskStatus, { isLoading: isUpdatingStatus }] = useUpdateTaskStatusMutation();
    const nextColumnAssignee = assignment?.statusAssignees.find((assignee) => {
        const expectedName = normalizeStageValue(nextColumnStatusName);
        return Boolean(expectedName) && [assignee.statusName, assignee.statusCode]
            .map(normalizeStageValue)
            .includes(expectedName);
    });
    const fallbackAssignee = nextColumnAssignee ?? assignment?.statusAssignees[0];
    const nextStatusId = task.allowedNextStatusIds?.[0]
        || nextColumnStatusId
        || fallbackAssignee?.statusId
        || '';
    const nextAssignee = assignment?.statusAssignees.find(
        (assignee) => assignee.statusId === nextStatusId
    ) ?? (!task.allowedNextStatusIds?.length && !nextColumnStatusId ? fallbackAssignee : undefined);
    const isAutoAssignment = assignment?.assignmentMode === 'AUTO';
    const isStarting = isAssigning || isUpdatingStatus;

    const handleStart = async () => {
        if (!nextStatusId || (!isAutoAssignment && !nextAssignee?.userId)) return;

        let isAssigned = hasAssignedForStart;

        try {
            if (!isAutoAssignment && !isAssigned && nextAssignee?.userId) {
                await assignTask({
                    taskId: task.id,
                    userId: nextAssignee.userId,
                    orderId,
                    notification: COMPOSITE_NOTIFICATION,
                }).unwrap();
                isAssigned = true;
                setHasAssignedForStart(true);
            }

            await updateTaskStatus({
                taskId: task.id,
                body: {
                    nextStatusId,
                    comment: t('startComment'),
                },
                notification: COMPOSITE_NOTIFICATION,
            }).unwrap();
            setHasAssignedForStart(false);
            notifySuccess(t('start'));
        } catch (error) {
            console.error('Task start failed:', error);
            notifyError(
                !isAutoAssignment && isAssigned
                    ? t('assignmentWarning')
                    : getApiErrorMessage(
                        error,
                        isAutoAssignment ? 'updateTaskStatus' : 'assignTask'
                    ),
                {duration: !isAutoAssignment && isAssigned ? 9000 : undefined}
            );
        }
    };

    if (isAssignmentFetching) {
        return (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-center text-[10px] font-bold text-blue-600">
                {t('checkingAssignee')}
            </p>
        );
    }

    if (isAssignmentError) {
        return (
            <button
                type="button"
                onClick={() => void refetch()}
                className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
                {t('assignmentLoadError')} · {tCommon('retry')}
            </button>
        );
    }

    if (!nextStatusId) {
        return (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-[10px] font-bold text-slate-500">
                {t('nextStageUnavailable')}
            </p>
        );
    }

    if (!isAutoAssignment && !nextAssignee?.userId) {
        return (
            <button
                type="button"
                onClick={onConfigureAssignments}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
            >
                {t('chooseAssignee')}
            </button>
        );
    }

    return (
        <div className="space-y-1.5">
            <button
                type="button"
                disabled={isStarting}
                onClick={() => void handleStart()}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
                {isStarting ? t('starting') : t('start')}
            </button>
            <p className="truncate text-center text-[10px] font-semibold text-slate-500">
                {isAutoAssignment
                    ? t('autoAssignHint')
                    : t('nextAssignee', {name: nextAssignee?.userFullName || nextAssignee?.userId || '—'})}
            </p>
        </div>
    );
}

function mapOrderKanbanTaskToDetailsTask(task: OrderKanbanTask, order?: ServerOrderInfo): Task {
    const quantity = Number(task.quantity || 0);
    const total = Number(task.totalAmount ?? task.totalPrice ?? 0);

    return {
        id: task.id,
        orderId: task.orderId,
        title: task.workTypeName || task.taskNumber || task.workTypeCode || task.id,
        status: task.currentStatusFormName || task.currentStatusCode || '-',
        currentStatusId: task.currentStatusId,
        currentStatusCode: task.currentStatusCode,
        isCompleted: task.isCompleted,
        hasAccess: task.hasAccess,
        patient: getStringValue(order, ['patientFullName', 'patientName', 'patient']),
        deadline: getStringValue(order, ['deadline']),
        type: task.workTypeName || task.workTypeCode,
        workDirectionId: task.workDirectionId,
        workDirectionName: task.workDirectionName,
        workDirectionCode: task.workDirectionCode,
        material: (task.materialNames ?? []).join(', '),
        materialIds: task.materialIds,
        materialNames: task.materialNames,
        color: task.colorCode,
        taskType: task.taskType,
        technicianId: task.dentalTechnicianFullName || task.technician?.fullName || '',
        operatorId: task.cadCamOperatorFullName || task.operator?.fullName || '',
        units: quantity,
        unitPrice: Number(task.pricePerUnit ?? (quantity ? total / quantity : 0)),
        discount: 0,
    };
}

export default function OrderBoardPage() {
    const t = useTranslations('orders.details');
    const params = useParams<{ id: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const {role, roles} = useSelector((state: RootState) => state.auth);
    const normalizedRoles = normalizeAuthRoles(roles.length > 0 ? roles : role ? [role] : []);
    const canAssignTasks = normalizedRoles.some((userRole) => ['ADMIN', 'DISPATCHER'].includes(userRole));
    const {
        data: serverOrder,
        isLoading: isServerOrdersLoading,
        isFetching: isServerOrdersFetching,
        isError: isServerOrdersError,
        error: serverOrdersError,
        refetch: refetchServerOrders,
    } = useGetOrderDetailsQuery(id, {pollingInterval: 10000, skipPollingIfUnfocused: true, skip: !isUuid(id)});
    const {
        data: users = [],
        isLoading: isUsersLoading,
        isFetching: isUsersFetching,
        isError: isUsersError,
        refetch: refetchUsers,
    } = useGetUsersQuery(undefined, {skip: !isUuid(id)});
    const {
        data: workflowStatuses = [],
        isLoading: isWorkflowStatusesLoading,
        isFetching: isWorkflowStatusesFetching,
        isError: isWorkflowStatusesError,
        refetch: refetchWorkflowStatuses,
    } = useGetWorkflowStatusesQuery(undefined, {skip: !isUuid(id)});
    const closedStatus = workflowStatuses.find(
        (status) => status.code === CLOSED_STATUS_CODE
    );
    const canLoadServerKanban = isUuid(id);
    const {
        data: serverKanbanColumns,
        isLoading: isKanbanLoading,
        isFetching: isKanbanFetching,
        isError: isKanbanError,
        error: kanbanError,
        refetch: refetchKanban,
    } = useGetOrderKanbanQuery(
        {id},
        {pollingInterval: 10000, skipPollingIfUnfocused: true, skip: !canLoadServerKanban}
    );
    const isPageLoading = isServerOrdersLoading
        || isUsersLoading
        || isKanbanLoading
        || isWorkflowStatusesLoading;
    const hasOrderLoadError = isServerOrdersError && !serverKanbanColumns;
    const hasPageError = hasOrderLoadError
        || isUsersError
        || isKanbanError
        || isWorkflowStatusesError;
    const isDirectionForbidden = [serverOrdersError, kanbanError]
        .some(isWorkDirectionAccessError);
    const isPageRefetching = isServerOrdersFetching
        || isUsersFetching
        || isKanbanFetching
        || isWorkflowStatusesFetching;

    const handleRetryPage = () => {
        void refetchServerOrders();

        if (isUuid(id)) {
            void refetchUsers();
            void refetchWorkflowStatuses();
        }

        if (canLoadServerKanban) {
            void refetchKanban();
        }
    };

    if (isPageLoading) {
        return <div className="text-sm text-slate-500">{t('loading')}</div>;
    }

    if (isDirectionForbidden) {
        return (
            <ErrorState title={t('directionForbidden')}>
                {t('directionForbiddenHint')}
            </ErrorState>
        );
    }

    if (hasPageError) {
        return (
            <ErrorState
                title={t('loadFailed')}
                onRetry={handleRetryPage}
                isRetrying={isPageRefetching}
            >
                {t('unavailable')}
            </ErrorState>
        );
    }

    if (serverOrder || serverKanbanColumns) {
        return (
            <ServerKanbanBoard
                orderId={id}
                order={serverOrder}
                columns={serverKanbanColumns ?? []}
                users={users}
                isUsersLoading={isUsersLoading}
                canAssignTasks={canAssignTasks}
                closedStatus={closedStatus}
                isClosedStatusLoading={isWorkflowStatusesLoading}
            />
        );
    }

    return (
        <ErrorState title={t('notFound')}>
            <div className="space-y-4">
                <p>{t('notFoundHint')}</p>
                <Link
                    href="/orders"
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-600 hover:underline"
                >
                    ← {t('backToList')}
                </Link>
            </div>
        </ErrorState>
    );
}

function ServerKanbanBoard({
                               orderId,
                               order,
                               columns,
                               users,
                               isUsersLoading,
                               canAssignTasks,
                               closedStatus,
                               isClosedStatusLoading,
                           }: {
    orderId: string;
    order?: ServerOrderInfo;
    columns: OrderKanbanColumn[];
    users: User[];
    isUsersLoading: boolean;
    canAssignTasks: boolean;
    closedStatus?: WorkflowStatus;
    isClosedStatusLoading: boolean;
}) {
    const t = useTranslations('orders.details');
    const tStatuses = useTranslations('orders.statuses');
    const format = useAppFormatters();
    const searchParams = useSearchParams();
    const boardColumns = useMemo(
        () => buildOrderKanbanColumns(columns, order, closedStatus),
        [closedStatus, columns, order]
    );
    const taskCount = boardColumns.reduce((sum, column) => sum + column.taskCount, 0);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentModalTaskId, setAssignmentModalTaskId] = useState('');
    const allTasks = useMemo(() => Array.from(
        new Map(
            [...getOrderDetailTasks(order), ...getColumnsTasks(boardColumns)]
                .map((task) => [task.id, task] as const)
        ).values()
    ), [boardColumns, order]);
    const requestedTaskId = searchParams.get('taskId');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(requestedTaskId);
    const selectedTask = allTasks.find((task) => task.id === selectedTaskId) ?? null;
    const activeTaskCount = closedStatus
        ? new Set(
            allTasks
                .filter((task) => !isCompletedTask(task, closedStatus))
                .map((task) => task.id)
        ).size
        : 0;
    const displayActiveTaskCount = closedStatus ? activeTaskCount : allTasks.length;
    const completedTaskCount = Math.max(0, allTasks.length - displayActiveTaskCount);
    const completionShare = allTasks.length > 0
        ? Math.round((completedTaskCount / allTasks.length) * 100)
        : 0;
    const patientName = getStringValue(order, ['patientFullName', 'patientName', 'patient']);
    const clinicName = getStringValue(order, ['clinicName', 'clinic']);
    const doctorName = getStringValue(order, ['doctorFullName', 'doctorName', 'doctor']);
    const workTypeName = getStringValue(order, ['summaryWorkType', 'workTypeName', 'workType', 'work']);
    const quantity = getNumberValue(order, ['quantity']) || allTasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0);
    const totalPrice = getNumberValue(order, ['totalPrice', 'totalAmount']) || allTasks.reduce((sum, task) => sum + Number(task.totalAmount ?? task.totalPrice ?? 0), 0);
    const colors = collectUnique(allTasks.map(getTaskColor));
    const isActive = isRecord(order) && typeof order.isActive === 'boolean' ? order.isActive : true;
    const selectedDetailsTask = selectedTask
        ? mapOrderKanbanTaskToDetailsTask(selectedTask, order)
        : null;
    const openAssignmentModal = (taskId = '') => {
        setAssignmentModalTaskId(taskId);
        setIsAssignmentModalOpen(true);
    };
    const closeAssignmentModal = () => {
        setIsAssignmentModalOpen(false);
        setAssignmentModalTaskId('');
    };

    return (
        <>
            <div className="flex min-h-[calc(100dvh-8rem)] flex-col space-y-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <Link
                            href="/orders"
                            className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2 uppercase tracking-wider"
                        >
                            ← {t('backToList')}
                        </Link>
                        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                            {t('orderNumber', {number: order?.orderNumber ?? orderId})}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/orders/${orderId}/print`} className="rounded-xl border px-4 py-2 text-sm font-bold">Печатный наряд</Link>
                        <button
                            type="button"
                            onClick={() => openAssignmentModal()}
                            disabled={allTasks.length === 0}
                            className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-black text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                        >
                            {t('stageAssignees')}
                        </button>
                    </div>
                </header>

            <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500" />
                <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(280px,1.05fr)_minmax(0,1.8fr)] xl:items-stretch">
                    <div className="flex min-w-0 flex-col justify-between rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white shadow-lg shadow-violet-950/15">
                        <div className="flex items-center gap-4">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-black ring-1 ring-white/20">
                                {(patientName || t('patient')).trim().charAt(0).toLocaleUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">{t('patient')}</p>
                                <h2 className="mt-1 truncate text-xl font-black" title={patientName || '-'}>{patientName || '-'}</h2>
                            </div>
                        </div>
                        <div className="mt-6 grid gap-3 border-t border-white/15 pt-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                            <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-violet-200">{t('clinic')}</p><p className="mt-1 truncate text-xs font-bold" title={clinicName || '-'}>{clinicName || '-'}</p></div>
                            <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-violet-200">{t('doctor')}</p><p className="mt-1 truncate text-xs font-bold" title={doctorName || '-'}>{doctorName || '-'}</p></div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 xl:col-span-2 2xl:col-span-2">
                            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('workType')}</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><path d="M4 7h16M7 4v6m10-6v6M5 20h14a1 1 0 0 0 1-1V7H4v12a1 1 0 0 0 1 1Z" strokeWidth="1.8" strokeLinecap="round" /></svg></span></div>
                            <p className="mt-4 line-clamp-2 text-base font-bold text-slate-900" title={workTypeName || '-'}>{workTypeName || '-'}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('quantity')}</p>
                            <p className="mt-3 text-2xl font-black text-slate-950">{quantity}<span className="ml-1 text-xs font-semibold text-slate-400">{t('units')}</span></p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('color')}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {colors.length ? colors.map((color) => <span key={color} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">{color}</span>) : <span className="text-lg font-black text-slate-400">—</span>}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-2 xl:col-span-1 2xl:col-span-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('amount')}</p>
                            <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{format.currency(totalPrice)}</p>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-2 xl:col-span-1 2xl:col-span-2">
                            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('tasks')}</p><p className="mt-2 text-xl font-black text-slate-950">{taskCount}</p></div>
                            <div className="text-right"><p className="text-[10px] text-slate-400">{t('orderStatus')}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{isActive ? tStatuses('ACTIVE') : tStatuses('CLOSED')}</span></div>
                        </div>
                    </div>
                </div>
            </section>

            <LaboratoryCasePanel orderId={orderId}/>

            <div data-lab-tasks className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-bold text-slate-900">{t('route')}</h2>
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{t('stages', {count: boardColumns.length})}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{t('routeSubtitle')}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                        <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-slate-400">{t('total')}</p><p className="mt-0.5 text-sm font-black text-slate-900">{allTasks.length}</p></div>
                        <div className="rounded-xl bg-amber-50 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-amber-600">{t('inProgress')}</p><p className="mt-0.5 text-sm font-black text-amber-800">{displayActiveTaskCount}</p></div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-emerald-600">{t('completed')}</p><p className="mt-0.5 text-sm font-black text-emerald-800">{completedTaskCount}</p></div>
                        <div className="col-span-3 min-w-40 sm:ml-2">
                            <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-500"><span>{t('progress')}</span><span>{completionShare}%</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all" style={{width: `${completionShare}%`}} /></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto pb-8 pt-3">
                <div className="flex min-w-max snap-x snap-mandatory items-start gap-3 pb-2">
                {boardColumns.map((column, columnIndex) => {
                    const theme = getOrderColumnTheme(columnIndex);
                    return (
                    <section
                        key={`${column.statusName}-${column.title}`}
                        className={`flex max-h-[680px] min-h-[300px] w-[16.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-slate-50/60 shadow-sm dark:bg-slate-950/70 2xl:w-[17rem] ${theme.border}`}
                    >
                        <div className={`sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-br ${theme.glow} to-white p-3 backdrop-blur dark:border-slate-700 dark:to-slate-900`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className={`h-3 w-3 shrink-0 rounded-full shadow-sm ring-4 ring-white dark:ring-slate-800 ${theme.dot}`} />
                                    <h2 className="truncate text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        {column.title || column.statusName}
                                    </h2>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${theme.badge}`}>
                                    {column.taskCount}
                                </span>
                            </div>
                        </div>

                        <div className="min-h-[140px] flex-1 space-y-2.5 overflow-y-auto p-2.5">
                            {column.tasks.map((task) => (
                                <div key={task.id} className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className="group relative flex w-full flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-950/10 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-500"
                                    >
                                    <span className="absolute inset-y-0 left-0 w-1 bg-violet-500 opacity-0 transition group-hover:opacity-100" />
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="max-w-36 truncate rounded-md bg-violet-50 px-2 py-1 font-bold text-violet-700">
                                            {task.taskNumber ?? task.workTypeCode ?? task.id.slice(0, 8)}
                                        </span>
                                        <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-500">{task.quantity} {t('units')}</span>
                                    </div>

                                    <WorkDirectionBadge
                                        code={task.workDirectionCode}
                                        name={task.workDirectionName}
                                        className="self-start"
                                    />

                                    <div>
                                        <h3 className="text-sm font-bold leading-5 text-slate-900">
                                            {task.workTypeName}
                                        </h3>
                                        <div className="mt-1 space-y-1 text-[11px] text-slate-500">
                                            <MaterialChips materialNames={task.materialNames} compact />
                                            {task.colorCode ? <p>{t('color')} {task.colorCode}</p> : null}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-500">
                                        <div className="min-w-0 rounded-lg bg-slate-50 p-2">
                                            <p className="font-bold uppercase text-slate-400">{t('technician')}</p>
                                            <p className="truncate font-semibold text-slate-700" title={task.dentalTechnicianFullName || task.technician?.fullName || '-'}>
                                                {task.dentalTechnicianFullName || task.technician?.fullName || '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-0 rounded-lg bg-slate-50 p-2">
                                            <p className="font-bold uppercase text-slate-400">{t('status')}</p>
                                            <p className="truncate font-semibold text-slate-700" title={task.currentStatusFormName || task.currentStatusCode || task.operator?.fullName || '-'}>
                                                {task.currentStatusFormName || task.currentStatusCode || task.operator?.fullName || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                                        <span className="max-w-28 truncate text-[9px] text-slate-400" title={task.toothNumbers?.length ? t('teeth', {teeth: task.toothNumbers.join(', ')}) : t('teethMissing')}>
                                            {task.toothNumbers?.length ? t('teeth', {teeth: task.toothNumbers.join(', ')}) : t('teethMissing')}
                                        </span>
                                        <span className="text-xs font-black text-slate-800">
                                            {format.currency(task.totalAmount ?? task.totalPrice ?? 0)}
                                        </span>
                                    </div>
                                    </button>

                                    {canAssignTasks && isNewTaskStage(column, task) && (
                                        <StartTaskButton
                                            orderId={orderId}
                                            task={task}
                                            nextColumnStatusId={boardColumns[columnIndex + 1]?.statusId}
                                            nextColumnStatusName={
                                                boardColumns[columnIndex + 1]?.statusName
                                                || boardColumns[columnIndex + 1]?.title
                                            }
                                            onConfigureAssignments={() => openAssignmentModal(task.id)}
                                        />
                                    )}

                                    {canAssignTasks && isReviewTaskStage(task) && (
                                        <CompleteTaskButton
                                            task={task}
                                            closedStatusId={closedStatus?.id}
                                            isClosedStatusLoading={isClosedStatusLoading}
                                        />
                                    )}
                                </div>
                            ))}

                            {column.tasks.length === 0 && (
                                <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-500">
                                    {t('emptyStage')}
                                </div>
                            )}
                        </div>
                    </section>
                );})}
                </div>
            </div>
        </div>

        <TaskAssignmentModal
            key={assignmentModalTaskId || 'order-assignment'}
            isOpen={isAssignmentModalOpen}
            initialTaskId={assignmentModalTaskId}
            tasks={allTasks}
            users={users}
            isUsersLoading={isUsersLoading}
            canEdit={canAssignTasks}
            onClose={closeAssignmentModal}
        />

        <TaskDetailsSidebar
            task={selectedDetailsTask}
            onClose={() => setSelectedTaskId(null)}
        />
        </>
    );
}
