import { parseContent, validateContent, formatDate, safeUrl, MAX_IMPORT_BYTES } from './content.js';
import { validatePreferences, parsePreferencesBackup, persistPreferences } from './preferences.js';

const $ = selector => document.querySelector(selector);
const main=$('#main'), dialog=$('#editor-dialog'), editor=$('#editor-body');
const DRAFT_KEY='wedding:v1:draft', PREF_KEY='wedding:v1:preferences';
const routes=['home','invitation','story','albums','studios','honeymoon'];
const menus=[
  ['invitation','청첩장','소중한 분들을 초대하는 우리의 첫 인사.','INVITATION'],
  ['story','우리의 일대기','첫 만남부터 오늘까지, 함께 쌓아 온 시간.','OUR STORY'],
  ['albums','포토 앨범','오래 꺼내 보고 싶은 두 사람의 순간들.','PHOTO ALBUM'],
  ['studios','스튜디오','사진과 연락처를 나란히 놓고 함께 고르기.','STUDIOS'],
  ['honeymoon','신혼여행','결혼 후 첫 여행, 가고 싶은 곳부터 차근차근.','HONEYMOON']
];
let baseContent, content, studios=[], prefs={}, isDraft=false, toastTimer;
let filter='', favoritesOnly=false;
const guestMode=new URLSearchParams(location.search).get('view')==='guest';
let baseRevision='', draftRevision=null;
const editButton=(...args)=>guestMode?null:button(...args);

function E(tag, attributes={}, ...children) {
  const node=document.createElement(tag);
  for (const [key,value] of Object.entries(attributes)) {
    if (value===undefined || value===null || value===false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
    else if (key==='class') node.className=value;
    else if (key==='text') node.textContent=value;
    else node.setAttribute(key,value===true?'':String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child!==undefined && child!==null && child!==false) node.append(child instanceof Node?child:document.createTextNode(String(child)));
  }
  return node;
}
const button=(label, action, className='button') => E('button',{type:'button',class:className,onclick:action},label);
const linkButton=(label, href, quiet=false) => E('a',{class:'button'+(quiet?' quiet':''),href},label);
const readStorage=key=>{try{return localStorage.getItem(key);}catch{return null;}};
function toast(message,error=false) {
  clearTimeout(toastTimer);
  const target=$('#toast');target.textContent=message;target.hidden=false;target.className='toast'+(error?' error':'');
  toastTimer=setTimeout(()=>target.hidden=true,error?8500:3800);
}
function savePrefs(next) {
  try { prefs=persistPreferences(localStorage,PREF_KEY,next);return true; }
  catch { toast('선택과 메모를 저장하지 못해 이전 상태를 유지합니다. 개인 백업 후 저장 공간과 브라우저 설정을 확인해 주세요.',true);return false; }
}
function setDraft(next) {
  const valid=validateContent(next);
  const raw=JSON.stringify({...valid,baseRevision:isDraft?draftRevision:baseRevision});
  if(new TextEncoder().encode(raw).length>MAX_IMPORT_BYTES)throw new Error('초안은 8MB 이하로 저장해 주세요. 사진 수나 용량을 줄여 주세요.');
  try { localStorage.setItem(DRAFT_KEY,raw); }
  catch { throw new Error('이 기기의 저장 공간이 부족하거나 저장이 차단되어 있습니다. 사진 용량을 줄이거나 브라우저 설정을 확인해 주세요.'); }
  if(!isDraft)draftRevision=baseRevision;
  content=valid;isDraft=true;
}
function currentRoute() {const route=location.hash.replace(/^#\/?/,'').split('/')[0];return routes.includes(route)?route:'home';}
function pageHeader(title, description, action, eyebrow) {
  return E('div',{class:'page-header'},E('div',{},E('p',{class:'eyebrow'},eyebrow||'OUR WEDDING JOURNAL'),E('h1',{},title),E('p',{},description)),action);
}
function empty(title, description, label, action, allowGuestAction=false) {
  return E('div',{class:'empty-state'},E('span',{class:'empty-mark','aria-hidden':'true'},'w.'),E('h2',{},title),E('p',{},description),label&&(!guestMode||allowGuestAction)?button(label,action):null);
}
function externalLink(label,url,className='text-button') {
  const href=safeUrl(url);return href?E('a',{href,class:className,target:'_blank',rel:'noopener noreferrer'},label):null;
}
function image(src,alt,attrs={}) {
  const href=safeUrl(src,{image:true});
  if(!href)return null;
  const node=E('img',{src:href,alt,loading:'lazy',...attrs});
  node.addEventListener('error',()=>{node.hidden=true;node.parentElement?.appendChild(E('span',{class:'small muted'},'사진을 불러오지 못했습니다.'));},{once:true});
  return node;
}
function renderHome() {
  const info=content.invitation;
  const names=[info.partner1,info.partner2].filter(Boolean).join(' & ');
  const hero=E('section',{class:'hero'},
    E('div',{class:'hero-copy'},E('p',{class:'eyebrow'},'OUR NEXT CHAPTER'),E('div',{class:'hero-line'}),
      E('h1',{},names?`${names},`:'함께 준비하는',E('br'),names?'우리의 다음 이야기':'우리의 다음 장'),
      E('p',{},'소중한 분들을 초대하는 날부터 둘만의 첫 여행까지. 함께 고른 것과 오래 간직할 순간을 이곳에 모아요.'),
      E('div',{class:'hero-actions'},linkButton(info.date||guestMode?'우리의 청첩장':'예식 정보 채우기','#/invitation'),linkButton('스튜디오 살펴보기','#/studios',true))),
    E('div',{class:'hero-art','aria-hidden':'true'},E('div',{class:'art-arch'},E('span',{},'Our',E('br'),'story.')),E('div',{class:'art-note'},'Together,',E('br'),'one page at a time.')));
  const overview=E('div',{class:'overview'},
    E('div',{},E('span',{class:'small muted'},'OUR DAY'),E('strong',{},info.date?formatDate(info.date).replace(/ \S+요일$/,''):'예식 일정 준비 중')),
    E('div',{},E('span',{class:'small muted'},'OUR MEMORIES'),E('strong',{},`이야기 ${content.stories.length} · 앨범 ${content.albums.length}`)),
    E('div',{},E('span',{class:'small muted'},'OUR CHOICES'),E('strong',{},`스튜디오 ${studios.length}곳 · 여행 ${content.honeymoon.length}곳`)));
  const statuses={invitation:info.date?'예식 정보 등록됨':'첫 인사를 준비해요',story:`${content.stories.length}개의 이야기`,albums:`${content.albums.length}개의 앨범`,studios:`${studios.length}곳 비교하기`,honeymoon:`${content.honeymoon.length}개의 여행 후보`};
  return [hero,overview,E('section',{},E('div',{class:'section-heading'},E('div',{},E('h2',{},'함께 채워 갈 이야기'),E('p',{},'필요한 순간에 하나씩, 우리의 속도로.'))),
    E('div',{class:'menu-grid'},menus.map(([route,title,description],index)=>E('a',{class:'menu-card',href:`#/${route}`},E('span',{class:'number'},`0${index+1}`),E('h3',{},title),E('p',{},description),E('div',{class:'card-tail'},E('span',{},statuses[route]),E('span',{'aria-hidden':'true'},'↗'))))))];
}
function renderInvitation() {
  const info=content.invitation;
  const hasContent=Object.values(info).some(Boolean);
  return [pageHeader('소중한 분들을 초대합니다.','우리의 마음과 예식 안내를 한 장에 담아요.',editButton('예식 정보 편집',()=>openEditor('invitation')),'THE INVITATION'),
    hasContent?E('section',{class:'invitation'},E('p',{class:'eyebrow'},'WE ARE GETTING MARRIED'),E('div',{class:'invitation-title'},'With love, together.'),
      E('h2',{class:'couple-names'},info.partner1||'이름 준비 중',E('span',{},'&'),info.partner2||'이름 준비 중'),
      E('p',{class:'message'},info.message||'소중한 분들께 전할 인사를 준비하고 있습니다.'),
      E('p',{class:'invitation-date'},info.date?formatDate(info.date):'예식 일정 준비 중',info.time?` · ${info.time}`:''),
      E('div',{class:'place'},E('strong',{},info.venue||'예식 장소 준비 중'),info.address?E('p',{},info.address):null),externalLink('오시는 길 ↗',info.mapUrl,'button quiet')):
    empty('우리의 첫 초대장을 준비해요.','두 분의 이름, 예식 날짜와 장소를 입력하면 청첩장에 담깁니다.','예식 정보 입력',()=>openEditor('invitation'))];
}
function recordActions(type,item) {
  if(guestMode)return null;
  return E('div',{class:'record-actions'},button('수정',()=>openEditor(type,item),'text-button'),button('삭제',()=>{
    if(!confirm(`‘${item.title}’ 기록을 이 기기의 초안에서 삭제할까요?`))return;
    try{const next=structuredClone(content);next[type]=next[type].filter(value=>value.id!==item.id);setDraft(next);render();toast('초안에서 삭제했습니다.');}catch(error){toast(error.message,true);}
  },'text-button'));
}
function renderStories() {
  const records=[...content.stories].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  return [pageHeader('우리가 함께 걸어온 시간','첫 만남, 기억하고 싶은 날, 함께 내린 결심을 기록해요.',editButton('이야기 추가',()=>openEditor('stories')),'OUR STORY'),
    records.length?E('section',{class:'timeline'},records.map(item=>E('article',{class:'story-card'+(item.image?' has-image':'')},item.image?image(item.image,item.title):null,
      E('div',{},E('p',{class:'record-date'},item.date?formatDate(item.date):'날짜 없는 기록'),E('h2',{},item.title),E('p',{class:'record-body'},item.body),recordActions('stories',item))))):
    empty('첫 번째 이야기를 남겨 볼까요?','처음 만난 날도, 함께 웃었던 평범한 날도 우리의 일대기가 됩니다.','첫 이야기 쓰기',()=>openEditor('stories'))];
}
function openPhotos(title,photos,index=0) {
  if(!photos.length)return;
  const body=E('div',{class:'photo-viewer'});
  const draw=()=>{
    const previous=button('이전 사진',()=>{index=(index+photos.length-1)%photos.length;draw();body.querySelector('button')?.focus();},'button quiet');
    const next=button('다음 사진',()=>{index=(index+1)%photos.length;draw();body.querySelector('button:last-child')?.focus();},'button quiet');
    previous.disabled=next.disabled=photos.length<2;
    body.replaceChildren(image(photos[index],`${title} 사진 ${index+1}`,{loading:'eager'}),
      E('div',{class:'viewer-controls'},previous,E('span',{'aria-live':'polite'},`${index+1} / ${photos.length}`),next));
  };
  draw();
  body.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();index=(index+(event.key==='ArrowLeft'?-1:1)+photos.length)%photos.length;draw();
      body.querySelector(event.key==='ArrowLeft'?'button':'button:last-child')?.focus();
    }
  });
  showDialog(title,body);
}
function openAlbum(album) {
  if(album.images.length)openPhotos(album.title,album.images);
  else showDialog(album.title,E('p',{},'아직 등록된 사진이 없습니다.'));
}
function tripControls(item) {
  if(guestMode)return null;
  const toggle=(key)=>{
    const selected=new Set(prefs[key]||[]);
    if(selected.has(item.id))selected.delete(item.id);else selected.add(item.id);
    if(key==='tripCompare'&&selected.size>2){toast('비교할 여행지는 두 곳까지 선택해 주세요.',true);return;}
    if(savePrefs({...prefs,[key]:[...selected]}))render();
  };
  return E('div',{class:'trip-controls'},
    E('button',{type:'button',class:'button quiet','aria-pressed':String(prefs.tripFavorites?.includes(item.id)||false),onclick:()=>toggle('tripFavorites')},'관심 여행지'),
    E('button',{type:'button',class:'button quiet','aria-pressed':String(prefs.tripCompare?.includes(item.id)||false),onclick:()=>toggle('tripCompare')},'비교 선택'),
    E('button',{type:'button',class:'button quiet','aria-pressed':String(prefs.tripSelected===item.id),onclick:()=>{if(savePrefs({...prefs,tripSelected:prefs.tripSelected===item.id?'':item.id}))render();}},'최종 선택'));
}
function tripComparison() {
  if(guestMode)return null;
  const items=(prefs.tripCompare||[]).map(id=>content.honeymoon.find(item=>item.id===id)).filter(Boolean);
  if(!items.length)return null;
  const fields=[['나라·지역',item=>item.country||'미정'],['일정',item=>[item.startDate,item.endDate].filter(Boolean).join(' ~ ')||'미정'],['예상 총예산',item=>item.budget===null?'미정':`${item.budget.toLocaleString('ko-KR')}원`],['좋은 점',item=>item.pros||'미기재'],['고민할 점',item=>item.cons||'미기재']];
  return E('section',{class:'trip-comparison'},E('h2',{},'여행 후보 나란히 비교'),E('p',{class:'small muted'},'관심·비교·최종 선택은 이 기기에 저장됩니다.'),
    E('div',{class:'table-scroll'},E('table',{class:'travel-comparison'},E('thead',{},E('tr',{},E('th',{scope:'col'},'비교 항목'),items.map(item=>E('th',{scope:'col'},item.title)))),
      E('tbody',{},fields.map(([label,value])=>E('tr',{},E('th',{scope:'row'},label),items.map(item=>E('td',{},value(item)))))))));
}
function renderAlbums() {
  return [pageHeader('오래 간직할 우리의 순간','사진을 앨범으로 모으고, 그날의 이야기를 함께 남겨요.',editButton('앨범 추가',()=>openEditor('albums')),'PHOTO ALBUM'),
    content.albums.length?E('section',{class:'album-grid'},content.albums.map(item=>E('article',{class:'album-card'},item.images.length?image(item.images[0],item.title,{class:'album-cover'}):E('div',{class:'album-placeholder'},'Our memories'),
      E('div',{class:'album-info'},E('p',{class:'record-date'},[item.date?formatDate(item.date):'',`사진 ${item.images.length}장`].filter(Boolean).join(' · ')),E('h2',{},item.title),E('p',{class:'record-body'},item.body),button('사진 보기',()=>openAlbum(item),'text-button'),recordActions('albums',item))))):
    empty('우리의 사진을 담을 첫 앨범','사진을 직접 선택하거나 사진 주소를 입력해 앨범 초안을 만들 수 있어요.','첫 앨범 만들기',()=>openEditor('albums'))];
}
function renderHoneymoon() {
  return [pageHeader('둘만의 첫 여행을 그리며','가고 싶은 여행지와 일정, 예상 비용, 마음에 드는 이유를 모아요.',editButton('여행지 추가',()=>openEditor('honeymoon')),'HONEYMOON'),tripComparison(),
    content.honeymoon.length?E('section',{class:'travel-grid'},content.honeymoon.map(item=>E('article',{class:'travel-card'},E('p',{class:'country'},item.country||'우리의 여행 후보'),E('h2',{},item.title),
      E('dl',{},E('dt',{},'여행 일정'),E('dd',{},[item.startDate,item.endDate].filter(Boolean).join(' ~ ')||'미정'),E('dt',{},'예상 예산'),E('dd',{},item.budget===null?'미정':`${item.budget.toLocaleString('ko-KR')}원`),E('dt',{},'좋은 점'),E('dd',{},item.pros||'아직 기록이 없어요.'),E('dt',{},'고민할 점'),E('dd',{},item.cons||'아직 기록이 없어요.')),
      item.body?E('p',{class:'record-body'},item.body):null,externalLink('참고 자료 ↗',item.url),tripControls(item),recordActions('honeymoon',item)))):
    empty('어디로 떠나고 싶나요?','아직 정하지 않아도 괜찮아요. 끌리는 여행지부터 후보로 남겨 두세요.','여행 후보 남기기',()=>openEditor('honeymoon'))];
}
function contactNode(studio,compact=false) {
  const contact=studio.contact;
  return E('div',{class:'contact'},contact.phone?E('a',{href:`tel:${contact.phone.replace(/[^\d+]/g,'')}`},contact.phone):E('span',{class:'muted'},'목록에 미기재'),!compact&&contact.note?E('span',{class:'small'},contact.note):null);
}
function favoriteButton(studio) {
  if(guestMode)return null;
  const pressed=Boolean(prefs.favorites?.includes(studio.id));
  return E('button',{class:'favorite',type:'button','aria-label':`${studio.name} 관심 스튜디오 ${pressed?'해제':'등록'}`,'aria-pressed':String(pressed),onclick:()=>{
    const set=new Set(prefs.favorites||[]);set.has(studio.id)?set.delete(studio.id):set.add(studio.id);if(savePrefs({...prefs,favorites:[...set]}))render();
  }},pressed?'♥':'♡');
}
function compareCard(studio) {
  const memo=E('textarea',{maxlength:'1000','aria-label':`${studio.name} 개인 메모`,placeholder:'마음에 든 장면이나 상담할 내용을 남겨요.'});
  memo.value=prefs.notes?.[studio.id]||'';
  memo.addEventListener('input',()=>{if(!savePrefs({...prefs,notes:{...(prefs.notes||{}),[studio.id]:memo.value}}))memo.value=prefs.notes?.[studio.id]||'';});
  return E('article',{class:'compare-card'},E('div',{class:'card-heading'},E('div',{},E('p',{class:'record-date'},`${studio.zip}번 샘플`),E('h2',{},studio.name)),favoriteButton(studio)),
    E('p',{class:'small muted'},studio.style),E('div',{class:'studio-photos'},studio.images.map((im,index)=>E('button',{type:'button',class:'photo-open','aria-label':`${studio.name} 사진 ${index+1} 확대`,onclick:()=>openPhotos(studio.name,studio.images.map(value=>value.src),index)},image(im.src,`${studio.name} · ${im.file}`)))),contactNode(studio),
    !guestMode?E('label',{class:'field'},E('span',{},'우리의 메모 ',E('span',{class:'muted small'},'· 이 기기에 저장')),memo):null);
}
function selectStudio(side,id) {if(guestMode){prefs={...prefs,[side]:id};render();return;}if(!savePrefs({...prefs,[side]:id}))return;render();$('#studio-comparison')?.scrollIntoView({behavior:'smooth',block:'start'});}
function studioDirectory() {
  const search=E('input',{type:'search',placeholder:'스튜디오 이름이나 사진 스타일 검색','aria-label':'스튜디오 검색'});search.value=filter;
  const checked=E('input',{type:'checkbox'});checked.checked=favoritesOnly;
  const results=E('div',{class:'studio-grid',id:'studio-results'});
  const count=E('span',{class:'small muted','aria-live':'polite'});
  const draw=()=>{
    const query=filter.trim().toLocaleLowerCase();
    const filtered=studios.filter(s=>(!query||`${s.name} ${s.style}`.toLocaleLowerCase().includes(query))&&(!favoritesOnly||prefs.favorites?.includes(s.id)));
    count.textContent=`${filtered.length}곳`;
    results.replaceChildren(...(filtered.length?filtered.map(studio=>E('article',{class:'studio-tile'},image(studio.images[0].src,`${studio.name} 대표 샘플`),E('div',{class:'tile-body'},E('h3',{},studio.name),E('p',{class:'style'},studio.style),contactNode(studio,true),E('div',{class:'tile-actions'},button('비교 A',()=>selectStudio('left',studio.id),'button quiet'),button('비교 B',()=>selectStudio('right',studio.id),'button quiet'),favoriteButton(studio))))):[E('p',{class:'no-results'},'조건에 맞는 스튜디오가 없습니다.')]));
  };
  search.addEventListener('input',()=>{filter=search.value;draw();});checked.addEventListener('change',()=>{favoritesOnly=checked.checked;draw();});draw();
  return E('section',{class:'studio-directory'},E('div',{class:'section-heading'},E('div',{},E('h2',{},'전체 스튜디오 둘러보기'),E('p',{},'샘플 폴더에 포함된 30개 항목을 비교할 수 있어요.')),count),
    E('div',{class:'directory-controls'},search,guestMode?null:E('label',{class:'check-label'},checked,'관심 스튜디오만 보기')),results);
}
function renderStudios() {
  const first=studios.find(s=>s.id===prefs.left)||studios.find(s=>s.name==='고유·써드 믹스')||studios[0];
  const second=studios.find(s=>s.id===prefs.right)||studios.find(s=>s.name==='그리프')||studios[1];
  const selector=(side,studio,label)=>{
    const select=E('select',{'aria-label':label},studios.map(s=>E('option',{value:s.id},s.name)));select.value=studio.id;
    select.addEventListener('change',()=>{if(guestMode){prefs={...prefs,[side]:select.value};render();}else if(savePrefs({...prefs,[side]:select.value}))render();else select.value=studio.id;});
    return E('label',{class:'field'},label,select);
  };
  const rows=[['사진의 장점','pros'],['취향에 따른 아쉬움','cons'],['잘 맞는 취향','fit'],['추가금·구성 표기','fee']];
  const fees=[['고유 · 베네치아 야외씬','11만 원'],['고유 · 야간','11만 원'],['클레+포에버마인 · 믹스 촬영','10만 원 추가'],['리썸 · 야간·야경','22만 원 추가'],['비마이 · 포토','20만 원 추가']];
  return [pageHeader('우리에게 맞는 사진을 찾아요.','사진 스타일부터 상담 연락처까지, 두 스튜디오를 나란히 비교해 보세요.',null,'PHOTO STUDIOS'),
    E('div',{class:'studio-intro'},E('span',{class:'badge'},'30개 비교 항목'),E('span',{class:'small muted'},'제공된 대표 샘플 기준 · 총비용과 실제 서비스는 별도 확인')),
    E('section',{id:'studio-comparison'},E('div',{class:'compare-selectors'},selector('left',first,'비교할 스튜디오 A'),selector('right',second,'비교할 스튜디오 B')),
      E('div',{class:'compare-grid'},compareCard(first),compareCard(second)),
      E('table',{class:'comparison-table','aria-label':`${first.name}와 ${second.name} 장단점 비교`},E('tbody',{},rows.map(([label,key])=>E('tr',{},E('th',{scope:'row'},label),E('td',{},first[key]),E('td',{},second[key])))))),
    E('details',{class:'disclosure'},E('summary',{},'자료에 표기된 추가금'),E('table',{class:'fee-table'},E('tbody',{},fees.map(([name,fee])=>E('tr',{},E('th',{scope:'row'},name),E('td',{},fee)))))),
    E('details',{class:'disclosure'},E('summary',{},'전체 연락처'),E('table',{class:'fee-table','aria-label':'전체 스튜디오 연락처'},E('tbody',{},studios.map(studio=>E('tr',{},E('th',{scope:'row'},studio.name),E('td',{},contactNode(studio))))))),
    E('details',{class:'disclosure'},E('summary',{},'자료 출처와 비교 범위'),E('div',{class:'source-notes'},
      E('p',{},'사용자가 제공한 8개 ZIP의 JPG 파일 2,885개 중 40개 폴더에서 대표 썸네일 940개를 추출해 비교했습니다. 앨범 편집·중복·기존 샘플이 포함되며 사진 전체의 정밀 평가가 아닙니다.'),
      E('p',{},'연락처는 아모르웨딩홀의 ★ 포토스튜디오 리스트.png 기준입니다. 목록의 공동 표기를 따랐으며 별도 번호가 없는 8개 항목은 미기재로 남겼습니다. 포에버마인 번호는 목록에 지점 구분이 없습니다.'),
      E('p',{},'추가금은 제공 자료의 표기이며 최신 견적을 의미하지 않습니다. 기본 상품, 보정, 앨범과 촬영 조건은 업체에 확인해 주세요. 해밀 샘플의 워터마크는 liberte로 표기돼 있습니다.'),
      E('p',{},'사진은 각 스튜디오의 제공 샘플입니다. 두 사람의 개인 포토 앨범과는 별도로 구분됩니다.'))),studioDirectory()];
}
function render() {
  const route=currentRoute();
  const renderers={home:renderHome,invitation:renderInvitation,story:renderStories,albums:renderAlbums,studios:renderStudios,honeymoon:renderHoneymoon};
  main.replaceChildren(...renderers[route]());main.setAttribute('aria-busy','false');
  for(const anchor of document.querySelectorAll('[data-route]')) {
    if(anchor.dataset.route===route)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');
  }
  document.title=(route==='home'?'우리의 결혼 기록':`${menus.find(m=>m[0]===route)?.[1]||''} · 우리의 결혼 기록`);
  $('#draft-banner').hidden=!isDraft||guestMode;
  $('#draft-banner span').textContent=draftRevision!==baseRevision?'공개본이 변경되었거나 초안의 기준 버전을 확인할 수 없습니다. 초안을 백업하고 새 공개본을 확인해 주세요.':'이 기기에 저장한 초안을 보고 있어요. 공개 사이트에는 아직 반영되지 않았습니다.';
}
function showDialog(title,body) {
  $('#editor-title').textContent=title;editor.replaceChildren(body);if(!dialog.open)dialog.showModal();
}
const fieldSpecs={
  invitation:[['partner1','첫 번째 이름'],['partner2','두 번째 이름'],['date','예식 날짜','date'],['time','예식 시간','time'],['venue','예식장·홀 이름'],['address','주소'],['mapUrl','지도 링크','url'],['message','초대 인사','textarea']],
  stories:[['title','이야기 제목'],['date','기억할 날짜','date'],['body','우리의 이야기','textarea'],['image','사진 주소 (선택)']],
  albums:[['title','앨범 이름'],['date','촬영 날짜','date'],['body','앨범 소개','textarea'],['urls','사진 주소 (한 줄에 하나씩)','textarea']],
  honeymoon:[['title','여행지'],['country','나라·지역'],['startDate','출발일','date'],['endDate','도착일','date'],['budget','두 사람의 예상 총예산 (원)','number'],['pros','마음에 드는 점','textarea'],['cons','고민할 점','textarea'],['body','일정·상담 메모','textarea'],['url','참고 링크','url']]
};
async function shrinkPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WEBP 사진을 선택해 주세요.');
  if(file.size>20*1024*1024)throw new Error('사진 한 장은 20MB 이하로 선택해 주세요.');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',.78);
}
function openEditor(type,item=null) {
  if(guestMode)return;
  const titles={invitation:'예식 정보 편집',stories:'우리의 이야기',albums:'포토 앨범',honeymoon:'신혼여행 후보'};
  const values=type==='invitation'?content.invitation:(item||{});
  const form=E('form',{class:'editor-form'});const fields={};
  form.appendChild(E('p',{class:'form-note'},'작성한 내용은 이 브라우저의 초안에 저장됩니다. 공개 사이트 반영은 내용 관리에서 공개용 파일을 저장한 뒤 진행해 주세요.'));
  for(const [key,label,kind='text'] of fieldSpecs[type]) {
    const input=kind==='textarea'?E('textarea',{rows:'4'}):E('input',{type:kind});
    input.name=key;input.id=`field-${key}`;
    input.value=key==='urls'?'':(values[key]??'');
    if(key==='title')input.required=true;
    if(key==='budget'){input.min='0';input.step='1';}
    if(key==='title')input.maxLength=160;
    fields[key]=input;form.appendChild(E('label',{class:'field',for:input.id},label,input));
  }
  let albumImages=[...(item?.images||[])], processing=false;
  if(type==='albums') {
    const previews=E('div',{class:'photo-editor'});
    const draw=()=>previews.replaceChildren(...albumImages.map((src,index)=>{
      const move=(target)=>{[albumImages[index],albumImages[target]]=[albumImages[target],albumImages[index]];draw();};
      const previous=button('앞으로',()=>move(index-1),'button quiet');previous.disabled=index===0;
      const next=button('뒤로',()=>move(index+1),'button quiet');next.disabled=index===albumImages.length-1;
      return E('div',{class:'photo-edit-card'},image(src,`사진 ${index+1}`),E('p',{},index===0?'대표 사진':`사진 ${index+1}`),
        E('div',{class:'photo-edit-actions'},previous,next,button('대표로',()=>{albumImages.unshift(...albumImages.splice(index,1));draw();},'button quiet'),button('사진 삭제',()=>{albumImages.splice(index,1);draw();},'button danger')));
    }));
    const addUrls=()=>{
      const urls=fields.urls.value.split(/\r?\n/).map(src=>src.trim()).filter(Boolean);
      if(albumImages.length+urls.length>100)throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
      if(urls.some(src=>!safeUrl(src,{image:true})))throw new Error('사진 주소를 확인해 주세요.');
      albumImages.push(...urls);fields.urls.value='';draw();
    };
    form.appendChild(button('주소에서 사진 추가',()=>{try{addUrls();}catch(error){toast(error.message,true);}},'button quiet'));
    const files=E('input',{type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true,class:'file-input'});
    files.addEventListener('change',async()=>{
      processing=true;submit.disabled=true;files.disabled=true;
      try {
        if(albumImages.length+files.files.length>100)throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
        const additions=[];
        for(const file of files.files)additions.push(await shrinkPhoto(file));
        if(!form.isConnected||!dialog.open)return;
        albumImages.push(...additions);draw();
      }catch(error){toast(error.message,true);}finally{processing=false;submit.disabled=false;files.disabled=false;files.value='';}
    });
    form.append(E('label',{class:'field'},'사진 파일 추가 (선택)',files),E('p',{class:'small muted'},'사진은 초안용으로 줄여 저장합니다. 첫 번째 사진이 대표 사진입니다. 원본은 별도로 보관해 주세요.'),previews);
    draw();
  }
  const submit=E('button',{class:'button',type:'submit'},'초안에 저장');
  form.appendChild(E('div',{class:'form-actions'},button('취소',()=>dialog.close(),'button quiet'),submit));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(processing)return;submit.disabled=true;
    try {
      const next=structuredClone(content);const data=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));
      if(type==='invitation')next.invitation=data;
      else {
        const id=item?.id||crypto.randomUUID();
        let record={...data,id};
        if(type==='albums') {
          const images=[...albumImages,...data.urls.split(/\r?\n/).map(src=>src.trim()).filter(Boolean)];
          record={id,title:data.title,date:data.date,body:data.body,images};
        }
        if(type==='honeymoon')record.budget=data.budget===''?null:Number(data.budget);
        const index=next[type].findIndex(value=>value.id===id);
        if(index===-1)next[type].push(record);else next[type][index]=record;
      }
      setDraft(next);dialog.close();render();toast('이 기기에 초안을 저장했습니다.');
    }catch(error){toast(error.message,true);}finally{submit.disabled=false;}
  });
  showDialog(titles[type],form);
}
function downloadJson(value,filename) {
  const raw=JSON.stringify(value)+'\n';
  const blob=new Blob([raw],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=E('a',{href:url,download:filename});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadContent() { downloadJson(validateContent(content),'site.json'); }
function downloadPrivate() { downloadJson({kind:'wedding-private-preferences',schemaVersion:1,preferences:validatePreferences(prefs)},'wedding-private-preferences.json'); }
function openManager() {
  if(guestMode)return;
  const personal=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'개인 메모·선택 백업 선택'});
  personal.addEventListener('change',async()=>{
    const selected=personal.files?.[0];if(!selected)return;
    try{
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('개인 백업은 8MB 이하로 선택해 주세요.');
      const next=parsePreferencesBackup(await selected.text());
      if(!confirm('이 기기의 스튜디오 메모와 관심·비교·여행 선택을 백업 내용으로 바꿀까요?'))return;
      if(savePrefs(next)){dialog.close();render();toast('개인 메모와 선택을 복원했습니다.');}
    }catch(error){toast(error.message,true);}finally{personal.value='';}
  });

  const file=E('input',{type:'file',accept:'.json,application/json',class:'file-input','aria-label':'콘텐츠 JSON 파일 선택'});
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    try {
      if(selected.size>MAX_IMPORT_BYTES)throw new Error('콘텐츠 파일은 8MB 이하로 선택해 주세요.');
      const next=parseContent(await selected.text());
      if(!confirm('현재 기기의 초안을 선택한 파일의 내용으로 바꿀까요?'))return;
      setDraft(next);dialog.close();render();toast('콘텐츠를 이 기기의 초안으로 불러왔습니다.');
    }catch(error){toast(error.message,true);}finally{file.value='';}
  });
  showDialog('내용 관리',E('div',{},E('p',{class:'form-note'},'공개본은 저장소의 콘텐츠입니다. 여기서 편집한 내용은 이 기기에만 저장되며 자동으로 공개되지 않습니다.'),
    E('section',{class:'manager-section'},E('h3',{},'개인 메모·선택 백업'),E('p',{},'스튜디오 메모와 관심·비교 선택, 여행 관심·비교·최종 선택을 개인 파일로 보관합니다. 콘텐츠 초안과 사진은 공개용 파일 저장으로 따로 백업하세요. 개인 백업은 공개 저장소에 올리지 마세요.'),button('개인 백업 저장',downloadPrivate,'button quiet'),personal),
    E('section',{class:'manager-section'},E('h3',{},'방문자용 보기'),E('p',{},'방문자용 링크는 공개본만 표시하며 편집 버튼과 이 기기의 개인 메모를 숨깁니다. 접근 권한을 제한하는 기능은 아닙니다.'),linkButton('방문자용 청첩장 열기','?view=guest#/invitation',true)),
    isDraft&&draftRevision!==baseRevision?E('section',{class:'manager-section'},E('h3',{},'새 공개본 확인'),E('p',{},'현재 초안을 파일로 백업한 후 새 공개본을 확인하세요. 공개본으로 돌아가면 초안을 지우며 자동으로 합치지 않습니다.'),button('현재 초안 백업',downloadContent,'button quiet'),linkButton('새 공개본 미리보기','?view=guest#/home',true)):null,
    E('section',{class:'manager-section'},E('h3',{},'기본 정보'),E('p',{},'이름, 예식 일정과 장소, 청첩장 인사를 채워요.'),editButton('예식 정보 편집',()=>openEditor('invitation'),'button quiet')),
    E('section',{class:'manager-section'},E('h3',{},'공개할 내용 파일로 저장'),E('p',{},'저장한 site.json 파일을 Codex에 전달해 공개 사이트에 반영할 수 있어요. 파일에는 청첩장·일대기·앨범·신혼여행이 담기며, 스튜디오 개인 메모는 포함되지 않습니다.'),button('공개용 파일 저장',downloadContent)),
    E('section',{class:'manager-section'},E('h3',{},'이전에 저장한 내용 불러오기'),E('p',{},'이 앱에서 저장한 JSON 콘텐츠 파일을 선택해 주세요.'),file),
    E('section',{class:'manager-section'},E('h3',{},'초안을 지우고 공개본 보기'),E('p',{},'이 기기의 콘텐츠 초안만 지웁니다. 관심 스튜디오와 개인 메모는 유지됩니다.'),button('공개본으로 돌아가기',()=>{
      if(!confirm('이 기기의 콘텐츠 초안을 지울까요? 필요한 내용은 먼저 파일로 저장해 주세요.'))return;
      try{localStorage.removeItem(DRAFT_KEY);content=structuredClone(baseContent);isDraft=false;draftRevision=baseRevision;dialog.close();render();toast('공개본으로 돌아왔습니다.');}catch{toast('초안을 지우지 못했습니다.',true);}
    },'button danger'))));
}
$('#close-dialog').addEventListener('click',()=>dialog.close());
$('#manage-content').addEventListener('click',()=>content&&openManager());
$('#manage-draft').addEventListener('click',()=>content&&openManager());
window.addEventListener('hashchange',()=>{if(!content||location.hash==='#main')return;dialog.close();render();window.scrollTo({top:0,behavior:'instant'});});

async function init() {
  try {
    const [siteResponse,studiosResponse]=await Promise.all([fetch('./data/site.json'),fetch('./data/studios.json')]);
    if(!siteResponse.ok||!studiosResponse.ok)throw new Error('콘텐츠 파일을 불러오지 못했습니다.');
    baseContent=parseContent(await siteResponse.text());
    baseRevision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(baseContent))))).map(value=>value.toString(16).padStart(2,'0')).join('');studios=await studiosResponse.json();content=structuredClone(baseContent);
    if(!Array.isArray(studios)||!studios.length)throw new Error('스튜디오 자료를 확인해 주세요.');
    let notice='';
    const saved=readStorage(DRAFT_KEY);
    if(saved&&!guestMode){try{content=parseContent(saved);draftRevision=JSON.parse(saved).baseRevision??null;isDraft=true;}catch{notice='저장된 초안을 읽지 못해 공개본을 표시합니다. 기존 초안은 지우지 않았습니다.';}}
    try{prefs=validatePreferences(guestMode?{}:JSON.parse(readStorage(PREF_KEY)||'{}'));}catch{prefs=validatePreferences({});notice='개인 설정을 읽지 못했습니다. 기존 저장 데이터는 지우지 않았습니다.';}
    $('#manage-content').hidden=guestMode;
    if(guestMode)document.querySelector('.header-inner').appendChild(linkButton('일반 보기','./#/home',true));
    render();if(notice)toast(notice,true);
  }catch(error){main.setAttribute('aria-busy','false');main.replaceChildren(empty('기록을 불러오지 못했어요.',error.message,'다시 불러오기',()=>location.reload(),true));}
}
init();
