import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function boot(consent='granted') {
  const local=new Map(consent ? [['l2t-analytics-choice-v1',consent]] : []), session=new Map(), events=[];
  const storage=values=>({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});
  const window={dispatchEvent:e=>events.push(e.detail)}, exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/analytics.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports,window,localStorage:storage(local),sessionStorage:storage(session),navigator:{},Date,CustomEvent:class {constructor(name,props){this.detail=props.detail;}}});
  return {api:exports,window,events,local,session};
}
test('duration bands have fixed boundaries and no raw time is sent',()=>{
 const {api}=boot();
 assert.deepEqual([0,2999,3000,9999,10000,29999,30000].map(api.durationBucket),['under_3s','under_3s','3_10s','3_10s','10_30s','10_30s','30s_plus']);
});
test('startup buffer is consent-gated and bounded, without disabling product events',()=>{
 const no=boot(null);no.api.trackFunnel('ocr_completed');assert.equal(no.window.__l2tGrowthPending,undefined);
 const yes=boot();for(let i=0;i<100;i++)yes.api.trackFunnel('ocr_completed');assert.equal(yes.window.__l2tGrowthPending.length,20);
 yes.window.__l2tGrowthReady=true;yes.api.trackFunnel('ocr_completed');assert.equal(yes.window.__l2tGrowthPending.length,20);
});
test('only a recent initiated login can produce one success, never an identity',()=>{
 const app=boot();app.api.trackLoginSuccess();assert.equal(app.events.length,0);
 app.api.trackLoginStart('paywall');app.api.trackLoginSuccess();app.api.trackLoginSuccess();
 assert.deepEqual(app.events.map(e=>e.name),['login_started','login_success']);
 assert.deepEqual(Object.keys(app.events[1]).sort(),['entry_point','name']);
 app.session.set('l2t-login-v1',JSON.stringify({entry:'header',at:Date.now()-16*60*1000}));app.api.trackLoginSuccess();assert.equal(app.events.length,2);
 app.session.set('l2t-login-v1',JSON.stringify({entry:'PRIVATE',at:Date.now()}));app.api.trackLoginSuccess();assert.equal(app.events.length,2);
});
test('denied or failed login does not leave an attribution marker',()=>{
 const app=boot(null);app.api.trackLoginStart('header');assert.equal(app.session.size,0);
 const yes=boot();yes.api.trackLoginStart('header');yes.api.trackFunnel('login_failed',{failure_stage:'login'});assert.equal(yes.session.size,0);
});
