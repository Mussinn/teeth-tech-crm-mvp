// src/types/analytics.types.ts

export type Analytics = {
    completedThisMonth: number;
    completedPercentageChange: number;

    inProgressCount: number;
    inProgressChange: number;

    overdueCount: number;
    overdueChange: number;

    averageCompletionDays: number;
    averageDaysChange: number;

    paidOrdersCount: number;
    unpaidOrdersCount: number;
    totalOrdersCount: number;

    stageLoads: Record<string, number>;
    materialShares: Record<string, number>;
};