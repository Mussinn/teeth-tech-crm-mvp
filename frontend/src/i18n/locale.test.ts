import {afterEach, describe, expect, it} from 'vitest';

import {defaultLocale, localeCookieName} from './config';
import {persistLocale, resolveLocale} from './locale';

describe('locale resolution', () => {
    it('uses a supported saved locale first', () => {
        expect(resolveLocale('kk', 'en-US,en;q=0.9')).toBe('kk');
    });

    it('uses a supported browser language when no choice is saved', () => {
        expect(resolveLocale(undefined, 'fr-FR, en-US;q=0.9')).toBe('en');
    });

    it('falls back to Russian for missing or invalid values', () => {
        expect(resolveLocale(undefined, 'fr-FR')).toBe(defaultLocale);
        expect(resolveLocale('de', 'en-US')).toBe(defaultLocale);
    });
});

describe('locale persistence', () => {
    afterEach(() => {
        document.cookie = `${localeCookieName}=; Path=/; Max-Age=0`;
    });

    it('stores the selected locale in a cookie', () => {
        persistLocale('en');
        expect(document.cookie).toContain(`${localeCookieName}=en`);
    });
});
