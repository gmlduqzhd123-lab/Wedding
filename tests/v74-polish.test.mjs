import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeChanges } from '../assets/js/storage.js';

test('v74: 3-way multi-tab merge cleanly merges newer ID-record arrays without false conflicts', () => {
  const base = {
    guestList: [{ id: 'g1', name: '홍길동', rsvp: '미확인' }],
    giftLedger: [{ id: 'f1', name: '홍길동', amount: 100000, thankYouDone: false }],
    homeItems: [{ id: 'h1', name: '냉장고', status: '후보 비교' }],
    weddingDayRoles: [{ id: 'r1', role: '신랑 측 축의대', assignee: '' }],
    weddingDayEnvelopes: [{ id: 'e1', payee: '사회자', ready: false }],
    shootBrief: {
      moodNote: '자연광',
      outfits: [{ id: 'o1', label: '메인 드레스', hair: '로우번' }]
    }
  };
  const tabA = {
    guestList: [
      { id: 'g1', name: '홍길동', rsvp: '참석' },
      { id: 'g2', name: '김영희', rsvp: '미확인' }
    ],
    giftLedger: [
      { id: 'f1', name: '홍길동', amount: 100000, thankYouDone: true },
      { id: 'f2', name: '김영희', amount: 50000, thankYouDone: false }
    ],
    homeItems: [
      { id: 'h1', name: '냉장고', status: '구매 확정' },
      { id: 'h2', name: '세탁기', status: '후보 비교' }
    ],
    weddingDayRoles: [
      { id: 'r1', role: '신랑 측 축의대', assignee: '이철수' },
      { id: 'r2', role: '가방순이', assignee: '박지민' }
    ],
    weddingDayEnvelopes: [
      { id: 'e1', payee: '사회자', ready: true },
      { id: 'e2', payee: '축가자', ready: false }
    ],
    shootBrief: {
      moodNote: '자연광 + 흑백 컷',
      outfits: [
        { id: 'o1', label: '메인 드레스', hair: '로우번 + 티아라' },
        { id: 'o2', label: '유색 드레스', hair: '반묶음' }
      ]
    }
  };
  const tabB = {
    guestList: [
      { id: 'g1', name: '홍길동', rsvp: '미확인' },
      { id: 'g3', name: '박민수', rsvp: '참석' }
    ],
    giftLedger: [
      { id: 'f1', name: '홍길동', amount: 100000, thankYouDone: false },
      { id: 'f3', name: '박민수', amount: 200000, thankYouDone: false }
    ],
    homeItems: [
      { id: 'h1', name: '냉장고', status: '후보 비교' },
      { id: 'h3', name: '소파', status: '배송·설치 완료' }
    ],
    weddingDayRoles: [
      { id: 'r1', role: '신랑 측 축의대', assignee: '' },
      { id: 'r3', role: '부케 받기', assignee: '최유리' }
    ],
    weddingDayEnvelopes: [
      { id: 'e1', payee: '사회자', ready: false },
      { id: 'e3', payee: '촬영·본식 헬퍼', ready: true }
    ],
    shootBrief: {
      moodNote: '자연광',
      avoidNote: '과한 역광 피하기',
      outfits: [
        { id: 'o1', label: '메인 드레스', hair: '로우번' },
        { id: 'o3', label: '캐주얼', hair: '웨이브' }
      ]
    }
  };

  const merged = mergeChanges(base, tabA, tabB);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(new Set(merged.value.guestList.map(x => x.id)), new Set(['g1', 'g2', 'g3']));
  assert.equal(merged.value.guestList.find(x => x.id === 'g1').rsvp, '참석');
  assert.deepEqual(new Set(merged.value.giftLedger.map(x => x.id)), new Set(['f1', 'f2', 'f3']));
  assert.equal(merged.value.giftLedger.find(x => x.id === 'f1').thankYouDone, true);
  assert.deepEqual(new Set(merged.value.homeItems.map(x => x.id)), new Set(['h1', 'h2', 'h3']));
  assert.equal(merged.value.homeItems.find(x => x.id === 'h1').status, '구매 확정');
  assert.deepEqual(new Set(merged.value.weddingDayRoles.map(x => x.id)), new Set(['r1', 'r2', 'r3']));
  assert.equal(merged.value.weddingDayRoles.find(x => x.id === 'r1').assignee, '이철수');
  assert.deepEqual(new Set(merged.value.weddingDayEnvelopes.map(x => x.id)), new Set(['e1', 'e2', 'e3']));
  assert.equal(merged.value.weddingDayEnvelopes.find(x => x.id === 'e1').ready, true);
  assert.equal(merged.value.shootBrief.moodNote, '자연광 + 흑백 컷');
  assert.equal(merged.value.shootBrief.avoidNote, '과한 역광 피하기');
  assert.deepEqual(new Set(merged.value.shootBrief.outfits.map(x => x.id)), new Set(['o1', 'o2', 'o3']));
  assert.equal(merged.value.shootBrief.outfits.find(x => x.id === 'o1').hair, '로우번 + 티아라');

  // Same-record same-field conflict must still be flagged for user review
  const conflictCheck = mergeChanges(
    base,
    { ...base, guestList: [{ id: 'g1', name: '홍길동', rsvp: '참석' }] },
    { ...base, guestList: [{ id: 'g1', name: '홍길동', rsvp: '불참' }] }
  );
  assert.equal(conflictCheck.conflicts.length, 1);
  assert.equal(conflictCheck.conflicts[0].path, 'guestList.records.g1.rsvp');
});

test('v74: 3-way merge supports prenatalChecks, benefitChecks, and concurrent initial creation from empty base', () => {
  const base = {
    prenatalChecks: ['pre-1', 'pre-2'],
    benefitChecks: ['ben-1']
  };
  const tabA = {
    prenatalChecks: ['pre-2', 'pre-3'],
    benefitChecks: ['ben-1', 'ben-2'],
    guestList: [{ id: 'g-a', name: '신랑 친구' }],
    ceremonyBgm: { 'bgm-groom': { song: 'Song A', ready: true } }
  };
  const tabB = {
    prenatalChecks: ['pre-1', 'pre-2', 'pre-4'],
    benefitChecks: ['ben-1', 'ben-3'],
    guestList: [{ id: 'g-b', name: '신부 친구' }],
    ceremonyBgm: { 'bgm-bride': { song: 'Song B', ready: false } }
  };

  const merged = mergeChanges(base, tabA, tabB);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(new Set(merged.value.prenatalChecks), new Set(['pre-2', 'pre-3', 'pre-4']));
  assert.deepEqual(new Set(merged.value.benefitChecks), new Set(['ben-1', 'ben-2', 'ben-3']));
  assert.deepEqual(new Set(merged.value.guestList.map(x => x.id)), new Set(['g-a', 'g-b']));
  assert.equal(merged.value.ceremonyBgm['bgm-groom'].song, 'Song A');
  assert.equal(merged.value.ceremonyBgm['bgm-bride'].song, 'Song B');
});

test('v74: .editor-grid-2 layout & .print-dayops-root A4 print sheet styles and cleanup are wired', () => {
  const plannerCss = readFileSync(new URL('../assets/css/planner.css', import.meta.url), 'utf8');
  assert.match(plannerCss, /\.editor-grid-2\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(plannerCss, /@media\s*\(max-width:\s*720px\)\s*\{[^}]*\.editor-grid-2,/);
  assert.match(plannerCss, /\.print-dayops-root\s+h1\s*\{/);
  assert.match(plannerCss, /\.print-dayops-root\s+h2\s*\{/);
  assert.match(plannerCss, /\.print-dayops-root\s+ul,\s*\.print-dayops-root\s+ol\s*\{/);

  const studioJs = readFileSync(new URL('../assets/js/studio-ui.js', import.meta.url), 'utf8');
  assert.ok(studioJs.includes("document.querySelectorAll('.print-only-sheet').forEach(el => el.remove());"));
  assert.ok(studioJs.includes("class: 'print-sheet-foot'"));
});
