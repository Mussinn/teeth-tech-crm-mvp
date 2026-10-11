import { describe, expect, it } from 'vitest';

import {
    getWorkDirectionBadgeClass,
    isWorkDirectionAccessError,
} from './workDirections';

describe('work direction UI helpers', () => {
    it('assigns a stable badge theme from the backend code', () => {
        expect(getWorkDirectionBadgeClass('NEW_DIRECTION')).toBe(
            getWorkDirectionBadgeClass('new_direction')
        );
    });

    it('recognizes a direction-specific forbidden response', () => {
        expect(isWorkDirectionAccessError({
            status: 403,
            data: { message: 'No access to work direction' },
        })).toBe(true);
        expect(isWorkDirectionAccessError({
            status: 403,
            data: { message: 'Generic forbidden' },
        })).toBe(false);
        expect(isWorkDirectionAccessError({
            status: 403,
            data: { detail: 'Нет доступа к направлению' },
        })).toBe(true);
    });
});
