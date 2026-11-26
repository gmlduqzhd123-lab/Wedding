import { formatDate } from './content.js?v=wedding-features-66';
import { dateSpan } from './travel.js?v=wedding-features-66';
import { $, E, button, image, searchBox } from './dom.js?v=wedding-features-66';

let storySort = 'asc';
let storyYearFilter = 'all';
let storyQuery = '';

export function focusStorySearch(query = '') {
  storyYearFilter = 'all';
  storyQuery = String(query || '');
}

export function sortedStories(stories = []) {
  return [...stories].sort((a, b) => (
    storySort === 'desc'
      ? (b.date || '0000').localeCompare(a.date || '0000')
      : (a.date || '9999').localeCompare(b.date || '9999')
  ));
}

export function buildStoriesSummaryText(stories = [], invitation = {}) {
  const ordered = [...(Array.isArray(stories) ? stories : [])].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  if (!ordered.length) return '';
  const p1 = (invitation?.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (invitation?.partner2 || '').replace(/^신부\s*/, '').trim();
  const couple = (p1 && p2) ? `${p1} ♥ ${p2}` : '우리 두 사람';
  const lines = [`📖 [${couple} · 우리의 일대기 (${ordered.length}개의 기록)]`, ''];
  ordered.forEach((item, idx) => {
    const when = item.date ? formatDate(item.date) : '날짜 미정';
    lines.push(`${idx + 1}. ${item.title} (${when})`);
    if (item.body) lines.push(`   ${item.body.split(/\r?\n/)[0].slice(0, 120)}`);
  });
  return lines.join('\n');
}

export function renderStoriesView(ctx) {
  const content = ctx.getContent();
  const guestMode = ctx.isGuestMode();
  const main = ctx.getMain();
  const allOrdered = sortedStories(content.stories);
  const datedSorted = [...content.stories].filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date || '')).sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = datedSorted[0]?.date || '';
  const invDate = content.invitation?.date || '';
  const years = [...new Set(datedSorted.map(s => s.date.slice(0, 4)))].sort();
  if (storyYearFilter !== 'all' && !years.includes(storyYearFilter)) storyYearFilter = 'all';

  const q = storyQuery.trim().toLocaleLowerCase();
  const records = allOrdered.filter(item =>
    (storyYearFilter === 'all' || (item.date || '').startsWith(storyYearFilter)) &&
    (!q || `${item.title || ''} ${item.body || ''} ${item.date || ''}`.toLocaleLowerCase().includes(q))
  );

  const search = searchBox({
    id: 'story-search',
    value: storyQuery,
    placeholder: '이야기 제목·내용·날짜 검색',
    ariaLabel: '우리의 일대기 검색',
    onInput: (val, el) => {
      const start = el.selectionStart, end = el.selectionEnd;
      storyQuery = val;
      ctx.render();
      const target = $('#story-search');
      if (target) {
        target.focus({ preventScroll: true });
        try { target.setSelectionRange(start, end); } catch {}
      }
    }
  });

  const activeFilters = [storyYearFilter !== 'all', Boolean(q)].filter(Boolean).length;
  const resetFilters = () => { storyYearFilter = 'all'; storyQuery = ''; ctx.render(); $('#story-search')?.focus({ preventScroll: true }); };

  const yearBar = years.length >= 2 ? E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '연도별 일대기 보기' },
    [['all', `전체 연도 (${allOrdered.length})`], ...years.map(y => [y, `${y}년 (${allOrdered.filter(s => (s.date || '').startsWith(y)).length})`])].map(([key, label]) => E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-story-year': key,
      'aria-pressed': String(storyYearFilter === key),
      onclick: () => {
        storyYearFilter = key;
        ctx.render();
        main.querySelector(`[data-story-year="${key}"]`)?.focus({ preventScroll: true });
      }
    }, label))) : null;

  const sortBar = allOrdered.length ? E('div', { class: 'story-toolbar-wrap' },
    E('div', { class: 'story-toolbar' },
      E('span', { class: 'small muted', 'aria-live': 'polite' }, activeFilters ? `${records.length} / ${allOrdered.length}개의 이야기` : `총 ${allOrdered.length}개의 이야기`),
      E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '일대기 정렬 순서' },
        [['asc', '🕰️ 시간순 (첫 만남부터)'], ['desc', '✨ 최신순 (최근 기록부터)']].map(([key, label]) => E('button', {
          type: 'button',
          class: 'button quiet trip-filter-chip',
          'data-story-sort': key,
          'aria-pressed': String(storySort === key),
          onclick: () => {
            storySort = key;
            ctx.render();
            main.querySelector(`[data-story-sort="${key}"]`)?.focus({ preventScroll: true });
          }
        }, label)))),
    E('div', { class: 'story-filter-row' },
      search.wrap,
      activeFilters ? button(`✕ 필터 초기화 (${activeFilters})`, resetFilters, 'filter-reset-chip') : null),
    yearBar) : null;

  const headerActions = E('div', { class: 'page-actions' },
    ctx.editButton('이야기 추가', () => ctx.openEditor('stories')),
    allOrdered.length ? button('📋 일대기 요약 복사', () => ctx.copyTextToClipboard(buildStoriesSummaryText(allOrdered, content.invitation), '우리의 일대기 요약을 복사했습니다.', '일대기 요약 복사'), 'button quiet') : null);

  return [
    ctx.pageHeader('우리가 함께 걸어온 시간', '첫 만남, 기억하고 싶은 날, 함께 내린 결심을 기록해요.', allOrdered.length || !guestMode ? headerActions : null, 'OUR STORY'),
    sortBar,
    allOrdered.length
      ? (records.length
        ? E('section', { class: 'timeline' }, records.map(item => {
          const badges = [];
          if (item.date && firstDate && item.date === firstDate) badges.push(E('span', { class: 'spec-chip direct' }, '🌱 첫 기록'));
          else if (item.date && firstDate) {
            const elapsed = dateSpan(firstDate, item.date);
            if (elapsed !== null && elapsed > 0) badges.push(E('span', { class: 'spec-chip' }, `함께한 +${elapsed.toLocaleString('ko-KR')}일`));
          }
          if (item.date && invDate) {
            const beforeWed = dateSpan(item.date, invDate);
            if (beforeWed !== null && beforeWed > 0) badges.push(E('span', { class: 'spec-chip highlight' }, `예식 D-${beforeWed.toLocaleString('ko-KR')}`));
          }
          return E('article', { class: 'story-card' + (item.image ? ' has-image' : ''), 'data-record-id': item.id },
            item.image ? E('button', { type: 'button', class: 'photo-open story-photo-open', 'aria-label': `${item.title} 사진 확대`, onclick: () => ctx.openPhotos(item.title, [item.image], 0) }, image(item.image, item.title, { decoding: 'async' })) : null,
            E('div', {},
              E('div', { class: 'story-card-meta' },
                E('p', { class: 'record-date' }, item.date ? formatDate(item.date) : '날짜 없는 기록'),
                badges.length ? E('div', { class: 'region-matrix-tags' }, badges) : null),
              E('h2', {}, item.title),
              E('p', { class: 'record-body' }, item.body),
              ctx.recordActions('stories', item)));
        }))
        : E('div', { class: 'no-results-box' },
          E('p', { class: 'no-results' }, '검색 조건에 맞는 이야기가 없습니다.'),
          button('모든 필터 초기화', resetFilters, 'button quiet')))
      : ctx.empty(guestMode ? '두 사람의 이야기를 정성껏 담고 있습니다.' : '첫 번째 이야기를 남겨 볼까요?', guestMode ? '첫 만남부터 결혼을 결심한 순간까지, 곧 따뜻한 이야기로 찾아뵙겠습니다.' : '처음 만난 날도, 함께 웃었던 평범한 날도 우리의 일대기가 됩니다.', '첫 이야기 쓰기', () => ctx.openEditor('stories'))
  ];
}

export function openAlbumPhotos(ctx, album, startIndex = 0) {
  if (album.images.length) ctx.openPhotos(album.title, album.images, startIndex);
  else ctx.showDialog(album.title, E('p', {}, '아직 등록된 사진이 없습니다.'));
}

export function renderAlbumsView(ctx) {
  const content = ctx.getContent();
  const guestMode = ctx.isGuestMode();
  return [
    ctx.pageHeader('오래 간직할 우리의 순간', '사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.', ctx.editButton('앨범 추가', () => ctx.openEditor('albums')), 'PHOTO ALBUM'),
    content.albums.length ? E('section', { class: 'album-grid' }, content.albums.map((item, idx) => {
      const extraThumbs = (item.images || []).slice(1, 5);
      const moreCount = Math.max(0, (item.images || []).length - 5);
      return E('article', { class: 'album-card', 'data-record-id': item.id },
        item.images.length
          ? E('button', { type: 'button', class: 'photo-open album-cover-open', 'aria-label': `${item.title} 앨범 사진 ${item.images.length}장 보기`, onclick: () => openAlbumPhotos(ctx, item, 0) }, image(item.images[0], item.title, { class: 'album-cover', decoding: 'async' }))
          : E('div', { class: 'album-placeholder' }, 'Our memories'),
        extraThumbs.length ? E('div', { class: 'album-thumb-strip', 'aria-label': `${item.title} 미리보기 사진` },
          extraThumbs.map((src, tIdx) => E('button', {
            type: 'button',
            class: 'album-mini-thumb-btn',
            'aria-label': `${item.title} ${tIdx + 2}번 사진 크게 보기`,
            onclick: () => openAlbumPhotos(ctx, item, tIdx + 1)
          }, image(src, `${item.title} ${tIdx + 2}`, { decoding: 'async' }))),
          moreCount > 0 ? E('button', {
            type: 'button',
            class: 'album-mini-more',
            'aria-label': `나머지 사진 ${moreCount}장 더 보기`,
            onclick: () => openAlbumPhotos(ctx, item, 5)
          }, `+${moreCount}`) : null) : null,
        E('div', { class: 'album-info' },
          E('p', { class: 'record-date' },
            [item.date ? formatDate(item.date) : '', `사진 ${item.images.length}장`].filter(Boolean).join(' · '),
            !guestMode && idx === 0 && item.images.length ? [' ', E('span', { class: 'badge' }, '✨ 청첩장 대표')] : null),
          E('h2', {}, item.title),
          E('p', { class: 'record-body' }, item.body),
          button('사진 보기', () => openAlbumPhotos(ctx, item, 0), 'text-button'),
          ctx.recordActions('albums', item)));
    })) :
      ctx.empty(guestMode ? '웨딩 포토 앨범을 준비하고 있습니다.' : '우리의 사진을 담을 첫 앨범', guestMode ? '두 사람의 소중한 웨딩 사진들이 곧 이곳에 채워질 예정입니다.' : '사진을 직접 선택하거나 npm run photos로 웹용 사본을 만들어 앨범을 등록할 수 있어요.', '첫 앨범 만들기', () => ctx.openEditor('albums'))
  ];
}
