//types/task.types.ts
export type OrderTaskStatus =
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8';

export type TaskStatus =
    | 'TODO'
    | 'MODELING'
    | 'MILLING'
    | 'POST_PROCESSING'
    | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskAssignmentMode = 'AUTO' | 'PREASSIGNED';

export type TaskStatusAssigneeRequest = {
    statusId: string;
    userId: string;
};

export type TaskStatusAssignee = TaskStatusAssigneeRequest & {
    statusCode: string;
    statusName: string;
    userFullName: string;
};

export type TaskAssignment = {
    assignmentMode: TaskAssignmentMode;
    statusAssignees: TaskStatusAssignee[];
};

export type UpdateTaskAssignmentRequest = {
    assignmentMode: TaskAssignmentMode;
    statusAssignees: TaskStatusAssigneeRequest[];
};

export type UpdateTaskAssignmentArgs = {
    taskId: string;
    body: UpdateTaskAssignmentRequest;
};

export interface KanbanColumn<Status extends string = TaskStatus> {
    id: Status;
    title: string;
    color: string;
}

export type WorkBoardPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface OrderBoardTask {
    id: string;
    type: string;
    techId: string;
    status: OrderTaskStatus;
    comments?: TaskComment[];
    attachments?: TaskAttachment[];
    images?: TaskImage[];
    description?: string;
}

export interface WorkBoardTask {
    id: string;
    patient: string;
    type: string;
    material: string;
    units: number;
    priority: WorkBoardPriority;
    deadline: string;
    status: TaskStatus;
    techId: string;

}

export interface ProductionTask {
    id: string;
    orderId: string;
    patient: string;
    title: string;
    technicianId: string;
    nextTechnicianId?: string;
    attachedUserId?: string;
    assignedUserId?: string;
    workType?: string;
    workTypeCode?: string;
    workTypeId?: string;
    currentStatusId?: string;
    currentStatusCode?: string;
    currentStatusName?: string;
    status: TaskStatus;
    deadline: string;
    priority: TaskPriority;
    comments?: TaskComment[];
    attachments?: TaskAttachment[];
    images?: TaskImage[];
    history?: TaskHistoryItem[];
}

export type TaskComment = {
    id: string;
    author: string;
    text: string;
    createdAt: string;
};

export type TaskAttachment = {
    id: string;
    name: string;
    url: string;
    size: string;
    type: string;
    file?: File;
};

export type TaskImage = {
    id: string;
    name: string;
    url: string;
    size: string;
    file?: File;
};

export type TaskFileAttachmentType = 'SCREEN' | 'FILE';

export type TaskFile = {
    id: string;
    fileName: string;
    storagePath: string;
    contentType: string;
    fileSize: number;
    attachmentType: TaskFileAttachmentType;
};

export type GetTaskFilesArgs = {
    taskId: string;
    type?: TaskFileAttachmentType;
};

export type UploadTaskFileArgs = {
    taskId: string;
    file: File;
    type?: TaskFileAttachmentType;
};

export type DeleteTaskFileArgs = {
    taskId: string;
    attachmentId: string;
};

export type GetTaskFileUrlArgs = DeleteTaskFileArgs;

export type TaskFileUrlResponse = {
    url: string;
    expiresInSeconds: number;
};

export type InitMultipartTaskFileUploadArgs = {
    taskId: string;
    fileName: string;
    contentType: string;
    totalParts: number;
};

export type InitMultipartTaskFileUploadResponse = {
    fileId: string;
    uploadId: string;
    filePath: string;
};

export type UploadMultipartTaskFilePartArgs = {
    taskId: string;
    fileId: string;
    partNumber: number;
    file: Blob;
    fileName: string;
};

export type MultipartTaskFileArgs = {
    taskId: string;
    fileId: string;
};

export type MultipartTaskFileProgress = {
    fileId: string;
    progressPercent: number;
    uploadedParts: number;
    totalParts: number;
};

export type TaskHistoryChangedBy = {
    userId: string;
    fullName: string;
    initials: string;
};

export type TaskHistoryItem = {
    id: string;
    eventType: string;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    changedAt: string;
    changedBy?: TaskHistoryChangedBy | null;
};

export type TaskHistoryResponse = {
    content: TaskHistoryItem[];
    page: number;
    size: number;
    hasNext: boolean;
};

export type GetTaskHistoryArgs = {
    taskId: string;
    page?: number;
    size?: number;
};

export interface Task {
    id: string;
    title?: string;
    status: string;
    currentStatusId?: string;
    currentStatusCode?: string;
    isCompleted?: boolean;
    hasAccess?: boolean;
    patient?: string;
    orderId?: string;
    deadline?: string;
    priority?: string;
    type?: string;
    workDirectionId?: string;
    workDirectionName?: string;
    workDirectionCode?: string;
    material?: string;
    materialIds?: string[];
    materialNames?: string[];
    color?: string;
    taskType?: string;
    abutment?: string | number;
    technicianId?: string;
    operatorId?: string;
    units: number;
    unitPrice: number;
    discount: number;
    comments?: TaskComment[];
    attachments?: TaskAttachment[];
    images?: TaskImage[];
    history?: TaskHistoryItem[];
}

export type GetTaskDashboardParams = {
    search?: string;
    workTypeCode?: string;
    statusId?: string;
};

export type TaskDashboardTask = {
 stageDays?:number;stageStartedAt?:string;
    id: string;
    orderId: string;
    orderNumber: string;
    patientName: string;
    clinicName: string;
    doctorName: string;
    workTypeName: string;
    workDirectionId: string;
    workDirectionName: string;
    workDirectionCode: string;
    materialIds: string[];
    materialNames: string[];
    colorCode: string;
    quantity: number;
    toothNumbers: number[];
    technicianName: string;
    deadline: string | null;
    isOverdue: boolean;
};

export type TaskDashboardColumn = {
    statusId?: string;
    statusCode: string;
    statusName: string;
    count: number;
    tasks: TaskDashboardTask[];
};

export type RecentCompletedDashboardTask = {
    id: string;
    orderNumber: string;
    patientName: string;
    workTypeName: string;
    workDirectionName: string;
    technicianName: string;
    completedAt: string;
};

export type TasksDashboardResponse = {
    completedThisMonth?: number;
    averageCompletionDays?: number;
    dueTodayCount?: number;
    dueSoonCount?: number;
    technicianLoads?: {id: string | null; name: string; count: number; overdue: number}[];
    clinicLoads?: {name: string; count: number; overdue: number}[];
    materialLoads?: {name: string; count: number}[];
    attentionTasks?: {id: string; orderId: string; orderNumber: string; workTypeName: string; clinicName: string; technicianName: string; statusName: string; deadline: string | null; isOverdue: boolean; unassigned: boolean; stageDays: number}[];
    totalTasksCount: number;
    inProgressTasksCount: number;
    onReviewTasksCount: number;
    overdueTasksCount: number;
    displayedTasksCount: number;
    cardsTruncated: boolean;
    unassignedTasksCount?:number; stalledTasksCount?:number;
    columns: TaskDashboardColumn[];
    totalCompletedCount: number;
    recentCompletedTasks: RecentCompletedDashboardTask[];
};

export type EmployeeKanbanTask = {
    id: string;
    orderId: string;
    workTypeName: string;
    workTypeCode: string;
    workTypeId?: string;
    workDirectionId?: string;
    workDirectionName?: string;
    workDirectionCode?: string;
    materialIds: string[];
    materialNames: string[];
    colorCode: string;
    quantity: number;
    totalAmount: number;
    currentStatusId?: string;
    currentStatusFormName: string;
    currentStatusCode: string;
    isCompleted?: boolean;
    hasAccess?: boolean;
    dentalTechnicianFullName: string;
    toothNumbers: number[];
    allowedNextStatusIds: string[];
};

export type EmployeeKanbanColumn = {
    statusName: string;
    title: string;
    taskCount: number;
    tasks: EmployeeKanbanTask[];
};

export type EmployeeKanbanResponse = {
    previousColumn: EmployeeKanbanColumn;
    currentColumn: EmployeeKanbanColumn;
    nextColumn: EmployeeKanbanColumn;
};

export type GetOrderEmployeeKanbanArgs = {
    orderId: string;
};

export type GetMyTasksCalendarArgs = {
    year: number;
    month: number;
};

export type EmployeeCalendarTask = {
    taskId: string;
    orderId: string;
    orderNumber: string | null;
    deadline: string;
    patientName: string;
    clinicName: string;
    workTypeName: string;
    workTypeCode: string;
    statusName: string;
    statusCode: string;
    statusColor: string | null;
    quantity: number;
};

export type EmployeeCalendarDay = {
    date: string;
    taskCount: number;
    tasks: EmployeeCalendarTask[];
};

export type EmployeeCalendarResponse = {
    year: number;
    month: number;
    days: EmployeeCalendarDay[];
};

export type ReworkEligibleAssignee = {
    userId: string;
    fullName: string;
    activeTaskCount: number;
    isCurrent: boolean;
};

export type TaskReworkOption = {
    statusId: string;
    statusCode: string;
    statusName: string;
    sortOrder: number;
    requiredRole: string;
    eligibleAssignees: ReworkEligibleAssignee[];
};

export type QualityIncidentType = 'REWORK' | 'DEFECT';

export type QualityIncidentStatus = 'OPEN' | 'RESOLVED' | string;

export type QualityIncident = {
    id: string;
    taskId: string;
    incidentType: QualityIncidentType;
    status: QualityIncidentStatus;
    reasonCode: string;
    description: string;
    reportedBy: string;
    assignedTo: string | null;
    materialLossAmount?: number | null;
    salaryDeductionAmount?: number | null;
    createdAt: string;
    resolvedAt?: string | null;
    resolutionComment?: string | null;
};

export type ReworkStockWriteOff = {
    nomenclatureId: string;
    quantity: number;
};

export type ReturnTaskForReworkRequest = {
    targetStatusId: string;
    assignedTo: string;
    incidentType: QualityIncidentType;
    reasonCode: string;
    description: string;
    materialLossAmount?: number | null;
    salaryDeductionAmount?: number | null;
    stockWriteOffs?: ReworkStockWriteOff[];
};

export type ReturnTaskForReworkArgs = {
    taskId: string;
    body: ReturnTaskForReworkRequest;
};

export type GetQualityIncidentsArgs = {
    taskId: string;
    page?: number;
    size?: number;
};

export type QualityIncidentsResponse = {
    content: QualityIncident[];
    page?: number;
    number?: number;
    size: number;
    hasNext?: boolean;
    last?: boolean;
    totalElements?: number;
    totalPages?: number;
};

export type ResolveQualityIncidentArgs = {
    taskId: string;
    incidentId: string;
    resolutionComment: string;
};

export type MaterialPlanItem = {
    nomenclatureId: string;
    nomenclatureName: string;
    unit: string;
    remainingStandardQuantity: number;
    remainingWasteQuantity: number;
    remainingReservedQuantity: number;
    wasteLimitPercent?: number | null;
};

export type MaterialUsageRequest = {
    nomenclatureId: string;
    issuedQuantity: number;
    consumedQuantity: number;
    wasteQuantity: number;
    returnedQuantity: number;
    note?: string;
};

export type MaterialUsageHistoryItem = MaterialUsageRequest & {
    id?: string;
    materialReportId: string;
    nomenclatureName: string;
    unit: string;
    createdAt: string;
    employeeName: string;
    previousStatusName: string;
    nextStatusName: string;
};

export type MaterialAccountingItem = {
    nomenclatureId: string;
    nomenclatureName: string;
    unit: string;
    plannedStandardQuantity: number;
    plannedWasteQuantity: number;
    plannedTotalQuantity: number;
    issuedQuantity: number;
    actualConsumedQuantity: number;
    actualWasteQuantity: number;
    returnedQuantity: number;
    actualWriteOffQuantity: number;
    varianceQuantity: number;
    finalizedCost: number;
    remainingReservedQuantity?: number;
    wasteLimitPercent?: number | null;
};

export type MaterialAccounting = {
    taskId: string;
    finalized: boolean;
    finalizedAt: string | null;
    items: MaterialAccountingItem[];
};
