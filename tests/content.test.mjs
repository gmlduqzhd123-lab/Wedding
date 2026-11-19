import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {parseContent,validateContent,validDate,safeUrl,formatDate,weddingDday,invitationCountdownInfo,invitationLiveCountdown,extractPhoneNumber,extractAccountNumber,summarizeContentDiff} from '../assets/js/content.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
test('content export/import round trip preserves all six menu data including 50 wedding tips',()=>{
 assert.equal(original.tips.length,50);
 assert.equal(new Set(original.tips.map(t=>t.url)).size,50);
 const content=structuredClone(original);
 content.invitation.partner1='우리';content.invitation.date='2027-04-03';content.invitation.time='14:30';
 content.invitation.groomParents='김○○ · 이○○의 장남';content.invitation.brideParents='유○○ · 박○○의 차녀';
 content.invitation.transit='순천역 택시 이용';content.invitation.notice='1층 연회장 식사 안내';content.invitation.contacts='신랑측 연락처 · 010-0000-0000';
 content.invitation.groomAccounts='신랑 김희엽 · 카카오뱅크 3333-01-2345678';content.invitation.brideAccounts='신부 유미혜 · 국민은행 123401-04-123456';
 content.invitation.rsvpUrl='https://docs.google.com/forms/d/e/example/viewform';
 content.invitation.venueMapImage='./assets/studios/01-1.jpg';
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
 content.invitation.mapUrl='';content.invitation.rsvpUrl='javascript:alert(1)';assert.throws(()=>validateContent(content));
 content.invitation.rsvpUrl='';content.invitation.venueMapImage='javascript:alert(1)';assert.throws(()=>validateContent(content));
 content.invitation.venueMapImage='';content.invitation.groomParents='가'.repeat(201);assert.throws(()=>validateContent(content));
});
test('dates and links do not depend on the host timezone or permit scripts',()=>{
 assert(validDate('2028-02-29'));assert(!validDate('2027-02-29'));
 assert(formatDate('2026-11-04').includes('11월 4일'));
 assert.equal(weddingDday('2027-06-05','2026-11-08'),'D-209');
 assert.equal(weddingDday('2027-06-05','2027-06-05'),'D-Day');
 assert.equal(weddingDday('2027-06-05','2027-06-08'),'D+3');
 assert.equal(weddingDday('','2026-11-08'),'');
 assert.deepEqual(invitationCountdownInfo('2027-06-05','2026-11-08'),{status:'future',days:209});
 assert.deepEqual(invitationCountdownInfo('2027-06-05','2027-06-05'),{status:'today',days:0});
 assert.deepEqual(invitationCountdownInfo('2027-06-05','2027-06-08'),{status:'past',days:3});
 assert.equal(invitationCountdownInfo('','2026-11-08'),null);
 assert.deepEqual(invitationLiveCountdown('2027-06-05','15:00',Date.parse('2027-06-04T13:58:55+09:00')),{status:'future',days:1,hours:1,minutes:1,seconds:5,hasTime:true});
 assert.deepEqual(invitationLiveCountdown('2027-06-05','15:00',Date.parse('2027-06-05T15:30:00+09:00')),{status:'ongoing',days:0,hours:0,minutes:0,seconds:0,hasTime:true});
 assert.deepEqual(invitationLiveCountdown('2027-06-05','15:00',Date.parse('2027-06-05T19:00:00+09:00')),{status:'past',days:0,hours:4,minutes:0,seconds:0,hasTime:true});
 assert.equal(invitationLiveCountdown('','15:00',Date.parse('2027-06-04T12:00:00+09:00')),null);
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,hi'), '');
 assert.equal(safeUrl(' https://example.com'), '');
 assert.equal(safeUrl('./assets/studios/01-1.jpg',{image:true}),'./assets/studios/01-1.jpg');
});
test('phone and bank account extractors distinguish mobile numbers from bank accounts',()=>{
 assert.deepEqual(extractPhoneNumber('신랑 김희엽 010-1234-5678'),{display:'010-1234-5678',digits:'01012345678',isMobile:true});
 assert.deepEqual(extractPhoneNumber('웨딩홀 문의 061-752-9000'),{display:'061-752-9000',digits:'0617529000',isMobile:false});
 assert.equal(extractPhoneNumber('카카오뱅크 3333-01-2345678'),null);
 assert.deepEqual(extractAccountNumber('신랑 김희엽 · 카카오뱅크 3333-01-2345678'),{display:'3333-01-2345678',digits:'3333012345678'});
 assert.deepEqual(extractAccountNumber('신부 아버지 · 농협 302-1234-5678-91'),{display:'302-1234-5678-91',digits:'3021234567891'});
 assert.equal(extractAccountNumber('신랑 김희엽 010-1234-5678'),null);
 assert.deepEqual(extractAccountNumber('신랑 국민은행 010-1234-5678',{allowPhoneLike:true}),{display:'010-1234-5678',digits:'01012345678'});
 assert.deepEqual(extractAccountNumber('신랑 010-1234-5678 / 카카오뱅크 3333-01-2345678'),{display:'3333-01-2345678',digits:'3333012345678'});
});
test('duplicate IDs and reversed travel dates are rejected',()=>{
 const content=structuredClone(original);const story={id:'same',title:'기록',date:'',body:'',image:''};
 content.stories=[story,story];assert.throws(()=>validateContent(content));
 content.stories=[];content.honeymoon=[{id:'trip',title:'여행',country:'',startDate:'2027-04-10',endDate:'2027-04-01',budget:null,pros:'',cons:'',body:'',url:''}];
 assert.throws(()=>validateContent(content));
});
test('summarizeContentDiff reports invitation changes and collection additions, edits, removals, and reorders',()=>{
 const same=summarizeContentDiff(original,structuredClone(original));
 assert.equal(same.hasChanges,false);
 assert.equal(same.totalChanges,0);

 const base=structuredClone(original);
 base.albums=[
  {id:'alb-1',title:'첫 앨범',date:'2027-02-03',body:'촬영',images:[]},
  {id:'alb-2',title:'둘째 앨범',date:'2027-03-01',body:'데이트',images:[]}
 ];
 const draft=structuredClone(base);
 draft.invitation.groomParents='홍길동 · 김영희 의 장남'; // added
 draft.invitation.venue='순천아모르웨딩컨벤션 2층'; // modified
 draft.invitation.address=''; // removed
 draft.stories.push({id:'st-new',title:'프러포즈 날',date:'2026-12-24',body:'행복한 날',image:''});
 draft.albums=[draft.albums[1],draft.albums[0]]; // reordered
 draft.honeymoon[0]={...draft.honeymoon[0],pros:'직접 수정한 장점'}; // modified
 draft.tips=draft.tips.slice(1); // removed 1 tip

 const diff=summarizeContentDiff(base,draft);
 assert.equal(diff.hasChanges,true);
 assert.deepEqual(diff.invitationFields.map(f=>[f.key,f.status]),[
  ['groomParents','added'],
  ['venue','modified'],
  ['address','removed']
 ]);
 assert.equal(diff.collections.stories.added,1);
 assert.deepEqual(diff.collections.stories.addedTitles,['프러포즈 날']);
 assert.equal(diff.collections.albums.reordered,true);
 assert.equal(diff.collections.albums.total,1);
 assert.equal(diff.collections.honeymoon.modified,1);
 assert.equal(diff.collections.tips.removed,1);
 assert.equal(diff.totalChanges,7);
});
