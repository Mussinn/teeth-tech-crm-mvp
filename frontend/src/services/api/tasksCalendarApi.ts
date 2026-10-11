import { teethTechApi } from '@/src/services/teethTechApi';

import type {
    EmployeeCalendarResponse,
    GetMyTasksCalendarArgs,
} from '@/src/types/task.types';

export const tasksCalendarApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getMyTasksCalendar: builder.query<
            EmployeeCalendarResponse,
            GetMyTasksCalendarArgs
        >({
            query: ({ year, month }) => ({
                url: '/tasks/calendar/my',
                method: 'GET',
                params: {
                    year,
                    month,
                },
            }),
            providesTags: ['Tasks'],
        }),
    }),
});

export const { useGetMyTasksCalendarQuery } = tasksCalendarApi;
