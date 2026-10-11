import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    WorkTypes,
    CreateWorkTypeDto,
    UpdateWorkTypeArgs,
} from '@/src/types/laboratory-types/workTypes.types';

export const workTypesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getWorkTypes: builder.query<WorkTypes[], void>({
            query: () => '/work-types',
            providesTags: ['WorkTypes'],
        }),

        createWorkType: builder.mutation<WorkTypes, CreateWorkTypeDto>({
            query: (body) => ({
                url: '/work-types',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['WorkTypes'],
        }),

        updateWorkType: builder.mutation<WorkTypes, UpdateWorkTypeArgs>({
            query: ({ id, body }) => ({
                url: `/work-types/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['WorkTypes'],
        }),

        deleteWorkType: builder.mutation<void, string>({
            query: (id) => ({
                url: `/work-types/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['WorkTypes'],
        }),
    }),
});

export const {
    useGetWorkTypesQuery,
    useCreateWorkTypeMutation,
    useUpdateWorkTypeMutation,
    useDeleteWorkTypeMutation,
} = workTypesApi;
