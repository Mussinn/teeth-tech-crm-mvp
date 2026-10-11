'use client';

import { type ChangeEvent, useMemo, useState } from 'react';
import {useTranslations} from 'next-intl';
import { useNotifications } from '@/src/features/notifications/useNotifications';
import {
    useAbortMultipartTaskFileUploadMutation,
    useCompleteMultipartTaskFileUploadMutation,
    useDeleteTaskFileMutation,
    useGetTaskFilesQuery,
    useInitMultipartTaskFileUploadMutation,
    useLazyDownloadTaskFileQuery,
    useLazyGetTaskFileUrlQuery,
    useUploadMultipartTaskFilePartMutation,
    useUploadTaskFileMutation,
} from '@/src/services/api/taskFilesApi';
import type {
    TaskAttachment,
    TaskFile,
    TaskFileAttachmentType,
    TaskImage,
} from '@/src/types/task.types';
import ConfirmDialog from '@/src/components/ui/ConfirmDialog';
import { getSafeExternalUrl, getSafeObjectUrl, openSafeExternalUrl } from '@/src/lib/safeUrl';

type TaskFilesPanelProps = {
    taskId?: string | null;
    fallbackImages?: TaskImage[];
    fallbackAttachments?: TaskAttachment[];
    onAddImages?: (images: TaskImage[]) => void;
    onAddAttachments?: (files: TaskAttachment[]) => void;
    className?: string;
};

type DisplayFile = {
    id: string;
    name: string;
    sizeLabel: string;
    contentType?: string;
    url?: string;
    source: 'server' | 'local';
    attachmentType: TaskFileAttachmentType;
};

type UploadState = {
    fileName: string;
    percent: number;
    type: TaskFileAttachmentType;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIMPLE_UPLOAD_LIMIT = 10 * 1024 * 1024;
const MULTIPART_CHUNK_SIZE = SIMPLE_UPLOAD_LIMIT;

export default function TaskFilesPanel({
                                           taskId,
                                           fallbackImages = [],
                                           fallbackAttachments = [],
                                           onAddImages,
                                           onAddAttachments,
                                   className = '',
                               }: TaskFilesPanelProps) {
    const t = useTranslations('tasks.files');
    const commonT = useTranslations('common.actions');
    const { notifyError, notifySuccess } = useNotifications();
    const activeTaskId = taskId ?? '';
    const canUseServerFiles = UUID_PATTERN.test(activeTaskId);
    const [uploadState, setUploadState] = useState<UploadState | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [fileActionId, setFileActionId] = useState<string | null>(null);
    const [downloadActionId, setDownloadActionId] = useState<string | null>(null);
    const [fileToDelete, setFileToDelete] = useState<DisplayFile | null>(null);

    const {
        data: serverFiles = [],
        isError,
        isFetching,
        isLoading,
        refetch,
    } = useGetTaskFilesQuery(
        { taskId: activeTaskId },
        { skip: !canUseServerFiles }
    );
    const [uploadTaskFile] = useUploadTaskFileMutation();
    const [deleteTaskFile] = useDeleteTaskFileMutation();
    const [getTaskFileUrl] = useLazyGetTaskFileUrlQuery();
    const [downloadTaskFile] = useLazyDownloadTaskFileQuery();
    const [initMultipartUpload] = useInitMultipartTaskFileUploadMutation();
    const [uploadMultipartPart] = useUploadMultipartTaskFilePartMutation();
    const [completeMultipartUpload] = useCompleteMultipartTaskFileUploadMutation();
    const [abortMultipartUpload] = useAbortMultipartTaskFileUploadMutation();

    const filesByType = useMemo(() => {
        if (canUseServerFiles) {
            const displayFiles = serverFiles.map((file) => mapServerFile(file, t('fallbackName')));

            return {
                screens: displayFiles.filter((file) => file.attachmentType === 'SCREEN'),
                documents: displayFiles.filter((file) => file.attachmentType !== 'SCREEN'),
            };
        }

        return {
            screens: fallbackImages.map(mapLocalImage),
            documents: fallbackAttachments.map(mapLocalAttachment),
        };
    }, [canUseServerFiles, fallbackAttachments, fallbackImages, serverFiles, t]);

    const handleFilesSelected = async (
        event: ChangeEvent<HTMLInputElement>,
        type: TaskFileAttachmentType
    ) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);

        if (!files.length) return;

        try {
            if (!canUseServerFiles) {
                addLocalFiles(files, type);
                return;
            }

            for (const file of files) {
                await uploadFile(file, type);
            }

            await refetch();
        } catch (error) {
            if (error instanceof Error) notifyError(error.message);
        } finally {
            setUploadState(null);
            input.value = '';
        }
    };

    const addLocalFiles = (files: File[], type: TaskFileAttachmentType) => {
        if (type === 'SCREEN') {
            onAddImages?.(files.map(createLocalImage));
            return;
        }

        onAddAttachments?.(files.map(createLocalAttachment));
    };

    const uploadFile = async (file: File, type: TaskFileAttachmentType) => {
        setUploadState({
            fileName: file.name,
            percent: 0,
            type,
        });

        if (file.size < SIMPLE_UPLOAD_LIMIT) {
            await uploadTaskFile({
                taskId: activeTaskId,
                file,
                type,
            }).unwrap();

            setUploadState({
                fileName: file.name,
                percent: 100,
                type,
            });
            return;
        }

        await uploadLargeFile(file, type);
    };

    const uploadLargeFile = async (file: File, type: TaskFileAttachmentType) => {
        const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
        let multipartFileId = '';

        try {
            const multipartUpload = await initMultipartUpload({
                taskId: activeTaskId,
                fileName: file.name,
                contentType: file.type || 'application/octet-stream',
                totalParts,
            }).unwrap();

            multipartFileId = multipartUpload.fileId;

            for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
                const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
                const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                await uploadMultipartPart({
                    taskId: activeTaskId,
                    fileId: multipartUpload.fileId,
                    partNumber,
                    file: chunk,
                    fileName: file.name,
                }).unwrap();

                setUploadState({
                    fileName: file.name,
                    percent: Math.round((partNumber / totalParts) * 95),
                    type,
                });
            }

            await completeMultipartUpload({
                taskId: activeTaskId,
                fileId: multipartUpload.fileId,
            }).unwrap();

            setUploadState({
                fileName: file.name,
                percent: 100,
                type,
            });
        } catch (error) {
            if (multipartFileId) {
                await abortMultipartUpload({
                    taskId: activeTaskId,
                    fileId: multipartFileId,
                }).unwrap().catch((abortError) => {
                    console.warn('Multipart upload cleanup failed:', abortError);
                });
            }

            throw error;
        }
    };

    const handleOpenFile = async (file: DisplayFile) => {
        if (file.source === 'local') {
            const localUrl = file.url ? getSafeObjectUrl(file.url) : null;

            if (!localUrl || !window.open(localUrl, '_blank', 'noopener,noreferrer')) {
                notifyError(t('missingUrl'));
                return;
            }

            notifySuccess(t('opened'));
            return;
        }

        setFileActionId(file.id);

        try {
            const response = await getTaskFileUrl({
                taskId: activeTaskId,
                attachmentId: file.id,
            }).unwrap();

            const safeUrl = response.url ? getSafeExternalUrl(response.url) : null;

            if (!safeUrl || !openSafeExternalUrl(safeUrl)) {
                throw new Error(t('missingUrl'));
            }

            notifySuccess(t('opened'));
        } catch (error) {
            if (error instanceof Error) notifyError(error.message);
        } finally {
            setFileActionId(null);
        }
    };

    const handleDeleteFile = async (file: DisplayFile) => {
        if (file.source !== 'server') return;

        setDeletingId(file.id);

        try {
            await deleteTaskFile({
                taskId: activeTaskId,
                attachmentId: file.id,
            }).unwrap();
            setFileToDelete(null);
        } catch {
            // API errors are displayed by the global notification handler.
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownloadFile = async (file: DisplayFile) => {
        if (file.source === 'local' && file.url) {
            downloadUrl(file.url, file.name);
            notifySuccess(t('downloadStarted'));
            return;
        }

        setDownloadActionId(file.id);

        try {
            const blob = await downloadTaskFile({
                taskId: activeTaskId,
                attachmentId: file.id,
            }).unwrap();
            const objectUrl = URL.createObjectURL(blob);

            downloadUrl(objectUrl, file.name);
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            notifySuccess(t('downloadStarted'));
        } catch (error) {
            if (error instanceof Error) notifyError(error.message);
        } finally {
            setDownloadActionId(null);
        }
    };

    return (
        <section className={className}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {t('title')}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                        {t('subtitle')}
                    </p>
                </div>

                {canUseServerFiles ? (
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                        {commonT('refresh')}
                    </button>
                ) : null}
            </div>

            {uploadState ? (
                <UploadProgress uploadState={uploadState} />
            ) : null}

            {isLoading ? (
                <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                        />
                    ))}
                </div>
            ) : null}

            {isError ? (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-bold text-red-700">
                        {t('loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-red-700"
                    >
                        {commonT('retry')}
                    </button>
                </div>
            ) : null}

            {!isLoading && !isError ? (
                <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4">
                    <FileBucket
                        title={t('screenshots')}
                        emptyText={t('screenshotsEmpty')}
                        files={filesByType.screens}
                        isBusy={Boolean(uploadState)}
                        deletingId={deletingId}
                        fileActionId={fileActionId}
                        downloadActionId={downloadActionId}
                        accept="image/*"
                        uploadLabel={t('add')}
                        uploadType="SCREEN"
                        onFilesSelected={handleFilesSelected}
                        onOpenFile={handleOpenFile}
                        onDownloadFile={handleDownloadFile}
                        onDeleteFile={setFileToDelete}
                    />

                    <FileBucket
                        title={t('files')}
                        emptyText={t('filesEmpty')}
                        files={filesByType.documents}
                        isBusy={Boolean(uploadState)}
                        deletingId={deletingId}
                        fileActionId={fileActionId}
                        downloadActionId={downloadActionId}
                        uploadLabel={t('attach')}
                        uploadType="FILE"
                        onFilesSelected={handleFilesSelected}
                        onOpenFile={handleOpenFile}
                        onDownloadFile={handleDownloadFile}
                        onDeleteFile={setFileToDelete}
                    />
                </div>
            ) : null}

            {!canUseServerFiles ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                    {t('afterSave')}
                </p>
            ) : null}
            <ConfirmDialog
                open={fileToDelete !== null}
                title={t('deleteTitle')}
                description={t('deleteDescription', {name: fileToDelete?.name ?? t('fallbackName')})}
                confirmLabel={t('deleteConfirm')}
                isLoading={deletingId !== null}
                onClose={() => setFileToDelete(null)}
                onConfirm={() => fileToDelete ? handleDeleteFile(fileToDelete) : undefined}
            />
        </section>
    );
}

function FileBucket({
                        title,
                        emptyText,
                        files,
                        accept,
                        uploadLabel,
                        uploadType,
                        isBusy,
                        deletingId,
                        fileActionId,
                        downloadActionId,
                        onFilesSelected,
                        onOpenFile,
                        onDownloadFile,
                        onDeleteFile,
                    }: {
    title: string;
    emptyText: string;
    files: DisplayFile[];
    accept?: string;
    uploadLabel: string;
    uploadType: TaskFileAttachmentType;
    isBusy: boolean;
    deletingId: string | null;
    fileActionId: string | null;
    downloadActionId: string | null;
    onFilesSelected: (
        event: ChangeEvent<HTMLInputElement>,
        type: TaskFileAttachmentType
    ) => void;
    onOpenFile: (file: DisplayFile) => void;
    onDownloadFile: (file: DisplayFile) => void;
    onDeleteFile: (file: DisplayFile) => void;
}) {
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="min-w-0 text-xs font-black uppercase tracking-widest text-slate-500">
                    {title}
                </h3>

                <label
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-white transition ${
                        isBusy
                            ? 'cursor-wait bg-slate-300'
                            : uploadType === 'SCREEN'
                                ? 'cursor-pointer bg-blue-600 hover:bg-blue-700'
                                : 'cursor-pointer bg-slate-900 hover:bg-slate-800'
                    }`}
                >
                    {uploadLabel}
                    <input
                        type="file"
                        accept={accept}
                        multiple
                        disabled={isBusy}
                        onChange={(event) => onFilesSelected(event, uploadType)}
                        className="hidden"
                    />
                </label>
            </div>

            {files.length ? (
                <div className="mt-3 space-y-2">
                    {files.map((file) => (
                        <FileRow
                            key={file.id}
                            file={file}
                            isDeleting={deletingId === file.id}
                            isOpening={fileActionId === file.id}
                            isDownloading={downloadActionId === file.id}
                            onOpenFile={onOpenFile}
                            onDownloadFile={onDownloadFile}
                            onDeleteFile={onDeleteFile}
                        />
                    ))}
                </div>
            ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-400">
                    {emptyText}
                </p>
            )}
        </div>
    );
}

function FileRow({
                     file,
                     isDeleting,
                     isOpening,
                     isDownloading,
                     onOpenFile,
                     onDownloadFile,
                     onDeleteFile,
                 }: {
    file: DisplayFile;
    isDeleting: boolean;
    isOpening: boolean;
    isDownloading: boolean;
    onOpenFile: (file: DisplayFile) => void;
    onDownloadFile: (file: DisplayFile) => void;
    onDeleteFile: (file: DisplayFile) => void;
}) {
    const t = useTranslations('tasks.files');
    const commonT = useTranslations('common.actions');
    return (
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">
                    {file.name}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                    {file.sizeLabel}
                    {file.contentType ? ` · ${file.contentType}` : ''}
                </p>
            </div>

            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2">
                <button
                    type="button"
                    onClick={() => onOpenFile(file)}
                    disabled={isOpening || isDownloading || isDeleting}
                    className="w-full whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
                >
                    {isOpening ? '…' : commonT('open')}
                </button>

                <button
                    type="button"
                    onClick={() => onDownloadFile(file)}
                    disabled={isOpening || isDownloading || isDeleting}
                    className="w-full whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
                >
                    {isDownloading ? '…' : t('download')}
                </button>

                {file.source === 'server' ? (
                    <button
                        type="button"
                        onClick={() => onDeleteFile(file)}
                        disabled={isOpening || isDownloading || isDeleting}
                        className="w-full whitespace-nowrap rounded-lg bg-red-50 px-2.5 py-2 text-[10px] font-black uppercase text-red-600 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-50"
                    >
                        {isDeleting ? '…' : commonT('delete')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function UploadProgress({ uploadState }: { uploadState: UploadState }) {
    return (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-bold text-blue-900">
                    {uploadState.fileName}
                </p>
                <span className="text-xs font-black text-blue-700">
                    {uploadState.percent}%
                </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${uploadState.percent}%` }}
                />
            </div>
        </div>
    );
}

function mapServerFile(file: TaskFile, fallbackName: string): DisplayFile {
    return {
        id: file.id,
        name: file.fileName || getFileNameFromPath(file.storagePath, fallbackName),
        sizeLabel: formatFileSize(file.fileSize),
        contentType: file.contentType,
        source: 'server',
        attachmentType: file.attachmentType,
    };
}

function mapLocalImage(image: TaskImage): DisplayFile {
    return {
        id: image.id,
        name: image.name,
        sizeLabel: image.size,
        url: image.url,
        source: 'local',
        attachmentType: 'SCREEN',
    };
}

function mapLocalAttachment(file: TaskAttachment): DisplayFile {
    return {
        id: file.id,
        name: file.name,
        sizeLabel: file.size,
        contentType: file.type,
        url: file.url,
        source: 'local',
        attachmentType: 'FILE',
    };
}

function createLocalImage(file: File): TaskImage {
    return {
        id: createPreviewId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: formatFileSize(file.size),
    };
}

function createLocalAttachment(file: File): TaskAttachment {
    return {
        id: createPreviewId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: formatFileSize(file.size),
        type: file.type || 'file',
    };
}

function createPreviewId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(size: number) {
    if (!Number.isFinite(size) || size <= 0) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getFileNameFromPath(path: string, fallbackName: string) {
    return path.split(/[\\/]/).filter(Boolean).pop() || fallbackName;
}

function downloadUrl(url: string, fileName: string) {
    const safeUrl = getSafeObjectUrl(url) ?? getSafeExternalUrl(url);
    if (!safeUrl) return;

    const anchor = document.createElement('a');

    anchor.href = safeUrl;
    anchor.download = fileName;
    anchor.rel = 'noreferrer';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
}
