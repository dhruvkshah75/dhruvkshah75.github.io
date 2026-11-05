"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { stops } from "@/lib/portfolio";

export type SceneControls = { progress: number; motion: boolean; paused: boolean };
type Props = { controls: RefObject<SceneControls>; onReady: (ready: boolean) => void; markerRoot: RefObject<HTMLDivElement | null> };

const pathX = (z: number) => Math.sin(z * 0.047) * 1.6;

// Seeded placement keeps the same forest on every visit and every screen size.
function randomGenerator(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export default function ForestScene({ controls, onReady, markerRoot }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power", alpha: false }); }
    catch { onReady(false); return; }
    const rnd = randomGenerator(1739);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1819");
    scene.fog = new THREE.FogExp2("#0b1819", 0.037);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 95);
    camera.position.set(0, 2.35, 12);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    function mat(color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...options }); materials.push(m); return m;
    }
    const cube = new THREE.BoxGeometry(1, 1, 1); geometries.push(cube);
    const trunkMat = mat("#343e31");
    const leafMat = mat("#284438");
    const paleLeafMat = mat("#38523c");
    const stoneMat = mat("#566963");
    const grassMat = mat("#394e31");
    const darkWood = mat("#453e2c");
    const gold = mat("#c3ac67", { metalness: 0.35, roughness: 0.6 });
    const paper = mat("#c8d2ae");
    const crystalMat = mat("#96c6ff", { emissive: "#4e8fef", emissiveIntensity: 1.1 });

    function pixelTexture(base: [number, number, number], variance: number, size = 64) {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const v = (rnd() - .5) * variance;
        ctx.fillStyle = `rgb(${base.map(n => Math.max(0, Math.round(n + v))).join(",")})`;
        ctx.fillRect(x, y, 1, 1);
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; textures.push(t); return t;
    }
    const groundTex = pixelTexture([57, 67, 43], 24); groundTex.repeat.set(16, 50);
    const groundMat = mat("#667158", { map: groundTex });
    const groundGeometry = new THREE.PlaneGeometry(100, 220); geometries.push(groundGeometry);
    const ground = new THREE.Mesh(groundGeometry, groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.025, -65); scene.add(ground);

    const pathTex = pixelTexture([115, 109, 72], 30); pathTex.repeat.set(1, 34);
    const pathMat = mat("#9c9673", { map: pathTex });
    const pathPositions: number[] = [], pathUVs: number[] = [], pathIndices: number[] = [];
    for (let i = 0; i <= 210; i++) {
      const z = 24 - i;
      const w = 1.7 + Math.sin(i * .7) * .13;
      pathPositions.push(pathX(z) - w, 0, z, pathX(z) + w, 0, z);
      pathUVs.push(0, i / 210, 1, i / 210);
      if (i < 210) { const a = i * 2; pathIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const pathGeo = new THREE.BufferGeometry(); pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(pathPositions, 3)); pathGeo.setAttribute("uv", new THREE.Float32BufferAttribute(pathUVs, 2)); pathGeo.setIndex(pathIndices); pathGeo.computeVertexNormals(); geometries.push(pathGeo);
    scene.add(new THREE.Mesh(pathGeo, pathMat));

    type Block = { x: number; y: number; z: number; w: number; h: number; d: number; r?: number };
    const trunks: Block[] = [], leaves: Block[] = [], paleLeaves: Block[] = [], grasses: Block[] = [], rocks: Block[] = [];
    function instances(blocks: Block[], material: THREE.Material) {
      const inst = new THREE.InstancedMesh(cube, material, blocks.length);
      const obj = new THREE.Object3D();
      blocks.forEach((b, i) => { obj.position.set(b.x, b.y, b.z); obj.scale.set(b.w, b.h, b.d); obj.rotation.set(0, b.r || 0, 0); obj.updateMatrix(); inst.setMatrixAt(i, obj.matrix); });
      inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); scene.add(inst); return inst;
    }
    // Dense rows of block-built trees, with a clear walkable corridor through the middle.
    for (let i = 0; i < 290; i++) {
      const z = 23 - rnd() * 190;
      const side = i % 2 ? 1 : -1;
      const x = pathX(z) + side * (3.6 + rnd() * 25);
      const h = 7 + rnd() * 10;
      const w = .48 + rnd() * .65;
      trunks.push({ x, y: h / 2, z, w, h, d: w });
      // Small bark pixels catch the warm light on nearby trunks.
      for (let b = 0; b < 3; b++) trunks.push({ x: x + w * .45, y: 1 + rnd() * h, z, w: .12, h: .3 + rnd() * .8, d: w * 1.06 });
      for (let tier = 0; tier < 5; tier++) {
        const size = 5.6 - tier * .77 + rnd() * .7;
        const block = { x: x + (rnd() - .5) * .9, y: h * .59 + tier * 1.2, z, w: size, h: 1.4 + rnd() * .5, d: size * (.7 + rnd() * .3) };
        (tier % 3 === 0 ? paleLeaves : leaves).push(block);
      }
      if (rnd() > .45) trunks.push({ x: x + side * 1.1, y: h * .6, z, w: 2.6, h: .35, d: .4 });
      // Chunky ferns and undergrowth at the foot of trees.
      for (let b = 0; b < 4; b++) {
        const bx = x + (rnd() - .5) * 3, bz = z + (rnd() - .5) * 3;
        leaves.push({ x: bx, y: .35, z: bz, w: .5 + rnd() * 1.2, h: .4 + rnd() * .6, d: .5 + rnd() });
      }
    }
    for (let i = 0; i < 2200; i++) {
      const z = 20 - rnd() * 180, side = i % 2 ? 1 : -1;
      const x = pathX(z) + side * (1.85 + rnd() * 11);
      grasses.push({ x, y: .12, z, w: .06 + rnd() * .09, h: .16 + rnd() * .37, d: .09, r: rnd() * Math.PI });
    }
    for (let i = 0; i < 190; i++) {
      const z = 20 - rnd() * 180, side = i % 2 ? 1 : -1;
      const size = .15 + rnd() * .7;
      rocks.push({ x: pathX(z) + side * (2.1 + rnd() * 10), y: size * .25, z, w: size, h: size * .6, d: size * .8, r: rnd() });
    }
    instances(trunks, trunkMat); instances(leaves, leafMat); instances(paleLeaves, paleLeafMat); instances(grasses, grassMat); instances(rocks, stoneMat);

    const hemi = new THREE.HemisphereLight("#789aa6", "#1c2413", 1.5); scene.add(hemi);
    const moonLight = new THREE.DirectionalLight("#6b9cba", 1.5); moonLight.position.set(-10, 20, -30); scene.add(moonLight);
    const torch = new THREE.SpotLight("#ffdb99", 200, 29, .72, .85, 1.5);
    const torchFill = new THREE.PointLight("#f3c885", 20, 11, 1.6);
    scene.add(torch, torch.target, torchFill);

    // A square moon and sparse stars, kept distant so the trail remains the focus.
    const moonMat = new THREE.MeshBasicMaterial({ color: "#b9d2c4", fog: false }); materials.push(moonMat);
    const moonGeo = new THREE.PlaneGeometry(2.6, 2.6); geometries.push(moonGeo);
    const moon = new THREE.Mesh(moonGeo, moonMat); moon.position.set(10, 21, -75); scene.add(moon);
    const starGeo = new THREE.BufferGeometry(); const starPositions = [];
    for (let i = 0; i < 85; i++) starPositions.push((rnd() - .5) * 150, 22 + rnd() * 35, -35 - rnd() * 100);
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3)); geometries.push(starGeo);
    const starMat = new THREE.PointsMaterial({ color: "#b7c9bd", size: .075, fog: false }); materials.push(starMat); scene.add(new THREE.Points(starGeo, starMat));

    function block(group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
      const mesh = new THREE.Mesh(cube, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); group.add(mesh); return mesh;
    }
    const markerPositions: THREE.Vector3[] = [];
    const artifacts: THREE.Group[] = [];
    const beacons: THREE.PointLight[] = [];
    const interactables: THREE.Object3D[] = [];
    stops.forEach((stop, index) => {
      const x = pathX(stop.z) + stop.side * 2.5;
      const group = new THREE.Group(); group.position.set(x, 0, stop.z); group.rotation.y = -stop.side * .22; scene.add(group); artifacts.push(group);
      block(group, stoneMat, 0, .2, 0, 1.45, .4, 1.15);
      block(group, stoneMat, 0, .55, 0, .95, .3, .8);
      if (index === 0) {
        block(group, darkWood, 0, 1.05, 0, .52, .8, .52);
        block(group, darkWood, 0, 1.5, 0, 1.25, .16, .8);
        const book = block(group, paper, 0, 1.68, 0, .9, .12, .59); book.rotation.z = -.08;
        block(group, gold, 0, 1.75, .015, .06, .05, .61);
      } else if (index === 1) {
        block(group, darkWood, 0, 1.02, 0, 1.27, .67, .8);
        block(group, gold, -.43, 1.03, .415, .09, .7, .045); block(group, gold, .43, 1.03, .415, .09, .7, .045);
        block(group, darkWood, 0, 1.43, -.13, 1.27, .18, .8).rotation.x = -.18;
        block(group, crystalMat, 0, 1.48, .2, .16, .13, .18);
      } else if (index === 2) {
        block(group, stoneMat, -.12, 1, 0, .85, .5, .65);
        block(group, stoneMat, .1, 1.4, 0, .65, .3, .6);
        block(group, stoneMat, 0, 1.7, 0, .4, .3, .4);
        block(group, crystalMat, 0, 2.02, 0, .15, .3, .15);
      } else {
        block(group, darkWood, 0, 1.28, 0, .12, 1.4, .12);
        block(group, darkWood, .32, 1.97, 0, .74, .12, .12);
        block(group, gold, .61, 1.66, 0, .44, .12, .44);
        block(group, crystalMat, .61, 1.39, 0, .32, .43, .32);
        block(group, gold, .61, 1.13, 0, .44, .12, .44);
      }
      const beacon = new THREE.PointLight("#76afff", 6, 7, 1.8); beacon.position.set(x, 1.6, stop.z); scene.add(beacon); beacons.push(beacon);
      const crystal = block(group, crystalMat, index === 3 ? -.7 : .8, .7, .25, .13, .38, .13); crystal.rotation.z = -.16;
      group.userData.stop = stop.id; interactables.push(group);
      markerPositions.push(new THREE.Vector3(x, index === 3 ? 2.6 : 2.5, stop.z));
    });

    // Fireflies are a single draw call, rather than a light for every particle.
    const flyCount = 130; const flyGeo = new THREE.BufferGeometry(); const flyBase = new Float32Array(flyCount * 3); const flyPos = new Float32Array(flyCount * 3);
    for (let i = 0; i < flyCount; i++) { const z = 12 - rnd() * 155; flyBase[i * 3] = pathX(z) + (rnd() - .5) * 15; flyBase[i * 3 + 1] = .4 + rnd() * 4.5; flyBase[i * 3 + 2] = z; }
    flyPos.set(flyBase); flyGeo.setAttribute("position", new THREE.BufferAttribute(flyPos, 3)); geometries.push(flyGeo);
    const flyMat = new THREE.PointsMaterial({ color: "#c7db86", size: .055, transparent: true, opacity: .8, sizeAttenuation: true, depthWrite: false }); materials.push(flyMat);
    scene.add(new THREE.Points(flyGeo, flyMat));

    let pointerX = 0, pointerY = 0, viewX = 0, viewY = 0, progress = controls.current.progress;
    const aim = new THREE.Vector3(), projected = new THREE.Vector3();
    const markerEls = stops.map(s => markerRoot.current?.querySelector<HTMLElement>(`[data-stop="${s.id}"]`) ?? null);
    const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
    const onPointer = (event: PointerEvent) => { if (event.pointerType !== "mouse" || container.clientWidth < 640) return; pointerX = (event.clientX / window.innerWidth - .5) * 2; pointerY = (event.clientY / window.innerHeight - .5) * 2; };
    const onLeave = () => { pointerX = pointerY = 0; };
    const onClick = (event: PointerEvent) => {
      if (controls.current.paused) return;
      pointer.set(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactables, true);
      if (hits.length && hits[0].distance < 22) {
        let node = hits[0].object;
        while (node.parent && !node.userData.stop) node = node.parent;
        markerRoot.current?.querySelector<HTMLButtonElement>(`[data-stop="${node.userData.stop}"]`)?.click();
      }
    };
    window.addEventListener("pointermove", onPointer, { passive: true }); document.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerup", onClick);
    let width = 0, height = 0;
    function resize() {
      width = container.clientWidth; height = container.clientHeight;
      pointerX = pointerY = viewX = viewY = 0;
      // Intentionally low resolution, nearest-neighbour upscaled for a true pixel look.
      const scale = width < 640 ? 2 : 3;
      renderer.setSize(Math.ceil(width / scale), Math.ceil(height / scale), false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      stops.forEach((stop, i) => {
        const x = pathX(stop.z) + stop.side * (width < 640 ? 1.5 : 2.5);
        artifacts[i].position.x = x; markerPositions[i].x = x; beacons[i].position.x = x;
      });
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let previousTime = 0, elapsed = 0;
    function animate(time: number) {
      const delta = Math.min((time - previousTime) / 1000, .05); previousTime = time;
      const settings = controls.current;
      const moving = settings.motion && !settings.paused;
      if (moving) elapsed += delta;
      progress = settings.motion ? THREE.MathUtils.damp(progress, settings.progress, 5, delta) : settings.progress;
      viewX = THREE.MathUtils.damp(viewX, moving ? pointerX : 0, 3, delta);
      viewY = THREE.MathUtils.damp(viewY, moving ? pointerY : 0, 3, delta);
      const z = 12 - progress * 128;
      const velocity = Math.abs(settings.progress - progress);
      const bob = moving ? Math.sin(progress * 300) * Math.min(velocity * 5, .055) : 0;
      camera.position.set(pathX(z) + viewX * .16, 2.35 + bob, z);
      aim.set(pathX(z - 18) + viewX * 3, 2.3 - viewY * 1.5, z - 18);
      camera.lookAt(aim);
      torch.position.set(camera.position.x + .4, 2, z + .3);
      torch.target.position.set(pathX(z - 9) + viewX * 4, .6 - viewY * 2, z - 9);
      torch.intensity = 205 + Math.sin(elapsed * 7) * 3 + Math.sin(elapsed * 13.7) * 2;
      torchFill.position.set(camera.position.x, 1.6, z - 1);
      moon.position.z = z - 78;
      if (moving) {
        for (let i = 0; i < flyCount; i++) { flyPos[i * 3] = flyBase[i * 3] + Math.sin(elapsed * .36 + i) * .45; flyPos[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(elapsed * .7 + i * 2) * .22; }
        flyGeo.attributes.position.needsUpdate = true;
      }
      renderer.render(scene, camera);
      markerPositions.forEach((position, i) => {
        const el = markerEls[i]; if (!el) return;
        const distance = camera.position.z - position.z;
        projected.copy(position).project(camera);
        const visible = progress > .025 && distance > 3.4 && distance < 24 && projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < .9;
        el.style.visibility = visible ? "visible" : "hidden";
        el.style.opacity = visible ? String(Math.min(1, (24 - distance) / 6, (distance - 3.4) / 2)) : "0";
        const half = el.offsetWidth / 2 + 20;
        el.style.left = `${THREE.MathUtils.clamp((projected.x * .5 + .5) * width, half, width - half)}px`;
        el.style.top = `${(-projected.y * .5 + .5) * height}px`;
        el.tabIndex = visible ? 0 : -1;
      });
    }
    const onVisibility = () => { if (document.hidden) renderer.setAnimationLoop(null); else { previousTime = performance.now(); renderer.setAnimationLoop(animate); } };
    document.addEventListener("visibilitychange", onVisibility);
    renderer.setAnimationLoop(animate); onReady(true);
    return () => {
      renderer.setAnimationLoop(null); observer.disconnect();
      window.removeEventListener("pointermove", onPointer); document.removeEventListener("pointerleave", onLeave); document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerup", onClick);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [controls, onReady, markerRoot]);

  return <div ref={host} className="forest-canvas" role="img" aria-label="A dark pixel forest with a winding trail. Your torch illuminates nearby trees as you scroll forward." />;
}
