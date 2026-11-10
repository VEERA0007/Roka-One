/* EPC thin-wall (slender) rectangular hollow sections: effective-width section properties.
   Method: Winter effective width as written in EN 1993-1-5 (rho = (lp - 0.055(3+psi))/lp^2, lp = (b/t)/(28.4 eps sqrt(k))), the same
   physical method that IS 801 uses for cold-formed steel; coefficients differ slightly, so a structural engineer confirms against IS 801.
   Units: mm, MPa. Corner radii Ro = 2t, Ri = t (flat width = b - 4t). Used by the Wind & Structure tab and the Analysis tab. No DOM. */
(function(){
  'use strict';
  function rho(lp,psi){
    var lim=0.5+Math.sqrt(0.085-0.055*psi);
    if(lp<=lim)return 1;
    return Math.min(1,(lp-0.055*(3+psi))/(lp*lp));
  }
  function ks(psi){
    if(psi>=1)return 4;
    if(psi>0)return 8.2/(1.05+psi);
    if(psi>-1)return 7.81-6.29*psi+9.78*psi*psi;
    return 5.98*Math.pow(1-psi,2);
  }
  function lam(bp,t,fy,k){return (bp/t)/(28.4*Math.sqrt(235/fy)*Math.sqrt(k))}
  function rr(B,H,Rc){var As=Rc*Rc*(1-Math.PI/4),Ics=Math.pow(Rc,4)*(1/3-Math.PI/16),yo=H/2-Rc,Isp=yo*yo*As+2*yo*(Rc*Rc*Rc/6)+Ics;return {A:B*H-4*As,I:B*H*H*H/12-4*Isp}}
  function gross(B,H,t){                                  /* exact area and second moment about mid-depth (axis parallel to B) */
    var o=rr(B,H,2*t),i=rr(B-2*t,H-2*t,t);return {A:o.A-i.A,I:o.I-i.I};
  }
  /* B = width of the compression flange, H = depth, t = wall; bending about the axis parallel to B */
  function rect(B,H,t,fy){
    if(!(B>0&&H>0&&t>0&&fy>0)||2*t>=Math.min(B,H))return null;
    var ro=2*t,bpf=B-2*ro,hpw=H-2*ro,g=gross(B,H,t);
    var out={A:g.A,I:g.I,Wg:g.I/(H/2),bpf:bpf,hpw:hpw,Ag:g.A};
    /* uniform compression (stub column): four flat elements, k = 4, psi = 1 */
    var rB=rho(lam(bpf,t,fy,4),1),rH=rho(lam(hpw,t,fy,4),1);
    out.Ac=g.A-2*t*((1-rB)*bpf+(1-rH)*hpw);
    /* bending: compression flange psi = 1, web with stress gradient found from the effective neutral axis */
    var rf=rho(lam(bpf,t,fy,4),1),yc=H/2,rw=1,psi=-1,Ae=g.A,Ie=g.I;
    for(var it=0;it<200;it++){
      var yt=yc-ro,yb=H-yc-ro;
      var removed=[];                                    /* [area, y from top fibre, own inertia] */
      var rfRem=(1-rf)*bpf;if(rfRem>0)removed.push([t*rfRem,t/2,rfRem*t*t*t/12]);
      if(yt>0){
        psi=-yb/yt;if(psi>1)psi=1;
        var hc=hpw/(1-psi);if(hc>hpw)hc=hpw;
        var kk=ks(psi);rw=rho(lam(hpw,t,fy,kk),psi);
        var beff=rw*hc,rem=hc-beff;
        if(rem>0){var ys=ro+0.4*beff+rem/2;removed.push([t*rem,ys,t*rem*rem*rem/12],[t*rem,ys,t*rem*rem*rem/12])}
      }
      var a=0,s=0,i2=0;removed.forEach(function(q){a+=q[0];s+=q[0]*q[1];i2+=q[0]*q[1]*q[1]+q[2]});
      var A2=g.A-a,S2=g.A*H/2-s,y2=S2/A2,It=g.I+g.A*H/2*H/2-i2,Ina=It-A2*y2*y2;
      var d=Math.abs(y2-yc);yc=y2;Ae=A2;Ie=Ina;if(d<1e-9)break;
    }
    out.Ab=Ae;out.Ib=Ie;out.W=Ie/Math.max(yc,H-yc);out.yc=yc;out.rf=rf;out.rw=rw;out.psi=psi;
    out.iters=it;out.reduced=(rB<1||rH<1||rf<1||rw<1);
    var eps=Math.sqrt(250/fy);
    out.tooThin=Math.max(bpf,hpw)/t>500;                    /* flat width ratio limit for stiffened elements */
    out.shearBuckling=hpw/t>67*eps;                         /* IS 800 cl. 8.4.2: web shear buckling not covered */
    return out;
  }
  window.EPCThin={rect:rect,rho:rho,ks:ks,lam:lam};
})();
