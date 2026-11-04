// Optional development check. Requires Playwright outside the shipped app and a running npm run dev.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/Wedding/';
const browser = await chromium.launch({headless:true, channel:process.env.BROWSER_CHANNEL || 'chrome'});
const context = await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('dialog',dialog=>dialog.accept());
const ready=()=>page.locator('#main[aria-busy="false"]').waitFor();
const go=async(route)=>{await page.goto(base+'#/'+route);await ready();};
const storage=key=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const prefsKey='wedding:v1:preferences',draftKey='wedding:v1:draft';
const download=async(label)=>{
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();
  const result=await pending;return readFile(await result.path(),'utf8');
};
const upload=async(label,value)=>page.getByLabel(label,{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
try {
  await go('home');
  for(const route of ['invitation','story','albums','studios','honeymoon','home']){
    await page.locator(`[data-route="${route}"]`).click();
    await page.waitForFunction(route=>document.querySelector(`[data-route="${route}"]`).getAttribute('aria-current')==='page',route);
    assert.equal(await page.locator('h1').count(),1);
  }
  await go('invitation');
  await page.getByRole('button',{name:'예식 정보 편집',exact:true}).click();
  await page.getByLabel('첫 번째 이름',{exact:true}).fill('브라우저 검증');
  await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  await page.reload();await ready();
  assert.equal((await storage(draftKey)).invitation.partner1,'브라우저 검증');
  assert.match(await page.locator('#draft-banner').innerText(),/이 기기에 저장한 초안/);
  console.log('PASS menus, draft save and reload');

  await go('studios');
  await page.locator('.compare-card .favorite').first().click();
  await page.locator('.compare-card textarea').first().fill('백업할 개인 메모');
  const savedPrefs=await storage(prefsKey);
  await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
  await page.locator('.compare-card .favorite').first().click();
  assert.equal(await page.locator('.compare-card .favorite').first().getAttribute('aria-pressed'),'true');
  await page.locator('.compare-card textarea').first().fill('실패할 변경');
  assert.equal(await page.locator('.compare-card textarea').first().inputValue(),'백업할 개인 메모');
  const leftBefore=await page.getByLabel('비교할 스튜디오 A',{exact:true}).inputValue();
  await page.getByLabel('비교할 스튜디오 A',{exact:true}).selectOption('studio-01');
  assert.equal(await page.getByLabel('비교할 스튜디오 A',{exact:true}).inputValue(),leftBefore);
  assert.deepEqual(await storage(prefsKey),savedPrefs);
  await page.locator('[data-route="invitation"]').click();
  await page.getByRole('button',{name:'예식 정보 편집',exact:true}).click();
  await page.getByLabel('첫 번째 이름',{exact:true}).fill('저장 실패 검증');
  await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  assert.equal((await storage(draftKey)).invitation.partner1,'브라우저 검증');
  assert(await page.locator('dialog').evaluate(node=>node.open));
  await page.keyboard.press('Escape');
  await page.locator('[data-route="studios"]').click();
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});
  await page.locator('.photo-open').first().click();
  await page.getByRole('button',{name:'다음 사진',exact:true}).click();
  assert.match(await page.locator('.photo-viewer').innerText(),/2 \/ 2/);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'내용 관리',exact:true}).click();
  const privateRaw=await download('개인 백업 저장');
  const publicRaw=await download('공개용 파일 저장');
  assert(privateRaw.includes('백업할 개인 메모'));assert(!publicRaw.includes('백업할 개인 메모'));
  await upload('개인 메모·선택 백업 선택',{kind:'wrong'});
  assert.deepEqual(await storage(prefsKey),savedPrefs);
  const restored=JSON.parse(privateRaw);restored.preferences.notes={...restored.preferences.notes,'studio-01':'복원 메모'};
  await upload('개인 메모·선택 백업 선택',restored);
  await page.waitForFunction(()=>!document.querySelector('dialog').open);
  assert.equal((await storage(prefsKey)).notes['studio-01'],'복원 메모');
  console.log('PASS preference failures, private backup/restore, studio enlargement');

  await go('albums');await page.getByRole('button',{name:'앨범 추가',exact:true}).click();
  await page.getByLabel('앨범 이름',{exact:true}).fill('검증용 앨범');
  const pngs=await page.evaluate(()=>['red','blue'].map(color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=20;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,20,20);return canvas.toDataURL().split(',')[1];}));
  await page.getByLabel('사진 파일 추가 (선택)',{exact:true}).setInputFiles(pngs.map((data,index)=>({name:`test-${index}.png`,mimeType:'image/png',buffer:Buffer.from(data,'base64')})));
  await page.locator('.photo-edit-card').nth(1).waitFor();
  await page.locator('.photo-edit-card').nth(1).getByRole('button',{name:'대표로',exact:true}).click();
  await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  const firstOrder=(await storage(draftKey)).albums[0].images;
  assert.equal(firstOrder.length,2);
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await page.locator('.photo-edit-card').nth(1).getByRole('button',{name:'앞으로',exact:true}).click();
  await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  assert.deepEqual((await storage(draftKey)).albums[0].images,[firstOrder[1],firstOrder[0]]);
  await page.getByRole('button',{name:'사진 보기',exact:true}).click();
  await page.getByRole('button',{name:'다음 사진',exact:true}).click();
  assert.match(await page.locator('.photo-viewer').innerText(),/2 \/ 2/);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await page.locator('.photo-edit-card').first().getByRole('button',{name:'사진 삭제',exact:true}).click();
  await page.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal((await storage(draftKey)).albums[0].images.length,2);
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await page.locator('.photo-edit-card').first().getByRole('button',{name:'사진 삭제',exact:true}).click();
  await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  assert.equal((await storage(draftKey)).albums[0].images.length,1);
  console.log('PASS photo upload, cover, reorder, enlargement, deletion and cancel');

  await go('honeymoon');
  for(const title of ['검증 여행 A','검증 여행 B','검증 여행 C']){
    await page.getByRole('button',{name:'여행지 추가',exact:true}).click();
    await page.getByLabel('여행지',{exact:true}).fill(title);
    await page.getByRole('button',{name:'초안에 저장',exact:true}).click();
  }
  await page.getByRole('button',{name:'비교 선택',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'비교 선택',exact:true}).nth(1).click();
  await page.getByRole('button',{name:'비교 선택',exact:true}).nth(2).click();
  assert.equal((await storage(prefsKey)).tripCompare.length,2);
  assert.equal(await page.locator('.travel-comparison thead th').count(),3);
  await page.getByRole('button',{name:'관심 여행지',exact:true}).first().click();
  await page.getByRole('button',{name:'최종 선택',exact:true}).nth(1).click();
  await page.reload();await ready();
  assert.equal(await page.getByRole('button',{name:'최종 선택',exact:true}).nth(1).getAttribute('aria-pressed'),'true');
  console.log('PASS trip comparison limit, favorites and final choice persistence');

  await page.getByRole('button',{name:'내용 관리',exact:true}).click();
  const fullPublic=await download('공개용 파일 저장');
  const before=await storage(draftKey);
  await upload('콘텐츠 JSON 파일 선택','{');assert.deepEqual(await storage(draftKey),before);
  await upload('콘텐츠 JSON 파일 선택',fullPublic);
  await page.waitForFunction(()=>!document.querySelector('dialog').open);
  const after=await storage(draftKey);assert.deepEqual(after,before);
  const original=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
  original.invitation.partner1='새 공개본';
  await page.route('**/data/site.json',route=>route.fulfill({json:original}));
  await page.reload();await ready();
  assert.match(await page.locator('#draft-banner').innerText(),/공개본이 변경/);
  await page.getByRole('button',{name:'내용 관리',exact:true}).click();
  await page.getByRole('heading',{name:'새 공개본 확인',exact:true}).waitFor();
  await page.getByRole('button',{name:'창 닫기',exact:true}).click();
  const personalBefore=await storage(prefsKey);
  await page.goto(base+'?view=guest#/invitation');await ready();
  assert.equal(await page.locator('#manage-content').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'예식 정보 편집',exact:true}).count(),0);
  assert.match(await page.locator('.couple-names').innerText(),/새 공개본/);
  assert(!await page.locator('main').innerText().then(text=>text.includes('브라우저 검증')));
  await page.goto(base+'?view=guest#/studios');await ready();
  assert.equal(await page.locator('textarea').count(),0);
  await page.getByLabel('비교할 스튜디오 A',{exact:true}).selectOption('studio-03');
  assert.deepEqual(await storage(prefsKey),personalBefore);
  assert.deepEqual(await storage(draftKey),before);
  console.log('PASS content round trip, invalid import, changed-public warning, guest isolation');

  await page.goto(base+'#/studios');await ready();
  await mkdir(new URL('../work/browser-qa/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../work/browser-qa/desktop.png',import.meta.url)),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const route of ['home','invitation','story','albums','studios','honeymoon']){
    await go(route);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow: ${route}`);
  }
  assert(await page.locator('.table-scroll').evaluate(node=>node.scrollWidth<=node.clientWidth),'mobile comparison columns must all fit');
  await page.screenshot({path:fileURLToPath(new URL('../work/browser-qa/mobile.png',import.meta.url)),fullPage:true});
  await page.getByRole('button',{name:'내용 관리',exact:true}).click();
  await page.getByRole('button',{name:'공개본으로 돌아가기',exact:true}).click();
  assert.equal(await storage(draftKey),null);assert.deepEqual(await storage(prefsKey),personalBefore);
  await page.evaluate(draft=>{localStorage.setItem('wedding:v1:draft',JSON.stringify(draft));},JSON.parse(fullPublic));
  await page.reload();await ready();
  assert.match(await page.locator('#draft-banner').innerText(),/基準|기준 버전/);
  await page.route('**/data/site.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.goto(base+'?view=guest#/home');await ready();
  await page.getByRole('button',{name:'다시 불러오기',exact:true}).waitFor();
  // A deliberately simulated 503 emits a browser console resource error.
  const unexpected=errors.filter(message=>!message.includes('503'));
  assert.equal(unexpected.length,0,unexpected.join('\n'));
  console.log('PASS mobile routes, public reset, zero browser errors');
} catch(error) {
  console.error('Browser state:',await page.locator('body').innerText());
  console.error('Browser errors:',errors);
  throw error;
} finally { await browser.close(); }
