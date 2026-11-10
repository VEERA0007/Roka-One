global.window={};
require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets/epc-fem.js');
const F=window.EPCFem;let fail=0;
function ok(n,c,i){if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)}
const near=(a,b,t)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(b));
const sec=F.rhs(0.05,0.1,0.003);const EI=F.E*sec.Iy,EIz=F.E*sec.Iz,L=3,w=2;
// 1 cantilever along X, gravity UDL (global -z): bends about local y (strong axis, depth along z)
let m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec}],supports:{0:[1,1,1,1,1,1]},cases:{G:{udl:{0:[0,0,-w]}}}};
let r=F.solve(m);let d=r.cases.G.disp[1];
ok('cantilever tip deflection wL^4/8EI',near(d[2],-w*Math.pow(L,4)/(8*EI),1e-9),d[2]+' vs '+(-w*Math.pow(L,4)/(8*EI)));
ok('cantilever tip rotation wL^3/6EI',near(Math.abs(d[4]),w*Math.pow(L,3)/(6*EI),1e-9),d[4]);
let rc=r.cases.G.reactions[0];ok('reaction Fz = wL',near(rc[2],w*L,1e-9),rc[2]);ok('root moment wL^2/2',near(Math.abs(rc[4]),w*L*L/2,1e-9),rc[4]);
let st=F.stations(r,r.cases.G,0,10,sec);ok('M at root = wL^2/2',near(Math.abs(st[0].My),w*L*L/2,1e-9),st[0].My);ok('M at tip = 0',Math.abs(st[10].My)<1e-9,st[10].My);ok('V at root = wL',near(Math.abs(st[0].Vz),w*L,1e-9),st[0].Vz);
ok('relative deflection at the chord end is 0',Math.abs(st[10].dw)<1e-12,st[10].dw);
// weak axis: load in y
m.cases={G:{udl:{0:[0,-w,0]}}};r=F.solve(m);ok('weak-axis cantilever',near(r.cases.G.disp[1][1],-w*Math.pow(L,4)/(8*EIz),1e-9),r.cases.G.disp[1][1]);
// 2 simply supported beam
m={nodes:[[0,0,0],[L/2,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec},{a:1,b:2,type:'beam',sec}],supports:{0:[1,1,1,1,0,0],2:[0,1,1,0,0,0]},cases:{G:{udl:{0:[0,0,-w],1:[0,0,-w]}}}};
r=F.solve(m);ok('SS mid deflection 5wL^4/384EI',near(r.cases.G.disp[1][2],-5*w*Math.pow(L,4)/(384*EI),1e-9),r.cases.G.disp[1][2]);
let st2=F.stations(r,r.cases.G,0,10,sec);ok('SS M at mid = wL^2/8',near(Math.abs(st2[10].My),w*L*L/8,1e-9),st2[10].My);
ok('SS reaction wL/2',near(r.cases.G.reactions[0][2],w*L/2,1e-9),r.cases.G.reactions[0][2]);
// single-member SS, deflection from stations (particular + hermite)
m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec}],supports:{0:[1,1,1,1,0,0],1:[0,1,1,0,0,0]},cases:{G:{udl:{0:[0,0,-w]}}}};
r=F.solve(m);st=F.stations(r,r.cases.G,0,10,sec);ok('single SS member mid deflection (relative to chord)',near(st[5].dw,-5*w*Math.pow(L,4)/(384*EI),1e-8),st[5].dw);
ok('single SS member M mid',near(Math.abs(st[5].My),w*L*L/8,1e-9),st[5].My);
// 3 rotation invariance with CHS
const cs=F.chs(0.0603,0.0032),EIc=F.E*cs.Iy;
function rotPt(p,ang){const[ax,ay,az]=ang;let [x,y,z]=p;let c=Math.cos(ax),s=Math.sin(ax);[y,z]=[c*y-s*z,s*y+c*z];c=Math.cos(ay);s=Math.sin(ay);[x,z]=[c*x+s*z,-s*x+c*z];c=Math.cos(az);s=Math.sin(az);[x,y]=[c*x-s*y,s*x+c*y];return[x,y,z]}
const ang=[0.4,0.9,1.3];
m={nodes:[rotPt([0,0,0],ang),rotPt([L,0,0],ang)],members:[{a:0,b:1,type:'beam',sec:cs}],supports:{0:[1,1,1,1,1,1]},cases:{P:{nodal:{1:rotPt([0,0,-5],ang)}}}};
r=F.solve(m);const dd=r.cases.P.disp[1],mag=Math.hypot(dd[0],dd[1],dd[2]);ok('rotated cantilever tip PL^3/3EI',near(mag,5*L*L*L/(3*EIc),1e-9),mag+' vs '+5*L*L*L/(3*EIc));
// 4 torsion
m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec:cs}],supports:{0:[1,1,1,1,1,1]},cases:{T:{nodal:{1:[0,0,0,3,0,0]}}}};
r=F.solve(m);ok('torsion twist TL/GJ',near(r.cases.T.disp[1][3],3*L/(F.G*cs.J),1e-9),r.cases.T.disp[1][3]);
// 5 axial truss bar
m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'truss',sec:cs}],supports:{0:[1,1,1,1,1,1],1:[0,1,1,1,1,1]},cases:{P:{nodal:{1:[10,0,0,0,0,0]}}}};
r=F.solve(m);ok('truss PL/EA',near(r.cases.P.disp[1][0],10*L/(F.E*cs.A),1e-9),r.cases.P.disp[1][0]);
let stt=F.stations(r,r.cases.P,0,2,cs);ok('truss axial force = +10 (tension)',near(stt[1].N,10,1e-9),stt[1].N);
// 6 portal frame limits (frame in X-Z plane, loads in X)
function portal(Ib){const h=4,Lb=6,col=F.rhs(0.1,0.1,0.005),beam=F.chs(0.2,0.01);beam.Iy=Ib;beam.Iz=Ib;
  const mm={nodes:[[0,0,0],[0,0,h],[Lb,0,h],[Lb,0,0]],members:[{a:0,b:1,type:'beam',sec:col},{a:1,b:2,type:'beam',sec:beam},{a:2,b:3,type:'beam',sec:col}],supports:{0:[1,1,1,1,1,1],3:[1,1,1,1,1,1]},cases:{P:{nodal:{1:[10,0,0,0,0,0]}}}};
  const rr=F.solve(mm);return {d:rr.cases.P.disp[1][0],EIc:F.E*col.Iz===0?0:F.E*col.Iy,h};}
let pr=portal(1e3);ok('portal rigid beam sway Ph^3/24EI',near(pr.d,10*Math.pow(pr.h,3)/(24*pr.EIc),2e-3),pr.d+' vs '+10*Math.pow(pr.h,3)/(24*pr.EIc));
pr=portal(1e-12);ok('portal no beam stiffness sway Ph^3/6EI',near(pr.d,10*Math.pow(pr.h,3)/(6*pr.EIc),2e-3),pr.d+' vs '+10*Math.pow(pr.h,3)/(6*pr.EIc));
// 7 instability detection: pinned-base frame out of plane
m={nodes:[[0,0,0],[0,0,3]],members:[{a:0,b:1,type:'truss',sec:cs}],supports:{0:[1,1,1,0,0,0]},cases:{P:{nodal:{1:[1,0,0,0,0,0]}}}};
r=F.solve(m);ok('mechanism detected',!!r.error,r.error);
// 8 combination
m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec}],supports:{0:[1,1,1,1,1,1]},cases:{A:{udl:{0:[0,0,-1]}},B:{udl:{0:[0,0,-3]}}}};
r=F.solve(m);const cb=F.combine(r,{A:1.5,B:0.5});ok('combination = linear',near(cb.disp[1][2],-3*Math.pow(L,4)/(8*EI),1e-9),cb.disp[1][2]);
// 9 self weight
m={nodes:[[0,0,0],[L,0,0]],members:[{a:0,b:1,type:'beam',sec}],supports:{0:[1,1,1,1,1,1]},cases:{S:{selfweight:true}}};
r=F.solve(m);ok('self weight reaction = A*gamma*L',near(r.cases.S.reactions[0][2],sec.A*F.GAMMA*L,1e-9),r.cases.S.reactions[0][2]);
console.log(fail?'FAILED '+fail:'ALL PASS');
// dump a random 3D frame for python cross-check
const nodes=[[0,0,0],[0,0,3],[4,0,3.4],[4,0,0],[0,2.5,0],[0,2.5,3],[4,2.5,3.4],[4,2.5,0],[2,0,3.2],[2,2.5,3.2]];
const S1=F.rhs(0.06,0.1,0.004),S2=F.chs(0.0761,0.0032);
const mem=[[0,1,'beam',S1,0],[1,8,'beam',S2,0],[8,2,'beam',S2,0],[2,3,'beam',S1,0],[4,5,'beam',S1,0],[5,9,'beam',S2,0],[9,6,'beam',S2,0],[6,7,'beam',S1,0],[1,5,'beam',S1,0],[8,9,'beam',S1,0],[2,6,'beam',S1,0],[1,6,'truss',S2,0],[3,7,'beam',S1,0]];
const model={nodes,members:mem.map(a=>({a:a[0],b:a[1],type:a[2],sec:a[3],roll:a[4]})),supports:{0:[1,1,1,1,1,1],3:[1,1,1,1,1,1],4:[1,1,1,1,1,1],7:[1,1,1,1,1,1]},cases:{L:{nodal:{1:[4,2,-3,0,0,0],6:[0,-5,2,1,0,0]},udl:{1:[1.2,-0.5,-2],5:[0,0,-3],8:[0.3,0.4,-1.5]},selfweight:true}}};
const rs=F.solve(model);

process.exit(fail?1:0);
