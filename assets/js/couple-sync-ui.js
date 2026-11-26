import { E, button } from './dom.js?v=wedding-features-64';
import { validatePreferences, mergePreferences, summarizePreferencesMerge } from './preferences.js?v=wedding-features-64';
import { encodeSyncCode, decodeSyncCode, summarizePreferenceCounts } from './sync-code.js?v=wedding-features-64';

const ROLLBACK_KEY = 'wedding:v1:prefRollback';

function saveSyncRollback(reason, snapshotPrefs) {
  try {
    localStorage.setItem(ROLLBACK_KEY, JSON.stringify({
      savedAt: Date.now(),
      reason,
      preferences: validatePreferences(snapshotPrefs)
    }));
  } catch {}
}

export function openCoupleSyncModal(ctx) {
  if (ctx.isGuestMode()) return;
  const prefs = ctx.readRawPrefs();
  const counts = summarizePreferenceCounts(prefs);
  const meta = ctx.readBackupMeta();
  const hasUnsynced = Boolean(meta.prefUpdatedAt && (!meta.lastPrivateBackupAt || meta.prefUpdatedAt > meta.lastPrivateBackupAt));

  const codeStatusEl = E('p', { class: 'small muted', 'aria-live': 'polite' },
    hasUnsynced
      ? '✨ 마지막 백업/동기화 이후 새로 변경된 기록이 있어요. 코드를 복사해 카톡으로 보내면 상대방 기기에 3초 만에 합칠 수 있습니다.'
      : `마지막 백업·동기화: ${ctx.formatBackupTime(meta.lastPrivateBackupAt)}`);

  const copySyncCode = async () => {
    try {
      await ctx.finishPendingWrites();
      const latest = ctx.readRawPrefs();
      const result = await encodeSyncCode(latest);
      const chatPayload = `[💑 우리의 결혼 기록 동기화 코드]\n아래 코드를 복사해 앱 ‘💑 2인 동기화’에 붙여넣으면 내 기록이 기존 기록에 안전하게 합쳐집니다.\n\n${result.code}`;
      await ctx.copyTextToClipboard(
        chatPayload,
        `카톡용 2인 동기화 코드(${result.codeLength.toLocaleString('ko-KR')}자${result.compressed ? ' · gzip 압축' : ''})를 복사했습니다.`,
        '2인 동기화 코드 복사'
      );
      ctx.writeBackupMeta({ lastPrivateBackupAt: Date.now(), snoozeUntil: 0 });
      codeStatusEl.textContent = `✅ 방금 동기화 코드(${result.codeLength.toLocaleString('ko-KR')}자)를 복사했습니다. 카톡 채팅방에 그대로 붙여넣어 보내세요.`;
      if (ctx.currentRoute() === 'home' && !ctx.isDialogOpen()) ctx.render();
    } catch (error) {
      ctx.toast(error.message || '동기화 코드를 만들지 못했습니다.', true);
    }
  };

  const pasteInput = E('textarea', {
    id: 'couple-sync-paste',
    rows: '4',
    placeholder: '상대방이 카톡으로 보낸 메시지(WEDDING-SYNC-V1:...)를 그대로 붙여넣어 주세요.'
  });
  const previewSlot = E('div', { class: 'pref-merge-preview-slot', 'aria-live': 'polite' });
  let pendingIncoming = null;

  const renderPreview = () => {
    if (!pendingIncoming) {
      previewSlot.replaceChildren();
      return;
    }
    const currentPrefs = ctx.readRawPrefs();
    const merged = mergePreferences(currentPrefs, pendingIncoming);
    const diff = summarizePreferencesMerge(currentPrefs, merged);
    const chips = [
      diff.guestsAdded ? `하객 +${diff.guestsAdded}건` : '',
      diff.giftsAdded ? `축의금 +${diff.giftsAdded}건` : '',
      diff.schedulesAdded ? `업체 일정 +${diff.schedulesAdded}건` : '',
      diff.homeItemsAdded ? `혼수 품목 +${diff.homeItemsAdded}건` : '',
      diff.dayOpsAdded ? `당일 역할·봉투 +${diff.dayOpsAdded}건` : '',
      diff.checksAdded ? `체크 +${diff.checksAdded}건` : '',
      diff.customItemsAdded ? `직접 항목 +${diff.customItemsAdded}건` : '',
      diff.favoritesAdded ? `관심 +${diff.favoritesAdded}건` : '',
      diff.notesUpdated ? `메모 ${diff.notesUpdated}건 반영` : ''
    ].filter(Boolean);

    previewSlot.replaceChildren(
      E('div', { class: 'pref-merge-preview-card' },
        E('div', { class: 'pref-merge-preview-head' },
          E('strong', {}, '🔀 상대방 기록 병합 미리보기'),
          E('span', { class: 'badge' }, '기존 기록 유지 + 자동 롤백 보관')),
        E('div', { class: 'draft-diff-chips' },
          chips.length
            ? chips.map(txt => E('span', { class: 'draft-diff-chip is-added' }, txt))
            : [E('span', { class: 'draft-diff-chip is-modified' }, '추가될 새 항목 없음 (이미 최신 상태이거나 빈 항목만 보완)')]),
        E('div', { class: 'manager-actions' },
          button('✅ 이대로 안전하게 합치기', async () => {
            const latestNow = ctx.readRawPrefs();
            saveSyncRollback('2인 동기화 병합 직전', latestNow);
            const nextMerged = mergePreferences(latestNow, pendingIncoming);
            if (await ctx.savePrefs(nextMerged, latestNow, ctx.readStorage(ctx.PREF_KEY))) {
              ctx.writeBackupMeta({ lastPrivateBackupAt: Date.now(), snoozeUntil: 0 });
              pendingIncoming = null;
              ctx.closeDialog();
              ctx.render();
              ctx.toast(chips.length
                ? `상대방 기록을 안전하게 합쳤습니다. (${chips.join(', ')})`
                : '상대방 기록과 동기화를 완료했습니다.');
            }
          }, 'button'),
          button('취소', () => { pendingIncoming = null; renderPreview(); }, 'button quiet'))));
  };

  const inspectPastedCode = async () => {
    const raw = pasteInput.value.trim();
    if (!raw) {
      ctx.toast('상대방에게 받은 동기화 코드를 먼저 붙여넣어 주세요.', true);
      pasteInput.focus();
      return;
    }
    try {
      pendingIncoming = await decodeSyncCode(raw);
      renderPreview();
    } catch (error) {
      pendingIncoming = null;
      renderPreview();
      ctx.toast(error.message, true);
    }
  };

  const statBadges = [
    counts.guests ? `하객 ${counts.guests}건` : '',
    counts.gifts ? `축의금 ${counts.gifts}건` : '',
    counts.homeItems ? `혼수 ${counts.homeItems}건` : '',
    counts.checks ? `체크 ${counts.checks}건` : '',
    counts.notes ? `메모 ${counts.notes}건` : '',
    counts.hasBudget ? '예산 입력됨' : ''
  ].filter(Boolean);

  const body = E('div', { class: 'couple-sync-modal' },
    E('p', { class: 'form-note' }, '서버 없이 신랑·신부 두 기기의 개인 기록(하객·축의금·예산·혼수·체크리스트·상담 메모)을 카톡 복붙만으로 안전하게 합칩니다. 병합 직전 현재 기기 상태는 자동 롤백 스냅샷에 보관됩니다.'),
    E('section', { class: 'manager-section couple-sync-card' },
      E('h3', {}, '1. 내 기록 코드 복사해서 보내기'),
      E('div', { class: 'region-matrix-tags' },
        statBadges.length
          ? statBadges.map(s => E('span', { class: 'spec-chip direct' }, s))
          : [E('span', { class: 'spec-chip' }, '아직 등록된 개인 기록 없음')]),
      codeStatusEl,
      E('div', { class: 'manager-actions' },
        button('📋 카톡용 동기화 코드 복사', copySyncCode, 'button'),
        button('📤 JSON 파일 공유·저장', () => ctx.sharePrivateBackup(), 'button quiet'))),
    E('section', { class: 'manager-section couple-sync-card' },
      E('h3', {}, '2. 상대방 코드 붙여넣어 합치기'),
      E('label', { class: 'field', for: 'couple-sync-paste' }, '카톡으로 받은 동기화 코드(안내 문구째 붙여넣어도 자동 인식)', pasteInput),
      E('div', { class: 'manager-actions' },
        button('🔍 병합 미리보기', inspectPastedCode, 'button'),
        button('입력 지우기', () => { pasteInput.value = ''; pendingIncoming = null; renderPreview(); pasteInput.focus(); }, 'button quiet')),
      previewSlot));

  ctx.showDialog('💑 신랑·신부 3초 기록 동기화', body);
}
