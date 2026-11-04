import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, normalize, sep } from 'node:path';
import vm from 'node:vm';

const root = resolve('gensolar-android-project/gensolar-android/app/src/main/assets');
const htmlSource = await readFile(resolve(root, 'index.html'), 'utf8');
for (const [index, match] of [...htmlSource.matchAll(new RegExp('<script\\b([^>]*)>([\\s\\S]*?)</script>', 'gi'))].entries()) {
  if (new RegExp('\\bsrc\\s*=').test(match[1]) || !match[2].trim()) continue;
  try { new vm.Script(match[2], { filename: 'index.html:inline-script-' + (index + 1) }); }
  catch (error) { console.error('INLINE SCRIPT SYNTAX ERROR:', error.message, error.stack); throw error; }
}
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.css':'text/css' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const relative = normalize(pathname === '/' ? '/index.html' : pathname);
    const file = resolve(root, '.' + relative);
    if (!file.startsWith(root + sep) && file !== resolve(root, 'index.html')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(resolveListen => server.listen(4179, '127.0.0.1', resolveListen));
const browser = await chromium.launch({ headless: true });
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); else console.log('PASS:', message); };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.goto('http://127.0.0.1:4179/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  check(await page.locator('#authGate').isVisible(), 'Welcome screen is visible on a mobile-sized viewport');
  console.log('Startup JS errors:', JSON.stringify(errors));
  console.log('Console errors:', JSON.stringify(consoleErrors));

  const photoStates = await page.locator('.hero .hero-bg').evaluateAll(els =>
    els.map(el => ({ src: el.getAttribute('src'), loaded: el.complete && el.naturalWidth > 0, width: el.naturalWidth }))
  );
  check(photoStates.length === 1 && photoStates.every(x => x.loaded)
    && true,
    'Bundled welcome-screen solar images load: ' + JSON.stringify(photoStates));

  await page.getByRole('button', { name: /login/i }).click();
  check(await page.locator('#loginForm').isVisible(), 'Login button opens the real OTP login sheet');
  await page.locator('#sendOtpButton').click();
  check((await page.locator('#authMessage').innerText()).includes('valid 10-digit'),
    'OTP form validates an empty/invalid mobile number instead of silently doing nothing');

  await page.locator('.lback').first().click();
  await page.waitForTimeout(150);
  await page.locator('.feats .feat').first().click();
  await page.waitForTimeout(100);
  check(await page.locator('#featureLoginModal').isVisible(), 'Solar Solutions shows a branded login-required popup');
  check((await page.locator('#featureLoginMessage').innerText()).includes('Solar Solutions'), 'Feature popup names the selected service');
  await page.locator('#featureCancel').click();
  check(await page.locator('#featureLoginModal').isHidden(), 'Cancel closes the feature popup without leaving the welcome screen');
  // Exercise the guest estimator separately; feature cards are intentionally login-gated.
  await page.evaluate(() => { window.exploreGuest(); });
  await page.waitForTimeout(200);
  check(await page.locator('#app').isVisible(), 'Guest estimator workspace can still be opened');
  check(await page.locator('#view-est').isVisible(), 'Estimator view is shown for guest exploration');
  check(await page.locator('.tabbar button[data-tab="dpr"]').count() === 1, 'DPR is added as a separate navigation tab beside EPC');
  await page.locator('.tabbar button[data-tab="dpr"]').click();
  check(await page.locator('#view-dpr').isVisible(), 'DPR workspace opens from its navigation tab');
  check(await page.locator('#dpr_projectName').count() === 1 && await page.locator('#dpr_bom').count() === 1
    && await page.locator('#dpr_internalWorkflow').count() === 1,
    'DPR contains cover details, editable BOM/BOQ and internal workflow');
  await page.locator('#dpr_projectName').fill('Smoke Test Solar Project');
  check((await page.locator('#dpr_cv_project').innerText()).includes('Smoke Test Solar Project'),
    'DPR cover page updates from the project-name field');
  await page.evaluate(() => { window.print = () => { window.__dprPrintCalled = true; }; });
  await page.locator('#dpr_pdf').click();
  await page.waitForTimeout(450);
  check(await page.locator('#dprPrintRoot').count() === 1 && await page.evaluate(() => !!window.__dprPrintCalled),
    'Generate DPR PDF assembles the complete printable report and invokes the print-to-PDF flow');
  await page.locator('.tabbar button[data-tab="est"]').click();
  check(await page.locator('#view-est').isVisible() && await page.locator('#view-dpr').isHidden(),
    'Navigation leaves the DPR workspace cleanly and returns to the estimator');

  check(await page.locator('link[href="responsive.css"]').count() === 1, 'Responsive layout stylesheet is linked');
  check(await page.locator('#gsNotificationButton').count() === 1, 'Notification inbox button is mounted in the application header');
  await page.evaluate(() => window.GenSolarNotifications.notify({title:'Smoke test alert',body:'Responsive notification inbox test'}));
  check(await page.locator('#gsNotificationCount').isVisible(), 'New notification increments the unread badge');
  await page.locator('#gsNotificationButton').click();
  check(await page.locator('#gsNotificationPanel').isVisible() && (await page.locator('#gsNotificationPanel').innerText()).includes('Smoke test alert'), 'Notification panel opens and displays new alerts');
  await page.locator('#gsNotificationClose').click();
  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(100);
  check(await page.locator('#app').evaluate(el => getComputedStyle(el).display) === 'grid', 'Desktop viewport switches to the sidebar dashboard layout');
  check(await page.locator('.tabbar').evaluate(el => getComputedStyle(el).flexDirection) === 'column', 'Desktop navigation becomes a vertical sidebar');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  check(await page.locator('#app').evaluate(el => getComputedStyle(el).display) === 'flex', 'Mobile viewport returns to the compact layout');
  check(await page.locator('#amount').count() === 1 && await page.locator('#state').count() === 1,
    'Estimator has usage and state inputs');
  check(await page.locator('#out').count() === 1, 'Estimator results container is present');
  await page.locator('#amount').fill('45000');
  await page.waitForTimeout(100);
  check(await page.locator('#out').isVisible(), 'Estimator produces a visible result after changing the monthly usage input');
  check((await page.locator('#tSize').innerText()).trim().length > 0, 'Estimator calculates and displays a system-size result');

  // Open the existing EPC workspace directly for component smoke coverage.
  await page.evaluate(() => {
    document.querySelectorAll('.page').forEach(el => { el.hidden = true; });
    document.getElementById('view-engineering').hidden = false;
  });
  check(await page.locator('#epcRoot').isVisible(), 'Existing EPC workspace remains mounted and visible');
  const originalTabs = ['site','layout','draw','elec','bom','docs'];
  for (const tab of originalTabs) {
    check(await page.locator('#epc_tabs [data-t="' + tab + '"]').count() === 1,
      'Original EPC tab remains available: ' + tab);
  }
  check(await page.locator('#epc_stages [data-st="eng"]').count() === 1
    && await page.locator('#epc_stages [data-st="proc"]').count() === 1
    && await page.locator('#epc_stages [data-st="cons"]').count() === 1,
    'Original Engineering, Procurement and Construction stages remain available');
  await page.locator('#engSite').fill('Existing EPC project site');
  await page.locator('#engCapacity').fill('21.26');
  await page.locator('#epc_tabs [data-t="autodesign"]').click();
  check(await page.locator('#epc_p-autodesign').isVisible(), 'New Auto Design is added as a separate EPC Engineering tab');
  check(await page.locator('#epc_tabs [data-t="autodesign"]').count() === 1,
    'New Auto Design tab is present without replacing the original tabs');
  await page.locator('#epca_import').click();
  check((await page.locator('#epca_project').inputValue()) === 'Existing EPC project site'
    && (await page.locator('#epca_capacity').inputValue()) === '21.26',
    'Auto Design can import existing EPC Site values on request');
  check((await page.locator('#engSite').inputValue()) === 'Existing EPC project site'
    && (await page.locator('#engCapacity').inputValue()) === '21.26',
    'Import does not modify existing EPC Site inputs');
  await page.locator('#epca_capacity').fill('20');
  await page.locator('#epca_wp').fill('615');
  await page.locator('#epca_module_w').fill('1.038');
  await page.locator('#epca_module_l').fill('2.278');
  await page.locator('#epca_length').fill('20');
  await page.locator('#epca_width').fill('40');
  await page.locator('#epca_lat').fill('17.385');
  await page.locator('#epca_lon').fill('78.4867');
  await page.locator('#epca_generate').click();
  check((await page.locator('#epca_results').innerText()).includes('20.295 kWp'),
    'Auto Design calculates installed capacity from panel count and module rating');
  check(await page.locator('#epca_layout svg').count() === 1,
    'Auto Design generates a dimensioned SVG concept layout');
  check(await page.locator('#epca_schedule table').count() === 1,
    'Auto Design generates a separate preliminary BOM and cable schedule');

  check(await page.locator('#gsCadFile').count() === 1, 'Site Survey CAD workspace is loaded inside Auto Design');
  await page.locator('#gs3dBuild').click();
  check(await page.locator('#gs3dViewer svg').count() === 1, 'Site Survey generates an interactive conceptual 3D building and solar model');
  await page.locator('#gsCadFile').setInputFiles({name:'survey-test.dxf',mimeType:'application/dxf',buffer:Buffer.from('0\\nSECTION\\n2\\nENTITIES\\n0\\nLINE\\n10\\n0\\n20\\n0\\n11\\n40\\n21\\n0\\n0\\nLINE\\n10\\n40\\n20\\n0\\n11\\n40\\n21\\n20\\n0\\nENDSEC\\n0\\nEOF\\n')});
  check((await page.locator('#gsCadStatus').innerText()).includes('2 supported entities parsed'), 'DXF import parses common 2D LINE entities and displays a drawing preview');
  await page.locator('#gsCadFile').setInputFiles({name:'reference.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\\n%mock')});
  check((await page.locator('#gsCadStatus').innerText()).includes('reference underlay'), 'PDF site drawings are accepted as reference underlays');
  await page.locator('#gsCadFile').setInputFiles({name:'reference.dwg',mimeType:'application/acad',buffer:Buffer.from('DWG')});
  check((await page.locator('#gsCadStatus').innerText()).includes('DWG accepted'), 'DWG files are recognized and explain the required DXF conversion step');
  await page.locator('[data-epca-mode="ground"]').click();
  check((await page.locator('#epca_modeLabel').innerText()).includes('Ground-mounted'),
    'Auto Design supports ground-mounted mode');
  await page.locator('#epca_generate').click();
  check(await page.locator('#epca_layout svg').count() === 1,
    'Ground-mounted mode also generates a panel layout');
  for (const tab of originalTabs) {
    await page.locator('#epc_tabs [data-t="' + tab + '"]').click();
    check(await page.locator('#epc_p-' + tab).isVisible(),
      'Original EPC tab still opens after Auto Design use: ' + tab);
  }
  check(await page.locator('#epc_saveProj').count() === 1
    && await page.locator('#epc_newProj').count() === 1
    && await page.locator('#epc_loadRef').count() === 1,
    'Original EPC Save project, New and Example controls remain available');

  check(errors.length === 0, 'No uncaught JavaScript errors: ' + (errors.join(' | ') || 'none'));
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
if (failures.length) {
  console.error('\nFAILURES:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('\nAll GenSolar WebView smoke checks passed.');
