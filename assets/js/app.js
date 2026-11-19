import { parseContent, validateContent, formatDate, weddingDday, invitationCountdownInfo, invitationLiveCountdown, extractPhoneNumber, extractAccountNumber, safeUrl, MAX_IMPORT_BYTES } from './content.js?v=wedding-features-49';
import { validatePreferences, parsePreferencesBackup, pruneContentPreferences, CHECKLIST_STAGES, PACKING_CATEGORIES, VENDOR_CATEGORIES } from './preferences.js?v=wedding-features-49';
import { lockedMerge, StorageConflict, mergeChanges } from './storage.js?v=wedding-features-49';
import {COST_LABELS,budgetSummary,staySummary,stayReview,dateSpan,emptyQuote,quoteBasis,quoteReview,isBundledPackageTrip,formatCostAllocation,currentBudgetText,climateReview,CLIMATE_CATEGORIES,climateBadgeInfo} from './travel.js?v=wedding-features-49';
import {invitationCalendar,googleCalendarUrl,scheduleCalendar,scheduleGoogleCalendarUrl} from './calendar.js?v=wedding-features-49';
import {venueEstimate,weddingBudgetSummary,sdmEstimate,guestListSummary,giftLedgerSummary} from './planning.js?v=wedding-features-49';
import {renderQrSvgString} from './qrcode.js?v=wedding-features-49';
import {$,E,S,button,linkButton,externalLink,image,formatPartner,downloadText,downloadJson} from './dom.js?v=wedding-features-49';
import {stopInvitationBgm,renderInvitationBgmButton} from './bgm.js?v=wedding-features-49';
import {formatKoreanTimeLabel,renderInvitationCornerMarks,renderInvitationDivider,renderBotanicalLeaf,renderInvitationHeroVisual,renderInvitationCalendar,downloadInvitationCardPng} from './invitation-card.js?v=wedding-features-49';
import {renderStudios as renderStudiosModule} from './studio-ui.js?v=wedding-features-49';
import {CEREMONY_PREP_ITEMS,renderCeremony as renderCeremonyModule} from './ceremony-ui.js?v=wedding-features-49';

const main=$('#main'), dialog=$('#editor-dialog'), editor=$('#editor-body');
const DRAFT_KEY='wedding:v1:draft', PREF_KEY='wedding:v1:preferences', LARGE_TEXT_KEY='wedding:v1:largeText';
const routes=['home','invitation','story','albums','studios','honeymoon','ceremony','tips'];
const menus=[
  ['invitation','청첩장','소중한 분들을 초대하는 우리의 첫 인사.','INVITATION'],
  ['story','우리의 일대기','첫 만남부터 오늘까지, 함께 쌓아 온 시간.','OUR STORY'],
  ['albums','포토 앨범','오래 꺼내 보고 싶은 두 사람의 순간들.','PHOTO ALBUM'],
  ['studios','스튜디오','라크마 촬영 일정과 당일 동선·준비물 안내.','STUDIOS'],
  ['honeymoon','신혼여행','결혼 후 첫 여행, 가고 싶은 곳부터 차근차근.','HONEYMOON'],
  ['ceremony','본식 식순','순천아모르 식순·사회자 대본, 혼인서약서와 하객·축의금 관리.','CEREMONY & VOWS'],
  ['tips','결혼에 관한 모든 정보','상견례·웨딩홀·스드메·본식·혼수까지 결혼 준비 꿀팁 모음.','WEDDING GUIDE']
];
let baseContent, content, studios=[], prefs={}, isDraft=false, toastTimer;
const DEFAULT_STUDIO_ID='studio-09';
const DEFAULT_VENDOR_SCHEDULES=[
  {
    id:'vsched-lachma-shoot',
    category:'📸 스튜디오',
    name:'라크마 스튜디오 웨딩촬영 (낮 12시)',
    date:'2027-02-03',
    done:false,
    note:'2027년 2월 3일 수요일 12:00 확정 (062-714-1970~1 · 월·화 휴무) · STEP1 루나메이크업(광주 남구 천변좌로 432 1층) → STEP2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수) · 당일 현금 헬퍼비 25만 원·실리콘 누브라·검정 긴 양말·어두운 구두·한 입 간식 준비'
  }
];
const currentSelectedStudioId=()=>DEFAULT_STUDIO_ID;
const activeLachmaStudio=()=>studios.find(s=>s.id===DEFAULT_STUDIO_ID)||studios.find(s=>s.name==='라크마');
const activeVendorSchedules=()=>prefs.vendorSchedules!==undefined?prefs.vendorSchedules:structuredClone(DEFAULT_VENDOR_SCHEDULES);
let tripSort='recommended', tripFavoritesOnly=false, withTripNoteOnly=false, tripQuickFilter='all', tripRegionFilter='all', tripAgencyFilter='all', tripSearchQuery='', overviewExpanded=false, packingExpanded=false;
let tipFilter='', tipCategory='all', tipFavoritesOnly=false, withTipNoteOnly=false, redrawTips=()=>{};
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
    isGuestMode:()=>guestMode,
    getContent:()=>content,
    getPrefs:()=>prefs,
    savePrefs,
    queuePreference,
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
  const labels={invitation:'예식 정보',partner1:'첫 번째 이름',partner2:'두 번째 이름',groomParents:'신랑 측 혼주',brideParents:'신부 측 혼주',venue:'예식장',date:'날짜',time:'시간',address:'주소',message:'초대 인사',mapUrl:'지도 링크',venueMapImage:'예식장 약도 이미지',transit:'교통·주차 안내',notice:'예식 안내 메모',contacts:'연락처 안내',groomAccounts:'신랑 측 계좌',brideAccounts:'신부 측 계좌',rsvpUrl:'RSVP 설문 링크',notes:'스튜디오 메모',tripNotes:'여행지 개인 메모',tipNotes:'꿀팁 영상 개인 메모',favorites:'관심 스튜디오',studioSelected:'최종 선택 스튜디오',tripFavorites:'관심 여행지',tipFavorites:'관심 꿀팁',checklist:'결혼 준비 체크리스트',shootChecklist:'촬영 준비 체크리스트',ceremonyChecks:'본식 식순 체크리스트',checklistNotes:'체크리스트 메모',customChecklist:'직접 추가한 할 일',customPackingList:'직접 추가한 준비물',vendorSchedules:'주요 업체 일정',ceremonyPlan:'본식 식순 플래너',guestList:'하객 명단',giftLedger:'축의금 장부',venueSim:'웨딩홀 비용 시뮬레이터',sdmSim:'스드메 비용 시뮬레이터',packingList:'신혼여행 준비물',budgetPlan:'통합 예산 계산기',tripCompare:'여행 비교',tripSelected:'최종 여행지',stories:'이야기',albums:'앨범',honeymoon:'신혼여행',tips:'결혼 정보',category:'분류',channel:'채널·출처',title:'제목',body:'내용',images:'사진',left:'비교 A',right:'비교 B',plan:'여행 상세',experiences:'경험 제안',climate:'기후 안내',climateMonth:'기후 기준 월',sourceTitle:'기후 출처',sourceUrl:'기후 출처 링크',checkedOn:'확인일',comparisonNote:'비교 요약',budgetNotes:'비용 참고 설명',researchNotes:'계획 자료 설명',references:'추가 조사 출처',lodgingNotes:'숙박 구성 메모',itinerary:'일정 흐름',transport:'계획상 이동',stays:'숙박 구성',costs:'비용 배분',quote:'실제 견적'};
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
  const vList=activeVendorSchedules().filter(v=>!v.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
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
  const vList=activeVendorSchedules().filter(v=>!v.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
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
        linkButton('예산 계산기 이동 →','#/tips',true)),
      E('article',{class:'dashboard-card'},
        E('span',{class:'small muted'},'✅ 다음 할 일 & 하객 현황'),
        E('strong',{},nextItem?nextItem.label:'모든 할 일 완료 🎉'),
        nextVendor?E('p',{class:'small'},`📅 다가오는 일정: ${nextVendor.name}${nextVendor.date?` (${nextVendor.date} · ${weddingDday(nextVendor.date)})`:''}`):null,
        gSummary.totalRecords?E('p',{class:'small muted'},`👥 하객 ${gSummary.totalRecords}건 · 참석 ${gSummary.attendingHeadcount}명 (예상 ${gSummary.possibleHeadcount}명 · 발송 ${gSummary.sentCount}/${gSummary.totalRecords})`):E('p',{class:'small muted'},`체크리스트 전체 ${allItems.length}개 중 ${doneCount}개 완료 (${Math.round((doneCount/allItems.length)*100)}%)`),
        gSummary.totalRecords?linkButton('하객·식순 보드 이동 →','#/ceremony',true):button('체크리스트 보기 ↓',()=>$('#home-checklist-title')?.scrollIntoView({behavior:'smooth',block:'start'}),'button quiet'))));
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
    :E('div',{class:'overview'},
      E('div',{},E('span',{class:'small muted'},'OUR DAY'),E('strong',{},info.date?`${formatDate(info.date).replace(/ \S+요일$/,'')}${dday?` · ${dday}`:''}`:'예식 일정 준비 중')),
      E('div',{},E('span',{class:'small muted'},'OUR MEMORIES'),E('strong',{},`이야기 ${content.stories.length} · 앨범 ${content.albums.length}`)),
      E('div',{},E('span',{class:'small muted'},'OUR CHOICES'),E('strong',{},`라크마 촬영 확정 · 여행 ${content.honeymoon.length}곳 · 정보 ${content.tips.length}건`)));
  const ceremonyDone=(prefs.ceremonyChecks||[]).filter(id=>CEREMONY_PREP_ITEMS.some(([cid])=>cid===id)).length;
  const gCount=(prefs.guestList||[]).length;
  const statuses={invitation:info.date?'예식 일시·장소 안내':'첫 인사를 준비해요',story:`${content.stories.length}개의 이야기`,albums:`${content.albums.length}개의 앨범`,studios:'2/3(수) 12:00 촬영 안내',honeymoon:`${content.honeymoon.length}개의 여행 후보`,ceremony:gCount?`체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 하객 ${gCount}건`:`준비 체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 12단계 식순`,tips:`${content.tips.length}개의 꿀팁 영상`};
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
  if(!text)return;
  try{await navigator.clipboard.writeText(text);toast(message);}
  catch{
    const field=text.includes('\n')?E('textarea',{rows:'10',readonly:true,'aria-label':fallbackTitle},text):E('input',{type:'text',readonly:true,value:text,'aria-label':fallbackTitle});
    showDialog(fallbackTitle,E('div',{},E('p',{},'아래 내용을 선택해 복사해 주세요.'),field));field.focus();field.select();
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
  return E('div',{class:'invitation-section is-gallery'},
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
    nodes.push(E('details',{class:'disclosure invitation-contacts-box'},
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
    nodes.push(E('div',{class:'invitation-section is-accounts'},
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
  return E('div',{class:'invitation-rsvp-card'},
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
      button('🖼️ 청첩장 카드(PNG) 저장',()=>downloadInvitationCardPng(content.invitation,content.albums,toast),'button quiet'),
      button('링크 복사',copyInvitationLink,'button quiet')));
  showDialog('📱 모바일 청첩장 QR 코드',body);
}
function renderInvitationReadiness(info){
  if(guestMode)return null;
  const checks=[
    ['couple',Boolean(info.partner1?.trim()&&info.partner2?.trim()),'신랑·신부 이름','invitation'],
    ['schedule',Boolean(info.date&&info.time&&info.venue?.trim()),'예식 일시·장소','invitation'],
    ['message',Boolean(info.message?.trim()),'초대 인사말','invitation'],
    ['transit',Boolean(info.transit?.trim()||info.notice?.trim()),'교통·식사 안내','invitation'],
    ['albums',Boolean(content.albums?.length),'웨딩 포토 앨범 (2/3 라크마 촬영 후 등록 권장)','albums']
  ];
  const doneCount=checks.filter(([,ok])=>ok).length;
  return E('section',{class:'invitation-readiness-card','aria-label':'공개 청첩장 발행 준비도 점검'},
    E('div',{class:'readiness-head'},
      E('div',{},
        E('strong',{},`✨ 모바일 청첩장 발행 준비도 (${doneCount}/${checks.length} 완료)`),
        E('p',{class:'small muted'},'하객 화면(?view=guest)에는 비어 있는 항목이 자동으로 숨겨집니다. 빠진 항목을 눌러 바로 채울 수 있어요.')),
      E('div',{class:'page-actions'},
        button('📱 QR 코드 만들기',openInvitationQrModal,'button quiet'),
        linkButton('📋 본식 식순·낭독문 탭 →','#/ceremony',true),
        button('✏️ 항목 채우기',()=>openEditor('invitation'),'button quiet'))),
    E('div',{class:'readiness-chips'},checks.map(([,ok,label,target])=>E('button',{
      type:'button',
      class:'spec-chip readiness-chip'+(ok?' direct':' highlight'),
      onclick:()=>target==='albums'?(location.hash='#/albums'):openEditor('invitation')
    },`${ok?'✓':'+'} ${label}`))));
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
    button('👀 하객 화면 미리보기',()=>toggleGuestPreview(true),'button quiet'),
    button('📱 QR 코드',openInvitationQrModal,'button quiet'),
    button('청첩장 공유하기',shareInvitationLink,'button quiet'),
    button('청첩장 링크 복사',copyInvitationLink,'button quiet'));
  return [pageHeader('소중한 분들을 초대합니다.',guestMode?'두 사람의 새로운 시작을 함께 축복해 주세요.':'우리의 마음과 예식 안내를 한 장에 담아요.',headerActions,'THE INVITATION'),
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
      E('div',{class:'invitation-section is-schedule'},
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
      E('div',{class:'invitation-section is-location'},
        E('div',{class:'invitation-sec-head'},
          E('span',{class:'invitation-sec-en'},'LOCATION'),
          E('span',{class:'invitation-sec-ko'},'오시는 길')),
        E('div',{class:'place'},
          E('span',{class:'place-kicker'},'📍 WEDDING VENUE'),
          E('strong',{},info.venue||'예식 장소 준비 중'),
          info.address?E('p',{},info.address):null),
        venueMapNode,
        mapActions.length?E('div',{class:'invitation-actions invitation-map-actions'},...mapActions):null),
      (info.transit||info.notice)?E('div',{class:'invitation-extra-guides'},
        info.transit?E('div',{class:'invitation-guide-box'},E('strong',{},'🚗 오시는 길 · 교통 및 주차 안내'),E('p',{class:'record-body'},info.transit)):null,
        info.notice?E('div',{class:'invitation-guide-box'},E('strong',{},'📌 예식 안내'),E('p',{class:'record-body'},info.notice)):null):null,
      contactNodes,
      rsvpNode,
      E('div',{class:'invitation-closing'},
        S('svg',{class:'invitation-closing-sprig',viewBox:'0 0 84 22','aria-hidden':'true'},
          S('path',{d:'M 16 14 C 28 11, 56 11, 68 14',fill:'none',stroke:'#8ba792','stroke-width':'1.1','stroke-linecap':'round'}),
          renderBotanicalLeaf(28,12,-62,0.52,'#8daa94'),
          renderBotanicalLeaf(56,12,62,0.52,'#8daa94'),
          S('circle',{cx:'42',cy:'11',r:'2.4',fill:'#c97a70'})),
        E('span',{class:'invitation-closing-note'},'귀한 걸음으로 축복해 주시는 모든 분께 진심으로 감사드립니다.'),
        E('div',{class:'invitation-actions invitation-share-foot'},
          button('💌 초대장 공유',shareInvitationLink,'button quiet'),
          button('🔗 링크 복사',copyInvitationLink,'button quiet'),
          button('🖼️ 이미지 저장',()=>downloadInvitationCardPng(info,content.albums,toast),'button quiet')))):
    empty('우리의 첫 초대장을 준비해요.','두 분의 이름, 예식 날짜와 장소를 입력하면 청첩장에 담깁니다.','예식 정보 입력',()=>openEditor('invitation'))];
}
function sortedStories(){
  return [...content.stories].sort((a,b)=>storySort==='desc'?(b.date||'0000').localeCompare(a.date||'0000'):(a.date||'9999').localeCompare(b.date||'9999'));
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
  return content.tips.filter(item=>(tipCategory==='all'||(item.category||'기타')===tipCategory)&&(guestMode||!tipFavoritesOnly||prefs.tipFavorites?.includes(item.id))&&(guestMode||!withTipNoteOnly||Boolean(prefs.tipNotes?.[item.id]?.trim()))&&(!query||`${item.title} ${item.category} ${item.channel} ${item.body}`.toLocaleLowerCase().includes(query)));
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
      const cleaned=(type==='honeymoon'||type==='tips')?await queuePreference(async()=>{
        const storedBase=readRawPrefs(),nextPrefs=pruneContentPreferences(storedBase,content);
        if(JSON.stringify(nextPrefs)===JSON.stringify(storedBase)){syncMemoryPrefs(nextPrefs);return true;}
        const saved=await savePrefs(nextPrefs,storedBase);if(saved&&type==='honeymoon')updateTripChoices();return saved;
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
    if(touchStartX===null||!t||photos.length<2){touchStartX=null;touchStartY=null;return;}
    const dx=t.clientX-touchStartX,dy=t.clientY-(touchStartY??t.clientY);
    touchStartX=null;touchStartY=null;
    if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)){
      index=(index+(dx<0?1:-1)+photos.length)%photos.length;
      draw();
    }
  },{passive:true});
  const draw=()=>{
    const previous=button('이전 사진',()=>{index=(index+photos.length-1)%photos.length;draw();body.querySelector('.viewer-controls button:first-child')?.focus();},'button quiet');
    const next=button('다음 사진',()=>{index=(index+1)%photos.length;draw();body.querySelector('.viewer-controls button:last-child')?.focus();},'button quiet');
    const playBtn=photos.length>1?button(slideshowTimer?'⏸ 일시정지':'▶ 슬라이드쇼',toggleSlideshow,'button quiet slideshow-toggle'):null;
    if(playBtn)playBtn.setAttribute('aria-pressed',String(Boolean(slideshowTimer)));
    previous.disabled=next.disabled=photos.length<2;
    const thumbs=photos.length>1?E('div',{class:'viewer-thumbs','aria-label':'전체 사진 목록'},photos.map((src,idx)=>E('button',{type:'button',class:'viewer-thumb','aria-label':`${idx+1}번 사진 보기`,'aria-current':String(idx===index),onclick:()=>{index=idx;draw();body.querySelectorAll('.viewer-thumb')[idx]?.focus();}},image(src,`${title} 썸네일 ${idx+1}`)))) : null;
    body.replaceChildren(image(photos[index],`${title} 사진 ${index+1}`,{loading:'eager'}),
      E('div',{class:'viewer-controls'},previous,E('span',{'aria-live':'polite'},`${index+1} / ${photos.length}`),playBtn,next),thumbs);
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
function tripStyleInfo(item){
  const title=(item.title||'').trim(),id=item.id||'';
  const bracketMatch=title.match(/^\[([^\]]{1,24})\]/);
  if(bracketMatch||/^pkg-/.test(id)||/(패키지|세미패키지|올인클루시브)/.test(title)){
    const rawTag=bracketMatch?bracketMatch[1].trim():'';
    let agencyKey='package',agencyLabel='패키지';
    if(rawTag.startsWith('하나투어')||/-hanatour$/.test(id)){agencyKey='hanatour';agencyLabel='하나투어';}
    else if(rawTag.startsWith('모두투어')||/-modetour$/.test(id)){agencyKey='modetour';agencyLabel='모두투어';}
    else if(rawTag.includes('인터파크')||/-interpark$/.test(id)){agencyKey='interpark';agencyLabel='NOL 인터파크투어';}
    else if(rawTag.startsWith('노랑풍선')||/-ybtour$/.test(id)){agencyKey='ybtour';agencyLabel='노랑풍선';}
    else if(rawTag.startsWith('교원투어')||rawTag.includes('여행이지')||/-kyowon$/.test(id)){agencyKey='kyowon';agencyLabel='교원투어 여행이지';}
    else if(rawTag){
      const brand=rawTag.replace(/\s*(허니문|시그니처|세미패키지|패키지|직판|특전|단독|TOP\s*PICK).*$/i,'').trim()||rawTag;
      agencyKey=`custom:${brand}`;
      agencyLabel=brand;
    }
    const subType=/세미패키지|반자유|우리끼리/.test(title)?'반자유·세미패키지':/올인클루시브/.test(title)?'올인클루시브 패키지':'허니문 패키지';
    return {isPackage:true,agencyKey,agencyLabel,subType,shortBadge:`📦 ${agencyLabel}`,badge:`📦 ${agencyLabel} · ${subType}`};
  }
  return {isPackage:false,agencyKey:'fit',agencyLabel:'자유여행',subType:'직접 구성 가안',shortBadge:'🧳 자유여행 가안',badge:'🧳 자유여행 · 날짜지정 직접조회'};
}
function tripRegionKey(item){
  const text=`${item.id||''} ${item.title||''} ${item.country||''}`;
  if(/bali|발리|짐바란|누사두아|우붓|스미냑/i.test(text))return 'bali';
  if(/nhatrang|나트랑|깜라인|깜란/i.test(text))return 'nhatrang';
  if(/danang|다낭|호이안|미케/i.test(text))return 'danang';
  if(/guam|괌|투몬/i.test(text))return 'guam';
  if(/hawaii|하와이|와이키키|오아후/i.test(text))return 'hawaii';
  return 'other';
}
function tripFlightBadge(item){
  const line=(item.plan?.transport||'').split(/\r?\n/)[0]||'';
  const cleaned=line.replace(/^\d{4}-\d{2}-\d{2}\s*(조회|조사(?:\s*당시)?)\s*항공:\s*/,'').replace(/\s*직항\s*기준\s*패키지\s*구성\.?$/,'').replace(/\s*Economy\s*(Standard|Saver)/i,'').replace(/\s*\([^)]*\)/g,'').trim();
  const text=`${line} ${item.plan?.itinerary||''} ${item.plan?.quote?.flightSource||''}`;
  if(/직항/.test(text)&&!/경유/.test(line)){
    const airline=cleaned.split('.')[0]?.replace(/\s*직항$/,'').trim();
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
  return climateBadgeInfo(item).label;
}
function matchesTripQuickFilter(item,key=tripQuickFilter){
  if(key==='package')return tripStyleInfo(item).isPackage;
  if(key==='fit')return !tripStyleInfo(item).isPackage;
  if(key==='direct')return tripFlightBadge(item).direct;
  if(key==='dry')return climateBadgeInfo(item).dry;
  if(key==='under6m')return item.budget!==null&&item.budget<=6000000;
  if(key==='poolvilla')return /풀빌라/.test(`${item.title} ${(item.plan?.stays||[]).map(s=>s.region).join(' ')} ${item.plan?.lodgingNotes||''}`);
  if(key==='noshopping')return /노쇼핑|노옵션/.test(`${item.title} ${item.pros||''} ${item.plan?.lodgingNotes||''} ${item.plan?.transport||''}`);
  if(key==='longstay')return stayReview(item).nights>=6;
  return true;
}
function matchesTripAgency(item,agencyFilter=tripAgencyFilter){
  if(agencyFilter==='all')return true;
  const style=tripStyleInfo(item);
  if(agencyFilter==='fit')return !style.isPackage;
  if(agencyFilter==='package-all')return style.isPackage;
  return style.agencyKey===agencyFilter;
}
function hasActiveTripFilters(){
  return Boolean((!guestMode&&(tripFavoritesOnly||withTripNoteOnly))||tripQuickFilter!=='all'||tripRegionFilter!=='all'||tripAgencyFilter!=='all'||tripSearchQuery.trim());
}
function resetTripFilters(){
  tripFavoritesOnly=false;withTripNoteOnly=false;tripQuickFilter='all';tripRegionFilter='all';tripAgencyFilter='all';tripSearchQuery='';
}
function matchesTripPool(item,omitKey=''){
  if(!guestMode&&omitKey!=='favorites'&&tripFavoritesOnly&&!prefs.tripFavorites?.includes(item.id))return false;
  if(!guestMode&&omitKey!=='notes'&&withTripNoteOnly&&!prefs.tripNotes?.[item.id]?.trim())return false;
  if(omitKey!=='quick'&&!matchesTripQuickFilter(item,tripQuickFilter))return false;
  if(omitKey!=='region'&&tripRegionFilter!=='all'&&tripRegionKey(item)!==tripRegionFilter)return false;
  if(omitKey!=='agency'&&!matchesTripAgency(item,tripAgencyFilter))return false;
  if(omitKey!=='search'){
    const q=tripSearchQuery.trim().toLocaleLowerCase();
    if(q){
      const hay=`${item.title} ${item.country||''} ${item.pros||''} ${item.cons||''} ${(item.plan?.stays||[]).map(s=>s.region).join(' ')} ${item.plan?.lodgingNotes||''} ${item.plan?.experiences||''}`.toLocaleLowerCase();
      if(!hay.includes(q))return false;
    }
  }
  return true;
}
function matchesAllTripFilters(item){
  return matchesTripPool(item,'');
}
function tripQuickSpecs(item){
  const flight=tripFlightBadge(item);
  const style=tripStyleInfo(item);
  const hasNote=!guestMode&&Boolean(prefs.tripNotes?.[item.id]?.trim());
  return E('div',{class:'trip-spec-chips','aria-label':`${item.title} 핵심 조건 요약`},
    E('span',{class:'spec-chip'+(style.isPackage?' highlight':'')},style.shortBadge),
    E('span',{class:'spec-chip'+(flight.direct?' direct':'')},flight.detail),
    E('span',{class:'spec-chip'},'🏨 '+staySummary(item)),
    E('span',{class:'spec-chip'},tripClimateBadge(item)),
    E('span',{class:'spec-chip highlight'},'💰 2인 계획예산 '+won(item.budget)),
    hasNote?E('span',{class:'spec-chip highlight'},'📝 메모 있음'):null);
}
function tripBudgetBar(item){
  const costs=item.plan?.costs;
  if(!costs)return null;
  const isPkgBundled=tripStyleInfo(item).isPackage&&costs.airfare===0&&(costs.lodging||0)>0;
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
        E('strong',{class:'legend-val'},costs[e.key]===null?'미정':e.key==='airfare'&&isPkgBundled?'패키지포함':`${Math.round(e.val/10000).toLocaleString('ko-KR')}만`)))));
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
  if(tripFavoritesOnly||withTripNoteOnly){render();return;}
  const active=document.activeElement;
  const anchor=main.contains(active)?active:null,before=anchor?.getBoundingClientRect().top;
  for(const node of document.querySelectorAll('.trip-controls button[data-trip-action]')){
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
  const note=prefs.tripNotes?.[item.id]||'';
  return E('section',{class:'selected-trip'},E('h2',{},'최종 선택 · '+item.title),E('p',{},`${item.startDate||'미정'} 한국 출발 → ${item.endDate||'미정'} 한국 도착 · 2인 계획예산 ${won(item.budget)}`),
    E('div',{class:'selected-trip-status'},tripBudgetStatus(item),tripQuoteStatus(item),tripStayStatus(item)),
    note?E('p',{class:'checklist-item-note small'},`📝 우리의 상담 메모: ${note}`):null,
    E('p',{class:'small muted'},'이 기기에 저장한 선택입니다. 예약 확정을 의미하지 않습니다.'),button('선택한 계획 보기',()=>{
      if(!matchesAllTripFilters(item)){resetTripFilters();render();}
      const card=[...main.querySelectorAll('[data-trip-id]')].find(node=>node.dataset.tripId===item.id);
      if(!card)return;const details=card.querySelector('.travel-details');if(details)details.open=true;
      const heading=card.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});card.scrollIntoView({block:'start'});
    },'button quiet'));
}
function tripStayStatus(item){
  const review=stayReview(item);
  return E('p',{class:'stay-status form-note'+(review.warnings.length?' warning':''),role:'status'},review.message);
}
function openTripNoteModal(item){
  if(guestMode)return;
  const form=E('form',{class:'editor-form'});
  const currentNote=prefs.tripNotes?.[item.id]||'';
  const input=E('textarea',{rows:'4',id:'trip-note-input',maxlength:'1000',placeholder:'예: A여행사 허니문 특전 스파 1회 포함 / 풀빌라 2박 견적 대기 중'});
  input.value=currentNote;
  form.append(E('p',{class:'form-note'},`‘${item.title}’ 후보에 대한 개인 상담 메모나 특전·견적 조건을 이 기기에만 저장합니다. 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.`),
    E('label',{class:'field',for:input.id},'여행지 개인 상담 메모',input));
  const submit=E('button',{class:'button',type:'submit'},'상담 메모 저장');
  form.append(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextNotes={...(prefs.tripNotes||{})};
      if(input.value.trim())nextNotes[item.id]=input.value.trim();else delete nextNotes[item.id];
      const saved=await queuePreference(()=>savePrefs({...prefs,tripNotes:nextNotes}));
      if(saved){closeDialog();render();toast('여행지 개인 상담 메모를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  if(showDialog(`${item.title} · 개인 상담 메모`,form))editorState={isDirty:()=>saving||input.value!==currentNote,isSaving:()=>saving};
}
function tripControls(item) {
  if(guestMode)return null;
  const toggle=key=>queuePreference(async()=>{
    const storedBase=readRawPrefs(),active=pruneContentPreferences(storedBase,content);let next;
    if(key==='tripSelected')next={...active,tripSelected:active.tripSelected===item.id?'':item.id};
    else{
      const selected=new Set(active[key]||[]);selected.has(item.id)?selected.delete(item.id):selected.add(item.id);
      if(key==='tripCompare'&&selected.size>2){toast('비교할 여행지는 두 곳까지 선택해 주세요.',true);return true;}
      next={...active,[key]:[...selected]};
    }
    const saved=await savePrefs(next,storedBase);if(saved)updateTripChoices();return saved;
  });
  const hasNote=Boolean(prefs.tripNotes?.[item.id]?.trim());
  return E('div',{class:'trip-controls'},...[
    ...[['tripFavorites','관심 여행지'],['tripCompare','비교 선택'],['tripSelected','최종 선택']].map(([key,label])=>
      E('button',{type:'button',class:'button quiet','data-trip-action':key,'aria-pressed':String(key==='tripSelected'?prefs.tripSelected===item.id:Boolean(prefs[key]?.includes(item.id))),onclick:()=>toggle(key)},label)),
    button(hasNote?'📝 메모 수정':'📝 개인 메모',()=>openTripNoteModal(item),'button quiet')
  ]);
}
function tripComparison() {
  if(guestMode)return null;
  const items=(prefs.tripCompare||[]).map(id=>content.honeymoon.find(item=>item.id===id)).filter(Boolean);
  if(!items.length)return null;
  const fields=[['여행 형태·구분',item=>tripStyleInfo(item).badge],['나라·지역',item=>item.country||'미정'],['한국 출발·도착',item=>[item.startDate,item.endDate].filter(Boolean).join(' ~ ')||'미정'],
    ['2인 계획예산',item=>won(item.budget)],['비용 배분 합계',item=>{const state=budgetSummary(item);return state.known===null?'입력된 배분 없음':won(state.known);}],
    ['실제 견적·귀국 확인',item=>quoteReview(item).message],['숙박 가안',staySummary],['숙박·날짜 검토',item=>stayReview(item).message],...Object.entries(COST_LABELS).map(([key,label])=>[label+' 배분',item=>formatCostAllocation(item,key)]),
    ['계획상 이동',item=>item.plan?.transport||'별도 확인 필요'],['기후 유의점',item=>climateReview(item).summary],
    ['좋은 점',item=>item.pros||'미기재'],['고민할 점',item=>item.cons||'미기재'],
    ['우리의 상담 메모',item=>prefs.tripNotes?.[item.id]||'미입력']];
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
  const q=item.plan.quote||emptyQuote(),state=quoteReview(item),rows=Object.entries(q.costs).map(([key,value])=>[COST_LABELS[key]+' 실제 견적',key==='airfare'&&value===0&&(q.costs.lodging||0)>0&&isBundledPackageTrip(item)?'패키지 통합 포함 (0원)':won(value)]);
  rows.push(['입력 견적 소계',won(state.known)],['현재 계획의 예비비',won(item.plan.costs.reserve)],['입력 견적 + 기입 예비비',won(state.assessed)],['확인 조건을 갖춘 합계',won(state.total)],['조회일',q.checkedOn||'미입력'],['한국 출발 시각',q.departureAt.replace('T',' ')||'미입력'],['한국 도착 시각',q.arrivalAt.replace('T',' ')||'미입력']);
  return travelSection(item,'quote','실제 견적·항공편 확인',tripQuoteStatus(item,true),E('dl',{class:'quote-breakdown'},rows.map(([label,value])=>[E('dt',{},label),E('dd',{},value)])),
    E('p',{},'성인 2명·인천·일반석·객실 1실 기준입니다. 공개 조사 금액은 날짜를 지정한 조회 화면의 표시가이며, 항공사·호텔의 결제 직전 최종 요금이나 예약 확정 금액이 아닙니다. 이동·세금의 공시요금, 환산 가정과 추가 확인 사항은 비용 배분·이동비·예비비 항목에서 확인하세요. 일부 견적만 입력해도 소계와 기입된 예비비 합계를 표시하며, 전체 견적 확인은 모든 필수 비용과 현재 여행·숙박 조건을 확인한 뒤에만 표시합니다.'),
    E('p',{},'항공 근거: '+(q.flightSource||'미입력')),E('p',{},'숙박 근거: '+(q.lodgingSource||'미입력')));
}
function travelDetails(item){
  const plan=item.plan;
  if(!plan)return item.body||item.url?E('details',{class:'travel-details','data-view-key':`${item.id}:all`},E('summary',{},'직접 작성한 메모·참고 링크'),item.body?E('p',{class:'record-body'},item.body):null,externalLink('직접 입력한 참고 링크 ↗',item.url)):null;
  const state=budgetSummary(item);
  const costRows=Object.entries(COST_LABELS).map(([key,label])=>[label,formatCostAllocation(item,key)]);
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
      (plan.references||[]).map(source=>externalLink(source.title+' ↗',source.url))),
    item.body||item.url?travelSection(item,'memo','직접 작성한 메모·참고 링크',item.body?E('p',{class:'record-body'},item.body):null,youtubeThumbBanner(item.url,item.title),externalLink('직접 입력한 참고 링크 ↗',item.url),E('p',{class:'small muted'},'직접 입력한 참고 링크는 기후 공식 출처와 별개입니다. 자유 메모의 문장은 날짜·금액 변경 시 자동 수정되지 않습니다.')):null);
}
function renderAlbums() {
  return [pageHeader('오래 간직할 우리의 순간','사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.',editButton('앨범 추가',()=>openEditor('albums')),'PHOTO ALBUM'),
    content.albums.length?E('section',{class:'album-grid'},content.albums.map(item=>E('article',{class:'album-card','data-record-id':item.id},item.images.length?E('button',{type:'button',class:'photo-open album-cover-open','aria-label':`${item.title} 앨범 사진 ${item.images.length}장 보기`,onclick:()=>openAlbum(item)},image(item.images[0],item.title,{class:'album-cover'})):E('div',{class:'album-placeholder'},'Our memories'),
      E('div',{class:'album-info'},E('p',{class:'record-date'},[item.date?formatDate(item.date):'',`사진 ${item.images.length}장`].filter(Boolean).join(' · ')),E('h2',{},item.title),E('p',{class:'record-body'},item.body),button('사진 보기',()=>openAlbum(item),'text-button'),recordActions('albums',item))))):
    empty(guestMode?'웨딩 포토 앨범을 준비하고 있습니다.':'우리의 사진을 담을 첫 앨범',guestMode?'두 사람의 소중한 웨딩 사진들이 곧 이곳에 채워질 예정입니다.':'사진을 직접 선택하거나 사진 주소를 입력해 앨범 초안을 만들 수 있어요.','첫 앨범 만들기',()=>openEditor('albums'))];
}
function sortedTrips(){
  const trips=content.honeymoon.filter(matchesAllTripFilters);
  return tripSort==='recommended'?trips:trips.sort((a,b)=>a.budget===null?(b.budget===null?0:1):b.budget===null?-1:(a.budget-b.budget)*(tripSort==='budget-high'?-1:1));
}
function tripSortControl(){
  const select=E('select',{id:'trip-sort','aria-label':'여행 후보 정렬'},[['recommended','추천순'],['budget-low','계획예산 낮은 순'],['budget-high','계획예산 높은 순']].map(([value,label])=>E('option',{value},label)));
  select.value=tripSort;
  select.addEventListener('change',()=>{const before=select.getBoundingClientRect().top;tripSort=select.value;render();const target=$('#trip-sort');target.focus({preventScroll:true});window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const agencyPool=content.honeymoon.filter(item=>matchesTripPool(item,'agency'));
  const regionPool=content.honeymoon.filter(item=>matchesTripPool(item,'region'));
  const quickPool=content.honeymoon.filter(item=>matchesTripPool(item,'quick'));
  const knownAgencyKeys=new Set(['fit','hanatour','modetour','interpark','ybtour','kyowon']);
  const extraAgencies=[];
  for(const item of content.honeymoon){
    const style=tripStyleInfo(item);
    if(style.isPackage&&!knownAgencyKeys.has(style.agencyKey)&&!extraAgencies.some(([k])=>k===style.agencyKey)){
      extraAgencies.push([style.agencyKey,style.agencyKey==='package'?'기타 패키지':style.agencyLabel]);
    }
  }
  const agencyOptions=[
    ['all',`전체 형태·여행사 (${agencyPool.length})`],
    ['package-all',`📦 종합여행사 패키지 전체 (${agencyPool.filter(item=>tripStyleInfo(item).isPackage).length})`],
    ['fit',`🧳 자유여행 직접구성 (${agencyPool.filter(item=>!tripStyleInfo(item).isPackage).length})`],
    ['hanatour',`📦 하나투어 (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey==='hanatour').length})`],
    ['modetour',`📦 모두투어 (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey==='modetour').length})`],
    ['interpark',`📦 NOL 인터파크투어 (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey==='interpark').length})`],
    ['ybtour',`📦 노랑풍선 (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey==='ybtour').length})`],
    ['kyowon',`📦 교원투어 여행이지 (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey==='kyowon').length})`],
    ...extraAgencies.map(([key,label])=>[key,`📦 ${label} (${agencyPool.filter(item=>tripStyleInfo(item).agencyKey===key).length})`])
  ].filter(([key])=>key==='all'||tripAgencyFilter===key||content.honeymoon.some(item=>matchesTripAgency(item,key)));
  const agencySelect=E('select',{id:'trip-agency-filter','aria-label':'여행 형태 및 여행사 필터'},agencyOptions.map(([value,label])=>E('option',{value},label)));
  agencySelect.value=agencyOptions.some(([v])=>v===tripAgencyFilter)?tripAgencyFilter:'all';
  agencySelect.addEventListener('change',()=>{const before=agencySelect.getBoundingClientRect().top;tripAgencyFilter=agencySelect.value;render();const target=$('#trip-agency-filter');target?.focus({preventScroll:true});if(target)window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const searchInput=E('input',{type:'search',id:'trip-search',placeholder:'리조트·풀빌라·여행사·특전 검색 (예: 아야나, 노쇼핑, 스냅, 골드패스)','aria-label':'신혼여행 후보 검색'});
  searchInput.value=tripSearchQuery;
  searchInput.addEventListener('input',()=>{
    const before=searchInput.getBoundingClientRect().top,start=searchInput.selectionStart,end=searchInput.selectionEnd;
    tripSearchQuery=searchInput.value;
    render();
    const target=$('#trip-search');
    if(target){target.focus({preventScroll:true});try{target.setSelectionRange(start,end);}catch{}window.scrollBy(0,target.getBoundingClientRect().top-before);}
  });
  const favCheck=E('input',{type:'checkbox',id:'trip-favorites-only'});favCheck.checked=tripFavoritesOnly;
  favCheck.addEventListener('change',()=>{const before=favCheck.getBoundingClientRect().top;tripFavoritesOnly=favCheck.checked;render();const target=$('#trip-favorites-only');target?.focus({preventScroll:true});if(target)window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const noteCheck=E('input',{type:'checkbox',id:'trip-notes-only'});noteCheck.checked=withTripNoteOnly;
  noteCheck.addEventListener('change',()=>{const before=noteCheck.getBoundingClientRect().top;withTripNoteOnly=noteCheck.checked;render();const target=$('#trip-notes-only');target?.focus({preventScroll:true});if(target)window.scrollBy(0,target.getBoundingClientRect().top-before);});
  const hasPackages=content.honeymoon.some(item=>matchesTripQuickFilter(item,'package'));
  const quickFilters=[
    ['all',`전체 (${quickPool.length})`],
    ...(hasPackages?[
      ['package',`📦 패키지·반자유 (${quickPool.filter(item=>matchesTripQuickFilter(item,'package')).length})`],
      ['fit',`🧳 자유여행 (${quickPool.filter(item=>matchesTripQuickFilter(item,'fit')).length})`]
    ]:[]),
    ['direct',`✈️ 직항 노선 (${quickPool.filter(item=>matchesTripQuickFilter(item,'direct')).length})`],
    ['dry',`☀️ 건기·맑은 시기 (${quickPool.filter(item=>matchesTripQuickFilter(item,'dry')).length})`],
    ['under6m',`💸 600만 원 이하 (${quickPool.filter(item=>matchesTripQuickFilter(item,'under6m')).length})`],
    ...(content.honeymoon.some(item=>matchesTripQuickFilter(item,'poolvilla'))||tripQuickFilter==='poolvilla'?[['poolvilla',`🏡 풀빌라 포함 (${quickPool.filter(item=>matchesTripQuickFilter(item,'poolvilla')).length})`]]:[]),
    ...(content.honeymoon.some(item=>matchesTripQuickFilter(item,'noshopping'))||tripQuickFilter==='noshopping'?[['noshopping',`🚫 노쇼핑·노옵션 (${quickPool.filter(item=>matchesTripQuickFilter(item,'noshopping')).length})`]]:[]),
    ['longstay',`🏖️ 6~7박 일정 (${quickPool.filter(item=>matchesTripQuickFilter(item,'longstay')).length})`]
  ];
  const filterBar=E('div',{class:'trip-quick-filters',role:'group','aria-label':'여행지 핵심 조건 빠른 필터'},
    quickFilters.map(([key,label])=>E('button',{type:'button',class:'button quiet trip-filter-chip','data-trip-filter':key,'aria-pressed':String(tripQuickFilter===key),onclick:()=>{
      tripQuickFilter=tripQuickFilter===key&&key!=='all'?'all':key;
      render();
      main.querySelector(`[data-trip-filter="${tripQuickFilter}"]`)?.focus({preventScroll:true});
    }},label)));
  const regionDefs=[
    ['all','🌏 전체 지역',regionPool.length],
    ['bali','🇮🇩 발리',regionPool.filter(item=>tripRegionKey(item)==='bali').length],
    ['nhatrang','🇻🇳 나트랑',regionPool.filter(item=>tripRegionKey(item)==='nhatrang').length],
    ['danang','🇻🇳 다낭·호이안',regionPool.filter(item=>tripRegionKey(item)==='danang').length],
    ['guam','🇬🇺 괌',regionPool.filter(item=>tripRegionKey(item)==='guam').length],
    ['hawaii','🇺🇸 하와이',regionPool.filter(item=>tripRegionKey(item)==='hawaii').length],
    ['other','✈️ 기타 지역',regionPool.filter(item=>tripRegionKey(item)==='other').length]
  ].filter(([key])=>key==='all'||tripRegionFilter===key||content.honeymoon.some(item=>tripRegionKey(item)===key));
  const regionBar=regionDefs.length>2?E('div',{class:'trip-quick-filters trip-region-filters',role:'group','aria-label':'신혼여행 지역별 모아보기'},
    regionDefs.map(([key,label,cnt])=>E('button',{type:'button',class:'button quiet trip-filter-chip','data-trip-region':key,'aria-pressed':String(tripRegionFilter===key),onclick:()=>{
      tripRegionFilter=tripRegionFilter===key&&key!=='all'?'all':key;
      render();
      main.querySelector(`[data-trip-region="${tripRegionFilter}"]`)?.focus({preventScroll:true});
    }},`${label} (${cnt})`))):null;
  const visibleCount=sortedTrips().length;
  const resetBtn=hasActiveTripFilters()?button('필터 초기화',()=>{resetTripFilters();render();$('#trip-sort')?.focus({preventScroll:true});},'text-button'):null;
  return E('div',{class:'travel-tools'},
    E('div',{class:'travel-search-row'},searchInput,agencySelect),
    E('div',{class:'travel-tools-row'},E('label',{for:'trip-sort'},'후보 정렬'),select,guestMode?null:E('label',{class:'check-label',for:'trip-favorites-only'},favCheck,'관심 여행지만 보기'),guestMode?null:E('label',{class:'check-label',for:'trip-notes-only'},noteCheck,'📝 메모 남긴 여행지만 보기'),E('span',{class:'small muted trip-result-count','aria-live':'polite'},`표시 ${visibleCount} / 전체 ${content.honeymoon.length}곳`),resetBtn,E('p',{class:'small muted'},'정렬·필터는 화면 표시만 바꾸며 저장된 후보와 비교 선택은 유지됩니다.')),
    regionBar,
    filterBar,E('p',{class:'small muted'},'기후 필터는 확인된 기준 월의 계절 경향입니다. 여행 월이 달라지거나 요약 분류가 미입력인 후보는 제외하며 해당 기간의 날씨를 보장하지 않습니다.'));
}
function travelOverview(){
  const trips=[...content.honeymoon];
  const ordered=(tripSort==='recommended'?trips:trips.sort((a,b)=>a.budget===null?(b.budget===null?0:1):b.budget===null?-1:(a.budget-b.budget)*(tripSort==='budget-high'?-1:1))).filter(item=>item.plan?.comparisonNote);
  if(!ordered.length)return null;
  const directCount=ordered.filter(item=>tripFlightBadge(item).direct).length;
  const pkgCount=ordered.filter(item=>tripStyleInfo(item).isPackage).length;
  const fitCount=ordered.length-pkgCount;
  const budgets=ordered.map(item=>item.budget).filter(b=>typeof b==='number');
  const minBudget=budgets.length?Math.round(Math.min(...budgets)/10000).toLocaleString('ko-KR'):'';
  const maxBudget=budgets.length?Math.round(Math.max(...budgets)/10000).toLocaleString('ko-KR'):'';
  return E('section',{class:'travel-overview','aria-labelledby':'travel-overview-title'},
    E('div',{class:'overview-head'},
      E('div',{},
        E('h2',{id:'travel-overview-title'},'인천 직항 후보 한눈에 보기'),
        E('p',{class:'small muted'},'자유여행 가안과 종합여행사 대표 허니문·세미패키지를 6월 기후·직항 이동성·계획예산 기준으로 모았습니다.')),
      E('div',{class:'overview-stats'},
        E('span',{class:'spec-chip'},pkgCount?`총 ${ordered.length}곳 (자유 ${fitCount} · 패키지 ${pkgCount})`:`총 ${ordered.length}곳`),
        E('span',{class:'spec-chip direct'},directCount===ordered.length?`✈️ 전 노선 인천 직항 (${directCount}곳)`:`✈️ 직항 ${directCount}곳 · 경유 ${ordered.length-directCount}곳`),
        budgets.length?E('span',{class:'spec-chip highlight'},`💰 2인 계획예산 ${minBudget}만~${maxBudget}만 원`):null)),
    E('details',{class:'overview-disclosure',open:overviewExpanded,ontoggle:event=>{if(event.currentTarget.isConnected)overviewExpanded=event.currentTarget.open;}},E('summary',{},`후보 요약 ${ordered.length}곳 비교 보드 펼치기·접기`),
      E('ol',{class:'overview-board'},ordered.map(item=>{
        const flight=tripFlightBadge(item);
        const style=tripStyleInfo(item);
        return E('li',{},
          E('div',{class:'overview-row-top'},
            button(item.title,()=>{if(!matchesAllTripFilters(item)){resetTripFilters();render();}const card=main.querySelector(`[data-trip-id="${item.id}"]`);if(card){card.querySelector('.travel-details').open=true;focusTrip(item.id);}},'text-button'),
            E('span',{class:'small muted'},item.country||''),
            E('strong',{},'2인 목표 '+won(item.budget))),
          E('div',{class:'overview-meta'},
            E('span',{class:'spec-chip'+(style.isPackage?' highlight':'')},style.shortBadge),
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
function openYoutubeModal(rawUrl,title){
  const url=safeUrl(rawUrl),id=youtubeVideoId(url);
  if(!url||!id)return;
  const body=E('div',{class:'yt-modal-player'},
    E('div',{class:'yt-iframe-wrap'},
      E('iframe',{src:`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,title:`${title} 유튜브 영상 플레이어`,allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',allowfullscreen:true,referrerpolicy:'strict-origin-when-cross-origin',loading:'eager'})),
    E('div',{class:'yt-modal-foot'},
      E('p',{class:'small muted'},'일부 채널은 업로더 설정에 따라 외부 사이트 내 재생이 제한될 수 있습니다. 화면이 나오지 않으면 아래 버튼으로 유튜브에서 바로 열 수 있어요.'),
      externalLink('유튜브 새 탭에서 열기 ↗',url,'button quiet')));
  showDialog(title,body);
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
      return E('div',{class:'yt-video-item'},
        E('a',{class:'yt-video-card',href:url,target:'_blank',rel:'noopener noreferrer'},
          E('span',{class:'yt-thumb-wrap'},
            img,
            E('span',{class:'yt-play-icon','aria-hidden':'true'},'▶')),
          E('span',{class:'yt-video-title'},'▶ '+clean+' ↗')),
        youtubeVideoId(url)?button('▶ 앱 내 바로 재생',()=>openYoutubeModal(url,clean),'button quiet yt-inline-play'):null);
    })));
}
const HONEYMOON_PACKING_LIST=[
  ['📄 필수 서류·결제',[
    ['pack-passport','여권 (유효기간 6개월 이상) · 비자·전자입국신고서 확인'],
    ['pack-voucher','항공권 이티켓 · 호텔·리조트 바우처 · 청첩장 사본 (허니문 특전용)'],
    ['pack-cards','해외결제 카드 (트래블월렛/트래블로그 등) · 현지 비상 현금·달러'],
    ['pack-insurance','해외여행자보험 가입 증서 · 국제운전면허증 (렌터카 이용 시)']
  ]],
  ['🔌 전자기기·통신',[
    ['pack-roaming','유심(USIM) · 이심(eSIM) · 통신사 로밍 설정'],
    ['pack-adapter','해외용 멀티어댑터 · 멀티탭 · 보조배터리 (기내 반입)'],
    ['pack-camera','카메라 · 삼각대/셀카봉 · 방수팩 · 여분 충전 케이블'],
    ['pack-offline','오프라인 지도·번역 앱 다운로드']
  ]],
  ['🏖️ 의류·해변 용품',[
    ['pack-swim','수영복 · 래쉬가드 · 아쿠아슈즈 · 비치타월'],
    ['pack-couple','커플 스냅 촬영용 의상 · 디너 드레스코드 의상 · 편한 신발'],
    ['pack-sun','선글라스 · 챙 넓은 모자 · 우양산 · 얇은 겉옷 (기내·실내 냉방용)'],
    ['pack-laundry','지퍼백 · 세탁망 · 휴대용 세제 · 접이식 보조가방']
  ]],
  ['💊 상비약·세면·기타',[
    ['pack-meds','상비약 (진통제·소화제·지사제·멀미약·밴드·모기기피제)'],
    ['pack-sunblock','자외선 차단제 (선크림·알로에 수딩젤) · 개인 기초화장품'],
    ['pack-shower','여행용 샤워기 필터 · 칫솔·치약 · 미니 헤어용품'],
    ['pack-snack','컵라면·튜브 고추장·김 등 비상 간식 (입국 반입 규정 확인)']
  ]]
];
function allPackingCategories(){
  const custom=prefs.customPackingList||[];
  return HONEYMOON_PACKING_LIST.map(([cat,items])=>[cat,[
    ...items.map(([id,label])=>[id,label,false]),
    ...custom.filter(c=>c.category===cat).map(c=>[c.id,c.title,true])
  ]]);
}
function openCustomPackingEditor(existing=null){
  if(guestMode)return;
  const isEdit=Boolean(existing&&existing.id);
  const form=E('form',{class:'editor-form'});
  const catSelect=E('select',{id:'custom-pack-cat'},PACKING_CATEGORIES.map(c=>E('option',{value:c},c)));
  if(isEdit&&PACKING_CATEGORIES.includes(existing.category))catSelect.value=existing.category;
  const titleInput=E('input',{type:'text',maxlength:'160',id:'custom-pack-title',required:'true',placeholder:'예: 다이슨 에어랩 (변압기 확인) / 커플 필름카메라'});
  if(isEdit)titleInput.value=existing.title||'';
  form.append(
    E('p',{class:'form-note'},'추가·수정한 준비물은 이 기기의 개인 설정에만 저장됩니다.'),
    E('label',{class:'field',for:catSelect.id},'준비물 분류',catSelect),
    E('label',{class:'field',for:titleInput.id},'준비물 이름',titleInput),
    E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),E('button',{class:'button',type:'submit'},isEdit?'준비물 저장':'준비물 추가'))
  );
  const submit=form.querySelector('[type="submit"]');let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;
    const title=titleInput.value.trim();if(!title)return;
    const curList=[...(prefs.customPackingList||[])];
    if(!isEdit&&curList.length>=80){toast('사용자 정의 준비물은 80개까지 추가할 수 있습니다.',true);return;}
    const id=isEdit?existing.id:'cpack-'+crypto.randomUUID().slice(0,8);
    const list=isEdit?curList.map(c=>c.id===id?{id,category:catSelect.value,title}:c):[...curList,{id,category:catSelect.value,title}];
    saving=true;submit.disabled=true;
    try{
      const saved=await queuePreference(()=>savePrefs({...prefs,customPackingList:list}));
      if(saved){packingExpanded=true;closeDialog();render();toast(isEdit?'신혼여행 준비물 항목을 수정했습니다.':'신혼여행 준비물 항목을 추가했습니다.');}
    }catch(error){toast(storageMessage(error),true);}finally{saving=false;submit.disabled=false;}
  });
  const snapshot=()=>JSON.stringify([catSelect.value,titleInput.value]),initial=snapshot();
  if(showDialog(isEdit?'신혼여행 우리만의 준비물 수정':'신혼여행 우리만의 준비물 추가',form))editorState={isDirty:()=>saving||snapshot()!==initial,isSaving:()=>saving};
}
function renderHoneymoonPackingList(){
  if(guestMode)return null;
  const checked=new Set(prefs.packingList||[]);
  const cats=allPackingCategories();
  const allItems=cats.flatMap(([,items])=>items);
  const doneCount=allItems.filter(([id])=>checked.has(id)).length;
  const totalCount=allItems.length;
  const pct=Math.round((doneCount/totalCount)*100);
  const toggleItem=(id,inputNode)=>{
    const next=new Set(prefs.packingList||[]);
    if(inputNode.checked)next.add(id);else next.delete(id);
    queuePreference(async()=>{
      const saved=await savePrefs({...prefs,packingList:[...next]});
      if(saved)render();
      else inputNode.checked=checked.has(id);
      return saved;
    });
  };
  const details=E('details',{class:'disclosure honeymoon-packing','data-view-key':'honeymoon-packing'},
    E('summary',{},`🧳 신혼여행 출국·짐 싸기 체크리스트 (${doneCount}/${totalCount} 완료 · ${pct}%)`),
    E('div',{class:'packing-body'},
      E('div',{class:'packing-toolbar'},
        E('p',{class:'small muted'},'출국 전 꼭 챙겨야 할 필수 서류·로밍·스냅 의상·상비약 체크리스트입니다. 체크 상태와 직접 추가한 준비물은 이 기기에 자동 저장됩니다.'),
        E('div',{class:'page-actions'},
          button('+ 우리만의 준비물 추가',()=>openCustomPackingEditor(),'button quiet'),
          button('🖨️ 인쇄 / PDF 저장',()=>window.print(),'button quiet'),
          doneCount>0?button('짐 체크 초기화',()=>{
            if(!confirm('신혼여행 짐 싸기 체크 기록을 모두 초기화할까요?'))return;
            queuePreference(async()=>{const saved=await savePrefs({...prefs,packingList:[]});if(saved)render();return saved;});
          },'button quiet'):null)),
      E('div',{class:'checklist-grid'},cats.map(([cat,items])=>E('article',{class:'checklist-stage-card'},
        E('div',{class:'checklist-stage-head'},
          E('h3',{},cat),
          E('span',{class:'badge'},`${items.filter(([id])=>checked.has(id)).length}/${items.length}`)),
        E('ul',{class:'checklist-items'},items.map(([id,label,isCustom])=>{
          const box=E('input',{type:'checkbox',id:`pack-${id}`});
          box.checked=checked.has(id);
          box.addEventListener('change',()=>toggleItem(id,box));
          return E('li',{class:'checklist-item'+(box.checked?' done':'')},
            E('div',{class:'checklist-item-top'},
              E('label',{for:box.id},box,E('span',{},label)),
              isCustom?E('div',{class:'checklist-item-actions'},
                button('수정',()=>openCustomPackingEditor({id,category:cat,title:label}),'checklist-note-btn'),
                button('삭제',()=>{
                  if(!confirm(`‘${label}’ 준비물을 삭제할까요?`))return;
                  queuePreference(async()=>{
                    const nextList=(prefs.customPackingList||[]).filter(c=>c.id!==id);
                    const nextChecked=(prefs.packingList||[]).filter(k=>k!==id);
                    const saved=await savePrefs({...prefs,customPackingList:nextList,packingList:nextChecked});
                    if(saved){render();toast('준비물을 삭제했습니다.');}
                    return saved;
                  });
                },'checklist-note-btn danger-text')):null));
        })))))));
  if(packingExpanded)details.open=true;
  details.addEventListener('toggle',()=>{packingExpanded=details.open;});
  return details;
}
function printHoneymoonSummary(){
  const packing=$('.honeymoon-packing'),wasOpen=Boolean(packing?.open),wasExpanded=packingExpanded;
  if(packing&&!wasOpen)packing.open=true;
  document.body.classList.add('print-honeymoon-summary');
  let cleaned=false;
  const cleanup=()=>{
    if(cleaned)return;
    cleaned=true;
    document.body.classList.remove('print-honeymoon-summary');
    if(packing&&!wasOpen){packing.open=false;packingExpanded=wasExpanded;}
    window.removeEventListener('afterprint',cleanup);
  };
  window.addEventListener('afterprint',cleanup,{once:true});
  window.print();
  setTimeout(cleanup,1500);
}
function renderHoneymoon() {
  if(guestMode)return guestRestrictedView('둘만의 첫 여행을 그리며','신랑·신부의 신혼여행 후보와 일정을 비교하는 공간입니다.','HONEYMOON');
  const visibleTrips=sortedTrips();
  const emptyMsg=tripFavoritesOnly&&!withTripNoteOnly&&tripQuickFilter==='all'&&tripRegionFilter==='all'&&tripAgencyFilter==='all'&&!tripSearchQuery.trim()?'등록한 관심 여행지가 없습니다.':withTripNoteOnly&&!tripFavoritesOnly&&tripQuickFilter==='all'&&tripRegionFilter==='all'&&tripAgencyFilter==='all'&&!tripSearchQuery.trim()?'메모를 남긴 여행 후보가 없습니다.':'선택한 조건에 맞는 여행 후보가 없습니다.';
  return [pageHeader('둘만의 첫 여행을 그리며','가고 싶은 여행지와 일정, 예상 비용, 마음에 드는 이유를 모아요.',guestMode?null:E('div',{class:'page-actions'},editButton('여행지 추가',()=>openEditor('honeymoon')),button('🖨️ 선택·비교 요약 인쇄',printHoneymoonSummary,'button quiet')),'HONEYMOON'),
    E('p',{class:'form-note honeymoon-note'},'성인 2명·인천 출발 직항·일반석·객실 1실 기준. 자유여행 가안(5곳)은 날짜 지정 항공·객실 조회 표시가에 기타 지출 목표와 예비비를 더한 배분이며, 종합여행사 패키지·세미패키지 후보(25곳)는 공개 상품 구성을 바탕으로 잡은 2027년 6월 계획예산 배분으로 실제 예약이나 확정 견적은 아닙니다. 각 후보 상세에서 왕복 일정·현지 숙박 날짜·가이드 경비·선택관광·세금 포함 범위와 미확인 비용을 확인하세요.'),
    tripSortControl(),travelOverview(),guestMode?null:E('div',{id:'selected-trip-region'},selectedTripSummary()),E('div',{id:'trip-comparison-region'},tripComparison()),
    renderHoneymoonPackingList(),
    content.honeymoon.length?(visibleTrips.length?E('section',{class:'travel-grid'},visibleTrips.map(item=>{
      const style=tripStyleInfo(item);
      return E('article',{class:'travel-card','data-trip-id':item.id},
        E('div',{class:'trip-card-topline'},E('p',{class:'country'},item.country||'우리의 여행 후보'),E('span',{class:'trip-style-pill '+(style.isPackage?'is-package':'is-fit')},style.badge)),
        E('h2',{},item.title),
        tripQuickSpecs(item),tripBudgetBar(item),
        tripBudgetStatus(item),tripQuoteStatus(item),tripStayStatus(item),
        tripProsCons(item),
        !guestMode&&prefs.tripNotes?.[item.id]?E('p',{class:'checklist-item-note small trip-private-note'},`📝 우리의 상담 메모: ${prefs.tripNotes[item.id]}`):null,
        E('dl',{class:'trip-meta-dl'},E('dt',{},'한국 출발'),E('dd',{},item.startDate||'미정'),E('dt',{},'한국 도착'),E('dd',{},item.endDate||'미정'),E('dt',{},'2인 계획예산'),E('dd',{},item.budget===null?'미정':`${item.budget.toLocaleString('ko-KR')}원`),E('dt',{},'숙박 요약'),E('dd',{},staySummary(item))),
        tripVideoLinks(item),travelDetails(item),tripControls(item),recordActions('honeymoon',item));
    })):E('div',{class:'no-results-box'},E('p',{class:'no-results'},emptyMsg),hasActiveTripFilters()?button('모든 필터·검색 초기화',()=>{resetTripFilters();render();$('#trip-search')?.focus({preventScroll:true});},'button quiet'):null)):
    empty('어디로 떠나고 싶나요?','아직 정하지 않아도 괜찮아요. 끌리는 여행지부터 후보로 남겨 두세요.','여행 후보 남기기',()=>openEditor('honeymoon'))];
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
const WEDDING_BUDGET_CATEGORIES=[
  ['venue','🏛️ 웨딩홀·식대·대관료','seg-airfare','대관료·식대·연출·꽃장식'],
  ['sdm','👗 스튜디오·드레스·메이크업','seg-lodging','촬영·본식 드레스·메이크업·추가금'],
  ['snap','📸 본식스냅·DVD·부케·진행','seg-other','본식스냅·영상·부케·사회/축가'],
  ['rings','💍 예물·예복·한복·예단','seg-reserve','웨딩밴드·신랑 예복·혼주 한복'],
  ['honeymoon','✈️ 신혼여행 (항공·숙박·현지)','seg-honeymoon','선택 여행지 2인 계획예산 연동 가능'],
  ['living','🛋️ 혼수·가전·가구·기타 예비비','seg-living','가전·가구·청첩장·답례품·예비비']
];
function openVenueSimulator(){
  if(guestMode)return;
  const cur=structuredClone(prefs.venueSim||{mealPrice:null,guestCount:null,minGuarantee:null,hallFee:null,deposit:null,note:''});
  const form=E('form',{class:'editor-form'});
  form.append(E('p',{class:'form-note'},'빈칸은 미입력이며 0원·0명과 다릅니다. 식대·예상 하객 수·최소 보증인원·대관료를 모두 입력해야 총액을 계산합니다. 계약금을 입력해야 잔금을 계산하며, 없는 비용은 확인 후 0을 입력해 주세요. 일부 입력도 이 기기에 저장할 수 있습니다.'));
  const mealInput=E('input',{type:'number',min:'0',max:'10000000',step:'1',id:'vsim-meal',placeholder:'예: 55000'});mealInput.value=cur.mealPrice??'';
  const guestInput=E('input',{type:'number',min:'0',max:'10000',step:'1',id:'vsim-guest',placeholder:'예: 250'});guestInput.value=cur.guestCount??'';
  const minInput=E('input',{type:'number',min:'0',max:'10000',step:'1',id:'vsim-min',placeholder:'예: 200'});minInput.value=cur.minGuarantee??'';
  const hallInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'vsim-hall',placeholder:'예: 2500000'});hallInput.value=cur.hallFee??'';
  const depInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'vsim-dep',placeholder:'예: 1000000'});depInput.value=cur.deposit??'';
  const noteInput=E('input',{type:'text',maxlength:'300',id:'vsim-note',placeholder:'예: 순천아모르웨딩컨벤션 아모르홀 · 생화장식·혼주메이크업 포함 조건'});noteInput.value=cur.note||'';
  const previewBox=E('div',{class:'form-note','aria-live':'polite'});
  let saving=false;
  const numOrNull=node=>node.value.trim()===''?null:Number(node.value);
  const read=()=>({mealPrice:numOrNull(mealInput),guestCount:numOrNull(guestInput),minGuarantee:numOrNull(minInput),hallFee:numOrNull(hallInput),deposit:numOrNull(depInput),note:noteInput.value.trim()});
  const updatePreview=()=>{
    const state=venueEstimate(read());
    previewBox.textContent=`계산 기준 인원 ${state.billedGuests===null?'미입력':state.billedGuests.toLocaleString('ko-KR')+'명'} · 식대 ${won(state.mealTotal)} · 입력값 기준 소계 ${won(state.subtotal)}\n`+
      (state.complete?`총액 ${won(state.total)} (입력값 기준 · 확정 계약 견적 아님) · 계약금 차감 후 잔금 ${won(state.balance)}${state.balance===null?' · 계약금 미입력':''}`:`총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`)+
      (state.overpaid?`\n계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`:'');
  };
  for(const node of [mealInput,guestInput,minInput,hallInput,depInput])node.addEventListener('input',updatePreview);
  updatePreview();
  const gSummary=guestListSummary(prefs.guestList||[]);
  const syncTarget=gSummary.attendingHeadcount>0?gSummary.attendingHeadcount:gSummary.possibleHeadcount;
  const syncGuestBtn=gSummary.totalRecords>0?button(
    `👥 하객 명단 인원 불러오기 (${syncTarget.toLocaleString('ko-KR')}명 · ${gSummary.attendingHeadcount>0?'참석 확정':'참석+미정'})`,
    ()=>{
      guestInput.value=String(syncTarget);
      updatePreview();
      guestInput.focus({preventScroll:true});
      toast(`하객 명단 집계(${syncTarget.toLocaleString('ko-KR')}명)를 예상 하객 수에 채웠습니다.`);
    },
    'button quiet small-copy-btn'
  ):null;
  form.append(...[
    E('div',{class:'field-row'},
      E('label',{class:'field',for:mealInput.id},'1인 식대 (원)',mealInput),
      E('label',{class:'field',for:hallInput.id},'대관료·연출료 합계 (원)',hallInput)),
    E('div',{class:'field-row'},
      E('label',{class:'field',for:guestInput.id},'예상 하객 수 (명)',guestInput),
      E('label',{class:'field',for:minInput.id},'최소 보증인원 (명)',minInput)),
    syncGuestBtn?E('div',{class:'page-actions'},syncGuestBtn):null,
    E('div',{class:'field-row'},
      E('label',{class:'field',for:depInput.id},'기납부 계약금 (원)',depInput),
      E('label',{class:'field',for:noteInput.id},'홀·계약 조건 메모 (선택)',noteInput)),
    previewBox,
    E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),E('button',{class:'button',type:'submit'},'웨딩홀 시뮬레이터 저장'))
  ].filter(Boolean));
  const submit=form.querySelector('[type="submit"]');
  const snapshot=()=>JSON.stringify([mealInput.value,guestInput.value,minInput.value,hallInput.value,depInput.value,noteInput.value]),initial=snapshot();
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextSim=read(),saved=await queuePreference(()=>savePrefs({...prefs,venueSim:nextSim}));
      if(saved){closeDialog();render();toast('웨딩홀 식대·대관료 시뮬레이터를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  if(showDialog('웨딩홀 식대 · 보증인원 · 대관료 시뮬레이터',form))editorState={isDirty:()=>saving||snapshot()!==initial,isSaving:()=>saving};
}
function renderVenueSimulator(){
  if(guestMode)return null;
  const sim=prefs.venueSim;
  const hasSim=sim&&(sim.mealPrice!==null||sim.guestCount!==null||sim.minGuarantee!==null||sim.hallFee!==null||sim.deposit!==null||sim.note);
  const meal=sim?.mealPrice??null,hall=sim?.hallFee??null;
  const state=venueEstimate(sim),{billedGuests,mealTotal,total:grandTotal,balance}=state;
  return E('div',{class:'venue-sim-box'},
    E('div',{class:'venue-sim-head'},
      E('div',{},
        E('strong',{},`🏛️ 웨딩홀 식대·보증인원·대관료 시뮬레이터 (${content.invitation?.venue||'웨딩홀'})`),
        E('p',{class:'small muted'},hasSim?(sim.note||'입력값으로 계산한 시뮬레이션입니다. 미입력 항목은 0원으로 계산하지 않습니다.'):'1인 식대, 예상 하객 수, 보증인원, 대관료·계약금을 입력해 웨딩홀 총액을 시뮬레이션해 보세요.')),
      E('div',{class:'page-actions'},
        button(hasSim?'시뮬레이터 수정':'시뮬레이터 입력',openVenueSimulator,'button quiet'),
        hasSim&&state.complete?button('계산 총액을 웨딩홀 예산에 반영',()=>{
          const nextPlan=structuredClone(prefs.budgetPlan||{});
          const curVenue=nextPlan.venue||{planned:null,actual:null,note:''};
          nextPlan.venue={
            planned:curVenue.planned??grandTotal,
            actual:grandTotal,
            note:curVenue.note||`식대 ${won(meal)}×${billedGuests}명(${won(mealTotal)}) + 대관료 ${won(hall)}`
          };
          queuePreference(async()=>{
            const saved=await savePrefs({...prefs,budgetPlan:nextPlan});
            if(saved){render();toast(`웨딩홀 시뮬레이션 총액(${won(grandTotal)})을 통합 예산 계산기에 반영했습니다.`);}
            return saved;
          });
        },'button quiet'):null)),
    hasSim?E('div',{class:'venue-sim-grid'},
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'1인 식대 × 적용 인원'),E('strong',{},`${won(meal)} × ${billedGuests===null?'미입력':billedGuests+'명'}`)),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'입력값 기준 소계'),E('strong',{},won(state.subtotal))),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'입력값 기준 총액'),E('strong',{},won(grandTotal))),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'계약금 차감 후 잔금'),E('strong',{},won(balance)))):null,
    hasSim&&!state.complete?E('p',{class:'form-note'},`총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`):null,
    hasSim&&state.complete&&balance===null?E('p',{class:'small muted'},'계약금 미입력 · 잔금 미확인'):null,
    state.overpaid?E('p',{class:'form-note'},`계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`):null);
}
function openSdmSimulator(){
  if(guestMode)return;
  const cur=structuredClone(prefs.sdmSim||{packageFee:null,helperFee:null,extraFee:null,deposit:null,roadScene:false,nightShoot:false,note:''});
  const form=E('form',{class:'editor-form'});
  form.append(E('p',{class:'form-note'},'빈칸은 미입력이며 0원과 다릅니다. 스드메 기본 계약금·촬영 헬퍼비·원본/보정본 등 기타 추가금을 모두 입력해야 총액을 계산합니다(없는 비용은 확인 후 0 입력). 라크마 공식 기준 헬퍼비(250,000원, 현금)와 로드씬·야간촬영(각 +170,000원, 현금) 옵션을 함께 시뮬레이션할 수 있습니다.'));
  const pkgInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'sdm-pkg',placeholder:'예: 2400000'});pkgInput.value=cur.packageFee??'';
  const helperInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'sdm-helper',placeholder:'예: 250000 (라크마 공식 현금)'});helperInput.value=cur.helperFee??'';
  const extraInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'sdm-extra',placeholder:'예: 330000 (없으면 확인 후 0)'});extraInput.value=cur.extraFee??'';
  const depInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:'sdm-dep',placeholder:'예: 500000'});depInput.value=cur.deposit??'';
  const roadCheck=E('input',{type:'checkbox',id:'sdm-road'});roadCheck.checked=Boolean(cur.roadScene);
  const nightCheck=E('input',{type:'checkbox',id:'sdm-night'});nightCheck.checked=Boolean(cur.nightShoot);
  const noteInput=E('input',{type:'text',maxlength:'300',id:'sdm-note',placeholder:'예: 라크마 2/3(수) 12시 · 루나메이크업 08:30 · 원본/수정본 별도 구매 조건'});noteInput.value=cur.note||'';
  const previewBox=E('div',{class:'form-note','aria-live':'polite'});
  let saving=false;
  const numOrNull=node=>node.value.trim()===''?null:Number(node.value);
  const read=()=>({
    packageFee:numOrNull(pkgInput),
    helperFee:numOrNull(helperInput),
    extraFee:numOrNull(extraInput),
    deposit:numOrNull(depInput),
    roadScene:roadCheck.checked,
    nightShoot:nightCheck.checked,
    note:noteInput.value.trim()
  });
  const updatePreview=()=>{
    const state=sdmEstimate(read());
    previewBox.textContent=`선택 현장 옵션 합계 ${won(state.optionFee)} · 당일 현장 현금 준비액(헬퍼비+선택옵션) ${state.onSiteCash===null?'미확인(헬퍼비 입력 필요)':won(state.onSiteCash)} · 입력값 기준 소계 ${won(state.subtotal)}\n`+
      (state.complete?`총액 ${won(state.total)} (입력값 기준 · 확정 견적 아님) · 계약금 차감 후 잔금 ${won(state.balance)}${state.balance===null?' · 계약금 미입력':''}`:`총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`)+
      (state.overpaid?`\n계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`:'');
  };
  for(const node of [pkgInput,helperInput,extraInput,depInput])node.addEventListener('input',updatePreview);
  for(const node of [roadCheck,nightCheck])node.addEventListener('change',updatePreview);
  updatePreview();
  form.append(
    E('div',{class:'page-actions'},
      button('✨ 라크마 공식 헬퍼비(250,000원) 채우기',()=>{
        helperInput.value='250000';
        updatePreview();
        toast('라크마 공식 촬영 헬퍼비(250,000원)를 입력란에 채웠습니다.');
      },'button quiet')),
    E('div',{class:'field-row'},
      E('label',{class:'field',for:pkgInput.id},'스드메 기본 계약금 (원)',pkgInput),
      E('label',{class:'field',for:helperInput.id},'촬영 헬퍼비 (원 · 당일 현금)',helperInput)),
    E('div',{class:'field-row'},
      E('label',{class:'field',for:extraInput.id},'원본·보정본·액자 등 기타 추가금 (원)',extraInput),
      E('label',{class:'field',for:depInput.id},'기납부 계약금 (원)',depInput)),
    E('div',{class:'sdm-option-checks'},
      E('label',{class:'check-label',for:roadCheck.id},roadCheck,'로드씬 추가 (+170,000원 · 당일 현금)'),
      E('label',{class:'check-label',for:nightCheck.id},nightCheck,'야간촬영 추가 (+170,000원 · 최소 7일 전 예약·현금)')),
    E('label',{class:'field',for:noteInput.id},'스드메·촬영 조건 메모 (선택)',noteInput),
    previewBox,
    E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),E('button',{class:'button',type:'submit'},'스드메 시뮬레이터 저장'))
  );
  const submit=form.querySelector('[type="submit"]');
  const snapshot=()=>JSON.stringify([pkgInput.value,helperInput.value,extraInput.value,depInput.value,roadCheck.checked,nightCheck.checked,noteInput.value]),initial=snapshot();
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextSim=read(),saved=await queuePreference(()=>savePrefs({...prefs,sdmSim:nextSim}));
      if(saved){closeDialog();render();toast('스드메·라크마 현장 추가금 시뮬레이터를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  if(showDialog('스드메 · 라크마 현장 추가금 시뮬레이터',form))editorState={isDirty:()=>saving||snapshot()!==initial,isSaving:()=>saving};
}
function renderSdmSimulator(){
  if(guestMode)return null;
  const sim=prefs.sdmSim;
  const hasSim=Boolean(sim&&(sim.packageFee!==null||sim.helperFee!==null||sim.extraFee!==null||sim.deposit!==null||sim.roadScene||sim.nightShoot||sim.note));
  const state=sdmEstimate(sim);
  return E('div',{class:'sdm-sim-box'},
    E('div',{class:'venue-sim-head'},
      E('div',{},
        E('strong',{},'👗 스드메 · 라크마 촬영 현장 추가금 시뮬레이터'),
        E('p',{class:'small muted'},hasSim?(sim.note||'입력값으로 계산한 스드메 시뮬레이션입니다. 미입력 항목은 0원으로 가정하지 않습니다.'):'스드메 기본 계약금, 라크마 공식 헬퍼비(25만 원·현금), 로드씬·야간촬영(각 17만 원), 원본·보정본 추가금을 합산해 보세요.')),
      E('div',{class:'page-actions'},
        button(hasSim?'스드메 시뮬레이터 수정':'스드메 시뮬레이터 입력',openSdmSimulator,'button quiet'),
        hasSim&&state.complete?button('계산 총액을 스드메 예산에 반영',()=>{
          const nextPlan=structuredClone(prefs.budgetPlan||{});
          const curSdm=nextPlan.sdm||{planned:null,actual:null,note:''};
          const optLabels=[sim.roadScene?'로드씬 17만':'',sim.nightShoot?'야간촬영 17만':''].filter(Boolean).join('+');
          nextPlan.sdm={
            planned:curSdm.planned??state.total,
            actual:state.total,
            note:curSdm.note||`스드메 기본 ${won(sim.packageFee)} + 헬퍼비 ${won(sim.helperFee)}${optLabels?` + ${optLabels}`:''} + 추가금 ${won(sim.extraFee)}`
          };
          queuePreference(async()=>{
            const saved=await savePrefs({...prefs,budgetPlan:nextPlan});
            if(saved){render();toast(`스드메 시뮬레이션 총액(${won(state.total)})을 통합 예산 계산기에 반영했습니다.`);}
            return saved;
          });
        },'button quiet'):null)),
    hasSim?E('div',{class:'venue-sim-grid'},
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'당일 현장 현금 준비액'),E('strong',{},state.onSiteCash===null?'미확인 (헬퍼비 미입력)':won(state.onSiteCash))),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'입력값 기준 소계'),E('strong',{},won(state.subtotal))),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'입력값 기준 총액'),E('strong',{},won(state.total))),
      E('div',{class:'venue-sim-stat'},E('span',{class:'small muted'},'계약금 차감 후 잔금'),E('strong',{},won(state.balance)))):null,
    hasSim&&!state.complete?E('p',{class:'form-note'},`총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`):null,
    hasSim&&state.complete&&state.balance===null?E('p',{class:'small muted'},'계약금 미입력 · 잔금 미확인'):null,
    state.overpaid?E('p',{class:'form-note'},`계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`):null);
}
function openBudgetEditor(){
  if(guestMode)return;
  const current=structuredClone(prefs.budgetPlan||{});
  const form=E('form',{class:'editor-form'});
  form.append(E('p',{class:'form-note'},'입력한 결혼 준비 예산은 이 기기의 개인 설정에만 저장되며 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.'));
  const fields={};
  const explicitTrip=content.honeymoon.find(t=>t.id===prefs.tripSelected);
  const selectedTrip=explicitTrip||content.honeymoon[0];
  if(selectedTrip?.budget){
    const tripTag=explicitTrip?`최종 선택 '${selectedTrip.title}'`:`1순위 후보(선택 전) '${selectedTrip.title}'`;
    form.append(button(`✈️ ${tripTag} 2인 계획예산(${won(selectedTrip.budget)})을 신혼여행 목표 예산에 채우기`,()=>{
      if(fields.honeymoon_planned){
        fields.honeymoon_planned.value=String(selectedTrip.budget);
        toast(`'${selectedTrip.title}' 계획예산을 신혼여행 목표 예산 입력란에 채웠습니다.`);
      }
    },'button quiet'));
  }
  if(selectedTrip){
    const tripQuote=quoteReview(selectedTrip);
    form.append(button(tripQuote.complete?`✈️ '${selectedTrip.title}' 확인된 실제 견적 총액(${won(tripQuote.total)})을 신혼여행 실제·견적에 채우기`:'✈️ 신혼여행 확인 견적 불러오기',()=>{
      if(!tripQuote.complete){
        toast(`'${selectedTrip.title}' 후보의 실제 견적 필수 항목(${tripQuote.missing.join(' · ')})을 먼저 확인·입력해 주세요.`,true);
        return;
      }
      if(fields.honeymoon_actual){
        fields.honeymoon_actual.value=String(tripQuote.total);
        if(!fields.honeymoon_planned.value.trim()&&selectedTrip.budget)fields.honeymoon_planned.value=String(selectedTrip.budget);
        else if(!fields.honeymoon_planned.value.trim())fields.honeymoon_planned.value=String(tripQuote.total);
        toast(`'${selectedTrip.title}' 확인된 실제 견적 총액(${won(tripQuote.total)})을 신혼여행 실제·견적 입력란에 채웠습니다.`);
      }
    },'button quiet'));
  }
  const sim=prefs.venueSim;
  const estimate=venueEstimate(sim),simTotal=estimate.total;
  form.append(button(estimate.complete?`🏛️ 웨딩홀 시뮬레이터 총액(${won(simTotal)})을 웨딩홀 실제·견적에 채우기`:'🏛️ 웨딩홀 시뮬레이터 예상 총액 불러오기',()=>{
    if(!estimate.complete){
      toast(`웨딩홀 시뮬레이터에 필수 항목(${estimate.missing.join(' · ')})을 먼저 입력해 주세요.`,true);
      return;
    }
    if(fields.venue_actual){
      fields.venue_actual.value=String(simTotal);
      if(!fields.venue_planned.value.trim())fields.venue_planned.value=String(simTotal);
      toast('웨딩홀 시뮬레이터 총액을 웨딩홀 견적 입력란에 채웠습니다.');
    }
  },'button quiet'));
  const sdm=prefs.sdmSim;
  const sdmEst=sdmEstimate(sdm),sdmTotal=sdmEst.total;
  form.append(button(sdmEst.complete?`👗 스드메 시뮬레이터 총액(${won(sdmTotal)})을 스드메 실제·견적에 채우기`:'👗 스드메 시뮬레이터 예상 총액 불러오기',()=>{
    if(!sdmEst.complete){
      toast(`스드메 시뮬레이터에 필수 항목(${sdmEst.missing.join(' · ')})을 먼저 입력해 주세요.`,true);
      return;
    }
    if(fields.sdm_actual){
      fields.sdm_actual.value=String(sdmTotal);
      if(!fields.sdm_planned.value.trim())fields.sdm_planned.value=String(sdmTotal);
      toast('스드메 시뮬레이터 총액을 스드메 견적 입력란에 채웠습니다.');
    }
  },'button quiet'));
  for(const [key,title,,desc] of WEDDING_BUDGET_CATEGORIES){
    const entry=current[key]||{planned:null,actual:null,note:''};
    const pInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:`budget-${key}-planned`,placeholder:'예: 15000000'});
    pInput.value=entry.planned??'';
    const aInput=E('input',{type:'number',min:'0',max:'1000000000',step:'1',id:`budget-${key}-actual`,placeholder:'예: 14200000'});
    aInput.value=entry.actual??'';
    const nInput=E('input',{type:'text',maxlength:'300',id:`budget-${key}-note`,placeholder:desc});
    nInput.value=entry.note||'';
    fields[`${key}_planned`]=pInput;fields[`${key}_actual`]=aInput;fields[`${key}_note`]=nInput;
    form.append(E('fieldset',{class:'stay-edit-row'},
      E('legend',{},title),
      E('div',{class:'field-row'},
        E('label',{class:'field',for:pInput.id},'목표 예산 (원)',pInput),
        E('label',{class:'field',for:aInput.id},'실제 지출·계약 견적 (원)',aInput)),
      E('label',{class:'field',for:nInput.id},'세부 메모 (선택)',nInput)));
  }
  const submit=E('button',{class:'button',type:'submit'},'예산 계산기 저장');
  form.append(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextPlan={};
      for(const [key] of WEDDING_BUDGET_CATEGORIES){
        const pRaw=fields[`${key}_planned`].value.trim();
        const aRaw=fields[`${key}_actual`].value.trim();
        const note=fields[`${key}_note`].value.trim();
        const planned=pRaw===''?null:Math.round(Number(pRaw));
        const actual=aRaw===''?null:Math.round(Number(aRaw));
        if(planned!==null||actual!==null||note){
          nextPlan[key]={planned,actual,...(note?{note}:{})};
        }
      }
      const saved=await queuePreference(()=>savePrefs({...prefs,budgetPlan:nextPlan}));
      if(saved){closeDialog();render();toast('결혼 준비 예산 계산기를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  const snapshot=()=>JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k,node])=>[k,node.value])));
  const initial=snapshot();
  if(showDialog('결혼 준비 통합 예산 계산기 편집',form))editorState={isDirty:()=>saving||snapshot()!==initial,isSaving:()=>saving};
}
function renderBudgetCalculator(){
  if(guestMode)return null;
  const plan=prefs.budgetPlan||{};
  const rows=WEDDING_BUDGET_CATEGORIES.map(([key,title,cls,desc])=>{
    const item=plan[key]||{planned:null,actual:null,note:''};
    return {key,title,cls,desc,planned:item.planned??null,actual:item.actual??null,note:item.note||''};
  });
  const budget=weddingBudgetSummary(plan,WEDDING_BUDGET_CATEGORIES.map(([key])=>key));
  const totalPlanned=budget.planned.known;
  const hasAny=rows.some(r=>r.planned!==null||r.actual!==null||r.note);
  const diff=budget.difference;
  return E('section',{class:'wedding-budget-calc','aria-labelledby':'wedding-budget-title'},
    E('div',{class:'section-heading'},
      E('div',{},
        E('p',{class:'eyebrow'},'PRIVATE BUDGET PLANNER'),
        E('h2',{id:'wedding-budget-title'},'결혼 준비 통합 예산 계산기'),
        E('p',{},'웨딩홀·스드메·본식·예물·신혼여행·혼수 6대 항목의 목표 예산과 실제 지출을 이 기기에서 한눈에 관리하세요.')),
      E('div',{class:'page-actions'},
        button(hasAny?'예산 입력·수정':'첫 예산표 작성하기',openBudgetEditor,'button quiet'))),
    hasAny?E('div',{class:'budget-calc-body'},
      E('div',{class:'budget-summary-cards'},
        E('div',{class:'budget-stat-card'},E('span',{class:'small muted'},`목표 예산 ${budget.planned.complete?'합계':'입력 소계'}`),E('strong',{},totalPlanned===null?'미입력':won(totalPlanned))),
        E('div',{class:'budget-stat-card'},E('span',{class:'small muted'},`실제 지출·계약 ${budget.actual.complete?'합계':'입력 소계'}`),E('strong',{},budget.actual.known===null?'미입력':won(budget.actual.known))),
        E('div',{class:'budget-stat-card'+(diff!==null&&diff<0?' over':'')},E('span',{class:'small muted'},'예산 대비 잔액·차액'),E('strong',{},diff===null?'미확인':diff>=0?`여유 ${won(diff)}`:`초과 ${won(-diff)}`))),
      E('p',{class:'form-note'},`목표 ${budget.planned.entered}/6개 · 실제·견적 ${budget.actual.entered}/6개 입력. 미입력: 목표 ${budget.planned.missing}개 · 실제·견적 ${budget.actual.missing}개. 빈칸은 0원이 아닙니다. 6대 항목의 목표와 실제·견적이 모두 입력되어야 차액을 계산합니다. 없는 비용은 확인 후 0을 입력해 주세요.`),
      totalPlanned>0?E('div',{class:'trip-budget-visual'},
        E('div',{class:'budget-visual-head'},E('span',{class:'small muted'},'목표 예산 항목별 비중'),E('strong',{class:'small'},`총 ${won(totalPlanned)}`)),
        E('div',{class:'budget-bar-track','aria-hidden':'true'},
          rows.filter(r=>r.planned>0).map(r=>{
            const pct=Math.max(4,Math.round((r.planned/totalPlanned)*100));
            return E('span',{class:`budget-seg ${r.cls}`,style:`width:${pct}%`,title:`${r.title}: ${won(r.planned)}`});
          })),
        E('div',{class:'budget-legend budget-legend-6'},
          rows.map(r=>E('span',{class:'legend-item'},
            E('span',{class:`legend-dot ${r.cls}`,'aria-hidden':'true'}),
            E('span',{class:'legend-label'},r.title.replace(/^[^\s]+\s*/,'')),
            E('strong',{class:'legend-val'},r.planned===null?'미입력':`${Math.round(r.planned/10000).toLocaleString('ko-KR')}만`))))):null,
      E('div',{class:'budget-category-grid'},rows.map(r=>E('article',{class:'budget-cat-card'},
        E('strong',{class:'budget-cat-title'},r.title),
        E('dl',{class:'budget-cat-dl'},
          E('dt',{},'목표 예산'),E('dd',{},r.planned===null?'미입력':won(r.planned)),
          E('dt',{},'실제·견적'),E('dd',{},r.actual===null?'미입력':won(r.actual))),
        r.note?E('p',{class:'small muted'},r.note):E('p',{class:'small muted'},r.desc))))):
    E('div',{class:'budget-empty-prompt'},
      E('p',{class:'small muted'},'아직 입력한 결혼 예산 항목이 없습니다. 오른쪽 위의 ‘첫 예산표 작성하기’ 버튼을 눌러 신혼여행 계획예산과 웨딩홀·스드메 예산을 함께 정리해 보세요.')),
    renderVenueSimulator(),
    renderSdmSimulator());
}
function openVendorScheduleEditor(existing=null){
  if(guestMode)return;
  const isEdit=Boolean(existing&&existing.id);
  const form=E('form',{class:'editor-form'});
  form.append(E('p',{class:'form-note'},'업체 일정·촬영일·피팅·잔금 예정일은 이 기기의 개인 설정에만 저장되며 방문자용 화면이나 공개 저장소에는 노출되지 않습니다. 계좌번호·주민등록번호·비밀번호 등 민감 정보는 입력하지 마세요.'));
  const catSelect=E('select',{id:'vendor-sched-cat'},VENDOR_CATEGORIES.map(c=>E('option',{value:c},c)));
  if(isEdit&&VENDOR_CATEGORIES.includes(existing.category))catSelect.value=existing.category;
  const nameInput=E('input',{type:'text',maxlength:'120',id:'vendor-sched-name',required:'true',placeholder:'예: 라크마 스튜디오 웨딩촬영 (낮 12시) / 드레스 가봉 / 본식스냅 잔금'});
  nameInput.value=existing?.name||'';
  const dateInput=E('input',{type:'date',id:'vendor-sched-date'});
  dateInput.value=existing?.date||'';
  const doneCheck=E('input',{type:'checkbox',id:'vendor-sched-done'});
  doneCheck.checked=Boolean(existing?.done);
  const noteInput=E('textarea',{rows:'3',maxlength:'500',id:'vendor-sched-note',placeholder:'예: 2/3(수) 12:00 촬영 · 08:30 메이크업 샵 집결 · 헬퍼비 봉투 및 생화 부케 지참'});
  noteInput.value=existing?.note||'';
  form.append(
    E('div',{class:'field-row'},
      E('label',{class:'field',for:catSelect.id},'일정·업체 분류',catSelect),
      E('label',{class:'field',for:dateInput.id},'예정 날짜 (선택)',dateInput)),
    E('label',{class:'field',for:nameInput.id},'업체·일정 이름',nameInput),
    E('label',{class:'field',for:noteInput.id},'일정·준비물·정산 메모 (선택)',noteInput),
    E('label',{class:'check-label',for:doneCheck.id},doneCheck,'완료됨 (촬영·투어·정산 완료 표시)'),
    E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),E('button',{class:'button',type:'submit'},isEdit?'일정 저장':'일정 추가'))
  );
  const submit=form.querySelector('[type="submit"]');let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;
    const name=nameInput.value.trim();if(!name)return;
    const curList=activeVendorSchedules();
    if(!isEdit&&curList.length>=60){toast('업체·촬영 일정은 60개까지 등록할 수 있습니다.',true);return;}
    const id=isEdit?existing.id:'vsched-'+crypto.randomUUID().slice(0,8);
    const entry={id,category:catSelect.value,name,date:dateInput.value||'',done:doneCheck.checked,note:noteInput.value.trim()};
    const nextList=isEdit?curList.map(v=>v.id===id?entry:v):[...curList,entry];
    saving=true;submit.disabled=true;
    try{
      const saved=await queuePreference(()=>savePrefs({...prefs,vendorSchedules:nextList}));
      if(saved){closeDialog();render();toast(isEdit?'업체·촬영 일정을 수정했습니다.':'업체·촬영 일정을 추가했습니다.');}
    }catch(error){toast(storageMessage(error),true);}finally{saving=false;submit.disabled=false;}
  });
  const snapshot=()=>JSON.stringify([catSelect.value,nameInput.value,dateInput.value,doneCheck.checked,noteInput.value]),initial=snapshot();
  if(showDialog(isEdit?'주요 업체·촬영·잔금 일정 수정':'주요 업체·촬영·잔금 일정 추가',form))editorState={isDirty:()=>saving||snapshot()!==initial,isSaving:()=>saving};
}
function renderVendorScheduleBoard(){
  if(guestMode)return null;
  const list=activeVendorSchedules();
  const sorted=[...list].sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    if(a.date&&b.date)return a.date.localeCompare(b.date);
    if(a.date)return -1;
    if(b.date)return 1;
    return 0;
  });
  const doneCount=list.filter(v=>v.done).length;
  const toggleDone=(item,box)=>{
    const nextList=activeVendorSchedules().map(v=>v.id===item.id?{...v,done:box.checked}:v);
    queuePreference(async()=>{
      const saved=await savePrefs({...prefs,vendorSchedules:nextList});
      if(saved)render();
      else box.checked=item.done;
      return saved;
    });
  };
  return E('section',{class:'vendor-schedule-board','aria-labelledby':'vendor-schedule-title'},
    E('div',{class:'section-heading'},
      E('div',{},
        E('p',{class:'eyebrow'},'VENDOR & SHOOT SCHEDULE BOARD'),
        E('h2',{id:'vendor-schedule-title'},'📅 주요 업체 일정 · 촬영 · 잔금 체크 보드'),
        E('p',{},'스튜디오 촬영일(2/3 수 12:00 라크마 확정), 드레스 피팅·가봉, 웨딩홀 시식·최종 보증인원 확정, 본식스냅 잔금 등 주요 일정을 날짜순으로 관리합니다. (이 기기에만 저장 · 계좌번호·주민번호 등 민감 정보 입력 금지)')),
      E('div',{class:'page-actions'},
        E('span',{class:'badge'},`${doneCount}/${list.length} 완료`),
        button('+ 일정 추가',()=>openVendorScheduleEditor(),'button quiet'))),
    sorted.length?E('ul',{class:'vendor-schedule-list'},sorted.map(item=>{
      const dday=item.date?weddingDday(item.date):null;
      const box=E('input',{type:'checkbox','aria-label':`${item.name} 완료 표시`});
      box.checked=Boolean(item.done);
      box.addEventListener('change',()=>toggleDone(item,box));
      const isLachmaShoot=item.id==='vsched-lachma-shoot';
      const calSpec=item.date?{
        uid:item.id||'vendor',
        summary:`[결혼준비] ${item.name}`,
        date:item.date,
        time:isLachmaShoot?'12:00':'',
        location:isLachmaShoot?'광주광역시 남구 중앙로 117 라크마 스튜디오':'',
        description:[
          `분류: ${item.category}`,
          isLachmaShoot&&!(item.note||'').includes('중앙로 117')?'STEP 1 루나메이크업(광주 남구 천변좌로 432 1층) → STEP 2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수)':'',
          item.note||''
        ].filter(Boolean).join('\n')
      }:null;
      const gcalUrl=calSpec?scheduleGoogleCalendarUrl(calSpec):null;
      return E('li',{class:'vendor-schedule-item'+(item.done?' done':'')},
        E('div',{class:'vendor-schedule-main'},
          E('label',{class:'vendor-schedule-check'},box),
          E('div',{class:'vendor-schedule-info'},
            E('div',{class:'vendor-schedule-top'},
              E('span',{class:'spec-chip'},item.category),
              item.date?E('span',{class:'spec-chip highlight'},`🗓️ ${formatDate(item.date)}`):E('span',{class:'spec-chip'},'날짜 미정'),
              dday&&!item.done?E('span',{class:'spec-chip direct'},`⏳ ${dday}`):null,
              item.done?E('span',{class:'spec-chip'},'✓ 완료'):null),
            E('strong',{class:'vendor-schedule-name'},item.name),
            item.note?E('p',{class:'small muted vendor-schedule-note'},item.note):null)),
        E('div',{class:'vendor-schedule-actions'},
          gcalUrl?externalLink('📅 Google 캘린더 ↗',gcalUrl,'checklist-note-btn'):null,
          calSpec?button('📥 .ics',()=>{
            try{
              const ics=scheduleCalendar(calSpec);
              downloadText(ics,`${item.id||'vendor-schedule'}.ics`,'text/calendar;charset=utf-8');
              toast(`‘${item.name}’ 일정 파일(.ics)을 다운로드했습니다.`);
            }catch(error){toast(error.message,true);}
          },'checklist-note-btn'):null,
          button('수정',()=>openVendorScheduleEditor(item),'checklist-note-btn'),
          button('삭제',()=>{
            if(!confirm(`‘${item.name}’ 일정을 삭제할까요?`))return;
            queuePreference(async()=>{
              const nextList=activeVendorSchedules().filter(v=>v.id!==item.id);
              const saved=await savePrefs({...prefs,vendorSchedules:nextList});
              if(saved){render();toast('일정을 삭제했습니다.');}
              return saved;
            });
          },'checklist-note-btn danger-text')));
    })):E('p',{class:'small muted'},'등록된 업체·촬영 일정이 없습니다. 오른쪽 위 ‘+ 일정 추가’ 버튼으로 주요 일정을 기록해 보세요.'));
}
function renderCeremony(){
  return renderCeremonyModule(moduleCtx());
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
function openTipNoteModal(item){
  if(guestMode)return;
  const form=E('form',{class:'editor-form'});
  const currentNote=prefs.tipNotes?.[item.id]||'';
  const input=E('textarea',{rows:'3',id:'tip-note-input',maxlength:'500',placeholder:'예: 드레스 투어 때 실크 2벌·비즈 2벌 피팅 요청하기'});
  input.value=currentNote;
  form.append(E('p',{class:'form-note'},`‘${item.title}’ 꿀팁에서 우리 결혼 준비에 적용할 내용을 이 기기에만 메모합니다. 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.`),
    E('label',{class:'field',for:input.id},'꿀팁 실천 메모',input));
  const submit=E('button',{class:'button',type:'submit'},'실천 메모 저장');
  form.append(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;submit.disabled=true;
    try{
      const nextNotes={...(prefs.tipNotes||{})};
      if(input.value.trim())nextNotes[item.id]=input.value.trim();else delete nextNotes[item.id];
      const saved=await queuePreference(()=>savePrefs({...prefs,tipNotes:nextNotes}));
      if(saved){closeDialog();render();toast('꿀팁 실천 메모를 저장했습니다.');}
    }catch(error){toast(error.message,true);}finally{saving=false;submit.disabled=false;}
  });
  if(showDialog('꿀팁 실천 메모 편집',form))editorState={isDirty:()=>saving||input.value!==currentNote,isSaving:()=>saving};
}
function renderTips(){
  if(guestMode)return guestRestrictedView('결혼에 관한 모든 정보','신랑·신부의 결혼 준비 예산·일정·꿀팁을 관리하는 공간입니다.','WEDDING GUIDE');
  const categories=['all',...new Set(content.tips.map(item=>item.category||'기타'))];
  if(!categories.includes(tipCategory))tipCategory='all';
  const search=E('input',{type:'search',id:'tip-search',placeholder:'꿀팁 제목·분야·핵심 키워드 검색','aria-label':'결혼 정보 꿀팁 검색'});search.value=tipFilter;
  const favCheck=E('input',{type:'checkbox',id:'tip-favorites-only'});favCheck.checked=tipFavoritesOnly;
  const noteCheck=E('input',{type:'checkbox',id:'tip-notes-only'});noteCheck.checked=withTipNoteOnly;
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
      const hasYt= Boolean(youtubeVideoId(item.url));
      const note=!guestMode?(prefs.tipNotes?.[item.id]||''):'';
      return E('article',{class:'tip-card','data-record-id':item.id},
        E('div',{class:'card-heading'},
          E('div',{class:'tip-meta'},E('span',{class:'badge'},item.category||'결혼 꿀팁'),E('span',{class:'small muted'},`#${String(num).padStart(2,'0')}${item.channel?` · ${item.channel}`:''}`)),
          tipFavoriteButton(item)),
        youtubeThumbBanner(item.url,item.title),
        E('h2',{},item.title),
        item.body?E('p',{class:'record-body'},item.body):null,
        note?E('p',{class:'checklist-item-note small tip-private-note'},`📝 실천 메모: ${note}`):null,
        E('div',{class:'tip-actions'},
          E('div',{class:'tip-link-group'},
            hasYt?button('▶ 앱 내 재생',()=>openYoutubeModal(item.url,item.title),'button'):null,
            externalLink(isYoutubeUrl(item.url)?'유튜브 새 탭 ↗':'참고 링크 열기 ↗',item.url,'button quiet'),
            !guestMode?button(note?'📝 메모 수정':'📝 메모',()=>openTipNoteModal(item),'button quiet'):null),
          recordActions('tips',item)));
    }):[E('p',{class:'no-results'},tipFavoritesOnly&&!withTipNoteOnly?'등록한 관심 꿀팁이 없습니다.':withTipNoteOnly&&!tipFavoritesOnly?'실천 메모를 남긴 꿀팁이 없습니다.':'검색 조건에 맞는 결혼 정보 꿀팁이 없습니다.')]));
  };
  search.addEventListener('input',()=>{tipFilter=search.value;draw();});
  favCheck.addEventListener('change',()=>{tipFavoritesOnly=favCheck.checked;draw();});
  noteCheck.addEventListener('change',()=>{withTipNoteOnly=noteCheck.checked;draw();});
  redrawTips=draw;draw();
  return [pageHeader('결혼에 관한 모든 정보','상견례·웨딩홀·스드메·본식부터 예산·신혼집까지, 꼭 알아두면 좋은 결혼식 꿀팁 유튜브 영상과 핵심 요약을 모았어요.',editButton('꿀팁 추가',()=>openEditor('tips')),'WEDDING GUIDE'),
    renderBudgetCalculator(),
    renderVendorScheduleBoard(),
    content.tips.length?E('section',{class:'tips-directory'},
      catBar,
      E('div',{class:'directory-controls'},search,E('div',{class:'directory-filters'},guestMode?null:E('label',{class:'check-label',for:'tip-favorites-only'},favCheck,'관심 꿀팁만 보기'),guestMode?null:E('label',{class:'check-label',for:'tip-notes-only'},noteCheck,'📝 메모 남긴 꿀팁만 보기'),count)),
      grid):
    empty('첫 결혼 준비 꿀팁을 남겨 볼까요?','도움이 되었던 유튜브 영상이나 체크리스트를 추가해 둘 수 있어요.','꿀팁 추가하기',()=>openEditor('tips'))];
}
function render() {
  syncNavVisibility();
  syncGuestChrome();
  const route=currentRoute();
  if(route!=='invitation'){stopInvitationBgm();stopInvitationCountdown();activeCountdownSlot=null;}
  const renderers={home:renderHome,invitation:renderInvitation,story:renderStories,albums:renderAlbums,studios:renderStudios,honeymoon:renderHoneymoon,ceremony:renderCeremony,tips:renderTips};
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
const fieldSpecs={
  invitation:[['partner1','첫 번째 이름'],['partner2','두 번째 이름'],['groomParents','신랑 측 혼주 표기 (선택, 예: 홍길동 · 김영희 의 장남)'],['brideParents','신부 측 혼주 표기 (선택, 예: 이철수 · 박미영 의 차녀)'],['date','예식 날짜','date'],['time','예식 시간','time'],['venue','예식장·홀 이름'],['address','주소'],['mapUrl','지도 링크','url'],['venueMapImage','오시는 길 약도 이미지 주소 (선택)'],['message','초대 인사','textarea'],['transit','오시는 길 · 교통·주차 안내 (선택)','textarea'],['notice','예식 안내 메모 (식사·포토부스·축의 등, 선택)','textarea'],['contacts','연락처 안내 (선택, 한 줄에 하나씩 · 전화번호 입력 시 전화·문자 버튼 표시)','textarea'],['groomAccounts','신랑 측 계좌번호 안내 (선택, 한 줄에 하나씩)','textarea'],['brideAccounts','신부 측 계좌번호 안내 (선택, 한 줄에 하나씩)','textarea'],['rsvpUrl','참석 여부(RSVP) · 축하 메시지 설문 링크 (선택, Google Forms 등 https:// 주소)','url']],
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
  body.append(E('p',{class:'form-note'},'실제 조회한 성인 2명·인천·일반석·객실 1실 견적만 기록하세요. 항공·숙박의 조회 근거와 한국 출발·도착 시각, 기타 여행비까지 입력합니다. 항공권이 통합된 패키지 견적은 항공 실제 견적에 0을 입력하고 숙박·패키지 실제 견적에 2인 패키지 총액을 기록할 수 있습니다. 예비비는 현재 계획 배분을 더하며 예약 확정을 뜻하지 않습니다.'));
  let confirmedBasis=original.basis;
  const matches=()=>JSON.stringify(quoteBasis(currentTrip()))===JSON.stringify(confirmedBasis);
  const included=E('input',{type:'checkbox',id:'quote-included'});
  const invalidate=()=>{if(!matches())included.checked=false;};
  body.append(button('📦 패키지 통합 견적 (항공 0원 채우기)',()=>{
    fields.quote_airfare.value='0';
    invalidate();
    fields.quote_lodging.focus({preventScroll:true});
    toast('항공 실제 견적에 0원(패키지 통합 포함)을 채웠습니다. 숙박·패키지 실제 견적에 2인 통합 견적가를 입력해 주세요.');
  },'button quiet'));
  const specs=[...['airfare','lodging','other'].map(key=>[key,`${COST_LABELS[key]} 실제 견적 (원)`,'number',original.costs[key]??'']),
    ['checkedOn','견적 조회일','date',original.checkedOn],['flightSource','항공 견적 근거·편명·포함 조건','textarea',original.flightSource],['lodgingSource','숙박 견적 근거·객실·포함 조건','textarea',original.lodgingSource],
    ['departureAt','견적 항공편 한국 출발 시각','datetime-local',original.departureAt],['arrivalAt','견적 항공편 한국 도착 시각','datetime-local',original.arrivalAt]];
  for(const [key,label,type,value] of specs){
    const input=type==='textarea'?E('textarea',{rows:'3',maxlength:'2000'}):E('input',{type});input.id='quote-'+key;input.value=value;
    if(type==='number'){input.min='0';input.step='1';}
    fields['quote_'+key]=input;body.append(E('label',{class:'field',for:input.id},label,input));
  }
  included.checked=original.includesRequiredCosts&&matches();fields.quote_included=included;
  included.addEventListener('change',()=>{if(included.checked)confirmedBasis=quoteBasis(currentTrip());});
  form.addEventListener('input',event=>{if(event.target!==included)invalidate();});form.addEventListener('click',event=>{if(event.target.closest('button'))invalidate();});
  body.append(E('label',{class:'quote-check',for:included.id},included,'현재 여행 날짜·숙박 구성의 견적이며 세금·수하물·식사·공항 및 지역 이동비를 포함해 확인했습니다.'));
  form.append(E('details',{class:'quote-editor'},E('summary',{},'실제 견적·항공편 기록 (선택)'),body));
  const read=()=>({...original,costs:Object.fromEntries(['airfare','lodging','other'].map(key=>[key,fields['quote_'+key].value===''?null:Number(fields['quote_'+key].value)])),
    ...Object.fromEntries(['checkedOn','flightSource','lodgingSource','departureAt','arrivalAt'].map(key=>[key,fields['quote_'+key].value.trim()])),includesRequiredCosts:included.checked&&matches(),basis:confirmedBasis});
  return {read};
}
function planExtraEditor(form,fields,plan){
  const body=E('div',{class:'quote-editor-body'});
  const monthSelect=E('select',{id:'plan-climateMonth','aria-label':'기후 기준 월'},[['','미입력'],...Array.from({length:12},(_,i)=>[String(i+1),`${i+1}월`])].map(([value,label])=>E('option',{value},label)));
  monthSelect.value=plan.climateMonth===null||plan.climateMonth===undefined?'':String(plan.climateMonth);
  fields.plan_climateMonth=monthSelect;
  const categorySelect=E('select',{id:'plan-climateCategory','aria-label':'기후 요약 분류 (기준 월 자료 확인 후 선택)'},[['','미분류'],...Object.entries(CLIMATE_CATEGORIES)].map(([value,label])=>E('option',{value},label)));
  categorySelect.value=plan.climateSummary&&plan.climateSummary.month===plan.climateMonth?plan.climateSummary.category:'';
  fields.plan_climateCategory=categorySelect;
  const originalCategory=categorySelect.value;
  let categoryTouched=false;
  categorySelect.addEventListener('change',()=>{categoryTouched=true;});
  monthSelect.addEventListener('change',()=>{categorySelect.value='';categoryTouched=true;});
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
  body.append(E('label',{class:'field',for:categorySelect.id},'기후 요약 분류 (기준 월 자료 확인 후 선택)',categorySelect),E('p',{class:'small muted'},'기후 본문의 단어로 분류를 추측하지 않습니다. 기준 월을 바꾸면 분류를 다시 선택해 주세요.'));
  const read=()=>{
    const next={};
    for(const key of ['experiences','comparisonNote','climate','sourceTitle','sourceUrl','checkedOn','budgetNotes','researchNotes']){
      const raw=fields[`plan_${key}`].value;
      if(raw!==initialValues[key])next[key]=raw.trim();
    }
    if(monthSelect.value!==initialValues.climateMonth)next.climateMonth=monthSelect.value===''?null:Number(monthSelect.value);
    if(categoryTouched||categorySelect.value!==originalCategory){
      if(categorySelect.value&&!monthSelect.value)throw new Error('기후 요약 분류의 기준 월을 먼저 입력해 주세요.');
      next.climateSummary=categorySelect.value?{month:Number(monthSelect.value),category:categorySelect.value}:null;
    }
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
    if(key==='groomParents'||key==='brideParents')input.maxLength=200;
    if(key==='transit'||key==='notice'||key==='contacts'||key==='groomAccounts'||key==='brideAccounts')input.maxLength=2000;
    fields[key]=input;form.appendChild(E('label',{class:'field',for:input.id},label,input));
  }
  let albumImages=[...(item?.images||[])], processing=false, saving=false;
  const submit=E('button',{class:'button',type:'submit'},'초안에 저장');
  if(type==='invitation'){
    const mapPreview=E('div',{class:'photo-editor'});
    const drawVenueMap=()=>{
      const src=safeUrl(fields.venueMapImage.value.trim(),{image:true});
      mapPreview.replaceChildren(...(src?[E('div',{class:'photo-edit-card'},image(src,'오시는 길 약도 미리보기'),E('p',{},'등록할 예식장 약도'),
        E('div',{class:'photo-edit-actions'},button('약도 이미지 삭제',()=>{fields.venueMapImage.value='';drawVenueMap();fields.venueMapImage.focus({preventScroll:true});},'button danger')))]:[]));
    };
    fields.venueMapImage.addEventListener('input',drawVenueMap);
    const mapFileInput=E('input',{type:'file',accept:'image/jpeg,image/png,image/webp',class:'file-input','aria-label':'예식장 약도 이미지 파일 선택'});
    mapFileInput.addEventListener('change',async()=>{
      const file=mapFileInput.files?.[0];if(!file)return;
      processing=true;submit.disabled=true;mapFileInput.disabled=true;
      try{
        const added=await shrinkPhoto(file);
        if(!form.isConnected||!dialog.open)return;
        fields.venueMapImage.value=added;drawVenueMap();
        toast('예식장 약도 이미지를 초안용 크기로 줄여 등록했습니다.');
      }catch(error){toast(error.message,true);}finally{processing=false;submit.disabled=false;mapFileInput.disabled=false;mapFileInput.value='';}
    });
    const mapFieldWrap=fields.venueMapImage.closest('label');
    const mapUploadBlock=E('div',{class:'venue-map-editor-block'},
      E('label',{class:'field'},'예식장 약도 이미지 파일 선택 (선택)',mapFileInput),
      E('p',{class:'small muted'},'약도 이미지를 올리면 청첩장 오시는 길(LOCATION) 섹션에 크게 보기 약도가 표시됩니다. 비워 두면 약도 영역이 자동으로 숨겨집니다.'),
      mapPreview);
    if(mapFieldWrap&&mapFieldWrap.parentNode===form)mapFieldWrap.after(mapUploadBlock);
    else form.append(mapUploadBlock);
    drawVenueMap();
    const templates=[
      ['정중한 기본형','서로가 마주보며 다져온 사랑을\n이제 함께 한곳을 바라보며 걸어갈 수 있는\n큰 사랑으로 키우고자 합니다.\n저희 두 사람이 사랑의 이름으로 지켜나갈 수 있도록\n앞날을 축복해 주시면 감사하겠습니다.'],
      ['따뜻한 감성형','함께 있을 때 가장 나다운 모습이 되고,\n함께일 때 내일이 더 기대되는 사람을 만났습니다.\n풋풋한 설렘으로 시작해 믿음으로 깊어진 저희 두 사람,\n이제 부부라는 이름으로 첫걸음을 내딛습니다.\n소중한 걸음으로 따뜻한 축복을 더해 주세요.'],
      ['담백한 현대형','평생을 함께하고 싶은 사람을 만나\n새로운 시작을 하려 합니다.\n귀한 걸음으로 오셔서\n저희의 기쁜 날을 함께 축복해 주시면\n더없는 기쁨으로 간직하겠습니다.']
    ];
    const presetMessages=new Set(templates.map(([,t])=>t));
    const defaultTransit='· 자가용: 내비게이션 ‘순천아모르웨딩컨벤션’ 또는 ‘압곡길 94’ 검색 (웨딩홀 전용 주차장 이용)\n· KTX/기차: 순천역 하차 후 택시 이용\n· 고속/시외버스: 순천종합버스터미널 하차 후 택시 이용';
    const defaultNotice='· 하객석 안내: 예식홀 내 사회자 단상이 있는 쪽이 신랑 측, 반대쪽이 신부 측 좌석입니다.\n· 식사 안내: 예식 시작 30분 전부터 연회장에서 식사가 가능합니다.\n· 주차 안내: 웨딩홀 전용 주차장을 무료로 이용하실 수 있습니다.\n· 화환 안내: 축하 화환은 정중히 사양하며 따뜻한 마음만 감사히 받겠습니다.';
    form.appendChild(E('div',{class:'greeting-templates'},
      E('span',{class:'small muted'},'✨ 초대 인사 추천 문구 및 교통·예식 안내 빠른 채우기:'),
      E('div',{class:'greeting-template-buttons'},
        ...templates.map(([label,text])=>button(label,()=>{
          const cur=fields.message.value.trim();
          if(cur&&!presetMessages.has(cur)&&!confirm('현재 입력된 초대 인사를 선택한 추천 문구로 바꿀까요?'))return;
          fields.message.value=text;
          fields.message.focus({preventScroll:true});
          toast(`‘${label}’ 문구를 초대 인사 입력란에 채웠습니다. 자유롭게 다듬어 보세요.`);
        },'button quiet')),
        button('🚗 순천아모르웨딩컨벤션 기본 교통·주차 문구 채우기',()=>{
          const cur=fields.transit.value.trim();
          if(cur&&cur!==defaultTransit&&!confirm('현재 입력된 교통·주차 안내를 기본 문구로 바꿀까요?'))return;
          fields.transit.value=defaultTransit;
          fields.transit.focus({preventScroll:true});
          toast('기본 교통·주차 안내 문구를 입력란에 채웠습니다.');
        },'button quiet'),
        button('📌 기본 식사·예식 안내 예시 채우기',()=>{
          const cur=fields.notice.value.trim();
          if(cur&&cur!==defaultNotice&&!confirm('현재 입력된 예식 안내 메모를 기본 예시 문구로 바꿀까요?'))return;
          fields.notice.value=defaultNotice;
          fields.notice.focus({preventScroll:true});
          toast('기본 식사·예식 안내 예시 문구를 채웠습니다. 예식홀 조건에 맞게 수정해 주세요.');
        },'button quiet'))));
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
    form.append(E('p',{class:'form-note'},'총액과 항목 배분은 별도로 입력합니다. 차이는 미배분 또는 배분 초과로 표시하며 임의로 비용을 채우지 않습니다. 항공권이 통합된 패키지 상품은 항공 배분에 0을 입력하고 숙박·패키지 배분에 2인 상품가를 적을 수 있으며, 제목 앞에 [여행사명]을 붙이면 패키지 배지와 여행사 필터에 자동 반영됩니다.'));
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
  if(type==='stories'){
    const storyGuides=[
      ['🌱 첫 만남','우리가 처음 만난 날','처음 만났던 장소와 첫인상, 그때 나눴던 대화와 분위기를 자유롭게 적어 보세요.'],
      ['💬 기억에 남는 데이트','가장 기억에 남는 데이트','계절과 장소, 함께 먹었던 음식, 두 사람이 함께 크게 웃었던 순간을 남겨 보세요.'],
      ['✈️ 함께한 여행','둘이서 함께 떠난 여행','여행지에서 마주한 풍경과 에피소드, 서로에게 새롭게 발견한 든든한 모습을 기록해 보세요.'],
      ['💍 결혼을 결심한 순간','평생을 함께하기로 결심한 순간','이 사람과 평생을 함께하고 싶다고 느꼈던 따뜻한 순간이나 프러포즈의 기억을 적어 보세요.'],
      ['🏠 우리의 다짐','부부로서 시작하는 우리의 다짐','2027년 6월 5일 예식을 앞두고, 앞으로 어떤 부부로 살아가고 싶은지 서로에게 남기는 다짐을 적어 보세요.']
    ];
    const presetTitles=new Set(storyGuides.map(([,t])=>t));
    const presetBodies=new Set(storyGuides.map(([,,g])=>g));
    form.appendChild(E('div',{class:'greeting-templates'},
      E('span',{class:'small muted'},'💡 이야기 주제 가이드 (클릭하면 제목과 작성 가이드가 채워집니다):'),
      E('div',{class:'greeting-template-buttons'},
        ...storyGuides.map(([chip,titleText,guideText])=>button(chip,()=>{
          const curTitle=fields.title.value.trim(),curBody=fields.body.value.trim();
          const hasCustom=(curTitle&&!presetTitles.has(curTitle))||(curBody&&!presetBodies.has(curBody));
          if(hasCustom&&!confirm('현재 작성 중인 내용을 선택한 주제 가이드로 바꿀까요?'))return;
          fields.title.value=titleText;
          fields.body.value=guideText;
          fields.body.focus({preventScroll:true});
          toast(`‘${chip}’ 이야기 가이드를 채웠습니다. 우리만의 이야기로 바꿔 보세요.`);
        },'button quiet')))));
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
  form.appendChild(E('div',{class:'form-actions'},button('취소',requestClose,'button quiet'),submit));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(processing||saving)return;saving=true;submit.disabled=true;
    let attemptedNext,savedId;
    const controlStates=[...form.querySelectorAll('input,textarea,select,button')].map(node=>[node,node.disabled]);
    for(const [node]of controlStates)node.disabled=true;
    try {
      const next=structuredClone(editingContent);const data=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));
      if(type==='invitation'){
        for(const optKey of ['groomParents','brideParents','venueMapImage','transit','notice','contacts','groomAccounts','brideAccounts','rsvpUrl']){
          if(!data[optKey])delete data[optKey];
        }
        next.invitation=data;
      }
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
      await setDraft(next,editingContent,approvedRaw);
      let filterResetNotice=false;
      if(type==='honeymoon'&&savedId){
        const savedTrip=content.honeymoon.find(value=>value.id===savedId);
        if(savedTrip&&hasActiveTripFilters()&&!matchesAllTripFilters(savedTrip)){
          resetTripFilters();
          filterResetNotice=true;
        }
      }
      closeDialog();render();
      if(type!=='invitation')focusRecord(type,savedId);
      toast(filterResetNotice?'이 기기에 초안을 저장했습니다. 방금 저장한 후보를 표시하기 위해 필터를 해제했습니다.':'이 기기에 초안을 저장했습니다.');
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
  const personal=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'개인 메모·선택 백업 선택'});
  personal.addEventListener('change',async()=>{
    const selected=personal.files?.[0];if(!selected)return;
    try{
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
      const next=parsePreferencesBackup(await selected.text());
      if(!confirm('이 기기의 라크마 촬영 메모·준비물 체크, 여행·꿀팁 선택과 메모, 결혼 준비 체크리스트, 통합 예산, 웨딩홀·스드메 시뮬레이터, 업체 일정 보드, 본식 식순·낭독문 체크, 하객 명단·축의금 장부, 출국 준비물을 백업 내용으로 바꿀까요?'))return;
      if(await savePrefs(next,validatePreferences({}),readStorage(PREF_KEY))){closeDialog();render();toast('개인 메모와 선택, 체크리스트·예산·일정·식순·하객·축의금 장부 설정을 복원했습니다.');}
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
  showDialog('내용 관리',E('div',{},E('p',{class:'form-note'},'공개본은 저장소의 콘텐츠입니다. 여기서 편집한 내용은 이 기기에만 저장되며 자동으로 공개되지 않습니다.'),
    E('section',{class:'manager-section storage-meter-section'},
      E('h3',{},'브라우저 저장 공간 현황'),
      E('p',{class:'small muted'},`현재 사용량 약 ${fmtSize(totalBytes)} / 권장 한도 5.00 MB (${pct}%) · 초안 ${fmtSize(draftBytes)} · 개인 설정·메모 ${fmtSize(prefBytes)}`),
      E('div',{class:'checklist-progress-track storage-meter-track','aria-hidden':'true'},
        E('span',{class:'checklist-progress-fill',style:`width:${pct}%`}))),
    E('section',{class:'manager-section'},E('h3',{},'개인 메모·선택 백업'),E('p',{},'라크마 스튜디오 메모·촬영 준비물 체크, 여행 관심·비교·최종 선택·상담 메모, 관심 꿀팁·실천 메모, 결혼 준비 체크리스트·할 일 메모·통합 예산 계산기·웨딩홀/스드메 시뮬레이터·주요 업체 일정 보드·본식 식순·하객 명단·축의금 장부·출국 짐 체크리스트를 개인 파일로 보관합니다. 콘텐츠 초안과 사진은 공개용 파일 저장으로 따로 백업하세요. 개인 백업은 공개 저장소에 올리지 마세요.'),button('개인 백업 저장',downloadPrivate,'button quiet'),personal),
    E('section',{class:'manager-section'},E('h3',{},'방문자용 보기'),E('p',{},'방문자용 링크는 공개본만 표시하며 편집 버튼과 이 기기의 개인 메모·결혼 준비 탭을 숨깁니다. 접근 권한을 제한하는 기능은 아닙니다.'),linkButton('방문자용 청첩장 열기','?view=guest#/invitation',true)),
    isDraft&&draftRevision!==baseRevision?E('section',{class:'manager-section'},E('h3',{},'새 공개본 확인'),E('p',{},'현재 초안을 파일로 백업한 후 새 공개본을 확인하세요. 공개본으로 돌아가면 초안을 지우며 자동으로 합치지 않습니다.'),button('현재 초안 백업',downloadContent,'button quiet'),linkButton('새 공개본 미리보기','?view=guest#/home',true)):null,
    E('section',{class:'manager-section'},E('h3',{},'기본 정보'),E('p',{},'이름, 예식 일정과 장소, 청첩장 인사를 채워요.'),editButton('예식 정보 편집',()=>openEditor('invitation'),'button quiet')),
    E('section',{class:'manager-section'},E('h3',{},'공개할 내용 파일로 저장'),E('p',{},'저장한 site.json 파일은 자동 배포되지 않으며, 저장소의 data/site.json에 반영한 뒤 main 브랜치에 push하면 GitHub Pages에 공개됩니다. 파일에는 청첩장·일대기·앨범·신혼여행·결혼 정보가 담기며, 개인 메모·예산·체크리스트·하객 명단·축의금 장부는 포함되지 않습니다.'),button('공개용 파일 저장',downloadContent)),
    E('section',{class:'manager-section'},E('h3',{},'이전에 저장한 내용 불러오기'),E('p',{},'이 앱에서 저장한 JSON 콘텐츠 파일을 선택해 주세요.'),file),
    E('section',{class:'manager-section'},E('h3',{},'초안을 지우고 공개본 보기'),E('p',{},'이 기기의 콘텐츠 초안만 지웁니다. 라크마 촬영 메모와 여행·예산·체크리스트·하객 명단·축의금 장부 등 개인 설정은 유지됩니다.'),button('공개본으로 돌아가기',async()=>{
      if(!confirm('이 기기의 콘텐츠 초안을 지울까요? 필요한 내용은 먼저 파일로 저장해 주세요.'))return;
      try{
        await navigator.locks.request(`wedding-storage:${DRAFT_KEY}`,()=>{
          if(localStorage.getItem(DRAFT_KEY)!==managerRaw)throw new Error('다른 탭에서 초안이 변경되었습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 시도해 주세요.');
          localStorage.removeItem(DRAFT_KEY);
        });
        content=structuredClone(baseContent);syncMemoryPrefs();isDraft=false;draftRevision=baseRevision;closeDialog();render();toast('공개본으로 돌아왔습니다.');
      }catch(error){toast(error.message||'초안을 지우지 못했습니다.',true);}
    },'button danger')),
    E('section',{class:'manager-section'},E('h3',{},'개인 설정·메모 초기화'),E('p',{},'이 기기에 저장된 라크마 촬영 메모·준비물 체크, 여행·꿀팁 관심 및 메모, 결혼 준비 체크리스트, 통합 예산, 웨딩홀·스드메 시뮬레이터, 업체 일정, 본식 식순, 하객 명단, 축의금 장부를 초기 상태로 되돌립니다. 필요한 경우 먼저 ‘개인 백업 저장’을 진행해 주세요.'),button('개인 설정·메모 초기화',async()=>{
      if(!confirm('이 기기의 모든 개인 메모·관심 선택·예산·체크리스트·식순·하객 명단·축의금 장부 설정을 초기화할까요?'))return;
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
if(scrollTopBtn){
  const syncScrollTop=()=>{scrollTopBtn.hidden=window.scrollY<420;};
  window.addEventListener('scroll',syncScrollTop,{passive:true});
  scrollTopBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  syncScrollTop();
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
