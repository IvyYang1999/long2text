import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base=process.env.TEST_BASE_URL || 'http://localhost:3124';
const out=await mkdtemp(join(tmpdir(),'l2t-google-integration-'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const receipts=[];
try {
  const jobs=[{name:'chat-ai-figures',file:new URL('../public/samples/en-chat.jpg',import.meta.url).pathname,route:'/',ai:true}];
  // Only supply an authorized fictional fixture. No private file discovery.
  if(process.env.GOOGLE_LONG_FIXTURE) jobs.push({name:'long-chat',file:process.env.GOOGLE_LONG_FIXTURE,route:'/zh',ai:false});
  for(const job of jobs) {
    const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage();
    const errors=[],ocr=[],corrections=[],descriptions=[],pending=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{
      const path=new URL(r.url()).pathname;
      if(r.request().method()!=='POST') return;
      if(['/api/ocr','/api/correct','/api/describe'].includes(path)) pending.push((async()=>{
        const j=await r.json().catch(()=>({}));
        if(path==='/api/ocr') ocr.push({status:r.status(),provider:j.provider,chars:j.chars,blocks:j.blocks});
        if(path==='/api/correct') corrections.push({status:r.status(),changed:j.changed,reason:j.reason});
        if(path==='/api/describe') descriptions.push({status:r.status(),characters:j.text?.length || 0});
      })());
    });
    await page.goto(base+job.route);
    await page.evaluate(ai=>{localStorage.setItem('l2t-ai-correct',ai?'1':'0');},job.ai);
    await page.reload();
    assert.equal((await (await page.request.get(base+'/api/ocr')).json()).provider,'google');
    const started=Date.now();
    await page.locator('input[type=file]').setInputFiles(job.file);
    const copy=page.getByRole('button',{name:job.route==='/zh'?'复制预览':'Copy preview',exact:true});
    await copy.waitFor({timeout:70000});
    const previewMs=Date.now()-started;
    await Promise.all(pending);
    assert.equal(ocr.length,1,'whole long screenshot must take one paid OCR request');
    assert.equal(ocr[0].status,200); assert.equal(ocr[0].provider,'google');
    assert.ok(ocr[0].chars>500);
    assert.ok(ocr[0].blocks.every(b=>b.width>0 && b.height>0 && b.confidence>=0 && b.confidence<=100));
    if(job.name==='long-chat') assert.ok(Math.max(...ocr[0].blocks.map(b=>b.y))>35000,'bottom of original 36k image survives');
    if(job.ai) {
      await page.getByText(/^Proofreading \d/).waitFor({state:'hidden',timeout:20000});
      await page.getByRole('button',{name:'Images + descriptions',exact:true}).click();
      await page.waitForFunction(()=>!document.body.innerText.includes('Describing '),{},{timeout:25000});
      await Promise.all(pending);
      assert.ok(descriptions.some(d=>d.status===200 && d.characters>0),'real vision descriptions return to the UI');
      await page.getByRole('button',{name:'Text only',exact:true}).click();
      await page.getByRole('button',{name:'Text + images',exact:true}).click();
    }
    await copy.click();
    await page.getByRole('button',{name:job.route==='/zh'?'已复制':'Copied',exact:true}).waitFor();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(copied.length>100);
    if(job.name==='chat-ai-figures') {
      assert.match(copied,/\*\*Maya\*\*：I might be 30 minutes late for Friday/);
      assert.doesNotMatch(copied,/\*\*Them\*\*：(?:Friday|just came up|deck\.)/);
    }
    const show=page.getByRole('button',{name:job.route==='/zh'?'查看原图':'Show original image',exact:true});
    if(await show.count()) { await show.click(); await page.mouse.wheel(0,700); }
    const copyAgain=page.getByRole('button',{name:job.route==='/zh'?/^(已复制|复制预览)$/:/^(Copied|Copy preview)$/});
    await copyAgain.scrollIntoViewIfNeeded(); await copyAgain.hover();
    await page.screenshot({path:join(out,job.name+'-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await copyAgain.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.screenshot({path:join(out,job.name+'-mobile.png')});
    await Promise.all(pending);
    assert.deepEqual(errors,[]);
    receipts.push({name:job.name,ocrRequests:ocr.length,provider:ocr[0].provider,characters:ocr[0].chars,lines:ocr[0].blocks.length,previewMs,corrections,descriptions,result:'PASS'});
    console.log(JSON.stringify(receipts.at(-1)));
    await context.close();
  }
  await writeFile(join(out,'receipt.json'),JSON.stringify(receipts,null,2));
  console.log('Screenshots and receipt:',out);
} finally {await browser.close();}
