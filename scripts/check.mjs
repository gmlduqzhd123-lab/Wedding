import { readFile,access,readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parseContent } from '../assets/js/content.js';
const root=new URL('../',import.meta.url);
parseContent(await readFile(new URL('data/site.json',root),'utf8'));
const studios=JSON.parse(await readFile(new URL('data/studios.json',root),'utf8'));
assert.equal(studios.length,30,'Studio migration must preserve all 30 entries.');
assert.equal(new Set(studios.map(s=>s.id)).size,studios.length,'Studio IDs must be unique.');
assert.equal(studios.filter(s=>s.contact.phone).length,22,'Contact mappings must preserve the supplied list.');
for(const studio of studios){
  for(const field of ['name','style','pros','cons','fit','fee'])assert.equal(typeof studio[field],'string');
  assert.equal(studio.images.length,2);
  for(const image of studio.images)await access(new URL(image.src.replace(/^\.\//,''),root));
  if(studio.contact.phone)assert(/^[0-9-]+$/.test(studio.contact.phone));
}
const html=await readFile(new URL('index.html',root),'utf8');
for(const [,src]of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g))await access(new URL(src,root));
for(const name of await readdir(new URL('assets/js/',root)))if(name.endsWith('.js'))execFileSync(process.execPath,['--check',fileURLToPath(new URL('assets/js/'+name,root))]);
console.log('Content, all 30 studios, 60 photographs, contacts and JavaScript syntax verified.');
