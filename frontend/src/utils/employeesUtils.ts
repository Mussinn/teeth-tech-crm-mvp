import type { Employee } from '@/src/types/employee.types';
import type { User } from '@/src/types/user.types';

export function isEmployeeActive(status: string) {
    return status === 'ACTIVE';
}

export function normalizeEmployeeStatus(status: string) {
    return isEmployeeActive(status) ? 'ACTIVE' as const : 'INACTIVE' as const;
}

export function mapUserToEmployee(user: User): Employee {
    return {
        id: user.id,
        name: user.fullName || user.name || user.email || '—',
        fullName: user.fullName,
        role: (user.role ?? user.roles?.[0] ?? 'TECHNICIAN') as Employee['role'],
        specialization: user.specialization ?? undefined,
        phone: user.phone,
        email: user.email,
        status: user.status as Employee['status'],
        stats: {
            completed: user.stats.completed,
            inProgress: user.stats.inProgress,
            overdue: user.stats.overdue,
            totalTasks: user.stats.totalTasks,
            totalAssigned: user.stats.totalTasks,
            timelyPercent: user.stats.timelyPercent,
            onTimeRate: user.stats.timelyPercent,
            avgDays: user.stats.avgDays,
            averageDays: user.stats.avgDays,
        },
    };
}

export function getKpiColor(rate: number) {
    if (rate >= 95) return 'bg-green-100 text-green-700';
    if (rate >= 85) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
}

export function getStatusBadge(status: string) {
    return isEmployeeActive(status)
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';
}
