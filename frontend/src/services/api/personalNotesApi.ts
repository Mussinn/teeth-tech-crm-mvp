import { teethTechApi } from '@/src/services/teethTechApi';
import type {
    GetPersonalNotesParams,
    PersonalNote,
    PersonalNotePayload,
    PersonalNotesPage,
} from '@/src/types/personalNote.types';
import {
    normalizePersonalNote,
    normalizePersonalNotesPage,
} from '@/src/utils/personalNotes';

export const personalNotesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getPersonalNotes: builder.query<PersonalNotesPage, GetPersonalNotesParams | void>({
            query: (params) => ({
                url: '/personal-notes',
                method: 'GET',
                params: {
                    q: params?.q?.trim() || undefined,
                    page: params?.page ?? 0,
                    size: Math.min(params?.size ?? 20, 50),
                },
            }),
            transformResponse: normalizePersonalNotesPage,
            providesTags: (result) => [
                'PersonalNotes',
                ...(result?.content.map((note) => ({
                    type: 'PersonalNotes' as const,
                    id: note.id,
                })) ?? []),
            ],
        }),
        createPersonalNote: builder.mutation<PersonalNote, PersonalNotePayload>({
            query: (body) => ({
                url: '/personal-notes',
                method: 'POST',
                body,
                notification: {
                    error: false,
                    success: false,
                },
            }),
            transformResponse: normalizePersonalNote,
            invalidatesTags: ['PersonalNotes'],
        }),
        updatePersonalNote: builder.mutation<
            PersonalNote,
            { noteId: string; body: PersonalNotePayload }
        >({
            query: ({ noteId, body }) => ({
                url: `/personal-notes/${noteId}`,
                method: 'PUT',
                body,
                notification: {
                    error: false,
                    success: false,
                },
            }),
            transformResponse: normalizePersonalNote,
            invalidatesTags: (_result, _error, { noteId }) => [
                { type: 'PersonalNotes', id: noteId },
            ],
        }),
        deletePersonalNote: builder.mutation<void, string>({
            query: (noteId) => ({
                url: `/personal-notes/${noteId}`,
                method: 'DELETE',
                notification: {
                    error: false,
                    success: false,
                },
            }),
            invalidatesTags: ['PersonalNotes'],
        }),
    }),
});

export const {
    useCreatePersonalNoteMutation,
    useDeletePersonalNoteMutation,
    useGetPersonalNotesQuery,
    useUpdatePersonalNoteMutation,
} = personalNotesApi;
