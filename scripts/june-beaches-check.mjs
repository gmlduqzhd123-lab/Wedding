// Actual local or deployed content: no route interception or fixture substitution.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateContent} from '../assets/js/content.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const expected=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const card=(p,id='bali')=>p.locator(`[data-trip-id="${id}"]`);
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const open=async(p,id,key)=>{const d=p.locator(`[data-view-key="${id}:${key}"]`);if(!await d.evaluate(n=>n.open))await d.locator(':scope > summary').click();};
try{
  await mkdir('work/june-beaches-qa',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('dialog',d=>d.accept());
  const response=await p.request.get(new URL('data/site.json?qa='+Date.now(),base).href);assert(response.ok());assert.deepEqual(await response.json(),expected);
  await p.goto(base+'#/honeymoon');await ready(p);
  assert.equal(await p.locator('.travel-card').count(),10);assert.equal(await p.locator('.travel-overview li').count(),10);
  for(const trip of expected.honeymoon){
    const c=card(p,trip.id);assert.equal(await c.locator('h2').innerText(),trip.title);
    assert.match(await c.locator(':scope > dl').innerText(),/2027-06-06[\s\S]*2027-06-13/);
    assert((await c.locator(':scope > dl').innerText()).includes(trip.budget.toLocaleString('ko-KR')+'원'));
    assert.equal(await c.locator(':scope > .stay-status.warning').count(),0);
    await open(p,trip.id,'all');await open(p,trip.id,'climate');await open(p,trip.id,'costs');await open(p,trip.id,'sources');
    assert.equal(await c.getByRole('link',{name:'기후 공식 안내 ↗',exact:true}).getAttribute('href'),trip.plan.sourceUrl);
    const sources=p.locator(`[data-view-key="${trip.id}:sources"]`);
    assert((await sources.innerText()).includes(trip.plan.researchNotes));assert(!(await sources.innerText()).includes('사용자 제공 Honeymoon_2027_PRD'));
    for(const ref of trip.plan.references){const link=sources.getByRole('link',{name:ref.title+' ↗',exact:true});assert.equal(await link.getAttribute('href'),ref.url);assert.equal(await link.getAttribute('target'),'_blank');}
  }
  assert.match(await p.locator('.honeymoon-note').innerText(),/성인 2명.*인천.*일반석.*객실 1실/);
  assert.match(await p.locator('.honeymoon-note').innerText(),/확정 견적은 아닙니다/);
  for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`fits ${width}`);}
  await p.setViewportSize({width:1440,height:1000});await p.locator('.travel-overview').screenshot({path:'work/june-beaches-qa/overview-desktop.png'});
  await p.setViewportSize({width:390,height:844});await p.locator('.travel-overview').screenshot({path:'work/june-beaches-qa/overview-mobile.png'});
  await p.locator('.overview-disclosure > summary').click();await p.locator('.travel-overview').getByRole('button',{name:expected.honeymoon.at(-1).title,exact:true}).click();
  assert.equal(await p.evaluate(()=>document.activeElement.textContent),expected.honeymoon.at(-1).title);assert.equal(new URL(p.url()).hash,'#/honeymoon');
  console.log('PASS actual 10 June candidates, confirmed conditions, budgets, climate/provenance links, overview navigation and 320–1440px layouts');

  for(const id of ['bali','nhatrang']){await card(p,id).getByRole('button',{name:'비교 선택',exact:true}).click();await p.waitForFunction(id=>JSON.parse(localStorage.getItem('wedding:v1:preferences'))?.tripCompare?.includes(id),id);}
  const comparison=await p.locator('.travel-comparison').innerText();for(const trip of expected.honeymoon.slice(0,2))assert(comparison.includes(trip.budget.toLocaleString('ko-KR')+'원'));assert(comparison.includes('6월 기준'));assert(!comparison.includes('5월 기준'));
  await card(p).getByRole('button',{name:'최종 선택',exact:true}).click();await p.locator('.selected-trip').waitFor();
  await card(p).getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('일정·상담 메모',{exact:true}).fill('이번 기기에서만 저장한 검증 메모');await save(p);
  await p.reload();await ready(p);assert((await p.locator('.selected-trip').innerText()).includes(expected.honeymoon[0].budget.toLocaleString('ko-KR')+'원'));
  await p.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const backup=JSON.parse(await readFile(await (await pending).path(),'utf8'));
  assert.deepEqual(backup.honeymoon[0].plan,validateContent(expected).honeymoon[0].plan);assert.equal(backup.honeymoon[0].body,'이번 기기에서만 저장한 검증 메모');assert(!JSON.stringify(backup).includes('tripSelected'));
  await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'june-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await p.waitForFunction(()=>!document.querySelector('dialog').open);
  await open(p,'bali','all');await open(p,'bali','sources');assert.match(await p.locator('[data-view-key="bali:sources"]').innerText(),/2026-11-09 항공·숙박 날짜 지정 조회/);
  await p.goto(base+'?view=guest#/honeymoon');await ready(p);assert.equal(await p.locator('.travel-card').count(),10);assert.equal(await p.locator('.trip-controls,#selected-trip-region').count(),0);assert(!(await p.locator('#main').innerText()).includes('이번 기기에서만 저장한 검증 메모'));
  await p.reload();await ready(p);assert.equal(await p.locator('.travel-card').count(),10);
  for(const route of ['home','invitation','story','albums','studios','honeymoon']){await p.locator(`[data-route="${route}"]`).click();await ready(p);assert.equal(new URL(p.url()).hash,'#/'+route);}
  await p.goto(base+'?view=guest#/invitation');await ready(p);assert.match(await p.locator('.invitation-date').innerText(),/2027년 6월 5일.*15:00/);assert.equal(await p.locator('.couple-names,.invitation .message,.place p').count(),0);
  await p.goto(base+'#/honeymoon');await ready(p);await p.getByRole('button',{name:'내용 관리',exact:true}).click();await p.getByRole('button',{name:'공개본으로 돌아가기',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);
  assert.equal(await p.evaluate(()=>localStorage.getItem('wedding:v1:draft')),null);await open(p,'bali','all');await open(p,'bali','sources');assert.match(await p.locator('[data-view-key="bali:sources"]').innerText(),/최종 요금은 확인되지/);
  assert.deepEqual(errors,[]);console.log('PASS actual candidate comparison, local draft reload/export/import/reset, guest isolation, menus/refresh and blank invitation fields; zero console/page errors');
  await context.close();
}finally{await browser.close();}
