import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    GetQualityIncidentsArgs,
    QualityIncident,
    QualityIncidentsResponse,
    ResolveQualityIncidentArgs,
    ReturnTaskForReworkArgs,
    TaskReworkOption,
} from '@/src/types/task.types';

export const tasksReworkApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getTaskReworkOptions: builder.query<TaskReworkOption[], string>({
            query: (taskId) => ({
                url: `/tasks/${taskId}/rework-options`,
                method: 'GET',
            }),
            providesTags: (_result, _error, taskId) => [
                { type: 'TaskReworkOptions', id: taskId },
            ],
        }),
        returnTaskForRework: builder.mutation<QualityIncident, ReturnTaskForReworkArgs>({
            query: ({ taskId, body }) => ({
                url: `/tasks/${taskId}/return-for-rework`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, error, { taskId, body }) => [
                'Orders',
                'OrderKanban',
                'Tasks',
                { type: 'TaskReworkOptions', id: taskId },
                { type: 'QualityIncidents', id: taskId },
                { type: 'TaskHistory', id: taskId },
                ...(!error && body.stockWriteOffs?.length
                    ? [
                        { type: 'Stock' as const, id: 'OVERVIEW' },
                        { type: 'Stock' as const, id: 'MOVEMENTS' },
                        { type: 'Nomenclature' as const, id: 'LIST' },
                        ...body.stockWriteOffs.flatMap(({ nomenclatureId }) => [
                            { type: 'Stock' as const, id: nomenclatureId },
                            { type: 'Nomenclature' as const, id: nomenclatureId },
                        ]),
                    ]
                    : []),
            ],
        }),
        getTaskQualityIncidents: builder.query<QualityIncidentsResponse, GetQualityIncidentsArgs>({
            query: ({ taskId, page = 0, size = 20 }) => ({
                url: `/tasks/${taskId}/quality-incidents`,
                method: 'GET',
                params: { page, size },
            }),
            providesTags: (_result, _error, { taskId }) => [
                { type: 'QualityIncidents', id: taskId },
            ],
        }),
        resolveTaskQualityIncident: builder.mutation<QualityIncident, ResolveQualityIncidentArgs>({
            query: ({ taskId, incidentId, resolutionComment }) => ({
                url: `/tasks/${taskId}/quality-incidents/${incidentId}/resolve`,
                method: 'PATCH',
                body: { resolutionComment },
            }),
            invalidatesTags: (_result, _error, { taskId }) => [
                { type: 'QualityIncidents', id: taskId },
            ],
        }),
    }),
});

export const {
    useGetTaskReworkOptionsQuery,
    useReturnTaskForReworkMutation,
    useGetTaskQualityIncidentsQuery,
    useResolveTaskQualityIncidentMutation,
} = tasksReworkApi;
