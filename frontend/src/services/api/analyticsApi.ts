import { teethTechApi } from '@/src/services/teethTechApi';
import type { Analytics } from '@/src/types/analytics.types';

export const analyticsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getAnalytics: builder.query<Analytics, void>({
            query: () => '/analytics/tasks/dashboard',
            providesTags: ['Analytics'],
        }),
    }),
});

export const { useGetAnalyticsQuery } = analyticsApi;
