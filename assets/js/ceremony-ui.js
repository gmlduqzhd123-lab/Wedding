import { E, button, enhanceTablistKeyboard } from './dom.js?v=wedding-features-66';
import { formatDate } from './content.js?v=wedding-features-66';
import { CEREMONY_PREP_ITEMS } from './planning.js?v=wedding-features-66';
import { renderGuestListBoard, renderGiftLedgerBoard, openQuickGiftEntryModal, focusGuestSearch, focusGiftSearch } from './guest-ledger-ui.js?v=wedding-features-66';
import { renderWeddingDayOpsBoard } from './wedding-day-ui.js?v=wedding-features-66';

export { CEREMONY_PREP_ITEMS, openQuickGiftEntryModal, focusGuestSearch, focusGiftSearch };

let ceremonySubTab = 'rundown';
export function setCeremonySubTab(tab) {
  if (['rundown', 'guests', 'gifts', 'dayops'].includes(tab)) ceremonySubTab = tab;
}

function shiftTime(hhmm, deltaMinutes) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const total = ((Number(m[1]) * 60 + Number(m[2]) + deltaMinutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function ceremonyCleanName(raw, role, fallback = '○○○') {
  const cleaned = (raw || '').replace(new RegExp(`^${role}\\s*`), '').trim();
  return cleaned || fallback;
}

function ceremonyDateLabel(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return '    년   월   일';
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

function defaultAmorVowsText(inv = {}) {
  const groom = ceremonyCleanName(inv.partner1, '신랑', '(        )');
  const bride = ceremonyCleanName(inv.partner2, '신부', '(        )');
  return [
    '혼 인 서 약 서',
    '',
    '우리 두 사람이 부부가 되는 오늘',
    '양가 부모님과 참석해 주신 귀빈 여러분들 앞에서 다음을 서약합니다.',
    '',
    '첫 번째, 사랑하겠습니다.',
    '서로의 부족함을 사랑으로 채워주며 아끼고 사랑하겠습니다.',
    '',
    '두 번째, 존중하겠습니다.',
    '서로의 입장에서 생각하며, 서로를 배려하고 존중하겠습니다.',
    '',
    '세 번째, 성숙해지겠습니다.',
    '세상의 어려움을 함께 견디고 나아갈 수 있도록 강해지고 성숙해지겠습니다.',
    '',
    '네 번째, 기억하겠습니다.',
    '우리의 사랑과 이 순간의 서약을 영원히 기억하겠습니다.',
    '',
    '세상에서 가장 소중한 그대를 만났기에 부부라는 이름을 맞이하였고,',
    '함께한 날보다 함께할 날이 더 많음에 감사하며',
    '저희 결혼을 축복해 주시는 따뜻한 마음 잊지 않고 진심으로 행복하게 살겠습니다.',
    '',
    ceremonyDateLabel(inv.date),
    `신랑 ${groom}   ·   신부 ${bride}`
  ].join('\n');
}

export const DEFAULT_CEREMONY_PLAN = {
  style: 'noOfficiant',
  mc: '김희엽 친구',
  song: '아카펠라',
  speech: '교장선생님',
  banquetFloor: '',
  note: '',
  vows: '',
  declaration: ''
};

export function resolveCeremonyPlan(saved = null) {
  const raw = saved && typeof saved === 'object' ? saved : {};
  return {
    style: raw.style === 'officiant' ? 'officiant' : DEFAULT_CEREMONY_PLAN.style,
    mc: (raw.mc ?? '').trim() || DEFAULT_CEREMONY_PLAN.mc,
    song: (raw.song ?? '').trim() || DEFAULT_CEREMONY_PLAN.song,
    speech: (raw.speech ?? '').trim() || DEFAULT_CEREMONY_PLAN.speech,
    banquetFloor: (raw.banquetFloor ?? '').trim(),
    note: (raw.note ?? '').trim(),
    vows: (raw.vows ?? '').trim(),
    declaration: (raw.declaration ?? '').trim()
  };
}

export function defaultAmorDeclarationText(inv = {}, cPlan = {}) {
  const plan = resolveCeremonyPlan(cPlan);
  const groom = ceremonyCleanName(inv.partner1, '신랑');
  const bride = ceremonyCleanName(inv.partner2, '신부');
  const isOfficiant = plan.style === 'officiant';
  const speakerLine = isOfficiant
    ? `주례자 : ${plan.speech || '(주례 선생님 성함)'}`
    : (plan.speech ? `성혼선언 낭독 : ${plan.speech}` : `사회자 : ${plan.mc || '(사회자 성함)'}`);
  return [
    '성 혼 선 언 문',
    '',
    `신랑 ${groom} 군과`,
    `신부 ${bride} 양은`,
    '일가친척과 소중한 지인들을',
    '모신 자리에서 평생을 함께할',
    '부부가 되기를 굳게 맹세하였습니다.',
    '',
    '두 사람의 아름다운 약속에',
    '오늘 참석한 모두가 증인이 되어',
    '이 결혼이 진실하게 이루어졌음을',
    '엄숙히 선언합니다.',
    '',
    ceremonyDateLabel(inv.date),
    speakerLine
  ].join('\n');
}

export function buildAmorMcSteps(inv = {}, cPlan = {}) {
  const plan = resolveCeremonyPlan(cPlan);
  const groom = ceremonyCleanName(inv.partner1, '신랑');
  const bride = ceremonyCleanName(inv.partner2, '신부');
  const isOfficiant = plan.style === 'officiant';
  const mcName = plan.mc || '(사회자 성함)';
  const songLabel = plan.song || '(축가자 소개)';
  const isAcappella = /아카펠라/.test(songLabel);
  const floorRaw = plan.banquetFloor;
  const floorLabel = floorRaw ? (floorRaw.endsWith('층') ? floorRaw : `${floorRaw}층`) : '(   )층';
  const speechNote = plan.speech;
  const officiantLabel = speechNote || '주례 선생님';
  return [
    ['01', '개식 예고', '식장 앞쪽 착석 유도 · 사회자 단상 쪽 = 신랑 측 / 반대쪽 = 신부 측 · 휴대폰 매너모드', [
      `안내 말씀드리겠습니다. 잠시 후 신랑 ${groom} 군과 신부 ${bride} 양의 예식을 거행할 예정이오니, 참석하신 내빈 여러분들께서는 식장 안으로 들어오셔서 앞쪽부터 자리를 정돈하여 주시기를 바랍니다.`,
      '사회자 단상이 있는 쪽이 신랑 측이고 반대쪽이 신부 측입니다.',
      '아울러 정숙한 예식 진행을 위해 가지고 계신 핸드폰은 매너모드로 전환해 주시면 감사하겠습니다.'
    ]],
    isOfficiant
      ? ['02', '개식사 & 사회인사', '하객 인사 · 양가 감사 인사 · 큰 박수 유도 후 개식 선언', [
        `안녕하십니까? 오늘 결혼식의 사회를 맡게 된 ${mcName}입니다. (하객분들께 인사)`,
        '바쁘신 중에도 두 사람의 앞날을 축복해 주기 위해 이 자리에 참석해 주신 모든 분께 양가를 대표해 진심으로 감사의 말씀을 전합니다.',
        '오늘 두 사람의 새 출발을 축복하는 뜻깊은 자리에 따뜻한 박수와 응원을 아낌없이 보내 주시기를 바랍니다.',
        `그럼 지금부터 신랑 ${groom} 군과 신부 ${bride} 양의 결혼식을 시작하겠습니다.`
      ]]
      : ['02', '개식사 & 사회인사', `하객 인사(사회자: ${mcName}) · 예식 취지 소개 · 큰 박수 유도 후 개식 선언`, [
        `안녕하십니까? 오늘 결혼식의 사회를 맡게 된 ${mcName}입니다. (하객분들께 인사)`,
        '바쁘신 중에도 두 사람의 앞날을 축복해 주기 위해 이 자리에 참석해 주신 모든 분께 양가를 대표해 진심으로 감사의 말씀을 전합니다.',
        '오늘 결혼식은 주례 없이, 소중한 분들의 따뜻한 축하와 신랑·신부가 직접 준비한 순서로 뜻깊게 진행될 예정입니다. 두 사람에게 더없이 소중한 날이니만큼 많은 박수와 축하를 아낌없이 보내 주시기를 바랍니다.',
        `그럼 지금부터 신랑 ${groom} 군과 신부 ${bride} 양의 결혼식을 시작하겠습니다.`
      ]],
    ['03', '화촉점화', '양가 어머님 입장 → 점화 → 앞쪽 마주 보고 상호인사 → 하객 인사 → 착석 (박수 유도 3회)', [
      '먼저 성스러운 예식을 위하여 양가 어머니께서 신랑·신부의 앞날을 밝혀줄 축복의 촛불을 점화하는 순서가 있겠습니다. 긴장하지 않으시도록 따뜻한 박수로 맞이해 주시기를 바랍니다. “양가 어머니 입장해 주세요. 큰 박수 부탁드립니다.”',
      '(촛불 점화 중) 한복을 곱게 입으신 어머님들께서 두 사람의 앞날을 밝혀줄 불을 점화하고 있습니다.',
      '(점화 후) 양가 어머님께서는 앞으로 나오셔서 서로를 마주 보고 상호인사를 해 주시기 바랍니다. “양가 어머님 상호인사” — 따뜻한 박수 부탁드립니다.',
      '이제 어머님들께서는 하객 여러분을 향해 서 주시겠습니다. “하객 여러분께 인사” — 어머님들께서는 이제 혼주석 자리로 착석 부탁드립니다.'
    ]],
    ['04', '신랑 입장', '신랑 버진로드 위 대기 확인 → 뒤쪽 주목 및 환호 유도 → 등장·인사 후 재박수', [
      '(신랑 버진로드 위 대기 확인) 다음은 오늘의 주인공인 신랑을 만나볼 차례인데요, 모두 뒤쪽을 바라봐 주시기를 바랍니다.',
      '지금 누구보다 긴장했을 신랑을 위해 뜨거운 박수와 환호로 맞이해 주시기를 바랍니다. 내빈 여러분의 축복 속에 신랑 입장하겠습니다. “신랑 입장!”',
      '(신랑 등장 후 인사하면) 다시 한번 축하의 박수 부탁드립니다.'
    ]],
    ['05', '신부 입장 (2단계 큐)', '① 신부문 오픈 전 ‘신부 등장’ 콜 & 박수 → ② 문 앞 준비 후 아버님 손 잡고 ‘신부 입장’', [
      '[1단계 · 신부문 나오기 전] 다음은 오늘 또 한 사람의 주인공이자, 이 세상에서 가장 아름다운 신부가 내빈 여러분의 축복 속에 등장하겠습니다. 한 걸음 한 걸음 긴장하지 않도록 뜨거운 박수 부탁드립니다. “신부 등장!”',
      '[2단계 · 신부문 앞 준비 완료 후] 세상에서 가장 아름다운 신부님이 아버님의 손을 잡고 여러분의 축복 속에서 입장하겠습니다. “신부 입장!”',
      '오늘의 주인공들이 무사히 입장을 마쳤습니다.'
    ]],
    ['06', '맞절', '양가 부모님·일가친척·내빈 앞 첫 만남의 예 → 맞절 후 하객 향해 서기', [
      '다음은 하객 여러분들을 모신 가운데 두 사람이 첫 만남의 예를 갖추는 맞절 순서가 있겠습니다. 서로를 존중하는 마음으로 인사를 나누겠습니다. “신랑·신부 맞절”',
      '(맞절 후) 신랑, 신부는 하객을 향해 서 주시기를 바랍니다.'
    ]],
    ['07', '혼인서약서 낭독', '신랑·신부 함께 서약서 낭독 → 낭독 후 응원 박수 유도', [
      '다음은 신랑·신부의 혼인서약서 낭독이 있겠습니다. 결혼을 약속한 두 사람이 서로에 대한 사랑의 서약을 하겠습니다.',
      '(혼인서약서 낭독 후) 두 사람의 사랑이 가득 담긴 서약이었습니다. 행복한 결혼생활을 시작할 수 있도록 응원의 박수 부탁드립니다.'
    ]],
    isOfficiant
      ? ['08', '성혼선언문 & 주례사', `주례 선생님(${officiantLabel}) 등단 안내 → 성혼선언문 낭독 및 주례사 → 감사 박수`, [
        `다음으로 두 사람의 결혼이 성사되었음을 선언하는 성혼선언문 낭독과 주례사가 있겠습니다. 오늘 예식의 주례를 맡아주신 ${officiantLabel}께서 등단하시겠습니다. 따뜻한 박수로 맞이해 주시기 바랍니다.`,
        '(성혼선언문 낭독 및 주례사 후) 귀한 말씀으로 두 사람의 앞날을 축복해 주신 주례 선생님께 다시 한번 큰 박수 부탁드립니다.'
      ]]
      : (speechNote
        ? ['08', '성혼선언문 낭독 및 축사', `${speechNote} 등단 안내 → 성혼선언문 낭독 및 축사 진행 → 성혼 성사 축하 박수`, [
          `다음으로 두 사람의 결혼이 성사되었음을 선언하는 성혼선언문 낭독과 축사가 있겠습니다. 오늘 귀한 순서를 맡아주신 ${speechNote}께서 등단하시겠습니다. 따뜻한 박수로 맞이해 주시기를 바랍니다.`,
          `(성혼선언문 낭독 및 축사 후) 이로써 두 사람의 결혼이 모두의 축복 속에 성사되었습니다. 따뜻한 성혼선언과 귀한 축사를 전해 주신 ${speechNote}께 다시 한번 큰 박수 부탁드립니다.`
        ]]
        : ['08', '성혼선언문 (사회자 진행)', '사회자가 성혼선언문 직접 낭독 → 성혼 성사 선언 및 큰 박수', [
          '다음으로 두 사람의 결혼이 성사되었음을 선언하는 성혼선언문을 낭독하겠습니다. 오늘은 특별한 주례 없는 예식이므로 사회자인 제가 성혼선언문을 낭독하겠습니다.',
          '(성혼선언문 낭독 후) 이로써 두 사람의 결혼이 성사되었습니다. 새로운 발걸음을 내딛는 두 사람에게 큰 박수로 축하해 주시기를 바랍니다.'
        ]]),
    ['09', '혼주 및 내빈께 인사', '이동 동선 주의: ① 신부 부모님 앞 인사·포옹 → ② 신랑 부모님 앞 인사·포옹 → ③ 중앙 이동 내빈 인사', [
      '[① 신부 부모님께] 먼저 신랑·신부는 신부 부모님 앞쪽으로 이동해 주시겠습니다. 정성스럽게 키워 시집보내시는 신부 부모님께 감사 인사를 드리겠습니다. “신랑, 신부 부모님께 인사” — 아버님, 어머님께서는 두 사람을 따뜻하게 안아주시기를 바랍니다.',
      '[② 신랑 부모님께] 다음으로 신랑 부모님 앞쪽으로 이동해 주시겠습니다. 듬직하게 자라 좋은 배우자를 만날 때까지 지켜봐 주신 신랑 부모님께 감사 인사를 드리겠습니다. “신랑, 신부 부모님께 인사” — 따뜻하게 안아주시기를 바랍니다.',
      '[③ 내빈께] 이제 중앙으로 이동해 하객 여러분을 향해 서시겠습니다. 어려운 걸음 해 주신 하객 여러분께 감사의 마음을 담아 인사드리겠습니다. “신랑, 신부 내빈께 인사” — 큰 박수로 답례해 주시면 감사하겠습니다.'
    ]],
    ['10', '축가', `혼주·내빈 인사 다음 순서 · ${songLabel}${isAcappella ? ' (마이크 인원수·음향 체크)' : ''} 무대 소개 및 응원 박수 유도`, [
      isAcappella
        ? `다음은 신랑·신부를 축하하기 위한 특별한 ${songLabel} 축가 무대가 있겠습니다.`
        : `다음은 신랑·신부를 축하하기 위한 특별한 축가가 있겠습니다. 축가자는 ${songLabel}입니다.`,
      isAcappella
        ? '(무대·마이크 준비 중) 아름다운 아카펠라 하모니로 이 순간을 빛내 주실 축가팀을 위해 뜨거운 박수와 환호로 응원해 주시기를 바랍니다.'
        : '(무대 준비 중) 오늘 이 순간을 위해 무대를 준비해 주신 축가자분을 위해 뜨거운 박수와 환호로 응원해 주시기를 바랍니다.',
      isAcappella
        ? '(축가 종료 후) 멋진 아카펠라 무대로 두 사람의 새 출발을 축복해 주신 분들께 다시 한번 큰 박수 부탁드립니다.'
        : '(축가 종료 후) 멋진 무대를 펼쳐준 분께 다시 한번 큰 박수 부탁드립니다.'
    ]],
    ['11', '행진', '신랑·신부 드레스 정리 및 준비 완료 확인 후 진행!', [
      '이제 마지막 행진만을 남겨놓았습니다. (신랑·신부 드레스 정리 및 준비 완료 확인 후 진행)',
      '신랑·신부가 새로운 인생의 출발을 위해 첫발을 내딛습니다. 한마음 한뜻으로 나아가는 길에 항상 축복이 있도록 뜨거운 박수로 성원해 주시기를 바랍니다. “신랑 신부 행진!”'
    ]],
    ['12', '폐회식 & 연회장 안내', `폐식 선언 → 가족·친지·친구 원판 촬영 대기 안내 → ${floorLabel} 연회홀 안내`, [
      `이상으로 신랑 ${groom} 군과 신부 ${bride} 양의 결혼식을 마치겠습니다. 복된 새 가정을 위하여 앞날을 축복해 주시기를 바라며, 따뜻하게 발걸음해 주신 모든 하객 여러분께 감사 말씀 드립니다.`,
      '계속해서 신랑·신부의 가족, 친지, 친구분들께서는 사진 촬영이 있사오니 자리해 주시기를 바랍니다.',
      `피로연 장소는 ${floorLabel} 연회홀에 준비되어 있사오니 한 분도 빠짐없이 참석하시어 두 사람의 결혼을 더욱 빛내 주시기를 바랍니다.`
    ]]
  ];
}

export function openCeremonyEditor(ctx, focusField = '') {
  if (ctx.isGuestMode()) return;
  const inv = ctx.getContent().invitation || {};
  const prefs = ctx.getPrefs();
  const current = structuredClone(prefs.ceremonyPlan || { style: 'noOfficiant', mc: '', song: '', speech: '', banquetFloor: '', note: '', vows: '', declaration: '' });
  const form = E('form', { class: 'editor-form' });
  form.append(E('p', { class: 'form-note' }, `확정 기본값: 사회자 ${DEFAULT_CEREMONY_PLAN.mc} · 성혼선언문 낭독 및 축사 ${DEFAULT_CEREMONY_PLAN.speech} 진행 · 축가 ${DEFAULT_CEREMONY_PLAN.song} (빈칸으로 두면 자동 반영되며, 이 기기의 개인 설정에만 저장됩니다.)`));
  const styleSelect = E('select', { id: 'ceremony-style' }, [
    E('option', { value: 'noOfficiant' }, '주례 없는 예식 (순천아모르웨딩컨벤션 12단계 기준)'),
    E('option', { value: 'officiant' }, '일반 예식 (주례사 중심)')
  ]);
  styleSelect.value = current.style || 'noOfficiant';
  const mcInput = E('input', { type: 'text', maxlength: '120', id: 'ceremony-mc', placeholder: `기본값: ${DEFAULT_CEREMONY_PLAN.mc} (세부 성함·메모 입력 가능)` });
  mcInput.value = current.mc || '';
  const songInput = E('input', { type: 'text', maxlength: '160', id: 'ceremony-song', placeholder: `기본값: ${DEFAULT_CEREMONY_PLAN.song} (곡명·팀명 추가 입력 가능)` });
  songInput.value = current.song || '';
  const speechInput = E('input', { type: 'text', maxlength: '160', id: 'ceremony-speech', placeholder: `기본값: ${DEFAULT_CEREMONY_PLAN.speech} (성혼선언문 낭독 및 축사)` });
  speechInput.value = current.speech || '';
  const floorInput = E('input', { type: 'text', maxlength: '40', id: 'ceremony-floor', placeholder: '예: 2층 (폐회식 연회홀 안내 멘트에 자동 반영)' });
  floorInput.value = current.banquetFloor || '';
  const noteInput = E('textarea', { rows: '3', maxlength: '1000', id: 'ceremony-note', placeholder: '예: 화촉점화 BGM · 신랑 입장곡 · 신부 입장곡 · 행진곡 · 반지 교환 여부 메모' });
  noteInput.value = current.note || '';
  const vowsInput = E('textarea', { rows: '9', maxlength: '3000', id: 'ceremony-vows', placeholder: defaultAmorVowsText(inv) });
  vowsInput.value = current.vows || '';
  const declInput = E('textarea', { rows: '7', maxlength: '2000', id: 'ceremony-declaration', placeholder: defaultAmorDeclarationText(inv, current) });
  declInput.value = current.declaration || '';
  const fillVowsBtn = button('↺ 아모르 기본 혼인서약서 예문 채우기', async () => {
    if (vowsInput.value.trim() && !await ctx.confirmAction({ title: '혼인서약서 예문 채우기', message: '현재 작성된 혼인서약서 문구를 기본 예문으로 바꿀까요?', confirmLabel: '기본 예문으로 변경' })) return;
    vowsInput.value = defaultAmorVowsText(inv);
    vowsInput.focus({ preventScroll: true });
    ctx.toast('기본 혼인서약서(4가지 약속) 예문을 채웠습니다. 두 분의 말투로 자유롭게 다듬어 보세요.');
  }, 'button quiet small-copy-btn');
  const clearVowsBtn = button('기본값 자동 연동으로 비우기', () => {
    vowsInput.value = '';
    ctx.toast('기본 서약서 자동 연동 상태로 되돌렸습니다.');
  }, 'checklist-note-btn');
  const fillDeclBtn = button('↺ 아모르 기본 성혼선언문 채우기', async () => {
    if (declInput.value.trim() && !await ctx.confirmAction({ title: '성혼선언문 예문 채우기', message: '현재 작성된 성혼선언문 문구를 기본 예문으로 바꿀까요?', confirmLabel: '기본 예문으로 변경' })) return;
    declInput.value = defaultAmorDeclarationText(inv, { ...current, style: styleSelect.value === 'officiant' ? 'officiant' : 'noOfficiant', mc: mcInput.value.trim(), speech: speechInput.value.trim() });
    declInput.focus({ preventScroll: true });
    ctx.toast('기본 성혼선언문 예문을 채웠습니다.');
  }, 'button quiet small-copy-btn');
  const clearDeclBtn = button('기본값 자동 연동으로 비우기', () => {
    declInput.value = '';
    ctx.toast('기본 성혼선언문 자동 연동 상태로 되돌렸습니다.');
  }, 'checklist-note-btn');
  form.append(
    E('label', { class: 'field', for: styleSelect.id }, '예식 진행 형태', styleSelect),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: mcInput.id }, '사회자 (기본: 김희엽 친구)', mcInput),
      E('label', { class: 'field', for: floorInput.id }, '피로연 연회홀 층수 (선택)', floorInput)),
    E('div', { class: 'field-row' },
      E('label', { class: 'field', for: songInput.id }, '축가 (기본: 아카펠라)', songInput),
      E('label', { class: 'field', for: speechInput.id }, '성혼선언문 낭독 및 축사 (기본: 교장선생님)', speechInput)),
    E('label', { class: 'field', for: noteInput.id }, '식순·BGM·입장곡 특이사항 메모 (선택)', noteInput),
    E('div', { class: 'ceremony-editor-doc-block' },
      E('div', { class: 'ceremony-editor-doc-head' },
        E('strong', { class: 'small' }, '💍 혼인서약서 문안 (수정 예정 · 비워 두면 아모르 기본 4가지 서약 예문 자동 적용)'),
        E('div', { class: 'lachma-official-links' }, fillVowsBtn, clearVowsBtn)),
      vowsInput),
    E('div', { class: 'ceremony-editor-doc-block' },
      E('div', { class: 'ceremony-editor-doc-head' },
        E('strong', { class: 'small' }, '📜 성혼선언문 문안 (수정 예정 · 비워 두면 교장선생님 기본 예문 자동 적용)'),
        E('div', { class: 'lachma-official-links' }, fillDeclBtn, clearDeclBtn)),
      declInput),
    E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), E('button', { class: 'button', type: 'submit' }, '식순 플래너 저장'))
  );
  const submit = form.querySelector('[type="submit"]');
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    const nextCeremony = {
      style: styleSelect.value === 'officiant' ? 'officiant' : 'noOfficiant',
      mc: mcInput.value.trim(),
      song: songInput.value.trim(),
      speech: speechInput.value.trim(),
      banquetFloor: floorInput.value.trim(),
      note: noteInput.value.trim(),
      vows: vowsInput.value.trim(),
      declaration: declInput.value.trim()
    };
    try {
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), ceremonyPlan: nextCeremony }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast('본식 식순·사회자 큐시트·낭독문 설정을 저장했습니다.');
      }
    } catch (error) {
      ctx.toast(ctx.storageMessage(error), true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  const snapshot = () => JSON.stringify([styleSelect.value, mcInput.value, songInput.value, speechInput.value, floorInput.value, noteInput.value, vowsInput.value, declInput.value]);
  const initial = snapshot();
  if (ctx.showDialog('본식 식순 · 사회자 · 낭독문 편집', form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initial, isSaving: () => saving });
    if (focusField === 'vows') setTimeout(() => vowsInput.focus(), 30);
    else if (focusField === 'declaration') setTimeout(() => declInput.focus(), 30);
  }
}

function printCeremonyPapersOnly() {
  document.body.classList.add('print-ceremony-papers');
  const cleanup = () => {
    document.body.classList.remove('print-ceremony-papers');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}

function copyCeremonyPlanText(ctx, timeline, orderSteps, cPlan, inv, baseTime, isNoOfficiant) {
  const plan = resolveCeremonyPlan(cPlan);
  const lines = [
    `🔔 [본식 당일 타임테이블 & 식순 요약] ${inv.partner1 || '신랑'} ♥ ${inv.partner2 || '신부'}`,
    `· 일시: ${inv.date ? formatDate(inv.date) : '예식일'} ${baseTime}`,
    `· 장소: ${inv.venue || '순천아모르웨딩컨벤션'}${plan.banquetFloor ? ` (피로연 연회홀: ${plan.banquetFloor})` : ''}`,
    `· 예식 형태: ${isNoOfficiant ? '주례 없는 예식 (순천아모르 12단계 기준)' : '일반 예식 (주례사 중심)'}`,
    `· 사회자: ${plan.mc} / 성혼선언문 낭독 및 축사: ${plan.speech} 진행 / 축가: ${plan.song}`,
    '· 홀 좌석 방향: 사회자 단상이 있는 쪽 = 신랑 측 / 반대쪽 = 신부 측',
    '',
    '⏰ [당일 타임테이블]',
    ...timeline.map(([t, title, desc]) => `- ${t} ${title}: ${desc}`),
    '',
    `📋 [${isNoOfficiant ? '주례 없는 예식 12단계' : '일반 예식'} 식순]`,
    ...orderSteps
  ];
  if (plan.note) lines.push('', `🎼 [BGM·진행 메모]\n${plan.note}`);
  ctx.copyTextToClipboard(lines.join('\n'), '본식 타임테이블·식순 요약을 클립보드에 복사했습니다.');
}

function copyAmorMcScript(ctx, inv, cPlan) {
  const plan = resolveCeremonyPlan(cPlan);
  const isOfficiant = plan.style === 'officiant';
  const mcSteps = buildAmorMcSteps(inv, plan);
  const declText = plan.declaration || defaultAmorDeclarationText(inv, plan);
  const speechMeta = isOfficiant ? ` / 주례: ${plan.speech}` : (plan.speech ? ` / 성혼선언·축사: ${plan.speech} 진행` : '');
  const lines = [
    `🎤 [사회자 진행 대본 · 큐시트] ${inv.partner1 || '신랑'} ♥ ${inv.partner2 || '신부'} ${isOfficiant ? '일반 예식 (주례사 중심)' : '주례 없는 결혼식'}`,
    `· 일시: ${inv.date ? formatDate(inv.date) : '예식일'} ${inv.time || '15:00'}`,
    `· 장소: ${inv.venue || '순천아모르웨딩컨벤션'}`,
    `· 사회자: ${plan.mc} / 축가: ${plan.song}${speechMeta} / 연회홀: ${plan.banquetFloor || '층수 확인 필요'}`,
    '',
    ...mcSteps.flatMap(([no, title, cue, scripts]) => [
      `[${no}. ${title}]`,
      `  * 현장 체크: ${cue}`,
      ...scripts.map(s => `  "${s}"`),
      ...(no === '08' ? ['', `  --- [${isOfficiant ? '성혼선언문 낭독문 (주례·사회 참고)' : `성혼선언문 낭독문 (${plan.speech || '사회자'} 진행${plan.declaration ? '' : ' · 수정 예정'})`}] ---`, ...declText.split('\n').map(l => `  ${l}`), '  ---------------------------'] : []),
      ''
    ]),
    '※ 본 대본은 두 사람의 예식 진행을 위해 정리한 개인 준비본입니다.'
  ];
  ctx.copyTextToClipboard(lines.join('\n'), '사회자 진행 전체 대본(성혼선언문 포함)을 복사했습니다.');
}

export function renderCeremony(ctx) {
  if (ctx.isGuestMode()) return ctx.guestRestrictedView('본식 식순 · 낭독 예문', '신랑·신부의 본식 리허설과 낭독 준비를 위한 공간입니다.', 'AMOR WEDDING HALL · CEREMONY & VOWS');
  const inv = ctx.getContent().invitation || {};
  const prefs = ctx.getPrefs();
  const baseTime = inv.time || '15:00';
  const cPlan = resolveCeremonyPlan(prefs.ceremonyPlan);
  const isNoOfficiant = cPlan.style !== 'officiant';
  const timeline = [
    [shiftTime(baseTime, -270) || '10:30', '메이크업 샵 출발·이동', '헤어·메이크업 마무리 및 드레스 착용·이동 준비'],
    [shiftTime(baseTime, -90) || '13:30', '웨딩홀 도착·신부대기실 입장', `${inv.venue || '순천아모르웨딩컨벤션'} 도착 · 스냅 촬영 시작 · 혼주 코사지 확인`],
    [shiftTime(baseTime, -60) || '14:00', '하객 맞이·좌석/접수대 점검', '축의대·식권 확인 · 사회자 단상 쪽(신랑 측) / 반대쪽(신부 측) 안내 점검'],
    [shiftTime(baseTime, -20) || '14:40', '입장 동선·사회자 최종 리허설', `개식 예고(${cPlan.mc}) · 신랑 버진로드 대기 · 신부 2단계 입장 · 혼인서약서/성혼선언문(${cPlan.speech}) 단상 체크`],
    [baseTime, isNoOfficiant ? '본식 개식 (주례 없는 예식 12단계)' : '본식 개식 (일반 예식)', isNoOfficiant ? `개식사(${cPlan.mc}) → 화촉점화 → 신랑·신부 입장 → 맞절 → 혼인서약 → 성혼선언·축사(${cPlan.speech}) → 혼주·내빈 인사 → 축가(${cPlan.song}) → 행진 → 폐식` : `개식 선언(${cPlan.mc}) → 화촉점화 → 신랑·신부 입장 → 맞절·혼인서약 → 성혼선언·주례사(${cPlan.speech}) → 혼주·내빈 인사 → 축가(${cPlan.song}) → 행진 → 폐식`],
    [shiftTime(baseTime, 50) || '15:50', '원판 기념촬영', '폐회식 직후 양가 가족·친지·친구 사진 촬영'],
    [shiftTime(baseTime, 80) || '16:20', `연회홀(${cPlan.banquetFloor || '층수 확인'}) 피로연 인사`, '환복 후 연회홀 하객 감사 인사 및 본식 정산 마무리']
  ];
  const mcSteps = buildAmorMcSteps(inv, cPlan);
  const orderSteps = isNoOfficiant ? [
    '01. 개식 예고 (단상 쪽 신랑 측 · 반대쪽 신부 측 좌석 안내 · 매너모드)',
    `02. 개식사 & 사회인사 (사회자: ${cPlan.mc})`,
    '03. 화촉점화 (양가 어머님 입장 → 점화 → 상호인사 → 하객 인사)',
    '04. 신랑 입장 (버진로드 위 대기 후 입장)',
    '05. 신부 입장 (① 신부문 전 등장 콜 → ② 아버님 손 잡고 입장)',
    '06. 맞절 (첫 만남의 예 → 하객 향해 정렬)',
    `07. 혼인서약서 낭독 (신랑·신부 함께 낭독${cPlan.vows ? '' : ' · 수정 예정'})`,
    cPlan.speech
      ? `08. 성혼선언문 낭독 및 축사 (${cPlan.speech} 진행${cPlan.declaration ? '' : ' · 수정 예정'})`
      : `08. 성혼선언문 낭독 (사회자 진행${cPlan.declaration ? '' : ' · 수정 예정'})`,
    '09. 혼주 및 내빈께 인사 (① 신부 부모님 → ② 신랑 부모님 → ③ 중앙 내빈)',
    `10. 축가 (${cPlan.song} · 혼주·내빈 인사 다음 순서)`,
    '11. 행진 (신랑·신부 드레스 정리 완료 확인 후 출발)',
    `12. 폐회식 · 원판촬영 & 피로연 연회홀(${cPlan.banquetFloor || '층수 확인 필요'}) 안내`
  ] : [
    `01. 개식 예고 및 개식 선언 (사회자: ${cPlan.mc})`,
    '02. 양가 어머님 화촉점화 (점화 → 상호인사 → 하객 인사)',
    '03. 신랑 입장 → 신부 입장',
    `04. 신랑·신부 맞절 및 혼인서약${cPlan.vows ? '' : ' (수정 예정)'}`,
    `05. 성혼선언문 낭독 및 주례사 (${cPlan.speech} 진행${cPlan.declaration ? '' : ' · 수정 예정'})`,
    '06. 혼주 및 내빈께 감사 인사 (신부 부모님 → 신랑 부모님 → 내빈)',
    `07. 축가 (${cPlan.song})`,
    `08. 행진 · 폐회식 & 연회홀(${cPlan.banquetFloor || '층수 확인'}) 안내`
  ];
  const vowsText = (cPlan.vows || '').trim() || defaultAmorVowsText(inv);
  const declText = (cPlan.declaration || '').trim() || defaultAmorDeclarationText(inv, cPlan);
  const checkedSet = new Set(prefs.ceremonyChecks || []);
  const prepDone = CEREMONY_PREP_ITEMS.filter(([id]) => checkedSet.has(id)).length;
  const togglePrepCheck = (itemId, checked) => {
    ctx.queuePreference(async () => {
      const next = new Set(ctx.getPrefs().ceremonyChecks || []);
      if (checked) next.add(itemId); else next.delete(itemId);
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), ceremonyChecks: [...next] });
      if (saved) ctx.render();
      return saved;
    });
  };
  const urlSubTab = ctx.currentSubTab?.();
  if (['rundown', 'guests', 'gifts', 'dayops'].includes(urlSubTab)) ceremonySubTab = urlSubTab;
  const guestCount = (prefs.guestList || []).length;
  const giftCount = (prefs.giftLedger || []).length;
  const dayOpsCount = (prefs.weddingDayRoles || []).length + (prefs.weddingDayEnvelopes || []).length;
  const subTabs = [
    ['rundown', '📋 본식 식순·대본', `${prepDone}/${CEREMONY_PREP_ITEMS.length}`],
    ['guests', '👥 하객 명단', `${guestCount}건`],
    ['gifts', '💌 축의금·식권 장부', `${giftCount}건`],
    ['dayops', '💼 당일 역할·봉투·원판', dayOpsCount ? `${dayOpsCount}건` : '운영표']
  ];
  const subTabBar = enhanceTablistKeyboard(E('div', { class: 'subtab-bar prenatal-subtabs', role: 'tablist', 'aria-label': '본식·하객·축의금·당일운영 화면 전환' },
    subTabs.map(([key, label, badge]) => {
      const selected = ceremonySubTab === key;
      return E('button', {
        type: 'button',
        role: 'tab',
        class: 'subtab-btn' + (selected ? ' is-active' : ''),
        'aria-selected': String(selected),
        'data-ceremony-tab': key,
        onclick: () => {
          ceremonySubTab = key;
          if (ctx.setSubTabHash) ctx.setSubTabHash('ceremony', key);
          else ctx.render();
          document.querySelector(`[data-ceremony-tab="${key}"]`)?.focus({ preventScroll: true });
        }
      }, E('span', { class: 'subtab-label' }, label), E('span', { class: 'subtab-badge' }, badge));
    })));

  const openLiveCueSheetModal = () => {
    let stepIdx = 0;
    const completed = new Set();
    let elapsedSec = 0;
    let timerId = null;
    let fontScale = 100;
    let wakeLockSentinel = null;
    let wakeLockRequested = false;
    const body = E('div', { class: 'live-cue-modal' });

    const fmtClock = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
    const releaseWakeLock = async () => {
      wakeLockRequested = false;
      if (wakeLockSentinel) {
        try { await wakeLockSentinel.release(); } catch {}
        wakeLockSentinel = null;
      }
    };
    const requestWakeLock = async (silent = false) => {
      if (!navigator.wakeLock?.request) {
        if (!silent) ctx.toast('이 브라우저는 화면 꺼짐 방지(Wake Lock)를 지원하지 않습니다.', true);
        return false;
      }
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockRequested = true;
        wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; if (body.isConnected) draw(); });
        if (!silent) ctx.toast('☀️ 화면 꺼짐 방지를 켰습니다. 본식 진행 중 화면이 유지됩니다.');
        return true;
      } catch {
        wakeLockRequested = false;
        if (!silent) ctx.toast('화면 꺼짐 방지를 켜지 못했습니다. 기기 절전 설정을 확인해 주세요.', true);
        return false;
      }
    };
    const onVisibility = () => {
      if (!body.isConnected) {
        document.removeEventListener('visibilitychange', onVisibility);
        releaseWakeLock();
        return;
      }
      if (document.visibilityState === 'visible' && wakeLockRequested && !wakeLockSentinel) {
        requestWakeLock(true).then(() => { if (body.isConnected) draw(); });
      }
    };
    const stagingCueBadge = (title, cue) => {
      const text = `${title} ${cue}`;
      if (/화촉|점화/.test(text)) return '🕯️ 화촉 BGM · 조명 다운';
      if (/신랑 입장/.test(text)) return '🎵 신랑 입장곡 · 핀조명';
      if (/신부 입장/.test(text)) return '🎵 신부 등장·입장곡 · 문 오픈 큐';
      if (/축가/.test(text)) return /아카펠라/.test(cPlan.song) ? '🎤 아카펠라 축가 · 마이크 인원수·음향 체크' : '🎤 축가 반주 · 마이크 2대 확인';
      if (/행진/.test(text)) return '🎊 행진곡 · 플라워샤워·드레스 정리';
      if (/원판|폐회/.test(text)) return '📸 원판 촬영 안내 · 연회홀 멘트';
      if (/선언|축사/.test(text)) return `📜 단상 성혼선언문 · ${cPlan.speech || '사회자'} 마이크 체크`;
      if (/서약/.test(text)) return '📜 단상 서약서 · 잔잔한 배경음';
      if (/인사|맞절/.test(text)) return '🙇 양가 혼주·하객 방향 안내';
      return '🎙️ 사회자 마이크 · 홀 안내';
    };

    const draw = () => {
      const [no, title, cue, scripts] = mcSteps[stepIdx];
      const nextStep = mcSteps[stepIdx + 1] || null;
      const clockVal = E('strong', { class: 'live-cue-clock' }, fmtClock(elapsedSec));
      const toggleTimerBtn = button(timerId ? '⏸ 일시정지' : '▶ 타이머 시작', () => {
        if (timerId) stopTimer();
        else {
          timerId = setInterval(() => {
            if (!body.isConnected) { stopTimer(); releaseWakeLock(); return; }
            elapsedSec++;
            const el = body.querySelector('.live-cue-clock');
            if (el) el.textContent = fmtClock(elapsedSec);
          }, 1000);
        }
        draw();
      }, 'button quiet small-copy-btn');
      const resetTimerBtn = button('↺ 초기화', () => { stopTimer(); elapsedSec = 0; draw(); }, 'button quiet small-copy-btn');
      const wakeBtn = E('button', {
        type: 'button',
        class: 'button quiet small-copy-btn live-cue-wake-btn' + (wakeLockSentinel ? ' is-active' : ''),
        'aria-pressed': String(Boolean(wakeLockSentinel)),
        title: '진행 중 스마트폰 화면이 자동으로 꺼지지 않게 유지',
        onclick: async () => {
          if (wakeLockSentinel) {
            await releaseWakeLock();
            ctx.toast('화면 꺼짐 방지를 껐습니다.');
          } else {
            await requestWakeLock(false);
          }
          if (body.isConnected) draw();
        }
      }, wakeLockSentinel ? '☀️ 화면 유지 중' : '☀️ 화면 유지');
      const fontDownBtn = button('A−', () => { fontScale = Math.max(85, fontScale - 15); draw(); }, 'button quiet small-copy-btn');
      fontDownBtn.setAttribute('aria-label', '대본 글자 작게');
      fontDownBtn.disabled = fontScale <= 85;
      const fontUpBtn = button('A+', () => { fontScale = Math.min(145, fontScale + 15); draw(); }, 'button quiet small-copy-btn');
      fontUpBtn.setAttribute('aria-label', '대본 글자 크게');
      fontUpBtn.disabled = fontScale >= 145;
      const dots = E('div', { class: 'live-cue-dots', role: 'tablist', 'aria-label': '식순 단계 선택' },
        mcSteps.map(([sNo, sTitle], idx) => E('button', {
          type: 'button',
          role: 'tab',
          class: 'live-cue-dot' + (idx === stepIdx ? ' is-current' : '') + (completed.has(idx) ? ' is-done' : ''),
          'aria-selected': String(idx === stepIdx),
          title: `${sNo}. ${sTitle}`,
          onclick: () => { stepIdx = idx; draw(); }
        }, sNo)));

      const prevBtn = button('← 이전 단계', () => { if (stepIdx > 0) { stepIdx--; draw(); } }, 'button quiet');
      prevBtn.disabled = stepIdx === 0;
      const nextBtn = button(stepIdx < mcSteps.length - 1 ? '✓ 완료 & 다음 단계 →' : '🎉 예식 진행 완료', () => {
        completed.add(stepIdx);
        if (stepIdx < mcSteps.length - 1) { stepIdx++; draw(); }
        else { stopTimer(); ctx.toast('12단계 예식 큐시트를 모두 완료했습니다! 🎉'); draw(); }
      }, 'button');

      body.replaceChildren(
        E('div', { class: 'live-cue-topbar' },
          E('span', { class: 'spec-chip direct' }, `진행 ${stepIdx + 1} / ${mcSteps.length} (완료 ${completed.size})`),
          E('div', { class: 'live-cue-timer-box' }, E('span', { class: 'small muted' }, '경과'), clockVal, toggleTimerBtn, resetTimerBtn)),
        E('div', { class: 'live-cue-utility-bar' },
          wakeBtn,
          E('div', { class: 'live-cue-font-group', role: 'group', 'aria-label': '대본 글자 크기 조절' },
            fontDownBtn,
            E('span', { class: 'small muted live-cue-font-pct' }, `${fontScale}%`),
            fontUpBtn),
          E('span', { class: 'spec-chip highlight live-cue-stage-badge' }, stagingCueBadge(title, cue))),
        dots,
        E('article', { class: 'live-cue-stage', style: `font-size:${fontScale}%` },
          E('span', { class: 'badge' }, `STEP ${no}`),
          E('h3', { class: 'live-cue-title' }, title),
          E('p', { class: 'live-cue-check' }, `📌 현장 체크: ${cue}`),
          E('div', { class: 'live-cue-scripts' }, scripts.map(line => E('p', { class: 'live-cue-line' }, line)))),
        nextStep
          ? E('div', { class: 'live-cue-next' },
            E('span', { class: 'small muted' }, '다음 순서 미리보기'),
            E('strong', { class: 'small' }, `${nextStep[0]}. ${nextStep[1]} — ${nextStep[2]}`))
          : E('div', { class: 'live-cue-next' }, E('strong', { class: 'small' }, '🎊 마지막 순서입니다. 행진 후 원판 사진 촬영으로 안내해 주세요.')),
        E('div', { class: 'page-actions live-cue-nav' }, prevBtn, nextBtn));
    };

    let cleaned = false;
    const cleanupAll = () => {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      stopTimer();
      releaseWakeLock();
    };
    const onKey = event => {
      if (!body.isConnected) {
        cleanupAll();
        return;
      }
      if (event.key === 'ArrowRight' && stepIdx < mcSteps.length - 1) { event.preventDefault(); stepIdx++; draw(); }
      else if (event.key === 'ArrowLeft' && stepIdx > 0) { event.preventDefault(); stepIdx--; draw(); }
    };
    draw();
    if (ctx.showDialog('🎙️ 본식 사회자 라이브 큐시트', body)) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVisibility);
      document.getElementById('editor-dialog')?.addEventListener('close', cleanupAll, { once: true });
    } else {
      cleanupAll();
    }
  };

  const declSpeakerLabel = isNoOfficiant
    ? (cPlan.speech ? `${cPlan.speech} 진행` : '사회자용')
    : '주례·사회자용';

  const rundownPanel = E('section', { class: 'ceremony-planner', 'aria-label': '순천아모르 본식 타임테이블 및 낭독 보드' },
    E('div', { class: 'ceremony-top-bar' },
      E('div', { class: 'ceremony-summary-chips' },
        E('span', { class: 'spec-chip highlight' }, `🔔 예식 형태: ${isNoOfficiant ? '주례 없는 예식 (아모르 12단계)' : '일반 예식 (주례사 중심)'}`),
        E('span', { class: 'spec-chip direct' }, `🎤 사회자: ${cPlan.mc}`),
        E('span', { class: 'spec-chip direct' }, `📜 성혼선언·축사: ${cPlan.speech} 진행`),
        E('span', { class: 'spec-chip direct' }, `🎵 축가: ${cPlan.song}`),
        E('span', { class: 'spec-chip' + (cPlan.banquetFloor ? ' direct' : ' highlight') }, `🍽️ 연회홀: ${cPlan.banquetFloor || '층수 확인 필요'}`),
        E('span', { class: 'spec-chip direct' }, `✅ 식순 준비 체크: ${prepDone}/${CEREMONY_PREP_ITEMS.length}`)),
      E('div', { class: 'page-actions ceremony-action-bar' },
        button('🎙️ 라이브 큐시트 모드', openLiveCueSheetModal, 'button'),
        button('📋 타임테이블·식순 복사', () => copyCeremonyPlanText(ctx, timeline, orderSteps, cPlan, inv, baseTime, isNoOfficiant), 'button quiet'),
        button('🎤 사회자 대본 복사', () => copyAmorMcScript(ctx, inv, cPlan), 'button quiet'),
        button('🖨️ 서약서·선언문 인쇄', printCeremonyPapersOnly, 'button quiet'),
        button('🖨️ 전체 인쇄 / PDF', () => window.print(), 'button quiet'))),
    E('div', { class: 'amor-cue-grid', 'aria-label': '순천아모르웨딩컨벤션 현장 진행 핵심 포인트' },
      E('div', { class: 'amor-cue-card' },
        E('span', { class: 'amor-cue-tag' }, '🪑 홀 하객석 방향'),
        E('strong', {}, '사회자 단상 쪽 = 신랑 측'),
        E('p', { class: 'small muted' }, '단상 반대쪽이 신부 측 좌석입니다. 개식 예고 멘트와 접수대 안내 시 함께 확인하세요.')),
      E('div', { class: 'amor-cue-card' },
        E('span', { class: 'amor-cue-tag' }, '🚶 신랑·신부 입장 큐'),
        E('strong', {}, '신랑 버진로드 대기 · 신부 2단계'),
        E('p', { class: 'small muted' }, '신부는 ① 신부문 전 ‘신부 등장’ 박수 유도 후 ② 문 앞 아버님 손 잡고 ‘신부 입장’으로 진행됩니다.')),
      E('div', { class: 'amor-cue-card' },
        E('span', { class: 'amor-cue-tag' }, '🙇 혼주 인사 → 축가 순서'),
        E('strong', {}, `신부측 → 신랑측 → 중앙 내빈 → 축가(${cPlan.song})`),
        E('p', { class: 'small muted' }, '양가 부모님 포옹·내빈 인사 후 축가가 진행되며, 드레스 정리 완료 확인 뒤 행진합니다.')),
      E('div', { class: 'amor-cue-card' },
        E('span', { class: 'amor-cue-tag' }, '🍽️ 폐회식 연회홀 안내'),
        E('strong', {}, cPlan.banquetFloor ? `${cPlan.banquetFloor} 연회홀 반영됨` : '연회홀 층수 사전 확인'),
        E('p', { class: 'small muted' }, '폐회식 직후 가족·친지·친구 원판 촬영 안내와 함께 연회홀 층수를 멘트로 안내합니다.'))),
    E('div', { class: 'ceremony-grid' },
      E('article', { class: 'ceremony-box' },
        E('h3', {}, `⏰ ${baseTime} 본식 기준 당일 타임테이블`),
        E('ol', { class: 'timetable-list' }, timeline.map(([t, title, desc]) => E('li', { class: 'timetable-row' + (t === baseTime ? ' highlight' : '') },
          E('strong', { class: 'timetable-time' }, t),
          E('div', { class: 'timetable-detail' },
            E('strong', {}, title),
            E('p', { class: 'small muted' }, desc)))))),
      E('article', { class: 'ceremony-box' },
        E('h3', {}, `📋 ${isNoOfficiant ? '순천아모르 주례 없는 예식 12단계 식순' : '일반 예식 식순 가이드'}`),
        E('ol', { class: 'ceremony-order-list' }, orderSteps.map(step => E('li', {}, step))),
        cPlan.note ? E('div', { class: 'ceremony-note-box' },
          E('strong', { class: 'small' }, '🎼 식순·BGM·진행 메모'),
          E('p', { class: 'small record-body' }, cPlan.note)) :
          E('p', { class: 'small muted' }, '‘식순·사회·낭독문 편집’ 버튼에서 사회자·축가·성혼선언·축사 세부 성함, 연회홀 층수, BGM과 서약서 문구를 다듬을 수 있어요.'))),
    E('div', { class: 'ceremony-docs-stack' },
      E('details', { class: 'disclosure ceremony-doc-details' },
        E('summary', {}, `🎤 [사회자 진행 대본] ${isNoOfficiant ? '주례 없는 결혼식순 12단계 멘트 & 동선 큐시트' : '일반 예식(주례사 중심) 사회자 멘트 & 아모르 동선 큐시트'} (${inv.partner1 || '신랑'} · ${inv.partner2 || '신부'} 자동 반영)`),
        E('div', { class: 'ceremony-doc-body' },
          E('div', { class: 'ceremony-doc-toolbar' },
            E('span', { class: 'small muted' }, `사회자(${cPlan.mc})에게 전달하기 전 세부 성함·${cPlan.speech}·축가(${cPlan.song})·연회홀 층수를 확인해 주세요. 복사 시 8번 순서에 성혼선언문이 함께 포함됩니다.`),
            E('div', { class: 'lachma-official-links' },
              button('📋 사회자 전체 대본 복사', () => copyAmorMcScript(ctx, inv, cPlan), 'button quiet small-copy-btn'),
              button('✏️ 사회자·연회홀 입력', () => openCeremonyEditor(ctx), 'button quiet small-copy-btn'))),
          E('ol', { class: 'mc-script-list' }, mcSteps.map(([no, title, cue, scripts]) => E('li', { class: 'mc-step-card' },
            E('div', { class: 'mc-step-head' },
              E('span', { class: 'lachma-step-badge' }, `STEP ${no}`),
              E('strong', { class: 'mc-step-title' }, title),
              E('span', { class: 'mc-step-cue small' }, cue)),
            E('div', { class: 'mc-step-lines' }, scripts.map(line => E('p', { class: 'mc-script-line' }, line)))))))),
      E('div', { class: 'ceremony-papers-grid' },
        E('article', { class: 'ceremony-paper-card' },
          E('div', { class: 'ceremony-paper-head' },
            E('div', {},
              E('span', { class: 'lachma-step-badge' }, cPlan.vows ? '직접 다듬은 문안' : '신랑·신부 함께 낭독 · 기본 예문'),
              E('h3', {}, cPlan.vows ? '💍 혼인서약서 (신랑·신부 함께 낭독)' : '💍 혼인서약서 (수정 예정)')),
            E('div', { class: 'lachma-official-links' },
              button('📋 복사', () => ctx.copyTextToClipboard(vowsText, '혼인서약서 문안을 복사했습니다.'), 'button quiet small-copy-btn'),
              button('✏️ 문구 수정', () => openCeremonyEditor(ctx, 'vows'), 'button quiet small-copy-btn'))),
          E('pre', { class: 'ceremony-paper-text' }, vowsText)),
        E('article', { class: 'ceremony-paper-card' },
          E('div', { class: 'ceremony-paper-head' },
            E('div', {},
              E('span', { class: 'lachma-step-badge' }, cPlan.declaration ? '직접 다듬은 문안' : `${declSpeakerLabel} · 기본 예문`),
              E('h3', {}, cPlan.declaration ? `📜 성혼선언문 (${declSpeakerLabel})` : '📜 성혼선언문 (수정 예정)')),
            E('div', { class: 'lachma-official-links' },
              button('📋 복사', () => ctx.copyTextToClipboard(declText, '성혼선언문 문안을 복사했습니다.'), 'button quiet small-copy-btn'),
              button('✏️ 문구 수정', () => openCeremonyEditor(ctx, 'declaration'), 'button quiet small-copy-btn'))),
          E('pre', { class: 'ceremony-paper-text' }, declText)))),
    E('div', { class: 'ceremony-prep-box' },
      E('div', { class: 'lachma-prep-head' },
        E('strong', {}, `✅ 본식 식순 · 낭독문 사전 준비 체크 (${prepDone}/${CEREMONY_PREP_ITEMS.length} 완료)`),
        prepDone > 0 ? button('체크 초기화', async () => {
          if (!await ctx.confirmAction({ title: '식순 준비 체크 초기화', message: '본식 식순 사전 준비 체크 표시를 초기화할까요?', confirmLabel: '초기화', danger: true })) return;
          ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), ceremonyChecks: [] }).then(ok => { if (ok) { ctx.render(); ctx.toast('본식 식순 체크를 초기화했습니다.'); } return ok; }));
        }, 'checklist-note-btn') : null),
      E('ul', { class: 'ceremony-prep-list' }, CEREMONY_PREP_ITEMS.map(([cid, label]) => {
        const done = checkedSet.has(cid);
        const box = E('input', { type: 'checkbox' });
        box.checked = done;
        box.addEventListener('change', () => togglePrepCheck(cid, box.checked));
        return E('li', { class: 'lachma-prep-check-item' + (done ? ' done' : '') },
          E('label', {}, box, E('span', { class: 'small' }, label)));
      }))),
    E('p', { class: 'small muted ceremony-hall-disclaimer' }, '🔒 순천아모르웨딩컨벤션 예식 진행 구성을 바탕으로 두 사람의 본식 리허설·낭독 준비를 위해 정리한 개인 전용 보드입니다. 하객 화면(?view=guest)에는 표시되지 않으며, 본인 예식 준비 및 담당 사회자 공유 외 무단 유포·제공을 금합니다.'));

  const activePanel = ceremonySubTab === 'guests'
    ? renderGuestListBoard(ctx)
    : ceremonySubTab === 'gifts'
      ? renderGiftLedgerBoard(ctx)
      : ceremonySubTab === 'dayops'
        ? renderWeddingDayOpsBoard(ctx)
        : rundownPanel;

  return [
    ctx.pageHeader(
      '순천아모르 본식 식순 & 하객·축의금·당일 운영',
      `${inv.date ? formatDate(inv.date) : '예식일'} ${baseTime} (${inv.venue || '순천아모르웨딩컨벤션'}) 기준 식순·사회자 대본, 하객 명단·축의금 장부와 본식 당일 역할·현금 봉투·원판 순서를 탭으로 나누어 관리해요.`,
      E('div', { class: 'page-actions' },
        ceremonySubTab === 'rundown' ? ctx.editButton('식순·사회·낭독문 편집', () => openCeremonyEditor(ctx)) : null,
        button('⚡ 본식 당일 현장 모드', () => ctx.openWeddingDayHub?.(), 'button quiet')),
      'AMOR WEDDING HALL · CEREMONY & DAY OPERATIONS'
    ),
    subTabBar,
    activePanel
  ];
}
