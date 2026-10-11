import { describe, expect, it } from 'vitest';

import type { ChatMessageDto } from '@/src/types/chat.types';
import { appendMessageToEnd, normalizeMessages } from '@/src/utils/chatUtils';

function message(id: string, createdAt: string): ChatMessageDto {
    return {
        id,
        conversationId: 'conversation',
        senderId: 'user',
        senderName: 'User',
        text: id,
        replyToId: null,
        createdAt,
        editedAt: null,
        deleted: false,
        attachments: [],
    };
}

describe('chat message ordering', () => {
    it('sorts fetched history from old to new', () => {
        const result = normalizeMessages([
            message('new', '2026-07-24T10:00:00Z'),
            message('old', '2026-07-24T09:00:00Z'),
        ]);

        expect(result.map((item) => item.id)).toEqual(['old', 'new']);
    });

    it('keeps a newly received message at the bottom despite its server timestamp', () => {
        const result = appendMessageToEnd(
            [
                message('old', '2026-07-24T09:00:00Z'),
                message('current', '2026-07-24T10:00:00Z'),
            ],
            message('file', '2026-07-24T04:00:00'),
        );

        expect(result.map((item) => item.id)).toEqual(['old', 'current', 'file']);
    });

    it('does not add a realtime duplicate', () => {
        const existing = [message('same', '2026-07-24T10:00:00Z')];

        expect(appendMessageToEnd(existing, existing[0])).toBe(existing);
    });
});
