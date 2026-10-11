import { describe, expect, it } from 'vitest';

import { logout, setUser } from '@/src/features/auth/authSlice';
import { makeStore } from '@/src/lib/store';
import { teethTechApi } from '@/src/services/teethTechApi';

const firstUser = {
    id: 'user-1',
    name: 'first@example.com',
    role: 'ADMIN' as const,
    avatarUrl: '',
    roles: ['ADMIN'],
};

describe('store session isolation', () => {
    it('clears all application state on logout while retaining a completed auth hydration state', () => {
        const store = makeStore();
        store.dispatch(setUser(firstUser));
        store.dispatch(logout());

        expect(store.getState().auth).toMatchObject({
            id: null,
            roles: [],
            isAuthenticated: false,
            isInitialized: true,
        });
        expect(store.getState()[teethTechApi.reducerPath].queries).toEqual({});
    });

    it('clears cached application state before accepting a different user', () => {
        const store = makeStore();
        store.dispatch(setUser(firstUser));
        store.dispatch(setUser({ ...firstUser, id: 'user-2' }));

        expect(store.getState().auth.id).toBe('user-2');
        expect(store.getState()[teethTechApi.reducerPath].queries).toEqual({});
    });
});
