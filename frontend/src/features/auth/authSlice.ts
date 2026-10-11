import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthRole = 'ADMIN' | 'CHIEF_TECHNICIAN' | 'DISPATCHER' | 'TECHNICIAN' | 'FINANCIER';

export interface UserState {
    id: string | null;
    name: string | null;
    role: AuthRole | null;
    avatarUrl?: string;
    roles: string[];
    isAuthenticated: boolean;
    isInitialized: boolean;
}

type SetUserPayload = Omit<UserState, 'isAuthenticated' | 'isInitialized'>;

const initialState: UserState = {
    id: null,
    name: null,
    role: null,
    roles: [],
    isAuthenticated: false,
    isInitialized: false,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {

        setUser: (state, action: PayloadAction<SetUserPayload>) => {
            state.id = action.payload.id;
            state.name = action.payload.name;
            state.role = action.payload.role;
            state.avatarUrl = action.payload.avatarUrl;
            state.roles = action.payload.roles ?? [];
            state.isAuthenticated = true;
            state.isInitialized = true;
        },
        finishAuthHydration: (state) => {
            state.isInitialized = true;
        },
        logout: (state) => {
            state.id = null;
            state.name = null;
            state.role = null;
            state.avatarUrl = undefined;
            state.roles = [];
            state.isAuthenticated = false;
            state.isInitialized = true;
        },
    },
});

export const { setUser, finishAuthHydration, logout } = authSlice.actions;
export default authSlice.reducer;
