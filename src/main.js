import './style.css';
import { createWorld } from './game/world.js';
import { FighterGame } from './game/fighter.js';
const app=document.querySelector('#app'),world=createWorld();app.prepend(world.renderer.domElement);
const game=new FighterGame(world);game.start();
const hud=document.querySelector('#hud');document.querySelector('#loading').classList.add('hidden');hud.classList.remove('hidden');
const hpBar=document.querySelector('#hpBar'),hpText=document.querySelector('#hpText'),xpBar=document.querySelector('#xpBar'),xpText=document.querySelector('#xpText'),enemyCount=document.querySelector('#enemyCount'),objective=document.querySelector('#objective'),toastEl=document.querySelector('#toast'),buffEl=document.querySelector('#buffStatus');
game.onUpdate=s=>{hpBar.style.width=s.hp+'%';hpText.textContent=Math.ceil(s.hp)+' / 100';xpBar.style.width=s.xp+'%';xpText.textContent=s.xp+' / 100';enemyCount.textContent='剩余敌人：'+s.enemies;buffEl.textContent=s.buff?'强化效果：'+s.buff+' · '+s.buffTime.toFixed(1)+'s':'当前强化：无';if(s.enemies===0)objective.textContent='街区暂时恢复了平静';};
game.onToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(game.toastTimer);game.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1600);};
document.querySelector('#pauseBtn').addEventListener('click',()=>game.pause());document.querySelector('#resumeBtn').addEventListener('click',()=>game.resume());for(const id of ['restartBtn','againBtn','retryBtn'])document.querySelector('#'+id).addEventListener('click',()=>location.reload());
const actions={attack:()=>game.attack(),dodge:()=>game.dodge(),block:()=>game.setBlock(true),iaido:()=>game.iaido()};
document.querySelectorAll('[data-action]').forEach(btn=>{const a=btn.dataset.action;btn.addEventListener('pointerdown',e=>{e.preventDefault();actions[a]?.();});if(a==='block'){const up=()=>game.setBlock(false);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);}});
const stick=document.querySelector('#stick'),knob=document.querySelector('#stickKnob');let stickId=null;
function stickMove(e){if(stickId!==e.pointerId)return;const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=37;if(len>max){dx=dx/len*max;dy=dy/len*max;}knob.style.transform='translate('+dx+'px,'+dy+'px)';game.setMobileMove(dx/max,-dy/max);}
stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(stickId);stickMove(e);});stick.addEventListener('pointermove',stickMove);function stickEnd(){stickId=null;knob.style.transform='';game.setMobileMove(0,0);}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
window.addEventListener('resize',()=>world.resize());
