import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {venueEstimate,studioFeeInfo,sdmEstimate,shootDeadlineSummary} from '../assets/js/planning.js';
import {climateBadgeInfo} from '../assets/js/travel.js';
import {validateContent,parseContent} from '../assets/js/content.js';
const raw=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
test('climate badges and dry filters use reviewed month categories rather than negated or unrelated season words',()=>{
 const trips=validateContent(raw).honeymoon;
 assert.deepEqual(trips.filter(t=>climateBadgeInfo(t).dry).map(t=>t.id),['bali','nhatrang']);
 const find=id=>climateBadgeInfo(trips.find(t=>t.id===id));
 assert.match(find('nhatrang').label,/덥고 맑은/);assert.match(find('guam').label,/전환기/);
 assert.match(find('danang').label,/더위 유의/);assert.match(find('hawaii').label,/여름철/);
 const t=structuredClone(trips[0]);
 t.plan.climateSummary={month:6,category:'variable'};assert.match(climateBadgeInfo(t).label,/산발적 비/);
 t.plan.climate='우기라는 말과 건기라는 말이 있어도 분류를 추측하지 않음';t.plan.climateSummary=null;
 assert.equal(climateBadgeInfo(t).dry,false);assert.match(climateBadgeInfo(t).label,/미분류/);
 t.plan.climateSummary={month:6,category:'dry'};t.startDate='2027-07-06';assert.equal(climateBadgeInfo(t).dry,false);assert.match(climateBadgeInfo(t).label,/재확인/);
 t.startDate='2027-06-06';t.plan.climateMonth=7;assert.equal(climateBadgeInfo(t).dry,false);
 t.plan.climate='';assert.match(climateBadgeInfo(t).label,/미입력/);assert.equal(climateBadgeInfo(t).dry,false);
});
test('climate summary roundtrips, old backups remain unclassified, and invalid categories/months are rejected',()=>{
 const data=validateContent(raw);assert.deepEqual(parseContent(JSON.stringify(data)),data);
 for(const summary of [{month:0,category:'dry'},{month:13,category:'dry'},{month:6,category:'unknown'},'dry',[]]){
  const bad=structuredClone(raw);bad.honeymoon[0].plan.climateSummary=summary;assert.throws(()=>validateContent(bad));
 }
 const old=structuredClone(raw);delete old.honeymoon[0].plan.climateSummary;assert.equal(validateContent(old).honeymoon[0].plan.climateSummary,null);
});
test('missing venue expenses never become a complete total or an assumed zero balance',()=>{
 assert.equal(venueEstimate().subtotal,null);assert.equal(venueEstimate().total,null);
 const partial=venueEstimate({hallFee:1000000});assert.equal(partial.subtotal,1000000);assert.equal(partial.total,null);assert.equal(partial.balance,null);assert.equal(partial.complete,false);
 const full={mealPrice:55000,guestCount:180,minGuarantee:200,hallFee:1000000,deposit:1000000};
 for(const key of ['mealPrice','guestCount','minGuarantee','hallFee'])assert.equal(venueEstimate({...full,[key]:null}).complete,false,key);
 const noDeposit=venueEstimate({...full,deposit:null});assert.equal(noDeposit.total,12000000);assert.equal(noDeposit.balance,null);assert.equal(noDeposit.complete,true);
 const result=venueEstimate(full);assert.equal(result.billedGuests,200);assert.equal(result.mealTotal,11000000);assert.equal(result.total,12000000);assert.equal(result.balance,11000000);
 assert.equal(venueEstimate({...full,guestCount:250}).total,14750000);
 const zero=venueEstimate({mealPrice:0,guestCount:0,minGuarantee:0,hallFee:0,deposit:0});assert.equal(zero.complete,true);assert.equal(zero.total,0);assert.equal(zero.balance,0);
 assert.equal(venueEstimate({...full,deposit:13000000}).overpaid,1000000);
});
test('unconfirmed studio fees are never described as no additional charge',async()=>{
 const studios=JSON.parse(await readFile(new URL('../data/studios.json',import.meta.url),'utf8'));
 const unknown=studios.filter(s=>studioFeeInfo(s).unknown);assert.equal(unknown.length,19);
 for(const s of unknown){assert.equal(studioFeeInfo(s).label,'💡 추가금 미확인');assert(!studioFeeInfo(s).label.includes('없음'));}
 const known=studios.find(s=>s.fee.includes('11만 원'));assert(studioFeeInfo(known).label.includes('11만 원'));assert.equal(studioFeeInfo(known).unknown,false);
});
test('sdmEstimate and shootDeadlineSummary preserve missing fields and compute exact LACMA deadlines',()=>{
 assert.equal(sdmEstimate().subtotal,null);assert.equal(sdmEstimate().total,null);
 const partial=sdmEstimate({helperFee:250000,roadScene:true});
 assert.equal(partial.subtotal,420000);assert.equal(partial.total,null);assert.equal(partial.complete,false);
 const full=sdmEstimate({packageFee:2800000,helperFee:250000,extraFee:330000,roadScene:true,nightShoot:false,deposit:500000});
 assert.equal(full.complete,true);assert.equal(full.total,3550000);assert.equal(full.balance,3050000);
 const dl=shootDeadlineSummary('2027-02-03',new Date('2026-11-11T00:00:00Z'));
 assert.equal(dl.daysLeft,84);assert.equal(dl.nightDeadline,'2027-01-27');assert.equal(dl.preHolidayDate,'2027-01-31');assert.equal(dl.penaltyIndex,0);
});
