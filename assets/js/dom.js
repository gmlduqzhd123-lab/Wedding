import { safeUrl } from './content.js?v=wedding-features-71';

export const $ = selector => document.querySelector(selector);

export function E(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== undefined && child !== null && child !== false) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function S(tag, attributes = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attributes)) {
    if (v !== undefined && v !== null && v !== false) node.setAttribute(k, String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== undefined && child !== null && child !== false) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
  return node;
}

export const button = (label, action, className = 'button') => E('button', { type: 'button', class: className, onclick: action }, label);
export const linkButton = (label, href, quiet = false) => E('a', { class: 'button' + (quiet ? ' quiet' : ''), href }, label);

export function externalLink(label, url, className = 'text-button') {
  const href = safeUrl(url);
  return href ? E('a', { href, class: className, target: '_blank', rel: 'noopener noreferrer' }, label) : null;
}

export function image(src, alt, attrs = {}) {
  const href = safeUrl(src, { image: true });
  if (!href) return null;
  const node = E('img', { src: href, alt, loading: 'lazy', ...attrs });
  node.addEventListener('error', () => {
    node.hidden = true;
    node.parentElement?.appendChild(E('span', { class: 'small muted' }, '사진을 불러오지 못했습니다.'));
  }, { once: true });
  return node;
}

export function formatPartner(name, role) {
  if (!name) return '';
  return name.startsWith(role) ? name : `${role} ${name}`;
}

export function searchBox({ id, value = '', placeholder = '검색', ariaLabel = '검색', onInput, onClear }) {
  const input = E('input', { type: 'search', id, placeholder, 'aria-label': ariaLabel });
  input.value = value;
  const clearBtn = E('button', {
    type: 'button',
    class: 'search-clear-btn',
    'aria-label': `${ariaLabel} 지우기`,
    hidden: !value
  }, '×');
  const syncClear = () => { clearBtn.hidden = !input.value; };
  input.addEventListener('input', event => {
    syncClear();
    onInput?.(input.value, input, event);
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    syncClear();
    if (onClear) onClear(input);
    else onInput?.('', input);
    input.focus({ preventScroll: true });
  });
  return {
    wrap: E('div', { class: 'search-box' }, input, clearBtn),
    input,
    clearBtn,
    syncClear
  };
}

export function downloadText(raw, filename, type) {
  const blob = new Blob([raw], { type });
  const url = URL.createObjectURL(blob);
  const a = E('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(value, filename) {
  downloadText(JSON.stringify(value) + '\n', filename, 'application/json;charset=utf-8');
}

export function enhanceTablistKeyboard(tablistEl) {
  if (!tablistEl) return tablistEl;
  const syncRoving = () => {
    const tabs = [...tablistEl.querySelectorAll('[role="tab"]')];
    const activeIdx = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));
    tabs.forEach((tab, idx) => { tab.tabIndex = idx === activeIdx ? 0 : -1; });
  };
  syncRoving();
  tablistEl.addEventListener('keydown', event => {
    const tabs = [...tablistEl.querySelectorAll('[role="tab"]')];
    if (tabs.length < 2) return;
    const current = event.target?.closest?.('[role="tab"]');
    const idx = tabs.indexOf(current);
    if (idx < 0) return;
    let nextIdx = -1;
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = tabs.length - 1;
    if (nextIdx < 0 || nextIdx === idx) return;
    event.preventDefault();
    tabs[nextIdx].click();
  });
  return tablistEl;
}

let overflowMenusBound = false;
function ensureOverflowMenuListeners() {
  if (overflowMenusBound || typeof document === 'undefined') return;
  overflowMenusBound = true;
  document.addEventListener('click', event => {
    for (const openMenu of document.querySelectorAll('details.action-more-menu[open]')) {
      if (!openMenu.contains(event.target)) openMenu.open = false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const openMenu of document.querySelectorAll('details.action-more-menu[open]')) {
      openMenu.open = false;
      openMenu.querySelector('summary')?.focus({ preventScroll: true });
    }
  });
}

export function actionOverflowMenu(items = [], { label = '⋯ 더보기', ariaLabel = '추가 작업 메뉴', summaryClass = 'button quiet action-more-summary' } = {}) {
  const valid = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!valid.length) return null;
  ensureOverflowMenuListeners();
  const details = E('details', { class: 'action-more-menu' });
  const summary = E('summary', { class: summaryClass, 'aria-label': ariaLabel }, label);
  const panel = E('div', { class: 'action-more-panel', role: 'menu' },
    valid.map(([itemLabel, action, opts = {}]) => {
      const btn = E('button', {
        type: 'button',
        role: 'menuitem',
        class: 'action-more-item' + (opts.danger ? ' is-danger' : ''),
        disabled: Boolean(opts.disabled)
      }, itemLabel);
      btn.addEventListener('click', event => {
        details.open = false;
        action?.(event);
      });
      return btn;
    }));
  details.append(summary, panel);
  return details;
}

