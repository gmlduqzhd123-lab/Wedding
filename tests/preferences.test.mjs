import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreferences, parsePreferencesBackup, persistPreferences, pruneTripPreferences, pruneContentPreferences, mergePreferences, summarizePreferencesMerge } from '../assets/js/preferences.js';

test('private backup preserves notes and choices independently of public content',()=>{
  const preferences=validatePreferences({favorites:['s01'],notes:{s01:'개인 상담 메모'},left:'s01',right:'s02',tripCompare:['trip1','trip2','trip3'],tripFavorites:['trip1'],tripSelected:'trip2'});
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences});
  assert.deepEqual(parsePreferencesBackup(raw),preferences);
  assert.throws(()=>parsePreferencesBackup('{'));
  assert.throws(()=>parsePreferencesBackup(JSON.stringify({schemaVersion:1,invitation:{}})));
});
test('malformed preferences are rejected before any storage write',()=>{
  let writes=0;const storage={setItem(){writes++;}};
  for(const next of [{favorites:'s01'},{notes:[]},{notes:{s01:123}},{tripCompare:['a','b','c','d']},{left:4}])assert.throws(()=>persistPreferences(storage,'prefs',next));
  assert.equal(writes,0);
});
test('failed persistence leaves caller state unchanged',()=>{
  let prefs=validatePreferences({favorites:['s01']});
  const before=structuredClone(prefs);
  assert.throws(()=>{prefs=persistPreferences({setItem(){throw new Error('quota');}},'prefs',{...prefs,favorites:['s02']});});
  assert.deepEqual(prefs,before);
  let stored;
  prefs=persistPreferences({setItem(key,value){stored=JSON.parse(value);}},'prefs',{...prefs,favorites:['s02']});
  assert.deepEqual(prefs,stored);assert.deepEqual(prefs.favorites,['s02']);
});

test('removed trip choices are pruned without changing studio preferences or the input',()=>{
  const prefs=validatePreferences({favorites:['s01'],notes:{s01:'개인 메모'},left:'s01',tripFavorites:['old','kept'],tripCompare:['old','kept'],tripSelected:'old',tipFavorites:['tip-old','tip-kept'],tipNotes:{'tip-old':'삭제될 메모','tip-kept':'유지할 메모'}});
  const before=structuredClone(prefs),clean=pruneTripPreferences(prefs,[{id:'kept'}]);
  assert.deepEqual(clean.tripCompare,['kept']);assert.deepEqual(clean.tripFavorites,['kept']);assert.equal(clean.tripSelected,undefined);
  assert.deepEqual(clean.notes,prefs.notes);assert.deepEqual(clean.favorites,prefs.favorites);assert.equal(clean.left,'s01');assert.deepEqual(prefs,before);
  const contentClean=pruneContentPreferences(prefs,{honeymoon:[{id:'kept'}],tips:[{id:'tip-kept'}]});
  assert.deepEqual(contentClean.tripCompare,['kept']);assert.deepEqual(contentClean.tipFavorites,['tip-kept']);assert.deepEqual(contentClean.tipNotes,{'tip-kept':'유지할 메모'});
  assert.deepEqual(prefs,before);
});
test('checklist, budgetPlan, packingList, customPackingList, checklistNotes, customChecklist, ceremonyPlan, venueSim, and studioSelected persist in private preferences backup and reject invalid values',()=>{
  const prefs=validatePreferences({
    studioSelected:'s05',
    checklist:['d180-hall','d120-dress','custom-1'],
    packingList:['pack-passport','pack-cards','cpack-1'],
    shootChecklist:['shoot-0-0','shoot-1-2'],
    ceremonyChecks:['cchk-mc','cchk-vows'],
    customPackingList:[{id:'cpack-1',category:'📄 필수 서류·결제',title:'영문 가족관계증명서'}],
    checklistNotes:{'d180-hall':'순천아모르 1층 예약 확인'},
    tripNotes:{bali:'풀빌라 2박 특전 확인'},
    tipNotes:{'tip-01':'드레스 피팅 시 촬영용 체크'},
    customChecklist:[{id:'custom-1',stage:'D-60 ~ D-30',title:'청첩장 모임 식당 예약'}],
    vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마 스튜디오 웨딩촬영 (낮 12:00)',date:'2027-02-03',done:false,note:'062-714-1970 정오 자연광 촬영'}],
    budgetPlan:{venue:{planned:15000000,actual:14200000,note:'식대 포함'},sdm:{planned:3500000,actual:null}},
    venueSim:{mealPrice:55000,guestCount:250,minGuarantee:200,hallFee:2500000,deposit:1000000,note:'순천아모르웨딩컨벤션'},
    sdmSim:{packageFee:2800000,helperFee:250000,extraFee:330000,deposit:500000,roadScene:true,nightShoot:false,note:'라크마 2/3 촬영'},
    ceremonyPlan:{style:'noOfficiant',mc:'친구 김OO',song:'축가 미정',speech:'양가 아버님 덕담',banquetFloor:'2층',note:'입장곡 체크',vows:'첫 번째, 사랑하겠습니다.',declaration:'이 결혼이 진실하게 이루어졌음을 선언합니다.'}
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:prefs});
  assert.deepEqual(parsePreferencesBackup(raw),prefs);
  const pruned=pruneTripPreferences({...prefs,tripNotes:{bali:'유지',removed:'삭제'}},[{id:'bali'}]);
  assert.deepEqual(pruned.tripNotes,{bali:'유지'});
  for(const bad of [
    {studioSelected:123},
    {checklist:['bad id!']},
    {packingList:['bad id!']},
    {shootChecklist:['bad id!']},
    {ceremonyChecks:['bad id!']},
    {customPackingList:[{id:'cpack-1',category:'없는 분류',title:'준비물'}]},
    {checklistNotes:{'bad id!':'메모'}},
    {tripNotes:{'bad id!':'메모'}},
    {tipNotes:{'tip-01':'x'.repeat(501)}},
    {customChecklist:[{id:'custom-1',stage:'없는 시기',title:'할 일'}]},
    {vendorSchedules:[{id:'vsched-1',category:'없는 분류',name:'라크마',date:'2027-02-03',done:false}]},
    {vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마',date:'2027-02-30',done:false}]},
    {vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'',date:'2027-02-03',done:false}]},
    {budgetPlan:[]},
    {budgetPlan:{unknown:{planned:100}}},
    {budgetPlan:{venue:{planned:-1}}},
    {budgetPlan:{venue:{planned:100,note:'x'.repeat(301)}}},
    {venueSim:{mealPrice:-100}},
    {venueSim:{guestCount:20000}},
    {sdmSim:{packageFee:-100}},
    {sdmSim:{roadScene:'yes'}},
    {ceremonyPlan:{style:'invalid'}},
    {ceremonyPlan:{banquetFloor:'x'.repeat(41)}},
    {ceremonyPlan:{vows:'x'.repeat(3001)}},
    {ceremonyPlan:{declaration:'x'.repeat(2001)}},
    {vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마',date:'2027-02-03',done:false,note:'x'.repeat(501)}]},
    {customPackingList:Array.from({length:81},(_,i)=>({id:`cp-${i}`,category:'📄 필수 서류·결제',title:`준비물 ${i}`}))}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }
  const okLimits=validatePreferences({
    vendorSchedules:[{id:'vsched-1',category:'📸 스튜디오',name:'라크마',date:'2027-02-03',done:false,note:'메'.repeat(450)}],
    customPackingList:Array.from({length:80},(_,i)=>({id:`cp-${i}`,category:'📄 필수 서류·결제',title:`준비물 ${i}`}))
  });
  assert.equal(okLimits.vendorSchedules[0].note.length,450);
  assert.equal(okLimits.customPackingList.length,80);
});

test('guestList and giftLedger validate strictly and survive private backup round trips',()=>{
  const prefs=validatePreferences({
    guestList:[
      {id:'guest-1',name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true,note:'채식 요청'},
      {id:'guest-2',name:'김영희',side:'신부 측',group:'직장·동료',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:false}
    ],
    giftLedger:[
      {id:'gift-1',name:'홍길동',side:'신랑 측',group:'친구',channel:'축의대(현금)',amount:100000,mealTickets:2,returnGiftDone:false,thankYouDone:true,note:'현장 전달'}
    ]
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:prefs});
  assert.deepEqual(parsePreferencesBackup(raw),prefs);
  for(const bad of [
    {guestList:'invalid'},
    {guestList:[{id:'guest-1',name:'',side:'신랑 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}]},
    {guestList:[{id:'guest-1',name:'홍길동',side:'없는구분',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}]},
    {guestList:[{id:'guest-1',name:'홍길동',side:'신랑 측',group:'친구',partySize:0,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}]},
    {guestList:[{id:'dup',name:'A',side:'신랑 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true},{id:'dup',name:'B',side:'신부 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}]},
    {giftLedger:'invalid'},
    {giftLedger:[{id:'gift-1',name:'홍길동',side:'신랑 측',group:'친구',channel:'없는방식',amount:50000,mealTickets:1,returnGiftDone:false,thankYouDone:false}]},
    {giftLedger:[{id:'gift-1',name:'홍길동',side:'신랑 측',group:'친구',channel:'축의대(현금)',amount:-1000,mealTickets:1,returnGiftDone:false,thankYouDone:false}]},
    {giftLedger:[{id:'gift-1',name:'홍길동',side:'신랑 측',group:'친구',channel:'축의대(현금)',amount:50000,mealTickets:51,returnGiftDone:false,thankYouDone:false}]}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }
});

test('mergePreferences combines partner A and partner B records safely without losing data or creating duplicates',()=>{
  const partnerA=validatePreferences({
    checklist:['d180-hall'],
    notes:{'studio-09':'신랑 측 촬영 메모'},
    guestList:[
      {id:'g-a1',name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true}
    ],
    giftLedger:[
      {id:'f-a1',name:'홍길동',side:'신랑 측',group:'친구',channel:'축의대(현금)',amount:100000,mealTickets:2,returnGiftDone:false,thankYouDone:false}
    ],
    budgetPlan:{venue:{planned:15000000,actual:null}}
  });
  const partnerB=validatePreferences({
    checklist:['d180-hall','d120-shoot'],
    notes:{'studio-09':'신부 측 추가 메모','studio-01':'다른 스튜디오'},
    guestList:[
      {id:'g-b-dup',name:'홍길동',side:'신랑 측',group:'친구',partySize:2,inviteStatus:'모바일 발송',rsvp:'참석',mealTicket:true},
      {id:'g-b1',name:'김영희',side:'신부 측',group:'직장·동료',partySize:1,inviteStatus:'종이 전달',rsvp:'참석',mealTicket:true}
    ],
    giftLedger:[
      {id:'f-b1',name:'김영희',side:'신부 측',group:'직장·동료',channel:'계좌이체',amount:150000,mealTickets:1,returnGiftDone:true,thankYouDone:true}
    ],
    vendorSchedules:[
      {id:'vs-b1',category:'👗 드레스',name:'본식 드레스 투어',date:'2027-03-10',done:false}
    ],
    budgetPlan:{venue:{planned:20000000,actual:14000000},sdm:{planned:3200000,actual:null}}
  });

  const merged=mergePreferences(partnerA,partnerB);
  assert.equal(merged.guestList.length,2);
  assert.deepEqual(merged.guestList.map(g=>g.name),['홍길동','김영희']);
  assert.equal(merged.giftLedger.length,2);
  assert.deepEqual(merged.checklist,['d180-hall','d120-shoot']);
  assert.equal(merged.vendorSchedules.length,1);
  assert(merged.notes['studio-09'].includes('신랑 측 촬영 메모')&&merged.notes['studio-09'].includes('신부 측 추가 메모'));
  assert.equal(merged.notes['studio-01'],'다른 스튜디오');
  // Existing planned kept, missing actual filled from incoming
  assert.equal(merged.budgetPlan.venue.planned,15000000);
  assert.equal(merged.budgetPlan.venue.actual,14000000);
  assert.equal(merged.budgetPlan.sdm.planned,3200000);

  const summary=summarizePreferencesMerge(partnerA,merged);
  assert.equal(summary.guestsAdded,1);
  assert.equal(summary.giftsAdded,1);
  assert.equal(summary.schedulesAdded,1);
  assert.equal(summary.checksAdded,1);
  assert.equal(summary.notesUpdated,2);

  // Cap enforcement at 500 guests
  const curBig=validatePreferences({
    guestList:Array.from({length:498},(_,i)=>({id:`ga-${i}`,name:`하객A${i}`,side:'신랑 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}))
  });
  const incBig=validatePreferences({
    guestList:Array.from({length:10},(_,i)=>({id:`gb-${i}`,name:`하객B${i}`,side:'신부 측',group:'친구',partySize:1,inviteStatus:'미발송',rsvp:'미확인',mealTicket:true}))
  });
  const capped=mergePreferences(curBig,incBig);
  assert.equal(capped.guestList.length,500);
  assert.throws(()=>mergePreferences(partnerA,{guestList:'invalid'}));
});

test('prenatalChecks and prenatalNote validate strictly, survive private backup, and merge safely',()=>{
  const prefs=validatePreferences({
    prenatalChecks:['pchk-budget','pchk-apply'],
    prenatalNote:'순천 현대여성아동병원 토요일 오전 산부인과 예약 문의 완료'
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:prefs});
  assert.deepEqual(parsePreferencesBackup(raw),prefs);
  for(const bad of [
    {prenatalChecks:['bad id!']},
    {prenatalChecks:'pchk-apply'},
    {prenatalNote:123},
    {prenatalNote:'x'.repeat(1001)}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }
  const merged=mergePreferences(prefs,{
    prenatalChecks:['pchk-apply','pchk-referral'],
    prenatalNote:'보건소 모자보건실 061-749-6916 접수 확인'
  });
  assert.deepEqual(merged.prenatalChecks,['pchk-budget','pchk-apply','pchk-referral']);
  assert(merged.prenatalNote.includes('순천 현대여성아동병원')&&merged.prenatalNote.includes('061-749-6916'));
  const summary=summarizePreferencesMerge(prefs,merged);
  assert.equal(summary.checksAdded,1);
  assert.equal(summary.notesUpdated,1);
});

test('prenatalSchedule, marriage benefits, homeItems, and wedding-day ops validate strictly and merge cleanly',()=>{
  const a=validatePreferences({
    prenatalSchedule:{appliedDate:'2026-11-30',visitDate:'2026-12-12',examDate:'',claimed:false},
    marriageRegDate:'2027-06-07',
    benefitChecks:['bchk-reg'],
    benefitNote:'순천시청 신청사 장명로 30 방문 예정',
    homeItems:[
      {id:'h1',category:'📺 가전',name:'냉장고',brand:'LG 오브제',status:'구매 확정',plannedPrice:2500000,actualPrice:2350000,deposit:300000,deliveryDate:'2027-05-10',note:'설치비 무료'}
    ],
    weddingDayRoles:[
      {id:'r1',group:'축의대(신랑 측)',role:'신랑 측 축의대 접수',assignee:'김OO',phone:'010-1234-5678',note:'14:10 도착'}
    ],
    weddingDayEnvelopes:[
      {id:'e1',payee:'사회자',amount:200000,recipient:'이OO',ready:true,note:'신권 준비'}
    ],
    photoOrderNote:'1. 양가 부모님\n2. 직계가족'
  });
  const raw=JSON.stringify({kind:'wedding-private-preferences',schemaVersion:1,preferences:a});
  assert.deepEqual(parsePreferencesBackup(raw),a);

  for(const bad of [
    {prenatalSchedule:{appliedDate:'2026-02-30'}},
    {prenatalSchedule:{claimed:'yes'}},
    {marriageRegDate:'2027-13-01'},
    {benefitChecks:['bad id!']},
    {benefitNote:'x'.repeat(1001)},
    {homeItems:[{id:'h1',category:'없는분류',name:'TV',status:'후보 비교',plannedPrice:100,actualPrice:null,deposit:null}]},
    {homeItems:[{id:'h1',category:'📺 가전',name:'TV',status:'없는상태',plannedPrice:100,actualPrice:null,deposit:null}]},
    {homeItems:[{id:'h1',category:'📺 가전',name:'TV',status:'후보 비교',plannedPrice:-10,actualPrice:null,deposit:null}]},
    {homeItems:[{id:'h1',category:'📺 가전',name:'TV',status:'후보 비교',plannedPrice:null,actualPrice:null,deposit:null,deliveryDate:'2027-02-30'}]},
    {weddingDayRoles:[{id:'r1',group:'없는그룹',role:'역할'}]},
    {weddingDayRoles:[{id:'r1',group:'축의대(신랑 측)',role:''}]},
    {weddingDayEnvelopes:[{id:'e1',payee:'없는항목',amount:100000,ready:false}]},
    {weddingDayEnvelopes:[{id:'e1',payee:'사회자',amount:-1,ready:false}]},
    {weddingDayEnvelopes:[{id:'e1',payee:'사회자',amount:100000,ready:'true'}]},
    {photoOrderNote:'x'.repeat(2001)}
  ]){
    assert.throws(()=>validatePreferences(bad));
  }

  const b=validatePreferences({
    prenatalSchedule:{examDate:'2026-12-12',claimed:true},
    benefitChecks:['bchk-reg','bchk-congrats'],
    benefitNote:'전남 아이톡 온라인 신청 확인',
    homeItems:[
      {id:'h-dup',category:'📺 가전',name:'냉장고',brand:'LG 오브제',status:'구매 확정',plannedPrice:2500000,actualPrice:2350000,deposit:300000},
      {id:'h2',category:'🛋️ 가구',name:'침대',status:'후보 비교',plannedPrice:1800000,actualPrice:null,deposit:null}
    ],
    weddingDayRoles:[
      {id:'r2',group:'신부 케어·가방순이',role:'가방순이',assignee:'박OO'}
    ],
    weddingDayEnvelopes:[
      {id:'e2',payee:'촬영·본식 헬퍼',amount:250000,ready:false}
    ],
    photoOrderNote:'3. 신랑·신부 친구'
  });

  const merged=mergePreferences(a,b);
  assert.equal(merged.prenatalSchedule.appliedDate,'2026-11-30');
  assert.equal(merged.prenatalSchedule.examDate,'2026-12-12');
  assert.equal(merged.prenatalSchedule.claimed,true);
  assert.equal(merged.homeItems.length,2);
  assert.equal(merged.weddingDayRoles.length,2);
  assert.equal(merged.weddingDayEnvelopes.length,2);
  assert.deepEqual(merged.benefitChecks,['bchk-reg','bchk-congrats']);
  assert(merged.benefitNote.includes('장명로 30')&&merged.benefitNote.includes('전남 아이톡'));
  assert(merged.photoOrderNote.includes('양가 부모님')&&merged.photoOrderNote.includes('친구'));

  const diff=summarizePreferencesMerge(a,merged);
  assert.equal(diff.homeItemsAdded,1);
  assert.equal(diff.dayOpsAdded,2);
  assert.equal(diff.checksAdded,1);
  assert.equal(diff.notesUpdated,2);
});


