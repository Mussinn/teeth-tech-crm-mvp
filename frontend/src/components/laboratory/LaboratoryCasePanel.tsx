'use client';
import {useState} from 'react';
import {labCaseGuide, type LabGuide} from './labCaseGuide';
import LabActionDialog from './LabActionDialog';
import {useGetTechnicalCatalogQuery} from '@/src/services/api/technicalCatalogApi';
import {useGetOrderStatusesQuery} from '@/src/services/api/workflowApi';
import {useSelector} from 'react-redux';
import type {RootState} from '@/src/lib/store';
import type {LabCase,LabDetails} from '@/src/types/laboratoryCase.types';
import {useGetLaboratoryCaseQuery,useLaboratoryActionMutation} from '@/src/services/api/laboratoryCaseApi';
export const labActionLabels:Record<string,string>={SAVE:'Задание обновлено',ACCEPT:'Задание принято',HOLD:'Ожидание',RESUME:'Работа возобновлена',APPROVE_DESIGN:'Дизайн согласован',QC_PASS:'Качество подтверждено',QC_FAIL:'Проверка не пройдена',DISPATCH:'Изделие выдано/отправлено',DELIVER:'Получено клиникой',RETURN:'Возврат',QC_INVALIDATED:'Требуется повторная проверка'};
export const labReasonLabels:Record<string,string>={LAB_ERROR:'Ошибка лаборатории',CLINIC_CHANGE:'Изменение задания клиники',NEW_RECORDS:'Новые сканы/оттиски',FIT_SHADE:'Посадка, прикус или цвет',TRANSPORT_DAMAGE:'Повреждение при доставке',OTHER:'Другая причина'};
export function labError(error:unknown):string {
 if(typeof error==='object'&&error!==null&&'data'in error){const d=error.data;if(typeof d==='object'&&d!==null&&'message'in d&&typeof d.message==='string')return d.message;}
 return 'Не удалось сохранить действие. Обновите карточку и попробуйте снова.';
}
const intakeItems=[['prescription','Задание врача, зубы и конструкция сверены'],['records','Качество и комплектность сканов/оттисков проверены'],['components','Полученные компоненты и принадлежности сверены']];
const qualityItems=[['prescription','Соответствие заданию'],['fit','Посадка и прилегание'],['function','Контакты и функция'],['appearance','Цвет и внешний вид'],['traceability','Материалы и компоненты прослеживаются']];
const dispatchItems=[['identity','Изделие, пациент и клиника сверены'],['packaging','Упаковка проверена'],['disinfection','Обработка по протоколу лаборатории выполнена'],['documents','Сопроводительные документы и принадлежности вложены']];
const inputClass='w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100';
function Checkboxes({items,values,onChange}:{items:string[][];values:Record<string,string>;onChange:(key:string,value:string)=>void}){
 return <div className="space-y-2">{items.map(([key,label])=><label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={values[key]==='PASS'} onChange={e=>onChange(key,e.target.checked?'PASS':'')}/>{label}</label>)}</div>;
}
export default function LaboratoryCasePanel({orderId}:{orderId:string}){
 const q=useGetLaboratoryCaseQuery(orderId);
 if(q.isLoading)return <p>Загрузка лабораторного задания…</p>;
 if(q.isError||!q.data)return <section className="rounded-xl border p-4"><p role="alert">Не удалось загрузить лабораторное задание.</p><button onClick={()=>q.refetch()} className="text-violet-600">Повторить</button></section>;
 return <LoadedCase key={q.data.version} data={q.data} refresh={()=>q.refetch()}/>;
}
function LoadedCase({data,refresh}:{data:LabCase;refresh:()=>unknown}){
 const {data:implants=[]}=useGetTechnicalCatalogQuery('implants');
 const {data:models=[]}=useGetTechnicalCatalogQuery('model-systems');
 const {data:toothSets=[]}=useGetTechnicalCatalogQuery('tooth-sets');
 const {data:shades=[]}=useGetTechnicalCatalogQuery('shade-systems');
 const {roles,role}=useSelector((s:RootState)=>s.auth);
 const codes=(roles.length?roles:role?[role]:[]).map(r=>r.replace(/^ROLE_/,'').toUpperCase());
 const canQuality=codes.includes('ADMIN')||codes.includes('CHIEF_TECHNICIAN');
 const canLogistics=codes.includes('ADMIN')||codes.includes('DISPATCHER');
 const [act,status]=useLaboratoryActionMutation();const state=data.state;
 const {data:statuses=[]}=useGetOrderStatusesQuery();
 const [details,setDetails]=useState<LabDetails>(state.details);
 const guide=labCaseGuide(data);
 const [expanded,setExpanded]=useState<string>(guide.target);
 const [pending,setPending]=useState<{name:string;checks?:Record<string,string>}|null>(null);
 const [intake,setIntake]=useState<Record<string,string>>({});const [quality,setQuality]=useState<Record<string,string>>({});const [packing,setPacking]=useState<Record<string,string>>({});const [error,setError]=useState('');
 const dirty=JSON.stringify(details)!==JSON.stringify(state.details);const locked=['SHIPPED','DELIVERED'].includes(state.delivery);
 const disabled=status.isLoading||dirty;
 function change<K extends keyof LabDetails>(key:K,value:LabDetails[K]){setDetails({...details,[key]:value});}
 async function action(name:string,checks?:Record<string,string>,fields?:{note:string;clinician:string;recipient:string;tracking:string;reason:string}){
  setError('');try{await act({orderId:data.orderId,version:data.version,action:name,details:name==='SAVE'?details:undefined,checks,...fields}).unwrap();setPending(null);}
  catch(e){setError(labError(e));}
 }
 const button=(name:string,label:string,checks?:Record<string,string>,blocked=false)=><button type="button" disabled={disabled||blocked} onClick={()=>{setError('');if(name==='ACCEPT')void action(name,checks);else setPending({name,checks});}} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${['ACCEPT','QC_PASS','DISPATCH','DELIVER'].includes(name)?'bg-violet-600 text-white hover:bg-violet-700':'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>;
 function openSection(target:LabGuide['target']) {
  setExpanded(target);
  if(target==='production')document.querySelector('[data-lab-tasks]')?.scrollIntoView({behavior:'smooth',block:'start'});
  else document.getElementById(`lab-${data.orderId}-${target}`)?.scrollIntoView({behavior:'smooth',block:'center'});
 }
 const disclosure=(key:string,title:string)=><summary onClick={e=>{e.preventDefault();setExpanded(expanded===key?'':key);}} className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-800"><span>{title}</span><span aria-hidden="true" className="text-violet-500">{expanded===key?'−':'+'}</span></summary>;
 const intakeKeys=details.channel==='DIGITAL'?['prescription','records','components']:['prescription','records','components','disinfection'];
 const intakeDone=intakeKeys.filter(key=>intake[key]==='PASS').length;
 const qualityDone=qualityItems.filter(([key])=>quality[key]==='PASS'||!['prescription','traceability'].includes(key)&&quality[key]==='NA').length;
 const packingDone=dispatchItems.filter(([key])=>packing[key]==='PASS').length;
 const qualityBlocked=!data.productionReady||state.intake!=='ACCEPTED'||state.onHold;
 const releaseBlocked=qualityBlocked||state.quality!=='PASSED'||data.openIncidents||(details.designRequired&&state.design!=='APPROVED');
 const when=(raw?:string)=>raw?new Date(raw).toLocaleString('ru-RU',{timeZone:'Asia/Aqtobe'}):'—';
 return <section className="space-y-5 rounded-2xl border border-violet-200 bg-white p-4 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Приёмка и передача заказа</h2><p className="mt-1 text-sm text-slate-500">Каждый шаг — с ответственным и понятным результатом.</p></div><button type="button" onClick={refresh} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Обновить</button></header>
  <nav aria-label="Путь заказа" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([{key:'intake',label:'Приёмка',done:state.intake==='ACCEPTED'},{key:'production',label:'Производство',done:data.productionReady},{key:'quality',label:'Проверка качества',done:state.quality==='PASSED'},{key:'delivery',label:'Передача клинике',done:state.delivery==='DELIVERED'}] as const).map((step,index)=><button key={step.key} type="button" onClick={()=>openSection(step.key)} aria-current={guide.step===step.key?'step':undefined} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-semibold ${guide.step===step.key?'border-violet-300 bg-violet-50 text-violet-700':step.done?'border-emerald-100 bg-emerald-50 text-emerald-700':'border-slate-100 bg-slate-50 text-slate-500'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">{step.done?'✓':index+1}</span><span>{step.label}<span className="mt-1 block text-[10px] font-normal">{step.done?'Выполнено':guide.step===step.key?'Текущий шаг':'Далее'}</span></span></button>)}</nav>
  <section aria-label="Что делать сейчас" className={`rounded-2xl border p-5 ${state.onHold||data.openIncidents||state.quality==='FAILED'?'border-amber-200 bg-amber-50/60':'border-violet-100 bg-violet-50/50'}`}>
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Что нужно сейчас</p><h3 className="mt-2 text-lg font-bold text-slate-950">{guide.title}</h3></div><span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-600">Ответственный: {guide.owner}</span></div>
   <ol className="mt-4 space-y-3">{guide.instructions.map((instruction,index)=><li key={instruction} className="flex gap-3 text-sm leading-relaxed text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-violet-600">{index+1}</span>{instruction}</li>)}</ol>
   <div className="mt-4 border-t border-violet-100 pt-4"><p className="text-xs leading-relaxed text-slate-500"><strong>После этого: </strong>{guide.result}</p><button type="button" onClick={()=>openSection(guide.target)} className="mt-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">{guide.action}</button></div>
   <p className="mt-3 text-xs text-slate-500">{guide.target==='quality'&&!canQuality?'Ваша роль не подтверждает качество. Передайте заказ главному технику или администратору.':(guide.target==='delivery'||guide.step==='intake')&&!canLogistics?'Приёмку и передачу оформляет диспетчер или администратор.':guide.step==='production'?'Вы завершаете только назначенные вам этапы. Диспетчер координирует работу команды.':''}</p>
  </section>
  {error&&!pending&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
  <details id={`lab-${data.orderId}-brief`} open={expanded==='brief'} className="rounded-xl border border-slate-200 p-4">{disclosure('brief','Задание врача · посмотреть или изменить')}<p className="mt-3 text-xs text-slate-500">Заполните фактически полученные данные. Изменение клинического задания отменяет приёмку и согласование: их потребуется подтвердить снова. Изменение материалов / партий требует новой проверки качества.</p>
   <fieldset disabled={locked||status.isLoading} className="mt-4 grid gap-4 sm:grid-cols-2">
    <label className="text-sm">Получение данных<select value={details.channel} onChange={e=>change('channel',e.target.value)} className={inputClass}><option value="DIGITAL">Цифровые сканы</option><option value="PHYSICAL">Оттиски / физические материалы</option><option value="HYBRID">Смешанный комплект</option></select></label>
    <label className="text-sm">Тип изделия<select value={details.family} onChange={e=>change('family',e.target.value)} className={inputClass}><option value="FIXED">Коронки / мосты</option><option value="REMOVABLE">Съёмные протезы</option><option value="IMPLANT">Имплантные конструкции</option><option value="ORTHODONTIC">Ортодонтия / каппы</option><option value="OTHER">Другое</option></select></label>
    <label className="text-sm sm:col-span-2">Задание врача и особые требования<textarea maxLength={8000} value={details.prescription} onChange={e=>change('prescription',e.target.value)} className={inputClass}/></label>
    <label className="text-sm">Дата приёма пациента<input type="date" value={details.appointment} onChange={e=>change('appointment',e.target.value)} className={inputClass}/><span className="text-xs text-slate-500">Срок производства задаётся отдельно в заказе.</span></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={details.rush} onChange={e=>change('rush',e.target.checked)}/>Срочный заказ</label>
    {details.family==='IMPLANT'&&<><label className="text-sm">Система импланта<input list="implant-catalog" maxLength={8000} value={details.implantSystem} onChange={e=>change('implantSystem',e.target.value)} className={inputClass}/></label><label className="text-sm">Платформа / соединение<input maxLength={8000} value={details.implantPlatform} onChange={e=>change('implantPlatform',e.target.value)} className={inputClass}/></label></>}
    <datalist id="implant-catalog">{implants.filter(e=>e.isActive).map(e=><option key={e.id} value={[e.name,e.code,e.description].filter(Boolean).join(' · ')}/>)}</datalist>
    <label className="text-sm">Модельная система<input list="model-catalog" value={details.modelSystem??''} maxLength={8000} onChange={e=>change('modelSystem',e.target.value)} className={inputClass}/></label><datalist id="model-catalog">{models.filter(e=>e.isActive).map(e=><option key={e.id} value={[e.name,e.code,e.description].filter(Boolean).join(' · ')}/>)}</datalist>
    <label className="text-sm">Система расцветки<input list="shade-catalog" value={details.shadeSystem??''} maxLength={8000} onChange={e=>change('shadeSystem',e.target.value)} className={inputClass}/></label><datalist id="shade-catalog">{shades.filter(e=>e.isActive).map(e=><option key={e.id} value={[e.name,e.code,e.description].filter(Boolean).join(' · ')}/>)}</datalist>
    {details.family==='REMOVABLE'&&<label className="text-sm">Гарнитура зубов<input list="tooth-set-catalog" value={details.toothSet??''} maxLength={8000} onChange={e=>change('toothSet',e.target.value)} className={inputClass}/></label>}<datalist id="tooth-set-catalog">{toothSets.filter(e=>e.isActive).map(e=><option key={e.id} value={[e.name,e.code,e.description].filter(Boolean).join(' · ')}/>)}</datalist>
    <label className="text-sm">Цвет, культя, фотографии, особенности<textarea maxLength={8000} value={details.shadeNotes} onChange={e=>change('shadeNotes',e.target.value)} className={inputClass}/></label>
    <label className="text-sm">Полученные оттиски, модели и компоненты<textarea maxLength={8000} value={details.incomingItems} onChange={e=>change('incomingItems',e.target.value)} className={inputClass}/></label>
    <label className="text-sm">Материалы, партии и серийные номера<textarea maxLength={8000} value={details.batchReferences} onChange={e=>change('batchReferences',e.target.value)} className={inputClass}/><span className="text-xs text-slate-500">Например: материал, изготовитель, LOT; абатмент и серийный номер. Это прослеживаемость изделия.</span></label>
    <label className="text-sm">Адрес и способ передачи клинике<textarea maxLength={8000} value={details.shippingAddress} onChange={e=>change('shippingAddress',e.target.value)} className={inputClass}/></label>
    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={details.designRequired} onChange={e=>change('designRequired',e.target.checked)}/>Требуется согласование дизайна / примерки с врачом</label>
    {details.designRequired&&<label className="text-sm sm:col-span-2">Не выпускать с этапа без согласования<select value={details.approvalGateStatusId} onChange={e=>change('approvalGateStatusId',e.target.value)} className={inputClass}><option value="">Перед завершением производства</option>{statuses.filter(s=>s.active!==false&&!s.terminal).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="text-xs text-slate-500">Выберите этап своего маршрута, например моделирование. Подготовительные этапы можно выполнять до согласования.</span></label>}
    <button type="button" onClick={()=>action('SAVE')} disabled={!dirty||status.isLoading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Сохранить задание</button>
   </fieldset>
  </details>
  {dirty&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Есть несохранённые изменения. Вернитесь в задание врача и нажмите «Сохранить задание», чтобы продолжить.</p>}

  {!locked&&<>
   <details id={`lab-${data.orderId}-intake`} open={expanded==='intake'} className="rounded-xl border border-slate-200 p-4">{disclosure('intake','Входной контроль и согласование')}<div className="mt-4 space-y-4">
    {canLogistics&&<><p className="text-sm text-slate-500">Сначала проверьте задание врача и комплект данных. Если нужно изменить задание, нажмите «Открыть задание врача». Галочки означают выполненную проверку, а не план работы.</p><button type="button" onClick={()=>openSection('brief')} className="text-sm font-semibold text-violet-600">Открыть задание врача</button><Checkboxes items={details.channel==='DIGITAL'?intakeItems:[...intakeItems,['disinfection','Обработка входных материалов по протоколу подтверждена']]} values={intake} onChange={(k,v)=>setIntake({...intake,[k]:v})}/><p className="text-xs text-slate-500">{state.onHold?'Сначала устраните причину и снимите ожидание.':!details.prescription.trim()?'Сначала заполните и сохраните задание врача.':`Выполнено проверок: ${intakeDone} из ${intakeKeys.length}. Отметьте все пункты, чтобы принять задание.`}</p>{state.intake!=='ACCEPTED'?button('ACCEPT','Принять задание',intake,state.onHold||intakeDone!==intakeKeys.length||!details.prescription.trim()||(details.family==='IMPLANT'&&(!details.implantSystem.trim()||!details.implantPlatform.trim()))):<p className="text-sm font-semibold text-emerald-700">Задание принято. Повторная приёмка сейчас не нужна.</p>}</>}
    <div className="flex flex-wrap gap-3">{state.onHold?button('RESUME','Снять ожидание'):button('HOLD','Поставить на ожидание')}</div>
    {details.designRequired&&<div className="space-y-2"><p className="text-sm">{state.design==='APPROVED'?`Согласовано: ${state.designApprovedBy}`:'Нужно подтверждение врача. Укажите его имя и основание в комментарии; файлы прикрепляйте к задаче.'}</p>{state.design!=='APPROVED'&&button('APPROVE_DESIGN','Зафиксировать согласование',undefined,state.intake!=='ACCEPTED'||state.onHold)}</div>}
   </div></details>
   {canQuality&&<details id={`lab-${data.orderId}-quality`} open={expanded==='quality'} className="rounded-xl border border-slate-200 p-4">{disclosure('quality','Контроль качества перед выдачей')}<div className="mt-4 space-y-3"><p className="text-sm text-slate-500">Проверку выполняет ответственный техник по правилам вашей лаборатории. Для неприменимого пункта выберите «Н/П» и поясните в комментарии.</p>{qualityItems.map(([key,label])=><label key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">{label}<select aria-label={`Качество: ${label}`} className="rounded-lg border p-2" value={quality[key]??''} onChange={e=>setQuality({...quality,[key]:e.target.value})}><option value="">Не проверено</option><option value="PASS">Проверено</option>{!['prescription','traceability'].includes(key)&&<option value="NA">Н/П</option>}</select></label>)}<p className="text-xs text-slate-500">{qualityBlocked?'Проверка доступна после приёмки, снятия ожидания и завершения всех работ.':data.openIncidents?'Подтверждение заблокировано: закройте открытые инциденты качества.':details.designRequired&&state.design!=='APPROVED'?'Подтверждение заблокировано: нужно согласование врача.':!details.batchReferences.trim()?'Укажите материалы, партии или серийные номера в задании врача.':`Выполнено проверок: ${qualityDone} из 5. Заполните все пункты, затем подтвердите результат.`}</p><button type="button" onClick={()=>openSection('brief')} className="text-sm font-semibold text-violet-600">Посмотреть материалы и задание</button><div className="flex flex-wrap gap-3">{button('QC_PASS','Подтвердить качество',quality,qualityBlocked||data.openIncidents||(details.designRequired&&state.design!=='APPROVED')||!details.batchReferences.trim()||qualityDone!==qualityItems.length)}{button('QC_FAIL','Проверка не пройдена',undefined,qualityBlocked)}</div></div></details>}
  </>}
  {!canQuality&&expanded==='quality'&&<section id={`lab-${data.orderId}-quality`} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Контроль качества</h3><p className="mt-2 text-sm text-slate-500">Подтверждает главный техник или администратор после завершения всех работ. Ваша роль не выполняет это действие. Текущий результат: {state.quality==='PASSED'?'проверка пройдена':state.quality==='FAILED'?'проверка не пройдена':'ещё не подтверждён'}.</p></section>}
  {!canLogistics&&expanded==='delivery'&&<section id={`lab-${data.orderId}-delivery`} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Передача клинике</h3><p className="mt-2 text-sm text-slate-500">Выдачу и подтверждение получения оформляет диспетчер или администратор. Передайте ему готовый заказ после успешной проверки качества.</p></section>}
  {canLogistics&&<details id={`lab-${data.orderId}-delivery`} open={expanded==='delivery'} className="rounded-xl border border-slate-200 p-4">{disclosure('delivery','Передача клинике')}<div className="mt-4 space-y-3">
   {!locked&&<><p className="text-sm text-slate-500">{releaseBlocked?'Сначала завершите приёмку, производство и успешную проверку качества, снимите ожидание и закройте инциденты.':'Готово к передаче. Выполните четыре проверки, затем укажите получателя в окне оформления.'}</p><Checkboxes items={dispatchItems} values={packing} onChange={(k,v)=>setPacking({...packing,[k]:v})}/><p className="text-xs text-slate-500">Подготовлено: {packingDone} из 4 пунктов.</p>{button('DISPATCH','Оформить выдачу / отправку',packing,releaseBlocked||packingDone!==dispatchItems.length)}</>}
   {state.delivery==='SHIPPED'&&button('DELIVER','Подтвердить получение клиникой')}
   {locked&&<div className="rounded-xl bg-slate-50 p-3"><p className="mb-2 text-xs text-slate-500">Возврат оформляется только при проблеме с уже переданным изделием. Не используйте его для обычного продолжения производства.</p>{button('RETURN','Оформить возврат')}</div>}
   <p className="text-xs text-slate-500">Выдача: {when(state.shippedAt)}. Получение: {when(state.deliveredAt)}. {state.recipient&&`Получатель: ${state.recipient}.`} {state.tracking&&`Реквизиты: ${state.tracking}`}</p>
  </div></details>}
  <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"><summary className="cursor-pointer font-semibold text-slate-600">Как проходит заказ · памятка для команды</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{[
   ['1. Диспетчер принимает','Проверяет задание врача и входные данные. При нехватке данных ставит ожидание. После фактической проверки принимает задание.'],
   ['2. Техники выполняют этапы','В своём рабочем экране открывают назначенную работу, выполняют этап и передают дальше. Руководитель контролирует срок и ответственных.'],
   ['3. Врач согласует, если нужно','Диспетчер или ответственный техник получает подтверждение и записывает врача и основание. Это нужно только для задания с обязательным согласованием.'],
   ['4. Главный техник проверяет','После завершения производства проверяет качество и прослеживаемость. При дефекте фиксирует отказ и организует исправление через задачи.'],
   ['5. Диспетчер передаёт клинике','Проверяет комплект, оформляет фактическую выдачу. Когда клиника получит изделие, отдельно записывает получателя и подтверждение.'],
   ['Если заказ вернули','Диспетчер записывает причину возврата. Задание снова проходит приёмку и проверку. Этапы переделки выбираются в задачах; возврат не переводит их автоматически.'],
  ].map(([title,text])=><article key={title} className="rounded-xl bg-white p-4"><h4 className="text-sm font-semibold text-slate-800">{title}</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p></article>)}</div></details>
  <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-slate-600">История приёма, согласований и выдачи</summary><div className="mt-4 space-y-3"><p className="text-xs text-slate-500">Последние 100 действий. Полная история сохраняется в системе.</p>{data.events.length===0?<p className="text-sm text-slate-500">Действий ещё нет.</p>:data.events.map(e=><article key={e.id} className="border-b pb-3 text-sm"><strong>{labActionLabels[e.action]??e.action}</strong><p className="text-xs text-slate-500">{e.actor} · {when(e.createdAt)}</p>{e.details.note&&<p className="mt-1 whitespace-pre-wrap">{e.details.note}</p>}{e.details.reason&&e.action==='RETURN'&&<p>{labReasonLabels[e.details.reason]??e.details.reason}</p>}</article>)}</div></details>
  {pending&&<LabActionDialog key={pending.name} action={pending.name} loading={status.isLoading} error={error} reasons={labReasonLabels} onCancel={()=>{setPending(null);setError('');}} onConfirm={fields=>{void action(pending.name,pending.checks,fields);}}/>}
 </section>;
}
