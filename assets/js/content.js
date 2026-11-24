import {upgradeLegacyTrip,COST_LABELS,dateSpan,emptyQuote,CLIMATE_CATEGORIES} from './travel.js?v=wedding-features-55';
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, max = 12000) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('내용의 형식이나 길이를 확인해 주세요.');
  return value;
};
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
function date(value) {
  const result = string(value, 10);
  if (result && !validDate(result)) throw new Error('날짜를 확인해 주세요.');
  return result;
}
export function safeUrl(value, { image = false } = {}) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) return '';
  if (image && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const parsed = new URL(value, 'https://wedding.invalid/Wedding/');
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    return value;
  } catch { return ''; }
}
function link(value, image = false) {
  const result = string(value, image ? MAX_IMPORT_BYTES : 4000);
  if (result && !safeUrl(result, { image })) throw new Error('링크 형식을 확인해 주세요. http 또는 https 주소를 사용할 수 있습니다.');
  return result;
}
function list(value, normalize) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('기록 목록의 형식을 확인해 주세요.');
  const result = value.map(normalize);
  const ids = new Set(result.map(item => item.id));
  if (ids.size !== result.length) throw new Error('중복된 기록 ID가 있습니다.');
  return result;
}
function record(value) {
  if (!object(value) || typeof value.id !== 'string' || !/^[\w-]{1,100}$/.test(value.id)) throw new Error('기록 ID를 확인해 주세요.');
  const title = string(value.title, 160).trim();
  if (!title) throw new Error('제목을 입력해 주세요.');
  return { id:value.id, title };
}
function validateQuote(value){
  if(value===undefined)return emptyQuote();
  if(!object(value)||!object(value.costs)||!object(value.basis)||typeof value.includesRequiredCosts!=='boolean')throw new Error('실제 견적 확인 형식을 확인해 주세요.');
  const costs=Object.fromEntries(['airfare','lodging','other'].map(key=>{const amount=value.costs[key];if(amount!==null&&(!Number.isSafeInteger(amount)||amount<0||amount>1000000000000))throw new Error('견적 금액을 확인해 주세요.');return [key,amount];}));
  const instant=raw=>{const v=string(raw,16);if(v&&(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v)||!validDate(v.slice(0,10))))throw new Error('견적 항공편의 한국 시각을 확인해 주세요.');return v;};
  return {costs,checkedOn:date(value.checkedOn),flightSource:string(value.flightSource,2000),lodgingSource:string(value.lodgingSource,2000),departureAt:instant(value.departureAt),arrivalAt:instant(value.arrivalAt),includesRequiredCosts:value.includesRequiredCosts,
    basis:{startDate:date(value.basis.startDate),endDate:date(value.basis.endDate),country:string(value.basis.country,200),stays:string(value.basis.stays,12000)}};
}
function validatePlan(plan,tripDates){
  if(!object(plan)||plan.version!==1||!object(plan.costs)||!Array.isArray(plan.stays)||plan.stays.length>20)throw new Error('여행 계획 형식을 확인해 주세요.');
  const costs=Object.fromEntries(Object.keys(COST_LABELS).map(key=>{
    const value=plan.costs[key];
    if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>1000000000000))throw new Error('비용 배분은 원 단위의 0 이상 금액으로 입력해 주세요.');
    return [key,value];
  }));
  const stays=plan.stays.map(stay=>{
    if(!object(stay)||!Number.isInteger(stay.nights)||stay.nights<1||stay.nights>365)throw new Error('숙박 가안의 박 수를 확인해 주세요.');
    const region=string(stay.region,120).trim();if(!region)throw new Error('숙박 지역을 확인해 주세요.');
    const checkIn=date(stay.checkIn??''),checkOut=date(stay.checkOut??'');
    if(checkIn&&checkOut){
      const nights=dateSpan(checkIn,checkOut);
      if(nights===null||nights<1)throw new Error('체크아웃 날짜는 체크인 날짜 이후로 입력해 주세요.');
      if(nights!==stay.nights)throw new Error('숙박 박 수가 체크인·체크아웃 날짜와 다릅니다.');
    }
    return {region,nights:stay.nights,checkIn,checkOut};
  });
  const climateMonth=plan.climateMonth??null;
  if(climateMonth!==null&&(!Number.isInteger(climateMonth)||climateMonth<1||climateMonth>12))throw new Error('기후 안내 기준 월을 확인해 주세요.');
  const climateSummary=plan.climateSummary??null;
  if(climateSummary!==null&&(!object(climateSummary)||!Number.isInteger(climateSummary.month)||climateSummary.month<1||climateSummary.month>12||!Object.hasOwn(CLIMATE_CATEGORIES,climateSummary.category)))throw new Error('기후 요약 분류와 기준 월을 확인해 주세요.');
  const basis=plan.dateBasis??tripDates;
  if(!object(basis))throw new Error('가안 기준 날짜를 확인해 주세요.');
  const dateBasis={startDate:date(basis.startDate),endDate:date(basis.endDate)};
  if(dateBasis.startDate&&dateBasis.endDate&&dateBasis.startDate>dateBasis.endDate)throw new Error('가안 기준 날짜의 순서를 확인해 주세요.');
  const references=plan.references===undefined?[]:plan.references;
  if(!Array.isArray(references)||references.length>10)throw new Error('여행 조사 출처는 10개까지 입력할 수 있습니다.');
  const checkedReferences=references.map(source=>{
    if(!object(source))throw new Error('여행 조사 출처 형식을 확인해 주세요.');
    const title=string(source.title,200).trim(),url=link(source.url);
    if(!title||!/^https?:\/\//i.test(url))throw new Error('여행 조사 출처의 제목과 전체 주소를 확인해 주세요.');
    return {title,url};
  });
  const narrativeVersion=plan.narrativeVersion??1;
  if(![1,2].includes(narrativeVersion))throw new Error('여행 설명 버전을 확인해 주세요.');
  return {version:1,costs,stays,dateBasis,lodgingNotes:string(plan.lodgingNotes),itinerary:string(plan.itinerary),experiences:string(plan.experiences),transport:string(plan.transport),
    climate:string(plan.climate),climateMonth,climateSummary:climateSummary===null?null:{month:climateSummary.month,category:climateSummary.category},sourceTitle:string(plan.sourceTitle,500),sourceUrl:link(plan.sourceUrl??''),checkedOn:date(plan.checkedOn),budgetNotes:string(plan.budgetNotes),
    researchNotes:string(plan.researchNotes??''),comparisonNote:string(plan.comparisonNote??'',500),references:checkedReferences,
    narrativeVersion,quote:validateQuote(plan.quote),
    ...(plan.legacyText===undefined?{}:{legacyText:string(plan.legacyText)})};
}
export function validateContent(input) {
  if (!object(input) || input.schemaVersion !== 1 || !object(input.invitation)) throw new Error('이 앱에서 저장한 콘텐츠 파일을 선택해 주세요.');
  const source = input.invitation;
  const time = string(source.time, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('예식 시간을 확인해 주세요.');
  const groomParents = source.groomParents === undefined ? '' : string(source.groomParents, 200);
  const brideParents = source.brideParents === undefined ? '' : string(source.brideParents, 200);
  const transit = source.transit === undefined ? '' : string(source.transit, 2000);
  const notice = source.notice === undefined ? '' : string(source.notice, 2000);
  const contacts = source.contacts === undefined ? '' : string(source.contacts, 2000);
  const groomAccounts = source.groomAccounts === undefined ? '' : string(source.groomAccounts, 2000);
  const brideAccounts = source.brideAccounts === undefined ? '' : string(source.brideAccounts, 2000);
  const rsvpUrl = source.rsvpUrl === undefined ? '' : link(source.rsvpUrl);
  const venueMapImage = source.venueMapImage === undefined ? '' : link(source.venueMapImage, true);
  return {
    schemaVersion:1,
    invitation:{
      partner1:string(source.partner1,100), partner2:string(source.partner2,100),
      ...(groomParents?{groomParents}:{}),
      ...(brideParents?{brideParents}:{}),
      date:date(source.date), time,
      venue:string(source.venue,300), address:string(source.address,500),
      mapUrl:link(source.mapUrl), message:string(source.message),
      ...(transit?{transit}:{}),
      ...(notice?{notice}:{}),
      ...(contacts?{contacts}:{}),
      ...(groomAccounts?{groomAccounts}:{}),
      ...(brideAccounts?{brideAccounts}:{}),
      ...(rsvpUrl?{rsvpUrl}:{}),
      ...(venueMapImage?{venueMapImage}:{})
    },
    stories:list(input.stories, item => ({ ...record(item), date:date(item.date), body:string(item.body), image:link(item.image,true) })),
    albums:list(input.albums, item => {
      if (!Array.isArray(item.images) || item.images.length > 100) throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
      return { ...record(item), date:date(item.date), body:string(item.body), images:item.images.map(src => link(src,true)).filter(Boolean) };
    }),
    honeymoon:list(input.honeymoon, item => {
      if (item.budget !== null && (!Number.isSafeInteger(item.budget) || item.budget < 0 || item.budget>1000000000000)) throw new Error('여행 예산은 원 단위의 0 이상 금액으로 입력해 주세요.');
      const startDate=date(item.startDate), endDate=date(item.endDate);
      if (startDate && endDate && startDate > endDate) throw new Error('여행 종료일은 출발일 이후로 입력해 주세요.');
      const trip=upgradeLegacyTrip({ ...record(item), country:string(item.country,200), startDate,endDate,budget:item.budget,pros:string(item.pros),cons:string(item.cons),body:string(item.body),url:link(item.url),...(item.plan===undefined?{}:{plan:item.plan}) });
      return {...trip,...(trip.plan===undefined?{}:{plan:validatePlan(trip.plan,{startDate,endDate})})};
    }),
    tips:list(input.tips ?? [], item => ({
      ...record(item),
      category:string(item.category ?? '', 80).trim(),
      channel:string(item.channel ?? '', 120).trim(),
      body:string(item.body ?? ''),
      url:link(item.url ?? '')
    }))
  };
}
export function parseContent(raw) {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('콘텐츠 파일은 8MB 이하로 선택해 주세요.');
  let parsed;
  try { parsed=JSON.parse(raw); } catch { throw new Error('올바른 JSON 콘텐츠 파일이 아닙니다.'); }
  return validateContent(parsed);
}
export function extractGuestContent(input) {
  const valid = validateContent(input);
  return {
    schemaVersion: 1,
    invitation: valid.invitation,
    stories: valid.stories,
    albums: valid.albums,
    honeymoon: [],
    tips: []
  };
}
export function formatDate(value) {
  if (!validDate(value)) return '';
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(`${value}T12:00:00+09:00`));
}
export function weddingDday(value, today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())) {
  if (!validDate(value) || !validDate(today)) return '';
  if (value === today) return 'D-Day';
  return value > today ? `D-${dateSpan(today, value)}` : `D+${dateSpan(value, today)}`;
}
export function invitationCountdownInfo(value, today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())) {
  if (!validDate(value) || !validDate(today)) return null;
  if (value === today) return { status: 'today', days: 0 };
  return value > today ? { status: 'future', days: dateSpan(today, value) } : { status: 'past', days: dateSpan(value, today) };
}
export function invitationLiveCountdown(dateStr, timeStr = '', nowMs = Date.now()) {
  if (!validDate(dateStr) || !Number.isFinite(nowMs)) return null;
  const hasTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr || '');
  const targetMs = Date.parse(`${dateStr}T${hasTime ? timeStr : '00:00'}:00+09:00`);
  if (!Number.isFinite(targetMs)) return null;
  const diffMs = targetMs - nowMs;
  if (diffMs > 0) {
    const totalSec = Math.floor(diffMs / 1000);
    return {
      status: 'future',
      days: Math.floor(totalSec / 86400),
      hours: Math.floor((totalSec % 86400) / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
      hasTime
    };
  }
  const ongoingWindowMs = hasTime ? 3 * 3600 * 1000 : 24 * 3600 * 1000;
  if (diffMs >= -ongoingWindowMs) {
    return { status: 'ongoing', days: 0, hours: 0, minutes: 0, seconds: 0, hasTime };
  }
  const absSec = Math.floor(Math.abs(diffMs) / 1000);
  return {
    status: 'past',
    days: Math.floor(absSec / 86400),
    hours: Math.floor((absSec % 86400) / 3600),
    minutes: Math.floor((absSec % 3600) / 60),
    seconds: absSec % 60,
    hasTime
  };
}
export function extractPhoneNumber(line) {
  const text = String(line || '');
  const match = text.match(/(?:^|[^\d-])((?:01[016789]|02|0[3-6][1-5]|070|1[568]\d\d)(?:[-\s.]\d{3,4}[-\s.]\d{4}|-\d{4})|01[016789]\d{7,8})(?=$|[^\d-])/);
  if (!match) return null;
  const display = match[1].trim();
  const digits = display.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 11) return null;
  return { display, digits, isMobile: /^01[016789]/.test(digits) };
}
export function extractAccountNumber(line, { allowPhoneLike = false } = {}) {
  const text = String(line || '');
  const hasBankHint = /(은행|뱅크|토스|농협|수협|신협|새마을|우체국|카카오|케이|국민|신한|우리|하나|기업|부산|대구|경남|광주|전북|제주|씨티|SC|IBK|KB|NH|iM|계좌)/i.test(text);
  const candidates = [...text.matchAll(/(?:^|[^\d-])(\d{2,6}(?:-\d{2,8}){1,3}|\d{10,16})(?=$|[^\d-])/g)]
    .map(m => {
      const display = m[1].trim();
      const digits = display.replace(/\D/g, '');
      return { display, digits, isPhoneLike: /^(?:01[016789]|02|0[3-6][1-5]|070)\d{7,8}$/.test(digits) && digits.length <= 11 };
    })
    .filter(item => item.digits.length >= 10 && item.digits.length <= 16);
  const primary = candidates.find(item => !item.isPhoneLike);
  if (primary) return { display: primary.display, digits: primary.digits };
  if (allowPhoneLike || hasBankHint) {
    const fallback = candidates[0];
    if (fallback) return { display: fallback.display, digits: fallback.digits };
  }
  return null;
}

const INVITATION_DIFF_LABELS = {
  partner1: '첫 번째 이름',
  partner2: '두 번째 이름',
  groomParents: '신랑 측 혼주',
  brideParents: '신부 측 혼주',
  date: '예식 날짜',
  time: '예식 시간',
  venue: '예식장',
  address: '예식장 주소',
  mapUrl: '지도 링크',
  venueMapImage: '예식장 약도 이미지',
  message: '초대 인사',
  transit: '교통·주차 안내',
  notice: '예식 안내 메모',
  contacts: '연락처 안내',
  groomAccounts: '신랑 측 계좌',
  brideAccounts: '신부 측 계좌',
  rsvpUrl: 'RSVP 설문 링크'
};

export function summarizeContentDiff(baseInput, draftInput) {
  const base = baseInput || {};
  const draft = draftInput || {};
  const baseInv = base.invitation || {};
  const draftInv = draft.invitation || {};
  const invitationFields = [];
  for (const [key, label] of Object.entries(INVITATION_DIFF_LABELS)) {
    const before = String(baseInv[key] ?? '').trim();
    const after = String(draftInv[key] ?? '').trim();
    if (before !== after) {
      invitationFields.push({
        key,
        label,
        status: !before ? 'added' : (!after ? 'removed' : 'modified')
      });
    }
  }
  const collections = {};
  let totalCollectionChanges = 0;
  for (const key of ['stories', 'albums', 'honeymoon', 'tips']) {
    const baseList = Array.isArray(base[key]) ? base[key] : [];
    const draftList = Array.isArray(draft[key]) ? draft[key] : [];
    const baseMap = new Map(baseList.map(item => [item.id, item]));
    const draftMap = new Map(draftList.map(item => [item.id, item]));
    const addedTitles = [];
    const removedTitles = [];
    const modifiedTitles = [];
    for (const item of draftList) {
      if (!baseMap.has(item.id)) {
        addedTitles.push(item.title || '제목 없음');
      } else if (JSON.stringify(baseMap.get(item.id)) !== JSON.stringify(item)) {
        modifiedTitles.push(item.title || '제목 없음');
      }
    }
    for (const item of baseList) {
      if (!draftMap.has(item.id)) {
        removedTitles.push(item.title || '제목 없음');
      }
    }
    const baseOrder = baseList.filter(item => draftMap.has(item.id)).map(item => item.id);
    const draftOrder = draftList.filter(item => baseMap.has(item.id)).map(item => item.id);
    const reordered = baseOrder.length > 1 && baseOrder.some((id, idx) => draftOrder[idx] !== id);
    const count = addedTitles.length + removedTitles.length + modifiedTitles.length + (reordered ? 1 : 0);
    totalCollectionChanges += count;
    collections[key] = {
      added: addedTitles.length,
      removed: removedTitles.length,
      modified: modifiedTitles.length,
      reordered,
      addedTitles,
      removedTitles,
      modifiedTitles,
      total: count
    };
  }
  const totalChanges = invitationFields.length + totalCollectionChanges;
  return {
    hasChanges: totalChanges > 0,
    totalChanges,
    invitationFields,
    collections
  };
}




