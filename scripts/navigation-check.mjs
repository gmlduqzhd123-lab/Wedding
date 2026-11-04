// Optional browser regressions for keyboard navigation, reference popups and legacy link-only plans.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[];
async function fresh(query='#/honeymoon'){
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+query);await page.locator('#main[aria-busy="false"]').waitFor();return {page,context};
}
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const card=p=>p.locator('[data-trip-id="bali"]');
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const skip=async p=>{
  const before={url:p.url(),history:await p.evaluate(()=>history.length)};
  await p.locator('.skip-link').focus();await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'main');assert.equal(p.url(),before.url);assert.equal(await p.evaluate(()=>history.length),before.history);
};
const upload=async(p,data)=>{await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>!document.querySelector('dialog').open);};
try{
  await mkdir('work/navigation-qa',{recursive:true});
  const a=await fresh(),p=a.page;
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.className),'skip-link');await skip(p);
  await card(p).getByRole('button',{name:'비교 선택',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-trip-id="bali"] [data-trip-action="tripCompare"]').getAttribute('aria-pressed')==='true');
  assert.equal(await p.locator('.travel-comparison').count(),1);await p.reload();await ready(p);assert.equal(await p.locator('[aria-current="page"]').getAttribute('data-route'),'honeymoon');
  await p.locator('[data-route="invitation"]').click();await skip(p);await p.goBack();await ready(p);assert.equal(await p.locator('[aria-current="page"]').getAttribute('data-route'),'honeymoon');
  await a.context.close();
  const guest=await fresh('?view=guest#/honeymoon');await skip(guest.page);await guest.page.reload();await ready(guest.page);assert.equal(await guest.page.locator('[aria-current="page"]').getAttribute('data-route'),'honeymoon');await guest.context.close();
  console.log('PASS keyboard skip retains route/history, focus, live comparison and reload/back navigation in normal and guest views');

  const b=await fresh(),q=b.page,dialogs=[];
  q.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  const published=await q.request.get(new URL('data/site.json',base).href).then(r=>r.json());const sourceUrl=published.honeymoon[0].plan.sourceUrl;
  await b.context.route(sourceUrl,route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Reference preview</title>'}));
  await card(q).getByRole('button',{name:'수정',exact:true}).click();await q.getByLabel('일정·상담 메모',{exact:true}).fill('출처를 확인하면서 작성한 메모');
  const popup=q.waitForEvent('popup');await q.locator('dialog').getByRole('link',{name:'기후 공식 안내 ↗',exact:true}).click();const source=await popup;await source.waitForLoadState();
  assert.equal(source.url(),sourceUrl);assert.deepEqual(dialogs,[]);assert(await q.locator('dialog').evaluate(n=>n.open));assert.equal(await q.getByLabel('일정·상담 메모',{exact:true}).inputValue(),'출처를 확인하면서 작성한 메모');await source.close();
  await q.keyboard.press('Escape');assert.equal(dialogs.length,1);assert.match(dialogs[0],/저장하지 않은 입력/);assert(await q.locator('dialog').evaluate(n=>n.open));
  await q.screenshot({path:'work/navigation-qa/editor-preserved.png'});await save(q);await q.reload();await ready(q);
  assert.equal(await q.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:draft')).honeymoon[0].body),'출처를 확인하면서 작성한 메모');await b.context.close();
  console.log('PASS source opens separately without discard prompts and keeps dirty editor; close guard and save/reload still protect notes');

  const c=await fresh(),r=c.page;r.on('dialog',d=>d.accept());
  const data=structuredClone(published);data.honeymoon=[{...data.honeymoon[0],title:'이전 형식 후보',body:'',url:'https://example.com/trip-reference'}];delete data.honeymoon[0].plan;
  await r.getByRole('button',{name:'내용 관리',exact:true}).click();await upload(r,data);
  const open=async()=>{const details=card(r).locator('.travel-details');if(!await details.evaluate(n=>n.open))await details.locator(':scope > summary').click();};
  await open();assert.equal(await card(r).getByRole('link',{name:'직접 입력한 참고 링크 ↗',exact:true}).getAttribute('href'),data.honeymoon[0].url);assert.equal(await card(r).locator('.record-body').count(),0);
  await r.reload();await ready(r);await open();assert.equal(await card(r).getByRole('link',{name:'직접 입력한 참고 링크 ↗',exact:true}).count(),1);
  await r.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=r.waitForEvent('download');await r.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const backup=JSON.parse(await readFile(await (await pending).path(),'utf8'));assert.equal(backup.honeymoon[0].url,data.honeymoon[0].url);await upload(r,backup);await open();
  for(const width of [320,390,768,1440]){await r.setViewportSize({width,height:900});assert(await r.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await r.setViewportSize({width:390,height:844});await r.screenshot({path:'work/navigation-qa/legacy-link.png',fullPage:true});
  await r.getByRole('button',{name:'내용 관리',exact:true}).click();await r.getByRole('button',{name:'공개본으로 돌아가기',exact:true}).click();await r.waitForFunction(()=>!document.querySelector('dialog').open);
  assert.equal(await r.evaluate(()=>localStorage.getItem('wedding:v1:draft')),null);
  await r.goto(base+'?view=guest#/invitation');await ready(r);assert.match(await r.locator('.invitation-date').innerText(),/2027년 5월 8일.*13:00/);assert.match(await r.locator('.place').innerText(),/순천아모르웨딩컨벤션 1층/);
  assert.equal(await r.locator('.couple-names,.invitation .message,.place p').count(),0);assert.equal(await r.getByRole('link',{name:'오시는 길 ↗',exact:true}).count(),0);await c.context.close();
  console.log('PASS legacy link-only import/render/reload/export/reset, responsive layouts, confirmed invitation and blank missing fields');
  const d=await fresh(),s=d.page;s.on('dialog',d=>d.accept());
  const focusedId=()=>s.evaluate(()=>document.activeElement.closest('[data-trip-id]')?.dataset.tripId);
  await card(s).getByRole('button',{name:'수정',exact:true}).click();await s.getByLabel('일정·상담 메모',{exact:true}).fill('저장 후 초점 검증');await save(s);
  assert.equal(await focusedId(),'bali');assert.equal(await s.evaluate(()=>document.activeElement.tagName),'H2');
  await s.keyboard.press('Tab');assert.equal(await focusedId(),'bali');
  const remove=async id=>{await s.locator(`[data-trip-id="${id}"]`).getByRole('button',{name:'삭제',exact:true}).click();await s.locator(`[data-trip-id="${id}"]`).waitFor({state:'detached'});await s.waitForFunction(()=>document.querySelector('#toast').textContent.includes('삭제했습니다'));};
  await remove('hawaii');assert.equal(await focusedId(),'italy','middle deletion focuses the following candidate');
  await remove('maldives');assert.equal(await focusedId(),'spain','last deletion focuses the preceding candidate');
  await remove('bali');assert.equal(await focusedId(),'italy');await s.keyboard.press('Tab');assert.equal(await focusedId(),'italy');
  await remove('italy');assert.equal(await focusedId(),'spain');await remove('spain');
  assert.equal(await s.evaluate(()=>document.activeElement.textContent),'여행지 추가');
  await s.keyboard.press('Enter');await s.getByLabel('여행지',{exact:true}).fill('새 후보 초점 검증');await save(s);
  assert.equal(await s.evaluate(()=>document.activeElement.textContent),'새 후보 초점 검증');
  assert(await s.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await s.keyboard.press('Tab');assert.equal(await focusedId(),await s.locator('[data-trip-id]').getAttribute('data-trip-id'));
  await s.screenshot({path:'work/navigation-qa/focus-after-save.png',fullPage:true});await d.context.close();
  assert.deepEqual(errors,[]);console.log('PASS save/add focus, next/previous/empty deletion focus and Tab continuation, zero browser errors');
}finally{await browser.close();}
