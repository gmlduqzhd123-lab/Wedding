import test from 'node:test';
import assert from 'node:assert/strict';
import {weddingBudgetSummary} from '../assets/js/planning.js';

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
