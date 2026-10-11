// Read-only smoke against the isolated presentation installation. No patient data writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DEMO_URL||'http://lab1.localhost:18192';
if(!['localhost','lab1.localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated localhost demo only');
const routes=['orders','tasks','analytics','kpi','laboratory','laboratory/cases','laboratory/work-types',
 'laboratory/work-directions','laboratory/statuses','laboratory/materials','laboratory/colors','laboratory/catalogs',
 'laboratory/roles','laboratory/employees','clinics','patients','notes','training','support','community','settings','tv-dashboard'];
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const result={scope:'read-only localhost presentation demo',routes:[],errors:[]};
 const out=path.resolve(__dirname,'../artifacts/production-audit/browser.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ru-RU'});
  let current='login';
  page.on('pageerror',e=>result.errors.push({route:current,type:'javascript',message:e.message}));
  page.on('response',r=>{const pathname=new URL(r.url()).pathname;
   if(current==='login'&&pathname==='/api/auth/session'&&r.status()===401)return;
   if(r.status()>=400&&pathname.startsWith('/api/'))result.errors.push({route:current,type:'api',status:r.status(),path:pathname});});
  await page.goto(base+'/auth/login');await page.locator('input[type=email]').fill('admin@teethtech.kz');
  await page.locator('input[type=password]').fill('DemoLab2026!');await page.locator('button[type=submit]').click();
  await page.waitForURL(u=>!u.pathname.startsWith('/auth'));await page.keyboard.press('Escape');
  for(const route of routes){
   current=route;const response=await page.goto(base+'/'+route);assert.ok(response.ok(),route+' document status');
   await page.locator('main').first().waitFor();await page.waitForTimeout(1000);await page.keyboard.press('Escape');
   assert.ok(!new URL(page.url()).pathname.startsWith('/auth'),route+' lost session');
   result.routes.push({route,documentStatus:response.status(),heading:await page.locator('h1').first().textContent().catch(()=>''),
    finalPath:new URL(page.url()).pathname});
  }
  // The order card is the central staff workflow; verify at least one real demo card opens.
  current='orders/detail';await page.goto(base+'/orders');
  const ordersResponse=await page.request.get(base+'/api/backend/orders');assert.equal(ordersResponse.status(),200);
  const orders=await ordersResponse.json();const items=Array.isArray(orders)?orders:(orders.content||orders.items||[]);
  assert.ok(items.length,'Demo orders are required');
  await page.goto(base+'/orders/'+items[0].id);await page.locator('main').first().waitFor();await page.waitForTimeout(1000);
  result.routes.push({route:'orders/detail',finalPath:new URL(page.url()).pathname});
  fs.writeFileSync(out,JSON.stringify(result,null,2));assert.deepEqual(result.errors,[]);
  console.log('Read-only browser smoke passed: '+result.routes.length+' routes, no JavaScript errors or failed API responses.');
 }finally{fs.writeFileSync(out,JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
