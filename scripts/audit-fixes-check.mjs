// Five reported regressions, exercised against the actual served app in isolated browser contexts.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const expected=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const closed=p=>p.waitForFunction(()=>!document.querySelector('dialog').open);
const scope=p=>p.locator('.venue-sim-box');
const openSim=p=>scope(p).getByRole('button',{name:/시뮬레이터 (입력|수정)/}).click();
const values=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences')));
async function pageFor(context){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return p;}
try{
 await mkdir('work/audit-fixes-qa',{recursive:true});
 const guest=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),g=await pageFor(guest);
 for(const mode of ['?view=guest','']){
  await g.goto(base+mode+'#/invitation');await ready(g);
  const url=new URL(await g.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).getAttribute('href'));
  assert.equal(url.searchParams.get('dates'),'20270605T060000Z/20270605T060000Z');assert.equal(url.searchParams.get('stz'),'Asia/Seoul');
  assert.equal(url.searchParams.get('location'),[expected.invitation.venue,expected.invitation.address].filter(Boolean).join(' · '));
  assert.match(await g.locator('.calendar-update-note').innerText(),/自動|자동 수정하지 않습니다/);
  const pending=g.waitForEvent('download');await g.getByRole('button',{name:'일정 파일(.ics) 다운로드',exact:true}).click();
  const ics=(await readFile(await(await pending).path(),'utf8')).replace(/\r\n[ \t]/g,'');assert.match(ics,/DTSTART:20270605T060000Z/);assert(!/DTEND:|DURATION:/.test(ics));
  assert.equal(await g.locator('.invitation .message,.invitation-extra-guides,.invitation-contacts-box').count(),0);
 }
 await g.screenshot({path:'work/audit-fixes-qa/invitation-mobile.png',fullPage:true});
 await g.goto(base+'?view=guest#/honeymoon');await ready(g);
 assert.match(await g.locator('[data-trip-id="nhatrang"] .trip-spec-chips').innerText(),/6월 덥고 맑은 시기/);
 assert.match(await g.locator('[data-trip-id="guam"] .trip-spec-chips').innerText(),/6월 건기·우기 전환기/);
 assert.match(await g.locator('[data-trip-id="danang"] .trip-spec-chips').innerText(),/6월 더위 유의/);
 assert.match(await g.locator('[data-trip-id="hawaii"] .trip-spec-chips').innerText(),/6월 여름철/);
 await g.getByRole('button',{name:'☀️ 건기·맑은 시기 (2)',exact:true}).click();
 assert.deepEqual(await g.locator('.travel-card').evaluateAll(ns=>ns.map(n=>n.dataset.tripId)),['bali','nhatrang']);
 await g.screenshot({path:'work/audit-fixes-qa/climate-filter-mobile.png'});
 await g.goto(base+'?view=guest#/studios');await ready(g);
 await g.getByRole('button',{name:'💡 추가금 미확인 (19)',exact:true}).click();assert.equal(await g.locator('.studio-tile').count(),19);assert.equal(await g.getByText('💡 표기 추가금 없음',{exact:true}).count(),0);
 assert.match(await g.locator('.comparison-table').innerText(),/자료에서 별도 금액 표기 확인 안 됨/);
 for(const width of [320,390,768,1440]){await g.setViewportSize({width,height:900});assert(await g.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const context=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true}),p=await pageFor(context);
 let discard=false,confirmations=0;p.on('dialog',async d=>{confirmations++;if(discard)await d.accept();else await d.dismiss();});
 await p.goto(base+'#/tips');await ready(p);await openSim(p);
 await p.getByLabel('대관료·연출료 합계 (원)',{exact:true}).fill('1000000');
 assert.match(await p.locator('.editor-form .form-note[aria-live]').innerText(),/소계 1,000,000원[\s\S]*총액 미확인/);
 await p.keyboard.press('Escape');assert.equal(confirmations,1);assert(await p.getByRole('dialog').isVisible());assert.equal(await p.getByLabel('대관료·연출료 합계 (원)',{exact:true}).inputValue(),'1000000');
 await p.getByRole('button',{name:'창 닫기',exact:true}).click();assert.equal(confirmations,2);assert(await p.getByRole('dialog').isVisible());
 await p.getByRole('button',{name:'취소',exact:true}).click();assert.equal(confirmations,3);assert(await p.getByRole('dialog').isVisible());
 discard=true;await p.keyboard.press('Escape');await closed(p);await openSim(p);assert.equal(await p.getByLabel('대관료·연출료 합계 (원)',{exact:true}).inputValue(),'');
 await p.getByLabel('대관료·연출료 합계 (원)',{exact:true}).fill('1000000');
 await p.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wedding:v1:preferences')throw new DOMException('QA full storage','QuotaExceededError');return window.qaSetItem.call(this,key,value);};});
 await p.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await p.getByRole('alert').filter({hasText:'저장하지 못했습니다'}).waitFor();
 assert(await p.getByRole('dialog').isVisible());assert.equal(await p.getByLabel('대관료·연출료 합계 (원)',{exact:true}).inputValue(),'1000000');assert.equal(await values(p),null);
 await p.evaluate(()=>{Storage.prototype.setItem=window.qaSetItem;});await p.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await closed(p);
 assert.equal((await values(p)).venueSim.mealPrice,null);assert.match(await scope(p).innerText(),/총액 미확인/);assert.equal(await p.getByRole('button',{name:'계산 총액을 웨딩홀 예산에 반영',exact:true}).count(),0);
 await p.reload();await ready(p);assert.match(await scope(p).innerText(),/입력값 기준 소계[\s\S]*1,000,000원/);
 await p.getByRole('button',{name:'첫 예산표 작성하기',exact:true}).click();assert.equal(await p.getByRole('button',{name:/웨딩홀 시뮬레이터 총액.*채우기/}).count(),0);await p.getByRole('button',{name:'취소',exact:true}).click();
 await openSim(p);
 for(const [label,value]of [['1인 식대 (원)','55000'],['예상 하객 수 (명)','180'],['최소 보증인원 (명)','200']])await p.getByLabel(label,{exact:true}).fill(value);
 // Hold the real storage lock to verify the in-flight close guard and duplicate-save protection.
 await p.evaluate(()=>{window.qaHeld=false;window.qaLock=navigator.locks.request('wedding-storage:wedding:v1:preferences',()=>new Promise(resolve=>{window.qaRelease=resolve;window.qaHeld=true;}));});await p.waitForFunction(()=>window.qaHeld);
 await p.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await p.keyboard.press('Escape');assert(await p.getByRole('dialog').isVisible());assert(await p.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).isDisabled());
 await p.evaluate(()=>window.qaRelease());await closed(p);assert.match(await scope(p).innerText(),/총액[\s\S]*12,000,000원/);assert.match(await scope(p).innerText(),/계약금 미입력 · 잔금 미확인/);
 await p.getByRole('button',{name:'계산 총액을 웨딩홀 예산에 반영',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('wedding:v1:preferences'))?.budgetPlan?.venue?.actual===12000000);
 await p.getByRole('button',{name:'예산 입력·수정',exact:true}).click();await p.getByRole('button',{name:/웨딩홀 시뮬레이터 총액.*채우기/}).click();assert.equal(await p.locator('#budget-venue-actual').inputValue(),'12000000');await p.getByRole('button',{name:'취소',exact:true}).click();
 await openSim(p);await p.getByLabel('기납부 계약금 (원)',{exact:true}).fill('1000000');await p.getByRole('button',{name:'웨딩홀 시뮬레이터 저장',exact:true}).click();await closed(p);assert.match(await scope(p).innerText(),/잔금[\s\S]*11,000,000원/);
 await p.screenshot({path:'work/audit-fixes-qa/venue-mobile.png',fullPage:false});
 // Preference backup/restore and public content export/import must retain their boundaries.
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const backupDownload=p.waitForEvent('download');await p.getByRole('button',{name:'개인 백업 저장',exact:true}).click();const backup=await readFile(await(await backupDownload).path(),'utf8');assert.equal(JSON.parse(backup).preferences.venueSim.deposit,1000000);
 await p.getByLabel('개인 메모·선택 백업 선택',{exact:true}).setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(backup)});await closed(p);assert.equal((await values(p)).venueSim.deposit,1000000);
 await p.goto(base+'#/honeymoon');await ready(p);await p.locator('[data-trip-id="nhatrang"]').getByRole('button',{name:'수정',exact:true}).click();await p.locator('.plan-extra-editor > summary').click();
 await p.getByLabel('기후 기준 월',{exact:true}).selectOption('7');assert.equal(await p.getByLabel('기후 요약 분류 (기준 월 자료 확인 후 선택)',{exact:true}).inputValue(),'');await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await closed(p);
 assert.match(await p.locator('[data-trip-id="nhatrang"] .trip-spec-chips').innerText(),/재확인/);
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const contentDownload=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const contentRaw=await readFile(await(await contentDownload).path(),'utf8'),contentData=JSON.parse(contentRaw);
 assert.equal(contentData.honeymoon.find(t=>t.id==='bali').plan.climateSummary.category,'dry');assert.equal(contentData.honeymoon.find(t=>t.id==='nhatrang').plan.climateSummary,null);assert(!contentRaw.includes('venueSim'));
 await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'site.json',mimeType:'application/json',buffer:Buffer.from(contentRaw)});await closed(p);await p.reload();await ready(p);assert.match(await p.locator('[data-trip-id="nhatrang"] .trip-spec-chips').innerText(),/재확인/);
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();await p.getByRole('button',{name:'공개본으로 돌아가기',exact:true}).click();await closed(p);assert.equal(await p.evaluate(()=>localStorage.getItem('wedding:v1:draft')),null);assert.match(await p.locator('[data-trip-id="nhatrang"] .trip-spec-chips').innerText(),/덥고 맑은/);
 for(const route of ['home','invitation','story','albums','studios','honeymoon','ceremony','tips']){await p.locator(`[data-route="${route}"]`).click();await ready(p);assert.equal(new URL(p.url()).hash,'#/'+route);}
 await p.goto(base+'?view=guest#/tips');await ready(p);assert.equal(await p.locator('.venue-sim-box').count(),0);assert.equal(await p.locator('[data-route="ceremony"]').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS five fixes: Google/ICS, reviewed climate filters and month invalidation, 19 unknown studio fees, partial/full venue costs and both import guards, dirty-close/save lock, backup/restore/JSON/reset/guest isolation, all menus and responsive layouts; zero browser errors');
 await guest.close();await context.close();
}finally{await browser.close();}
