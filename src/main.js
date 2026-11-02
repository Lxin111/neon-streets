import './style.css';
import {createWorld} from './game/world.js';
import {FighterGame,SWORDS} from './game/fighter.js';
const loading=document.querySelector('#loading');
const loadingBar=document.querySelector('#loadingBar');
const loadingPercent=document.querySelector('#loadingPercent');
const loadingTask=document.querySelector('#loadingTask');
const gameVersion=document.querySelector('#gameVersion');
fetch(`${import.meta.env.BASE_URL}version.txt`,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('version unavailable');return response.text();}).then(version=>{const value=version.trim();if(/^\d+\.\d+\.\d+\.\d+$/.test(value))gameVersion.textContent=value;}).catch(()=>{});
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
 setLoadingProgress(97,'正在启动街区与战斗系统…');
 startupStage='后台加载普通敌人扫描模型';
 const modelLoadTask=game.loadRealisticEnemyModel().then(loaded=>{if(!loaded)console.info('真人扫描模型暂不可用，继续使用普通敌人程序模型。');return loaded;}).catch(error=>{console.warn('真人扫描模型后台加载失败，游戏继续运行。',error);return false;});
 await nextFrame();
 setLoadingProgress(99,'正在启动战斗系统与操作控制…');
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
if(new URLSearchParams(location.search).get('test')==='1')window.__NEON_STREETS_TEST__={game,world};
const syncModalPause=()=>{const modalOpen=[...document.querySelectorAll('.overlay')].some(el=>!el.classList.contains('hidden'));if(modalOpen){game.paused=true;game.keys={};game.mobile={x:0,y:0};game.setBlock(false);document.exitPointerLock?.();}else if(!game.gameOver){game.paused=false;game.clock.getDelta();}document.querySelector('#hud').dataset.paused=String(game.paused);};
const modalObserver=new MutationObserver(syncModalPause);document.querySelectorAll('.overlay').forEach(el=>modalObserver.observe(el,{attributes:true,attributeFilter:['class']}));
const hpBar=document.querySelector('#hpBar'),hpText=document.querySelector('#hpText'),xpBar=document.querySelector('#xpBar'),xpText=document.querySelector('#xpText'),enemyCount=document.querySelector('#enemyCount'),objective=document.querySelector('#objective'),toastEl=document.querySelector('#toast'),buffEl=document.querySelector('#buffStatus'),goldEl=document.querySelector('#goldCount'),chargeEl=document.querySelector('#chargeCount');
function renderSystems(){
 const skills=[['edge','锋刃精通','永久攻击力 +8%',1],['vital','生命强化','生命上限 +20',1],['swift','疾风步','移动速度 +8%',1],['critical','弱点洞察','暴击率 +5%',2],['dodge','极限闪避','闪避无敌时间 +0.2秒',2],['ki','剑气增幅','剑气伤害 +25%',2]];
 document.querySelector('#skillPoints').textContent='可用技能点：'+game.skillPoints;
 document.querySelector('#skillList').innerHTML=skills.map(([id,name,desc,cost])=>{const owned=game.unlockedSkills.includes(id);return '<div class="list-row '+(owned?'earned':'')+'"><span><b>'+name+'</b><small>'+desc+' · 消耗 '+cost+' 点</small></span><button class="system-action" data-skill="'+id+'" '+(owned||game.skillPoints<cost?'disabled':'')+'>'+(owned?'已解锁':'解锁')+'</button></div>';}).join('');
 document.querySelectorAll('[data-skill]').forEach(b=>b.addEventListener('click',()=>{game.unlockSkill(b.dataset.skill);renderSystems();}));
 const quests=game.getQuestCatalog();
 document.querySelector('#questList').innerHTML=quests.map(q=>{const value=Number(game.questState.progress[q.type])||0,claimed=game.questState.claimed.includes(q.id),done=value>=q.target;return '<div class="list-row '+(claimed?'earned':'')+'"><span><b>'+q.title+'</b><small>'+q.desc+' · '+Math.min(value,q.target)+'/'+q.target+' · 奖励 '+q.reward+' 金币</small></span><button class="system-action" data-claim-quest="'+q.id+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'已领取':done?'领取奖励':'进行中')+'</button></div>';}).join('');
 document.querySelectorAll('[data-claim-quest]').forEach(b=>b.addEventListener('click',()=>{game.claimQuest(b.dataset.claimQuest);renderSystems();}));
 const longMissions=game.getLongMissionCatalog();
 for(const kind of ['主线','悬赏']){
  const rows=longMissions.filter(m=>m.kind===kind);
  document.querySelector('#questList').insertAdjacentHTML('beforeend','<h3 class="shop-subhead">'+(kind==='主线'?'主线任务 · 街区战役':'悬赏任务 · 长期通缉')+'</h3>'+rows.map(m=>{const claimed=m.claims.includes(m.id),done=m.progress>=m.target;return '<div class="list-row '+(claimed?'earned':'')+'"><span><b>'+m.title+'</b><small>'+m.desc+' · '+Math.min(m.progress,m.target)+'/'+m.target+' · 奖励 '+m.reward+' 金币</small></span><button class="system-action" data-claim-mission="'+m.id+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'已领取':done?'领取奖励':'未完成')+'</button></div>';}).join(''));
 }
 document.querySelectorAll('[data-claim-mission]').forEach(b=>b.addEventListener('click',()=>{game.claimLongMission(b.dataset.claimMission);renderSystems();}));
 const entries=[['street','普通街头敌人','近战基础单位，贴近后挥拳攻击。'],['shooter','远程射手','保持距离并发射弹道攻击。'],['elite','精英战术兵','高生命值精英单位，具备强化攻击。'],['hulk','绿巨人','巨型近战Boss，会抬腿蓄力并重踏地面。'],['spider','黑蜘蛛','高速蛛形Boss，使用蛛网远程控制。'],['colossus','裂地巨像','重装石质Boss，擅长范围震地攻击。'],['reaper','虚空收割者','虚空Boss，连续发射追踪弹幕。']];
 document.querySelector('#codexList').innerHTML=entries.map(([id,name,desc])=>{const seen=game.bestiarySeen.includes(id);return '<div class="list-row '+(seen?'earned':'')+'"><span><b>'+(seen?name:'未知目标')+'</b><small>'+(seen?desc:'击败该类型敌人以解锁档案')+'</small></span><strong>'+(seen?'已解锁':'未发现')+'</strong></div>';}).join('');
 document.querySelector('#saveSummary').textContent='当前第 '+game.districtNumber+' 街区 · 已解锁最高第 '+(game.maxDistrictReached||game.districtNumber)+' 街区 · LV.'+game.level+' · '+game.gold+' 金币 · '+game.cores.length+' 个已装备核心 · '+game.unlockedSkills.length+' 项技能';
 const districtInput=document.querySelector('#historyDistrictInput');districtInput.max=String(Math.max(1,game.maxDistrictReached||game.districtNumber));districtInput.value=String(game.districtNumber);
  const history=game.getCampaignHistory();document.querySelector('#campaignHistory').innerHTML=history.length?history.map(s=>'<div class="list-row history-row"><span><b>第 '+Number(s.districtNumber)+' 街区 · LV.'+Number(s.level)+'</b><small>'+String(s.reason||'历史存档')+' · '+new Date(Number(s.updatedAt)||Date.now()).toLocaleString()+' · '+Number(s.gold||0)+' 金币</small></span><button class="system-action" data-restore-history="'+String(s.id).replace(/[^a-zA-Z0-9_-]/g,'')+'">回到此处</button></div>').join(''):'<div class="list-row"><span>暂无历史存档。推进街区或点击“创建历史存档”即可留下回档点。</span></div>';

}
function renderLists(){const killRows=[10,25,50,100,250,500,1000].map(n=>({title:'击败 '+n+' 名敌人',desc:'累计击杀挑战',reward:n>=500?100:n>=100?35:n>=50?20:10,done:game.kills>=n}));const catalog=game.getAchievementCatalog(),earned=new Map(game.achievementRecords.map(x=>[x.id,x]));const catalogIds=new Set(catalog.map(x=>x.id));const records=[...killRows,...catalog.map(x=>({title:x.title,desc:x.desc,reward:x.reward,done:earned.has(x.id)})),...game.achievementRecords.filter(x=>!catalogIds.has(x.id)).map(x=>({title:x.title,desc:x.desc,reward:x.reward,done:true}))];document.querySelector('#achievementList').innerHTML='<div class="achievement-summary">新增 '+catalog.length+' 项挑战 · 已完成 '+catalog.filter(x=>earned.has(x.id)).length+'/'+catalog.length+' · 累计击杀 '+game.kills+'</div>'+records.map(x=>'<div class="list-row '+(x.done?'earned':'')+'"><span><b>'+x.title+'</b><small>'+x.desc+'</small></span><strong>'+(x.done?'已完成 ✓':'奖励 '+x.reward+' 金币')+'</strong></div>').join('');const groups=game.shopCategories.map(category=>'<section class="shop-category"><h3 class="shop-subhead">'+category+'</h3><div class="shop-category-grid">'+game.shopItems.filter(x=>x.category===category).map(x=>'<button class="shop-item" data-buy-item="'+x.id+'"><b>'+x.name+'</b><small>'+x.desc+'</small><strong>'+x.price+' 金币</strong></button>').join('')+'</div></section>').join('');document.querySelector('#shopList').innerHTML='<div class="shop-count">共 '+game.shopItems.length+' 件商品 · 金币：'+game.gold+'</div>'+groups+'<h3 class="shop-subhead">元素太刀收藏</h3>'+SWORDS.map(x=>'<button class="sword-card" data-sword="'+x.id+'"><i style="--blade:'+x.color+'"></i><span>'+x.name+'太刀</span><b>'+(game.swordId===x.id?'已装备':game.ownedSwords.includes(x.id)?'已拥有':'10 金币')+'</b></button>').join('');document.querySelectorAll('[data-sword]').forEach(b=>b.addEventListener('click',()=>{game.buySword(b.dataset.sword);renderLists();}));document.querySelectorAll('[data-buy-item]').forEach(b=>b.addEventListener('click',()=>{game.buyShopItem(b.dataset.buyItem);renderLists();}));}
game.onUpdate=s=>{const safeMax=Number.isFinite(s.maxHp)&&s.maxHp>0?s.maxHp:100,safeHp=Number.isFinite(s.hp)?Math.max(0,Math.min(safeMax,s.hp)):safeMax;document.querySelector('#playerLevel').textContent='LV. '+String(Number.isFinite(s.level)?s.level:1).padStart(2,'0');document.querySelector('#statHealth').textContent=Math.ceil(safeHp)+' / '+Math.ceil(safeMax);document.querySelector('#statAttack').textContent=Number.isFinite(s.attack)?s.attack:15;document.querySelector('#statSpeed').textContent=Math.round(s.attackSpeed*100)+'%';document.querySelector('#statCrit').textContent=s.crit.toFixed(0)+'%';document.querySelector('#statCritDmg').textContent=s.critDamage.toFixed(0)+'%';document.querySelector('#statCores').textContent=game.cores.length+' / 10';document.querySelector('#coreCount').textContent=game.cores.length+' / 10';document.querySelector('#coreSlots').innerHTML=game.coreSlots.map(c=>'<i title="'+(c?.name||'空核心槽')+'" class="'+(c?'filled':'')+'">'+(c?'✦':'·')+'</i>').join('');document.querySelector('#statsCoreSlots').innerHTML=document.querySelector('#coreSlots').innerHTML;hpText.textContent=Math.ceil(safeHp)+' / '+Math.ceil(safeMax);hpBar.style.width=(safeHp/safeMax*100)+'%';xpBar.style.width=s.xp+'%';xpText.textContent=s.xp+' / 100';enemyCount.textContent='剩余敌人：'+s.enemies;buffEl.textContent=s.buff?'强化效果：'+s.buff+' · '+s.buffTime.toFixed(1)+'s':'当前强化：无';goldEl.textContent=s.gold;chargeEl.textContent='自动';if(s.enemies===0&&game.encounterCleared)objective.textContent='街区已清理 · 向前走';if(s.poison>0)buffEl.textContent='中毒 '+s.poison.toFixed(1)+'s · 攻速/移速 -50%';};
game.onToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(game.toastTimer);game.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1800);};game.onAchievement=n=>renderLists();renderSystems();
game.onWeaponChest=show=>{if(show){document.querySelector('#weaponOverlay').classList.remove('hidden');game.paused=true;document.exitPointerLock?.();}};
game.onStatsToggle=()=>{const el=document.querySelector('#statsOverlay');if(el.classList.contains('hidden')){if([...document.querySelectorAll('.overlay')].some(x=>x!==el&&!x.classList.contains('hidden')))return;el.classList.remove('hidden');}else el.classList.add('hidden');syncModalPause();};
const environmentOverlay=document.querySelector('#environmentOverlay'),environmentBtn=document.querySelector('#environmentBtn'),worldTime=document.querySelector('#worldTime'),worldTimeLabel=document.querySelector('#worldTimeLabel'),worldWeather=document.querySelector('#worldWeather');
const formatWorldTime=value=>{const hours=Math.floor(Number(value)),minutes=Math.round((Number(value)-hours)*60);return String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0');};
const syncEnvironmentControls=()=>{worldTime.value=game.world.environment.time;worldTimeLabel.textContent=formatWorldTime(worldTime.value);worldWeather.value=game.world.environment.weather;};
const closeEnvironment=()=>{environmentOverlay.classList.add('hidden');syncModalPause();};
game.onEnvironmentToggle=()=>{if(environmentOverlay.classList.contains('hidden')){if([...document.querySelectorAll('.overlay')].some(x=>x!==environmentOverlay&&!x.classList.contains('hidden')))return;syncEnvironmentControls();environmentOverlay.classList.remove('hidden');syncModalPause();}else closeEnvironment();};
environmentBtn.addEventListener('click',()=>game.onEnvironmentToggle());
document.querySelector('#closeEnvironment').addEventListener('click',closeEnvironment);
worldTime.addEventListener('input',()=>{game.world.environment.setTime(worldTime.value);worldTimeLabel.textContent=formatWorldTime(worldTime.value);});
worldWeather.addEventListener('change',()=>game.world.environment.setWeather(worldWeather.value));
document.querySelectorAll('[data-time-preset]').forEach(button=>button.addEventListener('click',()=>{game.world.environment.setTime(button.dataset.timePreset);syncEnvironmentControls();}));
syncEnvironmentControls();

game.onBoss=s=>{const panel=document.querySelector('#bossPanel');panel.classList.toggle('hidden',!s.show);const max=Number.isFinite(s.maxHp)&&s.maxHp>0?s.maxHp:1,hp=Number.isFinite(s.hp)?Math.max(0,Math.min(max,s.hp)):max;document.querySelector('#bossName').textContent=s.name||'BOSS';document.querySelector('#bossPhase').textContent=(s.phase===2?'第二阶段':'第一阶段')+(s.weakpoint?' · 弱点暴露':'');document.querySelector('#bossHpBar').style.width=(hp/max*100)+'%';document.querySelector('#bossHpText').textContent=Math.ceil(hp)+' / '+Math.ceil(max);};
game.onAdvance=s=>{document.querySelector('#advancePanel').classList.toggle('hidden',!s.show);document.querySelector('#advancePanel').textContent=s.show?'街区已清理 · 沿道路继续前进':' ';};game.onDistrict=n=>{document.querySelector('.district').textContent='DISTRICT '+String(n).padStart(2,'0')+' · ENDLESS BLOCK';document.querySelector('#objective').textContent='清理第 '+n+' 个街区';};game.onDistrict(game.districtNumber);
game.onCore=(slots,inventory)=>{document.querySelector('#coreCount').textContent=game.cores.length+' / 10';document.querySelector('#coreSlots').innerHTML=slots.map(c=>'<i title="'+(c?.name||'空核心槽')+'" class="'+(c?'filled':'')+'">'+(c?'✦':'·')+'</i>').join('');document.querySelector('#statsCoreSlots').innerHTML=document.querySelector('#coreSlots').innerHTML;document.querySelector('#coreInventory').innerHTML='<h3>可装备核心</h3>'+inventory.map((c,i)=>'<button class="core-item" data-equip-core="'+i+'"><b>'+c.name+'</b><small>攻击 +'+c.attack+' · 攻速 +'+c.speed+'% · 暴击 +'+c.crit+'% · 爆伤 +'+c.critDmg+'% · 生命 +'+c.hp+'</small><strong>'+(game.cores.includes(c)?'已装备':'装备到空槽')+'</strong></button>').join('');document.querySelectorAll('[data-equip-core]').forEach(b=>b.addEventListener('click',()=>game.equipCore(Number(b.dataset.equipCore))));};
// District progression is triggered by physically reaching the road marker; no click-to-skip button.
game.onWeaponChange=id=>{document.querySelector('#statWeapon').textContent=({katana:'太刀',solar:'太阳神剑',demon:'魔刀千刃',ak:'AK47'}[id]||id);};game.updateUI();
document.querySelector('#closeStats').addEventListener('click',()=>{document.querySelector('#statsOverlay').classList.add('hidden');syncModalPause();});
document.querySelectorAll('[data-pick-weapon]').forEach(btn=>btn.addEventListener('click',()=>{game.chooseWeapon(btn.dataset.pickWeapon);document.querySelector('#weaponOverlay').classList.add('hidden');if(game.chest){game.scene.remove(game.chest.group);game.chest=null;}syncModalPause();}));
document.querySelectorAll('[data-weapon]').forEach(btn=>btn.addEventListener('click',()=>game.switchWeapon(btn.dataset.weapon)));
const musicBtn=document.querySelector('#musicBtn');const syncMusicButton=()=>{musicBtn.textContent='音乐：'+(game.audio.musicEnabled?'开':'关');musicBtn.setAttribute('aria-pressed',String(game.audio.musicEnabled));};syncMusicButton();musicBtn.addEventListener('click',()=>{game.audio.toggleMusic();syncMusicButton();});
document.querySelector('#pauseBtn').addEventListener('click',()=>game.pause());document.querySelector('#resumeBtn').addEventListener('click',()=>game.resume());for(const id of ['restartBtn','againBtn','retryBtn'])document.querySelector('#'+id).addEventListener('click',()=>location.reload());
const openMenu=id=>{document.exitPointerLock?.();game.keys={};game.setBlock(false);renderLists();document.querySelector(id).classList.remove('hidden');game.paused=true;};document.querySelector('#shopBtn').addEventListener('click',()=>openMenu('#shopOverlay'));document.querySelector('#achievementBtn').addEventListener('click',()=>openMenu('#achievementOverlay'));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{b.closest('.overlay')?.classList.add('hidden');syncModalPause();}));
const openSystemMenu=id=>{document.exitPointerLock?.();game.keys={};game.setBlock(false);renderSystems();openMenu('#'+id);};
document.querySelector('#skillsBtn').addEventListener('click',()=>openSystemMenu('skillsOverlay'));
document.querySelector('#questsBtn').addEventListener('click',()=>openSystemMenu('questsOverlay'));
document.querySelector('#codexBtn').addEventListener('click',()=>openSystemMenu('codexOverlay'));
document.querySelector('#saveBtn').addEventListener('click',()=>{renderSystems();openMenu('#saveOverlay');});
document.querySelector('#saveNowBtn').addEventListener('click',()=>{game.saveCampaign();renderSystems();game.onToast?.('战役进度已保存');});
document.querySelector('#historySaveBtn').addEventListener('click',()=>{game.saveCampaign();const entry=game.createHistorySave('手动存档');renderSystems();game.onToast?.(entry?'历史存档已创建':'历史存档创建失败');});
document.querySelector('#campaignHistory').addEventListener('click',e=>{const button=e.target.closest('[data-restore-history]');if(!button)return;const entry=game.getCampaignHistory().find(x=>x.id===button.dataset.restoreHistory);if(!entry)return;if(!confirm('确定回到第 '+entry.districtNumber+' 街区？当前进度会被切换，但历史存档本身会保留。'))return;if(game.restoreHistorySave(entry.id)){location.reload();}else game.onToast?.('读取历史存档失败');});
const restoreDistrictButton=document.querySelector('#restoreDistrictBtn');restoreDistrictButton.addEventListener('click',restoreSelectedDistrict);function restoreSelectedDistrict(){const status=document.querySelector('#restoreDistrictStatus'),show=message=>{if(status)status.textContent=message;game.onToast?.(message);};try{const input=document.querySelector('#historyDistrictInput'),district=Number(input?.value),max=Math.max(1,Math.floor(Number(game.maxDistrictReached)||1));if(!Number.isInteger(district)||district<1||district>max){show('无法回档：只能选择第 1 至第 '+max+' 街区。');return;}const entry=game.ensureDistrictHistorySave(district);if(!entry){show('无法创建第 '+district+' 街区回档点，请检查存储空间后重试。');return;}if(!confirm('确定回到第 '+district+' 街区？将保留当前等级、金币和装备，只切换关卡；历史存档仍会保留。')){show('已取消回档。');return;}if(game.restoreHistorySave(entry.id)){show('正在恢复第 '+district+' 街区…');location.reload();}else show('回档失败：存档数据无法读取。');}catch(error){console.error('指定关卡回档失败',error);show('回档操作发生错误，请重新打开存档菜单。');}}

const qualitySetting=document.querySelector('#qualitySetting'),fovSetting=document.querySelector('#fovSetting'),fovLabel=document.querySelector('#fovLabel'),sensitivitySetting=document.querySelector('#sensitivitySetting'),sensitivityLabel=document.querySelector('#sensitivityLabel'),volumeSetting=document.querySelector('#volumeSetting'),volumeLabel=document.querySelector('#volumeLabel');
function applyGameSettings(){const quality=qualitySetting.value,fov=Number(fovSetting.value),sensitivity=Number(sensitivitySetting.value);localStorage.setItem('ns_quality',quality);localStorage.setItem('ns_fov',String(fov));localStorage.setItem('ns_sensitivity',String(sensitivity));game.camera.fov=fov;game.camera.updateProjectionMatrix();game.mouseSensitivity=sensitivity;game.renderer.setPixelRatio(quality==='performance'?.85:quality==='balanced'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.35:2));game.renderer.shadowMap.enabled=quality!=='performance';game.renderer.shadowMap.needsUpdate=true;fovLabel.textContent=fov+'°';sensitivityLabel.textContent=sensitivity.toFixed(1)+'×';}
qualitySetting.value=localStorage.getItem('ns_quality')||'high';fovSetting.value=localStorage.getItem('ns_fov')||'62';sensitivitySetting.value=localStorage.getItem('ns_sensitivity')||'1';volumeSetting.value=localStorage.getItem('ns_master_volume')||'72';volumeLabel.textContent=volumeSetting.value+'%';game.audio.setVolume(volumeSetting.value);applyGameSettings();
document.querySelector('#settingsBtn').addEventListener('click',()=>{openSystemMenu('settingsOverlay');});
qualitySetting.addEventListener('change',applyGameSettings);fovSetting.addEventListener('input',applyGameSettings);sensitivitySetting.addEventListener('input',applyGameSettings);volumeSetting.addEventListener('input',()=>{volumeLabel.textContent=game.audio.setVolume(volumeSetting.value)+'%';});
const actions={attack:()=>game.attack(),dodge:()=>game.dodge(),block:()=>game.setBlock(true),iaido:()=>game.iaido(),pickup:()=>game.pickupChest(),inventory:()=>game.onStatsToggle?.(),ultimate:()=>game.ultimate(),clear:()=>game.clearScreen()};
document.querySelectorAll('[data-action]').forEach(btn=>{const a=btn.dataset.action;btn.addEventListener('pointerdown',e=>{e.preventDefault();actions[a]?.();});if(a==='block'){const up=()=>game.setBlock(false);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);}});
const stick=document.querySelector('#stick'),knob=document.querySelector('#stickKnob');let stickId=null;
function stickMove(e){if(stickId!==e.pointerId)return;const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=37;if(len>max){dx=dx/len*max;dy=dy/len*max;}knob.style.transform='translate('+dx+'px,'+dy+'px)';game.setMobileMove(dx/max,-dy/max);}
stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(stickId);stickMove(e);});stick.addEventListener('pointermove',stickMove);function stickEnd(){stickId=null;knob.style.transform='';game.setMobileMove(0,0);}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);window.addEventListener('resize',()=>world.resize());renderLists();renderSystems();window.addEventListener('pagehide',()=>game.saveCampaign());
