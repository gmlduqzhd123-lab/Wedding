import { invitationLiveCountdown } from './content.js?v=wedding-features-69';
import { $, E } from './dom.js?v=wedding-features-69';

const LARGE_TEXT_KEY = 'wedding:v1:largeText';
const THEME_KEY = 'wedding:v1:theme';
const PETALS_KEY = 'wedding:v1:petals';

export function createShellEffects({ main, getGuestMode, currentRoute, toast, getPwaInstall }) {
  let largeTextMode = (() => {
    try { return sessionStorage.getItem(LARGE_TEXT_KEY) === '1'; } catch { return false; }
  })();
  let darkTheme = (() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {}
    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
  })();
  let petalsEnabled = (() => {
    try {
      const saved = sessionStorage.getItem(PETALS_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch {}
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  })();
  let countdownTimer = null;
  let activeCountdownSlot = null;

  function syncLargeTextUi() {
    document.body.classList.toggle('is-large-text', largeTextMode);
    const btn = document.querySelector('.invitation-text-btn:not(.invitation-petals-btn)');
    if (btn) {
      btn.textContent = largeTextMode ? '가- 보통' : '가+ 크게';
      btn.setAttribute('aria-pressed', String(largeTextMode));
      btn.classList.toggle('is-active', largeTextMode);
    }
    const dockBtn = document.querySelector('.guest-dock-text-btn');
    if (dockBtn) {
      dockBtn.textContent = largeTextMode ? '가- 보통' : '🔍 크게';
      dockBtn.setAttribute('aria-pressed', String(largeTextMode));
      dockBtn.classList.toggle('is-active', largeTextMode);
    }
  }

  function toggleLargeTextMode() {
    largeTextMode = !largeTextMode;
    try { sessionStorage.setItem(LARGE_TEXT_KEY, largeTextMode ? '1' : '0'); } catch {}
    syncLargeTextUi();
    toast(largeTextMode ? '청첩장 글씨를 크게 표시합니다.' : '청첩장 글씨를 기본 크기로 돌렸습니다.');
  }

  function renderLargeTextButton() {
    return E('button', {
      type: 'button',
      class: 'invitation-text-btn' + (largeTextMode ? ' is-active' : ''),
      'aria-pressed': String(largeTextMode),
      'aria-label': '청첩장 글씨 크기 크게 보기 전환',
      onclick: toggleLargeTextMode
    }, largeTextMode ? '가- 보통' : '가+ 크게');
  }

  function syncThemeUi() {
    const guest = Boolean(getGuestMode());
    const isDarkActive = !guest && darkTheme;
    document.documentElement.classList.toggle('is-dark-theme', isDarkActive);
    document.body.classList.toggle('is-dark-theme', isDarkActive);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isDarkActive ? '#141916' : '#faf9f5');
    const themeBtn = $('#theme-toggle-btn');
    if (themeBtn) {
      themeBtn.hidden = guest;
      themeBtn.setAttribute('aria-pressed', String(isDarkActive));
      themeBtn.textContent = isDarkActive ? '☀️' : '🌙';
      themeBtn.setAttribute('aria-label', isDarkActive ? '주간 라이트 테마로 전환' : '야간 다크 테마 전환');
      themeBtn.title = isDarkActive ? '주간 라이트 테마로 전환' : '야간 다크 테마 전환';
    }
    const searchBtn = $('#global-search-btn');
    if (searchBtn) searchBtn.hidden = guest;
    getPwaInstall?.()?.sync();
  }

  function toggleThemeMode() {
    if (getGuestMode()) return;
    darkTheme = !darkTheme;
    try { localStorage.setItem(THEME_KEY, darkTheme ? 'dark' : 'light'); } catch {}
    syncThemeUi();
    toast(darkTheme ? '🌙 야간 다크 보태니컬 테마로 전환했습니다. (하객 청첩장은 항상 밝은 화지 톤 유지)' : '☀️ 주간 라이트 보태니컬 테마로 전환했습니다.');
  }

  window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', event => {
    try { if (localStorage.getItem(THEME_KEY)) return; } catch {}
    darkTheme = Boolean(event.matches);
    syncThemeUi();
  });

  function syncPetalsUi() {
    const layer = main.querySelector('.invitation-petals-layer');
    if (layer) layer.hidden = !petalsEnabled;
    const btn = main.querySelector('.invitation-petals-btn');
    if (btn) {
      btn.textContent = petalsEnabled ? '🌸 끄기' : '🌸 꽃잎';
      btn.setAttribute('aria-pressed', String(petalsEnabled));
      btn.classList.toggle('is-active', petalsEnabled);
    }
  }

  function togglePetalsMode() {
    petalsEnabled = !petalsEnabled;
    try { sessionStorage.setItem(PETALS_KEY, petalsEnabled ? '1' : '0'); } catch {}
    syncPetalsUi();
    toast(petalsEnabled ? '🌸 청첩장 꽃잎 효과를 켰습니다.' : '꽃잎 효과를 잠시 껐습니다.');
  }

  function renderPetalsButton() {
    return E('button', {
      type: 'button',
      class: 'invitation-text-btn invitation-petals-btn' + (petalsEnabled ? ' is-active' : ''),
      'aria-pressed': String(petalsEnabled),
      'aria-label': '청첩장 떨어지는 꽃잎 효과 전환',
      onclick: togglePetalsMode
    }, petalsEnabled ? '🌸 끄기' : '🌸 꽃잎');
  }

  function renderInvitationPetalsLayer() {
    const configs = [
      [6, 0.0, 9.6, 12], [15, 2.2, 11.2, 10], [24, 4.1, 10.4, 14], [34, 1.3, 12.1, 11],
      [43, 5.4, 9.8, 13], [52, 0.7, 11.6, 10], [61, 3.3, 10.7, 12], [70, 6.2, 12.4, 11],
      [79, 1.9, 9.9, 14], [87, 4.7, 11.1, 10], [93, 2.8, 10.6, 12], [29, 7.1, 11.8, 11]
    ];
    const layer = E('div', { class: 'invitation-petals-layer', 'aria-hidden': 'true' },
      configs.map(([left, delay, dur, size], i) => E('span', {
        class: 'inv-petal' + (i % 3 === 0 ? ' is-leaf' : i % 3 === 1 ? ' is-blush' : ' is-cream'),
        style: `--p-left:${left}%;--p-delay:-${delay}s;--p-dur:${dur}s;--p-size:${size}px`
      })));
    layer.hidden = !petalsEnabled;
    return layer;
  }

  function stopInvitationCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function clearCountdownSlot() {
    stopInvitationCountdown();
    activeCountdownSlot = null;
  }

  function paintLiveCountdown(info, slot) {
    if (!slot || !slot.isConnected) return false;
    const cd = invitationLiveCountdown(info.date, info.time);
    if (!cd) { slot.replaceChildren(); return false; }
    const pad = n => String(n).padStart(2, '0');
    if (cd.status === 'future') {
      slot.replaceChildren(
        E('div', { class: 'countdown-unit' }, E('strong', { class: 'countdown-num' }, String(cd.days)), E('span', { class: 'countdown-unit-label' }, 'DAYS')),
        E('span', { class: 'countdown-sep', 'aria-hidden': 'true' }, ':'),
        E('div', { class: 'countdown-unit' }, E('strong', { class: 'countdown-num' }, pad(cd.hours)), E('span', { class: 'countdown-unit-label' }, 'HOURS')),
        E('span', { class: 'countdown-sep', 'aria-hidden': 'true' }, ':'),
        E('div', { class: 'countdown-unit' }, E('strong', { class: 'countdown-num' }, pad(cd.minutes)), E('span', { class: 'countdown-unit-label' }, 'MIN')),
        E('span', { class: 'countdown-sep', 'aria-hidden': 'true' }, ':'),
        E('div', { class: 'countdown-unit' }, E('strong', { class: 'countdown-num' }, pad(cd.seconds)), E('span', { class: 'countdown-unit-label' }, 'SEC')));
      return true;
    }
    const msg = cd.status === 'ongoing' ? '✨ 오늘 예식이 진행 중입니다. 귀한 걸음 감사드립니다.' : '✨ 소중한 축복 속에 예식을 마쳤습니다. 감사합니다.';
    slot.replaceChildren(E('p', { class: 'countdown-status-banner' }, msg));
    return false;
  }

  function startInvitationCountdown(info, slot) {
    stopInvitationCountdown();
    activeCountdownSlot = slot;
    if (!slot || !info?.date) return;
    const keepTicking = paintLiveCountdown(info, slot);
    if (!keepTicking || document.hidden) return;
    countdownTimer = setInterval(() => {
      if (document.hidden || currentRoute() !== 'invitation' || !slot.isConnected) {
        stopInvitationCountdown();
        return;
      }
      if (!paintLiveCountdown(info, slot)) stopInvitationCountdown();
    }, 1000);
  }

  function resumeCountdownIfVisible(info) {
    if (info && currentRoute() === 'invitation' && activeCountdownSlot?.isConnected) {
      startInvitationCountdown(info, activeCountdownSlot);
    }
  }

  return {
    isLargeTextMode: () => largeTextMode,
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
  };
}
