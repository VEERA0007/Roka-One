/* EPC Fabrication BOM: the analysed structure listed the way a fabricator writes it (parts, section, length, quantity, total length,
   weight, base plates), one table per Layout block. Every piece comes from the analysis model (EPCAnalysisEngine.pieceRows), so the
   BOM cannot differ from what was checked. Engineering (EPC) tab only. PRELIMINARY: not approved until a structural engineer signs off.
   The calculation part has no DOM access and is used by the tests. */
(function(){
  'use strict';
  var KEY='gs_epc_bom_v1',DENS=7.85e-6;                         /* kg per mm3 = 7850 kg/m3 */
  var G=typeof window!=='undefined'?window:{},Eng=G.EPCAnalysisEngine;

  /* ---------- calculation ---------- */
  function mm(x){return Math.round(x*1e5)/100}                  /* m to mm, to 0.01 mm (removes float noise such as 76.10000000000001) */
  function r2(x){return Math.round(x*100+1e-9)/100}
  function f2(x){return r2(x).toFixed(2)}
  function secText(s){
    if(s.type==='CHS')return mm(s.b)+'x'+mm(s.t)+' mm ROUND PIPE';
    var a=mm(s.b),h=mm(s.h);return Math.max(a,h)+'x'+Math.min(a,h)+'x'+mm(s.t)+' mm BOX PIPE';
  }
  /* kg per mm of length. Box pipe: the fabricator's convention, sharp corners, t x (2(b+h) - 4t). Round pipe: exact annulus, pi x t x (D - t). */
  function kgPerMm(s){
    var t=mm(s.t),b=mm(s.b);
    if(s.type==='CHS')return Math.PI*t*(b-t)*DENS;
    return t*(2*(b+mm(s.h))-4*t)*DENS;
  }
  function kgPerM(s){return kgPerMm(s)*1000}
  function plateKg(w,d,t){return w*d*t*DENS}
  /* total kWp to 2 decimals, rounded half up on whole watts (39 975 Wp is 39.98, not 39.97) */
  function kwpText(wp){return (Math.round(wp/10+1e-9)/100).toFixed(2)}
  function titleText(rev,wp,name){return (rev||'R0')+'_'+kwpText(wp)+'_BOM_'+String(name||'').toUpperCase()}

  /* One structure (Layout block). run = the analysis result of that block. */
  function structure(run,plate,stock){
    var rows=[],tot=0,sr=0,last=null,cols=0;
    Eng.pieceRows(run).forEach(function(o){
      var t=o.len*o.qty,w=t*kgPerMm(o.sec),first=o.part!==last;
      if(first)sr++;last=o.part;tot+=w;if(o.kind==='column')cols+=o.qty;
      rows.push({sr:first?sr:0,part:o.part,desc:o.desc,sec:secText(o.sec),len:o.len,qty:o.qty,tot:t,wt:w,long:stock>0&&o.len>stock});
    });
    var pl=null;
    if(plate&&plate.w>0&&plate.d>0&&plate.t>0){
      pl={sr:sr+1,part:'BASE PLATE',desc:'BASE PLATE',sec:plate.w+'x'+plate.d+'x'+plate.t+'mm Plate',len:null,qty:cols,tot:null,wt:cols*plateKg(plate.w,plate.d,plate.t)};
      tot+=pl.wt;
    }
    return {name:run.c.b.name||'Block',mods:run.c.rows*run.c.per,rows:rows,plate:pl,cols:cols,total:tot};
  }

  /* Access walkway: project level in the Layout (S.walk), so it is its own table. Rails and U-supports are not in the Layout cut list
     or the analysis; sizes follow the reference BOM (rails as the purlin section, supports as the brace section). */
  function walkway(S,sec,stock){
    var w=S&&S.walk;if(!w||w.on!=='1')return null;
    var Lr=parseFloat(w.len);if(!(Lr>0))return null;
    var L=Math.round(Lr),sup=Math.ceil(Lr/Math.max(1000,S.frameSpacing))+1,rows=[],tot=0,sr=0;
    function add(part,desc,s,len,qty,first){var t=len*qty,wt=t*kgPerMm(s);tot+=wt;if(first)sr++;
      rows.push({sr:first?sr:0,part:part,desc:desc,sec:secText(s),len:len,qty:qty,tot:t,wt:wt,long:stock>0&&len>stock})}
    add('WALKWAY PURLIN','WALKWAY PURLIN',sec.pur,L,2,true);
    [595,500,697].forEach(function(len,i){add('WALKWAY','WALKWAY SUPPORT - '+(i+1),sec.brc,len,sup,i===0)});
    return {name:'Walkway',rows:rows,plate:null,total:tot,sup:sup,L:L};
  }

  /* o = {rev, name, mat, plate:{w,d,t}, stock} ; runs[i] = analysis result of Layout block i */
  function build(S,runs,o){
    var blocks=[],wp=0,total=0,first=null,wpm=parseFloat(S.module&&S.module.wp)||0;
    S.blocks.forEach(function(b,i){
      var r=runs[i];if(!r)return;if(!first)first=r;
      var x=structure(r,o.plate,o.stock);blocks.push(x);total+=x.total;wp+=x.mods*wpm;
    });
    var wk=first?walkway(S,first.sec,o.stock):null;if(wk)total+=wk.total;
    return {blocks:blocks,walk:wk,total:total,wp:wp,mods:blocks.reduce(function(a,b){return a+b.mods},0),title:titleText(o.rev,wp,o.name),mat:o.mat||'HDGI'};
  }

  function csvOf(res){
    var out=[['Block','Sr. No.','Parts Name','Parts Description','Cross Section (mm)','Length (mm)','Material','No of Parts','Total Length (mm)','Total weight (kg)']];
    function tab(t){
      t.rows.forEach(function(r){out.push([t.name,r.sr||'',r.sr?r.part:'',r.desc,r.sec,r.len,res.mat,r.qty,r.tot,r2(r.wt)])});
      if(t.plate)out.push([t.name,t.plate.sr,t.plate.part,t.plate.desc,t.plate.sec,'',res.mat,t.plate.qty,'',r2(t.plate.wt)]);
      out.push([t.name,'','','','','','','','TOTAL WEIGHT (kg)',r2(t.total)]);
    }
    res.blocks.forEach(tab);if(res.walk)tab(res.walk);
    out.push(['PROJECT '+res.title,'','','','','','','','TOTAL WEIGHT (kg)',r2(res.total)]);
    return out.map(function(r){return r.map(function(c){c=String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\n');
  }

  var api={secText:secText,kgPerMm:kgPerMm,kgPerM:kgPerM,plateKg:plateKg,kwpText:kwpText,titleText:titleText,structure:structure,walkway:walkway,build:build,csvOf:csvOf,f2:f2};
  G.EPCBom={calc:api,kgPerM:kgPerM};
  if(typeof document==='undefined'||!document.getElementById)return;

  /* ---------- screen ---------- */
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  function layout(){try{return JSON.parse(localStorage.getItem('gs_epc_v1'))}catch(e){return null}}
  var F=[{id:'rev',l:'Revision',text:1,def:'R0'},{id:'mat',l:'Material / finish',text:1,def:'HDGI'},
    {id:'plW',l:'Base plate width (mm)',min:10,step:1,def:'150',pl:1},{id:'plD',l:'Base plate depth (mm)',min:10,step:1,def:'150',pl:1},
    {id:'plT',l:'Base plate thickness (mm)',min:1,step:0.5,def:'5',pl:1}];
  var plOk=false;                                                /* the user has entered or confirmed the plate size */
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function saveVals(){var all=loadAll(),o={_pl:plOk?1:0};F.forEach(function(x){var e=$('epcb_'+x.id);if(e)o[x.id]=e.value});all[projName()]=o;try{localStorage.setItem(KEY,JSON.stringify(all))}catch(e){}}
  function loadVals(){var o=loadAll()[projName()]||{};plOk=!!o._pl;F.forEach(function(x){var e=$('epcb_'+x.id);if(e)e.value=o[x.id]!==undefined?o[x.id]:x.def})}
  function val(id){var e=$('epcb_'+id);if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}
  function gather(){
    var s=layout(),t=function(id,d){var e=$('epcb_'+id);return e&&e.value.trim()?e.value.trim():d};
    return {rev:t('rev','R0'),mat:t('mat','HDGI'),plate:{w:val('plW'),d:val('plD'),t:val('plT')},name:projName(),stock:s&&+s.stock>0?+s.stock:0};
  }
  function compute(){
    var A=G.EPCAnalysis,st=A&&A.status&&A.status();
    if(!st||st.state==='missing')return {state:'missing',missing:(st&&st.missing&&st.missing.length)?st.missing:['Complete the Analysis first']};
    var S=layout();if(!S||!S.blocks)return {state:'missing',missing:['Layout is not available']};
    var runs=A.runs();
    if(!S.blocks.every(function(b,i){return runs[i]}))return {state:'missing',missing:['The Analysis has not covered every block yet']};
    var o=gather(),res=build(S,runs,o);
    res.state='ok';res.analysis=st.state;res.fails=st.fails||[];res.opts=o;res.run=runs[0];res.S=S;res.wpm=parseFloat(S.module&&S.module.wp)||0;
    return res;
  }

  var CELL='border:1px solid #000;padding:3px 6px;text-align:center;vertical-align:middle';
  var HEAD=['Sr. No.','Parts Name','Parts Description','Cross Section (mm)','Length (mm)','Material','No of Parts','Total Length (mm)','Total weight (kg)'];
  function tableHtml(t,ctx){
    var lines=t.rows.slice();if(t.plate)lines.push(t.plate);
    var n=lines.length,i,j,spanP={},spanS={};
    for(i=0;i<n;i=j){j=i;while(j<n&&lines[j].part===lines[i].part)j++;spanP[i]=j-i}
    for(i=0;i<n;i=j){j=i;while(j<n&&lines[j].sec===lines[i].sec)j++;spanS[i]=j-i}
    var h='<table class="epcb-t" style="width:100%;border-collapse:collapse;font-size:12px;min-width:660px;color:#111;background:#fff">'+
      '<tr><td colspan="9" style="'+CELL+';background:#ead1dc;font-weight:700;font-size:13px">'+esc(ctx.title)+'</td></tr>'+
      '<tr><td colspan="9" style="'+CELL+';background:#ffd966;font-weight:700">'+esc(ctx.sub)+'</td></tr>'+
      '<tr>'+HEAD.map(function(x){return '<td style="'+CELL+';background:#b6d7a8;font-weight:700">'+x+'</td>'}).join('')+'</tr>';
    lines.forEach(function(r,k){
      h+='<tr>';
      if(spanP[k])h+='<td rowspan="'+spanP[k]+'" style="'+CELL+'">'+r.sr+'</td><td rowspan="'+spanP[k]+'" style="'+CELL+'">'+esc(r.part)+'</td>';
      h+='<td style="'+CELL+'">'+esc(r.desc)+'</td>';
      if(spanS[k])h+='<td rowspan="'+spanS[k]+'" style="'+CELL+'">'+esc(r.sec)+'</td>';
      h+='<td style="'+CELL+'">'+(r.len==null?'-':r.len)+(r.long?'<sup title="Longer than the stock pipe">*</sup>':'')+'</td>';
      if(k===0)h+='<td rowspan="'+n+'" style="'+CELL+'">'+esc(ctx.mat)+'</td>';
      h+='<td style="'+CELL+'">'+r.qty+'</td><td style="'+CELL+'">'+(r.tot==null?'-':r.tot)+'</td><td style="'+CELL+'">'+f2(r.wt)+'</td></tr>';
    });
    h+='<tr><td colspan="8" style="'+CELL+';background:#d9ead3;font-weight:700;text-align:right">TOTAL WEIGHT (kg)</td><td style="'+CELL+';background:#d9ead3;font-weight:700">'+f2(t.total)+'</td></tr>'+
      '<tr><td colspan="9" style="'+CELL+';background:#f4cccc;font-size:11px"><b>NOTE : PLEASE KEEP SOME EXTRA MATERIAL (10%) ON SITE TO COMPENSATE ON-SITE VARIATION.</b><br>This BOM is as per the shared design. If the site dimensions vary, the BOM will change.</td></tr></table>';
    return h;
  }
  function subText(t){return t.mods?t.mods+' MODULES STRUCTURE DETAILS ('+t.name.toUpperCase()+')':'WALKWAY DETAILS'}
  function engineer(){return (($('epcw_eng')||{}).value||'').trim()}

  var last=null;
  function notes(r){
    var o=[],A=r.run&&r.run.I;
    o.push('Weight of a box pipe = length × t × (2(b + h) − 4t) × 7850 kg/m³ (sharp corners, the fabricator\'s convention); a round pipe uses its exact area. The analysis uses the exact rounded-corner section, which is about 1% (100 × 100 × 2) to 3% (60 × 40 × 2) lighter, and a supplier\'s nominal kg/m can differ again.');
    if(A)o.push('Braces and ties follow the Analysis assumptions: brace top at '+A.brcFrac+' of the tallest column, ties at '+A.tieFrac+' of the column height. Confirm both against the fabrication drawing.');
    if(r.blocks.some(function(t){return !t.plate}))o.push('The base plate size is missing or invalid, so base plates are not listed and their weight is not in the totals.');
    else if(!plOk)o.push('Base plate '+r.opts.plate.w+' × '+r.opts.plate.d+' × '+r.opts.plate.t+' mm is the size in your reference BOM, not a design result. Enter or confirm it; this note goes away once you edit a plate size.');
    if(r.walk)o.push('Walkway rails and supports are not in the Layout cut list or the analysis. Sizes follow the reference BOM (rails as the purlin section, supports as the brace section, '+r.walk.sup+' supports). The grating itself is not included.');
    var lng=[];r.blocks.concat(r.walk?[r.walk]:[]).forEach(function(t){t.rows.forEach(function(x){if(x.long)lng.push(t.name+' '+x.desc+' '+x.len+' mm')})});
    if(lng.length)o.push('* Longer than the '+r.opts.stock+' mm stock pipe, so it must be spliced (splice design is not covered): '+lng.join('; ')+'.');
    return o;
  }
  function render(){
    var out=$('epcb_out');if(!out)return;
    var r=compute();last=r;
    if(r.state==='missing'){out.innerHTML='<div class="epca-warnings"><b>Fabrication BOM not available yet.</b><ul style="margin:6px 0 0 18px">'+r.missing.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul></div>';return}
    var eng=engineer(),ok=r.analysis==='pass';
    var h='<div class="ep-bar" style="margin:8px 0"><button class="btn sm" type="button" id="epcb_csv">Copy fabrication BOM as CSV</button> <button class="btn alt sm" type="button" id="epcb_print">Print / Save as PDF</button> <span class="ep-note" id="epcb_msg"></span></div>';
    h+='<div class="epca-warnings" style="margin:6px 0;border-color:'+(ok?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'"><b>PRELIMINARY, NOT APPROVED.</b> '+(ok?'The 3D frame analysis passes for every block.':'<b>The 3D frame analysis FAILS, so this structure is not adequate:</b> '+esc(r.fails.slice(0,3).join('; ')))+' Structural engineer: '+(eng?esc(eng):'not entered')+'.</div>';
    r.blocks.forEach(function(t){h+='<div style="overflow-x:auto;margin:10px 0">'+tableHtml(t,{title:r.title,sub:subText(t),mat:r.mat})+'</div>'});
    if(r.walk)h+='<div style="overflow-x:auto;margin:10px 0">'+tableHtml(r.walk,{title:r.title,sub:subText(r.walk),mat:r.mat})+'</div>';
    var kwp=r.wp/1000;
    h+='<div style="font-weight:700;margin:6px 0">Project steel: '+f2(r.total)+' kg for '+r.mods+' modules ('+kwpText(r.wp)+' kWp), '+(kwp>0?f2(r.total/kwp)+' kg per kWp':'')+'</div>';
    h+='<div class="epca-warnings" style="margin:6px 0"><ul style="margin:0 0 0 18px">'+notes(r).map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul></div>';
    out.innerHTML=h;
    $('epcb_csv').onclick=function(){
      var t=csvOf(last),m=$('epcb_msg');
      function fb(){var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();var c=false;try{c=document.execCommand('copy')}catch(e){}document.body.removeChild(ta);if(m)m.textContent=c?'Copied':'Copy failed'}
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){if(m)m.textContent='Copied'},fb);else fb();
    };
    $('epcb_print').onclick=printBom;
  }
  function printBom(){
    var r=last;if(!r||r.state!=='ok')return;
    var d=new Date().toLocaleDateString('en-IN'),eng=engineer(),tabs=r.blocks.concat(r.walk?[r.walk]:[]);
    var pages=tabs.map(function(t,i){
      var fn=[];
      if(t.rows.some(function(x){return x.long}))fn.push('* Longer than the '+r.opts.stock+' mm stock pipe, so it must be spliced (splice design is not covered).');
      if(!t.plate&&t.mods)fn.push('Base plates are not listed: the plate size is not entered.');
      if(t.plate&&!plOk)fn.push('Base plate '+r.opts.plate.w+' x '+r.opts.plate.d+' x '+r.opts.plate.t+' mm is assumed from the reference BOM, not a design result.');
      return '<div class="ep-page"><div class="ep-ph"><b>'+esc(r.opts.name)+' · '+esc(t.name)+'</b><span>Fabrication BOM</span><span>Sheet '+(i+1)+' of '+tabs.length+' · '+d+'</span></div>'+
        '<div class="ep-pb" style="align-items:flex-start;justify-content:flex-start">'+tableHtml(t,{title:r.title,sub:subText(t),mat:r.mat})+'</div>'+
        '<div class="ep-pf">'+(fn.length?esc(fn.join(' '))+'<br>':'')+'PRELIMINARY – NOT FOR CONSTRUCTION. Weights follow the fabricator convention. Structural engineer to verify and sign off. '+(eng?'Engineer: '+esc(eng)+'.':'')+'</div></div>';
    }).join('');
    $('printSheet').innerHTML=pages;
    setTimeout(function(){try{var N=G.GenSolarNative;if(N&&typeof N.printPdfLandscape==='function')N.printPdfLandscape();else if(N&&typeof N.printPdf==='function')N.printPdf();else window.print()}catch(e){}},300);
  }

  function mount(){
    var sec=$('epc_p-bom');if(!sec||$('epcb'))return false;
    var h='<div id="epcb"><h2>Fabrication BOM</h2><p class="ep-note">The analysed structure in the fabricator\'s format. Every length comes from the same 3D model the Analysis checked.</p><div class="epcw-g" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0">';
    F.forEach(function(x){h+='<label>'+esc(x.l)+'<input id="epcb_'+x.id+'" '+(x.text?'type="text" maxlength="24"':'type="number" inputmode="decimal" min="'+x.min+'" step="'+x.step+'"')+'></label>'});
    h+='</div><div id="epcb_out" aria-live="polite"></div><h2 style="margin-top:22px">Layout cut list and material estimate</h2></div>';
    var d=document.createElement('div');d.innerHTML=h;sec.insertBefore(d.firstChild,sec.firstChild);
    return true;
  }
  var timer=null;
  function refresh(){clearTimeout(timer);timer=setTimeout(render,60)}
  function init(){
    if(!Eng||!mount())return;
    loadVals();
    var sec=$('epc_p-bom');
    sec.addEventListener('input',function(e){var id=e.target&&e.target.id;if(!id||id.indexOf('epcb_')!==0)return;if(/^epcb_pl/.test(id))plOk=true;saveVals();render()});
    var root=$('epcRoot')||document;
    root.addEventListener('input',function(e){if(e.target&&e.target.id==='engSite'){saveVals();refresh()}},true);
    document.addEventListener('epc:analysis',refresh);
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadVals();refresh()},90)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){loadVals();refresh()},220)})});
    render();
  }
  G.EPCBom.compute=compute;G.EPCBom.csv=function(){return last&&last.state==='ok'?csvOf(last):''};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,150)});else setTimeout(init,150);
})();
