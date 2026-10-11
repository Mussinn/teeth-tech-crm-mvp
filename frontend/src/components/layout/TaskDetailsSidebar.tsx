'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSelector } from 'react-redux';
import ReturnTaskForReworkModal from '@/src/components/Modals/ReturnTaskForReworkModal';
import Modal from '@/src/components/ui/Modal';
import QualityIncidentsPanel from '@/src/components/tasks/QualityIncidentsPanel';
import TaskFilesPanel from '@/src/components/tasks/TaskFilesPanel';
import TaskHistoryTimeline from '@/src/components/tasks/TaskHistoryTimeline';
import MaterialChips from '@/src/components/tasks/MaterialChips';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import WorkDirectionBadge from '@/src/components/work-directions/WorkDirectionBadge';
import { normalizeAuthRoles } from '@/src/features/auth/authUtils';
import { mvpModules } from '@/src/lib/mvp';
import TaskMaterialAccountingPanel from '@/src/components/tasks/TaskMaterialAccountingPanel';
import { RootState } from '@/src/lib/store';
import { useDeleteTaskMutation, useUpdateTaskMutation } from '@/src/services/api/ordersApi';
import { useGetWorkDirectionsQuery } from '@/src/services/api/workDirectionsApi';
import type { Task, TaskAttachment, TaskImage } from '@/src/types/task.types';
import { useAppFormatters } from '@/src/i18n/provider';

type TaskDetailsSidebarProps = {
    task: Task | null;
    onClose: () => void;
    onAddComment?: (text: string) => void;
    onAddAttachments?: (files: TaskAttachment[]) => void;
    onAddImages?: (images: TaskImage[]) => void;
};

export default function TaskDetailsSidebar({
                                               task: selectedTask,
                                               onClose,
                                               onAddComment,
                                               onAddAttachments,
                                           onAddImages,
                                           }: TaskDetailsSidebarProps) {
    const t = useTranslations('tasks.sidebar');
    const historyT = useTranslations('tasks.history');
    const commonT = useTranslations('common');
    const formats = useAppFormatters();
    const [commentText, setCommentText] = useState('');
    const [reworkModalTaskId, setReworkModalTaskId] = useState('');
    const [renderedTask, setRenderedTask] = useState<Task | null>(selectedTask);
    const [isVisible, setIsVisible] = useState(false);
    const [isHistoryDetailsOpen, setIsHistoryDetailsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'materials'>('overview');
    const [pendingWorkDirectionId, setPendingWorkDirectionId] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const { isAuthenticated, role, roles } = useSelector((state: RootState) => state.auth);
    const normalizedRoles = normalizeAuthRoles(roles.length ? roles : role ? [role] : []);
    const isAdmin = normalizedRoles.includes('ADMIN');
    const canDeleteTask = normalizedRoles.some((item) => item === 'ADMIN' || item === 'DISPATCHER');
    const directionsQuery = useGetWorkDirectionsQuery(
        { includeInactive: true },
        { skip: !isAdmin }
    );
    const [updateTask, updateTaskState] = useUpdateTaskMutation();
    const [deleteTask, deleteTaskState] = useDeleteTaskMutation();

    useEffect(() => {
        let animationFrame: number | undefined;
        let visibilityFrame: number | undefined;
        let removalTimeout: number | undefined;

        if (selectedTask) {
            animationFrame = window.requestAnimationFrame(() => {
                setRenderedTask(selectedTask);
                setIsHistoryDetailsOpen(false);
                setActiveTab('overview');
                visibilityFrame = window.requestAnimationFrame(() => setIsVisible(true));
            });
        } else {
            animationFrame = window.requestAnimationFrame(() => {
                setIsVisible(false);
                const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                removalTimeout = window.setTimeout(
                    () => setRenderedTask(null),
                    shouldReduceMotion ? 0 : SIDEBAR_ANIMATION_DURATION
                );
            });
        }

        return () => {
            if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
            if (visibilityFrame !== undefined) window.cancelAnimationFrame(visibilityFrame);
            if (removalTimeout !== undefined) window.clearTimeout(removalTimeout);
        };
    }, [selectedTask]);

    if (!renderedTask) return null;

    const task = renderedTask;

    const canReturnForRework = isAuthenticated && isTaskEligibleForRework(task);

    const handleAddComment = () => {
        const trimmed = commentText.trim();

        if (!trimmed || !onAddComment) return;

        onAddComment(trimmed);
        setCommentText('');
    };

    const handleConfirmDirectionChange = async () => {
        if (!pendingWorkDirectionId || pendingWorkDirectionId === task.workDirectionId) {
            setPendingWorkDirectionId('');
            return;
        }

        try {
            await updateTask({
                taskId: task.id,
                body: { workDirectionId: pendingWorkDirectionId },
            }).unwrap();
            const direction = directionsQuery.data?.find((item) => item.id === pendingWorkDirectionId);
            setRenderedTask((current) => current ? {
                ...current,
                workDirectionId: pendingWorkDirectionId,
                workDirectionName: direction?.name ?? current.workDirectionName,
                workDirectionCode: direction?.code ?? current.workDirectionCode,
            } : current);
            setPendingWorkDirectionId('');
        } catch {
            // Глобальный обработчик API показывает сообщение backend.
        }
    };

    const handleDeleteTask = async () => {
        try {
            await deleteTask({ taskId: task.id, orderId: task.orderId }).unwrap();
            setIsDeleteConfirmOpen(false);
            onClose();
        } catch {
            // The centralized API handler shows the backend error.
        }
    };

    return (
        <>
            <div
                onClick={onClose}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                    isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
            />

            <aside
                data-tour="employee-task-details"
                inert={!isVisible}
                aria-hidden={!isVisible}
                className={`fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] w-full flex-col rounded-t-2xl border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-x-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-w-[30rem] sm:rounded-none ${
                    isVisible
                        ? 'translate-y-0 sm:translate-x-0'
                        : 'pointer-events-none translate-y-full sm:translate-x-full sm:translate-y-0'
                }`}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-5">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {t('details')}
                        </p>
                        <h2 className="mt-1 truncate text-lg font-black text-slate-900 sm:text-xl">
                            {task.title ?? t('taskNumber', {id: task.id})}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            {t('status', {status: task.status})}
                        </p>
                        {canReturnForRework ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setReworkModalTaskId(task.id);
                                }}
                                className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                            >
                                {t('returnForRework')}
                            </button>
                        ) : null}
                        {canDeleteTask && UUID_PATTERN.test(task.id) ? (
                            <button
                                type="button"
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:border-red-300 hover:bg-red-100"
                            >
                                {t('deleteTask')}
                            </button>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    >
                        {commonT('actions.close')}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    <nav className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label={t('sectionsAria')}>
                        {([
                            ['overview', t('overview')],
                            ...(mvpModules.warehouse ? [['materials', t('materials')] as const] : []),
                        ] as const).map(([tab, label]) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                aria-current={activeTab === tab ? 'page' : undefined}
                                className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                                    activeTab === tab
                                        ? 'bg-white text-violet-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    {activeTab === 'materials' ? (
                        UUID_PATTERN.test(task.id) && task.materialIds && task.materialNames ? (
                            <TaskMaterialAccountingPanel
                                key={task.id}
                                taskId={task.id}
                                materialIds={task.materialIds}
                                materialNames={task.materialNames}
                            />
                        ) : (
                            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                {t('materialsAfterSave')}
                            </section>
                        )
                    ) : (
                    <div className="space-y-5 sm:space-y-6">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {t('mainInfo')}
                        </h3>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {task.patient && <InfoItem label={t('patient')} value={task.patient} />}
                            {task.orderId && <InfoItem label={t('order')} value={`#${task.orderId}`} />}
                            {task.deadline && <InfoItem label={t('deadline')} value={task.deadline} />}
                            {task.priority && <InfoItem label={t('priority')} value={task.priority} />}
                            {task.type && <InfoItem label={t('workType')} value={task.type} />}
                            {(task.workDirectionName || task.workDirectionCode) && (
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400">{t('workDirection')}</p>
                                    <div className="mt-2">
                                        <WorkDirectionBadge code={task.workDirectionCode ?? ''} name={task.workDirectionName ?? task.workDirectionCode ?? ''} />
                                    </div>
                                </div>
                            )}
                            {task.materialNames ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">{t('taskMaterials')}</p>
                                    <MaterialChips materialNames={task.materialNames} className="mt-2" />
                                </div>
                            ) : null}
                            <InfoItem label={t('quantity')} value={task.units} />
                            {task.unitPrice ? <InfoItem label={t('price')} value={formats.currency(task.unitPrice)} /> : null}
                            {task.discount ? <InfoItem label={t('discount')} value={formats.number(task.discount)} /> : null}
                        </div>
                        {isAdmin && UUID_PATTERN.test(task.id) && (
                            <label className="mt-4 block">
                                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{t('changeWorkDirection')}</span>
                                <select
                                    value={task.workDirectionId ?? ''}
                                    disabled={directionsQuery.isLoading || directionsQuery.isError || updateTaskState.isLoading}
                                    onChange={(event) => {
                                        if (event.target.value && event.target.value !== task.workDirectionId) {
                                            setPendingWorkDirectionId(event.target.value);
                                        }
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500"
                                >
                                    <option value="">{t('selectWorkDirection')}</option>
                                    {(directionsQuery.data ?? []).map((direction) => (
                                        <option key={direction.id} value={direction.id}>{direction.name} — {direction.code}</option>
                                    ))}
                                </select>
                                {directionsQuery.isError && <span className="mt-1 block text-xs font-semibold text-red-600">{t('directionsLoadError')}</span>}
                            </label>
                        )}
                    </section>

                    {UUID_PATTERN.test(task.id) ? (
                        <QualityIncidentsPanel
                            taskId={task.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                        />
                    ) : null}

                    <TaskHistoryTimeline
                        taskId={task.id}
                        fallbackItems={task.history}
                        compact
                        onOpenDetails={() => setIsHistoryDetailsOpen(true)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                    />

                    <TaskFilesPanel
                        taskId={task.id}
                        fallbackImages={task.images}
                        fallbackAttachments={task.attachments}
                        onAddImages={onAddImages}
                        onAddAttachments={onAddAttachments}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                    />

                    <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {t('comments')}
                        </h3>

                        {onAddComment ? (
                            <div className="mt-3 space-y-3">
                                <textarea
                                    value={commentText}
                                    onChange={(event) => setCommentText(event.target.value)}
                                    placeholder={t('commentPlaceholder')}
                                    className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />

                                <button
                                    type="button"
                                    onClick={handleAddComment}
                                    className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    disabled={!commentText.trim()}
                                >
                                    {t('addComment')}
                                </button>
                            </div>
                        ) : null}

                        {task.comments?.length ? (
                            <div className="mt-4 space-y-3">
                                {task.comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-bold text-slate-800">
                                                {comment.author}
                                            </p>
                                            <p className="text-[10px] font-semibold text-slate-400">
                                                {comment.createdAt}
                                            </p>
                                        </div>

                                        <p className="mt-2 text-sm leading-5 text-slate-600">
                                            {comment.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyText text={t('noComments')} />
                        )}
                    </section>
                    </div>
                    )}
                </div>
            </aside>

            {isHistoryDetailsOpen ? (
                <Modal contentClassName="max-w-6xl overflow-hidden p-0">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-violet-50/60 p-5 dark:border-slate-700 dark:from-slate-900 dark:to-violet-950/30 sm:p-6">
                        <div className="flex min-w-0 items-start gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round"/><path d="M3 4v5h5M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </span>
                            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">{t('journal')}</p><h2 className="mt-1 truncate text-xl font-black text-slate-950 dark:text-white sm:text-2xl">{historyT('title')}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('historySubtitle', {task: task.title ?? t('taskNumber', {id: task.id})})}</p></div>
                        </div>
                        <button type="button" onClick={() => setIsHistoryDetailsOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" aria-label={t('closeHistory')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/></svg></button>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950 sm:p-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
                        <TaskHistoryTimeline taskId={task.id} fallbackItems={task.history} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" />
                        <div className="space-y-5">
                            {UUID_PATTERN.test(task.id) ? <QualityIncidentsPanel taskId={task.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" /> : <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">{t('qualityAfterSave')}</section>}
                            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">{t('summary')}</p>
                                <div className="mt-4 grid grid-cols-2 gap-2"><HistorySummaryItem label={commonT('fields.status')} value={task.status} /><HistorySummaryItem label={t('priority')} value={task.priority} /><HistorySummaryItem label={t('patient')} value={task.patient} /><HistorySummaryItem label={t('deadline')} value={task.deadline} /></div>
                            </section>
                        </div>
                    </div>
                </Modal>
            ) : null}

            {reworkModalTaskId === task.id ? (
                <ReturnTaskForReworkModal
                    taskId={task.id}
                    onClose={() => setReworkModalTaskId('')}
                    onSuccess={() => {
                        setReworkModalTaskId('');
                    }}
                />
            ) : null}

            <ConfirmDialog
                open={Boolean(pendingWorkDirectionId)}
                title={t('directionChangeTitle')}
                description={t('directionChangeWarning')}
                confirmLabel={t('directionChangeConfirm')}
                tone="warning"
                isLoading={updateTaskState.isLoading}
                onClose={() => setPendingWorkDirectionId('')}
                onConfirm={handleConfirmDirectionChange}
            />
            <ConfirmDialog
                open={isDeleteConfirmOpen}
                title={t('deleteTaskTitle')}
                description={t('deleteTaskDescription')}
                confirmLabel={t('deleteTask')}
                isLoading={deleteTaskState.isLoading}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteTask}
            />
        </>
    );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIDEBAR_ANIMATION_DURATION = 300;

const NON_PRODUCTION_STATUSES = new Set([
    'TODO',
    'NEW',
    'CREATED',
    'DONE',
    'COMPLETED',
    'CANCELLED',
    'CANCELED',
    'CLOSED',
    'RESOLVED',
    'FINISHED',
    'DELIVERED',
]);

function isTaskEligibleForRework(task: Task) {
    if (!UUID_PATTERN.test(task.id) || task.hasAccess === false || task.isCompleted === true) {
        return false;
    }

    const normalizedStatus = (task.currentStatusCode || task.status || '')
        .trim()
        .toUpperCase()
        .replace(/[\s/-]+/gu, '_');

    if (!normalizedStatus || NON_PRODUCTION_STATUSES.has(normalizedStatus)) return false;

    return !normalizedStatus.includes('НОВАЯ_ЗАДАЧА')
        && !normalizedStatus.includes('ЗАВЕРШ')
        && normalizedStatus !== 'ГОТОВО';
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
    const displayValue = value === undefined || value === null || value === '' ? '-' : value;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase text-slate-400">
                {label}
            </p>
            <p className="mt-1 truncate text-sm font-bold text-slate-800">
                {displayValue}
            </p>
        </div>
    );
}

function EmptyText({ text }: { text: string }) {
    return (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-400">
            {text}
        </div>
    );
}

function HistorySummaryItem({ label, value }: { label: string; value?: string | number | null }) {
    return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{value || '—'}</p></div>;
}
