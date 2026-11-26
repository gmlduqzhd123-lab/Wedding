import { $, E, button, linkButton, downloadText, actionOverflowMenu } from './dom.js?v=wedding-features-67';
import { formatDate, weddingDday } from './content.js?v=wedding-features-67';
import { CHECKLIST_STAGES } from './preferences.js?v=wedding-features-67';
import { dateSpan, tripFlightBadge } from './travel.js?v=wedding-features-67';
import { multiScheduleCalendar } from './calendar.js?v=wedding-features-67';
import {
  weddingBudgetSummary,
  guestListSummary,
  giftLedgerSummary,
  prenatalDeadlineSummary,
  homeItemsSummary,
  CEREMONY_PREP_ITEMS,
  PRENATAL_CHECK_ITEMS,
  WEDDING_BUDGET_CATEGORIES,
  activeVendorSchedules,
  collectMasterTimeline,
  weddingPhaseInfo
} from './planning.js?v=wedding-features-67';

const won = value => (value === null ? '미확인' : `${value.toLocaleString('ko-KR')}원`);
let checklistIncompleteOnly = false;
let checklistExpandAll = false;
let timelineShowAll = false;
let timelineExpanded = false;

export function renderHomeSectionNav(ctx) {
  if (ctx.isGuestMode()) return null;
  const jump = id => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return E('nav', { class: 'home-section-nav', 'aria-label': '홈 섹션 빠른 이동' },
    button('📍 지금 할 일', () => jump('home-phase-focus'), 'button quiet home-jump-chip'),
    button('📊 현황 요약', () => jump('home-dashboard-title'), 'button quiet home-jump-chip'),
    button('🗓️ 일정', () => jump('home-timeline-title'), 'button quiet home-jump-chip'),
    button('🗂️ 전체 메뉴', () => jump('home-menu-title'), 'button quiet home-jump-chip'),
    button('✅ 체크리스트', () => jump('home-checklist-title'), 'button quiet home-jump-chip'));
}

const WEDDING_CHECKLIST = [
  ['D-180 이전', '웨딩홀 · 스드메 · 신혼여행 큰 틀 잡기', [
    ['d180-hall', '예식장(순천아모르웨딩컨벤션) 홀·식대·보증인원 조건 정리'],
    ['d180-sdm', '스튜디오 최종 선택 (라크마 · 2027-02-03 수 12:00 촬영 확정) 및 드레스·메이크업 샵 결정'],
    ['d180-trip', '신혼여행지 최종 선택 및 항공·숙박 일정 확보'],
    ['d180-budget', '두 사람의 전체 결혼 예산 배분표 작성']
  ]],
  ['D-120 ~ D-90', '웨딩 촬영 · 예복 · 예물 · 본식스냅', [
    ['d120-shoot', '라크마 스튜디오 웨딩촬영 (2027-02-03 수 12:00 · 루나메이크업→중앙로 117 이동) 헬퍼비 현금 25만 원·시안·누브라·긴 양말·간식 준비'],
    ['d120-rings', '웨딩밴드(예물)·예복·한복 맞춤 및 대여 결정'],
    ['d120-snap', '본식 스냅·DVD·아이폰 스냅 업체 예약'],
    ['d120-passport', '여권 만료일(6개월 이상) 확인 및 항공권 영문명 점검']
  ]],
  ['D-60 ~ D-30', '청첩장 · 하객 명단 · 본식 식순', [
    ['d60-card', '종이·모바일 청첩장 문구 확정 및 모임 일정 잡기'],
    ['d60-mc', '순천아모르 12단계 식순 · 사회자(김희엽 친구) 대본 · 혼인서약서 · 성혼선언문·축사(교장선생님) · 축가(아카펠라) 확정'],
    ['d60-bouquet', '본식 드레스 셀렉 및 부케·부토니에·코사지 지정'],
    ['d60-living', '신혼집 가전·가구 배치 및 입주·이사 일정 조율']
  ]],
  ['D-14 ~ D-Day', '최종 리허설 · 본식 당일 체크', [
    ['d14-meal', '하객 최종 예상 인원 및 식권·답례품 수량 확정'],
    ['d14-bag', '혼주 간식·비상약·헬퍼 및 업체 잔금 봉투 준비'],
    ['d14-pack', '신혼여행 짐 싸기·환전·로밍·바우처 출력'],
    ['d14-ring', '본식 반지 · 혼인서약서/성혼선언문 인쇄본 · 연회홀 층수 · 식전영상/BGM 최종 확인']
  ]]
];

function allChecklistStages(prefs) {
  const customs = prefs.customChecklist || [];
  return WEDDING_CHECKLIST.map(([stage, subtitle, items]) => [
    stage,
    subtitle,
    [
      ...items.map(([id, label]) => ({ id, label, custom: false })),
      ...customs.filter(c => c.stage === stage).map(c => ({ id: c.id, label: c.title, custom: true }))
    ]
  ]);
}

function openCustomChecklistEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const prefs = ctx.getPrefs();
  const isEdit = Boolean(existing && existing.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '추가·수정한 할 일은 이 기기의 개인 설정에만 저장되며 방문자용 청첩장에는 노출되지 않습니다.'));
  const stageSelect = E('select', { id: 'custom-chk-stage' }, CHECKLIST_STAGES.map(s => E('option', { value: s }, s)));
  if (isEdit && CHECKLIST_STAGES.includes(existing.stage)) stageSelect.value = existing.stage;
  const titleInput = E('input', { type: 'text', id: 'custom-chk-title', maxlength: '160', required: true, placeholder: '예: 양가 혼주 메이크업 예약 확인' });
  if (isEdit) titleInput.value = existing.title || '';
  const noteInput = E('input', { type: 'text', id: 'custom-chk-note', maxlength: '300', placeholder: '예: 12월 초 예약금 입금 예정 (선택)' });
  if (isEdit) noteInput.value = prefs.checklistNotes?.[existing.id] || '';
  form.append(
    E('label', { class: 'field', for: stageSelect.id }, '준비 시기 단계', stageSelect),
    E('label', { class: 'field', for: titleInput.id }, '할 일 내용', titleInput),
    E('label', { class: 'field', for: noteInput.id }, '진행 메모 (선택)', noteInput));
  const submit = E('button', { class: 'button', type: 'submit' }, isEdit ? '할 일 저장' : '할 일 추가');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const title = titleInput.value.trim(), note = noteInput.value.trim(), stage = stageSelect.value;
      if (!title) throw new Error('할 일 내용을 입력해 주세요.');
      const latestPrefs = ctx.getPrefs();
      const curList = [...(latestPrefs.customChecklist || [])];
      if (!isEdit && curList.length >= 50) throw new Error('직접 추가한 할 일은 50개까지 보관할 수 있습니다.');
      const id = isEdit ? existing.id : 'custom-' + crypto.randomUUID().slice(0, 8);
      const nextCustom = isEdit ? curList.map(c => (c.id === id ? { id, stage, title } : c)) : [...curList, { id, stage, title }];
      const nextNotes = { ...(latestPrefs.checklistNotes || {}) };
      if (note) nextNotes[id] = note; else delete nextNotes[id];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), customChecklist: nextCustom, checklistNotes: nextNotes }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast(isEdit ? '우리만의 할 일을 수정했습니다.' : '우리만의 할 일을 체크리스트에 추가했습니다.'); }
    } catch (error) { ctx.toast(error.message, true); } finally { saving = false; submit.disabled = false; }
  });
  const initial = JSON.stringify([stageSelect.value, titleInput.value, noteInput.value]);
  if (ctx.showDialog(isEdit ? '우리만의 할 일 수정' : '우리만의 할 일 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || JSON.stringify([stageSelect.value, titleInput.value, noteInput.value]) !== initial, isSaving: () => saving });
  }
}

function openChecklistNoteModal(ctx, id, label) {
  if (ctx.isGuestMode()) return;
  const prefs = ctx.getPrefs();
  const form = E('form', { class: 'editor-form' });
  const currentNote = prefs.checklistNotes?.[id] || '';
  const input = E('input', { type: 'text', id: 'chk-note-input', maxlength: '300', placeholder: '예: 계약금 50만 원 완료 / 11월 20일 방문 예정' });
  input.value = currentNote;
  form.append(E('p', { class: 'form-note' }, `‘${label}’ 항목에 대한 진행 상황이나 일정 메모를 이 기기에 남깁니다.`), E('label', { class: 'field', for: input.id }, '항목 메모', input));
  const submit = E('button', { class: 'button', type: 'submit' }, '메모 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextNotes = { ...(ctx.getPrefs().checklistNotes || {}) };
      if (input.value.trim()) nextNotes[id] = input.value.trim(); else delete nextNotes[id];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), checklistNotes: nextNotes }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('체크리스트 메모를 저장했습니다.'); }
    } catch (error) { ctx.toast(error.message, true); } finally { saving = false; submit.disabled = false; }
  });
  if (ctx.showDialog('체크리스트 메모 편집', form)) {
    ctx.setEditorState({ isDirty: () => saving || input.value !== currentNote, isSaving: () => saving });
  }
}

export async function copyPreparationSummary(ctx) {
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const info = content.invitation || {};
  const names = [info.partner1, info.partner2].filter(Boolean).join(' & ') || '우리 커플';
  const dday = weddingDday(info.date);
  const selectedStudio = ctx.getStudiosState().activeLachma;
  const selectedTrip = content.honeymoon.find(t => t.id === prefs.tripSelected);
  const bPlan = prefs.budgetPlan || {};
  const budget = weddingBudgetSummary(bPlan, WEDDING_BUDGET_CATEGORIES.map(([key]) => key));
  const bHas = Object.keys(bPlan).length > 0;
  const gSummary = guestListSummary(prefs.guestList || []);
  const giftSummary = giftLedgerSummary(prefs.giftLedger || []);
  const pSched = prenatalDeadlineSummary(prefs.prenatalSchedule);
  const hSum = homeItemsSummary(prefs.homeItems || []);
  const stages = allChecklistStages(prefs);
  const allItems = stages.flatMap(g => g[2]);
  const checkedSet = new Set(prefs.checklist || []);
  const doneCount = allItems.filter(it => checkedSet.has(it.id)).length;
  const nextItem = allItems.find(it => !checkedSet.has(it.id));
  const vList = activeVendorSchedules(prefs).filter(v => !v.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const nextVendor = vList[0];
  const shootInfo = selectedStudio?.deepGuide?.schedule ? ` (${selectedStudio.deepGuide.schedule.label} 촬영 확정 · ${weddingDday(selectedStudio.deepGuide.schedule.date)})` : '';
  const lines = [
    `💍 [${names} 결혼 준비 현황 요약]`,
    `• 예식 일정: ${info.date ? formatDate(info.date) : '미정'}${info.time ? ` ${info.time}` : ''}${dday ? ` (${dday})` : ''}`,
    `• 예식 장소: ${info.venue || '미정'}`,
    `• 스튜디오: ${selectedStudio ? `${selectedStudio.name}${shootInfo}` : `라크마 (2027-02-03 수요일 12:00 촬영 확정 · ${weddingDday('2027-02-03')})`}`,
    `• 신혼여행: ${selectedTrip ? `${selectedTrip.title} (2인 계획예산 ${won(selectedTrip.budget)})` : `후보 검토 중 (관심 ${(prefs.tripFavorites || []).length}곳)`}`,
    `• 통합 예산: ${bHas ? `목표 ${budget.planned.known === null ? '미입력' : won(budget.planned.known)} / 실제·견적 ${budget.actual.known === null ? '미입력' : won(budget.actual.known)}` : '미입력'}`,
    ...(hSum.totalCount ? [`• 신혼집·혼수: ${hSum.totalCount}품목 (완료 ${hSum.doneCount} · 실제 ${hSum.actualTotal === null ? '미입력' : won(hSum.actualTotal)})`] : []),
    ...(pSched.status !== 'empty' ? [`• 산전검사 일정: ${pSched.statusLabel}${pSched.claimDeadline && !pSched.claimed ? ` (청구 마감 ${pSched.claimDeadline})` : pSched.examDeadline && !pSched.examDate ? ` (검사 마감 ${pSched.examDeadline})` : pSched.visitDate ? ` (예약 ${pSched.visitDate})` : ''}`] : []),
    ...(gSummary.totalRecords ? [`• 하객 명단: ${gSummary.totalRecords}건 · 참석 확정 ${gSummary.attendingHeadcount}명 (불참 제외 예상 ${gSummary.possibleHeadcount}명 · 발송 ${gSummary.sentCount}/${gSummary.totalRecords})`] : []),
    ...(giftSummary.totalRecords ? [`• 축의금 장부: ${giftSummary.totalRecords}건 · 총 ${won(giftSummary.totalAmount)} · 식권 ${giftSummary.totalMealTickets}매`] : []),
    `• 다가오는 업체 일정: ${nextVendor ? `${nextVendor.category} ${nextVendor.name}${nextVendor.date ? ` (${nextVendor.date} · ${weddingDday(nextVendor.date)})` : ''}` : '등록된 미완료 일정 없음'}`,
    `• 체크리스트: 전체 ${allItems.length}개 중 ${doneCount}개 완료 (${Math.round((doneCount / allItems.length) * 100)}%)`,
    `• 다음 할 일: ${nextItem ? nextItem.label : '모든 할 일 완료 🎉'}`
  ];
  const summaryText = lines.join('\n');
  await ctx.copyTextToClipboard(summaryText, '결혼 준비 현황 요약을 복사했습니다. 카카오톡 등에 붙여넣어 공유해 보세요.', '결혼 준비 현황 요약 복사');
}

export function renderPhaseFocusCard(ctx) {
  if (ctx.isGuestMode()) return null;
  const phase = weddingPhaseInfo({
    content: ctx.getContent(),
    prefs: ctx.getPrefs(),
    studio: ctx.getStudiosState().activeLachma
  });
  const fieldOpsBtn = phase.phase === 'shoot'
    ? button('⚡ 촬영 당일 현장 모드', () => ctx.openShootDayMode?.(), 'button quiet')
    : (phase.phase === 'ceremony' || phase.phase === 'final')
      ? button('⚡ 본식 당일 현장 모드', () => ctx.openWeddingDayHub?.(), 'button quiet')
      : null;
  return E('section', { class: `phase-focus-card is-phase-${phase.phase}`, id: 'home-phase-focus', 'aria-label': '현재 시기 집중 웨딩 가이드' },
    E('div', { class: 'phase-focus-head' },
      E('div', {},
        E('span', { class: 'phase-focus-badge' }, phase.badge),
        E('h2', { class: 'phase-focus-title' }, phase.title),
        E('p', { class: 'small muted phase-focus-sub' }, phase.subtitle)),
      E('div', { class: 'phase-focus-actions' },
        ...phase.actions.map(act => button(act.label, () => {
          ctx.navigateToRoute(act.route, act.subTab || '', act.action || '');
        }, act.primary ? 'button' : 'button quiet')),
        fieldOpsBtn)),
    phase.metrics?.length ? E('div', { class: 'phase-focus-metrics' }, phase.metrics.map(m => E('span', { class: 'spec-chip' }, m))) : null);
}

export function renderJourneyRibbon(ctx, info, dday) {
  if (ctx.isGuestMode()) return null;
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const selectedStudio = ctx.getStudiosState().activeLachma;
  const shootSched = selectedStudio?.deepGuide?.schedule;
  const selectedTrip = content.honeymoon.find(t => t.id === prefs.tripSelected);
  const trips = content.honeymoon || [];
  const firstTrip = trips[0];
  const uniformTripDates = trips.length > 0 && firstTrip?.startDate && firstTrip?.endDate && trips.every(t => t.startDate === firstTrip.startDate && t.endDate === firstTrip.endDate);
  const allDirect = trips.length > 0 && trips.every(t => tripFlightBadge(t).direct);
  const step1Date = shootSched?.date ? shootSched.date.replaceAll('-', '.') : '2027.02.03';
  const step1Title = selectedStudio ? `${selectedStudio.name} 웨딩촬영` : '라크마 웨딩촬영';
  const step1Sub = shootSched ? `${shootSched.weekday || ''} ${shootSched.time || ''}${shootSched.date ? ` · ${weddingDday(shootSched.date)}` : ''}`.trim() : `수요일 12:00 · ${weddingDday('2027-02-03')}`;
  const step2Date = info.date ? info.date.replaceAll('-', '.') : '예식 일정';
  const step2Title = info.date ? '본식 예식일' : '예식 정보 준비 중';
  const step2Sub = [info.venue, info.time, dday].filter(Boolean).join(' · ') || '예식 날짜와 장소를 입력해 주세요';
  const step3Date = selectedTrip?.startDate ? `${selectedTrip.startDate.replaceAll('-', '.')}${selectedTrip.endDate ? `~${selectedTrip.endDate.slice(5).replaceAll('-', '.')}` : ''}` : (uniformTripDates ? `${firstTrip.startDate.replaceAll('-', '.')}~${firstTrip.endDate.slice(5).replaceAll('-', '.')}` : '허니문 준비');
  const step3Title = selectedTrip ? selectedTrip.title : (trips.length ? (allDirect ? `인천 직항 허니문 ${trips.length}곳` : `신혼여행 후보 ${trips.length}곳`) : '첫 여행 후보 남기기');
  const step3Sub = selectedTrip ? `2인 계획예산 ${won(selectedTrip.budget)} · 최종 선택` : (trips.length ? (allDirect ? '전 노선 인천 직항 · 휴양 후보 비교 중' : '일정·예산·기후 나란히 비교하기') : '가고 싶은 여행지부터 모아 보기');
  return E('section', { class: 'journey-ribbon', 'aria-label': '우리의 3단계 웨딩 여정 타임라인' },
    E('p', { class: 'journey-ribbon-head' }, '✨ 우리의 3단계 웨딩 여정 타임라인'),
    E('div', { class: 'journey-ribbon-grid' },
      E('a', { class: 'journey-step is-studio', href: '#/studios' },
        E('span', { class: 'journey-step-tag' }, `STEP 1 · ${step1Date}`),
        E('strong', { class: 'journey-step-title' }, step1Title),
        E('span', { class: 'journey-step-sub' }, step1Sub)),
      E('a', { class: 'journey-step is-ceremony', href: '#/invitation' },
        E('span', { class: 'journey-step-tag' }, `STEP 2 · ${step2Date}`),
        E('strong', { class: 'journey-step-title' }, step2Title),
        E('span', { class: 'journey-step-sub' }, step2Sub)),
      E('a', { class: 'journey-step is-honeymoon', href: '#/honeymoon' },
        E('span', { class: 'journey-step-tag' }, `STEP 3 · ${step3Date}`),
        E('strong', { class: 'journey-step-title' }, step3Title),
        E('span', { class: 'journey-step-sub' }, step3Sub))));
}

export function homeMenuStatuses(ctx) {
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const info = content.invitation;
  const ceremonyDone = (prefs.ceremonyChecks || []).filter(id => CEREMONY_PREP_ITEMS.some(([cid]) => cid === id)).length;
  const prenatalDone = (prefs.prenatalChecks || []).filter(id => PRENATAL_CHECK_ITEMS.some(([pid]) => pid === id)).length;
  const pSched = prenatalDeadlineSummary(prefs.prenatalSchedule);
  const gCount = (prefs.guestList || []).length;
  const dayOpsCount = (prefs.weddingDayRoles || []).length + (prefs.weddingDayEnvelopes || []).length;
  const hCount = (prefs.homeItems || []).length;
  return {
    invitation: info.date ? '예식 일시·장소 안내' : '첫 인사를 준비해요',
    story: `${content.stories.length}개의 이야기`,
    albums: `${content.albums.length}개의 앨범`,
    studios: '2/3(수) 12:00 촬영 안내',
    honeymoon: `${content.honeymoon.length}개의 여행 후보`,
    ceremony: gCount ? `체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 하객 ${gCount}건` : (dayOpsCount ? `12단계 식순 · 당일 역할/봉투 ${dayOpsCount}건` : `준비 체크 ${ceremonyDone}/${CEREMONY_PREP_ITEMS.length} · 12단계 식순`),
    prenatal: pSched.status !== 'empty' ? `${pSched.statusLabel} · 체크 ${prenatalDone}/${PRENATAL_CHECK_ITEMS.length}` : `순천현대병원 · 준비 체크 ${prenatalDone}/${PRENATAL_CHECK_ITEMS.length}`,
    tips: hCount ? `꿀팁 ${content.tips.length}개 · 혼수 ${hCount}품목` : `꿀팁 ${content.tips.length}개 · 혼수·신혼혜택`
  };
}

export function renderHomeDashboard(ctx) {
  if (ctx.isGuestMode()) return null;
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const selectedStudio = ctx.getStudiosState().activeLachma;
  const hasLachmaMemo = Boolean(prefs.notes?.['studio-09']?.trim());
  const donePrepCount = (prefs.shootChecklist || []).length;
  const totalPrepCount = (selectedStudio?.deepGuide?.prepChecklist || []).reduce((sum, grp) => sum + (grp.items?.length || 0), 0);
  const selectedTrip = content.honeymoon.find(t => t.id === prefs.tripSelected);
  const tripFavCount = (prefs.tripFavorites || []).length;
  const bPlan = prefs.budgetPlan || {};
  const budget = weddingBudgetSummary(bPlan, WEDDING_BUDGET_CATEGORIES.map(([key]) => key));
  const bHas = Object.keys(bPlan).length > 0;
  const gSummary = guestListSummary(prefs.guestList || []);
  const giftSummary = giftLedgerSummary(prefs.giftLedger || []);
  const pSched = prenatalDeadlineSummary(prefs.prenatalSchedule);
  const hSum = homeItemsSummary(prefs.homeItems || []);
  const stages = allChecklistStages(prefs);
  const allItems = stages.flatMap(g => g[2]);
  const checkedSet = new Set(prefs.checklist || []);
  const doneCount = allItems.filter(it => checkedSet.has(it.id)).length;
  const nextItem = allItems.find(it => !checkedSet.has(it.id));
  const vList = activeVendorSchedules(prefs).filter(v => !v.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const nextVendor = vList[0];
  const shootSched = selectedStudio?.deepGuide?.schedule;
  const prenatalStrip = pSched.status !== 'empty' ? E('div', { class: 'dashboard-prenatal-strip' + (pSched.urgent ? ' is-urgent' : '') },
    E('div', { class: 'dashboard-prenatal-info' },
      E('strong', {}, `🩺 산전검사 지원금 · ${pSched.statusLabel}`),
      E('span', { class: 'small muted' }, [
        pSched.visitDate ? `현대여성아동병원 예약 ${pSched.visitDate}` : '',
        pSched.examDeadline && !pSched.examDate ? `검사 마감 ${pSched.examDeadline}` : '',
        pSched.claimDeadline && !pSched.claimed ? `청구 마감 ${pSched.claimDeadline}` : ''
      ].filter(Boolean).join(' · ') || '산전검사 탭에서 일정과 구비서류를 확인하세요.')),
    linkButton('산전검사 일정 보기 →', '#/prenatal/subsidy', true)) : null;
  const backupRem = ctx.backupReminderInfo(prefs);
  const backupStrip = backupRem ? E('div', { class: 'dashboard-backup-strip', role: 'region', 'aria-label': '개인 백업 알림' },
    E('div', { class: 'dashboard-prenatal-info' },
      E('strong', {}, '💾 개인 기록 백업 · 2인 동기화 권장'),
      E('span', { class: 'small muted' }, backupRem.message)),
    E('div', { class: 'page-actions' },
      button('💑 3초 동기화 코드', () => ctx.openCoupleSync?.(), 'button small-copy-btn'),
      button('📥 파일 백업', () => ctx.downloadPrivate(), 'button quiet small-copy-btn'),
      ctx.canShareBackupFiles() ? button('📤 파일 공유', () => ctx.sharePrivateBackup(), 'button quiet small-copy-btn') : null,
      button('일주일 숨기기', () => { ctx.writeBackupMeta({ snoozeUntil: Date.now() + 7 * 86400000 }); ctx.render(); ctx.toast('백업 알림을 일주일간 숨겼습니다. 내용 관리에서 언제든 백업할 수 있어요.'); }, 'text-button small'))) : null;
  return E('section', { class: 'home-dashboard', 'aria-labelledby': 'home-dashboard-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'OUR SELECTION & BUDGET BOARD'),
        E('h2', { id: 'home-dashboard-title' }, '우리의 선택 & 예산 한눈에 보기'),
        E('p', {}, '스튜디오·신혼여행·통합 예산·산전검사·하객·체크리스트 현황을 이 기기에서 바로 확인하세요.')),
      E('div', { class: 'page-actions' },
        button('💑 2인 동기화', () => ctx.openCoupleSync?.(), 'button quiet'),
        button('📋 준비 현황 요약 복사', () => copyPreparationSummary(ctx), 'button quiet'),
        actionOverflowMenu([
          ['📸 촬영 당일 현장 브리핑 모드', () => ctx.openShootDayMode?.()],
          ['💍 본식 당일 현장 통합 모드', () => ctx.openWeddingDayHub?.()],
          ['🖨️ 요약 인쇄 / PDF', () => window.print()],
          ['📥 개인 백업 JSON 저장', () => ctx.downloadPrivate()]
        ], { ariaLabel: '홈 대시보드 추가 도구' }))),
    backupStrip,
    prenatalStrip,
    E('div', { class: 'dashboard-grid' },
      E('article', { class: 'dashboard-card' },
        E('span', { class: 'small muted' }, '📸 웨딩 스튜디오'),
        E('strong', {}, selectedStudio ? `⭐ ${selectedStudio.name}${shootSched ? ' (2/3 수 12:00 촬영)' : ''}` : '⭐ 라크마 (2/3 수 12:00 촬영)'),
        E('p', { class: 'small muted' }, shootSched ? `🗓️ ${shootSched.date} (${shootSched.weekday}) ${shootSched.time} (${weddingDday(shootSched.date)})${totalPrepCount ? ` · 준비물 ${donePrepCount}/${totalPrepCount}` : ''}${hasLachmaMemo ? ' · 메모 있음' : ''}` : '광주 남구 중앙로 117 · 공식 촬영 가이드'),
        linkButton('라크마 촬영 안내 보기 →', '#/studios', true)),
      E('article', { class: 'dashboard-card' },
        E('span', { class: 'small muted' }, '✈️ 신혼여행 픽'),
        E('strong', {}, selectedTrip ? selectedTrip.title : '최종 후보 선택 전'),
        E('p', { class: 'small muted' }, selectedTrip ? `2인 계획예산 ${won(selectedTrip.budget)} · 관심 ${tripFavCount}곳` : `후보 ${content.honeymoon.length}곳 · 관심 ${tripFavCount}곳`),
        linkButton('신혼여행 후보 이동 →', '#/honeymoon', true)),
      E('article', { class: 'dashboard-card' },
        E('span', { class: 'small muted' }, '💰 통합 예산 & 축의금·혼수'),
        E('strong', {}, bHas ? `목표 ${budget.planned.complete ? '합계' : '입력 소계'} ${budget.planned.known === null ? '미입력' : won(budget.planned.known)}` : '6대 예산 미입력'),
        E('p', { class: 'small muted' }, bHas ? `실제·견적 ${budget.actual.complete ? '합계' : '입력 소계'} ${budget.actual.known === null ? '미입력' : won(budget.actual.known)} (${budget.difference === null ? '차액 미확인' : budget.difference >= 0 ? `여유 ${won(budget.difference)}` : `초과 ${won(-budget.difference)}`})` : '웨딩홀·스드메·신혼여행 통합 관리'),
        hSum.totalCount ? E('p', { class: 'small muted' }, `🏠 혼수·가전: ${hSum.totalCount}품목 (완료 ${hSum.doneCount} · 실제 ${hSum.actualTotal === null ? '미입력' : won(hSum.actualTotal)})`) : null,
        giftSummary.totalRecords ? E('p', { class: 'small muted' }, `💌 축의금 장부: ${giftSummary.totalRecords}건 · ${won(giftSummary.totalAmount)} · 식권 ${giftSummary.totalMealTickets}매`) : (!hSum.totalCount && bHas ? E('p', { class: 'small muted' }, `미입력: 목표 ${budget.planned.missing}개 · 실제·견적 ${budget.actual.missing}개`) : null),
        button('예산 계산기 이동 →', () => ctx.navigateToRoute('tips', 'budget'), 'button quiet')),
      E('article', { class: 'dashboard-card' },
        E('span', { class: 'small muted' }, '✅ 다음 할 일 & 하객 현황'),
        E('strong', {}, nextItem ? nextItem.label : '모든 할 일 완료 🎉'),
        nextVendor ? E('p', { class: 'small' }, `📅 다가오는 일정: ${nextVendor.name}${nextVendor.date ? ` (${nextVendor.date} · ${weddingDday(nextVendor.date)})` : ''}`) : null,
        gSummary.totalRecords ? E('p', { class: 'small muted' }, `👥 하객 ${gSummary.totalRecords}건 · 참석 ${gSummary.attendingHeadcount}명 (예상 ${gSummary.possibleHeadcount}명 · 발송 ${gSummary.sentCount}/${gSummary.totalRecords})`) : E('p', { class: 'small muted' }, `체크리스트 전체 ${allItems.length}개 중 ${doneCount}개 완료 (${Math.round((doneCount / allItems.length) * 100)}%)`),
        gSummary.totalRecords ? button('하객 명단 이동 →', () => ctx.navigateToRoute('ceremony', 'guests'), 'button quiet') : button('체크리스트 보기 ↓', () => $('#home-checklist-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 'button quiet'))));
}

export function renderHomeMasterTimeline(ctx) {
  if (ctx.isGuestMode()) return null;
  const allEvents = collectMasterTimeline({ content: ctx.getContent(), prefs: ctx.getPrefs(), studio: ctx.getStudiosState().activeLachma });
  if (!allEvents.length) return null;
  const upcoming = allEvents.filter(item => (!item.done && item.daysLeft >= 0) || item.urgent);
  const visible = timelineShowAll ? allEvents : (upcoming.length ? upcoming : allEvents);
  const exportTargets = upcoming.length ? upcoming : allEvents;
  const monthLabel = key => {
    const [y, m] = key.split('-');
    return `${Number(y)}년 ${Number(m)}월`;
  };
  const ddayText = item => {
    if (item.done) return '완료';
    if (item.daysLeft === 0) return 'D-Day';
    if (item.daysLeft > 0) return `D-${item.daysLeft}`;
    return `D+${Math.abs(item.daysLeft)}`;
  };
  const downloadMasterIcs = () => {
    try {
      const ics = multiScheduleCalendar(exportTargets.map(item => ({
        id: item.id,
        title: `[${item.category.replace(/^\S+\s*/, '')}] ${item.title}`,
        date: item.date,
        endDate: item.endDate || '',
        time: item.time || '',
        location: item.location || '',
        description: item.detail || ''
      })));
      downloadText(ics, 'wedding-master-schedule.ics', 'text/calendar;charset=utf-8');
      ctx.toast(`결혼 준비 핵심 일정 ${exportTargets.length}건을 .ics 파일 1개로 저장했습니다.`);
    } catch (error) { ctx.toast(error.message || '일정 파일을 만들지 못했습니다.', true); }
  };
  const copyMasterTimeline = () => {
    const lines = [
      '🗓️ [우리의 결혼 준비 통합 마스터 일정]',
      ...visible.map(item => `• ${item.date}${item.endDate ? `~${item.endDate}` : ''}${item.time ? ` ${item.time}` : ''} (${ddayText(item)}) · ${item.category} ${item.title}${item.detail ? ` — ${item.detail}` : ''}`)
    ];
    ctx.copyTextToClipboard(lines.join('\n'), '통합 마스터 일정을 복사했습니다.', '통합 마스터 일정 복사');
  };
  const showAllCheck = E('input', { type: 'checkbox', id: 'timeline-show-all' });
  showAllCheck.checked = timelineShowAll;
  showAllCheck.addEventListener('change', () => { timelineShowAll = showAllCheck.checked; ctx.render(); $('#timeline-show-all')?.focus({ preventScroll: true }); });

  const displayList = timelineExpanded ? visible : visible.slice(0, 4);
  const groups = [];
  for (const item of displayList) {
    let g = groups[groups.length - 1];
    if (!g || g.monthKey !== item.monthKey) { g = { monthKey: item.monthKey, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  return E('section', { class: 'home-timeline', 'aria-labelledby': 'home-timeline-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'MASTER WEDDING CALENDAR · PRIVATE'),
        E('h2', { id: 'home-timeline-title' }, '🗓️ 통합 결혼 마스터 캘린더'),
        E('p', {}, `스튜디오·산전검사·본식·신혼여행·업체·혼수·혜택의 모든 날짜(${allEvents.length}건)를 월별로 모아 보고 한 번에 캘린더에 등록하세요.`)),
      E('div', { class: 'page-actions' },
        button(`📥 전체 일정 .ics 일괄 저장 (${exportTargets.length}건)`, downloadMasterIcs, 'button'),
        button('📋 마스터 일정 복사', copyMasterTimeline, 'button quiet'))),
    E('div', { class: 'checklist-controls' },
      E('span', { class: 'small muted' }, `표시 중 ${displayList.length}건 / 전체 ${allEvents.length}건 (다가오는 일정 ${upcoming.length}건)`),
      allEvents.length !== upcoming.length ? E('label', { class: 'check-label', for: showAllCheck.id }, showAllCheck, '완료·지난 일정도 함께 보기') : null),
    E('div', { class: 'master-timeline-groups' }, groups.map(group => E('div', { class: 'master-timeline-month' },
      E('h3', { class: 'master-month-label' }, monthLabel(group.monthKey)),
      E('ul', { class: 'master-timeline-list' }, group.items.map(item => E('li', { class: 'master-timeline-row' + (item.done ? ' is-done' : '') + (item.urgent ? ' is-urgent' : '') },
        E('div', { class: 'master-row-date' },
          E('strong', {}, item.date.slice(5).replace('-', '.')),
          item.time ? E('span', { class: 'small muted' }, item.time) : null,
          E('span', { class: 'spec-chip ' + (item.urgent ? 'highlight' : item.done ? '' : 'direct') }, ddayText(item))),
        E('div', { class: 'master-row-main' },
          E('div', { class: 'master-row-head' },
            E('span', { class: 'badge' }, item.category),
            E('strong', {}, item.title)),
          item.detail ? E('p', { class: 'small muted' }, item.detail) : null),
        button('이동 →', () => ctx.navigateToRoute(item.route, item.subTab || ''), 'button quiet small-copy-btn'))))))),
    visible.length > 4 ? E('div', { class: 'timeline-expand-bar' },
      button(timelineExpanded ? '요약(4건)으로 접기 ▲' : `전체 일정 ${visible.length}건 모두 펼치기 ▼`, () => {
        timelineExpanded = !timelineExpanded;
        ctx.render();
      }, 'button quiet')) : null);
}

function activeFocusStageName(content, stages, checkedSet) {
  const invDate = content?.invitation?.date;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const days = invDate ? dateSpan(today, invDate) : null;
  let preferred = 'D-180 이전';
  if (days !== null) {
    if (days <= 21) preferred = 'D-14 ~ D-Day';
    else if (days <= 75) preferred = 'D-60 ~ D-30';
    else if (days <= 150) preferred = 'D-120 ~ D-90';
  }
  const prefStage = stages.find(([s, , items]) => s === preferred && items.some(it => !checkedSet.has(it.id)));
  if (prefStage) return prefStage[0];
  const firstIncomplete = stages.find(([, , items]) => items.some(it => !checkedSet.has(it.id)));
  return firstIncomplete ? firstIncomplete[0] : preferred;
}

export function renderHomeChecklist(ctx) {
  if (ctx.isGuestMode()) return null;
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const stages = allChecklistStages(prefs);
  const allItems = stages.flatMap(g => g[2]);
  const checkedSet = new Set(prefs.checklist || []);
  const doneCount = allItems.filter(it => checkedSet.has(it.id)).length;
  const pct = Math.round((doneCount / allItems.length) * 100);
  const focusStage = activeFocusStageName(content, stages, checkedSet);
  const toggleItem = id => ctx.queuePreference(async () => {
    const latest = ctx.getPrefs();
    const nextSet = new Set(latest.checklist || []);
    nextSet.has(id) ? nextSet.delete(id) : nextSet.add(id);
    const saved = await ctx.savePrefs({ ...latest, checklist: [...nextSet] });
    if (saved && ctx.currentRoute() === 'home') ctx.render();
    return saved;
  });
  const deleteCustom = (id, label) => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const curCustom = latest.customChecklist || [];
      const removedIndex = curCustom.findIndex(c => c.id === id);
      if (removedIndex < 0) return true;
      const snapshot = structuredClone(curCustom[removedIndex]);
      const wasChecked = (latest.checklist || []).includes(id);
      const prevNote = latest.checklistNotes?.[id] || '';
      const nextCustom = curCustom.filter(c => c.id !== id);
      const nextSet = (latest.checklist || []).filter(cid => cid !== id);
      const nextNotes = { ...(latest.checklistNotes || {}) };
      delete nextNotes[id];
      const saved = await ctx.savePrefs({ ...latest, customChecklist: nextCustom, checklist: nextSet, checklistNotes: nextNotes });
      if (saved && ctx.currentRoute() === 'home') {
        ctx.render();
        ctx.toast(`‘${label}’ 할 일을 삭제했습니다.`, {
          undoLabel: '되돌리기',
          onUndo: () => ctx.queuePreference(async () => {
            const cur = ctx.getPrefs();
            const restoredCustom = [...(cur.customChecklist || [])];
            if (restoredCustom.some(c => c.id === snapshot.id)) return true;
            restoredCustom.splice(Math.min(removedIndex, restoredCustom.length), 0, snapshot);
            const restoredChecks = wasChecked ? [...new Set([...(cur.checklist || []), snapshot.id])] : (cur.checklist || []);
            const restoredNotes = { ...(cur.checklistNotes || {}) };
            if (prevNote) restoredNotes[snapshot.id] = prevNote;
            const restored = await ctx.savePrefs({ ...cur, customChecklist: restoredCustom, checklist: restoredChecks, checklistNotes: restoredNotes });
            if (restored) { ctx.render(); ctx.toast(`‘${snapshot.title}’ 할 일을 복구했습니다.`); }
            return restored;
          })
        });
      }
      return saved;
    });
  };
  const filterCheck = E('input', { type: 'checkbox', id: 'chk-incomplete-only' });
  filterCheck.checked = checklistIncompleteOnly;
  filterCheck.addEventListener('change', () => { checklistIncompleteOnly = filterCheck.checked; ctx.render(); $('#chk-incomplete-only')?.focus({ preventScroll: true }); });
  return E('section', { class: 'home-checklist', 'aria-labelledby': 'home-checklist-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'WEDDING ROADMAP · PRIVATE'),
        E('h2', { id: 'home-checklist-title' }, 'D-Day 연동 결혼 준비 시기별 체크리스트'),
        E('p', {}, '체크한 내역과 직접 추가한 할 일·메모는 이 기기의 개인 설정에만 저장됩니다.')),
      E('div', { class: 'checklist-head-actions' },
        E('div', { class: 'checklist-summary-pill' },
          E('strong', {}, `진행률 ${pct}%`),
          E('span', { class: 'small muted' }, ` (${doneCount}/${allItems.length} 완료)`)),
        button('+ 우리만의 할 일 추가', () => openCustomChecklistEditor(ctx), 'button quiet'))),
    E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
      E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` })),
    E('div', { class: 'checklist-controls' },
      E('label', { class: 'check-label', for: filterCheck.id }, filterCheck, '남은 할 일만 보기'),
      button(checklistExpandAll ? '현재 시기만 펼치기' : '전체 4단계 펼치기', () => {
        checklistExpandAll = !checklistExpandAll;
        ctx.render();
      }, 'button quiet small-copy-btn')),
    E('div', { class: 'checklist-grid' }, stages.map(([stage, subtitle, items]) => {
      const visible = checklistIncompleteOnly ? items.filter(it => !checkedSet.has(it.id)) : items;
      const stageDone = items.filter(it => checkedSet.has(it.id)).length;
      const isFocus = stage === focusStage;
      const details = E('details', { class: 'checklist-stage-card checklist-stage-details' + (isFocus ? ' is-focus-stage' : '') },
        E('summary', { class: 'stage-head' },
          E('div', { class: 'stage-head-main' },
            E('span', { class: 'badge' }, stage),
            isFocus ? E('span', { class: 'spec-chip highlight focus-stage-badge' }, '📍 지금 집중할 시기') : null,
            E('span', { class: 'small muted stage-progress-count' }, `${stageDone}/${items.length}`)),
          E('h3', {}, subtitle)),
        visible.length ? E('ul', { class: 'checklist-items' }, visible.map(({ id, label, custom }) => {
          const input = E('input', { type: 'checkbox', id: `chk-${id}` });
          input.checked = checkedSet.has(id);
          input.addEventListener('change', () => toggleItem(id));
          const note = prefs.checklistNotes?.[id] || '';
          return E('li', { class: input.checked ? 'done' : '' },
            E('div', { class: 'checklist-row-main' },
              E('label', { for: input.id, class: 'checklist-label' }, input, E('span', {}, label)),
              E('div', { class: 'checklist-item-actions' },
                button(note ? '메모 수정' : '메모', () => openChecklistNoteModal(ctx, id, label), 'text-button small checklist-note-btn'),
                custom ? button('수정', () => openCustomChecklistEditor(ctx, { id, stage, title: label }), 'text-button small checklist-note-btn') : null,
                custom ? button('삭제', () => deleteCustom(id, label), 'text-button small') : null)),
            note ? E('p', { class: 'checklist-item-note small' }, `📝 ${note}`) : null);
        })) : E('p', { class: 'small muted' }, '이 단계의 남은 할 일이 없습니다. 🎉'));
      if (isFocus || checklistExpandAll || checklistIncompleteOnly) details.open = true;
      return details;
    })));
}
