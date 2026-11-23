import { E } from './dom.js?v=wedding-features-53';

let bgmCtx = null, bgmMaster = null, bgmTimer = null, bgmStep = 0, bgmPlaying = false;
const BGM_CHORDS = [
  [293.66, 369.99, 440.00, 587.33],
  [220.00, 329.63, 440.00, 554.37],
  [246.94, 369.99, 493.88, 587.33],
  [185.00, 277.18, 369.99, 440.00],
  [196.00, 293.66, 392.00, 493.88],
  [293.66, 369.99, 440.00, 587.33],
  [196.00, 293.66, 392.00, 493.88],
  [220.00, 329.63, 392.00, 493.88]
];

export const isBgmPlaying = () => bgmPlaying;

export function syncBgmButtonUi() {
  const btn = document.querySelector('.invitation-bgm-btn');
  if (!btn) return;
  btn.textContent = bgmPlaying ? '⏸ 음악 끄기' : '🎵 배경음악';
  btn.setAttribute('aria-pressed', String(bgmPlaying));
  btn.classList.toggle('is-playing', bgmPlaying);
}

export function stopInvitationBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  bgmPlaying = false;
  if (bgmMaster && bgmCtx) {
    try {
      const now = bgmCtx.currentTime;
      bgmMaster.gain.cancelScheduledValues(now);
      bgmMaster.gain.setValueAtTime(bgmMaster.gain.value, now);
      bgmMaster.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    } catch {}
  }
  syncBgmButtonUi();
}

function playBgmNote(freq, delaySec = 0) {
  if (!bgmCtx || !bgmMaster || !bgmPlaying) return;
  const now = bgmCtx.currentTime + delaySec;
  const osc = bgmCtx.createOscillator();
  const harmonic = bgmCtx.createOscillator();
  const filter = bgmCtx.createBiquadFilter();
  const env = bgmCtx.createGain();
  osc.type = 'sine';
  harmonic.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  harmonic.frequency.setValueAtTime(freq * 2, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1350, now);
  const hGain = bgmCtx.createGain();
  hGain.gain.setValueAtTime(0.09, now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.24, now + 0.055);
  env.gain.exponentialRampToValueAtTime(0.0008, now + 2.25);
  osc.connect(filter);
  harmonic.connect(hGain);
  hGain.connect(filter);
  filter.connect(env);
  env.connect(bgmMaster);
  osc.start(now);
  harmonic.start(now);
  osc.stop(now + 2.35);
  harmonic.stop(now + 2.35);
}

export async function toggleInvitationBgm(notify = () => {}) {
  if (bgmPlaying) { stopInvitationBgm(); notify('배경음악을 껐습니다.'); return; }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) { notify('이 브라우저에서는 배경음악 재생을 지원하지 않습니다.', true); return; }
  try {
    if (!bgmCtx) {
      bgmCtx = new Ctor();
      bgmMaster = bgmCtx.createGain();
      bgmMaster.gain.setValueAtTime(0.0001, bgmCtx.currentTime);
      bgmMaster.connect(bgmCtx.destination);
    }
    if (bgmCtx.state === 'suspended') await bgmCtx.resume();
    bgmPlaying = true;
    const now = bgmCtx.currentTime;
    bgmMaster.gain.cancelScheduledValues(now);
    bgmMaster.gain.setValueAtTime(0.0001, now);
    bgmMaster.gain.linearRampToValueAtTime(0.15, now + 0.4);
    const tick = () => {
      if (!bgmPlaying) return;
      const chord = BGM_CHORDS[Math.floor(bgmStep / 4) % BGM_CHORDS.length];
      const freq = chord[bgmStep % 4];
      playBgmNote(freq, 0);
      if (bgmStep % 4 === 0) playBgmNote(chord[0] / 2, 0);
      bgmStep++;
    };
    tick();
    bgmTimer = setInterval(tick, 760);
    syncBgmButtonUi();
    notify('잔잔한 배경음악을 재생합니다.');
  } catch {
    stopInvitationBgm();
    notify('배경음악을 시작하지 못했습니다. 다시 눌러 주세요.', true);
  }
}

export function renderInvitationBgmButton(notify) {
  return E('button', {
    type: 'button',
    class: 'invitation-bgm-btn' + (bgmPlaying ? ' is-playing' : ''),
    'aria-pressed': String(bgmPlaying),
    'aria-label': '청첩장 배경음악 재생 또는 정지',
    onclick: () => toggleInvitationBgm(notify)
  }, bgmPlaying ? '⏸ 음악 끄기' : '🎵 배경음악');
}
