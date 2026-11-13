/* EPC structural analysis engine: 3D frame / truss finite-element solver (direct stiffness, Euler-Bernoulli beams).
   Units: kN, m, kN/m2.  Global axes: X and Y horizontal, Z up.  No DOM access: used by the Analysis tab and by tests. */
(function(){
  'use strict';
  var E_STEEL=2.0e8,G_STEEL=7.6923e7,GAMMA_STEEL=78.5;       /* kN/m2 ; kN/m3 */

  /* ---------- sections (SI units m) ---------- */
  function rhs(b,h,t){                                         /* b = width (local y), h = depth (local z); Ro = 2t, Ri = t */
    if(!(b>0&&h>0&&t>0)||2*t>=Math.min(b,h))return null;
    function rr(B,H,Rc){var As=Rc*Rc*(1-Math.PI/4),Ics=Math.pow(Rc,4)*(1/3-Math.PI/16),yo=H/2-Rc,Isp=yo*yo*As+2*yo*(Rc*Rc*Rc/6)+Ics;return {A:B*H-4*As,I:B*H*H*H/12-4*Isp}}   /* exact rounded rectangle */
    function integ(B,H){var o=rr(B,H,2*t),i=rr(B-2*t,H-2*t,t);return {A:o.A-i.A,I:o.I-i.I}}                  /* tube: outer radius 2t, inner radius t */
    var a=integ(b,h),c=integ(h,b);
    /* torsion constant of a closed thin-walled box: J = 4 Am^2 t / perimeter (centre-line) */
    var bm=b-t,hm=h-t,J=4*bm*bm*hm*hm*t/(2*(bm+hm));
    return {type:'RHS',A:a.A,Iy:a.I,Iz:c.I,J:J,Zy:a.I/(h/2),Zz:c.I/(b/2),Av:a.A*h/(b+h),Avz:a.A*b/(b+h),b:b,h:h,t:t,ry:Math.sqrt(a.I/a.A),rz:Math.sqrt(c.I/a.A)};
  }
  function chs(D,t){
    if(!(D>0&&t>0)||2*t>=D)return null;
    var d=D-2*t,A=Math.PI/4*(D*D-d*d),I=Math.PI/64*(Math.pow(D,4)-Math.pow(d,4)),Z=I/(D/2);
    return {type:'CHS',A:A,Iy:I,Iz:I,J:2*I,Zy:Z,Zz:Z,Av:2*A/Math.PI,Avz:2*A/Math.PI,b:D,h:D,t:t,ry:Math.sqrt(I/A),rz:Math.sqrt(I/A)};
  }

  /* ---------- linear algebra: banded Cholesky ---------- */
  function bandSolve(n,bw,Kb,rhs){                            /* Kb[i*(bw+1)+(j-i+bw)] ... lower band: L[i][j], j in [i-bw,i] */
    var w=bw+1,L=Kb;                                           /* L index: i*w + (j-(i-bw)) */
    function at(i,j){return i*w+(j-i+bw)}
    for(var i=0;i<n;i++){
      var j0=Math.max(0,i-bw);
      for(var j=j0;j<=i;j++){
        var s=L[at(i,j)],k0=Math.max(0,i-bw,j-bw);
        for(var k=k0;k<j;k++)s-=L[at(i,k)]*L[at(j,k)];
        if(i===j){if(!(s>1e-14))return {error:true,dof:i,pivot:s};L[at(i,i)]=Math.sqrt(s)}
        else L[at(i,j)]=s/L[at(j,j)];
      }
    }
    var out=[];
    rhs.forEach(function(b){
      var y=new Float64Array(n),x=new Float64Array(n),i,k;
      for(i=0;i<n;i++){var s=b[i];for(k=Math.max(0,i-bw);k<i;k++)s-=L[at(i,k)]*y[k];y[i]=s/L[at(i,i)]}
      for(i=n-1;i>=0;i--){var s2=y[i];for(k=i+1;k<=Math.min(n-1,i+bw);k++)s2-=L[at(k,i)]*x[k];x[i]=s2/L[at(i,i)]}
      out.push(x);
    });
    return {x:out};
  }

  /* ---------- geometry ---------- */
  function axes(p,q,rollDeg){                                  /* rows = local x', y', z' in global */
    var dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2],L=Math.sqrt(dx*dx+dy*dy+dz*dz),ex=[dx/L,dy/L,dz/L],ref;
    ref=Math.abs(ex[2])>0.999?[1,0,0]:[0,0,1];
    var ey=cross(ref,ex);ey=norm(ey);var ez=cross(ex,ey);
    if(rollDeg){var c=Math.cos(rollDeg*Math.PI/180),s=Math.sin(rollDeg*Math.PI/180),y2=[c*ey[0]+s*ez[0],c*ey[1]+s*ez[1],c*ey[2]+s*ez[2]],z2=[-s*ey[0]+c*ez[0],-s*ey[1]+c*ez[1],-s*ey[2]+c*ez[2]];ey=y2;ez=z2}
    return {L:L,R:[ex,ey,ez]};
  }
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
  function norm(a){var l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);return [a[0]/l,a[1]/l,a[2]/l]}
  function localK(m,L){                                         /* 12x12 local stiffness */
    var s=m.sec,E=m.E||E_STEEL,G=m.G||G_STEEL,K=[],i,j;
    for(i=0;i<12;i++){K.push(new Float64Array(12))}
    var ea=E*s.A/L;K[0][0]=ea;K[0][6]=-ea;K[6][0]=-ea;K[6][6]=ea;
    if(m.type==='truss')return K;
    var gj=G*s.J/L;K[3][3]=gj;K[3][9]=-gj;K[9][3]=-gj;K[9][9]=gj;
    var a=E*s.Iz/(L*L*L);                                      /* bending in x-y plane: v1 th_z1 v2 th_z2 -> dofs 1,5,7,11 */
    var idx=[1,5,7,11],M=[[12,6*L,-12,6*L],[6*L,4*L*L,-6*L,2*L*L],[-12,-6*L,12,-6*L],[6*L,2*L*L,-6*L,4*L*L]];
    for(i=0;i<4;i++)for(j=0;j<4;j++)K[idx[i]][idx[j]]+=a*M[i][j];
    var b=E*s.Iy/(L*L*L);                                      /* bending in x-z plane: w1 th_y1 w2 th_y2 -> dofs 2,4,8,10 */
    var idz=[2,4,8,10],N=[[12,-6*L,-12,-6*L],[-6*L,4*L*L,6*L,2*L*L],[-12,6*L,12,6*L],[-6*L,2*L*L,6*L,4*L*L]];
    for(i=0;i<4;i++)for(j=0;j<4;j++)K[idz[i]][idz[j]]+=b*N[i][j];
    return K;
  }
  /* Geometric stiffness (P-delta) added to the local matrix for axial force P (tension positive, kN). Consistent cubic form;
     torsional (Ip/A) term ignored. Beam: both bending planes. Truss: transverse terms P/L only. */
  function addKg(K,type,P,L){
    var i,j;
    if(type==='truss'){var t=P/L;K[1][1]+=t;K[7][7]+=t;K[1][7]-=t;K[7][1]-=t;K[2][2]+=t;K[8][8]+=t;K[2][8]-=t;K[8][2]-=t;return}
    var c=P/(30*L),M=[[36,3*L,-36,3*L],[3*L,4*L*L,-3*L,-L*L],[-36,-3*L,36,-3*L],[3*L,-L*L,-3*L,4*L*L]];
    var ixy=[1,5,7,11],ixz=[2,4,8,10];
    for(i=0;i<4;i++)for(j=0;j<4;j++){
      K[ixy[i]][ixy[j]]+=c*M[i][j];
      var sg=((i===1||i===3)!==(j===1||j===3))?-1:1;                /* w-theta_y coupling has the opposite sign (theta_y = -dw/dx) */
      K[ixz[i]][ixz[j]]+=c*M[i][j]*sg;
    }
  }
  function T12(R){                                              /* global -> local transformation, 12x12 block diagonal */
    var T=[];for(var i=0;i<12;i++)T.push(new Float64Array(12));
    for(var b=0;b<4;b++)for(var i2=0;i2<3;i2++)for(var j=0;j<3;j++)T[3*b+i2][3*b+j]=R[i2][j];
    return T;
  }
  function eqLoad(wl,L,truss){                                  /* equivalent nodal loads (local) for UDL wl=[wx,wy,wz] */
    var f=new Float64Array(12);
    f[0]=wl[0]*L/2;f[6]=wl[0]*L/2;
    if(truss){f[1]=f[2]=f[7]=f[8]=0;return f}
    f[1]=wl[1]*L/2;f[7]=wl[1]*L/2;f[5]=wl[1]*L*L/12;f[11]=-wl[1]*L*L/12;
    f[2]=wl[2]*L/2;f[8]=wl[2]*L/2;f[4]=-wl[2]*L*L/12;f[10]=wl[2]*L*L/12;
    return f;
  }

  /* ---------- solve ----------
     model: {nodes:[[x,y,z]], members:[{a,b,type:'beam'|'truss',sec,roll}], supports:{node:[ux,uy,uz,rx,ry,rz] 1=fixed},
             cases:{name:{nodal:{node:[Fx,Fy,Fz,Mx,My,Mz]}, udl:{member:[wx,wy,wz]} (global), selfweight:true}}}      */
  function solve(model){
    var nn=model.nodes.length,nd=6*nn,i,j,k;
    var mem=model.members.map(function(m,mi){
      var p=model.nodes[m.a],q=model.nodes[m.b],ax=axes(p,q,m.roll||0);
      if(!(ax.L>1e-9))throw new Error('Zero-length member');
      var Kl=localK(m,ax.L),T=T12(ax.R);
      if(model.kgN&&model.kgN[mi]!==undefined&&model.kgN[mi]!==null)addKg(Kl,m.type,model.kgN[mi],ax.L);
      return {m:m,L:ax.L,R:ax.R,T:T,Kl:Kl};
    });
    /* restraints and free DOF map (nodes are numbered by the caller to keep the bandwidth small) */
    var fixed=new Uint8Array(nd);
    Object.keys(model.supports||{}).forEach(function(n){model.supports[n].forEach(function(f,d){if(f)fixed[6*n+d]=1})});
    var map=new Int32Array(nd).fill(-1),nf=0;for(i=0;i<nd;i++)if(!fixed[i])map[i]=nf++;
    if(nf===0)return {error:'No free degrees of freedom'};
    /* bandwidth */
    var bw=0;
    mem.forEach(function(e){var d=[];[e.m.a,e.m.b].forEach(function(n){for(var q=0;q<6;q++)if(map[6*n+q]>=0)d.push(map[6*n+q])});
      var mn=Math.min.apply(null,d),mx=Math.max.apply(null,d);if(mx-mn>bw)bw=mx-mn});
    var w=bw+1,Kb=new Float64Array(nf*w);
    function at(i2,j2){return i2*w+(j2-i2+bw)}
    mem.forEach(function(e){
      /* Kg = T^T Kl T */
      var KT=[],r,c,s;
      for(r=0;r<12;r++){KT.push(new Float64Array(12));for(c=0;c<12;c++){s=0;for(k=0;k<12;k++)s+=e.Kl[r][k]*e.T[k][c];KT[r][c]=s}}
      var Kg=[];for(r=0;r<12;r++){Kg.push(new Float64Array(12));for(c=0;c<12;c++){s=0;for(k=0;k<12;k++)s+=e.T[k][r]*KT[k][c];Kg[r][c]=s}}
      e.Kg=Kg;
      var dof=[];[e.m.a,e.m.b].forEach(function(n){for(var q=0;q<6;q++)dof.push(6*n+q)});
      for(r=0;r<12;r++){var gr=map[dof[r]];if(gr<0)continue;
        for(c=0;c<12;c++){var gc=map[dof[c]];if(gc<0||gc>gr)continue;Kb[at(gr,gc)]+=Kg[r][c]}}
      e.dof=dof;
    });
    /* loads */
    var names=Object.keys(model.cases),F=[],feqs=[];
    names.forEach(function(nm){
      var c=model.cases[nm],f=new Float64Array(nf),eq=[];
      Object.keys(c.nodal||{}).forEach(function(n){c.nodal[n].forEach(function(v,d){var g=map[6*n+d];if(g>=0)f[g]+=v})});
      mem.forEach(function(e,mi){
        var wg=[0,0,0],u=(c.udl||{})[mi];
        if(u){wg=[u[0],u[1],u[2]]}
        if(c.selfweight){wg[2]-=e.m.sec.A*GAMMA_STEEL}
        var wl=[0,0,0];for(var a=0;a<3;a++)wl[a]=e.R[a][0]*wg[0]+e.R[a][1]*wg[1]+e.R[a][2]*wg[2];
        var fl=eqLoad(wl,e.L,e.m.type==='truss');
        eq[mi]={wl:wl,fl:fl};
        /* to global: T^T fl */
        for(var r=0;r<12;r++){var gv=0;for(var q=0;q<12;q++)gv+=e.T[q][r]*fl[q];var g2=map[e.dof[r]];if(g2>=0)f[g2]+=gv}
      });
      F.push(f);feqs.push(eq);
    });
    var sol=bandSolve(nf,bw,Kb,F);
    if(sol.error){
      var dofIdx=-1;for(i=0;i<nd;i++)if(map[i]===sol.dof){dofIdx=i;break}
      var node=Math.floor(dofIdx/6),dn=['ux','uy','uz','rx','ry','rz'][dofIdx%6];
      return {error:'Structure is unstable (mechanism) near node '+(node+1)+', '+dn+'. Add bracing or fix the base.',node:node};
    }
    var res={cases:{},mem:mem.map(function(e){return {L:e.L,R:e.R}}),nodes:model.nodes,model:model};
    names.forEach(function(nm,ci){
      var U=new Float64Array(nd);for(i=0;i<nd;i++)if(map[i]>=0)U[i]=sol.x[ci][map[i]];
      var end=[],react=new Float64Array(nd);
      mem.forEach(function(e,mi){
        var ug=[];for(var r=0;r<12;r++)ug.push(U[e.dof[r]]);
        var ul=[];for(r=0;r<12;r++){var s=0;for(var q=0;q<12;q++)s+=e.T[r][q]*ug[q];ul.push(s)}
        var fl=[];for(r=0;r<12;r++){var s2=0;for(var q2=0;q2<12;q2++)s2+=e.Kl[r][q2]*ul[q2];fl.push(s2-feqs[ci][mi].fl[r])}
        end.push({u:ul,f:fl,wl:feqs[ci][mi].wl});
        for(r=0;r<12;r++){var gv2=0;for(var q3=0;q3<12;q3++)gv2+=e.T[q3][r]*fl[q3];react[e.dof[r]]+=gv2}
      });
      var rea={};
      Object.keys(model.supports||{}).forEach(function(n){
        var v=[];for(var d=0;d<6;d++){var val=model.supports[n][d]?react[6*n+d]:0;
          /* subtract directly applied nodal load */
          var c=model.cases[nm].nodal&&model.cases[nm].nodal[n];if(c&&model.supports[n][d])val-=c[d];v.push(val)}
        rea[n]=v;
      });
      var disp=[];for(i=0;i<nn;i++)disp.push([U[6*i],U[6*i+1],U[6*i+2],U[6*i+3],U[6*i+4],U[6*i+5]]);
      res.cases[nm]={disp:disp,end:end,reactions:rea};
    });
    return res;
  }
  /* Second-order (P-delta) solution of one load combination. The combined load is solved repeatedly with the member axial
     forces of the previous pass in the geometric stiffness, until the forces change by less than 0.1 %.
     Returns {res,cres,iters,N} like solve+combine, or {error,unstable} when the loads reach the elastic buckling load. */
  function solveSecond(model,factors,o){
    o=o||{};var names=Object.keys(factors),cm={nodes:model.nodes,members:model.members,supports:model.supports,cases:{C:{nodal:{},udl:{},selfweight:false}}},C=cm.cases.C,selfw=false;
    names.forEach(function(n){var c=model.cases[n],f=factors[n];if(!c)return;
      Object.keys(c.nodal||{}).forEach(function(k){var a=C.nodal[k]||(C.nodal[k]=[0,0,0,0,0,0]);c.nodal[k].forEach(function(v,d){a[d]+=f*v})});
      Object.keys(c.udl||{}).forEach(function(k){var a=C.udl[k]||(C.udl[k]=[0,0,0]);c.udl[k].forEach(function(v,d){a[d]+=f*v})});
      if(c.selfweight)selfw=true});
    if(selfw)return {error:'Second-order solution does not support the selfweight flag; add self weight as a member load'};
    function axial(r){return r.cases.C.end.map(function(e,mi){var L=r.mem[mi].L;return -(e.f[0]+0.5*e.wl[0]*L)})}   /* mean axial force, tension +, kN */
    var res=null,N,it,max=o.maxIter||15;
    if(o.first&&o.memL){N=axial({cases:{C:o.first},mem:o.memL})}                   /* start from a first-order result of the same combination */
    else{res=solve(cm);if(res.error)return {error:res.error};N=axial(res)}
    for(it=1;it<=max;it++){
      cm.kgN=N;res=solve(cm);
      if(res.error)return {error:'Second-order analysis unstable: the loads reach the elastic buckling load of the frame (K + Kg is not positive definite).',unstable:true};
      var N2=axial(res),dm=0,nm=1;N2.forEach(function(v,i){dm=Math.max(dm,Math.abs(v-N[i]));nm=Math.max(nm,Math.abs(v))});
      N=N2;if(dm<=1e-3*nm+1e-9)break;
    }
    return {res:res,cres:combine(res,{C:1}),iters:it,N:N,converged:it<=max};
  }
  /* linear combination of load cases: combo = {name:factor} */
  function combine(res,combo){
    var out={disp:[],end:[],reactions:{}},names=Object.keys(combo),first=res.cases[names[0]],i,j;
    for(i=0;i<res.nodes.length;i++){var d=[0,0,0,0,0,0];names.forEach(function(n){for(j=0;j<6;j++)d[j]+=combo[n]*res.cases[n].disp[i][j]});out.disp.push(d)}
    first.end.forEach(function(e,mi){
      var u=new Array(12).fill(0),f=new Array(12).fill(0),wl=[0,0,0];
      names.forEach(function(n){var q=res.cases[n].end[mi];for(j=0;j<12;j++){u[j]+=combo[n]*q.u[j];f[j]+=combo[n]*q.f[j]}for(j=0;j<3;j++)wl[j]+=combo[n]*q.wl[j]});
      out.end.push({u:u,f:f,wl:wl});
    });
    Object.keys(first.reactions).forEach(function(n){var v=[0,0,0,0,0,0];names.forEach(function(c){for(j=0;j<6;j++)v[j]+=combo[c]*res.cases[c].reactions[n][j]});out.reactions[n]=v});
    return out;
  }
  /* internal forces and relative deflection along member mi for a (combined) result, at nst+1 stations */
  function stations(res,cres,mi,nst,sec){
    var L=res.mem[mi].L,e=cres.end[mi],E=E_STEEL,out=[],f=e.f,wl=e.wl,k;
    for(k=0;k<=nst;k++){
      var x=L*k/nst,xi=x/L;
      var N=-(f[0]+wl[0]*x),Vy=-(f[1]+wl[1]*x),Vz=-(f[2]+wl[2]*x),T=-f[3];
      var Mz=-f[5]+x*f[1]+wl[1]*x*x/2,My=-f[4]-x*f[2]-wl[2]*x*x/2;
      var u=e.u,h1=1-3*xi*xi+2*xi*xi*xi,h2=L*(xi-2*xi*xi+xi*xi*xi),h3=3*xi*xi-2*xi*xi*xi,h4=L*(-xi*xi+xi*xi*xi);
      /* transverse displacement: v (plane xy, slope = th_z), w (plane xz, slope = -th_y) */
      var v=h1*u[1]+h2*u[5]+h3*u[7]+h4*u[11],w=h1*u[2]+h2*(-u[4])+h3*u[8]+h4*(-u[10]);
      var chordV=u[1]*(1-xi)+u[7]*xi,chordW=u[2]*(1-xi)+u[8]*xi;
      var dv=v-chordV,dw=w-chordW;
      if(sec&&e.sectionKnown!==false&&sec.Iz>0&&sec.Iy>0){
        dv+=wl[1]*x*x*(L-x)*(L-x)/(24*E*sec.Iz)-0;dw+=wl[2]*x*x*(L-x)*(L-x)/(24*E*sec.Iy)-0;
      }
      out.push({x:x,N:N,Vy:Vy,Vz:Vz,T:T,Mz:Mz,My:My,dv:dv,dw:dw});
    }
    return out;
  }
  window.EPCFem={solveSecond:solveSecond,addKg:addKg,solve:solve,combine:combine,stations:stations,rhs:rhs,chs:chs,axes:axes,E:E_STEEL,G:G_STEEL,GAMMA:GAMMA_STEEL};
})();
