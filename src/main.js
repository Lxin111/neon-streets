import './style.css';
import { createWorld } from './game/world.js';
import { FighterGame } from './game/fighter.js';

const app = document.querySelector('#app');
const world = createWorld();
app.prepend(world.renderer.domElement);
const game = new FighterGame(world);
game.start();

const hud = document.querySelector('#hud');
document.querySelector('#loading').classList.add('hidden');
hud.classList.remove('hidden');

const hpBar = document.querySelector('#hpBar');
const hpText = document.querySelector('#hpText');
const xpBar = document.querySelector('#xpBar');
const xpText = document.querySelector('#xpText');
const enemyCount = document.querySelector('#enemyCount');
const objective = document.querySelector('#objective');
const toastEl = document.querySelector('#toast');

game.onUpdate = state => {
  hpBar.style.width = `${state.hp}%`;
  hpText.textContent = `${Math.ceil(state.hp)} / 100`;
  xpBar.style.width = `${state.xp}%`;
  xpText.textContent = `${state.xp} / 100`;
  enemyCount.textContent = `剩余敌人：${state.enemies}`;
  if (state.enemies === 0) objective.textContent = '街区暂时恢复了平静';
};
game.onToast = message => {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
};

document.querySelector('#pauseBtn').addEventListener('click', () => game.pause());
document.querySelector('#resumeBtn').addEventListener('click', () => game.resume());
document.querySelector('#restartBtn').addEventListener('click', () => location.reload());
document.querySelector('#againBtn').addEventListener('click', () => location.reload());\ndocument.querySelector('#retryBtn').addEventListener('click', () => location.reload());

const actions = { attack: () => game.attack(), dodge: () => game.dodge(), block: () => game.setBlock(true) };
document.querySelectorAll('[data-action]').forEach(btn => {
  const action = btn.dataset.action;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); actions[action]?.(); });
  if (action === 'block') {
    const release = () => game.setBlock(false);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }
});

const stick = document.querySelector('#stick');
const knob = document.querySelector('#stickKnob');
let stickId = null;
function stickMove(e) {
  if (stickId !== e.pointerId) return;
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy, len = Math.hypot(dx, dy), max = 37;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  game.setMobileMove(dx / max, -dy / max);
}
stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(stickId); stickMove(e); });
stick.addEventListener('pointermove', stickMove);
function stickEnd() { stickId = null; knob.style.transform = ''; game.setMobileMove(0, 0); }
stick.addEventListener('pointerup', stickEnd);
stick.addEventListener('pointercancel', stickEnd);

window.addEventListener('resize', () => world.resize());