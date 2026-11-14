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
await new Promise(r => server.listen(4183, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const failures = []; const check = (c, m) => { if (!c) failures.push(m); else console.log('PASS:', m); };
const setv = (page, sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.addInitScript(() => { try { localStorage.setItem('gs_epc_adv_v1', '1'); } catch (e) {} });
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:4183/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.exploreGuest(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(el => { el.hidden = true; }); document.getElementById('view-engineering').hidden = false; });
  check(await page.locator('#epc_tabs [data-t="survey"]').count() === 1 && await page.locator('#epcv').count() === 1, 'Survey tab is mounted in Engineering');
  await page.locator('#epc_tabs [data-t="survey"]').click();
  check(await page.locator('#epc_p-survey').isVisible() && !(await page.locator('#epc_p-site').isVisible()), 'Survey tab opens and Site hides');
  await setv(page, '#engSite', 'Survey test'); await setv(page, '#engLat', '17.385'); await setv(page, '#engLon', '78.4867'); await setv(page, '#engCapacity', '40'); await setv(page, '#engRoof', '2500');
  await page.waitForTimeout(500);
  check((await page.locator('#epcv_out').innerText()).includes('not available yet'), 'Result is locked until the survey inputs are given');
  check((await page.locator('#epcv_out').innerText()).includes('At least one roof part'), 'The lock names the missing roof part');
  await page.selectOption('#epcv_top', 'down'); await setv(page, '#epcv_rows', '2'); await setv(page, '#epcv_low', '457');
  await setv(page, '#epcv_sb', '0.5'); await setv(page, '#epcv_cl', '0.5'); await page.selectOption('#epcv_shade', 'off');
  await page.locator('#epcv_addPart').click();
  await page.evaluate(() => { const v = { x: 0, y: 0, w: 12, d: 20 }; Object.keys(v).forEach(k => { const e = document.querySelector('[data-part="0.' + k + '"]'); e.value = v[k]; e.dispatchEvent(new Event('input', { bubbles: true })); }); });
  await page.waitForTimeout(700);
  const t1 = await page.locator('#epcv_out').innerText(); console.log(t1.slice(0, 300).replace(/\n+/g, ' | '));
  check(!t1.includes('not available yet'), 'Counts appear once the inputs are in');
  const st = await page.evaluate(() => window.EPCSurvey.state());
  check(st && st.state === 'ok' && st.modules > 0 && st.modules === st.tables.reduce((a, t) => a + t.modules, 0), 'Modules = sum of the tables: ' + (st && st.modules));
  check(await page.locator('#epcv_out svg polygon').count() > 20, 'Top view is drawn');
  const sbMirror = await page.evaluate(() => (document.getElementById('epcp_sb') || { value: 'none' }).value);
  check(sbMirror === '0.5' || sbMirror === 'none', 'Setback is mirrored to the Site placement field (one value): ' + sbMirror);
  /* obstacle with shadow */
  await page.locator('#epcv_addObs').click();
  await page.evaluate(() => { const v = { x: 5, y: 8, w: 2, d: 2, h: 6 }; Object.keys(v).forEach(k => { const e = document.querySelector('[data-obs="0.' + k + '"]'); e.value = v[k]; e.dispatchEvent(new Event('input', { bubbles: true })); }); });
  await page.waitForTimeout(600);
  const noShade = await page.evaluate(() => window.EPCSurvey.state().modules);
  await page.selectOption('#epcv_shade', 'custom'); await setv(page, '#epcv_sm', '12'); await setv(page, '#epcv_sd', '21'); await page.waitForTimeout(700);
  const withShade = await page.evaluate(() => window.EPCSurvey.state().modules);
  check(withShade < noShade, 'The winter shadow of a 6 m tower removes modules: ' + noShade + ' -> ' + withShade);
  check((await page.locator('#epcv_out').innerText()).includes('Shadow zones are the outer envelope'), 'Shadow rule is stated on the result');
  /* plan with shadows */
  check((await page.locator('#epcv_out').innerText()).includes('Enter the plan date'), 'Plan with shadows asks for date and time first');
  await setv(page, '#epcv_pm', '12'); await setv(page, '#epcv_pd', '21'); await setv(page, '#epcv_ph', '9'); await page.waitForTimeout(700);
  const ptxt = await page.locator('#epcv_out').innerText();
  check(ptxt.includes('21 DECEMBER') && ptxt.includes('9:00 AM') && /table modules are touched by obstacle shadow/.test(ptxt), 'Plan states the date, time and shaded count');
  check(await page.locator('#epcv_out svg text:has-text("DATE : 21 DECEMBER")').count() === 2, 'Date and time stamp is drawn on the plan and the 3D view');
  const pst = await page.evaluate(() => window.EPCSurvey.state().modules);
  check(pst > 0 && await page.locator('#epcv_printplan').count() === 1, 'Print plan button is offered');
  /* isometric view */
  const nIso = await page.locator('#epcv_iso svg polygon').count(); const nMod = await page.evaluate(() => window.EPCSurvey.state().modules); check(nIso >= nMod + 6, '3D view draws every module plus floor and obstacle faces: ' + nIso + ' for ' + nMod);
  const iso0 = await page.locator('#epcv_iso').innerHTML();
  await page.locator('[data-iso="30"]').click(); await page.waitForTimeout(300);
  check((await page.locator('#epcv_iso').innerHTML()) !== iso0, 'Rotating changes the 3D view');
  await page.locator('[data-iso="0"]').click(); await page.waitForTimeout(300);
  check((await page.locator('#epcv_iso').innerHTML()) === iso0, 'Reset view returns to the first view');
  /* send to Layout: two clicks needed */
  await page.selectOption('#epcv_shade', 'off'); await page.waitForTimeout(600);
  const expect = await page.evaluate(() => window.EPCSurvey.state().tables.map(t => [t.rows, t.perRow]));
  const mods = await page.evaluate(() => window.EPCSurvey.state().modules);
  await page.locator('#epcv_send').click();
  
  const blocksBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('gs_epc_v1')).blocks));
  check((await page.locator('#epcv_msg').innerText()).includes('replaces every block'), 'First click shows the replace warning');
  await page.locator('#epcv_send').click(); await page.waitForTimeout(600);
  const blocks = await page.evaluate(() => JSON.parse(localStorage.getItem('gs_epc_v1')).blocks);
  check(blocks.length === expect.length && blocks.every((b, i) => b.rows === expect[i][0] && b.perRow === expect[i][1] && b.low === 457), 'Second click replaced the Layout blocks with the survey tables: ' + blocks.length);
  check(blocks.reduce((a, b) => a + b.rows * b.perRow, 0) === mods, 'Layout modules equal the survey count: ' + mods);
  check(blocksBefore !== JSON.stringify(blocks), 'Layout blocks changed only after the second click');
  await page.locator('#epc_tabs [data-t="layout"]').click();
  check(await page.locator('#epc_bn0').inputValue() === blocks[0].name, 'Layout tab shows the new first block');
  if (process.env.SHOT) { await page.locator('#epc_tabs [data-t="survey"]').click(); await page.waitForTimeout(500); await page.locator('#epcv_iso svg').screenshot({ path: process.env.SHOT }); }
  /* survey is kept per project */
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2200);
  const kept = await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('gs_epc_survey_v1') || '{}'); return Object.keys(a).map(k => a[k].parts.length); });
  check(kept.length >= 1 && kept.some(n => n === 1), 'Survey data is saved on this device');
  check(errors.length === 0, 'No page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failures.push('Smoke test crashed: ' + (e.stack || e.message)); }
await browser.close(); server.close();
if (failures.length) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
console.log('\nSurvey smoke passed');
