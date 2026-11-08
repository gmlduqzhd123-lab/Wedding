// Actual app; synthetic quotes/deletions remain inside isolated browser drafts.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const card=(p,id='bali')=>p.locator(`[data-trip-id="${id}"]`);
async function fresh(width=390){const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());await page.goto(base+'#/honeymoon');await ready(page);return {context,page};}
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const open=async(p,key)=>{const node=p.locator(`[data-view-key="bali:${key}"]`);if(!await node.evaluate(n=>n.open))await node.locator(':scope > summary').click();};
try{
 await mkdir('work/quote-focus-qa',{recursive:true});
 const a=await fresh(320),p=a.page;
 await card(p).getByRole('button',{name:'수정',exact:true}).click();await p.locator('.quote-editor > summary').click();await p.getByLabel('항공 실제 견적 (원)',{exact:true}).fill('12000000');await save(p);
 const status=async()=>card(p).locator(':scope > .quote-status').innerText();
 assert.match(await status(),/입력 견적 소계 12,000,000원/);assert.match(await status(),/12,800,000원/);assert.match(await status(),/상한 2,800,000원 초과/);assert.match(await status(),/미확인/);assert(await card(p).locator(':scope > .quote-status').evaluate(n=>n.classList.contains('warning')));
 for(const label of ['최종 선택','비교 선택'])await card(p).getByRole('button',{name:label,exact:true}).click();
 await p.locator('.selected-trip').waitFor();await p.locator('.travel-comparison').waitFor();
 assert.match(await p.locator('.selected-trip .quote-status').innerText(),/2,800,000원 초과/);assert.match(await p.locator('.travel-comparison').innerText(),/2,800,000원 초과/);
 await open(p,'all');await open(p,'quote');assert.match(await p.locator('.quote-breakdown').first().innerText(),/입력 견적 소계\n12,000,000원/);assert.match(await p.locator('.quote-breakdown').first().innerText(),/확인 조건을 갖춘 합계\n미확인/);
 await p.reload();await ready(p);assert.match(await status(),/2,800,000원 초과/);
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const raw=await readFile(await (await pending).path(),'utf8');assert.equal(JSON.parse(raw).honeymoon[0].plan.quote.costs.airfare,12000000);
 await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'partial-quote.json',mimeType:'application/json',buffer:Buffer.from(raw)});await p.waitForFunction(()=>!document.querySelector('dialog').open);assert.match(await status(),/2,800,000원 초과/);
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:390,height:900});await card(p).screenshot({path:'work/quote-focus-qa/partial-quote.png'});
 await card(p).getByRole('button',{name:'수정',exact:true}).click();await p.locator('.quote-editor > summary').click();await p.getByLabel('항공 실제 견적 (원)',{exact:true}).fill('0');await save(p);assert.match(await status(),/입력 견적 소계 0원/);assert(!await card(p).locator(':scope > .quote-status').evaluate(n=>n.classList.contains('warning')));assert(!(await status()).includes('상한 이내'));
 await p.goto(base+'?view=guest#/honeymoon');await ready(p);assert(!(await card(p).locator(':scope > .quote-status').innerText()).includes('12,000,000원'));
 await p.goto(base+'?view=guest#/invitation');await ready(p);assert.match(await p.locator('.invitation-date').innerText(),/2027년 6월 5일.*15:00/);assert.equal(await p.locator('.couple-names,.invitation .message,.place p').count(),0);assert.equal(new URL(await p.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).getAttribute('href')).searchParams.get('dates'),'20270605T060000Z/20270605T060000Z');await a.context.close();
 console.log('PASS partial quote subtotal/reserve/excess in card, selected summary and comparison; reload/JSON/zero/guest boundaries and 320–1440px layouts');
 for(const sort of ['budget-low','budget-high','recommended']){
   const b=await fresh(),q=b.page;await q.getByRole('combobox',{name:'여행 후보 정렬',exact:true}).selectOption(sort);
   const ids=()=>q.locator('.travel-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.tripId));
   for(const index of [2,-1,0]){
     const before=await ids(),i=index<0?before.length+index:index,id=before[i],expected=before[i+1]||before[i-1];
     await card(q,id).getByRole('button',{name:'삭제',exact:true}).click();await card(q,id).waitFor({state:'detached'});await q.waitForFunction(id=>document.activeElement.closest('[data-trip-id]')?.dataset.tripId===id,expected);
     assert.equal(await q.evaluate(()=>document.activeElement.tagName),'H2');assert.equal(await q.getByRole('combobox',{name:'여행 후보 정렬',exact:true}).inputValue(),sort);
     const bounds=await q.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
     assert(bounds.top>=-1&&bounds.bottom<=bounds.height+1,JSON.stringify({sort,id,expected,bounds}));
     await q.keyboard.press('Tab');assert.equal(await q.evaluate(()=>document.activeElement.closest('[data-trip-id]')?.dataset.tripId),expected);
   }
   await q.screenshot({path:`work/quote-focus-qa/${sort}.png`});await b.context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS next/previous focus follows displayed order for ascending, descending, default sorting, middle/last/first deletion and keyboard continuation; zero browser errors');
}finally{await browser.close();}
