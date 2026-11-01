import * as THREE from 'three';
import {EnvironmentSystem} from './environment.js';
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
function detailedSurface(color,kind='concrete',seed=1,roughness=.82,metalness=0){
  const key=[color,kind,roughness,metalness].join('|');if(materialCache.has(key))return materialCache.get(key);
  const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,size,size);
  let state=(seed>>>0)||1;const rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  const img=ctx.getImageData(0,0,size,size),data=img.data;
  for(let i=0;i<data.length;i+=4){const n=(rand()-.5)*(kind==='asphalt'?54:kind==='bark'?48:kind==='foliage'?68:kind==='metal'?25:42);data[i]=THREE.MathUtils.clamp(data[i]+n,0,255);data[i+1]=THREE.MathUtils.clamp(data[i+1]+n,0,255);data[i+2]=THREE.MathUtils.clamp(data[i+2]+n,0,255);}ctx.putImageData(img,0,0);
  if(kind==='asphalt'){
    for(let i=0;i<2600;i++){const x=rand()*size,y=rand()*size,r=.35+rand()*2.2;ctx.fillStyle=rand()>.5?'rgba(225,226,216,.12)':'rgba(5,10,14,.22)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='rgba(8,12,15,.42)';ctx.lineWidth=1.5;for(let i=0;i<18;i++){let x=rand()*size,y=rand()*size;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<5;k++){x+=(rand()-.5)*45;y+=rand()*28;ctx.lineTo(x,y);}ctx.stroke();}
    ctx.fillStyle='rgba(205,210,204,.12)';for(let i=0;i<35;i++){ctx.fillRect(rand()*size,rand()*size,2+rand()*12,1);}
  }else if(kind==='concrete'){
    ctx.strokeStyle='rgba(17,25,30,.24)';ctx.lineWidth=2;for(let i=0;i<14;i++){const x=rand()*size,y=rand()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*100,y+(rand()-.5)*85);ctx.stroke();}
    for(let i=0;i<160;i++){ctx.fillStyle=rand()>.5?'rgba(245,245,232,.16)':'rgba(10,16,20,.17)';ctx.fillRect(rand()*size,rand()*size,2+rand()*8,2+rand()*6);}
    ctx.strokeStyle='rgba(12,20,26,.25)';ctx.lineWidth=3;for(let y=128;y<size;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();}
  }else if(kind==='wood'){
    for(let i=0;i<95;i++){const y=rand()*size;ctx.strokeStyle=rand()>.5?'rgba(25,14,8,.2)':'rgba(235,190,125,.17)';ctx.lineWidth=.5+rand()*3;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(130,y+(rand()-.5)*18,360,y+(rand()-.5)*18,size,y+(rand()-.5)*10);ctx.stroke();}
    for(let i=0;i<18;i++){ctx.strokeStyle='rgba(25,16,10,.25)';ctx.beginPath();ctx.ellipse(rand()*size,rand()*size,4+rand()*18,2+rand()*7,rand(),0,Math.PI*2);ctx.stroke();}
  }else if(kind==='bark'){
    for(let i=0;i<180;i++){const x=rand()*size;ctx.strokeStyle=rand()>.5?'rgba(20,12,8,.3)':'rgba(205,155,105,.2)';ctx.lineWidth=1+rand()*5;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+(rand()-.5)*15,150,x+(rand()-.5)*15,350,x+(rand()-.5)*20,size);ctx.stroke();}
  }else if(kind==='foliage'){
    for(let i=0;i<3000;i++){ctx.fillStyle=rand()>.48?'rgba(160,205,112,.2)':'rgba(8,35,20,.22)';ctx.beginPath();ctx.ellipse(rand()*size,rand()*size,1+rand()*5,1+rand()*9,rand()*Math.PI,0,Math.PI*2);ctx.fill();}
  }else if(kind==='metal'){
    ctx.strokeStyle='rgba(235,250,255,.16)';ctx.lineWidth=2;for(let y=0;y<size;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();}
    ctx.fillStyle='rgba(0,0,0,.22)';for(let y=18;y<size;y+=64)for(let x=18;x<size;x+=64){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(kind==='bark'?1.2:kind==='asphalt'?3.4:2.2,kind==='bark'?2.8:2.2);map.anisotropy=8;
  const bumpCanvas=document.createElement('canvas');bumpCanvas.width=bumpCanvas.height=size;const bctx=bumpCanvas.getContext('2d');const source=ctx.getImageData(0,0,size,size),bump=bctx.createImageData(size,size);for(let i=0;i<source.data.length;i+=4){const v=(source.data[i]*.3+source.data[i+1]*.59+source.data[i+2]*.11);bump.data[i]=bump.data[i+1]=bump.data[i+2]=v;bump.data[i+3]=255;}bctx.putImageData(bump,0,0);
  const bumpMap=new THREE.CanvasTexture(bumpCanvas);bumpMap.wrapS=bumpMap.wrapT=THREE.RepeatWrapping;bumpMap.repeat.copy(map.repeat);bumpMap.anisotropy=8;
  const normalData=new Uint8Array(size*size*4),heightAt=(x,y)=>{const px=(y*size+x)*4;return bump.data[px]/255;},normalStrength=kind==='asphalt'?3.8:kind==='metal'?1.8:3.1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(heightAt((x+1)%size,y)-heightAt((x+size-1)%size,y))*normalStrength,dy=(heightAt(x,(y+1)%size)-heightAt(x,(y+size-1)%size))*normalStrength,nx=-dx,ny=-dy,nz=1,len=Math.hypot(nx,ny,nz)||1,idx=(y*size+x)*4;normalData[idx]=Math.round((nx/len*.5+.5)*255);normalData[idx+1]=Math.round((ny/len*.5+.5)*255);normalData[idx+2]=Math.round((nz/len*.5+.5)*255);normalData[idx+3]=255;}
  const normalMap=new THREE.DataTexture(normalData,size,size,THREE.RGBAFormat);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;normalMap.repeat.copy(map.repeat);normalMap.needsUpdate=true;
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',map,bumpMap,normalMap,normalScale:new THREE.Vector2(.42,.42),bumpScale:kind==='metal'?.02:kind==='foliage'?.025:kind==='asphalt'?.055:.04,roughness,roughnessMap:bumpMap,metalness});materialCache.set(key,material);return material;
}
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
  const wall=detailedSurface(color,'concrete',seed,.86,.08),dark=detailedSurface('#101a25','metal',seed+31,.42,.72),trim=detailedSurface('#34485a','metal',seed+32,.34,.8);
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
      if(floor%2===1&&i%2===0){
        box(.62,.34,.28,dark,wx,y-.18,z+d/2+.16,group);
        box(.7,.055,.32,trim,wx,y+.02,z+d/2+.18,group);
        for(let vent=0;vent<4;vent++)box(.48,.018,.018,trim,wx,y-.28+vent*.065,z+d/2+.315,group);
        box(.12,.08,.06,glowMat('#263d4b',.28,.5,neon,.45),wx+.38,y-.2,z+d/2+.2,group);
      }
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
  const metal=detailedSurface('#182a35','metal',801,.32,.85),glow=new THREE.MeshStandardMaterial({color:'#b9f7ff',emissive:'#27dfff',emissiveIntensity:3.2});
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
  const hemisphere = new THREE.HemisphereLight('#8cb8d8','#101522',.72);scene.add(hemisphere);
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
  const asphalt = detailedSurface('#343a3d','asphalt',11,.94,.02), sidewalk = detailedSurface('#777b77','concrete',12,.9,.02), lane = detailedSurface('#c2bda8','concrete',13,.82,.02);
  box(120, .35, 120, asphalt, 0, -.2, 0, city);
  box(18, .16, 110, asphalt, 0, -.015, 0, city); box(110, .16, 18, asphalt, 0, -.01, 0, city);
  box(4, .17, 110, sidewalk, -11, -.005, 0, city); box(4, .17, 110, sidewalk, 11, -.005, 0, city);
  box(110, .17, 4, sidewalk, 0, -.005, -11, city); box(110, .17, 4, sidewalk, 0, -.005, 11, city);
  for (let z = -48; z <= 48; z += 5) box(.12, .025, 2.1, lane, 0, .09, z, city);
  for (let x = -48; x <= 48; x += 5) box(2.1, .025, .12, lane, x, .09, 0, city);
  const crosswalk = detailedSurface('#c9c7bc','concrete',14,.78,.02);
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
  const trunk = detailedSurface('#59483a','bark',21,.96), leaves = detailedSurface('#435d4c','foliage',22,.94), bench = detailedSurface('#564b3e','wood',23,.88), bin = detailedSurface('#34484a','metal',24,.48,.58);
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [-29, 0], [29, 0], [0, 29], [0, -29]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, 2, 12), trunk);
    t.position.set(x, 1, z); t.castShadow = true; t.receiveShadow=true; city.add(t);
    for(const side of [-1,1]){
      const branch=new THREE.Mesh(new THREE.CylinderGeometry(.075,.12,1.05,8),trunk);branch.position.set(x+side*.32,1.72,z);branch.rotation.z=-side*.58;branch.castShadow=true;city.add(branch);
    }
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), leaves);
    crown.position.set(x, 2.55, z); crown.scale.set(1.08,1.12,1.02);crown.castShadow = true; crown.receiveShadow=true;city.add(crown);
    for(const [ox,oy,oz,scale] of [[-.72,.1,.12,.68],[.72,.05,-.08,.72],[.05,.58,.48,.64],[.12,-.2,-.62,.62]]){
      const cluster=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),leaves);cluster.position.set(x+ox,2.55+oy,z+oz);cluster.scale.set(scale,scale*.92,scale);cluster.castShadow=true;cluster.receiveShadow=true;city.add(cluster);
    }
    // Treat the whole visible tree (trunk + low canopy) as a solid obstacle.
    buildingColliders.push({ type: 'circle', x, z, r: 1.12 });
  }
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-20, 0], [20, 0], [0, 20], [0, -20]]) { makeStreetLamp(city, x, z); buildingColliders.push({ type: 'circle', x: x + .38, z, r: .48 }); }
  // Weathered cast-iron manholes and storm drains add readable street-scale detail.
  const manholeMat=detailedSurface('#4b5558','metal',811,.68,.72),manholeEdge=detailedSurface('#202a2e','metal',812,.46,.82);
  for(const [x,z] of [[-4.8,-5.6],[4.8,5.6],[-5.4,4.2],[5.4,-4.2]]){
    const cover=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.055,32),manholeMat);cover.position.set(x,.085,z);cover.castShadow=true;cover.receiveShadow=true;city.add(cover);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.59,.045,8,40),manholeEdge);rim.rotation.x=Math.PI/2;rim.position.set(x,.105,z);city.add(rim);
    for(let k=0;k<12;k++){const a=k/12*Math.PI*2,slot=new THREE.Mesh(new THREE.BoxGeometry(.24,.012,.025),manholeEdge);slot.position.set(x+Math.cos(a)*.3,.116,z+Math.sin(a)*.3);slot.rotation.y=-a;city.add(slot);}
  }
  const drainMat=detailedSurface('#263238','metal',813,.5,.8);
  for(const [x,z,rot] of [[-9,-2,0],[9,2,0],[-2,-9,Math.PI/2],[2,9,Math.PI/2]]){
    const grate=new THREE.Mesh(new THREE.BoxGeometry(1.35,.045,.34),drainMat);grate.position.set(x,.09,z);grate.rotation.y=rot;grate.castShadow=true;city.add(grate);
    for(let i=0;i<7;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.035,.025,.3),manholeEdge);bar.position.set(x+(rot===0?(i-3)*.18:0),.12,z+(rot===Math.PI/2?(i-3)*.18:0));bar.rotation.y=rot;city.add(bar);}
  }
  for (const [x, z] of [[-8, -12], [8, 12], [-18, 8], [18, -8]]) {
    // Separate seat/backrest slats, steel braces and visible fasteners.
    box(2.2,.13,.16,bench,x,.66,z-.2,city);box(2.2,.13,.16,bench,x,.66,z,city);box(2.2,.13,.16,bench,x,.66,z+.2,city);
    box(.12,.68,.12,manholeEdge,x-.82,.34,z-.2,city);box(.12,.68,.12,manholeEdge,x+.82,.34,z-.2,city);
    for(const side of [-1,1]){
      box(.12,.72,.12,manholeEdge,x+side*.82,.83,z+.22,city);
      for(let slat=0;slat<3;slat++)box(2.12,.12,.12,bench,x,.86+slat*.17,z+.22,city);
      for(let bolt=0;bolt<3;bolt++){const bx=x+side*.82+(bolt-1)*.24;box(.045,.045,.018,manholeMat,bx,.74,z-.28,city);}
    }
    buildingColliders.push({ type: 'box', minX: x - 1.12, maxX: x + 1.12, minZ: z - .38, maxZ: z + .38 });
  }
  for (const [x, z] of [[-10, 3], [10, -3], [-23, -13], [23, 13]]) {
    box(.75,1.05,.75,bin,x,.53,z,city);box(.84,.13,.84,manholeEdge,x,.12+1.05,z,city);
    box(.88,.08,.88,bin,x,1.14,z,city);box(.28,.12,.08,manholeEdge,x,1.23,z-.36,city);
    for(let rib=0;rib<5;rib++){const rx=x-.3+rib*.15;box(.035,.78,.025,manholeEdge,rx,.54,z-.39,city);}
    buildingColliders.push({ type: 'box', minX: x - .48, maxX: x + .48, minZ: z - .48, maxZ: z + .48 });
  }
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2, r = 65 + (i % 4) * 5, h = 16 + (i * 7 % 22);
    box(7, h, 7, detailedSurface('#65777a','concrete',seed+300,.88,.12), Math.sin(a) * r, h / 2, Math.cos(a) * r, city);
    buildingColliders.push({ type: 'box', minX: Math.sin(a) * r - 3.5, maxX: Math.sin(a) * r + 3.5, minZ: Math.cos(a) * r - 3.5, maxZ: Math.cos(a) * r + 3.5 });
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
  const environment = new EnvironmentSystem(scene,camera,hemisphere,sun);
  return {
    scene, camera, renderer, composer, city, buildingColliders, environment,
    resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);const quality=localStorage.getItem('ns_quality')||'high';renderer.setPixelRatio(quality==='performance'?.85:quality==='balanced'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.35:2));renderer.shadowMap.enabled=quality!=='performance';composer.setSize(innerWidth,innerHeight);
    }
  };
}