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
test('checklist, budgetPlan, packingList, checklistNotes, customChecklist, and ceremonyPlan persist in private preferences backup and reject invalid values',()=>{
  const prefs=validatePreferences({
    checklist:['d180-hall','d120-dress','custom-1'],
    packingList:['pack-passport','pack-cards'],
    checklistNotes:{'d180-hall':'순천아모르 1층 예약 확인'},
    customChecklist:[{id:'custom-1',stage:'D-60 ~ D-30',title:'청첩장 모임 식당 예약'}],
    budgetPlan:{venue:{planned:15000000,actual:14200000,note:'식대 포함'},sdm:{planned:3500000,actual:null}},
    ceremonyPlan:{style:'noOfficiant',mc:'친구 김OO',song:'축가 미정',speech:'양가 아버님 덕담',note:'입장곡 체크'}
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:prefs});
  assert.deepEqual(parsePreferencesBackup(raw),prefs);
  for(const bad of [
    {checklist:['bad id!']},
    {packingList:['bad id!']},
    {checklistNotes:{'bad id!':'메모'}},
    {customChecklist:[{id:'custom-1',stage:'없는 시기',title:'할 일'}]},
    {budgetPlan:[]},
    {budgetPlan:{unknown:{planned:100}}},
    {budgetPlan:{venue:{planned:-1}}},
    {budgetPlan:{venue:{planned:100,note:'x'.repeat(301)}}},
    {ceremonyPlan:{style:'invalid'}}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }
});
