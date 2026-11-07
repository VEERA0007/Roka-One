/* GenSolar EPC: one project record across the EPC tabs, plus a live design check.
   Affects the EPC tab only. Fields that appear on more than one EPC tab (Site, Auto Design, Layout,
   Electrical) are kept equal in both directions, so a value entered anywhere is used everywhere. */
(function(){
  'use strict';
  var doc=document,syncing=false,qaTimer=null;
  function q(s){return doc.querySelector(s)}
  function num(v){var x=parseFloat(v);return isFinite(x)?x:null}
  function f1(n){return (Math.round(n*10)/10).toLocaleString('en-IN')}
  function fire(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}

  /* ---- member types: how to read a field as a canonical value and write one back ---- */
  function N(sel,o){o=o||{};return {sel:sel,src:o.src,read:function(e){return num(e.value)},write:function(e,v){e.value=String(v)}}}
  function T(sel){return {sel:sel,read:function(e){return e.value===''?null:e.value},write:function(e,v){e.value=v}}}
  function MM(sel){return {sel:sel,read:function(e){return num(e.value)},write:function(e,v){e.value=String(Math.round(v))}}}
  function METRES(sel){return {sel:sel,read:function(e){var x=num(e.value);return x==null?null:Math.round(x*1000)},write:function(e,v){e.value=(v/1000).toFixed(3)}}}
  var WP_SITE={sel:'#engPanelW',read:function(e){return num(e.value)},write:function(e,v){
    var s=String(v),has=Array.prototype.some.call(e.options,function(o){return o.value===s});
    if(!has){var o=doc.createElement('option');o.value=s;o.text=s;e.appendChild(o)}e.value=s}};
  function kind(t){t=String(t||'').toLowerCase();return t.indexOf('ground')>=0?'ground':(t.indexOf('metal')>=0?'metal':'rooftop')}
  var MOUNT_SITE={sel:'#engMount',read:function(e){return kind(e.value)},write:function(e,v){
    var want={rooftop:'rcc',metal:'metal',ground:'ground'}[v];
    Array.prototype.some.call(e.options,function(o){if(o.text.toLowerCase().indexOf(want)>=0){e.value=o.value;return true}return false})}};
  var MOUNT_AD={sel:'#epca_mount',read:function(e){return e.value||null},write:function(e,v){e.value=v}};

  /* Members are listed in priority order: when a project is opened, the first member that holds a value
     is the one every other member is set from. Layout leads for project and module data, Site for the rest. */
  var GROUPS=[
    {k:'name',m:[T('[data-k="project.name"]'),T('#engSite'),T('#epca_project')]},
    {k:'wp',m:[N('[data-k="module.wp"]'),WP_SITE,N('#epca_wp')]},
    {k:'tilt',m:[N('[data-k="tilt"]'),N('#engTilt'),N('#epca_tilt')]},
    {k:'orient',m:[T('[data-k="module.orient"]'),T('#epca_orientation')]},
    {k:'len',m:[MM('[data-k="module.len"]'),METRES('#epca_module_l')]},
    {k:'wid',m:[MM('[data-k="module.wid"]'),METRES('#epca_module_w')]},
    {k:'lat',m:[N('#engLat'),N('#epca_lat')]},
    {k:'lon',m:[N('#engLon'),N('#epca_lon')]},
    {k:'cap',m:[N('#engCapacity'),N('#epca_capacity')]},
    {k:'az',m:[N('#engAzimuth'),N('#epca_azimuth')]},
    {k:'inv',m:[N('#engInverter'),N('#epca_inverter',{src:false})]},
    {k:'mount',m:[MOUNT_SITE,MOUNT_AD]}
  ];
  /* Electrical-tab values that Auto Design needs. One direction only; Auto Design shows them as inputs it uses. */
  var ONEWAY=[['[data-x="elec.voc"]','#epca_voc'],['[data-x="elec.tcVoc"]','#epca_voc_coeff'],['[data-x="elec.tmin"]','#epca_min_temp'],
    ['[data-x="elec.invVmax"]','#epca_max_dc'],['[data-x="elec.cableLen"]','#epca_dc_route'],['[data-x="elec.acLen"]','#epca_ac_route']];

  function same(a,b){return (typeof a==='number'&&typeof b==='number')?Math.abs(a-b)<1e-6:a===b}
  function writeTo(m,v){
    var el=q(m.sel);if(!el)return false;
    var cur=m.read(el);if(same(cur,v))return false;
    syncing=true;try{m.write(el,v);fire(el)}finally{syncing=false}
    return true;
  }
  function pushFrom(g,from){
    var v=from.read(q(from.sel));if(v==null||v==='')return false;
    var changed=false;g.m.forEach(function(m){if(m!==from&&writeTo(m,v))changed=true});return changed;
  }
  function pushOneWay(){
    var changed=false;
    ONEWAY.forEach(function(p){var a=q(p[0]),b=q(p[1]);if(!a||!b||a.value===''||a.value===b.value)return;b.value=a.value;changed=true});
    return changed;
  }
  function emit(){doc.dispatchEvent(new CustomEvent('epc:linked'));scheduleQA()}

  /* Open or reload a project: bring every tab in line with the leading tab for each field. */
  function pull(){
    var changed=false;
    GROUPS.forEach(function(g){
      for(var i=0;i<g.m.length;i++){
        var m=g.m[i],el=q(m.sel);if(!el||m.src===false)continue;
        var v=m.read(el);if(v==null||v==='')continue;
        if(pushFrom(g,m))changed=true;break;
      }
    });
    if(pushOneWay())changed=true;
    emit();return changed;
  }

  function onUser(e){
    if(syncing)return;var t=e.target;if(!t||!t.matches)return;
    var changed=false,hit=false;
    for(var i=0;i<GROUPS.length&&!hit;i++){
      var g=GROUPS[i];
      for(var j=0;j<g.m.length;j++){
        var m=g.m[j];
        if(m.src!==false&&t.matches(m.sel)){hit=true;if(pushFrom(g,m))changed=true;break}
      }
    }
    if(!hit)ONEWAY.forEach(function(p){if(t.matches(p[0])){hit=true}});
    if(hit&&pushOneWay())changed=true;
    if(changed)emit();else scheduleQA();
  }

  /* ---- live design check ---- */
  var qa=null;
  function mountQA(){
    if(qa)return qa;var host=q('#epc_st-eng');if(!host)return null;
    qa=doc.createElement('details');qa.id='epc_qa';qa.className='epq';qa.open=true;qa.setAttribute('aria-live','polite');
    var st=doc.createElement('style');
    st.textContent='#epcRoot .epq{margin:10px 0;border:1px solid var(--line);border-radius:12px;background:var(--surface)}#epcRoot .epq>summary{cursor:pointer;padding:10px 12px;font:600 14px var(--font-body);display:flex;gap:8px;align-items:center;flex-wrap:wrap}#epcRoot .epq .epq-body{padding:0 12px 12px}#epcRoot .epq ul{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}#epcRoot .epq li{font-size:13px;line-height:1.4;display:flex;gap:8px;align-items:flex-start}#epcRoot .epq li .pill{flex:none;min-width:44px;text-align:center}#epcRoot .epq .pill.err{color:var(--bad);border-color:var(--bad)}#epcRoot .epq .pill.info{color:var(--muted)}';
    doc.head.appendChild(st);host.insertBefore(qa,host.firstChild);return qa;
  }
  function readLayout(){try{return JSON.parse(localStorage.getItem('gs_epc_v1')||'null')}catch(e){return null}}
  function val(id){var el=doc.getElementById(id);return el?num(el.value):null}

  function checks(){
    var S=readLayout(),out=[],chips=[];
    function add(l,m){out.push({l:l,m:m})}
    var mods=0,wp=null,elec=null;
    if(S&&S.blocks){S.blocks.forEach(function(b){mods+=(+b.rows||0)*(+b.perRow||0)});wp=S.module&&+S.module.wp;elec=S.elec}
    var layoutKw=(mods&&wp)?mods*wp/1000:null;
    var cap=val('engCapacity'),inv=val('engInverter'),lat=val('engLat'),lon=val('engLon'),roof=val('engRoof'),perKw=val('engRoofPerKw')||80,tilt=S&&+S.tilt;

    chips.push(['Target',cap!=null?f1(cap)+' kWp':'not set']);
    chips.push(['Layout',layoutKw!=null?f1(layoutKw)+' kWp':'not set',mods?mods+' modules':'']);

    if(lat==null||lon==null)add('warn','Site latitude and longitude are not entered. Sun path, shading and wind zone cannot be set.');
    else if(lat<6||lat>38||lon<68||lon>98)add('warn','The coordinates are outside India. Check latitude and longitude.');
    else add('ok','Site coordinates entered ('+lat+', '+lon+').');

    if(cap!=null&&cap>0&&layoutKw!=null){
      var d=(layoutKw-cap)/cap*100;
      if(Math.abs(d)>5)add('warn','Layout is '+f1(layoutKw)+' kWp ('+mods+' modules) against a target of '+f1(cap)+' kWp ('+(d>0?'+':'')+f1(d)+'%). Adjust the array blocks or the target.');
      else add('ok','Layout capacity '+f1(layoutKw)+' kWp is within 5% of the '+f1(cap)+' kWp target.');
    }
    if(layoutKw!=null&&inv!=null&&inv>0){
      var r=layoutKw/inv;chips.push(['DC / AC',r.toFixed(2)]);
      if(r>1.5)add('err','DC/AC ratio is '+r.toFixed(2)+'. Above 1.5 the inverter will clip heavily. Increase the inverter size.');
      else if(r<1)add('warn','DC/AC ratio is '+r.toFixed(2)+'. The inverter is larger than the array.');
      else add('ok','DC/AC ratio '+r.toFixed(2)+' (array '+f1(layoutKw)+' kWp, inverter '+f1(inv)+' kW).');
    }else if(layoutKw!=null)add('info','Enter the planned inverter AC capacity on the Site tab to check DC/AC ratio.');

    if(elec&&isFinite(elec.voc)&&isFinite(elec.invVmax)){
      var vocCold=elec.voc*(1+elec.tcVoc/100*(elec.tmin-25)),vmpHot=elec.vmp*(1+elec.tcPmax/100*(elec.tmax-25)),vmpCold=elec.vmp*(1+elec.tcPmax/100*(elec.tmin-25));
      var maxN=Math.max(1,Math.min(Math.floor(elec.invVmax/vocCold),Math.floor(elec.mpptMax/vmpCold))),minN=Math.max(1,Math.ceil(elec.mpptMin/vmpHot));
      chips.push(['Modules / string',minN+' to '+maxN]);
      if(minN>maxN)add('err','No valid string length: the inverter window needs at least '+minN+' modules but at most '+maxN+' are allowed at the site minimum temperature.');
      else if(elec.perString>0&&(elec.perString>maxN||elec.perString<minN))add('err','The chosen '+elec.perString+' modules per string is outside the allowed '+minN+' to '+maxN+'.');
      else add('ok','Allowed modules per string '+minN+' to '+maxN+'.');
    }

    if(layoutKw!=null){
      var need=layoutKw*perKw;
      if(roof!=null&&roof>0){
        chips.push(['Roof',Math.round(need).toLocaleString('en-IN')+' of '+Math.round(roof).toLocaleString('en-IN')+' sq ft']);
        if(need>roof)add('warn','The layout needs about '+Math.round(need).toLocaleString('en-IN')+' sq ft at '+perKw+' sq ft per kW, but the usable roof is '+Math.round(roof).toLocaleString('en-IN')+' sq ft.');
        else add('ok','Roof area is enough: about '+Math.round(need).toLocaleString('en-IN')+' of '+Math.round(roof).toLocaleString('en-IN')+' sq ft.');
      }else add('info','Enter the surveyed usable roof area on the Site tab to check the layout fits.');
    }
    if(tilt!=null&&isFinite(tilt)&&(tilt<0||tilt>30))add('warn','The Layout structure drawings support tilt up to 30 degrees. Tilt is '+tilt+'.');

    var W=window.EPCWind&&window.EPCWind.status();
    if(W&&W.state==='pass'){chips.push(['Wind / structure','pass (prelim.)','pd '+(W.pd*1000).toFixed(0)+' N/m²']);add('ok','Wind and structure checks pass for the entered values (preliminary). Pressure '+(W.pd*1000).toFixed(0)+' N/m², purlin '+W.pur.maxUtil.toFixed(2)+', rafter '+W.raf.maxUtil.toFixed(2)+', anchors '+W.anc.util.toFixed(2)+'.')}
    else if(W&&W.state==='fail'){chips.push(['Wind / structure','FAIL']);add('err','Wind and structure checks fail: '+W.fails.join('; ')+'.')}
    else add('warn','Wind and structure inputs are incomplete, so Drawings, Electrical, BOM and Documents stay locked.');
    add('info','Preliminary design. Roof capacity, column buckling, connections and foundations are not checked by the app. A structural engineer must verify and sign off before construction.');
    return {out:out,chips:chips};
  }

  function renderQA(){
    var box=mountQA();if(!box)return;
    var r=checks(),err=0,warn=0;
    r.out.forEach(function(o){if(o.l==='err')err++;else if(o.l==='warn')warn++});
    var label={ok:'OK',warn:'Check',err:'Fix',info:'Note'};
    var head=err?'<span class="pill err">'+err+' to fix</span>':'';
    head+=warn?'<span class="pill warn">'+warn+' to check</span>':'';
    if(!err&&!warn)head+='<span class="pill ok">No issues found</span>';
    var chips='<div class="ep-sum" style="margin-top:10px">'+r.chips.map(function(c){return '<div><b>'+c[1]+'</b><span>'+c[0]+(c[2]?' · '+c[2]:'')+'</span></div>'}).join('')+(r.chips.length%2?'<div></div>':'')+'</div>';
    var list='<ul>'+r.out.map(function(o){return '<li><span class="pill '+(o.l==='ok'?'ok':o.l)+'">'+label[o.l]+'</span><span>'+o.m+'</span></li>'}).join('')+'</ul>';
    box.innerHTML='<summary>Design check '+head+'</summary><div class="epq-body">'+chips+list+'</div>';
  }
  function scheduleQA(){clearTimeout(qaTimer);qaTimer=setTimeout(function(){try{renderQA()}catch(e){if(window.console)console.error(e)}},150)}

  /* ---- wiring ---- */
  doc.addEventListener('input',onUser);doc.addEventListener('change',onUser);
  var root=q('#epcRoot');
  if(root)root.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    if(t.closest('[data-epca-mode]')){setTimeout(function(){var el=q('#epca_mount');if(el)onUser({target:el})},0)}
    else if(t.closest('#epc_newProj,#epc_loadRef'))setTimeout(function(){pull()},0);
    else scheduleQA();
  });
  var ps=q('#epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){pull()},0)});

  window.EPCSync={pull:pull,refresh:scheduleQA};
  /* A new browser has no saved Layout yet. Save the built-in starting project once so the design check can read it. */
  try{if(!localStorage.getItem('gs_epc_v1')){var first=q('[data-k="project.name"]');if(first){syncing=true;try{first.dispatchEvent(new Event('input',{bubbles:true}))}finally{syncing=false}}}}catch(e){}
  pull();
})();
