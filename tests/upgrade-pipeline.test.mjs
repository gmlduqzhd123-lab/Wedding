import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseContent, extractGuestContent } from '../assets/js/content.js';
import { nextVersionLabel, replaceVersionInText } from '../scripts/bump-version.mjs';
import { sanitizeSlug, detectImageBackend, optimizeAlbumPhotos } from '../scripts/optimize-photos.mjs';
import { computeDonutSegments, computeRatioSegments } from '../assets/js/charts.js';
import { searchWeddingWorkspace } from '../assets/js/search-ui.js';

test('extractGuestContent derives a lightweight valid guest-only JSON from site.json', async () => {
  const full = parseContent(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
  const guest = extractGuestContent(full);
  const roundTripped = parseContent(JSON.stringify(guest));
  assert.deepEqual(roundTripped.invitation, full.invitation);
  assert.deepEqual(roundTripped.stories, full.stories);
  assert.deepEqual(roundTripped.albums, full.albums);
  assert.equal(roundTripped.honeymoon.length, 0);
  assert.equal(roundTripped.tips.length, 0);
  assert(JSON.stringify(guest).length < JSON.stringify(full).length / 10, 'Guest JSON must be drastically smaller than full site.json');
});

test('bump-version helpers increment version labels and update query and SW cache strings uniformly', () => {
  assert.equal(nextVersionLabel('wedding-features-54'), 'wedding-features-55');
  assert.throws(() => nextVersionLabel('no-number'));
  const sample = `const CACHE_VERSION = 'wedding-features-54';\nimport './a.js?v=wedding-features-54';\n<link href="./assets/css/planner.css?v=wedding-features-54">`;
  const bumped = replaceVersionInText(sample, 'wedding-features-55');
  assert(!bumped.includes('wedding-features-54'));
  assert.equal((bumped.match(/wedding-features-55/g) || []).length, 3);
});

test('optimizeAlbumPhotos creates web copies without altering originals and safely applies to temp site.json', async (t) => {
  const backend = detectImageBackend();
  if (!backend) {
    t.skip('No image conversion backend available in environment');
    return;
  }
  assert.equal(sanitizeSlug('Lachma 2027!'), 'lachma-2027');
  assert.throws(() => sanitizeSlug('   '));

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'wedding-photos-test-'));
  try {
    const srcDir = path.join(tmp, 'originals');
    const outRoot = path.join(tmp, 'web');
    const tempSite = path.join(tmp, 'site.json');
    await writeFile(tempSite, await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
    // Generate two oversized sample PNGs via python3 Pillow
    execFileSync('python3', ['-c', `
import os, sys
from PIL import Image
os.makedirs(sys.argv[1], exist_ok=True)
Image.new("RGB", (2400, 1600), (110, 144, 119)).save(os.path.join(sys.argv[1], "IMG_001.png"))
Image.new("RGBA", (1800, 2200), (201, 122, 112, 255)).save(os.path.join(sys.argv[1], "IMG_002.png"))
`, srcDir]);

    const orig1Before = await readFile(path.join(srcDir, 'IMG_001.png'));
    const result = await optimizeAlbumPhotos({
      src: srcDir,
      album: 'lachma-test',
      title: '테스트 촬영 앨범',
      date: '2027-02-03',
      body: '원본 보존 테스트',
      max: 1200,
      quality: 80,
      format: 'webp',
      apply: true,
      outRoot,
      sitePath: tempSite
    });

    assert.equal(result.count, 2);
    assert.equal(result.applied, true);
    for (const f of result.files) {
      const s = await stat(f.output);
      assert(s.size > 0);
      if (f.width && f.height) assert(Math.max(f.width, f.height) <= 1200);
    }
    // Original file bytes must be 100% untouched
    const orig1After = await readFile(path.join(srcDir, 'IMG_001.png'));
    assert.deepEqual(orig1After, orig1Before);

    // Temp site.json must validate cleanly and include the new album
    const updatedSite = parseContent(await readFile(tempSite, 'utf8'));
    assert.equal(updatedSite.albums.length, 1);
    assert.equal(updatedSite.albums[0].id, 'album-lachma-test');
    assert.equal(updatedSite.albums[0].images.length, 2);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('computeDonutSegments and computeRatioSegments compute accurate percentages and handle zero totals', () => {
  assert.deepEqual(computeDonutSegments([]), { total: 0, segments: [] });
  assert.deepEqual(computeDonutSegments([{ key: 'a', value: 0 }]), { total: 0, segments: [] });

  const donut = computeDonutSegments([
    { key: 'venue', value: 15000000 },
    { key: 'sdm', value: 3000000 },
    { key: 'honeymoon', value: 6000000 },
    { key: 'empty', value: 0 }
  ]);
  assert.equal(donut.total, 24000000);
  assert.equal(donut.segments.length, 3);
  assert.equal(donut.segments[0].startPct, 0);
  assert.equal(donut.segments[0].roundedPct, 63);
  assert.equal(donut.segments[1].roundedPct, 13);
  assert.equal(donut.segments[2].roundedPct, 25);
  assert(Math.abs(donut.segments.reduce((sum, s) => sum + s.pct, 0) - 100) < 0.001);

  const emptyRatio = computeRatioSegments([{ label: '신랑 측', value: 0 }, { label: '신부 측', value: 0 }]);
  assert.equal(emptyRatio.total, 0);
  assert.equal(emptyRatio.items[0].pct, 0);

  const ratio = computeRatioSegments([
    { label: '신랑 측', value: 60 },
    { label: '신부 측', value: 30 },
    { label: '공통', value: 10 }
  ]);
  assert.equal(ratio.total, 100);
  assert.deepEqual(ratio.items.map(i => i.pct), [60, 30, 10]);
});

test('searchWeddingWorkspace finds menu commands, honeymoon trips, tips, and private records', async () => {
  const full = parseContent(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
  const samplePrefs = {
    guestList: [{ id: 'g1', name: '홍길동', side: '신랑 측', group: '친구', partySize: 2, rsvp: '참석', note: '대학 동기' }],
    giftLedger: [{ id: 'gf1', name: '김영희', side: '신부 측', group: '직장', channel: '축의대(현금)', amount: 100000, mealTickets: 1, note: '' }],
    homeItems: [{ id: 'h1', category: '가전', name: '비스포크 냉장고', brand: '삼성', status: '계약 완료', deliveryDate: '2027-05-20' }]
  };

  // Empty query returns top shortcuts
  const defaults = searchWeddingWorkspace('', { content: full, prefs: samplePrefs });
  assert.equal(defaults.length, 10);

  // Menu shortcut match
  const lachma = searchWeddingWorkspace('헬퍼비 25만원', { content: full, prefs: samplePrefs });
  assert(lachma.some(r => r.route === 'studios'), 'Should match Lachma studio helper fee shortcut');

  // Honeymoon trip match
  const bali = searchWeddingWorkspace('발리', { content: full, prefs: samplePrefs });
  assert(bali.some(r => r.category === '신혼여행' && r.focusTripId), 'Should match Bali honeymoon candidates');

  // Tip match
  const tipHit = searchWeddingWorkspace(full.tips[0].title.slice(0, 6), { content: full, prefs: samplePrefs });
  assert(tipHit.some(r => r.category === '결혼 꿀팁' && r.subTab === 'tips'), 'Should match curated wedding tips');

  // Private guest / gift / home item matches
  assert(searchWeddingWorkspace('홍길동', { content: full, prefs: samplePrefs }).some(r => r.category === '하객 명단' && r.subTab === 'guests'));
  assert(searchWeddingWorkspace('김영희', { content: full, prefs: samplePrefs }).some(r => r.category === '축의금 장부' && r.subTab === 'gifts'));
  assert(searchWeddingWorkspace('비스포크', { content: full, prefs: samplePrefs }).some(r => r.category === '혼수·가전' && r.subTab === 'home'));
});
