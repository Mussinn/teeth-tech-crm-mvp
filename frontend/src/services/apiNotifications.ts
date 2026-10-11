import {defaultLocale, isLocale, localeCookieName, type Locale} from '@/src/i18n/config';
import enMessages from '@/src/messages/en/apiNotifications';
import kkMessages from '@/src/messages/kk/apiNotifications';
import ruMessages from '@/src/messages/ru/apiNotifications';

type ErrorData = {
    message?: unknown;
    detail?: unknown;
    error?: unknown;
    title?: unknown;
    businessMessage?: unknown;
    errors?: unknown;
    fieldErrors?: unknown;
    violations?: unknown;
};

type ApiNotificationMessages = {
    success: Record<string, string>;
    errors: Record<string, string>;
    defaults: {deleted: string; saved: string; success: string};
    proxy: {tokenMissing: string; tokenExpired: string; unavailable: string};
};

const MESSAGE_SETS: Record<Locale, ApiNotificationMessages> = {
    ru: ruMessages,
    en: enMessages,
    kk: kkMessages,
};

const SILENT_SUCCESS_ENDPOINTS = new Set([
    'initMultipartTaskFileUpload',
    'uploadMultipartTaskFilePart',
    'abortMultipartTaskFileUpload',
]);

const SILENT_ERROR_ENDPOINTS = new Set([
    'abortMultipartTaskFileUpload',
]);
const ROLE_ENDPOINTS = new Set([
    'getRoles',
    'createRole',
    'updateRole',
    'deleteRole',
]);

function getCurrentMessages(): ApiNotificationMessages {
    if (typeof document === 'undefined') return MESSAGE_SETS[defaultLocale];

    const savedLocale = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${localeCookieName}=`))
        ?.slice(localeCookieName.length + 1);
    const locale = isLocale(savedLocale) ? savedLocale : defaultLocale;
    return MESSAGE_SETS[locale];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getServerMessage(data: unknown) {
    if (typeof data === 'string') return data.trim();
    if (!isRecord(data)) return '';

    const errorData = data as ErrorData;
    const directMessage = (
        readText(errorData.businessMessage) ||
        readText(errorData.message) ||
        readText(errorData.detail) ||
        readText(errorData.error) ||
        readText(errorData.title)
    );

    if (directMessage) return directMessage;

    for (const value of [errorData.errors, errorData.fieldErrors, errorData.violations]) {
        if (Array.isArray(value)) {
            const messages = value.flatMap((item) => {
                if (typeof item === 'string') return [item.trim()];
                if (!isRecord(item)) return [];
                return [readText(item.message) || readText(item.defaultMessage)].filter(Boolean);
            });
            if (messages.length) return messages.join('. ');
        }

        if (isRecord(value)) {
            const messages = Object.values(value).flatMap((item) =>
                Array.isArray(item)
                    ? item.map(readText).filter(Boolean)
                    : [readText(item)].filter(Boolean)
            );
            if (messages.length) return messages.join('. ');
        }
    }

    return '';
}

export function shouldNotifyApiError(endpoint: string) {
    return !SILENT_ERROR_ENDPOINTS.has(endpoint);
}

export function getApiErrorMessage(error: unknown, endpoint = '') {
    const messages = getCurrentMessages();
    const text = messages.errors;

    if (!isRecord(error)) {
        return error instanceof Error && error.message
            ? error.message
            : text.generic;
    }

    const status = error.status;
    const serverMessage = getServerMessage(error.data);

    if (endpoint === 'loginUser' && status === 401) {
        return text.invalidCredentials;
    }

    if (status === 401) return text.sessionExpired;
    if (status === 403 && ROLE_ENDPOINTS.has(endpoint)) {
        return text.roleForbidden;
    }
    if (status === 404 && ['updateRole', 'deleteRole'].includes(endpoint)) {
        return text.roleNotFound;
    }
    if (status === 403) return serverMessage || text.forbidden;
    if (status === 404) return serverMessage || text.notFound;
    if (status === 409) return serverMessage || text.conflict;
    if (status === 429) return serverMessage || text.tooMany;
    if (status === 400 || status === 422) {
        return serverMessage || text.invalidData;
    }
    if (status === 502) return serverMessage || text.badGateway;
    if (typeof status === 'number' && status >= 500) {
        if (ROLE_ENDPOINTS.has(endpoint)) {
            return text.roleServer;
        }
        return serverMessage || text.unavailable;
    }
    if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
        return text.network;
    }
    if (status === 'PARSING_ERROR') {
        return text.parsing;
    }

    return serverMessage || readText(error.error) || text.generic;
}

export function getApiSuccessMessage(endpoint: string, method?: string) {
    if (SILENT_SUCCESS_ENDPOINTS.has(endpoint)) return null;
    const messages = getCurrentMessages();
    const successMessage = messages.success[endpoint];
    if (successMessage) return successMessage;

    if (method === 'DELETE') return messages.defaults.deleted;
    if (method === 'PUT' || method === 'PATCH') return messages.defaults.saved;
    return messages.defaults.success;
}
