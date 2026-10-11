import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    SalaryConfig,
    SalaryCalculationPreview,
    SalaryPlan,
    SalaryPlanRule,
    SalaryPreviewRequest,
    SalaryEmployee,
    CreateFlexibleSalaryStatementRequest,
    FlexibleSalaryStatementResult,
    SalaryStatement,
    SalaryStatementRequest,
    SalaryStatementsHistoryRequest,
    SalaryStatementTask,
    UpsertSalaryConfigRequest,
    UpsertSalaryPlanRequest,
    UpsertSalaryRuleRequest,
} from '@/src/types/finance.types';

export const salariesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        upsertSalaryConfig: builder.mutation<SalaryConfig, UpsertSalaryConfigRequest>({
            query: (body) => ({
                url: '/salaries/config',
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { userId }) => [
                { type: 'SalaryConfig', id: userId },
            ],
        }),
        getSalaryConfig: builder.query<SalaryConfig, string>({
            query: (userId) => `/salaries/config/${userId}`,
            providesTags: (_result, _error, userId) => [
                { type: 'SalaryConfig', id: userId },
            ],
        }),
        getSalaryEmployees: builder.query<SalaryEmployee[], void>({
            query: () => ({
                url: '/salaries/employees',
                method: 'GET',
            }),
            providesTags: ['SalaryConfig'],
        }),
        getSalaryPlan: builder.query<SalaryPlan, string>({
            query: (userId) => ({
                url: `/salaries/plans/${userId}`,
                method: 'GET',
                notification: { error: false },
            }),
            providesTags: (_result, _error, userId) => [
                { type: 'SalaryPlans', id: userId },
            ],
        }),
        upsertSalaryPlan: builder.mutation<
            SalaryPlan,
            { userId: string; body: UpsertSalaryPlanRequest }
        >({
            query: ({ userId, body }) => ({
                url: `/salaries/plans/${userId}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: (_result, _error, { userId }) => [
                { type: 'SalaryPlans', id: userId },
                { type: 'SalaryPreview', id: userId },
            ],
        }),
        createSalaryPlanRule: builder.mutation<
            SalaryPlanRule,
            { planId: string; userId: string; body: UpsertSalaryRuleRequest }
        >({
            query: ({ planId, body }) => ({
                url: `/salaries/plans/${planId}/rules`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { userId }) => [
                { type: 'SalaryPlans', id: userId },
                { type: 'SalaryPreview', id: userId },
            ],
        }),
        updateSalaryRule: builder.mutation<
            SalaryPlanRule,
            { ruleId: string; userId: string; body: UpsertSalaryRuleRequest }
        >({
            query: ({ ruleId, body }) => ({
                url: `/salaries/rules/${ruleId}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: (_result, _error, { userId }) => [
                { type: 'SalaryPlans', id: userId },
                { type: 'SalaryPreview', id: userId },
            ],
        }),
        deleteSalaryRule: builder.mutation<
            void,
            { ruleId: string; userId: string }
        >({
            query: ({ ruleId }) => ({
                url: `/salaries/rules/${ruleId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { userId }) => [
                { type: 'SalaryPlans', id: userId },
                { type: 'SalaryPreview', id: userId },
            ],
        }),
        getSalaryCalculationPreview: builder.query<
            SalaryCalculationPreview,
            SalaryPreviewRequest
        >({
            query: ({ employeeId, start, end }) => ({
                url: '/salaries/calculations/preview',
                method: 'GET',
                params: { employeeId, start, end },
                notification: { error: false },
            }),
            providesTags: (_result, _error, { employeeId }) => [
                { type: 'SalaryPreview', id: employeeId },
            ],
        }),
        createFlexibleSalaryStatement: builder.mutation<
            FlexibleSalaryStatementResult,
            CreateFlexibleSalaryStatementRequest
        >({
            query: (body) => ({
                url: '/salaries/calculations/statements',
                method: 'POST',
                body,
                notification: { error: false },
            }),
            invalidatesTags: (_result, _error, { employeeId }) => [
                { type: 'SalaryPreview', id: employeeId },
                'SalaryStatements',
                'FinanceReport',
            ],
        }),
        createSalaryStatement: builder.mutation<SalaryStatement, SalaryStatementRequest>({
            query: (body) => ({
                url: '/salaries/statements',
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { employeeId }) => [
                { type: 'SalaryConfig', id: employeeId },
                'SalaryStatements',
                'FinanceReport',
            ],
        }),
        deleteSalaryStatement: builder.mutation<void, string>({
            query: (id) => ({
                url: `/salaries/statements/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['SalaryStatements', 'FinanceReport'],
        }),
        confirmSalaryStatement: builder.mutation<void, string>({
            query: (id) => ({
                url: `/salaries/statements/${id}/confirm`,
                method: 'POST',
            }),
            invalidatesTags: ['SalaryStatements', 'FinanceReport'],
        }),
        getSalaryStatementTasks: builder.query<SalaryStatementTask[], string>({
            query: (id) => ({
                url: `/salaries/statements/${id}/tasks`,
                method: 'GET',
            }),
            providesTags: ['SalaryStatements'],
        }),
        getSalaryStatementsHistory: builder.query<SalaryStatement[], SalaryStatementsHistoryRequest>({
            query: ({ start, end }) => ({
                url: '/salaries/statements/history',
                method: 'GET',
                params: { start, end },
            }),
            providesTags: ['SalaryStatements'],
        }),
    }),
});

export const {
    useUpsertSalaryConfigMutation,
    useGetSalaryConfigQuery,
    useGetSalaryEmployeesQuery,
    useGetSalaryPlanQuery,
    useUpsertSalaryPlanMutation,
    useCreateSalaryPlanRuleMutation,
    useUpdateSalaryRuleMutation,
    useDeleteSalaryRuleMutation,
    useLazyGetSalaryCalculationPreviewQuery,
    useCreateFlexibleSalaryStatementMutation,
    useCreateSalaryStatementMutation,
    useDeleteSalaryStatementMutation,
    useConfirmSalaryStatementMutation,
    useGetSalaryStatementTasksQuery,
    useGetSalaryStatementsHistoryQuery,
} = salariesApi;
