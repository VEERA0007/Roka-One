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
await new Promise(r => server.listen(4185, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const failures = []; const check = (c, m) => { if (!c) failures.push(m); else console.log('PASS:', m); };
const setv = (page, sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.addInitScript(() => { try { localStorage.setItem('gs_epc_adv_v1', '1'); } catch (e) {} });
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:4185/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.exploreGuest(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(el => { el.hidden = true; }); document.getElementById('view-engineering').hidden = false; });
  await setv(page, '#engSite', 'Sheet test');
  await page.locator('#epc_tabs [data-t="survey"]').click(); await page.waitForTimeout(800);
  check(await page.locator('#epcs').count() === 1, 'Sheet page is mounted in Survey');
  check(await page.locator('#epcs_file').isDisabled(), 'Sheet upload waits for the floor name');
  await page.fill('#epcs_floor', '5th floor terrace'); await page.locator('#epcs_floor').dispatchEvent('change'); await page.waitForTimeout(500);
  check(!(await page.locator('#epcs_file').isDisabled()) && await page.locator('[data-tool="scale1"]').isDisabled(), 'Floor named: upload opens, scale tool waits for a sheet');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1000, 600); g.strokeStyle = '#000'; g.strokeRect(100, 100, 600, 400); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('#epcs_file', { name: 'sheet.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('#epcs_svg', { timeout: 8000 });
  const vb = await page.evaluate(() => document.getElementById('epcs_svg').getAttribute('viewBox'));
  check(vb === '0 0 1000 600', 'Sheet is shown at its own size: ' + vb);
  const tapAt = async (u, v) => { await page.evaluate(() => document.getElementById('epcs_svg').scrollIntoView({ block: 'center' })); const p = await page.evaluate(([u, v]) => { const r = document.getElementById('epcs_svg').getBoundingClientRect(); return [r.left + u / 1000 * r.width, r.top + v / 600 * r.height]; }, [u, v]); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(80); };
  check(await page.locator('[data-tool="box1"]').isDisabled(), 'Tracing waits for the scale');
  await page.locator('[data-tool="scale1"]').click(); await tapAt(100, 500); await tapAt(600, 500);
  await page.fill('#epcs_real', '25'); await page.locator('#epcs_setscale').click(); await page.waitForTimeout(200);
  check(!(await page.locator('[data-tool="box1"]').isDisabled()), 'Scale set: tracing tools open');
  /* main roof: 30 x 20 m at (5,5) */
  await page.locator('[data-tool="box1"]').click(); await tapAt(100, 500); await tapAt(700, 100);
  await page.fill('#epcs_name', 'Main roof'); await page.fill('#epcs_level', '0'); await page.locator('#epcs_struct').uncheck(); await page.locator('#epcs_add').click(); await page.waitForTimeout(200);
  /* penthouse roof at +3 m with its structure: 8 x 6 m at (7,7) */
  await page.locator('[data-tool="box1"]').click(); await tapAt(140, 460); await tapAt(300, 340);
  await page.fill('#epcs_name', 'Penthouse roof'); await page.fill('#epcs_level', '3'); await page.locator('#epcs_add').click(); await page.waitForTimeout(200);
  /* tank on the penthouse roof: diameter 2 m, base 3, top 5 */
  await page.locator('[data-tool="round1"]').click(); await tapAt(220, 400); await tapAt(240, 400);
  await page.fill('#epcs_name', 'Water tank'); await page.fill('#epcs_h', '5'); await page.fill('#epcs_base', '3'); await page.locator('#epcs_add').click(); await page.waitForTimeout(300);
  const rows = await page.evaluate(() => window.EPCSurveyUI.rows());
  const P = rows.parts, O = rows.obs, nr = (v, t, e = 0.15) => Math.abs(+v - t) <= e;
  check(P.length === 2 && P[0].name === 'Main roof' && nr(P[0].x, 5) && nr(P[0].y, 5) && nr(P[0].w, 30) && nr(P[0].d, 20) && +P[0].level === 0, 'Main roof traced to the Survey row: ' + JSON.stringify(P[0]));
  check(nr(P[1].x, 7) && nr(P[1].y, 7) && nr(P[1].w, 8) && nr(P[1].d, 6) && +P[1].level === 3, 'Penthouse roof traced at level 3: ' + JSON.stringify(P[1]));
  check(O.length === 2 && O[0].name === 'Penthouse roof structure' && +O[0].h === 3 && +O[0].base === 0 && nr(O[0].w, 8), 'The structure under the penthouse roof was added as a box with top 3 m: ' + JSON.stringify(O[0]));
  check(O[1].shape === 'round' && nr(O[1].x, 10) && nr(O[1].y, 9) && nr(O[1].w, 2) && +O[1].h === 5 && +O[1].base === 3, 'Tank traced as a round obstacle on the penthouse roof: ' + JSON.stringify(O[1]));
  check(await page.locator('#epcv_obs input[data-obs$=".base"]').count() === 2, 'Survey obstacle rows show the base level field');
  const ov = await page.evaluate(() => document.querySelectorAll('#epcs_svg rect[stroke="#2f5fd0"], #epcs_svg ellipse').length);
  check(ov === 3, 'Overlay outlines the traced areas and the tank on the sheet: ' + ov);
  /* editing a dimension in the Survey row moves the outline */
  const before = await page.evaluate(() => document.querySelector('#epcs_svg rect[stroke="#2f5fd0"]').getAttribute('width'));
  await setv(page, 'input[data-part="0.w"]', '28'); await page.waitForTimeout(600);
  const after = await page.evaluate(() => document.querySelector('#epcs_svg rect[stroke="#2f5fd0"]').getAttribute('width'));
  check(Math.abs(before - 600) < 4 && Math.abs((before - after) - 40) < 0.5, 'Editing a width in the rows redraws the outline on the sheet: ' + before + ' -> ' + after);
  /* photos and a video */
  const jpg = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#7a9'; g.fillRect(0, 0, 3000, 2000); return c.toDataURL('image/jpeg').split(',')[1]; });
  await page.setInputFiles('#epcs_media', [{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') }, { name: 'walk.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) }]);
  await page.waitForFunction(() => document.querySelectorAll('#epcs_media_list img').length === 2, null, { timeout: 8000 });
  check(await page.locator('#epcs_media_list video').count() === 1, 'Two photos and one video are kept for this floor');
  const dim = await page.evaluate(() => new Promise(r => { const i = document.querySelector('#epcs_media_list img'); const f = () => r([i.naturalWidth, i.naturalHeight]); if (i.complete) f(); else i.onload = f; }));
  check(dim[0] === 1600 && dim[1] === 1067, 'Photos are reduced to 1600 px: ' + dim);
  await page.locator('#epcs_media_list input[data-note]').first().fill('North parapet'); await page.locator('#epcs_media_list input[data-note]').first().dispatchEvent('change'); await page.waitForTimeout(300);
  /* everything survives a reload */
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2200);
  await page.evaluate(() => { location.hash = ''; try { window.exploreGuest(); } catch (e) {} }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(el => { el.hidden = true; }); document.getElementById('view-engineering').hidden = false; });
  await setv(page, '#engSite', 'Sheet test'); await page.locator('#epc_tabs [data-t="survey"]').click(); await page.waitForTimeout(500);
  await page.locator('#engSite').dispatchEvent('change'); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => { const s = window.EPCSheetUI.state(); return { floor: s.M.floor, ppm: s.M.ppm, media: s.media, sheet: s.sheet, rows: window.EPCSurveyUI.rows().parts.length }; });
  check(st.floor === '5th floor terrace' && Math.abs(st.ppm - 20) < 0.3 && st.media === 3 && st.sheet && st.rows === 2, 'Floor, sheet, scale, media and rows come back after a reload: ' + JSON.stringify(st));
  check(await page.locator('#epcs_media_list input[data-note]').first().inputValue() === 'North parapet', 'The photo note was kept');
  /* PDF package carries the traced sheet, photos and the video list */
  const pkg = await page.evaluate(() => { const b = window.EPCSurveyPackage ? window.EPCSurveyPackage() : { html: '', pages: 0 }; const d = document.createElement('div'); d.innerHTML = b.html; return { pages: b.pages, titles: [...d.querySelectorAll('.ep-ph span:nth-child(2)')].map(e => e.textContent), imgs: d.querySelectorAll('img').length, sheetImg: d.querySelectorAll('svg image').length, txt: d.textContent }; });
  check(pkg.titles.includes('Floor sheet with traced areas') && pkg.sheetImg >= 1, 'Package has the traced floor sheet: ' + pkg.titles.join(' | '));
  check(pkg.imgs === 2 && pkg.titles.some(t => t.startsWith('Site photos 1')) && pkg.txt.includes('Site videos') && pkg.txt.includes('5th floor terrace'), 'Package prints both photos, lists the video and names the floor');
  /* removing a photo */
  await page.locator('#epcs_media_list [data-delm]').first().click(); await page.waitForTimeout(500);
  check((await page.evaluate(() => window.EPCSheetUI.state().media)) === 2, 'A photo can be removed');
  check(errors.length === 0, 'No page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failures.push('Exception: ' + (e.stack || e.message)); }
await browser.close(); server.close();
if (failures.length) { console.error('\nFAILURES:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('\nAll sheet checks passed.');
