import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { budgetPlanToCsv, buildBudgetSummaryText, parseCsvRows } from '../assets/js/planning.js';
import { hasSubstantialPrivateData, computeBackupReminder, formatBackupTime } from '../assets/js/ui-shell.js';

const root = new URL('../', import.meta.url);

test('budgetPlanToCsv exports UTF-8 BOM, 6 categories, totals, net settlement, and neutralizes formula cells', () => {
  const plan = {
    venue: { planned: 15000000, actual: 14000000, note: '=SUM(A1:A2)' },
    sdm: { planned: 5000000, actual: 4800000, note: '라크마, 드레스' },
    snap: { planned: 2000000, actual: 2000000 },
    rings: { planned: 3000000, actual: 2500000 },
    honeymoon: { planned: 10000000, actual: 9500000 },
    living: { planned: 8000000, actual: 7200000 }
  };
  const gifts = [
    { id: 'g1', name: '김축의', amount: 10000000 },
    { id: 'g2', name: '이축의', amount: 5000000 }
  ];
  const csv = budgetPlanToCsv(plan, gifts);
  assert.equal(csv.startsWith('\uFEFF'), true, 'CSV must include UTF-8 BOM for Excel');
  const rows = parseCsvRows(csv);
  // 1 header + 6 categories + 1 total + 2 gift/net rows = 10 rows
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], ['항목', '목표 예산(원)', '실제 지출·계약(원)', '잔액·차액(원)', '메모']);
  // Formula cell escaped with leading apostrophe
  assert.equal(rows[1][4], "'=SUM(A1:A2)");
  // Totals: planned 43,000,000, actual 40,000,000, diff 3,000,000
  assert.equal(rows[7][0], '6대 항목 합계');
  assert.equal(rows[7][1], '43000000');
  assert.equal(rows[7][2], '40000000');
  assert.equal(rows[7][3], '3000000');
  // Gift total & net actual (40,000,000 - 15,000,000 = 25,000,000, coverage 38%)
  assert.equal(rows[8][0], '축의금 합계');
  assert.equal(rows[8][2], '15000000');
  assert.equal(rows[9][0], '축의금 반영 실부담액');
  assert.equal(rows[9][2], '25000000');
  assert.match(rows[9][4], /38%/);
});

test('buildBudgetSummaryText formats Korean summary with totals and gift net settlement', () => {
  const plan = {
    venue: { planned: 15000000, actual: 14000000, note: '순천아모르' },
    sdm: { planned: 5000000, actual: 5500000 }
  };
  const gifts = [{ id: 'g1', name: '축의', amount: 2000000 }];
  const text = buildBudgetSummaryText(plan, gifts);
  assert.match(text, /\[결혼 준비 통합 예산 요약\]/);
  assert.match(text, /웨딩홀·식대·대관료: 목표 15,000,000원 \/ 실제 14,000,000원 \(순천아모르\)/);
  assert.match(text, /목표 예산 \(2\/6\): 20,000,000원/);
  assert.match(text, /실제 지출·계약 \(2\/6\): 19,500,000원/);
  assert.match(text, /축의금 합계 \(1건\): 2,000,000원/);
  assert.match(text, /축의금 반영 실부담액: 17,500,000원 \(충당률 10%\)/);
});

test('404.html redirects prenatal and valid subtabs while stripping invalid subtabs', async () => {
  const html = await readFile(new URL('404.html', root), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert(scriptMatch, '404.html must contain redirect script');
  const scriptBody = scriptMatch[1];

  const runRedirect = (pathname, search = '') => {
    let redirectedTo = null;
    const sandbox = {
      location: { pathname, search, replace: url => { redirectedTo = url; } },
      window: {}
    };
    vm.runInNewContext(scriptBody, sandbox);
    return redirectedTo;
  };

  assert.equal(runRedirect('/Wedding/prenatal'), '/Wedding/#/prenatal');
  assert.equal(runRedirect('/Wedding/prenatal/subsidy'), '/Wedding/#/prenatal/subsidy');
  assert.equal(runRedirect('/Wedding/ceremony/gifts', '?from=qr'), '/Wedding/?from=qr#/ceremony/gifts');
  assert.equal(runRedirect('/Wedding/tips/budget'), '/Wedding/#/tips/budget');
  assert.equal(runRedirect('/Wedding/tips/invalid-sub'), '/Wedding/#/tips');
  assert.equal(runRedirect('/Wedding/unknown-page'), null);
});

test('ui-shell backup metadata and reminder helpers evaluate private data and staleness accurately', () => {
  assert.equal(hasSubstantialPrivateData({}), false);
  assert.equal(hasSubstantialPrivateData({ checklist: ['only-one'] }), false);
  assert.equal(hasSubstantialPrivateData({ checklist: ['a', 'b'] }), true);
  assert.equal(hasSubstantialPrivateData({ budgetPlan: { venue: { planned: 1000 } } }), true);
  assert.equal(hasSubstantialPrivateData({ prenatalSchedule: { appliedDate: '2026-10-01' } }), true);

  const now = Date.UTC(2026, 10, 25);
  const sample = { guestList: [{ id: 'g1', name: '홍길동' }] };
  assert.equal(computeBackupReminder(sample, { guestMode: true, now, meta: {} }), null);
  assert.equal(computeBackupReminder(sample, { now, meta: {} })?.kind, 'never');
  assert.equal(computeBackupReminder(sample, { now, meta: { snoozeUntil: now + 3600000 } }), null);
  assert.equal(computeBackupReminder(sample, { now, meta: { snoozeUntil: now + 3600000 }, ignoreSnooze: true })?.kind, 'never');
  assert.equal(computeBackupReminder(sample, { now, meta: { lastPrivateBackupAt: now - 5 * 86400000 } }), null);
  const stale = computeBackupReminder(sample, { now, meta: { lastPrivateBackupAt: now - 15 * 86400000 } });
  assert.equal(stale?.kind, 'stale');
  assert.equal(stale?.daysAgo, 15);
  assert.equal(formatBackupTime(0), '아직 백업 이력 없음');
  assert.match(formatBackupTime(now), /2026/);
});

test('index.html includes PWA install trigger and guest-safe OS dark-mode FOUC script', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /id="pwa-install-btn"[^>]*hidden/);
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /view.*!==.*'guest'/);
});
