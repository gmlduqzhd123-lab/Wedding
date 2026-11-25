#!/usr/bin/env node
/**
 * Generate the 1200x630 Open Graph share card (assets/share-card.png)
 * from data/site.json using local Paperlogy/SUITE fonts and headless Chromium.
 *
 * Usage:
 *   npm run share-card
 *   node scripts/generate-share-card.mjs --out /tmp/share-card.png --site data/site.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseContent, formatDate, safeUrl } from '../assets/js/content.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    sitePath: path.join(ROOT, 'data/site.json'),
    outPath: path.join(ROOT, 'assets/share-card.png')
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) opts.outPath = path.resolve(argv[++i]);
    else if (argv[i] === '--site' && argv[i + 1]) opts.sitePath = path.resolve(argv[++i]);
  }
  return opts;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatKoreanTime(timeStr) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr || '');
  if (!m) return timeStr || '';
  const h = Number(m[1]), min = Number(m[2]);
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 || 12;
  return `${period} ${h12}시${min ? ` ${min}분` : ''}`;
}

async function resolveCoverPhotoDataUrl(albums) {
  const raw = (albums || []).flatMap(a => a?.images || []).map(src => safeUrl(src, { image: true })).find(Boolean);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const candidate = path.resolve(ROOT, raw.replace(/^\.\//, ''));
  if (!candidate.startsWith(ROOT + path.sep)) return '';
  try {
    const buf = await fs.readFile(candidate);
    const ext = path.extname(candidate).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function buildShareCardHtml(content, coverSrc) {
  const info = content.invitation || {};
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  const dateDot = info.date ? info.date.replaceAll('-', '. ') : '';
  const ribbonText = dateDot ? `WEDDING INVITATION · ${dateDot}` : 'WEDDING INVITATION';
  const dateLine = [info.date ? formatDate(info.date) : '', info.time ? formatKoreanTime(info.time) : ''].filter(Boolean).join(' · ') || '예식 일정 준비 중';
  const venueLine = (info.venue || '').trim() || '예식 장소 준비 중';

  const leaf = (x, y, rot, scale, fill) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
      <path d="M 0 0 C -6 -8, -5 -20, 0 -27 C 5 -20, 6 -8, 0 0 Z" fill="${fill}"/>
      <path d="M 0 -2 L 0 -21" stroke="#3c5a44" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>
    </g>`;

  const rose = (x, y) =>
    `<g transform="translate(${x} ${y})">
      <circle cx="0" cy="0" r="15" fill="#f5dcd7"/>
      <circle cx="-3" cy="-2" r="10" fill="#ebbab2"/>
      <circle cx="3" cy="2" r="8" fill="#c97a70"/>
      <circle cx="0" cy="0" r="2.2" fill="#d7ab6e"/>
    </g>`;

  const leftPanel = coverSrc
    ? `<div class="arch-photo-wrap">
        <div class="arch-photo-frame">
          <img src="${escapeHtml(coverSrc)}" alt="웨딩 대표 사진">
        </div>
        <span class="arch-photo-caption">OUR NEW BEGINNING</span>
      </div>`
    : `<svg class="arch-svg" viewBox="0 0 380 410" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="halo" cx="50%" cy="46%" r="42%">
            <stop offset="0%" stop-color="#fff5eb" stop-opacity="0.95"/>
            <stop offset="65%" stop-color="#f8e7e1" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <path d="M 52 362 L 52 172 A 138 138 0 0 1 328 172 L 328 362 Z" fill="#fcfaf7" stroke="#c3d3c6" stroke-width="2"/>
        <path d="M 64 350 L 64 172 A 126 126 0 0 1 316 172 L 316 350 Z" fill="none" stroke="#ead7d0" stroke-width="1.3"/>
        <circle cx="190" cy="184" r="100" fill="url(#halo)"/>
        <path d="M 46 346 C 40 282, 48 214, 72 152 C 84 122, 100 102, 122 86" fill="none" stroke="#5c7d64" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
        <path d="M 334 346 C 340 282, 332 214, 308 152 C 296 122, 280 102, 258 86" fill="none" stroke="#5c7d64" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
        <path d="M 54 272 C 74 266, 94 256, 114 248" fill="none" stroke="#6c8d74" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
        <path d="M 326 270 C 306 264, 286 254, 266 246" fill="none" stroke="#6c8d74" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
        ${leaf(44, 336, -46, 0.9, '#8daa94')}
        ${leaf(56, 296, 28, 0.85, '#56785f')}
        ${leaf(46, 240, -38, 0.92, '#6e9077')}
        ${leaf(68, 198, 34, 0.82, '#9ab4a0')}
        ${leaf(82, 146, -26, 0.8, '#53755c')}
        ${leaf(114, 108, 36, 0.72, '#7ea087')}
        ${leaf(336, 336, 46, 0.9, '#8daa94')}
        ${leaf(324, 296, -28, 0.85, '#56785f')}
        ${leaf(334, 240, 38, 0.92, '#6e9077')}
        ${leaf(312, 198, -34, 0.82, '#9ab4a0')}
        ${leaf(298, 146, 26, 0.8, '#53755c')}
        ${leaf(266, 108, -36, 0.72, '#7ea087')}
        ${rose(56, 270)}
        ${rose(324, 266)}
        <g transform="translate(190 176)">
          <circle cx="-22" cy="0" r="36" fill="none" stroke="#c99b5d" stroke-width="4.8"/>
          <circle cx="22" cy="0" r="36" fill="none" stroke="#d49689" stroke-width="4.8"/>
          <path d="M -22 -36 A 36 36 0 0 1 11 -14" fill="none" stroke="#c99b5d" stroke-width="4.8"/>
          <path d="M -22 -48 L -18 -39 L -9 -36 L -18 -33 L -22 -24 L -26 -33 L -35 -36 L -26 -39 Z" fill="#d9ad68"/>
        </g>
        <path d="M 128 228 Q 190 250 252 228" fill="none" stroke="#8da894" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="190" cy="239" r="4" fill="#c97a70"/>
        <line x1="106" y1="296" x2="274" y2="296" stroke="#dce5de" stroke-width="1.4"/>
        <text x="190" y="324" text-anchor="middle" font-family="SUITE, sans-serif" font-size="14" font-weight="600" letter-spacing="3.5" fill="#4f6c56">OUR NEW BEGINNING</text>
        <circle cx="180" cy="340" r="2" fill="#c97a70" opacity="0.65"/>
        <circle cx="190" cy="340" r="2.8" fill="#c97a70"/>
        <circle cx="200" cy="340" r="2" fill="#c97a70" opacity="0.65"/>
      </svg>`;

  const coupleHtml = (p1 || p2)
    ? `<div class="couple-plaque">
        ${p1 ? `<span class="role is-groom">신랑</span><span class="name">${escapeHtml(p1)}</span>` : ''}
        ${p1 && p2 ? `<span class="heart" aria-hidden="true">♥</span>` : ''}
        ${p2 ? `<span class="role is-bride">신부</span><span class="name">${escapeHtml(p2)}</span>` : ''}
      </div>`
    : `<div class="couple-plaque"><span class="name">우리의 결혼 기록</span></div>`;

  const cornerSvg = cls =>
    `<svg class="corner ${cls}" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M 2 30 L 2 9 A 7 7 0 0 1 9 2 L 30 2" fill="none" stroke="#b9c9bc" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M 8 16 C 8 10, 10 8, 16 8" fill="none" stroke="#c97a70" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>
      <circle cx="9" cy="9" r="1.8" fill="#c97a70"/>
    </svg>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Paperlogy'; font-weight: 600; src: url('/assets/fonts/Paperlogy-6SemiBold.woff2') format('woff2'); }
  @font-face { font-family: 'Paperlogy'; font-weight: 700; src: url('/assets/fonts/Paperlogy-7Bold.woff2') format('woff2'); }
  @font-face { font-family: 'SUITE'; font-weight: 400; src: url('/assets/fonts/SUITE-Regular.woff2') format('woff2'); }
  @font-face { font-family: 'SUITE'; font-weight: 500; src: url('/assets/fonts/SUITE-Medium.woff2') format('woff2'); }
  @font-face { font-family: 'SUITE'; font-weight: 600; src: url('/assets/fonts/SUITE-SemiBold.woff2') format('woff2'); }
  @font-face { font-family: 'SUITE'; font-weight: 700; src: url('/assets/fonts/SUITE-Bold.woff2') format('woff2'); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: 'SUITE', sans-serif;
    background:
      radial-gradient(circle at 12% 14%, rgba(169, 198, 177, 0.42), transparent 44%),
      radial-gradient(circle at 90% 88%, rgba(235, 194, 184, 0.38), transparent 45%),
      #f6f4ed;
    display: grid;
    place-items: center;
  }
  .card {
    position: relative;
    width: 1124px;
    height: 554px;
    border-radius: 30px;
    background: linear-gradient(180deg, #fffefb 0%, #fcfaf6 100%);
    border: 1.5px solid #e1e6e0;
    box-shadow: 0 24px 50px -22px rgba(42, 62, 48, 0.16);
    padding: 46px 64px;
    display: grid;
    grid-template-columns: 380px 1fr;
    align-items: center;
    gap: 54px;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 14px;
    border-radius: 20px;
    border: 1px solid #ece8df;
    pointer-events: none;
  }
  .corner { position: absolute; width: 32px; height: 32px; pointer-events: none; }
  .corner.tl { top: 22px; left: 22px; }
  .corner.tr { top: 22px; right: 22px; transform: scaleX(-1); }
  .corner.bl { bottom: 22px; left: 22px; transform: scaleY(-1); }
  .corner.br { bottom: 22px; right: 22px; transform: scale(-1); }
  .left {
    display: grid;
    place-items: center;
  }
  .arch-svg { width: 368px; height: 396px; display: block; }
  .arch-photo-wrap {
    display: grid;
    justify-items: center;
    gap: 12px;
  }
  .arch-photo-frame {
    width: 288px;
    height: 360px;
    border-radius: 144px 144px 20px 20px;
    padding: 8px;
    background: #ffffff;
    border: 2px solid #c3d3c6;
    box-shadow: 0 12px 26px -14px rgba(40, 60, 46, 0.22);
    overflow: hidden;
  }
  .arch-photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 136px 136px 14px 14px;
    display: block;
  }
  .arch-photo-caption {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: #4f6c56;
  }
  .right {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 16px;
  }
  .ribbon {
    display: inline-flex;
    align-items: center;
    padding: 10px 26px;
    border-radius: 999px;
    background: #edf3ee;
    border: 1px solid #cfe0d3;
    color: #34523d;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }
  .sub {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    color: #b7746b;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.16em;
  }
  .sub::before, .sub::after {
    content: '';
    width: 34px;
    height: 1px;
    background: #e1c0b8;
  }
  .couple-plaque {
    width: 100%;
    max-width: 560px;
    padding: 24px 30px;
    border-radius: 26px;
    background: #f7f9f7;
    border: 1.5px solid #dde6df;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: nowrap;
  }
  .role {
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 19px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .role.is-groom { background: #e6efe8; color: #2f4d38; }
  .role.is-bride { background: #f8e8e5; color: #9c4f46; }
  .name {
    font-family: 'Paperlogy', 'SUITE', sans-serif;
    font-size: 50px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #211f1d;
    white-space: nowrap;
  }
  .heart {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #f8e9e6;
    color: #c97a70;
    display: inline-grid;
    place-items: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .invite-line {
    font-size: 19px;
    font-weight: 500;
    line-height: 1.5;
    color: #46423e;
    letter-spacing: -0.01em;
    max-width: 550px;
    white-space: pre-line;
  }
  .venue-box {
    width: 100%;
    max-width: 560px;
    padding: 20px 28px;
    border-radius: 22px;
    background: #f7f9f7;
    border: 1.5px solid #dde6df;
    display: grid;
    gap: 8px;
  }
  .venue-date {
    font-family: 'Paperlogy', 'SUITE', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #22201e;
    letter-spacing: -0.01em;
  }
  .venue-place {
    font-size: 22px;
    font-weight: 600;
    color: #4d534d;
  }
</style>
</head>
<body>
  <main class="card">
    ${cornerSvg('tl')}${cornerSvg('tr')}${cornerSvg('bl')}${cornerSvg('br')}
    <div class="left">${leftPanel}</div>
    <div class="right">
      <span class="ribbon">${escapeHtml(ribbonText)}</span>
      <span class="sub">WITH LOVE, TOGETHER</span>
      ${coupleHtml}
      <p class="invite-line">${escapeHtml(
        (() => {
          const firstStanza = String(info.message || '').trim().split(/\r?\n\s*\r?\n/)[0] || '';
          const lines = firstStanza.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 3);
          return lines.length ? lines.join('\n') : '소중한 분들을 결혼식에 초대합니다';
        })()
      )}</p>
      <div class="venue-box">
        <div class="venue-date">${escapeHtml(dateLine)}</div>
        <div class="venue-place">${escapeHtml(venueLine)}</div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

async function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const bin of candidates) {
    try {
      await fs.access(bin);
      return bin;
    } catch {}
  }
  throw new Error('로컬 Chrome/Chromium 실행 파일을 찾지 못했습니다. CHROME_BIN 환경 변수로 경로를 지정해 주세요.');
}

async function captureHtmlToPng(html, outPath) {
  const server = http.createServer(async (req, res) => {
    const reqPath = (req.url || '/').split('?')[0];
    if (reqPath === '/' || reqPath === '/card.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (reqPath.startsWith('/assets/fonts/')) {
      const target = path.resolve(ROOT, reqPath.slice(1));
      if (target.startsWith(path.join(ROOT, 'assets', 'fonts') + path.sep)) {
        try {
          const data = await fs.readFile(target);
          res.writeHead(200, { 'content-type': 'font/woff2' });
          res.end(data);
          return;
        } catch {}
      }
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const chromeBin = await findChromeBinary();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wedding-share-card-'));

  let chrome;
  let ws;
  try {
    chrome = spawn(chromeBin, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      '--window-size=1200,630',
      `--user-data-dir=${userDataDir}`,
      'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const wsUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chromium DevTools 포트를 열지 못했습니다.')), 15000);
      let stderr = '';
      chrome.stderr.on('data', chunk => {
        stderr += chunk.toString();
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      chrome.once('exit', code => { clearTimeout(timer); reject(new Error(`Chromium 종료됨 (code=${code})`)); });
    });

    const browserPort = new URL(wsUrl).port;
    const targets = await fetch(`http://127.0.0.1:${browserPort}/json/list`).then(r => r.json());
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error('Chromium 페이지 타깃을 찾지 못했습니다.');

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let nextId = 1;
    const pending = new Map();
    const waiters = [];
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (let i = waiters.length - 1; i >= 0; i--) {
          if (waiters[i].method === msg.method) {
            const w = waiters.splice(i, 1)[0];
            w.resolve(msg.params);
          }
        }
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const waitEvent = method => new Promise(resolve => waiters.push({ method, resolve }));

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1200,
      height: 630,
      deviceScaleFactor: 1,
      mobile: false
    });
    const loaded = waitEvent('Page.loadEventFired');
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/card.html` });
    await loaded;
    await send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))))',
      awaitPromise: true
    });
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, Buffer.from(data, 'base64'));
  } finally {
    try { ws?.close(); } catch {}
    try { chrome?.kill('SIGTERM'); } catch {}
    await new Promise(resolve => server.close(resolve));
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const { sitePath, outPath } = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(sitePath, 'utf8');
  const content = parseContent(raw);
  const coverSrc = await resolveCoverPhotoDataUrl(content.albums);
  const html = buildShareCardHtml(content, coverSrc);
  await captureHtmlToPng(html, outPath);
  const stat = await fs.stat(outPath);
  console.log(`Generated OG share card: ${path.relative(ROOT, outPath) || outPath} (1200x630, ${(stat.size / 1024).toFixed(1)} KB${coverSrc ? ', with album cover photo' : ''})`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
