import { validatePreferences } from './preferences.js?v=wedding-features-65';

export const SYNC_CODE_PREFIX = 'WEDDING-SYNC-V1:';
const MAX_ENCODED_CHARS = 524288;
const MAX_DECODED_BYTES = 2 * 1024 * 1024;

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
  const clean = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  const binary = atob(clean + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function gzipBytes(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function gunzipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('이 브라우저에서는 압축 동기화 해제를 지원하지 않습니다. JSON 파일 공유를 이용해 주세요.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DECODED_BYTES) throw new Error('동기화 코드 용량이 허용 한도를 초과했습니다.');
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}

export function stripEmptyPreferences(prefs = {}) {
  const valid = validatePreferences(prefs);
  const compact = {};
  for (const [k, v] of Object.entries(valid)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    compact[k] = v;
  }
  return compact;
}

export function summarizePreferenceCounts(prefs = {}) {
  const p = prefs || {};
  const guests = (p.guestList || []).length;
  const gifts = (p.giftLedger || []).length;
  const homeItems = (p.homeItems || []).length;
  const checks = (p.checklist || []).length + (p.shootChecklist || []).length + (p.ceremonyChecks || []).length + (p.prenatalChecks || []).length + (p.packingList || []).length + (p.benefitChecks || []).length;
  const notes = Object.keys(p.notes || {}).length + Object.keys(p.tripNotes || {}).length + Object.keys(p.tipNotes || {}).length + Object.keys(p.checklistNotes || {}).length;
  const schedules = (p.vendorSchedules || []).length;
  const dayOps = (p.weddingDayRoles || []).length + (p.weddingDayEnvelopes || []).length;
  const hasBudget = Object.keys(p.budgetPlan || {}).length > 0;
  const totalItems = guests + gifts + homeItems + checks + notes + schedules + dayOps + (hasBudget ? 1 : 0);
  return { guests, gifts, homeItems, checks, notes, schedules, dayOps, hasBudget, totalItems };
}

export async function encodeSyncCode(prefs = {}) {
  const compact = stripEmptyPreferences(prefs);
  const rawJson = JSON.stringify({ v: 1, p: compact });
  const rawBytes = new TextEncoder().encode(rawJson);
  let mode = 'J';
  let payloadBytes = rawBytes;
  try {
    const zipped = await gzipBytes(rawBytes);
    if (zipped && zipped.byteLength < rawBytes.byteLength) {
      mode = 'G';
      payloadBytes = zipped;
    }
  } catch {}
  const code = `${SYNC_CODE_PREFIX}${mode}.${bytesToBase64Url(payloadBytes)}`;
  if (code.length > MAX_ENCODED_CHARS) {
    throw new Error('개인 기록 용량이 커서 텍스트 코드 대신 JSON 파일 백업 공유를 이용해 주세요.');
  }
  return {
    code,
    rawBytes: rawBytes.byteLength,
    codeLength: code.length,
    compressed: mode === 'G'
  };
}

export async function decodeSyncCode(rawText) {
  const text = String(rawText || '').trim();
  const match = text.match(/WEDDING-SYNC-V1:([GJ])\.([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error('유효한 신랑·신부 동기화 코드(WEDDING-SYNC-V1:...)를 찾을 수 없습니다. 코드 전체를 복사해 붙여넣어 주세요.');
  }
  const [, mode, b64] = match;
  if (b64.length > MAX_ENCODED_CHARS) {
    throw new Error('동기화 코드 길이가 허용 한도를 초과했습니다.');
  }
  let bytes;
  try {
    bytes = base64UrlToBytes(b64);
  } catch {
    throw new Error('동기화 코드가 손상되었습니다. 상대방에게 코드를 다시 받아 붙여넣어 주세요.');
  }
  let decodedBytes = bytes;
  if (mode === 'G') {
    try {
      decodedBytes = await gunzipBytes(bytes);
    } catch (error) {
      throw new Error(error?.message?.includes('한도') || error?.message?.includes('지원하지') ? error.message : '동기화 코드 압축을 풀지 못했습니다. 코드가 중간에 잘리지 않았는지 확인해 주세요.');
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(decodedBytes));
  } catch {
    throw new Error('동기화 코드 형식을 읽을 수 없습니다.');
  }
  if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || !parsed.p || typeof parsed.p !== 'object' || Array.isArray(parsed.p)) {
    throw new Error('지원하지 않는 동기화 코드 버전입니다.');
  }
  return validatePreferences(parsed.p);
}
