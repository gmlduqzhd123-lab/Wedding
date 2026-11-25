import { readFile,access,readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parseContent, extractGuestContent } from '../assets/js/content.js';
const root=new URL('../',import.meta.url);
const site=parseContent(await readFile(new URL('data/site.json',root),'utf8'));
const guestSite=extractGuestContent(site);
assert.equal(guestSite.honeymoon.length,0,'Guest site projection must omit honeymoon items.');
assert.equal(guestSite.tips.length,0,'Guest site projection must omit tips.');
assert.deepEqual(guestSite.invitation,site.invitation,'Guest site projection must preserve invitation.');
assert.equal(site.tips.length,50,'Wedding tips must preserve all 50 curated YouTube entries.');
for(const tip of site.tips){
  assert(tip.title&&tip.category&&tip.channel&&tip.body,'Each wedding tip must include title, category, channel, and body.');
  assert(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(tip.url),`Invalid YouTube URL on ${tip.id}`);
}
const studios=JSON.parse(await readFile(new URL('data/studios.json',root),'utf8'));
assert.equal(studios.length,30,'Studio migration must preserve all 30 entries.');
assert.equal(new Set(studios.map(s=>s.id)).size,studios.length,'Studio IDs must be unique.');
assert.equal(studios.filter(s=>s.contact.phone).length,22,'Contact mappings must preserve the supplied list.');
for(const studio of studios){
  for(const field of ['name','style','pros','cons','fit','fee'])assert.equal(typeof studio[field],'string');
  assert.equal(studio.images.length,2);
  for(const image of studio.images)await access(new URL(image.src.replace(/^\.\//,''),root));
  for(const loc of studio.deepGuide?.locations||[])if(loc.mapImage)await access(new URL(loc.mapImage.replace(/^\.\//,''),root));
  if(studio.contact.phone)assert(/^[0-9-]+$/.test(studio.contact.phone));
}
const html=await readFile(new URL('index.html',root),'utf8');
const versions=new Set();
for(const [,src]of html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)){
  await access(new URL(src,root));
  if(/\.(?:css|js)(?:\?|$)/.test(src)){
    const ver=new URL(src,'https://example.invalid/').searchParams.get('v');
    assert(ver,`Missing ?v= cache version on ${src} in index.html`);
    versions.add(ver);
  }
}
const jsEntries=(await readdir(new URL('assets/js/',root))).filter(name=>name.endsWith('.js')).sort();
for(const name of jsEntries){
  const fileUrl=new URL('assets/js/'+name,root);
  execFileSync(process.execPath,['--check',fileURLToPath(fileUrl)]);
  const source=await readFile(fileUrl,'utf8');
  for(const [,spec]of source.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.\/[^'"]+)['"]/g)){
    const ver=new URL(spec,'https://example.invalid/').searchParams.get('v');
    assert(ver,`Missing ?v= cache version on ${spec} in assets/js/${name}`);
    versions.add(ver);
  }
}
const swUrl=new URL('sw.js',root);
await access(swUrl);
execFileSync(process.execPath,['--check',fileURLToPath(swUrl)]);
const swSource=await readFile(swUrl,'utf8');
const swVerMatch=swSource.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
assert(swVerMatch,'sw.js must define CACHE_VERSION');
versions.add(swVerMatch[1]);
for(const name of jsEntries){
  if(name==='sharing.js')continue;
  assert(swSource.includes(`./assets/js/${name}`),`sw.js must list ./assets/js/${name} in precache lists for full offline support.`);
}
assert(swSource.includes('./assets/css/planner.css'),'sw.js must cache planner.css for offline planner mode.');
for(const [,imgUrl]of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g)){
  const ver=new URL(imgUrl).searchParams.get('v');
  assert(ver,`Missing ?v= cache version on share image ${imgUrl} in index.html`);
  versions.add(ver);
}
const sharingSource=await readFile(new URL('assets/js/sharing.js',root),'utf8');
const shareConstMatch=sharingSource.match(/SHARE_IMAGE_URL=['"]([^'"]+)['"]/);
assert(shareConstMatch,'sharing.js must export SHARE_IMAGE_URL');
versions.add(new URL(shareConstMatch[1]).searchParams.get('v'));
assert.equal(versions.size,1,`Expected a single uniform asset ?v= version across index.html, sw.js, share-card, and assets/js/*.js, found: ${[...versions].join(', ')}`);
const appCss=await readFile(new URL('assets/css/app.css',root),'utf8');
const plannerCss=await readFile(new URL('assets/css/planner.css',root),'utf8');
const combinedCss=appCss+'\n'+plannerCss;
const definedCssVars=new Set([...combinedCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m=>m[1]));
const undefinedCssVars=[...new Set([...combinedCss.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(m=>m[1]))].filter(v=>!definedCssVars.has(v));
assert.deepEqual(undefinedCssVars,[],`Undefined CSS custom properties in stylesheets: ${undefinedCssVars.join(', ')}`);
const appSource=await readFile(new URL('assets/js/app.js',root),'utf8');
assert(/\bfunction\s+copyTextToClipboard\s*\(/.test(appSource),'app.js must define copyTextToClipboard for studio and ceremony copy actions.');
await access(new URL('404.html',root));
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
assert(manifest.name&&manifest.short_name&&Array.isArray(manifest.icons)&&manifest.icons.length>=2,'manifest.webmanifest must define name, short_name, and icons.');
for(const icon of manifest.icons)await access(new URL(String(icon.src||'').replace(/^\.\//,''),root));
for(const sc of manifest.shortcuts||[]){
  assert(sc.name&&sc.url,'Each manifest shortcut must define name and url.');
  for(const icon of sc.icons||[])await access(new URL(String(icon.src||'').replace(/^\.\//,''),root));
}
for(const cli of ['scripts/bump-version.mjs','scripts/optimize-photos.mjs','scripts/e2e-smoke.mjs']){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(cli,root))]);
}
console.log('Content, guest projection, 50 wedding tips, all 30 studios, 60 photographs, contacts, manifest, sw.js, 404 fallback, split CSS tokens, CLI tools, asset versions and JavaScript syntax verified.');
