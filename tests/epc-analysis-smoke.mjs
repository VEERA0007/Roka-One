import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, normalize, sep } from 'node:path';

const root = resolve('gensolar-android-project/gensolar-android/app/src/main/assets');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.css':'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, '.' + normalize(p === '/' ? '/index.html' : p));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(4181, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const failures = []; const check = (c, m) => { if (!c) failures.push(m); else console.log('PASS:', m); };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:4181/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.exploreGuest(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(el => { el.hidden = true; }); document.getElementById('view-engineering').hidden = false; });
  check(await page.locator('#epc_tabs [data-t="analysis"]').count() === 1 && await page.locator('#epca2').count() === 1, 'Analysis tab is mounted in Engineering');
  check((await page.locator('#epc_tabs [data-t="analysis"]').getAttribute('data-locked')) === '1', 'Analysis is locked until Site and Wind inputs exist');
  await page.locator('#engSite').fill('Analysis test'); await page.locator('#engLat').fill('17.385'); await page.locator('#engLon').fill('78.4867');
  await page.locator('#engCapacity').fill('21.26'); await page.locator('#engRoof').fill('2500'); await page.waitForTimeout(500);
  const W = { h:12,parapet:1,terrain:'2',roofType:'RCC roof',Vb:44,k1:1,k2:1,k3:1,k4:1,Kd:.9,Ka:1,Kc:1,cUpF:1,cUpE:1.5,cDn:.8,cLong:0.05,modKg:27.5,strKn:.1,llKn:.5,nPur:2,fy:250,lim:180,pType:'RHS',pb:50,ph:100,pt:3,rType:'RHS',rb:50,rh:120,rt:4,nb:4,tcap:40,vcap:30 };
  await page.evaluate(w => { Object.keys(w).forEach(k => { const e = document.getElementById('epcw_' + k); e.value = w[k]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    const c = document.getElementById('epcw_survey'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }, W);
  await page.waitForTimeout(800);
  check((await page.locator('#epc_tabs [data-t="analysis"]').getAttribute('data-locked')) === null, 'Analysis unlocks once Wind & Structure inputs are complete');
  check((await page.locator('#epc_tabs [data-t="draw"]').getAttribute('data-locked')) === '1', 'Drawings stay locked until the analysis is done');
  await page.locator('#epc_tabs [data-t="analysis"]').click();
  check(await page.locator('#epc_p-analysis').isVisible(), 'Analysis tab opens');
  check((await page.locator('#epca2_out').innerText()).includes('Not analysed yet'), 'Analysis asks for the missing inputs first');
  const A = { colType:'CHS',colB:114.3,colT:4.5,brcType:'CHS',brcB:76.1,brcT:3.6,base:'Pinned',K:1,bclass:'b' };
  await page.evaluate(a => { Object.keys(a).forEach(k => { const e = document.getElementById('epca2_' + k); e.value = a[k]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); }, A);
  await page.waitForTimeout(900);
  const txt = await page.locator('#epca2_out').innerText();
  console.log(txt.slice(0, 400).replace(/\n+/g, ' | '));
  check(!txt.includes('Not analysed yet'), 'Analysis runs once the required inputs are entered');
  check(await page.locator('#epca2_svg svg').count() === 1, '3D view is drawn');
  const before = await page.locator('#epca2_svg').innerHTML();
  await page.locator('[data-rot="20"]').click();
  check((await page.locator('#epca2_svg').innerHTML()) !== before, 'Rotating changes the 3D view');
  for (const m of ['geom','defl','my','mz','vz','n','util']) { await page.selectOption('#epca2_mode', m); check(await page.locator('#epca2_svg svg polyline').count() > 10, 'Mode draws members: ' + m); }
  if (process.env.SHOT_DIR) { await page.selectOption('#epca2_mode','util'); await page.locator('#epca2_svg').screenshot({ path: process.env.SHOT_DIR + '/3d.png' }); }
  await page.locator('[data-av="frame"]').click();
  if (process.env.SHOT_DIR) { await page.selectOption('#epca2_mode','my'); await page.selectOption('#epca2_combo','1.5DL+1.5WL(down)'); await page.locator('#epca2_svg').screenshot({ path: process.env.SHOT_DIR + '/frame_my.png' }); await page.selectOption('#epca2_mode','defl'); await page.locator('#epca2_svg').screenshot({ path: process.env.SHOT_DIR + '/frame_defl.png' }); } check(await page.locator('#epca2_frame').count() === 1 && await page.locator('#epca2_svg svg polyline').count() > 3, '2D frame view');
  await page.locator('[data-av="plan"]').click(); check(await page.locator('#epca2_svg svg polyline').count() > 10, '2D plan view');
  await page.screenshot({ path: process.env.SHOT || '/tmp/an_plan.png', fullPage: false });
  const pages = await page.evaluate(() => window.EPCAnalysis.drawings().length);
  check(pages >= 8, 'Drawing sheets are generated: ' + pages);
  const info = await page.evaluate(() => { const d = window.EPCAnalysis.drawings(), n = window.EPCAnalysis.runs().filter(Boolean).length; const names = {}; d.forEach(x => { names[x.block] = (names[x.block] || 0) + 1; }); return { n, names, total: d.length, last: d[d.length - 1].html }; });
  const counts = Object.values(info.names);
  check(Object.keys(info.names).length === info.n && counts.every(c => c >= 8), 'Drawings cover every analysed block with a full set of sheets each: ' + JSON.stringify(info.names));
  check(info.last.includes('Sheet ' + info.total + ' of ' + info.total), 'Sheets are numbered through the whole set');
  await page.evaluate(() => { window.print = () => { window.__printed = 1; }; });
  await page.locator('#epca2_print').click(); await page.waitForTimeout(500);
  check(await page.evaluate(() => !!window.__printed && document.querySelectorAll('#printSheet .ep-page').length >= 8), 'Print builds the drawing sheets');
  // Fabricator box-pipe sections (100x100x2 columns and rafters, 60x40x2 purlins, 50x50x2 braces): thin-wall effective width, no slender fail
  await page.evaluate(() => {
    const set = (pre, o) => Object.keys(o).forEach(k => { const e = document.getElementById(pre + k); e.value = o[k]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    set('epcw_', { cUpF:.4, cUpE:.55, cDn:.4,cLong:0.05, rType:'RHS', rb:100, rh:100, rt:2, pType:'RHS', pb:40, ph:60, pt:2 });
    set('epca2_', { colType:'RHS', colB:100, colH:100, colT:2, brcType:'RHS', brcB:50, brcH:50, brcT:2 });
  });
  await page.waitForTimeout(1200);
  const thinTxt = await page.locator('#epca2_out').innerText();
  check(!/section is slender/i.test(thinTxt) && /Thin-wall box sections/.test(thinTxt) && /PASSES/.test(thinTxt), 'Thin-wall box sections use effective width, are not rejected as slender, and the block passes');
  const st = await page.evaluate(() => window.EPCAnalysis.status().state);
  console.log('analysis state:', st);
  if (st === 'pass') check((await page.locator('#epc_tabs [data-t="draw"]').getAttribute('data-locked')) === null, 'Drawings unlock when the analysis passes');
  else check((await page.locator('#epc_tabs [data-t="draw"]').getAttribute('data-locked')) === '1', 'Drawings stay locked when the analysis fails');
  const p2 = await page.evaluate(() => { const r = window.EPCAnalysis.result(); return r && r.p2 ? { amp: r.p2.amp, err: r.p2.errors.length, n: Object.keys(r.cres2).length } : null; });
  check(p2 && p2.n === 8 && p2.err === 0 && p2.amp >= 1 && p2.amp < 1.5, 'Second-order (P-Δ) results exist for all eight ultimate combinations: ' + JSON.stringify(p2));
  check((await page.locator('#epca2_out').innerText()).includes('Second-order (P-Δ) analysis of the eight ultimate combinations'), 'The Analysis tab reports the P-Δ amplification');
  check(await page.locator('#epca2_out [data-std]').count() === 3, 'One STAAD download button per block');
  await page.locator('#epca2_out [data-std]').first().click();
  const std = await page.evaluate(() => window.__lastStd);
  check(std && /\.std$/.test(std.name) && /^STAAD SPACE /.test(std.text) && /SET Z UP/.test(std.text) && /PERFORM ANALYSIS\nFINISH\n$/.test(std.text) && (std.text.match(/LOAD COMBINATION/g) || []).length === 13, 'STAAD file is generated for the block: ' + (std && std.name));
  // ---- Fabrication BOM, built from the analysed pieces ----
  check(st === 'pass', 'Analysis passes for every block before the BOM checks');
  check((await page.locator('#epc_tabs [data-t="bom"]').getAttribute('data-locked')) === null, 'BOM unlocks when the analysis passes for every block');
  await page.locator('#epc_tabs [data-t="bom"]').click(); await page.waitForTimeout(500);
  check(await page.locator('#epc_p-bom').isVisible() && await page.locator('#epcb').count() === 1, 'BOM tab opens with the fabrication BOM');
  check(await page.evaluate(() => document.getElementById('epc_p-bom').firstElementChild.id === 'epcb'), 'Fabrication BOM sits above the Layout cut list');
  const nTab = await page.locator('#epcb_out table.epcb-t').count();
  check(nTab === 4, 'One table per block plus the walkway: ' + nTab);
  const title0 = await page.evaluate(() => window.EPCBom.compute().title);
  check(title0 === 'R0_36.18_BOM_ANALYSIS TEST', 'BOM title is in the fabricator format (revision, total kWp, name): ' + title0);
  const cmp = await page.evaluate(() => {
    const bom = window.EPCBom.compute();
    const lay = [...document.querySelectorAll('#epc_cutTbl tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim().replace(/,/g, '')));
    const map = { 'Rafter':'RAFTER', 'Purlin':'PURLIN', 'Diagonal brace':'BRACING 1 (DIAGONAL)', 'Column tie (across)':'BRACING 2 (COLUMN TIE)' };
    let n = 0; const bad = [];
    lay.forEach(r => {
      if (r[0] === 'Walkway') return;
      const blk = bom.blocks.find(b => b.name === r[0]); if (!blk) { bad.push('no block ' + r[0]); return; }
      const want = /^Column \d+$/.test(r[1]) ? 'COLUMN ' + r[1].split(' ')[1] : map[r[1]], row = blk.rows.find(x => x.desc === want);
      if (!row) { bad.push(r[0] + ' ' + r[1] + ' missing'); return; }
      n++; if (row.qty !== +r[2] || row.len !== +r[3]) bad.push(r[0] + ' ' + r[1] + ': BOM ' + row.qty + ' x ' + row.len + ' vs Layout ' + r[2] + ' x ' + r[3]);
    });
    const wk = lay.filter(r => r[0] === 'Walkway'), sup = wk.find(r => /U-support/.test(r[1])), run = wk.find(r => /walkway$/.test(r[1]));
    return { n, bad, blocks: bom.blocks.length, walk: bom.walk && { sup: bom.walk.sup, L: bom.walk.L }, laySup: sup && +sup[2], layRun: run && +run[3] };
  });
  console.log('BOM pieces compared with the Layout cut list:', cmp.n, cmp.bad.join('; '));
  check(cmp.bad.length === 0 && cmp.n >= 20 && cmp.blocks === 3, 'Every BOM piece (' + cmp.n + ') has the same quantity and length as the Layout cut list');
  check(cmp.walk && cmp.walk.sup === cmp.laySup && cmp.walk.L === cmp.layRun, 'Walkway supports and run agree with the Layout: ' + JSON.stringify(cmp));
  const bomTxt = await page.locator('#epcb_out').innerText();
  check(/PRELIMINARY, NOT APPROVED/.test(bomTxt) && /Base plate 150 × 150 × 5 mm is the size in your reference BOM/.test(bomTxt), 'BOM says it is preliminary and flags the assumed base plate size');
  check(/Braces and ties follow the Analysis assumptions: brace top at 0.75 of the tallest column, ties at 0.6/.test(bomTxt), 'BOM states the brace and tie positions used (ties at 0.6)');
  check(/MODULES STRUCTURE DETAILS \(MAIN FRONT\)/.test(bomTxt) && /WALKWAY DETAILS/.test(bomTxt) && /NOTE : PLEASE KEEP SOME EXTRA MATERIAL/.test(bomTxt), 'Tables carry the fabricator headings and the 10% note');
  const tot0 = await page.evaluate(() => window.EPCBom.compute().total), cols = await page.evaluate(() => window.EPCBom.compute().blocks.reduce((a, b) => a + b.cols, 0));
  await page.locator('#epcb_plT').fill('6'); await page.waitForTimeout(400);
  const tot1 = await page.evaluate(() => window.EPCBom.compute().total);
  check(Math.abs((tot1 - tot0) - cols * 150 * 150 * 1 * 7.85e-6) < 1e-6, 'Base plate thickness 5 to 6 mm adds ' + (tot1 - tot0).toFixed(3) + ' kg for ' + cols + ' plates');
  check(!/is the size in your reference BOM/.test(await page.locator('#epcb_out').innerText()), 'The assumed-plate note goes once the plate size is edited');
  await page.locator('#epcb_plW').fill(''); await page.waitForTimeout(400);
  const noPl = await page.evaluate(() => ({ plates: window.EPCBom.compute().blocks.map(b => !!b.plate), txt: document.getElementById('epcb_out').innerText }));
  check(noPl.plates.every(x => !x) && /base plate size is missing or invalid/.test(noPl.txt) && !/BASE PLATE/.test(noPl.txt), 'A missing base plate size removes the plate rows and says so');
  await page.locator('#epcb_plW').fill('150'); await page.waitForTimeout(400);
  await page.locator('#epcb_rev').fill('R1'); await page.locator('#epcb_mat').fill('GI'); await page.waitForTimeout(400);
  check((await page.evaluate(() => window.EPCBom.compute().title)).startsWith('R1_36.18_BOM_') && (await page.locator('#epcb_out table.epcb-t').first().innerText()).includes('GI'), 'Revision and material fields change the BOM');
  const csv = await page.evaluate(() => ({ csv: window.EPCBom.csv(), total: window.EPCBom.compute().total }));
  const last = csv.csv.split('\n').pop().split(',');
  check(csv.csv.split('\n')[0].startsWith('Block,Sr. No.,Parts Name') && Math.abs(parseFloat(last.pop()) - csv.total) < 0.006, 'CSV carries the project total weight');
  await page.evaluate(() => { window.print = () => { window.__printed2 = 1; }; });
  await page.locator('#epcb_print').click(); await page.waitForFunction(() => !!window.__printed2, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300);
  check(await page.evaluate(() => !!window.__printed2 && document.querySelectorAll('#printSheet .ep-page').length === 4 && document.querySelectorAll('#printSheet .ep-page table.epcb-t').length === 4), 'Print builds one sheet per table');
  if (process.env.SHOT_DIR) { await page.locator('#epcb_out').screenshot({ path: process.env.SHOT_DIR + '/bom.png' }); }
  // One failing block must fail the whole analysis and keep BOM and Drawings locked, even when the block on screen passes
  await page.evaluate(() => { const b = document.getElementById('epca2_blk'); b.value = '2'; b.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => { const e = document.getElementById('epc_bl0'); e.value = '12000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1500);
  const g2 = await page.evaluate(() => { const a = window.EPCAnalysis.status(), t = id => document.querySelector('#epc_tabs [data-t="' + id + '"]').getAttribute('data-locked'); return { state: a.state, fails: (a.fails || []).join(' | '), blocks: (a.blocks || []).map(b => b.name + ':' + b.state).join(', '), bom: t('bom'), draw: t('draw'), shown: window.EPCAnalysis.result().c.b.name }; });
  console.log('one tall block:', JSON.stringify(g2).slice(0, 400));
  check(g2.state === 'fail' && /Main front/.test(g2.fails) && /Tower roof:pass/.test(g2.blocks), 'A failing block fails the whole analysis (' + g2.blocks + ')');
  check(g2.shown === 'Tower roof' && g2.bom === '1' && g2.draw === '1', 'BOM and Drawings lock while any block fails, although the block on screen (' + g2.shown + ') passes');
  await page.evaluate(() => { const e = document.getElementById('epc_bl0'); e.value = '1590'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => window.EPCAnalysis.status().state)) === 'pass' && (await page.locator('#epc_tabs [data-t="bom"]').getAttribute('data-locked')) === null, 'Everything unlocks again once every block passes');
  // Column tie default is the drawn 0.6; a 0.75 saved by the old default is replaced once, a 0.75 saved after this revision is kept
  for (const [rev, want] of [[undefined, '0.6'], [2, '0.75']]) {
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p2.addInitScript(r => { const o = { colB: '114.3', tieFrac: '0.75' }; if (r) o._rev = r; localStorage.setItem('gs_epc_analysis_v1', JSON.stringify({ '(unnamed)': o, 'Dr Sudhir': o })); }, rev);
    await p2.goto('http://127.0.0.1:4181/', { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1800);
    await p2.evaluate(() => { window.exploreGuest(); }); await p2.waitForTimeout(300);
    const v = await p2.locator('#epca2_tieFrac').inputValue();
    check(v === want, 'Saved tie height 0.75 ' + (rev ? 'with revision ' + rev + ' is kept' : 'from the old default is replaced') + ': ' + v);
    if (!rev) check(/0\.6 of the column height/.test(await p2.locator('label:has(#epca2_tieFrac)').innerText()), 'Tie height hint says the Layout draws 0.6');
    await p2.close();
  }
  check(errors.length === 0, 'No uncaught JavaScript errors: ' + (errors.join(' | ') || 'none'));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
if (failures.length) { console.error('\nFAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('\nAll EPC analysis smoke checks passed.');
