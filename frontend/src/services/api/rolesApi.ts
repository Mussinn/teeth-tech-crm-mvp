import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    CreateRoleRequest,
    Role,
    UpdateRoleRequest,
} from '@/src/types/role.types';

export const rolesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getRoles: builder.query<Role[], void>({
            query: () => '/roles',
            providesTags: (result) => result
                ? [
                    ...result.map(({ id }) => ({ type: 'Roles' as const, id })),
                    { type: 'Roles' as const, id: 'LIST' },
                ]
                : [{ type: 'Roles' as const, id: 'LIST' }],
        }),
        createRole: builder.mutation<Role, CreateRoleRequest>({
            query: (body) => ({
                url: '/roles',
                method: 'POST',
                body,
            }),
            invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
        }),
        updateRole: builder.mutation<Role, { roleId: string; body: UpdateRoleRequest }>({
            query: ({ roleId, body }) => ({
                url: `/roles/${encodeURIComponent(roleId)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, { roleId }) => [
                { type: 'Roles', id: roleId },
                { type: 'Roles', id: 'LIST' },
            ],
        }),
        deleteRole: builder.mutation<void, string>({
            query: (roleId) => ({
                url: `/roles/${encodeURIComponent(roleId)}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, roleId) => [
                { type: 'Roles', id: roleId },
                { type: 'Roles', id: 'LIST' },
            ],
        }),
    }),
});

export const {
    useGetRolesQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useDeleteRoleMutation,
} = rolesApi;
