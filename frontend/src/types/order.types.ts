//types/order.types.ts
export type ImplantSource = 'clinic' | 'lab';

export type OrderTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type OrderTaskType =
    | 'PHYSICAL_COPY'
    | 'DIGITAL_COPY'
    | 'ELECTRONIC_COPY'
    | 'PROSTHESIS';

import type {
    OrderTaskStatus,
    TaskAssignmentMode,
    TaskAttachment,
    TaskComment,
    TaskImage,
    TaskStatusAssigneeRequest,
} from './task.types';

export type AddTaskDto = {
    workDirectionId: string,
    workTypeId: string,
    quantity: number,
    toothNumbers: number[]
    orderId: string,
    colorId: string,
    materialIds: string[],
    pricePerUnit: number,
    discountPercent: number
}
export type Sort = {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
}

export type PageableInfo = {
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    sort: Sort;
    unpaged: boolean;
    offset: number
}

export interface OrderGetApiResponse {
    pageable: PageableInfo;
    first: boolean;
    sort: Sort;
    number: number;
    numberOfElements: number;
    last: boolean;
    size: number;
    content: OrderApiListItem[];
    empty: boolean;
    totalElements?: number;
    totalPages?: number;
}

export interface OrderTask extends CreateOrderTask {
    id: string;
    orderId: string;
    status: OrderTaskStatus;
    comments?: TaskComment[];
    attachments?: TaskAttachment[];
    images?: TaskImage[];
}

export interface CreateOrderTask {
    taskType?: OrderTaskType;
    type: string;
    units: number;
    material: string;
    color: string;
    unitPrice: number;
    discount: number;
    impressionQty: number;
    transferQty: number;
    biteQty: number;
    analogQty: number;
    implantSystem: string;
    implantSize: string;
    implantQty: number;
    implantSource: ImplantSource;
    abutment: string;
    priority: OrderTaskPriority;
    operatorId: string;
    technicianId: string;
}

export interface CreateOrderPayload {
    id: string;
    clinicId: string;
    clinicName: string;
    patient: string;
    doctor: string;
    deadline: string;
    comment: string;
    tasks: OrderTask[];
    total: number;
    paid: number;
    unpaid: number;
    status: string;
}

export interface OrderListItem {
    id: string;
    orderNumber?: string;
    patient: string;
    clinic?: string;
    clinicName?: string;
    doctor: string;
    work?: string;
    workType?: string;
    deadline?: string;
    status: string;
    units?: number;
    color?: string;
    abutment?: string | number;
    impression?: boolean | number;
    transfer?: boolean | number;
    bite?: boolean | number;
    analog?: boolean | number;
    technician?: string;
    operator?: string;
    unitPrice?: number;
    discount?: number;
    discountPercent?: number,
    total?: number;
    paid?: number;
    unpaid?: number;
    date?: string;
    clinicId?: string;
    taskType?: OrderTaskType;
    comment?: string;
    tasks?: OrderTask[];
}

export interface OrderApiListItem {
    id: string;
    orderNumber: string;
    patientFullName: string;
    summaryWorkType: string;
    isActive: boolean;
    quantity: number;
    pricePerUnit: number;
    discount: number;
    totalPrice: number;
    taskIds: string[];
    clinic: string;
    clinicId?: string;
    doctorFullName?: string;
    deadline?: string;
    comment?: string;
    createdAt?: string;
    completedAt?: string;
}

export interface CreateOrderResponse extends OrderApiListItem {
    taskIds: string[];
}

export interface OrderDetails {
    id: string;
    orderNumber?: string;
    patientFullName?: string;
    patientName?: string;
    patient?: string;
    clinicId?: string;
    clinicName?: string;
    clinic?: string | {
        name?: string;
    };
    doctorFullName?: string;
    doctorName?: string;
    doctor?: string;
    deadline?: string;
    summaryWorkType?: string;
    isActive?: boolean;
    quantity?: number;
    pricePerUnit?: number;
    discount?: number;
    totalPrice?: number;
    dentalTechnicianFullName?: string;
    cadCamOperatorFullName?: string;
    operatorFullName?: string;
    dentalTechnician?: OrderKanbanAssignee;
    cadCamOperator?: OrderKanbanAssignee;
    operator?: OrderKanbanAssignee;
    tasks?: OrderKanbanTask[];
}

export interface CreateOrderTaskDto {
    workDirectionId: string;
    workTypeId: string;
    quantity: number;
    toothNumbers: number[];
    orderId?: string;
    colorId: string;
    materialIds: string[];
    pricePerUnit: number;
    discount: number;
    discountPercent: 0;
    assignmentMode: TaskAssignmentMode;
    statusAssignees: TaskStatusAssigneeRequest[];
    attachments?: TaskAttachment[];
    images?: TaskImage[];
}

export interface CreateOrderDto {
    patientCardId?: string;
    newPatient?: boolean;
    clinicId: string;
    patientFullName: string;
    doctorFullName: string;
    deadline: string;
    comment: string;
    tasks: CreateOrderTaskDto[];
}

export interface CreateOrderTaskRequest {
    workDirectionId: string;
    workTypeId: string;
    quantity: number;
    toothNumbers: number[];
    orderId?: string;
    colorId: string;
    materialIds: string[];
    pricePerUnit: number;
    discountPercent: number;
    assignmentMode: TaskAssignmentMode;
    statusAssignees: TaskStatusAssigneeRequest[];
}

export interface CreateOrderRequest extends Omit<CreateOrderDto, 'tasks'> {
    tasks: CreateOrderTaskRequest[];
}

export interface UpdateOrderDto {
    deadline?: string;
    comment?: string;
    dentalTechnicianId?: string;
    cadCamOperatorId?: string;
}

export interface UpdateOrderArgs {
    id: string;
    body: UpdateOrderDto;
}

export interface GetOrderKanbanArgs {
    id: string;
}

export interface OrderKanbanAssignee {
    id: string;
    fullName: string;
}

export interface OrderKanbanTask {
    id: string;
    orderId: string;
    workTypeId?: string;
    workDirectionId: string;
    workDirectionName: string;
    workDirectionCode: string;
    taskType?: OrderTaskType;
    workTypeName: string;
    workTypeCode: string;
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
    taskNumber?: string;
    technician?: OrderKanbanAssignee;
    operator?: OrderKanbanAssignee;
    assignedUser?: OrderKanbanAssignee;
    assignedUserId?: string;
    assignedUserFullName?: string;
    cadCamOperatorFullName?: string;
    pricePerUnit?: number;
    totalPrice?: number;
}

export interface OrderKanbanColumn {
    statusId?: string;
    statusName: string;
    title: string;
    taskCount: number;
    tasks: OrderKanbanTask[];
}

export interface UpdateTaskStatusDto {
    nextStatusId: string;
    comment?: string;
    assignedUserId?: string | null;
    materialReportId?: string;
    materialUsages?: import('./task.types').MaterialUsageRequest[];
}

export interface UpdateTaskStatusArgs {
    taskId: string;
    body: UpdateTaskStatusDto;
}

export interface UpdateTaskMaterialsArgs {
    taskId: string;
    materialIds: string[];
}

export interface UpdateTaskRequest {
    workDirectionId?: string;
}

export interface UpdateTaskArgs {
    taskId: string;
    body: UpdateTaskRequest;
}

export interface AssignTaskArgs {
    taskId: string;
    userId: string;
    orderId: string;
}
