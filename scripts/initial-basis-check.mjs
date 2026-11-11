// Actual app with isolated synthetic new plans; no public data is changed.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
try{
 await mkdir('work/initial-basis-qa',{recursive:true});
 const c=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('dialog',d=>d.accept());
 await p.goto(base+'#/honeymoon');await ready(p);await p.getByRole('button',{name:'여행지 추가',exact:true}).click();
 await p.getByLabel('여행지',{exact:true}).fill('첫 일정 점검 후보');await p.getByLabel('한국 출발일',{exact:true}).fill('2027-06-07');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-06-14');
 await p.getByRole('button',{name:'숙박 추가',exact:true}).click();await p.getByLabel('숙박 지역 1',{exact:true}).fill('점검용 해변권');await p.getByLabel('숙박 박 수 1',{exact:true}).fill('6');
 const preview=p.locator('.editor-form > p[role="status"]');assert(!(await preview.innerText()).includes('가안 기준과 달라'));
 await p.getByLabel('한국 출발일',{exact:true}).fill('2027-06-06');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-06-13');assert(!(await preview.innerText()).includes('가안 기준과 달라'));await save(p);
 const card=p.locator('.travel-card').filter({has:p.getByRole('heading',{name:'첫 일정 점검 후보',exact:true})}),id=await card.getAttribute('data-trip-id');
 const stored=()=>p.evaluate(id=>JSON.parse(localStorage.getItem('wedding:v1:draft')).honeymoon.find(t=>t.id===id),id);
 const status=()=>card.locator(':scope > .stay-status').innerText();
 const noChange=async()=>{assert(!(await status()).includes('가안 기준과 달라'));assert.equal(await card.locator(':scope > .stay-status.warning').count(),0);};
 assert.deepEqual((await stored()).plan.dateBasis,{startDate:'2027-06-06',endDate:'2027-06-13'});await noChange();await p.reload();await ready(p);await noChange();
 await card.getByRole('button',{name:'최종 선택',exact:true}).click();await p.locator('.selected-trip').waitFor();assert(!(await p.locator('.selected-trip .stay-status').innerText()).includes('가안 기준과 달라'));
 await card.getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('한국 출발일',{exact:true}).fill('2027-06-07');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-06-14');assert.match(await preview.innerText(),/가안 기준과 달라/);await save(p);
 assert.match(await status(),/가안 기준과 달라/);assert.deepEqual((await stored()).plan.dateBasis,{startDate:'2027-06-06',endDate:'2027-06-13'});assert.match(await p.locator('.selected-trip .stay-status').innerText(),/가안 기준과 달라/);
 await p.getByRole('button',{name:'내용 관리',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const backup=JSON.parse(await readFile(await (await pending).path(),'utf8'));
 const upload=async data=>{if(!await p.locator('dialog').evaluate(n=>n.open))await p.getByRole('button',{name:'내용 관리',exact:true}).click();await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'basis.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>!document.querySelector('dialog').open);};
 await upload(backup);assert.match(await status(),/가안 기준과 달라/);
 await card.getByRole('button',{name:'수정',exact:true}).click();await p.getByRole('button',{name:'현재 날짜로 가안 기준 갱신',exact:true}).click();await save(p);await noChange();assert.deepEqual((await stored()).plan.dateBasis,{startDate:'2027-06-07',endDate:'2027-06-14'});
 const legacy=structuredClone(backup);legacy.honeymoon.find(t=>t.id===id).plan.dateBasis={startDate:'',endDate:''};await upload(legacy);await noChange();
 await card.getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('일정·상담 메모',{exact:true}).fill('기존 빈 기준일 복구 확인');await save(p);assert.deepEqual((await stored()).plan.dateBasis,{startDate:'2027-06-07',endDate:'2027-06-14'});await noChange();
 await p.getByRole('button',{name:'여행지 추가',exact:true}).click();await p.getByLabel('여행지',{exact:true}).fill('부분 날짜 점검 후보');await p.getByLabel('한국 출발일',{exact:true}).fill('2027-06-06');await save(p);
 const partial=p.locator('.travel-card').filter({has:p.getByRole('heading',{name:'부분 날짜 점검 후보',exact:true})});await partial.getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('한국 도착일',{exact:true}).fill('2027-06-13');assert(!(await preview.innerText()).includes('가안 기준과 달라'));await save(p);
 const partialBasis=await p.evaluate(()=>JSON.parse(localStorage.getItem('wedding:v1:draft')).honeymoon.find(t=>t.title==='부분 날짜 점검 후보').plan.dateBasis);assert.deepEqual(partialBasis,{startDate:'2027-06-06',endDate:'2027-06-13'});
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:390,height:844});await card.screenshot({path:'work/initial-basis-qa/first-plan-mobile.png'});
 await p.goto(base+'?view=guest#/honeymoon');await ready(p);assert.equal(await p.locator('.travel-card').count(),5);assert.equal(await p.getByRole('heading',{name:'첫 일정 점검 후보',exact:true}).count(),0);
 await p.goto(base+'?view=guest#/invitation');await ready(p);assert.match(await p.locator('.invitation-date').innerText(),/2027년 6월 5일.*15:00/);assert.equal(await p.locator('.invitation .message,.invitation-extra-guides,.invitation-contacts-box').count(),0);assert.equal(new URL(await p.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).getAttribute('href')).searchParams.get('dates'),'20270605T060000Z/20270605T060000Z');
 assert.deepEqual(errors,[]);console.log('PASS first-save/partial/legacy basis initialization, real later-date warnings, manual reset, reload/JSON/selected summary, responsive guest isolation and blank optional invitation fields');await c.close();
}finally{await browser.close();}
