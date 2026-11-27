import { E, button, externalLink } from './dom.js?v=wedding-features-73';
import { formatDate, extractPhoneNumber } from './content.js?v=wedding-features-73';
import { computeCashDenominations } from './planning.js?v=wedding-features-73';
import { DEFAULT_PHOTO_ORDER, readPhotoCallChecked, writePhotoCallChecked } from './wedding-day-ui.js?v=wedding-features-73';
import { CEREMONY_BGM_SLOTS, buildBgmCueSheetText } from './ceremony-ui.js?v=wedding-features-73';

const DEFAULT_PHOTO_LINES = DEFAULT_PHOTO_ORDER.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

export function createWakeLockController(onChange = null) {
  let sentinel = null;
  let wanted = false;
  const supported = Boolean(typeof navigator !== 'undefined' && navigator.wakeLock?.request);

  const notify = () => {
    if (typeof onChange === 'function') onChange();
  };

  const acquire = async (silent = false, toast = null) => {
    if (!supported) {
      if (!silent) toast?.('이 브라우저는 화면 자동 꺼짐 방지(Wake Lock)를 지원하지 않습니다.', true);
      return false;
    }
    try {
      const next = await navigator.wakeLock.request('screen');
      sentinel = next;
      wanted = true;
      next.addEventListener('release', () => {
        if (sentinel === next) sentinel = null;
        notify();
      });
      if (!silent) toast?.('현장 브리핑 동안 화면이 꺼지지 않도록 유지합니다.');
      notify();
      return true;
    } catch {
      wanted = false;
      sentinel = null;
      if (!silent) toast?.('화면 켜짐 유지를 활성화하지 못했습니다.', true);
      notify();
      return false;
    }
  };

  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && wanted && !sentinel) {
      acquire(true);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  const release = () => {
    wanted = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    if (sentinel) {
      const prev = sentinel;
      sentinel = null;
      prev.release().catch(() => {});
    }
  };

  const toggle = async (toast = null) => {
    if (!supported) {
      toast?.('이 브라우저는 화면 자동 꺼짐 방지(Wake Lock)를 지원하지 않습니다.', true);
      return false;
    }
    if (sentinel || wanted) {
      wanted = false;
      if (sentinel) {
        const prev = sentinel;
        sentinel = null;
        await prev.release().catch(() => {});
      }
      toast?.('화면 켜짐 유지를 해제했습니다.');
      notify();
      return false;
    }
    return acquire(false, toast);
  };

  return { supported, isActive: () => Boolean(sentinel || wanted), toggle, release };
}

function renderWakeButton(wake, toast) {
  const active = wake.isActive();
  return E('button', {
    type: 'button',
    class: 'button quiet small-copy-btn live-cue-wake-btn' + (active ? ' is-active' : ''),
    'aria-pressed': String(active),
    onclick: () => wake.toggle(toast)
  }, active ? '☀️ 화면 켜짐 유지 중' : (wake.supported ? '☀️ 화면 켜짐 유지' : '화면 유지 미지원'));
}

export function openShootDayMode(ctx) {
  if (ctx.isGuestMode()) return;
  const studio = ctx.getStudiosState?.()?.activeLachma;
  const g = studio?.deepGuide;
  if (!g) {
    ctx.toast('라크마 스튜디오 상세 안내를 먼저 불러와 주세요.', true);
    return;
  }

  let fontZoom = 100;
  let shootTab = 'ops';
  const root = E('div', { class: 'field-ops-shell' });
  const wake = createWakeLockController(() => { if (root.isConnected) renderBody(); });

  const renderBody = () => {
    const prefs = ctx.getPrefs();
    const checked = new Set(prefs.shootChecklist || []);
    const brief = prefs.shootBrief || {};
    const outfits = brief.outfits || [];
    const visitLocs = (g.locations || []).filter(loc => !loc.isReference);
    const pendingItems = [];
    (g.prepChecklist || []).forEach((grp, gi) => {
      (grp.items || []).forEach((label, ii) => {
        const id = `shoot-${gi}-${ii}`;
        if (!checked.has(id)) pendingItems.push({ id, category: grp.category, label });
      });
    });

    const wakeBtn = renderWakeButton(wake, ctx.toast);

    const togglePrep = (id, box) => {
      const next = new Set(ctx.getPrefs().shootChecklist || []);
      if (box.checked) next.add(id); else next.delete(id);
      ctx.queuePreference(async () => {
        const ok = await ctx.savePrefs({ ...ctx.getPrefs(), shootChecklist: [...next] });
        if (ok) renderBody();
        return ok;
      });
    };

    const tabBar = E('div', { class: 'trip-quick-filters', role: 'group', 'aria-label': '촬영 현장 모드 보기 전환' },
      [
        ['ops', `🗺️ 동선 · 준비물 (${pendingItems.length})`],
        ['brief', `🎨 착장별 시안 카드 (${outfits.length})`]
      ].map(([key, label]) => E('button', {
        type: 'button',
        class: 'button quiet trip-filter-chip',
        'data-shoot-ops-tab': key,
        'aria-pressed': String(shootTab === key),
        onclick: () => { shootTab = key; renderBody(); }
      }, label)));

    const opsContent = [
      g.officialNotices?.cashBanner ? E('div', { class: 'lachma-cash-banner' }, g.officialNotices.cashBanner) : null,
      E('section', { class: 'field-ops-card' },
        E('h3', {}, '🗺️ 당일 방문 동선 (루나메이크업 → 라크마 스튜디오)'),
        E('div', { class: 'field-ops-loc-list' }, visitLocs.map(loc => E('div', { class: 'field-ops-loc-row' },
          E('div', {},
            E('strong', {}, `[${loc.step}] ${loc.name}`),
            E('p', { class: 'small' }, loc.address),
            loc.parking ? E('p', { class: 'small muted' }, `🚗 ${loc.parking}`) : null),
          E('div', { class: 'field-ops-row-actions' },
            externalLink('네이버 지도 ↗', loc.naverMapUrl, 'button quiet small-copy-btn'),
            externalLink('카카오맵 ↗', loc.kakaoMapUrl, 'button quiet small-copy-btn'),
            loc.address ? button('주소 복사', () => ctx.copyVenueAddress(loc.address, `${loc.name} 주소`), 'button quiet small-copy-btn') : null)))),
        g.officialInfo?.phone ? E('div', { class: 'page-actions' },
          E('a', { href: `tel:${g.officialInfo.phone.split('~')[0].replace(/[^\d+]/g, '')}`, class: 'button small-copy-btn' }, `📞 라크마 전화 ${g.officialInfo.phone}`)) : null),
      E('section', { class: 'field-ops-card' },
        E('h3', {}, `🎒 아직 안 챙긴 준비물 (${pendingItems.length}개 남음)`),
        pendingItems.length
          ? E('ul', { class: 'field-ops-checklist' }, pendingItems.map(item => {
            const box = E('input', { type: 'checkbox', id: `fops-${item.id}` });
            box.addEventListener('change', () => togglePrep(item.id, box));
            return E('li', {},
              E('label', { for: box.id, class: 'checklist-label' },
                box,
                E('span', {}, E('strong', { class: 'small muted' }, `[${item.category}] `), item.label)));
          }))
          : E('p', { class: 'small' }, '🎉 모든 촬영 준비물을 챙겼습니다! 여유롭게 출발하세요.')),
      E('section', { class: 'field-ops-card' },
        E('h3', {}, '⏰ 촬영 당일 타임테이블'),
        E('ol', { class: 'timetable-list lachma-timetable' }, (g.timetable || []).map(row => E('li', { class: 'timetable-row' + (row.time.includes('12:00') ? ' highlight' : '') },
          E('strong', { class: 'timetable-time' }, row.time),
          E('div', { class: 'timetable-detail' }, E('strong', {}, row.stage), E('p', { class: 'small muted' }, row.detail))))))
    ];

    const briefContent = [
      E('section', { class: 'field-ops-card' },
        E('h3', {}, '🎨 작가님 · 루나메이크업 공유용 촬영 시안'),
        (brief.moodNote || brief.avoidNote) ? E('div', { class: 'shoot-brief-notes-grid' },
          brief.moodNote ? E('div', { class: 'pros-box' }, E('strong', { class: 'pros-title' }, '✨ 원하는 분위기 · 필수 컷'), E('p', { class: 'small record-body' }, brief.moodNote)) : null,
          brief.avoidNote ? E('div', { class: 'cons-box' }, E('strong', { class: 'cons-title' }, '🚫 피하고 싶은 각도 · 요청'), E('p', { class: 'small record-body' }, brief.avoidNote)) : null) : null,
        outfits.length
          ? E('div', { class: 'field-ops-loc-list' }, outfits.map((o, idx) => E('div', { class: 'field-ops-loc-row' },
            E('div', {},
              E('strong', {}, `${idx + 1}. ${o.label}`),
              o.hair ? E('p', { class: 'small' }, `💇 헤어·메이크업: ${o.hair}`) : null,
              o.props ? E('p', { class: 'small' }, `💐 부케·소품: ${o.props}`) : null,
              o.poses ? E('p', { class: 'small' }, `📷 포즈·포인트: ${o.poses}`) : null))))
          : E('p', { class: 'small muted' }, '등록된 착장 시안이 아직 없습니다. 스튜디오 탭의 ‘촬영 시안 · 착장 보드’에서 드레스·헤어·소품을 미리 적어 두면 촬영 현장에서 바로 보여줄 수 있어요.'),
        E('div', { class: 'page-actions' },
          button('📸 스튜디오 시안 편집하러 가기 →', () => { ctx.closeDialog(); location.hash = '#/studios'; }, 'button quiet small-copy-btn')))
    ];

    root.style.fontSize = `${fontZoom}%`;
    root.replaceChildren(
      E('div', { class: 'field-ops-bar' },
        E('span', { class: 'spec-chip highlight' }, `🗓️ ${g.schedule?.label || '2027-02-03(수) 12:00'}`),
        E('div', { class: 'field-ops-controls' },
          wakeBtn,
          button('A−', () => { fontZoom = Math.max(90, fontZoom - 10); renderBody(); }, 'button quiet small-copy-btn'),
          button('A+', () => { fontZoom = Math.min(130, fontZoom + 10); renderBody(); }, 'button quiet small-copy-btn'))),
      tabBar,
      ...(shootTab === 'brief' ? briefContent : opsContent));
  };

  renderBody();
  if (ctx.showDialog('📸 라크마 촬영 당일 현장 브리핑 모드', root)) {
    const dlg = document.querySelector('#editor-dialog');
    dlg?.addEventListener('close', () => { wake.release(); ctx.render(); }, { once: true });
  } else {
    wake.release();
  }
}

export function openWeddingDayHub(ctx) {
  if (ctx.isGuestMode()) return;
  let activeTab = 'ops';
  const root = E('div', { class: 'field-ops-shell wedding-day-hub' });
  const wake = createWakeLockController(() => { if (root.isConnected) renderHub(); });

  const renderHub = () => {
    const content = ctx.getContent();
    const prefs = ctx.getPrefs();
    const inv = content.invitation || {};
    const roles = prefs.weddingDayRoles || [];
    const envelopes = prefs.weddingDayEnvelopes || [];
    const bgmMap = prefs.ceremonyBgm || {};
    const bgmReadyCount = CEREMONY_BGM_SLOTS.filter(([id]) => Boolean(bgmMap[id]?.ready)).length;
    const denom = computeCashDenominations(envelopes);
    const photoLines = (prefs.photoOrderNote || '').trim()
      ? prefs.photoOrderNote.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      : DEFAULT_PHOTO_LINES;
    const photoDone = readPhotoCallChecked();

    const wakeBtn = renderWakeButton(wake, ctx.toast);

    const tabs = [
      ['ops', '⚡ 현장 런처 · 연락'],
      ['envelopes', `✉️ 현금 봉투 (${envelopes.filter(e => e.ready).length}/${envelopes.length})`],
      ['photocall', `📸 원판 호명 (${photoLines.filter((_, i) => photoDone.has(String(i))).length}/${photoLines.length})`],
      ['bgm', `🎼 본식 BGM (${bgmReadyCount}/${CEREMONY_BGM_SLOTS.length})`]
    ];

    const tabBar = E('div', { class: 'trip-quick-filters field-ops-tabs', role: 'tablist', 'aria-label': '본식 현장 모드 전환' },
      tabs.map(([key, label]) => E('button', {
        type: 'button',
        role: 'tab',
        class: 'button quiet trip-filter-chip',
        'data-wedding-hub-tab': key,
        'aria-selected': String(activeTab === key),
        'aria-pressed': String(activeTab === key),
        onclick: () => { activeTab = key; renderHub(); }
      }, label)));

    let panel;
    if (activeTab === 'ops') {
      panel = E('div', { class: 'field-ops-panel' },
        E('div', { class: 'field-ops-launch-grid' },
          E('button', {
            type: 'button',
            class: 'field-ops-launch-btn',
            onclick: () => {
              wake.release();
              ctx.closeDialog();
              ctx.navigateToRoute('ceremony', 'rundown');
              setTimeout(() => {
                [...document.querySelectorAll('button')].find(b => b.textContent.includes('라이브 큐시트 모드'))?.click();
              }, 160);
            }
          }, E('strong', {}, '🎤 사회자 라이브 큐시트'), E('span', { class: 'small muted' }, '12단계 진행 대본 · BGM 큐 · 큰 글씨')),
          E('button', {
            type: 'button',
            class: 'field-ops-launch-btn',
            onclick: () => {
              wake.release();
              ctx.closeDialog();
              ctx.navigateToRoute('ceremony', 'gifts', 'quick-gift');
            }
          }, E('strong', {}, '⚡ 축의대 빠른 연속 입력'), E('span', { class: 'small muted' }, '1-tap 금액·식권 접수 · RSVP 자동 연동'))),
        E('section', { class: 'field-ops-card' },
          E('h3', {}, `👥 당일 핵심 역할 담당자 바로 연락 (${roles.length}건)`),
          roles.length
            ? E('ul', { class: 'field-ops-role-list' }, roles.map(r => {
              const phone = extractPhoneNumber(r.phone || '');
              return E('li', { class: 'field-ops-role-row' },
                E('div', {},
                  E('strong', {}, `${r.role}${r.assignee ? ` · ${r.assignee}` : ' (담당 미정)'}`),
                  E('p', { class: 'small muted' }, [r.group, r.note].filter(Boolean).join(' · '))),
                phone ? E('a', { href: `tel:${phone.digits}`, class: 'button quiet small-copy-btn' }, `📞 ${phone.display}`) : null);
            }))
            : E('p', { class: 'small muted' }, '본식 탭 → 당일 운영에서 역할 담당자와 연락처를 등록하면 여기서 바로 전화할 수 있어요.')));
    } else if (activeTab === 'envelopes') {
      panel = E('section', { class: 'field-ops-card' },
        E('div', { class: 'field-ops-card-head' },
          E('h3', {}, '✉️ 본식 당일 현금 봉투 체크'),
          denom.pending.totalAmount > 0
            ? E('span', { class: 'spec-chip highlight' }, `미준비 신권: 5만×${denom.pending.fiftyK} · 1만×${denom.pending.tenK}`)
            : E('span', { class: 'spec-chip direct' }, '모든 봉투 준비 완료')),
        envelopes.length
          ? E('ul', { class: 'field-ops-checklist' }, envelopes.map(env => {
            const box = E('input', { type: 'checkbox', id: `fenv-${env.id}` });
            box.checked = Boolean(env.ready);
            box.addEventListener('change', () => {
              ctx.queuePreference(async () => {
                const latest = ctx.getPrefs().weddingDayEnvelopes || [];
                const next = latest.map(row => (row.id === env.id ? { ...row, ready: box.checked } : row));
                const ok = await ctx.savePrefs({ ...ctx.getPrefs(), weddingDayEnvelopes: next });
                if (ok) renderHub();
                return ok;
              });
            });
            return E('li', { class: box.checked ? 'is-done' : '' },
              E('label', { for: box.id, class: 'checklist-label' },
                box,
                E('span', {},
                  E('strong', {}, `${env.payee}${env.recipient ? ` (${env.recipient})` : ''}`),
                  ` · ${env.amount ? `${env.amount.toLocaleString('ko-KR')}원` : '금액 미정'}`,
                  env.note ? E('span', { class: 'small muted' }, ` — ${env.note}`) : null)));
          }))
          : E('p', { class: 'small muted' }, '등록된 현금 봉투가 없습니다. 본식 → 당일 운영에서 ‘기본 봉투 5종’을 채워 보세요.'));
    } else if (activeTab === 'bgm') {
      panel = E('section', { class: 'field-ops-card' },
        E('div', { class: 'field-ops-card-head' },
          E('h3', {}, `🎼 본식 음향 · BGM 9구간 현장 점검 (${bgmReadyCount}/${CEREMONY_BGM_SLOTS.length})`),
          button('📋 BGM 큐시트 복사', () => {
            const text = buildBgmCueSheetText(ctx.getPrefs().ceremonyBgm || {}, inv, ctx.getPrefs().ceremonyPlan || {});
            ctx.copyTextToClipboard(text, '본식 BGM 음향 큐시트를 복사했습니다.', '본식 BGM 큐시트 복사');
          }, 'button quiet small-copy-btn')),
        E('ul', { class: 'field-ops-checklist' }, CEREMONY_BGM_SLOTS.map(([slotId, slotTitle, slotHint]) => {
          const entry = bgmMap[slotId] || {};
          const box = E('input', { type: 'checkbox', id: `fbgm-${slotId}` });
          box.checked = Boolean(entry.ready);
          box.addEventListener('change', () => {
            ctx.queuePreference(async () => {
              const latestMap = { ...(ctx.getPrefs().ceremonyBgm || {}) };
              const prev = latestMap[slotId] || {};
              latestMap[slotId] = {
                ...(prev.song ? { song: prev.song } : {}),
                ...(prev.cue ? { cue: prev.cue } : {}),
                ready: box.checked
              };
              const ok = await ctx.savePrefs({ ...ctx.getPrefs(), ceremonyBgm: latestMap });
              if (ok) renderHub();
              return ok;
            });
          });
          return E('li', { class: box.checked ? 'is-done' : '', 'data-hub-bgm': slotId },
            E('label', { for: box.id, class: 'checklist-label' },
              box,
              E('span', {},
                E('strong', {}, slotTitle),
                ' · ',
                entry.song
                  ? `${entry.song}${entry.cue ? ` (${entry.cue})` : ''}`
                  : E('span', { class: 'small muted' }, `미지정 (${slotHint})`))));
        })),
        E('div', { class: 'page-actions' },
          button('🎼 곡명·큐 상세 편집하러 가기 →', () => {
            wake.release();
            ctx.closeDialog();
            ctx.navigateToRoute('ceremony', 'rundown');
          }, 'button quiet small-copy-btn')));
    } else {
      panel = E('section', { class: 'field-ops-card' },
        E('div', { class: 'field-ops-card-head' },
          E('h3', {}, '📸 원판 가족·친구 사진 현장 호명 체크'),
          photoDone.size > 0 ? button('체크 초기화', () => { writePhotoCallChecked(new Set()); renderHub(); }, 'button quiet small-copy-btn') : null),
        E('div', { class: 'photo-call-list' }, photoLines.map((line, idx) => {
          const key = String(idx);
          const done = photoDone.has(key);
          return E('button', {
            type: 'button',
            class: 'photo-call-btn' + (done ? ' is-done' : ''),
            'aria-pressed': String(done),
            onclick: () => {
              const set = readPhotoCallChecked();
              if (set.has(key)) set.delete(key); else set.add(key);
              writePhotoCallChecked(set);
              renderHub();
            }
          }, E('span', { class: 'photo-call-mark' }, done ? '✓' : '○'), E('span', {}, line));
        })));
    }

    root.replaceChildren(
      E('div', { class: 'field-ops-bar' },
        E('span', { class: 'spec-chip direct' }, `${inv.date ? formatDate(inv.date) : '본식 당일'} ${inv.time || ''} · ${inv.venue || '예식장'}`.trim()),
        wakeBtn),
      tabBar,
      panel);
  };

  renderHub();
  if (ctx.showDialog('💍 본식 당일 현장 통합 모드', root)) {
    const dlg = document.querySelector('#editor-dialog');
    dlg?.addEventListener('close', () => { wake.release(); ctx.render(); }, { once: true });
  } else {
    wake.release();
  }
}
