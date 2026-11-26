import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ledger from '../assets/js/ledger.js';
import * as planning from '../assets/js/planning.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';
import { buildGuestInvitationSummaryText } from '../assets/js/invitation-ui.js';
import { buildStoriesSummaryText } from '../assets/js/story-album-ui.js';
import { buildRemainingShootPrepText } from '../assets/js/studio-ui.js';

const studios = JSON.parse(readFileSync(new URL('../data/studios.json', import.meta.url), 'utf8'));
const lachma = studios.find(s => s.id === 'studio-09');

test('ledger.js split preserves exact re-export contract and behavior with planning.js', () => {
  for (const name of [
    'guestListSummary',
    'giftLedgerSummary',
    'csvEscape',
    'guestsToCsv',
    'giftsToCsv',
    'parseCsvRows',
    'RSVP_FORM_GUIDE_TEXT',
    'parseGuestsCsv',
    'syncGuestsFromCsv',
    'buildThankYouMessage',
    'computeCashDenominations',
    'estimateBanquetTables',
    'crossCheckGuestsAndGifts'
  ]) {
    assert.equal(typeof planning[name], typeof ledger[name], `planning.${name} must match type of ledger.${name}`);
    assert.ok(planning[name] !== undefined, `planning.${name} must be exported`);
  }
  const sampleGuests = [{ id: 'g1', name: '홍길동', side: '신랑 측', group: '친구', partySize: 2, inviteStatus: '모바일 발송', rsvp: '참석', mealTicket: true }];
  const sampleGifts = [{ id: 'gf1', name: '홍길동', side: '신랑 측', group: '친구', channel: '축의대(현금)', amount: 100000, mealTickets: 2, returnGiftDone: true, thankYouDone: false }];
  assert.deepEqual(planning.guestListSummary(sampleGuests), ledger.guestListSummary(sampleGuests));
  assert.deepEqual(planning.giftLedgerSummary(sampleGifts), ledger.giftLedgerSummary(sampleGifts));
  assert.deepEqual(planning.crossCheckGuestsAndGifts(sampleGuests, sampleGifts), ledger.crossCheckGuestsAndGifts(sampleGuests, sampleGifts));
  assert.deepEqual(planning.estimateBanquetTables(25), ledger.estimateBanquetTables(25));
});

test('searchWeddingWorkspace indexes stories, albums, day-ops, checklist, and attaches focus payloads', () => {
  const ctx = {
    content: {
      stories: [{ id: 'st-1', title: '여수 밤바다 첫 여행', date: '2025-08-12', body: '첫 장거리 여행 기록' }],
      albums: [{ id: 'al-1', title: '제주 스냅 화보', date: '2026-10-01', body: '가을 억새밭', images: ['a.jpg', 'b.jpg'] }],
      honeymoon: [],
      tips: [{ id: 't-1', title: '드레스 투어 필수 팁', category: '스드메', channel: '웨딩채널', body: '실크 vs 비즈' }]
    },
    prefs: {
      guestList: [{ id: 'g-1', name: '김하객', side: '신랑 측', group: '친구', partySize: 2, rsvp: '참석', note: '동창' }],
      giftLedger: [{ id: 'gf-1', name: '이축의', side: '신부 측', group: '가족', channel: '계좌이체', amount: 200000, mealTickets: 1 }],
      homeItems: [{ id: 'h-1', category: '📺 가전', name: '로봇청소기', brand: '로보락', status: '계약·결제 완료', deliveryDate: '2027-05-01' }],
      weddingDayRoles: [{ id: 'r-1', group: '신부 케어·가방순이', role: '가방순이', assignee: '박민지', note: '13시 도착' }],
      weddingDayEnvelopes: [{ id: 'e-1', payee: '사회자', recipient: '최사회', amount: 200000, ready: false }],
      customChecklist: [{ id: 'c-1', stage: 'D-60 ~ D-30', title: '혼주 한복 가봉 예약' }]
    },
    studio: lachma,
    studios
  };

  const storyHit = searchWeddingWorkspace('여수 밤바다', ctx).find(r => r.id === 'story-st-1');
  assert.equal(storyHit?.route, 'story');
  assert.equal(storyHit?.focusStoryQuery, '여수 밤바다 첫 여행');

  const albumHit = searchWeddingWorkspace('제주 스냅', ctx).find(r => r.id === 'album-al-1');
  assert.equal(albumHit?.route, 'albums');
  assert.equal(albumHit?.focusRecordId, 'al-1');

  const tipHit = searchWeddingWorkspace('드레스 투어', ctx).find(r => r.id === 'tip-t-1');
  assert.equal(tipHit?.focusTipQuery, '드레스 투어 필수 팁');

  const guestHit = searchWeddingWorkspace('김하객', ctx).find(r => r.id === 'guest-g-1');
  assert.equal(guestHit?.focusGuestQuery, '김하객');

  const giftHit = searchWeddingWorkspace('이축의', ctx).find(r => r.id === 'gift-gf-1');
  assert.equal(giftHit?.focusGiftQuery, '이축의');

  const homeHit = searchWeddingWorkspace('로보락', ctx).find(r => r.id === 'home-h-1');
  assert.equal(homeHit?.focusHomeQuery, '로봇청소기');

  const roleHit = searchWeddingWorkspace('박민지', ctx).find(r => r.id === 'dayrole-r-1');
  assert.equal(roleHit?.subTab, 'dayops');

  const envHit = searchWeddingWorkspace('최사회', ctx).find(r => r.id === 'dayenv-e-1');
  assert.equal(envHit?.subTab, 'dayops');

  const chkHit = searchWeddingWorkspace('혼주 한복', ctx).find(r => r.id === 'chk-c-1');
  assert.equal(chkHit?.route, 'home');
  assert.equal(chkHit?.focusElementId, 'home-checklist-title');
});

test('buildGuestInvitationSummaryText formats couple, date/time, venue, address, and URL', () => {
  const text = buildGuestInvitationSummaryText({
    partner1: '신랑 김희엽',
    partner2: '신부 유미혜',
    date: '2027-06-05',
    time: '15:00',
    venue: '순천아모르웨딩컨벤션 1층 아모르홀',
    address: '전라남도 순천시 연향번영길 100'
  }, 'https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation');
  assert.ok(text.includes('김희엽 ♥ 유미혜'));
  assert.ok(text.includes('순천아모르웨딩컨벤션'));
  assert.ok(text.includes('오후 3시'));
  assert.ok(text.includes('https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation'));
});

test('buildStoriesSummaryText orders stories chronologically and handles empty list', () => {
  assert.equal(buildStoriesSummaryText([]), '');
  const text = buildStoriesSummaryText([
    { id: '2', title: '상견례', date: '2026-10-10', body: '양가 첫 인사' },
    { id: '1', title: '첫 만남', date: '2024-03-01', body: '봄날의 시작' }
  ], { partner1: '신랑 김희엽', partner2: '신부 유미혜' });
  assert.ok(text.indexOf('첫 만남') < text.indexOf('상견례'));
  assert.ok(text.includes('김희엽 ♥ 유미혜'));
});

test('buildRemainingShootPrepText filters out checked Lachma prep items cleanly', () => {
  const allText = buildRemainingShootPrepText(lachma, []);
  assert.ok(allText.includes('라크마'));
  assert.ok(allText.includes('남은 촬영 준비물'));

  const allIds = lachma.deepGuide.prepChecklist.flatMap((grp, gi) => grp.items.map((_, ii) => `shoot-${gi}-${ii}`));
  assert.equal(buildRemainingShootPrepText(lachma, allIds), '');
  const oneLeft = buildRemainingShootPrepText(lachma, allIds.slice(1));
  assert.ok(oneLeft.includes('1개 미챙김'));
});
