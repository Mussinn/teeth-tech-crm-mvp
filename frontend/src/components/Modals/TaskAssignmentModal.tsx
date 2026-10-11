'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import {
    useGetTaskAssignmentQuery,
    useUpdateTaskAssignmentMutation,
} from '@/src/services/api/ordersApi';
import { useGetWorkTypesQuery } from '@/src/services/api/laboratory/workTypesApi';
import { useGetAdminWorkflowStepsQuery } from '@/src/services/api/workflowApi';
import { getDisplayRoleNames } from '@/src/features/auth/authUtils';
import type { OrderKanbanTask } from '@/src/types/order.types';
import type {
    TaskAssignment,
    TaskAssignmentMode,
    TaskStatusAssigneeRequest,
} from '@/src/types/task.types';
import type { User } from '@/src/types/user.types';
import type { WorkflowStep } from '@/src/types/workflow.types';

type TaskAssignmentModalProps = {
    isOpen: boolean;
    initialTaskId?: string;
    tasks: OrderKanbanTask[];
    users: User[];
    isUsersLoading: boolean;
    canEdit: boolean;
    onClose: () => void;
};

type AssignmentStage = {
    statusId: string;
    statusCode?: string;
    statusName: string;
    requiredRole: string;
    isFinalReviewStage: boolean;
};

function normalizeRoleValue(value: string | undefined | null) {
    return (value ?? '')
        .toLowerCase()
        .replace(/[-_/]+/g, ' ')
        .replace(/^role\s+/u, '')
        .trim();
}

function normalizeName(value: string | undefined | null) {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getUserRoleValues(user: User) {
    return [
        user.role,
        ...(user.roles ?? []),
        user.specialization,
    ].filter((value): value is string => Boolean(value));
}

function getUserLabel(user: User) {
    const roles = getDisplayRoleNames(getUserRoleValues(user)).join(' / ');
    return roles ? `${user.fullName} (${roles})` : user.fullName;
}

function isAdministrator(user: User) {
    return getUserRoleValues(user).some(
        (role) => normalizeRoleValue(role) === 'admin'
    );
}

function getEligibleUsers(
    users: User[],
    requiredRole: string,
    isFinalReviewStage: boolean
) {
    const activeUsers = users.filter((user) => user.status === 'ACTIVE');
    const normalizedRequiredRole = normalizeRoleValue(requiredRole);
    // An administrator may only perform management actions (start, review,
    // complete), never a production-stage assignment—even if they hold a
    // second production role.
    const eligibleStageUsers = isFinalReviewStage
        ? activeUsers
        : activeUsers.filter((user) => !isAdministrator(user));

    if (normalizedRequiredRole.includes('admin') || normalizedRequiredRole.includes('dispatcher')) {
        return eligibleStageUsers.filter((user) =>
            getUserRoleValues(user).some((role) => {
                const normalizedUserRole = normalizeRoleValue(role);
                return normalizedUserRole === 'admin' || normalizedUserRole === 'dispatcher';
            })
        );
    }

    if (!normalizedRequiredRole) return eligibleStageUsers;

    return eligibleStageUsers.filter((user) =>
        getUserRoleValues(user).some((role) => {
            const normalizedUserRole = normalizeRoleValue(role);
            return normalizedUserRole === normalizedRequiredRole
                || normalizedUserRole.includes(normalizedRequiredRole)
                || normalizedRequiredRole.includes(normalizedUserRole);
        })
    );
}

function getWorkflowAssignmentStages(steps: WorkflowStep[]): AssignmentStage[] {
    const sortedSteps = [...steps].sort((left, right) => left.sortOrder - right.sortOrder);
    const finalSortOrder = sortedSteps.at(-1)?.sortOrder;
    const destinationStatusIds = new Set(sortedSteps.map((step) => step.toStatusId));
    const initialStatusId = sortedSteps.find(
        (step) => !destinationStatusIds.has(step.fromStatusId)
    )?.fromStatusId ?? sortedSteps[0]?.fromStatusId;
    const seenStatusIds = new Set<string>();

    return sortedSteps
        .filter((step) => {
            if (step.fromStatusId === initialStatusId || seenStatusIds.has(step.fromStatusId)) {
                return false;
            }

            seenStatusIds.add(step.fromStatusId);
            return true;
        })
        .map((step) => ({
            statusId: step.fromStatusId,
            statusName: step.fromStatusName,
            requiredRole: step.requiredRole,
            isFinalReviewStage: step.sortOrder === finalSortOrder,
        }));
}

function getAssignmentStages(steps: WorkflowStep[], assignment?: TaskAssignment) {
    const stages = getWorkflowAssignmentStages(steps);
    const knownStatusIds = new Set(stages.map((stage) => stage.statusId));
    const destinationStatusIds = new Set(steps.map((step) => step.toStatusId));
    const initialStatusId = steps.find(
        (step) => !destinationStatusIds.has(step.fromStatusId)
    )?.fromStatusId;

    for (const assignee of assignment?.statusAssignees ?? []) {
        if (assignee.statusId === initialStatusId || assignee.statusCode?.toUpperCase() === 'TODO') {
            continue;
        }

        if (!knownStatusIds.has(assignee.statusId)) {
            stages.push({
                statusId: assignee.statusId,
                statusCode: assignee.statusCode,
                statusName: assignee.statusName,
                requiredRole: '',
                isFinalReviewStage: false,
            });
        }
    }

    return stages;
}

function getUniqueTasks(tasks: OrderKanbanTask[]) {
    return Array.from(new Map(tasks.map((task) => [task.id, task])).values());
}

function getTaskLabel(task: OrderKanbanTask, fallback: string) {
    const number = task.taskNumber || task.id.slice(0, 8);
    return `${number} · ${task.workTypeName || task.workTypeCode || fallback}`;
}

function TaskAssignmentEditor({
    task,
    users,
    isUsersLoading,
    canEdit,
}: {
    task: OrderKanbanTask;
    users: User[];
    isUsersLoading: boolean;
    canEdit: boolean;
}) {
    const t = useTranslations('tasks.assignment');
    const commonT = useTranslations('common');
    const {
        data: assignment,
        isFetching: isAssignmentFetching,
        isError: isAssignmentError,
        refetch,
    } = useGetTaskAssignmentQuery(task.id);
    const {
        data: workTypes = [],
        isFetching: isWorkTypesFetching,
        isError: isWorkTypesError,
        refetch: refetchWorkTypes,
    } = useGetWorkTypesQuery(undefined, { skip: Boolean(task.workTypeId) });
    const workTypeId = task.workTypeId
        || workTypes.find((workType) =>
            normalizeName(workType.name) === normalizeName(task.workTypeName)
        )?.id
        || '';
    const {
        data: workflowSteps = [],
        isFetching: isWorkflowFetching,
        isError: isWorkflowError,
        refetch: refetchWorkflow,
    } = useGetAdminWorkflowStepsQuery(
        { workTypeId },
        { skip: !workTypeId }
    );
    const [updateTaskAssignment, { isLoading: isSaving }] = useUpdateTaskAssignmentMutation();
    const [draftMode, setDraftMode] = useState<TaskAssignmentMode | null>(null);
    const [draftAssignees, setDraftAssignees] = useState<TaskStatusAssigneeRequest[] | null>(null);
    const assignmentMode = draftMode ?? assignment?.assignmentMode ?? 'AUTO';
    const statusAssignees = draftAssignees ?? assignment?.statusAssignees.map((assignee) => ({
        statusId: assignee.statusId,
        userId: assignee.userId,
    })) ?? [];
    const stages = useMemo(
        () => getAssignmentStages(workflowSteps, assignment),
        [assignment, workflowSteps]
    );
    const assigneeByStatus = new Map(
        statusAssignees.map((assignee) => [assignee.statusId, assignee.userId])
    );
    const persistedMode = assignment?.assignmentMode ?? 'AUTO';
    const persistedAssigneeByStatus = new Map(
        assignment?.statusAssignees.map((assignee) => [assignee.statusId, assignee.userId]) ?? []
    );
    const changedStatusAssignees = stages.flatMap((stage) => {
        const userId = assigneeByStatus.get(stage.statusId) ?? '';

        return persistedAssigneeByStatus.get(stage.statusId) === userId
            ? []
            : [{ statusId: stage.statusId, userId }];
    });
    const isPreassigned = assignmentMode === 'PREASSIGNED';
    const hasChanges = assignmentMode !== persistedMode
        || (isPreassigned && changedStatusAssignees.length > 0);
    const hasCompletePlan = stages.length > 0 && stages.every((stage) => {
        const selectedUserId = assigneeByStatus.get(stage.statusId);
        return getEligibleUsers(
            users,
            stage.requiredRole,
            stage.isFinalReviewStage
        ).some(
            (user) => user.id === selectedUserId
        );
    });
    const canSave = canEdit
        && !isAssignmentFetching
        && !isSaving
        && !isUsersLoading
        && hasChanges
        && (!isPreassigned || hasCompletePlan);

    const handleModeChange = (mode: TaskAssignmentMode) => {
        setDraftMode(mode);
        setDraftAssignees(mode === 'AUTO' ? [] : statusAssignees);
    };

    const handleAssigneeChange = (statusId: string, userId: string) => {
        const nextAssignees = statusAssignees.filter(
            (assignee) => assignee.statusId !== statusId
        );

        if (userId) {
            nextAssignees.push({ statusId, userId });
        }

        setDraftAssignees(nextAssignees);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSave) return;

        const body = {
            assignmentMode,
            statusAssignees: assignmentMode === 'AUTO'
                ? []
                : changedStatusAssignees,
        };

        try {
            const savedAssignment = await updateTaskAssignment({
                taskId: task.id,
                body,
            }).unwrap();

            setDraftMode(savedAssignment.assignmentMode);
            setDraftAssignees(savedAssignment.statusAssignees.map((assignee) => ({
                statusId: assignee.statusId,
                userId: assignee.userId,
            })));
        } catch (error) {
            console.error('Task assignment update failed:', error);
        }
    };

    if (isAssignmentFetching && !assignment) {
        return <p className="py-10 text-center text-sm font-semibold text-slate-500">{t('loading')}</p>;
    }

    if (isAssignmentError) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
                <p>{t('loadError')}</p>
                <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                >
                    {commonT('actions.retry')}
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                        {t('mode')}
                    </span>
                    <select
                        value={assignmentMode}
                        disabled={!canEdit || isSaving}
                        onChange={(event) => handleModeChange(event.target.value as TaskAssignmentMode)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-100"
                    >
                        <option value="AUTO">{t('automatic')}</option>
                        <option value="PREASSIGNED">{t('preassigned')}</option>
                    </select>
                </label>

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
                    {assignmentMode === 'AUTO'
                        ? t('autoHint')
                        : t('preassignedHint')}
                </div>
            </div>

            {isPreassigned && (
                <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            {t('assignees')}
                        </h3>
                        {(isWorkflowFetching || isWorkTypesFetching) && (
                            <span className="text-xs font-semibold text-blue-600">{t('loadingWorkflow')}</span>
                        )}
                    </div>

                    {isWorkTypesError && !task.workTypeId && (
                        <QueryErrorNotice
                            message={t('missingWorkType')}
                            onRetry={() => void refetchWorkTypes()}
                            isRetrying={isWorkTypesFetching}
                        />
                    )}

                    {!isWorkTypesFetching && !isWorkTypesError && !workTypeId && stages.length === 0 && (
                        <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs font-semibold text-yellow-700">
                            {t('missingWorkTypeHint')}
                        </p>
                    )}

                    {isWorkflowError && stages.length === 0 && (
                        <QueryErrorNotice
                            message={t('workflowError')}
                            onRetry={() => void refetchWorkflow()}
                            isRetrying={isWorkflowFetching}
                        />
                    )}

                    {!isWorkflowFetching && !isWorkTypesFetching && stages.length === 0 && workTypeId && !isWorkflowError && (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                            {t('emptyWorkflow')}
                        </p>
                    )}

                    {stages.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {stages.map((stage) => {
                                const eligibleUsers = getEligibleUsers(
                                    users,
                                    stage.requiredRole,
                                    stage.isFinalReviewStage
                                );
                                const normalizedRequiredRole = normalizeRoleValue(stage.requiredRole);
                                const roleLabel = normalizedRequiredRole.includes('admin')
                                    || normalizedRequiredRole.includes('dispatcher')
                                    ? 'ROLE_ADMIN / ROLE_DISPATCHER'
                                    : stage.requiredRole || commonT('states.roleMissing');

                                return (
                                    <label key={stage.statusId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <span className="block text-sm font-black text-slate-800">
                                            {stage.statusName || stage.statusCode || stage.statusId}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] font-bold uppercase text-slate-400">
                                            {roleLabel}
                                        </span>
                                        <select
                                            required
                                            value={assigneeByStatus.get(stage.statusId) ?? ''}
                                            disabled={!canEdit || isSaving || isUsersLoading}
                                            onChange={(event) => handleAssigneeChange(stage.statusId, event.target.value)}
                                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-100"
                                        >
                                            <option value="">{t('employeePlaceholder')}</option>
                                            {eligibleUsers.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {getUserLabel(user)}
                                                </option>
                                            ))}
                                        </select>
                                        {eligibleUsers.length === 0 && (
                                            <span className="mt-1 block text-[10px] font-semibold text-red-500">
                                                {t('noEmployees', {role: stage.requiredRole})}
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {!canEdit && (
                <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                    {t('permissionHint')}
                </p>
            )}

            {canEdit && (
                <div className="flex justify-end border-t border-slate-100 pt-4">
                    <button
                        type="submit"
                        disabled={!canSave}
                        className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                    >
                        {isSaving
                            ? t('saving')
                            : hasChanges
                                ? t('save')
                                : t('noChanges')}
                    </button>
                </div>
            )}
        </form>
    );
}

export default function TaskAssignmentModal({
    isOpen,
    initialTaskId = '',
    tasks,
    users,
    isUsersLoading,
    canEdit,
    onClose,
}: TaskAssignmentModalProps) {
    const t = useTranslations('tasks.assignment');
    const commonT = useTranslations('common');
    const uniqueTasks = useMemo(() => getUniqueTasks(tasks), [tasks]);
    const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId);
    const selectedTask = uniqueTasks.find((task) => task.id === selectedTaskId) ?? uniqueTasks[0];

    if (!isOpen) return null;

    return (
        <Modal contentClassName="max-w-5xl overflow-hidden p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-5 py-5 dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-900 sm:px-6">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('badge')}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t('title')}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {t('subtitle')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl text-slate-400 shadow-sm transition hover:bg-slate-100 dark:bg-slate-800"
                    aria-label={commonT('actions.close')}
                >
                    &times;
                </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
                {uniqueTasks.length > 1 && (
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                            {t('technicalTask')}
                        </span>
                        <select
                            value={selectedTask?.id ?? ''}
                            onChange={(event) => setSelectedTaskId(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                        >
                            {uniqueTasks.map((task) => (
                                <option key={task.id} value={task.id}>
                                    {getTaskLabel(task, t('technicalTask'))}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {selectedTask ? (
                    <TaskAssignmentEditor
                        key={selectedTask.id}
                        task={selectedTask}
                        users={users}
                        isUsersLoading={isUsersLoading}
                        canEdit={canEdit}
                    />
                ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        {t('emptyOrder')}
                    </p>
                )}
            </div>
        </Modal>
    );
}
