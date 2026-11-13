/* STAAD export: parse the generated .std back and compare with the analysed model. Run from the repository root. */
global.window={};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-fem.js','epc-thin.js','epc-analysis.js','epc-staad.js'].forEach(f=>require(A+f));
const F=window.EPCFem,E=window.EPCAnalysisEngine;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};
const S={blocks:[{name:'t',rows:2,perRow:9,low:1000}],module:{len:2278,wid:1134,orient:'portrait'},tilt:15,gap:20,rafterOvh:75,purlinOvh:75,frameSpacing:2000,colSpacingH:1500,colInset:100};
const c=E.geometry(S,0),sec=(b,h,t)=>F.rhs(b/1000,h/1000,t/1000);
[false,true].forEach(fixed=>{
  const P={pur:sec(60,40,2),raf:sec(100,50,2.5),col:sec(80,80,3),brc:sec(40,40,2),tie:sec(40,40,2),fixed,tieFrac:.6,brcFrac:.5,s:2,dead:.15,live:.75,wd:1.2,wu:1.5,wx:.45};
  const txt=window.EPCStaad.build({c,P,ULS:E.ULS,SLS:E.SLS},'Test block / 1');
  const B=E.build(c,P),m=B.model;
  const L=txt.split('\n');ok('no line exceeds 79 columns',L.every(l=>l.length<=79),L.find(l=>l.length>79));
  ok('header and trailer',L[0]==='STAAD SPACE Test block 1'&&L.includes('SET Z UP')&&L.includes('PERFORM ANALYSIS')&&L[L.length-2]==='FINISH');
  const sect=(h,stop)=>{const i=L.indexOf(h);let j=i+1;while(j<L.length&&!stop.test(L[j]))j++;return L.slice(i+1,j)};
  const jc=sect('JOINT COORDINATES',/^[A-Z]/);ok('joint count',jc.length===m.nodes.length,jc.length);
  let bad=0;jc.forEach((l,k)=>{const t=l.replace(';','').split(' ').map(Number);const p=m.nodes[k];if(t[0]!==k+1||Math.abs(t[1]-p[0])>1e-6||Math.abs(t[2]-p[1])>1e-6||Math.abs(t[3]-p[2])>1e-6)bad++});ok('joint coordinates match',bad===0,bad);
  const mi=sect('MEMBER INCIDENCES',/^[A-Z]/);ok('member count',mi.length===m.members.length,mi.length);
  bad=0;mi.forEach((l,k)=>{const t=l.replace(';','').split(' ').map(Number);if(t[1]!==m.members[k].a+1||t[2]!==m.members[k].b+1)bad++});ok('incidences match',bad===0);
  /* truss list (continuation lines end with '-') */
  const join=a=>a.join(' ').replace(/ - /g,' ');
  const tr=join(sect('MEMBER TRUSS',/^[A-Z]/)).split(' ').map(Number),want=m.members.map((e,k)=>e.type==='truss'?k+1:0).filter(Boolean);
  ok('truss members listed',JSON.stringify(tr)===JSON.stringify(want),tr.length+' vs '+want.length);
  /* every member has exactly one property with the right A and Iz */
  const pr=sect('MEMBER PROPERTY',/^CONSTANTS/).filter(l=>l[0]!=='*');const txtp=join(pr);
  const got={};txtp.split(/(?<=IZ [0-9.eE+-]+) /).forEach(seg=>{const mm=/^(.*)PRIS AX (\S+) IX (\S+) IY (\S+) IZ (\S+)/.exec(seg.trim());if(!mm)return;mm[1].trim().split(' ').forEach(id=>got[id]={A:+mm[2],Iy:+mm[4],Iz:+mm[5]})});
  bad=0;m.members.forEach((e,k)=>{const g=got[k+1];if(!g||Math.abs(g.A-e.sec.A)/e.sec.A>1e-8||Math.abs(g.Iy-e.sec.Iy)/e.sec.Iy>1e-8||Math.abs(g.Iz-e.sec.Iz)/e.sec.Iz>1e-8)bad++});ok('section properties match for all members',bad===0,bad);
  const sp=join(sect('SUPPORTS',/^LOAD /));ok('supports keyword',sp.includes(fixed?'FIXED':'PINNED')&&!sp.includes(fixed?'PINNED':'FIXED'),sp);
  ok('support count',sp.replace(/ (PINNED|FIXED).*/,'').split(' ').length===Object.keys(m.supports).length);
  /* loads: sum of UNI by direction and case equals the model's */
  ['DL','LL','WLd','WLu','WLx'].forEach((nm,k)=>{
    const i=L.findIndex(l=>l.startsWith('LOAD '+(k+1)+' '));let j=i+1;const tot={GX:0,GY:0,GZ:0};
    while(j<L.length&&!/^LOAD /.test(L[j])&&!/^\*/.test(L[j]))j++;
    L.slice(i,j).forEach(l=>{const t=/^(\d+) UNI (G[XYZ]) (\S+)$/.exec(l);if(t){const e=m.members[t[1]-1],a=m.nodes[e.a],b=m.nodes[e.b];tot[t[2]]+=+t[3]*Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])}});
    const ex={GX:0,GY:0,GZ:0};Object.keys(m.cases[nm].udl).forEach(q=>{const e=m.members[q],a=m.nodes[e.a],b=m.nodes[e.b],l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),w=m.cases[nm].udl[q];ex.GX+=w[0]*l;ex.GY+=w[1]*l;ex.GZ+=w[2]*l});
    ok(nm+' total load by direction matches the model',['GX','GY','GZ'].every(d=>Math.abs(tot[d]-ex[d])<1e-6*Math.max(1,Math.abs(ex[d]))),JSON.stringify(tot)+' vs '+JSON.stringify(ex));
  });
  const cb=L.filter(l=>l.startsWith('LOAD COMBINATION'));ok('all combinations exported',cb.length===E.ULS.length+E.SLS.length,cb.length);
  const ix=L.findIndex(l=>l.includes('1.2 DL LL WL along -X'));ok('negative factor kept',/^1 1\.2 2 1\.2 5 -1\.2$/.test(L[ix+1]),L[ix+1]);
});
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
