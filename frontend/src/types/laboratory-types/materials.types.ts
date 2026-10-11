export type Material = {
    id: string;
    name: string;
    description: string;
    price?: number;
    quantity?: number;
    unit?: MaterialUnit;
    isActive: boolean;
};

export type MaterialUnit = 'G' | 'KG';

export type CreateMaterialDto = {
    name: string;
    description: string;
    nomenclatureCode?: string;
    price?: number;
    quantity?: number;
    unit: string;
};

export type UpdateMaterialDto = {
    name: string;
    description: string;
    nomenclatureCode?: string;
    price?: number;
    quantity?: number;
    unit: string;
};

export type UpdateMaterialArgs = {
    id: string;
    body: UpdateMaterialDto;
};
