import {validDate} from './content.js?v=wedding-polish-29';

// RFC 5545: TEXT escaping, CRLF and UTF-8 content-line folding.
const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line){
  const encoder=new TextEncoder();let part='',size=0;const parts=[];
  for(const char of line){
    const bytes=encoder.encode(char).length;
    if(size+bytes>75){parts.push(part);part=' ';size=1;}
    part+=char;size+=bytes;
  }
  parts.push(part);return parts.join('\r\n');
}
const stamp=value=>value.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function invitationEvent(info){
  if(!validDate(info.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(info.time))throw new Error('예식 날짜와 시간을 먼저 입력해 주세요.');
  const start=new Date(`${info.date}T${info.time}:00+09:00`);
  const names=[info.partner1,info.partner2].map(value=>(value||'').trim()).filter(Boolean).join(' & ');
  const location=[info.venue,info.address].map(value=>(value||'').trim()).filter(Boolean).join(' · ');
  return {start:stamp(start),summary:names?names+' 결혼식':'결혼식',location,description:'한국 시간 기준의 예식 시작 일정입니다. 종료 시각은 미정입니다. 기존에 저장한 일정은 자동 수정되지 않습니다. 변경 시 기존 일정을 수정하거나 삭제 후 새 일정을 추가하고 중복 여부를 확인해 주세요.'};
}
export function googleCalendarUrl(info){
  const event=invitationEvent(info),url=new URL('https://calendar.google.com/calendar/r/eventedit');
  // Repeat the start instant for a zero-length placeholder; no actual end time is supplied.
  url.search=new URLSearchParams({action:'TEMPLATE',dates:`${event.start}/${event.start}`,stz:'Asia/Seoul',etz:'Asia/Seoul',text:event.summary,
    details:event.description+' 저장 전 날짜·시간과 종료 시각을 확인해 주세요.',...(event.location?{location:event.location}:{})}).toString();
  return url.href;
}
export function invitationCalendar(info,now=new Date()){
  const event=invitationEvent(info);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wedding Journal//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:wedding-invitation@gmlduqzhd123-lab.github.io',`DTSTAMP:${stamp(now)}`,`DTSTART:${event.start}`,
    'SUMMARY:'+text(event.summary)];
  if(event.location)lines.push('LOCATION:'+text(event.location));
  lines.push('DESCRIPTION:'+text(event.description),'END:VEVENT','END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
