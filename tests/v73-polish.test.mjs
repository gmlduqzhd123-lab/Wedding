import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  giftsToCsv,
  parseGiftsCsv,
  parseQuickGiftText,
  syncGiftsFromImport
} from '../assets/js/ledger.js';
import {
  CASHFLOW_RATIO_KEY,
  readCashFlowRatio,
  writeCashFlowRatio
} from '../assets/js/planning-ui.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
}

test('v73: parseQuickGiftText & parseGiftsCsv parse KakaoTalk/bank lines, round-trip exported CSV, and deduplicate cleanly', () => {
  const pasted = [
    '1. 홍길동 10만',
    '- 김영희 50,000 계좌',
    '• 박민수 (신부측 직장, 20만원, 식권2, 감사완료)',
    '이철수 15.5만 - 부부 동반'
  ].join('\n');

  const res = parseQuickGiftText(pasted, { defaultSide: '신랑 측', defaultGroup: '친구', defaultChannel: '축의대(현금)' });
  assert.equal(res.records.length, 4);

  assert.equal(res.records[0].name, '홍길동');
  assert.equal(res.records[0].amount, 100000);
  assert.equal(res.records[0].channel, '축의대(현금)');
  assert.equal(res.records[0].mealTickets, 1);

  assert.equal(res.records[1].name, '김영희');
  assert.equal(res.records[1].amount, 50000);
  assert.equal(res.records[1].channel, '계좌이체');
  assert.equal(res.records[1].mealTickets, 0, 'Bank transfer without explicit ticket count defaults to 0 tickets');

  assert.equal(res.records[2].name, '박민수');
  assert.equal(res.records[2].side, '신부 측');
  assert.equal(res.records[2].group, '직장·동료');
  assert.equal(res.records[2].amount, 200000);
  assert.equal(res.records[2].mealTickets, 2);
  assert.equal(res.records[2].thankYouDone, true);

  assert.equal(res.records[3].name, '이철수');
  assert.equal(res.records[3].amount, 155000);
  assert.equal(res.records[3].note, '부부 동반');

  // Round-trip giftsToCsv -> parseGiftsCsv
  const csv = giftsToCsv(res.records);
  const parsedCsv = parseGiftsCsv(csv);
  assert.equal(parsedCsv.records.length, 4);
  assert.equal(parsedCsv.records[2].amount, 200000);
  assert.equal(parsedCsv.records[2].thankYouDone, true);

  // Deduplication in skip mode vs all mode
  const existing = [{ id: 'g1', ...res.records[0] }];
  const skipped = syncGiftsFromImport(existing, res.records, 'skip');
  assert.equal(skipped.skippedCount, 1);
  assert.equal(skipped.addedCount, 3);
  const allMode = syncGiftsFromImport(existing, res.records, 'all');
  assert.equal(allMode.addedCount, 4);

  assert.throws(() => parseQuickGiftText('   '), /축의금 내역/);
});

test('v73: cashFlowGroomRatio persists in localStorage and clamps safely', () => {
  const prevLocal = globalThis.localStorage;
  globalThis.localStorage = makeMemoryStorage();
  try {
    assert.equal(readCashFlowRatio(), 50);
    assert.equal(writeCashFlowRatio(65), 65);
    assert.equal(readCashFlowRatio(), 65);
    assert.equal(globalThis.localStorage.getItem(CASHFLOW_RATIO_KEY), '65');
    assert.equal(writeCashFlowRatio(140), 100);
    assert.equal(readCashFlowRatio(), 100);
    globalThis.localStorage.setItem(CASHFLOW_RATIO_KEY, 'not-a-number');
    assert.equal(readCashFlowRatio(), 50);
  } finally {
    globalThis.localStorage = prevLocal;
  }
});

test('v73: global search matches Korean BGM slot labels & latest bulk keywords, and editor-ui restores focus cleanly', () => {
  const hits = searchWeddingWorkspace('신랑 입장', {
    content: {},
    prefs: {
      ceremonyBgm: {
        'bgm-groom': { song: 'Bruno Mars - Marry You', cue: '0:00 시작', ready: true }
      }
    }
  });
  const bgmHit = hits.find(r => r.id === 'ceremony-bgm-bgm-groom');
  assert.ok(bgmHit, 'Global search must match Korean BGM slot label 신랑 입장');
  assert.ok(bgmHit.title.includes('STEP 04 · 신랑 입장') && bgmHit.title.includes('Marry You'));

  const bulkGiftHit = searchWeddingWorkspace('계좌내역', { content: {}, prefs: {} }).find(r => r.id === 'nav-ceremony-gifts');
  assert.ok(bulkGiftHit, 'Global search must find gift ledger via 계좌내역 keyword');

  const editorJs = readFileSync(new URL('../assets/js/editor-ui.js', import.meta.url), 'utf8');
  assert.ok(editorJs.includes("move(index + 1, '뒤로')"), 'Album photo move-next button must restore focus to 뒤로');

  const managerJs = readFileSync(new URL('../assets/js/manager-ui.js', import.meta.url), 'utf8');
  assert.ok(managerJs.includes("'wedding:v1:cashFlowRatio'"), 'manager-ui KNOWN_UI_STORAGE_KEYS must include cashFlowRatio');
});
