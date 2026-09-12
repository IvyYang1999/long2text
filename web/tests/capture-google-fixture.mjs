// Optional explicit live capture of the repository's fictional public demo only.
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const image=readFileSync(new URL('../public/samples/en-chat.jpg',import.meta.url));
const response=await fetch('https://vision.googleapis.com/v1/images:annotate?prettyPrint=false',{
  method:'POST',signal:AbortSignal.timeout(45000),
  headers:{'Content-Type':'application/json','Content-Encoding':'gzip','Accept-Encoding':'gzip','User-Agent':'Long2Text/1.0 (gzip)','X-Goog-Api-Key':process.env.API_KEY,'X-Goog-FieldMask':'responses.error,responses.fullTextAnnotation'},
  body:gzipSync(JSON.stringify({requests:[{image:{content:image.toString('base64')},features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})),
});
if(!response.ok)throw Error('Fixture capture failed');
const data=await response.json();
const a=data.responses?.[0]?.fullTextAnnotation;
if(!a?.pages?.length)throw Error('Fixture capture failed');
delete a.text;
for(const page of a.pages)for(const block of page.blocks)block.paragraphs=block.paragraphs.filter(p=>Math.min(...p.boundingBox.vertices.map(v=>v.y||0))<700);
writeFileSync(new URL('fixtures/google-chat-wraps.json',import.meta.url),JSON.stringify(a));
console.log('Captured fictional chat wrapping fixture; one Google request');
