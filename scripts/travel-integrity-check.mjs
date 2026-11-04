// Optional browser regression for complete stay dates, removed choices and source/reference separation.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[];
async function fresh(query='#/honeymoon'){
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+query);await page.locator('#main[aria-busy="false"]').waitFor();return {page,context};
}
const card=(p,id='bali')=>p.locator(`[data-trip-id="${id}"]`);
const edit=p=>card(p).getByRole('button',{name:'수정',exact:true}).click();
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const open=async(p,id,key)=>{const section=p.locator(`[data-view-key="${id}:${key}"]`);if(!await section.evaluate(n=>n.open))await section.locator(':scope > summary').click();};
const prefs=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')));
const download=async p=>{await p.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();return JSON.parse(await readFile(await (await pending).path(),'utf8'));};
const upload=async(p,data)=>{await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'site.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const localDates=async(p,rows)=>{for(const [i,start,end]of rows){await p.getByLabel(`현지 체크인 ${i}`,{exact:true}).fill(start);await p.getByLabel(`현지 체크아웃 ${i}`,{exact:true}).fill(end);}};
try{
  await mkdir('work/travel-integrity-qa',{recursive:true});
  const a=await fresh(),p=a.page;await edit(p);
  await localDates(p,[[1,'2027-05-09','2027-05-12'],[2,'2027-05-10','2027-05-14']]);
  assert.match(await p.locator('.editor-form > p[role="status"]').innerText(),/겹칩니다/);await save(p);
  assert.match(await card(p).locator(':scope > .stay-status').innerText(),/겹칩니다/);
  await card(p).getByRole('button',{name:'비교 선택',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.travel-comparison')?.textContent.includes('겹칩니다'));
  await edit(p);await localDates(p,[[1,'2030-05-09','2030-05-12'],[2,'2030-05-12','2030-05-16']]);await save(p);
  await p.reload();await card(p).waitFor();assert.match(await card(p).locator(':scope > .stay-status').innerText(),/날짜·연도/);
  const backup=await download(p);await upload(p,backup);assert.match(await card(p).locator(':scope > .stay-status').innerText(),/날짜·연도/);
  await edit(p);await p.getByRole('button',{name:'현재 날짜로 가안 기준 갱신',exact:true}).click();await save(p);assert.match(await card(p).locator(':scope > .stay-status').innerText(),/날짜·연도/);
  await edit(p);await localDates(p,[[1,'2027-05-09','2027-05-12'],[2,'2027-05-13','2027-05-16']]);await save(p);assert.match(await card(p).locator(':scope > .stay-status').innerText(),/기록되지 않은 기간/);
  await edit(p);await p.locator('.stay-edit-row').nth(1).getByRole('button',{name:'앞으로',exact:true}).click();assert.match(await p.locator('.editor-form > p[role="status"]').innerText(),/입력 순서/);await p.getByRole('button',{name:'취소',exact:true}).click();
  await edit(p);await localDates(p,[[1,'2027-05-09','2027-05-12'],[2,'2027-05-12','2027-05-16']]);await save(p);assert(!await card(p).locator(':scope > .stay-status').evaluate(n=>n.classList.contains('warning')));
  await edit(p);await localDates(p,[[1,'2027-05-09','2027-05-12'],[2,'2027-05-10','2027-05-14']]);await p.setViewportSize({width:320,height:700});
  await p.getByLabel('숙박 지역 2',{exact:true}).scrollIntoViewIfNeeded();assert(await p.evaluate(()=>document.querySelector('#editor-body').scrollWidth<=document.querySelector('#editor-body').clientWidth));await p.screenshot({path:'work/travel-integrity-qa/editor-mobile.png'});
  await p.getByRole('button',{name:'취소',exact:true}).click();
  await edit(p);await localDates(p,[[1,'2027-05-14','2027-05-16'],[2,'','']]);
  await p.getByRole('button',{name:'숙박 추가',exact:true}).click();await p.getByLabel('숙박 지역 3',{exact:true}).fill('세 번째 숙박');await localDates(p,[[3,'2027-05-09','2027-05-10']]);
  assert.match(await p.locator('.editor-form > p[role="status"]').innerText(),/1→3/);await save(p);
  assert.match(await card(p).locator(':scope > .stay-status').innerText(),/1→3/);assert.match(await p.locator('.travel-comparison').innerText(),/1→3/);
  await p.reload();await card(p).waitFor();assert.match(await card(p).locator(':scope > .stay-status').innerText(),/1→3/);
  const partialBackup=await download(p);await upload(p,partialBackup);assert.match(await card(p).locator(':scope > .stay-status').innerText(),/1→3/);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:draft')).honeymoon[0].plan.stays[1].checkIn),'');
  await a.context.close();console.log('PASS full and partial-date stay warnings across editor/cards/comparison, reload/import and mobile layout');

  const b=await fresh(),q=b.page;
  for(const id of ['bali','hawaii']){await card(q,id).getByRole('button',{name:'비교 선택',exact:true}).click();await q.waitForFunction(id=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes(id),id);}
  await card(q).getByRole('button',{name:'관심 여행지',exact:true}).click();await card(q).getByRole('button',{name:'최종 선택',exact:true}).click();
  for(const id of ['bali','hawaii']){await card(q,id).getByRole('button',{name:'삭제',exact:true}).click();await card(q,id).waitFor({state:'detached'});await q.waitForFunction(id=>!JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes(id),id);}
  assert.equal((await prefs(q)).tripSelected,undefined);assert.deepEqual((await prefs(q)).tripFavorites,[]);
  await card(q,'italy').getByRole('button',{name:'비교 선택',exact:true}).click();await q.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes('italy'));
  // A restored old backup may contain two vanished IDs: these must not consume comparison slots.
  await q.evaluate(()=>{const p=JSON.parse(localStorage.getItem('wedding:v1:preferences'));p.tripCompare=['bali','hawaii'];localStorage.setItem('wedding:v1:preferences',JSON.stringify(p));});await q.reload();await card(q,'italy').waitFor();
  await card(q,'italy').getByRole('button',{name:'비교 선택',exact:true}).click();await q.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes('italy'));assert.deepEqual((await prefs(q)).tripCompare,['italy']);
  await card(q,'spain').getByRole('button',{name:'비교 선택',exact:true}).click();await q.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes('spain'));
  await q.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wedding:v1:preferences')throw new DOMException('quota','QuotaExceededError');return window.savedSetItem.call(this,key,value);};});
  await card(q,'italy').getByRole('button',{name:'삭제',exact:true}).click();await card(q,'italy').waitFor({state:'detached'});await q.waitForFunction(()=>document.querySelector('#toast').textContent.includes('저장하지 못했습니다'));
  await q.evaluate(()=>Storage.prototype.setItem=window.savedSetItem);await card(q,'maldives').getByRole('button',{name:'비교 선택',exact:true}).click();await q.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripCompare.includes('maldives'));
  assert.deepEqual((await prefs(q)).tripCompare,['spain','maldives']);await b.context.close();console.log('PASS deletion cleans choices, restored missing IDs and failed cleanup cannot block new comparison');

  const c=await fresh(),r=c.page;const publicContent=await r.request.get(new URL('data/site.json',base).href).then(res=>res.json());const sourceUrl=publicContent.honeymoon[0].plan.sourceUrl;
  await edit(r);await r.getByLabel('참고 링크',{exact:true}).fill('https://example.com/personal-note');await save(r);await open(r,'bali','all');await open(r,'bali','climate');await open(r,'bali','memo');
  assert.equal(await card(r).getByRole('link',{name:'기후 공식 안내 ↗',exact:true}).getAttribute('href'),sourceUrl);
  assert.equal(await card(r).getByRole('link',{name:'직접 입력한 참고 링크 ↗',exact:true}).getAttribute('href'),'https://example.com/personal-note');
  await r.reload();await card(r).waitFor();const exported=await download(r);assert.equal(exported.honeymoon[0].plan.sourceUrl,sourceUrl);assert.equal(exported.honeymoon[0].url,'https://example.com/personal-note');await upload(r,exported);
  const legacy=structuredClone(exported);delete legacy.honeymoon[0].plan.sourceUrl;await r.getByRole('button',{name:'내용 관리',exact:true}).click();await upload(r,legacy);
  await open(r,'bali','all');await open(r,'bali','climate');await open(r,'bali','memo');assert.equal(await card(r).getByRole('link',{name:'기후 공식 안내 ↗',exact:true}).count(),0);
  assert.equal(await card(r).getByRole('link',{name:'직접 입력한 참고 링크 ↗',exact:true}).getAttribute('href'),'https://example.com/personal-note');await c.context.close();console.log('PASS personal reference edits preserve official source and dates, JSON roundtrip and safe legacy source fallback');

  const d=await fresh('?view=guest#/invitation'),s=d.page;
  assert.match(await s.locator('.invitation-date').innerText(),/2027년 5월 8일.*13:00/);assert.match(await s.locator('.place').innerText(),/순천아모르웨딩컨벤션 1층/);
  assert.equal(await s.locator('.couple-names,.invitation .message,.place p').count(),0);assert.equal(await s.getByRole('link',{name:'오시는 길 ↗',exact:true}).count(),0);
  await s.screenshot({path:'work/travel-integrity-qa/invitation.png',fullPage:true});await s.goto(base+'?view=guest#/honeymoon');await card(s,'spain').waitFor();await open(s,'spain','all');await open(s,'spain','stays');
  assert.match(await s.locator('[data-view-key="spain:stays"]').innerText(),/바르셀로나 1박 → 마요르카 3박 → 바르셀로나 3박 · 총 7박/);
  assert.equal(await s.locator('.trip-controls,#selected-trip-region').count(),0);
  for(const width of [320,390,768,1440]){await s.setViewportSize({width,height:950});assert(await s.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await s.setViewportSize({width:390,height:844});await card(s,'spain').scrollIntoViewIfNeeded();await s.screenshot({path:'work/travel-integrity-qa/spain.png',fullPage:true});await d.context.close();
  assert.deepEqual(errors,[]);console.log('PASS public ordered Spain stays, blank unknown invitation fields, guest isolation, 320–1440px layout and zero browser errors');
}finally{await browser.close();}
