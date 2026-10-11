'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {useTranslations} from 'next-intl';

export default function Breadcrumbs() {
    const t = useTranslations('navigation');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const segments = pathname.split('/').filter(Boolean);
    const segmentLabel = (segment: string, previousSegment?: string) => {
        switch (segment) {
            case 'orders': return t('orders');
            case 'analytics': return t('analytics');
            case 'kpi': return 'KPI';
            case 'training': return 'Обучение';
            case 'support': return 'Поддержка';
            case 'community': return 'Сообщество';
            case 'cases': return 'Приём и выдача';
            case 'materials': return 'Материалы';
            case 'catalogs': return 'Технические справочники';
            case 'statuses': return 'Статусы';
            case 'work-directions': return 'Направления работ';
            case 'warehouse': return t('warehouse');
            case 'clinics': return t('clinics');
            case 'patients': return t('patients');
            case 'laboratory': return t('laboratory');
            case 'employees': return t('employees');
            case 'employee': return t('workspace');
            case 'calendar': return t('calendar');
            case 'accounting': return t('financeReport');
            case 'payroll': return t('payroll');
            case 'invoices': return t('invoices');
            case 'documents': return t('documents');
            case 'completed-work-acts': return t('completedWorkActs');
            case 'settings': return t('settings');
            case 'integrations': return t('integrations');
            case 'chats': return t('chats');
            case 'tasks': return t('tasks');
            case 'notes': return t('notes');
            case 'work-types': return t('workTypes');
            case 'roles': return t('roles');
            case 'colors': return t('colors');
            case 'knowledge-base': return t('knowledgeBase');
            case 'tv-dashboard': return t('tvDashboard');
        }

        if (previousSegment === 'orders') return t('orderDetails');
        if (previousSegment === 'employees') return t('employeeDetails');
        if (previousSegment === 'chats') return t('conversation');

        const decoded = decodeURIComponent(segment);
        if (/^[0-9a-f-]{16,}$/iu.test(decoded)) return t('details');

        return decoded
            .replace(/[-_]+/gu, ' ')
            .replace(/^./u, (letter) => letter.toLocaleUpperCase());
    };
    const warehouseTabLabel = (tab: string) => {
        switch (tab) {
            case 'procurement': return t('procurement');
            case 'nomenclature': return t('nomenclature');
            case 'inventory': return t('inventory');
            default: return t('overview');
        }
    };
    const crumbs = [
        { label: t('home'), href: '/' },
        ...segments.map((segment, index) => ({
            label: segmentLabel(segment, segments[index - 1]),
            href: `/${segments.slice(0, index + 1).join('/')}`,
        })),
    ];

    if (pathname === '/warehouse') {
        const tab = searchParams.get('tab') || 'overview';
        if (tab !== 'overview' && ['procurement', 'nomenclature', 'inventory'].includes(tab)) {
            crumbs.push({
                label: warehouseTabLabel(tab),
                href: `/warehouse?tab=${tab}`,
            });
        }
    }

    return (
        <nav
            aria-label={t('breadcrumb')}
            className="relative z-30 flex h-10 shrink-0 items-center border-b border-slate-200/80 bg-[var(--app-background)] px-4 dark:border-slate-800 sm:px-6 lg:px-8"
        >
            <ol className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
                {crumbs.map((crumb, index) => {
                    const isCurrent = index === crumbs.length - 1;

                    return (
                        <li key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
                            {index > 0 && (
                                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true">
                                    <path d="m7 4 6 6-6 6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            {isCurrent ? (
                                <span aria-current="page" className="max-w-52 truncate rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                    {crumb.label}
                                </span>
                            ) : (
                                <Link href={crumb.href} className="max-w-44 truncate rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
                                    {index === 0 ? (
                                        <span className="flex items-center gap-1.5">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                                                <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z" strokeWidth="1.8" strokeLinejoin="round" />
                                            </svg>
                                            {crumb.label}
                                        </span>
                                    ) : crumb.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
