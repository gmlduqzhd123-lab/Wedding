// Four reported issues, checked through isolated browser contexts without touching user data.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_URL||'http://127.0.0.1:4174/Wedding/';
const out=process.env.QA_DIR||'work/preparation-qa';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],report={base,checks:[]};
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const closed=p=>p.waitForFunction(()=>!document.querySelector('dialog').open);
const values=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')));
async function page(context){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return p;}
async function route(p,name){await p.goto(base+'#/'+name);await ready(p);}
async function budget(p){await p.getByRole('button',{name:/^(첫 예산표 작성하기|예산 입력·수정)$/}).click();}
async function saveBudget(p){await p.getByRole('button',{name:'예산 계산기 저장',exact:true}).click();await closed(p);}
async function lock(p){await p.evaluate(()=>{window.qaHeld=false;window.qaLock=navigator.locks.request('wedding-storage:wedding:v1:preferences',()=>new Promise(resolve=>{window.qaRelease=resolve;window.qaHeld=true;}));});await p.waitForFunction(()=>window.qaHeld);}
async function quota(p,on){await p.evaluate(on=>{if(on){window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='wedding:v1:preferences')throw new DOMException('QA storage full','QuotaExceededError');return window.qaSetItem.call(this,k,v);};}else Storage.prototype.setItem=window.qaSetItem;},on);}
const localChoice=p=>p.getByRole('button',{name:'현재 입력으로 충돌 항목 저장',exact:true});
const review=p=>localChoice(p).waitFor();
try{
 await mkdir(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),p=await page(context);
 await route(p,'tips');await budget(p);await p.locator('#budget-venue-planned').fill('20000000');await saveBudget(p);
 let summary=await p.locator('.budget-summary-cards').innerText();
 assert.match(summary,/목표 예산 입력 소계\s*20,000,000원/);assert.match(summary,/실제 지출·계약 입력 소계\s*미입력/);assert.match(summary,/차액\s*미확인/);assert(!summary.includes('여유'));
 await route(p,'home');assert.match(await p.locator('.dashboard-card').filter({hasText:'통합 예산 현황'}).innerText(),/미입력[\s\S]*차액 미확인/);
 await route(p,'tips');await budget(p);
 const keys=['venue','sdm','snap','rings','honeymoon','living'];
 for(const key of keys)for(const field of ['planned','actual'])await p.locator(`#budget-${key}-${field}`).fill('0');
 await saveBudget(p);assert.match(await p.locator('.budget-summary-cards').innerText(),/실제 지출·계약 합계\s*0원[\s\S]*여유 0원/);
 await budget(p);await p.locator('#budget-venue-planned').fill('20000000');await p.locator('#budget-venue-actual').fill('12000000');await saveBudget(p);
 assert.match(await p.locator('.budget-summary-cards').innerText(),/여유 8,000,000원/);
 await budget(p);await p.locator('#budget-honeymoon-actual').fill('9000000');await saveBudget(p);assert.match(await p.locator('.budget-summary-cards').innerText(),/초과 1,000,000원/);
 await budget(p);await p.locator('#budget-venue-actual').fill('');await saveBudget(p);assert.match(await p.locator('.budget-summary-cards').innerText(),/미확인/);
 report.checks.push('Unknown amounts, explicit zero, partial/full budget and home summary, surplus and overrun');
 // Use two ordinary tabs with open editors so their original baselines remain distinct.
 const a=await page(context),b=await page(context);
 async function conflict(left,right){
  for(const tab of [a,b]){await route(tab,'tips');await budget(tab);}
  await a.locator('#budget-venue-planned').fill(String(left));await b.locator('#budget-venue-planned').fill(String(right));
  await b.locator('#budget-sdm-note').fill('다른 탭의 독립 메모');await saveBudget(b);
  await a.getByRole('button',{name:'예산 계산기 저장',exact:true}).click();await review(a);
  assert.match(await a.locator('#dialog-notice').innerText(),/현재 입력:[\s\S]*다른 탭의 저장본:/);
  assert(await a.locator('#editor-body').evaluate(n=>n.inert));
  assert.equal((await values(a)).budgetPlan.venue.planned,right);
 }
 await conflict(21000000,22000000);
 await lock(a);await localChoice(a).click();
 await a.waitForFunction(()=>document.querySelector('#dialog-notice button').disabled);
 await a.keyboard.press('Escape');assert(await a.getByRole('dialog').isVisible());
 await a.evaluate(()=>window.qaRelease());await closed(a);
 assert.equal((await values(a)).budgetPlan.venue.planned,21000000);assert.equal((await values(a)).budgetPlan.sdm.note,'다른 탭의 독립 메모');
 assert.equal(await a.locator('#editor-body').evaluate(n=>n.inert),false);
 await conflict(23000000,24000000);await a.getByRole('button',{name:'다른 탭의 저장본 유지',exact:true}).click();await closed(a);assert.equal((await values(a)).budgetPlan.venue.planned,24000000);
 await conflict(25000000,26000000);await a.getByRole('button',{name:'입력 계속 수정',exact:true}).click();
 assert.equal(await a.locator('#editor-body').evaluate(n=>n.inert),false);await a.locator('#budget-venue-planned').fill('27000000');
 await a.getByRole('button',{name:'예산 계산기 저장',exact:true}).click();await review(a);
 // Storage changes refresh the review, and a failed approved save remains visible and retryable.
 await budget(b);await b.locator('#budget-venue-planned').fill('28000000');await saveBudget(b);
 await a.locator('#dialog-notice').getByText('28,000,000원',{exact:false}).waitFor();
 await quota(a,true);await localChoice(a).click();await a.locator('#conflict-status').filter({hasText:'저장 공간이 부족합니다'}).waitFor();
 assert.equal((await values(a)).budgetPlan.venue.planned,28000000);assert.equal(await a.locator('#budget-venue-planned').inputValue(),'27000000');
 await quota(a,false);await localChoice(a).click();await closed(a);assert.equal((await values(a)).budgetPlan.venue.planned,27000000);
 await budget(a);await a.screenshot({path:`${out}/budget-mobile.png`});
 for(const width of [320,390,768,1440]){
  await a.setViewportSize({width,height:900});
  const size=await a.evaluate(()=>{const body=document.querySelector('#editor-body');return {client:body.clientWidth,scroll:body.scrollWidth,right:body.getBoundingClientRect().right,inputRight:document.querySelector('#budget-venue-planned').getBoundingClientRect().right};});
  assert(size.scroll<=size.client+1,`Modal overflows at ${width}: ${JSON.stringify(size)}`);assert(size.inputRight<=size.right);
 }
 await a.getByRole('button',{name:'취소',exact:true}).click();await closed(a);
 // The same in-place review also works for the simulator's saving guard.
 for(const tab of [a,b]){await route(tab,'tips');await tab.locator('.venue-sim-box').getByRole('button',{name:/시뮬레이터 (입력|수정)/}).click();}
 await a.locator('#vsim-hall').fill('1000000');await b.locator('#vsim-hall').fill('2000000');
 await b.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await closed(b);
 await a.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await review(a);await a.screenshot({path:`${out}/conflict-review.png`});await localChoice(a).click();await closed(a);assert.equal((await values(a)).venueSim.hallFee,1000000);
 report.checks.push('Real two-tab conflicts: choose local/remote, preserve independent changes, edit again, live review refresh, quota retry, pending close protection, budget and venue');
 // Input protection, saving lock and retry on both newly protected dialogs.
 let discard=false,confirmations=0;p.on('dialog',async d=>{confirmations++;if(discard)await d.accept();else await d.dismiss();});
 const dialogs=[
  {route:'tips',open:async()=>p.getByRole('button',{name:'식순·사회·축가 편집',exact:true}).click(),field:'#ceremony-mc',save:'식순 플래너 저장',read:v=>v.ceremonyPlan.mc},
  {route:'honeymoon',open:async()=>{const section=p.locator('.honeymoon-packing');if(!await section.evaluate(n=>n.open))await section.locator(':scope > summary').click();await p.getByRole('button',{name:'+ 우리만의 준비물 추가',exact:true}).click();},field:'#custom-pack-title',save:'준비물 추가',read:v=>v.customPackingList.at(-1).title}
 ];
 for(const d of dialogs){
  await route(p,d.route);await d.open();await p.locator(d.field).fill('입력 보호 검증');
  for(const close of [()=>p.keyboard.press('Escape'),()=>p.getByRole('button',{name:'창 닫기',exact:true}).click(),()=>p.getByRole('button',{name:'취소',exact:true}).click()]){
   const before=confirmations;await close();assert.equal(confirmations,before+1);assert(await p.getByRole('dialog').isVisible());assert.equal(await p.locator(d.field).inputValue(),'입력 보호 검증');
  }
  discard=true;await p.keyboard.press('Escape');await closed(p);discard=false;await d.open();assert.equal(await p.locator(d.field).inputValue(),'');
  await p.locator(d.field).fill('저장 재시도 검증');await quota(p,true);await p.getByRole('button',{name:d.save,exact:true}).click();await p.getByRole('alert').filter({hasText:'저장하지 못했습니다'}).waitFor();
  assert(await p.getByRole('dialog').isVisible());assert.equal(await p.locator(d.field).inputValue(),'저장 재시도 검증');await quota(p,false);
  await lock(p);await p.getByRole('button',{name:d.save,exact:true}).click();assert(await p.getByRole('button',{name:d.save,exact:true}).isDisabled());
  const before=confirmations;await p.keyboard.press('Escape');assert.equal(confirmations,before);assert(await p.getByRole('dialog').isVisible());
  // A second submit event cannot queue a duplicate record.
  await p.locator('form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await p.evaluate(()=>window.qaRelease());await closed(p);assert.equal(d.read(await values(p)),'저장 재시도 검증');
  await p.reload();await ready(p);assert.equal(d.read(await values(p)),'저장 재시도 검증');
 }
 assert.equal((await values(p)).customPackingList.length,1);
 report.checks.push('Ceremony and packing dirty Esc/close/cancel, discard, quota failure recovery, in-flight close/duplicate save, reload persistence');
 // Private backup excludes public content and survives restore; public JSON excludes private input.
 p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const privateDownload=p.waitForEvent('download');await p.getByRole('button',{name:'개인 백업 저장',exact:true}).click();const backup=await readFile(await(await privateDownload).path(),'utf8');
 assert.equal(JSON.parse(backup).preferences.customPackingList.length,1);assert.equal(JSON.parse(backup).preferences.ceremonyPlan.mc,'저장 재시도 검증');
 await p.getByLabel('개인 메모·선택 백업 선택',{exact:true}).setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(backup)});await closed(p);
 assert.equal((await values(p)).customPackingList.length,1);
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const publicDownload=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const publicRaw=await readFile(await(await publicDownload).path(),'utf8');assert(!publicRaw.includes('저장 재시도 검증'));assert(!publicRaw.includes('budgetPlan'));
 await p.getByRole('button',{name:'창 닫기',exact:true}).click();
 report.checks.push('Private backup/restore preserves new inputs; public export excludes private budget, ceremony and packing');
 assert.deepEqual(errors,[]);report.errors=errors;await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));console.log('PASS '+report.checks.join('; ')+'; zero browser errors');
 await context.close();
}finally{await browser.close();}
