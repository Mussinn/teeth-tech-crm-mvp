'use client';

import {
    useGetRecentStockMovementsQuery,
    useGetStockOverviewQuery,
} from '@/src/services/api/warehouseApi';
import {
    getApiErrorMessage,
    shortId,
    stockStatusClasses,
} from './warehouseUtils';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type WarehouseOverviewProps = {
    onOpenNomenclature: () => void;
    onOpenInventory: () => void;
};

function isPositiveMovement(type: import('@/src/types/warehouse.types').StockMovementType) {
    return type === 'IN' || type === 'ORDER_RETURN';
}

export default function WarehouseOverview({
    onOpenNomenclature,
    onOpenInventory,
}: WarehouseOverviewProps) {
    const t = useTranslations('warehouse.overview');
    const {dateTime, number} = useAppFormatters();
    const quantity = (value: number | null | undefined, unit?: string) =>
        value === null || value === undefined || !Number.isFinite(value)
            ? '—'
            : `${number(value, {maximumFractionDigits: 3})}${unit ? ` ${unit}` : ''}`;
    const overviewQuery = useGetStockOverviewQuery();
    const movementsQuery = useGetRecentStockMovementsQuery(10);

    const overview = overviewQuery.data;
    const movements = movementsQuery.data ?? [];
    const sufficientCount = Math.max(
        0,
        (overview?.totalPositionsCount ?? 0) - (overview?.lowStockCount ?? 0)
    );
    const criticalCount = overview?.items.filter((item) => item.statusCode === 'CRITICAL').length ?? 0;
    const totalPositions = overview?.totalPositionsCount ?? 0;
    const healthShare = totalPositions > 0 ? Math.round((sufficientCount / totalPositions) * 100) : 0;
    const warningCount = Math.max(0, (overview?.lowStockCount ?? 0) - criticalCount);
    const attentionItems = [...(overview?.items ?? [])]
        .filter((item) => item.minStockLevel > 0 && item.currentQuantity < item.minStockLevel)
        .sort((a, b) => {
            const aCoverage = a.minStockLevel > 0 ? a.currentQuantity / a.minStockLevel : 1;
            const bCoverage = b.minStockLevel > 0 ? b.currentQuantity / b.minStockLevel : 1;
            return aCoverage - bCoverage;
        })
        .slice(0, 7);
    const hasError = overviewQuery.isError || movementsQuery.isError;

    return (
        <div className="space-y-6">
            {hasError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {getApiErrorMessage(
                        overviewQuery.error ?? movementsQuery.error,
                        t('loadError')
                    )}
                </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: t('metrics.positions'),
                        value: overview?.totalPositionsCount ?? '—',
                        note: t('metrics.all'),
                        color: 'bg-violet-500',
                    },
                    {
                        label: t('metrics.sufficient'),
                        value: overview ? sufficientCount : '—',
                        note: t('metrics.aboveMinimum'),
                        color: 'bg-emerald-500',
                    },
                    {
                        label: t('metrics.attention'),
                        value: overview?.lowStockCount ?? '—',
                        note: t('metrics.nearMinimum'),
                        color: 'bg-amber-500',
                    },
                    {
                        label: t('metrics.critical'),
                        value: overview ? criticalCount : '—',
                        note: t('metrics.replenishFirst'),
                        color: 'bg-red-500',
                    },
                ].map((card) => (
                    <article
                        key={card.label}
                        className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/5"
                    >
                        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{card.label}</p><span className={`h-2.5 w-2.5 rounded-full ${card.color}`} /></div>
                        <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                            {overviewQuery.isLoading ? (
                                <span className="inline-block h-9 w-16 animate-pulse rounded bg-slate-100" />
                            ) : card.value}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">{card.note}</p>
                    </article>
                ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(280px,.6fr)_minmax(0,1.4fr)]">
                <article className="self-start rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div><h2 className="text-sm font-bold text-slate-900">{t('health')}</h2><p className="mt-1 text-xs text-slate-400">{t('healthSubtitle')}</p></div>
                        <span className="text-3xl font-black tracking-tight text-violet-600">{healthShare}%</span>
                    </div>

                    <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label={`${t('health')}: ${healthShare}%`}>
                        <span className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 transition-all" style={{width: `${healthShare}%`}} />
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('sufficient')}</div><p className="mt-2 text-xl font-black text-slate-950">{sufficientCount}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('low')}</div><p className="mt-2 text-xl font-black text-slate-950">{warningCount}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500"><span className="h-2 w-2 rounded-full bg-red-500" />{t('critical')}</div><p className="mt-2 text-xl font-black text-slate-950">{criticalCount}</p></div>
                    </div>

                    <p className="mt-5 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">
                        {criticalCount > 0 ? t('criticalHint', {count: criticalCount}) : warningCount > 0 ? t('warningHint', {count: warningCount}) : t('safeHint')}
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
                    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">{t('risk')}</h2><p className="mt-1 text-xs text-slate-400">{t('riskSubtitle')}</p></div><button type="button" onClick={onOpenNomenclature} className="rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">{t('replenish')}</button></div>
                    <div className="mt-6 space-y-4">
                        {attentionItems.map((item) => {
                            const coverage = item.minStockLevel > 0 ? Math.max(0, Math.min(100, item.currentQuantity / item.minStockLevel * 100)) : 100;
                            return <div key={item.nomenclatureId} className="grid gap-2 sm:grid-cols-[minmax(120px,190px)_minmax(0,1fr)_58px] sm:items-center sm:gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700" title={item.name}>{item.name}</p><p className="mt-0.5 text-[9px] text-slate-400">{t('quantityOfMinimum', {current: quantity(item.currentQuantity, item.unit), minimum: quantity(item.minStockLevel, item.unit)})}</p></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" style={{width: `${coverage}%`}} /></div><span className="text-right text-xs font-black text-violet-700">{Math.round(coverage)}%</span></div>;
                        })}
                        {!overviewQuery.isLoading && attentionItems.length === 0 && <div className="flex min-h-44 items-center justify-center rounded-xl bg-emerald-50 text-center text-sm font-semibold text-emerald-700">{t('allAboveMinimum')}</div>}
                        {overviewQuery.isLoading && <div className="h-44 animate-pulse rounded-xl bg-slate-100" />}
                    </div>
                </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">{t('balances')}</h2>
                            <p className="mt-1 text-xs text-slate-500">
                                {t('balancesSubtitle')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenNomenclature}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-950/15 transition hover:bg-violet-700"
                        >
                            {t('fullInfo')} <span aria-hidden="true">→</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/80">
                        <div className="border-r border-slate-200 px-4 py-3 sm:px-5"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{t('total')}</p><p className="mt-1 text-lg font-black text-slate-950">{totalPositions}</p></div>
                        <div className="border-r border-slate-200 px-4 py-3 sm:px-5"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{t('normal')}</p><p className="mt-1 text-lg font-black text-slate-950">{sufficientCount}</p></div>
                        <div className="px-4 py-3 sm:px-5"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{t('belowMinimum')}</p><p className="mt-1 text-lg font-black text-slate-950">{warningCount + criticalCount}</p></div>
                    </div>

                    <div className="max-h-[480px] overflow-auto">
                        <table className="w-full min-w-[680px] text-left">
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur">
                                <tr>
                                    <th className="px-5 py-3 font-bold">{t('position')}</th>
                                    <th className="px-5 py-3 font-bold">{t('balance')}</th>
                                    <th className="px-5 py-3 font-bold">{t('minimum')}</th>
                                    <th className="px-5 py-3 text-right font-bold">{t('status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(overview?.items ?? []).map((item) => (
                                    <tr key={item.nomenclatureId} className="transition hover:bg-violet-50/50">
                                        <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`h-8 w-1 shrink-0 rounded-full ${item.statusCode === 'CRITICAL' ? 'bg-red-500' : item.statusCode === 'LOW' ? 'bg-amber-500' : 'bg-violet-400'}`} /><span className="text-sm font-bold text-slate-900">{item.name}</span></div></td>
                                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                                            <div className="flex min-w-36 items-center gap-3">
                                                <span className="min-w-16">{quantity(item.currentQuantity, item.unit)}</span>
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.statusCode === 'CRITICAL' ? 'bg-red-500' : item.statusCode === 'LOW' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, item.minStockLevel > 0 ? item.currentQuantity / item.minStockLevel * 100 : 100)}%`}} /></div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-500">
                                            {quantity(item.minStockLevel, item.unit)}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${stockStatusClasses[item.statusCode]}`}>
                                                {t(`stockStatuses.${item.statusCode}`)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!overviewQuery.isLoading && (overview?.items.length ?? 0) === 0 && (
                        <div className="px-5 py-12 text-center text-sm text-slate-500">
                            {t('emptyStock')}
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="px-5 pt-5">
                            <h2 className="font-bold text-slate-900">{t('recentMovements')}</h2>
                            <p className="mt-1 text-xs text-slate-500">{t('movementsSubtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenInventory}
                            className="mr-5 mt-5 shrink-0 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                        >
                            {t('inventories')}
                        </button>
                    </div>

                    <div className="relative mt-4 max-h-[520px] space-y-0 overflow-y-auto px-5 pb-5 before:absolute before:bottom-5 before:left-[34px] before:top-3 before:w-px before:bg-slate-200">
                        {movements.map((movement) => {
                            const positive = isPositiveMovement(movement.movementTypeCode);
                            return (
                                <article key={movement.id} className="group relative pl-9 py-2.5">
                                    <span className={`absolute left-1.5 top-4 z-[1] flex h-6 w-6 items-center justify-center rounded-full border-4 border-white text-[10px] font-black text-white shadow-sm ${positive ? 'bg-emerald-500' : 'bg-violet-600'}`}>{positive ? '↓' : '↑'}</span>
                                    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition group-hover:border-violet-200 group-hover:shadow-md">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-[10px] font-bold text-slate-400">
                                                    #{shortId(movement.id)}
                                                </span>
                                                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                                                    {t(`movements.${movement.movementTypeCode}`)}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 truncate text-sm font-bold text-slate-900">
                                                {movement.nomenclatureName}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                                {movement.reason || t('noComment')}
                                            </p>
                                            <p className="mt-1.5 text-[11px] text-slate-400">
                                                {dateTime(movement.createdAt)}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
                                            {positive ? '+' : '−'}{quantity(Math.abs(movement.quantity))}
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {!movementsQuery.isLoading && movements.length === 0 && (
                        <div className="py-12 text-center text-sm text-slate-500">{t('noMovements')}</div>
                    )}
                </div>
            </section>
        </div>
    );
}
