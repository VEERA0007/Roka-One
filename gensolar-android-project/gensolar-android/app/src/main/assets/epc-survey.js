/* EPC Survey: roof parts and obstacles from the site-survey sheet -> module placement, counts and Layout blocks.
   Geometry only. The sheet is hand measured, so everything here is a planning count: the roof survey governs and
   nothing is approved. Elevated tables use the shadow-free row pitch of the shadow engine; flush (shed) parts are counted only.
   Frames: sheet (x right, y up, metres) -> compass (e east, n north) using the bearing of the sheet top -> row frame (s along rows, t toward the array azimuth). */
(function(){
  'use strict';
  var RAD=Math.PI/180,KEY='gs_epc_survey_v1',MAXBLOCKS=30;

  /* ================= engine ================= */
  function sheetToEN(p,top){var b=top*RAD;return [p[0]*Math.cos(b)+p[1]*Math.sin(b),-p[0]*Math.sin(b)+p[1]*Math.cos(b)]}
  function enToSheet(p,top){var b=top*RAD;return [p[0]*Math.cos(b)-p[1]*Math.sin(b),p[0]*Math.sin(b)+p[1]*Math.cos(b)]}
  function enToST(p,az){var g=az*RAD;return [p[0]*Math.cos(g)-p[1]*Math.sin(g),p[0]*Math.sin(g)+p[1]*Math.cos(g)]}
  function stToEN(p,az){var g=az*RAD;return [p[0]*Math.cos(g)+p[1]*Math.sin(g),-p[0]*Math.sin(g)+p[1]*Math.cos(g)]}
  function rectPts(x,y,w,d){return [[x,y],[x+w,y],[x+w,y+d],[x,y+d]]}
  function hull(pts){
    var p=pts.slice().sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});if(p.length<3)return p;
    function cr(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])}
    var lo=[],up=[],i;
    for(i=0;i<p.length;i++){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p[i])<=0)lo.pop();lo.push(p[i])}
    for(i=p.length-1;i>=0;i--){while(up.length>1&&cr(up[up.length-2],up[up.length-1],p[i])<=0)up.pop();up.push(p[i])}
    lo.pop();up.pop();return lo.concat(up);
  }
  function obstaclePoly(o){          /* sheet frame; round = circumscribed 24-gon (never smaller than the real object) */
    if(o.shape==='round'){
      var r=o.w/2/Math.cos(Math.PI/24),cx=o.x+o.w/2,cy=o.y+o.w/2,a=[];
      for(var i=0;i<24;i++)a.push([cx+r*Math.cos(2*Math.PI*i/24),cy+r*Math.sin(2*Math.PI*i/24)]);
      return a;
    }
    return rectPts(o.x,o.y,o.w,o.d);
  }
  function sunSamples(inp,E){          /* [{alt,az}] on the chosen day, every 15 min */
    var sh=inp.shade,out=[],n,h1,h2;
    if(sh.mode==='crit'){n=E.criticalDay(inp.lat);h1=inp.window[0];h2=inp.window[1]}
    else{n=E.dayOfYear(sh.m-1,sh.d);h1=sh.from;h2=sh.to}
    for(var h=h1;h<=h2+1e-9;h+=0.25){var s=E.sunPos(inp.lat,n,h);if(s.alt>0.5)out.push({alt:s.alt,az:s.az,h:h})}
    return {s:out,day:n,from:h1,to:h2};
  }
  /* Shadow of a vertical prism on a horizontal plane: footprint swept along the shadow vector. Envelope of all sample times
     (convex hull, so slightly larger than the true area: safe side). pts and result are in the compass (e,n) frame. */
  /* Shadow zone on a plane. hr = body top above the plane; hb = body bottom above the plane (0 when the body stands on it).
     A body that floats above the plane (a tank on a higher roof) shades from its bottom shift to its top shift; the footprint itself is not on the plane. */
  function shadowHull(pts,hr,samples,hb){
    hb=hb>0?hb:0;var all=hb>0?[]:pts.slice();
    samples.forEach(function(s){
      var t=Math.tan(s.alt*RAD);
      [hb,hr].forEach(function(hh){var L=hh/t,de=-L*Math.sin(s.az*RAD),dn=-L*Math.cos(s.az*RAD);pts.forEach(function(p){all.push([p[0]+de,p[1]+dn])})});
    });
    return hull(all);
  }
  /* Does an obstacle occupy a part's level? It must stand on or below that level and rise above it (h = 0 is a keep-out area and always counts). */
  function blocksLevel(o,lvl){var b=o.base>0?o.base:0;return !(o.h>0)||(b<=lvl+1e-6&&o.h>lvl+1e-6)}
  function groupTables(mods,w,gapM){      /* mods = [s,t] cells (one module wide); runs of adjacent cells in one band = one table */
    var by={};mods.forEach(function(m){var k=m[1].toFixed(4);(by[k]=by[k]||[]).push(m)});
    var out=[],step=w+gapM;
    Object.keys(by).map(parseFloat).sort(function(a,b){return a-b}).forEach(function(tk){
      var row=by[tk.toFixed(4)].sort(function(a,b){return a[0]-b[0]}),run=[row[0]];
      for(var i=1;i<=row.length;i++){
        if(i<row.length&&Math.abs(row[i][0]-row[i-1][0]-step)<1e-6)run.push(row[i]);
        else{out.push({s0:run[0][0],t0:run[0][1],per:run.length});if(i<row.length)run=[row[i]]}
      }
    });
    return out;
  }
  function chk(v,lo,hi){return typeof v==='number'&&isFinite(v)&&v>=lo&&v<=hi}

  function calc(inp){
    var P=window.EPCPlaceEngine,E=window.EPCShadowEngine,miss=[],warn=[];
    if(!P||!E)return {state:'missing',missing:['Placement or shadow engine not loaded']};
    if(!chk(inp.top,0,360))miss.push('Direction of the sheet top (which way the "Point South" arrow points)');
    if(!chk(inp.lat,-60,60))miss.push('Latitude on Site (−60 to 60)');
    if(!chk(inp.az,0,360))miss.push('Array azimuth on Site');
    if(!chk(inp.tilt,0,60))miss.push('Array tilt on Site (0–60°)');
    if(!(inp.mod&&inp.mod.l>0&&inp.mod.w>0))miss.push('Module length and width (Auto Design)');
    if(!(inp.mod&&inp.mod.wp>0))miss.push('Module Wp');
    if(!chk(inp.gapMm,0,200))miss.push('Gap between modules (Layout, 0–200 mm)');
    var parts=(inp.parts||[]).filter(function(p){return p.use!==false}),obs=inp.obs||[];
    var hasTable=parts.some(function(p){return p.kind!=='flush'});
    if(!parts.length)miss.push('At least one roof part (name, position and size from the sheet)');
    if(!chk(inp.sb,0,50))miss.push('Edge setback (m)');
    if(!chk(inp.cl,0,50))miss.push('Obstacle clearance (m)');
    if(!chk(inp.rg,0,50))miss.push('Extra row gap (m, 0 if none)');
    if(hasTable){
      if(!(inp.rows>=1&&inp.rows<=8&&inp.rows===Math.round(inp.rows)))miss.push('Modules up the slope per table (whole number, 1–8)');
      if(!chk(inp.lowMm,0,10000))miss.push('Low-edge column height (mm, from the sheet\'s structure height)');
    }
    var sh=inp.shade||{};
    if(sh.mode!=='off'&&sh.mode!=='crit'&&sh.mode!=='custom')miss.push('Obstacle shadow rule');
    else if(sh.mode==='custom'){
      if(!(chk(sh.m,1,12)&&sh.m===Math.round(sh.m)&&chk(sh.d,1,31)&&sh.d===Math.round(sh.d)))miss.push('Shadow date (month and day)');
      if(!(chk(sh.from,5,19)&&chk(sh.to,5,19)&&sh.from<=sh.to))miss.push('Shadow time window (solar hours, start not after end)');
    }else if(sh.mode==='crit'&&!(inp.window&&inp.window[0]>=6&&inp.window[1]<=18&&inp.window[0]<inp.window[1]))miss.push('Shade-free window (Shadow analysis)');
    parts.forEach(function(p,i){
      var nm=p.name||('Part '+(i+1));
      if(!(p.w>0&&p.d>0)||!isFinite(p.x)||!isFinite(p.y))miss.push(nm+': position and size');
      if(p.kind==='flush'){
        if(['up','down','left','right'].indexOf(p.dir)<0)miss.push(nm+': direction the roof falls');
        if(!chk(p.slope,0,45))miss.push(nm+': roof slope (0–45°)');
      }
      if(p.level!==undefined&&!chk(p.level,-50,100))miss.push(nm+': level above the datum');
    });
    obs.forEach(function(o,i){
      var nm=o.name||('Obstacle '+(i+1));
      if(!(o.w>0)||(o.shape!=='round'&&!(o.d>0))||!isFinite(o.x)||!isFinite(o.y))miss.push(nm+': position and size');
      if(!chk(o.h,0,200))miss.push(nm+': height above the datum (0 = keep-out area only)');
      if(o.base!==undefined&&isFinite(o.base)&&o.h>0&&!(o.base>=0&&o.base<o.h))miss.push(nm+': base level must be at least 0 and below its top height');
    });
    if(miss.length)return {state:'missing',missing:miss};

    var gapM=inp.gapMm/1000,port=inp.mod.port,mw=inp.mod.w,ml=inp.mod.l;
    var wAcross=port?mw:ml,dSlope=port?ml:mw,k=inp.rows||1;
    var res={state:'ok',warnings:warn,parts:[],obstacles:[],tables:[],top:inp.top,az:inp.az,tilt:inp.tilt,wp:inp.mod.wp,rows:k,lowMm:inp.lowMm};
    var obsEN=obs.map(function(o){return obstaclePoly(o).map(function(p){return sheetToEN(p,inp.top)})});
    var samples=null;
    if(sh.mode!=='off'){samples=sunSamples(inp,E);res.shadow={day:samples.day,from:samples.from,to:samples.to,mode:sh.mode};if(!samples.s.length)warn.push('The sun is below the horizon for the whole shadow window, so no obstacle shadow was applied.')}
    var rp=null,pitch=0,dPlan=0,tilt=inp.tilt;
    if(hasTable){
      var depthSlope=k*dSlope+(k-1)*gapM;
      rp=E.rowPitch(inp.lat,E.criticalDay(inp.lat),inp.window[0],inp.window[1],depthSlope,tilt,inp.az);
      if(!rp.usable)return {state:'missing',missing:['The shade-free window has no sunshine on the critical day']};
      pitch=rp.pitch+inp.rg;dPlan=depthSlope*Math.cos(tilt*RAD);
      res.pitch=pitch;res.minPitch=rp.pitch;res.depthSlope=depthSlope;res.dPlan=dPlan;
    }
    parts.forEach(function(p,pi){
      var name=p.name||('Part '+(pi+1)),rect=rectPts(p.x,p.y,p.w,p.d),out={name:name,kind:p.kind==='flush'?'flush':'table',modules:0,tables:[],cells:[],zones:[],area:p.w*p.d};
      if(p.kind==='flush'){
        var c=Math.cos(p.slope*RAD),dir=p.dir,ud=(dir==='up'||dir==='down');
        /* plane coordinates: u across the slope, v along it (stretched by 1/cos slope) */
        var toPl=function(q){var a=q[0]-p.x,b=q[1]-p.y;return ud?[a,b/c]:[b,a/c]};
        var fromPl=function(u,v){return ud?[p.x+u,p.y+v*c]:[p.x+v*c,p.y+u]};
        var poly=rect.map(toPl),ob=obs.map(function(o){return obstaclePoly(o).map(toPl)});
        var face={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]}[dir],fe=sheetToEN(face,inp.top);
        out.slope=p.slope;out.facing=((Math.atan2(fe[0],fe[1])/RAD)%360+360)%360;
        var m=P.fit(poly,ob,{w:wAcross,d:dSlope,gap:gapM,pitch:dSlope+gapM,setback:inp.sb,clear:inp.cl});
        m.forEach(function(q){out.cells.push([[q[0],q[1]],[q[0]+wAcross,q[1]],[q[0]+wAcross,q[1]+dSlope],[q[0],q[1]+dSlope]].map(function(z){return fromPl(z[0],z[1])}))});
        out.modules=m.length;out.planArea=p.w*p.d;
        if(samples&&obs.length)warn.push(name+': obstacle shadows are not evaluated on a sloped part; only the clearance applies.');
      }else{
        var lvl=p.level||0;out.level=lvl;var zPlane=lvl+inp.lowMm/1000,polyEN=rect.map(function(q){return sheetToEN(q,inp.top)});
        var poly2=polyEN.map(function(q){return enToST(q,inp.az)}),ob2=[];obsEN.forEach(function(o,oi){if(blocksLevel(obs[oi],lvl))ob2.push(o.map(function(q){return enToST(q,inp.az)}))});
        var zones=[];
        if(samples&&samples.s.length)obs.forEach(function(o,oi){
          var hr=o.h-zPlane;if(!(hr>0))return;
          var hz=shadowHull(obsEN[oi],hr,samples.s,(o.base||0)-zPlane);out.zones.push(hz.map(function(q){return enToSheet(q,inp.top)}));
          zones.push(hz.map(function(q){return enToST(q,inp.az)}));
        });
        var m2=P.fit(poly2,ob2,{w:wAcross,d:dPlan,gap:gapM,pitch:pitch,setback:inp.sb,clear:inp.cl,shade:zones});
        var tabs=groupTables(m2,wAcross,gapM),depth=k*dSlope+(k-1)*gapM,cosT=Math.cos(tilt*RAD);
        tabs.forEach(function(t,ti){
          var tw=t.per*wAcross+(t.per-1)*gapM;
          var corners=[[t.s0,t.t0],[t.s0+tw,t.t0],[t.s0+tw,t.t0+dPlan],[t.s0,t.t0+dPlan]].map(function(z){return enToSheet(stToEN(z,inp.az),inp.top)});
          var cells=[];
          for(var r=0;r<k;r++)for(var cI=0;cI<t.per;cI++){
            var s1=t.s0+cI*(wAcross+gapM),t1=t.t0+r*(dSlope+gapM)*cosT;
            cells.push([[s1,t1],[s1+wAcross,t1],[s1+wAcross,t1+dSlope*cosT],[s1,t1+dSlope*cosT]].map(function(z){return enToSheet(stToEN(z,inp.az),inp.top)}));
          }
          var zF=lvl+inp.lowMm/1000,tanT=Math.tan(tilt*RAD),sinT=Math.sin(tilt*RAD),cellZ=[];
          for(var r2=0;r2<k;r2++){var zb=zF+(depth-(r2*(dSlope+gapM)))*sinT;for(var c2=0;c2<t.per;c2++)cellZ.push([zb,zb-dSlope*sinT])}   /* [back (high) edge, front (low) edge] */
          var tb={name:name+' T'+(ti+1),rows:k,perRow:t.per,modules:k*t.per,corners:corners,cells:cells,cellZ:cellZ,zFront:zF,zBack:zF+depth*sinT,part:name,level:lvl,st:{s0:t.s0,t0:t.t0,tw:tw,dPlan:dPlan}};
          out.tables.push(tb);res.tables.push(tb);
        });
        out.modules=k*m2.length;out.bands=Object.keys(m2.reduce(function(a,q){a[q[1].toFixed(4)]=1;return a},{})).length;
      }
      res.parts.push(out);
    });
    res.obstacles=obs.map(function(o,i){return {name:o.name||('Obstacle '+(i+1)),poly:obstaclePoly(o),h:o.h,base:o.base>0?o.base:0,shape:o.shape}});
    var tm=0,fm=0;res.parts.forEach(function(p){if(p.kind==='flush')fm+=p.modules;else tm+=p.modules});
    res.tableModules=tm;res.flushModules=fm;res.modules=tm+fm;res.kwp=res.modules*inp.mod.wp/1000;
    res.partsKwp=res.parts.map(function(p){return p.modules*inp.mod.wp/1000});
    if(res.modules===0)warn.push('No module fits with these sizes, setbacks and shadow rule.');
    return res;
  }
  /* Layout blocks for the elevated tables only (one block per table, so steel quantities are never under-counted). */
  function layoutBlocks(res,lowMm){
    if(!res||res.state!=='ok')return {error:'No survey result'};
    var t=res.tables;
    if(!t.length)return {error:'There are no elevated tables to send'};
    if(t.length>MAXBLOCKS)return {error:'There are '+t.length+' tables; Layout takes at most '+MAXBLOCKS+'. Use wider tables or fewer parts.'};
    return {blocks:t.map(function(b){return {name:b.name,rows:b.rows,perRow:b.perRow,low:lowMm}})};
  }
  function convexOverlap(a,b){          /* separating-axis test; touching is not overlap */
    function axes(p){var o=[];for(var i=0;i<p.length;i++){var j=(i+1)%p.length,dx=p[j][0]-p[i][0],dy=p[j][1]-p[i][1],l=Math.hypot(dx,dy);if(l>1e-12)o.push([-dy/l,dx/l])}return o}
    var ax=axes(a).concat(axes(b));
    for(var k=0;k<ax.length;k++){
      var n=ax[k],a0=1e18,a1=-1e18,b0=1e18,b1=-1e18;
      a.forEach(function(q){var v=q[0]*n[0]+q[1]*n[1];a0=Math.min(a0,v);a1=Math.max(a1,v)});
      b.forEach(function(q){var v=q[0]*n[0]+q[1]*n[1];b0=Math.min(b0,v);b1=Math.max(b1,v)});
      if(a1<=b0+1e-9||b1<=a0+1e-9)return false;
    }
    return true;
  }
  var MON=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],MD=[31,28,31,30,31,30,31,31,30,31,30,31];
  function stampText(w){var m=Math.round(w.h*60),H=Math.floor(m/60),M=m%60,ap=H>=12?'PM':'AM',h12=H%12===0?12:H%12;return {date:w.d+' '+MON[w.m-1],time:h12+':'+('0'+M).slice(-2)+' '+ap}}
  /* Shadows of the obstacles at one date and solar time. Drawn at datum (roof) level; modules are tested on their own plane
     (obstacle top minus the part level and low edge), the same rule as the placement. res = calc() result, inp = its input. */
  function planShade(res,inp,w){
    var E=window.EPCShadowEngine;
    if(!res||res.state!=='ok')return {state:'missing',missing:['A valid survey result']};
    var miss=[];
    if(!(chk(w.m,1,12)&&w.m===Math.round(w.m)&&chk(w.d,1,MD[Math.round(w.m)-1]||31)&&w.d===Math.round(w.d)))miss.push('Plan date (month and day)');
    if(!chk(w.h,5,19))miss.push('Plan time (solar hour, 5–19)');
    if(miss.length)return {state:'missing',missing:miss};
    var n=E.dayOfYear(w.m-1,w.d),sun=E.sunPos(inp.lat,n,w.h),out={state:'ok',sun:sun,when:w,stamp:stampText(w),night:sun.alt<=0.5,shadows:[],shaded:0,total:0,perTable:[],flushNote:false};
    var tabs=[];res.parts.forEach(function(pt){if(pt.kind==='flush'){if(pt.modules)out.flushNote=true;return}pt.tables.forEach(function(t){tabs.push({t:t,lvl:pt.level||0,hit:0})})});
    tabs.forEach(function(x){out.total+=x.t.modules});
    if(!out.night){
      res.obstacles.forEach(function(o,oi){
        var en=o.poly.map(function(q){return sheetToEN(q,res.top)});
        if(o.h>0)out.shadows.push(shadowHull(en,o.h,[sun],o.base).map(function(q){return enToSheet(q,res.top)}));
        tabs.forEach(function(x){
          var zp=x.lvl+res.lowMm/1000,hr=o.h-zp;if(!(hr>0))return;
          var z=shadowHull(en,hr,[sun],(o.base||0)-zp).map(function(q){return enToSheet(q,res.top)});
          x.t.cells.forEach(function(c,ci){if(!x.t.hitCells)x.t.hitCells={};if(!x.t.hitCells[ci]&&convexOverlap(c,z))x.t.hitCells[ci]=1});
        });
      });
    }
    tabs.forEach(function(x){var h=x.t.hitCells?Object.keys(x.t.hitCells).length:0;x.t.hitCells=null;x.hit=h;out.shaded+=h;out.perTable.push({name:x.t.name,modules:x.t.modules,shaded:h})});
    return out;
  }
  /* ---- isometric model: 3D points (sheet x, y, height z in metres) -> screen; faces sorted far to near ---- */
  function project(p,theta,el){var t=theta*RAD,e=el*RAD,xr=p[0]*Math.cos(t)+p[1]*Math.sin(t),yr=-p[0]*Math.sin(t)+p[1]*Math.cos(t);return {x:xr,y:-(p[2]*Math.cos(e)+yr*Math.sin(e)),d:yr}}
  function isoModel(res,inp,ps,theta,el,stm){
    var faces=[],floors=[],shadows=[],lines=[],tanT=Math.tan(res.tilt*RAD);
    inp.parts.forEach(function(p){if(p.use===false)return;var lv=p.level||0;floors.push({pts:rectPts(p.x,p.y,p.w,p.d).map(function(q){return [q[0],q[1],lv]}),kind:'floor'})});
    if(ps&&ps.state==='ok')ps.shadows.forEach(function(z){shadows.push({pts:z.map(function(q){return [q[0],q[1],0]}),kind:'shadow'})});
    res.obstacles.forEach(function(o){
      var P=o.poly,n=P.length,z0=o.base>0?o.base:0;if(!(o.h>0))return;
      for(var i=0;i<n;i++){var a=P[i],b=P[(i+1)%n];faces.push({pts:[[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],o.h],[a[0],a[1],o.h]],kind:'obsSide',shade:.5+.25*Math.abs(Math.sin(Math.atan2(b[1]-a[1],b[0]-a[0])))})}
      faces.push({pts:P.map(function(q){return [q[0],q[1],o.h]}),kind:'obsTop',name:o.name,h:o.h});
    });
    res.parts.forEach(function(pt){pt.tables.forEach(function(t){
      var c=t.corners;                       /* corners: back-left, back-right(s+w), front-right, front-left in table frame */
      [[c[0],t.zBack],[c[1],t.zBack],[c[2],t.zFront],[c[3],t.zFront]].forEach(function(z){lines.push({pts:[[z[0][0],z[0][1],t.level],[z[0][0],z[0][1],z[1]]],kind:'post'})});
      t.cells.forEach(function(cl,ci){var zz=t.cellZ[ci];faces.push({pts:[[cl[0][0],cl[0][1],zz[0]],[cl[1][0],cl[1][1],zz[0]],[cl[2][0],cl[2][1],zz[1]],[cl[3][0],cl[3][1],zz[1]]],kind:'module',table:t.name})});
    })});
    pt_flush(res,faces);
    function pr(it){it.sp=it.pts.map(function(q){return project(q,theta,el)});var d=0;it.sp.forEach(function(q){d+=q.d});it.depth=d/it.sp.length;return it}
    var members=[];
    if(stm&&stm.state==='ok')stm.tables.forEach(function(t){t.members.forEach(function(m){members.push({pts:[m.a,m.b],role:m.role,kind:m.kind})})});
    [floors,shadows,faces,lines,members].forEach(function(a){a.forEach(pr)});
    faces.sort(function(a,b){return b.depth-a.depth||0});
    return {floors:floors,shadows:shadows,faces:faces,lines:lines,members:members};
  }
  function pt_flush(res,faces){            /* flush parts: modules lie in the sloped plane (drawn flat at part level + half the rise, count only) */
    res.parts.forEach(function(pt){if(pt.kind!=='flush')return;pt.cells.forEach(function(c){faces.push({pts:c.map(function(q){return [q[0],q[1],(pt.level||0)]}),kind:'module',table:pt.name})})});
  }
  window.EPCSurveyStruct=function(){return lastStm};
  window.EPCSurvey={blocksLevel:blocksLevel,isoModel:isoModel,project:project,planShade:planShade,convexOverlap:convexOverlap,stampText:stampText,calc:calc,layoutBlocks:layoutBlocks,hull:hull,shadowHull:shadowHull,groupTables:groupTables,sheetToEN:sheetToEN,enToSheet:enToSheet,enToST:enToST,stToEN:stToEN,obstaclePoly:obstaclePoly,MAXBLOCKS:MAXBLOCKS};

  /* ================= UI ================= */
  if(typeof document==='undefined'||!document.getElementById)return;
  function $(id){return document.getElementById(id)}
  function q(s){return document.querySelector(s)}
  function nv(sel){var e=(sel.charAt(0)==='#'||sel.charAt(0)==='[')?q(sel):$(sel);if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  var V=blank(),last=null,lastInp=null,lastPs=null,timer=null,pend=false,ISOTH0=335,isoTheta=335,ISOEL=45;
  function blank(){return {top:'',topdeg:'',rows:'',low:'',sb:'',cl:'',rg:'0',shade:'',sm:'',sd:'',sf:'9',st:'15',pm:'',pd:'',ph:'',parts:[],obs:[]}}
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function saveVals(){var a=loadAll();a[projName()]=V;try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
  function loadVals(){var o=loadAll()[projName()];V=blank();if(o){Object.keys(V).forEach(function(k){if(o[k]!==undefined)V[k]=o[k]})}fillInputs();renderRows()}
  var SIMPLE=['top','topdeg','rows','low','sb','cl','rg','shade','sm','sd','sf','st','pm','pd','ph'];
  function fillInputs(){SIMPLE.forEach(function(k){var e=$('epcv_'+k);if(e)e.value=V[k]});showHide()}
  function showHide(){
    var o=$('epcv_topdeg');if(o)o.parentNode.hidden=V.top!=='other';
    var c=$('epcv_custom');if(c)c.hidden=V.shade!=='custom';
  }
  function topDeg(){var m={down:0,right:90,up:180,left:270};if(V.top==='other'){var x=parseFloat(V.topdeg);return isFinite(x)?x:NaN}return m[V.top]!==undefined?m[V.top]:NaN}
  function num(s){var x=parseFloat(s);return isFinite(x)?x:NaN}

  function gather(){
    var port=($('epca_orientation')||{}).value!=='landscape',gap=nv('[data-k="gap"]');
    var h1=nv('epcs_h1'),h2=nv('epcs_h2');if(!(h1>=6&&h2<=18&&h1<h2)){h1=9;h2=15}
    return {top:topDeg(),lat:nv('engLat'),az:nv('engAzimuth'),tilt:nv('engTilt'),
      mod:{l:nv('epca_module_l'),w:nv('epca_module_w'),wp:nv('epca_wp'),port:port},gapMm:isFinite(gap)?gap:0,
      rows:num(V.rows),lowMm:num(V.low),sb:num(V.sb),cl:num(V.cl),rg:num(V.rg),window:[h1,h2],
      shade:{mode:V.shade,m:num(V.sm),d:num(V.sd),from:num(V.sf),to:num(V.st)},
      parts:V.parts.map(function(p){return {name:p.name,x:num(p.x),y:num(p.y),w:num(p.w),d:num(p.d),kind:p.kind,level:p.level===''||p.level===undefined?0:num(p.level),dir:p.dir,slope:num(p.slope),use:p.use!==false}}),
      obs:V.obs.map(function(o){return {name:o.name,shape:o.shape,x:num(o.x),y:num(o.y),w:num(o.w),d:o.shape==='round'?num(o.w):num(o.d),h:num(o.h),base:o.base===''||o.base===undefined?0:num(o.base)}})};
  }

  /* ---- top view (sheet orientation, so it can be compared with the paper) ---- */
  function svgView(r,inp,print,ps){
    var pts=[];
    inp.parts.forEach(function(p){rectPts(p.x,p.y,p.w,p.d).forEach(function(z){pts.push(z)})});
    r.obstacles.forEach(function(o){o.poly.forEach(function(z){pts.push(z)})});
    r.parts.forEach(function(p){p.zones.forEach(function(zn){zn.forEach(function(z){pts.push(z)})})});
    if(ps&&ps.state==='ok')ps.shadows.forEach(function(zn){zn.forEach(function(z){pts.push(z)})});
    var x0=1e18,x1=-1e18,y0=1e18,y1=-1e18;pts.forEach(function(z){x0=Math.min(x0,z[0]);x1=Math.max(x1,z[0]);y0=Math.min(y0,z[1]);y1=Math.max(y1,z[1])});
    var pad=1.2,W=900,sc=(W-60)/Math.max(1,x1-x0+2*pad),H=Math.max(200,(y1-y0+2*pad)*sc+40);
    function X(x){return 30+(x-x0+pad)*sc}function Y(y){return H-20-(y-y0+pad)*sc}
    function poly(a,attr){return '<polygon points="'+a.map(function(z){return X(z[0]).toFixed(1)+','+Y(z[1]).toFixed(1)}).join(' ')+'" '+attr+'/>'}
    var h='<svg viewBox="0 0 '+W+' '+H.toFixed(0)+'" class="epsvg" role="img" aria-label="Top view of the roof survey" style="width:100%;background:#fff;color:#222"><defs><pattern id="epcvHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#d84315" stroke-width="1.2"/></pattern></defs>';
    var gx;for(gx=Math.ceil(x0-pad);gx<=x1+pad;gx++)h+='<line x1="'+X(gx).toFixed(1)+'" y1="10" x2="'+X(gx).toFixed(1)+'" y2="'+(H-10).toFixed(1)+'" stroke="#e3e6ea" stroke-width=".6"/>';
    for(gx=Math.ceil(y0-pad);gx<=y1+pad;gx++)h+='<line x1="10" y1="'+Y(gx).toFixed(1)+'" x2="'+(W-10)+'" y2="'+Y(gx).toFixed(1)+'" stroke="#e3e6ea" stroke-width=".6"/>';
    inp.parts.forEach(function(p,i){h+=poly(rectPts(p.x,p.y,p.w,p.d),'fill="'+(p.kind==='flush'?'#fff3e0':'#eef2f6')+'" stroke="#667" stroke-width="1.4"')});
    r.parts.forEach(function(p){p.zones.forEach(function(zn){h+=poly(zn,'fill="url(#epcvHatch)" fill-opacity=".45" stroke="#d84315" stroke-width=".8" stroke-dasharray="4 3"')})});
    r.obstacles.forEach(function(o){h+=poly(o.poly,'fill="#9aa3ad" stroke="#333" stroke-width="1.2"')});
    r.parts.forEach(function(p){
      if(p.kind==='flush')p.cells.forEach(function(c){h+=poly(c,'fill="#3f6fe0" stroke="#fff" stroke-width=".6"')});
      else p.tables.forEach(function(t){t.cells.forEach(function(c){h+=poly(c,'fill="#2f5fd0" stroke="#fff" stroke-width=".6"')});h+=poly(t.corners,'fill="none" stroke="#0d2a7a" stroke-width="1.2"')});
    });
    if(ps&&ps.state==='ok'){
      ps.shadows.forEach(function(z){h+=poly(z,'fill="#000" fill-opacity=".38" stroke="none"')});
      r.parts.forEach(function(p){p.tables.forEach(function(t){var cx=0,cy=0;t.corners.forEach(function(z){cx+=z[0]/4;cy+=z[1]/4});h+='<text x="'+X(cx).toFixed(1)+'" y="'+(Y(cy)+9).toFixed(1)+'" font-size="26" font-weight="800" fill="#fff" stroke="#0d2a7a" stroke-width="1" paint-order="stroke" text-anchor="middle">'+t.modules+'</text>'})});
      h+='<g transform="translate('+(W-190)+','+(H-60).toFixed(0)+')"><rect width="180" height="48" fill="#fff" stroke="#222"/><text x="8" y="19" font-size="14" font-weight="800">DATE : '+ps.stamp.date+'</text><text x="8" y="39" font-size="14" font-weight="800">TIME : '+ps.stamp.time+'</text></g>';
    }
    inp.parts.forEach(function(p,i){var rp=r.parts[i];if(!rp)return;h+='<text x="'+(X(p.x)+5).toFixed(1)+'" y="'+(Y(p.y+p.d)+15).toFixed(1)+'" font-size="13" font-weight="700" fill="#111">'+esc(rp.name)+' · '+rp.modules+' modules</text>'});
    r.obstacles.forEach(function(o){var cx=0,cy=0;o.poly.forEach(function(z){cx+=z[0];cy+=z[1]});cx/=o.poly.length;cy/=o.poly.length;h+='<text x="'+X(cx).toFixed(1)+'" y="'+Y(cy).toFixed(1)+'" font-size="11" text-anchor="middle" fill="#111">'+esc(o.name)+' H='+f(o.h,1)+'</text>'});
    /* compass: north and south as they point on the sheet */
    var nx=-Math.sin(r.top*RAD),ny=Math.cos(r.top*RAD),cx0=W-60,cy0=50;
    h+='<g stroke="#b00020" fill="#b00020"><line x1="'+cx0+'" y1="'+cy0+'" x2="'+(cx0+nx*30).toFixed(1)+'" y2="'+(cy0-ny*30).toFixed(1)+'" stroke-width="2.5"/><text x="'+(cx0+nx*40-5).toFixed(1)+'" y="'+(cy0-ny*40+5).toFixed(1)+'" font-size="14" font-weight="700" stroke="none">N</text></g>';
    h+='<g stroke="#555" fill="#555"><line x1="'+cx0+'" y1="'+cy0+'" x2="'+(cx0-nx*30).toFixed(1)+'" y2="'+(cy0+ny*30).toFixed(1)+'" stroke-width="1.5"/><text x="'+(cx0-nx*40-4).toFixed(1)+'" y="'+(cy0+ny*40+5).toFixed(1)+'" font-size="12" stroke="none">S</text></g>';
    h+='<text x="14" y="'+(H-4).toFixed(0)+'" font-size="11" fill="#555">Grid = 1 m. Sheet orientation (top of the sheet is up). Preliminary plan from hand-measured data.</text>';
    return h+'</svg>';
  }

  function isoSvg(r,inp,ps){
    var stm=showSt?structNow(r,inp):null,m=isoModel(r,inp,ps,isoTheta,ISOEL,stm),all=[];
    [m.floors,m.shadows,m.faces,m.lines,m.members].forEach(function(a){a.forEach(function(it){it.sp.forEach(function(q){all.push(q)})})});
    var x0=1e18,x1=-1e18,y0=1e18,y1=-1e18;all.forEach(function(q){x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y)});
    var W=900,pad=1,sc=(W-40)/Math.max(1,x1-x0+2*pad),H=Math.max(240,(y1-y0+2*pad)*sc+30);
    function X(q){return (20+(q.x-x0+pad)*sc).toFixed(1)}function Y(q){return (15+(q.y-y0+pad)*sc).toFixed(1)}
    function poly(it,attr){return '<polygon points="'+it.sp.map(function(q){return X(q)+','+Y(q)}).join(' ')+'" '+attr+'/>'}
    var h='<svg viewBox="0 0 '+W+' '+H.toFixed(0)+'" class="epsvg" role="img" aria-label="Isometric view of the roof survey" style="width:100%;background:#fff;color:#222">';
    m.floors.forEach(function(it){h+=poly(it,'fill="#e6eaef" stroke="#667" stroke-width="1.2"')});
    m.shadows.forEach(function(it){h+=poly(it,'fill="#000" fill-opacity=".3"')});
    if(!m.members.length)m.lines.forEach(function(it){h+='<line x1="'+X(it.sp[0])+'" y1="'+Y(it.sp[0])+'" x2="'+X(it.sp[1])+'" y2="'+Y(it.sp[1])+'" stroke="#555" stroke-width="1.6"/>'});
    m.faces.forEach(function(it){
      if(it.kind==='module')h+=poly(it,hideMod?'fill="#2f5fd0" fill-opacity=".12" stroke="#2f5fd0" stroke-opacity=".4" stroke-width=".5"':'fill="#2f5fd0" fill-opacity="'+(m.members.length?'.78':'1')+'" stroke="#fff" stroke-width=".7"');
      else if(it.kind==='obsSide'){var g=Math.round(150*it.shade);h+=poly(it,'fill="rgb('+g+','+(g+8)+','+(g+16)+')" stroke="#222" stroke-width=".8"')}
      else if(it.kind==='obsTop'){h+=poly(it,'fill="#aab3bd" stroke="#222" stroke-width="1"');var cx=0,cy=0;it.sp.forEach(function(q){cx+=q.x/it.sp.length;cy+=q.y/it.sp.length});h+='<text x="'+X({x:cx})+'" y="'+Y({y:cy})+'" font-size="11" text-anchor="middle" fill="#111">'+esc(it.name)+' '+f(it.h,1)+' m</text>'}
    });
    m.members.forEach(function(it){var c=MCOL[it.role]||'#333',w=MW[it.role]||1.6;h+='<line x1="'+X(it.sp[0])+'" y1="'+Y(it.sp[0])+'" x2="'+X(it.sp[1])+'" y2="'+Y(it.sp[1])+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"'+(it.kind==='tie'||it.kind==='brace'?' stroke-dasharray="'+(it.kind==='tie'?'5 3':'1 0')+'"':'')+'/>'});
    if(ps&&ps.state==='ok')h+='<g transform="translate('+(W-190)+','+(H-58).toFixed(0)+')"><rect width="180" height="46" fill="#fff" stroke="#222"/><text x="8" y="19" font-size="14" font-weight="800">DATE : '+ps.stamp.date+'</text><text x="8" y="38" font-size="14" font-weight="800">TIME : '+ps.stamp.time+'</text></g>';
    return h+'</svg>';
  }
  var showSt=true,hideMod=false,lastStm=null,MCOL={col:'#b71c1c',raf:'#2e7d32',pur:'#ef6c00',brc:'#6a1b9a'},MW={col:3.2,raf:2.8,pur:2,brc:1.6};
  function fieldNum(id){var e=$(id);if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}
  function fieldStr(id){var e=$(id);return e?e.value:''}

  /* ---- hourly near-shading analysis (ray casting, epc-shading.js) ---- */
  var shd=null,shdSig='',shdBusy=false,shdProg=0;
  window.EPCSurveyShade=function(){return shd&&shd.state==='ok'?{result:shd,stale:shdSig!==curSig()}:null};
  function curSig(){try{return JSON.stringify(lastInp)+'|'+(last&&last.modules)}catch(e){return ''}}
  function saveText(name,txt){
    window.__lastShadeCsv={name:name,text:txt};
    try{if(window.GenSolarNative&&typeof window.GenSolarNative.shareText==='function'){window.GenSolarNative.shareText(txt);return}}catch(e){}
    try{var bl=new Blob([txt],{type:'text/csv'}),u=URL.createObjectURL(bl),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1500)}catch(e){}
  }
  function heatSvg(sm){
    var hs=[],h;for(h=5;h<=19;h++)hs.push(h);
    var cw=40,ch=22,x0=46,y0=22,W=x0+hs.length*cw+10,H=y0+12*ch+34,MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var o='<svg viewBox="0 0 '+W+' '+H+'" class="epsvg" role="img" aria-label="Share of modules shaded by month and solar hour" style="width:100%;max-width:720px;background:#fff;color:#222;font-family:sans-serif">';
    hs.forEach(function(hh,i){o+='<text x="'+(x0+i*cw+cw/2)+'" y="14" font-size="10" text-anchor="middle">'+hh+'</text>'});
    sm.grid.forEach(function(row,mi){
      o+='<text x="40" y="'+(y0+mi*ch+15)+'" font-size="10" text-anchor="end">'+MN[mi]+'</text>';
      hs.forEach(function(hh,i){var c=row.filter(function(q){return q.h===hh})[0],fr=c?c.frac:null,x=x0+i*cw,y=y0+mi*ch;
        if(fr===null)o+='<rect x="'+x+'" y="'+y+'" width="'+cw+'" height="'+ch+'" fill="#eceff3" stroke="#fff"/>';
        else{var g=Math.round(255-fr*200),col='rgb(255,'+g+','+Math.round(g*.75)+')';o+='<rect x="'+x+'" y="'+y+'" width="'+cw+'" height="'+ch+'" fill="'+(fr<1e-9?'#e8f5e9':col)+'" stroke="#fff"><title>'+MN[mi]+' '+hh+' h: '+(fr*100).toFixed(1)+'% of module area shaded</title></rect>';
          if(fr>=0.005)o+='<text x="'+(x+cw/2)+'" y="'+(y+15)+'" font-size="9" text-anchor="middle" fill="#222">'+Math.round(fr*100)+'</text>'}});
    });
    o+='<text x="'+x0+'" y="'+(y0+12*ch+16)+'" font-size="10">Solar hour (x), month (y). Number = % of module area shaded, green = none, grey = sun below 3°.</text></svg>';
    return o;
  }
  function shadeHtml(){
    var h='<h3 style="margin:14px 0 4px;font-size:15px">Hourly near-shading analysis</h3>';
    if(!last||last.state!=='ok'||!last.tables.length)return h+'<div class="epca-warnings">Place at least one elevated table first.</div>';
    var lat=lastInp&&lastInp.lat;
    if(!(lat>=-60&&lat<=70))h+='<div class="epca-warnings">Needs the Site latitude (set the location on the Site tab). Still needed: Site latitude.</div>';
    h+='<div class="ep-bar"><button class="btn sm" type="button" id="epcv_shrun"'+(shdBusy||!(lat>=-60&&lat<=70)?' disabled':'')+'>'+(shd&&shd.state==='ok'?'Re-run':'Run')+' hourly near-shading analysis</button> <button class="btn alt sm" type="button" id="epcv_pkg">Export PDF package</button> <span class="ep-note" id="epcv_shprog">'+(shdBusy?'Working… '+Math.round(shdProg*100)+'%':'')+'</span></div>';
    if(shd&&shd.state==='ok'){
      var stale=shdSig!==curSig();
      if(stale)h+='<div class="epca-warnings">The survey, obstacles or location changed since this run. Run it again before using the numbers.</div>';
      h+='<p style="margin:6px 0"><b>Annual near-shading loss (beam, clear sky): '+f(shd.totalLossPct,2)+' %</b> over '+shd.modules+' modules at latitude '+f(shd.lat,3)+'°.</p>';
      h+='<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr><th align="left">Level (m)</th><th align="right">Modules</th><th align="right">Annual loss %</th></tr></thead><tbody>'+shd.levels.map(function(l){return '<tr style="border-top:1px solid var(--line)"><td>'+f(l.level,2)+'</td><td align="right">'+l.modules+'</td><td align="right">'+f(l.lossPct,2)+'</td></tr>'}).join('')+'</tbody></table></div>';
      var MN=['J','F','M','A','M','J','J','A','S','O','N','D'];
      h+='<div style="overflow-x:auto;margin-top:8px"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th align="left">Table</th><th align="right">Annual %</th>'+MN.map(function(m){return '<th align="right">'+m+'</th>'}).join('')+'<th align="right">Worst hour</th></tr></thead><tbody>'+
        shd.tables.map(function(t){return '<tr style="border-top:1px solid var(--line)"><td>'+esc(t.name)+'</td><td align="right">'+f(t.lossPct,2)+'</td>'+t.monthLossPct.map(function(x){return '<td align="right">'+f(x,1)+'</td>'}).join('')+'<td align="right">'+(t.worst&&t.worst.frac>0?Math.round(t.worst.frac*100)+'% m'+t.worst.month+' '+t.worst.h+'h':'–')+'</td></tr>'}).join('')+'</tbody></table></div>';
      h+='<div style="margin:8px 0">'+heatSvg(shd)+'</div>';
      h+='<div class="ep-bar"><button class="btn alt sm" type="button" id="epcv_shcsv">Download hourly CSV</button> <button class="btn alt sm" type="button" id="epcv_shfac">Download shading-factor table (for PVsyst)</button></div>';
      h+='<p class="ep-note">Method: for each month (average day), each solar hour with the sun above 3°, a 4×4 grid of points on every module is tested against the obstacles (with their base heights, so a tank on the penthouse roof shades only what it can reach) and the other modules, along the direction of the sun. Loss is the shaded area share weighted by clear-sky beam on the module. It is not site weather, diffuse light, or bypass-diode behaviour, so it is an estimate of the near-shading loss. PVsyst itself is not run here; the factor table is written for you to check against PVsyst\'s Near shadings table before importing.</p>';
    }
    return h;
  }
  function runShade(){
    if(shdBusy||!last||last.state!=='ok'||!window.EPCShading)return;
    shdBusy=true;shdProg=0;var sig=curSig(),res=last,inp=lastInp;render();
    window.EPCShading.analyseAsync(res,inp,window.EPCSurvey,window.EPCShadowEngine,{},function(p){shdProg=p;var e=$('epcv_shprog');if(e)e.textContent='Working… '+Math.round(p*100)+'%'}).then(function(sm){
      shdBusy=false;shd=sm;shdSig=sig;render();
    });
  }

  /* ---- PDF export package: sheet, plan, 3D with materials, shadow report, photos ---- */
  function pkgPage(title,body,foot){
    var d=new Date().toLocaleDateString('en-IN');
    return '<div class="ep-page"><div class="ep-ph"><b>'+esc(projName())+'</b><span>'+esc(title)+'</span><span>'+d+'</span></div><div class="ep-pb" style="flex-direction:column;align-items:stretch;justify-content:flex-start">'+body+'</div><div class="ep-pf">'+foot+'</div></div>';
  }
  var PKGF='PRELIMINARY – NOT FOR CONSTRUCTION. Hand-measured survey data governs; structure and shading figures are estimates until a structural engineer and the designer sign off.';
  function pkgMedia(pk,pg){
    for(var i=0;i<pk.photos.length;i+=4){
    var cells=pk.photos.slice(i,i+4).map(function(q){return '<figure style="margin:0;display:flex;flex-direction:column;gap:2px;min-height:0"><img src="'+q.src+'" alt="" style="width:100%;height:78mm;object-fit:contain;background:#f3f5f7"><figcaption style="font-size:10px">'+esc(q.name)+(q.note?': '+esc(q.note):'')+'</figcaption></figure>'}).join('');
    pg.push(pkgPage('Site photos '+(i+1)+'–'+Math.min(i+4,pk.photos.length)+' of '+pk.photos.length,'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+cells+'</div>',PKGF));
  }
  if(pk.videos.length)pg.push(pkgPage('Site videos (kept in the app)','<p style="font-size:12px">Videos cannot be printed. They stay saved with this floor in the app:</p><ol style="font-size:12px">'+pk.videos.map(function(v){return '<li>'+esc(v.name)+(v.mb?' ('+f(v.mb,1)+' MB)':'')+(v.note?': '+esc(v.note):'')+'</li>'}).join('')+'</ol>',PKGF));
  }
  function buildPackage(){
    var r=last,inp=lastInp;if(!r||!inp)return {html:'',pages:0};
    var calc_ok=r.state==='ok';
    var pk=window.EPCSheetUI&&window.EPCSheetUI.pack?window.EPCSheetUI.pack():{svg:'',photos:[],videos:[]},pg=[];
    var T='font-size:12px;border-collapse:collapse;margin-top:6px',ok=shd&&shd.state==='ok',stale=ok&&shdSig!==curSig();
    var lat=inp.lat,lon=nv('engLon'),hasLoc=lat>=-60&&lat<=70;
    if(!calc_ok){
      var pk0=pkgPage('Roof survey package: summary','<div class="epca-warnings">The panel count is not available yet, so the plan, 3D view and shading report are left out. Still needed: '+(r.missing||[]).map(esc).join('; ')+'.</div><p style="font-size:12px">Floor: '+esc(pk.floor||'not entered')+'. Photos '+pk.photos.length+', videos '+pk.videos.length+'.</p>',PKGF),pg0=[pk0];
      if(pk.svg)pg0.push(pkgPage('Floor sheet with traced areas',pk.svg,PKGF));
      pkgMedia(pk,pg0);return {html:pg0.join(''),pages:pg0.length};
    }
    /* 1 summary */
    var rows=r.parts.map(function(p,i){return '<tr><td>'+esc(p.name)+'</td><td>'+(p.kind==='flush'?'Flush':'Tables')+'</td><td align="right">'+p.modules+'</td><td align="right">'+f(r.partsKwp[i],2)+'</td></tr>'}).join('');
    var sum='<table style="'+T+'"><tbody><tr><td>Floor</td><td>'+esc(pk.floor||'not entered')+'</td></tr><tr><td>Location</td><td>'+(hasLoc?f(lat,4)+'°N'+(isFinite(lon)?', '+f(lon,4)+'°E':''):'not set')+'</td></tr><tr><td>Array</td><td>'+f(inp.tilt,0)+'° tilt, azimuth '+f(inp.az,0)+'°, '+r.modules+' modules, '+f(r.kwp,2)+' kWp</td></tr><tr><td>Sheet scale</td><td>'+(pk.scaled?f(pk.ppm,2)+' px per metre':'not set')+'</td></tr><tr><td>Annual near-shading loss</td><td>'+(ok?f(shd.totalLossPct,2)+' %'+(stale?' (OUT OF DATE, re-run)':''):'not run')+'</td></tr><tr><td>Photos / videos</td><td>'+pk.photos.length+' / '+pk.videos.length+'</td></tr></tbody></table>'+
      '<table style="'+T+';width:100%"><thead><tr><th align="left">Part</th><th align="left">Type</th><th align="right">Modules</th><th align="right">kWp</th></tr></thead><tbody>'+rows+'<tr style="font-weight:700"><td>Total</td><td></td><td align="right">'+r.modules+'</td><td align="right">'+f(r.kwp,2)+'</td></tr></tbody></table>'+r.warnings.map(function(w){return '<p style="font-size:11px;margin:4px 0">⚠ '+esc(w)+'</p>'}).join('');
    pg.push(pkgPage('Roof survey package: summary',sum,PKGF));
    /* 2 sheet */
    if(pk.svg)pg.push(pkgPage('Floor sheet with traced areas',pk.svg,PKGF+' Traces are drawn from the Survey rows at the sheet scale.'));
    /* 3 plan (with shadows if a plan time was entered) */
    var ps=lastPs&&lastPs.state==='ok'?lastPs:null;
    pg.push(pkgPage('Plan'+(ps?' with shadows, '+ps.stamp.date+' '+ps.stamp.time:''),svgView(r,inp,true,ps),(ps?'Shadows at '+ps.stamp.date+', '+ps.stamp.time+' solar time ('+ps.shaded+' of '+ps.total+' table modules touched). ':'No plan shadow time entered. ')+(r.shadow?'Obstacle shadows kept clear on day '+r.shadow.day+' of the year, '+f(r.shadow.from,2)+'–'+f(r.shadow.to,2)+' solar h. ':'Obstacle shadows not applied. ')+PKGF));
    /* 4 3D with members + materials */
    var sk=showSt;showSt=true;structNow(r,inp);var iso=isoSvg(r,inp,ps),sh=structHtml();showSt=sk;
    pg.push(pkgPage('3D view with structure members',iso+'<p style="font-size:11px;margin:4px 0">Columns red, rafters green, purlins orange, braces purple, ties dashed.</p>',PKGF));
    pg.push(pkgPage('Structure material schedule',sh||'<p>Structure sections and layout values were not complete, so no schedule is available.</p>',PKGF));
    /* 5 shadow report */
    if(ok){
      var MN=['J','F','M','A','M','J','J','A','S','O','N','D'];
      var sb='<p style="margin:4px 0"><b>Annual near-shading loss (beam, clear sky): '+f(shd.totalLossPct,2)+' %</b> over '+shd.modules+' modules, latitude '+f(shd.lat,3)+'°.'+(stale?' <b>THE SURVEY CHANGED AFTER THIS RUN: THESE FIGURES ARE OUT OF DATE.</b>':'')+'</p>'+
        '<table style="'+T+'"><thead><tr><th align="left">Level (m)</th><th align="right">Modules</th><th align="right">Annual loss %</th></tr></thead><tbody>'+shd.levels.map(function(l){return '<tr><td>'+f(l.level,2)+'</td><td align="right">'+l.modules+'</td><td align="right">'+f(l.lossPct,2)+'</td></tr>'}).join('')+'</tbody></table>'+
        '<table style="'+T+';width:100%"><thead><tr><th align="left">Table</th><th align="right">Year %</th>'+MN.map(function(m){return '<th align="right">'+m+'</th>'}).join('')+'</tr></thead><tbody>'+shd.tables.map(function(t){return '<tr><td>'+esc(t.name)+'</td><td align="right">'+f(t.lossPct,2)+'</td>'+t.monthLossPct.map(function(x){return '<td align="right">'+f(x,1)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'+
        '<div style="margin-top:8px">'+heatSvg(shd)+'</div>';
      pg.push(pkgPage('Hourly near-shading report',sb,'Ray-cast beam shading, average day of each month, clear-sky model; not site weather, diffuse light or bypass-diode behaviour. PVsyst was not run. '+PKGF));
    }else pg.push(pkgPage('Hourly near-shading report','<div class="epca-warnings">The hourly near-shading analysis has not been run for this survey.</div>',PKGF));
    pkgMedia(pk,pg);
    render();
    return {html:pg.join(''),pages:pg.length};
  }
  function printPackage(){
    var b=buildPackage();if(!b.pages)return;
    var ps=$('printSheet');ps.innerHTML=b.html;window.__lastPackage={pages:b.pages};
    var imgs=[].slice.call(ps.querySelectorAll('img')).filter(function(i){return !i.complete}).map(function(i){return new Promise(function(r){i.onload=i.onerror=r})});
    Promise.race([Promise.all(imgs),new Promise(function(r){setTimeout(r,4000)})]).then(function(){setTimeout(function(){try{var N=window.GenSolarNative;if(N&&typeof N.printPdfLandscape==='function')N.printPdfLandscape();else if(N&&typeof N.printPdf==='function')N.printPdf();else window.print()}catch(e){}},300)});
  }
  window.EPCSurveyPackage=function(){return buildPackage()};
  function structInputs(){
    var E=window.EPCAnalysisEngine,miss=[],sec={},lab={},LS=null;
    try{LS=JSON.parse(localStorage.getItem('gs_epc_v1'))}catch(e){}
    if(!E||!window.EPCStruct3D)return {state:'missing',missing:['Structure module not loaded']};
    function mk(role,type,b,h,t,name){
      var B=fieldNum(b),H=fieldNum(h),T=fieldNum(t),ty=fieldStr(type);
      if(!(B>0&&T>0)||(ty==='RHS'&&!(H>0))||(ty!=='RHS'&&ty!=='CHS')){miss.push(name);return}
      sec[role]=E.section(ty,B,H,T);lab[role]=ty==='RHS'?'RHS '+B+' x '+H+' x '+T:'CHS '+B+' x '+T;
    }
    mk('pur','epcw_pType','epcw_pb','epcw_ph','epcw_pt','purlin section (Wind & Structure)');mk('raf','epcw_rType','epcw_rb','epcw_rh','epcw_rt','rafter section (Wind & Structure)');
    mk('col','epca2_colType','epca2_colB','epca2_colH','epca2_colT','column section (Analysis)');mk('brc','epca2_brcType','epca2_brcB','epca2_brcH','epca2_brcT','brace section (Analysis)');
    var S0={};['frameSpacing','colSpacingH','colInset','rafterOvh','purlinOvh'].forEach(function(k){S0[k]=LS?parseFloat(LS[k]):NaN;if(!isFinite(S0[k]))miss.push('Layout: '+k)});
    if(miss.length)return {state:'missing',missing:miss};
    var tf=fieldNum('epca2_tieFrac'),bf=fieldNum('epca2_brcFrac');
    return {state:'ok',cfg:{S:S0,sec:sec,labels:lab,fixed:fieldStr('epca2_base')==='Fixed',tieFrac:tf>0?tf:0.6,brcFrac:bf>0?bf:0.75}};
  }
  function structNow(r,inp){
    var si=structInputs();if(si.state!=='ok'){lastStm=si;return null}
    var o=window.EPCStruct3D.members(r,inp,si.cfg);lastStm=o;return o.state==='ok'?o:null;
  }
  function structHtml(){
    var o=lastStm;
    if(!o)return '';
    if(o.state!=='ok')return '<p class="ep-note">Structure members appear here once these are filled: '+o.missing.map(esc).join('; ')+'.</p>';
    var sc=o.schedule,h='<h3 style="margin:14px 0 4px;font-size:15px">Structure material schedule ('+sc.tables+' table'+(sc.tables>1?'s':'')+')</h3><div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr><th align="left">Member</th><th align="left">Section</th><th align="right">Pieces</th><th align="right">Length (m)</th><th align="right">kg/m</th><th align="right">Weight (kg)</th></tr></thead><tbody>';
    sc.rows.forEach(function(x){h+='<tr style="border-top:1px solid var(--line)"><td><span style="display:inline-block;width:10px;height:10px;background:'+(MCOL[x.role]||'#333')+';margin-right:6px"></span>'+esc(x.name)+'</td><td>'+esc(x.section)+'</td><td align="right">'+x.pieces+'</td><td align="right">'+f(x.lengthM,1)+'</td><td align="right">'+f(x.kgPerM,2)+'</td><td align="right">'+f(x.kg,0)+'</td></tr>'});
    h+='<tr style="border-top:2px solid var(--line);font-weight:700"><td>Total steel</td><td></td><td></td><td align="right">'+f(sc.totalLengthM,1)+'</td><td></td><td align="right">'+f(sc.totalKg,0)+'</td></tr></tbody></table></div>';
    h+='<p class="ep-note">Members are the same ones the Analysis tab checks (frames at the frame spacing, columns, ties and braces from Layout and Analysis), placed on every table at its level. Weights are section area x 7850 kg/m3 on net length, before cutting waste, base plates, bolts and fittings. Preliminary: the structure is not approved until a structural engineer signs off.'+(o.warnings.length?' '+esc(o.warnings[0]):'')+'</p>';
    return h;
  }
  function render(){
    var out=$('epcv_out');if(!out)return;
    var inp=gather(),r=calc(inp);last=r;lastInp=inp;
    if(r.state==='missing'){out.innerHTML='<div class="epca-warnings"><b>Panel count not available yet.</b> Still needed:<ul style="margin:6px 0 0 18px">'+r.missing.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul></div>';return}
    var tgt=nv('engCapacity'),wp=r.wp,need=tgt>0?Math.ceil(tgt*1000/wp-1e-9):NaN;
    var h='<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr><th align="left">Part</th><th align="left">Type</th><th align="right">Tables</th><th align="right">Modules</th><th align="right">kWp</th></tr></thead><tbody>';
    r.parts.forEach(function(p,i){h+='<tr style="border-top:1px solid var(--line)"><td>'+esc(p.name)+'</td><td>'+(p.kind==='flush'?'Flush on slope, '+f(p.slope,0)+'° facing '+f(p.facing,0)+'°':'Elevated tables')+'</td><td align="right">'+(p.kind==='flush'?'–':p.tables.length)+'</td><td align="right">'+p.modules+'</td><td align="right">'+f(r.partsKwp[i],2)+'</td></tr>'});
    h+='<tr style="border-top:2px solid var(--line);font-weight:700"><td>Total</td><td></td><td align="right">'+r.tables.length+'</td><td align="right">'+r.modules+'</td><td align="right">'+f(r.kwp,2)+'</td></tr></tbody></table></div>';
    if(isFinite(need))h+='<p style="margin:8px 0"><b>Target '+f(tgt,2)+' kWp needs '+need+' modules of '+f(wp,0)+' Wp. The roof fits '+r.modules+' ('+f(r.kwp,2)+' kWp): '+(r.modules>=need?'enough room, '+(r.modules-need)+' spare.':'<span style="color:#b3261e">short by '+(need-r.modules)+' modules.</span>')+'</b></p>';
    if(r.tables.length){
      h+='<p style="margin:6px 0"><small>Elevated tables: '+r.rows+' row'+(r.rows>1?'s':'')+' up the slope, row pitch '+f(r.pitch,3)+' m (shadow-free '+f(r.minPitch,3)+' m on the critical day, '+inp.window[0]+':00 to '+inp.window[1]+':00, plus extra gap), tilt '+f(r.tilt,0)+'°, azimuth '+f(r.az,0)+'°, low edge '+f(r.lowMm,0)+' mm.</small></p>';
    }
    if(r.shadow)h+='<p style="margin:6px 0"><small>Obstacle shadows were kept clear on day '+r.shadow.day+' of the year between '+f(r.shadow.from,2)+' and '+f(r.shadow.to,2)+' solar hours (hatched on the plan). Shadow zones are the outer envelope, a little larger than the true shadow. Outside this window modules can still be shaded.</small></p>';
    else h+='<p style="margin:6px 0"><small>Obstacle shadows are NOT applied (clearance only).</small></p>';
    r.warnings.forEach(function(w){h+='<div class="epca-warnings" style="margin:6px 0">'+esc(w)+'</div>'});
    h+='<div style="margin:10px 0">'+svgView(r,inp)+'</div>';
    var ps=planShade(r,inp,{m:num(V.pm),d:num(V.pd),h:num(V.ph)});lastPs=ps;
    h+='<h3 style="margin:14px 0 4px;font-size:15px">Plan with shadows</h3>';
    if(ps.state!=='ok')h+='<div class="epca-warnings">Enter the plan date and solar time below the shadow rule to draw the shadows. Still needed: '+ps.missing.map(esc).join('; ')+'.</div>';
    else{
      h+='<p style="margin:6px 0"><b>'+ps.stamp.date+', '+ps.stamp.time+' (solar time): '+(ps.night?'the sun is below the horizon, no shadows.':'sun altitude '+f(ps.sun.alt,1)+'°, azimuth '+f(ps.sun.az,0)+'°. '+ps.shaded+' of '+ps.total+' table modules are touched by obstacle shadow at this moment.')+'</b></p>';
      ps.perTable.forEach(function(t){if(t.shaded)h+='<small>'+esc(t.name)+': '+t.shaded+' of '+t.modules+' modules shaded. </small>'});
      h+='<div style="margin:10px 0">'+svgView(r,inp,false,ps)+'</div><p class="ep-note">Shadows are drawn at roof (datum) level from the obstacle heights you entered; module shading is tested on each module plane (obstacle top minus part level and low-edge height). One instant only, solar time (equation of time ignored). Neighbouring buildings count only if entered as obstacles.'+(ps.flushNote?' Flush parts are not checked for shadow.':'')+'</p>';
      h+='<div class="ep-bar"><button class="btn alt sm" type="button" id="epcv_printplan">Print plan with shadows</button></div>';
    }
    h+='<h3 style="margin:14px 0 4px;font-size:15px">3D view</h3><div class="ep-bar"><button class="btn alt sm" type="button" data-iso="-30" aria-label="Rotate left">⟲ Rotate</button> <button class="btn alt sm" type="button" data-iso="30" aria-label="Rotate right">Rotate ⟳</button> <button class="btn alt sm" type="button" data-iso="0">Reset view</button> <span class="ep-note">View angle '+isoTheta+'°</span> <label class="ep-note" style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" id="epcv_sstruct"'+(showSt?' checked':'')+'> Show structure</label> <label class="ep-note" style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" id="epcv_seethru"'+(hideMod?' checked':'')+'> See through modules</label></div><div id="epcv_iso" style="margin:8px 0">'+isoSvg(r,inp,lastPs)+'</div>'+structHtml()+'<p class="ep-note">Modules sit at their tilt and low-edge height. With Show structure on, the members of the analysed structure are drawn: columns red, rafters green, purlins orange, braces purple and ties dashed purple. Without the structure, the thin posts mark the table corners only. Obstacles stand from the datum. Shadows appear when a plan date and time are entered above.</p>';
    h+=shadeHtml();
    var lb=layoutBlocks(r,r.lowMm);
    h+='<div class="ep-bar"><button class="btn alt sm" type="button" id="epcv_apply"'+(r.modules?'':' disabled')+'>Use '+f(r.kwp,2)+' kWp as the Site target capacity</button> <button class="btn sm" type="button" id="epcv_send"'+(lb.error?' disabled':'')+'>Send '+(lb.blocks?lb.blocks.length:0)+' table(s) to Layout</button> <button class="btn alt sm" type="button" id="epcv_print">Print / Save as PDF</button> <span class="ep-note" id="epcv_msg">'+(lb.error&&r.tables.length===0?'':(lb.error?esc(lb.error):''))+'</span></div>';
    h+='<p class="ep-note">Preliminary count from hand-measured data. Sending to Layout replaces all current Layout blocks (asked once more before it happens); flush parts are counted only and are not part of the steel structure. Structure, wind and shadow checks still apply and nothing here is approved.</p>';
    out.innerHTML=h;
    $('epcv_apply').onclick=function(){var e=$('engCapacity');if(!e)return;e.value=r.kwp.toFixed(2);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};
    $('epcv_print').onclick=function(){printPlan(false)};
    var pp=$('epcv_printplan');if(pp)pp.onclick=function(){printPlan(true)};
    var sb=$('epcv_send');if(sb)sb.onclick=function(){
      var m=$('epcv_msg');
      if(!pend){pend=true;sb.textContent='Click again to replace the Layout blocks';if(m)m.textContent='This replaces every block in Layout and the analysis will be run again.';setTimeout(function(){pend=false;var b=$('epcv_send');if(b&&lb.blocks)b.textContent='Send '+lb.blocks.length+' table(s) to Layout'},6000);return}
      pend=false;
      if(!window.EPCLayout||!window.EPCLayout.setBlocks){if(m)m.textContent='Layout is not available';return}
      var e=window.EPCLayout.setBlocks(lb.blocks);
      sb.textContent='Send '+lb.blocks.length+' table(s) to Layout';
      if(m)m.textContent=e?e:'Sent '+lb.blocks.length+' block(s) to Layout. Open Layout to check them; Wind & Structure and Analysis use them now.';
    };
  }
  function printPlan(withShade){
    var r=last;if(!r||r.state!=='ok')return;var ps=withShade&&lastPs&&lastPs.state==='ok'?lastPs:null;
    var d=new Date().toLocaleDateString('en-IN');
    var rows=r.parts.map(function(p,i){return '<tr><td>'+esc(p.name)+'</td><td>'+(p.kind==='flush'?'Flush':'Tables')+'</td><td align="right">'+p.modules+'</td><td align="right">'+f(r.partsKwp[i],2)+'</td></tr>'}).join('');
    var html='<div class="ep-page"><div class="ep-ph"><b>'+esc(projName())+'</b><span>Roof survey plan</span><span>'+d+'</span></div><div class="ep-pb" style="flex-direction:column;align-items:stretch">'+svgView(r,lastInp,true,ps)+
      '<table style="font-size:12px;margin-top:8px;border-collapse:collapse"><thead><tr><th align="left">Part</th><th align="left">Type</th><th align="right">Modules</th><th align="right">kWp</th></tr></thead><tbody>'+rows+'<tr style="font-weight:700"><td>Total</td><td></td><td align="right">'+r.modules+'</td><td align="right">'+f(r.kwp,2)+'</td></tr></tbody></table></div>'+
      '<div class="ep-pf">PRELIMINARY – NOT FOR CONSTRUCTION. Count from hand-measured survey data; the roof survey governs. '+(ps?'Shadows at '+ps.stamp.date+', '+ps.stamp.time+' solar time ('+ps.shaded+' of '+ps.total+' table modules touched). ':'')+(r.shadow?'Obstacle shadows kept clear on day '+r.shadow.day+' of the year, '+f(r.shadow.from,2)+'–'+f(r.shadow.to,2)+' solar h.':'Obstacle shadows not applied.')+'</div></div>';
    $('printSheet').innerHTML=html;
    setTimeout(function(){try{var N=window.GenSolarNative;if(N&&typeof N.printPdfLandscape==='function')N.printPdfLandscape();else if(N&&typeof N.printPdf==='function')N.printPdf();else window.print()}catch(e){}},300);
  }

  /* ---- parts / obstacles tables ---- */
  var PF=[['name','text','Name'],['x','number','X (m)'],['y','number','Y (m)'],['w','number','Width (m)'],['d','number','Depth (m)']];
  function inpH(list,i,k,type,ph,val,extra){return '<input data-'+list+'="'+i+'.'+k+'" type="'+type+'"'+(type==='number'?' step="any" inputmode="decimal"':'')+' aria-label="'+esc(ph)+'" placeholder="'+esc(ph)+'" value="'+esc(val===undefined?'':val)+'"'+(extra||'')+'>'}
  function renderRows(){
    var pe=$('epcv_parts'),oe=$('epcv_obs');if(!pe||!oe)return;
    var h='';
    V.parts.forEach(function(p,i){
      h+='<div class="epcv-row"><label class="epcv-use"><input type="checkbox" data-part="'+i+'.use"'+(p.use!==false?' checked':'')+' aria-label="Use this part"> use</label>'+
        PF.map(function(c){return inpH('part',i,c[0],c[1],c[2],p[c[0]])}).join('')+
        '<select data-part="'+i+'.kind" aria-label="Part type"><option value="table"'+(p.kind!=='flush'?' selected':'')+'>Elevated tables</option><option value="flush"'+(p.kind==='flush'?' selected':'')+'>Flush on slope</option></select>'+
        inpH('part',i,'level','number','Level above datum (m)',p.level)+
        (p.kind==='flush'?'<select data-part="'+i+'.dir" aria-label="Roof falls toward"><option value="">Falls toward…</option>'+['up','down','left','right'].map(function(d){return '<option value="'+d+'"'+(p.dir===d?' selected':'')+'>Falls toward sheet '+d+'</option>'}).join('')+'</select>'+inpH('part',i,'slope','number','Slope (°)',p.slope):'')+
        '<button class="btn x" type="button" data-delpart="'+i+'" aria-label="Remove part">×</button></div>';
    });
    pe.innerHTML=h?'<p class="ep-note">Each row: use · name · X · Y · width · depth (m) · type · level above datum (m)'+(V.parts.some(function(p){return p.kind==="flush"})?' · falls toward · slope (°)':'')+'</p>'+h:'<p class="ep-note">No parts yet. Add each roof area you can put modules on.</p>';
    h='';
    V.obs.forEach(function(o,i){
      h+='<div class="epcv-row">'+inpH('obs',i,'name','text','Name',o.name)+
        '<select data-obs="'+i+'.shape" aria-label="Shape"><option value="rect"'+(o.shape!=='round'?' selected':'')+'>Box</option><option value="round"'+(o.shape==='round'?' selected':'')+'>Round</option></select>'+
        inpH('obs',i,'x','number','X (m)',o.x)+inpH('obs',i,'y','number','Y (m)',o.y)+inpH('obs',i,'w','number',o.shape==='round'?'Diameter (m)':'Width (m)',o.w)+
        (o.shape==='round'?'':inpH('obs',i,'d','number','Depth (m)',o.d))+inpH('obs',i,'h','number','Top height above datum (m)',o.h)+inpH('obs',i,'base','number','Base level above datum (m, 0 = on the floor)',o.base)+
        '<button class="btn x" type="button" data-delobs="'+i+'" aria-label="Remove obstacle">×</button></div>';
    });
    oe.innerHTML=h?'<p class="ep-note">Each row: name · shape · X · Y · width (diameter if round) · depth (m) · top height above datum (m) · base level above datum (m; 0 if it stands on the floor, or the roof level it stands on)</p>'+h:'<p class="ep-note">No obstacles. Add tanks, lift rooms, sheds, towers, parapets and neighbouring buildings (height 0 = keep-out area only).</p>';
  }
  function onField(e){
    var t=e.target;if(!t||!t.getAttribute)return;
    var id=t.id||'',ps=t.getAttribute('data-part'),os=t.getAttribute('data-obs');
    if(id.indexOf('epcv_')===0&&SIMPLE.indexOf(id.slice(5))>=0){V[id.slice(5)]=t.value;showHide()}
    else if(ps||os){var a=(ps||os).split('.'),L=ps?V.parts:V.obs,it=L[+a[0]];if(!it)return;it[a[1]]=t.type==='checkbox'?t.checked:t.value;if(e.type==='change'&&(a[1]==='kind'||a[1]==='shape'))renderRows()}
    else return;
    saveVals();sched();
  }
  function sched(){clearTimeout(timer);timer=setTimeout(render,200)}
  function mount(){
    var sec=$('epc_p-survey');if(!sec||$('epcv'))return false;
    var st=document.createElement('style');
    st.textContent='#epcv .epcv-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}#epcv label{display:flex;flex-direction:column;gap:3px;font-size:12.5px}#epcv .epcv-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0;padding:6px;border:1px solid var(--line);border-radius:10px}#epcv .epcv-row input[type=text],#epcv .epcv-row input[type=number],#epcv .epcv-row select{width:110px;min-width:0}#epcv .epcv-use{flex-direction:row;align-items:center}';
    document.head.appendChild(st);
    var h='<div id="epcv"><h2>Roof survey: parts and panel count</h2><p class="ep-note">Type what the survey sheet shows: each roof part you can use and each obstacle, with positions measured from one corner of the sheet. Position X is measured to the right and Y upward on the sheet, in metres, to the lower-left corner of the part or obstacle. Heights are measured from one datum (the main terrace floor). Latitude, tilt, azimuth, module and gap come from Site, Auto Design and Layout.</p>'+
      '<div class="epcv-g"><label>Which way does the "Point South" arrow on the sheet point?<select id="epcv_top"><option value="">Select…</option><option value="down">Down (top of sheet = North)</option><option value="right">Right (top of sheet = East)</option><option value="up">Up (top of sheet = South)</option><option value="left">Left (top of sheet = West)</option><option value="other">Other angle…</option></select></label>'+
      '<label hidden>Compass bearing of the top of the sheet (°)<input id="epcv_topdeg" type="number" min="0" max="360" step="1" inputmode="decimal"></label>'+
      '<label>Modules up the slope per table<input id="epcv_rows" type="number" min="1" max="8" step="1" inputmode="numeric" placeholder="Required, e.g. 2"></label>'+
      '<label>Low-edge column height (mm)<input id="epcv_low" type="number" min="0" step="10" inputmode="decimal" placeholder="Required (1.5 ft = 457 mm)"></label>'+
      '<label>Edge setback (m)<input id="epcv_sb" type="number" min="0" step="0.05" inputmode="decimal" placeholder="Required"></label>'+
      '<label>Obstacle clearance (m)<input id="epcv_cl" type="number" min="0" step="0.05" inputmode="decimal" placeholder="Required"></label>'+
      '<label>Extra row gap (m)<input id="epcv_rg" type="number" min="0" step="0.05" inputmode="decimal"></label>'+
      '<label>Obstacle shadow rule<select id="epcv_shade"><option value="">Select…</option><option value="off">Clearance only (no shadow check)</option><option value="crit">Critical day, shade-free window of Shadow analysis</option><option value="custom">Chosen date and time window</option></select></label></div>'+
      '<div id="epcv_custom" class="epcv-g" hidden><label>Month (1–12)<input id="epcv_sm" type="number" min="1" max="12" step="1"></label><label>Day<input id="epcv_sd" type="number" min="1" max="31" step="1"></label><label>From (solar hour)<input id="epcv_sf" type="number" min="5" max="19" step="0.25"></label><label>To (solar hour)<input id="epcv_st" type="number" min="5" max="19" step="0.25"></label></div>'+
      '<div class="epcv-g"><label>Plan shadow date: month (1–12)<input id="epcv_pm" type="number" min="1" max="12" step="1" placeholder="e.g. 6"></label><label>Day<input id="epcv_pd" type="number" min="1" max="31" step="1" placeholder="e.g. 21"></label><label>Plan time (solar hour, 24 h)<input id="epcv_ph" type="number" min="5" max="19" step="0.25" placeholder="e.g. 10"></label></div>'+
      '<h3 style="margin:14px 0 4px;font-size:15px">Roof parts</h3><div id="epcv_parts"></div><button class="btn alt sm" type="button" id="epcv_addPart">+ Add part</button>'+
      '<h3 style="margin:14px 0 4px;font-size:15px">Obstacles and shadow casters</h3><div id="epcv_obs"></div><button class="btn alt sm" type="button" id="epcv_addObs">+ Add obstacle</button>'+
      '<h3 style="margin:14px 0 4px;font-size:15px">Result</h3><div id="epcv_out" aria-live="polite"></div></div>';
    sec.innerHTML=h;
    return true;
  }
  /* hooks for the sheet-trace page: add rows the same way the Add buttons do, read the current rows */
  window.EPCSurveyUI={
    addPart:function(o){V.parts.push({use:true,name:o.name,kind:o.kind||'table',x:String(o.x),y:String(o.y),w:String(o.w),d:String(o.d),level:String(o.level===undefined?0:o.level),dir:'',slope:''});saveVals();renderRows();sched()},
    addObs:function(o){V.obs.push({name:o.name,shape:o.shape||'rect',x:String(o.x),y:String(o.y),w:String(o.w),d:String(o.shape==='round'?o.w:o.d),h:String(o.h),base:String(o.base>0?o.base:0)});saveVals();renderRows();sched()},
    rows:function(){return JSON.parse(JSON.stringify({parts:V.parts,obs:V.obs}))},
    reload:function(){loadVals();sched()}
  };
  function init(){
    if(!window.EPCPlaceEngine||!window.EPCShadowEngine||!mount())return;
    var sec=$('epc_p-survey');
    loadVals();
    sec.addEventListener('input',onField);sec.addEventListener('change',onField);
    sec.addEventListener('click',function(e){
      var t=e.target;if(!t.getAttribute)return;
      if(t.id==='epcv_sstruct'){showSt=t.checked;render();return}
      if(t.id==='epcv_seethru'){hideMod=t.checked;render();return}
      if(t.id==='epcv_shrun'){runShade();return}
      if(t.id==='epcv_pkg'){printPackage();return}
      if(t.id==='epcv_shcsv'&&shd&&shd.state==='ok'){saveText('near-shading-hourly.csv',window.EPCShading.csvHourly(shd));return}
      if(t.id==='epcv_shfac'&&shd&&shd.state==='ok'&&last){saveText('near-shading-factor-table.csv',window.EPCShading.csvFactor(window.EPCShading.factorTable(last,lastInp,window.EPCSurvey,{}),lastInp.lat));return}
      if(t.getAttribute('data-iso')!==null){var dv=+t.getAttribute('data-iso');isoTheta=dv===0?ISOTH0:((isoTheta+dv)%360+360)%360;render()}
      else if(t.id==='epcv_addPart'){V.parts.push({use:true,name:'Part '+String.fromCharCode(65+V.parts.length%26),kind:'table',x:'',y:'',w:'',d:'',level:'0',dir:'',slope:''});renderRows();saveVals();sched()}
      else if(t.id==='epcv_addObs'){V.obs.push({name:'Obstacle '+(V.obs.length+1),shape:'rect',x:'',y:'',w:'',d:'',h:''});renderRows();saveVals();sched()}
      else if(t.getAttribute('data-delpart')!==null){V.parts.splice(+t.getAttribute('data-delpart'),1);renderRows();saveVals();sched()}
      else if(t.getAttribute('data-delobs')!==null){V.obs.splice(+t.getAttribute('data-delobs'),1);renderRows();saveVals();sched()}
    });
    var root=$('epcRoot')||document;
    root.addEventListener('input',function(e){var t=e.target;if(!t||sec.contains(t))return;if(t.id==='engSite')saveVals();sched()},true);
    root.addEventListener('change',function(e){if(!sec.contains(e.target))sched()},true);
    document.addEventListener('epc:linked',sched);
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadVals();sched()},70)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){loadVals();sched()},160)})});
    render();
  }
  window.EPCSurvey.state=function(){return last};
  function boot(){setTimeout(init,120)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
