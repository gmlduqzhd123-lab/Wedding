import { parseContent, validateContent, formatDate, weddingDday, safeUrl, MAX_IMPORT_BYTES } from './content.js?v=wedding-inv-clean-21';
import { validatePreferences, parsePreferencesBackup, pruneTripPreferences } from './preferences.js?v=wedding-inv-clean-21';
import { lockedMerge, StorageConflict, mergeChanges } from './storage.js?v=wedding-inv-clean-21';
import {COST_LABELS,budgetSummary,staySummary,stayReview,dateSpan,emptyQuote,quoteBasis,quoteReview,currentBudgetText,climateReview} from './travel.js?v=wedding-inv-clean-21';

const $ = selector => document.querySelector(selector);
const main=$('#main'), dialog=$('#editor-dialog'), editor=$('#editor-body');
const DRAFT_KEY='wedding:v1:draft', PREF_KEY='wedding:v1:preferences';
const routes=['home','invitation','story','albums','studios','honeymoon','tips'];
const menus=[
  ['invitation','청첩장','소중한 분들을 초대하는 우리의 첫 인사.','INVITATION'],
  ['story','우리의 일대기','첫 만남부터 오늘까지, 함께 쌓아 온 시간.','OUR STORY'],
  ['albums','포토 앨범','오래 꺼내 보고 싶은 두 사람의 순간들.','PHOTO ALBUM'],
  ['studios','스튜디오','사진과 연락처를 나란히 놓고 함께 고르기.','STUDIOS'],
  ['honeymoon','신혼여행','결혼 후 첫 여행, 가고 싶은 곳부터 차근차근.','HONEYMOON'],
  ['tips','결혼에 관한 모든 정보','상견례·웨딩홀·스드메·본식·혼수까지 결혼 준비 꿀팁 모음.','WEDDING GUIDE']
];
let baseContent, content, studios=[], prefs={}, isDraft=false, toastTimer;
let filter='', favoritesOnly=false, withPhoneOnly=false;
let tripSort='recommended', tripFavoritesOnly=false, tripQuickFilter='all', overviewExpanded=false;
let tipFilter='', tipCategory='all', tipFavoritesOnly=false, redrawTips=()=>{};
const guestMode=new URLSearchParams(location.search).get('view')==='guest';
let baseRevision='', draftRevision=null, editorState=null, studiosStatus='loading', studiosError='';
let previousHash=location.hash,pendingWrites=0;
let redrawDirectory=()=>{},conflictReview=null,photoNavigation=null;
let preferenceQueue=Promise.resolve();
const pendingWriteTasks=new Set(),favoritePending=new Map();
let lastWriteFailed=false;
function trackWrite(task){
  const completion=Promise.resolve(task).then(value=>({ok:value!==false}),error=>({ok:false,error}));
  pendingWriteTasks.add(completion);
  completion.then(result=>{pendingWriteTasks.delete(completion);lastWriteFailed=!result.ok;});
  return task;
}
function queuePreference(action){
  const task=preferenceQueue.then(action);
  preferenceQueue=task.catch(()=>{});
  return trackWrite(task);
}
async function finishPendingWrites(){
  let failed=false;
  while(pendingWriteTasks.size){
    const results=await Promise.all([...pendingWriteTasks]);
    failed ||= results.some(result=>!result.ok);
  }
  if(failed)throw new Error('대기 중인 변경을 저장하지 못해 백업을 중단했습니다. 오류를 확인하고 다시 시도해 주세요.');
}

const editButton=(...args)=>guestMode?null:button(...args);

function E(tag, attributes={}, ...children) {
  const node=document.createElement(tag);
  for (const [key,value] of Object.entries(attributes)) {
    if (value===undefined || value===null || value===false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
    else if (key==='class') node.className=value;
    else if (key==='text') node.textContent=value;
    else node.setAttribute(key,value===true?'':String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child!==undefined && child!==null && child!==false) node.append(child instanceof Node?child:document.createTextNode(String(child)));
  }
  return node;
}
const button=(label, action, className='button') => E('button',{type:'button',class:className,onclick:action},label);
const linkButton=(label, href, quiet=false) => E('a',{class:'button'+(quiet?' quiet':''),href},label);
const readStorage=key=>{try{return localStorage.getItem(key);}catch{return null;}};
function toast(message,error=false) {
  if(dialog.open){
    if(conflictReview){
      const status=$('#conflict-status');
      if(status){status.textContent=message;status.setAttribute('role',error?'alert':'status');}
      return;
    }
    const notice=$('#dialog-notice');notice.textContent=message;notice.hidden=false;notice.className='dialog-notice'+(error?' error':'');
    notice.setAttribute('role',error?'alert':'status');
    if(error){notice.focus();notice.scrollIntoView({block:'nearest'});}
    return;
  }
  clearTimeout(toastTimer);
  const target=$('#toast');target.textContent=message;target.hidden=false;target.className='toast'+(error?' error':'');
  toastTimer=setTimeout(()=>target.hidden=true,error?8500:3800);
}
function describeValue(value){
  if(value===undefined)return '삭제됨';
  const text=typeof value==='string'?value:JSON.stringify(value);
  return text.includes('data:image/')?'사진이 포함된 내용':text.slice(0,300)||'비어 있음';
}
function conflictDetails(error){
  return E('div',{class:'conflict-list'},error.conflicts.length?error.conflicts.map(item=>E('section',{},
    E('p',{class:'small'},conflictLabel(item.path)),E('p',{},'현재 입력: ',describeValue(item.local)),E('p',{},'다른 탭의 저장본: ',describeValue(item.remote)))):
    E('p',{},'서로 다른 항목의 변경은 함께 보존됩니다.'));
}
function conflictLabel(path){
  const labels={invitation:'예식 정보',partner1:'첫 번째 이름',partner2:'두 번째 이름',venue:'예식장',date:'날짜',time:'시간',address:'주소',message:'초대 인사',mapUrl:'지도 링크',notes:'스튜디오 메모',favorites:'관심 스튜디오',tripFavorites:'관심 여행지',tipFavorites:'관심 꿀팁',tripCompare:'여행 비교',tripSelected:'최종 여행지',stories:'이야기',albums:'앨범',honeymoon:'여행',tips:'결혼 정보',category:'분류',channel:'채널·출처',title:'제목',body:'내용',images:'사진',left:'비교 A',right:'비교 B',plan:'여행 상세',experiences:'경험 제안',climate:'기후 안내',climateMonth:'기후 기준 월',sourceTitle:'기후 출처',sourceUrl:'기후 출처 링크',checkedOn:'확인일',comparisonNote:'비교 요약',budgetNotes:'비용 참고 설명',researchNotes:'계획 자료 설명',references:'추가 조사 출처',lodgingNotes:'숙박 구성 메모',itinerary:'일정 흐름',transport:'계획상 이동',stays:'숙박 구성',costs:'비용 배분',quote:'실제 견적'};
  return path.split('.').filter(key=>key!=='records').map(key=>labels[key]||studios.find(item=>item.id===key)?.name||'기록').join(' · ');
}
function storageMessage(error){
  if(error.name==='QuotaExceededError')return '저장 공간이 부족합니다. 초안을 백업하고 사진 수나 용량을 줄여 주세요.';
  if(error.name==='SecurityError')return '브라우저의 저장 허용 설정을 확인해 주세요.';
  return error.message;
}
function beginConflictReview({key,base,next,saveLocal,keepSaved}){
  const refresh=()=>{
    try{
      const raw=localStorage.getItem(key);
      const remote=key===DRAFT_KEY?(raw?parseContent(raw):baseContent):validatePreferences(JSON.parse(raw||'{}'));
      const result=mergeChanges(base,next,remote),error=new StorageConflict(result.conflicts,raw);
      const notice=$('#dialog-notice');
      const focusedAction=notice.contains(document.activeElement)&&document.activeElement.tagName==='BUTTON'?document.activeElement.textContent:null;
      notice.hidden=false;notice.className='dialog-notice error';notice.setAttribute('role','alert');
      notice.replaceChildren(E('p',{},result.conflicts.length?error.message:'최신 저장본을 확인했습니다. 현재 입력과 겹치지 않는 변경은 함께 저장합니다.'),conflictDetails(error),
        E('div',{class:'manager-actions'},button(key===DRAFT_KEY?'다른 탭의 저장본 불러오기':'다른 탭의 저장본 유지',keepSaved,'button quiet'),
          button('현재 입력으로 충돌 항목 저장',()=>saveLocal(raw))),E('p',{id:'conflict-status',class:'small',role:'status'},'다른 탭이 다시 저장해도 비교 내용과 선택 버튼은 유지됩니다.'));
      if(focusedAction)[...notice.querySelectorAll('button')].find(node=>node.textContent===focusedAction)?.focus({preventScroll:true});
    }catch(error){toast('최신 저장본을 확인하지 못했습니다. '+storageMessage(error),true);}
  };
  conflictReview={key,refresh};refresh();
  $('#dialog-notice').focus();
}
function savePrefs(next,base=structuredClone(prefs),approvedRaw){return trackWrite(persistPrefs(next,base,approvedRaw));}
async function persistPrefs(next,base,approvedRaw) {
  pendingWrites++;
  try {
    const result=await lockedMerge({locks:navigator.locks,storage:localStorage,key:PREF_KEY,base,next,fallback:validatePreferences({}),parse:raw=>validatePreferences(JSON.parse(raw)),validate:validatePreferences,approvedRaw});
    prefs=result.value;return true;
  }catch(error){
    if(error instanceof StorageConflict){
      if(showDialog('다른 탭의 변경 확인',E('p',{},'개인 메모와 선택의 변경 내용을 확인해 주세요.'))){
        beginConflictReview({key:PREF_KEY,base,next,
          keepSaved:()=>{try{prefs=validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}'));closeDialog();render();}catch(cause){toast(cause.message,true);}},
          saveLocal:async raw=>{if(await savePrefs(next,base,raw)){closeDialog();render();toast('선택한 내용으로 저장했습니다.');}}});
      }
    }else toast('선택과 메모를 저장하지 못했습니다. 이전 저장본을 유지합니다. '+storageMessage(error),true);
    return false;
  }finally{pendingWrites--;}
}
function setDraft(next,base=structuredClone(content),approvedRaw){return trackWrite(persistDraft(next,base,approvedRaw));}
async function persistDraft(next,base,approvedRaw) {
  pendingWrites++;
  try {
    const result=await lockedMerge({locks:navigator.locks,storage:localStorage,key:DRAFT_KEY,base,next,fallback:baseContent,parse:parseContent,validate:validateContent,approvedRaw,
      encode:valid=>{
        const current=localStorage.getItem(DRAFT_KEY);
        const revision=current?JSON.parse(current).baseRevision??null:baseRevision;
        const raw=JSON.stringify({...valid,baseRevision:revision});
        if(new TextEncoder().encode(raw).length>MAX_IMPORT_BYTES)throw new Error('초안은 8MB 이하로 저장해 주세요. 사진 수나 용량을 줄여 주세요.');
        return raw;
      }});
    draftRevision=JSON.parse(result.raw).baseRevision;content=result.value;isDraft=true;
  }catch(error){
    if(error instanceof StorageConflict)throw error;
    throw new Error('초안을 저장하지 못했습니다. 입력 내용은 유지됩니다. '+storageMessage(error));
  }finally{pendingWrites--;}
}
function dirtyEditor(){return editorState?.isDirty()||false;}
function canLeaveEditor(){
  if(editorState?.isSaving()){toast('저장 중입니다. 완료될 때까지 잠시 기다려 주세요.');return false;}
  return !dirtyEditor()||confirm('저장하지 않은 입력이 있습니다. 입력을 버리고 닫을까요?');
}
function closeDialog(){editorState=null;conflictReview=null;photoNavigation=null;dialog.close();}
function requestClose(){if(canLeaveEditor())closeDialog();}
function currentRoute() {const route=location.hash.replace(/^#\/?/,'').split('/')[0];return routes.includes(route)?route:(guestMode?'invitation':'home');}
function pageHeader(title, description, action, eyebrow) {
  return E('div',{class:'page-header'},E('div',{},E('p',{class:'eyebrow'},eyebrow||'OUR WEDDING JOURNAL'),E('h1',{},title),E('p',{},description)),action);
}
function empty(title, description, label, action, allowGuestAction=false) {
  return E('div',{class:'empty-state'},E('span',{class:'empty-mark','aria-hidden':'true'},'w.'),E('h2',{},title),E('p',{},description),label&&(!guestMode||allowGuestAction)?button(label,action):null);
}
function externalLink(label,url,className='text-button') {
  const href=safeUrl(url);return href?E('a',{href,class:className,target:'_blank',rel:'noopener noreferrer'},label):null;
}
function image(src,alt,attrs={}) {
  const href=safeUrl(src,{image:true});
  if(!href)return null;
  const node=E('img',{src:href,alt,loading:'lazy',...attrs});
  node.addEventListener('error',()=>{node.hidden=true;node.parentElement?.appendChild(E('span',{class:'small muted'},'사진을 불러오지 못했습니다.'));},{once:true});
  return node;
}
function renderHome() {
  const info=content.invitation;
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ');
  const hero=E('section',{class:'hero'},
    E('div',{class:'hero-copy'},E('p',{class:'eyebrow'},'OUR NEXT CHAPTER'),E('div',{class:'hero-line'}),
      E('h1',{},names?`${names},`:'함께 준비하는',E('br'),names?'우리의 다음 이야기':'우리의 다음 장'),
      E('p',{},'소중한 분들을 초대하는 날부터 둘만의 첫 여행까지. 함께 고른 것과 오래 간직할 순간을 이곳에 모아요.'),
      E('div',{class:'hero-actions'},linkButton(info.date||guestMode?'우리의 청첩장':'예식 정보 채우기','#/invitation'),linkButton('스튜디오 살펴보기','#/studios',true))),
    E('div',{class:'hero-art','aria-hidden':'true'},E('div',{class:'art-arch'},E('span',{},'Our',E('br'),'story.')),E('div',{class:'art-note'},'Together,',E('br'),'one page at a time.')));
  const dday=weddingDday(info.date);
  const overview=E('div',{class:'overview'},
    E('div',{},E('span',{class:'small muted'},'OUR DAY'),E('strong',{},info.date?`${formatDate(info.date).replace(/ \S+요일$/,'')}${dday?` · ${dday}`:''}`:'예식 일정 준비 중')),
    E('div',{},E('span',{class:'small muted'},'OUR MEMORIES'),E('strong',{},`이야기 ${content.stories.length} · 앨범 ${content.albums.length}`)),
    E('div',{},E('span',{class:'small muted'},'OUR CHOICES'),E('strong',{},`${studiosStatus==='ready'?`스튜디오 ${studios.length}곳`:'스튜디오 자료 준비 중'} · 여행 ${content.honeymoon.length}곳 · 정보 ${content.tips.length}건`)));
  const statuses={invitation:info.date?'예식 정보 등록됨':'첫 인사를 준비해요',story:`${content.stories.length}개의 이야기`,albums:`${content.albums.length}개의 앨범`,studios:studiosStatus==='ready'?`${studios.length}곳 비교하기`:'자료 불러오기',honeymoon:`${content.honeymoon.length}개의 여행 후보`,tips:`${content.tips.length}개의 꿀팁 영상`};
  return [hero,overview,E('section',{},E('div',{class:'section-heading'},E('div',{},E('h2',{},'함께 채워 갈 이야기'),E('p',{},'필요한 순간에 하나씩, 우리의 속도로.'))),
    E('div',{class:'menu-grid'},menus.map(([route,title,description],index)=>E('a',{class:'menu-card',href:`#/${route}`},E('span',{class:'number'},`0${index+1}`),E('h3',{},title),E('p',{},description),E('div',{class:'card-tail'},E('span',{},statuses[route]),E('span',{'aria-hidden':'true'},'↗'))))))];
}
async function copyInvitationLink(){
  const url=new URL('./?view=guest#/invitation',location.href).href;
  try{await navigator.clipboard.writeText(url);toast('공개 청첩장 링크를 복사했습니다. 기기 초안은 공유되지 않습니다.');}
  catch{
    const input=E('input',{type:'text',readonly:true,value:url,'aria-label':'공개 청첩장 링크'});
    showDialog('청첩장 링크 복사',E('div',{},E('p',{},'아래 링크를 선택해 복사해 주세요. 기기 초안은 공유되지 않습니다.'),input));input.focus();input.select();
  }
}
function renderInvitation() {
  const info=content.invitation,dday=weddingDday(info.date);
  const hasContent=Object.values(info).some(Boolean);
  const mapLink=externalLink('오시는 길 ↗',info.mapUrl,'button quiet');
  return [pageHeader('소중한 분들을 초대합니다.','우리의 마음과 예식 안내를 한 장에 담아요.',E('div',{class:'page-actions'},editButton('예식 정보 편집',()=>openEditor('invitation')),button('청첩장 링크 복사',copyInvitationLink,'button quiet')),'THE INVITATION'),
    hasContent?E('section',{class:'invitation'},E('p',{class:'eyebrow'},'WE ARE GETTING MARRIED'),E('div',{class:'invitation-title'},'With love, together.'),
      (info.partner1||info.partner2)?E('h2',{class:'couple-names'},info.partner1,info.partner1&&info.partner2?E('span',{},'&'):null,info.partner2):null,
      info.message?E('p',{class:'message'},info.message):null,
      E('p',{class:'invitation-date'},info.date?formatDate(info.date):'예식 일정 준비 중',info.time?` · ${info.time}`:'',dday?E('span',{class:'dday-badge'},` (${dday})`):null),
      E('div',{class:'place'},E('strong',{},info.venue||'예식 장소 준비 중'),info.address?E('p',{},info.address):null),
      mapLink?E('div',{class:'invitation-actions'},mapLink):null):
    empty('우리의 첫 초대장을 준비해요.','두 분의 이름, 예식 날짜와 장소를 입력하면 청첩장에 담깁니다.','예식 정보 입력',()=>openEditor('invitation'))];
}
function sortedStories(){
  return [...content.stories].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
}
function focusTrip(id){
  if(currentRoute()!=='honeymoon'||dialog.open)return;
  const card=[...main.querySelectorAll('[data-trip-id]')].find(node=>node.dataset.tripId===id);
  const target=card?.querySelector('h2')||main.querySelector('.page-header .button')||main;
  if(target.matches('h2'))target.tabIndex=-1;
  target.focus({preventScroll:true});
  const bounds=target.getBoundingClientRect();
  if(bounds.top<0||bounds.bottom>innerHeight)target.scrollIntoView({block:'nearest',behavior:'instant'});
}
function focusRecord(type,id){
  if(type==='honeymoon'){focusTrip(id);return;}
  const route=type==='stories'?'story':type;
  if(currentRoute()!==route||dialog.open)return;
  const card=[...main.querySelectorAll('[data-record-id]')].find(node=>node.dataset.recordId===id);
  const target=card?.querySelector('h2')||main.querySelector('.page-header .button')||main;
  if(target.matches('h2'))target.tabIndex=-1;
  target.focus({preventScroll:true});
  const bounds=target.getBoundingClientRect();
  if(bounds.top<0||bounds.bottom>innerHeight)target.scrollIntoView({block:'nearest',behavior:'instant'});
}
function filteredTips(){
  const query=tipFilter.trim().toLocaleLowerCase();
  return content.tips.filter(item=>(tipCategory==='all'||(item.category||'기타')===tipCategory)&&(!tipFavoritesOnly||prefs.tipFavorites?.includes(item.id))&&(!query||`${item.title} ${item.category} ${item.channel} ${item.body}`.toLocaleLowerCase().includes(query)));
}
function displayedRecords(type){
  return type==='honeymoon'?sortedTrips():type==='stories'?sortedStories():type==='tips'?filteredTips():content.albums;
}
function recordActions(type,item) {
  if(guestMode)return null;
  const reorder=[];
  if(type==='albums'&&content.albums.length>1){
    const index=content.albums.findIndex(album=>album.id===item.id);
    const move=async(target,label)=>{
      try{
        const next=structuredClone(content);
        [next.albums[index],next.albums[target]]=[next.albums[target],next.albums[index]];
        await setDraft(next);render();
        const card=[...main.querySelectorAll('[data-record-id]')].find(node=>node.dataset.recordId===item.id);
        const buttonNode=card&&[...card.querySelectorAll('.record-actions button')].find(node=>node.textContent===label&&!node.disabled);
        (buttonNode||card?.querySelector('h2')||main).focus({preventScroll:true});
      }catch(error){toast(error.message,true);}
    };
    const prev=button('앨범 앞으로',()=>move(index-1,'앨범 앞으로'),'text-button');prev.disabled=index===0;
    const next=button('앨범 뒤로',()=>move(index+1,'앨범 뒤로'),'text-button');next.disabled=index===content.albums.length-1;
    reorder.push(prev,next);
  }
  return E('div',{class:'record-actions'},...reorder,button('수정',()=>openEditor(type,item),'text-button'),button('삭제',async()=>{
    if(!confirm(`‘${item.title}’ 기록을 이 기기의 초안에서 삭제할까요?`))return;
    try{
      const ids=displayedRecords(type).map(record=>record.id),index=ids.indexOf(item.id);
      const neighbors=[...ids.slice(index+1),...ids.slice(0,index).reverse()];
      const next=structuredClone(content);next[type]=next[type].filter(value=>value.id!==item.id);await setDraft(next);render();
      const remaining=displayedRecords(type);
      focusRecord(type,neighbors.find(id=>remaining.some(record=>record.id===id))||remaining[0]?.id);
      const cleaned=type==='honeymoon'?await queuePreference(async()=>{
        const nextPrefs=pruneTripPreferences(prefs,content.honeymoon);
        if(JSON.stringify(nextPrefs)===JSON.stringify(prefs))return true;
        const saved=await savePrefs(nextPrefs);if(saved)updateTripChoices();return saved;
      }):type==='tips'&&prefs.tipFavorites?.includes(item.id)?await queuePreference(async()=>savePrefs({...prefs,tipFavorites:prefs.tipFavorites.filter(id=>id!==item.id)})):true;
      if(cleaned)toast('초안에서 삭제했습니다.');
    }catch(error){toast(error.message,true);}
  },'text-button'));
}
function renderStories() {
  const records=sortedStories();
  return [pageHeader('우리가 함께 걸어온 시간','첫 만남, 기억하고 싶은 날, 함께 내린 결심을 기록해요.',editButton('이야기 추가',()=>openEditor('stories')),'OUR STORY'),
    records.length?E('section',{class:'timeline'},records.map(item=>E('article',{class:'story-card'+(item.image?' has-image':''),'data-record-id':item.id},
      item.image?E('button',{type:'button',class:'photo-open story-photo-open','aria-label':`${item.title} 사진 확대`,onclick:()=>openPhotos(item.title,[item.image],0)},image(item.image,item.title)):null,
      E('div',{},E('p',{class:'record-date'},item.date?formatDate(item.date):'날짜 없는 기록'),E('h2',{},item.title),E('p',{class:'record-body'},item.body),recordActions('stories',item))))):
    empty('첫 번째 이야기를 남겨 볼까요?','처음 만난 날도, 함께 웃었던 평범한 날도 우리의 일대기가 됩니다.','첫 이야기 쓰기',()=>openEditor('stories'))];
}
function openPhotos(title,photos,index=0) {
  if(!photos.length)return;
  const body=E('div',{class:'photo-viewer'});
  const draw=()=>{
    const previous=button('이전 사진',()=>{index=(index+photos.length-1)%photos.length;draw();body.querySelector('.viewer-controls button:first-child')?.focus();},'button quiet');
    const next=button('다음 사진',()=>{index=(index+1)%photos.length;draw();body.querySelector('.viewer-controls button:last-child')?.focus();},'button quiet');
    previous.disabled=next.disabled=photos.length<2;
    const thumbs=photos.length>1?E('div',{class:'viewer-thumbs','aria-label':'전체 사진 목록'},photos.map((src,idx)=>E('button',{type:'button',class:'viewer-thumb','aria-label':`${idx+1}번 사진 보기`,'aria-current':String(idx===index),onclick:()=>{index=idx;draw();body.querySelectorAll('.viewer-thumb')[idx]?.focus();}},image(src,`${title} 썸네일 ${idx+1}`)))) : null;
    body.replaceChildren(image(photos[index],`${title} 사진 ${index+1}`,{loading:'eager'}),
      E('div',{class:'viewer-controls'},previous,E('span',{'aria-live':'polite'},`${index+1} / ${photos.length}`),next),thumbs);
  };
  draw();
  const navigate=event=>{
    if(photos.length>1&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
      event.preventDefault();index=(index+(event.key==='ArrowLeft'?-1:1)+photos.length)%photos.length;draw();
      body.querySelector(event.key==='ArrowLeft'?'.viewer-controls button:first-child':'.viewer-controls button:last-child')?.focus();
    }
  };
  if(showDialog(title,body))photoNavigation=navigate;
}
function openAlbum(album) {
  if(album.images.length)openPhotos(album.title,album.images);
  else showDialog(album.title,E('p',{},'아직 등록된 사진이 없습니다.'));
}
const won=value=>value===null?'미확인':`${value.toLocaleString('ko-KR')}원`;
function tripFlightBadge(item){
  const line=(item.plan?.transport||'').split(/\r?\n/)[0]||'';
  const cleaned=line.replace(/^\d{4}-\d{2}-\d{2}\s*조회 항공:\s*/,'').replace(/\s*Economy\s*(Standard|Saver)/i,'').replace(/\s*\([^)]*\)/g,'').trim();
  const text=`${line} ${item.plan?.itinerary||''} ${item.plan?.quote?.flightSource||''}`;
  if(/직항/.test(text)&&!/경유/.test(line)){
    const airline=cleaned.split('.')[0]?.trim();
    return {direct:true,short:'✈️ 직항',detail:airline?`✈️ ${airline} · 직항`:'✈️ 인천 출발 직항'};
  }
  if(/경유/.test(text)){
    const airline=cleaned.split('.')[0]?.trim()||'';
    const hop=line.match(/(?:왕복\s*)?([A-Z·]+\s*)?\d회 경유/)?.[0]?.replace(/^왕복\s*/,'')||'경유';
    return {direct:false,short:`✈️ ${hop}`,detail:airline?`✈️ ${airline} · ${hop}`:`✈️ ${hop}`};
  }
  return {direct:false,short:'✈️ 항공 미정',detail:'✈️ 항공편 별도 확인'};
}
function tripClimateBadge(item){
  const c=item.plan?.climate||'';
  if(!c)return '🌤️ 기후 미입력';
  const temp=c.match(/\d+(?:\.\d+)?[~/–-]\d+(?:\.\d+)?°C|\d+(?:\.\d+)?°C/g);
  const tempStr=temp?temp.slice(0,2).join(' / '):'';
  if(/건기/.test(c))return `☀️ 6월 건기${tempStr?` (${tempStr})`:''}`;
  if(/우기/.test(c)&&/소나기|스콜/.test(c))return `🌦️ 6월 스콜·소나기${tempStr?` (${tempStr})`:''}`;
  if(/우기/.test(c))return `🌦️ 6월 우기${tempStr?` (${tempStr})`:''}`;
  if(/맑고 더운|여름철/.test(c))return `☀️ 6월 맑음·초여름${tempStr?` (${tempStr})`:''}`;
  if(/온화/.test(c))return `🌤️ 6월 온화${tempStr?` (${tempStr})`:''}`;
  return `🌤️ ${climateReview(item).summary.slice(0,24)}`;
}
function matchesTripQuickFilter(item,key=tripQuickFilter){
  if(key==='direct')return tripFlightBadge(item).direct;
  if(key==='dry')return /건기|맑고 더운|여름철/.test(item.plan?.climate||'');
  if(key==='under6m')return item.budget!==null&&item.budget<=6000000;
  if(key==='longstay')return stayReview(item).nights>=6;
  return true;
}
function tripQuickSpecs(item){
  const flight=tripFlightBadge(item);
  return E('div',{class:'trip-spec-chips','aria-label':`${item.title} 핵심 조건 요약`},
    E('span',{class:'spec-chip'+(flight.direct?' direct':'')},flight.detail),
    E('span',{class:'spec-chip'},'🏨 '+staySummary(item)),
    E('span',{class:'spec-chip'},tripClimateBadge(item)),
    E('span',{class:'spec-chip highlight'},'💰 2인 계획예산 '+won(item.budget)));
}
function tripBudgetBar(item){
  const costs=item.plan?.costs;
  if(!costs)return null;
  const entries=[
    ['airfare','항공','seg-airfare'],
    ['lodging','숙박·패키지','seg-lodging'],
    ['other','기타 여행비','seg-other'],
    ['reserve','예비비','seg-reserve']
  ].map(([key,label,cls])=>({key,label,cls,val:typeof costs[key]==='number'&&costs[key]>0?costs[key]:0}));
  const sum=entries.reduce((acc,cur)=>acc+cur.val,0);
  if(sum<=0)return null;
  return E('div',{class:'trip-budget-visual','aria-label':`${item.title} 비용 배분 그래프`},
    E('div',{class:'budget-visual-head'},
      E('span',{class:'small muted'},'2인 비용 배분 구성'),
      E('strong',{class:'small'},`배분 합계 ${won(sum)}`)),
    E('div',{class:'budget-bar-track','aria-hidden':'true'},
      entries.filter(e=>e.val>0).map(e=>{
        const pct=Math.max(4,Math.round((e.val/sum)*100));
        return E('span',{class:`budget-seg ${e.cls}`,style:`width:${pct}%`,title:`${e.label}: ${won(e.val)} (${Math.round((e.val/sum)*100)}%)`});
      })),
    E('div',{class:'budget-legend'},
      entries.map(e=>E('span',{class:'legend-item'},
        E('span',{class:`legend-dot ${e.cls}`,'aria-hidden':'true'}),
        E('span',{class:'legend-label'},e.label),
        E('strong',{class:'legend-val'},costs[e.key]===null?'미정':`${Math.round(e.val/10000).toLocaleString('ko-KR')}만`)))));
}
function tripProsCons(item){
  const prosLines=(item.pros||'아직 기록이 없어요.').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const consLines=(item.cons||'아직 기록이 없어요.').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return E('div',{class:'trip-pros-cons'},
    E('div',{class:'pros-box'},
      E('strong',{class:'pros-title'},'👍 좋은 점'),
      E('ul',{class:'pros-cons-list'},prosLines.map(line=>E('li',{},line)))),
    E('div',{class:'cons-box'},
      E('strong',{class:'cons-title'},'🤔 고민할 점'),
      E('ul',{class:'pros-cons-list'},consLines.map(line=>E('li',{},line)))));
}
function tripBudgetStatus(item){
  const state=budgetSummary(item),lines=[];
  if(item.budget!==null)lines.push(`2인 계획예산 ${won(item.budget)}${state.known!==null?` · 배분 합계 ${won(state.known)}`:''}`);
  else lines.push('총액 미입력 · 예산 판단 보류');
  if(state.missing.length)lines.push('비용 배분 미확인: '+state.missing.map(key=>COST_LABELS[key]).join(' · '));
  if(state.unallocated>0)lines.push(`항목 미배분 ${won(state.unallocated)} · 세부 비용을 확인해 주세요.`);
  if(state.unallocated<0)lines.push(`항목 배분이 계획 총액보다 ${won(-state.unallocated)} 큽니다. 총액 또는 항목을 조정해 주세요.`);
  if(state.reserve===0)lines.push('예비비가 0원입니다. 추가 비용을 검토해 주세요.');
  lines.push(quoteReview(item).complete?'계획 배분 기준 · 실제 견적 확인 상태는 별도 표시':'계획 기준 · 실제 견적·포함 조건 미확인');
  return E('div',{class:'budget-status'+(state.unallocated<0?' warning':''),role:'status'},lines.map(line=>E('p',{},line)));
}
function tripQuoteStatus(item,full=false){
  const review=quoteReview(item);
  const message=full||review.complete?review.message:[review.amountMessage,'실제 예산 충족 미확인 · '+(review.flightDates?'한국 출발·도착일 입력 일치':'한국 출발·도착 항공편 미확인')].filter(Boolean).join('\n');
  return E('p',{class:'quote-status form-note'+(review.excess>0?' warning':''),role:'status'},message);
}
function updateTripChoices(){
  if(currentRoute()!=='honeymoon')return;
  if(tripFavoritesOnly){render();return;}
  const active=document.activeElement;
  const anchor=main.contains(active)?active:null,before=anchor?.getBoundingClientRect().top;
  for(const node of document.querySelectorAll('.trip-controls button')){
    const id=node.closest('[data-trip-id]').dataset.tripId,key=node.dataset.tripAction;
    node.setAttribute('aria-pressed',String(key==='tripSelected'?prefs.tripSelected===id:Boolean(prefs[key]?.includes(id))));
  }
  const region=$('#trip-comparison-region'),comparison=tripComparison();
  if(region)region.replaceChildren(...(comparison?[comparison]:[]));
  $('#selected-trip-region')?.replaceChildren(selectedTripSummary());
  if(anchor?.isConnected)window.scrollBy(0,anchor.getBoundingClientRect().top-before);
}
function selectedTripSummary(){
  const item=content.honeymoon.find(trip=>trip.id===prefs.tripSelected);
  if(!item)return E('p',{class:'form-note'},'최종 선택한 여행지가 없습니다. 후보의 최종 선택 버튼으로 이 기기에 저장할 수 있어요.');
  return E('section',{class:'selected-trip'},E('h2',{},'최종 선택 · '+item.title),E('p',{},`${item.startDate||'미정'} 한국 출발 → ${item.endDate||'미정'} 한국 도착 · 2인 계획예산 ${won(item.budget)}`),
    E('div',{class:'selected-trip-status'},tripBudgetStatus(item),tripQuoteStatus(item),tripStayStatus(item)),
    E('p',{class:'small muted'},'이 기기에 저장한 선택입니다. 예약 확정을 의미하지 않습니다.'),button('선택한 계획 보기',()=>{
      if((tripFavoritesOnly&&!prefs.tripFavorites?.includes(item.id))||!matchesTripQuickFilter(item,tripQuickFilter)){tripFavoritesOnly=false;tripQuickFilter='all';render();}
      const card=[...main.querySelectorAll('[data-trip-id]')].find(node=>node.dataset.tripId===item.id);
      if(!card)return;const details=card.querySelector('.travel-details');if(details)details.open=true;
      const heading=card.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});card.scrollIntoView({block:'start'});
    },'button quiet'));
}
function tripStayStatus(item){
  const review=stayReview(item);
  return E('p',{class:'stay-status form-note'+(review.warnings.length?' warning':''),role:'status'},review.message);
}
function tripControls(item) {
  if(guestMode)return null;
  const toggle=key=>queuePreference(async()=>{
    const active=pruneTripPreferences(prefs,content.honeymoon);let next;
    if(key==='tripSelected')next={...active,tripSelected:active.tripSelected===item.id?'':item.id};
    else{
      const selected=new Set(active[key]||[]);selected.has(item.id)?selected.delete(item.id):selected.add(item.id);
      if(key==='tripCompare'&&selected.size>2){toast('비교할 여행지는 두 곳까지 선택해 주세요.',true);return true;}
      next={...active,[key]:[...selected]};
    }
    const saved=await savePrefs(next);if(saved)updateTripChoices();return saved;
  });
  return E('div',{class:'trip-controls'},[['tripFavorites','관심 여행지'],['tripCompare','비교 선택'],['tripSelected','최종 선택']].map(([key,label])=>
    E('button',{type:'button',class:'button quiet','data-trip-action':key,'aria-pressed':String(key==='tripSelected'?prefs.tripSelected===item.id:Boolean(prefs[key]?.includes(item.id))),onclick:()=>toggle(key)},label)));
}
function tripComparison() {
  if(guestMode)return null;
  const items=(prefs.tripCompare||[]).map(id=>content.honeymoon.find(item=>item.id===id)).filter(Boolean);
  if(!items.length)return null;
  const fields=[['나라·지역',item=>item.country||'미정'],['한국 출발·도착',item=>[item.startDate,item.endDate].filter(Boolean).join(' ~ ')||'미정'],
    ['2인 계획예산',item=>won(item.budget)],['비용 배분 합계',item=>{const state=budgetSummary(item);return state.known===null?'입력된 배분 없음':won(state.known);}],
    ['실제 견적·귀국 확인',item=>quoteReview(item).message],['숙박 가안',staySummary],['숙박·날짜 검토',item=>stayReview(item).message],...Object.entries(COST_LABELS).map(([key,label])=>[label+' 배분',item=>won(item.plan?.costs[key]??null)]),
    ['계획상 이동',item=>item.plan?.transport||'별도 확인 필요'],['기후 유의점',item=>climateReview(item).summary],
    ['좋은 점',item=>item.pros||'미기재'],['고민할 점',item=>item.cons||'미기재']];
  return E('section',{class:'trip-comparison'},E('h2',{},'여행 후보 나란히 비교'),E('p',{class:'small muted'},'관심·비교·최종 선택은 이 기기에 저장됩니다. 비용은 모두 2인 전체 여행 계획 배분입니다.'),
    E('div',{class:'table-scroll'},E('table',{class:'travel-comparison'},E('thead',{},E('tr',{},E('th',{scope:'col'},'비교 항목'),items.map(item=>E('th',{scope:'col'},item.title)))),
      E('tbody',{},fields.map(([label,value])=>E('tr',{},E('th',{scope:'row'},label),items.map(item=>E('td',{},value(item)))))))));
}
function travelSection(item,key,title,...children){
  return E('details',{class:'trip-section','data-view-key':`${item.id}:${key}`},E('summary',{},title),E('div',{class:'trip-section-body'},children));
}
function planReference(plan,text){
  return text?E('div',{class:'plan-reference'},E('p',{class:'small muted'},plan.narrativeVersion===2?'참고 설명 · 직접 작성한 문장의 날짜·금액·박 수는 자동 갱신되지 않습니다.':'이전 계획의 참고 설명 · 아래 원문은 현재 입력값으로 자동 갱신되지 않습니다.'),E('p',{},text)):null;
}
function tripQuoteDetails(item){
  const q=item.plan.quote||emptyQuote(),state=quoteReview(item),rows=Object.entries(q.costs).map(([key,value])=>[COST_LABELS[key]+' 실제 견적',won(value)]);
  rows.push(['입력 견적 소계',won(state.known)],['현재 계획의 예비비',won(item.plan.costs.reserve)],['입력 견적 + 기입 예비비',won(state.assessed)],['확인 조건을 갖춘 합계',won(state.total)],['조회일',q.checkedOn||'미입력'],['한국 출발 시각',q.departureAt.replace('T',' ')||'미입력'],['한국 도착 시각',q.arrivalAt.replace('T',' ')||'미입력']);
  return travelSection(item,'quote','실제 견적·항공편 확인',tripQuoteStatus(item,true),E('dl',{class:'quote-breakdown'},rows.map(([label,value])=>[E('dt',{},label),E('dd',{},value)])),
    E('p',{},'성인 2명·인천·일반석·객실 1실 기준입니다. 공개 조사 금액은 날짜를 지정한 조회 화면의 표시가이며, 항공사·호텔의 결제 직전 최종 요금이나 예약 확정 금액이 아닙니다. 이동·세금의 공시요금, 환산 가정과 추가 확인 사항은 비용 배분·이동비·예비비 항목에서 확인하세요. 일부 견적만 입력해도 소계와 기입된 예비비 합계를 표시하며, 전체 견적 확인은 모든 필수 비용과 현재 여행·숙박 조건을 확인한 뒤에만 표시합니다.'),
    E('p',{},'항공 근거: '+(q.flightSource||'미입력')),E('p',{},'숙박 근거: '+(q.lodgingSource||'미입력')));
}
function travelDetails(item){
  const plan=item.plan;
  if(!plan)return item.body||item.url?E('details',{class:'travel-details','data-view-key':`${item.id}:all`},E('summary',{},'직접 작성한 메모·참고 링크'),item.body?E('p',{class:'record-body'},item.body):null,externalLink('직접 입력한 참고 링크 ↗',item.url)):null;
  const state=budgetSummary(item);
  const costRows=Object.entries(COST_LABELS).map(([key,label])=>[label,won(plan.costs[key])]);
  costRows.push(['입력된 배분 소계',state.known===null?'입력된 배분 없음':won(state.known)],['2인 계획 총액',won(item.budget)],['항목 미배분',state.unallocated===null?'판단 보류':state.unallocated>=0?won(state.unallocated):`배분 초과 ${won(-state.unallocated)}`]);
  const climate=climateReview(item);
  return E('details',{class:'travel-details','data-view-key':`${item.id}:all`},E('summary',{},'일정·숙박·비용 상세'),
    travelSection(item,'dates','여행 조건·귀국',E('p',{},`한국 출발 ${item.startDate||'미정'} → 한국 도착 목표 ${item.endDate||'미정'} · 성인 2명 · 2인 계획예산 ${won(item.budget)}`),
      E('p',{},'인천 출발·일반석·객실 1실 기준입니다. 조회한 왕복 일정과 각 공항의 현지 시각은 실제 견적·항공편 확인 항목에 있습니다. 조회 일정은 예약 확정이 아니며 운항·요금을 다시 확인해야 합니다. 한국 도착일과 현지 출발일을 구분하고 현지 체크인·체크아웃으로 숙박 수를 계산합니다.')),
    travelSection(item,'stays','숙박·이동·일정',E('h3',{},staySummary(item)),tripStayStatus(item),
      plan.stays.map(stay=>E('p',{class:'small'},`${stay.region}: 현지 체크인 ${stay.checkIn||'미입력'} → 체크아웃 ${stay.checkOut||'미입력'} · ${stay.nights}박`)),
      E('p',{class:'current-trip-dates'},`현재 일정: ${item.startDate||'미정'} 한국 출발 → ${staySummary(item)} → ${item.endDate||'미정'} 한국 도착 목표. 현지 날짜는 조회 항공편과 대조하고 예약 전에 확정합니다.`),
      planReference(plan,plan.lodgingNotes),E('h3',{},'일정 흐름 참고'),planReference(plan,plan.itinerary),
      E('p',{},`귀국 목표: ${item.endDate||'미정'} 한국 도착. 숙박 배분과 현지 이동은 실제 항공편에 맞춰 조정합니다.`),E('h3',{},'계획상 이동'),E('p',{},plan.transport)),
    travelSection(item,'costs','비용 배분·이동비·예비비',E('dl',{class:'cost-breakdown'},costRows.map(([label,value])=>[E('dt',{},label),E('dd',{},value)])),tripBudgetStatus(item),
      E('p',{class:'current-budget-text'},currentBudgetText(item)),planReference(plan,plan.budgetNotes),E('p',{},'기타 여행비는 교통·식비·활동·보험·통신·준비 비용 등의 통합 배분입니다. 개인 쇼핑은 기본 제외이며 실제 견적 확인 상태는 별도 항목에서 확인합니다.')),
    tripQuoteDetails(item),
    travelSection(item,'experiences','경험 제안',E('p',{},plan.experiences||'아직 입력한 제안이 없습니다.')),
    travelSection(item,'climate',climate.title,E('p',{},climate.entered?plan.climate:'아직 입력한 기후 안내가 없습니다.'),
      climate.entered&&climate.month===null?E('p',{class:'form-note'},'기후 자료의 기준 월이 입력되지 않았습니다. 출처에서 기준 월을 확인해 주세요.'):null,
      climate.changedMonth?E('p',{class:'form-note'},`기후 안내는 ${climate.month}월 기준입니다. 수정한 여행 월에 맞는 안내를 다시 확인해 주세요.`):null,
      E('p',{class:'small muted'},`${plan.sourceTitle||'출처 미입력'}${plan.checkedOn?' · 자료 확인일 '+plan.checkedOn:''}`),externalLink('기후 공식 안내 ↗',plan.sourceUrl||''),
      plan.sourceTitle&&!plan.sourceUrl?E('p',{class:'small muted'},'기후 출처 링크 미입력 · 직접 입력한 참고 링크와는 별도로 관리합니다.'):null),
    travelSection(item,'sources','계획 자료·확인 범위',E('p',{},plan.researchNotes||'저장된 여행 계획입니다. 제공 자료와 직접 수정한 항목의 적용 범위를 확인해 주세요. 실제 예약이나 견적으로 확인된 상태가 아닙니다.'),
      (plan.references||[]).map(source=>externalLink(source.title+' ↗',source.url)),
      externalLink('계획 자료와 적용 범위 ↗','https://github.com/gmlduqzhd123-lab/Wedding/blob/main/CONTENT_SOURCES.md')),
    item.body||item.url?travelSection(item,'memo','직접 작성한 메모·참고 링크',item.body?E('p',{class:'record-body'},item.body):null,youtubeThumbBanner(item.url,item.title),externalLink('직접 입력한 참고 링크 ↗',item.url),E('p',{class:'small muted'},'직접 입력한 참고 링크는 기후 공식 출처와 별개입니다. 자유 메모의 문장은 날짜·금액 변경 시 자동 수정되지 않습니다.')):null);
}
function renderAlbums() {
  return [pageHeader('오래 간직할 우리의 순간','사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.',editButton('앨범 추가',()=>openEditor('albums')),'PHOTO ALBUM'),
    content.albums.length?E('section',{class:'album-grid'},content.albums.map(item=>E('article',{class:'album-card','data-record-id':item.id},item.images.length?image(item.images[0],item.title,{class:'album-cover'}):E('div',{class:'album-placeholder'},'Our memories'),
      E('div',{class:'album-info'},E('p',{class:'record-date'},[item.date?formatDate(item.date):'',`사진 ${item.images.length}장`].filter(Boolean).join(' · ')),E('h2',{},item.title),E('p',{class:'record-body'},item.body),button('사진 보기',()=>openAlbum(item),'text-button'),recordActions('albums',item))))):
    empty('우리의 사진을 담을 첫 앨범','사진을 직접 선택하거나 사진 주소를 입력해 앨범 초안을 만들 수 있어요.','첫 앨범 만들기',()=>openEditor('albums'))];
}
function sortedTrips(){
  const trips=content.honeymoon.filter(item=>(!tripFavoritesOnly||prefs.tripFavorites?.includes(item.id))&&matchesTripQuickFilter(item,tripQuickFilter));
  return tripSort==='recommended'?trips:trips.sort((a,b)=>a.budget===null?(b.budget===null?0:1):b.budget===null?-1:(a.budget-b.budget)*(tripSort==='budget-high'?-1:1));
}
function tripSortControl(){
  const select=E('select',{id:'trip-sort','aria-label':'여행 후보 정렬'},[['recommended','추천순'],['budget-low','계획예산 낮은 순'],['budget-high','계획예산 높은 순']].map(([value,label])=>E('option',{value},label)));
  select.value=tripSort;
  select.addEventListener('change',()=>{const before=select.getBoundingClientRect().top;tripSort=select.value;render();const target=$('#trip-sort');target.focus({preventScroll:true});window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const favCheck=E('input',{type:'checkbox',id:'trip-favorites-only'});favCheck.checked=tripFavoritesOnly;
  favCheck.addEventListener('change',()=>{const before=favCheck.getBoundingClientRect().top;tripFavoritesOnly=favCheck.checked;render();const target=$('#trip-favorites-only');target?.focus({preventScroll:true});if(target)window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const quickFilters=[
    ['all',`전체 (${content.honeymoon.length})`],
    ['direct',`✈️ 직항 노선 (${content.honeymoon.filter(item=>matchesTripQuickFilter(item,'direct')).length})`],
    ['dry',`☀️ 6월 건기·맑음 (${content.honeymoon.filter(item=>matchesTripQuickFilter(item,'dry')).length})`],
    ['under6m',`💸 600만 원 이하 (${content.honeymoon.filter(item=>matchesTripQuickFilter(item,'under6m')).length})`],
    ['longstay',`🏖️ 6~7박 일정 (${content.honeymoon.filter(item=>matchesTripQuickFilter(item,'longstay')).length})`]
  ];
  const filterBar=E('div',{class:'trip-quick-filters',role:'group','aria-label':'여행지 핵심 조건 빠른 필터'},
    quickFilters.map(([key,label])=>E('button',{type:'button',class:'button quiet trip-filter-chip','data-trip-filter':key,'aria-pressed':String(tripQuickFilter===key),onclick:()=>{
      tripQuickFilter=tripQuickFilter===key&&key!=='all'?'all':key;
      render();
      main.querySelector(`[data-trip-filter="${tripQuickFilter}"]`)?.focus({preventScroll:true});
    }},label)));
  return E('div',{class:'travel-tools'},
    E('div',{class:'travel-tools-row'},E('label',{for:'trip-sort'},'후보 정렬'),select,guestMode?null:E('label',{class:'check-label',for:'trip-favorites-only'},favCheck,'관심 여행지만 보기'),E('p',{class:'small muted'},'정렬·필터는 화면 표시만 바꾸며 저장된 후보와 비교 선택은 유지됩니다.')),
    filterBar);
}
function travelOverview(){
  const trips=[...content.honeymoon];
  const ordered=(tripSort==='recommended'?trips:trips.sort((a,b)=>a.budget===null?(b.budget===null?0:1):b.budget===null?-1:(a.budget-b.budget)*(tripSort==='budget-high'?-1:1))).filter(item=>item.plan?.comparisonNote);
  if(!ordered.length)return null;
  const directCount=ordered.filter(item=>tripFlightBadge(item).direct).length;
  const budgets=ordered.map(item=>item.budget).filter(b=>typeof b==='number');
  const minBudget=budgets.length?Math.round(Math.min(...budgets)/10000).toLocaleString('ko-KR'):'';
  const maxBudget=budgets.length?Math.round(Math.max(...budgets)/10000).toLocaleString('ko-KR'):'';
  return E('section',{class:'travel-overview','aria-labelledby':'travel-overview-title'},
    E('div',{class:'overview-head'},
      E('div',{},
        E('h2',{id:'travel-overview-title'},'후보 한눈에 보기'),
        E('p',{class:'small muted'},'추천순은 조사 당시 6월 기후·해변 휴식·이동 부담·계획 예산을 고려한 순서입니다.')),
      E('div',{class:'overview-stats'},
        E('span',{class:'spec-chip'},`총 ${ordered.length}곳`),
        E('span',{class:'spec-chip direct'},`✈️ 직항 ${directCount}곳 · 경유 ${ordered.length-directCount}곳`),
        budgets.length?E('span',{class:'spec-chip highlight'},`💰 2인 계획예산 ${minBudget}만~${maxBudget}만 원`):null)),
    E('details',{class:'overview-disclosure',open:overviewExpanded,ontoggle:event=>{if(event.currentTarget.isConnected)overviewExpanded=event.currentTarget.open;}},E('summary',{},`후보 요약 ${ordered.length}곳 비교 보드 펼치기·접기`),
      E('ol',{class:'overview-board'},ordered.map(item=>{
        const flight=tripFlightBadge(item);
        return E('li',{},
          E('div',{class:'overview-row-top'},
            button(item.title,()=>{if((tripFavoritesOnly&&!prefs.tripFavorites?.includes(item.id))||!matchesTripQuickFilter(item,tripQuickFilter)){tripFavoritesOnly=false;tripQuickFilter='all';render();}const card=main.querySelector(`[data-trip-id="${item.id}"]`);if(card){card.querySelector('.travel-details').open=true;focusTrip(item.id);}},'text-button'),
            E('span',{class:'small muted'},item.country||''),
            E('strong',{},'2인 목표 '+won(item.budget))),
          E('div',{class:'overview-meta'},
            E('span',{class:'spec-chip'+(flight.direct?' direct':'')},flight.short),
            E('span',{class:'spec-chip'},'🏨 '+staySummary(item)),
            E('span',{class:'spec-chip'},tripClimateBadge(item))),
          E('p',{class:'small'},item.plan.comparisonNote));
      }))));
}
function youtubeVideoId(raw){
  try{
    const parsed=new URL(raw),host=parsed.hostname.toLocaleLowerCase();
    if(host==='youtu.be'){
      const id=parsed.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
    }
    if(host==='youtube.com'||host.endsWith('.youtube.com')){
      const v=parsed.searchParams.get('v');
      if(v&&/^[A-Za-z0-9_-]{11}$/.test(v))return v;
      const parts=parsed.pathname.split('/').filter(Boolean);
      if(['shorts','embed','live'].includes(parts[0])&&/^[A-Za-z0-9_-]{11}$/.test(parts[1]||''))return parts[1];
    }
  }catch{}
  return '';
}
function isYoutubeUrl(raw){
  try{
    const host=new URL(raw).hostname.toLocaleLowerCase();
    return host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com');
  }catch{return false;}
}
function youtubeThumbUrl(raw){
  const id=youtubeVideoId(raw);
  return id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:'';
}
function youtubeThumbBanner(rawUrl,title){
  const url=safeUrl(rawUrl),thumb=youtubeThumbUrl(url);
  if(!url||!thumb)return null;
  const img=E('img',{class:'yt-thumb-img',src:thumb,alt:`${title} 유튜브 썸네일`,loading:'lazy',decoding:'async',width:'480',height:'270'});
  img.addEventListener('error',()=>{img.hidden=true;});
  return E('a',{class:'yt-thumb-banner',href:url,target:'_blank',rel:'noopener noreferrer','aria-label':`${title} 유튜브 영상 새 탭에서 재생`},
    img,
    E('span',{class:'yt-play-icon','aria-hidden':'true'},'▶'),
    E('span',{class:'yt-badge','aria-hidden':'true'},'YouTube ↗'));
}
function tripVideoLinks(item){
  const videos=(item.plan?.references||[]).filter(ref=>isYoutubeUrl(ref.url));
  if(!videos.length)return null;
  return E('div',{class:'trip-video-links','aria-label':`${item.title} 관련 유튜브 영상`},
    E('p',{class:'small muted'},'참고 영상 (YouTube)'),
    E('div',{class:'trip-video-list'},videos.map(ref=>{
      const url=safeUrl(ref.url),thumb=youtubeThumbUrl(url),clean=ref.title.replace(/^유튜브\s*·\s*/,'');
      if(!url)return null;
      if(!thumb)return externalLink('▶ '+clean,url);
      const img=E('img',{class:'yt-thumb-img',src:thumb,alt:`${clean} 유튜브 썸네일`,loading:'lazy',decoding:'async',width:'320',height:'180'});
      img.addEventListener('error',()=>{img.hidden=true;});
      return E('a',{class:'yt-video-card',href:url,target:'_blank',rel:'noopener noreferrer'},
        E('span',{class:'yt-thumb-wrap'},
          img,
          E('span',{class:'yt-play-icon','aria-hidden':'true'},'▶')),
        E('span',{class:'yt-video-title'},'▶ '+clean+' ↗'));
    })));
}
function renderHoneymoon() {
  const visibleTrips=sortedTrips();
  return [pageHeader('둘만의 첫 여행을 그리며','가고 싶은 여행지와 일정, 예상 비용, 마음에 드는 이유를 모아요.',editButton('여행지 추가',()=>openEditor('honeymoon')),'HONEYMOON'),
    E('p',{class:'form-note honeymoon-note'},'성인 2명·인천 출발·일반석·객실 1실 기준. 계획 금액은 날짜 지정 항공·객실 조회 표시가에 기타 지출 목표와 예비비를 더한 비교용 배분이며 확정 견적은 아닙니다. 각 후보의 상세에서 왕복 일정·현지 숙박 날짜·세금·이동비 포함 범위와 미확인 비용을 확인하세요. 여행 날짜는 한국 출발일과 한국 도착일 기준입니다. 예식 후 인천권 이동·필요 숙박 비용도 기타 배분 안에서 확보해야 합니다.'),
    tripSortControl(),travelOverview(),guestMode?null:E('div',{id:'selected-trip-region'},selectedTripSummary()),E('div',{id:'trip-comparison-region'},tripComparison()),
    content.honeymoon.length?(visibleTrips.length?E('section',{class:'travel-grid'},visibleTrips.map(item=>E('article',{class:'travel-card','data-trip-id':item.id},E('p',{class:'country'},item.country||'우리의 여행 후보'),E('h2',{},item.title),
      tripQuickSpecs(item),tripBudgetBar(item),
      tripBudgetStatus(item),tripQuoteStatus(item),tripStayStatus(item),
      tripProsCons(item),
      E('dl',{class:'trip-meta-dl'},E('dt',{},'한국 출발'),E('dd',{},item.startDate||'미정'),E('dt',{},'한국 도착'),E('dd',{},item.endDate||'미정'),E('dt',{},'2인 계획예산'),E('dd',{},item.budget===null?'미정':`${item.budget.toLocaleString('ko-KR')}원`),E('dt',{},'숙박 요약'),E('dd',{},staySummary(item))),
      tripVideoLinks(item),travelDetails(item),tripControls(item),recordActions('honeymoon',item)))):E('p',{class:'no-results'},tripFavoritesOnly&&tripQuickFilter==='all'?'등록한 관심 여행지가 없습니다.':'선택한 조건에 맞는 여행 후보가 없습니다.')):
    empty('어디로 떠나고 싶나요?','아직 정하지 않아도 괜찮아요. 끌리는 여행지부터 후보로 남겨 두세요.','여행 후보 남기기',()=>openEditor('honeymoon'))];
}
function contactNode(studio,compact=false) {
  const contact=studio.contact;
  return E('div',{class:'contact'},contact.phone?E('a',{href:`tel:${contact.phone.replace(/[^\d+]/g,'')}`},contact.phone):E('span',{class:'muted'},'목록에 미기재'),!compact&&contact.note?E('span',{class:'small'},contact.note):null);
}
function favoriteButton(studio) {
  if(guestMode)return null;
  const pressed=Boolean(prefs.favorites?.includes(studio.id));
  return E('button',{class:'favorite',type:'button','data-studio-id':studio.id,'aria-label':`${studio.name} 관심 스튜디오 ${pressed?'해제':'등록'}`,'aria-pressed':String(pressed),'aria-busy':String(Boolean(favoritePending.get(studio.id))),onclick:()=>{
    favoritePending.set(studio.id,(favoritePending.get(studio.id)||0)+1);
    updateFavoriteButtons(studio);
    queuePreference(async()=>{
      try{
        const set=new Set(prefs.favorites||[]);set.has(studio.id)?set.delete(studio.id):set.add(studio.id);
        const saved=await savePrefs({...prefs,favorites:[...set]});
        if(saved){updateFavoriteButtons(studio);if(favoritesOnly)redrawDirectory();}
        return saved;
      }finally{favoritePending.set(studio.id,favoritePending.get(studio.id)-1);updateFavoriteButtons(studio);}
    });
  }},pressed?'♥':'♡');
}
function updateFavoriteButtons(studio){
  const selected=Boolean(prefs.favorites?.includes(studio.id)),busy=Boolean(favoritePending.get(studio.id));
  for(const target of document.querySelectorAll('.favorite'))if(target.dataset.studioId===studio.id){
    target.setAttribute('aria-pressed',String(selected));target.setAttribute('aria-busy',String(busy));
    target.setAttribute('aria-label',`${studio.name} 관심 스튜디오 ${selected?'해제':'등록'}${busy?' · 저장 중':''}`);target.textContent=selected?'♥':'♡';
  }
}
function compareCard(studio) {
  const memo=E('textarea',{maxlength:'1000','aria-label':`${studio.name} 개인 메모`,placeholder:'마음에 든 장면이나 상담할 내용을 남겨요.'});
  memo.value=prefs.notes?.[studio.id]||'';
  memo.addEventListener('input',()=>{
    const value=memo.value;
    queuePreference(async()=>{
      const saved=await savePrefs({...prefs,notes:{...(prefs.notes||{}),[studio.id]:value}});
      if(!saved)memo.value=prefs.notes?.[studio.id]||'';
      else for(const other of document.querySelectorAll('.compare-card textarea'))if(other!==memo&&other.getAttribute('aria-label')===memo.getAttribute('aria-label'))other.value=value;
      return saved;
    });
  });
  return E('article',{class:'compare-card'},E('div',{class:'card-heading'},E('div',{},E('p',{class:'record-date'},`${studio.zip}번 샘플`),E('h2',{},studio.name)),favoriteButton(studio)),
    E('p',{class:'small muted'},studio.style),E('div',{class:'studio-photos'},studio.images.map((im,index)=>E('button',{type:'button',class:'photo-open','aria-label':`${studio.name} 사진 ${index+1} 확대`,onclick:()=>openPhotos(studio.name,studio.images.map(value=>value.src),index)},image(im.src,`${studio.name} · ${im.file}`)))),contactNode(studio),
    !guestMode?E('label',{class:'field'},E('span',{},'우리의 메모 ',E('span',{class:'muted small'},'· 이 기기에 저장')),memo):null);
}
async function selectStudio(side,id) {if(guestMode){prefs={...prefs,[side]:id};render();return;}if(!await savePrefs({...prefs,[side]:id}))return;render();$('#studio-comparison')?.scrollIntoView({behavior:'smooth',block:'start'});}
function studioDirectory() {
  const search=E('input',{type:'search',placeholder:'스튜디오 이름이나 사진 스타일 검색','aria-label':'스튜디오 검색'});search.value=filter;
  const checked=E('input',{type:'checkbox'});checked.checked=favoritesOnly;
  const phoneChecked=E('input',{type:'checkbox'});phoneChecked.checked=withPhoneOnly;
  const results=E('div',{class:'studio-grid',id:'studio-results'});
  const count=E('span',{class:'small muted','aria-live':'polite'});
  const draw=()=>{
    const query=filter.trim().toLocaleLowerCase();
    const filtered=studios.filter(s=>(!query||`${s.name} ${s.style}`.toLocaleLowerCase().includes(query))&&(!favoritesOnly||prefs.favorites?.includes(s.id))&&(!withPhoneOnly||Boolean(s.contact?.phone)));
    count.textContent=`${filtered.length}곳`;
    results.replaceChildren(...(filtered.length?filtered.map(studio=>E('article',{class:'studio-tile'},image(studio.images[0].src,`${studio.name} 대표 샘플`),E('div',{class:'tile-body'},E('h3',{},studio.name),E('p',{class:'style'},studio.style),contactNode(studio,true),E('div',{class:'tile-actions'},button('비교 A',()=>selectStudio('left',studio.id),'button quiet'),button('비교 B',()=>selectStudio('right',studio.id),'button quiet'),favoriteButton(studio))))):[E('p',{class:'no-results'},'조건에 맞는 스튜디오가 없습니다.')]));
  };
  search.addEventListener('input',()=>{filter=search.value;draw();});checked.addEventListener('change',()=>{favoritesOnly=checked.checked;draw();});phoneChecked.addEventListener('change',()=>{withPhoneOnly=phoneChecked.checked;draw();});redrawDirectory=draw;draw();
  return E('section',{class:'studio-directory'},E('div',{class:'section-heading'},E('div',{},E('h2',{},'전체 스튜디오 둘러보기'),E('p',{},'샘플 폴더에 포함된 30개 항목을 비교할 수 있어요.')),count),
    E('div',{class:'directory-controls'},search,E('div',{class:'directory-filters'},guestMode?null:E('label',{class:'check-label'},checked,'관심 스튜디오만 보기'),E('label',{class:'check-label'},phoneChecked,'연락처 있는 곳만 보기'))),results);
}
async function loadStudios(){
  studiosStatus='loading';studiosError='';
  if(content&&currentRoute()==='studios')render();
  try{
    const response=await fetch('./data/studios.json');if(!response.ok)throw new Error('스튜디오 자료를 불러오지 못했습니다.');
    const data=await response.json();
    if(!Array.isArray(data)||!data.length||data.some(item=>!item.id||!item.contact||!Array.isArray(item.images)||!item.images.length))throw new Error('스튜디오 자료의 형식을 확인해 주세요.');
    studios=data;studiosStatus='ready';
  }catch(error){studiosStatus='error';studiosError=error.message;}
  if(content&&['home','studios'].includes(currentRoute()))render();
}
function renderStudios() {
  if(studiosStatus!=='ready')return [pageHeader('우리에게 맞는 사진을 찾아요.','스튜디오 자료는 다른 메뉴와 별도로 불러옵니다.'),studiosStatus==='loading'?E('p',{role:'status'},'스튜디오 자료를 불러오는 중입니다.'):empty('스튜디오 자료를 불러오지 못했어요.',studiosError,'스튜디오 다시 불러오기',loadStudios,true)];
  const first=studios.find(s=>s.id===prefs.left)||studios.find(s=>s.name==='고유·써드 믹스')||studios[0];
  const second=studios.find(s=>s.id===prefs.right)||studios.find(s=>s.name==='그리프')||studios[1];
  const selector=(side,studio,label)=>{
    const select=E('select',{'aria-label':label},studios.map(s=>E('option',{value:s.id},s.name)));select.value=studio.id;
    select.addEventListener('change',async()=>{if(guestMode){prefs={...prefs,[side]:select.value};render();}else if(await savePrefs({...prefs,[side]:select.value}))render();else select.value=studio.id;});
    return E('label',{class:'field'},label,select);
  };
  const rows=[['사진의 장점','pros'],['취향에 따른 아쉬움','cons'],['잘 맞는 취향','fit'],['추가금·구성 표기','fee']];
  const fees=[['고유 · 베네치아 야외씬','11만 원'],['고유 · 야간','11만 원'],['클레+포에버마인 · 믹스 촬영','10만 원 추가'],['리썸 · 야간·야경','22만 원 추가'],['비마이 · 포토','20만 원 추가']];
  return [pageHeader('우리에게 맞는 사진을 찾아요.','사진 스타일부터 상담 연락처까지, 두 스튜디오를 나란히 비교해 보세요.',null,'PHOTO STUDIOS'),
    E('div',{class:'studio-intro'},E('span',{class:'badge'},'30개 비교 항목'),E('span',{class:'small muted'},'제공된 대표 샘플 기준 · 총비용과 실제 서비스는 별도 확인')),
    E('section',{id:'studio-comparison'},E('div',{class:'compare-selectors'},selector('left',first,'비교할 스튜디오 A'),selector('right',second,'비교할 스튜디오 B')),
      E('div',{class:'compare-grid'},compareCard(first),compareCard(second)),
      E('table',{class:'comparison-table','aria-label':`${first.name}와 ${second.name} 장단점 비교`},E('tbody',{},rows.map(([label,key])=>E('tr',{},E('th',{scope:'row'},label),E('td',{},first[key]),E('td',{},second[key])))))),
    E('details',{class:'disclosure'},E('summary',{},'자료에 표기된 추가금'),E('table',{class:'fee-table'},E('tbody',{},fees.map(([name,fee])=>E('tr',{},E('th',{scope:'row'},name),E('td',{},fee)))))),
    E('details',{class:'disclosure'},E('summary',{},'전체 연락처'),E('table',{class:'fee-table','aria-label':'전체 스튜디오 연락처'},E('tbody',{},studios.map(studio=>E('tr',{},E('th',{scope:'row'},studio.name),E('td',{},contactNode(studio))))))),
    E('details',{class:'disclosure'},E('summary',{},'자료 출처와 비교 범위'),E('div',{class:'source-notes'},
      E('p',{},'사용자가 제공한 8개 ZIP의 JPG 파일 2,885개 중 40개 폴더에서 대표 썸네일 940개를 추출해 비교했습니다. 앨범 편집·중복·기존 샘플이 포함되며 사진 전체의 정밀 평가가 아닙니다.'),
      E('p',{},'연락처는 아모르웨딩홀의 ★ 포토스튜디오 리스트.png 기준입니다. 목록의 공동 표기를 따랐으며 별도 번호가 없는 8개 항목은 미기재로 남겼습니다. 포에버마인 번호는 목록에 지점 구분이 없습니다.'),
      E('p',{},'추가금은 제공 자료의 표기이며 최신 견적을 의미하지 않습니다. 기본 상품, 보정, 앨범과 촬영 조건은 업체에 확인해 주세요. 해밀 샘플의 워터마크는 liberte로 표기돼 있습니다.'),
      E('p',{},'사진은 각 스튜디오의 제공 샘플입니다. 두 사람의 개인 포토 앨범과는 별도로 구분됩니다.'))),studioDirectory()];
}
function tipFavoriteButton(item){
  if(guestMode)return null;
  const pressed=Boolean(prefs.tipFavorites?.includes(item.id));
  return E('button',{class:'favorite',type:'button','data-tip-id':item.id,'aria-label':`${item.title} 관심 꿀팁 ${pressed?'해제':'등록'}`,'aria-pressed':String(pressed),onclick:()=>{
    queuePreference(async()=>{
      const set=new Set(prefs.tipFavorites||[]);set.has(item.id)?set.delete(item.id):set.add(item.id);
      const saved=await savePrefs({...prefs,tipFavorites:[...set]});
      if(saved){
        if(tipFavoritesOnly)redrawTips();
        else for(const node of document.querySelectorAll(`[data-tip-id="${item.id}"]`)){
          const now=Boolean(prefs.tipFavorites?.includes(item.id));
          node.setAttribute('aria-pressed',String(now));node.setAttribute('aria-label',`${item.title} 관심 꿀팁 ${now?'해제':'등록'}`);node.textContent=now?'♥':'♡';
        }
      }
      return saved;
    });
  }},pressed?'♥':'♡');
}
function renderTips(){
  const categories=['all',...new Set(content.tips.map(item=>item.category||'기타'))];
  if(!categories.includes(tipCategory))tipCategory='all';
  const search=E('input',{type:'search',id:'tip-search',placeholder:'꿀팁 제목·분야·핵심 키워드 검색','aria-label':'결혼 정보 꿀팁 검색'});search.value=tipFilter;
  const favCheck=E('input',{type:'checkbox',id:'tip-favorites-only'});favCheck.checked=tipFavoritesOnly;
  const count=E('span',{class:'small muted','aria-live':'polite'});
  const catBar=E('div',{class:'tip-categories','role':'group','aria-label':'꿀팁 분야 선택'});
  const grid=E('section',{class:'tips-grid',id:'tips-results'});
  const draw=()=>{
    catBar.replaceChildren(...categories.map(cat=>{
      const total=cat==='all'?content.tips.length:content.tips.filter(item=>(item.category||'기타')===cat).length;
      const label=cat==='all'?`전체 (${total})`:`${cat} (${total})`;
      const btn=button(label,()=>{tipCategory=cat;draw();},'button quiet');
      btn.setAttribute('aria-pressed',String(tipCategory===cat));
      return btn;
    }));
    const list=filteredTips();
    count.textContent=`${list.length}개의 꿀팁`;
    grid.replaceChildren(...(list.length?list.map(item=>{
      const num=content.tips.findIndex(t=>t.id===item.id)+1;
      return E('article',{class:'tip-card','data-record-id':item.id},
        E('div',{class:'card-heading'},
          E('div',{class:'tip-meta'},E('span',{class:'badge'},item.category||'결혼 꿀팁'),E('span',{class:'small muted'},`#${String(num).padStart(2,'0')}${item.channel?` · ${item.channel}`:''}`)),
          tipFavoriteButton(item)),
        youtubeThumbBanner(item.url,item.title),
        E('h2',{},item.title),
        item.body?E('p',{class:'record-body'},item.body):null,
        E('div',{class:'tip-actions'},
          externalLink(isYoutubeUrl(item.url)?'▶ 유튜브 영상 보기 ↗':'참고 링크 열기 ↗',item.url,'button quiet'),
          recordActions('tips',item)));
    }):[E('p',{class:'no-results'},tipFavoritesOnly?'등록한 관심 꿀팁이 없습니다.':'검색 조건에 맞는 결혼 정보 꿀팁이 없습니다.')]));
  };
  search.addEventListener('input',()=>{tipFilter=search.value;draw();});
  favCheck.addEventListener('change',()=>{tipFavoritesOnly=favCheck.checked;draw();});
  redrawTips=draw;draw();
  return [pageHeader('결혼에 관한 모든 정보','상견례·웨딩홀·스드메·본식부터 예산·신혼집까지, 꼭 알아두면 좋은 결혼식 꿀팁 유튜브 영상과 핵심 요약을 모았어요.',editButton('꿀팁 추가',()=>openEditor('tips')),'WEDDING GUIDE'),
    content.tips.length?E('section',{class:'tips-directory'},
      catBar,
      E('div',{class:'directory-controls'},search,E('div',{class:'directory-filters'},guestMode?null:E('label',{class:'check-label',for:'tip-favorites-only'},favCheck,'관심 꿀팁만 보기'),count)),
      grid):
    empty('첫 결혼 준비 꿀팁을 남겨 볼까요?','도움이 되었던 유튜브 영상이나 체크리스트를 추가해 둘 수 있어요.','꿀팁 추가하기',()=>openEditor('tips'))];
}
function render() {
  const route=currentRoute();
  const renderers={home:renderHome,invitation:renderInvitation,story:renderStories,albums:renderAlbums,studios:renderStudios,honeymoon:renderHoneymoon,tips:renderTips};
  const keepView=route==='honeymoon'&&main.dataset.renderedRoute===route;
  const opened=keepView?[...main.querySelectorAll('details[open][data-view-key]')].map(node=>node.dataset.viewKey):[];
  const active=keepView&&main.contains(document.activeElement)?document.activeElement:null;
  const anchor=active?.closest('[data-trip-id]')|| (keepView?[...main.querySelectorAll('[data-trip-id]')].find(node=>node.getBoundingClientRect().bottom>0):null);
  const anchorId=anchor?.dataset.tripId,anchorTop=anchor?.getBoundingClientRect().top,focusAction=active?.dataset.tripAction;
  main.replaceChildren(...renderers[route]().filter(node=>node!==null&&node!==undefined&&node!==false));main.setAttribute('aria-busy','false');main.dataset.renderedRoute=route;
  if(keepView){
    for(const node of main.querySelectorAll('details[data-view-key]'))node.open=opened.includes(node.dataset.viewKey);
    const nextAnchor=[...main.querySelectorAll('[data-trip-id]')].find(node=>node.dataset.tripId===anchorId);
    if(focusAction)nextAnchor?.querySelector(`[data-trip-action="${focusAction}"]`)?.focus({preventScroll:true});
    if(nextAnchor)window.scrollBy(0,nextAnchor.getBoundingClientRect().top-anchorTop);
  }
  for(const anchor of document.querySelectorAll('[data-route]')) {
    if(anchor.dataset.route===route)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');
  }
  document.title=(route==='home'?'우리의 결혼 기록':`${menus.find(m=>m[0]===route)?.[1]||''} · 우리의 결혼 기록`);
  $('#draft-banner').hidden=!isDraft||guestMode;
  $('#draft-banner span').textContent=draftRevision!==baseRevision?'공개본이 변경되었거나 초안의 기준 버전을 확인할 수 없습니다. 초안을 백업하고 새 공개본을 확인해 주세요.':'이 기기에 저장한 초안을 보고 있어요. 공개 사이트에는 아직 반영되지 않았습니다.';
}
function showDialog(title,body) {
  if(!canLeaveEditor())return false;
  editorState=null;conflictReview=null;photoNavigation=null;$('#dialog-notice').hidden=true;
  $('#editor-title').textContent=title;editor.replaceChildren(body);
  const actionSlot=$('#dialog-actions');actionSlot.replaceChildren();
  const actions=body.matches('form')?body.querySelector('.form-actions'):null;
  if(actions){body.id='active-editor-form';for(const submit of actions.querySelectorAll('[type="submit"]'))submit.setAttribute('form',body.id);actionSlot.append(actions);}
  actionSlot.hidden=!actions;
  if(!dialog.open)dialog.showModal();
  editor.scrollTop=0;$('#editor-title').focus();return true;
}
const fieldSpecs={
  invitation:[['partner1','첫 번째 이름'],['partner2','두 번째 이름'],['date','예식 날짜','date'],['time','예식 시간','time'],['venue','예식장·홀 이름'],['address','주소'],['mapUrl','지도 링크','url'],['message','초대 인사','textarea']],
  stories:[['title','이야기 제목'],['date','기억할 날짜','date'],['body','우리의 이야기','textarea'],['image','사진 주소 (선택)']],
  albums:[['title','앨범 이름'],['date','촬영 날짜','date'],['body','앨범 소개','textarea'],['urls','사진 주소 (한 줄에 하나씩)','textarea']],
  honeymoon:[['title','여행지'],['country','나라·지역'],['startDate','한국 출발일','date'],['endDate','한국 도착일','date'],['budget','두 사람의 계획예산 (원)','number'],['pros','마음에 드는 점','textarea'],['cons','고민할 점','textarea'],['body','일정·상담 메모','textarea'],['url','참고 링크','url']],
  tips:[['title','꿀팁·영상 제목'],['category','분류 (예: 예산·체크리스트, 스드메·웨딩촬영)'],['channel','채널·출처 (선택)'],['body','핵심 꿀팁 요약·메모','textarea'],['url','유튜브 또는 참고 링크','url']]
};
async function shrinkPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WEBP 사진을 선택해 주세요.');
  if(file.size>20*1024*1024)throw new Error('사진 한 장은 20MB 이하로 선택해 주세요.');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',.78);
}
function stayEditor(form,fields,plan){
  const stays=plan.stays.map(stay=>({...stay,nights:String(stay.nights),checkIn:stay.checkIn||'',checkOut:stay.checkOut||''}));
  let basis={startDate:plan.dateBasis?.startDate||fields.startDate.value,endDate:plan.dateBasis?.endDate||fields.endDate.value};
  const currentBasis=()=>({startDate:basis.startDate||fields.startDate.value,endDate:basis.endDate||fields.endDate.value});
  const rows=E('div',{class:'stay-editor-rows'}),status=E('p',{class:'form-note',role:'status'});
  const read=()=>stays.map(stay=>({...stay,region:stay.region.trim(),nights:stay.nights===''?null:Number(stay.nights)}));
  const preview=()=>{status.textContent=stayReview({startDate:fields.startDate.value,endDate:fields.endDate.value,plan:{stays:read(),dateBasis:currentBasis()}}).message;};
  const draw=(focusIndex)=>{
    rows.replaceChildren(...stays.map((stay,index)=>{
      const group=E('fieldset',{class:'stay-edit-row'},E('legend',{},`숙박 ${index+1}`));
      const inputs={};
      for(const [key,label,type]of [['region','숙박 지역','text'],['nights','숙박 박 수','number'],['checkIn','현지 체크인','date'],['checkOut','현지 체크아웃','date']]){
        const input=E('input',{type,id:`stay-${index}-${key}`});input.value=stay[key];inputs[key]=input;
        if(type==='number'){input.min='1';input.max='365';input.step='1';}if(key==='region')input.maxLength=120;
        if(key==='region'||key==='nights')input.required=true;
        input.addEventListener('input',()=>{stay[key]=input.value;sync();preview();});
        group.append(E('label',{class:'field',for:input.id},`${label} ${index+1}`,input));
      }
      const sync=()=>{
        const span=dateSpan(stay.checkIn,stay.checkOut),derived=span!==null&&span>0;
        inputs.nights.readOnly=derived;
        if(derived){stay.nights=String(span);inputs.nights.value=stay.nights;}
      };
      sync();
      const move=target=>{[stays[index],stays[target]]=[stays[target],stays[index]];draw(target);preview();};
      const up=button('앞으로',()=>move(index-1),'button quiet');up.disabled=index===0;
      const down=button('뒤로',()=>move(index+1),'button quiet');down.disabled=index===stays.length-1;
      group.append(E('div',{class:'stay-edit-actions'},up,down,button(`숙박 ${index+1} 삭제`,()=>{stays.splice(index,1);draw(Math.min(index,stays.length-1));preview();},'button danger')));
      return group;
    }));
    if(focusIndex!==undefined)(rows.children[focusIndex]?.querySelector('input')||add).focus({preventScroll:true});
  };
  const add=button('숙박 추가',()=>{if(stays.length>=20){toast('숙박은 20개까지 입력할 수 있습니다.',true);return;}stays.push({region:'',nights:'1',checkIn:'',checkOut:''});draw(stays.length-1);preview();},'button quiet');
  form.append(E('h3',{},'숙박 구성·현지 날짜'),E('p',{class:'form-note'},'숙박 순서대로 입력해 주세요. 현지 체크인·체크아웃을 모두 입력하면 박 수를 자동 계산합니다. 항공편과 시차는 별도로 확인해 주세요.'),rows,add,status,
    button('현재 날짜로 가안 기준 갱신',()=>{
      if(dateSpan(fields.startDate.value,fields.endDate.value)===null){toast('한국 출발·도착 날짜를 먼저 확인해 주세요.',true);return;}
      basis={startDate:fields.startDate.value,endDate:fields.endDate.value};preview();toast('가안 기준 날짜를 갱신했습니다. 초안에 저장해 주세요.');
    },'button quiet'));
  fields.startDate.addEventListener('input',preview);fields.endDate.addEventListener('input',preview);draw();preview();
  return {read,basis:currentBasis};
}
function quoteEditor(form,fields,plan,currentTrip){
  const original=structuredClone(plan.quote||emptyQuote()),body=E('div',{class:'quote-editor-body'});
  body.append(E('p',{class:'form-note'},'실제 조회한 성인 2명·인천·일반석·객실 1실 견적만 기록하세요. 항공·숙박의 조회 근거와 한국 출발·도착 시각, 기타 여행비까지 입력합니다. 예비비는 현재 계획 배분을 더합니다. 예약 확정을 뜻하지 않습니다.'));
  const specs=[...['airfare','lodging','other'].map(key=>[key,`${COST_LABELS[key]} 실제 견적 (원)`,'number',original.costs[key]??'']),
    ['checkedOn','견적 조회일','date',original.checkedOn],['flightSource','항공 견적 근거·편명·포함 조건','textarea',original.flightSource],['lodgingSource','숙박 견적 근거·객실·포함 조건','textarea',original.lodgingSource],
    ['departureAt','견적 항공편 한국 출발 시각','datetime-local',original.departureAt],['arrivalAt','견적 항공편 한국 도착 시각','datetime-local',original.arrivalAt]];
  for(const [key,label,type,value] of specs){
    const input=type==='textarea'?E('textarea',{rows:'3',maxlength:'2000'}):E('input',{type});input.id='quote-'+key;input.value=value;
    if(type==='number'){input.min='0';input.step='1';}
    fields['quote_'+key]=input;body.append(E('label',{class:'field',for:input.id},label,input));
  }
  let confirmedBasis=original.basis;
  const matches=()=>JSON.stringify(quoteBasis(currentTrip()))===JSON.stringify(confirmedBasis);
  const included=E('input',{type:'checkbox',id:'quote-included'});included.checked=original.includesRequiredCosts&&matches();fields.quote_included=included;
  included.addEventListener('change',()=>{if(included.checked)confirmedBasis=quoteBasis(currentTrip());});
  const invalidate=()=>{if(!matches())included.checked=false;};
  form.addEventListener('input',event=>{if(event.target!==included)invalidate();});form.addEventListener('click',event=>{if(event.target.closest('button'))invalidate();});
  body.append(E('label',{class:'quote-check',for:included.id},included,'현재 여행 날짜·숙박 구성의 견적이며 세금·수하물·식사·공항 및 지역 이동비를 포함해 확인했습니다.'));
  form.append(E('details',{class:'quote-editor'},E('summary',{},'실제 견적·항공편 기록 (선택)'),body));
  const read=()=>({...original,costs:Object.fromEntries(['airfare','lodging','other'].map(key=>[key,fields['quote_'+key].value===''?null:Number(fields['quote_'+key].value)])),
    ...Object.fromEntries(['checkedOn','flightSource','lodgingSource','departureAt','arrivalAt'].map(key=>[key,fields['quote_'+key].value.trim()])),includesRequiredCosts:included.checked&&matches(),basis:confirmedBasis});
  return {read};
}
function planExtraEditor(form,fields,plan){
  const body=E('div',{class:'quote-editor-body'});
  const monthSelect=E('select',{id:'plan-climateMonth'},[['','미입력'],...Array.from({length:12},(_,i)=>[String(i+1),`${i+1}월`])].map(([value,label])=>E('option',{value},label)));
  monthSelect.value=plan.climateMonth===null||plan.climateMonth===undefined?'':String(plan.climateMonth);
  fields.plan_climateMonth=monthSelect;
  const specs=[
    ['experiences','경험 제안','textarea',plan.experiences||'','12000'],
    ['comparisonNote','후보 한눈에 보기 요약','textarea',plan.comparisonNote||'','500'],
    ['climate','기후 경향 안내','textarea',plan.climate||'','12000'],
    ['climateMonth','기후 기준 월','select'],
    ['sourceTitle','기후 출처 이름','text',plan.sourceTitle||'','500'],
    ['sourceUrl','기후 공식 출처 링크','url',plan.sourceUrl||'','4000'],
    ['checkedOn','기후 자료 확인일','date',plan.checkedOn||'','10'],
    ['budgetNotes','비용 배분 참고 설명','textarea',plan.budgetNotes||'','12000'],
    ['researchNotes','계획 자료·확인 범위 설명','textarea',plan.researchNotes||'','12000'],
    ['references','추가 조사 출처 (한 줄에 제목 | https://주소)','textarea',(plan.references||[]).map(r=>`${r.title} | ${r.url}`).join('\n'),'24000']
  ];
  const initialValues={};
  for(const [key,label,kind,value,max] of specs){
    if(kind==='select'){initialValues[key]=monthSelect.value;body.append(E('label',{class:'field',for:monthSelect.id},label,monthSelect));continue;}
    const input=kind==='textarea'?E('textarea',{rows:'3',maxlength:max}):E('input',{type:kind,maxlength:max});
    input.id=`plan-${key}`;input.value=value;initialValues[key]=value;fields[`plan_${key}`]=input;
    body.append(E('label',{class:'field',for:input.id},label,input));
  }
  form.append(E('details',{class:'plan-extra-editor'},E('summary',{},'기후·경험·출처·비교 요약 편집 (선택)'),body));
  const read=()=>{
    const next={};
    for(const key of ['experiences','comparisonNote','climate','sourceTitle','sourceUrl','checkedOn','budgetNotes','researchNotes']){
      const raw=fields[`plan_${key}`].value;
      if(raw!==initialValues[key])next[key]=raw.trim();
    }
    if(monthSelect.value!==initialValues.climateMonth)next.climateMonth=monthSelect.value===''?null:Number(monthSelect.value);
    if(fields.plan_references.value!==initialValues.references){
      next.references=fields.plan_references.value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
        const sep=line.indexOf('|');
        if(sep===-1)throw new Error('추가 조사 출처는 한 줄에 "제목 | https://주소" 형식으로 입력해 주세요.');
        return {title:line.slice(0,sep).trim(),url:line.slice(sep+1).trim()};
      });
    }
    return next;
  };
  return {read};
}
function openEditor(type,item=null) {
  if(guestMode)return;
  const titles={invitation:'예식 정보 편집',stories:'우리의 이야기',albums:'포토 앨범',honeymoon:'신혼여행 후보',tips:'결혼 정보·꿀팁'};
  const editingContent=structuredClone(content);
  const values=type==='invitation'?content.invitation:(item||{});
  let approvedRaw;
  const form=E('form',{class:'editor-form'});const fields={};
  form.appendChild(E('p',{class:'form-note'},'작성한 내용은 이 브라우저의 초안에 저장됩니다. 공개 사이트 반영은 내용 관리에서 공개용 파일을 저장한 뒤 진행해 주세요.'));
  for(const [key,label,kind='text'] of fieldSpecs[type]) {
    const input=kind==='textarea'?E('textarea',{rows:'4'}):E('input',{type:kind});
    input.name=key;input.id=`field-${key}`;
    input.value=key==='urls'?'':(values[key]??'');
    if(key==='title')input.required=true;
    if(key==='budget'){input.min='0';input.step='1';}
    if(key==='title')input.maxLength=160;
    if(key==='category')input.maxLength=80;
    if(key==='channel')input.maxLength=120;
    fields[key]=input;form.appendChild(E('label',{class:'field',for:input.id},label,input));
  }
  let editedPlan,stayFields,quoteFields,extraFields;
  if(type==='honeymoon'){
    editedPlan=structuredClone(item?.plan||{version:1,costs:{airfare:null,lodging:null,other:null,reserve:null},stays:[],lodgingNotes:'',itinerary:'',experiences:'',transport:'',climate:'',climateMonth:null,sourceTitle:'',checkedOn:'',budgetNotes:''});
    form.append(E('p',{class:'form-note'},'참고 링크는 직접 작성하는 메모용 주소이며 기후 공식 출처와 별도로 저장합니다.'));
    if(editedPlan.sourceTitle)form.append(E('div',{class:'form-note'},E('p',{},`기후 자료: ${editedPlan.sourceTitle}${editedPlan.checkedOn?' · 자료 확인일 '+editedPlan.checkedOn:''}`),externalLink('기후 공식 안내 ↗',editedPlan.sourceUrl||'')));
    stayFields=stayEditor(form,fields,editedPlan);
    for(const [key,label]of [['lodgingNotes','숙박 구성 메모'],['itinerary','일정 흐름 가안'],['transport','계획상 이동']]){
      const input=E('textarea',{rows:'4',id:`plan-${key}`,maxlength:'12000'});input.value=editedPlan[key];fields[`plan_${key}`]=input;
      form.append(E('label',{class:'field',for:input.id},label,input));
    }
    form.append(E('p',{class:'form-note'},'총액과 항목 배분은 별도로 입력합니다. 차이는 미배분 또는 배분 초과로 표시하며 임의로 비용을 채우지 않습니다.'));
    for(const [key,label]of Object.entries(COST_LABELS)){
      const input=E('input',{type:'number',min:'0',step:'1',id:`cost-${key}`});input.value=editedPlan.costs[key]??'';fields[`cost_${key}`]=input;
      form.append(E('label',{class:'field',for:input.id},`${label} 배분 (원)`,input));
    }
    form.append(button('배분 합계로 계획예산 채우기',()=>{
      const values=Object.keys(COST_LABELS).map(key=>fields[`cost_${key}`].value.trim()).filter(Boolean).map(Number);
      if(!values.length){toast('배분 금액을 먼저 입력해 주세요.',true);return;}
      const sum=values.reduce((a,b)=>a+b,0);
      fields.budget.value=String(sum);
      toast(`입력된 배분 합계 ${sum.toLocaleString('ko-KR')}원을 계획예산에 반영했습니다.`);
    },'button quiet'));
    quoteFields=quoteEditor(form,fields,editedPlan,()=>({country:fields.country.value.trim(),startDate:fields.startDate.value,endDate:fields.endDate.value,plan:{stays:stayFields.read()}}));
    extraFields=planExtraEditor(form,fields,editedPlan);
  }
  let albumImages=[...(item?.images||[])], processing=false,saving=false;
  if(type==='stories'){
    const preview=E('div',{class:'photo-editor'});
    const drawStoryPhoto=()=>{
      const src=safeUrl(fields.image.value.trim(),{image:true});
      preview.replaceChildren(...(src?[E('div',{class:'photo-edit-card'},image(src,'이야기 사진 미리보기'),E('p',{},'등록할 사진'),
        E('div',{class:'photo-edit-actions'},button('사진 삭제',()=>{fields.image.value='';drawStoryPhoto();fields.image.focus({preventScroll:true});},'button danger')))]:[]));
    };
    fields.image.addEventListener('input',drawStoryPhoto);
    const fileInput=E('input',{type:'file',accept:'image/jpeg,image/png,image/webp',class:'file-input'});
    fileInput.addEventListener('change',async()=>{
      const file=fileInput.files?.[0];if(!file)return;
      processing=true;submit.disabled=true;fileInput.disabled=true;
      try{
        const added=await shrinkPhoto(file);
        if(!form.isConnected||!dialog.open)return;
        fields.image.value=added;drawStoryPhoto();
      }catch(error){toast(error.message,true);}finally{processing=false;submit.disabled=false;fileInput.disabled=false;fileInput.value='';}
    });
    form.append(E('label',{class:'field'},'사진 파일 선택 (선택)',fileInput),E('p',{class:'small muted'},'사진 파일은 초안용으로 줄여 저장합니다. 원본은 별도로 보관해 주세요.'),preview);
    drawStoryPhoto();
  }
  if(type==='albums') {
    const previews=E('div',{class:'photo-editor'});
    const draw=(focusIndex,action)=>{previews.replaceChildren(...albumImages.map((src,index)=>{
      const move=(target)=>{[albumImages[index],albumImages[target]]=[albumImages[target],albumImages[index]];draw(target,'앞으로');};
      const previous=button('앞으로',()=>move(index-1),'button quiet');previous.disabled=index===0;
      const next=button('뒤로',()=>move(index+1),'button quiet');next.disabled=index===albumImages.length-1;
      return E('div',{class:'photo-edit-card'},image(src,`사진 ${index+1}`),E('p',{},index===0?'대표 사진':`사진 ${index+1}`),
        E('div',{class:'photo-edit-actions'},previous,next,button('대표로',()=>{albumImages.unshift(...albumImages.splice(index,1));draw(0,'대표로');},'button quiet'),button('사진 삭제',()=>{albumImages.splice(index,1);draw(Math.min(index,albumImages.length-1),'사진 삭제');},'button danger')));
    }));
      if(focusIndex!==undefined){
        const card=previews.children[focusIndex];
        const target=card&&[...card.querySelectorAll('button')].find(node=>node.textContent===action&&!node.disabled);
        (target||card?.querySelector('button:not(:disabled)')||fields.urls).focus({preventScroll:true});
      }
    };
    const addUrls=()=>{
      const urls=fields.urls.value.split(/\r?\n/).map(src=>src.trim()).filter(Boolean);
      if(albumImages.length+urls.length>100)throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
      if(urls.some(src=>!safeUrl(src,{image:true})))throw new Error('사진 주소를 확인해 주세요.');
      albumImages.push(...urls);fields.urls.value='';draw();
    };
    form.appendChild(button('주소에서 사진 추가',()=>{try{addUrls();}catch(error){toast(error.message,true);}},'button quiet'));
    const files=E('input',{type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true,class:'file-input'});
    files.addEventListener('change',async()=>{
      processing=true;submit.disabled=true;files.disabled=true;
      try {
        if(albumImages.length+files.files.length>100)throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
        const additions=[];
        for(const file of files.files)additions.push(await shrinkPhoto(file));
        if(!form.isConnected||!dialog.open)return;
        albumImages.push(...additions);draw();
      }catch(error){toast(error.message,true);}finally{processing=false;submit.disabled=false;files.disabled=false;files.value='';}
    });
    form.append(E('label',{class:'field'},'사진 파일 추가 (선택)',files),E('p',{class:'small muted'},'사진은 초안용으로 줄여 저장합니다. 첫 번째 사진이 대표 사진입니다. 원본은 별도로 보관해 주세요.'),previews);
    draw();
  }
  const submit=E('button',{class:'button',type:'submit'},'초안에 저장');
  form.appendChild(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(processing||saving)return;saving=true;submit.disabled=true;
    let attemptedNext,savedId;
    const controlStates=[...form.querySelectorAll('input,textarea,select,button')].map(node=>[node,node.disabled]);
    for(const [node]of controlStates)node.disabled=true;
    try {
      const next=structuredClone(editingContent);const data=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));
      if(type==='invitation')next.invitation=data;
      else {
        const id=item?.id||crypto.randomUUID();savedId=id;
        let record={...data,id};
        if(type==='albums') {
          const images=[...albumImages,...data.urls.split(/\r?\n/).map(src=>src.trim()).filter(Boolean)];
          record={id,title:data.title,date:data.date,body:data.body,images};
        }
        if(type==='honeymoon'){
          record.budget=data.budget===''?null:Number(data.budget);
          record.plan={...editedPlan,stays:stayFields.read(),dateBasis:stayFields.basis(),costs:Object.fromEntries(Object.keys(COST_LABELS).map(key=>[key,data[`cost_${key}`]===''?null:Number(data[`cost_${key}`])])),...extraFields.read()};
          for(const key of Object.keys(COST_LABELS))delete record[`cost_${key}`];
          for(const key of ['lodgingNotes','itinerary','transport'])record.plan[key]=data[`plan_${key}`];
          record.plan.quote=quoteFields.read();
          for(const key of Object.keys(record))if(key.startsWith('plan_')||key.startsWith('quote_'))delete record[key];
        }
        const index=next[type].findIndex(value=>value.id===id);
        if(index===-1)next[type].push(record);else next[type][index]=record;
      }
      attemptedNext=next;
      await setDraft(next,editingContent,approvedRaw);closeDialog();render();
      if(type!=='invitation')focusRecord(type,savedId);
      toast('이 기기에 초안을 저장했습니다.');
    }catch(error){
      toast(error.message,true);
      if(error instanceof StorageConflict){
        beginConflictReview({key:DRAFT_KEY,base:editingContent,next:attemptedNext,
          keepSaved:()=>{
            if(!confirm('현재 입력을 버리고 다른 탭의 저장본을 불러올까요?'))return;
            try{syncDraftFromStorage();closeDialog();render();}catch(cause){toast(cause.message,true);}
          },saveLocal:raw=>{approvedRaw=raw;form.requestSubmit();}});
      }
    }finally{saving=false;submit.disabled=false;for(const [node,disabled]of controlStates)node.disabled=disabled;}
  });
  const snapshot=()=>JSON.stringify({values:Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.type==='checkbox'?input.checked:input.value])),images:albumImages,stays:stayFields?.read(),basis:stayFields?.basis()});
  const initial=snapshot();
  if(showDialog(titles[type],form))editorState={isDirty:()=>processing||saving||snapshot()!==initial,isSaving:()=>saving};
}
function downloadText(raw,filename,type){
  const blob=new Blob([raw],{type});
  const url=URL.createObjectURL(blob);const a=E('a',{href:url,download:filename});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadJson(value,filename){downloadText(JSON.stringify(value)+'\n',filename,'application/json;charset=utf-8');}
async function downloadSaved(key){
  const pendingAtStart=pendingWriteTasks.size>0;
  try{
    if(pendingAtStart)toast('변경 내용을 저장한 뒤 최신 저장본으로 백업합니다.');
    await finishPendingWrites();
    if(!pendingAtStart&&lastWriteFailed&&!confirm('최근 변경의 저장에 실패했습니다. 마지막으로 저장된 내용만 백업할까요?'))return;
    const value=await navigator.locks.request(`wedding-storage:${key}`,()=>{
      const raw=localStorage.getItem(key);
      return key===PREF_KEY?validatePreferences(JSON.parse(raw||'{}')):raw?parseContent(raw):validateContent(baseContent);
    });
    if(key===PREF_KEY){prefs=value;downloadJson({kind:'wedding-private-preferences',schemaVersion:1,preferences:value},'wedding-private-preferences.json');}
    else downloadJson(value,'site.json');
  }catch(error){toast(error.message||'백업을 저장하지 못했습니다.',true);}
}
function downloadContent(){return downloadSaved(DRAFT_KEY);}
function downloadPrivate(){return downloadSaved(PREF_KEY);}
function openManager() {
  if(guestMode)return;
  const managerBase=structuredClone(content),managerRaw=readStorage(DRAFT_KEY);
  const personal=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'개인 메모·선택 백업 선택'});
  personal.addEventListener('change',async()=>{
    const selected=personal.files?.[0];if(!selected)return;
    try{
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
      const next=parsePreferencesBackup(await selected.text());
      if(!confirm('이 기기의 스튜디오 메모와 관심·비교·여행 선택을 백업 내용으로 바꿀까요?'))return;
      if(await savePrefs(next)){closeDialog();render();toast('개인 메모와 선택을 복원했습니다.');}
    }catch(error){toast(error.message,true);}finally{personal.value='';}
  });

  const file=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'콘텐츠 JSON 파일 선택'});
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    try {
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('콘텐츠 파일은 8MB 이하로 선택해 주세요.');
      const next=parseContent(await selected.text());
      if(!confirm('현재 기기의 초안을 선택한 파일의 내용으로 바꿀까요?'))return;
      const applyImport=async approvedRaw=>{
        try{await setDraft(next,managerBase,approvedRaw);closeDialog();render();toast('콘텐츠를 이 기기의 초안으로 불러왔습니다.');}
        catch(error){
          if(error instanceof StorageConflict)beginConflictReview({key:DRAFT_KEY,base:managerBase,next,
            saveLocal:applyImport,keepSaved:()=>{try{syncDraftFromStorage();closeDialog();render();toast('다른 탭의 저장본을 유지했습니다.');}catch(cause){toast(cause.message,true);}}});
          else toast(error.message,true);
        }
      };
      await applyImport();
    }catch(error){toast(error.message,true);}finally{file.value='';}
  });
  showDialog('내용 관리',E('div',{},E('p',{class:'form-note'},'공개본은 저장소의 콘텐츠입니다. 여기서 편집한 내용은 이 기기에만 저장되며 자동으로 공개되지 않습니다.'),
    E('section',{class:'manager-section'},E('h3',{},'개인 메모·선택 백업'),E('p',{},'스튜디오 메모와 관심·비교 선택, 여행 관심·비교·최종 선택, 관심 꿀팁을 개인 파일로 보관합니다. 콘텐츠 초안과 사진은 공개용 파일 저장으로 따로 백업하세요. 개인 백업은 공개 저장소에 올리지 마세요.'),button('개인 백업 저장',downloadPrivate,'button quiet'),personal),
    E('section',{class:'manager-section'},E('h3',{},'방문자용 보기'),E('p',{},'방문자용 링크는 공개본만 표시하며 편집 버튼과 이 기기의 개인 메모를 숨깁니다. 접근 권한을 제한하는 기능은 아닙니다.'),linkButton('방문자용 청첩장 열기','?view=guest#/invitation',true)),
    isDraft&&draftRevision!==baseRevision?E('section',{class:'manager-section'},E('h3',{},'새 공개본 확인'),E('p',{},'현재 초안을 파일로 백업한 후 새 공개본을 확인하세요. 공개본으로 돌아가면 초안을 지우며 자동으로 합치지 않습니다.'),button('현재 초안 백업',downloadContent,'button quiet'),linkButton('새 공개본 미리보기','?view=guest#/home',true)):null,
    E('section',{class:'manager-section'},E('h3',{},'기본 정보'),E('p',{},'이름, 예식 일정과 장소, 청첩장 인사를 채워요.'),editButton('예식 정보 편집',()=>openEditor('invitation'),'button quiet')),
    E('section',{class:'manager-section'},E('h3',{},'공개할 내용 파일로 저장'),E('p',{},'저장한 site.json 파일을 Codex에 전달해 공개 사이트에 반영할 수 있어요. 파일에는 청첩장·일대기·앨범·신혼여행·결혼 정보가 담기며, 스튜디오 개인 메모는 포함되지 않습니다.'),button('공개용 파일 저장',downloadContent)),
    E('section',{class:'manager-section'},E('h3',{},'이전에 저장한 내용 불러오기'),E('p',{},'이 앱에서 저장한 JSON 콘텐츠 파일을 선택해 주세요.'),file),
    E('section',{class:'manager-section'},E('h3',{},'초안을 지우고 공개본 보기'),E('p',{},'이 기기의 콘텐츠 초안만 지웁니다. 관심 스튜디오와 개인 메모는 유지됩니다.'),button('공개본으로 돌아가기',async()=>{
      if(!confirm('이 기기의 콘텐츠 초안을 지울까요? 필요한 내용은 먼저 파일로 저장해 주세요.'))return;
      try{
        await navigator.locks.request(`wedding-storage:${DRAFT_KEY}`,()=>{
          if(localStorage.getItem(DRAFT_KEY)!==managerRaw)throw new Error('다른 탭에서 초안이 변경되었습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 시도해 주세요.');
          localStorage.removeItem(DRAFT_KEY);
        });
        content=structuredClone(baseContent);isDraft=false;draftRevision=baseRevision;closeDialog();render();toast('공개본으로 돌아왔습니다.');
      }catch(error){toast(error.message||'초안을 지우지 못했습니다.',true);}
    },'button danger'))));
}
function syncDraftFromStorage(){
  const saved=localStorage.getItem(DRAFT_KEY);
  content=saved?parseContent(saved):structuredClone(baseContent);isDraft=Boolean(saved);draftRevision=saved?JSON.parse(saved).baseRevision??null:baseRevision;
}
$('#close-dialog').addEventListener('click',requestClose);
dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
dialog.addEventListener('keydown',event=>photoNavigation?.(event));
$('#manage-content').addEventListener('click',()=>content&&openManager());
$('#manage-draft').addEventListener('click',()=>content&&openManager());
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');
  if(anchor?.matches('.skip-link[href="#main"]')){
    event.preventDefault();
    if(!dialog.open){main.focus({preventScroll:true});main.scrollIntoView({block:'start',behavior:'instant'});}
    return;
  }
  const opensElsewhere=event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||anchor?.target.toLowerCase()==='_blank';
  if(anchor&&dirtyEditor()&&!opensElsewhere&&!anchor.hasAttribute('download')){
    if(!canLeaveEditor()){event.preventDefault();event.stopImmediatePropagation();}else closeDialog();
  }
},true);
window.addEventListener('beforeunload',event=>{if(dirtyEditor()||pendingWrites||pendingWriteTasks.size){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{
  if(!content||location.hash==='#main')return;
  if(!canLeaveEditor()){history.replaceState(null,'',location.pathname+location.search+previousHash);return;}
  previousHash=location.hash;closeDialog();render();window.scrollTo({top:0,behavior:'instant'});
});
window.addEventListener('storage',event=>{
  if(guestMode||!content||![DRAFT_KEY,PREF_KEY,null].includes(event.key))return;
  if(conflictReview&&dialog.open){if(event.key===conflictReview.key||event.key===null)conflictReview.refresh();return;}
  if(dialog.open||document.activeElement?.matches('textarea')){
    toast('다른 탭의 저장 내용이 변경되었습니다. 현재 입력은 유지하며 저장할 때 변경 내용을 확인합니다.');return;
  }
  try{syncDraftFromStorage();prefs=validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}'));render();toast('다른 탭의 저장 내용을 반영했습니다.');}
  catch(error){toast('다른 탭의 내용을 읽지 못했습니다. 기존 화면을 유지합니다. '+error.message,true);}
});

async function init() {
  try {
    void loadStudios();
    const siteResponse=await fetch('./data/site.json');
    if(!siteResponse.ok)throw new Error('콘텐츠 파일을 불러오지 못했습니다.');
    baseContent=parseContent(await siteResponse.text());
    baseRevision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(baseContent))))).map(value=>value.toString(16).padStart(2,'0')).join('');content=structuredClone(baseContent);
    let notice='';
    const saved=readStorage(DRAFT_KEY);
    if(saved&&!guestMode){try{content=parseContent(saved);draftRevision=JSON.parse(saved).baseRevision??null;isDraft=true;}catch{notice='저장된 초안을 읽지 못해 공개본을 표시합니다. 기존 초안은 지우지 않았습니다.';}}
    try{prefs=validatePreferences(guestMode?{}:JSON.parse(readStorage(PREF_KEY)||'{}'));}catch{prefs=validatePreferences({});notice='개인 설정을 읽지 못했습니다. 기존 저장 데이터는 지우지 않았습니다.';}
    $('#manage-content').hidden=guestMode;
    if(guestMode)document.querySelector('.header-inner').appendChild(linkButton('일반 보기','./#/home',true));
    render();if(notice)toast(notice,true);
  }catch(error){main.setAttribute('aria-busy','false');main.replaceChildren(empty('기록을 불러오지 못했어요.',error.message,'다시 불러오기',()=>location.reload(),true));}
}
init();
