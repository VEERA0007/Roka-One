/* EPC STAAD export: writes one analysed block as a STAAD.Pro command file (.std) from the same model the Analysis tab solved.
   Units: metre, kN. Global axes: X, Y horizontal, Z up (SET Z UP). No DOM access. */
(function(){
  'use strict';
  var LC=[['DL','Dead','1 DL: dead load of modules and structure (global kN/m on purlins)'],['LL','Live','2 LL: roof live load'],['WLd','Wind','3 WLd: wind down, normal to the slope'],['WLu','Wind','4 WLu: wind uplift, normal to the slope'],['WLx','Wind','5 WLx: wind along the rows (+X)']];
  function num(v){var s=(Math.abs(v)<1e-12?0:v).toPrecision(9);return String(+s)}
  function clean(t){return String(t||'block').replace(/[^A-Za-z0-9 _.\-]/g,' ').replace(/\s+/g,' ').trim()}
  function build(run,title){
    var E=window.EPCAnalysisEngine,B=E.build(run.c,run.P),m=B.model,o=[],i;
    var G=window.EPCFem;
    function line(s){o.push(s)}
    function note(t){var w=t.split(' '),cur='*';w.forEach(function(x){if(cur.length+x.length+1>76){o.push(cur);cur='*'}cur+=' '+x});o.push(cur)}
    function wrap(ids,tail){                                  /* STAAD lines end with '-' to continue; keep them under the 79 column input width */
      var cur='',out=[];ids.concat(tail?[tail]:[]).forEach(function(t){if(cur.length+String(t).length+3>70){out.push(cur+' -');cur=''}cur+=(cur?' ':'')+t});out.push(cur);out.forEach(line)}
    line('STAAD SPACE '+clean(title));
    note('GenSolar Pro - EPC Engineering export. PRELIMINARY: generated from the Analysis tab model; not approved.');
    note('Units m, kN. Global Z is up. Members are exported with BETA 0: after opening, check Local Axes and that the section depth lies in the intended plane.');
    note('Section properties are gross (AX, IX, IY, IZ). The Analysis tab uses effective-width properties for thin-wall boxes, so STAAD results will differ slightly.');
    note('The Analysis tab design checks (IS 800 / IS 801 members, anchors) are not exported; run your own code check in STAAD.');
    line('START JOB INFORMATION');line('ENGINEER NAME GenSolar Pro');line('END JOB INFORMATION');
    line('INPUT WIDTH 79');line('SET Z UP');line('UNIT METER KN');
    line('JOINT COORDINATES');
    m.nodes.forEach(function(p,k){line((k+1)+' '+num(p[0])+' '+num(p[1])+' '+num(p[2])+';')});
    line('MEMBER INCIDENCES');
    m.members.forEach(function(e,k){line((k+1)+' '+(e.a+1)+' '+(e.b+1)+';')});
    /* truss members carry axial force only */
    var tr=[];m.members.forEach(function(e,k){if(e.type==='truss')tr.push(k+1)});
    if(tr.length){line('MEMBER TRUSS');wrap(tr)}
    line('MEMBER PROPERTY');
    var groups={},ord=[];
    m.members.forEach(function(e,k){var s=e.sec,key=[s.A,s.J,s.Iy,s.Iz].join('|');if(!groups[key]){groups[key]={sec:s,ids:[],kinds:{}};ord.push(key)}groups[key].ids.push(k+1);groups[key].kinds[B.mem[k].kind]=1});
    ord.forEach(function(key){var g=groups[key],s=g.sec;
      line('* '+Object.keys(g.kinds).join(', ')+(s.b?' '+Math.round(s.b*1000)+'x'+Math.round(s.h*1000)+'x'+(s.t*1000)+' mm':''));
      wrap(g.ids,'PRIS AX '+num(s.A)+' IX '+num(s.J)+' IY '+num(s.Iy)+' IZ '+num(s.Iz))});
    line('CONSTANTS');line('E 2.0E8 ALL');line('POISSON 0.3 ALL');line('DENSITY 78.5 ALL');line('ALPHA 1.2E-5 ALL');
    line('SUPPORTS');
    var pin=[],fix=[];Object.keys(m.supports).forEach(function(n){var f=m.supports[n];(f[3]||f[4]||f[5]?fix:pin).push(+n+1)});
    if(pin.length)wrap(pin,'PINNED');if(fix.length)wrap(fix,'FIXED');
    LC.forEach(function(c,k){
      line('LOAD '+(k+1)+' LOADTYPE '+c[1]+' TITLE '+c[0]);
      var rows=[];
      Object.keys(m.cases[c[0]].udl).forEach(function(mi){var w=m.cases[c[0]].udl[mi];
        ['GX','GY','GZ'].forEach(function(ax,j){if(Math.abs(w[j])>1e-12)rows.push((+mi+1)+' UNI '+ax+' '+num(w[j]))})});
      if(rows.length){line('MEMBER LOAD');rows.forEach(line)}});
    var n=10;
    run.ULS.concat(run.SLS).forEach(function(cb){
      n++;line('LOAD COMBINATION '+n+' '+clean(cb.name));
      var parts=[];LC.forEach(function(c,k){if(cb.f[c[0]])parts.push((k+1)+' '+num(cb.f[c[0]]))});line(parts.join(' '))});
    note('First-order analysis. The Analysis tab also runs second-order (P-Delta) on the ultimate combinations; repeat that in STAAD if required.');
    line('PERFORM ANALYSIS');line('FINISH');
    return o.join('\n')+'\n';
  }
  window.EPCStaad={build:build};
  if(typeof module!=='undefined')module.exports=window.EPCStaad;
})();
