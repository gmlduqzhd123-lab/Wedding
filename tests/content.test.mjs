import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {parseContent,validateContent,validDate,safeUrl,formatDate,weddingDday} from '../assets/js/content.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
test('content export/import round trip preserves all six menu data including 50 wedding tips',()=>{
 assert.equal(original.tips.length,50);
 assert.equal(new Set(original.tips.map(t=>t.url)).size,50);
 const content=structuredClone(original);
 content.invitation.partner1='우리';content.invitation.date='2027-04-03';content.invitation.time='14:30';
 content.invitation.transit='순천역 택시 이용';content.invitation.notice='1층 연회장 식사 안내';
 content.stories=[{id:'memory-1',title:'처음 만난 날',date:'2026-11-04',body:'우리의 이야기',image:''}];
 content.albums=[{id:'album-1',title:'첫 앨범',date:'',body:'기록',images:['./assets/studios/01-1.jpg']}];
 content.honeymoon=[{id:'trip-1',title:'우리의 여행',country:'',startDate:'2027-04-04',endDate:'2027-04-10',budget:3000000,pros:'좋은 점',cons:'고민',body:'메모',url:'https://example.com'}];
 assert.deepEqual(parseContent(JSON.stringify(content)),content);
});
test('invalid import never normalizes into data that can overwrite a draft',()=>{
 assert.throws(()=>parseContent('{'));
 assert.throws(()=>parseContent('{}'));
 const missingId=structuredClone(original);missingId.stories=[{title:'ID 없는 기록',date:'',body:'',image:''}];assert.throws(()=>validateContent(missingId));
 const content=structuredClone(original);content.invitation.date='2027-02-30';
 assert.throws(()=>validateContent(content));
 content.invitation.date='';content.invitation.mapUrl='javascript:alert(1)';assert.throws(()=>validateContent(content));
});
test('dates and links do not depend on the host timezone or permit scripts',()=>{
 assert(validDate('2028-02-29'));assert(!validDate('2027-02-29'));
 assert(formatDate('2026-11-04').includes('11월 4일'));
 assert.equal(weddingDday('2027-06-05','2026-11-08'),'D-209');
 assert.equal(weddingDday('2027-06-05','2027-06-05'),'D-Day');
 assert.equal(weddingDday('2027-06-05','2027-06-08'),'D+3');
 assert.equal(weddingDday('','2026-11-08'),'');
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,hi'), '');
 assert.equal(safeUrl(' https://example.com'), '');
 assert.equal(safeUrl('./assets/studios/01-1.jpg',{image:true}),'./assets/studios/01-1.jpg');
});
test('duplicate IDs and reversed travel dates are rejected',()=>{
 const content=structuredClone(original);const story={id:'same',title:'기록',date:'',body:'',image:''};
 content.stories=[story,story];assert.throws(()=>validateContent(content));
 content.stories=[];content.honeymoon=[{id:'trip',title:'여행',country:'',startDate:'2027-04-10',endDate:'2027-04-01',budget:null,pros:'',cons:'',body:'',url:''}];
 assert.throws(()=>validateContent(content));
});
