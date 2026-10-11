'use client'

import { useAppTheme } from '@/src/hooks/useAppTheme'
import {useTranslations} from 'next-intl'

export default function ThemeToggle() {
	const { theme, setTheme } = useAppTheme()
	const t = useTranslations('common.theme')
	const isDark = theme === 'dark'

	const toggleTheme = () => {
		setTheme(isDark ? 'light' : 'dark')
	}

	return (
		<button
			type="button"
			onClick={toggleTheme}
			className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
			aria-label={isDark ? t('enableLight') : t('enableDark')}
			title={isDark ? t('light') : t('dark')}
		>
			{isDark ? (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
				</svg>
			) : (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
					<path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />
				</svg>
			)}
			<span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">
				{isDark ? t('light') : t('dark')}
			</span>
		</button>
	)
}
