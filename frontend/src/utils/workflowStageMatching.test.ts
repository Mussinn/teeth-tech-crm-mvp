import { describe, expect, it } from 'vitest';

import {
    findSimilarWorkflowStatus,
    normalizeWorkflowStageValue,
    searchWorkflowStatuses,
} from '@/src/utils/workflowStageMatching';

const statuses = [
    {
        id: 'modeling',
        code: 'MODELING',
        name: 'Моделирование',
        initial: false,
        terminal: false,
        review: false,
    },
    {
        id: 'milling',
        code: 'MILLING',
        name: 'Фрезеровка',
        initial: false,
        terminal: false,
        review: false,
    },
];

describe('поиск существующих этапов workflow', () => {
    it('ищет одновременно по коду и названию', () => {
        expect(searchWorkflowStatuses('model', statuses)[0]?.status.id).toBe('modeling');
        expect(searchWorkflowStatuses('фрезер', statuses)[0]?.status.id).toBe('milling');
    });

    it('находит опечатки и вариации существующего этапа', () => {
        expect(
            findSimilarWorkflowStatus(
                { code: 'MODELIN', name: 'Моделированние' },
                statuses,
            )?.status.id,
        ).toBe('modeling');
        expect(
            findSimilarWorkflowStatus(
                { code: 'MILLING_NEW', name: 'Новая фрезеровка' },
                statuses,
            )?.status.id,
        ).toBe('milling');
    });

    it('нормализует регистр, разделители и букву ё', () => {
        expect(normalizeWorkflowStageValue('  WAITING_FOR_APPROVAL ')).toBe(
            'waiting for approval',
        );
        expect(normalizeWorkflowStageValue('Проверка Ёлки')).toBe('проверка елки');
    });
});
