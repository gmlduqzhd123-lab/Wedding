export const TRAVEL_CAP=10000000;
export const COST_LABELS={airfare:'항공',lodging:'숙박·패키지',other:'기타 여행비',reserve:'예비비'};
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
export function dateSpan(start,end){
  const parse=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const time=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time:null;
  };
  const a=parse(start),b=parse(end);
  return a===null||b===null||b<a?null:(b-a)/86400000;
}
export function stayReview(trip){
  const stays=trip.plan?.stays||[],nights=stays.reduce((sum,stay)=>sum+stay.nights,0);
  const span=dateSpan(trip.startDate,trip.endDate),basis=trip.plan?.dateBasis;
  const warnings=[];
  if(span!==null&&nights>span+1)warnings.push(`숙박 ${nights}박 가안이 한국 달력상 ${span+1}일 범위보다 큽니다. 숙박 수와 여행 기간을 재검토해 주세요.`);
  if(basis&&(basis.startDate!==trip.startDate||basis.endDate!==trip.endDate))warnings.push('여행 날짜가 가안 기준과 달라졌습니다. 숙박·이동 구성을 다시 확인해 주세요.');
  const dated=stays.filter(stay=>stay.checkIn&&stay.checkOut).length;
  if(span===null)warnings.push('한국 출발·도착 날짜를 모두 입력해 주세요.');
  if(!stays.length)warnings.push('숙박 지역과 박 수를 입력해 주세요.');
  return {warnings,nights,dated,span,changed:Boolean(basis&&(basis.startDate!==trip.startDate||basis.endDate!==trip.endDate)),
    message:warnings.length?warnings.join(' '):dated===stays.length&&stays.length?'입력한 현지 숙박 날짜의 박 수 확인 · 항공·시차 정합성은 별도 검토':'현지 체크인·체크아웃 미입력 · 숙박 박 수는 가안입니다.'};
}
export function staySummary(trip){
  const stays=trip.plan?.stays||[];
  return stays.length?stays.map(stay=>`${stay.region} ${stay.nights}박`).join(' + ')+` · 총 ${stays.reduce((sum,stay)=>sum+stay.nights,0)}박 가안`:'숙박 가안 미입력';
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
