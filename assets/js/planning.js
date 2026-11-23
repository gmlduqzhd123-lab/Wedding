const known=value=>Number.isSafeInteger(value)&&value>=0;
const venueFields={mealPrice:'1인 식대',guestCount:'예상 하객 수',minGuarantee:'최소 보증인원',hallFee:'대관료·연출료'};

export function venueEstimate(sim={}){
  const missing=Object.entries(venueFields).filter(([key])=>!known(sim?.[key])).map(([,label])=>label);
  const billedGuests=known(sim?.guestCount)&&known(sim?.minGuarantee)?Math.max(sim.guestCount,sim.minGuarantee):null;
  const mealTotal=known(sim?.mealPrice)&&billedGuests!==null?sim.mealPrice*billedGuests:null;
  const components=[mealTotal,known(sim?.hallFee)?sim.hallFee:null].filter(value=>value!==null);
  const subtotal=components.length?components.reduce((sum,value)=>sum+value,0):null;
  const complete=missing.length===0,total=complete?subtotal:null;
  const balance=total!==null&&known(sim?.deposit)?Math.max(0,total-sim.deposit):null;
  const overpaid=total!==null&&known(sim?.deposit)?Math.max(0,sim.deposit-total):0;
  return {missing,billedGuests,mealTotal,subtotal,complete,total,balance,overpaid};
}

export function studioFeeInfo(studio){
  const raw=studio.fee||'',unknown=raw.includes('별도 금액 표기 확인 안 됨');
  return {unknown,label:unknown?'💡 추가금 미확인':`💰 ${raw.replace(/^자료 표기:\s*/,'')}`};
}

export function weddingBudgetSummary(plan={},keys=[]){
  const summarize=field=>{
    const values=keys.map(key=>plan[key]?.[field]).filter(known);
    const entered=values.length,missing=keys.length-entered,complete=keys.length>0&&missing===0;
    return {known:entered?values.reduce((sum,value)=>sum+value,0):null,entered,missing,complete};
  };
  const planned=summarize('planned'),actual=summarize('actual');
  return {planned,actual,difference:planned.complete&&actual.complete?planned.known-actual.known:null};
}

const sdmFields={packageFee:'스드메 기본 계약금',helperFee:'촬영 헬퍼비',extraFee:'원본·보정본·기타 추가금'};

export function sdmEstimate(sim={}){
  const missing=Object.entries(sdmFields).filter(([key])=>!known(sim?.[key])).map(([,label])=>label);
  const roadFee=sim?.roadScene===true?170000:0;
  const nightFee=sim?.nightShoot===true?170000:0;
  const optionTotal=roadFee+nightFee;
  const hasOption=sim?.roadScene===true||sim?.nightShoot===true;
  const components=[
    known(sim?.packageFee)?sim.packageFee:null,
    known(sim?.helperFee)?sim.helperFee:null,
    known(sim?.extraFee)?sim.extraFee:null,
    hasOption?optionTotal:null
  ].filter(value=>value!==null);
  const subtotal=components.length?components.reduce((sum,value)=>sum+value,0):null;
  const complete=missing.length===0;
  const total=complete?sim.packageFee+sim.helperFee+sim.extraFee+optionTotal:null;
  const balance=total!==null&&known(sim?.deposit)?Math.max(0,total-sim.deposit):null;
  const overpaid=total!==null&&known(sim?.deposit)?Math.max(0,sim.deposit-total):0;
  const onSiteCash=known(sim?.helperFee)?sim.helperFee+optionTotal:null;
  return {missing,optionTotal,optionFee:optionTotal,onSiteCash,subtotal,complete,total,balance,overpaid};
}

function shiftIsoDate(dateStr,deltaDays){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr||'');
  if(!m)return null;
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+deltaDays));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function shootDeadlineSummary(shootDateStr,now=new Date()){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(shootDateStr||'');
  if(!m)return null;
  const targetDay=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const kst=new Date(now.getTime()+9*3600*1000);
  const todayKst=Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate());
  const daysLeft=Math.round((targetDay-todayKst)/86400000);
  const nightDeadline=shiftIsoDate(shootDateStr,-7);
  const preHolidayDate=shiftIsoDate(shootDateStr,-3);
  let penaltyIndex=-1,penaltyLabel='촬영일 경과';
  if(daysLeft>90){penaltyIndex=-1;penaltyLabel='위약금 부과 전 (90일 초과 전)';}
  else if(daysLeft>=61){penaltyIndex=0;penaltyLabel='현재 90일 전 구간 (취소 22만 / 변경 11만)';}
  else if(daysLeft>=31){penaltyIndex=1;penaltyLabel='현재 60일 전 구간 (취소 33만 / 변경 22만)';}
  else if(daysLeft>=21){penaltyIndex=2;penaltyLabel='현재 30일 전 구간 (취소 44만 / 변경 33만)';}
  else if(daysLeft>=11){penaltyIndex=3;penaltyLabel='현재 20일 전 구간 (취소 55만 / 변경 44만)';}
  else if(daysLeft>=1){penaltyIndex=4;penaltyLabel='현재 10일 전 구간 (취소 66만 / 변경 55만)';}
  else if(daysLeft===0){penaltyIndex=5;penaltyLabel='촬영 당일 구간 (취소 77만 / 변경 66만)';}
  return {
    daysLeft,
    nightDeadline,
    nightDaysLeft:daysLeft-7,
    preHolidayDate,
    preHolidayDaysLeft:daysLeft-3,
    penaltyIndex,
    penaltyLabel
  };
}

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
  if (s.includes('불참') || lower === 'x' || lower === 'n' || lower === 'no' || s === '아니오' || s === '아니요') return '불참';
  if (s.includes('미정') || s.includes('보류')) return '미정';
  if (s.includes('참석') || lower === 'o' || lower === 'y' || lower === 'yes' || s === '예' || s === '네') return '참석';
  return '미확인';
}

function normalizeMealTicket(raw) {
  const s = unescapeExcelCell(raw).replace(/\s+/g, '').toLowerCase();
  if (!s) return true;
  if (s.includes('미식사') || s.includes('답례품') || s === 'x' || s === 'n' || s === 'no' || s === 'false' || s === '아니오' || s === '안함') return false;
  return true;
}

export function parseGuestsCsv(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) throw new Error('헤더 행과 최소 1건 이상의 하객 행이 포함된 CSV 파일을 선택해 주세요.');
  const headers = rows[0].map(h => unescapeExcelCell(h).replace(/\s+/g, '').toLowerCase());
  const findCol = patterns => headers.findIndex(h => patterns.some(p => h === p || h.includes(p)));
  const colName = findCol(['성함', '이름', '하객', 'name']);
  if (colName === -1) throw new Error('CSV 첫 행에 ‘성함’ 또는 ‘이름’ 열이 필요합니다.');
  const colSide = findCol(['구분', '양가', 'side']);
  const colGroup = findCol(['관계', '분류', '그룹', '소속', 'group']);
  const colSize = findCol(['인원수', '인원', '동반', 'partysize']);
  const colInvite = findCol(['청첩장발송', '발송', '청첩장', 'invite']);
  const colRsvp = findCol(['참석여부', '참석', 'rsvp']);
  const colMeal = findCol(['식사여부', '식사', '식권', 'meal']);
  const colNote = findCol(['메모', '비고', 'note']);

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
    const sizeRaw = colSize >= 0 ? unescapeExcelCell(r[colSize]).replace(/[^\d]/g, '') : '';
    let partySize = sizeRaw ? Number.parseInt(sizeRaw, 10) : 1;
    if (!Number.isInteger(partySize) || partySize < 1) partySize = 1;
    if (partySize > 20) {
      partySize = 20;
      warnings.push(`${i + 1}행(${name}): 인원수가 20명을 넘어 20명으로 조정했습니다.`);
    }
    const note = colNote >= 0 ? unescapeExcelCell(r[colNote]).slice(0, 300) : '';
    records.push({
      name,
      side: colSide >= 0 ? normalizeGuestSide(r[colSide]) : '공통',
      group: colGroup >= 0 ? normalizeGuestGroup(r[colGroup]) : '지인·기타',
      partySize,
      inviteStatus: colInvite >= 0 ? normalizeInviteStatus(r[colInvite]) : '미발송',
      rsvp: colRsvp >= 0 ? normalizeRsvpStatus(r[colRsvp]) : '미확인',
      mealTicket: colMeal >= 0 ? normalizeMealTicket(r[colMeal]) : true,
      ...(note ? { note } : {})
    });
  }
  if (!records.length) throw new Error('가져올 수 있는 유효한 하객 행이 없습니다.');
  return { records, skipped, warnings };
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

export function addCalendarMonths(dateStr, deltaMonths) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1 + deltaMonths;
  const day = Number(m[3]);
  const targetYear = year + Math.floor(monthIdx / 12);
  const targetMonth = ((monthIdx % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function kstDayDiff(targetDateStr, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDateStr || '');
  if (!m) return null;
  const targetUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const todayUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return Math.round((targetUtc - todayUtc) / 86400000);
}

export function prenatalDeadlineSummary(schedule = {}, now = new Date()) {
  const appliedDate = schedule?.appliedDate || '';
  const visitDate = schedule?.visitDate || '';
  const examDate = schedule?.examDate || '';
  const claimed = Boolean(schedule?.claimed);

  const examDeadline = appliedDate ? addCalendarMonths(appliedDate, 3) : null;
  const claimDeadline = examDate ? addCalendarMonths(examDate, 1) : null;
  const examDaysLeft = examDeadline ? kstDayDiff(examDeadline, now) : null;
  const visitDaysLeft = visitDate ? kstDayDiff(visitDate, now) : null;
  const claimDaysLeft = claimDeadline ? kstDayDiff(claimDeadline, now) : null;

  let status = 'empty';
  let statusLabel = '일정 미입력';
  let urgent = false;

  if (claimed) {
    status = 'claimed';
    statusLabel = '지원금 청구 완료';
  } else if (claimDeadline) {
    if (claimDaysLeft < 0) {
      status = 'claim-overdue';
      statusLabel = `청구 기한 초과 (${Math.abs(claimDaysLeft)}일 경과)`;
      urgent = true;
    } else if (claimDaysLeft <= 7) {
      status = 'claim-urgent';
      statusLabel = claimDaysLeft === 0 ? '오늘 청구 마감!' : `청구 마감 D-${claimDaysLeft} 임박`;
      urgent = true;
    } else {
      status = 'claim-pending';
      statusLabel = `청구 마감 D-${claimDaysLeft}`;
    }
  } else if (examDeadline) {
    if (examDaysLeft < 0) {
      status = 'exam-overdue';
      statusLabel = `검사 기한 초과 (보건소 취소·재신청 필요)`;
      urgent = true;
    } else if (examDaysLeft <= 14) {
      status = 'exam-urgent';
      statusLabel = examDaysLeft === 0 ? '오늘 검사 마감!' : `검사 마감 D-${examDaysLeft} 임박`;
      urgent = true;
    } else {
      status = 'exam-pending';
      statusLabel = `검사 마감 D-${examDaysLeft}`;
    }
  } else if (visitDate) {
    status = 'visit-scheduled';
    statusLabel = visitDaysLeft === 0 ? '오늘 병원 예약일' : visitDaysLeft > 0 ? `병원 예약 D-${visitDaysLeft}` : `예약일 경과 (검사일 입력 권장)`;
  }

  return {
    appliedDate,
    visitDate,
    examDate,
    claimed,
    examDeadline,
    claimDeadline,
    examDaysLeft,
    visitDaysLeft,
    claimDaysLeft,
    status,
    statusLabel,
    urgent
  };
}

export function marriageBenefitTimeline(regDateStr, now = new Date()) {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(regDateStr || '')) return null;
  const congratsStart = addCalendarMonths(regDateStr, 6);
  const congratsEnd = addCalendarMonths(regDateStr, 18);
  const giftStart = addCalendarMonths(regDateStr, -24);
  const giftEnd = addCalendarMonths(regDateStr, 24);
  const regYear = Number(regDateStr.slice(0, 4));
  const daysToStart = kstDayDiff(congratsStart, now);
  const daysToEnd = kstDayDiff(congratsEnd, now);
  let congratsStatus = 'upcoming';
  if (daysToEnd < 0) congratsStatus = 'expired';
  else if (daysToStart <= 0) congratsStatus = 'open';
  return {
    regDate: regDateStr,
    regYear,
    congratsStart,
    congratsEnd,
    giftStart,
    giftEnd,
    daysToStart,
    daysToEnd,
    congratsStatus,
    taxNote: regYear <= 2026
      ? '2026년 12월 31일까지 혼인신고 시 현행 결혼세액공제(1인 50만 원 · 부부 최대 100만 원) 적용 대상입니다.'
      : '2027년 1월 1일 이후 혼인신고는 결혼세액공제 연장 또는 2027년 정부 예산안 「혼인지원금(부부 100만 원)」 전환 여부를 국세청·정부 최종 확정 공고로 확인하세요.'
  };
}

export function homeItemsSummary(items = []) {
  const list = Array.isArray(items) ? items : [];
  let totalCount = 0, doneCount = 0, contractedCount = 0;
  let plannedTotal = 0, plannedCount = 0;
  let actualTotal = 0, actualCount = 0;
  let depositTotal = 0;
  const byCategory = {};
  for (const item of list) {
    totalCount++;
    if (item?.status === '배송·설치 완료') doneCount++;
    if (item?.status === '계약·결제 완료' || item?.status === '배송·설치 완료') contractedCount++;
    if (known(item?.plannedPrice)) { plannedTotal += item.plannedPrice; plannedCount++; }
    if (known(item?.actualPrice)) { actualTotal += item.actualPrice; actualCount++; }
    if (known(item?.deposit)) depositTotal += item.deposit;
    const cat = item?.category || '📦 기타';
    if (!byCategory[cat]) byCategory[cat] = { count: 0, done: 0, planned: 0, actual: 0 };
    byCategory[cat].count++;
    if (item?.status === '배송·설치 완료') byCategory[cat].done++;
    if (known(item?.plannedPrice)) byCategory[cat].planned += item.plannedPrice;
    if (known(item?.actualPrice)) byCategory[cat].actual += item.actualPrice;
  }
  const balanceTotal = actualCount > 0 ? Math.max(0, actualTotal - depositTotal) : null;
  return {
    totalCount,
    doneCount,
    contractedCount,
    plannedTotal: plannedCount > 0 ? plannedTotal : null,
    actualTotal: actualCount > 0 ? actualTotal : null,
    depositTotal,
    balanceTotal,
    byCategory
  };
}

export function homeItemsToCsv(items = []) {
  const header = ['분류', '품목명', '브랜드·모델', '진행 상태', '목표 예산(원)', '계약·실제가(원)', '계약금(원)', '잔금(원)', '배송·설치일', '메모'];
  const rows = (Array.isArray(items) ? items : []).map(item => {
    const balance = known(item?.actualPrice) ? Math.max(0, item.actualPrice - (known(item?.deposit) ? item.deposit : 0)) : '';
    return [
      item.category || '',
      item.name || '',
      item.brand || '',
      item.status || '',
      known(item?.plannedPrice) ? item.plannedPrice : '',
      known(item?.actualPrice) ? item.actualPrice : '',
      known(item?.deposit) ? item.deposit : '',
      balance,
      item.deliveryDate || '',
      item.note || ''
    ];
  });
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function weddingDaySummary(roles = [], envelopes = []) {
  const rList = Array.isArray(roles) ? roles : [];
  const eList = Array.isArray(envelopes) ? envelopes : [];
  let assignedRoles = 0;
  for (const r of rList) {
    if ((r?.assignee || '').trim()) assignedRoles++;
  }
  let readyCount = 0, totalEnvelopeAmount = 0, readyAmount = 0;
  for (const env of eList) {
    const amt = known(env?.amount) ? env.amount : 0;
    totalEnvelopeAmount += amt;
    if (env?.ready) {
      readyCount++;
      readyAmount += amt;
    }
  }
  return {
    roleCount: rList.length,
    assignedRoles,
    envelopeCount: eList.length,
    readyCount,
    totalEnvelopeAmount,
    readyAmount,
    pendingAmount: Math.max(0, totalEnvelopeAmount - readyAmount)
  };
}

export const CEREMONY_PREP_ITEMS = [
  ['cchk-mc', '사회자 섭외 확정 및 아모르 12단계 진행 대본·박수 유도 큐 공유'],
  ['cchk-vows', '신랑·신부 혼인서약서(4가지 약속) 문구 확정 및 낭독 파트 분담·연습'],
  ['cchk-decl', '사회자용 성혼선언문 성함·예식일 확인 및 단상 비치용 인쇄 준비'],
  ['cchk-cue', '양가 어머님 화촉점화 동선 및 혼주 인사 순서(신부측→신랑측→중앙) 사전 공유'],
  ['cchk-song', '축가자·곡명 확정 및 진행 타이밍(혼주·내빈 인사 직후)·MR 음원 점검'],
  ['cchk-floor', '순천아모르웨딩컨벤션 피로연 연회홀 층수 확인 및 폐회식 안내 멘트 반영']
];

export const PRENATAL_CHECK_ITEMS = [
  ['pchk-budget', '순천시 보건소(061-749-6916~9) 또는 e보건소에서 당해 연도 지원사업 접수 가능 여부 확인'],
  ['pchk-apply', '검사 받기 전 e보건소 온라인(또는 보건소 방문)으로 신랑·신부 각자 「임신 사전건강관리 지원사업」 신청'],
  ['pchk-referral', '보건소 승인 완료 및 검사의뢰서 발급 확인(출력 또는 모바일 저장) — 발급 전 검사 시 소급 불가'],
  ['pchk-hospital', '순천 현대여성아동병원(061-720-1111)에 참여 의료기관 여부·산부인과/난임센터 예약·금식/금욕 조건 문의'],
  ['pchk-suncheon', '순천시 신혼(예비)부부 건강검진(남녀 각 최대 4만 원)·예비부모 엽산제(총 6갑) 병행 가능 여부 및 지정 병원 확인'],
  ['pchk-exam', '신분증·검사의뢰서 지참해 산전검사 수검 및 전문의 결과 상담 완료 (신청일로부터 3개월 이내)'],
  ['pchk-receipt', '수납 시 진료비 영수증 + 진료비 세부내역서 발급 보관 (남성 정액검사 정자정밀형태검사 포함 여부 확인)'],
  ['pchk-claim', '검사일로부터 1개월 이내 e보건소(또는 보건소)에 영수증·세부내역서·통장사본 제출해 지원금 청구 완료']
];

export const WEDDING_BUDGET_CATEGORIES = [
  ['venue', '🏛️ 웨딩홀·식대·대관료', 'seg-airfare', '대관료·식대·연출·꽃장식'],
  ['sdm', '👗 스튜디오·드레스·메이크업', 'seg-lodging', '촬영·본식 드레스·메이크업·추가금'],
  ['snap', '📸 본식스냅·DVD·부케·진행', 'seg-other', '본식스냅·영상·부케·사회/축가'],
  ['rings', '💍 예물·예복·한복·예단', 'seg-reserve', '웨딩밴드·신랑 예복·혼주 한복'],
  ['honeymoon', '✈️ 신혼여행 (항공·숙박·현지)', 'seg-honeymoon', '선택 여행지 2인 계획예산 연동 가능'],
  ['living', '🛋️ 혼수·가전·가구·기타 예비비', 'seg-living', '가전·가구·청첩장·답례품·예비비']
];

export const DEFAULT_VENDOR_SCHEDULES = [
  {
    id: 'vsched-lachma-shoot',
    category: '📸 스튜디오',
    name: '라크마 스튜디오 웨딩촬영 (낮 12시)',
    date: '2027-02-03',
    done: false,
    note: '2027년 2월 3일 수요일 12:00 확정 (062-714-1970~1 · 월·화 휴무) · STEP1 루나메이크업(광주 남구 천변좌로 432 1층) → STEP2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수) · 당일 현금 헬퍼비 25만 원·실리콘 누브라·검정 긴 양말·어두운 구두·한 입 간식 준비'
  }
];

export function activeVendorSchedules(prefs) {
  return prefs?.vendorSchedules !== undefined ? prefs.vendorSchedules : structuredClone(DEFAULT_VENDOR_SCHEDULES);
}

const VALID_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function collectMasterTimeline({ content = {}, prefs = {}, studio = null, now = new Date() } = {}) {
  const items = [];
  const push = entry => {
    if (!entry?.date || !VALID_YMD.test(entry.date)) return;
    const daysLeft = kstDayDiff(entry.date, now);
    items.push({
      ...entry,
      monthKey: entry.date.slice(0, 7),
      daysLeft,
      done: Boolean(entry.done),
      urgent: Boolean(entry.urgent)
    });
  };

  // 1. Studio shoot & free-change deadline
  const shootDate = studio?.deepGuide?.schedule?.date || '2027-02-03';
  const shootTime = studio?.deepGuide?.schedule?.time || '12:00';
  const studioName = studio?.name || '라크마';
  const shootDeadline = shootDeadlineSummary(shootDate, now);
  if (shootDeadline?.freeChangeUntil) {
    push({
      id: 'master-studio-free-change',
      date: shootDeadline.freeChangeUntil,
      category: '📸 스튜디오',
      title: `${studioName} 스튜디오 무료 일정 변경 마감`,
      detail: '촬영 60일 전까지 무료 변경 가능 · 이후 위약금 구간 적용',
      location: '광주광역시 남구 중앙로 117 (라크마 스튜디오)',
      route: 'studios',
      done: kstDayDiff(shootDeadline.freeChangeUntil, now) < 0
    });
  }
  const vList = activeVendorSchedules(prefs);
  const lachmaVendor = vList.find(v => v.id === 'vsched-lachma-shoot');
  push({
    id: 'master-studio-shoot',
    date: shootDate,
    time: shootTime,
    category: '📸 스튜디오',
    title: `${studioName} 웨딩촬영 (${shootTime})`,
    detail: 'STEP1 루나메이크업(1층) → STEP2 라크마 스튜디오(중앙로 117) · 헬퍼비 현금 25만 원',
    location: '광주광역시 남구 중앙로 117 (라크마 스튜디오)',
    route: 'studios',
    done: Boolean(lachmaVendor?.done)
  });

  // 2. Wedding ceremony
  const inv = content?.invitation || {};
  if (inv.date && VALID_YMD.test(inv.date)) {
    const names = [inv.partner1, inv.partner2].map(v => (v || '').trim()).filter(Boolean).join(' & ');
    push({
      id: 'master-wedding-day',
      date: inv.date,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(inv.time || '') ? inv.time : '',
      category: '💍 본식',
      title: names ? `${names} 결혼식` : '우리의 결혼식',
      detail: [inv.venue, inv.time].filter(Boolean).join(' · ') || '본식 예식일',
      location: [inv.venue, inv.address].filter(Boolean).join(' · '),
      route: 'ceremony'
    });
  }

  // 3. Honeymoon
  const trips = content?.honeymoon || [];
  const selectedTrip = trips.find(t => t.id === prefs?.tripSelected);
  if (selectedTrip?.startDate && VALID_YMD.test(selectedTrip.startDate)) {
    push({
      id: `master-honeymoon-${selectedTrip.id}`,
      date: selectedTrip.startDate,
      endDate: VALID_YMD.test(selectedTrip.endDate || '') && selectedTrip.endDate >= selectedTrip.startDate ? selectedTrip.endDate : '',
      category: '✈️ 신혼여행',
      title: `신혼여행 · ${selectedTrip.title}`,
      detail: selectedTrip.endDate ? `${selectedTrip.startDate} ~ ${selectedTrip.endDate} (최종 선택)` : '최종 선택 여행 출발',
      location: selectedTrip.country || '',
      route: 'honeymoon'
    });
  } else if (trips.length && VALID_YMD.test(trips[0]?.startDate || '')) {
    const start = trips[0].startDate;
    const end = VALID_YMD.test(trips[0]?.endDate || '') ? trips[0].endDate : '';
    if (trips.every(t => t.startDate === start && (t.endDate || '') === end)) {
      push({
        id: 'master-honeymoon-window',
        date: start,
        endDate: end && end >= start ? end : '',
        category: '✈️ 신혼여행',
        title: '신혼여행 출국·귀국 예정 기간',
        detail: end ? `${start} ~ ${end} · 후보 ${trips.length}곳 검토 중` : `후보 ${trips.length}곳 검토 중`,
        route: 'honeymoon'
      });
    }
  }

  // 4. Prenatal schedule & deadlines
  const pSched = prenatalDeadlineSummary(prefs?.prenatalSchedule || {}, now);
  if (pSched.visitDate) {
    push({
      id: 'master-prenatal-visit',
      date: pSched.visitDate,
      category: '🩺 산전검사',
      title: '순천 현대여성아동병원 산전검사 예약',
      detail: '신분증·보건소 검사의뢰서 지참 (061-720-1111)',
      location: '전라남도 순천시 장선배기1길 8 (현대여성아동병원)',
      route: 'prenatal',
      done: Boolean(pSched.examDate || pSched.claimed)
    });
  }
  if (pSched.examDeadline && !pSched.examDate && !pSched.claimed) {
    push({
      id: 'master-prenatal-exam-deadline',
      date: pSched.examDeadline,
      category: '🩺 산전검사',
      title: '산전검사 완료 마감 (신청 후 3개월)',
      detail: `e보건소 신청일(${pSched.appliedDate}) 기준 3개월 내 참여 병원 검사 완료`,
      location: '전라남도 순천시 장선배기1길 8 (현대여성아동병원)',
      route: 'prenatal',
      urgent: pSched.status === 'exam-urgent' || pSched.status === 'exam-overdue'
    });
  }
  if (pSched.claimDeadline && !pSched.claimed) {
    push({
      id: 'master-prenatal-claim-deadline',
      date: pSched.claimDeadline,
      category: '🩺 산전검사',
      title: '산전검사 지원금 청구 마감 (검사 후 1개월)',
      detail: `검사일(${pSched.examDate}) 기준 1개월 내 e보건소 청구 (영수증·세부내역서·통장사본)`,
      location: 'e보건소 온라인 / 순천시 보건소 모자보건실',
      route: 'prenatal',
      urgent: pSched.status === 'claim-urgent' || pSched.status === 'claim-overdue'
    });
  }

  // 5. Vendor schedules (excluding duplicate default lachma shoot)
  for (const v of vList) {
    if (!v?.date || !VALID_YMD.test(v.date)) continue;
    if (v.id === 'vsched-lachma-shoot' && v.date === shootDate) continue;
    push({
      id: `master-vendor-${v.id}`,
      date: v.date,
      category: v.category || '🗓️ 업체 일정',
      title: v.name,
      detail: v.note || '업체 일정 보드 등록 항목',
      route: 'tips',
      subTab: 'schedule',
      done: Boolean(v.done)
    });
  }

  // 6. Home / appliances delivery dates
  for (const item of prefs?.homeItems || []) {
    if (!item?.deliveryDate || !VALID_YMD.test(item.deliveryDate)) continue;
    push({
      id: `master-home-${item.id}`,
      date: item.deliveryDate,
      category: '🏠 혼수·배송',
      title: `${item.name}${item.brand ? ` (${item.brand})` : ''} 배송·설치`,
      detail: [item.status, item.note].filter(Boolean).join(' · ') || '신혼집 혼수 배송 예정',
      route: 'tips',
      subTab: 'home',
      done: item.status === '배송·설치 완료'
    });
  }

  // 7. Marriage registration & Suncheon marriage grant window
  if (prefs?.marriageRegDate && VALID_YMD.test(prefs.marriageRegDate)) {
    const timeline = marriageBenefitTimeline(prefs.marriageRegDate, now);
    push({
      id: 'master-marriage-reg',
      date: prefs.marriageRegDate,
      category: '🏛️ 혼인·혜택',
      title: '혼인신고(예정)일',
      detail: '순천시청 신청사(장명로 30) 종합민원실 · 증인 2명 기재 신고서·신분증 지참',
      location: '전라남도 순천시 장명로 30 (순천시청 신청사)',
      route: 'tips',
      subTab: 'benefits',
      done: (prefs.benefitChecks || []).includes('bchk-reg')
    });
    if (timeline?.congratsStart) {
      push({
        id: 'master-suncheon-grant-start',
        date: timeline.congratsStart,
        category: '🏛️ 혼인·혜택',
        title: '순천 청년부부 결혼축하금(200만 원) 신청 시작',
        detail: `신청 가능 구간 ${timeline.congratsStart} ~ ${timeline.congratsEnd} · 행정복지센터·전남 아이톡`,
        location: '주소지 읍·면·동 행정복지센터 / 전남 아이톡',
        route: 'tips',
        subTab: 'benefits',
        done: (prefs.benefitChecks || []).includes('bchk-congrats')
      });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99') || a.id.localeCompare(b.id));
  return items;
}



