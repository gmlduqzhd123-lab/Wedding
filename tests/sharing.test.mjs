import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shareMetadata,applyShareMetadata} from '../assets/js/sharing.js';
const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
test('sharing metadata uses supplied public fields and escapes HTML attributes',async()=>{
  const content=structuredClone(original);
  assert.equal(shareMetadata(content).title,'우리의 결혼 기록');
  content.invitation.partner1='우리 " <둘>';content.invitation.venue='공개 장소';
  const html=applyShareMetadata(await readFile(new URL('../index.html',import.meta.url),'utf8'),content);
  assert(html.includes('우리 &quot; &lt;둘&gt;'));assert(html.includes('공개 장소'));
  assert(!html.includes('content="우리 " <둘>'));
  assert(shareMetadata(content).url.includes('view=guest'));
});
