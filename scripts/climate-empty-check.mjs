// Actual app; all added climate fixtures stay inside this isolated browser draft.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
try{
 await mkdir('work/climate-empty-qa',{recursive:true});
 const c=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('dialog',d=>d.accept());
 await p.goto(base+'#/honeymoon');await ready(p);await p.getByRole('button',{name:'여행지 추가',exact:true}).click();
 await p.getByLabel('여행지',{exact:true}).fill('점검용 새 후보');await p.getByLabel('한국 출발일',{exact:true}).fill('2027-06-06');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-06-13');await save(p);
 const card=p.locator('.travel-card').filter({has:p.getByRole('heading',{name:'점검용 새 후보',exact:true})});const id=await card.getAttribute('data-trip-id');
 const open=async()=>{for(const key of ['all','climate']){const node=p.locator(`[data-view-key="${id}:${key}"]`);if(!await node.evaluate(n=>n.open))await node.locator(':scope > summary').click();}};
 const climate=p.locator(`[data-view-key="${id}:climate"]`);
 const empty=async()=>{await open();const text=await climate.innerText();assert.match(text,/기후 자료 미입력/);assert(!text.includes('5월')&&!text.includes('null월')&&!text.includes('수정한 여행 월'));};
 await empty();assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('wedding:v1:draft')).honeymoon.find(t=>t.id===id).plan.climateMonth,id),null);
 await p.reload();await ready(p);await empty();
 await p.locator('[data-trip-id="bali"]').getByRole('button',{name:'비교 선택',exact:true}).click();await card.getByRole('button',{name:'비교 선택',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.travel-comparison thead th').length===3);
 const climateRow=p.locator('.travel-comparison tbody tr').filter({has:p.getByRole('rowheader',{name:'기후 유의점',exact:true})});assert.equal(await climateRow.locator('td').last().innerText(),'기후 자료 미입력');
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const backup=JSON.parse(await readFile(await (await pending).path(),'utf8'));
 const uploaded=async data=>{if(!await p.locator('dialog').evaluate(n=>n.open))await p.getByRole('button',{name:'내용 관리',exact:true}).click();await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'climate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>!document.querySelector('dialog').open);};
 await uploaded(backup);await empty();
 const legacy=structuredClone(backup),trip=legacy.honeymoon.find(t=>t.id===id);trip.plan.climateMonth=5;await uploaded(legacy);await empty();
 trip.plan.climateMonth=null;trip.plan.climate='점검용 기후 문구';trip.plan.sourceTitle='점검용 출처';trip.plan.sourceUrl='https://example.com/climate';await uploaded(legacy);await open();assert.match(await climate.innerText(),/기준 월이 입력되지 않았습니다/);assert.match(await climate.innerText(),/점검용 기후 문구/);assert(!(await climate.innerText()).includes('수정한 여행 월'));
 trip.plan.climateMonth=6;await uploaded(legacy);await open();assert.match(await climate.innerText(),/6월 기후 경향/);assert(!(await climate.innerText()).includes('수정한 여행 월'));
 await card.getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('한국 출발일',{exact:true}).fill('2027-07-06');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-07-13');await save(p);await open();assert.match(await climate.innerText(),/기후 안내는 6월 기준/);
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:390,height:844});await uploaded(backup);await empty();await card.screenshot({path:'work/climate-empty-qa/new-candidate-mobile.png'});
 await p.goto(base+'?view=guest#/honeymoon');await ready(p);assert.equal(await p.locator('.travel-card').count(),5);assert.equal(await p.getByRole('heading',{name:'점검용 새 후보',exact:true}).count(),0);
 const published=await p.request.get(new URL('data/site.json',base).href).then(r=>r.json());for(const item of published.honeymoon)assert.equal(item.plan.climateMonth,6);
 await p.goto(base+'?view=guest#/invitation');await ready(p);assert.match(await p.locator('.invitation-date').innerText(),/2027년 6월 5일.*15:00/);assert.equal(await p.locator('.invitation .message,.invitation-extra-guides,.invitation-contacts-box').count(),0);assert.equal(new URL(await p.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).getAttribute('href')).searchParams.get('dates'),'20270605T060000Z/20270605T060000Z');
 assert.deepEqual(errors,[]);console.log('PASS new/legacy empty climate, null-month JSON roundtrip/reload/comparison, preserved source and real month warnings, 320–1440px layouts, guest/public separation and blank optional invitation fields');await c.close();
}finally{await browser.close();}
