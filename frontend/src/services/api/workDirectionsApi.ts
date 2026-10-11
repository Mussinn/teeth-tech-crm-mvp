import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    GetWorkDirectionsArgs,
    WorkDirection,
    WorkDirectionRequest,
} from '@/src/types/workDirection.types';

export const workDirectionsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getWorkDirections: builder.query<WorkDirection[], GetWorkDirectionsArgs | void>({
            query: (args) => ({
                url: '/work-directions',
                method: 'GET',
                params: args?.includeInactive ? { includeInactive: true } : undefined,
            }),
            providesTags: (result) => result
                ? [
                    ...result.map(({ id }) => ({ type: 'WorkDirections' as const, id })),
                    { type: 'WorkDirections' as const, id: 'LIST' },
                ]
                : [{ type: 'WorkDirections' as const, id: 'LIST' }],
        }),
        createWorkDirection: builder.mutation<WorkDirection, WorkDirectionRequest>({
            query: (body) => ({
                url: '/work-directions',
                method: 'POST',
                body,
            }),
            invalidatesTags: [{ type: 'WorkDirections', id: 'LIST' }],
        }),
        updateWorkDirection: builder.mutation<
            WorkDirection,
            { id: string; body: WorkDirectionRequest }
        >({
            query: ({ id, body }) => ({
                url: `/work-directions/${encodeURIComponent(id)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'WorkDirections', id },
                { type: 'WorkDirections', id: 'LIST' },
            ],
        }),
    }),
});

export const {
    useGetWorkDirectionsQuery,
    useCreateWorkDirectionMutation,
    useUpdateWorkDirectionMutation,
} = workDirectionsApi;
