import type {
    PersonalNote,
    PersonalNotePayload,
    PersonalNotesPage,
} from '@/src/types/personalNote.types';

export const PERSONAL_NOTE_TITLE_LIMIT = 120;
export const PERSONAL_NOTE_CONTENT_LIMIT = 5000;
export const PERSONAL_NOTE_AUTOSAVE_DELAY_MS = 1000;

function asString(value: unknown) {
    return typeof value === 'string' ? value : '';
}

export function normalizePersonalNote(note: PersonalNote): PersonalNote {
    return {
        ...note,
        title: asString(note.title),
        content: asString(note.content),
        expiresAt: asString(note.expiresAt),
        createdAt: asString(note.createdAt),
        updatedAt: asString(note.updatedAt),
    };
}

export function normalizePersonalNotesPage(
    page: PersonalNotesPage
): PersonalNotesPage {
    return {
        ...page,
        content: Array.isArray(page.content)
            ? page.content.map(normalizePersonalNote)
            : [],
    };
}

export function hasPersonalNoteText(note: PersonalNotePayload) {
    return Boolean(asString(note.title).trim() || asString(note.content).trim());
}

export function isSamePersonalNote(
    first: PersonalNotePayload | null,
    second: PersonalNotePayload
) {
    return Boolean(
        first &&
        asString(first.title) === asString(second.title) &&
        asString(first.content) === asString(second.content)
    );
}

export type PersonalNoteErrorKey =
    | 'expired'
    | 'sessionExpired'
    | 'invalidLength'
    | 'networkError'
    | 'genericSaveError';

export function getPersonalNoteError(error: unknown): PersonalNoteErrorKey {
    if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error
    ) {
        const status = (error as { status?: unknown }).status;

        if (status === 404) {
            return 'expired';
        }
        if (status === 401) {
            return 'sessionExpired';
        }
        if (status === 400 || status === 422) {
            return 'invalidLength';
        }
        if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
            return 'networkError';
        }
    }

    return 'genericSaveError';
}
