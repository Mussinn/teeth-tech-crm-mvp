import type { EmployeeStatusResponse } from './user.types';

export type EmployeeRole =
    | 'TECHNICIAN'
    | 'OPERATOR'
    | 'DISPATCHER'
    | 'ADMIN'
    | 'Зуб-Техник / Керамист'
    | 'Оператор / Моделировщик'
    | 'Диспетчер'
    | 'Админ'
    | 'Сканировщик'
    | 'Гипсовщик'
    | 'Протезист';

export type EmployeeStatus = EmployeeStatusResponse;

export interface EmployeeStats {
    completed: number;
    inProgress: number;
    overdue: number;
    totalTasks?: number;
    totalAssigned?: number;
    timelyPercent?: number;
    onTimeRate?: number;
    avgDays?: number;
    averageDays?: number;
}

export interface Employee {
    id: string;
    name: string;
    fullName?: string;
    role: EmployeeRole;
    specialization?: string;
    phone?: string;
    email?: string;
    status: EmployeeStatus;
    joinedAt?: string;
    stats: EmployeeStats;
}

export type TaskStatus =
    | 'TODO'
    | 'MODELING'
    | 'MILLING'
    | 'POST_PROCESSING'
    | 'DONE';

export type EmployeeTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface EmployeeTask {
    id: string;
    patient: string;
    workType: string;
    material: string;
    deadline: string;
    status: TaskStatus;
    priority: EmployeeTaskPriority;
}
