/* EPC Shadow analysis: sun position, shadow-free row pitch and obstacle shadow reach.
   Pure geometry (no irradiance). Reads the shared Auto Design fields, so it follows Site, Layout and Electrical.
   Times are local SOLAR time (equation of time and longitude offset are ignored: up to ~±16 min). */
(function(){
  'use strict';
  var RAD=Math.PI/180,DEG=180/Math.PI,KEY='gs_epc_shadow_v1';
  var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MDAYS=[31,28,31,30,31,30,31,31,30,31,30,31];

  /* ---- engine (exported for tests) ---- */
  function dayOfYear(m,d){var n=d;for(var i=0;i<m;i++)n+=MDAYS[i];return n}
  function declination(n){return 23.45*Math.sin(RAD*360*(284+n)/365)}          // degrees, Cooper
  function sunPos(latDeg,n,hour){                                                // hour = solar time, 12 = noon
    var d=declination(n)*RAD,p=latDeg*RAD,H=(hour-12)*15*RAD;
    var sa=Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(H);
    sa=Math.max(-1,Math.min(1,sa));
    var alt=Math.asin(sa),ca=Math.cos(alt);
    var az=0;
    if(ca>1e-9){
      var c=(Math.sin(d)-Math.sin(alt)*Math.sin(p))/(ca*Math.cos(p));
      c=Math.max(-1,Math.min(1,c));
      az=Math.acos(c)*DEG;                                                       // 0..180 measured from north
      if(H>0)az=360-az;                                                          // afternoon: west of south
    }
    return {alt:alt*DEG,az:az};
  }
  function criticalDay(lat){return lat>=0?dayOfYear(11,21):dayOfYear(5,21)}      // winter solstice of the hemisphere
  /* Row pitch so the front row never shades the one behind inside [h1,h2] on day n.
     depth = slant length of one row (m); tilt, array azimuth (180 = south) in degrees. */
  function rowPitch(lat,n,h1,h2,depth,tilt,azim){
    var b=tilt*RAD,rise=depth*Math.sin(b),proj=depth*Math.cos(b),worst=0,worstH=null,worstAlt=null,usable=false;
    for(var h=h1;h<=h2+1e-9;h+=0.25){
      var s=sunPos(lat,n,h);
      if(s.alt<=0.5)continue;
      usable=true;
      var comp=rise/Math.tan(s.alt*RAD)*Math.cos((s.az-azim)*RAD);              // shadow reach toward the row behind
      if(comp>worst){worst=comp;worstH=h;worstAlt=s.alt}
    }
    return {pitch:proj+worst,shadow:worst,proj:proj,rise:rise,hour:worstH,alt:worstAlt,usable:usable};
  }
  function obstacleReach(lat,n,h1,h2,height){                                    // longest shadow of a vertical obstacle
    var worst=0,worstH=null;
    for(var h=h1;h<=h2+1e-9;h+=0.25){
      var s=sunPos(lat,n,h);
      if(s.alt<=0.5)continue;
      var L=height/Math.tan(s.alt*RAD);
      if(L>worst){worst=L;worstH=h}
    }
    return {reach:worst,hour:worstH};
  }
  window.EPCShadowEngine={declination:declination,sunPos:sunPos,rowPitch:rowPitch,obstacleReach:obstacleReach,dayOfYear:dayOfYear,criticalDay:criticalDay};

  /* ---- UI ---- */
  function $(id){return document.getElementById(id)}
  function val(id){var e=$(id);return e&&e.value!==''?parseFloat(e.value):NaN}
  function f(x,d){return isFinite(x)?x.toFixed(d):'–'}
  function hh(h){var m=Math.round(h*60);return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+(m%60)).slice(-2)}
  function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  var last=null;

  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({h1:$('epcs_h1').value,h2:$('epcs_h2').value,obs:$('epcs_obs').value}))}catch(e){}}

  function mount(){
    var host=$('epca_results');
    if(!host||$('epc_shadow'))return false;
    var d=document.createElement('details');
    d.id='epc_shadow';d.className='epq';d.open=true;
    d.innerHTML='<summary>Shadow analysis <span class="tag">LIVE</span></summary>'+
      '<div class="epcs-in" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0">'+
      '<label>Shade-free from (solar h)<input id="epcs_h1" type="number" min="6" max="17" step="0.25" value="9"></label>'+
      '<label>Shade-free until (solar h)<input id="epcs_h2" type="number" min="7" max="18" step="0.25" value="15"></label>'+
      '<label>Obstacle height above roof (m)<input id="epcs_obs" type="number" min="0" step="0.1" value="0"></label></div>'+
      '<div id="epcs_out"></div>';
    host.parentNode.insertBefore(d,host.nextSibling);
    var sv=load();
    if(sv.h1)$('epcs_h1').value=sv.h1;if(sv.h2)$('epcs_h2').value=sv.h2;if(sv.obs)$('epcs_obs').value=sv.obs;
    ['epcs_h1','epcs_h2','epcs_obs'].forEach(function(id){$(id).addEventListener('input',function(){save();run()})});
    d.addEventListener('click',function(e){if(e.target&&e.target.id==='epcs_apply')applyAlt()});
    return true;
  }

  function applyAlt(){
    if(!last||!last.effAlt)return;
    var a=Math.max(5,Math.min(85,Math.floor(last.effAlt)));                      // round down = conservative
    var el=$('epca_sun_alt');if(!el)return;
    el.value=a;el.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function run(){
    if(!$('epc_shadow'))return;
    var out=$('epcs_out');
    var lat=val('epca_lat'),tilt=val('epca_tilt'),az=val('epca_azimuth'),
        mw=val('epca_module_w'),ml=val('epca_module_l'),port=$('epca_orientation')&&$('epca_orientation').value==='portrait',
        h1=val('epcs_h1'),h2=val('epcs_h2'),obs=val('epcs_obs')||0;
    last=null;
    if(!isFinite(lat)){out.innerHTML='<div class="epca-empty">Enter latitude on the Site tab to see sun path and row spacing.</div>';return}
    if(lat<-60||lat>60){out.innerHTML='<div class="epca-empty">Latitude must be between −60° and 60°.</div>';return}
    if(!(h1>=6&&h2<=18&&h1<h2)){out.innerHTML='<div class="epca-empty">Shade-free window must have start before end, between 06:00 and 18:00.</div>';return}
    var depth=port?ml:mw,n=criticalDay(lat),html='';
    var rows=[];
    for(var m=0;m<12;m++){
      var dn=dayOfYear(m,15),a=sunPos(lat,dn,h1),b=sunPos(lat,dn,12),c=sunPos(lat,dn,h2);
      rows.push('<tr><td>'+MONTHS[m]+'</td><td>'+f(declination(dn),1)+'°</td><td>'+f(a.alt,1)+'° / '+f(a.az,0)+'°</td><td>'+f(b.alt,1)+'° / '+f(b.az,0)+'°</td><td>'+f(c.alt,1)+'° / '+f(c.az,0)+'°</td></tr>');
    }
    var table='<table class="epcs-t" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>15th of</th><th>Decl.</th><th>'+hh(h1)+' alt / az</th><th>12:00</th><th>'+hh(h2)+' alt / az</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
    var warn='';
    if(isFinite(depth)&&depth>0&&isFinite(tilt)&&tilt>=0&&tilt<=60&&isFinite(az)){
      var r=rowPitch(lat,n,h1,h2,depth,tilt,az);
      if(!r.usable){html+='<div class="epca-warnings">Sun is below the horizon for the whole window on the critical day. Choose daytime hours.</div>'}
      else{
        var altD=val('epca_sun_alt'),cur=isFinite(altD)?depth*Math.cos(tilt*RAD)+depth*Math.sin(tilt*RAD)/Math.tan(altD*RAD):NaN;
        var gcr=depth/r.pitch,eff=r.shadow>1e-6?Math.atan(r.rise/r.shadow)*DEG:null;
        last={effAlt:eff,pitch:r.pitch};
        var faceNote='';
        if(lat>=0&&Math.abs(az-180)>60)faceNote='Array azimuth is far from south. Sun-side shading is calculated for that direction.';
        if(lat<0&&Math.abs(az-0)>60&&Math.abs(az-360)>60)faceNote='In the southern hemisphere arrays normally face north.';
        html+='<div class="epcs-key" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0">'+
          '<div><b>'+f(r.pitch,3)+' m</b><br><small>Shadow-free row pitch ('+(lat>=0?'21 Dec':'21 Jun')+', '+hh(h1)+'–'+hh(h2)+')</small></div>'+
          '<div><b>'+f(r.shadow,3)+' m</b><br><small>Shadow reach added to the row footprint ('+f(r.proj,3)+' m)</small></div>'+
          '<div><b>'+f(gcr*100,0)+'%</b><br><small>Ground coverage ratio (row depth ÷ pitch)</small></div>'+
          '<div><b>'+(r.hour!==null?hh(r.hour):'–')+'</b><br><small>Governing time, sun altitude '+f(r.alt,1)+'°</small></div></div>';
        if(isFinite(cur)){
          var diff=cur-r.pitch,ok=diff>=-0.005;
          html+='<div class="epca-warnings">Auto Design currently spaces rows at '+f(cur,3)+' m (design sun altitude '+f(altD,0)+'°). '+
            (ok?'That is '+f(Math.abs(diff),3)+' m '+(diff>0.005?'more than needed, so it is safe but uses extra roof.':'which matches the shadow-free pitch.')
               :'That is <b>'+f(Math.abs(diff),3)+' m short</b>: rows will shade each other inside your window.')+
            (eff&&!ok?' <button type="button" class="btn alt sm" id="epcs_apply">Set design sun altitude to '+Math.max(5,Math.min(85,Math.floor(eff)))+'°</button>':'')+'</div>';
        }
        if(faceNote)html+='<div class="epca-warnings">'+esc(faceNote)+'</div>';
      }
    }else{
      html+='<div class="epca-empty">Enter tilt, azimuth and module size to calculate row pitch.</div>';
    }
    if(obs>0){
      var o=obstacleReach(lat,n,h1,h2,obs);
      html+='<div class="epca-warnings">Obstacle '+f(obs,2)+' m high (water tank, parapet or lift room): longest shadow on '+(lat>=0?'21 Dec':'21 Jun')+' is <b>'+f(o.reach,2)+' m</b> at '+(o.hour!==null?hh(o.hour):'–')+'. Keep modules clear of that distance on the side away from the sun.</div>';
    }
    html+='<div style="overflow-x:auto;margin-top:8px">'+table+'</div>'+
      '<small>Geometry only: solar time, no cloud or irradiance model. Uses declination (Cooper). Shadow reach = height ÷ tan(sun altitude) projected along the row normal. Roof survey governs; verify before construction drawings.</small>';
    out.innerHTML=html;
  }

  var t=null;function sched(){clearTimeout(t);t=setTimeout(run,150)}
  function init(){
    if(!mount())return;
    ['epca_lat','epca_tilt','epca_azimuth','epca_module_w','epca_module_l','epca_orientation','epca_sun_alt'].forEach(function(id){
      var e=$(id);if(e){e.addEventListener('input',sched);e.addEventListener('change',sched)}
    });
    document.addEventListener('epc:linked',sched);
    run();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0)});else setTimeout(init,0);
})();
