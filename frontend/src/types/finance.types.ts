export type FinanceReportRequest = {
    startDate: string;
    endDate: string;
};

export type FinanceReport = {
    startDate: string;
    endDate: string;
    totalCompletedTasks: number;
    grossRevenue: number;
    totalDiscounts: number;
    netRevenue: number;
    totalPayroll: number;
    materialCost?: number;
    inventoryPurchases?: number;
    grossProfit: number;
    marginPercentage: number;
    orderAccounting?: FinanceOrderAccounting;
    salaryAccounting?: FinanceSalaryAccounting;
    warehouseAccounting?: FinanceWarehouseAccounting;
    paymentAccounting?: FinancePaymentAccounting;
    reconciliation?: FinanceReconciliation;
};

export type FinanceOrderLine = {
    orderNumber: string;
    clinicName: string;
    patientName: string;
    workType: string;
    technicianName: string;
    quantity: number;
    pricePerUnit: number;
    grossAmount: number;
    discountPercent: number;
    discountAmount: number;
    netAmount: number;
    salaryEarnedAmount: number;
    salaryStatementId?: string | null;
    completedAt: string;
};

export type FinanceOrderAccounting = {
    completedTaskCount: number;
    grossAmount: number;
    discountAmount: number;
    netWorkAmount: number;
    lines: FinanceOrderLine[];
};

export type FinanceSalaryLine = {
    employeeName: string;
    startDate: string;
    endDate: string;
    paymentType: string;
    status: string;
    baseSalaryAmount: number;
    pieceworkAmount: number;
    grossAccruedAmount: number;
    carryInAmount: number;
    carryOutAmount: number;
    totalAmount: number;
    totalTasksCount: number;
    paidAt?: string | null;
};

export type FinanceSalaryAccounting = {
    statementCount: number;
    paidTaskCount: number;
    baseSalaryAmount: number;
    pieceworkAmount: number;
    grossAccruedAmount: number;
    carryInAmount: number;
    carryOutAmount: number;
    totalPaidAmount: number;
    lines: FinanceSalaryLine[];
};

export type FinanceWarehouseLine = {
    createdAt: string;
    movementType: string;
    referenceType: string;
    referenceId?: string | null;
    nomenclatureName: string;
    unit: string;
    quantity: number;
    standardQuantity: number;
    wasteQuantity: number;
    totalCost: number;
    standardCost: number;
    wasteCost: number;
    reason?: string | null;
};

export type FinanceWarehouseAccounting = {
    materialWriteOffCount: number;
    materialWriteOffCost: number;
    materialStandardCost: number;
    materialWasteCost: number;
    materialWriteOffQuantity: number;
    purchaseReceiptCount: number;
    purchaseReceiptCost: number;
    lines: FinanceWarehouseLine[];
};

export type FinancePaymentLine = {
    paidAt: string;
    invoiceNumber: string;
    orderNumber: string;
    clinicName: string;
    amount: number;
    paymentMethod: string;
    externalReference?: string | null;
};

export type FinancePaymentAccounting = {
    paymentCount: number;
    receivedAmount: number;
    lines: FinancePaymentLine[];
};

export type FinanceReconciliation = {
    balanced: boolean;
    netWorkMinusPayments: number;
    materialCostDifference: number;
    payrollDifference: number;
    completedTasksWithoutSalaryStatement: number;
    completedTasksWithoutMaterialWriteOff: number;
    stockWriteOffsWithoutCompletedTask: number;
    paymentsWithoutOrder: number;
    warnings: string[];
};

export type SalaryPaymentType = 'FIXED' | 'PIECEWORK' | 'HYBRID';

export type SalaryConfig = {
    userId: string;
    paymentType: SalaryPaymentType;
    baseSalary: number;
    commissionPercent: number;
};

export type UpsertSalaryConfigRequest = SalaryConfig;

export type SalaryStatementStatus = 'DRAFT' | 'PAID';

export type SalaryStatementRequest = {
    employeeId: string;
    startDate: string;
    endDate: string;
    comment?: string;
};

export type SalaryStatementTask = {
    taskId: string;
    orderNumber: string;
    workTypeName: string;
    quantity: number;
    taskAmount: number;
    earnedAmount: number;
    completedAt: string;
};

export type SalaryStatement = {
    statementId: string;
    employeeId: string;
    employeeName: string;
    paymentType: SalaryPaymentType;
    status: SalaryStatementStatus;
    startDate: string;
    endDate: string;
    baseSalaryAmount: number;
    pieceworkAmount: number;
    totalAmount: number;
    totalTaskCount: number;
    tasks: SalaryStatementTask[];
};

export type SalaryEmployee = {
    id: string;
    name: string;
    email: string;
};

export type SalaryStatementsHistoryRequest = {
    start: string;
    end: string;
};

export type SalaryCapMode = 'TOTAL' | 'VARIABLE_ONLY';
export type SalaryRuleTreatment =
    | 'INCLUDED_IN_BASE'
    | 'PAID_EXTRA'
    | 'NOT_PAYABLE'
    | 'REQUIRES_REVIEW';
export type SalaryCalculationType =
    | 'ONCE_PER_STAGE'
    | 'TASK_QUANTITY'
    | 'TEETH_COUNT'
    | 'PERCENT_OF_TASK';

export type SalaryPlanRule = {
    id: string;
    name: string;
    workTypeId: string | null;
    workTypeName?: string | null;
    statusId: string | null;
    statusName?: string | null;
    treatment: SalaryRuleTreatment;
    calculationType: SalaryCalculationType;
    rate: number;
    priority: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    active: boolean;
};

export type SalaryPlan = {
    id: string;
    userId: string;
    name: string;
    baseSalary: number;
    monthlyCap: number | null;
    capMode: SalaryCapMode;
    carryForward: boolean;
    effectiveFrom: string;
    effectiveTo: string | null;
    active: boolean;
    rules?: SalaryPlanRule[];
};

export type UpsertSalaryPlanRequest = Omit<SalaryPlan, 'id' | 'rules'>;
export type UpsertSalaryRuleRequest = Omit<
    SalaryPlanRule,
    'id' | 'workTypeName' | 'statusName'
>;

export type SalaryPreviewRequest = {
    employeeId: string;
    start: string;
    end: string;
};

export type SalaryAccrual = {
    id?: string;
    taskId?: string;
    orderNumber?: string;
    ruleId?: string;
    ruleName?: string;
    statusId?: string | null;
    statusName?: string | null;
    workTypeId?: string | null;
    workTypeName?: string | null;
    treatment: SalaryRuleTreatment;
    calculationType?: SalaryCalculationType;
    quantity?: number | null;
    rate?: number | null;
    amount: number;
    completedAt?: string | null;
    comment?: string | null;
};

export type SalaryCalculationPreview = {
    employeeId: string;
    start: string;
    end: string;
    baseSalary: number;
    extraAccrued: number;
    grossAccrued: number;
    carryIn: number;
    available: number;
    monthlyCap: number | null;
    payable: number;
    carryOut: number;
    accruals: SalaryAccrual[];
};

export type CreateFlexibleSalaryStatementRequest = {
    employeeId: string;
    start: string;
    end: string;
    comment: string | null;
};

export type FlexibleSalaryStatementResult = {
    statementId: string;
    status: string;
};
