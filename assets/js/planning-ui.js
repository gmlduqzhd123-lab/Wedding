import { E, button, externalLink, downloadText, searchBox } from './dom.js?v=wedding-features-54';
import { formatDate, weddingDday } from './content.js?v=wedding-features-54';
import { VENDOR_CATEGORIES } from './preferences.js?v=wedding-features-54';
import { quoteReview } from './travel.js?v=wedding-features-54';
import { scheduleCalendar, scheduleGoogleCalendarUrl } from './calendar.js?v=wedding-features-54';
import {
  DEFAULT_VENDOR_SCHEDULES,
  WEDDING_BUDGET_CATEGORIES,
  activeVendorSchedules,
  venueEstimate,
  weddingBudgetSummary,
  sdmEstimate,
  guestListSummary
} from './planning.js?v=wedding-features-54';
import { youtubeVideoId, isYoutubeUrl, openYoutubeModal, youtubeThumbBanner } from './travel-ui.js?v=wedding-features-54';
import { BENEFIT_CHECK_ITEMS, renderHomeItemsBoard, renderBenefitsGuideBoard } from './life-planning-ui.js?v=wedding-features-54';

export { DEFAULT_VENDOR_SCHEDULES, WEDDING_BUDGET_CATEGORIES, activeVendorSchedules };

let tipsSubTab = 'tips';
export function setTipsSubTab(tab) {
  if (['tips', 'budget', 'schedule', 'home', 'benefits'].includes(tab)) tipsSubTab = tab;
}

let tipFilter = '';
let tipCategory = 'all';
let tipFavoritesOnly = false;
let withTipNoteOnly = false;
let redrawTips = () => {};

const won = value => (value === null ? '미확인' : `${value.toLocaleString('ko-KR')}원`);

export function filteredTips(ctx) {
  const guestMode = ctx.isGuestMode();
  const prefs = ctx.getPrefs();
  const query = tipFilter.trim().toLocaleLowerCase();
  return (ctx.getContent()?.tips || []).filter(item =>
    (tipCategory === 'all' || (item.category || '기타') === tipCategory) &&
    (guestMode || !tipFavoritesOnly || prefs.tipFavorites?.includes(item.id)) &&
    (guestMode || !withTipNoteOnly || Boolean(prefs.tipNotes?.[item.id]?.trim())) &&
    (!query || `${item.title} ${item.category} ${item.channel} ${item.body}`.toLocaleLowerCase().includes(query))
  );
}

export function openVenueSimulator(ctx) {
  if (ctx.isGuestMode()) return;
  const prefs = ctx.getPrefs();
  const cur = structuredClone(prefs.venueSim || { mealPrice: null, guestCount: null, minGuarantee: null, hallFee: null, deposit: null, note: '' });
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '빈칸은 미입력이며 0원·0명과 다릅니다. 식대·예상 하객 수·최소 보증인원·대관료를 모두 입력해야 총액을 계산합니다. 계약금을 입력해야 잔금을 계산하며, 없는 비용은 확인 후 0을 입력해 주세요. 일부 입력도 이 기기에 저장할 수 있습니다.'));
  const mealInput = E('input', { type: 'number', min: '0', max: '10000000', step: '1', id: 'vsim-meal', placeholder: '예: 55000' });
  mealInput.value = cur.mealPrice ?? '';
  const guestInput = E('input', { type: 'number', min: '0', max: '10000', step: '1', id: 'vsim-guest', placeholder: '예: 250' });
  guestInput.value = cur.guestCount ?? '';
  const minInput = E('input', { type: 'number', min: '0', max: '10000', step: '1', id: 'vsim-min', placeholder: '예: 200' });
  minInput.value = cur.minGuarantee ?? '';
  const hallInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'vsim-hall', placeholder: '예: 2500000' });
  hallInput.value = cur.hallFee ?? '';
  const depInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'vsim-dep', placeholder: '예: 1000000' });
  depInput.value = cur.deposit ?? '';
  const noteInput = E('input', { type: 'text', maxlength: '300', id: 'vsim-note', placeholder: '예: 순천아모르웨딩컨벤션 아모르홀 · 생화장식·혼주메이크업 포함 조건' });
  noteInput.value = cur.note || '';
  const previewBox = E('div', { class: 'form-note', 'aria-live': 'polite' });
  let saving = false;
  const numOrNull = node => (node.value.trim() === '' ? null : Number(node.value));
  const read = () => ({
    mealPrice: numOrNull(mealInput),
    guestCount: numOrNull(guestInput),
    minGuarantee: numOrNull(minInput),
    hallFee: numOrNull(hallInput),
    deposit: numOrNull(depInput),
    note: noteInput.value.trim()
  });
  const updatePreview = () => {
    const state = venueEstimate(read());
    previewBox.textContent = `계산 기준 인원 ${state.billedGuests === null ? '미입력' : state.billedGuests.toLocaleString('ko-KR') + '명'} · 식대 ${won(state.mealTotal)} · 입력값 기준 소계 ${won(state.subtotal)}\n` +
      (state.complete
        ? `총액 ${won(state.total)} (입력값 기준 · 확정 계약 견적 아님) · 계약금 차감 후 잔금 ${won(state.balance)}${state.balance === null ? ' · 계약금 미입력' : ''}`
        : `총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`) +
      (state.overpaid ? `\n계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.` : '');
  };
  for (const node of [mealInput, guestInput, minInput, hallInput, depInput]) node.addEventListener('input', updatePreview);
  updatePreview();
  const gSummary = guestListSummary(prefs.guestList || []);
  const syncTarget = gSummary.attendingHeadcount > 0 ? gSummary.attendingHeadcount : gSummary.possibleHeadcount;
  const syncGuestBtn = gSummary.totalRecords > 0
    ? button(
      `👥 하객 명단 인원 불러오기 (${syncTarget.toLocaleString('ko-KR')}명 · ${gSummary.attendingHeadcount > 0 ? '참석 확정' : '참석+미정'})`,
      () => {
        guestInput.value = String(syncTarget);
        updatePreview();
        guestInput.focus({ preventScroll: true });
        ctx.toast(`하객 명단 집계(${syncTarget.toLocaleString('ko-KR')}명)를 예상 하객 수에 채웠습니다.`);
      },
      'button quiet small-copy-btn'
    )
    : null;
  form.append(...[
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: mealInput.id }, '1인 식대 (원)', mealInput),
      E('label', { class: 'field', for: hallInput.id }, '대관료·연출료 합계 (원)', hallInput)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: guestInput.id }, '예상 하객 수 (명)', guestInput),
      E('label', { class: 'field', for: minInput.id }, '최소 보증인원 (명)', minInput)),
    syncGuestBtn ? E('div', { class: 'page-actions' }, syncGuestBtn) : null,
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: depInput.id }, '기납부 계약금 (원)', depInput),
      E('label', { class: 'field', for: noteInput.id }, '홀·계약 조건 메모 (선택)', noteInput)),
    previewBox,
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, '웨딩홀 시뮬레이터 저장'))
  ].filter(Boolean));
  const submit = form.querySelector('[type="submit"]');
  const snapshot = () => JSON.stringify([mealInput.value, guestInput.value, minInput.value, hallInput.value, depInput.value, noteInput.value]), initial = snapshot();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextSim = read(), saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), venueSim: nextSim }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('웨딩홀 식대·대관료 시뮬레이터를 저장했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog('웨딩홀 식대 · 보증인원 · 대관료 시뮬레이터', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function renderVenueSimulator(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const sim = prefs.venueSim;
  const hasSim = sim && (sim.mealPrice !== null || sim.guestCount !== null || sim.minGuarantee !== null || sim.hallFee !== null || sim.deposit !== null || sim.note);
  const meal = sim?.mealPrice ?? null, hall = sim?.hallFee ?? null;
  const state = venueEstimate(sim), { billedGuests, mealTotal, total: grandTotal, balance } = state;
  return E('div', { class: 'venue-sim-box' },
    E('div', { class: 'venue-sim-head' },
      E('div', {},
        E('strong', {}, `🏛️ 웨딩홀 식대·보증인원·대관료 시뮬레이터 (${ctx.getContent()?.invitation?.venue || '웨딩홀'})`),
        E('p', { class: 'small muted' }, hasSim ? (sim.note || '입력값으로 계산한 시뮬레이션입니다. 미입력 항목은 0원으로 계산하지 않습니다.') : '1인 식대, 예상 하객 수, 보증인원, 대관료·계약금을 입력해 웨딩홀 총액을 시뮬레이션해 보세요.')),
      E('div', { class: 'page-actions' },
        button(hasSim ? '시뮬레이터 수정' : '시뮬레이터 입력', () => openVenueSimulator(ctx), 'button quiet'),
        hasSim && state.complete ? button('계산 총액을 웨딩홀 예산에 반영', () => {
          const nextPlan = structuredClone(ctx.getPrefs().budgetPlan || {});
          const curVenue = nextPlan.venue || { planned: null, actual: null, note: '' };
          nextPlan.venue = {
            planned: curVenue.planned ?? grandTotal,
            actual: grandTotal,
            note: curVenue.note || `식대 ${won(meal)}×${billedGuests}명(${won(mealTotal)}) + 대관료 ${won(hall)}`
          };
          ctx.queuePreference(async () => {
            const saved = await ctx.savePrefs({ ...ctx.getPrefs(), budgetPlan: nextPlan });
            if (saved) { ctx.render(); ctx.toast(`웨딩홀 시뮬레이션 총액(${won(grandTotal)})을 통합 예산 계산기에 반영했습니다.`); }
            return saved;
          });
        }, 'button quiet') : null)),
    hasSim ? E('div', { class: 'venue-sim-grid' },
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '1인 식대 × 적용 인원'), E('strong', {}, `${won(meal)} × ${billedGuests === null ? '미입력' : billedGuests + '명'}`)),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '입력값 기준 소계'), E('strong', {}, won(state.subtotal))),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '입력값 기준 총액'), E('strong', {}, won(grandTotal))),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '계약금 차감 후 잔금'), E('strong', {}, won(balance)))) : null,
    hasSim && !state.complete ? E('p', { class: 'form-note' }, `총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`) : null,
    hasSim && state.complete && balance === null ? E('p', { class: 'small muted' }, '계약금 미입력 · 잔금 미확인') : null,
    state.overpaid ? E('p', { class: 'form-note' }, `계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`) : null);
}

export function openSdmSimulator(ctx) {
  if (ctx.isGuestMode()) return;
  const cur = structuredClone(ctx.getPrefs().sdmSim || { packageFee: null, helperFee: null, extraFee: null, deposit: null, roadScene: false, nightShoot: false, note: '' });
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '빈칸은 미입력이며 0원과 다릅니다. 스드메 기본 계약금·촬영 헬퍼비·원본/보정본 등 기타 추가금을 모두 입력해야 총액을 계산합니다(없는 비용은 확인 후 0 입력). 라크마 공식 기준 헬퍼비(250,000원, 현금)와 로드씬·야간촬영(각 +170,000원, 현금) 옵션을 함께 시뮬레이션할 수 있습니다.'));
  const pkgInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'sdm-pkg', placeholder: '예: 2400000' });
  pkgInput.value = cur.packageFee ?? '';
  const helperInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'sdm-helper', placeholder: '예: 250000 (라크마 공식 현금)' });
  helperInput.value = cur.helperFee ?? '';
  const extraInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'sdm-extra', placeholder: '예: 330000 (없으면 확인 후 0)' });
  extraInput.value = cur.extraFee ?? '';
  const depInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: 'sdm-dep', placeholder: '예: 500000' });
  depInput.value = cur.deposit ?? '';
  const roadCheck = E('input', { type: 'checkbox', id: 'sdm-road' });
  roadCheck.checked = Boolean(cur.roadScene);
  const nightCheck = E('input', { type: 'checkbox', id: 'sdm-night' });
  nightCheck.checked = Boolean(cur.nightShoot);
  const noteInput = E('input', { type: 'text', maxlength: '300', id: 'sdm-note', placeholder: '예: 라크마 2/3(수) 12시 · 루나메이크업 08:30 · 원본/수정본 별도 구매 조건' });
  noteInput.value = cur.note || '';
  const previewBox = E('div', { class: 'form-note', 'aria-live': 'polite' });
  let saving = false;
  const numOrNull = node => (node.value.trim() === '' ? null : Number(node.value));
  const read = () => ({
    packageFee: numOrNull(pkgInput),
    helperFee: numOrNull(helperInput),
    extraFee: numOrNull(extraInput),
    deposit: numOrNull(depInput),
    roadScene: roadCheck.checked,
    nightShoot: nightCheck.checked,
    note: noteInput.value.trim()
  });
  const updatePreview = () => {
    const state = sdmEstimate(read());
    previewBox.textContent = `선택 현장 옵션 합계 ${won(state.optionFee)} · 당일 현장 현금 준비액(헬퍼비+선택옵션) ${state.onSiteCash === null ? '미확인(헬퍼비 입력 필요)' : won(state.onSiteCash)} · 입력값 기준 소계 ${won(state.subtotal)}\n` +
      (state.complete
        ? `총액 ${won(state.total)} (입력값 기준 · 확정 견적 아님) · 계약금 차감 후 잔금 ${won(state.balance)}${state.balance === null ? ' · 계약금 미입력' : ''}`
        : `총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`) +
      (state.overpaid ? `\n계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.` : '');
  };
  for (const node of [pkgInput, helperInput, extraInput, depInput]) node.addEventListener('input', updatePreview);
  for (const node of [roadCheck, nightCheck]) node.addEventListener('change', updatePreview);
  updatePreview();
  form.append(
    E('div', { class: 'page-actions' },
      button('✨ 라크마 공식 헬퍼비(250,000원) 채우기', () => {
        helperInput.value = '250000';
        updatePreview();
        ctx.toast('라크마 공식 촬영 헬퍼비(250,000원)를 입력란에 채웠습니다.');
      }, 'button quiet')),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: pkgInput.id }, '스드메 기본 계약금 (원)', pkgInput),
      E('label', { class: 'field', for: helperInput.id }, '촬영 헬퍼비 (원 · 당일 현금)', helperInput)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: extraInput.id }, '원본·보정본·액자 등 기타 추가금 (원)', extraInput),
      E('label', { class: 'field', for: depInput.id }, '기납부 계약금 (원)', depInput)),
    E('div', { class: 'sdm-option-checks' },
      E('label', { class: 'check-label', for: roadCheck.id }, roadCheck, '로드씬 추가 (+170,000원 · 당일 현금)'),
      E('label', { class: 'check-label', for: nightCheck.id }, nightCheck, '야간촬영 추가 (+170,000원 · 최소 7일 전 예약·현금)')),
    E('label', { class: 'field', for: noteInput.id }, '스드메·촬영 조건 메모 (선택)', noteInput),
    previewBox,
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, '스드메 시뮬레이터 저장'))
  );
  const submit = form.querySelector('[type="submit"]');
  const snapshot = () => JSON.stringify([pkgInput.value, helperInput.value, extraInput.value, depInput.value, roadCheck.checked, nightCheck.checked, noteInput.value]), initial = snapshot();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextSim = read(), saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), sdmSim: nextSim }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('스드메·라크마 현장 추가금 시뮬레이터를 저장했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog('스드메 · 라크마 현장 추가금 시뮬레이터', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function renderSdmSimulator(ctx) {
  if (ctx.isGuestMode()) return null;
  const sim = ctx.getPrefs().sdmSim;
  const hasSim = Boolean(sim && (sim.packageFee !== null || sim.helperFee !== null || sim.extraFee !== null || sim.deposit !== null || sim.roadScene || sim.nightShoot || sim.note));
  const state = sdmEstimate(sim);
  return E('div', { class: 'sdm-sim-box' },
    E('div', { class: 'venue-sim-head' },
      E('div', {},
        E('strong', {}, '👗 스드메 · 라크마 촬영 현장 추가금 시뮬레이터'),
        E('p', { class: 'small muted' }, hasSim ? (sim.note || '입력값으로 계산한 스드메 시뮬레이션입니다. 미입력 항목은 0원으로 가정하지 않습니다.') : '스드메 기본 계약금, 라크마 공식 헬퍼비(25만 원·현금), 로드씬·야간촬영(각 17만 원), 원본·보정본 추가금을 합산해 보세요.')),
      E('div', { class: 'page-actions' },
        button(hasSim ? '스드메 시뮬레이터 수정' : '스드메 시뮬레이터 입력', () => openSdmSimulator(ctx), 'button quiet'),
        hasSim && state.complete ? button('계산 총액을 스드메 예산에 반영', () => {
          const nextPlan = structuredClone(ctx.getPrefs().budgetPlan || {});
          const curSdm = nextPlan.sdm || { planned: null, actual: null, note: '' };
          const optLabels = [sim.roadScene ? '로드씬 17만' : '', sim.nightShoot ? '야간촬영 17만' : ''].filter(Boolean).join('+');
          nextPlan.sdm = {
            planned: curSdm.planned ?? state.total,
            actual: state.total,
            note: curSdm.note || `스드메 기본 ${won(sim.packageFee)} + 헬퍼비 ${won(sim.helperFee)}${optLabels ? ` + ${optLabels}` : ''} + 추가금 ${won(sim.extraFee)}`
          };
          ctx.queuePreference(async () => {
            const saved = await ctx.savePrefs({ ...ctx.getPrefs(), budgetPlan: nextPlan });
            if (saved) { ctx.render(); ctx.toast(`스드메 시뮬레이션 총액(${won(state.total)})을 통합 예산 계산기에 반영했습니다.`); }
            return saved;
          });
        }, 'button quiet') : null)),
    hasSim ? E('div', { class: 'venue-sim-grid' },
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '당일 현장 현금 준비액'), E('strong', {}, state.onSiteCash === null ? '미확인 (헬퍼비 미입력)' : won(state.onSiteCash))),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '입력값 기준 소계'), E('strong', {}, won(state.subtotal))),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '입력값 기준 총액'), E('strong', {}, won(state.total))),
      E('div', { class: 'venue-sim-stat' }, E('span', { class: 'small muted' }, '계약금 차감 후 잔금'), E('strong', {}, won(state.balance)))) : null,
    hasSim && !state.complete ? E('p', { class: 'form-note' }, `총액 미확인 · 추가 입력 필요: ${state.missing.join(' · ')}. 통합 예산에 반영할 수 없습니다.`) : null,
    hasSim && state.complete && state.balance === null ? E('p', { class: 'small muted' }, '계약금 미입력 · 잔금 미확인') : null,
    state.overpaid ? E('p', { class: 'form-note' }, `계약금이 계산 총액보다 ${won(state.overpaid)} 많습니다. 입력값을 확인해 주세요.`) : null);
}

export function openBudgetEditor(ctx) {
  if (ctx.isGuestMode()) return;
  const prefs = ctx.getPrefs();
  const content = ctx.getContent();
  const current = structuredClone(prefs.budgetPlan || {});
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '입력한 결혼 준비 예산은 이 기기의 개인 설정에만 저장되며 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.'));
  const fields = {};
  const explicitTrip = content.honeymoon.find(t => t.id === prefs.tripSelected);
  const selectedTrip = explicitTrip || content.honeymoon[0];
  if (selectedTrip?.budget) {
    const tripTag = explicitTrip ? `최종 선택 '${selectedTrip.title}'` : `1순위 후보(선택 전) '${selectedTrip.title}'`;
    form.append(button(`✈️ ${tripTag} 2인 계획예산(${won(selectedTrip.budget)})을 신혼여행 목표 예산에 채우기`, () => {
      if (fields.honeymoon_planned) {
        fields.honeymoon_planned.value = String(selectedTrip.budget);
        ctx.toast(`'${selectedTrip.title}' 계획예산을 신혼여행 목표 예산 입력란에 채웠습니다.`);
      }
    }, 'button quiet'));
  }
  if (selectedTrip) {
    const tripQuote = quoteReview(selectedTrip);
    form.append(button(tripQuote.complete ? `✈️ '${selectedTrip.title}' 확인된 실제 견적 총액(${won(tripQuote.total)})을 신혼여행 실제·견적에 채우기` : '✈️ 신혼여행 확인 견적 불러오기', () => {
      if (!tripQuote.complete) {
        ctx.toast(`'${selectedTrip.title}' 후보의 실제 견적 필수 항목(${tripQuote.missing.join(' · ')})을 먼저 확인·입력해 주세요.`, true);
        return;
      }
      if (fields.honeymoon_actual) {
        fields.honeymoon_actual.value = String(tripQuote.total);
        if (!fields.honeymoon_planned.value.trim() && selectedTrip.budget) fields.honeymoon_planned.value = String(selectedTrip.budget);
        else if (!fields.honeymoon_planned.value.trim()) fields.honeymoon_planned.value = String(tripQuote.total);
        ctx.toast(`'${selectedTrip.title}' 확인된 실제 견적 총액(${won(tripQuote.total)})을 신혼여행 실제·견적 입력란에 채웠습니다.`);
      }
    }, 'button quiet'));
  }
  const sim = prefs.venueSim;
  const estimate = venueEstimate(sim), simTotal = estimate.total;
  form.append(button(estimate.complete ? `🏛️ 웨딩홀 시뮬레이터 총액(${won(simTotal)})을 웨딩홀 실제·견적에 채우기` : '🏛️ 웨딩홀 시뮬레이터 예상 총액 불러오기', () => {
    if (!estimate.complete) {
      ctx.toast(`웨딩홀 시뮬레이터에 필수 항목(${estimate.missing.join(' · ')})을 먼저 입력해 주세요.`, true);
      return;
    }
    if (fields.venue_actual) {
      fields.venue_actual.value = String(simTotal);
      if (!fields.venue_planned.value.trim()) fields.venue_planned.value = String(simTotal);
      ctx.toast('웨딩홀 시뮬레이터 총액을 웨딩홀 견적 입력란에 채웠습니다.');
    }
  }, 'button quiet'));
  const sdm = prefs.sdmSim;
  const sdmEst = sdmEstimate(sdm), sdmTotal = sdmEst.total;
  form.append(button(sdmEst.complete ? `👗 스드메 시뮬레이터 총액(${won(sdmTotal)})을 스드메 실제·견적에 채우기` : '👗 스드메 시뮬레이터 예상 총액 불러오기', () => {
    if (!sdmEst.complete) {
      ctx.toast(`스드메 시뮬레이터에 필수 항목(${sdmEst.missing.join(' · ')})을 먼저 입력해 주세요.`, true);
      return;
    }
    if (fields.sdm_actual) {
      fields.sdm_actual.value = String(sdmTotal);
      if (!fields.sdm_planned.value.trim()) fields.sdm_planned.value = String(sdmTotal);
      ctx.toast('스드메 시뮬레이터 총액을 스드메 견적 입력란에 채웠습니다.');
    }
  }, 'button quiet'));
  for (const [key, title, , desc] of WEDDING_BUDGET_CATEGORIES) {
    const entry = current[key] || { planned: null, actual: null, note: '' };
    const pInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: `budget-${key}-planned`, placeholder: '예: 15000000' });
    pInput.value = entry.planned ?? '';
    const aInput = E('input', { type: 'number', min: '0', max: '1000000000', step: '1', id: `budget-${key}-actual`, placeholder: '예: 14200000' });
    aInput.value = entry.actual ?? '';
    const nInput = E('input', { type: 'text', maxlength: '300', id: `budget-${key}-note`, placeholder: desc });
    nInput.value = entry.note || '';
    fields[`${key}_planned`] = pInput;
    fields[`${key}_actual`] = aInput;
    fields[`${key}_note`] = nInput;
    form.append(E('fieldset', { class: 'stay-edit-row' },
      E('legend', {}, title),
      E('div', { class: 'field-row' },
        E('label', { class: 'field', for: pInput.id }, '목표 예산 (원)', pInput),
        E('label', { class: 'field', for: aInput.id }, '실제 지출·계약 견적 (원)', aInput)),
      E('label', { class: 'field', for: nInput.id }, '세부 메모 (선택)', nInput)));
  }
  const submit = E('button', { class: 'button', type: 'submit' }, '예산 계산기 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextPlan = {};
      for (const [key] of WEDDING_BUDGET_CATEGORIES) {
        const pRaw = fields[`${key}_planned`].value.trim();
        const aRaw = fields[`${key}_actual`].value.trim();
        const note = fields[`${key}_note`].value.trim();
        const planned = pRaw === '' ? null : Math.round(Number(pRaw));
        const actual = aRaw === '' ? null : Math.round(Number(aRaw));
        if (planned !== null || actual !== null || note) {
          nextPlan[key] = { planned, actual, ...(note ? { note } : {}) };
        }
      }
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), budgetPlan: nextPlan }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('결혼 준비 예산 계산기를 저장했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  const snapshot = () => JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k, node]) => [k, node.value])));
  const initial = snapshot();
  if (ctx.showDialog('결혼 준비 통합 예산 계산기 편집', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function renderBudgetCalculator(ctx) {
  if (ctx.isGuestMode()) return null;
  const plan = ctx.getPrefs().budgetPlan || {};
  const rows = WEDDING_BUDGET_CATEGORIES.map(([key, title, cls, desc]) => {
    const item = plan[key] || { planned: null, actual: null, note: '' };
    return { key, title, cls, desc, planned: item.planned ?? null, actual: item.actual ?? null, note: item.note || '' };
  });
  const budget = weddingBudgetSummary(plan, WEDDING_BUDGET_CATEGORIES.map(([key]) => key));
  const totalPlanned = budget.planned.known;
  const hasAny = rows.some(r => r.planned !== null || r.actual !== null || r.note);
  const diff = budget.difference;
  return E('section', { class: 'wedding-budget-calc', 'aria-labelledby': 'wedding-budget-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'PRIVATE BUDGET PLANNER'),
        E('h2', { id: 'wedding-budget-title' }, '결혼 준비 통합 예산 계산기'),
        E('p', {}, '웨딩홀·스드메·본식·예물·신혼여행·혼수 6대 항목의 목표 예산과 실제 지출을 이 기기에서 한눈에 관리하세요.')),
      E('div', { class: 'page-actions' },
        button(hasAny ? '예산 입력·수정' : '첫 예산표 작성하기', () => openBudgetEditor(ctx), 'button quiet'))),
    hasAny ? E('div', { class: 'budget-calc-body' },
      E('div', { class: 'budget-summary-cards' },
        E('div', { class: 'budget-stat-card' }, E('span', { class: 'small muted' }, `목표 예산 ${budget.planned.complete ? '합계' : '입력 소계'}`), E('strong', {}, totalPlanned === null ? '미입력' : won(totalPlanned))),
        E('div', { class: 'budget-stat-card' }, E('span', { class: 'small muted' }, `실제 지출·계약 ${budget.actual.complete ? '합계' : '입력 소계'}`), E('strong', {}, budget.actual.known === null ? '미입력' : won(budget.actual.known))),
        E('div', { class: 'budget-stat-card' + (diff !== null && diff < 0 ? ' over' : '') }, E('span', { class: 'small muted' }, '예산 대비 잔액·차액'), E('strong', {}, diff === null ? '미확인' : diff >= 0 ? `여유 ${won(diff)}` : `초과 ${won(-diff)}`))),
      E('p', { class: 'form-note' }, `목표 ${budget.planned.entered}/6개 · 실제·견적 ${budget.actual.entered}/6개 입력. 미입력: 목표 ${budget.planned.missing}개 · 실제·견적 ${budget.actual.missing}개. 빈칸은 0원이 아닙니다. 6대 항목의 목표와 실제·견적이 모두 입력되어야 차액을 계산합니다. 없는 비용은 확인 후 0을 입력해 주세요.`),
      totalPlanned > 0 ? E('div', { class: 'trip-budget-visual' },
        E('div', { class: 'budget-visual-head' }, E('span', { class: 'small muted' }, '목표 예산 항목별 비중'), E('strong', { class: 'small' }, `총 ${won(totalPlanned)}`)),
        E('div', { class: 'budget-bar-track', 'aria-hidden': 'true' },
          rows.filter(r => r.planned > 0).map(r => {
            const pct = Math.max(4, Math.round((r.planned / totalPlanned) * 100));
            return E('span', { class: `budget-seg ${r.cls}`, style: `width:${pct}%`, title: `${r.title}: ${won(r.planned)}` });
          })),
        E('div', { class: 'budget-legend budget-legend-6' },
          rows.map(r => E('span', { class: 'legend-item' },
            E('span', { class: `legend-dot ${r.cls}`, 'aria-hidden': 'true' }),
            E('span', { class: 'legend-label' }, r.title.replace(/^[^\s]+\s*/, '')),
            E('strong', { class: 'legend-val' }, r.planned === null ? '미입력' : `${Math.round(r.planned / 10000).toLocaleString('ko-KR')}만`))))) : null,
      E('div', { class: 'budget-category-grid' }, rows.map(r => E('article', { class: 'budget-cat-card' },
        E('strong', { class: 'budget-cat-title' }, r.title),
        E('dl', { class: 'budget-cat-dl' },
          E('dt', {}, '목표 예산'), E('dd', {}, r.planned === null ? '미입력' : won(r.planned)),
          E('dt', {}, '실제·견적'), E('dd', {}, r.actual === null ? '미입력' : won(r.actual))),
        r.note ? E('p', { class: 'small muted' }, r.note) : E('p', { class: 'small muted' }, r.desc)))))
      : E('div', { class: 'budget-empty-prompt' },
        E('p', { class: 'small muted' }, '아직 입력한 결혼 예산 항목이 없습니다. 오른쪽 위의 ‘첫 예산표 작성하기’ 버튼을 눌러 신혼여행 계획예산과 웨딩홀·스드메 예산을 함께 정리해 보세요.')),
    renderVenueSimulator(ctx),
    renderSdmSimulator(ctx));
}

export function openVendorScheduleEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing && existing.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '업체 일정·촬영일·피팅·잔금 예정일은 이 기기의 개인 설정에만 저장되며 방문자용 화면이나 공개 저장소에는 노출되지 않습니다. 계좌번호·주민등록번호·비밀번호 등 민감 정보는 입력하지 마세요.'));
  const catSelect = E('select', { id: 'vendor-sched-cat' }, VENDOR_CATEGORIES.map(c => E('option', { value: c }, c)));
  if (isEdit && VENDOR_CATEGORIES.includes(existing.category)) catSelect.value = existing.category;
  const nameInput = E('input', { type: 'text', maxlength: '120', id: 'vendor-sched-name', required: 'true', placeholder: '예: 라크마 스튜디오 웨딩촬영 (낮 12시) / 드레스 가봉 / 본식스냅 잔금' });
  nameInput.value = existing?.name || '';
  const dateInput = E('input', { type: 'date', id: 'vendor-sched-date' });
  dateInput.value = existing?.date || '';
  const doneCheck = E('input', { type: 'checkbox', id: 'vendor-sched-done' });
  doneCheck.checked = Boolean(existing?.done);
  const noteInput = E('textarea', { rows: '3', maxlength: '500', id: 'vendor-sched-note', placeholder: '예: 2/3(수) 12:00 촬영 · 08:30 메이크업 샵 집결 · 헬퍼비 봉투 및 생화 부케 지참' });
  noteInput.value = existing?.note || '';
  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: catSelect.id }, '일정·업체 분류', catSelect),
      E('label', { class: 'field', for: dateInput.id }, '예정 날짜 (선택)', dateInput)),
    E('label', { class: 'field', for: nameInput.id }, '업체·일정 이름', nameInput),
    E('label', { class: 'field', for: noteInput.id }, '일정·준비물·정산 메모 (선택)', noteInput),
    E('label', { class: 'check-label', for: doneCheck.id }, doneCheck, '완료됨 (촬영·투어·정산 완료 표시)'),
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, isEdit ? '일정 저장' : '일정 추가'))
  );
  const submit = form.querySelector('[type="submit"]');
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const name = nameInput.value.trim();
    if (!name) return;
    const curList = activeVendorSchedules(ctx.getPrefs());
    if (!isEdit && curList.length >= 60) { ctx.toast('업체·촬영 일정은 60개까지 등록할 수 있습니다.', true); return; }
    const id = isEdit ? existing.id : 'vsched-' + crypto.randomUUID().slice(0, 8);
    const entry = { id, category: catSelect.value, name, date: dateInput.value || '', done: doneCheck.checked, note: noteInput.value.trim() };
    const nextList = isEdit ? curList.map(v => (v.id === id ? entry : v)) : [...curList, entry];
    saving = true;
    submit.disabled = true;
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), vendorSchedules: nextList }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast(isEdit ? '업체·촬영 일정을 수정했습니다.' : '업체·촬영 일정을 추가했습니다.'); }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  const snapshot = () => JSON.stringify([catSelect.value, nameInput.value, dateInput.value, doneCheck.checked, noteInput.value]), initial = snapshot();
  if (ctx.showDialog(isEdit ? '주요 업체·촬영·잔금 일정 수정' : '주요 업체·촬영·잔금 일정 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function renderVendorScheduleBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const list = activeVendorSchedules(ctx.getPrefs());
  const sorted = [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
  const doneCount = list.filter(v => v.done).length;
  const toggleDone = (item, box) => {
    const nextList = activeVendorSchedules(ctx.getPrefs()).map(v => (v.id === item.id ? { ...v, done: box.checked } : v));
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), vendorSchedules: nextList });
      if (saved) ctx.render();
      else box.checked = item.done;
      return saved;
    });
  };
  return E('section', { class: 'vendor-schedule-board', 'aria-labelledby': 'vendor-schedule-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'VENDOR & SHOOT SCHEDULE BOARD'),
        E('h2', { id: 'vendor-schedule-title' }, '📅 주요 업체 일정 · 촬영 · 잔금 체크 보드'),
        E('p', {}, '스튜디오 촬영일(2/3 수 12:00 라크마 확정), 드레스 피팅·가봉, 웨딩홀 시식·최종 보증인원 확정, 본식스냅 잔금 등 주요 일정을 날짜순으로 관리합니다. (이 기기에만 저장 · 계좌번호·주민번호 등 민감 정보 입력 금지)')),
      E('div', { class: 'page-actions' },
        E('span', { class: 'badge' }, `${doneCount}/${list.length} 완료`),
        button('+ 일정 추가', () => openVendorScheduleEditor(ctx), 'button quiet'))),
    sorted.length ? E('ul', { class: 'vendor-schedule-list' }, sorted.map(item => {
      const dday = item.date ? weddingDday(item.date) : null;
      const box = E('input', { type: 'checkbox', 'aria-label': `${item.name} 완료 표시` });
      box.checked = Boolean(item.done);
      box.addEventListener('change', () => toggleDone(item, box));
      const isLachmaShoot = item.id === 'vsched-lachma-shoot';
      const calSpec = item.date ? {
        uid: item.id || 'vendor',
        summary: `[결혼준비] ${item.name}`,
        date: item.date,
        time: isLachmaShoot ? '12:00' : '',
        location: isLachmaShoot ? '광주광역시 남구 중앙로 117 라크마 스튜디오' : '',
        description: [
          `분류: ${item.category}`,
          isLachmaShoot && !(item.note || '').includes('중앙로 117') ? 'STEP 1 루나메이크업(광주 남구 천변좌로 432 1층) → STEP 2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수)' : '',
          item.note || ''
        ].filter(Boolean).join('\n')
      } : null;
      const gcalUrl = calSpec ? scheduleGoogleCalendarUrl(calSpec) : null;
      return E('li', { class: 'vendor-schedule-item' + (item.done ? ' done' : '') },
        E('div', { class: 'vendor-schedule-main' },
          E('label', { class: 'vendor-schedule-check' }, box),
          E('div', { class: 'vendor-schedule-info' },
            E('div', { class: 'vendor-schedule-top' },
              E('span', { class: 'spec-chip' }, item.category),
              item.date ? E('span', { class: 'spec-chip highlight' }, `🗓️ ${formatDate(item.date)}`) : E('span', { class: 'spec-chip' }, '날짜 미정'),
              dday && !item.done ? E('span', { class: 'spec-chip direct' }, `⏳ ${dday}`) : null,
              item.done ? E('span', { class: 'spec-chip' }, '✓ 완료') : null),
            E('strong', { class: 'vendor-schedule-name' }, item.name),
            item.note ? E('p', { class: 'small muted vendor-schedule-note' }, item.note) : null)),
        E('div', { class: 'vendor-schedule-actions' },
          gcalUrl ? externalLink('📅 Google 캘린더 ↗', gcalUrl, 'checklist-note-btn') : null,
          calSpec ? button('📥 .ics', () => {
            try {
              const ics = scheduleCalendar(calSpec);
              downloadText(ics, `${item.id || 'vendor-schedule'}.ics`, 'text/calendar;charset=utf-8');
              ctx.toast(`‘${item.name}’ 일정 파일(.ics)을 다운로드했습니다.`);
            } catch (error) { ctx.toast(error.message, true); }
          }, 'checklist-note-btn') : null,
          button('수정', () => openVendorScheduleEditor(ctx, item), 'checklist-note-btn'),
          button('삭제', () => {
            if (!confirm(`‘${item.name}’ 일정을 삭제할까요?`)) return;
            ctx.queuePreference(async () => {
              const nextList = activeVendorSchedules(ctx.getPrefs()).filter(v => v.id !== item.id);
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), vendorSchedules: nextList });
              if (saved) { ctx.render(); ctx.toast('일정을 삭제했습니다.'); }
              return saved;
            });
          }, 'checklist-note-btn danger-text')));
    })) : E('p', { class: 'small muted' }, '등록된 업체·촬영 일정이 없습니다. 오른쪽 위 ‘+ 일정 추가’ 버튼으로 주요 일정을 기록해 보세요.'));
}

function tipFavoriteButton(ctx, item) {
  if (ctx.isGuestMode()) return null;
  const pressed = Boolean(ctx.getPrefs().tipFavorites?.includes(item.id));
  return E('button', {
    class: 'favorite',
    type: 'button',
    'data-tip-id': item.id,
    'aria-label': `${item.title} 관심 꿀팁 ${pressed ? '해제' : '등록'}`,
    'aria-pressed': String(pressed),
    onclick: () => {
      ctx.queuePreference(async () => {
        const set = new Set(ctx.getPrefs().tipFavorites || []);
        set.has(item.id) ? set.delete(item.id) : set.add(item.id);
        const saved = await ctx.savePrefs({ ...ctx.getPrefs(), tipFavorites: [...set] });
        if (saved) {
          if (tipFavoritesOnly) redrawTips();
          else {
            for (const node of document.querySelectorAll(`[data-tip-id="${item.id}"]`)) {
              const now = Boolean(ctx.getPrefs().tipFavorites?.includes(item.id));
              node.setAttribute('aria-pressed', String(now));
              node.setAttribute('aria-label', `${item.title} 관심 꿀팁 ${now ? '해제' : '등록'}`);
              node.textContent = now ? '♥' : '♡';
            }
          }
        }
        return saved;
      });
    }
  }, pressed ? '♥' : '♡');
}

function openTipNoteModal(ctx, item) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  const currentNote = ctx.getPrefs().tipNotes?.[item.id] || '';
  const input = E('textarea', { rows: '3', id: 'tip-note-input', maxlength: '500', placeholder: '예: 드레스 투어 때 실크 2벌·비즈 2벌 피팅 요청하기' });
  input.value = currentNote;
  form.append(
    E('p', { class: 'form-note' }, `‘${item.title}’ 꿀팁에서 우리 결혼 준비에 적용할 내용을 이 기기에만 메모합니다. 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.`),
    E('label', { class: 'field', for: input.id }, '꿀팁 실천 메모', input));
  const submit = E('button', { class: 'button', type: 'submit' }, '실천 메모 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextNotes = { ...(ctx.getPrefs().tipNotes || {}) };
      if (input.value.trim()) nextNotes[item.id] = input.value.trim();
      else delete nextNotes[item.id];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), tipNotes: nextNotes }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('꿀팁 실천 메모를 저장했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog('꿀팁 실천 메모 편집', form)) {
    ctx.setEditorState({ isDirty: () => saving || input.value !== currentNote, isSaving: () => saving });
  }
}

let tipVisibleLimit = 12;
const TIP_PAGE_STEP = 12;

export function renderTips(ctx) {
  const guestMode = ctx.isGuestMode();
  if (guestMode) return ctx.guestRestrictedView('결혼에 관한 모든 정보', '신랑·신부의 결혼 준비 예산·일정·꿀팁을 관리하는 공간입니다.', 'WEDDING GUIDE');
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();

  const bPlan = prefs.budgetPlan || {};
  const bSummary = weddingBudgetSummary(bPlan, WEDDING_BUDGET_CATEGORIES.map(([key]) => key));
  const budgetBadge = bSummary.planned.known !== null
    ? `${Math.round(bSummary.planned.known / 10000).toLocaleString('ko-KR')}만`
    : '미입력';
  const vList = activeVendorSchedules(prefs);
  const vDone = vList.filter(v => v.done).length;
  const hList = prefs.homeItems || [];
  const hDone = hList.filter(i => i.status === '배송·설치 완료').length;
  const bDone = (prefs.benefitChecks || []).filter(id => BENEFIT_CHECK_ITEMS.some(([bid]) => bid === id)).length;

  const subTabs = [
    ['tips', '🎬 결혼 꿀팁', `${content.tips.length}건`],
    ['budget', '💰 통합 예산', budgetBadge],
    ['schedule', '🗓️ 업체 일정', `${vDone}/${vList.length}`],
    ['home', '🏠 혼수·가전', hList.length ? `${hDone}/${hList.length}` : '관리'],
    ['benefits', '🏛️ 혼인신고·혜택', `${bDone}/${BENEFIT_CHECK_ITEMS.length}`]
  ];
  const subTabBar = E('div', { class: 'subtab-bar prenatal-subtabs', role: 'tablist', 'aria-label': '결혼 정보·예산·일정·혼수·혜택 화면 전환' },
    subTabs.map(([key, label, badge]) => {
      const selected = tipsSubTab === key;
      return E('button', {
        type: 'button',
        role: 'tab',
        class: 'subtab-btn' + (selected ? ' is-active' : ''),
        'aria-selected': String(selected),
        'data-tips-tab': key,
        onclick: () => {
          tipsSubTab = key;
          ctx.render();
          document.querySelector(`[data-tips-tab="${key}"]`)?.focus({ preventScroll: true });
        }
      }, E('span', { class: 'subtab-label' }, label), E('span', { class: 'subtab-badge' }, badge));
    }));

  if (tipsSubTab === 'budget') {
    return [
      ctx.pageHeader('결혼에 관한 모든 정보', '6대 결혼 예산·웨딩홀 식대·스드메 현장 추가금을 한눈에 시뮬레이션해요.', null, 'WEDDING GUIDE'),
      subTabBar,
      renderBudgetCalculator(ctx)
    ];
  }
  if (tipsSubTab === 'schedule') {
    return [
      ctx.pageHeader('결혼에 관한 모든 정보', '라크마 웨딩촬영부터 피팅·시식·잔금 일정까지 날짜순으로 챙겨요.', null, 'WEDDING GUIDE'),
      subTabBar,
      renderVendorScheduleBoard(ctx)
    ];
  }
  if (tipsSubTab === 'home') {
    return [
      ctx.pageHeader('결혼에 관한 모든 정보', '신혼집 가전·가구 품목별 견적·계약금·배송일을 관리하고 통합 예산에 연동해요.', null, 'NEWLYWED HOME'),
      subTabBar,
      renderHomeItemsBoard(ctx)
    ];
  }
  if (tipsSubTab === 'benefits') {
    return [
      ctx.pageHeader('결혼에 관한 모든 정보', '순천시청 신청사 혼인신고 절차와 순천시·전남·정부 신혼부부 핵심 혜택을 한눈에 챙겨요.', null, 'MARRIAGE BENEFITS'),
      subTabBar,
      renderBenefitsGuideBoard(ctx)
    ];
  }

  const categories = ['all', ...new Set(content.tips.map(item => item.category || '기타'))];
  if (!categories.includes(tipCategory)) tipCategory = 'all';
  const favCheck = E('input', { type: 'checkbox', id: 'tip-favorites-only' });
  favCheck.checked = tipFavoritesOnly;
  const noteCheck = E('input', { type: 'checkbox', id: 'tip-notes-only' });
  noteCheck.checked = withTipNoteOnly;
  const count = E('span', { class: 'small muted', 'aria-live': 'polite' });
  const resetWrap = E('span', { class: 'filter-reset-slot' });
  const catBar = E('div', { class: 'tip-categories', role: 'group', 'aria-label': '꿀팁 분야 선택' });
  const grid = E('section', { class: 'tips-grid', id: 'tips-results' });
  const pagerWrap = E('div', { class: 'list-pager-bar' });

  const search = searchBox({
    id: 'tip-search',
    value: tipFilter,
    placeholder: '꿀팁 제목·분야·핵심 키워드 검색',
    ariaLabel: '결혼 정보 꿀팁 검색',
    onInput: val => { tipFilter = val; tipVisibleLimit = TIP_PAGE_STEP; draw(); }
  });

  const resetTipFilters = () => {
    tipFilter = '';
    tipCategory = 'all';
    tipFavoritesOnly = false;
    withTipNoteOnly = false;
    tipVisibleLimit = TIP_PAGE_STEP;
    search.input.value = '';
    search.syncClear();
    favCheck.checked = false;
    noteCheck.checked = false;
    draw();
  };

  const draw = () => {
    catBar.replaceChildren(...categories.map(cat => {
      const total = cat === 'all' ? content.tips.length : content.tips.filter(item => (item.category || '기타') === cat).length;
      const label = cat === 'all' ? `전체 (${total})` : `${cat} (${total})`;
      const btn = button(label, () => { tipCategory = cat; tipVisibleLimit = TIP_PAGE_STEP; draw(); }, 'button quiet');
      btn.setAttribute('aria-pressed', String(tipCategory === cat));
      return btn;
    }));
    const activeCount = [
      tipCategory !== 'all',
      tipFavoritesOnly,
      withTipNoteOnly,
      Boolean(tipFilter.trim())
    ].filter(Boolean).length;
    resetWrap.replaceChildren(...(activeCount ? [button(`✕ 필터 초기화 (${activeCount})`, resetTipFilters, 'filter-reset-chip')] : []));

    const list = filteredTips(ctx);
    const shown = list.slice(0, tipVisibleLimit);
    count.textContent = list.length > shown.length ? `${shown.length} / ${list.length}개의 꿀팁` : `${list.length}개의 꿀팁`;
    grid.replaceChildren(...(shown.length ? shown.map(item => {
      const num = content.tips.findIndex(t => t.id === item.id) + 1;
      const hasYt = Boolean(youtubeVideoId(item.url));
      const note = !guestMode ? (prefs.tipNotes?.[item.id] || '') : '';
      return E('article', { class: 'tip-card', 'data-record-id': item.id },
        E('div', { class: 'card-heading' },
          E('div', { class: 'tip-meta' }, E('span', { class: 'badge' }, item.category || '결혼 꿀팁'), E('span', { class: 'small muted' }, `#${String(num).padStart(2, '0')}${item.channel ? ` · ${item.channel}` : ''}`)),
          tipFavoriteButton(ctx, item)),
        youtubeThumbBanner(item.url, item.title),
        E('h2', {}, item.title),
        item.body ? E('p', { class: 'record-body' }, item.body) : null,
        note ? E('p', { class: 'checklist-item-note small tip-private-note' }, `📝 실천 메모: ${note}`) : null,
        E('div', { class: 'tip-actions' },
          E('div', { class: 'tip-link-group' },
            hasYt ? button('▶ 앱 내 재생', () => openYoutubeModal(ctx, item.url, item.title), 'button') : null,
            externalLink(isYoutubeUrl(item.url) ? '유튜브 새 탭 ↗' : '참고 링크 열기 ↗', item.url, 'button quiet'),
            !guestMode ? button(note ? '📝 메모 수정' : '📝 메모', () => openTipNoteModal(ctx, item), 'button quiet') : null),
          ctx.recordActions('tips', item)));
    }) : [E('div', { class: 'no-results-box' },
      E('p', { class: 'no-results' }, tipFavoritesOnly && !withTipNoteOnly ? '등록한 관심 꿀팁이 없습니다.' : withTipNoteOnly && !tipFavoritesOnly ? '실천 메모를 남긴 꿀팁이 없습니다.' : '검색 조건에 맞는 결혼 정보 꿀팁이 없습니다.'),
      activeCount ? button('모든 필터 초기화', resetTipFilters, 'button quiet') : null)]));

    const remaining = list.length - shown.length;
    if (remaining > 0) {
      const step = Math.min(TIP_PAGE_STEP, remaining);
      pagerWrap.hidden = false;
      pagerWrap.replaceChildren(...[
        button(`꿀팁 ${step}건 더 보기 (남은 ${remaining}건)`, () => { tipVisibleLimit += TIP_PAGE_STEP; draw(); }, 'button quiet'),
        remaining > TIP_PAGE_STEP ? button(`전체 ${list.length}건 모두 보기`, () => { tipVisibleLimit = list.length; draw(); }, 'text-button') : null
      ].filter(Boolean));
    } else if (list.length > TIP_PAGE_STEP) {
      pagerWrap.hidden = false;
      pagerWrap.replaceChildren(
        E('span', { class: 'small muted' }, `전체 ${list.length}건을 모두 보고 있어요.`),
        button('처음 12건만 보기', () => { tipVisibleLimit = TIP_PAGE_STEP; draw(); document.querySelector('.tips-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 'text-button')
      );
    } else {
      pagerWrap.hidden = true;
      pagerWrap.replaceChildren();
    }
  };
  favCheck.addEventListener('change', () => { tipFavoritesOnly = favCheck.checked; tipVisibleLimit = TIP_PAGE_STEP; draw(); });
  noteCheck.addEventListener('change', () => { withTipNoteOnly = noteCheck.checked; tipVisibleLimit = TIP_PAGE_STEP; draw(); });
  redrawTips = draw;
  draw();
  return [
    ctx.pageHeader('결혼에 관한 모든 정보', '결혼 준비 꿀팁 영상 50선, 통합 예산·시뮬레이터, 주요 업체 일정을 탭으로 깔끔하게 나누어 관리해요.', ctx.editButton('꿀팁 추가', () => ctx.openEditor('tips')), 'WEDDING GUIDE'),
    subTabBar,
    content.tips.length
      ? E('section', { class: 'tips-directory' },
        catBar,
        E('div', { class: 'directory-controls' },
          search.wrap,
          E('div', { class: 'directory-filters' },
            E('label', { class: 'check-label', for: 'tip-favorites-only' }, favCheck, '관심 꿀팁만 보기'),
            E('label', { class: 'check-label', for: 'tip-notes-only' }, noteCheck, '📝 메모 남긴 꿀팁만 보기'),
            resetWrap,
            count)),
        grid,
        pagerWrap)
      : ctx.empty('첫 결혼 준비 꿀팁을 남겨 볼까요?', '도움이 되었던 유튜브 영상이나 체크리스트를 추가해 둘 수 있어요.', '꿀팁 추가하기', () => ctx.openEditor('tips'))
  ];
}
