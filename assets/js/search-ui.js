import { E, button } from './dom.js?v=wedding-features-68';
import { activeVendorSchedules } from './planning.js?v=wedding-features-68';

const STATIC_COMMANDS = [
  { id: 'nav-home', category: '메뉴', icon: '🏡', title: '홈 · 웨딩 준비 대시보드', subtitle: '단계별 포커스·마스터 캘린더·체크리스트', keywords: '홈 대시보드 마스터 캘린더 체크리스트 일정 dday', route: 'home' },
  { id: 'nav-invitation', category: '메뉴', icon: '💌', title: '모바일 청첩장', subtitle: '예식 일시·오시는 길·초대 문구·QR·이미지 저장', keywords: '청첩장 초대장 계좌 혼주 오시는길 지도 약도 qr 공유 rsvp 순천아모르', route: 'invitation' },
  { id: 'nav-story', category: '메뉴', icon: '📖', title: '우리의 일대기', subtitle: '첫 만남부터 결혼까지 타임라인 기록', keywords: '일대기 스토리 이야기 연애 기록', route: 'story' },
  { id: 'nav-albums', category: '메뉴', icon: '📷', title: '포토 앨범', subtitle: '웨딩 사진 앨범·대표 커버 지정', keywords: '포토 앨범 사진 갤러리 대표 커버 웨딩사진', route: 'albums' },
  { id: 'nav-studios', category: '스튜디오', icon: '📸', title: '라크마 스튜디오 촬영 안내 (2027-02-03 12:00)', subtitle: '루나메이크업(천변좌로 432) → 중앙로 117 · 헬퍼비 현금 25만 원 · 위약금', keywords: '스튜디오 라크마 lacma 촬영 루나메이크업 헬퍼비 25만원 현금 위약금 야간촬영 누브라 준비물 062-714-1970', route: 'studios' },
  { id: 'nav-honeymoon', category: '메뉴', icon: '✈️', title: '신혼여행 핵심 4곳 가이드 · 후보 비교 (세부·발리·하와이·괌 + 더보기)', subtitle: '세부·발리·하와이·괌 24곳 + 더보기(나트랑·다낭) 12곳 · 출국 짐', keywords: '신혼여행 허니문 세부 막탄 발리 하와이 괌 나트랑 다낭 호이안 하나투어 모두투어 노랑풍선 여행이지 짐 체크리스트 출국', route: 'honeymoon' },
  { id: 'nav-ceremony-rundown', category: '본식', icon: '💍', title: '본식 식순 · 사회자 대본 · 서약서/선언문', subtitle: '순천아모르 12단계 주례 없는 식순 · 라이브 큐시트', keywords: '본식 식순 사회자 대본 혼인서약서 성혼선언문 큐시트 축가 연회홀 아모르', route: 'ceremony', subTab: 'rundown' },
  { id: 'nav-ceremony-guests', category: '본식', icon: '👥', title: '하객 명단 · RSVP CSV 동기화', subtitle: '청첩장 발송·참석 확정·식권 집계·축의대 명부 인쇄', keywords: '하객 명단 rsvp csv 구글폼 청첩장 발송 식권 예상인원 인쇄', route: 'ceremony', subTab: 'guests' },
  { id: 'nav-ceremony-gifts', category: '본식', icon: '⚡', title: '축의금 장부 · 축의대 빠른 연속 입력', subtitle: '현금/계좌 축의금·식권·답례품·감사문자 정산', keywords: '축의금 장부 축의대 빠른입력 정산 답례품 감사문자 감사인사 식권', route: 'ceremony', subTab: 'gifts' },
  { id: 'nav-ceremony-dayops', category: '본식', icon: '💼', title: '본식 당일 역할 · 현금 봉투 · 원판 순서', subtitle: '축의대·가방순이·봉투 준비·현장용 A4 1장 인쇄', keywords: '당일 역할 분담 가방순이 현금 봉투 원판 촬영 순서표 운영표 a4', route: 'ceremony', subTab: 'dayops' },
  { id: 'nav-prenatal-hospital', category: '산전검사', icon: '🏥', title: '순천 현대여성아동병원 안내', subtitle: '조례동 · 061-720-1111 · 진료시간·예약·보건소 연계', keywords: '산전검사 현대여성아동병원 순천 조례동 061-720-1111 산부인과 예약', route: 'prenatal', subTab: 'hospital' },
  { id: 'nav-prenatal-subsidy', category: '산전검사', icon: '💰', title: '산전검사 국가·순천시 지원금 & 마감일 계산기', subtitle: '여성 13만 · 남성 5만 · 순천시 각 4만 · 엽산제 · e보건소', keywords: '산전검사 지원금 e보건소 임신 사전건강관리 13만원 5만원 4만원 엽산제 마감일 청구', route: 'prenatal', subTab: 'subsidy' },
  { id: 'nav-prenatal-guide', category: '산전검사', icon: '🩺', title: '산전검사 항목 & 준비 체크리스트', subtitle: 'AMH·초음파·정액검사·준비물 체크', keywords: '산전검사 항목 amh 초음파 정액검사 체크리스트 준비물', route: 'prenatal', subTab: 'guide' },
  { id: 'nav-tips-tips', category: '결혼 정보', icon: '🎬', title: '결혼 준비 꿀팁 유튜브 50선', subtitle: '예산·스드메·웨딩홀·본식·신혼여행 영상 큐레이션', keywords: '꿀팁 유튜브 영상 50선 스드메 드레스 메이크업 본식스냅', route: 'tips', subTab: 'tips' },
  { id: 'nav-tips-budget', category: '결혼 정보', icon: '📊', title: '통합 예산 계산기 · 웨딩홀/스드메 시뮬레이터', subtitle: '6대 항목 도넛 차트 · 식대/보증인원 · 헬퍼비 시뮬레이션', keywords: '예산 계산기 6대예산 웨딩홀 식대 보증인원 대관료 스드메 시뮬레이터', route: 'tips', subTab: 'budget' },
  { id: 'nav-tips-schedule', category: '결혼 정보', icon: '🗓️', title: '주요 업체 일정 · 피팅 · 잔금 보드', subtitle: '촬영·가봉·시식·계약금/잔금 날짜 관리', keywords: '업체 일정 피팅 가봉 시식 잔금 계약금 보드', route: 'tips', subTab: 'schedule' },
  { id: 'nav-tips-home', category: '결혼 정보', icon: '🏠', title: '신혼집 · 혼수(가전·가구) 품목 관리', subtitle: '품목별 견적·계약금·잔금·배송일 캘린더', keywords: '신혼집 혼수 가전 가구 냉장고 세탁기 침대 tv 배송일', route: 'tips', subTab: 'home' },
  { id: 'nav-tips-benefits', category: '결혼 정보', icon: '🏛️', title: '혼인신고 · 순천/전남/정부 신혼부부 혜택', subtitle: '순천시청 장명로 30 · 청년부부 결혼축하금 200만 원 · 세액공제', keywords: '혼인신고 순천시청 장명로 30 결혼축하금 200만원 신혼부부 혜택 보금자리 세액공제 증여공제 전남아이톡', route: 'tips', subTab: 'benefits' },
  { id: 'act-quick-gift', category: '빠른 실행', icon: '⚡', title: '축의대 현장 빠른 연속 입력 바로 열기', subtitle: '양가·방식 고정, 1-tap 금액·식권 연속 접수', keywords: '축의대 빠른 입력 연속 접수 현장 당일', route: 'ceremony', subTab: 'gifts', action: 'quick-gift' },
  { id: 'act-couple-sync', category: '빠른 실행', icon: '💑', title: '신랑·신부 3초 기록 동기화 (카톡 복붙 코드)', subtitle: '하객·축의금·예산·혼수·메모를 두 기기 간 즉시 병합', keywords: '동기화 신랑 신부 카톡 백업 합치기 코드 공유 sync', route: 'home', action: 'couple-sync' },
  { id: 'act-shoot-day', category: '빠른 실행', icon: '📸', title: '라크마 촬영 당일 현장 브리핑 모드', subtitle: '루나메이크업→중앙로 117 동선·현금 25만·미챙김 준비물·타임테이블', keywords: '촬영 당일 현장 브리핑 라크마 루나메이크업 타임테이블', route: 'studios', action: 'shoot-day' },
  { id: 'act-wedding-day', category: '빠른 실행', icon: '💍', title: '본식 당일 현장 통합 모드 (큐시트·축의대·봉투·원판)', subtitle: '화면 켜짐 유지 + 본식 핵심 현장 도구 1-tap 전환', keywords: '본식 당일 현장 통합 스위처 큐시트 봉투 원판', route: 'ceremony', action: 'wedding-day' }
];

export function searchWeddingWorkspace(query, { content = {}, prefs = {}, studio = null, studios = [] } = {}) {
  const q = String(query || '').trim().toLocaleLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const matches = hay => {
    if (!tokens.length) return true;
    const lower = String(hay || '').toLocaleLowerCase();
    return tokens.every(tok => lower.includes(tok));
  };

  const results = [];
  const push = item => {
    if (results.length < 36) results.push(item);
  };

  for (const cmd of STATIC_COMMANDS) {
    if (matches(`${cmd.title} ${cmd.subtitle} ${cmd.keywords} ${cmd.category}`)) {
      push(cmd);
    }
  }

  if (!tokens.length) {
    return results.slice(0, 10);
  }

  // Honeymoon trips (30)
  for (const trip of content?.honeymoon || []) {
    const hay = `${trip.title} ${trip.country} ${trip.pros || ''} ${trip.cons || ''} ${prefs?.tripNotes?.[trip.id] || ''}`;
    if (matches(hay)) {
      push({
        id: `trip-${trip.id}`,
        category: '신혼여행',
        icon: '✈️',
        title: trip.title,
        subtitle: `${trip.country || ''} · ${trip.budget ? `${Math.round(trip.budget / 10000).toLocaleString('ko-KR')}만 원` : '예산 미정'}`,
        route: 'honeymoon',
        focusTripId: trip.id
      });
    }
  }

  // Wedding tips (50)
  for (const tip of content?.tips || []) {
    const hay = `${tip.title} ${tip.category || ''} ${tip.channel || ''} ${tip.body || ''} ${prefs?.tipNotes?.[tip.id] || ''}`;
    if (matches(hay)) {
      push({
        id: `tip-${tip.id}`,
        category: '결혼 꿀팁',
        icon: '🎬',
        title: tip.title,
        subtitle: [tip.category, tip.channel].filter(Boolean).join(' · '),
        route: 'tips',
        subTab: 'tips',
        focusTipQuery: tip.title
      });
    }
  }

  // Stories
  for (const story of content?.stories || []) {
    const hay = `${story.title || ''} ${story.body || ''} ${story.date || ''}`;
    if (matches(hay)) {
      push({
        id: `story-${story.id}`,
        category: '우리의 일대기',
        icon: '📖',
        title: story.title,
        subtitle: story.date || '날짜 없는 기록',
        route: 'story',
        focusStoryQuery: story.title
      });
    }
  }

  // Albums
  for (const album of content?.albums || []) {
    const hay = `${album.title || ''} ${album.body || ''} ${album.date || ''}`;
    if (matches(hay)) {
      push({
        id: `album-${album.id}`,
        category: '포토 앨범',
        icon: '📷',
        title: album.title,
        subtitle: [album.date || '', `사진 ${(album.images || []).length}장`].filter(Boolean).join(' · '),
        route: 'albums',
        focusRecordType: 'albums',
        focusRecordId: album.id
      });
    }
  }

  // Private guests
  for (const g of prefs?.guestList || []) {
    if (matches(`${g.name} ${g.side} ${g.group} ${g.rsvp} ${g.note || ''}`)) {
      push({
        id: `guest-${g.id}`,
        category: '하객 명단',
        icon: '👥',
        title: `${g.name} (${g.side} · ${g.partySize}명)`,
        subtitle: `${g.group} · ${g.rsvp}${g.note ? ` · ${g.note}` : ''}`,
        route: 'ceremony',
        subTab: 'guests',
        focusGuestQuery: g.name
      });
    }
  }

  // Private gifts
  for (const gift of prefs?.giftLedger || []) {
    if (matches(`${gift.name} ${gift.side} ${gift.group} ${gift.channel} ${gift.note || ''}`)) {
      push({
        id: `gift-${gift.id}`,
        category: '축의금 장부',
        icon: '💌',
        title: `${gift.name} · ${Number(gift.amount || 0).toLocaleString('ko-KR')}원`,
        subtitle: `${gift.side} · ${gift.channel} · 식권 ${gift.mealTickets}매`,
        route: 'ceremony',
        subTab: 'gifts',
        focusGiftQuery: gift.name
      });
    }
  }

  // Private wedding-day roles & envelopes
  for (const role of prefs?.weddingDayRoles || []) {
    if (matches(`${role.group || ''} ${role.role || ''} ${role.assignee || ''} ${role.phone || ''} ${role.note || ''}`)) {
      push({
        id: `dayrole-${role.id}`,
        category: '본식 당일 역할',
        icon: '💼',
        title: `${role.role}${role.assignee ? ` · ${role.assignee}` : ''}`,
        subtitle: [role.group, role.note].filter(Boolean).join(' · '),
        route: 'ceremony',
        subTab: 'dayops'
      });
    }
  }
  for (const env of prefs?.weddingDayEnvelopes || []) {
    if (matches(`${env.payee || ''} ${env.recipient || ''} ${env.note || ''}`)) {
      push({
        id: `dayenv-${env.id}`,
        category: '본식 현금 봉투',
        icon: '✉️',
        title: `${env.payee}${env.recipient ? ` (${env.recipient})` : ''}`,
        subtitle: env.amount ? `${Number(env.amount).toLocaleString('ko-KR')}원 · ${env.ready ? '준비 완료' : '미준비'}` : (env.ready ? '준비 완료' : '금액 미입력'),
        route: 'ceremony',
        subTab: 'dayops'
      });
    }
  }

  // Private home items
  for (const item of prefs?.homeItems || []) {
    if (matches(`${item.name} ${item.brand || ''} ${item.category || ''} ${item.status || ''} ${item.note || ''}`)) {
      push({
        id: `home-${item.id}`,
        category: '혼수·가전',
        icon: '🏠',
        title: `${item.name}${item.brand ? ` (${item.brand})` : ''}`,
        subtitle: `${item.status || ''}${item.deliveryDate ? ` · 배송 ${item.deliveryDate}` : ''}`,
        route: 'tips',
        subTab: 'home',
        focusHomeQuery: item.name
      });
    }
  }

  // Custom home checklist items
  for (const chk of prefs?.customChecklist || []) {
    const note = prefs?.checklistNotes?.[chk.id] || '';
    if (matches(`${chk.stage || ''} ${chk.title || ''} ${note}`)) {
      push({
        id: `chk-${chk.id}`,
        category: '홈 체크리스트',
        icon: '✅',
        title: chk.title,
        subtitle: [chk.stage, note].filter(Boolean).join(' · '),
        route: 'home',
        focusElementId: 'home-checklist-title'
      });
    }
  }

  // Vendor schedules
  for (const v of activeVendorSchedules(prefs)) {
    if (matches(`${v.name} ${v.category || ''} ${v.date || ''} ${v.note || ''}`)) {
      push({
        id: `vendor-${v.id}`,
        category: '업체 일정',
        icon: '🗓️',
        title: v.name,
        subtitle: `${v.date || '날짜 미정'} · ${v.category || ''}`,
        route: 'tips',
        subTab: 'schedule'
      });
    }
  }

  // Studio guide deep items
  if (studio?.deepGuide?.prepChecklist) {
    for (const grp of studio.deepGuide.prepChecklist) {
      if (matches(`${grp.category} ${(grp.items || []).join(' ')}`)) {
        push({
          id: `studio-prep-${grp.category}`,
          category: '라크마 준비물',
          icon: '🎒',
          title: `라크마 준비물 · ${grp.category}`,
          subtitle: (grp.items || []).slice(0, 2).join(', '),
          route: 'studios'
        });
      }
    }
  }

  // All 30 preserved reference studios
  for (const s of Array.isArray(studios) ? studios : []) {
    const hay = `${s.name || ''} ${s.style || ''} ${s.pros || ''} ${s.cons || ''} ${s.fit || ''} ${s.fee || ''} ${s.contact?.phone || ''} ${s.contact?.note || ''} ${prefs?.notes?.[s.id] || ''}`;
    if (matches(hay)) {
      push({
        id: `studio-ref-${s.id}`,
        category: '스튜디오 참고',
        icon: '📸',
        title: s.name,
        subtitle: [s.style, s.contact?.phone || '연락처 미기재'].filter(Boolean).join(' · '),
        route: 'studios',
        focusStudioQuery: s.name
      });
    }
  }

  return results;
}

export function openGlobalSearchModal(ctx) {
  if (ctx.isGuestMode()) return;
  const input = E('input', {
    type: 'search',
    id: 'global-search-input',
    class: 'global-search-input',
    placeholder: '메뉴, 스튜디오 30곳, 하객 이름, 세부·발리, 혼수, 산전검사 등 검색…',
    'aria-label': '전체 메뉴·스튜디오·기록·여행·꿀팁 통합 검색',
    autocomplete: 'off'
  });
  const quickChips = E('div', { class: 'global-search-chips' },
    [
      ['라크마', '📸 라크마 동선·헬퍼비'],
      ['예산', '📊 통합 예산'],
      ['하객', '👥 하객·RSVP'],
      ['축의대', '⚡ 축의대 빠른 입력'],
      ['세부', '✈️ 세부 후보'],
      ['발리', '✈️ 발리 후보'],
      ['산전검사', '🩺 산전검사 지원금'],
      ['결혼축하금', '🏛️ 순천 200만 원']
    ].map(([kw, label]) => button(label, () => {
      input.value = kw;
      activeIndex = 0;
      draw();
      input.focus();
    }, 'button quiet small-copy-btn')));

  const listWrap = E('div', { class: 'global-search-results', role: 'listbox', 'aria-label': '검색 결과' });
  const countEl = E('p', { class: 'small muted global-search-count', 'aria-live': 'polite' });
  let currentItems = [];
  let activeIndex = 0;

  const activate = item => {
    if (!item) return;
    ctx.closeDialog();
    ctx.navigateToRoute(item.route, item.subTab || '', item.action || '');
    if (item.focusTripId) {
      setTimeout(() => ctx.focusTrip(item.focusTripId), 160);
    } else if (item.focusStudioQuery && ctx.focusStudioArchive) {
      setTimeout(() => ctx.focusStudioArchive(item.focusStudioQuery), 160);
    } else if (item.focusTipQuery && ctx.focusTipSearch) {
      setTimeout(() => ctx.focusTipSearch(item.focusTipQuery), 160);
    } else if (item.focusGuestQuery && ctx.focusGuestSearch) {
      setTimeout(() => ctx.focusGuestSearch(item.focusGuestQuery), 160);
    } else if (item.focusGiftQuery && ctx.focusGiftSearch) {
      setTimeout(() => ctx.focusGiftSearch(item.focusGiftQuery), 160);
    } else if (item.focusHomeQuery && ctx.focusHomeSearch) {
      setTimeout(() => ctx.focusHomeSearch(item.focusHomeQuery), 160);
    } else if (item.focusStoryQuery && ctx.focusStorySearch) {
      setTimeout(() => ctx.focusStorySearch(item.focusStoryQuery), 160);
    } else if (item.focusRecordType && item.focusRecordId) {
      setTimeout(() => ctx.focusRecord(item.focusRecordType, item.focusRecordId), 160);
    } else if (item.focusElementId) {
      setTimeout(() => document.getElementById(item.focusElementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160);
    }
  };

  const draw = () => {
    currentItems = searchWeddingWorkspace(input.value, {
      content: ctx.getContent(),
      prefs: ctx.getPrefs(),
      studio: ctx.getStudiosState().activeLachma,
      studios: ctx.getStudiosList?.() || []
    });
    if (activeIndex >= currentItems.length) activeIndex = 0;
    countEl.textContent = input.value.trim()
      ? `검색 결과 ${currentItems.length}건 (↑↓ 이동 · Enter로 바로 가기)`
      : '자주 찾는 핵심 화면 (키워드를 입력하면 30개 스튜디오·30개 여행·50개 꿀팁·개인 기록까지 함께 검색됩니다)';
    if (!currentItems.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted global-search-empty' }, '일치하는 메뉴나 기록이 없습니다. 다른 키워드로 검색해 보세요.'));
      return;
    }
    listWrap.replaceChildren(...currentItems.map((item, idx) => E('button', {
      type: 'button',
      role: 'option',
      class: 'global-search-item' + (idx === activeIndex ? ' is-selected' : ''),
      'aria-selected': String(idx === activeIndex),
      onclick: () => activate(item)
    },
      E('span', { class: 'global-search-icon', 'aria-hidden': 'true' }, item.icon || '•'),
      E('span', { class: 'global-search-copy' },
        E('strong', {}, item.title),
        E('span', { class: 'small muted' }, item.subtitle || '')),
      E('span', { class: 'badge' }, item.category))));
  };

  input.addEventListener('input', () => { activeIndex = 0; draw(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && currentItems.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % currentItems.length;
      draw();
      listWrap.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp' && currentItems.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
      draw();
      listWrap.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && currentItems.length) {
      event.preventDefault();
      activate(currentItems[activeIndex]);
    }
  });

  draw();
  const body = E('div', { class: 'global-search-modal' },
    input,
    quickChips,
    countEl,
    listWrap);

  if (ctx.showDialog('🔍 전체 빠른 검색 (Ctrl+K)', body)) {
    input.focus();
  }
}
