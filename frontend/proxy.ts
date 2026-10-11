import { isMvpRouteEnabled } from './src/lib/mvp';
import { NextRequest, NextResponse } from 'next/server';

function getConfiguredConnectSource() {
    const endpoint = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_BACKEND_WS_URL;

    if (!endpoint) return '';

    try {
        const url = new URL(endpoint);
        return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ? ` ${url.origin}` : '';
    } catch {
        return '';
    }
}

export function proxy(request: NextRequest) {
    if (!isMvpRouteEnabled(request.nextUrl.pathname)) return NextResponse.redirect(new URL('/training', request.url));
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const isDevelopment = process.env.NODE_ENV === 'development';
    const contentSecurityPolicy = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob:",
        "font-src 'self' data:",
        `connect-src 'self'${getConfiguredConnectSource()}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "script-src-attr 'none'",
        ...(process.env.MVP_REQUIRE_HTTPS === 'true' ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);

    return response;
}

export const config = {
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
