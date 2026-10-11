export interface WorkflowTransition {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    code: string;
    name: string;
    description?: string;
    sortOrder?: number;
    colorHex?: string;
    fromStatusId?: string;
    toStatusId?: string;
    terminal?: boolean;
    materialReportRequired: boolean;
    allowUnplannedMaterials: boolean;
}

type StagesWorkflowWorkTypesDTO = {
    code: string;
    name: string;
    description: string;
    colorHex: string;
    requiredRole: string;
    materialReportRequired: boolean;
    allowUnplannedMaterials: boolean;
};

export type CreateWorkflowWorkTypesDTO = {
    workTypeCode: string,
    workTypeName: string,
    description: string,
    stages: StagesWorkflowWorkTypesDTO[]
}

export type CreateWorkflowWorkTypesResponseDTO = {
    workTypeId: string,
    workTypeCode: string,
    workTypeName: string,
    steps: Array<{
        id: string;
        workTypeId: string;
        workTypeName: string;
        fromStatusId: string;
        fromStatusCode: string;
        fromStatusName: string;
        toStatusId: string;
        toStatusCode: string;
        toStatusName: string;
        requiredRole: string;
        sortOrder: number;
        materialReportRequired: boolean;
        allowUnplannedMaterials: boolean;
    }>;
}

export interface GetAvailableWorkflowTransitionsArgs {
    workType: string;
    currentStatusId: string;
}

export type WorkflowStatus = {
    active?: boolean;
    id: string;
    code: string;
    name: string;
    description: string;
    sortOrder: number;
    colorHex: string;
    initial: boolean;
    terminal: boolean;
    review: boolean;
};

export type WorkflowStep = {
    id: string;
    workTypeId: string;
    workTypeName: string;
    fromStatusId: string;
    fromStatusName: string;
    toStatusId: string;
    toStatusName: string;
    requiredRole: string;
    sortOrder: number;
    materialReportRequired: boolean;
    allowUnplannedMaterials: boolean;
};

export type GetWorkflowStepsArgs = {
    workTypeId: string;
};

export type OrderStatus = WorkflowStatus;
