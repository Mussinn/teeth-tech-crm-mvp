import { describe, expect, it } from 'vitest';

import {
    getPersonalNoteError,
    hasPersonalNoteText,
    isSamePersonalNote,
    normalizePersonalNote,
    normalizePersonalNotesPage,
} from '@/src/utils/personalNotes';

describe('personal notes autosave helpers', () => {
    it('does not create an empty note when the editor is simply opened', () => {
        expect(hasPersonalNoteText({ title: '', content: '' })).toBe(false);
        expect(hasPersonalNoteText({ title: '   ', content: '\n' })).toBe(false);
    });

    it('considers either title or content enough to create a note', () => {
        expect(hasPersonalNoteText({ title: 'Позвонить', content: '' })).toBe(true);
        expect(hasPersonalNoteText({ title: '', content: 'Уточнить цвет' })).toBe(true);
    });

    it('does not save when title and content are unchanged', () => {
        const persisted = { title: 'Позвонить', content: 'Уточнить цвет' };

        expect(isSamePersonalNote(persisted, { ...persisted })).toBe(true);
        expect(
            isSamePersonalNote(persisted, {
                ...persisted,
                content: 'Уточнить цвет до пятницы',
            })
        ).toBe(false);
    });

    it('explains a 404 as an expired note', () => {
        expect(getPersonalNoteError({ status: 404 })).toBe('expired');
    });

    it('normalizes nullable text returned by the backend', () => {
        const note = normalizePersonalNote({
            id: 'note-id',
            title: null,
            content: null,
            expiresAt: null,
            createdAt: null,
            updatedAt: null,
        } as never);

        expect(note).toMatchObject({
            title: '',
            content: '',
            expiresAt: '',
            createdAt: '',
            updatedAt: '',
        });
    });

    it('normalizes every note in a Spring Page response', () => {
        const page = normalizePersonalNotesPage({
            content: [{
                id: 'note-id',
                title: 'Заметка',
                content: null,
                expiresAt: '',
                createdAt: '',
                updatedAt: '',
            }],
            number: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
            first: true,
            last: true,
            empty: false,
        } as never);

        expect(page.content[0].content).toBe('');
    });
});
