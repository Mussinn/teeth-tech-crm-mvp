 'use client';
import {FormEvent, useState} from 'react';
import Link from 'next/link';
import {useGetOrderStatusesQuery, useSetStatusActiveMutation, useCreateOrderStatusMutation, useDeleteOrderStatusMutation} from '@/src/services/api/workflowApi';
function errorText(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'data' in error) {
        const data = error.data;
        if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') return data.message;
    }
    return 'Не удалось сохранить изменение. Проверьте права и связи статуса с маршрутами.';
}
export default function Statuses() {
    const {data = [], isLoading, isError} = useGetOrderStatusesQuery();
    const [setActive, activation] = useSetStatusActiveMutation();
    const [create, creation] = useCreateOrderStatusMutation();
    const [remove, deletion] = useDeleteOrderStatusMutation();
    const [code, setCode] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState('');
    const busy = activation.isLoading || creation.isLoading || deletion.isLoading;
    async function add(event: FormEvent) {
        event.preventDefault(); setError('');
        try {await create({code, name, sortOrder: data.length + 1}).unwrap(); setCode(''); setName('');}
        catch (e) {setError(errorText(e));}
    }
    async function toggle(id: string, active: boolean) {
        setError(''); try {await setActive({id, active}).unwrap();} catch(e) {setError(errorText(e));}
    }
    async function destroy(id: string) {
        if (!window.confirm('Удалить статус? Для временного отключения используйте кнопку «Отключить».')) return;
        setError(''); try {await remove(id).unwrap();} catch(e) {setError(errorText(e));}
    }
    const custom = data.filter(s => !['TODO', 'WAITING_FOR_APPROVAL', 'ORDER_CLOSED'].includes(s.code));
    const system = data.filter(s => ['TODO', 'WAITING_FOR_APPROVAL', 'ORDER_CLOSED'].includes(s.code));
    return <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Статусы задач</h1>
        <p className="text-slate-600">Создайте этапы и настройте их последовательность в <Link href="/laboratory/work-types" className="text-violet-600 underline">видах работ</Link>. Отключённый этап нельзя выбрать для перехода; новые задачи по маршруту с ним не создаются. Если на этапе есть задачи, сначала переведите их дальше.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        <form onSubmit={add} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
            <input aria-label="Код статуса" placeholder="Код, например MODELING" required maxLength={50} value={code} onChange={e=>setCode(e.target.value)} className="min-w-0 rounded-lg border p-2"/>
            <input aria-label="Название статуса" placeholder="Название этапа" required maxLength={50} value={name} onChange={e=>setName(e.target.value)} className="min-w-0 rounded-lg border p-2"/>
            <button disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-white disabled:opacity-50">Добавить этап</button>
        </form>
        {isLoading ? <p>Загрузка…</p> : isError ? <p role="alert">Не удалось загрузить статусы.</p> : <section className="space-y-3">
            <h2 className="font-bold">Рабочие этапы</h2>
            {custom.length === 0 && <p className="rounded-xl border border-dashed p-6 text-slate-500">Рабочих этапов пока нет. Добавьте первый этап или создайте вид работы с маршрутом.</p>}
            {custom.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
                <div><strong>{s.name}</strong><p className="text-sm text-slate-500">{s.code} · {s.active === false ? 'Отключён' : 'Активен'}</p></div>
                <div className="flex gap-3"><button disabled={busy} onClick={()=>toggle(s.id,s.active===false)} className="rounded-lg border px-3 py-2 disabled:opacity-50">{s.active===false?'Активировать':'Отключить'}</button><button disabled={busy} onClick={()=>destroy(s.id)} className="px-3 py-2 text-red-600 disabled:opacity-50">Удалить</button></div>
            </div>)}
        </section>}
        <section className="rounded-xl bg-slate-50 p-5"><h2 className="font-bold">Системные статусы</h2><p className="mt-2 text-sm text-slate-600">Нужны для создания, согласования и завершения задач. Всегда активны.</p><ul className="mt-3 space-y-2">{system.map(s=><li key={s.id}>{s.name}</li>)}</ul></section>
    </div>;
}
