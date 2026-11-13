/* Longitudinal (along-row) wind: load value and equilibrium. Run from the repository root. */
global.window={};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-fem.js','epc-thin.js','epc-analysis.js'].forEach(f=>require(A+f));
const F=window.EPCFem,E=window.EPCAnalysisEngine;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-12,Math.abs(b));
const S={blocks:[{name:'t',rows:2,perRow:9,low:1000}],module:{len:2278,wid:1134,orient:'portrait'},tilt:15,gap:20,rafterOvh:75,purlinOvh:75,frameSpacing:2000,colSpacingH:1500,colInset:100};
const c=E.geometry(S,0),sec=(b,h,t)=>F.rhs(b/1000,h/1000,t/1000);
[false,true].forEach(fixed=>{
  const wx=0.45,s=2;
  const P={pur:sec(60,40,2),raf:sec(100,50,2.5),col:sec(80,80,3),brc:sec(40,40,2),tie:sec(40,40,2),fixed,tieFrac:.6,brcFrac:.5,s,dead:.15,live:.75,wd:1.2,wu:1.5,wx};
  const B=E.build(c,P),m=B.model;
  ok('WLx case exists',!!m.cases.WLx);
  let tot=0,n=0;B.mem.forEach((x,mi)=>{if(x.kind==='purlin'){const l=m.cases.WLx.udl[mi];if(!(l[0]===wx*s&&l[1]===0&&l[2]===0))ok('purlin load is horizontal along X',false,l);const mm=m.members[mi],pa=m.nodes[mm.a],pb=m.nodes[mm.b];tot+=l[0]*Math.hypot(pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2]);n++}});
  ok('purlins carry the load',n>0,n);
  const r=F.solve(m);
  ok('solves',!r.error,r.error);
  let rx=0;Object.values(r.cases.WLx.reactions).forEach(v=>rx+=v[0]);
  ok((fixed?'fixed':'pinned')+' base: sum of Fx reactions = -applied load',rel(-rx,tot)<1e-6,rx+' vs '+(-tot));
});
const a=E.ULS.map(x=>x.name);
ok('eight ULS combinations',a.length===8,a.join(' | '));
ok('both directions present',a.filter(x=>/\+X/.test(x)).length===2&&a.filter(x=>/-X/.test(x)).length===2);
ok('SLS has along-row cases appended after the original three',E.SLS.length===5&&E.SLS[1].name==='DL+WL(down)');
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
