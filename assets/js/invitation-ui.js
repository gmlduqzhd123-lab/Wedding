import { formatDate, weddingDday, invitationCountdownInfo, extractPhoneNumber, extractAccountNumber, parseAccountLine, safeUrl } from './content.js?v=wedding-features-63';
import { invitationCalendar, googleCalendarUrl } from './calendar.js?v=wedding-features-63';
import { E, S, button, linkButton, externalLink, image, downloadText } from './dom.js?v=wedding-features-63';
import { renderInvitationBgmControls } from './bgm.js?v=wedding-features-63';
import {
  formatKoreanTimeLabel,
  buildInvitationShareMessages,
  renderInvitationCornerMarks,
  renderInvitationDivider,
  renderBotanicalLeaf,
  renderInvitationHeroVisual,
  renderInvitationCalendar,
  downloadInvitationCardPng,
  triggerBlobDownload,
  isKakaoInApp
} from './invitation-card.js?v=wedding-features-63';

function renderInvitationParents(info) {
  const gp = (info.groomParents || '').trim();
  const bp = (info.brideParents || '').trim();
  if (!gp && !bp) return null;
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  return E('div', { class: 'invitation-parents' },
    gp ? E('p', { class: 'parent-line' }, E('span', { class: 'parent-prefix' }, gp), p1 ? E('strong', { class: 'parent-child' }, p1) : null) : null,
    bp ? E('p', { class: 'parent-line' }, E('span', { class: 'parent-prefix' }, bp), p2 ? E('strong', { class: 'parent-child' }, p2) : null) : null);
}

function renderInvitationCountdown(info) {
  const cd = invitationCountdownInfo(info.date);
  if (!cd) return null;
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  const subject = (p1 && p2) ? `${p1} ♥ ${p2}의 결혼식` : '우리의 결혼식';
  if (cd.status === 'today') return E('p', { class: 'invitation-countdown-note is-today' }, '오늘, ', E('strong', {}, subject), '이 열립니다.');
  if (cd.status === 'future') return E('p', { class: 'invitation-countdown-note' }, `${subject}이 `, E('strong', {}, `${cd.days}일`), ' 남았습니다.');
  return E('p', { class: 'invitation-countdown-note is-past' }, `${subject}으로부터 `, E('strong', {}, `${cd.days}일`), '이 지났습니다.');
}

function renderInvitationGallery(ctx) {
  const content = ctx.getContent();
  const allPhotos = (content.albums || []).flatMap(album => (album.images || []).map(src => ({ src, title: album.title || '웨딩 사진' })));
  if (!allPhotos.length) return null;
  const preview = allPhotos.slice(0, 9);
  const allSrcs = allPhotos.map(item => item.src);
  return E('div', { class: 'invitation-section is-gallery reveal-section', id: 'inv-sec-gallery' },
    E('div', { class: 'invitation-sec-head' },
      E('span', { class: 'invitation-sec-en' }, 'GALLERY'),
      E('span', { class: 'invitation-sec-ko' }, '우리의 순간')),
    E('div', { class: 'invitation-gallery-grid' }, preview.map((item, idx) => E('button', {
      type: 'button',
      class: 'invitation-gallery-tile',
      'aria-label': `${item.title} 사진 ${idx + 1} 확대 보기`,
      onclick: () => ctx.openPhotos('우리의 웨딩 갤러리', allSrcs, idx)
    }, image(item.src, `${item.title} ${idx + 1}`, { class: 'invitation-gallery-img', decoding: 'async' })))),
    E('div', { class: 'invitation-gallery-foot' },
      linkButton(`전체 포토 앨범 보기 (${allPhotos.length}장) →`, '#/albums', true)));
}

function renderAccountGroup(ctx, title, rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return null;
  return E('details', { class: 'disclosure invitation-account-group' },
    E('summary', {}, title),
    E('ul', { class: 'invitation-contacts-list invitation-account-cards' }, lines.map(line => {
      const parsed = parseAccountLine(line);
      const hasParsedAcct = Boolean(parsed.account);
      const copyTarget = hasParsedAcct ? parsed.account : line;
      const copyNotice = hasParsedAcct
        ? `${parsed.bank ? `${parsed.bank} ` : ''}계좌번호(${parsed.account})를 복사했습니다.`
        : '계좌 안내를 복사했습니다.';
      const infoBlock = hasParsedAcct
        ? E('div', { class: 'account-card-meta' },
          E('div', { class: 'account-card-head' },
            parsed.bank ? E('span', { class: 'account-bank-badge' }, parsed.bank) : null,
            parsed.holder ? E('strong', { class: 'account-holder-name' }, parsed.holder) : null),
          E('span', { class: 'account-number-code' }, parsed.account))
        : E('span', { class: 'contact-row-text' }, line);
      return E('li', { class: 'invitation-contact-row invitation-account-card' },
        infoBlock,
        E('div', { class: 'contact-row-actions' },
          button(hasParsedAcct ? '계좌 복사' : '복사', () => ctx.copyTextToClipboard(copyTarget, copyNotice, '계좌번호 복사'), 'button quiet small-copy-btn'),
          hasParsedAcct && (parsed.bank || parsed.holder)
            ? button('전체 복사', () => ctx.copyTextToClipboard(line, '은행·예금주·계좌 안내를 복사했습니다.', '계좌 전체 복사'), 'button quiet small-copy-btn')
            : null));
    })));
}

function renderInvitationContacts(ctx, info) {
  const contactLines = (info.contacts || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const hasAccounts = Boolean((info.groomAccounts || '').trim() || (info.brideAccounts || '').trim());
  const nodes = [];
  if (contactLines.length) {
    const hasAccountInContacts = contactLines.some(line => Boolean(extractAccountNumber(line)));
    const summaryLabel = (!hasAccounts && hasAccountInContacts) ? '💌 연락처 · 마음 전하실 곳 안내 보기' : '📞 연락처 안내 보기';
    nodes.push(E('details', { class: 'disclosure invitation-contacts-box reveal-section', id: 'inv-sec-contacts' },
      E('summary', {}, summaryLabel),
      E('ul', { class: 'invitation-contacts-list' }, contactLines.map(line => {
        const phone = extractPhoneNumber(line);
        const acct = extractAccountNumber(line);
        const actions = [];
        if (phone) {
          actions.push(E('a', { href: `tel:${phone.digits}`, class: 'button quiet small-copy-btn', 'aria-label': `${line} 전화 걸기` }, '📞 전화'));
          if (phone.isMobile) actions.push(E('a', { href: `sms:${phone.digits}`, class: 'button quiet small-copy-btn', 'aria-label': `${line} 문자 보내기` }, '💬 문자'));
          actions.push(button('복사', () => ctx.copyTextToClipboard(phone.display, `전화번호(${phone.display})를 복사했습니다.`, '전화번호 복사'), 'button quiet small-copy-btn'));
        } else if (acct) {
          actions.push(button('계좌 복사', () => ctx.copyTextToClipboard(acct.display, `계좌번호(${acct.display})를 복사했습니다.`, '계좌번호 복사'), 'button quiet small-copy-btn'));
        } else {
          actions.push(button('복사', () => ctx.copyVenueAddress(line, '안내 정보'), 'button quiet small-copy-btn'));
        }
        return E('li', { class: 'invitation-contact-row' },
          E('span', { class: 'contact-row-text' }, line),
          E('div', { class: 'contact-row-actions' }, ...actions));
      }))));
  }
  if (hasAccounts) {
    nodes.push(E('div', { class: 'invitation-section is-accounts reveal-section', id: 'inv-sec-accounts' },
      E('div', { class: 'invitation-sec-head' },
        E('span', { class: 'invitation-sec-en' }, 'ACCOUNT'),
        E('span', { class: 'invitation-sec-ko' }, '마음 전하실 곳')),
      E('p', { class: 'small muted invitation-accounts-sub' }, '참석이 어려우신 분들을 위해 마음 전하실 곳을 조심스레 남깁니다.'),
      E('div', { class: 'invitation-account-groups' },
        renderAccountGroup(ctx, '🌿 신랑 측 계좌번호 보기', info.groomAccounts),
        renderAccountGroup(ctx, '🌸 신부 측 계좌번호 보기', info.brideAccounts))));
  }
  return nodes.length ? nodes : null;
}

function renderInvitationRsvp(info) {
  const url = (info.rsvpUrl || '').trim();
  if (!url) return null;
  return E('div', { class: 'invitation-rsvp-card reveal-section', id: 'inv-sec-rsvp' },
    E('div', { class: 'invitation-sec-head' },
      E('span', { class: 'invitation-sec-en' }, 'RSVP'),
      E('span', { class: 'invitation-sec-ko' }, '참석 여부 · 축하 메시지')),
    E('p', { class: 'small muted' }, '귀한 걸음의 참석 여부나 따뜻한 축하 메시지를 남겨 주시면 정성껏 준비하겠습니다.'),
    E('div', { class: 'invitation-actions' }, externalLink('💌 참석 여부 · 축하 메시지 남기기 ↗', url, 'button')));
}

function downloadInvitationIcs(ctx) {
  try {
    const ics = invitationCalendar(ctx.getContent().invitation);
    downloadText(ics, 'wedding-invitation.ics', 'text/calendar;charset=utf-8');
    ctx.toast(isKakaoInApp() ? '예식 일정 파일(.ics) 다운로드를 요청했습니다. 카카오톡 내부 브라우저에서 저장이 안 되면 ‘Google 캘린더에 추가’를 이용해 주세요.' : '예식 일정 파일(.ics)을 다운로드했습니다.');
  } catch (error) { ctx.toast(error.message, true); }
}

export function buildGuestInvitationSummaryText(info = {}, publicUrl = '') {
  const p1 = (info.partner1 || '').replace(/^신랑\s*/, '').trim();
  const p2 = (info.partner2 || '').replace(/^신부\s*/, '').trim();
  const couple = (p1 && p2) ? `${p1} ♥ ${p2}` : (p1 || p2 || '우리의 결혼식');
  return [
    `💌 [${couple} 결혼식 안내]`,
    info.date ? `• 일시: ${formatDate(info.date)}${info.time ? ` ${formatKoreanTimeLabel(info.time)}` : ''}` : '',
    info.venue ? `• 장소: ${info.venue}` : '',
    info.address ? `• 주소: ${info.address}` : '',
    publicUrl ? `• 모바일 청첩장: ${publicUrl}` : ''
  ].filter(Boolean).join('\n');
}

function openInvitationCardPreviewModal(ctx, { blob, dataUrl, filename, title = '🖼️ 모바일 청첩장 이미지 저장', alt = '모바일 청첩장 카드 이미지', shareTitle = '모바일 청첩장 이미지' }) {
  const shareImgBtn = ctx.canShareBackupFiles() ? button('📤 이미지 공유', async () => {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) {
        triggerBlobDownload(blob, filename);
        ctx.toast(`이미지(${filename})를 저장했습니다.`);
        return;
      }
      await navigator.share({ files: [file], title: shareTitle });
    } catch (err) {
      if (err?.name !== 'AbortError') ctx.toast('공유 창을 열지 못했습니다. 위 이미지를 길게 눌러 사진 저장을 이용해 주세요.', true);
    }
  }, 'button quiet') : null;
  const body = E('div', { class: 'card-preview-modal' },
    E('p', { class: 'small muted' }, '📱 스마트폰(카카오톡·아이폰 사파리 포함)에서는 아래 이미지를 길게 눌러 ‘사진 저장’을 선택하시면 가장 확실하게 저장됩니다.'),
    E('img', { src: dataUrl, alt, class: 'card-preview-img' }),
    E('div', { class: 'page-actions card-preview-actions' },
      button('📥 파일로 바로 저장', () => {
        triggerBlobDownload(blob, filename);
        ctx.toast(`이미지(${filename})를 저장했습니다.`);
      }, 'button'),
      shareImgBtn));
  ctx.showDialog(title, body);
}

async function openInvitationQrModal(ctx) {
  let renderQrSvgString;
  try {
    ({ renderQrSvgString } = await ctx.loadModule('qrcode'));
  } catch (error) {
    ctx.toast(error.message || 'QR 생성 모듈을 불러오지 못했습니다.', true);
    return;
  }
  const content = ctx.getContent();
  const url = new URL('./?view=guest#/invitation', location.href).href;
  const info = content.invitation || {};
  const names = [info.partner1, info.partner2].filter(Boolean).join(' & ') || '우리의 모바일 청첩장';
  const svgMarkup = renderQrSvgString(url, { margin: 4, label: `${names} 모바일 청첩장 QR 코드` });
  const qrWrap = E('div', { class: 'qr-preview-box' });
  qrWrap.innerHTML = svgMarkup;
  const exportQrPng = (preferPreview = false) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 720;
      const ctx2d = canvas.getContext('2d');
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillRect(0, 0, 720, 720);
      ctx2d.drawImage(img, 0, 0, 720, 720);
      URL.revokeObjectURL(blobUrl);
      const dataUrl = canvas.toDataURL('image/png');
      canvas.toBlob(pngBlob => {
        if (!pngBlob) return;
        if (preferPreview || isKakaoInApp()) {
          openInvitationCardPreviewModal(ctx, {
            blob: pngBlob,
            dataUrl,
            filename: 'wedding-invitation-qr.png',
            title: '📱 모바일 청첩장 QR 이미지 저장',
            alt: `${names} 모바일 청첩장 QR 코드 이미지`,
            shareTitle: `${names} 모바일 청첩장 QR`
          });
          return;
        }
        triggerBlobDownload(pngBlob, 'wedding-invitation-qr.png');
        ctx.toast('모바일 청첩장 QR 이미지(PNG)를 저장했습니다.');
      }, 'image/png');
    };
    img.src = blobUrl;
  };
  const downloadSvgBtn = button('📥 QR 코드(SVG) 저장', () => {
    downloadText(svgMarkup, 'wedding-invitation-qr.svg', 'image/svg+xml;charset=utf-8');
    ctx.toast('모바일 청첩장 QR 코드(SVG)를 저장했습니다.');
  }, 'button quiet');
  const downloadPngBtn = button('🖼️ QR 이미지(PNG) 저장', () => exportQrPng(false), 'button');
  const previewPngBtn = button('📱 QR 미리보기·사진저장', () => exportQrPng(true), 'button quiet');
  const onPreview = payload => openInvitationCardPreviewModal(ctx, payload);
  const body = E('div', { class: 'qr-modal-body' },
    E('p', { class: 'small muted' }, '스마트폰 카메라로 스캔하면 방문자용 모바일 청첩장 화면(?view=guest#/invitation)이 바로 열립니다. 종이 청첩장 인쇄나 메신저 안내 이미지로 활용할 수 있습니다.'),
    qrWrap,
    E('p', { class: 'small qr-url-text' }, url),
    E('div', { class: 'page-actions qr-modal-actions' },
      downloadPngBtn,
      previewPngBtn,
      downloadSvgBtn,
      button('🖼️ QR 포함 청첩장 카드(PNG)', () => downloadInvitationCardPng(content.invitation, content.albums, ctx.toast, { includeQr: true, shareUrl: url, onPreview }), 'button quiet'),
      button('🖼️ 청첩장 카드(PNG) 미리보기·저장', () => downloadInvitationCardPng(content.invitation, content.albums, ctx.toast, { preferModal: true, onPreview }), 'button quiet'),
      button('💌 청첩장 공유하기', ctx.shareInvitationLink, 'button quiet'),
      button('🔗 링크 복사', ctx.copyInvitationLink, 'button quiet')));
  ctx.showDialog('📱 모바일 청첩장 QR · 공유', body);
}

function openInvitationMessageModal(ctx) {
  const info = ctx.getContent().invitation || {};
  const publicUrl = new URL('./?view=guest#/invitation', location.href).href;
  const presets = buildInvitationShareMessages(info, publicUrl);
  let activeId = presets[0].id;
  const audienceEl = E('p', { class: 'small muted share-msg-audience' }, presets[0].audience);
  const ta = E('textarea', { rows: '11', class: 'share-msg-textarea', 'aria-label': '상황별 초대 문구 편집' }, presets[0].text);
  const tabsWrap = E('div', { class: 'trip-quick-filters share-msg-tabs', role: 'group', 'aria-label': '초대 문구 상황 선택' });
  const selectPreset = preset => {
    activeId = preset.id;
    audienceEl.textContent = preset.audience;
    ta.value = preset.text;
    for (const btn of tabsWrap.querySelectorAll('button')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.presetId === activeId));
    }
  };
  for (const preset of presets) {
    const btn = E('button', {
      type: 'button',
      class: 'button quiet trip-filter-chip',
      'data-preset-id': preset.id,
      'aria-pressed': String(preset.id === activeId),
      onclick: () => selectPreset(preset)
    }, preset.label);
    tabsWrap.append(btn);
  }
  const names = [info.partner1, info.partner2].filter(Boolean).join(' & ');
  const shareTitle = names ? `${names} · 모바일 청첩장` : '우리의 모바일 청첩장';
  const shareBtn = navigator.share ? button('💌 바로 공유', async () => {
    try { await navigator.share({ title: shareTitle, text: ta.value }); }
    catch (err) { if (err?.name !== 'AbortError') ctx.toast('공유 창을 열지 못했습니다. 복사 버튼을 이용해 주세요.', true); }
  }, 'button quiet') : null;
  const body = E('div', { class: 'share-msg-modal' },
    E('p', { class: 'small muted' }, '받는 분에 맞는 인사말을 선택하고 필요하면 자유롭게 수정한 뒤 복사해 카카오톡·문자로 바로 보내실 수 있어요.'),
    tabsWrap,
    audienceEl,
    ta,
    E('div', { class: 'page-actions share-msg-actions' },
      button('📋 문구 + 링크 복사', () => ctx.copyTextToClipboard(ta.value, '초대 문구와 모바일 청첩장 링크를 복사했습니다.', '초대 문구 복사'), 'button'),
      shareBtn,
      button('기본 문구로 되돌리기', () => {
        const found = presets.find(p => p.id === activeId);
        if (found) { ta.value = found.text; ctx.toast('선택한 기본 문구로 되돌렸습니다.'); }
      }, 'button quiet')));
  ctx.showDialog('💬 상황별 초대 문구 복사', body);
}

function renderInvitationReadiness(ctx, info) {
  if (ctx.isGuestMode()) return null;
  const content = ctx.getContent();
  const checks = [
    ['couple', Boolean(info.partner1?.trim() && info.partner2?.trim()), '신랑·신부 이름', 'invitation'],
    ['schedule', Boolean(info.date && info.time && info.venue?.trim()), '예식 일시·장소', 'invitation'],
    ['message', Boolean(info.message?.trim()), '초대 인사말', 'invitation'],
    ['parents', Boolean(info.groomParents?.trim() || info.brideParents?.trim()), '혼주 표기', 'invitation'],
    ['transit', Boolean(info.transit?.trim() || info.notice?.trim()), '교통·식사 안내', 'invitation'],
    ['accounts', Boolean(info.contacts?.trim() || info.groomAccounts?.trim() || info.brideAccounts?.trim()), '연락처·계좌', 'invitation'],
    ['rsvp', Boolean(info.rsvpUrl?.trim()), 'RSVP 설문 링크', 'invitation'],
    ['albums', Boolean(content.albums?.length), '웨딩 포토 앨범', 'albums']
  ];
  const doneCount = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  return E('details', { class: 'invitation-readiness-card', 'aria-label': '공개 청첩장 발행 준비도 점검' },
    E('summary', { class: 'readiness-summary' },
      E('span', { class: 'readiness-summary-title' }, `✨ 청첩장 발행 준비도 (${doneCount}/${checks.length})`),
      E('span', { class: 'readiness-mini-bar', 'aria-hidden': 'true' }, E('span', { class: 'readiness-mini-fill', style: `width:${pct}%` })),
      E('span', { class: 'small muted readiness-summary-hint' }, doneCount === checks.length ? '발행 준비 완료' : '눌러서 항목 채우기')),
    E('div', { class: 'readiness-body' },
      E('p', { class: 'small muted' }, '하객 화면(?view=guest)에는 비어 있는 항목이 자동으로 숨겨집니다. 항목을 눌러 바로 채우고, 대표 사진 등록 후 npm run share-card로 카카오톡 공유 이미지를 갱신하세요.'),
      E('div', { class: 'readiness-chips' }, checks.map(([, ok, label, target]) => E('button', {
        type: 'button',
        class: 'spec-chip readiness-chip' + (ok ? ' direct' : ' highlight'),
        onclick: () => (target === 'albums' ? (location.hash = '#/albums') : ctx.openEditor('invitation'))
      }, `${ok ? '✓' : '+'} ${label}`)))));
}

function renderGuestQuickDock(ctx, info, hasGallery) {
  if (!ctx.isGuestMode()) return null;
  const jumpTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const makeJumpBtn = (label, targetId) => E('button', {
    type: 'button',
    class: 'guest-dock-btn',
    'data-dock-target': targetId,
    onclick: () => jumpTo(targetId)
  }, label);
  const largeTextMode = ctx.isLargeTextMode();
  const hasAccounts = Boolean((info.groomAccounts || '').trim() || (info.brideAccounts || '').trim());
  const hasContacts = Boolean((info.contacts || '').trim());
  const thirdAction = hasAccounts
    ? makeJumpBtn('💌 마음 전하기', 'inv-sec-accounts')
    : hasContacts
      ? makeJumpBtn('📞 연락처', 'inv-sec-contacts')
      : hasGallery
        ? makeJumpBtn('🖼️ 갤러리', 'inv-sec-gallery')
        : E('button', {
          type: 'button',
          class: 'guest-dock-btn guest-dock-text-btn' + (largeTextMode ? ' is-active' : ''),
          'aria-pressed': String(largeTextMode),
          'aria-label': '청첩장 글씨 크기 전환',
          onclick: ctx.toggleLargeTextMode
        }, largeTextMode ? '가- 보통' : '🔍 크게');
  return E('nav', { class: 'guest-quick-dock', 'aria-label': '모바일 청첩장 빠른 이동' },
    makeJumpBtn('📅 일정', 'inv-sec-schedule'),
    makeJumpBtn('📍 오시는 길', 'inv-sec-location'),
    thirdAction,
    button('🔗 공유', ctx.shareInvitationLink, 'guest-dock-btn is-primary'));
}

export function renderInvitationView(ctx) {
  const guestMode = ctx.isGuestMode();
  const content = ctx.getContent();
  const info = content.invitation;
  const dday = weddingDday(info.date);
  const hasContent = Object.values(info).some(Boolean);
  const mapLink = externalLink('오시는 길 (네이버 지도) ↗', info.mapUrl, 'button');
  const searchKeyword = (info.venue || info.address || '').replace(/\s+\d+층$/, '').trim();
  const kakaoSearchUrl = searchKeyword ? `https://map.kakao.com/link/search/${encodeURIComponent(searchKeyword)}` : '';
  const kakaoLink = kakaoSearchUrl ? externalLink('카카오맵 ↗', kakaoSearchUrl, 'button quiet') : null;
  const googleMapLink = searchKeyword ? externalLink('구글 지도 ↗', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchKeyword)}`, 'button quiet') : null;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const tmapBtn = (searchKeyword && (isAndroid || isIos)) ? button('티맵 앱 ↗', () => {
    const q = encodeURIComponent(searchKeyword);
    if (isAndroid) {
      location.href = `intent://search?name=${q}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(kakaoSearchUrl)};end`;
    } else {
      ctx.toast('티맵 앱이 설치된 기기에서 열립니다. 미설치 시 네이버·카카오 지도를 이용해 주세요.');
      location.href = `tmap://search?name=${q}`;
    }
  }, 'button quiet') : null;
  const copyAddrBtn = (info.address || info.venue) ? button('주소 복사', () => ctx.copyVenueAddress(info.address || info.venue), 'button quiet') : null;
  let gcalBtn = null, icsBtn = null;
  try {
    const gcalHref = googleCalendarUrl(info);
    gcalBtn = E('a', { href: gcalHref, class: 'button quiet', target: '_blank', rel: 'noopener noreferrer' }, 'Google 캘린더에 추가');
    icsBtn = button('일정 파일(.ics) 다운로드', () => downloadInvitationIcs(ctx), 'button quiet');
  } catch {}
  const mapActions = [mapLink, kakaoLink, tmapBtn, googleMapLink, copyAddrBtn].filter(Boolean);
  const calActions = [gcalBtn, icsBtn].filter(Boolean);
  const shortMonthDay = info.date ? formatDate(info.date).replace(/^\d+년\s*/, '') : '일정 미정';
  const gallerySection = renderInvitationGallery(ctx);
  const contactNodes = renderInvitationContacts(ctx, info);
  const rsvpNode = renderInvitationRsvp(info);
  const venueMapSrc = safeUrl(info.venueMapImage, { image: true });
  const venueMapNode = venueMapSrc ? E('div', { class: 'invitation-venue-map' },
    E('button', { type: 'button', class: 'invitation-venue-map-btn', 'aria-label': '예식장 약도 크게 보기', onclick: () => ctx.openPhotos(`${info.venue || '예식장'} 오시는 길 약도`, [venueMapSrc], 0) },
      image(venueMapSrc, `${info.venue || '예식장'} 오시는 길 약도`, { class: 'invitation-venue-map-img' }),
      E('span', { class: 'map-preview-caption' }, '🗺️ 예식장 약도 크게 보기'))) : null;
  const headerActions = guestMode ? null : E('div', { class: 'page-actions' },
    ctx.editButton('예식 정보 편집', () => ctx.openEditor('invitation')),
    button('👀 하객 미리보기', () => ctx.toggleGuestPreview(true), 'button quiet'),
    button('💬 초대 문구', () => openInvitationMessageModal(ctx), 'button quiet'),
    button('📱 QR · 공유', () => openInvitationQrModal(ctx), 'button quiet'));
  const topHeader = guestMode && hasContent
    ? null
    : ctx.pageHeader('소중한 분들을 초대합니다.', guestMode ? '두 사람의 새로운 시작을 함께 축복해 주세요.' : '우리의 마음과 예식 안내를 한 장에 담아요.', headerActions, 'THE INVITATION');
  const onPreview = payload => openInvitationCardPreviewModal(ctx, payload);
  return [topHeader,
    renderInvitationReadiness(ctx, info),
    hasContent ? E('section', { class: 'invitation' },
      ctx.renderInvitationPetalsLayer(),
      renderInvitationCornerMarks(),
      E('div', { class: 'invitation-topbar' },
        E('span', { class: 'invitation-ribbon' }, info.date ? `WEDDING INVITATION · ${info.date.replaceAll('-', '. ')}` : 'WE ARE GETTING MARRIED'),
        E('div', { class: 'invitation-topbar-tools' },
          ctx.renderPetalsButton(),
          ctx.renderLargeTextButton(),
          renderInvitationBgmControls(ctx.toast))),
      E('div', { class: 'invitation-title' }, '우리 두 사람, 결혼합니다'),
      E('p', { class: 'invitation-sub' }, 'With love, together'),
      renderInvitationHeroVisual(info, content.albums, ctx.openPhotos),
      (info.partner1 || info.partner2 || info.groomParents || info.brideParents) ? E('div', { class: 'invitation-couple-plaque' },
        (info.partner1 || info.partner2) ? E('h2', { class: 'couple-names' },
          info.partner1 ? [E('small', { class: 'role-label is-groom' }, '신랑 '), info.partner1.replace(/^신랑\s*/, '')] : null,
          info.partner1 && info.partner2 ? E('span', { class: 'couple-heart' }, '♥') : null,
          info.partner2 ? [E('small', { class: 'role-label is-bride' }, '신부 '), info.partner2.replace(/^신부\s*/, '')] : null) : null,
        renderInvitationParents(info)) : null,
      info.message ? E('p', { class: 'message' }, info.message) : null,
      renderInvitationDivider(),
      E('div', { class: 'invitation-section is-schedule reveal-section', id: 'inv-sec-schedule' },
        E('div', { class: 'invitation-sec-head' },
          E('span', { class: 'invitation-sec-en' }, 'SAVE THE DATE'),
          E('span', { class: 'invitation-sec-ko' }, '예식 일시')),
        E('p', { class: 'invitation-date' }, info.date ? formatDate(info.date) : '예식 일정 준비 중', info.time ? ` · ${info.time}` : '', dday ? [' ', E('span', { class: 'dday-badge' }, dday)] : null),
        renderInvitationCalendar(info.date, info.time),
        (info.date || info.time) ? E('div', { class: 'invitation-milestone-strip' },
          E('div', { class: 'milestone-cell' },
            E('span', { class: 'milestone-label' }, 'DATE'),
            E('strong', { class: 'milestone-val' }, shortMonthDay)),
          E('div', { class: 'milestone-cell' },
            E('span', { class: 'milestone-label' }, 'TIME'),
            E('strong', { class: 'milestone-val' }, info.time ? formatKoreanTimeLabel(info.time) : '시간 미정')),
          E('div', { class: 'milestone-cell is-highlight' },
            E('span', { class: 'milestone-label' }, 'D-DAY'),
            E('strong', { class: 'milestone-val' }, dday || '예식일'))) : null,
        info.date ? E('div', { class: 'invitation-live-countdown', 'aria-label': '예식까지 남은 시간 카운트다운' }) : null,
        renderInvitationCountdown(info),
        calActions.length ? E('div', { class: 'invitation-actions invitation-cal-actions' }, ...calActions) : null,
        calActions.length && isKakaoInApp() ? E('p', { class: 'small inapp-browser-note' }, '💡 카카오톡 내부 브라우저에서는 .ics 파일 저장이 제한될 수 있어요. ‘Google 캘린더에 추가’를 이용하거나 우측 하단 메뉴에서 외부 브라우저로 열어 주세요.') : null,
        calActions.length ? E('p', { class: 'small muted calendar-update-note' }, '캘린더에 저장한 일정은 예식 정보가 바뀌어도 자동 수정하지 않습니다. 변경 시 기존 일정을 삭제하거나 직접 수정해 주세요.') : null),
      gallerySection ? [renderInvitationDivider(), gallerySection] : null,
      renderInvitationDivider(),
      E('div', { class: 'invitation-section is-location reveal-section', id: 'inv-sec-location' },
        E('div', { class: 'invitation-sec-head' },
          E('span', { class: 'invitation-sec-en' }, 'LOCATION'),
          E('span', { class: 'invitation-sec-ko' }, '오시는 길')),
        E('div', { class: 'place' },
          E('span', { class: 'place-kicker' }, '📍 WEDDING VENUE'),
          E('strong', {}, info.venue || '예식 장소 준비 중'),
          info.address ? E('p', {}, info.address) : null),
        venueMapNode,
        mapActions.length ? E('div', { class: 'invitation-actions invitation-map-actions' }, ...mapActions) : null),
      (info.transit || info.notice) ? E('div', { class: 'invitation-extra-guides reveal-section' },
        info.transit ? E('div', { class: 'invitation-guide-box' }, E('strong', {}, '🚗 오시는 길 · 교통 및 주차 안내'), E('p', { class: 'record-body' }, info.transit)) : null,
        info.notice ? E('div', { class: 'invitation-guide-box' }, E('strong', {}, '📌 예식 안내'), E('p', { class: 'record-body' }, info.notice)) : null) : null,
      contactNodes,
      rsvpNode,
      E('div', { class: 'invitation-closing reveal-section' },
        S('svg', { class: 'invitation-closing-sprig', viewBox: '0 0 84 22', 'aria-hidden': 'true' },
          S('path', { d: 'M 16 14 C 28 11, 56 11, 68 14', fill: 'none', stroke: '#8ba792', 'stroke-width': '1.1', 'stroke-linecap': 'round' }),
          renderBotanicalLeaf(28, 12, -62, 0.52, '#8daa94'),
          renderBotanicalLeaf(56, 12, 62, 0.52, '#8daa94'),
          S('circle', { cx: '42', cy: '11', r: '2.4', fill: '#c97a70' })),
        E('span', { class: 'invitation-closing-note' }, '귀한 걸음으로 축복해 주시는 모든 분께 진심으로 감사드립니다.'),
        E('div', { class: 'invitation-actions invitation-share-foot' },
          !guestMode ? button('💬 초대 문구', () => openInvitationMessageModal(ctx), 'button quiet') : null,
          button('📋 예식 요약 복사', () => ctx.copyTextToClipboard(
            buildGuestInvitationSummaryText(info, new URL('./?view=guest#/invitation', location.href).href),
            '예식 일시·장소·모바일 청첩장 링크 요약을 복사했습니다.',
            '예식 안내 요약 복사'
          ), 'button quiet'),
          button('💌 초대장 공유', ctx.shareInvitationLink, 'button quiet'),
          button('🔗 링크 복사', ctx.copyInvitationLink, 'button quiet'),
          button('🖼️ 이미지 저장', () => downloadInvitationCardPng(info, content.albums, ctx.toast, { onPreview }), 'button quiet'),
          button('🖨️ 청첩장 인쇄', () => window.print(), 'button quiet')))) :
      ctx.empty('우리의 첫 초대장을 준비해요.', '두 분의 이름, 예식 날짜와 장소를 입력하면 청첩장에 담깁니다.', '예식 정보 입력', () => ctx.openEditor('invitation')),
    hasContent ? renderGuestQuickDock(ctx, info, Boolean(gallerySection)) : null];
}
