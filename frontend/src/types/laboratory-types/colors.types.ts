export type Color = {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
};

export type CreateColorDto = {
    code: string;
    name: string;
    isActive: boolean;
};

export type UpdateColorDto = {
    code: string;
    name: string;
    isActive: boolean;
};

export type UpdateColorArgs = {
    id: string;
    body: UpdateColorDto;
};