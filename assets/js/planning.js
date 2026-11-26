import {
  guestListSummary,
  giftLedgerSummary,
  csvEscape,
  guestsToCsv,
  giftsToCsv,
  parseCsvRows,
  RSVP_FORM_GUIDE_TEXT,
  parseGuestsCsv,
  syncGuestsFromCsv,
  buildThankYouMessage,
  computeCashDenominations,
  estimateBanquetTables,
  crossCheckGuestsAndGifts
} from './ledger.js?v=wedding-features-67';

export {
  guestListSummary,
  giftLedgerSummary,
  csvEscape,
  guestsToCsv,
  giftsToCsv,
  parseCsvRows,
  RSVP_FORM_GUIDE_TEXT,
  parseGuestsCsv,
  syncGuestsFromCsv,
  buildThankYouMessage,
  computeCashDenominations,
  estimateBanquetTables,
  crossCheckGuestsAndGifts
};

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
  const freeChangeUntil=shiftIsoDate(shootDateStr,-91);
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
    freeChangeUntil,
    nightDeadline,
    nightDaysLeft:daysLeft-7,
    preHolidayDate,
    preHolidayDaysLeft:daysLeft-3,
    penaltyIndex,
    penaltyLabel
  };
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
  ['cchk-mc', '사회자(김희엽 친구) 확정 및 아모르 12단계 진행 대본·박수 유도 큐 공유'],
  ['cchk-vows', '신랑·신부 혼인서약서(4가지 약속) 문구 확정 및 낭독 파트 분담·연습'],
  ['cchk-decl', '교장선생님 성혼선언문 낭독 및 축사 사전 협의·단상 비치용 인쇄 준비'],
  ['cchk-cue', '양가 어머님 화촉점화 동선 및 혼주 인사 순서(신부측→신랑측→중앙) 사전 공유'],
  ['cchk-song', '축가(아카펠라) 곡명·타이밍(혼주·내빈 인사 직후) 및 마이크 인원수·음향 점검'],
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
      title: `${studioName} 위약금 부과 전 무료 일정 변경 마감`,
      detail: '촬영 90일 초과 전까지 무료 변경·취소 가능 · 이후 단계별 위약금 구간 적용',
      location: '광주광역시 남구 중앙로 117 (라크마 스튜디오)',
      route: 'studios',
      done: kstDayDiff(shootDeadline.freeChangeUntil, now) < 0
    });
  }
  if (shootDeadline?.nightDeadline) {
    push({
      id: 'master-studio-night-deadline',
      date: shootDeadline.nightDeadline,
      category: '📸 스튜디오',
      title: `${studioName} 야간촬영 신청 마감 (D-7)`,
      detail: '야간 씬 추가(+17만 원) 희망 시 촬영 7일 전까지 스튜디오 확정 필수',
      location: '광주광역시 남구 중앙로 117 (라크마 스튜디오)',
      route: 'studios',
      done: kstDayDiff(shootDeadline.nightDeadline, now) < 0
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
      subTab: 'subsidy',
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
      subTab: 'subsidy',
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
    if (timeline?.congratsEnd) {
      push({
        id: 'master-suncheon-grant-end',
        date: timeline.congratsEnd,
        category: '🏛️ 혼인·혜택',
        title: '순천 청년부부 결혼축하금(200만 원) 신청 마감',
        detail: `혼인신고 1년 6개월 이내 마감 · 신청 시작 ${timeline.congratsStart}`,
        location: '주소지 읍·면·동 행정복지센터 / 전남 아이톡',
        route: 'tips',
        subTab: 'benefits',
        done: (prefs.benefitChecks || []).includes('bchk-congrats'),
        urgent: !(prefs.benefitChecks || []).includes('bchk-congrats') && kstDayDiff(timeline.congratsEnd, now) <= 30
      });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99') || a.id.localeCompare(b.id));
  return items;
}

export function weddingPhaseInfo({ content = {}, prefs = {}, studio = null, now = new Date() } = {}) {
  const inv = content?.invitation || {};
  const shootDate = studio?.deepGuide?.schedule?.date || '2027-02-03';
  const weddingDate = VALID_YMD.test(inv.date || '') ? inv.date : '';
  const shootDiff = VALID_YMD.test(shootDate) ? kstDayDiff(shootDate, now) : null;
  const weddingDiff = weddingDate ? kstDayDiff(weddingDate, now) : null;

  const trips = content?.honeymoon || [];
  const selectedTrip = trips.find(t => t.id === prefs?.tripSelected) || null;
  const tripStart = selectedTrip?.startDate || (trips.length && trips.every(t => t.startDate === trips[0].startDate) ? trips[0].startDate : '');
  const tripDiff = VALID_YMD.test(tripStart || '') ? kstDayDiff(tripStart, now) : null;

  const gSum = guestListSummary(prefs?.guestList || []);
  const giftSum = giftLedgerSummary(prefs?.giftLedger || []);
  const daySum = weddingDaySummary(prefs?.weddingDayRoles || [], prefs?.weddingDayEnvelopes || []);
  const shootTotal = (studio?.deepGuide?.prepChecklist || []).reduce((acc, grp) => acc + (grp.items?.length || 0), 0);
  const shootDone = (prefs?.shootChecklist || []).length;
  const albumCount = (content?.albums || []).length;
  const invReadyCount = [
    Boolean(inv.partner1?.trim() && inv.partner2?.trim()),
    Boolean(inv.date && inv.time && inv.venue?.trim()),
    Boolean(inv.message?.trim()),
    Boolean(inv.groomParents?.trim() || inv.brideParents?.trim()),
    Boolean(inv.transit?.trim() || inv.notice?.trim()),
    Boolean(inv.contacts?.trim() || inv.groomAccounts?.trim() || inv.brideAccounts?.trim()),
    Boolean(inv.rsvpUrl?.trim()),
    albumCount > 0
  ].filter(Boolean).length;

  if (weddingDiff === 0) {
    return {
      phase: 'wedding-day',
      badge: '💍 WEDDING DAY · 본식 당일 실행 모드',
      title: '오늘은 두 사람의 결혼식 날입니다',
      subtitle: '현장 식순 큐시트, 축의대 빠른 입력, 당일 역할·현금 봉투를 한 번의 터치로 바로 여세요.',
      metrics: [
        `당일 역할 배정 ${daySum.assignedRoles}/${daySum.roleCount || 6}`,
        `현금 봉투 준비 ${daySum.readyCount}/${daySum.envelopeCount}`,
        `축의금 기록 ${giftSum.totalRecords}건 · 식권 ${giftSum.totalMealTickets}매`
      ],
      actions: [
        { label: '⚡ 축의대 빠른 입력', route: 'ceremony', subTab: 'gifts', action: 'quick-gift', primary: true },
        { label: '📋 당일 역할·봉투표', route: 'ceremony', subTab: 'dayops' },
        { label: '🎤 본식 식순 큐시트', route: 'ceremony', subTab: 'rundown' },
        { label: '💌 모바일 청첩장', route: 'invitation' }
      ]
    };
  }

  if (weddingDiff !== null && weddingDiff < 0) {
    const daysAfter = Math.abs(weddingDiff);
    const inHoneymoonWindow = tripDiff !== null && tripDiff >= -7 && tripDiff <= 14;
    return {
      phase: 'post-wedding',
      badge: `✨ 예식 완료 D+${daysAfter} · 사후 정산·신혼 단계`,
      title: inHoneymoonWindow
        ? '신혼여행 일정과 축의금 감사·혼인신고를 함께 정리해요'
        : '축의금 감사 인사와 혼인신고·순천 신혼부부 혜택을 챙겨요',
      subtitle: giftSum.thankYouPending > 0
        ? `아직 감사 인사를 보내지 않은 분이 ${giftSum.thankYouPending}건 남아 있습니다.`
        : '축의금 정산과 혼인신고·지원금 신청 기한을 놓치지 않게 확인하세요.',
      metrics: [
        `축의금 정산 ${giftSum.totalRecords}건 (${giftSum.totalAmount.toLocaleString('ko-KR')}원)`,
        `감사 미완료 ${giftSum.thankYouPending}건 · 답례품 미전달 ${giftSum.returnGiftPending}건`,
        prefs?.marriageRegDate ? `혼인신고 ${prefs.marriageRegDate}` : '혼인신고일 미입력'
      ],
      actions: [
        { label: '💬 감사 인사 · 축의금 정산', route: 'ceremony', subTab: 'gifts', primary: true },
        { label: '✈️ 신혼여행 일정·짐 점검', route: 'honeymoon' },
        { label: '🏛️ 혼인신고·순천 혜택', route: 'tips', subTab: 'benefits' }
      ]
    };
  }

  if (weddingDiff !== null && weddingDiff >= 1 && weddingDiff <= 14) {
    return {
      phase: 'ceremony-countdown',
      badge: `💍 본식 D-${weddingDiff} · 최종 리허설 주간`,
      title: '당일 역할·현금 봉투·하객 식권과 출국 짐을 최종 확정하세요',
      subtitle: '예식장 지하·현장에서 오프라인으로 바로 열 수 있도록 당일 운영표와 하객 명부를 인쇄·백업해 두세요.',
      metrics: [
        `참석 확정 ${gSum.attendingHeadcount}명 (예상 ${gSum.possibleHeadcount}명)`,
        `당일 역할 ${daySum.assignedRoles}/${daySum.roleCount} · 봉투 ${daySum.readyCount}/${daySum.envelopeCount}`,
        selectedTrip ? `신혼여행: ${selectedTrip.title}` : '신혼여행 최종 선택 확인'
      ],
      actions: [
        { label: '📋 당일 역할·봉투표', route: 'ceremony', subTab: 'dayops', primary: true },
        { label: '👥 하객·식권 최종 확인', route: 'ceremony', subTab: 'guests' },
        { label: '✈️ 출국 짐 체크리스트', route: 'honeymoon' }
      ]
    };
  }

  if (shootDiff !== null && shootDiff >= 0 && shootDiff <= 14) {
    return {
      phase: 'shoot-week',
      badge: `📸 라크마 촬영 ${shootDiff === 0 ? 'D-Day' : `D-${shootDiff}`} · 최종 점검`,
      title: '루나메이크업 → 라크마 스튜디오 당일 동선과 준비물을 확인하세요',
      subtitle: '당일 현금 헬퍼비 25만 원, 예약 5~10분 전 도착, 월·화 정기휴무 전 최종 문의를 꼭 점검하세요.',
      metrics: [
        `촬영 준비물 ${shootDone}/${shootTotal || 12} 완료`,
        '헬퍼비 25만 원 (당일 현금 필수)',
        `본식까지 ${weddingDiff !== null ? `D-${weddingDiff}` : '일정 확인'}`
      ],
      actions: [
        { label: '📸 라크마 당일 가이드 열기', route: 'studios', primary: true },
        { label: '🩺 산전검사 일정 확인', route: 'prenatal', subTab: 'subsidy' },
        { label: '🗓️ 업체 일정 보드', route: 'tips', subTab: 'schedule' }
      ]
    };
  }

  if (shootDiff !== null && shootDiff < 0 && weddingDiff !== null && weddingDiff > 14) {
    return {
      phase: 'invitation-prep',
      badge: `💌 청첩장 발행 & 본식 D-${weddingDiff}`,
      title: '웨딩 촬영 사진을 앨범에 담고 모바일 청첩장을 발행할 시기예요',
      subtitle: '사진 최적화 스크립트(npm run photos)로 가볍게 등록하고, 하객 RSVP 설문과 본식 식순을 마무리하세요.',
      metrics: [
        `청첩장 발행 준비도 ${invReadyCount}/8`,
        `등록 앨범 ${albumCount}개`,
        `하객 ${gSum.totalRecords}건 · 발송 ${gSum.sentCount}건`
      ],
      actions: [
        { label: '💌 청첩장 점검 · 발행', route: 'invitation', primary: true },
        { label: '📷 포토 앨범 등록', route: 'albums' },
        { label: '👥 하객 · RSVP 동기화', route: 'ceremony', subTab: 'guests' }
      ]
    };
  }

  return {
    phase: 'pre-shoot',
    badge: `🌿 웨딩 준비 집중 보드 · 촬영 ${shootDiff !== null ? `D-${shootDiff}` : '예정'}${weddingDiff !== null ? ` · 본식 D-${weddingDiff}` : ''}`,
    title: '라크마 촬영 준비 · 산전검사 · 신혼여행 큰 틀을 차근차근 다져요',
    subtitle: '촬영 무료 변경 기한과 산전검사 지원금 신청, 신혼여행 후보 비교와 6대 예산을 먼저 정리해 두면 이후가 훨씬 편해집니다.',
    metrics: [
      `라크마 촬영 ${shootDate} (${shootTotal ? `준비물 ${shootDone}/${shootTotal}` : '공식 가이드'})`,
      selectedTrip ? `신혼여행 확정: ${selectedTrip.title}` : `신혼여행 후보 ${trips.length}곳 비교 중`,
      `청첩장 발행 준비도 ${invReadyCount}/8`
    ],
    actions: [
      { label: '📸 라크마 촬영 가이드', route: 'studios', primary: true },
      { label: '🩺 산전검사 · 지원금', route: 'prenatal', subTab: 'subsidy' },
      { label: '✈️ 신혼여행 비교', route: 'honeymoon' },
      { label: '💰 통합 예산 관리', route: 'tips', subTab: 'budget' }
    ]
  };
}

export function netWeddingCostSummary(budgetPlan = {}, giftLedger = [], categories = WEDDING_BUDGET_CATEGORIES.map(([key]) => key)) {
  const budget = weddingBudgetSummary(budgetPlan, categories);
  const gifts = giftLedgerSummary(giftLedger);
  const actualKnown = budget.actual.known;
  const plannedKnown = budget.planned.known;
  const giftTotal = gifts.totalAmount;
  const hasAny = actualKnown !== null || plannedKnown !== null || giftTotal > 0;
  const netActual = actualKnown !== null ? actualKnown - giftTotal : null;
  const coveragePct = actualKnown && actualKnown > 0
    ? Math.round((giftTotal / actualKnown) * 100)
    : null;
  return {
    hasAny,
    plannedKnown,
    actualKnown,
    actualComplete: budget.actual.complete,
    giftTotal,
    giftCount: gifts.totalRecords,
    netActual,
    coveragePct
  };
}

export function budgetPlanToCsv(budgetPlan = {}, giftLedger = []) {
  const keys = WEDDING_BUDGET_CATEGORIES.map(([key]) => key);
  const budget = weddingBudgetSummary(budgetPlan, keys);
  const net = netWeddingCostSummary(budgetPlan, giftLedger, keys);
  const header = ['항목', '목표 예산(원)', '실제 지출·계약(원)', '잔액·차액(원)', '메모'];
  const rows = WEDDING_BUDGET_CATEGORIES.map(([key, title]) => {
    const entry = budgetPlan?.[key] || {};
    const planned = known(entry.planned) ? entry.planned : null;
    const actual = known(entry.actual) ? entry.actual : null;
    const diff = planned !== null && actual !== null ? planned - actual : null;
    return [
      title.replace(/^[^\s]+\s*/, ''),
      planned === null ? '' : planned,
      actual === null ? '' : actual,
      diff === null ? '' : diff,
      entry.note || ''
    ];
  });
  rows.push([
    '6대 항목 합계',
    budget.planned.known === null ? '' : budget.planned.known,
    budget.actual.known === null ? '' : budget.actual.known,
    budget.difference === null ? '' : budget.difference,
    `목표 ${budget.planned.entered}/6 · 실제 ${budget.actual.entered}/6`
  ]);
  if (net.giftCount > 0 || net.actualKnown !== null) {
    rows.push(['축의금 합계', '', net.giftTotal, '', `${net.giftCount}건 기준`]);
    rows.push([
      '축의금 반영 실부담액',
      '',
      net.netActual === null ? '' : net.netActual,
      '',
      net.coveragePct !== null ? `축의금 충당률 ${net.coveragePct}%` : '실제 지출 입력 필요'
    ]);
  }
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function buildBudgetSummaryText(budgetPlan = {}, giftLedger = []) {
  const keys = WEDDING_BUDGET_CATEGORIES.map(([key]) => key);
  const budget = weddingBudgetSummary(budgetPlan, keys);
  const net = netWeddingCostSummary(budgetPlan, giftLedger, keys);
  const fmt = v => (v === null ? '미입력' : `${v.toLocaleString('ko-KR')}원`);
  const lines = ['[결혼 준비 통합 예산 요약]', ''];
  for (const [key, title] of WEDDING_BUDGET_CATEGORIES) {
    const entry = budgetPlan?.[key] || {};
    const p = known(entry.planned) ? entry.planned : null;
    const a = known(entry.actual) ? entry.actual : null;
    const note = entry.note ? ` (${entry.note})` : '';
    lines.push(`• ${title.replace(/^[^\s]+\s*/, '')}: 목표 ${fmt(p)} / 실제 ${fmt(a)}${note}`);
  }
  lines.push('');
  lines.push(`▶ 목표 예산 (${budget.planned.entered}/6): ${fmt(budget.planned.known)}`);
  lines.push(`▶ 실제 지출·계약 (${budget.actual.entered}/6): ${fmt(budget.actual.known)}`);
  if (budget.difference !== null) {
    lines.push(`▶ 예산 대비 차액: ${budget.difference >= 0 ? `여유 ${fmt(budget.difference)}` : `초과 ${fmt(-budget.difference)}`}`);
  }
  if (net.giftCount > 0) {
    lines.push(`▶ 축의금 합계 (${net.giftCount}건): ${fmt(net.giftTotal)}`);
    if (net.netActual !== null) {
      const label = net.netActual < 0 ? `잉여 +${fmt(-net.netActual)}` : fmt(net.netActual);
      lines.push(`▶ 축의금 반영 실부담액: ${label}${net.coveragePct !== null ? ` (충당률 ${net.coveragePct}%)` : ''}`);
    }
  }
  return lines.join('\n');
}





