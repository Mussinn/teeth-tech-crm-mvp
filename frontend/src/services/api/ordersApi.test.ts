import {
    buildCreateOrderBody,
    buildGetOrderKanbanQuery,
    buildUpdateTaskMaterialsBody,
} from '@/src/services/api/ordersApi';
import type { CreateOrderDto } from '@/src/types/order.types';

function createOrder(materialIds: string[]): CreateOrderDto {
    return {
        clinicId: 'clinic', patientFullName: 'Пациент', doctorFullName: 'Врач', deadline: '2026-08-01', comment: '',
        tasks: [{
            workDirectionId: 'direction', workTypeId: 'work', quantity: 2, toothNumbers: [11, 12], colorId: 'color', materialIds,
            pricePerUnit: 25000, discount: 0, discountPercent: 0, assignmentMode: 'AUTO', statusAssignees: [],
        }],
    };
}

describe('breaking API заказа', () => {
    it.each([
        { label: 'одним', materialIds: ['zirconia'] },
        { label: 'несколькими', materialIds: ['zirconia', 'ceramic', 'glaze'] },
    ])('создаёт задачу с $label материалом(ами)', ({ materialIds }) => {
        const body = buildCreateOrderBody(createOrder(materialIds));
        expect(body.tasks[0].materialIds).toEqual(materialIds);
        expect(body.tasks[0].workDirectionId).toBe('direction');
        expect(body.tasks[0]).not.toHaveProperty('materialId');
        expect(body.tasks[0]).not.toHaveProperty('materialName');
    });

    it('удаляет дубликаты перед отправкой полного нового массива', () => {
        expect(buildCreateOrderBody(createOrder(['zirconia', 'zirconia', 'ceramic'])).tasks[0].materialIds).toEqual(['zirconia', 'ceramic']);
    });

    it('отправляет полный уникальный список при изменении материалов задачи', () => {
        expect(buildUpdateTaskMaterialsBody([
            'current-material',
            'new-material',
            'current-material',
        ])).toEqual({
            materialIds: ['current-material', 'new-material'],
        });
    });
    it('builds the order kanban request without a client-controlled user selector', () => {
        expect(buildGetOrderKanbanQuery('order-id')).toEqual({
            url: '/orders/order-id/kanban',
            method: 'GET',
        });
    });
});
import { describe, expect, it } from 'vitest';
