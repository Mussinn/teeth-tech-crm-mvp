import { describe, expect, it } from 'vitest';

import {
    canAccessManagementZone,
    canAccessWorkZone,
    getAuthRedirectPath,
    getDisplayRoleNames,
    hasAuthRole,
    normalizeAuthRole,
    normalizeAuthRoles,
} from './authUtils';

describe('authUtils', () => {
    it('keeps all normalized roles while selecting the primary UI role', () => {
        const roles = ['ROLE_ADMIN', 'prosthetist', 'ROLE_FINANCIER'];

        expect(normalizeAuthRoles(roles)).toEqual([
            'ADMIN',
            'PROSTHETIST',
            'FINANCIER',
        ]);
        expect(normalizeAuthRole(roles)).toBe('ADMIN');
        expect(hasAuthRole(roles, 'ROLE_FINANCIER')).toBe(true);
    });

    it('shows an administrator as only an administrator without changing stored roles', () => {
        expect(getDisplayRoleNames(['ROLE_ADMIN', 'ROLE_PROSTHETIST'])).toEqual(['ADMIN']);
        expect(getDisplayRoleNames(['ROLE_PROSTHETIST', 'ROLE_FINANCIER'])).toEqual([
            'PROSTHETIST',
            'FINANCIER',
        ]);
    });

    it('keeps administrators out of the production workspace', () => {
        const roles = ['ROLE_ADMIN', 'ROLE_PROSTHETIST'];

        expect(canAccessWorkZone(roles)).toBe(false);
        expect(canAccessManagementZone(roles)).toBe(true);
    });

    it('restores the last workspace after login when it is available', () => {
        const roles = ['ROLE_ADMIN', 'ROLE_PROSTHETIST'];

        expect(getAuthRedirectPath('ADMIN', roles, 'work')).toBe('/orders');
        expect(getAuthRedirectPath('ADMIN', roles, 'management')).toBe('/orders');
    });

    it('does not redirect a technician to an unavailable management workspace', () => {
        expect(
            getAuthRedirectPath('TECHNICIAN', ['ROLE_TECHNICIAN'], 'management')
        ).toBe('/employee');
    });
});
