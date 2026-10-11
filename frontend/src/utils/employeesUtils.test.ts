import { describe, expect, it } from 'vitest';

import { isEmployeeActive, normalizeEmployeeStatus } from './employeesUtils';

describe('employee activity compatibility', () => {
    it('keeps ACTIVE active', () => {
        expect(isEmployeeActive('ACTIVE')).toBe(true);
        expect(normalizeEmployeeStatus('ACTIVE')).toBe('ACTIVE');
    });

    it.each(['INACTIVE', 'BUSY', 'BLOCKED', 'DISMISSED'])(
        'maps legacy %s to inactive without sending it back',
        (status) => {
            expect(isEmployeeActive(status)).toBe(false);
            expect(normalizeEmployeeStatus(status)).toBe('INACTIVE');
        }
    );
});
