// Dependency-free ISO/IEC 18004 QR Code encoder (Byte mode, EC Level M, Versions 1-9).
const VERSIONS = [
  null,
  { ec: 10, groups: [[1, 16]], align: [] },
  { ec: 16, groups: [[1, 28]], align: [6, 18] },
  { ec: 26, groups: [[1, 44]], align: [6, 22] },
  { ec: 18, groups: [[2, 32]], align: [6, 26] },
  { ec: 24, groups: [[2, 43]], align: [6, 30] },
  { ec: 16, groups: [[4, 27]], align: [6, 34] },
  { ec: 18, groups: [[4, 31]], align: [6, 22, 38] },
  { ec: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42] },
  { ec: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46] }
];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  EXP[i + 255] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function rsGenerator(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.copyWithin(0, 1);
    rem[degree - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < degree; j++) rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

function formatBits(ecBits, mask) {
  const data = (ecBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version) {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

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

function penaltyScore(grid) {
  const n = grid.length;
  let score = 0;
  const linePenalty = (get) => {
    let runColor = -1, runLen = 0;
    for (let i = 0; i < n; i++) {
      const bit = get(i);
      if (bit === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = bit;
        runLen = 1;
      }
    }
    for (let i = 0; i <= n - 11; i++) {
      const p1 = [1,0,1,1,1,0,1,0,0,0,0].every((v, k) => get(i + k) === v);
      const p2 = [0,0,0,0,1,0,1,1,1,0,1].every((v, k) => get(i + k) === v);
      if (p1 || p2) score += 40;
    }
  };
  for (let r = 0; r < n; r++) linePenalty(c => grid[r][c]);
  for (let c = 0; c < n; c++) linePenalty(r => grid[r][c]);
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) dark++;
      if (r < n - 1 && c < n - 1) {
        const b = grid[r][c];
        if (b === grid[r][c + 1] && b === grid[r + 1][c] && b === grid[r + 1][c + 1]) score += 3;
      }
    }
  }
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export function createQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  if (!bytes.length) throw new Error('QR 코드로 변환할 텍스트가 비어 있습니다.');
  let version = 0;
  for (let v = 1; v < VERSIONS.length; v++) {
    const dataCap = VERSIONS[v].groups.reduce((sum, [cnt, cw]) => sum + cnt * cw, 0);
    if (bytes.length + 2 <= dataCap) { version = v; break; }
  }
  if (!version) throw new Error('QR 코드로 변환할 주소가 너무 깁니다.');
  const spec = VERSIONS[version];
  const dataCap = spec.groups.reduce((sum, [cnt, cw]) => sum + cnt * cw, 0);

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  const maxBits = dataCap * 8;
  pushBits(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const dataCodewords = new Uint8Array(dataCap);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    dataCodewords[i] = byte;
  }
  for (let i = bits.length / 8, pad = 0; i < dataCap; i++, pad ^= 1) {
    dataCodewords[i] = pad === 0 ? 0xec : 0x11;
  }

  const dataBlocks = [], ecBlocks = [];
  let offset = 0;
  for (const [count, cw] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const block = dataCodewords.subarray(offset, offset + cw);
      offset += cw;
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, spec.ec));
    }
  }
  const interleaved = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }
  const stream = [];
  for (const byte of interleaved) {
    for (let b = 7; b >= 0; b--) stream.push((byte >> b) & 1);
  }

  const size = 17 + version * 4;
  const base = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));
  const setFn = (r, c, dark) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    base[r][c] = dark ? 1 : 0;
    reserved[r][c] = 1;
  };
  const placeFinder = (top, left) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFn(top + dr, left + dc, inOuter && (onBorder || inCenter));
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (const r of spec.align) {
    for (const c of spec.align) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFn(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFn(6, i, i % 2 === 0);
    if (!reserved[i][6]) setFn(i, 6, i % 2 === 0);
  }

  setFn(size - 8, 8, 1);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = 1;
    if (!reserved[i][8]) reserved[i][8] = 1;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  if (version >= 7) {
    const vBits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >> i) & 1;
      const r = Math.floor(i / 3), c = size - 11 + (i % 3);
      setFn(r, c, bit);
      setFn(c, r, bit);
    }
  }

  let bitIdx = 0, upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (!reserved[r][c]) {
          base[r][c] = bitIdx < stream.length ? stream[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  const writeFormat = (grid, mask) => {
    const f = formatBits(0b00, mask);
    const tlCoords = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    for (let i = 0; i < 15; i++) {
      const bit = (f >> (14 - i)) & 1;
      const [r, c] = tlCoords[i];
      grid[r][c] = bit;
    }
    for (let i = 0; i < 7; i++) grid[size - 1 - i][8] = (f >> (14 - i)) & 1;
    for (let i = 0; i < 8; i++) grid[8][size - 8 + i] = (f >> (7 - i)) & 1;
  };

  let bestGrid = null, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) => row.map((val, c) => (!reserved[r][c] && MASKS[mask](r, c) ? val ^ 1 : val)));
    writeFormat(candidate, mask);
    const p = penaltyScore(candidate);
    if (p < bestPenalty) { bestPenalty = p; bestGrid = candidate; }
  }
  return bestGrid.map(row => Array.from(row, Boolean));
}

export function renderQrSvgString(text, { margin = 4, label = '모바일 청첩장 QR 코드' } = {}) {
  const matrix = createQrMatrix(text);
  const n = matrix.length;
  const total = n + margin * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  const safeLabel = String(label).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${safeLabel}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${path}" fill="#1d2b22"/></svg>`;
}
