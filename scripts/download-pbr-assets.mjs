import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.polyhaven.com';
const headers = { 'User-Agent': 'NEON-STREETS-PBR-Asset-Build/1.0' };
const outputDir = path.resolve('public/textures');
const specs = [
  { key: 'asphalt', id: 'asphalt_03', name: /asphalt 03/i },
  { key: 'concrete', id: 'concrete_floor_01', name: /concrete floor 01/i },
  { key: 'brick', id: 'red_bricks_04', name: /red bricks 04/i },
  { key: 'wood', id: 'wood_floor_deck', name: /wood floor deck/i },
  { key: 'bark', id: 'eucalyptus_bark', name: /eucalyptus bark/i },
  { key: 'metal', id: 'rusty_metal_02', name: /rusty metal 02/i }
];

async function getJson(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
  return response.json();
}
function flattenFiles(node, prefix = '', output = []) {
  if (!node || typeof node !== 'object') return output;
  if (typeof node.url === 'string') {
    output.push({ path: prefix.toLowerCase(), url: node.url, size: Number(node.size) || 0 });
    return output;
  }
  for (const [key, value] of Object.entries(node)) {
    flattenFiles(value, prefix ? prefix + '/' + key : key, output);
  }
  return output;
}
function pickMap(files, kind) {
  const patterns = {
    diff: /diffuse|albedo|base.?color|(^|\/)diff($|\/)/i,
    normal: /nor_gl|normal/i,
    rough: /rough/i,
    height: /displacement|height|(^|\/)disp($|\/)/i,
    metal: /metal/i
  };
  const candidates = files.filter(file => patterns[kind].test(file.path));
  if (!candidates.length) return null;
  const has1k = candidates.some(file => /(^|\/)1k(\/|$)/i.test(file.path));
  const resolutionFiltered = has1k
    ? candidates.filter(file => /(^|\/)1k(\/|$)/i.test(file.path))
    : candidates;
  const preferred = kind === 'normal' || kind === 'metal' ? ['png', 'jpg', 'jpeg'] : ['jpg', 'jpeg', 'png'];
  resolutionFiltered.sort((a, b) => {
    const rank = file => {
      const ext = path.extname(new URL(file.url).pathname).slice(1).toLowerCase();
      const format = preferred.indexOf(ext);
      const res = file.path.match(/(^|\/)(\\d+k)(\/|$)/i)?.[2]?.toLowerCase();
      return (res === '1k' ? 0 : res === '2k' ? 10 : res === '4k' ? 20 : 30) + (format < 0 ? 9 : format);
    };
    return rank(a) - rank(b);
  });
  return resolutionFiltered[0];
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const assets = await getJson(API + '/assets?type=textures');
  const manifest = { source: 'Poly Haven', license: 'CC0 1.0', materials: {} };
  for (const spec of specs) {
    const asset = assets[spec.id] || Object.entries(assets).find(([, item]) => spec.name.test(item.name || ''))?.[1];
    if (!asset) {
      process.stdout.write('PBR skipped: ' + spec.key + ' asset not found\n');
      continue;
    }
    const assetId = assets[spec.id] ? spec.id : Object.keys(assets).find(id => assets[id] === asset);
    const fileTree = await getJson(API + '/files/' + assetId);
    const files = flattenFiles(fileTree);
    const selected = {};
    for (const mapKind of ['diff', 'normal', 'rough', 'height', 'metal']) {
      const file = pickMap(files, mapKind);
      if (!file) continue;
      const ext = path.extname(new URL(file.url).pathname).slice(1).toLowerCase() || 'jpg';
      const filename = 'pbr_' + spec.key + '_' + mapKind + '.' + ext;
      const response = await fetch(file.url, { headers, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('Download failed (' + response.status + '): ' + file.url);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await writeFile(path.join(outputDir, filename), bytes);
      selected[mapKind] = filename;
      process.stdout.write('PBR ' + spec.key + '/' + mapKind + ' ' + Math.round(bytes.byteLength / 1024) + ' KB\n');
    }
    if (selected.diff) manifest.materials[spec.key] = selected;
  }
  if (Object.keys(manifest.materials).length) {
    await writeFile(path.join(outputDir, 'pbr-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    process.stdout.write('Poly Haven PBR sets ready: ' + Object.keys(manifest.materials).join(', ') + '\n');
  } else {
    process.stdout.write('No external PBR maps were downloaded; the game will use procedural fallback textures.\n');
  }
}
main().catch(error => {
  process.stderr.write('PBR download unavailable; production build will use procedural fallback: ' + (error?.stack || error) + '\n');
});
