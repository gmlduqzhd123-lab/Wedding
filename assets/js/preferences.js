import { MAX_IMPORT_BYTES, validDate } from './content.js?v=wedding-features-62';

export const BUDGET_KEYS = ['venue', 'sdm', 'snap', 'rings', 'honeymoon', 'living'];
export const CHECKLIST_STAGES = ['D-180 이전', 'D-120 ~ D-90', 'D-60 ~ D-30', 'D-14 ~ D-Day'];
export const PACKING_CATEGORIES = ['📄 필수 서류·결제', '🔌 전자기기·통신', '🏖️ 의류·해변 용품', '💊 상비약·세면·기타'];
export const VENDOR_CATEGORIES = ['📸 스튜디오', '🏛️ 웨딩홀', '👗 드레스', '💄 메이크업', '🎥 본식스냅·DVD', '💍 예물·예복·한복', '✈️ 신혼여행·기타'];
export const GUEST_SIDES = ['신랑 측', '신부 측', '공통'];
export const GUEST_GROUPS = ['가족·친척', '친구', '직장·동료', '지인·기타'];
export const INVITE_STATUSES = ['미발송', '모바일 발송', '종이 전달', '모바일+종이'];
export const RSVP_STATUSES = ['미확인', '참석', '미정', '불참'];
export const GIFT_CHANNELS = ['축의대(현금)', '계좌이체', '선물·기타'];
export const HOME_ITEM_CATEGORIES = ['📺 가전', '🛋️ 가구', '🍳 주방·생활', '🏠 입주·인테리어', '📦 기타'];
export const HOME_ITEM_STATUSES = ['후보 비교', '구매 확정', '계약·결제 완료', '배송·설치 완료'];
export const DAY_ROLE_GROUPS = ['축의대(신랑 측)', '축의대(신부 측)', '신부 케어·가방순이', '진행·안내·운전', '촬영·부케·기타'];
export const ENVELOPE_PAYEES = ['사회자', '축가자', '촬영·본식 헬퍼', '본식 스냅·DVD', '원판·가족사진', '웨딩카·운전', '혼주·기타'];
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
  if (input.prenatalSchedule !== undefined) {
    if (!input.prenatalSchedule || typeof input.prenatalSchedule !== 'object' || Array.isArray(input.prenatalSchedule)) throw new Error('산전검사 일정 형식을 확인해 주세요.');
    const ps = {};
    for (const dKey of ['appliedDate', 'visitDate', 'examDate']) {
      const raw = input.prenatalSchedule[dKey] ?? '';
      if (typeof raw !== 'string') throw new Error('산전검사 일정 날짜 형식을 확인해 주세요.');
      const trimmed = raw.trim();
      if (trimmed && !validDate(trimmed)) throw new Error('산전검사 일정 날짜가 올바르지 않습니다.');
      if (trimmed) ps[dKey] = trimmed;
    }
    if (input.prenatalSchedule.claimed !== undefined && typeof input.prenatalSchedule.claimed !== 'boolean') throw new Error('지원금 청구 완료 여부를 확인해 주세요.');
    ps.claimed = Boolean(input.prenatalSchedule.claimed);
    result.prenatalSchedule = ps;
  }
  if (input.benefitChecks !== undefined) result.benefitChecks = ids(input.benefitChecks);
  if (input.benefitNote !== undefined) {
    if (typeof input.benefitNote !== 'string' || input.benefitNote.length > 1000) throw new Error('혼인신고·혜택 개인 메모는 1,000자 이하로 입력해 주세요.');
    if (input.benefitNote.trim()) result.benefitNote = input.benefitNote.trim();
  }
  if (input.marriageRegDate !== undefined) {
    if (typeof input.marriageRegDate !== 'string') throw new Error('혼인신고 날짜 형식을 확인해 주세요.');
    const trimmed = input.marriageRegDate.trim();
    if (trimmed && !validDate(trimmed)) throw new Error('혼인신고 날짜가 올바르지 않습니다.');
    if (trimmed) result.marriageRegDate = trimmed;
  }
  if (input.homeItems !== undefined) {
    if (!Array.isArray(input.homeItems) || input.homeItems.length > 150) throw new Error('혼수·가전·가구 항목은 150개까지 보관할 수 있습니다.');
    const seen = new Set();
    result.homeItems = input.homeItems.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !HOME_ITEM_CATEGORIES.includes(item.category) || !HOME_ITEM_STATUSES.includes(item.status) || typeof item.name !== 'string') {
        throw new Error('혼수·가전·가구 항목 형식을 확인해 주세요.');
      }
      const name = item.name.trim();
      if (!name || name.length > 100 || seen.has(item.id)) throw new Error('혼수 품목명과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      const brand = item.brand === undefined || item.brand === null ? '' : item.brand;
      if (typeof brand !== 'string' || brand.length > 100) throw new Error('브랜드·모델명은 100자 이하로 입력해 주세요.');
      if (!validMoney(item.plannedPrice) || !validMoney(item.actualPrice) || !validMoney(item.deposit)) {
        throw new Error('혼수 금액은 0원 이상의 정수로 입력해 주세요.');
      }
      const deliveryDate = item.deliveryDate === undefined || item.deliveryDate === null ? '' : String(item.deliveryDate).trim();
      if (deliveryDate && !validDate(deliveryDate)) throw new Error('배송·설치 예정일을 확인해 주세요.');
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof note !== 'string' || note.length > 300) throw new Error('혼수 품목 메모는 300자 이하로 입력해 주세요.');
      return {
        id: item.id,
        category: item.category,
        name,
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        status: item.status,
        plannedPrice: item.plannedPrice ?? null,
        actualPrice: item.actualPrice ?? null,
        deposit: item.deposit ?? null,
        ...(deliveryDate ? { deliveryDate } : {}),
        ...(note.trim() ? { note: note.trim() } : {})
      };
    });
  }
  if (input.weddingDayRoles !== undefined) {
    if (!Array.isArray(input.weddingDayRoles) || input.weddingDayRoles.length > 60) throw new Error('본식 역할 분담은 60건까지 보관할 수 있습니다.');
    const seen = new Set();
    result.weddingDayRoles = input.weddingDayRoles.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !DAY_ROLE_GROUPS.includes(item.group) || typeof item.role !== 'string') {
        throw new Error('본식 당일 역할 형식을 확인해 주세요.');
      }
      const role = item.role.trim();
      if (!role || role.length > 80 || seen.has(item.id)) throw new Error('역할 이름과 중복 여부를 확인해 주세요.');
      seen.add(item.id);
      const assignee = item.assignee === undefined || item.assignee === null ? '' : item.assignee;
      const phone = item.phone === undefined || item.phone === null ? '' : item.phone;
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof assignee !== 'string' || assignee.length > 60) throw new Error('담당자 이름은 60자 이하로 입력해 주세요.');
      if (typeof phone !== 'string' || phone.length > 40) throw new Error('연락처는 40자 이하로 입력해 주세요.');
      if (typeof note !== 'string' || note.length > 300) throw new Error('역할 메모는 300자 이하로 입력해 주세요.');
      return {
        id: item.id,
        group: item.group,
        role,
        ...(assignee.trim() ? { assignee: assignee.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {})
      };
    });
  }
  if (input.weddingDayEnvelopes !== undefined) {
    if (!Array.isArray(input.weddingDayEnvelopes) || input.weddingDayEnvelopes.length > 60) throw new Error('당일 현금 봉투 항목은 60건까지 보관할 수 있습니다.');
    const seen = new Set();
    result.weddingDayEnvelopes = input.weddingDayEnvelopes.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !ENVELOPE_PAYEES.includes(item.payee) || typeof item.ready !== 'boolean') {
        throw new Error('당일 현금 봉투 형식을 확인해 주세요.');
      }
      if (seen.has(item.id)) throw new Error('현금 봉투 ID가 중복되었습니다.');
      seen.add(item.id);
      if (!validMoney(item.amount)) throw new Error('봉투 금액은 0원 이상의 정수로 입력해 주세요.');
      const recipient = item.recipient === undefined || item.recipient === null ? '' : item.recipient;
      const note = item.note === undefined || item.note === null ? '' : item.note;
      if (typeof recipient !== 'string' || recipient.length > 80) throw new Error('수령인·업체명은 80자 이하로 입력해 주세요.');
      if (typeof note !== 'string' || note.length > 300) throw new Error('봉투 메모는 300자 이하로 입력해 주세요.');
      return {
        id: item.id,
        payee: item.payee,
        amount: item.amount ?? null,
        ...(recipient.trim() ? { recipient: recipient.trim() } : {}),
        ready: item.ready,
        ...(note.trim() ? { note: note.trim() } : {})
      };
    });
  }
  if (input.photoOrderNote !== undefined) {
    if (typeof input.photoOrderNote !== 'string' || input.photoOrderNote.length > 2000) throw new Error('원판 촬영 순서표는 2,000자 이하로 입력해 주세요.');
    if (input.photoOrderNote.trim()) result.photoOrderNote = input.photoOrderNote.trim();
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
  if (result.tripCompare.length > 3) throw new Error('여행 비교는 세 곳까지 선택해 주세요.');
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
    tripCompare: mergeIdList(cur.tripCompare, inc.tripCompare, 3) || []
  };

  for (const key of ['tipFavorites', 'checklist', 'packingList', 'shootChecklist', 'ceremonyChecks', 'prenatalChecks', 'benefitChecks']) {
    const list = mergeIdList(cur[key], inc[key], 1000);
    if (list !== undefined) merged[key] = list;
  }
  const mergeTextNote = (prevRaw, nextRaw, maxLen) => {
    const prev = String(prevRaw || '').trim();
    const next = String(nextRaw || '').trim();
    if (!prev && !next) return undefined;
    if (!prev && next) return next.slice(0, maxLen);
    if (prev && (!next || prev === next || prev.includes(next))) return prev;
    const combined = `${prev}\n---\n${next}`;
    return combined.length <= maxLen ? combined : prev;
  };
  for (const [key, maxLen] of [['prenatalNote', 1000], ['benefitNote', 1000], ['photoOrderNote', 2000]]) {
    if (cur[key] !== undefined || inc[key] !== undefined) {
      const val = mergeTextNote(cur[key], inc[key], maxLen);
      if (val) merged[key] = val;
    }
  }
  if (cur.prenatalSchedule !== undefined || inc.prenatalSchedule !== undefined) {
    const a = cur.prenatalSchedule || {};
    const b = inc.prenatalSchedule || {};
    merged.prenatalSchedule = {
      ...((a.appliedDate || b.appliedDate) ? { appliedDate: a.appliedDate || b.appliedDate } : {}),
      ...((a.visitDate || b.visitDate) ? { visitDate: a.visitDate || b.visitDate } : {}),
      ...((a.examDate || b.examDate) ? { examDate: a.examDate || b.examDate } : {}),
      claimed: Boolean(a.claimed || b.claimed)
    };
  }
  if (cur.marriageRegDate || inc.marriageRegDate) {
    merged.marriageRegDate = cur.marriageRegDate || inc.marriageRegDate;
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
  const homeItems = mergeRecordList(cur.homeItems, inc.homeItems, { cap: 150, dedupeKey: item => `${item.category}|${item.name}|${item.brand || ''}` });
  if (homeItems !== undefined) merged.homeItems = homeItems;
  const weddingDayRoles = mergeRecordList(cur.weddingDayRoles, inc.weddingDayRoles, { cap: 60, dedupeKey: item => `${item.group}|${item.role}` });
  if (weddingDayRoles !== undefined) merged.weddingDayRoles = weddingDayRoles;
  const weddingDayEnvelopes = mergeRecordList(cur.weddingDayEnvelopes, inc.weddingDayEnvelopes, { cap: 60, dedupeKey: item => `${item.payee}|${item.recipient || ''}|${item.amount ?? ''}` });
  if (weddingDayEnvelopes !== undefined) merged.weddingDayEnvelopes = weddingDayEnvelopes;

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
    homeItemsAdded: diffLen(cur.homeItems, mer.homeItems),
    dayOpsAdded: diffLen(cur.weddingDayRoles, mer.weddingDayRoles) + diffLen(cur.weddingDayEnvelopes, mer.weddingDayEnvelopes),
    checksAdded: diffLen(cur.checklist, mer.checklist) + diffLen(cur.shootChecklist, mer.shootChecklist) + diffLen(cur.ceremonyChecks, mer.ceremonyChecks) + diffLen(cur.prenatalChecks, mer.prenatalChecks) + diffLen(cur.benefitChecks, mer.benefitChecks) + diffLen(cur.packingList, mer.packingList),
    customItemsAdded: diffLen(cur.customChecklist, mer.customChecklist) + diffLen(cur.customPackingList, mer.customPackingList),
    favoritesAdded: diffLen(cur.favorites, mer.favorites) + diffLen(cur.tripFavorites, mer.tripFavorites) + diffLen(cur.tipFavorites, mer.tipFavorites),
    notesUpdated: diffKeys(cur.notes, mer.notes) + diffKeys(cur.tripNotes, mer.tripNotes) + diffKeys(cur.tipNotes, mer.tipNotes) + diffKeys(cur.checklistNotes, mer.checklistNotes)
      + ((cur.prenatalNote || '') !== (mer.prenatalNote || '') ? 1 : 0)
      + ((cur.benefitNote || '') !== (mer.benefitNote || '') ? 1 : 0)
      + ((cur.photoOrderNote || '') !== (mer.photoOrderNote || '') ? 1 : 0)
  };
}

