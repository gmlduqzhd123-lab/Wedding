#!/usr/bin/env node
/**
 * Uniformly bump the ?v= cache version across index.html, sw.js, and assets/js/*.js.
 *
 * Usage:
 *   npm run bump                      # Auto-increment wedding-features-NN -> NN+1
 *   npm run bump -- wedding-features-60
 *   npm run bump -- --dry-run
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function nextVersionLabel(current) {
  const m = String(current || '').match(/^(.*?)(\d+)$/);
  if (!m) throw new Error(`버전 번호를 자동으로 증가시킬 수 없습니다: ${current}`);
  return `${m[1]}${Number(m[2]) + 1}`;
}

export function replaceVersionInText(text, nextVersion) {
  let out = text.replace(/([?&]v=)[A-Za-z0-9._-]+/g, `$1${nextVersion}`);
  out = out.replace(/(const\s+CACHE_VERSION\s*=\s*['"])[A-Za-z0-9._-]+(['"])/g, `$1${nextVersion}$2`);
  return out;
}

export async function bumpProjectVersion({ root = ROOT, targetVersion = '', dryRun = false } = {}) {
  const swPath = path.join(root, 'sw.js');
  const swText = await readFile(swPath, 'utf8');
  const match = swText.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error('sw.js에서 CACHE_VERSION을 찾을 수 없습니다.');
  const currentVersion = match[1];
  const nextVersion = targetVersion || nextVersionLabel(currentVersion);
  if (!/^[A-Za-z0-9._-]+$/.test(nextVersion)) {
    throw new Error(`올바르지 않은 버전 문자열입니다: ${nextVersion}`);
  }

  const jsDir = path.join(root, 'assets', 'js');
  const jsFiles = (await readdir(jsDir))
    .filter(name => name.endsWith('.js'))
    .sort()
    .map(name => path.join(jsDir, name));

  const targets = [
    path.join(root, 'index.html'),
    swPath,
    ...jsFiles
  ];

  const changed = [];
  for (const filePath of targets) {
    const before = await readFile(filePath, 'utf8');
    const after = replaceVersionInText(before, nextVersion);
    if (after !== before) {
      if (!dryRun) await writeFile(filePath, after, 'utf8');
      changed.push(path.relative(root, filePath));
    }
  }
  return { currentVersion, nextVersion, changed, dryRun };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npm run bump -- [next-version] [--dry-run]');
    process.exit(0);
  }
  const dryRun = args.includes('--dry-run');
  const positional = args.filter(a => !a.startsWith('--'));
  const targetVersion = positional[0] || '';
  const result = await bumpProjectVersion({ targetVersion, dryRun });
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Version: ${result.currentVersion} -> ${result.nextVersion} (${result.changed.length} files)`
  );
  for (const file of result.changed) console.log(`  - ${file}`);
}
