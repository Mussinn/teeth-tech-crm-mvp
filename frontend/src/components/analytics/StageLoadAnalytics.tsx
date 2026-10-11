'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {useTranslations} from 'next-intl';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type StageLoadAnalyticsProps = {
    stageLoads: Record<string, number>;
    userId: string | null;
};

const EMPTY_STAGE_FILTER = '[]';
const STAGE_FILTER_EVENT = 'teethtech-analytics-stage-filter-change';
const STAGE_FILTER_STORAGE_PREFIX = 'teethtech:analytics:stage-load:hidden:';
const memorySnapshots = new Map<string, string>();
const memoryOnlyStorageKeys = new Set<string>();

const getStageFilterStorageKey = (userId: string | null) => (
    userId ? `${STAGE_FILTER_STORAGE_PREFIX}${userId}` : null
);

function subscribeToStageFilter(callback: () => void) {
    const notify = () => callback();
    window.addEventListener(STAGE_FILTER_EVENT, notify);
    window.addEventListener('storage', notify);

    return () => {
        window.removeEventListener(STAGE_FILTER_EVENT, notify);
        window.removeEventListener('storage', notify);
    };
}

function getStoredStageFilter(storageKey: string | null) {
    if (!storageKey) return EMPTY_STAGE_FILTER;
    if (memoryOnlyStorageKeys.has(storageKey)) {
        return memorySnapshots.get(storageKey) ?? EMPTY_STAGE_FILTER;
    }

    try {
        return window.localStorage.getItem(storageKey) ?? EMPTY_STAGE_FILTER;
    } catch {
        return memorySnapshots.get(storageKey) ?? EMPTY_STAGE_FILTER;
    }
}

function parseHiddenStageKeys(serializedValue: string) {
    try {
        const parsedValue: unknown = JSON.parse(serializedValue);
        if (!Array.isArray(parsedValue)) return new Set<string>();
        return new Set(parsedValue.filter((item): item is string => typeof item === 'string'));
    } catch {
        return new Set<string>();
    }
}

function storeHiddenStageKeys(storageKey: string | null, hiddenStageKeys: ReadonlySet<string>) {
    if (!storageKey) return;

    const serializedValue = JSON.stringify([...hiddenStageKeys]);
    memorySnapshots.set(storageKey, serializedValue);

    try {
        window.localStorage.setItem(storageKey, serializedValue);
        memoryOnlyStorageKeys.delete(storageKey);
    } catch {
        memoryOnlyStorageKeys.add(storageKey);
        // The in-memory value keeps the filter functional when browser storage is unavailable.
    }

    window.dispatchEvent(new Event(STAGE_FILTER_EVENT));
}

const stageOrder = [
    'TODO',
    'SCANNING',
    'MODELING',
    'MILLING',
    'PRINTING',
    'CASTING',
    'POST_PROCESSING',
    'QUALITY_CONTROL',
    'READY',
    'DONE',
];

function LoadTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
    const t = useTranslations('analytics.stages');
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xl shadow-slate-950/10">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                <span className="text-xs text-slate-500">{t('taskCount')}</span>
                <strong className="ml-2 text-sm text-slate-900">{payload[0].value ?? 0}</strong>
            </div>
        </div>
    );
}

export default function StageLoadAnalytics({ stageLoads, userId }: StageLoadAnalyticsProps) {
    const t = useTranslations('analytics.stages');
    const formatStageName = (value: string) => {
        switch (value) {
            case 'TODO': return t('codes.TODO');
            case 'SCANNING': return t('codes.SCANNING');
            case 'MODELING': return t('codes.MODELING');
            case 'MILLING': return t('codes.MILLING');
            case 'PRINTING': return t('codes.PRINTING');
            case 'CASTING': return t('codes.CASTING');
            case 'POST_PROCESSING': return t('codes.POST_PROCESSING');
            case 'QUALITY_CONTROL': return t('codes.QUALITY_CONTROL');
            case 'READY': return t('codes.READY');
            case 'DONE': return t('codes.DONE');
            default: return value.replaceAll('_', ' ').toLowerCase();
        }
    };
    const storageKey = getStageFilterStorageKey(userId);
    const serializedHiddenStageKeys = useSyncExternalStore(
        subscribeToStageFilter,
        () => getStoredStageFilter(storageKey),
        () => EMPTY_STAGE_FILTER
    );
    const hiddenStageKeys = useMemo(
        () => parseHiddenStageKeys(serializedHiddenStageKeys),
        [serializedHiddenStageKeys]
    );
    const data = Object.entries(stageLoads)
        .map(([key, count]) => ({ key, name: formatStageName(key), count: Number.isFinite(count) ? Math.max(0, count) : 0 }))
        .sort((a, b) => {
            const aIndex = stageOrder.indexOf(a.key);
            const bIndex = stageOrder.indexOf(b.key);
            return (aIndex < 0 ? stageOrder.length : aIndex) - (bIndex < 0 ? stageOrder.length : bIndex);
        });
    const visibleData = data.filter((item) => !hiddenStageKeys.has(item.key));
    const total = visibleData.reduce((sum, item) => sum + item.count, 0);
    const average = visibleData.length ? total / visibleData.length : 0;
    const peak = visibleData.reduce<(typeof visibleData)[number] | undefined>((current, item) => !current || item.count > current.count ? item : current, undefined);

    const toggleStage = (stageKey: string) => {
        const next = new Set(hiddenStageKeys);
        if (next.has(stageKey)) next.delete(stageKey);
        else next.add(stageKey);
        storeHiddenStageKeys(storageKey, next);
    };

    const showAllStages = () => storeHiddenStageKeys(storageKey, new Set());
    const hideAllStages = () => storeHiddenStageKeys(storageKey, new Set(data.map((item) => item.key)));

    return (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">{t('title')}</h2>
                    <p className="mt-1 text-xs text-slate-400">{t('subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-violet-500" />{t('tasks')}</span>
                    <span className="flex items-center gap-2"><span className="w-5 border-t border-dashed border-violet-300" />{t('average', {value: average.toFixed(1)})}</span>
                    {data.length > 0 && (
                        <details className="group relative">
                            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700 [&::-webkit-details-marker]:hidden">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                                    <path d="M4 6h16M7 12h10m-7 6h4" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                                {t('axis')}
                                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                                    {visibleData.length}/{data.length}
                                </span>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 transition group-open:rotate-180" aria-hidden="true">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                                </svg>
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-[min(16rem,calc(100vw-3rem))] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
                                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                                    <span className="font-semibold text-slate-700">{t('axisLabel')}</span>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={showAllStages} disabled={visibleData.length === data.length} className="font-semibold text-violet-600 transition hover:text-violet-800 disabled:cursor-default disabled:text-slate-300">
                                            {t('all')}
                                        </button>
                                        <span className="text-slate-200">|</span>
                                        <button type="button" onClick={hideAllStages} disabled={visibleData.length === 0} className="font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-default disabled:text-slate-300">
                                            {t('hide')}
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1.5">
                                    {data.map((item) => {
                                        const isVisible = !hiddenStageKeys.has(item.key);
                                        return (
                                            <label key={item.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-600 transition hover:bg-violet-50 hover:text-slate-900">
                                                <input
                                                    type="checkbox"
                                                    checked={isVisible}
                                                    onChange={() => toggleStage(item.key)}
                                                    className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
                                                />
                                                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                                <span className="font-semibold tabular-nums text-slate-400">{item.count}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </details>
                    )}
                </div>
            </div>

            {visibleData.length ? (
                <div className="mt-7 h-[350px] w-full sm:h-[390px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visibleData} margin={{ top: 12, right: 12, left: -20, bottom: 10 }}>
                            <defs>
                                <linearGradient id="stageLoadFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="currentColor" className="text-slate-200" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} interval="preserveStartEnd" dy={10} />
                            <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<LoadTooltip />} cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <ReferenceLine y={average} stroke="#a78bfa" strokeDasharray="4 5" strokeOpacity={0.75} />
                            <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#stageLoadFill)" activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fafafa', strokeWidth: 2 }} dot={{ r: 3, fill: '#8b5cf6', stroke: '#fafafa', strokeWidth: 1.5 }} animationDuration={700} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : data.length ? (
                <div className="flex h-[350px] flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
                            <path d="M3 3l18 18M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 4.24A10.5 10.5 0 0 1 12 4c5 0 8.5 4 9.5 6.5a9.9 9.9 0 0 1-2.17 3.43M6.61 6.61A10.84 10.84 0 0 0 2.5 10.5C3.5 13 7 17 12 17c1.04 0 2-.17 2.87-.46" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">{t('allHidden')}</h3>
                    <p className="mt-1 text-xs text-slate-400">{t('chooseStages')}</p>
                    <button type="button" onClick={showAllStages} className="mt-4 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">
                        {t('showAll')}
                    </button>
                </div>
            ) : (
                <div className="flex h-[350px] flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">⌁</span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">{t('empty')}</h3>
                    <p className="mt-1 text-xs text-slate-400">{t('emptyDescription')}</p>
                </div>
            )}

            {visibleData.length > 0 && (
                <div className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
                    <div><p className="text-[11px] text-slate-400">{t('total')}</p><p className="mt-1 text-lg font-bold text-slate-900">{total}</p></div>
                    <div><p className="text-[11px] text-slate-400">{t('peakStage')}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{peak?.name ?? '—'}</p></div>
                    <div><p className="text-[11px] text-slate-400">{t('peakTasks')}</p><p className="mt-1 text-lg font-bold text-violet-600">{peak?.count ?? 0}</p></div>
                </div>
            )}
        </section>
    );
}
