import test from 'node:test';
import assert from 'node:assert/strict';
import {weddingBudgetSummary,guestListSummary,giftLedgerSummary,csvEscape,guestsToCsv,giftsToCsv} from '../assets/js/planning.js';

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
