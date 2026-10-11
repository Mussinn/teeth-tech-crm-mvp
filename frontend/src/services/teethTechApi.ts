import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";
import type {
    BaseQueryFn,
    FetchArgs,
    FetchBaseQueryError,
} from "@reduxjs/toolkit/query";

import {logout} from '@/src/features/auth/authSlice';
import {enqueueNotification} from '@/src/features/notifications/notificationsSlice';
import {
    getApiErrorMessage,
    getApiSuccessMessage,
    shouldNotifyApiError,
} from '@/src/services/apiNotifications';
import {
    INACTIVE_ACCOUNT_STORAGE_KEY,
    isInactiveAccountPayload,
} from '@/src/lib/inactiveAccount';

const API_BASE_URL = "/api/backend";

export type ApiCallNotificationOptions = {
    error?: boolean;
    success?: boolean;
};

type ApiFetchArgs = FetchArgs & {
    notification?: ApiCallNotificationOptions;
};

function getFetchArgs(args: ApiFetchArgs): FetchArgs {
    const fetchArgs = { ...args };
    delete fetchArgs.notification;

    return fetchArgs;
}

const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: "same-origin",
});

const baseQueryWithAuth: BaseQueryFn<
    string | ApiFetchArgs,
    unknown,
    FetchBaseQueryError
> = async (args, api, extraOptions) => {
    const notification = typeof args === 'string' ? undefined : args.notification;
    const requestArgs = typeof args === 'string'
        ? args
        : getFetchArgs(args);
    const result = await rawBaseQuery(requestArgs, api, extraOptions);
    const method = (
        typeof requestArgs === 'string' ? 'GET' : requestArgs.method ?? 'GET'
    ).toUpperCase();

    const inactiveAccount = result.error?.status === 401
        && isInactiveAccountPayload(result.error.data);

    if (result.error?.status === 401) {
        api.dispatch(logout());

        if (inactiveAccount && typeof window !== 'undefined') {
            window.sessionStorage.setItem(INACTIVE_ACCOUNT_STORAGE_KEY, '1');
            window.location.replace('/auth/login?reason=inactive');
        }
    }

    if (
        result.error &&
        !inactiveAccount &&
        notification?.error !== false &&
        shouldNotifyApiError(api.endpoint)
    ) {
        api.dispatch(
            enqueueNotification({
                tone: 'error',
                message: getApiErrorMessage(result.error, api.endpoint),
            })
        );
    } else if (
        !result.error &&
        notification?.success !== false &&
        api.type === 'mutation'
    ) {
        const message = getApiSuccessMessage(api.endpoint, method);

        if (message) {
            api.dispatch(
                enqueueNotification({
                    tone: 'success',
                    message,
                })
            );
        }
    }

    return result;
};

export const teethTechApi = createApi({
    reducerPath: "teethTechApi",
    baseQuery: baseQueryWithAuth,
    tagTypes: [
        "Clinics",
        "Users",
        "Roles",
        "Colors",
        "Materials",
        "WorkTypes",
        "WorkDirections",
        "Analytics",
        "Orders",
        "OrderKanban",
        "Tasks",
        "TaskHistory",
        "TaskReworkOptions",
        "QualityIncidents",
        "TaskFiles",
        "TaskAssignment",
        "TaskMaterialPlan",
        "TaskMaterialUsages",
        "TaskMaterialAccounting",
        "Nomenclature",
        "Stock",
        "InventoryChecks",
        "ProcurementOrders",
        "ProcurementSuppliers",
        "FinanceReport",
        "SalaryConfig",
        "SalaryPlans",
        "SalaryPreview",
        "SalaryStatements",
        "Invoices",
        "InvoicePayments",
        "PendingInvoicing",
        "BillingSummary",
        "Workflow",
        "OrderStatuses",
        "TelegramLink",
        "TelegramIntegration",
        "Warehouses",
        "PersonalNotes",
        "PatientHistory"
    ],
    endpoints: () => ({}),
});
