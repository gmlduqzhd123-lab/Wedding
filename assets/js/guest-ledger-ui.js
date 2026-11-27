import { E, button, downloadText, searchBox } from './dom.js?v=wedding-features-73';
import { formatDate } from './content.js?v=wedding-features-73';
import { GUEST_SIDES, GUEST_GROUPS, INVITE_STATUSES, RSVP_STATUSES } from './preferences.js?v=wedding-features-73';
import { guestListSummary, guestsToCsv, parseGuestsCsv, parseQuickGuestText, syncGuestsFromCsv, RSVP_FORM_GUIDE_TEXT, estimateBanquetTables, crossCheckGuestsAndGifts } from './planning.js?v=wedding-features-73';
import { renderSideRatioBar } from './charts.js?v=wedding-features-73';
import {
  printDedicatedSheet,
  openThankYouModal,
  openBatchThankYouModal,
  openGiftEditor,
  openQuickGiftEntryModal,
  renderGiftLedgerBoard,
  focusGiftSearch
} from './gift-ledger-ui.js?v=wedding-features-73';

export { openThankYouModal, openBatchThankYouModal, openGiftEditor, openQuickGiftEntryModal, renderGiftLedgerBoard, focusGiftSearch };

let guestSideFilter = 'all';
let guestRsvpFilter = 'all';
let guestInviteFilter = 'all';
let guestNoGiftOnly = false;
let guestQuery = '';

export function focusGuestSearch(query = '') {
  guestSideFilter = 'all';
  guestRsvpFilter = 'all';
  guestInviteFilter = 'all';
  guestNoGiftOnly = false;
  guestQuery = String(query || '');
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

export function openGuestCsvImportModal(ctx) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  let importTab = 'paste';
  const fileInput = E('input', { type: 'file', accept: '.csv,text/csv', class: 'file-input', id: 'guest-csv-file', 'aria-label': '하객 명단 CSV 파일 선택' });
  const defaultSideSel = E('select', { id: 'guest-bulk-side' }, GUEST_SIDES.map(v => E('option', { value: v }, v)));
  const defaultGroupSel = E('select', { id: 'guest-bulk-group' }, GUEST_GROUPS.map(v => E('option', { value: v }, v)));
  defaultGroupSel.value = '친구';
  const bulkTextInput = E('textarea', {
    id: 'guest-bulk-text',
    rows: '6',
    placeholder: '한 줄에 한 분씩 붙여넣어 주세요 (카톡·메모장·엑셀 복사본 모두 가능)\n예:\n홍길동\n김영희 2명\n박민수 (직장, 부부동반 2명)\n이철수 - 신부측 가족 참석'
  });
  const parseErrorEl = E('p', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
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
      submit.textContent = '하객 명단에 가져오기';
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

  const reparsePaste = () => {
    const raw = bulkTextInput.value.trim();
    if (!raw) {
      parsed = null;
      parseErrorEl.textContent = '';
      renderPreview();
      return;
    }
    try {
      parsed = parseQuickGuestText(raw, { defaultSide: defaultSideSel.value, defaultGroup: defaultGroupSel.value });
      if (parsed.isRsvpForm) modeUpdateRadio.checked = true;
      parseErrorEl.textContent = '';
      renderPreview();
    } catch (error) {
      parsed = null;
      parseErrorEl.textContent = error.message || '명단을 인식하지 못했습니다.';
      renderPreview();
    }
  };

  bulkTextInput.addEventListener('input', reparsePaste);
  defaultSideSel.addEventListener('change', reparsePaste);
  defaultGroupSel.addEventListener('change', reparsePaste);

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
    const sampleCsv = guestsToCsv([
      { side: '신랑 측', group: '친구', name: '예시_홍길동', partySize: 2, inviteStatus: '모바일 발송', rsvp: '참석', mealTicket: true, note: '가족 동반 2명' },
      { side: '신부 측', group: '직장·동료', name: '예시_김영희', partySize: 1, inviteStatus: '종이 전달', rsvp: '미확인', mealTicket: true, note: '' },
      { side: '공통', group: '지인·기타', name: '예시_이철수', partySize: 1, inviteStatus: '미발송', rsvp: '불참', mealTicket: false, note: '답례품 전달 예정' }
    ]);
    downloadText(sampleCsv, 'wedding-guest-sample.csv', 'text/csv;charset=utf-8');
    ctx.toast('하객 명단 예시 양식(wedding-guest-sample.csv)을 내려받았습니다.');
  };

  const pasteSection = E('div', { class: 'editor-form' },
    E('p', { class: 'form-note' }, '카카오톡·메모장에 적어 둔 명단을 그대로 붙여넣으면 이름·인원(‘2명’, ‘외 1명’)·관계·참석 여부를 자동 인식해 한 번에 등록합니다. 엑셀/구글 시트 표 복사(헤더 포함)도 바로 인식해요.'),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: defaultSideSel.id }, '기본 양가 구분', defaultSideSel),
      E('label', { class: 'field', for: defaultGroupSel.id }, '기본 관계 분류', defaultGroupSel)),
    E('label', { class: 'field', for: bulkTextInput.id }, '하객 명단 텍스트 붙여넣기', bulkTextInput));

  const csvSection = E('div', { class: 'editor-form', hidden: true },
    E('p', { class: 'form-note' }, '엑셀·구글 시트 명단 또는 Google Forms RSVP 설문 응답 CSV(UTF-8)를 한 번에 가져올 수 있습니다. ‘성함/이름’, ‘어느 측’, ‘참석 여부’, ‘본인 포함 인원수’, ‘식사 여부’, ‘축하 메시지’ 열을 자동 인식하며, 기존 명단과 RSVP를 바로 동기화할 수 있습니다.'),
    E('div', { class: 'page-actions' },
      button('📄 예시 CSV 양식 받기', downloadSample, 'button quiet'),
      button('📋 RSVP 설문 질문 양식 복사', () => ctx.copyTextToClipboard(RSVP_FORM_GUIDE_TEXT, 'Google Forms / 네이버 폼용 RSVP 질문 구성을 복사했습니다.', 'RSVP 설문 질문 양식'), 'button quiet')),
    E('label', { class: 'field', for: fileInput.id }, '하객 명단 CSV 파일 선택', fileInput));

  const tabBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '하객 일괄 가져오기 방식 선택' });
  const syncTabs = () => {
    pasteSection.hidden = importTab !== 'paste';
    csvSection.hidden = importTab !== 'csv';
    tabBar.replaceChildren(...[
      ['paste', '📋 카톡·텍스트 붙여넣기'],
      ['csv', '📄 CSV · RSVP 파일 업로드']
    ].map(([key, label]) => E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-guest-import-tab': key,
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
          ? `하객 ${plan.updatedCount}건 업데이트·신규 ${plan.addedCount}건 일괄 등록했습니다.`
          : plan.updatedCount > 0
            ? `기존 하객 ${plan.updatedCount}건의 참석·식사 정보를 업데이트했습니다.`
            : `하객 ${plan.addedCount}건을 명단에 일괄 추가했습니다.`;
        ctx.toast(msg);
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      renderPreview();
    }
  });

  if (ctx.showDialog('📤 하객 명단 일괄 등록 (붙여넣기 · CSV)', form)) {
    ctx.setEditorState({ isDirty: () => saving || Boolean(parsed) || Boolean(bulkTextInput.value.trim()), isSaving: () => saving });
  }
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

export function buildPersonalizedInviteMessage(guest = {}, inv = {}, publicUrl = '', tone = 'auto') {
  const name = String(guest?.name || '').trim();
  const group = guest?.group || '';
  const resolvedTone = tone === 'auto'
    ? (group === '친구' ? 'warm' : group === '가족·친척' ? 'family' : 'formal')
    : tone;
  const p1 = (inv?.partner1 || '신랑').replace(/^신랑\s*/, '').trim();
  const p2 = (inv?.partner2 || '신부').replace(/^신부\s*/, '').trim();
  const couple = [p1, p2].filter(Boolean).join(' · ') || '저희 두 사람';
  const dateText = inv?.date ? formatDate(inv.date) : '예식일 추후 안내';
  const timeText = inv?.time || '';
  const venue = inv?.venue || '예식장 추후 안내';
  const address = inv?.address || '';
  const link = publicUrl || (typeof location !== 'undefined' ? new URL('./?view=guest#/invitation', location.href).href : '');
  const whenLine = `• 일시: ${[dateText, timeText].filter(Boolean).join(' ')}`;
  const whereLine = `• 장소: ${venue}${address ? ` (${address})` : ''}`;
  const linkLine = link ? `💌 모바일 청첩장 보기: ${link}` : '';

  if (resolvedTone === 'warm') {
    const greet = name ? `${name}아(야) 안녕! / ${name}님 안녕하세요 😊` : '안녕! 반가운 소식 전해 😊';
    return [
      greet,
      `${couple} 드디어 결혼하게 되었어!`,
      '바쁘겠지만 시간 되시면 꼭 오셔서 함께 축하해 주고 맛있는 식사도 하고 가줘 💐',
      '',
      whenLine,
      whereLine,
      ...(linkLine ? ['', linkLine] : [])
    ].join('\n');
  }
  if (resolvedTone === 'family') {
    const greet = name ? `${name} 어르신(님), 안녕하세요.` : '안녕하세요.';
    return [
      greet,
      `평소 아껴주신 따뜻한 마음 덕분에 ${couple}이 부부로서 새로운 출발을 하게 되었습니다.`,
      '귀한 걸음으로 자리를 빛내어 축복해 주시면 큰 기쁨이 되겠습니다.',
      '',
      whenLine,
      whereLine,
      ...(linkLine ? ['', linkLine] : [])
    ].join('\n');
  }
  const greet = name ? `${name}님, 안녕하세요.` : '안녕하세요.';
  return [
    greet,
    `그동안 보내주신 관심과 응원 속에 ${couple}이 하나 되어 새로운 출발을 하게 되었습니다.`,
    '직접 찾아뵙고 인사드리는 것이 도리이나 이렇게 먼저 소식 전하게 되어 송구합니다. 귀한 시간 내어 축복해 주시면 감사하겠습니다.',
    '',
    whenLine,
    whereLine,
    ...(linkLine ? ['', linkLine] : [])
  ].join('\n');
}

export function openBatchInviteModal(ctx, initialList = null) {
  if (ctx.isGuestMode()) return;
  const source = Array.isArray(initialList) ? initialList : (ctx.getPrefs().guestList || []);
  const queue = source.filter(g => g.inviteStatus === '미발송').map(g => g.id);
  if (!queue.length) {
    ctx.toast('미발송 상태인 하객이 없습니다.');
    return;
  }
  const inv = ctx.getContent()?.invitation || {};
  const publicUrl = new URL('./?view=guest#/invitation', location.href).href;
  let index = 0;
  let sentNow = 0;
  let skipped = 0;
  let currentTone = 'auto';
  const root = E('div', { class: 'batch-thankyou-modal batch-invite-modal' });

  const renderStep = () => {
    const latestList = ctx.getPrefs().guestList || [];
    while (index < queue.length) {
      const candidate = latestList.find(g => g.id === queue[index]);
      if (candidate && candidate.inviteStatus === '미발송') break;
      index++;
    }
    const doneSteps = Math.min(index, queue.length);
    const pct = Math.round((doneSteps / queue.length) * 100);

    if (index >= queue.length) {
      root.replaceChildren(
        E('div', { class: 'batch-thankyou-done' },
          E('strong', {}, `🎉 미발송 하객 ${queue.length}명 큐를 마쳤습니다!`),
          E('p', { class: 'small muted' }, `이번 작업에서 모바일 발송 완료 ${sentNow}명${skipped ? ` · 건너뜀 ${skipped}명` : ''} 처리했습니다.`),
          E('div', { class: 'page-actions' },
            button('하객 명단으로 돌아가기', () => { ctx.closeDialog(); ctx.render(); }, 'button'))));
      return;
    }

    const guest = latestList.find(g => g.id === queue[index]);
    const textarea = E('textarea', { id: 'batch-invite-text', rows: '8' });
    textarea.value = buildPersonalizedInviteMessage(guest, inv, publicUrl, currentTone);

    const markSentAndNext = async (mode = 'copy') => {
      const msg = textarea.value.trim();
      if (mode === 'copy') {
        await ctx.copyTextToClipboard(msg, `${guest.name}님 초대 문구를 복사하고 모바일 발송 완료로 표시했습니다.`, '맞춤 청첩장 문구 복사');
      } else if (mode === 'share' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: '모바일 청첩장', text: msg, url: publicUrl });
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      const saved = await ctx.queuePreference(async () => {
        const cur = ctx.getPrefs().guestList || [];
        const next = cur.map(item => (item.id === guest.id ? { ...item, inviteStatus: '모바일 발송' } : item));
        return ctx.savePrefs({ ...ctx.getPrefs(), guestList: next });
      });
      if (saved) {
        sentNow++;
        index++;
        ctx.render();
        renderStep();
        if (mode === 'mark') ctx.toast(`${guest.name}님을 ‘모바일 발송’으로 표시했습니다.`);
      }
    };

    const tones = [
      ['auto', '✨ 자동 맞춤'],
      ['formal', '🙇 정중 (직장·어르신)'],
      ['warm', '😊 친근 (친구)'],
      ['family', '🏡 가족·친척']
    ];

    root.replaceChildren(
      E('div', { class: 'thankyou-progress-bar' },
        E('div', { class: 'thankyou-progress-head' },
          E('strong', { class: 'small' }, `📨 청첩장 연속 발송 (${index + 1} / ${queue.length}명)`),
          E('span', { class: 'small muted' }, `완료 ${sentNow}명${skipped ? ` · 건너뜀 ${skipped}명` : ''}`)),
        E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
          E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` }))),
      E('div', { class: 'batch-thankyou-target' },
        E('div', { class: 'ledger-row-head' },
          E('strong', {}, guest.name),
          E('span', { class: 'spec-chip' }, `${guest.side} · ${guest.group}`),
          E('span', { class: 'spec-chip' }, `${guest.partySize}명`)),
        guest.note ? E('p', { class: 'small muted' }, `📝 ${guest.note}`) : null),
      E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '초대 문구 어조 선택' },
        tones.map(([key, label]) => E('button', {
          type: 'button',
          class: 'button quiet trip-filter-chip',
          'data-invite-tone': key,
          'aria-pressed': String(currentTone === key),
          onclick: () => {
            currentTone = key;
            renderStep();
          }
        }, label))),
      E('label', { class: 'field', for: textarea.id }, '맞춤 청첩장 발송 문구 (필요하면 바로 수정 가능)', textarea),
      E('div', { class: 'batch-thankyou-actions' },
        button('📋 복사 + 발송 완료 → 다음', () => markSentAndNext('copy'), 'button'),
        typeof navigator !== 'undefined' && typeof navigator.share === 'function'
          ? button('📤 카톡 공유 + 완료', () => markSentAndNext('share'), 'button quiet')
          : null,
        button('✓ 발송 완료만 표시', () => markSentAndNext('mark'), 'button quiet'),
        button('건너뛰기 →', () => { skipped++; index++; renderStep(); }, 'text-button small')));
  };

  renderStep();
  ctx.showDialog('📨 미발송 하객 청첩장 연속 발송 큐', root);
}

export function renderGuestListBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const list = prefs.guestList || [];
  const summary = guestListSummary(list);
  const tables = estimateBanquetTables(summary.mealHeadcount);
  const cross = crossCheckGuestsAndGifts(list, prefs.giftLedger || []);
  const noGiftIds = new Set(cross.attendingWithoutGift.map(g => g.id));
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
  const crossStripSlot = E('div', { class: 'guest-crosscheck-slot' });

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
    guestNoGiftOnly = false;
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
      guestNoGiftOnly,
      Boolean(guestQuery.trim())
    ].filter(Boolean).length;
    resetWrap.replaceChildren(...(activeCount ? [button(`✕ 필터 초기화 (${activeCount})`, resetGuestFilters, 'filter-reset-chip')] : []));

    if (list.length) {
      const unsentActive = guestInviteFilter === '미발송';
      const batchInviteBtn = summary.unsentCount > 0
        ? button(`📨 미발송 ${summary.unsentCount}명 연속 발송`, () => {
          const scope = guestSideFilter === 'all' ? list : list.filter(g => g.side === guestSideFilter);
          openBatchInviteModal(ctx, scope.some(g => g.inviteStatus === '미발송') ? scope : list);
        }, 'button small-copy-btn')
        : null;
      const unsentBtn = summary.unsentCount > 0
        ? button(unsentActive ? '미발송 필터 해제' : `미발송만 보기 (${summary.unsentCount}건)`, () => {
          guestInviteFilter = unsentActive ? 'all' : '미발송';
          inviteSelect.value = guestInviteFilter;
          draw();
        }, 'button quiet small-copy-btn' + (unsentActive ? ' active' : ''))
        : null;
      if (unsentBtn) unsentBtn.setAttribute('aria-pressed', String(unsentActive));
      const noGiftBtn = cross.attendingWithoutGift.length > 0
        ? button(guestNoGiftOnly ? '축의 미기록 필터 해제' : `💌 참석·축의 미기록 (${cross.attendingWithoutGift.length}명)`, () => {
          guestNoGiftOnly = !guestNoGiftOnly;
          draw();
        }, 'button quiet small-copy-btn' + (guestNoGiftOnly ? ' active' : ''))
        : null;
      if (noGiftBtn) noGiftBtn.setAttribute('aria-pressed', String(guestNoGiftOnly));
      crossStripSlot.replaceChildren(E('div', { class: 'ledger-crosscheck-strip', role: 'region', 'aria-label': '연회 테이블 환산 및 빠른 대조' },
        E('div', { class: 'ledger-crosscheck-metrics' },
          tables.headcount > 0
            ? E('span', { class: 'small' }, `🍽️ 연회 테이블 환산: `, E('strong', {}, `8인석 ${tables.tables8}테이블`), ` · `, E('strong', {}, `10인석 ${tables.tables10}테이블`), ` (식사 ${tables.headcount}명)`)
            : E('span', { class: 'small muted' }, '🍽️ 참석 확정 식사 인원이 입력되면 8인·10인 연회 테이블 수가 자동 계산됩니다.'),
          (prefs.giftLedger || []).length > 0
            ? E('span', { class: 'spec-chip' }, `축의금 일치 ${cross.matchedGuestCount}명`)
            : null),
        E('div', { class: 'ledger-crosscheck-actions' }, batchInviteBtn, unsentBtn, noGiftBtn)));
    } else {
      crossStripSlot.replaceChildren();
    }

    const q = guestQuery.trim().toLocaleLowerCase();
    const filtered = list.filter(item =>
      (guestSideFilter === 'all' || item.side === guestSideFilter) &&
      (guestRsvpFilter === 'all' || item.rsvp === guestRsvpFilter) &&
      (guestInviteFilter === 'all' || item.inviteStatus === guestInviteFilter) &&
      (!guestNoGiftOnly || noGiftIds.has(item.id)) &&
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
            E('span', { class: 'spec-chip' }, item.mealTicket === false ? '🎁 미식사(답례품)' : '🍽️ 식사'),
            (prefs.giftLedger || []).length > 0 && noGiftIds.has(item.id) ? E('span', { class: 'spec-chip highlight' }, '축의 미기록') : null),
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
        button('📤 명단·CSV 일괄 등록', () => openGuestCsvImportModal(ctx), 'button quiet'),
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
        E('span', { class: 'small muted' }, `식사 예정 ${summary.mealHeadcount}명${tables.headcount > 0 ? ` · 8인 ${tables.tables8} / 10인 ${tables.tables10}테이블` : ''}`)),
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
    crossStripSlot,
    E('div', { class: 'ledger-filter-bar guest-board-toolbar' },
      sideBar,
      E('div', { class: 'ledger-filter-controls' }, search.wrap, inviteSelect, rsvpSelect, resetWrap, countNode)),
    listWrap);
}
