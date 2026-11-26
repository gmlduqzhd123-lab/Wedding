import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = Number(process.env.E2E_PORT || 4179);
const CDP_PORT = Number(process.env.E2E_CDP_PORT || 9339);
const BASE = `http://127.0.0.1:${PORT}/Wedding/`;

async function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ].filter(Boolean);
  for (const bin of candidates) {
    try { await access(bin); return bin; } catch {}
  }
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const resolved = execFileSync('which', [name], { encoding: 'utf8' }).trim();
      if (resolved) return resolved;
    } catch {}
  }
  throw new Error('Headless Chrome/Chromium binary not found. Set CHROME_BIN to run E2E smoke tests.');
}

const chromeBin = await findChromeBinary();

const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Dev server startup timeout')), 10000);
  server.stdout.on('data', chunk => {
    if (String(chunk).includes('Local:')) { clearTimeout(timer); resolve(); }
  });
  server.stderr.on('data', chunk => process.stderr.write(chunk));
  server.on('exit', code => { clearTimeout(timer); reject(new Error(`Dev server exited unexpectedly (${code})`)); });
});

const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'wedding-e2e-'));
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (target) return target.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP endpoint did not become ready');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || ''));
    return res.result.value;
  }
  async waitFor(fnExpr, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ok = await this.eval(`Boolean((${fnExpr})())`);
      if (ok) return;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`waitFor timeout: ${fnExpr}`);
  }
  async close() {
    try { this.ws.close(); } catch {}
  }
}

let cdp;
try {
  const wsUrl = await waitForCdp();
  cdp = new CDP(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  const consoleErrors = [];
  const requestedUrls = [];
  cdp.on('Runtime.exceptionThrown', p => consoleErrors.push('EXCEPTION: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text)));
  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') consoleErrors.push('CONSOLE: ' + p.args.map(a => a.value ?? a.description).join(' '));
  });
  cdp.on('Network.requestWillBeSent', p => requestedUrls.push(p.request.url));
  cdp.on('Page.javascriptDialogOpening', () => {
    cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });

  const setViewport = async (width, height) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  };
  const goto = async url => {
    await cdp.send('Page.navigate', { url });
    await cdp.waitFor(`() => document.querySelector('#main')?.getAttribute('aria-busy') === 'false' && !document.querySelector('.loading-state')`);
    await new Promise(r => setTimeout(r, 150));
  };
  const reload = async () => {
    const loaded = new Promise(resolve => {
      const once = () => {
        const list = cdp.listeners.get('Page.loadEventFired') || [];
        const i = list.indexOf(once);
        if (i >= 0) list.splice(i, 1);
        resolve();
      };
      cdp.on('Page.loadEventFired', once);
    });
    await cdp.send('Page.reload');
    await loaded;
    await cdp.waitFor(`() => document.querySelector('#main')?.getAttribute('aria-busy') === 'false' && !document.querySelector('.loading-state')`);
    await new Promise(r => setTimeout(r, 150));
  };

  // 1. Guest mode: lightweight boot, dark-theme immunity, petals toggle, Scroll-Spy dock, 390px zero overflow
  await setViewport(390, 844);
  await goto(BASE + '?view=guest#/invitation');
  await cdp.eval(`localStorage.setItem('wedding:v1:theme', 'dark')`);
  requestedUrls.length = 0;
  await reload();
  const guestText = await cdp.eval(`document.querySelector('#main').innerText`);
  assert(guestText.includes('김희엽') && guestText.includes('유미혜'), 'Guest invitation must render couple names');
  assert.equal(await cdp.eval(`document.querySelector('#manage-content').hidden`), true, 'Guest mode hides manage button');
  assert.equal(await cdp.eval(`document.querySelector('#global-search-btn').hidden`), true, 'Guest mode hides global search button');
  assert.equal(await cdp.eval(`document.querySelector('#theme-toggle-btn').hidden`), true, 'Guest mode hides theme toggle button');
  assert.equal(await cdp.eval(`document.documentElement.classList.contains('is-dark-theme') || document.body.classList.contains('is-dark-theme')`), false, 'Guest mode must NEVER activate dark theme');
  assert(requestedUrls.some(u => u.includes('/data/guest-site.json')), 'Guest mode must load guest-site.json');
  assert(!requestedUrls.some(u => u.includes('/data/site.json')), 'Guest mode must NOT load full site.json');
  assert(!requestedUrls.some(u => u.includes('planner.css')), 'Guest mode must NOT load planner.css');
  assert(!requestedUrls.some(u => u.includes('charts.js') || u.includes('search-ui.js') || u.includes('planning.js') || u.includes('ledger.js') || u.includes('preferences.js') || u.includes('home-dashboard-ui.js') || u.includes('manager-ui.js') || u.includes('studios.json')), 'Guest mode must NOT load planner JS or studios.json');
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.invitation-share-foot button')].some(b => b.textContent.includes('예식 요약 복사'))`), true, 'Guest invitation must include wedding summary copy button');
  const petalsBtnText = await cdp.eval(`document.querySelector('.invitation-petals-btn')?.textContent?.trim()`);
  const textBtnText = await cdp.eval(`document.querySelector('.invitation-text-btn:not(.invitation-petals-btn)')?.textContent?.trim()`);
  assert(petalsBtnText && petalsBtnText.includes('🌸'), `Petals button must show flower label, got: ${petalsBtnText}`);
  assert.equal(textBtnText, '가+ 크게', `Large-text button must show 가+ 크게, got: ${textBtnText}`);
  assert.equal(await cdp.eval(`document.querySelector('.invitation-bgm-preset-btn')?.hidden`), true, 'BGM preset chip hidden until BGM starts');
  await cdp.eval(`document.querySelector('.invitation-text-btn:not(.invitation-petals-btn)').click()`);
  assert.equal(await cdp.eval(`document.querySelector('.invitation-text-btn:not(.invitation-petals-btn)')?.textContent?.trim()`), '가- 보통', 'Large-text click updates large-text label only');
  assert(await cdp.eval(`document.querySelector('.invitation-petals-btn')?.textContent?.includes('🌸')`), 'Large-text click must NOT overwrite petals button');
  await cdp.eval(`document.querySelector('.invitation-text-btn:not(.invitation-petals-btn)').click()`);
  const petalsBefore = await cdp.eval(`document.querySelector('.invitation-petals-layer').hidden`);
  await cdp.eval(`document.querySelector('.invitation-petals-btn').click()`);
  const petalsAfter = await cdp.eval(`document.querySelector('.invitation-petals-layer').hidden`);
  assert.notEqual(petalsAfter, petalsBefore, 'Petals toggle must switch layer visibility');
  const dockTargets = await cdp.eval(`[...document.querySelectorAll('.guest-dock-btn[data-dock-target]')].map(b => b.dataset.dockTarget)`);
  assert(dockTargets.includes('inv-sec-schedule') && dockTargets.includes('inv-sec-location'), 'Guest quick dock must include Scroll-Spy targets');
  assert.equal(await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`), true, 'Guest mobile zero overflow');
  await cdp.eval(`localStorage.removeItem('wedding:v1:theme')`);
  console.log('E2E PASS 1/8: Guest lightweight boot, dark-theme immunity, petals/text isolation, clean topbar, 390px OK');

  // 2. Desktop planner: Home scroll diet, Dark Theme + FOUC root class persistence, Global Search navigation
  await setViewport(1280, 900);
  requestedUrls.length = 0;
  await goto(BASE + '#/home');
  assert(requestedUrls.some(u => u.includes('planner.css')), 'Planner mode must load planner.css');
  assert.equal(await cdp.eval(`document.querySelectorAll('.home-section-nav .home-jump-chip').length`), 5, 'Home quick-jump nav renders 5 chips');
  assert(await cdp.eval(`Boolean(document.querySelector('#home-phase-focus.phase-focus-card'))`), 'Phase focus card renders');
  assert.equal(await cdp.eval(`document.querySelectorAll('.checklist-stage-details[open]').length`), 1, 'Only focus checklist stage open by default');
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '전체 4단계 펼치기').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.checklist-stage-details[open]').length === 4`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '현재 시기만 펼치기').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.checklist-stage-details[open]').length === 1`);

  await cdp.eval(`document.querySelector('#theme-toggle-btn').click()`);
  assert.equal(await cdp.eval(`document.documentElement.classList.contains('is-dark-theme') && document.body.classList.contains('is-dark-theme')`), true, 'Dark theme activates on html & body');
  await reload();
  assert.equal(await cdp.eval(`document.documentElement.classList.contains('is-dark-theme') && document.body.classList.contains('is-dark-theme')`), true, 'Dark theme persists across reload without FOUC');

  // Verify modal focus return on close before navigating with Global Search
  await cdp.eval(`document.querySelector('#global-search-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('#global-search-input'))`);
  await cdp.eval(`document.querySelector('#close-dialog').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open`);
  assert.equal(await cdp.eval(`document.activeElement?.id`), 'global-search-btn', 'Closing modal must restore focus to triggering button');

  await cdp.eval(`document.querySelector('#global-search-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('#global-search-input'))`);
  await cdp.eval(`(() => { const inp = document.querySelector('#global-search-input'); inp.value = '발리'; inp.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp.waitFor(`() => document.querySelectorAll('.global-search-item').length >= 1`);
  await cdp.eval(`[...document.querySelectorAll('.global-search-item')].find(b => b.textContent.includes('신혼여행')).click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && document.querySelector('#main')?.dataset.renderedRoute === 'honeymoon' && !document.querySelector('.loading-state')`);
  console.log('E2E PASS 2/8: Home scroll diet, Dark Botanical Theme persistence, Modal focus return, Global Search OK');

  // 3. Honeymoon Round 7: 3-way compare + diff toggle + best budget + matrix + recommender + compact video + selected actions + local calc + regional packing
  await cdp.waitFor(`() => document.querySelectorAll('[data-trip-action="tripCompare"]').length >= 3`);
  // Smart quick filters hide redundant 100%-matching chips (direct, longstay) and expose budget/semi brackets
  assert.equal(await cdp.eval(`Boolean(document.querySelector('[data-trip-filter="direct"]'))`), false, 'Redundant 100%-matching direct chip should be hidden');
  assert.equal(await cdp.eval(`Boolean(document.querySelector('[data-trip-filter="mid6to8m"]')) && Boolean(document.querySelector('[data-trip-filter="over8m"]')) && Boolean(document.querySelector('[data-trip-filter="semi"]'))`), true, 'Smart budget and semi-package chips must render');
  // Compact card quick YouTube button
  assert.equal(await cdp.eval(`document.querySelectorAll('.compact-video-row button').length >= 1`), true, 'Compact trip card must show quick video access button');

  // 3-way comparison + lowest budget highlight + diff-only toggle + copy summary
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripCompare"]')[0].click()`);
  await cdp.waitFor(`() => document.querySelector('.compare-floating-tray')?.innerText.includes('비교함 (1/3)') && document.body.classList.contains('has-compare-tray')`);
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripCompare"]')[1].click()`);
  await cdp.waitFor(`() => document.querySelector('.compare-floating-tray')?.innerText.includes('비교함 (2/3)')`);
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripCompare"]')[2].click()`);
  await cdp.waitFor(`() => document.querySelector('.compare-floating-tray')?.innerText.includes('비교함 (3/3)') && Boolean(document.querySelector('.travel-comparison td.is-best-budget')) && Boolean(document.querySelector('#compare-diff-only'))`);
  const allCompareRows = await cdp.eval(`document.querySelectorAll('.travel-comparison tbody tr').length`);
  await cdp.eval(`document.querySelector('#compare-diff-only').click()`);
  await cdp.waitFor(`() => document.querySelector('#compare-diff-only')?.checked === true && document.querySelectorAll('.travel-comparison tbody tr').length <= ${allCompareRows}`);
  await cdp.eval(`[...document.querySelectorAll('.compare-floating-tray button')].find(b => b.textContent === '비우기').click()`);
  await cdp.waitFor(`() => !document.querySelector('.compare-floating-tray') && !document.body.classList.contains('has-compare-tray')`);

  // Region matrix (5 regions) + 30s recommender (Top 3)
  await cdp.eval(`document.querySelector('.honeymoon-matrix-section summary').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.region-matrix-card').length === 5 && document.querySelectorAll('.region-bar-row').length === 6`);
  await cdp.eval(`document.querySelector('.honeymoon-recommender summary').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.recommender-card').length === 3`);

  // Final selection practical action board (ICS, summary copy, agency questions modal)
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripSelected"]')[0].click()`);
  await cdp.waitFor(`() => [...document.querySelectorAll('#selected-trip-region button')].some(b => b.textContent.includes('캘린더(.ics)')) && [...document.querySelectorAll('#selected-trip-region button')].some(b => b.textContent.includes('여행사 상담 질문집'))`);
  await cdp.eval(`[...document.querySelectorAll('#selected-trip-region button')].find(b => b.textContent.includes('여행사 상담 질문집')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && document.querySelectorAll('.agency-question-list li').length === 7`);
  await cdp.eval(`document.querySelector('#close-dialog').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open`);

  // Local spending & manual FX calculator
  await cdp.eval(`document.querySelector('.honeymoon-local-calc summary').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.local-calc-stat').length === 3`);
  await cdp.eval(`(() => { const fx = document.querySelector('#local-calc-fx'); fx.value = '8.5'; fx.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await cdp.waitFor(`() => document.querySelector('.local-calc-summary')?.innerText.includes('입력 환율 환산')`);

  // Regional packing preset banner + packing pending-only filter & copy button
  await cdp.eval(`document.querySelector('.honeymoon-packing summary').click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#packing-pending-only')) && Boolean(document.querySelector('.region-packing-banner')) && [...document.querySelectorAll('.packing-filter-row button')].some(b => b.textContent.includes('남은 짐 카톡 복사'))`);
  const packBeforePreset = await cdp.eval(`document.querySelectorAll('.honeymoon-packing .checklist-item').length`);
  await cdp.eval(`document.querySelector('.region-packing-banner button').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.honeymoon-packing .checklist-item').length === ${packBeforePreset + 4}`);
  const packTotal = packBeforePreset + 4;
  await cdp.eval(`document.querySelector('.honeymoon-packing .checklist-item input[type="checkbox"]').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.honeymoon-packing .checklist-item.done').length === 1`);
  await cdp.eval(`document.querySelector('#packing-pending-only').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.honeymoon-packing .checklist-item').length === ${packTotal - 1}`);
  await cdp.eval(`document.querySelector('#packing-pending-only').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.honeymoon-packing .checklist-item').length === ${packTotal}`);
  console.log('E2E PASS 3/8: Honeymoon Round 7 (3-way compare, matrix, recommender, compact video, ICS/questions, local FX calc, regional packing) OK');

  // 4. Budget SVG donut chart + CSV/summary export + Vendor schedule filters & bulk .ics
  await cdp.eval(`location.hash = '#/tips/budget'`);
  await cdp.waitFor(`() => document.querySelector('[data-tips-tab="budget"]')?.getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('button')].some(b => b.textContent.includes('예산표 작성하기') || b.textContent.includes('예산 입력·수정'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('예산표 작성하기') || b.textContent.includes('예산 입력·수정')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && document.querySelectorAll('#editor-body input[type="number"]').length >= 4`);
  await cdp.eval(`(() => {
    const inputs = [...document.querySelectorAll('#editor-body input[type="number"]')];
    inputs[0].value = '15000000'; inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = '14000000'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = '5000000';  inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#dialog-actions [type="submit"]').click();
  })()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && Boolean(document.querySelector('.budget-donut-card svg.budget-donut-svg'))`);
  const donutCenter = await cdp.eval(`document.querySelector('.donut-center-value')?.textContent`);
  assert(donutCenter && donutCenter.includes('2,000만'), `Expected donut center 2,000만, got: ${donutCenter}`);
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.wedding-budget-calc button')].some(b => b.textContent.includes('예산 요약 복사'))`), true, 'Budget summary copy button must render');
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.wedding-budget-calc button')].some(b => b.textContent.includes('CSV 내보내기'))`), true, 'Budget CSV export button must render');

  await cdp.eval(`location.hash = '#/tips/schedule'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.vendor-filter-bar')) && document.querySelectorAll('.vendor-schedule-item').length >= 1`);
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.vendor-schedule-board button')].some(b => b.textContent.includes('.ics'))`), true, 'Vendor bulk .ics export button must render');
  const vendorAllCount = await cdp.eval(`document.querySelectorAll('.vendor-schedule-item').length`);
  await cdp.eval(`document.querySelectorAll('.vendor-filter-chips button')[1]?.click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.vendor-schedule-item').length <= ${vendorAllCount}`);
  await cdp.eval(`[...document.querySelectorAll('.vendor-filter-meta button')].find(b => b.textContent === '필터 초기화')?.click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.vendor-schedule-item').length === ${vendorAllCount}`);
  console.log('E2E PASS 4/8: Budget donut + CSV/summary export + Vendor schedule filter & bulk .ics OK');

  // 5. Ceremony Live MC Cue Sheet (Wake Lock + font zoom + staging cue) + Custom Confirm + Guest->Quick Gift RSVP Auto-Sync + Batch Thank-You + Undo
  await cdp.eval(`location.hash = '#/ceremony/rundown'`);
  await cdp.waitFor(`() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('라이브 큐시트 모드'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('라이브 큐시트 모드')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && document.querySelector('.live-cue-stage')?.innerText.includes('STEP 01') && Boolean(document.querySelector('.live-cue-wake-btn')) && Boolean(document.querySelector('.live-cue-stage-badge'))`);
  await cdp.eval(`[...document.querySelectorAll('.live-cue-font-group button')].find(b => b.textContent === 'A+').click()`);
  await cdp.waitFor(`() => document.querySelector('.live-cue-font-pct')?.textContent === '115%'`);
  await cdp.eval(`[...document.querySelectorAll('.live-cue-nav button')].find(b => b.textContent.includes('다음 단계')).click()`);
  await cdp.waitFor(`() => document.querySelector('.live-cue-stage')?.innerText.includes('STEP 02')`);
  await cdp.eval(`document.querySelector('#close-dialog').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open`);

  // Check custom botanical confirm modal on ceremony prep reset
  await cdp.eval(`document.querySelector('.ceremony-prep-list input[type="checkbox"]').click()`);
  await cdp.waitFor(`() => [...document.querySelectorAll('button')].some(b => b.textContent === '체크 초기화')`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '체크 초기화').click()`);
  await cdp.waitFor(`() => document.querySelector('#confirm-dialog').open`);
  await cdp.eval(`document.querySelector('#confirm-ok').click()`);
  await cdp.waitFor(`() => !document.querySelector('#confirm-dialog').open && ![...document.querySelectorAll('button')].some(b => b.textContent === '체크 초기화')`);

  // Test WAI-ARIA tablist ArrowRight keyboard navigation & focus retention
  await cdp.eval(`document.querySelector('[data-ceremony-tab="rundown"]').focus()`);
  await cdp.eval(`document.querySelector('[data-ceremony-tab="rundown"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
  await cdp.waitFor(`() => document.querySelector('[data-ceremony-tab="guests"]')?.getAttribute('aria-selected') === 'true' && Boolean(document.querySelector('#guest-board-title'))`);
  assert.equal(await cdp.eval(`document.activeElement?.dataset?.ceremonyTab`), 'guests', 'ArrowRight on tablist must move focus to newly selected tab');

  // Add a guest with 미확인 RSVP first, verify unsent quick filter, then log gift via Quick Entry and verify RSVP auto-syncs to 참석
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '+ 하객 추가').click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#guest-name'))`);
  await cdp.eval(`(() => {
    document.querySelector('#guest-name').value = '테스트하객';
    document.querySelector('#guest-rsvp').value = '미확인';
    document.querySelector('#dialog-actions [type="submit"]').click();
  })()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && document.querySelector('#main').innerText.includes('테스트하객') && Boolean(document.querySelector('.ledger-crosscheck-strip'))`);

  await cdp.eval(`location.hash = '#/ceremony/gifts'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#gift-ledger-title'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('축의대 빠른 입력')).click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#quick-gift-name')) && Boolean(document.querySelector('#quick-gift-sync-rsvp')?.checked)`);
  await cdp.eval(`(() => {
    document.querySelector('#quick-gift-name').value = '테스트하객';
    [...document.querySelectorAll('.quick-gift-amounts button')].find(b => b.textContent === '10만').click();
    document.querySelector('#dialog-actions [type="submit"]').click();
  })()`);
  await cdp.waitFor(`() => document.querySelector('.quick-gift-status')?.textContent.includes('이번 접수 1건')`);
  await cdp.eval(`[...document.querySelectorAll('#dialog-actions button')].find(b => b.textContent === '완료 닫기').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && Boolean(document.querySelector('.side-ratio-card')) && document.querySelector('#main').innerText.includes('테스트하객')`);
  assert(await cdp.eval(`document.querySelector('.ledger-crosscheck-strip')?.innerText.includes('명단 일치 1건')`), 'Gift ledger cross-check strip must show matched guest count');

  // Verify guest RSVP was auto-updated to 참석 and banquet table estimate renders
  const syncedRsvp = await cdp.eval(`JSON.parse(localStorage.getItem('wedding:v1:preferences') || '{}').guestList?.find(g => g.name === '테스트하객')?.rsvp`);
  assert.equal(syncedRsvp, '참석', `Expected quick gift entry to auto-sync guest RSVP to 참석, got: ${syncedRsvp}`);
  await cdp.eval(`location.hash = '#/ceremony/guests'`);
  await cdp.waitFor(`() => document.querySelector('.ledger-crosscheck-strip')?.innerText.includes('8인석 1테이블')`);
  await cdp.eval(`location.hash = '#/ceremony/gifts'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#gift-ledger-title'))`);

  // Verify batch thank-you queue completes pending thank-you
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('미감사 1명 연속 보내기')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('.batch-thankyou-modal'))`);
  await cdp.eval(`[...document.querySelectorAll('.batch-thankyou-actions button')].find(b => b.textContent.includes('완료만 체크')).click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.batch-thankyou-done'))`);
  await cdp.eval(`[...document.querySelectorAll('.batch-thankyou-done button')].find(b => b.textContent.includes('장부로 돌아가기')).click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open`);

  // Instant delete without blocking confirm() -> Undo toast restores record
  await cdp.eval(`[...document.querySelectorAll('.ledger-row button')].find(b => b.textContent === '삭제').click()`);
  await cdp.waitFor(`() => !document.querySelector('#toast').hidden && Boolean(document.querySelector('.toast-undo-btn')) && !document.querySelector('#main').innerText.includes('테스트하객')`);
  await cdp.eval(`document.querySelector('.toast-undo-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('#main').innerText.includes('테스트하객')`);
  console.log('E2E PASS 5/8: Live MC cue sheet, tablist keyboard nav, RSVP auto-sync, banquet tables & cross-check, Batch Thank-You, Undo OK');

  // 6. Round 4 cross-links: Budget Net Cost Settlement, Day Ops Cash Denominations & Photo Call Mode, 30-Studio Archive
  await cdp.eval(`location.hash = '#/tips/budget'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.budget-net-settlement'))`);
  const netText = await cdp.eval(`document.querySelector('.budget-net-settlement')?.innerText || ''`);
  assert(netText.includes('100,000원') && netText.includes('13,900,000원'), `Expected net cost settlement card to reflect 14M - 100k = 13.9M, got: ${netText}`);

  await cdp.eval(`location.hash = '#/ceremony/dayops'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#dayops-title'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('기본 봉투 5종')).click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.ledger-row').length >= 5`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('현장 호명 체크 모드')).click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.photo-call-board'))`);
  await cdp.eval(`document.querySelector('.photo-call-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('.photo-call-head')?.innerText.includes('촬영 완료 1 /')`);

  await cdp.eval(`location.hash = '#/studios'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.studio-archive-drawer')) && Boolean(document.querySelector('#shoot-prep-pending-only'))`);
  // Lachma shoot prep pending filter & copy button
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.shoot-prep-filter-row button')].some(b => b.textContent.includes('남은 준비물 카톡 복사'))`), true, 'Lachma shoot prep must include remaining copy button');
  const shootTotal = await cdp.eval(`document.querySelectorAll('.lachma-prep-check-item').length`);
  await cdp.eval(`document.querySelector('.lachma-prep-check-item input[type="checkbox"]').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.lachma-prep-check-item.done').length === 1`);
  await cdp.eval(`document.querySelector('#shoot-prep-pending-only').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.lachma-prep-check-item').length === ${shootTotal - 1}`);
  await cdp.eval(`document.querySelector('#shoot-prep-pending-only').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.lachma-prep-check-item').length === ${shootTotal}`);

  // 30-studio archive: 2-way compare, favorite toggle, memo modal, search
  await cdp.eval(`document.querySelector('.studio-archive-drawer summary').click()`);
  await cdp.waitFor(`() => document.querySelectorAll('.studio-archive-card').length === 30`);
  await cdp.eval(`document.querySelectorAll('.studio-archive-card')[0].querySelector('button[aria-pressed]').click()`);
  await cdp.waitFor(`() => document.querySelector('.studio-archive-drawer')?.open === true && Boolean(document.querySelector('.studio-archive-compare'))`);
  await cdp.eval(`document.querySelectorAll('.studio-archive-card')[1].querySelector('button[aria-pressed]').click()`);
  await cdp.waitFor(`() => document.querySelector('.studio-archive-compare')?.innerText.includes('(2/2)')`);
  await cdp.eval(`[...document.querySelectorAll('.studio-archive-card')[0].querySelectorAll('button')].find(b => b.textContent.includes('메모')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('#studio-archive-memo-input'))`);
  await cdp.eval(`(() => { document.querySelector('#studio-archive-memo-input').value = '자연광 샘플 참고'; document.querySelector('#dialog-actions [type="submit"]').click(); })()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && document.querySelector('.studio-archive-card')?.innerText.includes('자연광 샘플 참고')`);
  await cdp.eval(`(() => { const inp = document.querySelector('#studio-archive-search'); inp.value = '포에버마인'; inp.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp.waitFor(`() => document.querySelectorAll('.studio-archive-card').length === 2`);

  // Verify Round 8 prenatal-badges flex-wrap layout fix + Home items bulk .ics & filter reset
  await cdp.eval(`location.hash = '#/prenatal/hospital'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.prenatal-badges'))`);
  const badgeLayout = await cdp.eval(`(() => { const cs = getComputedStyle(document.querySelector('.prenatal-badges')); return { display: cs.display, wrap: cs.flexWrap, gap: cs.gap }; })()`);
  assert.equal(badgeLayout.display, 'flex', `.prenatal-badges must be flex, got: ${badgeLayout.display}`);
  assert.equal(badgeLayout.wrap, 'wrap', `.prenatal-badges must wrap, got: ${badgeLayout.wrap}`);
  assert.notEqual(badgeLayout.gap, '0px', `.prenatal-badges must have positive gap, got: ${badgeLayout.gap}`);

  await cdp.eval(`location.hash = '#/tips/home'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#home-items-title'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '+ 품목 추가').click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#home-item-name'))`);
  await cdp.eval(`(() => {
    document.querySelector('#home-item-name').value = '로봇청소기';
    document.querySelector('#home-item-date').value = '2027-05-10';
    document.querySelector('#dialog-actions [type="submit"]').click();
  })()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && [...document.querySelectorAll('.home-items-board button')].some(b => b.textContent.includes('배송 일정 일괄 .ics'))`);
  await cdp.eval(`(() => { const inp = document.querySelector('#home-item-search'); inp.value = '없는품목'; inp.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.home-items-board .filter-reset-chip'))`);
  await cdp.eval(`document.querySelector('.home-items-board .filter-reset-chip').click()`);
  await cdp.waitFor(`() => !document.querySelector('.home-items-board .filter-reset-chip') && document.querySelector('.home-items-list')?.innerText.includes('로봇청소기')`);
  console.log('E2E PASS 6/8: Budget net settlement, Day Ops photo-call, Studio prep/30-archive compare & memo, Prenatal badges, Home bulk .ics OK');

  // 7. Dark-mode invitation contrast + dark-mode @media print guard + BGM + live KakaoTalk OG preview + Draft save/reload/revert (botanical confirm)
  await cdp.eval(`location.hash = '#/invitation'`);
  await cdp.waitFor(`() => [...document.querySelectorAll('button')].some(b => b.textContent === '예식 정보 편집') && Boolean(document.querySelector('.invitation-bgm-btn'))`);
  const darkBtnBg = await cdp.eval(`getComputedStyle(document.querySelector('.invitation-bgm-btn')).backgroundColor`);
  assert.equal(darkBtnBg, 'rgb(28, 36, 31)', `Dark-mode invitation BGM button must have dark surface, got: ${darkBtnBg}`);
  const kickerBg = await cdp.eval(`getComputedStyle(document.querySelector('.place-kicker')).backgroundColor`);
  assert.equal(kickerBg, 'rgb(36, 52, 41)', `Dark-mode .place-kicker must have dark surface, got: ${kickerBg}`);
  assert.equal(await cdp.eval(`[...document.querySelectorAll('.invitation-share-foot button')].some(b => b.textContent.includes('청첩장 인쇄'))`), true, 'Invitation share footer must include print button');

  // Verify dark mode automatically resets to crisp light paper under @media print
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  await new Promise(res => setTimeout(res, 120));
  const printAudit = await cdp.eval(`({
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    invBgImg: getComputedStyle(document.querySelector('.invitation')).backgroundImage,
    msgColor: getComputedStyle(document.querySelector('.invitation .message')).color
  })`);
  await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' });
  assert.equal(printAudit.htmlBg, 'rgb(255, 255, 255)', `Print mode html must be white even in dark theme, got: ${printAudit.htmlBg}`);
  assert(!printAudit.invBgImg.includes('31, 39, 34'), `Print mode invitation must not bleed dark gradient, got: ${printAudit.invBgImg}`);
  assert.equal(printAudit.msgColor, 'rgb(68, 64, 60)', `Print mode invitation message text must use dark ink, got: ${printAudit.msgColor}`);

  assert.equal(await cdp.eval(`document.querySelector('.invitation-bgm-preset-btn')?.hidden`), true, 'BGM preset button hidden while paused');
  await cdp.eval(`document.querySelector('.invitation-bgm-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('.invitation-bgm-preset-btn')?.hidden === false`);
  await cdp.eval(`document.querySelector('.invitation-bgm-preset-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('.invitation-bgm-preset-btn')?.textContent.includes('오르골')`);
  await cdp.eval(`document.querySelector('.invitation-bgm-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('.invitation-bgm-preset-btn')?.hidden === true`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent === '예식 정보 편집').click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('.kakao-og-bubble'))`);
  await cdp.eval(`(() => {
    const v = document.querySelector('#field-venue'); v.value = '순천아모르 테스트홀'; v.dispatchEvent(new Event('input', { bubbles: true }));
    const m = document.querySelector('#field-message'); m.value = '브라우저 초안 검증 인사말'; m.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const ogDesc = await cdp.eval(`document.querySelector('.kakao-og-desc')?.textContent`);
  assert(ogDesc && ogDesc.includes('순천아모르 테스트홀'), `Expected live Kakao OG desc update, got: ${ogDesc}`);
  await cdp.eval(`document.querySelector('#dialog-actions [type="submit"]').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open`);
  await reload();
  await cdp.waitFor(`() => document.querySelector('#draft-banner') && !document.querySelector('#draft-banner').hidden`);
  assert(await cdp.eval(`document.querySelector('#main').innerText.includes('브라우저 초안 검증 인사말')`), 'Draft must persist after reload');
  await cdp.eval(`document.querySelector('#manage-content').click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && document.querySelector('#editor-body').innerText.includes('초대 인사')`);
  await cdp.eval(`[...document.querySelectorAll('#editor-body button')].find(b => b.textContent === '공개본으로 돌아가기').click()`);
  await cdp.waitFor(`() => document.querySelector('#confirm-dialog').open`);
  await cdp.eval(`document.querySelector('#confirm-ok').click()`);
  await cdp.waitFor(`() => !document.querySelector('#confirm-dialog').open && !document.querySelector('#editor-dialog').open && document.querySelector('#draft-banner').hidden`);
  assert.equal(await cdp.eval(`localStorage.getItem('wedding:v1:draft')`), null, 'Draft cleared on revert to public');
  console.log('E2E PASS 7/8: Invitation dark contrast + dark-mode print guard + BGM + OG preview + Draft revert confirm OK');

  // 8. 18-view Dark Mode bright-box + WCAG AA contrast guard + Light Mode rose label guard + zero overflow in 1280px & 390px
  const darkAuditViews = [
    ['home', 'home'],
    ['invitation', 'invitation'],
    ['story', 'story'],
    ['albums', 'albums'],
    ['studios', 'studios'],
    ['honeymoon', 'honeymoon'],
    ['ceremony/rundown', 'ceremony'],
    ['ceremony/guests', 'ceremony'],
    ['ceremony/gifts', 'ceremony'],
    ['ceremony/dayops', 'ceremony'],
    ['prenatal/hospital', 'prenatal'],
    ['prenatal/subsidy', 'prenatal'],
    ['prenatal/guide', 'prenatal'],
    ['tips/tips', 'tips'],
    ['tips/budget', 'tips'],
    ['tips/schedule', 'tips'],
    ['tips/home', 'tips'],
    ['tips/benefits', 'tips']
  ];
  const brightBoxFailures = [];
  const darkContrastFailures = [];
  for (const [hashPath, expectedRoute] of darkAuditViews) {
    await cdp.eval(`location.hash = '#/${hashPath}'`);
    await cdp.waitFor(`() => document.querySelector('#main')?.dataset.renderedRoute === '${expectedRoute}' && !document.querySelector('.loading-state')`);
    await new Promise(res => setTimeout(res, 80));
    assert.equal(await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`), true, `Desktop 1280px dark-mode overflow on ${hashPath}`);
    const audit = await cdp.eval(`(() => {
      const parseRgb = str => {
        const m = String(str || '').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
      };
      const lum = c => [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const cr = (c1, c2) => { const l1 = lum(c1), l2 = lum(c2); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const effBg = el => {
        let cur = el;
        while (cur && cur !== document) {
          const c = parseRgb(getComputedStyle(cur).backgroundColor);
          if (c && c.a > 0.75) return c;
          cur = cur.parentElement;
        }
        return parseRgb(getComputedStyle(document.body).backgroundColor);
      };
      const bright = [];
      for (const el of document.querySelectorAll('#main *')) {
        if (el.closest('svg, .kakao-og-bubble, .kakao-og-chat-bg') || el.matches('img, svg, canvas, input[type="checkbox"], input[type="radio"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 24 || rect.height < 16) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
        const bg = parseRgb(cs.backgroundColor);
        if (bg && bg.a > 0.6 && bg.r > 200 && bg.g > 195 && bg.b > 185) {
          bright.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().replace(/\\s+/g, '.') : '') + ' (' + cs.backgroundColor + ')');
        }
      }
      const lowCr = [];
      const keyTargets = document.querySelectorAll('.main-nav a, #main .button:not(.quiet):not(.danger):not(.is-danger), #main .subtab-btn.is-active .subtab-badge, #main .trip-filter-chip[aria-pressed="true"], #main .arch-date-chip, #main .density-btn.is-active');
      for (const el of keyTargets) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const fg = parseRgb(cs.color), bg = effBg(el);
        if (fg && bg) {
          const ratio = cr(fg, bg);
          if (ratio < 4.5) lowCr.push(el.tagName.toLowerCase() + '.' + String(el.className || 'nav').trim().split(/\\s+/)[0] + ':' + ratio.toFixed(2));
        }
      }
      return { bright: [...new Set(bright)], lowCr: [...new Set(lowCr)] };
    })()`);
    if (audit.bright.length) brightBoxFailures.push(`${hashPath}: ${audit.bright.join(', ')}`);
    if (audit.lowCr.length) darkContrastFailures.push(`${hashPath}: ${audit.lowCr.join(', ')}`);
  }
  assert.deepEqual(brightBoxFailures, [], 'Dark-mode bright/cream surfaces detected:\n' + brightBoxFailures.join('\n'));
  assert.deepEqual(darkContrastFailures, [], 'Dark-mode WCAG AA contrast failures (<4.5:1):\n' + darkContrastFailures.join('\n'));

  const allRoutes = ['home', 'invitation', 'story', 'albums', 'studios', 'honeymoon', 'ceremony', 'prenatal', 'tips'];
  await cdp.eval(`document.querySelector('#theme-toggle-btn').click()`);
  assert.equal(await cdp.eval(`document.body.classList.contains('is-dark-theme')`), false);
  await setViewport(390, 844);
  for (const r of allRoutes) {
    await cdp.eval(`location.hash = '#/${r}'`);
    await cdp.waitFor(`() => document.querySelector('#main')?.dataset.renderedRoute === '${r}' && !document.querySelector('.loading-state')`);
    await new Promise(res => setTimeout(res, 100));
    const overflow = await cdp.eval(`document.documentElement.scrollWidth - window.innerWidth`);
    assert(overflow <= 0, `Mobile 390px horizontal overflow on ${r}: +${overflow}px`);
  }
  // Verify light-mode invitation rose labels pass WCAG AA (>=4.5:1)
  await cdp.eval(`location.hash = '#/invitation'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('.invitation-sub'))`);
  const roseCr = await cdp.eval(`(() => {
    const parse = s => { const m = String(s||'').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m ? [+m[1],+m[2],+m[3]] : [0,0,0]; };
    const lum = ([r,g,b]) => [r,g,b].map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0);
    const fg = parse(getComputedStyle(document.querySelector('.invitation-sub')).color);
    const bg = [250, 249, 245];
    const l1 = lum(fg), l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  })()`);
  assert(roseCr >= 4.5, `Light-mode .invitation-sub contrast must be >= 4.5:1, got: ${roseCr.toFixed(2)}`);
  console.log('E2E PASS 8/8: 18-view Dark Mode zero bright-box + WCAG AA contrast guard + 1280px/390px zero overflow OK');

  assert.deepEqual(consoleErrors, [], 'Browser console errors detected:\n' + consoleErrors.join('\n'));
  console.log('ALL E2E SMOKE TESTS PASSED WITH ZERO CONSOLE ERRORS!');
} finally {
  if (cdp) await cdp.close();
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
