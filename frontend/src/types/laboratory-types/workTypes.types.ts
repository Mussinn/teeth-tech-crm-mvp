export type WorkTypes = {
    id: string;
    name: string;
    code: string;
    description: string;
    isActive: boolean;
};

export type CreateWorkTypeDto = {
    name: string;
    description: string;
};

export type UpdateWorkTypesDto = {
    name: string;
    description: string;
};

export type UpdateWorkTypeArgs = {
    id: string;
    body: UpdateWorkTypesDto;
};