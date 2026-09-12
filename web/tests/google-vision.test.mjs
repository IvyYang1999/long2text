import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';
import {readFileSync} from 'node:fs';

const { visionToBlocks } = loadTs('src/lib/google-vision-adapter.ts');
const box = (x, y, w = 10, h = 20) => ({ vertices: [{ x, y }, { x: x+w, y }, { x:x+w, y:y+h }, { x, y:y+h }] });
const symbol = (text, x, y, type, confidence = .9, isPrefix = false) => ({ text, confidence, boundingBox:box(x,y), property:{detectedBreak:{type,isPrefix}} });
const annotation = symbols => ({ pages:[{ width:100,height:200,blocks:[{paragraphs:[{words:[{symbols}]}]}] }] });

test('symbols become visual lines, preserving spaces, punctuation and original coordinates', () => {
  const result = visionToBlocks(annotation([
    symbol('李',0,0),symbol('玄',10,0,'LINE_BREAK'),
    symbol('Hi',0,30,'SPACE'),symbol('!',30,30,'LINE_BREAK'),
  ]),100,200);
  assert.deepEqual(result.map(b => b.text),['李玄','Hi !']);
  assert.deepEqual({...result[0],paragraphId:undefined},{text:'李玄',x:0,y:0,width:20,height:20,confidence:90,paragraphId:undefined});
});
test('wraps, prefix breaks and missing break metadata never merge different rows', () => {
  const result = visionToBlocks(annotation([
    symbol('a',0,0,'EOL_SURE_SPACE'),symbol('b',0,30),
    symbol('c',0,60,'LINE_BREAK',.8,true),symbol('d',0,90),
  ]),100,200);
  assert.deepEqual(result.map(b=>b.text),['a','b','c','d']);
});
test('missing vertex axes mean zero; missing confidence remains uncertain', () => {
  const s={text:'零',boundingBox:{vertices:[{}, {x:10},{x:10,y:20},{y:20}]}};
  const [b]=visionToBlocks(annotation([s]),100,200);
  assert.equal(b.x,0); assert.equal(b.y,0); assert.equal(b.confidence,0);
});
test('blank images work, but resized pages and missing geometry fail closed', () => {
  assert.deepEqual(visionToBlocks({},100,200),[]);
  assert.throws(()=>visionToBlocks(annotation([]),50,100),/dimensions/);
  assert.throws(()=>visionToBlocks(annotation([{text:'lost'}]),100,200),/geometry/);
});

test('recorded public Google output keeps wrapped English bubbles under one speaker',()=>{
  const raw=JSON.parse(readFileSync(new URL('fixtures/google-chat-wraps.json',import.meta.url)));
  const blocks=visionToBlocks(raw,750,7146);
  const {structure}=loadTs('src/lib/structure.ts');
  const result=structure([{index:0,yStart:0,yEnd:7146,blocks}],750,'chat',{me:'Me',other:'Them'});
  assert.match(result.markdown,/\*\*Maya\*\*：I might be 30 minutes late for Friday's review a client call just came up\./);
  assert.match(result.markdown,/\*\*Maya\*\*：Great\. I updated the numbers in part three, please use the v3 deck\./);
  assert.doesNotMatch(result.markdown,/\*\*Them\*\*：(?:Friday|just|deck)/);
});

test('line fragment merging preserves separate columns and timestamp cells',()=>{
  const {mergeLineFragments}=loadTs('src/lib/google-vision-adapter.ts');
  const cell=(text,x,y=0)=>({text,x,y,width:40,height:20,confidence:90});
  assert.equal(mergeLineFragments([cell('Alice',0),cell('12:30',55)]).length,2);
  assert.equal(mergeLineFragments([cell('left',0),cell('right',300)]).length,2);
  assert.equal(mergeLineFragments([cell('first',0),cell('next',0,30)]).length,2);
});
