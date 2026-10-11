import {
    teethTechApi,
    type ApiCallNotificationOptions,
} from '@/src/services/teethTechApi';

import type {
    DeleteTaskFileArgs,
    GetTaskFilesArgs,
    GetTaskFileUrlArgs,
    InitMultipartTaskFileUploadArgs,
    InitMultipartTaskFileUploadResponse,
    MultipartTaskFileArgs,
    MultipartTaskFileProgress,
    TaskFile,
    TaskFileUrlResponse,
    UploadMultipartTaskFilePartArgs,
    UploadTaskFileArgs,
} from '@/src/types/task.types';

type WithNotificationOptions = {
    notification?: ApiCallNotificationOptions;
};

function buildFileFormData(file: Blob, fileName?: string) {
    const formData = new FormData();

    if (fileName) {
        formData.append('file', file, fileName);
    } else {
        formData.append('file', file);
    }

    return formData;
}

export const taskFilesApi = teethTechApi.injectEndpoints({
    endpoints: (builder) => ({
        getTaskFiles: builder.query<TaskFile[], GetTaskFilesArgs>({
            query: ({ taskId, type }) => ({
                url: `/tasks/${taskId}/files`,
                method: 'GET',
                params: {
                    ...(type ? { type } : {}),
                },
            }),
            providesTags: (_result, _error, { taskId }) => [
                { type: 'TaskFiles', id: taskId },
            ],
        }),

        uploadTaskFile: builder.mutation<TaskFile, UploadTaskFileArgs & WithNotificationOptions>({
            query: ({ taskId, file, type = 'FILE', notification }) => ({
                url: `/tasks/${taskId}/files/upload`,
                method: 'POST',
                params: { type },
                body: buildFileFormData(file, file.name),
                notification,
            }),
            invalidatesTags: (_result, _error, { taskId }) => [
                { type: 'TaskFiles', id: taskId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),

        deleteTaskFile: builder.mutation<void, DeleteTaskFileArgs>({
            query: ({ taskId, attachmentId }) => ({
                url: `/tasks/${taskId}/files/${attachmentId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { taskId }) => [
                { type: 'TaskFiles', id: taskId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),

        getTaskFileUrl: builder.query<TaskFileUrlResponse, GetTaskFileUrlArgs>({
            query: ({ taskId, attachmentId }) => ({
                url: `/tasks/${taskId}/files/${attachmentId}/url`,
                method: 'GET',
            }),
        }),

        downloadTaskFile: builder.query<Blob, GetTaskFileUrlArgs>({
            query: ({ taskId, attachmentId }) => ({
                url: `/tasks/${taskId}/files/${attachmentId}/download`,
                method: 'GET',
                responseHandler: (response) => response.blob(),
            }),
        }),

        initMultipartTaskFileUpload: builder.mutation<
            InitMultipartTaskFileUploadResponse,
            InitMultipartTaskFileUploadArgs & WithNotificationOptions
        >({
            query: ({ taskId, fileName, contentType, totalParts, notification }) => ({
                url: `/tasks/${taskId}/files/multipart/init`,
                method: 'POST',
                params: {
                    fileName,
                    contentType,
                    totalParts,
                },
                notification,
            }),
        }),

        uploadMultipartTaskFilePart: builder.mutation<
            void,
            UploadMultipartTaskFilePartArgs & WithNotificationOptions
        >({
            query: ({ taskId, fileId, partNumber, file, fileName, notification }) => ({
                url: `/tasks/${taskId}/files/multipart/${fileId}/part`,
                method: 'POST',
                params: { partNumber },
                body: buildFileFormData(file, fileName),
                notification,
            }),
        }),

        completeMultipartTaskFileUpload: builder.mutation<
            TaskFile,
            MultipartTaskFileArgs & WithNotificationOptions
        >({
            query: ({ taskId, fileId, notification }) => ({
                url: `/tasks/${taskId}/files/multipart/${fileId}/complete`,
                method: 'POST',
                notification,
            }),
            invalidatesTags: (_result, _error, { taskId }) => [
                { type: 'TaskFiles', id: taskId },
                { type: 'TaskHistory', id: taskId },
            ],
        }),
        abortMultipartTaskFileUpload: builder.mutation<void, MultipartTaskFileArgs>({
            query: ({ taskId, fileId }) => ({
                url: `/tasks/${taskId}/files/multipart/${fileId}/abort`,
                method: 'DELETE',
            }),
        }),
        getMultipartTaskFileProgress: builder.query<
            MultipartTaskFileProgress,
            MultipartTaskFileArgs
        >({
            query: ({ taskId, fileId }) => ({
                url: `/tasks/${taskId}/files/multipart/${fileId}/progress`,
                method: 'GET',
            }),
        }),
    }),
});

export const {
    useGetTaskFilesQuery,
    useUploadTaskFileMutation,
    useDeleteTaskFileMutation,
    useLazyGetTaskFileUrlQuery,
    useLazyDownloadTaskFileQuery,
    useInitMultipartTaskFileUploadMutation,
    useUploadMultipartTaskFilePartMutation,
    useCompleteMultipartTaskFileUploadMutation,
    useAbortMultipartTaskFileUploadMutation,
    useGetMultipartTaskFileProgressQuery,
} = taskFilesApi;
