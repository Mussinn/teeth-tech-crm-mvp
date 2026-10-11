'use client';

import LaboratoryCrudPage from '@/src/components/laboratory/LaboratoryCrudPage';
import {useTranslations} from 'next-intl';

import {
    useGetColorsQuery,
    useCreateColorMutation,
    useUpdateColorMutation,
    useDeleteColorMutation,
} from '@/src/services/api/laboratory/colorsApi';

import type {
    Color,
    CreateColorDto,
    UpdateColorDto,
} from '@/src/types/laboratory-types/colors.types';

export default function LaboratoryColorsPage() {
    const t = useTranslations('laboratory.colors');
    return (
        <LaboratoryCrudPage<Color, boolean | void, CreateColorDto, UpdateColorDto>
            pageTitle={t('title')}
            pageDescription={t('description')}
            formTitle={t('formTitle')}
            formDescription={t('formDescription')}
            listTitle={t('listTitle')}
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyDescription')}
            useGetQuery={useGetColorsQuery}
            queryArg={false}
            useCreateMutation={useCreateColorMutation}
            useUpdateMutation={useUpdateColorMutation}
            useDeleteMutation={useDeleteColorMutation}
            fields={[
                {
                    name: 'code',
                    label: t('code'),
                    placeholder: 'A1',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'name',
                    label: t('name'),
                    placeholder: t('namePlaceholder'),
                    type: 'text',
                    required: true,
                },
                {
                    name: 'isActive',
                    label: t('active'),
                    type: 'checkbox',
                },
            ]}
            initialFormState={{
                code: '',
                name: '',
                isActive: true,
            }}
            getEditForm={(item) => ({
                code: item.code,
                name: item.name,
                isActive: item.isActive,
            })}
            getCreateBody={(form) => ({
                code: String(form.code).trim(),
                name: String(form.name).trim(),
                isActive: Boolean(form.isActive),
            })}
            getUpdateBody={(form) => ({
                code: String(form.code).trim(),
                name: String(form.name).trim(),
                isActive: Boolean(form.isActive),
            })}
        />
    );
}
