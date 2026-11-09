/* EPC panel placement: fits module rows inside the areas drawn on the Site map.
   Rows follow the array azimuth, row pitch comes from the shadow engine, edge setback and obstacle clearance are entered by the user.
   Geometry only: the roof survey governs, and wind, structure and shading still need their own checks. */
(function(){
  'use strict';
  var RAD=Math.PI/180,KEY='gs_epc_place_v1',EPS=1e-9;

  /* ================= engine ================= */
  function inPoly(p,poly){
    var c=false,n=poly.length;
    for(var i=0,j=n-1;i<n;j=i++){
      var a=poly[i],b=poly[j];
      if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;
    }
    return c;
  }
  function distPointRect(px,py,r){var dx=Math.max(r.s0-px,0,px-r.s1),dy=Math.max(r.t0-py,0,py-r.t1);return Math.sqrt(dx*dx+dy*dy)}
  function distPointSeg(px,py,a,b){
    var vx=b[0]-a[0],vy=b[1]-a[1],l2=vx*vx+vy*vy,t=l2>0?((px-a[0])*vx+(py-a[1])*vy)/l2:0;
    t=Math.max(0,Math.min(1,t));var dx=px-(a[0]+t*vx),dy=py-(a[1]+t*vy);return Math.sqrt(dx*dx+dy*dy);
  }
  function crossesInterior(a,b,r){                 /* Liang-Barsky against the rectangle shrunk by 1e-7 */
    var e=1e-7,x0=r.s0+e,x1=r.s1-e,y0=r.t0+e,y1=r.t1-e;if(x0>=x1||y0>=y1)return false;
    var dx=b[0]-a[0],dy=b[1]-a[1],t0=0,t1=1,p=[-dx,dx,-dy,dy],q=[a[0]-x0,x1-a[0],a[1]-y0,y1-a[1]];
    for(var i=0;i<4;i++){
      if(Math.abs(p[i])<1e-15){if(q[i]<0)return false}
      else{var t=q[i]/p[i];if(p[i]<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}
    }
    return t0<=t1;
  }
  function distSegRect(a,b,r){
    if(crossesInterior(a,b,r))return 0;
    var d=Math.min(distPointRect(a[0],a[1],r),distPointRect(b[0],b[1],r));
    d=Math.min(d,distPointSeg(r.s0,r.t0,a,b),distPointSeg(r.s1,r.t0,a,b),distPointSeg(r.s1,r.t1,a,b),distPointSeg(r.s0,r.t1,a,b));
    return d;
  }
  function validCell(r,poly,obs,setback,clear){
    var cx=(r.s0+r.s1)/2,cy=(r.t0+r.t1)/2;
    if(!inPoly([cx,cy],poly))return false;
    var n=poly.length,i;
    for(i=0;i<n;i++){if(distSegRect(poly[i],poly[(i+1)%n],r)<setback-EPS)return false}
    for(var k=0;k<obs.length;k++){
      var o=obs[k],m=o.length;
      if(inPoly([cx,cy],o))return false;
      for(i=0;i<m;i++){if(distSegRect(o[i],o[(i+1)%m],r)<clear-EPS)return false}
    }
    return true;
  }
  /* poly/obs in the (s,t) frame (metres). o = {w,d,gap,pitch,setback,clear}. Tries several grid offsets, keeps the best. */
  function fit(poly,obs,o){
    var smin=1e18,smax=-1e18,tmin=1e18,tmax=-1e18;
    poly.forEach(function(p){smin=Math.min(smin,p[0]);smax=Math.max(smax,p[0]);tmin=Math.min(tmin,p[1]);tmax=Math.max(tmax,p[1])});
    var stepS=o.w+o.gap,stepT=o.pitch,cells=((smax-smin)/stepS)*((tmax-tmin)/stepT),K=cells>60000?2:(cells>15000?3:5),best=null;
    for(var oi=0;oi<K;oi++)for(var oj=0;oj<K;oj++){
      var s0=smin+o.setback+oi*stepS/K,t0=tmin+o.setback+oj*stepT/K,mods=[];   /* first feasible line, then fractional shifts */
      for(var t=t0;t+o.d<=tmax+EPS;t+=stepT){
        for(var s=s0;s+o.w<=smax+EPS;s+=stepS){
          var r={s0:s,s1:s+o.w,t0:t,t1:t+o.d};
          if(validCell(r,poly,obs,o.setback,o.clear))mods.push([s,t]);
        }
      }
      if(!best||mods.length>best.length)best=mods;
    }
    return best||[];
  }
  /* geographic <-> local frame (rows along u = (cos g, -sin g) east/north, down-slope v = (sin g, cos g)) */
  function frameOf(lat0,lon0,gamma){
    var R=window.EPCMapGeo.radii(lat0),k=Math.PI/180,c=Math.cos(lat0*k),g=gamma*RAD,cg=Math.cos(g),sg=Math.sin(g);
    return {
      to:function(p){var e=(p[1]-lon0)*k*R.N*c,n=(p[0]-lat0)*k*R.M;return [e*cg-n*sg,e*sg+n*cg]},
      back:function(s,t){var e=s*cg+t*sg,n=-s*sg+t*cg;return [lat0+n/R.M/k,lon0+e/(R.N*c)/k]}
    };
  }
  window.EPCPlaceEngine={fit:fit,frameOf:frameOf,inPoly:inPoly,distSegRect:distSegRect,validCell:validCell};

  /* ================= UI ================= */
  function $(id){return document.getElementById(id)}
  function q(s){return document.querySelector(s)}
  function nv(sel){var e=(sel.charAt(0)==='#'||sel.charAt(0)==='[')?q(sel):$(sel);if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function saveVals(){var a=loadAll();a[projName()]={sb:$('epcp_sb').value,cl:$('epcp_cl').value,rg:$('epcp_rg').value};try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
  function loadVals(){var o=loadAll()[projName()]||{};$('epcp_sb').value=o.sb!==undefined?o.sb:'';$('epcp_cl').value=o.cl!==undefined?o.cl:'';$('epcp_rg').value=o.rg!==undefined?o.rg:'0'}
  var result=null,layerAdded=false;

  function compute(){
    var out={state:'missing',missing:[]},M=window.EPCMap&&window.EPCMap.state();
    if(!M||!M.areas.length){out.missing.push('Draw at least one installation area on the Site map');return out}
    var sb=nv('epcp_sb'),cl=nv('epcp_cl'),rg=nv('epcp_rg');
    if(!(sb>=0)||$('epcp_sb').value==='')out.missing.push('Edge setback / row-end clearance (m)');
    if(!(cl>=0)||$('epcp_cl').value==='')out.missing.push('Obstacle clearance (m)');
    if(!(rg>=0))out.missing.push('Extra row gap (m, 0 if none)');
    var tilt=nv('engTilt'),az=nv('engAzimuth'),ml=nv('epca_module_l'),mw=nv('epca_module_w'),wp=nv('epca_wp'),
        gap=nv('[data-k="gap"]'),port=($('epca_orientation')||{}).value!=='landscape';
    if(!(tilt>=0&&tilt<=60))out.missing.push('Array tilt on Site');
    if(!(az>=0&&az<=360))out.missing.push('Array azimuth on Site');
    if(!(ml>0&&mw>0))out.missing.push('Module length and width (Auto Design)');
    if(!(wp>0))out.missing.push('Module Wp');
    if(!isFinite(gap))gap=0;
    var allpts=[];M.areas.concat(M.obstacles).forEach(function(p){p.forEach(function(x){allpts.push(x)})});
    var lat0=allpts.reduce(function(a,p){return a+p[0]},0)/allpts.length,lon0=allpts.reduce(function(a,p){return a+p[1]},0)/allpts.length;
    if(out.missing.length)return out;
    var h1=nv('epcs_h1'),h2=nv('epcs_h2');if(!(h1>=6&&h2<=18&&h1<h2)){h1=9;h2=15}
    var depthSlope=port?ml:mw,w=port?mw:ml,E=window.EPCShadowEngine;
    if(!E){return {state:'missing',missing:['Shadow engine not loaded']}}
    var rp=E.rowPitch(lat0,E.criticalDay(lat0),h1,h2,depthSlope,tilt,az);
    if(!rp.usable)return {state:'missing',missing:['Shade-free window has no sunshine on the critical day']};
    var d=depthSlope*Math.cos(tilt*RAD),pitch=rp.pitch+rg;
    var fr=frameOf(lat0,lon0,az),obs=M.obstacles.map(function(p){return p.map(fr.to)}),areas=[],total=0,mods=0;
    M.areas.forEach(function(p,i){
      var poly=p.map(fr.to),m=fit(poly,obs,{w:w,d:d,gap:gap/1000,pitch:pitch,setback:sb,clear:cl});
      var rows={};m.forEach(function(x){rows[x[1].toFixed(3)]=1});
      var corners=m.map(function(x){return [fr.back(x[0],x[1]),fr.back(x[0]+w,x[1]),fr.back(x[0]+w,x[1]+d),fr.back(x[0],x[1]+d)]});
      areas.push({name:String.fromCharCode(65+i%26),count:m.length,rows:Object.keys(rows).length,kwp:m.length*wp/1000,corners:corners});
      mods+=m.length;
    });
    total=mods*wp/1000;
    return {state:'ok',areas:areas,modules:mods,kwp:total,pitch:pitch,minPitch:rp.pitch,shadowHour:rp.hour,tilt:tilt,azimuth:az,w:w,d:d,gap:gap,sb:sb,cl:cl,wp:wp,ml:ml,mw:mw,port:port,window:[h1,h2]};
  }
  function layer(scr){
    if(!result||result.state!=='ok'||result.modules>6000||!result.areas)return '';
    var h='<path fill="rgba(41,121,255,.55)" stroke="#fff" stroke-width=".6" d="';
    result.areas.forEach(function(a){a.corners.forEach(function(c){
      for(var i=0;i<4;i++){var s=scr(c[i][0],c[i][1]);h+=(i?'L':'M')+s[0].toFixed(1)+' '+s[1].toFixed(1)}h+='Z';
    })});
    return h+'"/>';
  }
  function render(){
    var out=$('epcp_out');if(!out)return;var r=result,h='';
    if(r.state==='missing'){out.innerHTML='<small>To place panels, enter: '+r.missing.map(esc).join('; ')+'.</small>';return}
    h+='<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr><th align="left">Area</th><th align="right">Modules</th><th align="right">Rows</th><th align="right">kWp</th></tr></thead><tbody>';
    r.areas.forEach(function(a){h+='<tr style="border-top:1px solid var(--line)"><td>Area '+a.name+'</td><td align="right">'+a.count+'</td><td align="right">'+a.rows+'</td><td align="right">'+f(a.kwp,2)+'</td></tr>'});
    h+='<tr style="border-top:2px solid var(--line);font-weight:700"><td>Total</td><td align="right">'+r.modules+'</td><td></td><td align="right">'+f(r.kwp,2)+'</td></tr></tbody></table></div>';
    h+='<small>Row pitch '+f(r.pitch,3)+' m (shadow-free '+f(r.minPitch,3)+' m, '+(r.window[0])+':00 to '+r.window[1]+':00 on the critical day, plus extra gap). Module footprint '+f(r.w,3)+' × '+f(r.d,3)+' m, gap '+f(r.gap,0)+' mm, tilt '+f(r.tilt,0)+'°, azimuth '+f(r.azimuth,0)+'°. Rows are laid out to give the most modules; the blue modules are drawn on the map.'+(r.modules>6000?' Too many modules to draw on the map.':'')+'</small>';
    if(r.modules===0)h+='<div class="epca-warnings" style="margin-top:6px">No module fits with these setbacks. Reduce the setback or draw a larger area.</div>';
    h+='<div style="margin-top:8px"><button type="button" class="btn alt sm" id="epcp_apply"'+(r.modules?'':' disabled')+'>Use '+f(r.kwp,2)+' kWp as the Site target capacity</button></div>';
    out.innerHTML=h;
    var b=$('epcp_apply');if(b)b.onclick=function(){
      var e=$('engCapacity');if(!e)return;e.value=r.kwp.toFixed(2);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    };
  }
  var timer=null;
  function refresh(){
    clearTimeout(timer);
    timer=setTimeout(function(){
      var prev=result;
      try{result=compute()}catch(e){result={state:'missing',missing:['Placement could not be calculated: '+e.message]}}
      render();if(window.EPCMap&&window.EPCMap.repaint)window.EPCMap.repaint();
    },250);
  }
  function mount(){
    var host=$('epcm_res');if(!host||$('epcp'))return false;
    var d=document.createElement('div');d.id='epcp';d.style.marginTop='14px';
    d.innerHTML='<h3 style="margin:0 0 6px;font-size:15px">Panel placement in the drawn areas</h3>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:8px">'+
      '<div class="field"><label for="epcp_sb">Edge setback / row-end clearance (m)</label><input id="epcp_sb" type="number" min="0" step="0.05" inputmode="decimal" placeholder="Required"></div>'+
      '<div class="field"><label for="epcp_cl">Obstacle clearance (m)</label><input id="epcp_cl" type="number" min="0" step="0.05" inputmode="decimal" placeholder="Required"></div>'+
      '<div class="field"><label for="epcp_rg">Extra row gap (m)</label><input id="epcp_rg" type="number" min="0" step="0.05" inputmode="decimal" value="0"></div></div>'+
      '<div id="epcp_out" aria-live="polite"></div>';
    host.parentNode.insertBefore(d,host.nextSibling);
    return true;
  }
  function init(){
    if(!window.EPCMap||!window.EPCMapGeo||!mount())return;
    loadVals();
    window.EPCMap.addLayer(layer);layerAdded=true;
    ['epcp_sb','epcp_cl','epcp_rg'].forEach(function(id){$(id).addEventListener('input',function(){saveVals();refresh()})});
    document.addEventListener('epc:map',refresh);document.addEventListener('epc:linked',refresh);
    var ids={engTilt:1,engAzimuth:1,epca_module_l:1,epca_module_w:1,epca_wp:1,epca_orientation:1,epcs_h1:1,epcs_h2:1};
    function onAny(e){var t=e.target;if(t&&(ids[t.id]||(t.getAttribute&&t.getAttribute('data-k')==='gap')))refresh();else if(t&&t.id==='engSite'){saveVals()}}
    document.addEventListener('input',onAny,true);document.addEventListener('change',onAny,true);
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadVals();refresh()},120)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){loadVals();refresh()},200)})});
    refresh();
  }
  window.EPCPlace={result:function(){return result}};
  function boot(){setTimeout(init,200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
