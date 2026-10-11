import type { NextRequest } from 'next/server';

// Nginx preserves the public Host and overwrites X-Forwarded-Proto.
// nextUrl may instead contain the standalone server's internal Docker address.
export function isSameOriginRequest(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';

    const host = request.headers.get('host') || request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    if (!['http', 'https'].includes(protocol) || /[\s,/@\\?#]/u.test(host)) return false;

    try {
        return origin === new URL(`${protocol}://${host}`).origin;
    } catch {
        return false;
    }
}
