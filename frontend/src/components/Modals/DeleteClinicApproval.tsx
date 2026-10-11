import Modal from "@/src/components/ui/Modal";
import {useDeleteClinicMutation} from "@/src/services/api/clinicsApi";
import {useRouter} from "next/navigation";
import {useTranslations} from 'next-intl';

type props = {
    isOpen: boolean;
    onClose: () => void;
    clinicId: string
}

const DeleteClinicApproval = ({isOpen, onClose, clinicId}: props) => {
    const t = useTranslations('clinics.delete');

    const router = useRouter();
    const [deleteClinic, {isLoading}] = useDeleteClinicMutation();
    if (!isOpen) return null;

    const handleDelete = async () => {
        try {
            await deleteClinic(clinicId).unwrap();
            onClose()
            router.push('/clinics');
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <Modal>
            <div>
                <h1 className="text-xl font-bold text-slate-900">
                    {t('title')}
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    {t('description')}
                </p>
            </div>
            {isLoading ?
                <h2>{t('loading')}</h2>
                :
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 sm:w-auto"
                    >
                        {t('cancel')}
                    </button>

                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="w-full rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {isLoading ? t('loading') : t('confirm')}
                    </button>
                </div>
            }
        </Modal>
    )
}

export default DeleteClinicApproval
