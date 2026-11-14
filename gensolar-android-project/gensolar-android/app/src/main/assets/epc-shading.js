/* EPC Survey: hourly near-shading analysis by ray casting.
   For every module, a grid of points is traced toward the sun and tested against the obstacle prisms and against every other module (tilted planes), so
   obstacle shadows and row-to-row / table-to-table / level-to-level shading are all included. The shaded fraction of a module is the share of its points in shadow.
   Beam weighting uses a simple clear-sky model, not site weather data. Engine has no DOM access. */
(function(){
  'use strict';
  var RAD=Math.PI/180,DEG=180/Math.PI,EPS=1e-6;
  /* Klein's average day of each month, and days per month */
  var KLEIN=[[1,17],[2,16],[3,16],[4,15],[5,15],[6,11],[7,17],[8,16],[9,15],[10,15],[11,14],[12,10]],MDAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
  function sunVec(alt,az){var ca=Math.cos(alt*RAD);return [Math.sin(az*RAD)*ca,Math.cos(az*RAD)*ca,Math.sin(alt*RAD)]}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
  function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
  /* clear-sky direct normal irradiance (W/m2), Meinel form with Kasten-Young air mass */
  function dni(alt){if(alt<=0)return 0;var am=1/(Math.sin(alt*RAD)+0.50572*Math.pow(alt+6.07995,-1.6364));return 1353*Math.pow(0.7,Math.pow(am,0.678))}

  /* module from its four corners [back-left, back-right, front-right, front-left] (EN, height): normal pointing up, centre, nu x nv sample points */
  function makeModule(P,tab,nu,nv){
    var nm=cross(sub(P[1],P[0]),sub(P[3],P[0])),l=Math.hypot(nm[0],nm[1],nm[2]);nm=[nm[0]/l,nm[1]/l,nm[2]/l];if(nm[2]<0)nm=[-nm[0],-nm[1],-nm[2]];
    var c=[0,1,2].map(function(a){return (P[0][a]+P[1][a]+P[2][a]+P[3][a])/4}),pts=[];
    for(var i=0;i<nu;i++)for(var j=0;j<nv;j++){var u=(i+.5)/nu,v=(j+.5)/nv;pts.push([0,1,2].map(function(a){return P[0][a]+u*(P[1][a]-P[0][a])+v*(P[3][a]-P[0][a])}))}
    return {P:P,n:nm,c:c,pts:pts,tab:tab,zTop:Math.max(P[0][2],P[1][2],P[2][2],P[3][2]),zBot:Math.min(P[0][2],P[1][2],P[2][2],P[3][2])};
  }
  /* ---- scene from a Survey calc() result ---- */
  function scene(res,SV,opts){
    opts=opts||{};var n=opts.n||4,mods=[],tabs=[],obs=[];
    res.tables.forEach(function(tb,ti){
      var tinfo={name:tb.name,part:tb.part,level:tb.level||0,first:mods.length,modules:tb.cells.length};
      var fz=res.az;                                                   /* facing bearing of the modules */
      tb.cells.forEach(function(cl,ci){
        var zz=tb.cellZ[ci],P=cl.map(function(q,k){var en=SV.sheetToEN(q,res.top);return [en[0],en[1],k<2?zz[0]:zz[1]]});
        mods.push(makeModule(P,ti,n,n));
      });
      tabs.push(tinfo);
    });
    res.obstacles.forEach(function(o){if(!(o.h>0))return;obs.push({poly:o.poly.map(function(q){return SV.sheetToEN(q,res.top)}),base:o.base>0?o.base:0,top:o.h,name:o.name})});
    var zmax=-1e9,zmin=1e9;mods.forEach(function(m){zmax=Math.max(zmax,m.zTop);zmin=Math.min(zmin,m.zBot)});obs.forEach(function(o){zmax=Math.max(zmax,o.top)});
    return {mods:mods,tabs:tabs,obs:obs,zmax:zmax,zmin:zmin,az:res.az,tilt:res.tilt};
  }

  /* ---- ray tests ---- */
  /* ray P + t S (t > 0) through the vertical prism poly x [base, top]; poly is convex */
  function hitsPrism(P,S,o){
    var t0=EPS,t1=1e9;
    if(Math.abs(S[2])<1e-12)return false;
    var a=(o.base-P[2])/S[2],b=(o.top-P[2])/S[2];if(a>b){var q=a;a=b;b=q}
    t0=Math.max(t0,a);t1=Math.min(t1,b);if(t1<t0)return false;
    var poly=o.poly,m=poly.length,sg=0;
    for(var i=0;i<m;i++){var A=poly[i],B=poly[(i+1)%m];sg+=(B[0]-A[0])*(B[1]+A[1])}                      /* sg>0 = clockwise (y up) */
    var sgn=sg>0?-1:1;                                                                                  /* normal (ey,-ex) is outward for counter-clockwise */
    for(i=0;i<m;i++){
      A=poly[i];B=poly[(i+1)%m];
      var ex=B[0]-A[0],ey=B[1]-A[1],nx=ey*sgn,ny=-ex*sgn;                                                  /* outward normal */
      var d0=nx*(P[0]-A[0])+ny*(P[1]-A[1]),dd=nx*S[0]+ny*S[1];                                             /* inside when d0 + t dd <= 0 */
      if(Math.abs(dd)<1e-12){if(d0>0)return false;continue}
      var t=-d0/dd;if(dd>0){if(t<t1)t1=t}else{if(t>t0)t0=t}
      if(t1<t0)return false;
    }
    return t1>=t0;
  }
  function insideQuad(x,y,P){
    var s=0;for(var i=0;i<4;i++){var A=P[i],B=P[(i+1)%4],c=(B[0]-A[0])*(y-A[1])-(B[1]-A[1])*(x-A[0]);if(Math.abs(c)<1e-12)continue;var g=c>0?1:-1;if(s&&g!==s)return false;s=g}return true
  }
  function hitsModule(P,S,m){
    var den=dot(m.n,S);if(Math.abs(den)<1e-9)return false;
    var t=dot(sub(m.P[0],P),m.n)/den;if(t<=EPS)return false;
    return insideQuad(P[0]+t*S[0],P[1]+t*S[1],m.P);
  }
  /* shaded fraction of module mi for a sun, given blockers: obstacle list and neighbour module indices */
  function shadedFraction(sc,mi,S,obsList,nbr){
    var m=sc.mods[mi],hit=0,N=m.pts.length;
    for(var k=0;k<N;k++){
      var P=m.pts[k],b=false;
      for(var i=0;i<obsList.length&&!b;i++)if(hitsPrism(P,S,obsList[i]))b=true;
      for(i=0;i<nbr.length&&!b;i++)if(hitsModule(P,S,sc.mods[nbr[i]]))b=true;
      if(b)hit++;
    }
    return hit/N;
  }
  /* whole scene for one sun: fraction per module and incidence factor */
  function sunStep(sc,alt,az){
    var S=sunVec(alt,az),out=new Float64Array(sc.mods.length),R=(sc.zmax-sc.zmin)/Math.tan(Math.max(alt,1)*RAD),R2=R*R;
    var obsNear=sc.obs;                                              /* few; tested in full */
    sc.mods.forEach(function(m,mi){
      var nbr=[];
      for(var j=0;j<sc.mods.length;j++){if(j===mi)continue;var o=sc.mods[j];var dx=o.c[0]-m.c[0],dy=o.c[1]-m.c[1];if(dx*dx+dy*dy>R2)continue;
        if(dx*S[0]+dy*S[1]<0)continue;                                /* blocker must lie toward the sun */
        nbr.push(j)}
      out[mi]=shadedFraction(sc,mi,S,obsNear,nbr);
    });
    return out;
  }
  function incidence(sc,mi,alt,az){var S=sunVec(alt,az);return Math.max(0,dot(sc.mods[mi].n,S))}

  /* ---- hourly analysis over the Klein days ---- */
  function monthStep(sc,SE,lat,mIdx,hours){
    var day=KLEIN[mIdx][1],nd=SE.dayOfYear(mIdx,day),rows=[];
    hours.forEach(function(h){
      var sun=SE.sunPos(lat,nd,h);if(sun.alt<3)return;                                    /* below 3 degrees: no beam counted */
      var fr=sunStep(sc,sun.alt,sun.az),I=dni(sun.alt),perTab=sc.tabs.map(function(){return {wsum:0,lsum:0,mods:0,fr:0}});
      sc.mods.forEach(function(m,mi){var inc=incidence(sc,mi,sun.alt,sun.az),w=I*inc,t=perTab[m.tab];t.wsum+=w;t.lsum+=w*fr[mi];t.mods++;t.fr+=fr[mi]});
      rows.push({h:h,alt:sun.alt,az:sun.az,dni:I,perTab:perTab});
    });
    return {m:mIdx+1,day:day,rows:rows};
  }
  function summarise(sc,months){
    var tabs=sc.tabs.map(function(t){return {name:t.name,part:t.part,level:t.level,modules:t.modules,w:0,l:0,mon:months.map(function(){return {w:0,l:0}}),hourFrac:0,worst:null}});
    months.forEach(function(mo,mi){var dm=MDAYS[mo.m-1];
      mo.rows.forEach(function(r){r.perTab.forEach(function(p,ti){var t=tabs[ti];t.w+=p.wsum*dm;t.l+=p.lsum*dm;t.mon[mi].w+=p.wsum*dm;t.mon[mi].l+=p.lsum*dm;
        var f=p.mods?p.fr/p.mods:0;if(!t.worst||f>t.worst.frac)t.worst={frac:f,month:mo.m,h:r.h}})})});
    var tw=0,tl=0,lev={};
    tabs.forEach(function(t){t.lossPct=t.w>0?100*t.l/t.w:0;t.monthLossPct=t.mon.map(function(x){return x.w>0?100*x.l/x.w:0});tw+=t.w;tl+=t.l;var k=String(t.level);if(!lev[k])lev[k]={level:t.level,w:0,l:0,modules:0};lev[k].w+=t.w;lev[k].l+=t.l;lev[k].modules+=t.modules});
    var levels=Object.keys(lev).map(function(k){var x=lev[k];return {level:x.level,modules:x.modules,lossPct:x.w>0?100*x.l/x.w:0}}).sort(function(a,b){return a.level-b.level});
    /* heat map: share of modules touched, per month and hour (all modules, plain average) */
    var grid=months.map(function(mo){return mo.rows.map(function(r){var m=0,f=0;r.perTab.forEach(function(p){m+=p.mods;f+=p.fr});return {h:r.h,frac:m?f/m:0}})});
    return {tables:tabs,levels:levels,totalLossPct:tw>0?100*tl/tw:0,grid:grid,months:months};
  }
  function analyse(res,inp,SV,SE,opts){
    opts=opts||{};if(!res||res.state!=='ok')return {state:'missing',missing:['A valid survey result']};
    if(!(inp.lat>=-60&&inp.lat<=70))return {state:'missing',missing:['Site latitude (live location)']};
    var sc=scene(res,SV,opts);if(!sc.mods.length)return {state:'missing',missing:['At least one elevated table']};
    var hours=[];for(var h=5;h<=19;h+=(opts.step||1))hours.push(h);
    var months=[];for(var i=0;i<12;i++)months.push(monthStep(sc,SE,inp.lat,i,hours));
    var sm=summarise(sc,months);sm.state='ok';sm.modules=sc.mods.length;sm.lat=inp.lat;return sm;
  }
  function analyseAsync(res,inp,SV,SE,opts,onProgress){
    opts=opts||{};
    return new Promise(function(resolve){
      if(!res||res.state!=='ok')return resolve({state:'missing',missing:['A valid survey result']});
      if(!(inp.lat>=-60&&inp.lat<=70))return resolve({state:'missing',missing:['Site latitude (live location)']});
      var sc=scene(res,SV,opts);if(!sc.mods.length)return resolve({state:'missing',missing:['At least one elevated table']});
      var hours=[];for(var h=5;h<=19;h+=(opts.step||1))hours.push(h);
      var months=[],i=0;
      (function next(){if(i>=12){var sm=summarise(sc,months);sm.state='ok';sm.modules=sc.mods.length;sm.lat=inp.lat;return resolve(sm)}
        months.push(monthStep(sc,SE,inp.lat,i,hours));i++;if(onProgress)onProgress(i/12);setTimeout(next,0)})();
    });
  }
  /* shading-factor table over a sun-position grid (whole array): PVsyst orientation (azimuth 0 = south, east negative) */
  function factorTable(res,inp,SV,opts){
    opts=opts||{};var sc=scene(res,SV,opts),azs=[],hts=[],az0=opts.azFrom===undefined?-180:opts.azFrom,az1=opts.azTo===undefined?180:opts.azTo,da=opts.azStep||10,dh=opts.hStep||5;
    for(var a=az0;a<=az1+1e-9;a+=da)azs.push(a);for(var h=0;h<=90+1e-9;h+=dh)hts.push(h);
    var rows=azs.map(function(a){return hts.map(function(h){
      if(h<1)return 1;                                                  /* sun at the horizon: no beam */
      var comp=(a+180+360)%360,fr=sunStep(sc,h,comp),w=0,l=0;
      sc.mods.forEach(function(m,mi){var wi=incidence(sc,mi,h,comp);w+=wi;l+=wi*fr[mi]});
      return w>0?1-l/w:1})});
    return {az:azs,h:hts,factor:rows};
  }
  function csvHourly(sm){
    var L=['month,day_of_month,solar_hour,sun_height_deg,sun_azimuth_pvsyst_deg(0=south,east negative),table,part_level_m,modules,shaded_fraction'];
    sm.months.forEach(function(mo){mo.rows.forEach(function(r){r.perTab.forEach(function(p,ti){var t=sm.tables[ti];
      L.push([mo.m,mo.day,r.h,r.alt.toFixed(2),(r.az-180).toFixed(2),'"'+t.name.replace(/"/g,'')+'"',t.level,p.mods,(p.mods?p.fr/p.mods:0).toFixed(4)].join(','))})})});
    return L.join('\n')+'\n';
  }
  function csvFactor(ft,lat){
    var L=['# GenSolar Pro near-shading factor table (beam), whole array. 1 = no shading, 0 = fully shaded. Computed by ray casting on a 4x4 point grid per module.',
           '# Rows: sun azimuth (PVsyst convention: 0 = south, east negative, west positive). Columns: sun height in degrees. Latitude '+lat+'.',
           '# Check the layout against the PVsyst "Near shadings > Shading factor table" format before importing; headers are written for reading, not as a PVsyst file.',
           'azimuth\\height,'+ft.h.join(',')];
    ft.az.forEach(function(a,i){L.push(a+','+ft.factor[i].map(function(x){return x.toFixed(4)}).join(','))});
    return L.join('\n')+'\n';
  }
  window.EPCShading={makeModule:makeModule,sunVec:sunVec,dni:dni,scene:scene,hitsPrism:hitsPrism,hitsModule:hitsModule,shadedFraction:shadedFraction,sunStep:sunStep,analyse:analyse,analyseAsync:analyseAsync,factorTable:factorTable,csvHourly:csvHourly,csvFactor:csvFactor,KLEIN:KLEIN,MDAYS:MDAYS};
  if(typeof module!=='undefined')module.exports=window.EPCShading;
})();
