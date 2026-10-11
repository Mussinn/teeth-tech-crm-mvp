 'use client';
import {useState} from 'react';
import Modal from '@/src/components/ui/Modal';
import {useUpdateTaskStatusMutation} from '@/src/services/api/ordersApi';
import {getApiErrorMessage} from '@/src/services/apiNotifications';
import {mvpModules} from '@/src/lib/mvp';
import WarehouseTransitionModal from './WarehouseTransitionModal';
type Props = {taskId:string;nextStatusId:string;assignedUserId?:string;defaultComment?:string;onClose:()=>void;onSuccess?:()=>void};
function MvpTransition({taskId,nextStatusId,assignedUserId,defaultComment='',onClose,onSuccess}:Props) {
 const [comment,setComment]=useState(defaultComment);const [error,setError]=useState('');
 const [update,{isLoading}]=useUpdateTaskStatusMutation();
 async function submit(){try{await update({taskId,body:{nextStatusId,assignedUserId,comment:comment.trim()},notification:{error:false}}).unwrap();onSuccess?.();onClose();}catch(e){setError(getApiErrorMessage(e,'updateTaskStatus'));}}
 return <Modal contentClassName="max-w-lg p-6"><div className="space-y-5"><h2 className="text-xl font-bold">Завершить этап задачи</h2><p className="text-sm text-slate-500">Переход сохранится в истории заказа и в вашем отчёте KPI. Подтвердите, что работа на текущем этапе выполнена.</p><label className="block text-sm">Комментарий<textarea maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} className="mt-2 w-full rounded-xl border p-3" placeholder="Что сделано, что нужно знать следующему сотруднику" /></label>{error&&<p role="alert" className="text-red-600">{error}</p>}<div className="flex justify-end gap-3"><button disabled={isLoading} onClick={onClose} className="rounded-xl border px-4 py-3">Отмена</button><button disabled={isLoading} onClick={()=>void submit()} className="rounded-xl bg-violet-600 px-4 py-3 text-white disabled:opacity-50">{isLoading?'Сохранение…':'Подтвердить переход'}</button></div></div></Modal>;
}
export default function TaskMaterialTransitionModal(props:Props){return mvpModules.warehouse?<WarehouseTransitionModal {...props}/>:<MvpTransition {...props}/>;}
