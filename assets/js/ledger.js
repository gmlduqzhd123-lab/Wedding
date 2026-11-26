export function guestListSummary(list = []) {
  const bySide = {
    '신랑 측': { records: 0, attending: 0, possible: 0 },
    '신부 측': { records: 0, attending: 0, possible: 0 },
    '공통': { records: 0, attending: 0, possible: 0 }
  };
  let totalRecords = 0, totalInvitedHeadcount = 0, attendingHeadcount = 0, undecidedHeadcount = 0, declinedHeadcount = 0, mealHeadcount = 0, sentCount = 0, unsentCount = 0;
  for (const item of Array.isArray(list) ? list : []) {
    const size = Number.isInteger(item?.partySize) && item.partySize > 0 ? item.partySize : 1;
    totalRecords++;
    totalInvitedHeadcount += size;
    if (item?.inviteStatus && item.inviteStatus !== '미발송') sentCount++;
    else unsentCount++;
    const sideBucket = bySide[item?.side] || bySide['공통'];
    sideBucket.records++;
    if (item?.rsvp === '참석') {
      attendingHeadcount += size;
      sideBucket.attending += size;
      sideBucket.possible += size;
      if (item.mealTicket !== false) mealHeadcount += size;
    } else if (item?.rsvp === '불참') {
      declinedHeadcount += size;
    } else {
      undecidedHeadcount += size;
      sideBucket.possible += size;
    }
  }
  return {
    totalRecords,
    totalInvitedHeadcount,
    attendingHeadcount,
    undecidedHeadcount,
    declinedHeadcount,
    possibleHeadcount: attendingHeadcount + undecidedHeadcount,
    mealHeadcount,
    sentCount,
    unsentCount,
    bySide
  };
}

export function giftLedgerSummary(list = []) {
  const bySide = {
    '신랑 측': { count: 0, amount: 0, mealTickets: 0 },
    '신부 측': { count: 0, amount: 0, mealTickets: 0 },
    '공통': { count: 0, amount: 0, mealTickets: 0 }
  };
  const byChannel = {
    '축의대(현금)': { count: 0, amount: 0 },
    '계좌이체': { count: 0, amount: 0 },
    '선물·기타': { count: 0, amount: 0 }
  };
  let totalRecords = 0, totalAmount = 0, totalMealTickets = 0, returnGiftPending = 0, thankYouPending = 0;
  for (const item of Array.isArray(list) ? list : []) {
    const amount = Number.isInteger(item?.amount) && item.amount >= 0 ? item.amount : 0;
    const tickets = Number.isInteger(item?.mealTickets) && item.mealTickets >= 0 ? item.mealTickets : 0;
    totalRecords++;
    totalAmount += amount;
    totalMealTickets += tickets;
    if (!item?.returnGiftDone) returnGiftPending++;
    if (!item?.thankYouDone) thankYouPending++;
    const sideBucket = bySide[item?.side] || bySide['공통'];
    sideBucket.count++;
    sideBucket.amount += amount;
    sideBucket.mealTickets += tickets;
    const chBucket = byChannel[item?.channel] || byChannel['선물·기타'];
    chBucket.count++;
    chBucket.amount += amount;
  }
  return {
    totalRecords,
    totalAmount,
    totalMealTickets,
    returnGiftPending,
    thankYouPending,
    bySide,
    byChannel
  };
}

export function csvEscape(value) {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (/[",\r\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

export function guestsToCsv(list = []) {
  const header = ['구분', '관계', '성함', '인원수', '청첩장 발송', '참석 여부', '식사 여부', '메모'];
  const rows = (Array.isArray(list) ? list : []).map(item => [
    item.side || '',
    item.group || '',
    item.name || '',
    item.partySize ?? 1,
    item.inviteStatus || '',
    item.rsvp || '',
    item.mealTicket === false ? '미식사(답례품)' : '식사',
    item.note || ''
  ]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function giftsToCsv(list = []) {
  const header = ['구분', '관계', '성함', '전달 방식', '축의금(원)', '식권(매)', '답례품 전달', '감사 인사', '메모'];
  const rows = (Array.isArray(list) ? list : []).map(item => [
    item.side || '',
    item.group || '',
    item.name || '',
    item.channel || '',
    item.amount ?? 0,
    item.mealTickets ?? 0,
    item.returnGiftDone ? '완료' : '미완료',
    item.thankYouDone ? '완료' : '미완료',
    item.note || ''
  ]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function parseCsvRows(rawText) {
  const text = String(rawText ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('CSV 따옴표가 닫히지 않았습니다. 파일을 확인해 주세요.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function unescapeExcelCell(value) {
  const s = String(value ?? '').trim();
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

function normalizeGuestSide(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '');
  if (!s) return '공통';
  if (s.includes('신랑')) return '신랑 측';
  if (s.includes('신부')) return '신부 측';
  return '공통';
}

function normalizeGuestGroup(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '');
  if (!s) return '지인·기타';
  if (s.includes('가족') || s.includes('친척') || s.includes('친지')) return '가족·친척';
  if (s.includes('친구') || s.includes('동창') || s.includes('대학')) return '친구';
  if (s.includes('직장') || s.includes('동료') || s.includes('회사') || s.includes('선배') || s.includes('후배')) return '직장·동료';
  return '지인·기타';
}

function normalizeInviteStatus(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '');
  const lower = s.toLowerCase();
  if (!s || s.includes('미발송') || lower === 'x' || lower === 'n' || lower === 'no' || s === '아니오' || s === '아니요') return '미발송';
  if (s.includes('모바일') && s.includes('종이')) return '모바일+종이';
  if (s.includes('종이')) return '종이 전달';
  if (s.includes('모바일') || s.includes('발송') || lower === 'o' || lower === 'y' || lower === 'yes' || s === '예' || s === '네') return '모바일 발송';
  return '미발송';
}

function normalizeRsvpStatus(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '');
  const lower = s.toLowerCase();
  if (!s || s.includes('미확인')) return '미확인';
  if (s.includes('불참') || s.includes('어렵') || s.includes('불가') || s.includes('못가') || s.includes('못갑') || lower === 'x' || lower === 'n' || lower === 'no' || s === '아니오' || s === '아니요') return '불참';
  if (s.includes('미정') || s.includes('보류') || s.includes('고민') || s.includes('추후')) return '미정';
  if (s.includes('참석') || s.includes('가능') || s.includes('갑니다') || s.includes('갈게') || lower === 'o' || lower === 'y' || lower === 'yes' || s === '예' || s === '네') return '참석';
  return '미확인';
}

function normalizeMealTicket(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '').toLowerCase();
  if (!s) return true;
  if (s.includes('미식사') || s.includes('답례품') || s.includes('안함') || s.includes('안먹') || s.includes('불가') || s.includes('못함') || s.includes('아니') || s === 'x' || s === 'n' || s === 'no' || s === 'false') return false;
  return true;
}

function parseHeadcountCell(raw, isCompanionOnly = false) {
  const cleaned = unescapeExcelCell(raw).replace(/\s+/g, '');
  if (!cleaned) return 1;
  if (/^(없음|혼자|본인만|0명?|none|no)$/i.test(cleaned)) return 1;
  const numMatch = cleaned.match(/\d+/);
  if (!numMatch) return 1;
  const n = Number.parseInt(numMatch[0], 10);
  if (!Number.isInteger(n) || n < 0) return 1;
  if (isCompanionOnly && !cleaned.includes('포함') && !cleaned.includes('총')) return Math.max(1, n + 1);
  return Math.max(1, n);
}

export const RSVP_FORM_GUIDE_TEXT = [
  '💌 [Google Forms / 네이버 폼 RSVP 추천 질문 구성]',
  '(이 항목명으로 만들면 응답 CSV를 앱 하객 명단으로 자동 매핑해 가져올 수 있어요)',
  '',
  '1. 성함 (단답형 · 필수)',
  '2. 어느 측 하객이신가요? (객관식 · 필수): 신랑 측 / 신부 측 / 공통',
  '3. 관계 (객관식 · 선택): 가족·친척 / 친구 / 직장·동료 / 지인·기타',
  '4. 참석 여부 (객관식 · 필수): 참석합니다 / 아쉽지만 불참합니다 / 미정입니다',
  '5. 본인 포함 참석 인원수 (객관식 또는 단답형): 1명 / 2명 / 3명 / 4명',
  '6. 식사 여부 (객관식 · 필수): 식사합니다 / 식사 안 함 (답례품 수령)',
  '7. 축하 메시지 (장문형 · 선택)'
].join('\n');

export function parseGuestsCsv(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) throw new Error('헤더 행과 최소 1건 이상의 하객 행이 포함된 CSV 파일을 선택해 주세요.');
  const headers = rows[0].map(h => unescapeExcelCell(h).replace(/\s+/g, '').toLowerCase());
  const findCol = patterns => headers.findIndex(h => patterns.some(p => h === p || h.includes(p)));
  const colTimestamp = findCol(['타임스탬프', '응답시간', 'timestamp']);
  const colName = findCol(['성함', '이름', '성명', '하객성함', '참석자', '대표자', '하객', 'name']);
  if (colName === -1) throw new Error('CSV 첫 행에 ‘성함’ 또는 ‘이름’ 열이 필요합니다.');
  const colSide = findCol(['구분', '양가', '어느측', '어느분', '신랑신부', 'side']);
  const colGroup = findCol(['관계', '분류', '그룹', '소속', 'group']);
  const colSize = findCol(['인원수', '본인포함', '총인원', '참석인원', '인원', '동반', '동행', 'partysize']);
  const colInvite = findCol(['청첩장발송', '발송', '청첩장', 'invite']);
  const colRsvp = findCol(['참석여부', '참석가능', '참석', 'rsvp']);
  const colMeal = findCol(['식사여부', '연회식사', '식사', '식권', 'meal']);
  const colMessage = findCol(['축하메시지', '축하인사', '남기실말씀', '전하실말씀', '응원메시지', 'message']);
  const colNote = findCol(['메모', '비고', '특이사항', '요청사항', 'note']);

  const sizeHeader = colSize >= 0 ? headers[colSize] : '';
  const isCompanionOnly = Boolean(
    sizeHeader &&
    (sizeHeader.includes('동반') || sizeHeader.includes('동행')) &&
    !sizeHeader.includes('포함') &&
    !sizeHeader.includes('총')
  );
  const isRsvpForm = Boolean(
    colTimestamp >= 0 ||
    colMessage >= 0 ||
    (colInvite === -1 && colRsvp >= 0)
  );

  const records = [];
  const warnings = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = unescapeExcelCell(r[colName]).slice(0, 80);
    if (!name) {
      skipped++;
      warnings.push(`${i + 1}행: 성함이 비어 있어 건너뛰었습니다.`);
      continue;
    }
    let partySize = colSize >= 0 ? parseHeadcountCell(r[colSize], isCompanionOnly) : 1;
    if (partySize > 20) {
      partySize = 20;
      warnings.push(`${i + 1}행(${name}): 인원수가 20명을 넘어 20명으로 조정했습니다.`);
    }
    const rawNote = colNote >= 0 && colNote !== colMessage ? unescapeExcelCell(r[colNote]) : '';
    const rawMessage = colMessage >= 0 ? unescapeExcelCell(r[colMessage]) : '';
    const noteParts = [
      rawNote,
      rawMessage ? `[축하] ${rawMessage}` : ''
    ].filter(Boolean);
    const note = noteParts.join(' · ').slice(0, 300);
    const rsvp = colRsvp >= 0 ? normalizeRsvpStatus(r[colRsvp]) : '미확인';
    const inviteStatus = colInvite >= 0
      ? normalizeInviteStatus(r[colInvite])
      : (isRsvpForm ? '모바일 발송' : '미발송');
    records.push({
      name,
      side: colSide >= 0 ? normalizeGuestSide(r[colSide]) : '공통',
      group: colGroup >= 0 ? normalizeGuestGroup(r[colGroup]) : '지인·기타',
      partySize,
      inviteStatus,
      rsvp,
      mealTicket: colMeal >= 0 ? normalizeMealTicket(r[colMeal]) : (rsvp !== '불참'),
      ...(note ? { note } : {})
    });
  }
  if (!records.length) throw new Error('가져올 수 있는 유효한 하객 행이 없습니다.');
  return { records, skipped, warnings, isRsvpForm };
}

export function syncGuestsFromCsv(existingList = [], incomingRecords = [], mode = 'skip', createId = () => 'guest-' + crypto.randomUUID().slice(0, 8)) {
  const list = existingList.map(item => ({ ...item }));
  const keyOf = (side, name) => `${side}|${String(name || '').trim().toLocaleLowerCase()}`;
  const nameOf = name => String(name || '').trim().toLocaleLowerCase();

  if (mode === 'all') {
    const additions = incomingRecords.map(rec => ({ id: createId(), ...rec }));
    const nextList = [...list, ...additions];
    return { nextList, addedCount: additions.length, updatedCount: 0, skippedCount: 0, overCap: nextList.length > 500 };
  }

  if (mode === 'update') {
    const bySideName = new Map();
    const byNameIndices = new Map();
    list.forEach((g, idx) => {
      bySideName.set(keyOf(g.side, g.name), idx);
      const nk = nameOf(g.name);
      if (!byNameIndices.has(nk)) byNameIndices.set(nk, []);
      byNameIndices.get(nk).push(idx);
    });
    let updatedCount = 0;
    let addedCount = 0;
    const touched = new Set();
    for (const rec of incomingRecords) {
      const exactKey = keyOf(rec.side, rec.name);
      let idx = bySideName.has(exactKey) ? bySideName.get(exactKey) : -1;
      if (idx === -1) {
        const sameNames = byNameIndices.get(nameOf(rec.name)) || [];
        if (sameNames.length === 1 && (rec.side === '공통' || list[sameNames[0]].side === '공통')) {
          idx = sameNames[0];
        }
      }
      if (idx >= 0) {
        const cur = list[idx];
        const mergedNote = !rec.note
          ? (cur.note || '')
          : (!cur.note || cur.note.includes(rec.note))
            ? (cur.note || rec.note)
            : `${cur.note} / ${rec.note}`.slice(0, 300);
        const nextSide = (cur.side === '공통' && rec.side !== '공통') ? rec.side : cur.side;
        const nextGroup = (cur.group === '지인·기타' && rec.group !== '지인·기타') ? rec.group : cur.group;
        const nextInvite = cur.inviteStatus === '미발송' && rec.inviteStatus !== '미발송' ? rec.inviteStatus : cur.inviteStatus;
        list[idx] = {
          ...cur,
          side: nextSide,
          group: nextGroup,
          partySize: rec.partySize,
          inviteStatus: nextInvite,
          rsvp: rec.rsvp !== '미확인' ? rec.rsvp : cur.rsvp,
          mealTicket: rec.mealTicket,
          ...(mergedNote ? { note: mergedNote } : {})
        };
        if (!touched.has(idx)) {
          touched.add(idx);
          updatedCount++;
        }
      } else {
        const nextItem = { id: createId(), ...rec };
        const newIdx = list.length;
        list.push(nextItem);
        bySideName.set(keyOf(nextItem.side, nextItem.name), newIdx);
        const nk = nameOf(nextItem.name);
        if (!byNameIndices.has(nk)) byNameIndices.set(nk, []);
        byNameIndices.get(nk).push(newIdx);
        addedCount++;
      }
    }
    return { nextList: list, addedCount, updatedCount, skippedCount: 0, overCap: list.length > 500 };
  }

  const seen = new Set(list.map(g => keyOf(g.side, g.name)));
  let addedCount = 0;
  let skippedCount = 0;
  for (const rec of incomingRecords) {
    const k = keyOf(rec.side, rec.name);
    if (seen.has(k)) {
      skippedCount++;
      continue;
    }
    seen.add(k);
    list.push({ id: createId(), ...rec });
    addedCount++;
  }
  return { nextList: list, addedCount, updatedCount: 0, skippedCount, overCap: list.length > 500 };
}

export function buildThankYouMessage(gift = {}, invitation = {}, variant = 'attended') {
  const recipient = (gift.name || '').trim() || '귀하';
  const p1 = (invitation.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (invitation.partner2 || '').replace(/^신부\s*/, '').trim();
  const couple = (p1 && p2) ? `${p1}·${p2}` : (p1 || p2 || '저희 두 사람');
  if (variant === 'remote') {
    return [
      `${recipient}님, 안녕하세요. ${couple}입니다.`,
      '',
      '바쁘신 와중에도 저희 결혼을 진심으로 축하해 주시고',
      '따뜻한 마음 전해 주셔서 깊이 감사드립니다.',
      '',
      '보내주신 축복을 오래도록 간직하며 서로 아끼고 예쁘게 잘 살겠습니다.',
      '조만간 직접 찾아뵙고 감사의 인사 드리겠습니다.',
      '늘 건강하시고 행복한 일만 가득하시길 바랍니다.'
    ].join('\n');
  }
  return [
    `${recipient}님, 안녕하세요. ${couple}입니다.`,
    '',
    '바쁘신 가운데서도 저희 결혼식에 귀한 걸음으로 함께해 주시고',
    '따뜻한 축복과 마음을 전해 주셔서 진심으로 감사드립니다.',
    '',
    '축복해 주신 마음 잊지 않고 서로 존중하며 행복하게 잘 살겠습니다.',
    '신혼여행 다녀온 후 다시 한 번 감사 인사드리겠습니다.',
    '늘 건강과 평안이 함께하시길 바랍니다.'
  ].join('\n');
}

export function computeCashDenominations(envelopes = []) {
  const tally = list => {
    let fiftyK = 0;
    let tenK = 0;
    let remainder = 0;
    let totalAmount = 0;
    let counted = 0;
    for (const item of list) {
      const amt = Number(item?.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      counted++;
      totalAmount += amt;
      const f = Math.floor(amt / 50000);
      const afterF = amt - f * 50000;
      const t = Math.floor(afterF / 10000);
      const rem = afterF - t * 10000;
      fiftyK += f;
      tenK += t;
      remainder += rem;
    }
    return { fiftyK, tenK, remainder, totalAmount, counted };
  };
  const safe = Array.isArray(envelopes) ? envelopes : [];
  return {
    all: tally(safe),
    pending: tally(safe.filter(e => !e?.ready))
  };
}

export function estimateBanquetTables(mealHeadcount = 0) {
  const n = Number.isFinite(Number(mealHeadcount)) && Number(mealHeadcount) > 0 ? Math.floor(Number(mealHeadcount)) : 0;
  return {
    headcount: n,
    tables8: n ? Math.ceil(n / 8) : 0,
    tables10: n ? Math.ceil(n / 10) : 0
  };
}

export function crossCheckGuestsAndGifts(guestList = [], giftLedger = []) {
  const norm = name => String(name || '').trim().replace(/\s+/g, '').toLocaleLowerCase();
  const guests = Array.isArray(guestList) ? guestList : [];
  const gifts = Array.isArray(giftLedger) ? giftLedger : [];
  const guestNameSet = new Set(guests.map(g => norm(g?.name)).filter(Boolean));
  const giftNameSet = new Set(gifts.map(g => norm(g?.name)).filter(Boolean));
  const attendingWithoutGift = [];
  let matchedGuestCount = 0;
  for (const guest of guests) {
    if (guest?.rsvp !== '참석') continue;
    const key = norm(guest?.name);
    if (!key) continue;
    if (giftNameSet.has(key)) matchedGuestCount++;
    else attendingWithoutGift.push(guest);
  }
  const giftsNotInGuestList = [];
  let matchedGiftCount = 0;
  for (const gift of gifts) {
    const key = norm(gift?.name);
    if (!key) continue;
    if (guestNameSet.has(key)) matchedGiftCount++;
    else giftsNotInGuestList.push(gift);
  }
  return {
    attendingWithoutGift,
    giftsNotInGuestList,
    matchedGuestCount,
    matchedGiftCount
  };
}
