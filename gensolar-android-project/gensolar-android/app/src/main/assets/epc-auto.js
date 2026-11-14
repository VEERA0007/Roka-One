/* EPC Design (guided): the engineer enters the major details; this page fills the rest, labelled "auto", and sizes the members.
   Engine part (EPCAuto) has no DOM access and is unit tested. Everything it fills is an ESTIMATE until the engineer confirms it:
   the wind speed comes from a short city table, the roof outline from OpenStreetMap, the coefficients are defaults to be confirmed. */
(function(){
  'use strict';
  /* ---------- basic wind speed Vb (m/s): IS 875 (Part 3) Appendix A city values as remembered, NOT machine-verified.
     Rule: the highest value among listed cities within 150 km is used (conservative); none near -> 50. Always shown as an estimate. ---------- */
  var CITIES=[['Hyderabad',17.385,78.4867,44],['Warangal',17.9689,79.5941,44],['Karimnagar',18.4386,79.1288,44],['Nizamabad',18.6725,78.0941,44],['Khammam',17.2473,80.1514,44],
   ['Visakhapatnam',17.6868,83.2185,50],['Vijayawada',16.5062,80.648,50],['Guntur',16.3067,80.4365,50],['Nellore',14.4426,79.9865,50],['Tirupati',13.6288,79.4192,50],['Kakinada',16.9891,82.2475,50],
   ['Kurnool',15.8281,78.0373,39],['Anantapur',14.6819,77.6006,33],['Bengaluru',12.9716,77.5946,33],['Mysuru',12.2958,76.6394,33],['Mangaluru',12.9141,74.856,39],['Hubballi',15.3647,75.124,33],
   ['Chennai',13.0827,80.2707,50],['Coimbatore',11.0168,76.9558,39],['Madurai',9.9252,78.1198,39],['Tiruchirappalli',10.7905,78.7047,47],['Kochi',9.9312,76.2673,39],['Thiruvananthapuram',8.5241,76.9366,39],
   ['Mumbai',19.076,72.8777,44],['Pune',18.5204,73.8567,39],['Nagpur',21.1458,79.0882,44],['Nashik',19.9975,73.7898,39],['Aurangabad',19.8762,75.3433,39],
   ['Ahmedabad',23.0225,72.5714,39],['Surat',21.1702,72.8311,44],['Vadodara',22.3072,73.1812,44],['Rajkot',22.3039,70.8022,39],
   ['Delhi',28.6139,77.209,47],['Jaipur',26.9124,75.7873,47],['Lucknow',26.8467,80.9462,47],['Kanpur',26.4499,80.3319,47],['Patna',25.5941,85.1376,47],['Chandigarh',30.7333,76.7794,47],['Amritsar',31.634,74.8723,47],
   ['Kolkata',22.5726,88.3639,50],['Bhubaneswar',20.2961,85.8245,50],['Raipur',21.2514,81.6296,39],['Bhopal',23.2599,77.4126,39],['Indore',22.7196,75.8577,39],['Ranchi',23.3441,85.3096,39]];
  function hav(a,b,c,d){var k=Math.PI/180,x=Math.sin((c-a)*k/2),y=Math.sin((d-b)*k/2),h=x*x+Math.cos(a*k)*Math.cos(c*k)*y*y;return 12742*Math.asin(Math.sqrt(h))}
  function windSpeed(lat,lon){
    var near=CITIES.map(function(c){return {city:c[0],vb:c[3],km:hav(lat,lon,c[1],c[2])}}).filter(function(c){return c.km<=150}).sort(function(a,b){return a.km-b.km});
    if(!near.length)return {vb:50,city:'none within 150 km',km:null,note:'No listed city nearby: 50 m/s used as a conservative value.'};
    var vb=0,hi=null;near.forEach(function(c){if(c.vb>vb){vb=c.vb;hi=c}});
    return {vb:vb,city:near[0].city,km:Math.round(near[0].km),used:hi.city,note:'Highest of '+near.length+' listed cities within 150 km ('+hi.city+', '+hi.vb+' m/s). Confirm against IS 875 (Part 3) Appendix A and the wind map.'};
  }
  /* k2, IS 875-3 Table 2 (heights 10, 20, 30, 50 m; linear in between; below 10 m the 10 m value; above 50 m out of scope) */
  var KH=[10,20,30,50],K2={1:[1.05,1.10,1.13,1.17],2:[1.00,1.05,1.08,1.12],3:[0.91,0.97,1.01,1.06],4:[0.80,0.80,0.97,1.02]};
  function k2(h,cat){var r=K2[cat];if(!r||!(h>0)||h>50)return NaN;if(h<=10)return r[0];for(var i=1;i<4;i++)if(h<=KH[i])return r[i-1]+(r[i]-r[i-1])*(h-KH[i-1])/(KH[i]-KH[i-1]);return NaN}
  /* anchor bolts, IS 800:2007 cl. 10.3: Tnb = 0.9 fub An/gmb, Vnsb = fub An/(sqrt3 gmb) (one shear plane through the threads); gmb = 1.25 */
  var AN={M12:84.3,M16:157,M20:245,M24:353},FUB={'4.6':400,'8.8':800};
  function bolt(d,grade){var an=AN[d],fu=FUB[grade];if(!an||!fu)return null;return {d:d,grade:grade,tcap:0.9*fu*an/1.25/1000,vcap:fu*an/Math.sqrt(3)/1.25/1000}}
  /* section ladder, light to heavy (mm). RHS b x h x t; CHS D x t. Standard IS 4923 / IS 1161 style sizes. */
  var LAD={pur:[[40,60,2],[50,100,2.5],[60,100,3],[80,120,3.2],[100,150,4],[120,180,4.5],[150,200,5]],
           raf:[[50,100,2.5],[60,120,3],[80,120,3.2],[100,150,4],[120,180,4.5],[150,200,5],[150,250,6]],
           col:[[76.1,3.2],[88.9,3.2],[114.3,3.6],[139.7,4],[168.3,4.5],[193.7,5],[219.1,5.9]],
           brc:[[48.3,3.2],[60.3,3.2],[76.1,3.2],[88.9,3.2],[114.3,3.6],[139.7,4],[168.3,4.5]]};
  var BOLTS=[['M16',4],['M20',4],['M20',6],['M24',6]];
  function tiltFor(lat){return Math.max(8,Math.min(22,Math.round(lat*0.75)))}
  /* module count and array blocks: rows up the slope, at most MAXPER modules along a row */
  function blocks(kw,wp,rows,low,maxPer){
    var n=Math.ceil(kw*1000/wp-1e-9);if(!(n>0))return {n:0,list:[]};
    rows=rows||2;maxPer=maxPer||14;var per=Math.ceil(n/rows),list=[],left=n,i=0;
    if(per<=maxPer)return {n:n,list:[{name:'Block 1',rows:rows,perRow:per,low:low}],modules:rows*per};
    while(left>0){i++;var m=Math.min(left,rows*maxPer),p=Math.ceil(m/rows);list.push({name:'Block '+i,rows:rows,perRow:p,low:low});left-=rows*p}
    return {n:n,list:list,modules:list.reduce(function(s,b){return s+b.rows*b.perRow},0)};
  }
  /* OpenStreetMap building footprint (Overpass JSON with geometry) nearest the pin -> polygon area, height. */
  function footprint(json,lat,lon){
    var best=null,els=(json&&json.elements)||[];
    els.forEach(function(w){
      if(w.type!=='way'||!w.geometry||w.geometry.length<4)return;
      var pts=w.geometry.map(function(g){return [g.lat,g.lon]}),k=Math.PI/180,f=lat*k,mLat=111132.92-559.82*Math.cos(2*f)+1.175*Math.cos(4*f),mLon=111412.84*Math.cos(f)-93.5*Math.cos(3*f),X=pts.map(function(p){return [(p[1]-lon)*mLon,(p[0]-lat)*mLat]}),a=0,per=0,n=X.length;
      for(var i=0;i<n-1;i++){a+=X[i][0]*X[i+1][1]-X[i+1][0]*X[i][1];per+=Math.hypot(X[i+1][0]-X[i][0],X[i+1][1]-X[i][1])}
      a=Math.abs(a)/2;
      var inside=false;for(var i=0,j=n-2;i<n-1;j=i++){if((X[i][1]>0)!==(X[j][1]>0)&&0<(X[j][0]-X[i][0])*(0-X[i][1])/(X[j][1]-X[i][1])+X[i][0])inside=!inside}
      var d=0;if(!inside){d=1e9;for(var i=0;i<n-1;i++){var p=X[i],q=X[i+1],dx=q[0]-p[0],dy=q[1]-p[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,-(p[0]*dx+p[1]*dy)/L)):0;d=Math.min(d,Math.hypot(p[0]+t*dx,p[1]+t*dy))}}
      var tg=w.tags||{},h=parseFloat(tg.height),lv=parseFloat(tg['building:levels']);
      var ht=isFinite(h)?h:(isFinite(lv)?lv*3.2:NaN);
      if(!best||d<best.dist||(d===best.dist&&a>best.area))best={area:a,perimeter:per,dist:d,inside:inside,height:ht,id:w.id,tags:tg,poly:pts.slice(0,-1)};
    });
    return best;
  }
  /* inward offset of a simple polygon (points [lat,lon], not closed) by d metres, mitred corners. Returns {poly,area (m2)} or null when the
     shape collapses, crosses itself, or the area does not shrink the way an inward offset must. */
  function inset(poly,d){
    var n=poly.length;if(n<3||!(d>0))return null;
    var lat0=poly[0][0],lon0=poly[0][1],k=Math.PI/180,f=lat0*k,mLat=111132.92-559.82*Math.cos(2*f)+1.175*Math.cos(4*f),mLon=111412.84*Math.cos(f)-93.5*Math.cos(3*f);
    var X=poly.map(function(p){return [(p[1]-lon0)*mLon,(p[0]-lat0)*mLat]});
    function area(P){var a=0;for(var i=0;i<P.length;i++){var j=(i+1)%P.length;a+=P[i][0]*P[j][1]-P[j][0]*P[i][1]}return a/2}
    var A0=area(X),sg=A0>0?1:-1;if(Math.abs(A0)<1)return null;
    var L=[];                                                            /* offset lines: point + direction, shifted to the inside */
    for(var i=0;i<n;i++){var p=X[i],q=X[(i+1)%n],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy);if(l<1e-9)return null;dx/=l;dy/=l;
      var nx=-dy*sg,ny=dx*sg;L.push([p[0]+nx*d,p[1]+ny*d,dx,dy])}
    var Y=[];
    for(var i=0;i<n;i++){var a=L[(i+n-1)%n],b=L[i],den=a[2]*b[3]-a[3]*b[2];if(Math.abs(den)<1e-9)return null;
      var t=((b[0]-a[0])*b[3]-(b[1]-a[1])*b[2])/den;Y.push([a[0]+a[2]*t,a[1]+a[3]*t])}
    for(var i=0;i<n;i++){var e0=[X[(i+1)%n][0]-X[i][0],X[(i+1)%n][1]-X[i][1]],e1=[Y[(i+1)%n][0]-Y[i][0],Y[(i+1)%n][1]-Y[i][1]];if(e0[0]*e1[0]+e0[1]*e1[1]<=0)return null}   /* an edge flipped: collapsed */
    function cross(a,b,c,e){function o(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])}return o(a,b,c)*o(a,b,e)<0&&o(c,e,a)*o(c,e,b)<0}
    for(var i=0;i<n;i++)for(var j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(cross(Y[i],Y[(i+1)%n],Y[j],Y[(j+1)%n]))return null}
    var A1=Math.abs(area(Y));if(!(A1>0&&A1<Math.abs(A0)))return null;
    return {poly:Y.map(function(p){return [lat0+p[1]/mLat,lon0+p[0]/mLon]}),area:A1};
  }
  /* usable roof: footprint less a setback strip along the perimeter (A - P d), floored at 0. Returns sq ft. */
  function usableSqft(area,per,setback){var u=Math.max(0,area-per*setback);return u*10.7639104167}
  window.EPCAuto={CITIES:CITIES,windSpeed:windSpeed,k2:k2,bolt:bolt,LAD:LAD,BOLTS:BOLTS,tiltFor:tiltFor,blocks:blocks,footprint:footprint,inset:inset,usableSqft:usableSqft};
  if(typeof module!=='undefined')module.exports=window.EPCAuto;
})();

/* ================= UI: Design tab ================= */
(function(){
  'use strict';
  if(typeof document==='undefined')return;
  var A=window.EPCAuto,KEY='gs_epc_design_v1',ADV='gs_epc_adv_v1';
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function fire(e){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
  function setv(sel,val){
    var e=typeof sel==='string'?document.querySelector(sel):sel;if(!e)return false;
    if(e.type==='checkbox')e.checked=!!val;
    else{if(e.tagName==='SELECT'){var ok=false;for(var i=0;i<e.options.length;i++)if(e.options[i].value===String(val)||e.options[i].text===String(val))ok=true;if(!ok){var o=document.createElement('option');o.textContent=String(val);o.value=String(val);e.appendChild(o)}}e.value=String(val)}
    fire(e);return true;
  }
  function num(id){var e=$(id),x=e?parseFloat(e.value):NaN;return isFinite(x)?x:NaN}
  function kgm(sec){return sec.A*7850}                                         /* steel 7850 kg/m3, A in m2 */
  function secLabel(t,a){return t==='RHS'?'RHS '+a[0]+' x '+a[1]+' x '+a[2]:'CHS '+a[0]+' x '+a[1]}

  /* ---------- fields ---------- */
  var IN=[
   ['name','Project / customer','text','',''],['place','Place or address (to find the pin)','text','',''],
   ['lat','Latitude','number','','17.385'],['lon','Longitude','number','','78.4867'],
   ['kw','Target capacity (kWp)','number','','21.26'],['wp','Module rating (Wp)','number','','550'],
   ['ml','Module length (mm)','number','','2278'],['mw','Module width (mm)','number','','1134'],['mkg','Module weight (kg)','number','','27.5'],
   ['roofType','Roof type','sel',['RCC roof','Metal shed roof'],''],['h','Building height to roof (m)','number','','12'],
   ['roofSqft','Usable roof area (sq ft)','number','','']
  ];
  var st={vals:{},res:null,busy:false};
  function load(){try{st.vals=JSON.parse(lsGet(KEY))||{}}catch(e){st.vals={}}}
  function save(){IN.forEach(function(f){var e=$('epcd_'+f[0]);if(e)st.vals[f[0]]=e.value});lsSet(KEY,JSON.stringify(st.vals))}
  function say(m,bad){var e=$('epcd_msg');if(e){e.textContent=m;e.style.color=bad?'var(--danger,#b3261e)':''}}

  /* ---------- places and roof outline (network, optional) ---------- */
  function findPlace(){
    var q=($('epcd_place').value||'').trim();if(!q)return;say('Searching…');
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}})
     .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
     .then(function(j){if(!j||!j.length){say('No place found. Type the latitude and longitude instead.',true);return}
       $('epcd_lat').value=(+j[0].lat).toFixed(6);$('epcd_lon').value=(+j[0].lon).toFixed(6);save();say('Found. Check the pin, then get the roof outline.')})
     .catch(function(){say('Could not search (offline?). Type the latitude and longitude.',true)});
  }
  function getRoof(){
    var lat=num('epcd_lat'),lon=num('epcd_lon');if(!isFinite(lat)||!isFinite(lon)){say('Enter the latitude and longitude first.',true);return}
    say('Reading the building outline from OpenStreetMap…');
    var q='[out:json][timeout:20];way(around:40,'+lat+','+lon+')["building"];out geom tags;';
    fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}})
     .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
     .then(function(j){var b=A.footprint(j,lat,lon);
       if(!b){say('No building outline found at this pin. Type the usable roof area from your survey.',true);return}
       var u=A.usableSqft(b.area,b.perimeter,1),ins=A.inset(b.poly,1),drawn=false;
       if(ins){u=ins.area*10.7639104167;if(window.EPCMap&&window.EPCMap.setAreas){var nm=$('epcd_name').value.trim();if(nm)setv('#engSite',nm);window.EPCMap.setAreas([ins.poly],{lat:lat,lon:lon});drawn=true}}
       $('epcd_roofSqft').value=Math.round(u);if(isFinite(b.height)&&!$('epcd_h').value)$('epcd_h').value=b.height.toFixed(1);save();
       say('Building outline found ('+Math.round(b.area)+' m² footprint'+(b.inside?'':', '+Math.round(b.dist)+' m from the pin')+'; usable area = footprint less a 1 m edge strip'+(drawn?'; the outline is drawn on the Site map as the plant area':'')+(isFinite(b.height)?'; height '+b.height.toFixed(1)+' m from map tags':'')+'). ESTIMATE: confirm on site.')})
     .catch(function(){say('Could not read the map (offline?). Type the usable roof area from your survey.',true)});
  }

  /* ---------- fill and size ---------- */
  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function collect(){
    var v={};IN.forEach(function(f){var e=$('epcd_'+f[0]);v[f[0]]=f[2]==='number'?parseFloat(e.value):e.value});
    var miss=[];
    if(!v.name||!v.name.trim())miss.push('project name');
    if(!(v.lat>=6&&v.lat<=37.5))miss.push('latitude (inside India)');
    if(!(v.lon>=68&&v.lon<=98))miss.push('longitude (inside India)');
    if(!(v.kw>0))miss.push('target capacity');if(!(v.wp>=100))miss.push('module rating');
    if(!(v.ml>=500&&v.mw>=500))miss.push('module length and width');if(!(v.mkg>0))miss.push('module weight');
    if(!(v.h>0))miss.push('building height');if(!(v.roofSqft>0))miss.push('usable roof area (type it or use the map button)');
    return {v:v,miss:miss};
  }
  function fillPlan(v){
    var rc=v.roofType==='RCC roof',W=A.windSpeed(v.lat,v.lon),tilt=A.tiltFor(v.lat),terrain='2',k=A.k2(v.h+1,+terrain),warn=[];
    if(!isFinite(k))warn.push('Building height is above 50 m: k2 is outside the table. Not filled.');
    var low=rc?600:500,bl=A.blocks(v.kw,v.wp,2,low,14),gap=20,fsp=Math.round(2*(v.mw+gap)/10)*10,
        rp=2*(v.ml+gap)*Math.cos(tilt*Math.PI/180),csp=Math.max(1500,Math.min(3000,Math.round(rp/2/10)*10));
    var need=v.kw*80;if(v.roofSqft<need)warn.push('Usable roof area ('+Math.round(v.roofSqft)+' sq ft) is below the planning need of about '+Math.round(need)+' sq ft for '+v.kw+' kWp. Reduce the capacity or confirm the area.');
    return {W:W,tilt:tilt,terrain:terrain,k2:k,blocks:bl,gap:gap,fsp:fsp,csp:csp,low:low,warn:warn,rc:rc};
  }
  function applyCommon(v,p){
    /* Site */
    setv('#engSite',v.name);setv('#engLat',v.lat);setv('#engLon',v.lon);setv('#engCapacity',v.kw);setv('#engPanelW',v.wp);
    setv('#engRoof',Math.round(v.roofSqft));setv('#engTilt',p.tilt);setv('#engAzimuth',180);setv('#engMount',p.rc?'RCC rooftop':'Metal sheet rooftop');
    /* Auto Design module (metres) */
    setv('#epca_wp',v.wp);setv('#epca_module_l',(v.ml/1000).toFixed(3));setv('#epca_module_w',(v.mw/1000).toFixed(3));setv('#epca_orientation','portrait');
    /* Layout */
    var sv=function(k,x){setv('[data-k="'+k+'"]',x)};
    sv('module.wp',v.wp);sv('module.len',v.ml);sv('module.wid',v.mw);sv('module.orient','portrait');sv('gap',p.gap);sv('tilt',p.tilt);
    sv('frameSpacing',p.fsp);sv('colSpacingH',p.csp);sv('colInset',300);sv('rafterOvh',100);sv('purlinOvh',100);
    if(window.EPCLayout){var er=window.EPCLayout.setBlocks(p.blocks.list);if(er)throw new Error(er)}
    /* Wind */
    var w=function(k,x){setv('#epcw_'+k,x)};
    w('h',v.h);w('parapet',1);w('terrain',p.terrain);w('roofType',p.rc?'RCC roof':'Metal shed roof');
    w('Vb',p.W.vb);w('k1',1);w('k2',isFinite(p.k2)?p.k2:'');w('k3',1);w('k4',1);w('Kd',0.9);w('Ka',1);w('Kc',1);
    w('cUpF',1);w('cUpE',1.5);w('cDn',0.8);w('cLong',0.3);
    w('modKg',v.mkg);w('strKn',0.1);w('llKn',0.5);w('nPur',2);w('fy',250);w('lim',180);
    /* Analysis */
    var a=function(k,x){setv('#epca2_'+k,x)};
    a('base','Pinned');a('K',1);a('bclass','b');a('brcFrac',0.75);a('tieFrac',0.6);a('swayLim',150);
  }
  function applyLevel(L,bo){
    var P=A.LAD,pu=P.pur[L],ra=P.raf[L],co=P.col[L],br=P.brc[L],bt=A.bolt(bo[0],'4.6');
    var w=function(k,x){setv('#epcw_'+k,x)},a=function(k,x){setv('#epca2_'+k,x)};
    w('pType','RHS');w('pb',pu[0]);w('ph',pu[1]);w('pt',pu[2]);w('rType','RHS');w('rb',ra[0]);w('rh',ra[1]);w('rt',ra[2]);
    w('nb',bo[1]);w('tcap',bt.tcap.toFixed(1));w('vcap',bt.vcap.toFixed(1));
    a('colType','CHS');a('colB',co[0]);a('colT',co[1]);a('colH','');a('brcType','CHS');a('brcB',br[0]);a('brcT',br[1]);a('brcH','');
    return {pur:pu,raf:ra,col:co,brc:br,bolt:bo};
  }
  function setLayoutPipes(sel){
    var F=window.EPCFem,mk=function(k,type,a){var s=type==='RHS'?F.rhs(a[0]/1000,a[1]/1000,a[2]/1000):F.chs(a[0]/1000,a[1]/1000);
      setv('[data-k="pipes.'+k+'.label"]',secLabel(type,a));setv('[data-k="pipes.'+k+'.kg"]',kgm(s).toFixed(2))};
    mk('pur','RHS',sel.pur);mk('raf','RHS',sel.raf);mk('col','CHS',sel.col);mk('brc','CHS',sel.brc);
  }
  function runChecks(){
    var W=window.EPCWind.recalc();
    if(!W||W.state==='missing')return {state:'missing',missing:(W&&W.missing)||['Wind inputs']};
    var A2=window.EPCAnalysis.recalc();return A2;
  }
  function solve(){
    if(st.busy)return;var c=collect();save();
    if(c.miss.length){say('Still needed: '+c.miss.join(', ')+'.',true);return}
    st.busy=true;var v=c.v,p=fillPlan(v),prevSurvey=$('epcw_survey')?$('epcw_survey').checked:false;
    var btn=$('epcd_go');btn.disabled=true;say('Filling the details…');
    var trial=[];
    Promise.resolve().then(function(){applyCommon(v,p);setv('#epcw_survey',true);return wait(300)}).then(function(){
      var nL=A.LAD.pur.length,big=A.BOLTS[A.BOLTS.length-1],n=0,total=nL+A.BOLTS.length;
      function tryOne(L,bo){
        n++;var sel=applyLevel(L,bo);say('Sizing members: trial '+n+' (section level '+(L+1)+' of '+nL+', '+bo[1]+' x '+bo[0]+' bolts)…');
        return wait(30).then(function(){
          var r;try{r=runChecks()}catch(e){r={state:'error',text:e.message}}
          if(r.state==='missing')throw new Error('Inputs missing: '+(r.missing||[]).slice(0,3).join('; '));
          return {sel:sel,r:r,L:L,ok:r.state==='pass'};
        });
      }
      /* phase 1: lightest section level that passes with the strongest bolts; phase 2: lightest bolts that still pass at that level */
      function phase1(L){if(L>=nL)return Promise.resolve(null);return tryOne(L,big).then(function(x){return x.ok?x:phase1(L+1)})}
      function phase2(L,k){if(k>=A.BOLTS.length-1)return tryOne(L,big);return tryOne(L,A.BOLTS[k]).then(function(x){return x.ok?x:phase2(L,k+1)})}
      return phase1(0).then(function(x){if(!x)return {fail:true};return phase2(x.L,0)}).then(function(x){trial.length=n;return x});
    }).then(function(x){
      var fin=x;
      if(x.fail){var L=A.LAD.pur.length-1;fin={sel:applyLevel(L,A.BOLTS[A.BOLTS.length-1]),r:runChecks(),L:L,failed:true}}
      setLayoutPipes(fin.sel);
      setv('#epcw_survey',prevSurvey);
      st.res={p:p,v:v,fin:fin,trials:trial.length};
      st.busy=false;btn.disabled=false;say('');renderResult();
      try{if(window.EPCWind&&window.EPCWind.refreshLocks)window.EPCWind.refreshLocks();if(window.EPCSync&&window.EPCSync.refresh)window.EPCSync.refresh()}catch(e){}
    }).catch(function(e){st.busy=false;btn.disabled=false;setv('#epcw_survey',prevSurvey);say('Could not finish: '+e.message,true)});
  }
  function tag(s){return '<span class="meta" style="border:1px solid var(--line,#8884);border-radius:8px;padding:0 6px;margin-left:6px;font-size:11px">'+s+'</span>'}
  function renderResult(){
    var o=$('epcd_out');if(!o||!st.res)return;var r=st.res,p=r.p,f=r.fin,pass=!f.failed&&f.r.state==='pass',s=f.sel;
    var rows=[['Array tilt / azimuth',p.tilt+'° / 180° (south)','auto'],
      ['Modules / blocks',p.blocks.modules+' modules ('+p.blocks.list.map(function(b){return b.rows+'×'+b.perRow}).join(', ')+') = '+(p.blocks.modules*r.v.wp/1000).toFixed(2)+' kWp','auto'],
      ['Basic wind speed Vb',p.W.vb+' m/s. '+p.W.note,'estimate: confirm'],
      ['Terrain / k2 / other factors','Category '+p.terrain+', k2 '+(isFinite(p.k2)?p.k2.toFixed(2):'–')+', k1 1, k3 1, k4 1, Kd 0.9, Ka 1, Kc 1','estimate: confirm'],
      ['Pressure coefficients','uplift 1.0 field / 1.5 edge, down 0.8, along the rows 0.3 (default values, not from a code table)','estimate: confirm'],
      ['Purlin / rafter',secLabel('RHS',s.pur)+' / '+secLabel('RHS',s.raf),'auto-sized'],
      ['Column / brace and tie',secLabel('CHS',s.col)+' / '+secLabel('CHS',s.brc)+'; pinned bases','auto-sized'],
      ['Anchor bolts',s.bolt[1]+' × '+s.bolt[0]+' grade 4.6 per column (tension '+A.bolt(s.bolt[0],'4.6').tcap.toFixed(1)+' kN, shear '+A.bolt(s.bolt[0],'4.6').vcap.toFixed(1)+' kN design)','auto-sized']];
    var h='<div class="epca-warnings" style="margin-top:10px;border-color:'+(pass?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'"><b>'+(pass?'ESTIMATED DESIGN PASSES the preliminary checks':'NO STANDARD SECTION PASSES')+'</b> — '+(pass?'the lightest set on the section ladder that passes all IS 800 combinations ('+r.trials+' trial'+(r.trials>1?'s':'')+'). Not approved.':'the heaviest ladder set is filled in. Reduce the capacity, lower the tilt, or take it to a structural engineer.')+'</div>';
    h+='<table style="width:100%;font-size:13px;margin-top:8px"><tbody>'+rows.map(function(x){return '<tr><td style="padding:3px 6px 3px 0;vertical-align:top"><b>'+esc(x[0])+'</b></td><td style="padding:3px 0">'+esc(x[1])+tag(x[2])+'</td></tr>'}).join('')+'</tbody></table>';
    if(p.warn.length)h+='<div class="epca-warnings" style="margin-top:8px"><b>Check:</b> '+p.warn.map(esc).join(' ')+'</div>';
    var conf=lsGet('gs_epc_design_conf_'+(r.v.name||''))==='1';
    h+='<label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input type="checkbox" id="epcd_conf"'+(conf?' checked':'')+'><span>I confirm the roof measurements, wind speed, terrain and coefficients above for this site (this unlocks Analysis, Drawings, BOM and Documents). A structural engineer must still verify and sign off.</span></label>';
    h+='<div class="meta">Everything above is already filled in the detail tabs (use Review details to change any value). Changing a detail there overrides the auto value.</div>';
    o.innerHTML=h;
    $('epcd_conf').onchange=function(){lsSet('gs_epc_design_conf_'+(r.v.name||''),this.checked?'1':'0');setv('#epcw_survey',this.checked)};
    if(conf)setv('#epcw_survey',true);
  }

  /* ---------- mount ---------- */
  function mount(){
    var tabs=$('epc_tabs'),host=$('epc_p-site');if(!tabs||!host||$('epc_p-design'))return false;
    var adv=lsGet(ADV)==='1';
    var sec=document.createElement('section');sec.id='epc_p-design';sec.setAttribute('aria-label','EPC guided design');
    var h='<div class="panel"><h2>Design from the major details</h2><p class="lede">Enter the details below. Everything else (wind data, loads, member sizes, bolts, layout) is filled in and labelled, then checked. Estimates stay preliminary until you confirm them.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">';
    IN.forEach(function(f){
      if(f[2]==='sel')h+='<div class="field"><label for="epcd_'+f[0]+'">'+f[1]+'</label><select id="epcd_'+f[0]+'">'+f[3].map(function(o){return '<option>'+o+'</option>'}).join('')+'</select></div>';
      else h+='<div class="field"><label for="epcd_'+f[0]+'">'+f[1]+'</label><input id="epcd_'+f[0]+'" type="'+f[2]+'"'+(f[2]==='number'?' step="any" min="0"':'')+(f[4]?' placeholder="e.g. '+f[4]+'"':'')+'></div>'});
    h+='</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" type="button" id="epcd_find">Find place</button><button class="btn" type="button" id="epcd_roof">Get roof outline from map</button><button class="btn" type="button" id="epcd_drw">Upload / trace the roof drawing</button><button class="btn primary" type="button" id="epcd_go">Auto-design</button></div><div class="meta" id="epcd_msg" aria-live="polite" style="margin-top:8px"></div><div id="epcd_out" aria-live="polite"></div></div>';
    sec.innerHTML=h;host.parentNode.insertBefore(sec,host);
    var b=document.createElement('button');b.className='tab';b.setAttribute('role','tab');b.setAttribute('data-t','design');b.textContent='Design';tabs.insertBefore(b,tabs.firstChild);
    var DETAIL=['site','survey','autodesign','layout','wind','analysis','elec'];
    DETAIL.forEach(function(k){var t=tabs.querySelector('[data-t="'+k+'"]');if(t)t.classList.add('adv')});
    var tg=document.createElement('button');tg.className='tab';tg.type='button';tg.id='epcd_adv';tg.setAttribute('aria-pressed','false');tabs.appendChild(tg);
    var sty=document.createElement('style');sty.textContent='#epc_tabs.guided .tab.adv{display:none}#epc_tabs #epcd_adv{margin-left:auto;font-size:12px}';document.head.appendChild(sty);
    function mode(on){tabs.classList.toggle('guided',!on);tg.textContent=on?'Back to guided':'Review details ▾';lsSet(ADV,on?'1':'0')}
    tg.addEventListener('click',function(e){e.stopPropagation();var on=lsGet(ADV)!=='1';mode(on);if(!on){var cur=tabs.querySelector('.tab[aria-selected="true"]');if(cur&&cur.classList.contains('adv'))b.click()}});
    mode(adv);
    /* show the Design page: the layout code only knows its own pages, so hide/show ours around its handler */
    function showDesign(on){sec.hidden=!on}
    tabs.addEventListener('click',function(e){var t=e.target.getAttribute&&e.target.getAttribute('data-t');if(t===null||t===undefined||t==='')return;showDesign(t==='design');if(t==='design'){tabs.querySelectorAll('.tab').forEach(function(x){x.setAttribute('aria-selected',x===b?'true':'false')});['site','survey','layout','wind','analysis','draw','elec','bom','docs','autodesign'].forEach(function(k){var s=$('epc_p-'+k);if(s)s.hidden=true})}});
    if(!adv){b.click()}else{sec.hidden=true}
    load();IN.forEach(function(f){var e=$('epcd_'+f[0]);if(e&&st.vals[f[0]]!==undefined)e.value=st.vals[f[0]]});
    sec.addEventListener('input',save);
    $('epcd_find').onclick=findPlace;$('epcd_roof').onclick=getRoof;$('epcd_go').onclick=solve;
    $('epcd_drw').onclick=function(){mode(true);var s=tabs.querySelector('[data-t="survey"]');if(s)s.click()};
    return true;
  }
  function init(){if(!mount()){setTimeout(init,300);return}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,400)});else setTimeout(init,400);
  window.EPCDesign={solve:solve,state:function(){return st},setv:setv};
})();
