import { formatDate } from './content.js';
export const PUBLIC_URL='https://gmlduqzhd123-lab.github.io/Wedding/?view=guest';
export function shareMetadata(content) {
  const info=content.invitation;
  const names=[info.partner1.trim(),info.partner2.trim()].filter(Boolean).join(' & ');
  const details=[info.date?formatDate(info.date):'',info.time,info.venue.trim()].filter(Boolean).join(' · ');
  return {title:names?`${names} · 우리의 결혼 기록`:'우리의 결혼 기록',description:details||'소중한 분들께 전할 청첩장과 두 사람의 이야기를 준비하고 있습니다.',url:PUBLIC_URL,image:'https://gmlduqzhd123-lab.github.io/Wedding/assets/share-card.png'};
}
export function escapeAttribute(value){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function applyShareMetadata(html,content){
  const meta=shareMetadata(content);
  for(const [property,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.url,'og:image':meta.image,'twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image})){
    html=html.replace(new RegExp(`(<meta (?:property|name)="${property}" content=")[^"]*(")`),(_,start,end)=>start+escapeAttribute(value)+end);
  }
  return html;
}
