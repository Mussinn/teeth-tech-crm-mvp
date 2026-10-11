export type PersonalNote = {
    id: string;
    title: string;
    content: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
};

export type PersonalNotePayload = {
    title: string;
    content: string;
};

export type PersonalNotesPage = {
    content: PersonalNote[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
    empty: boolean;
};

export type GetPersonalNotesParams = {
    q?: string;
    page?: number;
    size?: number;
};
