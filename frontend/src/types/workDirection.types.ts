export interface WorkDirection {
    id: string;
    name: string;
    code: string;
    description: string | null;
    active: boolean;
}

export type WorkDirectionRequest = Omit<WorkDirection, 'id'>;

export type GetWorkDirectionsArgs = {
    includeInactive?: boolean;
};
