import { E, button } from './dom.js?v=wedding-features-65';
import { PACKING_CATEGORIES } from './preferences.js?v=wedding-features-65';
import {
  REGION_DEFS,
  REGION_PACKING_SUGGESTIONS,
  HONEYMOON_AGENCY_QUESTIONS,
  tripRegionInfo,
  isBundledPackageTrip,
  isPoolvillaTrip,
  isNoShoppingTrip,
  isSemiPackageTrip,
  buildRegionMatrix,
  recommendHoneymoonTrips,
  calculateLocalSpending,
  stayReview
} from './travel.js?v=wedding-features-65';

const won = value => (value === null || value === undefined ? '미확인' : `${value.toLocaleString('ko-KR')}원`);
const man = value => (value === null || value === undefined ? '미정' : `${Math.round(value / 10000).toLocaleString('ko-KR')}만`);

let matrixExpanded = false;
let selectedMatrixRegion = 'bali';
let recommenderExpanded = false;
let recMaxBudget = 8000000;
let recStyle = 'any';
let recPriority = 'balanced';
let recRegion = 'all';

let localCalcExpanded = false;
const localSpendState = {
  nights: 6,
  dailyFood: 150000,
  activities: 400000,
  spa: 250000,
  transport: 180000,
  tips: 150000,
  shopping: 300000,
  regionKey: 'bali',
  fxRate: ''
};
let lastSyncedTripId = '';

let packingExpanded = false;
let packingPendingOnly = false;

export function isPackingExpanded() { return packingExpanded; }
export function setPackingExpanded(val) { packingExpanded = Boolean(val); }

export function openAgencyQuestionsModal(ctx, item = null) {
  const titleLabel = item ? `${item.title}` : '신혼여행 후보';
  const copyPayload = [
    `[신혼여행 여행사·리조트 상담 질문 체크리스트 · ${titleLabel}]`,
    item ? `• 일정: ${item.startDate || '미정'} ~ ${item.endDate || '미정'} · 목표 예산 ${won(item.budget)}` : '',
    '',
    ...HONEYMOON_AGENCY_QUESTIONS.map((q, i) => `${i + 1}. ${q}`)
  ].filter(Boolean).join('\n');

  const body = E('div', { class: 'editor-form' },
    E('p', { class: 'form-note' }, '여행사 카톡·방문 상담 시 빠뜨리기 쉬운 필수 확인 항목입니다. 복사해서 상담 채팅방에 바로 붙여넣어 질문해 보세요.'),
    E('ol', { class: 'agency-question-list' }, HONEYMOON_AGENCY_QUESTIONS.map(q => E('li', {}, q))),
    E('div', { class: 'form-actions' },
      button('닫기', ctx.closeDialog, 'button quiet'),
      button('📋 상담 질문 7가지 복사', () => ctx.copyTextToClipboard(copyPayload, '여행사 상담 질문 체크리스트를 복사했습니다.', '상담 질문 복사'), 'button')));
  ctx.showDialog('💬 여행사 상담 필수 질문 체크리스트', body);
}

export function renderRegionMatrixSection(ctx, { onSelectRegion, onCompareTrips, onFocusTrip }) {
  if (ctx.isGuestMode()) return null;
  const trips = ctx.getContent()?.honeymoon || [];
  const matrix = buildRegionMatrix(trips);
  if (matrix.length < 2) return null;
  if (!matrix.some(r => r.key === selectedMatrixRegion)) selectedMatrixRegion = matrix[0].key;
  const active = matrix.find(r => r.key === selectedMatrixRegion) || matrix[0];
  const maxRegionBudget = Math.max(...active.items.map(t => t.budget || 0), 1);

  const shortProvider = item => {
    if (!isBundledPackageTrip(item)) return '🧳 자유여행';
    const m = (item.title || '').match(/^\[([^\]]{1,20})\]/);
    if (!m) return '📦 패키지';
    return '📦 ' + m[1].replace(/\s*(허니문|시그니처|세미패키지|패키지|직판|특전|단독|TOP\s*PICK).*$/i, '').trim();
  };

  return E('details', {
    class: 'disclosure honeymoon-matrix-section',
    open: matrixExpanded,
    ontoggle: ev => { if (ev.currentTarget.isConnected) matrixExpanded = ev.currentTarget.open; }
  },
    E('summary', {},
      `🗺️ ${matrix.length}개 지역별 자유여행 vs 여행사 패키지 한눈에 비교 (${trips.length}곳 매트릭스)`),
    E('div', { class: 'matrix-body' },
      E('p', { class: 'small muted' }, '지역 카드를 누르면 해당 지역의 자유여행 가안과 5대 여행사 패키지의 2인 계획예산·특전을 가로 막대로 바로 비교할 수 있습니다.'),
      E('div', { class: 'region-matrix-cards', role: 'group', 'aria-label': '신혼여행 5개 지역 요약' },
        matrix.map(reg => {
          const isCurrent = reg.key === active.key;
          const diffText = reg.fitVsPkgDiff === null
            ? '구성 비교'
            : reg.fitVsPkgDiff > 0
              ? `자유가 ${man(reg.fitVsPkgDiff)}원 저렴`
              : reg.fitVsPkgDiff < 0
                ? `패키지가 ${man(-reg.fitVsPkgDiff)}원 저렴`
                : '자유·패키지 동일';
          return E('button', {
            type: 'button',
            class: 'region-matrix-card' + (isCurrent ? ' is-selected' : ''),
            'data-matrix-region': reg.key,
            'aria-pressed': String(isCurrent),
            onclick: () => { selectedMatrixRegion = reg.key; matrixExpanded = true; ctx.render(); }
          },
            E('div', { class: 'region-matrix-card-head' },
              E('strong', {}, `${reg.flag} ${reg.label}`),
              E('span', { class: 'badge' }, `${reg.count}곳`)),
            E('strong', { class: 'region-matrix-price' }, `${man(reg.minBudget)} ~ ${man(reg.maxBudget)}원`),
            E('span', { class: 'small muted' }, diffText),
            E('div', { class: 'region-matrix-tags' },
              reg.dryCount > 0 ? E('span', { class: 'spec-chip direct' }, '☀️ 6월 건기') : null,
              reg.poolvillaCount > 0 ? E('span', { class: 'spec-chip' }, `🏡 풀빌라 ${reg.poolvillaCount}`) : null,
              reg.noshoppingCount > 0 ? E('span', { class: 'spec-chip' }, `🚫 노쇼핑 ${reg.noshoppingCount}`) : null));
        })),
      E('div', { class: 'region-matrix-detail' },
        E('div', { class: 'region-matrix-detail-head' },
          E('div', {},
            E('strong', {}, `${active.flag} ${active.label} ${active.count}곳 예산 · 조건 비교`),
            E('p', { class: 'small muted' }, `평균 ${man(active.avgBudget)}원 · 자유여행 ${active.fitTrip ? `${man(active.fitTrip.budget)}원` : '없음'} · 패키지 최저 ${man(active.pkgMinBudget)}원`)),
          E('div', { class: 'page-actions' },
            button(`${active.label}만 아래 목록에 보기`, () => onSelectRegion(active.key), 'button quiet small-copy-btn'),
            button(`대표 ${Math.min(3, active.items.length)}곳 비교함 담기`, () => {
              const picks = [];
              if (active.fitTrip) picks.push(active.fitTrip.id);
              for (const p of active.pkgTrips) {
                if (picks.length >= 3) break;
                if (!picks.includes(p.id)) picks.push(p.id);
              }
              onCompareTrips(picks.slice(0, 3), `${active.label} 자유·패키지 대표 ${picks.length}곳을 비교함에 담았습니다.`);
            }, 'button small-copy-btn'))),
        E('ul', { class: 'region-bar-list' }, active.items.map(item => {
          const pct = item.budget ? Math.max(16, Math.round((item.budget / maxRegionBudget) * 100)) : 0;
          const isFit = !isBundledPackageTrip(item);
          return E('li', { class: 'region-bar-row' },
            E('div', { class: 'region-bar-meta' },
              button(shortProvider(item), () => onFocusTrip(item.id), 'text-button small'),
              E('span', { class: 'region-bar-tags' },
                isPoolvillaTrip(item) ? E('span', { class: 'spec-chip' }, '풀빌라') : null,
                isNoShoppingTrip(item) ? E('span', { class: 'spec-chip' }, '노쇼핑') : null,
                isSemiPackageTrip(item) ? E('span', { class: 'spec-chip' }, '반자유') : null),
              E('strong', { class: 'region-bar-val' }, `${man(item.budget)}원`)),
            E('div', { class: 'region-bar-track', 'aria-hidden': 'true' },
              E('span', { class: 'region-bar-fill' + (isFit ? ' is-fit' : ''), style: `width:${pct}%` })));
        })))));
}

export function renderTripRecommenderSection(ctx, { onFocusTrip, onCompareTrips }) {
  if (ctx.isGuestMode()) return null;
  const trips = ctx.getContent()?.honeymoon || [];
  if (trips.length < 3) return null;

  const top3 = recommendHoneymoonTrips(trips, {
    maxBudget: recMaxBudget,
    style: recStyle,
    priority: recPriority,
    region: recRegion
  });

  const makeSelect = (id, label, options, current, onChange) => {
    const sel = E('select', { id, 'aria-label': label }, options.map(([v, txt]) => E('option', { value: String(v) }, txt)));
    sel.value = String(current);
    sel.addEventListener('change', () => { recommenderExpanded = true; onChange(sel.value); ctx.render(); });
    return E('label', { class: 'rec-field', for: id }, E('span', { class: 'small muted' }, label), sel);
  };

  return E('details', {
    class: 'disclosure honeymoon-recommender',
    open: recommenderExpanded,
    ontoggle: ev => { if (ev.currentTarget.isConnected) recommenderExpanded = ev.currentTarget.open; }
  },
    E('summary', {}, '🧭 30초 맞춤 신혼여행 추천기 · 우리 조건 TOP 3 찾기'),
    E('div', { class: 'recommender-body' },
      E('div', { class: 'recommender-controls' },
        makeSelect('rec-budget', '2인 예산 상한', [[6000000, '600만 원 이하'], [8000000, '800만 원 이하'], [10000000, '1,000만 원 이하']], recMaxBudget, v => { recMaxBudget = Number(v); }),
        makeSelect('rec-style', '선호 여행 형태', [['any', '상관없음'], ['fit', '🧳 자유여행'], ['semi', '✨ 반자유·세미패키지'], ['package', '📦 패키지 전체']], recStyle, v => { recStyle = v; }),
        makeSelect('rec-priority', '가장 중요한 조건', [['balanced', '⚖️ 균형 추천'], ['poolvilla', '🏡 풀빌라 우선'], ['noshopping', '🚫 노쇼핑·노옵션'], ['dry', '☀️ 6월 건기 우선'], ['value', '💸 가성비 우선']], recPriority, v => { recPriority = v; }),
        makeSelect('rec-region', '희망 지역', [['all', '🌏 전체 5개 지역'], ...REGION_DEFS.slice(0, 5).map(r => [r.key, `${r.flag} ${r.label}`])], recRegion, v => { recRegion = v; })),
      top3.length ? E('div', { class: 'recommender-results' },
        E('div', { class: 'recommender-results-head' },
          E('strong', { class: 'small' }, `✨ 조건에 가장 잘 맞는 추천 후보 TOP ${top3.length}`),
          button(`TOP ${top3.length} 한 번에 비교함 담기`, () => {
            onCompareTrips(top3.map(r => r.trip.id), `추천 TOP ${top3.length} 후보를 비교함에 담았습니다.`);
          }, 'button small-copy-btn')),
        E('div', { class: 'recommender-grid' }, top3.map((entry, idx) => E('article', { class: 'recommender-card' },
          E('div', { class: 'recommender-card-head' },
            E('span', { class: 'badge' }, `추천 #${idx + 1}`),
            E('strong', { class: 'recommender-price' }, won(entry.trip.budget))),
          E('strong', { class: 'recommender-title' }, entry.trip.title),
          E('div', { class: 'region-matrix-tags' }, entry.reasons.map(r => E('span', { class: 'spec-chip direct' }, `✓ ${r}`))),
          E('div', { class: 'recommender-card-actions' },
            button('카드 보기 →', () => onFocusTrip(entry.trip.id), 'button quiet small-copy-btn')))))) : null));
}

export function renderLocalSpendingSimulator(ctx, selectedTrip = null) {
  if (ctx.isGuestMode()) return null;
  if (selectedTrip && selectedTrip.id !== lastSyncedTripId) {
    lastSyncedTripId = selectedTrip.id;
    const nights = stayReview(selectedTrip).nights;
    if (nights >= 1 && nights <= 30) localSpendState.nights = nights;
    localSpendState.regionKey = tripRegionInfo(selectedTrip).key;
  }
  const regionDef = REGION_DEFS.find(r => r.key === localSpendState.regionKey) || REGION_DEFS[0];
  const calc = calculateLocalSpending({ ...localSpendState, currencyUnit: regionDef.currencyUnit });
  const poolBudget = selectedTrip?.plan?.costs
    ? (selectedTrip.plan.costs.other || 0) + (selectedTrip.plan.costs.reserve || 0)
    : null;
  const poolDiff = poolBudget !== null ? poolBudget - calc.totalKrw : null;

  const numField = (id, label, key, step = 10000) => {
    const input = E('input', { type: 'number', id, min: '0', max: '50000000', step: String(step), value: String(localSpendState[key]) });
    input.addEventListener('change', () => {
      localSpendState[key] = Math.max(0, Math.round(Number(input.value) || 0));
      localCalcExpanded = true;
      ctx.render();
    });
    return E('label', { class: 'local-calc-field', for: id }, E('span', { class: 'small muted' }, label), input);
  };

  const regionSel = E('select', { id: 'local-calc-region', 'aria-label': '현지 통화 지역 선택' },
    REGION_DEFS.slice(0, 5).map(r => E('option', { value: r.key }, `${r.flag} ${r.label} (${r.currencyCode})`)));
  regionSel.value = regionDef.key;
  regionSel.addEventListener('change', () => {
    localSpendState.regionKey = regionSel.value;
    localSpendState.fxRate = '';
    localCalcExpanded = true;
    ctx.render();
  });

  const fxInput = E('input', {
    type: 'number',
    id: 'local-calc-fx',
    min: '0',
    step: '0.1',
    placeholder: regionDef.rateHint,
    value: localSpendState.fxRate
  });
  fxInput.addEventListener('change', () => {
    localSpendState.fxRate = fxInput.value.trim();
    localCalcExpanded = true;
    ctx.render();
  });

  const copyLocalPlan = () => {
    const lines = [
      `[2인 신혼여행 현지 경비 계획 · ${regionDef.label} ${calc.stayNights}박]`,
      `• 식비 (${calc.stayNights}박 × ${won(localSpendState.dailyFood)}): ${won(calc.foodTotal)}`,
      `• 투어·액티비티: ${won(localSpendState.activities)}`,
      `• 스파·마사지: ${won(localSpendState.spa)}`,
      `• 현지 교통·픽업: ${won(localSpendState.transport)}`,
      `• 팁·비자·부담금: ${won(localSpendState.tips)}`,
      `• 쇼핑·기념품: ${won(localSpendState.shopping)}`,
      `▶ 합계 (2인): ${won(calc.totalKrw)} (1일 평균 ${won(calc.perDayKrw)} · 1인당 ${won(calc.perPersonKrw)})`,
      calc.foreignTotal !== null ? `▶ 입력 환율 기준 환산: 약 ${calc.foreignTotal.toLocaleString('ko-KR')} ${regionDef.currencyCode}` : ''
    ].filter(Boolean);
    ctx.copyTextToClipboard(lines.join('\n'), '2인 현지 경비 요약을 복사했습니다.', '현지 경비 요약 복사');
  };

  return E('details', {
    class: 'disclosure honeymoon-local-calc',
    open: localCalcExpanded,
    ontoggle: ev => { if (ev.currentTarget.isConnected) localCalcExpanded = ev.currentTarget.open; }
  },
    E('summary', {}, `💱 2인 현지 경비 쪼개기 · 직접 환율 계산기 (현재 합계 ${won(calc.totalKrw)})`),
    E('div', { class: 'local-calc-body' },
      E('p', { class: 'small muted' }, '항공·숙박을 제외한 2인 현지 식비·마사지·투어·팁·쇼핑 경비를 가볍게 시뮬레이션합니다. 환율은 최신 시세를 직접 입력해 환산해 보세요.'),
      E('div', { class: 'local-calc-grid' },
        numField('lc-nights', '현지 체류 박 수', 'nights', 1),
        numField('lc-food', '1일 식비 · 카페 (2인, 원)', 'dailyFood', 10000),
        numField('lc-act', '투어 · 액티비티 (원)', 'activities', 50000),
        numField('lc-spa', '스파 · 마사지 (원)', 'spa', 50000),
        numField('lc-trans', '현지 교통 · 택시 (원)', 'transport', 10000),
        numField('lc-tips', '팁 · 비자 · 부담금 (원)', 'tips', 10000),
        numField('lc-shop', '쇼핑 · 기념품 (원)', 'shopping', 50000),
        E('label', { class: 'local-calc-field', for: 'local-calc-region' }, E('span', { class: 'small muted' }, '통화 기준 지역'), regionSel),
        E('label', { class: 'local-calc-field', for: 'local-calc-fx' }, E('span', { class: 'small muted' }, `직접 환율 (${regionDef.currencyUnit} ${regionDef.currencyCode}당 원)`), fxInput)),
      E('div', { class: 'local-calc-summary' },
        E('div', { class: 'local-calc-stat' }, E('span', { class: 'small muted' }, `2인 현지 경비 (${calc.stayNights}박)`), E('strong', {}, won(calc.totalKrw))),
        E('div', { class: 'local-calc-stat' }, E('span', { class: 'small muted' }, '1일 평균 / 1인당'), E('strong', {}, `${man(calc.perDayKrw)}원 / ${man(calc.perPersonKrw)}원`)),
        calc.foreignTotal !== null
          ? E('div', { class: 'local-calc-stat' }, E('span', { class: 'small muted' }, `입력 환율 환산 (${regionDef.currencyCode})`), E('strong', {}, `${calc.foreignTotal.toLocaleString('ko-KR')} ${regionDef.currencyCode}`))
          : (poolDiff !== null
            ? E('div', { class: 'local-calc-stat' }, E('span', { class: 'small muted' }, '선택 여행지 기타+예비비 대비'), E('strong', {}, poolDiff >= 0 ? `여유 ${won(poolDiff)}` : `초과 ${won(-poolDiff)}`))
            : E('div', { class: 'local-calc-stat' }, E('span', { class: 'small muted' }, '현지 통화 환산'), E('strong', {}, '환율 입력 시 자동 계산')))),
      E('div', { class: 'page-actions' },
        button('📋 현지 경비 요약 복사', copyLocalPlan, 'button quiet small-copy-btn'))));
}

const HONEYMOON_PACKING_LIST = [
  ['📄 필수 서류·결제', [
    ['pack-passport', '여권 (유효기간 6개월 이상) · 비자·전자입국신고서 확인'],
    ['pack-voucher', '항공권 이티켓 · 호텔·리조트 바우처 · 청첩장 사본 (허니문 특전용)'],
    ['pack-cards', '해외결제 카드 (트래블월렛/트래블로그 등) · 현지 비상 현금·달러'],
    ['pack-insurance', '해외여행자보험 가입 증서 · 국제운전면허증 (렌터카 이용 시)']
  ]],
  ['🔌 전자기기·통신', [
    ['pack-roaming', '유심(USIM) · 이심(eSIM) · 통신사 로밍 설정'],
    ['pack-adapter', '해외용 멀티어댑터 · 멀티탭 · 보조배터리 (기내 반입)'],
    ['pack-camera', '카메라 · 삼각대/셀카봉 · 방수팩 · 여분 충전 케이블'],
    ['pack-offline', '오프라인 지도·번역 앱 다운로드']
  ]],
  ['🏖️ 의류·해변 용품', [
    ['pack-swim', '수영복 · 래쉬가드 · 아쿠아슈즈 · 비치타월'],
    ['pack-couple', '커플 스냅 촬영용 의상 · 디너 드레스코드 의상 · 편한 신발'],
    ['pack-sun', '선글라스 · 챙 넓은 모자 · 우양산 · 얇은 겉옷 (기내·실내 냉방용)'],
    ['pack-laundry', '지퍼백 · 세탁망 · 휴대용 세제 · 접이식 보조가방']
  ]],
  ['💊 상비약·세면·기타', [
    ['pack-meds', '상비약 (진통제·소화제·지사제·멀미약·밴드·모기기피제)'],
    ['pack-sunblock', '자외선 차단제 (선크림·알로에 수딩젤) · 개인 기초화장품'],
    ['pack-shower', '여행용 샤워기 필터 · 칫솔·치약 · 미니 헤어용품'],
    ['pack-snack', '컵라면·튜브 고추장·김 등 비상 간식 (입국 반입 규정 확인)']
  ]]
];

function allPackingCategories(prefs) {
  const custom = prefs.customPackingList || [];
  return HONEYMOON_PACKING_LIST.map(([cat, items]) => [cat, [
    ...items.map(([id, label]) => [id, label, false]),
    ...custom.filter(c => c.category === cat).map(c => [c.id, c.title, true])
  ]]);
}

function openCustomPackingEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing && existing.id);
  const form = E('form', { class: 'editor-form' });
  const catSelect = E('select', { id: 'custom-pack-cat' }, PACKING_CATEGORIES.map(c => E('option', { value: c }, c)));
  if (isEdit && PACKING_CATEGORIES.includes(existing.category)) catSelect.value = existing.category;
  const titleInput = E('input', { type: 'text', maxlength: '160', id: 'custom-pack-title', required: 'true', placeholder: '예: 다이슨 에어랩 (변압기 확인) / 커플 필름카메라' });
  if (isEdit) titleInput.value = existing.title || '';
  form.append(
    E('p', { class: 'form-note' }, '추가·수정한 준비물은 이 기기의 개인 설정에만 저장됩니다.'),
    E('label', { class: 'field', for: catSelect.id }, '준비물 분류', catSelect),
    E('label', { class: 'field', for: titleInput.id }, '준비물 이름', titleInput),
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, isEdit ? '준비물 저장' : '준비물 추가'))
  );
  const submit = form.querySelector('[type="submit"]');
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const title = titleInput.value.trim();
    if (!title) return;
    const curList = [...(ctx.getPrefs().customPackingList || [])];
    if (!isEdit && curList.length >= 80) { ctx.toast('사용자 정의 준비물은 80개까지 추가할 수 있습니다.', true); return; }
    const id = isEdit ? existing.id : 'cpack-' + crypto.randomUUID().slice(0, 8);
    const list = isEdit ? curList.map(c => (c.id === id ? { id, category: catSelect.value, title } : c)) : [...curList, { id, category: catSelect.value, title }];
    saving = true;
    submit.disabled = true;
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), customPackingList: list }));
      if (saved) {
        packingExpanded = true;
        ctx.closeDialog();
        ctx.render();
        ctx.toast(isEdit ? '신혼여행 준비물 항목을 수정했습니다.' : '신혼여행 준비물 항목을 추가했습니다.');
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  const snapshot = () => JSON.stringify([catSelect.value, titleInput.value]), initial = snapshot();
  if (ctx.showDialog(isEdit ? '신혼여행 우리만의 준비물 수정' : '신혼여행 우리만의 준비물 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

export function renderHoneymoonPackingList(ctx, { selectedTrip = null, activeRegion = 'all' } = {}) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const checked = new Set(prefs.packingList || []);
  const cats = allPackingCategories(prefs);
  const allItems = cats.flatMap(([, items]) => items);
  const doneCount = allItems.filter(([id]) => checked.has(id)).length;
  const totalCount = allItems.length;
  const remainingCount = totalCount - doneCount;
  const pct = Math.round((doneCount / totalCount) * 100);
  const uncheckedGroups = cats
    .map(([cat, items]) => [cat, items.filter(([id]) => !checked.has(id))])
    .filter(([, items]) => items.length > 0);
  const displayCats = packingPendingOnly ? uncheckedGroups : cats;

  const targetRegionKey = selectedTrip ? tripRegionInfo(selectedTrip).key : (activeRegion !== 'all' ? activeRegion : 'bali');
  const regionPack = REGION_PACKING_SUGGESTIONS[targetRegionKey] || null;
  const existingTitles = new Set((prefs.customPackingList || []).map(c => c.title.trim()));
  const missingRegionItems = regionPack ? regionPack.items.filter(it => !existingTitles.has(it.title.trim())) : [];

  const addRegionPackingPreset = () => {
    if (!missingRegionItems.length) return;
    ctx.queuePreference(async () => {
      const curList = [...(ctx.getPrefs().customPackingList || [])];
      const existing = new Set(curList.map(c => c.title.trim()));
      const additions = [];
      for (const item of missingRegionItems) {
        if (existing.has(item.title.trim())) continue;
        if (curList.length + additions.length >= 80) break;
        additions.push({ id: 'cpack-' + crypto.randomUUID().slice(0, 8), category: item.category, title: item.title });
      }
      if (!additions.length) { ctx.toast('이미 모든 지역 맞춤 준비물이 추가되어 있습니다.'); return true; }
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), customPackingList: [...curList, ...additions] });
      if (saved) {
        packingExpanded = true;
        ctx.render();
        ctx.toast(`${regionPack.label} ${additions.length}개를 체크리스트에 추가했습니다.`);
      }
      return saved;
    });
  };

  const copyRemainingPacking = () => {
    const lines = [`[신혼여행 남은 준비물 · ${remainingCount}개 미챙김]`, ''];
    for (const [cat, items] of uncheckedGroups) {
      lines.push(`■ ${cat} (${items.length})`);
      for (const [, label] of items) lines.push(`- ${label}`);
      lines.push('');
    }
    ctx.copyTextToClipboard(lines.join('\n').trim(), `남은 신혼여행 준비물 ${remainingCount}개를 복사했습니다.`, '신혼여행 남은 준비물 복사');
  };

  const pendingBox = E('input', { type: 'checkbox', id: 'packing-pending-only' });
  pendingBox.checked = packingPendingOnly;
  pendingBox.addEventListener('change', () => {
    packingPendingOnly = pendingBox.checked;
    packingExpanded = true;
    ctx.render();
  });

  const toggleItem = (id, inputNode) => {
    const next = new Set(ctx.getPrefs().packingList || []);
    if (inputNode.checked) next.add(id);
    else next.delete(id);
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), packingList: [...next] });
      if (saved) ctx.render();
      else inputNode.checked = checked.has(id);
      return saved;
    });
  };

  const details = E('details', { class: 'disclosure honeymoon-packing', 'data-view-key': 'honeymoon-packing' },
    E('summary', {}, `🧳 신혼여행 출국·짐 싸기 체크리스트 (${doneCount}/${totalCount} 완료 · ${pct}%)`),
    E('div', { class: 'packing-body' },
      E('div', { class: 'packing-toolbar' },
        E('p', { class: 'small muted' }, '출국 전 꼭 챙겨야 할 필수 서류·로밍·스냅 의상·상비약 체크리스트입니다. 체크 상태와 직접 추가한 준비물은 이 기기에 자동 저장됩니다.'),
        E('div', { class: 'page-actions' },
          button('+ 우리만의 준비물 추가', () => openCustomPackingEditor(ctx), 'button quiet'),
          button('🖨️ 인쇄 / PDF 저장', () => window.print(), 'button quiet'),
          doneCount > 0 ? button('짐 체크 초기화', async () => {
            if (!await ctx.confirmAction({ title: '짐 체크 초기화', message: '신혼여행 짐 싸기 체크 기록을 모두 초기화할까요?', confirmLabel: '초기화', danger: true })) return;
            ctx.queuePreference(async () => { const saved = await ctx.savePrefs({ ...ctx.getPrefs(), packingList: [] }); if (saved) { ctx.render(); ctx.toast('신혼여행 짐 체크를 초기화했습니다.'); } return saved; });
          }, 'button quiet') : null)),
      regionPack && missingRegionItems.length > 0 ? E('div', { class: 'region-packing-banner' },
        E('span', { class: 'small' }, `${regionPack.label} ${missingRegionItems.length}건이 준비되어 있어요.${selectedTrip ? ' (최종 선택 여행지 기준)' : ''}`),
        button(`+ ${regionPack.label.replace(/^\S+\s*/, '')} ${missingRegionItems.length}건 한 번에 추가`, addRegionPackingPreset, 'button quiet small-copy-btn')) : null,
      E('div', { class: 'packing-filter-row' },
        E('label', { class: 'check-label', for: 'packing-pending-only' }, pendingBox, `미챙긴 항목만 보기 (${remainingCount}개 남음)`),
        remainingCount > 0
          ? button('📋 남은 짐 카톡 복사', copyRemainingPacking, 'button quiet small-copy-btn')
          : E('span', { class: 'badge' }, '🎉 모든 준비물 완료!')),
      displayCats.length
        ? E('div', { class: 'checklist-grid' }, displayCats.map(([cat, items]) => E('article', { class: 'checklist-stage-card' },
          E('div', { class: 'checklist-stage-head' },
            E('h3', {}, cat),
            E('span', { class: 'badge' }, packingPendingOnly ? `${items.length}개 남음` : `${items.filter(([id]) => checked.has(id)).length}/${items.length}`)),
          E('ul', { class: 'checklist-items' }, items.map(([id, label, isCustom]) => {
            const box = E('input', { type: 'checkbox', id: `pack-${id}` });
            box.checked = checked.has(id);
            box.addEventListener('change', () => toggleItem(id, box));
            return E('li', { class: 'checklist-item' + (box.checked ? ' done' : '') },
              E('div', { class: 'checklist-item-top' },
                E('label', { for: box.id }, box, E('span', {}, label)),
                isCustom ? E('div', { class: 'checklist-item-actions' },
                  button('수정', () => openCustomPackingEditor(ctx, { id, category: cat, title: label }), 'checklist-note-btn'),
                  button('삭제', () => {
                    ctx.queuePreference(async () => {
                      const latest = ctx.getPrefs();
                      const curList = latest.customPackingList || [];
                      const removedIndex = curList.findIndex(c => c.id === id);
                      if (removedIndex < 0) return true;
                      const snapshot = structuredClone(curList[removedIndex]);
                      const wasChecked = (latest.packingList || []).includes(id);
                      const nextList = curList.filter(c => c.id !== id);
                      const nextChecked = (latest.packingList || []).filter(k => k !== id);
                      const saved = await ctx.savePrefs({ ...latest, customPackingList: nextList, packingList: nextChecked });
                      if (saved) {
                        ctx.render();
                        ctx.toast(`‘${label}’ 준비물을 삭제했습니다.`, {
                          undoLabel: '되돌리기',
                          onUndo: () => ctx.queuePreference(async () => {
                            const cur = ctx.getPrefs();
                            const restoredList = [...(cur.customPackingList || [])];
                            if (restoredList.some(c => c.id === snapshot.id)) return true;
                            restoredList.splice(Math.min(removedIndex, restoredList.length), 0, snapshot);
                            const restoredChecked = wasChecked ? [...new Set([...(cur.packingList || []), snapshot.id])] : (cur.packingList || []);
                            const restored = await ctx.savePrefs({ ...cur, customPackingList: restoredList, packingList: restoredChecked });
                            if (restored) { ctx.render(); ctx.toast(`‘${snapshot.title}’ 준비물을 복구했습니다.`); }
                            return restored;
                          })
                        });
                      }
                      return saved;
                    });
                  }, 'checklist-note-btn danger-text')) : null));
          })))))
        : E('p', { class: 'small muted' }, '🎉 모든 신혼여행 출국·짐 싸기 준비물을 챙겼습니다! ‘미챙긴 항목만 보기’를 해제하면 전체 목록을 확인할 수 있어요.')));
  if (packingExpanded) details.open = true;
  details.addEventListener('toggle', () => { packingExpanded = details.open; });
  return details;
}
