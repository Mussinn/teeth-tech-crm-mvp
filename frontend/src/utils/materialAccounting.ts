import type {
    MaterialUsageHistoryItem,
    MaterialAccountingItem,
    MaterialUsageRequest,
    TaskDashboardTask,
} from '@/src/types/task.types';

export const MATERIAL_BALANCE_EPSILON = 0.000001;

export function normalizeMaterialIds(materialIds: string[]) {
    return Array.from(new Set(materialIds.map((id) => id.trim()).filter(Boolean)));
}

export type MaterialIdsValidationError = 'required' | 'duplicate' | '';

export function validateMaterialIds(materialIds: string[]): MaterialIdsValidationError {
    const normalized = normalizeMaterialIds(materialIds);

    if (normalized.length === 0) return 'required';
    if (normalized.length !== materialIds.filter((id) => id.trim()).length) {
        return 'duplicate';
    }

    return '';
}

export function getAllocatedQuantity(usage: MaterialUsageRequest) {
    return usage.consumedQuantity + usage.wasteQuantity + usage.returnedQuantity;
}

export function getMaterialUsageDifference(usage: MaterialUsageRequest) {
    return usage.issuedQuantity - getAllocatedQuantity(usage);
}

export function isZeroMaterialUsage(usage: MaterialUsageRequest) {
    return usage.issuedQuantity === 0
        && usage.consumedQuantity === 0
        && usage.wasteQuantity === 0
        && usage.returnedQuantity === 0;
}

export type MaterialUsageValidationError =
    | 'duplicate'
    | 'negative'
    | 'issuedPositive'
    | 'wasteReason'
    | 'totalsMismatch'
    | '';

export function validateMaterialUsages(usages: MaterialUsageRequest[]): MaterialUsageValidationError {
    const ids = usages.map((usage) => usage.nomenclatureId);

    if (new Set(ids).size !== ids.length) {
        return 'duplicate';
    }

    for (const usage of usages) {
        const quantities = [
            usage.issuedQuantity,
            usage.consumedQuantity,
            usage.wasteQuantity,
            usage.returnedQuantity,
        ];

        if (quantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
            return 'negative';
        }
        if (usage.issuedQuantity <= 0) {
            return 'issuedPositive';
        }
        if (usage.wasteQuantity > 0 && !usage.note?.trim()) {
            return 'wasteReason';
        }
        if (Math.abs(getMaterialUsageDifference(usage)) > MATERIAL_BALANCE_EPSILON) {
            return 'totalsMismatch';
        }
    }

    return '';
}

export function compactMaterialNames(materialNames?: string[] | null, visibleCount = 2) {
    const names = (materialNames ?? []).map((name) => name.trim()).filter(Boolean);
    const visible = names.slice(0, visibleCount);
    const hiddenCount = names.length - visible.length;

    return hiddenCount > 0 ? [...visible, `+${hiddenCount}`] : visible;
}

export function taskMatchesMaterialSearch(task: TaskDashboardTask, search: string, locale = 'en-US') {
    const query = search.trim().toLocaleLowerCase(locale);
    if (!query) return true;

    return [
        task.orderNumber,
        task.patientName,
        task.clinicName,
        task.doctorName,
        task.workTypeName,
        task.technicianName,
        ...(task.materialNames ?? []),
    ].some((value) => typeof value === 'string' && value.toLocaleLowerCase(locale).includes(query));
}

export function getReportedQuantity(item?: MaterialAccountingItem) {
    if (!item) return 0;
    return item.actualConsumedQuantity + item.actualWasteQuantity + item.returnedQuantity;
}

export function createMaterialReportId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function canUseNomenclature(nomenclatureId: string, planIds: string[], allowUnplannedMaterials: boolean) {
    return allowUnplannedMaterials || planIds.includes(nomenclatureId);
}

export function canSubmitMaterialTransition({
    usages,
    finalized,
}: {
    usages: MaterialUsageRequest[];
    finalized: boolean;
}) {
    return usages.length > 0 && !finalized && !validateMaterialUsages(usages);
}

export function getVariancePresentation(varianceQuantity: number) {
    if (varianceQuantity > 0) return { label: 'overrun', tone: 'danger' as const };
    if (varianceQuantity < 0) return { label: 'saving', tone: 'success' as const };
    return { label: '', tone: 'neutral' as const };
}

export function groupMaterialUsages(items: MaterialUsageHistoryItem[]) {
    const groups = new Map<string, MaterialUsageHistoryItem[]>();
    for (const item of items) {
        groups.set(item.materialReportId, [...(groups.get(item.materialReportId) ?? []), item]);
    }
    return groups;
}
