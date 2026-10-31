import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const baseURL = 'http://127.0.0.1:4173/';
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
let browser;
const pageErrors = [];
const consoleErrors = [];
try {
  await mkdir('artifacts', { recursive: true });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(baseURL); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Vite preview server did not become ready.');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#hud:not(.hidden)').waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: 'artifacts/game-desktop.png', fullPage: true });
  console.log('PASS: desktop game startup and canvas render');
  await page.locator('#achievementBtn').click();
  await page.locator('#achievementOverlay:not(.hidden)').waitFor({ state: 'visible' });
  const achievements = await page.locator('#achievementList .list-row').count();
  if (achievements < 300) throw new Error('Expected at least 300 achievement rows; found ' + achievements);
  await page.screenshot({ path: 'artifacts/achievements.png', fullPage: true });
  console.log('PASS: achievement menu renders ' + achievements + ' entries');
  await page.locator('#achievementOverlay [data-close]').click();
  await page.locator('#shopBtn').click();
  await page.locator('#shopOverlay:not(.hidden)').waitFor({ state: 'visible' });
  const shopItems = await page.locator('#shopList [data-buy-item]').count();
  if (shopItems < 100) throw new Error('Expected at least 100 shop items; found ' + shopItems);
  await page.screenshot({ path: 'artifacts/shop-desktop.png', fullPage: true });
  console.log('PASS: shop menu renders ' + shopItems + ' products');
  await page.locator('#shopOverlay [data-close]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileControlsVisible = await page.locator('.mobile-controls').evaluate(el => getComputedStyle(el).display !== 'none');
  if (!mobileControlsVisible) throw new Error('Mobile controls are not visible at a 390px viewport.');
  await page.screenshot({ path: 'artifacts/game-mobile.png', fullPage: true });
  console.log('PASS: mobile layout and touch controls are visible');
  if (pageErrors.length) throw new Error('Browser runtime errors:\n' + pageErrors.join('\n\n'));
  console.log('PAGE_ERRORS=0');
  console.log('CONSOLE_ERRORS=' + consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  const livePage = await context.newPage();
  const liveFailures = [];
  livePage.on('requestfailed', request => liveFailures.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed')));
  livePage.on('response', response => { if (response.status() >= 400) liveFailures.push(response.status() + ' ' + response.url()); });
  livePage.on('pageerror', error => liveFailures.push('PAGE ERROR: ' + (error.stack || error.message)));
  await livePage.goto('https://lxin111.github.io/neon-streets/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await livePage.locator('#hud:not(.hidden)').waitFor({ state: 'visible', timeout: 120000 });
  await livePage.locator('canvas').waitFor({ state: 'visible', timeout: 15000 });
  await livePage.screenshot({ path: 'artifacts/game-live-site.png', fullPage: true });
  if (liveFailures.length) throw new Error('Live site network/runtime failures:\\n' + liveFailures.join('\\n'));
  console.log('PASS: published GitHub Pages site starts and renders');

} catch (error) {
  if (browser) {
    try { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: 'artifacts/failure.png', fullPage: true }); } catch {}
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
