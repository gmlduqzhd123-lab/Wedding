import { $, E, button, externalLink, image, downloadText, searchBox } from './dom.js?v=wedding-features-74';
import { weddingDday } from './content.js?v=wedding-features-74';
import { scheduleCalendar, scheduleGoogleCalendarUrl } from './calendar.js?v=wedding-features-74';
import { studioFeeInfo, shootDeadlineSummary } from './planning.js?v=wedding-features-74';

function copyLachmaGuideSummary(ctx, studio) {
  const g = studio?.deepGuide;
  if (!g) return;
  const info = g.officialInfo || {};
  const visitLocations = (g.locations || []).filter(loc => !loc.isReference);
  const lines = [
    `📸 [웨딩 스튜디오 확정 & 공식 촬영 안내] ${studio.name} 스튜디오 (LACMA STUDIO)`,
    `· 촬영 일정: ${g.schedule?.label || '2027년 2월 3일 수요일 12:00 (예약 5~10분 전 도착 필수)'}`,
    `· 대표번호 / 운영시간: ${info.phone || studio.contact?.phone || '062-714-1970~1'} / ${info.hours || 'AM 09:00 ~ PM 06:30 (매주 월·화 정기휴무)'}`,
    ...(info.guideUrl ? [`· 공식 촬영 안내·확인서: ${info.guideUrl}`] : []),
    ...(info.lacmaInstaLabel ? [`· 인스타그램: ${info.lacmaInstaLabel}`] : []),
    `· 핵심 스타일: ${studio.style}`,
    ...(g.schedule?.milestoneNote ? [`· 일정 체크: ${g.schedule.milestoneNote}`] : []),
    ...(visitLocations.length ? [
      '',
      '🗺️ 당일 방문 동선 · 위치 · 주차 안내',
      ...(g.locationWarning ? [g.locationWarning] : []),
      ...visitLocations.map(loc => `- [${loc.step}] ${loc.name}: ${loc.address}${loc.subAddress ? ` (${loc.subAddress})` : ''} / 주차: ${loc.parking || '현장 확인'}`)
    ] : []),
    ...(g.officialNotices?.items?.length ? [
      '',
      '🚨 촬영 및 방문 필독사항 · 당일 현금 비용',
      ...(g.officialNotices.cashBanner ? [g.officialNotices.cashBanner] : []),
      ...g.officialNotices.items.map(item => `- ${item}`)
    ] : []),
    '',
    '🎒 신랑 & 신부 필수 준비사항',
    ...(g.prepChecklist || []).map(p => `- [${p.category}] ${(p.items || []).join(' / ')}`),
    '',
    '⏰ 2월 3일(수) 12:00 촬영 당일 타임테이블',
    ...(g.timetable || []).map(t => `- ${t.time} ${t.stage}: ${t.detail}`),
    ...(g.penaltyPolicy?.rows?.length ? [
      '',
      `📜 취소·변경 위약금 기준: ${g.penaltyPolicy.rows.map(([d, c, r]) => `${d}(취소 ${c}/변경 ${r})`).join(' · ')}`
    ] : [])
  ];
  const memo = !ctx.isGuestMode() && (ctx.getPrefs().notes?.[studio.id] || '').trim();
  if (memo) lines.push('', `📝 우리의 상담 메모: ${memo}`);
  ctx.copyTextToClipboard(lines.join('\n'), '라크마 공식 촬영 안내·루나메이크업 동선·준비물 요약을 복사했습니다.');
}

function renderStudioOfficialLocation(ctx, studio) {
  const loc = studio?.officialLocation;
  if (!loc) return null;
  const actions = [
    externalLink('네이버 지도 ↗', loc.naverMapUrl, 'button quiet small-copy-btn'),
    externalLink('카카오맵 ↗', loc.kakaoMapUrl, 'button quiet small-copy-btn'),
    loc.address ? button('주소 복사', () => ctx.copyVenueAddress(loc.address, `${loc.studioName || studio.name} 주소`), 'button quiet small-copy-btn') : null,
    externalLink('공식 촬영 안내 ↗', loc.guideUrl, 'button quiet small-copy-btn')
  ].filter(Boolean);
  return E('div', { class: 'studio-official-loc', 'aria-label': `${studio.name} 공식 위치 및 운영 안내` },
    E('strong', { class: 'small' }, `📍 공식 위치 · 운영 안내 (${loc.studioName || studio.name})`),
    E('p', { class: 'small lachma-loc-addr' }, loc.address),
    loc.parking ? E('p', { class: 'small muted' }, `🚗 주차: ${loc.parking}`) : null,
    loc.hours ? E('p', { class: 'small muted' }, `🕒 운영시간: ${loc.hours}`) : null,
    loc.note ? E('p', { class: 'small lachma-loc-subnote' }, loc.note) : null,
    actions.length ? E('div', { class: 'lachma-loc-actions' }, ...actions) : null);
}

function lachmaCalendarSpec(studio) {
  const g = studio?.deepGuide;
  const sched = g?.schedule || {};
  if (!sched.date) return null;
  return {
    uid: `studio-shoot-${studio.id}`,
    summary: `${studio.name} 스튜디오 웨딩촬영 (낮 ${sched.time || '12:00'})`,
    date: sched.date,
    time: sched.time || '12:00',
    location: '광주광역시 남구 중앙로 117 라크마 스튜디오',
    description: 'STEP 1 루나메이크업(광주 남구 천변좌로 432 1층) 헤어·메이크업 → STEP 2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수) · 당일 현금 헬퍼비 25만 원 준비'
  };
}

let shootPrepPendingOnly = false;

export function buildRemainingShootPrepText(studio, checkedIds = []) {
  const g = studio?.deepGuide;
  if (!g?.prepChecklist?.length) return '';
  const checked = new Set(Array.isArray(checkedIds) ? checkedIds : []);
  const groups = [];
  let remaining = 0;
  g.prepChecklist.forEach((grp, gi) => {
    const pending = (grp.items || []).filter((_, ii) => !checked.has(`shoot-${gi}-${ii}`));
    if (pending.length) {
      remaining += pending.length;
      groups.push([grp.category, pending]);
    }
  });
  if (!remaining) return '';
  const lines = [`[📸 ${studio.name} 스튜디오 남은 촬영 준비물 · ${remaining}개 미챙김]`, ''];
  for (const [cat, items] of groups) {
    lines.push(`■ ${cat} (${items.length})`);
    for (const item of items) lines.push(`- ${item}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function openStudioMemoModal(ctx, studio) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  const currentNote = ctx.getPrefs().notes?.[studio.id] || '';
  const input = E('textarea', { rows: '4', id: 'studio-archive-memo-input', maxlength: '1000', placeholder: '예: 자연광 인물 중심 톤 참고 / 원본·수정본 조건 확인' });
  input.value = currentNote;
  form.append(
    E('p', { class: 'form-note' }, `‘${studio.name}’ 스튜디오에 대한 개인 상담 메모를 이 기기에만 저장합니다. 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.`),
    E('label', { class: 'field', for: input.id }, `${studio.name} 개인 메모`, input));
  const submit = E('button', { class: 'button', type: 'submit' }, '메모 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextNotes = { ...(ctx.getPrefs().notes || {}) };
      if (input.value.trim()) nextNotes[studio.id] = input.value.trim();
      else delete nextNotes[studio.id];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), notes: nextNotes }));
      if (saved) {
        archiveDrawerOpen = true;
        ctx.closeDialog();
        ctx.render();
        ctx.toast(`‘${studio.name}’ 개인 메모를 저장했습니다.`);
      }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog(`${studio.name} · 개인 메모`, form)) {
    ctx.setEditorState({ isDirty: () => saving || input.value !== currentNote, isSaving: () => saving });
  }
}

export const SHOOT_OUTFIT_TEMPLATES = [
  { label: '메인 풍성 · 실크 드레스', hair: '단정한 로우번 + 티아라·진주 헤어핀', props: '생화 화이트 부케 · 롱 베일', poses: '정면 클래식 · 베일 날림 컷 · 창가 자연광 클로즈업' },
  { label: '슬림 · 유색 드레스', hair: '내추럴 반묶음 또는 웨이브 다운', props: '포인트 컬러 부케 · 심플 이어링', poses: '앉아서 시선 교차 · 뒷모습 라인 · 계단/로드 컷' },
  { label: '캐주얼 커플룩', hair: '가벼운 로우 포니테일 또는 자연스러운 웨이브', props: '꽃다발 · 선글라스 · 커플링 클로즈업', poses: '함께 웃으며 걷기 · 장난스러운 자연 표정 컷' },
  { label: '한복 (선택)', hair: '단아한 쪽머리 · 뒤꽂이', props: '한복 노리개 · 꽃신', poses: '양가 인사 느낌의 단정한 정면·측면 컷' }
];

export function buildShootBriefCopyText(brief = {}, studio = null) {
  const b = brief && typeof brief === 'object' ? brief : {};
  const outfits = Array.isArray(b.outfits) ? b.outfits : [];
  const ms = b.milestones || {};
  const lines = [`🎨 [${studio?.name || '라크마'} 스튜디오 촬영 시안 & 착장 브리핑]`, ''];
  if (b.moodNote) lines.push(`✨ 원하는 분위기 · 필수 컷: ${b.moodNote}`);
  if (b.avoidNote) lines.push(`🚫 피하고 싶은 각도 · 요청: ${b.avoidNote}`);
  if (b.moodNote || b.avoidNote) lines.push('');
  if (outfits.length) {
    lines.push(`👗 착장별 헤어 · 소품 · 포즈 (${outfits.length}벌)`);
    outfits.forEach((o, i) => {
      lines.push(`${i + 1}. ${o.label}`);
      if (o.hair) lines.push(`   · 헤어/메이크업: ${o.hair}`);
      if (o.props) lines.push(`   · 부케/소품: ${o.props}`);
      if (o.poses) lines.push(`   · 원하는 포즈: ${o.poses}`);
    });
    lines.push('');
  }
  const msLines = [
    ['원본 수령', ms.originalDate, ms.originalDone],
    ['사진 셀렉', ms.selectDate, ms.selectDone],
    ['수정본 완료', ms.retouchDate, ms.retouchDone]
  ].filter(([, d, done]) => d || done);
  if (msLines.length) {
    lines.push('🗓️ 촬영 후속 일정');
    for (const [name, d, done] of msLines) {
      lines.push(`- ${name}: ${done ? '완료 ✅' : '진행 예정'}${d ? ` (${d})` : ''}`);
    }
  }
  return lines.join('\n').trim();
}

function emptyShootBrief() {
  return { moodNote: '', avoidNote: '', outfits: [], milestones: { originalDone: false, selectDone: false, retouchDone: false } };
}

function openShootBriefMoodModal(ctx) {
  if (ctx.isGuestMode()) return;
  const cur = ctx.getPrefs().shootBrief || emptyShootBrief();
  const ms = cur.milestones || {};
  const form = E('form', { class: 'editor-form' });
  const moodInput = E('textarea', { rows: '3', id: 'shoot-mood-note', maxlength: '500', placeholder: '예: 과한 보정보다 자연광 속 편안한 미소, 인물 중심 클래식 톤 위주' });
  moodInput.value = cur.moodNote || '';
  const avoidInput = E('textarea', { rows: '3', id: 'shoot-avoid-note', maxlength: '500', placeholder: '예: 너무 인위적인 입맞춤 포즈는 최소화, 왼쪽 얼굴 각도 선호' });
  avoidInput.value = cur.avoidNote || '';
  const origDate = E('input', { type: 'date', id: 'shoot-orig-date', value: ms.originalDate || '' });
  const selDate = E('input', { type: 'date', id: 'shoot-sel-date', value: ms.selectDate || '' });
  const retDate = E('input', { type: 'date', id: 'shoot-ret-date', value: ms.retouchDate || '' });
  form.append(
    E('p', { class: 'form-note' }, '촬영 당일 작가님·루나메이크업 실장님께 보여줄 핵심 요청과 촬영 후 원본·셀렉·수정본 일정을 이 기기에 기록합니다.'),
    E('label', { class: 'field', for: moodInput.id }, '✨ 원하는 분위기 · 꼭 남기고 싶은 컷', moodInput),
    E('label', { class: 'field', for: avoidInput.id }, '🚫 피하고 싶은 각도 · 보정/포즈 요청', avoidInput),
    E('div', { class: 'editor-grid-3' },
      E('label', { class: 'field', for: origDate.id }, '1. 원본 수령 예정일', origDate),
      E('label', { class: 'field', for: selDate.id }, '2. 사진 셀렉 예정일', selDate),
      E('label', { class: 'field', for: retDate.id }, '3. 수정본 수령 예정일', retDate)));
  const submit = E('button', { class: 'button', type: 'submit' }, '시안·일정 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const nextBrief = {
        ...(moodInput.value.trim() ? { moodNote: moodInput.value.trim() } : {}),
        ...(avoidInput.value.trim() ? { avoidNote: avoidInput.value.trim() } : {}),
        outfits: baseBrief.outfits || [],
        milestones: {
          ...(origDate.value ? { originalDate: origDate.value } : {}),
          ...(selDate.value ? { selectDate: selDate.value } : {}),
          ...(retDate.value ? { retouchDate: retDate.value } : {}),
          originalDone: Boolean(baseBrief.milestones?.originalDone),
          selectDone: Boolean(baseBrief.milestones?.selectDone),
          retouchDone: Boolean(baseBrief.milestones?.retouchDone)
        }
      };
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('촬영 시안과 후속 일정을 저장했습니다.'); }
    } catch (error) { ctx.toast(error.message, true); }
    finally { saving = false; submit.disabled = false; }
  });
  const snap = () => JSON.stringify([moodInput.value, avoidInput.value, origDate.value, selDate.value, retDate.value]);
  const initial = snap();
  if (ctx.showDialog('🎨 촬영 분위기 · 후속 일정 편집', form)) {
    ctx.setEditorState({ isDirty: () => saving || snap() !== initial, isSaving: () => saving });
  }
}

function openShootOutfitModal(ctx, existing = null) {
  if (ctx.isGuestMode()) return;
  const isEdit = Boolean(existing?.id);
  const form = E('form', { class: 'editor-form' });
  const labelInput = E('input', { type: 'text', id: 'outfit-label', maxlength: '60', required: true, placeholder: '예: 메인 실크 드레스 / 캐주얼 커플룩', value: existing?.label || '' });
  const hairInput = E('input', { type: 'text', id: 'outfit-hair', maxlength: '120', placeholder: '예: 단정한 로우번 + 진주 헤어핀', value: existing?.hair || '' });
  const propsInput = E('input', { type: 'text', id: 'outfit-props', maxlength: '160', placeholder: '예: 화이트 생화 부케 · 롱 베일', value: existing?.props || '' });
  const posesInput = E('textarea', { rows: '3', id: 'outfit-poses', maxlength: '240', placeholder: '예: 베일 날림 컷, 창가 역광 클로즈업, 정면 클래식 포즈' });
  posesInput.value = existing?.poses || '';
  form.append(
    E('label', { class: 'field', for: labelInput.id }, '👗 착장 이름 (필수)', labelInput),
    E('label', { class: 'field', for: hairInput.id }, '💇 헤어 변형 · 메이크업 포인트', hairInput),
    E('label', { class: 'field', for: propsInput.id }, '💐 부케 · 소품 매칭', propsInput),
    E('label', { class: 'field', for: posesInput.id }, '📷 원하는 포즈 · 컷 메모', posesInput));
  const submit = E('button', { class: 'button', type: 'submit' }, isEdit ? '착장 시안 수정' : '착장 시안 추가');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const label = labelInput.value.trim();
      if (!label) throw new Error('착장 이름을 입력해 주세요.');
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const curList = [...(baseBrief.outfits || [])];
      if (!isEdit && curList.length >= 10) throw new Error('착장 시안은 10벌까지 보관할 수 있습니다.');
      const nextItem = {
        id: isEdit ? existing.id : 'outfit-' + crypto.randomUUID().slice(0, 8),
        label,
        ...(hairInput.value.trim() ? { hair: hairInput.value.trim() } : {}),
        ...(propsInput.value.trim() ? { props: propsInput.value.trim() } : {}),
        ...(posesInput.value.trim() ? { poses: posesInput.value.trim() } : {})
      };
      const nextOutfits = isEdit ? curList.map(o => (o.id === nextItem.id ? nextItem : o)) : [...curList, nextItem];
      const nextBrief = { ...baseBrief, outfits: nextOutfits, milestones: baseBrief.milestones || emptyShootBrief().milestones };
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast(isEdit ? '착장 시안을 수정했습니다.' : '착장 시안을 추가했습니다.'); }
    } catch (error) { ctx.toast(error.message, true); }
    finally { saving = false; submit.disabled = false; }
  });
  const snap = () => JSON.stringify([labelInput.value, hairInput.value, propsInput.value, posesInput.value]);
  const initial = snap();
  if (ctx.showDialog(isEdit ? '👗 촬영 착장 시안 수정' : '👗 촬영 착장 시안 추가', form)) {
    ctx.setEditorState({ isDirty: () => saving || snap() !== initial, isSaving: () => saving });
  }
}

export function reorderOutfits(outfits = [], outfitId, delta) {
  const list = [...(Array.isArray(outfits) ? outfits : [])];
  const idx = list.findIndex(o => o.id === outfitId);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= list.length) return list;
  [list[idx], list[target]] = [list[target], list[idx]];
  return list;
}

function printShootDaySheet(studio, prefs = {}) {
  const g = studio?.deepGuide || {};
  const brief = prefs.shootBrief || emptyShootBrief();
  const outfits = brief.outfits || [];
  const checkedSet = new Set(prefs.shootChecklist || []);
  const visitLocations = (g.locations || []).filter(loc => !loc.isReference);
  const pendingPrep = [];
  (g.prepChecklist || []).forEach((grp, gi) => {
    (grp.items || []).forEach((label, ii) => {
      if (!checkedSet.has(`shoot-${gi}-${ii}`)) pendingPrep.push(`[${grp.category}] ${label}`);
    });
  });

  document.querySelectorAll('.print-only-sheet').forEach(el => el.remove());
  document.body.classList.remove('print-guest-sheet', 'print-gift-sheet', 'print-dayops-sheet', 'print-shoot-sheet');

  const sheet = E('section', { class: 'print-only-sheet print-dayops-root', 'aria-label': '라크마 웨딩촬영 당일 운영표 A4 인쇄본' },
    E('h1', {}, `📸 ${studio?.name || '라크마'} 웨딩촬영 당일 운영표`),
    E('p', { class: 'small' }, `${g.schedule?.label || '2027년 2월 3일 수요일 12:00'} · 대표번호 ${g.officialInfo?.phone || studio?.contact?.phone || '062-714-1970~1'} · 당일 현금 헬퍼비 25만 원 필수`),
    visitLocations.length ? [
      E('h2', {}, '1. 당일 방문 동선 · 주소 · 주차'),
      E('ul', {}, visitLocations.map(loc => E('li', {}, `${loc.step} ${loc.name}: ${loc.address}${loc.subAddress ? ` (${loc.subAddress})` : ''} / 주차: ${loc.parking || '현장 확인'}`)))
    ] : null,
    (g.timetable || []).length ? [
      E('h2', {}, '2. 당일 타임테이블'),
      E('ul', {}, g.timetable.map(row => E('li', {}, `${row.time} — ${row.stage}: ${row.detail}`)))
    ] : null,
    E('h2', {}, `3. 착장별 시안 · 헤어 · 소품 · 포즈 (${outfits.length}벌)`),
    brief.moodNote ? E('p', {}, `✨ 원하는 분위기 · 필수 컷: ${brief.moodNote}`) : null,
    brief.avoidNote ? E('p', {}, `🚫 피하고 싶은 각도 · 요청: ${brief.avoidNote}`) : null,
    outfits.length
      ? E('ol', {}, outfits.map(o => E('li', {},
        E('strong', {}, o.label),
        E('div', { class: 'small' }, [
          o.hair ? `헤어·메이크업: ${o.hair}` : '',
          o.props ? `부케·소품: ${o.props}` : '',
          o.poses ? `포즈·포인트: ${o.poses}` : ''
        ].filter(Boolean).join(' / ') || '세부 메모 없음'))))
      : E('p', { class: 'small' }, '등록된 착장 시안 없음'),
    E('h2', {}, `4. 미챙김 촬영 준비물 (${pendingPrep.length}건)`),
    pendingPrep.length
      ? E('ul', {}, pendingPrep.map(item => E('li', {}, `□ ${item}`)))
      : E('p', { class: 'small' }, '✅ 등록된 촬영 준비물을 모두 체크했습니다.'),
    E('p', { class: 'print-sheet-foot' }, '※ 라크마 웨딩촬영 당일 신랑·신부 및 동행 도우미 전용 운영표입니다.'));

  document.body.append(sheet);
  document.body.classList.add('print-shoot-sheet');
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('print-shoot-sheet');
    sheet.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}

function renderShootBriefBoard(ctx, studio) {
  if (ctx.isGuestMode()) return null;
  const brief = ctx.getPrefs().shootBrief || emptyShootBrief();
  const outfits = brief.outfits || [];
  const ms = brief.milestones || {};
  const hasAny = Boolean(brief.moodNote || brief.avoidNote || outfits.length || ms.originalDate || ms.selectDate || ms.retouchDate || ms.originalDone || ms.selectDone || ms.retouchDone);

  const applyTemplates = () => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const existingLabels = new Set((baseBrief.outfits || []).map(o => o.label));
      const additions = [];
      for (const tpl of SHOOT_OUTFIT_TEMPLATES) {
        if (existingLabels.has(tpl.label) || (baseBrief.outfits || []).length + additions.length >= 10) continue;
        additions.push({ id: 'outfit-' + crypto.randomUUID().slice(0, 8), ...tpl });
      }
      if (!additions.length) { ctx.toast('이미 기본 착장 템플릿이 들어 있습니다.'); return true; }
      const nextBrief = { ...baseBrief, outfits: [...(baseBrief.outfits || []), ...additions], milestones: baseBrief.milestones || emptyShootBrief().milestones };
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief });
      if (saved) { ctx.render(); ctx.toast(`기본 착장 시안 ${additions.length}벌을 채웠습니다. 우리 일정에 맞게 다듬어 보세요.`); }
      return saved;
    });
  };

  const moveOutfit = (outfitId, delta) => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const nextOutfits = reorderOutfits(baseBrief.outfits || [], outfitId, delta);
      const nextBrief = { ...baseBrief, outfits: nextOutfits, milestones: baseBrief.milestones || emptyShootBrief().milestones };
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief });
      if (saved) ctx.render();
      return saved;
    });
  };

  const deleteOutfit = async outfit => {
    if (!await ctx.confirmAction({ title: '착장 시안 삭제', message: `‘${outfit.label}’ 시안 카드를 삭제할까요?`, confirmLabel: '삭제', danger: true })) return;
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const nextBrief = { ...baseBrief, outfits: (baseBrief.outfits || []).filter(o => o.id !== outfit.id), milestones: baseBrief.milestones || emptyShootBrief().milestones };
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief });
      if (saved) { ctx.render(); ctx.toast('착장 시안을 삭제했습니다.'); }
      return saved;
    });
  };

  const toggleMilestone = (doneKey, checked) => {
    ctx.queuePreference(async () => {
      const latest = ctx.getPrefs();
      const baseBrief = latest.shootBrief || emptyShootBrief();
      const nextBrief = {
        ...baseBrief,
        outfits: baseBrief.outfits || [],
        milestones: { ...(baseBrief.milestones || emptyShootBrief().milestones), [doneKey]: checked }
      };
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootBrief: nextBrief });
      if (saved) ctx.render();
      return saved;
    });
  };

  const msDefs = [
    ['originalDone', 'originalDate', '1. 원본 수령'],
    ['selectDone', 'selectDate', '2. 사진 셀렉'],
    ['retouchDone', 'retouchDate', '3. 수정본 완료']
  ];
  const msDoneCount = msDefs.filter(([dk]) => Boolean(ms[dk])).length;

  return E('div', { class: 'lachma-section shoot-brief-board', 'aria-label': '라크마 촬영 시안 및 착장 보드' },
    E('div', { class: 'lachma-prep-head' },
      E('div', {},
        E('h3', { class: 'lachma-subtitle' }, '🎨 촬영 시안 · 착장별 헤어·소품·포즈 & 후속 일정'),
        E('p', { class: 'small muted' }, '촬영 당일 루나메이크업·라크마 작가님께 바로 보여줄 시안과 원본·셀렉·수정본 진행 상황을 이 기기에 정리해요.')),
      E('div', { class: 'lachma-prep-controls' },
        button('✏️ 무드·후속일정 편집', () => openShootBriefMoodModal(ctx), 'button quiet small-copy-btn'),
        button('+ 착장 추가', () => openShootOutfitModal(ctx), 'button quiet small-copy-btn'),
        hasAny ? button('📋 시안 브리핑 복사', () => {
          const text = buildShootBriefCopyText(brief, studio);
          if (text) ctx.copyTextToClipboard(text, '라크마 촬영 시안·착장 브리핑을 복사했습니다.', '촬영 시안 복사');
        }, 'button quiet small-copy-btn') : null,
        button('🖨️ 촬영 당일 A4 인쇄', () => printShootDaySheet(studio, ctx.getPrefs()), 'button quiet small-copy-btn'))),
    (brief.moodNote || brief.avoidNote) ? E('div', { class: 'shoot-brief-notes-grid' },
      brief.moodNote ? E('div', { class: 'pros-box' }, E('strong', { class: 'pros-title' }, '✨ 원하는 분위기 · 필수 컷'), E('p', { class: 'small record-body' }, brief.moodNote)) : null,
      brief.avoidNote ? E('div', { class: 'cons-box' }, E('strong', { class: 'cons-title' }, '🚫 피하고 싶은 각도 · 요청'), E('p', { class: 'small record-body' }, brief.avoidNote)) : null) : null,
    outfits.length
      ? E('div', { class: 'shoot-outfit-grid' }, outfits.map((o, idx) => {
        const upBtn = E('button', { type: 'button', class: 'text-button small', 'data-outfit-move': 'up', 'aria-label': `${o.label} 위로 이동`, disabled: idx === 0, onclick: () => moveOutfit(o.id, -1) }, '↑');
        const downBtn = E('button', { type: 'button', class: 'text-button small', 'data-outfit-move': 'down', 'aria-label': `${o.label} 아래로 이동`, disabled: idx === outfits.length - 1, onclick: () => moveOutfit(o.id, 1) }, '↓');
        return E('article', { class: 'shoot-outfit-card', 'data-outfit-id': o.id },
          E('div', { class: 'shoot-outfit-head' },
            E('strong', {}, `${idx + 1}. ${o.label}`),
            E('div', { class: 'shoot-outfit-actions' },
              outfits.length > 1 ? upBtn : null,
              outfits.length > 1 ? downBtn : null,
              button('수정', () => openShootOutfitModal(ctx, o), 'text-button small'),
              button('삭제', () => deleteOutfit(o), 'text-button small danger-link'))),
          o.hair ? E('p', { class: 'small' }, E('strong', {}, '💇 헤어·메이크업: '), o.hair) : null,
          o.props ? E('p', { class: 'small' }, E('strong', {}, '💐 부케·소품: '), o.props) : null,
          o.poses ? E('p', { class: 'small' }, E('strong', {}, '📷 포즈·포인트: '), o.poses) : null);
      }))
      : E('div', { class: 'shoot-brief-empty' },
        E('p', { class: 'small muted' }, '아직 착장별 시안이 비어 있어요. 드레스·캐주얼·한복별 헤어변형과 소품을 적어 두면 ‘촬영 당일 현장 모드’에서 작가님께 바로 보여드릴 수 있어요.'),
        E('div', { class: 'page-actions' },
          button('✨ 기본 착장 4종 템플릿 채우기', applyTemplates, 'button quiet small-copy-btn'),
          button('+ 첫 착장 직접 추가', () => openShootOutfitModal(ctx), 'button small-copy-btn'))),
    E('div', { class: 'shoot-milestone-bar', 'aria-label': '촬영 후속 일정 진행' },
      E('div', { class: 'shoot-milestone-head' },
        E('strong', { class: 'small' }, `🗓️ 촬영 후속 일정 (${msDoneCount}/3 완료)`),
        button('날짜 입력·수정', () => openShootBriefMoodModal(ctx), 'text-button small')),
      E('div', { class: 'shoot-milestone-grid' }, msDefs.map(([doneKey, dateKey, label]) => {
        const box = E('input', { type: 'checkbox', id: `ms-${doneKey}` });
        box.checked = Boolean(ms[doneKey]);
        box.addEventListener('change', () => toggleMilestone(doneKey, box.checked));
        return E('label', { class: 'shoot-milestone-item' + (box.checked ? ' is-done' : ''), for: box.id },
          box,
          E('span', {},
            E('strong', { class: 'small' }, label),
            E('span', { class: 'small muted shoot-ms-date' }, ms[dateKey] ? ` · ${ms[dateKey]}` : ' · 일정 미정')));
      }))));
}

function renderLachmaDeepGuide(ctx, studio, compact = false) {
  const g = studio?.deepGuide;
  if (!g) return null;
  const guestMode = ctx.isGuestMode();
  const prefs = ctx.getPrefs();
  const sched = g.schedule || {};
  const info = g.officialInfo || {};
  const dday = sched.date ? weddingDday(sched.date) : null;
  const deadlines = sched.date ? shootDeadlineSummary(sched.date) : null;
  const calSpec = lachmaCalendarSpec(studio);
  let shootGcalBtn = null, shootIcsBtn = null;
  if (calSpec) {
    try {
      shootGcalBtn = externalLink('📅 촬영일 Google 캘린더 등록 ↗', scheduleGoogleCalendarUrl(calSpec), 'button quiet small-copy-btn');
      shootIcsBtn = button('📥 촬영 일정(.ics) 저장', () => {
        downloadText(scheduleCalendar(calSpec), `lachma-shoot-${sched.date}.ics`, 'text/calendar;charset=utf-8');
        ctx.toast('라크마 스튜디오 촬영 일정 파일(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn');
    } catch {}
  }
  const officialLinks = [
    externalLink('📄 공식 촬영 안내·확인서 ↗', info.guideUrl, 'button quiet small-copy-btn'),
    info.lacmaInstaUrl ? externalLink(`📷 라크마 (${info.lacmaInstaLabel || '@lacma_studio_gwangju'}) ↗`, info.lacmaInstaUrl, 'button quiet small-copy-btn') : null,
    shootGcalBtn,
    shootIcsBtn
  ].filter(Boolean);
  const visitLocations = (g.locations || []).filter(loc => !loc.isReference);
  const checkedSet = new Set(prefs.shootChecklist || []);
  const allPrepIds = (g.prepChecklist || []).flatMap((grp, gi) => (grp.items || []).map((_, ii) => `shoot-${gi}-${ii}`));
  const donePrepCount = allPrepIds.filter(k => checkedSet.has(k)).length;
  const totalPrepCount = allPrepIds.length;
  const remainingPrepCount = totalPrepCount - donePrepCount;
  const prepPct = totalPrepCount ? Math.round((donePrepCount / totalPrepCount) * 100) : 0;
  const prepPendingBox = !guestMode ? E('input', { type: 'checkbox', id: 'shoot-prep-pending-only' }) : null;
  if (prepPendingBox) {
    prepPendingBox.checked = shootPrepPendingOnly;
    prepPendingBox.addEventListener('change', () => {
      shootPrepPendingOnly = prepPendingBox.checked;
      ctx.render();
      $('#shoot-prep-pending-only')?.focus({ preventScroll: true });
    });
  }
  const prepDisplayGroups = (g.prepChecklist || []).map((group, gi) => {
    const entries = (group.items || []).map((item, ii) => ({ id: `shoot-${gi}-${ii}`, label: item }));
    const visible = (!guestMode && shootPrepPendingOnly) ? entries.filter(e => !checkedSet.has(e.id)) : entries;
    return { category: group.category, entries: visible };
  }).filter(grp => grp.entries.length > 0);
  const togglePrepItem = (itemId, box) => {
    const next = new Set(ctx.getPrefs().shootChecklist || []);
    if (box.checked) next.add(itemId); else next.delete(itemId);
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootChecklist: [...next] });
      if (saved) {
        const activeMemo = $('.selected-studio-card textarea');
        const keepFocus = document.activeElement === activeMemo;
        const draftMemo = activeMemo?.value;
        ctx.render();
        const nextMemo = $('.selected-studio-card textarea');
        if (nextMemo && draftMemo !== undefined && draftMemo !== (ctx.getPrefs().notes?.[studio.id] || '')) nextMemo.value = draftMemo;
        if (keepFocus) nextMemo?.focus({ preventScroll: true });
      } else box.checked = checkedSet.has(itemId);
      return saved;
    });
  };
  const notesList = Array.isArray(g.collectionNotes) ? g.collectionNotes : (g.collectionNotes ? [g.collectionNotes] : []);
  return E('div', { class: 'lachma-deep-guide' + (compact ? ' compact' : ''), 'aria-label': `${studio.name} 확정 촬영 일정 및 공식 촬영 안내` },
    E('div', { class: 'lachma-schedule-banner' },
      E('div', { class: 'lachma-schedule-main' },
        E('span', { class: 'spec-chip highlight' }, `🗓️ 촬영 확정: ${sched.label || '2027년 2월 3일 수요일 12:00 (낮 12시)'}`),
        dday ? E('span', { class: 'spec-chip direct' }, `⏳ 촬영일 ${dday}`) : null,
        info.hours ? E('span', { class: 'spec-chip' }, `🕒 ${info.hours}`) : null),
      deadlines ? E('div', { class: 'lachma-deadline-chips' },
        E('span', { class: 'spec-chip' }, `🌙 야간촬영 신청 마감(7일 전): ${deadlines.nightDeadline}`),
        E('span', { class: 'spec-chip' }, `📅 월·화 정기휴무 전 최종 문의 권장: ${deadlines.preHolidayDate} (일)`),
        E('span', { class: 'spec-chip highlight' }, `⚖️ 위약금 기준: ${deadlines.penaltyLabel}`)) : null,
      sched.milestoneNote ? E('p', { class: 'small lachma-milestone-note' }, `💡 ${sched.milestoneNote}`) : null,
      officialLinks.length ? E('div', { class: 'lachma-official-links' }, ...officialLinks) : null),
    g.overview ? E('p', { class: 'record-body lachma-overview' }, g.overview) : null,
    visitLocations.length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '🗺️ 당일 방문 동선 · 위치 · 주차 안내 (루나메이크업 → 라크마 스튜디오)'),
      g.locationWarning ? E('div', { class: 'lachma-location-warning', role: 'note' }, g.locationWarning) : null,
      E('div', { class: 'lachma-location-grid' }, visitLocations.map(loc => {
        const locActions = [
          externalLink('네이버 지도 ↗', loc.naverMapUrl, 'button quiet small-copy-btn'),
          externalLink('카카오맵 ↗', loc.kakaoMapUrl, 'button quiet small-copy-btn'),
          loc.address ? button('주소 복사', () => ctx.copyVenueAddress(loc.address, `${loc.name} 주소`), 'button quiet small-copy-btn') : null
        ].filter(Boolean);
        return E('article', { class: 'lachma-location-card' },
          E('span', { class: 'lachma-step-badge' }, loc.step),
          E('strong', { class: 'lachma-loc-name' }, loc.name),
          E('p', { class: 'small lachma-loc-addr' }, loc.address),
          loc.subAddress ? E('p', { class: 'small lachma-loc-subnote' }, loc.subAddress) : null,
          loc.parking ? E('p', { class: 'small muted lachma-loc-parking' }, `🚗 주차: ${loc.parking}`) : null,
          locActions.length ? E('div', { class: 'lachma-loc-actions' }, ...locActions) : null,
          loc.mapImage ? E('button', { type: 'button', class: 'map-preview-open', 'aria-label': `${loc.name} 약도 크게 보기`, onclick: () => ctx.openPhotos(`${loc.name} 위치 안내 약도`, [loc.mapImage], 0) },
            image(loc.mapImage, loc.mapImageAlt || `${loc.name} 위치 안내 약도`, { class: 'luna-map-thumb' }),
            E('span', { class: 'map-preview-caption' }, '🗺️ 루나메이크업 위치 약도 크게 보기')) : null);
      }))) : null,
    g.officialNotices?.items?.length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '🚨 촬영 및 방문 필독사항 · 당일 현금 비용'),
      g.officialNotices.cashBanner ? E('div', { class: 'lachma-cash-banner' }, g.officialNotices.cashBanner) : null,
      E('ul', { class: 'lachma-notice-list' }, g.officialNotices.items.map(item => E('li', { class: 'small' + (/\[필독\]|★/.test(item) ? ' is-critical' : '') }, item)))) : null,
    (g.prepChecklist || []).length ? E('div', { class: 'lachma-section' },
      E('div', { class: 'lachma-prep-head' },
        E('h3', { class: 'lachma-subtitle' }, '🎒 신랑 & 신부 필수 준비사항 (공식 안내 & 2월 겨울 대비)'),
        !guestMode ? E('div', { class: 'lachma-prep-controls' },
          E('span', { class: 'badge' }, `준비물 점검 ${donePrepCount}/${totalPrepCount} (${prepPct}%)`),
          donePrepCount > 0 ? button('준비물 체크 초기화', async () => {
            if (!await ctx.confirmAction({ title: '촬영 준비물 초기화', message: '라크마 촬영 준비물 체크 상태를 모두 초기화할까요?', confirmLabel: '초기화', danger: true })) return;
            ctx.queuePreference(async () => {
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootChecklist: [] });
              if (saved) { ctx.render(); ctx.toast('촬영 준비물 체크를 초기화했습니다.'); }
              return saved;
            });
          }, 'button quiet small-copy-btn') : null) : null),
      !guestMode ? E('div', { class: 'packing-filter-row shoot-prep-filter-row' },
        E('label', { class: 'check-label', for: 'shoot-prep-pending-only' }, prepPendingBox, `미챙긴 항목만 보기 (${remainingPrepCount}개 남음)`),
        remainingPrepCount > 0
          ? button('📋 남은 준비물 카톡 복사', () => {
            const payload = buildRemainingShootPrepText(studio, prefs.shootChecklist || []);
            if (payload) ctx.copyTextToClipboard(payload, `남은 촬영 준비물 ${remainingPrepCount}개를 복사했습니다.`, '남은 촬영 준비물 복사');
          }, 'button quiet small-copy-btn')
          : E('span', { class: 'badge' }, '🎉 촬영 준비물 완료!')) : null,
      prepDisplayGroups.length
        ? E('div', { class: 'lachma-prep-grid' }, prepDisplayGroups.map(group => E('article', { class: 'lachma-prep-card' },
          E('strong', {}, group.category),
          guestMode ? E('ul', { class: 'lachma-prep-list' }, group.entries.map(e => E('li', { class: 'small' }, e.label))) :
            E('ul', { class: 'lachma-prep-check-list' }, group.entries.map(e => {
              const box = E('input', { type: 'checkbox', 'aria-label': `${group.category} - ${e.label}` });
              box.checked = checkedSet.has(e.id);
              box.addEventListener('change', () => togglePrepItem(e.id, box));
              return E('li', { class: 'lachma-prep-check-item' + (box.checked ? ' done' : '') },
                E('label', { class: 'checklist-label' }, box, E('span', { class: 'small' }, e.label)));
            })))))
        : E('p', { class: 'small muted' }, '🎉 모든 촬영 준비물을 챙겼습니다! ‘미챙긴 항목만 보기’를 해제하면 전체 목록을 볼 수 있어요.')) : null,
    !compact ? renderShootBriefBoard(ctx, studio) : null,
    (g.timetable || []).length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '⏰ 2월 3일 (수) 12:00 촬영 당일 동선 타임테이블'),
      E('ol', { class: 'timetable-list lachma-timetable' }, g.timetable.map(row => E('li', { class: 'timetable-row' + (row.time.includes('12:00') ? ' highlight' : '') },
        E('strong', { class: 'timetable-time' }, row.time),
        E('div', { class: 'timetable-detail' },
          E('strong', {}, row.stage),
          E('p', { class: 'small muted' }, row.detail)))))) : null,
    (g.signatureScenes || []).length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '✨ 라크마 시그니처 4대 촬영 콘셉트 & 빛 활용법'),
      E('div', { class: 'lachma-scene-grid' }, g.signatureScenes.map(scene => E('article', { class: 'lachma-scene-card' },
        E('strong', {}, scene.title),
        E('p', { class: 'small' }, scene.desc))))) : null,
    (g.penaltyPolicy || g.partnership) ? E('details', { class: 'disclosure lachma-policy-details' },
      E('summary', {}, '📜 취소·변경 위약금 규정 · 촬영 확인서 · 바이가미 제휴 혜택 보기'),
      E('div', { class: 'lachma-policy-body' },
        g.penaltyPolicy ? E('div', { class: 'lachma-penalty-block' },
          g.penaltyPolicy.intro ? E('p', { class: 'small muted' }, g.penaltyPolicy.intro) : null,
          E('div', { class: 'lachma-penalty-table-wrap' },
            E('table', { class: 'lachma-penalty-table' },
              E('thead', {}, E('tr', {}, E('th', { scope: 'col' }, '구분 (촬영일 기준)'), E('th', { scope: 'col' }, '취소 위약금'), E('th', { scope: 'col' }, '변경 위약금'))),
              E('tbody', {}, (g.penaltyPolicy.rows || []).map(([period, cancelFee, changeFee], idx) => E('tr', { class: deadlines?.penaltyIndex === idx ? 'is-active-tier' : '' },
                E('th', { scope: 'row' }, deadlines?.penaltyIndex === idx ? `👉 ${period} (현재 구간)` : period),
                E('td', {}, cancelFee),
                E('td', {}, changeFee))))))) : null,
        g.partnership ? E('div', { class: 'lachma-partnership-box' },
          E('strong', { class: 'small' }, `💍 ${g.partnership.title}`),
          E('p', { class: 'small' }, g.partnership.summary),
          info.guideUrl ? externalLink('📄 공식 촬영 안내 페이지에서 확인서 제출하기 ↗', info.guideUrl, 'button quiet small-copy-btn') : null) : null)) : null,
    notesList.length ? E('div', { class: 'lachma-collection-note' },
      E('strong', { class: 'small' }, '📌 공식 촬영 안내 및 웨딩홀 제공 자료 출처 구분'),
      ...notesList.map(note => E('p', { class: 'small muted' }, note))) : null);
}

function studioSpecChips(ctx, studio, compact = false) {
  const fee = studioFeeInfo(studio);
  const hasOfficialGuide = Boolean(studio.deepGuide?.officialNotices);
  const feeChip = hasOfficialGuide && fee.unknown
    ? E('span', { class: 'spec-chip' }, '📋 기본 구성 계약서 확인')
    : E('span', { class: 'spec-chip' + (fee.unknown ? '' : ' highlight') }, fee.label);
  const rawPhone = studio.deepGuide?.officialInfo?.phone || studio.contact?.phone || '';
  const dialHref = rawPhone ? `tel:${rawPhone.split('~')[0].replace(/[^\d+]/g, '')}` : '';
  const phoneLabel = studio.deepGuide?.officialInfo?.phone
    ? `📞 ${studio.deepGuide.officialInfo.phone} (월·화 휴무)`
    : (studio.contact?.phone ? `📞 ${studio.contact.phone}` : '📞 연락처 미기재');
  const phoneChip = dialHref
    ? E('a', { class: 'spec-chip', href: dialHref, 'aria-label': `${studio.name} 대표번호 전화 걸기 (${phoneLabel.replace(/^📞\s*/, '')})` }, phoneLabel)
    : E('span', { class: 'spec-chip' }, phoneLabel);
  const hasNote = !ctx.isGuestMode() && Boolean(ctx.getPrefs().notes?.[studio.id]?.trim());
  return E('div', { class: 'trip-spec-chips studio-spec-chips', 'aria-label': `${studio.name} 핵심 요약` },
    studio.deepGuide?.schedule ? E('span', { class: 'spec-chip direct' }, `🗓️ ${studio.deepGuide.schedule.shortLabel || '2/3(수) 12:00 촬영 확정'}`) : null,
    feeChip,
    !compact && hasOfficialGuide ? E('span', { class: 'spec-chip highlight' }, '🙌 헬퍼비 25만 (당일 현금)') : null,
    phoneChip,
    hasNote && compact ? E('span', { class: 'spec-chip highlight' }, '📝 메모 있음') : null,
    !compact && studio.fit ? E('span', { class: 'spec-chip' }, '🎯 ' + studio.fit) : null);
}

function studioProsCons(studio) {
  return E('div', { class: 'trip-pros-cons studio-pros-cons' },
    E('div', { class: 'pros-box' },
      E('strong', { class: 'pros-title' }, '👍 사진의 장점'),
      E('p', { class: 'small' }, studio.pros || '미기재')),
    E('div', { class: 'cons-box' },
      E('strong', { class: 'cons-title' }, '🤔 취향에 따른 아쉬움'),
      E('p', { class: 'small' }, studio.cons || '미기재')));
}

function renderLachmaStudioCard(ctx, studio) {
  const guestMode = ctx.isGuestMode();
  const memo = E('textarea', { maxlength: '1000', 'aria-label': `${studio.name} 개인 메모`, placeholder: '마음에 든 장면이나 촬영 당일 꼭 챙길 내용을 남겨요.' });
  memo.value = ctx.getPrefs().notes?.[studio.id] || '';
  memo.addEventListener('input', () => {
    const value = memo.value;
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), notes: { ...(ctx.getPrefs().notes || {}), [studio.id]: value } });
      const currentMemo = $('.selected-studio-card textarea');
      if (!saved) { if (currentMemo) currentMemo.value = ctx.getPrefs().notes?.[studio.id] || ''; }
      else if (currentMemo && currentMemo !== memo && currentMemo.value !== value) currentMemo.value = value;
      return saved;
    });
  });
  return E('section', { class: 'selected-studio-card', 'aria-label': `${studio.name} 스튜디오 촬영 안내` },
    E('div', { class: 'selected-studio-head' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'OUR CONFIRMED STUDIO & OFFICIAL SHOOT GUIDE'),
        E('h2', {}, `📸 ${studio.name} 스튜디오`),
        E('p', { class: 'small muted' }, studio.style)),
      E('div', { class: 'page-actions' },
        studio.deepGuide ? button('📋 촬영 브리핑 복사', () => copyLachmaGuideSummary(ctx, studio), 'button quiet') : null,
        studio.deepGuide?.officialInfo?.guideUrl ? externalLink('📄 공식 안내 원문 ↗', studio.deepGuide.officialInfo.guideUrl, 'button quiet') : null,
        button('사진 크게 보기', () => ctx.openPhotos(studio.name, studio.images.map(v => v.src), 0), 'button quiet'))),
    studioSpecChips(ctx, studio),
    E('div', { class: 'studio-photos' }, studio.images.map((im, index) => E('button', {
      type: 'button',
      class: 'photo-open studio-photo-frame',
      'aria-label': `${studio.name} 사진 ${index + 1} 원본 크게 보기`,
      onclick: () => ctx.openPhotos(studio.name, studio.images.map(value => value.src), index)
    }, image(im.src, `${studio.name} · ${im.file}`), E('span', { class: 'studio-photo-zoom', 'aria-hidden': 'true' }, '🔍 원본 보기')))),
    E('p', { class: 'small muted studio-sample-caption' }, '제공된 라크마 스튜디오 대표 샘플 사진입니다. 두 사람의 개인 포토 앨범과는 별도로 구분됩니다.'),
    studioProsCons(studio),
    !guestMode ? E('label', { class: 'field studio-memo-field' }, E('span', {}, '우리의 메모 ', E('span', { class: 'muted small' }, '· 이 기기에 저장')), memo) : null,
    studio.deepGuide ? renderLachmaDeepGuide(ctx, studio) : renderStudioOfficialLocation(ctx, studio));
}

let archiveQuery = '';
let archiveFilter = 'all';
let archiveDrawerOpen = false;

export function openStudioArchiveSearch(query = '') {
  archiveDrawerOpen = true;
  archiveFilter = 'all';
  archiveQuery = String(query || '');
}

function renderStudioArchiveCompare(ctx, allStudios) {
  const prefs = ctx.getPrefs();
  const pair = [prefs.left, prefs.right]
    .filter(Boolean)
    .map(id => allStudios.find(s => s.id === id))
    .filter(Boolean);
  if (!pair.length) return null;
  const rows = [
    ['스타일', s => s.style || '미기재'],
    ['장점', s => s.pros || '미기재'],
    ['아쉬움', s => s.cons || '미기재'],
    ['추천 취향', s => s.fit || '미기재'],
    ['추가금', s => s.fee || '미기재'],
    ['연락처', s => s.contact?.phone ? `${s.contact.phone}${s.contact.note ? ` (${s.contact.note})` : ''}` : (s.contact?.note || '목록 미기재')],
    ['개인 메모', s => prefs.notes?.[s.id]?.trim() || '미입력']
  ];
  return E('div', { class: 'studio-archive-compare' },
    E('div', { class: 'trip-comparison-head' },
      E('strong', {}, `⚖️ 스튜디오 나란히 비교 (${pair.length}/2)`),
      button('비교 비우기', () => {
        ctx.queuePreference(async () => {
          const next = { ...ctx.getPrefs(), left: '', right: '' };
          const ok = await ctx.savePrefs(next);
          if (ok) { archiveDrawerOpen = true; ctx.render(); ctx.toast('스튜디오 비교함을 비웠습니다.'); }
          return ok;
        });
      }, 'button quiet small-copy-btn')),
    E('div', { class: 'table-scroll' },
      E('table', { class: 'travel-comparison' },
        E('thead', {}, E('tr', {}, E('th', { scope: 'col' }, '비교 항목'), pair.map(s => E('th', { scope: 'col' }, s.name)))),
        E('tbody', {}, rows.map(([label, val]) => E('tr', {}, E('th', { scope: 'row' }, label), pair.map(s => E('td', {}, val(s)))))))));
}

function renderStudioArchiveDrawer(ctx, allStudios, activeId) {
  if (!Array.isArray(allStudios) || allStudios.length <= 1) return null;
  const withPhoneCount = allStudios.filter(s => Boolean(s.contact?.phone)).length;
  const withKnownFeeCount = allStudios.filter(s => !studioFeeInfo(s).unknown).length;

  const listWrap = E('div', { class: 'studio-archive-grid' });
  const compareSlot = E('div', { class: 'studio-compare-slot' });
  const countEl = E('span', { class: 'small muted', 'aria-live': 'polite' });
  const chipBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '보관 스튜디오 필터' });
  const search = searchBox({
    id: 'studio-archive-search',
    value: archiveQuery,
    placeholder: '스튜디오명·스타일·장단점·추가금 검색',
    ariaLabel: '보관된 스튜디오 30곳 검색',
    onInput: val => { archiveQuery = val; draw(); }
  });

  const toggleFav = studio => {
    ctx.queuePreference(async () => {
      const cur = new Set(ctx.getPrefs().favorites || []);
      const added = !cur.has(studio.id);
      if (added) cur.add(studio.id); else cur.delete(studio.id);
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), favorites: [...cur] });
      if (saved) {
        archiveDrawerOpen = true;
        ctx.render();
        ctx.toast(added ? `‘${studio.name}’을 관심 스튜디오에 추가했습니다.` : `‘${studio.name}’ 관심 표시를 해제했습니다.`);
      }
      return saved;
    });
  };

  const toggleCompare = studio => {
    ctx.queuePreference(async () => {
      const cur = ctx.getPrefs();
      let left = cur.left || '';
      let right = cur.right || '';
      if (left === studio.id) { left = right; right = ''; }
      else if (right === studio.id) { right = ''; }
      else if (!left) { left = studio.id; }
      else if (!right) { right = studio.id; }
      else {
        ctx.toast('비교할 스튜디오는 두 곳까지 선택할 수 있어요. 먼저 기존 항목을 해제해 주세요.', true);
        return true;
      }
      const saved = await ctx.savePrefs({ ...cur, left, right });
      if (saved) {
        archiveDrawerOpen = true;
        ctx.render();
      }
      return saved;
    });
  };

  const draw = () => {
    const latestPrefs = ctx.getPrefs();
    const latestFavs = new Set(latestPrefs.favorites || []);
    const compareIds = new Set([latestPrefs.left, latestPrefs.right].filter(Boolean));
    const withNoteCount = allStudios.filter(s => Boolean(latestPrefs.notes?.[s.id]?.trim())).length;

    const compNode = renderStudioArchiveCompare(ctx, allStudios);
    compareSlot.replaceChildren(...(compNode ? [compNode] : []));

    chipBar.replaceChildren(...[
      ['all', `전체 (${allStudios.length})`],
      ['phone', `연락처 기재 (${withPhoneCount})`],
      ['fee', `추가금 명시 (${withKnownFeeCount})`],
      ['fav', `관심 (${latestFavs.size})`],
      ['note', `메모 있음 (${withNoteCount})`]
    ].map(([key, label]) => {
      const btn = button(label, () => { archiveFilter = key; draw(); }, 'button quiet trip-filter-chip');
      btn.setAttribute('aria-pressed', String(archiveFilter === key));
      return btn;
    }));

    const q = archiveQuery.trim().toLocaleLowerCase();
    const filtered = allStudios.filter(s =>
      (archiveFilter === 'all'
        || (archiveFilter === 'phone' ? Boolean(s.contact?.phone)
          : archiveFilter === 'fee' ? !studioFeeInfo(s).unknown
            : archiveFilter === 'note' ? Boolean(latestPrefs.notes?.[s.id]?.trim())
              : latestFavs.has(s.id))) &&
      (!q || `${s.name} ${s.style} ${s.pros} ${s.cons} ${s.fit} ${s.fee} ${s.contact?.phone || ''} ${s.contact?.note || ''} ${latestPrefs.notes?.[s.id] || ''}`.toLocaleLowerCase().includes(q))
    );
    countEl.textContent = `${filtered.length}곳 표시 중 (전체 ${allStudios.length}곳)`;

    if (!filtered.length) {
      listWrap.replaceChildren(E('div', { class: 'no-results-box' },
        E('p', { class: 'no-results' }, '검색 조건에 맞는 스튜디오가 없습니다.'),
        button('필터 초기화', () => { archiveQuery = ''; archiveFilter = 'all'; search.input.value = ''; search.syncClear(); draw(); }, 'button quiet')));
      return;
    }

    listWrap.replaceChildren(...filtered.map(studio => {
      const isFav = latestFavs.has(studio.id);
      const isCompared = compareIds.has(studio.id);
      const isConfirmed = studio.id === activeId;
      const phone = studio.contact?.phone || '';
      const phoneDigits = phone.replace(/\D/g, '');
      const contactText = phone
        ? `${phone}${studio.contact?.note ? ` (${studio.contact.note})` : ''}`
        : (studio.contact?.note || '제공된 목록에 연락처 미기재');
      const noteText = latestPrefs.notes?.[studio.id]?.trim() || '';
      return E('article', { class: 'studio-archive-card' + (isConfirmed ? ' is-confirmed' : ''), 'data-archive-studio-id': studio.id },
        E('div', { class: 'studio-archive-card-head' },
          E('div', {},
            E('div', { class: 'studio-archive-title-row' },
              E('strong', {}, studio.name),
              isConfirmed ? E('span', { class: 'badge' }, '확정 스튜디오') : null),
            E('p', { class: 'small muted' }, studio.style)),
          E('div', { class: 'studio-archive-card-actions' },
            E('button', {
              type: 'button',
              class: 'button quiet small-copy-btn',
              'aria-pressed': String(isCompared),
              onclick: () => toggleCompare(studio)
            }, isCompared ? '✓ 비교 중' : '⚖️ 비교'),
            E('button', {
              type: 'button',
              class: 'button quiet small-copy-btn' + (isFav ? ' is-fav' : ''),
              'aria-pressed': String(isFav),
              onclick: () => toggleFav(studio)
            }, isFav ? '★ 관심' : '☆ 관심'),
            button(noteText ? '📝 메모 수정' : '📝 메모', () => openStudioMemoModal(ctx, studio), 'button quiet small-copy-btn'))),
        E('div', { class: 'studio-archive-thumbs' }, studio.images.map((im, idx) => E('button', {
          type: 'button',
          class: 'photo-open studio-archive-thumb-btn',
          'aria-label': `${studio.name} 샘플 사진 ${idx + 1} 확대`,
          onclick: () => ctx.openPhotos(`${studio.name} 샘플`, studio.images.map(v => v.src), idx)
        }, image(im.src, `${studio.name} · ${im.file}`, { loading: 'lazy', decoding: 'async' })))),
        E('dl', { class: 'studio-archive-dl small' },
          E('dt', {}, '장점'), E('dd', {}, studio.pros || '미기재'),
          E('dt', {}, '아쉬움'), E('dd', {}, studio.cons || '미기재'),
          E('dt', {}, '추천 취향'), E('dd', {}, studio.fit || '미기재'),
          E('dt', {}, '추가금'), E('dd', {}, studio.fee || '미기재'),
          E('dt', {}, '연락처'), E('dd', {},
            phone && phoneDigits
              ? [E('a', { href: `tel:${phoneDigits}`, class: 'text-button small' }, phone), studio.contact?.note ? ` · ${studio.contact.note}` : null]
              : contactText)),
        noteText ? E('p', { class: 'small muted studio-archive-memo' }, `📝 메모: ${noteText}`) : null);
    }));
  };

  draw();
  const drawer = E('details', { class: 'disclosure studio-archive-drawer', 'aria-label': '보관된 전체 스튜디오 참고 자료' },
    E('summary', {}, `📚 보관된 전체 스튜디오 참고 자료 보기 (${allStudios.length}곳 · 대표 샘플 ${allStudios.length * 2}장)`),
    E('div', { class: 'studio-archive-body' },
      E('p', { class: 'small muted' }, '확정 전 검토했던 전체 30개 스튜디오의 대표 샘플(60장), 장단점, 추가금 및 제공 연락처 출처 한계(공동 번호·지점 미구분 포함)를 그대로 보존하고 있습니다. 개인 포토 앨범과는 분리됩니다.'),
      E('div', { class: 'studio-archive-toolbar' },
        search.wrap,
        chipBar,
        countEl),
      compareSlot,
      listWrap));
  drawer.open = archiveDrawerOpen;
  drawer.addEventListener('toggle', () => { archiveDrawerOpen = drawer.open; });
  return drawer;
}

export function renderStudios(ctx) {
  if (ctx.isGuestMode()) return ctx.guestRestrictedView('라크마 스튜디오 촬영 안내', '신랑·신부의 웨딩 촬영 일정과 준비물을 정리한 공간입니다.', 'OUR STUDIO · LACMA');
  const { status, error, activeLachma } = ctx.getStudiosState();
  const allStudios = ctx.getStudiosList?.() || [];
  if (status !== 'ready') return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물을 확인해요.', null, 'OUR STUDIO · LACMA'),
    status === 'loading' ? E('p', { role: 'status' }, '스튜디오 자료를 불러오는 중입니다.') : ctx.empty('스튜디오 자료를 불러오지 못했어요.', error, '스튜디오 다시 불러오기', ctx.loadStudios, true)
  ];
  if (!activeLachma) return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물을 확인해요.', null, 'OUR STUDIO · LACMA'),
    ctx.empty('라크마 스튜디오 정보를 찾을 수 없어요.', '스튜디오 자료를 다시 불러와 주세요.', '스튜디오 다시 불러오기', ctx.loadStudios, true)
  ];
  return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물, 대표 샘플을 한곳에 모았습니다.',
      E('div', { class: 'page-actions' },
        button('⚡ 촬영 당일 현장 모드', () => ctx.openShootDayMode?.(), 'button')),
      'OUR STUDIO · LACMA'),
    renderLachmaStudioCard(ctx, activeLachma),
    renderStudioArchiveDrawer(ctx, allStudios, activeLachma.id)
  ];
}
