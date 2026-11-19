import { E, button, downloadText } from './dom.js?v=wedding-features-49';
import { GUEST_SIDES, GUEST_GROUPS, INVITE_STATUSES, RSVP_STATUSES, GIFT_CHANNELS } from './preferences.js?v=wedding-features-49';
import { guestListSummary, giftLedgerSummary, guestsToCsv, giftsToCsv } from './planning.js?v=wedding-features-49';

let guestSideFilter = 'all';
let guestRsvpFilter = 'all';
let guestInviteFilter = 'all';
let guestQuery = '';

let giftSideFilter = 'all';
let giftChannelFilter = 'all';
let giftPendingOnly = false;
let giftQuery = '';

const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

export function openGuestEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing && existing.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '하객 명단은 이 기기의 개인 설정에만 저장되며 방문자용 청첩장(?view=guest)과 공개 site.json에는 포함되지 않습니다.'));
  const nameInput = E('input', { type: 'text', id: 'guest-name', maxlength: '80', required: true, placeholder: '예: 홍길동 (가족 동반 시 대표자 이름)' });
  nameInput.value = existing?.name || '';
  const sideSelect = E('select', { id: 'guest-side' }, GUEST_SIDES.map(v => E('option', { value: v }, v)));
  if (isEdit && GUEST_SIDES.includes(existing.side)) sideSelect.value = existing.side;
  const groupSelect = E('select', { id: 'guest-group' }, GUEST_GROUPS.map(v => E('option', { value: v }, v)));
  if (isEdit && GUEST_GROUPS.includes(existing.group)) groupSelect.value = existing.group;
  const sizeInput = E('input', { type: 'number', id: 'guest-size', min: '1', max: '20', step: '1', required: true });
  sizeInput.value = String(existing?.partySize ?? 1);
  const inviteSelect = E('select', { id: 'guest-invite' }, INVITE_STATUSES.map(v => E('option', { value: v }, v)));
  if (isEdit && INVITE_STATUSES.includes(existing.inviteStatus)) inviteSelect.value = existing.inviteStatus;
  const rsvpSelect = E('select', { id: 'guest-rsvp' }, RSVP_STATUSES.map(v => E('option', { value: v }, v)));
  if (isEdit && RSVP_STATUSES.includes(existing.rsvp)) rsvpSelect.value = existing.rsvp;
  const mealCheck = E('input', { type: 'checkbox', id: 'guest-meal' });
  mealCheck.checked = existing ? existing.mealTicket !== false : true;
  const noteInput = E('input', { type: 'text', id: 'guest-note', maxlength: '300', placeholder: '예: 청첩장 모임 4월 예정 / 채식 요청 / KTX 순천역 도착' });
  noteInput.value = existing?.note || '';

  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: nameInput.id }, '하객 성함', nameInput),
      E('label', { class: 'field', for: sizeInput.id }, '동반 포함 인원 (명)', sizeInput)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: sideSelect.id }, '양가 구분', sideSelect),
      E('label', { class: 'field', for: groupSelect.id }, '관계 분류', groupSelect)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: inviteSelect.id }, '청첩장 발송 상태', inviteSelect),
      E('label', { class: 'field', for: rsvpSelect.id }, '참석 여부', rsvpSelect)),
    E('label', { class: 'check-label', for: mealCheck.id }, mealCheck, '식사 예정 (체크 해제 시 미식사·답례품 수령 대상으로 집계)'),
    E('label', { class: 'field', for: noteInput.id }, '메모 (선택)', noteInput),
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, isEdit ? '하객 정보 저장' : '하객 추가'))
  );

  const submit = form.querySelector('[type="submit"]');
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const name = nameInput.value.trim();
    const partySize = Math.round(Number(sizeInput.value));
    if (!name) { ctx.toast('하객 성함을 입력해 주세요.', true); return; }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) { ctx.toast('동반 포함 인원은 1~20명 사이의 정수로 입력해 주세요.', true); return; }
    const prefs = ctx.getPrefs();
    const curList = [...(prefs.guestList || [])];
    if (!isEdit && curList.length >= 500) { ctx.toast('하객 명단은 500건까지 보관할 수 있습니다.', true); return; }
    const id = isEdit ? existing.id : 'guest-' + crypto.randomUUID().slice(0, 8);
    const note = noteInput.value.trim();
    const entry = {
      id,
      name,
      side: sideSelect.value,
      group: groupSelect.value,
      partySize,
      inviteStatus: inviteSelect.value,
      rsvp: rsvpSelect.value,
      mealTicket: mealCheck.checked,
      ...(note ? { note } : {})
    };
    const nextList = isEdit ? curList.map(g => (g.id === id ? entry : g)) : [...curList, entry];
    saving = true;
    submit.disabled = true;
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), guestList: nextList }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast(isEdit ? `'${name}' 하객 정보를 수정했습니다.` : `'${name}' 하객을 명단에 추가했습니다.`);
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  const snapshot = () => JSON.stringify([nameInput.value, sideSelect.value, groupSelect.value, sizeInput.value, inviteSelect.value, rsvpSelect.value, mealCheck.checked, noteInput.value]);
  const initial = snapshot();
  if (ctx.showDialog(isEdit ? '하객 정보 수정' : '하객 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
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

export function renderGuestListBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const list = prefs.guestList || [];
  const summary = guestListSummary(list);
  const syncTarget = summary.attendingHeadcount > 0 ? summary.attendingHeadcount : summary.possibleHeadcount;
  const syncModeLabel = summary.attendingHeadcount > 0 ? '참석 확정' : '불참 제외 예정';

  const searchInput = E('input', { type: 'search', id: 'guest-search', placeholder: '하객 이름·관계·메모 검색', 'aria-label': '하객 명단 검색' });
  searchInput.value = guestQuery;
  const rsvpSelect = E('select', { id: 'guest-rsvp-filter', 'aria-label': '참석 여부 필터' },
    [['all', '참석 전체'], ...RSVP_STATUSES.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  rsvpSelect.value = guestRsvpFilter;
  const inviteSelect = E('select', { id: 'guest-invite-filter', 'aria-label': '발송 상태 필터' },
    [['all', '발송 전체'], ...INVITE_STATUSES.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  inviteSelect.value = guestInviteFilter;

  const sideBar = E('div', { class: 'ledger-side-pills', role: 'group', 'aria-label': '하객 양가 필터' });
  const listWrap = E('div', { class: 'ledger-items-wrap' });
  const countNode = E('span', { class: 'small muted', 'aria-live': 'polite' });

  const updateGuestField = (guestId, patch) => {
    ctx.queuePreference(async () => {
      const cur = ctx.getPrefs().guestList || [];
      const next = cur.map(item => (item.id === guestId ? { ...item, ...patch } : item));
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), guestList: next });
      if (saved) ctx.render();
      return saved;
    });
  };

  const draw = () => {
    sideBar.replaceChildren(...['all', ...GUEST_SIDES].map(side => {
      const label = side === 'all' ? `전체 (${list.length})` : `${side} (${summary.bySide[side]?.records || 0})`;
      const btn = button(label, () => { guestSideFilter = side; draw(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(guestSideFilter === side));
      return btn;
    }));
    const q = guestQuery.trim().toLocaleLowerCase();
    const filtered = list.filter(item =>
      (guestSideFilter === 'all' || item.side === guestSideFilter) &&
      (guestRsvpFilter === 'all' || item.rsvp === guestRsvpFilter) &&
      (guestInviteFilter === 'all' || item.inviteStatus === guestInviteFilter) &&
      (!q || `${item.name} ${item.side} ${item.group} ${item.note || ''}`.toLocaleLowerCase().includes(q))
    );
    countNode.textContent = `${filtered.length}건 표시 중 (전체 ${list.length}건)`;
    if (!list.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted ledger-empty-note' }, '등록된 하객이 없습니다. 오른쪽 위 ‘+ 하객 추가’ 버튼으로 가족·친구·직장 하객 명단과 청첩장 발송 현황을 정리해 보세요.'));
      return;
    }
    if (!filtered.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted ledger-empty-note' }, '선택한 필터 조건에 맞는 하객이 없습니다.'));
      return;
    }
    listWrap.replaceChildren(E('ul', { class: 'ledger-list' }, filtered.map(item => {
      const rsvpQuick = E('select', { class: 'ledger-inline-select', 'aria-label': `${item.name} 참석 여부 변경` },
        RSVP_STATUSES.map(v => E('option', { value: v }, v)));
      rsvpQuick.value = item.rsvp;
      rsvpQuick.addEventListener('change', () => updateGuestField(item.id, { rsvp: rsvpQuick.value }));

      const inviteQuick = E('select', { class: 'ledger-inline-select', 'aria-label': `${item.name} 청첩장 발송 상태 변경` },
        INVITE_STATUSES.map(v => E('option', { value: v }, v)));
      inviteQuick.value = item.inviteStatus;
      inviteQuick.addEventListener('change', () => updateGuestField(item.id, { inviteStatus: inviteQuick.value }));

      const rsvpTone = item.rsvp === '참석' ? ' direct' : (item.rsvp === '불참' ? '' : ' highlight');
      return E('li', { class: 'ledger-row', 'data-guest-id': item.id },
        E('div', { class: 'ledger-row-main' },
          E('div', { class: 'ledger-row-head' },
            E('strong', { class: 'ledger-row-name' }, item.name),
            E('span', { class: 'spec-chip' }, `${item.side} · ${item.group}`),
            E('span', { class: 'spec-chip' + rsvpTone }, `${item.partySize}명 · ${item.rsvp}`),
            E('span', { class: 'spec-chip' }, item.mealTicket === false ? '🎁 미식사(답례품)' : '🍽️ 식사')),
          item.note ? E('p', { class: 'small muted ledger-row-note' }, item.note) : null),
        E('div', { class: 'ledger-row-controls' },
          inviteQuick,
          rsvpQuick,
          button('+ 장부', () => openGiftEditor(ctx, null, item), 'checklist-note-btn'),
          button('수정', () => openGuestEditor(ctx, item), 'checklist-note-btn'),
          button('삭제', () => {
            if (!confirm(`'${item.name}' 하객을 명단에서 삭제할까요?`)) return;
            ctx.queuePreference(async () => {
              const next = (ctx.getPrefs().guestList || []).filter(g => g.id !== item.id);
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), guestList: next });
              if (saved) { ctx.render(); ctx.toast('하객을 명단에서 삭제했습니다.'); }
              return saved;
            });
          }, 'checklist-note-btn danger-text')));
    })));
  };

  searchInput.addEventListener('input', () => { guestQuery = searchInput.value; draw(); });
  rsvpSelect.addEventListener('change', () => { guestRsvpFilter = rsvpSelect.value; draw(); });
  inviteSelect.addEventListener('change', () => { guestInviteFilter = inviteSelect.value; draw(); });
  draw();

  const syncVenueGuestCount = () => {
    if (!list.length) { ctx.toast('먼저 하객 명단을 1명 이상 등록해 주세요.', true); return; }
    const curPrefs = ctx.getPrefs();
    const curSim = curPrefs.venueSim || { mealPrice: null, guestCount: null, minGuarantee: null, hallFee: null, deposit: null, note: '' };
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...curPrefs, venueSim: { ...curSim, guestCount: syncTarget } });
      if (saved) {
        ctx.render();
        ctx.toast(`하객 명단 ${syncModeLabel} 인원(${syncTarget}명)을 웨딩홀 식대 시뮬레이터에 반영했습니다.`);
      }
      return saved;
    });
  };

  return E('section', { class: 'guest-board private-ledger-section', 'aria-labelledby': 'guest-board-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'PRIVATE GUEST LIST & RSVP TRACKER'),
        E('h2', { id: 'guest-board-title' }, '👥 하객 명단 · 청첩장 발송 · 예상 인원 집계'),
        E('p', {}, '양가 하객 명단, 청첩장 발송 상태, 참석·식사 여부를 정리하고 웨딩홀 식대 시뮬레이터의 예상 인원과 연동할 수 있습니다. (이 기기 전용 · 방문자 화면 및 공개 site.json 제외)')),
      E('div', { class: 'page-actions guest-board-toolbar' },
        button('+ 하객 추가', () => openGuestEditor(ctx)),
        list.length ? button(`🏛️ ${syncModeLabel}(${syncTarget}명) 시뮬레이터 반영`, syncVenueGuestCount, 'button quiet') : null,
        list.length ? button('📥 CSV 내보내기', () => {
          downloadText(guestsToCsv(list), 'wedding-guest-list.csv', 'text/csv;charset=utf-8');
          ctx.toast('하객 명단(wedding-guest-list.csv)을 내려받았습니다.');
        }, 'button quiet') : null)),
    E('div', { class: 'ledger-kpi-grid' },
      E('div', { class: 'ledger-kpi-card is-accent' },
        E('span', { class: 'small muted' }, '참석 확정 인원'),
        E('strong', {}, `${summary.attendingHeadcount}명`),
        E('span', { class: 'small muted' }, `식사 예정 ${summary.mealHeadcount}명`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '불참 제외 예상 인원'),
        E('strong', {}, `${summary.possibleHeadcount}명`),
        E('span', { class: 'small muted' }, `미확인·미정 ${summary.undecidedHeadcount}명 · 불참 ${summary.declinedHeadcount}명`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '청첩장 발송 현황'),
        E('strong', {}, `${summary.sentCount} / ${summary.totalRecords}건`),
        E('span', { class: 'small muted' }, `미발송 ${summary.unsentCount}건`)),
      E('div', { class: 'ledger-kpi-card' },
        E('span', { class: 'small muted' }, '양가별 예상 (불참 제외)'),
        E('strong', {}, `신랑 ${summary.bySide['신랑 측'].possible} · 신부 ${summary.bySide['신부 측'].possible}`),
        E('span', { class: 'small muted' }, `공통 ${summary.bySide['공통'].possible}명 · 전체 ${summary.totalInvitedHeadcount}명`))),
    E('div', { class: 'ledger-filter-bar guest-board-toolbar' },
      sideBar,
      E('div', { class: 'ledger-filter-controls' }, searchInput, inviteSelect, rsvpSelect, countNode)),
    listWrap);
}

export function renderGiftLedgerBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const list = prefs.giftLedger || [];
  const summary = giftLedgerSummary(list);

  const searchInput = E('input', { type: 'search', id: 'gift-search', placeholder: '성함·관계·메모 검색', 'aria-label': '축의금 장부 검색' });
  searchInput.value = giftQuery;
  const channelSelect = E('select', { id: 'gift-channel-filter', 'aria-label': '전달 방식 필터' },
    [['all', '방식 전체'], ...GIFT_CHANNELS.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  channelSelect.value = giftChannelFilter;
  const pendingCheck = E('input', { type: 'checkbox', id: 'gift-pending-only' });
  pendingCheck.checked = giftPendingOnly;

  const sideBar = E('div', { class: 'ledger-side-pills', role: 'group', 'aria-label': '축의금 양가 필터' });
  const listWrap = E('div', { class: 'ledger-items-wrap' });
  const countNode = E('span', { class: 'small muted', 'aria-live': 'polite' });

  const toggleGiftFlag = (giftId, key, val) => {
    ctx.queuePreference(async () => {
      const cur = ctx.getPrefs().giftLedger || [];
      const next = cur.map(item => (item.id === giftId ? { ...item, [key]: val } : item));
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
      if (saved) ctx.render();
      return saved;
    });
  };

  const draw = () => {
    sideBar.replaceChildren(...['all', ...GUEST_SIDES].map(side => {
      const label = side === 'all' ? `전체 (${list.length})` : `${side} (${summary.bySide[side]?.count || 0})`;
      const btn = button(label, () => { giftSideFilter = side; draw(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(giftSideFilter === side));
      return btn;
    }));
    const q = giftQuery.trim().toLocaleLowerCase();
    const filtered = list.filter(item =>
      (giftSideFilter === 'all' || item.side === giftSideFilter) &&
      (giftChannelFilter === 'all' || item.channel === giftChannelFilter) &&
      (!giftPendingOnly || !item.returnGiftDone || !item.thankYouDone) &&
      (!q || `${item.name} ${item.side} ${item.group} ${item.note || ''}`.toLocaleLowerCase().includes(q))
    );
    const filteredTotal = filtered.reduce((acc, item) => acc + (item.amount || 0), 0);
    countNode.textContent = `${filtered.length}건 · 소계 ${won(filteredTotal)}`;

    if (!list.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted ledger-empty-note' }, '등록된 축의금 기록이 없습니다. 본식 당일·이후 축의금과 식권 지급, 답례품·감사 인사 여부를 이 기기에서 안전하게 정산할 수 있습니다.'));
      return;
    }
    if (!filtered.length) {
      listWrap.replaceChildren(E('p', { class: 'small muted ledger-empty-note' }, '선택한 필터 조건에 맞는 축의금 기록이 없습니다.'));
      return;
    }
    listWrap.replaceChildren(E('ul', { class: 'ledger-list' }, filtered.map(item => {
      const retBox = E('input', { type: 'checkbox', 'aria-label': `${item.name} 답례품 전달 완료` });
      retBox.checked = Boolean(item.returnGiftDone);
      retBox.addEventListener('change', () => toggleGiftFlag(item.id, 'returnGiftDone', retBox.checked));

      const thxBox = E('input', { type: 'checkbox', 'aria-label': `${item.name} 감사 인사 완료` });
      thxBox.checked = Boolean(item.thankYouDone);
      thxBox.addEventListener('change', () => toggleGiftFlag(item.id, 'thankYouDone', thxBox.checked));

      return E('li', { class: 'ledger-row', 'data-gift-id': item.id },
        E('div', { class: 'ledger-row-main' },
          E('div', { class: 'ledger-row-head' },
            E('strong', { class: 'ledger-row-name' }, item.name),
            E('strong', { class: 'ledger-amount' }, won(item.amount)),
            E('span', { class: 'spec-chip' }, `${item.side} · ${item.group}`),
            E('span', { class: 'spec-chip' }, item.channel),
            E('span', { class: 'spec-chip' }, `식권 ${item.mealTickets}매`)),
          item.note ? E('p', { class: 'small muted ledger-row-note' }, item.note) : null),
        E('div', { class: 'ledger-row-controls' },
          E('label', { class: 'ledger-inline-check' }, retBox, '답례품'),
          E('label', { class: 'ledger-inline-check' }, thxBox, '감사인사'),
          button('수정', () => openGiftEditor(ctx, item), 'checklist-note-btn'),
          button('삭제', () => {
            if (!confirm(`'${item.name}' 축의금 기록을 삭제할까요?`)) return;
            ctx.queuePreference(async () => {
              const next = (ctx.getPrefs().giftLedger || []).filter(g => g.id !== item.id);
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
              if (saved) { ctx.render(); ctx.toast('축의금 기록을 삭제했습니다.'); }
              return saved;
            });
          }, 'checklist-note-btn danger-text')));
    })));
  };

  searchInput.addEventListener('input', () => { giftQuery = searchInput.value; draw(); });
  channelSelect.addEventListener('change', () => { giftChannelFilter = channelSelect.value; draw(); });
  pendingCheck.addEventListener('change', () => { giftPendingOnly = pendingCheck.checked; draw(); });
  draw();

  return E('section', { class: 'gift-ledger private-ledger-section', 'aria-labelledby': 'gift-ledger-title' },
    E('div', { class: 'section-heading' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'PRIVATE GIFT & THANK-YOU LEDGER'),
        E('h2', { id: 'gift-ledger-title' }, '💌 축의금 · 식권 · 답례품 정산 장부'),
        E('p', {}, '본식 축의금, 식권 지급 매수, 답례품 전달과 감사 인사 완료 여부를 기록하고 엑셀(CSV)로 내려받을 수 있습니다. (이 기기 전용 · 계좌번호 등 민감 정보 입력 금지)')),
      E('div', { class: 'page-actions gift-ledger-toolbar' },
        button('+ 축의금 기록', () => openGiftEditor(ctx)),
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
    E('div', { class: 'ledger-filter-bar gift-ledger-toolbar' },
      sideBar,
      E('div', { class: 'ledger-filter-controls' },
        searchInput,
        channelSelect,
        E('label', { class: 'check-label', for: pendingCheck.id }, pendingCheck, '미완료만 보기'),
        countNode)),
    listWrap);
}
