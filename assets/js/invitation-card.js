import { E, S, image } from './dom.js?v=wedding-features-55';
import { formatDate, weddingDday, safeUrl } from './content.js?v=wedding-features-55';

export function isKakaoInApp(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /KAKAOTALK/i.test(ua || '');
}
export function isInAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua || '');
}

const MONTH_NAMES_EN = ['', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export function formatKoreanTimeLabel(timeStr) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr || '');
  if (!m) return timeStr || '미정';
  const h = Number(m[1]), min = Number(m[2]);
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 || 12;
  return `${period} ${h12}시${min ? ` ${min}분` : ''}`;
}

export function buildInvitationShareMessages(info = {}, publicUrl = '') {
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  const coupleShort = (p1 && p2) ? `${p1} · ${p2}` : (p1 || p2 || '저희 두 사람');
  const coupleRoles = (p1 && p2) ? `신랑 ${p1} ♥ 신부 ${p2}` : coupleShort;
  const datePart = info.date ? formatDate(info.date) : '';
  const timePart = info.time ? formatKoreanTimeLabel(info.time) : '';
  const whenLine = [datePart, timePart].filter(Boolean).join(' ');
  const venue = (info.venue || '').trim();
  const address = (info.address || '').trim();
  const url = (publicUrl || '').trim();

  const detailLines = [
    whenLine ? `· 일시: ${whenLine}` : '',
    venue ? `· 장소: ${venue}` : '',
    address ? `· 주소: ${address}` : ''
  ].filter(Boolean);
  const detailsBlock = detailLines.length ? ['', ...detailLines] : [];
  const urlBlock = url ? ['', '▶ 모바일 청첩장 보기', url] : [];

  return [
    {
      id: 'formal',
      label: '직장·어른 정중한 인사',
      audience: '직장 상사·선배·어르신께 보내기 좋은 격식 있는 문구',
      text: [
        `[결혼식 초대] ${coupleRoles}`,
        '',
        '안녕하세요. 늘 따뜻한 관심과 배려에 깊이 감사드립니다.',
        '바쁘신 가운데서도 직접 찾아뵙고 인사드리는 것이 도리이나,',
        '이렇게 모바일 청첩장으로 먼저 소식을 전하게 되어 송구스러운 마음입니다.',
        '',
        '귀한 걸음으로 함께해 주셔서 두 사람의 새로운 출발을 축복해 주시면',
        '더없는 기쁨으로 간직하겠습니다.',
        ...detailsBlock,
        ...urlBlock
      ].join('\n')
    },
    {
      id: 'friend',
      label: '친구·지인 따뜻한 안내',
      audience: '가까운 친구·동료·지인에게 부담 없이 전하는 문구',
      text: [
        `💌 ${coupleShort} 결혼합니다!`,
        '',
        '오랜 인연으로 소중한 하루하루를 함께해 온 저희 두 사람이',
        '드디어 결혼이라는 새로운 시작을 하게 되었어요.',
        '편한 마음으로 오셔서 맛있는 식사도 함께하고,',
        '기쁜 날 자리를 빛내 주시면 정말 감사하겠습니다 :)',
        ...detailsBlock,
        ...urlBlock
      ].join('\n')
    },
    {
      id: 'parents',
      label: '부모님·친척 전달용',
      audience: '양가 부모님과 친지분들이 지인께 전달하실 때 쓰는 문구',
      text: [
        `[결혼 안내] ${coupleRoles}`,
        '',
        '평소 아껴 주시고 보살펴 주신 은혜에 깊이 감사드립니다.',
        `저희 아이들(${coupleShort})이 사랑과 믿음으로 한 가정을 이루게 되었습니다.`,
        '바쁘시더라도 귀한 걸음으로 참석하시어',
        '앞날을 축복하고 격려해 주시면 감사하겠습니다.',
        ...detailsBlock,
        ...urlBlock
      ].join('\n')
    }
  ];
}

export function renderInvitationCornerMarks() {
  const corner = cls => S('svg', { class: `inv-corner ${cls}`, viewBox: '0 0 36 36', 'aria-hidden': 'true' },
    S('path', { d: 'M 2 30 L 2 9 A 7 7 0 0 1 9 2 L 30 2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.15', 'stroke-linecap': 'round' }),
    S('path', { d: 'M 8 16 C 8 10, 10 8, 16 8', fill: 'none', stroke: '#c97a70', 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.75' }),
    S('circle', { cx: '9', cy: '9', r: '1.6', fill: '#c97a70', opacity: '0.8' }));
  return E('div', { class: 'invitation-corners', 'aria-hidden': 'true' }, corner('is-tl'), corner('is-tr'), corner('is-bl'), corner('is-br'));
}

export function renderInvitationDivider() {
  return E('div', { class: 'invitation-divider', 'aria-hidden': 'true' },
    E('span', { class: 'inv-div-line' }),
    S('svg', { class: 'inv-div-motif', viewBox: '0 0 56 18' },
      S('path', { d: 'M 25 9 C 19 4, 11 5, 7 9 C 11 13, 19 14, 25 9 Z', fill: '#9cb4a2', opacity: '0.65' }),
      S('path', { d: 'M 31 9 C 37 4, 45 5, 49 9 C 45 13, 37 14, 31 9 Z', fill: '#9cb4a2', opacity: '0.65' }),
      S('path', { d: 'M 28 4.5 L 31.2 9 L 28 13.5 L 24.8 9 Z', fill: '#c97a70', opacity: '0.88' })),
    E('span', { class: 'inv-div-line' }));
}

export function renderBotanicalLeaf(x, y, rot, scale = 1, fill = '#6e9077', vein = '#44644d') {
  return S('g', { transform: `translate(${x} ${y}) rotate(${rot}) scale(${scale})` },
    S('path', { d: 'M 0 0 C -5.2 -6.5, -4.4 -16.5, 0 -22.5 C 4.4 -16.5, 5.2 -6.5, 0 0 Z', fill }),
    S('path', { d: 'M 0 -1.5 L 0 -18', stroke: vein, 'stroke-width': '0.8', 'stroke-linecap': 'round', opacity: '0.55' }));
}

export function renderBotanicalRose(x, y, scale = 1) {
  return S('g', { transform: `translate(${x} ${y}) scale(${scale})` },
    S('circle', { cx: '0', cy: '0', r: '11.5', fill: '#f5dcd7' }),
    S('circle', { cx: '-3', cy: '-2', r: '7.8', fill: '#ebbab2' }),
    S('circle', { cx: '3.2', cy: '1.8', r: '7.2', fill: '#e39f96' }),
    S('path', { d: 'M -5 -1 C -2 -6, 4 -6, 6 -1 C 4 5, -3 5, -5 -1 Z', fill: '#c97a70' }),
    S('path', { d: 'M -3.5 0.5 C -1 -2.8, 3 -2.5, 3.8 0.8', fill: 'none', stroke: '#fff8f6', 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.85' }),
    S('circle', { cx: '0.4', cy: '-0.3', r: '1.5', fill: '#d7ab6e' }));
}

export function renderBotanicalBud(x, y, rot, scale = 1) {
  return S('g', { transform: `translate(${x} ${y}) rotate(${rot}) scale(${scale})` },
    S('path', { d: 'M 0 0 C -4 -5, -3.5 -12, 0 -15.5 C 3.5 -12, 4 -5, 0 0 Z', fill: '#e29d94' }),
    S('path', { d: 'M -3.8 -2 C -1.5 -5, 1.5 -5, 3.8 -2 L 0 1.5 Z', fill: '#5c7d65' }));
}

export function renderInvitationHeroVisual(info, albums = []) {
  const coverSrc = albums?.find(a => Array.isArray(a.images) && a.images.length)?.images?.[0] || '';
  const coupleLabel = [info.partner1, info.partner2].filter(Boolean).join(' · ') || '신랑 · 신부';
  const coverNode = coverSrc ? image(coverSrc, `${coupleLabel} 웨딩 사진`, { class: 'invitation-arch-photo' }) : null;
  if (coverNode) {
    return E('div', { class: 'invitation-arch-stage has-cover-photo' },
      E('div', { class: 'invitation-arch-photo-frame' }, coverNode));
  }
  const svg = S('svg', { class: 'invitation-botanical-svg', viewBox: '0 0 380 232', 'aria-hidden': 'true' },
    S('defs', {},
      S('linearGradient', { id: 'invArchBg', x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
        S('stop', { offset: '0%', 'stop-color': '#f2f6f2' }),
        S('stop', { offset: '52%', 'stop-color': '#fffdf9' }),
        S('stop', { offset: '100%', 'stop-color': '#fcf4f1' })),
      S('radialGradient', { id: 'invSunHalo', cx: '50%', cy: '45%', r: '48%' },
        S('stop', { offset: '0%', 'stop-color': '#fff6ee', 'stop-opacity': '0.95' }),
        S('stop', { offset: '65%', 'stop-color': '#f8ebe6', 'stop-opacity': '0.42' }),
        S('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' })),
      S('linearGradient', { id: 'invGoldA', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
        S('stop', { offset: '0%', 'stop-color': '#dfba82' }),
        S('stop', { offset: '50%', 'stop-color': '#b98b4e' }),
        S('stop', { offset: '100%', 'stop-color': '#e5c693' })),
      S('linearGradient', { id: 'invGoldB', x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
        S('stop', { offset: '0%', 'stop-color': '#d79e92' }),
        S('stop', { offset: '52%', 'stop-color': '#c28e5c' }),
        S('stop', { offset: '100%', 'stop-color': '#e6c596' }))),
    S('path', { d: 'M 78 214 L 78 124 A 112 112 0 0 1 302 124 L 302 214 Z', fill: 'url(#invArchBg)', stroke: '#c1d1c4', 'stroke-width': '1.25' }),
    S('path', { d: 'M 86 207 L 86 124 A 104 104 0 0 1 294 124 L 294 207 Z', fill: 'none', stroke: '#e3cfc8', 'stroke-width': '0.9' }),
    S('circle', { cx: '190', cy: '108', r: '72', fill: 'url(#invSunHalo)' }),
    S('g', { stroke: '#d8c2a8', 'stroke-width': '0.9', 'stroke-linecap': 'round', opacity: '0.58' },
      S('line', { x1: '190', y1: '27', x2: '190', y2: '43' }),
      S('line', { x1: '158', y1: '34', x2: '164', y2: '47' }),
      S('line', { x1: '222', y1: '34', x2: '216', y2: '47' }),
      S('circle', { cx: '190', cy: '50', r: '1.8', fill: '#d2a66c', stroke: 'none' })),
    S('g', { class: 'inv-bough inv-bough-left' },
      S('path', { d: 'M 66 202 C 56 150, 68 90, 118 44', fill: 'none', stroke: '#4a6b53', 'stroke-width': '1.45', 'stroke-linecap': 'round' }),
      S('path', { d: 'M 74 164 C 90 150, 108 144, 126 142', fill: 'none', stroke: '#6d8e76', 'stroke-width': '1.05', 'stroke-linecap': 'round' }),
      renderBotanicalLeaf(63, 184, -48, 0.92, '#8daa94'),
      renderBotanicalLeaf(69, 170, 32, 0.88, '#56785f'),
      renderBotanicalLeaf(62, 134, -42, 0.96, '#6e9077'),
      renderBotanicalLeaf(76, 118, 38, 0.9, '#9ab4a0'),
      renderBotanicalLeaf(78, 94, -32, 0.92, '#53755c'),
      renderBotanicalLeaf(95, 82, 42, 0.84, '#7ea087'),
      renderBotanicalLeaf(100, 62, -22, 0.82, '#9ab4a0'),
      renderBotanicalLeaf(115, 50, 36, 0.76, '#688a71'),
      renderBotanicalLeaf(106, 149, 68, 0.78, '#8daa94'),
      renderBotanicalBud(91, 68, -26, 0.82),
      renderBotanicalBud(56, 192, -38, 0.76),
      renderBotanicalRose(72, 150, 0.98)),
    S('g', { class: 'inv-bough inv-bough-right' },
      S('path', { d: 'M 314 202 C 324 150, 312 90, 262 44', fill: 'none', stroke: '#4a6b53', 'stroke-width': '1.45', 'stroke-linecap': 'round' }),
      S('path', { d: 'M 306 160 C 290 146, 272 140, 254 138', fill: 'none', stroke: '#6d8e76', 'stroke-width': '1.05', 'stroke-linecap': 'round' }),
      renderBotanicalLeaf(317, 184, 48, 0.92, '#8daa94'),
      renderBotanicalLeaf(311, 168, -32, 0.88, '#56785f'),
      renderBotanicalLeaf(318, 130, 42, 0.96, '#6e9077'),
      renderBotanicalLeaf(304, 114, -38, 0.9, '#9ab4a0'),
      renderBotanicalLeaf(302, 92, 32, 0.92, '#53755c'),
      renderBotanicalLeaf(285, 80, -42, 0.84, '#7ea087'),
      renderBotanicalLeaf(280, 60, 22, 0.82, '#9ab4a0'),
      renderBotanicalLeaf(265, 48, -36, 0.76, '#688a71'),
      renderBotanicalLeaf(274, 145, -68, 0.78, '#8daa94'),
      renderBotanicalBud(289, 66, 26, 0.82),
      renderBotanicalBud(324, 190, 38, 0.76),
      renderBotanicalRose(308, 144, 0.96)),
    S('g', { transform: 'translate(190 110)' },
      S('path', { d: 'M -46 22 C -24 35, 24 35, 46 22', fill: 'none', stroke: '#93ad99', 'stroke-width': '1.1', 'stroke-linecap': 'round' }),
      renderBotanicalLeaf(-28, 29, -68, 0.65, '#7ea087'),
      renderBotanicalLeaf(28, 29, 68, 0.65, '#7ea087'),
      S('circle', { cx: '0', cy: '32', r: '2.4', fill: '#c97a70' }),
      S('circle', { cx: '-8', cy: '31', r: '1.5', fill: '#e5b5ad' }),
      S('circle', { cx: '8', cy: '31', r: '1.5', fill: '#e5b5ad' }),
      S('circle', { cx: '-12', cy: '2', r: '21', fill: 'none', stroke: 'url(#invGoldA)', 'stroke-width': '2.6' }),
      S('circle', { cx: '12', cy: '2', r: '21', fill: 'none', stroke: 'url(#invGoldB)', 'stroke-width': '2.6' }),
      S('path', { d: 'M 2.8 -12.8 A 21 21 0 0 1 8.8 6.5', fill: 'none', stroke: 'url(#invGoldA)', 'stroke-width': '3' }),
      S('path', { d: 'M -12 -28 L -9.6 -22.4 L -4 -20 L -9.6 -17.6 L -12 -12 L -14.4 -17.6 L -20 -20 L -14.4 -22.4 Z', fill: '#d5a868' }),
      S('path', { d: 'M 18 -23 L 19.2 -20.2 L 22 -19 L 19.2 -17.8 L 18 -15 L 16.8 -17.8 L 14 -19 L 16.8 -20.2 Z', fill: '#dfa59c', opacity: '0.9' })),
    S('line', { x1: '128', y1: '170', x2: '252', y2: '170', stroke: '#dce5de', 'stroke-width': '1' }),
    S('text', { x: '190', y: '187', 'text-anchor': 'middle', 'font-size': '9.2', 'font-weight': '700', 'letter-spacing': '3.1', fill: '#56745e' }, 'OUR NEW BEGINNING'),
    S('circle', { cx: '190', cy: '199', r: '2', fill: '#c97a70' }),
    S('circle', { cx: '182', cy: '199', r: '1.2', fill: '#9eb5a3' }),
    S('circle', { cx: '198', cy: '199', r: '1.2', fill: '#9eb5a3' }));
  return E('div', { class: 'invitation-arch-stage', 'aria-hidden': 'true' }, svg);
}

export function renderInvitationCalendar(dateStr, timeStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(E('span', { class: 'cal-cell empty', 'aria-hidden': 'true' }, ''));
  for (let d = 1; d <= lastDate; d++) {
    const dow = (firstDow + d - 1) % 7;
    const isTarget = d === day;
    const cls = ['cal-cell', dow === 0 ? 'is-sun' : '', dow === 6 ? 'is-sat' : '', isTarget ? 'is-wedding-day' : ''].filter(Boolean).join(' ');
    cells.push(E('span', { class: cls, ...(isTarget ? { 'aria-current': 'date', 'aria-label': `${year}년 ${month}월 ${d}일 예식일` } : {}) }, String(d)));
  }
  return E('div', { class: 'invitation-calendar', 'aria-label': `${year}년 ${month}월 예식 달력` },
    E('div', { class: 'cal-header' },
      E('div', { class: 'cal-title-group' },
        E('span', { class: 'cal-month-en' }, MONTH_NAMES_EN[month] || 'WEDDING DAY'),
        E('strong', {}, `${year}년 ${month}월`)),
      E('span', { class: 'cal-time-chip' }, `${month}월 ${day}일 (${weekdays[(firstDow + day - 1) % 7]})${timeStr ? ` · ${timeStr}` : ''}`)),
    E('div', { class: 'cal-weekdays', 'aria-hidden': 'true' }, weekdays.map((w, i) => E('span', { class: i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : '' }, w))),
    E('div', { class: 'cal-grid' }, cells));
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCanvasLeaf(ctx, x, y, rotDeg, scale, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-9, -11, -7.5, -28, 0, -38);
  ctx.bezierCurveTo(7.5, -28, 9, -11, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, -30);
  ctx.strokeStyle = 'rgba(68,100,77,0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawCanvasBotanicalArch(ctx, cx, topY) {
  const w = 440, h = 360, left = cx - w / 2, bottom = topY + h, arcY = topY + w / 2;
  const grad = ctx.createLinearGradient(cx, topY, cx, bottom);
  grad.addColorStop(0, '#f1f6f1');
  grad.addColorStop(0.55, '#fffdf9');
  grad.addColorStop(1, '#fcf4f0');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, arcY);
  ctx.arc(cx, arcY, w / 2, Math.PI, 0, false);
  ctx.lineTo(left + w, bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#c1d1c4';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  const innerR = w / 2 - 16;
  ctx.beginPath();
  ctx.moveTo(cx - innerR, bottom - 14);
  ctx.lineTo(cx - innerR, arcY);
  ctx.arc(cx, arcY, innerR, Math.PI, 0, false);
  ctx.lineTo(cx + innerR, bottom - 14);
  ctx.closePath();
  ctx.strokeStyle = '#e4cfc7';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const halo = ctx.createRadialGradient(cx, arcY - 20, 12, cx, arcY - 20, 140);
  halo.addColorStop(0, 'rgba(255,246,238,0.95)');
  halo.addColorStop(0.65, 'rgba(248,235,230,0.42)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, arcY - 20, 140, 0, Math.PI * 2);
  ctx.fill();

  // Botanical leaves framing arch sides
  const leftLeaves = [
    [left - 12, bottom - 40, -45, 1.05, '#8daa94'],
    [left + 4, bottom - 76, 30, 0.96, '#56785f'],
    [left - 14, bottom - 135, -38, 1.08, '#6e9077'],
    [left + 12, bottom - 172, 36, 0.98, '#9ab4a0'],
    [left + 24, bottom - 220, -28, 0.94, '#53755c'],
    [left + 64, bottom - 262, 36, 0.86, '#7ea087']
  ];
  for (const [lx, ly, rot, sc, fill] of leftLeaves) drawCanvasLeaf(ctx, lx, ly, rot, sc, fill);
  for (const [lx, ly, rot, sc, fill] of leftLeaves) drawCanvasLeaf(ctx, cx * 2 - lx, ly, -rot, sc, fill);

  // Rose blossoms on each side
  for (const [rx, ry] of [[left + 8, bottom - 108], [left + w - 8, bottom - 114]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 20, 0, Math.PI * 2); ctx.fillStyle = '#f5dcd7'; ctx.fill();
    ctx.beginPath(); ctx.arc(rx - 4, ry - 3, 13, 0, Math.PI * 2); ctx.fillStyle = '#ebbab2'; ctx.fill();
    ctx.beginPath(); ctx.arc(rx + 4, ry + 3, 11, 0, Math.PI * 2); ctx.fillStyle = '#c97a70'; ctx.fill();
    ctx.beginPath(); ctx.arc(rx, ry, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#d7ab6e'; ctx.fill();
  }

  // Interlocking rings
  const ringY = arcY - 12;
  ctx.lineWidth = 5.5;
  ctx.strokeStyle = '#c99b5d';
  ctx.beginPath(); ctx.arc(cx - 26, ringY, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#d49689';
  ctx.beginPath(); ctx.arc(cx + 26, ringY, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#c99b5d';
  ctx.beginPath(); ctx.arc(cx - 26, ringY, 44, -0.75, 0.35); ctx.stroke();

  // Cradle sprig under rings
  ctx.beginPath();
  ctx.moveTo(cx - 72, ringY + 56);
  ctx.quadraticCurveTo(cx, ringY + 82, cx + 72, ringY + 56);
  ctx.strokeStyle = '#93ad99';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, ringY + 71, 5, 0, Math.PI * 2); ctx.fillStyle = '#c97a70'; ctx.fill();

  // Caption line
  ctx.beginPath();
  ctx.moveTo(cx - 118, bottom - 68);
  ctx.lineTo(cx + 118, bottom - 68);
  ctx.strokeStyle = '#dce5de';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = '#56745e';
  ctx.font = '700 18px SUITE, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OUR NEW BEGINNING', cx, bottom - 36);
  ctx.restore();
}

function wrapCanvasLines(ctx, text, maxWidth, maxLines = 4) {
  const result = [];
  for (const para of String(text || '').split(/\r?\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    let line = '';
    for (const ch of trimmed) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        result.push(line);
        line = ch;
        if (result.length >= maxLines) return result;
      } else {
        line = test;
      }
    }
    if (line) {
      result.push(line);
      if (result.length >= maxLines) return result;
    }
  }
  return result;
}

async function loadImageSafe(src) {
  const safe = safeUrl(src, { image: true });
  if (!safe) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = safe;
  });
}

async function loadQrSvgImage(url) {
  if (!url) return null;
  try {
    const { renderQrSvgString } = await import('./qrcode.js?v=wedding-features-55');
    const svgMarkup = renderQrSvgString(url, { margin: 2 });
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

export async function renderInvitationCardCanvas(info = {}, albums = [], options = {}) {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch {}
  }
  const W = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 1520;
  const ctx = canvas.getContext('2d');

  // Pre-measure dynamic text blocks & optional QR image before committing canvas height
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  const gp = (info.groomParents || '').trim();
  const bp = (info.brideParents || '').trim();
  const plaqueY = 710;
  const plaqueH = (gp && bp) ? 190 : ((gp || bp) ? 156 : 114);

  ctx.font = '500 24px SUITE, sans-serif';
  const msgLines = (info.message || '').trim() ? wrapCanvasLines(ctx, info.message, 740, 4) : [];

  ctx.font = '500 22px SUITE, sans-serif';
  const addrLines = (info.address || '').trim() ? wrapCanvasLines(ctx, info.address, 740, 2) : [];

  const shareUrl = options.includeQr ? String(options.shareUrl || '').trim() : '';
  const qrImg = shareUrl ? await loadQrSvgImage(shareUrl) : null;

  const msgStartY = plaqueY + plaqueH + 40;
  const afterMsgY = msgLines.length ? (msgStartY + msgLines.length * 36 + 18) : (plaqueY + plaqueH + 34);
  const dateBoxY = Math.max(afterMsgY, 870);
  const dateBoxH = 136;
  const venueBoxY = dateBoxY + dateBoxH + 22;
  const venueBoxH = addrLines.length >= 2 ? 178 : (addrLines.length === 1 ? 150 : 122);
  const qrBoxY = venueBoxY + venueBoxH + 24;
  const qrBoxH = qrImg ? 214 : 0;
  const contentBottomY = qrImg ? (qrBoxY + qrBoxH) : (venueBoxY + venueBoxH);
  const H = Math.max(1520, contentBottomY + 174);
  const footerY = H - 108;

  canvas.height = H;

  // Outer botanical paper backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f3f6f2');
  bg.addColorStop(0.5, '#faf9f4');
  bg.addColorStop(1, '#f6f3ea');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stationery card
  const pad = 48;
  drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 46);
  const cardBg = ctx.createLinearGradient(0, pad, 0, H - pad);
  cardBg.addColorStop(0, '#fffdf9');
  cardBg.addColorStop(0.45, '#ffffff');
  cardBg.addColorStop(1, '#faf8f1');
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.strokeStyle = '#dfdacc';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner double border
  drawRoundedRect(ctx, pad + 24, pad + 24, W - (pad + 24) * 2, H - (pad + 24) * 2, 32);
  ctx.strokeStyle = 'rgba(176,196,181,0.68)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top ribbon pill
  const ribbonText = info.date ? `WEDDING INVITATION · ${info.date.replaceAll('-', '. ')}` : 'WE ARE GETTING MARRIED';
  ctx.font = '700 22px SUITE, sans-serif';
  const ribbonW = Math.min(640, ctx.measureText(ribbonText).width + 76);
  drawRoundedRect(ctx, (W - ribbonW) / 2, 114, ribbonW, 50, 25);
  ctx.fillStyle = '#eef4ef';
  ctx.fill();
  ctx.strokeStyle = '#cbdacd';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#3b5944';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ribbonText, W / 2, 139);

  // Title & subtitle
  ctx.fillStyle = '#23201e';
  ctx.font = '700 48px Paperlogy, SUITE, sans-serif';
  ctx.fillText('우리 두 사람, 결혼합니다', W / 2, 224);

  ctx.fillStyle = '#c97a70';
  ctx.font = '700 20px SUITE, sans-serif';
  ctx.fillText('—  WITH LOVE, TOGETHER  —', W / 2, 272);

  // Center arch visual (cover photo if clean same-origin/data-URL, else botanical arch)
  const coverSrc = albums?.find(a => Array.isArray(a.images) && a.images.length)?.images?.[0] || '';
  let drewPhoto = false;
  if (coverSrc && (coverSrc.startsWith('data:image/') || coverSrc.startsWith('./') || coverSrc.startsWith(location.origin))) {
    const img = await loadImageSafe(coverSrc);
    if (img) {
      const aw = 340, ah = 380, ax = W / 2 - aw / 2, ay = 308;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax, ay + ah);
      ctx.lineTo(ax, ay + aw / 2);
      ctx.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0, false);
      ctx.lineTo(ax + aw, ay + ah);
      ctx.closePath();
      ctx.clip();
      const scale = Math.max(aw / img.width, ah / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, W / 2 - dw / 2, ay + (ah - dh) / 2, dw, dh);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(ax, ay + ah);
      ctx.lineTo(ax, ay + aw / 2);
      ctx.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0, false);
      ctx.lineTo(ax + aw, ay + ah);
      ctx.closePath();
      ctx.strokeStyle = '#c5d4c8';
      ctx.lineWidth = 4;
      ctx.stroke();
      drewPhoto = true;
    }
  }
  if (!drewPhoto) drawCanvasBotanicalArch(ctx, W / 2, 314);

  // Couple plaque
  drawRoundedRect(ctx, 146, plaqueY, W - 292, plaqueH, 28);
  const plaqueGrad = ctx.createLinearGradient(0, plaqueY, 0, plaqueY + plaqueH);
  plaqueGrad.addColorStop(0, '#fcfbf7');
  plaqueGrad.addColorStop(1, '#f3f8f4');
  ctx.fillStyle = plaqueGrad;
  ctx.fill();
  ctx.strokeStyle = '#dbe5dd';
  ctx.lineWidth = 2;
  ctx.stroke();

  const coupleLine = (p1 && p2) ? `신랑 ${p1}   ♥   신부 ${p2}` : (p1 || p2 || '우리의 결혼식');
  ctx.fillStyle = '#23201e';
  ctx.font = '700 44px Paperlogy, SUITE, sans-serif';
  ctx.fillText(coupleLine, W / 2, plaqueY + 58);

  if (gp || bp) {
    ctx.strokeStyle = '#d5e0d7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(220, plaqueY + 102);
    ctx.lineTo(W - 220, plaqueY + 102);
    ctx.stroke();
    ctx.font = '600 22px SUITE, sans-serif';
    ctx.fillStyle = '#4f554f';
    if (gp) ctx.fillText(`${gp}${p1 ? ` ${p1}` : ''}`, W / 2, plaqueY + 132);
    if (bp) ctx.fillText(`${bp}${p2 ? ` ${p2}` : ''}`, W / 2, plaqueY + (gp ? 166 : 134));
  }

  // Optional invitation greeting excerpt
  if (msgLines.length) {
    ctx.font = '500 24px SUITE, sans-serif';
    ctx.fillStyle = '#44403c';
    msgLines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, msgStartY + idx * 36);
    });
  }

  // Date & Time card
  const dday = weddingDday(info.date);
  const dateText = info.date ? formatDate(info.date) : '예식 일정 준비 중';
  const timeText = info.time ? formatKoreanTimeLabel(info.time) : '';
  drawRoundedRect(ctx, 146, dateBoxY, W - 292, dateBoxH, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dfe5de';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#c97a70';
  ctx.font = '700 18px SUITE, sans-serif';
  ctx.fillText('SAVE THE DATE', W / 2, dateBoxY + 34);
  ctx.fillStyle = '#23201e';
  ctx.font = '700 32px Paperlogy, SUITE, sans-serif';
  ctx.fillText(`${dateText}${timeText ? ` · ${timeText}` : ''}`, W / 2, dateBoxY + 84);
  if (dday) {
    ctx.fillStyle = '#a3554b';
    ctx.font = '700 18px SUITE, sans-serif';
    ctx.fillText(dday, W / 2, dateBoxY + 116);
  }

  // Venue card
  drawRoundedRect(ctx, 146, venueBoxY, W - 292, venueBoxH, 26);
  ctx.fillStyle = '#f5f8f5';
  ctx.fill();
  ctx.strokeStyle = '#d3e0d6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#3b5944';
  ctx.font = '700 18px SUITE, sans-serif';
  ctx.fillText('LOCATION', W / 2, venueBoxY + 34);
  ctx.fillStyle = '#23201e';
  ctx.font = '700 34px Paperlogy, SUITE, sans-serif';
  ctx.fillText(info.venue || '예식 장소 준비 중', W / 2, venueBoxY + 80);
  if (addrLines.length) {
    ctx.fillStyle = '#4f554f';
    ctx.font = '500 22px SUITE, sans-serif';
    addrLines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, venueBoxY + 120 + idx * 30);
    });
  }

  // Optional embedded QR block
  if (qrImg) {
    drawRoundedRect(ctx, 146, qrBoxY, W - 292, qrBoxH, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d3e0d6';
    ctx.lineWidth = 2;
    ctx.stroke();

    const qrBoxSize = 166;
    const qrX = 186;
    const qrY = qrBoxY + (qrBoxH - qrBoxSize) / 2;
    drawRoundedRect(ctx, qrX - 8, qrY - 8, qrBoxSize + 16, qrBoxSize + 16, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e4eae5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.drawImage(qrImg, qrX, qrY, qrBoxSize, qrBoxSize);

    const textX = qrX + qrBoxSize + 40;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3b5944';
    ctx.font = '700 18px SUITE, sans-serif';
    ctx.fillText('MOBILE INVITATION QR', textX, qrBoxY + 56);
    ctx.fillStyle = '#23201e';
    ctx.font = '700 30px Paperlogy, SUITE, sans-serif';
    ctx.fillText('모바일 청첩장 바로가기', textX, qrBoxY + 104);
    ctx.fillStyle = '#565c56';
    ctx.font = '500 21px SUITE, sans-serif';
    ctx.fillText('스마트폰 카메라로 QR 코드를 스캔하면', textX, qrBoxY + 144);
    ctx.fillText('예식 일정·지도·안내를 확인하실 수 있습니다.', textX, qrBoxY + 174);
    ctx.restore();
  }

  // Footer closing
  ctx.fillStyle = '#5c5752';
  ctx.font = '600 22px SUITE, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('귀한 걸음으로 축복해 주시는 모든 분께 진심으로 감사드립니다.', W / 2, footerY);

  return canvas;
}

export async function renderInvitationCardBlob(info, albums = [], options = {}) {
  const filename = options.includeQr ? 'wedding-invitation-card-qr.png' : 'wedding-invitation-card.png';
  const canvas = await renderInvitationCardCanvas(info, albums, options);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => {
      if (!result) reject(new Error('이미지 생성에 실패했습니다.'));
      else resolve(result);
    }, 'image/png');
  });
  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl, filename };
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = E('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadInvitationCardPng(info, albums = [], notify = () => {}, options = {}) {
  try {
    const payload = await renderInvitationCardBlob(info, albums, options);
    if (typeof options.onPreview === 'function' && (options.preferModal || isInAppBrowser())) {
      options.onPreview(payload);
      return true;
    }
    triggerBlobDownload(payload.blob, payload.filename);
    notify(`청첩장 이미지(${payload.filename})를 저장했습니다.`);
    return true;
  } catch (error) {
    notify(error?.message || '청첩장 이미지를 저장하지 못했습니다.', true);
    return false;
  }
}
