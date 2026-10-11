'use client';
import {mvpModules} from '@/src/lib/mvp';

import {useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useSelector} from 'react-redux';

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';

import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {CSS} from '@dnd-kit/utilities';

import Modal from '@/src/components/ui/Modal';
import RoleCreateModal from '@/src/components/roles/RoleCreateModal';
import RolePicker from '@/src/components/roles/RoleSelect';
import type {RootState} from '@/src/lib/store';
import type {Role} from '@/src/types/role.types';

import {
    useCreateWorkflowWorkTypesMutation,
    useGetOrderStatusesQuery,
} from '@/src/services/api/workflowApi';

import {
    useGetRolesQuery,
} from '@/src/services/api/rolesApi';

import type {
    CreateWorkflowWorkTypesDTO,
    WorkflowStatus,
} from '@/src/types/workflow.types';
import {
    findSimilarWorkflowStatus,
    isProtectedWorkflowStatus,
    normalizeWorkflowStageValue,
    searchWorkflowStatuses,
} from '@/src/utils/workflowStageMatching';
import {createClientId} from '@/src/utils/clientId';
import {getApiErrorMessage} from '@/src/services/apiNotifications';

type CreateWorkTypeStagesProps = {
    isOpen: boolean;
    onClose: () => void;
};

type WorkflowStage =
    CreateWorkflowWorkTypesDTO['stages'][number];

type EditableStage = WorkflowStage & {
    clientId: string;
    existingStatusId?: string;
    identityReviewed?: boolean;
};

type WorkTypeForm = Omit<
    CreateWorkflowWorkTypesDTO,
    'stages'
>;

const workflowPresets = {
    "digital": {
        "code": "DIGITAL_CROWN",
        "label": "presetDigital",
        "stages": [
            "scanning",
            "modeling",
            "milling"
        ]
    },
    "ceramic": {
        "code": "CERAMIC_CROWN",
        "label": "presetCeramic",
        "stages": [
            "plastering",
            "ceramics"
        ]
    },
    "zirconia": {
        "code": "ZIRCONIA_CROWN",
        "label": "presetZirconia",
        "stages": [
            "scanning",
            "modeling",
            "milling",
            "sintering",
            "ceramics"
        ]
    },
    "press": {
        "code": "PRESS_RESTORATION",
        "label": "presetPress",
        "stages": [
            "plastering",
            "waxing",
            "pressing",
            "ceramics"
        ]
    },
    "removable": {
        "code": "REMOVABLE_DENTURE",
        "label": "presetRemovable",
        "stages": [
            "plastering",
            "setup",
            "polymerization",
            "polishing"
        ]
    },
    "implant": {
        "code": "IMPLANT_RESTORATION",
        "label": "presetImplant",
        "stages": [
            "scanning",
            "implantDesign",
            "milling",
            "ceramics"
        ]
    },
    "temporary": {
        "code": "TEMPORARY_RESTORATION",
        "label": "presetTemporary",
        "stages": [
            "scanning",
            "modeling",
            "milling",
            "polishing"
        ]
    },
    "splint": {
        "code": "OCCLUSAL_SPLINT",
        "label": "presetSplint",
        "stages": [
            "scanning",
            "modeling",
            "printing",
            "postprocessing",
            "polishing"
        ]
    },
    "repair": {
        "code": "DENTURE_REPAIR",
        "label": "presetRepair",
        "stages": [
            "assessment",
            "repair",
            "polishing"
        ]
    }
} as const;
type PresetKind = keyof typeof workflowPresets;
const presetStages = {
    "scanning": [
        "SCANNING",
        "presetScanning",
        "ROLE_SCANNER"
    ],
    "modeling": [
        "MODELING",
        "presetModeling",
        "ROLE_OPERATOR"
    ],
    "milling": [
        "MILLING",
        "presetMilling",
        "ROLE_OPERATOR"
    ],
    "plastering": [
        "PLASTERING",
        "presetPlastering",
        "ROLE_PLASTERER"
    ],
    "ceramics": [
        "CERAMICS",
        "presetCeramics",
        "ROLE_CERAMIST"
    ],
    "sintering": [
        "SINTERING",
        "presetSintering",
        "ROLE_OPERATOR"
    ],
    "waxing": [
        "WAXING",
        "presetWaxing",
        "ROLE_PROSTHETIST"
    ],
    "pressing": [
        "PRESSING",
        "presetPressing",
        "ROLE_CERAMIST"
    ],
    "setup": [
        "TEETH_SETUP",
        "presetSetup",
        "ROLE_PROSTHETIST"
    ],
    "polymerization": [
        "POLYMERIZATION",
        "presetPolymerization",
        "ROLE_PROSTHETIST"
    ],
    "polishing": [
        "POLISHING",
        "presetPolishing",
        "ROLE_PROSTHETIST"
    ],
    "implantDesign": [
        "IMPLANT_DESIGN",
        "presetImplantDesign",
        "ROLE_OPERATOR"
    ],
    "printing": [
        "PRINTING",
        "presetPrinting",
        "ROLE_OPERATOR"
    ],
    "postprocessing": [
        "POSTPROCESSING",
        "presetPostprocessing",
        "ROLE_OPERATOR"
    ],
    "assessment": [
        "REPAIR_ASSESSMENT",
        "presetAssessment",
        "ROLE_PROSTHETIST"
    ],
    "repair": [
        "REPAIR",
        "presetRepairStage",
        "ROLE_PROSTHETIST"
    ]
} as const;

const SYSTEM_STAGE_CODES = new Set([
    'TODO',
    'WAITING_FOR_APPROVAL',
    'ORDER_CLOSED',
]);

const initialFormData: WorkTypeForm = {
    workTypeCode: '',
    workTypeName: '',
    description: '',
};

function createEditableStage(): EditableStage {
    return {
        clientId: createClientId('workflow-stage'),
        code: '',
        name: '',
        description: '',
        colorHex: '#3B82F6',
        requiredRole: '',
        materialReportRequired: false,
        allowUnplannedMaterials: false,
    };
}

function hasDuplicateStageCodes(stages: EditableStage[]) {
    return stages.some((stage, index) =>
        stages.slice(index + 1).some((candidate) => {
            const code = normalizeWorkflowStageValue(stage.code);
            return Boolean(code) &&
                code === normalizeWorkflowStageValue(candidate.code);
        }),
    );
}

type RoleSelectProps = {
    value: string;
    disabled?: boolean;
    roles: Role[];
    isLoading: boolean;
    onChange: (value: string) => void;
    canCreate: boolean;
    onCreateRequest: () => void;
};

function RoleSelect({
                        value,
                        disabled,
                        roles,
                        isLoading,
                        onChange,
                        canCreate,
                        onCreateRequest,
                    }: RoleSelectProps) {
    return (
        <RolePicker
            value={value}
            disabled={disabled || isLoading}
            roles={roles}
            isLoading={isLoading}
            onChange={onChange}
            canCreate={canCreate}
            onCreateRequest={onCreateRequest}
        />
    );
}

function SystemStageRow({
                            code,
                            label,
                        }: {
    code: string;
    label: string;
}) {
    const t = useTranslations('laboratory.workflow');

    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500">
            <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{label}</span>
                <span className="block truncate font-mono text-[10px] font-bold">
                    {code}
                </span>
            </span>
            <span className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                {t('systemStage')}
            </span>
        </div>
    );
}

type SortableStageRowProps = {
    stage: EditableStage;
    index: number;
    existingStatuses: WorkflowStatus[];
    statusesLoading: boolean;
    statusesError: boolean;
    roles: Role[];
    rolesLoading: boolean;
    onChange: (
        id: string,
        patch: Partial<EditableStage>,
    ) => void;
    onDelete: (id: string) => void;
    onUseExisting: (id: string, status: WorkflowStatus) => void;
    canCreate: boolean;
    onCreateRequest: () => void;
};

type StageIdentityFieldsProps = {
    stage: EditableStage;
    index: number;
    existingStatuses: WorkflowStatus[];
    statusesLoading: boolean;
    statusesError: boolean;
    onChange: (
        id: string,
        patch: Partial<EditableStage>,
    ) => void;
    onUseExisting: (id: string, status: WorkflowStatus) => void;
};

function StageIdentityFields({
                                 stage,
                                 index,
                                 existingStatuses,
                                 statusesLoading,
                                 statusesError,
                                 onChange,
                                 onUseExisting,
                             }: StageIdentityFieldsProps) {
    const t = useTranslations('laboratory.workflow');
    const [activeField, setActiveField] =
        useState<'code' | 'name' | null>(null);
    const codeInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const query = activeField === 'code' ? stage.code : stage.name;
    const matches = useMemo(
        () => searchWorkflowStatuses(query, existingStatuses),
        [existingStatuses, query],
    );
    const selectedStatus = existingStatuses.find(
        (status) => status.id === stage.existingStatusId,
    );
    const similarMatch = stage.existingStatusId || stage.identityReviewed
        ? undefined
        : findSimilarWorkflowStatus(stage, existingStatuses);
    const similarStatus = existingStatuses.find(
        (status) => status.id === similarMatch?.status.id,
    );
    const similarStatusIsProtected =
        similarStatus ? isProtectedWorkflowStatus(similarStatus) : false;

    const changeIdentity = (
        patch: Pick<Partial<EditableStage>, 'code' | 'name'>,
    ) => {
        onChange(stage.clientId, {
            ...patch,
            existingStatusId: undefined,
            identityReviewed: false,
        });
    };

    const focusSimilarField = () => {
        const target = similarMatch?.matchedBy === 'code'
            ? codeInputRef.current
            : nameInputRef.current;

        target?.focus();
    };

    return (
        <div className="relative min-w-0">
            <div className="grid min-w-0 gap-2 sm:grid-cols-[110px_minmax(140px,1fr)]">
                <input
                    ref={codeInputRef}
                    required
                    type="text"
                    autoComplete="off"
                    value={stage.code}
                    onFocus={() => setActiveField('code')}
                    onBlur={() => setActiveField(null)}
                    onChange={(event) =>
                        changeIdentity({code: event.target.value})
                    }
                    placeholder="CODE"
                    aria-label={t('codeAria', {number: index + 1})}
                    className="h-10 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-violet-500 focus:bg-white"
                />

                <input
                    ref={nameInputRef}
                    required
                    type="text"
                    autoComplete="off"
                    value={stage.name}
                    onFocus={() => setActiveField('name')}
                    onBlur={() => setActiveField(null)}
                    onChange={(event) =>
                        changeIdentity({name: event.target.value})
                    }
                    placeholder={t('stagePlaceholder', {number: index + 1})}
                    aria-label={t('nameAria', {number: index + 1})}
                    className="h-10 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none transition focus:border-violet-500 focus:bg-white"
                />
            </div>

            {activeField && (
                <div
                    className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {statusesLoading ? (
                        <p className="px-3 py-2.5 text-xs font-semibold text-slate-400">
                            {t('loadingExisting')}
                        </p>
                    ) : statusesError ? (
                        <p className="px-3 py-2.5 text-xs font-semibold text-red-600">
                            {t('existingError')}
                        </p>
                    ) : matches.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto py-1">
                            {matches.map(({status}) => {
                                const fullStatus = existingStatuses.find(
                                    (item) => item.id === status.id,
                                );
                                const protectedStatus =
                                    isProtectedWorkflowStatus(status);

                                if (!fullStatus) return null;

                                return protectedStatus ? (
                                    <div
                                        key={status.id}
                                        className="flex items-center justify-between gap-3 px-3 py-2 text-left"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-slate-500">
                                                {status.name}
                                            </span>
                                            <span
                                                className="block truncate font-mono text-[10px] font-bold text-slate-400">
                                                {status.code}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                                            {t('alreadyAdded')}
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        key={status.id}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-violet-50"
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            onUseExisting(stage.clientId, fullStatus);
                                            setActiveField(null);
                                        }}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-slate-700">
                                                {status.name}
                                            </span>
                                            <span
                                                className="block truncate font-mono text-[10px] font-bold text-slate-400">
                                                {status.code}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-[10px] font-bold text-violet-600">
                                            {t('select')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="px-3 py-2.5 text-xs font-semibold text-slate-400">
                            {t('noMatches')}
                        </p>
                    )}
                </div>
            )}

            {selectedStatus && (
                <div
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                    <span>{t('usingExisting')}</span>
                    <span className="font-mono">{selectedStatus.code}</span>
                </div>
            )}

            {similarStatus && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-900">
                        {t('similar', {name: similarStatus.name, code: similarStatus.code})}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-amber-700">
                        {similarStatusIsProtected
                            ? t('protectedHint')
                            : t('similarHint')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {!similarStatusIsProtected && (
                            <button
                                type="button"
                                onClick={() =>
                                    onUseExisting(stage.clientId, similarStatus)
                                }
                                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-700"
                            >
                                {t('useExisting')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={focusSimilarField}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100"
                        >
                            {t('editEntered')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableStageRow({
                              stage,
                              index,
                              existingStatuses,
                              statusesLoading,
                              statusesError,
                              roles,
                              rolesLoading,
                              onChange,
                              onDelete,
                              onUseExisting,
                              canCreate,
                              onCreateRequest,
                          }: SortableStageRowProps) {
    const t = useTranslations('laboratory.workflow');
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: stage.clientId,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const normalizedColor =
        /^#[0-9A-Fa-f]{6}$/.test(stage.colorHex)
            ? stage.colorHex
            : '#3B82F6';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-xl border bg-white p-3 transition ${
                isDragging
                    ? 'z-50 border-violet-400 opacity-80 shadow-xl'
                    : 'border-slate-200'
            }`}
        >
            <div className="grid items-start gap-2 md:grid-cols-[32px_minmax(260px,1fr)_180px_48px_36px]">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={t('moveStage')}
                    className="flex h-9 w-8 touch-none cursor-grab items-center justify-center rounded-lg text-lg font-bold text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 active:cursor-grabbing"
                >
                    ⋮⋮
                </button>

                <StageIdentityFields
                    stage={stage}
                    index={index}
                    existingStatuses={existingStatuses}
                    statusesLoading={statusesLoading}
                    statusesError={statusesError}
                    onChange={onChange}
                    onUseExisting={onUseExisting}
                />

                <RoleSelect
                    value={stage.requiredRole}
                    roles={roles}
                    isLoading={rolesLoading}
                    onChange={(requiredRole) =>
                        onChange(stage.clientId, {
                            requiredRole,
                        })
                    }
                    canCreate={canCreate}
                    onCreateRequest={onCreateRequest}
                />
                <input
                    type="color"
                    value={normalizedColor}
                    onChange={(event) =>
                        onChange(stage.clientId, {
                            colorHex: event.target.value,
                        })
                    }
                    title={t('stageColor')}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
                <button
                    type="button"
                    onClick={() =>
                        onDelete(stage.clientId)
                    }
                    title={t('deleteStage')}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600"
                >
                    ×
                </button>
            </div>
            {mvpModules.warehouse && <fieldset className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <legend className="sr-only">{t('stageRules')}</legend>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
                    <input
                        type="checkbox"
                        checked={stage.materialReportRequired}
                        onChange={(event) => onChange(stage.clientId, {
                            materialReportRequired: event.target.checked,
                        })}
                        className="h-3.5 w-3.5 accent-violet-600"
                    />
                    {t('materialReportRequired')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
                    <input
                        type="checkbox"
                        checked={stage.allowUnplannedMaterials}
                        onChange={(event) => onChange(stage.clientId, {
                            allowUnplannedMaterials: event.target.checked,
                        })}
                        className="h-3.5 w-3.5 accent-violet-600"
                    />
                    {t('allowUnplannedMaterials')}
                </label>
            </fieldset>}
            <details className="mt-2">
                <summary
                    className="cursor-pointer select-none text-[11px] font-bold text-slate-400 transition hover:text-violet-600">
                    {t('stageDescription')}
                </summary>

                <textarea
                    value={stage.description}
                    onChange={(event) =>
                        onChange(stage.clientId, {
                            description: event.target.value,
                        })
                    }
                    placeholder={t('stageDescriptionPlaceholder')}
                    className="mt-2 min-h-16 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-violet-500 focus:bg-white"
                />
            </details>
        </div>
    );
}

export default function CreateWorkTypeStages({
                                                 isOpen,
                                                 onClose,
                                             }: CreateWorkTypeStagesProps) {
    const t = useTranslations('laboratory.workflow');
    const commonT = useTranslations('common');
    const [formData, setFormData] =
        useState<WorkTypeForm>(initialFormData);

    const [stages, setStages] =
        useState<EditableStage[]>([]);

    const [formError, setFormError] =
        useState('');
    const [roleCreationTarget, setRoleCreationTarget] =
        useState<string | null>(null);
    const jwtRoles = useSelector((state: RootState) => state.auth.roles);
    const isAdmin = jwtRoles.some(
        (role) => role.toUpperCase().replace(/^ROLE_/u, '') === 'ADMIN'
    );
    const canViewRoles = isAdmin || jwtRoles.some(
        (role) => role.toUpperCase().replace(/^ROLE_/u, '') === 'CHIEF_TECHNICIAN'
    );

    const {
        data: roles = [],
        isLoading: rolesLoading,
        isError: rolesError,
    } = useGetRolesQuery(undefined, {skip: !canViewRoles});

    const {
        data: allStatuses = [],
        isLoading: statusesLoading,
        isFetching: statusesFetching,
        isError: statusesError,
        refetch: refetchStatuses,
    } = useGetOrderStatusesQuery(undefined, {skip: !isOpen});
    const existingStatuses = useMemo(() => allStatuses.filter(status => status.active !== false), [allStatuses]);

    const [
        createWorkflowWorkTypes,
        {
            isLoading: creating,
            error: createError,
        },
    ] = useCreateWorkflowWorkTypesMutation();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter:
            sortableKeyboardCoordinates,
        }),
    );

    if (!isOpen) return null;

    const addStage = () => {
        setStages((current) => [
            ...current,
            createEditableStage(),
        ]);

        setFormError('');
    };

    const applyPreset = (kind: PresetKind) => {
        if (stages.length || formData.workTypeCode || formData.workTypeName) return;
        const preset = workflowPresets[kind];
        const definitions = preset.stages.map(stage => presetStages[stage]);
        setFormData({workTypeCode: preset.code, workTypeName: t(preset.label), description: ''});
        setStages(definitions.map(([code, nameKey, role]) => {
            const name = t(nameKey);
            const existing = existingStatuses.find(status => !isProtectedWorkflowStatus(status) &&
                (status.code.toUpperCase() === code || normalizeWorkflowStageValue(status.name) === normalizeWorkflowStageValue(name)));
            return {...createEditableStage(), code: existing?.code ?? code, name: existing?.name ?? name,
                existingStatusId: existing?.id, identityReviewed: true, description: existing?.description ?? '', colorHex: existing?.colorHex || '#3B82F6',
                requiredRole: roles.some(item => item.code === role) ? role : ''};
        }));
        setFormError('');
    };

    const updateStage = (
        id: string,
        patch: Partial<EditableStage>,
    ) => {
        setStages((current) =>
            current.map((stage) =>
                stage.clientId === id
                    ? {
                        ...stage,
                        ...patch,
                    }
                    : stage,
            ),
        );
    };

    const deleteStage = (
        id: string,
    ) => {
        setStages((current) =>
            current.filter(
                (stage) => stage.clientId !== id,
            ),
        );
    };

    const useExistingStage = (
        id: string,
        status: WorkflowStatus,
    ) => {
        updateStage(id, {
            existingStatusId: status.id,
            code: status.code,
            name: status.name,
            description: status.description ?? '',
            colorHex: status.colorHex || '#3B82F6',
        });
        setFormError('');
    };

    const handleDragEnd = (
        event: DragEndEvent,
    ) => {
        const {active, over} = event;

        if (!over || active.id === over.id) {
            return;
        }

        setStages((current) => {
            const oldIndex = current.findIndex(
                (stage) =>
                    stage.clientId === active.id,
            );

            const newIndex = current.findIndex(
                (stage) =>
                    stage.clientId === over.id,
            );

            if (
                oldIndex === -1 ||
                newIndex === -1
            ) {
                return current;
            }

            return arrayMove(
                current,
                oldIndex,
                newIndex,
            );
        });
    };

    const buildStagePayload = (
        stage: EditableStage,
    ): WorkflowStage => ({
        code: stage.code.trim(),
        name: stage.name.trim(),
        description: stage.description.trim(),
        colorHex: stage.colorHex,
        requiredRole: stage.requiredRole.trim(),
        materialReportRequired: stage.materialReportRequired,
        allowUnplannedMaterials: stage.allowUnplannedMaterials,
    });

    const resetForm = () => {
        setFormData(initialFormData);
        setStages([]);
        setFormError('');
    };

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setFormError('');

        if (!formData.workTypeCode.trim() || !formData.workTypeName.trim()) {
            setFormError(t('workTypeRequired'));
            return;
        }

        if (stages.length === 0) {
            setFormError(t('stageRequired'));
            return;
        }

        const incompleteStage = stages.find(
            (stage) =>
                !stage.code.trim() ||
                !stage.name.trim() ||
                !stage.requiredRole.trim(),
        );
        if (incompleteStage) {
            setFormError(t('stageFieldsRequired'));
            return;
        }

        const reservedStage = stages.find((stage) =>
            SYSTEM_STAGE_CODES.has(stage.code.trim().toUpperCase()),
        );
        if (reservedStage) {
            setFormError(t('systemCodeForbidden', {
                code: reservedStage.code.trim(),
            }));
            return;
        }

        if (statusesError) {
            setFormError(
                t('duplicateCheckError'),
            );
            return;
        }

        const unresolvedSimilarStage = stages
            .filter((stage) => !stage.existingStatusId && !stage.identityReviewed)
            .map((stage) => ({
                stage,
                match: findSimilarWorkflowStatus(stage, existingStatuses),
            }))
            .find(({match}) => Boolean(match));

        if (unresolvedSimilarStage?.match) {
            setFormError(
                t('unresolvedSimilar', {
                    stage: unresolvedSimilarStage.stage.name || unresolvedSimilarStage.stage.code,
                    existing: unresolvedSimilarStage.match.status.name,
                    code: unresolvedSimilarStage.match.status.code,
                }),
            );
            return;
        }

        if (hasDuplicateStageCodes(stages)) {
            setFormError(
                t('duplicateStages'),
            );
            return;
        }

        const normalizedStages = stages.map(
            buildStagePayload,
        );

        const payload:
            CreateWorkflowWorkTypesDTO = {
            workTypeCode: formData.workTypeCode.trim(),
            workTypeName: formData.workTypeName.trim(),
            description: formData.description.trim(),
            stages: normalizedStages,
        };

        try {
            await createWorkflowWorkTypes(
                    payload,
                ).unwrap();


            resetForm();
            onClose();
        } catch (error) {
            setFormError(getApiErrorMessage(error, 'createWorkflowWorkTypes'));
        }
    };

    return (
        <>
            <Modal contentClassName="max-h-[90vh] max-w-4xl overflow-hidden p-0">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">
                            {t('badge')}
                        </p>

                        <h2 className="mt-1 text-lg font-black text-slate-950">
                            {t('title')}
                        </h2>

                        <p className="text-xs text-slate-500">
                            {t('subtitle')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-400 transition hover:bg-slate-200"
                    >
                        ×
                    </button>
                </header>

                <form
                    onSubmit={handleSubmit}
                    data-tour="work-type-form"
                    className="max-h-[calc(90vh-76px)] overflow-y-auto"
                >
                    <div className="space-y-5 p-5">
                        <section className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                            <h3 className="text-sm font-bold text-slate-900">{t('presetsTitle')}</h3>
                            <p className="mt-1 text-xs text-slate-600">{t('presetsHint')}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {(Object.keys(workflowPresets) as PresetKind[]).map(kind => <button key={kind} type="button"
                                    disabled={creating || statusesLoading || statusesFetching || statusesError || rolesLoading || rolesError || stages.length > 0 || Boolean(formData.workTypeCode || formData.workTypeName)}
                                    onClick={() => applyPreset(kind)} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
                                    {t(workflowPresets[kind].label)}
                                </button>)}
                            </div>
                        </section>
                        <section className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label
                                    className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    {t('workTypeCode')}
                                </label>

                                <input
                                    required
                                    type="text"
                                    value={formData.workTypeCode}
                                    onChange={(event) =>
                                        setFormData(
                                            (current) => ({
                                                ...current,
                                                workTypeCode:
                                                event.target
                                                    .value,
                                            }),
                                        )
                                    }
                                    placeholder="CROWN"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-violet-500 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label
                                    className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    {t('name')}
                                </label>

                                <input
                                    required
                                    type="text"
                                    value={formData.workTypeName}
                                    onChange={(event) =>
                                        setFormData(
                                            (current) => ({
                                                ...current,
                                                workTypeName:
                                                event.target
                                                    .value,
                                            }),
                                        )
                                    }
                                    placeholder={t('namePlaceholder')}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-violet-500 focus:bg-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                            <textarea
                                value={formData.description}
                                onChange={(event) =>
                                    setFormData(
                                        (current) => ({
                                            ...current,
                                            description:
                                            event.target
                                                .value,
                                        }),
                                    )
                                }
                                placeholder={t('descriptionPlaceholder')}
                                className="min-h-16 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-violet-500 focus:bg-white"
                            />
                            </div>
                        </section>

                        <section data-tour="work-type-stages">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">
                                        {t('stages')}
                                    </h3>

                                    <p className="text-[11px] text-slate-400">
                                        {t('stagesHint')}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={addStage}
                                    className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                                >
                                    {t('addStage')}
                                </button>
                            </div>

                            <div className="space-y-2">
                                <SystemStageRow
                                    code="TODO"
                                    label={t('systemTodo')}
                                />

                                {stages.length > 0 ? (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={
                                            closestCenter
                                        }
                                        onDragEnd={
                                            handleDragEnd
                                        }
                                    >
                                        <SortableContext
                                            items={stages.map(
                                                (stage) =>
                                                    stage.clientId,
                                            )}
                                            strategy={
                                                verticalListSortingStrategy
                                            }
                                        >
                                            <div className="space-y-2">
                                                {stages.map(
                                                    (
                                                        stage,
                                                        index,
                                                    ) => (
                                                        <SortableStageRow
                                                            key={
                                                                stage.clientId
                                                            }
                                                            stage={
                                                                stage
                                                            }
                                                            index={
                                                                index
                                                            }
                                                            existingStatuses={
                                                                existingStatuses
                                                            }
                                                            statusesLoading={
                                                                statusesLoading
                                                            }
                                                            statusesError={
                                                                statusesError
                                                            }
                                                            roles={
                                                                roles
                                                            }
                                                            rolesLoading={
                                                                rolesLoading
                                                            }
                                                            canCreate={
                                                                isAdmin
                                                            }
                                                            onCreateRequest={() =>
                                                                setRoleCreationTarget(
                                                                    stage.clientId,
                                                                )
                                                            }
                                                            onChange={
                                                                updateStage
                                                            }
                                                            onDelete={
                                                                deleteStage
                                                            }
                                                            onUseExisting={
                                                                useExistingStage
                                                            }
                                                        />
                                                    ),
                                                )}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={addStage}
                                        className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs font-medium text-slate-400 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
                                    >
                                        {t('addIntermediate')}
                                    </button>
                                )}

                                <SystemStageRow
                                    code="WAITING_FOR_APPROVAL"
                                    label={t('systemWaitingForApproval')}
                                />
                                <SystemStageRow
                                    code="ORDER_CLOSED"
                                    label={t('systemOrderClosed')}
                                />
                            </div>
                        </section>

                        {rolesError && (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                {t('rolesError')}
                            </p>
                        )}

                        {statusesError && (
                            <div
                                className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                {t('statusesError')}
                            </span>
                                <button
                                    type="button"
                                    onClick={() => void refetchStatuses()}
                                    disabled={statusesFetching}
                                    className="shrink-0 rounded-lg bg-white px-3 py-1.5 font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {statusesFetching ? t('reloading') : commonT('actions.retry')}
                                </button>
                            </div>
                        )}

                        {formError && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                {formError}
                            </p>
                        )}

                        {createError && !formError && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                {getApiErrorMessage(createError, 'createWorkflowWorkTypes')}
                            </p>
                        )}
                    </div>

                    <footer
                        className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                        >
                            {commonT('actions.cancel')}
                        </button>

                        <button
                            type="submit"
                            disabled={
                                creating ||
                                rolesLoading ||
                                statusesLoading ||
                                statusesError
                            }
                            className="min-h-11 rounded-lg bg-violet-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {creating
                                ? t('creating')
                                : t('create')}
                        </button>
                    </footer>
                </form>
            </Modal>
            {roleCreationTarget && isAdmin && (
                <RoleCreateModal
                    onClose={() => setRoleCreationTarget(null)}
                    onCreated={(role) => {
                        updateStage(roleCreationTarget, {
                            requiredRole: role.code,
                        });
                        setRoleCreationTarget(null);
                    }}
                />
            )}
        </>
    );
}
