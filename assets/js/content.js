import {upgradeLegacyTrip,COST_LABELS,dateSpan,emptyQuote} from './travel.js?v=travel-quotes-15';
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
    climate:string(plan.climate),climateMonth,sourceTitle:string(plan.sourceTitle,500),sourceUrl:link(plan.sourceUrl??''),checkedOn:date(plan.checkedOn),budgetNotes:string(plan.budgetNotes),
    researchNotes:string(plan.researchNotes??''),comparisonNote:string(plan.comparisonNote??'',500),references:checkedReferences,
    narrativeVersion,quote:validateQuote(plan.quote),
    ...(plan.legacyText===undefined?{}:{legacyText:string(plan.legacyText)})};
}
export function validateContent(input) {
  if (!object(input) || input.schemaVersion !== 1 || !object(input.invitation)) throw new Error('이 앱에서 저장한 콘텐츠 파일을 선택해 주세요.');
  const source = input.invitation;
  const time = string(source.time, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('예식 시간을 확인해 주세요.');
  return {
    schemaVersion:1,
    invitation:{
      partner1:string(source.partner1,100), partner2:string(source.partner2,100),
      date:date(source.date), time,
      venue:string(source.venue,300), address:string(source.address,500),
      mapUrl:link(source.mapUrl), message:string(source.message)
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
    })
  };
}
export function parseContent(raw) {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('콘텐츠 파일은 8MB 이하로 선택해 주세요.');
  let parsed;
  try { parsed=JSON.parse(raw); } catch { throw new Error('올바른 JSON 콘텐츠 파일이 아닙니다.'); }
  return validateContent(parsed);
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

