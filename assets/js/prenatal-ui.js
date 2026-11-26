import { E, button, externalLink, downloadText, enhanceTablistKeyboard } from './dom.js?v=wedding-features-61';
import { scheduleCalendar, scheduleGoogleCalendarUrl } from './calendar.js?v=wedding-features-61';
import { PRENATAL_CHECK_ITEMS, prenatalDeadlineSummary } from './planning.js?v=wedding-features-61';

export { PRENATAL_CHECK_ITEMS };

let prenatalSubTab = 'hospital';
export function setPrenatalSubTab(tab) {
  if (['hospital', 'subsidy', 'guide'].includes(tab)) prenatalSubTab = tab;
}

const HOSPITAL_INFO = {
  shortName: '순천 현대여성아동병원',
  officialName: '의료법인 내일의료재단 현대여성아동병원',
  address: '전라남도 순천시 장선배기1길 8 (조례동)',
  postal: '57968',
  mainPhone: '061-720-1111',
  altPhone: '061-720-1105',
  kakaoUrl: 'https://pf.kakao.com/_UtSnj',
  naverMapUrl: 'https://map.naver.com/p/search/%EC%88%9C%EC%B2%9C%20%ED%98%84%EB%8C%80%EC%97%AC%EC%84%B1%EC%95%84%EB%8F%99%EB%B3%91%EC%9B%90',
  kakaoMapUrl: 'https://map.kakao.com/?q=%EC%88%9C%EC%B2%9C%20%ED%98%84%EB%8C%80%EC%97%AC%EC%84%B1%EC%95%84%EB%8F%99%EB%B3%91%EC%9B%90',
  eHealthUrl: 'https://www.e-health.go.kr/gh/caSrvcGud/selectMdclSupGudInfo.do?heBiz=PG00003&menuId=200097',
  easyLawUrl: 'https://easylaw.go.kr/CSP/CnpClsMainBtr.laf?popMenu=ov&csmSeq=735&ccfNo=1&cciNo=1&cnpClsNo=2',
  suncheonHealthUrl: 'https://health.suncheon.go.kr',
  suncheonCityUrl: 'https://www.suncheon.go.kr'
};

const HEALTH_CENTER = {
  name: '순천시 보건소 (모자보건실)',
  address: '전라남도 순천시 중앙로 232 (석현동, 순천시문화건강센터)',
  maternalPhone: '061-749-6916',
  maternalPhoneRange: '061-749-6916 ~ 9',
  mainPhone: '061-749-6905',
  naverMapUrl: 'https://map.naver.com/p/search/%EC%88%9C%EC%B2%9C%EC%8B%9C%EB%B3%B4%EA%B1%B4%EC%86%8C'
};

const SUBSIDY_STEPS = [
  [
    'STEP 01',
    '사전 지원 신청',
    '검사 받기 전 필수',
    '공공보건포털 e보건소(민원서비스 → 의료비지원 → 임신 사전건강관리 지원)에서 온라인 신청하거나, 주소지 관할 보건소(순천시 보건소 모자보건실)에 방문 신청합니다. 내국인 온라인 신청 시 행정정보 공동이용 동의로 별도 첨부서류가 필요 없습니다.'
  ],
  [
    'STEP 02',
    '보건소 승인 & 검사의뢰서 발급',
    '신청 후 영업일 5일 이내',
    '관할 보건소에서 대상 여부 확인 후 시스템으로 「검사의뢰서」를 발급합니다. ⚠️ 반드시 의뢰서 발급이 완료된 것을 확인한 뒤에 병원에서 검사해야 하며, 승인 전 검사는 소급 지원되지 않습니다.'
  ],
  [
    'STEP 03',
    '참여 의료기관 예약 · 검사 수검',
    '신청일로부터 3개월 이내',
    'e보건소 등록 참여 의료기관(예: 순천 현대여성아동병원 참여 여부 사전 확인)에 전화 예약 후 신분증과 검사의뢰서를 지참·제시해 검사 및 결과 상담을 받습니다. 의뢰서 1매당 1회 사용이 원칙입니다.'
  ],
  [
    'STEP 04',
    '검사비 사후 청구',
    '검사일로부터 1개월 이내',
    'e보건소 온라인 또는 보건소 방문으로 검사비를 청구합니다. 수납 시 꼭 받아야 할 필수 서류는 ① 진료비 영수증, ② 진료비 세부내역서, ③ 신청인 본인 명의 통장사본입니다. (방문 청구 시 검사비 청구서 작성)'
  ],
  [
    'STEP 05',
    '서류 심사 후 계좌 입금',
    '청구일로부터 3개월 이내',
    '관할 보건소에서 제출 서류와 필수 검사 항목을 확인한 뒤 신청인 본인 계좌로 순차 지급합니다. 예산 소진 시 접수가 조기 마감될 수 있으므로 신청 전 접수 가능 여부를 확인하세요.'
  ]
];

function buildPrenatalSummaryText(prefs) {
  const checkedSet = new Set(prefs.prenatalChecks || []);
  const doneCount = PRENATAL_CHECK_ITEMS.filter(([id]) => checkedSet.has(id)).length;
  const note = (prefs.prenatalNote || '').trim();
  const sched = prenatalDeadlineSummary(prefs.prenatalSchedule || {});
  const schedLines = [];
  if (sched.appliedDate) schedLines.push(`• e보건소 신청일: ${sched.appliedDate} (3개월 검사 마감: ${sched.examDeadline})`);
  if (sched.visitDate) schedLines.push(`• 순천 현대여성아동병원 예약일: ${sched.visitDate}`);
  if (sched.examDate) schedLines.push(`• 산전검사 완료일: ${sched.examDate} (1개월 청구 마감: ${sched.claimDeadline})`);
  if (sched.claimed) schedLines.push('• 지원금 청구 상태: 완료');
  return [
    '🩺 [산전검사 · 순천 현대여성아동병원 & 지원금 핵심 요약]',
    '',
    '1) 주 이용 병원: 의료법인 내일의료재단 현대여성아동병원 (순천현대병원)',
    `• 주소: ${HOSPITAL_INFO.address} (우 ${HOSPITAL_INFO.postal})`,
    `• 대표전화: ${HOSPITAL_INFO.mainPhone} (공공데이터 등록: ${HOSPITAL_INFO.altPhone})`,
    '• 진료시간(신고 기준): 평일 09:00~18:00(일부 19:00 연장 안내 사례) · 점심 13:00~14:00 · 토 09:00~16:00 · 공휴일 09:00~13:00 · 일 휴진 (방문 전 예약·접수 마감 확인 필수)',
    '',
    '2) 국가 「임신 사전건강관리 지원사업」 (2026 모자보건사업 기준)',
    '• 대상: 20~49세 희망 남녀(결혼·자녀 무관) / 15~19세 부부(예비·사실혼 포함)',
    '• 횟수: 신청일 만 나이 주기별 1회, 생애 최대 3회 (29세 이하 / 30~34세 / 35~49세)',
    '• 한도: 여성 최대 13만 원 (AMH + 부인과 초음파) / 남성 최대 5만 원 (정액검사·정자정밀형태검사)',
    '• 필수 절차: ① e보건소 사전 신청 → ② 보건소 승인·검사의뢰서 발급 확인(사전 검사 소급 불가!) → ③ 3개월 내 참여 병원 의뢰서 지참 검사 → ④ 검사일로부터 1개월 내 e보건소 청구(영수증·진료비 세부내역서·통장사본) → ⑤ 3개월 내 계좌 지급',
    '',
    '3) 순천시 자체 지원사업 (순천시 보건소 모자보건실 061-749-6916~9)',
    `• 주소: ${HEALTH_CENTER.address}`,
    '• 신혼(예비)부부 건강검진: 순천시 주민등록 예비·신혼부부 남녀 각 최대 4만 원 (지정 병원 검진 후 보건소 신청, 난임진단검사비 중복 불가)',
    '• 예비부모 엽산제: 첫 임신 계획 혼인(예정) 3년 이내 남녀 각 3개월분(총 6갑)',
    '',
    `4) 우리 준비 체크 현황: ${doneCount}/${PRENATAL_CHECK_ITEMS.length} 완료 (${sched.statusLabel})`,
    ...schedLines,
    ...(note ? ['', `📝 개인 메모: ${note}`] : []),
    '',
    '※ 확인 기준일: 2026-11 (방문·신청 전 병원 및 순천시 보건소 최신 운영·예산 현황을 꼭 확인하세요.)'
  ].join('\n');
}

export function renderPrenatal(ctx) {
  if (ctx.isGuestMode()) {
    return ctx.guestRestrictedView(
      '산전검사 & 지원금 안내',
      '순천 현대여성아동병원 정보와 산전검사 지원금 절차는 신랑·신부 전용 준비 탭입니다.',
      'PRENATAL CARE'
    );
  }

  const prefs = ctx.getPrefs();
  const checkedSet = new Set(prefs.prenatalChecks || []);
  const checkDone = PRENATAL_CHECK_ITEMS.filter(([id]) => checkedSet.has(id)).length;
  const checkTotal = PRENATAL_CHECK_ITEMS.length;
  const savedNote = prefs.prenatalNote || '';
  const sched = prenatalDeadlineSummary(prefs.prenatalSchedule || {});

  const urlSubTab = ctx.currentSubTab?.();
  if (['hospital', 'subsidy', 'guide'].includes(urlSubTab)) prenatalSubTab = urlSubTab;

  const switchSubTab = nextTab => {
    setPrenatalSubTab(nextTab);
    if (ctx.setSubTabHash) ctx.setSubTabHash('prenatal', nextTab);
    else ctx.render();
    ctx.getMain().querySelector(`.subtab-btn[data-subtab="${nextTab}"]`)?.focus({ preventScroll: true });
  };

  const toggleCheck = (cid, checked) => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const set = new Set(latest.prenatalChecks || []);
      if (checked) set.add(cid); else set.delete(cid);
      const ok = await ctx.savePrefs({ ...latest, prenatalChecks: [...set] });
      if (ok && ctx.currentRoute() === 'prenatal') ctx.render();
      return ok;
    });
  };

  const kpiStrip = E('section', { class: 'prenatal-kpi-strip', 'aria-label': '산전검사 및 지원금 핵심 요약' },
    E('article', { class: 'prenatal-kpi-card is-primary' },
      E('span', { class: 'prenatal-kpi-label' }, '🏥 주 이용 병원'),
      E('strong', { class: 'prenatal-kpi-val' }, '현대여성아동병원'),
      E('span', { class: 'small muted' }, '순천 조례동 · 061-720-1111')),
    E('article', { class: 'prenatal-kpi-card' },
      E('span', { class: 'prenatal-kpi-label' }, '👩‍🦰 국가 지원 (여성)'),
      E('strong', { class: 'prenatal-kpi-val' }, '최대 13만 원'),
      E('span', { class: 'small muted' }, 'AMH · 부인과 초음파 · 생애 3주기')),
    E('article', { class: 'prenatal-kpi-card' },
      E('span', { class: 'prenatal-kpi-label' }, '👨 국가 지원 (남성)'),
      E('strong', { class: 'prenatal-kpi-val' }, '최대 5만 원'),
      E('span', { class: 'small muted' }, '정액검사(정밀형태) · 생애 3주기')),
    E('article', { class: 'prenatal-kpi-card' + (sched.urgent ? ' is-urgent' : '') },
      E('span', { class: 'prenatal-kpi-label' }, sched.status === 'empty' ? '🏛️ 순천시 자체 지원' : '⏰ 지원금 마감 현황'),
      E('strong', { class: 'prenatal-kpi-val' }, sched.status === 'empty' ? '남녀 각 최대 4만 원' : sched.statusLabel),
      E('span', { class: 'small muted' }, sched.status === 'empty' ? '신혼·예비부부 검진 + 엽산제 6갑' : (sched.claimDeadline ? `청구 마감 ${sched.claimDeadline}` : sched.examDeadline ? `검사 마감 ${sched.examDeadline}` : `예약일 ${sched.visitDate}`))));

  const subTabBar = enhanceTablistKeyboard(E('div', { class: 'subtab-bar prenatal-subtabs', role: 'tablist', 'aria-label': '산전검사 세부 메뉴' },
    [
      ['hospital', '🏥 순천 현대여성아동병원', '조례동'],
      ['subsidy', '💰 지원금 & 신청 절차', sched.status === 'empty' ? '5단계' : sched.statusLabel],
      ['guide', '🩺 검사항목 & 준비 체크', `${checkDone}/${checkTotal}`]
    ].map(([id, label, badgeText]) => E('button', {
      type: 'button',
      role: 'tab',
      class: 'subtab-btn' + (prenatalSubTab === id ? ' is-active' : ''),
      'data-subtab': id,
      'aria-selected': String(prenatalSubTab === id),
      onclick: () => switchSubTab(id)
    }, label, E('span', { class: 'subtab-badge' }, badgeText)))));

  const hospitalPanel = E('section', { class: 'prenatal-panel', 'aria-label': '순천 현대여성아동병원 및 순천시 보건소 안내' },
    E('article', { class: 'prenatal-card prenatal-hospital-hero' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'MAIN OB/GYN & FERTILITY HOSPITAL'),
          E('h2', {}, HOSPITAL_INFO.officialName),
          E('p', { class: 'small muted' }, '순천에서 흔히 ‘순천현대병원’으로 부르는 조례동 여성·아동 전문병원입니다. 산부인과·난임센터·소아청소년과와 부설 산후조리원이 한곳에 연계되어 있습니다.')),
        E('div', { class: 'prenatal-quick-actions' },
          E('a', { href: `tel:${HOSPITAL_INFO.mainPhone.replace(/-/g, '')}`, class: 'button' }, `📞 전화 ${HOSPITAL_INFO.mainPhone}`),
          button('📋 주소 복사', () => ctx.copyVenueAddress(HOSPITAL_INFO.address, '현대여성아동병원 주소'), 'button quiet'))),
      E('div', { class: 'spec-chips prenatal-badges' },
        E('span', { class: 'spec-chip direct' }, '✓ 보건복지부 인증의료기관'),
        E('span', { class: 'spec-chip direct' }, '✓ 난임 시술 지정 의료기관 (체외수정·인공수정)'),
        E('span', { class: 'spec-chip' }, '🩺 산부인과 · 소아청소년과 · 유방갑상선외과'),
        E('span', { class: 'spec-chip' }, '👩‍⚕️ 여의사 진료 · 24시간 분만 · 신생아 중환자실'),
        E('span', { class: 'spec-chip' }, '🚗 주차 가능 (방문 시 주차 안내 확인)')),
      E('dl', { class: 'prenatal-info-grid' },
        E('div', { class: 'prenatal-info-item' },
          E('dt', {}, '📍 위치 · 도로명 주소'),
          E('dd', {},
            E('strong', {}, HOSPITAL_INFO.address),
            E('span', { class: 'small muted' }, `우편번호 ${HOSPITAL_INFO.postal} · 조례동 (부설 산후조리원 및 전남 공공산후조리원 5호점 동일 주소)`))),
        E('div', { class: 'prenatal-info-item' },
          E('dt', {}, '📞 대표 연락처'),
          E('dd', {},
            E('strong', {}, HOSPITAL_INFO.mainPhone),
            E('span', { class: 'small muted' }, `공공데이터·응급의료포털 등록번호: ${HOSPITAL_INFO.altPhone} · 산전검사·정액검사 예약은 대표전화 문의`))),
        E('div', { class: 'prenatal-info-item is-wide' },
          E('dt', {}, '⏰ 진료시간 안내 (2026 공공데이터 신고 기준)'),
          E('dd', {},
            E('div', { class: 'prenatal-hours-grid' },
              E('div', { class: 'prenatal-hour-pill' }, E('span', { class: 'small muted' }, '평일 (월~금)'), E('strong', {}, '09:00 ~ 18:00'), E('span', { class: 'small muted' }, '일부 산부인과·소아과 19:00 연장 안내 사례')),
              E('div', { class: 'prenatal-hour-pill' }, E('span', { class: 'small muted' }, '점심시간'), E('strong', {}, '13:00 ~ 14:00'), E('span', { class: 'small muted' }, '접수 마감은 진료 종료 30분~1시간 전')),
              E('div', { class: 'prenatal-hour-pill' }, E('span', { class: 'small muted' }, '토요일'), E('strong', {}, '09:00 ~ 16:00'), E('span', { class: 'small muted' }, '산부인과·난임센터 일정 사전 확인')),
              E('div', { class: 'prenatal-hour-pill' }, E('span', { class: 'small muted' }, '일요일 · 공휴일'), E('strong', {}, '일 휴진 · 공휴일 09:00~13:00'), E('span', { class: 'small muted' }, '분만·응급 제외 / 과목별 상이'))),
            E('p', { class: 'small muted prenatal-hour-note' }, '※ 과목별(산부인과·난임센터·소아과) 실제 접수 마감과 휴진 일정이 다를 수 있으므로 방문 전 061-720-1111로 꼭 확인하세요.')))),
      E('div', { class: 'page-actions prenatal-link-row' },
        externalLink('🗺️ 네이버 지도 ↗', HOSPITAL_INFO.naverMapUrl, 'button quiet'),
        externalLink('🗺️ 카카오맵 ↗', HOSPITAL_INFO.kakaoMapUrl, 'button quiet'),
        externalLink('💬 공식 카카오톡 채널 ↗', HOSPITAL_INFO.kakaoUrl, 'button quiet'),
        externalLink('🏥 e보건소 참여기관 조회 ↗', HOSPITAL_INFO.eHealthUrl, 'button quiet'),
        button('💰 지원금 수령 절차 보기 →', () => switchSubTab('subsidy'), 'button quiet'))),

    E('section', { class: 'prenatal-card', 'aria-labelledby': 'prenatal-visit-tips-title' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'BEFORE YOU VISIT'),
          E('h3', { id: 'prenatal-visit-tips-title' }, '순천 현대여성아동병원 방문 전 꼭 확인할 4가지'))),
      E('div', { class: 'prenatal-callout-grid' },
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'lachma-step-badge' }, 'CHECK 01'),
          E('h4', {}, '지원사업 참여·지정 여부 사전 확인'),
          E('p', { class: 'small' }, '보건복지부 지정 난임시술 의료기관이지만, 국가 「임신 사전건강관리 지원사업」 참여 등록과 「순천시 신혼(예비)부부 건강검진」 지정 병원 명단은 연도별로 바뀔 수 있습니다. 예약 전화 시 “보건소 검사의뢰서 사용 가능 여부”를 먼저 확인하세요.')),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'lachma-step-badge' }, 'CHECK 02'),
          E('h4', {}, '의뢰서 발급 후 산부인과·난임센터 예약'),
          E('p', { class: 'small' }, '반드시 보건소 승인(검사의뢰서 발급)을 먼저 마친 뒤 일정을 잡으세요. 여성은 산부인과(AMH·부인과 초음파 등), 남성은 난임센터 정액검사 가능 요일·채취실 예약 시간과 2~5일 금욕 안내를 함께 문의하면 한 번에 준비할 수 있습니다.')),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'lachma-step-badge' }, 'CHECK 03'),
          E('h4', {}, '수납 시 청구 서류 2종 + 결과지 체크'),
          E('p', { class: 'small' }, '검사 후 원무과 수납 창구에서 사후 청구용 「① 진료비 영수증」과 「② 진료비 세부내역서」를 꼭 함께 발급받으세요. 남성 정액검사는 결과지에 정자정밀형태검사(Strict Morphology) 항목이 포함되는지도 확인하는 것이 안전합니다.')),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'lachma-step-badge' }, 'CHECK 04'),
          E('h4', {}, '참고용 비급여 고지 범위 (변동 가능)'),
          E('p', { class: 'small' }, '2026년 심평원·의료정보 포털 고지 참고 범위: 항뮬러관호르몬(AMH) 약 70,000원, 부인과 초음파 약 10,000~50,000원, 자궁경부세포검사(PAP) 약 15,000원 / 씬프랩 약 40,000원 수준. 실제 본인부담금·정액검사·항체검사 비용은 급여 여부와 시점에 따라 달라집니다.')))),

    E('article', { class: 'prenatal-card prenatal-health-center' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'SUNCHEON PUBLIC HEALTH CENTER'),
          E('h3', {}, `🏛️ ${HEALTH_CENTER.name}`),
          E('p', { class: 'small muted' }, '임신 사전건강관리 검사의뢰서 승인, 순천시 신혼(예비)부부 건강검진 지원, 예비부모 엽산제(6갑) 신청 및 당해 예산 잔여 현황을 문의하는 관할 보건소입니다.')),
        E('div', { class: 'prenatal-quick-actions' },
          E('a', { href: `tel:${HEALTH_CENTER.maternalPhone.replace(/-/g, '')}`, class: 'button quiet' }, `📞 모자보건실 ${HEALTH_CENTER.maternalPhone}`),
          button('📋 보건소 주소 복사', () => ctx.copyVenueAddress(HEALTH_CENTER.address, '순천시 보건소 주소'), 'button quiet'))),
      E('div', { class: 'prenatal-hc-meta' },
        E('span', { class: 'spec-chip' }, `📍 ${HEALTH_CENTER.address}`),
        E('span', { class: 'spec-chip direct' }, `📞 모자보건실 ${HEALTH_CENTER.maternalPhoneRange}`),
        E('span', { class: 'spec-chip' }, `☎️ 대표 ${HEALTH_CENTER.mainPhone}`)),
      E('div', { class: 'page-actions prenatal-link-row' },
        externalLink('🗺️ 보건소 네이버 지도 ↗', HEALTH_CENTER.naverMapUrl, 'button quiet'),
        externalLink('🌐 순천시 보건소 홈페이지 ↗', HOSPITAL_INFO.suncheonHealthUrl, 'button quiet'),
        externalLink('🌐 순천시청 출산장려지원 ↗', HOSPITAL_INFO.suncheonCityUrl, 'button quiet'))));

  const appliedIn = E('input', { type: 'date', id: 'prenatal-applied-date' });
  appliedIn.value = sched.appliedDate;
  const visitIn = E('input', { type: 'date', id: 'prenatal-visit-date' });
  visitIn.value = sched.visitDate;
  const examIn = E('input', { type: 'date', id: 'prenatal-exam-date' });
  examIn.value = sched.examDate;
  const claimedIn = E('input', { type: 'checkbox', id: 'prenatal-claimed-check' });
  claimedIn.checked = sched.claimed;

  const saveSchedule = () => {
    const nextSched = {
      ...(appliedIn.value.trim() ? { appliedDate: appliedIn.value.trim() } : {}),
      ...(visitIn.value.trim() ? { visitDate: visitIn.value.trim() } : {}),
      ...(examIn.value.trim() ? { examDate: examIn.value.trim() } : {}),
      claimed: claimedIn.checked
    };
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const ok = await ctx.savePrefs({ ...latest, prenatalSchedule: nextSched });
      if (ok) {
        if (ctx.currentRoute() === 'prenatal') ctx.render();
        ctx.toast('산전검사 일정과 지원금 마감일을 저장했습니다.');
      }
      return ok;
    });
  };

  const calButtons = [];
  if (sched.visitDate) {
    const visitPayload = {
      title: '[산전검사] 순천 현대여성아동병원 방문',
      date: sched.visitDate,
      location: HOSPITAL_INFO.address,
      description: '지참물: 신분증, e보건소 검사의뢰서 · 수납 시 진료비 영수증 + 진료비 세부내역서 요청 (061-720-1111)'
    };
    try {
      calButtons.push(externalLink('📅 병원 예약 구글캘린더 ↗', scheduleGoogleCalendarUrl(visitPayload), 'button quiet small-copy-btn'));
      calButtons.push(button('📥 병원 예약 .ics', () => {
        downloadText(scheduleCalendar(visitPayload), 'prenatal-hospital-visit.ics', 'text/calendar;charset=utf-8');
        ctx.toast('순천 현대여성아동병원 예약 일정(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn'));
    } catch {}
  }
  if (sched.claimDeadline && !sched.claimed) {
    const claimPayload = {
      title: '[산전검사 지원금] e보건소 검사비 청구 마감일',
      date: sched.claimDeadline,
      location: '공공보건포털 e보건소 / 순천시 보건소 모자보건실',
      description: `검사일(${sched.examDate})로부터 1개월 청구 마감일 · 제출서류: 진료비 영수증, 진료비 세부내역서, 본인 통장사본`
    };
    try {
      calButtons.push(externalLink('⏰ 청구 마감 구글캘린더 ↗', scheduleGoogleCalendarUrl(claimPayload), 'button quiet small-copy-btn'));
      calButtons.push(button('📥 청구 마감 .ics', () => {
        downloadText(scheduleCalendar(claimPayload), 'prenatal-subsidy-claim-deadline.ics', 'text/calendar;charset=utf-8');
        ctx.toast('지원금 청구 마감일(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn'));
    } catch {}
  } else if (sched.examDeadline && !sched.examDate && !sched.claimed) {
    const examPayload = {
      title: '[산전검사 지원금] 3개월 검사 완료 마감일',
      date: sched.examDeadline,
      location: HOSPITAL_INFO.address,
      description: `e보건소 신청일(${sched.appliedDate})로부터 3개월 내 참여 병원 검사 완료 기한`
    };
    try {
      calButtons.push(externalLink('⏰ 검사 마감 구글캘린더 ↗', scheduleGoogleCalendarUrl(examPayload), 'button quiet small-copy-btn'));
      calButtons.push(button('📥 검사 마감 .ics', () => {
        downloadText(scheduleCalendar(examPayload), 'prenatal-exam-deadline.ics', 'text/calendar;charset=utf-8');
        ctx.toast('산전검사 완료 마감일(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn'));
    } catch {}
  }

  const deadlineCalcCard = E('article', { class: 'prenatal-card prenatal-deadline-card' + (sched.urgent ? ' is-urgent' : '') },
    E('div', { class: 'prenatal-card-head' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'DEADLINE CALCULATOR & CALENDAR · PRIVATE'),
        E('h2', {}, '📅 산전검사 일정 · 지원금 마감일 계산기'),
        E('p', { class: 'small muted' }, '신청일·예약일·검사일을 기록하면 3개월 검사 기한과 1개월 청구 마감 D-Day를 자동 계산하고 캘린더에 바로 등록할 수 있어요.')),
      E('span', { class: 'spec-chip ' + (sched.claimed ? 'direct' : sched.urgent ? 'highlight' : '') }, sched.statusLabel)),
    E('div', { class: 'prenatal-date-inputs' },
      E('label', { class: 'field', for: appliedIn.id }, '① e보건소 신청일 (의뢰서)', appliedIn),
      E('label', { class: 'field', for: visitIn.id }, '② 현대여성아동병원 예약일', visitIn),
      E('label', { class: 'field', for: examIn.id }, '③ 산전검사 완료일', examIn)),
    E('div', { class: 'prenatal-date-actions' },
      E('label', { class: 'check-label', for: claimedIn.id }, claimedIn, '✅ 지원금 청구 완료'),
      E('div', { class: 'page-actions' },
        button('💾 일정·마감일 저장', saveSchedule, 'button'),
        (sched.appliedDate || sched.visitDate || sched.examDate || sched.claimed) ? button('일정 비우기', () => {
          appliedIn.value = '';
          visitIn.value = '';
          examIn.value = '';
          claimedIn.checked = false;
          saveSchedule();
        }, 'button quiet') : null)),
    (sched.examDeadline || sched.claimDeadline || sched.visitDate) ? E('div', { class: 'prenatal-summary-3col' },
      E('div', { class: 'prenatal-mini-card' },
        E('span', { class: 'prenatal-mini-kicker' }, '3개월 검사 완료 마감'),
        E('strong', {}, sched.examDeadline || '신청일 미입력'),
        E('p', { class: 'small muted' }, sched.examDeadline ? (sched.examDaysLeft >= 0 ? `마감까지 D-${sched.examDaysLeft}` : `기한 ${Math.abs(sched.examDaysLeft)}일 초과 (보건소 취소·재신청 필요)`) : 'e보건소 신청일을 입력하면 자동 계산됩니다.')),
      E('div', { class: 'prenatal-mini-card' },
        E('span', { class: 'prenatal-mini-kicker' }, '순천 현대여성아동병원 예약일'),
        E('strong', {}, sched.visitDate || '예약일 미입력'),
        E('p', { class: 'small muted' }, sched.visitDate ? (sched.visitDaysLeft > 0 ? `방문까지 D-${sched.visitDaysLeft}` : sched.visitDaysLeft === 0 ? '오늘 방문 예정일입니다!' : `방문일 ${Math.abs(sched.visitDaysLeft)}일 경과`) : '병원 전화 예약 후 날짜를 기록해 두세요.')),
      E('div', { class: 'prenatal-mini-card ' + (sched.urgent ? 'is-accent' : '') },
        E('span', { class: 'prenatal-mini-kicker' }, '1개월 검사비 청구 마감'),
        E('strong', {}, sched.claimDeadline || '검사일 미입력'),
        E('p', { class: 'small muted' }, sched.claimed ? '지원금 청구를 완료했습니다 🎉' : sched.claimDeadline ? (sched.claimDaysLeft >= 0 ? `청구 마감까지 D-${sched.claimDaysLeft} (영수증·세부내역서·통장사본)` : `기한 ${Math.abs(sched.claimDaysLeft)}일 초과`) : '검사 완료일을 입력하면 1개월 청구 마감일이 표시됩니다.'))) : null,
    calButtons.length ? E('div', { class: 'page-actions prenatal-link-row' }, ...calButtons) : null);

  const subsidyPanel = E('section', { class: 'prenatal-panel', 'aria-label': '산전검사 지원금 제도 및 수령 절차' },
    deadlineCalcCard,
    E('div', { class: 'prenatal-alert-banner', role: 'note' },
      E('strong', {}, '⚠️ 지원금 받기 전 가장 중요한 주의사항 2가지'),
      E('p', { class: 'small' }, '① 반드시 보건소 승인(검사의뢰서 발급)을 먼저 받은 뒤에 병원에서 검사하세요. 의뢰서 발급 전에 미리 받은 검사는 소급 지원이 불가합니다.'),
      E('p', { class: 'small' }, '② 지자체 당해 예산이 소진되면 접수가 일시 중단·반려될 수 있습니다(순천시도 2025년 하반기 예산 소진으로 일시 중단된 사례 있음). 신청 전 e보건소 공지와 순천시 보건소 모자보건실(061-749-6916~9)을 먼저 확인하세요.')),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'NATIONAL SUBSIDY · 2026 MOHW GUIDE'),
          E('h2', {}, '① 국가 「임신 사전건강관리 지원사업」'),
          E('p', { class: 'small muted' }, '보건복지부 『2026년 모자보건사업 안내』 기준 · 결혼·자녀 여부와 무관하게 남녀 각자 신청 가능한 전국 가임력 검사 지원제도입니다.')),
        E('div', { class: 'prenatal-quick-actions' },
          externalLink('🌐 e보건소 온라인 신청 ↗', HOSPITAL_INFO.eHealthUrl, 'button'),
          externalLink('📖 2026 생활법령 기준 ↗', HOSPITAL_INFO.easyLawUrl, 'button quiet'))),

      E('div', { class: 'prenatal-summary-3col' },
        E('div', { class: 'prenatal-mini-card' },
          E('span', { class: 'prenatal-mini-kicker' }, '지원 대상'),
          E('strong', {}, '20~49세 희망 남녀 누구나'),
          E('p', { class: 'small muted' }, '결혼·자녀 여부 무관 · 15~19세 부부(예비·사실혼 포함) 및 내국인 배우자가 있는 외국인 포함 · 주민등록지 관할 보건소 기준')),
        E('div', { class: 'prenatal-mini-card' },
          E('span', { class: 'prenatal-mini-kicker' }, '지원 횟수 (최대 3회)'),
          E('strong', {}, '만 나이 주기별 각 1회'),
          E('p', { class: 'small muted' }, '제1주기(29세 이하) · 제2주기(30~34세) · 제3주기(35~49세) 각 1회 지원 (신청일 기준 만 나이 적용, 미사용 주기 이월 불가)')),
        E('div', { class: 'prenatal-mini-card is-accent' },
          E('span', { class: 'prenatal-mini-kicker' }, '지원 한도 & 필수 항목'),
          E('strong', {}, '여성 최대 13만 원 · 남성 최대 5만 원'),
          E('p', { class: 'small muted' }, '여성: 난소기능검사(AMH) + 부인과 초음파 / 남성: 정액검사(정자정밀형태검사) · 한도 내 진찰료·가임력 관련 기타 검사 포함'))),

      E('h3', { class: 'prenatal-subhead' }, '📋 지원금 수령 5단계 절차 (순서대로 따라 하기)'),
      E('ol', { class: 'prenatal-stepper' }, SUBSIDY_STEPS.map(([step, title, timing, desc]) =>
        E('li', { class: 'prenatal-step-card' },
          E('div', { class: 'prenatal-step-top' },
            E('span', { class: 'lachma-step-badge' }, step),
            E('strong', { class: 'prenatal-step-title' }, title),
            E('span', { class: 'spec-chip highlight prenatal-step-timing' }, timing)),
          E('p', { class: 'small prenatal-step-desc' }, desc)))),

      E('div', { class: 'prenatal-docs-grid' },
        E('div', { class: 'prenatal-doc-box' },
          E('h4', {}, '📄 단계별 제출 서류 정리'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '지원 신청 시 (내국인 온라인): '), '별도 첨부 서류 없음 (e보건소 본인인증 및 행정정보 공동이용 동의)'),
            E('li', {}, E('strong', {}, '지원 신청 시 (보건소 방문): '), '지원 신청서, 개인정보 제공 동의서, 신분증·주민등록등본(또는 행정정보 공동이용 동의)'),
            E('li', {}, E('strong', {}, '비용 청구 시 (검사 후 1개월 이내): '), '① 진료비 영수증, ② 진료비 세부내역서, ③ 본인 명의 통장사본 (방문 청구 시 검사비 청구서 작성)'))),
        E('div', { class: 'prenatal-doc-box is-warn' },
          E('h4', {}, '🚫 놓치기 쉬운 반려·제외 사유'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '사전 승인 전 검사: '), '검사의뢰서 발급 전 검진 건은 소급 청구 불가'),
            E('li', {}, E('strong', {}, '기한 초과: '), '신청일로부터 3개월 내 미검사(취소 후 재신청 필요), 검사일로부터 1개월 초과 청구 시 지원 불가'),
            E('li', {}, E('strong', {}, '지원 제외·중복 불가: '), '가임력과 무관한 검사·주사료·약제비 제외 / 지자체 난임부부 진단검사비 지원사업과 동일 검사 중복 불가'))))),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'SUNCHEON LOCAL BENEFITS'),
          E('h2', {}, '② 순천시 자체 임신 전 지원사업 (순천시 보건소)'),
          E('p', { class: 'small muted' }, '순천시에 주민등록을 둔 예비부부·신혼부부가 함께 확인할 수 있는 순천시 자체 모자보건 혜택입니다.'))),
      E('div', { class: 'prenatal-local-grid' },
        E('div', { class: 'prenatal-local-card' },
          E('div', { class: 'prenatal-local-top' },
            E('span', { class: 'spec-chip direct' }, '최대 8만 원 (부부 합산)'),
            E('h3', {}, '순천시 신혼(예비)부부 건강검진 지원')),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '대상: '), '순천시 주민등록 거주자 중 임신 계획 중인 신혼부부 및 예비부부'),
            E('li', {}, E('strong', {}, '지원 금액: '), '여성 최대 4만 원 / 남성 최대 4만 원 (지정 항목 한도 내)'),
            E('li', {}, E('strong', {}, '지원 항목: '), '자궁질환 관련 검사, 성병 검사, 풍진 등 항체 검사 등 임신 전 건강점검 지정 항목'),
            E('li', {}, E('strong', {}, '신청 방법: '), '지정 병·의원에서 검진 후 순천시 보건소 모자보건실에 신청서·영수증 등 제출 (연중)'),
            E('li', {}, E('strong', {}, '유의 사항: '), '난임부부 진단검사비 지원사업과 중복 불가 · 국가 임신 사전건강관리와 항목을 나누어 병행 가능한지 및 현대여성아동병원 지정 여부는 방문 전 모자보건실(061-749-6916~9) 확인 권장'))),
        E('div', { class: 'prenatal-local-card' },
          E('div', { class: 'prenatal-local-top' },
            E('span', { class: 'spec-chip direct' }, '남녀 각 3개월분 (총 6갑)'),
            E('h3', {}, '순천시 예비부모 엽산제 지원')),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '대상: '), '순천시 관내 첫 임신을 계획 중인 혼인신고(예정)일 기준 3년 이내 예비·신혼부부'),
            E('li', {}, E('strong', {}, '지원 내용: '), '예비 엄마·아빠 각각 3개월분 엽산제 무료 지급 (부부 총 6갑)'),
            E('li', {}, E('strong', {}, '신청 방법: '), '연중 순천시 보건소 모자보건실 방문 신청 (신분증 및 청첩장·예식장 계약서·혼인관계증명서 등 증빙 서류 사전 확인 권장)'),
            E('li', {}, E('strong', {}, '참고: '), '임신 확인 후에도 순천시 보건소에서 임신부 무료 산전검사(10주 이내)·엽산/철분제·태아 기형아 검진비 지원이 이어집니다.')))),
      E('div', { class: 'page-actions prenatal-link-row' },
        E('a', { href: `tel:${HEALTH_CENTER.maternalPhone.replace(/-/g, '')}`, class: 'button quiet' }, `📞 모자보건실 문의 (${HEALTH_CENTER.maternalPhone})`),
        externalLink('🌐 순천시 보건소 ↗', HOSPITAL_INFO.suncheonHealthUrl, 'button quiet'),
        externalLink('🌐 순천시청 출산장려지원 ↗', HOSPITAL_INFO.suncheonCityUrl, 'button quiet'),
        button('🩺 검사항목 & 준비 체크 보기 →', () => switchSubTab('guide'), 'button quiet'))));

  const noteField = E('textarea', {
    id: 'prenatal-private-note',
    rows: '4',
    maxlength: '1000',
    placeholder: '예: 12월 중순 순천시 보건소 전화 확인 → e보건소 의뢰서 신청 → 순천 현대여성아동병원 토요일 오전 예약 예정 (※ 진단 결과·주민번호 등 민감 의료정보는 입력하지 마세요)'
  });
  noteField.value = savedNote;
  const saveNoteBtn = button('💾 메모 저장', () => {
    const val = noteField.value.trim();
    if (val.length > 1000) {
      ctx.toast('산전검사 메모는 1,000자 이하로 입력해 주세요.', true);
      return;
    }
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const next = { ...latest };
      if (val) next.prenatalNote = val;
      else delete next.prenatalNote;
      const ok = await ctx.savePrefs(next);
      if (ok) {
        if (ctx.currentRoute() === 'prenatal') ctx.render();
        ctx.toast(val ? '산전검사 메모를 이 기기에 저장했습니다.' : '산전검사 메모를 비웠습니다.');
      }
      return ok;
    });
  }, 'button');
  const clearNoteBtn = savedNote ? button('메모 지우기', () => {
    const prevNote = ctx.getPrefs().prenatalNote || '';
    if (!prevNote) return;
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const next = { ...latest };
      delete next.prenatalNote;
      const ok = await ctx.savePrefs(next);
      if (ok) {
        if (ctx.currentRoute() === 'prenatal') ctx.render();
        ctx.toast('산전검사 메모를 지웠습니다.', {
          undoLabel: '되돌리기',
          onUndo: () => ctx.queuePreference(async () => {
            const restored = await ctx.savePrefs({ ...ctx.getPrefs(), prenatalNote: prevNote });
            if (restored) { ctx.render(); ctx.toast('산전검사 메모를 복구했습니다.'); }
            return restored;
          })
        });
      }
      return ok;
    });
  }, 'button quiet') : null;

  const pct = Math.round((checkDone / checkTotal) * 100);

  const guidePanel = E('section', { class: 'prenatal-panel', 'aria-label': '산전검사 주요 항목 및 준비 체크리스트' },
    E('div', { class: 'prenatal-timing-banner' },
      E('strong', {}, '🗓️ 산전검사 권장 시기: 결혼 또는 임신 계획 3 ~ 6개월 전'),
      E('p', { class: 'small' }, '풍진·수두 등 항체가 없을 경우 생백신(MMR·수두 등) 접종 후 최소 1개월간 피임이 권장되며, 엽산 복용도 임신 시도 1~3개월 전부터 시작하는 것이 일반적입니다. 개인 건강상태에 맞는 세부 검사와 접종 일정은 산부인과 전문의 상담을 통해 결정하세요.')),

    E('div', { class: 'prenatal-exam-grid' },
      E('article', { class: 'prenatal-card' },
        E('div', { class: 'prenatal-local-top' },
          E('span', { class: 'spec-chip direct' }, '국가 지원 최대 13만 원'),
          E('h3', {}, '👩‍🦰 여성 주요 산전검사 항목')),
        E('ul', { class: 'prenatal-bullet-list small' },
          E('li', {}, E('strong', {}, '가임력 필수 (국가 지원): '), '난소기능검사(AMH 혈액검사 · 난소 예비력 확인), 부인과 초음파(자궁근종·용종·난소낭종 등 구조 확인)'),
          E('li', {}, E('strong', {}, '항체·감염 혈액검사: '), '풍진 항체(IgG/IgM), B형간염 항원·항체, A형간염·수두 항체, 매독·에이즈(HIV) 선별검사'),
          E('li', {}, E('strong', {}, '기초 건강·내분비 검사: '), '일반혈액검사(빈혈·혈소판), 혈액형(ABO/Rh), 갑상선기능검사(TSH 등), 공복혈당, 간·신장기능, 소변검사'),
          E('li', {}, E('strong', {}, '자궁·부인과 선택 검사: '), '자궁경부암 세포검사(PAP/씬프랩), 성매개감염병(STD PCR) 검사 등'))),
      E('article', { class: 'prenatal-card' },
        E('div', { class: 'prenatal-local-top' },
          E('span', { class: 'spec-chip direct' }, '국가 지원 최대 5만 원'),
          E('h3', {}, '👨 남성 주요 산전검사 항목')),
        E('ul', { class: 'prenatal-bullet-list small' },
          E('li', {}, E('strong', {}, '가임력 필수 (국가 지원): '), '정액검사 (정자 수·운동성·정자정밀형태검사 Strict Morphology 포함 여부 확인 권장)'),
          E('li', {}, E('strong', {}, '항체·감염 혈액검사: '), 'B형간염·A형간염 항원·항체, 매독·에이즈(HIV) 등 성매개감염병 선별검사'),
          E('li', {}, E('strong', {}, '기초 건강 검사: '), '혈액형, 일반혈액·간기능·혈당·소변검사 (결과에 따라 난임센터·비뇨의학과 추가 상담)'),
          E('li', {}, E('strong', {}, '생활 관리 포인트: '), '검사 및 임신 준비 3개월 전부터 금연·절주·고온(사우나·잦은 반신욕) 줄이기가 권장됩니다.')))),

    E('section', { class: 'prenatal-card', 'aria-labelledby': 'prenatal-prep-tips-title' },
      E('h3', { id: 'prenatal-prep-tips-title' }, '🧳 병원 방문 전 실전 준비 팁'),
      E('div', { class: 'prenatal-summary-3col' },
        E('div', { class: 'prenatal-mini-card' },
          E('span', { class: 'prenatal-mini-kicker' }, '여성 예약 팁'),
          E('strong', {}, '생리 기간 피하기 & 금식 확인'),
          E('p', { class: 'small muted' }, '부인과 초음파·자궁경부 검사는 생리가 끝난 뒤 예약하는 편이 수월합니다. 공복혈당 포함 채혈이 예정돼 있다면 8시간 이상 금식 필요 여부를 예약 시 확인하세요.')),
        E('div', { class: 'prenatal-mini-card' },
          E('span', { class: 'prenatal-mini-kicker' }, '남성 정액검사 팁'),
          E('strong', {}, '2 ~ 5일 금욕 & 채취실 예약'),
          E('p', { class: 'small muted' }, '정확한 정액검사 결과를 위해 검사 전 2~5일 금욕이 일반적으로 권장됩니다. 현대여성아동병원 난임센터 이용 시간과 예약 절차를 미리 확인하세요.')),
        E('div', { class: 'prenatal-mini-card' },
          E('span', { class: 'prenatal-mini-kicker' }, '필수 지참물'),
          E('strong', {}, '신분증 + 검사의뢰서'),
          E('p', { class: 'small muted' }, 'e보건소 검사의뢰서 출력본(또는 파일)과 신분증을 지참하고, 수납 시 영수증·진료비 세부내역서를 함께 챙겨 1개월 이내 청구하세요.')))),

    E('section', { class: 'prenatal-card prenatal-checklist-card', 'aria-labelledby': 'prenatal-checklist-title' },
      E('div', { class: 'lachma-prep-head' },
        E('div', {},
          E('h3', { id: 'prenatal-checklist-title' }, `✅ 우리 두 사람 산전검사 진행 체크 (${checkDone}/${checkTotal} 완료 · ${pct}%)`),
          E('p', { class: 'small muted' }, '체크 상태는 이 기기의 개인 설정에만 저장되며 개인 백업에 함께 포함됩니다.')),
        checkDone > 0 ? button('체크 초기화', async () => {
          if (!await ctx.confirmAction({ title: '산전검사 체크 초기화', message: '산전검사 진행 체크 표시를 모두 초기화할까요?', confirmLabel: '초기화', danger: true })) return;
          ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), prenatalChecks: [] }).then(ok => {
            if (ok && ctx.currentRoute() === 'prenatal') { ctx.render(); ctx.toast('산전검사 체크를 초기화했습니다.'); }
            return ok;
          }));
        }, 'checklist-note-btn') : null),
      E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` })),
      E('ul', { class: 'ceremony-prep-list prenatal-check-list' }, PRENATAL_CHECK_ITEMS.map(([cid, label]) => {
        const done = checkedSet.has(cid);
        const box = E('input', { type: 'checkbox', id: `prenatal-${cid}` });
        box.checked = done;
        box.addEventListener('change', () => toggleCheck(cid, box.checked));
        return E('li', { class: 'lachma-prep-check-item' + (done ? ' done' : '') },
          E('label', { for: box.id }, box, E('span', { class: 'small' }, label)));
      }))),

    E('section', { class: 'prenatal-card prenatal-note-card', 'aria-labelledby': 'prenatal-note-title' },
      E('h3', { id: 'prenatal-note-title' }, '📝 산전검사 예약·문의 개인 메모'),
      E('p', { class: 'small muted' }, '예약 날짜, 전화 문의 내용, 보건소 접수일 등을 간단히 기록해 두세요. 이 기기의 개인 설정에만 저장되며 공개 사이트·하객 화면에는 노출되지 않습니다.'),
      E('label', { class: 'field', for: noteField.id }, '진행 메모 (최대 1,000자)', noteField),
      E('div', { class: 'page-actions prenatal-note-actions' }, saveNoteBtn, clearNoteBtn),
      E('p', { class: 'small muted prenatal-privacy-note' }, '🔒 개인정보 보호 안내: 진단 결과, 혈액검사 수치, 주민등록번호 등 민감한 의료·개인정보는 브라우저나 백업 파일에 입력하지 말고 병원 공식 결과지로만 보관해 주세요.')));

  const sourcesBox = E('section', { class: 'prenatal-sources-box', 'aria-label': '자료 출처 및 확인 기준일' },
    E('strong', { class: 'small' }, '📚 확인 기준일: 2026-11 · 공공 자료 출처'),
    E('ul', { class: 'prenatal-bullet-list small muted' },
      E('li', {}, '국가 지원 기준: 보건복지부 『2026년 모자보건사업 안내』 · 찾기쉬운 생활법령정보(easylaw.go.kr) · 공공보건포털 e보건소(e-health.go.kr)'),
      E('li', {}, '순천시 지원·보건소 정보: 순천시청 출산장려지원(suncheon.go.kr) · 순천시 보건소(health.suncheon.go.kr, 모자보건실 061-749-6916~9)'),
      E('li', {}, '병원 기본정보: 국립중앙의료원·건강보험심사평가원 공공데이터 (의료법인 내일의료재단 현대여성아동병원 기본·난임지정·비급여 고지 참고)'),
      E('li', {}, '본 안내는 공공자료를 바탕으로 정리한 참고 가이드이며 의학적 진단이나 최신 예산 보증을 대체하지 않습니다. 방문·신청 전 병원과 순천시 보건소에 최신 일정을 직접 확인해 주세요.')));

  const activePanel = prenatalSubTab === 'subsidy'
    ? subsidyPanel
    : prenatalSubTab === 'guide'
      ? guidePanel
      : hospitalPanel;

  return [
    ctx.pageHeader(
      '산전검사 & 지원금 안내',
      '자주 이용하는 순천 현대여성아동병원 정보와 국가·순천시 산전검사 지원금 수령 절차를 한눈에 정리했어요.',
      E('div', { class: 'page-actions' },
        button('📋 핵심 절차 요약 복사', () => ctx.copyTextToClipboard(buildPrenatalSummaryText(prefs), '순천 현대여성아동병원 및 산전검사 지원금 요약을 복사했습니다.', '산전검사 요약 복사'), 'button quiet'),
        button('🖨️ 안내 인쇄 / PDF', () => window.print(), 'button quiet')),
      'PRENATAL CARE · SUNCHEON HYUNDAI'
    ),
    kpiStrip,
    subTabBar,
    activePanel,
    sourcesBox
  ];
}
