import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePreferences,
  pruneTripPreferences,
  mergePreferences,
  summarizePreferencesMerge
} from '../assets/js/preferences.js';
import { encodeSyncCode, decodeSyncCode, summarizePreferenceCounts } from '../assets/js/sync-code.js';
import { SHOOT_OUTFIT_TEMPLATES, buildShootBriefCopyText } from '../assets/js/studio-ui.js';
import {
  CEREMONY_BGM_SLOTS,
  estimateSpeechDuration,
  ceremonyBgmSummary,
  buildBgmCueSheetText,
  buildRoleBriefingPack
} from '../assets/js/ceremony-ui.js';
import { parseStructuredGuideLines } from '../assets/js/invitation-ui.js';
import { STORY_PROMPT_CARDS } from '../assets/js/story-album-ui.js';
import { formatTripQuoteDelta } from '../assets/js/travel-ui.js';
import { analyzeStorageHealth } from '../assets/js/manager-ui.js';

test('Round 10 preferences: shootBrief, ceremonyBgm, tripQuotes validate, prune, merge, and sync cleanly', async () => {
  const groom = validatePreferences({
    shootBrief: {
      moodNote: '자연광 창가 컷, 편안한 웃음 위주',
      avoidNote: '과한 턱 당기기 포즈 지양',
      outfits: [
        { id: 'o-1', label: '메인 풍성 드레스', hair: '로우번 + 티아라', props: '화이트 부케', poses: '베일 날림 컷' }
      ],
      milestones: { originalDate: '2027-02-10', selectDate: '2027-02-20', retouchDate: '2027-04-01', originalDone: true, selectDone: false, retouchDone: false }
    },
    ceremonyBgm: {
      'groom-in': { song: 'Bruno Mars - Marry You', cue: '0:00 시작', ready: true },
      'march-out': { song: 'Coldplay - Viva La Vida', cue: '0:15 후렴', ready: false }
    },
    tripQuotes: {
      'bali-nusa-dua': { total: 6450000, airfare: 2100000, lodging: 4350000, agency: '하나투어 직판', perks: '플로팅 조식 + 스파', cancelUntil: '2027-04-30', checkedOn: '2026-11-26' },
      'removed-trip': { total: 5000000, agency: '테스트' }
    }
  });

  // Prune removes quotes for deleted trips while preserving active ones
  const pruned = pruneTripPreferences(groom, [{ id: 'bali-nusa-dua' }]);
  assert.ok(pruned.tripQuotes['bali-nusa-dua']);
  assert.equal(pruned.tripQuotes['removed-trip'], undefined);

  // Sync code roundtrip preserves all Round 10 fields
  const counts = summarizePreferenceCounts(pruned);
  assert.equal(counts.totalItems >= 4, true);
  const { code } = await encodeSyncCode(pruned);
  const decoded = await decodeSyncCode(code);
  assert.deepEqual(decoded, pruned);

  // Merge combines independent entries from groom & bride without data loss
  const bride = validatePreferences({
    shootBrief: {
      moodNote: '정원 씬은 따뜻한 햇살 느낌',
      outfits: [
        { id: 'o-2', label: '캐주얼 커플룩', hair: '반묶음 웨이브', props: '선글라스', poses: '손잡고 걷기' }
      ],
      milestones: { selectDone: true }
    },
    ceremonyBgm: {
      'bride-in': { song: 'Pachelbel - Canon in D', cue: '피아노 편곡', ready: true }
    },
    tripQuotes: {
      'cebu-mactan': { total: 4950000, agency: '모두투어', checkedOn: '2026-11-26' }
    }
  });
  const merged = mergePreferences(bride, pruned);
  assert.equal(merged.shootBrief.outfits.length, 2);
  assert.equal(merged.shootBrief.milestones.originalDone, true);
  assert.equal(merged.shootBrief.milestones.selectDone, true);
  assert.ok(merged.shootBrief.moodNote.includes('따뜻한 햇살') && merged.shootBrief.moodNote.includes('자연광 창가'));
  assert.ok(merged.ceremonyBgm['groom-in']?.ready && merged.ceremonyBgm['bride-in']?.ready);
  assert.ok(merged.tripQuotes['bali-nusa-dua'] && merged.tripQuotes['cebu-mactan']);

  const diff = summarizePreferencesMerge(bride, merged);
  assert.equal(diff.customItemsAdded, 1);
  assert.ok(diff.notesUpdated >= 3);

  // Rejects malformed Round 10 inputs
  assert.throws(() => validatePreferences({ tripQuotes: { 'bad': { total: -500 } } }), /실견적 금액/);
  assert.throws(() => validatePreferences({ tripQuotes: { 'bad': { cancelUntil: '2027-99-99' } } }), /무료 취소 마감일/);
  assert.throws(() => validatePreferences({ ceremonyBgm: { 'groom-in': { ready: 'yes' } } }), /음원 확보 여부/);
  assert.throws(() => validatePreferences({ shootBrief: { outfits: [{ id: 'x', label: '' }] } }), /착장 이름/);
});

test('Pillar 1: shoot brief templates and KakaoTalk copy builder format cleanly', () => {
  assert.equal(SHOOT_OUTFIT_TEMPLATES.length, 4);
  const text = buildShootBriefCopyText({
    moodNote: '창가 역광 컷 강조',
    avoidNote: '과도한 피부 보정 X',
    outfits: [SHOOT_OUTFIT_TEMPLATES[0]],
    milestones: { originalDate: '2027-02-10', originalDone: true, selectDone: false, retouchDone: false }
  }, { name: '라크마 스튜디오' });
  assert.ok(text.includes('라크마 스튜디오'));
  assert.ok(text.includes('창가 역광 컷 강조'));
  assert.ok(text.includes(SHOOT_OUTFIT_TEMPLATES[0].label));
  assert.ok(text.includes('2027-02-10'));
});

test('Pillar 2: speech duration estimator, 9-slot BGM cue sheet, and 3-role briefing pack', () => {
  assert.equal(CEREMONY_BGM_SLOTS.length, 9);
  const shortEst = estimateSpeechDuration('안녕하세요 반갑습니다');
  assert.ok(shortEst.chars > 0 && shortEst.seconds >= 1 && shortEst.label.includes('초'));
  const longText = '신랑 김희엽과 신부 유미혜는 오늘 많은 하객 여러분 앞에서 서로를 존중하고 아끼며 평생을 함께할 것을 굳게 약속합니다. '.repeat(12);
  const longEst = estimateSpeechDuration(longText);
  assert.ok(longEst.seconds >= 60 && longEst.label.includes('분'));

  const bgmMap = {
    'bgm-groom': { song: 'Marry You', cue: '0:00 시작', ready: true },
    'bgm-bride': { song: 'Canon in D', cue: '문 열릴 때', ready: false }
  };
  const summary = ceremonyBgmSummary(bgmMap);
  assert.equal(summary.total, 9);
  assert.equal(summary.assigned, 2);
  assert.equal(summary.ready, 1);

  const cueSheet = buildBgmCueSheetText(bgmMap, { venue: '순천아모르웨딩컨벤션', date: '2027-06-05', time: '14:00' }, { mc: '김희엽 친구' });
  assert.ok(cueSheet.includes('순천아모르웨딩컨벤션') && cueSheet.includes('Marry You') && cueSheet.includes('Canon in D'));

  const inv = { partner1: '신랑 김희엽', partner2: '신부 유미혜', venue: '순천아모르웨딩컨벤션', date: '2027-06-05', time: '14:00', address: '전남 순천시 ...' };
  const cPlan = { style: 'noOfficiant', mc: '김희엽 친구', song: '아카펠라', speech: '교장선생님' };
  const mcPack = buildRoleBriefingPack('mc', inv, cPlan, bgmMap);
  const speechPack = buildRoleBriefingPack('speech', inv, cPlan, bgmMap);
  const songPack = buildRoleBriefingPack('song', inv, cPlan, bgmMap);
  assert.ok(mcPack.includes('김희엽 친구') && mcPack.includes('Marry You'));
  assert.ok(speechPack.includes('교장선생님') && speechPack.includes('성혼선언'));
  assert.ok(songPack.includes('아카펠라') && songPack.includes('마이크'));
});

test('Pillar 3: structured invitation transit/notice parser and 4 story prompt cards', () => {
  const structured = parseStructuredGuideLines('· 자가용: 순천IC에서 10분 거리\n· KTX/기차: 순천역 하차 후 택시 12분\n· 주차: 본관 지하 300대 무료');
  assert.equal(structured.structured, true);
  assert.equal(structured.items.length, 3);
  assert.equal(structured.items[0].icon, '🚗');
  assert.equal(structured.items[1].icon, '🚆');
  assert.equal(structured.items[2].icon, '🅿️');

  const plain = parseStructuredGuideLines('예식 30분 전부터 여유 있게 입장하실 수 있습니다.');
  assert.equal(plain.structured, false);

  assert.equal(STORY_PROMPT_CARDS.length, 4);
  for (const card of STORY_PROMPT_CARDS) {
    assert.ok(card.title && card.hint && card.starter);
  }
});

test('Pillar 4: formatTripQuoteDelta computes plan-vs-quote delta accurately', () => {
  const cheaper = formatTripQuoteDelta({ budget: 6000000 }, { total: 5550000, agency: '하나투어', perks: '스파 포함', cancelUntil: '2027-05-01' });
  assert.equal(cheaper.effectiveTotal, 5550000);
  assert.equal(cheaper.deltaKind, 'cheaper');
  assert.equal(cheaper.deltaLabel, '계획 대비 -45만 원 절감');
  assert.ok(cheaper.summaryText.includes('5,550,000원') && cheaper.summaryText.includes('하나투어'));

  const over = formatTripQuoteDelta({ budget: 5000000 }, { total: null, airfare: 2100000, lodging: 3200000 });
  assert.equal(over.effectiveTotal, 5300000);
  assert.equal(over.deltaKind, 'over');
  assert.equal(over.deltaLabel, '계획 대비 +30만 원 초과');

  const exact = formatTripQuoteDelta({ budget: 5000000 }, { total: 5000000 });
  assert.equal(exact.deltaKind, 'same');
  assert.equal(exact.deltaLabel, '계획예산과 동일');
});

test('Pillar 5: analyzeStorageHealth classifies keys, counts inline images, and flags stale keys', () => {
  const data = new Map([
    ['wedding:v1:draft', JSON.stringify({ albums: [{ images: ['data:image/jpeg;base64,AAA', 'data:image/webp;base64,BBB'] }] })],
    ['wedding:v1:preferences', JSON.stringify({ favorites: ['s1'] })],
    ['wedding:v1:prefRollback', JSON.stringify({ savedAt: 1, preferences: {} })],
    ['wedding:v1:theme', 'dark'],
    ['wedding:v0:legacyCache', 'old-temp-value-123456'],
    ['unrelated:key', 'should-be-ignored']
  ]);
  const keys = [...data.keys()];
  const mockStorage = {
    length: keys.length,
    key: i => keys[i] ?? null,
    getItem: k => data.get(k) ?? null
  };

  const health = analyzeStorageHealth(mockStorage, { maxQuota: 1000 });
  assert.equal(health.inlineImageCount, 2);
  assert.deepEqual(health.staleKeys, ['wedding:v0:legacyCache']);
  assert.equal(health.otherKeys.length, 2, 'Should track wedding:v1:theme and stale key, ignoring unrelated:key');
  assert.ok(health.draftBytes > 0 && health.prefBytes > 0 && health.rollbackBytes > 0 && health.otherBytes > 0);
  assert.equal(health.totalBytes, health.draftBytes + health.prefBytes + health.rollbackBytes + health.otherBytes);
  assert.equal(health.level, 'ok');

  const warnHealth = analyzeStorageHealth(mockStorage, { maxQuota: Math.round(health.totalBytes / 0.65) });
  assert.equal(warnHealth.level, 'warn');
  const critHealth = analyzeStorageHealth(mockStorage, { maxQuota: Math.round(health.totalBytes / 0.85) });
  assert.equal(critHealth.level, 'critical');
});
