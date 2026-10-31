import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';


const yieldToUI = () => new Promise(resolve => {
  let finished = false;
  const finish = () => { if (finished) return; finished = true; resolve(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
  setTimeout(finish, 40);
});

// Reuse immutable materials and box geometries: the city contains thousands of facade details.
const materialCache = new Map();
const geometryCache = new Map();
// Boxes are collected and emitted as InstancedMesh batches to avoid thousands of draw calls.
const batchesByGroup = new WeakMap();
const mat = (color, roughness = .8, metalness = 0) => {
  const key = [color, roughness, metalness].join('|');
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materialCache.get(key);
};
const glowMat = (color, roughness, metalness, emissive, intensity) => {
  const key = [color, roughness, metalness, emissive, intensity].join('|');
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity }));
  return materialCache.get(key);
};
function box(w, h, d, material, x, y, z, group) {
  const key = [w, h, d].join('|');
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  let batches = batchesByGroup.get(group);
  if (!batches) { batches = new Map(); batchesByGroup.set(group, batches); }
  const geometry = geometryCache.get(key);
  const batchKey = geometry.uuid + '|' + material.uuid;
  let batch = batches.get(batchKey);
  if (!batch) { batch = { geometry, material, matrices: [] }; batches.set(batchKey, batch); }
  const transform = new THREE.Object3D();
  transform.position.set(x, y, z);
  transform.updateMatrix();
  batch.matrices.push(transform.matrix.clone());
}
function flushBoxBatches(group) {
  const batches = batchesByGroup.get(group);
  if (!batches) return;
  for (const { geometry, material, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  batches.clear();
}
function makeBuilding(group,x,z,w,d,h,color,seed){
  const wall=mat(color,.78,.18),dark=mat('#101a25',.42,.72),trim=mat('#34485a',.34,.8);
  const neonColors=['#12dfff','#ff3f9b','#a66bff','#ffb84d'],neon=neonColors[seed%neonColors.length];
  box(w,h,d,wall,x,h/2,z,group);box(w+.24,.22,d+.24,trim,x,h,z,group);box(w+.12,.12,d+.12,dark,x,.18,z,group);
  const floors=Math.max(2,Math.floor(h/2.45));
  for(let floor=0;floor<floors;floor++){
    const y=1.05+floor*2.25;if(y>h-.6)continue;
    box(w+.08,.075,d+.08,trim,x,y+.68,z,group);
    const count=Math.max(2,Math.floor(w/1.55));
    for(let i=0;i<count;i++){
      const wx=x-w/2+.78+i*1.55,lit=((seed*13+floor*7+i*3)%9)<6;
      const pane=lit
        ? glowMat('#1b3c50',.16,.65,(i+floor)%4===0?'#ff8b45':neon,.45+((i+seed)%3)*.16)
        : mat('#101a27',.16,.65);
      box(.72,1.12,.075,pane,wx,y,z+d/2+.055,group);
      box(.78,.07,.1,dark,wx,y-.6,z+d/2+.09,group);
      if(i%2===0)box(.035,1.16,.085,trim,wx+.39,y,z+d/2+.1,group);
    }
    if(floor%2===0) box(w*.82,.035,.1,glowMat('#162c3b',.3,.65,neon,.8),x,y+.78,z+d/2+.12,group);
  }
  for(const side of [-1,1])box(.16,h*.82,.22,trim,x+side*(w/2-.12),h*.43,z+d/2+.12,group);
  box(w*.74,.52,.16,dark,x,h*.7,z+d/2+.16,group);
  box(w*.64,.29,.19,glowMat('#182b3b',.25,.5,neon,1.35),x,h*.7,z+d/2+.27,group);
  for(let k=0;k<3;k++)box(.38,.55,.42,trim,x-w*.25+k*w*.25,h+.28,z,group);
  box(w+.18,.055,.14,glowMat('#182d3d',.25,.7,neon,.9),x,h+.13,z+d/2,group);
}
function makeStreetLamp(group,x,z){
  const metal=mat('#182a35',.32,.85),glow=new THREE.MeshStandardMaterial({color:'#b9f7ff',emissive:'#27dfff',emissiveIntensity:3.2});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.085,4.6,10),metal);
  pole.position.set(x,2.3,z);pole.castShadow=true;group.add(pole);
  box(.95,.09,.1,metal,x+.38,4.42,z,group);box(.42,.14,.3,glow,x+.76,4.3,z,group);
  const light=new THREE.PointLight('#42dfff',15,12,2);light.position.set(x+.76,4.05,z);group.add(light);
}
export async function createWorld(onProgress = () => {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07111f');
  scene.fog = new THREE.FogExp2('#101d31', .009);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 240);
  camera.position.set(0, 5, 9);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.35 : 2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene.add(new THREE.HemisphereLight('#8cb8d8','#101522',.72));
  scene.add(new THREE.AmbientLight('#243a60',.28));
  const sun = new THREE.DirectionalLight('#8dbdff',1.65);
  sun.position.set(-24, 38, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(3072,3072);
  sun.shadow.camera.near=1;sun.shadow.camera.far=150;
  sun.shadow.normalBias=.035;
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.bias = -.00025; scene.add(sun);
  const city = new THREE.Group(); scene.add(city);
  const cyanLight=new THREE.PointLight('#12cfff',38,42,2);cyanLight.position.set(-7,5,-9);city.add(cyanLight);
  const pinkLight=new THREE.PointLight('#ff319c',34,38,2);pinkLight.position.set(8,5,8);city.add(pinkLight);
  const violetLight=new THREE.PointLight('#9a58ff',30,34,2);violetLight.position.set(-10,4,12);city.add(violetLight);
  const asphalt = mat('#343a3d'), sidewalk = mat('#777b77'), lane = mat('#c2bda8');
  box(120, .35, 120, asphalt, 0, -.2, 0, city);
  box(18, .16, 110, asphalt, 0, -.015, 0, city); box(110, .16, 18, asphalt, 0, -.01, 0, city);
  box(4, .17, 110, sidewalk, -11, -.005, 0, city); box(4, .17, 110, sidewalk, 11, -.005, 0, city);
  box(110, .17, 4, sidewalk, 0, -.005, -11, city); box(110, .17, 4, sidewalk, 0, -.005, 11, city);
  for (let z = -48; z <= 48; z += 5) box(.12, .025, 2.1, lane, 0, .09, z, city);
  for (let x = -48; x <= 48; x += 5) box(2.1, .025, .12, lane, x, .09, 0, city);
  const crosswalk = mat('#c9c7bc');
  for (let i = -4; i <= 4; i++) {
    box(1.05, .035, 5, crosswalk, i * 1.55, .1, -8, city);
    box(5, .035, 1.05, crosswalk, 8, .1, i * 1.55, city);
  }
  const colors = ['#77746c', '#625f59', '#777d7b', '#665f59', '#8a8174', '#58676a'];
  let seed = 1;
  const totalBuildings = 36;
  let builtBuildings = 0;
  const buildingColliders = [];
  onProgress(12, '正在生成街区建筑与楼层立面…');
  await yieldToUI();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = sx * (17 + i * 9.5), z = sz * (17 + j * 9.5);
      const w = 7.2 + (i % 2) * 1.4, d = 7.2 + (j % 2) * 1.2, h = 8 + (i * 3 + j * 2 + (seed % 3) * 2);
      makeBuilding(city, x, z, w, d, h, colors[seed % colors.length], seed++);
      // Solid footprint for the complete building: floors and facade details share one wall collider.
      buildingColliders.push({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      builtBuildings++;
      onProgress(12 + builtBuildings / totalBuildings * 62, `正在构建建筑模型 ${builtBuildings}/${totalBuildings}…`);
      await yieldToUI();
    }
  }
  const trunk = mat('#59483a'), leaves = mat('#435d4c'), bench = mat('#564b3e'), bin = mat('#34484a');
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [-29, 0], [29, 0], [0, 29], [0, -29]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, 2, 7), trunk);
    t.position.set(x, 1, z); t.castShadow = true; city.add(t);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), leaves);
    crown.position.set(x, 2.55, z); crown.castShadow = true; city.add(crown);
    // Treat the whole visible tree (trunk + low canopy) as a solid obstacle.
    buildingColliders.push({ type: 'circle', x, z, r: 1.12 });
  }
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-20, 0], [20, 0], [0, 20], [0, -20]]) { makeStreetLamp(city, x, z); buildingColliders.push({ type: 'circle', x: x + .38, z, r: .48 }); }
  for (const [x, z] of [[-8, -12], [8, 12], [-18, 8], [18, -8]]) {
    box(2.2, .18, .65, bench, x, .62, z, city);
    box(.12, .65, .12, bench, x - .8, .32, z, city);
    box(.12, .65, .12, bench, x + .8, .32, z, city);
    buildingColliders.push({ type: 'box', minX: x - 1.12, maxX: x + 1.12, minZ: z - .38, maxZ: z + .38 });
  }
  for (const [x, z] of [[-10, 3], [10, -3], [-23, -13], [23, 13]]) { box(.75, 1.15, .75, bin, x, .58, z, city); buildingColliders.push({ type: 'box', minX: x - .48, maxX: x + .48, minZ: z - .48, maxZ: z + .48 }); }
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2, r = 65 + (i % 4) * 5, h = 16 + (i * 7 % 22);
    box(7, h, 7, mat('#65777a'), Math.sin(a) * r, h / 2, Math.cos(a) * r, city);
  }
  onProgress(78, '正在布置街灯、树木与街道设施…');
  await yieldToUI();
  const groundGrid = new THREE.GridHelper(120, 60, '#687579', '#687579');
  groundGrid.position.y = -.01; groundGrid.material.opacity = .12; groundGrid.material.transparent = true; scene.add(groundGrid);
  onProgress(88, '正在配置阴影、霓虹光效与画面后处理…');
  await yieldToUI();
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.58,.7,.8));
  composer.addPass(new OutputPass());
  onProgress(94, '正在合并街区模型并优化绘制批次…');
  await yieldToUI();
  flushBoxBatches(city);
  return {
    scene, camera, renderer, composer, city, buildingColliders,
    resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.2:2));composer.setSize(innerWidth,innerHeight);
    }
  };
}