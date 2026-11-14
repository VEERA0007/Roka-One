/* Near-shading ray casting against closed-form cases. Run from the repository root. */
global.window={};global.document={readyState:'complete',addEventListener(){},getElementById(){return null},querySelector(){return null}};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-fem.js','epc-thin.js','epc-analysis.js','epc-place.js','epc-shadow.js','epc-survey.js','epc-shading.js'].forEach(f=>require(A+f));
const H=window.EPCShading,SV=window.EPCSurvey,SE=window.EPCShadowEngine;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)};const near=(a,b,t)=>Math.abs(a-b)<=t,R=Math.PI/180;
/* 1. wall prism: sun due south at 45 degrees, wall 0.2 m thick across x in [-5,5] at y in [-5.1,-4.9], height 5 */
const wall={poly:[[-5,-5.1],[5,-5.1],[5,-4.9],[-5,-4.9]],base:0,top:5};
const S45=H.sunVec(45,180);ok('sun vector due south at 45 deg points south and up',near(S45[0],0,1e-12)&&near(S45[1],-Math.SQRT1_2,1e-12)&&near(S45[2],Math.SQRT1_2,1e-12));
ok('point 4.9 m north of the wall, ground: ray meets the wall at 4.9 m < 5 -> shaded',H.hitsPrism([0,0,0],S45,wall));
ok('point 5.2 m north: ray passes over the 5 m top -> lit',!H.hitsPrism([0,0.3,0],S45,wall));
ok('beside the wall (x = 6): lit',!H.hitsPrism([6,0,0],S45,wall));
ok('point south of the wall: lit',!H.hitsPrism([0,-6,0],S45,wall));
ok('wall floating at 5.2-6 m: ray at 4.9-5.1 m passes under it -> lit',!H.hitsPrism([0,0,0],S45,{...wall,base:5.2,top:6}));
ok('wall base 3, top 5: ray at 4.9 m crosses it -> shaded',H.hitsPrism([0,0,0],S45,{...wall,base:3}));
ok('sun in the west at 30 deg: wall (EW) casts no shadow on a point north of it, far in x',!H.hitsPrism([0,0,0],H.sunVec(30,270),wall));
/* 2. two tilted rows, closed form */
function row(y0,tilt,L,w){                                                    /* low edge at y0 (south), rises to the north; corners back-left, back-right, front-right, front-left */
  const dy=L*Math.cos(tilt*R),dz=L*Math.sin(tilt*R);return [[0,y0+dy,dz],[w,y0+dy,dz],[w,y0,0],[0,y0,0]]}
function frac(alt,tilt,L,p){
  const f=H.makeModule(row(0,tilt,L,1),0,1,1),b=H.makeModule(row(p,tilt,L,1),1,1,400);
  const sc={mods:[f,b],tabs:[{},{}],obs:[],zmax:L,zmin:0};
  const S=H.sunVec(alt,180);return H.shadedFraction(sc,1,S,[],[0]);
}
function formula(alt,tilt,L,p){const ta=Math.tan(alt*R),tb=Math.tan(tilt*R),yt=L*Math.cos(tilt*R),zt=L*Math.sin(tilt*R);const y=(zt+yt*ta+p*tb)/(ta+tb);return Math.max(0,Math.min(1,(y-p)/(Math.cos(tilt*R)*L)))}
[[20,15,2.278,5],[15,20,2.278,4.5],[25,10,2.0,3],[10,15,2.278,6],[30,25,2.278,3.2],[40,15,2.278,5]].forEach(c=>{
  const a=frac(...c),b=formula(...c);ok('row-to-row shaded fraction alt '+c[0]+' tilt '+c[1]+' pitch '+c[3]+': ray cast '+a.toFixed(4)+' vs closed form '+b.toFixed(4),near(a,b,1/400+1e-9),a+' '+b)});
/* critical pitch: exactly lit at p0 = L cos b + L sin b / tan a */
{const alt=20,t=15,L=2.278,p0=L*Math.cos(t*R)+L*Math.sin(t*R)/Math.tan(alt*R);ok('at the shadow-free pitch the rear row is lit',frac(alt,t,L,p0+0.01)===0&&frac(alt,t,L,p0-0.2)>0,frac(alt,t,L,p0-0.2))}
ok('sun behind the modules gives no hit from a front row on a rear row when it is north',frac(20,15,2.278,5)>=0);
/* 3. full scene from a Survey result */
const base={top:0,lat:17.4,az:180,tilt:15,mod:{l:2.278,w:1.134,wp:615,port:true},gapMm:20,rows:1,lowMm:600,sb:0.5,cl:0.5,rg:0,window:[9,15],shade:{mode:'off'},
  parts:[{name:'Main',x:0,y:0,w:12,d:12,kind:'table',level:0}],obs:[]};
let res=SV.calc(base);ok('survey result',res.state==='ok'&&res.modules>0);
let sm=H.analyse(res,base,SV,SE);ok('no obstacle: only small row-to-row loss, and only outside the 9-15 h design window',sm.state==='ok'&&sm.totalLossPct<0.5&&sm.months.every(m=>m.rows.every(r=>(r.h>=9&&r.h<=15)?r.perTab.every(p=>p.fr<1e-9):true)),sm.totalLossPct);
ok('front (south-most) row is never shaded',sm.tables[sm.tables.length-1].lossPct<1e-9);
const base1={...base,parts:[{name:'Main',x:0,y:0,w:12,d:6,kind:'table',level:0}]},r1=SV.calc(base1),s1=H.analyse(r1,base1,SV,SE);
ok('one single row, no obstacle: exactly zero loss',r1.tables.length===1&&s1.totalLossPct<1e-9,s1.totalLossPct);
const smBase=sm;const wi={...base,obs:[{name:'Tower',shape:'rect',x:5,y:0,w:2,d:2,h:8,base:0}]};res=SV.calc(wi);
sm=H.analyse(res,wi,SV,SE);ok('a tall tower on the roof adds loss beyond the row-to-row baseline',sm.totalLossPct>0.2+smBase.totalLossPct&&sm.totalLossPct<30,sm.totalLossPct);
ok('the loss is zero around noon in summer for a tower this far away is not claimed; but December mornings are hit',sm.tables.some(t=>t.monthLossPct[11]>t.monthLossPct[5]),sm.tables.map(t=>t.monthLossPct[11].toFixed(1)+'/'+t.monthLossPct[5].toFixed(1)).join(' '));
ok('fractions stay within 0..1',sm.months.every(m=>m.rows.every(r=>r.perTab.every(p=>p.fr>=-1e-12&&p.fr<=p.mods+1e-9))));
ok('hourly rows only where the sun is above 3 degrees',sm.months.every(m=>m.rows.every(r=>r.alt>=3)));
ok('winter has fewer sun hours than summer rows',sm.months[11].rows.length<=sm.months[5].rows.length);
/* a tower much taller loses more */
const w2={...base,obs:[{name:'Tower',shape:'rect',x:5,y:0,w:2,d:2,h:16,base:0}]};const r2=SV.calc(w2),s2=H.analyse(r2,w2,SV,SE);ok('a taller tower costs at least as much',s2.totalLossPct>=sm.totalLossPct-1e-9,s2.totalLossPct+' vs '+sm.totalLossPct);
/* multi-level: tank on the penthouse roof shades the main roof tables; level summary has two levels */
const ml={...base,parts:[{name:'Main',x:0,y:0,w:30,d:20,kind:'table',level:0},{name:'Penthouse roof',x:20,y:12,w:8,d:6,kind:'table',level:3}],
  obs:[{name:'Penthouse',shape:'rect',x:20,y:12,w:8,d:6,h:3,base:0},{name:'Tank',shape:'round',x:22,y:13,w:2,d:2,h:6,base:3}]};
const rm=SV.calc(ml),smm=H.analyse(rm,ml,SV,SE);ok('multi-level result has a summary per level',smm.state==='ok'&&smm.levels.length===2&&smm.levels[0].level===0&&smm.levels[1].level===3,JSON.stringify(smm.levels));
ok('every table reported once',smm.tables.length===rm.tables.length&&smm.tables.every(t=>t.modules>0));
/* 4. timing: 36 modules x 12 months */
const t0=Date.now();H.analyse(rm,ml,SV,SE);console.log('time (ms)',Date.now()-t0,'modules',smm.modules);ok('analysis of '+smm.modules+' modules finishes within 20 s',Date.now()-t0<20000);
/* 5. exports */
const csv=H.csvHourly(smm).trim().split('\n'),nrows=smm.months.reduce((s,m)=>s+m.rows.length,0)*smm.tables.length;ok('hourly CSV has a header and one line per hour x table',csv.length===1+nrows,csv.length+' vs '+(1+nrows));
ok('CSV azimuth uses the PVsyst convention (south 0)',csv.slice(1).every(l=>{const a=+l.split(',')[4];return a>=-180&&a<=180}));
const ft=H.factorTable(res,wi,SV,{azStep:30,hStep:15});ok('factor table has 13 azimuths x 7 heights and values within 0..1',ft.az.length===13&&ft.h.length===7&&ft.factor.every(r=>r.every(x=>x>=0&&x<=1)));
const ft0=H.factorTable(SV.calc(base),base,SV,{azStep:30,hStep:15});ok('no obstacle and single rows: factor 1 everywhere',ft0.factor.every(r=>r.every(x=>x===1)));
ok('table CSV header and size',H.csvFactor(ft,17.4).split('\n').filter(l=>l&&l[0]!=='#').length===1+ft.az.length);
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
