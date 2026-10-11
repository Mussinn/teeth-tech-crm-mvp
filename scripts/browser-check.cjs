// Optional developer check: PLAYWRIGHT_MODULE must point to playwright-core.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
env.MVP_ADMIN_PASSWORD=process.env.MVP_SMOKE_ADMIN_PASSWORD||env.MVP_ADMIN_PASSWORD;
if(!env.MVP_ADMIN_PASSWORD)throw new Error('Set MVP_SMOKE_ADMIN_PASSWORD to the original administrator password for the full browser check.');
// This full exercise creates persistent training history; run it on an isolated training installation.
const base=process.env.MVP_SMOKE_URL||`http://127.0.0.1:${env.MVP_PORT||8090}`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU',permissions:['notifications']});
 context.setDefaultTimeout(20000);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync(path.join(root,'artifacts/screenshots'),{recursive:true});
 let createdOrder; let routeOrder; let adminCleanupContext;
 try{
  const loginPage=await page.goto(base+'/auth/login');assert.ok(loginPage.ok(),'Login page serves successfully');await page.locator('input[type=email]').fill('admin@teethtech.kz');
  await page.locator('input[type=password]').fill(env.MVP_ADMIN_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForURL('**/orders');await page.keyboard.press('Escape');
  await page.locator('main').waitFor({state:'visible'});
  assert.equal(await page.locator('nav a[href^="/warehouse"]').count(),0);
  assert.equal(await page.locator('nav a[href^="/accounting"]').count(),0);
  async function api(url,method='GET',data){const response=await context.request.fetch(base+'/api/backend'+url,{method,data,headers:method==='GET'?{}:{Origin:base}});assert.ok(response.ok(),`${method} ${url}: ${response.status()}`);return response.status()===204?null:response.json();}
  const unwrap=x=>Array.isArray(x)?x:x.content;
  async function acceptLab(id){
   let card=await api(`/orders/${id}/laboratory`);
   card=await api(`/orders/${id}/laboratory/actions`,'POST',{version:card.version,action:'SAVE',details:{channel:'DIGITAL',family:'FIXED',prescription:'Browser pilot prescription',batchReferences:'Zirconia LOT BROWSER-TEST'}});
   await api(`/orders/${id}/laboratory/actions`,'POST',{version:card.version,action:'ACCEPT',checks:{prescription:'PASS',records:'PASS',components:'PASS'}});
  }

  for(const [presetName, stageCount] of [['Керамическая коронка',2],['Цифровая коронка',3],['Циркониевая коронка / мост',5],['Пресс-керамика / винир',4],['Съёмный протез',4],['Работа на имплантах',4],['Временная коронка / мост',4],['Окклюзионная каппа',5],['Ремонт протеза',3]]){
   console.log('Checking preset:',presetName);
   await page.goto(base+'/laboratory/work-types');await page.locator('[data-tour="work-type-create"]').click();
   await page.getByRole('button',{name:presetName,exact:true}).click();
   await page.getByPlaceholder('CROWN',{exact:true}).fill('BROWSER_PRESET_'+Date.now());
   const workflowResponse=page.waitForResponse(r=>r.url().endsWith('/admin/workflow/work-types')&&r.request().method()==='POST');
   await page.locator('[data-tour="work-type-form"] button[type=submit]').click();
   const workflowCreated=await workflowResponse.catch(async error=>{console.log(await page.locator('[data-tour="work-type-form"]').innerText());throw error;});assert.equal(workflowCreated.status(),201);assert.equal((await workflowCreated.json()).steps.length,stageCount+2);
   await page.locator('[data-tour="work-type-form"]').waitFor({state:'hidden'});
  }

  await page.goto(base+'/laboratory/catalogs');
  await page.getByRole('heading',{name:'Технические справочники',exact:true}).waitFor();
  await page.getByLabel('Название',{exact:true}).fill('MVP_BROWSER_IMPLANT');
  await page.getByLabel('Марка / код',{exact:true}).fill('ACME-01');
  await page.getByLabel('Описание, изготовитель, платформа или параметры',{exact:true}).fill('Test manufacturer / platform');
  await page.getByRole('button',{name:'Добавить',exact:true}).click();
  await page.getByText('MVP_BROWSER_IMPLANT',{exact:true}).waitFor();
  const technicalEntries=await api('/implants');
  const testEntry=technicalEntries.find(e=>e.name==='MVP_BROWSER_IMPLANT');assert.ok(testEntry);
  await api('/implants/'+testEntry.id,'DELETE');
  const [clinics,directions,works,colors,materials]=await Promise.all(['/clinics','/work-directions','/work-types','/colors','/materials'].map(p=>api(p).then(unwrap)));
  let work=works.find(w=>w.code==='PHYSICAL'&&w.isActive);
  let plasteringCode='PLASTERING';
  if(!work){
   const suffix=Date.now();plasteringCode='PLASTERING';
   const template=await api('/admin/workflow/work-types','POST',{workTypeCode:`BROWSER_ROUTE_${suffix}`,workTypeName:'Учебный маршрут браузерной проверки',stages:[
    {code:plasteringCode,name:'Гипсовка',requiredRole:'ROLE_PLASTERER'},
    {code:'SCANNING',name:'Сканирование',requiredRole:'ROLE_SCANNER'},
    {code:'MODELING',name:'Моделирование',requiredRole:'ROLE_OPERATOR'},
    {code:'CERAMICS',name:'Керамика',requiredRole:'ROLE_CERAMIST'},
   ]});work={id:template.workTypeId};
  }
  createdOrder=await api('/orders','POST',{clinicId:clinics[0].id,patientFullName:'Учебный пациент браузерной проверки',doctorFullName:'Учебный врач',deadline:new Date().toISOString().slice(0,10),comment:'Автоматическая проверка MVP',tasks:[{workDirectionId:directions[0].id,workTypeId:work.id,quantity:1,toothNumbers:[11],colorId:colors[0].id,materialIds:[materials[0].id],pricePerUnit:0,discountPercent:0}]});
  await page.goto(base+'/orders');await page.locator('[data-tour="orders-create"]').click();
  await page.locator('[data-tour="order-customer"] select').first().selectOption(clinics[0].id);
  await page.getByPlaceholder('ФИО пациента',{exact:true}).fill('Учебный пациент браузерной проверки');
  const patientSelect=page.getByLabel('Карточка пациента',{exact:true});await patientSelect.locator('option').nth(1).waitFor({state:'attached'});
  const selectedPatient=await patientSelect.locator('option').nth(1).getAttribute('value');await patientSelect.selectOption(selectedPatient);
  await page.getByRole('link',{name:'Посмотреть историю выбранного пациента ↗',exact:true}).waitFor();
  const newPatient=page.getByRole('checkbox',{name:'Новый пациент — отдельная карточка',exact:true});await newPatient.check();await patientSelect.waitFor({state:'hidden'});await newPatient.uncheck();await patientSelect.waitFor();assert.equal(await patientSelect.inputValue(),'');
  await page.keyboard.press('Escape');

  await acceptLab(createdOrder.id);
  const taskId=createdOrder.taskIds[0];
  const upload=await context.request.post(base+`/api/backend/tasks/${taskId}/files/upload`,{headers:{Origin:base},multipart:{file:{name:'mvp-check.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nMVP test attachment\n')}}});
  assert.ok(upload.ok(),`file upload ${upload.status()}`);const attachment=await upload.json();
  const link=await api(`/tasks/${taskId}/files/${attachment.id}/url`);
  assert.ok(link.url.startsWith('/api/backend/'));
  const download=await context.request.get(base+link.url);assert.ok(download.ok());assert.ok((await download.body()).includes(Buffer.from('MVP test attachment')));
  await page.goto(base+`/orders/${createdOrder.id}`);await page.locator('main').waitFor({state:'visible'});
  await page.getByText(createdOrder.orderNumber,{exact:false}).first().waitFor();
  await page.getByText('Учебный врач',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Лабораторное задание и выдача',exact:true}).waitFor();
  await page.getByRole('link',{name:'Печатный наряд',exact:true}).click();
  await page.getByRole('button',{name:'Печать / PDF',exact:true}).waitFor();
  assert.ok(await page.locator('.print-sheet').innerText().then(t=>t.includes(createdOrder.orderNumber)));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.print-sheet h1').evaluate(e=>getComputedStyle(e).visibility),'visible','Printed order must remain visible');
  const orderPdf=await page.pdf({path:path.join(root,'artifacts','print-order-check.pdf'),format:'A4',preferCSSPageSize:true});
  assert.ok(orderPdf.length>5000,'Printed PDF must contain actual text');
  await page.evaluate(()=>{const body=document.querySelector('.print-sheet tbody');const row=body.querySelector('tr');for(let n=0;n<100;n++)body.appendChild(row.cloneNode(true));});
  const longPdf=await page.pdf({format:'A4',preferCSSPageSize:true});
  assert.ok((longPdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1,'Long print order spans multiple pages');
  await page.emulateMedia({media:'screen'});
  await page.goto(base+`/orders/${createdOrder.id}`);
  await page.getByRole('heading',{name:'Лабораторное задание и выдача',exact:true}).waitFor();

  await page.getByText('Входной контроль и согласование',{exact:true}).click();
  await page.getByLabel('Комментарий к действию',{exact:true}).fill('Ожидаем уточнение врача: проверка пилота');
  await page.getByRole('button',{name:'Поставить на ожидание',exact:true}).click();
  await page.getByText('Заказ на ожидании:',{exact:false}).waitFor();
  await page.getByText('Входной контроль и согласование',{exact:true}).click();
  await page.getByLabel('Комментарий к действию',{exact:true}).fill('Ответ врача получен: проверка пилота');
  await page.getByRole('button',{name:'Снять ожидание',exact:true}).click();
  await page.getByText('Заказ на ожидании:',{exact:false}).waitFor({state:'hidden'});
  const resumedCase=await api(`/orders/${createdOrder.id}/laboratory`);
  assert.equal(resumedCase.state.onHold,false);
  assert.ok(resumedCase.events.some(e=>e.action==='HOLD'));
  assert.ok(resumedCase.events.some(e=>e.action==='RESUME'));
  await page.screenshot({path:path.join(root,'artifacts/screenshots/order.png'),fullPage:true});
  await page.goto(base+'/kpi');await page.getByRole('heading',{name:'KPI сотрудников',exact:true}).waitFor();
  await page.locator('main').locator('table, p').filter({hasText:/Исполнитель|За этот период завершений ещё нет/}).first().waitFor();
  await page.screenshot({path:path.join(root,'artifacts/screenshots/kpi.png'),fullPage:true});
  await page.goto(base+'/training');await page.getByRole('heading',{name:'Первый рабочий день'}).waitFor();
  await page.screenshot({path:path.join(root,'artifacts/screenshots/training.png'),fullPage:true});
  await page.goto(base+'/notes');await page.locator('main').waitFor({state:'visible'});
  await api(`/orders/${createdOrder.id}`,'DELETE');createdOrder=null;
  // A dispatcher starts a real route; the employee completes the next stage in the UI.
  routeOrder=await api('/orders','POST',{clinicId:clinics[0].id,patientFullName:'Учебный маршрут интерфейса',doctorFullName:'Учебный врач',deadline:new Date().toISOString().slice(0,10),tasks:[{workDirectionId:directions[0].id,workTypeId:work.id,quantity:1,toothNumbers:[21],colorId:colors[0].id,materialIds:[materials[0].id],pricePerUnit:0,discountPercent:0}]});
  await acceptLab(routeOrder.id);
  const statuses=await api('/workflow/statuses');
  adminCleanupContext=await browser.newContext();
  const cleanLogin=await adminCleanupContext.request.post(base+'/api/backend/auth/sessions',{headers:{Origin:base},data:{email:'admin@teethtech.kz',password:env.MVP_ADMIN_PASSWORD}});assert.ok(cleanLogin.ok());
  const dispatcher=await browser.newContext();
  const dispatcherLogin=await dispatcher.request.post(base+'/api/backend/auth/sessions',{headers:{Origin:base},data:{email:'dispatcher@teethtech.kz',password:env.MVP_TRAINING_PASSWORD}});assert.ok(dispatcherLogin.ok());
  const start=await dispatcher.request.patch(base+`/api/backend/tasks/${routeOrder.taskIds[0]}/status`,{headers:{Origin:base},data:{nextStatusId:statuses.find(s=>s.code===plasteringCode).id}});assert.equal(start.status(),204);await dispatcher.close();
  await page.keyboard.press('Escape');
  const openMenu=page.getByRole('button',{name:'Показать боковое меню',exact:true});if(await openMenu.count())await openMenu.click();
  await page.getByRole('button',{name:'Выйти из CRM',exact:true}).click();
  await page.waitForURL('**/auth/login');
  const protectedApi=await context.request.get(base+'/api/backend/orders');assert.equal(protectedApi.status(),401);
  console.log('Browser: order, files, dispatcher handoff and UI logout verified.');
  await page.goto(base+'/auth/login');await page.locator('input[type=email]').fill('plasterer@teethtech.kz');await page.locator('input[type=password]').fill(env.MVP_TRAINING_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForURL('**/employee');
  const board=await api('/tasks/kanban/my');assert.ok(board.currentColumn.tasks.some(t=>t.id===routeOrder.taskIds[0]),'Task reaches plasterer');
  await page.getByRole('button',{name:'Завершить этап',exact:false}).first().click();
  await page.getByRole('heading',{name:'Завершить этап задачи',exact:true}).waitFor();
  await page.locator('textarea').fill('Этап завершён через интерфейс сотрудника');
  await page.getByRole('button',{name:'Подтвердить переход',exact:true}).click();
  await page.getByRole('heading',{name:'Завершить этап задачи',exact:true}).waitFor({state:'hidden'});
  const afterBoard=await api('/tasks/kanban/my');assert.ok(!afterBoard.currentColumn.tasks.some(t=>t.id===routeOrder.taskIds[0]),'Completed stage leaves personal column');
  await page.goto(base+'/employee/kpi');await page.getByRole('heading',{name:'Мой KPI',exact:true}).waitFor();
  await page.getByText(routeOrder.orderNumber,{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'artifacts/screenshots/employee-mobile.png'),fullPage:true});
  const denied=await context.request.get(base+'/api/backend/kpi?from=2026-10-05&to=2026-10-05');assert.equal(denied.status(),403);
  const removeRoute=await adminCleanupContext.request.delete(base+'/api/backend/orders/'+routeOrder.id,{headers:{Origin:base}});assert.equal(removeRoute.status(),204);routeOrder=null;
  assert.deepEqual(errors,[],'Browser JavaScript errors');
  console.log('Browser OK: admin/employee login, full order page, upload/download, KPI, training, notes, role restrictions, mobile, stage completion in UI, personal KPI, logout.');
 }catch(e){await page.screenshot({path:path.join(root,'artifacts/screenshots/browser-failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{
  if(routeOrder&&adminCleanupContext)await adminCleanupContext.request.delete(base+'/api/backend/orders/'+routeOrder.id,{headers:{Origin:base}}).catch(()=>{});
  await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
