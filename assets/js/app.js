import { parseContent, validateContent, formatDate, weddingDday, MAX_IMPORT_BYTES } from './content.js?v=wedding-features-69';
import { $, E, S, button, linkButton, externalLink, image, formatPartner } from './dom.js?v=wedding-features-69';
import {
  readBackupMeta,
  writeBackupMeta,
  computeBackupReminder,
  formatBackupTime,
  canShareBackupFiles,
  confirmAction,
  createToastController,
  flashCopiedButton,
  copyText,
  initPwaInstall
} from './ui-shell.js?v=wedding-features-69';
import { createShellEffects } from './shell-effects.js?v=wedding-features-69';
import { stopInvitationBgm } from './bgm.js?v=wedding-features-69';
import { renderBotanicalLeaf } from './invitation-card.js?v=wedding-features-69';
import { renderInvitationView } from './invitation-ui.js?v=wedding-features-69';
import { sortedStories as sortStoryRecords, renderStoriesView, renderAlbumsView, focusStorySearch } from './story-album-ui.js?v=wedding-features-69';
import { openPhotoViewer } from './photo-viewer.js?v=wedding-features-69';

const main = $('#main'), dialog = $('#editor-dialog'), editor = $('#editor-body');
const DRAFT_KEY = 'wedding:v1:draft', PREF_KEY = 'wedding:v1:preferences';
const routes = ['home', 'invitation', 'story', 'albums', 'studios', 'honeymoon', 'ceremony', 'prenatal', 'tips'];
const SUBTAB_MAP = {
  ceremony: ['rundown', 'guests', 'gifts', 'dayops'],
  tips: ['tips', 'budget', 'schedule', 'home', 'benefits'],
  prenatal: ['hospital', 'subsidy', 'guide']
};
const MENU_ICONS = { home: '🏡', invitation: '💌', story: '📖', albums: '📷', studios: '📸', honeymoon: '✈️', ceremony: '💍', prenatal: '🩺', tips: '📚' };
const menus = [
  ['invitation', '청첩장', '소중한 분들을 초대하는 우리의 첫 인사.', 'INVITATION'],
  ['story', '우리의 일대기', '첫 만남부터 오늘까지, 함께 쌓아 온 시간.', 'OUR STORY'],
  ['albums', '포토 앨범', '오래 꺼내 보고 싶은 두 사람의 순간들.', 'PHOTO ALBUM'],
  ['studios', '스튜디오', '라크마 촬영 일정과 당일 동선·준비물 안내.', 'STUDIOS'],
  ['honeymoon', '신혼여행', '결혼 후 첫 여행, 가고 싶은 곳부터 차근차근.', 'HONEYMOON'],
  ['ceremony', '본식 식순', '순천아모르 식순·사회자 대본, 하객·축의금과 당일 역할·봉투 관리.', 'CEREMONY & VOWS'],
  ['prenatal', '산전검사', '순천 현대여성아동병원 안내와 지원금 신청·마감일 계산기.', 'PRENATAL CARE'],
  ['tips', '결혼에 관한 모든 정보', '결혼 꿀팁·예산·혼수 가전·순천/정부 신혼부부 혜택 원스톱 보드.', 'WEDDING GUIDE']
];

const loadedModules = {};
const modulePromises = {};
const moduleErrors = {};
const pendingSubTabs = { ceremony: null, tips: null, prenatal: null };
const MODULE_LOADERS = {
  preferences: () => import('./preferences.js?v=wedding-features-69'),
  storage: () => import('./storage.js?v=wedding-features-69'),
  homeDashboard: () => import('./home-dashboard-ui.js?v=wedding-features-69'),
  manager: () => import('./manager-ui.js?v=wedding-features-69'),
  studios: () => import('./studio-ui.js?v=wedding-features-69'),
  honeymoon: () => import('./travel-ui.js?v=wedding-features-69'),
  ceremony: () => import('./ceremony-ui.js?v=wedding-features-69'),
  prenatal: () => import('./prenatal-ui.js?v=wedding-features-69'),
  tips: () => import('./planning-ui.js?v=wedding-features-69'),
  editor: () => import('./editor-ui.js?v=wedding-features-69'),
  search: () => import('./search-ui.js?v=wedding-features-69'),
  qrcode: () => import('./qrcode.js?v=wedding-features-69'),
  coupleSync: () => import('./couple-sync-ui.js?v=wedding-features-69'),
  fieldOps: () => import('./field-ops-ui.js?v=wedding-features-69')
};

function loadModule(key) {
  if (loadedModules[key]) return Promise.resolve(loadedModules[key]);
  if (!modulePromises[key]) {
    delete moduleErrors[key];
    modulePromises[key] = MODULE_LOADERS[key]()
      .then(mod => {
        loadedModules[key] = mod;
        if (key === 'ceremony' && pendingSubTabs.ceremony) { mod.setCeremonySubTab?.(pendingSubTabs.ceremony); pendingSubTabs.ceremony = null; }
        if (key === 'tips' && pendingSubTabs.tips) { mod.setTipsSubTab?.(pendingSubTabs.tips); pendingSubTabs.tips = null; }
        if (key === 'prenatal' && pendingSubTabs.prenatal) { mod.setPrenatalSubTab?.(pendingSubTabs.prenatal); pendingSubTabs.prenatal = null; }
        return mod;
      })
      .catch(error => {
        delete modulePromises[key];
        moduleErrors[key] = error?.message || '화면을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.';
        throw error;
      });
  }
  return modulePromises[key];
}

function applySubTabSelection(route, tab) {
  if (!tab || !SUBTAB_MAP[route]?.includes(tab)) return;
  pendingSubTabs[route] = tab;
  if (route === 'ceremony') loadedModules.ceremony?.setCeremonySubTab?.(tab);
  if (route === 'tips') loadedModules.tips?.setTipsSubTab?.(tab);
  if (route === 'prenatal') loadedModules.prenatal?.setPrenatalSubTab?.(tab);
}

let baseContent, content, studios = [], prefs = {}, isDraft = false;
const DEFAULT_STUDIO_ID = 'studio-09';
const activeLachmaStudio = () => studios.find(s => s.id === DEFAULT_STUDIO_ID) || studios.find(s => s.name === '라크마');
const urlGuestMode = new URLSearchParams(location.search).get('view') === 'guest';
let guestMode = urlGuestMode;
let baseRevision = '', draftRevision = null, editorState = null, studiosStatus = 'loading', studiosError = '';
let previousHash = location.hash, pendingWrites = 0;
let conflictReview = null, photoNavigation = null, photoCleanup = null;
let lastDialogTrigger = null, lastActivatedControl = null, pwaInstall = null;
let preferenceQueue = Promise.resolve();
const pendingWriteTasks = new Set();
let lastWriteFailed = false;
let waitingSw = null;
let dockSpyObserver = null;
const toast = createToastController({ dialog, getConflictReview: () => conflictReview });
const shellEffects = createShellEffects({
  main,
  getGuestMode: () => guestMode,
  currentRoute,
  toast,
  getPwaInstall: () => pwaInstall
});
const {
  isLargeTextMode,
  syncLargeTextUi,
  toggleLargeTextMode,
  renderLargeTextButton,
  syncThemeUi,
  toggleThemeMode,
  renderPetalsButton,
  renderInvitationPetalsLayer,
  startInvitationCountdown,
  stopInvitationCountdown,
  clearCountdownSlot,
  resumeCountdownIfVisible
} = shellEffects;

function trackWrite(task) {
  const completion = Promise.resolve(task).then(value => ({ ok: value !== false }), error => ({ ok: false, error }));
  pendingWriteTasks.add(completion);
  completion.then(result => { pendingWriteTasks.delete(completion); lastWriteFailed = !result.ok; });
  return task;
}
function queuePreference(action) {
  const task = preferenceQueue.then(action);
  preferenceQueue = task.catch(() => {});
  return trackWrite(task);
}
async function finishPendingWrites() {
  let failed = false;
  while (pendingWriteTasks.size) {
    const results = await Promise.all([...pendingWriteTasks]);
    failed ||= results.some(result => !result.ok);
  }
  if (failed) throw new Error('대기 중인 변경을 저장하지 못해 백업을 중단했습니다. 오류를 확인하고 다시 시도해 주세요.');
}

const editButton = (...args) => (guestMode ? null : button(...args));
const readStorage = key => { try { return localStorage.getItem(key); } catch { return null; } };
const backupReminderInfo = (p = prefs, opts = {}) => computeBackupReminder(p, { ...opts, guestMode });

function hashSegments() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}
function currentRoute() {
  const route = hashSegments()[0] || '';
  return routes.includes(route) ? route : (guestMode ? 'invitation' : 'home');
}
function currentSubTab() {
  const [route, sub] = hashSegments();
  if (!route || !sub) return '';
  return SUBTAB_MAP[route]?.includes(sub) ? sub : '';
}
function setSubTabHash(route, subTab) {
  if (!SUBTAB_MAP[route]?.includes(subTab)) { render(); return; }
  applySubTabSelection(route, subTab);
  const nextHash = `#/${route}/${subTab}`;
  if (location.hash === nextHash) { render(); return; }
  location.hash = nextHash;
}
function navigateToRoute(route, subTab = '', action = '') {
  if (subTab && SUBTAB_MAP[route]?.includes(subTab)) applySubTabSelection(route, subTab);
  const targetHash = `#/${route}${subTab && SUBTAB_MAP[route]?.includes(subTab) ? `/${subTab}` : ''}`;
  if (location.hash !== targetHash) location.hash = targetHash;
  else render();
  if (action === 'quick-gift' && !guestMode) {
    loadModule('ceremony')
      .then(mod => mod.openQuickGiftEntryModal?.(moduleCtx()))
      .catch(error => toast(error.message || '빠른 입력 창을 열지 못했습니다.', true));
  } else if (action === 'couple-sync' && !guestMode) {
    openCoupleSync();
  } else if (action === 'shoot-day' && !guestMode) {
    openShootDayMode();
  } else if (action === 'wedding-day' && !guestMode) {
    openWeddingDayHub();
  }
}

async function beginConflictReview(options) {
  try {
    const mod = await loadModule('manager');
    mod.beginConflictReview(moduleCtx(), options);
  } catch (error) {
    toast(error.message || '충돌 비교 창을 열지 못했습니다.', true);
  }
}
async function downloadPrivate() {
  const mod = await loadModule('manager');
  return mod.downloadSaved(moduleCtx(), PREF_KEY);
}
async function sharePrivateBackup() {
  const mod = await loadModule('manager');
  return mod.sharePrivateBackup(moduleCtx());
}
async function openManager() {
  if (guestMode) return;
  try {
    const mod = await loadModule('manager');
    mod.openManager(moduleCtx());
  } catch (error) {
    toast(error.message || '내용 관리 창을 열지 못했습니다.', true);
  }
}
async function openCoupleSync() {
  if (guestMode) return;
  try {
    const mod = await loadModule('coupleSync');
    mod.openCoupleSyncModal(moduleCtx());
  } catch (error) {
    toast(error.message || '2인 동기화 창을 열지 못했습니다.', true);
  }
}
async function openShootDayMode() {
  if (guestMode) return;
  try {
    if (studiosStatus !== 'ready') await loadStudios();
    const mod = await loadModule('fieldOps');
    mod.openShootDayMode(moduleCtx());
  } catch (error) {
    toast(error.message || '촬영 현장 브리핑 모드를 열지 못했습니다.', true);
  }
}
async function openWeddingDayHub() {
  if (guestMode) return;
  try {
    const mod = await loadModule('fieldOps');
    mod.openWeddingDayHub(moduleCtx());
  } catch (error) {
    toast(error.message || '본식 현장 통합 모드를 열지 못했습니다.', true);
  }
}
function syncUnsyncedIndicator() {
  const btn = $('#manage-content');
  if (!btn) return;
  if (guestMode) {
    btn.classList.remove('has-unsynced-dot');
    btn.removeAttribute('title');
    return;
  }
  const meta = readBackupMeta();
  const hasUnsynced = Boolean(meta.prefUpdatedAt && (!meta.lastPrivateBackupAt || meta.prefUpdatedAt > meta.lastPrivateBackupAt));
  btn.classList.toggle('has-unsynced-dot', hasUnsynced);
  btn.title = hasUnsynced
    ? '마지막 백업·동기화 이후 새 변경사항이 있어요. 내용 관리 또는 2인 동기화를 확인해 주세요.'
    : '내용 관리 · 백업 · 2인 동기화';
}

function moduleCtx() {
  return {
    DRAFT_KEY,
    PREF_KEY,
    isGuestMode: () => guestMode,
    isLargeTextMode,
    toggleLargeTextMode,
    renderLargeTextButton,
    renderPetalsButton,
    renderInvitationPetalsLayer,
    copyInvitationLink,
    shareInvitationLink,
    toggleGuestPreview,
    loadModule,
    confirmAction,
    getContent: () => content,
    getBaseContent: () => baseContent,
    getIsDraft: () => isDraft,
    getDraftRevision: () => draftRevision,
    getBaseRevision: () => baseRevision,
    resetToBaseContent: () => { content = structuredClone(baseContent); syncMemoryPrefs(); isDraft = false; draftRevision = baseRevision; },
    getPrefs: () => prefs,
    getMain: () => main,
    isDialogOpen: () => dialog.open,
    currentRoute,
    currentSubTab,
    setSubTabHash,
    navigateToRoute,
    readStorage,
    readRawPrefs,
    savePrefs,
    syncMemoryPrefs,
    queuePreference,
    hasPendingWrites: () => pendingWriteTasks.size > 0,
    finishPendingWrites,
    didLastWriteFail: () => lastWriteFailed,
    setDraft,
    syncDraftFromStorage,
    beginConflictReview,
    getConflictReview: () => conflictReview,
    setConflictReview: value => { conflictReview = value; },
    showDialog,
    closeDialog,
    requestClose,
    closeMobileMenu,
    setEditorState: state => { editorState = state; },
    render,
    toast,
    storageMessage,
    pageHeader,
    empty,
    editButton,
    guestRestrictedView,
    openPhotos,
    openEditor: (type, item) => openEditor(type, item),
    focusTrip,
    focusRecord,
    focusStudioArchive: query => {
      if (guestMode || currentRoute() !== 'studios') return;
      loadModule('studios').then(mod => {
        mod.openStudioArchiveSearch?.(query);
        if (currentRoute() === 'studios') {
          render();
          setTimeout(() => {
            const drawer = main.querySelector('.studio-archive-drawer');
            drawer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 40);
        }
      }).catch(() => {});
    },
    focusTipSearch: query => {
      if (guestMode || currentRoute() !== 'tips') return;
      loadModule('tips').then(mod => {
        mod.focusTipSearch?.(query);
        if (currentRoute() === 'tips') { render(); $('#tip-search')?.focus({ preventScroll: true }); }
      }).catch(() => {});
    },
    focusHomeSearch: query => {
      if (guestMode || currentRoute() !== 'tips') return;
      loadModule('tips').then(mod => {
        mod.focusHomeSearch?.(query);
        if (currentRoute() === 'tips') { render(); $('#home-item-search')?.focus({ preventScroll: true }); }
      }).catch(() => {});
    },
    focusGuestSearch: query => {
      if (guestMode || currentRoute() !== 'ceremony') return;
      loadModule('ceremony').then(mod => {
        mod.focusGuestSearch?.(query);
        if (currentRoute() === 'ceremony') { render(); $('#guest-search')?.focus({ preventScroll: true }); }
      }).catch(() => {});
    },
    focusGiftSearch: query => {
      if (guestMode || currentRoute() !== 'ceremony') return;
      loadModule('ceremony').then(mod => {
        mod.focusGiftSearch?.(query);
        if (currentRoute() === 'ceremony') { render(); $('#gift-search')?.focus({ preventScroll: true }); }
      }).catch(() => {});
    },
    focusStorySearch: query => {
      if (currentRoute() !== 'story') return;
      focusStorySearch(query);
      render();
      $('#story-search')?.focus({ preventScroll: true });
    },
    recordActions,
    copyTextToClipboard,
    copyVenueAddress,
    backupReminderInfo,
    readBackupMeta,
    writeBackupMeta: patch => {
      const next = writeBackupMeta(patch);
      syncUnsyncedIndicator();
      return next;
    },
    formatBackupTime,
    canShareBackupFiles,
    downloadPrivate,
    sharePrivateBackup,
    openCoupleSync,
    openShootDayMode,
    openWeddingDayHub,
    getStudiosList: () => studios,
    getStudiosState: () => ({ status: studiosStatus, error: studiosError, activeLachma: activeLachmaStudio() }),
    loadStudios
  };
}

function storageMessage(error) {
  if (error.name === 'QuotaExceededError') return '저장 공간이 부족합니다. 초안을 백업하고 사진 수나 용량을 줄여 주세요.';
  if (error.name === 'SecurityError') return '브라우저의 저장 허용 설정을 확인해 주세요.';
  return error.message;
}

const readRawPrefs = () => {
  const prefMod = loadedModules.preferences;
  if (!prefMod) return structuredClone(prefs);
  try { return prefMod.validatePreferences(JSON.parse(readStorage(PREF_KEY) || '{}')); }
  catch { return structuredClone(prefs); }
};
const syncMemoryPrefs = (source) => {
  const prefMod = loadedModules.preferences;
  if (!prefMod) { prefs = {}; return prefs; }
  const input = source !== undefined ? source : (guestMode ? prefMod.validatePreferences({}) : readRawPrefs());
  prefs = content ? prefMod.pruneContentPreferences(input, content) : input;
  return prefs;
};
function savePrefs(next, base = structuredClone(prefs), approvedRaw) {
  return trackWrite(persistPrefs(next, base, approvedRaw));
}
async function persistPrefs(next, base, approvedRaw) {
  pendingWrites++;
  try {
    const [prefMod, storageMod] = await Promise.all([loadModule('preferences'), loadModule('storage')]);
    const result = await storageMod.lockedMerge({
      locks: navigator.locks,
      storage: localStorage,
      key: PREF_KEY,
      base,
      next,
      fallback: prefMod.validatePreferences({}),
      parse: raw => prefMod.validatePreferences(JSON.parse(raw)),
      validate: prefMod.validatePreferences,
      approvedRaw
    });
    if (!guestMode) { syncMemoryPrefs(result.value); writeBackupMeta({ prefUpdatedAt: Date.now() }); syncUnsyncedIndicator(); }
    return true;
  } catch (error) {
    const storageMod = loadedModules.storage;
    const prefMod = loadedModules.preferences;
    if (storageMod && error instanceof storageMod.StorageConflict) {
      if (dialog.open || showDialog('다른 탭의 변경 확인', E('p', {}, '개인 메모와 선택의 변경 내용을 확인해 주세요.'))) {
        await beginConflictReview({
          key: PREF_KEY, base, next, lockEditor: true,
          keepSaved: () => {
            try { syncMemoryPrefs(prefMod.validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY) || '{}'))); closeDialog(); render(); }
            catch (cause) { toast(cause.message, true); }
          },
          saveLocal: async raw => { if (await savePrefs(next, base, raw)) { closeDialog(); render(); toast('선택한 내용으로 저장했습니다.'); } }
        });
      }
    } else toast('선택과 메모를 저장하지 못했습니다. 이전 저장본을 유지합니다. ' + storageMessage(error), true);
    return false;
  } finally { pendingWrites--; }
}

function setDraft(next, base = structuredClone(content), approvedRaw) {
  return trackWrite(persistDraft(next, base, approvedRaw));
}
async function persistDraft(next, base, approvedRaw) {
  pendingWrites++;
  try {
    const storageMod = await loadModule('storage');
    const result = await storageMod.lockedMerge({
      locks: navigator.locks,
      storage: localStorage,
      key: DRAFT_KEY,
      base,
      next,
      fallback: baseContent,
      parse: parseContent,
      validate: validateContent,
      approvedRaw,
      encode: valid => {
        const current = localStorage.getItem(DRAFT_KEY);
        const revision = current ? JSON.parse(current).baseRevision ?? null : baseRevision;
        const raw = JSON.stringify({ ...valid, baseRevision: revision });
        if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('초안은 8MB 이하로 저장해 주세요. 사진 수나 용량을 줄여 주세요.');
        return raw;
      }
    });
    draftRevision = JSON.parse(result.raw).baseRevision;
    if (!guestMode) content = result.value;
    isDraft = true;
  } catch (error) {
    const storageMod = loadedModules.storage;
    if (storageMod && error instanceof storageMod.StorageConflict) throw error;
    throw new Error('초안을 저장하지 못했습니다. 입력 내용은 유지됩니다. ' + storageMessage(error));
  } finally { pendingWrites--; }
}

function dirtyEditor() { return editorState?.isDirty() || false; }
function canLeaveEditor() {
  if (editorState?.isSaving() || conflictReview?.busy) { toast('저장 중입니다. 완료될 때까지 잠시 기다려 주세요.'); return false; }
  return !dirtyEditor() || confirm('저장하지 않은 입력이 있습니다. 입력을 버리고 닫을까요?');
}
function unloadDialogMedia() { for (const frame of editor.querySelectorAll('iframe')) frame.src = 'about:blank'; }
function closeDialog({ restoreFocus = true } = {}) {
  photoCleanup?.(); photoCleanup = null;
  conflictReview?.release?.(); editorState = null; conflictReview = null; photoNavigation = null;
  unloadDialogMedia();
  editor.replaceChildren();
  const actionSlot = $('#dialog-actions'); actionSlot.replaceChildren(); actionSlot.hidden = true;
  if (dialog.open) dialog.close();
  const returnTarget = lastDialogTrigger;
  lastDialogTrigger = null;
  if (restoreFocus && returnTarget?.isConnected && typeof returnTarget.focus === 'function') {
    returnTarget.focus({ preventScroll: true });
  }
}
function requestClose() { if (canLeaveEditor()) closeDialog(); }
function pageHeader(title, description, action, eyebrow) {
  return E('div', { class: 'page-header' }, E('div', {}, E('p', { class: 'eyebrow' }, eyebrow || 'OUR WEDDING JOURNAL'), E('h1', {}, title), E('p', {}, description)), action);
}
function empty(title, description, label, action, allowGuestAction = false) {
  return E('div', { class: 'empty-state' }, E('span', { class: 'empty-mark', 'aria-hidden': 'true' }, 'w.'), E('h2', {}, title), E('p', {}, description), label && (!guestMode || allowGuestAction) ? button(label, action) : null);
}

function isGuestVisibleRoute(route) {
  if (route === 'home' || route === 'invitation') return true;
  if (route === 'story') return Boolean(content?.stories?.length);
  if (route === 'albums') return Boolean(content?.albums?.length);
  return false;
}
function guestRestrictedView(title, subtitle, eyebrow) {
  return [
    pageHeader(title, subtitle, null, eyebrow),
    empty('신랑·신부 전용 결혼 준비 탭입니다.', '예식 일시와 오시는 길 안내는 모바일 청첩장에서 확인하실 수 있습니다.', '모바일 청첩장 보기', () => { location.hash = '#/invitation'; }, true)
  ];
}

function renderHome() {
  const info = content.invitation;
  const names = [info.partner1, info.partner2].filter(Boolean).join(' & ');
  const p1Clean = info.partner1 ? info.partner1.replace(/^신랑\s*/, '') : '';
  const p2Clean = info.partner2 ? info.partner2.replace(/^신부\s*/, '') : '';
  const roleNames = [formatPartner(info.partner1, '신랑'), formatPartner(info.partner2, '신부')].filter(Boolean).join(' · ');
  const dday = weddingDday(info.date);
  const datePillText = info.date ? `${formatDate(info.date)}${info.time ? ` · ${info.time}` : ''}` : (roleNames || 'OUR WEDDING DIARY');
  const venueBase = info.venue ? info.venue.replace(/\s+\d+층$/, '').trim() : '';
  const venueFloor = info.venue?.match(/(\d+층)$/)?.[1] ? `${info.venue.match(/(\d+층)$/)[1]} 예식홀` : '';
  const archMeta = [venueFloor, dday].filter(Boolean).join(' · ') || [dday, venueBase].filter(Boolean).join(' · ') || (info.date ? formatDate(info.date) : '함께 써 내려가는 기록');
  const archDate = info.date ? `${info.date.replaceAll('-', '. ')}${info.time ? ` · ${info.time}` : ''}` : '예식 일정 준비 중';
  const heroActions = guestMode ? [
    linkButton('모바일 청첩장 보기', '#/invitation'),
    content.stories.length ? linkButton('우리의 일대기 보기', '#/story', true) : null,
    content.albums.length ? linkButton('포토 앨범 보기', '#/albums', true) : null,
    !content.stories.length && !content.albums.length && info.mapUrl ? externalLink('오시는 길 지도 ↗', info.mapUrl, 'button quiet') : null
  ] : [
    linkButton(info.date ? '모바일 청첩장 보기' : '예식 정보 채우기', '#/invitation'),
    linkButton('라크마 촬영 가이드', '#/studios', true),
    linkButton('본식 식순 보기', '#/ceremony', true)
  ];
  const hero = E('section', { class: 'hero' },
    E('div', { class: 'hero-copy' },
      E('div', { class: 'hero-badges' },
        E('span', { class: 'hero-date-pill' }, datePillText),
        info.date && roleNames ? E('span', { class: 'hero-role-caption' }, roleNames) : null),
      E('h1', {}, names ? (guestMode ? `${names}, 소중한 분들을 초대합니다` : `${names}, 우리의 결혼을 준비하는 기록`) : '함께 준비하는 우리의 결혼 기록'),
      E('p', {}, guestMode ? '두 사람의 예식 일시와 오시는 길, 함께 쌓아 온 소중한 이야기를 전합니다.' : '꼭 필요한 예식 일정과 라크마 촬영 안내, 신혼여행 비교 정보를 한눈에 정리했습니다.'),
      E('div', { class: 'hero-actions' }, ...heroActions)),
    E('div', { class: 'hero-art', 'aria-hidden': 'true' },
      E('div', { class: 'art-arch promise-arch' },
        S('svg', { class: 'arch-botanical-sprig', viewBox: '0 0 96 26', 'aria-hidden': 'true' },
          S('path', { d: 'M 14 17 C 30 12, 66 12, 82 17', fill: 'none', stroke: '#8ba792', 'stroke-width': '1.15', 'stroke-linecap': 'round' }),
          renderBotanicalLeaf(28, 15, -64, 0.52, '#7ea087'),
          renderBotanicalLeaf(38, 14, -44, 0.44, '#9cb4a2'),
          renderBotanicalLeaf(68, 15, 64, 0.52, '#7ea087'),
          renderBotanicalLeaf(58, 14, 44, 0.44, '#9cb4a2'),
          S('circle', { cx: '48', cy: '12.5', r: '3', fill: '#c97a70' }),
          S('circle', { cx: '48', cy: '12.5', r: '5.5', fill: '#f3d8d3', opacity: '0.55' })),
        E('span', { class: 'arch-eyebrow' }, 'WEDDING VENUE'),
        venueBase ? E('strong', { class: 'arch-couple' }, venueBase) : (p1Clean && p2Clean ? E('strong', { class: 'arch-couple' }, p1Clean, E('em', { class: 'arch-heart' }, '♥'), p2Clean) : E('strong', { class: 'arch-couple' }, names || 'Our Story')),
        E('span', { class: 'arch-divider' }),
        E('span', { class: 'arch-meta' }, archMeta),
        E('span', { class: 'arch-date-chip' }, archDate))));

  const overview = guestMode
    ? E('div', { class: 'overview' },
      E('div', {}, E('span', { class: 'small muted' }, 'WEDDING DATE'), E('strong', {}, info.date ? `${formatDate(info.date).replace(/ \S+요일$/, '')}${dday ? ` · ${dday}` : ''}` : '예식 일정 준비 중')),
      E('div', {}, E('span', { class: 'small muted' }, 'WEDDING TIME'), E('strong', {}, info.time ? `${(formatDate(info.date).match(/(\S+요일)$/)?.[1] || '')}${info.date ? ' · ' : ''}${info.time}`.trim() : '예식 시간 준비 중')),
      E('div', {}, E('span', { class: 'small muted' }, 'WEDDING VENUE'), E('strong', {}, info.venue || '예식 장소 준비 중')))
    : null;

  const dashMod = !guestMode ? loadedModules.homeDashboard : null;
  const ctx = moduleCtx();
  const statuses = dashMod
    ? dashMod.homeMenuStatuses(ctx)
    : {
      invitation: info.date ? '예식 일시·장소 안내' : '첫 인사를 준비해요',
      story: `${content.stories.length}개의 이야기`,
      albums: `${content.albums.length}개의 앨범`
    };
  const visibleMenus = guestMode ? menus.filter(([route]) => isGuestVisibleRoute(route)) : menus;

  return [
    hero,
    dashMod ? dashMod.renderHomeSectionNav(ctx) : null,
    dashMod ? dashMod.renderPhaseFocusCard(ctx) : null,
    dashMod ? dashMod.renderJourneyRibbon(ctx, info, dday) : null,
    overview,
    dashMod ? dashMod.renderHomeDashboard(ctx) : null,
    dashMod ? dashMod.renderHomeMasterTimeline(ctx) : null,
    E('section', {},
      E('div', { class: 'section-heading' },
        E('div', {},
          E('h2', { id: 'home-menu-title' }, guestMode ? '예식 안내 바로가기' : '함께 채워 갈 이야기'),
          E('p', {}, guestMode ? '모바일 청첩장과 오시는 길 안내를 확인하실 수 있습니다.' : '필요한 순간에 하나씩, 우리의 속도로.'))),
      E('div', { class: 'menu-grid' }, visibleMenus.map(([route, title, description], index) =>
        E('a', { class: 'menu-card', href: `#/${route}` },
          E('span', { class: 'number' }, String(index + 1).padStart(2, '0')),
          E('h3', {}, title),
          E('p', {}, description),
          E('div', { class: 'card-tail' }, E('span', {}, statuses[route] || ''), E('span', { 'aria-hidden': 'true' }, '↗')))))),
    dashMod ? dashMod.renderHomeChecklist(ctx) : null
  ];
}

async function copyInvitationLink() {
  const url = new URL('./?view=guest#/invitation', location.href).href;
  const msg = guestMode ? '모바일 청첩장 링크를 복사했습니다.' : '공개 청첩장 링크를 복사했습니다. 기기 초안은 공유되지 않습니다.';
  const fallbackNote = guestMode ? '아래 모바일 청첩장 링크를 선택해 복사해 주세요.' : '아래 링크를 선택해 복사해 주세요. 기기 초안은 공유되지 않습니다.';
  try { await navigator.clipboard.writeText(url); flashCopiedButton(); toast(msg); }
  catch {
    const input = E('input', { type: 'text', readonly: true, value: url, 'aria-label': '공개 청첩장 링크' });
    showDialog('청첩장 링크 복사', E('div', {}, E('p', {}, fallbackNote), input));
    input.focus(); input.select();
  }
}
async function shareInvitationLink() {
  const info = content.invitation;
  const url = new URL('./?view=guest#/invitation', location.href).href;
  const names = [info.partner1, info.partner2].filter(Boolean).join(' & ');
  const title = names ? `${names} · 모바일 청첩장` : '우리의 모바일 청첩장';
  const text = [info.date ? formatDate(info.date) : '', info.time || '', info.venue || ''].filter(Boolean).join(' · ');
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (err) { if (err?.name === 'AbortError') return; }
  }
  await copyInvitationLink();
}
async function copyTextToClipboard(text, message = '클립보드에 복사했습니다.', fallbackTitle = '내용 복사', triggerEl = null) {
  return copyText({ text, message, fallbackTitle, triggerEl, showDialog, toast });
}
async function copyVenueAddress(text, label = '예식장 주소') {
  return copyTextToClipboard(text, `${label}를 복사했습니다.`, `${label} 복사`);
}

function syncNavVisibility() {
  for (const link of document.querySelectorAll('.main-nav [data-route]')) {
    const r = link.dataset.route;
    link.hidden = Boolean(guestMode) && !isGuestVisibleRoute(r);
  }
  const sep = document.querySelector('.main-nav .nav-group-sep');
  if (sep) sep.hidden = Boolean(guestMode);
  const dock = $('#planner-bottom-dock');
  if (dock) dock.hidden = Boolean(guestMode);
}
function syncGuestChrome() {
  document.body.classList.toggle('is-guest-mode', Boolean(guestMode));
  const brand = $('.brand');
  const brandText = brand?.querySelector('span:last-child');
  const footerText = $('.site-footer span');
  if (guestMode) {
    const info = content?.invitation || {};
    const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim(), p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
    const label = (p1 && p2) ? `${p1} · ${p2}` : (p1 || p2 || '모바일 청첩장');
    if (brand) { brand.setAttribute('href', '#/invitation'); brand.setAttribute('aria-label', `${label} 모바일 청첩장`); }
    if (brandText) brandText.replaceChildren(label, E('small', {}, 'WEDDING INVITATION'));
    if (footerText) footerText.textContent = '귀한 걸음으로 축복해 주셔서 감사합니다.';
  } else {
    if (brand) { brand.setAttribute('href', '#/home'); brand.setAttribute('aria-label', '우리의 결혼 기록 홈'); }
    if (brandText) brandText.replaceChildren('우리의 결혼 기록', E('small', {}, 'OUR WEDDING DIARY'));
    if (footerText) footerText.textContent = '함께 준비하고, 오래 기억할 우리의 이야기.';
  }
}
function toggleGuestPreview(enable) {
  if (urlGuestMode || !canLeaveEditor()) return;
  closeDialog({ restoreFocus: false });
  guestMode = Boolean(enable);
  if (guestMode) {
    content = structuredClone(baseContent);
    syncMemoryPrefs(loadedModules.preferences?.validatePreferences?.({}) || {});
  } else {
    try { syncDraftFromStorage(); }
    catch { content = structuredClone(baseContent); isDraft = false; draftRevision = baseRevision; syncMemoryPrefs(readRawPrefs()); }
  }
  $('#manage-content').hidden = guestMode;
  syncThemeUi();
  syncNavVisibility();
  render();
  toast(guestMode ? (isDraft ? '하객 화면 미리보기 모드입니다. 공개본만 표시되며 이 기기의 미배포 초안은 제외됩니다.' : '하객 화면 미리보기 모드입니다. 상단 바에서 편집 화면으로 돌아갈 수 있습니다.') : '편집 화면으로 돌아왔습니다.');
}
function renderInvitation() {
  return renderInvitationView(moduleCtx());
}

function sortedStories() {
  return sortStoryRecords(content.stories);
}
function focusTrip(id) {
  if (currentRoute() !== 'honeymoon' || dialog.open) return;
  if (!loadedModules.honeymoon) {
    loadModule('honeymoon').then(() => { if (currentRoute() === 'honeymoon') { render(); setTimeout(() => focusTrip(id), 40); } }).catch(() => {});
    return;
  }
  if (loadedModules.honeymoon?.ensureTripVisible?.(moduleCtx(), id)) render();
  const card = [...main.querySelectorAll('[data-trip-id]')].find(node => node.dataset.tripId === id);
  const target = card?.querySelector('h2') || main.querySelector('.page-header .button') || main;
  if (target.matches('h2')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  const bounds = target.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > innerHeight) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function focusRecord(type, id) {
  if (type === 'honeymoon') { focusTrip(id); return; }
  const route = type === 'stories' ? 'story' : type;
  if (currentRoute() !== route || dialog.open) return;
  const card = [...main.querySelectorAll('[data-record-id]')].find(node => node.dataset.recordId === id);
  const target = card?.querySelector('h2') || main.querySelector('.page-header .button') || main;
  if (target.matches('h2')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  const bounds = target.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > innerHeight) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function displayedRecords(type) {
  const ctx = moduleCtx();
  if (type === 'honeymoon') return loadedModules.honeymoon?.sortedTrips?.(ctx) || content.honeymoon;
  if (type === 'stories') return sortedStories();
  if (type === 'tips') return loadedModules.tips?.filteredTips?.(ctx) || content.tips;
  return content.albums;
}
function recordActions(type, item) {
  if (guestMode) return null;
  const reorder = [];
  if (type === 'albums' && content.albums.length > 1) {
    const index = content.albums.findIndex(album => album.id === item.id);
    const move = async (target, label) => {
      try {
        const next = structuredClone(content);
        [next.albums[index], next.albums[target]] = [next.albums[target], next.albums[index]];
        await setDraft(next); render();
        const card = [...main.querySelectorAll('[data-record-id]')].find(node => node.dataset.recordId === item.id);
        const buttonNode = card && [...card.querySelectorAll('.record-actions button')].find(node => node.textContent === label && !node.disabled);
        (buttonNode || card?.querySelector('h2') || main).focus({ preventScroll: true });
      } catch (error) { toast(error.message, true); }
    };
    const makeCoverAlbum = async () => {
      try {
        const next = structuredClone(content);
        const [picked] = next.albums.splice(index, 1);
        next.albums.unshift(picked);
        await setDraft(next); render();
        toast(`‘${item.title}’을 청첩장 대표 앨범으로 지정했습니다.`);
      } catch (error) { toast(error.message, true); }
    };
    if (index > 0 && item.images?.length) reorder.push(button('⭐ 대표 앨범으로', makeCoverAlbum, 'text-button'));
    const prev = button('앨범 앞으로', () => move(index - 1, '앨범 앞으로'), 'text-button'); prev.disabled = index === 0;
    const next = button('앨범 뒤로', () => move(index + 1, '앨범 뒤로'), 'text-button'); next.disabled = index === content.albums.length - 1;
    reorder.push(prev, next);
  }
  return E('div', { class: 'record-actions' }, ...reorder, button('수정', () => openEditor(type, item), 'text-button'), button('삭제', async () => {
    if (!await confirmAction({ title: '초안 기록 삭제', message: `‘${item.title}’ 기록을 이 기기의 초안에서 삭제할까요?`, confirmLabel: '삭제', danger: true })) return;
    try {
      const ids = displayedRecords(type).map(record => record.id), index = ids.indexOf(item.id);
      const neighbors = [...ids.slice(index + 1), ...ids.slice(0, index).reverse()];
      const next = structuredClone(content); next[type] = next[type].filter(value => value.id !== item.id);
      await setDraft(next); render();
      const remaining = displayedRecords(type);
      focusRecord(type, neighbors.find(id => remaining.some(record => record.id === id)) || remaining[0]?.id);
      const cleaned = (type === 'honeymoon' || type === 'tips') ? await queuePreference(async () => {
        const prefMod = await loadModule('preferences');
        const storedBase = readRawPrefs(), nextPrefs = prefMod.pruneContentPreferences(storedBase, content);
        if (JSON.stringify(nextPrefs) === JSON.stringify(storedBase)) { syncMemoryPrefs(nextPrefs); return true; }
        const saved = await savePrefs(nextPrefs, storedBase);
        if (saved && type === 'honeymoon') loadedModules.honeymoon?.updateTripChoices?.(moduleCtx());
        return saved;
      }) : true;
      if (cleaned) toast('초안에서 삭제했습니다.');
    } catch (error) { toast(error.message, true); }
  }, 'text-button'));
}

function renderStories() {
  return renderStoriesView(moduleCtx());
}

function openPhotos(title, photos, index = 0) {
  photoCleanup?.(); photoCleanup = null;
  const handle = openPhotoViewer({ showDialog, closeDialog }, title, photos, index);
  if (handle) {
    photoNavigation = handle.navigate;
    photoCleanup = handle.cleanup;
  }
}
function renderAlbums() {
  return renderAlbumsView(moduleCtx());
}

function renderLazyRoute(route, guestTitle, guestSubtitle, eyebrow, fnName) {
  if (guestMode) return guestRestrictedView(guestTitle, guestSubtitle, eyebrow);
  const sub = currentSubTab();
  if (sub) applySubTabSelection(route, sub);
  if (loadedModules[route]) return loadedModules[route][fnName](moduleCtx());
  if (moduleErrors[route]) {
    return [pageHeader(guestTitle, guestSubtitle, null, eyebrow),
      empty('화면을 불러오지 못했어요.', moduleErrors[route], '다시 불러오기', () => { delete moduleErrors[route]; render(); }, true)];
  }
  loadModule(route)
    .then(() => { if (currentRoute() === route) render(); })
    .catch(() => { if (currentRoute() === route) render(); });
  return [E('div', { class: 'loading-state' }, '화면을 불러오고 있어요.')];
}
function renderHoneymoon() { return renderLazyRoute('honeymoon', '신혼여행 후보 비교', '신혼여행 후보와 예산 비교는 신랑·신부 전용 준비 탭입니다.', 'HONEYMOON', 'renderHoneymoon'); }
async function loadStudios() {
  studiosStatus = 'loading'; studiosError = '';
  if (content && currentRoute() === 'studios') render();
  try {
    const response = await fetch('./data/studios.json');
    if (!response.ok) throw new Error('스튜디오 자료를 불러오지 못했습니다.');
    const data = await response.json();
    if (!Array.isArray(data) || !data.length || data.some(item => !item.id || !item.contact || !Array.isArray(item.images) || !item.images.length)) throw new Error('스튜디오 자료의 형식을 확인해 주세요.');
    studios = data; studiosStatus = 'ready';
  } catch (error) { studiosStatus = 'error'; studiosError = error.message; }
  if (content && ['home', 'studios'].includes(currentRoute())) render();
}
function renderStudios() { return renderLazyRoute('studios', '라크마 스튜디오 촬영 안내', '웨딩 촬영 일정과 동선·준비물은 신랑·신부 전용 준비 탭입니다.', 'STUDIOS', 'renderStudios'); }
function renderCeremony() { return renderLazyRoute('ceremony', '순천아모르 본식 식순 & 하객·축의금·당일 운영', '본식 식순·하객 명단·축의금 장부와 당일 운영표는 신랑·신부 전용 준비 탭입니다.', 'CEREMONY & VOWS', 'renderCeremony'); }
function renderPrenatal() { return renderLazyRoute('prenatal', '산전검사 & 지원금 안내', '순천 현대여성아동병원 정보와 산전검사 지원금 절차는 신랑·신부 전용 준비 탭입니다.', 'PRENATAL CARE', 'renderPrenatal'); }
function renderTips() { return renderLazyRoute('tips', '결혼에 관한 모든 정보', '결혼 준비 꿀팁·예산·혼수·신혼부부 혜택은 신랑·신부 전용 준비 탭입니다.', 'WEDDING GUIDE', 'renderTips'); }

let revealObserver = null;
function observeInvitationReveal() {
  revealObserver?.disconnect();
  revealObserver = null;
  const targets = [...main.querySelectorAll('.reveal-section')];
  if (!targets.length) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduceMotion || typeof IntersectionObserver === 'undefined') {
    for (const el of targets) el.classList.add('is-revealed');
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        revealObserver?.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -36px 0px', threshold: 0.06 });
  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) {
      el.classList.add('is-revealed');
    } else {
      el.classList.add('will-reveal');
      revealObserver.observe(el);
    }
  }
}
function observeGuestDockSpy() {
  dockSpyObserver?.disconnect();
  dockSpyObserver = null;
  if (!guestMode || typeof IntersectionObserver === 'undefined') return;
  const dock = main.querySelector('.guest-quick-dock');
  if (!dock) return;
  const buttons = [...dock.querySelectorAll('.guest-dock-btn[data-dock-target]')];
  if (!buttons.length) return;
  const sections = buttons.map(b => document.getElementById(b.dataset.dockTarget)).filter(Boolean);
  if (!sections.length) return;
  const setCurrent = targetId => {
    for (const b of buttons) b.classList.toggle('is-current', b.dataset.dockTarget === targetId);
  };
  const visibleMap = new Map();
  dockSpyObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleMap.set(entry.target.id, entry.intersectionRatio);
      else visibleMap.delete(entry.target.id);
    }
    if (visibleMap.size) {
      let bestId = '', bestRatio = -1;
      for (const [id, ratio] of visibleMap) {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      }
      if (bestId) setCurrent(bestId);
    }
  }, { rootMargin: '-18% 0px -48% 0px', threshold: [0, 0.15, 0.4, 0.7] });
  for (const sec of sections) dockSpyObserver.observe(sec);
}
function syncNavScrollCues() {
  const wrap = $('#main-nav-wrap'), nav = wrap?.querySelector('.main-nav');
  const leftBtn = $('#nav-scroll-left'), rightBtn = $('#nav-scroll-right');
  if (!wrap || !nav) return;
  const overflow = nav.scrollWidth - nav.clientWidth;
  const canLeft = overflow > 6 && nav.scrollLeft > 6;
  const canRight = overflow > 6 && nav.scrollLeft < overflow - 6;
  wrap.classList.toggle('can-scroll-left', canLeft);
  wrap.classList.toggle('can-scroll-right', canRight);
  if (leftBtn) leftBtn.hidden = !canLeft;
  if (rightBtn) rightBtn.hidden = !canRight;
}

function render() {
  syncNavVisibility();
  syncGuestChrome();
  const route = currentRoute();
  document.body.dataset.route = route;
  if (route !== 'honeymoon') document.body.classList.remove('has-compare-tray');
  if (route !== 'invitation') { stopInvitationBgm(); clearCountdownSlot(); revealObserver?.disconnect(); revealObserver = null; dockSpyObserver?.disconnect(); dockSpyObserver = null; }
  const renderers = { home: renderHome, invitation: renderInvitation, story: renderStories, albums: renderAlbums, studios: renderStudios, honeymoon: renderHoneymoon, ceremony: renderCeremony, prenatal: renderPrenatal, tips: renderTips };
  const keepView = route === 'honeymoon' && main.dataset.renderedRoute === route;
  const keepTabFocus = Boolean(document.activeElement?.closest?.('#main [role="tablist"]') && document.activeElement.getAttribute('role') === 'tab');
  const opened = keepView ? [...main.querySelectorAll('details[open][data-view-key]')].map(node => node.dataset.viewKey) : [];
  const active = keepView && main.contains(document.activeElement) ? document.activeElement : null;
  const anchor = active?.closest('[data-trip-id]') || (keepView ? [...main.querySelectorAll('[data-trip-id]')].find(node => node.getBoundingClientRect().bottom > 0) : null);
  const anchorId = anchor?.dataset.tripId, anchorTop = anchor?.getBoundingClientRect().top, focusAction = active?.dataset.tripAction;
  const nodes = renderers[route]().filter(node => node !== null && node !== undefined && node !== false);
  if (!urlGuestMode && guestMode) {
    nodes.unshift(E('div', { class: 'guest-preview-bar', role: 'region', 'aria-label': '하객 화면 미리보기 안내' },
      E('span', {}, isDraft ? '👀 하객에게 보이는 공개 화면을 미리 보고 있습니다. (이 기기의 미배포 초안·개인 메모·편집 버튼 숨김)' : '👀 하객에게 보이는 화면을 미리 보고 있습니다. (개인 메모·체크리스트·예산·편집 버튼 숨김)'),
      button('편집 화면으로 돌아가기', () => toggleGuestPreview(false), 'button quiet')));
  }
  main.replaceChildren(...nodes); main.setAttribute('aria-busy', 'false'); main.dataset.renderedRoute = route;
  if (keepTabFocus) main.querySelector('[role="tablist"] [role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  syncLargeTextUi();
  if (route === 'invitation') {
    const cdSlot = main.querySelector('.invitation-live-countdown');
    if (cdSlot) startInvitationCountdown(content.invitation, cdSlot);
    else clearCountdownSlot();
    observeInvitationReveal();
    observeGuestDockSpy();
  }
  if (keepView) {
    for (const node of main.querySelectorAll('details[data-view-key]')) node.open = opened.includes(node.dataset.viewKey);
    const nextAnchor = [...main.querySelectorAll('[data-trip-id]')].find(node => node.dataset.tripId === anchorId);
    if (focusAction) nextAnchor?.querySelector(`[data-trip-action="${focusAction}"]`)?.focus({ preventScroll: true });
    if (nextAnchor) window.scrollBy(0, nextAnchor.getBoundingClientRect().top - anchorTop);
  }
  for (const navAnchor of document.querySelectorAll('[data-route]')) {
    if (navAnchor.dataset.route === route) navAnchor.setAttribute('aria-current', 'page'); else navAnchor.removeAttribute('aria-current');
  }
  const dockRoutes = new Set(['home', 'ceremony', 'honeymoon', 'tips']);
  for (const dockAnchor of document.querySelectorAll('#planner-bottom-dock [data-dock-route]')) {
    const activeDock = dockAnchor.dataset.dockRoute === route;
    dockAnchor.classList.toggle('is-active', activeDock);
    if (activeDock) dockAnchor.setAttribute('aria-current', 'page');
    else dockAnchor.removeAttribute('aria-current');
  }
  const dockMoreBtn = $('#planner-dock-more');
  if (dockMoreBtn) dockMoreBtn.classList.toggle('is-active', !guestMode && !dockRoutes.has(route));
  const navBar = document.querySelector('.main-nav'), activeNav = navBar?.querySelector('[aria-current="page"]');
  if (navBar && activeNav && navBar.scrollWidth > navBar.clientWidth) {
    navBar.scrollLeft = Math.max(0, activeNav.offsetLeft - (navBar.clientWidth - activeNav.offsetWidth) / 2);
  }
  syncNavScrollCues();
  syncUnsyncedIndicator();
  const invInfo = content?.invitation || {};
  const coupleTitle = [invInfo.partner1?.replace(/^신랑\s*/, '').trim(), invInfo.partner2?.replace(/^신부\s*/, '').trim()].filter(Boolean).join(' & ');
  const baseTitle = guestMode ? (coupleTitle ? `${coupleTitle} · 모바일 청첩장` : '모바일 청첩장') : (coupleTitle ? `${coupleTitle} · 우리의 결혼 기록` : '우리의 결혼 기록');
  const routeTitle = menus.find(m => m[0] === route)?.[1] || '';
  document.title = guestMode
    ? (route === 'home' || route === 'invitation' || !isGuestVisibleRoute(route) ? baseTitle : `${routeTitle} · ${baseTitle}`)
    : (route === 'home' ? baseTitle : `${routeTitle} · ${baseTitle}`);
  $('#draft-banner').hidden = !isDraft || guestMode;
  $('#draft-banner span').textContent = draftRevision !== baseRevision ? '공개본이 변경되었거나 초안의 기준 버전을 확인할 수 없습니다. 초안을 백업하고 새 공개본을 확인해 주세요.' : '이 기기에 저장한 초안을 보고 있어요. 공개 사이트에는 아직 반영되지 않았습니다.';
}

function showDialog(title, body) {
  if (!canLeaveEditor()) return false;
  if (!dialog.open) {
    const activeEl = document.activeElement;
    lastDialogTrigger = (activeEl instanceof HTMLElement && activeEl !== document.body && !dialog.contains(activeEl))
      ? activeEl
      : (lastActivatedControl?.isConnected && !dialog.contains(lastActivatedControl) ? lastActivatedControl : null);
  }
  photoCleanup?.(); photoCleanup = null;
  conflictReview?.release?.(); editorState = null; conflictReview = null; photoNavigation = null;
  $('#dialog-notice').hidden = true;
  $('#editor-title').textContent = title;
  editor.replaceChildren(body);
  const actionSlot = $('#dialog-actions'); actionSlot.replaceChildren();
  const actions = body.matches('form') ? body.querySelector('.form-actions') : null;
  if (actions) { body.id = 'active-editor-form'; for (const submit of actions.querySelectorAll('[type="submit"]')) submit.setAttribute('form', body.id); actionSlot.append(actions); }
  actionSlot.hidden = !actions;
  if (!dialog.open) dialog.showModal();
  editor.scrollTop = 0; $('#editor-title').focus();
  return true;
}
async function openEditor(type, item = null) {
  if (guestMode) return;
  try {
    const mod = await loadModule('editor');
    return mod.openEditor(moduleCtx(), type, item);
  } catch (error) {
    toast(error.message || '편집기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
  }
}

function syncDraftFromStorage() {
  const saved = readStorage(DRAFT_KEY);
  content = saved ? parseContent(saved) : structuredClone(baseContent);
  isDraft = Boolean(saved);
  draftRevision = saved ? JSON.parse(saved).baseRevision ?? null : baseRevision;
  syncMemoryPrefs();
}

const mobileMenuBtn = $('#mobile-menu-btn');
const plannerDockMore = $('#planner-dock-more');
const mobileMenuSheet = $('#mobile-menu-sheet');
const mobileMenuBackdrop = $('#mobile-menu-backdrop');
const mobileMenuList = $('#mobile-menu-list');
const mobileMenuClose = $('#mobile-menu-close');
function renderMobileMenuSheet() {
  if (!mobileMenuList) return;
  const route = currentRoute();
  const entries = [['home', '홈', guestMode ? '예식 안내 첫 화면' : '결혼 준비 한눈에 보기'], ...menus.map(([r, t, d]) => [r, t, d])];
  const statuses = (!guestMode && content && loadedModules.homeDashboard)
    ? { home: weddingDday(content.invitation?.date) || '', ...loadedModules.homeDashboard.homeMenuStatuses(moduleCtx()) }
    : {};
  const buildTile = ([r, title, desc]) => {
    const statusText = statuses[r] || '';
    const item = E('a', {
      class: 'mobile-menu-tile' + (r === route ? ' is-active' : ''),
      href: `#/${r}`,
      'data-mobile-route': r
    },
      E('span', { class: 'mobile-menu-icon', 'aria-hidden': 'true' }, MENU_ICONS[r] || '•'),
      E('span', { class: 'mobile-menu-copy' },
        E('span', { class: 'mobile-menu-title-row' },
          E('strong', {}, title),
          statusText ? E('span', { class: 'mobile-menu-status' }, statusText) : null),
        E('span', { class: 'small muted' }, desc)));
    if (r === route) item.setAttribute('aria-current', 'page');
    item.addEventListener('click', () => closeMobileMenu(false));
    return item;
  };
  if (guestMode) {
    const visible = entries.filter(([r]) => isGuestVisibleRoute(r));
    mobileMenuList.replaceChildren(...visible.map(buildTile));
    return;
  }
  const publicRoutes = new Set(['home', 'invitation', 'story', 'albums']);
  const publicEntries = entries.filter(([r]) => publicRoutes.has(r));
  const planningEntries = entries.filter(([r]) => !publicRoutes.has(r));
  mobileMenuList.replaceChildren(
    E('p', { class: 'mobile-menu-group-title' }, '💌 하객 공유 · 추억'),
    ...publicEntries.map(buildTile),
    E('p', { class: 'mobile-menu-group-title' }, '📋 결혼 준비 실무'),
    ...planningEntries.map(buildTile)
  );
}
function openMobileMenu() {
  if (!mobileMenuSheet || !mobileMenuBackdrop) return;
  renderMobileMenuSheet();
  mobileMenuBackdrop.hidden = false;
  mobileMenuSheet.hidden = false;
  mobileMenuBtn?.setAttribute('aria-expanded', 'true');
  plannerDockMore?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('is-mobile-menu-open');
  $('#mobile-menu-title')?.focus({ preventScroll: true });
}
function closeMobileMenu(restoreFocus = false) {
  if (!mobileMenuSheet || mobileMenuSheet.hidden) return;
  mobileMenuSheet.hidden = true;
  if (mobileMenuBackdrop) mobileMenuBackdrop.hidden = true;
  mobileMenuBtn?.setAttribute('aria-expanded', 'false');
  plannerDockMore?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-mobile-menu-open');
  if (restoreFocus) mobileMenuBtn?.focus({ preventScroll: true });
}

mobileMenuBtn?.addEventListener('click', () => {
  if (mobileMenuSheet?.hidden) openMobileMenu();
  else closeMobileMenu(true);
});
plannerDockMore?.addEventListener('click', () => {
  if (mobileMenuSheet?.hidden) openMobileMenu();
  else closeMobileMenu(false);
});
mobileMenuClose?.addEventListener('click', () => closeMobileMenu(true));
mobileMenuBackdrop?.addEventListener('click', () => closeMobileMenu(true));
async function openGlobalSearch() {
  if (guestMode || !content) return;
  try {
    const mod = await loadModule('search');
    mod.openGlobalSearchModal(moduleCtx());
  } catch (error) {
    toast(error.message || '빠른 검색 창을 열지 못했습니다.', true);
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobileMenuSheet && !mobileMenuSheet.hidden) {
    event.preventDefault();
    closeMobileMenu(true);
    return;
  }
  if (guestMode || !content || dialog.open) return;
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const inEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(document.activeElement?.isContentEditable);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openGlobalSearch();
  } else if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !inEditable) {
    event.preventDefault();
    openGlobalSearch();
  }
});

$('#close-dialog').addEventListener('click', requestClose);
dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
dialog.addEventListener('close', unloadDialogMedia);
dialog.addEventListener('keydown', event => photoNavigation?.(event));
$('#manage-content').addEventListener('click', () => content && openManager());
$('#manage-draft').addEventListener('click', () => content && openManager());
$('#global-search-btn')?.addEventListener('click', openGlobalSearch);
$('#theme-toggle-btn')?.addEventListener('click', toggleThemeMode);

document.addEventListener('click', event => {
  if (!dialog.open) {
    const control = event.target?.closest?.('button, a, summary, [tabindex]');
    if (control instanceof HTMLElement) lastActivatedControl = control;
  }
  const anchor = event.target.closest('a[href]');
  if (anchor?.matches('.skip-link[href="#main"]')) {
    event.preventDefault();
    if (!dialog.open) { main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    return;
  }
  const opensElsewhere = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || anchor?.target.toLowerCase() === '_blank';
  if (anchor && dirtyEditor() && !opensElsewhere && !anchor.hasAttribute('download')) {
    if (!canLeaveEditor()) { event.preventDefault(); event.stopImmediatePropagation(); } else closeDialog({ restoreFocus: false });
  }
}, true);

window.addEventListener('beforeunload', event => { if (dirtyEditor() || pendingWrites || pendingWriteTasks.size) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('hashchange', () => {
  closeMobileMenu(false);
  if (!content || location.hash === '#main') return;
  if (!canLeaveEditor()) { history.replaceState(null, '', location.pathname + location.search + previousHash); return; }
  const prevTopRoute = previousHash.replace(/^#\/?/, '').split('/')[0] || '';
  const nextTopRoute = currentRoute();
  previousHash = location.hash;
  closeDialog({ restoreFocus: false });
  render();
  if (prevTopRoute !== nextTopRoute) window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('storage', event => {
  if (guestMode || !content || ![DRAFT_KEY, PREF_KEY, null].includes(event.key)) return;
  if (conflictReview && dialog.open) { if (event.key === conflictReview.key || event.key === null) conflictReview.refresh(); return; }
  if (dialog.open || document.activeElement?.matches('textarea')) {
    toast('다른 탭의 저장 내용이 변경되었습니다. 현재 입력은 유지하며 저장할 때 변경 내용을 확인합니다.'); return;
  }
  try {
    const prefMod = loadedModules.preferences;
    syncDraftFromStorage();
    if (prefMod) syncMemoryPrefs(prefMod.validatePreferences(JSON.parse(localStorage.getItem(PREF_KEY) || '{}')));
    render();
    toast('다른 탭의 저장 내용을 반영했습니다.');
  } catch (error) { toast('다른 탭의 내용을 읽지 못했습니다. 기존 화면을 유지합니다. ' + error.message, true); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopInvitationBgm();
    stopInvitationCountdown();
  } else if (content) {
    resumeCountdownIfVisible(content.invitation);
  }
});
window.addEventListener('pagehide', () => { stopInvitationBgm(); stopInvitationCountdown(); });

const scrollTopBtn = $('#scroll-top-btn');
const syncScrollUi = () => {
  document.body.classList.toggle('is-scrolled', window.scrollY > 36);
  if (scrollTopBtn) scrollTopBtn.hidden = window.scrollY < 420;
};
window.addEventListener('scroll', syncScrollUi, { passive: true });
if (scrollTopBtn) scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
syncScrollUi();

const navEl = document.querySelector('.main-nav');
if (navEl) {
  navEl.addEventListener('scroll', syncNavScrollCues, { passive: true });
  window.addEventListener('resize', syncNavScrollCues, { passive: true });
  $('#nav-scroll-left')?.addEventListener('click', () => navEl.scrollBy({ left: -180, behavior: 'smooth' }));
  $('#nav-scroll-right')?.addEventListener('click', () => navEl.scrollBy({ left: 180, behavior: 'smooth' }));
}

function syncOfflineBanner() {
  const banner = $('#offline-banner');
  if (!banner) return;
  banner.hidden = navigator.onLine !== false;
}
window.addEventListener('online', () => { syncOfflineBanner(); toast('네트워크 연결이 복구되었습니다.'); });
window.addEventListener('offline', syncOfflineBanner);
syncOfflineBanner();

function showUpdateBanner(worker) {
  waitingSw = worker;
  const banner = $('#update-banner');
  if (banner) banner.hidden = false;
}
$('#apply-update')?.addEventListener('click', () => {
  if (waitingSw) waitingSw.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
});
$('#dismiss-update')?.addEventListener('click', () => {
  const banner = $('#update-banner');
  if (banner) banner.hidden = true;
});

function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js?v=wedding-features-69')
    .then(reg => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(installing);
          }
        });
      });
      if (!urlGuestMode) {
        navigator.serviceWorker.ready
          .then(readyReg => readyReg.active?.postMessage({ type: 'WARM_PLANNER_CACHE' }))
          .catch(() => {});
      }
    })
    .catch(() => {});
}

async function fetchInitialSiteText() {
  if (urlGuestMode) {
    const guestRes = await fetch('./data/guest-site.json');
    if (guestRes.ok) return guestRes.text();
    if (guestRes.status !== 404) throw new Error('콘텐츠 파일을 불러오지 못했습니다.');
  }
  const siteResponse = await fetch('./data/site.json');
  if (!siteResponse.ok) throw new Error('콘텐츠 파일을 불러오지 못했습니다.');
  return siteResponse.text();
}

async function init() {
  try {
    pwaInstall = initPwaInstall({ btn: $('#pwa-install-btn'), isGuestMode: () => guestMode, toast, showDialog });
    syncLargeTextUi();
    syncThemeUi();
    if (!urlGuestMode) void loadStudios();
    const [siteText, prefMod] = await Promise.all([
      fetchInitialSiteText(),
      urlGuestMode ? Promise.resolve(null) : Promise.all([loadModule('preferences'), loadModule('storage'), loadModule('homeDashboard')]).then(([p]) => p)
    ]);
    baseContent = parseContent(siteText);
    baseRevision = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(baseContent))))).map(value => value.toString(16).padStart(2, '0')).join('');
    content = structuredClone(baseContent);
    let notice = '';
    const saved = readStorage(DRAFT_KEY);
    if (saved && !guestMode) {
      try { content = parseContent(saved); draftRevision = JSON.parse(saved).baseRevision ?? null; isDraft = true; }
      catch { notice = '저장된 초안을 읽지 못해 공개본을 표시합니다. 기존 초안은 지우지 않았습니다.'; }
    }
    if (prefMod) {
      try { syncMemoryPrefs(prefMod.validatePreferences(guestMode ? {} : JSON.parse(readStorage(PREF_KEY) || '{}'))); }
      catch { prefs = prefMod.validatePreferences({}); notice = '개인 설정을 읽지 못했습니다. 기존 저장 데이터는 지우지 않았습니다.'; }
    } else {
      prefs = {};
    }
    $('#manage-content').hidden = guestMode;
    syncThemeUi();
    syncNavVisibility();
    render();
    if (notice) toast(notice, true);
    registerAppServiceWorker();
  } catch (error) {
    main.setAttribute('aria-busy', 'false');
    main.replaceChildren(empty('기록을 불러오지 못했어요.', error.message, '다시 불러오기', () => location.reload(), true));
  }
}
init();
