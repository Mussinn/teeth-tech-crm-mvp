import { teethTechApi } from '@/src/services/teethTechApi';
import type {
    CompletedWorkAct,
    CompletedWorkActCandidate,
    CompletedWorkActPreviewRequest,
    CompletedWorkActRequest,
} from '@/src/types/document.types';

export const documentsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getCompletedWorkAct: builder.query<CompletedWorkAct, CompletedWorkActRequest>({
            query: ({ startDate, endDate, clinicId }) => ({
                url: '/documents/completed-work-acts',
                method: 'GET',
                params: {
                    startDate,
                    endDate,
                    ...(clinicId ? { clinicId } : {}),
                },
                notification: { error: false },
            }),
        }),
        getCompletedWorkActCandidates: builder.query<
            CompletedWorkActCandidate[],
            CompletedWorkActRequest
        >({
            query: ({ startDate, endDate, clinicId }) => ({
                url: '/documents/completed-work-act-candidates',
                method: 'GET',
                params: {
                    startDate,
                    endDate,
                    ...(clinicId ? { clinicId } : {}),
                },
                notification: { error: false },
            }),
            transformResponse: (
                response: CompletedWorkActCandidate[]
                    | { content?: CompletedWorkActCandidate[]; items?: CompletedWorkActCandidate[] }
            ) => Array.isArray(response) ? response : response.content ?? response.items ?? [],
        }),
        previewCompletedWorkAct: builder.mutation<
            CompletedWorkAct,
            CompletedWorkActPreviewRequest
        >({
            query: (body) => ({
                url: '/documents/completed-work-acts/preview',
                method: 'POST',
                body,
                notification: { error: false },
            }),
        }),
    }),
});

export const {
    useLazyGetCompletedWorkActQuery,
    useLazyGetCompletedWorkActCandidatesQuery,
    usePreviewCompletedWorkActMutation,
} = documentsApi;
