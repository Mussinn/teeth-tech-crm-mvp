import type { AuthRole } from '@/src/features/auth/authSlice';

export type WorkspaceZone = 'work' | 'management';

export const WORKSPACE_STORAGE_KEY = 'teeth-tech-active-workspace';

const MANAGEMENT_ROLES = new Set([
    'ADMIN',
    'CHIEF_TECHNICIAN',
    'HEAD_TECHNICIAN',
    'DISPATCHER',
    'FINANCIER',
]);

const WORK_ROLES = new Set([
    'TECHNICIAN',
    'CHIEF_TECHNICIAN',
    'HEAD_TECHNICIAN',
]);

export function normalizeRoleName(role: string) {
    return role.toUpperCase().replace(/^ROLE_/u, '');
}

export function normalizeAuthRoles(roles: string[] = []) {
    return [...new Set(roles.map(normalizeRoleName))];
}

/**
 * Roles remain intact for authorization, but an administrator is presented as
 * a single administrative role throughout the UI.
 */
export function getDisplayRoleNames(roles: string[] = []) {
    const normalizedRoles = normalizeAuthRoles(roles);

    return normalizedRoles.includes('ADMIN') ? ['ADMIN'] : normalizedRoles;
}

export function hasAuthRole(roles: string[], expectedRole: string) {
    return normalizeAuthRoles(roles).includes(normalizeRoleName(expectedRole));
}

export function normalizeAuthRole(roles: string[] = []): AuthRole {
    const normalizedRoles = normalizeAuthRoles(roles);

    if (normalizedRoles.includes('ADMIN')) return 'ADMIN';
    if (normalizedRoles.includes('CHIEF_TECHNICIAN')) return 'CHIEF_TECHNICIAN';
    if (normalizedRoles.includes('DISPATCHER')) return 'DISPATCHER';
    if (normalizedRoles.includes('FINANCIER')) return 'FINANCIER';

    return 'TECHNICIAN';
}

export function canAccessWorkZone(roles: string[], role?: AuthRole | null) {
    const normalizedRoles = normalizeAuthRoles(
        roles.length > 0 ? roles : role ? [role] : []
    );

    // Administrators work with a task from the management board: start it,
    // review it, and complete it. They must not take part in production stages.
    if (normalizedRoles.includes('ADMIN')) return false;

    return normalizedRoles.some((item) => WORK_ROLES.has(item))
        || normalizedRoles.some((item) => !MANAGEMENT_ROLES.has(item));
}

export function canAccessManagementZone(roles: string[], role?: AuthRole | null) {
    return normalizeAuthRoles(
        roles.length > 0 ? roles : role ? [role] : []
    ).some((item) => MANAGEMENT_ROLES.has(item));
}

export function getManagementRedirectPath(roles: string[], role?: AuthRole | null) {
    const normalizedRoles = normalizeAuthRoles(
        roles.length > 0 ? roles : role ? [role] : []
    );

    if (normalizedRoles.includes('ADMIN') || normalizedRoles.includes('DISPATCHER')) {
        return '/orders';
    }
    if (normalizedRoles.includes('FINANCIER')) return '/accounting';
    if (
        normalizedRoles.includes('CHIEF_TECHNICIAN')
        || normalizedRoles.includes('HEAD_TECHNICIAN')
    ) {
        return '/laboratory/work-types';
    }

    return '/employee';
}

export function getAuthRedirectPath(
    role: AuthRole,
    roles: string[] = [],
    preferredWorkspace?: string | null,
) {
    const combinedRoles = [...roles, role];

    if (
        preferredWorkspace === 'work'
        && canAccessWorkZone(combinedRoles, role)
    ) {
        return '/employee';
    }

    if (
        preferredWorkspace === 'management'
        && canAccessManagementZone(combinedRoles, role)
    ) {
        return getManagementRedirectPath(combinedRoles, role);
    }

    return role === 'TECHNICIAN'
        ? '/employee'
        : getManagementRedirectPath(combinedRoles, role);
}
