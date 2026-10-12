import { buildKitchenOrderHtml } from '../lib/reused-yannis/templates/kitchen.mjs';
import { buildDocumentHtml } from '../lib/reused-yannis/templates/event.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
  const values=Object.fromEntries(document.rows.map(row=>[row.field,row.value]));
  const start=venueInstant(values.event_date,values.start_time,values.timezone);
  const notes=fields=>fields.filter(field=>values[field]!=null).map(field=>`${document.rows.find(row=>row.field===field).label}: ${values[field]}`).join('\n');
  const event={title:`${values.host_name} · ${document.title}`,contact_name:values.host_name,start_at:start,
    end_at:values.end_time?venueInstant(values.event_date,values.end_time,values.timezone):null,
    patios:values.venue?{name:values.venue}:null,guest_count:values.guest_count,status:'draft',event_type:null,
    occasion:null,coordinator:null,bar_arrangement:null,bar_notes:[values.beverage,document.beverage_note].filter(Boolean).join('\n'),
    setup_notes:notes(['setup','av','special']),menu_notes:[values.menu,...document.menu_courses].join('\n'),
    internal_notes:notes(['dietary','staff_notes']),company:null,contact_email:null,contact_phone:null};
  let html;
  if(document.id==='kitchen') {
    const courseNames=['salads','entrees','dessert'];
    html=buildKitchenOrderHtml(event,{format:'served',ready_at:null,production_notes:notes(['dietary']),
      courses:document.menu_courses.map((name,index)=>({course:courseNames[index]??'apps',sort_order:index,serve_time:null,
        lines:[{name,quantity:null,vessel:null,prep_notes:null}]}))});
  } else html=buildDocumentHtml(event,'order');
  const label=prepared.mode==='authored_reference'?'Authored example · no AI call':prepared.label;
  const banner=`<aside class="demo-review"><strong>${reviewed?'Reviewed draft':'Draft · not reviewed'}</strong> · ${esc(document.audience)}<br>${esc(label)}<br>All details fictional. ${esc(prepared.profile.name)} · ${esc(values.timezone)}. Review does not create a booking or send a message.</aside>`;
  const css='<style>.demo-review{font:13px/1.5 Arial,sans-serif;border:2px solid #555;margin:20px auto;padding:12px;max-width:720px;overflow-wrap:anywhere}@media(max-width:540px){main{padding:20px!important}.grid{grid-template-columns:1fr}table.lines td{font-size:17px!important;padding:7px 4px}.demo-review{margin:12px}}@media print{.demo-review{break-inside:avoid}section{break-inside:avoid}}</style>';
  return html.replace('</head>','<meta name="viewport" content="width=device-width,initial-scale=1">'+css+'</head>').replace(/(<body[^>]*>)/,match=>match+banner);
}
