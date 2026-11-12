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
console.log(fail?'\n'+fail+' FAILED':'\nall survey checks passed');process.exit(fail?1:0);
