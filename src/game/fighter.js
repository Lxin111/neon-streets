import * as THREE from 'three';

const mat = (color, roughness=.65, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(g, geo, material, pos, rot) { const m=new THREE.Mesh(geo,material); m.position.set(...pos); if(rot)m.rotation.set(...rot); m.castShadow=true; m.receiveShadow=true; g.add(m); return m; }
function capsule(g,r,len,material,pos) { return mesh(g,new THREE.CapsuleGeometry(r,len,5,10),material,pos); }
function makeKatana(g) {
  const sword=new THREE.Group(); g.add(sword); sword.position.set(.48,1.05,.05); sword.rotation.set(0,0,-.25);
  mesh(sword,new THREE.CylinderGeometry(.025,.032,.42,8),mat('#17191d',.5),[0,-.05,0],[0,0,Math.PI/2]);
  mesh(sword,new THREE.BoxGeometry(.12,.035,.035),mat('#c5a45c',.35,.75),[0,.18,0]);
  mesh(sword,new THREE.BoxGeometry(.045,.92,.018),mat('#dce7eb',.2,.9),[0,.66,0],[0,0,-.08]);
  mesh(sword,new THREE.BoxGeometry(.052,.13,.028),mat('#22252a',.45),[0,.17,0]);
  return sword;
}
function makeFighter(scene,isEnemy=false,index=0) {
  const root=new THREE.Group(); scene.add(root);
  const skin=mat(isEnemy?'#b88769':'#bd9278'), dark=mat('#171a20'), suit=mat(['#242b32','#30343b','#24242a','#343b40'][index%4]), shirt=mat('#d8d8d2'), red=mat('#8c1724',.58), cloth=mat('#641521',.9), metal=mat('#aeb9c0',.25,.85);
  const torso=capsule(root,.37,.62,isEnemy?suit:dark,[0,1.34,0]);
  mesh(root,new THREE.BoxGeometry(.68,.58,.16),isEnemy?suit:red,[0,1.42,-.24]);
  if(!isEnemy){
    // hood, face shadow, long red cloak and shoulder mantle
    mesh(root,new THREE.SphereGeometry(.31,16,12),dark,[0,2.18,-.07],[.18,0,0]);
    mesh(root,new THREE.SphereGeometry(.245,16,12),skin,[0,2.02,.015]);
    mesh(root,new THREE.SphereGeometry(.29,16,10,0,Math.PI*2,0,Math.PI*.52),dark,[0,2.2,-.02]);
    mesh(root,new THREE.ConeGeometry(.34,.48,12),dark,[0,2.28,-.16],[Math.PI,0,0]);
    mesh(root,new THREE.CapsuleGeometry(.43,.95,5,10),cloth,[0,1.22,.28],[.12,0,0]);
    mesh(root,new THREE.BoxGeometry(.92,.16,.42),red,[0,1.72,.02]);
    mesh(root,new THREE.BoxGeometry(.11,1.18,.09),mat('#b78d62',.5),[0,1.27,.34]);
  } else {
    mesh(root,new THREE.SphereGeometry(.245,14,12),skin,[0,2.02,0]);
    mesh(root,new THREE.SphereGeometry(.25,14,8,0,Math.PI*2,0,Math.PI*.45),dark,[0,2.12,-.02]);
    mesh(root,new THREE.BoxGeometry(.1,.42,.035),shirt,[0,1.43,-.34]);
    mesh(root,new THREE.ConeGeometry(.07,.28,4),mat('#6d1821'),[0,1.37,-.37],[Math.PI,0,0]);
  }
  const armL=capsule(root,.12,.48,isEnemy?suit:dark,[-.46,1.42,0]), armR=capsule(root,.12,.48,isEnemy?suit:dark,[.46,1.42,0]);
  const handL=mesh(root,new THREE.SphereGeometry(.12,10,8),skin,[-.48,1.12,0]), handR=mesh(root,new THREE.SphereGeometry(.12,10,8),skin,[.48,1.12,0]);
  const legL=capsule(root,.15,.48,mat('#20252b'),[-.2,.48,0]), legR=capsule(root,.15,.48,mat('#20252b'),[.2,.48,0]);
  mesh(root,new THREE.BoxGeometry(.29,.14,.44),dark,[-.2,.12,-.03]); mesh(root,new THREE.BoxGeometry(.29,.14,.44),dark,[.2,.12,-.03]);
  let sword=null, gun=null;
  if(!isEnemy) sword=makeKatana(root);
  else {
    gun=new THREE.Group(); root.add(gun); gun.position.set(.48,1.08,-.18);
    mesh(gun,new THREE.BoxGeometry(.12,.14,.48),mat('#24282c',.35,.7),[0,0,-.18]);
    mesh(gun,new THREE.BoxGeometry(.07,.18,.12),mat('#16191d'),[0,-.12,-.08]);
  }
  return {root,armL,armR,handL,handR,legL,legR,torso,sword,gun,anim:0,isEnemy};
}
export class FighterGame {
 constructor(world){
  this.world=world;this.scene=world.scene;this.camera=world.camera;this.renderer=world.renderer;
  this.player=makeFighter(this.scene,false);this.player.root.position.set(0,0,5);this.player.root.rotation.y=Math.PI;
  this.enemies=[];
  for(let i=0;i<7;i++){const model=makeFighter(this.scene,true,i),a=i/7*Math.PI*2;model.root.position.set(Math.cos(a)*9,0,-Math.sin(a)*9);model.root.rotation.y=Math.atan2(-model.root.position.x,-model.root.position.z);this.enemies.push({model,hp: i>=4?48:65,attack:1+Math.random(),stun:0,dead:false,seed:i,ranged:i>=4});}
  this.bullets=[];this.keys={};this.mobile={x:0,y:0};this.hp=100;this.xp=0;this.block=false;this.attackTime=0;this.iaidoTime=0;this.dodgeTime=0;this.invuln=0;this.combo=0;this.comboWindow=0;this.parryWindow=0;this.buff=null;this.buffTime=0;this.slowScale=.2;
  this.paused=false;this.started=false;this.clock=new THREE.Clock();this.lastUpdate=0;this.cameraYaw=0;this.cameraPitch=.25;this.cameraDistance=7;this.pointerLocked=false;this.touchLookId=null;this.touchLookPoint=null;this.dodgeDir=new THREE.Vector3(0,0,-1);this.gameOver=false;this.bind();
 }
 bind(){
  window.addEventListener('keydown',e=>{this.keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')this.dodge();if(e.code==='KeyJ'||e.code==='Enter')this.attack();if(e.code==='KeyL')this.iaido();if(e.code==='KeyK')this.setBlock(true);});
  window.addEventListener('keyup',e=>{this.keys[e.code]=false;if(e.code==='KeyK')this.setBlock(false);});
  this.renderer.domElement.addEventListener('click',()=>{if(!this.paused&&!this.isTouch())this.renderer.domElement.requestPointerLock?.();});
  document.addEventListener('pointerlockchange',()=>{this.pointerLocked=document.pointerLockElement===this.renderer.domElement;});
  window.addEventListener('mousemove',e=>{if(this.pointerLocked){this.cameraYaw-=e.movementX*.0025;this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch-e.movementY*.0018,-.05,.65);}});
  window.addEventListener('mousedown',e=>{if(e.button===0&&!this.isTouch()&&!this.paused)this.attack();if(e.button===2&&!this.isTouch())this.iaido();});
  window.addEventListener('contextmenu',e=>e.preventDefault());
 }
 isTouch(){return matchMedia('(pointer: coarse)').matches;}
 setMobileMove(x,y){this.mobile.x=x;this.mobile.y=y;}
 setBlock(v){if(v&&!this.block)this.parryWindow=.24;this.block=v;}
 start(){this.started=true;this.clock.start();this.loop();}
 pause(){this.paused=true;document.exitPointerLock?.();document.querySelector('#pauseOverlay').classList.remove('hidden');}
 resume(){this.paused=false;document.querySelector('#pauseOverlay').classList.add('hidden');this.clock.getDelta();}
 attack(){
  if(this.paused||this.hp<=0||this.attackTime>0||this.iaidoTime>0)return;
  this.attackTime=.42;this.combo=this.comboWindow>0?this.combo%3+1:1;this.comboWindow=.9;
  this.player.sword.rotation.z=-1.15;const p=this.player.root;let target=null,best=3.6;
  for(const e of this.enemies){if(e.dead)continue;const d=p.position.distanceTo(e.model.root.position),dir=e.model.root.position.clone().sub(p.position).normalize(),facing=new THREE.Vector3(0,0,-1).applyQuaternion(p.quaternion);if(d<best&&facing.dot(dir)>.0){best=d;target=e;}}
  if(target){this.damageEnemy(target,this.combo===3?42:28);target.stun=.5;target.model.root.position.add(p.position.clone().sub(target.model.root.position).normalize().multiplyScalar(-.5));this.onToast?.(this.combo===3?'太刀·三连斩！':'太刀斩击！');}
  else this.onToast?.('斩空了：靠近敌人并面向目标');
  this.updateUI();
 }
 iaido(){
  if(this.paused||this.hp<=0||this.iaidoTime>0||this.attackTime>0)return;
  this.iaidoTime=.72;this.invuln=Math.max(this.invuln,.28);this.player.sword.rotation.z=-2.2;
  const p=this.player.root,dir=new THREE.Vector3(0,0,-1).applyQuaternion(p.quaternion).normalize();p.position.addScaledVector(dir,2.2);
  let hit=null,best=4.4;for(const e of this.enemies){if(e.dead)continue;const d=p.position.distanceTo(e.model.root.position),to=e.model.root.position.clone().sub(p.position).normalize();if(d<best&&dir.dot(to)>.35){best=d;hit=e;}}
  if(hit){this.damageEnemy(hit,58);hit.stun=.9;this.onToast?.('居合拔刀斩！');}else this.onToast?.('居合斩！');
 }
 damageEnemy(e,damage){e.hp-=damage;if(e.hp<=0&&!e.dead){e.dead=true;e.model.root.visible=false;this.xp=Math.min(100,this.xp+20);this.rollBuff();this.onToast?.('击杀 +20 EXP');}}
 rollBuff(){
  const buffs=[['无敌',8],['霸体',9],['狂暴',10],['斯安威斯坦',6]];
  const b=buffs[Math.floor(Math.random()*buffs.length)];this.buff=b[0];this.buffTime=b[1];this.onToast?.('获得随机强化：'+this.buff);this.updateUI();
 }
 dodge(){if(this.paused||this.dodgeTime>0)return;this.dodgeTime=.42;this.invuln=.5;this.dodgeDir.set(0,0,-1).applyQuaternion(this.player.root.quaternion).normalize();this.onToast?.('闪避');}
 updateUI(){this.onUpdate?.({hp:this.hp,xp:this.xp,enemies:this.enemies.filter(e=>!e.dead).length,buff:this.buff,buffTime:this.buffTime});if(this.enemies.every(e=>e.dead))document.querySelector('#winOverlay').classList.remove('hidden');}
 loop=()=>{requestAnimationFrame(this.loop);const dt=Math.min(this.clock.getDelta(),.04);if(this.paused)return;this.update(dt);this.renderer.render(this.scene,this.camera);};
 update(dt){
  const p=this.player.root;this.attackTime=Math.max(0,this.attackTime-dt);this.iaidoTime=Math.max(0,this.iaidoTime-dt);this.dodgeTime=Math.max(0,this.dodgeTime-dt);this.invuln=Math.max(0,this.invuln-dt);this.parryWindow=Math.max(0,this.parryWindow-dt);this.comboWindow=Math.max(0,this.comboWindow-dt);
  this.buffTime=Math.max(0,this.buffTime-dt);if(this.buffTime===0)this.buff=null;
  const slow=this.buff==='斯安威斯坦'?.2:1,worldDt=dt*slow;
  const forward=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)+this.mobile.y,side=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.mobile.x;
  const move=new THREE.Vector3(side,0,-forward);if(move.lengthSq()>1)move.normalize();const speed=(this.buff==='狂暴'?7.4:5.2)*(this.keys.ShiftLeft||this.keys.ShiftRight?1.45:1);
  if(this.dodgeTime>0)p.position.addScaledVector(this.dodgeDir,10*dt);
  if(move.lengthSq()>.01){const angle=Math.atan2(move.x,-move.z)+this.cameraYaw;p.rotation.y=THREE.MathUtils.lerp(p.rotation.y,angle,Math.min(1,dt*12));p.position.addScaledVector(new THREE.Vector3(Math.sin(angle),0,-Math.cos(angle)),speed*dt);}
  p.position.x=THREE.MathUtils.clamp(p.position.x,-48,48);p.position.z=THREE.MathUtils.clamp(p.position.z,-48,48);
  const walking=move.lengthSq()>.01;this.player.anim+=dt*(walking?11:3);const swing=this.attackTime>0?Math.sin((.42-this.attackTime)/.42*Math.PI):this.iaidoTime>0?1:0;
  this.player.armR.rotation.x=-swing*1.8;this.player.armL.rotation.x=this.block?-.95:0;this.player.armR.rotation.z=-.15-swing*.45;this.player.armL.rotation.z=.15;this.player.sword.rotation.z=this.block?-.9:(this.attackTime>0?-1.15*swing:this.iaidoTime>0?-2.2:0);
  this.player.legL.rotation.x=Math.sin(this.player.anim)*.5*(walking?1:0);this.player.legR.rotation.x=-Math.sin(this.player.anim)*.5*(walking?1:0);this.player.torso.rotation.z=this.attackTime>0?-.15*swing:0;
  for(const e of this.enemies)this.updateEnemy(e,worldDt);
  this.updateBullets(dt,worldDt);
  const behind=new THREE.Vector3(Math.sin(this.cameraYaw),0,Math.cos(this.cameraYaw)),targetPos=p.position.clone().add(new THREE.Vector3(0,2.3,0)).addScaledVector(behind,this.cameraDistance);targetPos.y+=this.cameraPitch*8;this.camera.position.lerp(targetPos,1-Math.exp(-dt*5));this.camera.lookAt(p.position.x,p.position.y+1.35,p.position.z);
  if(performance.now()-this.lastUpdate>100){this.updateUI();this.lastUpdate=performance.now();}
  if(this.hp<=0&&!this.gameOver){this.hp=0;this.gameOver=true;this.paused=true;document.exitPointerLock?.();document.querySelector('#pauseOverlay').classList.add('hidden');document.querySelector('#gameOverOverlay').classList.remove('hidden');this.onToast?.('你被击倒了');}
 }
 updateEnemy(e,dt){
  if(e.dead)return;const m=e.model.root,p=this.player.root,delta=p.position.clone().sub(m.position),dist=delta.length();e.attack-=dt;e.stun=Math.max(0,e.stun-dt);if(e.stun>0)return;
  if(e.ranged){m.rotation.y=Math.atan2(-delta.x,-delta.z);if(dist>7){delta.normalize();m.position.addScaledVector(delta,Math.min(1.5*dt,dist-6));}if(e.attack<=0&&dist<19){e.attack=2.3+Math.random();this.fireBullet(e);}}
  else if(dist>1.65){delta.normalize();m.position.addScaledVector(delta,Math.min(2.1*dt,dist-1.3));m.rotation.y=Math.atan2(-delta.x,-delta.z);e.model.anim+=dt*7;e.model.legL.rotation.x=Math.sin(e.model.anim)*.45;e.model.legR.rotation.x=-Math.sin(e.model.anim)*.45;}
  else if(e.attack<=0){e.attack=1.4;e.model.armR.rotation.x=-1.1;if(this.invuln<=0&&!this.block&&this.buff!=='无敌'&&this.buff!=='霸体'){this.hp=Math.max(0,this.hp-8);this.onToast?.('受到攻击！');}else this.onToast?.('成功挡下攻击');}
 }
 fireBullet(e){const start=e.model.root.position.clone().add(new THREE.Vector3(0,1.35,0)),target=this.player.root.position.clone().add(new THREE.Vector3(0,1.1,0)),dir=target.sub(start).normalize();const b=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),mat('#ffb45d',.25,.6));b.position.copy(start);b.material.emissive=new THREE.Color('#ff6b24');b.material.emissiveIntensity=1.5;this.scene.add(b);this.bullets.push({mesh:b,vel:dir.multiplyScalar(13),life:3,source:e});}
 updateBullets(realDt,dt){
  for(let i=this.bullets.length-1;i>=0;i--){const b=this.bullets[i];b.life-=dt;b.mesh.position.addScaledVector(b.vel,dt);if(b.life<=0){this.scene.remove(b.mesh);this.bullets.splice(i,1);continue;}
   const to=this.player.root.position.clone().add(new THREE.Vector3(0,1.1,0)).sub(b.mesh.position);
   if(to.length()<.48){
    if(this.parryWindow>0){const dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.root.quaternion);b.vel.copy(dir.multiplyScalar(23));b.source=null;this.parryWindow=0;this.onToast?.('完美弹反！子弹反射');continue;}
    if(this.block||this.buff==='无敌'||this.buff==='霸体'||this.invuln>0){this.onToast?.('太刀格挡子弹！');this.scene.remove(b.mesh);this.bullets.splice(i,1);continue;}
    this.hp=Math.max(0,this.hp-12);this.scene.remove(b.mesh);this.bullets.splice(i,1);this.onToast?.('被子弹击中！');continue;
   }
   if(!b.source){for(const e of this.enemies){if(!e.dead&&b.mesh.position.distanceTo(e.model.root.position.clone().add(new THREE.Vector3(0,1,0)))<.6){this.damageEnemy(e,35);e.stun=.6;this.scene.remove(b.mesh);this.bullets.splice(i,1);break;}}}
  }
 }
}
