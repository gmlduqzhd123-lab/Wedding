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
      if (item.budget !== null && (typeof item.budget !== 'number' || !Number.isFinite(item.budget) || item.budget < 0)) throw new Error('여행 예산을 확인해 주세요.');
      const startDate=date(item.startDate), endDate=date(item.endDate);
      if (startDate && endDate && startDate > endDate) throw new Error('여행 종료일은 출발일 이후로 입력해 주세요.');
      return { ...record(item), country:string(item.country,200), startDate,endDate,budget:item.budget,pros:string(item.pros),cons:string(item.cons),body:string(item.body),url:link(item.url) };
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
