/* EPC Analysis tab: inputs, results, 2D and 3D views and engineering drawings on top of EPCAnalysisEngine.
   PRELIMINARY: never approved here. Works only inside the Engineering (EPC) tab. */
(function(){
  'use strict';
  var KEY='gs_epc_analysis_v1',RAD=Math.PI/180,Eng=window.EPCAnalysisEngine,F=window.EPCFem;
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  function layout(){try{return JSON.parse(localStorage.getItem('gs_epc_v1'))}catch(e){return null}}

  /* ---------- fields ---------- */
  var G=[
   {t:'Column and bracing sections (required)',f:[
    {id:'colType',l:'Column section type',sel:['CHS','RHS'],def:'CHS'},{id:'colB',l:'Column pipe diameter, or width b (mm)',min:10,step:0.1},{id:'colH',l:'Column depth h in the frame plane (mm) (RHS only)',min:10,step:1},{id:'colT',l:'Column wall t (mm)',min:1,step:0.1},
    {id:'brcType',l:'Brace and tie section type',sel:['CHS','RHS'],def:'CHS'},{id:'brcB',l:'Brace pipe diameter, or width b (mm)',min:10,step:0.1},{id:'brcH',l:'Brace depth h (mm) (RHS only)',min:10,step:1},{id:'brcT',l:'Brace wall t (mm)',min:1,step:0.1}]},
   {t:'Supports and design factors (required)',f:[
    {id:'base',l:'Column base fixity',sel:['Pinned','Fixed']},
    {id:'K',l:'Effective length factor K',min:0.5,step:0.05,hint:'IS 800 Table 11, from your engineer. Applied to every compression member over its full length'},
    {id:'bclass',l:'Buckling class (IS 800 Table 7)',sel:['a','b','c','d'],hint:'Hot-rolled hollow a, cold-formed hollow b, per the section'}]},
   {t:'Layout assumptions (confirm against the fabrication drawing)',f:[
    {id:'brcFrac',l:'Brace top, fraction of the tallest column height',min:0.1,step:0.05,def:'0.75',hint:'Layout cut list: brace = hypot(column span, 0.75 × top height)'},
    {id:'tieFrac',l:'Column tie height, fraction of column height',min:0.1,step:0.05,def:'0.6',hint:'The Layout 3D view draws the column ties at 0.6 of the column height'},
    {id:'swayLim',l:'Sway limit, height / ?',min:50,step:5,def:'150',hint:'IS 800 Table 6, per your engineer'}]}
  ];
  var ALL=[];G.forEach(function(g){g.f.forEach(function(x){ALL.push(x)})});
  var cfg={view:'3d',mode:'util',combo:'1.5DL+1.5WL(down)',frame:0,az:35,el:28,blk:0,defl:1,names:1};
  var result={state:'missing',missing:['Complete Wind & Structure first']},run=null,runs=[];

  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function saveVals(){var all=loadAll(),o={_rev:REV};ALL.forEach(function(x){var e=$('epca2_'+x.id);if(e)o[x.id]=e.value});all[projName()]=o;try{localStorage.setItem(KEY,JSON.stringify(all))}catch(e){}}
  /* REV 2: the column tie default moved from 0.75 to 0.6, the height the Layout draws. A 0.75 saved before this revision is the old
     default, not a decision, so it is dropped once and the new default applies. */
  var REV=2;
  function loadVals(){var o=loadAll()[projName()]||{};if((o._rev||1)<REV&&o.tieFrac==='0.75')delete o.tieFrac;ALL.forEach(function(x){var e=$('epca2_'+x.id);if(e)e.value=o[x.id]!==undefined?o[x.id]:(x.def||'')})}
  function nv(id){var e=$('epca2_'+id);if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}

  /* ---------- compute ---------- */
  function gather(){
    var I={},miss=[];
    ALL.forEach(function(x){
      var e=$('epca2_'+x.id);
      if(x.sel){I[x.id]=e?e.value:'';if(!I[x.id])miss.push(x.l);return}
      if((x.id==='colH'&&I.colType==='CHS')||(x.id==='brcH'&&I.brcType==='CHS')){I[x.id]=0;return}
      var n=nv(x.id);if(!isFinite(n)||n<x.min){miss.push(x.l+(isFinite(n)?' (out of range)':''));I[x.id]=NaN}else I[x.id]=n;
    });
    return {I:I,miss:miss};
  }
  function compute(){
    run=null;runs=[];
    var W=window.EPCWind&&window.EPCWind.status();
    if(!W||W.state==='missing'){result={state:'missing',missing:['Wind & Structure inputs are incomplete (loads, spans and the purlin and rafter sections come from there)'].concat(W&&W.missing?W.missing:[])};return result}
    var S=layout();if(!S||!S.blocks){result={state:'missing',missing:['Layout is not available']};return result}
    var g=gather();if(g.miss.length){result={state:'missing',missing:g.miss};return result}
    var bi=Math.min(cfg.blk,S.blocks.length-1);cfg.blk=bi;
    var errs={},eo=[],fails=[],nm=function(i){return S.blocks[i].name||('Block '+(i+1))};
    S.blocks.forEach(function(b,i){
      var r;try{r=Eng.analyse(S,i,W,g.I)}catch(e){r={error:'Analysis failed: '+e.message}}
      if(r.error){if(!errs[r.error]){errs[r.error]=[];eo.push(r.error)}errs[r.error].push(nm(i));return}
      runs[i]=r;r.fails.forEach(function(x){fails.push(nm(i)+' · '+x)});
    });
    if(eo.length){runs=[];result={state:'missing',missing:eo.map(function(m){return errs[m].length===S.blocks.length?m:errs[m].join(', ')+': '+m})};return result}
    run=runs[bi];
    result={state:fails.length?'fail':'pass',missing:[],fails:fails,text:fails.length?fails.slice(0,4).join('; '):'Preliminary analysis passes for every block',block:nm(bi),blocks:runs.map(function(r,i){return {name:nm(i),state:r.state}})};
    return result;
  }

  /* ---------- 3D / 2D renderer ---------- */
  function ucol(u){return u>=1?'#c62828':'hsl('+Math.round(120*(1-Math.min(1,u)))+',70%,40%)'}
  function stationsFor(r,combo,mi){var cr=r.cres[combo];return F.stations(r.res,cr,mi,8,r.members[mi].sec)}
  function viewSvg(r,o){
    var W=o.W||980,H=o.H||o.W*0.62||600,az=o.az*RAD,el=o.el*RAD,ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    var inc=[];r.members.forEach(function(m,mi){
      if(o.frame!=null){var xa=r.nodes[m.a][0],xb=r.nodes[m.b][0],fx=o.fx;if(Math.abs(xa-fx)>1e-6||Math.abs(xb-fx)>1e-6)return}
      inc.push(mi)});
    function P(p){var X=p[0]*ca-p[1]*sa,Yd=p[0]*sa+p[1]*ca;return [X,-(p[2]*ce+Yd*se)]}
    var def=null,size=0,minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
    r.nodes.forEach(function(p){var q=P(p);minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0]);miny=Math.min(miny,q[1]);maxy=Math.max(maxy,q[1])});
    size=Math.max(maxx-minx,maxy-miny,1e-6);
    var maxD=1e-12,cr=r.cres[o.combo];
    if(o.mode==='defl'){cr.disp.forEach(function(d){maxD=Math.max(maxD,Math.hypot(d[0],d[1],d[2]))});def=0.07*size/maxD*(o.defl||1)}
    /* diagram scale */
    var dscale=0,dmax=1e-12,dstat={};
    if(/^(my|mz|vz|n)$/.test(o.mode)){
      inc.forEach(function(mi){var st=stationsFor(r,o.combo,mi);dstat[mi]=st;st.forEach(function(p){var v=o.mode==='my'?p.My:o.mode==='mz'?p.Mz:o.mode==='vz'?p.Vz:p.N;if(r.members[mi].type==='truss'&&o.mode!=='n')return;dmax=Math.max(dmax,Math.abs(v))})});
      dscale=0.09*size/dmax;
    }
    var pad=40;
    /* second pass: expand bounds with deformed / diagram geometry */
    function pos(mi,t,dsp){
      var m=r.members[mi],a=r.nodes[m.a],b=r.nodes[m.b],p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
      if(dsp){var da=cr.disp[m.a],db=cr.disp[m.b];for(var k=0;k<3;k++)p[k]+=def*(da[k]+(db[k]-da[k])*t)}
      return p;
    }
    var shapes=[],lines='',txt='';
    var sc,ox,oy;
    function T(q){return [ox+(q[0]-minx)*sc,oy+(q[1]-miny)*sc]}
    sc=Math.min((W-2*pad)/(maxx-minx||1),(H-2*pad)/(maxy-miny||1));
    ox=pad+((W-2*pad)-(maxx-minx)*sc)/2;oy=pad+((H-2*pad)-(maxy-miny)*sc)/2;
    function pt(p){var q=T(P(p));return q[0].toFixed(1)+','+q[1].toFixed(1)}
    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="'+esc(o.label||'Structure view')+'" style="background:var(--surface,#fff);border:1px solid var(--line,#d8e0e8);border-radius:8px">';
    /* ground grid at z=0 for 3D */
    if(o.ground){var gx0=-0.5,gx1=r.c.purlinLen/1000+0.5,gy0=-0.5,gy1=r.c.rafterLen*r.c.ct/1000+0.5;
      s+='<polygon points="'+pt([gx0,gy0,0])+' '+pt([gx1,gy0,0])+' '+pt([gx1,gy1,0])+' '+pt([gx0,gy1,0])+'" fill="rgba(120,130,140,.08)" stroke="rgba(120,130,140,.35)" stroke-dasharray="4 3"/>'}
    /* undeformed ghost */
    if(o.mode==='defl')inc.forEach(function(mi){s+='<polyline points="'+pt(pos(mi,0))+' '+pt(pos(mi,1))+'" stroke="rgba(120,130,140,.45)" stroke-width="1.2" fill="none"/>'});
    inc.forEach(function(mi){
      var m=r.members[mi],mm=r.mem[mi],w=mm.kind==='column'?3.2:mm.kind==='rafter'?2.8:mm.kind==='purlin'?1.8:1.4,col='currentColor',dash='';
      if(o.mode==='util')col=ucol(r.elUtil[mi]);
      if(mm.kind==='tie'||mm.kind==='brace')dash=' stroke-dasharray="5 3"';
      if(o.mode==='defl'){
        var st=stationsFor(r,o.combo,mi),R=r.res.mem[mi].R,pts=[];
        for(var k=0;k<=8;k++){var t=k/8,p=pos(mi,t,true),sv=st[k];
          if(m.type==='beam')for(var q=0;q<3;q++)p[q]+=def*(sv.dv*R[1][q]+sv.dw*R[2][q]);
          pts.push(pt(p))}
        s+='<polyline points="'+pts.join(' ')+'" stroke="#1565c0" stroke-width="'+w+'" fill="none" stroke-linecap="round"'+dash+'/>';
      }else if(dstat[mi]&&m.type==='beam'){
        s+='<polyline points="'+pt(pos(mi,0))+' '+pt(pos(mi,1))+'" stroke="currentColor" stroke-width="1.6" fill="none"/>';
        var st2=dstat[mi],R2=r.res.mem[mi].R,poly=[pt(pos(mi,0))],dir=o.mode==='mz'?R2[1]:R2[2],sg=o.mode==='mz'?-1:1,mx=0,mxk=0;
        for(var k2=0;k2<=8;k2++){var v=o.mode==='my'?st2[k2].My:o.mode==='mz'?st2[k2].Mz:o.mode==='vz'?st2[k2].Vz:st2[k2].N,p2=pos(mi,k2/8);
          for(var q2=0;q2<3;q2++)p2[q2]+=sg*v*dscale*dir[q2];poly.push(pt(p2));if(Math.abs(v)>Math.abs(mx)){mx=v;mxk=k2}}
        poly.push(pt(pos(mi,1)));
        s+='<polygon points="'+poly.join(' ')+'" fill="rgba(21,101,192,.18)" stroke="#1565c0" stroke-width="1.2"/>';
        if(o.labels&&Math.abs(mx)>0.02*dmax){var pl=T(P(pos(mi,mxk/8)));s+='<text x="'+(pl[0]+3)+'" y="'+(pl[1]-3)+'" font-size="10" fill="#0d47a1">'+f(mx,2)+'</text>'}
      }else if(o.mode==='n'&&dstat[mi]&&m.type==='truss'){
        var N=dstat[mi][4].N;s+='<polyline points="'+pt(pos(mi,0))+' '+pt(pos(mi,1))+'" stroke="'+(N>=0?'#c62828':'#1565c0')+'" stroke-width="2.4" fill="none"'+dash+'/>';
        if(o.labels){var pl2=T(P(pos(mi,0.5)));s+='<text x="'+(pl2[0]+3)+'" y="'+(pl2[1]-3)+'" font-size="10" fill="'+(N>=0?'#c62828':'#1565c0')+'">'+f(N,1)+'</text>'}
      }else{
        s+='<polyline points="'+pt(pos(mi,0))+' '+pt(pos(mi,1))+'" stroke="'+col+'" stroke-width="'+w+'" fill="none" stroke-linecap="round"'+dash+'/>';
      }
    });
    /* supports */
    r.reacts.forEach(function(b){
      if(o.frame!=null&&Math.abs(b.p[0]-o.fx)>1e-6)return;var q=T(P(b.p)),fixed=r.P.fixed;
      s+=fixed?'<rect x="'+(q[0]-6)+'" y="'+q[1]+'" width="12" height="5" fill="#455a64"/>':'<polygon points="'+q[0]+','+q[1]+' '+(q[0]-6)+','+(q[1]+9)+' '+(q[0]+6)+','+(q[1]+9)+'" fill="#455a64"/>';
    });
    if(o.labels)inc.forEach(function(mi){var m=r.members[mi],mm=r.mem[mi];if(mm.kind==='purlin'&&o.frame!=null)return;var q=T(P(pos(mi,0.5)));s+='<text x="'+(q[0]+4)+'" y="'+(q[1]+11)+'" font-size="9" fill="currentColor" opacity=".75">'+esc(mm.label)+'</text>'});
    s+='</svg>';
    return s;
  }
  function legend(mode){
    if(mode==='util')return '<div class="meta" style="display:flex;gap:8px;align-items:center;margin:4px 0"><span>Utilisation</span><span style="flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,hsl(120,70%,40%),hsl(60,70%,40%),hsl(0,70%,40%))"></span><span>0</span><span>1.0 +</span></div>';
    if(mode==='defl')return '<div class="meta">Deformed shape (blue) against the original (grey). Displacements are enlarged for visibility.</div>';
    if(mode==='my')return '<div class="meta">Bending moment My (kNm), plotted on the tension side. This is the in-plane moment of columns and rafters and the strong-axis moment of purlins.</div>';
    if(mode==='mz')return '<div class="meta">Bending moment Mz (kNm), plotted on the tension side. This is the weak-axis moment.</div>';
    if(mode==='vz')return '<div class="meta">Shear Vz (kN) in the strong plane. The sign follows the member local axis.</div>';
    if(mode==='n')return '<div class="meta">Axial force N (kN), positive tension. Braces and ties: red tension, blue compression.</div>';
    return '';
  }

  /* ---------- results ---------- */
  function pill(ok){return '<span style="font-weight:700;color:'+(ok?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'">'+(ok?'OK':'FAIL')+'</span>'}
  var KIND={column:'Column',rafter:'Rafter',purlin:'Purlin',brace:'Brace',tie:'Tie'};
  function summary(r){
    var rows={},order=['column','rafter','purlin','brace','tie'];
    r.segs.forEach(function(sg){var k=sg.kind;if(!rows[k]||sg.worst>rows[k].worst)rows[k]=sg});
    var h='<div style="overflow-x:auto"><table class="epcw-m" style="width:100%;font-size:13px"><thead><tr><th>Group</th><th>Governing</th><th>Section</th><th>Combined</th><th>Slender KL/r</th><th>Deflection mm</th><th></th></tr></thead><tbody>';
    order.forEach(function(k){var sg=rows[k];if(!sg)return;var sec=sg.sec;
      h+='<tr><td>'+KIND[k]+'</td><td>'+esc(sg.label)+'</td><td>'+(sec.type==='CHS'?'CHS '+f(sec.b*1000,1)+'×'+f(sec.t*1000,1):'RHS '+f(sec.b*1000,0)+'×'+f(sec.h*1000,0)+'×'+f(sec.t*1000,1))+'</td><td>'+f(sg.util,2)+'</td><td>'+f(sg.KLr,0)+' / '+sg.slLimit+'</td><td>'+(sg.deflLimit?f(sg.defl,1)+' / '+f(sg.deflLimit,1):'–')+'</td><td>'+pill(r.segs.filter(function(x){return x.kind===k}).every(function(x){return x.ok}))+'</td></tr>'});
    return h+'</tbody></table></div>';
  }
  function allMembers(r){
    var h='<details><summary>All member segments ('+r.segs.length+')</summary><div style="overflow-x:auto"><table class="epcw-m" style="width:100%;font-size:12px"><thead><tr><th>Seg</th><th>L m</th><th>Nmax kN</th><th>Nmin kN</th><th>My kNm</th><th>Mz kNm</th><th>V kN</th><th>Comb.</th><th>KL/r</th><th>Defl</th><th></th></tr></thead><tbody>';
    r.segs.slice().sort(function(a,b){return b.worst-a.worst}).forEach(function(sg){
      h+='<tr><td>'+esc(sg.label)+'</td><td>'+f(sg.L,3)+'</td><td>'+f(sg.maxN,2)+'</td><td>'+f(sg.minN,2)+'</td><td>'+f(sg.maxMy,2)+'</td><td>'+f(sg.maxMz,2)+'</td><td>'+f(sg.maxV,2)+'</td><td>'+f(sg.util,2)+'</td><td>'+f(sg.KLr,0)+'</td><td>'+(sg.deflLimit?f(sg.defl,1):'–')+'</td><td>'+pill(sg.ok)+'</td></tr>'});
    return h+'</tbody></table></div></details>';
  }
  function reactTable(r){
    var h='<div style="overflow-x:auto"><table class="epcw-m" style="width:100%;font-size:12px"><thead><tr><th>Base</th><th>x, y m</th><th>Uplift kN</th><th>Compression kN</th><th>Shear kN</th><th>Base moment kNm</th><th>Anchor util.</th></tr></thead><tbody>';
    r.reacts.forEach(function(b,i){var fr=r.c.nRaf,ci=Math.floor(i%r.reacts.length);
      h+='<tr><td>'+(i+1)+'</td><td>'+f(b.p[0],2)+', '+f(b.p[1],2)+'</td><td>'+f(b.uplift,2)+'</td><td>'+f(b.comp,2)+'</td><td>'+f(b.shear,2)+'</td><td>'+f(b.moment,2)+'</td><td>'+f(b.anchorUtil,2)+'</td></tr>'});
    return h+'</tbody></table></div>';
  }
  function frameOpts(r){var o='';for(var j=0;j<r.c.nRaf;j++)o+='<option value="'+j+'"'+(cfg.frame===j?' selected':'')+'>Frame '+(j+1)+' (x = '+f((r.c.x0+j*r.c.fs)/1000,2)+' m)</option>';return o}
  function comboOpts(r){return r.ULS.concat(r.SLS).map(function(c){return '<option'+(cfg.combo===c.name?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')}
  function viewHtml(r){
    var modes=[['util','Utilisation'],['geom','Geometry'],['defl','Deformed'],['my','Moment My'],['mz','Moment Mz'],['vz','Shear Vz'],['n','Axial N']],views=[['3d','3D'],['frame','2D frame'],['plan','2D plan']];
    var h='<div class="epca-ctl" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center">'+
      views.map(function(v){return '<button type="button" class="btn sm '+(cfg.view===v[0]?'':'alt')+'" data-av="'+v[0]+'">'+v[1]+'</button>'}).join('')+
      '<select id="epca2_mode" aria-label="Display mode">'+modes.map(function(m){return '<option value="'+m[0]+'"'+(cfg.mode===m[0]?' selected':'')+'>'+m[1]+'</option>'}).join('')+'</select>'+
      '<select id="epca2_combo" aria-label="Load combination">'+comboOpts(r)+'</select>'+
      (cfg.view==='frame'?'<select id="epca2_frame" aria-label="Frame">'+frameOpts(r)+'</select>':'')+
      (cfg.view==='3d'?'<button type="button" class="btn alt sm" data-rot="-20">⟲</button><button type="button" class="btn alt sm" data-rot="20">⟳</button><button type="button" class="btn alt sm" data-tilt="8">⤒</button><button type="button" class="btn alt sm" data-tilt="-8">⤓</button>':'')+
      (cfg.mode==='defl'?'<label style="display:flex;gap:4px;align-items:center;font-size:12px">Enlarge ×<input id="epca2_defl" type="range" min="0.2" max="3" step="0.1" value="'+cfg.defl+'" style="width:90px"></label>':'')+
      '<label style="display:flex;gap:4px;align-items:center;font-size:12px"><input id="epca2_names" type="checkbox"'+(cfg.names?' checked':'')+'> Labels</label></div>';
    h+='<div id="epca2_svg">'+svgNow(r)+'</div>'+legend(cfg.mode);
    if(cfg.view==='3d')h+='<div class="meta">Drag the picture to rotate.</div>';
    return h;
  }
  function svgNow(r){
    var o={combo:cfg.combo,mode:cfg.mode==='geom'?'geom':cfg.mode,labels:!!cfg.names,defl:cfg.defl,W:980,H:cfg.view==='3d'?600:(cfg.view==='plan'?520:460)};
    if(cfg.view==='3d'){o.az=cfg.az;o.el=cfg.el;o.ground=true;o.label='3D view'}
    else if(cfg.view==='frame'){o.az=-90;o.el=0;o.frame=cfg.frame;o.fx=(r.c.x0+cfg.frame*r.c.fs)/1000;o.label='2D frame'}
    else{o.az=0;o.el=90;o.label='2D plan'}
    return viewSvg(r,o);
  }

  /* ---------- drawings ---------- */
  function sheet(title,body,n,total,block,eng){
    var d=new Date().toLocaleDateString('en-IN');
    return '<div class="ep-page"><div class="ep-ph"><b>'+esc(projName())+' · '+esc(block||'')+'</b><span>'+esc(title)+'</span><span>Sheet '+n+' of '+total+' · '+d+'</span></div><div class="ep-pb">'+body+'</div><div class="ep-pf">PRELIMINARY – NOT FOR CONSTRUCTION. First-order linear analysis, IS 800 limit state. Structural engineer to verify and sign off. '+(eng?'Engineer: '+esc(eng)+'.':'Engineer: not entered.')+'</div></div>';
  }
  function tableSvgHtml(head,rows){
    return '<table class="ep-memb" style="font-size:10px;width:100%"><thead><tr>'+head.map(function(h){return '<th>'+esc(h)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  }
  function pagesFor(r){
    var W=window.EPCWind.status();
    var worst=r.ULS.reduce(function(b,c){var u=0;r.segs.forEach(function(sg){if(sg.combo===c.name&&sg.util>u)u=sg.util});return u>b.u?{n:c.name,u:u}:b},{n:r.ULS[0].name,u:-1}).n;
    var fx=(r.c.x0)/1000,mid=Math.floor(r.c.nRaf/2),fm=(r.c.x0+mid*r.c.fs)/1000;
    var pages=[];
    pages.push(['General arrangement, plan',viewSvg(r,{combo:worst,mode:'geom',labels:true,az:0,el:90,W:1000,H:560,label:'Plan'})]);
    pages.push(['Frame elevation, frame 1',viewSvg(r,{combo:worst,mode:'geom',labels:true,az:-90,el:0,frame:0,fx:fx,W:1000,H:560,label:'Frame elevation'})]);
    pages.push(['3D view, utilisation',viewSvg(r,{combo:worst,mode:'util',labels:false,az:35,el:28,ground:true,W:1000,H:600,label:'3D'})]);
    pages.push(['Bending moment My, frame '+(mid+1)+', '+worst,viewSvg(r,{combo:worst,mode:'my',labels:true,az:-90,el:0,frame:mid,fx:fm,W:1000,H:560,label:'BMD'})]);
    pages.push(['Axial force N, frame '+(mid+1)+', '+worst,viewSvg(r,{combo:worst,mode:'n',labels:true,az:-90,el:0,frame:mid,fx:fm,W:1000,H:560,label:'Axial'})]);
    pages.push(['Deformed shape, '+r.SLS[1].name,viewSvg(r,{combo:r.SLS[1].name,mode:'defl',defl:1,az:35,el:28,ground:true,W:1000,H:600,label:'Deformed'})]);
    var rows=r.segs.slice().sort(function(a,b){return a.kind<b.kind?-1:a.kind>b.kind?1:0}).map(function(sg){var s=sg.sec;
      return [sg.label,KIND[sg.kind],s.type==='CHS'?'CHS '+f(s.b*1000,1)+'x'+f(s.t*1000,1):'RHS '+f(s.b*1000,0)+'x'+f(s.h*1000,0)+'x'+f(s.t*1000,1),f(sg.L*1000,0),f(sg.maxN,1),f(sg.minN,1),f(sg.maxMy,2),f(sg.maxMz,2),f(sg.util,2),f(sg.KLr,0),sg.deflLimit?f(sg.defl,1)+'/'+f(sg.deflLimit,1):'-',sg.ok?'OK':'FAIL']});
    var head=['Mark','Type','Section','Length mm','N max kN','N min kN','My kNm','Mz kNm','Util.','KL/r','Defl. mm','Result'];
    var per=22,np=Math.ceil(rows.length/per);
    for(var p=0;p<np;p++)pages.push(['Member schedule '+(p+1)+'/'+np,tableSvgHtml(head,rows.slice(p*per,(p+1)*per))]);
    pages.push(['Base reactions and anchors',tableSvgHtml(['Base','x m','y m','Uplift kN','Compr. kN','Shear kN','Moment kNm','Anchor util.'],r.reacts.map(function(b,i){return [i+1,f(b.p[0],2),f(b.p[1],2),f(b.uplift,2),f(b.comp,2),f(b.shear,2),f(b.moment,2),f(b.anchorUtil,2)]}))]);
    return pages;
  }
  /* Every block gets its own full set of sheets, numbered through the whole set. */
  function drawings(){
    if(!run||!runs.length)return [];
    var eng=($('epcw_eng')||{}).value||'',all=[],nm=function(i){var l=layout();return (l&&l.blocks&&l.blocks[i]&&l.blocks[i].name)||('Block '+(i+1))};
    runs.forEach(function(r,i){if(!r)return;pagesFor(r).forEach(function(p){all.push({block:nm(i),title:p[0],body:p[1]})})});
    return all.map(function(p,i){return {block:p.block,title:p.title,html:sheet(p.title,p.body,i+1,all.length,p.block,eng)}});
  }
  function printDrawings(){
    var pg=drawings();if(!pg.length)return;
    $('printSheet').innerHTML=pg.map(function(p){return p.html}).join('');
    setTimeout(function(){try{var N=window.GenSolarNative;if(N&&typeof N.printPdfLandscape==='function')N.printPdfLandscape();else if(N&&typeof N.printPdf==='function')N.printPdf();else window.print()}catch(e){}},300);
  }

  /* ---------- render ---------- */
  function render(){
    var out=$('epca2_out');if(!out)return;
    var r=result,prog=$('epca2_prog'),total=ALL.length-3;
    if(r.state==='missing'){
      out.innerHTML='<div class="epca-warnings" style="margin-top:10px"><b>Not analysed yet.</b> Needed first:<ul style="margin:6px 0 0 18px">'+r.missing.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul></div>';
      if(prog)prog.textContent='Waiting for inputs';return;
    }
    var x=run;
    if(prog)prog.textContent=x.nNodes+' nodes, '+x.nMembers+' members analysed';
    var h='<div class="epca-warnings" style="margin-top:10px;border-color:'+(r.state==='pass'?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'"><b>'+(r.state==='pass'?'PRELIMINARY ANALYSIS PASSES':'ANALYSIS CHECKS FAIL')+'</b> — not approved. '+esc(r.state==='pass'?'Every member and anchor is within its limit for all IS 800 combinations.':r.fails.join('; '))+'</div>';
    h+='<div class="meta" style="margin-top:6px">All blocks: '+r.blocks.map(function(b){return esc(b.name)+' '+pill(b.state==='pass')}).join(' · ')+'</div>';
    h+='<h4 style="margin:12px 0 4px">Model</h4><div class="meta">'+esc(r.block)+': '+x.nNodes+' nodes, '+x.nMembers+' members, '+x.nNodes*6+' degrees of freedom. Frames '+x.c.nRaf+', columns per frame '+x.c.nCol+', rafter '+f(x.c.rafterLen,0)+' mm, purlin run '+f(x.c.purlinLen,0)+' mm. Largest displacement '+f(x.umax*1000,1)+' mm ('+esc(x.umaxAt.combo)+').</div>';
    if(x.p2)h+='<div class="meta" style="margin-top:6px">Second-order (P-Δ) analysis of the eight ultimate combinations: '+(x.p2.errors.length?'<b>UNSTABLE</b>':'largest displacement amplification <b>'+f(x.p2.amp,3)+'</b> ('+x.p2.iters+' pass'+(x.p2.iters>1?'es':'')+')')+'. Member and anchor checks use the larger of the first-order and second-order results.</div>';
    h+='<div id="epca2_view">'+viewHtml(x)+'</div>';
    h+='<h4 style="margin:12px 0 4px">Member checks (IS 800, γm0 = 1.10)</h4>'+summary(x)+
      '<div class="meta">Frame sway '+f(x.sway.val,1)+' / '+f(x.sway.lim,1)+' mm '+pill(x.sway.util<=1)+'</div>'+allMembers(x);
    h+='<h4 style="margin:12px 0 4px">Base reactions (envelope of the eight ultimate combinations)</h4>'+reactTable(x);
    h+='<h4 style="margin:12px 0 4px">Engineering drawings</h4><div class="meta">Plan, frame elevation, 3D, moment and axial diagrams, deformed shape, member schedule and base reactions, for every block ('+(r.blocks?r.blocks.length:1)+' block'+((r.blocks&&r.blocks.length>1)?'s':'')+').</div><button type="button" class="btn sm" id="epca2_print">Print / Save drawings as PDF</button>';
    if(x.warn.length)h+='<div class="epca-warnings" style="margin-top:10px">'+x.warn.map(esc).join('<br>')+'</div>';
    h+='<div class="epca-warnings" style="margin-top:10px"><b>Not covered (engineer must verify):</b> P-δ amplification along a member between its nodes (frame P-Δ is included), lateral-torsional buckling, connection and base-plate design, torsion, net-section and block-shear, fatigue, seismic loads, wind on the supporting structure itself and wind from other directions, roof capacity, foundations. Member self-weight of columns, braces and ties is not added (the structure allowance on the Wind tab covers purlins and rafters). Rafter-to-column and purlin-to-rafter joints are modelled rigid. Axial, bending and shear are checked with a linear interaction.</div>';
    out.innerHTML=h;
    bindView();
  }
  function refreshView(){
    var el=$('epca2_view');if(!el||!run)return;el.innerHTML=viewHtml(run);bindView();
  }
  function bindView(){
    var root=$('epca2_out');if(!root)return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-av]'),function(b){b.onclick=function(){cfg.view=b.getAttribute('data-av');refreshView()}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-rot]'),function(b){b.onclick=function(){cfg.az+=+b.getAttribute('data-rot');redraw()}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tilt]'),function(b){b.onclick=function(){cfg.el=Math.max(0,Math.min(89,cfg.el+ +b.getAttribute('data-tilt')));redraw()}});
    var m=$('epca2_mode');if(m)m.onchange=function(){cfg.mode=m.value;refreshView()};
    var c=$('epca2_combo');if(c)c.onchange=function(){cfg.combo=c.value;redraw()};
    var fr=$('epca2_frame');if(fr)fr.onchange=function(){cfg.frame=+fr.value;redraw()};
    var d=$('epca2_defl');if(d)d.oninput=function(){cfg.defl=+d.value;redraw()};
    var n=$('epca2_names');if(n)n.onchange=function(){cfg.names=n.checked?1:0;redraw()};
    var p=$('epca2_print');if(p)p.onclick=printDrawings;
    var box=$('epca2_svg');
    if(box&&cfg.view==='3d'){
      var drag=null;
      box.style.touchAction='none';box.style.cursor='grab';
      box.onpointerdown=function(e){drag={x:e.clientX,y:e.clientY,az:cfg.az,el:cfg.el};try{box.setPointerCapture(e.pointerId)}catch(x){}};
      box.onpointermove=function(e){if(!drag)return;cfg.az=drag.az+(e.clientX-drag.x)*0.4;cfg.el=Math.max(0,Math.min(89,drag.el+(e.clientY-drag.y)*0.3));redraw()};
      box.onpointerup=box.onpointercancel=function(){drag=null};
    }
  }
  function redraw(){var box=$('epca2_svg');if(box&&run)box.innerHTML=svgNow(run)}

  /* ---------- mount ---------- */
  function mount(){
    var sec=$('epc_p-analysis');if(!sec||$('epca2'))return false;
    var h='<div id="epca2"><div class="epca-head"><div><span class="epca-kicker">GENSOLAR EPC ENGINEERING</span><h2>Analysis (3D frame)</h2><p>Builds a 3D frame model of one Layout block, applies the Wind &amp; Structure loads and runs the IS 800 combinations (including wind along the rows). Preliminary: a structural engineer must verify and sign off.</p></div></div><div class="meta" id="epca2_prog"></div><label style="display:block;margin:8px 0">Block to analyse <select id="epca2_blk"></select></label>';
    G.forEach(function(g,i){
      h+='<details'+(i<2?' open':'')+'><summary>'+esc(g.t)+'</summary><div class="epcw-g">';
      g.f.forEach(function(x){
        var id='epca2_'+x.id,hint=x.hint?'<small>'+esc(x.hint)+'</small>':'';
        if(x.sel)h+='<label>'+esc(x.l)+'<select id="'+id+'">'+(x.def?'':'<option value="">Select</option>')+x.sel.map(function(o){return '<option>'+esc(o)+'</option>'}).join('')+'</select>'+hint+'</label>';
        else h+='<label>'+esc(x.l)+'<input id="'+id+'" type="number" inputmode="decimal" min="'+x.min+'" step="'+x.step+'">'+hint+'</label>';
      });
      h+='</div></details>';
    });
    h+='<div id="epca2_out" aria-live="polite"></div></div>';
    sec.innerHTML=h;return true;
  }
  function fillBlocks(){
    var s=layout(),e=$('epca2_blk');if(!e||!s||!s.blocks)return;
    var cur=cfg.blk;e.innerHTML=s.blocks.map(function(b,i){return '<option value="'+i+'">'+esc(b.name||('Block '+(i+1)))+'</option>'}).join('');
    cfg.blk=Math.min(cur,s.blocks.length-1);e.value=cfg.blk;
  }
  var timer=null;
  function refresh(){
    clearTimeout(timer);
    timer=setTimeout(function(){fillBlocks();compute();render();try{document.dispatchEvent(new CustomEvent('epc:analysis'))}catch(e){}if(window.EPCWind&&window.EPCWind.refreshLocks)window.EPCWind.refreshLocks();if(window.EPCSync&&window.EPCSync.refresh)window.EPCSync.refresh()},200);
  }
  function init(){
    if(!Eng||!F||!mount())return;
    loadVals();fillBlocks();
    var sec=$('epc_p-analysis');
    sec.addEventListener('input',function(e){if(e.target.id==='epca2_blk')return;saveVals();refresh()});
    sec.addEventListener('change',function(e){if(e.target.id==='epca2_blk'){cfg.blk=+e.target.value}if(e.target.id&&e.target.id.indexOf('epca2_')===0&&e.target.id!=='epca2_blk'&&!/^epca2_(mode|combo|frame|names|defl)$/.test(e.target.id))saveVals();
      if(/^epca2_(mode|combo|frame|names|defl)$/.test(e.target.id))return;refresh()});
    var root=$('epcRoot')||document;
    root.addEventListener('input',function(e){var t=e.target;if(!t||sec.contains(t))return;if(t.id==='engSite')saveVals();refresh()},true);
    root.addEventListener('change',function(e){if(sec.contains(e.target))return;refresh()},true);
    document.addEventListener('epc:linked',refresh);
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadVals();refresh()},60)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){loadVals();fillBlocks();refresh()},150)})});
    refresh();
  }
  window.EPCAnalysis={status:function(){return result},result:function(){return run},runs:function(){return runs},drawings:drawings};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,80)});else setTimeout(init,80);
})();
