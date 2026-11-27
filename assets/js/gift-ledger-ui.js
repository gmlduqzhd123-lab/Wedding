import { E, button, downloadText, searchBox } from './dom.js?v=wedding-features-75';
import { formatDate } from './content.js?v=wedding-features-75';
import { GUEST_SIDES, GUEST_GROUPS, GIFT_CHANNELS } from './preferences.js?v=wedding-features-75';
import { giftLedgerSummary, giftsToCsv, parseGiftsCsv, parseQuickGiftText, syncGiftsFromImport, buildThankYouMessage, crossCheckGuestsAndGifts } from './planning.js?v=wedding-features-75';
import { renderSideRatioBar } from './charts.js?v=wedding-features-75';

let giftSideFilter = 'all';
let giftChannelFilter = 'all';
let giftPendingOnly = false;
let giftUnthankedOnly = false;
let giftUnmatchedOnly = false;
let giftQuery = '';
let quickEntrySide = '신랑 측';
let quickEntryChannel = '축의대(현금)';

export function focusGiftSearch(query = '') {
  giftSideFilter = 'all';
  giftChannelFilter = 'all';
  giftPendingOnly = false;
  giftUnthankedOnly = false;
  giftUnmatchedOnly = false;
  giftQuery = String(query || '');
}

const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

export function printDedicatedSheet(bodyClass, sheetNode) {
  document.querySelectorAll('.print-only-sheet').forEach(el => el.remove());
  document.body.classList.remove('print-guest-sheet', 'print-gift-sheet');
  document.body.appendChild(sheetNode);
  document.body.classList.add(bodyClass);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove(bodyClass);
    sheetNode.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}

function buildGiftPrintSheet(ctx, list) {
  const info = ctx.getContent()?.invitation || {};
  const couple = [info.partner1, info.partner2].filter(Boolean).join(' · ') || '웨딩 축의금 정산';
  const when = [info.date ? formatDate(info.date) : '', info.time || '', info.venue || ''].filter(Boolean).join(' · ');
  const summary = giftLedgerSummary(list);
  const sideOrder = { '신랑 측': 0, '신부 측': 1, '공통': 2 };
  const sorted = [...list].sort((a, b) =>
    (sideOrder[a.side] ?? 9) - (sideOrder[b.side] ?? 9) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
  );
  return E('section', { class: 'print-only-sheet gift-print-sheet', 'aria-label': '축의금 정산표 인쇄 양식' },
    E('header', { class: 'print-sheet-header' },
      E('div', {},
        E('p', { class: 'print-sheet-eyebrow' }, 'WEDDING GIFT SETTLEMENT SHEET'),
        E('h1', {}, `${couple} · 축의금 · 식권 정산표`),
        when ? E('p', { class: 'print-sheet-meta' }, when) : null),
      E('div', { class: 'print-sheet-kpis' },
        E('span', {}, `총 ${summary.totalRecords}건`),
        E('span', {}, `합계 ${won(summary.totalAmount)}`),
        E('span', {}, `신랑 측 ${won(summary.bySide['신랑 측'].amount)}`),
        E('span', {}, `신부 측 ${won(summary.bySide['신부 측'].amount)}`),
        E('span', {}, `식권 ${summary.totalMealTickets}매`))),
    E('div', { class: 'print-sheet-subsummary' },
      E('span', {}, `현금(축의대): ${won(summary.byChannel['축의대(현금)'].amount)} (${summary.byChannel['축의대(현금)'].count}건)`),
      E('span', {}, `계좌이체: ${won(summary.byChannel['계좌이체'].amount)} (${summary.byChannel['계좌이체'].count}건)`),
      E('span', {}, `선물·기타: ${won(summary.byChannel['선물·기타'].amount)} (${summary.byChannel['선물·기타'].count}건)`),
      E('span', {}, `답례품 미전달 ${summary.returnGiftPending}건 · 감사 미완료 ${summary.thankYouPending}건`)),
    E('table', { class: 'print-sheet-table' },
      E('thead', {},
        E('tr', {},
          ['번호', '양가', '관계', '성함', '전달 방식', '축의금', '식권', '답례품', '감사인사', '메모'].map(col => E('th', { scope: 'col' }, col)))),
      E('tbody', {},
        sorted.map((item, idx) => E('tr', {},
          E('td', { class: 'num' }, String(idx + 1)),
          E('td', {}, item.side || ''),
          E('td', {}, item.group || ''),
          E('td', { class: 'strong' }, item.name || ''),
          E('td', {}, item.channel || ''),
          E('td', { class: 'num strong' }, won(item.amount)),
          E('td', { class: 'num' }, `${item.mealTickets ?? 0}매`),
          E('td', { class: 'num' }, item.returnGiftDone ? '✓' : '□'),
          E('td', { class: 'num' }, item.thankYouDone ? '✓' : '□'),
          E('td', {}, item.note || '')))),
      E('tfoot', {},
        E('tr', {},
          E('th', { scope: 'row', colspan: '5' }, `합계 (${summary.totalRecords}건)`),
          E('td', { class: 'num strong' }, won(summary.totalAmount)),
          E('td', { class: 'num strong' }, `${summary.totalMealTickets}매`),
          E('td', { colspan: '3' }, `감사 미완료 ${summary.thankYouPending}건 · 답례품 미전달 ${summary.returnGiftPending}건`)))),
    E('p', { class: 'print-sheet-foot' }, '※ 본 정산표는 이 기기 개인 설정에서 인쇄한 문서입니다. 공개 저장소나 외부에 업로드하지 마세요.'));
}

export function openThankYouModal(ctx, gift) {
  if (ctx.isGuestMode() || !gift) return;
  const info = ctx.getContent()?.invitation || {};
  let variant = (gift.channel === '계좌이체' && Number(gift.mealTickets || 0) === 0) ? 'remote' : 'attended';
  const ta = E('textarea', { rows: '9', id: 'thank-you-msg-text', 'aria-label': `${gift.name}님 감사 인사 문구` });
  ta.value = buildThankYouMessage(gift, info, variant);

  const variantBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '감사 인사 상황 선택' });
  const drawTabs = () => {
    variantBar.replaceChildren(...[
      ['attended', '💐 참석 하객 감사 인사'],
      ['remote', '💌 불참·마음 전달 감사 인사']
    ].map(([key, label]) => {
      const btn = button(label, () => {
        variant = key;
        ta.value = buildThankYouMessage(gift, info, variant);
        drawTabs();
        ta.focus({ preventScroll: true });
      }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(variant === key));
      return btn;
    }));
  };
  drawTabs();

  const copyAndMarkBtn = button(gift.thankYouDone ? '📋 문구 복사 (감사완료됨)' : '📋 복사 + 감사완료 체크', async () => {
    const text = ta.value.trim();
    if (!text) return;
    const copied = await ctx.copyTextToClipboard(text, `${gift.name}님 감사 인사 문구를 복사했습니다.`, '감사 인사 복사');
    if (!gift.thankYouDone) {
      const saved = await ctx.queuePreference(async () => {
        const cur = ctx.getPrefs().giftLedger || [];
        const next = cur.map(item => (item.id === gift.id ? { ...item, thankYouDone: true } : item));
        return ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
      });
      if (saved) {
        if (copied) ctx.closeDialog();
        ctx.render();
        ctx.toast(copied ? `${gift.name}님 감사 문구를 복사하고 ‘감사인사 완료’로 표시했습니다.` : `${gift.name}님을 ‘감사인사 완료’로 표시했습니다. 열린 창에서 문구를 복사해 주세요.`);
      }
    }
  }, 'button');

  const body = E('div', { class: 'editor-form share-msg-modal' },
    E('p', { class: 'form-note' }, `${gift.name}님(${gift.side} · ${gift.channel} · ${won(gift.amount)})에게 보낼 감사 인사 문구입니다. 필요에 맞게 내용을 다듬은 뒤 복사해 카카오톡이나 문자로 보내세요.`),
    variantBar,
    E('label', { class: 'field', for: ta.id }, '감사 인사 문구 (수정 가능)', ta),
    E('div', { class: 'page-actions' },
      copyAndMarkBtn,
      button('문구만 복사', () => ctx.copyTextToClipboard(ta.value.trim(), `${gift.name}님 감사 문구를 복사했습니다.`, '감사 인사 복사'), 'button quiet'),
      button('닫기', ctx.closeDialog, 'button quiet')));

  ctx.showDialog(`💬 ${gift.name}님 감사 인사 문구`, body);
}

export function openBatchThankYouModal(ctx) {
  if (ctx.isGuestMode()) return;
  const info = ctx.getContent()?.invitation || {};
  const initialQueue = (ctx.getPrefs().giftLedger || []).filter(item => !item.thankYouDone);
  if (!initialQueue.length) {
    ctx.toast('모든 하객에게 감사 인사를 완료했습니다! 🎉');
    return;
  }
  const queueIds = initialQueue.map(item => item.id);
  const doneIds = new Set();
  let cursor = 0;
  let busy = false;
  const body = E('div', { class: 'editor-form share-msg-modal batch-thankyou-modal' });

  const findGift = id => (ctx.getPrefs().giftLedger || []).find(item => item.id === id) || initialQueue.find(item => item.id === id);

  const draw = () => {
    const remainingIds = queueIds.filter(id => !doneIds.has(id));
    if (!remainingIds.length) {
      body.replaceChildren(
        E('div', { class: 'batch-thankyou-done' },
          E('p', { class: 'eyebrow' }, 'ALL THANK-YOU MESSAGES SENT'),
          E('h3', {}, `🎉 ${doneIds.size}분 모두 감사 인사를 완료했습니다!`),
          E('p', { class: 'small muted' }, '축의금 장부의 감사 인사 완료 상태가 모두 자동 반영되었습니다.'),
          E('div', { class: 'page-actions' }, button('장부로 돌아가기', () => { ctx.closeDialog(); ctx.render(); }, 'button'))));
      return;
    }
    cursor = Math.max(0, Math.min(cursor, remainingIds.length - 1));
    const current = findGift(remainingIds[cursor]);
    if (!current) {
      doneIds.add(remainingIds[cursor]);
      draw();
      return;
    }
    let variant = (current.channel === '계좌이체' && Number(current.mealTickets || 0) === 0) ? 'remote' : 'attended';
    const ta = E('textarea', { rows: '8', id: 'batch-thankyou-text', 'aria-label': `${current.name}님 감사 인사 문구` });
    ta.value = buildThankYouMessage(current, info, variant);

    const variantBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '감사 문구 상황 선택' });
    const drawVariants = () => {
      variantBar.replaceChildren(...[
        ['attended', '💐 참석 감사'],
        ['remote', '💌 불참·마음 전달 감사']
      ].map(([key, label]) => {
        const btn = button(label, () => {
          variant = key;
          ta.value = buildThankYouMessage(current, info, variant);
          drawVariants();
        }, 'button quiet trip-filter-chip');
        btn.setAttribute('aria-pressed', String(variant === key));
        return btn;
      }));
    };
    drawVariants();

    const pct = Math.round((doneIds.size / queueIds.length) * 100);
    const shareBtn = navigator.share ? button('💌 바로 공유', async () => {
      try { await navigator.share({ title: `${current.name}님 감사 인사`, text: ta.value.trim() }); }
      catch (err) { if (err?.name !== 'AbortError') ctx.toast('공유 창을 열지 못했습니다. 복사 버튼을 이용해 주세요.', true); }
    }, 'button quiet') : null;

    const completeAndNext = async ({ copyFirst = true } = {}) => {
      if (busy) return;
      busy = true;
      try {
        const text = ta.value.trim();
        if (copyFirst && text) {
          await navigator.clipboard?.writeText?.(text).catch(() => {});
        }
        const saved = await ctx.queuePreference(async () => {
          const cur = ctx.getPrefs().giftLedger || [];
          const next = cur.map(item => (item.id === current.id ? { ...item, thankYouDone: true } : item));
          return ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
        });
        if (saved) {
          doneIds.add(current.id);
          ctx.render();
          ctx.toast(copyFirst ? `✅ ${current.name}님 문구 복사 & 감사 완료` : `✅ ${current.name}님 감사 완료 처리`);
          draw();
        }
      } finally {
        busy = false;
      }
    };

    const prevBtn = button('← 이전', () => { cursor = (cursor - 1 + remainingIds.length) % remainingIds.length; draw(); }, 'button quiet');
    const skipBtn = button('건너뛰기 →', () => { cursor = (cursor + 1) % remainingIds.length; draw(); }, 'button quiet');
    prevBtn.disabled = remainingIds.length <= 1;
    skipBtn.disabled = remainingIds.length <= 1;

    body.replaceChildren(
      E('div', { class: 'batch-thankyou-head' },
        E('span', { class: 'spec-chip direct' }, `남은 대상 ${cursor + 1} / ${remainingIds.length}명 (완료 ${doneIds.size}/${queueIds.length})`),
        E('span', { class: 'spec-chip highlight' }, `${current.side} · ${current.group}`),
        E('span', { class: 'spec-chip' }, `${won(current.amount)} · ${current.channel}`)),
      E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` })),
      E('div', { class: 'batch-thankyou-recipient' },
        E('strong', {}, `${current.name}님`),
        current.note ? E('span', { class: 'small muted' }, ` · ${current.note}`) : null),
      variantBar,
      E('label', { class: 'field', for: ta.id }, '감사 인사 문구 (수정 가능)', ta),
      E('div', { class: 'page-actions batch-thankyou-actions' },
        button('📋 복사 + 감사 완료 & 다음 →', () => completeAndNext({ copyFirst: true }), 'button'),
        button('✓ 완료만 체크 & 다음', () => completeAndNext({ copyFirst: false }), 'button quiet'),
        shareBtn,
        prevBtn,
        skipBtn));
  };

  draw();
  ctx.showDialog(`📨 미감사 하객 연속 감사 인사 (${initialQueue.length}명)`, body);
}

export function openGiftEditor(ctx, existing = null, prefill = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing && existing.id);
  const base = existing || prefill || {};
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '축의금·식권·답례품 기록은 이 기기의 개인 설정에만 저장되며 공개 저장소에 올라가지 않습니다. 계좌번호·주민등록번호 등 민감 정보는 메모에 입력하지 마세요.'));

  const nameInput = E('input', { type: 'text', id: 'gift-name', maxlength: '80', required: true, placeholder: '예: 홍길동' });
  nameInput.value = base.name || '';
  const sideSelect = E('select', { id: 'gift-side' }, GUEST_SIDES.map(v => E('option', { value: v }, v)));
  if (GUEST_SIDES.includes(base.side)) sideSelect.value = base.side;
  const groupSelect = E('select', { id: 'gift-group' }, GUEST_GROUPS.map(v => E('option', { value: v }, v)));
  if (GUEST_GROUPS.includes(base.group)) groupSelect.value = base.group;
  const channelSelect = E('select', { id: 'gift-channel' }, GIFT_CHANNELS.map(v => E('option', { value: v }, v)));
  if (GIFT_CHANNELS.includes(base.channel)) channelSelect.value = base.channel;
  const amountInput = E('input', { type: 'number', id: 'gift-amount', min: '0', max: '100000000', step: '1000', required: true, placeholder: '예: 100000' });
  amountInput.value = base.amount !== undefined ? String(base.amount) : '';
  const ticketsInput = E('input', { type: 'number', id: 'gift-tickets', min: '0', max: '50', step: '1', required: true });
  ticketsInput.value = String(base.mealTickets ?? (prefill ? (prefill.mealTicket === false ? 0 : (prefill.partySize ?? 1)) : 1));
  const returnCheck = E('input', { type: 'checkbox', id: 'gift-return-done' });
  returnCheck.checked = Boolean(existing?.returnGiftDone);
  const thankCheck = E('input', { type: 'checkbox', id: 'gift-thank-done' });
  thankCheck.checked = Boolean(existing?.thankYouDone);
  const noteInput = E('input', { type: 'text', id: 'gift-note', maxlength: '300', placeholder: '예: 답례품 쿠키 전달 / 다음 모임 때 식사 대접' });
  noteInput.value = existing?.note || '';

  const quickAmounts = E('div', { class: 'ledger-quick-amounts' },
    [50000, 100000, 200000, 300000, 500000].map(val => button(`${val / 10000}만`, () => {
      amountInput.value = String(val);
      amountInput.focus({ preventScroll: true });
    }, 'button quiet small-copy-btn'))
  );

  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: nameInput.id }, '성함', nameInput),
      E('label', { class: 'field', for: channelSelect.id }, '전달 방식', channelSelect)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: sideSelect.id }, '양가 구분', sideSelect),
      E('label', { class: 'field', for: groupSelect.id }, '관계 분류', groupSelect)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: amountInput.id }, '축의금 (원 · 선물만이면 0)', amountInput),
      E('label', { class: 'field', for: ticketsInput.id }, '지급 식권 수량 (매)', ticketsInput)),
    quickAmounts,
    E('div', { class: 'sdm-option-checks' },
      E('label', { class: 'check-label', for: returnCheck.id }, returnCheck, '답례품 전달 완료'),
      E('label', { class: 'check-label', for: thankCheck.id }, thankCheck, '감사 인사 완료')),
    E('label', { class: 'field', for: noteInput.id }, '메모 (선택)', noteInput),
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, isEdit ? '기록 저장' : '축의금 기록 추가'))
  );

  const submit = form.querySelector('[type="submit"]');
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim() === '' ? -1 : Math.round(Number(amountInput.value));
    const mealTickets = ticketsInput.value.trim() === '' ? -1 : Math.round(Number(ticketsInput.value));
    if (!name) { ctx.toast('성함을 입력해 주세요.', true); return; }
    if (!Number.isInteger(amount) || amount < 0 || amount > 100000000) { ctx.toast('축의금은 0원~1억 원 사이의 정수로 입력해 주세요.', true); return; }
    if (!Number.isInteger(mealTickets) || mealTickets < 0 || mealTickets > 50) { ctx.toast('식권 수량은 0~50매 사이의 정수로 입력해 주세요.', true); return; }
    const prefs = ctx.getPrefs();
    const curList = [...(prefs.giftLedger || [])];
    if (!isEdit && curList.length >= 500) { ctx.toast('축의금 장부는 500건까지 보관할 수 있습니다.', true); return; }
    const id = isEdit ? existing.id : 'gift-' + crypto.randomUUID().slice(0, 8);
    const note = noteInput.value.trim();
    const entry = {
      id,
      name,
      side: sideSelect.value,
      group: groupSelect.value,
      channel: channelSelect.value,
      amount,
      mealTickets,
      returnGiftDone: returnCheck.checked,
      thankYouDone: thankCheck.checked,
      ...(note ? { note } : {})
    };
    const nextList = isEdit ? curList.map(g => (g.id === id ? entry : g)) : [...curList, entry];
    saving = true;
    submit.disabled = true;
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: nextList }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast(isEdit ? `'${name}' 축의금 기록을 수정했습니다.` : `'${name}' 축의금 기록을 장부에 추가했습니다.`);
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  const snapshot = () => JSON.stringify([nameInput.value, sideSelect.value, groupSelect.value, channelSelect.value, amountInput.value, ticketsInput.value, returnCheck.checked, thankCheck.checked, noteInput.value]);
  const initial = snapshot();
  if (ctx.showDialog(isEdit ? '축의금·식권 기록 수정' : '축의금·식권 기록 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

export function openQuickGiftEntryModal(ctx) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form quick-gift-form' });
  const guestList = ctx.getPrefs().guestList || [];
  const datalistId = 'quick-gift-guest-suggestions';
  const datalist = E('datalist', { id: datalistId }, guestList.map(g => E('option', { value: g.name }, `${g.side} · ${g.group} (${g.partySize}명)`)));

  const statusBar = E('div', { class: 'quick-gift-status', role: 'status', 'aria-live': 'polite' });
  const recentWrap = E('div', { class: 'quick-gift-recent' });
  const sessionEntries = [];

  const sideBar = E('div', { class: 'quick-gift-chip-row', role: 'group', 'aria-label': '양가 구분 고정 선택' });
  const channelBar = E('div', { class: 'quick-gift-chip-row', role: 'group', 'aria-label': '전달 방식 고정 선택' });

  const nameInput = E('input', {
    type: 'text',
    id: 'quick-gift-name',
    list: datalistId,
    maxlength: '80',
    required: true,
    autocomplete: 'off',
    placeholder: '성함 입력 (기존 하객 명단 자동완성)'
  });
  const groupSelect = E('select', { id: 'quick-gift-group', 'aria-label': '관계 분류' }, GUEST_GROUPS.map(v => E('option', { value: v }, v)));
  const amountInput = E('input', { type: 'number', id: 'quick-gift-amount', min: '0', max: '100000000', step: '1000', required: true, placeholder: '금액 (원)' });
  amountInput.value = '100000';
  const ticketsInput = E('input', { type: 'number', id: 'quick-gift-tickets', min: '0', max: '50', step: '1', required: true });
  ticketsInput.value = '1';
  const returnCheck = E('input', { type: 'checkbox', id: 'quick-gift-return' });
  const syncRsvpCheck = E('input', { type: 'checkbox', id: 'quick-gift-sync-rsvp' });
  syncRsvpCheck.checked = true;
  const noteInput = E('input', { type: 'text', id: 'quick-gift-note', maxlength: '300', placeholder: '메모 (선택 · 예: 봉투 번호 #12)' });

  const syncChipBars = () => {
    sideBar.replaceChildren(...GUEST_SIDES.map(side => {
      const btn = button(side, () => { quickEntrySide = side; syncChipBars(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(quickEntrySide === side));
      return btn;
    }));
    channelBar.replaceChildren(...GIFT_CHANNELS.map(ch => {
      const btn = button(ch, () => { quickEntryChannel = ch; syncChipBars(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(quickEntryChannel === ch));
      return btn;
    }));
  };
  syncChipBars();

  nameInput.addEventListener('change', () => {
    const typed = nameInput.value.trim().toLocaleLowerCase();
    if (!typed) return;
    const latestGuests = ctx.getPrefs().guestList || [];
    const matched = latestGuests.find(g => g.name.trim().toLocaleLowerCase() === typed && g.side === quickEntrySide)
      || latestGuests.find(g => g.name.trim().toLocaleLowerCase() === typed);
    if (!matched) return;
    quickEntrySide = matched.side;
    groupSelect.value = matched.group;
    ticketsInput.value = String(matched.mealTicket === false ? 0 : (matched.partySize || 1));
    syncChipBars();
  });

  const amountChips = E('div', { class: 'ledger-quick-amounts quick-gift-amounts', role: 'group', 'aria-label': '금액 빠른 선택' },
    [30000, 50000, 100000, 150000, 200000, 300000, 500000, 1000000].map(val => button(`${val / 10000}만`, () => {
      amountInput.value = String(val);
    }, 'button quiet small-copy-btn')));

  const ticketChips = E('div', { class: 'ledger-quick-amounts', role: 'group', 'aria-label': '식권 매수 빠른 선택' },
    [0, 1, 2, 3, 4].map(n => button(`식권 ${n}매`, () => {
      ticketsInput.value = String(n);
    }, 'button quiet small-copy-btn')));

  const renderSessionSummary = () => {
    const sessionAmount = sessionEntries.reduce((s, e) => s + e.entry.amount, 0);
    const sessionTickets = sessionEntries.reduce((s, e) => s + e.entry.mealTickets, 0);
    statusBar.textContent = sessionEntries.length
      ? `⚡ 이번 접수 ${sessionEntries.length}건 · 합계 ${won(sessionAmount)} · 식권 ${sessionTickets}매`
      : '양가·방식을 고정해 두고 성함과 금액만 빠르게 연속 입력할 수 있어요.';
    if (!sessionEntries.length) {
      recentWrap.replaceChildren();
      return;
    }
    recentWrap.replaceChildren(
      E('p', { class: 'small muted' }, '방금 입력한 내역 (최신순)'),
      E('ul', { class: 'quick-gift-recent-list' }, sessionEntries.slice(0, 4).map(rec => E('li', { class: 'quick-gift-recent-item' },
        E('span', { class: 'small' }, `${rec.entry.name} · ${rec.entry.side} · ${won(rec.entry.amount)} · 식권 ${rec.entry.mealTickets}매${rec.syncedGuest ? ' · RSVP 참석 반영' : ''}`),
        button('되돌리기', async () => {
          const saved = await ctx.queuePreference(async () => {
            const curPrefs = ctx.getPrefs();
            const nextGifts = (curPrefs.giftLedger || []).filter(g => g.id !== rec.entry.id);
            let nextGuests = curPrefs.guestList;
            if (rec.syncedGuest) {
              nextGuests = (curPrefs.guestList || []).map(g => (g.id === rec.syncedGuest.id ? { ...g, rsvp: rec.syncedGuest.prevRsvp } : g));
            }
            return ctx.savePrefs({ ...curPrefs, giftLedger: nextGifts, ...(nextGuests ? { guestList: nextGuests } : {}) });
          });
          if (saved) {
            const idx = sessionEntries.findIndex(e => e.entry.id === rec.entry.id);
            if (idx >= 0) sessionEntries.splice(idx, 1);
            renderSessionSummary();
            ctx.render();
          }
        }, 'text-button small')))));
  };
  renderSessionSummary();

  const submit = E('button', { class: 'button', type: 'submit' }, '⚡ 저장 + 다음 입력');
  const doneBtn = button('완료 닫기', () => { ctx.closeDialog(); ctx.render(); }, 'button quiet');

  form.append(
    datalist,
    statusBar,
    E('div', { class: 'quick-gift-sticky-group' },
      E('span', { class: 'small muted' }, '양가 구분 (고정)'),
      sideBar,
      E('span', { class: 'small muted' }, '전달 방식 (고정)'),
      channelBar),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: nameInput.id }, '하객 성함', nameInput),
      E('label', { class: 'field', for: groupSelect.id }, '관계 분류', groupSelect)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: amountInput.id }, '축의금 (원)', amountInput),
      E('label', { class: 'field', for: ticketsInput.id }, '식권 수량 (매)', ticketsInput)),
    amountChips,
    ticketChips,
    E('div', { class: 'sdm-option-checks' },
      E('label', { class: 'check-label', for: returnCheck.id }, returnCheck, '답례품 바로 전달함'),
      E('label', { class: 'check-label', for: syncRsvpCheck.id }, syncRsvpCheck, '명단 일치 하객 ‘참석(RSVP)’ 자동 반영')),
    E('label', { class: 'field', for: noteInput.id }, '메모 (선택)', noteInput),
    recentWrap,
    E('div', { class: 'form-actions' }, doneBtn, submit)
  );

  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim() === '' ? -1 : Math.round(Number(amountInput.value));
    const mealTickets = ticketsInput.value.trim() === '' ? -1 : Math.round(Number(ticketsInput.value));
    if (!name) { ctx.toast('하객 성함을 입력해 주세요.', true); nameInput.focus(); return; }
    if (!Number.isInteger(amount) || amount < 0 || amount > 100000000) { ctx.toast('축의금은 0원~1억 원 사이로 입력해 주세요.', true); return; }
    if (!Number.isInteger(mealTickets) || mealTickets < 0 || mealTickets > 50) { ctx.toast('식권 수량은 0~50매 사이로 입력해 주세요.', true); return; }
    const curList = [...(ctx.getPrefs().giftLedger || [])];
    if (curList.length >= 500) { ctx.toast('축의금 장부는 500건까지 보관할 수 있습니다.', true); return; }
    const note = noteInput.value.trim();
    const entry = {
      id: 'gift-' + crypto.randomUUID().slice(0, 8),
      name,
      side: quickEntrySide,
      group: groupSelect.value,
      channel: quickEntryChannel,
      amount,
      mealTickets,
      returnGiftDone: returnCheck.checked,
      thankYouDone: false,
      ...(note ? { note } : {})
    };
    saving = true;
    submit.disabled = true;
    let syncedGuest = null;
    try {
      const saved = await ctx.queuePreference(() => {
        const curPrefs = ctx.getPrefs();
        let nextGuestList = curPrefs.guestList;
        if (syncRsvpCheck.checked && Array.isArray(curPrefs.guestList) && curPrefs.guestList.length) {
          const norm = name.toLocaleLowerCase();
          const matched = curPrefs.guestList.find(g => g.name.trim().toLocaleLowerCase() === norm && g.side === quickEntrySide && g.rsvp !== '참석')
            || curPrefs.guestList.find(g => g.name.trim().toLocaleLowerCase() === norm && g.rsvp !== '참석');
          if (matched) {
            syncedGuest = { id: matched.id, prevRsvp: matched.rsvp };
            nextGuestList = curPrefs.guestList.map(g => (g.id === matched.id ? { ...g, rsvp: '참석' } : g));
          }
        }
        return ctx.savePrefs({
          ...curPrefs,
          giftLedger: [...(curPrefs.giftLedger || []), entry],
          ...(syncedGuest ? { guestList: nextGuestList } : {})
        });
      });
      if (saved) {
        sessionEntries.unshift({ entry, syncedGuest });
        nameInput.value = '';
        noteInput.value = '';
        returnCheck.checked = false;
        ticketsInput.value = '1';
        renderSessionSummary();
        ctx.render();
        ctx.toast(`✅ ${entry.name}님 (${won(entry.amount)}) 접수 완료${syncedGuest ? ' · 하객 참석 자동 반영' : ''}`);
        nameInput.focus({ preventScroll: true });
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  if (ctx.showDialog('⚡ 축의대 현장 빠른 연속 입력', form)) {
    ctx.setEditorState({ isDirty: () => saving || Boolean(nameInput.value.trim()), isSaving: () => saving });
    nameInput.focus({ preventScroll: true });
  }
}

export function openGiftImportModal(ctx) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  let importTab = 'paste';

  const defaultSideSel = E('select', { id: 'gift-bulk-side' }, GUEST_SIDES.map(v => E('option', { value: v }, v)));
  defaultSideSel.value = quickEntrySide;
  const defaultGroupSel = E('select', { id: 'gift-bulk-group' }, GUEST_GROUPS.map(v => E('option', { value: v }, v)));
  defaultGroupSel.value = '친구';
  const defaultChannelSel = E('select', { id: 'gift-bulk-channel' }, GIFT_CHANNELS.map(v => E('option', { value: v }, v)));
  defaultChannelSel.value = quickEntryChannel;

  const bulkTextInput = E('textarea', {
    id: 'gift-bulk-text',
    rows: '6',
    placeholder: '한 줄에 한 건씩 붙여넣어 주세요 (축의록 메모·계좌이체 내역·엑셀 표 복사 모두 가능)\n예:\n홍길동 10만\n김영희 50,000 계좌\n박민수 (신부측 직장, 20만원, 식권2)\n이철수 15만 - 부부 동반'
  });
  const fileInput = E('input', { type: 'file', accept: '.csv,text/csv', class: 'file-input', id: 'gift-csv-file', 'aria-label': '축의금 장부 CSV 파일 선택' });
  const parseErrorEl = E('p', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
  const previewWrap = E('div', { class: 'csv-import-preview', 'aria-live': 'polite' });

  const modeSkipRadio = E('input', { type: 'radio', name: 'gift-import-mode', value: 'skip', id: 'gift-mode-skip', checked: true });
  const modeAllRadio = E('input', { type: 'radio', name: 'gift-import-mode', value: 'all', id: 'gift-mode-all' });
  const syncRsvpCheck = E('input', { type: 'checkbox', id: 'gift-import-sync-rsvp' });
  syncRsvpCheck.checked = true;

  const modeWrap = E('div', { class: 'pref-restore-modes', hidden: true },
    E('label', { class: 'check-label', for: modeSkipRadio.id }, modeSkipRadio, '같은 양가·성함·방식·금액 중복 건너뛰고 신규만 추가 (권장)'),
    E('label', { class: 'check-label', for: modeAllRadio.id }, modeAllRadio, '중복 포함 전체 추가'),
    E('label', { class: 'check-label', for: syncRsvpCheck.id }, syncRsvpCheck, '기존 하객 명단에 같은 이름이 있으면 참석(RSVP) 상태로 자동 반영'));

  const submit = E('button', { class: 'button', type: 'submit', disabled: true }, '축의금 장부에 가져오기');
  let parsed = null;
  let saving = false;

  const selectedMode = () => (modeAllRadio.checked ? 'all' : 'skip');
  const computeSync = () => (parsed ? syncGiftsFromImport(ctx.getPrefs().giftLedger || [], parsed.records, selectedMode()) : null);

  const renderPreview = () => {
    if (!parsed) {
      previewWrap.replaceChildren();
      modeWrap.hidden = true;
      submit.disabled = true;
      submit.textContent = '축의금 장부에 가져오기';
      return;
    }
    const plan = computeSync();
    const totalAmt = plan.addedRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
    modeWrap.hidden = false;
    submit.disabled = saving || plan.addedCount === 0 || plan.overCap;
    submit.textContent = plan.addedCount > 0 ? `${plan.addedCount}건 (${won(totalAmt)}) 일괄 등록` : '추가할 신규 내역 없음';

    const headRows = parsed.records.slice(0, 8);
    previewWrap.replaceChildren(...[
      E('p', { class: 'form-note' + (plan.overCap ? ' warning' : '') },
        `총 ${parsed.records.length}건 인식${parsed.skipped ? ` (건너뜀 ${parsed.skipped}건)` : ''} → ` +
        `신규 추가 ${plan.addedCount}건 (${won(totalAmt)})` +
        `${plan.skippedCount ? ` · 중복 제외 ${plan.skippedCount}건` : ''} (반영 후 총 ${plan.nextList.length}/500건)` +
        (plan.overCap ? '\n축의금 장부는 최대 500건까지 보관할 수 있습니다.' : '')),
      parsed.warnings.length ? E('p', { class: 'small muted' }, `참고 안내: ${parsed.warnings.slice(0, 3).join(' / ')}${parsed.warnings.length > 3 ? ` 외 ${parsed.warnings.length - 3}건` : ''}`) : null,
      E('div', { class: 'table-scroll' },
        E('table', { class: 'csv-preview-table' },
          E('thead', {}, E('tr', {}, ['구분', '관계', '성함', '방식', '금액', '식권'].map(h => E('th', { scope: 'col' }, h)))),
          E('tbody', {}, headRows.map(r => E('tr', {},
            E('td', {}, r.side),
            E('td', {}, r.group),
            E('td', {}, r.name),
            E('td', {}, r.channel),
            E('td', {}, won(r.amount)),
            E('td', {}, `${r.mealTickets}매`)))))),
      parsed.records.length > headRows.length ? E('p', { class: 'small muted' }, `… 외 ${parsed.records.length - headRows.length}건 더 있습니다.`) : null
    ].filter(Boolean));
  };

  const reparsePaste = () => {
    const raw = bulkTextInput.value.trim();
    if (!raw) {
      parsed = null;
      parseErrorEl.textContent = '';
      renderPreview();
      return;
    }
    try {
      parsed = parseQuickGiftText(raw, {
        defaultSide: defaultSideSel.value,
        defaultGroup: defaultGroupSel.value,
        defaultChannel: defaultChannelSel.value
      });
      parseErrorEl.textContent = '';
      renderPreview();
    } catch (error) {
      parsed = null;
      parseErrorEl.textContent = error.message || '축의금 내역을 인식하지 못했습니다.';
      renderPreview();
    }
  };

  bulkTextInput.addEventListener('input', reparsePaste);
  defaultSideSel.addEventListener('change', reparsePaste);
  defaultGroupSel.addEventListener('change', reparsePaste);
  defaultChannelSel.addEventListener('change', reparsePaste);
  modeSkipRadio.addEventListener('change', renderPreview);
  modeAllRadio.addEventListener('change', renderPreview);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) { parsed = null; renderPreview(); return; }
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('CSV 파일은 2MB 이하로 선택해 주세요.');
      const text = await file.text();
      parsed = parseGiftsCsv(text);
      parseErrorEl.textContent = '';
      renderPreview();
    } catch (error) {
      parsed = null;
      parseErrorEl.textContent = error.message || 'CSV 파일을 읽지 못했습니다.';
      renderPreview();
      ctx.toast(error.message || 'CSV 파일을 읽지 못했습니다.', true);
    }
  });

  const downloadSample = () => {
    const sample = giftsToCsv([
      { side: '신랑 측', group: '친구', name: '예시_홍길동', channel: '축의대(현금)', amount: 100000, mealTickets: 1, returnGiftDone: false, thankYouDone: false, note: '대학 동기' },
      { side: '신부 측', group: '직장·동료', name: '예시_김영희', channel: '계좌이체', amount: 50000, mealTickets: 0, returnGiftDone: false, thankYouDone: false, note: '사전 송금' }
    ]);
    downloadText(sample, 'wedding-gift-sample.csv', 'text/csv;charset=utf-8');
    ctx.toast('축의금 예시 CSV 양식(wedding-gift-sample.csv)을 내려받았습니다.');
  };

  const pasteSection = E('div', { class: 'editor-form' },
    E('p', { class: 'form-note' }, '축의록 메모·계좌이체 내역·엑셀 표 복사본을 그대로 붙여넣으면 이름·금액(‘10만’, ‘50,000’)·전달 방식(‘계좌’)·식권(‘식권2’)을 자동 인식해 한 번에 등록합니다. (계좌번호 등 민감 정보는 제외하고 붙여넣어 주세요.)'),
    E('div', { class: 'editor-grid-3' },
      E('label', { class: 'field', for: defaultSideSel.id }, '기본 양가 구분', defaultSideSel),
      E('label', { class: 'field', for: defaultGroupSel.id }, '기본 관계 분류', defaultGroupSel),
      E('label', { class: 'field', for: defaultChannelSel.id }, '기본 전달 방식', defaultChannelSel)),
    E('label', { class: 'field', for: bulkTextInput.id }, '축의금 내역 텍스트 붙여넣기', bulkTextInput));

  const csvSection = E('div', { class: 'editor-form', hidden: true },
    E('p', { class: 'form-note' }, '엑셀·구글 시트 또는 이 앱에서 내보낸 축의금 장부 CSV(UTF-8) 파일을 불러옵니다. ‘성함/이름’과 ‘축의금/금액’ 열을 자동 인식합니다.'),
    E('div', { class: 'page-actions' }, button('📄 예시 CSV 양식 받기', downloadSample, 'button quiet')),
    E('label', { class: 'field', for: fileInput.id }, '축의금 CSV 파일 선택', fileInput));

  const tabBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '축의금 일괄 가져오기 방식 선택' });
  const syncTabs = () => {
    pasteSection.hidden = importTab !== 'paste';
    csvSection.hidden = importTab !== 'csv';
    tabBar.replaceChildren(...[
      ['paste', '📋 카톡·계좌내역 붙여넣기'],
      ['csv', '📄 CSV 파일 업로드']
    ].map(([key, label]) => E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-gift-import-tab': key,
      'aria-pressed': String(importTab === key),
      onclick: () => {
        if (importTab === key) return;
        importTab = key;
        parsed = null;
        parseErrorEl.textContent = '';
        if (key === 'paste') reparsePaste();
        else renderPreview();
        syncTabs();
      }
    }, label)));
  };
  syncTabs();

  form.append(
    tabBar,
    pasteSection,
    csvSection,
    parseErrorEl,
    modeWrap,
    previewWrap,
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit)
  );

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !parsed) return;
    const plan = computeSync();
    if (!plan || plan.addedCount === 0) { ctx.toast('추가할 신규 축의금 내역이 없습니다.', true); return; }
    if (plan.overCap) { ctx.toast('축의금 장부는 최대 500건까지 보관할 수 있습니다.', true); return; }
    saving = true;
    submit.disabled = true;
    try {
      let syncedRsvpCount = 0;
      const saved = await ctx.queuePreference(async () => {
        const curPrefs = ctx.getPrefs();
        const latestPlan = syncGiftsFromImport(curPrefs.giftLedger || [], parsed.records, selectedMode());
        if (latestPlan.overCap) throw new Error('축의금 장부는 500건까지 보관할 수 있습니다.');
        let nextGuestList = curPrefs.guestList;
        if (syncRsvpCheck.checked && Array.isArray(curPrefs.guestList) && curPrefs.guestList.length) {
          const addedNames = new Set(latestPlan.addedRecords.map(r => `${r.side}|${r.name.trim().toLocaleLowerCase()}`));
          const addedNameOnly = new Set(latestPlan.addedRecords.map(r => r.name.trim().toLocaleLowerCase()));
          nextGuestList = curPrefs.guestList.map(g => {
            if (g.rsvp === '참석') return g;
            const nk = g.name.trim().toLocaleLowerCase();
            if (addedNames.has(`${g.side}|${nk}`) || addedNameOnly.has(nk)) {
              syncedRsvpCount++;
              return { ...g, rsvp: '참석' };
            }
            return g;
          });
        }
        return ctx.savePrefs({
          ...curPrefs,
          giftLedger: latestPlan.nextList,
          ...(syncedRsvpCount > 0 ? { guestList: nextGuestList } : {})
        });
      });
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast(`축의금 ${plan.addedCount}건을 일괄 등록했습니다.${syncedRsvpCount ? ` (하객 명단 ${syncedRsvpCount}명 참석 자동 반영)` : ''}`);
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      renderPreview();
    }
  });

  if (ctx.showDialog('📤 축의금 내역 일괄 등록 (붙여넣기 · CSV)', form)) {
    ctx.setEditorState({ isDirty: () => saving || Boolean(parsed) || Boolean(bulkTextInput.value.trim()), isSaving: () => saving });
  }
}

export function renderGiftLedgerBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const list = prefs.giftLedger || [];
  const summary = giftLedgerSummary(list);
  const cross = crossCheckGuestsAndGifts(prefs.guestList || [], list);
  const unmatchedIds = new Set(cross.giftsNotInGuestList.map(g => g.id));

  const channelSelect = E('select', { id: 'gift-channel-filter', 'aria-label': '전달 방식 필터' },
    [['all', '방식 전체'], ...GIFT_CHANNELS.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  channelSelect.value = giftChannelFilter;
  const pendingCheck = E('input', { type: 'checkbox', id: 'gift-pending-only' });
  pendingCheck.checked = giftPendingOnly;
  const unthankedCheck = E('input', { type: 'checkbox', id: 'gift-unthanked-only' });
  unthankedCheck.checked = giftUnthankedOnly;

  const sideBar = E('div', { class: 'ledger-side-pills', role: 'group', 'aria-label': '축의금 양가 필터' });
  const listWrap = E('div', { class: 'ledger-items-wrap' });
  const countNode = E('span', { class: 'small muted', 'aria-live': 'polite' });
  const resetWrap = E('span', { class: 'filter-reset-slot' });
  const crossStripSlot = E('div', { class: 'gift-crosscheck-slot' });

  const search = searchBox({
    id: 'gift-search',
    value: giftQuery,
    placeholder: '성함·관계·메모 검색',
    ariaLabel: '축의금 장부 검색',
    onInput: val => { giftQuery = val; draw(); }
  });

  const toggleGiftFlag = (giftId, key, val) => {
    ctx.queuePreference(async () => {
      const cur = ctx.getPrefs().giftLedger || [];
      const next = cur.map(item => (item.id === giftId ? { ...item, [key]: val } : item));
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
      if (saved) ctx.render();
      return saved;
    });
  };

  const addGiftPersonToGuestList = item => {
    ctx.queuePreference(async () => {
      const curPrefs = ctx.getPrefs();
      const curGuests = curPrefs.guestList || [];
      if (curGuests.length >= 500) {
        ctx.toast('하객 명단은 최대 500건까지 보관할 수 있습니다.', true);
        return true;
      }
      const nextGuest = {
        id: 'guest-' + crypto.randomUUID().slice(0, 8),
        name: item.name,
        side: GUEST_SIDES.includes(item.side) ? item.side : '공통',
        group: GUEST_GROUPS.includes(item.group) ? item.group : '지인·기타',
        partySize: Math.max(1, Math.min(20, Number(item.mealTickets) || 1)),
        inviteStatus: '모바일 발송',
        rsvp: '참석',
        mealTicket: (item.mealTickets || 0) > 0,
        ...(item.note ? { note: item.note } : {})
      };
      const saved = await ctx.savePrefs({ ...curPrefs, guestList: [...curGuests, nextGuest] });
      if (saved) {
        ctx.render();
        ctx.toast(`‘${item.name}’님을 하객 명단(참석)에 추가했습니다.`);
      }
      return saved;
    });
  };

  const resetGiftFilters = () => {
    giftSideFilter = 'all';
    giftChannelFilter = 'all';
    giftPendingOnly = false;
    giftUnthankedOnly = false;
    giftUnmatchedOnly = false;
    giftQuery = '';
    search.input.value = '';
    search.syncClear();
    channelSelect.value = 'all';
    pendingCheck.checked = false;
    unthankedCheck.checked = false;
    draw();
  };

  const draw = () => {
    sideBar.replaceChildren(...['all', ...GUEST_SIDES].map(side => {
      const label = side === 'all' ? `전체 (${list.length})` : `${side} (${summary.bySide[side]?.count || 0})`;
      const btn = button(label, () => { giftSideFilter = side; draw(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(giftSideFilter === side));
      return btn;
    }));
    const activeCount = [
      giftSideFilter !== 'all',
      giftChannelFilter !== 'all',
      giftPendingOnly,
      giftUnthankedOnly,
      giftUnmatchedOnly,
      Boolean(giftQuery.trim())
    ].filter(Boolean).length;
    resetWrap.replaceChildren(...(activeCount ? [button(`✕ 필터 초기화 (${activeCount})`, resetGiftFilters, 'filter-reset-chip')] : []));

    if (list.length || (prefs.guestList || []).length) {
      const unmatchedBtn = cross.giftsNotInGuestList.length > 0
        ? button(giftUnmatchedOnly ? '명단 미등록 필터 해제' : `명단 미등록만 보기 (${cross.giftsNotInGuestList.length}건)`, () => {
          giftUnmatchedOnly = !giftUnmatchedOnly;
          draw();
        }, 'button quiet small-copy-btn' + (giftUnmatchedOnly ? ' active' : ''))
        : null;
      if (unmatchedBtn) unmatchedBtn.setAttribute('aria-pressed', String(giftUnmatchedOnly));
      crossStripSlot.replaceChildren(E('div', { class: 'ledger-crosscheck-strip', role: 'region', 'aria-label': '하객 명단 교차 정산' },
        E('div', { class: 'ledger-crosscheck-metrics' },
          E('span', { class: 'small' }, '🔗 하객 명단 교차 대조:'),
          E('span', { class: 'spec-chip direct' }, `명단 일치 ${cross.matchedGiftCount}건`),
          cross.giftsNotInGuestList.length > 0 ? E('span', { class: 'spec-chip highlight' }, `명단 미등록 ${cross.giftsNotInGuestList.length}건`) : null,
          cross.attendingWithoutGift.length > 0 ? E('span', { class: 'spec-chip' }, `참석 하객 중 축의 미기록 ${cross.attendingWithoutGift.length}명`) : null),
        E('div', { class: 'ledger-crosscheck-actions' },
          unmatchedBtn,
          cross.attendingWithoutGift.length > 0 ? button('하객 명단 확인 →', () => ctx.navigateToRoute('ceremony', 'guests'), 'text-button small') : null)));
    } else {
      crossStripSlot.replaceChildren();
    }

    const q = giftQuery.trim().toLocaleLowerCase();
    const filtered = list.filter(item =>
      (giftSideFilter === 'all' || item.side === giftSideFilter) &&
      (giftChannelFilter === 'all' || item.channel === giftChannelFilter) &&
      (!giftPendingOnly || !item.returnGiftDone || !item.thankYouDone) &&
      (!giftUnthankedOnly || !item.thankYouDone) &&
      (!giftUnmatchedOnly || unmatchedIds.has(item.id)) &&
      (!q || `${item.name} ${item.side} ${item.group} ${item.note || ''}`.toLocaleLowerCase().includes(q))
    );
    const filteredTotal = filtered.reduce((acc, item) => acc + (item.amount || 0), 0);
    countNode.textContent = `${filtered.length}건 · 소계 ${won(filteredTotal)}`;

    if (!list.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted ledger-empty-note' }, '등록된 축의금 기록이 없습니다. 본식 당일·이후 축의금과 식권 지급, 답례품·감사 인사 여부를 이 기기에서 안전하게 정산할 수 있습니다.'));
      return;
    }
    if (!filtered.length) {
      listWrap.replaceChildren(E('div', { class: 'no-results-box ledger-empty-box' },
        E('p', { class: 'no-results' }, '선택한 필터 조건에 맞는 축의금 기록이 없습니다.'),
        activeCount ? button('모든 필터 초기화', resetGiftFilters, 'button quiet') : null));
      return;
    }
    listWrap.replaceChildren(E('ul', { class: 'ledger-list' }, filtered.map(item => {
      const retBox = E('input', { type: 'checkbox', 'aria-label': `${item.name} 답례품 전달 완료` });
      retBox.checked = Boolean(item.returnGiftDone);
      retBox.addEventListener('change', () => toggleGiftFlag(item.id, 'returnGiftDone', retBox.checked));

      const thxBox = E('input', { type: 'checkbox', 'aria-label': `${item.name} 감사 인사 완료` });
      thxBox.checked = Boolean(item.thankYouDone);
      thxBox.addEventListener('change', () => toggleGiftFlag(item.id, 'thankYouDone', thxBox.checked));

      const isUnmatched = unmatchedIds.has(item.id);
      return E('li', { class: 'ledger-row', 'data-gift-id': item.id },
        E('div', { class: 'ledger-row-main' },
          E('div', { class: 'ledger-row-head' },
            E('strong', { class: 'ledger-row-name' }, item.name),
            E('strong', { class: 'ledger-amount' }, won(item.amount)),
            E('span', { class: 'spec-chip' }, `${item.side} · ${item.group}`),
            E('span', { class: 'spec-chip' }, item.channel),
            E('span', { class: 'spec-chip' }, `식권 ${item.mealTickets}매`),
            isUnmatched ? E('span', { class: 'spec-chip highlight' }, '명단 미등록') : null),
          item.note ? E('p', { class: 'small muted ledger-row-note' }, item.note) : null),
        E('div', { class: 'ledger-row-controls' },
          E('label', { class: 'ledger-inline-check' }, retBox, '답례품'),
          E('label', { class: 'ledger-inline-check' }, thxBox, '감사인사'),
          isUnmatched ? button('+ 하객 등록', () => addGiftPersonToGuestList(item), 'checklist-note-btn') : null,
          button('💬 감사문자', () => openThankYouModal(ctx, item), 'checklist-note-btn'),
          button('수정', () => openGiftEditor(ctx, item), 'checklist-note-btn'),
          button('삭제', () => {
            ctx.queuePreference(async () => {
              const latest = ctx.getPrefs().giftLedger || [];
              const removedIndex = latest.findIndex(g => g.id === item.id);
              if (removedIndex < 0) return true;
              const snapshot = structuredClone(latest[removedIndex]);
              const next = latest.filter(g => g.id !== item.id);
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
              if (saved) {
                ctx.render();
                ctx.toast(`‘${item.name}’ 축의금 기록을 삭제했습니다.`, {
                  undoLabel: '되돌리기',
                  onUndo: () => ctx.queuePreference(async () => {
                    const cur = [...(ctx.getPrefs().giftLedger || [])];
                    if (cur.some(g => g.id === snapshot.id)) return true;
                    cur.splice(Math.min(removedIndex, cur.length), 0, snapshot);
                    const restored = await ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: cur });
                    if (restored) { ctx.render(); ctx.toast(`‘${snapshot.name}’ 축의금 기록을 복구했습니다.`); }
                    return restored;
                  })
                });
              }
              return saved;
            });
          }, 'checklist-note-btn danger-text')));
    })));
  };

  channelSelect.addEventListener('change', () => { giftChannelFilter = channelSelect.value; draw(); });
  pendingCheck.addEventListener('change', () => { giftPendingOnly = pendingCheck.checked; draw(); });
  unthankedCheck.addEventListener('change', () => { giftUnthankedOnly = unthankedCheck.checked; draw(); });
  draw();

  const thankYouDoneCount = summary.totalRecords - summary.thankYouPending;
  const thankYouPct = summary.totalRecords ? Math.round((thankYouDoneCount / summary.totalRecords) * 100) : 0;

  return E('section', { class: 'gift-ledger private-ledger-section', 'aria-labelledby': 'gift-ledger-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'PRIVATE GIFT & THANK-YOU LEDGER'),
        E('h2', { id: 'gift-ledger-title' }, '💌 축의금 · 식권 · 답례품 정산 장부'),
        E('p', {}, '본식 축의금, 식권 지급 매수, 답례품 전달과 감사 인사 완료 여부를 기록하고 엑셀(CSV)로 내려받을 수 있습니다. (이 기기 전용 · 계좌번호 등 민감 정보 입력 금지)')),
      E('div', { class: 'page-actions gift-ledger-toolbar' },
        button('⚡ 축의대 빠른 입력', () => openQuickGiftEntryModal(ctx)),
        button('📤 내역·CSV 일괄 등록', () => openGiftImportModal(ctx), 'button quiet'),
        summary.thankYouPending > 0 ? button(`📨 미감사 ${summary.thankYouPending}명 연속 보내기`, () => openBatchThankYouModal(ctx), 'button quiet') : null,
        button('+ 상세 기록', () => openGiftEditor(ctx), 'button quiet'),
        list.length ? button('🖨️ 정산표 인쇄', () => printDedicatedSheet('print-gift-sheet', buildGiftPrintSheet(ctx, list)), 'button quiet') : null,
        list.length ? button('📥 CSV 내보내기', () => {
          downloadText(giftsToCsv(list), 'wedding-gift-ledger.csv', 'text/csv;charset=utf-8');
          ctx.toast('축의금 정산 장부(wedding-gift-ledger.csv)를 내려받았습니다.');
        }, 'button quiet') : null)),
    E('div', { class: 'ledger-kpi-grid' },
      E('div', { class: 'ledger-kpi-card is-accent' },
        E('span', { class: 'small muted' }, '축의금 합계'),
        E('strong', {}, won(summary.totalAmount)),
        E('span', { class: 'small muted' }, `총 ${summary.totalRecords}건 (현금 ${won(summary.byChannel['축의대(현금)'].amount)} · 계좌 ${won(summary.byChannel['계좌이체'].amount)})`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '양가별 합계'),
        E('strong', {}, `신랑 ${won(summary.bySide['신랑 측'].amount)}`),
        E('span', { class: 'small muted' }, `신부 ${won(summary.bySide['신부 측'].amount)} · 공통 ${won(summary.bySide['공통'].amount)}`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '지급 식권 합계'),
        E('strong', {}, `${summary.totalMealTickets}매`),
        E('span', { class: 'small muted' }, `신랑 ${summary.bySide['신랑 측'].mealTickets}매 · 신부 ${summary.bySide['신부 측'].mealTickets}매`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '후속 인사 체크'),
        E('strong', {}, `감사 미완료 ${summary.thankYouPending}건`),
        E('span', { class: 'small muted' }, `답례품 미전달 ${summary.returnGiftPending}건`))),
    renderSideRatioBar({
      title: '📊 양가별 축의금 합계 비중',
      formatValue: v => won(v),
      entries: [
        { label: '신랑 측', value: summary.bySide['신랑 측']?.amount || 0, cls: 'ratio-seg-groom' },
        { label: '신부 측', value: summary.bySide['신부 측']?.amount || 0, cls: 'ratio-seg-bride' },
        { label: '공통', value: summary.bySide['공통']?.amount || 0, cls: 'ratio-seg-common' }
      ]
    }),
    summary.totalRecords ? E('div', { class: 'thankyou-progress-bar', 'aria-label': '감사 인사 진행률' },
      E('div', { class: 'thankyou-progress-head' },
        E('span', { class: 'small' }, `💬 감사 인사 진행률 ${thankYouDoneCount} / ${summary.totalRecords}건 (${thankYouPct}%)`),
        E('div', { class: 'thankyou-progress-actions' },
          summary.thankYouPending > 0 ? button(`📨 연속 감사문자 (${summary.thankYouPending}명)`, () => openBatchThankYouModal(ctx), 'text-button small') : null,
          summary.thankYouPending > 0 && !giftUnthankedOnly
            ? button(`미감사 ${summary.thankYouPending}건만 보기`, () => { giftUnthankedOnly = true; unthankedCheck.checked = true; draw(); }, 'text-button small')
            : null)),
      E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill', style: `width:${thankYouPct}%` }))) : null,
    crossStripSlot,
    E('div', { class: 'ledger-filter-bar gift-ledger-toolbar' },
      sideBar,
      E('div', { class: 'ledger-filter-controls' },
        search.wrap,
        channelSelect,
        E('label', { class: 'check-label', for: unthankedCheck.id }, unthankedCheck, '미감사만'),
        E('label', { class: 'check-label', for: pendingCheck.id }, pendingCheck, '미완료만 보기'),
        resetWrap,
        countNode)),
    listWrap);
}
