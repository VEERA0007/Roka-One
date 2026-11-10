global.window={};
require(require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets/epc-thin.js'));
const T=window.EPCThin;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};
const near=(a,b,t)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(b));
/* 1 thick section: nothing reduced, W equals the gross modulus */
let r=T.rect(100,100,6,250);ok('thick 100x100x6 not reduced',!r.reduced&&near(r.W,r.Wg,1e-6),r.W+' '+r.Wg);
/* 2 hand calculation, 100x100x2, fy 250, compression: bp=92, k=4, eps=sqrt(235/250) */
r=T.rect(100,100,2,250);
const eps=Math.sqrt(235/250),lp=(92/2)/(28.4*eps*2),rh=(lp-0.055*4)/(lp*lp),Ahand=r.Ag-4*2*(1-rh)*92;
ok('100x100x2 lambda_p',near(lp,0.8353,2e-3),lp.toFixed(4));
ok('100x100x2 effective compression area = hand value',near(r.Ac,Ahand,1e-9),r.Ac.toFixed(2)+' vs '+Ahand.toFixed(2));
ok('100x100x2 area ratio',r.Ac/r.Ag>0.85&&r.Ac/r.Ag<0.92,(r.Ac/r.Ag).toFixed(4));
/* 3 bending: independent strip integration of the converged effective section */
function indep(B,H,t,o){
  const ro=2*t,bpf=B-2*ro,hpw=H-2*ro,N=200000,dy=H/N;
  function width(Bw,Hw,rad,y){const hy=Hw/2,ay=Math.abs(y);if(ay>=hy)return 0;const lim=hy-rad;if(ay<=lim||rad<=0)return Bw;const d=ay-lim;return Bw-2*rad+2*Math.sqrt(Math.max(0,rad*rad-d*d))}
  const rfRem=(1-o.rf)*bpf,hc=hpw/(1-o.psi),beff=o.rw*Math.min(hc,hpw),rem=Math.min(hc,hpw)-beff,y0=ro+0.4*beff;
  let A=0,S=0,I0=0;
  for(let i=0;i<N;i++){const y=(i+0.5)*dy;let w=width(B,H,ro,H/2-y)-width(B-2*t,H-2*t,t,H/2-y);
    if(y<t)w-=rfRem;                                   /* flange band removed (thickness t at the top) */
    if(y>y0&&y<y0+rem)w-=2*t;                          /* both webs, ineffective strip */
    A+=w*dy;S+=w*y*dy;I0+=w*y*y*dy}
  const yc=S/A,I=I0-A*yc*yc;return {A,yc,I};
}
for(const [B,H,t] of [[100,100,2],[100,60,1.6],[80,120,1.5],[60,40,2],[150,150,2]]){
  r=T.rect(B,H,t,250);const q=indep(B,H,t,r);
  ok('effective bending section '+B+'x'+H+'x'+t+' matches strip integration (A, NA, I)',near(r.Ab,q.A,2e-4)&&near(r.yc,q.yc,2e-4)&&near(r.Ib,q.I,5e-4),
    'A '+r.Ab.toFixed(1)+'/'+q.A.toFixed(1)+' yc '+r.yc.toFixed(3)+'/'+q.yc.toFixed(3)+' I '+r.Ib.toFixed(0)+'/'+q.I.toFixed(0)+' W/Wg '+(r.W/r.Wg).toFixed(3)+' reduced '+r.reduced);
}
/* 4 monotonic: thicker wall never loses efficiency */
let prev=0,mono=true;for(let t=1;t<=4;t+=0.25){const e=T.rect(100,100,t,250),ratio=e.W/e.Wg;if(ratio<prev-1e-9)mono=false;prev=ratio}
ok('effective/gross modulus rises with thickness',mono);
/* 5 effective section is never stronger than gross */
ok('effective modulus <= gross, area <= gross',T.rect(100,100,2,250).W<=T.rect(100,100,2,250).Wg&&T.rect(100,100,2,250).Ac<=T.rect(100,100,2,250).Ag);
/* 6 higher fy reduces more */
ok('higher yield strength reduces the section more',T.rect(100,100,2,350).Ac<T.rect(100,100,2,250).Ac);
/* 7 limits and invalid */
ok('invalid input returns null',T.rect(10,10,6,250)===null);
ok('60x40x2 is fully effective',!T.rect(40,60,2,250).reduced);
console.log(fail?'FAILED '+fail:'ALL PASS');process.exit(fail?1:0);
