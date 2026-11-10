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
  const W = { h:12,parapet:1,terrain:'2',roofType:'RCC roof',Vb:44,k1:1,k2:1,k3:1,k4:1,Kd:.9,Ka:1,Kc:1,cUpF:1,cUpE:1.5,cDn:.8,modKg:27.5,strKn:.1,llKn:.5,nPur:2,fy:250,lim:180,pType:'RHS',pb:50,ph:100,pt:3,rType:'RHS',rb:50,rh:120,rt:4,nb:4,tcap:40,vcap:30 };
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
  await page.evaluate(() => { window.print = () => { window.__printed = 1; }; });
  await page.locator('#epca2_print').click(); await page.waitForTimeout(500);
  check(await page.evaluate(() => !!window.__printed && document.querySelectorAll('#printSheet .ep-page').length >= 8), 'Print builds the drawing sheets');
  // Fabricator box-pipe sections (100x100x2 columns and rafters, 60x40x2 purlins, 50x50x2 braces): thin-wall effective width, no slender fail
  await page.evaluate(() => {
    const set = (pre, o) => Object.keys(o).forEach(k => { const e = document.getElementById(pre + k); e.value = o[k]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    set('epcw_', { cUpF:.4, cUpE:.55, cDn:.4, rType:'RHS', rb:100, rh:100, rt:2, pType:'RHS', pb:40, ph:60, pt:2 });
    set('epca2_', { colType:'RHS', colB:100, colH:100, colT:2, brcType:'RHS', brcB:50, brcH:50, brcT:2 });
  });
  await page.waitForTimeout(1200);
  const thinTxt = await page.locator('#epca2_out').innerText();
  check(!/section is slender/i.test(thinTxt) && /Thin-wall box sections/.test(thinTxt) && /PASSES/.test(thinTxt), 'Thin-wall box sections use effective width, are not rejected as slender, and the block passes');
  const st = await page.evaluate(() => window.EPCAnalysis.status().state);
  console.log('analysis state:', st);
  if (st === 'pass') check((await page.locator('#epc_tabs [data-t="draw"]').getAttribute('data-locked')) === null, 'Drawings unlock when the analysis passes');
  else check((await page.locator('#epc_tabs [data-t="draw"]').getAttribute('data-locked')) === '1', 'Drawings stay locked when the analysis fails');
  check(errors.length === 0, 'No uncaught JavaScript errors: ' + (errors.join(' | ') || 'none'));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
if (failures.length) { console.error('\nFAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('\nAll EPC analysis smoke checks passed.');
