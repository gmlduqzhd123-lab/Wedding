#!/usr/bin/env node
/**
 * Generate lightweight web copies of wedding photographs into assets/photos/<album>/
 * without modifying original files, and optionally register the album in data/site.json.
 *
 * Usage:
 *   npm run photos -- --src ~/Pictures/lachma-select --album lachma-2027 --title "라크마 웨딩촬영" --date 2027-02-03
 *   npm run photos -- --src ~/Pictures/lachma-select --album lachma-2027 --title "라크마 웨딩촬영" --date 2027-02-03 --apply
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContent, validateContent } from '../assets/js/content.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function sanitizeSlug(raw) {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!slug) throw new Error('올바른 --album 슬러그(영문·숫자·하이픈)를 입력해 주세요.');
  return slug;
}

export function parsePhotoCliArgs(argv) {
  const opts = {
    src: '',
    album: '',
    title: '',
    date: '',
    body: '',
    max: 1600,
    quality: 82,
    format: 'webp',
    apply: false,
    help: false,
    outRoot: path.join(ROOT, 'assets', 'photos'),
    sitePath: path.join(ROOT, 'data', 'site.json')
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--apply') opts.apply = true;
    else if (arg === '--src' && argv[i + 1]) opts.src = path.resolve(argv[++i]);
    else if (arg === '--album' && argv[i + 1]) opts.album = argv[++i];
    else if (arg === '--title' && argv[i + 1]) opts.title = argv[++i];
    else if (arg === '--date' && argv[i + 1]) opts.date = argv[++i];
    else if (arg === '--body' && argv[i + 1]) opts.body = argv[++i];
    else if (arg === '--max' && argv[i + 1]) opts.max = Number.parseInt(argv[++i], 10);
    else if (arg === '--quality' && argv[i + 1]) opts.quality = Number.parseInt(argv[++i], 10);
    else if (arg === '--format' && argv[i + 1]) opts.format = argv[++i].toLowerCase();
    else if (arg === '--out' && argv[i + 1]) opts.outRoot = path.resolve(argv[++i]);
    else if (arg === '--site' && argv[i + 1]) opts.sitePath = path.resolve(argv[++i]);
  }
  return opts;
}

export function detectImageBackend() {
  try {
    execFileSync('python3', ['-c', 'import PIL.Image, PIL.ImageOps'], { stdio: 'ignore' });
    return 'pillow';
  } catch {}
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  try {
    execFileSync('sips', ['--help'], { stdio: 'ignore' });
    return 'sips';
  } catch {}
  return null;
}

function convertWithPillow(jobs, { max, quality, format }) {
  const pyCode = `
import json, sys
from PIL import Image, ImageOps

cfg = json.loads(sys.stdin.read())
max_side = int(cfg["max"])
quality = int(cfg["quality"])
fmt = cfg["format"]
results = []

for job in cfg["jobs"]:
    with Image.open(job["src"]) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode in ("RGBA", "LA") or "transparency" in img.info:
                rgba = img.convert("RGBA")
                bg.paste(rgba, mask=rgba.split()[-1])
                img = bg
            else:
                img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")
        orig_w, orig_h = img.size
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        out_w, out_h = img.size
        save_kwargs = {"quality": quality}
        if fmt == "webp":
            save_kwargs["method"] = 5
            img.save(job["dest"], "WEBP", **save_kwargs)
        else:
            save_kwargs["optimize"] = True
            save_kwargs["progressive"] = True
            img.save(job["dest"], "JPEG", **save_kwargs)
        results.append({"dest": job["dest"], "width": out_w, "height": out_h, "origWidth": orig_w, "origHeight": orig_h})

print(json.dumps(results))
`;
  const raw = execFileSync('python3', ['-c', pyCode], {
    input: JSON.stringify({ max, quality, format, jobs }),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(raw);
}

function convertSingleFallback(backend, src, dest, { max, quality, format }) {
  if (backend === 'magick' || backend === 'convert') {
    execFileSync(backend, [
      src,
      '-auto-orient',
      '-resize', `${max}x${max}>`,
      '-strip',
      '-quality', String(quality),
      dest
    ], { stdio: 'ignore' });
    return;
  }
  if (backend === 'ffmpeg') {
    const args = ['-y', '-i', src, '-vf', `scale='min(${max},iw)':'min(${max},ih)':force_original_aspect_ratio=decrease`];
    if (format === 'webp') args.push('-quality', String(quality));
    else args.push('-q:v', String(Math.max(2, Math.round((100 - quality) / 3))));
    args.push(dest);
    execFileSync('ffmpeg', args, { stdio: 'ignore' });
    return;
  }
  if (backend === 'sips') {
    if (format !== 'jpg') throw new Error('sips 백엔드는 --format jpg만 지원합니다.');
    execFileSync('sips', ['-Z', String(max), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), src, '--out', dest], { stdio: 'ignore' });
    return;
  }
  throw new Error('지원되는 이미지 변환 도구(python3 Pillow, ImageMagick, ffmpeg, sips)를 찾을 수 없습니다.');
}

export async function optimizeAlbumPhotos(options) {
  const slug = sanitizeSlug(options.album);
  const format = options.format === 'jpeg' ? 'jpg' : options.format;
  if (!['webp', 'jpg'].includes(format)) throw new Error('--format은 webp 또는 jpg만 지원합니다.');
  const max = Number.isInteger(options.max) && options.max >= 320 && options.max <= 4000 ? options.max : 1600;
  const quality = Number.isInteger(options.quality) && options.quality >= 40 && options.quality <= 98 ? options.quality : 82;
  if (!options.src) throw new Error('--src <원본 사진 폴더>를 지정해 주세요.');

  const srcStat = await stat(options.src).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) throw new Error(`원본 폴더를 찾을 수 없습니다: ${options.src}`);

  const destDir = path.join(options.outRoot, slug);
  if (path.resolve(options.src) === path.resolve(destDir)) {
    throw new Error('원본 폴더와 출력 폴더가 같습니다. 원본을 보호하기 위해 다른 출력 경로를 사용해 주세요.');
  }

  const entries = (await readdir(options.src, { withFileTypes: true }))
    .filter(ent => ent.isFile() && SUPPORTED_EXTS.has(path.extname(ent.name).toLowerCase()))
    .map(ent => ent.name)
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));

  if (!entries.length) throw new Error(`변환할 사진(JPG/PNG/WEBP)이 없습니다: ${options.src}`);
  if (entries.length > 100) throw new Error(`앨범당 최대 100장까지 지원합니다 (현재 ${entries.length}장).`);

  const backend = detectImageBackend();
  if (!backend) throw new Error('이미지 변환 도구(python3 Pillow, ImageMagick, ffmpeg, sips)가 설치되어 있지 않습니다.');

  await mkdir(destDir, { recursive: true });
  const padWidth = Math.max(2, String(entries.length).length);
  const jobs = entries.map((name, idx) => {
    const seq = String(idx + 1).padStart(padWidth, '0');
    const outName = `${seq}.${format}`;
    return {
      src: path.join(options.src, name),
      dest: path.join(destDir, outName),
      originalName: name,
      outName
    };
  });

  let dimensions = [];
  if (backend === 'pillow') {
    dimensions = convertWithPillow(jobs, { max, quality, format });
  } else {
    for (const job of jobs) {
      convertSingleFallback(backend, job.src, job.dest, { max, quality, format });
    }
  }

  let totalBefore = 0;
  let totalAfter = 0;
  const files = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const [bStat, aStat] = await Promise.all([stat(job.src), stat(job.dest)]);
    totalBefore += bStat.size;
    totalAfter += aStat.size;
    const relFromRoot = './' + path.relative(ROOT, job.dest).split(path.sep).join('/');
    files.push({
      original: job.originalName,
      output: job.dest,
      webPath: relFromRoot.startsWith('./..') ? `./assets/photos/${slug}/${job.outName}` : relFromRoot,
      beforeBytes: bStat.size,
      afterBytes: aStat.size,
      width: dimensions[i]?.width ?? null,
      height: dimensions[i]?.height ?? null
    });
  }

  const albumEntry = {
    id: `album-${slug}`,
    title: (options.title || slug).trim(),
    date: (options.date || '').trim(),
    body: (options.body || '').trim(),
    images: files.map(f => f.webPath)
  };

  let applied = false;
  if (options.apply) {
    const siteRaw = await readFile(options.sitePath, 'utf8');
    const site = parseContent(siteRaw);
    const idx = site.albums.findIndex(a => a.id === albumEntry.id);
    if (idx >= 0) site.albums[idx] = albumEntry;
    else site.albums.unshift(albumEntry);
    const validated = validateContent(site);
    await writeFile(options.sitePath, JSON.stringify(validated, null, 2) + '\n', 'utf8');
    applied = true;
  }

  return {
    backend,
    slug,
    destDir,
    format,
    max,
    quality,
    count: files.length,
    totalBefore,
    totalAfter,
    files,
    albumEntry,
    applied
  };
}

function formatKb(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parsePhotoCliArgs(process.argv.slice(2));
  if (opts.help || (!opts.src && !opts.album)) {
    console.log(`웹용 웨딩 사진 최적화 도구 (원본 보존)

사용법:
  npm run photos -- --src <원본폴더> --album <슬러그> [옵션]

옵션:
  --src <경로>      원본 사진 폴더 (JPG/PNG/WEBP, 원본은 절대 수정하지 않음)
  --album <슬러그>  저장할 폴더명 (예: lachma-2027 -> assets/photos/lachma-2027/)
  --title <제목>    앨범 제목 (예: "라크마 웨딩촬영")
  --date <날짜>     촬영 날짜 YYYY-MM-DD (예: 2027-02-03)
  --body <설명>     앨범 소개 문구 (선택)
  --max <픽셀>      긴 변 최대 크기 (기본 1600)
  --quality <숫자>  화질 40~98 (기본 82)
  --format <형식>   webp(기본) 또는 jpg
  --apply           data/site.json의 albums 목록에 자동 반영 (유효성 검사 포함)
`);
    process.exit(0);
  }
  const result = await optimizeAlbumPhotos(opts);
  const ratio = result.totalBefore ? Math.round((1 - result.totalAfter / result.totalBefore) * 100) : 0;
  console.log(`✅ 웹용 사본 ${result.count}장 생성 완료 (${result.backend}, ${result.format.toUpperCase()}, 최대 ${result.max}px)`);
  console.log(`   용량: ${formatKb(result.totalBefore)} -> ${formatKb(result.totalAfter)} (${ratio}% 절감)`);
  console.log(`   위치: ${result.destDir}`);
  if (result.applied) {
    console.log(`   반영: ${opts.sitePath}에 '${result.albumEntry.title}' 앨범을 반영했습니다.`);
    console.log('   다음 단계: npm run share-card && npm run check && npm run build');
  } else {
    console.log('\n아래 앨범 항목을 data/site.json에 추가하거나 --apply 옵션으로 자동 반영하세요:');
    console.log(JSON.stringify(result.albumEntry, null, 2));
  }
}
