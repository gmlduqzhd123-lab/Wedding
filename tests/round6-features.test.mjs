import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  shootDeadlineSummary,
  collectMasterTimeline,
  estimateBanquetTables,
  crossCheckGuestsAndGifts
} from '../assets/js/planning.js';

const root = new URL('../', import.meta.url);

test('shootDeadlineSummary exposes freeChangeUntil and collectMasterTimeline includes studio free-change, night deadline, and Suncheon grant end', () => {
  const dl = shootDeadlineSummary('2027-02-03', new Date('2026-10-01T00:00:00Z'));
  assert.equal(dl.freeChangeUntil, '2026-11-04');
  assert.equal(dl.nightDeadline, '2027-01-27');

  const events = collectMasterTimeline({
    content: {
      invitation: { partner1: '김희엽', partner2: '유미혜', date: '2027-06-05', time: '15:00', venue: '순천아모르웨딩컨벤션 1층' },
      honeymoon: []
    },
    prefs: {
      marriageRegDate: '2027-06-10',
      homeItems: [{ id: 'h1', name: '냉장고', status: '계약·결제 완료', deliveryDate: '2027-05-20' }]
    },
    now: new Date('2026-10-01T00:00:00Z')
  });
  const ids = events.map(e => e.id);
  assert(ids.includes('master-studio-free-change'), 'Master timeline must include 90-day penalty-free change deadline');
  assert(ids.includes('master-studio-night-deadline'), 'Master timeline must include 7-day night-shoot deadline');
  assert(ids.includes('master-home-h1'), 'Master timeline must include home delivery date');
  assert(ids.includes('master-suncheon-grant-start'), 'Master timeline must include Suncheon grant start');
  assert(ids.includes('master-suncheon-grant-end'), 'Master timeline must include Suncheon grant end deadline');
});

test('estimateBanquetTables computes 8-seat and 10-seat banquet table counts cleanly', () => {
  assert.deepEqual(estimateBanquetTables(0), { headcount: 0, tables8: 0, tables10: 0 });
  assert.deepEqual(estimateBanquetTables(-5), { headcount: 0, tables8: 0, tables10: 0 });
  assert.deepEqual(estimateBanquetTables(1), { headcount: 1, tables8: 1, tables10: 1 });
  assert.deepEqual(estimateBanquetTables(80), { headcount: 80, tables8: 10, tables10: 8 });
  assert.deepEqual(estimateBanquetTables(81), { headcount: 81, tables8: 11, tables10: 9 });
});

test('crossCheckGuestsAndGifts reconciles attending guests against gift ledger normalizing whitespace', () => {
  const guests = [
    { id: 'g1', name: '홍 길동', rsvp: '참석' },
    { id: 'g2', name: '김영희', rsvp: '참석' },
    { id: 'g3', name: '이불참', rsvp: '불참' }
  ];
  const gifts = [
    { id: 'f1', name: '홍길동', amount: 100000 },
    { id: 'f2', name: '박미등록', amount: 50000 }
  ];
  const result = crossCheckGuestsAndGifts(guests, gifts);
  assert.equal(result.matchedGuestCount, 1);
  assert.equal(result.matchedGiftCount, 1);
  assert.deepEqual(result.attendingWithoutGift.map(g => g.name), ['김영희']);
  assert.deepEqual(result.giftsNotInGuestList.map(g => g.name), ['박미등록']);
});

test('PWA manifest includes stable id and existing 192x192 icon, and dark-theme CSS is scoped to screen media', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.id, './');
  const icon192 = manifest.icons.find(i => i.sizes === '192x192');
  assert(icon192, 'manifest.webmanifest must define a 192x192 icon');
  await access(new URL(icon192.src.replace(/^\.\//, ''), root));

  const plannerCss = await readFile(new URL('assets/css/planner.css', root), 'utf8');
  assert.match(plannerCss, /@media screen \{\s*body\.is-dark-theme:not\(\.is-guest-mode\)/);
  const appCss = await readFile(new URL('assets/css/app.css', root), 'utf8');
  assert.match(appCss, /@media print \{\s*html \{/);
});
