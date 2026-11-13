/* Second-order (P-delta) solver against closed-form solutions. Run from the repository root. */
global.window={};
require(require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets/epc-fem.js'));
const F=window.EPCFem;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-12,Math.abs(b));
const sec=F.rhs(0.08,0.08,0.003),L=3   /* square: both planes buckle at the same load, so the closed form for one plane applies */,
  EI=F.E*sec.Iy,Pcr=Math.PI*Math.PI*EI/(4*L*L);
/* vertical cantilever column along Z (local z = global X, so it bends with Iy), n elements */
function column(n,P,H,tension){
  const nodes=[],members=[];for(let i=0;i<=n;i++)nodes.push([0,0,L*i/n]);for(let i=0;i<n;i++)members.push({a:i,b:i+1,type:'beam',sec});
  return {nodes,members,supports:{0:[1,1,1,1,1,1]},cases:{H:{nodal:{[n]:[H,0,0,0,0,0]}},P:{nodal:{[n]:[0,0,tension?P:-P,0,0,0]}}}};
}
const H=1,n=8;
let m=column(n,0,H),r=F.solve(m);
ok('first order tip deflection HL^3/3EI',rel(r.cases.H.disp[n][0],H*L**3/(3*EI))<1e-9,r.cases.H.disp[n][0]);
/* compression at 30 % and 60 % of the Euler load */
[0.3,0.6,0.85].forEach(f=>{
  const P=f*Pcr,k=Math.sqrt(P/EI),u=k*L,exact=H*(Math.tan(u)-u)/(k**3*EI);
  const s=F.solveSecond(column(n,P,H),{H:1,P:1});
  ok('compression '+f+' Pcr: tip deflection vs closed form (amplification '+(exact/(H*L**3/(3*EI))).toFixed(3)+')',!s.error&&rel(s.cres.disp[n][0],exact)<0.003,s.error||(s.cres.disp[n][0]+' vs '+exact));
  if(f===0.3){
    const Mb=Math.abs(s.res.cases.C.reactions[0][4]);
    ok('base moment = H L + P x tip deflection',rel(Mb,H*L+P*s.cres.disp[n][0])<0.002,Mb+' vs '+(H*L+P*s.cres.disp[n][0]));
    ok('converged in few passes',s.converged&&s.iters<=4,s.iters);
    ok('axial force equals P (compression negative)',Math.abs(s.N[0]+P)<1e-6*P+1e-9,s.N[0]);
  }
});
/* tension stiffens */
{const P=0.6*Pcr,k=Math.sqrt(P/EI),u=k*L,exact=H*(u-Math.tanh(u))/(k**3*EI),s=F.solveSecond(column(n,P,H,true),{H:1,P:1});
 ok('tension 0.6 Pcr: tip deflection vs closed form (smaller than first order)',!s.error&&rel(s.cres.disp[n][0],exact)<0.003&&s.cres.disp[n][0]<H*L**3/(3*EI),s.error||(s.cres.disp[n][0]+' vs '+exact));}
/* buckling: just below the load is amplified a lot, above it is refused */
{const a=F.solveSecond(column(n,0.98*Pcr,H),{H:1,P:1}),b=F.solveSecond(column(n,1.05*Pcr,H),{H:1,P:1});
 ok('0.98 Pcr still solves with a large amplification',!a.error&&a.cres.disp[n][0]/(H*L**3/(3*EI))>20,a.error||(a.cres.disp[n][0]/(H*L**3/(3*EI))));
 ok('1.05 Pcr is reported as unstable',!!b.error&&b.unstable===true,b.error);}
/* Euler load from a single-element stiffness change: one element is within 1 % of exact */
{const s1=F.solveSecond(column(1,0.5*Pcr,H),{H:1,P:1}),k=Math.sqrt(0.5*Pcr/EI),ex=H*(Math.tan(k*L)-k*L)/(k**3*EI);ok('one element already within 2 % at 0.5 Pcr',!s1.error&&rel(s1.cres.disp[1][0],ex)<0.02,s1.error||(s1.cres.disp[1][0]+' vs '+ex));}
/* taut string: truss pieces with a prescribed axial force, mid-point load F: delta = F L / (4 T) */
{const A={A:1e-4,Iy:1e-9,Iz:1e-9,J:1e-9};const T=20,Fv=0.5,Ls=4;
 const ms={nodes:[[0,0,0],[Ls/2,0,0],[Ls,0,0]],members:[{a:0,b:1,type:'truss',sec:A},{a:1,b:2,type:'truss',sec:A}],supports:{0:[1,1,1,1,1,1],1:[0,0,0,1,1,1],2:[1,1,1,1,1,1]},cases:{F:{nodal:{1:[0,Fv,0,0,0,0]}}},kgN:[T,T]};
 const rs=F.solve(ms);ok('taut string: delta = F L / 4T',rel(rs.cases.F.disp[1][1],Fv*Ls/(4*T))<1e-9,rs.cases.F.disp[1][1]+' vs '+Fv*Ls/(4*T));
 ms.cases.F.nodal[1]=[0,0,Fv,0,0,0];const rz=F.solve(ms);ok('taut string works in the other transverse direction too',rel(rz.cases.F.disp[1][2],Fv*Ls/(4*T))<1e-9,rz.cases.F.disp[1][2]);}
/* rectangular column: bending in global Y uses Iz, and the weak-axis Euler load is lower than the strong-axis one */
{const sec=F.rhs(0.05,0.1,0.003);const nodes=[],members=[],nn=8;for(let i=0;i<=nn;i++)nodes.push([0,0,L*i/nn]);for(let i=0;i<nn;i++)members.push({a:i,b:i+1,type:'beam',sec});
 const mm={nodes,members,supports:{0:[1,1,1,1,1,1]},cases:{H:{nodal:{[nn]:[0,H,0,0,0,0]}},P:{nodal:{[nn]:[0,0,-0.3*F.E*sec.Iz*Math.PI**2/(4*L*L),0,0,0]}}}};
 const EIz=F.E*sec.Iz,P=0.3*Math.PI**2*EIz/(4*L*L),k=Math.sqrt(P/EIz),ex=H*(Math.tan(k*L)-k*L)/(k**3*EIz),s=F.solveSecond(mm,{H:1,P:1});
 ok('weak-axis column (bending about Iz) matches the closed form',!s.error&&rel(s.cres.disp[nn][1],ex)<0.003,s.error||(s.cres.disp[nn][1]+' vs '+ex));}
console.log(fail?'\n'+fail+' FAILED':'\nall P-delta checks passed');process.exit(fail?1:0);
