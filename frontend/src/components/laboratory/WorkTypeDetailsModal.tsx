'use client';
import {mvpModules} from '@/src/lib/mvp';

import { useMemo } from 'react';
import {useTranslations} from 'next-intl';

import ErrorState from '@/src/components/ui/ErrorState';
import Modal from '@/src/components/ui/Modal';
import { useGetAdminWorkflowStepsQuery } from '@/src/services/api/workflowApi';
import type { WorkTypes } from '@/src/types/laboratory-types/workTypes.types';

type WorkTypeDetailsModalProps = {
    workType: WorkTypes;
    onClose: () => void;
    onDelete: (workType: WorkTypes) => void;
};

export default function WorkTypeDetailsModal({
    workType,
    onClose,
    onDelete,
}: WorkTypeDetailsModalProps) {
    const t = useTranslations('laboratory.workTypeDetails');
    const commonT = useTranslations('common.actions');
    const {
        data: steps = [],
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useGetAdminWorkflowStepsQuery({ workTypeId: workType.id });

    const orderedSteps = useMemo(
        () => [...steps].sort((left, right) => left.sortOrder - right.sortOrder),
        [steps],
    );

    return (
        <Modal contentClassName="max-w-3xl overflow-hidden p-0">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                        {t('badge')}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                            {workType.name}
                        </h2>
                        {workType.code && (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                {workType.code}
                            </span>
                        )}
                    </div>
                    {workType.description && (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                            {workType.description}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('closeDetails')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                    ×
                </button>
            </header>

            <div className="min-h-64 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black text-slate-900">
                            {t('stages')}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {t('readOnly')}
                        </p>
                    </div>
                    {!isLoading && !isError && (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                            {t('transitions', {count: orderedSteps.length})}
                        </span>
                    )}
                </div>

                {isLoading && (
                    <div className="mt-5 space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-20 animate-pulse rounded-2xl bg-slate-100"
                            />
                        ))}
                    </div>
                )}

                {isError && (
                    <div className="mt-5">
                        <ErrorState
                            compact
                            title={t('loadError')}
                            onRetry={() => void refetch()}
                            isRetrying={isFetching}
                        >
                            {t('loadErrorHint')}
                        </ErrorState>
                    </div>
                )}

                {!isLoading && !isError && orderedSteps.length === 0 && (
                    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                        <p className="text-sm font-bold text-slate-700">
                            {t('empty')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {t('emptyHint')}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && orderedSteps.length > 0 && (
                    <ol className="mt-5 space-y-3">
                        {orderedSteps.map((step, index) => (
                            <li
                                key={step.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-black text-white">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                                            <span>{step.fromStatusName}</span>
                                            <span className="text-violet-500">→</span>
                                            <span className="text-violet-700">
                                                {step.toStatusName}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                                            <span className="rounded-lg bg-white px-2.5 py-1">
                                                {t('role', {role: step.requiredRole || t('roleMissing')})}
                                            </span>
                                            {mvpModules.warehouse && step.materialReportRequired && (
                                                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">
                                                    {t('materialReport')}
                                                </span>
                                            )}
                                            {mvpModules.warehouse && step.allowUnplannedMaterials && (
                                                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700">
                                                    {t('unplannedMaterials')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <button
                    type="button"
                    onClick={() => onDelete(workType)}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                    {t('delete')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                    {commonT('close')}
                </button>
            </footer>
        </Modal>
    );
}
