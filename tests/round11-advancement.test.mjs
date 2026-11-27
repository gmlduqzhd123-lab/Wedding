import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  collectMasterTimeline,
  weddingPhaseInfo,
  cashFlowSettlementSummary,
  buildCashFlowSummaryText
} from '../assets/js/planning.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';
import { summarizePreferenceCounts } from '../assets/js/sync-code.js';
import { buildPersonalizedInviteMessage } from '../assets/js/guest-ledger-ui.js';
import { ALBUM_ONBOARDING_STEPS } from '../assets/js/story-album-ui.js';
import { evaluatePublishPreflight } from '../assets/js/manager-ui.js';

test('Strategy 1: master timeline, phase card, global search, and sync counts integrate Round 10 records', () => {
  const content = {
    invitation: { partner1: '신랑 김희엽', partner2: '신부 유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층' },
    honeymoon: [{ id: 'bali-fit', title: '발리 자유여행 6박', country: '인도네시아 발리', budget: 6200000 }],
    stories: [],
    albums: [],
    tips: []
  };
  const prefs = {
    shootBrief: {
      outfits: [{ id: 'o1', label: '메인 실크 드레스', hair: '로우번', props: '화이트 부케', poses: '창가 역광' }],
      milestones: { originalDate: '2027-02-10', selectDate: '2027-02-18', retouchDate: '2027-03-25', originalDone: true, selectDone: false, retouchDone: false }
    },
    ceremonyBgm: {
      'bgm-groom': { song: 'Marry You', cue: '0:00 시작', ready: true }
    },
    tripQuotes: {
      'bali-fit': { total: 5900000, agency: '하나투어 직판', perks: '스파 2인', cancelUntil: '2027-02-15' }
    }
  };

  const timeline = collectMasterTimeline({ content, prefs, now: new Date('2027-02-12T00:00:00Z') });
  const origItem = timeline.find(i => i.id === 'master-shoot-ms-originalDate');
  const selItem = timeline.find(i => i.id === 'master-shoot-ms-selectDate');
  const cancelItem = timeline.find(i => i.id === 'master-trip-cancel-bali-fit');
  assert.ok(origItem && origItem.done === true, 'Completed original milestone should reflect done=true');
  assert.ok(selItem && selItem.urgent === true, 'Select milestone within 7 days should be marked urgent');
  assert.ok(cancelItem && cancelItem.urgent === true && cancelItem.detail.includes('하나투어 직판'), 'Honeymoon free-cancel deadline within 7 days should be urgent');

  const phase = weddingPhaseInfo({ content, prefs, now: new Date('2026-11-26T00:00:00Z') });
  assert.ok(phase.metrics.some(m => m.includes('착장 1벌')), 'Pre-shoot phase card should show outfit count');
  assert.ok(phase.metrics.some(m => m.includes('실견적 1건')), 'Pre-shoot phase card should show logged quote count');
  assert.ok(phase.metrics.some(m => m.includes('본식 BGM 1/9')), 'Phase card should show BGM readiness when entered');

  const outfitHit = searchWeddingWorkspace('로우번', { content, prefs }).find(r => r.id === 'shoot-outfit-o1');
  assert.equal(outfitHit?.route, 'studios');
  const bgmHit = searchWeddingWorkspace('Marry You', { content, prefs }).find(r => r.id === 'ceremony-bgm-bgm-groom');
  assert.equal(bgmHit?.subTab, 'rundown');
  const quoteHit = searchWeddingWorkspace('하나투어 직판', { content, prefs }).find(r => r.id === 'trip-bali-fit');
  assert.equal(quoteHit?.category, '신혼여행 · 실견적');

  const counts = summarizePreferenceCounts(prefs);
  assert.equal(counts.shootOutfits, 1);
  assert.equal(counts.bgmCount, 1);
  assert.equal(counts.tripQuotes, 1);
});

test('Strategy 2: personalized invite messages adapt tone cleanly to guest group and manual overrides', () => {
  const inv = { partner1: '신랑 김희엽', partner2: '신부 유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층', address: '전라남도 순천시 서면 압곡길 94' };
  const url = 'https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation';

  const friendMsg = buildPersonalizedInviteMessage({ name: '박민수', group: '친구' }, inv, url, 'auto');
  assert.ok(friendMsg.includes('박민수') && friendMsg.includes('김희엽 · 유미혜') && friendMsg.includes('결혼하게 되었어') && friendMsg.includes(url));

  const workMsg = buildPersonalizedInviteMessage({ name: '김과장', group: '직장·동료' }, inv, url, 'auto');
  assert.ok(workMsg.includes('김과장님, 안녕하세요.') && workMsg.includes('순천아모르웨딩컨벤션 1층'));

  const famMsg = buildPersonalizedInviteMessage({ name: '이삼촌', group: '가족·친척' }, inv, url, 'auto');
  assert.ok(famMsg.includes('이삼촌 어르신(님)') && famMsg.includes('귀한 걸음'));

  const forcedFormal = buildPersonalizedInviteMessage({ name: '박민수', group: '친구' }, inv, url, 'formal');
  assert.ok(forcedFormal.includes('박민수님, 안녕하세요.'));
});

test('Strategy 3: cashFlowSettlementSummary aggregates deposits, balances, monthly savings, and couple split text', () => {
  const content = {
    invitation: { partner1: '신랑 김희엽', partner2: '신부 유미혜', date: '2027-06-05' },
    honeymoon: [{ id: 'bali', title: '발리 6박', budget: 6500000 }]
  };
  const prefs = {
    venueSim: { mealPrice: 60000, guestCount: 200, minGuarantee: 150, hallFee: 3000000, deposit: 2000000 },
    sdmSim: { packageFee: 3200000, helperFee: 250000, extraFee: 550000, deposit: 1000000, roadScene: false, nightShoot: false },
    homeItems: [{ id: 'h1', category: '📺 가전', name: 'TV', status: '계약·결제 완료', plannedPrice: 2500000, actualPrice: 2400000, deposit: 400000 }],
    tripSelected: 'bali',
    tripQuotes: { bali: { total: 6000000, agency: '직판' } },
    budgetPlan: { snap: { planned: 1500000, actual: 1400000 }, rings: { planned: 3000000, actual: null } },
    weddingDayEnvelopes: [{ id: 'e1', payee: '사회자', amount: 300000, ready: false }]
  };

  const cf = cashFlowSettlementSummary({ prefs, content, now: new Date('2026-12-05T00:00:00Z') });
  // venue: 15,000,000 (dep 2M), sdm: 4,000,000 (dep 1M), honey: 6,000,000, living: 2,400,000 (dep 400k), snap: 1,400,000, rings: 3,000,000
  assert.equal(cf.enteredCount, 6);
  assert.equal(cf.totalCost, 31800000);
  assert.equal(cf.totalDeposit, 3400000);
  assert.equal(cf.totalRemaining, 28400000);
  assert.equal(cf.dayCashTotal, 300000);
  assert.equal(cf.dayCashPending, 300000);
  assert.ok(cf.monthsUntilWedding >= 6 && cf.monthlySavingsNeeded > 0);

  const summary = buildCashFlowSummaryText(cf, { groomRatio: 60, inv: content.invitation });
  assert.ok(summary.includes('분담 비율 (60:40)') && summary.includes('28,400,000원') && summary.includes('김희엽 (60%)') && summary.includes('유미혜 (40%)'));
});

test('Strategy 4 & 5: album onboarding steps, publish preflight evaluator, and SW offline font completeness', () => {
  assert.equal(ALBUM_ONBOARDING_STEPS.length, 3);

  const partial = evaluatePublishPreflight({
    invitation: { partner1: '김희엽', partner2: '유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르', message: '초대합니다' },
    albums: [],
    stories: []
  });
  assert.equal(partial.readinessCount, 3);
  assert.equal(partial.readinessTotal, 8);
  assert.equal(partial.isReadyForGuests, false);
  assert.ok(partial.missingLabels.includes('웨딩 포토 앨범'));

  const ready = evaluatePublishPreflight({
    invitation: {
      partner1: '김희엽', partner2: '유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르',
      message: '초대합니다', groomParents: '아버님·어머님', transit: '자가용 안내', contacts: '연락처', rsvpUrl: 'https://example.com'
    },
    albums: [{ images: ['./assets/photo.webp'] }],
    stories: [{ title: '첫 만남' }]
  });
  assert.equal(ready.readinessCount, 8);
  assert.equal(ready.isReadyForGuests, true);
  assert.equal(ready.hasCover, true);

  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const font of ['Paperlogy-7Bold.woff2', 'SUITE-Regular.woff2', 'SUITE-SemiBold.woff2', 'SUITE-Bold.woff2']) {
    assert.ok(sw.includes(`./assets/fonts/${font}`), `sw.js must precache ${font}`);
  }
});
