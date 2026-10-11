import {
    teethTechApi,
    type ApiCallNotificationOptions,
} from '@/src/services/teethTechApi';

import {
    AddTaskDto,
    AssignTaskArgs,
    CreateOrderDto,
    CreateOrderRequest,
    CreateOrderResponse,
    GetOrderKanbanArgs,
    OrderApiListItem,
    OrderGetApiResponse,
    OrderKanbanColumn,
    UpdateOrderArgs,
    UpdateTaskArgs,
    UpdateTaskMaterialsArgs,
    UpdateTaskStatusArgs,
} from '@/src/types/order.types';

import type {
    GetOrdersParams
} from '@/src/types/params.types'

import type {
    EmployeeKanbanResponse,
    GetOrderEmployeeKanbanArgs,
    GetTaskHistoryArgs,
    TaskAssignment,
    MaterialAccounting,
    MaterialPlanItem,
    MaterialUsageHistoryItem,
    TaskHistoryResponse,
    UpdateTaskAssignmentArgs,
} from '@/src/types/task.types';
import { tasksDashboardApi } from '@/src/services/api/tasksDashboardApi';

type WithNotificationOptions = {
    notification?: ApiCallNotificationOptions;
};

type CreateOrderMutationArgs = CreateOrderDto & WithNotificationOptions;
type UpdateTaskStatusMutationArgs = UpdateTaskStatusArgs & WithNotificationOptions;
type AssignTaskMutationArgs = AssignTaskArgs & WithNotificationOptions;

export function buildUpdateTaskMaterialsBody(materialIds: string[]) {
    return {
        materialIds: Array.from(new Set(materialIds.map((id) => id.trim()).filter(Boolean))),
    };
}

export function buildGetOrderKanbanQuery(id: string) {
    return {
        url: `/orders/${id}/kanban`,
        method: 'GET' as const,
    };
}

export function buildCreateOrderBody(body: CreateOrderDto): CreateOrderRequest {
    return {
        ...body,
        tasks: body.tasks.map(({
            workDirectionId,
            workTypeId,
            quantity,
            toothNumbers,
            orderId,
            colorId,
            materialIds,
            pricePerUnit,
            discountPercent,
            assignmentMode,
            statusAssignees,
        }) => ({
            workDirectionId,
            workTypeId,
            quantity,
            toothNumbers,
            colorId,
            materialIds: Array.from(new Set(materialIds)),
            pricePerUnit,
            discountPercent,
            assignmentMode,
            statusAssignees,
            ...(orderId ? { orderId } : {}),
        })),
    };
}

export const ordersApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        searchPatientCards: builder.query<{content:{id:string;label:string;description?:string|null}[];hasNext?:boolean},{clinicId:string;q:string}>({query:params=>({url:'/orders/form-options/people',params:{...params,role:'PATIENT',limit:50}}),keepUnusedDataFor:0}),
        getOrders: builder.query<OrderGetApiResponse, GetOrdersParams>({
            query: ({page, size, sort}) => ({
                url: '/orders',
                method: 'GET',
                params: {
                    page,
                    size,
                    ...(sort? {sort} :{}),
                }
            }),
            providesTags: ['Orders'],
        }),

        getOrderDetails: builder.query<OrderApiListItem, string>({
            query: id => `/orders/${id}`,
            providesTags: (_result, _error, id) => ['Orders', {type:'OrderKanban', id}],
        }),
        createOrder: builder.mutation<CreateOrderResponse, CreateOrderMutationArgs>({
            query: ({ notification, ...body }) => ({
                url: '/orders',
                method: 'POST',
                body: buildCreateOrderBody(body),
                notification,
            }),
            invalidatesTags: ['Orders', 'OrderKanban'],
        }),

        updateOrder: builder.mutation<OrderApiListItem, UpdateOrderArgs>({
            query: ({ id, body }) => ({
                url: `/orders/${id}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                'Orders',
                'OrderKanban',
                { type: 'OrderKanban', id },
            ],
        }),

        deleteOrder: builder.mutation<void, string>({
            query: (id) => ({
                url: `/orders/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Orders', 'OrderKanban'],
        }),

        getOrderKanban: builder.query<OrderKanbanColumn[], GetOrderKanbanArgs>({
            query: ({ id }) => buildGetOrderKanbanQuery(id),
            providesTags: (_result, _error, { id }) => [
                'OrderKanban',
                { type: 'OrderKanban', id },
            ],
        }),

        updateOrderStatus: builder.mutation<void, string>({
            query: (id) => ({
                url: `/orders/${id}/status`,
                method: 'PATCH',
            }),
            invalidatesTags: (_result, _error, id) => [
                'Orders',
                'OrderKanban',
                { type: 'OrderKanban', id },
            ],
        }),

        updateTaskStatus: builder.mutation<void, UpdateTaskStatusMutationArgs>({
            query: ({ taskId, body, notification }) => ({
                url: `/order-tasks/${taskId}/status`,
                method: 'PATCH',
                body,
                notification,
            }),
            invalidatesTags: (_result, error, { taskId }) => error ? [] : [
                    'Orders',
                    'OrderKanban',
                    'Tasks',
                    { type: 'TaskHistory', id: taskId },
                    { type: 'TaskMaterialPlan', id: taskId },
                    { type: 'TaskMaterialUsages', id: taskId },
                    { type: 'TaskMaterialAccounting', id: taskId },
                ],
        }),

        updateTaskMaterials: builder.mutation<void, UpdateTaskMaterialsArgs>({
            query: ({ taskId, materialIds }) => ({
                url: `/tasks/${taskId}/materials`,
                method: 'PATCH',
                body: buildUpdateTaskMaterialsBody(materialIds),
            }),
            invalidatesTags: (_result, error, { taskId }) => error ? [] : [
                'Orders',
                'Tasks',
                'OrderKanban',
                { type: 'TaskMaterialPlan', id: taskId },
                { type: 'TaskMaterialAccounting', id: taskId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),

        updateTask: builder.mutation<void, UpdateTaskArgs>({
            query: ({ taskId, body }) => ({
                url: `/tasks/${taskId}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, error, { taskId }) => error ? [] : [
                'Orders',
                'OrderKanban',
                'Tasks',
                { type: 'TaskHistory', id: taskId },
            ],
        }),
        deleteTask: builder.mutation<void, { taskId: string; orderId?: string }>({
            query: ({ taskId }) => ({
                url: `/tasks/${encodeURIComponent(taskId)}`,
                method: 'DELETE',
            }),
            async onQueryStarted({ taskId }, { dispatch, getState, queryFulfilled }) {
                try {
                    await queryFulfilled;

                    for (const args of tasksDashboardApi.util.selectCachedArgsForQuery(getState(), 'getTasksDashboard')) {
                        dispatch(tasksDashboardApi.util.updateQueryData('getTasksDashboard', args, (dashboard) => {
                            for (const column of dashboard.columns) {
                                const previousLength = column.tasks.length;
                                column.tasks = column.tasks.filter((task) => task.id !== taskId);
                                const removed = previousLength - column.tasks.length;
                                if (removed > 0) {
                                    column.count = Math.max(0, column.count - removed);
                                    const displayedCount = dashboard.displayedTasksCount
                                        ?? dashboard.columns.reduce((sum, item) => sum + item.tasks.length, 0) + removed;
                                    dashboard.displayedTasksCount = Math.max(0, displayedCount - removed);
                                    dashboard.totalTasksCount = Math.max(0, dashboard.totalTasksCount - removed);
                                }
                            }
                            dashboard.recentCompletedTasks = dashboard.recentCompletedTasks.filter((task) => task.id !== taskId);
                        }));
                    }

                    for (const args of ordersApi.util.selectCachedArgsForQuery(getState(), 'getOrderKanban')) {
                        dispatch(ordersApi.util.updateQueryData('getOrderKanban', args, (columns) => {
                            for (const column of columns) {
                                const previousLength = column.tasks.length;
                                column.tasks = column.tasks.filter((task) => task.id !== taskId);
                                column.taskCount = Math.max(0, column.taskCount - (previousLength - column.tasks.length));
                            }
                        }));
                    }

                    dispatch(ordersApi.util.updateQueryData('getMyTasksKanban', undefined, (board) => {
                        for (const column of [board.previousColumn, board.currentColumn, board.nextColumn]) {
                            const previousLength = column.tasks.length;
                            column.tasks = column.tasks.filter((task) => task.id !== taskId);
                            column.taskCount = Math.max(0, column.taskCount - (previousLength - column.tasks.length));
                        }
                    }));
                } catch {
                    // A failed deletion leaves every cached card untouched.
                }
            },
            invalidatesTags: (_result, error, { taskId, orderId }) => error ? [] : [
                'Tasks',
                'Orders',
                'OrderKanban',
                { type: 'TaskHistory', id: taskId },
                ...(orderId ? [{ type: 'OrderKanban' as const, id: orderId }] : []),
            ],
        }),

        getTaskMaterialPlan: builder.query<MaterialPlanItem[], string>({
            query: (taskId) => ({
                url: `/order-tasks/${taskId}/material-plan`,
                notification: { error: false },
            }),
            transformResponse: (response: MaterialPlanItem[] | { items?: MaterialPlanItem[] }) => (
                Array.isArray(response) ? response : response.items ?? []
            ),
            providesTags: (_result, _error, taskId) => [
                { type: 'TaskMaterialPlan', id: taskId },
            ],
        }),

        getTaskMaterialUsages: builder.query<MaterialUsageHistoryItem[], string>({
            query: (taskId) => ({
                url: `/order-tasks/${taskId}/material-usages`,
                notification: { error: false },
            }),
            transformResponse: (response: MaterialUsageHistoryItem[] | { items?: MaterialUsageHistoryItem[]; content?: MaterialUsageHistoryItem[] }) => (
                Array.isArray(response) ? response : response.items ?? response.content ?? []
            ),
            providesTags: (_result, _error, taskId) => [
                { type: 'TaskMaterialUsages', id: taskId },
            ],
        }),

        getTaskMaterialAccounting: builder.query<MaterialAccounting, string>({
            query: (taskId) => ({
                url: `/order-tasks/${taskId}/material-accounting`,
                notification: { error: false },
            }),
            providesTags: (_result, _error, taskId) => [
                { type: 'TaskMaterialAccounting', id: taskId },
            ],
        }),

        assignTask: builder.mutation<void, AssignTaskMutationArgs>({
            query: ({ taskId, userId, notification }) => ({
                url: `/tasks/${taskId}/assign/${userId}`,
                method: 'PATCH',
                notification,
            }),
            invalidatesTags: (_result, _error, { taskId, orderId }) => [
                'Tasks',
                { type: 'OrderKanban', id: orderId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),

        getTaskAssignment: builder.query<TaskAssignment, string>({
            query: (taskId) => ({
                url: `/tasks/${taskId}/assignment`,
                method: 'GET',
            }),
            providesTags: (_result, _error, taskId) => [
                { type: 'TaskAssignment', id: taskId },
            ],
        }),

        updateTaskAssignment: builder.mutation<TaskAssignment, UpdateTaskAssignmentArgs>({
            query: ({ taskId, body }) => ({
                url: `/tasks/${taskId}/assignment`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, { taskId }) => [
                'Tasks',
                'OrderKanban',
                { type: 'TaskAssignment', id: taskId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),

        getTaskHistory: builder.query<TaskHistoryResponse, GetTaskHistoryArgs>({
            query: ({ taskId, page = 0, size = 20 }) => ({
                url: `/tasks/${taskId}/history`,
                method: 'GET',
                params: {
                    page,
                    size,
                },
            }),
            providesTags: (_result, _error, { taskId }) => [
                { type: 'TaskHistory', id: taskId },
            ],
        }),
        addTask: builder.mutation<string, AddTaskDto>({
            query: (body) => ({
                url: '/tasks',
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { orderId }) => [
                'Orders',
                'OrderKanban',
                'Tasks',
                { type: 'OrderKanban', id: orderId },
            ],
        }),
        getMyTasksKanban: builder.query<EmployeeKanbanResponse, void>({
            query: () => ({
                url: '/tasks/kanban/my',
                method: 'GET',
            }),
            providesTags: ['Tasks'],
        }),
        getOrderEmployeeKanban: builder.query<EmployeeKanbanResponse, GetOrderEmployeeKanbanArgs>({
            query: ({ orderId }) => ({
                url: `/tasks/order/${orderId}/kanban/employee`,
                method: 'GET',
            }),
            providesTags: (_result, _error, { orderId }) => [
                'Tasks',
                { type: 'OrderKanban', id: orderId },
            ],
        }),
    }),
});

export const {
    useSearchPatientCardsQuery,
    useGetOrdersQuery,
    useGetOrderDetailsQuery,
    useCreateOrderMutation,
    useUpdateOrderMutation,
    useDeleteOrderMutation,
    useGetOrderKanbanQuery,
    useUpdateOrderStatusMutation,
    useUpdateTaskStatusMutation,
    useUpdateTaskMaterialsMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useGetTaskMaterialPlanQuery,
    useGetTaskMaterialUsagesQuery,
    useGetTaskMaterialAccountingQuery,
    useAssignTaskMutation,
    useGetTaskAssignmentQuery,
    useUpdateTaskAssignmentMutation,
    useGetTaskHistoryQuery,
    useAddTaskMutation,
    useGetMyTasksKanbanQuery,
    useGetOrderEmployeeKanbanQuery,
} = ordersApi;
