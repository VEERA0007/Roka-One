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
await new Promise(r => server.listen(4184, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const failures = []; const check = (c, m) => { if (!c) failures.push(m); else console.log('PASS:', m); };
const setv = (page, sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message));
  const lat = 17.385, lon = 78.4867, kx = 1 / (111412.84 * Math.cos(lat * Math.PI / 180) - 93.5 * Math.cos(3 * lat * Math.PI / 180)), ky = 1 / (111132.92 - 559.82 * Math.cos(2 * lat * Math.PI / 180) + 1.175 * Math.cos(4 * lat * Math.PI / 180));
  const ring = [[-10, -6], [10, -6], [10, 6], [-10, 6], [-10, -6]].map(p => ({ lat: lat + p[1] * ky, lon: lon + p[0] * kx }));
  await page.route('**/overpass-api.de/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [{ type: 'way', id: 7, tags: { building: 'yes', 'building:levels': '4' }, geometry: ring }] }) }));
  await page.goto('http://127.0.0.1:4184/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.exploreGuest(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(el => { el.hidden = true; }); document.getElementById('view-engineering').hidden = false; });
  await page.waitForTimeout(800);
  check(await page.locator('#epc_p-design').isVisible() && !(await page.locator('#epc_p-site').isVisible()), 'Guided mode opens on the Design page');
  check(!(await page.locator('#epc_tabs [data-t="site"]').isVisible()) && !(await page.locator('#epc_tabs [data-t="wind"]').isVisible()) && await page.locator('#epc_tabs [data-t="bom"]').isVisible(), 'Detail tabs are hidden, results tabs stay');
  await page.locator('#epcd_go').click(); await page.waitForTimeout(300);
  check((await page.locator('#epcd_msg').innerText()).includes('Still needed'), 'Auto-design names what is still needed');
  const fill = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  await fill('epcd_name', 'Guided test'); await fill('epcd_lat', '17.385'); await fill('epcd_lon', '78.4867'); await fill('epcd_kw', '10'); await fill('epcd_wp', '550'); await fill('epcd_ml', '2278'); await fill('epcd_mw', '1134'); await fill('epcd_mkg', '27.5'); await fill('epcd_h', '');
  await page.locator('#epcd_roof').click(); await page.waitForFunction(() => /ESTIMATE/.test(document.getElementById('epcd_msg').textContent), null, { timeout: 8000 });
  const area = await page.evaluate(() => +document.getElementById('epcd_roofSqft').value), hh = await page.evaluate(() => document.getElementById('epcd_h').value);
  check(Math.abs(area - (240 - 64) * 10.7639) < 6 && hh === '12.8', 'Roof outline from the map fills the usable area (' + area + ' sq ft) and the height (' + hh + ' m)');
  await page.locator('#epcd_go').click();
  await page.waitForFunction(() => /ESTIMATED DESIGN|NO STANDARD/.test(document.getElementById('epcd_out').textContent), null, { timeout: 120000 });
  const out = await page.locator('#epcd_out').innerText();
  check(out.includes('ESTIMATED DESIGN PASSES') && out.includes('estimate: confirm') && out.includes('auto-sized'), 'Auto-design finds a passing set and labels estimates: ' + out.split('\n').slice(0, 2).join(' | '));
  const v = await page.evaluate(() => ({ tilt: document.getElementById('engTilt').value, vb: document.getElementById('epcw_Vb').value, site: document.getElementById('engSite').value, survey: document.getElementById('epcw_survey').checked, kw: document.getElementById('engCapacity').value, pb: document.getElementById('epcw_pb').value, st: window.EPCWind.status().state }));
  check(v.tilt === '13' && v.vb === '44' && v.site === 'Guided test' && v.kw === '10' && v.st === 'pass', 'Detail tabs are filled consistently: ' + JSON.stringify(v));
  await page.waitForTimeout(800);
  const lk = await page.locator('#epc_tabs [data-t="analysis"]').getAttribute('data-locked');
  check(v.survey === false && lk === '1', 'Nothing is confirmed automatically: the survey tick is off and Analysis stays locked (lock=' + lk + ')');
  await page.locator('#epcd_conf').check(); await page.waitForTimeout(1500);
  const a = await page.evaluate(() => { window.EPCAnalysis.recalc(); const r = window.EPCAnalysis.status(), q = window.EPCAnalysis.result(); return { s: r.state, p2: q && q.cres2 ? Object.keys(q.cres2).length : null }; });
  check(a.s === 'pass' && a.p2 === 8 && (await page.locator('#epc_tabs [data-t="analysis"]').getAttribute('data-locked')) === null, 'After the engineer confirms, the full analysis (8 combinations, P-Delta) passes and unlocks: ' + JSON.stringify(a));
  const bom = await page.evaluate(() => (document.querySelector('#epc_tabs [data-t="draw"]').getAttribute('data-locked')));
  check(bom === null, 'Drawings unlock after the confirmed analysis');
  await page.locator('#epcd_adv').click(); await page.waitForTimeout(200);
  check(await page.locator('#epc_tabs [data-t="wind"]').isVisible(), 'Review details shows every tab');
  await page.locator('#epcd_adv').click(); await page.waitForTimeout(200);
  check(!(await page.locator('#epc_tabs [data-t="wind"]').isVisible()), 'Back to guided hides them again');
  check(errors.length === 0, 'No page errors: ' + errors.slice(0, 2).join(' | '));
} catch (e) { failures.push('Exception: ' + (e.stack || e.message)); }
await browser.close(); server.close();
if (failures.length) { console.error('\nFAILURES:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('\nAll guided design checks passed.');
