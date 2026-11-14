/* EPC Survey: real steel members of every table at its level, in sheet coordinates, plus the material schedule.
   Uses the same geometry and member builder as the Analysis tab, so 3D, analysis and quantities are one record.
   No DOM access. */
(function(){
  'use strict';
  var RHO=7850;                                                   /* kg/m3 */
  var ROLE={column:'col',rafter:'raf',purlin:'pur',brace:'brc',tie:'brc'};
  var NAME={col:'Column',raf:'Rafter',pur:'Purlin',brc:'Brace and tie'};
  /* res = Survey calc() result, inp = its input, cfg = {S:{frameSpacing,colSpacingH,colInset,rafterOvh,purlinOvh}, sec:{pur,raf,col,brc} (EPCFem sections),
     labels:{pur,raf,col,brc}, fixed, tieFrac, brcFrac} */
  function members(res,inp,cfg){
    var E=window.EPCAnalysisEngine,SV=window.EPCSurvey;
    if(!E||!SV||!res||res.state!=='ok')return {state:'missing',missing:['Survey result']};
    var S0=cfg.S,miss=[];['frameSpacing','colSpacingH','colInset','rafterOvh','purlinOvh'].forEach(function(k){if(!(S0[k]>=0)||S0[k]===null||S0[k]===undefined||isNaN(S0[k]))miss.push('Layout '+k)});
    ['pur','raf','col','brc'].forEach(function(k){if(!cfg.sec||!cfg.sec[k])miss.push('section: '+k)});
    if(miss.length)return {state:'missing',missing:miss};
    var out={state:'ok',tables:[],warnings:[]},acc={},order=[];
    var port=inp.mod.port;
    res.tables.forEach(function(tb){
      if(!tb.st)return;
      var S={blocks:[{name:tb.name,rows:tb.rows,perRow:tb.perRow,low:inp.lowMm}],module:{len:inp.mod.l*1000,wid:inp.mod.w*1000,orient:port?'portrait':'landscape'},tilt:inp.tilt,gap:inp.gapMm,
        frameSpacing:S0.frameSpacing,colSpacingH:S0.colSpacingH,colInset:S0.colInset,rafterOvh:S0.rafterOvh,purlinOvh:S0.purlinOvh};
      var c=E.geometry(S,0);
      var P={pur:cfg.sec.pur,raf:cfg.sec.raf,col:cfg.sec.col,brc:cfg.sec.brc,tie:cfg.sec.brc,fixed:!!cfg.fixed,tieFrac:cfg.tieFrac,brcFrac:cfg.brcFrac,s:1,dead:0,live:0,wd:0,wu:0,wx:0};
      var B=E.build(c,P);
      var xm0=(c.purlinLen-c.runLen)/2/1000,ct=c.ct,yOff=S0.rafterOvh*ct/1000,lvl=tb.level||0,st=tb.st;
      function map(p){var s=st.s0+(p.x-xm0),t=st.t0+st.dPlan-(p.y-yOff),en=SV.stToEN([s,t],res.az),sh=SV.enToSheet(en,res.top);return [sh[0],sh[1],lvl+p.z]}
      var list=[];
      B.mem.forEach(function(m){
        var role=ROLE[m.kind],a=map(m.a),b=map(m.b);
        list.push({kind:m.kind,role:role,label:m.label,piece:m.piece,a:a,b:b,len:Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)});
        var sec=cfg.sec[role],key=role;
        if(!acc[key]){acc[key]={role:role,name:NAME[role],section:cfg.labels[role],kgm:sec.A*RHO,len:0,pieces:{},seg:0};order.push(key)}
        acc[key].len+=list[list.length-1].len;acc[key].seg++;acc[key].pieces[tb.name+'|'+m.kind+'|'+m.piece]=1;
      });
      out.tables.push({name:tb.name,level:lvl,part:tb.part,members:list,geom:{nRaf:c.nRaf,nCol:c.nCol,rafterLen:c.rafterLen,purlinLen:c.purlinLen}});
      var dz=(S0.colInset-S0.rafterOvh)*c.st/1000;
      if(dz>0.02&&out.warnings.length===0)out.warnings.push('The analysed columns are measured at the column inset ('+S0.colInset+' mm from the rafter end), so the rafters sit about '+(dz*100).toFixed(0)+' cm higher at the module edge than the low-edge height entered in the Survey.');
    });
    var rows=order.map(function(k){var a=acc[k];return {role:a.role,name:a.name,section:a.section,pieces:Object.keys(a.pieces).length,lengthM:a.len,kgPerM:a.kgm,kg:a.len*a.kgm}});
    var tot=0,len=0;rows.forEach(function(r){tot+=r.kg;len+=r.lengthM});
    out.schedule={rows:rows,totalKg:tot,totalLengthM:len,tables:out.tables.length};
    return out;
  }
  window.EPCStruct3D={members:members,RHO:RHO,NAME:NAME};
  if(typeof module!=='undefined')module.exports=window.EPCStruct3D;
})();
