import {
    canSubmitMaterialTransition,
    canUseNomenclature,
    compactMaterialNames,
    createMaterialReportId,
    getVariancePresentation,
    groupMaterialUsages,
    normalizeMaterialIds,
    taskMatchesMaterialSearch,
    validateMaterialIds,
    validateMaterialUsages,
} from '@/src/utils/materialAccounting';
import type { MaterialUsageHistoryItem, MaterialUsageRequest, TaskDashboardTask } from '@/src/types/task.types';

const balancedUsage: MaterialUsageRequest = {
    nomenclatureId: 'ceramic',
    issuedQuantity: 10,
    consumedQuantity: 7,
    wasteQuantity: 1,
    returnedQuantity: 2,
    note: 'Первый слой',
};

describe('несколько материалов задачи', () => {
    it('принимает один и несколько уникальных материалов', () => {
        expect(validateMaterialIds(['zirconia'])).toBe('');
        expect(validateMaterialIds(['zirconia', 'ceramic', 'glaze'])).toBe('');
    });

    it('запрещает пустой набор и обнаруживает дубликаты', () => {
        expect(validateMaterialIds([])).toBe('required');
        expect(validateMaterialIds(['zirconia', 'zirconia'])).toBe('duplicate');
        expect(normalizeMaterialIds(['zirconia', 'zirconia', ' ceramic '])).toEqual(['zirconia', 'ceramic']);
    });

    it('формирует компактное отображение и ищет по каждому materialNames', () => {
        expect(compactMaterialNames(['Цирконий', 'Керамика', 'Глазурь'])).toEqual(['Цирконий', 'Керамика', '+1']);
        expect(compactMaterialNames(undefined)).toEqual([]);
        const task = {
            orderNumber: 'TT-1', patientName: 'Пациент', clinicName: 'Клиника', doctorName: 'Врач',
            workTypeName: 'Коронка', technicianName: 'Техник', materialNames: ['Цирконий', 'Глазурь'],
        } as TaskDashboardTask;
        expect(taskMatchesMaterialSearch(task, 'глаз')).toBe(true);
        expect(taskMatchesMaterialSearch(task, 'врач')).toBe(true);
    });
});

describe('поэтапный материальный отчёт', () => {
    it('проверяет несколько номенклатур и баланс каждой строки', () => {
        expect(validateMaterialUsages([balancedUsage, { ...balancedUsage, nomenclatureId: 'glaze', issuedQuantity: 3, consumedQuantity: 2.5, wasteQuantity: 0.2, returnedQuantity: 0.3 }])).toBe('');
        expect(validateMaterialUsages([{ ...balancedUsage, returnedQuantity: 1 }])).toBe('totalsMismatch');
        expect(validateMaterialUsages([{ ...balancedUsage, issuedQuantity: -1 }])).toBe('negative');
        expect(validateMaterialUsages([balancedUsage, balancedUsage])).toBe('duplicate');
        expect(validateMaterialUsages([{ ...balancedUsage, note: '' }])).toBe('wasteReason');
    });

    it('требует ненулевой отчёт и запрещает ввод после финализации', () => {
        const zero = { ...balancedUsage, issuedQuantity: 0, consumedQuantity: 0, wasteQuantity: 0, returnedQuantity: 0 };
        expect(canSubmitMaterialTransition({ usages: [zero], finalized: false })).toBe(false);
        expect(canSubmitMaterialTransition({ usages: [], finalized: false })).toBe(false);
        expect(canSubmitMaterialTransition({ usages: [balancedUsage], finalized: true })).toBe(false);
        expect(canSubmitMaterialTransition({ usages: [balancedUsage], finalized: false })).toBe(true);
    });

    it('ограничивает внеплановую номенклатуру флагом workflow', () => {
        expect(canUseNomenclature('ceramic', ['ceramic'], false)).toBe(true);
        expect(canUseNomenclature('glaze', ['ceramic'], false)).toBe(false);
        expect(canUseNomenclature('glaze', ['ceramic'], true)).toBe(true);
    });

    it('сохраняет стабильный UUID отчёта для повторной попытки', () => {
        const reportId = createMaterialReportId();
        const retryPayloads = [1, 2, 3].map(() => ({ materialReportId: reportId, materialUsages: [balancedUsage] }));
        expect(new Set(retryPayloads.map((payload) => payload.materialReportId))).toEqual(new Set([reportId]));
        expect(reportId).toMatch(/^[0-9a-f-]{36}$/i);
    });
});

describe('история и план/факт', () => {
    it('группирует строки одного перехода по materialReportId', () => {
        const base = { ...balancedUsage, nomenclatureName: 'Керамика', unit: 'г', createdAt: '2026-07-22T10:00:00Z', employeeName: 'Иван', previousStatusName: 'A', nextStatusName: 'B' };
        const items = [
            { ...base, materialReportId: 'report-1' },
            { ...base, nomenclatureId: 'glaze', materialReportId: 'report-1' },
            { ...base, materialReportId: 'report-2' },
        ] as MaterialUsageHistoryItem[];
        expect(groupMaterialUsages(items).get('report-1')).toHaveLength(2);
        expect(groupMaterialUsages(items).size).toBe(2);
    });

    it('показывает перерасход красным смыслом, а экономию зелёным', () => {
        expect(getVariancePresentation(2)).toEqual({ label: 'overrun', tone: 'danger' });
        expect(getVariancePresentation(-2)).toEqual({ label: 'saving', tone: 'success' });
    });
});
import { describe, expect, it } from 'vitest';
