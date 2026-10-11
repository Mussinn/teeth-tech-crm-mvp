import { NextRequest, NextResponse } from 'next/server';

import type { AuthSession, LoginResponse } from '@/src/types/auth.types';

export const AUTH_TOKEN_COOKIE = 'teethTechJwt';
export const AUTH_REFRESH_TOKEN_COOKIE = 'teethTechRefresh';
export const AUTH_USER_COOKIE = 'teethTechUser';

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MAX_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type BackendAuthSession = {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    accessExpiresInMs?: number;
    roles: string[];
};

export function isSecureRequest(request: NextRequest) {
    const forwardedProto = request.headers
        .get('x-forwarded-proto')
        ?.split(',', 1)[0]
        .trim()
        .toLowerCase();

    return forwardedProto
        ? forwardedProto === 'https'
        : request.nextUrl.protocol === 'https:';
}

function base64UrlEncode(value: string) {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/u, '');
}

function base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '='
    );

    return Buffer.from(padded, 'base64').toString('utf8');
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
    const [, payload] = token.split('.');

    if (!payload) return null;

    try {
        return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function getJwtMaxAgeSeconds(token: string) {
    const payload = parseJwtPayload(token);
    const exp = payload?.exp;

    if (typeof exp !== 'number') return DEFAULT_SESSION_MAX_AGE_SECONDS;

    const secondsUntilExpiration = Math.floor(exp - Date.now() / 1000);

    if (secondsUntilExpiration <= 0) return 0;

    return Math.min(secondsUntilExpiration, MAX_SESSION_MAX_AGE_SECONDS);
}

export function isJwtExpired(token: string) {
    return getJwtMaxAgeSeconds(token) === 0;
}

export function createAuthSession(loginResponse: LoginResponse): AuthSession {
    return {
        id: loginResponse.id,
        email: loginResponse.email,
        roles: loginResponse.roles ?? [],
    };
}

export function encodeAuthSession(session: AuthSession) {
    return base64UrlEncode(JSON.stringify(session));
}

export function decodeAuthSession(value: string): AuthSession | null {
    try {
        const parsed = JSON.parse(base64UrlDecode(value)) as Partial<AuthSession>;

        if (
            typeof parsed.id !== 'string' ||
            typeof parsed.email !== 'string' ||
            !Array.isArray(parsed.roles)
        ) {
            return null;
        }

        return {
            id: parsed.id,
            email: parsed.email,
            roles: parsed.roles.filter((role): role is string => typeof role === 'string'),
        };
    } catch {
        return null;
    }
}

export function setAuthCookies(
    response: NextResponse,
    auth: BackendAuthSession,
    session: AuthSession,
    secure: boolean,
) {
    const jwtMaxAge = getJwtMaxAgeSeconds(auth.accessToken);
    const responseMaxAge = auth.accessExpiresInMs
        ? Math.max(1, Math.floor(auth.accessExpiresInMs / 1000))
        : jwtMaxAge;
    const maxAge = Math.min(jwtMaxAge, responseMaxAge);

    response.cookies.set(AUTH_TOKEN_COOKIE, auth.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge,
    });

    response.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, auth.refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure,
        path: '/',
        maxAge: MAX_SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set(AUTH_USER_COOKIE, encodeAuthSession(session), {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge,
    });
}

export function clearAuthCookies(response: NextResponse) {
    // Expiration must also work over HTTP on a local-network IP.
    const secure = false;

    for (const [name, sameSite] of [
        [AUTH_TOKEN_COOKIE, 'lax'],
        [AUTH_REFRESH_TOKEN_COOKIE, 'strict'],
        [AUTH_USER_COOKIE, 'lax'],
    ] as const) {
        response.cookies.set(name, '', {
            httpOnly: true,
            sameSite,
            secure,
            path: '/',
            maxAge: 0,
        });
    }
}
