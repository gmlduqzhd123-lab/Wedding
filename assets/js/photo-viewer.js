import { E, button, image } from './dom.js?v=wedding-features-74';

export function openPhotoViewer(ctx, title, photos, startIndex = 0) {
  if (!photos?.length) return null;
  let index = Math.max(0, Math.min(startIndex, photos.length - 1));
  let slideshowTimer = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;

  const stopSlideshow = () => {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
  };

  const resetZoom = () => {
    scale = 1;
    panX = 0;
    panY = 0;
  };

  const clampPan = (stageEl) => {
    if (scale <= 1) {
      panX = 0;
      panY = 0;
      return;
    }
    const maxX = ((stageEl?.clientWidth || 320) * (scale - 1)) / 2;
    const maxY = ((stageEl?.clientHeight || 320) * (scale - 1)) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  };

  const body = E('div', { class: 'photo-viewer' });
  let stageRef = null;
  let imgRef = null;
  let zoomLabelRef = null;
  let zoomOutBtnRef = null;
  let zoomInBtnRef = null;

  const applyTransform = () => {
    if (imgRef) {
      clampPan(stageRef);
      imgRef.style.transform = scale > 1 ? `translate3d(${panX}px, ${panY}px, 0) scale(${scale})` : '';
      imgRef.classList.toggle('is-zoomed', scale > 1);
    }
    if (stageRef) stageRef.classList.toggle('is-zoomed', scale > 1);
    if (zoomLabelRef) zoomLabelRef.textContent = `${Math.round(scale * 100)}%`;
    if (zoomOutBtnRef) zoomOutBtnRef.disabled = scale <= 1;
    if (zoomInBtnRef) zoomInBtnRef.disabled = scale >= 3;
  };

  const setZoom = nextScale => {
    scale = Math.max(1, Math.min(3, Math.round(nextScale * 100) / 100));
    if (scale <= 1.02) {
      resetZoom();
    } else {
      stopSlideshow();
    }
    applyTransform();
  };

  const goDelta = (delta, focusSelector = null) => {
    if (photos.length < 2) return;
    index = (index + delta + photos.length) % photos.length;
    resetZoom();
    draw();
    if (focusSelector) body.querySelector(focusSelector)?.focus();
  };

  const toggleSlideshow = () => {
    if (slideshowTimer) {
      stopSlideshow();
    } else {
      resetZoom();
      slideshowTimer = setInterval(() => {
        index = (index + 1) % photos.length;
        resetZoom();
        draw();
      }, 3000);
    }
    draw();
  };

  let touchStartX = null;
  let touchStartY = null;
  let panStartX = 0;
  let panStartY = 0;
  let pinchStartDist = null;
  let pinchStartScale = 1;
  let lastTapAt = 0;

  const touchDist = touches => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  body.addEventListener('touchstart', event => {
    const touches = event.touches;
    if (!touches || !touches.length) return;
    if (touches.length === 2) {
      pinchStartDist = touchDist(touches);
      pinchStartScale = scale;
      touchStartX = null;
      touchStartY = null;
      stopSlideshow();
      return;
    }
    if (touches.length === 1) {
      const t = touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      panStartX = panX;
      panStartY = panY;
    }
  }, { passive: true });

  body.addEventListener('touchmove', event => {
    const touches = event.touches;
    if (!touches) return;
    if (touches.length === 2 && pinchStartDist) {
      event.preventDefault();
      const ratio = touchDist(touches) / Math.max(10, pinchStartDist);
      scale = Math.max(1, Math.min(3, pinchStartScale * ratio));
      applyTransform();
      return;
    }
    if (touches.length === 1 && scale > 1 && touchStartX !== null) {
      event.preventDefault();
      const t = touches[0];
      panX = panStartX + (t.clientX - touchStartX);
      panY = panStartY + (t.clientY - touchStartY);
      applyTransform();
    }
  }, { passive: false });

  body.addEventListener('touchend', event => {
    if (pinchStartDist && (!event.touches || event.touches.length < 2)) {
      pinchStartDist = null;
      if (scale < 1.08) resetZoom();
      applyTransform();
      touchStartX = null;
      touchStartY = null;
      return;
    }
    const t = event.changedTouches?.[0];
    if (touchStartX === null || !t) {
      touchStartX = null;
      touchStartY = null;
      return;
    }
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - (touchStartY ?? t.clientY);
    touchStartX = null;
    touchStartY = null;

    // Double-tap on stage to toggle 1x <-> 2.2x zoom
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && event.target?.closest?.('.photo-stage')) {
      const now = Date.now();
      if (now - lastTapAt < 300) {
        lastTapAt = 0;
        setZoom(scale > 1.1 ? 1 : 2.2);
        return;
      }
      lastTapAt = now;
    }

    if (scale > 1.05) return;

    if (photos.length > 1 && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      goDelta(dx < 0 ? 1 : -1);
    } else if (dy >= 85 && dy > Math.abs(dx) * 1.4) {
      stopSlideshow();
      ctx.closeDialog();
    }
  }, { passive: true });

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  body.addEventListener('wheel', event => {
    if (!event.target?.closest?.('.photo-stage')) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.35 : -0.35;
    setZoom(scale + delta);
  }, { passive: false });

  body.addEventListener('mousedown', event => {
    if (event.button !== 0 || scale <= 1 || !event.target?.closest?.('.photo-stage')) return;
    event.preventDefault();
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX;
    panStartY = panY;
    stageRef?.classList.add('is-dragging');
  });

  const onWindowMouseMove = event => {
    if (!dragging) return;
    panX = panStartX + (event.clientX - dragStartX);
    panY = panStartY + (event.clientY - dragStartY);
    applyTransform();
  };
  const onWindowMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    stageRef?.classList.remove('is-dragging');
  };
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);

  const cleanupAll = () => {
    stopSlideshow();
    dragging = false;
    window.removeEventListener('mousemove', onWindowMouseMove);
    window.removeEventListener('mouseup', onWindowMouseUp);
  };

  const draw = () => {
    const previous = button('이전 사진', () => goDelta(-1, '.viewer-controls button:first-child'), 'button quiet');
    const next = button('다음 사진', () => goDelta(1, '.viewer-controls button:last-child'), 'button quiet');
    const playBtn = photos.length > 1 ? button(slideshowTimer ? '⏸ 일시정지' : '▶ 슬라이드쇼', toggleSlideshow, 'button quiet slideshow-toggle') : null;
    if (playBtn) playBtn.setAttribute('aria-pressed', String(Boolean(slideshowTimer)));
    previous.disabled = next.disabled = photos.length < 2;

    const zoomOutBtn = button('−', () => setZoom(scale - 0.5), 'button quiet photo-zoom-btn');
    zoomOutBtn.setAttribute('aria-label', '사진 축소');
    const zoomLabel = button(`${Math.round(scale * 100)}%`, () => setZoom(scale > 1.1 ? 1 : 2), 'button quiet photo-zoom-reset');
    zoomLabel.setAttribute('aria-label', '사진 확대 배율 초기화 또는 2배 확대');
    const zoomInBtn = button('+', () => setZoom(scale + 0.5), 'button quiet photo-zoom-btn');
    zoomInBtn.setAttribute('aria-label', '사진 확대');
    zoomOutBtnRef = zoomOutBtn;
    zoomLabelRef = zoomLabel;
    zoomInBtnRef = zoomInBtn;

    const imgEl = image(photos[index], `${title} 사진 ${index + 1}`, { loading: 'eager', class: 'photo-stage-img', draggable: 'false' });
    imgEl.addEventListener('dblclick', () => setZoom(scale > 1.1 ? 1 : 2.2));
    imgRef = imgEl;

    const stage = E('div', { class: 'photo-stage' },
      imgEl,
      E('span', { class: 'photo-stage-counter', 'aria-hidden': 'true' }, `${index + 1} / ${photos.length}`),
      E('div', { class: 'photo-zoom-toolbar', role: 'group', 'aria-label': '사진 확대·축소' }, zoomOutBtn, zoomLabel, zoomInBtn));
    stageRef = stage;

    const thumbs = photos.length > 1 ? E('div', { class: 'viewer-thumbs', 'aria-label': '전체 사진 목록' }, photos.map((src, idx) => E('button', {
      type: 'button',
      class: 'viewer-thumb',
      'aria-label': `${idx + 1}번 사진 보기`,
      'aria-current': String(idx === index),
      onclick: () => {
        index = idx;
        resetZoom();
        draw();
        body.querySelectorAll('.viewer-thumb')[idx]?.focus();
      }
    }, image(src, `${title} 썸네일 ${idx + 1}`)))) : null;

    const hint = E('p', { class: 'small muted photo-swipe-hint' },
      photos.length > 1
        ? '← 좌우 스와이프·방향키로 넘기기 · 휠/더블클릭/두 손가락 확대(드래그 이동) · 아래로 밀어 닫기 →'
        : '마우스 휠·더블클릭·두 손가락 또는 +/− 버튼으로 확대하고 드래그해 살펴볼 수 있어요.');

    body.replaceChildren(...[
      stage,
      E('div', { class: 'viewer-controls' }, previous, E('span', { 'aria-live': 'polite' }, `${index + 1} / ${photos.length}`), playBtn, next),
      hint,
      thumbs
    ].filter(Boolean));
    applyTransform();
  };

  draw();

  const navigate = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (photos.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      goDelta(event.key === 'ArrowLeft' ? -1 : 1, event.key === 'ArrowLeft' ? '.viewer-controls button:first-child' : '.viewer-controls button:last-child');
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(scale + 0.5);
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom(scale - 0.5);
    } else if (event.key === '0') {
      event.preventDefault();
      setZoom(1);
    }
  };

  if (ctx.showDialog(title, body)) {
    return { navigate, cleanup: cleanupAll };
  }
  cleanupAll();
  return null;
}
