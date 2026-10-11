import { describe, expect, it } from 'vitest';

import { normalizeRoleCode } from './RoleCreateModal';

describe('normalizeRoleCode', () => {
    it('normalizes a role code without sending the ROLE_ prefix', () => {
        expect(normalizeRoleCode('role_metal-printer 12')).toBe('METALPRINTER12');
        expect(normalizeRoleCode('ROLE_METAL_PRINTER')).toBe('METAL_PRINTER');
    });

    it('limits the backend code part to 45 characters', () => {
        expect(normalizeRoleCode('A'.repeat(60))).toHaveLength(45);
    });
});
