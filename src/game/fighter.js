import * as THREE from 'three';

const mat = (color, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function capsule(group, r, len, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 9), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
function makeFighter(scene, isEnemy = false, index = 0) {
  const root = new THREE.Group(); scene.add(root);
  const skin = mat(isEnemy ? '#b88769' : '#bd9278');
  const shirt = mat(isEnemy ? ['#873f36', '#394d5a', '#6b513c'][index % 3] : '#273c4b');
  const pants = mat(isEnemy ? '#292e31' : '#202b31'), shoes = mat('#15191b'), hair = mat(isEnemy ? '#211c1a' : '#17191c');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .65, 5, 10), shirt);
  torso.position.y = 1.35; torso.castShadow = true; root.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.25, 14, 12), skin);
  head.position.y = 2.08; head.castShadow = true; root.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.255, 14, 8, 0, Math.PI * 2, 0, Math.PI * .48), hair);
  hairCap.position.y = 2.15; root.add(hairCap);
  const armL = capsule(root, .13, .48, shirt, -.48, 1.42, 0), armR = capsule(root, .13, .48, shirt, .48, 1.42, 0);
  const fistL = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), skin), fistR = fistL.clone();
  fistL.position.set(-.49, 1.12, 0); fistR.position.set(.49, 1.12, 0); root.add(fistL, fistR);
  const legL = capsule(root, .16, .48, pants, -.2, .48, 0), legR = capsule(root, .16, .48, pants, .2, .48, 0);
  const footL = new THREE.Mesh(new THREE.BoxGeometry(.3, .15, .48), shoes), footR = footL.clone();
  footL.position.set(-.2, .12, .08); footR.position.set(.2, .12, .08); root.add(footL, footR);
  return { root, armL, armR, fistL, fistR, legL, legR, head, torso, isEnemy, anim: 0 };
}
export class FighterGame {
  constructor(world) {
    this.world = world; this.scene = world.scene; this.camera = world.camera; this.renderer = world.renderer;
    this.player = makeFighter(this.scene, false); this.player.root.position.set(0, 0, 5); this.player.root.rotation.y = Math.PI;
    this.enemies = [];
    for (let i = 0; i < 5; i++) {
      const e = makeFighter(this.scene, true, i), a = i / 5 * Math.PI * 2;
      e.root.position.set(Math.cos(a) * 9, 0, -Math.sin(a) * 9);
      e.root.rotation.y = Math.atan2(-e.root.position.x, -e.root.position.z);
      this.enemies.push({ model: e, hp: 60, maxHp: 60, attack: 0, stun: 0, dead: false, seed: i });
    }
    this.keys = {}; this.mobile = { x: 0, y: 0 }; this.hp = 100; this.xp = 0; this.block = false;
    this.attackTime = 0; this.dodgeTime = 0; this.invuln = 0; this.combo = 0; this.comboWindow = 0;
    this.paused = false; this.started = false; this.clock = new THREE.Clock(); this.lastUpdate = 0;
    this.cameraYaw = 0; this.cameraPitch = .25; this.cameraDistance = 7; this.pointerLocked = false; this.touchLookId = null; this.touchLookPoint = null; this.dodgeDir = new THREE.Vector3(0, 0, -1); this.gameOver = false;
    this.bind();
  }
  bind() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') this.dodge();
      if (e.code === 'KeyJ' || e.code === 'Enter') this.attack();
      if (e.code === 'KeyK') this.setBlock(true);
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; if (e.code === 'KeyK') this.setBlock(false); });
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.paused && !this.isTouch()) this.renderer.domElement.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === this.renderer.domElement; });
    window.addEventListener('mousemove', e => {
      if (this.pointerLocked) {
        this.cameraYaw -= e.movementX * .0025;
        this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch - e.movementY * .0018, -.05, .65);
      }
    });
    window.addEventListener('mousedown', e => { if (e.button === 0 && !this.isTouch() && !this.paused) this.attack(); });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }
  isTouch() { return matchMedia('(pointer: coarse)').matches; }
  setMobileMove(x, y) { this.mobile.x = x; this.mobile.y = y; }
  setBlock(v) { this.block = v; }
  start() { this.started = true; this.clock.start(); this.loop(); }
  pause() { this.paused = true; document.exitPointerLock?.(); document.querySelector('#pauseOverlay').classList.remove('hidden'); }
  resume() { this.paused = false; document.querySelector('#pauseOverlay').classList.add('hidden'); this.clock.getDelta(); }
  attack() {
    if (this.paused || this.hp <= 0 || this.attackTime > 0) return;
    this.attackTime = .34; this.combo = this.comboWindow > 0 ? (this.combo % 3) + 1 : 1; this.comboWindow = .85;
    const p = this.player.root; let target = null, best = 3.25;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = p.position.distanceTo(e.model.root.position);
      if (d < best) {
        const dir = e.model.root.position.clone().sub(p.position).normalize();
        const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(p.quaternion);
        if (facing.dot(dir) > .05) { best = d; target = e; }
      }
    }
    if (target) {
      target.hp -= this.combo === 3 ? 34 : 22; target.stun = .35;
      target.model.root.position.add(p.position.clone().sub(target.model.root.position).normalize().multiplyScalar(-.45));
      this.onToast?.(this.combo === 3 ? '重击命中！' : '命中！');
      if (target.hp <= 0) {
        target.dead = true; this.xp = Math.min(100, this.xp + 20); target.model.root.visible = false;
        this.onToast?.('敌人被击倒 +20 EXP');
      }
    } else this.onToast?.('挥拳！靠近敌人再攻击');
    this.updateUI();
  }
  dodge() { if (this.paused || this.dodgeTime > 0) return; this.dodgeTime = .42; this.invuln = .5; this.dodgeDir.set(0, 0, -1).applyQuaternion(this.player.root.quaternion).normalize(); this.onToast?.('闪避'); }
  updateUI() {
    this.onUpdate?.({ hp: this.hp, xp: this.xp, enemies: this.enemies.filter(e => !e.dead).length });
    if (this.enemies.every(e => e.dead)) document.querySelector('#winOverlay').classList.remove('hidden');
  }
  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), .04);
    if (this.paused) return;
    this.update(dt); this.renderer.render(this.scene, this.camera);
  };
  update(dt) {
    const p = this.player.root;
    this.attackTime = Math.max(0, this.attackTime - dt); this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.invuln = Math.max(0, this.invuln - dt); this.comboWindow = Math.max(0, this.comboWindow - dt);
    const forward = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) + this.mobile.y;
    const side = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0) + this.mobile.x;
    const move = new THREE.Vector3(side, 0, -forward); if (move.lengthSq() > 1) move.normalize();
    const speed = this.keys.ShiftLeft || this.keys.ShiftRight ? 8 : 5.2;\n    if (this.dodgeTime > 0) p.position.addScaledVector(this.dodgeDir, 10 * dt);
    if (move.lengthSq() > .01) {
      const angle = Math.atan2(move.x, -move.z) + this.cameraYaw;
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, angle, Math.min(1, dt * 12));
      const dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)); p.position.addScaledVector(dir, speed * dt);
    }
    p.position.x = THREE.MathUtils.clamp(p.position.x, -48, 48); p.position.z = THREE.MathUtils.clamp(p.position.z, -48, 48);
    const walking = move.lengthSq() > .01 ? 1 : 0; this.player.anim += dt * (walking ? 11 : 3);
    const swing = this.attackTime > 0 ? Math.sin((.34 - this.attackTime) / .34 * Math.PI) : 0;
    this.player.armR.rotation.x = -swing * 1.7; this.player.armL.rotation.x = this.block ? -.9 : 0;
    this.player.armR.rotation.z = -.15 - swing * .35; this.player.armL.rotation.z = .15;
    this.player.legL.rotation.x = Math.sin(this.player.anim) * .55 * walking;
    this.player.legR.rotation.x = -Math.sin(this.player.anim) * .55 * walking;
    this.player.torso.rotation.z = this.attackTime > 0 ? -.15 * swing : 0;
    for (const e of this.enemies) this.updateEnemy(e, dt);
    const behind = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const targetPos = p.position.clone().add(new THREE.Vector3(0, 2.3, 0)).addScaledVector(behind, this.cameraDistance);
    targetPos.y += this.cameraPitch * 8;
    this.camera.position.lerp(targetPos, 1 - Math.exp(-dt * 5));
    this.camera.lookAt(p.position.x, p.position.y + 1.35, p.position.z);
    if (performance.now() - this.lastUpdate > 100) { this.updateUI(); this.lastUpdate = performance.now(); }
    if (this.hp <= 0 && !this.gameOver) { this.hp = 0; this.gameOver = true; this.paused = true; document.exitPointerLock?.(); document.querySelector('#pauseOverlay').classList.add('hidden'); document.querySelector('#gameOverOverlay').classList.remove('hidden'); this.onToast?.('你被击倒了'); }
  }
  updateEnemy(e, dt) {
    if (e.dead) return;
    const m = e.model.root, p = this.player.root, delta = p.position.clone().sub(m.position);
    const dist = delta.length(); e.attack = Math.max(0, e.attack - dt); e.stun = Math.max(0, e.stun - dt);
    if (e.stun > 0) return;
    if (dist > 1.55) {
      delta.normalize(); m.position.addScaledVector(delta, Math.min(2.25 * dt, dist - 1.25));
      m.rotation.y = Math.atan2(-delta.x, -delta.z); e.model.anim += dt * 7;
      e.model.legL.rotation.x = Math.sin(e.model.anim) * .45; e.model.legR.rotation.x = -Math.sin(e.model.anim) * .45;
    } else if (e.attack <= 0) {
      e.attack = 1.35; e.model.armR.rotation.x = -1.1;
      if (this.invuln <= 0 && !this.block) { this.hp = Math.max(0, this.hp - 7); this.onToast?.('受到攻击！'); }
      else if (this.block) this.onToast?.('成功格挡');
    }
  }
}