/* GenSolar CAD Studio - design engine (pure calculations and 3D geometry, no DOM).
   Coordinates: x = east, y = north, z = up, metres. Azimuth: degrees clockwise from north (180 = faces south).
   All outputs are PRELIMINARY design values and must be verified by a qualified engineer before construction. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GSCadEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var R = Math.PI / 180;

  /* ---------- section catalogue ---------- */
  var PIPES = { '40NB': [48.3, 3.25], '50NB': [60.3, 3.65], '65NB': [76.1, 3.65], '80NB': [88.9, 4.05], '100NB': [114.3, 4.5], '125NB': [139.7, 4.8] };
  var COLUMN_OPTIONS = ['50NB', '65NB', '80NB', '100NB', '125NB', 'RHS 80x80x3', 'RHS 100x100x3'];
  var RAFTER_OPTIONS = ['40NB', '50NB', '65NB', 'RHS 60x40x2.5', 'RHS 80x40x3', 'RHS 100x50x3', 'RHS 120x60x4'];
  var PURLIN_OPTIONS = ['RHS 40x40x2', 'RHS 60x40x2', 'RHS 80x40x2.5', 'C 75x40x2', 'C 100x50x2'];
  var BRACE_OPTIONS = ['L 40x40x4', 'L 50x50x5', '40NB', '25NB'];
  PIPES['25NB'] = [33.4, 3.25];

  function section(name) {
    name = String(name || '').trim();
    var m;
    if (PIPES[name]) { var od = PIPES[name][0], t = PIPES[name][1]; return { name: name, kind: 'pipe', depth: od / 1000, width: od / 1000, kgm: Math.PI * t * (od - t) * 7850e-6 }; }
    if ((m = /^RHS\s*(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(name))) {
      var b = +m[1], h = +m[2], tt = +m[3];
      return { name: name, kind: 'rhs', depth: Math.max(b, h) / 1000, width: Math.min(b, h) / 1000, kgm: 2 * tt * (b + h - 2 * tt) * 7850e-6 };
    }
    if ((m = /^C\s*(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(name))) {
      var hh = +m[1], ff = +m[2], t3 = +m[3];
      return { name: name, kind: 'channel', depth: hh / 1000, width: ff / 1000, kgm: t3 * (hh + 2 * ff - 2 * t3) * 7850e-6 };
    }
    if ((m = /^L\s*(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(name))) {
      var a1 = +m[1], a2 = +m[2], t4 = +m[3];
      return { name: name, kind: 'angle', depth: a1 / 1000, width: a2 / 1000, kgm: t4 * (a1 + a2 - t4) * 7850e-6 };
    }
    return { name: name || 'RHS 60x40x2', kind: 'rhs', depth: 0.06, width: 0.04, kgm: 2.1 };
  }

  /* ---------- defaults ---------- */
  function defaults() {
    return {
      project: 'Rooftop Solar Project', client: '', address: '', preparedBy: '', drawingNo: 'GS-001', revision: 'R0',
      lat: 17.385, lon: 78.4867,
      climate: { tMin: 8, tMax: 42, kt: 0.55, pr: 0.78, albedo: 0.2, windVb: 44, terrain: 2, k1: 1.0, k3: 1.0, k2: 0, cp: 1.3, sunAlt: 0 },
      module: { mfr: 'Mono PERC 550 Wp', wp: 550, w: 1.134, l: 2.278, thick: 0.035, kg: 28.5, voc: 49.9, vmp: 41.8, isc: 13.9, imp: 13.16, tcVoc: -0.25, tcVmp: -0.30 },
      inverter: { mfr: '3-phase string inverter', kw: 50, maxDc: 1100, mpptMin: 200, mpptMax: 1000, mpptCount: 6, stringsPerMppt: 2, maxIscMppt: 40, maxDcAc: 1.4, qty: 0, pf: 1 },
      levels: [{ name: 'Main roof', x: 0, y: 0, l: 20, w: 14, z: 12 }],
      parapet: 0.9, setback: 0.6, walkway: 0.8,
      blocks: [],
      structure: { column: '80NB', rafter: 'RHS 80x40x3', purlin: 'RHS 60x40x2', brace: 'L 40x40x4', footW: 0.4, footD: 0.4, footH: 0.45, colSpacing: 3, bracing: true },
      cable: { dcRun: 40, acRun: 30, dcMat: 'Cu', acMat: 'Al', dcDrop: 1, acDrop: 2 },
      auto: { target: 30, rows: 2, orient: 'portrait', tilt: 15, lowH: 0.6, azimuth: 180, colSpacing: 3 }
    };
  }
  function n(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
  function merge(base, over) {
    var out = JSON.parse(JSON.stringify(base));
    (function rec(t, s) {
      if (!s) return;
      Object.keys(s).forEach(function (k) {
        if (Array.isArray(s[k])) t[k] = JSON.parse(JSON.stringify(s[k]));
        else if (s[k] && typeof s[k] === 'object' && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) rec(t[k], s[k]);
        else if (s[k] !== undefined) t[k] = s[k];
      });
    })(out, over);
    return out;
  }
  function normalize(cfg) {
    var c = merge(defaults(), cfg || {});
    c.lat = n(c.lat, 17.385); c.lon = n(c.lon, 78.4867);
    c.levels = (c.levels || []).map(function (l, i) { return { name: l.name || 'Level ' + (i + 1), x: n(l.x, 0), y: n(l.y, 0), l: Math.max(0.5, n(l.l, 10)), w: Math.max(0.5, n(l.w, 10)), z: Math.max(0, n(l.z, 3)) }; });
    if (!c.levels.length) c.levels = defaults().levels;
    c.blocks = (c.blocks || []).map(function (b, i) {
      return {
        id: b.id || 'B' + (i + 1), name: b.name || 'Array ' + (i + 1), level: Math.min(c.levels.length - 1, Math.max(0, Math.round(n(b.level, 0)))),
        x: n(b.x, 0), y: n(b.y, 0), cols: Math.max(1, Math.round(n(b.cols, 1))), rows: Math.max(1, Math.round(n(b.rows, 1))),
        orient: b.orient === 'landscape' ? 'landscape' : 'portrait', tilt: Math.min(60, Math.max(0, n(b.tilt, 15))),
        lowH: Math.max(0.1, n(b.lowH, 0.6)), azimuth: ((n(b.azimuth, 180) % 360) + 360) % 360, colSpacing: Math.max(1, n(b.colSpacing, c.structure.colSpacing)),
        trim: Math.max(0, Math.round(n(b.trim, 0)))
      };
    });
    ['wp', 'w', 'l', 'thick', 'kg', 'voc', 'vmp', 'isc', 'imp', 'tcVoc', 'tcVmp'].forEach(function (k) { c.module[k] = n(c.module[k], defaults().module[k]); });
    ['kw', 'maxDc', 'mpptMin', 'mpptMax', 'mpptCount', 'stringsPerMppt', 'maxIscMppt', 'maxDcAc', 'qty', 'pf'].forEach(function (k) { c.inverter[k] = n(c.inverter[k], defaults().inverter[k]); });
    ['tMin', 'tMax', 'kt', 'pr', 'albedo', 'windVb', 'terrain', 'k1', 'k3', 'k2', 'cp', 'sunAlt'].forEach(function (k) { c.climate[k] = n(c.climate[k], defaults().climate[k]); });
    ['footW', 'footD', 'footH', 'colSpacing'].forEach(function (k) { c.structure[k] = n(c.structure[k], defaults().structure[k]); });
    ['dcRun', 'acRun', 'dcDrop', 'acDrop'].forEach(function (k) { c.cable[k] = n(c.cable[k], defaults().cable[k]); });
    c.parapet = Math.max(0, n(c.parapet, 0.9)); c.setback = Math.max(0, n(c.setback, 0.6)); c.walkway = Math.max(0, n(c.walkway, 0.8));
    return c;
  }

  /* ---------- solar position and irradiation ---------- */
  function declination(day) { return 23.45 * Math.sin(R * 360 * (284 + day) / 365); }
  function solarPos(lat, day, hour) {
    var d = declination(day) * R, ph = lat * R, w = 15 * (hour - 12) * R;
    var sa = Math.sin(ph) * Math.sin(d) + Math.cos(ph) * Math.cos(d) * Math.cos(w);
    var alt = Math.asin(Math.max(-1, Math.min(1, sa)));
    var ca = Math.cos(alt);
    var az = 0;
    if (ca > 1e-6) {
      var cz = (Math.sin(d) * Math.cos(ph) - Math.cos(d) * Math.sin(ph) * Math.cos(w)) / ca;
      az = Math.acos(Math.max(-1, Math.min(1, cz))) / R;
      if (w > 0) az = 360 - az;
    }
    return { alt: alt / R, az: az };
  }
  function sunVec(p) { var a = p.alt * R, g = p.az * R; return [Math.cos(a) * Math.sin(g), Math.cos(a) * Math.cos(g), Math.sin(a)]; }
  var MID_DAYS = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
  var MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var MNAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthlyYield(cfg, kwp, shadeLoss) {
    var ph = cfg.lat * R, kt = cfg.climate.kt, beta = 0, az = 180, tilt = 15;
    var tilts = cfg.blocks.length ? cfg.blocks : [{ tilt: 15, azimuth: 180, cols: 1, rows: 1 }];
    var wsum = 0, tsum = 0, asum = 0;
    tilts.forEach(function (b) { var wt = b.cols * b.rows; wsum += wt; tsum += b.tilt * wt; asum += b.azimuth * wt; });
    tilt = tsum / wsum; az = asum / wsum; beta = tilt * R;
    var dev = Math.abs(az - 180);
    var azF = 1 - (1 - Math.cos(Math.min(90, dev) * R)) * 0.22;
    var out = [], total = 0, ghi = 0;
    for (var m = 0; m < 12; m++) {
      var day = MID_DAYS[m], d = declination(day) * R;
      var ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(ph) * Math.tan(d))));
      var H0 = (24 / Math.PI) * 1.367 * (1 + 0.033 * Math.cos(R * 360 * day / 365)) * (Math.cos(ph) * Math.cos(d) * Math.sin(ws) + ws * Math.sin(ph) * Math.sin(d));
      var H = kt * H0, kd = Math.max(0.12, Math.min(1, 1 - 1.13 * kt));
      var phb = ph - beta, wsT = Math.min(ws, Math.acos(Math.max(-1, Math.min(1, -Math.tan(phb) * Math.tan(d)))));
      var Rb = (Math.cos(phb) * Math.cos(d) * Math.sin(wsT) + wsT * Math.sin(phb) * Math.sin(d)) / (Math.cos(ph) * Math.cos(d) * Math.sin(ws) + ws * Math.sin(ph) * Math.sin(d));
      Rb = Math.max(0, Rb);
      var Ht = H * ((1 - kd) * Rb * azF + kd * (1 + Math.cos(beta)) / 2 + cfg.climate.albedo * (1 - Math.cos(beta)) / 2);
      var kwh = kwp * Ht * MDAYS[m] * cfg.climate.pr * (1 - (shadeLoss || 0));
      out.push({ m: MNAMES[m], ghi: H, poa: Ht, kwh: kwh });
      total += kwh; ghi += H * MDAYS[m];
    }
    return { months: out, annual: total, specific: kwp > 0 ? total / kwp : 0, ghiAnnual: ghi, tilt: tilt, azimuth: az };
  }

  /* ---------- geometry ---------- */
  function moduleDims(cfg, b) {
    var m = cfg.module;
    return b.orient === 'portrait' ? { a: m.w, s: m.l } : { a: m.l, s: m.w };
  }
  function blockGeom(cfg, b, idx) {
    var d = moduleDims(cfg, b), t = b.tilt * R, gap = 0.02, gapS = 0.02;
    var lvl = cfg.levels[b.level] || cfg.levels[0], z0 = lvl.z, st = cfg.structure;
    var W = b.cols * d.a + (b.cols - 1) * gap;
    var S = b.rows * d.s + (b.rows - 1) * gapS;
    var D = S * Math.cos(t), rise = S * Math.sin(t);
    var az = b.azimuth * R;
    var vx = -Math.sin(az), vy = -Math.cos(az); // up-slope direction (horizontal)
    var ux = vy, uy = -vx;
    var zBase = z0 + b.lowH;
    function w(u, v, z) { return [b.x + u * ux + v * vx, b.y + u * uy + v * vy, z]; }
    function zAt(v) { return zBase + v * Math.tan(t); }
    var g = { idx: idx, block: b, W: W, S: S, D: D, rise: rise, z0: z0, zLow: zBase, zHigh: zBase + rise, ux: ux, uy: uy, vx: vx, vy: vy, a: d.a, s: d.s, gap: gap, gapS: gapS, tilt: b.tilt, w: w, zAt: zAt };
    var total = b.cols * b.rows - b.trim;
    g.count = Math.max(0, total);
    g.modules = [];
    var k = 0;
    for (var r = 0; r < b.rows && k < g.count; r++) {
      for (var c = 0; c < b.cols && k < g.count; c++) {
        var u0 = c * (d.a + gap), u1 = u0 + d.a, s0 = r * (d.s + gapS), s1 = s0 + d.s;
        var v0 = s0 * Math.cos(t), v1 = s1 * Math.cos(t);
        var q = [w(u0, v0, zAt(v0)), w(u1, v0, zAt(v0)), w(u1, v1, zAt(v1)), w(u0, v1, zAt(v1))];
        g.modules.push({ c: c, r: r, quad: q, center: [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2] });
        k++;
      }
    }
    // structure
    var pur = section(st.purlin), raf = section(st.rafter), col = section(st.column);
    var dp = pur.depth, dr = raf.depth;
    var lines = S > 5.2 ? [0.12, 0.5, 0.88] : [0.14, 0.86];
    var inset = Math.min(0.35, W * 0.1), nb = Math.max(1, Math.ceil((W - 2 * inset) / b.colSpacing));
    g.lineV = lines.map(function (f) { return f * D; });
    g.colU = []; for (var i = 0; i <= nb; i++) g.colU.push(inset + i * (W - 2 * inset) / nb);
    g.members = []; g.columns = []; g.foots = [];
    var baseZ = z0 + st.footH;
    g.colU.forEach(function (u, iu) {
      g.lineV.forEach(function (v, il) {
        var top = zAt(v) - dp - dr;
        var p0 = w(u, v, baseZ), p1 = w(u, v, top);
        var len = Math.max(0.2, top - baseZ);
        g.columns.push({ u: u, v: v, iu: iu, il: il, base: p0, top: p1, len: len });
        g.members.push({ type: 'col', sec: st.column, a: p0, b: p1, block: idx });
        g.foots.push({ at: w(u, v, z0), w: st.footW, d: st.footD, h: st.footH, ux: ux, uy: uy });
      });
      g.members.push({ type: 'raf', sec: st.rafter, a: w(u, 0, zAt(0) - dp - dr / 2), b: w(u, D, zAt(D) - dp - dr / 2), block: idx });
    });
    for (var r2 = 0; r2 < b.rows; r2++) {
      [0.25, 0.75].forEach(function (f) {
        var sp = r2 * (d.s + gapS) + f * d.s, v = sp * Math.cos(t);
        g.members.push({ type: 'pur', sec: st.purlin, a: w(0, v, zAt(v) - dp / 2), b: w(W, v, zAt(v) - dp / 2), block: idx });
      });
    }
    var minColH = 1e9; g.columns.forEach(function (c2) { minColH = Math.min(minColH, c2.len); });
    g.maxColLen = 0; g.columns.forEach(function (c2) { g.maxColLen = Math.max(g.maxColLen, c2.len); });
    g.braced = !!st.bracing && g.maxColLen > 0.9;
    if (g.braced) {
      g.lineV.forEach(function (v, il) {
        for (var bi = 0; bi < nb; bi += 2) {
          var ca = g.columns.filter(function (cc) { return cc.il === il && cc.iu === bi; })[0], cb = g.columns.filter(function (cc) { return cc.il === il && cc.iu === bi + 1; })[0];
          if (ca && cb) g.members.push({ type: 'brc', sec: st.brace, a: ca.base, b: [cb.top[0], cb.top[1], cb.top[2] - Math.min(0.4, cb.len * 0.3)], block: idx });
        }
      });
      for (var il2 = 0; il2 < g.lineV.length - 1; il2++) {
        [0, nb].concat(nb > 4 ? [Math.round(nb / 2)] : []).forEach(function (iu) {
          var ca = g.columns.filter(function (cc) { return cc.il === il2 && cc.iu === iu; })[0], cb = g.columns.filter(function (cc) { return cc.il === il2 + 1 && cc.iu === iu; })[0];
          if (ca && cb) g.members.push({ type: 'brc', sec: st.brace, a: ca.base, b: [cb.top[0], cb.top[1], cb.top[2] - Math.min(0.4, cb.len * 0.3)], block: idx });
        });
      }
    }
    g.members.forEach(function (m) { m.len = dist3(m.a, m.b); });
    // footprint corners (plan)
    g.corners = [w(0, 0, z0), w(W, 0, z0), w(W, D, z0), w(0, D, z0)];
    var xs = g.corners.map(function (p) { return p[0]; }), ys = g.corners.map(function (p) { return p[1]; });
    g.bbox = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    g.area = g.count * d.a * d.s;
    return g;
  }
  function dist3(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }

  /* ---------- electrical ---------- */
  var STD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800];
  var STD_FUSES = [10, 12, 15, 16, 20, 25, 30, 32];
  var CABLE_SIZES = [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  var AMP_CU = { 4: 52, 6: 67, 10: 93, 16: 125, 25: 165, 35: 205, 50: 250, 70: 315, 95: 380, 120: 435, 150: 495, 185: 560, 240: 650 };
  var AMP_AL = { 16: 92, 25: 122, 35: 150, 50: 182, 70: 228, 95: 275, 120: 318, 150: 360, 185: 405, 240: 470, 4: 0, 6: 0, 10: 0 };
  function pick(list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return list[list.length - 1]; }
  function rho(mat) { return mat === 'Al' ? 0.0366 : 0.0225; } // ohm.mm2/m at ~70 C
  function sizeCable(mat, amps, runM, volts, phases, maxDropPct, derate) {
    var tbl = mat === 'Al' ? AMP_AL : AMP_CU, res = null;
    for (var i = 0; i < CABLE_SIZES.length; i++) {
      var s = CABLE_SIZES[i]; if (!tbl[s]) continue;
      var cap = tbl[s] * (derate || 0.7);
      var drop = phases === 3 ? Math.sqrt(3) * amps * runM * rho(mat) / s : 2 * amps * runM * rho(mat) / s;
      var pct = volts > 0 ? drop / volts * 100 : 0;
      if (cap >= amps && pct <= maxDropPct) { res = { size: s, capacity: cap, dropV: drop, dropPct: pct, ok: true }; break; }
      res = { size: s, capacity: cap, dropV: drop, dropPct: pct, ok: false };
    }
    return res;
  }
  function stringLengths(M, nmin, nmax) {
    if (M <= 0 || nmax < 1) return [];
    var S = Math.ceil(M / nmax), base = Math.floor(M / S), extra = M - base * S, out = [];
    for (var i = 0; i < S; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }
  function electrical(cfg, geoms) {
    var m = cfg.module, inv = cfg.inverter, cl = cfg.climate, warns = [];
    var vocCold = m.voc * (1 + (m.tcVoc / 100) * (cl.tMin - 25));
    var cellHot = cl.tMax + 30;
    var vmpHot = m.vmp * (1 + (m.tcVmp / 100) * (cellHot - 25));
    var nmax = Math.floor(inv.maxDc / vocCold), nmin = Math.ceil(inv.mpptMin / vmpHot);
    if (nmax > Math.floor(inv.mpptMax / m.vmp * 1.0) + 8) { /* informational only */ }
    var totalModules = 0; geoms.forEach(function (g) { totalModules += g.count; });
    var dcKw = totalModules * m.wp / 1000;
    var strings = [], groups = [];
    geoms.forEach(function (g) {
      var lens = stringLengths(g.count, nmin, nmax);
      lens.forEach(function (L, i) { strings.push({ block: g.idx, name: g.block.name, len: L, no: strings.length + 1 }); });
      if (lens.length && Math.min.apply(null, lens) < nmin) warns.push(g.block.name + ': ' + g.count + ' modules cannot form strings of at least ' + nmin + ' (inverter MPPT minimum). Combine arrays or change inverter.');
      if (nmax < 1) warns.push('Cold-corrected Voc exceeds inverter maximum DC voltage.');
    });
    // MPPT grouping: strings of the same array and equal length share an MPPT input
    var mppts = [];
    geoms.forEach(function (g) {
      var mine = strings.filter(function (s) { return s.block === g.idx; });
      var byLen = {}; mine.forEach(function (s) { (byLen[s.len] = byLen[s.len] || []).push(s); });
      Object.keys(byLen).sort(function (a, b) { return b - a; }).forEach(function (len) {
        var arr = byLen[len];
        for (var i = 0; i < arr.length; i += inv.stringsPerMppt) mppts.push({ block: g.idx, name: g.block.name, len: +len, strings: arr.slice(i, i + inv.stringsPerMppt) });
      });
    });
    var byCap = Math.ceil(dcKw / (inv.kw * inv.maxDcAc) - 1e-9), byMppt = Math.ceil(mppts.length / Math.max(1, inv.mpptCount));
    var nInv = Math.max(1, inv.qty > 0 ? inv.qty : Math.max(byCap, byMppt), byMppt);
    if (inv.qty > 0 && inv.qty < byMppt) warns.push('Chosen inverter quantity is too small for the number of MPPT inputs required (' + byMppt + ').');
    mppts.forEach(function (mp, i) { mp.inv = Math.floor(i / Math.max(1, inv.mpptCount)); mp.input = (i % Math.max(1, inv.mpptCount)) + 1; });
    var acKw = nInv * inv.kw, ratio = acKw > 0 ? dcKw / acKw : 0;
    if (ratio > inv.maxDcAc) warns.push('DC/AC ratio ' + ratio.toFixed(2) + ' is above the inverter limit of ' + inv.maxDcAc + '.');
    if (ratio < 0.9 && dcKw > 0) warns.push('DC/AC ratio ' + ratio.toFixed(2) + ' is low; the inverter is oversized for this array.');
    mppts.forEach(function (mp) { var isc = mp.strings.length * m.isc * 1.0; mp.isc = isc; if (isc > inv.maxIscMppt) warns.push('MPPT ' + (mp.inv + 1) + '.' + mp.input + ' short-circuit current ' + isc.toFixed(1) + ' A exceeds ' + inv.maxIscMppt + ' A.'); });
    var strVoc = nmax * vocCold / (nmax || 1);
    var maxStr = strings.length ? Math.max.apply(null, strings.map(function (s) { return s.len; })) : 0;
    var maxStrVocCold = maxStr * vocCold, minStr = strings.length ? Math.min.apply(null, strings.map(function (s) { return s.len; })) : 0;
    var minStrVmpHot = minStr * vmpHot, maxStrVmp = maxStr * m.vmp;
    if (maxStrVocCold > inv.maxDc) warns.push('Longest string cold Voc ' + maxStrVocCold.toFixed(0) + ' V exceeds inverter maximum ' + inv.maxDc + ' V.');
    if (minStr && minStrVmpHot < inv.mpptMin) warns.push('Shortest string hot Vmp ' + minStrVmpHot.toFixed(0) + ' V is below the MPPT minimum ' + inv.mpptMin + ' V.');
    if (maxStrVmp > inv.mpptMax) warns.push('Longest string Vmp ' + maxStrVmp.toFixed(0) + ' V exceeds the MPPT window maximum ' + inv.mpptMax + ' V.');
    var dcMat = cfg.cable.dcMat, stringIsc = m.isc * 1.25;
    var dcCable = sizeCable(dcMat, stringIsc, cfg.cable.dcRun, maxStr * m.vmp, 1, cfg.cable.dcDrop, 0.7);
    var invAmps = inv.kw * 1000 / (Math.sqrt(3) * 415 * Math.max(0.8, inv.pf));
    var acCable = sizeCable(cfg.cable.acMat, invAmps * 1.25, cfg.cable.acRun, 415, 3, cfg.cable.acDrop, 0.8);
    var totalAcAmps = acKw * 1000 / (Math.sqrt(3) * 415 * Math.max(0.8, inv.pf));
    var feeder = sizeCable(cfg.cable.acMat, totalAcAmps * 1.25, cfg.cable.acRun, 415, 3, cfg.cable.acDrop, 0.8);
    var fuse = pick(STD_FUSES, 1.56 * m.isc);
    var acBreaker = pick(STD_BREAKERS, invAmps * 1.25), mainBreaker = pick(STD_BREAKERS, totalAcAmps * 1.25);
    var dcIsoV = Math.ceil(maxStrVocCold * 1.1 / 50) * 50;
    var span = 0; geoms.forEach(function (g) { span = Math.max(span, g.W); });
    var laRods = Math.max(2, Math.ceil(span / 20));
    var earthPits = 2 + 1 + laRods;
    var dcCableLen = (strings.length * cfg.cable.dcRun * 2) * 1.1;
    var acCableLen = nInv * cfg.cable.acRun * 1.1;
    return {
      vocCold: vocCold, vmpHot: vmpHot, nmax: nmax, nmin: nmin, totalModules: totalModules, dcKw: dcKw, acKw: acKw, ratio: ratio, nInv: nInv,
      strings: strings, mppts: mppts, maxStr: maxStr, minStr: minStr, maxStrVocCold: maxStrVocCold, minStrVmpHot: minStrVmpHot, maxStrVmp: maxStrVmp,
      dcCable: dcCable, acCable: acCable, feeder: feeder, invAmps: invAmps, totalAcAmps: totalAcAmps, fuse: fuse, acBreaker: acBreaker, mainBreaker: mainBreaker, dcIsoV: dcIsoV,
      laRods: laRods, earthPits: earthPits, dcCableLen: dcCableLen, acCableLen: acCableLen, warnings: warns
    };
  }

  /* ---------- wind (IS 875 Part 3 style screening) ---------- */
  function k2Of(h, terrain) {
    var T = { 1: [1.05, 1.09, 1.12, 1.15, 1.20], 2: [1.00, 1.05, 1.07, 1.12, 1.17], 3: [0.91, 0.97, 1.01, 1.06, 1.12], 4: [0.80, 0.80, 0.80, 0.97, 1.10] };
    var H = [10, 15, 20, 30, 50], row = T[Math.max(1, Math.min(4, Math.round(terrain)))] || T[2];
    if (h <= H[0]) return row[0];
    for (var i = 1; i < H.length; i++) if (h <= H[i]) return row[i - 1] + (row[i] - row[i - 1]) * (h - H[i - 1]) / (H[i] - H[i - 1]);
    return row[row.length - 1];
  }
  function wind(cfg, geoms) {
    var cl = cfg.climate, out = [], maxZ = 0;
    geoms.forEach(function (g) { maxZ = Math.max(maxZ, g.zHigh); });
    var k2 = cl.k2 > 0 ? cl.k2 : k2Of(Math.max(10, maxZ), cl.terrain);
    var Vz = cl.windVb * cl.k1 * k2 * cl.k3, pz = 0.6 * Vz * Vz, p = pz * cl.cp;
    var res = { Vz: Vz, k2: k2, pz: pz, p: p, blocks: [] };
    geoms.forEach(function (g) {
      var t = g.tilt * R, area = g.area, F = p * area, up = F * Math.cos(t), hor = F * Math.sin(t);
      var dead = (g.count * cfg.module.kg + g.members.reduce(function (s, mm) { return s + mm.len * section(mm.sec).kgm; }, 0)) * 9.81;
      var nCol = g.columns.length, net = Math.max(0, up - 0.9 * dead), perCol = nCol ? net / nCol : 0;
      var anchors = 4, maxPerCol = nCol ? up / nCol : 0;
      res.blocks.push({ block: g.block.name, area: area, force: F / 1000, uplift: up / 1000, horizontal: hor / 1000, dead: dead / 1000, netUplift: net / 1000, perColumn: perCol / 1000, perColumnGross: maxPerCol / 1000, perAnchor: perCol / anchors / 1000, columns: nCol });
    });
    return res;
  }

  /* ---------- shading ---------- */
  function levelBoxes(cfg) {
    var boxes = [];
    cfg.levels.forEach(function (l, i) {
      boxes.push({ lvl: i, min: [l.x, l.y, 0], max: [l.x + l.l, l.y + l.w, l.z] });
      var t = 0.23, h = cfg.parapet; if (h <= 0) return;
      boxes.push({ lvl: i, parapet: true, min: [l.x, l.y, l.z], max: [l.x + l.l, l.y + t, l.z + h] });
      boxes.push({ lvl: i, parapet: true, min: [l.x, l.y + l.w - t, l.z], max: [l.x + l.l, l.y + l.w, l.z + h] });
      boxes.push({ lvl: i, parapet: true, min: [l.x, l.y + t, l.z], max: [l.x + t, l.y + l.w - t, l.z + h] });
      boxes.push({ lvl: i, parapet: true, min: [l.x + l.l - t, l.y + t, l.z], max: [l.x + l.l, l.y + l.w - t, l.z + h] });
    });
    return boxes;
  }
  function rayBox(o, d, b) {
    var t0 = 1e-4, t1 = 1e9;
    for (var i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < b.min[i] || o[i] > b.max[i]) return false; }
      else {
        var a = (b.min[i] - o[i]) / d[i], c = (b.max[i] - o[i]) / d[i];
        if (a > c) { var tmp = a; a = c; c = tmp; }
        if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false;
      }
    }
    return true;
  }
  function blockHit(g, o, d) {
    var tn = Math.tan(g.tilt * R);
    // plane: z = zLow + tn * v, with v = horizontal distance along up-slope axis from block origin
    var b = g.block, ox = o[0] - b.x, oy = o[1] - b.y;
    var ov = ox * g.vx + oy * g.vy, dv = d[0] * g.vx + d[1] * g.vy;
    var ou = ox * g.ux + oy * g.uy, du = d[0] * g.ux + d[1] * g.uy;
    var den = d[2] - tn * dv;
    if (Math.abs(den) < 1e-9) return false;
    var t = (g.zLow + tn * ov - o[2]) / den;
    if (t <= 1e-4) return false;
    var u = ou + du * t, v = ov + dv * t;
    return u >= 0 && u <= g.W && v >= 0 && v <= g.D;
  }
  function shading(cfg, geoms, dates) {
    var boxes = levelBoxes(cfg);
    var res = [];
    (dates || [{ name: 'Winter solstice (21 Dec)', day: 355 }, { name: 'Equinox (21 Mar)', day: 80 }, { name: 'Summer solstice (21 Jun)', day: 172 }]).forEach(function (dt) {
      var rowD = { name: dt.name, day: dt.day, blocks: [] };
      geoms.forEach(function (g) {
        var lost = 0, tot = 0;
        for (var h = 9; h <= 15.001; h += 0.5) {
          var sp = solarPos(cfg.lat, dt.day, h); if (sp.alt < 5) continue;
          var sv = sunVec(sp), wgt = Math.sin(sp.alt * R);
          g.modules.forEach(function (md) {
            var o = [md.center[0] + 0.02 * 0, md.center[1], md.center[2] + 0.03];
            var hit = false;
            for (var i = 0; i < boxes.length && !hit; i++) { if (boxes[i].lvl === g.block.level && !boxes[i].parapet) continue; hit = rayBox(o, sv, boxes[i]); }
            for (var j = 0; j < geoms.length && !hit; j++) { if (j === g.idx) continue; hit = blockHit(geoms[j], o, sv); }
            tot += wgt; if (hit) lost += wgt;
          });
        }
        rowD.blocks.push({ block: g.block.name, loss: tot > 0 ? lost / tot : 0 });
      });
      res.push(rowD);
    });
    return res;
  }
  function shadowPolys(cfg, geoms, day, hour) {
    var sp = solarPos(cfg.lat, day, hour); if (sp.alt < 3) return [];
    var sv = sunVec(sp), out = [];
    geoms.forEach(function (g) {
      var z0 = g.z0 + 0.02, pts = [];
      var corners = [g.w(0, 0, g.zLow), g.w(g.W, 0, g.zLow), g.w(g.W, g.D, g.zHigh), g.w(0, g.D, g.zHigh)];
      corners.forEach(function (c) { var t = (c[2] - z0) / sv[2]; pts.push([c[0] - sv[0] * t, c[1] - sv[1] * t, z0]); });
      out.push({ pts: pts, block: g.idx });
    });
    return out;
  }

  /* ---------- BOM ---------- */
  function bom(cfg, geoms, elec) {
    var items = [], st = cfg.structure;
    var secMap = {};
    var totalMods = 0, footings = 0, endClamps = 0, midClamps = 0, splices = 0, braces = 0;
    geoms.forEach(function (g) {
      totalMods += g.count; footings += g.foots.length;
      endClamps += g.block.rows * 4; midClamps += g.block.rows * 2 * Math.max(0, g.block.cols - 1);
      g.members.forEach(function (m) {
        var k = m.type + '|' + m.sec; secMap[k] = secMap[k] || { type: m.type, sec: m.sec, len: 0, pcs: 0 };
        secMap[k].len += m.len; secMap[k].pcs++;
        if (m.type === 'pur') splices += Math.max(0, Math.ceil(m.len / 6) - 1);
        if (m.type === 'brc') braces++;
      });
    });
    var names = { col: 'Column', raf: 'Main rafter', pur: 'Purlin', brc: 'Bracing' };
    var steel = 0;
    Object.keys(secMap).forEach(function (k) {
      var s = secMap[k], sec = section(s.sec), kg = s.len * sec.kgm; steel += kg;
      items.push({ cat: 'Structure', item: names[s.type] + ' - ' + s.sec, qty: Math.round(s.len * 10) / 10, unit: 'm', note: s.pcs + ' members, ' + Math.ceil(s.len * 1.05 / 6) + ' x 6 m stock lengths, ' + kg.toFixed(0) + ' kg' });
    });
    items.unshift({ cat: 'PV', item: 'PV modules ' + cfg.module.wp + ' Wp (' + cfg.module.w + ' x ' + cfg.module.l + ' m)', qty: totalMods, unit: 'Nos', note: (totalMods * cfg.module.wp / 1000).toFixed(2) + ' kWp' });
    items.push({ cat: 'Structure', item: 'Concrete pedestal footing ' + (st.footW * 1000) + ' x ' + (st.footD * 1000) + ' x ' + (st.footH * 1000) + ' mm', qty: footings, unit: 'Nos', note: (footings * st.footW * st.footD * st.footH).toFixed(2) + ' m3 concrete' });
    items.push({ cat: 'Structure', item: 'Base plate with chemical / foundation anchors (4 per footing)', qty: footings * 4, unit: 'Nos', note: 'Size per structural design' });
    items.push({ cat: 'Structure', item: 'Module end clamps', qty: endClamps, unit: 'Nos', note: '' });
    items.push({ cat: 'Structure', item: 'Module mid clamps', qty: midClamps, unit: 'Nos', note: '' });
    items.push({ cat: 'Structure', item: 'Purlin splice plates', qty: splices * 2, unit: 'Nos', note: '6 m stock length' });
    items.push({ cat: 'Structure', item: 'Nut-bolt / hardware set (SS304)', qty: Math.ceil(totalMods * 4 + footings * 8 + braces * 4), unit: 'Nos', note: 'Allowance' });
    items.push({ cat: 'Structure', item: 'Total fabricated steel (GI / HDG)', qty: Math.round(steel), unit: 'kg', note: 'Before 5% wastage' });
    var e = elec;
    items.push({ cat: 'Electrical', item: 'String inverter ' + cfg.inverter.kw + ' kW, ' + cfg.inverter.mpptCount + ' MPPT', qty: e.nInv, unit: 'Nos', note: 'DC/AC ' + e.ratio.toFixed(2) });
    items.push({ cat: 'Electrical', item: 'DC solar cable ' + (e.dcCable ? e.dcCable.size : '-') + ' sq.mm ' + cfg.cable.dcMat + ' (UV, XLPO, 1.5 kV DC)', qty: Math.round(e.dcCableLen), unit: 'm', note: e.strings.length + ' strings, pair' });
    items.push({ cat: 'Electrical', item: 'AC cable ' + (e.acCable ? e.acCable.size : '-') + ' sq.mm 4C ' + cfg.cable.acMat + ' armoured', qty: Math.round(e.acCableLen), unit: 'm', note: 'Inverter to ACDB' });
    if (e.nInv > 1) items.push({ cat: 'Electrical', item: 'AC feeder ' + (e.feeder ? e.feeder.size : '-') + ' sq.mm 4C ' + cfg.cable.acMat + ' armoured', qty: Math.round(cfg.cable.acRun * 1.1), unit: 'm', note: 'ACDB to main LT panel' });
    items.push({ cat: 'Electrical', item: 'MC4 connector pairs', qty: e.strings.length * 2 + 4, unit: 'Pairs', note: '' });
    items.push({ cat: 'Electrical', item: 'DCDB / string combiner with ' + e.fuse + ' A fuses, DC SPD', qty: e.nInv, unit: 'Nos', note: 'Isolator >= ' + e.dcIsoV + ' V DC' });
    items.push({ cat: 'Electrical', item: 'AC MCB / MCCB ' + e.acBreaker + ' A (per inverter)', qty: e.nInv, unit: 'Nos', note: '4P' });
    items.push({ cat: 'Electrical', item: 'ACDB with ' + e.mainBreaker + ' A main MCCB, AC SPD, meter', qty: 1, unit: 'Nos', note: '' });
    items.push({ cat: 'Safety', item: 'Earthing pits (chemical / GI)', qty: e.earthPits, unit: 'Nos', note: 'AC, DC and LA earth pits' });
    items.push({ cat: 'Safety', item: 'Lightning arrester (ESE / Franklin rod) with down conductor', qty: e.laRods, unit: 'Nos', note: 'Indicative; risk assessment per IEC 62305' });
    items.push({ cat: 'Safety', item: 'GI earthing strip 25x3 mm (module frames, structure, equipment)', qty: Math.round(e.earthPits * 12 + geoms.reduce(function (s, g) { return s + g.W * 2; }, 0)), unit: 'm', note: 'Allowance' });
    items.push({ cat: 'Monitoring', item: 'Data logger / Wi-Fi dongle and energy meter', qty: e.nInv, unit: 'Nos', note: '' });
    return { items: items, steelKg: steel };
  }

  /* ---------- auto layout ---------- */
  function autoLayout(cfgIn) {
    var cfg = normalize(cfgIn), a = cfg.auto, m = cfg.module, blocks = [], remaining = Math.ceil(a.target * 1000 / m.wp);
    var tilt = a.tilt * R, portrait = a.orient !== 'landscape', across = portrait ? m.w : m.l, slope = portrait ? m.l : m.w;
    var sunAlt = cfg.climate.sunAlt > 0 ? cfg.climate.sunAlt : solarPos(cfg.lat, 355, 9.5).alt;
    var S = a.rows * slope + (a.rows - 1) * 0.02, D = S * Math.cos(tilt), rise = S * Math.sin(tilt);
    var shadow = rise / Math.tan(Math.max(8, sunAlt) * R), pitch = D + shadow;
    var order = cfg.levels.map(function (l, i) { return i; }).sort(function (p, q) { return cfg.levels[q].l * cfg.levels[q].w - cfg.levels[p].l * cfg.levels[p].w; });
    var par = cfg.parapet > 0 ? 0.23 : 0, sb = Math.max(cfg.setback, par + 0.3);
    order.forEach(function (li) {
      if (remaining <= 0) return;
      var lv = cfg.levels[li], ux = lv.x + sb, uy = lv.y + sb, uw = lv.l - 2 * sb, ul = lv.w - 2 * sb - cfg.walkway;
      if (uw < across || ul < D) return;
      var cols = Math.floor((uw + 0.02) / (across + 0.02)); if (cols < 1) return;
      var nT = Math.max(0, Math.floor((ul - D) / pitch) + 1);
      for (var t = 0; t < nT && remaining > 0; t++) {
        var need = Math.ceil(remaining / a.rows), c = Math.min(cols, need), total = c * a.rows, trim = 0;
        if (total > remaining) { trim = total - remaining; total = remaining; }
        blocks.push({ id: 'T' + (blocks.length + 1), name: 'Array ' + (blocks.length + 1), level: li, x: ux, y: uy + cfg.walkway + t * pitch, cols: c, rows: a.rows, orient: a.orient, tilt: a.tilt, lowH: a.lowH, azimuth: a.azimuth, colSpacing: a.colSpacing, trim: trim });
        remaining -= total;
      }
    });
    return { blocks: blocks, unplaced: Math.max(0, remaining), pitch: pitch, shadow: shadow };
  }

  var INV_SIZES = [{ kw: 3, mppt: 2 }, { kw: 5, mppt: 2 }, { kw: 8, mppt: 2 }, { kw: 10, mppt: 2 }, { kw: 15, mppt: 2 }, { kw: 20, mppt: 2 }, { kw: 25, mppt: 3 }, { kw: 30, mppt: 3 }, { kw: 40, mppt: 4 }, { kw: 50, mppt: 6 }, { kw: 60, mppt: 6 }, { kw: 80, mppt: 8 }, { kw: 100, mppt: 10 }, { kw: 110, mppt: 10 }, { kw: 125, mppt: 12 }];
  function suggestInverter(dcKw) {
    var pickInv = INV_SIZES[INV_SIZES.length - 1], count = 1;
    for (var i = 0; i < INV_SIZES.length; i++) if (dcKw / INV_SIZES[i].kw <= 1.25) { pickInv = INV_SIZES[i]; break; }
    if (dcKw / pickInv.kw > 1.25) count = Math.ceil(dcKw / (pickInv.kw * 1.2));
    return { kw: pickInv.kw, mppt: pickInv.mppt, qty: count };
  }

  /* ---------- full model ---------- */
  function checks(cfg, geoms) {
    var w = [];
    geoms.forEach(function (g) {
      var lv = cfg.levels[g.block.level];
      g.corners.forEach(function (c, i) { if (c[0] < lv.x - 0.01 || c[0] > lv.x + lv.l + 0.01 || c[1] < lv.y - 0.01 || c[1] > lv.y + lv.w + 0.01) { if (!g._out) { w.push(g.block.name + ' extends beyond the edge of "' + lv.name + '". Cantilevers over the roof edge need structural approval.'); g._out = true; } } });
      if (g.block.lowH < 0.3) w.push(g.block.name + ': module lower edge is under 300 mm above the roof; check water drainage and cleaning access.');
    });
    for (var i = 0; i < geoms.length; i++) for (var j = i + 1; j < geoms.length; j++) {
      var a = geoms[i], b = geoms[j]; if (a.block.level !== b.block.level) continue;
      if (a.bbox[0] < b.bbox[2] - 0.01 && a.bbox[2] > b.bbox[0] + 0.01 && a.bbox[1] < b.bbox[3] - 0.01 && a.bbox[3] > b.bbox[1] + 0.01 && Math.abs(a.block.azimuth - b.block.azimuth) < 0.5)
        w.push(a.block.name + ' and ' + b.block.name + ' overlap in plan.');
    }
    return w;
  }
  function build(cfgIn) {
    var cfg = normalize(cfgIn), geoms = cfg.blocks.map(function (b, i) { return blockGeom(cfg, b, i); });
    var elec = electrical(cfg, geoms), wd = wind(cfg, geoms), sh = shading(cfg, geoms);
    var shadeAvg = 0, cnt = 0;
    sh.forEach(function (d) { d.blocks.forEach(function (b, i) { shadeAvg += b.loss * geoms[i].count; cnt += geoms[i].count; }); });
    shadeAvg = cnt ? shadeAvg / cnt : 0;
    var shadeLoss = Math.min(0.5, shadeAvg * 0.7);
    var y = monthlyYield(cfg, elec.dcKw, shadeLoss);
    var b = bom(cfg, geoms, elec);
    var warnings = [].concat(checks(cfg, geoms), elec.warnings);
    if (!geoms.length) warnings.push('No arrays defined yet. Use Auto layout or add an array.');
    if (shadeAvg > 0.05) warnings.push('Estimated shading on the 9:00-15:00 window averages ' + (shadeAvg * 100).toFixed(1) + '%. Review array spacing or obstructions.');
    var area = 0; geoms.forEach(function (g) { area += g.area; });
    var steelKg = b.steelKg;
    return { cfg: cfg, geoms: geoms, elec: elec, wind: wd, shading: sh, shadeLoss: shadeLoss, yield: y, bom: b, warnings: warnings, totals: { modules: elec.totalModules, kwp: elec.dcKw, area: area, steelKg: steelKg, footings: geoms.reduce(function (s, g) { return s + g.foots.length; }, 0), annualKwh: y.annual } };
  }

  return { defaults: defaults, normalize: normalize, merge: merge, build: build, autoLayout: autoLayout, suggestInverter: suggestInverter, section: section, solarPos: solarPos, sunVec: sunVec, shadowPolys: shadowPolys, monthlyYield: monthlyYield, blockGeom: blockGeom, electrical: electrical, wind: wind, shading: shading, levelBoxes: levelBoxes, k2Of: k2Of,
    options: { column: COLUMN_OPTIONS, rafter: RAFTER_OPTIONS, purlin: PURLIN_OPTIONS, brace: BRACE_OPTIONS }, MNAMES: MNAMES };
});
