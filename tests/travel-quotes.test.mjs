import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent,parseContent} from '../assets/js/content.js';
import {quoteReview,quoteBasis,dateSpan} from '../assets/js/travel.js';
const source=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
// Research acceptance values: 2 adults roundtrip, room plus displayed charges.
const checked={
 bali:[2603400,1584721,'07:55','06-06','06-12'],
 nhatrang:[1610600,1435786,'07:25','06-06','06-12'],
 danang:[1159000,830097,'22:30','06-06','06-13'],
 guam:[1450000,1658027+182383,'21:00','06-06','06-13'],
 hawaii:[2671800,2206721+983196,'17:45','06-06','06-12']
};
test('published research matches date-specific quotes, local hotel nights and June 13 Korean arrivals',()=>{
 const data=validateContent(source);
 assert.deepEqual(data.honeymoon.map(t=>t.id),Object.keys(checked));
 for(const trip of data.honeymoon){
  const [airfare,lodging,arrival,cin,cout]=checked[trip.id],p=trip.plan,q=p.quote;
  assert.equal(q.costs.airfare,airfare,trip.id);assert.equal(q.costs.lodging,lodging,trip.id);
  assert.equal(q.arrivalAt,'2027-06-13T'+arrival);assert(q.departureAt.startsWith('2027-06-06T'));
  assert.equal(q.checkedOn,'2026-11-09');assert.deepEqual(q.basis,quoteBasis(trip));
  assert.equal(p.stays.length,1);assert.equal(p.stays[0].checkIn,'2027-'+cin);assert.equal(p.stays[0].checkOut,'2027-'+cout);
  assert.equal(p.stays[0].nights,dateSpan('2027-'+cin,'2027-'+cout));
  const flight=new URL(p.references.find(r=>r.title.startsWith('날짜 지정 항공사')).url);
  assert.match(flight.searchParams.get('q'),/on 2027-06-06.*2 adults/);
  const hotel=new URL(p.references.find(r=>r.title.startsWith('날짜 지정 객실')).url);
  assert.equal(hotel.searchParams.get('checkin'),'2027-'+cin);assert.equal(hotel.searchParams.get('checkout'),'2027-'+cout);
  assert.equal(hotel.searchParams.get('group_adults'),'2');assert.equal(hotel.searchParams.get('no_rooms'),'1');
  assert.equal(p.costs.airfare,airfare);assert.equal(p.costs.lodging,lodging);
 }
 assert.deepEqual(parseContent(JSON.stringify(data)),data);
});
test('unknown costs and taxes remain incomplete instead of being silently zeroed or certified within budget',()=>{
 for(const trip of validateContent(source).honeymoon){
  const q=trip.plan.quote,result=quoteReview(trip,'2026-11-09');
  assert.equal(q.costs.other,null);assert.equal(q.includesRequiredCosts,false);
  assert.equal(result.complete,false);assert.equal(result.total,null);assert.equal(result.flightDates,true);assert.equal(result.stale,false);
  assert.equal(result.known,q.costs.airfare+q.costs.lodging);assert(result.missing.includes('기타 여행비 견적'));
  assert.match(trip.plan.budgetNotes,/기타 여행비.*안의 일부/);assert.match(trip.plan.transport,/실시간 환율.*아닙니다/);
 }
 const p=id=>source.honeymoon.find(t=>t.id===id).plan;
 assert.match(p('guam').budgetNotes,/182,383원|조회 소계/);
 assert.match(p('hawaii').transport,/983,196원|리조트피/);
});
