import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {budgetSummary,staySummary,upgradeLegacyTrip,dateSpan,stayReview} from '../assets/js/travel.js';
import {validateContent,parseContent} from '../assets/js/content.js';
import {mergeChanges} from '../assets/js/storage.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
const legacy=JSON.parse(await readFile(new URL('fixtures/legacy-trip.json',import.meta.url),'utf8'));

test('total edits compute balance and show the allocation gap instead of inventing costs',()=>{
  const trip=structuredClone(original.honeymoon[0]);trip.budget=8000000;
  const result=budgetSummary(trip);
  assert.equal(result.balance,2000000);assert.equal(result.known,7500000);assert.equal(result.unallocated,500000);assert.equal(result.excess,0);
  trip.plan.costs.airfare+=500000;assert.equal(budgetSummary(trip).unallocated,0);
});
test('over cap, null, zero reserve, and over-allocation remain distinct',()=>{
  const trip=structuredClone(original.honeymoon[0]);trip.budget=11000000;assert.equal(budgetSummary(trip).excess,1000000);
  trip.budget=7000000;assert.equal(budgetSummary(trip).unallocated,-500000);
  trip.plan.costs.reserve=0;assert.equal(budgetSummary(trip).reserve,0);
  trip.budget=null;trip.plan.costs.airfare=null;
  assert.equal(budgetSummary(trip).balance,null);assert(budgetSummary(trip).missing.includes('airfare'));
});
test('legacy supplied templates upgrade while preserving original text and extra notes',()=>{
  const trip=upgradeLegacyTrip({...legacy,budget:8000000,startDate:'2027-05-10',endDate:'2027-05-18',body:legacy.body+'\n\n나의 메모\n남겨 둘 내용'});
  assert.equal(trip.budget,8000000);assert.equal(trip.startDate,'2027-05-10');assert.equal(trip.endDate,'2027-05-18');
  assert.equal(trip.plan.costs.airfare,2200000);assert.match(trip.body,/남겨 둘 내용/);assert.match(trip.plan.legacyText,/5월 17일/);
  assert(!trip.plan.itinerary.includes('5월 17일'));assert(!trip.pros.includes('250만'));
  assert.match(staySummary(trip),/총 7박 가안/);
  const mixed=upgradeLegacyTrip({...legacy,cons:'초기 계획예산상 여유가 50만 원이며 공항 인근 추가 숙박 여부 확인 필요'});
  assert.equal(mixed.cons,'공항 인근 추가 숙박 여부 확인 필요');
});
test('structured backup round trip preserves all plans and rejects malformed amounts and stays',()=>{
  const valid=validateContent(original);assert.deepEqual(parseContent(JSON.stringify(valid)),valid);
  for(const edit of [p=>p.costs.airfare=-1,p=>p.costs.airfare=0.5,p=>p.stays[0].nights=0,p=>p.checkedOn='2027-02-30']){
    const data=structuredClone(original);edit(data.honeymoon[0].plan);assert.throws(()=>validateContent(data));
  }
  const nullPlan=structuredClone(original);nullPlan.honeymoon[0].plan=null;assert.throws(()=>validateContent(nullPlan));
});
test('independent cost edits from two tabs merge without losing either change',()=>{
  const base=structuredClone(original),local=structuredClone(base),remote=structuredClone(base);
  local.honeymoon[0].plan.costs.airfare=2500000;remote.honeymoon[0].plan.costs.reserve=800000;
  const result=mergeChanges(base,local,remote);assert.deepEqual(result.conflicts,[]);
  assert.equal(result.value.honeymoon[0].plan.costs.airfare,2500000);assert.equal(result.value.honeymoon[0].plan.costs.reserve,800000);
  assert.match(staySummary(original.honeymoon[4]),/총 6박 가안/);
});

test('unentered allocations remain unknown while explicitly entered zero is retained',()=>{
  const trip=structuredClone(original.honeymoon[0]);
  for(const key of Object.keys(trip.plan.costs))trip.plan.costs[key]=null;
  assert.equal(budgetSummary(trip).known,null);assert.equal(budgetSummary(trip).unallocated,null);
  trip.plan.costs.airfare=0;assert.equal(budgetSummary(trip).known,0);assert.equal(budgetSummary(trip).missing.length,3);
});
test('hotel calendar nights handle leap years and DST independently of timezone',()=>{
  assert.equal(dateSpan('2028-02-28','2028-03-01'),2);assert.equal(dateSpan('2027-03-13','2027-03-15'),2);
  for(const dates of [['2027-02-30','2027-03-03'],['','2027-05-10'],['2027-05-10','2027-05-09']])assert.equal(dateSpan(...dates),null);
  const data=structuredClone(original),stay=data.honeymoon[0].plan.stays[0];
  stay.checkIn='2027-05-09';stay.checkOut='2027-05-12';assert.equal(validateContent(data).honeymoon[0].plan.stays[0].nights,3);
  stay.nights=4;assert.throws(()=>validateContent(data),/박 수/);
  stay.nights=3;stay.checkOut='2027-05-08';assert.throws(()=>validateContent(data),/체크아웃/);
});
test('changed dates and implausibly short trips require review without silently altering stays',()=>{
  const trip=validateContent(original).honeymoon[0];assert.equal(stayReview(trip).warnings.length,0);
  assert.equal(stayReview(trip).dated,0);trip.endDate='2027-05-10';
  assert.equal(stayReview(trip).warnings.length,2);assert.equal(stayReview(trip).nights,7);
  trip.plan.dateBasis={startDate:trip.startDate,endDate:trip.endDate};assert.equal(stayReview(trip).changed,false);
  assert.equal(stayReview(trip).warnings.length,1);
  assert.deepEqual(parseContent(JSON.stringify({ ...validateContent(original),honeymoon:[trip]})).honeymoon[0],trip);
});

test('stay review detects overlaps including nonadjacent stays, reversed order, gaps and out-of-trip dates',()=>{
  const trip=validateContent(original).honeymoon[0];
  const stay=(checkIn,checkOut)=>({region:'가안',checkIn,checkOut,nights:dateSpan(checkIn,checkOut)});
  trip.plan.stays=[stay('2027-05-09','2027-05-12'),stay('2027-05-10','2027-05-14')];
  assert.match(stayReview(trip).message,/겹칩니다/);
  trip.plan.stays=[stay('2027-05-10','2027-05-11'),stay('2027-05-13','2027-05-14'),stay('2027-05-10','2027-05-12')];
  assert.match(stayReview(trip).message,/1·3/);assert.match(stayReview(trip).message,/입력 순서/);assert.match(stayReview(trip).message,/기록되지 않은/);
  trip.plan.stays=[stay('2030-05-09','2030-05-12')];assert.match(stayReview(trip).message,/날짜·연도/);
  trip.plan.stays=[{region:'가안',nights:3,checkIn:'2030-05-09',checkOut:''}];assert.match(stayReview(trip).message,/날짜·연도/);
  trip.plan.stays=[stay('2027-05-08','2027-05-10'),stay('2027-05-10','2027-05-12')];
  assert.equal(stayReview(trip).warnings.length,0,'same-day hotel transfer and one-day date-line margin are allowed');
  trip.plan.stays=[{region:'가안',nights:3,checkIn:'2027-05-09',checkOut:''}];assert.match(stayReview(trip).message,/0\/1곳/);
});

test('official climate source and personal reference survive edits and legacy imports independently',()=>{
  const data=structuredClone(original),trip=data.honeymoon[0],source=trip.plan.sourceUrl;
  trip.url='https://example.com/my-note';let saved=validateContent(data).honeymoon[0];
  assert.equal(saved.url,trip.url);assert.equal(saved.plan.sourceUrl,source);
  delete trip.plan.sourceUrl;saved=validateContent(data).honeymoon[0];
  assert.equal(saved.plan.sourceUrl,'');assert.equal(saved.url,trip.url,'legacy reference is never silently promoted to official');
  trip.plan.sourceUrl='javascript:alert(1)';assert.throws(()=>validateContent(data),/링크/);
});

test('Spain has three ordered stays matching the provided round trip and preserving total nights and costs',()=>{
  const trip=original.honeymoon.find(trip=>trip.id==='spain');
  assert.deepEqual(trip.plan.stays.map(({region,nights})=>[region,nights]),[['바르셀로나',1],['마요르카',3],['바르셀로나',3]]);
  assert.match(staySummary(trip),/바르셀로나 1박 → 마요르카 3박 → 바르셀로나 3박 · 총 7박/);
  assert.equal(trip.budget,9400000);assert.equal(budgetSummary(trip).known,9400000);
});
