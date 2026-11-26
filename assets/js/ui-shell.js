import { $, E } from './dom.js?v=wedding-features-67';

export const BACKUP_META_KEY = 'wedding:v1:backupMeta';

export function readBackupMeta(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const parsed = JSON.parse(storage?.getItem(BACKUP_META_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeBackupMeta(patch, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    if (!storage) return;
    const next = { ...readBackupMeta(storage), ...patch };
    storage.setItem(BACKUP_META_KEY, JSON.stringify(next));
  } catch {}
}

export function hasSubstantialPrivateData(p) {
  if (!p || typeof p !== 'object') return false;
  return Boolean(
    (p.guestList?.length || 0) > 0 ||
    (p.giftLedger?.length || 0) > 0 ||
    (p.homeItems?.length || 0) > 0 ||
    (p.weddingDayRoles?.length || 0) > 0 ||
    (p.weddingDayEnvelopes?.length || 0) > 0 ||
    Object.keys(p.budgetPlan || {}).length > 0 ||
    Boolean(p.prenatalSchedule?.appliedDate || p.prenatalSchedule?.visitDate || p.prenatalSchedule?.examDate) ||
    Boolean(p.marriageRegDate) ||
    (p.checklist?.length || 0) >= 2 ||
    (p.customChecklist?.length || 0) > 0 ||
    Object.keys(p.notes || {}).length > 0 ||
    Object.keys(p.tripNotes || {}).length > 0 ||
    Boolean(p.prenatalNote?.trim()) ||
    Boolean(p.benefitNote?.trim()) ||
    Boolean(p.photoOrderNote?.trim()) ||
    Array.isArray(p.vendorSchedules)
  );
}

export function computeBackupReminder(p, { guestMode = false, ignoreSnooze = false, now = Date.now(), meta = null } = {}) {
  if (guestMode || !hasSubstantialPrivateData(p)) return null;
  const currentMeta = meta || readBackupMeta();
  if (!ignoreSnooze && currentMeta.snoozeUntil && now < currentMeta.snoozeUntil) return null;
  if (!currentMeta.lastPrivateBackupAt) {
    return {
      kind: 'never',
      daysAgo: null,
      message: '이 기기에 기록한 결혼 준비 데이터를 아직 백업하지 않았어요. 백업 파일을 보관하거나 상대방에게 보내 두세요.'
    };
  }
  const daysAgo = Math.floor((now - currentMeta.lastPrivateBackupAt) / 86400000);
  if (daysAgo >= 14) {
    return {
      kind: 'stale',
      daysAgo,
      message: `마지막 개인 백업으로부터 ${daysAgo}일이 지났습니다. 안전한 보관을 위해 최신 백업을 저장해 두세요.`
    };
  }
  return null;
}

export function formatBackupTime(ts) {
  if (!ts) return '아직 백업 이력 없음';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function canShareBackupFiles() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function';
}

export function confirmAction({ title = '확인', message = '', confirmLabel = '확인', cancelLabel = '취소', danger = false } = {}) {
  const modal = $('#confirm-dialog');
  if (!modal || typeof modal.showModal !== 'function') {
    return Promise.resolve(confirm(message));
  }
  const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Promise(resolve => {
    const titleEl = $('#confirm-title');
    const msgEl = $('#confirm-message');
    const okBtn = $('#confirm-ok');
    const cancelBtn = $('#confirm-cancel');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = confirmLabel;
      okBtn.className = 'button' + (danger ? ' is-danger' : '');
    }
    if (cancelBtn) cancelBtn.textContent = cancelLabel;
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      modal.removeEventListener('cancel', onCancel);
      modal.removeEventListener('click', onBackdrop);
      if (modal.open) modal.close();
      if (prevFocus?.isConnected) prevFocus.focus({ preventScroll: true });
      resolve(result);
    };
    const onOk = () => finish(true);
    const onCancel = event => { if (event?.type === 'cancel') event.preventDefault(); finish(false); };
    const onBackdrop = event => { if (event.target === modal) finish(false); };
    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    modal.addEventListener('cancel', onCancel);
    modal.addEventListener('click', onBackdrop);
    if (!modal.open) modal.showModal();
    (danger ? cancelBtn : okBtn)?.focus();
  });
}

export function createToastController({ dialog, getConflictReview }) {
  let toastTimer = null;
  return function toast(message, options = false) {
    const opts = typeof options === 'object' && options !== null ? options : { error: Boolean(options) };
    const error = Boolean(opts.error);
    const onUndo = typeof opts.onUndo === 'function' ? opts.onUndo : null;
    const undoLabel = opts.undoLabel || '되돌리기';
    if (dialog?.open) {
      const conflictReview = getConflictReview?.();
      if (conflictReview) {
        conflictReview.message = { text: message, error };
        const status = $('#conflict-status');
        if (status) { status.textContent = message; status.setAttribute('role', error ? 'alert' : 'status'); }
        return;
      }
      const notice = $('#dialog-notice');
      if (notice) {
        notice.textContent = message;
        notice.hidden = false;
        notice.className = 'dialog-notice' + (error ? ' error' : '');
        notice.setAttribute('role', error ? 'alert' : 'status');
        if (error) { notice.focus(); notice.scrollIntoView({ block: 'nearest' }); }
      }
      return;
    }
    clearTimeout(toastTimer);
    const target = $('#toast');
    if (!target) return;
    if (onUndo) {
      let clicked = false;
      const undoBtn = E('button', {
        type: 'button',
        class: 'toast-undo-btn',
        onclick: () => {
          if (clicked) return;
          clicked = true;
          clearTimeout(toastTimer);
          target.hidden = true;
          onUndo();
        }
      }, undoLabel);
      target.replaceChildren(E('span', { class: 'toast-msg' }, message), undoBtn);
    } else {
      target.textContent = message;
    }
    target.hidden = false;
    target.className = 'toast' + (error ? ' error' : '') + (onUndo ? ' has-action' : '');
    const duration = Number(opts.duration) || (error ? 8500 : (onUndo ? 6500 : 3800));
    toastTimer = setTimeout(() => { target.hidden = true; }, duration);
  };
}

export function flashCopiedButton(triggerEl = null) {
  const btn = triggerEl || (document.activeElement?.matches?.('button') ? document.activeElement : null);
  if (!btn || !btn.isConnected || btn.dataset.copyFlashActive === '1') return;
  const orig = btn.textContent || '';
  if (!orig.trim() || orig.trim().length > 26 || btn.children.length > 0) return;
  btn.dataset.copyFlashActive = '1';
  btn.classList.add('is-copied');
  btn.textContent = '✓ 복사됨';
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.copyFlashActive === '1') {
      btn.textContent = orig;
      btn.classList.remove('is-copied');
      delete btn.dataset.copyFlashActive;
    }
  }, 1800);
}

export async function copyText({ text, message = '클립보드에 복사했습니다.', fallbackTitle = '내용 복사', triggerEl = null, showDialog, toast }) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    flashCopiedButton(triggerEl);
    toast?.(message);
    return true;
  } catch {
    const field = text.includes('\n')
      ? E('textarea', { rows: '10', readonly: true, 'aria-label': fallbackTitle }, text)
      : E('input', { type: 'text', readonly: true, value: text, 'aria-label': fallbackTitle });
    showDialog?.(fallbackTitle, E('div', {}, E('p', {}, '아래 내용을 선택해 복사해 주세요.'), field));
    field.focus();
    field.select();
    return false;
  }
}

export function isIosSafariStandaloneEligible() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Instagram/i.test(ua);
  const isStandalone = Boolean(window.navigator.standalone) || Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches);
  return isIos && isSafari && !isStandalone;
}

export function initPwaInstall({ btn, isGuestMode, toast, showDialog }) {
  if (!btn) return { sync() {} };
  let deferredPrompt = null;
  let installed = Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches) || Boolean(window.navigator.standalone);
  const iosEligible = isIosSafariStandaloneEligible();

  const sync = () => {
    const canShow = !installed && !isGuestMode() && (Boolean(deferredPrompt) || iosEligible);
    btn.hidden = !canShow;
    if (canShow) {
      btn.title = deferredPrompt ? '홈 화면에 앱으로 설치' : 'iPhone 홈 화면에 앱으로 추가 방법 보기';
      btn.setAttribute('aria-label', deferredPrompt ? '홈 화면에 앱으로 설치하기' : 'iPhone 홈 화면에 앱으로 추가 안내');
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    sync();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    sync();
    toast?.('📲 홈 화면에 ‘우리의 결혼 기록’ 앱을 설치했습니다.');
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      sync();
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') {
          installed = true;
          toast?.('📲 홈 화면에 앱 설치를 시작합니다.');
        } else {
          toast?.('앱 설치를 취소했습니다. 브라우저 메뉴에서 언제든 설치할 수 있어요.');
        }
      } catch {
        toast?.('브라우저 메뉴의 ‘홈 화면에 추가’로 설치해 주세요.');
      }
      sync();
      return;
    }
    if (iosEligible && showDialog) {
      showDialog('📲 iPhone / iPad 홈 화면에 앱으로 추가', E('div', { class: 'editor-form' },
        E('p', {}, 'Safari에서는 아래 3단계로 ‘우리의 결혼 기록’을 앱처럼 설치할 수 있습니다.'),
        E('ol', { class: 'compact-ol' },
          E('li', {}, '화면 아래쪽(또는 주소창 옆)의 ', E('strong', {}, '공유 버튼 (□↑)'), '을 탭합니다.'),
          E('li', {}, '목록을 아래로 내려 ', E('strong', {}, '‘홈 화면에 추가’'), '를 선택합니다.'),
          E('li', {}, '오른쪽 위의 ', E('strong', {}, '‘추가’'), '를 누르면 오프라인에서도 빠르게 열 수 있어요.')),
        E('p', { class: 'form-note' }, '※ 기기에 저장된 결혼 준비 메모·예산·하객 장부는 설치 후에도 그대로 유지됩니다.')));
    }
  });

  sync();
  return { sync };
}
