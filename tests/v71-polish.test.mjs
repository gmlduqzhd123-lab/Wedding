import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CEREMONY_BGM_SLOTS,
  CEREMONY_STEP_BGM_MAP,
  buildAmorMcSteps,
  buildRoleBriefingPack
} from '../assets/js/ceremony-ui.js';
import {
  buildTripComparisonText,
  buildSelectedTripSummaryText
} from '../assets/js/travel.js';
import { reorderOutfits } from '../assets/js/studio-ui.js';

test('v71: ceremony BGM slots, step map, and role briefing packs align with official STEP 09 (parents/guests) and STEP 10 (song)', () => {
  const inv = { partner1: '신랑 김희엽', partner2: '신부 유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층' };
  const steps = buildAmorMcSteps(inv);
  const step09 = steps.find(([no]) => no === '09');
  const step10 = steps.find(([no]) => no === '10');
  assert.ok(step09?.[1].includes('인사'), 'Official STEP 09 must be parents & guests greeting');
  assert.ok(step10?.[1].includes('축가'), 'Official STEP 10 must be congratulatory song');

  const parentsSlot = CEREMONY_BGM_SLOTS.find(([id]) => id === 'bgm-parents');
  const songSlot = CEREMONY_BGM_SLOTS.find(([id]) => id === 'bgm-song');
  assert.ok(parentsSlot?.[1].startsWith('STEP 09'), `bgm-parents must be STEP 09, got: ${parentsSlot?.[1]}`);
  assert.ok(songSlot?.[1].startsWith('STEP 10'), `bgm-song must be STEP 10, got: ${songSlot?.[1]}`);
  assert.equal(CEREMONY_STEP_BGM_MAP['09'], 'bgm-parents');
  assert.equal(CEREMONY_STEP_BGM_MAP['10'], 'bgm-song');
  assert.equal(CEREMONY_STEP_BGM_MAP['04'], 'bgm-groom');

  const songPack = buildRoleBriefingPack('song', inv, {}, { 'bgm-song': { song: '사랑의 서약', cue: '전주 없이 아카펠라', ready: true } });
  assert.ok(songPack.includes('STEP 10') && songPack.includes('STEP 09') && songPack.includes('STEP 11'), 'Song briefing pack must describe STEP 09 -> STEP 10 -> STEP 11 accurately');

  const mcPack = buildRoleBriefingPack('mc', inv, {});
  assert.ok(mcPack.includes('09 양가·내빈 인사 → 10 축가') && mcPack.includes('09. 혼주 및 내빈께 인사') && mcPack.includes('10. 축가'), 'MC briefing pack must list STEP 09 인사 before STEP 10 축가');
});

test('v71: honeymoon KakaoTalk comparison and selected summary include private tripQuotes details', () => {
  const trips = [
    { id: 'cebu-a', title: '세부 샹그릴라 6박', country: '필리핀 세부', startDate: '2027-06-06', endDate: '2027-06-13', budget: 6000000, pros: '프라이빗 비치', cons: '스콜 유의', plan: { stays: [{ region: '막탄', nights: 6 }] } },
    { id: 'bali-a', title: '발리 풀빌라 6박', country: '인도네시아 발리', startDate: '2027-06-06', endDate: '2027-06-13', budget: 6500000, pros: '6월 최적 건기', cons: '차량 정체', plan: { stays: [{ region: '짐바란', nights: 6 }] } }
  ];
  const prefs = {
    tripNotes: { 'cebu-a': '오션윙 업그레이드 문의' },
    tripQuotes: {
      'cebu-a': { total: 5600000, agency: '하나투어 직판', perks: '스파 90분 포함', cancelUntil: '2027-05-01' }
    }
  };

  const compareText = buildTripComparisonText(trips, prefs);
  assert.ok(compareText.includes('내 실견적(개인): 5,600,000원'), 'Comparison copy must include logged private quote total');
  assert.ok(compareText.includes('계획 대비 -40만 절감') && compareText.includes('하나투어 직판') && compareText.includes('스파 90분 포함') && compareText.includes('무료취소 ~2027-05-01'), 'Comparison copy must include delta, agency, perks, and free-cancel date');

  const selectedText = buildSelectedTripSummaryText(trips[0], prefs.tripNotes['cebu-a'], prefs.tripQuotes['cebu-a']);
  assert.ok(selectedText.includes('내 실견적(개인 기록): 5,600,000원') && selectedText.includes('하나투어 직판') && selectedText.includes('오션윙 업그레이드 문의'), 'Selected trip copy must include private quote and note');

  const selectedNoQuote = buildSelectedTripSummaryText(trips[1], '', null);
  assert.ok(!selectedNoQuote.includes('내 실견적'), 'Selected trip copy must omit private quote line when unlogged');
});

test('v71: reorderOutfits swaps adjacent outfits cleanly and clamps at bounds without mutating input', () => {
  const outfits = [
    { id: 'o1', label: '1벌 메인 드레스' },
    { id: 'o2', label: '2벌 슬림 드레스' },
    { id: 'o3', label: '3벌 캐주얼' }
  ];
  const movedDown = reorderOutfits(outfits, 'o1', 1);
  assert.deepEqual(movedDown.map(o => o.id), ['o2', 'o1', 'o3']);
  assert.deepEqual(outfits.map(o => o.id), ['o1', 'o2', 'o3'], 'Original array must not be mutated');

  const movedUp = reorderOutfits(outfits, 'o3', -1);
  assert.deepEqual(movedUp.map(o => o.id), ['o1', 'o3', 'o2']);

  assert.deepEqual(reorderOutfits(outfits, 'o1', -1).map(o => o.id), ['o1', 'o2', 'o3'], 'Top boundary clamps safely');
  assert.deepEqual(reorderOutfits(outfits, 'o3', 1).map(o => o.id), ['o1', 'o2', 'o3'], 'Bottom boundary clamps safely');
  assert.deepEqual(reorderOutfits(outfits, 'missing', 1).map(o => o.id), ['o1', 'o2', 'o3'], 'Unknown ID leaves order intact');
});

test('v71: planner.css has single .photo-call-list definition, .live-cue-bgm-strip styling, and print-shoot-sheet print rule', () => {
  const css = readFileSync(new URL('../assets/css/planner.css', import.meta.url), 'utf8');
  const photoCallMatches = css.match(/^\.photo-call-list\s*\{/gm) || [];
  assert.equal(photoCallMatches.length, 1, `Expected single .photo-call-list definition, got ${photoCallMatches.length}`);
  assert.ok(css.includes('.live-cue-bgm-strip'), 'planner.css must style .live-cue-bgm-strip');
  assert.ok(css.includes('body.print-shoot-sheet > *:not(.print-only-sheet)'), 'planner.css must hide non-sheet nodes for print-shoot-sheet');
  assert.ok(css.includes('body.print-shoot-sheet .print-only-sheet'), 'planner.css must show .print-only-sheet for print-shoot-sheet');
});
