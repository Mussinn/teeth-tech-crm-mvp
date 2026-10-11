const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../presentation'),out=path.join(root,'exports');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const [file,name] of [['index.html','presentation'],['pricing.html','pricing']]){
 const r=await p.goto('http://127.0.0.1:18191/'+file);assert.equal(r.status(),200);
 await p.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
 await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready;});
 assert.ok(await p.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)),'All screenshots load');
 await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 if(name==='presentation')await p.screenshot({path:path.join(out,'presentation-cover.png')});
 await p.pdf({path:path.join(out,name+'.pdf'),format:'A4',printBackground:true,margin:{top:'10mm',bottom:'10mm',left:'10mm',right:'10mm'}});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,name+'-mobile.png'),fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile has no horizontal overflow');await p.setViewportSize({width:1440,height:1000});
}
assert.deepEqual(errors,[]);console.log('HTML presentation verified: images, desktop/mobile, PDF and pricing screenshots ready.');}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
