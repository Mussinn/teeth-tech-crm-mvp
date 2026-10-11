import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeStore } from '@/src/lib/store';
import { telegramApi } from '@/src/services/api/telegramApi';

function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

function supportRelativeRequests() {
    const NativeRequest = globalThis.Request;

    class BrowserLikeRequest extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
            super(
                typeof input === 'string' && input.startsWith('/')
                    ? `http://localhost:3000${input}`
                    : input,
                init
            );
        }
    }

    vi.stubGlobal('Request', BrowserLikeRequest);
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('telegramApi contract', () => {
    it('uses POST /notifications/telegram-link and reads url from the actual DTO', async () => {
        const fetchMock = vi.fn<typeof fetch>();
        fetchMock.mockResolvedValue(
            jsonResponse({
                url: 'https://t.me/teethtech_bot?start=one-time-code',
                expiresAt: '2026-07-19T12:00:00Z',
            })
        );
        supportRelativeRequests();
        vi.stubGlobal('fetch', fetchMock);
        const store = makeStore();

        const result = await store.dispatch(
            telegramApi.endpoints.createTelegramLink.initiate()
        ).unwrap();
        const request = fetchMock.mock.calls[0][0] as Request;

        expect(request.url).toBe('http://localhost:3000/api/backend/notifications/telegram-link');
        expect(request.method).toBe('POST');
        expect(result.url).toContain('https://t.me/');
    });

    it('sends the BotFather token to the dedicated PUT endpoint', async () => {
        const fetchMock = vi.fn<typeof fetch>();
        fetchMock.mockResolvedValue(jsonResponse({ tokenConfigured: true }));
        supportRelativeRequests();
        vi.stubGlobal('fetch', fetchMock);
        const store = makeStore();
        const token = '123456789:AA_PRIVATE_TOKEN';

        await store.dispatch(
            telegramApi.endpoints.updateTelegramToken.initiate({ token })
        ).unwrap();
        const request = fetchMock.mock.calls[0][0] as Request;

        expect(request.url).toBe('http://localhost:3000/api/backend/admin/integrations/telegram/token');
        expect(request.method).toBe('PUT');
        expect(await request.clone().json()).toEqual({ token });
    });

    it('updates the cached user status after a successful unlink without reloading', async () => {
        const responses = [
            jsonResponse({ connected: true, enabled: true, chatIdMask: '••••6789' }),
            new Response(null, { status: 200 }),
        ];
        const fetchMock = vi.fn<typeof fetch>();
        fetchMock.mockImplementation(() =>
            Promise.resolve(responses.shift() ?? new Response(null, { status: 500 }))
        );
        supportRelativeRequests();
        vi.stubGlobal('fetch', fetchMock);
        const store = makeStore();

        await store.dispatch(
            telegramApi.endpoints.getTelegramLinkStatus.initiate()
        ).unwrap();
        await store.dispatch(telegramApi.endpoints.unlinkTelegram.initiate()).unwrap();

        expect(
            telegramApi.endpoints.getTelegramLinkStatus.select()(store.getState()).data
        ).toMatchObject({ connected: false, chatIdMask: null });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
