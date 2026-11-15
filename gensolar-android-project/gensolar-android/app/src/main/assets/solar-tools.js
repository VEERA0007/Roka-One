/* GenSolar Pro: Solar Tools tab. Sun path dashboard, appliance energy audit, shadow check, maintenance log and existing-system performance.
   Everything is an estimate from the numbers typed in; nothing here is site measurement or a design approval. */
(function(){
'use strict';
var R=Math.PI/180,KEY='gensolar_tools_v1';
/* ---------------- calculations (also used by the Node tests) ---------------- */
function dayOfYear(y,m,d){return Math.round((Date.UTC(y,m-1,d)-Date.UTC(y,0,0))/864e5)}
function decl(n){var B=2*Math.PI*(n-1)/365;return 0.006918-0.399912*Math.cos(B)+0.070257*Math.sin(B)-0.006758*Math.cos(2*B)+0.000907*Math.sin(2*B)-0.002697*Math.cos(3*B)+0.00148*Math.sin(3*B)}   /* rad (Spencer) */
function eot(n){var B=2*Math.PI*(n-1)/365;return 229.18*(0.000075+0.001868*Math.cos(B)-0.032077*Math.sin(B)-0.014615*Math.cos(2*B)-0.04089*Math.sin(2*B))}  /* minutes */
/* altitude and azimuth (from north, clockwise) at SOLAR hour h (12 = solar noon) */
function sunAt(lat,n,h){
  var p=lat*R,d=decl(n),w=(h-12)*15*R,s=Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(w),a=Math.asin(Math.max(-1,Math.min(1,s)));
  var cz=Math.cos(a),az;
  if(cz<1e-9)az=0;else{var c=(Math.sin(d)-Math.sin(a)*Math.sin(p))/(cz*Math.cos(p));az=Math.acos(Math.max(-1,Math.min(1,c)))/R;if(w>0)az=360-az}
  return {alt:a/R,az:az};
}
function dayInfo(lat,lon,n,tzHours){
  var p=lat*R,d=decl(n),x=-Math.tan(p)*Math.tan(d),corr=(4*(lon-tzHours*15)+eot(n))/60;   /* solar time minus clock time, hours */
  if(x>=1)return {polar:'night',noon:12-corr};
  if(x<=-1)return {polar:'day',noon:12-corr};
  var w0=Math.acos(x)/R/15;                                                                 /* half day in hours */
  return {sunrise:12-w0-corr,sunset:12+w0-corr,noon:12-corr,length:2*w0,maxAlt:90-Math.abs(lat-d/R)};
}
function hhmm(h){if(!isFinite(h))return '–';h=((h%24)+24)%24;var m=Math.round(h*60);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
/* the same winter-noon rule the Android planner uses */
function shadowCheck(hObst,dist,lat){
  var h=Math.max(0.1,hObst),d=Math.max(0.1,dist),ang=Math.round(Math.atan(h/d)/R*10)/10,
    wAlt=Math.max(8,90-Math.abs(lat)-23.45),len=Math.round(h/Math.tan(wAlt*R)*100)/100;
  return {obstacleAngle:ang,winterAlt:Math.round(wAlt*10)/10,shadowLen:len,minClearance:Math.round(len*1.15*100)/100,shaded:d<len};
}
function applianceTotals(rows,psh,pr){
  var wh=0,kw=0;rows.forEach(function(r){var q=+r.qty||0,w=+r.watts||0,h=+r.hours||0;wh+=q*w*h;kw+=q*w/1000});
  var monthly=wh*30/1000,size=monthly/(30*Math.max(psh,2.5)*pr);
  return {dailyWh:wh,monthlyKwh:monthly,connectedKw:kw,kwp:size};
}
function systemPerformance(kwp,kwh,days,psh){
  if(!(kwp>0&&kwh>=0&&days>0&&psh>0))return null;
  var pr=kwh/(kwp*psh*days);
  return {yieldPerKwp:kwh/kwp,yieldPerDay:kwh/kwp/days,pr:pr,cuf:kwh/(kwp*24*days),verdict:pr>=0.75?'good':pr>=0.65?'fair':'low'};
}
function dueInfo(e,today){
  var due=new Date(e.date+'T00:00:00Z').getTime()+(+e.interval||0)*864e5,t=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  var left=Math.round((due-t)/864e5);return {dueDate:new Date(due).toISOString().slice(0,10),left:left,status:left<0?'overdue':left<=7?'soon':'ok'};
}
var API={dayOfYear:dayOfYear,decl:decl,eot:eot,sunAt:sunAt,dayInfo:dayInfo,hhmm:hhmm,shadowCheck:shadowCheck,applianceTotals:applianceTotals,systemPerformance:systemPerformance,dueInfo:dueInfo};
if(typeof window!=='undefined')window.SolarTools=API;if(typeof module!=='undefined')module.exports=API;
if(typeof document==='undefined')return;
/* ---------------- screen ---------------- */
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function num(id,d){var e=$(id),v=e?parseFloat(e.value):NaN;return isFinite(v)?v:d}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
var S=load();function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function toast(s){var t=$('toast');if(t){t.textContent=s;t.hidden=false;setTimeout(function(){t.hidden=true},2600)}}
var PRESET=[['Ceiling fan',70,8],['LED light',10,6],['Refrigerator (average draw)',100,24],['TV',100,4],['Air conditioner 1.5 ton',1500,6],['Washing machine',500,1],['Water pump 1 HP',750,1],['Geyser',2000,1],['Laptop',60,6],['Desktop computer',150,6],['Wi-Fi router',10,24],['Mixer grinder',500,0.3],['Iron box',1000,0.5],['Microwave',1200,0.3]];
var TYPES=[['Panel cleaning',15],['Inverter check',90],['Cable and connection inspection',180],['Earthing check',180],['Battery check',60],['Other',90]];
var tab=S.tab||'dash';
function loc(){return {lat:S.lat,lon:S.lon,label:S.label||''}}
function locBlock(){var l=loc();return '<div class="st-card"><b>Location</b><div class="st-row"><label>Latitude<input id="st_lat" type="number" step="any" inputmode="decimal" value="'+(l.lat==null?'':l.lat)+'"></label><label>Longitude<input id="st_lon" type="number" step="any" inputmode="decimal" value="'+(l.lon==null?'':l.lon)+'"></label></div><label>Place name (optional)<input id="st_label" value="'+esc(l.label)+'"></label><div class="st-bar"><button class="btn" type="button" data-st="geo">Use my location</button><button class="btn" type="button" data-st="find">Find place by name</button></div><p class="st-note">Typed coordinates are used as they are. Finding a place by name needs the internet.</p></div>'}
function dashHtml(){
  var l=loc();if(!(l.lat>=-66&&l.lat<=66&&isFinite(l.lon)))return locBlock()+'<div class="st-card">Enter the latitude and longitude, or use your location, to see today\'s sun path.</div>';
  var now=new Date(),n=dayOfYear(now.getFullYear(),now.getMonth()+1,now.getDate()),tz=-now.getTimezoneOffset()/60,di=dayInfo(l.lat,l.lon,n,tz);
  var solarNow=now.getHours()+now.getMinutes()/60+(4*(l.lon-tz*15)+eot(n))/60,cur=sunAt(l.lat,n,solarNow);
  var pts=[],i;for(i=4;i<=20;i+=0.25){var s=sunAt(l.lat,n,i);pts.push([i,s.alt])}
  var W=320,H=140,x=function(h){return 30+(h-4)/16*(W-40)},y=function(a){return H-20-Math.max(0,a)/90*(H-40)};
  var path=pts.filter(function(p){return p[1]>=0}).map(function(p,k){return (k?'L':'M')+x(p[0]).toFixed(1)+' '+y(p[1]).toFixed(1)}).join(' ');
  var sx=solarNow>=4&&solarNow<=20?x(solarNow):null,svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Sun height through today" style="width:100%;max-width:520px"><line x1="30" y1="'+(H-20)+'" x2="'+(W-10)+'" y2="'+(H-20)+'" stroke="currentColor" opacity=".4"/>'+[6,9,12,15,18].map(function(h){return '<text x="'+x(h)+'" y="'+(H-6)+'" font-size="10" text-anchor="middle" fill="currentColor">'+h+'</text>'}).join('')+'<path d="'+path+'" fill="none" stroke="#F59E0B" stroke-width="2.5"/>'+(sx&&cur.alt>0?'<circle cx="'+sx+'" cy="'+y(cur.alt)+'" r="6" fill="#EA580C"/>':'')+'<text x="30" y="12" font-size="10" fill="currentColor">Sun height (0–90°) against solar hour</text></svg>';
  return locBlock()+'<div class="st-card"><b>Sun today'+(l.label?' at '+esc(l.label):'')+'</b>'+svg+'<div class="st-grid"><div><span>Sunrise</span><b>'+hhmm(di.sunrise)+'</b></div><div><span>Solar noon</span><b>'+hhmm(di.noon)+'</b></div><div><span>Sunset</span><b>'+hhmm(di.sunset)+'</b></div><div><span>Day length</span><b>'+(di.length?di.length.toFixed(1)+' h':'–')+'</b></div><div><span>Highest sun</span><b>'+(di.maxAlt!=null?di.maxAlt.toFixed(1)+'°':'–')+'</b></div><div><span>Sun now</span><b>'+(cur.alt>0?cur.alt.toFixed(0)+'° high, '+cur.az.toFixed(0)+'° from north':'below the horizon')+'</b></div></div><p class="st-note">Times follow this phone\'s clock and time zone. For a fixed south-facing array, a tilt close to the latitude ('+Math.abs(l.lat).toFixed(0)+'°) is the usual starting point; the design tab of the estimator sets the real figure.</p></div>';
}
function appRows(){return S.app||(S.app=PRESET.slice(0,5).map(function(p){return {name:p[0],watts:p[1],hours:p[2],qty:1}}))}
function appRes(){
  var t=applianceTotals(appRows(),5.2,0.78);
  return '<div class="st-card"><div class="st-grid"><div><span>Daily energy</span><b>'+(t.dailyWh/1000).toFixed(2)+' kWh</b></div><div><span>Monthly energy</span><b>'+t.monthlyKwh.toFixed(0)+' units</b></div><div><span>Connected load</span><b>'+t.connectedKw.toFixed(2)+' kW</b></div><div><span>Rough solar size</span><b>'+t.kwp.toFixed(1)+' kWp</b></div></div><p class="st-note">Hours per day are what you type, so a refrigerator or AC that cycles on and off needs its average hours. The solar size assumes 5.2 peak sun hours and 78 % performance ratio; the estimator tab gives the proper sizing.</p><button class="btn" type="button" data-st="toest">Use '+t.monthlyKwh.toFixed(0)+' units in the estimator</button></div>';
}
function appHtml(){
  var rows=appRows();
  return '<div class="st-card"><b>Appliance energy audit</b><div class="st-tblwrap"><table class="st-tbl"><thead><tr><th>Appliance</th><th>Qty</th><th>Watts</th><th>Hours/day</th><th></th></tr></thead><tbody>'+rows.map(function(r,i){return '<tr><td>'+esc(r.name)+'</td><td><input type="number" min="0" step="1" data-app="'+i+'" data-f="qty" value="'+r.qty+'"></td><td><input type="number" min="0" step="any" data-app="'+i+'" data-f="watts" value="'+r.watts+'"></td><td><input type="number" min="0" max="24" step="any" data-app="'+i+'" data-f="hours" value="'+r.hours+'"></td><td><button class="btn" type="button" data-st="appdel" data-i="'+i+'" aria-label="Remove">×</button></td></tr>'}).join('')+'</tbody></table></div><div class="st-bar"><select id="st_preset">'+PRESET.map(function(p,i){return '<option value="'+i+'">'+esc(p[0])+' ('+p[1]+' W)</option>'}).join('')+'</select><button class="btn" type="button" data-st="appadd">Add appliance</button></div></div><div id="st_res">'+appRes()+'</div>';
}
function shRes(){
  var l=loc(),lat=l.lat==null?17.4:l.lat,h=S.sh_h==null?3:S.sh_h,d=S.sh_d==null?5:S.sh_d,r=shadowCheck(h,d,lat);
  return '<div class="st-card"><div class="st-grid"><div><span>Obstacle angle</span><b>'+r.obstacleAngle+'°</b></div><div><span>Winter noon sun height</span><b>'+r.winterAlt+'°</b></div><div><span>Shadow length</span><b>'+r.shadowLen+' m</b></div><div><span>Keep clear by</span><b>'+r.minClearance+' m</b></div></div><p class="st-pill '+(r.shaded?'bad':'ok')+'">'+(r.shaded?'Shaded at winter noon: the panels are inside the shadow.':'Clear at winter noon at this distance.')+'</p><p class="st-note">Uses the 21 December noon sun at latitude '+Math.abs(lat).toFixed(1)+'°'+(l.lat==null?' (17.4° until you set a location on the Sun path tab)':'')+' and a 15 % margin. It checks only that noon; mornings and evenings cast longer shadows. Use the full survey shading analysis for a real design.</p></div>';
}
function shHtml(){
  var h=S.sh_h==null?3:S.sh_h,d=S.sh_d==null?5:S.sh_d;
  return '<div class="st-card"><b>Shadow check for one obstacle</b><div class="st-row"><label>Obstacle height above the panels (m)<input id="st_sh_h" type="number" step="any" min="0.1" value="'+h+'"></label><label>Distance from the panels (m)<input id="st_sh_d" type="number" step="any" min="0.1" value="'+d+'"></label></div></div><div id="st_res">'+shRes()+'</div>';
}
function maHtml(){
  var log=S.log||[],today=new Date(),rows=log.map(function(e){var x=dueInfo(e,today);return {e:e,x:x}}).sort(function(a,b){return a.x.left-b.x.left});
  var due=rows.filter(function(r){return r.x.status!=='ok'}).length;
  return '<div class="st-card"><b>Maintenance log</b><div class="st-row"><label>Type<select id="st_mtype">'+TYPES.map(function(t){return '<option value="'+t[1]+'">'+esc(t[0])+'</option>'}).join('')+'</select></label><label>Date done<input id="st_mdate" type="date" value="'+today.toISOString().slice(0,10)+'"></label></div><label>Next service after (days)<input id="st_mint" type="number" min="1" step="1" value="15"></label><label>Notes<input id="st_mnote" placeholder="Optional"></label><div class="st-bar"><button class="btn" type="button" data-st="madd">Save entry</button></div></div>'+
  '<div class="st-card"><b>'+(rows.length?due+' due or overdue':'No entries yet')+'</b>'+rows.map(function(r){return '<div class="st-item"><div><b>'+esc(r.e.type)+'</b><br><small>Done '+esc(r.e.date)+', next '+r.x.dueDate+(r.e.note?'<br>'+esc(r.e.note):'')+'</small></div><div><span class="st-pill '+(r.x.status==='ok'?'ok':'bad')+'">'+(r.x.status==='overdue'?Math.abs(r.x.left)+' days overdue':r.x.left===0?'due today':'in '+r.x.left+' days')+'</span><br><button class="btn" type="button" data-st="mdone" data-id="'+r.e.id+'">Done today</button> <button class="btn" type="button" data-st="mdel" data-id="'+r.e.id+'" aria-label="Delete">×</button></div></div>'}).join('')+'<p class="st-note">Reminders show here when you open the tab; this app does not send notifications. Entries stay on this phone.</p></div>';
}
function exRes(){
  var k=S.ex_k==null?5:S.ex_k,e=S.ex_e==null?600:S.ex_e,dd=S.ex_d==null?30:S.ex_d,p=S.ex_p==null?5.2:S.ex_p,r=systemPerformance(k,e,dd,p);
  return '<div class="st-card">'+(r?'<div class="st-grid"><div><span>Specific yield</span><b>'+r.yieldPerKwp.toFixed(0)+' kWh/kWp</b></div><div><span>Per day</span><b>'+r.yieldPerDay.toFixed(2)+' kWh/kWp</b></div><div><span>Performance ratio</span><b>'+(r.pr*100).toFixed(1)+' %</b></div><div><span>CUF</span><b>'+(r.cuf*100).toFixed(1)+' %</b></div></div><p class="st-pill '+(r.verdict==='good'?'ok':'bad')+'">'+(r.verdict==='good'?'Healthy: a well-kept plant usually reads 75–85 %.':r.verdict==='fair'?'Fair: check dust, shading and loose connections.':'Low: look for shading, soiling, inverter faults or tripped strings.')+'</p>':'<p class="st-note">Enter all four numbers.</p>')+'<p class="st-note">Performance ratio = energy ÷ (kWp × peak sun hours × days). The peak sun hours are what you type, not a measurement, so treat the ratio as a guide. A cloudy month reads lower without the plant being faulty.</p></div>';
}
function exHtml(){
  var k=S.ex_k==null?5:S.ex_k,e=S.ex_e==null?600:S.ex_e,dd=S.ex_d==null?30:S.ex_d,p=S.ex_p==null?5.2:S.ex_p;
  return '<div class="st-card"><b>Existing solar plant check</b><div class="st-row"><label>Plant size (kWp)<input id="st_ex_k" type="number" step="any" min="0" value="'+k+'"></label><label>Energy generated (kWh)<input id="st_ex_e" type="number" step="any" min="0" value="'+e+'"></label><label>Over how many days<input id="st_ex_d" type="number" step="1" min="1" value="'+dd+'"></label><label>Peak sun hours per day<input id="st_ex_p" type="number" step="any" min="0.5" value="'+p+'"></label></div></div><div id="st_res">'+exRes()+'</div>';
}
var TABS=[['dash','Sun path'],['app','Appliances'],['sh','Shadow'],['ma','Maintenance'],['ex','Plant check']];
var RES={app:appRes,sh:shRes,ex:exRes};
var VIEW={dash:dashHtml,app:appHtml,sh:shHtml,ma:maHtml,ex:exHtml};
function render(){var p=$('view-tools');if(!p)return;var keep=document.activeElement&&document.activeElement.id;
  p.innerHTML='<h1>Solar Tools</h1><p class="lede">Quick calculators for the sun, appliances, shadows, maintenance and existing plants.</p><div class="st-chips" role="tablist">'+TABS.map(function(t){return '<button type="button" role="tab" data-st="tab" data-t="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+'</button>'}).join('')+'</div><div id="st_body">'+VIEW[tab]()+'</div>';
  if(keep&&$(keep)&&$(keep).focus){try{$(keep).focus();var v=$(keep).value;if($(keep).setSelectionRange&&$(keep).type==='text')$(keep).setSelectionRange(v.length,v.length)}catch(e){}}}
function setLoc(lat,lon,label){S.lat=lat;S.lon=lon;if(label!=null)S.label=label;save();render()}
function onClick(e){
  var b=e.target.closest('[data-st]');if(!b||!$('view-tools')||!$('view-tools').contains(b))return;var a=b.getAttribute('data-st');
  if(a==='tab'){tab=b.getAttribute('data-t');S.tab=tab;save();render();return}
  if(a==='geo'){if(!navigator.geolocation){toast('This phone cannot share its location here');return}navigator.geolocation.getCurrentPosition(function(p){setLoc(Math.round(p.coords.latitude*1e4)/1e4,Math.round(p.coords.longitude*1e4)/1e4,'My location')},function(){toast('Location permission was not given')},{timeout:10000});return}
  if(a==='find'){var q=($('st_label')||{}).value;if(!q||q.trim().length<3){toast('Type a place name first');return}
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q.trim())).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){if(!j.length){toast('No place found with that name');return}setLoc(Math.round(j[0].lat*1e4)/1e4,Math.round(j[0].lon*1e4)/1e4,q.trim())}).catch(function(){toast('Could not search places. Check the internet or type the coordinates.')});return}
  if(a==='appadd'){var p=PRESET[+$('st_preset').value];appRows().push({name:p[0],watts:p[1],hours:p[2],qty:1});save();render();return}
  if(a==='appdel'){appRows().splice(+b.getAttribute('data-i'),1);save();render();return}
  if(a==='toest'){var t=applianceTotals(appRows(),5.2,0.78),m=$('mode'),am=$('amount');if(!m||!am){toast('Estimator is not available');return}m.value='units';m.dispatchEvent(new Event('change',{bubbles:true}));am.value=Math.round(t.monthlyKwh);am.dispatchEvent(new Event('input',{bubbles:true}));var est=document.querySelector('.tabbar [data-tab="est"]');if(est)est.click();toast('Monthly units sent to the estimator');return}
  if(a==='madd'){var ty=$('st_mtype'),dt=$('st_mdate').value,iv=parseInt($('st_mint').value,10);if(!dt||!(iv>0)){toast('Enter the date and the days until the next service');return}(S.log=S.log||[]).push({id:Date.now()+''+Math.floor(Math.random()*1000),type:ty.options[ty.selectedIndex].text,date:dt,interval:iv,note:$('st_mnote').value.trim()});save();render();return}
  if(a==='mdone'){var id=b.getAttribute('data-id'),o=(S.log||[]).filter(function(x){return x.id===id})[0];if(o){S.log.push({id:Date.now()+'',type:o.type,date:new Date().toISOString().slice(0,10),interval:o.interval,note:''});S.log=S.log.filter(function(x){return x.id!==id});save();render()}return}
  if(a==='mdel'){S.log=(S.log||[]).filter(function(x){return x.id!==b.getAttribute('data-id')});save();render();return}
}
function upd(){var r=$('st_res');if(r&&RES[tab])r.innerHTML=RES[tab]()}
function onInput(e){
  var t=e.target,id=t.id||'';
  if(id==='st_lat'||id==='st_lon'){var la=parseFloat($('st_lat').value),lo=parseFloat($('st_lon').value);S.lat=isFinite(la)?la:null;S.lon=isFinite(lo)?lo:null;save();return}
  if(id==='st_label'){S.label=t.value;save();return}
  if(t.hasAttribute&&t.hasAttribute('data-app')){var r=appRows()[+t.getAttribute('data-app')];r[t.getAttribute('data-f')]=parseFloat(t.value)||0;save();upd();return}
  if(id==='st_sh_h'||id==='st_sh_d'){S[id==='st_sh_h'?'sh_h':'sh_d']=parseFloat(t.value)||0;save();upd();return}
  var ex={st_ex_k:'ex_k',st_ex_e:'ex_e',st_ex_d:'ex_d',st_ex_p:'ex_p'};if(ex[id]){S[ex[id]]=parseFloat(t.value);save();upd()}
}
function init(){
  var nav=document.querySelector('.tabbar'),prof=nav&&nav.querySelector('[data-tab="profile"]'),main=$('amain');
  if(!nav||!prof||!main||$('view-tools'))return;
  var st=document.createElement('style');st.textContent='#view-tools .st-chips{display:flex;gap:6px;overflow-x:auto}#view-tools .st-chips button{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:8px 12px;border-radius:999px;font:600 13px var(--font-body);cursor:pointer}#view-tools .st-chips button[aria-selected="true"]{background:var(--deep);color:var(--on-deep);border-color:var(--deep)}#view-tools .st-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-bottom:12px}#view-tools .st-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}#view-tools label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}#view-tools input,#view-tools select{font:500 15px var(--font-body);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px}#view-tools .st-bar{display:flex;flex-wrap:wrap;gap:8px}#view-tools .btn{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:9px 14px;font:600 14px var(--font-body);cursor:pointer}#view-tools .st-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}#view-tools .st-grid div{background:var(--surface-2);border-radius:10px;padding:8px 10px}#view-tools .st-grid span{display:block;font-size:11px;color:var(--muted)}#view-tools .st-grid b{font:700 16px var(--font-display)}#view-tools .st-note{font-size:12px;color:var(--muted);margin:0}#view-tools .st-pill{margin:0;padding:8px 10px;border-radius:10px;font-size:13px;font-weight:600}#view-tools .st-pill.ok{background:rgba(27,122,75,.14);color:var(--good)}#view-tools .st-pill.bad{background:var(--warn-bg);color:var(--warn)}#view-tools .st-tblwrap{overflow-x:auto}#view-tools .st-tbl{width:100%;border-collapse:collapse;font-size:13px}#view-tools .st-tbl th,#view-tools .st-tbl td{padding:4px 6px;text-align:left}#view-tools .st-tbl input{width:76px;padding:6px}#view-tools .st-item{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid var(--line);padding-top:8px}';
  document.head.appendChild(st);
  var page=document.createElement('section');page.id='view-tools';page.className='page';page.hidden=true;main.appendChild(page);
  var btn=document.createElement('button');btn.type='button';btn.setAttribute('data-tab','tools');btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>Tools';
  prof.insertAdjacentElement('beforebegin',btn);
  document.addEventListener('click',function(e){var b=e.target.closest('.tabbar button');if(!b)return;
    if(b.getAttribute('data-tab')==='tools'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      document.querySelectorAll('#amain .page').forEach(function(q){q.hidden=true});page.hidden=false;render();
      nav.querySelectorAll('button').forEach(function(q){q.removeAttribute('aria-current')});btn.setAttribute('aria-current','page');$('hsub').textContent='Solar Tools';main.scrollTop=0;return}
    page.hidden=true},true);
  page.addEventListener('click',onClick);page.addEventListener('input',onInput);page.addEventListener('change',function(e){if(e.target.id==='st_lat'||e.target.id==='st_lon')render()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
