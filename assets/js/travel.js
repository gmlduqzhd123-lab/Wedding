export const TRAVEL_CAP=10000000;
export const COST_LABELS={airfare:'항공',lodging:'숙박·패키지',other:'기타 여행비',reserve:'예비비'};
export const CLIMATE_CATEGORIES={dry:'☀️ 건기 경향',sunny:'☀️ 덥고 맑은 시기',hot:'🌡️ 더위 유의',summer:'🌤️ 여름철 · 지역별 강수 차이',variable:'🌦️ 산발적 비 · 변동성',transition:'🌦️ 건기·우기 전환기',wet:'🌧️ 우기 경향'};
export function climateBadgeInfo(trip){
  const review=climateReview(trip),summary=trip.plan?.climateSummary;
  if(!review.entered)return {label:'🌤️ 기후 미입력',dry:false};
  const valid=summary&&Object.hasOwn(CLIMATE_CATEGORIES,summary.category)&&summary.month===review.month&&!review.changedMonth;
  if(!valid)return {label:review.changedMonth||summary?`🌤️ ${review.month===null?'기준 월 미입력':review.month+'월 자료'} · 기후 요약 재확인`:`🌤️ ${review.month===null?'기준 월 미입력':review.month+'월'} · 기후 요약 미분류`,dry:false};
  const [icon,...words]=CLIMATE_CATEGORIES[summary.category].split(' ');
  return {label:`${icon} ${summary.month}월 ${words.join(' ')}`,dry:['dry','sunny'].includes(summary.category)};
}
export function climateReview(trip){
  const plan=trip.plan,entered=Boolean(plan?.climate?.trim());
  const month=entered&&Number.isInteger(plan.climateMonth)&&plan.climateMonth>=1&&plan.climateMonth<=12?plan.climateMonth:null;
  const changedMonth=month!==null&&[trip.startDate,trip.endDate].some(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(5,7))!==month);
  return {entered,month,changedMonth,title:!entered?'기후 자료 미입력':month===null?'기후 경향·출처 (기준 월 미입력)':`${month}월 기후 경향·출처`,
    summary:!entered?'기후 자료 미입력':`${month===null?'기준 월 미입력':month+'월 기준'} · ${plan.climate}`};
}
export const emptyQuote=()=>({costs:{airfare:null,lodging:null,other:null},checkedOn:'',flightSource:'',lodgingSource:'',departureAt:'',arrivalAt:'',includesRequiredCosts:false,basis:{startDate:'',endDate:'',country:'',stays:''}});
export function quoteBasis(trip){return {startDate:trip.startDate,endDate:trip.endDate,country:trip.country,stays:JSON.stringify((trip.plan?.stays||[]).map(s=>[s.region,s.nights,s.checkIn||'',s.checkOut||'']))};}
export function quoteReview(trip,today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())){
  const q=trip.plan?.quote||emptyQuote(),missing=[];
  for(const [key,label] of Object.entries(COST_LABELS))if(key!=='reserve'&&q.costs[key]===null)missing.push(label+' 견적');
  if(!q.checkedOn)missing.push('조회일');else if(q.checkedOn>today)missing.push('미래 조회일 수정');
  if(!q.flightSource.trim()||!q.lodgingSource.trim())missing.push('항공·숙박 근거');
  if(!q.includesRequiredCosts)missing.push('세금·수하물·식사·이동비 포함 조건');
  const basis=quoteBasis(trip),stale=Object.keys(basis).some(key=>basis[key]!==q.basis[key]);
  if(stale)missing.push('현재 여행·숙박 조건 재확인');
  if(!(trip.plan?.stays.length)||stayReview(trip).warnings.length)missing.push('숙박 일정 재확인');
  const flightDates=Boolean(q.departureAt&&q.arrivalAt&&q.departureAt.slice(0,10)===trip.startDate&&q.arrivalAt.slice(0,10)===trip.endDate&&q.arrivalAt>q.departureAt);
  if(!flightDates)missing.push('한국 출발·도착 시각');
  const reserve=trip.plan?.costs.reserve??null;if(reserve===null||reserve<=0)missing.push('예비비');
  const entered=Object.values(q.costs).filter(value=>value!==null),known=entered.length?entered.reduce((a,b)=>a+b,0):null;
  const assessed=known===null?null:known+(reserve??0),excess=Math.max(0,(assessed??0)-TRAVEL_CAP);
  const amountMessage=known===null?'':`입력 견적 소계 ${known.toLocaleString('ko-KR')}원 · ${reserve===null?'예비비 미입력':`기입 예비비 포함 ${assessed.toLocaleString('ko-KR')}원`}`;
  const complete=!missing.length,total=complete?Object.values(q.costs).reduce((a,b)=>a+b,0)+reserve:null;
  const message=complete?`입력 견적 + 예비비 ${total.toLocaleString('ko-KR')}원 · 필수 항목 확인 완료 (입력 근거 기준 · 예약 확정 아님)`:[amountMessage,'실제 예산 충족 미확인 · '+missing.join(' · ')].filter(Boolean).join('\n');
  return {complete,total,known,assessed,excess,amountMessage,stale,flightDates,missing,message};
}
export function currentBudgetText(trip){
  const costs=trip.plan?.costs||{},nights=(trip.plan?.stays||[]).reduce((sum,s)=>sum+s.nights,0);
  return Object.entries(COST_LABELS).map(([key,label])=>`${label} ${costs[key]===null||costs[key]===undefined?'미확인':costs[key].toLocaleString('ko-KR')+'원'}`).join(' · ')+(nights&&costs.lodging!==null&&costs.lodging!==undefined?` · 현재 ${nights}박 기준 숙박·패키지 1박당 배분 약 ${Math.round(costs.lodging/nights).toLocaleString('ko-KR')}원`: '');
}
export function budgetSummary(trip){
  const costs=trip.plan?.costs;
  const entered=costs?Object.values(costs).filter(value=>value!==null):[];
  const known=entered.length?entered.reduce((a,b)=>a+b,0):null;
  const missing=costs?Object.keys(COST_LABELS).filter(key=>costs[key]===null):Object.keys(COST_LABELS);
  const assessed=Math.max(trip.budget??0,known??0);
  return {known,missing,balance:trip.budget===null?null:TRAVEL_CAP-trip.budget,
    unallocated:trip.budget===null||known===null?null:trip.budget-known,
    excess:Math.max(0,assessed-TRAVEL_CAP),reserve:costs?.reserve??null};
}
function calendarDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const time=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time/86400000:null;
}
export function dateSpan(start,end){
  const a=calendarDay(start),b=calendarDay(end);
  return a===null||b===null||b<a?null:b-a;
}
export function stayReview(trip){
  const stays=trip.plan?.stays||[],nights=stays.reduce((sum,stay)=>sum+stay.nights,0);
  const span=dateSpan(trip.startDate,trip.endDate),basis=trip.plan?.dateBasis;
  const changed=Boolean(basis&&['startDate','endDate'].some(key=>calendarDay(basis[key])!==null&&basis[key]!==trip[key]));
  const warnings=[];
  if(span!==null&&nights>span+1)warnings.push(`숙박 ${nights}박 가안이 한국 달력상 ${span+1}일 범위보다 큽니다. 숙박 수와 여행 기간을 재검토해 주세요.`);
  if(changed)warnings.push('여행 날짜가 가안 기준과 달라졌습니다. 숙박·이동 구성을 다시 확인해 주세요.');
  const dates=stays.map(stay=>({start:calendarDay(stay.checkIn),end:calendarDay(stay.checkOut)}));
  const departure=calendarDay(trip.startDate),arrival=calendarDay(trip.endDate);
  const outside=[],overlaps=[],reversed=[],gaps=[],lastKnown={start:null,end:null};
  for(let i=0;i<dates.length;i++){
    const current=dates[i];
    // Korean and hotel dates use different zones: allow one calendar day either side.
    if([current.start,current.end].some(day=>day!==null&&(departure!==null&&day<departure-1||arrival!==null&&day>arrival+1)))outside.push(i+1);
    if(current.start!==null&&current.end!==null&&current.end<=current.start)warnings.push(`숙박 ${i+1}의 체크아웃 날짜는 체크인 이후여야 합니다.`);
    for(let j=0;j<i;j++){
      const previous=dates[j];
      if([previous.start,previous.end,current.start,current.end].every(day=>day!==null)&&previous.end>previous.start&&current.end>current.start&&Math.max(previous.start,current.start)<Math.min(previous.end,current.end))overlaps.push(`${j+1}·${i+1}`);
    }
    for(const key of ['start','end']){
      if(current[key]===null)continue;
      const prior=lastKnown[key],pair=prior===null?'':`${prior+1}→${i+1}`;
      if(prior!==null&&current[key]<dates[prior][key]&&!reversed.includes(pair))reversed.push(pair);
      lastKnown[key]=i;
    }
    const previous=dates[i-1];
    if(previous&&previous.end!==null&&current.start!==null&&current.start>previous.end)gaps.push(`${i}→${i+1} (${current.start-previous.end}박)`);
  }
  const brief=items=>items.slice(0,5).join(', ')+(items.length>5?` 외 ${items.length-5}건`:'');
  if(outside.length)warnings.push(`숙박 ${brief(outside)}의 현지 날짜가 한국 여행 기간의 앞뒤 1일 여유 범위를 벗어납니다. 날짜·연도를 확인해 주세요.`);
  if(overlaps.length)warnings.push(`숙박 일정이 겹칩니다: ${brief(overlaps)}. 중복 숙박 여부를 확인해 주세요.`);
  if(reversed.length)warnings.push(`숙박 입력 순서와 현지 날짜 순서가 다릅니다: ${brief(reversed)}.`);
  if(gaps.length)warnings.push(`숙박 사이에 기록되지 않은 기간이 있습니다: ${brief(gaps)}. 숙박 또는 야간 이동을 확인해 주세요.`);
  const dated=dates.filter(({start,end})=>start!==null&&end!==null&&end>start).length;
  if(span===null)warnings.push('한국 출발·도착 날짜를 모두 입력해 주세요.');
  if(!stays.length)warnings.push('숙박 지역과 박 수를 입력해 주세요.');
  return {warnings,nights,dated,span,changed,
    message:warnings.length?warnings.join(' '):dated===stays.length&&stays.length?'입력한 현지 숙박 날짜의 박 수 확인 · 항공·시차 정합성은 별도 검토':`현지 숙박 날짜 ${dated}/${stays.length}곳 입력 · 미입력 숙박의 박 수는 가안입니다.`};
}
export function staySummary(trip){
  const stays=trip.plan?.stays||[];
  return stays.length?stays.map(stay=>`${stay.region} ${stay.nights}박`).join(' → ')+` · 총 ${stays.reduce((sum,stay)=>sum+stay.nights,0)}박 가안`:'숙박 가안 미입력';
}
const cleanAmounts=text=>text.split('\n').map(line=>{
  if(!line.startsWith('초기 계획예산상 '))return line;
  return line.match(/원이며\s*(.+)$/)?.[1]||'';
}).filter(Boolean).join('\n');
// Upgrade only the previously published PRD template; arbitrary user notes stay untouched.
export function upgradeLegacyTrip(trip){
  if(trip.plan!==undefined||!trip.body.includes('Honeymoon_2027_PRD.md'))return trip;
  const blocks=Object.fromEntries(trip.body.split('\n\n').map(block=>{const [heading,...lines]=block.split('\n');return [heading,lines.join('\n')];}));
  const amounts=blocks['2인 전체 여행 비용 배분']?.match(/항공 (\d+)만 \+ 숙박(?: 패키지)? (\d+)만 \+ 기타 여행비 (\d+)만 \+ 예비비 (\d+)만/);
  if(!amounts||!blocks['숙박·체류 제안']||!blocks['5월의 기후 경향'])return trip;
  const lodging=blocks['숙박·체류 제안'];
  const stays=lodging.split('.')[0].split('+').map(part=>{
    const match=part.trim().match(/^(.+?)\s*(\d+)박/);
    return match?{region:match[1].trim().replace(/\s*총$/,''),nights:Number(match[2])}:null;
  }).filter(Boolean);
  const flow=(blocks['일정 가안']||'').replace(/5월 17일 한국 도착 목표/g,'한국 도착 목표');
  const knownHeadings=['여행 조건','숙박·체류 제안','일정 가안','경험 제안','2인 전체 여행 비용 배분','항공·귀국 확인','5월의 기후 경향','자료와 출처'];
  return {...trip,pros:cleanAmounts(trip.pros),cons:cleanAmounts(trip.cons),
    body:Object.entries(blocks).filter(([heading])=>!knownHeadings.includes(heading)).map(([heading,text])=>heading+'\n'+text).join('\n\n'),
    plan:{version:1,costs:Object.fromEntries(Object.keys(COST_LABELS).map((key,index)=>[key,Number(amounts[index+1])*10000])),stays,
      lodgingNotes:lodging.slice(lodging.indexOf('.')+1).trim(),itinerary:flow,experiences:blocks['경험 제안']||'',
      transport:flow||'항공편과 현지 이동 조건 확인 필요',
      climate:blocks['5월의 기후 경향'],climateMonth:5,sourceTitle:(blocks['자료와 출처']||'').split('기후 경향: ')[1]?.split(' · 원문')[0]||'공식 기후 안내',
      checkedOn:'2026-11-04',budgetNotes:trip.id==='maldives'?'숙박 패키지에 식사와 리조트 왕복 이동을 포함시키려는 계획입니다. 실제 포함 범위는 미확인이며 같은 비용을 중복 합산하지 않습니다.':'세금·수하물·식사·이동의 포함 범위는 견적별로 확인해야 합니다.',legacyText:trip.body}};
}
