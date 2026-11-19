import { readFile,access,readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parseContent } from '../assets/js/content.js';
const root=new URL('../',import.meta.url);
const site=parseContent(await readFile(new URL('data/site.json',root),'utf8'));
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
for(const [,src]of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)){
  await access(new URL(src,root));
  if(/\.(?:css|js)(?:\?|$)/.test(src)){
    const ver=new URL(src,'https://example.invalid/').searchParams.get('v');
    assert(ver,`Missing ?v= cache version on ${src} in index.html`);
    versions.add(ver);
  }
}
for(const name of await readdir(new URL('assets/js/',root))){
  if(!name.endsWith('.js'))continue;
  const fileUrl=new URL('assets/js/'+name,root);
  execFileSync(process.execPath,['--check',fileURLToPath(fileUrl)]);
  const source=await readFile(fileUrl,'utf8');
  for(const [,spec]of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){
    const ver=new URL(spec,'https://example.invalid/').searchParams.get('v');
    assert(ver,`Missing ?v= cache version on ${spec} in assets/js/${name}`);
    versions.add(ver);
  }
}
for(const [,imgUrl]of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g)){
  const ver=new URL(imgUrl).searchParams.get('v');
  assert(ver,`Missing ?v= cache version on share image ${imgUrl} in index.html`);
  versions.add(ver);
}
const sharingSource=await readFile(new URL('assets/js/sharing.js',root),'utf8');
const shareConstMatch=sharingSource.match(/SHARE_IMAGE_URL=['"]([^'"]+)['"]/);
assert(shareConstMatch,'sharing.js must export SHARE_IMAGE_URL');
versions.add(new URL(shareConstMatch[1]).searchParams.get('v'));
assert.equal(versions.size,1,`Expected a single uniform asset ?v= version across index.html, share-card, and assets/js/*.js, found: ${[...versions].join(', ')}`);
const css=await readFile(new URL('assets/css/app.css',root),'utf8');
const definedCssVars=new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m=>m[1]));
const undefinedCssVars=[...new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(m=>m[1]))].filter(v=>!definedCssVars.has(v));
assert.deepEqual(undefinedCssVars,[],`Undefined CSS custom properties in assets/css/app.css: ${undefinedCssVars.join(', ')}`);
const appSource=await readFile(new URL('assets/js/app.js',root),'utf8');
assert(/\bfunction\s+copyTextToClipboard\s*\(/.test(appSource),'app.js must define copyTextToClipboard for studio and ceremony copy actions.');
await access(new URL('404.html',root));
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
assert(manifest.name&&manifest.short_name&&Array.isArray(manifest.icons)&&manifest.icons.length>=2,'manifest.webmanifest must define name, short_name, and icons.');
for(const icon of manifest.icons)await access(new URL(String(icon.src||'').replace(/^\.\//,''),root));
console.log('Content, 50 wedding tips, all 30 studios, 60 photographs, contacts, manifest, 404 fallback, CSS tokens, asset versions and JavaScript syntax verified.');
