import { describe, expect, it } from 'vitest';

import { isInactiveAccountPayload } from './inactiveAccount';

describe('isInactiveAccountPayload', () => {
    it('recognizes the backend inactive-account message', () => {
        expect(isInactiveAccountPayload({ message: 'Учетная запись неактивна' })).toBe(true);
    });

    it('does not treat an ordinary unauthorized response as deactivation', () => {
        expect(isInactiveAccountPayload({ message: 'Unauthorized' })).toBe(false);
    });
});
