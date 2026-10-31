import './style.css';
import {createWorld} from './game/world.js';
import {FighterGame,SWORDS} from './game/fighter.js';
const loading=document.querySelector('#loading');
const loadingBar=document.querySelector('#loadingBar');
const loadingPercent=document.querySelector('#loadingPercent');
const loadingTask=document.querySelector('#loadingTask');
function setLoadingProgress(value,task){
  const percent=Math.max(0,Math.min(100,value));
  loadingBar.style.width=percent.toFixed(2)+'%';
  loadingPercent.textContent=percent.toFixed(2)+'%';
  loadingTask.textContent=task;
}
const nextFrame=()=>new Promise(resolve=>{let finished=false;const done=()=>{if(finished)return;finished=true;resolve();};if(typeof requestAnimationFrame==='function')requestAnimationFrame(done);setTimeout(done,40);});
setLoadingProgress(3,'正在初始化 WebGL 图形设备…');
await nextFrame();
const app=document.querySelector('#app');
const world=await createWorld(setLoadingProgress);
app.prepend(world.renderer.domElement);
let game;
let startupStage='准备战斗系统';
const hud=document.querySelector('#hud');
try {
 startupStage='准备战斗系统';setLoadingProgress(96,'正在准备战斗系统…');
 await nextFrame();
 setLoadingProgress(96.01,'正在初始化战斗控制…');
 startupStage='创建战斗控制器';game=new FighterGame(world);
 setLoadingProgress(96.05,'正在分阶段初始化玩家与敌人…');
 startupStage='创建玩家模型和初始敌人';await game.initializeFirstEncounter((ratio,task)=>setLoadingProgress(96.05+ratio*.9,task||'正在初始化战斗… '+Math.round(ratio*100)+'%'));
 await nextFrame();
 setLoadingProgress(97,'正在载入真人扫描模型、4K材质与动作捕捉…');
 startupStage='加载真人扫描角色模型';const modelLoaded=await game.loadRealisticEnemyModel(ratio=>setLoadingProgress(97+ratio*2,'正在载入真人扫描模型与动作捕捉…'));
 setLoadingProgress(99,modelLoaded?'正在启动战斗系统与操作控制…':'真人扫描模型暂不可用，正在启用基础角色…');
 await nextFrame();
 startupStage='启动游戏主循环';game.start();
 setLoadingProgress(100,'加载完成，进入街区！');
 await new Promise(resolve=>setTimeout(resolve,260));
 loading.classList.add('hidden');
 hud.classList.remove('hidden');
} catch(error) {
 console.error('游戏启动失败：',error);
 loading.classList.remove('hidden');
 loadingPercent.textContent='!';
 loadingBar.style.width='100%';
 const detail=(error?.stack||'').split('\\n').slice(0,4).join(' | ');loadingTask.textContent='启动失败（'+startupStage+'）：'+(error?.message||String(error))+(detail?' · '+detail:'')+'。';
 throw error;
}
const hpBar=document.querySelector('#hpBar'),hpText=document.querySelector('#hpText'),xpBar=document.querySelector('#xpBar'),xpText=document.querySelector('#xpText'),enemyCount=document.querySelector('#enemyCount'),objective=document.querySelector('#objective'),toastEl=document.querySelector('#toast'),buffEl=document.querySelector('#buffStatus'),goldEl=document.querySelector('#goldCount'),chargeEl=document.querySelector('#chargeCount');
function renderLists(){const killRows=[10,25,50,100,250,500,1000].map(n=>({title:'击败 '+n+' 名敌人',desc:'累计击杀挑战',reward:n>=500?100:n>=100?35:n>=50?20:10,done:game.kills>=n}));const catalog=game.getAchievementCatalog(),earned=new Map(game.achievementRecords.map(x=>[x.id,x]));const catalogIds=new Set(catalog.map(x=>x.id));const records=[...killRows,...catalog.map(x=>({title:x.title,desc:x.desc,reward:x.reward,done:earned.has(x.id)})),...game.achievementRecords.filter(x=>!catalogIds.has(x.id)).map(x=>({title:x.title,desc:x.desc,reward:x.reward,done:true}))];document.querySelector('#achievementList').innerHTML='<div class="achievement-summary">新增 '+catalog.length+' 项挑战 · 已完成 '+catalog.filter(x=>earned.has(x.id)).length+'/'+catalog.length+' · 累计击杀 '+game.kills+'</div>'+records.map(x=>'<div class="list-row '+(x.done?'earned':'')+'"><span><b>'+x.title+'</b><small>'+x.desc+'</small></span><strong>'+(x.done?'已完成 ✓':'奖励 '+x.reward+' 金币')+'</strong></div>').join('');const groups=game.shopCategories.map(category=>'<section class="shop-category"><h3 class="shop-subhead">'+category+'</h3><div class="shop-category-grid">'+game.shopItems.filter(x=>x.category===category).map(x=>'<button class="shop-item" data-buy-item="'+x.id+'"><b>'+x.name+'</b><small>'+x.desc+'</small><strong>'+x.price+' 金币</strong></button>').join('')+'</div></section>').join('');document.querySelector('#shopList').innerHTML='<div class="shop-count">共 '+game.shopItems.length+' 件商品 · 金币：'+game.gold+'</div>'+groups+'<h3 class="shop-subhead">元素太刀收藏</h3>'+SWORDS.map(x=>'<button class="sword-card" data-sword="'+x.id+'"><i style="--blade:'+x.color+'"></i><span>'+x.name+'太刀</span><b>'+(game.swordId===x.id?'已装备':game.ownedSwords.includes(x.id)?'已拥有':'10 金币')+'</b></button>').join('');document.querySelectorAll('[data-sword]').forEach(b=>b.addEventListener('click',()=>{game.buySword(b.dataset.sword);renderLists();}));document.querySelectorAll('[data-buy-item]').forEach(b=>b.addEventListener('click',()=>{game.buyShopItem(b.dataset.buyItem);renderLists();}));}
game.onUpdate=s=>{document.querySelector('#statHealth').textContent=Math.ceil(s.hp)+' / '+s.maxHp;document.querySelector('#statAttack').textContent=s.attack;document.querySelector('#statSpeed').textContent=Math.round(s.attackSpeed*100)+'%';document.querySelector('#statCrit').textContent=s.crit.toFixed(0)+'%';document.querySelector('#statCritDmg').textContent=s.critDamage.toFixed(0)+'%';document.querySelector('#statCores').textContent=game.cores.length+' / 10';document.querySelector('#coreCount').textContent=game.cores.length+' / 10';document.querySelector('#coreSlots').innerHTML=game.coreSlots.map(c=>'<i title="'+(c?.name||'空核心槽')+'" class="'+(c?'filled':'')+'">'+(c?'✦':'·')+'</i>').join('');document.querySelector('#statsCoreSlots').innerHTML=document.querySelector('#coreSlots').innerHTML;hpBar.style.width=s.hp+'%';hpText.textContent=Math.ceil(s.hp)+' / '+s.maxHp;hpBar.style.width=(s.hp/s.maxHp*100)+'%';xpBar.style.width=s.xp+'%';xpText.textContent=s.xp+' / 100';enemyCount.textContent='剩余敌人：'+s.enemies;buffEl.textContent=s.buff?'强化效果：'+s.buff+' · '+s.buffTime.toFixed(1)+'s':'当前强化：无';goldEl.textContent=s.gold;chargeEl.textContent='自动';if(s.enemies===0&&game.encounterCleared)objective.textContent='街区已清理 · 向前走';if(s.poison>0)buffEl.textContent='中毒 '+s.poison.toFixed(1)+'s · 攻速/移速 -50%';};
game.onToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(game.toastTimer);game.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1800);};game.onAchievement=n=>renderLists();
game.onWeaponChest=show=>{if(show){document.querySelector('#weaponOverlay').classList.remove('hidden');game.paused=true;document.exitPointerLock?.();}};
game.onStatsToggle=()=>{const el=document.querySelector('#statsOverlay');const opening=el.classList.contains('hidden');el.classList.toggle('hidden');game.paused=opening; if(opening)document.exitPointerLock?.();else game.clock.getDelta();};
const environmentOverlay=document.querySelector('#environmentOverlay'),environmentBtn=document.querySelector('#environmentBtn'),worldTime=document.querySelector('#worldTime'),worldTimeLabel=document.querySelector('#worldTimeLabel'),worldWeather=document.querySelector('#worldWeather');
const formatWorldTime=value=>{const hours=Math.floor(Number(value)),minutes=Math.round((Number(value)-hours)*60);return String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0');};
const syncEnvironmentControls=()=>{worldTime.value=game.world.environment.time;worldTimeLabel.textContent=formatWorldTime(worldTime.value);worldWeather.value=game.world.environment.weather;};
const closeEnvironment=()=>{environmentOverlay.classList.add('hidden');game.paused=false;game.clock.getDelta();};
game.onEnvironmentToggle=()=>{const opening=environmentOverlay.classList.contains('hidden');if(opening){document.exitPointerLock?.();game.keys={};game.setBlock(false);syncEnvironmentControls();environmentOverlay.classList.remove('hidden');game.paused=true;}else closeEnvironment();};
environmentBtn.addEventListener('click',()=>game.onEnvironmentToggle());
document.querySelector('#closeEnvironment').addEventListener('click',closeEnvironment);
worldTime.addEventListener('input',()=>{game.world.environment.setTime(worldTime.value);worldTimeLabel.textContent=formatWorldTime(worldTime.value);});
worldWeather.addEventListener('change',()=>game.world.environment.setWeather(worldWeather.value));
document.querySelectorAll('[data-time-preset]').forEach(button=>button.addEventListener('click',()=>{game.world.environment.setTime(button.dataset.timePreset);syncEnvironmentControls();}));
syncEnvironmentControls();

game.onBoss=s=>{const panel=document.querySelector('#bossPanel');panel.classList.toggle('hidden',!s.show);panel.querySelector('div:first-child').firstChild.textContent=(s.name||'BOSS')+' ';document.querySelector('#bossHpBar').style.width=(s.hp/s.maxHp*100)+'%';document.querySelector('#bossHpText').textContent=Math.ceil(s.hp)+' / '+s.maxHp;};
game.onAdvance=s=>{document.querySelector('#advancePanel').classList.toggle('hidden',!s.show);document.querySelector('#advancePanel').textContent=s.show?'街区已清理 · 沿道路继续前进':' ';};game.onDistrict=n=>{document.querySelector('.district').textContent='DISTRICT '+String(n).padStart(2,'0')+' · ENDLESS BLOCK';document.querySelector('#objective').textContent='清理第 '+n+' 个街区';};game.onDistrict(game.districtNumber);
game.onCore=(slots,inventory)=>{document.querySelector('#coreCount').textContent=game.cores.length+' / 10';document.querySelector('#coreSlots').innerHTML=slots.map(c=>'<i title="'+(c?.name||'空核心槽')+'" class="'+(c?'filled':'')+'">'+(c?'✦':'·')+'</i>').join('');document.querySelector('#statsCoreSlots').innerHTML=document.querySelector('#coreSlots').innerHTML;document.querySelector('#coreInventory').innerHTML='<h3>可装备核心</h3>'+inventory.map((c,i)=>'<button class="core-item" data-equip-core="'+i+'"><b>'+c.name+'</b><small>攻击 +'+c.attack+' · 攻速 +'+c.speed+'% · 暴击 +'+c.crit+'% · 爆伤 +'+c.critDmg+'% · 生命 +'+c.hp+'</small><strong>'+(game.cores.includes(c)?'已装备':'装备到空槽')+'</strong></button>').join('');document.querySelectorAll('[data-equip-core]').forEach(b=>b.addEventListener('click',()=>game.equipCore(Number(b.dataset.equipCore))));};
// District progression is triggered by physically reaching the road marker; no click-to-skip button.
game.onWeaponChange=id=>{document.querySelector('#statWeapon').textContent=({katana:'太刀',solar:'太阳神剑',demon:'魔刀千刃',ak:'AK47'}[id]||id);document.querySelector('#statAttack').textContent=({katana:15,solar:25,demon:18,ak:12}[id]||15);};
document.querySelector('#closeStats').addEventListener('click',()=>{document.querySelector('#statsOverlay').classList.add('hidden');game.paused=false;game.clock.getDelta();});
document.querySelectorAll('[data-pick-weapon]').forEach(btn=>btn.addEventListener('click',()=>{game.chooseWeapon(btn.dataset.pickWeapon);document.querySelector('#weaponOverlay').classList.add('hidden');if(game.chest){game.scene.remove(game.chest.group);game.chest=null;}game.paused=false;game.clock.getDelta();}));
document.querySelectorAll('[data-weapon]').forEach(btn=>btn.addEventListener('click',()=>game.switchWeapon(btn.dataset.weapon)));
const musicBtn=document.querySelector('#musicBtn');const syncMusicButton=()=>{musicBtn.textContent='音乐：'+(game.audio.musicEnabled?'开':'关');musicBtn.setAttribute('aria-pressed',String(game.audio.musicEnabled));};syncMusicButton();musicBtn.addEventListener('click',()=>{game.audio.toggleMusic();syncMusicButton();});
document.querySelector('#pauseBtn').addEventListener('click',()=>game.pause());document.querySelector('#resumeBtn').addEventListener('click',()=>game.resume());for(const id of ['restartBtn','againBtn','retryBtn'])document.querySelector('#'+id).addEventListener('click',()=>location.reload());
const openMenu=id=>{document.exitPointerLock?.();game.keys={};game.setBlock(false);renderLists();document.querySelector(id).classList.remove('hidden');game.paused=true;};document.querySelector('#shopBtn').addEventListener('click',()=>openMenu('#shopOverlay'));document.querySelector('#achievementBtn').addEventListener('click',()=>openMenu('#achievementOverlay'));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.overlay').forEach(x=>{if(x.id==='shopOverlay'||x.id==='achievementOverlay')x.classList.add('hidden');});game.paused=false;game.clock.getDelta();}));
const actions={attack:()=>game.attack(),dodge:()=>game.dodge(),block:()=>game.setBlock(true),iaido:()=>game.iaido(),clear:()=>game.clearScreen()};
document.querySelectorAll('[data-action]').forEach(btn=>{const a=btn.dataset.action;btn.addEventListener('pointerdown',e=>{e.preventDefault();actions[a]?.();});if(a==='block'){const up=()=>game.setBlock(false);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);}});
const stick=document.querySelector('#stick'),knob=document.querySelector('#stickKnob');let stickId=null;
function stickMove(e){if(stickId!==e.pointerId)return;const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=37;if(len>max){dx=dx/len*max;dy=dy/len*max;}knob.style.transform='translate('+dx+'px,'+dy+'px)';game.setMobileMove(dx/max,-dy/max);}
stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(stickId);stickMove(e);});stick.addEventListener('pointermove',stickMove);function stickEnd(){stickId=null;knob.style.transform='';game.setMobileMove(0,0);}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);window.addEventListener('resize',()=>world.resize());renderLists();
