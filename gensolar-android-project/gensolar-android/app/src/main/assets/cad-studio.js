/* GenSolar CAD Studio - UI for Auto Design: inputs -> full design -> drawings, 3D, video, DXF, BOM, report. */
(function () {
  'use strict';
  var root = document.getElementById('epcAutoDesign');
  var E = window.GSCadEngine, D = window.GSCadDraw;
  if (!root || !E || !D || document.getElementById('gscs')) return;
  var STORE = 'gs_cad_studio_v1';
  var cfg = null, model = null, tab = 'summary', media = [], videoBlob = null, videoName = '', dirty = true, planZoom = 1, view = { yaw: 150, pitch: 35, zoom: 1 };
  var opt = { structure: true, modules: true, labels: true, shadow: false, month: 11, hour: 9.5, dims: true, planStructure: true };
  var underlay = { id: '', w: 20, x: 0, y: 0, op: 0.5 };

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function q(sel, ctx) { return (ctx || scope).querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fx(v, d) { return Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: d == null ? 0 : d }); }
  function notify(msg) { var t = $('toast'); if (t) { t.textContent = msg; t.hidden = false; clearTimeout(t._gs); t._gs = setTimeout(function () { t.hidden = true; }, 3200); } else if (window.console) console.info(msg); }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), l = ks.pop(), t = ks.reduce(function (a, k) { return a[k]; }, o); t[l] = v; }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { } }
  var saveTimer = 0; function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
  function load() { try { var s = localStorage.getItem(STORE); if (s) return E.normalize(JSON.parse(s)); } catch (e) { } return null; }
  function legacyPrefill(c) {
    function v(id) { var e = $(id); return e ? e.value : ''; }
    if (v('epca_project')) c.project = v('epca_project');
    if (parseFloat(v('epca_lat'))) c.lat = parseFloat(v('epca_lat')); if (parseFloat(v('epca_lon'))) c.lon = parseFloat(v('epca_lon'));
    if (parseFloat(v('epca_wp'))) c.module.wp = parseFloat(v('epca_wp'));
    if (parseFloat(v('epca_module_w'))) c.module.w = parseFloat(v('epca_module_w')); if (parseFloat(v('epca_module_l'))) c.module.l = parseFloat(v('epca_module_l'));
    if (parseFloat(v('epca_capacity'))) c.auto.target = parseFloat(v('epca_capacity'));
    if (parseFloat(v('epca_tilt'))) c.auto.tilt = parseFloat(v('epca_tilt'));
    return c;
  }
  function saveBlob(name, blob) {
    var N = window.GenSolarNative;
    if (N && typeof N.saveFile === 'function') {
      var fr = new FileReader();
      fr.onload = function () { try { N.saveFile(name, blob.type || 'application/octet-stream', String(fr.result).split(',')[1] || ''); } catch (e) { notify('Could not save ' + name); } };
      fr.readAsDataURL(blob); return;
    }
    try { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); notify('Saved ' + name); } catch (e) { notify('File export is not available here.'); }
  }
  function saveText(name, mime, text) { saveBlob(name, new Blob([text], { type: mime })); }
  function slug() { return String(cfg.project || 'design').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'design'; }

  /* ---------- styles ---------- */
  var st = document.createElement('style');
  st.textContent = '#gscs{display:flex;flex-direction:column;gap:12px;min-width:0;color:var(--ink)}' +
    '#gscs .gs-hero{background:linear-gradient(120deg,#0a6b4f,#064532);color:#fff;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px}' +
    '#gscs .gs-hero h2{margin:0;color:#fff;font:800 21px var(--font-display)}#gscs .gs-hero p{margin:0;font-size:12px;color:#d8eee5;line-height:1.5}#gscs .gs-kick{font:700 10px var(--font-mono);letter-spacing:.12em;color:#ffd45c}' +
    '#gscs .gs-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}' +
    '#gscs details.gs-card>summary{cursor:pointer;font:700 14px var(--font-body);list-style:none;display:flex;justify-content:space-between;gap:8px}#gscs details.gs-card>summary::-webkit-details-marker{display:none}#gscs details.gs-card>summary:after{content:"+";font-weight:800;color:var(--deep)}#gscs details.gs-card[open]>summary:after{content:"\\2212"}' +
    '#gscs .gs-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}#gscs .gs-f label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--muted);min-width:0}' +
    '#gscs input,#gscs select{width:100%;min-width:0;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);font:13px var(--font-mono)}#gscs input[type=checkbox]{width:auto}#gscs input[type=range]{padding:0}' +
    '#gscs label.gs-row{flex-direction:row!important;align-items:center;gap:6px}#gscs .gs-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center}#gscs .gs-note{margin:0;padding:8px 9px;border-radius:8px;background:var(--surface-2);font-size:11px;line-height:1.5;color:var(--muted)}' +
    '#gscs .gs-warn{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:9px;font-size:11px;line-height:1.55}#gscs .gs-warn ul{margin:4px 0 0;padding-left:16px}' +
    '#gscs .gs-tabs{display:flex;gap:4px;overflow-x:auto;background:var(--surface-2);padding:4px;border-radius:10px;scrollbar-width:none}#gscs .gs-tabs button{flex:0 0 auto;border:0;border-radius:8px;background:transparent;color:var(--muted);padding:8px 11px;font:700 12px var(--font-body);white-space:nowrap}#gscs .gs-tabs button.on{background:var(--deep);color:var(--on-deep)}' +
    '#gscs .gs-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px}#gscs .gs-m{background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:9px;min-width:0}#gscs .gs-m span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}#gscs .gs-m b{display:block;margin-top:3px;font:800 17px var(--font-display);overflow-wrap:anywhere}#gscs .gs-m small{font-size:9px;color:var(--muted)}' +
    '#gscs .gs-tw{overflow:auto;max-width:100%}#gscs table{border-collapse:collapse;width:100%;font-size:11px}#gscs th,#gscs td{text-align:left;padding:6px;border-bottom:1px solid var(--line);vertical-align:top}#gscs th{font-size:9px;color:var(--muted);text-transform:uppercase}#gscs td input,#gscs td select{padding:5px;font-size:12px;min-width:56px}' +
    '#gscs .gs-sheet{overflow:auto;border:1px solid var(--line);border-radius:9px;background:#fff;max-height:78vh}#gscs .gs-sheet svg{display:block;height:auto}' +
    '#gscs canvas.gs-3d{width:100%;aspect-ratio:16/9;border-radius:10px;touch-action:none;background:#cfe3f4;display:block}' +
    '#gscs .gs-media{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}#gscs .gs-mi{border:1px solid var(--line);border-radius:9px;padding:6px;display:flex;flex-direction:column;gap:5px;font-size:10px;min-width:0}#gscs .gs-mi img,#gscs .gs-mi video{width:100%;height:100px;object-fit:cover;border-radius:6px;background:var(--surface-2)}' +
    '#gscs .gs-bar{height:9px;border-radius:5px;background:var(--surface-2);overflow:hidden}#gscs .gs-bar i{display:block;height:100%;background:var(--deep);width:0}' +
    '#gscs .gs-legacy>summary{cursor:pointer;font:700 13px var(--font-body);padding:10px;background:var(--surface-2);border-radius:10px}' +
    '#gscs_printRoot{display:none}@media print{body.gscs-printing>*:not(#gscs_printRoot){display:none!important}body.gscs-printing #gscs_printRoot{display:block!important;position:static;background:#fff;color:#111}#gscs_printRoot .gp{width:297mm;height:210mm;box-sizing:border-box;page-break-after:always;break-after:page;overflow:hidden;position:relative;background:#fff;font:10pt Arial,sans-serif}#gscs_printRoot .gp:last-child{page-break-after:auto;break-after:auto}}' +
    '#gscs_printRoot .gp svg{width:297mm;height:210mm;display:block}#gscs_printRoot .gpad{padding:12mm}#gscs_printRoot h1{font:800 24pt Arial;margin:0 0 3mm}#gscs_printRoot h2{font:800 14pt Arial;margin:0 0 3mm;border-bottom:.4mm solid #0a6b4f;padding-bottom:1.5mm}' +
    '#gscs_printRoot table{border-collapse:collapse;width:100%;font-size:8.5pt}#gscs_printRoot th,#gscs_printRoot td{border:.2mm solid #bbb;padding:1.2mm 2mm;text-align:left}#gscs_printRoot th{background:#e8f1ed}#gscs_printRoot .gm{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0}#gscs_printRoot .gm div{border:.3mm solid #cdd;border-radius:2mm;padding:2mm}#gscs_printRoot .gm span{display:block;font-size:7pt;text-transform:uppercase;color:#666}#gscs_printRoot .gm b{font-size:13pt}' +
    '#gscs_printRoot .g2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}#gscs_printRoot .g2 img{width:100%;border:.2mm solid #bbb}#gscs_printRoot figcaption{font-size:8pt;color:#444}#gscs_printRoot figure{margin:0}';
  document.head.appendChild(st);

  /* ---------- form spec ---------- */
  function F(p, label, type, o) { return { p: p, label: label, type: type || 'number', o: o || {} }; }
  var G = {
    project: [F('project', 'Project / customer', 'text'), F('client', 'Client', 'text'), F('address', 'Site address', 'text'), F('preparedBy', 'Prepared by', 'text'), F('drawingNo', 'Drawing no.', 'text'), F('revision', 'Revision', 'text'), F('lat', 'Latitude', 'number', { step: 'any' }), F('lon', 'Longitude', 'number', { step: 'any' })],
    climate: [F('climate.tMin', 'Min ambient (°C)'), F('climate.tMax', 'Max ambient (°C)'), F('climate.kt', 'Clearness index Kt', 'number', { step: '0.01' }), F('climate.pr', 'Performance ratio', 'number', { step: '0.01' }), F('climate.windVb', 'Basic wind speed Vb (m/s)'), F('climate.terrain', 'Terrain category', 'select', { opts: [1, 2, 3, 4] }), F('climate.cp', 'Net pressure coeff. Cp', 'number', { step: '0.05' }), F('climate.k2', 'k2 override (0 = auto)', 'number', { step: '0.01' })],
    module: [F('module.mfr', 'Module make / model', 'text'), F('module.wp', 'Rating (Wp)'), F('module.w', 'Width (m)', 'number', { step: '0.001' }), F('module.l', 'Length (m)', 'number', { step: '0.001' }), F('module.kg', 'Weight (kg)', 'number', { step: '0.1' }), F('module.voc', 'Voc (V)', 'number', { step: '0.01' }), F('module.vmp', 'Vmp (V)', 'number', { step: '0.01' }), F('module.isc', 'Isc (A)', 'number', { step: '0.01' }), F('module.tcVoc', 'Voc coeff (%/°C)', 'number', { step: '0.01' }), F('module.tcVmp', 'Vmp coeff (%/°C)', 'number', { step: '0.01' })],
    inverter: [F('inverter.mfr', 'Inverter make / model', 'text'), F('inverter.kw', 'AC rating (kW)'), F('inverter.mpptCount', 'MPPT inputs'), F('inverter.stringsPerMppt', 'Strings per MPPT'), F('inverter.mpptMin', 'MPPT min (V)'), F('inverter.mpptMax', 'MPPT max (V)'), F('inverter.maxDc', 'Max DC voltage (V)'), F('inverter.maxIscMppt', 'Max Isc per MPPT (A)'), F('inverter.maxDcAc', 'Max DC/AC ratio', 'number', { step: '0.05' }), F('inverter.qty', 'Quantity (0 = auto)')],
    site: [F('parapet', 'Parapet height (m)', 'number', { step: '0.05' }), F('setback', 'Edge setback (m)', 'number', { step: '0.05' }), F('walkway', 'Access walkway (m)', 'number', { step: '0.05' })],
    auto: [F('auto.target', 'Target DC capacity (kWp)', 'number', { step: '0.01' }), F('auto.rows', 'Module rows per table'), F('auto.orient', 'Orientation', 'select', { opts: ['portrait', 'landscape'] }), F('auto.tilt', 'Tilt (°)'), F('auto.lowH', 'Lower edge height (m)', 'number', { step: '0.05' }), F('auto.azimuth', 'Azimuth (°, 180 = south)'), F('auto.colSpacing', 'Column spacing (m)', 'number', { step: '0.1' })],
    structure: [F('structure.column', 'Column', 'select', { opts: E.options.column }), F('structure.rafter', 'Main rafter', 'select', { opts: E.options.rafter }), F('structure.purlin', 'Purlin', 'select', { opts: E.options.purlin }), F('structure.brace', 'Bracing', 'select', { opts: E.options.brace }), F('structure.colSpacing', 'Default column spacing (m)', 'number', { step: '0.1' }), F('structure.footW', 'Footing width (m)', 'number', { step: '0.05' }), F('structure.footD', 'Footing depth (m)', 'number', { step: '0.05' }), F('structure.footH', 'Footing height (m)', 'number', { step: '0.05' }), F('structure.bracing', 'Bracing', 'select', { opts: [['true', 'Yes (elevated)'], ['false', 'No']], bool: true })],
    cable: [F('cable.dcRun', 'DC run per string (m, one way)'), F('cable.acRun', 'AC run inverter to ACDB (m)'), F('cable.dcMat', 'DC conductor', 'select', { opts: ['Cu', 'Al'] }), F('cable.acMat', 'AC conductor', 'select', { opts: ['Al', 'Cu'] }), F('cable.dcDrop', 'Max DC drop (%)', 'number', { step: '0.1' }), F('cable.acDrop', 'Max AC drop (%)', 'number', { step: '0.1' })]
  };
  function fieldHtml(s) {
    var v = getPath(cfg, s.p), a = ' data-p="' + s.p + '"' + (s.o.bool ? ' data-bool="1"' : '');
    if (s.type === 'select') return '<label>' + s.label + '<select' + a + '>' + s.o.opts.map(function (o) { var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select></label>';
    return '<label>' + s.label + '<input' + a + ' type="' + s.type + '" ' + (s.type === 'number' ? 'step="' + (s.o.step || 'any') + '" inputmode="decimal" ' : '') + 'value="' + esc(v) + '"></label>';
  }
  function group(id, title, open, extra) { return '<details class="gs-card"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="gs-f">' + G[id].map(fieldHtml).join('') + '</div>' + (extra || '') + '</details>'; }
  function levelsHtml() {
    return '<div class="gs-tw"><table><thead><tr><th>Roof level</th><th>X (m)</th><th>Y (m)</th><th>Length X (m)</th><th>Width Y (m)</th><th>RL top (m)</th><th></th></tr></thead><tbody>' + cfg.levels.map(function (l, i) {
      return '<tr>' + ['name:text', 'x', 'y', 'l', 'w', 'z'].map(function (k) { var kk = k.split(':'); return '<td><input data-t="levels" data-i="' + i + '" data-k="' + kk[0] + '" type="' + (kk[1] || 'number') + '" step="any" value="' + esc(l[kk[0]]) + '"></td>'; }).join('') + '<td><button type="button" class="btn alt sm" data-del="levels" data-i="' + i + '" aria-label="Remove level">✕</button></td></tr>';
    }).join('') + '</tbody></table></div><div class="gs-row"><button type="button" class="btn alt sm" id="gs_addLevel">+ Add roof level</button></div><p class="gs-note">X/Y are the south-west corner of each roof level in one shared coordinate system (X east, Y north). RL top is the finished roof level above ground. Add stair-heads, water-tank rooms and upper terraces as separate levels.</p>';
  }
  function blocksHtml() {
    var lv = cfg.levels.map(function (l, i) { return '<option value="' + i + '">' + esc(l.name) + '</option>'; }).join('');
    return '<div class="gs-tw"><table><thead><tr><th>Array</th><th>Roof level</th><th>X</th><th>Y</th><th>Cols</th><th>Rows</th><th>Orient.</th><th>Tilt</th><th>Low edge (m)</th><th>Azim.</th><th>Col. spacing</th><th>Remove modules</th><th></th></tr></thead><tbody>' + cfg.blocks.map(function (b, i) {
      function inp(k, t) { return '<td><input data-t="blocks" data-i="' + i + '" data-k="' + k + '" type="' + (t || 'number') + '" step="any" value="' + esc(b[k]) + '"></td>'; }
      return '<tr>' + inp('name', 'text') + '<td><select data-t="blocks" data-i="' + i + '" data-k="level">' + lv.replace('value="' + b.level + '"', 'value="' + b.level + '" selected') + '</select></td>' + inp('x') + inp('y') + inp('cols') + inp('rows') +
        '<td><select data-t="blocks" data-i="' + i + '" data-k="orient"><option' + (b.orient === 'portrait' ? ' selected' : '') + '>portrait</option><option' + (b.orient === 'landscape' ? ' selected' : '') + '>landscape</option></select></td>' + inp('tilt') + inp('lowH') + inp('azimuth') + inp('colSpacing') + inp('trim') + '<td><button type="button" class="btn alt sm" data-del="blocks" data-i="' + i + '" aria-label="Remove array">✕</button></td></tr>';
    }).join('') + '</tbody></table></div><div class="gs-row"><button type="button" class="btn alt sm" id="gs_addBlock">+ Add array</button></div><p class="gs-note">X/Y locate each array’s lower corner on its roof level (same coordinates as the roof level). Cols x Rows are modules along the array and up the slope; "Remove modules" trims the last modules to match an exact count (for example 15 x 4 minus 2 = 58). Low edge is the height of the modules’ lower edge above the roof.</p>';
  }

  /* ---------- skeleton ---------- */
  var section = document.createElement('section'); section.id = 'gscs';
  var scope = section;
  function buildForm() {
    return '<div class="gs-card"><div class="gs-row"><button type="button" class="btn" id="gs_gen">Generate full design</button><button type="button" class="btn alt" id="gs_auto">Auto layout from target kWp</button><button type="button" class="btn alt sm" id="gs_sample">Load sample (rooftop with 58 + 9 module arrays)</button></div>' +
      '<div class="gs-row"><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_autoInv" checked> Auto-select inverter when using auto layout</label></div>' +
      '<div class="gs-row"><button type="button" class="btn alt sm" id="gs_saveJson">Save design file (JSON)</button><label class="btn alt sm" style="cursor:pointer">Open design file<input id="gs_openJson" type="file" accept=".json,application/json" hidden></label><button type="button" class="btn alt sm" id="gs_new">New design</button></div>' +
      '<p class="gs-note">Enter the roof levels and either add your arrays by hand or press <b>Auto layout</b>. The design engine then produces the plan, elevations, structure, 3D model with shadows, single-line diagram, bill of materials, string and cable sizing, wind check, yield estimate, DXF files for AutoCAD, images and a walkthrough video.</p></div>' +
      group('project', '1. Project and location', true) +
      '<details class="gs-card" open><summary>2. Building roofs and obstructions</summary><div class="gs-f">' + G.site.map(fieldHtml).join('') + '</div><div id="gs_levels">' + levelsHtml() + '</div></details>' +
      group('module', '3. Solar module', false) + group('inverter', '4. Inverter', false) +
      '<details class="gs-card" open><summary>5. Arrays (auto layout settings and array table)</summary><div class="gs-f">' + G.auto.map(fieldHtml).join('') + '</div><div id="gs_blocks">' + blocksHtml() + '</div></details>' +
      group('structure', '6. Structure and footings', false) + group('cable', '7. Cables', false) + group('climate', '8. Climate, wind and yield', false);
  }
  function skeleton() {
    section.innerHTML = '<div class="gs-hero"><span class="gs-kick">GENSOLAR EPC ENGINEERING</span><h2>Auto Design · Full CAD Studio</h2><p>Give the site details once. Get the layout, structure, electrical design, drawings, 3D model, shadow study, DXF files, report, images and video from one place.</p></div>' +
      '<div id="gs_form" style="display:flex;flex-direction:column;gap:10px">' + buildForm() + '</div>' +
      '<div class="gs-card" id="gs_results" hidden><div class="gs-tabs" id="gs_tabs">' + [['summary', 'Summary'], ['plan', 'Plan'], ['elev', 'Elevations'], ['v3d', '3D model'], ['sld', 'SLD'], ['bom', 'Structure and BOM'], ['calc', 'Calculations'], ['media', 'Site media'], ['export', 'Export']].map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="gs_view"></div></div>';
  }

  /* ---------- binding ---------- */
  function coerce(el) { var v = el.value; if (el.dataset.bool) return v === 'true'; if (el.type === 'number') { var n = parseFloat(v); return isFinite(n) ? n : 0; } return v; }
  function onInput(e) {
    var el = e.target;
    if (el.dataset && el.dataset.p) { setPath(cfg, el.dataset.p, coerce(el)); dirty = true; saveSoon(); return; }
    if (el.dataset && el.dataset.t) { var arr = cfg[el.dataset.t], row = arr[+el.dataset.i], k = el.dataset.k; row[k] = (el.type === 'number') ? (parseFloat(el.value) || 0) : (k === 'level' ? parseInt(el.value, 10) : el.value); dirty = true; saveSoon(); if (el.dataset.t === 'levels' && k === 'name') { /* keep level names in blocks table */ } }
  }
  function refreshTables(keepFocus) { $('gs_levels').innerHTML = levelsHtml(); $('gs_blocks').innerHTML = blocksHtml(); }
  function bindForm() {
    var form = $('gs_form');
    form.addEventListener('input', onInput); form.addEventListener('change', function (e) { onInput(e); if (e.target.dataset && e.target.dataset.t === 'levels' && e.target.dataset.k === 'name') $('gs_blocks').innerHTML = blocksHtml(); });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (b) { var arr = cfg[b.dataset.del]; if (b.dataset.del === 'levels' && arr.length <= 1) { notify('At least one roof level is required.'); return; } arr.splice(+b.dataset.i, 1); if (b.dataset.del === 'levels') cfg.blocks.forEach(function (bl) { if (bl.level >= cfg.levels.length) bl.level = cfg.levels.length - 1; }); refreshTables(); dirty = true; save(); return; }
      var id = e.target.id;
      if (id === 'gs_addLevel') { var last = cfg.levels[cfg.levels.length - 1]; cfg.levels.push({ name: 'Level ' + (cfg.levels.length + 1), x: last.x, y: last.y, l: Math.max(2, last.l / 2), w: Math.max(2, last.w / 2), z: last.z + 3 }); refreshTables(); dirty = true; save(); }
      else if (id === 'gs_addBlock') { var a = cfg.auto; cfg.blocks.push({ name: 'Array ' + (cfg.blocks.length + 1), level: 0, x: cfg.levels[0].x + cfg.setback, y: cfg.levels[0].y + cfg.setback, cols: 8, rows: a.rows, orient: a.orient, tilt: a.tilt, lowH: a.lowH, azimuth: a.azimuth, colSpacing: a.colSpacing, trim: 0 }); refreshTables(); dirty = true; save(); }
      else if (id === 'gs_gen') generate(true);
      else if (id === 'gs_auto') autoLayout();
      else if (id === 'gs_sample') loadSample();
      else if (id === 'gs_new') { if (confirm('Start a new design? The current design will be cleared (save it first if needed).')) { cfg = legacyPrefill(E.normalize({})); cfg.levels = [{ name: 'Main roof', x: 0, y: 0, l: 20, w: 14, z: 12 }]; save(); rebuildForm(); $('gs_results').hidden = true; model = null; } }
      else if (id === 'gs_saveJson') saveText(slug() + '-design.json', 'application/json', JSON.stringify(cfg, null, 2));
    });
    $('gs_openJson').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { cfg = E.normalize(JSON.parse(r.result)); save(); rebuildForm(); notify('Design loaded: ' + cfg.project); } catch (x) { notify('That file is not a valid design file.'); } };
      r.readAsText(f); e.target.value = '';
    });
  }
  function rebuildForm() { $('gs_form').innerHTML = buildForm(); bindForm(); dirty = true; }

  function loadSample() {
    cfg = E.normalize({
      project: 'Sample rooftop - 58 + 9 module arrays', client: 'Sample customer', address: 'Hyderabad', lat: 17.385, lon: 78.4867, preparedBy: cfg.preparedBy,
      levels: [{ name: 'Main roof', x: 0, y: 0, l: 20, w: 26, z: 12 }, { name: 'Stair-head roof', x: 13, y: 1, l: 6, w: 8, z: 15 }],
      blocks: [
        { name: 'Array A (58)', level: 0, x: 0.8, y: 15.6, cols: 15, rows: 4, trim: 2, orient: 'portrait', tilt: 10, lowH: 2.4, azimuth: 180, colSpacing: 2.6 },
        { name: 'Array B (30)', level: 0, x: 0.8, y: 10.2, cols: 15, rows: 2, trim: 0, orient: 'portrait', tilt: 10, lowH: 2.4, azimuth: 180, colSpacing: 2.6 },
        { name: 'Array C (9)', level: 1, x: 13.8, y: 1.8, cols: 3, rows: 3, trim: 0, orient: 'portrait', tilt: 10, lowH: 1.0, azimuth: 180, colSpacing: 2.2 }
      ],
      inverter: { kw: 50, mpptCount: 6, stringsPerMppt: 2 }
    });
    save(); rebuildForm(); generate(true); notify('Sample loaded. Replace the dimensions with your surveyed values.');
  }
  function autoLayout() {
    if (cfg.blocks.length && !confirm('Replace the current array table with an automatic layout?')) return;
    var r = E.autoLayout(cfg); cfg.blocks = r.blocks;
    if ($('gs_autoInv').checked) { var kw = cfg.auto.target, s = E.suggestInverter(kw); cfg.inverter.kw = s.kw; cfg.inverter.mpptCount = s.mppt; cfg.inverter.qty = s.qty > 1 ? s.qty : 0; }
    save(); rebuildForm();
    var placed = r.blocks.reduce(function (n, b) { return n + b.cols * b.rows - b.trim; }, 0);
    notify(r.blocks.length ? 'Placed ' + placed + ' modules in ' + r.blocks.length + ' arrays' + (r.unplaced ? ' (' + r.unplaced + ' modules did not fit)' : '') + '.' : 'No array fits the entered roof sizes. Check roof dimensions, setback and tilt.');
    if (r.blocks.length) generate(true);
  }

  /* ---------- generate and render ---------- */
  function generate(show) {
    try { model = E.build(cfg); } catch (e) { notify('Design failed: ' + e.message); if (window.console) console.error(e); return; }
    dirty = false; save(); $('gs_results').hidden = false; renderTab(tab);
    if (show) $('gs_results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function ensureModel() { if (!model || dirty) { try { model = E.build(cfg); dirty = false; } catch (e) { notify('Design failed: ' + e.message); } } return model; }
  function metric(n, v, d) { return '<div class="gs-m"><span>' + esc(n) + '</span><b>' + esc(v) + '</b><small>' + esc(d || '') + '</small></div>'; }
  function sheetHtml(svg, zoom) { return '<div class="gs-sheet"><div style="width:' + Math.round(zoom * 100) + '%;min-width:100%">' + svg.replace(/ width="[^"]*mm" height="[^"]*mm"/, ' style="width:100%;height:auto"') + '</div></div>'; }
  function zoomBar(id) { return '<div class="gs-row"><button type="button" class="btn alt sm" data-zoom="-1">Zoom −</button><button type="button" class="btn alt sm" data-zoom="1">Zoom +</button><button type="button" class="btn alt sm" data-zoom="0">Fit</button><button type="button" class="btn alt sm" data-dl="' + id + 'svg">Save SVG</button><button type="button" class="btn alt sm" data-dl="' + id + 'png">Save image (PNG)</button><button type="button" class="btn sm" data-dl="' + id + 'dxf">Save DXF (AutoCAD)</button></div>'; }

  function renderTab(name) {
    tab = name; var m = ensureModel(); if (!m) return;
    root.querySelectorAll('#gs_tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    stop3d(); var v = $('gs_view'); var h = '';
    if (name === 'summary') h = tabSummary(m);
    else if (name === 'plan') h = tabPlan(m);
    else if (name === 'elev') h = '<p class="gs-note">Front elevation (from south) and side elevation (from east) with roof levels, array heights, columns, bracing and footings.</p>' + zoomBar('elev') + sheetHtml(D.elevationSheet(m, { total: 3 }).toSvg(), planZoom);
    else if (name === 'v3d') h = tab3d();
    else if (name === 'sld') h = '<p class="gs-note">Single-line diagram generated from the string, MPPT, inverter and protection calculations. It is a design draft and must be reviewed against the DISCOM and protection requirements.</p>' + zoomBar('sld') + sheetHtml(D.sldSheet(m, { total: 3 }).toSvg(), planZoom);
    else if (name === 'bom') h = tabBom(m);
    else if (name === 'calc') h = tabCalc(m);
    else if (name === 'media') h = tabMedia();
    else if (name === 'export') h = tabExport(m);
    v.innerHTML = h;
    if (name === 'v3d') start3d();
    if (name === 'media') bindMedia();
  }

  function yieldChart(y) {
    var max = Math.max.apply(null, y.months.map(function (m) { return m.kwh; })) || 1, w = 560, hh = 170, bw = 34, s = '<svg viewBox="0 0 ' + w + ' ' + (hh + 48) + '" style="width:100%;height:auto;font-family:Arial" role="img" aria-label="Monthly generation estimate">';
    y.months.forEach(function (m, i) { var bh = m.kwh / max * hh, x = 12 + i * 45; s += '<rect x="' + x + '" y="' + (hh - bh + 22) + '" width="' + bw + '" height="' + bh + '" rx="3" fill="#0a6b4f"/><text x="' + (x + bw / 2) + '" y="' + (hh + 38) + '" font-size="11" text-anchor="middle" fill="#586979">' + m.m + '</text><text x="' + (x + bw / 2) + '" y="' + (hh - bh + 18) + '" font-size="9" text-anchor="middle" fill="#12202C">' + (m.kwh / 1000).toFixed(1) + '</text>'; });
    return s + '</svg>';
  }
  function tabSummary(m) {
    var t = m.totals, e = m.elec, y = m.yield;
    var h = '<div class="gs-metrics">' + metric('DC capacity', fx(t.kwp, 2) + ' kWp', t.modules + ' x ' + m.cfg.module.wp + ' Wp') + metric('Inverters', e.nInv + ' x ' + m.cfg.inverter.kw + ' kW', 'DC/AC ' + fx(e.ratio, 2)) + metric('Strings', e.strings.length, 'Max ' + e.maxStr + ' modules / string') + metric('Annual energy', fx(y.annual, 0) + ' kWh', fx(y.specific, 0) + ' kWh/kWp/yr') +
      metric('Module area', fx(t.area, 1) + ' m²', m.geoms.length + ' arrays') + metric('Structure steel', fx(t.steelKg, 0) + ' kg', t.footings + ' footings') + metric('Design wind pressure', fx(m.wind.p, 0) + ' N/m²', 'Vz ' + fx(m.wind.Vz, 1) + ' m/s') + metric('Shading loss', fx(m.shadeLoss * 100, 1) + '%', '9:00-15:00 screening') + '</div>';
    h += m.warnings.length ? '<div class="gs-warn"><b>Review these points</b><ul>' + m.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '<div class="gs-note">No design warnings from the automatic checks. Engineering review is still required before construction.</div>';
    h += '<div class="gs-card"><b style="font-size:13px">Estimated monthly generation (MWh)</b>' + yieldChart(y) + '<p class="gs-note">Method: extraterrestrial radiation x clearness index Kt (' + m.cfg.climate.kt + '), Page diffuse fraction, Liu-Jordan tilted-surface transposition, performance ratio ' + m.cfg.climate.pr + ' and the shading screen above. This is a planning estimate, not a bankable yield study.</p></div>';
    h += '<div class="gs-row"><button type="button" class="btn" data-go="export">Export drawings, DXF and report</button><button type="button" class="btn alt" data-go="v3d">Open 3D model</button></div>';
    return h;
  }
  function tabPlan(m) {
    var months = E.MNAMES.map(function (n, i) { return '<option value="' + i + '"' + (opt.month === i ? ' selected' : '') + '>' + n + '</option>'; }).join('');
    var imgs = media.filter(function (x) { return x.kind === 'image'; });
    var ctl = '<div class="gs-row"><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_pStruct"' + (opt.planStructure ? ' checked' : '') + '> Rafters and footings</label><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_pDims"' + (opt.dims ? ' checked' : '') + '> Dimensions</label><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_pShadow"' + (opt.shadow ? ' checked' : '') + '> Shadows</label></div>' +
      '<div class="gs-f"><label>Shadow month<select id="gs_pMonth">' + months + '</select></label><label>Solar time ' + opt.hour.toFixed(1) + ' h<input id="gs_pHour" type="range" min="7" max="17" step="0.5" value="' + opt.hour + '"></label>' +
      '<label>Underlay photo / drawing<select id="gs_uSel"><option value="">None</option>' + imgs.map(function (x) { return '<option value="' + x.id + '"' + (underlay.id === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Underlay real width (m)<input id="gs_uW" type="number" step="any" value="' + underlay.w + '"></label><label>Underlay X (m)<input id="gs_uX" type="number" step="any" value="' + underlay.x + '"></label><label>Underlay Y (m)<input id="gs_uY" type="number" step="any" value="' + underlay.y + '"></label></div>';
    return '<p class="gs-note">Dimensioned roof plan to scale with array positions, footings, rafters, shadows and a title block. Add a top-view photo or survey drawing in <b>Site media</b> and trace it here as an underlay.</p>' + ctl + zoomBar('plan') + '<div id="gs_planBox">' + sheetHtml(planSvg(m), planZoom) + '</div>';
  }
  function planOpts(m) {
    var o = { structure: opt.planStructure, dims: opt.dims, total: 3 };
    if (opt.shadow) o.shadow = { day: 15 + 30 * opt.month + (opt.month > 0 ? 0 : 0), hour: opt.hour };
    if (opt.shadow) o.shadow.day = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344][opt.month];
    var u = media.filter(function (x) { return x.id === underlay.id; })[0];
    if (u && u.dataUrl) o.underlay = { x: underlay.x, y: underlay.y, w: underlay.w, h: underlay.w * u.h / u.w, href: u.dataUrl, op: underlay.op };
    return o;
  }
  function planSvg(m) { return D.planSheet(m, planOpts(m)).toSvg(); }

  /* 3D tab */
  var cv = null, raf = 0, scene3 = null, needDraw = true, anim = null;
  function tab3d() {
    var months = E.MNAMES.map(function (n, i) { return '<option value="' + i + '"' + (opt.month === i ? ' selected' : '') + '>' + n + '</option>'; }).join('');
    return '<canvas class="gs-3d" id="gs_cv" width="960" height="540" aria-label="Interactive 3D model"></canvas>' +
      '<div class="gs-row">' + [['Iso', 150, 35], ['South', 180, 28], ['East', 90, 28], ['North', 0, 28], ['West', 270, 28], ['Top', 180, 89]].map(function (v) { return '<button type="button" class="btn alt sm" data-view="' + v[1] + ',' + v[2] + '">' + v[0] + '</button>'; }).join('') + '<button type="button" class="btn alt sm" id="gs_spin">Auto-rotate</button></div>' +
      '<div class="gs-row"><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_tMod"' + (opt.modules ? ' checked' : '') + '> Modules</label><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_tStr"' + (opt.structure ? ' checked' : '') + '> Structure</label><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_tLab"' + (opt.labels ? ' checked' : '') + '> Counts</label><label class="gs-row" style="font-size:12px"><input type="checkbox" id="gs_tSh"' + (opt.shadow ? ' checked' : '') + '> Sun shadows</label></div>' +
      '<div class="gs-f"><label>Month<select id="gs_tMonth">' + months + '</select></label><label>Solar time <span id="gs_hLab">' + opt.hour.toFixed(1) + '</span> h<input id="gs_tHour" type="range" min="7" max="17" step="0.25" value="' + opt.hour + '"></label></div>' +
      '<div class="gs-row"><button type="button" class="btn" id="gs_vid">Record walkthrough video</button><button type="button" class="btn alt" id="gs_png3d">Save this view (PNG)</button><button type="button" class="btn alt sm" data-dl="dxf3d">Save 3D DXF</button></div>' +
      '<div id="gs_vidBox"></div><p class="gs-note">Drag to rotate, pinch or scroll to zoom. The walkthrough video orbits the building with panels, then shows the bare structure, then sweeps the sun from 07:00 to 17:00 with shadows. Recording runs in real time (about 14 seconds).</p>';
  }
  function curScene() {
    var m = model; var sc = D.buildScene(m, { modules: opt.modules, structure: opt.structure, labels: opt.labels });
    if (opt.shadow) addShadow(sc, m, opt.month, opt.hour);
    return sc;
  }
  function addShadow(sc, m, month, hour) {
    var day = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344][month];
    E.shadowPolys(m.cfg, m.geoms, day, hour).forEach(function (s) { sc.prims.push({ k: 'poly', grp: 2, pts: s.pts, fill: 'rgba(15,23,42,0.30)', stroke: null }); });
    return sc;
  }
  function start3d() {
    cv = $('gs_cv'); if (!cv) return; scene3 = curScene(); needDraw = true;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(480, Math.round(rect.width * dpr)); cv.height = Math.round(cv.width * 9 / 16);
    var ptrs = {}, lastD = 0;
    cv.onpointerdown = function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; };
    cv.onpointerup = cv.onpointercancel = function (e) { delete ptrs[e.pointerId]; lastD = 0; };
    cv.onpointermove = function (e) {
      var p = ptrs[e.pointerId]; if (!p) return; var ids = Object.keys(ptrs);
      if (ids.length === 1) { view.yaw -= (e.clientX - p[0]) * 0.4; view.pitch = Math.max(4, Math.min(89, view.pitch + (e.clientY - p[1]) * 0.3)); }
      else if (ids.length === 2) { var o = ptrs[ids[0] == e.pointerId ? ids[1] : ids[0]], d = Math.hypot(e.clientX - o[0], e.clientY - o[1]); if (lastD) view.zoom = Math.max(0.3, Math.min(3, view.zoom * (lastD / d))); lastD = d; }
      ptrs[e.pointerId] = [e.clientX, e.clientY]; needDraw = true;
    };
    cv.onwheel = function (e) { e.preventDefault(); view.zoom = Math.max(0.3, Math.min(3, view.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); needDraw = true; };
    var loop = function () {
      if (anim) { view.yaw += 0.35; needDraw = true; }
      if (needDraw && cv && cv.isConnected) { needDraw = false; draw3d(cv.getContext('2d'), cv.width, cv.height, scene3, view); }
      raf = requestAnimationFrame(loop);
    }; loop();
    var v = $('gs_view');
    v.onclick = function (e) { var b = e.target.closest('[data-view]'); if (b) { var a = b.dataset.view.split(','); view.yaw = +a[0]; view.pitch = +a[1]; view.zoom = 1; needDraw = true; } };
    $('gs_spin').onclick = function () { anim = !anim; this.textContent = anim ? 'Stop rotating' : 'Auto-rotate'; };
    function rescene() { scene3 = curScene(); needDraw = true; }
    $('gs_tMod').onchange = function () { opt.modules = this.checked; rescene(); }; $('gs_tStr').onchange = function () { opt.structure = this.checked; rescene(); };
    $('gs_tLab').onchange = function () { opt.labels = this.checked; rescene(); }; $('gs_tSh').onchange = function () { opt.shadow = this.checked; rescene(); };
    $('gs_tMonth').onchange = function () { opt.month = +this.value; rescene(); };
    $('gs_tHour').oninput = function () { opt.hour = +this.value; $('gs_hLab').textContent = opt.hour.toFixed(1); rescene(); };
    $('gs_vid').onclick = recordVideo; $('gs_png3d').onclick = function () { png3d(cv.width >= 1280 ? null : null, function (b) { saveBlob(slug() + '-3d-view.png', b); }); };
  }
  function stop3d() { if (raf) cancelAnimationFrame(raf); raf = 0; anim = null; }
  function draw3d(ctx, W, H, scene, vw, overlay) {
    var cam = D.frameCam(scene, vw.yaw, vw.pitch, 35, W / H); cam.dist *= vw.zoom;
    D.renderCanvas(ctx, scene, cam, W, H);
    ctx.fillStyle = 'rgba(8,40,30,.72)'; ctx.fillRect(0, H - H * 0.075, W, H * 0.075);
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(H * 0.034) + 'px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var t = model.totals; ctx.fillText(cfg.project + '  |  ' + t.modules + ' modules  |  ' + fx(t.kwp, 2) + ' kWp', W * 0.02, H - H * 0.037);
    if (overlay) { ctx.textAlign = 'right'; ctx.fillText(overlay, W * 0.98, H - H * 0.037); }
    ctx.textAlign = 'left'; ctx.font = '600 ' + Math.round(H * 0.026) + 'px Arial'; ctx.fillStyle = 'rgba(8,40,30,.8)'; ctx.fillText('GenSolar Pro', W * 0.02, H * 0.04);
  }
  function png3d(opts2, cb, o) {
    o = o || {}; var c = document.createElement('canvas'); c.width = o.w || 1600; c.height = Math.round(c.width * 9 / 16);
    var sc = o.scene || curScene(), vw = o.view || view; draw3d(c.getContext('2d'), c.width, c.height, sc, vw, o.overlay);
    if (c.toBlob) c.toBlob(function (b) { cb(b); }, 'image/png'); else cb(null);
  }
  function pngPromise(o) { return new Promise(function (res) { png3d(null, res, o); }); }

  /* video */
  function recordVideo() {
    if (!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream)) { notify('Video recording is not supported by this browser. Update the app / browser and try again.'); return; }
    var mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'], mime = '';
    for (var i = 0; i < mimes.length; i++) if (MediaRecorder.isTypeSupported(mimes[i])) { mime = mimes[i]; break; }
    var W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H; var ctx = c.getContext('2d');
    var base = D.buildScene(model, { modules: true, structure: true, labels: true }), bare = D.buildScene(model, { modules: false, structure: true, labels: false });
    var secs = (window.GSCS && window.GSCS.videoSeconds) || [6, 3, 5], T = secs[0] + secs[1] + secs[2];
    var stream = c.captureStream(30), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4000000 } : {}), chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var box = $('gs_vidBox'); box.innerHTML = '<div class="gs-bar"><i id="gs_vp"></i></div><p class="gs-note" id="gs_vt">Recording walkthrough… keep this screen open.</p>';
    $('gs_vid').disabled = true;
    rec.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      videoBlob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] }); videoName = slug() + '-walkthrough.' + (videoBlob.type === 'video/mp4' ? 'mp4' : 'webm');
      $('gs_vid').disabled = false;
      var u = URL.createObjectURL(videoBlob);
      box.innerHTML = '<video controls playsinline src="' + u + '" style="width:100%;border-radius:10px"></video><div class="gs-row"><button type="button" class="btn" id="gs_vsave">Save video</button><span class="gs-note" style="flex:1">' + fx(videoBlob.size / 1048576, 1) + ' MB, ' + T + ' s. It will also be added to the design package.</span></div>';
      $('gs_vsave').onclick = function () { saveBlob(videoName, videoBlob); };
    };
    var t0 = performance.now(), month = 11, day = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
    rec.start(250);
    var timer = setInterval(function () {
      var t = (performance.now() - t0) / 1000, ph, sc, vw, cap;
      if (t < secs[0]) { sc = base; vw = { yaw: 150 + t / secs[0] * 360, pitch: 32, zoom: 1 }; cap = 'Array layout and modules'; }
      else if (t < secs[0] + secs[1]) { var u = (t - secs[0]) / secs[1]; sc = bare; vw = { yaw: 150 + u * 150, pitch: 36 - u * 6, zoom: 0.92 }; cap = 'Mounting structure, columns and footings'; }
      else if (t < T) { var u2 = (t - secs[0] - secs[1]) / secs[2], hr = 7 + u2 * 10; sc = { prims: base.prims.slice(), center: base.center, radius: base.radius, bounds: base.bounds }; addShadow(sc, model, 11, hr); vw = { yaw: 175, pitch: 45, zoom: 0.9 }; cap = 'Winter sun and shadows ' + (Math.floor(hr) < 10 ? '0' : '') + Math.floor(hr) + ':' + (hr % 1 < 0.5 ? '00' : '30'); }
      else { clearInterval(timer); rec.stop(); return; }
      draw3d(ctx, W, H, sc, vw, cap);
      var p = $('gs_vp'); if (p) p.style.width = Math.min(100, t / T * 100) + '%';
    }, 33);
  }

  /* BOM tab */
  function tabBom(m) {
    var cats = {}, rows = '';
    m.bom.items.forEach(function (it) { rows += '<tr><td>' + esc(it.cat) + '</td><td>' + esc(it.item) + '</td><td style="text-align:right">' + esc(fx(it.qty, 1)) + '</td><td>' + esc(it.unit) + '</td><td>' + esc(it.note) + '</td></tr>'; });
    var arr = '<table><thead><tr><th>Array</th><th>Modules</th><th>Size W x slope (m)</th><th>Low / high RL (m)</th><th>Columns</th><th>Members</th><th>Footings</th></tr></thead><tbody>' + m.geoms.map(function (g) { return '<tr><td>' + esc(g.block.name) + '</td><td>' + g.count + '</td><td>' + fx(g.W, 2) + ' x ' + fx(g.S, 2) + '</td><td>' + fx(g.zLow, 2) + ' / ' + fx(g.zHigh, 2) + '</td><td>' + g.columns.length + ' on ' + g.lineV.length + ' lines</td><td>' + g.members.length + (g.braced ? ' (braced)' : ' (no bracing)') + '</td><td>' + g.foots.length + '</td></tr>'; }).join('') + '</tbody></table>';
    return '<div class="gs-row"><button type="button" class="btn" data-dl="bom">Download BOM (CSV)</button></div><div class="gs-tw">' + arr + '</div><div class="gs-tw"><table><thead><tr><th>Category</th><th>Item</th><th>Qty</th><th>Unit</th><th>Notes</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="gs-note">Quantities are calculated from the generated 3D geometry (member lengths, footings, clamps) plus allowances. Add wastage, supplier lengths and rates before ordering.</p>';
  }
  /* Calculations tab */
  function tabCalc(m) {
    var e = m.elec, c = m.cfg, w = m.wind;
    function tbl(head, rows) { return '<div class="gs-tw"><table><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
    var h = '<h3 style="margin:0;font-size:14px">String and inverter design</h3>' + tbl(['Check', 'Value', 'Limit / note'], [
      ['Cold Voc per module (' + c.climate.tMin + ' °C)', fx(e.vocCold, 2) + ' V', 'Voc x (1 + coeff x (Tmin − 25))'], ['Hot Vmp per module (cell ' + (c.climate.tMax + 30) + ' °C)', fx(e.vmpHot, 2) + ' V', 'Cell temperature = ambient + 30 °C'],
      ['Max modules per string', e.nmax, 'Inverter max DC ' + c.inverter.maxDc + ' V'], ['Min modules per string', e.nmin, 'MPPT minimum ' + c.inverter.mpptMin + ' V'],
      ['Longest string cold Voc', fx(e.maxStrVocCold, 0) + ' V', e.maxStrVocCold <= c.inverter.maxDc ? 'OK' : 'EXCEEDS LIMIT'], ['Shortest string hot Vmp', fx(e.minStrVmpHot, 0) + ' V', e.minStrVmpHot >= c.inverter.mpptMin ? 'OK' : 'BELOW MPPT MINIMUM'],
      ['DC / AC ratio', fx(e.ratio, 2), 'Limit ' + c.inverter.maxDcAc], ['String fuse', e.fuse + ' A', '1.56 x Isc rounded up'], ['DC isolator voltage', e.dcIsoV + ' V', '1.1 x cold string Voc'],
      ['DC cable', e.dcCable ? e.dcCable.size + ' sq.mm ' + c.cable.dcMat : '-', e.dcCable ? 'Drop ' + fx(e.dcCable.dropPct, 2) + '% over ' + c.cable.dcRun + ' m, capacity ' + fx(e.dcCable.capacity, 0) + ' A' : ''],
      ['AC cable per inverter', e.acCable ? e.acCable.size + ' sq.mm 4C ' + c.cable.acMat : '-', e.acCable ? 'Drop ' + fx(e.acCable.dropPct, 2) + '%, ' + fx(e.invAmps, 0) + ' A rated' : ''], ['AC breaker per inverter', e.acBreaker + ' A', '1.25 x rated current'], ['Main ACDB breaker', e.mainBreaker + ' A', fx(e.totalAcAmps, 0) + ' A total at 415 V'], ['Earth pits / LA rods', e.earthPits + ' / ' + e.laRods, 'Indicative; confirm by risk assessment']]);
    h += '<h3 style="margin:8px 0 0;font-size:14px">String allocation</h3>' + tbl(['Inverter', 'MPPT', 'Array', 'Strings x modules', 'Isc (A)'], e.mppts.map(function (mp) { return [mp.inv + 1, mp.input, mp.name, mp.strings.length + ' x ' + mp.len, fx(mp.isc, 1)]; }));
    h += '<h3 style="margin:8px 0 0;font-size:14px">Wind load screening (IS 875 Part 3 method)</h3><p class="gs-note">Vz = Vb x k1 x k2 x k3 = ' + fx(w.Vz, 1) + ' m/s (k2 = ' + fx(w.k2, 2) + '), pz = 0.6 Vz² = ' + fx(w.pz, 0) + ' N/m², design pressure = pz x Cp (' + c.climate.cp + ') = ' + fx(w.p, 0) + ' N/m².</p>' +
      tbl(['Array', 'Area m²', 'Uplift kN', 'Horizontal kN', 'Dead load kN', 'Net uplift kN', 'Per column kN', 'Per anchor kN'], w.blocks.map(function (b) { return [b.block, fx(b.area, 1), fx(b.uplift, 1), fx(b.horizontal, 1), fx(b.dead, 1), fx(b.netUplift, 1), fx(b.perColumn, 2), fx(b.perAnchor, 2)]; }));
    h += '<h3 style="margin:8px 0 0;font-size:14px">Shading screen (share of irradiance lost, 09:00 to 15:00)</h3>' + tbl(['Date'].concat(m.geoms.map(function (g) { return g.block.name; })), m.shading.map(function (d) { return [d.name].concat(d.blocks.map(function (b) { return fx(b.loss * 100, 1) + '%'; })); }));
    h += '<h3 style="margin:8px 0 0;font-size:14px">Monthly energy</h3>' + tbl(['Month', 'GHI kWh/m²/day', 'POA kWh/m²/day', 'Energy kWh'], m.yield.months.map(function (x) { return [x.m, fx(x.ghi, 2), fx(x.poa, 2), fx(x.kwh, 0)]; }).concat([['Year', '', '', fx(m.yield.annual, 0) + ' (' + fx(m.yield.specific, 0) + ' kWh/kWp)']]));
    return h + '<p class="gs-note">All results are screening values for preliminary design. A structural engineer must verify the slab, anchors, foundations and wind design, and an electrical engineer must verify protection, earthing and utility requirements.</p>';
  }

  /* media tab */
  function tabMedia() {
    return '<p class="gs-note">Add site photos, a top-view image or a walkthrough video. Photos appear in the report. Use <b>Capture frame</b> on a video to pull stills from it. Files stay on this device and are not uploaded. They are held in memory for this session only.</p>' +
      '<label class="btn alt sm" style="cursor:pointer;width:max-content">Add photos / videos<input id="gs_mfile" type="file" accept="image/*,video/*" multiple hidden></label><div class="gs-media" id="gs_mlist"></div>';
  }
  function mediaListHtml() {
    if (!media.length) return '<div class="gs-note" style="grid-column:1/-1">No site media added yet.</div>';
    return media.map(function (x) {
      return '<div class="gs-mi" data-mid="' + x.id + '">' + (x.kind === 'video' ? '<video src="' + x.url + '" controls playsinline preload="metadata"></video>' : '<img alt="' + esc(x.name) + '" src="' + x.dataUrl + '">') + '<span style="overflow-wrap:anywhere">' + esc(x.name) + '</span>' +
        (x.kind === 'video' ? '<button type="button" class="btn alt sm" data-cap="' + x.id + '">Capture frame</button>' : '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-inc="' + x.id + '"' + (x.include ? ' checked' : '') + '> In report</label>') + '<button type="button" class="btn alt sm" data-rm="' + x.id + '">Remove</button></div>';
    }).join('');
  }
  function addImage(file, name) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        media.push({ id: 'm' + Date.now() + Math.floor(Math.random() * 1000), name: name || file.name, kind: 'image', file: file, dataUrl: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height, include: true }); URL.revokeObjectURL(u); res();
      }; im.onerror = function () { URL.revokeObjectURL(u); res(); }; im.src = u;
    });
  }
  function bindMedia() {
    var list = $('gs_mlist'); list.innerHTML = mediaListHtml();
    $('gs_mfile').onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []), jobs = [];
      files.forEach(function (f) { if (f.type.indexOf('video/') === 0) media.push({ id: 'm' + Date.now() + Math.floor(Math.random() * 1000), name: f.name, kind: 'video', file: f, url: URL.createObjectURL(f) }); else if (f.type.indexOf('image/') === 0) jobs.push(addImage(f)); });
      Promise.all(jobs).then(function () { list.innerHTML = mediaListHtml(); notify(files.length + ' file(s) added.'); }); e.target.value = '';
    };
    list.onclick = function (e) {
      var rm = e.target.closest('[data-rm]'), cap = e.target.closest('[data-cap]');
      if (rm) { media = media.filter(function (x) { if (x.id === rm.dataset.rm && x.url) URL.revokeObjectURL(x.url); return x.id !== rm.dataset.rm; }); if (underlay.id === rm.dataset.rm) underlay.id = ''; list.innerHTML = mediaListHtml(); }
      if (cap) { var box = list.querySelector('[data-mid="' + cap.dataset.cap + '"] video'); if (!box || !box.videoWidth) { notify('Play the video first, then capture.'); return; } var c = document.createElement('canvas'); c.width = box.videoWidth; c.height = box.videoHeight; c.getContext('2d').drawImage(box, 0, 0); c.toBlob(function (b) { var src = media.filter(function (x) { return x.id === cap.dataset.cap; })[0]; addImage(b, (src ? src.name : 'video') + ' frame ' + box.currentTime.toFixed(1) + 's').then(function () { list.innerHTML = mediaListHtml(); notify('Frame captured.'); }); }, 'image/jpeg', 0.9); }
    };
    list.onchange = function (e) { var i = e.target.dataset.inc; if (i) media.forEach(function (x) { if (x.id === i) x.include = e.target.checked; }); };
  }

  /* export tab */
  function tabExport(m) {
    var b = function (id, label, cls) { return '<button type="button" class="btn ' + (cls || 'alt') + '" data-dl="' + id + '">' + label + '</button>'; };
    return '<div class="gs-card"><b style="font-size:13px">Complete design package</b><p class="gs-note">One ZIP with the DXF drawings for AutoCAD, SVG drawings, 3D images, BOM, calculations summary, the design file and the walkthrough video (if recorded). Saved to Downloads/GenSolar on Android.</p><div class="gs-row">' + b('zip', 'Download complete package (ZIP)', '') + b('pdf', 'Create PDF report (A4 landscape)', '') + '</div></div>' +
      '<div class="gs-card"><b style="font-size:13px">AutoCAD files (DXF, drawn at full size in millimetres)</b><div class="gs-row">' + b('plandxf', 'Roof plan DXF') + b('elevdxf', 'Elevations DXF') + b('slddxf', 'Single-line diagram DXF') + b('dxf3d', '3D model DXF (3D faces)') + '</div><p class="gs-note">Sheets are drawn at 1:1 real size with the title block scaled to the sheet scale shown in the title block. DXF opens in AutoCAD, BricsCAD, DraftSight, LibreCAD and other CAD tools. DWG is not generated here; open the DXF in AutoCAD and use Save As DWG.</p></div>' +
      '<div class="gs-card"><b style="font-size:13px">Images and data</b><div class="gs-row">' + b('planpng', 'Plan image (PNG)') + b('elevpng', 'Elevations image (PNG)') + b('sldpng', 'SLD image (PNG)') + b('views', '3D views (PNG set)') + b('bom', 'BOM (CSV)') + b('json', 'Design file (JSON)') + '</div></div>' +
      '<div class="gs-card"><b style="font-size:13px">Walkthrough video</b><p class="gs-note">Record it in the 3D model tab. ' + (videoBlob ? 'A video is ready: ' + fx(videoBlob.size / 1048576, 1) + ' MB.' : 'No video recorded yet.') + '</p><div class="gs-row">' + (videoBlob ? b('video', 'Save video') : '<button type="button" class="btn alt" data-go="v3d">Go to 3D model</button>') + '</div></div>';
  }

  /* ---------- exports ---------- */
  function svgToPng(svg, w) {
    return new Promise(function (res) {
      var im = new Image(), u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/ width="[^"]*mm" height="[^"]*mm"/, ' width="' + w + '" height="' + Math.round(w * 297 / 420) + '"'));
      im.onload = function () { var c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * 297 / 420); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); c.toBlob(function (b) { res(b); }, 'image/png'); };
      im.onerror = function () { res(null); }; im.src = u;
    });
  }
  function sheets(m) { return { plan: D.planSheet(m, planOpts(m)), elev: D.elevationSheet(m, { total: 3 }), sld: D.sldSheet(m, { total: 3 }) }; }
  function bomCsv(m) {
    var rows = [['Category', 'Item', 'Quantity', 'Unit', 'Notes']].concat(m.bom.items.map(function (i) { return [i.cat, i.item, Math.round(i.qty * 10) / 10, i.unit, i.note]; }));
    return rows.map(function (r) { return r.map(function (x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); }).join('\n');
  }
  function summaryText(m) {
    var t = m.totals, e = m.elec;
    return ['GENSOLAR AUTO DESIGN - ' + m.cfg.project, 'Generated: ' + new Date().toLocaleString('en-IN'), '', 'DC capacity: ' + fx(t.kwp, 2) + ' kWp (' + t.modules + ' x ' + m.cfg.module.wp + ' Wp)', 'Inverters: ' + e.nInv + ' x ' + m.cfg.inverter.kw + ' kW, DC/AC ' + fx(e.ratio, 2), 'Strings: ' + e.strings.length + ' (max ' + e.maxStr + ' modules/string)', 'Annual energy: ' + fx(m.yield.annual, 0) + ' kWh (' + fx(m.yield.specific, 0) + ' kWh/kWp)', 'Structure steel: ' + fx(t.steelKg, 0) + ' kg, footings: ' + t.footings, '', 'WARNINGS', m.warnings.length ? m.warnings.map(function (w) { return '- ' + w; }).join('\n') : '- none', '', 'PRELIMINARY DESIGN. Verify structure, wind, anchors, electrical protection, earthing and utility rules with qualified engineers before construction.'].join('\n');
  }
  var VIEWS = [['iso-modules', { yaw: 150, pitch: 35, zoom: 1 }, { modules: true, structure: true }], ['iso-structure', { yaw: 150, pitch: 35, zoom: 1 }, { modules: false, structure: true, labels: false }], ['south', { yaw: 180, pitch: 24, zoom: 1 }, { modules: true, structure: true }], ['top', { yaw: 180, pitch: 89, zoom: 1 }, { modules: true, structure: false }], ['winter-9am-shadow', { yaw: 165, pitch: 42, zoom: 1 }, { modules: true, structure: true, shadow: [11, 9.5] }]];
  function viewImages(m, w) {
    var out = []; return VIEWS.reduce(function (p, v) { return p.then(function () { var sc = D.buildScene(m, { modules: v[2].modules, structure: v[2].structure, labels: v[2].labels !== false }); if (v[2].shadow) addShadow(sc, m, v[2].shadow[0], v[2].shadow[1]); return pngPromise({ scene: sc, view: v[1], w: w || 1280, overlay: v[0] === 'winter-9am-shadow' ? 'Winter sun 09:30' : '' }).then(function (b) { out.push({ name: v[0], blob: b }); }); }); }, Promise.resolve()).then(function () { return out; });
  }
  function blobToU8(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.readAsArrayBuffer(b); }); }
  function dl(id) {
    var m = ensureModel(); if (!m) return; var S = sheets(m), n = slug();
    if (id === 'plansvg') saveText(n + '-plan.svg', 'image/svg+xml', S.plan.toSvg());
    else if (id === 'elevsvg') saveText(n + '-elevations.svg', 'image/svg+xml', S.elev.toSvg());
    else if (id === 'sldsvg') saveText(n + '-sld.svg', 'image/svg+xml', S.sld.toSvg());
    else if (id === 'plandxf') saveText(n + '-plan.dxf', 'application/octet-stream', S.plan.toDxf());
    else if (id === 'elevdxf') saveText(n + '-elevations.dxf', 'application/octet-stream', S.elev.toDxf());
    else if (id === 'slddxf') saveText(n + '-sld.dxf', 'application/octet-stream', S.sld.toDxf());
    else if (id === 'dxf3d') saveText(n + '-3d-model.dxf', 'application/octet-stream', D.dxf3d(m));
    else if (id === 'planpng' || id === 'elevpng' || id === 'sldpng') { var k = id.slice(0, -3); svgToPng(S[k].toSvg(), 2400).then(function (b) { if (b) saveBlob(n + '-' + (k === 'elev' ? 'elevations' : k) + '.png', b); else notify('Image export failed.'); }); }
    else if (id === 'bom') saveText(n + '-bom.csv', 'text/csv', bomCsv(m));
    else if (id === 'json') saveText(n + '-design.json', 'application/json', JSON.stringify(cfg, null, 2));
    else if (id === 'video') { if (videoBlob) saveBlob(videoName, videoBlob); }
    else if (id === 'views') { notify('Rendering 3D views…'); viewImages(m, 1600).then(function (a) { a.forEach(function (x, i) { setTimeout(function () { saveBlob(n + '-3d-' + x.name + '.png', x.blob); }, i * 600); }); }); }
    else if (id === 'zip') makeZip(m, S);
    else if (id === 'pdf') makePdf(m, S);
  }
  function makeZip(m, S) {
    notify('Building design package…'); var n = slug(), files = [];
    files.push({ name: 'README.txt', data: summaryText(m) }, { name: 'drawings/01-roof-plan.dxf', data: S.plan.toDxf() }, { name: 'drawings/02-elevations.dxf', data: S.elev.toDxf() }, { name: 'drawings/03-single-line-diagram.dxf', data: S.sld.toDxf() }, { name: 'drawings/04-3d-model.dxf', data: D.dxf3d(m) },
      { name: 'drawings/01-roof-plan.svg', data: S.plan.toSvg() }, { name: 'drawings/02-elevations.svg', data: S.elev.toSvg() }, { name: 'drawings/03-single-line-diagram.svg', data: S.sld.toSvg() }, { name: 'data/bom.csv', data: bomCsv(m) }, { name: 'data/design.json', data: JSON.stringify(cfg, null, 2) });
    var jobs = [viewImages(m, 1600).then(function (a) { return Promise.all(a.map(function (x) { return blobToU8(x.blob).then(function (u) { files.push({ name: 'images/3d-' + x.name + '.png', data: u }); }); })); }),
      svgToPng(S.plan.toSvg(), 2400).then(function (b) { return b && blobToU8(b).then(function (u) { files.push({ name: 'images/roof-plan.png', data: u }); }); }),
      svgToPng(S.elev.toSvg(), 2400).then(function (b) { return b && blobToU8(b).then(function (u) { files.push({ name: 'images/elevations.png', data: u }); }); }),
      svgToPng(S.sld.toSvg(), 2400).then(function (b) { return b && blobToU8(b).then(function (u) { files.push({ name: 'images/single-line-diagram.png', data: u }); }); })];
    if (videoBlob) jobs.push(blobToU8(videoBlob).then(function (u) { files.push({ name: 'video/' + videoName, data: u }); }));
    media.forEach(function (x) { if (x.file) jobs.push(blobToU8(x.file).then(function (u) { files.push({ name: 'site-media/' + x.name.replace(/[^\w.\- ]/g, '_'), data: u }); })); });
    Promise.all(jobs).then(function () { saveBlob(n + '-design-package.zip', new Blob(D.zip(files), { type: 'application/zip' })); }).catch(function (e) { notify('Package failed: ' + e.message); });
  }
  function makePdf(m, S) {
    notify('Preparing report…'); var c = m.cfg, t = m.totals, e = m.elec;
    viewImages(m, 1100).then(function (imgs) {
      var urls = {}; return Promise.all(imgs.map(function (x) { return new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { urls[x.name] = fr.result; r(); }; fr.readAsDataURL(x.blob); }); })).then(function () { return urls; });
    }).then(function (urls) {
      var P = function (inner, cls) { return '<div class="gp ' + (cls || '') + '">' + inner + '</div>'; };
      var svg = function (s) { return s.toSvg().replace(/ width="[^"]*mm" height="[^"]*mm"/, ''); };
      var pages = [];
      pages.push(P('<div style="display:grid;grid-template-columns:1.05fr 1fr;height:100%"><div class="gpad"><div style="font:700 8pt Arial;letter-spacing:.15em;color:#0a6b4f">GENSOLAR PRO · EPC AUTO DESIGN</div><h1 style="margin-top:4mm">' + esc(c.project) + '</h1><p style="margin:0 0 4mm;color:#444">' + esc([c.client, c.address].filter(Boolean).join(' · ')) + '<br>Prepared by ' + esc(c.preparedBy || '-') + ' · ' + new Date().toLocaleDateString('en-IN') + ' · Drawing ' + esc(c.drawingNo) + ' ' + esc(c.revision) + '</p>' +
        '<div class="gm"><div><span>DC capacity</span><b>' + fx(t.kwp, 2) + ' kWp</b></div><div><span>Modules</span><b>' + t.modules + '</b></div><div><span>Inverters</span><b>' + e.nInv + ' x ' + c.inverter.kw + ' kW</b></div><div><span>Strings</span><b>' + e.strings.length + '</b></div><div><span>Annual energy</span><b>' + fx(m.yield.annual, 0) + ' kWh</b></div><div><span>Specific yield</span><b>' + fx(m.yield.specific, 0) + '</b></div><div><span>Steel</span><b>' + fx(t.steelKg, 0) + ' kg</b></div><div><span>Footings</span><b>' + t.footings + '</b></div></div>' +
        '<h2>Review points</h2>' + (m.warnings.length ? '<ul style="margin:0;padding-left:5mm;font-size:9pt">' + m.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '<p style="font-size:9pt">No automatic design warnings.</p>') +
        '<p style="font-size:8pt;color:#555;margin-top:5mm">Preliminary design. Structural capacity of the roof, wind design, anchors, electrical protection, earthing, lightning protection and utility requirements must be verified by qualified engineers before construction.</p></div><div style="background:#0a6b4f;display:flex;align-items:center;padding:6mm"><img src="' + urls['iso-modules'] + '" style="width:100%;border-radius:3mm"></div></div>'));
      pages.push(P(svg(S.plan))); pages.push(P(svg(S.elev)));
      pages.push(P('<div class="gpad"><h2>3D model views</h2><div class="g2"><figure><img src="' + urls['iso-modules'] + '"><figcaption>Isometric with modules</figcaption></figure><figure><img src="' + urls['iso-structure'] + '"><figcaption>Mounting structure only</figcaption></figure><figure><img src="' + urls['south'] + '"><figcaption>South elevation view</figcaption></figure><figure><img src="' + urls['winter-9am-shadow'] + '"><figcaption>Winter sun 09:30 with shadows</figcaption></figure></div></div>'));
      pages.push(P('<div class="gpad"><h2>Top view</h2><div style="display:grid;grid-template-columns:1.4fr 1fr;gap:5mm"><img src="' + urls.top + '" style="width:100%;border:.2mm solid #bbb"><div>' + yieldChart(m.yield) + '<p style="font-size:8pt;color:#555">Monthly energy in MWh. Estimated ' + fx(m.yield.annual, 0) + ' kWh per year.</p></div></div></div>'));
      pages.push(P(svg(S.sld)));
      var half = Math.ceil(m.bom.items.length / 2), bt = function (items) { return '<table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>' + items.map(function (i) { return '<tr><td>' + esc(i.item) + (i.note ? '<br><small style="color:#666">' + esc(i.note) + '</small>' : '') + '</td><td>' + esc(fx(i.qty, 1)) + '</td><td>' + esc(i.unit) + '</td></tr>'; }).join('') + '</tbody></table>'; };
      pages.push(P('<div class="gpad"><h2>Bill of materials (preliminary)</h2><div class="g2"><div>' + bt(m.bom.items.slice(0, half)) + '</div><div>' + bt(m.bom.items.slice(half)) + '</div></div></div>'));
      var rows = function (a) { return '<table><tbody>' + a.map(function (r) { return '<tr><th style="width:55%">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>'; };
      pages.push(P('<div class="gpad"><h2>Electrical and structural calculations</h2><div class="g2"><div>' + rows([['Cold Voc / module', fx(e.vocCold, 2) + ' V'], ['Hot Vmp / module', fx(e.vmpHot, 2) + ' V'], ['Modules per string (min / max)', e.nmin + ' / ' + e.nmax], ['Longest string cold Voc', fx(e.maxStrVocCold, 0) + ' V'], ['Shortest string hot Vmp', fx(e.minStrVmpHot, 0) + ' V'], ['DC / AC ratio', fx(e.ratio, 2)], ['String fuse', e.fuse + ' A'], ['DC cable', (e.dcCable ? e.dcCable.size : '-') + ' sq.mm ' + c.cable.dcMat], ['AC cable per inverter', (e.acCable ? e.acCable.size : '-') + ' sq.mm 4C ' + c.cable.acMat], ['AC breaker / main breaker', e.acBreaker + ' A / ' + e.mainBreaker + ' A'], ['Earth pits / LA rods', e.earthPits + ' / ' + e.laRods]]) + '</div><div>' + rows([['Design wind speed Vz', fx(m.wind.Vz, 1) + ' m/s'], ['Wind pressure pz', fx(m.wind.pz, 0) + ' N/m²'], ['Design pressure (Cp ' + c.climate.cp + ')', fx(m.wind.p, 0) + ' N/m²']].concat(m.wind.blocks.map(function (b) { return [b.block + ' uplift / column', fx(b.uplift, 1) + ' kN / ' + fx(b.perColumn, 2) + ' kN']; })).concat([['Average shading loss', fx(m.shadeLoss * 100, 1) + '%'], ['Latitude / longitude', c.lat + ', ' + c.lon]])) + '</div></div><p style="font-size:8pt;color:#555">Wind: IS 875 Part 3 screening with k2 interpolation; uplift per column is net of 90% dead load. Shading: ray test from every module centre, 09:00-15:00 on three reference days.</p></div>'));
      var imgsM = media.filter(function (x) { return x.kind === 'image' && x.include; });
      for (var i = 0; i < imgsM.length; i += 6) pages.push(P('<div class="gpad"><h2>Site photographs</h2><div class="g2" style="grid-template-columns:repeat(3,1fr)">' + imgsM.slice(i, i + 6).map(function (x) { return '<figure><img src="' + x.dataUrl + '" style="height:62mm;object-fit:cover"><figcaption>' + esc(x.name) + '</figcaption></figure>'; }).join('') + '</div></div>'));
      var rootEl = $('gscs_printRoot'); if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'gscs_printRoot'; document.body.appendChild(rootEl); }
      rootEl.innerHTML = pages.join('');
      var ps = document.createElement('style'); ps.id = 'gscs_page'; ps.textContent = '@page{size:A4 landscape;margin:0}'; document.head.appendChild(ps);
      document.body.classList.add('gscs-printing');
      var done = function () { document.body.classList.remove('gscs-printing'); var s = $('gscs_page'); if (s) s.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); setTimeout(done, 180000);
      setTimeout(function () { try { var N = window.GenSolarNative; if (N && typeof N.printPdfLandscape === 'function') N.printPdfLandscape(); else window.print(); } catch (x) { notify('PDF is not available here.'); done(); } }, 500);
    }).catch(function (e) { notify('Report failed: ' + e.message); });
  }

  /* ---------- plan controls (delegated) ---------- */
  function onViewClick(e) {
    var z = e.target.closest('[data-zoom]'), d = e.target.closest('[data-dl]'), g = e.target.closest('[data-go]'), t = e.target.closest('[data-tab]');
    if (z) { var v = +z.dataset.zoom; planZoom = v === 0 ? 1 : Math.max(1, Math.min(6, planZoom + v * 0.5)); var box = q('.gs-sheet'); if (box) { var inner = box.firstChild; inner.style.width = Math.round(planZoom * 100) + '%'; } return; }
    if (d) { dl(d.dataset.dl); return; }
    if (g) { renderTab(g.dataset.go); return; }
    if (t) { renderTab(t.dataset.tab); }
  }
  function onViewChange(e) {
    var id = e.target.id, plan = false;
    if (id === 'gs_pStruct') { opt.planStructure = e.target.checked; plan = true; } else if (id === 'gs_pDims') { opt.dims = e.target.checked; plan = true; } else if (id === 'gs_pShadow') { opt.shadow = e.target.checked; plan = true; }
    else if (id === 'gs_pMonth') { opt.month = +e.target.value; plan = true; } else if (id === 'gs_pHour') { opt.hour = +e.target.value; plan = true; }
    else if (id === 'gs_uSel') { underlay.id = e.target.value; plan = true; } else if (id === 'gs_uW') { underlay.w = parseFloat(e.target.value) || 1; plan = true; } else if (id === 'gs_uX') { underlay.x = parseFloat(e.target.value) || 0; plan = true; } else if (id === 'gs_uY') { underlay.y = parseFloat(e.target.value) || 0; plan = true; }
    if (plan && $('gs_planBox')) $('gs_planBox').innerHTML = sheetHtml(planSvg(model), planZoom);
  }

  /* ---------- init ---------- */
  function init() {
    cfg = load();
    if (!cfg) { cfg = legacyPrefill(E.normalize({})); }
    skeleton();
    // move legacy tools into a collapsible block, keep every original element and id
    var legacy = document.createElement('details'); legacy.className = 'gs-legacy';
    legacy.innerHTML = '<summary>Quick concept tools (earlier Auto Design, CAD import and 3D concept)</summary>';
    var kids = Array.prototype.slice.call(root.children), head = root.querySelector('.epca-head');
    kids.forEach(function (k) { if (k === head) return; legacy.appendChild(k); });
    if (head) head.style.display = 'none';
    root.appendChild(section); root.appendChild(legacy);
    bindForm();
    var res = $('gs_results'); res.addEventListener('click', onViewClick); res.addEventListener('change', onViewChange); res.addEventListener('input', function (e) { if (e.target.id === 'gs_pHour' || e.target.id === 'gs_uW' || e.target.id === 'gs_uX' || e.target.id === 'gs_uY') onViewChange(e); });
    window.GSCS = window.GSCS || {}; window.GSCS.getModel = function () { return ensureModel(); }; window.GSCS.getConfig = function () { return cfg; }; window.GSCS.generate = generate; window.GSCS.loadSample = loadSample; window.GSCS.setTab = renderTab; window.GSCS.makeZipParts = function () { var m = ensureModel(); return D.zip([{ name: 'a.txt', data: summaryText(m) }]); };
  }
  init();
})();
