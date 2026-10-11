'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';

import Sidebar from '@/src/components/layout/Sidebar';
import Header from '@/src/components/layout/Header';
import {
    canAccessWorkZone,
    getAuthRedirectPath,
    normalizeAuthRoles,
    WORKSPACE_STORAGE_KEY,
} from '@/src/features/auth/authUtils';
import { RootState } from '@/src/lib/store';
import {mvpModules} from '@/src/lib/mvp';
import ChatNotifications from '@/src/components/Chat/ChatNotifications';
import ChatButton from '@/src/components/Chat/ChatButton';
import PersonalNotesModal from '@/src/components/personal-notes/PersonalNotesModal';
import QuickActionsMenu from '@/src/components/layout/QuickActionsMenu';
import Breadcrumbs from '@/src/components/layout/Breadcrumbs';
import GuidedTour from '@/src/components/guidance/GuidedTour';

const SIDEBAR_STORAGE_KEY = 'teeth-tech-sidebar-open';

export default function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isInitialized, role, roles } = useSelector((state: RootState) => state.auth);
    const normalizedJwtRoles = normalizeAuthRoles(
        roles.length > 0 ? roles : role ? [role] : []
    );
    const isPayrollPage = pathname.startsWith('/accounting/payroll');
    const canViewAccounting = normalizedJwtRoles.includes('FINANCIER');
    const canViewDocuments = normalizedJwtRoles.some((item) =>
        ['ADMIN', 'FINANCIER'].includes(item)
    );
    const canViewPayroll =
        normalizedJwtRoles.some((item) =>
            ['ADMIN', 'FINANCIER', 'CHIEF_TECHNICIAN', 'HEAD_TECHNICIAN'].includes(item)
        );
    const canViewRoles =
        normalizedJwtRoles.includes('ADMIN')
        || normalizedJwtRoles.includes('CHIEF_TECHNICIAN');
    const canViewWorkDirections = normalizedJwtRoles.includes('ADMIN');
    const canViewWorkZone = canAccessWorkZone(roles, role);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (
            isInitialized
            && isAuthenticated
            && role
            && pathname.startsWith('/laboratory/work-directions')
            && !canViewWorkDirections
        ) {
            router.replace(getAuthRedirectPath(role, roles));
        }
    }, [canViewWorkDirections, isAuthenticated, isInitialized, pathname, role, roles, router]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const syncSidebarState = () => {
            if (!mediaQuery.matches) {
                setIsSidebarOpen(false);
                return;
            }

            setIsSidebarOpen(
                window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false'
            );
        };

        syncSidebarState();
        mediaQuery.addEventListener('change', syncSidebarState);

        return () => mediaQuery.removeEventListener('change', syncSidebarState);
    }, []);

    const setSidebarOpen = (nextOpen: boolean) => {
        setIsSidebarOpen(nextOpen);
        if (window.matchMedia('(min-width: 1024px)').matches) {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextOpen));
        }
    };

    useEffect(() => {
        if (!isSidebarOpen || !window.matchMedia('(max-width: 1023px)').matches) return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSidebarOpen(false);
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSidebarOpen]);

    useEffect(() => {
        if (isInitialized && !isAuthenticated) {
            router.replace('/auth/login');
        }
    }, [isAuthenticated, isInitialized, router]);

    useEffect(() => {
        if (!isAuthenticated) return;

        if (pathname.startsWith('/employee')) {
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, 'work');
            return;
        }

        if (
            pathname === '/'
            || [
                '/orders',
                '/analytics',
                '/warehouse',
                '/clinics',
                '/laboratory',
                '/accounting',
                '/documents',
                '/tv-dashboard',
            ].some((prefix) => pathname.startsWith(prefix))
        ) {
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, 'management');
        }
    }, [isAuthenticated, pathname]);

    useEffect(() => {
        if (
            isInitialized
            && isAuthenticated
            && role
            && pathname.startsWith('/documents')
            && !canViewDocuments
        ) {
            router.replace(getAuthRedirectPath(role, roles));
        }
    }, [canViewDocuments, isAuthenticated, isInitialized, pathname, role, roles, router]);

    useEffect(() => {
        if (
            isInitialized &&
            isAuthenticated &&
            role &&
            pathname.startsWith('/accounting') &&
            (
                (isPayrollPage && !canViewPayroll)
                || (!isPayrollPage && !canViewAccounting)
            )
        ) {
            router.replace(getAuthRedirectPath(role, roles));
        }
    }, [canViewAccounting, canViewPayroll, isAuthenticated, isInitialized, isPayrollPage, pathname, role, roles, router]);

    useEffect(() => {
        if (
            isInitialized
            && isAuthenticated
            && role
            && pathname.startsWith('/laboratory/roles')
            && !canViewRoles
        ) {
            router.replace(getAuthRedirectPath(role, roles));
        }
    }, [canViewRoles, isAuthenticated, isInitialized, pathname, role, roles, router]);

    useEffect(() => {
        if (
            isInitialized
            && isAuthenticated
            && role
            && pathname.startsWith('/employee')
            && !canViewWorkZone
        ) {
            router.replace(getAuthRedirectPath(role, roles));
        }
    }, [canViewWorkZone, isAuthenticated, isInitialized, pathname, role, roles, router]);

    const isAccountingAccessDenied =
        isAuthenticated &&
        role !== null &&
        pathname.startsWith('/accounting') &&
        (
            (isPayrollPage && !canViewPayroll)
            || (!isPayrollPage && !canViewAccounting)
        );
    const isRolesAccessDenied =
        isAuthenticated
        && pathname.startsWith('/laboratory/roles')
        && !canViewRoles;
    const isWorkDirectionsAccessDenied =
        isAuthenticated
        && pathname.startsWith('/laboratory/work-directions')
        && !canViewWorkDirections;
    const isDocumentsAccessDenied =
        isAuthenticated
        && pathname.startsWith('/documents')
        && !canViewDocuments;
    const isWorkZoneAccessDenied =
        isAuthenticated
        && pathname.startsWith('/employee')
        && !canViewWorkZone;

    if (
        !isInitialized
        || !isAuthenticated
        || isAccountingAccessDenied
        || isRolesAccessDenied
        || isWorkDirectionsAccessDenied
        || isDocumentsAccessDenied
        || isWorkZoneAccessDenied
    ) return null;

    return (
        <div className="relative flex h-dvh w-full overflow-hidden bg-slate-50 dark:bg-[#09090b]">
            <GuidedTour />
            {mvpModules.chat && <ChatNotifications />}
            {mvpModules.chat && <ChatButton />}
            <PersonalNotesModal />
            <QuickActionsMenu />
            <div
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-300 ease-out motion-reduce:transition-none lg:hidden ${
                    isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
            />

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none">
                <Header
                    isMenuOpen={isSidebarOpen}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                <Breadcrumbs />

                <main data-tour="app-content" className="app-dashboard-main flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
