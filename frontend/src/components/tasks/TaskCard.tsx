'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { WorkBoardTask } from '@/src/types/task.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

// Цвета для материалов
const materialColors: { [key: string]: string } = {
    'Zirconia': 'bg-slate-100 text-slate-700 border-slate-200',
    'E-max': 'bg-sky-100 text-sky-800 border-sky-200',
    'PMMA': 'bg-pink-100 text-pink-800 border-pink-200',
    'Titanium': 'bg-zinc-200 text-zinc-900 border-zinc-300',
};

interface TaskCardProps {
    task: WorkBoardTask;
    role: string | null;
}

export const TaskCard = ({ task, role }: TaskCardProps) => {
    const t = useTranslations('orders.board');
    const format = useAppFormatters();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: task.id,
        data: { type: 'Task', task }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    const isOverdue = new Date(task.deadline) < new Date('2026-04-09');
    const isToday = task.deadline === '2026-04-09';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-blue-400 transition flex flex-col gap-3 ${isDragging ? 'z-50' : 'z-0'}`}
        >
            {/* Кнопка перехода в проект (поверх карточки, но не мешает dnd) */}
            <Link
                href={`/orders/${task.id}`}
                className="absolute inset-0 z-10"
                onClick={(e) => {
                    // Если мы тянем карточку, переход не должен срабатывать
                    if (isDragging) e.preventDefault();
                }}
            />

            {/* Контент карточки (нужно обернуть listeners, чтобы тянуть за иконку или всю область) */}
            <div {...attributes} {...listeners} className="z-20">
                <div className="flex justify-between items-center text-[11px] mb-2">
                    <span className="font-bold text-blue-700 uppercase tracking-tight bg-blue-50 px-1.5 py-0.5 rounded">
                        {task.id}
                    </span>
                    {role === 'DISPATCHER' && (
                        <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center text-[8px] text-white font-bold">
                                T{task.techId}
                            </div>
                            <span>Tech: {task.techId}</span>
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-slate-900 font-semibold text-sm leading-tight">
                        {task.type} ({task.units})
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">{t('patient', {name: task.patient})}</p>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${materialColors[task.material] || 'bg-slate-100'}`}>
                        {task.material}
                    </span>
                </div>

                <div className="flex items-end justify-between border-t border-slate-100 pt-3 mt-3">
                    <div className="w-7 h-7 rounded-full bg-slate-600 border-2 border-white text-white flex items-center justify-center font-bold text-xs shadow-inner">
                        {task.patient[0]}
                    </div>
                    <div className={`text-right text-xs p-1.5 rounded ${isOverdue ? 'bg-red-100 text-red-800' : isToday ? 'bg-orange-100 text-orange-800' : 'text-slate-500'}`}>
                        <p className="text-[10px] uppercase tracking-wider leading-none">{t('deadline')}</p>
                        <p className="mt-0.5 leading-none">
                            {format.date(task.deadline, {
                                day: 'numeric',
                                month: 'short'
                            })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
