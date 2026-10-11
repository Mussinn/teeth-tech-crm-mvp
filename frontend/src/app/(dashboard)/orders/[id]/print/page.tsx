 'use client';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useGetOrderDetailsQuery,useGetOrderKanbanQuery} from '@/src/services/api/ordersApi';
import {useGetLaboratoryCaseQuery} from '@/src/services/api/laboratoryCaseApi';
export default function PrintOrder(){
 const {id}=useParams<{id:string}>();const order=useGetOrderDetailsQuery(id);const board=useGetOrderKanbanQuery({id});const lab=useGetLaboratoryCaseQuery(id);
 if(order.isLoading||board.isLoading||lab.isLoading)return <p>Подготовка наряда…</p>;
 if(order.isError||board.isError||lab.isError||!order.data||!board.data||!lab.data)return <p role="alert">Не удалось подготовить полный наряд. Обновите страницу.</p>;
 const o=order.data;const d=lab.data.state.details;const tasks=board.data.flatMap(c=>c.tasks.map(t=>({...t,stage:c.title})));
 return <><style>{`@media print {html,body{height:auto!important;overflow:visible!important}body *:not(:has(.print-sheet)):not(.print-sheet):not(.print-sheet *){display:none!important}body *:has(.print-sheet){display:block!important;position:static!important;height:auto!important;min-height:0!important;overflow:visible!important;padding:0!important;margin:0!important;transform:none!important}.print-sheet,.print-sheet *{visibility:visible!important}.print-sheet{position:static;width:100%;padding:0;color:black;background:white}.print-controls{display:none!important}tr{break-inside:avoid}@page{size:A4;margin:8mm}}`}</style>
 <div className="print-controls mb-5 flex gap-4"><Link href={`/orders/${id}`}>← К заказу</Link><button className="rounded-lg bg-violet-600 px-4 py-2 text-white" onClick={()=>window.print()}>Печать / PDF</button></div>
 <article className="print-sheet space-y-4 bg-white p-6 text-black"><h1 className="text-2xl font-bold">Наряд № {o.orderNumber}</h1><p className="text-xs">ID: {id}</p><dl className="grid grid-cols-2 gap-3"><div><dt>Клиника</dt><dd>{o.clinic}</dd></div><div><dt>Врач</dt><dd>{o.doctorFullName||'—'}</dd></div><div><dt>Пациент</dt><dd>{o.patientFullName}</dd></div><div><dt>Срок производства</dt><dd>{o.deadline||'—'}</dd></div><div><dt>Приём пациента</dt><dd>{d.appointment||'—'}</dd></div><div><dt>Данные</dt><dd>{d.channel==='DIGITAL'?'Сканы':d.channel==='PHYSICAL'?'Оттиски':'Смешанный комплект'}{d.rush?' · СРОЧНО':''}</dd></div></dl>
 <h2 className="font-bold">Задание врача</h2><p className="whitespace-pre-wrap">{d.prescription||'—'}</p>
 <table className="w-full border-collapse text-sm"><thead><tr>{['Работа / этап','Зубы / кол-во','Цвет / материалы','Техник'].map(h=><th key={h} className="border p-2 text-left">{h}</th>)}</tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td className="border p-2">{t.workTypeName}<br/>{t.stage}</td><td className="border p-2">{t.toothNumbers?.join(', ')||'—'} / {t.quantity}</td><td className="border p-2">{t.colorCode||'Не требуется'}<br/>{t.materialNames?.join(', ')}</td><td className="border p-2">{t.dentalTechnicianFullName||'Не назначен'}</td></tr>)}</tbody></table>
 {Object.entries({'Имплант':d.implantSystem,'Платформа':d.implantPlatform,'Модельная система':d.modelSystem,'Гарнитура зубов':d.toothSet,'Расцветка':d.shadeSystem,'Особенности цвета':d.shadeNotes,'Входящие материалы':d.incomingItems,'Партии и серийные номера':d.batchReferences,'Адрес передачи':d.shippingAddress,'Комментарий':o.comment}).filter(([,v])=>v).map(([k,v])=><p key={k} className="whitespace-pre-wrap"><strong>{k}: </strong>{v}</p>)}
 <p className="border-t pt-4">Принял: __________________ Техник: __________________ Контроль качества: __________________</p>
 </article></>;
}
