import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    Material,
    CreateMaterialDto,
    UpdateMaterialArgs,
} from '@/src/types/laboratory-types/materials.types';

export const materialsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getMaterials: builder.query<Material[], void>({
            query: () => '/materials',
            providesTags: ['Materials'],
        }),

        getMaterial: builder.query<Material, string>({
            query: (id) => `/materials/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Materials', id }],
        }),

        createMaterial: builder.mutation<Material, CreateMaterialDto>({
            query: (body) => ({
                url: '/materials',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Materials'],
        }),

        updateMaterial: builder.mutation<Material, UpdateMaterialArgs>({
            query: ({ id, body }) => ({
                url: `/materials/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['Materials'],
        }),

        deleteMaterial: builder.mutation<void, string>({
            query: (id) => ({
                url: `/materials/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Materials'],
        }),
    }),
});

export const {
    useGetMaterialsQuery,
    useGetMaterialQuery,
    useCreateMaterialMutation,
    useUpdateMaterialMutation,
    useDeleteMaterialMutation,
} = materialsApi;
