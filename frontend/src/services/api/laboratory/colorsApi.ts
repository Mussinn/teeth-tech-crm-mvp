import {teethTechApi} from '@/src/services/teethTechApi';

import type {
    Color,
    CreateColorDto,
    UpdateColorArgs,
} from '@/src/types/laboratory-types/colors.types';

export const colorsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getColors: builder.query<Color[], boolean | void>({
            query: (activeOnly = true) => ({
                url: '/colors',
                params: {
                    activeOnly,
                },
            }),
            providesTags: ['Colors'],
        }),

        createColor: builder.mutation<Color, CreateColorDto>({
            query: (body) => ({
                url: '/colors',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Colors'],
        }),

        updateColor: builder.mutation<Color, UpdateColorArgs>({
            query: ({id, body}) => ({
                url: `/colors/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['Colors'],
        }),

        deleteColor: builder.mutation<void, string>({
            query: (id) => ({
                url: `/colors/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Colors'],
        }),
    }),
});

export const {
    useGetColorsQuery,
    useCreateColorMutation,
    useUpdateColorMutation,
    useDeleteColorMutation,
} = colorsApi;