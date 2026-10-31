import * as THREE from 'three';

const mat = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function box(w, h, d, material, x, y, z, group) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
function makeBuilding(group, x, z, w, d, h, color, seed) {
  const wall = mat(color, .92), dark = mat('#17232b'), glass = mat('#243e4b', .28, .45), trim = mat('#3b4548');
  box(w, h, d, wall, x, h / 2, z, group);
  box(w + .12, .18, d + .12, trim, x, h, z, group);
  const floors = Math.max(2, Math.floor(h / 2.5));
  for (let f = 0; f < floors; f++) {
    const y = 1.05 + f * 2.25;
    if (y > h - .6) continue;
    for (let i = 0; i < Math.max(2, Math.floor(w / 1.8)); i++) {
      const wx = x - w / 2 + .9 + i * 1.8;
      box(.78, 1.05, .07, glass, wx, y, z + d / 2 + .045, group);
      box(.82, .09, .09, dark, wx, y - .58, z + d / 2 + .07, group);
    }
  }
  box(w * .72, .55, .12, dark, x, h * .68, z + d / 2 + .09, group);
  if (seed % 2 === 0) {
    const sign = box(w * .55, .34, .14, mat('#c38b4a', .45), x, h * .68, z + d / 2 + .18, group);
    sign.material.emissive = new THREE.Color('#5a2d12'); sign.material.emissiveIntensity = .45;
  }
}
function makeStreetLamp(group, x, z) {
  const metal = mat('#303b40', .42, .7);
  const glow = new THREE.MeshStandardMaterial({ color: '#f6dba0', emissive: '#f6c56d', emissiveIntensity: 2 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, 4.3, 8), metal);
  pole.position.set(x, 2.15, z); pole.castShadow = true; group.add(pole);
  box(.9, .08, .08, metal, x + .38, 4.18, z, group);
  box(.32, .12, .24, glow, x + .72, 4.08, z, group);
}
export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9aaeb5');
  scene.fog = new THREE.FogExp2('#9aaeb5', .0085);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 240);
  camera.position.set(0, 5, 9);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene.add(new THREE.HemisphereLight('#dce8ef', '#3d4543', 2.0));
  const sun = new THREE.DirectionalLight('#ffe2bd', 3.0);
  sun.position.set(-24, 38, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.bias = -.00025; scene.add(sun);
  const city = new THREE.Group(); scene.add(city);
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
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = sx * (17 + i * 9.5), z = sz * (17 + j * 9.5);
      const w = 7.2 + (i % 2) * 1.4, d = 7.2 + (j % 2) * 1.2, h = 8 + (i * 3 + j * 2 + (seed % 3) * 2);
      makeBuilding(city, x, z, w, d, h, colors[seed % colors.length], seed++);
    }
  }
  const trunk = mat('#59483a'), leaves = mat('#435d4c'), bench = mat('#564b3e'), bin = mat('#34484a');
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [-29, 0], [29, 0], [0, 29], [0, -29]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, 2, 7), trunk);
    t.position.set(x, 1, z); t.castShadow = true; city.add(t);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), leaves);
    crown.position.set(x, 2.55, z); crown.castShadow = true; city.add(crown);
  }
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-20, 0], [20, 0], [0, 20], [0, -20]]) makeStreetLamp(city, x, z);
  for (const [x, z] of [[-8, -12], [8, 12], [-18, 8], [18, -8]]) {
    box(2.2, .18, .65, bench, x, .62, z, city);
    box(.12, .65, .12, bench, x - .8, .32, z, city);
    box(.12, .65, .12, bench, x + .8, .32, z, city);
  }
  for (const [x, z] of [[-10, 3], [10, -3], [-23, -13], [23, 13]]) box(.75, 1.15, .75, bin, x, .58, z, city);
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2, r = 65 + (i % 4) * 5, h = 16 + (i * 7 % 22);
    box(7, h, 7, mat('#65777a'), Math.sin(a) * r, h / 2, Math.cos(a) * r, city);
  }
  const groundGrid = new THREE.GridHelper(120, 60, '#687579', '#687579');
  groundGrid.position.y = -.01; groundGrid.material.opacity = .12; groundGrid.material.transparent = true; scene.add(groundGrid);
  return {
    scene, camera, renderer, city,
    resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    }
  };
}