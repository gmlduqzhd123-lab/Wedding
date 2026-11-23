import { parseContent, validateContent, formatDate, weddingDday, invitationCountdownInfo, invitationLiveCountdown, extractPhoneNumber, extractAccountNumber, safeUrl, MAX_IMPORT_BYTES, summarizeContentDiff } from './content.js?v=wedding-features-52';
import { validatePreferences, parsePreferencesBackup, pruneContentPreferences, mergePreferences, summarizePreferencesMerge, CHECKLIST_STAGES } from './preferences.js?v=wedding-features-52';
import { lockedMerge, StorageConflict, mergeChanges } from './storage.js?v=wedding-features-52';
import { dateSpan } from './travel.js?v=wedding-features-52';
import { invitationCalendar, googleCalendarUrl } from './calendar.js?v=wedding-features-52';
import { weddingBudgetSummary, guestListSummary, giftLedgerSummary } from './planning.js?v=wedding-features-52';
import { renderQrSvgString } from './qrcode.js?v=wedding-features-52';
import { $, E, S, button, linkButton, externalLink, image, formatPartner, downloadText, downloadJson } from './dom.js?v=wedding-features-52';
import { stopInvitationBgm, renderInvitationBgmButton } from './bgm.js?v=wedding-features-52';
import { formatKoreanTimeLabel, buildInvitationShareMessages, renderInvitationCornerMarks, renderInvitationDivider, renderBotanicalLeaf, renderInvitationHeroVisual, renderInvitationCalendar, downloadInvitationCardPng } from './invitation-card.js?v=wedding-features-52';
import { renderStudios as renderStudiosModule } from './studio-ui.js?v=wedding-features-52';
import { CEREMONY_PREP_ITEMS, setCeremonySubTab, renderCeremony as renderCeremonyModule } from './ceremony-ui.js?v=wedding-features-52';
import { PRENATAL_CHECK_ITEMS, renderPrenatal as renderPrenatalModule } from './prenatal-ui.js?v=wedding-features-52';
import { tripFlightBadge, sortedTrips, updateTripChoices, ensureTripVisible, renderHoneymoon as renderHoneymoonModule } from './travel-ui.js?v=wedding-features-52';
import { WEDDING_BUDGET_CATEGORIES, activeVendorSchedules, filteredTips, setTipsSubTab, renderTips as renderTipsModule } from './planning-ui.js?v=wedding-features-52';
import { openEditor as openEditorModule } from './editor-ui.js?v=wedding-features-52';

const main=$('#main'), dialog=$('#editor-dialog'), editor=$('#editor-body');
const DRAFT_KEY='wedding:v1:draft', PREF_KEY='wedding:v1:preferences', LARGE_TEXT_KEY='wedding:v1:largeText';
const routes=['home','invitation','story','albums','studios','honeymoon','ceremony','prenatal','tips'];
const menus=[
  ['invitation','청첩장','소중한 분들을 초대하는 우리의 첫 인사.','INVITATION'],
  ['story','우리의 일대기','첫 만남부터 오늘까지, 함께 쌓아 온 시간.','OUR STORY'],
  ['albums','포토 앨범','오래 꺼내 보고 싶은 두 사람의 순간들.','PHOTO ALBUM'],
  ['studios','스튜디오','라크마 촬영 일정과 당일 동선·준비물 안내.','STUDIOS'],
  ['honeymoon','신혼여행','결혼 후 첫 여행, 가고 싶은 곳부터 차근차근.','HONEYMOON'],
  ['ceremony','본식 식순','순천아모르 식순·사회자 대본, 혼인서약서와 하객·축의금 관리.','CEREMONY & VOWS'],
  ['prenatal','산전검사','순천 현대여성아동병원 안내와 산전검사 지원금 수령 절차.','PRENATAL CARE'],
  ['tips','결혼에 관한 모든 정보','상견례·웨딩홀·스드메·본식·혼수까지 결혼 준비 꿀팁 모음.','WEDDING GUIDE']
];
let baseContent, content, studios=[], prefs={}, isDraft=false, toastTimer;
const DEFAULT_STUDIO_ID='studio-09';
const activeLachmaStudio=()=>studios.find(s=>s.id===DEFAULT_STUDIO_ID)||studios.find(s=>s.name==='라크마');
const won=value=>value===null?'미확인':`${value.toLocaleString('ko-KR')}원`;
let checklistIncompleteOnly=false, slideshowTimer=null, storySort='asc';
let largeTextMode=(()=>{try{return sessionStorage.getItem(LARGE_TEXT_KEY)==='1';}catch{return false;}})();
let countdownTimer=null, activeCountdownSlot=null;
const urlGuestMode=new URLSearchParams(location.search).get('view')==='guest';
let guestMode=urlGuestMode;
let baseRevision='', draftRevision=null, editorState=null, studiosStatus='loading', studiosError='';
let previousHash=location.hash,pendingWrites=0;
let conflictReview=null,photoNavigation=null;
let preferenceQueue=Promise.resolve();
const pendingWriteTasks=new Set();
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
const readStorage=key=>{try{return localStorage.getItem(key);}catch{return null;}};
function syncLargeTextUi(){
  document.body.classList.toggle('is-large-text',largeTextMode);
  const btn=document.querySelector('.invitation-text-btn');
  if(!btn)return;
  btn.textContent=largeTextMode?'가- 보통':'가+ 크게';
  btn.setAttribute('aria-pressed',String(largeTextMode));
  btn.classList.toggle('is-active',largeTextMode);
}
function toggleLargeTextMode(){
  largeTextMode=!largeTextMode;
  try{sessionStorage.setItem(LARGE_TEXT_KEY,largeTextMode?'1':'0');}catch{}
  syncLargeTextUi();
  toast(largeTextMode?'청첩장 글씨를 크게 표시합니다.':'청첩장 글씨를 기본 크기로 돌렸습니다.');
}
function renderLargeTextButton(){
  return E('button',{
    type:'button',
    class:'invitation-text-btn'+(largeTextMode?' is-active':''),
    'aria-pressed':String(largeTextMode),
    'aria-label':'청첩장 글씨 크기 크게 보기 전환',
    onclick:toggleLargeTextMode
  },largeTextMode?'가- 보통':'가+ 크게');
}
function stopInvitationCountdown(){
  if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
}
function paintLiveCountdown(info,slot){
  if(!slot||!slot.isConnected)return false;
  const cd=invitationLiveCountdown(info.date,info.time);
  if(!cd){slot.replaceChildren();return false;}
  const pad=n=>String(n).padStart(2,'0');
  if(cd.status==='future'){
    slot.replaceChildren(
      E('div',{class:'countdown-unit'},E('strong',{class:'countdown-num'},String(cd.days)),E('span',{class:'countdown-unit-label'},'DAYS')),
      E('span',{class:'countdown-sep','aria-hidden':'true'},':'),
      E('div',{class:'countdown-unit'},E('strong',{class:'countdown-num'},pad(cd.hours)),E('span',{class:'countdown-unit-label'},'HOURS')),
      E('span',{class:'countdown-sep','aria-hidden':'true'},':'),
      E('div',{class:'countdown-unit'},E('strong',{class:'countdown-num'},pad(cd.minutes)),E('span',{class:'countdown-unit-label'},'MIN')),
      E('span',{class:'countdown-sep','aria-hidden':'true'},':'),
      E('div',{class:'countdown-unit'},E('strong',{class:'countdown-num'},pad(cd.seconds)),E('span',{class:'countdown-unit-label'},'SEC')));
    return true;
  }
  const msg=cd.status==='ongoing'?'✨ 오늘 예식이 진행 중입니다. 귀한 걸음 감사드립니다.':'✨ 소중한 축복 속에 예식을 마쳤습니다. 감사합니다.';
  slot.replaceChildren(E('p',{class:'countdown-status-banner'},msg));
  return false;
}
function startInvitationCountdown(info,slot){
  stopInvitationCountdown();
  activeCountdownSlot=slot;
  if(!slot||!info?.date)return;
  const keepTicking=paintLiveCountdown(info,slot);
  if(!keepTicking||document.hidden)return;
  countdownTimer=setInterval(()=>{
    if(document.hidden||currentRoute()!=='invitation'||!slot.isConnected){stopInvitationCountdown();return;}
    if(!paintLiveCountdown(info,slot))stopInvitationCountdown();
  },1000);
}
function moduleCtx(){
  return {
    DRAFT_KEY,
    isGuestMode:()=>guestMode,
    getContent:()=>content,
    getPrefs:()=>prefs,
    getMain:()=>main,
    isDialogOpen:()=>dialog.open,
    currentRoute,
    readRawPrefs,
    savePrefs,
    queuePreference,
    setDraft,
    syncDraftFromStorage,
    beginConflictReview,
    showDialog,
    closeDialog,
    requestClose,
    setEditorState:state=>{editorState=state;},
    render,
    toast,
    storageMessage,
    pageHeader,
    empty,
    editButton,
    guestRestrictedView,
    openPhotos,
    openEditor:(type,item)=>openEditor(type,item),
    focusTrip,
    focusRecord,
    recordActions,
    copyTextToClipboard,
    copyVenueAddress,
    getStudiosState:()=>({status:studiosStatus,error:studiosError,activeLachma:activeLachmaStudio()}),
    loadStudios
  };
}
function toast(message,error=false) {
  if(dialog.open){
    if(conflictReview){
      conflictReview.message={text:message,error};
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
function describeValue(value,path=''){
  if(value===undefined)return '삭제됨';
  if(value===null)return '미입력';
  if(value&&typeof value==='object'&&!Array.isArray(value)&&/^(venueSim|sdmSim|budgetPlan|ceremonyPlan)(\.|$)/.test(path)){
    return Object.entries(value).map(([key,entry])=>`${conflictLabel(key)}: ${describeValue(entry,`${path}.${key}`)}`).join('\n');
  }
  if(typeof value==='number'&&/\.(mealPrice|hallFee|deposit|packageFee|helperFee|extraFee|planned|actual)$/.test(path))return `${value.toLocaleString('ko-KR')}원`;
  if(typeof value==='number'&&/\.(guestCount|minGuarantee)$/.test(path))return `${value.toLocaleString('ko-KR')}명`;
  if(typeof value==='boolean')return value?'적용 · 완료':'미적용 · 미완료';
  if(path==='ceremonyPlan.style')return value==='officiant'?'일반 예식 (주례사 중심)':'주례 없는 예식';
  const text=typeof value==='string'?value:JSON.stringify(value);
  return text.includes('data:image/')?'사진이 포함된 내용':text.slice(0,300)||'비어 있음';
}
function conflictDetails(error){
  return E('div',{class:'conflict-list'},error.conflicts.length?error.conflicts.map(item=>E('section',{},
    E('p',{class:'small'},conflictLabel(item.path)),E('p',{},'현재 입력: ',describeValue(item.local,item.path)),E('p',{},'다른 탭의 저장본: ',describeValue(item.remote,item.path)))):
    E('p',{},'서로 다른 항목의 변경은 함께 보존됩니다.'));
}
function conflictLabel(path){
  const labels={invitation:'예식 정보',partner1:'첫 번째 이름',partner2:'두 번째 이름',groomParents:'신랑 측 혼주',brideParents:'신부 측 혼주',venue:'예식장',date:'날짜',time:'시간',address:'주소',message:'초대 인사',mapUrl:'지도 링크',venueMapImage:'예식장 약도 이미지',transit:'교통·주차 안내',notice:'예식 안내 메모',contacts:'연락처 안내',groomAccounts:'신랑 측 계좌',brideAccounts:'신부 측 계좌',rsvpUrl:'RSVP 설문 링크',notes:'스튜디오 메모',tripNotes:'여행지 개인 메모',tipNotes:'꿀팁 영상 개인 메모',favorites:'관심 스튜디오',studioSelected:'최종 선택 스튜디오',tripFavorites:'관심 여행지',tipFavorites:'관심 꿀팁',checklist:'결혼 준비 체크리스트',shootChecklist:'촬영 준비 체크리스트',ceremonyChecks:'본식 식순 체크리스트',prenatalChecks:'산전검사 진행 체크리스트',prenatalNote:'산전검사 개인 메모',checklistNotes:'체크리스트 메모',customChecklist:'직접 추가한 할 일',customPackingList:'직접 추가한 준비물',vendorSchedules:'주요 업체 일정',ceremonyPlan:'본식 식순 플래너',guestList:'하객 명단',giftLedger:'축의금 장부',venueSim:'웨딩홀 비용 시뮬레이터',sdmSim:'스드메 비용 시뮬레이터',packingList:'신혼여행 준비물',budgetPlan:'통합 예산 계산기',tripCompare:'여행 비교',tripSelected:'최종 여행지',stories:'이야기',albums:'앨범',honeymoon:'신혼여행',tips:'결혼 정보',category:'분류',channel:'채널·출처',title:'제목',body:'내용',images:'사진',left:'비교 A',right:'비교 B',plan:'여행 상세',experiences:'경험 제안',climate:'기후 안내',climateMonth:'기후 기준 월',sourceTitle:'기후 출처',sourceUrl:'기후 출처 링크',checkedOn:'확인일',comparisonNote:'비교 요약',budgetNotes:'비용 참고 설명',researchNotes:'계획 자료 설명',references:'추가 조사 출처',lodgingNotes:'숙박 구성 메모',itinerary:'일정 흐름',transport:'계획상 이동',stays:'숙박 구성',costs:'비용 배분',quote:'실제 견적'};
  const planningLabels={planned:'목표 예산',actual:'실제 지출·계약 견적',mealPrice:'1인 식대',guestCount:'예상 하객 수',minGuarantee:'최소 보증인원',hallFee:'대관료·연출료',deposit:'기납부 계약금',packageFee:'스드메 패키지 기본가',helperFee:'당일 헬퍼비',extraFee:'기타 추가금',roadScene:'로드씬 옵션',nightShoot:'야간씬 옵션',name:'일정 이름',done:'완료 여부',note:'메모',style:'예식 진행 형태',mc:'사회자',song:'축가',speech:'축사·덕담·주례',banquetFloor:'연회홀 층수',vows:'혼인서약서 문안',declaration:'성혼선언문 문안',sdm:'스튜디오·드레스·메이크업',snap:'본식 촬영·진행',rings:'예물·예복·한복·예단',living:'혼수·가전·가구'};
  return path.split('.').filter(key=>key!=='records').map(key=>labels[key]||planningLabels[key]||studios.find(item=>item.id===key)?.name||content?.honeymoon?.find(item=>item.id===key)?.title||content?.tips?.find(item=>item.id===key)?.title||activeVendorSchedules().find(item=>item.id===key)?.name||'기록').join(' · ');
}
function storageMessage(error){
  if(error.name==='QuotaExceededError')return '저장 공간이 부족합니다. 초안을 백업하고 사진 수나 용량을 줄여 주세요.';
  if(error.name==='SecurityError')return '브라우저의 저장 허용 설정을 확인해 주세요.';
  return error.message;
}
function beginConflictReview({key,base,next,saveLocal,keepSaved,lockEditor=false}){
  conflictReview?.release?.();
  const release=()=>{editor.inert=false;$('#dialog-actions').inert=false;};
  if(lockEditor){editor.inert=true;$('#dialog-actions').inert=true;}
  const review={key,refresh:null,release,busy:false};
  const decide=async action=>{
    if(review.busy)return;
    review.busy=true;review.message=null;refresh();
    try{await action();}catch(error){toast(storageMessage(error),true);}
    finally{review.busy=false;if(conflictReview===review)refresh();}
  };
  const refresh=()=>{
    try{
      const raw=localStorage.getItem(key);
      const remote=key===DRAFT_KEY?(raw?parseContent(raw):baseContent):validatePreferences(JSON.parse(raw||'{}'));
      const result=mergeChanges(base,next,remote),error=new StorageConflict(result.conflicts,raw);
      const notice=$('#dialog-notice');
      const focusedAction=notice.contains(document.activeElement)&&document.activeElement.tagName==='BUTTON'?document.activeElement.textContent:null;
      notice.hidden=false;notice.className='dialog-notice error';notice.setAttribute('role','alert');
      notice.replaceChildren(E('p',{},result.conflicts.length?error.message:'최신 저장본을 확인했습니다. 현재 입력과 겹치지 않는 변경은 함께 저장합니다.'),conflictDetails(error),
        E('div',{class:'manager-actions'},button(key===DRAFT_KEY?'다른 탭의 저장본 불러오기':'다른 탭의 저장본 유지',()=>decide(keepSaved),'button quiet'),
          button('현재 입력으로 충돌 항목 저장',()=>decide(()=>saveLocal(raw))),
          lockEditor?button('입력 계속 수정',()=>{
            release();conflictReview=null;notice.hidden=true;
            editor.querySelector('input,textarea,select')?.focus();
          },'button quiet'):null),E('p',{id:'conflict-status',class:'small',role:'status'},review.busy?'선택한 내용을 처리하고 있습니다.':lockEditor?'저장할 내용을 선택하거나 입력을 계속 수정해 주세요. 다른 탭의 새 변경도 다시 확인합니다.':'다른 탭이 다시 저장해도 비교 내용과 선택 버튼은 유지됩니다.'));
      for(const action of notice.querySelectorAll('button'))action.disabled=review.busy;
      if(review.message){const status=$('#conflict-status');status.textContent=review.message.text;status.setAttribute('role',review.message.error?'alert':'status');}
      if(focusedAction)[...notice.querySelectorAll('button')].find(node=>node.textContent===focusedAction)?.focus({preventScroll:true});
    }catch(error){toast('최신 저장본을 확인하지 못했습니다. '+storageMessage(error),true);}
  };
  review.refresh=refresh;conflictReview=review;refresh();
  $('#dialog-notice').focus();
}
const readRawPrefs=()=>{try{return validatePreferences(JSON.parse(readStorage(PREF_KEY)||'{}'));}catch{return structuredClone(prefs);}};
const syncMemoryPrefs=(source=guestMode?validatePreferences({}):readRawPrefs())=>{
  prefs=content?pruneContentPreferences(source,content):source;
  return prefs;
};
function savePrefs(next,base=structuredClone(prefs),approvedRaw){return trackWrite(persistPrefs(next,base,approvedRaw));}
async function persistPrefs(next,base,approvedRaw) {
  pendingWrites++;
  try {
    const result=await lockedMerge({locks:navigator.locks,storage:localStorage,key:PREF_KEY,base,next,fallback:validatePreferences({}),parse:raw=>validatePreferences(JSON.parse(raw)),validate:validatePreferences,approvedRaw});
    if(!guestMode)syncMemoryPrefs(result.value);return true;
  }catch(error){
    if(error instanceof StorageConflict){
      if(dialog.open||showDialog('다른 탭의 변경 확인',E('p',{},'개인 메모와 선택의 변경 내용을 확인해 주세요.'))){
        beginConflictReview({key:PREF_KEY,base,next,lockEditor:true,
          keepSaved:()=>{try{syncMemoryPrefs(validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}')));closeDialog();render();}catch(cause){toast(cause.message,true);}},
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
    draftRevision=JSON.parse(result.raw).baseRevision;if(!guestMode)content=result.value;isDraft=true;
  }catch(error){
    if(error instanceof StorageConflict)throw error;
    throw new Error('초안을 저장하지 못했습니다. 입력 내용은 유지됩니다. '+storageMessage(error));
  }finally{pendingWrites--;}
}
function dirtyEditor(){return editorState?.isDirty()||false;}
function canLeaveEditor(){
  if(editorState?.isSaving()||conflictReview?.busy){toast('저장 중입니다. 완료될 때까지 잠시 기다려 주세요.');return false;}
  return !dirtyEditor()||confirm('저장하지 않은 입력이 있습니다. 입력을 버리고 닫을까요?');
}
function unloadDialogMedia(){for(const frame of editor.querySelectorAll('iframe'))frame.src='about:blank';}
function closeDialog(){clearInterval(slideshowTimer);slideshowTimer=null;conflictReview?.release?.();editorState=null;conflictReview=null;photoNavigation=null;unloadDialogMedia();editor.replaceChildren();const actionSlot=$('#dialog-actions');actionSlot.replaceChildren();actionSlot.hidden=true;dialog.close();}
function requestClose(){if(canLeaveEditor())closeDialog();}
function currentRoute() {const route=location.hash.replace(/^#\/?/,'').split('/')[0];return routes.includes(route)?route:(guestMode?'invitation':'home');}
function pageHeader(title, description, action, eyebrow) {
  return E('div',{class:'page-header'},E('div',{},E('p',{class:'eyebrow'},eyebrow||'OUR WEDDING JOURNAL'),E('h1',{},title),E('p',{},description)),action);
}
function empty(title, description, label, action, allowGuestAction=false) {
  return E('div',{class:'empty-state'},E('span',{class:'empty-mark','aria-hidden':'true'},'w.'),E('h2',{},title),E('p',{},description),label&&(!guestMode||allowGuestAction)?button(label,action):null);
}
const WEDDING_CHECKLIST=[
  ['D-180 이전','웨딩홀 · 스드메 · 신혼여행 큰 틀 잡기',[
    ['d180-hall','예식장(순천아모르웨딩컨벤션) 홀·식대·보증인원 조건 정리'],
    ['d180-sdm','스튜디오 최종 선택 (라크마 · 2027-02-03 수 12:00 촬영 확정) 및 드레스·메이크업 샵 결정'],
    ['d180-trip','신혼여행지 최종 선택 및 항공·숙박 일정 확보'],
    ['d180-budget','두 사람의 전체 결혼 예산 배분표 작성']
  ]],
  ['D-120 ~ D-90','웨딩 촬영 · 예복 · 예물 · 본식스냅',[
    ['d120-shoot','라크마 스튜디오 웨딩촬영 (2027-02-03 수 12:00 · 루나메이크업→중앙로 117 이동) 헬퍼비 현금 25만 원·시안·누브라·긴 양말·간식 준비'],
    ['d120-rings','웨딩밴드(예물)·예복·한복 맞춤 및 대여 결정'],
    ['d120-snap','본식 스냅·DVD·아이폰 스냅 업체 예약'],
    ['d120-passport','여권 만료일(6개월 이상) 확인 및 항공권 영문명 점검']
  ]],
  ['D-60 ~ D-30','청첩장 · 하객 명단 · 본식 식순',[
    ['d60-card','종이·모바일 청첩장 문구 확정 및 모임 일정 잡기'],
    ['d60-mc','순천아모르 주례 없는 식순(12단계) · 사회자 대본 · 혼인서약서 · 성혼선언문 · 축가 확정'],
    ['d60-bouquet','본식 드레스 셀렉 및 부케·부토니에·코사지 지정'],
    ['d60-living','신혼집 가전·가구 배치 및 입주·이사 일정 조율']
  ]],
  ['D-14 ~ D-Day','최종 리허설 · 본식 당일 체크',[
    ['d14-meal','하객 최종 예상 인원 및 식권·답례품 수량 확정'],
    ['d14-bag','혼주 간식·비상약·헬퍼 및 업체 잔금 봉투 준비'],
    ['d14-pack','신혼여행 짐 싸기·환전·로밍·바우처 출력'],
    ['d14-ring','본식 반지 · 혼인서약서/성혼선언문 인쇄본 · 연회홀 층수 · 식전영상/BGM 최종 확인']
  ]]
];
function allChecklistStages(){
  const customs=prefs.customChecklist||[];
  return WEDDING_CHECKLIST.map(([stage,subtitle,items])=>[
    stage,
    subtitle,
    [...items.map(([id,label])=>({id,label,custom:false})),...customs.filter(c=>c.stage===stage).map(c=>({id:c.id,label:c.title,custom:true}))]
  ]);
}
function openCustomChecklistEditor(existing=null){
  if(guestMode)return;
  const isEdit=Boolean(existing&&existing.id);
  const form=E('form',{class:'editor-form'});
  form.append(E('p',{class:'form-note'},'추가·수정한 할 일은 이 기기의 개인 설정에만 저장되며 방문자용 청첩장에는 노출되지 않습니다.'));
  const stageSelect=E('select',{id:'custom-chk-stage'},CHECKLIST_STAGES.map(s=>E('option',{value:s},s)));
  if(isEdit&&CHECKLIST_STAGES.includes(existing.stage))stageSelect.value=existing.stage;
  const titleInput=E('input',{type:'text',id:'custom-chk-title',maxlength:'160',required:true,placeholder:'예: 양가 혼주 메이크업 예약 확인'});
  if(isEdit)titleInput.value=existing.title||'';
  const noteInput=E('input',{type:'text',id:'custom-chk-note',maxlength:'300',placeholder:'예: 12월 초 예약금 입금 예정 (선택)'});
  if(isEdit)noteInput.value=prefs.checklistNotes?.[existing.id]||'';
  form.append(
    E('label',{class:'field',for:stageSelect.id},'준비 시기 단계',stageSelect),
    E('label',{class:'field',for:titleInput.id},'할 일 내용',titleInput),
    E('label',{class:'field',for:noteInput.id},'진행 메모 (선택)',noteInput));
  const submit=E('button',{class:'button',type:'submit'},isEdit?'할 일 저장':'할 일 추가');
  form.append(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const title=titleInput.value.trim(),note=noteInput.value.trim(),stage=stageSelect.value;
      if(!title)throw new Error('할 일 내용을 입력해 주세요.');
      const curList=[...(prefs.customChecklist||[])];
      if(!isEdit&&curList.length>=50)throw new Error('직접 추가한 할 일은 50개까지 보관할 수 있습니다.');
      const id=isEdit?existing.id:'custom-'+crypto.randomUUID().slice(0,8);
      const nextCustom=isEdit?curList.map(c=>c.id===id?{id,stage,title}:c):[...curList,{id,stage,title}];
      const nextNotes={...(prefs.checklistNotes||{})};
      if(note)nextNotes[id]=note;else delete nextNotes[id];
      const saved=await queuePreference(()=>savePrefs({...prefs,customChecklist:nextCustom,checklistNotes:nextNotes}));
      if(saved){closeDialog();render();toast(isEdit?'우리만의 할 일을 수정했습니다.':'우리만의 할 일을 체크리스트에 추가했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  const initial=JSON.stringify([stageSelect.value,titleInput.value,noteInput.value]);
  if(showDialog(isEdit?'우리만의 할 일 수정':'우리만의 할 일 추가',form))editorState={isDirty:()=>saving||JSON.stringify([stageSelect.value,titleInput.value,noteInput.value])!==initial,isSaving:()=>saving};
}
function openChecklistNoteModal(id,label){
  if(guestMode)return;
  const form=E('form',{class:'editor-form'});
  const currentNote=prefs.checklistNotes?.[id]||'';
  const input=E('input',{type:'text',id:'chk-note-input',maxlength:'300',placeholder:'예: 계약금 50만 원 완료 / 11월 20일 방문 예정'});
  input.value=currentNote;
  form.append(E('p',{class:'form-note'},`‘${label}’ 항목에 대한 진행 상황이나 일정 메모를 이 기기에 남깁니다.`),E('label',{class:'field',for:input.id},'항목 메모',input));
  const submit=E('button',{class:'button',type:'submit'},'메모 저장');
  form.append(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextNotes={...(prefs.checklistNotes||{})};
      if(input.value.trim())nextNotes[id]=input.value.trim();else delete nextNotes[id];
      const saved=await queuePreference(()=>savePrefs({...prefs,checklistNotes:nextNotes}));
      if(saved){closeDialog();render();toast('체크리스트 메모를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  if(showDialog('체크리스트 메모 편집',form))editorState={isDirty:()=>saving||input.value!==currentNote,isSaving:()=>saving};
}
async function copyPreparationSummary(){
  const info=content.invitation||{};
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ')||'우리 커플';
  const dday=weddingDday(info.date);
  const selectedStudio=activeLachmaStudio();
  const selectedTrip=content.honeymoon.find(t=>t.id===prefs.tripSelected);
  const bPlan=prefs.budgetPlan||{};
  const budget=weddingBudgetSummary(bPlan,WEDDING_BUDGET_CATEGORIES.map(([key])=>key));
  const bHas=Object.keys(bPlan).length>0;
  const gSummary=guestListSummary(prefs.guestList||[]);
  const giftSummary=giftLedgerSummary(prefs.giftLedger||[]);
  const stages=allChecklistStages();
  const allItems=stages.flatMap(g=>g[2]);
  const checkedSet=new Set(prefs.checklist||[]);
  const doneCount=allItems.filter(it=>checkedSet.has(it.id)).length;
  const nextItem=allItems.find(it=>!checkedSet.has(it.id));
  const vList=activeVendorSchedules(prefs).filter(v=>!v.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const nextVendor=vList[0];
  const shootInfo=selectedStudio?.deepGuide?.schedule?` (${selectedStudio.deepGuide.schedule.label} 촬영 확정 · ${weddingDday(selectedStudio.deepGuide.schedule.date)})`:'';
  const lines=[
    `💍 [${names} 결혼 준비 현황 요약]`,
    `• 예식 일정: ${info.date?formatDate(info.date):'미정'}${info.time?` ${info.time}`:''}${dday?` (${dday})`:''}`,
    `• 예식 장소: ${info.venue||'미정'}`,
    `• 스튜디오: ${selectedStudio?`${selectedStudio.name}${shootInfo}`:`라크마 (2027-02-03 수요일 12:00 촬영 확정 · ${weddingDday('2027-02-03')})`}`,
    `• 신혼여행: ${selectedTrip?`${selectedTrip.title} (2인 계획예산 ${won(selectedTrip.budget)})`:`후보 검토 중 (관심 ${(prefs.tripFavorites||[]).length}곳)`}`,
    `• 통합 예산: ${bHas?`목표 ${budget.planned.known===null?'미입력':won(budget.planned.known)} / 실제·견적 ${budget.actual.known===null?'미입력':won(budget.actual.known)}`:'미입력'}`,
    ...(gSummary.totalRecords?[`• 하객 명단: ${gSummary.totalRecords}건 · 참석 확정 ${gSummary.attendingHeadcount}명 (불참 제외 예상 ${gSummary.possibleHeadcount}명 · 발송 ${gSummary.sentCount}/${gSummary.totalRecords})`]:[]),
    ...(giftSummary.totalRecords?[`• 축의금 장부: ${giftSummary.totalRecords}건 · 총 ${won(giftSummary.totalAmount)} · 식권 ${giftSummary.totalMealTickets}매`]:[]),
    `• 다가오는 업체 일정: ${nextVendor?`${nextVendor.category} ${nextVendor.name}${nextVendor.date?` (${nextVendor.date} · ${weddingDday(nextVendor.date)})`:''}`:'등록된 미완료 일정 없음'}`,
    `• 체크리스트: 전체 ${allItems.length}개 중 ${doneCount}개 완료 (${Math.round((doneCount/allItems.length)*100)}%)`,
    `• 다음 할 일: ${nextItem?nextItem.label:'모든 할 일 완료 🎉'}`
  ];
  const summaryText=lines.join('\n');
  try{
    await navigator.clipboard.writeText(summaryText);
    toast('결혼 준비 현황 요약을 복사했습니다. 카카오톡 등에 붙여넣어 공유해 보세요.');
  }catch{
    const ta=E('textarea',{rows:'10',readonly:true,'aria-label':'결혼 준비 현황 요약 텍스트'},summaryText);
    showDialog('결혼 준비 현황 요약 복사',E('div',{},E('p',{},'아래 요약 내용을 선택해 복사해 주세요.'),ta));ta.focus();ta.select();
  }
}
function renderHomeDashboard(){
  if(guestMode)return null;
  const selectedStudio=activeLachmaStudio();
  const hasLachmaMemo=Boolean(prefs.notes?.[DEFAULT_STUDIO_ID]?.trim());
  const donePrepCount=(prefs.shootChecklist||[]).length;
  const totalPrepCount=(selectedStudio?.deepGuide?.prepChecklist||[]).reduce((sum,grp)=>sum+(grp.items?.length||0),0);
  const selectedTrip=content.honeymoon.find(t=>t.id===prefs.tripSelected);
  const tripFavCount=(prefs.tripFavorites||[]).length;
  const bPlan=prefs.budgetPlan||{};
  const budget=weddingBudgetSummary(bPlan,WEDDING_BUDGET_CATEGORIES.map(([key])=>key));
  const bHas=Object.keys(bPlan).length>0;
  const gSummary=guestListSummary(prefs.guestList||[]);
  const giftSummary=giftLedgerSummary(prefs.giftLedger||[]);
  const stages=allChecklistStages();
  const allItems=stages.flatMap(g=>g[2]);
  const checkedSet=new Set(prefs.checklist||[]);
  const doneCount=allItems.filter(it=>checkedSet.has(it.id)).length;
  const nextItem=allItems.find(it=>!checkedSet.has(it.id));
  const vList=activeVendorSchedules(prefs).filter(v=>!v.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const nextVendor=vList[0];
  const shootSched=selectedStudio?.deepGuide?.schedule;
  return E('section',{class:'home-dashboard','aria-labelledby':'home-dashboard-title'},
    E('div',{class:'section-heading'},
      E('div',{},
        E('p',{class:'eyebrow'},'OUR SELECTION & BUDGET BOARD'),
        E('h2',{id:'home-dashboard-title'},'우리의 선택 & 예산 한눈에 보기'),
        E('p',{},'스튜디오·신혼여행·통합 예산·하객·체크리스트 현황을 이 기기에서 바로 확인하세요.')),
      E('div',{class:'page-actions'},
        button('📋 준비 현황 요약 복사',copyPreparationSummary,'button quiet'),
        button('🖨️ 요약 인쇄 / PDF',()=>window.print(),'button quiet'))),
    E('div',{class:'dashboard-grid'},
      E('article',{class:'dashboard-card'},
        E('span',{class:'small muted'},'📸 웨딩 스튜디오'),
        E('strong',{},selectedStudio?`⭐ ${selectedStudio.name}${shootSched?' (2/3 수 12:00 촬영)':''}`:'⭐ 라크마 (2/3 수 12:00 촬영)'),
        E('p',{class:'small muted'},shootSched?`🗓️ ${shootSched.date} (${shootSched.weekday}) ${shootSched.time} (${weddingDday(shootSched.date)})${totalPrepCount?` · 준비물 ${donePrepCount}/${totalPrepCount}`:''}${hasLachmaMemo?' · 메모 있음':''}`:'광주 남구 중앙로 117 · 공식 촬영 가이드'),
        linkButton('라크마 촬영 안내 보기 →','#/studios',true)),
      E('article',{class:'dashboard-card'},
        E('span',{class:'small muted'},'✈️ 신혼여행 픽'),
        E('strong',{},selectedTrip?selectedTrip.title:'최종 후보 선택 전'),
        E('p',{class:'small muted'},selectedTrip?`2인 계획예산 ${won(selectedTrip.budget)} · 관심 ${tripFavCount}곳`:`후보 ${content.honeymoon.length}곳 · 관심 ${tripFavCount}곳`),
        linkButton('신혼여행 후보 이동 →','#/honeymoon',true)),
      E('article',{class:'dashboard-card'},
        E('span',{class:'small muted'},'💰 통합 예산 & 축의금'),
        E('strong',{},bHas?`목표 ${budget.planned.complete?'합계':'입력 소계'} ${budget.planned.known===null?'미입력':won(budget.planned.known)}`:'6대 예산 미입력'),
        E('p',{class:'small muted'},bHas?`실제·견적 ${budget.actual.complete?'합계':'입력 소계'} ${budget.actual.known===null?'미입력':won(budget.actual.known)} (${budget.difference===null?'차액 미확인':budget.difference>=0?`여유 ${won(budget.difference)}`:`초과 ${won(-budget.difference)}`})`:'웨딩홀·스드메·신혼여행 통합 관리'),
        giftSummary.totalRecords?E('p',{class:'small muted'},`💌 축의금 장부: ${giftSummary.totalRecords}건 · ${won(giftSummary.totalAmount)} · 식권 ${giftSummary.totalMealTickets}매`):(bHas?E('p',{class:'small muted'},`미입력: 목표 ${budget.planned.missing}개 · 실제·견적 ${budget.actual.missing}개`):null),
        button('예산 계산기 이동 →',()=>{setTipsSubTab('budget');location.hash='#/tips';},'button quiet')),
      E('article',{class:'dashboard-card'},
        E('span',{class:'small muted'},'✅ 다음 할 일 & 하객 현황'),
        E('strong',{},nextItem?nextItem.label:'모든 할 일 완료 🎉'),
        nextVendor?E('p',{class:'small'},`📅 다가오는 일정: ${nextVendor.name}${nextVendor.date?` (${nextVendor.date} · ${weddingDday(nextVendor.date)})`:''}`):null,
        gSummary.totalRecords?E('p',{class:'small muted'},`👥 하객 ${gSummary.totalRecords}건 · 참석 ${gSummary.attendingHeadcount}명 (예상 ${gSummary.possibleHeadcount}명 · 발송 ${gSummary.sentCount}/${gSummary.totalRecords})`):E('p',{class:'small muted'},`체크리스트 전체 ${allItems.length}개 중 ${doneCount}개 완료 (${Math.round((doneCount/allItems.length)*100)}%)`),
        gSummary.totalRecords?button('하객 명단 이동 →',()=>{setCeremonySubTab('guests');location.hash='#/ceremony';},'button quiet'):button('체크리스트 보기 ↓',()=>$('#home-checklist-title')?.scrollIntoView({behavior:'smooth',block:'start'}),'button quiet'))));
}
function activeFocusStageName(stages,checkedSet){
  const invDate=content?.invitation?.date;
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  const days=invDate?dateSpan(today,invDate):null;
  let preferred='D-180 이전';
  if(days!==null){
    if(days<=21)preferred='D-14 ~ D-Day';
    else if(days<=75)preferred='D-60 ~ D-30';
    else if(days<=150)preferred='D-120 ~ D-90';
  }
  const prefStage=stages.find(([s,,items])=>s===preferred&&items.some(it=>!checkedSet.has(it.id)));
  if(prefStage)return prefStage[0];
  const firstIncomplete=stages.find(([,,items])=>items.some(it=>!checkedSet.has(it.id)));
  return firstIncomplete?firstIncomplete[0]:preferred;
}
function renderHomeChecklist(){
  if(guestMode)return null;
  const stages=allChecklistStages();
  const allItems=stages.flatMap(g=>g[2]);
  const checkedSet=new Set(prefs.checklist||[]);
  const doneCount=allItems.filter(it=>checkedSet.has(it.id)).length;
  const pct=Math.round((doneCount/allItems.length)*100);
  const focusStage=activeFocusStageName(stages,checkedSet);
  const toggleItem=id=>queuePreference(async()=>{
    const nextSet=new Set(prefs.checklist||[]);
    nextSet.has(id)?nextSet.delete(id):nextSet.add(id);
    const saved=await savePrefs({...prefs,checklist:[...nextSet]});
    if(saved&&currentRoute()==='home')render();
    return saved;
  });
  const deleteCustom=(id,label)=>{
    if(!confirm(`‘${label}’ 할 일을 삭제할까요?`))return;
    queuePreference(async()=>{
      const nextCustom=(prefs.customChecklist||[]).filter(c=>c.id!==id);
      const nextSet=(prefs.checklist||[]).filter(cid=>cid!==id);
      const nextNotes={...(prefs.checklistNotes||{})};delete nextNotes[id];
      const saved=await savePrefs({...prefs,customChecklist:nextCustom,checklist:nextSet,checklistNotes:nextNotes});
      if(saved&&currentRoute()==='home'){render();toast('직접 추가한 할 일을 삭제했습니다.');}
      return saved;
    });
  };
  const filterCheck=E('input',{type:'checkbox',id:'chk-incomplete-only'});
  filterCheck.checked=checklistIncompleteOnly;
  filterCheck.addEventListener('change',()=>{checklistIncompleteOnly=filterCheck.checked;render();$('#chk-incomplete-only')?.focus({preventScroll:true});});
  return E('section',{class:'home-checklist','aria-labelledby':'home-checklist-title'},
    E('div',{class:'section-heading'},
      E('div',{},
        E('p',{class:'eyebrow'},'WEDDING ROADMAP · PRIVATE'),
        E('h2',{id:'home-checklist-title'},'D-Day 연동 결혼 준비 시기별 체크리스트'),
        E('p',{},'체크한 내역과 직접 추가한 할 일·메모는 이 기기의 개인 설정에만 저장됩니다.')),
      E('div',{class:'checklist-head-actions'},
        E('div',{class:'checklist-summary-pill'},
          E('strong',{},`진행률 ${pct}%`),
          E('span',{class:'small muted'},` (${doneCount}/${allItems.length} 완료)`)),
        button('+ 우리만의 할 일 추가',()=>openCustomChecklistEditor(),'button quiet'))),
    E('div',{class:'checklist-progress-track','aria-hidden':'true'},
      E('span',{class:'checklist-progress-fill',style:`width:${pct}%`})),
    E('div',{class:'checklist-controls'},
      E('label',{class:'check-label',for:filterCheck.id},filterCheck,'남은 할 일만 보기')),
    E('div',{class:'checklist-grid'},stages.map(([stage,subtitle,items])=>{
      const visible=checklistIncompleteOnly?items.filter(it=>!checkedSet.has(it.id)):items;
      const isFocus=stage===focusStage;
      return E('article',{class:'checklist-stage-card'+(isFocus?' is-focus-stage':'')},
        E('div',{class:'stage-head'},
          E('span',{class:'badge'},stage),
          isFocus?E('span',{class:'spec-chip highlight focus-stage-badge'},'📍 지금 집중할 시기'):null,
          E('h3',{},subtitle)),
        visible.length?E('ul',{class:'checklist-items'},visible.map(({id,label,custom})=>{
          const input=E('input',{type:'checkbox',id:`chk-${id}`});
          input.checked=checkedSet.has(id);
          input.addEventListener('change',()=>toggleItem(id));
          const note=prefs.checklistNotes?.[id]||'';
          return E('li',{class:input.checked?'done':''},
            E('div',{class:'checklist-row-main'},
              E('label',{for:input.id,class:'checklist-label'},input,E('span',{},label)),
              E('div',{class:'checklist-item-actions'},
                button(note?'메모 수정':'메모',()=>openChecklistNoteModal(id,label),'text-button small checklist-note-btn'),
                custom?button('수정',()=>openCustomChecklistEditor({id,stage,title:label}),'text-button small checklist-note-btn'):null,
                custom?button('삭제',()=>deleteCustom(id,label),'text-button small'):null)),
            note?E('p',{class:'checklist-item-note small'},`📝 ${note}`):null);
        })):E('p',{class:'small muted'},'이 단계의 남은 할 일이 없습니다. 🎉'));
    })));
}
function renderJourneyRibbon(info,dday){
  if(guestMode)return null;
  const selectedStudio=activeLachmaStudio();
  const shootSched=selectedStudio?.deepGuide?.schedule;
  const selectedTrip=content.honeymoon.find(t=>t.id===prefs.tripSelected);
  const trips=content.honeymoon||[];
  const firstTrip=trips[0];
  const uniformTripDates=trips.length>0&&firstTrip?.startDate&&firstTrip?.endDate&&trips.every(t=>t.startDate===firstTrip.startDate&&t.endDate===firstTrip.endDate);
  const allDirect=trips.length>0&&trips.every(t=>tripFlightBadge(t).direct);
  const step1Date=shootSched?.date?shootSched.date.replaceAll('-','.'):'2027.02.03';
  const step1Title=selectedStudio?`${selectedStudio.name} 웨딩촬영`:'라크마 웨딩촬영';
  const step1Sub=shootSched?`${shootSched.weekday||''} ${shootSched.time||''}${shootSched.date?` · ${weddingDday(shootSched.date)}`:''}`.trim():`수요일 12:00 · ${weddingDday('2027-02-03')}`;
  const step2Date=info.date?info.date.replaceAll('-','.'):'예식 일정';
  const step2Title=info.date?'본식 예식일':'예식 정보 준비 중';
  const step2Sub=[info.venue,info.time,dday].filter(Boolean).join(' · ')||'예식 날짜와 장소를 입력해 주세요';
  const step3Date=selectedTrip?.startDate?`${selectedTrip.startDate.replaceAll('-','.')}${selectedTrip.endDate?`~${selectedTrip.endDate.slice(5).replaceAll('-','.')}`:''}`:(uniformTripDates?`${firstTrip.startDate.replaceAll('-','.')}~${firstTrip.endDate.slice(5).replaceAll('-','.')}`:'허니문 준비');
  const step3Title=selectedTrip?selectedTrip.title:(trips.length?(allDirect?`인천 직항 허니문 ${trips.length}곳`:`신혼여행 후보 ${trips.length}곳`):'첫 여행 후보 남기기');
  const step3Sub=selectedTrip?`2인 계획예산 ${won(selectedTrip.budget)} · 최종 선택`:(trips.length?(allDirect?'전 노선 인천 직항 · 휴양 후보 비교 중':'일정·예산·기후 나란히 비교하기'):'가고 싶은 여행지부터 모아 보기');
  return E('section',{class:'journey-ribbon','aria-label':'우리의 3단계 웨딩 여정 타임라인'},
    E('p',{class:'journey-ribbon-head'},'✨ 우리의 3단계 웨딩 여정 타임라인'),
    E('div',{class:'journey-ribbon-grid'},
      E('a',{class:'journey-step is-studio',href:'#/studios'},
        E('span',{class:'journey-step-tag'},`STEP 1 · ${step1Date}`),
        E('strong',{class:'journey-step-title'},step1Title),
        E('span',{class:'journey-step-sub'},step1Sub)),
      E('a',{class:'journey-step is-ceremony',href:'#/invitation'},
        E('span',{class:'journey-step-tag'},`STEP 2 · ${step2Date}`),
        E('strong',{class:'journey-step-title'},step2Title),
        E('span',{class:'journey-step-sub'},step2Sub)),
      E('a',{class:'journey-step is-honeymoon',href:'#/honeymoon'},
        E('span',{class:'journey-step-tag'},`STEP 3 · ${step3Date}`),
        E('strong',{class:'journey-step-title'},step3Title),
        E('span',{class:'journey-step-sub'},step3Sub))));
}
function isGuestVisibleRoute(route){
  if(route==='home'||route==='invitation')return true;
  if(route==='story')return Boolean(content?.stories?.length);
  if(route==='albums')return Boolean(content?.albums?.length);
  return false;
}
function guestRestrictedView(title,subtitle,eyebrow){
  return [
    pageHeader(title,subtitle,null,eyebrow),
    empty('신랑·신부 전용 결혼 준비 탭입니다.','예식 일시와 오시는 길 안내는 모바일 청첩장에서 확인하실 수 있습니다.','모바일 청첩장 보기',()=>{location.hash='#/invitation';},true)
  ];
}
function renderHome() {
  const info=content.invitation;
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ');
  const p1Clean=info.partner1?info.partner1.replace(/^신랑\s*/,''):'';
  const p2Clean=info.partner2?info.partner2.replace(/^신부\s*/,''):'';
  const roleNames=[formatPartner(info.partner1,'신랑'),formatPartner(info.partner2,'신부')].filter(Boolean).join(' · ');
  const dday=weddingDday(info.date);
  const datePillText=info.date?`${formatDate(info.date)}${info.time?` · ${info.time}`:''}`:(roleNames||'OUR WEDDING DIARY');
  const venueBase=info.venue?info.venue.replace(/\s+\d+층$/,'').trim():'';
  const venueFloor=info.venue?.match(/(\d+층)$/)?.[1]?`${info.venue.match(/(\d+층)$/)[1]} 예식홀`:'';
  const archMeta=[venueFloor,dday].filter(Boolean).join(' · ')||[dday,venueBase].filter(Boolean).join(' · ')||(info.date?formatDate(info.date):'함께 써 내려가는 기록');
  const archDate=info.date?`${info.date.replaceAll('-','. ')}${info.time?` · ${info.time}`:''}`:'예식 일정 준비 중';
  const heroActions=guestMode?[
    linkButton('모바일 청첩장 보기','#/invitation'),
    content.stories.length?linkButton('우리의 일대기 보기','#/story',true):null,
    content.albums.length?linkButton('포토 앨범 보기','#/albums',true):null,
    !content.stories.length&&!content.albums.length&&info.mapUrl?externalLink('오시는 길 지도 ↗',info.mapUrl,'button quiet'):null
  ]:[
    linkButton(info.date?'모바일 청첩장 보기':'예식 정보 채우기','#/invitation'),
    linkButton('라크마 촬영 가이드','#/studios',true),
    linkButton('본식 식순 보기','#/ceremony',true)
  ];
  const hero=E('section',{class:'hero'},
    E('div',{class:'hero-copy'},
      E('div',{class:'hero-badges'},
        E('span',{class:'hero-date-pill'},datePillText),
        info.date&&roleNames?E('span',{class:'hero-role-caption'},roleNames):null),
      E('h1',{},names?(guestMode?`${names}, 소중한 분들을 초대합니다`:`${names}, 우리의 결혼을 준비하는 기록`):'함께 준비하는 우리의 결혼 기록'),
      E('p',{},guestMode?'두 사람의 예식 일시와 오시는 길, 함께 쌓아 온 소중한 이야기를 전합니다.':'꼭 필요한 예식 일정과 라크마 촬영 안내, 신혼여행 비교 정보를 한눈에 정리했습니다.'),
      E('div',{class:'hero-actions'},...heroActions)),
    E('div',{class:'hero-art','aria-hidden':'true'},
      E('div',{class:'art-arch promise-arch'},
        S('svg',{class:'arch-botanical-sprig',viewBox:'0 0 96 26','aria-hidden':'true'},
          S('path',{d:'M 14 17 C 30 12, 66 12, 82 17',fill:'none',stroke:'#8ba792','stroke-width':'1.15','stroke-linecap':'round'}),
          renderBotanicalLeaf(28,15,-64,0.52,'#7ea087'),
          renderBotanicalLeaf(38,14,-44,0.44,'#9cb4a2'),
          renderBotanicalLeaf(68,15,64,0.52,'#7ea087'),
          renderBotanicalLeaf(58,14,44,0.44,'#9cb4a2'),
          S('circle',{cx:'48',cy:'12.5',r:'3',fill:'#c97a70'}),
          S('circle',{cx:'48',cy:'12.5',r:'5.5',fill:'#f3d8d3',opacity:'0.55'})),
        E('span',{class:'arch-eyebrow'},'WEDDING VENUE'),
        venueBase?E('strong',{class:'arch-couple'},venueBase):(p1Clean&&p2Clean?E('strong',{class:'arch-couple'},p1Clean,E('em',{class:'arch-heart'},'♥'),p2Clean):E('strong',{class:'arch-couple'},names||'Our Story')),
        E('span',{class:'arch-divider'}),
        E('span',{class:'arch-meta'},archMeta),
        E('span',{class:'arch-date-chip'},archDate))));
  const overview=guestMode
    ?E('div',{class:'overview'},
      E('div',{},E('span',{class:'small muted'},'WEDDING DATE'),E('strong',{},info.date?`${formatDate(info.date).replace(/ \S+요일$/,'')}${dday?` · ${dday}`:''}`:'예식 일정 준비 중')),
      E('div',{},E('span',{class:'small muted'},'WEDDING TIME'),E('strong',{},info.time?`${(formatDate(info.date).match(/(\S+요일)$/)?.[1]||'')}${info.date?' · ':''}${info.time}`.trim():'예식 시간 준비 중')),
      E('div',{},E('span',{class:'small muted'},'WEDDING VENUE'),E('strong',{},info.venue||'예식 장소 준비 중')))
    :null;
  const ceremonyDone=(prefs.ceremonyChecks||[]).filter(id=>CEREMONY_PREP_ITEMS.some(([cid])=>cid===id)).length;
  const prenatalDone=(prefs.prenatalChecks||[]).filter(id=>PRENATAL_CHECK_ITEMS.some(([pid])=>pid===id)).length;
  const gCount=(prefs.guestList||[]).length;
  const statuses={invitation:info.date?'예식 일시·장소 안내':'첫 인사를 준비해요',story:`${content.stories.length}개의 이야기`,albums:`${content.albums.length}개의 앨범`,studios:'2/3(수) 12:00 촬영 안내',honeymoon:`${content.honeymoon.length}개의 여행 후보`,ceremony:gCount?`체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 하객 ${gCount}건`:`준비 체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 12단계 식순`,prenatal:`순천현대병원 · 준비 체크 ${prenatalDone}/${PRENATAL_CHECK_ITEMS.length}`,tips:`${content.tips.length}개의 꿀팁 영상`};
  const visibleMenus=guestMode?menus.filter(([route])=>isGuestVisibleRoute(route)):menus;
  return [hero,renderJourneyRibbon(info,dday),overview,renderHomeDashboard(),E('section',{},E('div',{class:'section-heading'},E('div',{},E('h2',{},guestMode?'예식 안내 바로가기':'함께 채워 갈 이야기'),E('p',{},guestMode?'모바일 청첩장과 오시는 길 안내를 확인하실 수 있습니다.':'필요한 순간에 하나씩, 우리의 속도로.'))),
    E('div',{class:'menu-grid'},visibleMenus.map(([route,title,description],index)=>E('a',{class:'menu-card',href:`#/${route}`},E('span',{class:'number'},String(index+1).padStart(2,'0')),E('h3',{},title),E('p',{},description),E('div',{class:'card-tail'},E('span',{},statuses[route]),E('span',{'aria-hidden':'true'},'↗')))))),renderHomeChecklist()];
}
async function copyInvitationLink(){
  const url=new URL('./?view=guest#/invitation',location.href).href;
  const msg=guestMode?'모바일 청첩장 링크를 복사했습니다.':'공개 청첩장 링크를 복사했습니다. 기기 초안은 공유되지 않습니다.';
  const fallbackNote=guestMode?'아래 모바일 청첩장 링크를 선택해 복사해 주세요.':'아래 링크를 선택해 복사해 주세요. 기기 초안은 공유되지 않습니다.';
  try{await navigator.clipboard.writeText(url);toast(msg);}
  catch{
    const input=E('input',{type:'text',readonly:true,value:url,'aria-label':'공개 청첩장 링크'});
    showDialog('청첩장 링크 복사',E('div',{},E('p',{},fallbackNote),input));input.focus();input.select();
  }
}
async function shareInvitationLink(){
  const info=content.invitation;
  const url=new URL('./?view=guest#/invitation',location.href).href;
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ');
  const title=names?`${names} · 모바일 청첩장`:'우리의 모바일 청첩장';
  const text=[info.date?formatDate(info.date):'',info.time||'',info.venue||''].filter(Boolean).join(' · ');
  if(navigator.share){
    try{await navigator.share({title,text,url});return;}
    catch(err){if(err?.name==='AbortError')return;}
  }
  await copyInvitationLink();
}
async function copyTextToClipboard(text,message='클립보드에 복사했습니다.',fallbackTitle='내용 복사'){
  if(!text)return false;
  try{await navigator.clipboard.writeText(text);toast(message);return true;}
  catch{
    const field=text.includes('\n')?E('textarea',{rows:'10',readonly:true,'aria-label':fallbackTitle},text):E('input',{type:'text',readonly:true,value:text,'aria-label':fallbackTitle});
    showDialog(fallbackTitle,E('div',{},E('p',{},'아래 내용을 선택해 복사해 주세요.'),field));field.focus();field.select();
    return false;
  }
}
async function copyVenueAddress(text,label='예식장 주소'){
  return copyTextToClipboard(text,`${label}를 복사했습니다.`,`${label} 복사`);
}
function renderInvitationParents(info){
  const gp=(info.groomParents||'').trim();
  const bp=(info.brideParents||'').trim();
  if(!gp&&!bp)return null;
  const p1=(info.partner1||'').replace(/^신랑\s*/,'').trim();
  const p2=(info.partner2||'').replace(/^신부\s*/,'').trim();
  return E('div',{class:'invitation-parents'},
    gp?E('p',{class:'parent-line'},E('span',{class:'parent-prefix'},gp),p1?E('strong',{class:'parent-child'},p1):null):null,
    bp?E('p',{class:'parent-line'},E('span',{class:'parent-prefix'},bp),p2?E('strong',{class:'parent-child'},p2):null):null);
}
function renderInvitationCountdown(info){
  const cd=invitationCountdownInfo(info.date);
  if(!cd)return null;
  const p1=(info.partner1||'').replace(/^신랑\s*/,'').trim();
  const p2=(info.partner2||'').replace(/^신부\s*/,'').trim();
  const subject=(p1&&p2)?`${p1} ♥ ${p2}의 결혼식`:'우리의 결혼식';
  if(cd.status==='today'){
    return E('p',{class:'invitation-countdown-note is-today'},'오늘, ',E('strong',{},subject),'이 열립니다.');
  }
  if(cd.status==='future'){
    return E('p',{class:'invitation-countdown-note'},`${subject}이 `,E('strong',{},`${cd.days}일`),' 남았습니다.');
  }
  return E('p',{class:'invitation-countdown-note is-past'},`${subject}으로부터 `,E('strong',{},`${cd.days}일`),'이 지났습니다.');
}
function renderInvitationGallery(){
  const allPhotos=(content.albums||[]).flatMap(album=>(album.images||[]).map(src=>({src,title:album.title||'웨딩 사진'})));
  if(!allPhotos.length)return null;
  const preview=allPhotos.slice(0,9);
  const allSrcs=allPhotos.map(item=>item.src);
  return E('div',{class:'invitation-section is-gallery reveal-section',id:'inv-sec-gallery'},
    E('div',{class:'invitation-sec-head'},
      E('span',{class:'invitation-sec-en'},'GALLERY'),
      E('span',{class:'invitation-sec-ko'},'우리의 순간')),
    E('div',{class:'invitation-gallery-grid'},preview.map((item,idx)=>E('button',{
      type:'button',
      class:'invitation-gallery-tile',
      'aria-label':`${item.title} 사진 ${idx+1} 확대 보기`,
      onclick:()=>openPhotos('우리의 웨딩 갤러리',allSrcs,idx)
    },image(item.src,`${item.title} ${idx+1}`,{class:'invitation-gallery-img'})))),
    E('div',{class:'invitation-gallery-foot'},
      linkButton(`전체 포토 앨범 보기 (${allPhotos.length}장) →`,'#/albums',true)));
}
function renderAccountGroup(title,rawText){
  const lines=(rawText||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length)return null;
  return E('details',{class:'disclosure invitation-account-group'},
    E('summary',{},title),
    E('ul',{class:'invitation-contacts-list'},lines.map(line=>{
      const acct=extractAccountNumber(line,{allowPhoneLike:true});
      const copyTarget=acct?acct.display:line;
      const copyNotice=acct?`계좌번호(${acct.display})를 복사했습니다.`:'계좌 안내를 복사했습니다.';
      return E('li',{class:'invitation-contact-row'},
        E('span',{class:'contact-row-text'},line),
        E('div',{class:'contact-row-actions'},
          button(acct?'계좌 복사':'복사',()=>copyTextToClipboard(copyTarget,copyNotice,'계좌번호 복사'),'button quiet small-copy-btn')));
    })));
}
function renderInvitationContacts(info){
  const contactLines=(info.contacts||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const hasAccounts=Boolean((info.groomAccounts||'').trim()||(info.brideAccounts||'').trim());
  const nodes=[];
  if(contactLines.length){
    const hasAccountInContacts=contactLines.some(line=>Boolean(extractAccountNumber(line)));
    const summaryLabel=(!hasAccounts&&hasAccountInContacts)?'💌 연락처 · 마음 전하실 곳 안내 보기':'📞 연락처 안내 보기';
    nodes.push(E('details',{class:'disclosure invitation-contacts-box reveal-section',id:'inv-sec-contacts'},
      E('summary',{},summaryLabel),
      E('ul',{class:'invitation-contacts-list'},contactLines.map(line=>{
        const phone=extractPhoneNumber(line);
        const acct=extractAccountNumber(line);
        const actions=[];
        if(phone){
          actions.push(E('a',{href:`tel:${phone.digits}`,class:'button quiet small-copy-btn','aria-label':`${line} 전화 걸기`},'📞 전화'));
          if(phone.isMobile)actions.push(E('a',{href:`sms:${phone.digits}`,class:'button quiet small-copy-btn','aria-label':`${line} 문자 보내기`},'💬 문자'));
          actions.push(button('복사',()=>copyTextToClipboard(phone.display,`전화번호(${phone.display})를 복사했습니다.`,'전화번호 복사'),'button quiet small-copy-btn'));
        }else if(acct){
          actions.push(button('계좌 복사',()=>copyTextToClipboard(acct.display,`계좌번호(${acct.display})를 복사했습니다.`,'계좌번호 복사'),'button quiet small-copy-btn'));
        }else{
          actions.push(button('복사',()=>copyVenueAddress(line,'안내 정보'),'button quiet small-copy-btn'));
        }
        return E('li',{class:'invitation-contact-row'},
          E('span',{class:'contact-row-text'},line),
          E('div',{class:'contact-row-actions'},...actions));
      }))));
  }
  if(hasAccounts){
    nodes.push(E('div',{class:'invitation-section is-accounts reveal-section',id:'inv-sec-accounts'},
      E('div',{class:'invitation-sec-head'},
        E('span',{class:'invitation-sec-en'},'ACCOUNT'),
        E('span',{class:'invitation-sec-ko'},'마음 전하실 곳')),
      E('p',{class:'small muted invitation-accounts-sub'},'참석이 어려우신 분들을 위해 마음 전하실 곳을 조심스레 남깁니다.'),
      E('div',{class:'invitation-account-groups'},
        renderAccountGroup('🌿 신랑 측 계좌번호 보기',info.groomAccounts),
        renderAccountGroup('🌸 신부 측 계좌번호 보기',info.brideAccounts))));
  }
  return nodes.length?nodes:null;
}
function renderInvitationRsvp(info){
  const url=(info.rsvpUrl||'').trim();
  if(!url)return null;
  return E('div',{class:'invitation-rsvp-card reveal-section',id:'inv-sec-rsvp'},
    E('div',{class:'invitation-sec-head'},
      E('span',{class:'invitation-sec-en'},'RSVP'),
      E('span',{class:'invitation-sec-ko'},'참석 여부 · 축하 메시지')),
    E('p',{class:'small muted'},'귀한 걸음의 참석 여부나 따뜻한 축하 메시지를 남겨 주시면 정성껏 준비하겠습니다.'),
    E('div',{class:'invitation-actions'},externalLink('💌 참석 여부 · 축하 메시지 남기기 ↗',url,'button')));
}
function syncNavVisibility(){
  for(const link of document.querySelectorAll('.main-nav [data-route]')){
    const r=link.dataset.route;
    link.hidden=Boolean(guestMode)&&!isGuestVisibleRoute(r);
  }
}
function syncGuestChrome(){
  document.body.classList.toggle('is-guest-mode',Boolean(guestMode));
  const brand=$('.brand');
  const brandText=brand?.querySelector('span:last-child');
  const footerText=$('.site-footer span');
  if(guestMode){
    const info=content?.invitation||{};
    const p1=(info.partner1||'').replace(/^신랑\s*/,'').trim(),p2=(info.partner2||'').replace(/^신부\s*/,'').trim();
    const label=(p1&&p2)?`${p1} · ${p2}`:(p1||p2||'모바일 청첩장');
    if(brand){brand.setAttribute('href','#/invitation');brand.setAttribute('aria-label',`${label} 모바일 청첩장`);}
    if(brandText)brandText.replaceChildren(label,E('small',{},'WEDDING INVITATION'));
    if(footerText)footerText.textContent='귀한 걸음으로 축복해 주셔서 감사합니다.';
  }else{
    if(brand){brand.setAttribute('href','#/home');brand.setAttribute('aria-label','우리의 결혼 기록 홈');}
    if(brandText)brandText.replaceChildren('우리의 결혼 기록',E('small',{},'OUR WEDDING DIARY'));
    if(footerText)footerText.textContent='함께 준비하고, 오래 기억할 우리의 이야기.';
  }
}
function toggleGuestPreview(enable){
  if(urlGuestMode||!canLeaveEditor())return;
  closeDialog();
  guestMode=Boolean(enable);
  if(guestMode){
    content=structuredClone(baseContent);
    syncMemoryPrefs(validatePreferences({}));
  }else{
    try{syncDraftFromStorage();}
    catch{content=structuredClone(baseContent);isDraft=false;draftRevision=baseRevision;syncMemoryPrefs(readRawPrefs());}
  }
  $('#manage-content').hidden=guestMode;
  syncNavVisibility();
  render();
  toast(guestMode?(isDraft?'하객 화면 미리보기 모드입니다. 공개본만 표시되며 이 기기의 미배포 초안은 제외됩니다.':'하객 화면 미리보기 모드입니다. 상단 바에서 편집 화면으로 돌아갈 수 있습니다.'):'편집 화면으로 돌아왔습니다.');
}
function downloadInvitationIcs(){
  try{
    const ics=invitationCalendar(content.invitation);
    downloadText(ics,'wedding-invitation.ics','text/calendar;charset=utf-8');
    toast('예식 일정 파일(.ics)을 다운로드했습니다.');
  }catch(error){toast(error.message,true);}
}
function openInvitationQrModal(){
  const url=new URL('./?view=guest#/invitation',location.href).href;
  const info=content.invitation||{};
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ')||'우리의 모바일 청첩장';
  const svgMarkup=renderQrSvgString(url,{margin:4,label:`${names} 모바일 청첩장 QR 코드`});
  const qrWrap=E('div',{class:'qr-preview-box'});
  qrWrap.innerHTML=svgMarkup;
  const downloadSvgBtn=button('📥 QR 코드(SVG) 저장',()=>{
    downloadText(svgMarkup,'wedding-invitation-qr.svg','image/svg+xml;charset=utf-8');
    toast('모바일 청첩장 QR 코드(SVG)를 저장했습니다.');
  },'button quiet');
  const downloadPngBtn=button('🖼️ QR 이미지(PNG) 저장',()=>{
    const svgBlob=new Blob([svgMarkup],{type:'image/svg+xml;charset=utf-8'});
    const blobUrl=URL.createObjectURL(svgBlob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=720;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,720,720);
      ctx.drawImage(img,0,0,720,720);
      URL.revokeObjectURL(blobUrl);
      canvas.toBlob(pngBlob=>{
        if(!pngBlob)return;
        const aUrl=URL.createObjectURL(pngBlob);
        const a=E('a',{href:aUrl,download:'wedding-invitation-qr.png'});
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(aUrl),1000);
        toast('모바일 청첩장 QR 이미지(PNG)를 저장했습니다.');
      },'image/png');
    };
    img.src=blobUrl;
  },'button');
  const body=E('div',{class:'qr-modal-body'},
    E('p',{class:'small muted'},'스마트폰 카메라로 스캔하면 방문자용 모바일 청첩장 화면(?view=guest#/invitation)이 바로 열립니다. 종이 청첩장 인쇄나 메신저 안내 이미지로 활용할 수 있습니다.'),
    qrWrap,
    E('p',{class:'small qr-url-text'},url),
    E('div',{class:'page-actions qr-modal-actions'},
      downloadPngBtn,
      downloadSvgBtn,
      button('🖼️ QR 포함 청첩장 카드(PNG) 저장',()=>downloadInvitationCardPng(content.invitation,content.albums,toast,{includeQr:true,shareUrl:url}),'button quiet'),
      button('🖼️ 청첩장 카드(PNG) 저장',()=>downloadInvitationCardPng(content.invitation,content.albums,toast),'button quiet'),
      button('💌 청첩장 공유하기',shareInvitationLink,'button quiet'),
      button('🔗 링크 복사',copyInvitationLink,'button quiet')));
  showDialog('📱 모바일 청첩장 QR · 공유',body);
}
function openInvitationMessageModal(){
  const info=content.invitation||{};
  const publicUrl=new URL('./?view=guest#/invitation',location.href).href;
  const presets=buildInvitationShareMessages(info,publicUrl);
  let activeId=presets[0].id;
  const audienceEl=E('p',{class:'small muted share-msg-audience'},presets[0].audience);
  const ta=E('textarea',{rows:'11',class:'share-msg-textarea','aria-label':'상황별 초대 문구 편집'},presets[0].text);
  const tabsWrap=E('div',{class:'trip-quick-filters share-msg-tabs',role:'group','aria-label':'초대 문구 상황 선택'});
  const selectPreset=preset=>{
    activeId=preset.id;
    audienceEl.textContent=preset.audience;
    ta.value=preset.text;
    for(const btn of tabsWrap.querySelectorAll('button')){
      btn.setAttribute('aria-pressed',String(btn.dataset.presetId===activeId));
    }
  };
  for(const preset of presets){
    const btn=E('button',{
      type:'button',
      class:'button quiet trip-filter-chip',
      'data-preset-id':preset.id,
      'aria-pressed':String(preset.id===activeId),
      onclick:()=>selectPreset(preset)
    },preset.label);
    tabsWrap.append(btn);
  }
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ');
  const shareTitle=names?`${names} · 모바일 청첩장`:'우리의 모바일 청첩장';
  const shareBtn=navigator.share?button('💌 바로 공유',async()=>{
    try{await navigator.share({title:shareTitle,text:ta.value});}
    catch(err){if(err?.name!=='AbortError')toast('공유 창을 열지 못했습니다. 복사 버튼을 이용해 주세요.',true);}
  },'button quiet'):null;
  const body=E('div',{class:'share-msg-modal'},
    E('p',{class:'small muted'},'받는 분에 맞는 인사말을 선택하고 필요하면 자유롭게 수정한 뒤 복사해 카카오톡·문자로 바로 보내실 수 있어요.'),
    tabsWrap,
    audienceEl,
    ta,
    E('div',{class:'page-actions share-msg-actions'},
      button('📋 문구 + 링크 복사',()=>copyTextToClipboard(ta.value,'초대 문구와 모바일 청첩장 링크를 복사했습니다.','초대 문구 복사'),'button'),
      shareBtn,
      button('기본 문구로 되돌리기',()=>{
        const found=presets.find(p=>p.id===activeId);
        if(found){ta.value=found.text;toast('선택한 기본 문구로 되돌렸습니다.');}
      },'button quiet')));
  showDialog('💬 상황별 초대 문구 복사',body);
}
function renderInvitationReadiness(info){
  if(guestMode)return null;
  const checks=[
    ['couple',Boolean(info.partner1?.trim()&&info.partner2?.trim()),'신랑·신부 이름','invitation'],
    ['schedule',Boolean(info.date&&info.time&&info.venue?.trim()),'예식 일시·장소','invitation'],
    ['message',Boolean(info.message?.trim()),'초대 인사말','invitation'],
    ['transit',Boolean(info.transit?.trim()||info.notice?.trim()),'교통·식사 안내','invitation'],
    ['albums',Boolean(content.albums?.length),'웨딩 포토 앨범 (라크마 촬영 후 등록 권장)','albums']
  ];
  const doneCount=checks.filter(([,ok])=>ok).length;
  const pct=Math.round((doneCount/checks.length)*100);
  return E('details',{class:'invitation-readiness-card','aria-label':'공개 청첩장 발행 준비도 점검'},
    E('summary',{class:'readiness-summary'},
      E('span',{class:'readiness-summary-title'},`✨ 청첩장 발행 준비도 (${doneCount}/${checks.length})`),
      E('span',{class:'readiness-mini-bar','aria-hidden':'true'},E('span',{class:'readiness-mini-fill',style:`width:${pct}%`})),
      E('span',{class:'small muted readiness-summary-hint'},doneCount===checks.length?'발행 준비 완료':'눌러서 항목 채우기')),
    E('div',{class:'readiness-body'},
      E('p',{class:'small muted'},'하객 화면(?view=guest)에는 비어 있는 항목이 자동으로 숨겨집니다. 항목을 눌러 바로 채울 수 있어요.'),
      E('div',{class:'readiness-chips'},checks.map(([,ok,label,target])=>E('button',{
        type:'button',
        class:'spec-chip readiness-chip'+(ok?' direct':' highlight'),
        onclick:()=>target==='albums'?(location.hash='#/albums'):openEditor('invitation')
      },`${ok?'✓':'+'} ${label}`)))));
}
function renderGuestQuickDock(info,hasGallery){
  if(!guestMode)return null;
  const jumpTo=id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const hasAccounts=Boolean((info.groomAccounts||'').trim()||(info.brideAccounts||'').trim());
  const hasContacts=Boolean((info.contacts||'').trim());
  const thirdAction=hasAccounts
    ?button('💌 마음 전하기',()=>jumpTo('inv-sec-accounts'),'guest-dock-btn')
    :hasContacts
      ?button('📞 연락처',()=>jumpTo('inv-sec-contacts'),'guest-dock-btn')
      :hasGallery
        ?button('🖼️ 갤러리',()=>jumpTo('inv-sec-gallery'),'guest-dock-btn')
        :button('💬 초대 문구',openInvitationMessageModal,'guest-dock-btn');
  return E('nav',{class:'guest-quick-dock','aria-label':'모바일 청첩장 빠른 이동'},
    button('📅 일정',()=>jumpTo('inv-sec-schedule'),'guest-dock-btn'),
    button('📍 오시는 길',()=>jumpTo('inv-sec-location'),'guest-dock-btn'),
    thirdAction,
    button('🔗 공유',shareInvitationLink,'guest-dock-btn is-primary'));
}
function renderInvitation() {
  const info=content.invitation,dday=weddingDday(info.date);
  const hasContent=Object.values(info).some(Boolean);
  const mapLink=externalLink('오시는 길 (네이버 지도) ↗',info.mapUrl,'button');
  const searchKeyword=(info.venue||info.address||'').replace(/\s+\d+층$/,'').trim();
  const kakaoSearchUrl=searchKeyword?`https://map.kakao.com/link/search/${encodeURIComponent(searchKeyword)}`:'';
  const kakaoLink=kakaoSearchUrl?externalLink('카카오맵 ↗',kakaoSearchUrl,'button quiet'):null;
  const googleMapLink=searchKeyword?externalLink('구글 지도 ↗',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchKeyword)}`,'button quiet'):null;
  const ua=navigator.userAgent||'';
  const isAndroid=/Android/i.test(ua);
  const isIos=/iPhone|iPad|iPod/i.test(ua);
  const tmapBtn=(searchKeyword&&(isAndroid||isIos))?button('티맵 앱 ↗',()=>{
    const q=encodeURIComponent(searchKeyword);
    if(isAndroid){
      location.href=`intent://search?name=${q}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(kakaoSearchUrl)};end`;
    }else{
      toast('티맵 앱이 설치된 기기에서 열립니다. 미설치 시 네이버·카카오 지도를 이용해 주세요.');
      location.href=`tmap://search?name=${q}`;
    }
  },'button quiet'):null;
  const copyAddrBtn=(info.address||info.venue)?button('주소 복사',()=>copyVenueAddress(info.address||info.venue),'button quiet'):null;
  let gcalBtn=null,icsBtn=null;
  try{
    const gcalHref=googleCalendarUrl(info);
    gcalBtn=E('a',{href:gcalHref,class:'button quiet',target:'_blank',rel:'noopener noreferrer'},'Google 캘린더에 추가');
    icsBtn=button('일정 파일(.ics) 다운로드',downloadInvitationIcs,'button quiet');
  }catch{}
  const mapActions=[mapLink,kakaoLink,tmapBtn,googleMapLink,copyAddrBtn].filter(Boolean);
  const calActions=[gcalBtn,icsBtn].filter(Boolean);
  const shortMonthDay=info.date?formatDate(info.date).replace(/^\d+년\s*/,''):'일정 미정';
  const gallerySection=renderInvitationGallery();
  const contactNodes=renderInvitationContacts(info);
  const rsvpNode=renderInvitationRsvp(info);
  const venueMapSrc=safeUrl(info.venueMapImage,{image:true});
  const venueMapNode=venueMapSrc?E('div',{class:'invitation-venue-map'},
    E('button',{type:'button',class:'invitation-venue-map-btn','aria-label':'예식장 약도 크게 보기',onclick:()=>openPhotos(`${info.venue||'예식장'} 오시는 길 약도`,[venueMapSrc],0)},
      image(venueMapSrc,`${info.venue||'예식장'} 오시는 길 약도`,{class:'invitation-venue-map-img'}),
      E('span',{class:'map-preview-caption'},'🗺️ 예식장 약도 크게 보기'))):null;
  const headerActions=guestMode?null:E('div',{class:'page-actions'},
    editButton('예식 정보 편집',()=>openEditor('invitation')),
    button('👀 하객 미리보기',()=>toggleGuestPreview(true),'button quiet'),
    button('💬 초대 문구',openInvitationMessageModal,'button quiet'),
    button('📱 QR · 공유',openInvitationQrModal,'button quiet'));
  const topHeader=guestMode&&hasContent
    ?null
    :pageHeader('소중한 분들을 초대합니다.',guestMode?'두 사람의 새로운 시작을 함께 축복해 주세요.':'우리의 마음과 예식 안내를 한 장에 담아요.',headerActions,'THE INVITATION');
  return [topHeader,
    renderInvitationReadiness(info),
    hasContent?E('section',{class:'invitation'},
      renderInvitationCornerMarks(),
      E('div',{class:'invitation-topbar'},
        E('span',{class:'invitation-ribbon'},info.date?`WEDDING INVITATION · ${info.date.replaceAll('-','. ')}`:'WE ARE GETTING MARRIED'),
        E('div',{class:'invitation-topbar-tools'},
          renderLargeTextButton(),
          renderInvitationBgmButton(toast))),
      E('div',{class:'invitation-title'},'우리 두 사람, 결혼합니다'),
      E('p',{class:'invitation-sub'},'With love, together'),
      renderInvitationHeroVisual(info,content.albums),
      (info.partner1||info.partner2||info.groomParents||info.brideParents)?E('div',{class:'invitation-couple-plaque'},
        (info.partner1||info.partner2)?E('h2',{class:'couple-names'},
          info.partner1?[E('small',{class:'role-label is-groom'},'신랑 '),info.partner1.replace(/^신랑\s*/,'')]:null,
          info.partner1&&info.partner2?E('span',{class:'couple-heart'},'♥'):null,
          info.partner2?[E('small',{class:'role-label is-bride'},'신부 '),info.partner2.replace(/^신부\s*/,'')]:null):null,
        renderInvitationParents(info)):null,
      info.message?E('p',{class:'message'},info.message):null,
      renderInvitationDivider(),
      E('div',{class:'invitation-section is-schedule reveal-section',id:'inv-sec-schedule'},
        E('div',{class:'invitation-sec-head'},
          E('span',{class:'invitation-sec-en'},'SAVE THE DATE'),
          E('span',{class:'invitation-sec-ko'},'예식 일시')),
        E('p',{class:'invitation-date'},info.date?formatDate(info.date):'예식 일정 준비 중',info.time?` · ${info.time}`:'',dday?[' ',E('span',{class:'dday-badge'},dday)]:null),
        renderInvitationCalendar(info.date,info.time),
        (info.date||info.time)?E('div',{class:'invitation-milestone-strip'},
          E('div',{class:'milestone-cell'},
            E('span',{class:'milestone-label'},'DATE'),
            E('strong',{class:'milestone-val'},shortMonthDay)),
          E('div',{class:'milestone-cell'},
            E('span',{class:'milestone-label'},'TIME'),
            E('strong',{class:'milestone-val'},info.time?formatKoreanTimeLabel(info.time):'시간 미정')),
          E('div',{class:'milestone-cell is-highlight'},
            E('span',{class:'milestone-label'},'D-DAY'),
            E('strong',{class:'milestone-val'},dday||'예식일'))):null,
        info.date?E('div',{class:'invitation-live-countdown','aria-label':'예식까지 남은 시간 카운트다운'}):null,
        renderInvitationCountdown(info),
        calActions.length?E('div',{class:'invitation-actions invitation-cal-actions'},...calActions):null,
        calActions.length?E('p',{class:'small muted calendar-update-note'},'캘린더에 저장한 일정은 예식 정보가 바뀌어도 자동 수정하지 않습니다. 변경 시 기존 일정을 삭제하거나 직접 수정해 주세요.'):null),
      gallerySection?[renderInvitationDivider(),gallerySection]:null,
      renderInvitationDivider(),
      E('div',{class:'invitation-section is-location reveal-section',id:'inv-sec-location'},
        E('div',{class:'invitation-sec-head'},
          E('span',{class:'invitation-sec-en'},'LOCATION'),
          E('span',{class:'invitation-sec-ko'},'오시는 길')),
        E('div',{class:'place'},
          E('span',{class:'place-kicker'},'📍 WEDDING VENUE'),
          E('strong',{},info.venue||'예식 장소 준비 중'),
          info.address?E('p',{},info.address):null),
        venueMapNode,
        mapActions.length?E('div',{class:'invitation-actions invitation-map-actions'},...mapActions):null),
      (info.transit||info.notice)?E('div',{class:'invitation-extra-guides reveal-section'},
        info.transit?E('div',{class:'invitation-guide-box'},E('strong',{},'🚗 오시는 길 · 교통 및 주차 안내'),E('p',{class:'record-body'},info.transit)):null,
        info.notice?E('div',{class:'invitation-guide-box'},E('strong',{},'📌 예식 안내'),E('p',{class:'record-body'},info.notice)):null):null,
      contactNodes,
      rsvpNode,
      E('div',{class:'invitation-closing reveal-section'},
        S('svg',{class:'invitation-closing-sprig',viewBox:'0 0 84 22','aria-hidden':'true'},
          S('path',{d:'M 16 14 C 28 11, 56 11, 68 14',fill:'none',stroke:'#8ba792','stroke-width':'1.1','stroke-linecap':'round'}),
          renderBotanicalLeaf(28,12,-62,0.52,'#8daa94'),
          renderBotanicalLeaf(56,12,62,0.52,'#8daa94'),
          S('circle',{cx:'42',cy:'11',r:'2.4',fill:'#c97a70'})),
        E('span',{class:'invitation-closing-note'},'귀한 걸음으로 축복해 주시는 모든 분께 진심으로 감사드립니다.'),
        E('div',{class:'invitation-actions invitation-share-foot'},
          button('💬 초대 문구',openInvitationMessageModal,'button quiet'),
          button('💌 초대장 공유',shareInvitationLink,'button quiet'),
          button('🔗 링크 복사',copyInvitationLink,'button quiet'),
          button('🖼️ 이미지 저장',()=>downloadInvitationCardPng(info,content.albums,toast),'button quiet')))):
    empty('우리의 첫 초대장을 준비해요.','두 분의 이름, 예식 날짜와 장소를 입력하면 청첩장에 담깁니다.','예식 정보 입력',()=>openEditor('invitation')),
    hasContent?renderGuestQuickDock(info,Boolean(gallerySection)):null];
}
function sortedStories(){
  return [...content.stories].sort((a,b)=>storySort==='desc'?(b.date||'0000').localeCompare(a.date||'0000'):(a.date||'9999').localeCompare(b.date||'9999'));
}
function focusTrip(id){
  if(currentRoute()!=='honeymoon'||dialog.open)return;
  if(ensureTripVisible(moduleCtx(),id))render();
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
function displayedRecords(type){
  const ctx=moduleCtx();
  return type==='honeymoon'?sortedTrips(ctx):type==='stories'?sortedStories():type==='tips'?filteredTips(ctx):content.albums;
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
      const cleaned=(type==='honeymoon'||type==='tips')?await queuePreference(async()=>{
        const storedBase=readRawPrefs(),nextPrefs=pruneContentPreferences(storedBase,content);
        if(JSON.stringify(nextPrefs)===JSON.stringify(storedBase)){syncMemoryPrefs(nextPrefs);return true;}
        const saved=await savePrefs(nextPrefs,storedBase);if(saved&&type==='honeymoon')updateTripChoices(moduleCtx());return saved;
      }):true;
      if(cleaned)toast('초안에서 삭제했습니다.');
    }catch(error){toast(error.message,true);}
  },'text-button'));
}
function renderStories() {
  const records=sortedStories();
  const sortBar=records.length?E('div',{class:'story-toolbar'},
    E('span',{class:'small muted'},`총 ${records.length}개의 이야기`),
    E('div',{class:'trip-quick-filters',role:'group','aria-label':'일대기 정렬 순서'},
      [['asc','🕰️ 시간순 (첫 만남부터)'],['desc','✨ 최신순 (최근 기록부터)']].map(([key,label])=>E('button',{type:'button',class:'button quiet trip-filter-chip','data-story-sort':key,'aria-pressed':String(storySort===key),onclick:()=>{
        storySort=key;render();main.querySelector(`[data-story-sort="${key}"]`)?.focus({preventScroll:true});
      }},label)))):null;
  return [pageHeader('우리가 함께 걸어온 시간','첫 만남, 기억하고 싶은 날, 함께 내린 결심을 기록해요.',editButton('이야기 추가',()=>openEditor('stories')),'OUR STORY'),
    sortBar,
    records.length?E('section',{class:'timeline'},records.map(item=>E('article',{class:'story-card'+(item.image?' has-image':''),'data-record-id':item.id},
      item.image?E('button',{type:'button',class:'photo-open story-photo-open','aria-label':`${item.title} 사진 확대`,onclick:()=>openPhotos(item.title,[item.image],0)},image(item.image,item.title)):null,
      E('div',{},E('p',{class:'record-date'},item.date?formatDate(item.date):'날짜 없는 기록'),E('h2',{},item.title),E('p',{class:'record-body'},item.body),recordActions('stories',item))))):
    empty(guestMode?'두 사람의 이야기를 정성껏 담고 있습니다.':'첫 번째 이야기를 남겨 볼까요?',guestMode?'첫 만남부터 결혼을 결심한 순간까지, 곧 따뜻한 이야기로 찾아뵙겠습니다.':'처음 만난 날도, 함께 웃었던 평범한 날도 우리의 일대기가 됩니다.','첫 이야기 쓰기',()=>openEditor('stories'))];
}
function openPhotos(title,photos,index=0) {
  if(!photos.length)return;
  clearInterval(slideshowTimer);slideshowTimer=null;
  const body=E('div',{class:'photo-viewer'});
  const toggleSlideshow=()=>{
    if(slideshowTimer){clearInterval(slideshowTimer);slideshowTimer=null;}
    else slideshowTimer=setInterval(()=>{index=(index+1)%photos.length;draw();},3000);
    draw();
  };
  let touchStartX=null,touchStartY=null;
  body.addEventListener('touchstart',event=>{
    const t=event.touches?.[0];if(!t)return;
    touchStartX=t.clientX;touchStartY=t.clientY;
  },{passive:true});
  body.addEventListener('touchend',event=>{
    const t=event.changedTouches?.[0];
    if(touchStartX===null||!t){touchStartX=null;touchStartY=null;return;}
    const dx=t.clientX-touchStartX,dy=t.clientY-(touchStartY??t.clientY);
    touchStartX=null;touchStartY=null;
    if(photos.length>1&&Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.15){
      index=(index+(dx<0?1:-1)+photos.length)%photos.length;
      draw();
    }else if(dy>=85&&dy>Math.abs(dx)*1.4){
      closeDialog();
    }
  },{passive:true});
  const draw=()=>{
    const previous=button('이전 사진',()=>{index=(index+photos.length-1)%photos.length;draw();body.querySelector('.viewer-controls button:first-child')?.focus();},'button quiet');
    const next=button('다음 사진',()=>{index=(index+1)%photos.length;draw();body.querySelector('.viewer-controls button:last-child')?.focus();},'button quiet');
    const playBtn=photos.length>1?button(slideshowTimer?'⏸ 일시정지':'▶ 슬라이드쇼',toggleSlideshow,'button quiet slideshow-toggle'):null;
    if(playBtn)playBtn.setAttribute('aria-pressed',String(Boolean(slideshowTimer)));
    previous.disabled=next.disabled=photos.length<2;
    const thumbs=photos.length>1?E('div',{class:'viewer-thumbs','aria-label':'전체 사진 목록'},photos.map((src,idx)=>E('button',{type:'button',class:'viewer-thumb','aria-label':`${idx+1}번 사진 보기`,'aria-current':String(idx===index),onclick:()=>{index=idx;draw();body.querySelectorAll('.viewer-thumb')[idx]?.focus();}},image(src,`${title} 썸네일 ${idx+1}`)))) : null;
    const stage=E('div',{class:'photo-stage'},
      image(photos[index],`${title} 사진 ${index+1}`,{loading:'eager',class:'photo-stage-img'}),
      E('span',{class:'photo-stage-counter','aria-hidden':'true'},`${index+1} / ${photos.length}`));
    const hint=photos.length>1?E('p',{class:'small muted photo-swipe-hint'},'← 좌우 스와이프·방향키로 넘기기 · 아래로 밀어 닫기 →'):null;
    body.replaceChildren(...[stage,
      E('div',{class:'viewer-controls'},previous,E('span',{'aria-live':'polite'},`${index+1} / ${photos.length}`),playBtn,next),
      hint,
      thumbs].filter(Boolean));
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
function renderAlbums() {
  return [pageHeader('오래 간직할 우리의 순간','사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.',editButton('앨범 추가',()=>openEditor('albums')),'PHOTO ALBUM'),
    content.albums.length?E('section',{class:'album-grid'},content.albums.map(item=>E('article',{class:'album-card','data-record-id':item.id},item.images.length?E('button',{type:'button',class:'photo-open album-cover-open','aria-label':`${item.title} 앨범 사진 ${item.images.length}장 보기`,onclick:()=>openAlbum(item)},image(item.images[0],item.title,{class:'album-cover'})):E('div',{class:'album-placeholder'},'Our memories'),
      E('div',{class:'album-info'},E('p',{class:'record-date'},[item.date?formatDate(item.date):'',`사진 ${item.images.length}장`].filter(Boolean).join(' · ')),E('h2',{},item.title),E('p',{class:'record-body'},item.body),button('사진 보기',()=>openAlbum(item),'text-button'),recordActions('albums',item))))):
    empty(guestMode?'웨딩 포토 앨범을 준비하고 있습니다.':'우리의 사진을 담을 첫 앨범',guestMode?'두 사람의 소중한 웨딩 사진들이 곧 이곳에 채워질 예정입니다.':'사진을 직접 선택하거나 사진 주소를 입력해 앨범 초안을 만들 수 있어요.','첫 앨범 만들기',()=>openEditor('albums'))];
}
function renderHoneymoon() {
  return renderHoneymoonModule(moduleCtx());
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
  return renderStudiosModule(moduleCtx());
}
function renderCeremony(){
  return renderCeremonyModule(moduleCtx());
}
function renderPrenatal(){
  return renderPrenatalModule(moduleCtx());
}
function renderTips() {
  return renderTipsModule(moduleCtx());
}
let revealObserver=null;
function observeInvitationReveal(){
  revealObserver?.disconnect();
  revealObserver=null;
  const targets=[...main.querySelectorAll('.reveal-section')];
  if(!targets.length)return;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if(reduceMotion||typeof IntersectionObserver==='undefined'){
    for(const el of targets)el.classList.add('is-revealed');
    return;
  }
  revealObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        entry.target.classList.add('is-revealed');
        revealObserver?.unobserve(entry.target);
      }
    }
  },{rootMargin:'0px 0px -36px 0px',threshold:0.06});
  for(const el of targets){
    const rect=el.getBoundingClientRect();
    if(rect.top<window.innerHeight*0.95){
      el.classList.add('is-revealed');
    }else{
      el.classList.add('will-reveal');
      revealObserver.observe(el);
    }
  }
}
function syncNavScrollCues(){
  const wrap=$('#main-nav-wrap'),nav=wrap?.querySelector('.main-nav');
  const leftBtn=$('#nav-scroll-left'),rightBtn=$('#nav-scroll-right');
  if(!wrap||!nav)return;
  const overflow=nav.scrollWidth-nav.clientWidth;
  const canLeft=overflow>6&&nav.scrollLeft>6;
  const canRight=overflow>6&&nav.scrollLeft<overflow-6;
  wrap.classList.toggle('can-scroll-left',canLeft);
  wrap.classList.toggle('can-scroll-right',canRight);
  if(leftBtn)leftBtn.hidden=!canLeft;
  if(rightBtn)rightBtn.hidden=!canRight;
}
function render() {
  syncNavVisibility();
  syncGuestChrome();
  const route=currentRoute();
  document.body.dataset.route=route;
  if(route!=='invitation'){stopInvitationBgm();stopInvitationCountdown();activeCountdownSlot=null;revealObserver?.disconnect();revealObserver=null;}
  const renderers={home:renderHome,invitation:renderInvitation,story:renderStories,albums:renderAlbums,studios:renderStudios,honeymoon:renderHoneymoon,ceremony:renderCeremony,prenatal:renderPrenatal,tips:renderTips};
  const keepView=route==='honeymoon'&&main.dataset.renderedRoute===route;
  const opened=keepView?[...main.querySelectorAll('details[open][data-view-key]')].map(node=>node.dataset.viewKey):[];
  const active=keepView&&main.contains(document.activeElement)?document.activeElement:null;
  const anchor=active?.closest('[data-trip-id]')|| (keepView?[...main.querySelectorAll('[data-trip-id]')].find(node=>node.getBoundingClientRect().bottom>0):null);
  const anchorId=anchor?.dataset.tripId,anchorTop=anchor?.getBoundingClientRect().top,focusAction=active?.dataset.tripAction;
  const nodes=renderers[route]().filter(node=>node!==null&&node!==undefined&&node!==false);
  if(!urlGuestMode&&guestMode){
    nodes.unshift(E('div',{class:'guest-preview-bar',role:'region','aria-label':'하객 화면 미리보기 안내'},
      E('span',{},isDraft?'👀 하객에게 보이는 공개 화면을 미리 보고 있습니다. (이 기기의 미배포 초안·개인 메모·편집 버튼 숨김)':'👀 하객에게 보이는 화면을 미리 보고 있습니다. (개인 메모·체크리스트·예산·편집 버튼 숨김)'),
      button('편집 화면으로 돌아가기',()=>toggleGuestPreview(false),'button quiet')));
  }
  main.replaceChildren(...nodes);main.setAttribute('aria-busy','false');main.dataset.renderedRoute=route;
  syncLargeTextUi();
  if(route==='invitation'){
    const cdSlot=main.querySelector('.invitation-live-countdown');
    if(cdSlot)startInvitationCountdown(content.invitation,cdSlot);
    else{stopInvitationCountdown();activeCountdownSlot=null;}
    observeInvitationReveal();
  }
  if(keepView){
    for(const node of main.querySelectorAll('details[data-view-key]'))node.open=opened.includes(node.dataset.viewKey);
    const nextAnchor=[...main.querySelectorAll('[data-trip-id]')].find(node=>node.dataset.tripId===anchorId);
    if(focusAction)nextAnchor?.querySelector(`[data-trip-action="${focusAction}"]`)?.focus({preventScroll:true});
    if(nextAnchor)window.scrollBy(0,nextAnchor.getBoundingClientRect().top-anchorTop);
  }
  for(const anchor of document.querySelectorAll('[data-route]')) {
    if(anchor.dataset.route===route)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');
  }
  const navBar=document.querySelector('.main-nav'),activeNav=navBar?.querySelector('[aria-current="page"]');
  if(navBar&&activeNav&&navBar.scrollWidth>navBar.clientWidth){
    navBar.scrollLeft=Math.max(0,activeNav.offsetLeft-(navBar.clientWidth-activeNav.offsetWidth)/2);
  }
  syncNavScrollCues();
  const invInfo=content?.invitation||{};
  const coupleTitle=[invInfo.partner1?.replace(/^신랑\s*/,'').trim(),invInfo.partner2?.replace(/^신부\s*/,'').trim()].filter(Boolean).join(' & ');
  const baseTitle=guestMode?(coupleTitle?`${coupleTitle} · 모바일 청첩장`:'모바일 청첩장'):(coupleTitle?`${coupleTitle} · 우리의 결혼 기록`:'우리의 결혼 기록');
  const routeTitle=menus.find(m=>m[0]===route)?.[1]||'';
  document.title=guestMode
    ?(route==='home'||route==='invitation'||!isGuestVisibleRoute(route)?baseTitle:`${routeTitle} · ${baseTitle}`)
    :(route==='home'?baseTitle:`${routeTitle} · ${baseTitle}`);
  $('#draft-banner').hidden=!isDraft||guestMode;
  $('#draft-banner span').textContent=draftRevision!==baseRevision?'공개본이 변경되었거나 초안의 기준 버전을 확인할 수 없습니다. 초안을 백업하고 새 공개본을 확인해 주세요.':'이 기기에 저장한 초안을 보고 있어요. 공개 사이트에는 아직 반영되지 않았습니다.';
}
function showDialog(title,body) {
  if(!canLeaveEditor())return false;
  conflictReview?.release?.();editorState=null;conflictReview=null;photoNavigation=null;$('#dialog-notice').hidden=true;
  $('#editor-title').textContent=title;editor.replaceChildren(body);
  const actionSlot=$('#dialog-actions');actionSlot.replaceChildren();
  const actions=body.matches('form')?body.querySelector('.form-actions'):null;
  if(actions){body.id='active-editor-form';for(const submit of actions.querySelectorAll('[type="submit"]'))submit.setAttribute('form',body.id);actionSlot.append(actions);}
  actionSlot.hidden=!actions;
  if(!dialog.open)dialog.showModal();
  editor.scrollTop=0;$('#editor-title').focus();return true;
}
function openEditor(type, item = null) {
  return openEditorModule(moduleCtx(), type, item);
}
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
    if(key===PREF_KEY){syncMemoryPrefs(value);downloadJson({kind:'wedding-private-preferences',schemaVersion:1,preferences:value},'wedding-private-preferences.json');}
    else downloadJson(value,'site.json');
  }catch(error){toast(error.message||'백업을 저장하지 못했습니다.',true);}
}
function downloadContent(){return downloadSaved(DRAFT_KEY);}
function downloadPrivate(){return downloadSaved(PREF_KEY);}
function openManager() {
  if(guestMode)return;
  const managerBase=structuredClone(content),managerRaw=readStorage(DRAFT_KEY),prefRaw=readStorage(PREF_KEY);
  const byteLen=str=>str?new TextEncoder().encode(str).length:0;
  const draftBytes=byteLen(managerRaw),prefBytes=byteLen(prefRaw),totalBytes=draftBytes+prefBytes;
  const maxQuota=5*1024*1024,pct=Math.min(100,Math.max(totalBytes>0?1:0,Math.round((totalBytes/maxQuota)*100)));
  const fmtSize=b=>b>=1024*1024?`${(b/(1024*1024)).toFixed(2)} MB`:`${(b/1024).toFixed(1)} KB`;
  const mergeRadio=E('input',{type:'radio',name:'pref-import-mode',id:'pref-import-merge',value:'merge'});
  mergeRadio.checked=true;
  const replaceRadio=E('input',{type:'radio',name:'pref-import-mode',id:'pref-import-replace',value:'replace'});
  const personal=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'개인 메모·선택 백업 선택'});
  personal.addEventListener('change',async()=>{
    const selected=personal.files?.[0];if(!selected)return;
    try{
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
      const incoming=parsePreferencesBackup(await selected.text());
      if(mergeRadio.checked){
        const currentPrefs=readRawPrefs();
        const merged=mergePreferences(currentPrefs,incoming);
        const diff=summarizePreferencesMerge(currentPrefs,merged);
        const parts=[
          diff.guestsAdded?`하객 +${diff.guestsAdded}건`:'',
          diff.giftsAdded?`축의금 +${diff.giftsAdded}건`:'',
          diff.schedulesAdded?`업체 일정 +${diff.schedulesAdded}건`:'',
          diff.checksAdded?`체크 +${diff.checksAdded}건`:'',
          diff.customItemsAdded?`직접 항목 +${diff.customItemsAdded}건`:'',
          diff.favoritesAdded?`관심 +${diff.favoritesAdded}건`:'',
          diff.notesUpdated?`메모 ${diff.notesUpdated}건 반영`:''
        ].filter(Boolean);
        const previewText=parts.length?parts.join(' · '):'기존 기록과 중복되지 않는 신규 항목은 없으며, 비어 있던 설정만 보완됩니다.';
        if(!confirm(`백업 파일을 이 기기의 기존 기록에 합칠까요?\n\n예상 반영 내용: ${previewText}\n\n※ 기존 하객·축의금·메모·체크는 유지되고 새 항목만 안전하게 합쳐집니다.`))return;
        if(await savePrefs(merged,currentPrefs,readStorage(PREF_KEY))){
          closeDialog();render();
          toast(parts.length?`개인 백업을 기존 기록과 합쳤습니다. (${parts.join(', ')})`:'개인 백업을 기존 기록과 확인·병합했습니다.');
        }
      }else{
        if(!confirm('이 기기의 라크마 촬영 메모·준비물 체크, 여행·꿀팁 선택과 메모, 결혼 준비 체크리스트, 통합 예산, 웨딩홀·스드메 시뮬레이터, 업체 일정 보드, 본식 식순·낭독문 체크, 산전검사 체크·메모, 하객 명단·축의금 장부, 출국 준비물을 백업 내용으로 전체 덮어쓸까요?'))return;
        if(await savePrefs(incoming,validatePreferences({}),readStorage(PREF_KEY))){closeDialog();render();toast('개인 메모와 선택, 체크리스트·예산·일정·식순·산전검사·하객·축의금 장부 설정을 복원했습니다.');}
      }
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
        try{await setDraft(next,managerBase,approvedRaw);syncMemoryPrefs();closeDialog();render();toast('콘텐츠를 이 기기의 초안으로 불러왔습니다.');}
        catch(error){
          if(error instanceof StorageConflict)beginConflictReview({key:DRAFT_KEY,base:managerBase,next,
            saveLocal:applyImport,keepSaved:()=>{try{syncDraftFromStorage();syncMemoryPrefs();closeDialog();render();toast('다른 탭의 저장본을 유지했습니다.');}catch(cause){toast(cause.message,true);}}});
          else toast(error.message,true);
        }
      };
      await applyImport();
    }catch(error){toast(error.message,true);}finally{file.value='';}
  });

  const renderDraftDiffSection=()=>{
    if(!isDraft)return null;
    const diff=summarizeContentDiff(baseContent,content);
    if(!diff.hasChanges){
      return E('section',{class:'manager-section draft-diff-section'},
        E('h3',{},'공개본 대비 초안 변경 내역'),
        E('p',{class:'small muted'},'현재 기기의 초안은 공개본(data/site.json)과 내용이 동일합니다.'));
    }
    const rows=[];
    if(diff.invitationFields.length){
      const statusPrefix={added:'+',modified:'✎',removed:'−'};
      rows.push(E('li',{class:'draft-diff-item'},
        E('strong',{},`청첩장 기본 정보 (${diff.invitationFields.length}개 항목)`),
        E('div',{class:'draft-diff-chips'},diff.invitationFields.map(f=>E('span',{class:`draft-diff-chip is-${f.status}`},`${statusPrefix[f.status]} ${f.label}`)))));
    }
    const sectionLabels=[['stories','우리의 일대기'],['albums','포토 앨범'],['honeymoon','신혼여행'],['tips','결혼 정보']];
    for(const [key,label] of sectionLabels){
      const c=diff.collections[key];
      if(!c||!c.total)continue;
      const chips=[];
      if(c.added)chips.push(E('span',{class:'draft-diff-chip is-added'},`+${c.added} 추가`));
      if(c.modified)chips.push(E('span',{class:'draft-diff-chip is-modified'},`✎ ${c.modified} 수정`));
      if(c.removed)chips.push(E('span',{class:'draft-diff-chip is-removed'},`− ${c.removed} 삭제`));
      if(c.reordered)chips.push(E('span',{class:'draft-diff-chip is-modified'},'↕ 순서 변경'));
      const titles=[...c.addedTitles.map(t=>`+${t}`),...c.modifiedTitles.map(t=>`✎${t}`),...c.removedTitles.map(t=>`−${t}`)];
      const preview=titles.length?`${titles.slice(0,3).join(', ')}${titles.length>3?` 외 ${titles.length-3}건`:''}`:'';
      rows.push(E('li',{class:'draft-diff-item'},
        E('strong',{},label),
        E('div',{class:'draft-diff-chips'},...chips),
        preview?E('p',{class:'small muted draft-diff-preview'},preview):null));
    }
    return E('section',{class:'manager-section draft-diff-section','aria-label':'공개본 대비 초안 변경 내역'},
      E('h3',{},`공개본 대비 초안 변경 내역 (총 ${diff.totalChanges}건)`),
      E('p',{class:'small muted'},'아래 변경 사항을 확인한 뒤 ‘공개용 파일 저장’으로 data/site.json에 반영해 주세요.'),
      E('ul',{class:'draft-diff-list'},...rows));
  };

  showDialog('내용 관리',E('div',{},E('p',{class:'form-note'},'공개본은 저장소의 콘텐츠입니다. 여기서 편집한 내용은 이 기기에만 저장되며 자동으로 공개되지 않습니다.'),
    E('section',{class:'manager-section storage-meter-section'},
      E('h3',{},'브라우저 저장 공간 현황'),
      E('p',{class:'small muted'},`현재 사용량 약 ${fmtSize(totalBytes)} / 권장 한도 5.00 MB (${pct}%) · 초안 ${fmtSize(draftBytes)} · 개인 설정·메모 ${fmtSize(prefBytes)}`),
      E('div',{class:'checklist-progress-track storage-meter-track','aria-hidden':'true'},
        E('span',{class:'checklist-progress-fill',style:`width:${pct}%`}))),
    E('section',{class:'manager-section'},
      E('h3',{},'개인 메모·선택 백업'),
      E('p',{},'라크마 스튜디오 메모·촬영 준비물 체크, 여행 관심·비교·최종 선택·상담 메모, 관심 꿀팁·실천 메모, 결혼 준비 체크리스트·할 일 메모·통합 예산 계산기·웨딩홀/스드메 시뮬레이터·주요 업체 일정 보드·본식 식순·산전검사 체크·메모·하객 명단·축의금 장부·출국 짐 체크리스트를 개인 파일로 보관합니다. 콘텐츠 초안과 사진은 공개용 파일 저장으로 따로 백업하세요. 개인 백업은 공개 저장소에 올리지 마세요.'),
      button('개인 백업 저장',downloadPrivate,'button quiet'),
      E('div',{class:'pref-restore-modes',role:'radiogroup','aria-label':'개인 백업 불러오기 방식'},
        E('label',{class:'check-label',for:'pref-import-merge'},mergeRadio,'기존 기록에 합치기 (병합 · 권장 — 신랑·신부·양가 백업 통합)'),
        E('label',{class:'check-label',for:'pref-import-replace'},replaceRadio,'기존 기록 전체 덮어쓰기')),
      personal),
    E('section',{class:'manager-section'},E('h3',{},'방문자용 보기'),E('p',{},'방문자용 링크는 공개본만 표시하며 편집 버튼과 이 기기의 개인 메모·결혼 준비 탭을 숨깁니다. 접근 권한을 제한하는 기능은 아닙니다.'),linkButton('방문자용 청첩장 열기','?view=guest#/invitation',true)),
    isDraft&&draftRevision!==baseRevision?E('section',{class:'manager-section'},E('h3',{},'새 공개본 확인'),E('p',{},'현재 초안을 파일로 백업한 후 새 공개본을 확인하세요. 공개본으로 돌아가면 초안을 지우며 자동으로 합치지 않습니다.'),button('현재 초안 백업',downloadContent,'button quiet'),linkButton('새 공개본 미리보기','?view=guest#/home',true)):null,
    E('section',{class:'manager-section'},E('h3',{},'기본 정보'),E('p',{},'이름, 예식 일정과 장소, 청첩장 인사를 채워요.'),editButton('예식 정보 편집',()=>openEditor('invitation'),'button quiet')),
    renderDraftDiffSection(),
    E('section',{class:'manager-section'},E('h3',{},'공개할 내용 파일로 저장'),E('p',{},'저장한 site.json 파일은 자동 배포되지 않으며, 저장소의 data/site.json에 반영한 뒤 main 브랜치에 push하면 GitHub Pages에 공개됩니다. 파일에는 청첩장·일대기·앨범·신혼여행·결혼 정보가 담기며, 개인 메모·예산·체크리스트·산전검사 메모·하객 명단·축의금 장부는 포함되지 않습니다.'),button('공개용 파일 저장',downloadContent)),
    E('section',{class:'manager-section'},E('h3',{},'이전에 저장한 내용 불러오기'),E('p',{},'이 앱에서 저장한 JSON 콘텐츠 파일을 선택해 주세요.'),file),
    E('section',{class:'manager-section'},E('h3',{},'초안을 지우고 공개본 보기'),E('p',{},'이 기기의 콘텐츠 초안만 지웁니다. 라크마 촬영 메모와 여행·예산·체크리스트·산전검사 메모·하객 명단·축의금 장부 등 개인 설정은 유지됩니다.'),button('공개본으로 돌아가기',async()=>{
      if(!confirm('이 기기의 콘텐츠 초안을 지울까요? 필요한 내용은 먼저 파일로 저장해 주세요.'))return;
      try{
        await navigator.locks.request(`wedding-storage:${DRAFT_KEY}`,()=>{
          if(localStorage.getItem(DRAFT_KEY)!==managerRaw)throw new Error('다른 탭에서 초안이 변경되었습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 시도해 주세요.');
          localStorage.removeItem(DRAFT_KEY);
        });
        content=structuredClone(baseContent);syncMemoryPrefs();isDraft=false;draftRevision=baseRevision;closeDialog();render();toast('공개본으로 돌아왔습니다.');
      }catch(error){toast(error.message||'초안을 지우지 못했습니다.',true);}
    },'button danger')),
    E('section',{class:'manager-section'},E('h3',{},'개인 설정·메모 초기화'),E('p',{},'이 기기에 저장된 라크마 촬영 메모·준비물 체크, 여행·꿀팁 관심 및 메모, 결혼 준비 체크리스트, 통합 예산, 웨딩홀·스드메 시뮬레이터, 업체 일정, 본식 식순, 산전검사 체크·메모, 하객 명단, 축의금 장부를 초기 상태로 되돌립니다. 필요한 경우 먼저 ‘개인 백업 저장’을 진행해 주세요.'),button('개인 설정·메모 초기화',async()=>{
      if(!confirm('이 기기의 모든 개인 메모·관심 선택·예산·체크리스트·식순·산전검사·하객 명단·축의금 장부 설정을 초기화할까요?'))return;
      if(await savePrefs(validatePreferences({}),validatePreferences({}),readStorage(PREF_KEY))){closeDialog();render();toast('이 기기의 개인 설정과 메모를 초기화했습니다.');}
    },'button danger'))));
}
function syncDraftFromStorage(){
  const saved=readStorage(DRAFT_KEY);
  content=saved?parseContent(saved):structuredClone(baseContent);isDraft=Boolean(saved);draftRevision=saved?JSON.parse(saved).baseRevision??null:baseRevision;
  syncMemoryPrefs();
}
$('#close-dialog').addEventListener('click',requestClose);
dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
dialog.addEventListener('close',unloadDialogMedia);
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
  try{syncDraftFromStorage();syncMemoryPrefs(validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}')));render();toast('다른 탭의 저장 내용을 반영했습니다.');}
  catch(error){toast('다른 탭의 내용을 읽지 못했습니다. 기존 화면을 유지합니다. '+error.message,true);}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopInvitationBgm();
    stopInvitationCountdown();
  }else if(content&&currentRoute()==='invitation'&&activeCountdownSlot?.isConnected){
    startInvitationCountdown(content.invitation,activeCountdownSlot);
  }
});
window.addEventListener('pagehide',()=>{stopInvitationBgm();stopInvitationCountdown();});
const scrollTopBtn=$('#scroll-top-btn');
const syncScrollUi=()=>{
  document.body.classList.toggle('is-scrolled',window.scrollY>36);
  if(scrollTopBtn)scrollTopBtn.hidden=window.scrollY<420;
};
window.addEventListener('scroll',syncScrollUi,{passive:true});
if(scrollTopBtn){
  scrollTopBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}
syncScrollUi();

const navEl=document.querySelector('.main-nav');
if(navEl){
  navEl.addEventListener('scroll',syncNavScrollCues,{passive:true});
  window.addEventListener('resize',syncNavScrollCues,{passive:true});
  $('#nav-scroll-left')?.addEventListener('click',()=>navEl.scrollBy({left:-180,behavior:'smooth'}));
  $('#nav-scroll-right')?.addEventListener('click',()=>navEl.scrollBy({left:180,behavior:'smooth'}));
}

async function init() {
  try {
    syncLargeTextUi();
    if(!guestMode)void loadStudios();
    const siteResponse=await fetch('./data/site.json');
    if(!siteResponse.ok)throw new Error('콘텐츠 파일을 불러오지 못했습니다.');
    baseContent=parseContent(await siteResponse.text());
    baseRevision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(baseContent))))).map(value=>value.toString(16).padStart(2,'0')).join('');content=structuredClone(baseContent);
    let notice='';
    const saved=readStorage(DRAFT_KEY);
    if(saved&&!guestMode){try{content=parseContent(saved);draftRevision=JSON.parse(saved).baseRevision??null;isDraft=true;}catch{notice='저장된 초안을 읽지 못해 공개본을 표시합니다. 기존 초안은 지우지 않았습니다.';}}
    try{syncMemoryPrefs(validatePreferences(guestMode?{}:JSON.parse(readStorage(PREF_KEY)||'{}')));}catch{prefs=validatePreferences({});notice='개인 설정을 읽지 못했습니다. 기존 저장 데이터는 지우지 않았습니다.';}
    $('#manage-content').hidden=guestMode;
    syncNavVisibility();
    render();if(notice)toast(notice,true);
  }catch(error){main.setAttribute('aria-busy','false');main.replaceChildren(empty('기록을 불러오지 못했어요.',error.message,'다시 불러오기',()=>location.reload(),true));}
}
init();
