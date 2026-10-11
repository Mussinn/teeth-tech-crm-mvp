 'use client';
import AppIcon from '@/src/components/ui/AppIcon';
import Link from 'next/link';
import {useState} from 'react';
import {useGetMaterialsQuery,useCreateMaterialMutation,useDeleteMaterialMutation} from '@/src/services/api/laboratory/materialApi';
export default function MaterialsPage(){
 const {data=[],isLoading,isError}=useGetMaterialsQuery();
 const [create,{isLoading:saving}]=useCreateMaterialMutation();const [remove]=useDeleteMaterialMutation();
 const [name,setName]=useState('');const [code,setCode]=useState('');const [unit,setUnit]=useState('шт');const [description,setDescription]=useState('');const [error,setError]=useState('');const [search,setSearch]=useState('');
 return <main className="experience-page lab-directory-page space-y-6"><header className="experience-hero"><p className="experience-eyebrow">ДАННЫЕ ДЛЯ НАРЯДОВ</p><h1 className="text-3xl font-bold tracking-tight">Материалы</h1><p className="mt-2 text-sm text-slate-500">Справочник материалов для нарядов.</p></header><Link href="/laboratory" className="lab-back-link">← Все настройки лаборатории</Link>
 <form className="experience-panel grid gap-4 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();setError('');try{await create({name:name.trim(),nomenclatureCode:code.trim(),unit:unit.trim(),description}).unwrap();setName('');setCode('');setDescription('');}catch{setError('Не удалось добавить материал. Проверьте заполнение и уникальность артикула.');}}}>
 <div className="sm:col-span-2"><h2 className="text-lg font-bold">Новый материал</h2><p className="mt-1 text-sm text-slate-500">Укажите название и уникальный артикул, чтобы сотрудники выбирали нужный материал в наряде.</p></div><label className="experience-field"><span>Название</span><input required maxLength={100} aria-label="Название" placeholder="Название" value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border p-2"/></label>
 <label className="experience-field"><span>Артикул</span><input required maxLength={100} aria-label="Артикул" placeholder="Уникальный артикул" value={code} onChange={e=>setCode(e.target.value)} className="rounded-lg border p-2"/></label>
 <label className="experience-field"><span>Единица измерения</span><input required maxLength={50} aria-label="Единица измерения" value={unit} onChange={e=>setUnit(e.target.value)} className="rounded-lg border p-2"/></label>
 <label className="experience-field"><span>Описание</span><input aria-label="Описание" placeholder="Описание" value={description} onChange={e=>setDescription(e.target.value)} className="rounded-lg border p-2"/></label>
 <button disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-white">Добавить</button></form>
 {error&&<p role="alert" className="text-red-600">{error}</p>}
 <input aria-label="Поиск материалов" placeholder="Поиск материалов" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border p-2"/>
 {isLoading?<p>Загрузка…</p>:isError?<p role="alert">Не удалось загрузить материалы.</p>:<div><h2 className="mb-4 text-lg font-bold">Материалы лаборатории</h2>{!data.filter(m=>m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).length&&<div className="experience-panel experience-empty"><span className="empty-symbol"><AppIcon name="materials" className="h-6 w-6"/></span><h3>{search?"Ничего не найдено":"Материалов пока нет"}</h3><p>{search?"Попробуйте другое название.":"Добавьте первый материал с помощью формы выше."}</p></div>}<ul className="space-y-2">{data.filter(m=>m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(m=><li key={m.id} className="lab-entry experience-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><h3 className="font-semibold">{m.name}</h3><p className="mt-1 text-xs text-slate-500">Единица: {m.unit}{!m.isActive?' · Неактивен':''}</p></div><button className="text-red-600" onClick={async()=>{if(!window.confirm('Удалить материал из справочника? История нарядов сохранится.'))return;try{await remove(m.id).unwrap();}catch{setError('Не удалось удалить материал.');}}}>Удалить</button></li>)}</ul></div>}
 </main>;
}
