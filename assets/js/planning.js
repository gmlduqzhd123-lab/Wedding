const known=value=>Number.isSafeInteger(value)&&value>=0;
const venueFields={mealPrice:'1인 식대',guestCount:'예상 하객 수',minGuarantee:'최소 보증인원',hallFee:'대관료·연출료'};

export function venueEstimate(sim={}){
  const missing=Object.entries(venueFields).filter(([key])=>!known(sim?.[key])).map(([,label])=>label);
  const billedGuests=known(sim?.guestCount)&&known(sim?.minGuarantee)?Math.max(sim.guestCount,sim.minGuarantee):null;
  const mealTotal=known(sim?.mealPrice)&&billedGuests!==null?sim.mealPrice*billedGuests:null;
  const components=[mealTotal,known(sim?.hallFee)?sim.hallFee:null].filter(value=>value!==null);
  const subtotal=components.length?components.reduce((sum,value)=>sum+value,0):null;
  const complete=missing.length===0,total=complete?subtotal:null;
  const balance=total!==null&&known(sim?.deposit)?Math.max(0,total-sim.deposit):null;
  const overpaid=total!==null&&known(sim?.deposit)?Math.max(0,sim.deposit-total):0;
  return {missing,billedGuests,mealTotal,subtotal,complete,total,balance,overpaid};
}

export function studioFeeInfo(studio){
  const raw=studio.fee||'',unknown=raw.includes('별도 금액 표기 확인 안 됨');
  return {unknown,label:unknown?'💡 추가금 미확인':`💰 ${raw.replace(/^자료 표기:\s*/,'')}`};
}

export function weddingBudgetSummary(plan={},keys=[]){
  const summarize=field=>{
    const values=keys.map(key=>plan[key]?.[field]).filter(known);
    const entered=values.length,missing=keys.length-entered,complete=keys.length>0&&missing===0;
    return {known:entered?values.reduce((sum,value)=>sum+value,0):null,entered,missing,complete};
  };
  const planned=summarize('planned'),actual=summarize('actual');
  return {planned,actual,difference:planned.complete&&actual.complete?planned.known-actual.known:null};
}

const sdmFields={packageFee:'스드메 기본 계약금',helperFee:'촬영 헬퍼비',extraFee:'원본·보정본·기타 추가금'};

export function sdmEstimate(sim={}){
  const missing=Object.entries(sdmFields).filter(([key])=>!known(sim?.[key])).map(([,label])=>label);
  const roadFee=sim?.roadScene===true?170000:0;
  const nightFee=sim?.nightShoot===true?170000:0;
  const optionTotal=roadFee+nightFee;
  const hasOption=sim?.roadScene===true||sim?.nightShoot===true;
  const components=[
    known(sim?.packageFee)?sim.packageFee:null,
    known(sim?.helperFee)?sim.helperFee:null,
    known(sim?.extraFee)?sim.extraFee:null,
    hasOption?optionTotal:null
  ].filter(value=>value!==null);
  const subtotal=components.length?components.reduce((sum,value)=>sum+value,0):null;
  const complete=missing.length===0;
  const total=complete?sim.packageFee+sim.helperFee+sim.extraFee+optionTotal:null;
  const balance=total!==null&&known(sim?.deposit)?Math.max(0,total-sim.deposit):null;
  const overpaid=total!==null&&known(sim?.deposit)?Math.max(0,sim.deposit-total):0;
  const onSiteCash=known(sim?.helperFee)?sim.helperFee+optionTotal:null;
  return {missing,optionTotal,optionFee:optionTotal,onSiteCash,subtotal,complete,total,balance,overpaid};
}

function shiftIsoDate(dateStr,deltaDays){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr||'');
  if(!m)return null;
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+deltaDays));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function shootDeadlineSummary(shootDateStr,now=new Date()){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(shootDateStr||'');
  if(!m)return null;
  const targetDay=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const kst=new Date(now.getTime()+9*3600*1000);
  const todayKst=Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate());
  const daysLeft=Math.round((targetDay-todayKst)/86400000);
  const nightDeadline=shiftIsoDate(shootDateStr,-7);
  const preHolidayDate=shiftIsoDate(shootDateStr,-3);
  let penaltyIndex=-1,penaltyLabel='촬영일 경과';
  if(daysLeft>90){penaltyIndex=-1;penaltyLabel='위약금 부과 전 (90일 초과 전)';}
  else if(daysLeft>=61){penaltyIndex=0;penaltyLabel='현재 90일 전 구간 (취소 22만 / 변경 11만)';}
  else if(daysLeft>=31){penaltyIndex=1;penaltyLabel='현재 60일 전 구간 (취소 33만 / 변경 22만)';}
  else if(daysLeft>=21){penaltyIndex=2;penaltyLabel='현재 30일 전 구간 (취소 44만 / 변경 33만)';}
  else if(daysLeft>=11){penaltyIndex=3;penaltyLabel='현재 20일 전 구간 (취소 55만 / 변경 44만)';}
  else if(daysLeft>=1){penaltyIndex=4;penaltyLabel='현재 10일 전 구간 (취소 66만 / 변경 55만)';}
  else if(daysLeft===0){penaltyIndex=5;penaltyLabel='촬영 당일 구간 (취소 77만 / 변경 66만)';}
  return {
    daysLeft,
    nightDeadline,
    nightDaysLeft:daysLeft-7,
    preHolidayDate,
    preHolidayDaysLeft:daysLeft-3,
    penaltyIndex,
    penaltyLabel
  };
}
