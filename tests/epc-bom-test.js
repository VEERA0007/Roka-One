/* Fabrication BOM: weight convention against the fabricator's reference BOM (R1_STRUCTURE_BOM.pdf), piece lengths against the
   Layout cut-list rules, and consistency between the analysis model and the BOM. Run from the repository root. */
global.window={};
const A=require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets')+'/';
['epc-thin.js','epc-fem.js','epc-analysis.js','epc-bom.js'].forEach(f=>require(A+f));
const E=window.EPCAnalysisEngine,F=window.EPCFem,B=window.EPCBom.calc;
let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)};
const near=(a,b,t)=>Math.abs(a-b)<=t;

/* 1 section text and kg/m */
const b100=F.rhs(.1,.1,.002),b6040=F.rhs(.04,.06,.002),b50=F.rhs(.05,.05,.002),p76=F.chs(.0761,.0032);
ok('text 100x100x2',B.secText(b100)==='100x100x2 mm BOX PIPE',B.secText(b100));
ok('text 60x40x2, larger side first',B.secText(b6040)==='60x40x2 mm BOX PIPE',B.secText(b6040));
ok('text round pipe',B.secText(p76)==='76.1x3.2 mm ROUND PIPE',B.secText(p76));
ok('kg/m 100x100x2 = 6.1544',near(B.kgPerM(b100),6.1544,1e-9),B.kgPerM(b100));
ok('kg/m 60x40x2 = 3.0144',near(B.kgPerM(b6040),3.0144,1e-9),B.kgPerM(b6040));
ok('kg/m round pipe 76.1x3.2 = 5.75 (the Layout value)',near(B.kgPerM(p76),5.753,2e-3),B.kgPerM(p76));
ok('base plate 150x150x5 = 0.883125 kg',near(B.plateKg(150,150,5),0.883125,1e-12),B.plateKg(150,150,5));

/* 2 every row and every total of the three reference tables (length per piece, qty, section, printed weight) */
const REF=[
 {mods:9,total:180.57,rows:[[b100,567,2,6.98],[b100,822,2,10.12],[b100,1077,2,13.26],[b100,6554,2,80.67],[b6040,3552,6,64.24]],plates:[6,5.3]},
 {mods:18,total:377.65,rows:[[b100,2399,4,59.06],[b100,2088,4,51.40],[b100,4273,4,105.19],[b6040,10506,4,126.68],[b50,9372,1,28.25]],plates:[8,7.1]},
 {mods:38,total:1255.05,rows:[[b100,4339,7,186.93],[b100,4647,7,200.20],[b100,4898,3,90.43],[b100,4242,4,104.43],[b100,7124,3,131.53],
   [b6040,18619,4,224.50],[b6040,7029,2,42.38],[b6040,7029,2,42.38],[b50,595,3,5.38],[b50,500,3,4.52],[b50,697,3,6.30],
   [b50,4505,1,13.58],[b50,8755,1,26.39],[b50,5170,2,31.17],[b50,4975,3,44.99],[b50,4695,6,84.92]],plates:[17,15.0]}];
REF.forEach(t=>{
  let sum=0,bad=[];
  t.rows.forEach(([s,len,qty,w],i)=>{const x=len*qty*B.kgPerMm(s);sum+=x;if(!near(+B.f2(x),w,0.0101))bad.push((i+1)+': '+B.f2(x)+' vs '+w)});
  ok(t.mods+'-module table: all '+t.rows.length+' row weights match the printed values to 0.01 kg',bad.length===0,bad.join('; '));
  const pw=t.plates[0]*B.plateKg(150,150,5);
  ok(t.mods+'-module table: base plates',near(pw,t.plates[1],0.05),pw.toFixed(3)+' vs '+t.plates[1]);
  ok(t.mods+'-module table: total weight (sum of unrounded rows + plates)',near(+B.f2(sum+pw),t.total,0.0201),B.f2(sum+pw)+' vs '+t.total);
});
ok('title as printed in the reference',B.titleText('R0',65*615,'Dr Sudhir')==='R0_39.98_BOM_DR SUDHIR',B.titleText('R0',65*615,'Dr Sudhir'));
ok('kWp rounds half up on whole watts',B.kwpText(39975)==='39.98'&&B.kwpText(40000)==='40.00'&&B.kwpText(5400)==='5.40'&&B.kwpText(33210)==='33.21',B.kwpText(39975));

/* 3 an analysed block: piece lengths against the Layout cut-list rules written out by hand (module 2094 x 1038 portrait, 3 rows of 3) */
const mkS=(over)=>Object.assign({module:{len:2094,wid:1038,orient:'portrait',wp:540},gap:20,tilt:5,frameSpacing:2661,colSpacingH:2916,colInset:360,rafterOvh:100,purlinOvh:445,stock:6000,
  blocks:[{name:'Tower roof',rows:3,perRow:3,low:567},{name:'Main front',rows:3,perRow:10,low:1590}],walk:{on:'1',len:7545}},over||{});
const mkW=(tilt)=>({L:{tilt:tilt},v:{fy:250,lim:180,nPur:2,pType:'RHS',pb:40,ph:60,pt:2,rType:'RHS',rb:100,rh:100,rt:2,nb:2,tcap:20,vcap:15},s:(2.094+0.02)/2,q:{dead:0.35,live:0.5},wd:0.4,wu:0.8});
const mkI=(o)=>Object.assign({colType:'RHS',colB:100,colH:100,colT:2,brcType:'RHS',brcB:50,brcH:50,brcT:2,base:'Pinned',K:1,bclass:'b',tieFrac:0.6,brcFrac:0.75,swayLim:150},o||{});
const S=mkS(),runs=S.blocks.map((b,i)=>E.analyse(S,i,mkW(5),mkI()));
runs.forEach((r,i)=>ok('block '+(i+1)+' analysed without error',!r.error&&r.ok,r.error));
const expect=(rows,cols,per,low)=>{                           /* the Layout rules, by hand */
  const t=5*Math.PI/180,dS=2094,dP=1038,gap=20,fs=2661;
  const rafter=rows*dS+(rows-1)*gap+2*100,run=per*dP+(per-1)*gap,nRaf=Math.max(2,Math.ceil((run-2*445)/fs-1e-9)+1),purlin=Math.max(run,(nRaf-1)*fs+2*445);
  const sSl=2916/Math.cos(t),inner=rafter-2*360,nCol=Math.max(2,Math.ceil(inner/sSl-1e-9)+1),span=inner/(nCol-1),h=[];
  for(let i=0;i<nCol;i++)h.push(low+i*span*Math.sin(t));
  return {rafter,purlin,nRaf,nCol,h,brace:Math.hypot(span*Math.cos(t),0.75*h[nCol-1]),tie:(nRaf-1)*fs,purlins:rows*2};
};
[[0,3,3,567],[1,3,10,1590]].forEach(([bi,rows,per,low])=>{
  const e=expect(rows,0,per,low),rows_=E.pieceRows(runs[bi]),by=d=>rows_.find(r=>r.desc===d);
  const m=[];
  e.h.forEach((h,i)=>{const r=by('COLUMN '+(i+1));if(!r||r.len!==Math.round(h)||r.qty!==e.nRaf)m.push('COLUMN '+(i+1)+' '+(r&&r.len)+'x'+(r&&r.qty)+' vs '+Math.round(h)+'x'+e.nRaf)});
  let r=by('RAFTER');if(!r||r.len!==Math.round(e.rafter)||r.qty!==e.nRaf)m.push('RAFTER');
  r=by('PURLIN');if(!r||r.len!==Math.round(e.purlin)||r.qty!==e.purlins)m.push('PURLIN '+(r&&r.len)+'x'+(r&&r.qty)+' vs '+Math.round(e.purlin)+'x'+e.purlins);
  r=by('BRACING 1 (DIAGONAL)');if(!r||r.len!==Math.round(e.brace)||r.qty!==e.nRaf)m.push('BRACE '+(r&&r.len)+' vs '+Math.round(e.brace));
  r=by('BRACING 2 (COLUMN TIE)');if(!r||r.len!==Math.round(e.tie)||r.qty!==e.nCol)m.push('TIE '+(r&&r.len)+'x'+(r&&r.qty)+' vs '+Math.round(e.tie)+'x'+e.nCol);
  ok(S.blocks[bi].name+': every piece length and quantity equals the Layout cut-list rule',m.length===0,m.join('; '));
  ok(S.blocks[bi].name+': '+(e.nCol+4)+' rows (columns, rafter, purlin, brace, tie)',rows_.length===e.nCol+4,rows_.length);
});

/* 4 BOM consistency with the model */
const o={rev:'R0',name:'Dr Sudhir',mat:'HDGI',plate:{w:150,d:150,t:5},stock:6000};
const res=B.build(S,runs,o);
ok('two structures and a walkway table',res.blocks.length===2&&!!res.walk);
ok('title uses all modules: (9 + 30) x 540 Wp = 21.06 kWp',res.title==='R0_21.06_BOM_DR SUDHIR',res.title);
ok('module count',res.mods===39,res.mods);
res.blocks.forEach((t,i)=>{
  const r=runs[i];
  ok(t.name+': base plates = analysed supports = columns x frames',t.plate.qty===r.reacts.length&&t.cols===r.c.nCol*r.c.nRaf,t.plate.qty+' '+r.reacts.length+' '+t.cols);
  const sumRows=t.rows.reduce((a,x)=>a+x.wt,0)+t.plate.wt;
  ok(t.name+': total = sum of rows + plates',near(sumRows,t.total,1e-9),sumRows+' '+t.total);
  /* the piece lengths add up to the model: sum of element lengths of every kind */
  const byKind={};r.mem.forEach((m,mi)=>{byKind[m.kind]=(byKind[m.kind]||0)+r.res.mem[mi].L*1000});
  const pk={};r.pieces.forEach(p=>{pk[p.kind]=(pk[p.kind]||0)+p.len});
  ok(t.name+': piece lengths add up to the analysed member lengths',Object.keys(byKind).every(k=>near(byKind[k],pk[k],1e-6)),JSON.stringify(byKind)+' '+JSON.stringify(pk));
  const fromRows={};E.pieceRows(r).forEach(x=>{fromRows[x.kind]=(fromRows[x.kind]||0)+x.len*x.qty});
  ok(t.name+': BOM total length per kind within 1 mm per piece of the model',Object.keys(byKind).every(k=>near(fromRows[k],byKind[k],r.pieces.length)),JSON.stringify(fromRows));
});
ok('walkway: 7545 mm run, ceil(7545/2661)+1 = 4 supports',res.walk.sup===4&&res.walk.rows[0].len===7545&&res.walk.rows[0].qty===2&&res.walk.rows.slice(1).every((x,i)=>x.len===[595,500,697][i]&&x.qty===4),JSON.stringify(res.walk.rows.map(x=>[x.desc,x.len,x.qty])));
ok('walkway rails use the purlin section, supports the brace section',res.walk.rows[0].sec==='60x40x2 mm BOX PIPE'&&res.walk.rows[1].sec==='50x50x2 mm BOX PIPE',res.walk.rows[0].sec+' / '+res.walk.rows[1].sec);
ok('stock flag: rafter 6522 > 6000, column not',res.blocks[0].rows.find(x=>x.desc==='RAFTER').long===true&&res.blocks[0].rows.find(x=>x.desc==='COLUMN 1').long===false);
ok('project total = tables + walkway',near(res.total,res.blocks.reduce((a,t)=>a+t.total,0)+res.walk.total,1e-9));
const noWalk=B.build(mkS({walk:{on:'0',len:0}}),runs,o);
ok('walkway off: no walkway table',noWalk.walk===null);
const noPlate=B.build(S,runs,Object.assign({},o,{plate:{w:NaN,d:150,t:5}}));
ok('plate size missing: no plate row and weight not counted',noPlate.blocks.every(t=>t.plate===null)&&near(noPlate.blocks[0].total,noPlate.blocks[0].rows.reduce((a,x)=>a+x.wt,0),1e-9));

/* 5 tie and brace heights change the model but never the cut lengths of columns or ties */
const r2=E.analyse(S,0,mkW(5),mkI({tieFrac:0.45,brcFrac:0.9})),rows2=E.pieceRows(r2),rows1=E.pieceRows(runs[0]);
ok('column and tie lengths do not depend on the tie height',[0,1,2].every(i=>rows2.find(x=>x.desc==='COLUMN '+(i+1)).len===rows1.find(x=>x.desc==='COLUMN '+(i+1)).len)&&rows2.find(x=>/TIE/.test(x.desc)).len===rows1.find(x=>/TIE/.test(x.desc)).len);
const top=r2.c.heights[r2.c.nCol-1];
ok('brace length follows the brace-top fraction',rows2.find(x=>/DIAGONAL/.test(x.desc)).len===Math.round(Math.hypot(r2.c.spanH,0.9*top)),rows2.find(x=>/DIAGONAL/.test(x.desc)).len);

/* 6 round-pipe columns and braces */
const rC=E.analyse(S,0,mkW(5),mkI({colType:'CHS',colB:76.1,colH:0,colT:3.2,brcType:'CHS',brcB:48.3,brcH:0,brcT:3.2}));
if(rC.error)ok('round-pipe case analyses',false,rC.error);
else{const t=B.structure(rC,o.plate,6000),c1=t.rows.find(x=>x.desc==='COLUMN 1');
  ok('round-pipe column text and weight',c1.sec==='76.1x3.2 mm ROUND PIPE'&&near(c1.wt,c1.tot*5.753e-3,c1.tot*2e-6),c1.sec+' '+c1.wt.toFixed(3));
  ok('round-pipe rows keep their own section texts',t.rows.some(x=>x.sec==='48.3x3.2 mm ROUND PIPE')&&t.rows.some(x=>x.sec==='100x100x2 mm BOX PIPE'));}

/* 7 flat roof: equal column heights still list each column position once, like the Layout cut list */
const S0=mkS({tilt:0,blocks:[{name:'Flat',rows:3,perRow:3,low:1200}]}),r0=E.analyse(S0,0,mkW(0),mkI());
if(r0.error)ok('flat roof analyses',false,r0.error);
else{const rr=E.pieceRows(r0).filter(x=>x.part==='COLUMN');ok('flat roof: COLUMN 1..n, all 1200 mm',rr.length===r0.c.nCol&&rr.every(x=>x.len===1200&&x.qty===r0.c.nRaf),JSON.stringify(rr.map(x=>[x.desc,x.len,x.qty])))}

/* 8 CSV */
const csv=B.csvOf(res),lines=csv.split('\n');
ok('csv header',lines[0].startsWith('Block,Sr. No.,Parts Name,Parts Description,Cross Section (mm),Length (mm),Material,No of Parts,Total Length (mm),Total weight (kg)'));
ok('csv total value equals the project total',Math.abs(parseFloat(lines[lines.length-1].split(',').pop())-res.total)<0.006,lines[lines.length-1]);
ok('csv has one line per BOM row, per plate row, per table total, plus header and project total',lines.length===1+res.blocks.concat([res.walk]).reduce((a,t)=>a+t.rows.length+(t.plate?1:0)+1,0)+1,lines.length);

console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0);
