import { $, E, button, externalLink, image, downloadText } from './dom.js?v=wedding-features-55';
import { weddingDday } from './content.js?v=wedding-features-55';
import { scheduleCalendar, scheduleGoogleCalendarUrl } from './calendar.js?v=wedding-features-55';
import { studioFeeInfo, shootDeadlineSummary } from './planning.js?v=wedding-features-55';

function copyLachmaGuideSummary(ctx, studio) {
  const g = studio?.deepGuide;
  if (!g) return;
  const info = g.officialInfo || {};
  const visitLocations = (g.locations || []).filter(loc => !loc.isReference);
  const lines = [
    `📸 [웨딩 스튜디오 확정 & 공식 촬영 안내] ${studio.name} 스튜디오 (LACMA STUDIO)`,
    `· 촬영 일정: ${g.schedule?.label || '2027년 2월 3일 수요일 12:00 (예약 5~10분 전 도착 필수)'}`,
    `· 대표번호 / 운영시간: ${info.phone || studio.contact?.phone || '062-714-1970~1'} / ${info.hours || 'AM 09:00 ~ PM 06:30 (매주 월·화 정기휴무)'}`,
    ...(info.guideUrl ? [`· 공식 촬영 안내·확인서: ${info.guideUrl}`] : []),
    ...(info.lacmaInstaLabel ? [`· 인스타그램: ${info.lacmaInstaLabel}`] : []),
    `· 핵심 스타일: ${studio.style}`,
    ...(g.schedule?.milestoneNote ? [`· 일정 체크: ${g.schedule.milestoneNote}`] : []),
    ...(visitLocations.length ? [
      '',
      '🗺️ 당일 방문 동선 · 위치 · 주차 안내',
      ...(g.locationWarning ? [g.locationWarning] : []),
      ...visitLocations.map(loc => `- [${loc.step}] ${loc.name}: ${loc.address}${loc.subAddress ? ` (${loc.subAddress})` : ''} / 주차: ${loc.parking || '현장 확인'}`)
    ] : []),
    ...(g.officialNotices?.items?.length ? [
      '',
      '🚨 촬영 및 방문 필독사항 · 당일 현금 비용',
      ...(g.officialNotices.cashBanner ? [g.officialNotices.cashBanner] : []),
      ...g.officialNotices.items.map(item => `- ${item}`)
    ] : []),
    '',
    '🎒 신랑 & 신부 필수 준비사항',
    ...(g.prepChecklist || []).map(p => `- [${p.category}] ${(p.items || []).join(' / ')}`),
    '',
    '⏰ 2월 3일(수) 12:00 촬영 당일 타임테이블',
    ...(g.timetable || []).map(t => `- ${t.time} ${t.stage}: ${t.detail}`),
    ...(g.penaltyPolicy?.rows?.length ? [
      '',
      `📜 취소·변경 위약금 기준: ${g.penaltyPolicy.rows.map(([d, c, r]) => `${d}(취소 ${c}/변경 ${r})`).join(' · ')}`
    ] : [])
  ];
  const memo = !ctx.isGuestMode() && (ctx.getPrefs().notes?.[studio.id] || '').trim();
  if (memo) lines.push('', `📝 우리의 상담 메모: ${memo}`);
  ctx.copyTextToClipboard(lines.join('\n'), '라크마 공식 촬영 안내·루나메이크업 동선·준비물 요약을 복사했습니다.');
}

function renderStudioOfficialLocation(ctx, studio) {
  const loc = studio?.officialLocation;
  if (!loc) return null;
  const actions = [
    externalLink('네이버 지도 ↗', loc.naverMapUrl, 'button quiet small-copy-btn'),
    externalLink('카카오맵 ↗', loc.kakaoMapUrl, 'button quiet small-copy-btn'),
    loc.address ? button('주소 복사', () => ctx.copyVenueAddress(loc.address, `${loc.studioName || studio.name} 주소`), 'button quiet small-copy-btn') : null,
    externalLink('공식 촬영 안내 ↗', loc.guideUrl, 'button quiet small-copy-btn')
  ].filter(Boolean);
  return E('div', { class: 'studio-official-loc', 'aria-label': `${studio.name} 공식 위치 및 운영 안내` },
    E('strong', { class: 'small' }, `📍 공식 위치 · 운영 안내 (${loc.studioName || studio.name})`),
    E('p', { class: 'small lachma-loc-addr' }, loc.address),
    loc.parking ? E('p', { class: 'small muted' }, `🚗 주차: ${loc.parking}`) : null,
    loc.hours ? E('p', { class: 'small muted' }, `🕒 운영시간: ${loc.hours}`) : null,
    loc.note ? E('p', { class: 'small lachma-loc-subnote' }, loc.note) : null,
    actions.length ? E('div', { class: 'lachma-loc-actions' }, ...actions) : null);
}

function lachmaCalendarSpec(studio) {
  const g = studio?.deepGuide;
  const sched = g?.schedule || {};
  if (!sched.date) return null;
  return {
    uid: `studio-shoot-${studio.id}`,
    summary: `${studio.name} 스튜디오 웨딩촬영 (낮 ${sched.time || '12:00'})`,
    date: sched.date,
    time: sched.time || '12:00',
    location: '광주광역시 남구 중앙로 117 라크마 스튜디오',
    description: 'STEP 1 루나메이크업(광주 남구 천변좌로 432 1층) 헤어·메이크업 → STEP 2 라크마 스튜디오(광주 남구 중앙로 117, 예약 5~10분 전 도착 필수) · 당일 현금 헬퍼비 25만 원 준비'
  };
}

function renderLachmaDeepGuide(ctx, studio, compact = false) {
  const g = studio?.deepGuide;
  if (!g) return null;
  const guestMode = ctx.isGuestMode();
  const prefs = ctx.getPrefs();
  const sched = g.schedule || {};
  const info = g.officialInfo || {};
  const dday = sched.date ? weddingDday(sched.date) : null;
  const deadlines = sched.date ? shootDeadlineSummary(sched.date) : null;
  const calSpec = lachmaCalendarSpec(studio);
  let shootGcalBtn = null, shootIcsBtn = null;
  if (calSpec) {
    try {
      shootGcalBtn = externalLink('📅 촬영일 Google 캘린더 등록 ↗', scheduleGoogleCalendarUrl(calSpec), 'button quiet small-copy-btn');
      shootIcsBtn = button('📥 촬영 일정(.ics) 저장', () => {
        downloadText(scheduleCalendar(calSpec), `lachma-shoot-${sched.date}.ics`, 'text/calendar;charset=utf-8');
        ctx.toast('라크마 스튜디오 촬영 일정 파일(.ics)을 저장했습니다.');
      }, 'button quiet small-copy-btn');
    } catch {}
  }
  const officialLinks = [
    externalLink('📄 공식 촬영 안내·확인서 ↗', info.guideUrl, 'button quiet small-copy-btn'),
    info.lacmaInstaUrl ? externalLink(`📷 라크마 (${info.lacmaInstaLabel || '@lacma_studio_gwangju'}) ↗`, info.lacmaInstaUrl, 'button quiet small-copy-btn') : null,
    shootGcalBtn,
    shootIcsBtn
  ].filter(Boolean);
  const visitLocations = (g.locations || []).filter(loc => !loc.isReference);
  const checkedSet = new Set(prefs.shootChecklist || []);
  const allPrepIds = (g.prepChecklist || []).flatMap((grp, gi) => (grp.items || []).map((_, ii) => `shoot-${gi}-${ii}`));
  const donePrepCount = allPrepIds.filter(k => checkedSet.has(k)).length;
  const totalPrepCount = allPrepIds.length;
  const prepPct = totalPrepCount ? Math.round((donePrepCount / totalPrepCount) * 100) : 0;
  const togglePrepItem = (itemId, box) => {
    const next = new Set(ctx.getPrefs().shootChecklist || []);
    if (box.checked) next.add(itemId); else next.delete(itemId);
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootChecklist: [...next] });
      if (saved) {
        const activeMemo = $('.selected-studio-card textarea');
        const keepFocus = document.activeElement === activeMemo;
        const draftMemo = activeMemo?.value;
        ctx.render();
        const nextMemo = $('.selected-studio-card textarea');
        if (nextMemo && draftMemo !== undefined && draftMemo !== (ctx.getPrefs().notes?.[studio.id] || '')) nextMemo.value = draftMemo;
        if (keepFocus) nextMemo?.focus({ preventScroll: true });
      } else box.checked = checkedSet.has(itemId);
      return saved;
    });
  };
  const notesList = Array.isArray(g.collectionNotes) ? g.collectionNotes : (g.collectionNotes ? [g.collectionNotes] : []);
  return E('div', { class: 'lachma-deep-guide' + (compact ? ' compact' : ''), 'aria-label': `${studio.name} 확정 촬영 일정 및 공식 촬영 안내` },
    E('div', { class: 'lachma-schedule-banner' },
      E('div', { class: 'lachma-schedule-main' },
        E('span', { class: 'spec-chip highlight' }, `🗓️ 촬영 확정: ${sched.label || '2027년 2월 3일 수요일 12:00 (낮 12시)'}`),
        dday ? E('span', { class: 'spec-chip direct' }, `⏳ 촬영일 ${dday}`) : null,
        info.hours ? E('span', { class: 'spec-chip' }, `🕒 ${info.hours}`) : null),
      deadlines ? E('div', { class: 'lachma-deadline-chips' },
        E('span', { class: 'spec-chip' }, `🌙 야간촬영 신청 마감(7일 전): ${deadlines.nightDeadline}`),
        E('span', { class: 'spec-chip' }, `📅 월·화 정기휴무 전 최종 문의 권장: ${deadlines.preHolidayDate} (일)`),
        E('span', { class: 'spec-chip highlight' }, `⚖️ 위약금 기준: ${deadlines.penaltyLabel}`)) : null,
      sched.milestoneNote ? E('p', { class: 'small lachma-milestone-note' }, `💡 ${sched.milestoneNote}`) : null,
      officialLinks.length ? E('div', { class: 'lachma-official-links' }, ...officialLinks) : null),
    g.overview ? E('p', { class: 'record-body lachma-overview' }, g.overview) : null,
    visitLocations.length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '🗺️ 당일 방문 동선 · 위치 · 주차 안내 (루나메이크업 → 라크마 스튜디오)'),
      g.locationWarning ? E('div', { class: 'lachma-location-warning', role: 'note' }, g.locationWarning) : null,
      E('div', { class: 'lachma-location-grid' }, visitLocations.map(loc => {
        const locActions = [
          externalLink('네이버 지도 ↗', loc.naverMapUrl, 'button quiet small-copy-btn'),
          externalLink('카카오맵 ↗', loc.kakaoMapUrl, 'button quiet small-copy-btn'),
          loc.address ? button('주소 복사', () => ctx.copyVenueAddress(loc.address, `${loc.name} 주소`), 'button quiet small-copy-btn') : null
        ].filter(Boolean);
        return E('article', { class: 'lachma-location-card' },
          E('span', { class: 'lachma-step-badge' }, loc.step),
          E('strong', { class: 'lachma-loc-name' }, loc.name),
          E('p', { class: 'small lachma-loc-addr' }, loc.address),
          loc.subAddress ? E('p', { class: 'small lachma-loc-subnote' }, loc.subAddress) : null,
          loc.parking ? E('p', { class: 'small muted lachma-loc-parking' }, `🚗 주차: ${loc.parking}`) : null,
          locActions.length ? E('div', { class: 'lachma-loc-actions' }, ...locActions) : null,
          loc.mapImage ? E('button', { type: 'button', class: 'map-preview-open', 'aria-label': `${loc.name} 약도 크게 보기`, onclick: () => ctx.openPhotos(`${loc.name} 위치 안내 약도`, [loc.mapImage], 0) },
            image(loc.mapImage, loc.mapImageAlt || `${loc.name} 위치 안내 약도`, { class: 'luna-map-thumb' }),
            E('span', { class: 'map-preview-caption' }, '🗺️ 루나메이크업 위치 약도 크게 보기')) : null);
      }))) : null,
    g.officialNotices?.items?.length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '🚨 촬영 및 방문 필독사항 · 당일 현금 비용'),
      g.officialNotices.cashBanner ? E('div', { class: 'lachma-cash-banner' }, g.officialNotices.cashBanner) : null,
      E('ul', { class: 'lachma-notice-list' }, g.officialNotices.items.map(item => E('li', { class: 'small' + (/\[필독\]|★/.test(item) ? ' is-critical' : '') }, item)))) : null,
    (g.prepChecklist || []).length ? E('div', { class: 'lachma-section' },
      E('div', { class: 'lachma-prep-head' },
        E('h3', { class: 'lachma-subtitle' }, '🎒 신랑 & 신부 필수 준비사항 (공식 안내 & 2월 겨울 대비)'),
        !guestMode ? E('div', { class: 'lachma-prep-controls' },
          E('span', { class: 'badge' }, `준비물 점검 ${donePrepCount}/${totalPrepCount} (${prepPct}%)`),
          donePrepCount > 0 ? button('준비물 체크 초기화', () => {
            if (!confirm('라크마 촬영 준비물 체크 상태를 모두 초기화할까요?')) return;
            ctx.queuePreference(async () => {
              const saved = await ctx.savePrefs({ ...ctx.getPrefs(), shootChecklist: [] });
              if (saved) { ctx.render(); ctx.toast('촬영 준비물 체크를 초기화했습니다.'); }
              return saved;
            });
          }, 'button quiet small-copy-btn') : null) : null),
      E('div', { class: 'lachma-prep-grid' }, g.prepChecklist.map((group, gi) => E('article', { class: 'lachma-prep-card' },
        E('strong', {}, group.category),
        guestMode ? E('ul', { class: 'lachma-prep-list' }, (group.items || []).map(item => E('li', { class: 'small' }, item))) :
          E('ul', { class: 'lachma-prep-check-list' }, (group.items || []).map((item, ii) => {
            const itemId = `shoot-${gi}-${ii}`;
            const box = E('input', { type: 'checkbox', 'aria-label': `${group.category} - ${item}` });
            box.checked = checkedSet.has(itemId);
            box.addEventListener('change', () => togglePrepItem(itemId, box));
            return E('li', { class: 'lachma-prep-check-item' + (box.checked ? ' done' : '') },
              E('label', { class: 'checklist-label' }, box, E('span', { class: 'small' }, item)));
          })))))) : null,
    (g.timetable || []).length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '⏰ 2월 3일 (수) 12:00 촬영 당일 동선 타임테이블'),
      E('ol', { class: 'timetable-list lachma-timetable' }, g.timetable.map(row => E('li', { class: 'timetable-row' + (row.time.includes('12:00') ? ' highlight' : '') },
        E('strong', { class: 'timetable-time' }, row.time),
        E('div', { class: 'timetable-detail' },
          E('strong', {}, row.stage),
          E('p', { class: 'small muted' }, row.detail)))))) : null,
    (g.signatureScenes || []).length ? E('div', { class: 'lachma-section' },
      E('h3', { class: 'lachma-subtitle' }, '✨ 라크마 시그니처 4대 촬영 콘셉트 & 빛 활용법'),
      E('div', { class: 'lachma-scene-grid' }, g.signatureScenes.map(scene => E('article', { class: 'lachma-scene-card' },
        E('strong', {}, scene.title),
        E('p', { class: 'small' }, scene.desc))))) : null,
    (g.penaltyPolicy || g.partnership) ? E('details', { class: 'disclosure lachma-policy-details' },
      E('summary', {}, '📜 취소·변경 위약금 규정 · 촬영 확인서 · 바이가미 제휴 혜택 보기'),
      E('div', { class: 'lachma-policy-body' },
        g.penaltyPolicy ? E('div', { class: 'lachma-penalty-block' },
          g.penaltyPolicy.intro ? E('p', { class: 'small muted' }, g.penaltyPolicy.intro) : null,
          E('div', { class: 'lachma-penalty-table-wrap' },
            E('table', { class: 'lachma-penalty-table' },
              E('thead', {}, E('tr', {}, E('th', { scope: 'col' }, '구분 (촬영일 기준)'), E('th', { scope: 'col' }, '취소 위약금'), E('th', { scope: 'col' }, '변경 위약금'))),
              E('tbody', {}, (g.penaltyPolicy.rows || []).map(([period, cancelFee, changeFee], idx) => E('tr', { class: deadlines?.penaltyIndex === idx ? 'is-active-tier' : '' },
                E('th', { scope: 'row' }, deadlines?.penaltyIndex === idx ? `👉 ${period} (현재 구간)` : period),
                E('td', {}, cancelFee),
                E('td', {}, changeFee))))))) : null,
        g.partnership ? E('div', { class: 'lachma-partnership-box' },
          E('strong', { class: 'small' }, `💍 ${g.partnership.title}`),
          E('p', { class: 'small' }, g.partnership.summary),
          info.guideUrl ? externalLink('📄 공식 촬영 안내 페이지에서 확인서 제출하기 ↗', info.guideUrl, 'button quiet small-copy-btn') : null) : null)) : null,
    notesList.length ? E('div', { class: 'lachma-collection-note' },
      E('strong', { class: 'small' }, '📌 공식 촬영 안내 및 웨딩홀 제공 자료 출처 구분'),
      ...notesList.map(note => E('p', { class: 'small muted' }, note))) : null);
}

function studioSpecChips(ctx, studio, compact = false) {
  const fee = studioFeeInfo(studio);
  const hasOfficialGuide = Boolean(studio.deepGuide?.officialNotices);
  const feeChip = hasOfficialGuide && fee.unknown
    ? E('span', { class: 'spec-chip' }, '📋 기본 구성 계약서 확인')
    : E('span', { class: 'spec-chip' + (fee.unknown ? '' : ' highlight') }, fee.label);
  const rawPhone = studio.deepGuide?.officialInfo?.phone || studio.contact?.phone || '';
  const dialHref = rawPhone ? `tel:${rawPhone.split('~')[0].replace(/[^\d+]/g, '')}` : '';
  const phoneLabel = studio.deepGuide?.officialInfo?.phone
    ? `📞 ${studio.deepGuide.officialInfo.phone} (월·화 휴무)`
    : (studio.contact?.phone ? `📞 ${studio.contact.phone}` : '📞 연락처 미기재');
  const phoneChip = dialHref
    ? E('a', { class: 'spec-chip', href: dialHref, 'aria-label': `${studio.name} 대표번호 전화 걸기 (${phoneLabel.replace(/^📞\s*/, '')})` }, phoneLabel)
    : E('span', { class: 'spec-chip' }, phoneLabel);
  const hasNote = !ctx.isGuestMode() && Boolean(ctx.getPrefs().notes?.[studio.id]?.trim());
  return E('div', { class: 'trip-spec-chips studio-spec-chips', 'aria-label': `${studio.name} 핵심 요약` },
    studio.deepGuide?.schedule ? E('span', { class: 'spec-chip direct' }, `🗓️ ${studio.deepGuide.schedule.shortLabel || '2/3(수) 12:00 촬영 확정'}`) : null,
    feeChip,
    !compact && hasOfficialGuide ? E('span', { class: 'spec-chip highlight' }, '🙌 헬퍼비 25만 (당일 현금)') : null,
    phoneChip,
    hasNote && compact ? E('span', { class: 'spec-chip highlight' }, '📝 메모 있음') : null,
    !compact && studio.fit ? E('span', { class: 'spec-chip' }, '🎯 ' + studio.fit) : null);
}

function studioProsCons(studio) {
  return E('div', { class: 'trip-pros-cons studio-pros-cons' },
    E('div', { class: 'pros-box' },
      E('strong', { class: 'pros-title' }, '👍 사진의 장점'),
      E('p', { class: 'small' }, studio.pros || '미기재')),
    E('div', { class: 'cons-box' },
      E('strong', { class: 'cons-title' }, '🤔 취향에 따른 아쉬움'),
      E('p', { class: 'small' }, studio.cons || '미기재')));
}

function renderLachmaStudioCard(ctx, studio) {
  const guestMode = ctx.isGuestMode();
  const memo = E('textarea', { maxlength: '1000', 'aria-label': `${studio.name} 개인 메모`, placeholder: '마음에 든 장면이나 촬영 당일 꼭 챙길 내용을 남겨요.' });
  memo.value = ctx.getPrefs().notes?.[studio.id] || '';
  memo.addEventListener('input', () => {
    const value = memo.value;
    ctx.queuePreference(async () => {
      const saved = await ctx.savePrefs({ ...ctx.getPrefs(), notes: { ...(ctx.getPrefs().notes || {}), [studio.id]: value } });
      const currentMemo = $('.selected-studio-card textarea');
      if (!saved) { if (currentMemo) currentMemo.value = ctx.getPrefs().notes?.[studio.id] || ''; }
      else if (currentMemo && currentMemo !== memo && currentMemo.value !== value) currentMemo.value = value;
      return saved;
    });
  });
  return E('section', { class: 'selected-studio-card', 'aria-label': `${studio.name} 스튜디오 촬영 안내` },
    E('div', { class: 'selected-studio-head' },
      E('div', {},
        E('p', { class: 'eyebrow' }, 'OUR CONFIRMED STUDIO & OFFICIAL SHOOT GUIDE'),
        E('h2', {}, `📸 ${studio.name} 스튜디오`),
        E('p', { class: 'small muted' }, studio.style)),
      E('div', { class: 'page-actions' },
        studio.deepGuide ? button('📋 촬영 브리핑 복사', () => copyLachmaGuideSummary(ctx, studio), 'button quiet') : null,
        studio.deepGuide?.officialInfo?.guideUrl ? externalLink('📄 공식 안내 원문 ↗', studio.deepGuide.officialInfo.guideUrl, 'button quiet') : null,
        button('사진 크게 보기', () => ctx.openPhotos(studio.name, studio.images.map(v => v.src), 0), 'button quiet'))),
    studioSpecChips(ctx, studio),
    E('div', { class: 'studio-photos' }, studio.images.map((im, index) => E('button', {
      type: 'button',
      class: 'photo-open studio-photo-frame',
      'aria-label': `${studio.name} 사진 ${index + 1} 원본 크게 보기`,
      onclick: () => ctx.openPhotos(studio.name, studio.images.map(value => value.src), index)
    }, image(im.src, `${studio.name} · ${im.file}`), E('span', { class: 'studio-photo-zoom', 'aria-hidden': 'true' }, '🔍 원본 보기')))),
    E('p', { class: 'small muted studio-sample-caption' }, '제공된 라크마 스튜디오 대표 샘플 사진입니다. 두 사람의 개인 포토 앨범과는 별도로 구분됩니다.'),
    studioProsCons(studio),
    !guestMode ? E('label', { class: 'field studio-memo-field' }, E('span', {}, '우리의 메모 ', E('span', { class: 'muted small' }, '· 이 기기에 저장')), memo) : null,
    studio.deepGuide ? renderLachmaDeepGuide(ctx, studio) : renderStudioOfficialLocation(ctx, studio));
}

export function renderStudios(ctx) {
  if (ctx.isGuestMode()) return ctx.guestRestrictedView('라크마 스튜디오 촬영 안내', '신랑·신부의 웨딩 촬영 일정과 준비물을 정리한 공간입니다.', 'OUR STUDIO · LACMA');
  const { status, error, activeLachma } = ctx.getStudiosState();
  if (status !== 'ready') return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물을 확인해요.', null, 'OUR STUDIO · LACMA'),
    status === 'loading' ? E('p', { role: 'status' }, '스튜디오 자료를 불러오는 중입니다.') : ctx.empty('스튜디오 자료를 불러오지 못했어요.', error, '스튜디오 다시 불러오기', ctx.loadStudios, true)
  ];
  if (!activeLachma) return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물을 확인해요.', null, 'OUR STUDIO · LACMA'),
    ctx.empty('라크마 스튜디오 정보를 찾을 수 없어요.', '스튜디오 자료를 다시 불러와 주세요.', '스튜디오 다시 불러오기', ctx.loadStudios, true)
  ];
  return [
    ctx.pageHeader('라크마 스튜디오 촬영 안내', '확정된 촬영 일정과 당일 방문 동선, 필수 준비물, 대표 샘플을 한곳에 모았습니다.', null, 'OUR STUDIO · LACMA'),
    renderLachmaStudioCard(ctx, activeLachma)
  ];
}
