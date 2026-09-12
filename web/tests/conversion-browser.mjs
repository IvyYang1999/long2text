import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const sharp = require('sharp');
const base = process.env.TEST_BASE_URL || 'http://localhost:3123';
const out = await mkdtemp(join(tmpdir(), 'l2t-seo-browser-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fixture = await sharp(Buffer.from('<svg width="600" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="180" fill="white"/><text x="30" y="70" font-size="28">A public OCR smoke test.</text></svg>')).png().toBuffer();
const payload = { name: 'PRIVATE-filename.png', mimeType: 'image/png', buffer: fixture };
const blocks = [{text:'A public OCR smoke test.', confidence:99, x:30, y:45, width:330, height:28}];
const guides = ['/chat-screenshot-to-text', '/screenshot-to-markdown'];
const errors = [];
async function pageFor(width=1280) {
  const context = await browser.newContext({viewport:{width,height:900}, permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__testEvents = [];
    window.addEventListener('l2t:analytics', e => window.__testEvents.push(e.detail));
  });
  await page.route('**/api/auth/session', r => r.fulfill({json:{}}));
  await page.route('**/api/correct', r => r.fulfill({json:{enabled:false}}));
  await page.route('**/api/ocr', r => r.fulfill({json:{success:true,blocks}}));
  return {context,page};
}
async function noOverflow(page, label) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1), false, label);
}
async function complete(page) {
  await page.getByRole('button',{name:'Copy Markdown',exact:true}).waitFor({timeout:25000});
  const names = await page.evaluate(()=>window.__testEvents.map(e=>e.name));
  assert.deepEqual(names.slice(0,2), ['upload_started','ocr_completed']);
  assert.ok(!JSON.stringify(await page.evaluate(()=>window.__testEvents)).includes('PRIVATE'));
}
function zipEntries(buffer) {
  const entries = new Map();
  let p = 0;
  while (buffer.readUInt32LE(p) === 0x04034b50) {
    const size = buffer.readUInt32LE(p+18), nameSize=buffer.readUInt16LE(p+26), extra=buffer.readUInt16LE(p+28);
    const name=buffer.subarray(p+30,p+30+nameSize).toString();
    const start=p+30+nameSize+extra;
    entries.set(name,buffer.subarray(start,start+size)); p=start+size;
  }
  return entries;
}
try {
  // Inline, voluntary preference: no banner, no automatic opt-in or overridden refusal.
  for (const locale of ['en', 'zh']) {
    const { context, page } = await pageFor(320);
    await page.goto(base + (locale === 'en' ? '/privacy' : '/zh/privacy'));
    const enable = page.getByRole('button', { name: locale === 'en' ? 'Enable optional analytics' : '开启可选统计', exact: true });
    await enable.waitFor();
    await page.waitForFunction(() => !document.querySelector('#analytics button').disabled);
    assert.equal(await page.evaluate(() => localStorage.getItem('l2t-analytics-choice-v1')), null);
    await enable.click();
    const disable = page.getByRole('button', { name: locale === 'en' ? 'Disable optional analytics' : '关闭可选统计', exact: true });
    await disable.waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('l2t-analytics-choice-v1')), 'granted');
    await disable.click();
    await enable.waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('l2t-analytics-choice-v1')), 'denied');
    await noOverflow(page, locale + ' privacy 320');
    await enable.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(out, locale + '-privacy-320.png') });
    await page.evaluate(() => localStorage.setItem('dc-analytics-consent-v1', JSON.stringify({ value: 'denied' })));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#analytics button')?.disabled);
    assert.equal(await enable.isDisabled(), true);
    await context.close();
    console.log('PASS inline analytics preference', locale);
  }
  for (const signal of ['doNotTrack', 'globalPrivacyControl']) {
    const { context, page } = await pageFor();
    await page.addInitScript(signal => Object.defineProperty(navigator, signal, { value: signal === 'doNotTrack' ? '1' : true }), signal);
    await page.goto(base + '/privacy');
    await page.getByText(/A browser privacy signal/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enable optional analytics', exact: true }).isDisabled(), true);
    await context.close();
    console.log('PASS privacy signal', signal);
  }
  // Actual rendered pages and downloads; no authentication or paid transaction.
  for (const route of guides) {
    const {context,page} = await pageFor();
    await page.goto(base+route);
    await page.getByRole('button',{name:'Upload screenshot',exact:true}).waitFor();
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('input[type=file]').count(),1);
    await page.getByRole('button',{name:'Upload screenshot',exact:true}).focus();
    assert.notEqual(await page.getByRole('button',{name:'Upload screenshot',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    await page.screenshot({path:join(out,route.slice(1)+'-desktop.png')});
    await page.getByRole('region',{name:'Scrollable complete output'}).scrollIntoViewIfNeeded();
    await page.getByRole('region',{name:'Scrollable complete output'}).hover();
    await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Scrollable complete output"]').scrollTop>0);
    assert.ok(await page.getByRole('region',{name:'Scrollable complete output'}).evaluate(el=>el.scrollTop)>0);
    await page.getByText('View complete Markdown source',{exact:true}).click();
    assert.ok((await page.locator('pre code').textContent()).length>1500);
    await page.screenshot({path:join(out,route.slice(1)+'-example.png')});
    const sample=route===guides[0]?'en-chat':'en-article';
    const original=JSON.parse(await readFile(new URL('../src/lib/cases.json',import.meta.url),'utf8'))[sample];
    const zip = await page.request.get(base+`/samples/${sample}.zip`);
    assert.equal(zip.status(),200);
    const entries=zipEntries(await zip.body());
    const md=entries.get(`${sample}.md`).toString();
    assert.ok(md.includes(original.markdown.split('\n\n').at(-1)), 'last paragraph preserved');
    assert.ok(!md.includes('(fig:'));
    for (const f of original.figures) {
      const expected=await readFile(new URL(`../public/samples/figs/${sample}-${f.id}.jpg`,import.meta.url));
      assert.deepEqual(entries.get(`images/${f.id}.jpg`),expected);
    }
    const [download] = await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download text-only Markdown',exact:true}).click()]);
    assert.equal(download.suggestedFilename(),sample+'.md');
    assert.ok((await readFile(await download.path(),'utf8')).length>1500);
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844}); await noOverflow(page,`${route} ${width}`);
      await page.getByRole('button',{name:'Upload screenshot',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:join(out,route.slice(1)+`-${width}.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'Upload screenshot',exact:true}).click()]);
    await chooser.setFiles(payload); await complete(page); await noOverflow(page,route+' result');
    await page.getByRole('button',{name:'Show original image',exact:true}).click();
    await page.getByRole('button',{name:'Hide original image',exact:true}).waitFor();
    await page.getByRole('button',{name:'Hide original image',exact:true}).click();
    await page.getByRole('button',{name:'Copy Markdown',exact:true}).click();
    await page.getByRole('button',{name:'Copied',exact:true}).waitFor();
    const [resultFile]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download .md',exact:true}).click()]);
    assert.ok((await readFile(await resultFile.path(),'utf8')).includes('public OCR smoke test'));
    assert.equal((await page.evaluate(()=>window.__testEvents.filter(e=>e.name==='export_completed'))).length,2);
    await page.screenshot({path:join(out,route.slice(1)+'-result.png')});
    await context.close();
    console.log('PASS guide',route,'responsive, keyboard, scroll, full samples, upload, copy, download');
  }
  // Clipboard and drag/drop feed the same real browser splitting/structure flow.
  for(const type of ['paste','drop']) {
    const {context,page}=await pageFor(390); await page.goto(base+guides[1]);
    await page.getByRole('button',{name:'Upload screenshot',exact:true}).waitFor();
    await page.evaluate(({bytes,type})=>{
      const transfer=new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)],'PRIVATE.png',{type:'image/png'}));
      if(type==='paste') window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true}));
      else window.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true}));
    },{bytes:[...fixture],type});
    await complete(page); await context.close(); console.log('PASS',type);
  }
  // Invalid input and OCR failure must leave a retry path, without fake success events.
  {
    const {context,page}=await pageFor(); await page.goto(base+guides[0]);
    await page.locator('input[type=file]').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
    await page.getByRole('status').filter({hasText:/image/i}).waitFor();
    assert.equal((await page.evaluate(()=>window.__testEvents)).length,0);
    await page.route('**/api/ocr',r=>r.fulfill({status:503,json:{success:false}}));
    await page.locator('input[type=file]').setInputFiles(payload);
    await page.getByRole('status').filter({hasText:/failed|try again/i}).waitFor({timeout:25000});
    assert.ok((await page.evaluate(()=>window.__testEvents.map(e=>e.name))).includes('ocr_failed'));
    await context.close(); console.log('PASS failures');
  }
  // Payment telemetry is conditional on the existing authenticated verification endpoint.
  // These controlled responses do not prove the live Stripe/webhook flow or make charges.
  for(const paid of [false,true]) {
    const {context,page}=await pageFor();
    await page.route('**/api/verify-payment?*',r=>r.fulfill({json:{paid}}));
    await page.route('**/api/ocr-results',r=>r.fulfill({json:[]}));
    await page.goto(base+'/?paid=fixture&session_id=fixture');
    await page.waitForFunction(()=>!location.search,{timeout:20000});
    assert.equal((await page.evaluate(()=>window.__testEvents.filter(e=>e.name==='payment_verified'))).length,paid?1:0);
    await context.close(); console.log('PASS verified payment gate',paid);
  }
  assert.deepEqual(errors,[]);
  console.log('Screenshots:',out);
} finally { await browser.close(); }
