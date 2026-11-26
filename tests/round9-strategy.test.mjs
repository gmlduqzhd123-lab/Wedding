import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SYNC_CODE_PREFIX,
  stripEmptyPreferences,
  summarizePreferenceCounts,
  encodeSyncCode,
  decodeSyncCode
} from '../assets/js/sync-code.js';
import { validatePreferences, mergePreferences, summarizePreferencesMerge } from '../assets/js/preferences.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';
import {
  DEFAULT_CEREMONY_PLAN,
  resolveCeremonyPlan,
  defaultAmorDeclarationText,
  buildAmorMcSteps
} from '../assets/js/ceremony-ui.js';

const appCss = readFileSync(new URL('../assets/css/app.css', import.meta.url), 'utf8');
const plannerCss = readFileSync(new URL('../assets/css/planner.css', import.meta.url), 'utf8');

test('sync-code strips empty fields and summarizes personal preference counts accurately', () => {
  const sample = {
    checklist: ['d180-hall', 'd120-shoot'],
    shootChecklist: ['shoot-0-0'],
    notes: { 'studio-09': '자연광 확인' },
    guestList: [
      { id: 'g1', name: '김하객', side: '신랑 측', group: '친구', partySize: 2, inviteStatus: '모바일 발송', rsvp: '참석', mealTicket: true }
    ],
    giftLedger: [
      { id: 'gf1', name: '이축의', side: '신부 측', group: '가족·친척', channel: '축의대(현금)', amount: 100000, mealTickets: 1, returnGiftDone: false, thankYouDone: false }
    ],
    homeItems: [
      { id: 'h1', category: '📺 가전', name: '로봇청소기', brand: '로보락', status: '계약·결제 완료', plannedPrice: 1500000, actualPrice: 1390000, deposit: 300000, deliveryDate: '2027-05-10' }
    ],
    budgetPlan: { venue: { planned: 15000000, actual: 14000000, note: '' } }
  };
  const compact = stripEmptyPreferences(sample);
  assert.ok(compact.guestList.length === 1);
  assert.equal('compare' in compact, false, 'Empty compare array should be stripped');
  assert.equal('tripNotes' in compact, false, 'Empty tripNotes object should be stripped');

  const counts = summarizePreferenceCounts(validatePreferences(sample));
  assert.equal(counts.guests, 1);
  assert.equal(counts.gifts, 1);
  assert.equal(counts.homeItems, 1);
  assert.equal(counts.checks, 3);
  assert.equal(counts.notes, 1);
  assert.equal(counts.hasBudget, true);
  assert.equal(counts.totalItems, 8);
});

test('encodeSyncCode and decodeSyncCode roundtrip cleanly with gzip and KakaoTalk wrapper tolerance', async () => {
  const groomPrefs = validatePreferences({
    checklist: ['d180-hall', 'd120-shoot', 'd60-card'],
    notes: { 'studio-09': '라크마 루나메이크업 10시 15분 출발, 현금 25만 원 준비' },
    tripNotes: { 'trip-bali-01': '풀빌라 업그레이드 견적 문의 완료' },
    guestList: [
      { id: 'g1', name: '박철수', side: '신랑 측', group: '직장·동료', partySize: 2, inviteStatus: '모바일 발송', rsvp: '참석', mealTicket: true, note: '순천 본사' },
      { id: 'g2', name: '최영희', side: '신랑 측', group: '친구', partySize: 1, inviteStatus: '미발송', rsvp: '미확인', mealTicket: true, note: '대학 동기' }
    ],
    homeItems: [
      { id: 'h1', category: '📺 가전', name: 'OLED TV', brand: 'LG', status: '계약·결제 완료', plannedPrice: 2500000, actualPrice: 2300000, deposit: 500000, deliveryDate: '2027-05-01' }
    ],
    budgetPlan: {
      venue: { planned: 15000000, actual: 14500000, note: '순천아모르' },
      honeymoon: { planned: 8000000, actual: 0, note: '발리/유럽 검토' }
    }
  });

  const encoded = await encodeSyncCode(groomPrefs);
  assert.ok(encoded.code.startsWith(SYNC_CODE_PREFIX));
  assert.equal(encoded.compressed, true, 'Realistic preference payload should compress via gzip');
  assert.ok(encoded.codeLength < encoded.rawBytes * 1.1, 'Compressed base64url code should stay compact');

  // Wrap in realistic KakaoTalk chat message text
  const kakaoMessage = `[💑 우리의 결혼 기록 동기화 코드]\n자기야 오늘 정리한 하객·혼수 내역이야!\n\n${encoded.code}\n\n앱에서 붙여넣기 해줘 ❤️`;
  const decoded = await decodeSyncCode(kakaoMessage);
  assert.deepEqual(decoded, groomPrefs);

  // Merge into bride's independent device state
  const bridePrefs = validatePreferences({
    checklist: ['d180-hall', 'd60-mc'],
    giftLedger: [
      { id: 'gf1', name: '이신부친구', side: '신부 측', group: '친구', channel: '계좌이체', amount: 150000, mealTickets: 1, returnGiftDone: true, thankYouDone: false }
    ],
    weddingDayRoles: [
      { id: 'r1', group: '신부 케어·가방순이', role: '가방순이', assignee: '김민지', phone: '010-1234-5678', note: '13시 대기' }
    ]
  });
  const merged = mergePreferences(bridePrefs, decoded);
  const diff = summarizePreferencesMerge(bridePrefs, merged);
  assert.equal(diff.guestsAdded, 2);
  assert.equal(diff.homeItemsAdded, 1);
  assert.equal(merged.giftLedger.length, 1, 'Bride existing gift record must be preserved');
  assert.equal(merged.weddingDayRoles.length, 1, 'Bride existing day-ops role must be preserved');
  assert.equal(merged.guestList.length, 2, 'Groom guests must be merged');
  assert.ok(merged.checklist.includes('d60-mc') && merged.checklist.includes('d120-shoot'));
});

test('decodeSyncCode rejects malformed, truncated, and unsupported sync codes cleanly', async () => {
  await assert.rejects(() => decodeSyncCode(''), /유효한 신랑·신부 동기화 코드/);
  await assert.rejects(() => decodeSyncCode('일반 카톡 메시지입니다'), /유효한 신랑·신부 동기화 코드/);
  await assert.rejects(() => decodeSyncCode('WEDDING-SYNC-V1:G.not_valid_gzip_data_1234'), /압축을 풀지 못했습니다/);
  const wrongVersion = `WEDDING-SYNC-V1:J.${Buffer.from(JSON.stringify({ v: 99, p: {} })).toString('base64url')}`;
  await assert.rejects(() => decodeSyncCode(wrongVersion), /지원하지 않는 동기화 코드 버전/);
});

test('searchWeddingWorkspace exposes Round 9 couple sync and shoot/wedding field ops quick commands', () => {
  const ctx = { content: { stories: [], albums: [], honeymoon: [], tips: [] }, prefs: {}, studios: [] };
  const syncHit = searchWeddingWorkspace('동기화', ctx).find(r => r.id === 'act-couple-sync');
  assert.equal(syncHit?.action, 'couple-sync');

  const shootHit = searchWeddingWorkspace('촬영 당일 현장', ctx).find(r => r.id === 'act-shoot-day');
  assert.equal(shootHit?.action, 'shoot-day');

  const weddingHit = searchWeddingWorkspace('본식 당일 현장', ctx).find(r => r.id === 'act-wedding-day');
  assert.equal(weddingHit?.action, 'wedding-day');
});

test('CSS font budget diet trims unused mobile font weights and defines semantic surface tokens', () => {
  assert.equal(appCss.includes('Paperlogy-6SemiBold.woff2'), false, 'Unused Paperlogy-6SemiBold should not be declared in app.css');
  assert.equal(appCss.includes('SUITE-Medium.woff2'), false, 'Unused SUITE-Medium should not be declared in app.css');
  assert.ok(appCss.includes('Paperlogy-7Bold.woff2') && appCss.includes('SUITE-Regular.woff2'), 'Core display/body fonts must remain');
  for (const token of ['--surface-card', '--surface-elevated', '--surface-subtle', '--surface-accent-soft', '--border-card', '--border-accent']) {
    assert.ok(appCss.includes(`${token}:`), `app.css must define light semantic token ${token}`);
    assert.ok(plannerCss.includes(`${token}:`), `planner.css must define dark semantic token ${token}`);
  }
});

test('ceremony defaults reflect confirmed MC, principal declaration & speech, and a cappella song while honoring custom overrides', () => {
  assert.equal(DEFAULT_CEREMONY_PLAN.mc, '김희엽 친구');
  assert.equal(DEFAULT_CEREMONY_PLAN.song, '아카펠라');
  assert.equal(DEFAULT_CEREMONY_PLAN.speech, '교장선생님');

  const resolved = resolveCeremonyPlan({ banquetFloor: '2층' });
  assert.equal(resolved.mc, '김희엽 친구');
  assert.equal(resolved.song, '아카펠라');
  assert.equal(resolved.speech, '교장선생님');
  assert.equal(resolved.banquetFloor, '2층');

  const inv = { partner1: '신랑 김희엽', partner2: '신부 유미혜', date: '2027-06-05' };
  const decl = defaultAmorDeclarationText(inv, resolved);
  assert.ok(decl.includes('성혼선언 낭독 : 교장선생님'));

  const steps = buildAmorMcSteps(inv, resolved);
  const step02 = steps.find(([no]) => no === '02');
  const step08 = steps.find(([no]) => no === '08');
  const step10 = steps.find(([no]) => no === '10');
  assert.ok(step02[3][0].includes('김희엽 친구'));
  assert.equal(step08[1], '성혼선언문 낭독 및 축사');
  assert.ok(step08[3].join(' ').includes('교장선생님'));
  assert.ok(step10[3].join(' ').includes('아카펠라'));

  const custom = resolveCeremonyPlan({ mc: '김희엽 친구 박민수', song: '아카펠라 5중창', speech: '김○○ 교장선생님' });
  assert.equal(custom.mc, '김희엽 친구 박민수');
  assert.equal(custom.song, '아카펠라 5중창');
  assert.equal(custom.speech, '김○○ 교장선생님');
});

