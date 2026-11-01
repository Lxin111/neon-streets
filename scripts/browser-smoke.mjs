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
  await page.goto(baseURL + '?test=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#hud:not(.hidden)').waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: 'artifacts/game-desktop.png', fullPage: false, timeout: 90000, animations: 'disabled' });
  console.log('PASS: desktop game startup and canvas render');
  const hpLabel = await page.locator('#hpText').textContent();
  const hpParts = (hpLabel || '').split('/').map(value => Number(value.trim()));
  if (!hpLabel || /NaN|undefined|null/.test(hpLabel) || hpParts.length !== 2 || !hpParts.every(Number.isFinite) || hpParts[1] <= 0) throw new Error('Player health HUD is invalid: ' + hpLabel);
  console.log('PASS: health HUD displays finite current/max HP (' + hpLabel + ')');
  const sunVisible = await page.evaluate(() => { const t = window.__NEON_STREETS_TEST__; t.world.environment.setTime(12); return t.world.environment.sunVisual.visible; });
  if (!sunVisible) throw new Error('Daytime sun visual is not visible at noon.');
  const bossSpeeds = await page.evaluate(() => {
    const { game } = window.__NEON_STREETS_TEST__;
    const enemy = game.enemies.find(e => !e.dead);
    if (!enemy) throw new Error('No enemy rig available for boss movement test.');
    const root = enemy.model.root, original = root.position.clone(), player = game.player.root.position;
    game.keys = {}; game.buff = null; game.poisonTime = 0; game.moveBonus = 0; game.skillMoveBonus = 0;
    const speeds = [];
    const originalMove = game.moveEnemyToward;
    game.moveEnemyToward = (actor, vector) => { speeds.push(vector.length()); actor.model.root.position.add(vector); return vector.length(); };
    for (let type = 0; type < 4; type++) {
      root.position.set(player.x, 0, player.z - 20);
      const boss = { model: enemy.model, boss: true, bossType: type, spider: type === 1, attack: 99, damageMultiplier: 1 };
      const delta = player.clone().sub(root.position);
      game.updateBossEnemy(boss, .1, delta, 20, 0);
    }
    root.position.copy(original); game.moveEnemyToward = originalMove;
    return speeds;
  });
  if (bossSpeeds.length !== 4 || bossSpeeds.some(v => Math.abs(v - .39) > .015)) throw new Error('Boss movement is not 75% of the 5.2 player walk speed: ' + bossSpeeds.join(','));
  console.log('PASS: visible daytime sun and all four boss movement speeds at 75% player walk speed');


  await page.locator('#achievementBtn').click();
  await page.locator('#achievementOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause when achievements opened.');
  const achievements = await page.locator('#achievementList .list-row').count();
  if (achievements < 300) throw new Error('Expected at least 300 achievement rows; found ' + achievements);
  await page.screenshot({ path: 'artifacts/achievements.png', fullPage: true });
  console.log('PASS: achievement menu renders ' + achievements + ' entries');
  await page.locator('#achievementOverlay [data-close]').click();
  if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error('Game did not resume after closing achievements.');
  await page.locator('#shopBtn').click();
  await page.locator('#shopOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause when shop opened.');
  const shopItems = await page.locator('#shopList [data-buy-item]').count();
  if (shopItems < 100) throw new Error('Expected at least 100 shop items; found ' + shopItems);
  await page.screenshot({ path: 'artifacts/shop-desktop.png', fullPage: true });
  console.log('PASS: shop menu renders ' + shopItems + ' products');
  await page.locator('#shopOverlay [data-close]').click();
  if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error('Game did not resume after closing shop.');
  await page.locator('#environmentBtn').click();
  await page.locator('#environmentOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause for environment settings.');
  await page.locator('#worldWeather').selectOption('rain');
  await page.locator('#worldTime').evaluate(el => { el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const savedWeather = await page.evaluate(() => localStorage.getItem('ns_world_weather'));
  const savedTime = await page.evaluate(() => localStorage.getItem('ns_world_time'));
  if (savedWeather !== 'rain' || Number(savedTime) !== 12) throw new Error('Weather/time settings were not saved.');
  await page.locator('#closeEnvironment').click();
  if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error('Game did not resume after closing environment settings.');
  await page.keyboard.press('c');
  await page.locator('#statsOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause for character stats.');
  await page.locator('#closeStats').click();
  if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error('Game did not resume after closing character stats.');
  console.log('PASS: all tested modal screens pause and resume the game; environment settings persist');
  for (const [button, overlay] of [['#skillsBtn','#skillsOverlay'],['#questsBtn','#questsOverlay'],['#codexBtn','#codexOverlay'],['#saveBtn','#saveOverlay'],['#settingsBtn','#settingsOverlay']]) {
    await page.locator(button).click();
    await page.locator(overlay + ':not(.hidden)').waitFor({ state: 'visible' });
    if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error(overlay + ' did not pause the game.');
    if (overlay === '#saveOverlay') {
      await page.locator('#saveNowBtn').click();
      const checkpoint = await page.evaluate(() => localStorage.getItem('ns_campaign_save'));
      if (!checkpoint || !JSON.parse(checkpoint).districtNumber) throw new Error('Campaign checkpoint was not written.');
    }
    if (overlay === '#settingsOverlay') {
      await page.locator('#fovSetting').evaluate(el => { el.value = '74'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      const fov = await page.evaluate(() => localStorage.getItem('ns_fov'));
      if (fov !== '74') throw new Error('FOV setting was not persisted.');
    }
    await page.locator(overlay + ' [data-close]').click();
    if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error(overlay + ' did not resume the game.');
  }
  console.log('PASS: skill tree, daily quests, codex, campaign save and graphics settings open/pause/resume');

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
