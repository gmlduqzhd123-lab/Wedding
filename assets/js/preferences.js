import { MAX_IMPORT_BYTES } from './content.js?v=wedding-suite-24';

export const BUDGET_KEYS = ['venue', 'sdm', 'snap', 'rings', 'honeymoon', 'living'];
const id = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const validMoney = value => value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000000000);
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
  for (const key of ['left', 'right', 'tripSelected']) {
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
  return validatePreferences({...valid,tripCompare:valid.tripCompare.filter(id=>ids.has(id)),tripFavorites:valid.tripFavorites.filter(id=>ids.has(id)),tripSelected:ids.has(valid.tripSelected)?valid.tripSelected:''});
}
// Persist before committing UI state. Callers keep their current state on failure.
export function persistPreferences(storage, key, next) {
  const valid = validatePreferences(next);
  storage.setItem(key, JSON.stringify(valid));
  return valid;
}
