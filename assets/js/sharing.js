import { formatDate } from './content.js?v=wedding-features-57';
export const PUBLIC_URL='https://gmlduqzhd123-lab.github.io/Wedding/?view=guest';
export const SHARE_IMAGE_URL='https://gmlduqzhd123-lab.github.io/Wedding/assets/share-card.png?v=wedding-features-57';
export function shareMetadata(content) {
  const info=content.invitation;
  const names=[info.partner1.trim(),info.partner2.trim()].filter(Boolean).join(' & ');
  const details=[info.date?formatDate(info.date):'',info.time,info.venue.trim()].filter(Boolean).join(' · ');
  const imageAlt=[names,details].filter(Boolean).join(' · ')||'우리의 결혼 기록 모바일 청첩장';
  return {title:names?`${names} · 우리의 결혼 기록`:'우리의 결혼 기록',description:details||'소중한 분들께 전할 청첩장과 두 사람의 이야기를 준비하고 있습니다.',url:PUBLIC_URL,image:SHARE_IMAGE_URL,imageAlt};
}
export function escapeAttribute(value){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function applyShareMetadata(html,content){
  const meta=shareMetadata(content);
  html=html.replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeAttribute(meta.title)}</title>`);
  for(const [property,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.url,'og:image':meta.image,'og:image:alt':meta.imageAlt,'twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image})){
    html=html.replace(new RegExp(`(<meta (?:property|name)="${property}" content=")[^"]*(")`),(_,start,end)=>start+escapeAttribute(value)+end);
  }
  return html;
}
