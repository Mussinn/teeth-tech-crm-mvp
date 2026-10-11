import { NextRequest, NextResponse } from 'next/server'

import { AUTH_TOKEN_COOKIE, isJwtExpired } from '@/src/lib/serverAuthCookies'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value

	if (!token || isJwtExpired(token)) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	return NextResponse.json(
		{ token },
		{
			headers: {
				'Cache-Control': 'no-store, private',
				Pragma: 'no-cache'
			}
		}
	)
}
