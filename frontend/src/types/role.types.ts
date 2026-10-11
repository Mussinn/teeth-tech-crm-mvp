export type Role = {
    id: string;
    code: string;
    name: string;
    systemManaged: boolean;
    assignedUsers: number;
    workflowSteps: number;
    deletable: boolean;
};

export type CreateRoleRequest = {
    code: string;
    name: string;
};

export type UpdateRoleRequest = {
    name: string;
};
