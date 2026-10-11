import {teethTechApi} from "@/src/services/teethTechApi";

import type {
    ClinicGetApiResponse,
    Clinic,
    CreateClinicDto,
    ClinicDoctor,
    ClinicDetailedInfo,
    ClinicOrder,
    ClinicPatient,
    ClinicRelatedPageResponse,
    ClinicSearchResponse,
    UpdateClinicDto
} from '@/src/types/clinic.types'

import type  {
    GetClinicRelatedParams,
    GetClinicsParams,
    SearchClinicsParams
} from '@/src/types/params.types'
import {formatPhoneNumber} from '@/src/utils/phone';

export const clinicsApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getClinics: builder.query<ClinicGetApiResponse, GetClinicsParams>({
            query: ({ page, size, sort }) => ({
                url: '/clinics',
                method: 'GET',
                params: {
                    page,
                    size,
                    sort: 'name,ASC'
                }
            }),
            providesTags: ["Clinics"],
        }),
        searchClinics: builder.query<ClinicSearchResponse, SearchClinicsParams | void>({
            query: (params) => ({
                url: '/clinics/search',
                method: 'GET',
                params: params
                    ? Object.fromEntries(
                        Object.entries(params).filter(([, value]) => value !== undefined)
                    )
                    : undefined,
            }),
            providesTags: ["Clinics"],
        }),
        getClinicsById: builder.query<ClinicDetailedInfo, string>({
            query: (id) => `/clinics/${id}`,
            providesTags: (_result, _error, id) => [
                {
                    type: "Clinics",
                    id
                }
            ]
        }),
        getClinicDoctors: builder.query<ClinicRelatedPageResponse<ClinicDoctor>, GetClinicRelatedParams>({
            query: ({ id, page, size, sort }) => ({
                url: `/clinics/${id}/doctors`,
                method: 'GET',
                params: {
                    page,
                    size,
                    ...(sort ? { sort } : {}),
                },
            }),
            providesTags: (_result, _error, { id }) => [
                {
                    type: "Clinics",
                    id: `${id}-doctors`,
                }
            ]
        }),
        getClinicOrders: builder.query<ClinicRelatedPageResponse<ClinicOrder>, GetClinicRelatedParams>({
            query: ({ id, page, size, sort }) => ({
                url: `/clinics/${id}/orders`,
                method: 'GET',
                params: {
                    page,
                    size,
                    ...(sort ? { sort } : {}),
                },
            }),
            providesTags: (_result, _error, { id }) => [
                {
                    type: "Clinics",
                    id: `${id}-orders`,
                }
            ]
        }),
        getClinicPatients: builder.query<ClinicRelatedPageResponse<ClinicPatient>, GetClinicRelatedParams>({
            query: ({ id, page, size, sort }) => ({
                url: `/clinics/${id}/patients`,
                method: 'GET',
                params: {
                    page,
                    size,
                    ...(sort ? { sort } : {}),
                },
            }),
            providesTags: (_result, _error, { id }) => [
                {
                    type: "Clinics",
                    id: `${id}-patients`,
                }
            ]
        }),
        updateClinic: builder.mutation<
            ClinicDetailedInfo,
            {
                id: string;
                body: UpdateClinicDto;
            }>({
            query: ({id, body}) => ({
                url: `/clinics/${id}`,
                method: "PATCH",
                body: {
                    ...body,
                    ...(body.phone !== undefined
                        ? {phone: formatPhoneNumber(body.phone)}
                        : {}),
                },
            }),

            invalidatesTags: (_result, _error, {id}) => ["Clinics", {
                type: "Clinics",
                id
            }]
        }),
        createClinic: builder.mutation<Clinic, CreateClinicDto>({
            query: (body) => ({
                url: '/clinics',
                method: 'POST',
                body: {...body, phone: formatPhoneNumber(body.phone)},
            }),
            invalidatesTags: ["Clinics"],
        }),
        deleteClinic: builder.mutation<void, string>({
            query: (id) => ({
                url: `/clinics/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ["Clinics"],
        })
    })
})

export const {
    useGetClinicsQuery,
    useSearchClinicsQuery,
    useGetClinicsByIdQuery,
    useGetClinicDoctorsQuery,
    useGetClinicOrdersQuery,
    useGetClinicPatientsQuery,
    useCreateClinicMutation,
    useUpdateClinicMutation,
    useDeleteClinicMutation,
} = clinicsApi;
