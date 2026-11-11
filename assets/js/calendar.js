import {validDate} from './content.js?v=wedding-features-35';

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
function nextDayCompact(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  const next=new Date(Date.UTC(y,m-1,d+1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth()+1).padStart(2,'0')}${String(next.getUTCDate()).padStart(2,'0')}`;
}
function invitationEvent(info){
  if(!validDate(info.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(info.time))throw new Error('예식 날짜와 시간을 먼저 입력해 주세요.');
  const start=new Date(`${info.date}T${info.time}:00+09:00`);
  const names=[info.partner1,info.partner2].map(value=>(value||'').trim()).filter(Boolean).join(' & ');
  const location=[info.venue,info.address].map(value=>(value||'').trim()).filter(Boolean).join(' · ');
  return {start:stamp(start),summary:names?names+' 결혼식':'결혼식',location,description:'한국 시간 기준의 예식 시작 일정입니다. 종료 시각은 미정입니다. 기존에 저장한 일정은 자동 수정되지 않습니다. 변경 시 기존 일정을 수정하거나 삭제 후 새 일정을 추가하고 중복 여부를 확인해 주세요.'};
}
function scheduleEvent(spec={}){
  const summary=String(spec.summary||spec.title||'').trim();
  const dateStr=String(spec.date||'').trim();
  const timeStr=String(spec.time||'').trim();
  if(!validDate(dateStr)||!summary)throw new Error('일정 날짜와 제목을 먼저 확인해 주세요.');
  if(timeStr&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr))throw new Error('일정 시간을 먼저 확인해 주세요.');
  const location=String(spec.location||'').trim();
  const baseDesc=String(spec.description||spec.details||'').trim();
  const notice='기존에 캘린더에 저장한 일정은 자동 수정하지 않습니다. 일정 변경 시 기존 일정을 직접 수정하거나 삭제해 주세요.';
  const description=[baseDesc,notice].filter(Boolean).join('\n');
  const uidSlug=String(spec.uid||spec.id||'schedule').replace(/[^a-zA-Z0-9_-]/g,'-');
  if(timeStr){
    const start=stamp(new Date(`${dateStr}T${timeStr}:00+09:00`));
    return {allDay:false,start,summary,location,description,uid:`${uidSlug}@gmlduqzhd123-lab.github.io`};
  }
  const startDate=dateStr.replace(/-/g,'');
  return {allDay:true,startDate,endDate:nextDayCompact(dateStr),summary,location,description,uid:`${uidSlug}@gmlduqzhd123-lab.github.io`};
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
export function scheduleGoogleCalendarUrl(spec){
  const event=scheduleEvent(spec),url=new URL('https://calendar.google.com/calendar/r/eventedit');
  const params=event.allDay
    ?{action:'TEMPLATE',dates:`${event.startDate}/${event.endDate}`,text:event.summary,details:event.description,...(event.location?{location:event.location}:{})}
    :{action:'TEMPLATE',dates:`${event.start}/${event.start}`,stz:'Asia/Seoul',etz:'Asia/Seoul',text:event.summary,details:event.description,...(event.location?{location:event.location}:{})};
  url.search=new URLSearchParams(params).toString();
  return url.href;
}
export function scheduleCalendar(spec,now=new Date()){
  const event=scheduleEvent(spec);
  const dtStart=event.allDay?`DTSTART;VALUE=DATE:${event.startDate}`:`DTSTART:${event.start}`;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wedding Journal//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${event.uid}`,`DTSTAMP:${stamp(now)}`,dtStart,'SUMMARY:'+text(event.summary)];
  if(event.location)lines.push('LOCATION:'+text(event.location));
  lines.push('DESCRIPTION:'+text(event.description),'END:VEVENT','END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
