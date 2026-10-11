import {describe, expect, it, vi} from 'vitest';

import {createClientId} from '@/src/utils/clientId';

describe('createClientId', () => {
    it('uses randomUUID when it is available', () => {
        const randomUUID = vi.fn(() => 'generated-uuid');

        vi.stubGlobal('crypto', {randomUUID});

        expect(createClientId()).toBe('generated-uuid');
        expect(randomUUID).toHaveBeenCalledOnce();

        vi.unstubAllGlobals();
    });

    it('creates unique ids when randomUUID is unavailable', () => {
        vi.stubGlobal('crypto', {});
        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const first = createClientId('workflow-stage');
        const second = createClientId('workflow-stage');

        expect(first).toMatch(/^workflow-stage-/);
        expect(second).toMatch(/^workflow-stage-/);
        expect(second).not.toBe(first);

        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
});
