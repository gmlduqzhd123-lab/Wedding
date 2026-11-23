import { MAX_IMPORT_BYTES, validDate } from './content.js?v=wedding-features-52';

export const BUDGET_KEYS = ['venue', 'sdm', 'snap', 'rings', 'honeymoon', 'living'];
export const CHECKLIST_STAGES = ['D-180 이전', 'D-120 ~ D-90', 'D-60 ~ D-30', 'D-14 ~ D-Day'];
export const PACKING_CATEGORIES = ['📄 필수 서류·결제', '🔌 전자기기·통신', '🏖️ 의류·해변 용품', '💊 상비약·세면·기타'];
export const VENDOR_CATEGORIES = ['📸 스튜디오', '🏛️ 웨딩홀', '👗 드레스', '💄 메이크업', '🎥 본식스냅·DVD', '💍 예물·예복·한복', '✈️ 신혼여행·기타'];
export const GUEST_SIDES = ['신랑 측', '신부 측', '공통'];
export const GUEST_GROUPS = ['가족·친척', '친구', '직장·동료', '지인·기타'];
export const INVITE_STATUSES = ['미발송', '모바일 발송', '종이 전달', '모바일+종이'];
export const RSVP_STATUSES = ['미확인', '참석', '미정', '불참'];
export const GIFT_CHANNELS = ['축의대(현금)', '계좌이체', '선물·기타'];
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
  if (input.prenatalChecks !== undefined) result.prenatalChecks = ids(input.prenatalChecks);
  if (input.prenatalNote !== undefined) {
    if (typeof input.prenatalNote !== 'string' || input.prenatalNote.length > 1000) throw new Error('산전검사 개인 메모는 1,000자 이하로 입력해 주세요.');
    if (input.prenatalNote.trim()) result.prenatalNote = input.prenatalNote.trim();
  }
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
    if (!Array.isArray(input.customPackingList) || input.customPackingList.length > 80) throw new Error('직접 추가한 준비물은 80개까지 보관할 수 있습니다.');
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
      if (typeof note !== 'string' || note.length > 500) throw new Error('업체 일정 메모는 500자 이하로 입력해 주세요.');
      return { id: item.id, category: item.category, name, date: dateStr, done: item.done, ...(note.trim() ? { note: note.trim() } : {}) };
    });
  }
  if (input.guestList !== undefined) {
    if (!Array.isArray(input.guestList) || input.guestList.length > 500) throw new Error('하객 명단은 500건까지 보관할 수 있습니다.');
    const seen = new Set();
    result.guestList = input.guestList.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || typeof item.name !== 'string' || !GUEST_SIDES.includes(item.side) || !GUEST_GROUPS.includes(item.group) || !INVITE_STATUSES.includes(item.inviteStatus) || !RSVP_STATUSES.includes(item.rsvp)) {
        throw new Error('하객 명단 항목 형식을 확인해 주세요.');
      }
      const name = item.name.trim();
      if (!name || name.length > 80 || seen.has(item.id)) throw new Error('하객 이름과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      if (typeof item.partySize !== 'number' || !Number.isInteger(item.partySize) || item.partySize < 1 || item.partySize > 20) {
        throw new Error('동반 포함 인원은 1명 이상 20명 이하의 정수로 입력해 주세요.');
      }
      const mealTicket = item.mealTicket === undefined ? true : item.mealTicket;
      if (typeof mealTicket !== 'boolean') throw new Error('식사 여부 형식을 확인해 주세요.');
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof note !== 'string' || note.length > 300) throw new Error('하객 메모는 300자 이하로 입력해 주세요.');
      return {
        id: item.id,
        name,
        side: item.side,
        group: item.group,
        partySize: item.partySize,
        inviteStatus: item.inviteStatus,
        rsvp: item.rsvp,
        mealTicket,
        ...(note.trim() ? { note: note.trim() } : {})
      };
    });
  }
  if (input.giftLedger !== undefined) {
    if (!Array.isArray(input.giftLedger) || input.giftLedger.length > 500) throw new Error('축의금 장부는 500건까지 보관할 수 있습니다.');
    const seen = new Set();
    result.giftLedger = input.giftLedger.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || typeof item.name !== 'string' || !GUEST_SIDES.includes(item.side) || !GUEST_GROUPS.includes(item.group) || !GIFT_CHANNELS.includes(item.channel)) {
        throw new Error('축의금 장부 항목 형식을 확인해 주세요.');
      }
      const name = item.name.trim();
      if (!name || name.length > 80 || seen.has(item.id)) throw new Error('축의금 기록 이름과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      if (typeof item.amount !== 'number' || !Number.isInteger(item.amount) || item.amount < 0 || item.amount > 100000000) {
        throw new Error('축의금 금액은 0원 이상 1억 원 이하의 정수로 입력해 주세요.');
      }
      if (typeof item.mealTickets !== 'number' || !Number.isInteger(item.mealTickets) || item.mealTickets < 0 || item.mealTickets > 50) {
        throw new Error('식권 수량은 0매 이상 50매 이하의 정수로 입력해 주세요.');
      }
      if (typeof item.returnGiftDone !== 'boolean' || typeof item.thankYouDone !== 'boolean') {
        throw new Error('답례품·감사 인사 완료 여부를 확인해 주세요.');
      }
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof note !== 'string' || note.length > 300) throw new Error('축의금 장부 메모는 300자 이하로 입력해 주세요.');
      return {
        id: item.id,
        name,
        side: item.side,
        group: item.group,
        channel: item.channel,
        amount: item.amount,
        mealTickets: item.mealTickets,
        returnGiftDone: item.returnGiftDone,
        thankYouDone: item.thankYouDone,
        ...(note.trim() ? { note: note.trim() } : {})
      };
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
export function pruneContentPreferences(input,content){
  const next=pruneTripPreferences(input,content?.honeymoon||[]);
  if(!Array.isArray(content?.tips))return next;
  const tipIds=new Set(content.tips.map(tip=>tip.id));
  if(next.tipFavorites!==undefined)next.tipFavorites=next.tipFavorites.filter(id=>tipIds.has(id));
  if(next.tipNotes!==undefined)next.tipNotes=Object.fromEntries(Object.entries(next.tipNotes).filter(([k])=>tipIds.has(k)));
  return validatePreferences(next);
}
// Persist before committing UI state. Callers keep their current state on failure.
export function persistPreferences(storage, key, next) {
  const valid = validatePreferences(next);
  storage.setItem(key, JSON.stringify(valid));
  return valid;
}

function mergeNoteMap(currentMap, incomingMap, maxLen, maxEntries) {
  if (currentMap === undefined && incomingMap === undefined) return undefined;
  const result = { ...(currentMap || {}) };
  for (const [key, rawVal] of Object.entries(incomingMap || {})) {
    const val = String(rawVal || '').trim();
    if (!val) continue;
    const prev = String(result[key] || '').trim();
    if (!prev) {
      if (Object.keys(result).length < maxEntries) result[key] = val.slice(0, maxLen);
    } else if (prev !== val && !prev.includes(val)) {
      const combined = `${prev}\n---\n${val}`;
      result[key] = combined.length <= maxLen ? combined : prev;
    }
  }
  return result;
}

function mergeIdList(currentList, incomingList, cap = 1000) {
  if (currentList === undefined && incomingList === undefined) return undefined;
  return [...new Set([...(currentList || []), ...(incomingList || [])])].slice(0, cap);
}

function mergeRecordList(currentList, incomingList, { cap, dedupeKey }) {
  if (currentList === undefined && incomingList === undefined) return undefined;
  const base = [...(currentList || [])];
  const seenIds = new Set(base.map(item => item.id));
  const seenKeys = new Set(dedupeKey ? base.map(dedupeKey) : []);
  for (const item of incomingList || []) {
    if (base.length >= cap) break;
    if (seenIds.has(item.id)) continue;
    const key = dedupeKey ? dedupeKey(item) : '';
    if (key && seenKeys.has(key)) continue;
    base.push(structuredClone(item));
    seenIds.add(item.id);
    if (key) seenKeys.add(key);
  }
  return base;
}

export function mergePreferences(currentInput, incomingInput) {
  const cur = validatePreferences(currentInput || {});
  const inc = validatePreferences(incomingInput || {});
  const merged = {
    favorites: mergeIdList(cur.favorites, inc.favorites, 1000) || [],
    notes: mergeNoteMap(cur.notes, inc.notes, 1000, 1000) || {},
    tripFavorites: mergeIdList(cur.tripFavorites, inc.tripFavorites, 1000) || [],
    tripCompare: mergeIdList(cur.tripCompare, inc.tripCompare, 2) || []
  };

  for (const key of ['tipFavorites', 'checklist', 'packingList', 'shootChecklist', 'ceremonyChecks', 'prenatalChecks']) {
    const list = mergeIdList(cur[key], inc[key], 1000);
    if (list !== undefined) merged[key] = list;
  }
  if (cur.prenatalNote !== undefined || inc.prenatalNote !== undefined) {
    const prev = String(cur.prenatalNote || '').trim();
    const next = String(inc.prenatalNote || '').trim();
    if (!prev && next) merged.prenatalNote = next.slice(0, 1000);
    else if (prev && (!next || prev === next || prev.includes(next))) merged.prenatalNote = prev;
    else if (prev && next) {
      const combined = `${prev}\n---\n${next}`;
      merged.prenatalNote = combined.length <= 1000 ? combined : prev;
    }
  }
  const checklistNotes = mergeNoteMap(cur.checklistNotes, inc.checklistNotes, 300, 200);
  if (checklistNotes !== undefined) merged.checklistNotes = checklistNotes;
  const tripNotes = mergeNoteMap(cur.tripNotes, inc.tripNotes, 1000, 200);
  if (tripNotes !== undefined) merged.tripNotes = tripNotes;
  const tipNotes = mergeNoteMap(cur.tipNotes, inc.tipNotes, 500, 200);
  if (tipNotes !== undefined) merged.tipNotes = tipNotes;

  const customChecklist = mergeRecordList(cur.customChecklist, inc.customChecklist, { cap: 50, dedupeKey: item => `${item.stage}|${item.title}` });
  if (customChecklist !== undefined) merged.customChecklist = customChecklist;
  const customPackingList = mergeRecordList(cur.customPackingList, inc.customPackingList, { cap: 80, dedupeKey: item => `${item.category}|${item.title}` });
  if (customPackingList !== undefined) merged.customPackingList = customPackingList;
  const vendorSchedules = mergeRecordList(cur.vendorSchedules, inc.vendorSchedules, { cap: 60, dedupeKey: item => `${item.category}|${item.name}|${item.date || ''}` });
  if (vendorSchedules !== undefined) merged.vendorSchedules = vendorSchedules;
  const guestList = mergeRecordList(cur.guestList, inc.guestList, { cap: 500, dedupeKey: item => `${item.side}|${item.name}|${item.group}` });
  if (guestList !== undefined) merged.guestList = guestList;
  const giftLedger = mergeRecordList(cur.giftLedger, inc.giftLedger, { cap: 500, dedupeKey: item => `${item.side}|${item.name}|${item.group}|${item.channel}|${item.amount}` });
  if (giftLedger !== undefined) merged.giftLedger = giftLedger;

  if (cur.ceremonyPlan !== undefined || inc.ceremonyPlan !== undefined) {
    const a = cur.ceremonyPlan || {};
    const b = inc.ceremonyPlan || {};
    const cPlan = { style: a.style || b.style || 'noOfficiant' };
    for (const key of ['mc', 'song', 'speech', 'banquetFloor', 'note', 'vows', 'declaration']) {
      const val = a[key] || b[key];
      if (val) cPlan[key] = val;
    }
    merged.ceremonyPlan = cPlan;
  }
  if (cur.venueSim !== undefined || inc.venueSim !== undefined) {
    const a = cur.venueSim || {};
    const b = inc.venueSim || {};
    merged.venueSim = {
      mealPrice: a.mealPrice ?? b.mealPrice ?? null,
      guestCount: a.guestCount ?? b.guestCount ?? null,
      minGuarantee: a.minGuarantee ?? b.minGuarantee ?? null,
      hallFee: a.hallFee ?? b.hallFee ?? null,
      deposit: a.deposit ?? b.deposit ?? null,
      ...((a.note || b.note) ? { note: a.note || b.note } : {})
    };
  }
  if (cur.sdmSim !== undefined || inc.sdmSim !== undefined) {
    const a = cur.sdmSim || {};
    const b = inc.sdmSim || {};
    merged.sdmSim = {
      packageFee: a.packageFee ?? b.packageFee ?? null,
      helperFee: a.helperFee ?? b.helperFee ?? null,
      extraFee: a.extraFee ?? b.extraFee ?? null,
      deposit: a.deposit ?? b.deposit ?? null,
      roadScene: Boolean(a.roadScene || b.roadScene),
      nightShoot: Boolean(a.nightShoot || b.nightShoot),
      ...((a.note || b.note) ? { note: a.note || b.note } : {})
    };
  }
  if (cur.budgetPlan !== undefined || inc.budgetPlan !== undefined) {
    const plan = {};
    for (const key of BUDGET_KEYS) {
      const a = cur.budgetPlan?.[key];
      const b = inc.budgetPlan?.[key];
      if (!a && !b) continue;
      plan[key] = {
        planned: a?.planned ?? b?.planned ?? null,
        actual: a?.actual ?? b?.actual ?? null,
        ...((a?.note || b?.note) ? { note: a?.note || b?.note } : {})
      };
    }
    merged.budgetPlan = plan;
  }
  for (const key of ['left', 'right', 'tripSelected', 'studioSelected']) {
    const val = cur[key] || inc[key];
    if (val) merged[key] = val;
  }
  return validatePreferences(merged);
}

export function summarizePreferencesMerge(currentInput, mergedInput) {
  const cur = validatePreferences(currentInput || {});
  const mer = validatePreferences(mergedInput || {});
  const diffLen = (a, b) => Math.max(0, (b?.length || 0) - (a?.length || 0));
  const diffKeys = (a, b) => {
    const curObj = a || {};
    const merObj = b || {};
    let changed = 0;
    for (const [k, v] of Object.entries(merObj)) {
      if ((curObj[k] || '') !== (v || '')) changed++;
    }
    return changed;
  };
  return {
    guestsAdded: diffLen(cur.guestList, mer.guestList),
    giftsAdded: diffLen(cur.giftLedger, mer.giftLedger),
    schedulesAdded: diffLen(cur.vendorSchedules, mer.vendorSchedules),
    checksAdded: diffLen(cur.checklist, mer.checklist) + diffLen(cur.shootChecklist, mer.shootChecklist) + diffLen(cur.ceremonyChecks, mer.ceremonyChecks) + diffLen(cur.prenatalChecks, mer.prenatalChecks) + diffLen(cur.packingList, mer.packingList),
    customItemsAdded: diffLen(cur.customChecklist, mer.customChecklist) + diffLen(cur.customPackingList, mer.customPackingList),
    favoritesAdded: diffLen(cur.favorites, mer.favorites) + diffLen(cur.tripFavorites, mer.tripFavorites) + diffLen(cur.tipFavorites, mer.tipFavorites),
    notesUpdated: diffKeys(cur.notes, mer.notes) + diffKeys(cur.tripNotes, mer.tripNotes) + diffKeys(cur.tipNotes, mer.tipNotes) + diffKeys(cur.checklistNotes, mer.checklistNotes) + ((cur.prenatalNote || '') !== (mer.prenatalNote || '') ? 1 : 0)
  };
}

