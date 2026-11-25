import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAccountLine } from '../assets/js/content.js';
import { wrapCardMessageLines } from '../assets/js/invitation-card.js';
import { netWeddingCostSummary, computeCashDenominations } from '../assets/js/planning.js';
import { BGM_PRESETS } from '../assets/js/bgm.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';

test('wrapCardMessageLines preserves full 3-stanza June greeting with paragraph breaks', async () => {
  const site = JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
  const lines = wrapCardMessageLines(text => text.length * 22, site.invitation.message, 740, 12);
  const textLines = lines.filter(line => line !== null);
  const breakCount = lines.filter(line => line === null).length;
  assert.equal(textLines.length, 8, 'All 8 lines of the 3-stanza greeting must survive without 4-line truncation');
  assert.equal(breakCount, 2, 'Two blank stanza dividers must separate the 3 stanzas');
  assert(textLines[0].includes('6월'));
  assert(textLines[textLines.length - 1].includes('간직하겠습니다'));
});

test('parseAccountLine extracts Korean bank name, account number, and holder cleanly', () => {
  const a = parseAccountLine('카카오뱅크 3333-01-1234567 신랑 김희엽');
  assert.equal(a.bank, '카카오뱅크');
  assert.equal(a.account, '3333-01-1234567');
  assert.equal(a.digits, '3333011234567');
  assert.equal(a.holder, '신랑 김희엽');

  const b = parseAccountLine('신부 어머니 · KB국민은행 123456-01-234567 (홍길동)');
  assert.equal(b.bank, 'KB국민은행');
  assert.equal(b.account, '123456-01-234567');
  assert(b.holder.includes('홍길동'));

  const c = parseAccountLine('축의는 마음만 감사히 받겠습니다.');
  assert.equal(c.account, '');
  assert.equal(c.bank, '');
});

test('netWeddingCostSummary computes net actual spend and gift coverage percentage accurately', () => {
  const budgetPlan = {
    venue: { planned: 15000000, actual: 16000000 },
    sdm: { planned: 3000000, actual: 3000000 },
    honeymoon: { planned: 6000000, actual: 1000000 }
  };
  const giftLedger = [
    { id: 'g1', name: '하객1', side: '신랑 측', group: '친구', channel: '축의대(현금)', amount: 5000000, mealTickets: 1, returnGiftDone: false, thankYouDone: false },
    { id: 'g2', name: '하객2', side: '신부 측', group: '가족', channel: '계좌이체', amount: 10000000, mealTickets: 0, returnGiftDone: true, thankYouDone: true }
  ];
  const res = netWeddingCostSummary(budgetPlan, giftLedger);
  assert.equal(res.actualKnown, 20000000);
  assert.equal(res.giftTotal, 15000000);
  assert.equal(res.netActual, 5000000);
  assert.equal(res.coveragePct, 75);
  assert.equal(res.giftCount, 2);

  const surplus = netWeddingCostSummary({ venue: { planned: 5000000, actual: 5000000 } }, giftLedger);
  assert.equal(surplus.netActual, -10000000);
  assert.equal(surplus.coveragePct, 300);
});

test('computeCashDenominations calculates exact per-envelope 50k/10k bills for all and unready envelopes', () => {
  const envelopes = [
    { id: 'e1', payee: '사회자', recipient: '친구', amount: 200000, ready: true },
    { id: 'e2', payee: '축가자', recipient: '지인', amount: 130000, ready: false },
    { id: 'e3', payee: '촬영·본식 헬퍼', recipient: '이모님', amount: 250000, ready: false },
    { id: 'e4', payee: '기타', recipient: '미정', amount: null, ready: false }
  ];
  const res = computeCashDenominations(envelopes);
  // e1: 4x50k, e2: 2x50k + 3x10k, e3: 5x50k => total 11x50k + 3x10k = 580,000
  assert.equal(res.all.counted, 3);
  assert.equal(res.all.totalAmount, 580000);
  assert.equal(res.all.fiftyK, 11);
  assert.equal(res.all.tenK, 3);
  assert.equal(res.all.remainder, 0);
  // pending (e2 + e3): 7x50k + 3x10k = 380,000
  assert.equal(res.pending.counted, 2);
  assert.equal(res.pending.totalAmount, 380000);
  assert.equal(res.pending.fiftyK, 7);
  assert.equal(res.pending.tenK, 3);
});

test('BGM_PRESETS provides 3 valid Web Audio mood presets', () => {
  assert.equal(BGM_PRESETS.length, 3);
  assert.deepEqual(BGM_PRESETS.map(p => p.id), ['canon', 'musicbox', 'waltz']);
  for (const preset of BGM_PRESETS) {
    assert(preset.label && preset.shortLabel);
    assert(preset.tempoMs >= 400 && preset.tempoMs <= 1200);
    assert(Array.isArray(preset.chords) && preset.chords.length >= 4);
  }
});

test('searchWeddingWorkspace indexes all 30 preserved studios and links to studio archive', async () => {
  const studios = JSON.parse(await readFile(new URL('../data/studios.json', import.meta.url), 'utf8'));
  const results = searchWeddingWorkspace('포에버마인', { content: {}, prefs: {}, studios });
  const studioHits = results.filter(r => r.category === '스튜디오 참고');
  assert.equal(studioHits.length, 2);
  assert(studioHits.some(r => r.title.includes('포에버마인 담양점') && r.focusStudioQuery === '포에버마인 담양점'));
});
