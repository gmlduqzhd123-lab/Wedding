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
    const res = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
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
  assert(!requestedUrls.some(u => u.includes('charts.js') || u.includes('search-ui.js') || u.includes('planning.js') || u.includes('preferences.js') || u.includes('home-dashboard-ui.js') || u.includes('manager-ui.js') || u.includes('studios.json')), 'Guest mode must NOT load planner JS or studios.json');
  const petalsBefore = await cdp.eval(`document.querySelector('.invitation-petals-layer').hidden`);
  await cdp.eval(`document.querySelector('.invitation-petals-btn').click()`);
  const petalsAfter = await cdp.eval(`document.querySelector('.invitation-petals-layer').hidden`);
  assert.notEqual(petalsAfter, petalsBefore, 'Petals toggle must switch layer visibility');
  const dockTargets = await cdp.eval(`[...document.querySelectorAll('.guest-dock-btn[data-dock-target]')].map(b => b.dataset.dockTarget)`);
  assert(dockTargets.includes('inv-sec-schedule') && dockTargets.includes('inv-sec-location'), 'Guest quick dock must include Scroll-Spy targets');
  assert.equal(await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`), true, 'Guest mobile zero overflow');
  await cdp.eval(`localStorage.removeItem('wedding:v1:theme')`);
  console.log('E2E PASS 1/7: Guest lightweight boot, dark-theme immunity, petals, Scroll-Spy dock, 390px OK');

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

  await cdp.eval(`document.querySelector('#global-search-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && Boolean(document.querySelector('#global-search-input'))`);
  await cdp.eval(`(() => { const inp = document.querySelector('#global-search-input'); inp.value = '발리'; inp.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp.waitFor(`() => document.querySelectorAll('.global-search-item').length >= 1`);
  await cdp.eval(`[...document.querySelectorAll('.global-search-item')].find(b => b.textContent.includes('신혼여행')).click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && document.querySelector('#main')?.dataset.renderedRoute === 'honeymoon' && !document.querySelector('.loading-state')`);
  console.log('E2E PASS 2/7: Home scroll diet, Dark Botanical Theme FOUC-free persistence, Global Search OK');

  // 3. Honeymoon compare floating tray
  await cdp.waitFor(`() => document.querySelectorAll('[data-trip-action="tripCompare"]').length >= 2`);
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripCompare"]')[0].click()`);
  await cdp.waitFor(`() => document.querySelector('.compare-floating-tray')?.innerText.includes('비교함 (1/2)')`);
  await cdp.eval(`document.querySelectorAll('[data-trip-action="tripCompare"]')[1].click()`);
  await cdp.waitFor(`() => document.querySelector('.compare-floating-tray')?.innerText.includes('비교함 (2/2)')`);
  await cdp.eval(`[...document.querySelectorAll('.compare-floating-tray button')].find(b => b.textContent === '비우기').click()`);
  await cdp.waitFor(`() => !document.querySelector('.compare-floating-tray')`);
  console.log('E2E PASS 3/7: Honeymoon floating compare tray OK');

  // 4. Budget SVG donut chart
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
  console.log('E2E PASS 4/7: Inline SVG budget donut chart OK');

  // 5. Ceremony Live MC Cue Sheet + Custom Confirm Dialog + Quick Gift Entry + Side Ratio Bar + Instant Undo Delete
  await cdp.eval(`location.hash = '#/ceremony/rundown'`);
  await cdp.waitFor(`() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('라이브 큐시트 모드'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('라이브 큐시트 모드')).click()`);
  await cdp.waitFor(`() => document.querySelector('#editor-dialog').open && document.querySelector('.live-cue-stage')?.innerText.includes('STEP 01')`);
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

  await cdp.eval(`location.hash = '#/ceremony/gifts'`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#gift-ledger-title'))`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('축의대 빠른 입력')).click()`);
  await cdp.waitFor(`() => Boolean(document.querySelector('#quick-gift-name'))`);
  await cdp.eval(`(() => {
    document.querySelector('#quick-gift-name').value = '테스트하객';
    [...document.querySelectorAll('.quick-gift-amounts button')].find(b => b.textContent === '10만').click();
    document.querySelector('#dialog-actions [type="submit"]').click();
  })()`);
  await cdp.waitFor(`() => document.querySelector('.quick-gift-status')?.textContent.includes('이번 접수 1건')`);
  await cdp.eval(`[...document.querySelectorAll('#dialog-actions button')].find(b => b.textContent === '완료 닫기').click()`);
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && Boolean(document.querySelector('.side-ratio-card')) && document.querySelector('#main').innerText.includes('테스트하객')`);

  // Instant delete without blocking confirm() -> Undo toast restores record
  await cdp.eval(`[...document.querySelectorAll('.ledger-row button')].find(b => b.textContent === '삭제').click()`);
  await cdp.waitFor(`() => !document.querySelector('#toast').hidden && Boolean(document.querySelector('.toast-undo-btn')) && !document.querySelector('#main').innerText.includes('테스트하객')`);
  await cdp.eval(`document.querySelector('.toast-undo-btn').click()`);
  await cdp.waitFor(`() => document.querySelector('#main').innerText.includes('테스트하객')`);
  console.log('E2E PASS 5/7: Live MC cue sheet, custom confirm modal, side ratio bar, instant Undo delete OK');

  // 6. Invitation live KakaoTalk OG preview + Draft save -> reload -> diff -> revert to public
  await cdp.eval(`location.hash = '#/invitation'`);
  await cdp.waitFor(`() => [...document.querySelectorAll('button')].some(b => b.textContent === '예식 정보 편집')`);
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
  await cdp.waitFor(`() => !document.querySelector('#editor-dialog').open && document.querySelector('#draft-banner').hidden`);
  assert.equal(await cdp.eval(`localStorage.getItem('wedding:v1:draft')`), null, 'Draft cleared on revert to public');
  console.log('E2E PASS 6/7: Invitation live OG preview + Draft save/reload/diff/revert OK');

  // 7. All 9 routes zero horizontal overflow in 1280px (Dark) & 390px (Light) + zero console errors
  const allRoutes = ['home', 'invitation', 'story', 'albums', 'studios', 'honeymoon', 'ceremony', 'prenatal', 'tips'];
  for (const r of allRoutes) {
    await cdp.eval(`location.hash = '#/${r}'`);
    await cdp.waitFor(`() => document.querySelector('#main')?.dataset.renderedRoute === '${r}' && !document.querySelector('.loading-state')`);
    await new Promise(res => setTimeout(res, 100));
    assert.equal(await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth`), true, `Desktop 1280px dark-mode overflow on ${r}`);
  }
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
  console.log('E2E PASS 7/7: All 9 routes zero overflow on 1280px (Dark) & 390px (Light)');

  assert.deepEqual(consoleErrors, [], 'Browser console errors detected:\n' + consoleErrors.join('\n'));
  console.log('ALL E2E SMOKE TESTS PASSED WITH ZERO CONSOLE ERRORS!');
} finally {
  if (cdp) await cdp.close();
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
