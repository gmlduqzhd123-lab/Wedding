import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent,parseContent} from '../assets/js/content.js';
import {climateReview} from '../assets/js/travel.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
test('missing climate data never invents a month or a mismatch, including legacy empty May plans',()=>{
  for(const month of [null,undefined,5]){
    const data=structuredClone(original),trip=data.honeymoon[0];trip.plan.climate=' \n';trip.plan.climateMonth=month;
    const saved=validateContent(data),review=climateReview(saved.honeymoon[0]);
    assert.equal(review.title,'기후 자료 미입력');assert.equal(review.summary,'기후 자료 미입력');assert.equal(review.month,null);assert.equal(review.changedMonth,false);
    assert.deepEqual(parseContent(JSON.stringify(saved)),saved);
    assert.equal(saved.honeymoon[0].plan.climateMonth,month??null,'legacy month values remain preserved without being presented as climate evidence');
  }
  assert.equal(climateReview({startDate:'',endDate:''}).summary,'기후 자료 미입력');
});
test('month warnings require both climate text and a known month and preserve registered June data',()=>{
  const trip=validateContent(original).honeymoon[0];let state=climateReview(trip);
  assert.equal(state.title,'6월 기후 경향·출처');assert.equal(state.changedMonth,false);
  trip.endDate='2027-07-01';assert.equal(climateReview(trip).changedMonth,true);
  trip.startDate='';trip.endDate='';assert.equal(climateReview(trip).changedMonth,false);
  trip.plan.climateMonth=null;trip.startDate='2027-06-06';state=climateReview(trip);
  assert.equal(state.month,null);assert.equal(state.changedMonth,false);assert.match(state.summary,/기준 월 미입력/);assert(!state.summary.includes('null월'));assert(state.summary.includes(trip.plan.climate));
  for(const publicTrip of original.honeymoon)assert.equal(climateReview(publicTrip).month,6);
});
test('unknown month roundtrips, invalid months are rejected, and source metadata is preserved',()=>{
  const data=structuredClone(original),plan=data.honeymoon[0].plan;plan.climateMonth=null;
  const saved=parseContent(JSON.stringify(data));assert.equal(saved.honeymoon[0].plan.climateMonth,null);assert.equal(saved.honeymoon[0].plan.sourceUrl,plan.sourceUrl);assert.equal(saved.honeymoon[0].plan.climate,plan.climate);
  for(const value of [0,13,-1,1.5,'6',{},[]]){plan.climateMonth=value;assert.throws(()=>validateContent(data),/기후 안내 기준 월/);}
});
