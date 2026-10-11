import {describe, expect, it} from 'vitest';

import enMessages from '@/src/messages/en';
import kkMessages from '@/src/messages/kk';
import ruMessages from '@/src/messages/ru';

function flattenKeys(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object') return [prefix];

    return Object.entries(value as Record<string, unknown>)
        .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
        .sort();
}

describe('translation catalogs', () => {
    it('keeps translation key parity between ru, en, and kk', () => {
        const referenceKeys = flattenKeys(ruMessages);
        expect(flattenKeys(enMessages)).toEqual(referenceKeys);
        expect(flattenKeys(kkMessages)).toEqual(referenceKeys);
    });
});
