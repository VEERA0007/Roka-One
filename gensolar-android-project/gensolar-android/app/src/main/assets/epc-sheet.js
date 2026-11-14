/* EPC Survey: floor sheet, scale and tracing, site photos and videos.
   The engineer uploads the 2D sheet of the floor, sets the scale from one known dimension, then traces roof areas, structures and tanks by tapping.
   Tracing only fills the Survey rows (X, Y, width, depth, level, height); the rows stay editable and the sheet overlay follows them.
   Engine part has no DOM access and is unit tested. */
(function(){
  'use strict';
  var r2=function(x){return Math.round(x*100)/100};
  function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
  /* pixels per metre from two taps on the sheet and the real distance between them (m) */
  function setScale(p1,p2,real){var d=dist(p1,p2);if(!(d>=4)||!(real>0))return NaN;return d/real}
  function toM(pt,ppm,H){return [r2(pt[0]/ppm),r2((H-pt[1])/ppm)]}            /* sheet pixel (y down) -> metres (y up), origin at the lower-left of the sheet image */
  function toPx(m,ppm,H){return [m[0]*ppm,H-m[1]*ppm]}
  function rect(a,b,ppm,H){var p=toM(a,ppm,H),q=toM(b,ppm,H),w=r2(Math.abs(p[0]-q[0])),d=r2(Math.abs(p[1]-q[1]));if(!(w>=0.1&&d>=0.1))return null;return {x:Math.min(p[0],q[0]),y:Math.min(p[1],q[1]),w:w,d:d}}
  function circle(c,e,ppm,H){var r=dist(c,e)/ppm,m=toM(c,ppm,H);if(!(r>=0.05))return null;return {x:r2(m[0]-r),y:r2(m[1]-r),w:r2(2*r)}}
  window.EPCSheet={setScale:setScale,toM:toM,toPx:toPx,rect:rect,circle:circle};
  if(typeof module!=='undefined')module.exports=window.EPCSheet;
})();

/* ================= UI ================= */
(function(){
  'use strict';
  if(typeof document==='undefined')return;
  var SH=window.EPCSheet,KEY='gs_epc_sheet_v1',DB='gs_epc_media_v1',MAXVID=40*1024*1024;
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function proj(){var e=$('engSite');return e&&e.value.trim()?e.value.trim():'(unnamed)'}
  var kindSel='',M={floor:'',W:0,H:0,ppm:0,cal:null},mode='',pend=[],shape=null,urls=[],sheetUrl='',media=[],timer=null,msg='';
  function lsAll(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function save(){var a=lsAll();a[proj()]=M;try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
  function load(){var o=lsAll()[proj()];M={floor:'',W:0,H:0,ppm:0,cal:null};if(o)Object.keys(M).forEach(function(k){if(o[k]!==undefined)M[k]=o[k]})}

  /* ---------- IndexedDB (sheet image, photos, videos) ---------- */
  var dbp=null;
  function db(){if(dbp)return dbp;dbp=new Promise(function(res,rej){try{var q=indexedDB.open(DB,1);q.onupgradeneeded=function(){q.result.createObjectStore('f',{keyPath:'id'})};q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}}catch(e){rej(e)}});return dbp}
  function tx(mode,fn){return db().then(function(d){return new Promise(function(res,rej){var t=d.transaction('f',mode),s=t.objectStore('f'),r=fn(s);t.oncomplete=function(){res(r&&r.result)};t.onerror=function(){rej(t.error)}})})}
  function put(o){return tx('readwrite',function(s){return s.put(o)})}
  function del(id){return tx('readwrite',function(s){return s.delete(id)})}
  function all(){return tx('readonly',function(s){return s.getAll()}).then(function(r){return r||[]})}
  function prefix(){return proj()+'|'+(M.floor||'')+'|'}
  function reloadMedia(){return all().then(function(r){media=r.filter(function(x){return x.id.indexOf(prefix())===0&&x.kind!=='sheet'}).sort(function(a,b){return a.t-b.t});return r.filter(function(x){return x.id===prefix()+'sheet'})[0]||null})}

  /* ---------- image helpers ---------- */
  function shrink(file,max){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){var k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){b?res({blob:b,w:c.width,h:c.height}):rej(new Error('Could not read the image'))},'image/jpeg',0.88)};im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('This file is not an image the browser can read. Export the sheet page as PNG or JPG.'))};im.src=u})}
  function url(b){var u=URL.createObjectURL(b);urls.push(u);return u}
  function clearUrls(){urls.forEach(function(u){URL.revokeObjectURL(u)});urls=[]}

  /* ---------- page ---------- */
  function steps(){
    var rows=window.EPCSurveyUI?window.EPCSurveyUI.rows():{parts:[],obs:[]},res=window.EPCSurvey&&window.EPCSurvey.last,
        list=[['Floor',!!M.floor],['Sheet',!!sheetUrl],['Scale',M.ppm>0],['Trace',rows.parts.length+rows.obs.length>0],['Photos',media.length>0],['Dimensions',rows.parts.length>0&&M.ppm>0]];
    return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">'+list.map(function(s,i){return '<span style="padding:3px 9px;border-radius:12px;font-size:12px;border:1px solid var(--line,#8886);'+(s[1]?'background:var(--ok,#1a7f4b);color:#fff':'')+'">'+(i+1)+'. '+s[0]+(s[1]?' ✓':'')+'</span>'}).join('')+'<span style="font-size:12px;align-self:center">then 3D and shadows below</span></div>';
  }
  function say(m,bad){msg=m;var e=$('epcs_msg');if(e){e.textContent=m;e.style.color=bad?'var(--danger,#b3261e)':''}}
  function stage(){
    if(!sheetUrl)return '<p class="ep-note">Upload the sheet of this floor (PNG or JPG; for a PDF, export the page as an image first).</p>';
    var rows=window.EPCSurveyUI.rows(),h='<svg id="epcs_svg" viewBox="0 0 '+M.W+' '+M.H+'" style="width:100%;max-height:70vh;background:#fff;border:1px solid var(--line,#8886);touch-action:manipulation;cursor:crosshair" role="img" aria-label="Floor sheet with traced areas"><image href="'+sheetUrl+'" x="0" y="0" width="'+M.W+'" height="'+M.H+'"/>';
    var sw=Math.max(1.5,M.W/500);
    if(M.ppm>0){
      rows.parts.forEach(function(p){var x=parseFloat(p.x),y=parseFloat(p.y),w=parseFloat(p.w),d=parseFloat(p.d);if(![x,y,w,d].every(isFinite))return;var a=SH.toPx([x,y+d],M.ppm,M.H);h+='<rect x="'+a[0].toFixed(1)+'" y="'+a[1].toFixed(1)+'" width="'+(w*M.ppm).toFixed(1)+'" height="'+(d*M.ppm).toFixed(1)+'" fill="rgba(47,95,208,.18)" stroke="#2f5fd0" stroke-width="'+sw+'"/><text x="'+(a[0]+4).toFixed(1)+'" y="'+(a[1]+sw*8).toFixed(1)+'" font-size="'+(sw*8)+'" fill="#0d2a7a" font-weight="700">'+esc(p.name)+(parseFloat(p.level)>0?' +'+p.level+' m':'')+'</text>'});
      rows.obs.forEach(function(o){var x=parseFloat(o.x),y=parseFloat(o.y),w=parseFloat(o.w),d=o.shape==='round'?w:parseFloat(o.d);if(![x,y,w,d].every(isFinite))return;var a=SH.toPx([x,y+d],M.ppm,M.H),t='<text x="'+(a[0]+4).toFixed(1)+'" y="'+(a[1]+sw*8).toFixed(1)+'" font-size="'+(sw*8)+'" fill="#7a1d0d" font-weight="700">'+esc(o.name)+' '+(parseFloat(o.base)>0?o.base+'–':'')+o.h+' m</text>';
        h+=(o.shape==='round'?'<ellipse cx="'+(a[0]+w*M.ppm/2).toFixed(1)+'" cy="'+(a[1]+w*M.ppm/2).toFixed(1)+'" rx="'+(w*M.ppm/2).toFixed(1)+'" ry="'+(w*M.ppm/2).toFixed(1)+'"':'<rect x="'+a[0].toFixed(1)+'" y="'+a[1].toFixed(1)+'" width="'+(w*M.ppm).toFixed(1)+'" height="'+(d*M.ppm).toFixed(1)+'"')+' fill="rgba(216,67,21,.22)" stroke="#d84315" stroke-width="'+sw+'"/>'+t});
    }
    if(M.cal)h+='<line x1="'+M.cal[0][0]+'" y1="'+M.cal[0][1]+'" x2="'+M.cal[1][0]+'" y2="'+M.cal[1][1]+'" stroke="#0a0" stroke-width="'+sw+'" stroke-dasharray="'+sw*3+' '+sw*2+'"/>';
    pend.forEach(function(p){h+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+sw*2.5+'" fill="#e91e63"/>'});
    if(pend.length===2)h+='<line x1="'+pend[0][0]+'" y1="'+pend[0][1]+'" x2="'+pend[1][0]+'" y2="'+pend[1][1]+'" stroke="#e91e63" stroke-width="'+sw+'"/>';
    return h+'</svg>';
  }
  function form(){
    if(mode==='scale2'&&pend.length===2)return '<div class="epcv-row" style="margin:8px 0"><label>Real distance between the two taps (m)<input id="epcs_real" type="number" min="0.1" step="any" inputmode="decimal"></label><button class="btn sm" type="button" id="epcs_setscale">Set scale</button></div>';
    if(shape){var isP=shape.kind==='part',isR=shape.kind==='round';
      return '<div class="epcv-row" style="margin:8px 0;align-items:flex-end"><label>Name<input id="epcs_name" type="text" value="'+esc(shape.name)+'"></label>'+
        (isP?'<label>Level of this roof above the datum (m)<input id="epcs_level" type="number" min="0" step="any" inputmode="decimal" value="0"></label><label style="flex-direction:row;align-items:center;gap:6px"><input id="epcs_struct" type="checkbox" checked> It sits on top of a structure (add that structure as a box)</label>':
         '<label>Top height above the datum (m)<input id="epcs_h" type="number" min="0" step="any" inputmode="decimal"></label><label>Base level it stands on (m; 0 = the floor, or the roof level it stands on)<input id="epcs_base" type="number" min="0" step="any" inputmode="decimal" value="0"></label>')+
        '<button class="btn sm" type="button" id="epcs_add">Add</button><button class="btn alt sm" type="button" id="epcs_cancel">Cancel</button></div><p class="ep-note">Size from the tap: '+(isR?'diameter '+shape.g.w+' m':shape.g.w+' × '+shape.g.d+' m')+(isP?'. A tank, room or shed is not a roof area: use the box or round tools for those.':'')+'</p>';}
    return '';
  }
  function hint(){
    return {scale1:'Tap the first end of a dimension you know on the sheet.',scale2:'Tap the second end, then type the real distance.',box1:'Tap one corner.',box2:'Tap the opposite corner.',round1:'Tap the centre of the tank.',round2:'Tap a point on its edge.'}[mode]||'';
  }
  function media_html(){
    var h='';
    media.forEach(function(m){h+='<div style="border:1px solid var(--line,#8886);border-radius:8px;padding:6px;width:150px">'+(m.kind==='video'?'<video src="'+url(m.blob)+'" controls preload="metadata" style="width:100%;max-height:100px"></video>':'<img alt="Site photo" src="'+url(m.blob)+'" style="width:100%;max-height:100px;object-fit:cover">')+
      '<input data-note="'+esc(m.id)+'" type="text" placeholder="Note" value="'+esc(m.note||'')+'" style="width:100%;margin-top:4px" aria-label="Note"><button class="btn x" type="button" data-delm="'+esc(m.id)+'" aria-label="Remove">×</button></div>'});
    return h||'<p class="ep-note">No photos or videos for this floor yet.</p>';
  }
  function draw(){
    var root=$('epcs');if(!root)return;clearUrls();
    var sc=window.scrollY;
    root.innerHTML='<div class="panel" style="margin-bottom:12px"><h3 style="margin:0 0 4px;font-size:16px">Floor sheet, scale and tracing</h3>'+steps()+
      '<div class="epcv-g"><label>1. Which floor / roof is this sheet?<input id="epcs_floor" type="text" placeholder="e.g. 5th floor terrace" value="'+esc(M.floor)+'"></label>'+
      '<label>2. Sheet of this floor (image)<input id="epcs_file" type="file" accept="image/*"'+(M.floor?'':' disabled')+'></label></div>'+
      '<p class="ep-note">Heights are measured from the roof of this floor (the datum). A penthouse roof, lift-room roof and tank tops are entered as heights above it.</p>'+
      '<div class="ep-bar"><button class="btn alt sm" type="button" data-tool="scale1"'+(sheetUrl?'':' disabled')+'>3. Set scale</button>'+
      '<button class="btn alt sm" type="button" data-tool="box1"'+(M.ppm>0?'':' disabled')+'>4a. Trace roof area</button><button class="btn alt sm" type="button" data-tool="box1b"'+(M.ppm>0?'':' disabled')+'>4b. Trace box (room, penthouse, shed)</button><button class="btn alt sm" type="button" data-tool="round1"'+(M.ppm>0?'':' disabled')+'>4c. Trace round (tank)</button>'+
      (M.ppm>0?'<span class="ep-note" style="align-self:center">Scale: '+(1/M.ppm*100).toFixed(2)+' cm per pixel</span>':'')+'</div>'+
      '<div id="epcs_hint" class="ep-note" aria-live="polite">'+esc(hint())+'</div><div id="epcs_form">'+form()+'</div><div id="epcs_msg" class="ep-note" aria-live="polite"'+'>'+esc(msg)+'</div>'+
      '<div id="epcs_stage">'+stage()+'</div>'+
      '<h3 style="margin:14px 0 4px;font-size:15px">5. Photos and videos of this floor</h3><div class="epcv-g"><label>Add photos or videos<input id="epcs_media" type="file" accept="image/*,video/*" multiple'+(M.floor?'':' disabled')+'></label></div><div style="display:flex;flex-wrap:wrap;gap:8px" id="epcs_media_list">'+media_html()+'</div>'+
      '<p class="ep-note">Photos are saved with the project (reduced to 1600 px) and go into the exported report. Videos stay in this app (up to 40 MB each); the report lists them.</p>'+
      '<p class="ep-note"><b>6. Check the dimensions</b> in the Survey rows below. Any change there moves the outlines on the sheet, so you can compare them with the drawing.</p></div>';
    window.scrollTo(0,sc);
  }
  function refreshOverlay(){var st=$('epcs_stage');if(st&&sheetUrl){st.innerHTML=stage();var s=document.querySelector('#epcs .ep-bar');}var stp=document.querySelector('#epcs .panel>div[style*="flex-wrap"]');}
  function startTool(t){mode=t==='box1b'?'box1':t;shape=null;pend=[];kindSel=t==='box1'?'part':t==='box1b'?'box':'round';draw()}
  function nextName(kind){var rows=window.EPCSurveyUI.rows();return kind==='part'?'Area '+String.fromCharCode(65+rows.parts.length%26):kind==='round'?'Tank '+(rows.obs.filter(function(o){return o.shape==='round'}).length+1):'Structure '+(rows.obs.filter(function(o){return o.shape!=='round'}).length+1)}
  function tap(e){
    var svg=$('epcs_svg');if(!svg||!mode)return;
    var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var q=pt.matrixTransform(svg.getScreenCTM().inverse()),p=[Math.max(0,Math.min(M.W,q.x)),Math.max(0,Math.min(M.H,q.y))];
    pend.push(p);
    if(mode==='scale1'){mode='scale2';draw();return}
    if(mode==='scale2'){if(pend.length>2)pend=[pend[0],p];draw();return}
    if(mode==='box1'&&pend.length===1){mode='box2';draw();return}
    if(mode==='box2'&&pend.length===2){var g=SH.rect(pend[0],pend[1],M.ppm,M.H);if(!g){pend=[];mode='box1';say('That box is too small. Tap two opposite corners again.',true);draw();return}var k=kindSel;shape={kind:k,g:g,name:nextName(k)};mode='';pend=pend.slice(0,2);draw();return}
    if(mode==='round1'&&pend.length===1){mode='round2';draw();return}
    if(mode==='round2'&&pend.length===2){var c=SH.circle(pend[0],pend[1],M.ppm,M.H);if(!c){pend=[];mode='round1';say('That circle is too small. Tap the centre, then a point on its edge.',true);draw();return}shape={kind:'round',g:c,name:nextName('round')};mode='';draw();return}
    draw();
  }
  function onClick(e){
    var t=e.target,id=t.id||'';
    if(t.getAttribute&&t.getAttribute('data-tool')){startTool(t.getAttribute('data-tool'));return}
    if(id==='epcs_setscale'){var real=parseFloat($('epcs_real').value),ppm=SH.setScale(pend[0],pend[1],real);if(!(ppm>0)){say('Enter the real distance (m); the two taps must not be on the same spot.',true);return}M.ppm=ppm;M.cal=[pend[0],pend[1]];save();mode='';pend=[];say('Scale set: '+(real)+' m = '+Math.round(SH.setScale(M.cal[0],M.cal[1],real)*real)+' px. Check one more known dimension after tracing.');draw();return}
    if(id==='epcs_cancel'){shape=null;pend=[];draw();return}
    if(id==='epcs_add'&&shape){
      var nm=$('epcs_name').value.trim()||shape.name,g=shape.g,U=window.EPCSurveyUI;
      if(shape.kind==='part'){var lv=parseFloat($('epcs_level').value);if(!(lv>=0)){say('Enter the level of this roof above the datum (0 or more).',true);return}
        U.addPart({name:nm,x:g.x,y:g.y,w:g.w,d:g.d,level:lv});
        if(lv>0&&$('epcs_struct').checked)U.addObs({name:nm+' structure',shape:'rect',x:g.x,y:g.y,w:g.w,d:g.d,h:lv,base:0});
        say(nm+' added'+(lv>0&&$('epcs_struct').checked?' with the structure below it as a box (top at '+lv+' m)':'')+'.');}
      else{var h=parseFloat($('epcs_h').value),b=parseFloat($('epcs_base').value);if(!(h>0)){say('Enter the top height above the datum (m).',true);return}if(!(b>=0&&b<h)){say('The base level must be 0 or more and below the top.',true);return}
        U.addObs({name:nm,shape:shape.kind==='round'?'round':'rect',x:g.x,y:g.y,w:g.w,d:g.d||g.w,h:h,base:b});say(nm+' added.');}
      shape=null;pend=[];draw();return}
    if(t.getAttribute&&t.getAttribute('data-delm')){var id2=t.getAttribute('data-delm');del(id2).then(reloadMedia).then(draw);return}
  }
  function onChange(e){
    var t=e.target,id=t.id||'';
    if(id==='epcs_floor'){M.floor=t.value.trim();save();load2();return}
    if(id==='epcs_file'&&t.files&&t.files[0]){var f=t.files[0];say('Reading the sheet…');
      shrink(f,2200).then(function(r){M.W=r.w;M.H=r.h;M.ppm=0;M.cal=null;save();return put({id:prefix()+'sheet',kind:'sheet',blob:r.blob,t:Date.now()}).then(function(){sheetUrl=url(r.blob);say('Sheet loaded. Next: set the scale from a dimension you know on it.');draw()})}).catch(function(er){say(er.message,true)});return}
    if(id==='epcs_media'&&t.files&&t.files.length){var fs=Array.prototype.slice.call(t.files);say('Saving…');
      Promise.all(fs.map(function(f,i){var vid=/^video\//.test(f.type);
        if(vid){if(f.size>MAXVID)return Promise.resolve('"'+f.name+'" is larger than 40 MB and was not saved.');return put({id:prefix()+'m'+Date.now()+'_'+i,kind:'video',name:f.name,note:'',blob:f,t:Date.now()+i}).then(function(){return ''})}
        return shrink(f,1600).then(function(r){return put({id:prefix()+'m'+Date.now()+'_'+i,kind:'photo',name:f.name,note:'',blob:r.blob,t:Date.now()+i})}).then(function(){return ''}).catch(function(er){return f.name+': '+er.message})}))
       .then(function(m){var bad=m.filter(Boolean).join(' ');return reloadMedia().then(function(){say(bad||'Saved.',!!bad);draw()})});return}
    if(t.getAttribute&&t.getAttribute('data-note')){var key=t.getAttribute('data-note'),v=t.value;all().then(function(r){var o=r.filter(function(x){return x.id===key})[0];if(o){o.note=v;return put(o)}})}
  }
  function load2(){reloadMedia().then(function(s){clearUrls();sheetUrl=s?url(s.blob):'';
    if(s&&!(M.W>0)){var im=new Image();im.onload=function(){M.W=im.naturalWidth;M.H=im.naturalHeight;save();draw()};im.src=sheetUrl;return}
    draw()})}
  function mount(){
    var sec=$('epc_p-survey'),v=$('epcv');if(!sec||!v||$('epcs')||!window.EPCSurveyUI)return false;
    var d=document.createElement('div');d.id='epcs';sec.insertBefore(d,v);
    d.addEventListener('click',onClick);d.addEventListener('change',onChange);d.addEventListener('input',function(e){if(e.target.id==='epcs_floor'){}});
    d.addEventListener('pointerup',function(e){if(e.target.closest&&e.target.closest('#epcs_svg'))tap(e)});
    sec.addEventListener('input',function(e){if(d.contains(e.target))return;clearTimeout(timer);timer=setTimeout(function(){var st=$('epcs_stage');if(st&&sheetUrl)st.innerHTML=stage()},250)});
    sec.addEventListener('change',function(e){if(d.contains(e.target))return;clearTimeout(timer);timer=setTimeout(draw,250)});
    var en=$('engSite');if(en)en.addEventListener('change',function(){load();load2()});
    load();load2();return true;
  }
  function init(){if(!mount())setTimeout(init,300)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,500)});else setTimeout(init,500);
  window.EPCSheetUI={state:function(){return {M:M,media:media.length,sheet:!!sheetUrl}}};
})();
