import { E, button, externalLink, downloadText, searchBox } from './dom.js?v=wedding-features-57';
import { formatDate, weddingDday } from './content.js?v=wedding-features-57';
import { HOME_ITEM_CATEGORIES, HOME_ITEM_STATUSES } from './preferences.js?v=wedding-features-57';
import { homeItemsSummary, homeItemsToCsv, marriageBenefitTimeline } from './planning.js?v=wedding-features-57';
import { scheduleCalendar, scheduleGoogleCalendarUrl } from './calendar.js?v=wedding-features-57';

const won = value => (value === null || value === undefined ? '미입력' : `${value.toLocaleString('ko-KR')}원`);

let homeCatFilter = 'all';
let homeStatusFilter = 'all';
let homeSearch = '';

const STARTER_HOME_ITEMS = [
  ['📺 가전', 'TV (거실)'],
  ['📺 가전', '냉장고 · 김치냉장고'],
  ['📺 가전', '세탁기 · 건조기'],
  ['📺 가전', '에어컨 (거실·안방)'],
  ['📺 가전', '식기세척기 · 인덕션'],
  ['📺 가전', '무선 청소기 · 로봇청소기'],
  ['🛋️ 가구', '침대 프레임 · 매트리스'],
  ['🛋️ 가구', '거실 소파'],
  ['🛋️ 가구', '식탁 · 의자 세트'],
  ['🏠 입주·인테리어', '입주 청소 · 줄눈 · 커튼']
];

export const BENEFIT_CHECK_ITEMS = [
  ['bchk-witness', '혼인신고서 작성 및 성년 증인 2명 서명·날인 받기 (증인 방문 동행 불필요)'],
  ['bchk-reg', '순천시청 신청사(장명로 30) 종합민원실 또는 행정복지센터에서 혼인신고 접수'],
  ['bchk-move', '신혼집 입주·이사 후 14일 이내 정부24(또는 행정복지센터) 전입신고 및 확정일자 확인'],
  ['bchk-congrats', '혼인신고 6개월 경과 후 1년 6개월 이내 순천시 청년부부 결혼축하금(200만 원) 신청 (행정복지센터·전남 아이톡)'],
  ['bchk-housing', '순천시 신혼부부·다자녀가정 보금자리 지원사업(주택 구입 대출이자 월 최대 25만 원) 하반기 공고 확인'],
  ['bchk-tax', '혼인신고 연도에 따른 결혼세액공제(2026 신고분 최대 100만 원) 또는 2027 혼인지원금 최종 확정 여부 확인'],
  ['bchk-gift', '양가 지원 자금이 있는 경우 혼인 증여재산공제(신고 전후 2년 이내 최대 1억 원 추가) 세무 신고 확인'],
  ['bchk-loan', '신혼집 자금 계획에 맞춰 주택도시기금 신혼부부 전용 버팀목(전세)·디딤돌(구입) 대출 조건 확인']
];

const SUNCHEON_CITY_HALL = {
  name: '순천시청 신청사 (종합민원실)',
  address: '전라남도 순천시 장명로 30 (장천동)',
  phone: '061-749-3114',
  altPhone: '061-749-0000',
  youthPhone: '061-749-3226',
  housingPhone: '061-749-4207',
  naverMapUrl: 'https://map.naver.com/p/search/%EC%88%9C%EC%B2%9C%EC%8B%9C%EC%B2%AD%20%EC%9E%A5%EB%AA%85%EB%A1%9C%2030',
  gov24MarriageUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000050',
  gov24MoveUrl: 'https://www.gov.kr/',
  italkUrl: 'https://italk.jeonnam.go.kr',
  suncheonUrl: 'https://www.suncheon.go.kr',
  nhufUrl: 'https://nhuf.molit.go.kr/',
  hfUrl: 'https://www.hf.go.kr/ko/sub01/sub01_02_01.do'
};

function openHomeItemEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing?.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '혼수·가전·가구 항목과 견적·배송일은 이 기기의 개인 설정에만 저장되며 방문자용 청첩장에는 노출되지 않습니다.'));

  const catSel = E('select', { id: 'home-item-cat' }, HOME_ITEM_CATEGORIES.map(c => E('option', { value: c }, c)));
  if (isEdit && HOME_ITEM_CATEGORIES.includes(existing.category)) catSel.value = existing.category;
  const statusSel = E('select', { id: 'home-item-status' }, HOME_ITEM_STATUSES.map(s => E('option', { value: s }, s)));
  if (isEdit && HOME_ITEM_STATUSES.includes(existing.status)) statusSel.value = existing.status;

  const nameIn = E('input', { type: 'text', id: 'home-item-name', maxlength: '100', required: true, placeholder: '예: 냉장고 · 김치냉장고' });
  nameIn.value = existing?.name || '';
  const brandIn = E('input', { type: 'text', id: 'home-item-brand', maxlength: '100', placeholder: '예: LG 오브제 / 삼성 비스포크 (선택)' });
  brandIn.value = existing?.brand || '';
  const plannedIn = E('input', { type: 'number', id: 'home-item-planned', min: '0', max: '1000000000', step: '1', placeholder: '예: 2500000' });
  plannedIn.value = existing?.plannedPrice ?? '';
  const actualIn = E('input', { type: 'number', id: 'home-item-actual', min: '0', max: '1000000000', step: '1', placeholder: '예: 2350000' });
  actualIn.value = existing?.actualPrice ?? '';
  const depositIn = E('input', { type: 'number', id: 'home-item-deposit', min: '0', max: '1000000000', step: '1', placeholder: '예: 300000' });
  depositIn.value = existing?.deposit ?? '';
  const dateIn = E('input', { type: 'date', id: 'home-item-date' });
  dateIn.value = existing?.deliveryDate || '';
  const noteIn = E('input', { type: 'text', id: 'home-item-note', maxlength: '300', placeholder: '예: 백화점 웨딩마일리지 적립 / 무료 설치 조건' });
  noteIn.value = existing?.note || '';

  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: catSel.id }, '분류', catSel),
      E('label', { class: 'field', for: statusSel.id }, '진행 상태', statusSel)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: nameIn.id }, '품목명 *', nameIn),
      E('label', { class: 'field', for: brandIn.id }, '브랜드·모델명 (선택)', brandIn)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: plannedIn.id }, '목표 예산 (원)', plannedIn),
      E('label', { class: 'field', for: actualIn.id }, '계약·실제 금액 (원)', actualIn)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: depositIn.id }, '기납부 계약금 (원)', depositIn),
      E('label', { class: 'field', for: dateIn.id }, '배송·설치 예정일 (선택)', dateIn)),
    E('label', { class: 'field', for: noteIn.id }, '매장·혜택·설치 메모 (선택)', noteIn));

  const submit = E('button', { class: 'button', type: 'submit' }, isEdit ? '품목 저장' : '품목 추가');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));

  const numOrNull = node => (node.value.trim() === '' ? null : Number(node.value));
  const snapshot = () => JSON.stringify([catSel.value, statusSel.value, nameIn.value, brandIn.value, plannedIn.value, actualIn.value, depositIn.value, dateIn.value, noteIn.value]);
  const initial = snapshot();
  let saving = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const name = nameIn.value.trim();
      if (!name) throw new Error('품목명을 입력해 주세요.');
      const list = [...(ctx.getPrefs().homeItems || [])];
      if (!isEdit && list.length >= 150) throw new Error('혼수·가전·가구 항목은 150개까지 보관할 수 있습니다.');
      const entry = {
        id: isEdit ? existing.id : 'home-' + crypto.randomUUID().slice(0, 8),
        category: catSel.value,
        name,
        ...(brandIn.value.trim() ? { brand: brandIn.value.trim() } : {}),
        status: statusSel.value,
        plannedPrice: numOrNull(plannedIn),
        actualPrice: numOrNull(actualIn),
        deposit: numOrNull(depositIn),
        ...(dateIn.value.trim() ? { deliveryDate: dateIn.value.trim() } : {}),
        ...(noteIn.value.trim() ? { note: noteIn.value.trim() } : {})
      };
      const nextList = isEdit ? list.map(item => (item.id === entry.id ? entry : item)) : [...list, entry];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), homeItems: nextList }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast(isEdit ? '혼수 품목을 수정했습니다.' : '혼수·가전·가구 보드에 품목을 추가했습니다.');
      }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  if (ctx.showDialog(isEdit ? '혼수 품목 수정' : '혼수·가전·가구 품목 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function buildHomeItemsSummaryText(items, sum) {
  const lines = [
    '🏠 [신혼집 · 혼수(가전·가구) 준비 요약]',
    `• 총 ${sum.totalCount}건 (계약 이상 ${sum.contractedCount}건 · 배송/설치 완료 ${sum.doneCount}건)`,
    `• 목표 예산 소계: ${won(sum.plannedTotal)} / 계약·실제 소계: ${won(sum.actualTotal)}`,
    `• 기납부 계약금: ${sum.depositTotal.toLocaleString('ko-KR')}원 / 잔금: ${won(sum.balanceTotal)}`,
    ''
  ];
  for (const item of items) {
    const pricePart = item.actualPrice !== null ? `실제 ${won(item.actualPrice)}` : item.plannedPrice !== null ? `목표 ${won(item.plannedPrice)}` : '금액 미입력';
    const datePart = item.deliveryDate ? ` · 배송 ${item.deliveryDate}` : '';
    lines.push(`- [${item.status}] ${item.category} ${item.name}${item.brand ? ` (${item.brand})` : ''} · ${pricePart}${datePart}`);
  }
  return lines.join('\n');
}

export function renderHomeItemsBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const items = prefs.homeItems || [];
  const sum = homeItemsSummary(items);

  const cycleStatus = item => {
    const idx = HOME_ITEM_STATUSES.indexOf(item.status);
    const nextStatus = HOME_ITEM_STATUSES[(idx + 1) % HOME_ITEM_STATUSES.length];
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs().homeItems || [];
      const next = latest.map(row => (row.id === item.id ? { ...row, status: nextStatus } : row));
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), homeItems: next });
      if (ok) { ctx.render(); ctx.toast(`‘${item.name}’ 상태를 ‘${nextStatus}’(으)로 변경했습니다.`); }
      return ok;
    });
  };

  const deleteItem = item => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs().homeItems || [];
      const removedIndex = latest.findIndex(row => row.id === item.id);
      if (removedIndex < 0) return true;
      const removedSnapshot = structuredClone(latest[removedIndex]);
      const next = latest.filter(row => row.id !== item.id);
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), homeItems: next });
      if (ok) {
        ctx.render();
        ctx.toast(`‘${item.name}’ 혼수 품목을 삭제했습니다.`, {
          undoLabel: '되돌리기',
          onUndo: () => ctx.queuePreference(async () => {
            const cur = [...(ctx.getPrefs().homeItems || [])];
            if (cur.some(row => row.id === removedSnapshot.id)) return true;
            cur.splice(Math.min(removedIndex, cur.length), 0, removedSnapshot);
            const restored = await ctx.savePrefs({ ...ctx.getPrefs(), homeItems: cur });
            if (restored) { ctx.render(); ctx.toast(`‘${removedSnapshot.name}’ 항목을 복구했습니다.`); }
            return restored;
          })
        });
      }
      return ok;
    });
  };

  const addStarterItems = () => {
    const existingKeys = new Set(items.map(i => `${i.category}|${i.name}`));
    const toAdd = STARTER_HOME_ITEMS
      .filter(([cat, name]) => !existingKeys.has(`${cat}|${name}`))
      .map(([category, name]) => ({
        id: 'home-' + crypto.randomUUID().slice(0, 8),
        category,
        name,
        status: '후보 비교',
        plannedPrice: null,
        actualPrice: null,
        deposit: null
      }));
    if (!toAdd.length) {
      ctx.toast('기본 혼수 품목 10종이 이미 모두 들어 있습니다.');
      return;
    }
    if (items.length + toAdd.length > 150) {
      ctx.toast('최대 150개 한도를 초과합니다.', true);
      return;
    }
    ctx.queuePreference(async () => {
      const next = [...items, ...toAdd];
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), homeItems: next });
      if (ok) { ctx.render(); ctx.toast(`기본 혼수 품목 ${toAdd.length}종을 채웠습니다. 각 품목을 눌러 브랜드·견적·배송일을 입력해 보세요.`); }
      return ok;
    });
  };

  const syncToBudget = () => {
    if (sum.plannedTotal === null && sum.actualTotal === null) {
      ctx.toast('반영할 목표 예산 또는 계약·실제 금액이 아직 입력되지 않았습니다.', true);
      return;
    }
    const nextPlan = structuredClone(ctx.getPrefs().budgetPlan || {});
    const curLiving = nextPlan.living || { planned: null, actual: null, note: '' };
    nextPlan.living = {
      planned: sum.plannedTotal ?? curLiving.planned,
      actual: sum.actualTotal ?? curLiving.actual,
      note: `혼수·가전·가구 ${sum.totalCount}건 연동 (완료 ${sum.doneCount}건)`
    };
    ctx.queuePreference(async () => {
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), budgetPlan: nextPlan });
      if (ok) { ctx.render(); ctx.toast('혼수·가전·가구 합계를 통합 예산 계산기(혼수·가전·가구)에 반영했습니다.'); }
      return ok;
    });
  };

  const listWrap = E('div', { class: 'ledger-list home-items-list' });
  const countEl = E('span', { class: 'small muted', 'aria-live': 'polite' });
  const search = searchBox({
    id: 'home-item-search',
    value: homeSearch,
    placeholder: '품목명·브랜드·메모 검색',
    ariaLabel: '혼수 품목 검색',
    onInput: val => { homeSearch = val; drawList(); }
  });

  const statusSel = E('select', { id: 'home-status-filter', 'aria-label': '진행 상태 필터' },
    E('option', { value: 'all' }, '전체 상태'),
    ...HOME_ITEM_STATUSES.map(s => E('option', { value: s }, s)));
  statusSel.value = homeStatusFilter;
  statusSel.addEventListener('change', () => { homeStatusFilter = statusSel.value; drawList(); });

  const catBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '혼수 분류 필터' });

  const drawList = () => {
    catBar.replaceChildren(...['all', ...HOME_ITEM_CATEGORIES].map(cat => {
      const cnt = cat === 'all' ? items.length : items.filter(i => i.category === cat).length;
      const btn = E('button', {
        type: 'button',
        class: 'button quiet trip-filter-chip',
        'aria-pressed': String(homeCatFilter === cat),
        onclick: () => { homeCatFilter = cat; drawList(); }
      }, cat === 'all' ? `전체 (${cnt})` : `${cat} (${cnt})`);
      return btn;
    }));
    const q = homeSearch.trim().toLocaleLowerCase();
    const filtered = items.filter(item =>
      (homeCatFilter === 'all' || item.category === homeCatFilter) &&
      (homeStatusFilter === 'all' || item.status === homeStatusFilter) &&
      (!q || `${item.name} ${item.brand || ''} ${item.note || ''}`.toLocaleLowerCase().includes(q))
    );
    countEl.textContent = `표시 ${filtered.length}건 / 전체 ${items.length}건`;

    if (!filtered.length) {
      listWrap.replaceChildren(E('div', { class: 'no-results-box' },
        E('p', { class: 'no-results' }, items.length ? '선택한 조건에 맞는 혼수 품목이 없습니다.' : '등록된 혼수·가전·가구 품목이 아직 없습니다. ‘기본 혼수 품목 10종 채우기’ 또는 ‘+ 품목 추가’로 시작해 보세요.')));
      return;
    }

    listWrap.replaceChildren(...filtered.map(item => {
      const statusClass = item.status === '배송·설치 완료' ? 'is-done' : item.status === '계약·결제 완료' ? 'is-warn' : 'is-muted';
      const balance = item.actualPrice !== null ? Math.max(0, item.actualPrice - (item.deposit || 0)) : null;
      const calPayload = item.deliveryDate ? {
        title: `[혼수 배송·설치] ${item.name}${item.brand ? ` (${item.brand})` : ''}`,
        date: item.deliveryDate,
        location: '신혼집',
        description: item.note || `${item.category} · ${item.status}`
      } : null;
      let gcalLink = null;
      let icsBtn = null;
      if (calPayload) {
        try {
          gcalLink = externalLink('📅 구글캘린더', scheduleGoogleCalendarUrl(calPayload), 'button quiet small-copy-btn');
          icsBtn = button('📥 .ics', () => {
            downloadText(scheduleCalendar(calPayload), `home-${item.id}.ics`, 'text/calendar;charset=utf-8');
            ctx.toast(`‘${item.name}’ 배송 일정(.ics)을 저장했습니다.`);
          }, 'button quiet small-copy-btn');
        } catch {}
      }
      return E('article', { class: 'ledger-row home-item-row' + (item.status === '배송·설치 완료' ? ' is-settled' : '') },
        E('div', { class: 'ledger-row-main' },
          E('div', { class: 'ledger-row-title' },
            E('span', { class: 'badge' }, item.category),
            E('strong', {}, item.name),
            item.brand ? E('span', { class: 'small muted' }, `· ${item.brand}`) : null),
          E('div', { class: 'home-item-metrics small' },
            E('span', {}, `목표 ${won(item.plannedPrice)}`),
            E('span', {}, `계약·실제 ${won(item.actualPrice)}`),
            item.deposit !== null ? E('span', {}, `계약금 ${won(item.deposit)}`) : null,
            balance !== null ? E('span', { class: 'home-item-balance' }, `잔금 ${won(balance)}`) : null,
            item.deliveryDate ? E('span', { class: 'spec-chip direct' }, `🚚 ${item.deliveryDate} (${weddingDday(item.deliveryDate)})`) : null),
          item.note ? E('p', { class: 'small muted home-item-note' }, `📝 ${item.note}`) : null),
        E('div', { class: 'ledger-row-controls' },
          E('button', {
            type: 'button',
            class: `quick-cycle-btn ${statusClass}`,
            title: '누르면 다음 진행 상태로 전환됩니다',
            onclick: () => cycleStatus(item)
          }, `${item.status} ↻`),
          gcalLink,
          icsBtn,
          button('수정', () => openHomeItemEditor(ctx, item), 'button quiet small-copy-btn'),
          button('삭제', () => deleteItem(item), 'text-button small')));
    }));
  };
  drawList();

  return E('section', { class: 'private-ledger-section home-items-board', 'aria-labelledby': 'home-items-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'NEWLYWED HOME & APPLIANCES · PRIVATE'),
        E('h2', { id: 'home-items-title' }, '🏠 신혼집 · 혼수(가전·가구) 견적·배송 보드'),
        E('p', {}, '가전·가구·입주 품목별 목표가·계약가·계약금·배송일을 기록하고 통합 예산 계산기(혼수·가전·가구)에 바로 연동해요.')),
      E('div', { class: 'page-actions guest-board-toolbar' },
        button('+ 품목 추가', () => openHomeItemEditor(ctx), 'button'),
        button('✨ 기본 혼수 10종 채우기', addStarterItems, 'button quiet'),
        items.length ? button('💰 통합 예산에 합계 반영', syncToBudget, 'button quiet') : null,
        items.length ? button('📋 요약 복사', () => ctx.copyTextToClipboard(buildHomeItemsSummaryText(items, sum), '혼수·가전·가구 요약을 복사했습니다.', '혼수 요약 복사'), 'button quiet') : null,
        items.length ? button('📥 CSV 내보내기', () => {
          downloadText(homeItemsToCsv(items), 'wedding-home-items.csv', 'text/csv;charset=utf-8');
          ctx.toast('혼수·가전·가구 목록을 CSV로 저장했습니다.');
        }, 'button quiet') : null,
        items.length ? button('🖨️ 인쇄 / PDF', () => window.print(), 'button quiet') : null)),
    E('div', { class: 'ledger-kpi-grid' },
      E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '등록 · 설치 완료'), E('strong', {}, `${sum.totalCount}건 (완료 ${sum.doneCount}건)`)),
      E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '목표 예산 소계'), E('strong', {}, won(sum.plannedTotal))),
      E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '계약·실제 소계'), E('strong', {}, won(sum.actualTotal))),
      E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '계약금 차감 잔금'), E('strong', {}, won(sum.balanceTotal)))),
    E('div', { class: 'ledger-filter-controls' },
      catBar,
      E('div', { class: 'directory-controls' }, search.wrap, statusSel, countEl)),
    listWrap);
}

function buildBenefitsSummaryText(prefs, timeline) {
  const checkedSet = new Set(prefs.benefitChecks || []);
  const done = BENEFIT_CHECK_ITEMS.filter(([id]) => checkedSet.has(id)).length;
  return [
    '🏛️ [혼인신고 · 순천시/전남/정부 신혼부부 혜택 요약]',
    '',
    `1) 순천시청 신청사 (종합민원실): ${SUNCHEON_CITY_HALL.address}`,
    `• 대표전화: ${SUNCHEON_CITY_HALL.phone} / ${SUNCHEON_CITY_HALL.altPhone} (2026-10 이전 · 혼인신고 포토존 운영)`,
    '• 혼인신고 준비물: 혼인신고서(성년 증인 2명 서명·날인), 부부 신분증 (1인 방문 시 미방문 배우자 신분증·도장)',
    ...(timeline ? [
      `• 입력한 혼인신고(예정)일: ${timeline.regDate}`,
      `  - 순천 청년부부 결혼축하금 신청 구간: ${timeline.congratsStart} ~ ${timeline.congratsEnd}`,
      `  - 혼인 증여재산공제(전후 2년): ${timeline.giftStart} ~ ${timeline.giftEnd}`
    ] : []),
    '',
    '2) 순천시 · 전라남도 핵심 지원 (2026 확인 기준)',
    `• 청년부부 결혼축하금: 부부당 200만 원 (만 49세 이하 · 전남/순천 6개월 계속 거주 · 혼인신고 6개월~1년 6개월 이내 · 청년정책과 ${SUNCHEON_CITY_HALL.youthPhone})`,
    `• 신혼부부·다자녀가정 보금자리 지원: 주택 구입 대출이자 월 최대 25만 원, 최장 36개월(최대 900만 원 · 연 1회 하반기 공고 · ${SUNCHEON_CITY_HALL.housingPhone})`,
    '',
    '3) 정부 세제·주거 혜택',
    '• 결혼세액공제: 2026.12.31까지 혼인신고 시 1인 50만 원(부부 최대 100만 원) · 2027년 신고분은 2027 정부 예산안 혼인지원금 전환/연장 최종 확정 확인 필수',
    '• 혼인 증여재산공제: 혼인신고 전후 2년 이내 직계존속 증여 최대 1억 원 추가 공제',
    '• 주택도시기금 신혼부부 전용 버팀목(전세)·디딤돌(구입) 대출: 기금e든든 / 주택금융공사 확인',
    '',
    `4) 진행 체크: ${done}/${BENEFIT_CHECK_ITEMS.length} 완료`,
    ...(prefs.benefitNote ? [`📝 메모: ${prefs.benefitNote}`] : []),
    '※ 확인 기준일: 2026-11 (신청 전 순천시청·국세청·주택도시기금 최신 공고를 꼭 확인하세요.)'
  ].join('\n');
}

export function renderBenefitsGuideBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const regDate = prefs.marriageRegDate || '';
  const timeline = regDate ? marriageBenefitTimeline(regDate) : null;
  const checkedSet = new Set(prefs.benefitChecks || []);
  const checkDone = BENEFIT_CHECK_ITEMS.filter(([id]) => checkedSet.has(id)).length;
  const checkTotal = BENEFIT_CHECK_ITEMS.length;
  const pct = Math.round((checkDone / checkTotal) * 100);

  const regInput = E('input', { type: 'date', id: 'marriage-reg-date' });
  regInput.value = regDate;

  const saveRegDate = () => {
    const val = regInput.value.trim();
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const next = { ...latest };
      if (val) next.marriageRegDate = val;
      else delete next.marriageRegDate;
      const ok = await ctx.savePrefs(next);
      if (ok) {
        ctx.render();
        ctx.toast(val ? '혼인신고(예정)일을 저장하고 지원금 신청 구간을 계산했습니다.' : '혼인신고 날짜 입력을 비웠습니다.');
      }
      return ok;
    });
  };

  let congratsGcal = null;
  let congratsIcs = null;
  if (timeline) {
    const calPayload = {
      title: '[순천시] 청년부부 결혼축하금 200만 원 신청 시작',
      date: timeline.congratsStart,
      location: '주소지 읍·면·동 행정복지센터 / 전남 아이톡',
      description: `혼인신고(${timeline.regDate}) 6개월 경과 신청 가능 시작일 · 마감: ${timeline.congratsEnd} · 문의: 순천시 청년정책과 061-749-3226`
    };
    try {
      congratsGcal = externalLink('📅 신청 시작일 구글캘린더 ↗', scheduleGoogleCalendarUrl(calPayload), 'button quiet small-copy-btn');
      congratsIcs = button('📥 신청 시작일 .ics', () => {
        downloadText(scheduleCalendar(calPayload), 'suncheon-marriage-congrats.ics', 'text/calendar;charset=utf-8');
        ctx.toast('순천시 청년부부 결혼축하금 신청 시작일(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn');
    } catch {}
  }

  const toggleBenefitCheck = (cid, checked) => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const set = new Set(latest.benefitChecks || []);
      if (checked) set.add(cid); else set.delete(cid);
      const ok = await ctx.savePrefs({ ...latest, benefitChecks: [...set] });
      if (ok) ctx.render();
      return ok;
    });
  };

  const noteArea = E('textarea', {
    id: 'benefits-private-note',
    rows: '3',
    maxlength: '1000',
    placeholder: '예: 증인 2명 요청 완료 / 순천시청 신청사 오전 방문 예정 / 혼인신고 연도 세제 혜택 비교 메모'
  });
  noteArea.value = prefs.benefitNote || '';

  return E('section', { class: 'prenatal-panel benefits-guide-board', 'aria-labelledby': 'benefits-guide-title' },
    E('article', { class: 'prenatal-card prenatal-hospital-hero' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'MARRIAGE REGISTRATION & SUNCHEON BENEFITS'),
          E('h2', { id: 'benefits-guide-title' }, '🏛️ 혼인신고 · 신혼부부 혜택 원스톱 가이드'),
          E('p', { class: 'small muted' }, '순천시청 신청사(장명로 30) 혼인신고 절차와 순천시·전남·정부 신혼부부 핵심 지원금을 한곳에 정리했어요.')),
        E('div', { class: 'prenatal-quick-actions' },
          button('📋 혼인신고·혜택 요약 복사', () => ctx.copyTextToClipboard(buildBenefitsSummaryText(prefs, timeline), '혼인신고 및 신혼부부 혜택 요약을 복사했습니다.', '혼인신고·혜택 요약 복사'), 'button quiet'),
          button('🖨️ 안내 인쇄 / PDF', () => window.print(), 'button quiet'))),

      E('div', { class: 'benefit-calc-box' },
        E('div', { class: 'benefit-calc-head' },
          E('div', {},
            E('strong', {}, '🗓️ 혼인신고(예정)일 기반 지원금 신청 기한 계산기'),
            E('p', { class: 'small muted' }, '혼인신고 예정일 또는 완료일을 저장하면 순천시 청년부부 결혼축하금(200만 원) 신청 가능 기간과 증여공제 구간이 자동 계산됩니다.')),
          E('div', { class: 'benefit-calc-inputs' },
            E('label', { class: 'small muted', for: regInput.id }, '혼인신고일'),
            regInput,
            button('계산·저장', saveRegDate, 'button'),
            regDate ? button('지우기', () => { regInput.value = ''; saveRegDate(); }, 'button quiet') : null)),
        timeline ? E('div', { class: 'benefit-timeline-results' },
          E('div', { class: 'prenatal-summary-3col' },
            E('div', { class: 'prenatal-mini-card is-accent' },
              E('span', { class: 'prenatal-mini-kicker' }, '순천 청년부부 결혼축하금 (200만 원)'),
              E('strong', {}, `${timeline.congratsStart} ~ ${timeline.congratsEnd}`),
              E('p', { class: 'small muted' }, timeline.congratsStatus === 'open'
                ? `현재 신청 가능 구간입니다 (마감까지 D-${timeline.daysToEnd})`
                : timeline.congratsStatus === 'expired'
                  ? '기본 1년 6개월 구간이 지났습니다. 순천시 청년정책과에 확인하세요.'
                  : `신청 시작까지 D-${timeline.daysToStart} (혼인신고 후 6개월 경과 시점)`)),
            E('div', { class: 'prenatal-mini-card' },
              E('span', { class: 'prenatal-mini-kicker' }, '혼인 증여재산공제 (최대 1억 원 추가)'),
              E('strong', {}, `${timeline.giftStart} ~ ${timeline.giftEnd}`),
              E('p', { class: 'small muted' }, '혼인신고일 전후 2년 이내 직계존속 증여 시 기존 공제 외 추가 적용 (출산 증여공제와 합산 1억 원 한도)')),
            E('div', { class: 'prenatal-mini-card' },
              E('span', { class: 'prenatal-mini-kicker' }, '결혼세액공제 · 2027 전환 체크'),
              E('strong', {}, timeline.regYear <= 2026 ? '2026년 연말정산 세액공제 구간' : '2027년 전환 제도 확인 필요'),
              E('p', { class: 'small muted' }, timeline.taxNote))),
          (congratsGcal || congratsIcs) ? E('div', { class: 'page-actions' }, congratsGcal, congratsIcs) : null) : null)),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'SUNCHEON CITY HALL · NEW BUILDING (2026-10)'),
          E('h3', {}, `📍 ${SUNCHEON_CITY_HALL.name} & 혼인·전입신고 절차`),
          E('p', { class: 'small muted' }, '순천시 종합민원실은 2026년 10월 신청사(장명로 30)로 이전을 완료했으며, 혼인신고 기념 포토존도 함께 운영합니다.'))),
      E('div', { class: 'prenatal-hc-meta' },
        E('span', { class: 'spec-chip' }, `📍 ${SUNCHEON_CITY_HALL.address}`),
        E('span', { class: 'spec-chip direct' }, `📞 민원실 ${SUNCHEON_CITY_HALL.phone} · 대표 ${SUNCHEON_CITY_HALL.altPhone}`)),
      E('div', { class: 'prenatal-docs-grid' },
        E('div', { class: 'prenatal-doc-box' },
          E('h4', {}, '💍 혼인신고 필수 준비물 & 절차'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '신고 장소: '), '전국 시·군·구청 및 읍·면 행정복지센터 (순천시청 신청사 종합민원실 등, 동 주민센터 제외)'),
            E('li', {}, E('strong', {}, '혼인신고서: '), '민원실 비치 또는 정부24 출력 · ', E('strong', {}, '성년 증인 2명 성명·주민번호·주소·서명(또는 도장) 필수'), ' (증인 동행 불필요)'),
            E('li', {}, E('strong', {}, '신분증: '), '부부 동반 방문 시 각자 신분증 · 1명만 방문 시 미방문 배우자 신분증과 도장 지참'),
            E('li', {}, E('strong', {}, '등록기준지: '), '가족관계증명서상 본인·부모 등록기준지 미리 확인해 두면 작성이 빠릅니다.'))),
        E('div', { class: 'prenatal-doc-box' },
          E('h4', {}, '🏡 전입신고 · 확정일자 챙기기'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '전입신고 기한: '), '신혼집 입주·이사 후 ', E('strong', {}, '14일 이내'), ' 정부24 온라인 또는 신거주지 읍·면·동 행정복지센터 신고'),
            E('li', {}, E('strong', {}, '확정일자·임대차신고: '), '전·월세 계약 시 주택임대차계약 신고(30일 이내)를 하면 확정일자가 자동 부여됩니다.'),
            E('li', {}, E('strong', {}, '거주 요건 주의: '), '순천시 청년부부 결혼축하금(200만 원)은 부부 모두 전남(순천) 6개월 이상 계속 거주 요건이 있으므로 전입 시기를 함께 확인하세요.')))),
      E('div', { class: 'page-actions prenatal-link-row' },
        button('📋 순천시청 주소 복사', () => ctx.copyVenueAddress(SUNCHEON_CITY_HALL.address, '순천시청 신청사 주소'), 'button quiet'),
        externalLink('🗺️ 순천시청 네이버 지도 ↗', SUNCHEON_CITY_HALL.naverMapUrl, 'button quiet'),
        externalLink('🌐 정부24 혼인신고 안내 ↗', SUNCHEON_CITY_HALL.gov24MarriageUrl, 'button quiet'),
        externalLink('🌐 정부24 전입신고 ↗', SUNCHEON_CITY_HALL.gov24MoveUrl, 'button quiet'))),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'SUNCHEON · JEONNAM · NATIONAL BENEFITS'),
          E('h3', {}, '💰 놓치면 아까운 순천시 · 정부 신혼부부 핵심 혜택 4종'))),
      E('div', { class: 'prenatal-callout-grid' },
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'spec-chip direct' }, '부부당 200만 원 일시 지급'),
          E('h4', {}, '① 순천시 청년부부 결혼축하금 (2026 기준)'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '대상: '), '혼인신고일 기준 남녀 모두 만 49세 이하 · 혼인신고 이후 신청 직전까지 부부 모두 전남(순천) 6개월 이상 계속 거주 · 신청자(1명 이상) 순천시 주소 유지'),
            E('li', {}, E('strong', {}, '신청 시기: '), '혼인신고일 기준 6개월 경과 후 ~ 1년 6개월 이내 (일부 공고 16개월 표기 사례 있으므로 6개월 직후 여유 있게 신청 권장)'),
            E('li', {}, E('strong', {}, '경로·문의: '), '읍·면·동 행정복지센터 방문 또는 전남 아이톡 온라인 · 청년정책과 ', SUNCHEON_CITY_HALL.youthPhone))),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'spec-chip direct' }, '월 최대 25만 원 · 최장 36개월 (최대 900만 원)'),
          E('h4', {}, '② 순천시 신혼부부·다자녀가정 보금자리 지원'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '대상: '), '무주택 신혼부부(혼인 7년 이내·만 49세 이하·부부합산 연소득 8,500만 원 이하 · 대출실행 3개월 내 결혼예정자 포함)가 순천시 소재 6억 원 이하 주택 구입 시 보금자리론·디딤돌 대출 심사 통과 가구'),
            E('li', {}, E('strong', {}, '신청 시기: '), '매년 하반기 순천시 모집 공고(2026년 9/1~10/16 접수) · 등본상 주소지 읍·면·동 행정복지센터 방문'),
            E('li', {}, E('strong', {}, '문의: '), '순천시 보금자리 지원 담당 ', SUNCHEON_CITY_HALL.housingPhone))),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'spec-chip highlight' }, '신고 연도별 확인 필수 · 최대 100만 원 + 증여 1억'),
          E('h4', {}, '③ 결혼세액공제 & 혼인 증여재산공제'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '결혼세액공제 (2024~2026 혼인신고): '), '1인당 50만 원, 부부 합산 최대 100만 원 세액공제 (생애 1회, 연말정산·종합소득세 반영)'),
            E('li', {}, E('strong', {}, '2027년 혼인신고 주의: '), '2027년 정부 예산안에 부부 100만 원 직접 지급 「혼인지원금(가칭)」 전환안 및 연장안이 국회 심의 중이므로 신고 시점 결정 전 국세청 최종 공고 확인 필수'),
            E('li', {}, E('strong', {}, '혼인 증여재산공제: '), '혼인신고일 전후 2년 이내 직계존속 증여 시 기존 5천만 원 외 최대 1억 원 추가 공제'))),
        E('article', { class: 'prenatal-callout-box' },
          E('span', { class: 'spec-chip' }, '주택도시기금 정책대출'),
          E('h4', {}, '④ 신혼부부 전용 버팀목(전세) · 디딤돌(구입) 대출'),
          E('ul', { class: 'prenatal-bullet-list small' },
            E('li', {}, E('strong', {}, '신혼부부전용 버팀목 전세대출: '), '혼인 7년 이내 또는 3개월 이내 결혼예정 무주택 세대주 대상 저금리 전세자금 지원 (지방 한도·소득 기준은 기금e든든 최신 공고 확인)'),
            E('li', {}, E('strong', {}, '내집마련 디딤돌·보금자리론: '), '신혼부부 주택 구입 시 저금리 정책 모기지 + 순천시 보금자리 이자지원 연계 가능 여부 함께 확인'),
            E('li', {}, E('strong', {}, '신청 경로: '), '기금e든든(nhuf.molit.go.kr) · 한국주택금융공사(hf.go.kr) 또는 수탁은행')))),
      E('div', { class: 'page-actions prenatal-link-row' },
        externalLink('🌐 전남 아이톡 (결혼축하금) ↗', SUNCHEON_CITY_HALL.italkUrl, 'button quiet'),
        externalLink('🌐 순천시청 공고 ↗', SUNCHEON_CITY_HALL.suncheonUrl, 'button quiet'),
        externalLink('🏦 주택도시기금 기금e든든 ↗', SUNCHEON_CITY_HALL.nhufUrl, 'button quiet'),
        externalLink('🏦 한국주택금융공사 ↗', SUNCHEON_CITY_HALL.hfUrl, 'button quiet'))),

    E('section', { class: 'prenatal-card', 'aria-labelledby': 'benefit-checklist-title' },
      E('div', { class: 'lachma-prep-head' },
        E('div', {},
          E('h3', { id: 'benefit-checklist-title' }, `✅ 혼인신고 · 신혼부부 혜택 진행 체크 (${checkDone}/${checkTotal} 완료 · ${pct}%)`),
          E('p', { class: 'small muted' }, '체크 상태와 메모는 이 기기의 개인 설정에만 저장됩니다.')),
        checkDone > 0 ? button('체크 초기화', async () => {
          if (!await ctx.confirmAction({ title: '혜택 진행 체크 초기화', message: '혼인신고·신혼부부 혜택 진행 체크를 모두 초기화할까요?', confirmLabel: '초기화', danger: true })) return;
          ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), benefitChecks: [] }).then(ok => { if (ok) { ctx.render(); ctx.toast('혼인신고·혜택 체크를 초기화했습니다.'); } return ok; }));
        }, 'checklist-note-btn') : null),
      E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` })),
      E('ul', { class: 'ceremony-prep-list prenatal-check-list' }, BENEFIT_CHECK_ITEMS.map(([cid, label]) => {
        const done = checkedSet.has(cid);
        const box = E('input', { type: 'checkbox', id: `benefit-${cid}` });
        box.checked = done;
        box.addEventListener('change', () => toggleBenefitCheck(cid, box.checked));
        return E('li', { class: 'lachma-prep-check-item' + (done ? ' done' : '') },
          E('label', { for: box.id }, box, E('span', { class: 'small' }, label)));
      })),
      E('label', { class: 'field', for: noteArea.id }, '📝 혼인신고·지원금 메모 (기기 전용 · 최대 1,000자)', noteArea),
      E('div', { class: 'page-actions prenatal-note-actions' },
        button('💾 메모 저장', () => {
          const val = noteArea.value.trim();
          if (val.length > 1000) { ctx.toast('메모는 1,000자 이하로 입력해 주세요.', true); return; }
          ctx.queuePreference(async () => {
            const latest = ctx.getPrefs();
            const next = { ...latest };
            if (val) next.benefitNote = val; else delete next.benefitNote;
            const ok = await ctx.savePrefs(next);
            if (ok) { ctx.render(); ctx.toast(val ? '혼인신고·혜택 메모를 저장했습니다.' : '메모를 비웠습니다.'); }
            return ok;
          });
        }, 'button'))),

    E('section', { class: 'prenatal-sources-box' },
      E('strong', { class: 'small' }, '📚 확인 기준일: 2026-11 · 공공 자료 출처'),
      E('ul', { class: 'prenatal-bullet-list small muted' },
        E('li', {}, '순천시청 신청사(장명로 30) 이전·개청(2026-10~11), 2026년 순천시 청년부부 결혼축하금(청년정책과 061-749-3226), 2026년 신혼부부·다자녀가정 보금자리 지원사업 공고(061-749-4207)'),
        E('li', {}, '정부24 혼인·전입신고 안내(gov.kr), 국세청 결혼세액공제·상속세 및 증여세법 제53조의2, 2027년 정부 예산안 보도자료(국회 심의 중), 주택도시기금(nhuf.molit.go.kr)'),
        E('li', {}, '지원 금액·소득 기준·모집 기간과 세법은 연도별·예산안 확정 결과에 따라 변경될 수 있으므로 신청 전 순천시청·국세청·수탁은행 최신 공고를 확인해 주세요.'))));
}
