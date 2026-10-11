'use client';

import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CreateOrderDto, CreateOrderTaskDto } from '@/src/types/order.types';
import type { TaskAttachment, TaskImage } from '@/src/types/task.types';
import type { WorkflowStep } from '@/src/types/workflow.types';
import {useSearchPatientCardsQuery} from '@/src/services/api/ordersApi';
import {useDebouncedValue} from '@/src/hooks/useDebouncedValue';
import Modal from '@/src/components/ui/Modal';
import QueryErrorNotice from '@/src/components/ui/QueryErrorNotice';
import { useGetClinicDoctorsQuery, useGetClinicPatientsQuery, useSearchClinicsQuery } from '@/src/services/api/clinicsApi';
import { useGetUsersQuery } from '@/src/services/api/usersApi';
import { useGetWorkTypesQuery } from '@/src/services/api/laboratory/workTypesApi';
import { useGetMaterialsQuery } from '@/src/services/api/laboratory/materialApi';
import { normalizeMaterialIds, validateMaterialIds } from '@/src/utils/materialAccounting';
import { useGetColorsQuery } from '@/src/services/api/laboratory/colorsApi';
import { useGetAdminWorkflowStepsQuery } from '@/src/services/api/workflowApi';
import { useGetWorkDirectionsQuery } from '@/src/services/api/workDirectionsApi';
import { getDisplayRoleNames } from '@/src/features/auth/authUtils';
import type { User } from '@/src/types/user.types';
import { useAppFormatters } from '@/src/i18n/provider';

type CreateOrderModalProps = {
    isOpen: boolean;
    isSubmitting?: boolean;
    onClose: () => void;
    onSubmit: (order: CreateOrderDto) => Promise<void> | void;
};

const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const CLINICS_LOOKUP_PARAMS = {
    page: 0,
    size: 100,
    sort: 'name,ASC',
};
const DOCTORS_LOOKUP_PARAMS = {
    page: 0,
    size: 100,
    sort: 'fullName,ASC',
};
const PATIENTS_LOOKUP_PARAMS = {
    page: 0,
    size: 100,
    sort: 'fullName,ASC',
};
const MAX_AUTOCOMPLETE_OPTIONS = 8;
const createEmptyTask = (): CreateOrderTaskDto => ({
    workDirectionId: '',
    workTypeId: '',
    quantity: 1,
    toothNumbers: [],
    orderId: '',
    colorId: '',
    materialIds: [],
    pricePerUnit: 0,
    discount: 0,
    discountPercent: 0,
    assignmentMode: 'AUTO',
    statusAssignees: [],
    attachments: [],
    images: [],
});

const createInitialOrder = (): CreateOrderDto => ({
    clinicId: '',
    patientFullName: '',
    doctorFullName: '',
    deadline: '',
    comment: '',
    tasks: [createEmptyTask()],
});

function isCustomerStepComplete(order: CreateOrderDto) {
    return Boolean(
        order.clinicId
        && order.doctorFullName.trim()
        && order.patientFullName.trim()
        && order.deadline
    );
}

function isCreateOrderTaskComplete(task: CreateOrderTaskDto) {
    return Boolean(
        task.workDirectionId
        && task.workTypeId
        && Number(task.quantity) > 0
        && task.materialIds.length > 0
    );
}

function normalizeRoleValue(value: string | undefined) {
    return (value ?? '')
        .toLowerCase()
        .replace(/[-_/]+/g, ' ')
        .replace(/^role\s+/u, '')
        .trim();
}

function getUserRoleValues(user: User) {
    return [
        user.role,
        ...(user.roles ?? []),
        user.specialization,
    ].filter((value): value is string => Boolean(value));
}

function filterUsersByRole(users: User[], tokens: string[]) {
    const normalizedTokens = tokens.map(normalizeRoleValue);

    return users.filter((user) => {
        const normalizedUserRoles = getUserRoleValues(user)
            .map(normalizeRoleValue)
            .join(' ');

        return normalizedTokens.some((token) =>
            normalizedUserRoles.includes(token)
        );
    });
}

function getUserLabel(user: User) {
    const meta = getDisplayRoleNames(getUserRoleValues(user)).join(' / ');
    return meta ? `${user.fullName} (${meta})` : user.fullName;
}

function isAdministrator(user: User) {
    return getUserRoleValues(user).some(
        (role) => normalizeRoleValue(role) === 'admin'
    );
}

function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function createPreviewId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMoneyInput(value: string) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function getMoneyInputValue(value: number) {
    return value === 0 ? '' : String(value);
}

function calculateTaskTotal(task: CreateOrderTaskDto) {
    const subtotal = Number(task.quantity) * Number(task.pricePerUnit);

    return Math.max(subtotal - Number(task.discount), 0);
}

function prepareAttachments(files: File[]): TaskAttachment[] {
    return files.map((file) => ({
        id: createPreviewId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: formatFileSize(file.size),
        type: file.type || 'file',
        file,
    }));
}

function prepareImages(files: File[]): TaskImage[] {
    return files.map((file) => ({
        id: createPreviewId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: formatFileSize(file.size),
        file,
    }));
}

function normalizePersonSearch(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getUniqueFullNames(items: Array<{ fullName: string }>) {
    return Array.from(new Set(items.map((item) => item.fullName).filter(Boolean)));
}

type PersonAutocompleteInputProps = {
    label: string;
    placeholder: string;
    value: string;
    options: string[];
    isLoading?: boolean;
    disabledMessage?: string;
    emptyMessage: string;
    noMatchMessage: string;
    loadingMessage: string;
    onChange: (value: string) => void;
};

function PersonAutocompleteInput({
    label,
    placeholder,
    value,
    options,
    isLoading = false,
    disabledMessage,
    emptyMessage,
    noMatchMessage,
    loadingMessage,
    onChange,
}: PersonAutocompleteInputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const normalizedValue = normalizePersonSearch(value);
    const filteredOptions = useMemo(() => {
        if (!normalizedValue) {
            return options.slice(0, MAX_AUTOCOMPLETE_OPTIONS);
        }

        return options
            .filter((option) => normalizePersonSearch(option).includes(normalizedValue))
            .slice(0, MAX_AUTOCOMPLETE_OPTIONS);
    }, [normalizedValue, options]);
    const showDropdown = isFocused;
    const hasOptions = filteredOptions.length > 0;
    const statusMessage = disabledMessage ?? (
        isLoading
            ? loadingMessage
            : normalizedValue
                ? noMatchMessage
                : emptyMessage
    );

    return (
        <div className="relative">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
            <input
                required
                type="text"
                autoComplete="off"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none transition"
                placeholder={placeholder}
                value={value}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => onChange(e.target.value)}
            />

            {showDropdown && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {hasOptions ? (
                        <div className="max-h-60 overflow-y-auto py-1">
                            {filteredOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        onChange(option);
                                        setIsFocused(false);
                                    }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                            {statusMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

type AssignmentStage = {
    statusId: string;
    statusName: string;
    requiredRole: string;
    isFinalReviewStage: boolean;
};

function getAssignmentStages(steps: WorkflowStep[]): AssignmentStage[] {
    const sortedSteps = [...steps].sort((left, right) => left.sortOrder - right.sortOrder);
    const finalSortOrder = sortedSteps.at(-1)?.sortOrder;
    const destinationStatusIds = new Set(sortedSteps.map((step) => step.toStatusId));
    const initialStatusId = sortedSteps.find(
        (step) => !destinationStatusIds.has(step.fromStatusId)
    )?.fromStatusId ?? sortedSteps[0]?.fromStatusId;
    const seenStatusIds = new Set<string>();

    return sortedSteps
        .filter((step) => {
            if (step.fromStatusId === initialStatusId || seenStatusIds.has(step.fromStatusId)) {
                return false;
            }

            seenStatusIds.add(step.fromStatusId);
            return true;
        })
        .map((step) => ({
            statusId: step.fromStatusId,
            statusName: step.fromStatusName,
            requiredRole: step.requiredRole,
            isFinalReviewStage: step.sortOrder === finalSortOrder,
        }));
}

function getEligibleAssignmentUsers(
    users: User[],
    requiredRole: string,
    isFinalReviewStage: boolean
) {
    const activeUsers = users.filter((user) => user.status === 'ACTIVE');
    const normalizedRequiredRole = normalizeRoleValue(requiredRole);
    const eligibleStageUsers = isFinalReviewStage
        ? activeUsers
        : activeUsers.filter((user) => !isAdministrator(user));

    if (normalizedRequiredRole.includes('admin') || normalizedRequiredRole.includes('dispatcher')) {
        return filterUsersByRole(eligibleStageUsers, ['ROLE_ADMIN', 'ROLE_DISPATCHER']);
    }

    if (!normalizedRequiredRole) return eligibleStageUsers;

    return filterUsersByRole(eligibleStageUsers, [requiredRole]);
}

function TaskAssignmentFields({
    task,
    users,
    onChange,
}: {
    task: CreateOrderTaskDto;
    users: User[];
    onChange: (changes: Pick<CreateOrderTaskDto, 'assignmentMode' | 'statusAssignees'>) => void;
}) {
    const t = useTranslations('orders.create.assignment');
    const isPreassigned = task.assignmentMode === 'PREASSIGNED';
    const {
        data: workflowSteps = [],
        isFetching,
        isError,
    } = useGetAdminWorkflowStepsQuery(
        { workTypeId: task.workTypeId },
        { skip: !task.workTypeId || !isPreassigned }
    );
    const stages = useMemo(
        () => getAssignmentStages(workflowSteps),
        [workflowSteps]
    );
    const assigneeByStatus = new Map(
        task.statusAssignees.map((assignee) => [assignee.statusId, assignee.userId])
    );

    const handleModeChange = (assignmentMode: CreateOrderTaskDto['assignmentMode']) => {
        onChange({
            assignmentMode,
            statusAssignees: [],
        });
    };

    const handleAssigneeChange = (statusId: string, userId: string) => {
        const statusAssignees = task.statusAssignees.filter(
            (assignee) => assignee.statusId !== statusId
        );

        if (userId) {
            statusAssignees.push({ statusId, userId });
        }

        onChange({
            assignmentMode: task.assignmentMode,
            statusAssignees,
        });
    };

    return (
        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
            <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-violet-700">
                        {t('title')}
                    </span>
                    <select
                        value={task.assignmentMode}
                        onChange={(event) => handleModeChange(event.target.value as CreateOrderTaskDto['assignmentMode'])}
                        className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500"
                    >
                        <option value="AUTO">{t('automatic')}</option>
                        <option value="PREASSIGNED">{t('preassigned')}</option>
                    </select>
                </label>

                <div className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 text-xs text-slate-500">
                    {isPreassigned
                        ? t('preassignedHint')
                        : t('automaticHint')}
                </div>
            </div>

            {isPreassigned && (
                <div className="mt-4">
                    {!task.workTypeId ? (
                        <p className="rounded-xl border border-dashed border-violet-200 bg-white px-3 py-3 text-xs font-semibold text-slate-500">
                            {t('selectWorkType')}
                        </p>
                    ) : isFetching ? (
                        <p className="text-xs font-semibold text-violet-700">{t('loading')}</p>
                    ) : isError ? (
                        <p className="rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-600">
                            {t('loadError')}
                        </p>
                    ) : stages.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-violet-200 bg-white px-3 py-3 text-xs font-semibold text-slate-500">
                            {t('noStages')}
                        </p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {stages.map((stage) => {
                                const eligibleUsers = getEligibleAssignmentUsers(
                                    users,
                                    stage.requiredRole,
                                    stage.isFinalReviewStage
                                );
                                const normalizedRequiredRole = normalizeRoleValue(stage.requiredRole);
                                const roleLabel = normalizedRequiredRole.includes('admin')
                                    || normalizedRequiredRole.includes('dispatcher')
                                    ? 'ROLE_ADMIN / ROLE_DISPATCHER'
                                    : stage.requiredRole || t('anyRole');

                                return (
                                    <label key={stage.statusId} className="block rounded-xl border border-violet-100 bg-white p-3">
                                        <span className="block text-xs font-black text-slate-700">
                                            {stage.statusName}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] font-bold uppercase text-slate-400">
                                            {roleLabel}
                                        </span>
                                        <select
                                            required
                                            value={assigneeByStatus.get(stage.statusId) ?? ''}
                                            onChange={(event) => handleAssigneeChange(stage.statusId, event.target.value)}
                                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-violet-500"
                                        >
                                            <option value="">{t('employeePlaceholder')}</option>
                                            {eligibleUsers.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {getUserLabel(user)}
                                                </option>
                                            ))}
                                        </select>
                                        {eligibleUsers.length === 0 && (
                                            <span className="mt-1 block text-[10px] font-semibold text-red-500">
                                                {t('noEmployees')}
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function CreateOrderModal({
    isOpen,
    isSubmitting = false,
    onClose,
    onSubmit,
}: CreateOrderModalProps) {
    const t = useTranslations('orders.create');
    const commonT = useTranslations('common');
    const formats = useAppFormatters();
    const orderSteps = [
        { title: t('steps.customer'), hint: t('steps.customerHint') },
        { title: t('steps.works'), hint: t('steps.worksHint') },
        { title: t('steps.review'), hint: t('steps.reviewHint') },
    ];
    const {
        data: clinicsPage,
        isLoading: isClinicsLoading,
        isFetching: isClinicsFetching,
        isError: isClinicsError,
        refetch: refetchClinics,
    } = useSearchClinicsQuery(CLINICS_LOOKUP_PARAMS, { skip: !isOpen });
    const clinics = clinicsPage?.content ?? [];
    const {
        data: users = [],
        isLoading: isUsersLoading,
        isFetching: isUsersFetching,
        isError: isUsersError,
        refetch: refetchUsers,
    } = useGetUsersQuery(undefined, { skip: !isOpen });
    const {
        data: workTypes = [],
        isLoading: isWorkTypesLoading,
        isFetching: isWorkTypesFetching,
        isError: isWorkTypesError,
        refetch: refetchWorkTypes,
    } = useGetWorkTypesQuery(undefined, { skip: !isOpen });
    const {
        data: workDirections = [],
        isLoading: isWorkDirectionsLoading,
        isFetching: isWorkDirectionsFetching,
        isError: isWorkDirectionsError,
        refetch: refetchWorkDirections,
    } = useGetWorkDirectionsQuery(undefined, { skip: !isOpen });
    const {
        data: materials = [],
        isLoading: isMaterialsLoading,
        isFetching: isMaterialsFetching,
        isError: isMaterialsError,
        refetch: refetchMaterials,
    } = useGetMaterialsQuery(undefined, { skip: !isOpen });
    const {
        data: colors = [],
        isLoading: isColorsLoading,
        isFetching: isColorsFetching,
        isError: isColorsError,
        refetch: refetchColors,
    } = useGetColorsQuery(true, { skip: !isOpen });

    const [formData, setFormData] = useState<CreateOrderDto>(createInitialOrder);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeTaskIndex, setActiveTaskIndex] = useState(0);
    const {
        data: doctorsPage,
        isLoading: isDoctorsLoading,
        isFetching: isDoctorsFetching,
        isError: isDoctorsError,
        refetch: refetchDoctors,
    } = useGetClinicDoctorsQuery(
        {
            id: formData.clinicId,
            ...DOCTORS_LOOKUP_PARAMS,
        },
        {
            skip: !isOpen || !formData.clinicId,
        }
    );
    const {
        data: patientsPage,
        isLoading: isPatientsLoading,
        isFetching: isPatientsFetching,
        isError: isPatientsError,
        refetch: refetchPatients,
    } = useGetClinicPatientsQuery(
        {
            id: formData.clinicId,
            ...PATIENTS_LOOKUP_PARAMS,
        },
        {
            skip: !isOpen || !formData.clinicId,
        }
    );
    const patientSearch=useDebouncedValue(formData.patientFullName.trim().replace(/\s+/g," "),300);
    const {data:matchingPatients,isFetching:matchingPatientsLoading,isError:matchingPatientsError}=useSearchPatientCardsQuery({clinicId:formData.clinicId,q:patientSearch},{skip:!isOpen||!formData.clinicId||!patientSearch||Boolean(formData.newPatient)});
    const doctorOptions = useMemo(
        () => formData.clinicId ? getUniqueFullNames(doctorsPage?.content ?? []) : [],
        [doctorsPage?.content, formData.clinicId]
    );
    const patientOptions = useMemo(
        () => formData.clinicId ? getUniqueFullNames(patientsPage?.content ?? []) : [],
        [patientsPage?.content, formData.clinicId]
    );

    const handleClinicChange = (clinicId: string) => {
        setFormData((prev) => ({
            ...prev,
            clinicId,
            patientFullName: '',
            patientCardId: undefined,
            newPatient: false,
            doctorFullName: '',
        }));
    };

    if (!isOpen) return null;

    const total = formData.tasks.reduce((sum, task) => {
        return sum + calculateTaskTotal(task);
    }, 0);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (currentStep === 0) {
            if (isCustomerStepComplete(formData)) setCurrentStep(1);
            return;
        }

        if (currentStep === 1) {
            const isTasksStepComplete = formData.tasks.length > 0
                && formData.tasks.every(isCreateOrderTaskComplete);

            if (isTasksStepComplete) setCurrentStep(2);
            return;
        }

        if (isSubmitting) return;

        const invalidTask = formData.tasks.find((task) => validateMaterialIds(task.materialIds));
        if (invalidTask) return;

        try {
            await onSubmit({
                ...formData,
                tasks: formData.tasks.map((task) => ({
                    ...task,
                    quantity: Number(task.quantity),
                    pricePerUnit: Number(task.pricePerUnit),
                    discount: Number(task.discount),
                    orderId: task.orderId || '',
                    toothNumbers: task.toothNumbers,
                    materialIds: normalizeMaterialIds(task.materialIds),
                })),
            });
            setFormData(createInitialOrder());
            setCurrentStep(0);
            setActiveTaskIndex(0);
            onClose();
        } catch (error) {
            console.error('Order creation failed:', error);
        }
    };

    const handleAddNewTask = () => {
        setFormData((prev) => ({
            ...prev,
            tasks: [...prev.tasks, createEmptyTask()],
        }));
        setActiveTaskIndex(formData.tasks.length);
    };

    const handleRemoveTask = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            tasks: prev.tasks.filter((_, taskIndex) => taskIndex !== index),
        }));
        setActiveTaskIndex((current) => Math.max(0, Math.min(current > index ? current - 1 : current, formData.tasks.length - 2)));
    };

    const handleTaskChange = <Field extends keyof CreateOrderTaskDto>(
        index: number,
        field: Field,
        value: CreateOrderTaskDto[Field]
    ) => {
        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];

            updatedTasks[index] = {
                ...updatedTasks[index],
                [field]: value,
            };

            if (field === 'workTypeId') {
                updatedTasks[index].statusAssignees = [];
            }

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });
    };

    const handleTaskAssignmentChange = (
        index: number,
        changes: Pick<CreateOrderTaskDto, 'assignmentMode' | 'statusAssignees'>
    ) => {
        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];

            updatedTasks[index] = {
                ...updatedTasks[index],
                ...changes,
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });
    };

    const handleToothToggle = (taskIndex: number, toothNumber: number) => {
        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];
            const task = updatedTasks[taskIndex];
            const hasTooth = task.toothNumbers.includes(toothNumber);
            const toothNumbers = hasTooth
                ? task.toothNumbers.filter((number) => number !== toothNumber)
                : [...task.toothNumbers, toothNumber].sort((a, b) => a - b);

            updatedTasks[taskIndex] = {
                ...task,
                toothNumbers,
                quantity: toothNumbers.length || task.quantity,
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });
    };

    const handleTaskImagesChange = (taskIndex: number, event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);

        if (!files.length) return;

        const images = prepareImages(files);

        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];
            const task = updatedTasks[taskIndex];

            updatedTasks[taskIndex] = {
                ...task,
                images: [...(task.images ?? []), ...images],
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });

        event.target.value = '';
    };

    const handleTaskAttachmentsChange = (taskIndex: number, event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);

        if (!files.length) return;

        const attachments = prepareAttachments(files);

        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];
            const task = updatedTasks[taskIndex];

            updatedTasks[taskIndex] = {
                ...task,
                attachments: [...(task.attachments ?? []), ...attachments],
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });

        event.target.value = '';
    };

    const handleRemoveTaskImage = (taskIndex: number, imageId: string) => {
        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];
            const task = updatedTasks[taskIndex];

            updatedTasks[taskIndex] = {
                ...task,
                images: (task.images ?? []).filter((image) => image.id !== imageId),
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });
    };

    const handleRemoveTaskAttachment = (taskIndex: number, attachmentId: string) => {
        setFormData((prev) => {
            const updatedTasks = [...prev.tasks];
            const task = updatedTasks[taskIndex];

            updatedTasks[taskIndex] = {
                ...task,
                attachments: (task.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
            };

            return {
                ...prev,
                tasks: updatedTasks,
            };
        });
    };

    const isLoadingDictionaries =
        isClinicsLoading ||
        isDoctorsLoading ||
        isPatientsLoading ||
        isUsersLoading ||
        isWorkDirectionsLoading ||
        isWorkTypesLoading ||
        isMaterialsLoading ||
        isColorsLoading;
    const failedDictionaries = [
        isClinicsError ? t('dictionaries.clinics') : '',
        isDoctorsError ? t('dictionaries.doctors') : '',
        isPatientsError ? t('dictionaries.patients') : '',
        isUsersError ? t('dictionaries.employees') : '',
        isWorkDirectionsError ? t('dictionaries.workDirections') : '',
        isWorkTypesError ? t('dictionaries.workTypes') : '',
        isMaterialsError ? t('dictionaries.materials') : '',
        isColorsError ? t('dictionaries.colors') : '',
    ].filter(Boolean);
    const isRetryingDictionaries = isClinicsFetching
        || isDoctorsFetching
        || isPatientsFetching
        || isUsersFetching
        || isWorkDirectionsFetching
        || isWorkTypesFetching
        || isMaterialsFetching
        || isColorsFetching;
    const customerStepComplete = isCustomerStepComplete(formData);
    const tasksStepComplete = formData.tasks.length > 0 && formData.tasks.every(isCreateOrderTaskComplete);
    const completedTasksCount = formData.tasks.filter(isCreateOrderTaskComplete).length;
    const canContinue = currentStep === 0 ? customerStepComplete : tasksStepComplete;

    const handleRetryDictionaries = () => {
        if (isClinicsError) void refetchClinics();
        if (isDoctorsError) void refetchDoctors();
        if (isPatientsError) void refetchPatients();
        if (isUsersError) void refetchUsers();
        if (isWorkDirectionsError) void refetchWorkDirections();
        if (isWorkTypesError) void refetchWorkTypes();
        if (isMaterialsError) void refetchMaterials();
        if (isColorsError) void refetchColors();
    };

    return (
        <Modal contentClassName="h-[94dvh] max-w-6xl overflow-hidden p-0 sm:h-[calc(100dvh-2rem)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-5 py-5 dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-900 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">{t('badge')}</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{t('title')}</h2>
                    <p className="text-xs text-slate-500">{t('subtitle')}</p>
                </div>
                <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-slate-400 shadow-sm hover:bg-slate-100 dark:bg-slate-800">&times;</button>
            </div>

            <nav aria-label={t('stepsAria')} className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <ol className="grid grid-cols-3 gap-2">
                    {orderSteps.map((step, index) => {
                        const isActive = currentStep === index;
                        const isDone = currentStep > index;
                        return (
                            <li key={step.title}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (index < currentStep || (index === 1 && customerStepComplete) || (index === 2 && customerStepComplete && tasksStepComplete)) {
                                            setCurrentStep(index);
                                        }
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition sm:px-3 ${
                                        isActive ? 'bg-violet-50' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                        isActive ? 'bg-violet-600 text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {isDone ? '✓' : index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className={`block truncate text-xs font-black ${isActive ? 'text-violet-800' : 'text-slate-600'}`}>{step.title}</span>
                                        <span className="hidden truncate text-[10px] text-slate-400 sm:block">{step.hint}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:space-y-7 sm:p-6">
                {isLoadingDictionaries && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                        {t('loadingDictionaries')}
                    </div>
                )}

                {failedDictionaries.length > 0 && (
                    <QueryErrorNotice
                        message={t('dictionariesError', {items: failedDictionaries.join(', ')})}
                        onRetry={handleRetryDictionaries}
                        isRetrying={isRetryingDictionaries}
                    />
                )}

                {currentStep === 0 && <section data-tour="order-customer">
                    <h3 className="text-xs font-black text-violet-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-violet-600 rounded-full" /> {t('customerSection')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('clinic')}</label>
                            <select
                                required
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none transition bg-white"
                                value={formData.clinicId}
                                onChange={(e) => handleClinicChange(e.target.value)}
                            >
                                <option value="">{t('clinicPlaceholder')}</option>
                                {clinics.map((clinic) => (
                                    <option key={clinic.id} value={clinic.id}>
                                        {clinic.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <PersonAutocompleteInput
                                label={t('doctor')}
                                placeholder={t('doctorPlaceholder')}
                                value={formData.doctorFullName}
                                options={doctorOptions}
                                isLoading={isDoctorsLoading}
                                disabledMessage={!formData.clinicId ? t('selectClinicDoctors') : undefined}
                                emptyMessage={t('doctorsEmpty')}
                                noMatchMessage={t('personNoMatch')}
                                loadingMessage={t('doctorsLoading')}
                                onChange={(doctorFullName) => setFormData((prev) => ({ ...prev, doctorFullName }))}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('deadline')}</label>
                            <input
                                required
                                type="date"
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none transition dark:[&::-webkit-calendar-picker-indicator]:opacity-70"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <PersonAutocompleteInput
                                label={t('patient')}
                                placeholder={t('patientPlaceholder')}
                                value={formData.patientFullName}
                                options={patientOptions}
                                isLoading={isPatientsLoading}
                                disabledMessage={!formData.clinicId ? t('selectClinicPatients') : undefined}
                                emptyMessage={t('patientsEmpty')}
                                noMatchMessage={t('personNoMatch')}
                                loadingMessage={t('patientsLoading')}
                                onChange={(patientFullName) => setFormData((prev) => ({ ...prev, patientFullName, patientCardId: undefined, newPatient: false }))}
                            />
                            <p className="mt-2 text-xs text-slate-500">Повторный заказ сохраняется в прежней карточке этой клиники. Если это другой человек с таким же именем, отметьте «Новый пациент».</p>
                            {formData.patientFullName.trim() && <div className="mt-3 space-y-3">
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.newPatient ?? false} onChange={e=>setFormData(prev=>({...prev,newPatient:e.target.checked,patientCardId:undefined}))}/>Новый пациент — отдельная карточка</label>
                                {!formData.newPatient && <label className="block text-xs font-semibold text-slate-600">Карточка пациента<select aria-label="Карточка пациента" disabled={matchingPatientsLoading} value={formData.patientCardId ?? ''} onChange={e=>setFormData(prev=>({...prev,patientCardId:e.target.value || undefined}))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Определить по имени, если совпадение одно</option>{(matchingPatients?.content ?? []).map(p=><option key={p.id} value={p.id}>{p.label} · {p.description || "Заказов пока нет"} · {p.id.slice(-8)}</option>)}</select>{formData.patientCardId&&<a href={`/patients/${formData.patientCardId}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-violet-600">Посмотреть историю выбранного пациента ↗</a>}{matchingPatientsError&&<span role="alert" className="text-red-600">Не удалось найти карточки. Повторите поиск перед созданием заказа.</span>}</label>}
                            </div>}
                        </div>

                    </div>
                </section>}

                {currentStep === 1 && <section data-tour="order-task" className="flex flex-col">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-600">
                            <span className="h-2 w-2 rounded-full bg-violet-600" /> {t('technicalTask')}
                        </h3>
                        <p className="text-xs text-slate-400">
                            {t('technicalTaskHint')}
                        </p>
                    </div>

                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                        {formData.tasks.map((task, index) => {
                            const selectedWorkType = workTypes.find((workType) => workType.id === task.workTypeId);
                            const selectedWorkDirection = workDirections.find((direction) => direction.id === task.workDirectionId);
                            const complete = isCreateOrderTaskComplete(task);
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => setActiveTaskIndex(index)}
                                    className={`min-w-[190px] rounded-xl border px-3 py-2.5 text-left transition ${
                                        activeTaskIndex === index
                                            ? 'border-violet-400 bg-violet-50 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-violet-200'
                                    }`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400">{t('workNumber', {number: index + 1})}</span>
                                        <span className={`h-2 w-2 rounded-full ${complete ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                    </span>
                                    <span className="mt-1 block truncate text-xs font-black text-slate-800">
                                        {selectedWorkDirection?.name && selectedWorkType?.name
                                            ? `${selectedWorkDirection.name} · ${selectedWorkType.name}`
                                            : selectedWorkType?.name || selectedWorkDirection?.name || t('incomplete')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-5">
                        {formData.tasks.map((task, index) => {
                            if (index !== activeTaskIndex) return null;
                            const taskTotal = calculateTaskTotal(task);
                            const selectedWorkType = workTypes.find((workType) => workType.id === task.workTypeId);

                            return (
                                <article key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                                    <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-xs font-black text-white shadow-sm shadow-violet-200">
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">
                                                    {t('task')}
                                                </p>
                                                <h4 className="truncate text-base font-black text-slate-900">
                                                    {selectedWorkType?.name || t('newWork')}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                                {t('taskSummary', {quantity: task.quantity || 0})}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                                {t('materialSummary', {count: task.materialIds.length})}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                                {t('teethSummary', {count: task.toothNumbers.length})}
                                            </span>

                                            {formData.tasks.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTask(index)}
                                                    aria-label={t('deleteTaskAria', {number: index + 1})}
                                                    className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-500 transition hover:bg-red-50 hover:text-red-700"
                                                >
                                                    {commonT('actions.delete')}
                                                </button>
                                            )}
                                        </div>
                                    </header>

                                    <div className="space-y-5 p-4 sm:p-5">
                                        <section aria-labelledby={`task-${index}-parameters`}>
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">1</span>
                                                <h5 id={`task-${index}-parameters`} className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                    {t('mainParameters')}
                                                </h5>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                                <label className="block md:col-span-2">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('workDirection')}
                                                    </span>
                                                    <select
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={task.workDirectionId}
                                                        onChange={(e) => handleTaskChange(index, 'workDirectionId', e.target.value)}
                                                    >
                                                        <option value="">{t('workDirectionPlaceholder')}</option>
                                                        {workDirections.map((direction) => (
                                                            <option key={direction.id} value={direction.id}>
                                                                {direction.name} — {direction.code}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="block md:col-span-2">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('workType')}
                                                    </span>
                                                    <select
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={task.workTypeId}
                                                        onChange={(e) => handleTaskChange(index, 'workTypeId', e.target.value)}
                                                    >
                                                        <option value="">{t('workTypePlaceholder')}</option>
                                                        {workTypes.map((workType) => (
                                                            <option key={workType.id} value={workType.id}>
                                                                {workType.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="block">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('quantity')}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={task.quantity}
                                                        onChange={(e) => handleTaskChange(index, 'quantity', Number(e.target.value))}
                                                    />
                                                </label>

                                                <label className="block">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('color')}
                                                    </span>
                                                    <select
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={task.colorId}
                                                        onChange={(e) => handleTaskChange(index, 'colorId', e.target.value)}
                                                    >
                                                        <option value="">Цвет не требуется</option>
                                                        {colors.map((color) => (
                                                            <option key={color.id} value={color.id}>
                                                                {color.code} — {color.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>
                                        </section>

                                        <section aria-labelledby={`task-${index}-production`}>
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">2</span>
                                                <h5 id={`task-${index}-production`} className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                    {t('materialsAndTeeth')}
                                                </h5>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
                                                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <h6 className="text-xs font-black text-slate-700">
                                                            {t('materials')}
                                                        </h6>
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                                            task.materialIds.length
                                                                ? 'bg-violet-100 text-violet-700'
                                                                : 'bg-red-50 text-red-600'
                                                        }`}>
                                                            {task.materialIds.length
                                                                ? t('selected', {count: task.materialIds.length})
                                                                : t('required')}
                                                        </span>
                                                    </div>

                                                    <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                                        {materials.map((material) => {
                                                            const selected = task.materialIds.includes(material.id);

                                                            return (
                                                                <label
                                                                    key={material.id}
                                                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                                                                        selected
                                                                            ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm'
                                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/40'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selected}
                                                                        onChange={() => handleTaskChange(
                                                                            index,
                                                                            'materialIds',
                                                                            selected
                                                                                ? task.materialIds.filter((id) => id !== material.id)
                                                                                : normalizeMaterialIds([...task.materialIds, material.id])
                                                                        )}
                                                                        className="sr-only"
                                                                    />
                                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-black ${
                                                                        selected
                                                                            ? 'border-violet-600 bg-violet-600 text-white'
                                                                            : 'border-slate-300 bg-white text-transparent'
                                                                    }`}>
                                                                        ✓
                                                                    </span>
                                                                    <span className="min-w-0 truncate">{material.name}</span>
                                                                </label>
                                                            );
                                                        })}
                                                        {materials.length === 0 ? (
                                                            <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-400">
                                                                {t('noMaterials')}
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    {task.materialIds.length === 0 ? (
                                                        <p className="mt-2 text-[10px] font-semibold text-red-500">
                                                            {t('selectMaterial')}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <h6 className="text-xs font-black text-blue-800">
                                                            {t('dentalFormula')}
                                                        </h6>
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-blue-700 shadow-sm">
                                                            {task.toothNumbers.length
                                                                ? t('selected', {count: task.toothNumbers.length})
                                                                : t('notSelected')}
                                                        </span>
                                                    </div>

                                                    <div className="rounded-xl border border-blue-100 bg-white p-3">
                                                        {[upperTeeth, lowerTeeth].map((row, rowIndex) => (
                                                            <div
                                                                key={rowIndex}
                                                                className={rowIndex === 0 ? 'border-b border-dashed border-blue-100 pb-3' : 'pt-3'}
                                                            >
                                                                <p className="mb-2 text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                                    {rowIndex === 0 ? t('upperJaw') : t('lowerJaw')}
                                                                </p>
                                                                <div className="grid grid-cols-8 gap-1.5">
                                                                    {row.map((toothNumber) => {
                                                                        const isSelected = task.toothNumbers.includes(toothNumber);

                                                                        return (
                                                                            <button
                                                                                key={toothNumber}
                                                                                type="button"
                                                                                onClick={() => handleToothToggle(index, toothNumber)}
                                                                                aria-pressed={isSelected}
                                                                                aria-label={t('toothAria', {number: toothNumber})}
                                                                                className={`aspect-square rounded-lg border text-[11px] font-black transition ${
                                                                                    isSelected
                                                                                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                                                        : 'border-blue-100 bg-blue-50/50 text-blue-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-300 dark:hover:border-blue-400 dark:hover:bg-slate-700'
                                                                                }`}
                                                                            >
                                                                                {toothNumber}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {task.toothNumbers.length > 0 ? (
                                                        <p className="mt-2 truncate text-[10px] font-semibold text-blue-700">
                                                            {t('numbers', {numbers: task.toothNumbers.join(', ')})}
                                                        </p>
                                                    ) : (
                                                        <p className="mt-2 text-[10px] font-semibold text-slate-400">
                                                            {t('multipleTeeth')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <section aria-labelledby={`task-${index}-price`}>
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">3</span>
                                                <h5 id={`task-${index}-price`} className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                    {t('cost')}
                                                </h5>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(190px,.75fr)]">
                                                <label className="block">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('unitPrice')}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={getMoneyInputValue(task.pricePerUnit)}
                                                        onChange={(e) => handleTaskChange(index, 'pricePerUnit', parseMoneyInput(e.target.value))}
                                                    />
                                                </label>

                                                <label className="block">
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">
                                                        {t('discount')}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                                                        value={getMoneyInputValue(task.discount)}
                                                        onChange={(e) => handleTaskChange(index, 'discount', parseMoneyInput(e.target.value))}
                                                    />
                                                </label>

                                                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white sm:flex-col sm:items-start sm:justify-center sm:gap-0">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                        {t('taskTotal')}
                                                    </span>
                                                    <span className="text-xl font-black">
                                                        {formats.currency(taskTotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>

                                        <section data-tour="order-files" aria-labelledby={`task-${index}-files`}>
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">4</span>
                                                <h5 id={`task-${index}-files`} className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                    {t('attachments')}
                                                </h5>
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                    {t('optional')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <h6 className="text-xs font-black text-blue-800">{t('images')}</h6>
                                                            <p className="mt-0.5 text-[10px] text-slate-500">
                                                                {t('imagesHint')}
                                                            </p>
                                                        </div>
                                                        <label className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-blue-700">
                                                            {t('add')}
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                onChange={(e) => handleTaskImagesChange(index, e)}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>

                                                    {task.images?.length ? (
                                                        <div className="mt-3 space-y-2">
                                                            {task.images.map((image) => (
                                                                <div
                                                                    key={image.id}
                                                                    className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-bold text-slate-800">{image.name}</p>
                                                                        <p className="text-[10px] text-slate-400">{image.size}</p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveTaskImage(index, image.id)}
                                                                        className="text-sm font-black text-slate-300 hover:text-red-500"
                                                                        aria-label={t('deleteFileAria', {name: image.name})}
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white/70 px-3 py-3 text-center text-xs font-semibold text-slate-400">
                                                            {t('imagesEmpty')}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <h6 className="text-xs font-black text-slate-700">{t('files')}</h6>
                                                            <p className="mt-0.5 text-[10px] text-slate-500">
                                                                {t('filesHint')}
                                                            </p>
                                                        </div>
                                                        <label className="shrink-0 cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-slate-800">
                                                            {t('attach')}
                                                            <input
                                                                type="file"
                                                                multiple
                                                                onChange={(e) => handleTaskAttachmentsChange(index, e)}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>

                                                    {task.attachments?.length ? (
                                                        <div className="mt-3 space-y-2">
                                                            {task.attachments.map((file) => (
                                                                <div
                                                                    key={file.id}
                                                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-bold text-slate-800">{file.name}</p>
                                                                        <p className="text-[10px] text-slate-400">{file.size}</p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveTaskAttachment(index, file.id)}
                                                                        className="text-sm font-black text-slate-300 hover:text-red-500"
                                                                        aria-label={t('deleteFileAria', {name: file.name})}
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-xs font-semibold text-slate-400">
                                                            {t('filesEmpty')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <TaskAssignmentFields
                                            task={task}
                                            users={users}
                                            onChange={(changes) => handleTaskAssignmentChange(index, changes)}
                                        />
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddNewTask}
                        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-3 text-xs font-black text-violet-700 transition hover:border-violet-500 hover:bg-violet-50 active:scale-[.995]"
                    >
                        <span className="text-base leading-none">+</span>
                        {t('addTask')}
                    </button>
                </section>}

                {currentStep === 2 && <>
                <section data-tour="order-review" className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                        <h3 className="text-sm font-black text-slate-900">{t('reviewTitle')}</h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[10px] font-bold uppercase text-slate-400">{t('clinicDoctor')}</p>
                                <p className="mt-1 text-sm font-black text-slate-800">{clinics.find((clinic) => clinic.id === formData.clinicId)?.name}</p>
                                <p className="text-xs text-slate-500">{formData.doctorFullName}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[10px] font-bold uppercase text-slate-400">{t('patientDeadline')}</p>
                                <p className="mt-1 text-sm font-black text-slate-800">{formData.patientFullName}</p>
                                <p className="text-xs text-slate-500">{t('deadlineValue', {date: formData.deadline})}</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {formData.tasks.map((task, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => { setActiveTaskIndex(index); setCurrentStep(1); }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs font-black text-slate-800">
                                            {index + 1}. {workDirections.find((item) => item.id === task.workDirectionId)?.name} · {workTypes.find((item) => item.id === task.workTypeId)?.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {t('compactTaskSummary', {quantity: task.quantity, materials: task.materialIds.length, teeth: task.toothNumbers.length})}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-sm font-black text-slate-800">{formats.currency(calculateTaskTotal(task))}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl bg-slate-900 p-5 text-white">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('composition')}</p>
                        <p className="mt-2 text-3xl font-black">{formData.tasks.length}</p>
                        <p className="text-xs text-slate-400">{t('workCount')}</p>
                        <div className="my-5 border-t border-slate-700" />
                        <p className="text-[10px] font-bold uppercase text-slate-400">{t('total')}</p>
                        <p className="mt-1 text-2xl font-black">{formats.currency(total)}</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full" /> {t('comment')}
                    </h3>

                    <textarea
                        rows={4}
                        placeholder={t('commentPlaceholder')}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none transition resize-none"
                        value={formData.comment}
                        onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    />
                </section>
                </>}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <button
                        type="button"
                        onClick={() => currentStep === 0 ? onClose() : setCurrentStep((step) => step - 1)}
                        className="w-full px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800 sm:w-auto"
                    >
                        {currentStep === 0 ? commonT('actions.cancel') : commonT('actions.back')}
                    </button>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {currentStep === 1 && (
                            <span className="text-center text-[11px] font-semibold text-slate-400 sm:text-right">
                                {t('filled', {completed: completedTasksCount, total: formData.tasks.length})}
                            </span>
                        )}
                        {currentStep < 2 ? (
                            <button
                                key="continue-order"
                                type="button"
                                disabled={!canContinue}
                                onClick={(event) => {
                                    event.preventDefault();
                                    setCurrentStep((step) => step + 1);
                                }}
                                className="w-full rounded-xl bg-violet-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
                            >
                                {t('continue')}
                            </button>
                        ) : (
                            <button
                                key="create-order"
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full rounded-xl bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
                            >
                                {isSubmitting ? t('creating') : t('createOrder', {total: formats.currency(total)})}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
}
