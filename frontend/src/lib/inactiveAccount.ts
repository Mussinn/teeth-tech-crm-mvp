export const INACTIVE_ACCOUNT_MESSAGE = 'Ваш аккаунт деактивирован администратором';
export const INACTIVE_ACCOUNT_STORAGE_KEY = 'teethtech:inactive-account';

function getMessage(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';

    const record = value as Record<string, unknown>;
    for (const key of ['businessMessage', 'message', 'detail', 'error', 'title']) {
        const candidate = record[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }

    return '';
}

export function isInactiveAccountPayload(value: unknown) {
    const normalized = getMessage(value).trim().toLocaleLowerCase('ru');
    return normalized.includes('учетная запись неактивна')
        || normalized.includes('учётная запись неактивна')
        || normalized.includes('account is inactive');
}
