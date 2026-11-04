// Optional browser regression checks for concurrency, editor safety, resilience and sharing.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
const errors=[];
const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
const make=async(route)=>{const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'#/'+route);await page.locator('#main[aria-busy="false"]').waitFor();return page;};
const closed=page=>page.waitForFunction(()=>!document.querySelector('dialog').open);
const edit=page=>page.getByRole('button',{name:'예식 정보 편집',exact:true}).click();
const save=page=>page.getByRole('button',{name:'초안에 저장',exact:true}).click();
const draft=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:draft')));
let page;
try{
  page=await make('invitation');const other=await make('invitation');
  await edit(page);await edit(other);
  await page.getByLabel('첫 번째 이름',{exact:true}).fill('동시 작성 이름');
  await other.getByLabel('예식장·홀 이름',{exact:true}).fill('동시 작성 장소');
  await Promise.all([save(page),save(other)]);await Promise.all([closed(page),closed(other)]);
  assert.equal((await draft(page)).invitation.partner1,'동시 작성 이름');
  assert.equal((await draft(page)).invitation.venue,'동시 작성 장소');
  // Conflicting edits require a visible review and an explicit resolution.
  await edit(page);await edit(other);
  await page.getByLabel('첫 번째 이름',{exact:true}).fill('탭 A 이름');
  await other.getByLabel('첫 번째 이름',{exact:true}).fill('탭 B 이름');
  await save(page);await closed(page);await save(other);
  await other.locator('.conflict-list').waitFor();
  assert.match(await other.locator('.conflict-list').innerText(),/탭 A 이름/);
  assert.match(await other.locator('.conflict-list').innerText(),/탭 B 이름/);
  assert.equal((await draft(other)).invitation.partner1,'탭 A 이름');
  await other.getByRole('button',{name:'현재 입력으로 충돌 항목 저장',exact:true}).click();await closed(other);
  assert.equal((await draft(page)).invitation.partner1,'탭 B 이름');
  assert.equal((await draft(page)).invitation.venue,'동시 작성 장소');
  console.log('PASS parallel draft merge and same-field conflict review');

  await page.goto(base+'#/studios');await page.getByLabel('비교할 스튜디오 A',{exact:true}).selectOption('studio-01');
  await page.locator('.compare-card h2').first().filter({hasText:'아르센'}).waitFor();
  await page.locator('.compare-card textarea').first().focus();
  await other.goto(base+'#/studios');await other.getByLabel('비교할 스튜디오 A',{exact:true}).selectOption('studio-02');
  await other.locator('.compare-card h2').first().filter({hasText:'고유'}).waitFor();
  await Promise.all([page.locator('.compare-card textarea').first().fill('메모 A'),other.locator('.compare-card textarea').first().fill('메모 B')]);
  await page.waitForFunction(()=>{const notes=JSON.parse(localStorage.getItem('wedding:v1:preferences')).notes;return notes['studio-01']==='메모 A'&&notes['studio-02']==='메모 B';});
  // A delayed favorite write must not replace a memo field being edited.
  await page.evaluate(()=>{
    const locks=navigator.locks,original=locks.request.bind(locks);
    window.savedLockRequest=original;
    locks.request=(name,callback)=>new Promise(resolve=>setTimeout(resolve,150)).then(()=>original(name,callback));
  });
  await page.locator('.compare-card .favorite').first().click();
  await page.locator('.compare-card textarea').first().fill('관심 표시 중에도 보존할 메모');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).notes['studio-01']==='관심 표시 중에도 보존할 메모');
  assert.equal(await page.locator('.compare-card textarea').first().inputValue(),'관심 표시 중에도 보존할 메모');
  await page.evaluate(()=>{navigator.locks.request=window.savedLockRequest;});
  console.log('PASS concurrent studio memos preserve both notes');

  await page.goto(base+'#/story');await page.getByRole('button',{name:'이야기 추가',exact:true}).click();
  await page.getByLabel('이야기 제목',{exact:true}).fill('보존할 작성 내용');
  page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');
  assert.equal(await page.getByLabel('이야기 제목',{exact:true}).inputValue(),'보존할 작성 내용');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'창 닫기',exact:true}).click();
  assert(await page.locator('dialog').evaluate(node=>node.open));
  page.once('dialog',dialog=>dialog.dismiss());await page.evaluate(()=>{location.hash='#/albums';});
  await page.waitForFunction(()=>location.hash==='#/story');
  assert.equal(await page.getByLabel('이야기 제목',{exact:true}).inputValue(),'보존할 작성 내용');
  await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
  await save(page);await page.locator('#dialog-notice.error').waitFor();
  assert.match(await page.locator('#dialog-notice').innerText(),/저장하지 못했습니다/);
  assert(await page.locator('#dialog-notice').evaluate(node=>{
    const r=node.getBoundingClientRect();return document.querySelector('dialog').contains(node)&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  }));
  await page.setViewportSize({width:390,height:844});
  await mkdir('work/improvement-qa',{recursive:true});
  await page.screenshot({path:'work/improvement-qa/visible-error-mobile.png'});
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});
  await save(page);await closed(page);
  console.log('PASS Escape, close, route guards and visible recoverable storage error');

  await page.goto(base+'#/albums');await page.getByRole('button',{name:'앨범 추가',exact:true}).click();
  await page.getByLabel('앨범 이름',{exact:true}).fill('편집 안전 검증');
  const colors=await page.evaluate(()=>['red','blue'].map(color=>{const c=document.createElement('canvas');c.width=c.height=20;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,20,20);return c.toDataURL().split(',')[1];}));
  await page.getByLabel('사진 파일 추가 (선택)',{exact:true}).setInputFiles(colors.map((color,index)=>({name:`test-${index}.png`,mimeType:'image/png',buffer:Buffer.from(color,'base64')})));
  await page.locator('.photo-edit-card').nth(1).waitFor();
  await page.locator('.photo-edit-card').nth(1).getByRole('button',{name:'앞으로',exact:true}).click();
  assert(await page.evaluate(()=>document.activeElement.closest('.photo-edit-card')!==null));
  for(const label of ['창 닫기','초안에 저장']){
    assert(await page.getByRole('button',{name:label,exact:true}).evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),`${label} remains visible`);
  }
  await page.screenshot({path:'work/improvement-qa/photo-controls-mobile.png'});
  await save(page);await closed(page);
  await page.goto(base+'#/story');await page.getByRole('button',{name:'이야기 추가',exact:true}).click();
  await page.getByLabel('이야기 제목',{exact:true}).fill('OurWeddingMemories'.repeat(8));await save(page);await closed(page);
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`long title fits ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'work/improvement-qa/long-title-mobile.png'});
  console.log('PASS fixed mobile controls, reorder focus and 320–1280px long titles');

  const isolated=await browser.newContext();const guest=await isolated.newPage();
  let failStudios=true;
  await guest.route('**/data/studios.json',route=>failStudios?route.fulfill({status:503,body:'unavailable'}):route.continue());
  await guest.goto(base+'?view=guest#/invitation');await guest.locator('#main[aria-busy="false"]').waitFor();
  await guest.getByRole('heading',{name:'소중한 분들을 초대합니다.',exact:true}).waitFor();
  await guest.locator('[data-route="studios"]').click();
  await guest.getByRole('button',{name:'스튜디오 다시 불러오기',exact:true}).waitFor();
  failStudios=false;await guest.getByRole('button',{name:'스튜디오 다시 불러오기',exact:true}).click();
  await guest.getByLabel('비교할 스튜디오 A',{exact:true}).waitFor();
  await isolated.close();
  await page.goto(base+'#/invitation');await page.getByRole('button',{name:'청첩장 링크 복사',exact:true}).click();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/\?view=guest#\/invitation$/);
  assert(await page.locator('meta[property="og:image"]').getAttribute('content'));
  const card=await context.request.get(base+'assets/share-card.png');assert.equal(card.status(),200);
  // Clipboard denial exposes a selectable fallback rather than reporting success.
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied');};});
  await page.getByRole('button',{name:'청첩장 링크 복사',exact:true}).click();
  assert.match(await page.getByLabel('공개 청첩장 링크',{exact:true}).inputValue(),/view=guest/);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS studio failure isolation/retry, shared metadata, link copy and fallback');
}catch(error){if(page)console.error(await page.locator('body').innerText());throw error;}
finally{await browser.close();}
