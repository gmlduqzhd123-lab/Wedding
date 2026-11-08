// Behavioral regression uses historical plan fixtures; see june-beaches-check.mjs for live content.
import {useReferencePlans,referencePlans} from './reference-plans.mjs';
// Optional browser checks for selected-plan status parity and calendar file downloads.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/Wedding/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[];
const ready=p=>p.locator('#main[aria-busy="false"]').waitFor();
const card=(p,id='maldives')=>p.locator(`[data-trip-id="${id}"]`);
const save=async p=>{await p.getByRole('button',{name:'초안에 저장',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog').open);};
const unfold=raw=>raw.replace(/\r\n[ \t]/g,'');
async function googleLink(p,{start='20270605T060000Z',title='결혼식',location='순천아모르웨딩컨벤션 1층'}={}){
  const link=p.getByRole('link',{name:'Google 캘린더에 추가',exact:true}),url=new URL(await link.getAttribute('href'));
  assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.pathname,'/calendar/r/eventedit');assert.equal(url.searchParams.get('action'),'TEMPLATE');
  assert.equal(url.searchParams.get('dates'),`${start}/${start}`);assert.equal(url.searchParams.get('text'),title);assert.equal(url.searchParams.get('location'),location);
  assert.equal(url.searchParams.get('stz'),'Asia/Seoul');assert.equal(url.searchParams.get('etz'),'Asia/Seoul');assert.match(url.searchParams.get('details'),/종료 시각은 미정/);assert.equal(await link.getAttribute('target'),'_blank');
}
async function calendar(p){
  const pending=p.waitForEvent('download');await p.getByRole('button',{name:'일정 파일(.ics) 다운로드',exact:true}).click();const file=await pending;
  assert.match(file.suggestedFilename(),/^wedding-\d{4}-\d{2}-\d{2}\.ics$/);const raw=await readFile(await file.path(),'utf8');
  assert(raw.startsWith('BEGIN:VCALENDAR\r\n'));assert(raw.endsWith('END:VCALENDAR\r\n'));assert(!/(?<!\r)\n|\r(?!\n)/.test(raw));
  for(const line of raw.split('\r\n'))assert(Buffer.byteLength(line,'utf8')<=75);return unfold(raw);
}
try{
  await mkdir('work/calendar-summary-qa',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await useReferencePlans(context);await p.goto(base+'#/honeymoon');await ready(p);
  const choose=async id=>{await card(p,id).getByRole('button',{name:'최종 선택',exact:true}).click();await p.waitForFunction(id=>JSON.parse(localStorage.getItem('wedding:v1:preferences')).tripSelected===id,id);};
  const parity=async id=>{
    assert.equal(await p.locator('.selected-trip .budget-status').innerText(),await card(p,id).locator(':scope > .budget-status').innerText());
    assert.equal(await p.locator('.selected-trip .stay-status').innerText(),await card(p,id).locator(':scope > .stay-status').innerText());
  };
  await choose('maldives');await parity('maldives');await card(p).getByRole('button',{name:'수정',exact:true}).click();
  await p.getByLabel('두 사람의 계획예산 (원)',{exact:true}).fill('11000000');await p.getByLabel('한국 도착일',{exact:true}).fill('2027-05-10');await p.getByLabel('예비비 배분 (원)',{exact:true}).fill('0');await p.getByLabel('항공 배분 (원)',{exact:true}).fill('');await save(p);await parity('maldives');
  assert.match(await p.locator('.selected-trip').innerText(),/1,000,000원 초과/);assert.match(await p.locator('.selected-trip').innerText(),/예비비가 0원/);assert.match(await p.locator('.selected-trip').innerText(),/숙박 6박/);
  await p.reload();await ready(p);await parity('maldives');
  for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:950});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.setViewportSize({width:390,height:844});await p.locator('.selected-trip').screenshot({path:'work/calendar-summary-qa/selected-warning.png'});
  await p.getByRole('button',{name:'내용 관리',exact:true}).click();const exportEvent=p.waitForEvent('download');await p.getByRole('button',{name:'공개용 파일 저장',exact:true}).click();const backup=JSON.parse(await readFile(await (await exportEvent).path(),'utf8'));
  await p.getByRole('button',{name:'창 닫기',exact:true}).click();await card(p).getByRole('button',{name:'수정',exact:true}).click();await p.getByLabel('두 사람의 계획예산 (원)',{exact:true}).fill('12000000');await save(p);assert.match(await p.locator('.selected-trip').innerText(),/2,000,000원 초과/);
  await p.getByRole('button',{name:'내용 관리',exact:true}).click();await p.getByLabel('콘텐츠 JSON 파일 선택',{exact:true}).setInputFiles({name:'summary-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await p.waitForFunction(()=>!document.querySelector('dialog').open);await parity('maldives');assert.match(await p.locator('.selected-trip').innerText(),/1,000,000원 초과/);
  await choose('bali');await parity('bali');assert(!await p.locator('.selected-trip').innerText().then(t=>t.includes('1,000,000원 초과')));
  await p.goto(base+'?view=guest#/honeymoon');await ready(p);assert.equal(await p.locator('#selected-trip-region,.trip-controls').count(),0);await context.close();
  console.log('PASS selected summary matches all candidate budget/stay status through edits, selection, reload/import and responsive guest isolation');

  for(const timezoneId of ['Asia/Seoul','America/Los_Angeles']){
    const c=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,timezoneId}),q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));
    await q.goto(base+'?view=guest#/invitation');await ready(q);await googleLink(q);const raw=await calendar(q);
    assert.match(raw,/DTSTART:20270605T060000Z\r\n/);assert.match(raw,/SUMMARY:결혼식\r\n/);assert.match(raw,/LOCATION:순천아모르웨딩컨벤션 1층\r\n/);assert(!/DTEND:|DURATION:|ORGANIZER:|ATTENDEE:|BEGIN:VALARM/.test(raw));
    assert.equal(await q.locator('.couple-names,.invitation .message,.place p').count(),0);assert.equal(await q.getByRole('link',{name:'오시는 길 ↗',exact:true}).count(),0);
    for(const width of [320,390,768,1440]){await q.setViewportSize({width,height:950});assert(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    if(timezoneId==='Asia/Seoul'){await q.setViewportSize({width:390,height:844});await q.locator('.invitation').screenshot({path:'work/calendar-summary-qa/invitation-calendar.png'});}
    await q.goto(base+'#/invitation');await ready(q);await q.getByRole('button',{name:'예식 정보 편집',exact:true}).click();await q.getByLabel('첫 번째 이름',{exact:true}).fill('초안 이름');await q.getByLabel('예식 날짜',{exact:true}).fill('2027-05-09');await q.getByLabel('예식 시간',{exact:true}).fill('09:30');await q.getByLabel('예식장·홀 이름',{exact:true}).fill('초안 예식장');await save(q);
    await googleLink(q,{start:'20270509T003000Z',title:'초안 이름 결혼식',location:'초안 예식장'});
    const draft=await calendar(q);assert.match(draft,/DTSTART:20270509T003000Z/);assert.match(draft,/SUMMARY:초안 이름 결혼식/);assert.match(draft,/LOCATION:초안 예식장/);
    await q.goto(base+'?view=guest#/invitation');await ready(q);await googleLink(q);const publicAgain=await calendar(q);assert.match(publicAgain,/DTSTART:20270605T060000Z/);assert(!publicAgain.includes('초안 이름'));assert(!publicAgain.includes('초안 예식장'));
    await q.goto(base+'#/invitation');await ready(q);await q.getByRole('button',{name:'예식 정보 편집',exact:true}).click();await q.getByLabel('예식 시간',{exact:true}).fill('');await save(q);assert.equal(await q.getByRole('button',{name:'일정 파일(.ics) 다운로드',exact:true}).count(),0);
    assert.equal(await q.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).count(),0);
    await q.getByRole('button',{name:'예식 정보 편집',exact:true}).click();await q.getByLabel('예식 날짜',{exact:true}).fill('');await q.getByLabel('예식 시간',{exact:true}).fill('13:00');await save(q);assert.equal(await q.getByRole('button',{name:'일정 파일(.ics) 다운로드',exact:true}).count(),0);assert.equal(await q.getByRole('link',{name:'Google 캘린더에 추가',exact:true}).count(),0);await c.close();
    console.log(`PASS calendar download in ${timezoneId}, public/draft separation, unknown fields and incomplete schedules`);
  }
  assert.deepEqual(errors,[]);console.log('PASS zero browser errors');
}finally{await browser.close();}
