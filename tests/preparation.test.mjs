import test from 'node:test';
import assert from 'node:assert/strict';
import {weddingBudgetSummary,guestListSummary,giftLedgerSummary,csvEscape,guestsToCsv,giftsToCsv,parseCsvRows,parseGuestsCsv,syncGuestsFromCsv,buildThankYouMessage,addCalendarMonths,prenatalDeadlineSummary,marriageBenefitTimeline,homeItemsSummary,homeItemsToCsv,weddingDaySummary,collectMasterTimeline,weddingPhaseInfo} from '../assets/js/planning.js';
import {buildInvitationShareMessages,isKakaoInApp,isInAppBrowser} from '../assets/js/invitation-card.js';

const keys=['venue','sdm','snap','rings','honeymoon','living'];
test('unknown wedding costs stay unknown, partial amounts are subtotals and notes do not imply zero',()=>{
 const empty=weddingBudgetSummary({},keys);
 assert.deepEqual(empty.planned,{known:null,entered:0,missing:6,complete:false});
 assert.equal(empty.actual.known,null);assert.equal(empty.difference,null);
 const partial=weddingBudgetSummary({venue:{planned:20000000,actual:null},sdm:{note:'상담 전'}},keys);
 assert.deepEqual(partial.planned,{known:20000000,entered:1,missing:5,complete:false});
 assert.equal(partial.actual.known,null);assert.equal(partial.difference,null);
 const actualOnly=weddingBudgetSummary({venue:{planned:null,actual:12000000}},keys);
 assert.equal(actualOnly.planned.known,null);assert.equal(actualOnly.actual.known,12000000);assert.equal(actualOnly.difference,null);
});
test('only all six confirmed targets and expenses yield a surplus, overrun or real zero',()=>{
 const plan=Object.fromEntries(keys.map(key=>[key,{planned:0,actual:0}]));
 assert.equal(weddingBudgetSummary(plan,keys).difference,0);
 plan.venue={planned:20000000,actual:12000000};
 assert.equal(weddingBudgetSummary(plan,keys).difference,8000000);
 plan.honeymoon.actual=9000000;assert.equal(weddingBudgetSummary(plan,keys).difference,-1000000);
 for(const key of keys){
  for(const field of ['planned','actual']){
   const partial=structuredClone(plan);partial[key][field]=null;
   const result=weddingBudgetSummary(partial,keys);assert.equal(result[field].complete,false);assert.equal(result.difference,null);
  }
 }
});
test('guest list and gift ledger summaries calculate headcounts, totals, and formula-safe CSV exports',()=>{
 const gSum=guestListSummary([
  {id:'g1',name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true,note:'=SUM(A1)'},
  {id:'g2',name:'김영희',side:'신부 측',group:'가족·친척',partySize:3,inviteStatus:'직접 전달',rsvp:'미확인',mealTicket:true},
  {id:'g3',name:'박민수',side:'공통',group:'직장·동료',partySize:1,inviteStatus:'미발송',rsvp:'불참',mealTicket:false}
 ]);
 assert.equal(gSum.totalRecords,3);
 assert.equal(gSum.totalInvitedHeadcount,6);
 assert.equal(gSum.attendingHeadcount,2);
 assert.equal(gSum.undecidedHeadcount,3);
 assert.equal(gSum.declinedHeadcount,1);
 assert.equal(gSum.possibleHeadcount,5);
 assert.equal(gSum.mealHeadcount,2);
 assert.equal(gSum.sentCount,2);
 assert.equal(gSum.unsentCount,1);
 assert.equal(gSum.bySide['신랑 측'].attending,2);
 assert.equal(gSum.bySide['신부 측'].possible,3);
 assert.equal(gSum.bySide['공통'].possible,0);

 const giftSum=giftLedgerSummary([
  {id:'f1',name:'홍길동',side:'신랑 측',group:'친구',channel:'축의대(현금)',amount:100000,mealTickets:2,returnGiftDone:true,thankYouDone:false},
  {id:'f2',name:'이수진',side:'신부 측',group:'직장·동료',channel:'계좌이체',amount:200000,mealTickets:0,returnGiftDone:false,thankYouDone:true}
 ]);
 assert.equal(giftSum.totalRecords,2);
 assert.equal(giftSum.totalAmount,300000);
 assert.equal(giftSum.totalMealTickets,2);
 assert.equal(giftSum.returnGiftPending,1);
 assert.equal(giftSum.thankYouPending,1);
 assert.equal(giftSum.bySide['신랑 측'].amount,100000);
 assert.equal(giftSum.byChannel['계좌이체'].amount,200000);

 assert.equal(csvEscape('=1+1'),"'=1+1");
 assert.equal(csvEscape('+cmd'),"'+cmd");
 assert.equal(csvEscape('a,"b"'),'"a,""b"""');
 const gCsv=guestsToCsv([{name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true,note:'=1+1'}]);
 assert(gCsv.startsWith('\uFEFF구분,관계,성함'));
 assert(gCsv.includes("'=1+1"));
 const fCsv=giftsToCsv([{name:'이수진',side:'신부 측',group:'직장·동료',channel:'계좌이체',amount:200000,mealTickets:0,returnGiftDone:false,thankYouDone:true,note:''}]);
 assert(fCsv.startsWith('\uFEFF구분,관계,성함,전달 방식,축의금(원)'));
 assert(fCsv.includes('200000'));
});

test('parseCsvRows and parseGuestsCsv round-trip exports, handle flexible headers, and reject malformed input',()=>{
 const exported=guestsToCsv([
  {name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true,note:'=SUM(A1), "채식"'},
  {name:'김영희',side:'신부 측',group:'직장·동료',partySize:1,inviteStatus:'종이 전달',rsvp:'불참',mealTicket:false,note:''}
 ]);
 const parsed=parseGuestsCsv(exported);
 assert.equal(parsed.records.length,2);
 assert.equal(parsed.records[0].name,'홍길동');
 assert.equal(parsed.records[0].partySize,2);
 assert.equal(parsed.records[0].mealTicket,true);
 assert.equal(parsed.records[0].note,'=SUM(A1), "채식"');
 assert.equal(parsed.records[1].side,'신부 측');
 assert.equal(parsed.records[1].rsvp,'불참');
 assert.equal(parsed.records[1].mealTicket,false);

 // Flexible alias headers + partySize > 20 cap warning + nameless row skip
 const customCsv='\uFEFF양가,소속,이름,인원,청첩장,참석,식사,비고\n신부,대학 동기,이민정,25,모바일,예,아니오,인원 보정 확인\n신랑,친구,,1,,,,\n,,,\n';
 const custom=parseGuestsCsv(customCsv);
 assert.equal(custom.records.length,1);
 assert.equal(custom.records[0].side,'신부 측');
 assert.equal(custom.records[0].group,'친구');
 assert.equal(custom.records[0].partySize,20);
 assert.equal(custom.records[0].inviteStatus,'모바일 발송');
 assert.equal(custom.records[0].rsvp,'참석');
 assert.equal(custom.records[0].mealTicket,false);
 assert.equal(custom.warnings.length,2);
 assert.equal(custom.skipped,1);

 assert.throws(()=>parseCsvRows('a,"unclosed'));
 assert.throws(()=>parseGuestsCsv('구분,관계\n신랑 측,친구'));
 assert.throws(()=>parseGuestsCsv('성함\n\n'));
});

test('buildThankYouMessage and buildInvitationShareMessages format couple details and omit missing fields gracefully',()=>{
 const inv={
  partner1:'김희엽',
  partner2:'유미혜',
  date:'2027-06-05',
  time:'15:00',
  venue:'순천아모르웨딩컨벤션 1층',
  address:'전라남도 순천시 서면 압곡길 94 (압곡리 607)'
 };
 const attended=buildThankYouMessage({name:'홍길동',side:'신랑 측',channel:'축의대(현금)',amount:100000},inv,'attended');
 const remote=buildThankYouMessage({name:'김영희',side:'신부 측',channel:'계좌이체',amount:100000},inv,'remote');
 assert(attended.includes('홍길동님')&&attended.includes('귀한 걸음')&&attended.includes('김희엽·유미혜'));
 assert(remote.includes('김영희님')&&remote.includes('따뜻한 마음')&&remote.includes('김희엽·유미혜'));

 const presets=buildInvitationShareMessages(inv,'https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation');
 assert.equal(presets.length,3);
 assert.deepEqual(presets.map(p=>p.id),['formal','friend','parents']);
 for(const p of presets){
  assert(p.text.includes('김희엽')&&p.text.includes('유미혜'));
  assert(p.text.includes('2027년 6월 5일')&&p.text.includes('오후 3시'));
  assert(p.text.includes('순천아모르웨딩컨벤션 1층'));
  assert(p.text.includes('https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation'));
 }

 const minimal=buildInvitationShareMessages({},'');
 assert.equal(minimal.length,3);
 assert(!minimal[0].text.includes('· 일시:')&&!minimal[0].text.includes('▶ 모바일 청첩장 보기'));
});

test('addCalendarMonths, prenatalDeadlineSummary, and marriageBenefitTimeline calculate month-end clamped deadlines accurately',()=>{
 assert.equal(addCalendarMonths('2026-11-30',3),'2027-02-28');
 assert.equal(addCalendarMonths('2027-01-31',1),'2027-02-28');
 assert.equal(addCalendarMonths('2027-06-05',6),'2027-12-05');
 assert.equal(addCalendarMonths('2027-06-05',18),'2028-12-05');
 assert.equal(addCalendarMonths('2027-06-05',-24),'2025-06-05');

 const now=new Date('2027-01-25T03:00:00Z'); // 2027-01-25 KST
 const urgentClaim=prenatalDeadlineSummary({appliedDate:'2026-11-10',examDate:'2026-12-30',claimed:false},now);
 assert.equal(urgentClaim.examDeadline,'2027-02-10');
 assert.equal(urgentClaim.claimDeadline,'2027-01-30');
 assert.equal(urgentClaim.claimDaysLeft,5);
 assert.equal(urgentClaim.status,'claim-urgent');
 assert.equal(urgentClaim.urgent,true);

 const claimed=prenatalDeadlineSummary({appliedDate:'2026-11-10',examDate:'2026-12-30',claimed:true},now);
 assert.equal(claimed.status,'claimed');
 assert.equal(claimed.urgent,false);

 const timeline2027=marriageBenefitTimeline('2027-06-07',new Date('2027-12-10T03:00:00Z'));
 assert.equal(timeline2027.congratsStart,'2027-12-07');
 assert.equal(timeline2027.congratsEnd,'2028-12-07');
 assert.equal(timeline2027.giftStart,'2025-06-07');
 assert.equal(timeline2027.giftEnd,'2029-06-07');
 assert.equal(timeline2027.congratsStatus,'open');
 assert(timeline2027.taxNote.includes('2027'));

 const timeline2026=marriageBenefitTimeline('2026-12-01',new Date('2026-12-10T03:00:00Z'));
 assert.equal(timeline2026.congratsStatus,'upcoming');
 assert(timeline2026.taxNote.includes('결혼세액공제'));
});

test('homeItemsSummary, homeItemsToCsv, and weddingDaySummary aggregate totals and escape CSV formulas',()=>{
 const hSum=homeItemsSummary([
  {id:'h1',category:'📺 가전',name:'냉장고',brand:'LG',status:'배송·설치 완료',plannedPrice:2500000,actualPrice:2300000,deposit:500000,deliveryDate:'2027-05-01',note:'=SUM(A1)'},
  {id:'h2',category:'🛋️ 가구',name:'침대',status:'계약·결제 완료',plannedPrice:2000000,actualPrice:1900000,deposit:400000}
 ]);
 assert.equal(hSum.totalCount,2);
 assert.equal(hSum.doneCount,1);
 assert.equal(hSum.contractedCount,2);
 assert.equal(hSum.plannedTotal,4500000);
 assert.equal(hSum.actualTotal,4200000);
 assert.equal(hSum.depositTotal,900000);
 assert.equal(hSum.balanceTotal,3300000);
 const csv=homeItemsToCsv([{category:'📺 가전',name:'냉장고',brand:'LG',status:'배송·설치 완료',plannedPrice:2500000,actualPrice:2300000,deposit:500000,deliveryDate:'2027-05-01',note:'=SUM(A1)'}]);
 assert(csv.startsWith('\uFEFF분류,품목명,브랜드·모델'));
 assert(csv.includes("'=SUM(A1)"));

 const dSum=weddingDaySummary(
  [{id:'r1',group:'축의대(신랑 측)',role:'접수',assignee:'김OO'},{id:'r2',group:'축의대(신부 측)',role:'접수',assignee:''}],
  [{id:'e1',payee:'사회자',amount:200000,ready:true},{id:'e2',payee:'촬영·본식 헬퍼',amount:250000,ready:false}]
 );
 assert.equal(dSum.roleCount,2);
 assert.equal(dSum.assignedRoles,1);
 assert.equal(dSum.envelopeCount,2);
 assert.equal(dSum.readyCount,1);
 assert.equal(dSum.totalEnvelopeAmount,450000);
 assert.equal(dSum.readyAmount,200000);
 assert.equal(dSum.pendingAmount,250000);
});

test('collectMasterTimeline aggregates and sorts events across all boards without duplicating default studio shoot',()=>{
 const events=collectMasterTimeline({
  content:{
   invitation:{partner1:'김희엽',partner2:'유미혜',date:'2027-06-05',time:'15:00',venue:'순천아모르웨딩컨벤션 1층',address:'전남 순천시 서면 압곡길 94'},
   honeymoon:[{id:'bali',title:'발리',country:'인도네시아',startDate:'2027-06-06',endDate:'2027-06-13'}]
  },
  prefs:{
   tripSelected:'bali',
   prenatalSchedule:{appliedDate:'2026-11-20',visitDate:'2026-11-28',examDate:'2026-11-28',claimed:false},
   homeItems:[{id:'h1',category:'📺 가전',name:'TV',brand:'LG',status:'계약·결제 완료',deliveryDate:'2027-05-15'}],
   marriageRegDate:'2027-06-10',
   vendorSchedules:[
    {id:'vsched-lachma-shoot',category:'📸 스튜디오',name:'라크마',date:'2027-02-03',done:false},
    {id:'v-dress',category:'👗 드레스',name:'본식 드레스 셀렉',date:'2027-04-20',done:false}
   ]
  },
  now:new Date('2026-12-23T03:00:00Z')
 });
 const ids=events.map(e=>e.id);
 assert(ids.includes('master-studio-shoot'));
 assert(!ids.includes('master-vendor-vsched-lachma-shoot'),'Default studio shoot must not duplicate');
 assert(ids.includes('master-vendor-v-dress'));
 assert(ids.includes('master-prenatal-claim-deadline'));
 assert(ids.includes('master-home-h1'));
 assert(ids.includes('master-wedding-day'));
 assert(ids.includes('master-honeymoon-bali'));
 assert(ids.includes('master-marriage-reg'));
 assert(ids.includes('master-suncheon-grant-start'));
 // Sorted chronologically
 for(let i=1;i<events.length;i++)assert(events[i].date>=events[i-1].date,'Master timeline must be chronologically sorted');
 // Claim deadline (2026-12-28) vs now (2026-12-23) is 5 days left -> urgent
 const claimEvt=events.find(e=>e.id==='master-prenatal-claim-deadline');
 assert.equal(claimEvt.urgent,true);
 // In-app browser detection
 assert.equal(isKakaoInApp('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) KAKAOTALK 10.6.0'),true);
 assert.equal(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) NAVER(inapp; search)'),true);
 assert.equal(isInAppBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/126.0.0.0 Safari/537.36'),false);
});

test('parseGuestsCsv recognizes Google Forms RSVP responses and syncGuestsFromCsv updates existing guests cleanly',()=>{
 const rsvpCsv=[
  '타임스탬프,성함,어느 측 하객이신가요?,관계,참석 여부,동반 인원,식사 여부,축하 메시지',
  '2027-04-10 12:00:00,홍길동,신랑 김희엽 측,친구,참석합니다,1명,식사합니다,결혼 진심으로 축하해!',
  '2027-04-10 12:05:00,김영희,신부 유미혜 측,직장·동료,아쉽지만 참석이 어렵습니다,없음,식사 안 함 (답례품 수령),행복하게 잘 살아!',
  '2027-04-10 12:10:00,박신규,공통,지인·기타,참석 예정,본인 포함 3명,식사합니다,축하드립니다'
 ].join('\n');
 const parsed=parseGuestsCsv(rsvpCsv);
 assert.equal(parsed.isRsvpForm,true);
 assert.equal(parsed.records.length,3);
 assert.equal(parsed.records[0].side,'신랑 측');
 assert.equal(parsed.records[0].partySize,2,'Companion-only "1명" implies 2 total people');
 assert.equal(parsed.records[0].rsvp,'참석');
 assert.equal(parsed.records[0].mealTicket,true);
 assert.equal(parsed.records[0].inviteStatus,'모바일 발송');
 assert(parsed.records[0].note.includes('[축하] 결혼 진심으로 축하해!'));

 assert.equal(parsed.records[1].side,'신부 측');
 assert.equal(parsed.records[1].rsvp,'불참','"참석이 어렵습니다" must map to 불참, not 참석');
 assert.equal(parsed.records[1].partySize,1);
 assert.equal(parsed.records[1].mealTicket,false);

 assert.equal(parsed.records[2].partySize,3,'"본인 포함 3명" must stay 3');

 const existing=[
  {id:'g1',name:'홍길동',side:'신랑 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true,note:'대학 동기'},
  {id:'g2',name:'김영희',side:'공통',group:'지인·기타',partySize:2,inviteStatus:'모바일 발송',rsvp:'미확인',mealTicket:true}
 ];
 let seq=0;
 const synced=syncGuestsFromCsv(existing,parsed.records,'update',()=>`guest-new-${++seq}`);
 assert.equal(synced.updatedCount,2);
 assert.equal(synced.addedCount,1);
 assert.equal(synced.nextList.length,3);
 assert.equal(synced.nextList[0].rsvp,'참석');
 assert.equal(synced.nextList[0].partySize,2);
 assert.equal(synced.nextList[0].inviteStatus,'모바일 발송');
 assert(synced.nextList[0].note.includes('대학 동기')&&synced.nextList[0].note.includes('축하해'));
 assert.equal(synced.nextList[1].side,'신부 측');
 assert.equal(synced.nextList[1].rsvp,'불참');
 assert.equal(synced.nextList[1].mealTicket,false);
 assert.equal(synced.nextList[2].name,'박신규');
});

test('weddingPhaseInfo adapts home focus across all six wedding lifecycle stages',()=>{
 const base={
  content:{
   invitation:{partner1:'김희엽',partner2:'유미혜',date:'2027-06-05',time:'15:00',venue:'순천아모르웨딩컨벤션 1층'},
   albums:[],
   honeymoon:[{id:'bali',title:'발리',startDate:'2027-06-06',endDate:'2027-06-13'}]
  },
  prefs:{tripSelected:'bali'}
 };
 assert.equal(weddingPhaseInfo({...base,now:new Date('2026-11-24T03:00:00Z')}).phase,'pre-shoot');
 assert.equal(weddingPhaseInfo({...base,now:new Date('2027-01-25T03:00:00Z')}).phase,'shoot-week');
 assert.equal(weddingPhaseInfo({...base,now:new Date('2027-03-10T03:00:00Z')}).phase,'invitation-prep');
 assert.equal(weddingPhaseInfo({...base,now:new Date('2027-05-25T03:00:00Z')}).phase,'ceremony-countdown');
 const day=weddingPhaseInfo({...base,now:new Date('2027-06-05T03:00:00Z')});
 assert.equal(day.phase,'wedding-day');
 assert(day.actions.some(a=>a.action==='quick-gift'));
 assert.equal(weddingPhaseInfo({...base,now:new Date('2027-06-07T03:00:00Z')}).phase,'post-wedding');
});

