import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { loadTs } from './load-ts.mjs';

test('runtime provider selection supports opt-in and explicit rollback', () => {
  const { configuredOcrProvider }=loadTs('src/lib/ocr-config.ts');
  assert.equal(configuredOcrProvider({}),'tencent');
  assert.equal(configuredOcrProvider({GOOGLE_VISION_API_KEY:'test-only'}),'google');
  assert.equal(configuredOcrProvider({GOOGLE_VISION_API_KEY:'test-only',OCR_PROVIDER:'tencent'}),'tencent');
  assert.throws(()=>configuredOcrProvider({OCR_PROVIDER:'typo'}));
});

test('Google transport preserves image bytes, sends one request and sanitizes errors', async t => {
  const before=process.env.GOOGLE_VISION_API_KEY;
  process.env.GOOGLE_VISION_API_KEY='synthetic-test-key';
  t.after(()=> before===undefined ? delete process.env.GOOGLE_VISION_API_KEY : process.env.GOOGLE_VISION_API_KEY=before);
  let calls=0;
  const {googleOcrImage}=loadTs('src/lib/google-ocr.ts');
  t.mock.method(globalThis,'fetch',async (url, init)=>{
    calls++;
    assert.equal(url,'https://vision.googleapis.com/v1/images:annotate?prettyPrint=false');
    assert.equal(init.headers['Content-Encoding'],'gzip');
    assert.equal(init.headers['Accept-Encoding'],'gzip');
    assert.equal(init.headers['X-Goog-Api-Key'],'synthetic-test-key');
    const body=JSON.parse(gunzipSync(init.body));
    assert.deepEqual(Buffer.from(body.requests[0].image.content,'base64'),Buffer.from('fixture'));
    assert.deepEqual(body.requests[0].features,[{type:'DOCUMENT_TEXT_DETECTION'}]);
    return Response.json({responses:[{}]});
  });
  assert.deepEqual(await googleOcrImage(Buffer.from('fixture'),100,200),[]);
  assert.equal(calls,1);
  for (const status of [403,429,500]) {
    t.mock.method(globalThis,'fetch',async()=>{ calls++; return Response.json({error:{message:'synthetic-test-key PRIVATE_INPUT'}},{status}); });
    await assert.rejects(()=>googleOcrImage(Buffer.from('fixture'),100,200),e=>e.status===(status===429?429:502) && !/synthetic|PRIVATE/.test(e.message));
  }
  assert.equal(calls,4,'no automatic retries');
});

test('Google image preparation keeps whole files and closes decoded bitmap', async t=>{
  const {prepareGoogleImage}=loadTs('src/lib/prepare-ocr.ts');
  let closed=0;
  const before=globalThis.createImageBitmap;
  globalThis.createImageBitmap=async()=>({width:1012,height:36474,close(){closed++;}});
  t.after(()=>before ? globalThis.createImageBitmap=before : delete globalThis.createImageBitmap);
  const file=new File(['fictional'], 'long.jpg',{type:'image/jpeg'});
  const prepared=await prepareGoogleImage(file);
  assert.equal(prepared.segments.length,1);
  assert.equal(prepared.segments[0].blob,file,'no re-encoding or resizing');
  assert.equal(prepared.height,36474); assert.equal(closed,1);
});

test('Google pipeline never launches retries or Tencent enhancement',async t=>{
  const {recognize}=loadTs('src/lib/pipeline.ts', {
    './enhance':{findSmallTextRegions(){throw Error('must not enhance');}},
    './figures':{dedupeFigures:x=>x},
  });
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({success:false},{status:429});});
  t.mock.method(console,'error',()=>{});
  const segment={index:0,yStart:0,yEnd:100,blob:new Blob(['fixture'])};
  const result=await recognize([segment],()=>{},'google');
  assert.deepEqual(result.failed,[1]);assert.equal(calls,1);
});

test('oversized files are tiled with overlap and original dimensions, bounded to 4 MB',async t=>{
  const {prepareGoogleImage}=loadTs('src/lib/prepare-ocr.ts');
  const beforeBitmap=globalThis.createImageBitmap, beforeDocument=globalThis.document;
  let closed=0;
  globalThis.createImageBitmap=async()=>({width:1000,height:10000,close(){closed++;}});
  globalThis.document={createElement:()=>{
    const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(bitmap,x,y,w,h,dx,dy,dw,dh){
      assert.equal(w,dw);assert.equal(h,dh,'do not shrink text');
    }}),toBlob(cb){cb(new Blob([new Uint8Array(canvas.height*900)]));}};
    return canvas;
  }};
  t.after(()=>{
    if(beforeBitmap)globalThis.createImageBitmap=beforeBitmap;else delete globalThis.createImageBitmap;
    if(beforeDocument)globalThis.document=beforeDocument;else delete globalThis.document;
  });
  const file=new File([new Uint8Array(4_100_000)],'large.png',{type:'image/png'});
  const {segments}=await prepareGoogleImage(file);
  assert.ok(segments.length>1);
  assert.equal(segments[0].yStart,0);assert.equal(segments.at(-1).yEnd,10000);
  for(let i=0;i<segments.length;i++) {
    assert.ok(segments[i].blob.size<=4_000_000);
    if(i) { assert.ok(segments[i].yStart<segments[i-1].yEnd);assert.ok(segments[i].yStart>segments[i-1].yStart); }
  }
  assert.equal(closed,1);
});

test('route rejects wrong provider, invalid image and oversized uploads before a paid call',async t=>{
  const before=process.env.OCR_PROVIDER;process.env.OCR_PROVIDER='google';
  t.after(()=>before===undefined?delete process.env.OCR_PROVIDER:process.env.OCR_PROVIDER=before);
  let calls=0;
  const {POST}=loadTs('src/app/api/ocr/route.ts',{'@/lib/google-ocr':{googleOcrImage(){calls++;throw Error('must not call');},GoogleOcrError:class extends Error{}}});
  const send=async(file,provider)=>{
    const form=new FormData(); if(file)form.set('file',file);if(provider)form.set('provider',provider);
    return POST(new Request('http://localhost/api/ocr',{method:'POST',body:form}));
  };
  assert.equal((await send(null)).status,400);
  assert.equal((await send('not-a-file')).status,400);
  assert.equal((await send(new File(['x'],'x.jpg',{type:'image/jpeg'}),'tencent')).status,409);
  assert.equal((await send(new File(['x'],'x.jpg',{type:'image/jpeg'}),'google')).status,400);
  assert.equal((await send(new File([new Uint8Array(4_000_001)],'x.jpg',{type:'image/jpeg'}),'google')).status,413);
  assert.equal(calls,0);
});
