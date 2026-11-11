/* EPC Analysis engine: builds the 3D frame model of one Layout block, runs the IS 800 load combinations through EPCFem
   and checks every member. No DOM access. PRELIMINARY: first-order linear analysis, never approved here.
   Units: kN, m, MPa for steel strengths. Global axes: X across the frames (along the purlins), Y up the slope (horizontal), Z up. */
(function(){
  'use strict';
  var F=window.EPCFem,GM0=1.10,E_MPA=2e5,RAD=Math.PI/180;
  var ALPHA={a:0.21,b:0.34,c:0.49,d:0.76};

  function num(v,d){var x=parseFloat(v);return isFinite(x)?x:d}

  /* ---------- Layout geometry (mm), same rules as the Layout tab ---------- */
  function geometry(S,bi){
    var b=S.blocks[bi];if(!b)return null;
    var m=S.module,t=num(S.tilt,5)*RAD,ct=Math.cos(t),st=Math.sin(t),portrait=m.orient==='portrait';
    var dS=portrait?m.len:m.wid,dP=portrait?m.wid:m.len,gap=S.gap;
    var rows=Math.max(1,Math.round(b.rows)),per=Math.max(1,Math.round(b.perRow));
    var rafterLen=rows*dS+(rows-1)*gap+2*S.rafterOvh,runLen=per*dP+(per-1)*gap,fs=Math.max(500,S.frameSpacing);
    var nRaf=Math.max(2,Math.ceil((runLen-2*S.purlinOvh)/fs-1e-9)+1),purlinLen=Math.max(runLen,(nRaf-1)*fs+2*S.purlinOvh);
    var sSl=Math.max(500,S.colSpacingH)/ct,inner=Math.max(0,rafterLen-2*S.colInset);
    var nCol=Math.max(2,Math.ceil(inner/sSl-1e-9)+1),span=inner/(nCol-1),spanZ=span*st,heights=[];
    for(var i=0;i<nCol;i++)heights.push(b.low+i*spanZ);
    return {b:b,t:t,ct:ct,st:st,dS:dS,dP:dP,gap:gap,rows:rows,per:per,rafterLen:rafterLen,runLen:runLen,nRaf:nRaf,purlinLen:purlinLen,fs:fs,
      nCol:nCol,span:span,spanH:span*ct,spanZ:spanZ,heights:heights,x0:(purlinLen-(nRaf-1)*fs)/2,colInset:S.colInset,rafterOvh:S.rafterOvh};
  }

  function section(type,b,h,t){                                  /* mm in, m out */
    return type==='CHS'?F.chs(b/1000,t/1000):F.rhs(b/1000,h/1000,t/1000);
  }

  /* ---------- model ---------- */
  function build(c,P){
    var pts={},list=[],mem=[],mm=1/1000;
    function pt(x,y,z){var k=Math.round(x*1e6)+','+Math.round(y*1e6)+','+Math.round(z*1e6);if(!pts[k]){pts[k]={x:x,y:y,z:z};list.push(pts[k])}return pts[k]}
    function add(a,b,type,sec,roll,kind,seg,label,extra){var o={a:a,b:b,type:type,sec:sec,roll:roll,kind:kind,seg:seg,label:label};if(extra)for(var k in extra)o[k]=extra[k];mem.push(o)}
    var tn=c.st;                                                  /* dz/ds along the slope */
    function zr(s){return (c.b.low+(s-c.colInset)*tn)*mm}
    function yr(s){return s*c.ct*mm}
    var colS=[];for(var i=0;i<c.nCol;i++)colS.push(c.colInset+i*c.span);
    var purS=[];for(var r=0;r<c.rows;r++){var base=c.rafterOvh+r*(c.dS+c.gap);purS.push(base+c.dS*0.2,base+c.dS*0.8)}
    var xs=[];for(var j=0;j<c.nRaf;j++)xs.push((c.x0+j*c.fs)*mm);
    var X0=0,X1=c.purlinLen*mm;
    for(j=0;j<c.nRaf;j++){
      var x=xs[j],sl=[0,c.rafterLen].concat(colS,purS).sort(function(a,b){return a-b}),u=[];
      sl.forEach(function(s){if(!u.length||s-u[u.length-1]>0.5)u.push(s)});
      for(i=0;i+1<u.length;i++){
        var mid=(u[i]+u[i+1])/2,k=0;colS.forEach(function(cs){if(cs<mid)k++});
        add(pt(x,yr(u[i]),zr(u[i])),pt(x,yr(u[i+1]),zr(u[i+1])),'beam',P.raf,0,'rafter','R'+(j+1)+'.'+(k+1),'R'+(j+1)+'.'+(k+1),
          {cant:k===0?'B':(k===c.nCol?'A':null),piece:'R'+(j+1),pidx:j});
      }
      for(i=0;i<c.nCol;i++){
        var ytop=yr(colS[i]),ztop=zr(colS[i]),zl=[0,ztop];
        zl.push(P.tieFrac*ztop);
        if(i===c.nCol-1)zl.push(P.brcFrac*ztop);
        zl.sort(function(a,b){return a-b});
        var zu=[];zl.forEach(function(z){if(!zu.length||z-zu[zu.length-1]>1e-6)zu.push(z)});
        for(var q=0;q+1<zu.length;q++)add(pt(x,ytop,zu[q]),pt(x,ytop,zu[q+1]),'beam',P.col,90,'column','C'+(j+1)+'.'+(i+1),'C'+(j+1)+'.'+(i+1),{piece:'C'+(j+1)+'.'+(i+1),pidx:i});
      }
      var ytk=yr(colS[c.nCol-1]),zt=zr(colS[c.nCol-1]),yb=yr(colS[c.nCol-2]);
      add(pt(x,yb,0),pt(x,ytk,P.brcFrac*zt),'truss',P.brc,0,'brace','B'+(j+1),'B'+(j+1),{piece:'B'+(j+1),pidx:j});
    }
    for(i=0;i<c.nCol;i++){
      var yy=yr(colS[i]),zz=P.tieFrac*zr(colS[i]);
      for(j=0;j+1<c.nRaf;j++)add(pt(xs[j],yy,zz),pt(xs[j+1],yy,zz),'truss',P.tie,0,'tie','T'+(i+1)+'.'+(j+1),'T'+(i+1)+'.'+(j+1),{piece:'T'+(i+1),pidx:i});
    }
    purS.forEach(function(s,p){
      var y=yr(s),z=zr(s),xl=[X0].concat(xs,[X1]);
      for(var q=0;q+1<xl.length;q++){
        var lab='P'+(p+1)+'.'+(q+1);
        add(pt(xl[q],y,z),pt(xl[q+1],y,z),'beam',P.pur,c.t/RAD,'purlin',lab,lab,{cant:q===0?'B':(q===xl.length-2?'A':null),piece:'P'+(p+1),pidx:p});
      }
    });
    list.sort(function(a,b){return a.x-b.x||a.y-b.y||a.z-b.z});
    list.forEach(function(p,i){p.i=i});
    var nodes=list.map(function(p){return [p.x,p.y,p.z]});
    var members=mem.map(function(m){return {a:m.a.i,b:m.b.i,type:m.type,sec:m.sec,roll:m.roll}});
    var supports={},bases=[];
    list.forEach(function(p){if(Math.abs(p.z)<1e-9){supports[p.i]=P.fixed?[1,1,1,1,1,1]:[1,1,1,0,0,0];bases.push(p.i)}});
    /* loads (global kN/m on the purlins) */
    var n=[0,-Math.sin(c.t),Math.cos(c.t)],s=P.s,cases={DL:{udl:{}},LL:{udl:{}},WLd:{udl:{}},WLu:{udl:{}}};
    mem.forEach(function(m,mi){if(m.kind!=='purlin')return;
      cases.DL.udl[mi]=[0,0,-P.dead*s];cases.LL.udl[mi]=[0,0,-P.live*s];
      cases.WLd.udl[mi]=[-n[0]*P.wd*s,-n[1]*P.wd*s,-n[2]*P.wd*s];
      cases.WLu.udl[mi]=[n[0]*P.wu*s,n[1]*P.wu*s,n[2]*P.wu*s]});
    return {model:{nodes:nodes,members:members,supports:supports,cases:cases},mem:mem,bases:bases,xs:xs};
  }

  /* ---------- design capacities (IS 800 LSM) ---------- */
  function fcd(fy,klr,alpha){
    var fcc=Math.PI*Math.PI*E_MPA/(klr*klr),lam=Math.sqrt(fy/fcc),phi=0.5*(1+alpha*(lam-0.2)+lam*lam);
    return Math.min(fy/GM0,fy/GM0/(phi+Math.sqrt(Math.max(0,phi*phi-lam*lam))));
  }
  /* thin-wall box sections: effective-width properties; returns capacities and flags (sec in m, fy in MPa) */
  function thin(sec,fy){
    if(sec.type==='CHS'){var eps=Math.sqrt(250/fy);return {reduced:false,slender:sec.b/sec.t>146*eps*eps,Ac:sec.A,Wy:sec.Zy,Wz:sec.Zz}}
    var T=window.EPCThin,tx=T&&T.rect(sec.b*1000,sec.h*1000,sec.t*1000,fy),ty=T&&T.rect(sec.h*1000,sec.b*1000,sec.t*1000,fy);
    if(!tx||!ty){var e2=Math.sqrt(250/fy);return {reduced:false,slender:Math.max((sec.b-3*sec.t)/sec.t,(sec.h-3*sec.t)/sec.t)>42*e2,Ac:sec.A,Wy:sec.Zy,Wz:sec.Zz}}
    return {reduced:tx.reduced||ty.reduced,slender:tx.tooThin||tx.shearBuckling||ty.tooThin,Ac:Math.min(sec.A,tx.Ac*1e-6),Wy:Math.min(sec.Zy,tx.W*1e-9),Wz:Math.min(sec.Zz,ty.W*1e-9)};
  }
  function slenderSec(sec,fy){return thin(sec,fy).slender}
  /* compression resistance with effective area: lambda = sqrt(Aeff fy / Ncr) */
  function ncd(sec,th,fy,klr,alpha){
    var ar=th.Ac/sec.A,lam=klr/(Math.PI*Math.sqrt(E_MPA/fy))*Math.sqrt(ar),phi=0.5*(1+alpha*(lam-0.2)+lam*lam);
    var chi=Math.min(1,1/(phi+Math.sqrt(Math.max(0,phi*phi-lam*lam))));
    return chi*th.Ac*fy*1000/GM0;
  }
  var ULS=[{name:'1.5(DL+LL)',f:{DL:1.5,LL:1.5}},{name:'1.5DL+1.5WL(down)',f:{DL:1.5,WLd:1.5}},
           {name:'1.2(DL+LL+WL down)',f:{DL:1.2,LL:1.2,WLd:1.2}},{name:'0.9DL+1.5WL(uplift)',f:{DL:0.9,WLu:1.5}}];
  var SLS=[{name:'DL+LL',f:{DL:1,LL:1}},{name:'DL+WL(down)',f:{DL:1,WLd:1}},{name:'DL+WL(uplift)',f:{DL:1,WLu:1}}];

  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}

  /* I = {fy, K, bclass, lim, swayLim, nb, tcap, vcap, nst} ; returns the full result */
  function analyse(S,bi,W,I){
    var c=geometry(S,bi);if(!c)return {error:'Block not found'};
    var v=W.v,fy=v.fy,alpha=ALPHA[I.bclass]||0.34,warn=[];
    if(Math.abs(num(S.tilt,0)-W.L.tilt)>0.01)return {error:'Layout tilt ('+S.tilt+'°) differs from the Site tilt ('+W.L.tilt+'°). Make them equal first.'};
    if(v.nPur!==2)return {error:'The Layout draws 2 purlins per module row. Set "Purlins per module row" = 2 on Wind & Structure (now '+v.nPur+').'};
    var sec={pur:section(v.pType,v.pb,v.ph,v.pt),raf:section(v.rType,v.rb,v.rh,v.rt),col:section(I.colType,I.colB,I.colH,I.colT),brc:section(I.brcType,I.brcB,I.brcH,I.brcT)};
    sec.tie=sec.brc;
    for(var k in sec)if(!sec[k])return {error:'A section is not valid (wall thickness must be less than half the smaller side): '+k};
    var P={pur:sec.pur,raf:sec.raf,col:sec.col,brc:sec.brc,tie:sec.tie,fixed:I.base==='Fixed',tieFrac:I.tieFrac,brcFrac:I.brcFrac,
           s:W.s,dead:W.q.dead,live:W.q.live,wd:W.wd,wu:W.wu};
    var B=build(c,P),res;
    try{res=F.solve(B.model)}catch(e){return {error:'Model error: '+e.message}}
    if(res.error)return {error:res.error};
    var mem=B.mem,nst=I.nst||8;
    /* physical pieces as a fabricator cuts them: a whole rafter, a whole column, a whole purlin line, a whole tie line, a brace.
       Length = sum of the lengths of the analysed elements of that piece, so the BOM cannot drift from the model. */
    var pcs={},porder=[];
    mem.forEach(function(m,mi){var k=m.kind+':'+m.piece,p=pcs[k];
      if(!p){p=pcs[k]={key:m.piece,kind:m.kind,idx:m.pidx,len:0,sec:m.sec};porder.push(k)}
      p.len+=res.mem[mi].L*1000});
    var pieces=porder.map(function(k){return pcs[k]});
    var cres={};ULS.concat(SLS).forEach(function(cb){cres[cb.name]=F.combine(res,cb.f)});
    /* segments */
    var segs={},order=[];
    mem.forEach(function(m,mi){var id=m.kind+':'+m.seg;if(!segs[id]){segs[id]={id:id,label:m.label,kind:m.kind,els:[],sec:m.sec,type:m.type,cant:m.cant||null};order.push(id)}segs[id].els.push(mi)});
    var list=order.map(function(id){return segs[id]});
    list.forEach(function(sg){
      sg.L=0;sg.els.forEach(function(mi){sg.L+=res.mem[mi].L});
      var s0=sg.sec,fl=sg.kind==='truss';
      sg.fy=fy;sg.r=Math.min(s0.ry,s0.rz);sg.KLr=I.K*sg.L/sg.r;
      var th=thin(s0,fy);sg.reduced=th.reduced;
      sg.Ntd=s0.A*fy*1000/GM0;sg.Mdy=th.Wy*fy*1000/GM0;sg.Mdz=th.Wz*fy*1000/GM0;sg.Vd=s0.Av*fy*1000/(Math.sqrt(3)*GM0);
      sg.Ncd=ncd(s0,th,fy,Math.max(sg.KLr,1),alpha);
      sg.slender=th.slender;
      var maxN=0,minN=0,maxMy=0,maxMz=0,maxV=0,u=0,uc='',anyComp=false;
      ULS.forEach(function(cb){
        var cr=cres[cb.name];
        sg.els.forEach(function(mi){
          var st=F.stations(res,cr,mi,nst,null);
          st.forEach(function(p){
            var N=p.N,Nd=N<0?sg.Ncd:sg.Ntd;
            if(N>maxN)maxN=N;if(N<minN)minN=N;if(N<-1e-6)anyComp=true;
            var ut=Math.abs(N)/Nd;
            if(sg.type==='beam'){ut+=Math.abs(p.My)/sg.Mdy+Math.abs(p.Mz)/sg.Mdz;
              maxMy=Math.max(maxMy,Math.abs(p.My));maxMz=Math.max(maxMz,Math.abs(p.Mz));
              maxV=Math.max(maxV,Math.hypot(p.Vy,p.Vz))}
            if(ut>u){u=ut;uc=cb.name}
          });
        });
      });
      sg.maxN=maxN;sg.minN=minN;sg.maxMy=maxMy;sg.maxMz=maxMz;sg.maxV=maxV;sg.util=u;sg.combo=uc;
      sg.shearUtil=sg.type==='beam'?maxV/sg.Vd:0;
      sg.slLimit=anyComp?180:400;sg.slUtil=sg.KLr/sg.slLimit;
      sg.axialUtil=Math.max(maxN/sg.Ntd,-minN/sg.Ncd);
      /* deflection (beams that carry area load: purlin and rafter) */
      sg.defl=0;sg.deflLimit=0;sg.deflCombo='';
      if(sg.type==='beam'&&(sg.kind==='purlin'||sg.kind==='rafter')){
        var R=res.mem[sg.els[0]].R,ex=R[0],ey=R[1],ez=R[2];
        var nA=B.model.members[sg.els[0]].a,pA=B.model.nodes[nA];
        var last=B.model.members[sg.els[sg.els.length-1]].b,pB=B.model.nodes[last],Ls=dot([pB[0]-pA[0],pB[1]-pA[1],pB[2]-pA[2]],ex);
        var free=sg.cant==='B'?'A':(sg.cant==='A'?'B':null);        /* cant 'B' = support at the B end */
        sg.deflLimit=(sg.cant?2:1)*Ls*1000/v.lim;
        SLS.forEach(function(cb){
          var cr=cres[cb.name];
          function loc(n){var d=cr.disp[n];return {y:dot(ey,d),z:dot(ez,d),ty:dot(ey,[d[3],d[4],d[5]]),tz:dot(ez,[d[3],d[4],d[5]])}}
          var dA=loc(nA),dB=loc(last),sup=sg.cant==='B'?dB:(sg.cant==='A'?dA:null),sx=sg.cant==='B'?Ls:0;
          sg.els.forEach(function(mi){
            var m=B.model.members[mi],pa=B.model.nodes[m.a],xa=dot([pa[0]-pA[0],pa[1]-pA[1],pa[2]-pA[2]],ex);
            var da=loc(m.a),db=loc(m.b),Le=res.mem[mi].L,st=F.stations(res,cr,mi,nst,m.sec);
            st.forEach(function(p){
              var t=p.x/Le,s=xa+p.x,dy=da.y+(db.y-da.y)*t+p.dv,dz=da.z+(db.z-da.z)*t+p.dw,ry,rz;
              if(sup){var ds=s-sx;ry=sup.y+sup.tz*ds;rz=sup.z-sup.ty*ds}       /* tangent at the support: v' = θz, w' = −θy */
              else{ry=dA.y+(dB.y-dA.y)*s/Ls;rz=dA.z+(dB.z-dA.z)*s/Ls}
              var d=Math.hypot(dy-ry,dz-rz)*1000;if(d>sg.defl){sg.defl=d;sg.deflCombo=cb.name}
            });
          });
        });
      }
      sg.deflUtil=sg.deflLimit?sg.defl/sg.deflLimit:0;
      sg.ok=!sg.slender&&sg.util<=1&&sg.shearUtil<=1&&sg.slUtil<=1&&(!sg.deflLimit||sg.defl<=sg.deflLimit);
      sg.worst=Math.max(sg.util,sg.shearUtil,sg.slUtil,sg.deflUtil);
    });
    /* member utilisation per element, for colouring */
    var elUtil=new Array(mem.length);list.forEach(function(sg){sg.els.forEach(function(mi){elUtil[mi]=sg.worst})});
    /* base reactions and anchors */
    var reacts=[];
    B.bases.forEach(function(n){
      var row={node:n,p:B.model.nodes[n],combos:{}},T=0,Hs=0,Cm=0,Hx=0,Hy=0,M=0;
      ULS.forEach(function(cb){
        var r=cres[cb.name].reactions[n];row.combos[cb.name]=r;
        T=Math.max(T,-r[2]);Cm=Math.max(Cm,r[2]);Hs=Math.max(Hs,Math.hypot(r[0],r[1]));Hx=Math.max(Hx,Math.abs(r[0]));Hy=Math.max(Hy,Math.abs(r[1]));M=Math.max(M,Math.hypot(r[3],r[4]));
      });
      row.uplift=T;row.comp=Cm;row.shear=Hs;row.Hx=Hx;row.Hy=Hy;row.moment=M;
      /* anchor interaction on the worst single combination */
      var u=0;ULS.forEach(function(cb){var r=cres[cb.name].reactions[n],t=Math.max(0,-r[2])/v.nb,s2=Math.hypot(r[0],r[1])/v.nb;
        u=Math.max(u,Math.pow(t/v.tcap,2)+Math.pow(s2/v.vcap,2))});
      row.anchorUtil=u;reacts.push(row);
    });
    /* sway of column tops */
    var sway={util:0,val:0,lim:0,node:-1,combo:''};
    var colTops={};mem.forEach(function(m,mi){if(m.kind==='column'){var n=B.model.members[mi].b,z=B.model.nodes[n][2];if(!colTops[n]||colTops[n]<z)colTops[n]=z}});
    var topNodes=[];mem.forEach(function(m,mi){if(m.kind==='rafter'){[B.model.members[mi].a,B.model.members[mi].b].forEach(function(n){topNodes.push(n)})}});
    var topSet={};topNodes.forEach(function(n){topSet[n]=1});
    SLS.forEach(function(cb){var cr=cres[cb.name];
      Object.keys(colTops).forEach(function(n){if(!topSet[n])return;var H=B.model.nodes[n][2],d=Math.hypot(cr.disp[n][0],cr.disp[n][1]),ut=d/(H/I.swayLim);
        if(ut>sway.util){sway={util:ut,val:d*1000,lim:H/I.swayLim*1000,node:+n,combo:cb.name}}});
    });
    var umax=0,uc2=null;ULS.concat(SLS).forEach(function(cb){cres[cb.name].disp.forEach(function(d,i){var t=Math.hypot(d[0],d[1],d[2]);if(t>umax){umax=t;uc2={combo:cb.name,node:i}}})});
    /* verdict */
    var fails=[];
    list.forEach(function(sg){
      var nm=sg.kind+' '+sg.label;
      if(sg.slender)fails.push(nm+': section is slender (not covered)');
      if(sg.util>1)fails.push(nm+': combined utilisation '+sg.util.toFixed(2)+' > 1 ('+sg.combo+')');
      if(sg.shearUtil>1)fails.push(nm+': shear utilisation '+sg.shearUtil.toFixed(2)+' > 1');
      if(sg.slUtil>1)fails.push(nm+': slenderness KL/r '+sg.KLr.toFixed(0)+' > '+sg.slLimit);
      if(sg.deflLimit&&sg.defl>sg.deflLimit)fails.push(nm+': deflection '+sg.defl.toFixed(1)+' mm > '+sg.deflLimit.toFixed(1)+' mm');
    });
    reacts.forEach(function(r,i){if(r.anchorUtil>1)fails.push('Base '+(i+1)+': anchor bolt interaction '+r.anchorUtil.toFixed(2)+' > 1')});
    if(sway.util>1)fails.push('Frame sway '+sway.val.toFixed(1)+' mm > '+sway.lim.toFixed(1)+' mm');
    if(list.some(function(g){return g.reduced}))warn.push('Thin-wall box sections: effective-width properties are used for bending and compression (Winter method, as in EN 1993-1-5; IS 801 uses the same method with slightly different coefficients). Confirm against IS 801 with your engineer.');
    if(I.base==='Fixed')warn.push('Fixed base: base moments are listed but the anchor check uses forces only. Base plate and anchor design for moment is the engineer\'s.');
    return {ok:true,state:fails.length?'fail':'pass',fails:fails,warn:warn,c:c,P:P,sec:sec,nodes:B.model.nodes,mem:mem,members:B.model.members,res:res,cres:cres,
      segs:list,pieces:pieces,elUtil:elUtil,reacts:reacts,sway:sway,umax:umax,umaxAt:uc2,nNodes:B.model.nodes.length,nMembers:mem.length,ULS:ULS,SLS:SLS,I:I,fy:fy};
  }

  /* Group the pieces of an analysed block into fabricator-style rows. Columns are listed by position from the low edge
     (COLUMN 1 is the shortest), everything else by length. Lengths are whole mm, as cut; qty is the number of identical pieces. */
  var ROLE={column:'col',rafter:'raf',purlin:'pur',brace:'brc',tie:'brc'},RANK={column:0,rafter:1,purlin:2,brace:3,tie:4};
  function pieceRows(r){
    var rows=[],by={};
    r.pieces.forEach(function(p){
      var len=Math.round(p.len),k=p.kind+'|'+(p.kind==='column'?p.idx:'')+'|'+len,o=by[k];
      if(!o){o=by[k]={kind:p.kind,role:ROLE[p.kind],idx:p.kind==='column'?p.idx:0,len:len,qty:0,sec:p.sec};rows.push(o)}
      o.qty++;
    });
    rows.sort(function(a,b){return RANK[a.kind]-RANK[b.kind]||a.idx-b.idx||a.len-b.len});
    var cnt={};rows.forEach(function(o){cnt[o.kind]=(cnt[o.kind]||0)+1});
    var seen={},nb=0;
    rows.forEach(function(o){
      seen[o.kind]=(seen[o.kind]||0)+1;
      if(o.kind==='column'){o.part='COLUMN';o.desc='COLUMN '+(o.idx+1)}
      else if(o.kind==='rafter'){o.part='RAFTER';o.desc=cnt.rafter>1?'RAFTER '+seen.rafter:'RAFTER'}
      else if(o.kind==='purlin'){o.part='PURLIN';o.desc=cnt.purlin>1?'PURLIN '+seen.purlin:'PURLIN'}
      else{o.part='BRACING';nb++;o.desc='BRACING '+nb+(o.kind==='brace'?' (DIAGONAL)':' (COLUMN TIE)')}
    });
    return rows;
  }
  window.EPCAnalysisEngine={geometry:geometry,build:build,analyse:analyse,fcd:fcd,ULS:ULS,SLS:SLS,section:section,pieceRows:pieceRows};
})();
