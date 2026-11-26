import { E } from './dom.js?v=wedding-features-60';

export const BGM_PRESETS = [
  {
    id: 'canon',
    label: '클래식 캐논',
    shortLabel: '캐논',
    tempoMs: 760,
    wave: 'sine',
    harmonicWave: 'triangle',
    harmonicGain: 0.09,
    filterHz: 1350,
    decaySec: 2.25,
    chords: [
      [293.66, 369.99, 440.00, 587.33],
      [220.00, 329.63, 440.00, 554.37],
      [246.94, 369.99, 493.88, 587.33],
      [185.00, 277.18, 369.99, 440.00],
      [196.00, 293.66, 392.00, 493.88],
      [293.66, 369.99, 440.00, 587.33],
      [196.00, 293.66, 392.00, 493.88],
      [220.00, 329.63, 392.00, 493.88]
    ]
  },
  {
    id: 'musicbox',
    label: '따뜻한 오르골',
    shortLabel: '오르골',
    tempoMs: 560,
    wave: 'sine',
    harmonicWave: 'sine',
    harmonicGain: 0.16,
    filterHz: 2600,
    decaySec: 1.55,
    chords: [
      [523.25, 659.25, 783.99, 1046.50],
      [440.00, 523.25, 659.25, 880.00],
      [349.23, 440.00, 523.25, 698.46],
      [392.00, 493.88, 587.33, 783.99],
      [523.25, 659.25, 783.99, 987.77],
      [392.00, 493.88, 659.25, 783.99]
    ]
  },
  {
    id: 'waltz',
    label: '초여름 왈츠',
    shortLabel: '6월 왈츠',
    tempoMs: 620,
    wave: 'triangle',
    harmonicWave: 'sine',
    harmonicGain: 0.08,
    filterHz: 1180,
    decaySec: 1.95,
    chords: [
      [261.63, 329.63, 392.00],
      [329.63, 392.00, 493.88],
      [220.00, 261.63, 329.63],
      [174.61, 220.00, 261.63],
      [196.00, 246.94, 293.66],
      [261.63, 329.63, 392.00]
    ]
  }
];

const BGM_VOLUME_LEVELS = [
  { id: 'soft', label: '작게', gain: 0.08, icon: '🔈' },
  { id: 'medium', label: '보통', gain: 0.15, icon: '🔉' },
  { id: 'full', label: '풍성하게', gain: 0.24, icon: '🔊' }
];

let bgmCtx = null, bgmMaster = null, bgmTimer = null, bgmStep = 0, bgmPlaying = false;
let bgmPresetId = 'canon';
let bgmVolumeIdx = 1;

export const isBgmPlaying = () => bgmPlaying;
export const getBgmPreset = () => BGM_PRESETS.find(p => p.id === bgmPresetId) || BGM_PRESETS[0];
export const getBgmVolume = () => BGM_VOLUME_LEVELS[bgmVolumeIdx] || BGM_VOLUME_LEVELS[1];

export function syncBgmButtonUi() {
  const btn = document.querySelector('.invitation-bgm-btn');
  if (btn) {
    btn.textContent = bgmPlaying ? '⏸ 음악 끄기' : '🎵 배경음악';
    btn.setAttribute('aria-pressed', String(bgmPlaying));
    btn.classList.toggle('is-playing', bgmPlaying);
  }
  const preset = getBgmPreset();
  const presetBtn = document.querySelector('.invitation-bgm-preset-btn');
  if (presetBtn) {
    presetBtn.hidden = !bgmPlaying;
    presetBtn.textContent = `🎼 ${preset.shortLabel} ↻`;
    presetBtn.setAttribute('aria-label', `배경음악 분위기 전환 (현재: ${preset.label})`);
    presetBtn.title = `배경음악 곡 변경 · 현재: ${preset.label}`;
  }
  const vol = getBgmVolume();
  const volBtn = document.querySelector('.invitation-bgm-vol-btn');
  if (volBtn) {
    volBtn.hidden = !bgmPlaying;
    volBtn.textContent = vol.icon;
    volBtn.setAttribute('aria-label', `배경음악 음량 조절 (현재: ${vol.label})`);
    volBtn.title = `음량: ${vol.label} (누르면 변경)`;
  }
}

function scheduleBgmLoop() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  if (!bgmPlaying) return;
  const preset = getBgmPreset();
  const tick = () => {
    if (!bgmPlaying) return;
    const p = getBgmPreset();
    const chordLen = p.chords[0].length;
    const chord = p.chords[Math.floor(bgmStep / chordLen) % p.chords.length];
    const freq = chord[bgmStep % chordLen];
    playBgmNote(freq, 0, p);
    if (bgmStep % chordLen === 0) playBgmNote(chord[0] / 2, 0, p);
    bgmStep++;
  };
  tick();
  bgmTimer = setInterval(tick, preset.tempoMs);
}

export function setBgmPreset(presetId, notify = () => {}) {
  const found = BGM_PRESETS.find(p => p.id === presetId);
  if (!found) return false;
  bgmPresetId = found.id;
  bgmStep = 0;
  if (bgmPlaying) scheduleBgmLoop();
  syncBgmButtonUi();
  notify(`배경음악 분위기를 ‘${found.label}’(으)로 바꿨습니다.`);
  return true;
}

export function cycleBgmPreset(notify = () => {}) {
  const idx = BGM_PRESETS.findIndex(p => p.id === bgmPresetId);
  const next = BGM_PRESETS[(idx + 1) % BGM_PRESETS.length];
  return setBgmPreset(next.id, notify);
}

export function setBgmVolume(idx, notify = () => {}) {
  bgmVolumeIdx = ((Number(idx) || 0) % BGM_VOLUME_LEVELS.length + BGM_VOLUME_LEVELS.length) % BGM_VOLUME_LEVELS.length;
  const vol = getBgmVolume();
  if (bgmMaster && bgmCtx && bgmPlaying) {
    try {
      const now = bgmCtx.currentTime;
      bgmMaster.gain.cancelScheduledValues(now);
      bgmMaster.gain.setValueAtTime(bgmMaster.gain.value, now);
      bgmMaster.gain.linearRampToValueAtTime(vol.gain, now + 0.18);
    } catch {}
  }
  syncBgmButtonUi();
  notify(`배경음악 음량을 ‘${vol.label}’(으)로 조절했습니다.`);
  return vol;
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

function playBgmNote(freq, delaySec = 0, preset = getBgmPreset()) {
  if (!bgmCtx || !bgmMaster || !bgmPlaying) return;
  const now = bgmCtx.currentTime + delaySec;
  const osc = bgmCtx.createOscillator();
  const harmonic = bgmCtx.createOscillator();
  const filter = bgmCtx.createBiquadFilter();
  const env = bgmCtx.createGain();
  osc.type = preset.wave;
  harmonic.type = preset.harmonicWave;
  osc.frequency.setValueAtTime(freq, now);
  harmonic.frequency.setValueAtTime(freq * 2, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(preset.filterHz, now);
  const hGain = bgmCtx.createGain();
  hGain.gain.setValueAtTime(preset.harmonicGain, now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.24, now + 0.045);
  env.gain.exponentialRampToValueAtTime(0.0008, now + preset.decaySec);
  osc.connect(filter);
  harmonic.connect(hGain);
  hGain.connect(filter);
  filter.connect(env);
  env.connect(bgmMaster);
  osc.start(now);
  harmonic.start(now);
  osc.stop(now + preset.decaySec + 0.1);
  harmonic.stop(now + preset.decaySec + 0.1);
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
    const vol = getBgmVolume();
    bgmMaster.gain.cancelScheduledValues(now);
    bgmMaster.gain.setValueAtTime(0.0001, now);
    bgmMaster.gain.linearRampToValueAtTime(vol.gain, now + 0.4);
    scheduleBgmLoop();
    syncBgmButtonUi();
    notify(`잔잔한 배경음악(${getBgmPreset().label})을 재생합니다.`);
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

export function renderInvitationBgmControls(notify) {
  const preset = getBgmPreset();
  const vol = getBgmVolume();
  const presetBtn = E('button', {
    type: 'button',
    class: 'invitation-bgm-preset-btn',
    'aria-label': `배경음악 분위기 전환 (현재: ${preset.label})`,
    title: `배경음악 곡 변경 · 현재: ${preset.label}`,
    onclick: () => cycleBgmPreset(notify)
  }, `🎼 ${preset.shortLabel} ↻`);
  presetBtn.hidden = !bgmPlaying;
  const volBtn = E('button', {
    type: 'button',
    class: 'invitation-bgm-vol-btn',
    'aria-label': `배경음악 음량 조절 (현재: ${vol.label})`,
    title: `음량: ${vol.label} (누르면 변경)`,
    onclick: () => setBgmVolume(bgmVolumeIdx + 1, notify)
  }, vol.icon);
  volBtn.hidden = !bgmPlaying;
  return E('div', { class: 'invitation-bgm-controls', role: 'group', 'aria-label': '청첩장 배경음악 제어' },
    renderInvitationBgmButton(notify),
    presetBtn,
    volBtn);
}
