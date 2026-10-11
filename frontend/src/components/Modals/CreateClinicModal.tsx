'use client';

import {useState} from 'react';
import {  CreateClinicDto} from '@/src/types/clinic.types';
import Modal from "../ui/Modal";
import PhoneInput from '../ui/PhoneInput';
import {useCreateClinicMutation} from "@/src/services/api/clinicsApi";
import {useTranslations} from 'next-intl';

type CreateClinicModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function CreateClinicModal({
                                              isOpen,
                                              onClose,
                                          }: CreateClinicModalProps) {
    const t = useTranslations('clinics.form');
    const commonT = useTranslations('common');
    const [formData, setFormData] = useState<CreateClinicDto>({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        bin: '',
    });
    const [createClinic, {isLoading}] = useCreateClinicMutation();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log(formData)
        try {
            await createClinic(formData).unwrap();
            setFormData({
                name: '',
                contactPerson: '',
                phone: '',
                email: '',
                address: '',
                bin: ''
            });
            onClose();
        } catch (e) {
            console.error(e);
        }
    };



    return (
        <Modal contentClassName="max-w-2xl overflow-hidden p-0">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-5 py-5 dark:border-slate-700 dark:from-violet-950/30 dark:to-slate-900 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">{t('newRecord')}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                        {t('createTitle')}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {t('createSubtitle')}
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

            <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
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
                            placeholder="Dental Care Astana"
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
                                setFormData({...formData, contactPerson: e.target.value})
                            }
                            placeholder={t('contactPlaceholder')}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                            {t('phone')}
                        </label>
                        <PhoneInput
                            value={formData.phone}
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
                            placeholder="clinic@mail.com"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>

                    <div className="md:col-span-2">
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
                            placeholder={t('addressPlaceholder')}
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
                        {isLoading ? t('creating') : t('createTitle')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
