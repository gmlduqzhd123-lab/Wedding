import { $, E, button, externalLink, searchBox, downloadText, actionOverflowMenu } from './dom.js?v=wedding-features-74';
import { safeUrl, validDate } from './content.js?v=wedding-features-74';
import { pruneContentPreferences } from './preferences.js?v=wedding-features-74';
import { scheduleCalendar } from './calendar.js?v=wedding-features-74';
import {
  CORE_REGION_KEYS,
  MORE_DESTINATION_NOTES,
  COST_LABELS,
  budgetSummary,
  staySummary,
  stayReview,
  emptyQuote,
  quoteReview,
  isBundledPackageTrip,
  formatCostAllocation,
  currentBudgetText,
  climateReview,
  climateBadgeInfo,
  tripFlightBadge,
  tripRegionInfo,
  isCoreRegionTrip,
  isPoolvillaTrip,
  isNoShoppingTrip,
  isSemiPackageTrip,
  buildTripComparisonText,
  buildSelectedTripSummaryText
} from './travel.js?v=wedding-features-74';
import {
  isPackingExpanded,
  setPackingExpanded,
  renderCoreDestinationGuide,
  openAgencyQuestionsModal,
  renderRegionMatrixSection,
  renderTripRecommenderSection,
  renderLocalSpendingSimulator,
  renderHoneymoonPackingList
} from './travel-tools-ui.js?v=wedding-features-74';

export { tripFlightBadge };

let tripSort = 'recommended';
let tripFavoritesOnly = false;
let withTripNoteOnly = false;
let withTripQuoteOnly = false;
let tripQuickFilter = 'all';
let tripRegionFilter = 'all';
let tripAgencyFilter = 'all';
let tripSearchQuery = '';
let overviewExpanded = false;
let compareDiffOnly = false;
let tripCompactMode = true;
let tripVisibleLimit = 12;
let moreDestinationsExpanded = false;
let moreSubRegionFilter = 'all';
const TRIP_PAGE_STEP = 12;

function sortTripList(trips) {
  return tripSort === 'recommended'
    ? [...trips]
    : [...trips].sort((a, b) => (a.budget === null ? (b.budget === null ? 0 : 1) : b.budget === null ? -1 : (a.budget - b.budget) * (tripSort === 'budget-high' ? -1 : 1)));
}

export function ensureTripVisible(ctx, tripId) {
  const target = (ctx.getContent()?.honeymoon || []).find(item => item.id === tripId);
  if (!target) return false;
  if (!isCoreRegionTrip(target)) {
    const changed = !moreDestinationsExpanded || moreSubRegionFilter !== 'all';
    moreDestinationsExpanded = true;
    moreSubRegionFilter = 'all';
    return changed;
  }
  const orderedCore = sortedTrips(ctx).filter(isCoreRegionTrip);
  const idx = orderedCore.findIndex(item => item.id === tripId);
  if (idx >= tripVisibleLimit) {
    tripVisibleLimit = Math.ceil((idx + 1) / TRIP_PAGE_STEP) * TRIP_PAGE_STEP;
    return true;
  }
  return false;
}

const won = value => (value === null ? '미확인' : `${value.toLocaleString('ko-KR')}원`);

export function tripStyleInfo(item) {
  const title = (item.title || '').trim(), id = item.id || '';
  const bracketMatch = title.match(/^\[([^\]]{1,24})\]/);
  if (bracketMatch || /^pkg-/.test(id) || /(패키지|세미패키지|올인클루시브)/.test(title)) {
    const rawTag = bracketMatch ? bracketMatch[1].trim() : '';
    let agencyKey = 'package', agencyLabel = '패키지';
    if (rawTag.startsWith('하나투어') || /-hanatour$/.test(id)) { agencyKey = 'hanatour'; agencyLabel = '하나투어'; }
    else if (rawTag.startsWith('모두투어') || /-modetour$/.test(id)) { agencyKey = 'modetour'; agencyLabel = '모두투어'; }
    else if (rawTag.includes('인터파크') || /-interpark$/.test(id)) { agencyKey = 'interpark'; agencyLabel = 'NOL 인터파크투어'; }
    else if (rawTag.startsWith('노랑풍선') || /-ybtour$/.test(id)) { agencyKey = 'ybtour'; agencyLabel = '노랑풍선'; }
    else if (rawTag.startsWith('교원투어') || rawTag.includes('여행이지') || /-kyowon$/.test(id)) { agencyKey = 'kyowon'; agencyLabel = '교원투어 여행이지'; }
    else if (rawTag) {
      const brand = rawTag.replace(/\s*(허니문|시그니처|세미패키지|패키지|직판|특전|단독|TOP\s*PICK).*$/i, '').trim() || rawTag;
      agencyKey = `custom:${brand}`;
      agencyLabel = brand;
    }
    const subType = /세미패키지|반자유|우리끼리/.test(title) ? '반자유·세미패키지' : /올인클루시브/.test(title) ? '올인클루시브 패키지' : '허니문 패키지';
    return { isPackage: true, agencyKey, agencyLabel, subType, shortBadge: `📦 ${agencyLabel}`, badge: `📦 ${agencyLabel} · ${subType}` };
  }
  const hasCheckedQuote = Boolean(item.plan?.quote?.checkedOn);
  return {
    isPackage: false,
    agencyKey: 'fit',
    agencyLabel: '자유여행',
    subType: '직접 구성 가안',
    shortBadge: '🧳 자유여행 가안',
    badge: hasCheckedQuote ? '🧳 자유여행 · 날짜지정 직접조회' : '🧳 자유여행 · 직접 구성 가안'
  };
}

export function tripRegionKey(item) {
  return tripRegionInfo(item).key;
}

function tripClimateBadge(item) {
  return climateBadgeInfo(item).label;
}

function matchesTripQuickFilter(item, key = tripQuickFilter) {
  if (key === 'package') return tripStyleInfo(item).isPackage;
  if (key === 'fit') return !tripStyleInfo(item).isPackage;
  if (key === 'semi') return isSemiPackageTrip(item);
  if (key === 'direct') return tripFlightBadge(item).direct;
  if (key === 'dry') return climateBadgeInfo(item).dry;
  if (key === 'under6m') return item.budget !== null && item.budget <= 6000000;
  if (key === 'mid6to8m') return item.budget !== null && item.budget > 6000000 && item.budget <= 8000000;
  if (key === 'over8m') return item.budget !== null && item.budget > 8000000;
  if (key === 'poolvilla') return isPoolvillaTrip(item);
  if (key === 'noshopping') return isNoShoppingTrip(item);
  if (key === 'longstay') return stayReview(item).nights >= 6;
  return true;
}

function matchesTripAgency(item, agencyFilter = tripAgencyFilter) {
  if (agencyFilter === 'all') return true;
  const style = tripStyleInfo(item);
  if (agencyFilter === 'fit') return !style.isPackage;
  if (agencyFilter === 'package-all') return style.isPackage;
  return style.agencyKey === agencyFilter;
}

export function activeTripFilterCount(guestMode = false) {
  return [
    !guestMode && tripFavoritesOnly,
    !guestMode && withTripNoteOnly,
    !guestMode && withTripQuoteOnly,
    tripQuickFilter !== 'all',
    tripRegionFilter !== 'all',
    tripAgencyFilter !== 'all',
    Boolean(tripSearchQuery.trim())
  ].filter(Boolean).length;
}

export function hasActiveTripFilters(guestMode = false) {
  return activeTripFilterCount(guestMode) > 0;
}

export function resetTripFilters() {
  tripFavoritesOnly = false;
  withTripNoteOnly = false;
  withTripQuoteOnly = false;
  tripQuickFilter = 'all';
  tripRegionFilter = 'all';
  tripAgencyFilter = 'all';
  tripSearchQuery = '';
  tripVisibleLimit = TRIP_PAGE_STEP;
  moreSubRegionFilter = 'all';
}

function matchesTripPool(ctx, item, omitKey = '') {
  const guestMode = ctx.isGuestMode();
  const prefs = ctx.getPrefs();
  if (!guestMode && omitKey !== 'favorites' && tripFavoritesOnly && !prefs.tripFavorites?.includes(item.id)) return false;
  if (!guestMode && omitKey !== 'notes' && withTripNoteOnly && !prefs.tripNotes?.[item.id]?.trim()) return false;
  if (!guestMode && omitKey !== 'quotes' && withTripQuoteOnly && !prefs.tripQuotes?.[item.id]) return false;
  if (omitKey !== 'quick' && !matchesTripQuickFilter(item, tripQuickFilter)) return false;
  if (omitKey !== 'region' && tripRegionFilter !== 'all' && tripRegionKey(item) !== tripRegionFilter) return false;
  if (omitKey !== 'agency' && !matchesTripAgency(item, tripAgencyFilter)) return false;
  if (omitKey !== 'search') {
    const q = tripSearchQuery.trim().toLocaleLowerCase();
    if (q) {
      const hay = `${item.title} ${item.country || ''} ${item.pros || ''} ${item.cons || ''} ${(item.plan?.stays || []).map(s => s.region).join(' ')} ${item.plan?.lodgingNotes || ''} ${item.plan?.experiences || ''}`.toLocaleLowerCase();
      if (!hay.includes(q)) return false;
    }
  }
  return true;
}

export function matchesAllTripFilters(ctx, item) {
  return matchesTripPool(ctx, item, '');
}

export function sortedTrips(ctx) {
  const trips = (ctx.getContent()?.honeymoon || []).filter(item => matchesAllTripFilters(ctx, item));
  return sortTripList(trips);
}

export function youtubeVideoId(raw) {
  try {
    const parsed = new URL(raw), host = parsed.hostname.toLocaleLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    }
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0]) && /^[A-Za-z0-9_-]{11}$/.test(parts[1] || '')) return parts[1];
    }
  } catch {}
  return '';
}

export function isYoutubeUrl(raw) {
  try {
    const host = new URL(raw).hostname.toLocaleLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function youtubeThumbUrl(raw) {
  const id = youtubeVideoId(raw);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export function openYoutubeModal(ctx, rawUrl, title) {
  const url = safeUrl(rawUrl), id = youtubeVideoId(url);
  if (!url || !id) return;
  const body = E('div', { class: 'yt-modal-player' },
    E('div', { class: 'yt-iframe-wrap' },
      E('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
        title: `${title} 유튜브 영상 플레이어`,
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin',
        loading: 'eager'
      })),
    E('div', { class: 'yt-modal-foot' },
      E('p', { class: 'small muted' }, '일부 채널은 업로더 설정에 따라 외부 사이트 내 재생이 제한될 수 있습니다. 화면이 나오지 않으면 아래 버튼으로 유튜브에서 바로 열 수 있어요.'),
      externalLink('유튜브 새 탭에서 열기 ↗', url, 'button quiet')));
  ctx.showDialog(title, body);
}

export function youtubeThumbBanner(rawUrl, title) {
  const url = safeUrl(rawUrl), thumb = youtubeThumbUrl(url);
  if (!url || !thumb) return null;
  const img = E('img', { class: 'yt-thumb-img', src: thumb, alt: `${title} 유튜브 썸네일`, loading: 'lazy', decoding: 'async', width: '480', height: '270' });
  img.addEventListener('error', () => { img.hidden = true; });
  return E('a', { class: 'yt-thumb-banner', href: url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${title} 유튜브 영상 새 탭에서 재생` },
    img,
    E('span', { class: 'yt-play-icon', 'aria-hidden': 'true' }, '▶'),
    E('span', { class: 'yt-badge', 'aria-hidden': 'true' }, 'YouTube ↗'));
}

export function formatTripQuoteDelta(item, pq) {
  if (!pq || typeof pq !== 'object') {
    return { effectiveTotal: null, diff: null, deltaLabel: '', deltaKind: 'none', summaryText: '미기록' };
  }
  const effectiveTotal = pq.total !== null && pq.total !== undefined
    ? pq.total
    : (pq.airfare !== null && pq.airfare !== undefined || pq.lodging !== null && pq.lodging !== undefined)
      ? (pq.airfare || 0) + (pq.lodging || 0)
      : null;
  let diff = null;
  let deltaLabel = '';
  let deltaKind = 'same';
  if (effectiveTotal !== null && typeof item?.budget === 'number' && Number.isFinite(item.budget)) {
    diff = effectiveTotal - item.budget;
    const absMan = Math.round(Math.abs(diff) / 10000).toLocaleString('ko-KR');
    if (diff < 0) {
      deltaLabel = `계획 대비 -${absMan}만 원 절감`;
      deltaKind = 'cheaper';
    } else if (diff > 0) {
      deltaLabel = `계획 대비 +${absMan}만 원 초과`;
      deltaKind = 'over';
    } else {
      deltaLabel = '계획예산과 동일';
      deltaKind = 'same';
    }
  }
  const parts = [];
  if (effectiveTotal !== null) parts.push(`${effectiveTotal.toLocaleString('ko-KR')}원`);
  if (deltaLabel) parts.push(`(${deltaLabel})`);
  if (pq.agency) parts.push(`· ${pq.agency}`);
  if (pq.perks) parts.push(`· ${pq.perks}`);
  if (pq.cancelUntil) parts.push(`· 무료취소 ${pq.cancelUntil}`);
  return {
    effectiveTotal,
    diff,
    deltaLabel,
    deltaKind,
    summaryText: parts.length ? parts.join(' ') : '상담 정보 기록됨'
  };
}

function tripQuickSpecs(ctx, item) {
  const flight = tripFlightBadge(item);
  const style = tripStyleInfo(item);
  const prefs = ctx.getPrefs();
  const hasNote = !ctx.isGuestMode() && Boolean(prefs.tripNotes?.[item.id]?.trim());
  const pq = !ctx.isGuestMode() ? prefs.tripQuotes?.[item.id] : null;
  const pqInfo = pq ? formatTripQuoteDelta(item, pq) : null;
  return E('div', { class: 'trip-spec-chips', 'aria-label': `${item.title} 핵심 조건 요약` },
    E('span', { class: 'spec-chip' + (style.isPackage ? ' highlight' : '') }, style.shortBadge),
    E('span', { class: 'spec-chip' + (flight.direct ? ' direct' : '') }, flight.detail),
    E('span', { class: 'spec-chip' }, '🏨 ' + staySummary(item)),
    E('span', { class: 'spec-chip' }, tripClimateBadge(item)),
    E('span', { class: 'spec-chip highlight' }, '💰 2인 계획예산 ' + won(item.budget)),
    pqInfo ? E('span', { class: 'spec-chip' + (pqInfo.deltaKind === 'cheaper' ? ' direct' : ' highlight') },
      pqInfo.effectiveTotal !== null ? `🧾 내 실견적 ${Math.round(pqInfo.effectiveTotal / 10000).toLocaleString('ko-KR')}만` : '🧾 실견적 기록됨') : null,
    hasNote ? E('span', { class: 'spec-chip highlight' }, '📝 메모 있음') : null);
}

function tripBudgetBar(item) {
  const costs = item.plan?.costs;
  if (!costs) return null;
  const isPkgBundled = tripStyleInfo(item).isPackage && costs.airfare === 0 && (costs.lodging || 0) > 0;
  const entries = [
    ['airfare', '항공', 'seg-airfare'],
    ['lodging', '숙박·패키지', 'seg-lodging'],
    ['other', '기타 여행비', 'seg-other'],
    ['reserve', '예비비', 'seg-reserve']
  ].map(([key, label, cls]) => ({ key, label, cls, val: typeof costs[key] === 'number' && costs[key] > 0 ? costs[key] : 0 }));
  const sum = entries.reduce((acc, cur) => acc + cur.val, 0);
  if (sum <= 0) return null;
  return E('div', { class: 'trip-budget-visual', 'aria-label': `${item.title} 비용 배분 그래프` },
    E('div', { class: 'budget-visual-head' },
      E('span', { class: 'small muted' }, '2인 비용 배분 구성'),
      E('strong', { class: 'small' }, `배분 합계 ${won(sum)}`)),
    E('div', { class: 'budget-bar-track', 'aria-hidden': 'true' },
      entries.filter(e => e.val > 0).map(e => {
        const pct = Math.max(4, Math.round((e.val / sum) * 100));
        return E('span', { class: `budget-seg ${e.cls}`, style: `width:${pct}%`, title: `${e.label}: ${won(e.val)} (${Math.round((e.val / sum) * 100)}%)` });
      })),
    E('div', { class: 'budget-legend' },
      entries.map(e => E('span', { class: 'legend-item' },
        E('span', { class: `legend-dot ${e.cls}`, 'aria-hidden': 'true' }),
        E('span', { class: 'legend-label' }, e.label),
        E('strong', { class: 'legend-val' }, costs[e.key] === null ? '미정' : e.key === 'airfare' && isPkgBundled ? '패키지포함' : `${Math.round(e.val / 10000).toLocaleString('ko-KR')}만`)))));
}

function tripProsCons(item) {
  const prosLines = (item.pros || '아직 기록이 없어요.').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const consLines = (item.cons || '아직 기록이 없어요.').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return E('div', { class: 'trip-pros-cons' },
    E('div', { class: 'pros-box' },
      E('strong', { class: 'pros-title' }, '👍 좋은 점'),
      E('ul', { class: 'pros-cons-list' }, prosLines.map(line => E('li', {}, line)))),
    E('div', { class: 'cons-box' },
      E('strong', { class: 'cons-title' }, '🤔 고민할 점'),
      E('ul', { class: 'pros-cons-list' }, consLines.map(line => E('li', {}, line)))));
}

function tripBudgetStatus(item) {
  const state = budgetSummary(item), lines = [];
  if (item.budget !== null) lines.push(`2인 계획예산 ${won(item.budget)}${state.known !== null ? ` · 배분 합계 ${won(state.known)}` : ''}`);
  else lines.push('총액 미입력 · 예산 판단 보류');
  if (state.missing.length) lines.push('비용 배분 미확인: ' + state.missing.map(key => COST_LABELS[key]).join(' · '));
  if (state.unallocated > 0) lines.push(`항목 미배분 ${won(state.unallocated)} · 세부 비용을 확인해 주세요.`);
  if (state.unallocated < 0) lines.push(`항목 배분이 계획 총액보다 ${won(-state.unallocated)} 큽니다. 총액 또는 항목을 조정해 주세요.`);
  if (state.reserve === 0) lines.push('예비비가 0원입니다. 추가 비용을 검토해 주세요.');
  lines.push(quoteReview(item).complete ? '계획 배분 기준 · 실제 견적 확인 상태는 별도 표시' : '계획 기준 · 실제 견적·포함 조건 미확인');
  return E('div', { class: 'budget-status' + (state.unallocated < 0 ? ' warning' : ''), role: 'status' }, lines.map(line => E('p', {}, line)));
}

function tripQuoteStatus(item, full = false) {
  const review = quoteReview(item);
  const message = full || review.complete
    ? review.message
    : [review.amountMessage, '실제 예산 충족 미확인 · ' + (review.flightDates ? '한국 출발·도착일 입력 일치' : '한국 출발·도착 항공편 미확인')].filter(Boolean).join('\n');
  return E('p', { class: 'quote-status form-note' + (review.excess > 0 ? ' warning' : ''), role: 'status' }, message);
}

function tripStayStatus(item) {
  const review = stayReview(item);
  return E('p', { class: 'stay-status form-note' + (review.warnings.length ? ' warning' : ''), role: 'status' }, review.message);
}

function selectedTripSummary(ctx) {
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const main = ctx.getMain();
  const item = content.honeymoon.find(trip => trip.id === prefs.tripSelected);
  if (!item) return E('p', { class: 'form-note' }, '최종 선택한 여행지가 없습니다. 후보의 최종 선택 버튼으로 이 기기에 저장할 수 있어요.');
  const note = prefs.tripNotes?.[item.id] || '';
  const pq = prefs.tripQuotes?.[item.id] || null;
  const pqInfo = pq ? formatTripQuoteDelta(item, pq) : null;
  const qReview = quoteReview(item);
  const syncTripToBudget = () => {
    const curPlan = structuredClone(ctx.getPrefs().budgetPlan || {});
    const curHoney = curPlan.honeymoon || { planned: null, actual: null, note: '' };
    const plannedVal = Number.isFinite(item.budget) && item.budget > 0 ? item.budget : curHoney.planned;
    const actualVal = (pqInfo?.effectiveTotal !== null && pqInfo?.effectiveTotal !== undefined)
      ? pqInfo.effectiveTotal
      : ((qReview.complete && qReview.total !== null) ? qReview.total : curHoney.actual);
    curPlan.honeymoon = {
      planned: plannedVal,
      actual: actualVal,
      note: `${item.title}${item.startDate && item.endDate ? ` (${item.startDate}~${item.endDate})` : ''}${pq?.agency ? ` · ${pq.agency}` : ''}`
    };
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), budgetPlan: curPlan });
      if (saved) {
        ctx.render();
        ctx.toast(`최종 선택 신혼여행(${item.title} · ${won(plannedVal)}${actualVal ? ` / 실견적 ${won(actualVal)}` : ''})을 통합 예산 계산기에 반영했습니다.`);
      }
      return saved;
    });
  };
  const exportSelectedTripIcs = () => {
    try {
      const hasValidEnd = Boolean(item.endDate && validDate(item.endDate) && item.endDate >= item.startDate);
      const ics = scheduleCalendar({
        uid: `honeymoon-${item.id}`,
        summary: `[신혼여행] ${item.title}`,
        date: item.startDate,
        endDate: hasValidEnd ? item.endDate : '',
        location: item.country || '',
        description: buildSelectedTripSummaryText(item, note, pq)
      });
      downloadText(ics, 'wedding-honeymoon.ics', 'text/calendar;charset=utf-8');
      ctx.toast(`‘${item.title}’ 일정을 캘린더(.ics) 파일로 저장했습니다.`);
    } catch (error) {
      ctx.toast(error.message || '캘린더 파일을 생성하지 못했습니다.', true);
    }
  };
  return E('section', { class: 'selected-trip' },
    E('h2', {}, '최종 선택 · ' + item.title),
    E('p', {}, `${item.startDate || '미정'} 한국 출발 → ${item.endDate || '미정'} 한국 도착 · 2인 계획예산 ${won(item.budget)}`),
    E('div', { class: 'selected-trip-status' }, tripBudgetStatus(item), tripQuoteStatus(item), tripStayStatus(item)),
    pqInfo ? E('p', { class: 'checklist-item-note small' }, `🧾 내 실견적(개인 기록): ${pqInfo.summaryText}`) : null,
    note ? E('p', { class: 'checklist-item-note small' }, `📝 우리의 상담 메모: ${note}`) : null,
    E('p', { class: 'small muted' }, '이 기기에 저장한 선택입니다. 예약 확정을 의미하지 않습니다.'),
    E('div', { class: 'page-actions' },
      button('선택한 계획 보기', () => {
        if (!matchesAllTripFilters(ctx, item)) resetTripFilters();
        ensureTripVisible(ctx, item.id);
        ctx.render();
        const card = [...main.querySelectorAll('[data-trip-id]')].find(node => node.dataset.tripId === item.id);
        if (!card) return;
        const details = card.querySelector('.travel-details');
        if (details) details.open = true;
        const heading = card.querySelector('h2');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        card.scrollIntoView({ block: 'start' });
      }, 'button quiet'),
      button('💰 통합 예산(신혼여행)에 반영', syncTripToBudget, 'button quiet'),
      validDate(item.startDate) ? button('📅 캘린더(.ics) 저장', exportSelectedTripIcs, 'button quiet') : null,
      button('📋 상담·공유 요약 복사', () => ctx.copyTextToClipboard(buildSelectedTripSummaryText(item, note, pq), '최종 선택 신혼여행 요약을 복사했습니다.', '신혼여행 요약 복사'), 'button quiet'),
      button('💬 여행사 상담 질문집', () => openAgencyQuestionsModal(ctx, item), 'button quiet')));
}

function tripComparison(ctx) {
  if (ctx.isGuestMode()) return null;
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const items = (prefs.tripCompare || []).map(id => content.honeymoon.find(item => item.id === id)).filter(Boolean).slice(0, 3);
  if (!items.length) return null;
  const numericBudgets = items.map(it => it.budget).filter(b => typeof b === 'number' && Number.isFinite(b));
  const minBudget = items.length >= 2 && numericBudgets.length >= 2 ? Math.min(...numericBudgets) : null;
  const hasPrivateQuotes = items.some(it => Boolean(prefs.tripQuotes?.[it.id]));
  const fields = [
    ['여행 형태·구분', item => tripStyleInfo(item).badge],
    ['나라·지역', item => item.country || '미정'],
    ['한국 출발·도착', item => [item.startDate, item.endDate].filter(Boolean).join(' ~ ') || '미정'],
    ['2인 계획예산', item => won(item.budget)],
    ...(hasPrivateQuotes ? [['내 실견적 (개인 기록)', item => formatTripQuoteDelta(item, prefs.tripQuotes?.[item.id]).summaryText]] : []),
    ['비용 배분 합계', item => { const state = budgetSummary(item); return state.known === null ? '입력된 배분 없음' : won(state.known); }],
    ['실제 견적·귀국 확인', item => quoteReview(item).message],
    ['숙박 가안', staySummary],
    ['숙박·날짜 검토', item => stayReview(item).message],
    ...Object.entries(COST_LABELS).map(([key, label]) => [label + ' 배분', item => formatCostAllocation(item, key)]),
    ['계획상 이동', item => item.plan?.transport || '별도 확인 필요'],
    ['기후 유의점', item => climateReview(item).summary],
    ['좋은 점', item => item.pros || '미기재'],
    ['고민할 점', item => item.cons || '미기재'],
    ['우리의 상담 메모', item => prefs.tripNotes?.[item.id] || '미입력']
  ];
  const visibleFields = compareDiffOnly && items.length >= 2
    ? fields.filter(([, value]) => new Set(items.map(item => String(value(item)))).size > 1)
    : fields;
  const diffCheck = E('input', { type: 'checkbox', id: 'compare-diff-only' });
  diffCheck.checked = compareDiffOnly;
  diffCheck.addEventListener('change', () => {
    compareDiffOnly = diffCheck.checked;
    updateTripChoices(ctx);
    $('#compare-diff-only')?.focus({ preventScroll: true });
  });
  const renderCell = (label, value, item) => {
    if (label === '2인 계획예산' && minBudget !== null && typeof item.budget === 'number') {
      if (item.budget === minBudget) return E('td', { class: 'is-best-budget' }, `🏆 ${won(item.budget)} (최저)`);
      const diffMan = Math.round((item.budget - minBudget) / 10000);
      return E('td', {}, `${won(item.budget)}${diffMan > 0 ? ` (+${diffMan.toLocaleString('ko-KR')}만)` : ''}`);
    }
    return E('td', {}, value(item));
  };
  return E('section', { class: 'trip-comparison' },
    E('div', { class: 'trip-comparison-head' },
      E('h2', {}, `여행 후보 나란히 비교 (${items.length}/3)`),
      E('div', { class: 'trip-comparison-toolbar' },
        items.length >= 2 ? E('label', { class: 'check-label', for: 'compare-diff-only' }, diffCheck, '차이 있는 항목만 보기') : null,
        button('📋 비교표 카톡 복사', () => ctx.copyTextToClipboard(buildTripComparisonText(items, prefs), `여행 후보 ${items.length}곳 비교 요약을 복사했습니다.`, '신혼여행 비교 요약 복사'), 'button quiet small-copy-btn'))),
    E('p', { class: 'small muted' }, '관심·비교(최대 3곳)·최종 선택은 이 기기에 저장됩니다. 비용은 모두 2인 전체 여행 계획 배분입니다.'),
    E('div', { class: 'table-scroll' },
      E('table', { class: 'travel-comparison' },
        E('thead', {}, E('tr', {}, E('th', { scope: 'col' }, '비교 항목'), items.map(item => E('th', { scope: 'col' }, item.title)))),
        E('tbody', {}, (visibleFields.length ? visibleFields : fields).map(([label, value]) => E('tr', {}, E('th', { scope: 'row' }, label), items.map(item => renderCell(label, value, item))))))));
}

function renderCompareFloatingTray(ctx) {
  if (ctx.isGuestMode()) {
    document.body.classList.remove('has-compare-tray');
    return null;
  }
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const items = (prefs.tripCompare || []).map(id => content.honeymoon.find(item => item.id === id)).filter(Boolean).slice(0, 3);
  document.body.classList.toggle('has-compare-tray', items.length > 0);
  if (!items.length) return null;
  return E('aside', { class: 'compare-floating-tray', role: 'region', 'aria-label': '신혼여행 비교함 빠른 이동' },
    E('div', { class: 'compare-tray-info' },
      E('strong', { class: 'small' }, `✈️ 비교함 (${items.length}/3)`),
      E('span', { class: 'small muted compare-tray-names' }, items.map(it => it.title).join(' vs '))),
    E('div', { class: 'compare-tray-actions' },
      button('비교표 보기 ↑', () => {
        const el = $('#trip-comparison-region');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 'button small-copy-btn'),
      button('비우기', () => {
        ctx.queuePreference(async () => {
          const ok = await ctx.savePrefs({ ...ctx.getPrefs(), tripCompare: [] });
          if (ok) { updateTripChoices(ctx); ctx.toast('여행 비교함을 비웠습니다.'); }
          return ok;
        });
      }, 'button quiet small-copy-btn')));
}

export function updateTripChoices(ctx) {
  if (ctx.currentRoute() !== 'honeymoon') return;
  if (tripFavoritesOnly || withTripNoteOnly || withTripQuoteOnly) { ctx.render(); return; }
  const main = ctx.getMain();
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const selectedTrip = content.honeymoon.find(t => t.id === prefs.tripSelected) || null;
  const active = document.activeElement;
  const anchor = main.contains(active) ? active : null;
  const before = anchor?.getBoundingClientRect().top;
  for (const node of document.querySelectorAll('.trip-controls button[data-trip-action]')) {
    const id = node.closest('[data-trip-id]').dataset.tripId, key = node.dataset.tripAction;
    node.setAttribute('aria-pressed', String(key === 'tripSelected' ? prefs.tripSelected === id : Boolean(prefs[key]?.includes(id))));
  }
  const region = $('#trip-comparison-region'), comparison = tripComparison(ctx);
  if (region) region.replaceChildren(...(comparison ? [comparison] : []));
  const trayRegion = $('#trip-compare-tray-region'), tray = renderCompareFloatingTray(ctx);
  if (trayRegion) trayRegion.replaceChildren(...(tray ? [tray] : []));
  const selRegion = $('#selected-trip-region');
  if (selRegion) {
    selRegion.classList.toggle('is-unselected', !prefs.tripSelected);
    selRegion.replaceChildren(selectedTripSummary(ctx));
  }
  const localRegion = $('#local-calc-region'), localCalc = renderLocalSpendingSimulator(ctx, selectedTrip);
  if (localRegion) localRegion.replaceChildren(...(localCalc ? [localCalc] : []));
  const packRegion = $('#packing-list-region'), packList = renderHoneymoonPackingList(ctx, { selectedTrip, activeRegion: tripRegionFilter });
  if (packRegion) packRegion.replaceChildren(...(packList ? [packList] : []));
  if (anchor?.isConnected) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
}

function openTripNoteModal(ctx, item) {
  if (ctx.isGuestMode()) return;
  const form = E('form', { class: 'editor-form' });
  const currentNote = ctx.getPrefs().tripNotes?.[item.id] || '';
  const input = E('textarea', { rows: '4', id: 'trip-note-input', maxlength: '1000', placeholder: '예: A여행사 허니문 특전 스파 1회 포함 / 풀빌라 2박 견적 대기 중' });
  input.value = currentNote;
  form.append(
    E('p', { class: 'form-note' }, `‘${item.title}’ 후보에 대한 개인 상담 메모나 특전·견적 조건을 이 기기에만 저장합니다. 방문자용 화면이나 공개 저장소에는 노출되지 않습니다.`),
    E('label', { class: 'field', for: input.id }, '여행지 개인 상담 메모', input));
  const submit = E('button', { class: 'button', type: 'submit' }, '상담 메모 저장');
  form.append(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const nextNotes = { ...(ctx.getPrefs().tripNotes || {}) };
      if (input.value.trim()) nextNotes[item.id] = input.value.trim();
      else delete nextNotes[item.id];
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), tripNotes: nextNotes }));
      if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('여행지 개인 상담 메모를 저장했습니다.'); }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog(`${item.title} · 개인 상담 메모`, form)) {
    ctx.setEditorState({ isDirty: () => saving || input.value !== currentNote, isSaving: () => saving });
  }
}

function parseQuickMoney(raw, label) {
  const cleaned = String(raw || '').replace(/[,\s원]/g, '').trim();
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) throw new Error(`${label}은(는) 0원 이상의 숫자만 입력해 주세요.`);
  const num = Number(cleaned);
  if (!Number.isSafeInteger(num) || num < 0 || num > 1000000000) throw new Error(`${label} 금액 범위를 확인해 주세요.`);
  return num;
}

function openQuickTripQuoteModal(ctx, item) {
  if (ctx.isGuestMode()) return;
  const cur = ctx.getPrefs().tripQuotes?.[item.id] || null;
  const todayKst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const form = E('form', { class: 'editor-form' });
  const totalInput = E('input', { type: 'text', inputmode: 'numeric', id: 'trip-quote-total', value: cur?.total != null ? String(cur.total) : '', placeholder: '예: 5450000 (2인 합계 원)' });
  const airInput = E('input', { type: 'text', inputmode: 'numeric', id: 'trip-quote-airfare', value: cur?.airfare != null ? String(cur.airfare) : '', placeholder: '선택 · 항공 2인 실견적' });
  const lodgeInput = E('input', { type: 'text', inputmode: 'numeric', id: 'trip-quote-lodging', value: cur?.lodging != null ? String(cur.lodging) : '', placeholder: '선택 · 숙박/패키지 실견적' });
  const agencyInput = E('input', { type: 'text', id: 'trip-quote-agency', maxlength: '80', value: cur?.agency || '', placeholder: '예: 하나투어 직판 / 스카이스캐너 + 아고다' });
  const perksInput = E('input', { type: 'text', id: 'trip-quote-perks', maxlength: '240', value: cur?.perks || '', placeholder: '예: 플로팅 조식 + 스파 90분 + 레이트 체크아웃' });
  const cancelInput = E('input', { type: 'date', id: 'trip-quote-cancel', value: cur?.cancelUntil || '' });
  const checkedInput = E('input', { type: 'date', id: 'trip-quote-checked', value: cur?.checkedOn || todayKst });

  const snapshot = () => JSON.stringify([totalInput.value, airInput.value, lodgeInput.value, agencyInput.value, perksInput.value, cancelInput.value, checkedInput.value]);
  const initialSnap = snapshot();

  const liveDelta = E('p', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
  const refreshLiveDelta = () => {
    try {
      const t = parseQuickMoney(totalInput.value, '2인 총액');
      const a = parseQuickMoney(airInput.value, '항공');
      const l = parseQuickMoney(lodgeInput.value, '숙박·패키지');
      const info = formatTripQuoteDelta(item, { total: t, airfare: a, lodging: l });
      liveDelta.textContent = info.effectiveTotal !== null
        ? `현재 입력 기준: ${info.effectiveTotal.toLocaleString('ko-KR')}원${info.deltaLabel ? ` · ${info.deltaLabel}` : ''}`
        : `계획예산 참고: ${won(item.budget)} (총액 또는 항공+숙박 입력 시 차액을 자동 계산해요)`;
    } catch {
      liveDelta.textContent = '금액은 쉼표 없이 숫자(원)로 입력해 주세요.';
    }
  };
  refreshLiveDelta();
  totalInput.addEventListener('input', refreshLiveDelta);
  airInput.addEventListener('input', refreshLiveDelta);
  lodgeInput.addEventListener('input', refreshLiveDelta);

  form.append(
    E('p', { class: 'form-note' }, `여행사 상담가나 실시간 항공+숙박 조회 금액을 30초 만에 이 기기에 기록합니다. 공개 저장소(data/site.json)나 방문자 화면에는 노출되지 않으며, 카톡 동기화 코드·개인 백업에 포함됩니다.`),
    E('div', { class: 'editor-grid-3' },
      E('label', { class: 'field', for: totalInput.id }, '💰 2인 총 실견적 (원)', totalInput),
      E('label', { class: 'field', for: airInput.id }, '✈️ 항공 실견적 (선택)', airInput),
      E('label', { class: 'field', for: lodgeInput.id }, '🏨 숙박·패키지 (선택)', lodgeInput)),
    liveDelta,
    E('div', { class: 'editor-grid-2' },
      E('label', { class: 'field', for: agencyInput.id }, '상담처 · 예약 채널', agencyInput),
      E('label', { class: 'field', for: perksInput.id }, '포함 특전 · 조건 요약', perksInput)),
    E('div', { class: 'editor-grid-2' },
      E('label', { class: 'field', for: cancelInput.id }, '무료 취소 마감일 (선택)', cancelInput),
      E('label', { class: 'field', for: checkedInput.id }, '견적 확인일', checkedInput)));

  const submit = E('button', { class: 'button', type: 'submit' }, cur ? '실견적 수정 저장' : '실견적 저장');
  const deleteBtn = cur ? button('실견적 삭제', async () => {
    const nextQuotes = { ...(ctx.getPrefs().tripQuotes || {}) };
    delete nextQuotes[item.id];
    const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), tripQuotes: nextQuotes }));
    if (saved) { ctx.closeDialog(); ctx.render(); ctx.toast('기록한 실견적을 삭제했습니다.'); }
  }, 'button danger') : null;
  form.append(E('div', { class: 'form-actions' }, deleteBtn, button('취소', ctx.requestClose, 'button quiet'), submit));

  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const total = parseQuickMoney(totalInput.value, '2인 총 실견적');
      const airfare = parseQuickMoney(airInput.value, '항공 실견적');
      const lodging = parseQuickMoney(lodgeInput.value, '숙박·패키지 실견적');
      const agency = agencyInput.value.trim();
      const perks = perksInput.value.trim();
      const cancelUntil = cancelInput.value.trim();
      const checkedOn = checkedInput.value.trim();
      if (total === null && airfare === null && lodging === null && !agency && !perks && !cancelUntil) {
        throw new Error('총 실견적 금액이나 상담 정보를 하나 이상 입력해 주세요.');
      }
      const nextQuotes = { ...(ctx.getPrefs().tripQuotes || {}) };
      nextQuotes[item.id] = {
        total,
        airfare,
        lodging,
        ...(agency ? { agency } : {}),
        ...(perks ? { perks } : {}),
        ...(cancelUntil ? { cancelUntil } : {}),
        ...(checkedOn ? { checkedOn } : {})
      };
      const saved = await ctx.queuePreference(() => ctx.savePrefs({ ...ctx.getPrefs(), tripQuotes: nextQuotes }));
      if (saved) {
        ctx.closeDialog();
        ctx.render();
        ctx.toast(`‘${item.title}’ 실견적을 이 기기에 기록했습니다.`);
      }
    } catch (error) {
      ctx.toast(error.message, true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  if (ctx.showDialog(`${item.title} · 30초 실견적 기록`, form)) {
    ctx.setEditorState({ isDirty: () => saving || snapshot() !== initialSnap, isSaving: () => saving });
  }
}

function tripControls(ctx, item) {
  if (ctx.isGuestMode()) return null;
  const prefs = ctx.getPrefs();
  const toggle = key => ctx.queuePreference(async () => {
    const storedBase = ctx.readRawPrefs(), active = pruneContentPreferences(storedBase, ctx.getContent());
    let next;
    if (key === 'tripSelected') next = { ...active, tripSelected: active.tripSelected === item.id ? '' : item.id };
    else {
      const selected = new Set(active[key] || []);
      selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
      if (key === 'tripCompare' && selected.size > 3) { ctx.toast('비교할 여행지는 세 곳까지 선택해 주세요.', true); return true; }
      next = { ...active, [key]: [...selected] };
    }
    const saved = await ctx.savePrefs(next, storedBase);
    if (saved) updateTripChoices(ctx);
    return saved;
  });
  const hasNote = Boolean(prefs.tripNotes?.[item.id]?.trim());
  const hasQuote = Boolean(prefs.tripQuotes?.[item.id]);
  return E('div', { class: 'trip-controls' }, ...[
    ...[['tripFavorites', '관심 여행지'], ['tripCompare', '비교 선택'], ['tripSelected', '최종 선택']].map(([key, label]) =>
      E('button', {
        type: 'button',
        class: 'button quiet',
        'data-trip-action': key,
        'aria-pressed': String(key === 'tripSelected' ? prefs.tripSelected === item.id : Boolean(prefs[key]?.includes(item.id))),
        onclick: () => toggle(key)
      }, label)),
    button(hasQuote ? '💰 실견적 수정' : '💰 실견적 기록', () => openQuickTripQuoteModal(ctx, item), 'button quiet'),
    button(hasNote ? '📝 메모 수정' : '📝 개인 메모', () => openTripNoteModal(ctx, item), 'button quiet')
  ]);
}

function travelSection(item, key, title, ...children) {
  return E('details', { class: 'trip-section', 'data-view-key': `${item.id}:${key}` }, E('summary', {}, title), E('div', { class: 'trip-section-body' }, children));
}

function planReference(plan, text) {
  return text
    ? E('div', { class: 'plan-reference' },
      E('p', { class: 'small muted' }, plan.narrativeVersion === 2 ? '참고 설명 · 직접 작성한 문장의 날짜·금액·박 수는 자동 갱신되지 않습니다.' : '이전 계획의 참고 설명 · 아래 원문은 현재 입력값으로 자동 갱신되지 않습니다.'),
      E('p', {}, text))
    : null;
}

function tripQuoteDetails(item) {
  const q = item.plan.quote || emptyQuote(), state = quoteReview(item);
  const rows = Object.entries(q.costs).map(([key, value]) => [
    COST_LABELS[key] + ' 실제 견적',
    key === 'airfare' && value === 0 && (q.costs.lodging || 0) > 0 && isBundledPackageTrip(item) ? '패키지 통합 포함 (0원)' : won(value)
  ]);
  rows.push(
    ['입력 견적 소계', won(state.known)],
    ['현재 계획의 예비비', won(item.plan.costs.reserve)],
    ['입력 견적 + 기입 예비비', won(state.assessed)],
    ['확인 조건을 갖춘 합계', won(state.total)],
    ['조회일', q.checkedOn || '미입력'],
    ['한국 출발 시각', q.departureAt.replace('T', ' ') || '미입력'],
    ['한국 도착 시각', q.arrivalAt.replace('T', ' ') || '미입력']
  );
  return travelSection(item, 'quote', '실제 견적·항공편 확인',
    tripQuoteStatus(item, true),
    E('dl', { class: 'quote-breakdown' }, rows.map(([label, value]) => [E('dt', {}, label), E('dd', {}, value)])),
    E('p', {}, '성인 2명·인천·일반석·객실 1실 기준입니다. 공개 조사 금액은 날짜를 지정한 조회 화면의 표시가이며, 항공사·호텔의 결제 직전 최종 요금이나 예약 확정 금액이 아닙니다. 이동·세금의 공시요금, 환산 가정과 추가 확인 사항은 비용 배분·이동비·예비비 항목에서 확인하세요. 일부 견적만 입력해도 소계와 기입된 예비비 합계를 표시하며, 전체 견적 확인은 모든 필수 비용과 현재 여행·숙박 조건을 확인한 뒤에만 표시합니다.'),
    E('p', {}, '항공 근거: ' + (q.flightSource || '미입력')),
    E('p', {}, '숙박 근거: ' + (q.lodgingSource || '미입력')));
}

function travelDetails(item) {
  const plan = item.plan;
  if (!plan) {
    return item.body || item.url
      ? E('details', { class: 'travel-details', 'data-view-key': `${item.id}:all` },
        E('summary', {}, '직접 작성한 메모·참고 링크'),
        item.body ? E('p', { class: 'record-body' }, item.body) : null,
        externalLink('직접 입력한 참고 링크 ↗', item.url))
      : null;
  }
  const state = budgetSummary(item);
  const costRows = Object.entries(COST_LABELS).map(([key, label]) => [label, formatCostAllocation(item, key)]);
  costRows.push(
    ['입력된 배분 소계', state.known === null ? '입력된 배분 없음' : won(state.known)],
    ['2인 계획 총액', won(item.budget)],
    ['항목 미배분', state.unallocated === null ? '판단 보류' : state.unallocated >= 0 ? won(state.unallocated) : `배분 초과 ${won(-state.unallocated)}`]
  );
  const climate = climateReview(item);
  return E('details', { class: 'travel-details', 'data-view-key': `${item.id}:all` }, E('summary', {}, '일정·숙박·비용 상세'),
    travelSection(item, 'dates', '여행 조건·귀국',
      E('p', {}, `한국 출발 ${item.startDate || '미정'} → 한국 도착 목표 ${item.endDate || '미정'} · 성인 2명 · 2인 계획예산 ${won(item.budget)}`),
      E('p', {}, '인천 출발·일반석·객실 1실 기준입니다. 조회한 왕복 일정과 각 공항의 현지 시각은 실제 견적·항공편 확인 항목에 있습니다. 조회 일정은 예약 확정이 아니며 운항·요금을 다시 확인해야 합니다. 한국 도착일과 현지 출발일을 구분하고 현지 체크인·체크아웃으로 숙박 수를 계산합니다.')),
    travelSection(item, 'stays', '숙박·이동·일정',
      E('h3', {}, staySummary(item)),
      tripStayStatus(item),
      plan.stays.map(stay => E('p', { class: 'small' }, `${stay.region}: 현지 체크인 ${stay.checkIn || '미입력'} → 체크아웃 ${stay.checkOut || '미입력'} · ${stay.nights}박`)),
      E('p', { class: 'current-trip-dates' }, `현재 일정: ${item.startDate || '미정'} 한국 출발 → ${staySummary(item)} → ${item.endDate || '미정'} 한국 도착 목표. 현지 날짜는 조회 항공편과 대조하고 예약 전에 확정합니다.`),
      planReference(plan, plan.lodgingNotes),
      E('h3', {}, '일정 흐름 참고'),
      planReference(plan, plan.itinerary),
      E('p', {}, `귀국 목표: ${item.endDate || '미정'} 한국 도착. 숙박 배분과 현지 이동은 실제 항공편에 맞춰 조정합니다.`),
      E('h3', {}, '계획상 이동'),
      E('p', {}, plan.transport)),
    travelSection(item, 'costs', '비용 배분·이동비·예비비',
      E('dl', { class: 'cost-breakdown' }, costRows.map(([label, value]) => [E('dt', {}, label), E('dd', {}, value)])),
      tripBudgetStatus(item),
      E('p', { class: 'current-budget-text' }, currentBudgetText(item)),
      planReference(plan, plan.budgetNotes),
      E('p', {}, '기타 여행비는 교통·식비·활동·보험·통신·준비 비용 등의 통합 배분입니다. 개인 쇼핑은 기본 제외이며 실제 견적 확인 상태는 별도 항목에서 확인합니다.')),
    tripQuoteDetails(item),
    travelSection(item, 'experiences', '경험 제안', E('p', {}, plan.experiences || '아직 입력한 제안이 없습니다.')),
    travelSection(item, 'climate', climate.title,
      E('p', {}, climate.entered ? plan.climate : '아직 입력한 기후 안내가 없습니다.'),
      climate.entered && climate.month === null ? E('p', { class: 'form-note' }, '기후 자료의 기준 월이 입력되지 않았습니다. 출처에서 기준 월을 확인해 주세요.') : null,
      climate.changedMonth ? E('p', { class: 'form-note' }, `기후 안내는 ${climate.month}월 기준입니다. 수정한 여행 월에 맞는 안내를 다시 확인해 주세요.`) : null,
      E('p', { class: 'small muted' }, `${plan.sourceTitle || '출처 미입력'}${plan.checkedOn ? ' · 자료 확인일 ' + plan.checkedOn : ''}`),
      externalLink('기후 공식 안내 ↗', plan.sourceUrl || ''),
      plan.sourceTitle && !plan.sourceUrl ? E('p', { class: 'small muted' }, '기후 출처 링크 미입력 · 직접 입력한 참고 링크와는 별도로 관리합니다.') : null),
    travelSection(item, 'sources', '계획 자료·확인 범위',
      E('p', {}, plan.researchNotes || '저장된 여행 계획입니다. 제공 자료와 직접 수정한 항목의 적용 범위를 확인해 주세요. 실제 예약이나 견적으로 확인된 상태가 아닙니다.'),
      (plan.references || []).map(source => externalLink(source.title + ' ↗', source.url))),
    item.body || item.url
      ? travelSection(item, 'memo', '직접 작성한 메모·참고 링크',
        item.body ? E('p', { class: 'record-body' }, item.body) : null,
        youtubeThumbBanner(item.url, item.title),
        externalLink('직접 입력한 참고 링크 ↗', item.url),
        E('p', { class: 'small muted' }, '직접 입력한 참고 링크는 기후 공식 출처와 별개입니다. 자유 메모의 문장은 날짜·금액 변경 시 자동 수정되지 않습니다.'))
      : null);
}

function tripVideoLinks(ctx, item) {
  const videos = (item.plan?.references || []).filter(ref => isYoutubeUrl(ref.url));
  if (!videos.length) return null;
  return E('div', { class: 'trip-video-links', 'aria-label': `${item.title} 관련 유튜브 영상` },
    E('p', { class: 'small muted' }, '참고 영상 (YouTube)'),
    E('div', { class: 'trip-video-list' }, videos.map(ref => {
      const url = safeUrl(ref.url), thumb = youtubeThumbUrl(url), clean = ref.title.replace(/^유튜브\s*·\s*/, '');
      if (!url) return null;
      if (!thumb) return externalLink('▶ ' + clean, url);
      const img = E('img', { class: 'yt-thumb-img', src: thumb, alt: `${clean} 유튜브 썸네일`, loading: 'lazy', decoding: 'async', width: '320', height: '180' });
      img.addEventListener('error', () => { img.hidden = true; });
      return E('div', { class: 'yt-video-item' },
        E('a', { class: 'yt-video-card', href: url, target: '_blank', rel: 'noopener noreferrer' },
          E('span', { class: 'yt-thumb-wrap' },
            img,
            E('span', { class: 'yt-play-icon', 'aria-hidden': 'true' }, '▶')),
          E('span', { class: 'yt-video-title' }, '▶ ' + clean + ' ↗')),
        youtubeVideoId(url) ? button('▶ 앱 내 바로 재생', () => openYoutubeModal(ctx, url, clean), 'button quiet yt-inline-play') : null);
    })));
}

function tripSortControl(ctx) {
  const content = ctx.getContent();
  const guestMode = ctx.isGuestMode();
  const main = ctx.getMain();
  const coreTrips = content.honeymoon.filter(isCoreRegionTrip);
  const extraTrips = content.honeymoon.filter(item => !isCoreRegionTrip(item));
  const select = E('select', { id: 'trip-sort', 'aria-label': '여행 후보 정렬' }, [['recommended', '추천순'], ['budget-low', '계획예산 낮은 순'], ['budget-high', '계획예산 높은 순']].map(([value, label]) => E('option', { value }, label)));
  select.value = tripSort;
  select.addEventListener('change', () => {
    const before = select.getBoundingClientRect().top;
    tripSort = select.value;
    ctx.render();
    const target = $('#trip-sort');
    target.focus({ preventScroll: true });
    window.scrollBy(0, target.getBoundingClientRect().top - before);
  });
  const agencyPool = coreTrips.filter(item => matchesTripPool(ctx, item, 'agency'));
  const regionPool = coreTrips.filter(item => matchesTripPool(ctx, item, 'region'));
  const quickPool = coreTrips.filter(item => matchesTripPool(ctx, item, 'quick'));
  const extraPool = extraTrips.filter(item => matchesTripPool(ctx, item, 'region'));
  const knownAgencyKeys = new Set(['fit', 'hanatour', 'modetour', 'interpark', 'ybtour', 'kyowon']);
  const extraAgencies = [];
  for (const item of content.honeymoon) {
    const style = tripStyleInfo(item);
    if (style.isPackage && !knownAgencyKeys.has(style.agencyKey) && !extraAgencies.some(([k]) => k === style.agencyKey)) {
      extraAgencies.push([style.agencyKey, style.agencyKey === 'package' ? '기타 패키지' : style.agencyLabel]);
    }
  }
  const agencyOptions = [
    ['all', `전체 형태·여행사 (${agencyPool.length})`],
    ['package-all', `📦 종합여행사 패키지 전체 (${agencyPool.filter(item => tripStyleInfo(item).isPackage).length})`],
    ['fit', `🧳 자유여행 직접구성 (${agencyPool.filter(item => !tripStyleInfo(item).isPackage).length})`],
    ['hanatour', `📦 하나투어 (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === 'hanatour').length})`],
    ['modetour', `📦 모두투어 (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === 'modetour').length})`],
    ['interpark', `📦 NOL 인터파크투어 (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === 'interpark').length})`],
    ['ybtour', `📦 노랑풍선 (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === 'ybtour').length})`],
    ['kyowon', `📦 교원투어 여행이지 (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === 'kyowon').length})`],
    ...extraAgencies.map(([key, label]) => [key, `📦 ${label} (${agencyPool.filter(item => tripStyleInfo(item).agencyKey === key).length})`])
  ].filter(([key]) => key === 'all' || tripAgencyFilter === key || content.honeymoon.some(item => matchesTripAgency(item, key)));
  const agencySelect = E('select', { id: 'trip-agency-filter', 'aria-label': '여행 형태 및 여행사 필터' }, agencyOptions.map(([value, label]) => E('option', { value }, label)));
  agencySelect.value = agencyOptions.some(([v]) => v === tripAgencyFilter) ? tripAgencyFilter : 'all';
  agencySelect.addEventListener('change', () => {
    const before = agencySelect.getBoundingClientRect().top;
    tripAgencyFilter = agencySelect.value;
    tripVisibleLimit = TRIP_PAGE_STEP;
    ctx.render();
    const target = $('#trip-agency-filter');
    target?.focus({ preventScroll: true });
    if (target) window.scrollBy(0, target.getBoundingClientRect().top - before);
  });
  const search = searchBox({
    id: 'trip-search',
    value: tripSearchQuery,
    placeholder: '리조트·풀빌라·여행사·지역 검색 (예: 샹그릴라, 아야나, 나트랑, 노쇼핑)',
    ariaLabel: '신혼여행 후보 검색',
    onInput: (val, el) => {
      const before = el.getBoundingClientRect().top, start = el.selectionStart, end = el.selectionEnd;
      tripSearchQuery = val;
      tripVisibleLimit = TRIP_PAGE_STEP;
      ctx.render();
      const target = $('#trip-search');
      if (target) {
        target.focus({ preventScroll: true });
        try { target.setSelectionRange(start, end); } catch {}
        window.scrollBy(0, target.getBoundingClientRect().top - before);
      }
    }
  });
  const favCheck = E('input', { type: 'checkbox', id: 'trip-favorites-only' });
  favCheck.checked = tripFavoritesOnly;
  favCheck.addEventListener('change', () => {
    const before = favCheck.getBoundingClientRect().top;
    tripFavoritesOnly = favCheck.checked;
    tripVisibleLimit = TRIP_PAGE_STEP;
    ctx.render();
    const target = $('#trip-favorites-only');
    target?.focus({ preventScroll: true });
    if (target) window.scrollBy(0, target.getBoundingClientRect().top - before);
  });
  const noteCheck = E('input', { type: 'checkbox', id: 'trip-notes-only' });
  noteCheck.checked = withTripNoteOnly;
  noteCheck.addEventListener('change', () => {
    const before = noteCheck.getBoundingClientRect().top;
    withTripNoteOnly = noteCheck.checked;
    tripVisibleLimit = TRIP_PAGE_STEP;
    ctx.render();
    const target = $('#trip-notes-only');
    target?.focus({ preventScroll: true });
    if (target) window.scrollBy(0, target.getBoundingClientRect().top - before);
  });
  const quoteCheck = E('input', { type: 'checkbox', id: 'trip-quotes-only' });
  quoteCheck.checked = withTripQuoteOnly;
  quoteCheck.addEventListener('change', () => {
    const before = quoteCheck.getBoundingClientRect().top;
    withTripQuoteOnly = quoteCheck.checked;
    tripVisibleLimit = TRIP_PAGE_STEP;
    ctx.render();
    const target = $('#trip-quotes-only');
    target?.focus({ preventScroll: true });
    if (target) window.scrollBy(0, target.getBoundingClientRect().top - before);
  });
  const filterSource = coreTrips.length ? coreTrips : content.honeymoon;
  const hasSubset = key => {
    const matched = filterSource.filter(item => matchesTripQuickFilter(item, key)).length;
    return (matched > 0 && matched < filterSource.length) || tripQuickFilter === key;
  };
  const hasAny = key => filterSource.some(item => matchesTripQuickFilter(item, key)) || tripQuickFilter === key;
  const quickFilters = [
    ['all', `전체 (${quickPool.length})`],
    ...(hasSubset('fit') ? [['fit', `🧳 자유여행 (${quickPool.filter(item => matchesTripQuickFilter(item, 'fit')).length})`]] : []),
    ...(hasAny('semi') ? [['semi', `✨ 반자유·세미 (${quickPool.filter(item => matchesTripQuickFilter(item, 'semi')).length})`]] : []),
    ...(hasSubset('package') ? [['package', `📦 패키지 전체 (${quickPool.filter(item => matchesTripQuickFilter(item, 'package')).length})`]] : []),
    ...(hasAny('under6m') ? [['under6m', `💸 600만 이하 (${quickPool.filter(item => matchesTripQuickFilter(item, 'under6m')).length})`]] : []),
    ...(hasAny('mid6to8m') ? [['mid6to8m', `💰 600~800만 (${quickPool.filter(item => matchesTripQuickFilter(item, 'mid6to8m')).length})`]] : []),
    ...(hasAny('over8m') ? [['over8m', `💎 800만+ (${quickPool.filter(item => matchesTripQuickFilter(item, 'over8m')).length})`]] : []),
    ...(hasSubset('direct') ? [['direct', `✈️ 직항 (${quickPool.filter(item => matchesTripQuickFilter(item, 'direct')).length})`]] : []),
    ...(hasSubset('dry') ? [['dry', `☀️ 건기·맑음 (${quickPool.filter(item => matchesTripQuickFilter(item, 'dry')).length})`]] : []),
    ...(hasAny('poolvilla') ? [['poolvilla', `🏡 풀빌라 (${quickPool.filter(item => matchesTripQuickFilter(item, 'poolvilla')).length})`]] : []),
    ...(hasAny('noshopping') ? [['noshopping', `🚫 노쇼핑 (${quickPool.filter(item => matchesTripQuickFilter(item, 'noshopping')).length})`]] : []),
    ...(hasSubset('longstay') ? [['longstay', `🏖️ 6~7박 (${quickPool.filter(item => matchesTripQuickFilter(item, 'longstay')).length})`]] : [])
  ];
  const filterBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '여행지 핵심 조건 빠른 필터' },
    quickFilters.map(([key, label]) => E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-trip-filter': key,
      'aria-pressed': String(tripQuickFilter === key),
      onclick: () => {
        tripQuickFilter = tripQuickFilter === key && key !== 'all' ? 'all' : key;
        tripVisibleLimit = TRIP_PAGE_STEP;
        ctx.render();
        main.querySelector(`[data-trip-filter="${tripQuickFilter}"]`)?.focus({ preventScroll: true });
      }
    }, label)));
  const regionDefs = [
    ['all', '🌏 핵심 4곳 전체', regionPool.length],
    ['cebu', '🇵🇭 세부', regionPool.filter(item => tripRegionKey(item) === 'cebu').length],
    ['bali', '🇮🇩 발리', regionPool.filter(item => tripRegionKey(item) === 'bali').length],
    ['hawaii', '🇺🇸 하와이', regionPool.filter(item => tripRegionKey(item) === 'hawaii').length],
    ['guam', '🇬🇺 괌', regionPool.filter(item => tripRegionKey(item) === 'guam').length]
  ].filter(([key]) => key === 'all' || tripRegionFilter === key || coreTrips.some(item => tripRegionKey(item) === key));
  const moreJumpChip = extraTrips.length ? button(
    `➕ 나머지 여행지 더보기 (${extraPool.length}) ↓`,
    () => {
      moreDestinationsExpanded = true;
      ctx.render();
      const sec = main.querySelector('.more-destinations-section');
      if (sec) {
        sec.open = true;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    'button quiet trip-filter-chip trip-more-jump'
  ) : null;
  const regionBar = regionDefs.length > 2 ? E('div', { class: 'trip-quick-filters trip-region-filters', role: 'group', 'aria-label': '신혼여행 핵심 지역별 모아보기' },
    regionDefs.map(([key, label, cnt]) => E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-trip-region': key,
      'aria-pressed': String(tripRegionFilter === key),
      onclick: () => {
        tripRegionFilter = tripRegionFilter === key && key !== 'all' ? 'all' : key;
        tripVisibleLimit = TRIP_PAGE_STEP;
        ctx.render();
        main.querySelector(`[data-trip-region="${tripRegionFilter}"]`)?.focus({ preventScroll: true });
      }
    }, `${label} (${cnt})`)),
    moreJumpChip) : null;
  const coreVisibleCount = sortedTrips(ctx).filter(isCoreRegionTrip).length;
  const activeCount = activeTripFilterCount(guestMode);
  const resetBtn = activeCount ? button(`✕ 필터 초기화 (${activeCount})`, () => { resetTripFilters(); ctx.render(); $('#trip-sort')?.focus({ preventScroll: true }); }, 'filter-reset-chip') : null;
  const densityToggle = E('div', { class: 'density-toggle', role: 'group', 'aria-label': '여행 카드 보기 밀도' },
    E('button', {
      type: 'button',
      class: 'density-btn' + (tripCompactMode ? ' is-active' : ''),
      'aria-pressed': String(tripCompactMode),
      onclick: () => { if (!tripCompactMode) { tripCompactMode = true; ctx.render(); } }
    }, '간략 카드'),
    E('button', {
      type: 'button',
      class: 'density-btn' + (!tripCompactMode ? ' is-active' : ''),
      'aria-pressed': String(!tripCompactMode),
      onclick: () => { if (tripCompactMode) { tripCompactMode = false; ctx.render(); } }
    }, '전체 상세'));
  const countLabel = extraTrips.length && tripRegionFilter === 'all'
    ? `핵심 ${coreVisibleCount} / ${coreTrips.length}곳 · 더보기 ${extraPool.length}곳`
    : `${coreVisibleCount} / ${coreTrips.length}곳`;
  return E('div', { class: 'travel-tools' },
    E('div', { class: 'travel-search-row' }, search.wrap, agencySelect),
    E('div', { class: 'travel-tools-row' },
      E('label', { for: 'trip-sort' }, '정렬'),
      select,
      guestMode ? null : E('label', { class: 'check-label', for: 'trip-favorites-only' }, favCheck, '관심만'),
      guestMode ? null : E('label', { class: 'check-label', for: 'trip-notes-only' }, noteCheck, '📝 메모 있음'),
      guestMode ? null : E('label', { class: 'check-label', for: 'trip-quotes-only' }, quoteCheck, '🧾 실견적 있음'),
      densityToggle,
      resetBtn,
      E('span', { class: 'small muted trip-result-count', 'aria-live': 'polite' }, countLabel)),
    regionBar,
    filterBar);
}

function travelOverview(ctx) {
  const content = ctx.getContent();
  const main = ctx.getMain();
  const trips = [...content.honeymoon];
  const ordered = sortTripList(trips).filter(item => item.plan?.comparisonNote);
  if (!ordered.length) return null;
  const directCount = ordered.filter(item => tripFlightBadge(item).direct).length;
  const pkgCount = ordered.filter(item => tripStyleInfo(item).isPackage).length;
  const fitCount = ordered.length - pkgCount;
  const coreCount = ordered.filter(isCoreRegionTrip).length;
  const extraCount = ordered.length - coreCount;
  const budgets = ordered.map(item => item.budget).filter(b => typeof b === 'number');
  const minBudget = budgets.length ? Math.round(Math.min(...budgets) / 10000).toLocaleString('ko-KR') : '';
  const maxBudget = budgets.length ? Math.round(Math.max(...budgets) / 10000).toLocaleString('ko-KR') : '';
  return E('details', {
    class: 'travel-overview-compact',
    open: overviewExpanded,
    ontoggle: event => { if (event.currentTarget.isConnected) overviewExpanded = event.currentTarget.open; }
  },
    E('summary', { class: 'travel-overview-summary' },
      E('span', { class: 'travel-overview-summary-title' }, `📊 ${ordered.length}곳 요약 보드 & 항공·예산 산정 기준`),
      E('span', { class: 'travel-overview-summary-chips' },
        E('span', { class: 'spec-chip' }, extraCount ? `핵심 ${coreCount} · 더보기 ${extraCount}` : (pkgCount ? `자유 ${fitCount} · 패키지 ${pkgCount}` : `${ordered.length}곳`)),
        E('span', { class: 'spec-chip direct' }, directCount === ordered.length ? `✈️ 전 노선 직항` : `✈️ 직항 ${directCount}곳`),
        budgets.length ? E('span', { class: 'spec-chip highlight' }, `💰 ${minBudget}만~${maxBudget}만 원`) : null)),
    E('div', { class: 'travel-overview-body' },
      E('p', { class: 'form-note honeymoon-note' }, `성인 2명·인천 출발 직항·일반석·객실 1실 기준(핵심 4곳: 세부·발리·하와이·괌 ${coreCount}곳${extraCount ? ` + 더보기: 나트랑·다낭 ${extraCount}곳` : ''}). 자유여행 가안(${fitCount}곳) 중 발리·하와이·괌·나트랑·다낭은 날짜 지정 항공·객실 조회 표시가에 기타 지출 목표와 예비비를 더한 배분이며, 세부 자유여행과 종합여행사 패키지·세미패키지 후보(${pkgCount}곳)는 공개 노선·상품 구성을 바탕으로 잡은 2027년 6월 계획예산 배분으로 실제 예약이나 확정 견적은 아닙니다. 기후 필터는 확인된 기준 월의 계절 경향이며 해당 기간의 날씨를 보장하지 않습니다.`),
      E('ol', { class: 'overview-board' }, ordered.map(item => {
        const flight = tripFlightBadge(item);
        const style = tripStyleInfo(item);
        const isExtra = !isCoreRegionTrip(item);
        return E('li', {},
          E('div', { class: 'overview-row-top' },
            button(item.title, () => {
              if (!matchesAllTripFilters(ctx, item)) resetTripFilters();
              ensureTripVisible(ctx, item.id);
              ctx.render();
              const card = main.querySelector(`[data-trip-id="${item.id}"]`);
              if (card) {
                const det = card.querySelector('.travel-details');
                if (det) det.open = true;
                ctx.focusTrip(item.id);
              }
            }, 'text-button'),
            E('span', { class: 'small muted' }, isExtra ? `${item.country || ''} · 더보기` : (item.country || '')),
            E('strong', {}, '2인 목표 ' + won(item.budget))),
          E('div', { class: 'overview-meta' },
            E('span', { class: 'spec-chip' + (style.isPackage ? ' highlight' : '') }, style.shortBadge),
            E('span', { class: 'spec-chip' + (flight.direct ? ' direct' : '') }, flight.short),
            E('span', { class: 'spec-chip' }, '🏨 ' + staySummary(item)),
            E('span', { class: 'spec-chip' }, tripClimateBadge(item))),
          E('p', { class: 'small' }, item.plan.comparisonNote));
      }))));
}

function printHoneymoonSummary() {
  const packing = $('.honeymoon-packing'), wasOpen = Boolean(packing?.open), wasExpanded = isPackingExpanded();
  if (packing && !wasOpen) packing.open = true;
  document.body.classList.add('print-honeymoon-summary');
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('print-honeymoon-summary');
    if (packing && !wasOpen) { packing.open = false; setPackingExpanded(wasExpanded); }
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}

function tripCompactVideoButton(ctx, item) {
  const videos = (item.plan?.references || []).filter(ref => isYoutubeUrl(ref.url));
  if (!videos.length) return null;
  const first = videos[0];
  const firstUrl = safeUrl(first.url);
  if (!firstUrl) return null;
  const firstClean = first.title.replace(/^유튜브\s*·\s*/, '');
  const openFirst = () => {
    if (youtubeVideoId(firstUrl)) openYoutubeModal(ctx, firstUrl, firstClean);
    else window.open(firstUrl, '_blank', 'noopener,noreferrer');
  };
  return E('div', { class: 'compact-video-row' },
    button(`▶ 참고 영상 (${videos.length})`, openFirst, 'button quiet small-copy-btn'),
    videos.length > 1 ? button('영상 목록 보기', () => {
      const card = ctx.getMain().querySelector(`[data-trip-id="${item.id}"]`);
      const details = card?.querySelector('.travel-details');
      if (details) details.open = true;
      const refSec = card?.querySelector(`[data-view-key="${item.id}:sources"]`);
      if (refSec) {
        refSec.open = true;
        refSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 'text-button small') : null);
}

function renderTripPrivateQuoteBox(ctx, item) {
  if (ctx.isGuestMode()) return null;
  const pq = ctx.getPrefs().tripQuotes?.[item.id];
  if (!pq) return null;
  const info = formatTripQuoteDelta(item, pq);
  const subParts = [];
  if (pq.airfare != null) subParts.push(`항공 ${won(pq.airfare)}`);
  if (pq.lodging != null) subParts.push(`숙박·패키지 ${won(pq.lodging)}`);
  if (pq.perks) subParts.push(`특전: ${pq.perks}`);
  if (pq.cancelUntil) subParts.push(`무료취소 ~${pq.cancelUntil}`);
  if (pq.checkedOn) subParts.push(`확인 ${pq.checkedOn}`);
  return E('div', { class: 'trip-private-quote-box' + (info.deltaKind === 'cheaper' ? ' is-cheaper' : info.deltaKind === 'over' ? ' is-over' : '') },
    E('div', { class: 'trip-private-quote-head' },
      E('div', { class: 'trip-private-quote-title' },
        E('strong', { class: 'small' }, `🧾 내 실견적 ${info.effectiveTotal !== null ? won(info.effectiveTotal) : '(상담 기록)'}`),
        pq.agency ? E('span', { class: 'badge' }, pq.agency) : null,
        info.deltaLabel ? E('span', { class: 'spec-chip' + (info.deltaKind === 'cheaper' ? ' direct' : info.deltaKind === 'over' ? ' highlight' : '') }, info.deltaLabel) : null),
      button('수정', () => openQuickTripQuoteModal(ctx, item), 'text-button small')),
    subParts.length ? E('p', { class: 'small muted trip-private-quote-meta' }, subParts.join(' · ')) : null);
}

function renderTripCard(ctx, item) {
  const guestMode = ctx.isGuestMode();
  const prefs = ctx.getPrefs();
  const style = tripStyleInfo(item);
  return E('article', { class: 'travel-card' + (tripCompactMode ? ' is-compact' : ''), 'data-trip-id': item.id },
    E('div', { class: 'trip-card-topline' },
      E('p', { class: 'country' }, item.country || '우리의 여행 후보'),
      E('span', { class: 'trip-style-pill ' + (style.isPackage ? 'is-package' : 'is-fit') }, style.badge)),
    E('h2', {}, item.title),
    tripQuickSpecs(ctx, item),
    tripBudgetBar(item),
    tripCompactMode ? null : tripBudgetStatus(item),
    tripCompactMode ? null : tripQuoteStatus(item),
    tripCompactMode ? null : tripStayStatus(item),
    tripProsCons(item),
    renderTripPrivateQuoteBox(ctx, item),
    !guestMode && prefs.tripNotes?.[item.id] ? E('p', { class: 'checklist-item-note small trip-private-note' }, `📝 우리의 상담 메모: ${prefs.tripNotes[item.id]}`) : null,
    E('dl', { class: 'trip-meta-dl' },
      E('dt', {}, '한국 출발'), E('dd', {}, item.startDate || '미정'),
      E('dt', {}, '한국 도착'), E('dd', {}, item.endDate || '미정'),
      E('dt', {}, '2인 계획예산'), E('dd', {}, item.budget === null ? '미정' : `${item.budget.toLocaleString('ko-KR')}원`),
      E('dt', {}, '숙박 요약'), E('dd', {}, staySummary(item))),
    tripCompactMode ? tripCompactVideoButton(ctx, item) : tripVideoLinks(ctx, item),
    travelDetails(item),
    tripControls(ctx, item),
    ctx.recordActions('honeymoon', item));
}

function renderMoreDestinationsSection(ctx, extraTripsAll, extraFiltered, coreVisibleCount) {
  if (!extraTripsAll.length) return null;
  const subGroups = [
    ['nhatrang', '🇻🇳 나트랑'],
    ['danang', '🇻🇳 다낭·호이안'],
    ['other', '✈️ 기타 직접 추가']
  ].map(([key, label]) => ({
    key,
    label,
    total: extraTripsAll.filter(item => tripRegionKey(item) === key).length,
    items: extraFiltered.filter(item => tripRegionKey(item) === key)
  })).filter(g => g.total > 0);

  if (moreSubRegionFilter !== 'all' && !subGroups.some(g => g.key === moreSubRegionFilter)) {
    moreSubRegionFilter = 'all';
  }
  const autoOpenForSearch = Boolean(tripSearchQuery.trim()) && coreVisibleCount === 0 && extraFiltered.length > 0;
  const isOpen = moreDestinationsExpanded || autoOpenForSearch;
  const shownExtra = moreSubRegionFilter === 'all'
    ? extraFiltered
    : extraFiltered.filter(item => tripRegionKey(item) === moreSubRegionFilter);
  const summaryParts = subGroups.map(g => `${g.label} ${g.items.length}`);
  const summaryText = `➕ 나머지 여행지 더보기 (${summaryParts.join(' · ')} · 총 ${extraFiltered.length}곳)`;
  const notes = subGroups
    .map(g => MORE_DESTINATION_NOTES[g.key])
    .filter(Boolean);

  return E('details', {
    class: 'disclosure more-destinations-section',
    open: isOpen,
    ontoggle: ev => { if (ev.currentTarget.isConnected) moreDestinationsExpanded = ev.currentTarget.open; }
  },
    E('summary', { class: 'more-destinations-summary' },
      E('span', { class: 'more-destinations-title' }, summaryText),
      E('span', { class: 'spec-chip' }, isOpen ? '접기' : '펼쳐보기')),
    E('div', { class: 'more-destinations-body' },
      E('p', { class: 'small muted' }, '세부·발리·하와이·괌 외에 인천 직항 6월 후보(나트랑·다낭)와 직접 추가한 기타 여행지를 모아둔 더보기 영역입니다. 비교 선택·관심 표시·최종 선택 모두 위 핵심 지역과 동일하게 활용할 수 있어요.'),
      notes.length ? E('ul', { class: 'more-region-notes' }, notes.map(note => E('li', { class: 'small' }, note))) : null,
      subGroups.length > 1 ? E('div', { class: 'trip-quick-filters more-region-chips', role: 'group', 'aria-label': '더보기 여행지 지역별 필터' },
        E('button', {
          type: 'button',
          class: 'button quiet trip-filter-chip',
          'data-more-region': 'all',
          'aria-pressed': String(moreSubRegionFilter === 'all'),
          onclick: () => { moreSubRegionFilter = 'all'; moreDestinationsExpanded = true; ctx.render(); }
        }, `전체 (${extraFiltered.length})`),
        ...subGroups.map(g => E('button', {
          type: 'button',
          class: 'button quiet trip-filter-chip',
          'data-more-region': g.key,
          'aria-pressed': String(moreSubRegionFilter === g.key),
          onclick: () => { moreSubRegionFilter = moreSubRegionFilter === g.key ? 'all' : g.key; moreDestinationsExpanded = true; ctx.render(); }
        }, `${g.label} (${g.items.length})`))) : null,
      shownExtra.length
        ? E('section', { class: 'travel-grid more-travel-grid' + (tripCompactMode ? ' is-compact-grid' : '') },
          shownExtra.map(item => renderTripCard(ctx, item)))
        : E('div', { class: 'no-results-box' },
          E('p', { class: 'no-results' }, '현재 필터 조건에 맞는 나머지 여행지가 없습니다.'),
          hasActiveTripFilters(ctx.isGuestMode()) ? button('모든 필터·검색 초기화', () => { resetTripFilters(); ctx.render(); }, 'button quiet') : null)));
}

export function renderHoneymoon(ctx) {
  const guestMode = ctx.isGuestMode();
  if (guestMode) return ctx.guestRestrictedView('둘만의 첫 여행을 그리며', '신랑·신부의 신혼여행 후보와 일정을 비교하는 공간입니다.', 'HONEYMOON');
  const content = ctx.getContent();
  const prefs = ctx.getPrefs();
  const main = ctx.getMain();
  const selectedTrip = content.honeymoon.find(t => t.id === prefs.tripSelected) || null;
  const allCoreTrips = content.honeymoon.filter(isCoreRegionTrip);
  const allExtraTrips = content.honeymoon.filter(item => !isCoreRegionTrip(item));
  const coreVisibleTrips = sortedTrips(ctx).filter(isCoreRegionTrip);
  const extraFilteredTrips = sortTripList(allExtraTrips.filter(item => matchesTripPool(ctx, item, 'region')));
  const shownTrips = coreVisibleTrips.slice(0, tripVisibleLimit);
  const remaining = coreVisibleTrips.length - shownTrips.length;
  const emptyMsg = tripFavoritesOnly && !withTripNoteOnly && !withTripQuoteOnly && tripQuickFilter === 'all' && tripRegionFilter === 'all' && tripAgencyFilter === 'all' && !tripSearchQuery.trim()
    ? '핵심 4곳 중 등록한 관심 여행지가 없습니다.'
    : withTripNoteOnly && !tripFavoritesOnly && !withTripQuoteOnly && tripQuickFilter === 'all' && tripRegionFilter === 'all' && tripAgencyFilter === 'all' && !tripSearchQuery.trim()
      ? '핵심 4곳 중 메모를 남긴 여행 후보가 없습니다.'
      : withTripQuoteOnly && !tripFavoritesOnly && !withTripNoteOnly && tripQuickFilter === 'all' && tripRegionFilter === 'all' && tripAgencyFilter === 'all' && !tripSearchQuery.trim()
        ? '핵심 4곳 중 실견적을 기록한 여행 후보가 없습니다.'
        : (extraFilteredTrips.length && tripSearchQuery.trim()
          ? `핵심 4곳(세부·발리·하와이·괌)에는 없지만 아래 ‘나머지 여행지 더보기’에서 ${extraFilteredTrips.length}곳을 찾았어요.`
          : '선택한 조건에 맞는 핵심 여행 후보가 없습니다.');

  const focusTripFromTool = tripId => {
    const item = content.honeymoon.find(t => t.id === tripId);
    if (!item) return;
    if (!matchesAllTripFilters(ctx, item)) resetTripFilters();
    ensureTripVisible(ctx, item.id);
    ctx.render();
    const card = main.querySelector(`[data-trip-id="${item.id}"]`);
    if (card) {
      const det = card.querySelector('.travel-details');
      if (det) det.open = true;
      ctx.focusTrip(item.id);
    }
  };

  const selectRegionFromTool = regionKey => {
    if (regionKey === 'all' || CORE_REGION_KEYS.includes(regionKey)) {
      tripRegionFilter = regionKey;
      tripVisibleLimit = TRIP_PAGE_STEP;
      ctx.render();
      $('.travel-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      tripRegionFilter = 'all';
      moreDestinationsExpanded = true;
      moreSubRegionFilter = regionKey;
      ctx.render();
      const sec = main.querySelector('.more-destinations-section');
      if (sec) {
        sec.open = true;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const setCompareTrips = (ids, msg) => {
    const validIds = [...new Set((ids || []).filter(id => content.honeymoon.some(t => t.id === id)))].slice(0, 3);
    if (!validIds.length) return;
    ctx.queuePreference(async () => {
      const storedBase = ctx.readRawPrefs(), active = pruneContentPreferences(storedBase, ctx.getContent());
      const saved = await ctx.savePrefs({ ...active, tripCompare: validIds }, storedBase);
      if (saved) {
        updateTripChoices(ctx);
        $('#trip-comparison-region')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (msg) ctx.toast(msg);
      }
      return saved;
    });
  };

  const pagerBar = remaining > 0
    ? E('div', { class: 'list-pager-bar' },
      button(`핵심 후보 ${Math.min(TRIP_PAGE_STEP, remaining)}곳 더 보기 (남은 ${remaining}곳)`, () => {
        tripVisibleLimit += TRIP_PAGE_STEP;
        ctx.render();
      }, 'button quiet'),
      remaining > TRIP_PAGE_STEP ? button(`핵심 ${coreVisibleTrips.length}곳 한 번에 보기`, () => {
        tripVisibleLimit = coreVisibleTrips.length;
        ctx.render();
      }, 'text-button') : null)
    : (coreVisibleTrips.length > TRIP_PAGE_STEP
      ? E('div', { class: 'list-pager-bar' },
        E('span', { class: 'small muted' }, `필터된 핵심 ${coreVisibleTrips.length}곳을 모두 보고 있어요.`),
        button('처음 12곳만 보기', () => {
          tripVisibleLimit = TRIP_PAGE_STEP;
          ctx.render();
          $('.travel-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 'text-button'))
      : null);

  return [
    ctx.pageHeader('둘만의 첫 여행을 그리며', '세부·발리·하와이·괌 4대 핵심 휴양지의 상세 가이드와 후보를 먼저 비교하고, 나머지 여행지는 더보기란에서 살펴보세요.',
      E('div', { class: 'page-actions' },
        ctx.editButton('여행지 추가', () => ctx.openEditor('honeymoon')),
        button('💬 상담 질문집', () => openAgencyQuestionsModal(ctx, selectedTrip), 'button quiet'),
        actionOverflowMenu([
          ['💱 2인 현지 경비·환율 계산기 ↓', () => {
            const det = $('.honeymoon-local-calc');
            if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          }],
          ['🧳 출국·짐 싸기 체크리스트 ↓', () => {
            const det = $('.honeymoon-packing');
            if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          }],
          ['🖨️ 선택·비교 요약 인쇄', printHoneymoonSummary]
        ], { ariaLabel: '신혼여행 추가 도구' })),
      'HONEYMOON'),
    renderCoreDestinationGuide(ctx, { activeRegion: tripRegionFilter, onSelectRegion: selectRegionFromTool, onCompareTrips: setCompareTrips }),
    tripSortControl(ctx),
    E('div', { class: 'honeymoon-tools-strip', 'aria-label': '신혼여행 비교·추천·요약 도구' },
      renderRegionMatrixSection(ctx, { onSelectRegion: selectRegionFromTool, onCompareTrips: setCompareTrips, onFocusTrip: focusTripFromTool }),
      renderTripRecommenderSection(ctx, { onFocusTrip: focusTripFromTool, onCompareTrips: setCompareTrips }),
      travelOverview(ctx)),
    E('div', { id: 'selected-trip-region', class: prefs.tripSelected ? '' : 'is-unselected' }, selectedTripSummary(ctx)),
    E('div', { id: 'trip-comparison-region' }, tripComparison(ctx)),
    content.honeymoon.length
      ? (shownTrips.length
        ? E('section', { class: 'travel-grid' + (tripCompactMode ? ' is-compact-grid' : '') }, shownTrips.map(item => renderTripCard(ctx, item)))
        : (allCoreTrips.length
          ? E('div', { class: 'no-results-box' },
            E('p', { class: 'no-results' }, emptyMsg),
            hasActiveTripFilters(guestMode) ? button('모든 필터·검색 초기화', () => { resetTripFilters(); ctx.render(); $('#trip-search')?.focus({ preventScroll: true }); }, 'button quiet') : null)
          : null))
      : ctx.empty('어디로 떠나고 싶나요?', '아직 정하지 않아도 괜찮아요. 끌리는 여행지부터 후보로 남겨 두세요.', '여행 후보 남기기', () => ctx.openEditor('honeymoon')),
    pagerBar,
    renderMoreDestinationsSection(ctx, allExtraTrips, extraFilteredTrips, coreVisibleTrips.length),
    E('div', { id: 'local-calc-region' }, renderLocalSpendingSimulator(ctx, selectedTrip)),
    E('div', { id: 'packing-list-region' }, renderHoneymoonPackingList(ctx, { selectedTrip, activeRegion: tripRegionFilter })),
    E('div', { id: 'trip-compare-tray-region' }, renderCompareFloatingTray(ctx))
  ];
}
