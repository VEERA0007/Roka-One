/* GenSolar CAD Studio - drawing generation: A3 sheets (SVG + DXF), 3D scene, canvas renderer, ZIP writer. No DOM except where noted. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cad-engine.js'));
  else root.GSCadDraw = factory(root.GSCadEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var R = Math.PI / 180;
  var SW = 420, SH = 297;
  var LAYERS = {
    BORDER: ['#111111', 7, 0.5], TITLE: ['#111111', 7, 0.25], BUILDING: ['#6b7280', 8, 0.18], WALL: ['#374151', 8, 0.4], PARAPET: ['#111827', 7, 0.25],
    PV_MODULE: ['#1e3a8a', 5, 0.12], STRUCT_COLUMN: ['#b45309', 30, 0.3], STRUCT_RAFTER: ['#0f766e', 4, 0.25], STRUCT_PURLIN: ['#0891b2', 4, 0.15], STRUCT_BRACE: ['#7c3aed', 6, 0.15],
    FOUNDATION: ['#78716c', 9, 0.2], DIM: ['#dc2626', 1, 0.15], TEXT: ['#111111', 7, 0.15], SHADOW: ['#475569', 8, 0.15], NORTH: ['#111111', 7, 0.3], GROUND: ['#16a34a', 3, 0.25],
    SLD: ['#111111', 7, 0.3], SLD_DC: ['#dc2626', 1, 0.4], SLD_AC: ['#1d4ed8', 5, 0.4], SLD_PE: ['#16a34a', 3, 0.3], UNDERLAY: ['#999999', 8, 0.1]
  };

  /* ---------- sheet ---------- */
  function Sheet(title, den) {
    this.title = title; this.den = den || 1; this.items = [];
  }
  Sheet.prototype.line = function (x1, y1, x2, y2, l, o) { this.items.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, l: l || 'TEXT', o: o }); };
  Sheet.prototype.poly = function (p, l, o) { this.items.push({ t: 'poly', p: p, l: l || 'TEXT', closed: !(o && o.open), fill: o && o.fill, o: o }); };
  Sheet.prototype.rect = function (x, y, w, h, l, o) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], l, o); };
  Sheet.prototype.circle = function (x, y, r, l, o) { this.items.push({ t: 'circle', x: x, y: y, r: r, l: l || 'TEXT', fill: o && o.fill }); };
  Sheet.prototype.text = function (x, y, s, h, l, o) { if (s === '' || s == null) return; this.items.push({ t: 'text', x: x, y: y, s: String(s), h: h || 2.5, l: l || 'TEXT', a: (o && o.a) || 'l', rot: (o && o.rot) || 0, b: !!(o && o.b), col: o && o.col }); };
  Sheet.prototype.image = function (x, y, w, h, href, op) { this.items.push({ t: 'image', x: x, y: y, w: w, h: h, href: href, op: op == null ? 0.5 : op }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f(v) { return Math.round(v * 100) / 100; }

  Sheet.prototype.toSvg = function () {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SW + ' ' + SH + '" width="' + SW + 'mm" height="' + SH + 'mm" font-family="Arial,Helvetica,sans-serif"><rect width="' + SW + '" height="' + SH + '" fill="#fff"/>'];
    this.items.forEach(function (it) {
      var L = LAYERS[it.l] || LAYERS.TEXT, col = L[0], lw = (it.o && it.o.lw) || L[2], dash = it.o && it.o.dash ? ' stroke-dasharray="' + it.o.dash + '"' : '';
      if (it.t === 'line') o.push('<line x1="' + f(it.x1) + '" y1="' + f(SH - it.y1) + '" x2="' + f(it.x2) + '" y2="' + f(SH - it.y2) + '" stroke="' + ((it.o && it.o.col) || col) + '" stroke-width="' + lw + '"' + dash + '/>');
      else if (it.t === 'poly') o.push('<' + (it.closed ? 'polygon' : 'polyline') + ' points="' + it.p.map(function (p) { return f(p[0]) + ',' + f(SH - p[1]); }).join(' ') + '" fill="' + (it.fill || 'none') + '" ' + (it.o && it.o.fop ? 'fill-opacity="' + it.o.fop + '" ' : '') + 'stroke="' + ((it.o && it.o.col) || col) + '" stroke-width="' + lw + '"' + dash + '/>');
      else if (it.t === 'circle') o.push('<circle cx="' + f(it.x) + '" cy="' + f(SH - it.y) + '" r="' + f(it.r) + '" fill="' + (it.fill || 'none') + '" stroke="' + col + '" stroke-width="' + lw + '"/>');
      else if (it.t === 'image') o.push('<image href="' + it.href + '" x="' + f(it.x) + '" y="' + f(SH - it.y - it.h) + '" width="' + f(it.w) + '" height="' + f(it.h) + '" opacity="' + it.op + '" preserveAspectRatio="none"/>');
      else if (it.t === 'text') {
        var anchor = it.a === 'c' ? 'middle' : it.a === 'r' ? 'end' : 'start', tx = f(it.x), ty = f(SH - it.y);
        o.push('<text x="' + tx + '" y="' + ty + '" font-size="' + it.h + '" text-anchor="' + anchor + '" fill="' + (it.col || col) + '"' + (it.b ? ' font-weight="700"' : '') + (it.rot ? ' transform="rotate(' + (-it.rot) + ' ' + tx + ' ' + ty + ')"' : '') + '>' + esc(it.s) + '</text>');
      }
    });
    o.push('</svg>');
    return o.join('');
  };

  /* ---------- DXF (R12 ASCII, opens in AutoCAD and every CAD viewer) ---------- */
  function Dxf() { this.b = []; this.layers = {}; }
  Dxf.prototype.layer = function (name) { if (!this.layers[name]) { var L = LAYERS[name]; this.layers[name] = L ? L[1] : 7; } return name; };
  Dxf.prototype.add = function () { for (var i = 0; i < arguments.length; i++) this.b.push(String(arguments[i])); };
  Dxf.prototype.line = function (l, a, b) { this.add(0, 'LINE', 8, this.layer(l), 10, f6(a[0]), 20, f6(a[1]), 30, f6(a[2] || 0), 11, f6(b[0]), 21, f6(b[1]), 31, f6(b[2] || 0)); };
  Dxf.prototype.face = function (l, p) { var q = p.length === 3 ? p.concat([p[2]]) : p; this.add(0, '3DFACE', 8, this.layer(l)); for (var i = 0; i < 4; i++) this.add(10 + i, f6(q[i][0]), 20 + i, f6(q[i][1]), 30 + i, f6(q[i][2] || 0)); };
  Dxf.prototype.circle = function (l, c, r) { this.add(0, 'CIRCLE', 8, this.layer(l), 10, f6(c[0]), 20, f6(c[1]), 30, 0, 40, f6(r)); };
  Dxf.prototype.poly = function (l, pts, closed) {
    this.add(0, 'POLYLINE', 8, this.layer(l), 66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0);
    for (var i = 0; i < pts.length; i++) this.add(0, 'VERTEX', 8, this.layer(l), 10, f6(pts[i][0]), 20, f6(pts[i][1]), 30, f6(pts[i][2] || 0));
    this.add(0, 'SEQEND', 8, this.layer(l));
  };
  Dxf.prototype.text = function (l, p, h, s, rot, align) {
    var al = align === 'c' ? 1 : align === 'r' ? 2 : 0;
    this.add(0, 'TEXT', 8, this.layer(l), 10, f6(p[0]), 20, f6(p[1]), 30, f6(p[2] || 0), 40, f6(h), 1, String(s).replace(/[\r\n]+/g, ' '), 50, f6(rot || 0));
    if (al) this.add(72, al, 11, f6(p[0]), 21, f6(p[1]), 31, f6(p[2] || 0));
  };
  function f6(v) { return (Math.round(v * 1e5) / 1e5).toString(); }
  Dxf.prototype.toString = function () {
    var h = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB'];
    var names = Object.keys(this.layers);
    h.push('0', 'TABLE', '2', 'LAYER', '70', String(names.length));
    names.forEach(function (nm) { h.push('0', 'LAYER', '2', nm, '70', '0', '62', String(this.layers[nm]), '6', 'CONTINUOUS'); }, this);
    h.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
    return h.concat(this.b, ['0', 'ENDSEC', '0', 'EOF']).join('\n') + '\n';
  };
  /* sheet -> model-space DXF at real size: 1 sheet mm x den = 1 real mm */
  Sheet.prototype.toDxf = function () {
    var d = new Dxf(), k = this.den;
    this.items.forEach(function (it) {
      if (it.t === 'line') d.line(it.l, [it.x1 * k, it.y1 * k], [it.x2 * k, it.y2 * k]);
      else if (it.t === 'poly') d.poly(it.l, it.p.map(function (p) { return [p[0] * k, p[1] * k]; }), it.closed);
      else if (it.t === 'circle') d.circle(it.l, [it.x * k, it.y * k], it.r * k);
      else if (it.t === 'text') d.text(it.l, [it.x * k, it.y * k], it.h * k, it.s, it.rot, it.a);
    });
    return d.toString();
  };

  /* ---------- helpers ---------- */
  var SCALES = [1, 2, 5, 10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];
  function pickScale(wM, hM, aw, ah) { for (var i = 0; i < SCALES.length; i++) { var k = 1000 / SCALES[i]; if (wM * k <= aw && hM * k <= ah) return SCALES[i]; } return SCALES[SCALES.length - 1]; }
  function frame(sh, model, title, scaleTxt, no, total) {
    var cfg = model.cfg;
    sh.rect(5, 5, 410, 287, 'BORDER'); sh.rect(8, 8, 404, 281, 'TITLE', { lw: 0.2 });
    sh.rect(8, 8, 404, 24, 'TITLE');
    var cols = [[8, 120], [128, 70], [198, 62], [260, 40], [300, 50], [350, 62]];
    cols.forEach(function (c, i) { if (i) sh.line(c[0], 20, c[0], 32, 'TITLE'); });
    sh.line(8, 20, 412, 20, 'TITLE');
    sh.text(10, 28, 'PROJECT', 1.8, 'TEXT', { col: '#666' }); sh.text(10, 22.6, cfg.project, 4, 'TEXT', { b: true });
    sh.text(130, 28, 'DRAWING', 1.8, 'TEXT', { col: '#666' }); sh.text(130, 22.6, title, 3.2, 'TEXT', { b: true });
    sh.text(200, 28, 'CLIENT / SITE', 1.8, 'TEXT', { col: '#666' }); sh.text(200, 22.6, (cfg.client || cfg.address || '-').slice(0, 26), 3, 'TEXT');
    sh.text(262, 28, 'SCALE', 1.8, 'TEXT', { col: '#666' }); sh.text(262, 22.6, scaleTxt, 3.2, 'TEXT', { b: true });
    sh.text(302, 28, 'DRG NO / REV', 1.8, 'TEXT', { col: '#666' }); sh.text(302, 22.6, cfg.drawingNo + ' / ' + cfg.revision, 3, 'TEXT');
    sh.text(352, 28, 'SHEET', 1.8, 'TEXT', { col: '#666' }); sh.text(352, 22.6, no + ' of ' + total, 3, 'TEXT');
    sh.text(10, 17.5, 'GenSolar Pro - EPC Auto Design', 3, 'TEXT', { b: true });
    sh.text(10, 12.2, 'Prepared by: ' + (cfg.preparedBy || '-') + '   Date: ' + new Date().toLocaleDateString('en-IN') + '   PRELIMINARY - NOT FOR CONSTRUCTION UNTIL APPROVED BY A QUALIFIED ENGINEER', 2.2, 'TEXT', { col: '#444' });
    sh.text(412 - 2, 12.2, 'All dimensions in metres unless noted', 2.2, 'TEXT', { a: 'r', col: '#444' });
  }
  function dimLine(sh, p1, p2, off, txt, h) {
    var dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.sqrt(dx * dx + dy * dy); if (L < 0.5) return;
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a = [p1[0] + nx * off, p1[1] + ny * off], b = [p2[0] + nx * off, p2[1] + ny * off], ex = off >= 0 ? 1.2 : -1.2;
    sh.line(p1[0] + nx * 0.8 * Math.sign(off), p1[1] + ny * 0.8 * Math.sign(off), a[0] + nx * ex, a[1] + ny * ex, 'DIM');
    sh.line(p2[0] + nx * 0.8 * Math.sign(off), p2[1] + ny * 0.8 * Math.sign(off), b[0] + nx * ex, b[1] + ny * ex, 'DIM');
    sh.line(a[0], a[1], b[0], b[1], 'DIM');
    [a, b].forEach(function (q) { sh.line(q[0] - ux * 0.9 - nx * 0.9, q[1] - uy * 0.9 - ny * 0.9, q[0] + ux * 0.9 + nx * 0.9, q[1] + uy * 0.9 + ny * 0.9, 'DIM', { lw: 0.3 }); });
    var ang = Math.atan2(dy, dx) / R; if (ang > 90 || ang < -90) ang += 180;
    var mx = (a[0] + b[0]) / 2 + nx * 0.9 * (off >= 0 ? 1 : -1) * (ang === Math.atan2(dy, dx) / R ? 1 : 1), my = (a[1] + b[1]) / 2 + ny * 0.9 * (off >= 0 ? 1 : -1);
    sh.text(mx, my, txt, h || 2.3, 'DIM', { a: 'c', rot: ang, col: '#b91c1c' });
  }
  function fx(v, d) { return Number(v).toFixed(d == null ? 2 : d); }
  function legend(sh, x, y, rows) {
    rows.forEach(function (r, i) {
      var yy = y - i * 5;
      if (r.fill) sh.rect(x, yy - 1.6, 6, 3.2, r.l, { fill: r.fill }); else sh.line(x, yy, x + 6, yy, r.l, { lw: 0.5 });
      sh.text(x + 8, yy - 0.9, r.t, 2.3, 'TEXT');
    });
  }
  function northArrow(sh, x, y) {
    sh.circle(x, y, 7, 'NORTH'); sh.poly([[x, y + 9], [x - 3, y - 4], [x, y - 1.5], [x + 3, y - 4]], 'NORTH', { fill: '#111' });
    sh.text(x, y + 11, 'N', 4, 'NORTH', { a: 'c', b: true });
  }
  function scaleBar(sh, x, y, den) {
    var k = 1000 / den, len = den >= 400 ? 20 : den >= 100 ? 10 : 5;
    sh.rect(x, y, len * k, 1.6, 'TEXT'); sh.rect(x, y, len * k / 2, 1.6, 'TEXT', { fill: '#111' });
    sh.text(x, y + 2.6, '0', 2.2, 'TEXT', { a: 'c' }); sh.text(x + len * k, y + 2.6, len + ' m', 2.2, 'TEXT', { a: 'c' });
  }

  /* ---------- PLAN ---------- */
  function planSheet(model, opts) {
    opts = opts || {};
    var cfg = model.cfg, g = model.geoms, levels = cfg.levels, structure = opts.structure !== false;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    levels.forEach(function (l) { minx = Math.min(minx, l.x); miny = Math.min(miny, l.y); maxx = Math.max(maxx, l.x + l.l); maxy = Math.max(maxy, l.y + l.w); });
    g.forEach(function (b) { minx = Math.min(minx, b.bbox[0]); miny = Math.min(miny, b.bbox[1]); maxx = Math.max(maxx, b.bbox[2]); maxy = Math.max(maxy, b.bbox[3]); });
    var AX = 16, AY = 40, AW = 268, AH = 244, pad = 24;
    var den = pickScale(maxx - minx, maxy - miny, AW - 2 * pad, AH - 2 * pad), k = 1000 / den;
    var ox = AX + pad + (AW - 2 * pad - (maxx - minx) * k) / 2, oy = AY + pad + (AH - 2 * pad - (maxy - miny) * k) / 2;
    function X(x) { return ox + (x - minx) * k; }
    function Y(y) { return oy + (y - miny) * k; }
    function P(p) { return [X(p[0]), Y(p[1])]; }
    var sh = new Sheet('Plan', den);
    frame(sh, model, opts.title || 'ROOF PLAN - SOLAR ARRAY LAYOUT', '1 : ' + den, opts.no || 1, opts.total || 3);
    if (opts.underlay) {
      var u = opts.underlay; sh.image(X(u.x), Y(u.y), u.w * k, u.h * k, u.href, u.op);
    }
    levels.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) { return a.l.z - b.l.z; }).forEach(function (o) {
      var l = o.l, tone = ['#eef0ee', '#e3e6e3', '#d8dcd8', '#cdd2cd'][Math.min(3, Math.round(l.z - Math.min.apply(null, levels.map(function (q) { return q.z; })) > 0 ? 1 + Math.floor((l.z - Math.min.apply(null, levels.map(function (q) { return q.z; }))) / 3) : 0))];
      sh.rect(X(l.x), Y(l.y), l.l * k, l.w * k, 'WALL', { fill: tone });
      if (cfg.parapet > 0) { var t = 0.23 * k; sh.rect(X(l.x) + t, Y(l.y) + t, l.l * k - 2 * t, l.w * k - 2 * t, 'PARAPET', { lw: 0.15 }); }
      sh.text(X(l.x), Y(l.y + l.w) + 2, l.name + '  (RL +' + fx(l.z, 2) + ' m)', 2.6, 'TEXT', { b: true, col: '#555' });
      if (opts.dims !== false) {
        dimLine(sh, [X(l.x), Y(l.y)], [X(l.x + l.l), Y(l.y)], -9 - o.i * 0, fx(l.l, 2), 2.3);
        dimLine(sh, [X(l.x), Y(l.y)], [X(l.x), Y(l.y + l.w)], 9, fx(l.w, 2), 2.3);
      }
    });
    if (opts.shadow) {
      E.shadowPolys(cfg, g, opts.shadow.day, opts.shadow.hour).forEach(function (s) { sh.poly(s.pts.map(P), 'SHADOW', { fill: '#475569', fop: 0.28, lw: 0.1 }); });
    }
    g.forEach(function (b, bi) {
      if (structure) {
        b.members.forEach(function (m) { if (m.type === 'pur') sh.line(X(m.a[0]), Y(m.a[1]), X(m.b[0]), Y(m.b[1]), 'STRUCT_PURLIN'); else if (m.type === 'raf') sh.line(X(m.a[0]), Y(m.a[1]), X(m.b[0]), Y(m.b[1]), 'STRUCT_RAFTER'); });
        b.foots.forEach(function (ft) {
          var hw = ft.w / 2, hd = ft.d / 2, c = ft.at, ax = b.ux, ay = b.uy, bx = b.vx, by = b.vy;
          sh.poly([[c[0] - ax * hw - bx * hd, c[1] - ay * hw - by * hd], [c[0] + ax * hw - bx * hd, c[1] + ay * hw - by * hd], [c[0] + ax * hw + bx * hd, c[1] + ay * hw + by * hd], [c[0] - ax * hw + bx * hd, c[1] - ay * hw + by * hd]].map(P), 'FOUNDATION', { fill: '#a8a29e' });
        });
      }
      b.modules.forEach(function (md) { sh.poly(md.quad.map(function (q) { return P(q); }), 'PV_MODULE', { fill: structure ? '#bcd0f5' : '#9db8ee', fop: structure ? 0.55 : 0.9 }); });
      var cx = 0, cy = 0; b.corners.forEach(function (c) { cx += c[0] / 4; cy += c[1] / 4; });
      sh.text(X(cx), Y(cy) - 3, String(b.count), Math.min(14, Math.max(5, b.W * k * 0.18)), 'TEXT', { a: 'c', b: true, col: '#0b1f5c' });
      sh.text(X(cx), Y(cy) - 3 - Math.min(14, Math.max(5, b.W * k * 0.18)) * 0.55, b.block.name, 2.4, 'TEXT', { a: 'c', col: '#0b1f5c' });
      if (opts.dims !== false) {
        var c0 = P(b.corners[0]), c1 = P(b.corners[1]), c3 = P(b.corners[3]);
        var flip = (b.block.azimuth > 90 && b.block.azimuth < 270) ? 1 : -1;
        dimLine(sh, c0, c1, -5 * flip * -1 * -1, fx(b.W, 2), 2.1);
        dimLine(sh, c1, P(b.corners[2]), 5, fx(b.D, 2) + ' (plan)', 2.1);
      }
    });
    northArrow(sh, AX + AW - 14, AY + AH - 14); scaleBar(sh, AX + 4, AY + 2, den);
    // right column: legend + array schedule + notes
    var rx = 292;
    sh.text(rx, 283, 'LEGEND', 3, 'TEXT', { b: true });
    legend(sh, rx, 277, [{ l: 'PV_MODULE', fill: '#bcd0f5', t: 'PV module' }, { l: 'FOUNDATION', fill: '#a8a29e', t: 'Pedestal footing' }, { l: 'STRUCT_RAFTER', t: 'Main rafter' }, { l: 'STRUCT_PURLIN', t: 'Purlin' }, { l: 'WALL', t: 'Roof / wall outline' }, { l: 'PARAPET', t: 'Parapet inner face' }, { l: 'SHADOW', fill: '#cbd5e1', t: 'Shadow (if shown)' }]);
    sh.text(rx, 238, 'ARRAY SCHEDULE', 3, 'TEXT', { b: true });
    sh.text(rx, 233, 'Array', 2.2, 'TEXT', { b: true }); sh.text(rx + 36, 233, 'Mod', 2.2, 'TEXT', { b: true, a: 'r' }); sh.text(rx + 56, 233, 'Tilt', 2.2, 'TEXT', { b: true, a: 'r' }); sh.text(rx + 76, 233, 'Low RL', 2.2, 'TEXT', { b: true, a: 'r' }); sh.text(rx + 94, 233, 'Az', 2.2, 'TEXT', { b: true, a: 'r' });
    sh.line(rx, 231.5, rx + 96, 231.5, 'TITLE');
    g.slice(0, 22).forEach(function (b, i) {
      var yy = 227.5 - i * 4.2;
      sh.text(rx, yy, b.block.name.slice(0, 16), 2.1, 'TEXT'); sh.text(rx + 36, yy, b.count, 2.1, 'TEXT', { a: 'r' }); sh.text(rx + 56, yy, b.tilt + '°', 2.1, 'TEXT', { a: 'r' });
      sh.text(rx + 76, yy, fx(b.zLow, 2), 2.1, 'TEXT', { a: 'r' }); sh.text(rx + 94, yy, fx(b.block.azimuth, 0) + '°', 2.1, 'TEXT', { a: 'r' });
    });
    var yt = 227.5 - Math.min(22, g.length) * 4.2 - 2;
    sh.line(rx, yt + 2.5, rx + 96, yt + 2.5, 'TITLE');
    sh.text(rx, yt - 2, 'Total ' + model.totals.modules + ' modules = ' + fx(model.totals.kwp, 2) + ' kWp', 2.6, 'TEXT', { b: true });
    sh.text(rx, yt - 7, 'Inverter ' + model.elec.nInv + ' x ' + cfg.inverter.kw + ' kW  |  DC/AC ' + fx(model.elec.ratio, 2), 2.2, 'TEXT');
    sh.text(rx, yt - 11.5, 'Est. yield ' + Math.round(model.yield.annual).toLocaleString('en-IN') + ' kWh/yr (' + Math.round(model.yield.specific) + ' kWh/kWp)', 2.2, 'TEXT');
    var notes = ['NOTES', '1. Array positions are measured from the south-west corner', '   of each roof level. Verify on site before fabrication.', '2. Structure and foundations are preliminary and need', '   structural approval (slab load, wind, anchors).', '3. Setbacks, access paths and fire safety per local code.'];
    notes.forEach(function (t, i) { sh.text(rx, 60 - i * 4.2, t, i ? 2 : 2.8, 'TEXT', { b: !i, col: i ? '#444' : '#111' }); });
    return sh;
  }

  /* ---------- ELEVATIONS ---------- */
  function elevationSheet(model, opts) {
    opts = opts || {};
    var cfg = model.cfg, g = model.geoms, levels = cfg.levels;
    var views = [{ id: 'front', name: 'FRONT ELEVATION (from south, looking north)', h: function (p) { return p[0]; }, lo: 0 }, { id: 'side', name: 'SIDE ELEVATION (from east, looking west)', h: function (p) { return p[1]; }, lo: 1 }];
    var zmax = 0, ext = [[1e9, -1e9], [1e9, -1e9]];
    levels.forEach(function (l) { zmax = Math.max(zmax, l.z + cfg.parapet); ext[0][0] = Math.min(ext[0][0], l.x); ext[0][1] = Math.max(ext[0][1], l.x + l.l); ext[1][0] = Math.min(ext[1][0], l.y); ext[1][1] = Math.max(ext[1][1], l.y + l.w); });
    g.forEach(function (b) { zmax = Math.max(zmax, b.zHigh + 0.2); ext[0][0] = Math.min(ext[0][0], b.bbox[0]); ext[0][1] = Math.max(ext[0][1], b.bbox[2]); ext[1][0] = Math.min(ext[1][0], b.bbox[1]); ext[1][1] = Math.max(ext[1][1], b.bbox[3]); });
    var zb = Math.max(0, Math.min.apply(null, levels.map(function (l) { return l.z; })) - 2.5), aw = 392 - 40, ah = 112 - 22;
    var den = Math.max(pickScale(ext[0][1] - ext[0][0], zmax - zb, aw, ah), pickScale(ext[1][1] - ext[1][0], zmax - zb, aw, ah)), k = 1000 / den;
    var sh = new Sheet('Elevations', den);
    frame(sh, model, opts.title || 'ELEVATIONS AND SECTION DETAILS', '1 : ' + den, opts.no || 2, opts.total || 3);
    views.forEach(function (v, vi) {
      var top = vi === 0 ? 287 : 164, base = top - 120, x0 = 20, e0 = ext[v.lo][0], e1 = ext[v.lo][1];
      var offx = x0 + (aw - (e1 - e0) * k) / 2, gy = base + 14;
      function X(p) { return offx + (v.h(p) - e0) * k; }
      function XH(h) { return offx + (h - e0) * k; }
      function Z(z) { return gy + (z - zb) * k; }
      sh.text(10, top - 4, v.name, 3.2, 'TEXT', { b: true });
      if (zb <= 0) { sh.line(x0 - 6, gy, 412 - 14, gy, 'GROUND', { lw: 0.5 }); for (var hx = x0 - 6; hx < 398; hx += 4) sh.line(hx, gy, hx - 2.5, gy - 2.5, 'GROUND', { lw: 0.1 }); }
      levels.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (l) {
        var a0 = v.lo === 0 ? l.x : l.y, a1 = v.lo === 0 ? l.x + l.l : l.y + l.w;
        sh.rect(XH(a0), Z(zb), (a1 - a0) * k, (l.z - zb) * k, 'WALL', { fill: '#efe3d3' });
        if (zb > 0) { var zz = [[XH(a0), Z(zb) + 1.5], [XH(a0) + (a1 - a0) * k * 0.3, Z(zb) - 1.2], [XH(a0) + (a1 - a0) * k * 0.45, Z(zb) + 1.8], [XH(a0) + (a1 - a0) * k * 0.6, Z(zb) - 1.2], [XH(a1), Z(zb) + 1.5]]; sh.poly(zz, 'BUILDING', { open: true, lw: 0.3 }); sh.text(XH(a0) + 1, Z(zb) + 3, 'break line - lower floors not shown', 1.8, 'TEXT', { col: '#777' }); }
        if (cfg.parapet > 0) sh.rect(XH(a0), Z(l.z), (a1 - a0) * k, cfg.parapet * k, 'PARAPET', { fill: '#cdbfae' });
        for (var fz = 3; fz < l.z; fz += 3) if (fz > zb + 0.5) sh.line(XH(a0), Z(fz), XH(a1), Z(fz), 'BUILDING', { lw: 0.08, dash: '1.5 1.5' });
        dimLine(sh, [XH(a0), Z(zb)], [XH(a0), Z(l.z)], -6, 'RL +' + fx(l.z, 2), 2.1);
      });
      var order = g.slice().sort(function (a, b) { return v.lo === 0 ? (b.bbox[1] - a.bbox[1]) : (a.bbox[0] - b.bbox[0]); });
      order.forEach(function (b) {
        if (opts.structure !== false) {
          b.foots.forEach(function (ft) { var c = ft.at; sh.rect(X(c) - ft.w * k / 2, Z(c[2]), ft.w * k, ft.h * k, 'FOUNDATION', { fill: '#a8a29e' }); });
          b.members.forEach(function (m) { var l = m.type === 'col' ? 'STRUCT_COLUMN' : m.type === 'raf' ? 'STRUCT_RAFTER' : m.type === 'pur' ? 'STRUCT_PURLIN' : 'STRUCT_BRACE'; sh.line(X(m.a), Z(m.a[2]), X(m.b), Z(m.b[2]), l); });
        }
        b.modules.forEach(function (md) { sh.poly(md.quad.map(function (q) { return [X(q), Z(q[2])]; }), 'PV_MODULE', { fill: '#2f4a9e', fop: 0.85, lw: 0.1 }); });
      });
      // dimensions for each block: low and high heights, tilt
      var done = 0;
      order.slice().reverse().forEach(function (b) {
        if (done > 5) return; done++;
        var hmin = 1e9, hmax = -1e9; b.corners.forEach(function (c) { var h = v.h(c); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); });
        var hx2 = hmax + 0.0;
        dimLine(sh, [XH(hx2), Z(b.z0)], [XH(hx2), Z(b.zLow)], 6 + done * 5, fx(b.block.lowH, 2), 2);
        dimLine(sh, [XH(hx2), Z(b.z0)], [XH(hx2), Z(b.zHigh)], 6 + done * 5 + 14, fx(b.zHigh - b.z0, 2), 2);
        sh.text(XH((hmin + hmax) / 2), Z(b.zHigh) + 3.5 + (done - 1) % 3 * 3.6, b.block.name + ' - ' + b.count + ' modules, tilt ' + b.tilt + '°', 2.3, 'TEXT', { a: 'c', col: '#0b1f5c' });
      });
      if (vi === 1 && g.length) {
        var b0 = g.slice().sort(function (a, b) { return b.area - a.area; })[0];
        sh.text(14, base + 5, 'Largest array "' + b0.block.name + '": slope length ' + fx(b0.S, 2) + ' m, plan depth ' + fx(b0.D, 2) + ' m, rise ' + fx(b0.rise, 2) + ' m, tilt ' + b0.tilt + '°, ' + b0.columns.length + ' columns on ' + b0.lineV.length + ' lines, ' + (b0.braced ? 'braced' : 'unbraced (low structure)'), 2.4, 'TEXT');
      }
    });
    return sh;
  }

  /* ---------- SINGLE LINE DIAGRAM ---------- */
  function sldSheet(model, opts) {
    opts = opts || {};
    var cfg = model.cfg, e = model.elec, sh = new Sheet('SLD', 1);
    frame(sh, model, opts.title || 'SINGLE LINE DIAGRAM (PRELIMINARY)', 'NTS', opts.no || 3, opts.total || 3);
    var invs = [], i;
    for (i = 0; i < e.nInv; i++) invs.push({ idx: i, mppts: e.mppts.filter(function (m) { return m.inv === i; }) });
    var rows = 0; invs.forEach(function (v) { rows += Math.max(2, v.mppts.length) + 1; });
    var rowH = Math.min(22, 205 / Math.max(1, rows)), y = 274;
    var xBlock = 12, xDc = 118, xInv = 168, xMcb = 232, xBus = 262, xAcdb = 282;
    sh.text(xBlock, 284, 'PV ARRAYS', 2.6, 'TEXT', { b: true }); sh.text(xDc, 284, 'DC SIDE', 2.6, 'TEXT', { b: true }); sh.text(xInv, 284, 'INVERTER', 2.6, 'TEXT', { b: true }); sh.text(xMcb, 284, 'AC SIDE', 2.6, 'TEXT', { b: true }); sh.text(xAcdb, 284, 'DISTRIBUTION / GRID', 2.6, 'TEXT', { b: true });
    var busTop = y, busBot = y;
    var centers = [];
    invs.forEach(function (v) {
      var n = Math.max(2, v.mppts.length), top = y, h = n * rowH, mid = top - h / 2;
      sh.rect(xInv, top - h, 50, h, 'SLD');
      sh.text(xInv + 25, top - 3.5, 'INVERTER ' + (v.idx + 1), 2.8, 'SLD', { a: 'c', b: true });
      sh.text(xInv + 25, top - 7, cfg.inverter.kw + ' kW, 3Φ AC, ' + cfg.inverter.mpptCount + ' MPPT', 2, 'SLD', { a: 'c' });
      v.mppts.forEach(function (mp, j) {
        var yy = top - (j + 0.5) * rowH - (n > v.mppts.length ? 0 : 0) - 3;
        yy = Math.max(top - h + 3, yy);
        var bw = 92, bh = Math.min(rowH - 2, 11);
        sh.rect(xBlock, yy - bh / 2, bw, bh, 'SLD', { fill: '#eef3ff' });
        sh.text(xBlock + 2, yy + bh / 2 - 3, mp.name + ' - ' + mp.strings.length + ' string' + (mp.strings.length > 1 ? 's' : '') + ' x ' + mp.len + ' modules', 2.1, 'SLD', { b: true });
        sh.text(xBlock + 2, yy - bh / 2 + 1.8, mp.strings.length * mp.len + ' x ' + cfg.module.wp + ' Wp  |  Isc ' + fx(mp.isc, 1) + ' A  |  Voc(cold) ' + fx(mp.len * e.vocCold, 0) + ' V', 1.8, 'SLD', { col: '#444' });
        sh.line(xBlock + bw, yy, xDc, yy, 'SLD_DC');
        sh.text(xBlock + bw + 1, yy + 1, (e.dcCable ? e.dcCable.size : '-') + ' sqmm', 1.6, 'SLD_DC', { col: '#b91c1c' });
        sh.rect(xDc, yy - 2.5, 10, 5, 'SLD'); sh.line(xDc + 2, yy - 1.5, xDc + 8, yy + 1.5, 'SLD'); sh.text(xDc + 5, yy - 5.5, e.fuse + 'A', 1.6, 'SLD', { a: 'c' });
        sh.line(xDc + 10, yy, xInv, yy, 'SLD_DC');
        sh.text(xInv + 2, yy - 0.8, 'MPPT ' + mp.input, 1.9, 'SLD');
      });
      sh.line(xInv + 50, mid, xMcb, mid, 'SLD_AC');
      sh.rect(xMcb, mid - 3, 12, 6, 'SLD'); sh.text(xMcb + 6, mid - 0.7, '4P', 1.8, 'SLD', { a: 'c' }); sh.text(xMcb + 6, mid - 6, e.acBreaker + 'A MCB', 1.7, 'SLD', { a: 'c' });
      sh.line(xMcb + 12, mid, xBus, mid, 'SLD_AC');
      sh.text((xMcb + 12 + xBus) / 2, mid + 1.2, (e.acCable ? e.acCable.size : '-') + ' sqmm 4C ' + cfg.cable.acMat, 1.7, 'SLD_AC', { a: 'c', col: '#1d4ed8' });
      centers.push(mid); y -= h + rowH * 0.8;
    });
    if (centers.length) { sh.line(xBus, Math.max.apply(null, centers), xBus, Math.min.apply(null, centers), 'SLD_AC', { lw: 0.9 }); }
    var my = centers.length ? (Math.max.apply(null, centers) + Math.min.apply(null, centers)) / 2 : 150;
    sh.line(xBus, my, xAcdb, my, 'SLD_AC');
    sh.rect(xAcdb, my - 14, 54, 28, 'SLD', { fill: '#f3f6ff' });
    sh.text(xAcdb + 27, my + 9, 'ACDB', 3, 'SLD', { a: 'c', b: true });
    sh.text(xAcdb + 27, my + 4.5, 'Main MCCB ' + e.mainBreaker + 'A, 4P', 2, 'SLD', { a: 'c' });
    sh.text(xAcdb + 27, my + 0.5, 'AC SPD (Type 2)', 2, 'SLD', { a: 'c' }); sh.text(xAcdb + 27, my - 3.5, 'Busbar ' + fx(e.totalAcAmps * 1.25, 0) + ' A min.', 2, 'SLD', { a: 'c' });
    sh.text(xAcdb + 27, my - 8, 'Feeder ' + (e.feeder ? e.feeder.size : '-') + ' sqmm 4C ' + cfg.cable.acMat, 1.8, 'SLD', { a: 'c', col: '#444' });
    sh.line(xAcdb + 54, my, xAcdb + 64, my, 'SLD_AC'); sh.circle(xAcdb + 70, my, 6, 'SLD'); sh.text(xAcdb + 70, my - 1, 'kWh', 2.4, 'SLD', { a: 'c', b: true }); sh.text(xAcdb + 70, my - 10, 'Net / gen. meter', 1.8, 'SLD', { a: 'c' });
    sh.line(xAcdb + 76, my, xAcdb + 86, my, 'SLD_AC'); sh.rect(xAcdb + 86, my - 9, 22, 18, 'SLD'); sh.text(xAcdb + 97, my + 2, 'LT PANEL', 2.2, 'SLD', { a: 'c', b: true }); sh.text(xAcdb + 97, my - 2.5, '/ GRID', 2.2, 'SLD', { a: 'c', b: true }); sh.text(xAcdb + 97, my - 6.5, '415 V 3Φ 50 Hz', 1.6, 'SLD', { a: 'c' });
    sh.text(xAcdb, my - 22, 'PROTECTION AND EARTHING', 2.5, 'SLD', { b: true });
    ['DC isolator rated at least ' + e.dcIsoV + ' V DC, ' + fx(e.mppts.length ? Math.max.apply(null, e.mppts.map(function (m) { return m.isc * 1.25; })) : 0, 0) + ' A', 'String fuse ' + e.fuse + ' A (1.56 x Isc), DC SPD Type 2', 'Earth pits: ' + e.earthPits + ' (AC, DC and LA)  |  LA rods: ' + e.laRods, 'Module frames and structure bonded with 25x3 GI strip', 'Anti-islanding, RCD and grid protection as per inverter'].forEach(function (t, i) { sh.text(xAcdb, my - 27 - i * 4, t, 2, 'SLD_PE', { col: '#166534' }); });
    sh.line(12, 40, 300, 40, 'SLD_PE', { dash: '3 1.5' }); sh.text(12, 41.5, 'EARTH (PE) BONDING - module frames, structure, inverter, ACDB to earth pits', 1.8, 'SLD_PE', { col: '#166534' });
    return sh;
  }

  /* ---------- 3D SCENE ---------- */
  function seg(a, b, maxLen) {
    var L = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)), n = Math.max(1, Math.ceil(L / maxLen)), out = [];
    for (var i = 0; i < n; i++) { var t0 = i / n, t1 = (i + 1) / n; out.push([[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, a[2] + (b[2] - a[2]) * t1]]); }
    return out;
  }
  function boxFaces(min, max, cols, top) {
    var x0 = min[0], y0 = min[1], z0 = min[2], x1 = max[0], y1 = max[1], z1 = max[2], F = [];
    F.push({ pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], n: [0, -1, 0], fill: cols[0] });
    F.push({ pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], n: [1, 0, 0], fill: cols[1] });
    F.push({ pts: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], n: [0, 1, 0], fill: cols[2] });
    F.push({ pts: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], n: [-1, 0, 0], fill: cols[3] });
    F.push({ pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], n: [0, 0, 1], fill: top, top: true });
    return F;
  }
  function buildScene(model, o) {
    o = o || {};
    var cfg = model.cfg, g = model.geoms, prims = [], minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, zmax = 0;
    cfg.levels.forEach(function (l) { minx = Math.min(minx, l.x); miny = Math.min(miny, l.y); maxx = Math.max(maxx, l.x + l.l); maxy = Math.max(maxy, l.y + l.w); zmax = Math.max(zmax, l.z + cfg.parapet); });
    g.forEach(function (b) { zmax = Math.max(zmax, b.zHigh); minx = Math.min(minx, b.bbox[0]); miny = Math.min(miny, b.bbox[1]); maxx = Math.max(maxx, b.bbox[2]); maxy = Math.max(maxy, b.bbox[3]); });
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, span = Math.max(maxx - minx, maxy - miny, zmax), gm = span * 1.1;
    if (o.ground !== false) {
      prims.push({ k: 'poly', grp: 0, pts: [[cx - gm * 2, cy - gm * 2, 0], [cx + gm * 2, cy - gm * 2, 0], [cx + gm * 2, cy + gm * 2, 0], [cx - gm * 2, cy + gm * 2, 0]], fill: '#5c9e32', stroke: null });
      var pm = 3; prims.push({ k: 'poly', grp: 0, pts: [[minx - pm, miny - pm, 0.02], [maxx + pm, miny - pm, 0.02], [maxx + pm, maxy + pm, 0.02], [minx - pm, maxy + pm, 0.02]], fill: '#c9cdc7', stroke: '#aeb3ab', lw: 0.6 });
    }
    cfg.levels.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) { return a.l.z - b.l.z; }).forEach(function (o2) {
      var l = o2.l, base = 0;
      cfg.levels.forEach(function (q) { if (q !== l && q.z < l.z && q.x <= l.x + 0.01 && q.y <= l.y + 0.01 && q.x + q.l >= l.x + l.l - 0.01 && q.y + q.w >= l.y + l.w - 0.01) base = Math.max(base, q.z); });
      boxFaces([l.x, l.y, base], [l.x + l.l, l.y + l.w, l.z], ['#e0c4a4', '#cfa987', '#c19a78', '#b78f6b'], '#d5d8d3').forEach(function (fc) { prims.push({ k: 'poly', grp: 1, pts: fc.pts, n: fc.n, fill: fc.fill, stroke: '#7a6652', lw: 0.5, ord: l.z + (fc.top ? 0.001 : 0) }); });
      if (cfg.parapet > 0) {
        var t = 0.23, h = cfg.parapet, pb = [[l.x, l.y, l.x + l.l, l.y + t], [l.x, l.y + l.w - t, l.x + l.l, l.y + l.w], [l.x, l.y + t, l.x + t, l.y + l.w - t], [l.x + l.l - t, l.y + t, l.x + l.l, l.y + l.w - t]];
        pb.forEach(function (p) { boxFaces([p[0], p[1], l.z], [p[2], p[3], l.z + h], ['#25262a', '#25262a', '#25262a', '#25262a'], '#16171a').forEach(function (fc) { prims.push({ k: 'poly', grp: 1, pts: fc.pts, n: fc.n, fill: fc.fill, stroke: null, ord: l.z + 0.01 + (fc.top ? 0.001 : 0) }); }); });
      }
    });
    if (o.sun) E.shadowPolys(cfg, g, o.sun.day, o.sun.hour).forEach(function (s) { prims.push({ k: 'poly', grp: 2, pts: s.pts, fill: 'rgba(15,23,42,0.30)', stroke: null }); });
    g.forEach(function (b) {
      if (o.structure !== false) {
        b.foots.forEach(function (ft) {
          var hw = ft.w / 2, hd = ft.d / 2, c = ft.at, ax = b.ux, ay = b.uy, bx = b.vx, by = b.vy, z0 = c[2], z1 = c[2] + ft.h;
          var q = [[c[0] - ax * hw - bx * hd, c[1] - ay * hw - by * hd], [c[0] + ax * hw - bx * hd, c[1] + ay * hw - by * hd], [c[0] + ax * hw + bx * hd, c[1] + ay * hw + by * hd], [c[0] - ax * hw + bx * hd, c[1] - ay * hw + by * hd]];
          for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; prims.push({ k: 'poly', grp: 3, pts: [[q[i][0], q[i][1], z0], [q[j][0], q[j][1], z0], [q[j][0], q[j][1], z1], [q[i][0], q[i][1], z1]], fill: '#9a9a96', stroke: '#6f6f6b', lw: 0.4 }); }
          prims.push({ k: 'poly', grp: 3, pts: q.map(function (p) { return [p[0], p[1], z1]; }), fill: '#b4b4b0', stroke: '#6f6f6b', lw: 0.4 });
        });
        b.members.forEach(function (m) {
          var s = E.section(m.sec), col = m.type === 'col' ? '#f5f5f2' : m.type === 'raf' ? '#e8e8e4' : m.type === 'pur' ? '#d4d8dc' : '#cfcfe8';
          seg(m.a, m.b, 1.5).forEach(function (sg) { prims.push({ k: 'line', grp: 3, a: sg[0], b: sg[1], color: col, edge: '#6b7280', wd: Math.max(s.width, 0.04) }); });
        });
      }
      if (o.modules !== false) {
        b.modules.forEach(function (md) { prims.push({ k: 'poly', grp: 3, pts: md.quad, fill: '#1c2c70', stroke: '#c5cde6', lw: 0.7, grid: true, lift: 0.01 }); });
        if (o.labels !== false) prims.push({ k: 'label', grp: 4, p: [(b.corners[0][0] + b.corners[2][0]) / 2, (b.corners[0][1] + b.corners[2][1]) / 2, (b.zLow + b.zHigh) / 2 + 0.05], text: String(b.count), size: Math.min(1.6, Math.max(0.6, b.W * 0.06)) });
      }
    });
    return { prims: prims, center: [cx, cy, zmax / 3], radius: Math.sqrt(Math.pow(maxx - minx, 2) + Math.pow(maxy - miny, 2) + zmax * zmax) / 2 + 1, bounds: [minx, miny, maxx, maxy, zmax] };
  }
  function frameCam(scene, yaw, pitch, fov, aspect) {
    fov = fov || 35; var r = scene.radius, d = r / Math.sin(fov * R / 2) * (aspect && aspect > 1.2 ? 0.82 : 1.0);
    return { yaw: yaw, pitch: pitch, dist: d, fov: fov, target: scene.center.slice() };
  }
  function camBasis(cam) {
    var yp = cam.yaw * R, pp = cam.pitch * R, t = cam.target;
    var eye = [t[0] + cam.dist * Math.cos(pp) * Math.sin(yp), t[1] + cam.dist * Math.cos(pp) * Math.cos(yp), t[2] + cam.dist * Math.sin(pp)];
    var fw = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]], l = Math.sqrt(fw[0] * fw[0] + fw[1] * fw[1] + fw[2] * fw[2]); fw = fw.map(function (v) { return v / l; });
    var rt = [fw[1] * 1 - fw[2] * 0, fw[2] * 0 - fw[0] * 1, 0], rl = Math.sqrt(rt[0] * rt[0] + rt[1] * rt[1]) || 1; rt = [rt[0] / rl, rt[1] / rl, 0];
    var up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
    return { eye: eye, fw: fw, rt: rt, up: up };
  }
  function projectScene(scene, cam, W, H) {
    var B = camBasis(cam), fpx = (H / 2) / Math.tan(cam.fov * R / 2), out = [];
    function pr(p) { var d = [p[0] - B.eye[0], p[1] - B.eye[1], p[2] - B.eye[2]], z = d[0] * B.fw[0] + d[1] * B.fw[1] + d[2] * B.fw[2]; if (z < 0.3) return null; return [W / 2 + (d[0] * B.rt[0] + d[1] * B.rt[1] + d[2] * B.rt[2]) / z * fpx, H / 2 - (d[0] * B.up[0] + d[1] * B.up[1] + d[2] * B.up[2]) / z * fpx, z]; }
    scene.prims.forEach(function (p) {
      if (p.k === 'poly') {
        if (p.n) { var c = p.pts[0], v = [B.eye[0] - c[0], B.eye[1] - c[1], B.eye[2] - c[2]]; if (v[0] * p.n[0] + v[1] * p.n[1] + v[2] * p.n[2] <= 0) return; }
        var pts = [], zs = 0, ok = true;
        for (var i = 0; i < p.pts.length; i++) { var q = pr(p.pts[i]); if (!q) { ok = false; break; } pts.push(q); zs += q[2]; }
        if (ok) out.push({ p: p, pts: pts, z: zs / pts.length + (p.lift ? -p.lift : 0) });
      } else if (p.k === 'line') {
        var a = pr(p.a), b = pr(p.b); if (a && b) out.push({ p: p, a: a, b: b, z: (a[2] + b[2]) / 2 - 0.05 });
      } else if (p.k === 'label') { var q2 = pr(p.p); if (q2) out.push({ p: p, q: q2, z: q2[2] - 100 }); }
    });
    out.sort(function (a, b) { if (a.p.grp !== b.p.grp) return a.p.grp - b.p.grp; if (a.p.grp === 1) return (a.p.ord || 0) - (b.p.ord || 0); return b.z - a.z; });
    return { list: out, fpx: fpx };
  }
  function renderCanvas(ctx, scene, cam, W, H, opt) {
    opt = opt || {};
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9ec9f0'); sky.addColorStop(0.6, '#dcecf8'); sky.addColorStop(1, '#eef5fb');
    ctx.fillStyle = opt.bg || sky; ctx.fillRect(0, 0, W, H);
    var P = projectScene(scene, cam, W, H), fpx = P.fpx;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    P.list.forEach(function (it) {
      var p = it.p;
      if (p.k === 'poly') {
        ctx.beginPath(); it.pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
        ctx.fillStyle = p.fill; ctx.fill();
        if (p.grid && it.pts.length === 4) {
          var a = it.pts[0], b = it.pts[1], c = it.pts[2], d = it.pts[3], size = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
          if (size > 260) {
            ctx.strokeStyle = 'rgba(160,175,225,0.45)'; ctx.lineWidth = 0.4; ctx.beginPath();
            for (var i = 1; i < 6; i++) { var t = i / 6; ctx.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); ctx.lineTo(d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t); }
            for (var j = 1; j < 10; j++) { var t2 = j / 10; ctx.moveTo(a[0] + (d[0] - a[0]) * t2, a[1] + (d[1] - a[1]) * t2); ctx.lineTo(b[0] + (c[0] - b[0]) * t2, b[1] + (c[1] - b[1]) * t2); }
            ctx.stroke();
          }
        }
        if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.lw || 0.6; ctx.stroke(); }
      } else if (p.k === 'line') {
        var w = Math.max(1.1, Math.min(7, p.wd * fpx / it.z));
        ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]);
        if (w > 2) { ctx.strokeStyle = p.edge; ctx.lineWidth = w + 0.9; ctx.stroke(); ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); }
        ctx.strokeStyle = p.color; ctx.lineWidth = w; ctx.stroke();
      } else if (p.k === 'label') {
        var px = p.size * fpx / it.q[2]; if (px < 9) return;
        ctx.font = '700 ' + px + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = px * 0.12; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(p.text, it.q[0], it.q[1]); ctx.fillStyle = '#fff'; ctx.fillText(p.text, it.q[0], it.q[1]);
      }
    });
    return P;
  }

  /* ---------- 3D DXF ---------- */
  function dxf3d(model) {
    var d = new Dxf(), cfg = model.cfg, scene = buildScene(model, { ground: false });
    LAYERS.PV_MODULE_3D = ['#1e3a8a', 5, 0.1]; LAYERS.BUILDING_3D = ['#cfa987', 2, 0.1]; LAYERS.FOUNDATION_3D = ['#78716c', 9, 0.1]; LAYERS.PARAPET_3D = ['#222222', 7, 0.1];
    cfg.levels.forEach(function (l, i) {
      var base = 0; cfg.levels.forEach(function (q) { if (q !== l && q.z < l.z && q.x <= l.x + 0.01 && q.y <= l.y + 0.01 && q.x + q.l >= l.x + l.l - 0.01 && q.y + q.w >= l.y + l.w - 0.01) base = Math.max(base, q.z); });
      boxFaces([l.x, l.y, base], [l.x + l.l, l.y + l.w, l.z], ['', '', '', ''], '').forEach(function (fc) { d.face('BUILDING_3D', fc.pts); });
      if (cfg.parapet > 0) { var t = 0.23, h = cfg.parapet; [[l.x, l.y, l.x + l.l, l.y + t], [l.x, l.y + l.w - t, l.x + l.l, l.y + l.w], [l.x, l.y + t, l.x + t, l.y + l.w - t], [l.x + l.l - t, l.y + t, l.x + l.l, l.y + l.w - t]].forEach(function (p) { boxFaces([p[0], p[1], l.z], [p[2], p[3], l.z + h], ['', '', '', ''], '').forEach(function (fc) { d.face('PARAPET_3D', fc.pts); }); }); }
    });
    model.geoms.forEach(function (b) {
      b.modules.forEach(function (md) { d.face('PV_MODULE_3D', md.quad); });
      b.foots.forEach(function (ft) {
        var hw = ft.w / 2, hd = ft.d / 2, c = ft.at; boxFaces([c[0] - hw, c[1] - hd, c[2]], [c[0] + hw, c[1] + hd, c[2] + ft.h], ['', '', '', ''], '').forEach(function (fc) { d.face('FOUNDATION_3D', fc.pts); });
      });
      b.members.forEach(function (m) { d.line(m.type === 'col' ? 'STRUCT_COLUMN' : m.type === 'raf' ? 'STRUCT_RAFTER' : m.type === 'pur' ? 'STRUCT_PURLIN' : 'STRUCT_BRACE', m.a, m.b); });
      d.text('TEXT', [(b.corners[0][0] + b.corners[2][0]) / 2, (b.corners[0][1] + b.corners[2][1]) / 2, b.zHigh + 0.3], 0.6, b.block.name + ' - ' + b.count + ' modules', 0, 'c');
    });
    return d.toString();
  }

  /* ---------- ZIP (store) ---------- */
  var CRC = (function () { var t = [], c, i, k; for (i = 0; i < 256; i++) { c = i; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function toU8(d) { if (d instanceof Uint8Array) return d; if (typeof d === 'string') return new TextEncoder().encode(d); return new Uint8Array(d); }
  function zip(files) {
    var parts = [], central = [], offset = 0, enc = new TextEncoder();
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (fl) {
      var data = toU8(fl.data), name = enc.encode(fl.name), crc = crc32(data);
      var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push({ name: name, crc: crc, size: data.length, off: offset });
      offset += head.length + name.length + data.length;
    });
    var cstart = offset, csize = 0;
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      parts.push(new Uint8Array(h), c.name); csize += h.length + c.name.length;
    });
    parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(csize), u32(cstart), u16(0))));
    return parts;
  }

  return { planSheet: planSheet, elevationSheet: elevationSheet, sldSheet: sldSheet, buildScene: buildScene, frameCam: frameCam, projectScene: projectScene, renderCanvas: renderCanvas, dxf3d: dxf3d, zip: zip, crc32: crc32, Sheet: Sheet, esc: esc, LAYERS: LAYERS };
});
