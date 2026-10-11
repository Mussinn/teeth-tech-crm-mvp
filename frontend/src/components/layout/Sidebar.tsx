'use client'

import AppIcon from '@/src/components/ui/AppIcon'

import { isMvpRouteEnabled } from '@/src/lib/mvp'
import TeethTechLogo from '@/src/components/branding/TeethTechLogo'
import { logout } from '@/src/features/auth/authSlice'
import {
	canAccessManagementZone,
	canAccessWorkZone,
	getManagementRedirectPath,
	normalizeAuthRoles,
	WORKSPACE_STORAGE_KEY
} from '@/src/features/auth/authUtils'
import { useNotifications } from '@/src/features/notifications/useNotifications'
import { AppDispatch, RootState } from '@/src/lib/store'
import { teethTechApi } from '@/src/services/teethTechApi'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslations } from 'next-intl'

type MenuItem = {
	name: string
	href: string
	exact?: boolean
	children?: {
		name: string
		href: string
	}[]
}

type SidebarProps = {
	isOpen: boolean
	onClose: () => void
}

type MenuSection = 'main' | 'production' | 'finance' | 'system'

function getMenuSection(item: MenuItem): MenuSection {
	if (
		item.href === '/'
		|| item.href.startsWith('/orders')
		|| item.href.startsWith('/analytics')
		|| item.href.startsWith('/tv-dashboard')
	) return 'main'
	if (item.href.startsWith('/employee')) return 'main'
	if (
		item.href.startsWith('/warehouse')
		|| item.href.startsWith('/clinics')
		|| item.href.startsWith('/laboratory')
	) return 'production'
	if (
		item.href.startsWith('/accounting')
		|| item.href.startsWith('/documents')
	) return 'finance'
	return 'system'
}

const menuSectionOrder: MenuSection[] = ['main', 'production', 'finance', 'system']

function MenuIcon({ href }: { href: string }) {
	const common = 'h-[18px] w-[18px] shrink-0'
    const icons = {'/support':'support','/training':'training','/community':'community','/kpi':'kpi','/employee/kpi':'kpi','/notes':'notes','/laboratory/cases':'cases'} as const;
    const icon = icons[href as keyof typeof icons];
    if (icon) return <AppIcon name={icon} className={common}/>;
	if (href === '/') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeWidth="1.7" strokeLinejoin="round" /></svg>
	if (href.startsWith('/tv-dashboard')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="1.7"/><path d="M8 22h8M12 18v4M7 9h3v5H7zM12 7h3v7h-3zM17 11h2v3h-2z" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
	if (href === '/employee') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><circle cx="12" cy="8" r="4" strokeWidth="1.7"/><path d="M4 21a8 8 0 0 1 16 0" strokeWidth="1.7" strokeLinecap="round"/><path d="m17.5 5.5 1 1 2-2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
	if (href.startsWith('/employee/calendar')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><rect x="3" y="5" width="18" height="16" rx="3" strokeWidth="1.7"/><path d="M8 3v4M16 3v4M3 10h18" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 14h2M14 14h2M8 17h2" strokeWidth="1.7" strokeLinecap="round"/></svg>
	if (href.startsWith('/employee/analytics')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 20V10m5 10V5m5 15v-7m5 7V8" strokeWidth="1.8" strokeLinecap="round"/><path d="m4 7 5-3 5 5 6-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
	if (href.startsWith('/orders')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M6 3h12l2 4-2 4H6L4 7l2-4Zm0 8v10m12-10v10M8 15h8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
	if (href.startsWith('/analytics')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" strokeWidth="1.8" strokeLinecap="round" /></svg>
	if (href.startsWith('/warehouse')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4m-8 4v10" strokeWidth="1.7" strokeLinejoin="round" /></svg>
	if (href.startsWith('/clinics')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M8 7h4M8 11h4M8 15h2m6-6h2a2 2 0 0 1 2 2v10M2 21h20" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
	if (href.startsWith('/laboratory')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M9 3h6m-5 0v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M8 15h8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
	if (href === '/accounting') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 20V10m5 10V4m5 16v-7m5 7V7" strokeWidth="1.8" strokeLinecap="round"/><path d="m3 6 5-3 5 5 7-5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
	if (href.startsWith('/accounting/payroll')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><rect x="3" y="6" width="18" height="13" rx="3" strokeWidth="1.7"/><path d="M3 10h18M7 15h4" strokeWidth="1.7" strokeLinecap="round"/><circle cx="17" cy="15" r="1.5" strokeWidth="1.5"/></svg>
	if (href.startsWith('/accounting/invoices')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 8h6M9 12h6M9 16h3" strokeWidth="1.7" strokeLinecap="round"/></svg>
	if (href.startsWith('/documents')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M6 3h9l4 4v14H6V3Z" strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 3v5h5M9 12h7M9 16h7" strokeWidth="1.7" strokeLinecap="round"/></svg>
	if (href.startsWith('/settings/integrations')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-5 5v0a5 5 0 0 1-5-5V8Zm5 8v2a3 3 0 0 1-3 3H6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
	if (href.startsWith('/knowledge-base')) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" strokeWidth="1.7" strokeLinejoin="round"/></svg>
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}><circle cx="12" cy="12" r="3" strokeWidth="1.7" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const dispatch = useDispatch<AppDispatch>()
	const router = useRouter()
	const { role, roles } = useSelector((state: RootState) => state.auth)
	const { notifyError, notifySuccess } = useNotifications()
	const t = useTranslations('navigation')
	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const [groupExpansion, setGroupExpansion] = useState<Record<string, boolean>>({})
	const [openMenuSection, setOpenMenuSection] = useState<string | null>(null)
	const normalizedRoles = normalizeAuthRoles(
		roles.length > 0 ? roles : role ? [role] : []
	)
	const canUseWorkZone = canAccessWorkZone(roles, role)
	const canUseManagementZone = canAccessManagementZone(roles, role)
	const isWorkZone = pathname.startsWith('/employee') || !canUseManagementZone
	const managementPath = getManagementRedirectPath(roles, role)
	const getSectionLabel = (section: MenuSection) => {
		switch (section) {
			case 'main': return t('sections.main')
			case 'production': return t('sections.production')
			case 'finance': return t('sections.finance')
			case 'system': return t('sections.system')
		}
	}

	const menuItems: MenuItem[] = (() => {
		if (isWorkZone) {
			return [
				{ name: t('workspace'), href: '/employee', exact: true },
				{ name: t('calendar'), href: '/employee/calendar' },
                { name: 'Мой KPI', href: '/employee/kpi' },
                { name: 'Заметки', href: '/notes' },
                { name: 'Обучение', href: '/training' }
			]
		}

		const items: MenuItem[] = []
		const pushUnique = (item: MenuItem) => {
			if (isMvpRouteEnabled(item.href) && !items.some((existing) => existing.href === item.href)) {
				items.push(item)
			}
		}
		const hasAdmin = normalizedRoles.includes('ADMIN')
		const hasDispatcher = normalizedRoles.includes('DISPATCHER')
		const hasFinancier = normalizedRoles.includes('FINANCIER')
		const hasChiefTechnician =
			normalizedRoles.includes('CHIEF_TECHNICIAN')
			|| normalizedRoles.includes('HEAD_TECHNICIAN')

		if (hasAdmin || hasDispatcher) {
			pushUnique({ name: t('dashboard'), href: '/' })
			pushUnique({
				name: t('orders'),
				href: '/orders'
			})
			pushUnique({ name: t('analytics'), href: '/analytics' })
			pushUnique({
				name: t('warehouse'),
				href: '/warehouse',
				children: [
					{ name: t('overview'), href: '/warehouse?tab=overview' },
					{ name: t('procurement'), href: '/warehouse?tab=procurement' },
					{ name: t('nomenclature'), href: '/warehouse?tab=nomenclature' },
					{ name: t('inventory'), href: '/warehouse?tab=inventory' }
				]
			})
			pushUnique({
				name: t('clinics'),
				href: '/clinics',
				children: [
					{ name: t('registry'), href: '/clinics' },
					{ name: t('patients'), href: '/clinics/patients' }
				]
			})
			pushUnique({name: 'Приём и выдача', href: '/laboratory/cases', exact: true})
			pushUnique({name: t('laboratory'), href: '/laboratory'})
		}

		if (hasFinancier) {
			pushUnique({ name: t('financeReport'), href: '/accounting', exact: true })
			pushUnique({ name: t('salaries'), href: '/accounting/payroll', exact: true })
			pushUnique({ name: t('invoices'), href: '/accounting/invoices' })
		}

		if (hasAdmin || hasFinancier) {
			pushUnique({
				name: t('documents'),
				href: '/documents',
				children: [
					{ name: t('completedWorkActs'), href: '/documents/completed-work-acts' }
				]
			})
		}

		if (hasChiefTechnician) {
			pushUnique({ name: t('payroll'), href: '/accounting/payroll', exact: true })
			pushUnique({name: 'Приём и выдача', href: '/laboratory/cases', exact: true})
			pushUnique({name: t('laboratory'), href: '/laboratory'})
		}

		if (hasAdmin) {
			pushUnique({ name: t('payroll'), href: '/accounting/payroll', exact: true })
			pushUnique({ name: t('integrations'), href: '/settings/integrations', exact: true })
		}

		pushUnique({ name: 'Заметки', href: '/notes' })
        pushUnique({ name: 'Обучение', href: '/training' })
        pushUnique({name:'Поддержка',href:'/support'});
        pushUnique({name:'Сообщество',href:'/community'});
        if (hasChiefTechnician && !hasAdmin && !hasDispatcher) pushUnique({ name: t('analytics'), href: '/analytics' })
        if (hasAdmin || hasChiefTechnician) pushUnique({ name: 'KPI сотрудников', href: '/kpi' })
        return items.sort(
			(left, right) =>
				menuSectionOrder.indexOf(getMenuSection(left))
				- menuSectionOrder.indexOf(getMenuSection(right))
		)
	})()
	const activeMenuSection = getMenuSection(
		menuItems.find(item =>
			pathname === item.href
			|| (!item.exact && pathname.startsWith(`${item.href}/`) && !(item.href === '/laboratory' && pathname === '/laboratory/cases'))
		) ?? menuItems[0]
	)
	const expandedMenuSection = openMenuSection ?? activeMenuSection

	useEffect(() => {
		setOpenMenuSection(null)
	}, [pathname, isWorkZone])

	const handleLogout = async () => {
		if (isLoggingOut) return

		setIsLoggingOut(true)

		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'same-origin'
			})

			if (!response.ok) {
				throw new Error(`Logout failed with status ${response.status}`)
			}

			dispatch(logout())
			dispatch(teethTechApi.util.resetApiState())
			notifySuccess(t('sidebar.logoutSuccess'))
			router.push('/auth/login')
		} catch (error) {
			console.error('Logout failed:', error)
			notifyError(t('sidebar.logoutError'))
		} finally {
			setIsLoggingOut(false)
		}
	}

	const handleNavigate = () => {
		if (window.matchMedia('(max-width: 1023px)').matches) {
			onClose()
		}
	}

	const handleWorkspaceChange = (workspace: 'work' | 'management') => {
		window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace)
		handleNavigate()
	}

	const toggleGroup = (href: string, isExpanded: boolean) => {
		setGroupExpansion({ [href]: !isExpanded })
	}

	const isChildActive = (href: string) => {
		const [childPath, query] = href.split('?')
		if (pathname !== childPath) return false
		if (!query) return true
		const expected = new URLSearchParams(query).get('tab')
		return (searchParams.get('tab') || 'overview') === expected
	}

	return (
		<aside
			data-tour="app-navigation"
			inert={!isOpen}
			aria-hidden={!isOpen}
			className={`fixed inset-y-0 left-ө z-51 h-dvh w-[min(18rem,85vw)] overflow-hidden transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:static lg:z-auto lg:shrink-0 lg:translate-x-0 ${
				isOpen
					? 'translate-x-0 opacity-100 lg:w-64'
					: 'pointer-events-none -translate-x-full opacity-0 lg:w-0'
			}`}
		>
			<div className="flex h-full w-[min(18rem,85vw)] flex-col bg-[#ffffff] text-slate-900 shadow-2xl dark:bg-[#09090b] dark:text-white lg:w-64 lg:shadow-none">
				<div className="flex h-[6.5rem] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
					<TeethTechLogo
						className="w-44"
						priority
					/>

					<button
						onClick={onClose}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition-all hover:scale-105 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/60 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
						aria-label={t('sidebar.close')}
						title={t('sidebar.close')}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth="2.3" strokeLinecap="round">
							<path d="M6 6l12 12M18 6 6 18" />
						</svg>
					</button>
				</div>

				{canUseWorkZone && canUseManagementZone && (
					<div className="border-b border-slate-200 p-3 dark:border-slate-800">
						<p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
							{t('workspaceZone')}
						</p>
						<div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
							<Link
								href="/employee"
								onClick={() => handleWorkspaceChange('work')}
								aria-current={isWorkZone ? 'page' : undefined}
								className={`rounded-lg px-2 py-2 text-center text-xs font-bold transition ${
									isWorkZone
										? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300'
										: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
								}`}
							>
								{t('work')}
							</Link>
							<Link
								href={managementPath}
								onClick={() => handleWorkspaceChange('management')}
								aria-current={!isWorkZone ? 'page' : undefined}
								className={`rounded-lg px-2 py-2 text-center text-xs font-bold transition ${
									!isWorkZone
										? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300'
										: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
								}`}
							>
								{t('management')}
							</Link>
						</div>
					</div>
				)}

				<nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
					{menuItems.map((item, index) => {
						const isParentActive =
							pathname === item.href ||
							(!item.exact && pathname.startsWith(`${item.href}/`) && !(item.href === '/laboratory' && pathname === '/laboratory/cases')) ||
							Boolean(item.children?.some(child => pathname === child.href.split('?')[0]))
						const isGroupExpanded =
							groupExpansion[item.href] ?? isParentActive
						const section = getMenuSection(item)
						const showSection = index === 0
							|| getMenuSection(menuItems[index - 1]) !== section

						return (
							<div key={item.href}>
								{showSection ? (
									<button
										type="button"
										onClick={() => setOpenMenuSection(
											expandedMenuSection === section ? '' : section
										)}
										aria-expanded={expandedMenuSection === section}
										className={`${index === 0 ? 'mb-1' : 'mb-1 mt-2'} flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
									>
										<span>{getSectionLabel(section)}</span>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`h-3.5 w-3.5 transition-transform ${expandedMenuSection === section ? 'rotate-180' : ''}`} aria-hidden="true">
											<path d="m7 10 5 5 5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									</button>
								) : null}
								<div
									inert={expandedMenuSection !== section}
									aria-hidden={expandedMenuSection !== section}
									className={`grid transition-[grid-template-rows,opacity] duration-200 ${
										expandedMenuSection === section
											? 'grid-rows-[1fr] opacity-100'
											: 'grid-rows-[0fr] opacity-0'
									}`}
								>
								<div className="min-h-0 overflow-hidden">
								<div className={`flex items-center rounded-xl transition-colors ${isParentActive ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
								<Link
									href={item.href}
									onClick={handleNavigate}
										className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm font-medium"
								>
									<MenuIcon href={item.href} /><span className="truncate">{item.name}</span>
								</Link>
								{item.children && <button type="button" onClick={() => toggleGroup(item.href, isGroupExpanded)} className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" aria-label={t(isGroupExpanded ? 'sidebar.collapse' : 'sidebar.expand', {name: item.name})} aria-expanded={isGroupExpanded}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`h-4 w-4 transition-transform duration-300 ${isGroupExpanded ? 'rotate-180' : ''}`}><path d="m7 10 5 5 5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
								</div>

								{item.children && (
									<div
										inert={!isGroupExpanded}
										aria-hidden={!isGroupExpanded}
										className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
											isGroupExpanded
												? 'mt-1 grid-rows-[1fr] opacity-100'
												: 'mt-0 grid-rows-[0fr] opacity-0'
										}`}
									>
										<div className="min-h-0 overflow-hidden">
										<div className="relative ml-5 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
										{item.children.map(child => {
											const childActive = isChildActive(child.href)

											return (
												<Link
													key={child.href}
													href={child.href}
													onClick={handleNavigate}
													className={`relative block rounded-lg px-3 py-2 text-xs transition-colors ${
														childActive
															? 'bg-violet-50 font-semibold text-violet-700 before:absolute before:-left-[13px] before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-violet-500 dark:bg-violet-500/15 dark:text-violet-300'
															: 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white'
													}`}
												>
													{child.name}
												</Link>
											)
										})}
										</div>
									</div>
									</div>
									)}
								</div>
								</div>
							</div>
						)
					})}
				</nav>

				<div className="border-t border-slate-200 p-4 dark:border-slate-800">
					<button
						onClick={handleLogout}
						disabled={isLoggingOut}
						className="group flex w-full items-center gap-3 rounded-lg p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-600/20 dark:hover:text-white disabled:cursor-wait disabled:opacity-60"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5 group-hover:text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>

						<span className="text-sm font-bold tracking-wide">
							{isLoggingOut ? t('sidebar.loggingOut') : t('sidebar.logout')}
						</span>
					</button>
				</div>
			</div>
		</aside>
	)
}
