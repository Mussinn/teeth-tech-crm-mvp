'use client';
import Link from 'next/link';
import AppIcon, {type AppIconName} from '@/src/components/ui/AppIcon';
import {useSelector} from 'react-redux';
import type {RootState} from '@/src/lib/store';
import {normalizeAuthRoles} from '@/src/features/auth/authUtils';
const groups=[
 {title:'Команда и ответственность',note:'Кто работает в лаборатории и за что отвечает',items:[['Сотрудники','Учётные записи, специализации и нагрузка','employees'],['Роли и доступ','Права сотрудников в системе','roles']]},
 {title:'Данные для нарядов',note:'Заполните один раз — используйте при создании работ',items:[['Виды работ','Изделия и последовательность изготовления','work-types'],['Материалы','Материалы изделий и их артикулы','materials'],['Цвета','Оттенки, которые выбираются в задачах','colors'],['Технические справочники','Импланты, модели, гарнитуры и расцветки','catalogs']]},
 {title:'Настройка производства',note:'Маршруты работы под процессы вашей лаборатории',items:[['Статусы','Рабочие этапы: включить или отключить','statuses'],['Направления работ','Специализации и распределение задач','work-directions']]},
];
const icons:Record<string,AppIconName>={employees:'community',roles:'roles','work-types':'work',materials:'materials',colors:'colors',catalogs:'catalogs',statuses:'statuses','work-directions':'directions'};
export default function LaboratoryPage(){
 const auth=useSelector((s:RootState)=>s.auth);const roles=normalizeAuthRoles(auth.roles.length?auth.roles:auth.role?[auth.role]:[]);const admin=roles.includes('ADMIN');const chief=roles.includes('CHIEF_TECHNICIAN')||roles.includes('HEAD_TECHNICIAN');
 return <div className="experience-page space-y-6"><header className="experience-hero"><p className="experience-eyebrow">НАСТРОЙКИ ЛАБОРАТОРИИ</p><h1 className="text-3xl font-bold">Лаборатория</h1><p className="mt-3">Команда, справочники и маршруты производства. Выберите нужную группу — всё необходимое рядом.</p></header>
 <div className="lab-work-notice"><div><h2 className="font-bold">Принимаете или выдаёте заказ?</h2><p className="mt-1 text-sm text-slate-500">Для ежедневной работы используйте отдельную очередь заказов.</p></div><Link href="/laboratory/cases" className="lab-primary-link">Открыть приём и выдачу →</Link></div>
 {groups.map(group=>{const items=group.items.filter(([, ,route])=>route==='roles'?admin||chief:['statuses','work-directions'].includes(route)?admin:true);return items.length>0&&<section key={group.title} className="space-y-4"><div><h2 className="text-lg font-bold">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.note}</p></div><div className="grid gap-3 sm:grid-cols-2">{items.map(([title,note,route])=><Link key={route} href={`/laboratory/${route}`} className="lab-hub-card"><div className="flex min-w-0 items-center gap-4"><span className="lab-module-icon"><AppIcon name={icons[route]}/></span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-500">{note}</p></div></div><AppIcon name="arrow" className="h-4 w-4 text-violet-500"/></Link>)}</div></section>})}</div>;
}
