import { E, S } from './dom.js?v=wedding-features-75';

const BUDGET_COLORS = {
  'seg-venue': '#3b5944',
  'seg-sdm': '#c97a70',
  'seg-snap': '#d2a25a',
  'seg-rings': '#7b9783',
  'seg-honeymoon': '#5c859e',
  'seg-living': '#9b7b9e'
};

export function computeDonutSegments(items = []) {
  const valid = items.filter(it => Number(it.value) > 0);
  const total = valid.reduce((sum, it) => sum + Number(it.value), 0);
  if (!total) return { total: 0, segments: [] };
  let accPct = 0;
  const segments = valid.map(it => {
    const val = Number(it.value);
    const pct = (val / total) * 100;
    const startPct = accPct;
    accPct += pct;
    return {
      ...it,
      value: val,
      pct,
      roundedPct: Math.round(pct),
      startPct
    };
  });
  return { total, segments };
}

export function computeRatioSegments(entries = []) {
  const valid = entries.map(e => ({ ...e, value: Math.max(0, Number(e.value) || 0) }));
  const total = valid.reduce((sum, e) => sum + e.value, 0);
  if (!total) return { total: 0, items: valid.map(e => ({ ...e, pct: 0 })) };
  return {
    total,
    items: valid.map(e => ({
      ...e,
      pct: Math.round((e.value / total) * 100)
    }))
  };
}

export function renderBudgetDonutChart(rows = [], totalPlanned = null, totalActual = null) {
  const useActual = (totalActual || 0) > 0 && !(totalPlanned > 0);
  const modeLabel = useActual ? '실제·견적 비중' : '목표 예산 비중';
  const rawItems = rows.map(r => ({
    key: r.key,
    label: r.title.replace(/^[^\s]+\s*/, ''),
    cls: r.cls,
    color: BUDGET_COLORS[r.cls] || '#3b5944',
    value: useActual ? (r.actual || 0) : (r.planned || 0),
    planned: r.planned,
    actual: r.actual
  }));
  const { total, segments } = computeDonutSegments(rawItems);
  if (!total) return null;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.map(seg => {
    const dashLen = (seg.pct / 100) * circumference;
    const dashOffset = -((seg.startPct / 100) * circumference);
    return S('circle', {
      cx: '76',
      cy: '76',
      r: String(radius),
      fill: 'none',
      stroke: seg.color,
      'stroke-width': '22',
      'stroke-dasharray': `${Math.max(1.5, dashLen - 1.2).toFixed(2)} ${circumference.toFixed(2)}`,
      'stroke-dashoffset': dashOffset.toFixed(2),
      transform: 'rotate(-90 76 76)'
    });
  });

  const totalMan = Math.round(total / 10000).toLocaleString('ko-KR');
  const svg = S('svg', {
    class: 'budget-donut-svg',
    viewBox: '0 0 152 152',
    role: 'img',
    'aria-label': `${modeLabel} 총 ${total.toLocaleString('ko-KR')}원 도넛 차트`
  },
    S('circle', { cx: '76', cy: '76', r: String(radius), fill: 'none', stroke: 'var(--line)', 'stroke-width': '22' }),
    ...arcs,
    S('text', { x: '76', y: '70', 'text-anchor': 'middle', class: 'donut-center-label' }, modeLabel),
    S('text', { x: '76', y: '90', 'text-anchor': 'middle', class: 'donut-center-value' }, `${totalMan}만`)
  );

  const comparisonRows = rows
    .filter(r => r.planned !== null || r.actual !== null)
    .map(r => {
      const p = r.planned ?? 0;
      const a = r.actual ?? 0;
      const scaleMax = Math.max(p, a, 1);
      const pPct = r.planned !== null ? Math.round((p / scaleMax) * 100) : 0;
      const aPct = r.actual !== null ? Math.round((a / scaleMax) * 100) : 0;
      const over = r.planned !== null && r.actual !== null && a > p;
      const share = total > 0 && (useActual ? a : p) > 0 ? Math.round(((useActual ? a : p) / total) * 100) : 0;
      return E('div', { class: 'donut-cat-row' },
        E('div', { class: 'donut-cat-head' },
          E('span', { class: 'donut-cat-name' },
            E('span', { class: `legend-dot ${r.cls}`, 'aria-hidden': 'true' }),
            r.title.replace(/^[^\s]+\s*/, '')),
          E('span', { class: 'small muted donut-cat-nums' },
            `${share}% · 목표 ${r.planned === null ? '-' : `${Math.round(p / 10000).toLocaleString('ko-KR')}만`} / 실제 ${r.actual === null ? '-' : `${Math.round(a / 10000).toLocaleString('ko-KR')}만`}`)),
        E('div', { class: 'donut-dual-bars', 'aria-hidden': 'true' },
          E('span', { class: 'donut-bar-plan', style: `width:${pPct}%` }),
          E('span', { class: 'donut-bar-actual' + (over ? ' is-over' : ''), style: `width:${aPct}%` })));
    });

  return E('div', { class: 'budget-donut-card' },
    E('div', { class: 'budget-donut-visual' }, svg),
    E('div', { class: 'budget-donut-details' },
      E('div', { class: 'budget-donut-legend-head' },
        E('strong', { class: 'small' }, '📊 6대 항목 비중 & 목표 대비 지출'),
        E('span', { class: 'small muted' }, '위: 목표 · 아래: 실제/견적')),
      E('div', { class: 'donut-cat-list' }, ...comparisonRows)));
}

export function renderSideRatioBar({ title, unit = '명', formatValue = v => `${v.toLocaleString('ko-KR')}${unit}`, entries = [] }) {
  const { total, items } = computeRatioSegments(entries);
  if (!total) return null;
  const colorClasses = ['ratio-seg-groom', 'ratio-seg-bride', 'ratio-seg-common'];
  return E('div', { class: 'side-ratio-card', 'aria-label': title },
    E('div', { class: 'side-ratio-head' },
      E('strong', { class: 'small' }, title),
      E('span', { class: 'small muted' }, `합계 ${formatValue(total)}`)),
    E('div', { class: 'side-ratio-track', role: 'img', 'aria-label': items.map(it => `${it.label} ${it.pct}%`).join(', ') },
      ...items.filter(it => it.value > 0).map((it, idx) =>
        E('span', {
          class: `side-ratio-seg ${it.cls || colorClasses[idx % colorClasses.length]}`,
          style: `width:${Math.max(4, it.pct)}%`,
          title: `${it.label}: ${formatValue(it.value)} (${it.pct}%)`
        }))),
    E('div', { class: 'side-ratio-legend' },
      ...items.map((it, idx) => E('span', { class: 'side-ratio-item small' },
        E('span', { class: `legend-dot ${it.cls || colorClasses[idx % colorClasses.length]}`, 'aria-hidden': 'true' }),
        `${it.label} `,
        E('strong', {}, `${formatValue(it.value)} (${it.pct}%)`)))));
}
