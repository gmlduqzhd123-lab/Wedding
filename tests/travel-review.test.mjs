import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent,parseContent} from '../assets/js/content.js';
import {emptyQuote,quoteBasis,quoteReview,currentBudgetText} from '../assets/js/travel.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
function quoted(){const trip=validateContent(original).honeymoon[0];trip.plan.stays=[{region:'시험 숙소 1',nights:2,checkIn:'',checkOut:''},{region:'시험 숙소 2',nights:4,checkIn:'',checkOut:''}];trip.plan.quote={...emptyQuote(),costs:{airfare:2200000,lodging:3000000,other:1500000},checkedOn:'2026-11-08',flightSource:'시험용 항공 견적 근거',lodgingSource:'시험용 숙박 견적 근거',departureAt:'2027-06-06T12:00',arrivalAt:'2027-06-13T08:00',includesRequiredCosts:true,basis:quoteBasis(trip)};return trip;}
test('unknown quote never establishes actual budget or flight dates; complete input includes reserve',()=>{
  const trip=validateContent(original).honeymoon[0];trip.plan.quote=emptyQuote();assert.equal(quoteReview(trip).complete,false);assert.equal(quoteReview(trip).total,null);assert.equal(quoteReview(trip).flightDates,false);
  const q=quoted();let review=quoteReview(q);assert.equal(review.total,7500000);assert(review.complete);assert.match(review.message,/입력 근거 기준/);
  q.plan.quote.costs.airfare=6000000;review=quoteReview(q);assert.equal(review.total,11300000);assert.match(review.message,/필수 항목 확인 완료/);
});
test('partial actual quotes immediately expose known subtotal without validating missing evidence',()=>{
  const trip=validateContent(original).honeymoon[0];trip.plan.quote=emptyQuote();let state=quoteReview(trip);
  assert.equal(state.known,null);assert.equal(state.assessed,null);assert.equal(state.excess,0);
  trip.plan.quote.costs.airfare=12000000;state=quoteReview(trip);
  assert.equal(state.known,12000000);assert.equal(state.assessed,12800000);assert.equal(state.excess,2800000);
  assert.equal(state.complete,false);assert.equal(state.total,null);assert.match(state.message,/12,800,000원/);assert.match(state.message,/실제 예산 충족 미확인/);
  trip.plan.costs.reserve=null;state=quoteReview(trip);assert.equal(state.excess,2000000);assert.match(state.amountMessage,/예비비 미입력/);
  trip.plan.quote.costs.airfare=0;state=quoteReview(trip);assert.equal(state.known,0);assert.equal(state.excess,0);assert(!state.message.includes('필수 항목 확인 완료'));
  trip.plan.quote.costs.lodging=11000000;state=quoteReview(trip);assert.equal(state.excess,1000000);
  trip.plan.quote.costs={airfare:2000000,lodging:7000000,other:null};trip.plan.costs.reserve=1000000;state=quoteReview(trip);assert.equal(state.excess,0);assert.equal(state.assessed,10000000);assert(!state.message.includes('필수 항목 확인 완료'));
  const stale=quoted();stale.plan.quote.costs.airfare=6000000;stale.endDate='2027-06-14';state=quoteReview(stale);assert(state.stale);assert.equal(state.excess,1300000);assert.equal(state.total,null);
});
test('quote dates, sources, inclusions, future check date and changed hotel conditions require review',()=>{
  for(const edit of [t=>t.plan.quote.costs.airfare=null,t=>t.plan.quote.flightSource='',t=>t.plan.quote.lodgingSource='',t=>t.plan.quote.includesRequiredCosts=false,t=>t.plan.quote.checkedOn='2099-01-01',t=>t.plan.quote.arrivalAt='2027-06-14T08:00',t=>t.plan.quote.departureAt='2027-06-07T12:00',t=>t.startDate='2027-06-07',t=>t.country='다른 지역',t=>t.plan.stays[0].region='다른 호텔권',t=>t.plan.stays[0].nights++,t=>t.plan.stays[0].checkIn='2027-06-06',t=>t.plan.costs.reserve=null,t=>t.plan.costs.reserve=0]){
    const trip=quoted();edit(trip);assert.equal(quoteReview(trip).complete,false);assert.equal(quoteReview(trip).total,null);
  }
  const trip=quoted();trip.plan.dateBasis={startDate:'2027-06-07',endDate:'2027-06-14'};trip.startDate='2027-06-07';trip.endDate='2027-06-14';assert(quoteReview(trip).stale,'updating stay warning basis never silently revalidates a quote');
});
test('quote/schema roundtrip preserves evidence, rejects invalid prices and instants, and supports older backups',()=>{
  const data=validateContent(original);data.honeymoon[0]=quoted();assert.deepEqual(parseContent(JSON.stringify(data)),data);
  for(const edit of [q=>q.costs.airfare=-1,q=>q.costs.lodging=1.1,q=>q.arrivalAt='2027-02-30T08:00',q=>q.arrivalAt='2027-06-13T25:00',q=>q.checkedOn='2027-02-30',q=>q.includesRequiredCosts='yes',q=>q.basis=null]){
    const bad=structuredClone(data);edit(bad.honeymoon[0].plan.quote);assert.throws(()=>validateContent(bad));
  }
  delete data.honeymoon[0].plan.quote;delete data.honeymoon[0].plan.narrativeVersion;
  assert.deepEqual(validateContent(data).honeymoon[0].plan.quote,emptyQuote());assert.equal(validateContent(data).honeymoon[0].plan.narrativeVersion,1);
});
test('dated research snapshots are labelled separately; generated text follows current costs and nights',()=>{
  for(const trip of original.honeymoon){assert.equal(trip.plan.narrativeVersion,2);for(const field of ['itinerary','lodgingNotes','budgetNotes'])assert.match(trip.plan[field],/^2026-11-09 (조회|조사 당시)/,trip.id+':'+field);}
  const trip=quoted();trip.plan.costs.airfare=2700000;trip.plan.stays[0].nights=3;
  const text=currentBudgetText(trip);assert.match(text,/항공 2,700,000원/);assert.match(text,/현재 7박/);assert(!text.includes('2,200,000원'));
});
