/* EPC Site map: satellite view, location pin and drawn installation areas.
   No map library: a small slippy-map (Web Mercator tiles) so it works inside the Android WebView.
   Pin -> Site latitude/longitude. Drawn areas minus obstacles -> Site usable roof area (sq ft).
   Areas drawn on imagery are ESTIMATES; the roof survey overrides them. */
(function(){
  'use strict';
  var KEY='gs_epc_map_v1',TILE='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      TS=256,MINZ=3,MAXZ=20,SQFT=10.7639104167097;
  var A_WGS=6378137,E2=0.00669437999014;

  /* ---------- geometry (exported for tests) ---------- */
  function radii(latDeg){                        /* meridional M and prime-vertical N radii of curvature on WGS84 */
    var s=Math.sin(latDeg*Math.PI/180),w=1-E2*s*s;
    return {M:A_WGS*(1-E2)/Math.pow(w,1.5),N:A_WGS/Math.sqrt(w)};
  }
  function toLocal(pts,lat0,lon0){                /* pts [[lat,lon]] -> metres east/north of (lat0,lon0) */
    var r=radii(lat0),k=Math.PI/180,c=Math.cos(lat0*k);
    return pts.map(function(p){return [(p[1]-lon0)*k*r.N*c,(p[0]-lat0)*k*r.M]});
  }
  function polyStats(pts){
    var n=pts.length;if(n<3)return null;
    var lat0=0,lon0=0;pts.forEach(function(p){lat0+=p[0];lon0+=p[1]});lat0/=n;lon0/=n;
    var q=toLocal(pts,lat0,lon0),a=0,cx=0,cy=0,per=0,best=0,bear=0,i,j,cr;
    for(i=0;i<n;i++){j=(i+1)%n;cr=q[i][0]*q[j][1]-q[j][0]*q[i][1];a+=cr;cx+=(q[i][0]+q[j][0])*cr;cy+=(q[i][1]+q[j][1])*cr;
      var dx=q[j][0]-q[i][0],dy=q[j][1]-q[i][1],len=Math.sqrt(dx*dx+dy*dy);per+=len;
      if(len>best){best=len;bear=(Math.atan2(dx,dy)*180/Math.PI+360)%360}}
    var area=Math.abs(a)/2,ccw=a>0;
    if(area<1e-9)return {area:0,perimeter:per,centroid:[lat0,lon0],longest:best,bearing:bear,simple:false};
    cx/=(3*a);cy/=(3*a);
    var r=radii(lat0),k=Math.PI/180,c=Math.cos(lat0*k);
    return {area:area,perimeter:per,centroid:[lat0+cy/r.M/k,lon0+cx/(r.N*c)/k],longest:best,bearing:bear,simple:isSimple(q)};
  }
  function segX(a,b,c,d){                          /* proper intersection of segments ab and cd */
    function o(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])}
    var d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);
    return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));
  }
  function isSimple(q){                            /* false when edges cross (bow-tie) */
    var n=q.length;
    for(var i=0;i<n;i++)for(var j=i+1;j<n;j++){
      if(j===i+1||(i===0&&j===n-1))continue;
      if(segX(q[i],q[(i+1)%n],q[j],q[(j+1)%n]))return false;
    }
    return true;
  }
  /* Web Mercator */
  function wx(lon,z){return (lon+180)/360*TS*Math.pow(2,z)}
  function wy(lat,z){var s=Math.sin(lat*Math.PI/180);return (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*TS*Math.pow(2,z)}
  function lonOf(x,z){return x/(TS*Math.pow(2,z))*360-180}
  function latOf(y,z){var n=Math.PI-2*Math.PI*y/(TS*Math.pow(2,z));return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))}
  window.EPCMapGeo={polyStats:polyStats,radii:radii,wx:wx,wy:wy,lonOf:lonOf,latOf:latOf,SQFT:SQFT};

  /* ---------- state ---------- */
  var S={pin:null,areas:[],obst:[],view:{lat:17.385,lon:78.4867,z:5}},draft=[],mode='pin',syncing=false,box,svg,tiles,els={},tileMap={},W=300,H=320,clearArm=0,statusT=null;
  function $(id){return document.getElementById(id)}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function save(){var a=loadAll();a[projName()]={pin:S.pin,areas:S.areas,obst:S.obst,view:S.view};try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
  function load(){
    var o=loadAll()[projName()];
    S.pin=o&&o.pin||null;S.areas=o&&o.areas||[];S.obst=o&&o.obst||[];
    if(o&&o.view)S.view=o.view;
    draft=[];
  }
  function say(msg,err){var e=els.status;if(!e)return;e.textContent=msg||'';e.style.color=err?'var(--danger,#b3261e)':'';clearTimeout(statusT);if(msg)statusT=setTimeout(function(){e.textContent=''},6000)}

  /* ---------- write to Site fields ---------- */
  function setField(id,v){
    var e=$(id);if(!e)return;
    syncing=true;e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    syncing=false;
  }
  function netArea(){
    var a=0,o=0,ok=true;
    S.areas.forEach(function(p){var s=polyStats(p);if(s){a+=s.area;if(!s.simple)ok=false}});
    S.obst.forEach(function(p){var s=polyStats(p);if(s){o+=s.area;if(!s.simple)ok=false}});
    return {gross:a,obst:o,net:Math.max(0,a-o),valid:ok};
  }
  function pushSite(){
    if(S.pin){setField('engLat',S.pin.lat.toFixed(6));setField('engLon',S.pin.lon.toFixed(6))}
    var n=netArea();
    if(S.areas.length&&n.valid&&n.net>0)setField('engRoof',String(Math.round(n.net*SQFT)));
  }

  /* ---------- render ---------- */
  function scr(lat,lon){var v=S.view;return [wx(lon,v.z)-wx(v.lon,v.z)+W/2,wy(lat,v.z)-wy(v.lat,v.z)+H/2]}
  function geo(px,py){var v=S.view;return [latOf(wy(v.lat,v.z)+py-H/2,v.z),lonOf(wx(v.lon,v.z)+px-W/2,v.z)]}
  function drawTiles(){
    var v=S.view,z=v.z,cxw=wx(v.lon,z),cyw=wy(v.lat,z),n=Math.pow(2,z),
        x0=Math.floor((cxw-W/2)/TS),x1=Math.floor((cxw+W/2)/TS),y0=Math.floor((cyw-H/2)/TS),y1=Math.floor((cyw+H/2)/TS),want={};
    for(var ty=y0;ty<=y1;ty++)for(var tx=x0;tx<=x1;tx++){
      if(ty<0||ty>=n)continue;
      var txm=((tx%n)+n)%n,key=z+'/'+txm+'/'+ty+'@'+tx,img=tileMap[key];
      want[key]=1;
      if(!img){
        img=document.createElement('img');img.alt='';img.draggable=false;img.decoding='async';
        img.style.cssText='position:absolute;width:'+TS+'px;height:'+TS+'px;max-width:none;user-select:none;pointer-events:none';
        img.onerror=function(){this.style.visibility='hidden'};
        img.src=TILE.replace('{z}',z).replace('{x}',txm).replace('{y}',ty);
        tiles.appendChild(img);tileMap[key]=img;
      }
      img.style.left=Math.round(tx*TS-cxw+W/2)+'px';img.style.top=Math.round(ty*TS-cyw+H/2)+'px';
    }
    Object.keys(tileMap).forEach(function(k){if(!want[k]){var e=tileMap[k];if(e.parentNode)e.parentNode.removeChild(e);delete tileMap[k]}});
  }
  function ptsAttr(pts){return pts.map(function(p){var s=scr(p[0],p[1]);return s[0].toFixed(1)+','+s[1].toFixed(1)}).join(' ')}
  function drawOverlay(){
    var h='';
    function poly(p,col,label){
      var st=polyStats(p),bad=st&&!st.simple;
      h+='<polygon points="'+ptsAttr(p)+'" fill="'+(bad?'rgba(255,0,0,.25)':col.fill)+'" stroke="'+(bad?'#ff1744':col.stroke)+'" stroke-width="2" stroke-linejoin="round"/>';
      p.forEach(function(q){var s=scr(q[0],q[1]);h+='<circle cx="'+s[0].toFixed(1)+'" cy="'+s[1].toFixed(1)+'" r="3.5" fill="#fff" stroke="'+col.stroke+'" stroke-width="1.5"/>'});
      if(st){var c=scr(st.centroid[0],st.centroid[1]);h+='<text x="'+c[0].toFixed(1)+'" y="'+(c[1]+4).toFixed(1)+'" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">'+label+'</text>'}
    }
    S.areas.forEach(function(p,i){poly(p,{fill:'rgba(255,214,0,.30)',stroke:'#ffd600'},String.fromCharCode(65+i%26))});
    S.obst.forEach(function(p,i){poly(p,{fill:'rgba(255,82,82,.35)',stroke:'#ff5252'},'O'+(i+1))});
    if(draft.length){
      var col=mode==='obst'?'#ff5252':'#ffd600';
      h+='<polyline points="'+ptsAttr(draft)+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-dasharray="6 4"/>';
      draft.forEach(function(q,i){var s=scr(q[0],q[1]);h+='<circle cx="'+s[0].toFixed(1)+'" cy="'+s[1].toFixed(1)+'" r="'+(i===0?6:4)+'" fill="'+(i===0?col:'#fff')+'" stroke="'+col+'" stroke-width="2"/>'});
    }
    if(S.pin){var s=scr(S.pin.lat,S.pin.lon);
      h+='<g transform="translate('+s[0].toFixed(1)+','+s[1].toFixed(1)+')"><path d="M0,0 C-9,-13 -13,-18 -13,-24 A13,13 0 1 1 13,-24 C13,-18 9,-13 0,0Z" fill="#e53935" stroke="#fff" stroke-width="2"/><circle cx="0" cy="-24" r="5" fill="#fff"/></g>'}
    svg.innerHTML=h;
  }
  function paint(){drawTiles();drawOverlay();if(els.zl)els.zl.textContent='z'+S.view.z}
  var raf=0;function schedule(){if(!raf)raf=requestAnimationFrame(function(){raf=0;paint()})}

  function results(){
    var t='',n=netArea();
    if(!S.areas.length&&!S.obst.length){els.res.innerHTML='<small>Tap the map to place the pin. To size the plant area, choose Draw area and tap its corners, then Finish. Use Draw obstacle for water tanks, lift rooms and similar.</small>';return}
    t+='<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr><th align="left">Part</th><th align="right">Area m²</th><th align="right">sq ft</th><th align="right">Perim. m</th><th align="right">Edge°</th></tr></thead><tbody>';
    function row(label,p,neg){var s=polyStats(p);if(!s)return;t+='<tr style="border-top:1px solid var(--line)"><td>'+label+(s.simple?'':' <b style="color:var(--danger,#b3261e)">edges cross</b>')+'</td><td align="right">'+(neg?'−':'')+f(s.area,1)+'</td><td align="right">'+(neg?'−':'')+f(s.area*SQFT,0)+'</td><td align="right">'+f(s.perimeter,1)+'</td><td align="right">'+f(s.bearing,0)+'</td></tr>'}
    S.areas.forEach(function(p,i){row('Area '+String.fromCharCode(65+i%26),p,false)});
    S.obst.forEach(function(p,i){row('Obstacle O'+(i+1),p,true)});
    t+='<tr style="border-top:2px solid var(--line);font-weight:700"><td>Net usable</td><td align="right">'+f(n.net,1)+'</td><td align="right">'+f(n.net*SQFT,0)+'</td><td></td><td></td></tr></tbody></table></div>';
    var w='';
    if(!n.valid)w+='Some edges cross each other, so the area is not filled into Site. Undo and redraw that shape. ';
    if(n.obst>n.gross&&S.areas.length)w+='Obstacles are larger than the areas. ';
    if(!S.areas.length)w+='Draw at least one area to fill the usable roof area. ';
    t+='<small>'+(w?'<b style="color:var(--danger,#b3261e)">'+w+'</b>':'')+'Filled into Site: '+(S.areas.length&&n.valid&&n.net>0?f(n.net*SQFT,0)+' sq ft':'not yet')+'. This is a satellite estimate of the drawn shape, not a survey. Replace it with the surveyed value when you have it. Edge° is the compass bearing of the longest side.</small>';
    els.res.innerHTML=t;
  }
  function modeUI(){
    ['pin','area','obst'].forEach(function(m){var b=els['m_'+m];if(b){b.setAttribute('aria-pressed',mode===m?'true':'false');b.style.background=mode===m?'var(--brand,#0e7c4a)':'';b.style.color=mode===m?'#fff':''}});
    var drawing=mode!=='pin';
    els.fin.disabled=!(drawing&&draft.length>=3);els.und.disabled=!(drawing&&draft.length>0);
    els.hint.textContent=mode==='pin'?'Tap the map to place the site pin.':(mode==='area'?'Tap the corners of the installation area, then Finish.':'Tap the corners of the obstacle, then Finish.')+(draft.length?' ('+draft.length+' points)':'');
  }
  function refresh(){paint();results();modeUI()}

  /* ---------- interaction ---------- */
  function setView(lat,lon,z){S.view.lat=Math.max(-84,Math.min(84,lat));S.view.lon=((lon+540)%360)-180;S.view.z=Math.max(MINZ,Math.min(MAXZ,z))}
  function zoomAt(px,py,dz){
    var z=Math.max(MINZ,Math.min(MAXZ,S.view.z+dz));if(z===S.view.z)return;
    var g=geo(px,py);S.view.z=z;
    var nx=wx(g[1],z)-(px-W/2),ny=wy(g[0],z)-(py-H/2);
    S.view.lon=lonOf(nx,z);S.view.lat=latOf(ny,z);schedule();save();
  }
  function tap(px,py){
    var g=geo(px,py);
    if(mode==='pin'){S.pin={lat:g[0],lon:g[1]};pushSite();save();refresh();say('Pin set: '+g[0].toFixed(6)+', '+g[1].toFixed(6))}
    else{draft.push([g[0],g[1]]);refresh()}
  }
  function bindMap(){
    var ptrs={},start=null,moved=false,pinch=null;
    function rel(e){var r=box.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
    box.addEventListener('pointerdown',function(e){
      if(e.target.closest&&e.target.closest('button'))return;   /* zoom buttons are inside the map box */
      box.setPointerCapture&&box.setPointerCapture(e.pointerId);
      ptrs[e.pointerId]=rel(e);var ids=Object.keys(ptrs);
      if(ids.length===1){start={p:rel(e),v:{lat:S.view.lat,lon:S.view.lon},z:S.view.z};moved=false}
      else if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])};moved=true}
    });
    box.addEventListener('pointermove',function(e){
      if(!ptrs[e.pointerId])return;var p=rel(e);ptrs[e.pointerId]=p;var ids=Object.keys(ptrs);
      if(ids.length>=2&&pinch){
        var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=d/pinch.d;
        if(r>1.6){zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,1);pinch.d=d}else if(r<0.62){zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,-1);pinch.d=d}
        return;
      }
      if(!start)return;
      var dx=p[0]-start.p[0],dy=p[1]-start.p[1];
      if(!moved&&Math.hypot(dx,dy)>6)moved=true;
      if(moved){var z=start.z;S.view.lon=lonOf(wx(start.v.lon,z)-dx,z);S.view.lat=latOf(wy(start.v.lat,z)-dy,z);schedule()}
    });
    function up(e){
      var wasOne=Object.keys(ptrs).length===1;delete ptrs[e.pointerId];
      if(Object.keys(ptrs).length<2)pinch=null;
      if(wasOne&&start&&!moved&&e.type==='pointerup'){tap(start.p[0],start.p[1])}
      else if(moved&&Object.keys(ptrs).length===0)save();
      if(Object.keys(ptrs).length===0)start=null;
    }
    box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
    box.addEventListener('wheel',function(e){e.preventDefault();var p=rel(e);zoomAt(p[0],p[1],e.deltaY<0?1:-1)},{passive:false});
    box.addEventListener('dblclick',function(e){var p=rel(e);zoomAt(p[0],p[1],1)});
  }

  /* ---------- search ---------- */
  function goTo(lat,lon,z,label){
    S.pin={lat:lat,lon:lon};setView(lat,lon,z);pushSite();save();refresh();say((label?label+': ':'')+lat.toFixed(6)+', '+lon.toFixed(6));
  }
  function search(){
    var q=els.q.value.trim();if(!q)return;
    var m=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if(m){var la=parseFloat(m[1]),lo=parseFloat(m[2]);if(Math.abs(la)<=85&&Math.abs(lo)<=180){goTo(la,lo,18,'Coordinates');return}say('Latitude must be within ±85 and longitude within ±180.',true);return}
    say('Searching…');
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(j){if(!j||!j.length){say('No place found. Try a fuller address or type "latitude, longitude".',true);return}
        goTo(parseFloat(j[0].lat),parseFloat(j[0].lon),18,'Found')})
      .catch(function(){say('Search needs internet and was not reachable. Type "latitude, longitude" or tap the map instead.',true)});
  }
  function locate(){
    if(!navigator.geolocation){say('This device cannot share its location here. Search or tap the map instead.',true);return}
    say('Getting your location…');
    navigator.geolocation.getCurrentPosition(function(p){goTo(p.coords.latitude,p.coords.longitude,19,'Your location')},
      function(){say('Location is not available or not allowed. Search or tap the map instead.',true)},{enableHighAccuracy:true,timeout:15000});
  }

  /* ---------- mount ---------- */
  function mount(){
    var host=document.querySelector('#epc_p-site .lede');
    if(!host||$('epc_map'))return false;
    var d=document.createElement('div');d.className='panel';d.id='epc_map';d.style.marginTop='14px';
    d.innerHTML='<h2>Site map and installation area</h2>'+
      '<div style="display:flex;gap:6px;margin-bottom:8px"><input id="epcm_q" type="search" placeholder="Search address, or type latitude, longitude" style="flex:1;min-width:0" aria-label="Search place"><button type="button" class="btn sm" id="epcm_go">Search</button><button type="button" class="btn alt sm" id="epcm_loc" title="Use my location" aria-label="Use my location">◎</button></div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn alt sm" id="epcm_pin" aria-pressed="true">Pin</button><button type="button" class="btn alt sm" id="epcm_area" aria-pressed="false">Draw area</button><button type="button" class="btn alt sm" id="epcm_obst" aria-pressed="false">Draw obstacle</button>'+
      '<span style="flex:1"></span><button type="button" class="btn alt sm" id="epcm_fin">Finish</button><button type="button" class="btn alt sm" id="epcm_und">Undo</button><button type="button" class="btn alt sm" id="epcm_clr">Clear</button></div>'+
      '<div id="epcm_box" style="position:relative;height:320px;overflow:hidden;border-radius:12px;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 32px),#1b2a24;touch-action:none;cursor:crosshair" role="application" aria-label="Satellite map. Tap to place or draw.">'+
      '<div id="epcm_tiles" style="position:absolute;inset:0"></div><svg id="epcm_svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg>'+
      '<div style="position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:4px"><button type="button" class="btn sm" id="epcm_zi" aria-label="Zoom in">+</button><button type="button" class="btn sm" id="epcm_zo" aria-label="Zoom out">−</button></div>'+
      '<div style="position:absolute;left:6px;bottom:4px;font-size:10px;color:#fff;text-shadow:0 0 3px #000">Imagery © Esri, Maxar, Earthstar Geographics · <span id="epcm_z"></span></div></div>'+
      '<div id="epcm_hint" class="meta" style="margin-top:6px"></div><div id="epcm_status" class="meta" role="status" aria-live="polite"></div><div id="epcm_res" style="margin-top:6px"></div>';
    host.parentNode.insertBefore(d,host.nextSibling);
    box=$('epcm_box');svg=$('epcm_svg');tiles=$('epcm_tiles');
    els={q:$('epcm_q'),res:$('epcm_res'),hint:$('epcm_hint'),status:$('epcm_status'),zl:$('epcm_z'),fin:$('epcm_fin'),und:$('epcm_und'),m_pin:$('epcm_pin'),m_area:$('epcm_area'),m_obst:$('epcm_obst')};
    return true;
  }
  function size(){var r=box.getBoundingClientRect();if(r.width>10){W=r.width;H=r.height}}
  function finish(){
    if(draft.length<3)return;
    var st=polyStats(draft);
    if(!st){return}
    if(!st.simple){say('The edges cross each other. Undo and redraw the shape.',true);return}
    if(st.area<0.5){say('That shape is too small to be an area.',true);return}
    (mode==='obst'?S.obst:S.areas).push(draft.slice());
    if(!S.pin&&mode==='area'){S.pin={lat:st.centroid[0],lon:st.centroid[1]}}
    draft=[];pushSite();save();refresh();
  }
  function init(){
    if(!mount())return;
    load();size();
    bindMap();
    $('epcm_go').onclick=search;els.q.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();search()}});
    $('epcm_loc').onclick=locate;
    ['pin','area','obst'].forEach(function(m){els['m_'+m].onclick=function(){if(mode!==m&&draft.length&&!confirmDiscard()){return}mode=m;if(m==='pin')draft=[];refresh()}});
    els.fin.onclick=finish;
    els.und.onclick=function(){draft.pop();refresh()};
    $('epcm_clr').onclick=function(){
      var b=$('epcm_clr');
      if(!clearArm){clearArm=1;b.textContent='Tap again to clear';setTimeout(function(){clearArm=0;b.textContent='Clear'},3000);return}
      clearArm=0;b.textContent='Clear';S.areas=[];S.obst=[];S.pin=null;draft=[];save();refresh();say('Map cleared. Site latitude, longitude and roof area keep their last values.');
    };
    $('epcm_zi').onclick=function(){zoomAt(W/2,H/2,1)};$('epcm_zo').onclick=function(){zoomAt(W/2,H/2,-1)};
    window.addEventListener('resize',function(){size();schedule()});
    /* typing lat/lon or switching project moves the pin */
    function fromSite(){
      if(syncing)return;
      var la=parseFloat(($('engLat')||{}).value),lo=parseFloat(($('engLon')||{}).value);
      if(isFinite(la)&&isFinite(lo)&&Math.abs(la)<=85&&Math.abs(lo)<=180){S.pin={lat:la,lon:lo};if(S.view.z<12)setView(la,lo,16);else setView(la,lo,S.view.z);save();refresh()}
    }
    ['engLat','engLon'].forEach(function(id){var e=$(id);if(e)e.addEventListener('change',fromSite)});
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){load();size();refresh()},80)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){load();size();refresh()},150)})});
    /* when the Site tab becomes visible the box size is known */
    var tabs=$('epc_tabs');if(tabs)tabs.addEventListener('click',function(){setTimeout(function(){size();schedule()},60)});
    var la0=parseFloat(($('engLat')||{}).value),lo0=parseFloat(($('engLon')||{}).value);
    if(!S.pin&&isFinite(la0)&&isFinite(lo0)){S.pin={lat:la0,lon:lo0};setView(la0,lo0,16)}
    refresh();
  }
  function confirmDiscard(){draft=[];return true}
  window.EPCMap={state:function(){return JSON.parse(JSON.stringify({pin:S.pin,areas:S.areas,obstacles:S.obst,net:netArea()}))},resize:function(){size();schedule()}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,80)});else setTimeout(init,80);
})();
