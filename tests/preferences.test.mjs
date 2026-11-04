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
