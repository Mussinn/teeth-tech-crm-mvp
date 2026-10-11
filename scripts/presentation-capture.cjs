const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'presentation/assets'),runtime=path.join(root,'saas/.saas-runtime/presentation-demo');fs.mkdirSync(out,{recursive:true});
const base='http://lab1.localhost:18192';
const db=(sql,database='teethtech_mvp')=>execFileSync('docker',['compose','-f',path.join(runtime,'compose.json'),'exec','-T','postgres','psql','-U','mvp','-d',database,'-At','-c',sql],{encoding:'utf8'}).trim();
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const contexts=new Map();async function login(email,password){if(contexts.has(email))return contexts.get(email);const ctx=await b.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'});const r=await ctx.request.post(base+'/api/backend/auth/sessions',{headers:{Origin:base},data:{email,password}});if(!r.ok())throw Error('Demo login failed: '+r.status());contexts.set(email,ctx);return ctx;}
 const admin=await login('admin@teethtech.kz','DemoLab2026!');
 async function api(url,method='GET',data,ctx=admin){const r=await ctx.request.fetch(base+'/api/backend'+url,{method,data,headers:method==='GET'?{}:{Origin:base}});if(!r.ok())throw Error(method+' '+url+' '+r.status()+' '+await r.text());return r.status()===204?null:r.json();}
 const list=x=>Array.isArray(x)?x:x.content;
 const manifest=path.join(runtime,'seed.json');let demo;
 if(!fs.existsSync(manifest)){
  if(Number(db('SELECT count(*) FROM t_orders WHERE deleted_at IS NULL'))!==0)throw Error('Demo contains orders without seed manifest; reset only the demo installation before reseeding.');
  db("UPDATE t_clinics SET deleted_at=now() WHERE deleted_at IS NULL; UPDATE t_users SET name=CASE email WHEN 'admin@teethtech.kz' THEN 'Демо · Руководитель' WHEN 'dispatcher@teethtech.kz' THEN 'Демо · Айдана, диспетчер' WHEN 'plasterer@teethtech.kz' THEN 'Демо · Ерлан, гипсовщик' WHEN 'scanner@teethtech.kz' THEN 'Демо · Дана, сканирование' WHEN 'operator@teethtech.kz' THEN 'Демо · Арман, CAD/CAM' WHEN 'ceramist@teethtech.kz' THEN 'Демо · Алия, керамист' WHEN 'prosthetist@teethtech.kz' THEN 'Демо · Марат, протезист' ELSE 'Демо · сотрудник' END;");
  const clinics=[];for(const name of ['Демо · Dent Avenue','Демо · Smile Studio','Демо · Aru Dental']){const c=await api('/clinics','POST',{name,address:'Учебный адрес · Казахстан',contactPerson:'Демо · администратор'});clinics.push(c.id||c.clinicId||c);}
  const work=await api('/admin/workflow/work-types','POST',{workTypeCode:'DEMO_ZIRCONIA',workTypeName:'Циркониевая коронка · демо',description:'Демонстрационный маршрут',stages:[{code:'SCANNING',name:'Сканирование',requiredRole:'ROLE_SCANNER',colorHex:'#0ea5e9'},{code:'MODELING',name:'CAD-моделирование',requiredRole:'ROLE_OPERATOR',colorHex:'#8b5cf6'},{code:'MILLING',name:'Фрезеровка',requiredRole:'ROLE_OPERATOR',colorHex:'#f59e0b'},{code:'CERAMICS',name:'Керамика и финиш',requiredRole:'ROLE_CERAMIST',colorHex:'#10b981'}]});
  const directions=list(await api('/work-directions')),materials=list(await api('/materials')),colors=list(await api('/colors'));const statuses=await api('/order-statuses');const route=['SCANNING','MODELING','MILLING','CERAMICS','WAITING_FOR_APPROVAL','ORDER_CLOSED'];
  const orders=[];const progresses=[0,1,2,3,4,5,6,6,6,6,2,3];
  for(let i=0;i<progresses.length;i++){
   const date=new Date(Date.now()+(i===0?-2:(i%6+1))*86400000).toISOString().slice(0,10);
   const o=await api('/orders','POST',{clinicId:clinics[i%3],patientFullName:'Демо-пациент '+String(i+1).padStart(2,'0'),newPatient:true,doctorFullName:'Демо · врач '+(i%3+1),deadline:date,comment:'Вымышленный заказ для презентации. Данные не относятся к реальным пациентам.',tasks:[{workDirectionId:directions.find(d=>d.code==='ORTHOPEDICS').id,workTypeId:work.workTypeId,quantity:i%3+1,toothNumbers:[11+i%7],colorId:colors[i%colors.length].id,materialIds:[materials.find(m=>m.name==='Диоксид циркония').id],pricePerUnit:0,discountPercent:0}]});orders.push(o);
   let lab=await api('/orders/'+o.id+'/laboratory');lab=await api('/orders/'+o.id+'/laboratory/actions','POST',{version:lab.version,action:'SAVE',details:{channel:'DIGITAL',family:'FIXED',prescription:'Циркониевая конструкция по цифровому скану. Учебное задание.',batchReferences:'DEMO-ZR-LOT-2026'}});
   if(progresses[i]>0){lab=await api('/orders/'+o.id+'/laboratory/actions','POST',{version:lab.version,action:'ACCEPT',checks:{prescription:'PASS',records:'PASS',components:'PASS'}});}
   for(let n=0;n<progresses[i];n++){
    const email=n===0?'dispatcher@teethtech.kz':db("SELECT u.email FROM t_order_tasks t JOIN t_users u ON u.id=t.dental_technician_id WHERE t.id='"+o.taskIds[0]+"'");
    const ctx=await login(email,'DemoTeam2026!');await api('/tasks/'+o.taskIds[0]+'/status','PATCH',{nextStatusId:statuses.find(s=>s.code===route[n]).id},ctx);
   }
   if(i===1){lab=await api('/orders/'+o.id+'/laboratory');await api('/orders/'+o.id+'/laboratory/actions','POST',{version:lab.version,action:'HOLD',note:'Ожидаем уточнение оттенка от врача · демонстрация'});}
  }
  await api('/personal-notes','POST',{title:'План утреннего разбора',content:'Проверить сроки сдачи, распределить CAD/CAM и согласовать оттенок по заказу Smile Studio. Учебная заметка.'});
  await api('/personal-notes','POST',{title:'Первый показ лаборатории',content:'Пройти путь: заказ → входной контроль → этапы → KPI → выдача. Все данные в этой установке вымышленные.'});
  demo={orders,workTypeId:work.workTypeId,createdAt:new Date().toISOString()};fs.writeFileSync(manifest,JSON.stringify(demo,null,2),{mode:0o600});
 }else demo=JSON.parse(fs.readFileSync(manifest));
 db("UPDATE t_order_tasks SET work_direction_id=(SELECT id FROM t_work_directions WHERE code='ORTHOPEDICS' AND deleted_at IS NULL LIMIT 1); UPDATE t_order_task_materials SET material_id=(SELECT id FROM t_materials WHERE name='Диоксид циркония' AND deleted_at IS NULL LIMIT 1); UPDATE t_order_tasks SET price_per_unit=25000 WHERE deleted_at IS NULL; UPDATE t_orders o SET total_amount=(SELECT coalesce(sum(t.total_task),0) FROM t_order_tasks t WHERE t.order_id=o.id AND t.deleted_at IS NULL) WHERE o.deleted_at IS NULL;");
 const p=await admin.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // UI login initializes the Redux identity used by navigation.
 await p.goto(base+'/auth/login');await p.locator('input[type=email]').fill('admin@teethtech.kz');await p.locator('input[type=password]').fill('DemoLab2026!');await p.locator('button[type=submit]').click();await p.waitForURL('**/orders');await p.keyboard.press('Escape');
 async function shot(route,name){await p.goto(base+route);await p.locator('main').first().waitFor();await p.waitForTimeout(900);const content=p.locator('[data-tour="app-content"]');if(await content.count())await content.evaluate(e=>e.scrollTop=0);await p.screenshot({path:path.join(out,name+'.png')});}
 await shot('/orders','orders');await shot('/orders/'+demo.orders[3].id,'order');await shot('/laboratory/cases','intake');await shot('/kpi','kpi');await shot('/training','training');await shot('/notes','notes');await shot('/laboratory','laboratory');await shot('/laboratory/work-types','work-types');
 await p.locator('[data-tour="work-type-create"]').click();await p.getByRole('button',{name:'Циркониевая коронка / мост',exact:true}).click();await p.screenshot({path:path.join(out,'workflow.png')});await p.keyboard.press('Escape');
 await p.setViewportSize({width:390,height:844});await shot('/orders','mobile-orders');
 await p.setViewportSize({width:1440,height:1000});
 await p.goto(base+'/support');await p.getByRole('heading',{name:'Поддержка',exact:true}).waitFor();
 const supportTopic='Как настроить маршрут циркониевой работы?';
 if(Number(db('SELECT count(*) FROM saas_support_tickets','presentation_saas'))===0){
  await p.getByLabel('Тема заявки').fill(supportTopic);await p.getByLabel('Описание проблемы').fill('Демонстрационная заявка: хотим добавить спекание после фрезеровки и назначить ответственного техника.');await p.getByRole('button',{name:'Отправить заявку',exact:true}).click();await p.getByLabel('Ответ в поддержку').waitFor();
 }
 const owner=await b.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'});const q=await owner.newPage();await q.goto('http://localhost:18192');await q.locator('#login-form input[name=email]').fill('owner@demo.local');await q.locator('#login-form input[name=password]').fill('DemoOwner2026!');await q.locator('#login-form button').click();await q.locator('#dashboard').waitFor();
 await q.locator('#support-list button').filter({hasText:supportTopic}).first().click();await q.locator('#support-reply textarea').fill('Откройте Лаборатория → Виды работ → Создать тип работы. Выберите заготовку циркониевой коронки, проверьте этап Спекание и назначьте роль сотрудника. Это учебный ответ поддержки.');await q.locator('#support-reply select').selectOption('RESOLVED');await q.locator('#support-reply button').click();await q.locator('#support-detail').getByText('Это учебный ответ поддержки.',{exact:false}).first().waitFor();
 await p.getByRole('button',{name:'Обновить',exact:true}).click();await p.getByText('Решена',{exact:true}).first().waitFor();await p.screenshot({path:path.join(out,'support.png')});
 await p.goto(base+'/community');
 await Promise.race([p.getByLabel('Публичное название лаборатории').waitFor(),p.getByLabel('Тема публикации').waitFor()]);
 if(await p.getByLabel('Публичное название лаборатории').count()){
  await p.getByLabel('Публичное название лаборатории').fill('Демо · TeethTech Lab');await p.getByLabel('Город',{exact:true}).fill('Актобе');await p.locator('input[type=checkbox]').check();await p.getByRole('button',{name:'Присоединиться',exact:true}).click();
 }
 const communityTopic='Обмен опытом: нагрузка CAD/CAM';
 if(!await p.getByRole('heading',{name:communityTopic,exact:true}).count()){
  await p.getByLabel('Тема публикации').fill(communityTopic);await p.getByLabel('Текст публикации').fill('Учебное обсуждение: как вы планируете фрезеровку и распределяете срочные работы между техниками? В этом примере нет данных реальных пациентов.');await p.getByRole('button',{name:'Опубликовать',exact:true}).click();await p.getByRole('heading',{name:communityTopic,exact:true}).waitFor();await p.getByLabel('Комментарий',{exact:true}).fill('Демо: утром разбираем сроки, затем распределяем этапы по загрузке сотрудников.');await p.getByRole('button',{name:'Отправить',exact:true}).click();
 }
 await p.waitForTimeout(500);await p.screenshot({path:path.join(out,'community.png')});await q.locator('#refresh').click();await q.waitForTimeout(500);await q.screenshot({path:path.join(out,'saas-owner.png')});
 if(errors.length)throw Error('Browser errors: '+errors.join(';'));
 console.log('Presentation data and screenshots ready:',demo.orders.length,'fictional orders. Demo remains running on localhost:18190.');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
