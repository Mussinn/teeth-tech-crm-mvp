import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    GetTaskDashboardParams,
    TasksDashboardResponse,
} from '@/src/types/task.types';

function normalizeParam(value?: string) {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
}

export const tasksDashboardApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getTasksDashboard: builder.query<
            TasksDashboardResponse,
            GetTaskDashboardParams | void
        >({
            query: (params) => {
                const search = normalizeParam(params?.search);
                const workTypeCode = normalizeParam(params?.workTypeCode);
                const statusId = normalizeParam(params?.statusId);

                return {
                    url: '/tasks/dashboard',
                    method: 'GET',
                    params: {
                        ...(search ? { search } : {}),
                        ...(workTypeCode ? { workTypeCode } : {}),
                        ...(statusId ? { statusId } : {}),
                    },
                };
            },
            providesTags: ['Tasks'],
        }),
    }),
});

export const {
    useGetTasksDashboardQuery,
} = tasksDashboardApi;
