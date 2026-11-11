import { MAX_IMPORT_BYTES, validDate } from './content.js?v=wedding-features-36';

export const BUDGET_KEYS = ['venue', 'sdm', 'snap', 'rings', 'honeymoon', 'living'];
export const CHECKLIST_STAGES = ['D-180 이전', 'D-120 ~ D-90', 'D-60 ~ D-30', 'D-14 ~ D-Day'];
export const PACKING_CATEGORIES = ['📄 필수 서류·결제', '🔌 전자기기·통신', '🏖️ 의류·해변 용품', '💊 상비약·세면·기타'];
export const VENDOR_CATEGORIES = ['📸 스튜디오', '🏛️ 웨딩홀', '👗 드레스', '💄 메이크업', '🎥 본식스냅·DVD', '💍 예물·예복·한복', '✈️ 신혼여행·기타'];
const id = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const validMoney = value => value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000000000);
const validGuestCount = value => value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10000);
export function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('개인 설정 형식을 확인해 주세요.');
  const ids = (value = []) => {
    if (!Array.isArray(value) || value.length > 1000 || !value.every(id)) throw new Error('선택 목록을 확인해 주세요.');
    return [...new Set(value)];
  };
  const notes = input.notes ?? {};
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.keys(notes).length > 1000) throw new Error('메모 형식을 확인해 주세요.');
  for (const [key, value] of Object.entries(notes)) {
    if (!id(key) || typeof value !== 'string' || value.length > 1000) throw new Error('개인 메모를 확인해 주세요.');
  }
  const result = { favorites: ids(input.favorites), notes: Object.fromEntries(Object.entries(notes)), tripFavorites: ids(input.tripFavorites), tripCompare: ids(input.tripCompare) };
  if (input.tipFavorites !== undefined) result.tipFavorites = ids(input.tipFavorites);
  if (input.checklist !== undefined) result.checklist = ids(input.checklist);
  if (input.packingList !== undefined) result.packingList = ids(input.packingList);
  if (input.shootChecklist !== undefined) result.shootChecklist = ids(input.shootChecklist);
  if (input.ceremonyChecks !== undefined) result.ceremonyChecks = ids(input.ceremonyChecks);
  if (input.checklistNotes !== undefined) {
    if (!input.checklistNotes || typeof input.checklistNotes !== 'object' || Array.isArray(input.checklistNotes) || Object.keys(input.checklistNotes).length > 200) throw new Error('체크리스트 메모 형식을 확인해 주세요.');
    const cNotes = {};
    for (const [key, value] of Object.entries(input.checklistNotes)) {
      if (!id(key) || typeof value !== 'string' || value.length > 300) throw new Error('체크리스트 메모는 300자 이하로 입력해 주세요.');
      if (value.trim()) cNotes[key] = value.trim();
    }
    result.checklistNotes = cNotes;
  }
  if (input.tripNotes !== undefined) {
    if (!input.tripNotes || typeof input.tripNotes !== 'object' || Array.isArray(input.tripNotes) || Object.keys(input.tripNotes).length > 200) throw new Error('여행 후보 개인 메모 형식을 확인해 주세요.');
    const tNotes = {};
    for (const [key, value] of Object.entries(input.tripNotes)) {
      if (!id(key) || typeof value !== 'string' || value.length > 1000) throw new Error('여행 후보 개인 메모는 1,000자 이하로 입력해 주세요.');
      if (value.trim()) tNotes[key] = value.trim();
    }
    result.tripNotes = tNotes;
  }
  if (input.tipNotes !== undefined) {
    if (!input.tipNotes || typeof input.tipNotes !== 'object' || Array.isArray(input.tipNotes) || Object.keys(input.tipNotes).length > 200) throw new Error('꿀팁 개인 메모 형식을 확인해 주세요.');
    const pNotes = {};
    for (const [key, value] of Object.entries(input.tipNotes)) {
      if (!id(key) || typeof value !== 'string' || value.length > 500) throw new Error('꿀팁 개인 메모는 500자 이하로 입력해 주세요.');
      if (value.trim()) pNotes[key] = value.trim();
    }
    result.tipNotes = pNotes;
  }
  if (input.customChecklist !== undefined) {
    if (!Array.isArray(input.customChecklist) || input.customChecklist.length > 50) throw new Error('직접 추가한 할 일은 50개까지 보관할 수 있습니다.');
    const seen = new Set();
    result.customChecklist = input.customChecklist.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !CHECKLIST_STAGES.includes(item.stage) || typeof item.title !== 'string') throw new Error('직접 추가한 할 일 형식을 확인해 주세요.');
      const title = item.title.trim();
      if (!title || title.length > 160 || seen.has(item.id)) throw new Error('할 일 제목과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      return { id: item.id, stage: item.stage, title };
    });
  }
  if (input.customPackingList !== undefined) {
    if (!Array.isArray(input.customPackingList) || input.customPackingList.length > 50) throw new Error('직접 추가한 준비물은 50개까지 보관할 수 있습니다.');
    const seen = new Set();
    result.customPackingList = input.customPackingList.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !PACKING_CATEGORIES.includes(item.category) || typeof item.title !== 'string') throw new Error('직접 추가한 준비물 형식을 확인해 주세요.');
      const title = item.title.trim();
      if (!title || title.length > 160 || seen.has(item.id)) throw new Error('준비물 이름과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      return { id: item.id, category: item.category, title };
    });
  }
  if (input.vendorSchedules !== undefined) {
    if (!Array.isArray(input.vendorSchedules) || input.vendorSchedules.length > 60) throw new Error('업체 일정은 60개까지 보관할 수 있습니다.');
    const seen = new Set();
    result.vendorSchedules = input.vendorSchedules.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !VENDOR_CATEGORIES.includes(item.category) || typeof item.name !== 'string' || typeof item.done !== 'boolean') {
        throw new Error('업체 일정 형식을 확인해 주세요.');
      }
      const name = item.name.trim();
      if (!name || name.length > 120 || seen.has(item.id)) throw new Error('업체·일정 이름과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      const dateStr = item.date === undefined || item.date === null ? '' : String(item.date).trim();
      if (dateStr && !validDate(dateStr)) throw new Error('업체 일정 날짜를 확인해 주세요.');
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof note !== 'string' || note.length > 300) throw new Error('업체 일정 메모는 300자 이하로 입력해 주세요.');
      return { id: item.id, category: item.category, name, date: dateStr, done: item.done, ...(note.trim() ? { note: note.trim() } : {}) };
    });
  }
  if (input.ceremonyPlan !== undefined) {
    if (!input.ceremonyPlan || typeof input.ceremonyPlan !== 'object' || Array.isArray(input.ceremonyPlan)) throw new Error('본식 식순 설정 형식을 확인해 주세요.');
    const style = input.ceremonyPlan.style ?? 'noOfficiant';
    if (!['noOfficiant', 'officiant'].includes(style)) throw new Error('예식 형태를 확인해 주세요.');
    const cPlan = { style };
    const limits = [['mc', 500], ['song', 500], ['speech', 500], ['banquetFloor', 40], ['note', 1000], ['vows', 3000], ['declaration', 2000]];
    for (const [key, maxLen] of limits) {
      const val = input.ceremonyPlan[key] ?? '';
      if (typeof val !== 'string' || val.length > maxLen) throw new Error(`식순·낭독문 설정(${key}) 길이를 확인해 주세요.`);
      if (val.trim()) cPlan[key] = val.trim();
    }
    result.ceremonyPlan = cPlan;
  }
  if (input.venueSim !== undefined) {
    if (!input.venueSim || typeof input.venueSim !== 'object' || Array.isArray(input.venueSim)) throw new Error('웨딩홀 시뮬레이터 형식을 확인해 주세요.');
    if (!validMoney(input.venueSim.mealPrice) || !validGuestCount(input.venueSim.guestCount) || !validGuestCount(input.venueSim.minGuarantee) || !validMoney(input.venueSim.hallFee) || !validMoney(input.venueSim.deposit)) {
      throw new Error('웨딩홀 시뮬레이터 금액과 인원을 0 이상의 정수로 입력해 주세요.');
    }
    const note = input.venueSim.note ?? '';
    if (typeof note !== 'string' || note.length > 300) throw new Error('웨딩홀 메모는 300자 이하로 입력해 주세요.');
    result.venueSim = {
      mealPrice: input.venueSim.mealPrice ?? null,
      guestCount: input.venueSim.guestCount ?? null,
      minGuarantee: input.venueSim.minGuarantee ?? null,
      hallFee: input.venueSim.hallFee ?? null,
      deposit: input.venueSim.deposit ?? null,
      ...(note.trim() ? { note: note.trim() } : {})
    };
  }
  if (input.sdmSim !== undefined) {
    if (!input.sdmSim || typeof input.sdmSim !== 'object' || Array.isArray(input.sdmSim)) throw new Error('스드메 시뮬레이터 형식을 확인해 주세요.');
    if (!validMoney(input.sdmSim.packageFee) || !validMoney(input.sdmSim.helperFee) || !validMoney(input.sdmSim.extraFee) || !validMoney(input.sdmSim.deposit)) {
      throw new Error('스드메 시뮬레이터 금액을 0원 이상의 정수로 입력해 주세요.');
    }
    if ((input.sdmSim.roadScene !== undefined && typeof input.sdmSim.roadScene !== 'boolean') || (input.sdmSim.nightShoot !== undefined && typeof input.sdmSim.nightShoot !== 'boolean')) {
      throw new Error('스드메 촬영 옵션 선택 형식을 확인해 주세요.');
    }
    const note = input.sdmSim.note ?? '';
    if (typeof note !== 'string' || note.length > 300) throw new Error('스드메 메모는 300자 이하로 입력해 주세요.');
    result.sdmSim = {
      packageFee: input.sdmSim.packageFee ?? null,
      helperFee: input.sdmSim.helperFee ?? null,
      extraFee: input.sdmSim.extraFee ?? null,
      deposit: input.sdmSim.deposit ?? null,
      roadScene: Boolean(input.sdmSim.roadScene),
      nightShoot: Boolean(input.sdmSim.nightShoot),
      ...(note.trim() ? { note: note.trim() } : {})
    };
  }
  if (input.budgetPlan !== undefined) {
    if (!input.budgetPlan || typeof input.budgetPlan !== 'object' || Array.isArray(input.budgetPlan)) throw new Error('예산 계산기 형식을 확인해 주세요.');
    const plan = {};
    for (const [key, item] of Object.entries(input.budgetPlan)) {
      if (!BUDGET_KEYS.includes(key) || !item || typeof item !== 'object' || Array.isArray(item)) throw new Error('예산 항목 형식을 확인해 주세요.');
      if (!validMoney(item.planned) || !validMoney(item.actual)) throw new Error('예산 금액은 0원 이상의 정수로 입력해 주세요.');
      const note = item.note === undefined ? '' : item.note;
      if (typeof note !== 'string' || note.length > 300) throw new Error('예산 메모는 300자 이하로 입력해 주세요.');
      plan[key] = { planned: item.planned ?? null, actual: item.actual ?? null, ...(note ? { note } : {}) };
    }
    result.budgetPlan = plan;
  }
  if (result.tripCompare.length > 2) throw new Error('여행 비교는 두 곳까지 선택해 주세요.');
  for (const key of ['left', 'right', 'tripSelected', 'studioSelected']) {
    if (input[key] !== undefined && input[key] !== '') {
      if (!id(input[key])) throw new Error('선택 항목을 확인해 주세요.');
      result[key] = input[key];
    }
  }
  return result;
}
export function parsePreferencesBackup(raw) {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
  let input;
  try { input = JSON.parse(raw); } catch { throw new Error('올바른 개인 백업 파일이 아닙니다.'); }
  if (input?.kind !== 'wedding-private-preferences' || input.schemaVersion !== 1) throw new Error('이 앱의 개인 메모·선택 백업 파일을 선택해 주세요.');
  return validatePreferences(input.preferences);
}
export function pruneTripPreferences(input,trips){
  const valid=validatePreferences(input),ids=new Set(trips.map(trip=>trip.id));
  const next={...valid,tripCompare:valid.tripCompare.filter(id=>ids.has(id)),tripFavorites:valid.tripFavorites.filter(id=>ids.has(id)),tripSelected:ids.has(valid.tripSelected)?valid.tripSelected:''};
  if(valid.tripNotes!==undefined)next.tripNotes=Object.fromEntries(Object.entries(valid.tripNotes).filter(([k])=>ids.has(k)));
  return validatePreferences(next);
}
// Persist before committing UI state. Callers keep their current state on failure.
export function persistPreferences(storage, key, next) {
  const valid = validatePreferences(next);
  storage.setItem(key, JSON.stringify(valid));
  return valid;
}
