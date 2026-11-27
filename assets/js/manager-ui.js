import { $, E, button, linkButton, downloadJson } from './dom.js?v=wedding-features-72';
import { parseContent, validateContent, MAX_IMPORT_BYTES, summarizeContentDiff } from './content.js?v=wedding-features-72';
import { validatePreferences, parsePreferencesBackup, mergePreferences, summarizePreferencesMerge } from './preferences.js?v=wedding-features-72';
import { StorageConflict, mergeChanges } from './storage.js?v=wedding-features-72';
import { activeVendorSchedules } from './planning.js?v=wedding-features-72';

function describeValue(value, path = '') {
  if (value === undefined) return '삭제됨';
  if (value === null) return '미입력';
  if (value && typeof value === 'object' && !Array.isArray(value) && /^(venueSim|sdmSim|budgetPlan|ceremonyPlan)(\.|$)/.test(path)) {
    return Object.entries(value).map(([key, entry]) => `${conflictLabel({}, key)}: ${describeValue(entry, `${path}.${key}`)}`).join('\n');
  }
  if (typeof value === 'number' && /\.(mealPrice|hallFee|deposit|packageFee|helperFee|extraFee|planned|actual)$/.test(path)) return `${value.toLocaleString('ko-KR')}원`;
  if (typeof value === 'number' && /\.(guestCount|minGuarantee)$/.test(path)) return `${value.toLocaleString('ko-KR')}명`;
  if (typeof value === 'boolean') return value ? '적용 · 완료' : '미적용 · 미완료';
  if (path === 'ceremonyPlan.style') return value === 'officiant' ? '일반 예식 (주례사 중심)' : '주례 없는 예식';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.includes('data:image/') ? '사진이 포함된 내용' : text.slice(0, 300) || '비어 있음';
}

function conflictLabel(ctx, path) {
  const labels = {
    invitation: '예식 정보', partner1: '첫 번째 이름', partner2: '두 번째 이름', groomParents: '신랑 측 혼주', brideParents: '신부 측 혼주',
    venue: '예식장', date: '날짜', time: '시간', address: '주소', message: '초대 인사', mapUrl: '지도 링크', venueMapImage: '예식장 약도 이미지',
    transit: '교통·주차 안내', notice: '예식 안내 메모', contacts: '연락처 안내', groomAccounts: '신랑 측 계좌', brideAccounts: '신부 측 계좌', rsvpUrl: 'RSVP 설문 링크',
    notes: '스튜디오 메모', tripNotes: '여행지 개인 메모', tipNotes: '꿀팁 영상 개인 메모', favorites: '관심 스튜디오', studioSelected: '최종 선택 스튜디오',
    tripFavorites: '관심 여행지', tipFavorites: '관심 꿀팁', checklist: '결혼 준비 체크리스트', shootChecklist: '촬영 준비 체크리스트',
    shootBrief: '라크마 촬영 시안·착장 보드', ceremonyBgm: '본식 BGM 큐시트', tripQuotes: '신혼여행 개인 실견적',
    ceremonyChecks: '본식 식순 체크리스트', prenatalChecks: '산전검사 진행 체크리스트', prenatalNote: '산전검사 개인 메모', prenatalSchedule: '산전검사 일정·지원금 기한',
    marriageRegDate: '혼인신고(예정)일', benefitChecks: '신혼부부 혜택 체크리스트', benefitNote: '혼인신고·혜택 메모', homeItems: '신혼집·혼수 품목 목록',
    weddingDayRoles: '본식 당일 역할 분담', weddingDayEnvelopes: '본식 현금 봉투 리스트', photoOrderNote: '본식 원판 촬영 순서표', checklistNotes: '체크리스트 메모',
    customChecklist: '직접 추가한 할 일', customPackingList: '직접 추가한 준비물', vendorSchedules: '주요 업체 일정', ceremonyPlan: '본식 식순 플래너',
    guestList: '하객 명단', giftLedger: '축의금 장부', venueSim: '웨딩홀 비용 시뮬레이터', sdmSim: '스드메 비용 시뮬레이터', packingList: '신혼여행 준비물',
    budgetPlan: '통합 예산 계산기', tripCompare: '여행 비교', tripSelected: '최종 여행지', stories: '이야기', albums: '앨범', honeymoon: '신혼여행',
    tips: '결혼 정보', category: '분류', channel: '채널·출처', title: '제목', body: '내용', images: '사진', left: '비교 A', right: '비교 B',
    plan: '여행 상세', experiences: '경험 제안', climate: '기후 안내', climateMonth: '기후 기준 월', sourceTitle: '기후 출처', sourceUrl: '기후 출처 링크',
    checkedOn: '확인일', comparisonNote: '비교 요약', budgetNotes: '비용 참고 설명', researchNotes: '계획 자료 설명', references: '추가 조사 출처',
    lodgingNotes: '숙박 구성 메모', itinerary: '일정 흐름', transport: '계획상 이동', stays: '숙박 구성', costs: '비용 배분', quote: '실제 견적'
  };
  const planningLabels = {
    planned: '목표 예산', actual: '실제 지출·계약 견적', mealPrice: '1인 식대', guestCount: '예상 하객 수', minGuarantee: '최소 보증인원',
    hallFee: '대관료·연출료', deposit: '기납부 계약금', packageFee: '스드메 패키지 기본가', helperFee: '당일 헬퍼비', extraFee: '기타 추가금',
    roadScene: '로드씬 옵션', nightShoot: '야간씬 옵션', name: '일정 이름', done: '완료 여부', note: '메모', style: '예식 진행 형태',
    mc: '사회자', song: '축가', speech: '축사·덕담·주례', banquetFloor: '연회홀 층수', vows: '혼인서약서 문안', declaration: '성혼선언문 문안',
    sdm: '스튜디오·드레스·메이크업', snap: '본식 촬영·진행', rings: '예물·예복·한복·예단', living: '혼수·가전·가구',
    appliedDate: '지원 신청일', visitDate: '병원 예약일', examDate: '검사 완료일', claimed: '지원금 청구 완료',
    moodNote: '촬영 분위기·필수 컷', avoidNote: '피하고 싶은 각도·요청', outfits: '착장별 시안', milestones: '촬영 후속 일정',
    cue: '재생 큐 메모', ready: '음원 준비 완료', total: '총 실견적', airfare: '항공 실견적', lodging: '숙박·패키지 실견적',
    agency: '상담처·여행사', perks: '포함 특전·조건', cancelUntil: '무료 취소 마감일'
  };
  const studios = ctx.getStudiosList?.() || [];
  const content = ctx.getContent?.();
  return path.split('.').filter(key => key !== 'records').map(key =>
    labels[key] || planningLabels[key] ||
    studios.find(item => item.id === key)?.name ||
    content?.honeymoon?.find(item => item.id === key)?.title ||
    content?.tips?.find(item => item.id === key)?.title ||
    activeVendorSchedules().find(item => item.id === key)?.name ||
    '기록'
  ).join(' · ');
}

function conflictDetails(ctx, error) {
  return E('div', { class: 'conflict-list' }, error.conflicts.length
    ? error.conflicts.map(item => E('section', {},
      E('p', { class: 'small' }, conflictLabel(ctx, item.path)),
      E('p', {}, '현재 입력: ', describeValue(item.local, item.path)),
      E('p', {}, '다른 탭의 저장본: ', describeValue(item.remote, item.path))))
    : E('p', {}, '서로 다른 항목의 변경은 함께 보존됩니다.'));
}

export function beginConflictReview(ctx, { key, base, next, saveLocal, keepSaved, lockEditor = false }) {
  const editor = $('#editor-body');
  const prevReview = ctx.getConflictReview();
  prevReview?.release?.();
  const release = () => { editor.inert = false; $('#dialog-actions').inert = false; };
  if (lockEditor) { editor.inert = true; $('#dialog-actions').inert = true; }
  const review = { key, refresh: null, release, busy: false };
  const decide = async action => {
    if (review.busy) return;
    review.busy = true; review.message = null; refresh();
    try { await action(); } catch (error) { ctx.toast(ctx.storageMessage(error), true); }
    finally { review.busy = false; if (ctx.getConflictReview() === review) refresh(); }
  };
  const refresh = () => {
    try {
      const raw = localStorage.getItem(key);
      const remote = key === ctx.DRAFT_KEY
        ? (raw ? parseContent(raw) : ctx.getBaseContent())
        : validatePreferences(JSON.parse(raw || '{}'));
      const result = mergeChanges(base, next, remote), error = new StorageConflict(result.conflicts, raw);
      const notice = $('#dialog-notice');
      const focusedAction = notice.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement.textContent : null;
      notice.hidden = false; notice.className = 'dialog-notice error'; notice.setAttribute('role', 'alert');
      notice.replaceChildren(
        E('p', {}, result.conflicts.length ? error.message : '최신 저장본을 확인했습니다. 현재 입력과 겹치지 않는 변경은 함께 저장합니다.'),
        conflictDetails(ctx, error),
        E('div', { class: 'manager-actions' },
          button(key === ctx.DRAFT_KEY ? '다른 탭의 저장본 불러오기' : '다른 탭의 저장본 유지', () => decide(keepSaved), 'button quiet'),
          button('현재 입력으로 충돌 항목 저장', () => decide(() => saveLocal(raw))),
          lockEditor ? button('입력 계속 수정', () => {
            release();
            ctx.setConflictReview(null);
            notice.hidden = true;
            editor.querySelector('input,textarea,select')?.focus();
          }, 'button quiet') : null),
        E('p', { id: 'conflict-status', class: 'small', role: 'status' },
          review.busy
            ? '선택한 내용을 처리하고 있습니다.'
            : lockEditor
              ? '저장할 내용을 선택하거나 입력을 계속 수정해 주세요. 다른 탭의 새 변경도 다시 확인합니다.'
              : '다른 탭이 다시 저장해도 비교 내용과 선택 버튼은 유지됩니다.'));
      for (const action of notice.querySelectorAll('button')) action.disabled = review.busy;
      if (review.message) {
        const status = $('#conflict-status');
        status.textContent = review.message.text;
        status.setAttribute('role', review.message.error ? 'alert' : 'status');
      }
      if (focusedAction) [...notice.querySelectorAll('button')].find(node => node.textContent === focusedAction)?.focus({ preventScroll: true });
    } catch (error) { ctx.toast('최신 저장본을 확인하지 못했습니다. ' + ctx.storageMessage(error), true); }
  };
  review.refresh = refresh;
  ctx.setConflictReview(review);
  refresh();
  $('#dialog-notice').focus();
}

export async function readBackupSnapshot(ctx, key) {
  const pendingAtStart = ctx.hasPendingWrites();
  if (pendingAtStart) ctx.toast('변경 내용을 저장한 뒤 최신 저장본으로 백업합니다.');
  await ctx.finishPendingWrites();
  if (!pendingAtStart && ctx.didLastWriteFail()) {
    const ok = await ctx.confirmAction({
      title: '마지막 저장본으로 백업',
      message: '최근 변경의 저장에 실패했습니다. 마지막으로 저장된 내용만 백업할까요?',
      confirmLabel: '백업 진행'
    });
    if (!ok) return null;
  }
  const value = await navigator.locks.request(`wedding-storage:${key}`, () => {
    const raw = localStorage.getItem(key);
    return key === ctx.PREF_KEY
      ? validatePreferences(JSON.parse(raw || '{}'))
      : raw ? parseContent(raw) : validateContent(ctx.getBaseContent());
  });
  if (key === ctx.PREF_KEY) {
    ctx.syncMemoryPrefs(value);
    return { payload: { kind: 'wedding-private-preferences', schemaVersion: 1, preferences: value }, filename: 'wedding-private-preferences.json' };
  }
  return { payload: value, filename: 'site.json' };
}

export async function downloadSaved(ctx, key) {
  try {
    const snap = await readBackupSnapshot(ctx, key);
    if (!snap) return;
    downloadJson(snap.payload, snap.filename);
    if (key === ctx.PREF_KEY) {
      ctx.writeBackupMeta({ lastPrivateBackupAt: Date.now(), snoozeUntil: 0 });
      if (ctx.currentRoute() === 'home' && !ctx.isDialogOpen()) ctx.render();
      ctx.toast('개인 백업 파일(wedding-private-preferences.json)을 저장했습니다.');
    } else {
      ctx.writeBackupMeta({ lastDraftBackupAt: Date.now() });
    }
  } catch (error) { ctx.toast(error.message || '백업을 저장하지 못했습니다.', true); }
}

export async function sharePrivateBackup(ctx) {
  try {
    const snap = await readBackupSnapshot(ctx, ctx.PREF_KEY);
    if (!snap) return;
    const jsonText = JSON.stringify(snap.payload) + '\n';
    if (ctx.canShareBackupFiles()) {
      const file = new File([jsonText], snap.filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '우리의 결혼 기록 개인 백업',
          text: '내용 관리 → 개인 백업 불러오기(기존 기록에 합치기)로 두 사람의 기록을 합칠 수 있습니다.'
        });
        ctx.writeBackupMeta({ lastPrivateBackupAt: Date.now(), snoozeUntil: 0 });
        if (ctx.currentRoute() === 'home' && !ctx.isDialogOpen()) ctx.render();
        ctx.toast('개인 백업 파일을 공유했습니다.');
        return;
      }
    }
    downloadJson(snap.payload, snap.filename);
    ctx.writeBackupMeta({ lastPrivateBackupAt: Date.now(), snoozeUntil: 0 });
    if (ctx.currentRoute() === 'home' && !ctx.isDialogOpen()) ctx.render();
    ctx.toast('이 브라우저에서는 파일 직접 공유를 지원하지 않아 백업 파일을 저장했습니다. 카카오톡·파일 앱으로 전달해 주세요.');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    ctx.toast(error.message || '백업을 공유하지 못했습니다.', true);
  }
}

const KNOWN_UI_STORAGE_KEYS = new Set([
  'wedding:v1:largeText',
  'wedding:v1:theme',
  'wedding:v1:petals',
  'wedding:v1:backupMeta',
  'wedding:v1:photoCallChecked'
]);

export function analyzeStorageHealth(storage, {
  draftKey = 'wedding:v1:draft',
  prefKey = 'wedding:v1:preferences',
  rollbackKey = 'wedding:v1:prefRollback',
  maxQuota = 5 * 1024 * 1024
} = {}) {
  const byteLen = str => (typeof str === 'string' && str ? new TextEncoder().encode(str).length : 0);
  const safeGet = key => {
    try { return storage?.getItem?.(key) ?? null; } catch { return null; }
  };
  const draftRaw = safeGet(draftKey);
  const prefRaw = safeGet(prefKey);
  const rollbackRaw = safeGet(rollbackKey);
  const draftBytes = byteLen(draftRaw);
  const prefBytes = byteLen(prefRaw);
  const rollbackBytes = byteLen(rollbackRaw);
  const inlineImageCount = typeof draftRaw === 'string' ? (draftRaw.match(/data:image\//g) || []).length : 0;

  const coreSet = new Set([draftKey, prefKey, rollbackKey]);
  const otherKeys = [];
  const staleKeys = [];
  let otherBytes = 0;
  try {
    const len = typeof storage?.length === 'number' ? storage.length : 0;
    for (let i = 0; i < len; i++) {
      const k = storage.key?.(i);
      if (!k || coreSet.has(k) || !k.startsWith('wedding:')) continue;
      const bytes = byteLen(safeGet(k));
      otherBytes += bytes;
      otherKeys.push({ key: k, bytes });
      if (!KNOWN_UI_STORAGE_KEYS.has(k)) staleKeys.push(k);
    }
  } catch {}

  const totalBytes = draftBytes + prefBytes + rollbackBytes + otherBytes;
  const pct = maxQuota > 0
    ? Math.min(100, Math.max(totalBytes > 0 ? 1 : 0, Math.round((totalBytes / maxQuota) * 100)))
    : 0;
  const level = pct >= 80 ? 'critical' : pct >= 55 ? 'warn' : 'ok';
  return {
    draftBytes,
    prefBytes,
    rollbackBytes,
    otherBytes,
    totalBytes,
    maxQuota,
    pct,
    level,
    inlineImageCount,
    otherKeys,
    staleKeys
  };
}

export function evaluatePublishPreflight(content = {}) {
  const inv = content?.invitation || {};
  const albums = Array.isArray(content?.albums) ? content.albums : [];
  const stories = Array.isArray(content?.stories) ? content.stories : [];
  const photoCount = albums.reduce((sum, a) => sum + ((a?.images || []).length), 0);
  const checks = [
    ['신랑·신부 이름', Boolean(inv.partner1?.trim() && inv.partner2?.trim())],
    ['예식 일시·장소', Boolean(inv.date && inv.time && inv.venue?.trim())],
    ['초대 인사말', Boolean(inv.message?.trim())],
    ['양가 혼주 성함', Boolean(inv.groomParents?.trim() || inv.brideParents?.trim())],
    ['교통·주차·예식 안내', Boolean(inv.transit?.trim() || inv.notice?.trim())],
    ['연락처·축의 계좌', Boolean(inv.contacts?.trim() || inv.groomAccounts?.trim() || inv.brideAccounts?.trim())],
    ['RSVP 참석 설문', Boolean(inv.rsvpUrl?.trim())],
    ['웨딩 포토 앨범', photoCount > 0]
  ];
  const readinessCount = checks.filter(([, ok]) => ok).length;
  const missingLabels = checks.filter(([, ok]) => !ok).map(([label]) => label);
  return {
    readinessCount,
    readinessTotal: checks.length,
    missingLabels,
    storyCount: stories.length,
    albumCount: albums.length,
    photoCount,
    hasCover: Boolean(albums[0]?.images?.[0]),
    isReadyForGuests: readinessCount >= 6
  };
}

export function openManager(ctx) {
  if (ctx.isGuestMode()) return;
  ctx.closeMobileMenu(false);
  const content = ctx.getContent();
  const baseContent = ctx.getBaseContent();
  const isDraft = ctx.getIsDraft();
  const draftRevision = ctx.getDraftRevision();
  const baseRevision = ctx.getBaseRevision();
  const ROLLBACK_KEY = 'wedding:v1:prefRollback';
  const managerBase = structuredClone(content);
  const managerRaw = ctx.readStorage(ctx.DRAFT_KEY);
  const health = analyzeStorageHealth(typeof localStorage !== 'undefined' ? localStorage : null, {
    draftKey: ctx.DRAFT_KEY,
    prefKey: ctx.PREF_KEY,
    rollbackKey: ROLLBACK_KEY
  });
  const { draftBytes, prefBytes, rollbackBytes, otherBytes, totalBytes, pct } = health;
  const fmtSize = b => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);

  const readRollback = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROLLBACK_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object' || !parsed.preferences) return null;
      return { savedAt: parsed.savedAt || 0, reason: String(parsed.reason || '직전 상태'), preferences: validatePreferences(parsed.preferences) };
    } catch { return null; }
  };
  const saveRollback = (reason, snapshotPrefs) => {
    try {
      localStorage.setItem(ROLLBACK_KEY, JSON.stringify({ savedAt: Date.now(), reason, preferences: validatePreferences(snapshotPrefs) }));
    } catch {}
  };

  const mergeRadio = E('input', { type: 'radio', name: 'pref-import-mode', id: 'pref-import-merge', value: 'merge' });
  mergeRadio.checked = true;
  const replaceRadio = E('input', { type: 'radio', name: 'pref-import-mode', id: 'pref-import-replace', value: 'replace' });
  const personal = E('input', { type: 'file', accept: '.json,application/json', class: 'file-input', 'aria-label': '개인 메모·선택 백업 선택' });
  const prefPreviewSlot = E('div', { class: 'pref-merge-preview-slot', 'aria-live': 'polite' });
  let pendingPrefBackup = null;

  const renderPrefImportPreview = () => {
    if (!pendingPrefBackup) {
      prefPreviewSlot.replaceChildren();
      return;
    }
    const { incoming, filename } = pendingPrefBackup;
    const isMerge = mergeRadio.checked;
    const currentPrefs = ctx.readRawPrefs();
    const merged = isMerge ? mergePreferences(currentPrefs, incoming) : incoming;
    const diff = isMerge ? summarizePreferencesMerge(currentPrefs, merged) : null;
    const chips = isMerge
      ? [
        diff.guestsAdded ? `하객 +${diff.guestsAdded}건` : '',
        diff.giftsAdded ? `축의금 +${diff.giftsAdded}건` : '',
        diff.schedulesAdded ? `업체 일정 +${diff.schedulesAdded}건` : '',
        diff.homeItemsAdded ? `혼수 품목 +${diff.homeItemsAdded}건` : '',
        diff.dayOpsAdded ? `당일 역할·봉투 +${diff.dayOpsAdded}건` : '',
        diff.checksAdded ? `체크 +${diff.checksAdded}건` : '',
        diff.customItemsAdded ? `직접 항목 +${diff.customItemsAdded}건` : '',
        diff.favoritesAdded ? `관심 +${diff.favoritesAdded}건` : '',
        diff.notesUpdated ? `메모 ${diff.notesUpdated}건 반영` : ''
      ].filter(Boolean)
      : [
        `하객 ${(incoming.guestList || []).length}건`,
        `축의금 ${(incoming.giftLedger || []).length}건`,
        `혼수 ${(incoming.homeItems || []).length}건`,
        `당일 역할·봉투 ${(incoming.weddingDayRoles || []).length + (incoming.weddingDayEnvelopes || []).length}건`,
        `체크 ${(incoming.checklist || []).length + (incoming.shootChecklist || []).length + (incoming.ceremonyChecks || []).length + (incoming.prenatalChecks || []).length}건`
      ];

    prefPreviewSlot.replaceChildren(
      E('div', { class: 'pref-merge-preview-card' },
        E('div', { class: 'pref-merge-preview-head' },
          E('strong', {}, isMerge ? `🔀 병합 미리보기 · ${filename}` : `⚠️ 전체 덮어쓰기 미리보기 · ${filename}`),
          E('span', { class: 'badge' }, isMerge ? '기존 기록 유지 + 병합' : '전체 교체')),
        E('div', { class: 'draft-diff-chips' },
          chips.length
            ? chips.map(text => E('span', { class: 'draft-diff-chip ' + (isMerge ? 'is-added' : 'is-modified') }, text))
            : [E('span', { class: 'draft-diff-chip is-modified' }, '중복 없는 신규 항목 없음 (빈 설정만 보완)')]),
        E('p', { class: 'small muted' }, '적용 직전 현재 이 기기의 개인 설정을 자동 롤백 스냅샷으로 저장하므로, 필요하면 언제든 직전 상태로 되돌릴 수 있습니다.'),
        E('div', { class: 'manager-actions' },
          button(isMerge ? '✅ 이대로 안전하게 합치기' : '⚠️ 백업으로 전체 덮어쓰기', async () => {
            const latestCurrent = ctx.readRawPrefs();
            saveRollback(isMerge ? '백업 병합 직전' : '백업 덮어쓰기 직전', latestCurrent);
            const target = isMerge ? mergePreferences(latestCurrent, incoming) : incoming;
            const baseArg = isMerge ? latestCurrent : validatePreferences({});
            if (await ctx.savePrefs(target, baseArg, ctx.readStorage(ctx.PREF_KEY))) {
              pendingPrefBackup = null;
              ctx.closeDialog(); ctx.render();
              ctx.toast(isMerge
                ? (chips.length ? `개인 백업을 기존 기록과 합쳤습니다. (${chips.join(', ')})` : '개인 백업을 기존 기록과 확인·병합했습니다.')
                : '개인 메모와 설정을 백업 내용으로 복원했습니다. (직전 상태는 롤백 스냅샷에 보관됨)');
            }
          }, isMerge ? 'button' : 'button danger'),
          button('취소', () => { pendingPrefBackup = null; personal.value = ''; renderPrefImportPreview(); }, 'button quiet'))));
  };

  mergeRadio.addEventListener('change', renderPrefImportPreview);
  replaceRadio.addEventListener('change', renderPrefImportPreview);

  personal.addEventListener('change', async () => {
    const selected = personal.files?.[0]; if (!selected) return;
    try {
      if (selected.size > MAX_IMPORT_BYTES) throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
      const incoming = parsePreferencesBackup(await selected.text());
      pendingPrefBackup = { incoming, filename: selected.name || 'wedding-private-preferences.json' };
      renderPrefImportPreview();
    } catch (error) {
      pendingPrefBackup = null;
      renderPrefImportPreview();
      ctx.toast(error.message, true);
    } finally { personal.value = ''; }
  });

  const file = E('input', { type: 'file', accept: '.json,application/json', class: 'file-input', 'aria-label': '콘텐츠 JSON 파일 선택' });
  file.addEventListener('change', async () => {
    const selected = file.files?.[0]; if (!selected) return;
    try {
      if (selected.size > MAX_IMPORT_BYTES) throw new Error('콘텐츠 파일은 8MB 이하로 선택해 주세요.');
      const next = parseContent(await selected.text());
      if (!await ctx.confirmAction({ title: '콘텐츠 파일 불러오기', message: '현재 기기의 초안을 선택한 파일의 내용으로 바꿀까요?', confirmLabel: '불러오기' })) return;
      const applyImport = async approvedRaw => {
        try {
          await ctx.setDraft(next, managerBase, approvedRaw);
          ctx.syncMemoryPrefs(); ctx.closeDialog(); ctx.render();
          ctx.toast('콘텐츠를 이 기기의 초안으로 불러왔습니다.');
        } catch (error) {
          if (error instanceof StorageConflict) {
            beginConflictReview(ctx, {
              key: ctx.DRAFT_KEY, base: managerBase, next,
              saveLocal: applyImport,
              keepSaved: () => {
                try { ctx.syncDraftFromStorage(); ctx.syncMemoryPrefs(); ctx.closeDialog(); ctx.render(); ctx.toast('다른 탭의 저장본을 유지했습니다.'); }
                catch (cause) { ctx.toast(cause.message, true); }
              }
            });
          } else ctx.toast(error.message, true);
        }
      };
      await applyImport();
    } catch (error) { ctx.toast(error.message, true); } finally { file.value = ''; }
  });

  const renderDraftDiffSection = () => {
    if (!isDraft) return null;
    const diff = summarizeContentDiff(baseContent, content);
    if (!diff.hasChanges) {
      return E('section', { class: 'manager-section draft-diff-section' },
        E('h3', {}, '공개본 대비 초안 변경 내역'),
        E('p', { class: 'small muted' }, '현재 기기의 초안은 공개본(data/site.json)과 내용이 동일합니다.'));
    }
    const rows = [];
    if (diff.invitationFields.length) {
      const statusPrefix = { added: '+', modified: '✎', removed: '−' };
      rows.push(E('li', { class: 'draft-diff-item' },
        E('strong', {}, `청첩장 기본 정보 (${diff.invitationFields.length}개 항목)`),
        E('div', { class: 'draft-diff-chips' }, diff.invitationFields.map(f => E('span', { class: `draft-diff-chip is-${f.status}` }, `${statusPrefix[f.status]} ${f.label}`)))));
    }
    const sectionLabels = [['stories', '우리의 일대기'], ['albums', '포토 앨범'], ['honeymoon', '신혼여행'], ['tips', '결혼 정보']];
    for (const [key, label] of sectionLabels) {
      const c = diff.collections[key];
      if (!c || !c.total) continue;
      const chips = [];
      if (c.added) chips.push(E('span', { class: 'draft-diff-chip is-added' }, `+${c.added} 추가`));
      if (c.modified) chips.push(E('span', { class: 'draft-diff-chip is-modified' }, `✎ ${c.modified} 수정`));
      if (c.removed) chips.push(E('span', { class: 'draft-diff-chip is-removed' }, `− ${c.removed} 삭제`));
      if (c.reordered) chips.push(E('span', { class: 'draft-diff-chip is-modified' }, '↕ 순서 변경'));
      const titles = [...c.addedTitles.map(t => `+${t}`), ...c.modifiedTitles.map(t => `✎${t}`), ...c.removedTitles.map(t => `−${t}`)];
      const preview = titles.length ? `${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ` 외 ${titles.length - 3}건` : ''}` : '';
      rows.push(E('li', { class: 'draft-diff-item' },
        E('strong', {}, label),
        E('div', { class: 'draft-diff-chips' }, ...chips),
        preview ? E('p', { class: 'small muted draft-diff-preview' }, preview) : null));
    }
    return E('section', { class: 'manager-section draft-diff-section', 'aria-label': '공개본 대비 초안 변경 내역' },
      E('h3', {}, `공개본 대비 초안 변경 내역 (총 ${diff.totalChanges}건)`),
      E('p', { class: 'small muted' }, '아래 변경 사항을 확인한 뒤 ‘공개용 파일 저장’으로 data/site.json에 반영해 주세요.'),
      E('ul', { class: 'draft-diff-list' }, ...rows));
  };

  const rollbackSnap = readRollback();
  const rollbackSection = rollbackSnap
    ? E('section', { class: 'manager-section rollback-snap-section', 'aria-label': '직전 개인 설정 롤백 스냅샷' },
      E('h3', {}, '↩ 직전 상태 빠른 복구 (자동 롤백 스냅샷)'),
      E('p', { class: 'small muted' }, `${rollbackSnap.reason} 시점(${ctx.formatBackupTime(rollbackSnap.savedAt)} · 약 ${fmtSize(rollbackBytes)})의 개인 설정이 이 기기에 자동 보관되어 있습니다.`),
      E('div', { class: 'manager-actions' },
        button('↩ 직전 상태로 되돌리기', async () => {
          const ok = await ctx.confirmAction({
            title: '직전 상태로 복구',
            message: `${rollbackSnap.reason} 시점의 개인 설정으로 되돌릴까요?`,
            confirmLabel: '복구하기'
          });
          if (!ok) return;
          const currentNow = ctx.readRawPrefs();
          saveRollback('롤백 복구 직전', currentNow);
          if (await ctx.savePrefs(rollbackSnap.preferences, validatePreferences({}), ctx.readStorage(ctx.PREF_KEY))) {
            ctx.closeDialog(); ctx.render();
            ctx.toast('직전 롤백 스냅샷으로 개인 설정을 복구했습니다.');
          }
        }, 'button quiet'),
        button('스냅샷 비우기', async () => {
          const ok = await ctx.confirmAction({
            title: '롤백 스냅샷 비우기',
            message: '자동 보관된 직전 롤백 스냅샷을 삭제해 저장 공간을 확보할까요? 현재 개인 설정은 유지됩니다.',
            confirmLabel: '스냅샷 삭제',
            danger: true
          });
          if (!ok) return;
          try { localStorage.removeItem(ROLLBACK_KEY); } catch {}
          ctx.closeDialog();
          ctx.toast('롤백 스냅샷을 비웠습니다.');
        }, 'button quiet')))
    : null;

  const healthBadgeText = health.level === 'critical'
    ? `🚨 용량 임박 (${pct}%)`
    : health.level === 'warn'
      ? `⚠️ 주의 (${pct}%)`
      : `✅ 여유 (${pct}%)`;
  const canCleanCache = health.staleKeys.length > 0 || rollbackBytes > 0;
  const cleanTempCache = async () => {
    const targets = [];
    if (health.staleKeys.length) targets.push(`구버전 임시 키 ${health.staleKeys.length}건`);
    if (rollbackBytes > 0) targets.push(`자동 롤백 스냅샷(${fmtSize(rollbackBytes)})`);
    const ok = await ctx.confirmAction({
      title: '불필요 임시 캐시 정리',
      message: `${targets.join(' 및 ')}을(를) 삭제해 브라우저 저장 공간을 확보할까요? 현재 편집 초안과 개인 설정·메모는 그대로 유지됩니다.`,
      confirmLabel: '임시 캐시 정리'
    });
    if (!ok) return;
    let removed = 0;
    try {
      for (const k of health.staleKeys) {
        localStorage.removeItem(k);
        removed++;
      }
      if (rollbackBytes > 0) {
        localStorage.removeItem(ROLLBACK_KEY);
        removed++;
      }
    } catch {}
    ctx.closeDialog();
    ctx.toast(`임시 캐시 ${removed}건을 정리했습니다.`);
  };

  ctx.showDialog('내용 관리', E('div', {},
    E('p', { class: 'form-note' }, '공개본은 저장소의 콘텐츠입니다. 여기서 편집한 내용은 이 기기에만 저장되며 자동으로 공개되지 않습니다.'),
    E('section', { class: 'manager-section storage-meter-section', 'data-storage-level': health.level },
      E('div', { class: 'storage-meter-head' },
        E('h3', {}, '브라우저 저장 공간 정밀 진단'),
        E('span', { class: 'spec-chip' + (health.level === 'ok' ? ' direct' : ' highlight') }, healthBadgeText)),
      E('p', { class: 'small muted' }, `현재 사용량 약 ${fmtSize(totalBytes)} / 권장 한도 5.00 MB (${pct}%)`),
      E('div', { class: 'checklist-progress-track storage-meter-track', 'aria-hidden': 'true' },
        E('span', { class: 'checklist-progress-fill' + (health.level !== 'ok' ? ' is-warn' : ''), style: `width:${pct}%` })),
      E('div', { class: 'storage-health-chips', 'aria-label': '저장 공간 항목별 사용량' },
        E('span', { class: 'spec-chip' }, `초안 ${fmtSize(draftBytes)}`),
        E('span', { class: 'spec-chip' }, `개인 설정·메모 ${fmtSize(prefBytes)}`),
        rollbackBytes ? E('span', { class: 'spec-chip' }, `롤백 스냅샷 ${fmtSize(rollbackBytes)}`) : null,
        otherBytes ? E('span', { class: 'spec-chip' }, `기타 화면 설정·캐시 ${fmtSize(otherBytes)}`) : null,
        health.inlineImageCount ? E('span', { class: 'spec-chip highlight' }, `🖼️ 브라우저 직접 사진 ${health.inlineImageCount}장`) : null,
        health.staleKeys.length ? E('span', { class: 'spec-chip highlight' }, `🧹 정리 가능 임시 키 ${health.staleKeys.length}건`) : null),
      canCleanCache ? E('div', { class: 'manager-actions' },
        button('🧹 불필요 임시 캐시 정리', cleanTempCache, 'button quiet small-copy-btn')) : null,
      (pct >= 55 || health.inlineImageCount >= 3) ? E('p', { class: 'form-note warning' },
        pct >= 70
          ? '⚠️ 저장 공간 사용량이 70%를 넘었습니다. 앨범 사진이 많다면 브라우저에 직접 넣는 대신 저장소에서 npm run photos로 웹용 사본을 만들어 연결하면 용량을 크게 줄일 수 있습니다.'
          : '💡 브라우저에 직접 올린 사진은 기기 용량을 빠르게 차지합니다. 사진이 늘어나면 npm run photos로 웹용 사본을 만들어 저장소에 연결하는 방법을 권장합니다.') : null),
    E('section', { class: 'manager-section' },
      E('h3', {}, '개인 메모·선택 백업'),
      E('p', {}, '라크마 스튜디오 메모·촬영 시안/착장/후속일정·준비물 체크, 여행 관심·비교·최종 선택·실견적·상담 메모, 관심 꿀팁·실천 메모, 결혼 준비 체크리스트·할 일 메모·통합 예산 계산기·웨딩홀/스드메 시뮬레이터·혼수 가전 목록·혼인신고 및 신혼부부 혜택 체크·주요 업체 일정 보드·본식 식순/BGM 큐시트·당일 역할/현금 봉투/원판 순서·산전검사 일정/체크/메모·하객 명단·축의금 장부·출국 짐 체크리스트를 개인 파일로 보관합니다. 콘텐츠 초안과 사진은 공개용 파일 저장으로 따로 백업하세요. 개인 백업은 공개 저장소에 올리지 마세요.'),
      E('p', { class: 'small muted' }, `마지막 개인 백업: ${ctx.formatBackupTime(ctx.readBackupMeta().lastPrivateBackupAt)}`),
      E('div', { class: 'manager-actions' },
        button('💑 카톡 3초 동기화 코드', () => ctx.openCoupleSync?.(), 'button'),
        button('개인 백업 저장', () => downloadSaved(ctx, ctx.PREF_KEY), 'button quiet'),
        button('📤 개인 백업 바로 공유(카톡·에어드롭)', () => sharePrivateBackup(ctx), 'button quiet')),
      E('div', { class: 'pref-restore-modes', role: 'radiogroup', 'aria-label': '개인 백업 불러오기 방식' },
        E('label', { class: 'check-label', for: 'pref-import-merge' }, mergeRadio, '기존 기록에 합치기 (병합 · 권장 — 신랑·신부·양가 백업 통합)'),
        E('label', { class: 'check-label', for: 'pref-import-replace' }, replaceRadio, '기존 기록 전체 덮어쓰기')),
      personal,
      prefPreviewSlot),
    rollbackSection,
    E('section', { class: 'manager-section' },
      E('h3', {}, '방문자용 보기'),
      E('p', {}, '방문자용 링크는 공개본만 표시하며 편집 버튼과 이 기기의 개인 메모·결혼 준비 탭을 숨깁니다. 접근 권한을 제한하는 기능은 아닙니다.'),
      linkButton('방문자용 청첩장 열기', '?view=guest#/invitation', true)),
    isDraft && draftRevision !== baseRevision ? E('section', { class: 'manager-section' },
      E('h3', {}, '새 공개본 확인'),
      E('p', {}, '현재 초안을 파일로 백업한 후 새 공개본을 확인하세요. 공개본으로 돌아가면 초안을 지우며 자동으로 합치지 않습니다.'),
      button('현재 초안 백업', () => downloadSaved(ctx, ctx.DRAFT_KEY), 'button quiet'),
      linkButton('새 공개본 미리보기', '?view=guest#/home', true)) : null,
    E('section', { class: 'manager-section' },
      E('h3', {}, '기본 정보'),
      E('p', {}, '이름, 예식 일정과 장소, 청첩장 인사를 채워요.'),
      ctx.editButton('예식 정보 편집', () => ctx.openEditor('invitation'), 'button quiet')),
    renderDraftDiffSection(),
    (() => {
      const pf = evaluatePublishPreflight(content);
      return E('section', { class: 'manager-section' },
        E('h3', {}, '공개할 내용 파일로 저장'),
        E('p', {}, '저장한 site.json 파일은 자동 배포되지 않으며, 저장소의 data/site.json에 반영한 뒤 main 브랜치에 push하면 GitHub Pages에 공개됩니다. 파일에는 청첩장·일대기·앨범·신혼여행·결혼 정보가 담기며, 개인 메모·예산·체크리스트·혼수·신혼혜택·당일 운영표·산전검사 일정·하객 명단·축의금 장부·촬영 시안·BGM·여행 실견적은 포함되지 않습니다.'),
        E('div', { class: 'publish-preflight-box', 'aria-label': '공개 배포 전 사전 점검' },
          E('div', { class: 'storage-health-chips' },
            E('span', { class: 'spec-chip' + (pf.readinessCount >= 6 ? ' direct' : ' highlight') }, `💌 청첩장 완성도 ${pf.readinessCount}/${pf.readinessTotal}`),
            E('span', { class: 'spec-chip' }, `📷 앨범 ${pf.albumCount}개 (사진 ${pf.photoCount}장)`),
            E('span', { class: 'spec-chip' }, `📖 일대기 ${pf.storyCount}편`),
            E('span', { class: 'spec-chip direct' }, '🛡️ 개인 기록 자동 제외 ✓')),
          pf.missingLabels.length
            ? E('p', { class: 'small muted' }, `아직 비어 있는 공개 항목: ${pf.missingLabels.join(' · ')}`)
            : E('p', { class: 'small' }, '✅ 모바일 청첩장 핵심 항목이 모두 채워져 바로 공개 배포할 준비가 되었습니다.')),
        button('공개용 파일 저장', () => downloadSaved(ctx, ctx.DRAFT_KEY)));
    })(),
    E('section', { class: 'manager-section' },
      E('h3', {}, '이전에 저장한 내용 불러오기'),
      E('p', {}, '이 앱에서 저장한 JSON 콘텐츠 파일을 선택해 주세요.'),
      file),
    E('section', { class: 'manager-section' },
      E('h3', {}, '초안을 지우고 공개본 보기'),
      E('p', {}, '이 기기의 콘텐츠 초안만 지웁니다. 라크마 촬영 메모와 여행·예산·체크리스트·혼수·당일 운영표·산전검사 일정·하객 명단·축의금 장부 등 개인 설정은 유지됩니다.'),
      button('공개본으로 돌아가기', async () => {
        if (!await ctx.confirmAction({ title: '공개본으로 돌아가기', message: '이 기기의 콘텐츠 초안을 지울까요? 필요한 내용은 먼저 파일로 저장해 주세요.', confirmLabel: '초안 지우기', danger: true })) return;
        try {
          await navigator.locks.request(`wedding-storage:${ctx.DRAFT_KEY}`, () => {
            if (localStorage.getItem(ctx.DRAFT_KEY) !== managerRaw) throw new Error('다른 탭에서 초안이 변경되었습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 시도해 주세요.');
            localStorage.removeItem(ctx.DRAFT_KEY);
          });
          ctx.resetToBaseContent();
          ctx.closeDialog(); ctx.render(); ctx.toast('공개본으로 돌아왔습니다.');
        } catch (error) { ctx.toast(error.message || '초안을 지우지 못했습니다.', true); }
      }, 'button danger')),
    E('section', { class: 'manager-section' },
      E('h3', {}, '개인 설정·메모 초기화'),
      E('p', {}, '이 기기에 저장된 라크마 촬영 메모·준비물 체크, 여행·꿀팁 관심 및 메모, 결혼 준비 체크리스트, 통합 예산, 웨딩홀·스드메 시뮬레이터, 혼수·가전 목록, 신혼부부 혜택 체크, 업체 일정, 본식 식순·당일 역할·현금 봉투·원판 순서, 산전검사 일정·체크·메모, 하객 명단, 축의금 장부를 초기 상태로 되돌립니다. 필요한 경우 먼저 ‘개인 백업 저장’을 진행해 주세요.'),
      button('개인 설정·메모 초기화', async () => {
        if (!await ctx.confirmAction({ title: '개인 설정·메모 초기화', message: '이 기기의 모든 개인 메모·관심 선택·예산·혼수·신혼혜택·체크리스트·식순·당일 운영표·산전검사·하객 명단·축의금 장부 설정을 초기화할까요?', confirmLabel: '모두 초기화', danger: true })) return;
        saveRollback('개인 설정 초기화 직전', ctx.readRawPrefs());
        if (await ctx.savePrefs(validatePreferences({}), validatePreferences({}), ctx.readStorage(ctx.PREF_KEY))) {
          ctx.closeDialog(); ctx.render(); ctx.toast('이 기기의 개인 설정과 메모를 초기화했습니다. (내용 관리에서 직전 상태로 복구 가능)');
        }
      }, 'button danger'))));
}
