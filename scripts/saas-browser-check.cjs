const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('fs'),assert=require('node:assert/strict');
const root=require('path').resolve(process.env.SAAS_TEST_ROOT||require('path').resolve(__dirname,'..'));
if(process.env.SAAS_BROWSER_TEST!=='1')throw Error('This exercise creates disposable laboratories. Run only on a separate test platform with SAAS_BROWSER_TEST=1.');
const env=Object.fromEntries(fs.readFileSync(root+'/saas/.env','utf8').split('\n').filter(x=>x.includes('=')).map(x=>{let i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1).replace(/^'|'$/g,'')]}));
const base=env.SAAS_PUBLIC_URL,password='SaaSPilotChiefTest2026';
assert.ok(/^http:\/\/localhost:\d+$/.test(base),'Only local test platforms are allowed');
const labURL=n=>`http://lab${n}.localhost:${new URL(base).port}`;
(async()=>{
const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await b.newContext({viewport:{width:1400,height:1000}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
 await page.goto(base);await page.locator('#login-form input[name=email]').fill(env.SAAS_OWNER_EMAIL);await page.locator('#login-form input[name=password]').fill(env.SAAS_OWNER_PASSWORD);await page.locator('#login-form button').click();await page.locator('#dashboard').waitFor({state:'visible'});
 async function owner(path,method='GET',data){const r=await ctx.request.fetch(base+path,{method,data,headers:method==='GET'?{}:{Origin:base}});assert.ok(r.ok(),path+' '+r.status());return r.json();}
 const invitations=[];
 const existing=await owner("/api/owner/labs");
 assert.ok(existing.labs.every(l=>l.name.startsWith("SaaS browser test ")),"Refuse non-test laboratories");
 if(!existing.labs.length){
 for(let n=1;n<=2;n++){
  await page.locator('#invite-form input[name=name]').fill('SaaS browser test '+n);await page.locator('#invite-form input[name=email]').fill('chief'+n+'@saas-browser.test');await page.locator('#invite-form button').click();await page.waitForFunction(n=>document.getElementById('labs').querySelectorAll('.lab').length===n,n);const url=await page.locator('#invite-url').inputValue();assert.ok(url.includes('#'));invitations.push(url);
  const chiefCtx=await b.newContext();const p=await chiefCtx.newPage();p.setDefaultTimeout(30000);await p.goto(url);await p.locator('#register-form').waitFor({state:'visible'});await p.locator('input[name=name]').fill('Chief browser '+n);await p.locator('input[name=email]').fill('chief'+n+'@saas-browser.test');await p.locator('input[name=password]').fill(password);await p.locator('input[name=repeat]').fill(password);await p.locator('#register-form button').click();await p.getByText('Регистрация принята',{exact:true}).waitFor();await chiefCtx.close();
 }
 }
 console.log('Owner UI and both invitation registrations passed. Waiting for isolated installations...');
 for(let tries=0;tries<150;tries++){const x=await owner('/api/owner/labs');if(x.labs.some(l=>l.status==='FAILED'))throw Error('Provisioner reported FAILED');if(x.labs.length===2&&x.labs.every(l=>l.status==='READY'))break;if(tries===149)throw Error('Provisioning timeout');await new Promise(r=>setTimeout(r,4000));}
 const labs=[];
 for(let n=1;n<=2;n++){
  const c=await b.newContext();const p=await c.newPage();p.setDefaultTimeout(30000);await p.goto(labURL(n)+'/auth/login');await p.locator('input[type=email]').fill('chief'+n+'@saas-browser.test');await p.locator('input[type=password]').fill(password);await p.locator('button[type=submit]').click();await p.waitForURL('**/orders');
  const url=labURL(n);
  const orders=await c.request.get(url+'/api/backend/orders');assert.ok(orders.ok());
  const employees=await c.request.get(url+'/api/backend/users');assert.ok(employees.ok());const emp=await employees.json();assert.equal((Array.isArray(emp)?emp:emp.content).length,1,'Only registered chief is active');
  const panel=await c.request.get(url+'/api/owner/labs');assert.equal(panel.status(),404,'Tenant host must not expose owner APIs');
  await p.goto(url+'/training');await p.getByRole('heading',{name:'Первый рабочий день'}).waitFor();
  labs.push({c,url,cookies:await c.cookies()});
 }
 const isolated=await b.newContext();await isolated.addCookies(labs[0].cookies.map(c=>({...c,domain:'lab2.localhost'})));const deny=await isolated.request.get(labs[1].url+'/api/backend/orders');assert.equal(deny.status(),401,'Lab1 JWT must not authenticate in lab2');await isolated.close();
 const note=await labs[0].c.request.post(labs[0].url+'/api/backend/personal-notes',{headers:{Origin:labs[0].url},data:{title:'Isolation test',content:'Only laboratory one'}});assert.ok(note.ok(),await note.text());
 const other=await labs[1].c.request.get(labs[1].url+'/api/backend/personal-notes');assert.ok(other.ok());assert.ok(!(await other.text()).includes('Only laboratory one'));
 await owner('/api/owner/labs/1/suspend','POST',{});const blocked=await labs[0].c.request.get(labs[0].url+'/api/backend/orders');assert.equal(blocked.status(),503);const still=await labs[1].c.request.get(labs[1].url+'/api/backend/orders');assert.ok(still.ok());
 for(let tries=0;tries<40;tries++){const x=await owner('/api/owner/labs');if(x.labs[0].status==='SUSPENDED')break;await new Promise(r=>setTimeout(r,2000));}
 await owner('/api/owner/labs/1/extend','POST',{days:30});await owner('/api/owner/labs/1/resume','POST',{});
 for(let tries=0;tries<60;tries++){const x=await owner('/api/owner/labs');if(x.labs[0].status==='READY')break;if(tries===59)throw Error('Resume timeout');await new Promise(r=>setTimeout(r,2000));}
 const persisted=await labs[0].c.request.get(labs[0].url+'/api/backend/personal-notes');assert.ok((await persisted.text()).includes('Only laboratory one'));
 await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});await page.screenshot({path:root+'/artifacts/screenshots/saas-owner.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/artifacts/screenshots/saas-owner-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('SaaS browser OK: two invite registrations, two actual CRM installations, individual chiefs, training, cookie isolation, note isolation, suspend one while other works, resume preserves data, desktop/mobile owner dashboard.');
}catch(e){await page.screenshot({path:root+'/artifacts/screenshots/saas-failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await b.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
