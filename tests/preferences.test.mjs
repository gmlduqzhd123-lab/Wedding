import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreferences, parsePreferencesBackup, persistPreferences, pruneTripPreferences } from '../assets/js/preferences.js';

test('private backup preserves notes and choices independently of public content',()=>{
  const preferences=validatePreferences({favorites:['s01'],notes:{s01:'개인 상담 메모'},left:'s01',right:'s02',tripCompare:['trip1','trip2'],tripFavorites:['trip1'],tripSelected:'trip2'});
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences});
  assert.deepEqual(parsePreferencesBackup(raw),preferences);
  assert.throws(()=>parsePreferencesBackup('{'));
  assert.throws(()=>parsePreferencesBackup(JSON.stringify({schemaVersion:1,invitation:{}})));
});
test('malformed preferences are rejected before any storage write',()=>{
  let writes=0;const storage={setItem(){writes++;}};
  for(const next of [{favorites:'s01'},{notes:[]},{notes:{s01:123}},{tripCompare:['a','b','c']},{left:4}])assert.throws(()=>persistPreferences(storage,'prefs',next));
  assert.equal(writes,0);
});
test('failed persistence leaves caller state unchanged',()=>{
  let prefs=validatePreferences({favorites:['s01']});
  const before=structuredClone(prefs);
  assert.throws(()=>{prefs=persistPreferences({setItem(){throw new Error('quota');}},'prefs',{...prefs,favorites:['s02']});});
  assert.deepEqual(prefs,before);
  let stored;
  prefs=persistPreferences({setItem(key,value){stored=JSON.parse(value);}},'prefs',{...prefs,favorites:['s02']});
  assert.deepEqual(prefs,stored);assert.deepEqual(prefs.favorites,['s02']);
});

test('removed trip choices are pruned without changing studio preferences or the input',()=>{
  const prefs=validatePreferences({favorites:['s01'],notes:{s01:'개인 메모'},left:'s01',tripFavorites:['old','kept'],tripCompare:['old','kept'],tripSelected:'old'});
  const before=structuredClone(prefs),clean=pruneTripPreferences(prefs,[{id:'kept'}]);
  assert.deepEqual(clean.tripCompare,['kept']);assert.deepEqual(clean.tripFavorites,['kept']);assert.equal(clean.tripSelected,undefined);
  assert.deepEqual(clean.notes,prefs.notes);assert.deepEqual(clean.favorites,prefs.favorites);assert.equal(clean.left,'s01');assert.deepEqual(prefs,before);
});
test('checklist, budgetPlan, packingList, customPackingList, checklistNotes, customChecklist, ceremonyPlan, venueSim, and studioSelected persist in private preferences backup and reject invalid values',()=>{
  const prefs=validatePreferences({
    studioSelected:'s05',
    checklist:['d180-hall','d120-dress','custom-1'],
    packingList:['pack-passport','pack-cards','cpack-1'],
    shootChecklist:['shoot-0-0','shoot-1-2'],
    ceremonyChecks:['cchk-mc','cchk-vows'],
    customPackingList:[{id:'cpack-1',category:'📄 필수 서류·결제',title:'영문 가족관계증명서'}],
    checklistNotes:{'d180-hall':'순천아모르 1층 예약 확인'},
    tripNotes:{bali:'풀빌라 2박 특전 확인'},
    tipNotes:{'tip-01':'드레스 피팅 시 촬영용 체크'},
    customChecklist:[{id:'custom-1',stage:'D-60 ~ D-30',title:'청첩장 모임 식당 예약'}],
    vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마 스튜디오 웨딩촬영 (낮 12:00)',date:'2027-02-03',done:false,note:'062-714-1970 정오 자연광 촬영'}],
    budgetPlan:{venue:{planned:15000000,actual:14200000,note:'식대 포함'},sdm:{planned:3500000,actual:null}},
    venueSim:{mealPrice:55000,guestCount:250,minGuarantee:200,hallFee:2500000,deposit:1000000,note:'순천아모르웨딩컨벤션'},
    sdmSim:{packageFee:2800000,helperFee:250000,extraFee:330000,deposit:500000,roadScene:true,nightShoot:false,note:'라크마 2/3 촬영'},
    ceremonyPlan:{style:'noOfficiant',mc:'친구 김OO',song:'축가 미정',speech:'양가 아버님 덕담',banquetFloor:'2층',note:'입장곡 체크',vows:'첫 번째, 사랑하겠습니다.',declaration:'이 결혼이 진실하게 이루어졌음을 선언합니다.'}
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:prefs});
  assert.deepEqual(parsePreferencesBackup(raw),prefs);
  const pruned=pruneTripPreferences({...prefs,tripNotes:{bali:'유지',removed:'삭제'}},[{id:'bali'}]);
  assert.deepEqual(pruned.tripNotes,{bali:'유지'});
  for(const bad of [
    {studioSelected:123},
    {checklist:['bad id!']},
    {packingList:['bad id!']},
    {shootChecklist:['bad id!']},
    {ceremonyChecks:['bad id!']},
    {customPackingList:[{id:'cpack-1',category:'없는 분류',title:'준비물'}]},
    {checklistNotes:{'bad id!':'메모'}},
    {tripNotes:{'bad id!':'메모'}},
    {tipNotes:{'tip-01':'x'.repeat(501)}},
    {customChecklist:[{id:'custom-1',stage:'없는 시기',title:'할 일'}]},
    {vendorSchedules:[{id:'vsched-1',category:'없는 분류',name:'라크마',date:'2027-02-03',done:false}]},
    {vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마',date:'2027-02-30',done:false}]},
    {vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'',date:'2027-02-03',done:false}]},
    {budgetPlan:[]},
    {budgetPlan:{unknown:{planned:100}}},
    {budgetPlan:{venue:{planned:-1}}},
    {budgetPlan:{venue:{planned:100,note:'x'.repeat(301)}}},
    {venueSim:{mealPrice:-100}},
    {venueSim:{guestCount:20000}},
    {sdmSim:{packageFee:-100}},
    {sdmSim:{roadScene:'yes'}},
    {ceremonyPlan:{style:'invalid'}},
    {ceremonyPlan:{banquetFloor:'x'.repeat(41)}},
    {ceremonyPlan:{vows:'x'.repeat(3001)}},
    {ceremonyPlan:{declaration:'x'.repeat(2001)}}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }
});
