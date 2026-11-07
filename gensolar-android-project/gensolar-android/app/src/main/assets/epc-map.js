/* EPC Site map: satellite map, location pointer and area selection for structure planning.
   Self-contained slippy map (no library). Imagery is a configurable tile URL: set window.EPC_MAP_TILES before this
   script to use another provider (for example Google Maps Platform with your key). Default is Esri World Imagery.
   Area drawn here is a SATELLITE ESTIMATE: the on-site roof survey always overrides it. */
(function(){
  'use strict';
  var KEY='gs_epc_map_v1',R=6371008.8,RAD=Math.PI/180,TS=256,ZMIN=3,ZMAX=19;
  var TILES=window.EPC_MAP_TILES||'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var ATTR=window.EPC_MAP_ATTR||'Imagery © Esri, Maxar, Earthstar Geographics';

  /* ---------- geometry (exported for tests) ---------- */
  function worldPx(lat,lon,z){var s=TS*Math.pow(2,z),la=Math.max(-85.0511,Math.min(85.0511,lat))*RAD;
    return {x:(lon+180)/360*s,y:(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*s}}
  function fromWorldPx(x,y,z){var s=TS*Math.pow(2,z),n=Math.PI-2*Math.PI*y/s;
    return {lat:Math.atan(Math.sinh(n))/RAD,lon:x/s*360-180}}
  function dist(a,b){var dl=(b[0]-a[0])*RAD,dn=(b[1]-a[1])*RAD,h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*RAD)*Math.cos(b[0]*RAD)*Math.sin(dn/2)*Math.sin(dn/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
  function bearing(a,b){var p1=a[0]*RAD,p2=b[0]*RAD,dn=(b[1]-a[1])*RAD,y=Math.sin(dn)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dn);
    return (Math.atan2(y,x)/RAD+360)%360}
  function polyStats(pts){                         /* pts: [[lat,lon],...]; local tangent-plane area, fine below ~10 km */
    var n=pts.length;if(n<3)return {area:0,perim:0,edge:null};
    var la0=0,lo0=0,i;for(i=0;i<n;i++){la0+=pts[i][0];lo0+=pts[i][1]}la0/=n;lo0/=n;
    var xy=pts.map(function(p){return [R*(p[1]-lo0)*RAD*Math.cos(la0*RAD),R*(p[0]-la0)*RAD]});
    var a=0,per=0,best=0,be=null;
    for(i=0;i<n;i++){var j=(i+1)%n;a+=xy[i][0]*xy[j][1]-xy[j][0]*xy[i][1];var d=dist(pts[i],pts[j]);per+=d;if(d>best){best=d;be={len:d,bearing:bearing(pts[i],pts[j])}}}
    return {area:Math.abs(a)/2,perim:per,edge:be};
  }
  function segsCross(p,q,r,s){function o(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
    var d1=o(p,q,r),d2=o(p,q,s),d3=o(r,s,p),d4=o(r,s,q);return d1*d2<0&&d3*d4<0}
  function selfIntersects(pts){var n=pts.length;if(n<4)return false;
    for(var i=0;i<n;i++)for(var j=i+1;j<n;j++){if(Math.abs(i-j)<2||(i===0&&j===n-1))continue;
      if(segsCross(pts[i],pts[(i+1)%n],pts[j],pts[(j+1)%n]))return true}return false}
  window.EPCMapGeo={worldPx:worldPx,fromWorldPx:fromWorldPx,dist:dist,bearing:bearing,polyStats:polyStats,selfIntersects:selfIntersects};

  /* ---------- helpers ---------- */
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function fx(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function pname(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  var st={lat:17.385,lon:78.4867,z:5,pin:null,areas:[],draft:[],mode:'pin',open:false};
  function saveSt(){var a=loadAll();a[pname()]={lat:st.lat,lon:st.lon,z:st.z,pin:st.pin,areas:st.areas};try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
  function loadSt(){var o=loadAll()[pname()];if(o){st.lat=o.lat;st.lon=o.lon;st.z=o.z;st.pin=o.pin||null;st.areas=o.areas||[]}else{st.pin=null;st.areas=[]}st.draft=[]}
  function setField(id,v){var e=$(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
  function label(i){return 'Structure '+String.fromCharCode(65+(i%26))}

  /* ---------- Site card ---------- */
  function mountCard(){
    var lat=$('engLat');if(!lat||$('epcm_card'))return false;
    var grid=lat.parentNode.parentNode;
    var c=document.createElement('div');c.id='epcm_card';c.className='epq';c.style.cssText='padding:10px 12px;margin:8px 0;border:1px solid var(--line);border-radius:12px';
    c.innerHTML='<b>Map location and area</b><div id="epcm_sum" class="meta" style="margin:4px 0 8px"></div><button type="button" class="btn alt sm" id="epcm_open">Open satellite map</button>';
    grid.parentNode.insertBefore(c,grid);
    $('epcm_open').addEventListener('click',openMap);
    return true;
  }
  function totalM2(){return st.areas.reduce(function(s,a){return s+polyStats(a.pts).area},0)}
  function sumCard(){var e=$('epcm_sum');if(!e)return;
    var la=parseFloat(($('engLat')||{}).value),lo=parseFloat(($('engLon')||{}).value),t=totalM2();
    e.textContent=(isFinite(la)&&isFinite(lo)?'Pointer: '+la.toFixed(6)+', '+lo.toFixed(6):'No location picked yet')+(st.areas.length?' · '+st.areas.length+' area(s), '+Math.round(t)+' m² ('+Math.round(t*10.7639)+' sq ft) satellite estimate':'')}

  /* ---------- overlay ---------- */
  var ov,vp,tl,svg,tiles={},drag=null,pts2={},pinch=null,moved=false;
  function build(){
    if(ov)return;
    ov=document.createElement('div');ov.id='epcm';ov.hidden=true;
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:var(--surface,#fff);color:var(--ink,#111);display:flex;flex-direction:column';
    ov.innerHTML='<div style="display:flex;gap:6px;padding:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line,#ddd)">'+
      '<button type="button" class="btn alt sm" id="epcm_close">Close</button>'+
      '<input id="epcm_q" type="search" placeholder="Place, or lat, lon" style="flex:1;min-width:120px;padding:7px;border:1px solid var(--line,#ccc);border-radius:8px">'+
      '<button type="button" class="btn sm" id="epcm_go">Search</button><button type="button" class="btn alt sm" id="epcm_loc">My location</button></div>'+
      '<div style="display:flex;gap:6px;padding:6px 8px;flex-wrap:wrap" role="group" aria-label="Map tools">'+
      '<button type="button" class="btn sm" id="epcm_mpin" aria-pressed="true">Pointer</button><button type="button" class="btn alt sm" id="epcm_mdraw" aria-pressed="false">Draw area</button>'+
      '<button type="button" class="btn alt sm" id="epcm_undo">Undo point</button><button type="button" class="btn alt sm" id="epcm_fin">Finish area</button></div>'+
      '<div id="epcm_vp" style="position:relative;flex:1;min-height:200px;overflow:hidden;background:#222;touch-action:none;cursor:grab">'+
      '<div id="epcm_tl" style="position:absolute;left:0;top:0"></div>'+
      '<svg id="epcm_svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg>'+
      '<div style="position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px"><button type="button" class="btn sm" id="epcm_zi" aria-label="Zoom in">+</button><button type="button" class="btn sm" id="epcm_zo" aria-label="Zoom out">−</button></div>'+
      '<div id="epcm_attr" style="position:absolute;left:4px;bottom:2px;font-size:10px;color:#fff;text-shadow:0 0 3px #000"></div></div>'+
      '<div id="epcm_sheet" style="padding:8px 10px;border-top:1px solid var(--line,#ddd);height:34vh;flex:none;overflow:auto;font-size:13px"></div>';
    (document.getElementById('view-engineering')||document.body).appendChild(ov);
    vp=$('epcm_vp');tl=$('epcm_tl');svg=$('epcm_svg');$('epcm_attr').textContent=ATTR;
    $('epcm_close').onclick=closeMap;
    $('epcm_zi').onclick=function(){zoomBy(1)};$('epcm_zo').onclick=function(){zoomBy(-1)};
    $('epcm_mpin').onclick=function(){setMode('pin')};$('epcm_mdraw').onclick=function(){setMode('draw')};
    $('epcm_undo').onclick=function(){st.draft.pop();paint()};
    $('epcm_fin').onclick=finish;
    $('epcm_go').onclick=search;$('epcm_q').addEventListener('keydown',function(e){if(e.key==='Enter')search()});
    $('epcm_loc').onclick=locate;
    vp.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.deltaY<0?1:-1,e.clientX,e.clientY)},{passive:false});
    vp.addEventListener('pointerdown',pdown);vp.addEventListener('pointermove',pmove);vp.addEventListener('pointerup',pup);vp.addEventListener('pointercancel',pup);
    window.addEventListener('resize',function(){if(st.open)paint()});
    ov.addEventListener('keydown',function(e){if(e.key==='Escape')closeMap()});
  }
  function setMode(m){st.mode=m;$('epcm_mpin').className='btn'+(m==='pin'?'':' alt')+' sm';$('epcm_mdraw').className='btn'+(m==='draw'?'':' alt')+' sm';
    $('epcm_mpin').setAttribute('aria-pressed',m==='pin');$('epcm_mdraw').setAttribute('aria-pressed',m==='draw');paint()}
  function openMap(){
    build();loadSt();
    var la=parseFloat(($('engLat')||{}).value),lo=parseFloat(($('engLon')||{}).value);
    if(isFinite(la)&&isFinite(lo)){st.lat=la;st.lon=lo;if(st.z<15)st.z=18;if(!st.pin)st.pin=[la,lo]}
    ov.hidden=false;st.open=true;setMode(st.pin&&!st.areas.length?'draw':'pin');paint();$('epcm_q').focus();
  }
  function closeMap(){ov.hidden=true;st.open=false;saveSt();sumCard()}
  function size(){return {w:vp.clientWidth||320,h:vp.clientHeight||320}}
  function toScreen(lat,lon){var s=size(),c=worldPx(st.lat,st.lon,st.z),p=worldPx(lat,lon,st.z);return {x:p.x-c.x+s.w/2,y:p.y-c.y+s.h/2}}
  function toLL(x,y){var s=size(),c=worldPx(st.lat,st.lon,st.z),r=fromWorldPx(c.x+x-s.w/2,c.y+y-s.h/2,st.z);return [r.lat,r.lon]}
  function zoomBy(d){zoomAt(d,null,null)}
  function zoomAt(d,cx,cy){
    var nz=Math.max(ZMIN,Math.min(ZMAX,st.z+d));if(nz===st.z)return;
    if(cx!==null){var r=vp.getBoundingClientRect(),ll=toLL(cx-r.left,cy-r.top);st.z=nz;
      var s=size(),p=worldPx(ll[0],ll[1],nz),c=fromWorldPx(p.x-(cx-r.left-s.w/2),p.y-(cy-r.top-s.h/2),nz);st.lat=c.lat;st.lon=c.lon}
    else st.z=nz;
    paint();
  }
  function paint(){
    if(!st.open)return;
    var s=size(),c=worldPx(st.lat,st.lon,st.z),z=st.z,n=Math.pow(2,z);
    var x0=Math.floor((c.x-s.w/2)/TS),x1=Math.floor((c.x+s.w/2)/TS),y0=Math.floor((c.y-s.h/2)/TS),y1=Math.floor((c.y+s.h/2)/TS);
    var keep={},x,y;
    for(y=Math.max(0,y0);y<=Math.min(n-1,y1);y++)for(x=x0;x<=x1;x++){
      var wx=((x%n)+n)%n,k=z+'/'+wx+'/'+y,img=tiles[k];
      if(!img){img=new Image();img.alt='';img.draggable=false;img.crossOrigin='anonymous';img.style.cssText='position:absolute;width:'+TS+'px;height:'+TS+'px;user-select:none';
        img.src=TILES.replace('{z}',z).replace('{x}',wx).replace('{y}',y);tl.appendChild(img);tiles[k]=img}
      img.style.left=Math.round(x*TS-c.x+s.w/2)+'px';img.style.top=Math.round(y*TS-c.y+s.h/2)+'px';keep[k]=1;
    }
    Object.keys(tiles).forEach(function(k){if(!keep[k]){tl.removeChild(tiles[k]);delete tiles[k]}});
    drawSvg();sheet();
  }
  function drawSvg(){
    var h='',i;
    function poly(pts,cls,close){var p=pts.map(function(q){var s=toScreen(q[0],q[1]);return s.x.toFixed(1)+','+s.y.toFixed(1)});
      return '<'+(close?'polygon':'polyline')+' points="'+p.join(' ')+'" fill="'+(close?'rgba(255,193,7,.28)':'none')+'" stroke="'+cls+'" stroke-width="2"/>'}
    st.areas.forEach(function(a,k){h+=poly(a.pts,'#ffc107',true);var cx=0,cy=0;a.pts.forEach(function(q){var s=toScreen(q[0],q[1]);cx+=s.x;cy+=s.y});
      h+='<text x="'+(cx/a.pts.length).toFixed(1)+'" y="'+(cy/a.pts.length).toFixed(1)+'" fill="#fff" stroke="#000" stroke-width=".6" font-size="13" font-weight="700" text-anchor="middle">'+esc(a.label)+'</text>'});
    if(st.draft.length){h+=poly(st.draft,'#00e5ff',false);st.draft.forEach(function(q){var s=toScreen(q[0],q[1]);h+='<circle cx="'+s.x.toFixed(1)+'" cy="'+s.y.toFixed(1)+'" r="4" fill="#00e5ff" stroke="#000"/>'})}
    if(st.pin){var p=toScreen(st.pin[0],st.pin[1]);
      h+='<g transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')"><path d="M0,0 C-10,-14 -12,-20 -12,-25 A12,12 0 1 1 12,-25 C12,-20 10,-14 0,0 Z" fill="#e53935" stroke="#fff" stroke-width="2"/><circle cx="0" cy="-25" r="4.5" fill="#fff"/></g>'}
    svg.innerHTML=h;
  }
  function sheet(){
    var h='',t=totalM2(),sh=$('epcm_sheet');
    h+='<div><b>Pointer</b> '+(st.pin?st.pin[0].toFixed(6)+', '+st.pin[1].toFixed(6):'tap the map to drop it')+' <small>(zoom '+st.z+')</small></div>';
    h+='<div style="margin:6px 0">'+(st.mode==='draw'?'Tap the corners of the roof or structure area, then Finish area. '+(st.draft.length?st.draft.length+' point(s) so far.':''):'Tap to move the pointer.')+'</div>';
    if(st.areas.length){h+='<table style="width:100%;border-collapse:collapse"><tbody>';
      st.areas.forEach(function(a,i){var s=polyStats(a.pts);
        h+='<tr><td style="padding:3px 0"><b>'+esc(a.label)+'</b><br><small>'+(s.edge?'longest edge '+s.edge.len.toFixed(1)+' m, bearing '+s.edge.bearing.toFixed(0)+'°':'')+'</small></td><td style="text-align:right">'+s.area.toFixed(1)+' m²<br><small>'+Math.round(s.area*10.7639)+' sq ft</small></td><td style="text-align:right"><button type="button" class="btn alt sm" data-del="'+i+'" aria-label="Delete '+esc(a.label)+'">Delete</button></td></tr>'});
      h+='</tbody></table><div style="margin:4px 0"><b>Total '+t.toFixed(1)+' m² ('+Math.round(t*10.7639)+' sq ft)</b></div>'}
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn sm" id="epcm_use"'+(st.pin?'':' disabled')+'>Use pointer as site location</button>'+
       '<button type="button" class="btn sm" id="epcm_usearea"'+(st.areas.length?'':' disabled')+'>Use total area as roof area</button></div>'+
       '<div class="meta" style="margin-top:6px">Satellite estimate only. Maps cannot show roof strength or true usable area; the on-site roof survey governs, and a structural engineer must verify the roof.</div>';
    sh.innerHTML=h;
    var u=$('epcm_use');if(u)u.onclick=function(){setField('engLat',st.pin[0].toFixed(6));setField('engLon',st.pin[1].toFixed(6));saveSt();sumCard();msg('Site latitude and longitude updated.')};
    var a=$('epcm_usearea');if(a)a.onclick=function(){setField('engRoof',Math.round(totalM2()*10.7639));saveSt();sumCard();msg('Roof area set from the map. Confirm it on the site survey.')};
    Array.prototype.forEach.call(sh.querySelectorAll('[data-del]'),function(b){b.onclick=function(){st.areas.splice(+b.getAttribute('data-del'),1);st.areas.forEach(function(x,i){x.label=label(i)});saveSt();paint()}});
  }
  function msg(t){var e=document.createElement('div');e.setAttribute('role','status');e.textContent=t;e.style.cssText='position:absolute;left:50%;top:60px;transform:translateX(-50%);background:#1a7f4b;color:#fff;padding:8px 12px;border-radius:8px;z-index:3;font-size:13px';ov.appendChild(e);setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},2500)}
  function finish(){
    if(st.draft.length<3){msg('Add at least 3 points first.');return}
    if(selfIntersects(st.draft)){msg('The outline crosses itself. Undo a point and retry.');return}
    st.areas.push({label:label(st.areas.length),pts:st.draft.slice()});st.draft=[];saveSt();paint();
  }
  /* pointer gestures */
  function pdown(e){if(e.target.closest&&e.target.closest('button'))return;vp.setPointerCapture&&vp.setPointerCapture(e.pointerId);pts2[e.pointerId]={x:e.clientX,y:e.clientY};moved=false;
    var ids=Object.keys(pts2);
    if(ids.length===1){drag={x:e.clientX,y:e.clientY,lat:st.lat,lon:st.lon,sx:e.clientX,sy:e.clientY}}
    else if(ids.length===2){var a=pts2[ids[0]],b=pts2[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:st.z};drag=null}}
  function pmove(e){if(!pts2[e.pointerId])return;pts2[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pts2);
    if(pinch&&ids.length===2){var a=pts2[ids[0]],b=pts2[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),dz=Math.round(Math.log(d/pinch.d)/Math.LN2*1.5);
      var nz=Math.max(ZMIN,Math.min(ZMAX,pinch.z+dz));if(nz!==st.z){st.z=nz;moved=true;paint()}return}
    if(drag){var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>6)moved=true;
      if(moved){var c=worldPx(drag.lat,drag.lon,st.z),r=fromWorldPx(c.x-dx,c.y-dy,st.z);st.lat=Math.max(-80,Math.min(80,r.lat));st.lon=r.lon;paint()}}}
  function pup(e){
    var wasTap=!moved&&drag&&!pinch&&pts2[e.pointerId];
    delete pts2[e.pointerId];if(Object.keys(pts2).length<2)pinch=null;if(!Object.keys(pts2).length)drag=null;
    if(wasTap){var r=vp.getBoundingClientRect(),ll=toLL(e.clientX-r.left,e.clientY-r.top);
      if(st.mode==='pin'){st.pin=ll;saveSt()}else st.draft.push(ll);paint()}}
  /* search and location */
  function search(){
    var q=$('epcm_q').value.trim();if(!q)return;
    var m=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if(m){var la=parseFloat(m[1]),lo=parseFloat(m[2]);if(la>=-85&&la<=85&&lo>=-180&&lo<=180){goTo(la,lo);return}msg('Coordinates out of range.');return}
    msg('Searching…');
    fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(j){
      if(!j.length){msg('Place not found.');return}goTo(parseFloat(j[0].lat),parseFloat(j[0].lon))}).catch(function(){msg('Search needs internet. You can type coordinates instead.')});
  }
  function goTo(la,lo){st.lat=la;st.lon=lo;if(st.z<17)st.z=18;st.pin=[la,lo];saveSt();paint()}
  function locate(){
    if(!navigator.geolocation){msg('Location is not available on this device.');return}
    navigator.geolocation.getCurrentPosition(function(p){goTo(p.coords.latitude,p.coords.longitude)},function(){msg('Location permission denied or unavailable. Search or tap the map instead.')},{enableHighAccuracy:true,timeout:10000});
  }

  function init(){if(mountCard()){loadSt();sumCard();['engLat','engLon','engSite'].forEach(function(id){var e=$(id);if(e)e.addEventListener('change',function(){if(id==='engSite')saveSt();sumCard()})});
      var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadSt();sumCard()},80)});
      ['epc_newProj','epc_loadRef'].forEach(function(i){var b=$(i);if(b)b.addEventListener('click',function(){setTimeout(function(){loadSt();sumCard()},150)})})}}
  window.EPCMap={open:function(){openMap()},state:st};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,60)});else setTimeout(init,60);
})();
