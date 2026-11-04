import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {invitationCalendar} from '../assets/js/calendar.js';
const info=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url),'utf8')).invitation;
const now=new Date('2026-11-04T00:00:00Z');
const unfold=raw=>raw.replace(/\r\n[ \t]/g,'');

test('calendar contains the confirmed Korean start instant and venue without guessing missing details or duration',()=>{
  const raw=invitationCalendar(info,now),data=unfold(raw);
  assert.match(data,/DTSTART:20270508T040000Z\r\n/);assert.match(data,/DTSTAMP:20261104T000000Z\r\n/);
  assert.match(data,/SUMMARY:결혼식\r\n/);assert.match(data,/LOCATION:순천아모르웨딩컨벤션 1층\r\n/);
  assert(!/DTEND:|DURATION:|ORGANIZER:|ATTENDEE:|VALARM/.test(data));
  assert.match(data,/종료 시각은 미정/);assert(raw.startsWith('BEGIN:VCALENDAR\r\n'));assert(raw.endsWith('END:VCALENDAR\r\n'));
  assert(!/(?<!\r)\n|\r(?!\n)/.test(raw));
  assert.equal(data.match(/^UID:.+$/m)[0],unfold(invitationCalendar(info,new Date('2026-11-05T00:00:00Z'))).match(/^UID:.+$/m)[0]);
});
test('calendar converts midnight across the UTC date boundary and rejects incomplete or invalid schedules',()=>{
  assert.match(unfold(invitationCalendar({...info,date:'2027-05-08',time:'00:30'},now)),/DTSTART:20270507T153000Z/);
  for(const change of [{date:''},{time:''},{date:'2027-02-30'},{time:'24:00'},{time:'1:00'}])assert.throws(()=>invitationCalendar({...info,...change},now),/날짜와 시간/);
  const blankLocation=unfold(invitationCalendar({...info,venue:'',address:''},now));assert(!blankLocation.includes('LOCATION:'));
});
test('calendar escapes injected content and folds long Korean and emoji text at UTF-8 character boundaries',()=>{
  const venue='가나다😀'.repeat(40)+';회의,홀\\A\r\nBEGIN:VEVENT\u0000';
  const raw=invitationCalendar({...info,partner1:'가,나',partner2:'다;라',venue},now),data=unfold(raw);
  assert.match(data,/SUMMARY:가\\,나 & 다\\;라 결혼식/);
  assert(data.includes('\\;회의\\,홀\\\\A\\nBEGIN:VEVENT'));assert(!data.includes('\u0000'));
  assert.equal(data.match(/^BEGIN:VEVENT$/gm).length,1);assert(!raw.includes('�'));
  for(const line of raw.split('\r\n'))assert(Buffer.byteLength(line,'utf8')<=75);
});
