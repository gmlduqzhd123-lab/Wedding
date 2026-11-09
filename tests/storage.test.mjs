import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeChanges, lockedMerge, StorageConflict } from '../assets/js/storage.js';

test('independent invitation edits and record additions merge without dropping changes',()=>{
  const base={invitation:{name:'',venue:''},stories:[],albums:[{id:'a',title:'첫 앨범'},{id:'b',title:'둘째 앨범'}]};
  const a={invitation:{name:'우리',venue:''},stories:[{id:'a',title:'첫 기록'}],albums:[{id:'a',title:'수정한 첫 앨범'},{id:'b',title:'둘째 앨범'}]};
  const b={invitation:{name:'',venue:'예식장'},stories:[{id:'b',title:'다음 기록'}],albums:[{id:'b',title:'둘째 앨범'},{id:'a',title:'첫 앨범'}]};
  const result=mergeChanges(base,b,a);
  assert.deepEqual(result.conflicts,[]);
  assert.deepEqual(result.value.invitation,{name:'우리',venue:'예식장'});
  assert.deepEqual(result.value.stories.map(x=>x.id),['a','b']);
  assert.deepEqual(result.value.albums,[{id:'b',title:'둘째 앨범'},{id:'a',title:'수정한 첫 앨범'}]);
});
test('same-field edits, photo reorders, and delete-versus-edit need review',()=>{
  assert.equal(mergeChanges({name:''},{name:'A'},{name:'B'}).conflicts.length,1);
  const base={albums:[{id:'a',title:'앨범',images:['1','2','3']}]};
  assert(mergeChanges(base,{albums:[{id:'a',title:'앨범',images:['2','1','3']}]},{albums:[{id:'a',title:'앨범',images:['3','2','1']}]}).conflicts.length);
  assert(mergeChanges(base,{albums:[]},{albums:[{id:'a',title:'바뀐 앨범',images:['1','2','3']}]}).conflicts.length);
});
test('independent private memos and favorite additions are preserved',()=>{
  const result=mergeChanges({notes:{},favorites:[]},{notes:{a:'메모 A'},favorites:['a']},{notes:{b:'메모 B'},favorites:['b']});
  assert.deepEqual(result.conflicts,[]);assert.deepEqual(result.value.notes,{a:'메모 A',b:'메모 B'});assert.deepEqual(new Set(result.value.favorites),new Set(['a','b']));
});
test('locked writes serialize parallel edits and do not write unreviewed conflicts',async()=>{
  let queue=Promise.resolve();const locks={request(_name,fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}};
  let raw=null,writes=0;const storage={getItem(){return raw;},setItem(_key,value){raw=value;writes++;}};
  const base={name:'',venue:''};
  const options={locks,storage,key:'test',base,fallback:base,parse:JSON.parse,validate:x=>x};
  await Promise.all([lockedMerge({...options,next:{name:'A',venue:''}}),lockedMerge({...options,next:{name:'',venue:'B'}})]);
  assert.deepEqual(JSON.parse(raw),{name:'A',venue:'B'});
  await assert.rejects(lockedMerge({...options,next:{name:'C',venue:''}}),StorageConflict);
  assert.equal(writes,2);
  const approved=raw;
  await lockedMerge({...options,next:{name:'C',venue:''},approvedRaw:approved});
  assert.deepEqual(JSON.parse(raw),{name:'C',venue:'B'});
  await assert.rejects(lockedMerge({...options,next:{name:'D',venue:''},approvedRaw:approved}),StorageConflict);
  assert.equal(writes,3);
});
test('storage failure does not return a successful state or mutate the draft',async()=>{
  const before={name:'이전 초안'};let raw=JSON.stringify(before);
  const storage={getItem(){return raw;},setItem(){throw new Error('quota');}};
  const locks={request:(_key,fn)=>fn()};
  await assert.rejects(lockedMerge({locks,storage,key:'draft',base:before,next:{name:'새 초안'},fallback:before,parse:JSON.parse,validate:x=>x}),/quota/);
  assert.deepEqual(JSON.parse(raw),before);
});
