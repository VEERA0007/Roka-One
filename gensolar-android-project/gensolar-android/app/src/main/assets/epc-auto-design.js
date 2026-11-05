(function(){
  'use strict';
  var root=document.getElementById('epcAutoDesign');
  if(!root)return;
  var style=document.createElement('style');
  style.textContent='#epcAutoDesign{display:flex;flex-direction:column;gap:12px;color:var(--ink);min-width:0}#epcAutoDesign .epca-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(120deg,#0a6b4f,#064532);color:#fff;border-radius:14px;padding:16px}#epcAutoDesign .epca-head h2{margin:4px 0;color:#fff;font:800 21px var(--font-display)}#epcAutoDesign .epca-head p{margin:0;color:#d8eee5;font-size:12px}#epcAutoDesign .epca-kicker{font:700 10px var(--font-mono);letter-spacing:.12em;color:#ffd45c}#epcAutoDesign .epca-tag{border:1px solid #9ccbb8;border-radius:99px;padding:5px 9px;font:700 10px var(--font-mono)}#epcAutoDesign .epca-modebar{display:flex;gap:6px;align-items:center;background:var(--surface-2);padding:5px;border-radius:10px;flex-wrap:wrap}#epcAutoDesign .epca-modebar button{flex:1;min-width:125px;border:0;border-radius:8px;background:transparent;color:var(--muted);padding:9px;font:700 13px var(--font-body)}#epcAutoDesign .epca-modebar button.active{background:var(--deep);color:var(--on-deep)}#epcAutoDesign .epca-modebar span{font:600 11px var(--font-mono);color:var(--muted);padding:0 8px}#epcAutoDesign .epca-grid{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:900px){#epcAutoDesign .epca-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}#epcAutoDesign .epca-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:11px;min-width:0}#epcAutoDesign .epca-card h3{margin:0;font:700 14px var(--font-body);color:var(--ink)}#epcAutoDesign .epca-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:9px}#epcAutoDesign .epca-fields label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);min-width:0}#epcAutoDesign .epca-fields input,#epcAutoDesign .epca-fields select{width:100%;min-width:0;padding:8px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);font:13px var(--font-mono)}#epcAutoDesign .epca-actions{display:flex;gap:7px;flex-wrap:wrap}#epcAutoDesign .epca-note{margin:0;padding:8px 9px;border-radius:8px;background:var(--surface-2);font-size:11px;line-height:1.5;color:var(--muted)}#epcAutoDesign .epca-upload{display:flex;flex-direction:column;gap:7px;border:1px dashed var(--deep);border-radius:9px;padding:10px;font-size:12px;font-weight:600;color:var(--ink)}#epcAutoDesign .epca-upload input{font:12px var(--font-body);max-width:100%}#epcAutoDesign .epca-upload small{font-size:10px;font-weight:400;color:var(--muted)}#epcAutoDesign .epca-media-preview{display:flex;gap:8px;overflow-x:auto;align-items:center;min-height:40px;color:var(--muted);font-size:11px}#epcAutoDesign .epca-media-preview img,#epcAutoDesign .epca-media-preview video{width:105px;height:72px;object-fit:cover;border-radius:7px;background:var(--surface-2)}#epcAutoDesign .epca-warnings{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:9px;font-size:11px;line-height:1.5}#epcAutoDesign .epca-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px}#epcAutoDesign .epca-metric{background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:9px;min-width:0}#epcAutoDesign .epca-metric span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}#epcAutoDesign .epca-metric b{display:block;margin-top:3px;font:800 17px var(--font-display);overflow-wrap:anywhere;color:var(--ink)}#epcAutoDesign .epca-metric small{display:block;font-size:9px;color:var(--muted)}#epcAutoDesign .epca-outputHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}#epcAutoDesign .epca-outputHead p{margin:3px 0 0;color:var(--muted);font-size:11px}#epcAutoDesign .epca-layout{min-height:160px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);padding:8px}#epcAutoDesign .epca-layout svg{display:block;width:100%;height:auto;min-width:300px;max-height:560px}#epcAutoDesign .epca-empty{padding:42px 10px;text-align:center;color:var(--muted);font-size:12px}#epcAutoDesign .epca-schedule{overflow-x:auto}#epcAutoDesign .epca-schedule table{width:100%;border-collapse:collapse;font-size:11px}#epcAutoDesign .epca-schedule th,#epcAutoDesign .epca-schedule td{text-align:left;padding:7px;border-bottom:1px solid var(--line)}#epcAutoDesign .epca-schedule th{font-size:9px;color:var(--muted);text-transform:uppercase}#epcAutoDesign .epca-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}#epcAutoDesign .epca-checks label{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:var(--ink)}#epcAutoDesign .epca-checks input{margin-top:2px;accent-color:var(--deep)}#epcAutoDesign .epca-warning{background:var(--warn-bg);color:var(--warn)}#epcAutoDesign .epca-print{display:none}@media print{body *{visibility:hidden}#epca_print,#epca_print *{visibility:visible}#epca_print{display:block!important;position:absolute;left:0;top:0;width:100%;padding:20px;color:#111;background:#fff}#epca_print table{border-collapse:collapse;width:100%}#epca_print td{border:1px solid #ccc;padding:7px}}';
  document.head.appendChild(style);
  var $=function(id){return document.getElementById(id)};
  var ids=['epca_project','epca_segment','epca_lat','epca_lon','epca_capacity','epca_wp','epca_module_w','epca_module_l','epca_orientation','epca_mount','epca_tilt','epca_azimuth','epca_sun_alt','epca_length','epca_width','epca_setback','epca_walkway','epca_obstacles','epca_support_span','epca_inverter','epca_max_dc','epca_voc','epca_voc_coeff','epca_min_temp','epca_dc_route','epca_ac_route','epca_allowance'];
  var mode='rooftop',last=null,mediaUrls=[];
  function val(id){var el=$(id),n=el?parseFloat(el.value):0;return isFinite(n)?n:0}
  function fmt(n,d){return Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:d==null?2:d})}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function notify(msg){var el=document.getElementById('toast');if(el){el.textContent=msg;el.hidden=false;clearTimeout(el._epcaTimer);el._epcaTimer=setTimeout(function(){el.hidden=true},2600)}else if(window.console)console.info(msg)}
  function projectKey(){var p=$('epc_projSel'),n=$('epc_f-name'),s=$('engSite');return (p&&p.value)||(n&&n.value)||(s&&s.value)||'default'}
  function allDesigns(){try{return JSON.parse(localStorage.getItem('gs_epc_auto_designs_v1')||'{}')}catch(e){return {}}}
  function save(){var all=allDesigns(),data={mode:mode,_manual:manual||{}};ids.forEach(function(id){if($(id))data[id]=$(id).value});all[projectKey()]=data;try{localStorage.setItem('gs_epc_auto_designs_v1',JSON.stringify(all))}catch(e){}}
  function setMode(m){mode=m;root.querySelectorAll('[data-epca-mode]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-epca-mode')===mode)});$('epca_modeLabel').textContent=mode==='ground'?'Ground-mounted':'Rooftop';if($('epca_mount'))$('epca_mount').value=mode==='ground'?'ground':($('epca_mount').value==='ground'?'rooftop':$('epca_mount').value)}
  function prefill(force){
    var map=[['engSite','epca_project'],['engCapacity','epca_capacity'],['engPanelW','epca_wp'],['engLat','epca_lat'],['engLon','epca_lon'],['engTilt','epca_tilt'],['engAzimuth','epca_azimuth'],['engInverter','epca_inverter']];
    map.forEach(function(p){var a=$(p[0]),b=$(p[1]);if(a&&b&&(force||!b.value)&&a.value)b.value=a.value});
    var mount=$('engMount');if(mount){var v=mount.value.toLowerCase();if(v.indexOf('ground')>=0)setMode('ground');else if(v.indexOf('roof')>=0)setMode('rooftop')}
    var layout=root.closest('#epcRoot');
    if(layout){
      var wp=layout.querySelector('[data-k="module.wp"]'),len=layout.querySelector('[data-k="module.len"]'),wid=layout.querySelector('[data-k="module.wid"]'),orient=layout.querySelector('[data-k="module.orient"]');
      if(wp&&wp.value&&force)$('epca_wp').value=wp.value;
      if(len&&len.value&&force)$('epca_module_l').value=(parseFloat(len.value)/1000).toFixed(3);
      if(wid&&wid.value&&force)$('epca_module_w').value=(parseFloat(wid.value)/1000).toFixed(3);
      if(orient&&orient.value&&force)$('epca_orientation').value=orient.value;
    }
    if(mount&&$('epca_mount'))$('epca_mount').value=mount.value.toLowerCase().indexOf('ground')>=0?'ground':(mount.value.toLowerCase().indexOf('metal')>=0?'metal':'rooftop');
  }
  function load(){
    var data=allDesigns()[projectKey()];
    manual={};
    if(data){ids.forEach(function(id){if(data[id]!=null&&$(id))$(id).value=data[id]});if(data.mode)setMode(data.mode);if(data._manual&&typeof data._manual==='object')manual=data._manual}
    else prefill(false);
    if(!$('epca_project').value)prefill(false);
    setMode(mode);
    if(typeof pullAll==='function')pullAll();
    if(typeof scheduleGenerate==='function')scheduleGenerate();
  }
  function metric(name,value,detail){return '<div class="epca-metric"><span>'+esc(name)+'</span><b>'+esc(value)+'</b><small>'+esc(detail||'')+'</small></div>'}
  function makeLayout(installed,cols,rows,panelW,panelDepth,pitch,scaleData){
    var len=val('epca_length'),wid=val('epca_width'),setback=val('epca_setback'),walk=val('epca_walkway');
    if(!(len>0&&wid>0&&installed>0&&cols>0))return '<div class="epca-empty">Enter measured site length and width to create the dimensioned panel concept layout.</div>';
    var scale=Math.min(760/wid,430/len),x0=48,y0=38,svgW=Math.max(320,wid*scale+82),svgH=Math.max(210,len*scale+78),pw=panelW*scale,pd=panelDepth*scale;
    var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+svgW+' '+svgH+'" role="img" aria-label="Preliminary solar panel layout"><rect x="'+x0+'" y="'+y0+'" width="'+(wid*scale)+'" height="'+(len*scale)+'" fill="#f2f6f3" stroke="#0a6b4f" stroke-width="2"/><text x="'+x0+'" y="19" font-size="11" fill="currentColor">SITE PLAN · '+(mode==='ground'?'GROUND MOUNTED':'ROOFTOP')+'</text>';
    if(setback>0)s+='<rect x="'+(x0+setback*scale)+'" y="'+(y0+setback*scale)+'" width="'+Math.max(0,(wid-2*setback)*scale)+'" height="'+Math.max(0,(len-2*setback)*scale)+'" fill="none" stroke="#d97706" stroke-dasharray="5 4"/>';
    if(walk>0)s+='<rect x="'+(x0+(wid-setback-walk)*scale)+'" y="'+(y0+setback*scale)+'" width="'+(walk*scale)+'" height="'+Math.max(0,(len-2*setback)*scale)+'" fill="#fef3c7" stroke="#d97706" stroke-dasharray="3 3"/>';
    var n=0,actualRows=Math.min(rows,Math.ceil(installed/cols));
    for(var r=0;r<actualRows;r++){
      for(var c=0;c<cols&&n<installed;c++){
        var xx=x0+(setback+walk+c*panelW)*scale,yy=y0+(setback+r*pitch)*scale;
        if(xx+pw<=x0+wid*scale+0.1&&yy+pd<=y0+len*scale+0.1){
          s+='<rect x="'+xx.toFixed(2)+'" y="'+yy.toFixed(2)+'" width="'+pw.toFixed(2)+'" height="'+pd.toFixed(2)+'" rx="1.5" fill="#0a6b4f" stroke="#f2a900" stroke-width=".8"/>';
          n++;
        }
      }
    }
    s+='<text x="'+(x0+wid*scale/2)+'" y="'+(svgH-13)+'" text-anchor="middle" font-size="11" fill="currentColor">Width '+fmt(wid,2)+' m</text><text x="13" y="'+(y0+len*scale/2)+'" transform="rotate(-90 13 '+(y0+len*scale/2)+')" text-anchor="middle" font-size="11" fill="currentColor">Length '+fmt(len,2)+' m</text><text x="'+(x0+wid*scale-5)+'" y="'+(y0+len*scale-7)+'" text-anchor="end" font-size="10" fill="#0a6b4f">N ↑ · verify true north</text></svg>';
    return s;
  }
  function generate(){
    var kw=val('epca_capacity'),wp=val('epca_wp'),mw=val('epca_module_w'),ml=val('epca_module_l'),len=val('epca_length'),wid=val('epca_width'),tilt=val('epca_tilt'),alt=val('epca_sun_alt');
    var warnings=[];
    if(!(kw>0&&wp>0&&mw>0&&ml>0)){ $('epca_warnings').textContent='Enter positive DC capacity, module rating and module dimensions.';return }
    if(tilt<0||tilt>60||alt<5||alt>85){$('epca_warnings').textContent='Check tilt (0–60°) and design sun altitude (5–85°).';return}
    if(val('epca_azimuth')<0||val('epca_azimuth')>360){$('epca_warnings').textContent='Azimuth must be between 0° and 360°.';return}
    var target=Math.ceil(kw*1000/wp),portrait=$('epca_orientation').value==='portrait',panelW=portrait?mw:ml,panelD=portrait?ml:mw;
    var rad=Math.PI/180,projected=panelD*Math.cos(tilt*rad),rise=panelD*Math.sin(tilt*rad),shadow=rise/Math.tan(alt*rad),pitch=projected+shadow;
    var setback=val('epca_setback'),walk=val('epca_walkway'),usableW=Math.max(0,wid-2*setback-walk),usableL=Math.max(0,len-2*setback);
    var cols=wid>0?Math.max(0,Math.floor(usableW/panelW)):0,rowsAvail=len>0?Math.max(0,Math.floor(usableL/pitch)):0;
    var panelArea=mw*ml,usableArea=Math.max(0,usableW*usableL-val('epca_obstacles')),areaFit=Math.floor(usableArea/panelArea);
    var geometricFit=cols*rowsAvail,fit=(len>0&&wid>0)?Math.min(geometricFit,areaFit):target;
    var siteRoof=document.getElementById('engRoof'),roofM2=siteRoof?parseFloat(siteRoof.value)*0.092903:0,roofBased=false;
    if(!(len>0&&wid>0)&&roofM2>0){fit=Math.floor(Math.max(0,roofM2-val('epca_obstacles'))/(panelW*pitch));roofBased=true}
    var installed=Math.min(target,fit),rows=cols>0?Math.ceil(installed/cols):0,actualKw=installed*wp/1000;
    if(roofBased)warnings.push('Fit is estimated from the usable roof area on the Site tab ('+fmt(roofM2,1)+' m²). Enter surveyed length and width for a scaled layout.');
    else if(!(len>0&&wid>0))warnings.push('Enter surveyed site length and width to calculate fit and generate a scaled layout.');
    if(installed<target)warnings.push('The entered area fits '+installed+' of '+target+' target modules. Review setbacks, walkways, obstacles or system capacity.');
    if(val('epca_obstacles')>0)warnings.push('Excluded obstacle area is deducted from available area; obstacle positions are not automatically detected. Mark their exact locations in CAD.');
    if(!val('epca_lat')||!val('epca_lon'))warnings.push('Add verified site coordinates for a site-specific solar resource and shadow assessment.');
    if(mode==='ground'&&val('epca_support_span')<=0)warnings.push('Enter a positive support span for preliminary support quantity.');
    var voc=val('epca_voc'),coeff=Math.abs(val('epca_voc_coeff'))/100,minTemp=val('epca_min_temp'),coldVoc=voc*(1+coeff*Math.max(0,25-minTemp));
    var maxDc=val('epca_max_dc'),maxSeries=coldVoc>0?Math.floor(maxDc/coldVoc):0,strings=maxSeries>0?Math.ceil(installed/maxSeries):0;
    if(voc<=0||maxDc<=0)warnings.push('Enter module Voc and inverter maximum DC voltage for string-voltage screening.');
    if(maxSeries<1&&installed>0)warnings.push('Cold-corrected module Voc exceeds the inverter maximum DC voltage. Stop and verify equipment selection.');
    var inv=val('epca_inverter'),ratio=inv>0?actualKw/inv:0;
    if(!inv)warnings.push('Enter inverter AC capacity to calculate the DC/AC ratio.');
    if(inv>0&&ratio>1.5)warnings.push('DC/AC ratio is above 1.50; verify inverter manufacturer limits and clipping expectations.');
    var allowance=1+val('epca_allowance')/100,dcCable=val('epca_dc_route')*2*allowance,acCable=val('epca_ac_route')*3*allowance;
    var railLines=rows*2,supportSpan=val('epca_support_span'),supports=supportSpan>0?railLines*(Math.ceil((Math.min(cols,installed)*panelW)/supportSpan)+1):0;
    $('epca_results').innerHTML=[
      metric('Target modules',fmt(target,0),'Required for target DC capacity'),
      metric('Modules fitting',fmt(installed,0),'Preliminary geometric / area fit'),
      metric('Installed DC',fmt(actualKw,3)+' kWp','Based on fitted module quantity'),
      metric('Module surface area',fmt(installed*panelArea,2)+' m²','Excludes access and setbacks'),
      metric('Columns × rows',cols&&rows?cols+' × '+rows:'Enter dimensions','Panel plan arrangement'),
      metric('Row pitch',fmt(pitch,2)+' m','Tilt and sun-altitude estimate'),
      metric('Mounting rail lines',fmt(railLines,0),'Concept estimate; verify mounting system'),
      metric('Support points',fmt(supports,0),'Based on entered support span'),
    ].join('');
    $('epca_layout').innerHTML=makeLayout(installed,cols,rows,panelW,projected,pitch);
    var table='<table><thead><tr><th>Item</th><th>Preliminary quantity</th><th>Specification / notes</th></tr></thead><tbody>'+
      '<tr><td>PV modules</td><td>'+installed+' Nos</td><td>'+wp+' Wp each · '+fmt(actualKw,3)+' kWp</td></tr>'+
      '<tr><td>Mounting rail lines</td><td>'+railLines+' Nos</td><td>Concept only; check module clamp zones and wind loads</td></tr>'+
      '<tr><td>Support points</td><td>'+supports+' Nos</td><td>Support span assumption; structural sizing not included</td></tr>'+
      '<tr><td>DC cable pair</td><td>'+fmt(dcCable,1)+' m</td><td>Length estimate only; conductor size not selected</td></tr>'+
      '</tbody></table>';
    $('epca_schedule').innerHTML=table;
    $('epca_warnings').textContent=warnings.length?warnings.join(' '):'Preliminary design generated. Verify all inputs and engineering constraints before issue for construction.';
    last={project:$('epca_project').value,segment:$('epca_segment').value,mode:mode,lat:val('epca_lat'),lon:val('epca_lon'),kw:kw,wp:wp,modules:installed,actualKw:actualKw,moduleW:mw,moduleL:ml,orientation:$('epca_orientation').value,siteLength:len,siteWidth:wid,tilt:tilt,azimuth:val('epca_azimuth'),cols:cols,rows:rows,pitch:pitch,panelW:panelW,panelDepth:projected,railLines:railLines,supports:supports,maxSeries:maxSeries,strings:strings,coldVoc:coldVoc,dcCable:dcCable,acCable:acCable,inv:inv,ratio:ratio,allowance:val('epca_allowance'),setback:setback,walkway:walk,warnings:warnings,area:usableArea,panelArea:panelArea};
    save();
  }
  function csvText(){
    if(!last)return '';
    var rows=[['GenSolar EPC Auto Design – preliminary schedule','Quantity','Unit / note'],['Project',last.project,''],['Mounting type',last.mode,''],['Target DC capacity',last.kw,'kWp'],['Installed DC capacity',last.actualKw,'kWp'],['PV modules',last.modules,'Nos'],['Module rating',last.wp,'Wp'],['Rail lines',last.railLines,'Nos · preliminary'],['Support points',last.supports,'Nos · preliminary'],['Maximum modules per string',last.maxSeries,'Cold Voc screen only'],['Estimated strings',last.strings,'MPPT allocation not verified'],['DC cable pair',fmt(last.dcCable,1),'m route estimate'],['AC phase conductors',fmt(last.acCable,1),'m route estimate'],['Engineering approval','Required','Before construction']];
    return rows.map(function(row){return row.map(function(x){x=String(x==null?'':x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}).join(',')}).join('\n');
  }
  function download(name,mime,data){
    try{var blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1500)}catch(e){notify('File export is not available in this WebView.')}
  }
  function dxf(){
    if(!last||!(last.siteLength>0&&last.siteWidth>0)){notify('Generate a design with surveyed dimensions before DXF export.');return}
    var L=['0','SECTION','2','HEADER','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
    function rect(x,y,w,h,layer){var p=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];for(var i=0;i<4;i++){var a=p[i],b=p[(i+1)%4];L.push('0','LINE','8',layer,'10',String(a[0]),'20',String(a[1]),'30','0','11',String(b[0]),'21',String(b[1]),'31','0')}}
    rect(0,0,last.siteWidth,last.siteLength,'SITE_BOUNDARY');
    var n=0,rows=Math.ceil(last.modules/Math.max(1,last.cols));
    for(var r=0;r<rows;r++)for(var c=0;c<last.cols&&n<last.modules;c++){var x=last.setback+last.walkway+c*last.panelW,y=last.setback+r*last.pitch;if(x+last.panelW<=last.siteWidth&&y+last.panelDepth<=last.siteLength){rect(x,y,last.panelW,last.panelDepth,'PV_MODULES');n++}}
    L.push('0','ENDSEC','0','EOF');download('GenSolar-EPC-Auto-Layout.dxf','application/dxf',L.join('\n'));
  }
  function sld(){
    if(!last){notify('Generate a design first.');return}
    var t='GENSOLAR EPC – PRELIMINARY BLOCK SLD\nProject: '+last.project+'\nArray: '+last.modules+' × '+last.wp+' Wp = '+fmt(last.actualKw,3)+' kWp\nEstimated strings: '+last.strings+'; maximum '+last.maxSeries+' modules/string by cold Voc screen.\nPV MODULE STRINGS → DC COMBINER / DC ISOLATOR + DC SPD (as designed) → INVERTER '+last.inv+' kW AC → ACDB / MCCB + AC SPD → GENERATION METER / MAIN LT PANEL → GRID / TRANSFORMER (as applicable).\nProvide module-frame bonding, inverter earthing, equipment earthing and lightning protection per approved design.\nNOT A PROTECTION-COORDINATED SLD: verify MPPT allocation, Isc, cable cross-sections, breaker ratings, fault levels, transformer and DISCOM requirements.';
    if(navigator.share){navigator.share({title:'GenSolar EPC SLD draft',text:t}).catch(function(){download('GenSolar-EPC-SLD-draft.txt','text/plain',t)})}else download('GenSolar-EPC-SLD-draft.txt','text/plain',t);
  }
  function printReport(){
    if(!last){notify('Generate a design first.');return}
    var data=[['Project',last.project],['Mounting type',last.mode],['Coordinates',last.lat+', '+last.lon],['Target DC',last.kw+' kWp'],['Installed DC',last.actualKw+' kWp'],['Modules',last.modules+' × '+last.wp+' Wp'],['Site dimensions',last.siteLength+' × '+last.siteWidth+' m'],['Tilt / azimuth',last.tilt+'° / '+last.azimuth+'°'],['Columns / rows',last.cols+' / '+last.rows],['Row pitch',last.pitch.toFixed(2)+' m'],['Rail lines / supports',last.railLines+' / '+last.supports],['Max modules / string',last.maxSeries],['Estimated strings',last.strings],['DC cable pair estimate',last.dcCable.toFixed(1)+' m'],['AC phase cable estimate',last.acCable.toFixed(1)+' m']];
    var sheet=$('epca_print');sheet.innerHTML='<h1>GenSolar EPC – Preliminary Auto Design</h1><p>'+esc(last.project)+' · '+esc(last.segment)+' · '+esc(last.mode)+'</p><p>Generated '+new Date().toLocaleString('en-IN')+'</p><table>'+data.map(function(r){return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'}).join('')+'</table><h2>Review warnings</h2><ul>'+last.warnings.map(function(w){return '<li>'+esc(w)+'</li>'}).join('')+'</ul><p><b>Engineering limitation:</b> Preliminary layout only. Verify structure, foundations, wind loads, cable sizes, protection coordination, earthing, lightning protection, grid compliance and final drawings through qualified engineers.</p>';
    window.print();
  }
  root.querySelectorAll('[data-epca-mode]').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-epca-mode'));save()})});
  $('epca_mount').addEventListener('change',function(){setMode(this.value==='ground'?'ground':'rooftop');save()});
  /* ---- live calculation and cross-tab linking ----
     Fields that mirror another EPC tab follow that tab until the user edits them here.
     An edited field is remembered as "manual" and Re-link clears that. */
  var manual={},genTimer=null;
  function scheduleGenerate(){clearTimeout(genTimer);genTimer=setTimeout(function(){try{generate()}catch(e){if(window.console)console.error(e)}},200)}
  function mountKind(t){t=String(t||'').toLowerCase();return t.indexOf('ground')>=0?'ground':(t.indexOf('metal')>=0?'metal':'rooftop')}
  function autoSunAlt(lat){var d=(lat>=0?-23.45:23.45)*Math.PI/180,p=lat*Math.PI/180,s=Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(Math.PI/4);return Math.round(Math.asin(Math.max(-1,Math.min(1,s)))*180/Math.PI)}
  var plain=function(v){return v};
  var LINKS=[
    {to:'epca_project',from:'#engSite',get:plain},
    {to:'epca_lat',from:'#engLat',get:plain},
    {to:'epca_lon',from:'#engLon',get:plain},
    {to:'epca_capacity',from:'#engCapacity',get:plain},
    {to:'epca_wp',from:'#engPanelW',get:plain},
    {to:'epca_wp',from:'[data-k="module.wp"]',get:plain},
    {to:'epca_module_l',from:'[data-k="module.len"]',get:function(v){return(parseFloat(v)/1000).toFixed(3)}},
    {to:'epca_module_w',from:'[data-k="module.wid"]',get:function(v){return(parseFloat(v)/1000).toFixed(3)}},
    {to:'epca_orientation',from:'[data-k="module.orient"]',get:plain},
    {to:'epca_tilt',from:'#engTilt',get:plain},
    {to:'epca_azimuth',from:'#engAzimuth',get:plain},
    {to:'epca_inverter',from:'#engInverter',get:plain},
    {to:'epca_mount',from:'#engMount',get:mountKind},
    {to:'epca_voc',from:'[data-x="elec.voc"]',get:plain},
    {to:'epca_voc_coeff',from:'[data-x="elec.tcVoc"]',get:plain},
    {to:'epca_min_temp',from:'[data-x="elec.tmin"]',get:plain},
    {to:'epca_max_dc',from:'[data-x="elec.invVmax"]',get:plain},
    {to:'epca_dc_route',from:'[data-x="elec.cableLen"]',get:plain},
    {to:'epca_ac_route',from:'[data-x="elec.acLen"]',get:plain}
  ];
  var LINKED=['epca_sun_alt'];LINKS.forEach(function(l){if(LINKED.indexOf(l.to)<0)LINKED.push(l.to)});
  function pushLink(l,src){
    if(manual[l.to])return false;
    var raw=src.value;if(raw===''||raw==null)return false;
    var v=l.get(raw),t=$(l.to);if(v==null||v===''||(typeof v==='number'&&!isFinite(v))||v==='NaN'||!t)return false;
    if(String(t.value)===String(v))return false;
    t.value=v;if(l.to==='epca_mount')setMode(v==='ground'?'ground':'rooftop');return true;
  }
  function pullAll(){
    LINKS.forEach(function(l){var src=document.querySelector(l.from);if(src)pushLink(l,src)});
    syncSun();
  }
  function syncSun(){var lat=val('epca_lat');if(!manual.epca_sun_alt&&$('epca_lat').value!==''&&lat>=-60&&lat<=60){var a=autoSunAlt(lat);if(a>=5&&a<=85)$('epca_sun_alt').value=a}}
  var scope=root.closest('#epcRoot')||document;
  function onSource(e){
    var el=e.target,changed=false;if(!el||!el.closest)return;
    LINKS.forEach(function(l){var hit=el.closest(l.from);if(hit&&pushLink(l,hit))changed=true});
    if(changed){syncSun();save()}
    if(changed||el.closest('#engRoof'))scheduleGenerate();
  }
  document.addEventListener('input',onSource);document.addEventListener('change',onSource);
  ids.forEach(function(id){var el=$(id);if(!el)return;
    function onOwn(e){if(e&&e.isTrusted&&LINKED.indexOf(id)>=0&&root.contains(el)&&document.activeElement===el)manual[id]=true;if(id==='epca_lat')syncSun();save();scheduleGenerate()}
    el.addEventListener('input',onOwn);el.addEventListener('change',onOwn);
  });
  $('epca_import').textContent='Re-link to Site, Layout & Electrical';
  $('epca_import').addEventListener('click',function(){manual={};pullAll();save();scheduleGenerate();notify('Auto Design now follows the Site, Layout and Electrical tabs again.')});
  $('epca_generate').textContent='Recalculate now';
  $('epca_generate').addEventListener('click',generate);
  $('epca_reset').addEventListener('click',function(){if(!confirm('Reset only Auto Design inputs for this EPC project? Existing EPC project data will not be changed.'))return;var all=allDesigns();delete all[projectKey()];localStorage.setItem('gs_epc_auto_designs_v1',JSON.stringify(all));ids.forEach(function(id){if($(id))$(id).value=$(id).defaultValue});last=null;$('epca_results').innerHTML='';$('epca_layout').innerHTML='<div class="epca-empty">Generate a design to preview the panel layout.</div>';$('epca_schedule').innerHTML='';$('epca_warnings').textContent='Auto Design inputs reset. Existing EPC data is untouched.';setMode('rooftop')});
  $('epca_map').addEventListener('click',function(){var lat=val('epca_lat'),lon=val('epca_lon');if(!lat||!lon){notify('Enter latitude and longitude first.');return}window.open('https://www.google.com/maps?q='+encodeURIComponent(lat+','+lon),'_blank')});
  $('epca_media').addEventListener('change',function(e){var box=$('epca_mediaPreview');mediaUrls.forEach(function(u){URL.revokeObjectURL(u)});mediaUrls=[];box.innerHTML='';Array.prototype.forEach.call(e.target.files||[],function(file){var url=URL.createObjectURL(file);mediaUrls.push(url);var el;if(file.type.indexOf('video/')===0){el=document.createElement('video');el.controls=true}else if(file.type.indexOf('image/')===0){el=document.createElement('img');el.alt=file.name}else return;el.src=url;el.title=file.name;box.appendChild(el)});if(!box.children.length)box.textContent='No site media selected';notify('Site media preview ready. Files remain on this device and are not uploaded or AI-measured.')});
  $('epca_dxf').addEventListener('click',dxf);
  $('epca_bom').addEventListener('click',function(){if(!last){notify('Generate a design first.');return}download('GenSolar-EPC-Auto-BOM.csv','text/csv;charset=utf-8',csvText())});
  $('epca_printBtn').addEventListener('click',printReport);
  var projectSelect=$('epc_projSel');if(projectSelect)projectSelect.addEventListener('change',function(){setTimeout(load,0)});
  var nameField=$('epc_f-name');if(nameField)nameField.addEventListener('change',function(){load()});
  load();
})();