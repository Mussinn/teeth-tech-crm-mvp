import { useSortable} from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/src/types/task.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type TaskCardProps = {
    task: Task;
    onClick?: () => void;
    isSelected?: boolean;
};

export default function TaskCard ({ task, onClick, isSelected }: TaskCardProps) {
    const t = useTranslations('tasks.card');
    const formatters = useAppFormatters();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({
            id: task.id,
            data: { type: 'Task', task },
        });

    const subtotal = task.units * task.unitPrice;
    const total = Math.max(subtotal - task.discount, 0);

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.3 : 1,
            }}
            {...attributes}
            {...listeners}
            className={`bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-blue-400 cursor-grab active:cursor-grabbing transition flex flex-col gap-3 ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-200'}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {task.id}
                </span>
                <span className="text-slate-400 italic">{t('units', {count: task.units})}</span>
            </div>

            <div>
                <h3 className="text-slate-900 font-semibold text-sm">
                    {task.type || task.material || t('technicalTask')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                    {task.material || t('materialMissing')}
                    {task.color ? ` · ${t('color', {color: task.color})}` : ''}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <div>
                    <p className="font-bold uppercase text-slate-400">{t('technician')}</p>
                    <p className="font-semibold text-slate-700">{task.technicianId || '-'}</p>
                </div>
                <div>
                    <p className="font-bold uppercase text-slate-400">{t('operator')}</p>
                    <p className="font-semibold text-slate-700">{task.operatorId || '-'}</p>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[10px] text-slate-400">
                    {t('unitPrice', {price: formatters.currency(task.unitPrice)})}
                </span>
                <span className="text-xs font-black text-slate-800">
                    {formatters.currency(total)}
                </span>
            </div>
        </div>
    );
}
