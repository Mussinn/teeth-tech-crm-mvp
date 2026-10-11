import { teethTechApi } from '@/src/services/teethTechApi';
import type {
    GetPatientHistoryArgs,
    PatientHistoryResponse,
    PatientSearchResponse,
    SearchPatientsArgs,
} from '@/src/types/patient.type';

export const patientHistoryApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        searchPatients: builder.query<PatientSearchResponse, SearchPatientsArgs>({
            query: ({ clinicId, query, limit = 20 }) => ({
                url: '/orders/form-options/people',
                method: 'GET',
                params: {
                    clinicId,
                    role: 'PATIENT',
                    q: query.trim(),
                    limit: Math.min(Math.max(limit, 1), 50),
                },
                notification: { error: false },
            }),
        }),
        getPatientHistory: builder.query<PatientHistoryResponse, GetPatientHistoryArgs>({
            query: ({ patientId, page, size = 20 }) => ({
                url: `/patientCard/${encodeURIComponent(patientId)}/history`,
                method: 'GET',
                params: {
                    page: Math.max(page, 0),
                    size: Math.min(Math.max(size, 1), 100),
                    sort: 'orderedAt,DESC',
                },
                notification: { error: false },
            }),
            providesTags: (_result, _error, { patientId }) => [
                { type: 'PatientHistory', id: patientId },
            ],
        }),
    }),
});

export const {
    useLazySearchPatientsQuery,
    useGetPatientHistoryQuery,
} = patientHistoryApi;
