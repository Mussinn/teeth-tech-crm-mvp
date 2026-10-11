import type { NextRequest } from 'next/server';

import {
    AUTH_REFRESH_TOKEN_COOKIE,
    AUTH_TOKEN_COOKIE,
    type BackendAuthSession,
    createAuthSession,
} from '@/src/lib/serverAuthCookies';
import { isInactiveAccountPayload } from '@/src/lib/inactiveAccount';

export type BackendAuthAttempt = {
    auth: BackendAuthSession | null;
    inactive: boolean;
};

function getBackendApiBaseUrl(): string {
    if (process.env.BACKEND_API_BASE_URL) return process.env.BACKEND_API_BASE_URL;
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

    return 'http://localhost:8081/api/v1';
}

function getAuthUrl(path: string) {
    return new URL(path, `${getBackendApiBaseUrl().replace(/\/+$/u, '')}/`);
}

function parseBackendAuthSession(value: unknown): BackendAuthSession | null {
    if (!value || typeof value !== 'object') return null;

    const payload = value as Record<string, unknown>;

    if (
        typeof payload.userId !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.accessToken !== 'string' ||
        typeof payload.refreshToken !== 'string' ||
        !Array.isArray(payload.roles)
    ) {
        return null;
    }

    const accessExpiresInMs = payload.accessExpiresInMs;

    return {
        userId: payload.userId,
        email: payload.email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        accessExpiresInMs:
            typeof accessExpiresInMs === 'number' &&
            Number.isFinite(accessExpiresInMs) &&
            accessExpiresInMs > 0
                ? accessExpiresInMs
                : undefined,
        roles: payload.roles.filter((role): role is string => typeof role === 'string'),
    };
}

async function readAuthAttempt(response: Response): Promise<BackendAuthAttempt> {
    let payload: unknown = null;

    try {
        payload = await response.json();
    } catch {
        // Authentication failures may intentionally have no response body.
    }

    if (!response.ok) {
        return { auth: null, inactive: isInactiveAccountPayload(payload) };
    }

    return { auth: parseBackendAuthSession(payload), inactive: false };
}

export async function createBackendSessionResult(
    email: string,
    password: string,
): Promise<BackendAuthAttempt> {
    try {
        const response = await fetch(getAuthUrl('auth/sessions'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password }),
            cache: 'no-store',
            redirect: 'manual',
        });

        return readAuthAttempt(response);
    } catch {
        return { auth: null, inactive: false };
    }
}

export async function createBackendSession(email: string, password: string) {
    return (await createBackendSessionResult(email, password)).auth;
}

export async function refreshBackendSessionResult(
    request: NextRequest,
): Promise<BackendAuthAttempt> {
    const refreshToken = request.cookies.get(AUTH_REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) return { auth: null, inactive: false };

    try {
        const response = await fetch(getAuthUrl('auth/sessions/refresh'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            cache: 'no-store',
            redirect: 'manual',
        });

        return readAuthAttempt(response);
    } catch {
        return { auth: null, inactive: false };
    }
}

export async function refreshBackendSession(request: NextRequest) {
    return (await refreshBackendSessionResult(request)).auth;
}

export async function revokeBackendSession(request: NextRequest) {
    const refreshToken = request.cookies.get(AUTH_REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) return;

    const headers = new Headers({ 'content-type': 'application/json' });
    const accessToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

    try {
        await fetch(getAuthUrl('auth/sessions/logout'), {
            method: 'POST',
            headers,
            body: JSON.stringify({ refreshToken }),
            cache: 'no-store',
            redirect: 'manual',
        });
    } catch {
        // Local cookies are still cleared by the caller, even if the backend is unavailable.
    }
}

export function getSessionFromBackendAuth(auth: BackendAuthSession) {
    return createAuthSession({
        id: auth.userId,
        email: auth.email,
        roles: auth.roles,
    });
}
