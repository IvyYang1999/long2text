import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/dc-analytics.js', import.meta.url), 'utf8');
function boot({ consent, denied = false, dnt, gpc, pathname = '/screenshot-to-markdown', storageError = false, hostname = 'long2text.com', search = '', session = new Map() } = {}) {
  const listeners = {}, loaded = [];
  const values = new Map();
  if (consent !== undefined) values.set('l2t-analytics-choice-v1', consent);
  if (denied) values.set('dc-analytics-consent-v1', JSON.stringify({ value: 'denied' }));
  const w = {
    location: { hostname, origin: `https://${hostname}`, pathname, search, href: `https://${hostname}${pathname}?paid=SECRET&session_id=SECRET#private` },
    navigator: { doNotTrack: dnt, globalPrivacyControl: gpc },
    localStorage: { getItem: key => { if (storageError) throw new Error('blocked'); return values.get(key) ?? null; } },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key,value) => session.set(key,value), removeItem:key=>session.delete(key) },
    history: { pushState() {}, replaceState() {} }, setTimeout: fn => fn(),
    addEventListener: (name, cb) => { (listeners[name] ??= []).push(cb); },
  };
  const doc = { currentScript: { dataset: { gaId: 'G-CH4WNME765', site: 'long2text', hosts: 'long2text.com,www.long2text.com' } },
    documentElement: { lang: 'en' }, referrer: 'https://www.google.com/search?q=PRIVATE',
    createElement: () => ({}), head: { appendChild: el => loaded.push(el.src) } };
  vm.runInNewContext(source, { window: w, document: doc, URL, URLSearchParams, Date });
  return { w, loaded, values, send: detail => listeners['l2t:analytics']?.forEach(fn => fn({ detail })), fire: event => listeners[event]?.forEach(fn => fn()), events: () => Array.from(w.dataLayer || [], args => Array.from(args)).filter(args => args[0] === 'event') };
}

test('analytics fails closed without explicit consent, including unreadable preferences', () => {
  for (const options of [{}, {consent:'denied'}, {consent:'true'}, {consent:'granted',denied:true}, {consent:'granted',dnt:'1'}, {consent:'granted',gpc:true}, {consent:'granted',storageError:true}, {consent:'granted',hostname:'localhost'}]) {
    const app = boot(options); app.send({name:'ocr_completed'});
    assert.equal(app.loaded.length, 0, JSON.stringify(options));
    assert.equal(app.events().length, 0);
  }
});

test('growth adds the public comparison and only enumerated campaign attribution', () => {
  const app = boot({consent:'granted',pathname:'/long-screenshot-to-markdown-test',search:'?utm_source=reddit&utm_campaign=markdown_test&session_id=SECRET'});
  assert.equal(app.loaded.length,1);
  assert.equal(app.events()[0][2].l2t_source,'reddit');
  assert.equal(app.events()[0][2].l2t_campaign,'markdown_test');
  assert.ok(!JSON.stringify(app.w.dataLayer).includes('SECRET'));
  const bad=boot({consent:'granted',search:'?utm_source=private@example.com&utm_campaign=PRIVATE'});
  assert.ok(!JSON.stringify(bad.w.dataLayer).includes('PRIVATE'));
});

test('event-specific dimensions reject arbitrary data and wrong-event fields', () => {
  const app=boot({consent:'granted'});
  app.send({name:'ocr_completed',duration_bucket:'3_10s',result_access:'preview',failure_stage:'PRIVATE',input_method:'file',text:'PRIVATE'});
  const event=app.events().at(-1)[2];
  assert.equal(event.duration_bucket,'3_10s');
  assert.equal(event.result_access,'preview');
  assert.equal(event.failure_stage,undefined);
  app.send({name:'checkout_failed',failure_stage:'checkout',message:'PRIVATE'});
  assert.equal(app.events().at(-1)[1],'checkout_failed');
  assert.ok(!JSON.stringify(app.w.dataLayer).includes('PRIVATE'));
});

test('attribution persists only with consent and clears on revocation', () => {
  const session=new Map();
  boot({search:'?utm_source=discord',session});
  assert.equal(session.size,0);
  const first=boot({consent:'granted',search:'?utm_source=discord&utm_campaign=launch',session});
  const next=boot({consent:'granted',session});
  assert.equal(next.events()[0][2].l2t_source,'discord');
  first.values.set('l2t-analytics-choice-v1','denied');first.fire('l2t:privacy');
  assert.equal(session.has('l2t-attribution-v1'),false);
});
test('expired, future, malformed and poisoned attribution is not trusted', () => {
  for (const value of ['{', JSON.stringify({source:'PRIVATE',campaign:'launch',at:Date.now()}),
    JSON.stringify({source:'reddit',campaign:'launch',at:Date.now()-1800001}),
    JSON.stringify({source:'reddit',campaign:'launch',at:Date.now()+60000})]) {
    const app=boot({consent:'granted',session:new Map([['l2t-attribution-v1',value]])});
    assert.equal(app.events()[0][2].l2t_source,'google');
    assert.ok(!JSON.stringify(app.w.dataLayer).includes('PRIVATE'));
  }
  const duplicate=boot({consent:'granted',search:'?utm_source=reddit&utm_source=discord&utm_campaign=PRIVATE'});
  assert.equal(duplicate.events()[0][2].l2t_source,'google');
  assert.equal(duplicate.events()[0][2].l2t_campaign,'none');
});
test('known guide paths and fixed events survive; content, query strings and arbitrary fields do not', () => {
  const app = boot({consent:'granted'});
  assert.equal(app.loaded.length, 1);
  app.send({name:'ocr_completed',fileName:'PRIVATE',text:'PRIVATE',method:'SECRET'});
  app.send({name:'export_completed',method:'markdown_zip',text:'PRIVATE'});
  app.send({name:'PRIVATE'});
  assert.deepEqual(app.events().map(e => e[1]), ['page_view','ocr_completed','export_completed']);
  const serialized = JSON.stringify(app.w.dataLayer);
  assert.ok(!/PRIVATE|SECRET|session_id|\?paid|fileName/.test(serialized));
  assert.ok(serialized.includes('/screenshot-to-markdown'));
  assert.ok(serialized.includes('markdown_zip'));
});
test('private routes never load analytics and SPA navigation is bounded and deduplicated', () => {
  assert.equal(boot({consent:'granted',pathname:'/history'}).loaded.length, 0);
  const app = boot({consent:'granted'});
  app.w.history.replaceState();
  assert.equal(app.events().length, 1);
  app.w.location.pathname = '/chat-screenshot-to-text'; app.w.history.pushState();
  assert.equal(app.events().length, 2);
  app.w.location.pathname = '/history'; app.w.history.pushState(); app.send({name:'ocr_completed'});
  assert.equal(app.events().length, 2);
  app.w.location.pathname = '/'; app.w.history.pushState();
  for(let i=0;i<200;i++) app.send({name:'ocr_completed'});
  assert.ok(app.w.dataLayer.length <= 100);
});
test('revoking permission stops events immediately', () => {
  const app = boot({consent:'granted'});
  app.values.set('l2t-analytics-choice-v1','denied'); app.fire('l2t:privacy');
  app.send({name:'ocr_completed'});
  assert.equal(app.events().length, 1);
  assert.equal(app.w['ga-disable-G-CH4WNME765'], true);
});
