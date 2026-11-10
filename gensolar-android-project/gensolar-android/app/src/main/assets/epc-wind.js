/* EPC Wind & Structure: IS 875 (Part 3) wind pressure and IS 800 (LSM) member and anchor checks, plus the step gate.
   PRELIMINARY: every code coefficient is entered by the user (nothing is looked up), results are never approved here. */
(function(){
  'use strict';
  var RAD=Math.PI/180,E_STEEL=200000,GM0=1.10,KEY='gs_epc_wind_v1';

  /* ================= engine ================= */
  function rhsProps(b,h,t){                       /* rectangular hollow section, rounded corners Ro=2t, Ri=t; load along h */
    if(!(b>0&&h>0&&t>0)||2*t>=Math.min(b,h))return null;
    function rr(B,H,Rc){var As=Rc*Rc*(1-Math.PI/4),Ics=Math.pow(Rc,4)*(1/3-Math.PI/16),yo=H/2-Rc,Isp=yo*yo*As+2*yo*(Rc*Rc*Rc/6)+Ics;return {A:B*H-4*As,I:B*H*H*H/12-4*Isp}}   /* exact rounded rectangle */
    function integ(B,H){var o=rr(B,H,2*t),i=rr(B-2*t,H-2*t,t);return {A:o.A-i.A,I:o.I-i.I}}                  /* tube: outer radius 2t, inner radius t */
    var x=integ(b,h),y2=integ(h,b);               /* x: bending about axis parallel to b (strong when h>b) */
    return {A:x.A,Ix:x.I,Iy:y2.I,Zx:x.I/(h/2),Zy:y2.I/(b/2),Av:x.A*h/(b+h)};
  }
  function chsProps(D,t){                          /* circular hollow section, mm units */
    if(!(D>0&&t>0)||2*t>=D)return null;
    var d=D-2*t,A=Math.PI/4*(D*D-d*d),I=Math.PI/64*(Math.pow(D,4)-Math.pow(d,4));
    return {A:A,Ix:I,Iy:I,Zx:I/(D/2),Zy:I/(D/2),Av:2*A/Math.PI,chs:true,D:D,t:t};
  }
  function windPressure(p){
    var Vz=p.Vb*p.k1*p.k2*p.k3*p.k4,pz=0.6*Vz*Vz,pd=p.Kd*p.Ka*p.Kc*pz;
    return {Vz:Vz,pz:pz,pd:pd};                   /* N/m2 */
  }
  /* member under a UDL of unit-area pressures. L in m, s (tributary width) in m. Returns utilisation by combo. */
  function memberCheck(sec,fy,L,s,loads,limit,biaxial){
    var pr=sec.circ?chsProps(sec.b,sec.t):rhsProps(sec.b,sec.h,sec.t);if(!pr)return {error:'Section dimensions are not valid (wall thickness must be less than half the smaller side).'};
    var eps=Math.sqrt(250/fy),slender=sec.circ?(sec.b/sec.t>146*eps*eps):(Math.max((sec.b-3*sec.t)/sec.t,(sec.h-3*sec.t)/sec.t)>42*eps);
    var Mdx=pr.Zx*fy/GM0/1e6,Mdy=pr.Zy*fy/GM0/1e6,Vd=pr.Av*fy/(Math.sqrt(3)*GM0)/1e3; /* kNm, kNm, kN */
    var reduced=false;
    if(!sec.circ&&window.EPCThin){                    /* thin-wall box: effective-width properties replace the slender fail */
      var tx=window.EPCThin.rect(sec.b,sec.h,sec.t,fy),ty=window.EPCThin.rect(sec.h,sec.b,sec.t,fy);
      if(tx&&ty){reduced=tx.reduced||ty.reduced;slender=tx.tooThin||tx.shearBuckling||ty.tooThin;
        Mdx=Math.min(pr.Zx,tx.W)*fy/GM0/1e6;Mdy=Math.min(pr.Zy,ty.W)*fy/GM0/1e6}
    }
    var combos=[],g=null,gu=0,gs=-1;
    loads.ult.forEach(function(c){
      var w=c.n*s,ws=biaxial?c.s*s:0;             /* kN/m */
      var Mx=Math.abs(w)*L*L/8,My=Math.abs(ws)*L*L/8,V=Math.abs(w)*L/2;
      var u=Mx/Mdx+(biaxial?My/Mdy:0),us=V/Vd;
      combos.push({name:c.name,w:w,Mx:Mx,My:My,V:V,util:u,shearUtil:us});
      if(u>gu){gu=u;g=combos[combos.length-1]}
      if(us>gs)gs=us;
    });
    var dmax=0,dname='';
    loads.ser.forEach(function(c){var w=Math.abs(c.n*s);var d=5*w*Math.pow(L*1000,4)/(384*E_STEEL*pr.Ix);if(d>dmax){dmax=d;dname=c.name}});
    var dlim=L*1000/limit;
    return {props:pr,eps:eps,slender:slender,reduced:reduced,Mdx:Mdx,Mdy:Mdy,Vd:Vd,combos:combos,gov:g,maxUtil:gu,maxShear:gs,
            defl:dmax,deflCombo:dname,deflLimit:dlim,deflUtil:dmax/dlim,
            ok:!slender&&gu<=1&&gs<=1&&dmax<=dlim};
  }
  function loadSets(q,beta,wd,wu){                /* q: dead,live kN/m2 on slope area; wd,wu kN/m2 normal pressures */
    var c=Math.cos(beta),sn=Math.sin(beta),g=q.dead,l=q.live;
    var ult=[
      {name:'1.5(DL+LL)',n:1.5*(g+l)*c,s:1.5*(g+l)*sn},
      {name:'1.5DL+1.5WL(down)',n:1.5*g*c+1.5*wd,s:1.5*g*sn},
      {name:'1.2(DL+LL+WL down)',n:1.2*(g*c+l*c+wd),s:1.2*(g+l)*sn},
      {name:'0.9DL+1.5WL(uplift)',n:0.9*g*c-1.5*wu,s:0.9*g*sn}
    ];
    var ser=[{name:'DL+LL',n:(g+l)*c},{name:'DL+WL(down)',n:g*c+wd},{name:'DL+WL(uplift)',n:g*c-wu}];
    return {ult:ult,ser:ser};
  }
  function anchors(q,beta,wu,fs,Lr,nb,Tcap,Vcap){  /* per column: slope area carried = fs * Lr/2 */
    var Ac=fs*Lr/2,c=Math.cos(beta),sn=Math.sin(beta);
    var D=q.dead*Ac;                              /* kN dead per column (vertical) */
    var T=1.5*wu*c*Ac-0.9*D;                      /* factored net uplift per column */
    var H=1.5*wu*sn*Ac;                           /* horizontal at base for the uplift case */
    var out={Ac:Ac,dead:D,uplift:T,horiz:H,compression:1.5*(q.dead+q.live)*Ac};
    if(T>0){var t=T/nb,v=H/nb;out.perBoltT=t;out.perBoltV=v;out.util=Math.pow(t/Tcap,2)+Math.pow(v/Vcap,2);out.tUtil=t/Tcap;out.vUtil=v/Vcap;out.needsAnchor=true}
    else{out.needsAnchor=false;out.util=0;var v2=H/nb;out.perBoltV=v2;out.vUtil=v2/Vcap;out.util=Math.pow(v2/Vcap,2)}
    out.foundationWeightMin=Math.max(0,1.5*wu*c*Ac/0.9-D);   /* 0.9(D+Wf) >= 1.5 Wu,v */
    return out;
  }
  window.EPCWindEngine={rhsProps:rhsProps,chsProps:chsProps,windPressure:windPressure,memberCheck:memberCheck,loadSets:loadSets,anchors:anchors};

  /* ================= field spec ================= */
  var G=[
   {t:'Building and survey (required)',f:[
    {id:'h',l:'Building height to roof (m)',min:0.1,step:0.1,hint:'Surveyed, including parapet if the array sits on the roof'},
    {id:'parapet',l:'Parapet height (m)',min:0,step:0.05,hint:'Enter 0 if none',zero:1},
    {id:'terrain',l:'Terrain category (IS 875-3)',sel:['1','2','3','4']},
    {id:'roofType',l:'Roof / structure type',sel:['RCC roof','Metal shed roof','Elevated structure','Multiple structures']},
    {id:'survey',l:'Roof survey done on site (not satellite only)',chk:1}]},
   {t:'Wind inputs from IS 875 (Part 3) (required)',f:[
    {id:'Vb',l:'Basic wind speed Vb (m/s)',min:1,step:0.1,hint:'From the IS 875-3 map or Appendix A for this location'},
    {id:'k1',l:'k1 risk coefficient',min:0.1,step:0.01,hint:'Table 1; 1.00 for 50-year life'},
    {id:'k2',l:'k2 terrain and height factor',min:0.1,step:0.01,hint:'Table 2 for terrain category, class and height'},
    {id:'k3',l:'k3 topography factor',min:0.1,step:0.01,hint:'1.00 on flat ground'},
    {id:'k4',l:'k4 importance factor',min:0.1,step:0.01,hint:'1.00 for general buildings'},
    {id:'Kd',l:'Kd wind directionality',min:0.1,step:0.01,hint:'0.90 for buildings'},
    {id:'Ka',l:'Ka area averaging',min:0.1,step:0.01,hint:'1.00 if not applied'},
    {id:'Kc',l:'Kc combination factor',min:0.1,step:0.01,hint:'1.00 or 0.90 per code'},
    {id:'cUpF',l:'Net uplift coefficient, field zone',min:0.01,step:0.01,hint:'Positive number, away from the surface'},
    {id:'cUpE',l:'Net uplift coefficient, edge / corner',min:0.01,step:0.01,hint:'Governs member design'},
    {id:'cDn',l:'Net downward coefficient',min:0.01,step:0.01,hint:'Positive number, toward the surface'}]},
   {t:'Loads (required)',f:[
    {id:'modKg',l:'Module weight (kg)',min:1,step:0.1},
    {id:'strKn',l:'Structure self-weight allowance (kN/m²)',min:0,step:0.01,hint:'Purlins, rafters, clamps',zero:1},
    {id:'llKn',l:'Live / maintenance load (kN/m²)',min:0,step:0.05,hint:'Enter 0 only if your engineer confirms none',zero:1},
    {id:'nPur',l:'Purlins per module row',min:1,step:1,hint:'Usually 2'}]},
   {t:'Purlin and rafter sections (required)',f:[
    {id:'fy',l:'Steel yield strength fy (MPa)',min:100,step:5,hint:'IS 2062 E250 = 250, E350 = 350'},
    {id:'lim',l:'Deflection limit, span / ?',min:50,step:5,hint:'e.g. 180 for purlins, per your engineer'},
    {id:'pType',l:'Purlin section type',sel:['RHS','CHS'],def:'RHS'},{id:'pb',l:'Purlin width b, or pipe diameter (mm)',min:10,step:0.1},{id:'ph',l:'Purlin depth h (mm), normal to roof (RHS only)',min:10,step:1},{id:'pt',l:'Purlin wall t (mm)',min:1,step:0.1},
    {id:'rType',l:'Rafter section type',sel:['RHS','CHS'],def:'RHS'},{id:'rb',l:'Rafter width b, or pipe diameter (mm)',min:10,step:0.1},{id:'rh',l:'Rafter depth h (mm) (RHS only)',min:10,step:1},{id:'rt',l:'Rafter wall t (mm)',min:1,step:0.1}]},
   {t:'Column anchors (required)',f:[
    {id:'nb',l:'Anchor bolts per column',min:1,step:1},
    {id:'tcap',l:'Design tension capacity per bolt (kN)',min:0.1,step:0.1,hint:'IS 800 cl. 10.3 or bolt supplier, design value'},
    {id:'vcap',l:'Design shear capacity per bolt (kN)',min:0.1,step:0.1,hint:'Design value'}]},
   {t:'Sign-off (optional)',f:[{id:'eng',l:'Structural engineer name / registration',text:1,opt:1}]}
  ];
  var ALL=[];G.forEach(function(g){g.f.forEach(function(f){ALL.push(f)})});

  /* ================= helpers ================= */
  function $(id){return document.getElementById(id)}
  function q(s){return document.querySelector(s)}
  function nv(sel){var e=typeof sel==='string'?(sel.charAt(0)==='#'||sel.charAt(0)==='['?q(sel):$(sel)):sel;if(!e||e.value==='')return NaN;var x=parseFloat(e.value);return isFinite(x)?x:NaN}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function projName(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  function loadAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function saveVals(){var all=loadAll(),o={};ALL.forEach(function(x){var e=$('epcw_'+x.id);if(e)o[x.id]=x.chk?e.checked:e.value});all[projName()]=o;try{localStorage.setItem(KEY,JSON.stringify(all))}catch(e){}}
  function loadVals(){var o=loadAll()[projName()]||{};ALL.forEach(function(x){var e=$('epcw_'+x.id);if(!e)return;if(x.chk)e.checked=!!o[x.id];else e.value=o[x.id]!==undefined?o[x.id]:(x.def||'')})}

  /* ================= state / results ================= */
  var result={state:'missing',missing:[],text:''};
  function gather(){
    var v={},miss=[];
    ALL.forEach(function(x){
      if(x.opt)return;var e=$('epcw_'+x.id);
      if((x.id==='ph'&&($('epcw_pType')||{}).value==='CHS')||(x.id==='rh'&&($('epcw_rType')||{}).value==='CHS')){v[x.id]=0;return}
      if(x.chk){v[x.id]=!!(e&&e.checked);if(!v[x.id])miss.push(x.l);return}
      if(x.sel){v[x.id]=e?e.value:'';if(!v[x.id])miss.push(x.l);return}
      var n=nv(e);
      if(!isFinite(n)||n<x.min||(n===0&&!x.zero&&x.min>0)){miss.push(x.l+(isFinite(n)?' (out of range)':''));v[x.id]=NaN}else v[x.id]=n;
    });
    return {v:v,miss:miss};
  }
  function layoutInputs(){
    var fs=nv('[data-k="frameSpacing"]'),cs=nv('[data-k="colSpacingH"]'),gap=nv('[data-k="gap"]'),tilt=nv('engTilt'),
        ml=nv('epca_module_l'),mw=nv('epca_module_w'),port=($('epca_orientation')||{}).value!=='landscape';
    return {fs:fs,cs:cs,gap:isFinite(gap)?gap:0,tilt:tilt,ml:ml,mw:mw,port:port};
  }
  function compute(){
    var G0=gather(),L=layoutInputs(),miss=G0.miss.slice(),v=G0.v;
    if(!(L.fs>0))miss.push('Layout: frame spacing (mm)');
    if(!(L.cs>0))miss.push('Layout: column spacing (mm)');
    if(!(L.tilt>=0&&L.tilt<=60))miss.push('Array tilt on Site (0–60°)');
    if(!(L.ml>0&&L.mw>0))miss.push('Module length and width (Auto Design)');
    if(miss.length){result={state:'missing',missing:miss};return result}
    var beta=L.tilt*RAD,depth=L.port?L.ml:L.mw,area=L.ml*L.mw;
    var w=windPressure(v),pd=w.pd/1000;                       /* kN/m2 */
    var wu=pd*Math.max(v.cUpF,v.cUpE),wd=pd*v.cDn;
    var q={dead:v.modKg*9.81/1000/area+v.strKn,live:v.llKn};
    var s=(depth+L.gap/1000)/v.nPur,Lp=L.fs/1000,Lr=(L.cs/1000)/Math.cos(beta);
    var ls=loadSets(q,beta,wd,wu);
    var pur=memberCheck({b:v.pb,h:v.ph,t:v.pt,circ:v.pType==='CHS'},v.fy,Lp,s,ls,v.lim,true);
    var raf=memberCheck({b:v.rb,h:v.rh,t:v.rt,circ:v.rType==='CHS'},v.fy,Lr,L.fs/1000,ls,v.lim,false);
    if(pur.error||raf.error){result={state:'missing',missing:[pur.error||raf.error]};return result}
    var anc=anchors(q,beta,wu,L.fs/1000,Lr,v.nb,v.tcap,v.vcap);
    var fails=[];
    function chk(name,m){
      if(m.slender)fails.push(name+' section is slender (not covered by this check)');
      if(m.maxUtil>1)fails.push(name+' bending utilisation '+f(m.maxUtil,2)+' > 1');
      if(m.maxShear>1)fails.push(name+' shear utilisation '+f(m.maxShear,2)+' > 1');
      if(m.defl>m.deflLimit)fails.push(name+' deflection '+f(m.defl,1)+' mm > '+f(m.deflLimit,1)+' mm');
    }
    chk('Purlin',pur);chk('Rafter',raf);
    if(anc.util>1)fails.push('Anchor bolts utilisation '+f(anc.util,2)+' > 1');
    result={state:fails.length?'fail':'pass',missing:[],fails:fails,v:v,L:L,beta:beta,depth:depth,area:area,w:w,pd:pd,wu:wu,wd:wd,q:q,s:s,Lp:Lp,Lr:Lr,pur:pur,raf:raf,anc:anc,
            text:fails.length?fails.join('; '):'Preliminary checks pass'};
    return result;
  }

  /* ================= rendering ================= */
  function row(a,b,c){return '<tr><td>'+a+(c?'<br><small style="opacity:.7">'+c+'</small>':'')+'</td><td style="text-align:right"><b>'+b+'</b></td></tr>'}
  function pill(ok){return '<span style="font-weight:700;color:'+(ok?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'">'+(ok?'OK':'FAIL')+'</span>'}
  function diagram(r){
    var W=330,H=170,b=r.beta,x0=40,y0=120,len=210,x1=x0+len*Math.cos(b),y1=y0-len*Math.sin(b);
    var mx=(x0+x1)/2,my=(y0+y1)/2,nx=-Math.sin(b),ny=-Math.cos(b);   /* outward normal (up-left of slope) */
    function arrow(cx,cy,dx,dy,col,txt){var ex=cx+dx*38,ey=cy+dy*38;
      return '<line x1="'+cx+'" y1="'+cy+'" x2="'+ex+'" y2="'+ey+'" stroke="'+col+'" stroke-width="2" marker-end="url(#ah'+col.slice(1)+')"/><text x="'+(ex+(dx>=0?4:-4))+'" y="'+(ey+(dy<0?-3:11))+'" font-size="10" fill="'+col+'" text-anchor="'+(dx>=0?'start':'end')+'">'+txt+'</text>'}
    var up='#c62828',dn='#1565c0';
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Array side view with wind loads">'+
      '<defs><marker id="ah'+up.slice(1)+'" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L6,3L0,6z" fill="'+up+'"/></marker>'+
      '<marker id="ah'+dn.slice(1)+'" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L6,3L0,6z" fill="'+dn+'"/></marker></defs>'+
      '<line x1="10" y1="'+y0+'" x2="'+(W-10)+'" y2="'+y0+'" stroke="currentColor" stroke-width="1.5"/>'+
      '<line x1="'+x0+'" y1="'+y0+'" x2="'+x1+'" y2="'+y1+'" stroke="currentColor" stroke-width="5"/>'+
      '<path d="M'+(x0+34)+','+y0+' A34,34 0 0 0 '+(x0+34*Math.cos(b))+','+(y0-34*Math.sin(b))+'" fill="none" stroke="currentColor" stroke-width="1"/>'+
      '<text x="'+(x0+40)+'" y="'+(y0-6)+'" font-size="11" fill="currentColor">'+f(r.L.tilt,0)+'°</text>'+
      arrow(mx+nx*8,my+ny*8,nx,ny,up,'uplift '+f(r.wu,2)+' kN/m²')+
      arrow(mx-nx*60+0,my-ny*60,nx,ny,dn,'')+
      '<text x="'+(W-8)+'" y="'+(H-8)+'" font-size="10" fill="currentColor" text-anchor="end">downward '+f(r.wd,2)+' kN/m²</text></svg>';
    return svg;
  }
  function bmd(r){
    var m=r.pur.gov,L=r.Lp,W=330,H=110,x0=30,x1=300,y0=30,hh=60,pts=[];
    for(var i=0;i<=20;i++){var t=i/20,y=4*t*(1-t);pts.push((x0+(x1-x0)*t)+','+(y0+hh*y))}
    return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Purlin bending moment diagram">'+
      '<line x1="'+x0+'" y1="'+y0+'" x2="'+x1+'" y2="'+y0+'" stroke="currentColor" stroke-width="2"/>'+
      '<polyline points="'+pts.join(' ')+'" fill="rgba(21,101,192,.15)" stroke="#1565c0" stroke-width="1.5"/>'+
      '<text x="'+x0+'" y="'+(y0-8)+'" font-size="10" fill="currentColor">Purlin span '+f(L,3)+' m, '+esc(m.name)+'</text>'+
      '<text x="'+((x0+x1)/2)+'" y="'+(y0+hh+16)+'" font-size="11" fill="currentColor" text-anchor="middle">Mmax = '+f(m.Mx,2)+' kNm (strong axis), simply supported</text></svg>';
  }
  function render(){
    var out=$('epcw_out');if(!out)return;
    var prog=$('epcw_prog'),r=result;
    var total=ALL.filter(function(x){return !x.opt}).length+4;
    if(prog)prog.textContent=(total-r.missing.length>0?Math.max(0,total-r.missing.length):0)+' of '+total+' required inputs complete';
    if(r.state==='missing'){
      out.innerHTML='<div class="epca-warnings" style="margin-top:10px"><b>Not calculated yet.</b> Enter these to continue:<ul style="margin:6px 0 0 18px">'+r.missing.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul></div>';
      return;
    }
    var p=r.pur,rf=r.raf,a=r.anc,h='';
    h+='<div class="epca-warnings" style="margin-top:10px;border-color:'+(r.state==='pass'?'var(--ok,#1a7f4b)':'var(--danger,#b3261e)')+'"><b>'+(r.state==='pass'?'PRELIMINARY CHECKS PASS':'CHECKS FAIL')+'</b> — not approved. A qualified structural engineer must verify and sign off before construction.'+(r.fails.length?'<ul style="margin:6px 0 0 18px">'+r.fails.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul>':'')+'</div>';
    h+='<h4 style="margin:12px 0 4px">Wind (IS 875 Part 3)</h4><table class="epcw-t" style="width:100%;font-size:13px"><tbody>'+
      row('Design wind speed Vz = Vb·k1·k2·k3·k4',f(r.w.Vz,2)+' m/s')+
      row('Pz = 0.6·Vz²',f(r.w.pz,1)+' N/m²')+
      row('Design pressure pd = Kd·Ka·Kc·Pz',f(r.pd*1000,1)+' N/m²','= '+f(r.pd,3)+' kN/m²')+
      row('Net uplift, field zone',f(r.pd*r.v.cUpF,3)+' kN/m²')+
      row('Net uplift, edge / corner',f(r.pd*r.v.cUpE,3)+' kN/m²','used for member design: '+f(r.wu,3))+
      row('Net downward',f(r.wd,3)+' kN/m²')+
      row('Wind force on one module (uplift, governing)',f(r.wu*r.area,3)+' kN','module '+f(r.area,3)+' m²')+'</tbody></table>';
    h+='<h4 style="margin:12px 0 4px">Loads and spans</h4><table class="epcw-t" style="width:100%;font-size:13px"><tbody>'+
      row('Dead load on slope area',f(r.q.dead,3)+' kN/m²','module + structure allowance')+
      row('Purlin span',f(r.Lp,3)+' m','Layout frame spacing')+
      row('Purlin tributary width',f(r.s,3)+' m','(module depth + gap) ÷ purlins per row')+
      row('Rafter span along slope',f(r.Lr,3)+' m','Layout column spacing ÷ cos tilt')+'</tbody></table>';
    function mrow(n,m){return '<tr><td>'+n+'</td><td>'+f(m.props.Zx/1000,1)+' / '+f(m.props.Ix/1e4,1)+'</td><td>'+f(m.maxUtil,2)+'</td><td>'+f(m.maxShear,2)+'</td><td>'+f(m.defl,1)+' / '+f(m.deflLimit,1)+'</td><td>'+pill(m.ok)+'</td></tr>'}
    h+='<h4 style="margin:12px 0 4px">Member checks (IS 800 limit state, γm0 = 1.10)</h4><div style="overflow-x:auto"><table class="epcw-m" style="width:100%;font-size:13px"><thead><tr><th>Member</th><th>Ze cm³ / Ix cm⁴</th><th>Bending</th><th>Shear</th><th>Deflection mm</th><th></th></tr></thead><tbody>'+mrow('Purlin',p)+mrow('Rafter',rf)+'</tbody></table></div>'+
      '<small>Governing purlin combination: '+esc(p.gov.name)+'. Section properties are computed from b, h, t with corner radius Ro = 2t, Ri = t; compare with the IS 4923 / supplier table.'+((p.reduced||rf.reduced)?' <b>Thin-wall section: effective-width properties are used for bending (Winter method, as in EN 1993-1-5 and IS 801). Confirm against IS 801 with your engineer.</b>':'')+'</small>';
    h+='<h4 style="margin:12px 0 4px">Column base and anchors (per column)</h4><table class="epcw-t" style="width:100%;font-size:13px"><tbody>'+
      row('Dead load carried',f(a.dead,2)+' kN')+
      row('Factored net uplift (1.5 WL − 0.9 DL)',f(a.uplift,2)+' kN',a.needsAnchor?'anchors in tension':'no net uplift')+
      row('Horizontal at base (uplift case)',f(a.horiz,2)+' kN')+
      row('Per bolt tension / shear',f(a.perBoltT||0,2)+' / '+f(a.perBoltV,2)+' kN')+
      row('Bolt interaction (T/Td)² + (V/Vd)²',f(a.util,2),pill(a.util<=1))+
      row('Minimum foundation weight (0.9(D+Wf) ≥ 1.5 Wu)',f(a.foundationWeightMin,1)+' kN','≈ '+f(a.foundationWeightMin/25,2)+' m³ concrete; roof capacity not checked')+'</tbody></table>';
    h+='<h4 style="margin:12px 0 4px">Diagrams</h4>'+diagram(r)+bmd(r);
    h+='<div class="epca-warnings" style="margin-top:10px"><b>Not checked here (engineer must verify):</b> column buckling and bracing, connection and base-plate design, roof slab or shed capacity under the added load, pedestal and foundation design, lateral-torsional behaviour without restraint, local pressure zones from the parapet, fatigue and corrosion. Wind coefficients and factors are as you entered them.</div>';
    out.innerHTML=h;
  }

  /* ================= gate ================= */
  var SITE_REQ=function(){
    var m=[],lat=nv('engLat'),lon=nv('engLon'),cap=nv('engCapacity'),roof=nv('engRoof');
    var nm=$('engSite');if(!nm||!nm.value.trim())m.push('Site: project / customer name');
    if(!isFinite(lat)||lat<6||lat>37.5)m.push('Site: latitude (inside India)');
    if(!isFinite(lon)||lon<68||lon>98)m.push('Site: longitude (inside India)');
    if(!(cap>0))m.push('Site: target DC capacity');
    if(!(roof>0))m.push('Site: surveyed usable roof area');
    return m;
  };
  var NEEDS_SITE={autodesign:1,layout:1,wind:1},NEEDS_WIND={analysis:1,draw:1,elec:1,bom:1,docs:1},NEEDS_ANALYSIS={draw:1,elec:1,bom:1,docs:1};
  function gateFor(t){
    if(NEEDS_SITE[t]){var m=SITE_REQ();return m.length?{step:'site',title:'Complete the Site details first',items:m}:null}
    if(NEEDS_WIND[t]){
      var s=SITE_REQ();if(s.length)return {step:'site',title:'Complete the Site details first',items:s};
      if(result.state==='missing')return {step:'wind',title:'Complete Wind & Structure first',items:result.missing};
      if(result.state==='fail'&&!(t==='analysis'))return {step:'wind',title:'Wind & Structure checks fail. Change the section, spacing or loads first',items:result.fails};
      if(NEEDS_ANALYSIS[t]){
        var A=window.EPCAnalysis&&window.EPCAnalysis.status();
        if(!A||A.state==='missing')return {step:'analysis',title:'Complete the Analysis first',items:A&&A.missing&&A.missing.length?A.missing:['Run the 3D frame analysis']};
        if(A.state==='fail')return {step:'analysis',title:'The 3D frame analysis fails. Change the sections, spacing or loads first',items:A.fails};
      }
    }
    return null;
  }
  function paintLocks(){
    var tabs=$('epc_tabs');if(!tabs)return;
    Array.prototype.forEach.call(tabs.querySelectorAll('.tab'),function(b){
      var t=b.getAttribute('data-t'),g=gateFor(t);
      if(g){b.setAttribute('data-locked','1');b.setAttribute('aria-disabled','true');b.title='Locked: '+g.title}
      else{b.removeAttribute('data-locked');b.removeAttribute('aria-disabled');b.removeAttribute('title')}
    });
  }
  function showGate(g){
    var el=$('epc_gate');if(!el)return;
    el.hidden=false;
    el.innerHTML='<b>'+esc(g.title)+'</b><ul style="margin:6px 0 6px 18px">'+g.items.map(function(m){return '<li>'+esc(m)+'</li>'}).join('')+'</ul><button type="button" class="btn alt sm" id="epc_gateGo">Go to '+(g.step==='site'?'Site':g.step==='analysis'?'Analysis':'Wind &amp; Structure')+'</button>';
    $('epc_gateGo').onclick=function(){el.hidden=true;var b=q('#epc_tabs .tab[data-t="'+g.step+'"]');if(b)b.click()};
  }
  function installGate(){
    var tabs=$('epc_tabs');if(!tabs||$('epc_gate'))return;
    var d=document.createElement('div');d.id='epc_gate';d.hidden=true;d.className='epca-warnings';d.setAttribute('role','alert');d.style.margin='8px 0';
    tabs.parentNode.insertBefore(d,tabs.nextSibling);
    tabs.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('.tab');if(!b)return;
      var t=b.getAttribute('data-t'),g=gateFor(t);
      if(g){e.stopImmediatePropagation();e.preventDefault();showGate(g)}else d.hidden=true;
    },true);
    var st=document.createElement('style');
    st.textContent='#epc_tabs .tab[data-locked]{opacity:.5}#epc_tabs .tab[data-locked]::after{content:" \\1F512";font-size:.8em}#epcw .epcw-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}#epcw label{display:flex;flex-direction:column;font-size:12px;gap:2px}#epcw label small{opacity:.7}#epcw input,#epcw select{padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}#epcw .epcw-t{table-layout:fixed}#epcw .epcw-t td:first-child{width:60%;overflow-wrap:anywhere}#epcw .epcw-t td:last-child{width:40%;text-align:right}#epcw .epcw-m td,#epcw .epcw-m th,#epcw .epcw-t td,#epcw .epcw-t th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left}#epcw details{border:1px solid var(--line);border-radius:12px;margin:8px 0;padding:6px 10px}#epcw summary{cursor:pointer;font-weight:600;padding:4px 0}';
    document.head.appendChild(st);
  }

  /* ================= mount ================= */
  function mount(){
    var sec=$('epc_p-wind');if(!sec||$('epcw'))return false;
    var h='<div id="epcw"><div class="epca-head"><div><span class="epca-kicker">GENSOLAR EPC ENGINEERING</span><h2>Wind &amp; Structure</h2><p>Enter the code values and section sizes. Spans, tilt and module size come from Layout, Site and Auto Design. This tab only recalculates; it never approves a design.</p></div><span class="epca-tag">PRELIMINARY</span></div><div id="epcw_prog" class="meta" aria-live="polite"></div>';
    G.forEach(function(g,i){
      h+='<details'+(i<5?' open':'')+'><summary>'+esc(g.t)+'</summary><div class="epcw-g">';
      g.f.forEach(function(x){
        var id='epcw_'+x.id,hint=x.hint?'<small>'+esc(x.hint)+'</small>':'';
        if(x.chk)h+='<label style="flex-direction:row;align-items:center;gap:6px"><input id="'+id+'" type="checkbox"> '+esc(x.l)+'</label>';
        else if(x.sel)h+='<label>'+esc(x.l)+'<select id="'+id+'">'+(x.def?'':'<option value="">Select</option>')+x.sel.map(function(o){return '<option>'+esc(o)+'</option>'}).join('')+'</select></label>';
        else if(x.text)h+='<label>'+esc(x.l)+'<input id="'+id+'" type="text"></label>';
        else h+='<label>'+esc(x.l)+'<input id="'+id+'" type="number" inputmode="decimal" min="'+x.min+'" step="'+x.step+'">'+hint+'</label>';
      });
      h+='</div></details>';
    });
    h+='<div id="epcw_links" class="meta"></div><div id="epcw_out" aria-live="polite"></div></div>';
    sec.innerHTML=h;
    return true;
  }
  function links(){
    var L=layoutInputs(),e=$('epcw_links');if(!e)return;
    e.innerHTML='Linked from other tabs: frame spacing '+f(L.fs,0)+' mm, column spacing '+f(L.cs,0)+' mm, tilt '+f(L.tilt,0)+'°, module '+f(L.ml,3)+' × '+f(L.mw,3)+' m ('+(L.port?'portrait':'landscape')+'), panel gap '+f(L.gap,0)+' mm. Change them on Layout, Site or Auto Design.';
  }
  var timer=null;
  function refresh(){
    clearTimeout(timer);
    timer=setTimeout(function(){compute();links();render();paintLocks();if(window.EPCSync&&window.EPCSync.refresh)window.EPCSync.refresh()},120);
  }
  function init(){
    if(!mount())return;
    installGate();
    loadVals();
    var sec=$('epc_p-wind');
    sec.addEventListener('input',function(){saveVals();refresh()});sec.addEventListener('change',function(){saveVals();refresh()});
    var root=$('epcRoot')||document;
    root.addEventListener('input',function(e){var t=e.target;if(!t||sec.contains(t))return;if(t.id==='engSite'){saveVals();refresh()}else refresh()},true);   /* typing a name renames: keep the values */
    root.addEventListener('change',refresh,true);
    document.addEventListener('epc:linked',refresh);
    var ps=$('epc_projSel');if(ps)ps.addEventListener('change',function(){setTimeout(function(){loadVals();refresh()},60)});
    ['epc_newProj','epc_loadRef'].forEach(function(id){var b=$(id);if(b)b.addEventListener('click',function(){setTimeout(function(){loadVals();refresh()},120)})});
    refresh();
  }
  window.EPCWind={status:function(){return result},recalc:function(){compute();return result},gate:gateFor,refreshLocks:paintLocks};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,50)});else setTimeout(init,50);
})();
