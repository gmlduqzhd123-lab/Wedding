import { E, button, downloadText, searchBox } from './dom.js?v=wedding-features-57';
import { formatDate } from './content.js?v=wedding-features-57';
import { GUEST_SIDES, GUEST_GROUPS, INVITE_STATUSES, RSVP_STATUSES, GIFT_CHANNELS } from './preferences.js?v=wedding-features-57';
import { guestListSummary, giftLedgerSummary, guestsToCsv, giftsToCsv, parseGuestsCsv, syncGuestsFromCsv, RSVP_FORM_GUIDE_TEXT, buildThankYouMessage } from './planning.js?v=wedding-features-57';
import { renderSideRatioBar } from './charts.js?v=wedding-features-57';

let guestSideFilter = 'all';
let guestRsvpFilter = 'all';
let guestInviteFilter = 'all';
let guestQuery = '';

let giftSideFilter = 'all';
let giftChannelFilter = 'all';
let giftPendingOnly = false;
let giftUnthankedOnly = false;
let giftQuery = '';
let quickEntrySide = '신랑 측';
let quickEntryChannel = '축의대(현금)';

const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

function printDedicatedSheet(bodyClass, sheetNode) {
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

function buildGuestPrintSheet(ctx, list) {
  const info = ctx.getContent()?.invitation || {};
  const couple = [info.partner1, info.partner2].filter(Boolean).join(' · ') || '웨딩 축의대';
  const when = [info.date ? formatDate(info.date) : '', info.time || '', info.venue || ''].filter(Boolean).join(' · ');
  const summary = guestListSummary(list);
  const sideOrder = { '신랑 측': 0, '신부 측': 1, '공통': 2 };
  const sorted = [...list].sort((a, b) =>
    (sideOrder[a.side] ?? 9) - (sideOrder[b.side] ?? 9) ||
    String(a.group || '').localeCompare(String(b.group || ''), 'ko') ||
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
  );
  const blankRows = Array.from({ length: 10 }, (_, idx) => E('tr', { class: 'print-blank-row' },
    E('td', { class: 'num' }, String(sorted.length + idx + 1)),
    E('td', {}, ''), E('td', {}, ''), E('td', {}, ''), E('td', { class: 'num' }, ''),
    E('td', {}, ''), E('td', {}, ''), E('td', { class: 'num' }, ''), E('td', {}, '')));
  return E('section', { class: 'print-only-sheet guest-print-sheet', 'aria-label': '축의대 현장 하객 명부 인쇄 양식' },
    E('header', { class: 'print-sheet-header' },
      E('div', {},
        E('p', { class: 'print-sheet-eyebrow' }, 'RECEPTION DESK GUEST SHEET'),
        E('h1', {}, `${couple} · 축의대 하객 명부`),
        when ? E('p', { class: 'print-sheet-meta' }, when) : null),
      E('div', { class: 'print-sheet-kpis' },
        E('span', {}, `등록 ${summary.totalRecords}건`),
        E('span', {}, `참석 확정 ${summary.attendingHeadcount}명`),
        E('span', {}, `불참 제외 예상 ${summary.possibleHeadcount}명`),
        E('span', {}, `식사 예정 ${summary.mealHeadcount}명`))),
    E('table', { class: 'print-sheet-table' },
      E('thead', {},
        E('tr', {},
          ['번호', '양가', '관계', '성함', '인원', '참석·식사', '축의금 (현장기입)', '식권(매)', '메모·비고'].map(col => E('th', { scope: 'col' }, col)))),
      E('tbody', {},
        ...sorted.map((item, idx) => E('tr', {},
          E('td', { class: 'num' }, String(idx + 1)),
          E('td', {}, item.side || ''),
          E('td', {}, item.group || ''),
          E('td', { class: 'strong' }, item.name || ''),
          E('td', { class: 'num' }, `${item.partySize ?? 1}명`),
          E('td', {}, `${item.rsvp || '미확인'} · ${item.mealTicket === false ? '미식사' : '식사'}`),
          E('td', {}, ''),
          E('td', { class: 'num' }, ''),
          E('td', {}, item.note || ''))),
        ...blankRows)),
    E('p', { class: 'print-sheet-foot' }, '※ 현장 방문 하객은 아래 빈 칸에 성함·축의금·식권 수량을 기록해 주세요. 본 문서는 개인 관리용으로 공개 저장소에 업로드하지 않습니다.'));
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

export function openGuestCsvImportModal(ctx) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  const fileInput = E('input', { type: 'file', accept: '.csv,text/csv', class: 'file-input', id: 'guest-csv-file', 'aria-label': '하객 명단 CSV 파일 선택' });
  const previewWrap = E('div', { class: 'csv-import-preview', 'aria-live': 'polite' });
  const modeUpdateRadio = E('input', { type: 'radio', name: 'csv-import-mode', value: 'update', id: 'csv-mode-update' });
  const modeSkipRadio = E('input', { type: 'radio', name: 'csv-import-mode', value: 'skip', id: 'csv-mode-skip', checked: true });
  const modeAllRadio = E('input', { type: 'radio', name: 'csv-import-mode', value: 'all', id: 'csv-mode-all' });
  const modeWrap = E('div', { class: 'pref-restore-modes', hidden: true },
    E('label', { class: 'check-label', for: modeUpdateRadio.id }, modeUpdateRadio, '기존 하객 참석·인원·식사 업데이트 + 신규 추가 (RSVP 동기화 권장)'),
    E('label', { class: 'check-label', for: modeSkipRadio.id }, modeSkipRadio, '같은 양가·성함 중복 건너뛰고 신규만 추가'),
    E('label', { class: 'check-label', for: modeAllRadio.id }, modeAllRadio, '중복 포함 전체 추가 (동명이인 포함)'));

  const submit = E('button', { class: 'button', type: 'submit', disabled: true }, '하객 명단에 가져오기');
  let parsed = null;
  let saving = false;

  const selectedMode = () => (modeUpdateRadio.checked ? 'update' : modeAllRadio.checked ? 'all' : 'skip');

  const computeSync = () => {
    if (!parsed) return null;
    const curList = ctx.getPrefs().guestList || [];
    return syncGuestsFromCsv(curList, parsed.records, selectedMode());
  };

  const renderPreview = () => {
    if (!parsed) {
      previewWrap.replaceChildren();
      modeWrap.hidden = true;
      submit.disabled = true;
      return;
    }
    const plan = computeSync();
    const totalChanges = plan.addedCount + plan.updatedCount;
    modeWrap.hidden = false;
    submit.disabled = saving || totalChanges === 0 || plan.overCap;
    if (plan.updatedCount > 0 && plan.addedCount > 0) {
      submit.textContent = `${plan.updatedCount}건 업데이트 · ${plan.addedCount}건 추가`;
    } else if (plan.updatedCount > 0) {
      submit.textContent = `기존 하객 ${plan.updatedCount}건 RSVP 반영`;
    } else if (plan.addedCount > 0) {
      submit.textContent = `${plan.addedCount}건 하객 명단에 추가`;
    } else {
      submit.textContent = '반영할 변경 없음';
    }

    const headRows = parsed.records.slice(0, 8);
    previewWrap.replaceChildren(...[
      parsed.isRsvpForm ? E('p', { class: 'spec-chip direct' }, '💌 Google Forms / RSVP 응답 형식 자동 인식') : null,
      E('p', { class: 'form-note' + (plan.overCap ? ' warning' : '') },
        `총 ${parsed.records.length}건 인식${parsed.skipped ? ` (빈 행 제외 ${parsed.skipped}건)` : ''} → ` +
        `신규 추가 ${plan.addedCount}건 · 기존 업데이트 ${plan.updatedCount}건` +
        `${plan.skippedCount ? ` · 중복 건너뜀 ${plan.skippedCount}건` : ''} (반영 후 총 ${plan.nextList.length}/500건)` +
        (plan.overCap ? '\n하객 명단은 최대 500건까지 보관할 수 있습니다. 중복 제외를 선택하거나 행 수를 줄여 주세요.' : '')),
      parsed.warnings.length ? E('p', { class: 'small muted' }, `참고 안내: ${parsed.warnings.slice(0, 3).join(' / ')}${parsed.warnings.length > 3 ? ` 외 ${parsed.warnings.length - 3}건` : ''}`) : null,
      E('div', { class: 'table-scroll' },
        E('table', { class: 'csv-preview-table' },
          E('thead', {}, E('tr', {}, ['구분', '관계', '성함', '인원', '발송', '참석', '식사'].map(h => E('th', { scope: 'col' }, h)))),
          E('tbody', {}, headRows.map(r => E('tr', {},
            E('td', {}, r.side),
            E('td', {}, r.group),
            E('td', {}, r.name),
            E('td', {}, `${r.partySize}명`),
            E('td', {}, r.inviteStatus),
            E('td', {}, r.rsvp),
            E('td', {}, r.mealTicket ? '식사' : '미식사')))))),
      parsed.records.length > headRows.length ? E('p', { class: 'small muted' }, `… 외 ${parsed.records.length - headRows.length}건 더 있습니다.`) : null
    ].filter(Boolean));
  };

  modeUpdateRadio.addEventListener('change', renderPreview);
  modeSkipRadio.addEventListener('change', renderPreview);
  modeAllRadio.addEventListener('change', renderPreview);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) { parsed = null; renderPreview(); return; }
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('CSV 파일은 2MB 이하로 선택해 주세요.');
      const text = await file.text();
      parsed = parseGuestsCsv(text);
      if (parsed.isRsvpForm) modeUpdateRadio.checked = true;
      renderPreview();
    } catch (error) {
      parsed = null;
      renderPreview();
      ctx.toast(error.message || 'CSV 파일을 읽지 못했습니다.', true);
    }
  });

  const downloadSample = () => {
    const sampleCsv = guestsToCsv([
      { side: '신랑 측', group: '친구', name: '예시_홍길동', partySize: 2, inviteStatus: '모바일 발송', rsvp: '참석', mealTicket: true, note: '가족 동반 2명' },
      { side: '신부 측', group: '직장·동료', name: '예시_김영희', partySize: 1, inviteStatus: '종이 전달', rsvp: '미확인', mealTicket: true, note: '' },
      { side: '공통', group: '지인·기타', name: '예시_이철수', partySize: 1, inviteStatus: '미발송', rsvp: '불참', mealTicket: false, note: '답례품 전달 예정' }
    ]);
    downloadText(sampleCsv, 'wedding-guest-sample.csv', 'text/csv;charset=utf-8');
    ctx.toast('하객 명단 예시 양식(wedding-guest-sample.csv)을 내려받았습니다.');
  };

  form.append(
    E('p', { class: 'form-note' }, '엑셀·구글 시트 명단 또는 Google Forms RSVP 설문 응답 CSV(UTF-8)를 한 번에 가져올 수 있습니다. ‘성함/이름’, ‘어느 측’, ‘참석 여부’, ‘본인 포함 인원수’, ‘식사 여부’, ‘축하 메시지’ 열을 자동 인식하며, 기존 명단과 RSVP를 바로 동기화할 수 있습니다.'),
    E('div', { class: 'page-actions' },
      button('📄 예시 CSV 양식 받기', downloadSample, 'button quiet'),
      button('📋 RSVP 설문 질문 양식 복사', () => ctx.copyTextToClipboard(RSVP_FORM_GUIDE_TEXT, 'Google Forms / 네이버 폼용 RSVP 질문 구성을 복사했습니다.', 'RSVP 설문 질문 양식'), 'button quiet')),
    E('label', { class: 'field', for: fileInput.id }, '하객 명단 CSV 파일 선택', fileInput),
    modeWrap,
    previewWrap,
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit)
  );

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !parsed) return;
    const plan = computeSync();
    if (!plan || (plan.addedCount === 0 && plan.updatedCount === 0)) { ctx.toast('새로 반영할 하객 변경이 없습니다.', true); return; }
    if (plan.overCap) { ctx.toast('하객 명단은 500건까지 보관할 수 있습니다.', true); return; }
    saving = true;
    submit.disabled = true;
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), guestList: plan.nextList }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        const msg = plan.updatedCount > 0 && plan.addedCount > 0
          ? `CSV에서 기존 하객 ${plan.updatedCount}건 업데이트·신규 ${plan.addedCount}건 추가했습니다.`
          : plan.updatedCount > 0
            ? `RSVP CSV로 기존 하객 ${plan.updatedCount}건의 참석·식사 정보를 업데이트했습니다.`
            : `CSV에서 하객 ${plan.addedCount}건을 명단에 추가했습니다.`;
        ctx.toast(msg);
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      renderPreview();
    }
  });

  if (ctx.showDialog('📤 하객 명단 · RSVP CSV 가져오기', form)) {
    ctx.setEditorState({ isDirty: () => saving || Boolean(parsed), isSaving: () => saving });
  }
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

  const rsvpSelect = E('select', { id: 'guest-rsvp-filter', 'aria-label': '참석 여부 필터' },
    [['all', '참석 전체'], ...RSVP_STATUSES.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  rsvpSelect.value = guestRsvpFilter;
  const inviteSelect = E('select', { id: 'guest-invite-filter', 'aria-label': '발송 상태 필터' },
    [['all', '발송 전체'], ...INVITE_STATUSES.map(v => [v, v])].map(([v, label]) => E('option', { value: v }, label)));
  inviteSelect.value = guestInviteFilter;

  const sideBar = E('div', { class: 'ledger-side-pills', role: 'group', 'aria-label': '하객 양가 필터' });
  const listWrap = E('div', { class: 'ledger-items-wrap' });
  const countNode = E('span', { class: 'small muted', 'aria-live': 'polite' });
  const resetWrap = E('span', { class: 'filter-reset-slot' });

  const search = searchBox({
    id: 'guest-search',
    value: guestQuery,
    placeholder: '하객 이름·관계·메모 검색',
    ariaLabel: '하객 명단 검색',
    onInput: val => { guestQuery = val; draw(); }
  });

  const updateGuestField = (guestId, patch, toastMsg = '') => {
    ctx.queuePreference(async () => {
      const cur = ctx.getPrefs().guestList || [];
      const next = cur.map(item => (item.id === guestId ? { ...item, ...patch } : item));
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), guestList: next });
      if (saved) {
        ctx.render();
        if (toastMsg) ctx.toast(toastMsg);
      }
      return saved;
    });
  };

  const resetGuestFilters = () => {
    guestSideFilter = 'all';
    guestRsvpFilter = 'all';
    guestInviteFilter = 'all';
    guestQuery = '';
    search.input.value = '';
    search.syncClear();
    rsvpSelect.value = 'all';
    inviteSelect.value = 'all';
    draw();
  };

  const draw = () => {
    sideBar.replaceChildren(...['all', ...GUEST_SIDES].map(side => {
      const label = side === 'all' ? `전체 (${list.length})` : `${side} (${summary.bySide[side]?.records || 0})`;
      const btn = button(label, () => { guestSideFilter = side; draw(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(guestSideFilter === side));
      return btn;
    }));
    const activeCount = [
      guestSideFilter !== 'all',
      guestRsvpFilter !== 'all',
      guestInviteFilter !== 'all',
      Boolean(guestQuery.trim())
    ].filter(Boolean).length;
    resetWrap.replaceChildren(...(activeCount ? [button(`✕ 필터 초기화 (${activeCount})`, resetGuestFilters, 'filter-reset-chip')] : []));

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
      listWrap.replaceChildren(E('div', { class: 'no-results-box ledger-empty-box' },
        E('p', { class: 'no-results' }, '선택한 필터 조건에 맞는 하객이 없습니다.'),
        activeCount ? button('모든 필터 초기화', resetGuestFilters, 'button quiet') : null));
      return;
    }
    listWrap.replaceChildren(E('ul', { class: 'ledger-list' }, filtered.map(item => {
      const nextInvite = INVITE_STATUSES[(INVITE_STATUSES.indexOf(item.inviteStatus) + 1) % INVITE_STATUSES.length];
      const inviteCycleBtn = E('button', {
        type: 'button',
        class: 'quick-cycle-btn' + (item.inviteStatus !== '미발송' ? ' is-done' : ''),
        title: `눌러서 발송 상태 변경 → ${nextInvite}`,
        'aria-label': `${item.name} 청첩장 발송 상태 변경 (현재 ${item.inviteStatus}, 누르면 ${nextInvite})`,
        onclick: () => updateGuestField(item.id, { inviteStatus: nextInvite }, `${item.name}님 발송 상태를 ‘${nextInvite}’(으)로 변경했습니다.`)
      }, `📨 ${item.inviteStatus} ↻`);

      const nextRsvp = RSVP_STATUSES[(RSVP_STATUSES.indexOf(item.rsvp) + 1) % RSVP_STATUSES.length];
      const rsvpTone = item.rsvp === '참석' ? ' is-done' : (item.rsvp === '불참' ? ' is-muted' : ' is-warn');
      const rsvpCycleBtn = E('button', {
        type: 'button',
        class: 'quick-cycle-btn' + rsvpTone,
        title: `눌러서 참석 여부 변경 → ${nextRsvp}`,
        'aria-label': `${item.name} 참석 여부 변경 (현재 ${item.rsvp}, 누르면 ${nextRsvp})`,
        onclick: () => updateGuestField(item.id, { rsvp: nextRsvp }, `${item.name}님 참석 여부를 ‘${nextRsvp}’(으)로 변경했습니다.`)
      }, `${item.rsvp === '참석' ? '✓' : item.rsvp === '불참' ? '✕' : '•'} ${item.rsvp} ↻`);

      return E('li', { class: 'ledger-row', 'data-guest-id': item.id },
        E('div', { class: 'ledger-row-main' },
          E('div', { class: 'ledger-row-head' },
            E('strong', { class: 'ledger-row-name' }, item.name),
            E('span', { class: 'spec-chip' }, `${item.side} · ${item.group}`),
            E('span', { class: 'spec-chip' }, `${item.partySize}명`),
            E('span', { class: 'spec-chip' }, item.mealTicket === false ? '🎁 미식사(답례품)' : '🍽️ 식사')),
          item.note ? E('p', { class: 'small muted ledger-row-note' }, item.note) : null),
        E('div', { class: 'ledger-row-controls' },
          inviteCycleBtn,
          rsvpCycleBtn,
          button('+ 장부', () => openGiftEditor(ctx, null, item), 'checklist-note-btn'),
          button('수정', () => openGuestEditor(ctx, item), 'checklist-note-btn'),
          button('삭제', () => {
            ctx.queuePreference(async () => {
              const latest = ctx.getPrefs().guestList || [];
              const removedIndex = latest.findIndex(g => g.id === item.id);
              if (removedIndex < 0) return true;
              const snapshot = structuredClone(latest[removedIndex]);
              const next = latest.filter(g => g.id !== item.id);
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), guestList: next });
              if (saved) {
                ctx.render();
                ctx.toast(`‘${item.name}’ 하객을 명단에서 삭제했습니다.`, {
                  undoLabel: '되돌리기',
                  onUndo: () => ctx.queuePreference(async () => {
                    const cur = [...(ctx.getPrefs().guestList || [])];
                    if (cur.some(g => g.id === snapshot.id)) return true;
                    cur.splice(Math.min(removedIndex, cur.length), 0, snapshot);
                    const restored = await ctx.savePrefs({ ...ctx.getPrefs(), guestList: cur });
                    if (restored) { ctx.render(); ctx.toast(`‘${snapshot.name}’ 하객을 명단에 복구했습니다.`); }
                    return restored;
                  })
                });
              }
              return saved;
            });
          }, 'checklist-note-btn danger-text')));
    })));
  };

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
        E('p', {}, '양가 하객 명단, 청첩장 발송 상태, 참석·식사 여부를 정리하고 배지를 한 번 눌러 발송·참석 상태를 빠르게 바꿀 수 있습니다. (이 기기 전용)')),
      E('div', { class: 'page-actions guest-board-toolbar' },
        button('+ 하객 추가', () => openGuestEditor(ctx)),
        button('📤 CSV 가져오기', () => openGuestCsvImportModal(ctx), 'button quiet'),
        list.length ? button(`🏛️ ${syncModeLabel}(${syncTarget}명) 시뮬레이터 반영`, syncVenueGuestCount, 'button quiet') : null,
        button('🖨️ 축의대 명부 인쇄', () => printDedicatedSheet('print-guest-sheet', buildGuestPrintSheet(ctx, list)), 'button quiet'),
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
    renderSideRatioBar({
      title: '📊 양가별 예상 인원 비중 (불참 제외)',
      unit: '명',
      entries: [
        { label: '신랑 측', value: summary.bySide['신랑 측']?.possible || 0, cls: 'ratio-seg-groom' },
        { label: '신부 측', value: summary.bySide['신부 측']?.possible || 0, cls: 'ratio-seg-bride' },
        { label: '공통', value: summary.bySide['공통']?.possible || 0, cls: 'ratio-seg-common' }
      ]
    }),
    E('div', { class: 'ledger-filter-bar guest-board-toolbar' },
      sideBar,
      E('div', { class: 'ledger-filter-controls' }, search.wrap, inviteSelect, rsvpSelect, resetWrap, countNode)),
    listWrap);
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
    const matched = guestList.find(g => g.name.trim().toLocaleLowerCase() === typed && g.side === quickEntrySide)
      || guestList.find(g => g.name.trim().toLocaleLowerCase() === typed);
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
    const sessionAmount = sessionEntries.reduce((s, e) => s + e.amount, 0);
    const sessionTickets = sessionEntries.reduce((s, e) => s + e.mealTickets, 0);
    statusBar.textContent = sessionEntries.length
      ? `⚡ 이번 접수 ${sessionEntries.length}건 · 합계 ${won(sessionAmount)} · 식권 ${sessionTickets}매`
      : '양가·방식을 고정해 두고 성함과 금액만 빠르게 연속 입력할 수 있어요.';
    if (!sessionEntries.length) {
      recentWrap.replaceChildren();
      return;
    }
    recentWrap.replaceChildren(
      E('p', { class: 'small muted' }, '방금 입력한 내역 (최신순)'),
      E('ul', { class: 'quick-gift-recent-list' }, sessionEntries.slice(0, 4).map(entry => E('li', { class: 'quick-gift-recent-item' },
        E('span', { class: 'small' }, `${entry.name} · ${entry.side} · ${won(entry.amount)} · 식권 ${entry.mealTickets}매`),
        button('되돌리기', async () => {
          const saved = await ctx.queuePreference(async () => {
            const next = (ctx.getPrefs().giftLedger || []).filter(g => g.id !== entry.id);
            return ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: next });
          });
          if (saved) {
            const idx = sessionEntries.findIndex(e => e.id === entry.id);
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
    E('label', { class: 'check-label', for: returnCheck.id }, returnCheck, '답례품 바로 전달함'),
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
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), giftLedger: [...(ctx.getPrefs().giftLedger || []), entry] }));
      if (saved) {
        sessionEntries.unshift(entry);
        nameInput.value = '';
        noteInput.value = '';
        returnCheck.checked = false;
        ticketsInput.value = '1';
        renderSessionSummary();
        ctx.render();
        ctx.toast(`✅ ${entry.name}님 (${won(entry.amount)}) 접수 완료`);
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

export function renderGiftLedgerBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const list = prefs.giftLedger || [];
  const summary = giftLedgerSummary(list);

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

  const resetGiftFilters = () => {
    giftSideFilter = 'all';
    giftChannelFilter = 'all';
    giftPendingOnly = false;
    giftUnthankedOnly = false;
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
      Boolean(giftQuery.trim())
    ].filter(Boolean).length;
    resetWrap.replaceChildren(...(activeCount ? [button(`✕ 필터 초기화 (${activeCount})`, resetGiftFilters, 'filter-reset-chip')] : []));

    const q = giftQuery.trim().toLocaleLowerCase();
    const filtered = list.filter(item =>
      (giftSideFilter === 'all' || item.side === giftSideFilter) &&
      (giftChannelFilter === 'all' || item.channel === giftChannelFilter) &&
      (!giftPendingOnly || !item.returnGiftDone || !item.thankYouDone) &&
      (!giftUnthankedOnly || !item.thankYouDone) &&
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
        summary.thankYouPending > 0 && !giftUnthankedOnly
          ? button(`미감사 ${summary.thankYouPending}건만 보기`, () => { giftUnthankedOnly = true; unthankedCheck.checked = true; draw(); }, 'text-button small')
          : null),
      E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill', style: `width:${thankYouPct}%` }))) : null,
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
