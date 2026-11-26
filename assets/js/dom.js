import { safeUrl } from './content.js?v=wedding-features-60';

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
