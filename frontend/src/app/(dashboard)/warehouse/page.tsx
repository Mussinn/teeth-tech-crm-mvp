'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import InventoryPanel from '@/src/components/warehouse/InventoryPanel'
import NomenclaturePanel from '@/src/components/warehouse/NomenclaturePanel'
import ProcurementPanel from '@/src/components/warehouse/ProcurementPanel'
import WarehouseOverview from '@/src/components/warehouse/WarehouseOverview'
import {useTranslations} from 'next-intl'

type WarehouseTab = 'overview' | 'procurement' | 'nomenclature' | 'inventory'

const tabIds: WarehouseTab[] = ['overview', 'procurement', 'nomenclature', 'inventory']

export default function WarehousePage() {
	const t = useTranslations('warehouse.tabs')
	const router = useRouter()
	const searchParams = useSearchParams()
	const requestedTab = searchParams.get('tab') as WarehouseTab | null
	const initialTab = requestedTab && tabIds.includes(requestedTab) ? requestedTab : 'overview'
	const [localTab, setLocalTab] = useState<WarehouseTab>(initialTab)
	const activeTab = requestedTab && tabIds.includes(requestedTab) ? requestedTab : localTab
	const selectTab = (tab: WarehouseTab) => {
		setLocalTab(tab)
		router.replace(`/warehouse?tab=${tab}`, { scroll: false })
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] pb-8">
			<nav aria-label={t(activeTab)} className="sr-only">{tabIds.map(tab => <span key={tab}>{t(tab)}</span>)}</nav>
			{activeTab === 'overview' && (
				<WarehouseOverview
					onOpenNomenclature={() => selectTab('nomenclature')}
					onOpenInventory={() => selectTab('inventory')}
				/>
			)}
			{activeTab === 'procurement' && <ProcurementPanel />}
			{activeTab === 'nomenclature' && <NomenclaturePanel />}
			{activeTab === 'inventory' && <InventoryPanel />}
		</div>
	)
}
