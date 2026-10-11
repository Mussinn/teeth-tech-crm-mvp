import { describe, expect, it } from 'vitest';

import {
    getSafeExternalUrl,
    getSafeObjectUrl,
    isTelegramUrl,
} from '@/src/lib/safeUrl';

describe('safe URLs', () => {
    it('accepts HTTPS URLs and rejects executable protocols', () => {
        expect(getSafeExternalUrl('https://files.example.com/download')).toBe(
            'https://files.example.com/download',
        );
        expect(getSafeExternalUrl('javascript:alert(1)')).toBeNull();
        expect(getSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('only accepts a Telegram deep link for the known Telegram hosts', () => {
        expect(isTelegramUrl('https://t.me/teethtech_bot?start=abc')).toBe(
            'https://t.me/teethtech_bot?start=abc',
        );
        expect(isTelegramUrl('https://example.com/redirect')).toBeNull();
    });

    it('only accepts blob URLs for locally-created file previews', () => {
        expect(getSafeObjectUrl('blob:https://crm.example/abc')).toBe(
            'blob:https://crm.example/abc',
        );
        expect(getSafeObjectUrl('https://crm.example/file')).toBeNull();
    });
});
