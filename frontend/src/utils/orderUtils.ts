// utils/orderUtils.ts

import type {
    OrderTaskType,
} from '@/src/types/order.types';
import type { OrderTaskStatus } from '@/src/types/task.types';

interface KanbanColumn {
    id: OrderTaskStatus;
    title: string;
    color: string;
}

export const ALL_ORDER_TASK_COLUMNS: KanbanColumn[] = [
    { id: '1', title: 'TODO', color: 'border-t-slate-500' },
    { id: '2', title: 'PLASTERING', color: 'border-t-yellow-500' },
    { id: '3', title: 'SCANNING', color: 'border-t-orange-500' },
    { id: '4', title: 'OPERATING', color: 'border-t-green-600' },
    { id: '5', title: 'CERAMICS', color: 'border-t-blue-700' },
    { id: '8', title: 'PROSTHETICS', color: 'border-t-cyan-500' },
    { id: '6', title: 'REVIEW', color: 'border-t-purple-500' },
    { id: '7', title: 'DONE', color: 'border-t-slate-500' },
];

function normalizeValue(value: string | null | undefined) {
    return (value ?? '').toLowerCase().replace(/[-_/]+/g, ' ').trim();
}

export function normalizeOrderTaskType(value: string | null | undefined): OrderTaskType {
    const normalizedValue = normalizeValue(value);

    if (normalizedValue.includes('prosthesis') || normalizedValue.includes('протез')) {
        return 'PROSTHESIS';
    }

    if (
        normalizedValue.includes('digital') ||
        normalizedValue.includes('electronic') ||
        normalizedValue.includes('электрон')
    ) {
        return 'DIGITAL_COPY';
    }

    return 'PHYSICAL_COPY';
}

export function canTaskMoveToColumn(
    task: {
        taskType?: string | null;
    },
    columnId: string
) {
    void task;
    void columnId;

    return true;
}

export function getOrderTaskColumns(tasks?: Array<{ taskType?: string | null }>) {
    void tasks;

    return ALL_ORDER_TASK_COLUMNS;
}
