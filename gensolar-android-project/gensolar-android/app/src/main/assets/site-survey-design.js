(function(){
'use strict';
var root=document.getElementById('epcAutoDesign');if(!root||document.getElementById('epca_cadWorkspace'))return;
var style=document.createElement('style');
style.textContent=`
#epca_cadWorkspace{display:flex;flex-direction:column;gap:12px}
#epca_cadWorkspace .cad-grid{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:900px){#epca_cadWorkspace .cad-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
#epca_cadWorkspace .cad-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
#epca_cadWorkspace h3{margin:0;font:700 14px var(--font-body)}
#epca_cadWorkspace .cad-muted{font-size:11px;color:var(--muted);line-height:1.5;margin:0}
#epca_cadWorkspace .cad-actions{display:flex;flex-wrap:wrap;gap:7px}
#epca_cadWorkspace .cad-drop{border:1px dashed var(--deep);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:7px}
#epca_cadWorkspace input[type=file]{max-width:100%;font:12px var(--font-body)}
#epca_cadWorkspace .cad-status{font-size:12px;padding:9px;border-radius:8px;background:var(--surface-2);color:var(--ink);overflow-wrap:anywhere}
#epca_cadWorkspace .cad-status.warn{background:var(--warn-bg);color:var(--warn)}
#epca_cadWorkspace .cad-preview{min-height:150px;max-height:390px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);padding:8px}
#epca_cadWorkspace .cad-preview svg{display:block;width:100%;height:auto;min-width:280px}
#epca_cadWorkspace .cad-preview img{max-width:100%;max-height:340px;object-fit:contain}
#epca_cadWorkspace .cad-preview iframe{width:100%;height:350px;border:0;background:white}
#epca_cadWorkspace .cad-viewer{background:#eaf0ee;border:1px solid var(--line);border-radius:10px;overflow:hidden;min-height:260px}
#epca_cadWorkspace .cad-viewer svg{display:block;width:100%;height:auto;min-height:260px}
#epca_cadWorkspace .cad-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--muted)}
#epca_cadWorkspace .cad-legend span:before{content:"";display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:2px;background:#0a6b4f}
#epca_cadWorkspace .cad-legend span:nth-child(2):before{background:#f2a900}
#epca_cadWorkspace .cad-legend span:nth-child(3):before{background:#8b5e3c}
`;
document.head.appendChild(style);
var section=document.createElement('section');section.id='epca_cadWorkspace';
section.innerHTML=`
<div class="epca-head"><div><span class="epca-kicker">GENSOLAR DESIGN STUDIO</span><h2>CAD Import · 3D Model · Simulation</h2><p>Import an existing survey drawing or build a conceptual 3D rooftop model from measured site dimensions.</p></div><span class="epca-tag">SITE SURVEY + CAD</span></div>
<div class="cad-grid">
 <div class="cad-card"><h3>1. Import survey drawings and references</h3>
  <div class="cad-drop"><b>Choose a site file</b><input id="gsCadFile" type="file" accept=".dwg,.dxf,.skp,.pdf,.png,.jpg,.jpeg,.webp,.svg,application/pdf,image/*"><p class="cad-muted">Supported intake: DWG, DXF, SKP, PDF, PNG, JPG, WEBP and SVG. DXF is parsed in-browser for common 2D entities. PDF and images are reference underlays. DWG/SKP require conversion to DXF or GLB before geometry can be edited here.</p></div>
  <div class="cad-actions"><button type="button" class="btn alt sm" id="gsCadClear">Clear imported file</button><button type="button" class="btn alt sm" id="gsCadDownloadDxf">Download current layout DXF</button></div>
  <div class="cad-status" id="gsCadStatus" aria-live="polite">No file imported yet.</div>
  <div class="cad-preview" id="gsCadPreview"><div class="epca-empty">Imported drawing preview will appear here.</div></div>
 </div>
 <div class="cad-card"><h3>2. Site geometry and design notes</h3>
  <p class="cad-muted">Use verified survey dimensions. If a CAD file is imported, check its units and scale against a known dimension before relying on measurements.</p>
  <div class="epca-fields">
   <label>Roof levels<input id="gsCadLevels" type="number" min="1" max="20" value="1"></label>
   <label>Building height (m)<input id="gsCadHeight" type="number" min="0" step=".1" value="9"></label>
   <label>Parapet height (m)<input id="gsCadParapet" type="number" min="0" step=".1" value="0.9"></label>
   <label>Roof type<select id="gsCadRoof"><option>RCC flat roof</option><option>Metal sheet</option><option>Sloped roof</option><option>Mixed / multi-level</option></select></label>
   <label>Roof bearing / structure notes<input id="gsCadNotes" type="text" placeholder="Surveyor / structural engineer notes"></label>
   <label>Known obstruction height (m)<input id="gsCadObstacle" type="number" min="0" step=".1" value="1"></label>
  </div>
  <div class="cad-status warn">Structural safety is not inferred from the 3D model. Verify slab capacity, wind loads, anchors and foundations with a qualified structural engineer.</div>
 </div>
</div>
<div class="cad-card"><div class="epca-outputHead"><div><h3>3. Interactive conceptual 3D rooftop model</h3><p>Use the site length, width, panel dimensions and count in the Auto Design inputs above. Rotate the view and compare the roof and array concept.</p></div><div class="cad-actions"><button type="button" class="btn alt sm" id="gs3dLeft">Rotate left</button><button type="button" class="btn alt sm" id="gs3dRight">Rotate right</button><button type="button" class="btn alt sm" id="gs3dReset">Reset view</button><button type="button" class="btn sm" id="gs3dBuild">Build / refresh 3D model</button></div></div>
 <div class="cad-viewer" id="gs3dViewer"><div class="epca-empty">Build the 3D model after entering site dimensions and generating a panel layout.</div></div>
 <div class="cad-legend"><span>Solar modules</span><span>Roof / walkway</span><span>Building mass</span></div>
 <div class="epca-fields"><label>Sun time (concept preview)<input id="gsSunTime" type="range" min="7" max="17" step=".5" value="12"></label><label>Season<select id="gsSunSeason"><option value="equinox">Equinox</option><option value="summer">Summer solstice</option><option value="winter">Winter solstice</option></select></label></div>
 <p class="cad-muted" id="gsSunNote">Sun/shadow control is a conceptual visualization only. A validated site-specific shading study requires coordinates, date/time, true north, obstacle geometry and a solar-position model.</p>
</div>
<div class="cad-card"><h3>4. Drawing package and project records</h3><div class="cad-actions"><button type="button" class="btn alt sm" id="gsCadPrint">Print site survey sheet / save as PDF</button><button type="button" class="btn alt sm" id="gsCadJson">Export editable survey data (JSON)</button></div><p class="cad-muted">The drawing sheet includes the site inputs, import record, model view and engineering verification notes. It is a preliminary design record, not a stamped construction drawing.</p></div>
`;
root.appendChild(section);
var $=function(id){return document.getElementById(id)},currentFile=null,currentUrl=null,rotation=-28,modelSvg='';
function status(msg,warn){var el=$('gsCadStatus');if(el){el.textContent=msg;el.classList.toggle('warn',!!warn)}}
function safe(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function readFile(file){if(!file)return;currentFile={name:file.name,type:file.type,size:file.size};if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(file);var ext=(file.name.split('.').pop()||'').toLowerCase(),box=$('gsCadPreview');box.innerHTML='';
 if(ext==='dxf'){var reader=new FileReader();reader.onload=function(){try{var parsed=parseDxf(String(reader.result));box.innerHTML=parsed.svg;status('DXF imported: '+parsed.count+' supported entities parsed. Confirm drawing units and scale before use.',parsed.count===0); }catch(e){status('DXF could not be parsed: '+e.message,true)}};reader.readAsText(file);return}
 if(ext==='pdf'){var frame=document.createElement('iframe');frame.title='PDF site drawing preview';frame.src=currentUrl;box.appendChild(frame);status('PDF loaded as a reference underlay. It is not yet converted into editable CAD geometry.',true);return}
 if(['png','jpg','jpeg','webp','svg'].includes(ext)||file.type.startsWith('image/')){var img=document.createElement('img');img.alt='Imported site survey reference';img.src=currentUrl;box.appendChild(img);status('Image reference loaded. Trace or dimension the roof geometry before using it for panel fit.',true);return}
 if(ext==='dwg'||ext==='skp'){box.innerHTML='<div class="epca-empty"><b>'+safe(file.name)+'</b><br>File received. Geometry conversion is required before editing.<br><br>'+ (ext==='dwg'?'Convert DWG to DXF using AutoCAD / ODA File Converter, then import the DXF.':'Export the SketchUp model as DXF for plan geometry or GLB/GLTF for a 3D model; importable 3D mesh conversion is a separate step.')+'</div>';status(ext.toUpperCase()+' accepted as a project reference. Direct native geometry decoding is not enabled in this browser build; convert to DXF/GLB to continue.',true);return}
 status('Unsupported file extension. Choose DWG, DXF, SKP, PDF, PNG, JPG, WEBP or SVG.',true)
}
function parseDxf(src){
 var lines=src.replace(/\r/g,'').split('\n'),pairs=[];for(var i=0;i+1<lines.length;i+=2)pairs.push([lines[i].trim(),lines[i+1].trim()]);
 var ents=[],inside=false,kind='',obj=null;
 function flush(){if(obj){ents.push(obj);obj=null}}
 for(var p=0;p<pairs.length;p++){var code=pairs[p][0],v=pairs[p][1];if(code==='2'&&v==='ENTITIES'){inside=true;continue}if(inside&&code==='0'){flush();if(v==='ENDSEC'){inside=false;break}kind=v;obj={type:kind,pts:[]};continue}if(!inside||!obj)continue;
 if(kind==='LINE'){if(code==='10'||code==='11'||code==='20'||code==='21')obj[code]=Number(v)}
 else if(kind==='LWPOLYLINE'){if(code==='10')obj.pts.push([Number(v),0]);if(code==='20'&&obj.pts.length)obj.pts[obj.pts.length-1][1]=Number(v);if(code==='70')obj.closed=(Number(v)&1)===1}
 else if(kind==='CIRCLE'){if(code==='10'||code==='20'||code==='40')obj[code]=Number(v)}
 }
 flush();var shapes=ents.filter(function(e){return e.type==='LINE'&&[e['10'],e['11'],e['20'],e['21']].every(Number.isFinite)||e.type==='LWPOLYLINE'&&e.pts.length>1||e.type==='CIRCLE'&&Number.isFinite(e['10'])&&Number.isFinite(e['20'])&&e['40']>0});
 var coords=[];shapes.forEach(function(e){if(e.type==='LINE')coords.push([e['10'],e['20']],[e['11'],e['21']]);else if(e.type==='LWPOLYLINE')coords=coords.concat(e.pts);else coords.push([e['10']-e['40'],e['20']-e['40']],[e['10']+e['40'],e['20']+e['40']])});
 if(!coords.length)return {count:0,svg:'<div class="epca-empty">No supported LINE, LWPOLYLINE or CIRCLE entities found in the DXF ENTITIES section. Try exporting these entities from CAD.</div>'};
 var xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]),minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),w=Math.max(maxX-minX,1),h=Math.max(maxY-minY,1),scale=Math.min(900/w,560/h),pad=24;
 function X(x){return pad+(x-minX)*scale}function Y(y){return pad+(maxY-y)*scale}
 var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(w*scale+2*pad)+' '+(h*scale+2*pad)+'"><rect width="100%" height="100%" fill="#fff"/>';
 shapes.forEach(function(e){if(e.type==='LINE')svg+='<line x1="'+X(e['10'])+'" y1="'+Y(e['20'])+'" x2="'+X(e['11'])+'" y2="'+Y(e['21'])+'" stroke="#0a6b4f" stroke-width="1.5"/>';else if(e.type==='LWPOLYLINE'){var points=e.pts.map(c=>X(c[0])+','+Y(c[1])).join(' ');svg+='<polyline points="'+points+'" '+(e.closed?'fill="#d9eee4"':'fill="none')+' stroke="#0a6b4f" stroke-width="1.5"/>'}else svg+='<circle cx="'+X(e['10'])+'" cy="'+Y(e['20'])+'" r="'+(e['40']*scale)+'" fill="none" stroke="#d97706" stroke-width="1.5"/>'});
 svg+='<text x="'+pad+'" y="16" font-size="11" fill="#334155">DXF preview · '+shapes.length+' entities · drawing units unverified</text></svg>';return {count:shapes.length,svg:svg};
}
function model(){var L=parseFloat($('epca_length').value)||0,W=parseFloat($('epca_width').value)||0,H=parseFloat($('gsCadHeight').value)||9,n=0;var out=$('epca_results').innerText.match(/Panels\s*([0-9,]+)/i);if(out)n=parseInt(out[1].replace(/,/g,''),10)||0;
 if(!(L>0&&W>0)){status('Enter site length and width in the Auto Design inputs before building the 3D model.',true);return}
 var roofL=520,roofW=300,scale=Math.min(roofL/L,roofW/W),a=roofW/2,b=roofL/2,ang=rotation*Math.PI/180;
 function proj(x,y,z){var X=x*Math.cos(ang)-y*Math.sin(ang),Y=x*Math.sin(ang)+y*Math.cos(ang);return [400+X*scale*.78-Y*scale*.42,275+X*scale*.24+Y*scale*.24-z*scale*.7]}
 function poly(points,fill,stroke){return '<polygon points="'+points.map(p=>proj(p[0],p[1],p[2]).join(',')).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5"/>'}
 var p1=[-a,-b,0],p2=[a,-b,0],p3=[a,b,0],p4=[-a,b,0],wall=H;
 var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="roof" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#cbd5d1"/></linearGradient></defs><rect width="800" height="500" fill="#eaf0ee"/>';
 svg+=poly([p1,p2,p3,p4],'#d6dcd8','#334155');
 svg+=poly([[-a,-b,0],[a,-b,0],[a,-b,wall],[-a,-b,wall]],'#d4b99c','#725b49');
 svg+=poly([[a,-b,0],[a,b,0],[a,b,wall],[a,-b,wall]],'#b78f7a','#725b49');
 svg+=poly([[-a,-b,wall],[a,-b,wall],[a,b,wall],[-a,b,wall]],'url(#roof)','#475569');
 var count=Math.min(n||0,180),cols=Math.max(1,Math.ceil(Math.sqrt(count*W/L))),rows=Math.ceil(count/cols),mw=Math.min( W*.88/cols, 18),ml=Math.min(L*.78/rows,26),startX=-a+W*scale/2-cols*mw/2,startY=-b+L*scale/2-rows*ml/2;
 for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){var xx=startX+c*mw,yy=startY+r*ml;svg+=poly([[xx,yy,wall+1],[xx+mw*.94,yy,wall+1],[xx+mw*.94,yy+ml*.94,wall+1],[xx,yy+ml*.94,wall+1]],'#10265d','#7d91c5')}
 var hour=parseFloat($('gsSunTime').value)||12,season=$('gsSunSeason').value,shade=season==='winter'?1.35:season==='summer'?.72:1,shadow=(17-hour)*5*shade;
 svg+=poly([[a*.45,b*.15,wall],[a*.45+shadow,b*.15+shadow,wall],[a*.45+shadow,b*.15+shadow,wall+1],[a*.45,b*.15,wall+1]],'rgba(20,30,40,.12)','none');
 svg+='<text x="20" y="28" font-size="14" fill="#102a24" font-weight="700">GENSOLAR · CONCEPTUAL 3D ROOFTOP</text><text x="20" y="48" font-size="11" fill="#334155">Site '+L.toFixed(2)+' m × '+W.toFixed(2)+' m · Building height '+H.toFixed(1)+' m · Panel count '+n+'</text><text x="20" y="478" font-size="10" fill="#334155">Illustrative massing only · not a structural or certified shading simulation</text></svg>';
 modelSvg=svg;$('gs3dViewer').innerHTML=svg;$('gsSunNote').textContent='Concept sun position: '+hour.toFixed(1)+':00 · '+season+'. This is a visual preview, not a quantified shade-loss calculation.';
}
$('gsCadFile').addEventListener('change',function(e){if(e.target.files&&e.target.files[0])readFile(e.target.files[0])});
$('gsCadClear').onclick=function(){if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=null;currentFile=null;$('gsCadFile').value='';$('gsCadPreview').innerHTML='<div class="epca-empty">No imported file.</div>';status('Import cleared.')};
$('gsCadDownloadDxf').onclick=function(){var L=parseFloat($('epca_length').value)||0,W=parseFloat($('epca_width').value)||0;if(!L||!W){status('Enter roof dimensions first.',true);return}var d='0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nROOF_BOUNDARY\n90\n4\n70\n1\n10\n0\n20\n0\n10\n'+W+'\n20\n0\n10\n'+W+'\n20\n'+L+'\n10\n0\n20\n'+L+'\n0\nENDSEC\n0\nEOF\n';download(d,'GenSolar-roof-boundary.dxf','application/dxf')};
$('gs3dBuild').onclick=model;$('gs3dLeft').onclick=function(){rotation-=12;model()};$('gs3dRight').onclick=function(){rotation+=12;model()};$('gs3dReset').onclick=function(){rotation=-28;model()};$('gsSunTime').oninput=model;$('gsSunSeason').onchange=model;
$('gsCadPrint').onclick=function(){var w=window.open('','_blank');if(!w){status('Allow pop-ups to print the survey sheet.',true);return}w.document.write('<html><head><title>GenSolar Site Survey</title><style>body{font:14px Arial;padding:24px;color:#172b24}svg{max-width:100%;height:auto}h1{font-size:22px}p{line-height:1.5}.note{border:1px solid #aaa;padding:10px}</style></head><body><h1>GenSolar Pro · Site Survey & Design</h1><p>Project: '+safe($('epca_project').value||'Not specified')+'</p><p>Location: '+safe($('epca_lat').value||'')+', '+safe($('epca_lon').value||'')+'</p><p>Roof: '+safe($('epca_length').value)+' m × '+safe($('epca_width').value)+' m</p><p>Imported reference: '+safe(currentFile?currentFile.name:'None')+'</p>'+(modelSvg||'<p>3D model not generated.</p>')+'<p class="note">Preliminary concept only. Verify all measurements, structural design, electrical design, wind loads, setbacks and local approvals before construction.</p></body></html>');w.document.close();w.focus();w.print()};
$('gsCadJson').onclick=function(){var data={project:$('epca_project').value,coordinates:{latitude:$('epca_lat').value,longitude:$('epca_lon').value},roof:{length_m:$('epca_length').value,width_m:$('epca_width').value,levels:$('gsCadLevels').value,building_height_m:$('gsCadHeight').value,parapet_m:$('gsCadParapet').value,type:$('gsCadRoof').value},notes:$('gsCadNotes').value,obstacle_height_m:$('gsCadObstacle').value,imported_reference:currentFile,generated_at:new Date().toISOString(),model_svg:modelSvg};download(JSON.stringify(data,null,2),'GenSolar-site-survey.json','application/json')};
function download(data,name,type){var blob=new Blob([data],{type:type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u)},1500)}
})();
