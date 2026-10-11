import { isSameOriginRequest } from '@/src/lib/requestOrigin';
import { NextRequest, NextResponse } from 'next/server';

import { clearAuthCookies } from '@/src/lib/serverAuthCookies';
import { revokeBackendSession } from '@/src/lib/serverAuthApi';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await revokeBackendSession(request);

    const response = NextResponse.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store, private' } },
    );
    clearAuthCookies(response);

    return response;
}
