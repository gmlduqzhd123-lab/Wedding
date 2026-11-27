import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseQuickGuestText, syncGuestsFromCsv } from '../assets/js/ledger.js';
import {
  PHOTO_CALL_KEY,
  readPhotoCallChecked,
  writePhotoCallChecked
} from '../assets/js/wedding-day-ui.js';
import { createWakeLockController } from '../assets/js/field-ops-ui.js';

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
}

test('v72: parseQuickGuestText parses KakaoTalk lines, comma lists, inline counts/meta, and TSV/CSV tables', () => {
  const mixed = [
    '1. 홍길동',
    '- 김영희 2명',
    '• 박민수 (신부측 직장, 외 1명, 참석)',
    '이철수 - 불참',
    '최유리, 정민호, 한지민'
  ].join('\n');

  const res = parseQuickGuestText(mixed, { defaultSide: '신랑 측', defaultGroup: '친구' });
  assert.equal(res.records.length, 7);

  assert.deepEqual(res.records[0], {
    name: '홍길동', side: '신랑 측', group: '친구', partySize: 1, inviteStatus: '미발송', rsvp: '미확인', mealTicket: true
  });
  assert.equal(res.records[1].name, '김영희');
  assert.equal(res.records[1].partySize, 2);
  assert.equal(res.records[2].name, '박민수');
  assert.equal(res.records[2].side, '신부 측');
  assert.equal(res.records[2].group, '직장·동료');
  assert.equal(res.records[2].partySize, 2);
  assert.equal(res.records[2].rsvp, '참석');
  assert.equal(res.records[3].name, '이철수');
  assert.equal(res.records[3].rsvp, '불참');
  assert.equal(res.records[3].mealTicket, false);
  assert.deepEqual(res.records.slice(4).map(r => r.name), ['최유리', '정민호', '한지민']);

  const tsv = '성함\t구분\t인원\n정우성\t신부 측\t3명';
  const tsvRes = parseQuickGuestText(tsv);
  assert.equal(tsvRes.records.length, 1);
  assert.equal(tsvRes.records[0].name, '정우성');
  assert.equal(tsvRes.records[0].side, '신부 측');
  assert.equal(tsvRes.records[0].partySize, 3);

  const synced = syncGuestsFromCsv([{ id: 'g1', side: '신랑 측', group: '친구', name: '홍길동', partySize: 1, inviteStatus: '미발송', rsvp: '미확인', mealTicket: true }], res.records, 'skip');
  assert.equal(synced.skippedCount, 1);
  assert.equal(synced.addedCount, 6);

  assert.throws(() => parseQuickGuestText('   '), /하객 이름 목록/);
});

test('v72: photo call checklist persists in localStorage, normalizes keys to strings, and migrates legacy sessionStorage', () => {
  const prevLocal = globalThis.localStorage;
  const prevSession = globalThis.sessionStorage;
  const local = makeMemoryStorage();
  const session = makeMemoryStorage();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  try {
    session.setItem(PHOTO_CALL_KEY, JSON.stringify([0, 2]));
    const migrated = readPhotoCallChecked();
    assert.deepEqual([...migrated].sort(), ['0', '2']);
    assert.equal(session.getItem(PHOTO_CALL_KEY), null, 'Legacy sessionStorage entry must be cleaned up after migration');
    assert.equal(local.getItem(PHOTO_CALL_KEY), JSON.stringify([0, 2]));

    migrated.add('4');
    writePhotoCallChecked(migrated);
    assert.deepEqual(JSON.parse(local.getItem(PHOTO_CALL_KEY)).sort(), ['0', '2', '4']);
  } finally {
    globalThis.localStorage = prevLocal;
    globalThis.sessionStorage = prevSession;
  }
});

test('v72: createWakeLockController tracks active state across rerenders and re-acquires on visibilitychange', async () => {
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let requestCount = 0;
  let releaseListeners = [];
  let visListeners = [];
  let visState = 'visible';

  const makeSentinel = () => {
    const sentinel = {
      released: false,
      addEventListener: (evt, fn) => { if (evt === 'release') releaseListeners.push(fn); },
      release: async () => {
        if (sentinel.released) return;
        sentinel.released = true;
        const fns = releaseListeners.splice(0);
        fns.forEach(fn => fn());
      }
    };
    return sentinel;
  };

  let lastSentinel = null;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      wakeLock: {
        request: async () => {
          requestCount++;
          lastSentinel = makeSentinel();
          return lastSentinel;
        }
      }
    }
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get visibilityState() { return visState; },
      addEventListener: (evt, fn) => { if (evt === 'visibilitychange') visListeners.push(fn); },
      removeEventListener: (evt, fn) => { if (evt === 'visibilitychange') visListeners = visListeners.filter(f => f !== fn); }
    }
  });

  try {
    let changeCount = 0;
    const wake = createWakeLockController(() => { changeCount++; });
    assert.equal(wake.isActive(), false);

    await wake.toggle();
    assert.equal(wake.isActive(), true);
    assert.equal(requestCount, 1);

    // Simulate OS releasing wake lock when tab hides, then returning visible
    visState = 'hidden';
    await lastSentinel.release();
    assert.equal(wake.isActive(), true, 'Controller remembers user intent while tab hidden');

    visState = 'visible';
    visListeners.forEach(fn => fn());
    await new Promise(r => setTimeout(r, 10));
    assert.equal(requestCount, 2, 'Wake lock must auto re-acquire when returning visible');
    assert.equal(wake.isActive(), true);
    assert.ok(changeCount >= 2);

    wake.release();
    assert.equal(wake.isActive(), false);
    assert.equal(visListeners.length, 0, 'visibilitychange listener must be cleaned up on release');
  } finally {
    if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav);
    else delete globalThis.navigator;
    if (prevDoc) Object.defineProperty(globalThis, 'document', prevDoc);
    else delete globalThis.document;
  }
});

test('v72: app.js removes native confirm(), invitation-card.js uses loaded SUITE weights, and app.css hides .status-banner in print without duplicate .photo-stage blocks', () => {
  const appJs = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  assert.equal(/\bconfirm\s*\(/.test(appJs), false, 'app.js must not call native window.confirm()');

  const cardJs = readFileSync(new URL('../assets/js/invitation-card.js', import.meta.url), 'utf8');
  assert.equal(/500\s+\d+px\s+SUITE/.test(cardJs), false, 'invitation-card.js must not request trimmed SUITE weight 500');

  const appCss = readFileSync(new URL('../assets/css/app.css', import.meta.url), 'utf8');
  assert.ok(appCss.includes('.status-banner, .draft-banner'), 'app.css @media print must hide .status-banner');
  assert.equal((appCss.match(/^\.photo-stage\s*\{/gm) || []).length, 1, 'app.css must have single .photo-stage definition');
  assert.equal((appCss.match(/^\.photo-stage-img\s*\{/gm) || []).length, 1, 'app.css must have single .photo-stage-img definition');
});
