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
for(const [,src]of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g))await access(new URL(src,root));
for(const name of await readdir(new URL('assets/js/',root)))if(name.endsWith('.js'))execFileSync(process.execPath,['--check',fileURLToPath(new URL('assets/js/'+name,root))]);
console.log('Content, 50 wedding tips, all 30 studios, 60 photographs, contacts and JavaScript syntax verified.');
