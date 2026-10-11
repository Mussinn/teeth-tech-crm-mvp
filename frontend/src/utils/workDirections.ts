const badgeThemes = [
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300',
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
    'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300',
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300',
    'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
];

export function getWorkDirectionBadgeClass(code: string) {
    let hash = 0;

    for (const character of code.trim().toUpperCase()) {
        hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
    }

    return badgeThemes[Math.abs(hash) % badgeThemes.length];
}

export function getApiErrorStatus(error: unknown) {
    if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

export function getApiErrorMessageValue(error: unknown) {
    if (!error || typeof error !== 'object' || !('data' in error)) return '';
    const data = (error as { data?: unknown }).data;

    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';

    const errorPayload = data as Record<string, unknown>;
    const messageKeys = ['businessMessage', 'message', 'detail', 'error', 'title'];

    return messageKeys
        .map(key => errorPayload[key])
        .find((value): value is string => typeof value === 'string') ?? '';
}

export function isWorkDirectionAccessError(error: unknown) {
    return getApiErrorStatus(error) === 403
        && /(work[\s_-]*direction|direction|\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d)/iu
            .test(getApiErrorMessageValue(error));
}
