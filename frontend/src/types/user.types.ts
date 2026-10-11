import type { WorkDirection } from './workDirection.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';
export type LegacyEmployeeStatus = 'BUSY' | 'BLOCKED' | 'DISMISSED';
export type EmployeeStatusResponse = EmployeeStatus | LegacyEmployeeStatus;

export type User = {
    id: string,
    fullName: string,
    name?: string,
    email?: string,
    phone?: string,
    specialization?: string | null,
    role?: string | null,
    roles?: string[],
    salaryType?: 'FIXED' | 'PER_UNIT',
    salary?: number,
    unitsCompleted?: number,
    status: EmployeeStatusResponse,
    workDirections?: WorkDirection[],
    stats: {
        completed: number,
        inProgress: number,
        overdue: number,
        totalTasks: number,
        avgDays: number,
        timelyPercent: number
    }
}

export type UpdateUserProfileRequest = {
    name: string;
    email: string;
    phone: string;
    role: string;
    status: EmployeeStatus;
};

export type UpdateUserAdminSetupRequest = {
    roles: string[];
    status: EmployeeStatus;
    workDirectionIds: string[];
};

export type UpdateUserStatusRequest = {
    status: EmployeeStatus;
};

export type BatchCreateUserItem = {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    workDirectionIds?: string[];
};

export type BatchCreateUsersRequest = {
    employees: BatchCreateUserItem[];
};

