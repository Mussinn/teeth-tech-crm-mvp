'use client'

import { RootState } from '@/src/lib/store'
import { getDisplayRoleNames, normalizeAuthRoles } from '@/src/features/auth/authUtils'
import Link from 'next/link'
import {mvpModules} from '@/src/lib/mvp'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'

type HeaderProps = {
	onMenuClick?: () => void
	isMenuOpen?: boolean
}

export default function Header({ onMenuClick, isMenuOpen = false }: HeaderProps) {
	const { name, role, roles } = useSelector((state: RootState) => state.auth)
	const { totalUnreadCount } = useSelector((state: RootState) => state.chat)
	const tAuth = useTranslations('auth')
	const tRoles = useTranslations('auth.roles')
	const tCommon = useTranslations('common')
	const tHeader = useTranslations('header')
	const [isProfileOpen, setIsProfileOpen] = useState(false)
	const profileRef = useRef<HTMLDivElement | null>(null)
	const getRoleLabel = (code: string) => {
		switch (code) {
			case 'ADMIN': return tRoles('ADMIN')
			case 'CHIEF_TECHNICIAN': return tRoles('CHIEF_TECHNICIAN')
			case 'HEAD_TECHNICIAN': return tRoles('HEAD_TECHNICIAN')
			case 'DISPATCHER': return tRoles('DISPATCHER')
			case 'TECHNICIAN': return tRoles('TECHNICIAN')
			case 'FINANCIER': return tRoles('FINANCIER')
			case 'PROSTHETIST': return tRoles('PROSTHETIST')
			default: return code.replaceAll('_', ' ').toLowerCase()
		}
	}
	const normalizedRoles = normalizeAuthRoles(
		roles.length > 0 ? roles : role ? [role] : []
	)
	const canOpenTvDashboard =
		normalizedRoles.includes('ADMIN')
		|| normalizedRoles.includes('DISPATCHER')
	const displayRoles = getDisplayRoleNames(
		roles.length > 0 ? roles : role ? [role] : []
	)
	const roleLabel = displayRoles.length > 0
		? displayRoles
			.map(getRoleLabel)
			.join(' · ')
		: tCommon('states.roleMissing')
	useEffect(() => {
		if (!isProfileOpen) return

		const handlePointerDown = (event: PointerEvent) => {
			if (!profileRef.current?.contains(event.target as Node)) {
				setIsProfileOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsProfileOpen(false)
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isProfileOpen])

	return (
		<header className="relative z-50 flex h-16 shrink-0 items-center justify-between bg-[var(--app-background)] px-4 sm:px-6 lg:px-8">
			{!isMenuOpen && (
				<button
					type="button"
					onClick={onMenuClick}
					data-tour="app-menu"
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
					aria-label={tHeader('openMenu')}
					aria-expanded={isMenuOpen}
				>
					<svg
						className="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<path d="M4 6h16" />
						<path d="M4 12h16" />
						<path d="M4 18h16" />
					</svg>
				</button>
			)}

			<div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
				<LanguageSwitcher compact />
				<ThemeToggle />
				<Link
					href="/notes"
					aria-label={tHeader('openNotes')}
					title={tHeader('notes')}
					className="group relative hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
						<path d="M6 3h9l4 4v14H6V3Z" strokeWidth="1.8" strokeLinejoin="round"/>
						<path d="M14 3v5h5M9 12h6M9 16h4" strokeWidth="1.8" strokeLinecap="round"/>
					</svg>
					<span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{tHeader('notes')}</span>
				</Link>
				<Link
					href="/knowledge-base"
					data-tour="knowledge-base"
					aria-label={tHeader('knowledgeBase')}
					title={tHeader('knowledgeBase')}
					className="group relative hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
						<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" strokeWidth="1.7" strokeLinejoin="round"/>
					</svg>
					<span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{tHeader('knowledgeBase')}</span>
				</Link>
				{canOpenTvDashboard && (
					<Link
						href="/tv-dashboard"
						aria-label={tHeader('openTvDashboard')}
						title={tHeader('tvDashboard')}
						className="group relative hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
							<rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="1.7"/>
							<path d="M8 22h8M12 18v4M7 9h3v5H7zM12 7h3v7h-3zM17 11h2v3h-2z" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
						<span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{tHeader('tvDashboard')}</span>
					</Link>
				)}
{mvpModules.chat && (				<Link
					href="/chats"
					aria-label={
						totalUnreadCount > 0
							? tHeader('unreadMessages', {count: totalUnreadCount})
							: tHeader('messages')
					}
					title={tHeader('messages')}
					className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
				>
					<svg
						className="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					{totalUnreadCount > 0 ? (
						<span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow-sm ring-2 ring-white">
							{totalUnreadCount > 99 ? '99+' : totalUnreadCount}
						</span>
					) : null}
					<span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{tHeader('messages')}</span>
				</Link>)}
				<div ref={profileRef} className="group relative">
					<button
						type="button"
						onClick={() => setIsProfileOpen(current => !current)}
						title={tHeader('userProfile')}
						aria-label={tHeader('openProfileMenu')}
						aria-expanded={isProfileOpen}
						aria-haspopup="menu"
						className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${isProfileOpen ? 'ring-2 ring-violet-300 ring-offset-2' : ''}`}
					>
						{name?.[0]}
					</button>
					{!isProfileOpen && <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-within:block">{tHeader('userProfile')}</span>}

					{isProfileOpen && (
						<div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900">
							<div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-700 p-4 text-white">
								<div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
								<div className="relative flex items-center gap-3">
									<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-lg font-black shadow-inner">
										{name?.[0] || tAuth('user').charAt(0)}
									</span>
									<div className="min-w-0">
										<p className="truncate text-sm font-black">{name || tAuth('user')}</p>
										<p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-violet-100">{roleLabel}</p>
									</div>
								</div>
							</div>

							<div className="p-2">
								<Link role="menuitem" href="/settings?tab=profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-violet-500/15">
									<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" aria-hidden="true"><circle cx="12" cy="8" r="4" strokeWidth="1.8"/><path d="M4 21a8 8 0 0 1 16 0" strokeWidth="1.8"/></svg>
									</span>
									<span className="min-w-0 flex-1"><span className="block">{tHeader('personalAccount')}</span><span className="block text-[10px] font-medium text-slate-400">{tHeader('profileDescription')}</span></span>
									<span className="text-slate-300">›</span>
								</Link>
								<Link role="menuitem" href="/settings?tab=security" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
									<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeWidth="1.8"/></svg>
									</span>
									<span className="min-w-0 flex-1"><span className="block">{tHeader('security')}</span><span className="block text-[10px] font-medium text-slate-400">{tHeader('securityDescription')}</span></span>
								</Link>
							</div>

							<Link role="menuitem" href="/settings" onClick={() => setIsProfileOpen(false)} className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black text-violet-700 transition hover:bg-violet-50 dark:border-slate-800 dark:bg-slate-950 dark:text-violet-300">
								{tHeader('openPersonalAccount')}
								<span>→</span>
							</Link>
						</div>
					)}
				</div>
			</div>
		</header>
	)
}
