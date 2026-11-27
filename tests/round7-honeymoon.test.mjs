import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CORE_REGION_KEYS,
  CORE_DESTINATION_GUIDES,
  REGION_DEFS,
  REGION_PACKING_SUGGESTIONS,
  HONEYMOON_AGENCY_QUESTIONS,
  tripRegionInfo,
  isCoreRegionTrip,
  isPoolvillaTrip,
  isNoShoppingTrip,
  isSemiPackageTrip,
  buildRegionMatrix,
  recommendHoneymoonTrips,
  calculateLocalSpending,
  buildTripComparisonText,
  buildSelectedTripSummaryText
} from '../assets/js/travel.js';

const site = JSON.parse(readFileSync(new URL('../data/site.json', import.meta.url), 'utf8'));
const trips = site.honeymoon;

test('buildRegionMatrix summarizes core 4 regions and all 6 direct-flight regions cleanly', () => {
  const coreMatrix = buildRegionMatrix(trips, { coreOnly: true });
  assert.equal(coreMatrix.length, 4);
  assert.deepEqual(coreMatrix.map(r => r.key), ['cebu', 'bali', 'hawaii', 'guam']);

  const fullMatrix = buildRegionMatrix(trips);
  assert.equal(fullMatrix.length, 6);
  assert.deepEqual(fullMatrix.map(r => r.key), ['cebu', 'bali', 'hawaii', 'guam', 'nhatrang', 'danang']);
  for (const reg of fullMatrix) {
    assert.equal(reg.count, 6, `${reg.key} should have 6 plans (1 FIT + 5 agency)`);
    assert.ok(reg.fitTrip, `${reg.key} should have a FIT trip`);
    assert.equal(reg.pkgTrips.length, 5, `${reg.key} should have 5 package trips`);
    assert.equal(typeof reg.minBudget, 'number');
    assert.equal(typeof reg.maxBudget, 'number');
    assert.equal(typeof reg.avgBudget, 'number');
    assert.equal(typeof reg.fitVsPkgDiff, 'number');
    assert.ok(reg.minBudget <= reg.avgBudget && reg.avgBudget <= reg.maxBudget);
  }
});

test('CORE_DESTINATION_GUIDES provides rich structured guides for Cebu, Bali, Hawaii, and Guam', () => {
  assert.deepEqual(Object.keys(CORE_DESTINATION_GUIDES), CORE_REGION_KEYS);
  for (const key of CORE_REGION_KEYS) {
    const g = CORE_DESTINATION_GUIDES[key];
    assert.ok(g.name && g.tagline && g.flightTime && g.juneWeather && g.entryRule);
    assert.ok(g.vibe.length >= 60 && g.areas.length >= 30 && g.bestFor.length >= 20 && g.caution.length >= 20);
    assert.ok(Array.isArray(g.highlights) && g.highlights.length >= 3);
  }
});

test('trip feature classifiers identify core vs more regions, poolvilla, noshopping, and semi-package', () => {
  const regions = new Set(trips.map(t => tripRegionInfo(t).key));
  assert.equal(regions.size, 6);
  assert.equal(trips.filter(isCoreRegionTrip).length, 24);
  assert.equal(trips.filter(t => !isCoreRegionTrip(t)).length, 12);
  assert.ok(trips.some(isPoolvillaTrip));
  assert.ok(trips.some(isNoShoppingTrip));
  assert.ok(trips.some(isSemiPackageTrip));
  assert.equal(tripRegionInfo({ id: 'custom-paris', title: '파리', country: '프랑스' }).key, 'other');
});

test('recommendHoneymoonTrips returns scored top 3 honoring core/region, style, budget, and priority', () => {
  const baliPool = recommendHoneymoonTrips(trips, { maxBudget: 8000000, style: 'any', priority: 'poolvilla', region: 'bali' });
  assert.equal(baliPool.length, 3);
  assert.ok(baliPool.every(r => tripRegionInfo(r.trip).key === 'bali'));
  assert.ok(baliPool[0].reasons.length >= 1);
  assert.ok(isPoolvillaTrip(baliPool[0].trip));

  const coreValueFit = recommendHoneymoonTrips(trips, { maxBudget: 6000000, style: 'fit', priority: 'value', region: 'core' });
  assert.equal(coreValueFit.length, 3);
  assert.ok(coreValueFit.every(r => isCoreRegionTrip(r.trip)));
  assert.ok(coreValueFit[0].trip.budget <= 6000000);
  assert.equal(coreValueFit[0].trip.id, 'cebu');
  assert.ok(coreValueFit[0].reasons.some(r => r.includes('자유여행')));
});

test('calculateLocalSpending computes 2-person totals and manual FX conversions safely', () => {
  const usd = calculateLocalSpending({
    nights: 6,
    dailyFood: 150000,
    activities: 400000,
    spa: 200000,
    transport: 150000,
    tips: 150000,
    shopping: 200000,
    fxRate: 1400,
    currencyUnit: 1
  });
  assert.equal(usd.stayNights, 6);
  assert.equal(usd.foodTotal, 900000);
  assert.equal(usd.totalKrw, 2000000);
  assert.equal(usd.perPersonKrw, 1000000);
  assert.equal(usd.perDayKrw, Math.round(2000000 / 6));
  assert.equal(usd.foreignTotal, Math.round(2000000 / 1400));

  const idr = calculateLocalSpending({ nights: 5, dailyFood: 100000, fxRate: 8.5, currencyUnit: 100 });
  assert.equal(idr.totalKrw, 500000);
  assert.equal(idr.foreignTotal, Math.round((500000 / 8.5) * 100));

  const noFx = calculateLocalSpending({ nights: 6, dailyFood: 100000, fxRate: 0 });
  assert.equal(noFx.foreignTotal, null);
});

test('buildTripComparisonText and buildSelectedTripSummaryText format 3-way comparison and selected summary', () => {
  const sample3 = [trips[0], trips[6], trips[12]];
  const text = buildTripComparisonText(sample3, { tripNotes: { [sample3[0].id]: '특전 문의 완료' } });
  assert.ok(text.includes('신혼여행 후보 3곳 비교 요약'));
  assert.ok(text.includes('최저 예산:'));
  assert.ok(text.includes('특전 문의 완료'));

  const summary = buildSelectedTripSummaryText(sample3[0], '풀빌라 업그레이드 체크');
  assert.ok(summary.includes(sample3[0].title));
  assert.ok(summary.includes('풀빌라 업그레이드 체크'));
  assert.equal(buildTripComparisonText([]), '');
  assert.equal(buildSelectedTripSummaryText(null), '');
});

test('regional packing presets cover all 6 regions and agency questions list 7 items', () => {
  const knownRegions = REGION_DEFS.filter(r => r.key !== 'other');
  assert.equal(knownRegions.length, 6);
  for (const reg of knownRegions) {
    const preset = REGION_PACKING_SUGGESTIONS[reg.key];
    assert.ok(preset, `Missing packing preset for ${reg.key}`);
    assert.ok(preset.items.length >= 4);
  }
  assert.equal(HONEYMOON_AGENCY_QUESTIONS.length, 7);
});
