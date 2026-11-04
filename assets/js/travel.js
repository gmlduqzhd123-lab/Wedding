export const TRAVEL_CAP=10000000;
export const COST_LABELS={airfare:'항공',lodging:'숙박·패키지',other:'기타 여행비',reserve:'예비비'};
export function budgetSummary(trip){
  const costs=trip.plan?.costs;
  const known=costs?Object.values(costs).filter(value=>value!==null).reduce((a,b)=>a+b,0):null;
  const missing=costs?Object.keys(COST_LABELS).filter(key=>costs[key]===null):Object.keys(COST_LABELS);
  const assessed=Math.max(trip.budget??0,known??0);
  return {known,missing,balance:trip.budget===null?null:TRAVEL_CAP-trip.budget,
    unallocated:trip.budget===null||known===null?null:trip.budget-known,
    excess:Math.max(0,assessed-TRAVEL_CAP),reserve:costs?.reserve??null};
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
