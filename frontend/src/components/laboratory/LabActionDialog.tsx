'use client';
import {useEffect,useRef,useState} from 'react';
import {labActionHelp} from './labCaseGuide';
export default function LabActionDialog({action,loading,error,onCancel,onConfirm,reasons}:{action:string;loading:boolean;error:string;onCancel:()=>void;onConfirm:(fields:{note:string;clinician:string;recipient:string;tracking:string;reason:string})=>void;reasons:Record<string,string>}) {
 const ref=useRef<HTMLDialogElement>(null);
 const [note,setNote]=useState(''),[clinician,setClinician]=useState(''),[recipient,setRecipient]=useState(''),[tracking,setTracking]=useState(''),[reason,setReason]=useState('LAB_ERROR');
 const help=labActionHelp[action];
 useEffect(()=>{ref.current?.showModal();},[]);
 const needsNote=action!=='DISPATCH';const needsRecipient=['DISPATCH','DELIVER'].includes(action);
 return <dialog ref={ref} aria-labelledby="lab-action-title" onCancel={e=>{e.preventDefault();if(!loading)onCancel();}} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100">
  <form onSubmit={e=>{e.preventDefault();onConfirm({note,clinician,recipient,tracking,reason});}} className="space-y-4">
   <div className="flex items-start justify-between gap-4"><h3 id="lab-action-title" className="text-xl font-bold">{help.title}</h3><button type="button" aria-label="Закрыть действие" disabled={loading} onClick={onCancel} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">×</button></div><p className="text-sm text-slate-500">{help.description}</p>
   {action==='APPROVE_DESIGN'&&<label className="block text-sm font-semibold">Врач, согласовавший дизайн<input required maxLength={300} value={clinician} onChange={e=>setClinician(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>}
   {needsRecipient&&<label className="block text-sm font-semibold">{action==='DELIVER'?'Кто получил изделие в клинике':'Получатель / служба доставки'}<input required maxLength={300} value={recipient} onChange={e=>setRecipient(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>}
   {action==='DISPATCH'&&<label className="block text-sm font-semibold">Трек-номер или реквизиты передачи · необязательно<input maxLength={1000} value={tracking} onChange={e=>setTracking(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>}
   {action==='RETURN'&&<label className="block text-sm font-semibold">Причина возврата<select value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3">{Object.entries(reasons).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
   <label className="block text-sm font-semibold">{needsNote?'Комментарий к действию · обязательно':'Комментарий к действию · необязательно'}<textarea aria-label="Комментарий к действию" required={needsNote} rows={4} maxLength={8000} placeholder={help.placeholder} value={note} onChange={e=>setNote(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm" /></label>
   <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-800 dark:bg-violet-950 dark:text-violet-200"><strong>Что изменится: </strong>{help.result}</p>
   {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
   <div className="flex justify-end gap-3"><button type="button" disabled={loading} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Отмена</button><button type="submit" disabled={loading||needsNote&&!note.trim()||needsRecipient&&!recipient.trim()||action==='APPROVE_DESIGN'&&!clinician.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{loading?'Сохраняем…':'Подтвердить действие'}</button></div>
  </form>
 </dialog>;
}
