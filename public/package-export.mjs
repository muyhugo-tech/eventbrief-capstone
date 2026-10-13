import { buildKitchenOrderHtml } from '../lib/reused-yannis/templates/kitchen.mjs';
import { buildDocumentHtml } from '../lib/reused-yannis/templates/event.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const eventFields = ['host_name','event_date','start_time','end_time','timezone','venue'];
const attendanceFields = ['guest_count','guest_13_plus_count','child_count'];
const audienceFields = {
  calendar: eventFields,
  quote: [...eventFields,...attendanceFields,'menu','beverage'],
  kitchen: [...eventFields,...attendanceFields,'menu','dietary'],
  staff: [...eventFields,...attendanceFields,'menu','beverage','dietary','setup','av','special','staff_notes'],
  guest: [...eventFields,...attendanceFields,'menu','beverage','guest_notes']
};

// A second audience boundary at the renderer keeps an accidental extra server
// row from putting staff notes, source messages, or individual dietary data in
// a guest-facing download. Optional details are admitted by the package engine.
export function approvedDocumentRows(document) {
  const allowed = audienceFields[document.id] ?? [];
  return (document.rows ?? []).filter(row => allowed.includes(row.field) && row.value != null);
}

export function assetFilename(document, prepared, extension = 'html') {
  const values = Object.fromEntries(approvedDocumentRows(document).map(row => [row.field, row.value]));
  const slug = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 65).replace(/-+$/g, '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(values.event_date) ? values.event_date : '';
  const kind = { calendar: 'calendar-entry', quote: 'guest-quote', kitchen: 'kitchen-sheet', staff: 'staff-event-plan', guest: 'guest-event-plan' }[document.id] ?? 'event-draft';
  const host = slug(values.host_name) || 'event';
  const suffix = /^[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : 'html';
  return ['eventbrief',date,host,kind].filter(Boolean).join('-') + '.' + suffix;
}

// The reused builders accept UTC instants. Convert the approved wall-clock time
// in the fictional restaurant's fixed zone without assuming a winter offset.
export function venueInstant(date, time, timezone) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let step=0;step<3;step++) {
    const p=Object.fromEntries(formatter.formatToParts(guess).map(item=>[item.type,item.value]));
    const observed=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    guess += target-observed;
  }
  return new Date(guess).toISOString();
}

// Only ready, audience-approved rows enter this adapter. It never passes the
// source conversation or the complete extracted record to either renderer.
export function reusedInternalDocument(document, prepared, reviewed) {
  if(document.state !== 'ready_for_review' || !['kitchen','staff'].includes(document.id)) return null;
  const rows=approvedDocumentRows(document);
  const values=Object.fromEntries(rows.map(row=>[row.field,row.value]));
  const start=venueInstant(values.event_date,values.start_time,values.timezone);
  const notes=fields=>fields.filter(field=>values[field]!=null).map(field=>`${rows.find(row=>row.field===field).label}: ${values[field]}`).join('\n');
  const event={title:`${values.host_name} · ${document.title}`,contact_name:values.host_name,start_at:start,
    end_at:values.end_time?venueInstant(values.event_date,values.end_time,values.timezone):null,
    patios:values.venue?{name:values.venue}:null,guest_count:values.guest_count,status:'draft',event_type:null,
    occasion:null,coordinator:null,bar_arrangement:null,bar_notes:[values.beverage,document.beverage_notes,document.beverage_note].filter(Boolean).join('\n'),
    setup_notes:notes(['setup','av','special']),menu_notes:[values.menu,...document.menu_courses].join('\n'),
    internal_notes:notes(['staff_notes']),company:null,contact_email:null,contact_phone:null};
  let html;
  if(document.id==='kitchen') {
    const courseNames=['salads','entrees','dessert'];
    html=buildKitchenOrderHtml(event,{format:'served',ready_at:null,production_notes:notes(['dietary']),
      courses:document.menu_courses.map((name,index)=>({course:courseNames[index]??'apps',sort_order:index,serve_time:null,
        lines:[{name,quantity:null,vessel:null,prep_notes:null}]}))});
    const attendance=notes(['guest_13_plus_count','child_count']);
    const end=values.end_time?new Intl.DateTimeFormat('en-US',{timeZone:values.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(event.end_at)):null;
    const extra=[attendance,end?`Event ends: ${end}`:null].filter(Boolean).map(value=>`<p class="subtle asset-attendance">${esc(value)}</p>`).join('');
    html=html.replace(/(<div class="header">[\s\S]*?)(\n  <\/div>)/,(_,before,after)=>before+extra+after);
    html=html.replace('<p class="pl">Production notes</p>','<p class="pl">Allergies &amp; dietary needs</p>');
    html=html.replace('<div class="foot">','<p class="service-check">Course times and production quantities are not supplied in this event record. Confirm them with the event team before service.</p><div class="foot">');
    html=html.replace('<title>Kitchen Order</title>',()=>`<title>${esc(values.host_name)} — Kitchen sheet</title>`);
  } else {
    html=buildDocumentHtml(event,'order');
    const field=(label,value)=>`<div class="f"><div class="fl">${esc(label)}</div><div class="fv">${esc(value)}</div></div>`;
    const date=new Intl.DateTimeFormat('en-US',{timeZone:values.timezone,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(start));
    const fmt=instant=>new Intl.DateTimeFormat('en-US',{timeZone:values.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(instant));
    const summary=field('Date',date)+field('Timezone',values.timezone)+field('Venue',values.venue)+
      ['guest_13_plus_count','child_count','guest_count'].filter(key=>values[key]!=null).map(key=>field(key==='guest_count'?'Total attendance':rows.find(row=>row.field===key).label,values[key])).join('');
    html=html.replace(/<section class="grid">[\s\S]*?<\/section>/,()=>`<section class="grid">${summary}</section>`);
    const schedule=field('Start time',fmt(start))+(event.end_at?field('End time',fmt(event.end_at)):'');
    html=html.replace('<h2>Bar</h2>',()=>`<h2>Event schedule</h2><div class="grid">${schedule}</div></section><section class="block"><h2>Bar</h2>`);
    html=html.replace(/<section class="block">\s*<h2>Contact<\/h2>[\s\S]*?<\/section>/,'');
    html=html.replace('<h2>Internal notes</h2>',()=>`<h2>Allergies &amp; dietary needs</h2><div class="prose">${esc(values.dietary)}</div></section><section class="block"><h2>Internal notes</h2>`);
    html=html.replaceAll('Event Order Details','Staff event plan');
  }
  const label=prepared.mode==='authored_reference'?'Authored example · no AI call':prepared.label;
  const banner=`<aside class="demo-review"><strong>${reviewed?'Reviewed draft':'Draft · not reviewed'}</strong> · ${esc(document.audience)}<br>${esc(label)}<br>All details fictional. ${esc(prepared.profile.name)} · ${esc(values.timezone)}. Prepared from the selected conversation and the ${esc(prepared.profile.version)} restaurant profile. Review does not create a booking or send a message.</aside>`;
  const css='<style>@page{size:Letter;margin:14mm}.demo-review{font:12px/1.5 Arial,sans-serif;border:1px solid #ccc;margin:20px auto;padding:12px;max-width:720px;overflow-wrap:anywhere}.asset-attendance{white-space:pre-wrap}.service-check{font:12px/1.5 Arial,sans-serif;margin-top:18px;color:#555}main{max-width:820px;margin:auto}.prose,.fv,.lines td{overflow-wrap:anywhere}.lines .q:empty,.lines .ve:empty,.lines .pr:empty{display:none}.lines td.it{width:auto}@media(max-width:540px){main{padding:20px!important}.grid{grid-template-columns:1fr}table.lines td{font-size:17px!important;padding:7px 4px}.demo-review{margin:12px}}@media print{main{padding:12px 0!important}.brandbar{padding:15px 20px}.demo-review{break-inside:avoid;margin:0 auto 15px}.prodnotes,.course,tr,.f{break-inside:avoid}h1,h2{break-after:avoid}.docfoot{padding:12px 0}.prose{orphans:3;widows:3}}</style>';
  return html.replace('</head>','<meta name="viewport" content="width=device-width,initial-scale=1">'+css+'</head>').replace(/(<body[^>]*>)/,match=>match+banner);
}
