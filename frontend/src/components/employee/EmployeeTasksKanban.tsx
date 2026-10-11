'use client';

import { useState } from 'react';

import TaskDetailsSidebar from '@/src/components/layout/TaskDetailsSidebar';
import MaterialChips from '@/src/components/tasks/MaterialChips';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import TaskMaterialTransitionModal from '@/src/components/tasks/TaskMaterialTransitionModal';
import {
    useGetMyTasksKanbanQuery,
} from '@/src/services/api/ordersApi';
import type {
    EmployeeKanbanColumn,
    EmployeeKanbanTask,
    Task,
} from '@/src/types/task.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type ColumnVariant = 'previous' | 'current' | 'next';

const COLUMN_STYLES: Record<ColumnVariant, {
    accent: string;
    badge: string;
    eyebrow: string;
    emptyText: string;
}> = {
    previous: {
        accent: 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/60',
        badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        eyebrow: 'previous',
        emptyText: 'previousEmpty',
    },
    current: {
        accent: 'border-violet-300 bg-violet-50/55 ring-1 ring-violet-100 dark:border-violet-500/40 dark:bg-violet-500/10 dark:ring-violet-500/10',
        badge: 'bg-violet-600 text-white shadow-sm shadow-violet-500/25',
        eyebrow: 'current',
        emptyText: 'currentEmpty',
    },
    next: {
        accent: 'border-indigo-200 bg-indigo-50/45 dark:border-indigo-500/30 dark:bg-indigo-500/10',
        badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
        eyebrow: 'next',
        emptyText: 'nextEmpty',
    },
};

function ColumnIcon({ variant }: { variant: ColumnVariant }) {
    const path = variant === 'previous'
        ? <path d="m15 18-6-6 6-6" />
        : variant === 'current'
            ? <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>
            : <path d="m9 18 6-6-6-6" />;
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">{path}</svg>;
}

function getTaskLabel(task: EmployeeKanbanTask, fallback: string) {
    return task.workTypeName || fallback;
}

function mapTaskToDetails(task: EmployeeKanbanTask, fallback: string, unspecified: string): Task {
    return {
        id: task.id,
        title: getTaskLabel(task, fallback),
        status: task.currentStatusFormName || task.currentStatusCode || unspecified,
        currentStatusId: task.currentStatusId,
        currentStatusCode: task.currentStatusCode,
        isCompleted: task.isCompleted,
        hasAccess: task.hasAccess,
        orderId: task.orderId,
        type: task.workTypeName,
        workDirectionId: task.workDirectionId,
        workDirectionName: task.workDirectionName,
        workDirectionCode: task.workDirectionCode,
        material: (task.materialNames ?? []).join(', '),
        materialIds: task.materialIds,
        materialNames: task.materialNames,
        color: task.colorCode,
        technicianId: task.dentalTechnicianFullName,
        units: task.quantity,
        unitPrice: task.quantity > 0 ? task.totalAmount / task.quantity : task.totalAmount,
        discount: 0,
    };
}

function MoveTaskButton({ task }: { task: EmployeeKanbanTask }) {
    const t = useTranslations('workspace.kanban');
    const [isOpen, setIsOpen] = useState(false);
    const nextStatusId = task.allowedNextStatusIds[0];

    if (!nextStatusId) {
        return (
            <p className="text-xs font-semibold text-slate-400">
                {t('noTransition')}
            </p>
        );
    }

    return (
        <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                data-tour="employee-task-move"
                className="inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-300"
            >
                {t('completeStage')} <span aria-hidden="true" className="ml-2">→</span>
            </button>
            {isOpen ? (
                <TaskMaterialTransitionModal
                    taskId={task.id}
                    nextStatusId={nextStatusId}
                    defaultComment={t('completedComment', {stage: task.currentStatusFormName || task.currentStatusCode})}
                    onClose={() => setIsOpen(false)}
                />
            ) : null}
        </div>
    );
}

function EmployeeTaskCard({
    task,
    canMoveNext,
    onOpen,
}: {
    task: EmployeeKanbanTask;
    canMoveNext: boolean;
    onOpen: () => void;
}) {
    const t = useTranslations('workspace.kanban');
    const {currency} = useAppFormatters();
    const status = task.currentStatusFormName || task.currentStatusCode;
    const taskLabel = getTaskLabel(task, t('task', {id: ''}).trim());

    return (
        <article
            role="button"
            tabIndex={0}
            aria-label={t('openDetails', {task: taskLabel})}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onOpen();
                }
            }}
            className="group relative overflow-hidden rounded-[18px] border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-slate-700 dark:bg-slate-900"
        >
			<span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-violet-500 to-indigo-500 opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-wide text-violet-600">{taskLabel}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-400">
                    {t('units', {count: task.quantity})}
                </span>
            </div>

			<h3 className="mt-2.5 text-sm font-black leading-snug text-slate-900 dark:text-white">
                {taskLabel}
            </h3>
            {task.workDirectionName && task.workDirectionCode ? (
                <div className="mt-2">
                    <WorkDirectionBadge code={task.workDirectionCode} name={task.workDirectionName} />
                </div>
            ) : null}
            <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
                <MaterialChips materialNames={task.materialNames} compact />
                {task.colorCode ? <p>{t('color', {color: task.colorCode})}</p> : null}
            </div>

            {status && (
				<p className="mt-2.5 inline-flex rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                    {status}
                </p>
            )}

			<dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800">
                <div>
                    <dt className="font-bold uppercase tracking-wide text-slate-400">{t('teeth')}</dt>
                    <dd className="mt-1 font-semibold text-slate-700">
                        {task.toothNumbers.length ? task.toothNumbers.join(', ') : '—'}
                    </dd>
                </div>
                <div>
                    <dt className="font-bold uppercase tracking-wide text-slate-400">{t('amount')}</dt>
                    <dd className="mt-1 font-black text-slate-900">
                        {currency(task.totalAmount)}
                    </dd>
                </div>
            </dl>

			<div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('technician')}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                        {task.dentalTechnicianFullName || t('unassigned')}
                    </p>
                </div>
            </div>

            {canMoveNext && (
				<div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <MoveTaskButton task={task} />
                </div>
            )}
        </article>
    );
}

function KanbanColumn({
    column,
    variant,
    onOpenTask,
}: {
    column: EmployeeKanbanColumn;
    variant: ColumnVariant;
    onOpenTask: (task: EmployeeKanbanTask) => void;
}) {
    const t = useTranslations('workspace.kanban.columns');
    const styles = COLUMN_STYLES[variant];

    return (
		<section className={`min-h-72 min-w-0 overflow-hidden rounded-[22px] border shadow-sm ${styles.accent}`}>
			<header className="rounded-t-[21px] border-b border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
						<div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><ColumnIcon variant={variant} />{t(styles.eyebrow as 'previous' | 'current' | 'next')}</div>
                        <h3 className="mt-1 break-words text-sm font-black leading-snug text-slate-900 sm:truncate">
                            {column.title || column.statusName}
                        </h3>
                        {column.title && column.statusName && column.title !== column.statusName && (
                            <p className="mt-1 break-words text-xs text-slate-500 sm:truncate">{column.statusName}</p>
                        )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${styles.badge}`}>
                        {column.taskCount}
                    </span>
                </div>
            </header>

			<div className="min-w-0 max-h-[560px] space-y-2.5 overflow-y-auto p-2.5">
                {column.tasks.map((task) => (
                    <EmployeeTaskCard
                        key={task.id}
                        task={task}
                        canMoveNext={variant === 'current'}
                        onOpen={() => onOpenTask(task)}
                    />
                ))}

                {column.tasks.length === 0 && (
                    <div className="break-words rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center text-xs text-slate-500">
                        {t(styles.emptyText as 'previousEmpty' | 'currentEmpty' | 'nextEmpty')}
                    </div>
                )}
            </div>
        </section>
    );
}

export default function EmployeeTasksKanban() {
    const t = useTranslations('workspace.kanban');
    const commonT = useTranslations('common.actions');
    const [selectedTask, setSelectedTask] = useState<EmployeeKanbanTask | null>(null);
    const {
        data,
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetMyTasksKanbanQuery(undefined, {pollingInterval: 10000, skipPollingIfUnfocused: true});
    const refreshedSelectedTask = selectedTask && data
        ? [
            ...data.previousColumn.tasks,
            ...data.currentColumn.tasks,
            ...data.nextColumn.tasks,
        ].find((task) => task.id === selectedTask.id) ?? selectedTask
        : selectedTask;
    const selectedDetailsTask = refreshedSelectedTask
        ? mapTaskToDetails(
            refreshedSelectedTask,
            t('task', {id: refreshedSelectedTask.id.slice(0, 8)}),
            t('unspecified')
        )
        : null;

    if (isLoading) {
        return (
            <section aria-busy="true" aria-label={t('loading')} className="space-y-4">
                <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
                <div className="grid gap-4 lg:grid-cols-3">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
                    ))}
                </div>
            </section>
        );
    }

    if (isError || !data) {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
                <h2 className="font-black text-red-900">{t('loadError')}</h2>
                <p className="mt-1 text-sm text-red-700">{t('retryHint')}</p>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
                >
                    {commonT('retry')}
                </button>
            </section>
        );
    }

    const totalTasks = data.previousColumn.taskCount
        + data.currentColumn.taskCount
        + data.nextColumn.taskCount;

    return (
        <>
			<section data-tour="employee-tasks" aria-labelledby="employee-tasks-title" className="min-w-0 space-y-4 overflow-hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
						<p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                            {t('shift')}
                        </p>
						<h2 id="employee-tasks-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                            {t('title')}
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm text-slate-500">
                            {t('subtitle')}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
						<span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {t('total', {count: totalTasks})}
                        </span>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
							className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-wait disabled:text-slate-400 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                        >
                            {isFetching ? t('refreshing') : commonT('refresh')}
                        </button>
                    </div>
                </header>

				<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-3">
                    <KanbanColumn
                        column={data.previousColumn}
                        variant="previous"
                        onOpenTask={setSelectedTask}
                    />
                    <KanbanColumn
                        column={data.currentColumn}
                        variant="current"
                        onOpenTask={setSelectedTask}
                    />
                    <KanbanColumn
                        column={data.nextColumn}
                        variant="next"
                        onOpenTask={setSelectedTask}
                    />
                </div>
            </section>

            <TaskDetailsSidebar
                task={selectedDetailsTask}
                onClose={() => setSelectedTask(null)}
            />
        </>
    );
}
