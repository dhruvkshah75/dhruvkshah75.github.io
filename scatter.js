import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Independent seeded random and Perlin streams keep async loading out of the layout.
function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function perlin(seed) {
  const random = mulberry32(seed), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]];
  }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => [x + y, -x + y, x - y, -x - y][h & 3];
  const hash = (x, y) => p[(p[x & 255] + y) & 255];
  return (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), u = fade(x - X), v = fade(y - Y);
    x -= X; y -= Y;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(grad(hash(X, Y), x, y), grad(hash(X + 1, Y), x - 1, y), u),
      THREE.MathUtils.lerp(grad(hash(X, Y + 1), x, y - 1), grad(hash(X + 1, Y + 1), x - 1, y - 1), u), v);
  };
}

// Deterministic RGBA cutout tiles; optional artist textures can replace these.
function cutout(kind) {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    let inside = false;
    if (kind === 'leaf') {
      inside = Math.abs(u - 0.5) < 0.41 * Math.sin(Math.PI * v) * (0.96 + 0.04 * Math.cos(v * 60));
    } else if (kind === 'fern') {
      const w = 0.43 * Math.sin(Math.PI * v), rib = Math.abs(u - 0.5);
      inside = (rib < 0.012 || (rib < w && Math.abs(((v * 14 - rib * 4) % 1 + 1) % 1 - 0.5) < 0.18));
    } else {
      for (let blade = 0; blade < 7; blade++) {
        const h = 0.58 + 0.4 * Math.sin(blade * 2.3) ** 2;
        const center = 0.5 + (blade - 3) * 0.09 + Math.sin(blade * 3.1) * v * v * 0.22;
        inside ||= v < h && Math.abs(u - center) < 0.026 * (1 - v / h);
      }
    }
    const i = (y * size + x) * 4, shade = 0.75 + v * 0.25;
    const color = kind === 'leaf' ? [154, 95, 35] : [66, 112, 37];
    data.set([...color.map(c => Math.round(c * shade)), inside ? 255 : 0], i);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Add details and resolve to a Group with userData.counts, plantZones and dispose().
 * Coordinates are scene-local X/Z, in meters; ground defaults to y=0.
 * path: Curve<Vector3>, or >=2 Vector3/{x,z}/[x,z]/[x,y,z] points.
 * options: density (0..1), seed, pathHalfWidth, clearance, minSpacing,
 * bounds:{minX,maxX,minZ,maxZ}, heightAt:(x,z)=>y, noiseScale,
 * treeBases:[{x,z,radius?}] (or auto-detect named oak/pine/trunk objects),
 * counts:{ferns,grass,leaves,rocks,pebbles,mushrooms,boulders,logs},
 * textureUrls:{fern,grass,leaf}, assetPath:'./assets/',
 * dracoPath:'./draco/' (serve Three's examples/jsm/libs/draco/gltf/ here).
 * Example: const detail = await buildForestDetail(scene, points, {density:0.6});
 * On teardown: detail.userData.dispose(). GLB failures warn and skip that variant.
 * 60% of plants target 0..2m from the path edge, 20% 2..5m, 20% beyond 5m.
 */
export async function buildForestDetail(scene, path, options = {}) {
  const density = options.density ?? 1;
  if (!Number.isFinite(density) || density < 0 || density > 1) throw new RangeError('density must be 0..1');
  const raw = path?.getPoints ? path.getPoints(512) : path;
  if (!Array.isArray(raw) || raw.length < 2) throw new TypeError('path needs at least two points');
  const points = raw.map(p => Array.isArray(p) ? { x: p[0], z: p.length > 2 ? p[2] : p[1] } : { x: p.x, z: p.z });
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new TypeError('Invalid path coordinates');
  const halfWidth = options.pathHalfWidth ?? 1.85, clearance = options.clearance ?? 0.15;
  const spacing = options.minSpacing ?? 0.65, frequency = options.noiseScale ?? 0.18;
  if ([halfWidth, clearance, spacing, frequency].some(v => !Number.isFinite(v) || v < 0)) throw new RangeError('Invalid spacing/noise options');
  const bounds = options.bounds ?? {
    minX: Math.min(...points.map(p => p.x)) - 20, maxX: Math.max(...points.map(p => p.x)) + 20,
    minZ: Math.min(...points.map(p => p.z)) - 5, maxZ: Math.max(...points.map(p => p.z)) + 5,
  };
  if (Object.values(bounds).some(v => !Number.isFinite(v)) || !(bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ)) throw new RangeError('Invalid bounds');
  const seed = (options.seed ?? 1739) >>> 0, random = mulberry32(seed), noise = perlin(seed ^ 0xABCDEF);
  const heightAt = options.heightAt ?? (() => 0), group = new THREE.Group(); group.name = 'forest-detail';
  const geometries = new Set(), materials = new Set(), textures = new Set(), counts = {};
  const owned = (set, item) => (set.add(item), item);
  const inside = (x, z, r = 0) => x - r >= bounds.minX && x + r <= bounds.maxX && z - r >= bounds.minZ && z + r <= bounds.maxZ;
  const distance = (x, z) => {
    let best = Infinity;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
    }
    return best;
  };
  const patch = (x, z) => THREE.MathUtils.clamp(0.48 + noise(x * frequency, z * frequency) * 0.9, 0.04, 0.95);
  const defaults = { ferns: 350, grass: 1400, leaves: 1000, rocks: 90, pebbles: 280, mushrooms: 120, boulders: 14, logs: 8 };
  const target = type => {
    const n = options.counts?.[type] ?? defaults[type];
    if (!Number.isFinite(n) || n < 0) throw new RangeError(`Invalid ${type} count`);
    return Math.floor(n * density);
  };
  const wanted = Object.fromEntries(Object.keys(defaults).map(k => [k, target(k)]));
  const matrix = (x, z, scale = 1, angle = random() * Math.PI * 2, lift = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, heightAt(x, z) + lift, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
    scale.isVector3 ? scale : new THREE.Vector3(scale, scale, scale));
  const material = params => owned(materials, new THREE.MeshStandardMaterial({ roughness: 0.95, ...params }));
  const geometry = g => owned(geometries, g);
  const instance = (name, geo, mat, transforms) => {
    if (!transforms.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length); mesh.name = name;
    transforms.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true; mesh.castShadow = name !== 'leaves';
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  };
  const report = (type, count) => { counts[type] = count; console.info(`[forest-detail] ${type}: ${count} instances (target ${wanted[type]})`); };
  group.userData.dispose = () => {
    group.removeFromParent(); group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    textures.forEach(t => { t.dispose(); t.source?.data?.close?.(); }); group.clear();
  };
  try {
    // Read trunk anchors before adding detail. Explicit anchors also support unnamed trees.
    const trees = [...(options.treeBases ?? [])].map(p => ({ x: p.x, z: p.z, r: p.radius ?? 0.4 }));
    if (!options.treeBases) {
      scene.updateMatrixWorld(true);
      scene.traverse(obj => {
        if (!obj.isMesh || !/(oak|pine|trunk)/i.test(obj.name)) return;
        const base = new THREE.Vector3(), transform = new THREE.Matrix4();
        obj.geometry.computeBoundingBox(); const box = obj.geometry.boundingBox;
        const addBase = m => {
          base.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).applyMatrix4(m);
          scene.worldToLocal(base);
          if (!trees.some(p => Math.hypot(p.x - base.x, p.z - base.z) < 0.4)) trees.push({ x: base.x, z: base.z, r: 0.4 });
        };
        if (obj.isInstancedMesh) for (let i = 0; i < obj.count; i++) {
          obj.getMatrixAt(i, transform); transform.premultiply(obj.matrixWorld); addBase(transform);
        } else addBase(obj.matrixWorld);
      });
    }
    if (trees.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.r) || p.r < 0)) throw new TypeError('Invalid treeBases');
    const obstacles = [...trees];
    const free = (x, z, r, gap = 0) => obstacles.every(p => Math.hypot(x - p.x, z - p.z) >= r + p.r + gap);
    const draw = () => ({ x: THREE.MathUtils.lerp(bounds.minX, bounds.maxX, random()), z: THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, random()) });
    const sample = (n, accept) => {
      const result = [];
      for (let attempt = 0; attempt < n * 160 && result.length < n; attempt++) {
        const p = draw(); if (accept(p.x, p.z)) result.push(p);
      }
      return result;
    };
    // Load all variants concurrently, but place in a fixed order after loading completes.
    const draco = new DRACOLoader().setDecoderPath(options.dracoPath ?? './draco/'); draco.setWorkerLimit(2);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const names = ['boulder_01', 'boulder_02', 'boulder_03', 'log_01', 'log_02'];
    let loaded;
    try {
      loaded = await Promise.all(names.map(async name => {
        if (!wanted[name.startsWith('log') ? 'logs' : 'boulders']) return null;
        try { return (await loader.loadAsync(`${options.assetPath ?? './assets/'}${name}.glb`)).scene; }
        catch (error) { console.warn(`[forest-detail] Skipping ${name}`, error); return null; }
      }));
    } finally { draco.dispose(); }
    for (const type of ['boulders', 'logs']) {
      const variants = [];
      names.forEach((name, index) => {
        const root = loaded[index]; if (!root || name.startsWith('log') !== (type === 'logs')) return;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root), center = box.getCenter(new THREE.Vector3());
        const offset = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z), parts = [];
        root.traverse(obj => {
          if (!obj.isMesh) return;
          const geo = geometry(obj.geometry.clone().applyMatrix4(offset.clone().multiply(obj.matrixWorld)));
          // These loaded resources belong to this build, never to the existing scene.
          geometries.add(obj.geometry);
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(mat => {
            materials.add(mat); Object.values(mat).forEach(v => { if (v?.isTexture) textures.add(v); });
          });
          parts.push({ geo, mat: obj.material });
        });
        const size = box.getSize(new THREE.Vector3());
        if (parts.length) variants.push({ name, parts, radius: Math.hypot(size.x, size.z) / 2, transforms: [] });
      });
      let placed = 0;
      for (let i = 0; i < wanted[type] && variants.length; i++) {
        const variant = variants[i % variants.length], scale = 0.75 + random() * 0.5, radius = variant.radius * scale;
        const [p] = sample(1, (x, z) => inside(x, z, radius) && distance(x, z) > halfWidth + radius + clearance && free(x, z, radius, spacing));
        if (!p) continue;
        variant.transforms.push(matrix(p.x, p.z, scale)); obstacles.push({ ...p, r: radius }); placed++;
      }
      variants.forEach(v => v.parts.forEach((part, i) => instance(`${v.name}:${i}`, part.geo, part.mat, v.transforms)));
      report(type, placed);
    }
    // Three crossed cards make each plant a single instanced clump, not three draws.
    const cards = [0, Math.PI / 3, Math.PI * 2 / 3].map(angle =>
      new THREE.PlaneGeometry(0.85, 0.85).translate(0, 0.425, 0).rotateY(angle));
    const plantGeo = geometry(mergeGeometries(cards)); cards.forEach(card => card.dispose());
    const plantZones = {};
    for (const type of ['ferns', 'grass', 'leaves']) {
      const kind = type === 'ferns' ? 'fern' : type === 'leaves' ? 'leaf' : 'grass';
      let texture;
      try { if (options.textureUrls?.[kind]) texture = await new THREE.TextureLoader().loadAsync(options.textureUrls[kind]); }
      catch (error) { console.warn(`[forest-detail] ${kind} texture failed; using generated tile`, error); }
      texture = owned(textures, texture ?? cutout(kind)); texture.colorSpace = THREE.SRGBColorSpace;
      const mat = material({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide,
        polygonOffset: type === 'leaves', polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const geo = type === 'leaves' ? geometry(new THREE.PlaneGeometry(0.18, 0.28).rotateX(-Math.PI / 2)) : plantGeo;
      const total = wanted[type], near = Math.round(total * 0.6), deep = Math.round(total * 0.2);
      const quotas = type === 'leaves' ? [total] : [near, Math.max(0, total - near - deep), deep];
      const transforms = [], zones = [];
      quotas.forEach((quota, zone) => {
        const placements = sample(quota, (x, z) => {
          const radius = type === 'leaves' ? 0.02 : 0.58;
          if (!inside(x, z, radius) || !free(x, z, radius)) return false;
          if (type !== 'leaves') {
            const edge = distance(x, z) - halfWidth;
            if (edge < clearance + radius || (zone === 0 ? edge > 2 : zone === 1 ? edge <= 2 || edge > 5 : edge <= 5)) return false;
          }
          return random() < patch(x, z) ** 2;
        });
        zones.push(placements.length);
        placements.forEach(p => transforms.push(matrix(p.x, p.z, 0.65 + random() * 0.7, undefined, type === 'leaves' ? 0.018 : 0)));
      });
      instance(type, geo, mat, transforms); report(type, transforms.length); plantZones[type] = zones;
    }
    // Stones form local clusters; only low pebbles are allowed on the trail.
    const rockGeo = geometry(new THREE.IcosahedronGeometry(1, 0)), rockMat = material({ color: 0x696d60, flatShading: true });
    for (const type of ['rocks', 'pebbles']) {
      const anchors = sample(Math.max(1, Math.ceil(wanted[type] / 8)), (x, z) => {
        const edge = distance(x, z) - halfWidth; return edge > 0.5 && edge < 2.2 && free(x, z, 0.2);
      });
      const transforms = [];
      for (let i = 0; i < wanted[type] * 40 && transforms.length < wanted[type] && anchors.length; i++) {
        const a = anchors[Math.floor(random() * anchors.length)], x = a.x + (random() - 0.5) * 2, z = a.z + (random() - 0.5) * 2;
        const s = type === 'rocks' ? 0.12 + random() * 0.17 : 0.025 + random() * 0.05;
        if (!inside(x, z, s) || !free(x, z, s) || (type === 'rocks' && distance(x, z) < halfWidth + s + clearance)) continue;
        transforms.push(matrix(x, z, new THREE.Vector3(s, s * 0.5, s * 0.8), undefined, s * 0.3));
      }
      instance(type, rockGeo, rockMat, transforms); report(type, transforms.length);
    }
    // Each mushroom is two instanced parts; clusters sit just outside trunk radii.
    const clusters = trees.map(t => { const a = random() * Math.PI * 2, r = t.r + 0.45; return { x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r }; });
    const mushrooms = [];
    for (let i = 0; i < wanted.mushrooms * 80 && mushrooms.length < wanted.mushrooms && clusters.length; i++) {
      const c = clusters[Math.floor(random() * clusters.length)], x = c.x + (random() - 0.5) * 0.5, z = c.z + (random() - 0.5) * 0.5;
      if (inside(x, z, 0.12) && free(x, z, 0.08) && distance(x, z) > halfWidth + 0.16 + clearance) mushrooms.push(matrix(x, z, 0.7 + random() * 0.6));
    }
    instance('mushroom-stems', geometry(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6).translate(0, 0.08, 0)), material({ color: 0xd8ccaa }), mushrooms);
    instance('mushroom-caps', geometry(new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.16, 0)), material({ color: 0x99552e }), mushrooms);
    if (wanted.mushrooms && !trees.length) console.warn('[forest-detail] No trunk anchors; supply options.treeBases for mushrooms.');
    report('mushrooms', mushrooms.length);
    group.userData.counts = counts; group.userData.plantZones = plantZones;
    group.userData.renderInstances = group.children.reduce((n, mesh) => n + mesh.count, 0);
    console.info(`[forest-detail] ${group.userData.renderInstances} rendered part instances in ${group.children.length} batches`);
    scene.add(group); return group;
  } catch (error) { group.userData.dispose(); throw error; }
}
