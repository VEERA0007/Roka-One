/* Survey engine: frames, shadow-free table placement, obstacle shadows, flush parts, Layout blocks, and the zero-setback fix
   in the shared placement code. Expected values are worked out here independently of the engine. Run from the repository root. */
global.window={};global.document={readyState:'complete',addEventListener(){},getElementById(){return null},querySelector(){return null}};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-map.js','epc-place.js','epc-shadow.js','epc-survey.js'].forEach(f=>{try{require(A+f)}catch(e){if(f==='epc-map.js')return;throw e}});
const S=window.EPCSurvey,P=window.EPCPlaceEngine,E=window.EPCShadowEngine;
let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)};
const near=(a,b,t)=>Math.abs(a-b)<=t,R=Math.PI/180;

/* 1 frames: sheet up = north when top=0; "South arrow points right" means top=East */
let p=S.sheetToEN([0,1],0);ok('top=0: sheet up is north',near(p[0],0,1e-12)&&near(p[1],1,1e-12));
p=S.sheetToEN([0,1],90);ok('top=90: sheet up is east',near(p[0],1,1e-12)&&near(p[1],0,1e-12));
p=S.sheetToEN([1,0],90);ok('top=90: sheet right is south',near(p[0],0,1e-12)&&near(p[1],-1,1e-12));
p=S.sheetToEN([1,0],0);ok('top=0: sheet right is east',near(p[0],1,1e-12));
[0,37,90,200].forEach(t=>[0,180,215].forEach(a=>{const q=[3.3,-2.1],b=S.enToSheet(S.stToEN(S.enToST(S.sheetToEN(q,t),a),a),t);ok('round trip top '+t+' az '+a,near(b[0],q[0],1e-9)&&near(b[1],q[1],1e-9))}));
let st=S.enToST([0,-1],180);ok('array facing south: south is +t',near(st[0],0,1e-12)&&near(st[1],1,1e-12),st);

/* 2 table count against a hand calculation (aligned rectangle) */
const LAT=17.4,base=()=>({top:0,lat:LAT,az:180,tilt:15,mod:{l:2.278,w:1.134,wp:615,port:true},gapMm:20,rows:2,lowMm:457,sb:0.5,cl:0.5,rg:0,window:[9,15],
  shade:{mode:'off'},parts:[{name:'A',x:0,y:0,w:12,d:20,kind:'table',level:0}],obs:[]});
function pitchHand(depth,tilt,az){ /* worst shadow reach on 21 Dec, 9 to 15 h, 15 min steps, from the sun position formulas */
  const n=355,d=-23.45*Math.cos(2*Math.PI*(n+10)/365)*0+23.45*Math.sin(R*360*(284+n)/365);let w=0;
  for(let h=9;h<=15+1e-9;h+=.25){const dd=d*R,ph=LAT*R,H=(h-12)*15*R;const sa=Math.sin(ph)*Math.sin(dd)+Math.cos(ph)*Math.cos(dd)*Math.cos(H),al=Math.asin(sa);
    if(al*180/Math.PI<=.5)continue;let c=(Math.sin(dd)-sa*Math.sin(ph))/(Math.cos(al)*Math.cos(ph));c=Math.max(-1,Math.min(1,c));let a=Math.acos(c)/R;if(H>0)a=360-a;
    w=Math.max(w,depth*Math.sin(tilt*R)/Math.tan(al)*Math.cos((a-az)*R))}
  return depth*Math.cos(tilt*R)+w}
let r=S.calc(base());
const depth=2*2.278+0.02,dPlan=depth*Math.cos(15*R),pit=pitchHand(depth,15,180);
ok('row pitch equals hand value',near(r.pitch,pit,1e-6),r.pitch+' vs '+pit);
const nAcross=Math.floor((11+0.02)/(1.134+0.02)+1e-9),bands=Math.floor((19-dPlan)/pit+1e-9)+1;
ok('count = 2 rows x per-row x bands',r.modules===2*nAcross*bands,r.modules+' vs '+2*nAcross*bands+' ('+nAcross+' x '+bands+')');
ok('tables: one per band, '+nAcross+' per row',r.tables.length===bands&&r.tables.every(t=>t.perRow===nAcross&&t.rows===2),JSON.stringify(r.tables.map(t=>t.perRow)));
ok('kWp = modules x Wp',near(r.kwp,r.modules*0.615,1e-9),r.kwp);

/* 3 geometry check: every module inside its part and clear of obstacles, rotated sheet and odd azimuth, zero setback and clearance */
function inPoly(pt,poly){return P.inPoly(pt,poly)}
function checkInside(res,parts,obs,label){
  let bad=0,n=0;
  res.parts.forEach((rp,pi)=>{const pr=parts[pi],poly=[[pr.x,pr.y],[pr.x+pr.w,pr.y],[pr.x+pr.w,pr.y+pr.d],[pr.x,pr.y+pr.d]];
    rp.tables.forEach(t=>t.cells.forEach(c=>{n++;for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
      const a=[c[0][0]+(c[1][0]-c[0][0])*i/8+(c[3][0]-c[0][0])*j/8,c[0][1]+(c[1][1]-c[0][1])*i/8+(c[3][1]-c[0][1])*j/8];
      const e=1e-6,cx=(c[0][0]+c[2][0])/2,cy=(c[0][1]+c[2][1])/2,a2=[a[0]+(cx-a[0])*e*100,a[1]+(cy-a[1])*e*100];
      if(!inPoly(a2,poly)){bad++;return}
      for(const o of obs)if(inPoly(a2,o)){bad++;return}}}))});
  ok(label+' ('+n+' modules, none outside the part or inside an obstacle)',bad===0&&n>0,bad+' bad');
}
let i2=base();i2.top=33;i2.az=207;i2.sb=0;i2.cl=0;i2.parts=[{name:'A',x:1.3,y:0.7,w:13.7,d:17.9,kind:'table',level:0}];
i2.obs=[{name:'tank',shape:'box',x:6.1,y:5.3,w:2.1,d:1.7,h:1.0}];
r=S.calc(i2);checkInside(r,i2.parts,[S.obstaclePoly(i2.obs[0])],'rotated 33 deg, azimuth 207, setback 0');
/* shared placement: zero setback fix */
const trap=[[0.13,0.21],[9.77,0.21],[9.77,3.37],[0.13,6.91]],m0=P.fit(trap,[],{w:1.13,d:1.7,gap:.02,pitch:1.9,setback:0,clear:0});
let out=0;m0.forEach(([s,t])=>{for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){if(!P.inPoly([s+1.13*i/10+(i==0?1e-6:i==10?-1e-6:0),t+1.7*j/10+(j==0?1e-6:j==10?-1e-6:0)],trap)){out++;return}}});
ok('placement at zero setback keeps modules inside (was overhanging)',out===0&&m0.length>0,out);

/* 4 obstacle shadow: tip position by hand */
let i4=base();i4.parts=[{name:'A',x:0,y:0,w:30,d:30,kind:'table',level:0}];i4.rows=1;i4.lowMm=0;
i4.obs=[{name:'tower',shape:'box',x:14,y:14,w:2,d:2,h:6}];i4.shade={mode:'custom',m:6,d:21,from:10,to:10};
r=S.calc(i4);
const sp=E.sunPos(LAT,E.dayOfYear(5,21),10),L=6/Math.tan(sp.alt*R),tip=[15-L*Math.sin(sp.az*R),15-L*Math.cos(sp.az*R)];
const z=r.parts[0].zones[0];
ok('one shadow zone for the tower',r.parts[0].zones.length===1);
ok('shadow zone contains the tower footprint',[[14,14],[16,14],[16,16],[14,16]].every(q=>inPoly([q[0]*.999+15*.001,q[1]*.999+15*.001],z)));
ok('shadow zone reaches the hand-calculated tip (21 Jun 10:00, alt '+sp.alt.toFixed(1)+', reach '+L.toFixed(2)+' m)',inPoly([tip[0]*.99+15*.01,tip[1]*.99+15*.01],z),JSON.stringify(tip));
ok('shadow zone does not go beyond reach on the sun side',!inPoly([15+L*Math.sin(sp.az*R),15+L*Math.cos(sp.az*R)],z));
/* modules never overlap the shadow zone */
let ov=0;r.tables.forEach(t=>t.cells.forEach(c=>{const cx=(c[0][0]+c[2][0])/2,cy=(c[0][1]+c[2][1])/2;if(inPoly([cx,cy],z))ov++}));
ok('no module centre inside the shadow zone',ov===0);
const rOff=S.calc(Object.assign(base(),{parts:i4.parts,rows:1,lowMm:0,obs:i4.obs,shade:{mode:'off'}}));
ok('shadow rule removes modules compared with clearance only',rOff.modules>r.modules,rOff.modules+' > '+r.modules);
/* obstacle lower than the module low edge casts no shadow on it */
let i4b=JSON.parse(JSON.stringify(i4));i4b.lowMm=7000;r=S.calc(i4b);ok('obstacle below the module low edge has no shadow zone',r.parts[0].zones.length===0);
/* crit mode uses the winter solstice */
let i4c=JSON.parse(JSON.stringify(i4));i4c.shade={mode:'crit'};r=S.calc(i4c);ok('critical-day rule uses day '+E.criticalDay(LAT),r.shadow.day===E.criticalDay(LAT)&&r.shadow.from===9&&r.shadow.to===15);

/* 5 flush part: plane stretched by 1/cos(slope), counted by hand */
let i5=base();i5.parts=[{name:'Shed',x:0,y:0,w:10,d:6,kind:'flush',dir:'down',slope:10,level:0}];i5.sb=0.3;i5.cl=0.3;
r=S.calc(i5);const c10=Math.cos(10*R),nA=Math.floor((10-.6+.02)/(1.134+.02)+1e-9),nB=Math.floor((6/c10-.6+.02)/(2.278+.02)+1e-9);
ok('flush count = across x along (plane '+(6/c10).toFixed(3)+' m)',r.parts[0].modules===nA*nB,r.parts[0].modules+' vs '+nA*nB);
ok('flush facing: roof falling toward sheet-down with top=0 faces south (180)',near(r.parts[0].facing,180,1e-9),r.parts[0].facing);
i5.top=90;r=S.calc(i5);ok('flush facing with sheet top = east: sheet-down is west (270)',near(r.parts[0].facing,270,1e-9),r.parts[0].facing);
ok('flush parts send no blocks',S.layoutBlocks(r,457).error!==undefined);

/* 6 locks: each missing input is named, nothing is guessed */
let m=base();m.top=NaN;m.rows=NaN;m.shade={mode:''};m.sb=NaN;r=S.calc(m);
ok('missing inputs listed',r.state==='missing'&&r.missing.some(x=>/sheet top/.test(x))&&r.missing.some(x=>/per table/.test(x))&&r.missing.some(x=>/shadow rule/.test(x))&&r.missing.some(x=>/setback/.test(x)),r.missing);
m=base();m.parts=[];r=S.calc(m);ok('no parts is a lock',r.state==='missing');
m=base();m.parts=[{name:'x',x:0,y:0,w:0,d:5,kind:'table'}];r=S.calc(m);ok('zero width part is a lock',r.state==='missing');

/* 7 Layout blocks: one per table, low edge carried, cap enforced */
r=S.calc(base());let lb=S.layoutBlocks(r,457);
ok('one Layout block per table with rows, per-row and low edge',lb.blocks&&lb.blocks.length===r.tables.length&&lb.blocks.every(b=>b.rows===2&&b.perRow===nAcross&&b.low===457),JSON.stringify(lb).slice(0,160));
ok('block modules add up to the survey count',lb.blocks.reduce((a,b)=>a+b.rows*b.perRow,0)===r.modules);
const fake={state:'ok',tables:new Array(31).fill({name:'t',rows:2,perRow:3})};ok('more than 30 tables refused',!!S.layoutBlocks(fake,457).error);

/* 8 hull */
const h=S.hull([[0,0],[1,0],[1,1],[0,1],[.5,.5]]);ok('hull of a square with an inner point has 4 vertices',h.length===4);

/* 9 plan with shadows at a chosen date and time */
let sx=S.stampText({m:6,d:21,h:10});ok('stamp 21 JUNE 10:00 AM',sx.date==='21 JUNE'&&sx.time==='10:00 AM',JSON.stringify(sx));
sx=S.stampText({m:12,d:5,h:15.5});ok('stamp 5 DECEMBER 3:30 PM',sx.date==='5 DECEMBER'&&sx.time==='3:30 PM');
sx=S.stampText({m:3,d:1,h:12});ok('stamp noon is 12:00 PM',sx.time==='12:00 PM');
const sq=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w]];
ok('overlapping squares overlap',S.convexOverlap(sq(0,0,2),sq(1,1,2)));
ok('touching squares do not overlap',!S.convexOverlap(sq(0,0,2),sq(2,0,2)));
ok('separate squares do not overlap',!S.convexOverlap(sq(0,0,1),sq(3,3,1)));
ok('rotated diamond clear of a square corner',!S.convexOverlap([[0,0],[2,0],[2,2],[0,2]],[[2.9,1],[3.9,0],[4.9,1],[3.9,2]])&&S.convexOverlap([[0,0],[2,0],[2,2],[0,2]],[[1.9,1],[2.9,0],[3.9,1],[2.9,2]]));
let i9=base();i9.parts=[{name:'A',x:0,y:0,w:30,d:30,kind:'table',level:0}];i9.rows=1;i9.lowMm=0;i9.sb=0.3;i9.cl=0.3;
i9.obs=[{name:'tower',shape:'box',x:14,y:20,w:2,d:2,h:6}];
r=S.calc(i9);
const W9={m:12,d:21,h:9},ps=S.planShade(r,i9,W9);
const sp9=E.sunPos(LAT,E.dayOfYear(11,21),9),L9=6/Math.tan(sp9.alt*R),sh=[-L9*Math.sin(sp9.az*R),-L9*Math.cos(sp9.az*R)];
const base9=[[14,20],[16,20],[16,22],[14,22]],hullHand=S.hull(base9.concat(base9.map(q=>[q[0]+sh[0],q[1]+sh[1]])));
ok('plan state ok, sun altitude '+sp9.alt.toFixed(1),ps.state==='ok'&&near(ps.sun.alt,sp9.alt,1e-9));
let hand=0;r.tables.forEach(t=>t.cells.forEach(c=>{let hit=false;for(let i=0;i<=14&&!hit;i++)for(let j=0;j<=14&&!hit;j++){
  const u=(i+.5)/15,v=(j+.5)/15,a=[c[0][0]+(c[1][0]-c[0][0])*u+(c[3][0]-c[0][0])*v,c[0][1]+(c[1][1]-c[0][1])*u+(c[3][1]-c[0][1])*v];if(P.inPoly(a,hullHand))hit=true}if(hit)hand++}));
ok('shaded module count matches an independent point-sampling count',ps.shaded===hand&&hand>0,ps.shaded+' vs '+hand);
ok('shaded <= total and total equals the table modules',ps.shaded<=ps.total&&ps.total===r.tableModules);
const night=S.planShade(r,i9,{m:12,d:21,h:5});ok('night: no shadows and nothing shaded',night.night&&night.shaded===0&&night.shadows.length===0);
ok('missing date or time is a lock',S.planShade(r,i9,{m:13,d:1,h:10}).state==='missing'&&S.planShade(r,i9,{m:6,d:31,h:10}).state==='missing'&&S.planShade(r,i9,{m:6,d:21,h:NaN}).state==='missing');
i9.lowMm=7000;r=S.calc(i9);ok('obstacle below the module low edge shades no module',S.planShade(r,i9,W9).shaded===0);

/* 10 isometric model */
let pj=S.project([0,0,0],0,32),pz=S.project([0,0,1],0,32);
ok('a point 1 m higher appears cos(el) higher on screen',near(pj.y-pz.y,Math.cos(32*R),1e-12)&&near(pj.x,pz.x,1e-12));
let pf=S.project([0,5,0],0,32);ok('sheet-up is farther from the viewer at view angle 0',pf.d>pj.d&&pf.y<pj.y);
let pr=S.project([4,0,0],90,32);ok('view rotated 90 deg: sheet-right becomes depth',near(pr.x,0,1e-9)&&near(pr.d,-4,1e-9),JSON.stringify(pr));
let iA=base();iA.parts=[{name:'A',x:0,y:0,w:12,d:20,kind:'table',level:0}];iA.obs=[{name:'box',shape:'box',x:4,y:9,w:2,d:2,h:3}];iA.lowMm=1000;
r=S.calc(iA);
const t0=r.tables[0],dS9=2.278,sinT=Math.sin(15*R);
ok('first row: back edge is the table top, front edge is lower by one module slope',near(t0.cellZ[0][0],t0.zBack,1e-12)&&near(t0.cellZ[0][0]-t0.cellZ[0][1],dS9*sinT,1e-9));
ok('table low edge height equals the low-edge input',near(t0.zFront,1.0,1e-12)&&near(t0.cellZ[t0.cellZ.length-1][1],1.0,1e-9),t0.cellZ[t0.cellZ.length-1][1]);
ok('table top height = low edge + slant depth x sin(tilt)',near(t0.zBack,1.0+(2*dS9+.02)*sinT,1e-9),t0.zBack);
const mo=S.isoModel(r,iA,null,0,32),nm=mo.faces.filter(f=>f.kind==='module').length;
ok('one drawn quad per module',nm===r.modules,nm+' vs '+r.modules);
ok('box obstacle has 4 sides and a top',mo.faces.filter(f=>f.kind==='obsSide').length===4&&mo.faces.filter(f=>f.kind==='obsTop').length===1);
let sorted=true;for(let i=1;i<mo.faces.length;i++)if(mo.faces[i].depth>mo.faces[i-1].depth+1e-12)sorted=false;
ok('faces are sorted far to near',sorted);
ok('module quads are tilted (corner heights differ across the slope)',mo.faces.filter(f=>f.kind==='module').every(f=>f.pts[0][2]>f.pts[2][2]));
ok('every post goes from the roof to the table edge height',mo.lines.length===4*r.tables.length&&mo.lines.every(l=>l.pts[0][2]===0&&l.pts[1][2]>=1.0-1e-9));

/* 8 multi-level roof: penthouse on the 5th-floor roof, tank on the penthouse roof, lift room above it */
{
  const B=()=>Object.assign(base(),{shade:{mode:'off'},sb:0.3,cl:0.3,lowMm:300,rows:1,parts:[{name:'Main',x:0,y:0,w:30,d:20,kind:'table',level:0},{name:'Penthouse roof',x:0,y:0,w:8,d:8,kind:'table',level:3}],
    obs:[{name:'Penthouse',shape:'rect',x:0,y:0,w:8,d:8,h:3,base:0},{name:'Tank',shape:'round',x:5,y:5,w:2,d:2,h:5,base:3}]});
  const i=B(),r=S.calc(i);ok('multi-level inputs are accepted',r.state==='ok',JSON.stringify(r.missing));
  const main=r.parts[0],pent=r.parts[1];
  const inRect=(c,x0,y0,x1,y1)=>c.every(q=>q[0]>x0-1e-9&&q[0]<x1+1e-9&&q[1]>y0-1e-9&&q[1]<y1+1e-9);
  const overl=(c,x0,y0,x1,y1)=>c.some(q=>q[0]>x0+1e-6&&q[0]<x1-1e-6&&q[1]>y0+1e-6&&q[1]<y1-1e-6);
  let bad=0;main.tables.forEach(t=>t.cells.forEach(c=>{if(overl(c,0,0,8,8))bad++}));ok('main roof: no module inside the penthouse footprint (it stands on that level)',bad===0&&main.modules>0,bad);
  ok('penthouse roof is not blocked by the penthouse that carries it',pent.modules>0,pent.modules);
  bad=0;pent.tables.forEach(t=>t.cells.forEach(c=>{if(!inRect(c,0,0,8,8)||overl(c,5,5,7,7))bad++}));ok('penthouse roof: modules inside its roof and clear of the tank',bad===0,bad);
  ok('level semantics: penthouse (top 3) does not block a level-3 roof, blocks level 0',!S.blocksLevel({h:3,base:0},3)&&S.blocksLevel({h:3,base:0},0));
  ok('tank on the penthouse roof (base 3, top 5) blocks the level-3 roof, not the main roof',S.blocksLevel({h:5,base:3},3)&&!S.blocksLevel({h:5,base:3},0));
  ok('keep-out area (h = 0) blocks every level',S.blocksLevel({h:0},0)&&S.blocksLevel({h:0},7));
  /* back-compat: an obstacle without base behaves as before on level 0 */
  const j=Object.assign(base(),{shade:{mode:'off'},obs:[{name:'Box',shape:'rect',x:4,y:4,w:3,d:3,h:2}]});const rj=S.calc(j);let bb=0;rj.parts[0].tables.forEach(t=>t.cells.forEach(c=>{if(overl(c,4,4,7,7))bb++}));ok('obstacle without a base still keeps modules out',bb===0&&rj.modules>0);
  /* invalid base */
  const k=B();k.obs[1].base=5;ok('base not below the top is refused',S.calc(k).state==='missing');
  /* shadow of a floating body: tank bottom at 3, top 5, plane at 0.3 -> shadow starts at displacement of the base */
  const sun={alt:45,az:180};const poly=[[0,0],[2,0],[2,2],[0,2]];
  const z=S.shadowHull(poly,5-0.3,[sun],3-0.3);const ys=z.map(q=>q[1]);
  ok('floating body: shadow reaches north by (top-plane)/tan(alt) and starts at (base-plane)/tan(alt)',near(Math.max(...ys),2+4.7,1e-9)&&near(Math.min(...ys),2.7,1e-9),Math.min(...ys)+' '+Math.max(...ys));
  const g=S.shadowHull(poly,2,[sun],0);ok('body on the plane: footprint is part of the zone',near(Math.min(...g.map(q=>q[1])),0,1e-9));
  /* plan shadows and iso keep working with a base */
  i.shade={mode:'off'};const ps=S.planShade(r,i,{m:12,d:21,h:11});ok('plan shadow with a floating tank',ps.state==='ok'&&ps.shadows.length===2,ps.state);
  const iso=S.isoModel(r,i,ps,335,45);const tankTop=iso.faces.find(f=>f.kind==='obsTop'&&f.name==='Tank');ok('3D: tank top at 5 m, side faces start at 3 m',!!tankTop&&tankTop.pts.every(q=>q[2]===5)&&iso.faces.some(f=>f.kind==='obsSide'&&f.pts.some(q=>q[2]===3)));
}
console.log(fail?'\n'+fail+' FAILED':'\nall survey checks passed');process.exit(fail?1:0);
