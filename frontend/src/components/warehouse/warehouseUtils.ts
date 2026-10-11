import type {StockLevelStatus} from '@/src/types/warehouse.types';

export const stockStatusClasses: Record<StockLevelStatus, string> = {
    SUFFICIENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    LOW: 'border-amber-200 bg-amber-50 text-amber-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
};

export function getApiErrorMessage(error: unknown, fallback: string) {
    if (!error || typeof error !== 'object') return fallback;

    const apiError = error as {
        status?: number | string;
        data?: string | { message?: string; error?: string; detail?: string };
        error?: string;
    };

    if (typeof apiError.data === 'string' && apiError.data.trim()) return apiError.data;
    if (apiError.data && typeof apiError.data === 'object') {
        return apiError.data.message || apiError.data.detail || apiError.data.error || fallback;
    }
    if (apiError.status === 409) return fallback;
    return apiError.error || fallback;
}

export function shortId(id: string) {
    return id.slice(0, 8).toUpperCase();
}
