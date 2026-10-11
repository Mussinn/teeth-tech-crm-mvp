'use client';

import {useState} from 'react';
import Modal from '@/src/components/ui/Modal'
import PhoneInput from '@/src/components/ui/PhoneInput';
import {useUpdateClinicMutation} from '@/src/services/api/clinicsApi'
import {UpdateClinicDto} from "@/src/types/clinic.types";
import { useNotifications } from '@/src/features/notifications/useNotifications';
import {useTranslations} from 'next-intl';

type EditClinicModalProps = {
    isOpen: boolean;
    clinic: UpdateClinicDto | null;
    onClose: () => void;
};

export default function EditClinicModal({
                                            isOpen,
                                            clinic,
                                            onClose,
                                        }: EditClinicModalProps) {
    const t = useTranslations('clinics.form');
    const commonT = useTranslations('common');
    const [formData, setFormData] = useState<UpdateClinicDto>(clinic ?? {
        id: '',
        name: '',
        phone: '',
        address: '',
        contactPerson: '',
        email: '',
        bin: ''
    });
    const [ updateClinic, {isLoading}] = useUpdateClinicMutation();
    const { notifyError } = useNotifications();

    if (!isOpen || !clinic) return null;

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
       e.preventDefault();
       if(!clinic.id){
           console.log('Clinic id is missing')
           notifyError(t('missingId'));
           return;
       }

       const body: UpdateClinicDto = {
           name: formData.name,
           phone: formData.phone,
           address: formData.address,
           contactPerson: formData.contactPerson,
           email: formData.email,
           bin: formData.bin,
       }


       try {
           console.log('Patch data', {
               id: clinic.id,
               body,
           })
           await updateClinic({
               id: clinic.id,
               body: formData,
           }).unwrap();
           onClose();
       } catch (e) {
           console.error(e);
       }
    }



    return (
        <Modal contentClassName="max-w-2xl overflow-hidden p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-5 py-5 dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-900 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">{t('card')}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                        {t('editTitle')}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {t('editSubtitle')}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-400 shadow-sm transition hover:bg-slate-100 dark:bg-slate-800"
                >
                    &times;
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            {t('name')}
                        </label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({...formData, name: e.target.value})
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            {t('contactPerson')}
                        </label>
                        <input
                            type="text"
                            value={formData.contactPerson}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    contactPerson: e.target.value,
                                })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            {t('phone')}
                        </label>
                        <PhoneInput
                            value={formData.phone ?? ''}
                            onValueChange={(phone) =>
                                setFormData({...formData, phone})
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({...formData, email: e.target.value})
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            {t('address')}
                        </label>
                        <input
                            required
                            type="text"
                            value={formData.address}
                            onChange={(e) =>
                                setFormData({...formData, address: e.target.value})
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            BIN
                        </label>
                        <input
                            required
                            type="text"
                            value={formData.bin}
                            onChange={(e) =>
                                setFormData({...formData, bin: e.target.value})
                            }
                            placeholder={t('binPlaceholder')}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition hover:text-slate-700 sm:w-auto"
                    >
                        {commonT('actions.cancel')}
                    </button>

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 active:scale-95 sm:w-auto"
                    >
                        {isLoading ? t('saving') : t('saveChanges')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
