import { E, button } from './dom.js?v=wedding-features-54';
import { formatDate, extractPhoneNumber } from './content.js?v=wedding-features-54';
import { DAY_ROLE_GROUPS, ENVELOPE_PAYEES } from './preferences.js?v=wedding-features-54';
import { weddingDaySummary } from './planning.js?v=wedding-features-54';

const won = value => (value === null || value === undefined ? '미입력' : `${value.toLocaleString('ko-KR')}원`);

const STARTER_DAY_ROLES = [
  ['축의대(신랑 측)', '신랑 측 축의대 접수 · 식권 배부 (2명 권장)'],
  ['축의대(신부 측)', '신부 측 축의대 접수 · 식권 배부 (2명 권장)'],
  ['신부 케어·가방순이', '신부 소지품·휴대폰·귀중품 보관 및 축의금 가방 관리'],
  ['진행·안내·운전', '사회자·축가자 동선 체크 및 웨딩카·짐 이동 지원'],
  ['촬영·부케·기타', '본식 부케 수령 · 부케 받을 친구 대기 안내'],
  ['촬영·부케·기타', '원판 가족·친지 사진 호명 도우미 (양가 1명씩)']
];

const STARTER_ENVELOPES = [
  ['사회자', '본식 사회자 사례비'],
  ['축가자', '본식 축가자 사례비'],
  ['촬영·본식 헬퍼', '본식 이모님(헬퍼) 수고비 (현금)'],
  ['본식 스냅·DVD', '본식 스냅·영상 잔금/수고비 (해당 시)'],
  ['혼주·기타', '가방순이·축의대·운전 도우미 감사의 마음']
];

const DEFAULT_PHOTO_ORDER = [
  '1. 신랑 · 신부 + 양가 부모님',
  '2. 신랑 · 신부 + 양가 직계가족 (형제·자매·조카)',
  '3. 신랑 측 친가 · 외가 친척',
  '4. 신부 측 친가 · 외가 친척',
  '5. 양가 직장 동료 · 지인 (필요 시 통합)',
  '6. 신랑 · 신부 친구 (단체 컷 → 부케 던지기 컷)'
].join('\n');

function openRoleEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing?.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '당일 역할 담당자와 연락처는 이 기기의 개인 설정에만 저장되며 하객 화면에는 절대 노출되지 않습니다.'));

  const groupSel = E('select', { id: 'day-role-group' }, DAY_ROLE_GROUPS.map(g => E('option', { value: g }, g)));
  if (isEdit && DAY_ROLE_GROUPS.includes(existing.group)) groupSel.value = existing.group;
  const roleIn = E('input', { type: 'text', id: 'day-role-title', maxlength: '80', required: true, placeholder: '예: 신랑 측 축의대 접수' });
  roleIn.value = existing?.role || '';
  const assigneeIn = E('input', { type: 'text', id: 'day-role-assignee', maxlength: '60', placeholder: '예: 사촌형 김OO (미정이면 비워두기)' });
  assigneeIn.value = existing?.assignee || '';
  const phoneIn = E('input', { type: 'tel', id: 'day-role-phone', maxlength: '40', placeholder: '예: 010-0000-0000 (선택)' });
  phoneIn.value = existing?.phone || '';
  const noteIn = E('input', { type: 'text', id: 'day-role-note', maxlength: '300', placeholder: '예: 14:10까지 1층 로비 도착 · 현금함 인계' });
  noteIn.value = existing?.note || '';

  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: groupSel.id }, '구역·분류', groupSel),
      E('label', { class: 'field', for: roleIn.id }, '담당 역할 *', roleIn)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: assigneeIn.id }, '담당자 이름 (선택)', assigneeIn),
      E('label', { class: 'field', for: phoneIn.id }, '연락처 (선택)', phoneIn)),
    E('label', { class: 'field', for: noteIn.id }, '집합 시간·전달 메모 (선택)', noteIn));

  const submit = E('button', { class: 'button', type: 'submit' }, isEdit ? '역할 저장' : '역할 추가');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));

  const snapshot = () => JSON.stringify([groupSel.value, roleIn.value, assigneeIn.value, phoneIn.value, noteIn.value]);
  const initial = snapshot();
  let saving = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const role = roleIn.value.trim();
      if (!role) throw new Error('담당 역할을 입력해 주세요.');
      const list = [...(ctx.getPrefs().weddingDayRoles || [])];
      if (!isEdit && list.length >= 60) throw new Error('본식 역할 분담은 60건까지 보관할 수 있습니다.');
      const entry = {
        id: isEdit ? existing.id : 'role-' + crypto.randomUUID().slice(0, 8),
        group: groupSel.value,
        role,
        ...(assigneeIn.value.trim() ? { assignee: assigneeIn.value.trim() } : {}),
        ...(phoneIn.value.trim() ? { phone: phoneIn.value.trim() } : {}),
        ...(noteIn.value.trim() ? { note: noteIn.value.trim() } : {})
      };
      const nextList = isEdit ? list.map(r => (r.id === entry.id ? entry : r)) : [...list, entry];
      const ok = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), weddingDayRoles: nextList }));
      if (ok) { ctx.closeDialog(); ctx.render(); ctx.toast(isEdit ? '역할 분담을 수정했습니다.' : '본식 당일 역할을 추가했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  if (ctx.showDialog(isEdit ? '본식 당일 역할 수정' : '본식 당일 역할 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function openEnvelopeEditor(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing?.id);
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, '당일 현금 봉투 준비 내역은 이 기기의 개인 설정에만 저장됩니다.'));

  const payeeSel = E('select', { id: 'day-env-payee' }, ENVELOPE_PAYEES.map(p => E('option', { value: p }, p)));
  if (isEdit && ENVELOPE_PAYEES.includes(existing.payee)) payeeSel.value = existing.payee;
  const recipientIn = E('input', { type: 'text', id: 'day-env-recipient', maxlength: '80', placeholder: '예: 사회자 이OO / 본식 헬퍼 이모님' });
  recipientIn.value = existing?.recipient || '';
  const amountIn = E('input', { type: 'number', id: 'day-env-amount', min: '0', max: '1000000000', step: '1', placeholder: '예: 200000' });
  amountIn.value = existing?.amount ?? '';
  const readyCheck = E('input', { type: 'checkbox', id: 'day-env-ready' });
  readyCheck.checked = Boolean(existing?.ready);
  const noteIn = E('input', { type: 'text', id: 'day-env-note', maxlength: '300', placeholder: '예: 신권 5만 원권 4장 · 봉투 겉면 표기 완료' });
  noteIn.value = existing?.note || '';

  form.append(
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: payeeSel.id }, '지급 대상 분류', payeeSel),
      E('label', { class: 'field', for: recipientIn.id }, '수령인·업체명 (선택)', recipientIn)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: amountIn.id }, '봉투 금액 (원)', amountIn),
      E('label', { class: 'check-label', for: readyCheck.id, style: 'align-self:end;padding-bottom:10px;' }, readyCheck, '✅ 현금·봉투 준비 완료')),
    E('label', { class: 'field', for: noteIn.id }, '전달 시점·담당자 메모 (선택)', noteIn));

  const submit = E('button', { class: 'button', type: 'submit' }, isEdit ? '봉투 저장' : '봉투 추가');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));

  const snapshot = () => JSON.stringify([payeeSel.value, recipientIn.value, amountIn.value, readyCheck.checked, noteIn.value]);
  const initial = snapshot();
  let saving = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const list = [...(ctx.getPrefs().weddingDayEnvelopes || [])];
      if (!isEdit && list.length >= 60) throw new Error('당일 현금 봉투 항목은 60건까지 보관할 수 있습니다.');
      const entry = {
        id: isEdit ? existing.id : 'env-' + crypto.randomUUID().slice(0, 8),
        payee: payeeSel.value,
        amount: amountIn.value.trim() === '' ? null : Number(amountIn.value),
        ...(recipientIn.value.trim() ? { recipient: recipientIn.value.trim() } : {}),
        ready: readyCheck.checked,
        ...(noteIn.value.trim() ? { note: noteIn.value.trim() } : {})
      };
      const nextList = isEdit ? list.map(e => (e.id === entry.id ? entry : e)) : [...list, entry];
      const ok = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), weddingDayEnvelopes: nextList }));
      if (ok) { ctx.closeDialog(); ctx.render(); ctx.toast(isEdit ? '현금 봉투 내역을 수정했습니다.' : '당일 현금 봉투 항목을 추가했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  if (ctx.showDialog(isEdit ? '당일 현금 봉투 수정' : '당일 현금 봉투 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
  }
}

function buildDayOpsSummaryText(inv, roles, envelopes, photoOrder, sum) {
  const couple = [inv?.partner1, inv?.partner2].filter(Boolean).join(' & ') || '우리 결혼식';
  const lines = [
    `💼 [${couple} 본식 당일 역할 · 봉투 · 원판 촬영 운영표]`,
    `• 일시/장소: ${inv?.date ? formatDate(inv.date) : '예식일'} ${inv?.time || ''} · ${inv?.venue || '순천아모르웨딩컨벤션'}`,
    '',
    `[1] 당일 역할 분담 (${sum.assignedRoles}/${sum.roleCount}명 배정)`
  ];
  if (roles.length) {
    for (const r of roles) {
      lines.push(`• [${r.group}] ${r.role} → ${r.assignee || '담당자 미정'}${r.phone ? ` (${r.phone})` : ''}${r.note ? ` · ${r.note}` : ''}`);
    }
  } else {
    lines.push('• 등록된 역할 없음');
  }
  lines.push('', `[2] 현금 봉투 준비 (총 ${sum.totalEnvelopeAmount.toLocaleString('ko-KR')}원 · 완료 ${sum.readyCount}/${sum.envelopeCount}건)`);
  if (envelopes.length) {
    for (const e of envelopes) {
      lines.push(`• [${e.ready ? '준비완료' : '미준비'}] ${e.payee}${e.recipient ? ` (${e.recipient})` : ''}: ${won(e.amount)}${e.note ? ` · ${e.note}` : ''}`);
    }
  } else {
    lines.push('• 등록된 봉투 없음');
  }
  if (photoOrder.trim()) {
    lines.push('', '[3] 원판 가족·친구 촬영 순서', photoOrder.trim());
  }
  return lines.join('\n');
}

function printDayOpsSheet(inv, roles, envelopes, photoOrder, sum) {
  document.querySelectorAll('.print-only-sheet').forEach(el => el.remove());
  const couple = [inv?.partner1, inv?.partner2].filter(Boolean).join(' & ') || '우리의 결혼식';
  const sheet = E('section', { class: 'print-only-sheet', 'aria-label': '본식 당일 운영표 A4 인쇄본' },
    E('header', { class: 'print-sheet-header' },
      E('div', {},
        E('p', { class: 'print-sheet-eyebrow' }, 'WEDDING DAY OPERATIONS SHEET · PRIVATE'),
        E('h1', {}, `${couple} · 본식 당일 역할·봉투·원판 운영표`),
        E('p', { class: 'print-sheet-meta' }, `${inv?.date ? formatDate(inv.date) : '예식일'} ${inv?.time || ''} · ${inv?.venue || '순천아모르웨딩컨벤션'}`)),
      E('div', { class: 'print-sheet-kpis' },
        E('span', {}, `역할 ${sum.assignedRoles}/${sum.roleCount}`),
        E('span', {}, `봉투 ${sum.readyCount}/${sum.envelopeCount}`),
        E('span', {}, `현금 총 ${sum.totalEnvelopeAmount.toLocaleString('ko-KR')}원`))),
    E('h2', { style: 'font-size:14px;margin:10px 0 6px;' }, '1. 본식 당일 역할 분담표'),
    E('table', { class: 'print-sheet-table' },
      E('thead', {}, E('tr', {}, E('th', {}, '구역'), E('th', {}, '담당 역할'), E('th', {}, '담당자'), E('th', {}, '연락처'), E('th', {}, '전달 메모'))),
      E('tbody', {}, ...(roles.length ? roles.map(r => E('tr', {},
        E('td', {}, r.group),
        E('td', { class: 'strong' }, r.role),
        E('td', {}, r.assignee || ''),
        E('td', { class: 'num' }, r.phone || ''),
        E('td', {}, r.note || ''))) : [E('tr', { class: 'print-blank-row' }, E('td', { colspan: '5' }, '등록된 역할 없음'))]))),
    E('h2', { style: 'font-size:14px;margin:14px 0 6px;' }, '2. 당일 현금 봉투 준비표'),
    E('table', { class: 'print-sheet-table' },
      E('thead', {}, E('tr', {}, E('th', {}, '구분'), E('th', {}, '수령인·업체'), E('th', {}, '금액'), E('th', {}, '준비 여부'), E('th', {}, '비고'))),
      E('tbody', {}, ...(envelopes.length ? envelopes.map(e => E('tr', {},
        E('td', {}, e.payee),
        E('td', { class: 'strong' }, e.recipient || ''),
        E('td', { class: 'num' }, won(e.amount)),
        E('td', { class: 'num' }, e.ready ? '☑ 완료' : '☐ 미준비'),
        E('td', {}, e.note || ''))) : [E('tr', { class: 'print-blank-row' }, E('td', { colspan: '5' }, '등록된 봉투 없음'))])),
      E('tfoot', {}, E('tr', {},
        E('th', { colspan: '2' }, '합계'),
        E('td', { class: 'num strong' }, `${sum.totalEnvelopeAmount.toLocaleString('ko-KR')}원`),
        E('td', { class: 'num' }, `${sum.readyCount}/${sum.envelopeCount} 완료`),
        E('td', {}, `미준비 ${sum.pendingAmount.toLocaleString('ko-KR')}원`)))),
    E('h2', { style: 'font-size:14px;margin:14px 0 6px;' }, '3. 본식 원판 사진 호명 순서표'),
    E('pre', { style: 'white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.75;padding:10px 12px;border:1px solid #bfc6c0;border-radius:8px;margin:0;' }, photoOrder.trim() || DEFAULT_PHOTO_ORDER),
    E('p', { class: 'print-sheet-foot' }, '※ 신랑·신부 및 본식 현장 도우미 전용 운영표입니다. 예식 종료 후 분실에 유의해 주세요.'));

  document.body.appendChild(sheet);
  document.body.classList.add('print-dayops-sheet');
  const cleanup = () => {
    document.body.classList.remove('print-dayops-sheet');
    sheet.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

export function renderWeddingDayOpsBoard(ctx) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const inv = ctx.getContent()?.invitation || {};
  const roles = prefs.weddingDayRoles || [];
  const envelopes = prefs.weddingDayEnvelopes || [];
  const photoOrder = prefs.photoOrderNote ?? '';
  const sum = weddingDaySummary(roles, envelopes);

  const addStarterRoles = () => {
    const existing = new Set(roles.map(r => `${r.group}|${r.role}`));
    const toAdd = STARTER_DAY_ROLES
      .filter(([g, r]) => !existing.has(`${g}|${r}`))
      .map(([group, role]) => ({ id: 'role-' + crypto.randomUUID().slice(0, 8), group, role }));
    if (!toAdd.length) { ctx.toast('기본 역할 6종이 이미 모두 등록되어 있습니다.'); return; }
    ctx.queuePreference(async () => {
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), weddingDayRoles: [...roles, ...toAdd] });
      if (ok) { ctx.render(); ctx.toast(`기본 당일 역할 ${toAdd.length}종을 추가했습니다. 각 항목을 눌러 담당자와 연락처를 입력해 주세요.`); }
      return ok;
    });
  };

  const addStarterEnvelopes = () => {
    const existing = new Set(envelopes.map(e => `${e.payee}|${e.recipient || ''}`));
    const toAdd = STARTER_ENVELOPES
      .filter(([p, rec]) => !existing.has(`${p}|${rec}`))
      .map(([payee, recipient]) => ({ id: 'env-' + crypto.randomUUID().slice(0, 8), payee, recipient, amount: null, ready: false }));
    if (!toAdd.length) { ctx.toast('기본 현금 봉투 5종이 이미 모두 등록되어 있습니다.'); return; }
    ctx.queuePreference(async () => {
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), weddingDayEnvelopes: [...envelopes, ...toAdd] });
      if (ok) { ctx.render(); ctx.toast(`기본 현금 봉투 ${toAdd.length}종을 추가했습니다. 금액을 입력하고 준비 완료를 체크해 보세요.`); }
      return ok;
    });
  };

  const toggleEnvelopeReady = env => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs().weddingDayEnvelopes || [];
      const next = latest.map(e => (e.id === env.id ? { ...e, ready: !e.ready } : e));
      const ok = await ctx.savePrefs({ ...ctx.getPrefs(), weddingDayEnvelopes: next });
      if (ok) ctx.render();
      return ok;
    });
  };

  const photoArea = E('textarea', {
    id: 'dayops-photo-order',
    rows: '7',
    maxlength: '2000',
    placeholder: DEFAULT_PHOTO_ORDER
  });
  photoArea.value = photoOrder;

  return E('section', { class: 'prenatal-panel dayops-board', 'aria-labelledby': 'dayops-title' },
    E('article', { class: 'prenatal-card prenatal-hospital-hero' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('p', { class: 'eyebrow' }, 'WEDDING DAY OPERATIONS · PRIVATE'),
          E('h2', { id: 'dayops-title' }, '💼 본식 당일 역할 분담 · 현금 봉투 · 원판 순서표'),
          E('p', { class: 'small muted' }, '당일 아침 가족·도우미에게 바로 공유하거나 A4 1장으로 인쇄해 쓸 수 있는 현장 운영표입니다.')),
        E('div', { class: 'prenatal-quick-actions' },
          button('📋 당일 운영표 요약 복사', () => ctx.copyTextToClipboard(buildDayOpsSummaryText(inv, roles, envelopes, photoOrder || DEFAULT_PHOTO_ORDER, sum), '본식 당일 운영표 요약을 복사했습니다.', '당일 운영표 복사'), 'button quiet'),
          button('🖨️ 현장용 A4 인쇄', () => printDayOpsSheet(inv, roles, envelopes, photoOrder || DEFAULT_PHOTO_ORDER, sum), 'button'))),
      E('div', { class: 'ledger-kpi-grid' },
        E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '역할 배정 현황'), E('strong', {}, `${sum.assignedRoles} / ${sum.roleCount}명 배정`)),
        E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '현금 봉투 준비'), E('strong', {}, `${sum.readyCount} / ${sum.envelopeCount}건 완료`)),
        E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '당일 현금 총액'), E('strong', {}, `${sum.totalEnvelopeAmount.toLocaleString('ko-KR')}원`)),
        E('div', { class: 'ledger-kpi-card' }, E('span', { class: 'small muted' }, '미준비 현금 잔액'), E('strong', {}, `${sum.pendingAmount.toLocaleString('ko-KR')}원`)))),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('h3', {}, '1) 👥 본식 당일 역할 분담표'),
          E('p', { class: 'small muted' }, '축의대·가방순이·부케·운전·원판 도우미 담당자와 연락처를 한눈에 정리합니다.')),
        E('div', { class: 'prenatal-quick-actions' },
          button('+ 역할 추가', () => openRoleEditor(ctx), 'button'),
          button('✨ 기본 역할 6종 채우기', addStarterRoles, 'button quiet'))),
      roles.length
        ? E('div', { class: 'ledger-list' }, roles.map(r => {
          const phoneObj = r.phone ? extractPhoneNumber(r.phone) : null;
          return E('article', { class: 'ledger-row' + (r.assignee ? ' is-settled' : '') },
            E('div', { class: 'ledger-row-main' },
              E('div', { class: 'ledger-row-title' },
                E('span', { class: 'badge' }, r.group),
                E('strong', {}, r.role)),
              E('div', { class: 'home-item-metrics small' },
                E('span', {}, r.assignee ? `담당: ${r.assignee}` : '담당자 미정'),
                r.phone ? E('span', {}, `📞 ${r.phone}`) : null),
              r.note ? E('p', { class: 'small muted home-item-note' }, `📝 ${r.note}`) : null),
            E('div', { class: 'ledger-row-controls' },
              phoneObj ? E('a', { href: `tel:${phoneObj.digits}`, class: 'button quiet small-copy-btn' }, '📞 전화') : null,
              button('수정', () => openRoleEditor(ctx, r), 'button quiet small-copy-btn'),
              button('삭제', () => {
                if (!confirm(`‘${r.role}’ 역할을 삭제할까요?`)) return;
                ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), weddingDayRoles: roles.filter(x => x.id !== r.id) }).then(ok => { if (ok) ctx.render(); return ok; }));
              }, 'text-button small')));
        }))
        : E('div', { class: 'no-results-box' },
          E('p', { class: 'no-results' }, '아직 등록된 역할이 없습니다. ‘✨ 기본 역할 6종 채우기’로 시작해 보세요.'))),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('h3', {}, '2) ✉️ 당일 현금 봉투 준비 리스트'),
          E('p', { class: 'small muted' }, '신권 준비와 겉면 표기·전달 담당자를 미리 체크해 당일 아침 혼선을 줄여요.')),
        E('div', { class: 'prenatal-quick-actions' },
          button('+ 봉투 추가', () => openEnvelopeEditor(ctx), 'button'),
          button('✨ 기본 봉투 5종 채우기', addStarterEnvelopes, 'button quiet'))),
      envelopes.length
        ? E('div', { class: 'ledger-list' }, envelopes.map(env => E('article', { class: 'ledger-row' + (env.ready ? ' is-settled' : '') },
          E('div', { class: 'ledger-row-main' },
            E('div', { class: 'ledger-row-title' },
              E('span', { class: 'badge' }, env.payee),
              E('strong', {}, env.recipient || env.payee)),
            E('div', { class: 'home-item-metrics small' },
              E('strong', {}, won(env.amount)),
              env.note ? E('span', { class: 'muted' }, `· ${env.note}`) : null)),
          E('div', { class: 'ledger-row-controls' },
            E('button', {
              type: 'button',
              class: 'quick-cycle-btn ' + (env.ready ? 'is-done' : 'is-warn'),
              onclick: () => toggleEnvelopeReady(env)
            }, env.ready ? '✅ 준비 완료' : '☐ 미준비'),
            button('수정', () => openEnvelopeEditor(ctx, env), 'button quiet small-copy-btn'),
            button('삭제', () => {
              if (!confirm('이 현금 봉투 항목을 삭제할까요?')) return;
              ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), weddingDayEnvelopes: envelopes.filter(x => x.id !== env.id) }).then(ok => { if (ok) ctx.render(); return ok; }));
            }, 'text-button small')))))
        : E('div', { class: 'no-results-box' },
          E('p', { class: 'no-results' }, '아직 등록된 현금 봉투 항목이 없습니다. ‘✨ 기본 봉투 5종 채우기’로 시작해 보세요.'))),

    E('article', { class: 'prenatal-card' },
      E('div', { class: 'prenatal-card-head' },
        E('div', {},
          E('h3', {}, '3) 📸 본식 원판 사진 호명 순서표'),
          E('p', { class: 'small muted' }, '폐회식 직후 가족·친지·친구 촬영 순서를 적어 두고 호명 도우미와 스냅 작가님께 공유하세요.')),
        E('div', { class: 'prenatal-quick-actions' },
          button('표준 순서 채우기', () => {
            photoArea.value = DEFAULT_PHOTO_ORDER;
            ctx.toast('순천아모르 표준 원판 촬영 순서를 채웠습니다. 수정 후 저장해 주세요.');
          }, 'button quiet'))),
      E('label', { class: 'field', for: photoArea.id }, '촬영 호명 순서 (최대 2,000자)', photoArea),
      E('div', { class: 'page-actions prenatal-note-actions' },
        button('💾 순서표 저장', () => {
          const val = photoArea.value.trim();
          if (val.length > 2000) { ctx.toast('순서표는 2,000자 이하로 입력해 주세요.', true); return; }
          ctx.queuePreference(async () => {
            const latest = ctx.getPrefs();
            const next = { ...latest };
            if (val) next.photoOrderNote = val; else delete next.photoOrderNote;
            const ok = await ctx.savePrefs(next);
            if (ok) { ctx.render(); ctx.toast(val ? '원판 촬영 순서표를 저장했습니다.' : '원판 촬영 순서표를 비웠습니다.'); }
            return ok;
          });
        }, 'button'),
        button('📋 순서표만 복사', () => ctx.copyTextToClipboard(photoArea.value.trim() || DEFAULT_PHOTO_ORDER, '원판 촬영 순서표를 복사했습니다.', '원판 순서표 복사'), 'button quiet'))));
}
