import {NextResponse} from 'next/server';

import {isLocale} from '@/src/i18n/config';
import {loadMessages} from '@/src/i18n/messages';

export async function GET(
    _request: Request,
    context: {params: Promise<{locale: string}>}
) {
    const {locale} = await context.params;

    if (!isLocale(locale)) {
        return NextResponse.json(
            {error: 'Unsupported locale'},
            {status: 404}
        );
    }

    return NextResponse.json(
        {locale, messages: await loadMessages(locale)},
        {
            headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie',
            },
        }
    );
}
