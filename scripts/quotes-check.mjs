// Actual served content; no mocked routes or replacement public data.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const data=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const open=async(p,id,key)=>{const node=p.locator(`[data-view-key="${id}:${key}"]`);if(!await node.evaluate(n=>n.open))await node.locator(':scope > summary').click();};
try{
 await mkdir('work/quotes-qa',{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(base+'?view=guest#/honeymoon');await p.locator('#main[aria-busy="false"]').waitFor();
 assert.equal(await p.locator('.travel-card').count(),10);
 for(const trip of data.honeymoon){
  const c=p.locator(`[data-trip-id="${trip.id}"]`),q=trip.plan.quote;
  for(const key of ['all','quote','stays','costs','sources'])await open(p,trip.id,key);
  const quote=p.locator(`[data-view-key="${trip.id}:quote"]`),text=await quote.innerText();
  assert(text.includes(q.flightSource));assert(text.includes(q.lodgingSource));assert(text.includes(q.arrivalAt.replace('T',' ')));
  assert(text.includes((q.costs.airfare+q.costs.lodging).toLocaleString('ko-KR')+'원'));
  assert.match(text,/실제 예산 충족 미확인/);assert(!text.includes('상한 이내 (입력 근거'));
  const stay=trip.plan.stays[0],stayText=await p.locator(`[data-view-key="${trip.id}:stays"]`).innerText();
  assert(stayText.includes(`현지 체크인 ${stay.checkIn} → 체크아웃 ${stay.checkOut} · ${stay.nights}박`));
  assert((await p.locator(`[data-view-key="${trip.id}:costs"]`).innerText()).replace(/\s+/g,' ').includes(trip.plan.budgetNotes.replace(/\s+/g,' ')),trip.id+' cost research rendered');
  assert.match(await c.locator('.plan-reference').first().innerText(),/직접 작성한 문장의 날짜·금액·박 수는 자동 갱신되지 않습니다/);
  for(const r of trip.plan.references)assert.equal(await c.getByRole('link',{name:r.title+' ↗',exact:true}).getAttribute('href'),r.url);
 }
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal overflow at ${width}`);}
 await p.setViewportSize({width:390,height:900});await p.locator('[data-trip-id="bali"]').screenshot({path:'work/quotes-qa/bali-mobile.png'});
 await p.setViewportSize({width:1440,height:1000});await p.locator('[data-view-key="bali:quote"]').screenshot({path:'work/quotes-qa/bali-quote-desktop.png'});
 await p.goto(base+'?view=guest#/invitation');await p.locator('#main[aria-busy="false"]').waitFor();
 assert.match(await p.locator('.invitation-date').innerText(),/2027년 6월 5일.*15:00/);assert.equal(await p.locator('.couple-names,.invitation .message,.place p').count(),0);
 assert.equal(new URL(await p.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).getAttribute('href')).searchParams.get('dates'),'20270605T060000Z/20270605T060000Z');
 const download=p.waitForEvent('download');await p.getByRole('button',{name:'일정 파일(.ics) 다운로드',exact:true}).click();const ics=(await readFile(await(await download).path(),'utf8')).replace(/\r\n /g,'');
 assert.match(ics,/DTSTART:20270605T060000Z/);assert(!ics.includes('DTEND:'));
 assert.deepEqual(errors,[]);console.log('PASS actual 10 dated flight/room quotes, June 13 Korean arrivals, local nights, price breakdowns/source links, incomplete-cost boundaries, 320–1440px layouts, blank invitation and Google/ICS payload; zero browser errors');
 await context.close();
}finally{await browser.close();}
