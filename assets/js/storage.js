const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export class StorageConflict extends Error {
  constructor(conflicts,remoteRaw){
    super('다른 탭에서 같은 항목을 변경했습니다. 두 내용을 확인한 뒤 저장할 내용을 선택해 주세요.');
    this.conflicts=conflicts;this.remoteRaw=remoteRaw;
  }
}
export function mergeChanges(base,local,remote,{preferLocal=false}={}) {
  const conflicts=[];
  function merge(before,next,current,path) {
    if(same(next,before))return current;
    if(same(current,before)||same(next,current))return next;
    if(object(before)&&object(next)&&object(current)){
      return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(next),...Object.keys(current)])]
        .map(key=>[key,merge(before[key],next[key],current[key],path?`${path}.${key}`:key)]).filter(([,value])=>value!==undefined));
    }
    if([before,next,current].every(Array.isArray)){
      if(['stories','albums','honeymoon'].includes(path)){
        const index=items=>Object.fromEntries(items.map(item=>[item.id,item]));
        const merged=merge(index(before),index(next),index(current),`${path}.records`);
        const reordered=!same(next.map(item=>item.id),before.map(item=>item.id))&&same(current.map(item=>item.id),before.map(item=>item.id));
        const ordered=reordered?[...next,...current]:[...current,...next];
        return [...new Set(ordered.map(item=>item.id))].filter(id=>merged[id]).map(id=>merged[id]);
      }
      if(['favorites','tripFavorites'].includes(path)){
        const removed=before.filter(id=>!next.includes(id)),added=next.filter(id=>!before.includes(id));
        return [...new Set([...current.filter(id=>!removed.includes(id)),...added])];
      }
    }
    conflicts.push({path,local:next,remote:current});
    return preferLocal?next:current;
  }
  const value=merge(base,local,remote,'');
  return {value,conflicts};
}
export async function lockedMerge({locks,storage,key,base,next,fallback,parse,validate,encode=JSON.stringify,approvedRaw}) {
  if(!locks?.request)throw new Error('안전한 탭 간 저장을 지원하는 최신 브라우저에서 다시 시도해 주세요. 입력 내용은 유지됩니다.');
  return locks.request(`wedding-storage:${key}`,async()=>{
    const raw=storage.getItem(key),remote=raw===null?fallback:parse(raw);
    const result=mergeChanges(base,next,remote,{preferLocal:approvedRaw!==undefined&&approvedRaw===raw});
    if((approvedRaw!==undefined&&approvedRaw!==raw)||(result.conflicts.length&&approvedRaw===undefined))throw new StorageConflict(result.conflicts,raw);
    const valid=validate(result.value),serialized=encode(valid);
    storage.setItem(key,serialized);
    return {value:valid,raw:serialized};
  });
}
