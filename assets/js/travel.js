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
export function isBundledPackageTrip(trip){
  const title=trip?.title||'',id=trip?.id||'';
  return /^\[[^\]]+\]/.test(title)||/^pkg-/.test(id)||/(패키지|세미패키지|올인클루시브)/.test(title);
}
export function formatCostAllocation(trip,key,fallback='미확인'){
  const costs=trip?.plan?.costs||{},val=costs[key];
  if(val===null||val===undefined)return fallback;
  if(key==='airfare'&&val===0&&(costs.lodging||0)>0&&isBundledPackageTrip(trip))return '패키지 통합 포함 (0원)';
  return `${val.toLocaleString('ko-KR')}원`;
}
export function currentBudgetText(trip){
  const costs=trip.plan?.costs||{},nights=(trip.plan?.stays||[]).reduce((sum,s)=>sum+s.nights,0);
  return Object.entries(COST_LABELS).map(([key,label])=>`${label} ${formatCostAllocation(trip,key)}`).join(' · ')+(nights&&costs.lodging!==null&&costs.lodging!==undefined?` · 현재 ${nights}박 기준 숙박·패키지 1박당 배분 약 ${Math.round(costs.lodging/nights).toLocaleString('ko-KR')}원`: '');
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

export function tripFlightBadge(item){
  const line=(item?.plan?.transport||'').split(/\r?\n/)[0]||'';
  const cleaned=line
    .replace(/^\d{4}-\d{2}-\d{2}\s*(조회|조사(?:\s*당시)?)\s*항공:\s*/,'')
    .replace(/\s*직항\s*기준\s*패키지\s*구성\.?$/,'')
    .replace(/\s*Economy\s*(Standard|Saver)/i,'')
    .replace(/\s*\([^)]*\)/g,'')
    .trim();
  const text=`${line} ${item?.plan?.itinerary||''} ${item?.plan?.quote?.flightSource||''}`;
  if(/직항/.test(text)&&!/경유/.test(line)){
    const airline=cleaned.split('.')[0]?.replace(/\s*직항$/,'').trim();
    return {direct:true,short:'✈️ 직항',detail:airline?`✈️ ${airline} · 직항`:'✈️ 인천 출발 직항'};
  }
  if(/경유/.test(text)){
    const airline=cleaned.split('.')[0]?.trim()||'';
    const hop=line.match(/(?:왕복\s*)?([A-Z·]+\s*)?\d회 경유/)?.[0]?.replace(/^왕복\s*/,'')||'경유';
    return {direct:false,short:`✈️ ${hop}`,detail:airline?`✈️ ${airline} · ${hop}`:`✈️ ${hop}`};
  }
  return {direct:false,short:'✈️ 항공 미정',detail:'✈️ 항공편 별도 확인'};
}

export const CORE_REGION_KEYS = ['cebu', 'bali', 'hawaii', 'guam'];

export const REGION_DEFS = [
  { key: 'cebu', label: '세부', flag: '🇵🇭', core: true, currencyCode: 'PHP', currencyUnit: 1, rateHint: '예: 1 PHP ≈ 24.5원 (직접 입력)' },
  { key: 'bali', label: '발리', flag: '🇮🇩', core: true, currencyCode: 'IDR', currencyUnit: 100, rateHint: '예: 100 IDR ≈ 8.5원 (직접 입력)' },
  { key: 'hawaii', label: '하와이', flag: '🇺🇸', core: true, currencyCode: 'USD', currencyUnit: 1, rateHint: '예: 1 USD ≈ 1,380원 (직접 입력)' },
  { key: 'guam', label: '괌', flag: '🇬🇺', core: true, currencyCode: 'USD', currencyUnit: 1, rateHint: '예: 1 USD ≈ 1,380원 (직접 입력)' },
  { key: 'nhatrang', label: '나트랑', flag: '🇻🇳', core: false, currencyCode: 'VND', currencyUnit: 1000, rateHint: '예: 1,000 VND ≈ 55원 (직접 입력)' },
  { key: 'danang', label: '다낭·호이안', flag: '🇻🇳', core: false, currencyCode: 'VND', currencyUnit: 1000, rateHint: '예: 1,000 VND ≈ 55원 (직접 입력)' },
  { key: 'other', label: '기타 지역', flag: '✈️', core: false, currencyCode: 'USD', currencyUnit: 1, rateHint: '예: 1 USD ≈ 1,380원 (직접 입력)' }
];

export function tripRegionInfo(item = {}) {
  const text = `${item.id || ''} ${item.title || ''} ${item.country || ''}`;
  if (/cebu|세부|막탄|보홀|필리핀/i.test(text)) return REGION_DEFS[0];
  if (/bali|발리|짐바란|누사두아|우붓|스미냑/i.test(text)) return REGION_DEFS[1];
  if (/hawaii|하와이|와이키키|오아후/i.test(text)) return REGION_DEFS[2];
  if (/guam|괌|투몬/i.test(text)) return REGION_DEFS[3];
  if (/nhatrang|나트랑|깜라인|깜란/i.test(text)) return REGION_DEFS[4];
  if (/danang|다낭|호이안|미케/i.test(text)) return REGION_DEFS[5];
  return REGION_DEFS[6];
}

export function isCoreRegionTrip(item = {}) {
  return CORE_REGION_KEYS.includes(tripRegionInfo(item).key);
}

export const CORE_DESTINATION_GUIDES = {
  cebu: {
    key: 'cebu',
    name: '세부 · 막탄',
    flag: '🇵🇭',
    tagline: '4.5시간 직항 · 가성비 최강 프라이빗 비치 & 스파 휴양',
    flightTime: '인천 직항 약 4시간 30분 · 시차 -1시간',
    stayPattern: '현지 6박 (6/6 저녁 출발 → 6/13 새벽 귀국)',
    juneWeather: '🌦️ 6월 전환기 · PAGASA 제3기후형(오후·저녁 스콜 유의)',
    entryRule: '30일 무비자 · 공식 eTravel(etravel.gov.ph, 무료) · PHP',
    vibe: '예식 직후 피로를 줄여 주는 짧은 비행과 막탄 공항에서 차량 20~30분 거리의 대형 5성 비치 리조트들이 강점입니다. 460만~640만 원대 예산으로도 샹그릴라·크림슨 풀빌라·쉐라톤 등 수준 높은 리조트 휴양과 호핑·커플 스파·씨푸드 미식을 넉넉하게 누릴 수 있습니다.',
    areas: '막탄 섬 푼타엔가뇨(샹그릴라·쉐라톤·두짓타니 — 조용한 프라이빗 비치)와 마리바고/라푸라푸(크림슨 풀빌라·플랜테이션 베이 라군 — 맛집·마사지 접근성 우수) 두 축이 대표적입니다.',
    highlights: [
      '리조트 전용 산호초 해변 스노클링 & 올랑고·날루수안 프라이빗 호핑투어',
      'CHI 스파·아움 스파·모감보 스프링스 등 5성급 커플 트리트먼트',
      '선셋 씨푸드 디너·아쥬르/부히 바 칵테일 및 세부 시티·보홀 선택 일정'
    ],
    bestFor: '비행·이동 피로를 최소화하면서 500만 원 전후 예산으로 5성 리조트·호핑·마사지를 알차게 즐기고 싶은 커플',
    caution: '6월 스콜성 소나기에 대비해 호핑투어는 오전 출발이 유리하며, 심야 귀국편(예: KE602 00:15) 이용 시 마지막 날 레이트 체크아웃·마사지 귀국 동선을 미리 확보하세요.'
  },
  bali: {
    key: 'bali',
    name: '발리 · 누사두아·짐바란·우붓',
    flag: '🇮🇩',
    tagline: '6월 최적 건기 · 프라이빗 풀빌라 & 선셋 미식의 정석',
    flightTime: '인천 직항 약 7시간 · 시차 -1시간',
    stayPattern: '현지 6박 (6/6 출발 → 6/13 오전 도착)',
    juneWeather: '☀️ 6월 최적 건기 · BMKG 기준 4~10월 건기 한가운데',
    entryRule: '도착비자(e-VOA) + Love Bali 관광세 · IDR',
    vibe: '4대 핵심 여행지 중 6월 날씨 만족도가 가장 높은 대표 건기 휴양지입니다. 오션뷰 대형 리조트와 숲·절벽 프라이빗 풀빌라를 조합해 플로팅 조식, 짐바란 일몰 씨푸드, 발리 전통 스파, 우붓 정글 감성까지 허니문 로망을 균형 있게 채울 수 있습니다.',
    areas: '누사두아(조용한 5성 해변 리조트), 짐바란·울루와뚜(절벽 풀빌라·선셋 명소), 우붓(정글 인피니티풀·발리 스윙) 중 1~2개 권역을 믹스하는 동선이 인기입니다.',
    highlights: [
      '프라이빗 풀빌라 플로팅 조식 & 인피니티풀 여유 휴양',
      '짐바란 비치 씨푸드 선셋 디너 & 울루와뚜 절벽 사원·비치클럽',
      '발리 전통 아로마 커플 스파 & 우붓 정글 카페·논뷰 인생샷'
    ],
    bestFor: '6월 가장 쾌적한 건기 속에서 프라이빗 풀빌라·스파·감성 미식을 고루 누리고 싶은 커플',
    caution: '꾸따·스미냑·우붓 간 차량 정체가 잦아 하루 1개 권역 중심으로 동선을 짜고, 발리밸리 대비 생수 음용·샤워기 필터 및 도착비자·관광부담금을 챙겨 두세요.'
  },
  hawaii: {
    key: 'hawaii',
    name: '하와이 · 오아후 와이키키',
    flag: '🇺🇸',
    tagline: '6월 맑은 여름 · 와이키키 휴양·쇼핑·드라이브 허니문 로망',
    flightTime: '인천 직항 약 8~9시간 · 시차 -19시간',
    stayPattern: '현지 6박 (6/6 출발·당일 오전 도착 → 6/13 오후 귀국)',
    juneWeather: '🌴 6월 맑은 여름철 · HTA 기준 5~10월 무역풍 여름 시즌',
    entryRule: '미국 ESTA 사전 승인 필수 · USD (팁 15~20%)',
    vibe: '평생 한 번뿐인 허니문 로망으로 꾸준히 꼽히는 종합 휴양·도시 여행지입니다. 6월 무역풍이 불어 쾌적한 와이키키 해변을 거점으로 도보 쇼핑과 파인다이닝, 에메랄드빛 동부·노스쇼어 해안 드라이브까지 한 섬(오아후) 안에서 모두 누릴 수 있습니다.',
    areas: '와이키키 비치 중심(해변·레스토랑·알라모아나 접근성 최고)이 기본이며, 여유로운 휴양을 원하면 카할라·코올리나 권역을 연계합니다. 6박 일정은 섬 간 이동 없이 오아후 집중이 효율적입니다.',
    highlights: [
      '와이키키 비치 선셋 산책 & 다이아몬드 헤드 아침 전망 트레킹',
      '카일루아·라니카이·노스쇼어 오픈카 해안 드라이브 & 새우트럭',
      '알라모아나 센터·와이켈레 아울렛 쇼핑 & 스테이크·포케 미식'
    ],
    bestFor: '휴양만 하기보다 바다·도시 미식·쇼핑·해안 드라이브를 한 번에 즐기고 싶은 허니문 로망파 커플',
    caution: '숙박 세금·리조트피(1박 $40~$55+ 별도 확인)·식비·팁 부담이 커 820만~980만 원 이상 예산 여유가 필요하며, 렌터카 시 국제+국내면허증 원본을 지참해야 합니다.'
  },
  guam: {
    key: 'guam',
    name: '괌 · 투몬 비치',
    flag: '🇬🇺',
    tagline: '4.5시간 최단거리 · 공항 15분 투몬 비치 & 여유로운 7박',
    flightTime: '인천 직항 약 4시간 30분 · 시차 +1시간',
    stayPattern: '현지 7박 가능 (6/6 낮 출발 → 6/13 저녁 한국 도착)',
    juneWeather: '🌦️ 6월 전환기 · GVB 기준 건기→우기 초입(짧은 소나기 유의)',
    entryRule: 'G-CNMI ETA(무료) 또는 ESTA + 전자세관신고(EDF) · USD',
    vibe: '비행 4시간 30분·시차 +1시간·공항에서 투몬 비치 호텔까지 차로 10~15분으로 4대 핵심 지역 중 이동 피로가 가장 적습니다. 깔끔한 미국령 인프라 속에서 에메랄드빛 투몬 베이 휴양, 남부 해안 드라이브, 면세 쇼핑을 여유롭게 7박 일정으로 즐길 수 있습니다.',
    areas: '투몬 비치 한 권역(더 츠바키 타워·두짓타니·롯데호텔·하얏트 등)에 5성 호텔·레스토랑·면세 쇼핑몰이 모여 있어 도보 및 단거리 이동만으로 쾌적하게 지낼 수 있습니다.',
    highlights: [
      '투몬 베이 맑은 바다 스노클링 & 5성 호텔 인피니티풀 선셋',
      '사랑의 절벽·세티베이·메리조 부두 남부 해안 1일 렌터카 드라이브',
      '돌핀 크루즈·별빛 투어 & T갤러리아·마이크로네시아몰·GPO 면세 쇼핑'
    ],
    bestFor: '장거리 비행·시차 부담 없이 짧은 동선으로 깔끔한 리조트 휴양·면세 쇼핑·여유로운 7박을 원하는 커플',
    caution: '6월 전환기 소나기·바람에 대비해 쇼핑몰·스파 등 실내 대안을 함께 두고, 객실 세금(약 11%)·리조트피·미국령 식비·팁·렌터카 보험료를 총예산에 미리 반영하세요.'
  }
};

export const MORE_DESTINATION_NOTES = {
  nhatrang: '🇻🇳 나트랑 (깜라인 6박) — 6월 덥고 맑은 시기 · 480만~610만 원대 가성비 풀빌라 중심',
  danang: '🇻🇳 다낭·호이안 (7박) — 418만~780만 원대 · 해변 리조트 + 호이안 야경·올인클루시브 스파'
};

export function isPoolvillaTrip(item = {}) {
  return /풀빌라/.test(`${item.title || ''} ${(item.plan?.stays || []).map(s => s.region).join(' ')} ${item.plan?.lodgingNotes || ''}`);
}

export function isNoShoppingTrip(item = {}) {
  return /노쇼핑|노옵션/.test(`${item.title || ''} ${item.pros || ''} ${item.plan?.lodgingNotes || ''} ${item.plan?.transport || ''}`);
}

export function isSemiPackageTrip(item = {}) {
  return isBundledPackageTrip(item) && /세미패키지|반자유|우리끼리/.test(`${item.title || ''} ${item.pros || ''}`);
}

export function buildRegionMatrix(trips = [], { coreOnly = false } = {}) {
  const list = Array.isArray(trips) ? trips : [];
  const groups = new Map();
  for (const trip of list) {
    const info = tripRegionInfo(trip);
    if (coreOnly && !info.core) continue;
    if (!groups.has(info.key)) groups.set(info.key, { ...info, items: [] });
    groups.get(info.key).items.push(trip);
  }
  const orderedKeys = REGION_DEFS.map(d => d.key).filter(k => groups.has(k));
  return orderedKeys.map(key => {
    const group = groups.get(key);
    const items = [...group.items].sort((a, b) => (a.budget ?? Infinity) - (b.budget ?? Infinity));
    const budgets = items.map(t => t.budget).filter(b => typeof b === 'number' && Number.isFinite(b));
    const fitTrip = items.find(t => !isBundledPackageTrip(t)) || null;
    const pkgTrips = items.filter(t => isBundledPackageTrip(t));
    const pkgBudgets = pkgTrips.map(t => t.budget).filter(b => typeof b === 'number' && Number.isFinite(b));
    const minBudget = budgets.length ? Math.min(...budgets) : null;
    const maxBudget = budgets.length ? Math.max(...budgets) : null;
    const avgBudget = budgets.length ? Math.round(budgets.reduce((s, v) => s + v, 0) / budgets.length) : null;
    const pkgMinBudget = pkgBudgets.length ? Math.min(...pkgBudgets) : null;
    const fitVsPkgDiff = (fitTrip?.budget != null && pkgMinBudget != null) ? (pkgMinBudget - fitTrip.budget) : null;
    return {
      key: group.key,
      label: group.label,
      flag: group.flag,
      core: Boolean(group.core),
      currencyCode: group.currencyCode,
      count: items.length,
      minBudget,
      maxBudget,
      avgBudget,
      fitTrip,
      pkgTrips,
      pkgMinBudget,
      fitVsPkgDiff,
      dryCount: items.filter(t => climateBadgeInfo(t).dry).length,
      poolvillaCount: items.filter(isPoolvillaTrip).length,
      noshoppingCount: items.filter(isNoShoppingTrip).length,
      items
    };
  });
}

export function recommendHoneymoonTrips(trips = [], { maxBudget = 10000000, style = 'any', priority = 'balanced', region = 'all' } = {}) {
  const pool = (Array.isArray(trips) ? trips : []).filter(t => {
    if (region === 'all') return true;
    if (region === 'core') return isCoreRegionTrip(t);
    return tripRegionInfo(t).key === region;
  });
  const scored = pool.map(trip => {
    let score = 50;
    const reasons = [];
    const budget = typeof trip.budget === 'number' ? trip.budget : null;
    const isPkg = isBundledPackageTrip(trip);
    const isSemi = isSemiPackageTrip(trip);
    const isPool = isPoolvillaTrip(trip);
    const isNoShop = isNoShoppingTrip(trip);
    const isDry = climateBadgeInfo(trip).dry;

    if (budget !== null) {
      if (budget <= maxBudget) {
        score += 24;
        reasons.push(`예산 ${Math.round(maxBudget / 10000).toLocaleString('ko-KR')}만 이내`);
      } else if (budget <= maxBudget * 1.1) {
        score += 4;
      } else {
        score -= 24;
      }
    }

    if (style === 'fit') {
      if (!isPkg) { score += 26; reasons.push('자유여행 직접조회'); }
      else score -= 10;
    } else if (style === 'semi') {
      if (isSemi) { score += 26; reasons.push('반자유·세미패키지'); }
      else if (!isPkg) score += 6;
      else score -= 4;
    } else if (style === 'package') {
      if (isPkg) { score += 22; reasons.push('여행사 패키지'); }
      else score -= 10;
    }

    if (priority === 'poolvilla') {
      if (isPool) { score += 28; reasons.push('풀빌라 포함'); }
      if (isNoShop) { score += 6; reasons.push('노쇼핑·노옵션'); }
    } else if (priority === 'noshopping') {
      if (isNoShop) { score += 28; reasons.push('노쇼핑·노옵션'); }
      if (isPool) { score += 6; reasons.push('풀빌라 포함'); }
    } else if (priority === 'dry') {
      if (isDry) { score += 28; reasons.push('6월 건기·맑음'); }
      if (isPool) score += 6;
    } else if (priority === 'value') {
      if (budget !== null) {
        const savingRatio = Math.max(0, Math.min(1, (10000000 - budget) / 6000000));
        score += Math.round(savingRatio * 30);
        if (budget <= 6000000) reasons.push('600만 이하 가성비');
      }
      if (isNoShop) score += 4;
    } else {
      if (isDry) { score += 10; reasons.push('6월 건기 경향'); }
      if (isPool) { score += 9; reasons.push('풀빌라 포함'); }
      if (isNoShop) { score += 9; reasons.push('노쇼핑·노옵션'); }
      if (budget !== null && budget <= 7500000) score += 6;
    }

    if (!reasons.length && isDry) reasons.push('6월 건기 경향');
    return { trip, score, reasons: [...new Set(reasons)].slice(0, 3) };
  });

  scored.sort((a, b) => b.score - a.score || (a.trip.budget ?? Infinity) - (b.trip.budget ?? Infinity));
  return scored.slice(0, 3);
}

export const REGION_PACKING_SUGGESTIONS = {
  cebu: {
    label: '🇵🇭 세부 맞춤 필수 준비물',
    items: [
      { category: '📄 필수 서류·결제', title: '필리핀 공식 전자입국신고서(eTravel, etravel.gov.ph) QR 및 여권(유효기간 6개월+)' },
      { category: '🔌 전자기기·통신', title: '그랩(Grab) 앱 사전 설치·카드 등록 및 페소(PHP) 소액 현금·트래블카드' },
      { category: '🏖️ 의류·해변 용품', title: '호핑·스노클링용 방수팩·아쿠아슈즈·래시가드 및 여분 수영복' },
      { category: '💊 상비약·세면·기타', title: '6월 스콜 대비 접이식 우양산, 여행용 샤워기 필터 및 모기기피제' }
    ]
  },
  bali: {
    label: '🇮🇩 발리 맞춤 필수 준비물',
    items: [
      { category: '📄 필수 서류·결제', title: '발리 관광부담금(Love Bali) 납부 QR 및 도착비자(e-VOA) 확인' },
      { category: '💊 상비약·세면·기타', title: '발리밸리 대비 정장제·지사제·전해질 분말 및 샤워기 리필 필터' },
      { category: '🔌 전자기기·통신', title: '그랩(Grab)·고젝(Gojek) 앱 사전 가입 및 해외결제 카드 등록' },
      { category: '🏖️ 의류·해변 용품', title: '우붓 사원·스윙 방문용 가벼운 겉옷·스카프 및 모기기피제' }
    ]
  },
  hawaii: {
    label: '🇺🇸 하와이 맞춤 필수 준비물',
    items: [
      { category: '📄 필수 서류·결제', title: '미국 ESTA 전자여행허가 승인서 출력본 및 국제운전면허증+국내면허증' },
      { category: '📄 필수 서류·결제', title: '팁용 소액 달러 지폐 ($1·$5 다수) 및 컨택리스 신용카드' },
      { category: '🔌 전자기기·통신', title: '110V 돼지코 어댑터 (미국 A타입, 프리볼트 여부 확인)' },
      { category: '🏖️ 의류·해변 용품', title: '산호 친화(Reef-Safe) 선크림 (하와이 규정) 및 스노클링 장비' }
    ]
  },
  guam: {
    label: '🇬🇺 괌 맞춤 필수 준비물',
    items: [
      { category: '📄 필수 서류·결제', title: '괌 전자세관신고서(EDF) QR 및 G-CNMI ETA(또는 ESTA) 확인' },
      { category: '📄 필수 서류·결제', title: '국제운전면허증 + 한국 면허증 원본 (렌터카 픽업 필수)' },
      { category: '🔌 전자기기·통신', title: '110V 돼지코 어댑터 (미국 A타입) 및 차량용 스마트폰 거치대' },
      { category: '🏖️ 의류·해변 용품', title: '산호 친화 선크림 · 팁용 소액 달러 ($1·$5) 및 방수 파우치' }
    ]
  },
  nhatrang: {
    label: '🇻🇳 나트랑 맞춤 필수 준비물',
    items: [
      { category: '🔌 전자기기·통신', title: '그랩(Grab) 앱 사전 설치·카드 등록 및 현지 eSIM' },
      { category: '📄 필수 서류·결제', title: '트래블카드(VND 환전) + 팁·야시장용 소액 동(VND) 현금' },
      { category: '💊 상비약·세면·기타', title: '샤워기 필터 여분 및 모기기피제·수딩젤 (강한 자외선 대비)' },
      { category: '🏖️ 의류·해변 용품', title: '호핑투어·머드스파용 여분 수영복 및 스마트폰 방수팩' }
    ]
  },
  danang: {
    label: '🇻🇳 다낭·호이안 맞춤 필수 준비물',
    items: [
      { category: '🔌 전자기기·통신', title: '그랩(Grab) 앱 사전 설치 및 바나힐·호이안 이동용 보조배터리' },
      { category: '🏖️ 의류·해변 용품', title: '바나힐 고지대(서늘함) 대비 얇은 긴팔 겉옷 및 호이안 스냅 의상' },
      { category: '📄 필수 서류·결제', title: '트래블카드(VND) 및 호이안 야시장·팁용 소액 동(VND) 현금' },
      { category: '💊 상비약·세면·기타', title: '여행용 샤워기 필터 및 우양산 (갑작스러운 소나기·햇볕 대비)' }
    ]
  }
};

export const HONEYMOON_AGENCY_QUESTIONS = [
  '허니문 특전(스파·플로팅 조식·스냅·와인 등) 적용 조건과 청첩장 제출 기한이 어떻게 되나요?',
  '안내된 금액에 항공 유류할증료·공항세·현지 세금 및 가이드·기사 팁이 모두 포함인가요?',
  '노쇼핑·노옵션 상품인 경우, 현지에서 선택관광이나 팁 등 추가 필수 경비가 전혀 없나요?',
  '귀국편이 밤 비행기인 경우 체크아웃 후 레이트 체크아웃 또는 짐 보관·라운지 이용이 포함되나요?',
  '객실 업그레이드(풀빌라·오션뷰)나 허니문 베드 데코레이션 요청 시 추가 비용이 있나요?',
  '항공권 발권 전·후 취소 및 날짜 변경 시 위약금 발생 기준일(D-며칠)이 어떻게 되나요?',
  '해외여행자보험 보장 한도와 공항↔리조트 왕복 단독 픽업 차량 포함 여부를 확인하고 싶습니다.'
];

export function calculateLocalSpending({ nights = 6, dailyFood = 0, activities = 0, spa = 0, transport = 0, tips = 0, shopping = 0, fxRate = 0, currencyUnit = 1 } = {}) {
  const safe = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
  const stayNights = Math.max(1, Math.min(30, safe(nights) || 6));
  const foodTotal = safe(dailyFood) * stayNights;
  const totalKrw = foodTotal + safe(activities) + safe(spa) + safe(transport) + safe(tips) + safe(shopping);
  const perDayKrw = Math.round(totalKrw / stayNights);
  const perPersonKrw = Math.round(totalKrw / 2);
  const rate = Number(fxRate);
  const unit = Number(currencyUnit) > 0 ? Number(currencyUnit) : 1;
  const foreignTotal = Number.isFinite(rate) && rate > 0 ? Math.round((totalKrw / rate) * unit) : null;
  return { stayNights, foodTotal, totalKrw, perDayKrw, perPersonKrw, foreignTotal };
}

function formatPrivateQuoteLine(item, pq) {
  if (!pq || typeof pq !== 'object') return '';
  const fmt = v => `${v.toLocaleString('ko-KR')}원`;
  const eff = typeof pq.total === 'number'
    ? pq.total
    : ((typeof pq.airfare === 'number' || typeof pq.lodging === 'number') ? (pq.airfare || 0) + (pq.lodging || 0) : null);
  let delta = '';
  if (eff !== null && typeof item?.budget === 'number' && Number.isFinite(item.budget)) {
    const diff = eff - item.budget;
    const man = Math.round(Math.abs(diff) / 10000).toLocaleString('ko-KR');
    delta = diff < 0 ? `계획 대비 -${man}만 절감` : diff > 0 ? `계획 대비 +${man}만 초과` : '계획예산 동일';
  }
  const parts = [
    eff !== null ? fmt(eff) : '',
    delta ? `(${delta})` : '',
    pq.agency ? pq.agency : '',
    pq.perks ? pq.perks : '',
    pq.cancelUntil ? `무료취소 ~${pq.cancelUntil}` : ''
  ].filter(Boolean);
  return parts.join(' · ');
}

export function buildTripComparisonText(items = [], prefs = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const fmt = v => (v === null || v === undefined ? '미정' : `${v.toLocaleString('ko-KR')}원`);
  const lines = [`[신혼여행 후보 ${list.length}곳 비교 요약]`, ''];
  list.forEach((item, idx) => {
    const note = prefs?.tripNotes?.[item.id] ? ` | 메모: ${prefs.tripNotes[item.id]}` : '';
    const pqLine = formatPrivateQuoteLine(item, prefs?.tripQuotes?.[item.id]);
    lines.push(`${idx + 1}. ${item.title}`);
    lines.push(`   • 일정: ${item.startDate || '미정'} ~ ${item.endDate || '미정'} (${staySummary(item)})`);
    lines.push(`   • 2인 계획예산: ${fmt(item.budget)} (${tripFlightBadge(item).short} · ${climateBadgeInfo(item).label})`);
    if (pqLine) lines.push(`   • 내 실견적(개인): ${pqLine}`);
    if (item.pros) lines.push(`   • 장점: ${item.pros.split(/\r?\n/)[0]}`);
    if (item.cons) lines.push(`   • 고민: ${item.cons.split(/\r?\n/)[0]}${note}`);
  });
  const budgets = list.filter(i => typeof i.budget === 'number');
  if (budgets.length >= 2) {
    const sorted = [...budgets].sort((a, b) => a.budget - b.budget);
    const gap = sorted[sorted.length - 1].budget - sorted[0].budget;
    lines.push('', `▶ 최저 예산: ${sorted[0].title} (${fmt(sorted[0].budget)}, 최고안 대비 ${fmt(gap)} 절감)`);
  }
  return lines.join('\n');
}

export function buildSelectedTripSummaryText(item, note = '', privateQuote = null) {
  if (!item) return '';
  const fmt = v => (v === null || v === undefined ? '미정' : `${v.toLocaleString('ko-KR')}원`);
  const pqLine = formatPrivateQuoteLine(item, privateQuote);
  const lines = [
    `[신혼여행 최종 선택 후보 요약 · ${item.title}]`,
    `• 여행지: ${item.country || '미정'}`,
    `• 일정: ${item.startDate || '미정'} 한국 출발 → ${item.endDate || '미정'} 한국 도착`,
    `• 숙박 구성: ${staySummary(item)}`,
    `• 항공·기후: ${tripFlightBadge(item).detail} · ${climateBadgeInfo(item).label}`,
    `• 2인 계획예산: ${fmt(item.budget)} (${currentBudgetText(item)})`
  ];
  if (pqLine) lines.push(`• 내 실견적(개인 기록): ${pqLine}`);
  if (note?.trim()) lines.push(`• 상담 메모: ${note.trim()}`);
  return lines.join('\n');
}

