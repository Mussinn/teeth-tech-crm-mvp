const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const shots=path.join(__dirname,'../artifacts/screenshots');fs.mkdirSync(shots,{recursive:true});
async function capture(page,name){
 const reset=()=>page.locator('[data-tour="app-content"]').evaluate(e=>{e.scrollTop=0});
 await reset();await page.screenshot({path:path.join(shots,name+'.png')});
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('Escape');await reset();await page.waitForTimeout(350);
 await page.screenshot({path:path.join(shots,name+'-mobile.png')});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),name+' mobile overflow');
 assert.ok(await page.locator('.experience-page').evaluate(e=>e.scrollWidth<=e.clientWidth+1),name+' content overflow');
 await page.setViewportSize({width:1440,height:1000});
}
if(process.env.PLATFORM_BROWSER_TEST!=='1')throw Error('Run only on the isolated platform test installation');
const ownerURL='http://localhost:18099',labURL='http://lab1.localhost:18099';
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
const lab=await b.newContext();const p=await lab.newPage();await p.setViewportSize({width:1440,height:1000});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(30000);
await p.goto(labURL+'/auth/login');await p.locator('input[type=email]').fill('admin@teethtech.kz');await p.locator('input[type=password]').fill('PilotIsolatedBrowserPassword2026');await p.locator('button[type=submit]').click();await p.waitForURL('**/orders');await p.keyboard.press('Escape');
await p.goto(labURL+'/support');await p.getByRole('heading',{name:'Поддержка',exact:true}).waitFor();await p.getByLabel('Тема заявки').fill('Браузерная проверка поддержки');await p.getByLabel('Описание проблемы').fill('Не удаётся завершить этап. Это учебная заявка без данных пациента.');
await p.locator('input[type=file]').setInputFiles({name:'screen.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});await p.getByRole('button',{name:'Отправить заявку',exact:true}).click();await p.getByLabel('Ответ в поддержку').waitFor();await p.getByRole('link',{name:'Скачать screen.png'}).waitFor();
const owner=await b.newContext();const q=await owner.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(ownerURL);await q.locator('#login-form input[name=email]').fill('owner@platform.test');await q.locator('#login-form input[name=password]').fill('PlatformOwnerPassword2026');await q.locator('#login-form button').click();await q.locator('#dashboard').waitFor({state:'visible'});await q.locator('#support-list button').filter({hasText:'Браузерная проверка поддержки'}).click();await q.locator('#support-reply textarea').fill('Проверьте входной контроль задания.');await q.locator('#support-reply select').selectOption('RESOLVED');await q.locator('#support-reply button').click();await q.locator('#support-detail').getByText('Проверьте входной контроль задания.',{exact:true}).waitFor();
await p.getByRole('button',{name:'Обновить',exact:true}).click();await p.getByText('Проверьте входной контроль задания.',{exact:true}).waitFor();await p.getByText('Решена',{exact:true}).first().waitFor();await capture(p,'redesign-support');
await p.goto(labURL+'/community');await p.getByRole('heading',{name:'Добровольное участие',exact:true}).waitFor();await p.getByLabel('Публичное название лаборатории').fill('Учебная лаборатория');await p.getByLabel('Город',{exact:true}).fill('Актобе');await p.locator('input[type=checkbox]').check();await p.getByRole('button',{name:'Присоединиться',exact:true}).click();await p.getByLabel('Тема публикации').fill('Первое обсуждение');await p.getByLabel('Текст публикации').fill('Как вы распределяете нагрузку между техниками?');await p.getByRole('button',{name:'Опубликовать',exact:true}).click();await p.getByRole('heading',{name:'Первое обсуждение',exact:true}).waitFor();await p.getByLabel('Комментарий',{exact:true}).fill('Учебный комментарий');await p.getByRole('button',{name:'Отправить',exact:true}).click();await p.getByText('Учебный комментарий',{exact:false}).waitFor();await capture(p,'redesign-community');
await q.locator('#refresh').click();await q.locator('#community-moderation article').filter({hasText:'Первое обсуждение'}).getByRole('button',{name:'Скрыть публикацию',exact:true}).click();await q.getByText('Жалоб: 0 · Скрыта',{exact:true}).waitFor();await p.reload();await p.getByText('Публикаций пока нет. Начните обсуждение.',{exact:true}).waitFor();await p.goto(labURL+'/training');await p.getByRole('heading',{name:'Первый рабочий день',exact:true}).waitFor();await capture(p,'redesign-training');await p.goto(labURL+'/kpi');await p.getByRole('heading',{name:'KPI сотрудников',exact:true}).waitFor();await p.getByText('Загрузка отчёта…').waitFor({state:'hidden'});await capture(p,'redesign-kpi');for(const [route,heading,name] of [['laboratory','Лаборатория','laboratory-hub'],['laboratory/cases','Приём, качество и выдача','laboratory-cases'],['laboratory/materials','Материалы','laboratory-materials'],['laboratory/catalogs','Технические справочники','laboratory-catalogs']]){
 await p.goto(labURL+'/'+route);await p.getByRole('heading',{name:heading,exact:true}).waitFor();await capture(p,name);
}
assert.equal(await p.locator('aside a[href="/laboratory/cases"]').count(),1,'one queue entry in sidebar');
await p.getByRole('button',{name:'Открыть быстрый доступ',exact:true}).click();
await p.getByRole('link',{name:'Открыть поддержку',exact:true}).click();await p.waitForURL('**/support');
await p.getByRole('button',{name:'Открыть быстрый доступ',exact:true}).click();await p.getByRole('link',{name:'Открыть обучение',exact:true}).click();await p.waitForURL('**/training');
assert.deepEqual(errors,[]);

await q.locator('#mfa-form input[name=password]').fill('PlatformOwnerPassword2026');
const setupResponse=q.waitForResponse(r=>r.url().endsWith('/api/owner/mfa/begin')&&r.status()===200);
await q.locator('#mfa-begin').click();const mfa=await (await setupResponse).json();
function otp(key,offset=0){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of key)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const raw=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));const mac=require('node:crypto').createHmac('sha1',raw).update(counter).digest();const n=mac[19]&15;return String((mac.readUInt32BE(n)&0x7fffffff)%1000000).padStart(6,'0');}
await q.locator('#mfa-form input[name=code]').fill(otp(mfa.secret));await q.locator('#mfa-form button[value=confirm]').click();await q.locator('#mfa-status').getByText('Двухфакторный вход включён',{exact:true}).waitFor();
await q.locator('#logout').click();await q.locator('#login-form').waitFor({state:'visible'});assert.equal(await q.locator('#mfa-secret').textContent(),'');
await q.locator('#login-form input[name=email]').fill('owner@platform.test');await q.locator('#login-form input[name=password]').fill('PlatformOwnerPassword2026');await q.locator('#login-form input[name=code]').fill(otp(mfa.secret,1));await q.locator('#login-form button').click();await q.locator('#dashboard').waitFor({state:'visible'});
assert.deepEqual(errors,[]);
console.log('Platform browser OK: verified CRM identity, support ticket, private screenshot, owner reply, resolved state, opt-in, publication, comment and moderation.');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
