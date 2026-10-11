'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {useTranslations} from 'next-intl';

import {
    useCreatePersonalNoteMutation,
    useDeletePersonalNoteMutation,
    useGetPersonalNotesQuery,
    useUpdatePersonalNoteMutation,
} from '@/src/services/api/personalNotesApi';
import type {
    PersonalNote,
    PersonalNotePayload,
} from '@/src/types/personalNote.types';
import {
    getPersonalNoteError,
    hasPersonalNoteText,
    isSamePersonalNote,
    normalizePersonalNote,
    PERSONAL_NOTE_AUTOSAVE_DELAY_MS,
    PERSONAL_NOTE_CONTENT_LIMIT,
    PERSONAL_NOTE_TITLE_LIMIT,
} from '@/src/utils/personalNotes';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import {useAppFormatters} from '@/src/i18n/provider';

type NoteDraft = PersonalNotePayload &
    Partial<Pick<PersonalNote, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>>;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type PersonalNotesCardProps = {
    variant?: 'card' | 'modal';
    onRequestClose?: () => void;
    closeRequestId?: number;
};

const EMPTY_DRAFT: NoteDraft = {
    title: '',
    content: '',
};

function NoteIcon({
    name,
    className = 'h-5 w-5',
}: {
    name: 'note' | 'close' | 'plus' | 'trash' | 'search' | 'retry';
    className?: string;
}) {
    const paths = {
        note: (
            <>
                <path d="M6 3h9l4 4v14H6z" />
                <path d="M15 3v5h4M9 12h6M9 16h6" />
            </>
        ),
        close: <path d="m18 6-12 12M6 6l12 12" />,
        plus: <path d="M12 5v14M5 12h14" />,
        trash: (
            <>
                <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
                <path d="M10 11v6M14 11v6" />
            </>
        ),
        search: (
            <>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
            </>
        ),
        retry: (
            <>
                <path d="M20 7v5h-5" />
                <path d="M19 12a7 7 0 1 0-2 5" />
            </>
        ),
    };

    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {paths[name]}
        </svg>
    );
}

function getNoteLabel(note: PersonalNote, untitled: string) {
    const normalized = normalizePersonalNote(note);
    return normalized.title.trim() ||
        normalized.content.trim().split(/\r?\n/u)[0] ||
        untitled;
}

function getNotePreview(note: PersonalNote, emptyPreview: string) {
    const preview = normalizePersonalNote(note).content.trim().replace(/\s+/gu, ' ');
    return preview || emptyPreview;
}

export default function PersonalNotesCard({
    variant = 'card',
    onRequestClose,
    closeRequestId = 0,
}: PersonalNotesCardProps) {
    const t = useTranslations('settings.notes');
    const commonT = useTranslations('common.actions');
    const formatters = useAppFormatters();
    const formatNoteDateTime = useCallback((value?: string) => value
        ? formatters.dateTime(value, {year: undefined, month: 'short'})
        : '', [formatters]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
    const [status, setStatus] = useState<SaveStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [isExpired, setIsExpired] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const draftRef = useRef<NoteDraft>(EMPTY_DRAFT);
    const persistedRef = useRef<(PersonalNotePayload & { id?: string }) | null>(null);
    const generationRef = useRef(0);
    const saveTimerRef = useRef<number | null>(null);
    const saveInFlightRef = useRef<Promise<boolean> | null>(null);
    const saveQueuedRef = useRef(false);
    const saveLatestRef = useRef<() => Promise<boolean>>(async () => true);
    const initializedSelectionRef = useRef(false);
    const handledCloseRequestRef = useRef(closeRequestId);

    const {
        data,
        isError: isListError,
        isFetching: isListFetching,
        refetch,
    } = useGetPersonalNotesQuery({
        q: debouncedSearch,
        page,
        size: 20,
    });
    const [createNote] = useCreatePersonalNoteMutation();
    const [updateNote] = useUpdatePersonalNoteMutation();
    const [deleteNote] = useDeletePersonalNoteMutation();

    const setSaveStatus = useCallback((nextStatus: SaveStatus) => {
        setStatus(nextStatus);
    }, []);

    const clearSaveTimer = useCallback(() => {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const isDirty = useCallback(() => {
        const current = draftRef.current;

        if (!current.id && !hasPersonalNoteText(current)) return false;
        return !isSamePersonalNote(persistedRef.current, current);
    }, []);

    const applySelectedNote = useCallback(
        (note?: PersonalNote) => {
            clearSaveTimer();
            generationRef.current += 1;
            const normalizedNote = note ? normalizePersonalNote(note) : undefined;
            const nextDraft: NoteDraft = normalizedNote
                ? { ...normalizedNote }
                : { ...EMPTY_DRAFT };

            draftRef.current = nextDraft;
            persistedRef.current = normalizedNote
                ? {
                    id: normalizedNote.id,
                    title: normalizedNote.title,
                    content: normalizedNote.content,
                }
                : null;
            setDraft(nextDraft);
            setErrorMessage('');
            setIsExpired(false);
            setSaveStatus(note ? 'saved' : 'idle');
        },
        [clearSaveTimer, setSaveStatus]
    );

    const saveLatest = useCallback(async (): Promise<boolean> => {
        clearSaveTimer();

        if (saveInFlightRef.current) {
            saveQueuedRef.current = true;
            const currentResult = await saveInFlightRef.current;

            if (!currentResult) return false;
            return saveLatestRef.current();
        }

        const snapshot = { ...draftRef.current };
        const generation = generationRef.current;

        if (!snapshot.id && !hasPersonalNoteText(snapshot)) {
            setSaveStatus('idle');
            return true;
        }

        if (isSamePersonalNote(persistedRef.current, snapshot)) {
            setSaveStatus('saved');
            return true;
        }

        setErrorMessage('');
        setSaveStatus('saving');

        const operation = (async () => {
            try {
                const body: PersonalNotePayload = {
                    title: snapshot.title ?? '',
                    content: snapshot.content ?? '',
                };
                const savedNote = snapshot.id
                    ? await updateNote({
                        noteId: snapshot.id,
                        body,
                    }).unwrap()
                    : await createNote(body).unwrap();

                if (generation !== generationRef.current) return true;

                persistedRef.current = {
                    id: savedNote.id,
                    title: savedNote.title,
                    content: savedNote.content,
                };

                const currentDraft = draftRef.current;
                const changedDuringRequest =
                    currentDraft.title !== snapshot.title ||
                    currentDraft.content !== snapshot.content;
                const nextDraft: NoteDraft = changedDuringRequest
                    ? {
                        ...savedNote,
                        title: currentDraft.title,
                        content: currentDraft.content,
                    }
                    : { ...savedNote };

                draftRef.current = nextDraft;
                setDraft(nextDraft);
                setIsExpired(false);

                if (changedDuringRequest) {
                    saveQueuedRef.current = true;
                    setSaveStatus('saving');
                } else {
                    setSaveStatus('saved');
                }

                return true;
            } catch (error) {
                if (generation !== generationRef.current) return false;

                const expired =
                    Boolean(snapshot.id) &&
                    typeof error === 'object' &&
                    error !== null &&
                    'status' in error &&
                    (error as { status?: unknown }).status === 404;

                setIsExpired(expired);
                setErrorMessage(t(getPersonalNoteError(error)));
                setSaveStatus('error');
                return false;
            }
        })();

        saveInFlightRef.current = operation;
        const succeeded = await operation;

        if (saveInFlightRef.current === operation) {
            saveInFlightRef.current = null;
        }

        const shouldContinue =
            succeeded &&
            generation === generationRef.current &&
            saveQueuedRef.current;
        saveQueuedRef.current = false;

        if (shouldContinue) {
            return saveLatestRef.current();
        }

        return succeeded;
    }, [clearSaveTimer, createNote, setSaveStatus, t, updateNote]);

    useEffect(() => {
        saveLatestRef.current = saveLatest;
    }, [saveLatest]);

    const scheduleSave = useCallback(() => {
        clearSaveTimer();
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null;
            void saveLatestRef.current();
        }, PERSONAL_NOTE_AUTOSAVE_DELAY_MS);
    }, [clearSaveTimer]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(0);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!data) return;

        if (!initializedSelectionRef.current) {
            initializedSelectionRef.current = true;
            applySelectedNote(data.content[0]);
            return;
        }

        if (isDirty()) return;

        const currentDraft = draftRef.current;
        const refreshedNote = currentDraft.id
            ? data.content.find((note) => note.id === currentDraft.id)
            : undefined;

        if (refreshedNote) {
            const normalized = normalizePersonalNote(refreshedNote);
            const serverChanged =
                normalized.title !== currentDraft.title ||
                normalized.content !== currentDraft.content ||
                normalized.updatedAt !== currentDraft.updatedAt;

            if (serverChanged) {
                applySelectedNote(normalized);
            }
            return;
        }

        if (currentDraft.id || !hasPersonalNoteText(currentDraft)) {
            applySelectedNote(data.content[0]);
        }
    }, [applySelectedNote, data, isDirty]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isDirty() && !saveInFlightRef.current) return;

            if (!saveInFlightRef.current) {
                void saveLatestRef.current();
            }
            event.preventDefault();
            event.returnValue = '';
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isDirty()) {
                void saveLatestRef.current();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isDirty]);

    useEffect(() => () => {
        clearSaveTimer();
        if (isDirty()) {
            void saveLatestRef.current();
        }
    }, [clearSaveTimer, isDirty]);

    const updateDraft = (
        field: keyof Pick<NoteDraft, 'title' | 'content'>,
        value: string
    ) => {
        const nextDraft = {
            ...draftRef.current,
            [field]: value,
        };

        draftRef.current = nextDraft;
        setDraft(nextDraft);

        if (isExpired) return;

        if (isSamePersonalNote(persistedRef.current, nextDraft)) {
            clearSaveTimer();
            setSaveStatus('saved');
            setErrorMessage('');
            return;
        }

        if (!nextDraft.id && !hasPersonalNoteText(nextDraft)) {
            clearSaveTimer();
            setSaveStatus('idle');
            setErrorMessage('');
            return;
        }

        if (saveInFlightRef.current) {
            saveQueuedRef.current = true;
            setSaveStatus('saving');
        } else {
            setSaveStatus('idle');
            scheduleSave();
        }
    };

    const switchToNote = async (note?: PersonalNote) => {
        if (note?.id === draftRef.current.id) return;

        const saved = await saveLatestRef.current();
        if (!saved) return;

        applySelectedNote(note);
    };

    const closeNotes = useCallback(async () => {
        const saved = await saveLatestRef.current();

        if (saved) {
            onRequestClose?.();
        }
    }, [onRequestClose]);

    useEffect(() => {
        if (
            variant !== 'modal' ||
            closeRequestId === handledCloseRequestRef.current
        ) {
            return;
        }

        handledCloseRequestRef.current = closeRequestId;
        void closeNotes();
    }, [closeNotes, closeRequestId, variant]);

    const retrySave = () => {
        setIsExpired(false);
        void saveLatestRef.current();
    };

    const recreateExpiredNote = () => {
        const nextDraft: NoteDraft = {
            title: draftRef.current.title,
            content: draftRef.current.content,
        };

        generationRef.current += 1;
        draftRef.current = nextDraft;
        persistedRef.current = null;
        setDraft(nextDraft);
        setIsExpired(false);
        setErrorMessage('');
        setSaveStatus('idle');

        if (hasPersonalNoteText(nextDraft)) {
            scheduleSave();
        }
    };

    const removeCurrentNote = async () => {
        const noteId = draftRef.current.id;
        if (!noteId || status === 'saving' || isDeleting) return;

        clearSaveTimer();
        setIsDeleting(true);
        setErrorMessage('');

        try {
            await deleteNote(noteId).unwrap();
            setIsDeleteConfirmOpen(false);
            applySelectedNote();
        } catch (error) {
            const expired =
                typeof error === 'object' &&
                error !== null &&
                'status' in error &&
                (error as { status?: unknown }).status === 404;

            setIsExpired(expired);
            setErrorMessage(
                expired
                    ? t('expired')
                    : t('deleteError')
            );
            setSaveStatus('error');
        } finally {
            setIsDeleting(false);
        }
    };

    const notes = data?.content ?? [];
    const draftTitle = draft.title ?? '';
    const draftContent = draft.content ?? '';
    const totalPages = Math.max(data?.totalPages ?? 1, 1);
    const statusLabel = useMemo(() => {
        if (status === 'saving') return t('saving');
        if (status === 'saved') return t('saved');
        if (status === 'error') return t('saveError');
        return hasPersonalNoteText(draft) ? t('pending') : t('newNote');
    }, [draft, status, t]);
    const containerClassName = variant === 'modal'
        ? 'fixed bottom-24 right-4 z-[80] flex h-[min(680px,calc(100dvh-7rem))] w-[min(820px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_80px_-22px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900 sm:right-6'
        : 'flex h-[calc(100dvh-8.5rem)] min-h-[600px] w-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900';

    return (
        <section
            aria-label={t('aria')}
            className={containerClassName}
        >
                    <header className="flex min-h-[72px] items-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-white">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                            <NoteIcon name="note" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-black">{t('title')}</h2>
                            <p className="mt-0.5 text-[11px] text-violet-100">
                                {t('subtitle')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void switchToNote()}
                            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-bold transition hover:bg-white/25 disabled:opacity-50"
                            disabled={status === 'saving' || isDeleting}
                        >
                            <NoteIcon name="plus" className="h-4 w-4" />
                            {t('new')}
                        </button>
                        {variant === 'modal' ? (
                            <button
                                type="button"
                                onClick={() => void closeNotes()}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20"
                                aria-label={t('close')}
                            >
                                <NoteIcon name="close" />
                            </button>
                        ) : null}
                    </header>

                    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[17rem_minmax(0,1fr)]">
                        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950 md:border-b-0 md:border-r">
                            <label className="relative m-3 mb-2 block">
                                <span className="sr-only">{t('search')}</span>
                                <NoteIcon
                                    name="search"
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('search')}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-violet-500/15"
                                />
                            </label>

                            <div className="max-h-40 flex-1 overflow-y-auto px-2 pb-2 md:max-h-none">
                                {isListFetching && notes.length === 0 ? (
                                    <p className="px-3 py-8 text-center text-xs text-slate-400">
                                        {t('loading')}
                                    </p>
                                ) : null}

                                {isListError ? (
                                    <div className="m-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                        <p>{t('loadError')}</p>
                                        <button
                                            type="button"
                                            onClick={() => void refetch()}
                                            className="mt-2 inline-flex items-center gap-1 font-bold"
                                        >
                                            <NoteIcon name="retry" className="h-3.5 w-3.5" />
                                            {commonT('retry')}
                                        </button>
                                    </div>
                                ) : null}

                                {!isListFetching && !isListError && notes.length === 0 ? (
                                    <p className="px-3 py-8 text-center text-xs text-slate-400">
                                        {debouncedSearch
                                            ? t('noResults')
                                            : t('empty')}
                                    </p>
                                ) : null}

                                {notes.map((note) => {
                                    const selected = note.id === draft.id;

                                    return (
                                        <button
                                            key={note.id}
                                            type="button"
                                            onClick={() => void switchToNote(note)}
                                            disabled={status === 'saving' || isDeleting}
                                            className={`mb-1 w-full rounded-xl p-3 text-left transition disabled:cursor-wait ${
                                                selected
                                                    ? 'bg-violet-100 text-violet-950 dark:bg-violet-500/15 dark:text-violet-100'
                                                    : 'hover:bg-white dark:hover:bg-slate-900'
                                            }`}
                                        >
                                            <span className="block truncate text-sm font-bold">
                                                {getNoteLabel(note, t('untitled'))}
                                            </span>
                                            <span className="mt-1 block truncate text-[11px] text-slate-500">
                                                {getNotePreview(note, t('emptyPreview'))}
                                            </span>
                                            <span className="mt-1.5 block text-[9px] text-slate-400">
                                                {formatNoteDateTime(note.updatedAt)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {data && data.totalPages > 1 ? (
                                <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => Math.max(current - 1, 0))}
                                        disabled={page === 0}
                                        className="rounded-lg px-2 py-1 font-bold text-slate-600 disabled:opacity-30"
                                    >
                                        {commonT('back')}
                                    </button>
                                    <span className="text-slate-400">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
                                        disabled={page >= totalPages - 1}
                                        className="rounded-lg px-2 py-1 font-bold text-slate-600 disabled:opacity-30"
                                    >
                                        {t('next')}
                                    </button>
                                </div>
                            ) : null}
                        </aside>

                        <div className="flex min-h-0 flex-col bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
                                <div
                                    aria-live="polite"
                                    className={`flex min-w-0 items-center gap-2 text-xs font-bold ${
                                        status === 'error'
                                            ? 'text-red-600'
                                            : status === 'saved'
                                                ? 'text-emerald-600'
                                                : 'text-slate-500'
                                    }`}
                                >
                                    <span
                                        className={`h-2 w-2 shrink-0 rounded-full ${
                                            status === 'saving'
                                                ? 'animate-pulse bg-violet-500'
                                                : status === 'saved'
                                                    ? 'bg-emerald-500'
                                                    : status === 'error'
                                                        ? 'bg-red-500'
                                                        : 'bg-slate-300'
                                        }`}
                                    />
                                    <span className="truncate">{statusLabel}</span>
                                </div>
                                {draft.id ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                        disabled={status === 'saving' || isDeleting}
                                        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                                    >
                                        <NoteIcon name="trash" className="h-4 w-4" />
                                        {isDeleting ? t('deleting') : commonT('delete')}
                                    </button>
                                ) : null}
                            </div>

                            {errorMessage ? (
                                <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10">
                                    <p>{errorMessage}</p>
                                    <button
                                        type="button"
                                        onClick={isExpired ? recreateExpiredNote : retrySave}
                                        className="shrink-0 font-black underline underline-offset-2"
                                    >
                                        {isExpired ? t('recreate') : commonT('retry')}
                                    </button>
                                </div>
                            ) : null}

                            <div className="flex min-h-0 flex-1 flex-col p-4">
                                <input
                                    value={draftTitle}
                                    onChange={(event) => updateDraft('title', event.target.value)}
                                    maxLength={PERSONAL_NOTE_TITLE_LIMIT}
                                    placeholder={t('titlePlaceholder')}
                                    aria-label={t('titleAria')}
                                    className="w-full border-0 bg-transparent px-0 text-lg font-black text-slate-900 outline-none placeholder:text-slate-300 dark:text-white"
                                />
                                <div className="mt-1 text-right text-[9px] text-slate-400">
                                    {draftTitle.length} / {PERSONAL_NOTE_TITLE_LIMIT}
                                </div>
                                <textarea
                                    value={draftContent}
                                    onChange={(event) => updateDraft('content', event.target.value)}
                                    maxLength={PERSONAL_NOTE_CONTENT_LIMIT}
                                    placeholder={t('contentPlaceholder')}
                                    aria-label={t('contentAria')}
                                    className="mt-2 min-h-32 flex-1 resize-none border-0 bg-transparent px-0 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200"
                                />
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                                    <span>
                                        {draft.expiresAt
                                            ? t('storedUntil', {date: formatNoteDateTime(draft.expiresAt)})
                                            : t('retention')}
                                    </span>
                                    <span>
                                        {draftContent.length} / {PERSONAL_NOTE_CONTENT_LIMIT}
                                    </span>
                                </div>
                            </div>

                            <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] leading-4 text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                {t('privacy')}
                            </footer>
                        </div>
                    </div>
            <ConfirmDialog
                open={isDeleteConfirmOpen}
                title={t('deleteTitle')}
                description={t('deleteDescription')}
                confirmLabel={t('deleteConfirm')}
                isLoading={isDeleting}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={removeCurrentNote}
            />
        </section>
    );
}
