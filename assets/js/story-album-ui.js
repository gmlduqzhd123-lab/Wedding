import { formatDate } from './content.js?v=wedding-features-61';
import { E, button, image } from './dom.js?v=wedding-features-61';

let storySort = 'asc';

export function sortedStories(stories = []) {
  return [...stories].sort((a, b) => (
    storySort === 'desc'
      ? (b.date || '0000').localeCompare(a.date || '0000')
      : (a.date || '9999').localeCompare(b.date || '9999')
  ));
}

export function renderStoriesView(ctx) {
  const content = ctx.getContent();
  const guestMode = ctx.isGuestMode();
  const main = ctx.getMain();
  const records = sortedStories(content.stories);
  const sortBar = records.length ? E('div', { class: 'story-toolbar' },
    E('span', { class: 'small muted' }, `총 ${records.length}개의 이야기`),
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
      }, label)))) : null;
  return [
    ctx.pageHeader('우리가 함께 걸어온 시간', '첫 만남, 기억하고 싶은 날, 함께 내린 결심을 기록해요.', ctx.editButton('이야기 추가', () => ctx.openEditor('stories')), 'OUR STORY'),
    sortBar,
    records.length ? E('section', { class: 'timeline' }, records.map(item => E('article', { class: 'story-card' + (item.image ? ' has-image' : ''), 'data-record-id': item.id },
      item.image ? E('button', { type: 'button', class: 'photo-open story-photo-open', 'aria-label': `${item.title} 사진 확대`, onclick: () => ctx.openPhotos(item.title, [item.image], 0) }, image(item.image, item.title, { decoding: 'async' })) : null,
      E('div', {}, E('p', { class: 'record-date' }, item.date ? formatDate(item.date) : '날짜 없는 기록'), E('h2', {}, item.title), E('p', { class: 'record-body' }, item.body), ctx.recordActions('stories', item))))) :
      ctx.empty(guestMode ? '두 사람의 이야기를 정성껏 담고 있습니다.' : '첫 번째 이야기를 남겨 볼까요?', guestMode ? '첫 만남부터 결혼을 결심한 순간까지, 곧 따뜻한 이야기로 찾아뵙겠습니다.' : '처음 만난 날도, 함께 웃었던 평범한 날도 우리의 일대기가 됩니다.', '첫 이야기 쓰기', () => ctx.openEditor('stories'))
  ];
}

export function openAlbumPhotos(ctx, album) {
  if (album.images.length) ctx.openPhotos(album.title, album.images);
  else ctx.showDialog(album.title, E('p', {}, '아직 등록된 사진이 없습니다.'));
}

export function renderAlbumsView(ctx) {
  const content = ctx.getContent();
  const guestMode = ctx.isGuestMode();
  return [
    ctx.pageHeader('오래 간직할 우리의 순간', '사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.', ctx.editButton('앨범 추가', () => ctx.openEditor('albums')), 'PHOTO ALBUM'),
    content.albums.length ? E('section', { class: 'album-grid' }, content.albums.map((item, idx) => E('article', { class: 'album-card', 'data-record-id': item.id },
      item.images.length
        ? E('button', { type: 'button', class: 'photo-open album-cover-open', 'aria-label': `${item.title} 앨범 사진 ${item.images.length}장 보기`, onclick: () => openAlbumPhotos(ctx, item) }, image(item.images[0], item.title, { class: 'album-cover', decoding: 'async' }))
        : E('div', { class: 'album-placeholder' }, 'Our memories'),
      E('div', { class: 'album-info' },
        E('p', { class: 'record-date' },
          [item.date ? formatDate(item.date) : '', `사진 ${item.images.length}장`].filter(Boolean).join(' · '),
          !guestMode && idx === 0 && item.images.length ? [' ', E('span', { class: 'badge' }, '✨ 청첩장 대표')] : null),
        E('h2', {}, item.title),
        E('p', { class: 'record-body' }, item.body),
        button('사진 보기', () => openAlbumPhotos(ctx, item), 'text-button'),
        ctx.recordActions('albums', item))))) :
      ctx.empty(guestMode ? '웨딩 포토 앨범을 준비하고 있습니다.' : '우리의 사진을 담을 첫 앨범', guestMode ? '두 사람의 소중한 웨딩 사진들이 곧 이곳에 채워질 예정입니다.' : '사진을 직접 선택하거나 npm run photos로 웹용 사본을 만들어 앨범을 등록할 수 있어요.', '첫 앨범 만들기', () => ctx.openEditor('albums'))
  ];
}
