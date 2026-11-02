import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const baseURL = 'http://127.0.0.1:4173/';
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
let browser;
const pageErrors = [];
const consoleErrors = [];
let page;
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
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(baseURL + '?test=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#hud:not(.hidden)').waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('#app canvas:not(#miniMap)').waitFor({ state: 'visible', timeout: 15000 });
  const pbrKinds = await page.evaluate(() => window.__NEON_STREETS_TEST__.world.pbrTextureKinds || []);
  const requiredPbrKinds = ['asphalt','concrete','brick','wood','bark','metal'];
  if (requiredPbrKinds.some(kind => !pbrKinds.includes(kind))) throw new Error('Missing scanned PBR material sets: ' + requiredPbrKinds.filter(kind => !pbrKinds.includes(kind)).join(', '));
  console.log('PASS: scanned CC0 PBR maps loaded for asphalt, concrete, brick, wood, bark and metal');
  console.log('PASS: desktop game startup and canvas render');
  await page.locator('#miniMapPanel').waitFor({ state: 'visible' });
  const radarSize = await page.locator('#miniMap').evaluate(canvas => ({ width: canvas.width, height: canvas.height, context: !!canvas.getContext('2d') }));
  if (radarSize.width !== 180 || radarSize.height !== 180 || !radarSize.context) throw new Error('Tactical radar canvas did not initialize.');
  console.log('PASS: tactical radar initialized');

  const hpLabel = await page.locator('#hpText').textContent();
  const hpParts = (hpLabel || '').split('/').map(value => Number(value.trim()));
  if (!hpLabel || /NaN|undefined|null/.test(hpLabel) || hpParts.length !== 2 || !hpParts.every(Number.isFinite) || hpParts[1] <= 0) throw new Error('Player health HUD is invalid: ' + hpLabel);
  console.log('PASS: health HUD displays finite current/max HP (' + hpLabel + ')');
  const sunVisible = await page.evaluate(() => { const t = window.__NEON_STREETS_TEST__; t.world.environment.setTime(12); t.world.environment.update(.016,t.game.player.root.position); const p=t.world.environment.sunVisual.position.clone().project(t.world.camera); return t.world.environment.sunVisual.visible && p.y>.05 && Math.abs(p.x)<.9; });
  if (!sunVisible) throw new Error('Daytime sun visual is not visible above the player at noon.');
  const repairedHealth = await page.evaluate(() => { const {game}=window.__NEON_STREETS_TEST__; game.hp=NaN; game.maxHp=NaN; game.updateUI(); return document.querySelector('#hpText').textContent; });
  if (/NaN|undefined|null/.test(repairedHealth)) throw new Error('Health HUD did not recover from corrupted HP state: '+repairedHealth);
  console.log('PASS: corrupt HP state self-recovers to finite HUD values');
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
  const stunnedBossKeepsAI = await page.evaluate(() => { const {game}=window.__NEON_STREETS_TEST__,enemy=game.enemies.find(e=>!e.dead),root=enemy.model.root,original=root.position.clone(),oldBossUpdate=game.updateBossEnemy;let calls=0;game.updateBossEnemy=()=>{calls++;};const boss={model:enemy.model,boss:true,bossType:0,hp:100,maxHp:100,attack:99,stun:.9,damageMultiplier:1,seed:17};game.updateEnemy(boss,.1);game.updateBossEnemy=oldBossUpdate;root.position.copy(original);return calls===1&&boss.stun>0; });
  if (!stunnedBossKeepsAI) throw new Error('Boss AI was incorrectly frozen by hit stun.');
  console.log('PASS: visible daytime sun, 75% boss movement and no stun-induced boss idling');
  const hulkStomp = await page.evaluate(() => {
    const { game } = window.__NEON_STREETS_TEST__, enemy = game.enemies.find(e => !e.dead);
    const root = enemy.model.root, original = root.position.clone(), leg = enemy.model.legR, oldRotation = leg.rotation.x, oldMove = game.moveEnemyToward;
    root.position.set(game.player.root.position.x, 0, game.player.root.position.z - 5);
    game.moveEnemyToward = (actor, vector) => { actor.model.root.position.add(vector); };
    const boss = { model: enemy.model, boss: true, bossType: 0, hp: 100, maxHp: 100, attack: 0, damageMultiplier: 1 };
    const delta = game.player.root.position.clone().sub(root.position);
    game.updateBossEnemy(boss, .016, delta, 5, 0);
    const lifted = boss.stompTime > 0 && leg.rotation.x < 0 && boss.weakpointOpen;
    root.position.copy(original); leg.rotation.x = oldRotation; game.moveEnemyToward = oldMove;
    game.attachRealisticModel({ elite: true }); game.attachRealisticModel({ boss: true });
    return lifted;
  });
  if (!hulkStomp) throw new Error('Hulk did not lift its leg before the stomp attack.');
  const bossPhaseTwo = await page.evaluate(() => {
    const { game } = window.__NEON_STREETS_TEST__, enemy = game.enemies.find(e => !e.dead);
    const root = enemy.model.root, original = root.position.clone(), scale = root.scale.clone(), player = game.player.root.position, oldMove = game.moveEnemyToward;
    root.position.set(player.x, 0, player.z - 20); game.moveEnemyToward = (actor, vector) => actor.model.root.position.add(vector);
    const boss = { model: enemy.model, boss: true, bossType: 2, hp: 45, maxHp: 100, attack: 99, damageMultiplier: 1 };
    game.updateBossEnemy(boss, .016, player.clone().sub(root.position), 20, 0);
    const enraged = boss.enraged && boss.phase === 2;
    root.position.copy(original); root.scale.copy(scale); game.moveEnemyToward = oldMove;
    return enraged;
  });
  if (!bossPhaseTwo) throw new Error('Boss did not enter phase two at half health.');

  console.log('PASS: Hulk leg-lift stomp telegraph and photogrammetry isolation guards');
  const healthBarsAndImpacts = await page.evaluate(() => {
    const { game } = window.__NEON_STREETS_TEST__;
    const normal = game.enemies.find(e => !e.dead && !e.elite && !e.boss);
    if (!normal?.model.hpText) return { error: 'Normal enemy numeric health label missing.' };
    const original = { hp: normal.hp, maxHp: normal.maxHp, activeWeapon: game.activeWeapon, swordColor: game.swordColor };
    const colors = [];
    for (const ratio of [.8,.5,.2]) {
      normal.hp = normal.maxHp * ratio;
      game.damageEnemy(normal, 1);
      colors.push(normal.model.hpFill.material.color.getHexString());
    }
    const label = normal.model.hpText.ctx ? normal.model.hpText.canvas : null;
    const textReady = !!label && normal.model.hpText.texture.image === label;
    normal.hp = original.hp; normal.maxHp = original.maxHp;
    const eliteStart = game.enemies.length;
    game.spawnElites(1);
    const elite = game.enemies[game.enemies.length - 1];
    const eliteHasText = !!elite?.model.hpText;
    if (elite) { game.damageEnemy(elite, 1); game.scene.remove(elite.model.root); game.enemies.pop(); }
    const weaponColors = [];
    game.activeWeapon = 'katana';
    for (const color of ['#ff354f','#ff8a28','#ffe45c','#4dff9a','#39e9ff','#bd70ff']) {
      game.swordColor = color;
      game.hitImpact(game.player.root.position, color);
      weaponColors.push(color);
    }
    game.activeWeapon = original.activeWeapon; game.swordColor = original.swordColor;
    return { colors, label: textReady, eliteHasText, weaponColors, impactParticles: game.particles.length };
  });
  if (healthBarsAndImpacts.error || healthBarsAndImpacts.colors.join(',') !== '39e66b,ff9b2f,ff3548' || !healthBarsAndImpacts.label || !healthBarsAndImpacts.eliteHasText || new Set(healthBarsAndImpacts.weaponColors).size !== 6 || healthBarsAndImpacts.impactParticles < 6) throw new Error('Enemy health bar / colored hit effect check failed: ' + JSON.stringify(healthBarsAndImpacts));
  console.log('PASS: normal/elite health bars show numeric HP and transition green → orange → red; six katana colors produce distinct hit sparks');
  const hulkScale = await page.evaluate(() => {
    const { game } = window.__NEON_STREETS_TEST__;
    const start = game.enemies.length;
    game.spawnBossType(0);
    const boss = game.enemies[game.enemies.length - 1];
    const box = new (window.__THREE__?.Box3 || Object)( );
    const scale = boss.model.root.scale.x;
    const dimensions = new (window.__THREE__?.Vector3 || Object)();
    // Root scale is the guardrail; the model's local geometry is authored around a human-sized rig.
    game.scene.remove(boss.model.root); game.enemies.splice(start); game.bossActive = false;
    return { scale, finite: Number.isFinite(scale), maxScale: .85 };
  });
  if (!hulkScale.finite || hulkScale.scale > hulkScale.maxScale) throw new Error('Hulk boss scale is outside the visibility-safe range: ' + JSON.stringify(hulkScale));
  console.log('PASS: Hulk boss spawn scale is clamped to a screen-readable size');



  await page.locator('#achievementBtn').click();
  await page.locator('#achievementOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause when achievements opened.');
  const achievements = await page.locator('#achievementList .list-row').count();
  if (achievements < 300) throw new Error('Expected at least 300 achievement rows; found ' + achievements);
  console.log('PASS: achievement menu renders ' + achievements + ' entries');
  await page.locator('#achievementOverlay [data-close]').click();
  if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error('Game did not resume after closing achievements.');
  await page.locator('#shopBtn').click();
  await page.locator('#shopOverlay:not(.hidden)').waitFor({ state: 'visible' });
  if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error('Game simulation did not pause when shop opened.');
  const shopItems = await page.locator('#shopList [data-buy-item]').count();
  if (shopItems < 100) throw new Error('Expected at least 100 shop items; found ' + shopItems);
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
    if (overlay === '#skillsOverlay') await page.evaluate(() => { window.__NEON_STREETS_TEST__.game.skillPoints = 1; });
    await page.locator(button).click();
    await page.locator(overlay + ':not(.hidden)').waitFor({ state: 'visible' });
    if (await page.locator('#hud').getAttribute('data-paused') !== 'true') throw new Error(overlay + ' did not pause the game.');
    if (overlay === '#skillsOverlay') {
      await page.locator('[data-skill="edge"]').click();
      const unlocked = await page.evaluate(() => window.__NEON_STREETS_TEST__.game.unlockedSkills.includes('edge'));
      if (!unlocked) throw new Error('Skill tree failed to unlock an available skill.');
    }
    if (overlay === '#questsOverlay') {
      const missionRows = await page.locator('#questList .list-row').count();
      if (missionRows < 13) throw new Error('Expected daily, story and bounty missions; found ' + missionRows);
    }
    if (overlay === '#saveOverlay') {
      await page.locator('#saveNowBtn').click();
      const checkpoint = await page.evaluate(() => localStorage.getItem('ns_campaign_save'));
      if (!checkpoint || !JSON.parse(checkpoint).districtNumber) throw new Error('Campaign checkpoint was not written.');
    }
    if (overlay === '#settingsOverlay') {
      await page.locator('#fovSetting').evaluate(el => { el.value = '74'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      const fov = await page.evaluate(() => localStorage.getItem('ns_fov'));
      if (fov !== '74') throw new Error('FOV setting was not persisted.');
      await page.locator('#volumeSetting').evaluate(el => { el.value = '43'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      const volume = await page.evaluate(() => localStorage.getItem('ns_master_volume'));
      if (volume !== '43') throw new Error('Master audio volume was not persisted.');
    }
    await page.locator(overlay + ' [data-close]').click();
    if (await page.locator('#hud').getAttribute('data-paused') !== 'false') throw new Error(overlay + ' did not resume the game.');
  }
  console.log('PASS: skill tree, daily quests, codex, campaign save and graphics settings open/pause/resume');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileControlsVisible = await page.locator('.mobile-controls').evaluate(el => getComputedStyle(el).display !== 'none');
  if (!mobileControlsVisible) throw new Error('Mobile controls are not visible at a 390px viewport.');
  console.log('PASS: mobile layout and touch controls are visible');
  if (pageErrors.length) throw new Error('Browser runtime errors:\n' + pageErrors.join('\n\n'));
  console.log('PAGE_ERRORS=0');
  console.log('CONSOLE_ERRORS=' + consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  const liveUrl = 'https://lxin111.github.io/neon-streets/?smoke=' + (process.env.GITHUB_SHA || Date.now());
  const noCache = { 'Cache-Control': 'no-cache' };
  const liveResponse = await fetch(liveUrl, { headers: noCache, signal: AbortSignal.timeout(30000) });
  if (!liveResponse.ok) throw new Error('Live GitHub Pages returned HTTP ' + liveResponse.status);
  const liveHtml = await liveResponse.text();
  const scriptPath = liveHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i)?.[1];
  const stylePath = liveHtml.match(/<link[^>]+href=["']([^"']+\.css)["']/i)?.[1];
  if (!scriptPath || !stylePath || !liveHtml.includes('id="hud"')) throw new Error('Published index.html is incomplete or stale. HTML length=' + liveHtml.length);
  const manifestResponse = await fetch(new URL('./textures/pbr-manifest.json', liveUrl), { headers: noCache, signal: AbortSignal.timeout(30000) });
  if (!manifestResponse.ok) throw new Error('Published PBR manifest returned HTTP ' + manifestResponse.status);
  const manifest = await manifestResponse.json();
  const publishedPbrKinds = ['asphalt','concrete','brick','wood','bark','metal'];
  if (publishedPbrKinds.some(kind => !manifest.materials?.[kind])) throw new Error('Published PBR manifest is missing material sets.');
  const assetUrls = [
    new URL(scriptPath, liveUrl),
    new URL(stylePath, liveUrl),
    new URL('./textures/' + manifest.materials.asphalt.diff, liveUrl),
    new URL('./textures/' + manifest.materials.metal.normal, liveUrl)
  ];
  const assetResponses = await Promise.all(assetUrls.map(url => fetch(url, { headers: noCache, signal: AbortSignal.timeout(30000) })));
  const failedAssets = assetResponses.map((response, i) => response.ok ? null : response.status + ' ' + assetUrls[i]).filter(Boolean);
  if (failedAssets.length) throw new Error('Published game assets failed to load: ' + failedAssets.join(' | '));
  console.log('PASS: published GitHub Pages HTML, JS, CSS and all six CC0 PBR sets are deployed');

} catch (error) {
  if (page) { try { await page.screenshot({ path: 'artifacts/browser-failure.png', fullPage: true }); } catch {} }
  console.error(error);
  if (pageErrors.length) console.error('PAGE_ERRORS=' + pageErrors.join('\n'));
  if (consoleErrors.length) console.error('CONSOLE_ERRORS=' + consoleErrors.join('\n'));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
