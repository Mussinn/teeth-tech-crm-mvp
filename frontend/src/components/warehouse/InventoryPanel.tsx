'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {useTranslations} from 'next-intl'

import Modal from '@/src/components/ui/Modal'
import {
	useCancelInventoryCheckMutation,
	useCompleteInventoryCheckMutation,
	useCreateInventoryCheckMutation,
	useGetInventoryCheckItemsQuery,
	useGetInventoryCheckQuery,
	useGetInventoryChecksQuery,
	useGetInventoryStatusRulesQuery,
	useStartInventoryCheckMutation,
	useUpdateInventoryItemMutation
} from '@/src/services/api/warehouseApi'
import type {
	InventoryCheck,
	InventoryCheckItem,
	InventoryCheckStatus,
	InventoryStatusRule
} from '@/src/types/warehouse.types'
import {
	getApiErrorMessage,
	shortId
} from './warehouseUtils'
import {useAppFormatters, useAppLocale} from '@/src/i18n/provider'
import {intlLocaleByLocale} from '@/src/i18n/config'

const PAGE_SIZE = 1000

type InventoryStage = 'history' | 'document' | 'counting' | 'summary' | 'results'
type CountFilter = 'all' | 'uncounted' | 'discrepancy'
type Confirmation = 'cancel' | 'complete' | null

function getInventoryStatusKey(statusCode: string) {
	if (statusCode === 'DRAFT') return 'statuses.DRAFT' as const
	if (statusCode === 'IN_PROGRESS') return 'statuses.IN_PROGRESS' as const
	if (statusCode === 'COMPLETED') return 'statuses.COMPLETED' as const
	if (statusCode === 'CANCELLED') return 'statuses.CANCELLED' as const
	return null
}

function parseQuantity(value: string | undefined) {
	if (value === undefined || value.trim() === '') return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function isInitial(check: InventoryCheck, rule?: InventoryStatusRule) {
	return rule?.initial ?? (check.statusCode === 'DRAFT' || (!check.startedAt && !check.completedAt))
}

function allowsCounting(check: InventoryCheck, rule?: InventoryStatusRule) {
	return rule?.allowsCounting ?? (check.statusCode === 'IN_PROGRESS' || (Boolean(check.startedAt) && !check.completedAt))
}

function isTerminal(check: InventoryCheck, rule?: InventoryStatusRule) {
	return rule?.terminal ?? (check.statusCode === 'COMPLETED' || check.statusCode === 'CANCELLED' || Boolean(check.completedAt))
}

function statusTone(status: InventoryCheckStatus) {
	if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700'
	if (status === 'COMPLETED') return 'bg-emerald-50 text-blue-600'
	if (status === 'CANCELLED') return 'border border-slate-200 bg-slate-50 text-slate-400'
	return 'bg-slate-100 text-slate-500'
}

function discrepancy(item: InventoryCheckItem) {
	if (item.actualQuantity === null || item.actualQuantity === undefined) return null
	return item.actualQuantity - item.expectedQuantity
}

export default function InventoryPanel() {
	const t = useTranslations('warehouse.inventory')
	const commonT = useTranslations('common.actions')
	const formatters = useAppFormatters()
	const {locale} = useAppLocale()
	const stages: Array<{ id: InventoryStage; index: string; label: string }> = [
		{ id: 'history', index: '01', label: t('stages.history') },
		{ id: 'document', index: '02', label: t('stages.document') },
		{ id: 'counting', index: '03', label: t('stages.counting') },
		{ id: 'summary', index: '04', label: t('stages.summary') },
		{ id: 'results', index: '05', label: t('stages.results') }
	]
	const fallbackFilters: Array<{ value: '' | InventoryCheckStatus; label: string }> = [
		{ value: '', label: t('statuses.all') },
		{ value: 'DRAFT', label: t('statuses.DRAFT_PLURAL') },
		{ value: 'IN_PROGRESS', label: t('statuses.IN_PROGRESS_SHORT') },
		{ value: 'COMPLETED', label: t('statuses.COMPLETED_PLURAL') },
		{ value: 'CANCELLED', label: t('statuses.CANCELLED_PLURAL') }
	]
	const durationLabel = (startedAt: string | null, completedAt: string | null) => {
		if (!startedAt || !completedAt) return '—'
		const minutes = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000))
		if (!Number.isFinite(minutes)) return '—'
		const hours = Math.floor(minutes / 60)
		const rest = minutes % 60
		return hours ? t('duration', {hours, minutes: rest}) : t('durationMinutes', {minutes: rest})
	}
	const inventoryStatusLabel = (statusCode: string, fallback?: string) => {
		const key = getInventoryStatusKey(statusCode)
		return key ? t(key) : fallback || statusCode
	}
	const [filter, setFilter] = useState<'' | InventoryCheckStatus>('')
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)
	const [showSummary, setShowSummary] = useState(false)
	const [comment, setComment] = useState('')
	const [createError, setCreateError] = useState('')
	const [actionError, setActionError] = useState('')
	const [confirmation, setConfirmation] = useState<Confirmation>(null)
	const [counts, setCounts] = useState<Record<string, string>>({})
	const [savingItemId, setSavingItemId] = useState<string | null>(null)
	const [savedItemId, setSavedItemId] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [countFilter, setCountFilter] = useState<CountFilter>('all')

	const listQuery = useGetInventoryChecksQuery(filter || undefined)
	const statusRulesQuery = useGetInventoryStatusRulesQuery()
	const detailQuery = useGetInventoryCheckQuery(selectedId ?? '', { skip: !selectedId })
	const itemsQuery = useGetInventoryCheckItemsQuery(
		{ id: selectedId ?? '', page: 0, size: PAGE_SIZE },
		{ skip: !selectedId }
	)
	const [createCheck, createState] = useCreateInventoryCheckMutation()
	const [startCheck, startState] = useStartInventoryCheckMutation()
	const [cancelCheck, cancelState] = useCancelInventoryCheckMutation()
	const [completeCheck, completeState] = useCompleteInventoryCheckMutation()
	const [updateItem] = useUpdateInventoryItemMutation()

	const checks = listQuery.data ?? []
	const checkStats = {
		total: checks.length,
		draft: checks.filter(item => item.statusCode === 'DRAFT').length,
		inProgress: checks.filter(item => item.statusCode === 'IN_PROGRESS').length,
		completed: checks.filter(item => item.statusCode === 'COMPLETED').length
	}
	const check = detailQuery.data
	const items = useMemo(() => itemsQuery.data?.content ?? [], [itemsQuery.data?.content])
	const rulesByCode = useMemo(
		() => new Map((statusRulesQuery.data ?? []).map(rule => [rule.code, rule])),
		[statusRulesQuery.data]
	)
	const filters = statusRulesQuery.data?.length
		? [{ value: '' as const, label: t('statuses.all') }, ...statusRulesQuery.data.map(rule => ({ value: rule.code, label: inventoryStatusLabel(rule.code, rule.name) }))]
		: fallbackFilters
	const rule = check ? rulesByCode.get(check.statusCode) : undefined
	const checkIsInitial = check ? isInitial(check, rule) : false
	const checkAllowsCounting = check ? allowsCounting(check, rule) : false
	const checkIsTerminal = check ? isTerminal(check, rule) : false
	const locksWarehouse = rule?.locksWarehouse ?? checkAllowsCounting
	const actionLoading = startState.isLoading || cancelState.isLoading || completeState.isLoading

	useEffect(() => {
		if (!check) return
		setCounts(current => Object.fromEntries(items.map(item => [
			item.id,
			item.actualQuantity === null || item.actualQuantity === undefined
				? (current[item.id] ?? '')
				: String(item.actualQuantity)
		])))
	}, [check, items])

	const progress = useMemo(() => {
		const counted = items.filter(item => item.actualQuantity !== null && item.actualQuantity !== undefined).length
		return { counted, total: items.length, percent: items.length ? Math.round(counted / items.length * 100) : 0 }
	}, [items])

	const stats = useMemo(() => {
		const counted = items.filter(item => discrepancy(item) !== null)
		const matched = counted.filter(item => discrepancy(item) === 0).length
		const surplus = counted.filter(item => (discrepancy(item) ?? 0) > 0)
		const shortage = counted.filter(item => (discrepancy(item) ?? 0) < 0)
		return {
			matched,
			surplusCount: surplus.length,
			shortageCount: shortage.length,
			surplusTotal: surplus.reduce((sum, item) => sum + (discrepancy(item) ?? 0), 0),
			shortageTotal: shortage.reduce((sum, item) => sum + (discrepancy(item) ?? 0), 0)
		}
	}, [items])

	const visibleItems = useMemo(() => {
		const query = search.trim().toLocaleLowerCase(intlLocaleByLocale[locale])
		return items.filter(item => {
			if (query && !item.nomenclatureName.toLocaleLowerCase(intlLocaleByLocale[locale]).includes(query)) return false
			if (countFilter === 'uncounted' && item.actualQuantity !== null && item.actualQuantity !== undefined) return false
			if (countFilter === 'discrepancy' && (discrepancy(item) === null || discrepancy(item) === 0)) return false
			return true
		})
	}, [countFilter, items, locale, search])

	const activeStage: InventoryStage = creating
		? 'document'
		: !check
			? selectedId ? 'document' : 'history'
			: showSummary
				? 'summary'
				: checkIsTerminal
					? 'results'
					: checkAllowsCounting
						? 'counting'
						: 'document'

	const stageEnabled = (stage: InventoryStage) => {
		if (stage === 'history' || stage === 'document') return true
		if (stage === 'counting') return Boolean(check && checkAllowsCounting && !checkIsTerminal)
		if (stage === 'summary') return Boolean(check && checkAllowsCounting && !checkIsTerminal && progress.total > 0 && progress.counted === progress.total)
		return Boolean(check && checkIsTerminal)
	}

	const goToStage = (stage: InventoryStage) => {
		if (!stageEnabled(stage)) return
		setActionError('')
		if (stage === 'history') {
			setSelectedId(null)
			setCreating(false)
			setShowSummary(false)
		} else if (stage === 'document') {
			if (!checkIsInitial) setSelectedId(null)
			setCreating(!checkIsInitial)
			setShowSummary(false)
		} else if (stage === 'summary') {
			setShowSummary(true)
		} else {
			setShowSummary(false)
		}
	}

	const openCheck = (id: string) => {
		setSelectedId(id)
		setCreating(false)
		setShowSummary(false)
		setActionError('')
		setSearch('')
		setCountFilter('all')
	}

	const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setCreateError('')
		if (!comment.trim()) {
			setCreateError(t('commentRequired'))
			return
		}
		try {
			const created = await createCheck({ comment: comment.trim() }).unwrap()
			setComment('')
			openCheck(created.id)
		} catch {
			// Ошибка отображается глобальным обработчиком API.
		}
	}

	const runStart = async () => {
		if (!selectedId) return
		setActionError('')
		try {
			await startCheck(selectedId).unwrap()
		} catch {
			// Ошибка отображается глобальным обработчиком API.
		}
	}

	const runConfirmedAction = async () => {
		if (!selectedId || !confirmation) return
		try {
			if (confirmation === 'cancel') await cancelCheck(selectedId).unwrap()
			else await completeCheck(selectedId).unwrap()
			setShowSummary(false)
		} catch {
			// Ошибка отображается глобальным обработчиком API.
		} finally {
			setConfirmation(null)
		}
	}

	const saveCount = async (itemId: string) => {
		if (!selectedId) return
		const value = parseQuantity(counts[itemId])
		setActionError('')
		setSavedItemId(null)
		if (value === null || value < 0) {
			setActionError(t('invalidQuantity'))
			return
		}
		setSavingItemId(itemId)
		try {
			const saved = await updateItem({ id: selectedId, itemId, body: { actualQuantity: value } }).unwrap()
			setSavedItemId(saved?.id || itemId)
		} catch {
			// Ошибка отображается глобальным обработчиком API.
		} finally {
			setSavingItemId(null)
		}
	}

	const title = check?.comment || t('untitled')

	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_1px_2px_rgba(30,36,32,0.06)]">
			<nav aria-label={t('stagesAria')} className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 p-3">
				{stages.map(stage => {
					const enabled = stageEnabled(stage.id)
					const active = activeStage === stage.id
					return (
						<button
							key={stage.id}
							type="button"
							disabled={!enabled}
							onClick={() => goToStage(stage.id)}
							className={`relative flex min-w-32 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs transition ${active ? 'bg-white font-semibold text-violet-700 shadow-sm ring-1 ring-violet-100' : enabled ? 'text-slate-500 hover:bg-white hover:text-slate-900' : 'cursor-not-allowed text-slate-300'}`}
						>
							<span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-bold ${active ? 'bg-violet-600 text-white' : enabled ? 'bg-slate-200 text-slate-600' : 'bg-slate-100'}`}>{stage.index}</span>
							<span className="whitespace-nowrap">{stage.label}</span>
						</button>
					)
				})}
			</nav>

			<div className="p-4 sm:p-6 lg:p-8">
				{activeStage === 'history' && (
					<section>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="font-mono text-[11px] uppercase text-slate-400">{t('badge')}</p>
								<h2 className="mt-1 text-xl font-semibold tracking-tight">{t('title')}</h2>
								<p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
							</div>
							<div className="flex gap-2">
								<select value={filter} onChange={event => setFilter(event.target.value as '' | InventoryCheckStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500">
									{filters.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
								</select>
								<button type="button" onClick={() => { setCreating(true); setCreateError('') }} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-950/15 hover:bg-violet-700">{t('new')}</button>
							</div>
						</div>

						<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{[
								[t('metrics.total'), checkStats.total, 'bg-violet-500'],
								[t('metrics.drafts'), checkStats.draft, 'bg-slate-500'],
								[t('metrics.counting'), checkStats.inProgress, 'bg-amber-500'],
								[t('metrics.completed'), checkStats.completed, 'bg-emerald-500']
							].map(([label, value, color]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-slate-500">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`} /></div><p className="mt-3 text-2xl font-black text-slate-950">{value}</p></article>)}
						</div>

						{listQuery.isError && <ErrorNotice message={getApiErrorMessage(listQuery.error, t('loadError'))} />}
						<div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
							<table className="w-full min-w-[720px] border-collapse text-left text-sm">
								<thead className="bg-slate-50 font-mono text-[10px] uppercase tracking-wider text-slate-400">
									<tr><th className="px-4 py-3 font-medium">{t('columns.inventory')}</th><th className="px-4 py-3 font-medium">{t('columns.started')}</th><th className="px-4 py-3 font-medium">{t('columns.positions')}</th><th className="px-4 py-3 font-medium">{t('columns.status')}</th><th className="px-4 py-3" /></tr>
								</thead>
								<tbody className="divide-y divide-slate-200">
									{checks.map(item => (
										<tr key={item.id} className="transition hover:bg-violet-50/50">
											<td className="px-4 py-3"><p className="font-medium">{item.comment || t('noComment')}</p><p className="mt-0.5 font-mono text-[11px] text-slate-400">№ {shortId(item.id)}</p></td>
											<td className="px-4 py-3 text-slate-500">{item.startedAt ? formatters.dateTime(item.startedAt) : t('notStarted')}</td>
											<td className="px-4 py-3 font-mono">{item.items.length}</td>
											<td className="px-4 py-3"><StatusPill check={item} rule={rulesByCode.get(item.statusCode)} /></td>
											<td className="px-4 py-3 text-right"><button type="button" onClick={() => openCheck(item.id)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">{commonT('open')}</button></td>
										</tr>
									))}
								</tbody>
							</table>
							{listQuery.isLoading && <StateBlock text={t('loadingHistory')} />}
							{!listQuery.isLoading && checks.length === 0 && <StateBlock text={t('emptyHistory')} />}
						</div>
					</section>
				)}

				{activeStage === 'document' && creating && (
					<section className="max-w-3xl">
						<p className="font-mono text-[11px] uppercase text-slate-400">{t('newBadge')}</p>
						<h2 className="mt-1 text-xl font-semibold">{t('createTitle')}</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('createHint')}</p>
						<form onSubmit={handleCreate} className="mt-6 rounded-lg border border-slate-200 p-5">
							<label className="block text-sm font-medium">{t('nameOrComment')}</label>
							<textarea rows={4} value={comment} onChange={event => setComment(event.target.value)} placeholder={t('commentPlaceholder')} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
							{createError && <ErrorNotice message={createError} />}
							<div className="mt-5 flex gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">{commonT('cancel')}</button><button type="submit" disabled={createState.isLoading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createState.isLoading ? t('creating') : t('createDraft')}</button></div>
						</form>
					</section>
				)}

				{detailQuery.isLoading && activeStage !== 'history' && <StateBlock text={t('loading')} />}
				{detailQuery.isError && <ErrorNotice message={getApiErrorMessage(detailQuery.error, t('notFound'))} />}

				{check && activeStage === 'document' && !creating && (
					<section>
						<InventoryHeader check={check} rule={rule} title={title} />
						<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t('documentReady')}</p>
						<div className="mt-5 grid gap-3 sm:grid-cols-3">
							<Metric label={t('snapshotPositions')} value={itemsQuery.isLoading ? '…' : items.length} />
							<Metric label={t('created')} value={check.startedAt ? formatters.dateTime(check.startedAt) : t('statuses.DRAFT')} compact />
							<Metric label={t('warehouseState')} value={t('operationsAvailable')} compact />
						</div>
						{actionError && <ErrorNotice message={actionError} />}
						<div className="mt-6 flex flex-wrap gap-2">
							{checkIsInitial && <button type="button" onClick={runStart} disabled={actionLoading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{startState.isLoading ? t('starting') : t('start')}</button>}
							{!checkIsTerminal && <button type="button" onClick={() => setConfirmation('cancel')} className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">{t('cancelDocument')}</button>}
						</div>
					</section>
				)}

				{check && activeStage === 'counting' && (
					<section>
						<InventoryHeader check={check} rule={rule} title={title} />
						{locksWarehouse && <div className="mt-4 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700"><span aria-hidden="true">⌑</span> {t('locked')}</div>}
						<div className="mt-5 flex items-end justify-between gap-4"><div className="font-mono text-2xl font-semibold">{t('progress', {counted: progress.counted, total: progress.total})}</div><span className="text-xs text-slate-500">{t('discrepancies', {count: stats.surplusCount + stats.shortageCount})}</span></div>
						<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress.percent}%` }} /></div>
						<div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
							<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('search')} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500" />
							<div className="flex w-fit rounded-full border border-slate-200 bg-slate-50 p-0.5">{([['all', t('filters.all')], ['uncounted', t('filters.uncounted')], ['discrepancy', t('filters.discrepancy')]] as Array<[CountFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setCountFilter(value)} className={`rounded-full px-3 py-1.5 text-xs ${countFilter === value ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
						</div>
						{actionError && <ErrorNotice message={actionError} />}
						{itemsQuery.isError && <ErrorNotice message={getApiErrorMessage(itemsQuery.error, t('positionsError'))} />}
						<ItemsLedger items={visibleItems} counts={counts} editable savingItemId={savingItemId} savedItemId={savedItemId} onChange={(id, value) => { setCounts(current => ({ ...current, [id]: value })); setSavedItemId(null) }} onSave={saveCount} />
						{!itemsQuery.isLoading && visibleItems.length === 0 && <StateBlock text={t('filterEmpty')} />}
						<div className="sticky bottom-3 mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(30,36,32,0.05)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
							<span className="text-xs text-slate-500">{progress.counted === progress.total && progress.total > 0 ? t('allCounted') : t('remaining', {count: progress.total - progress.counted})}</span>
							<div className="flex gap-2"><button type="button" onClick={() => setConfirmation('cancel')} className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600">{commonT('cancel')}</button><button type="button" disabled={!stageEnabled('summary')} onClick={() => setShowSummary(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-35">{t('proceed')}</button></div>
						</div>
					</section>
				)}

				{check && activeStage === 'summary' && (
					<section>
						<InventoryHeader check={check} rule={rule} title={t('summaryTitle')} />
						<p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{t('summaryHint')}</p>
						<SummaryMetrics total={items.length} stats={stats} />
						<ItemsLedger items={items.filter(item => discrepancy(item) !== null && discrepancy(item) !== 0)} counts={counts} />
						<div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setShowSummary(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('backToCounting')}</button><button type="button" onClick={() => setConfirmation('complete')} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">{t('complete')}</button></div>
					</section>
				)}

				{check && activeStage === 'results' && (
					<section>
						<InventoryHeader check={check} rule={rule} title={title} />
						<div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"><span>{t('started')}: <b className="font-mono font-medium text-slate-900">{check.startedAt ? formatters.dateTime(check.startedAt) : '—'}</b></span><span>{t('finished')}: <b className="font-mono font-medium text-slate-900">{check.completedAt ? formatters.dateTime(check.completedAt) : '—'}</b></span><span>{t('durationLabel')}: <b className="font-mono font-medium text-slate-900">{durationLabel(check.startedAt, check.completedAt)}</b></span></div>
						{check.statusCode === 'CANCELLED' ? <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{t('cancelledHint')}</div> : <><SummaryMetrics total={items.length} stats={stats} /><ItemsLedger items={items} counts={counts} /></>}
					</section>
				)}
			</div>

			{confirmation && check && (
				<Modal contentClassName="max-w-md border border-slate-200 bg-white p-5 sm:p-6">
					<div role="alertdialog" aria-modal="true">
						<h2 className="text-lg font-semibold">{confirmation === 'cancel' ? t('cancelTitle') : t('completeTitle')}</h2>
						<p className="mt-2 text-sm leading-6 text-slate-500">{confirmation === 'cancel' ? t('cancelHint') : t('completeHint')}</p>
						<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmation(null)} disabled={actionLoading} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">{t('returning')}</button><button type="button" onClick={runConfirmedAction} disabled={actionLoading} className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmation === 'cancel' ? 'bg-red-600' : 'bg-blue-600'}`}>{actionLoading ? commonT('processing') : confirmation === 'cancel' ? t('cancelConfirm') : t('completeConfirm')}</button></div>
					</div>
				</Modal>
			)}
		</div>
	)
}

function InventoryHeader({ check, rule, title }: { check: InventoryCheck; rule?: InventoryStatusRule; title: string }) {
	const t = useTranslations('warehouse.inventory')
	return <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-[11px] uppercase text-slate-400">{t('headerNumber', {id: shortId(check.id)})}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2></div><StatusPill check={check} rule={rule} /></div>
}

function StatusPill({ check, rule }: { check: InventoryCheck; rule?: InventoryStatusRule }) {
	const t = useTranslations('warehouse.inventory')
	const key = getInventoryStatusKey(check.statusCode)
	return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(check.statusCode)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{key ? t(key) : rule?.name || check.statusCode}</span>
}

function Metric({ label, value, tone, compact = false }: { label: string; value: React.ReactNode; tone?: 'positive' | 'negative'; compact?: boolean }) {
	return <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 font-mono font-semibold ${compact ? 'text-sm' : 'text-xl'} ${tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-600' : ''}`}>{value}</p></div>
}

function SummaryMetrics({ total, stats }: { total: number; stats: { matched: number; surplusCount: number; shortageCount: number; surplusTotal: number; shortageTotal: number } }) {
	const t = useTranslations('warehouse.inventory.metricsSummary')
	const formatters = useAppFormatters()
	return <div className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Metric label={t('total')} value={formatters.number(total)} /><Metric label={t('matched')} value={formatters.number(stats.matched)} /><Metric label={t('surplus')} value={formatters.number(stats.surplusCount)} tone="positive" /><Metric label={t('shortage')} value={formatters.number(stats.shortageCount)} tone="negative" /><Metric label={t('surplusTotal')} value={`+${formatters.number(stats.surplusTotal, {maximumFractionDigits: 3})}`} tone="positive" /><Metric label={t('shortageTotal')} value={formatters.number(stats.shortageTotal, {maximumFractionDigits: 3})} tone="negative" /></div>
}

function ItemsLedger({ items, counts, editable = false, savingItemId, savedItemId, onChange, onSave }: { items: InventoryCheckItem[]; counts: Record<string, string>; editable?: boolean; savingItemId?: string | null; savedItemId?: string | null; onChange?: (id: string, value: string) => void; onSave?: (id: string) => void }) {
	const t = useTranslations('warehouse.inventory.ledger')
	const commonT = useTranslations('common.actions')
	const formatters = useAppFormatters()
	const quantity = (value: number | null | undefined, unit?: string) => value === null || value === undefined || !Number.isFinite(value) ? '—' : `${formatters.number(value, {maximumFractionDigits: 3})}${unit ? ` ${unit}` : ''}`
	const difference = (value: number | null, unit?: string) => value === null ? '—' : `${value > 0 ? '+' : ''}${quantity(value, unit)}`
	return <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead className="bg-slate-50 font-mono text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3 font-medium">{t('material')}</th><th className="w-36 px-4 py-3 font-medium">{t('actual')}</th><th className="w-28 px-4 py-3 font-medium">{t('difference')}</th><th className="w-36 px-4 py-3 font-medium">{t('status')}</th></tr></thead><tbody className="divide-y divide-slate-200">{items.map(item => {
		const typed = editable ? parseQuantity(counts[item.id]) : item.actualQuantity
		const diff = typed === null || typed === undefined ? null : typed - item.expectedQuantity
		const saved = item.actualQuantity !== null && item.actualQuantity !== undefined && typed === item.actualQuantity
		const dirty = typed !== null && typed !== undefined && typed !== item.actualQuantity
		return <tr key={item.id} className="hover:bg-slate-50/50"><td className="px-4 py-3"><p className="font-medium">{item.nomenclatureName}</p><p className="mt-0.5 font-mono text-[11px] text-slate-400">{t('expected', {quantity: quantity(item.expectedQuantity, item.unit)})}</p></td><td className="px-4 py-3">{editable ? <div className="relative"><input aria-label={t('actualAria', {name: item.nomenclatureName})} type="number" min="0" step="0.001" value={counts[item.id] ?? ''} onChange={event => onChange?.(item.id, event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 pr-9 font-mono outline-none focus:border-blue-500" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{item.unit}</span></div> : <span className="font-mono">{quantity(item.actualQuantity, item.unit)}</span>}</td><td className={`px-4 py-3 font-mono font-semibold ${diff === null || diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{difference(diff, item.unit)}</td><td className="px-4 py-3">{editable ? savingItemId === item.id ? <span className="text-xs text-slate-400">{t('saving')}</span> : dirty ? <button type="button" onClick={() => onSave?.(item.id)} disabled={savingItemId !== null} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40">{commonT('save')}</button> : saved || savedItemId === item.id ? <span className="text-xs font-medium text-blue-600">{t('saved')}</span> : <span className="text-xs text-slate-400">{t('unspecified')}</span> : <span className={`text-xs ${item.actualQuantity === null ? 'text-slate-400' : 'text-blue-600'}`}>{item.actualQuantity === null ? t('uncounted') : t('counted')}</span>}</td></tr>
	})}</tbody></table></div>
}

function ErrorNotice({ message }: { message: string }) {
	return <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{message}</div>
}

function StateBlock({ text }: { text: string }) {
	return <div className="px-4 py-12 text-center text-sm text-slate-500">{text}</div>
}
