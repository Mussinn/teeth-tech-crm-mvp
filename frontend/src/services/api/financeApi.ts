import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    FinanceReport,
    FinanceReportRequest,
} from '@/src/types/finance.types';

export const financeApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getFinanceReport: builder.query<FinanceReport, FinanceReportRequest>({
            query: (body) => ({
                url: '/finance/report',
                method: 'POST',
                body,
            }),
            providesTags: ['FinanceReport'],
        }),
    }),
});

export const {
    useGetFinanceReportQuery,
} = financeApi;
