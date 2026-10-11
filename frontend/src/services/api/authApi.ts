import {teethTechApi} from "@/src/services/teethTechApi";

import type {
    AuthSession,
    Login,
    Register,
} from "@/src/types/auth.types"
import {formatPhoneNumber} from '@/src/utils/phone';


export const authApi = teethTechApi.injectEndpoints({
    endpoints: builder => ({
        registerUser: builder.mutation<string, Register>({
            query: (body) => ({
               url: '/users',
               method: 'POST',
               body: {...body, phone: formatPhoneNumber(body.phone)},
            }),
            invalidatesTags: ["Users"]
        }),
        loginUser: builder.mutation<AuthSession, Login>({
            query: (body) => ({
                url: '/auth/sessions',
                method: 'POST',
                body
            })
        })
    })
})

export const {
    useRegisterUserMutation,
    useLoginUserMutation
} = authApi;
