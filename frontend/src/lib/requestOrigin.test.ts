import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { isSameOriginRequest } from './requestOrigin';

function request(headers: Record<string, string>) {
    return { headers: new Headers(headers), nextUrl: new URL('http://0.0.0.0:3000/api/backend/auth/sessions') } as unknown as NextRequest;
}

describe('same-origin requests behind Nginx', () => {
    it('accepts the public LAN origin despite the internal Next.js URL', () => {
        expect(isSameOriginRequest(request({ host: '172.20.10.3', origin: 'http://172.20.10.3', 'x-forwarded-proto': 'http' }))).toBe(true);
    });
    it('supports HTTPS and a public non-default port', () => {
        expect(isSameOriginRequest(request({ host: 'crm.example:8443', origin: 'https://crm.example:8443', 'x-forwarded-proto': 'https' }))).toBe(true);
    });
    it('rejects cross-origin requests even with same-origin fetch metadata', () => {
        expect(isSameOriginRequest(request({ host: '172.20.10.3', origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' }))).toBe(false);
    });
    it('rejects null origin and missing origin without same-origin metadata', () => {
        expect(isSameOriginRequest(request({ host: '172.20.10.3', origin: 'null' }))).toBe(false);
        expect(isSameOriginRequest(request({ host: '172.20.10.3' }))).toBe(false);
    });
    it('allows same-origin metadata when Origin is absent', () => {
        expect(isSameOriginRequest(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    });
});
