/* 3D structure: member placement, counts, lengths and weights against hand values. Run from the repository root. */
global.window={};global.document={readyState:'complete',addEventListener(){},getElementById(){return null},querySelector(){return null}};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-fem.js','epc-thin.js','epc-analysis.js','epc-map.js','epc-place.js','epc-shadow.js','epc-survey.js','epc-struct3d.js'].forEach(f=>{try{require(A+f)}catch(e){if(f==='epc-map.js')return;throw e}});
const S=window.EPCSurvey,F=window.EPCFem,E=window.EPCAnalysisEngine,T=window.EPCStruct3D;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)};const near=(a,b,t)=>Math.abs(a-b)<=t,R=Math.PI/180;
const inp={top:0,lat:17.4,az:180,tilt:15,mod:{l:2.278,w:1.134,wp:615,port:true},gapMm:20,rows:2,lowMm:600,sb:0.5,cl:0.5,rg:0,window:[9,15],shade:{mode:'off'},
  parts:[{name:'Main',x:0,y:0,w:16,d:20,kind:'table',level:0},{name:'Penthouse roof',x:2,y:2,w:8,d:6,kind:'table',level:3}],
  obs:[{name:'Penthouse',shape:'rect',x:2,y:2,w:8,d:6,h:3,base:0}]};
const res=S.calc(inp);ok('survey result ok with tables on two levels',res.state==='ok'&&res.tables.length>=2&&res.parts[1].tables.length>0,JSON.stringify(res.missing));
const sec=(b,h,t)=>F.rhs(b/1000,h/1000,t/1000),chs=(d,t)=>F.chs(d/1000,t/1000);
const cfg={S:{frameSpacing:2000,colSpacingH:2000,colInset:300,rafterOvh:100,purlinOvh:100},sec:{pur:sec(40,60,2),raf:sec(60,120,3),col:chs(88.9,3.2),brc:chs(60.3,3.2)},labels:{pur:'RHS 40x60x2',raf:'RHS 60x120x3',col:'CHS 88.9x3.2',brc:'CHS 60.3x3.2'},fixed:false,tieFrac:0.6,brcFrac:0.75};
const M=T.members(res,inp,cfg);ok('members built',M.state==='ok'&&M.tables.length===res.tables.length,JSON.stringify(M.missing));
/* independent count: build each table's block directly */
let want=0,wantPur=0,wantRaf=0;
res.tables.forEach(tb=>{const Sx={blocks:[{rows:tb.rows,perRow:tb.perRow,low:inp.lowMm}],module:{len:2278,wid:1134,orient:'portrait'},tilt:15,gap:20,...cfg.S};const c=E.geometry(Sx,0);
  const B=E.build(c,{...cfg.sec,tie:cfg.sec.brc,fixed:false,tieFrac:.6,brcFrac:.75,s:1,dead:0,live:0,wd:0,wu:0,wx:0});want+=B.mem.length;wantPur+=2*tb.rows*c.purlinLen/1000;wantRaf+=c.nRaf*c.rafterLen/1000});
const cnt=M.tables.reduce((s,t)=>s+t.members.length,0);ok('member count equals the analysis builder\'s',cnt===want,cnt+' vs '+want);
const row=r=>M.schedule.rows.find(x=>x.role===r);
ok('purlin length = 2 per module row x purlin length per table',near(row('pur').lengthM,wantPur,1e-6),row('pur').lengthM+' vs '+wantPur);
ok('rafter length = frames x rafter length per table',near(row('raf').lengthM,wantRaf,1e-6),row('raf').lengthM+' vs '+wantRaf);
ok('weights = A x 7850 x length',M.schedule.rows.every(r=>near(r.kg,r.lengthM*r.kgPerM,1e-9))&&near(row('pur').kgPerM,cfg.sec.pur.A*7850,1e-9));
ok('total weight is the sum of the rows',near(M.schedule.totalKg,M.schedule.rows.reduce((s,r)=>s+r.kg,0),1e-9));
ok('weight of the 40x60x2 purlin is about 2.9 kg/m (A x 7850; catalogue ~2.9)',row('pur').kgPerM>2.7&&row('pur').kgPerM<3.1,row('pur').kgPerM);
/* placement: invert the transform and compare with the table's frame */
let badZ=0,badBase=0,badST=0,maxS=0,maxT=0;
M.tables.forEach((mt,i)=>{
  const tb=res.tables[i],st=tb.st,ovh=0.1,ct=Math.cos(15*R),lvl=tb.level||0;
  mt.members.forEach(m=>{[m.a,m.b].forEach(p=>{if(p[2]<lvl-1e-9)badZ++;if(p[2]>tb.zBack+0.9)badZ++;
      const z=S.enToST(S.sheetToEN([p[0],p[1]],0),180),tol=1e-6;
      maxT=Math.max(maxT,z[1]-(st.t0+st.dPlan+ovh*ct),(st.t0-ovh*ct)-z[1]);maxS=Math.max(maxS,st.s0-z[0],z[0]-(st.s0+st.tw));
      if(z[1]>st.t0+st.dPlan+ovh*ct+tol||z[1]<st.t0-ovh*ct-tol)badST++})});
  const cols=mt.members.filter(m=>m.kind==='column');cols.forEach(m=>{if(!(near(m.a[2],lvl,1e-9)||near(m.b[2],lvl,1e-9)||m.a[2]>lvl&&m.b[2]>lvl))badBase++});
  const pur=mt.members.filter(m=>m.kind==='purlin');ok(tb.name+': purlins are horizontal along the row (equal z at both ends)',pur.every(m=>near(m.a[2],m.b[2],1e-9)));
});
console.log('max t overshoot',maxT,'max s overshoot',maxS);ok('along the row, members stay within half a frame spacing of the modules (centred frames)',maxS<=1.0+1e-9,maxS);ok('no member below its floor or far above the table',badZ===0,badZ);ok('every member inside the table frame plus overhangs (s and t)',badST===0,badST);
/* rafter ends: low end sits one rafter overhang beyond the front edge, high end one overhang beyond the back edge */
const t0=res.tables[0],m0=M.tables[0],raf=m0.members.filter(m=>m.kind==='rafter');
const sts=raf.flatMap(m=>[m.a,m.b]).map(p=>S.enToST(S.sheetToEN([p[0],p[1]],0),180)[1]);
ok('rafter low end is ovh x cos(tilt) beyond the front edge',near(Math.max(...sts),t0.st.t0+t0.st.dPlan+0.1*Math.cos(15*R),1e-6),Math.max(...sts));
ok('rafter high end is ovh x cos(tilt) beyond the back edge',near(Math.min(...sts),t0.st.t0-0.1*Math.cos(15*R),1e-6),Math.min(...sts));
/* higher end is higher */
const zr=raf.map(m=>[m.a[2],m.b[2]]).flat();ok('rafter rises by length x sin(tilt)',near(Math.max(...zr)-Math.min(...zr),(t0.rows*2.278+0.02+0.2)*Math.sin(15*R),1e-6),Math.max(...zr)-Math.min(...zr));
/* missing inputs */
ok('missing layout values are reported',T.members(res,inp,{...cfg,S:{...cfg.S,colInset:NaN}}).state==='missing');ok('missing section is reported',T.members(res,inp,{...cfg,sec:{pur:cfg.sec.pur}}).state==='missing');
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
