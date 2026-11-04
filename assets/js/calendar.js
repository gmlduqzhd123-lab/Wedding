import {validDate} from './content.js?v=stay-focus-5';

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
export function invitationCalendar(info,now=new Date()){
  if(!validDate(info.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(info.time))throw new Error('예식 날짜와 시간을 먼저 입력해 주세요.');
  const start=new Date(`${info.date}T${info.time}:00+09:00`);
  const names=[info.partner1,info.partner2].map(value=>(value||'').trim()).filter(Boolean).join(' & ');
  const location=[info.venue,info.address].map(value=>(value||'').trim()).filter(Boolean).join(' · ');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wedding Journal//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:wedding-invitation@gmlduqzhd123-lab.github.io',`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(start)}`,
    'SUMMARY:'+text(names?names+' 결혼식':'결혼식')];
  if(location)lines.push('LOCATION:'+text(location));
  lines.push('DESCRIPTION:'+text('한국 시간 기준의 예식 시작 일정입니다. 종료 시각은 미정입니다.'),'END:VEVENT','END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
