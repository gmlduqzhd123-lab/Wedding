import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent,parseContent} from '../assets/js/content.js';
import {budgetSummary,stayReview} from '../assets/js/travel.js';
const raw=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));

test('ten public beach candidates satisfy the confirmed June dates and complete budget allocations',()=>{
  const data=validateContent(raw);
  assert.equal(data.honeymoon.length,10);assert.equal(new Set(data.honeymoon.map(t=>t.id)).size,10);
  assert.deepEqual(data.honeymoon.slice(0,3).map(t=>t.id),['bali','nhatrang','danang']);
  for(const trip of data.honeymoon){
    assert.equal(trip.startDate,'2027-06-06');assert.equal(trip.endDate,'2027-06-13');
    assert(trip.budget>0&&trip.budget<=10000000);assert.equal(budgetSummary(trip).unallocated,0);assert(trip.plan.costs.reserve>0);
    assert.equal(trip.plan.climateMonth,6);assert.equal(trip.plan.checkedOn,'2026-11-08');assert.equal(stayReview(trip).warnings.length,0);
    assert.equal(stayReview(trip).nights,['guam','danang'].includes(trip.id)?7:['lombok','maldives'].includes(trip.id)?5:6);
    assert.match(trip.plan.researchNotes,/최종 요금은 확인되지/);assert(trip.plan.comparisonNote);assert.match(trip.plan.sourceUrl,/^https:\/\//);
    for(const reference of trip.plan.references){assert(reference.title);assert.match(reference.url,/^https:\/\//);}
    assert(![trip.startDate,trip.endDate,...trip.plan.stays.flatMap(s=>[s.checkIn,s.checkOut])].some(date=>date.startsWith('2027-05-')));
  }
  assert.deepEqual(parseContent(JSON.stringify(data)),data);
  assert.equal(data.invitation.date,'2027-06-05');assert.equal(data.invitation.time,'15:00');
  for(const key of ['partner1','partner2','address','mapUrl','message'])assert.equal(data.invitation[key],'');
});

test('research provenance and safe source links survive round trips and reject malformed imports',()=>{
  const data=validateContent(raw),plan=data.honeymoon[0].plan;
  assert.equal(plan.researchNotes,raw.honeymoon[0].plan.researchNotes);assert.deepEqual(plan.references,raw.honeymoon[0].plan.references);
  for(const references of [null,{},Array(11).fill({title:'출처',url:'https://example.com'}),[null],[{title:'',url:'https://example.com'}],[{title:'출처',url:'javascript:alert(1)'}],[{title:'출처',url:'./relative'}]]){
    const bad=structuredClone(raw);bad.honeymoon[0].plan.references=references;
    // Omitted fields support old backups, but explicit null is not a valid source list.
    assert.throws(()=>validateContent(bad));
  }
  const legacy=structuredClone(raw);for(const key of ['references','researchNotes','comparisonNote'])delete legacy.honeymoon[0].plan[key];
  const restored=validateContent(legacy).honeymoon[0].plan;assert.deepEqual(restored.references,[]);assert.equal(restored.researchNotes,'');
});
