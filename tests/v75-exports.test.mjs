import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  budgetPlanToCsv,
  buildBudgetSummaryText,
  cashFlowSettlementSummary,
  parseCsvRows,
  CEREMONY_BGM_SLOTS,
  CEREMONY_STEP_BGM_MAP
} from '../assets/js/planning.js';
import { buildDayOpsSummaryText } from '../assets/js/wedding-day-ui.js';
import { buildAmorMcScriptText, buildCeremonyPlanSummaryText } from '../assets/js/ceremony-ui.js';

test('v75: wedding-day ops summary & print sheet include entered ceremony BGM cue sheet and stay compact when empty', () => {
  const inv = { partner1: '김희엽', partner2: '유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층' };
  const sum = { assignedRoles: 1, roleCount: 1, readyCount: 1, envelopeCount: 1, totalEnvelopeAmount: 300000, pendingAmount: 0 };
  const roles = [{ group: '진행·안내·운전', role: '사회자', assignee: '홍길동', phone: '010-1234-5678' }];
  const envelopes = [{ payee: '사회자', recipient: '홍길동', amount: 300000, ready: true }];

  const withoutBgm = buildDayOpsSummaryText(inv, roles, envelopes, '1. 양가 가족', sum, {});
  assert.ok(!withoutBgm.includes('[4] 본식 BGM'), 'Should omit BGM section when no BGM entries exist');

  const bgmMap = {
    'bgm-groom': { song: 'Bruno Mars - Marry You', cue: '0:00 시작', ready: true },
    'bgm-parents': { song: '이루마 - River Flows in You', cue: '잔잔하게 페이드인', ready: false }
  };
  const withBgm = buildDayOpsSummaryText(inv, roles, envelopes, '1. 양가 가족', sum, bgmMap);
  assert.match(withBgm, /\[4\] 본식 BGM · 음향 큐시트 \(선곡 2\/9 · 음원 확보 1\/2\)/);
  assert.match(withBgm, /STEP 04 · 신랑 입장: Bruno Mars - Marry You \[0:00 시작\] \(음원 확보 ✅\)/);
  assert.match(withBgm, /STEP 09 · 양가·내빈 인사: 이루마 - River Flows in You \[잔잔하게 페이드인\] \(준비 중\)/);

  const dayOpsJs = readFileSync(new URL('../assets/js/wedding-day-ui.js', import.meta.url), 'utf8');
  assert.ok(dayOpsJs.includes("'4. 본식 BGM · 음향 큐시트'"), 'printDayOpsSheet must include section 4 BGM table');
  assert.ok(dayOpsJs.includes('BGM ${bgmReady}/${bgmRows.length} 확보'), 'printDayOpsSheet header must include BGM KPI badge');
});

test('v75: MC script copy & ceremony plan summary copy automatically embed per-STEP BGM cues', () => {
  const inv = { partner1: '김희엽', partner2: '유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층' };
  const bgmMap = {
    'bgm-pre': { song: 'Chet Baker - Almost Blue', cue: '식전 반복 재생', ready: true },
    'bgm-groom': { song: 'Bruno Mars - Marry You', cue: '박수 후 즉시 재생', ready: true },
    'bgm-parents': { song: '김동률 - 감사', cue: '신부 부모님 인사 시작', ready: false },
    'bgm-song': { song: '아카펠라 라이브', cue: '마이크 4대', ready: true }
  };

  const mcText = buildAmorMcScriptText(inv, {}, bgmMap);
  assert.match(mcText, /식전 BGM: Chet Baker - Almost Blue \[식전 반복 재생\] \(음원 확보 ✅\)/);
  assert.match(mcText, /\[04\. 신랑 입장\][\s\S]*🎼 BGM: Bruno Mars - Marry You \[박수 후 즉시 재생\] \(음원 확보 ✅\)/);
  assert.match(mcText, /\[09\. 혼주 및 내빈께 인사\][\s\S]*🎼 BGM: 김동률 - 감사 \[신부 부모님 인사 시작\] \(준비 중\)/);
  assert.match(mcText, /\[10\. 축가\][\s\S]*🎼 BGM: 아카펠라 라이브 \[마이크 4대\] \(음원 확보 ✅\)/);

  const mcEmpty = buildAmorMcScriptText(inv, {}, {});
  assert.ok(!mcEmpty.includes('🎼 BGM:'), 'Should not add BGM cue lines when bgmMap is empty');

  const orderSteps = [
    '04. 신랑 입장 (버진로드 위 대기 후 입장)',
    '09. 혼주 및 내빈께 인사 (① 신부 부모님 → ② 신랑 부모님 → ③ 중앙 내빈)',
    '10. 축가 (아카펠라 · 혼주·내빈 인사 다음 순서)'
  ];
  const summaryText = buildCeremonyPlanSummaryText([['15:00', '본식 시작', '개식']], orderSteps, {}, inv, '15:00', true, bgmMap);
  assert.match(summaryText, /04\. 신랑 입장 .* — 🎼 Bruno Mars - Marry You \[박수 후 즉시 재생\]/);
  assert.match(summaryText, /09\. 혼주 및 내빈께 인사 .* — 🎼 김동률 - 감사/);
  assert.match(summaryText, /\[선곡된 본식 BGM · 선곡 4\/9 · 확보 3\/9\]/);

  assert.equal(CEREMONY_BGM_SLOTS.length, 9);
  assert.equal(CEREMONY_STEP_BGM_MAP['09'], 'bgm-parents');
  assert.equal(CEREMONY_STEP_BGM_MAP['10'], 'bgm-song');
});

test('v75: guest print sheet includes banquet 8-seat/10-seat table count KPI when meal headcount > 0', () => {
  const guestJs = readFileSync(new URL('../assets/js/guest-ledger-ui.js', import.meta.url), 'utf8');
  assert.ok(guestJs.includes('const tables = estimateBanquetTables(summary.mealHeadcount);'));
  assert.ok(guestJs.includes('연회 8인 ${tables.tables8} / 10인 ${tables.tables10}테이블'));
});

test('v75: budget summary text & CSV append deposit/balance cashflow, monthly savings, and 2-person split when options provided', () => {
  const plan = {
    venue: { planned: 15000000, actual: 14000000 },
    sdm: { planned: 5000000, actual: 5000000 }
  };
  const prefs = {
    budgetPlan: plan,
    venueSim: { mealPrice: 60000, guestCount: 200, minGuarantee: 200, hallFee: 2000000, deposit: 2000000 },
    sdmSim: { packageFee: 3000000, helperFee: 250000, extraFee: 0, deposit: 500000 }
  };
  const content = { invitation: { date: '2027-06-05', partner1: '김희엽', partner2: '유미혜' } };
  const cf = cashFlowSettlementSummary({ prefs, content, now: new Date('2026-11-26T00:00:00Z') });
  const options = { cashFlow: cf, groomRatio: 60, partner1: '김희엽', partner2: '유미혜' };

  const text = buildBudgetSummaryText(plan, [], options);
  assert.match(text, /\[계약금·잔금 & 2인 분담 현금흐름\]/);
  assert.match(text, /기납부 계약금: 2,500,000원 \/ 남은 잔금: 14,750,000원/);
  assert.match(text, /2인 분담 \(김희엽 60% : 유미혜 40%\): 김희엽 8,850,000원 .* \/ 유미혜 5,900,000원/);

  const csv = budgetPlanToCsv(plan, [], options);
  const rows = parseCsvRows(csv);
  const depositRow = rows.find(r => r[0] === '기납부 계약금 합계');
  const remainRow = rows.find(r => r[0] === '남은 잔금 합계');
  const splitRow = rows.find(r => r[0].startsWith('2인 분담 (김희엽 60% : 유미혜 40%)'));
  assert.ok(depositRow && depositRow[2] === '2500000');
  assert.ok(remainRow && remainRow[2] === '14750000');
  assert.ok(splitRow && splitRow[1] === '8850000' && splitRow[2] === '5900000');
  assert.match(splitRow[4], /김희엽 월 .*원 \/ 유미혜 월 .*원/);
});
