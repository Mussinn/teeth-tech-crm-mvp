export type Login = {
    email: string;
    password: string;
}

export type LoginResponse = {
    id: string;
    email: string;
    token?: string;
    roles: string[];
}

export type AuthSession = Omit<LoginResponse, 'token'>;

export type Register = {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    workDirectionIds?: string[];
}
