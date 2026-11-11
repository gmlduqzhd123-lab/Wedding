import test from 'node:test';
import assert from 'node:assert/strict';
import { createQrMatrix, renderQrSvgString } from '../assets/js/qrcode.js';

// ISO/IEC 18004 Annex C Table C.1 exact 15-bit format strings for EC Level M (00), masks 0..7
const ANNEX_C_LEVEL_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];
// ISO/IEC 18004 Annex D Table D.1 exact 18-bit version strings for V7..V9
const ANNEX_D_VERSIONS = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99 };

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = EXP[i + 255] = x; LOG[x] = i;
  x <<= 1; if (x & 0x100) x ^= 0x11d;
}
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function decodeQrMatrix(matrix, spec) {
  const n = matrix.length;
  const version = (n - 17) / 4;

  // Read both copies of 15-bit format string and verify they match Annex C Table C.1
  const tlCoords = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  let fmt1 = 0, fmt2 = 0;
  for (const [r, c] of tlCoords) fmt1 = (fmt1 << 1) | (matrix[r][c] ? 1 : 0);
  for (let i = 0; i < 7; i++) fmt2 = (fmt2 << 1) | (matrix[n - 1 - i][8] ? 1 : 0);
  for (let i = 0; i < 8; i++) fmt2 = (fmt2 << 1) | (matrix[8][n - 8 + i] ? 1 : 0);
  assert.equal(fmt1, fmt2, 'Both format info copies must be identical');
  const mask = ANNEX_C_LEVEL_M.indexOf(fmt1);
  assert(mask >= 0 && mask <= 7, `Format string 0x${fmt1.toString(16)} must match Annex C Level M`);

  // Verify dark module and timing patterns
  assert.equal(matrix[n - 8][8], true, 'Dark module at (4V+9, 8) must be dark');
  for (let i = 8; i < n - 8; i++) {
    const onAlign = spec.align.some(a => Math.abs(i - a) <= 2 && spec.align.includes(6));
    if (!onAlign) {
      assert.equal(matrix[6][i], i % 2 === 0);
      assert.equal(matrix[i][6], i % 2 === 0);
    }
  }

  // Verify version info for V7+
  if (version >= 7) {
    let vTopRight = 0, vBotLeft = 0;
    for (let i = 17; i >= 0; i--) {
      const r = Math.floor(i / 3), c = n - 11 + (i % 3);
      vTopRight = (vTopRight << 1) | (matrix[r][c] ? 1 : 0);
      vBotLeft = (vBotLeft << 1) | (matrix[c][r] ? 1 : 0);
    }
    assert.equal(vTopRight, ANNEX_D_VERSIONS[version]);
    assert.equal(vBotLeft, ANNEX_D_VERSIONS[version]);
  }

  // Build reserved map to extract unmasked data/EC codewords
  const reserved = Array.from({ length: n }, () => false).map(() => new Uint8Array(n));
  const markBox = (r0, c0, r1, c1) => {
    for (let r = Math.max(0, r0); r <= Math.min(n - 1, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(n - 1, c1); c++) reserved[r][c] = 1;
  };
  markBox(0, 0, 8, 8);
  markBox(0, n - 8, 8, n - 1);
  markBox(n - 8, 0, n - 1, 8);
  for (const r of spec.align) for (const c of spec.align) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 8) || (r >= n - 8 && c <= 8)) continue;
    markBox(r - 2, c - 2, r + 2, c + 2);
  }
  for (let i = 8; i < n - 8; i++) { reserved[6][i] = 1; reserved[i][6] = 1; }
  if (version >= 7) { markBox(0, n - 11, 5, n - 9); markBox(n - 11, 0, n - 9, 5); }

  const rawBits = [];
  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < n; step++) {
      const r = upward ? n - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (!reserved[r][c]) {
          const bit = (matrix[r][c] ? 1 : 0) ^ (MASKS[mask](r, c) ? 1 : 0);
          rawBits.push(bit);
        }
      }
    }
    upward = !upward;
  }

  const totalCw = spec.groups.reduce((s, [cnt, cw]) => s + cnt * (cw + spec.ec), 0);
  const codewords = [];
  for (let i = 0; i < totalCw; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | rawBits[i * 8 + k];
    codewords.push(b);
  }

  // De-interleave blocks & verify all Reed-Solomon syndromes S_0..S_{ec-1} === 0
  const blocks = [];
  for (const [cnt, cw] of spec.groups) for (let i = 0; i < cnt; i++) blocks.push({ dataLen: cw, data: [], ec: [] });
  let idx = 0;
  const maxData = Math.max(...blocks.map(b => b.dataLen));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.dataLen) b.data.push(codewords[idx++]);
  for (let i = 0; i < spec.ec; i++) for (const b of blocks) b.ec.push(codewords[idx++]);

  for (const b of blocks) {
    const poly = [...b.data, ...b.ec];
    for (let j = 0; j < spec.ec; j++) {
      let syn = 0;
      const root = EXP[j];
      for (const coeff of poly) syn = gfMul(syn, root) ^ coeff;
      assert.equal(syn, 0, `Reed-Solomon syndrome S_${j} must be 0`);
    }
  }

  const allData = blocks.flatMap(b => b.data);
  const dataBits = [];
  for (const byte of allData) for (let k = 7; k >= 0; k--) dataBits.push((byte >> k) & 1);
  const readBits = (pos, len) => {
    let v = 0;
    for (let i = 0; i < len; i++) v = (v << 1) | dataBits[pos + i];
    return v;
  };
  assert.equal(readBits(0, 4), 0b0100, 'Mode indicator must be Byte mode (0100)');
  const byteLen = readBits(4, 8);
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) out[i] = readBits(12 + i * 8, 8);
  return new TextDecoder().decode(out);
}

test('QR encoder produces valid ISO/IEC 18004 symbols with zero RS syndromes across V1, V5, V8, and V9', () => {
  const cases = [
    ['https://x.co', { ec: 10, groups: [[1, 16]], align: [] }],
    ['https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation', { ec: 24, groups: [[2, 43]], align: [6, 30] }],
    ['https://gmlduqzhd123-lab.github.io/Wedding/?view=guest&couple=김희엽-유미혜-2027-06-05-순천아모르웨딩컨벤션#/invitation', { ec: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42] }],
    ['https://gmlduqzhd123-lab.github.io/Wedding/?view=guest&couple=김희엽-유미혜-2027-06-05-순천아모르웨딩컨벤션-1층-아모르홀#/invitation', { ec: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46] }]
  ];
  for (const [input, spec] of cases) {
    const matrix = createQrMatrix(input);
    assert.equal(decodeQrMatrix(matrix, spec), input);
  }
  const svg = renderQrSvgString('https://gmlduqzhd123-lab.github.io/Wedding/?view=guest#/invitation', { label: '청첩장 <QR>' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 45 45"/);
  assert.match(svg, /aria-label="청첩장 &lt;QR&gt;"/);
  assert.throws(() => createQrMatrix(''), /비어/);
  assert.throws(() => createQrMatrix('x'.repeat(250)), /너무 깁니다/);
});
