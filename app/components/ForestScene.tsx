"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { stops } from "@/lib/portfolio";

// Look controls. Pixelation changes resolution only; the HDR color pipeline stays full-depth.
const CONFIG = {
  timeOfDay: "night" as "night" | "dusk" | "day",
  enabled: true,
  render: { enabled: true },
  pixelate: { enabled: true, desktopScale: 3, mobileScale: 2, mobileBreakpoint: 640 },
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.85 },
  smaa: { enabled: true },
  vignette: { enabled: true, amount: 0.3, innerRadius: 0.45, outerRadius: 0.72 },
  grain: { enabled: true, intensity: 0.02, speed: 24 },
  grading: { enabled: true, saturation: 1.15, contrast: 1.04, shadowBlue: 0.002 },
  output: { enabled: true }, // Keep on for ACES tone mapping and sRGB conversion.
  presets: {
    night: {
      exposure: 1.12,
      fog: { color: "#12202c", density: Math.sqrt(-Math.log(0.6)) / 40 },
      environmentIntensity: 0.18,
      hemisphere: { sky: "#2a3f66", ground: "#1a2a18", intensity: 0.4 },
      main: { color: "#9fb8ff", intensity: 0.65, offset: [-24, 32, -18] },
      fill: { color: "#3a5a9a", intensity: 0.15 },
      shafts: { color: "#9fb8ff", opacity: 0 },
      mist: { color: "#6f8fb8", opacity: 0.15 },
    },
    dusk: {
      exposure: 1.3,
      fog: { color: "#344b53", density: Math.sqrt(-Math.log(0.6)) / 40 },
      environmentIntensity: 0.5,
      hemisphere: { sky: "#758aaf", ground: "#33452b", intensity: 0.85 },
      main: { color: "#ffcc96", intensity: 1.5, offset: [-30, 17, -18] },
      fill: { color: "#7e9edb", intensity: 0.4 },
      shafts: { color: "#ffd9a0", opacity: 0.06 },
      mist: { color: "#809ba9", opacity: 0.13 },
    },
    day: {
      exposure: 1.6,
      fog: { color: "#5f7f78", density: Math.sqrt(-Math.log(0.55)) / 40 },
      environmentIntensity: 0.9,
      hemisphere: { sky: "#9ec5ff", ground: "#3d5a2a", intensity: 1.2 },
      main: { color: "#ffd9a0", intensity: 3, offset: [-26, 22, -18] },
      fill: { color: "#8fb4ff", intensity: 0.6 },
      shafts: { color: "#ffd9a0", opacity: 0.1 },
      mist: { color: "#8da59a", opacity: 0.1 },
    },
  },
  lights: {
    torch: { color: "#ffb05a", intensity: 6, distance: 16, decay: 2, flicker: 0.1 },
    torchBeam: { color: "#fff0db", intensity: 25, angle: Math.PI / 4, penumbra: 0.75, target: [0, -0.8, -12] as const },
    beacon: { color: "#76afff", intensity: 6, distance: 7, decay: 1.8 },
  },
  shafts: { enabled: true, count: 4 },
  fireflies: { count: 56 },
  nightSky: { intensity: 0.65, blurriness: 0.015, rotationX: -0.32, zenith: "#050c18", horizon: "#12202c" },
  materials: {
    bark: ["#4a3322", "#6b4a2e"],
    leaves: ["#3d7a2e", "#5e9a3a"],
    paleLeaves: ["#4b8532", "#5e9a3a"], leafRoughness: 0.6,
    moss: "#5c8a2f", grass: ["#48752a", "#689638"],
    path: "#9a7447",
  },
};

// LOD applies to the procedural trees currently used by this scene (no GLBs are installed).
const QUALITY = {
  high: { lod: 0, foliageDensity: 1, shadows: true, bloom: true, postProcessing: true, maxPixelRatio: 2, moonShadowSize: 2048, torchShadowSize: 512 },
  medium: { lod: 0, foliageDensity: 0.7, shadows: true, bloom: true, postProcessing: true, maxPixelRatio: 1.5, moonShadowSize: 1024, torchShadowSize: 256 },
  low: { lod: 1, foliageDensity: 0.4, shadows: false, bloom: false, postProcessing: false, maxPixelRatio: 1, moonShadowSize: 512, torchShadowSize: 128 },
} as const;
type QualityName = keyof typeof QUALITY;

function detectQuality(): QualityName {
  const override = new URLSearchParams(window.location.search).get("quality");
  if (override === "high" || override === "medium" || override === "low") return override;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const narrowScreen = Math.min(window.innerWidth, window.screen.width || window.innerWidth) <= 768;
  return mobileAgent || narrowScreen ? "low" : "high";
}

export type SceneControls = { progress: number; motion: boolean; paused: boolean };
type Props = { controls: RefObject<SceneControls>; onReady: (ready: boolean) => void; markerRoot: RefObject<HTMLDivElement | null> };

const pathX = (z: number) => Math.sin(z * 0.047) * 1.6;
// Poly Haven, Moonlit Golf (Greg Zaal, CC0). Swap for a local /night.hdr if desired.
const NIGHT_HDR_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonlit_golf_1k.hdr";

// Seeded placement keeps the same forest on every visit and every screen size.
function randomGenerator(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export default function ForestScene({ controls, onReady, markerRoot }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const requestedTime = new URLSearchParams(window.location.search).get("time");
    const timeOfDay = requestedTime === "night" || requestedTime === "dusk" || requestedTime === "day" ? requestedTime : CONFIG.timeOfDay;
    const look = CONFIG.presets[timeOfDay];
    const qualityName = detectQuality(), quality = QUALITY[qualityName];
    const usePostProcessing = CONFIG.enabled && CONFIG.render.enabled && quality.postProcessing;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power", alpha: false }); }
    catch { onReady(false); return; }
    const rnd = randomGenerator(1739);
    const scene = new THREE.Scene();
    const hazeColor = new THREE.Color(look.fog.color);
    scene.background = hazeColor;
    scene.fog = new THREE.FogExp2(hazeColor, look.fog.density);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 95);
    camera.position.set(0, 2.35, 12);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
    // Accumulate every shadow/composer draw; reset once at the start of each frame.
    renderer.info.autoReset = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = look.exposure;
    renderer.shadowMap.enabled = quality.shadows;
    // PCF filtering supplies soft shadow edges on the supported Three.js API.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.dataset.quality = qualityName;
    renderer.domElement.dataset.timeOfDay = timeOfDay;
    renderer.domElement.dataset.lod = String(quality.lod);
    renderer.domElement.style.imageRendering = CONFIG.pixelate.enabled ? "pixelated" : "auto";
    container.appendChild(renderer.domElement);

    // HDR linear buffers preserve bright highlights until the final OutputPass.
    // No MSAA: SMAA operates on the composer image before output conversion.
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
    const smaaPass = new SMAAPass();
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const vignettePass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, amount: { value: CONFIG.vignette.amount },
        innerRadius: { value: CONFIG.vignette.innerRadius }, outerRadius: { value: CONFIG.vignette.outerRadius },
      },
      vertexShader,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount, innerRadius, outerRadius;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float edge = smoothstep(innerRadius, max(outerRadius, innerRadius + 0.001), length(vUv - 0.5));
          gl_FragColor = vec4(color.rgb * (1.0 - amount * edge), color.a);
        }
      `,
    });
    const grainPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, time: { value: 0 },
        intensity: { value: CONFIG.grain.intensity }, speed: { value: CONFIG.grain.speed },
      },
      vertexShader,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time, intensity, speed;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float noise = fract(sin(dot(gl_FragCoord.xy + floor(time * speed), vec2(12.9898, 78.233))) * 43758.5453);
          // Gentle, zero-mean grain retains the full color range.
          gl_FragColor = vec4(max(vec3(0.0), color.rgb * (1.0 + (noise - 0.5) * 2.0 * intensity)), color.a);
        }
      `,
    });
    const gradingPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, saturation: { value: CONFIG.grading.saturation },
        contrast: { value: CONFIG.grading.contrast },
        shadowBlue: { value: timeOfDay === "night" ? CONFIG.grading.shadowBlue : 0 },
      },
      vertexShader,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float saturation, contrast, shadowBlue;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          // Lift cool darks without tinting the torch's warm highlights.
          float shadowWeight = 1.0 - smoothstep(0.015, 0.12, luminance);
          vec3 lifted = color.rgb + vec3(0.0, shadowBlue * 0.25, shadowBlue) * shadowWeight;
          vec3 saturated = max(mix(vec3(luminance), lifted, saturation), vec3(0.0));
          // A continuous curve around middle gray, before ACES and sRGB output.
          gl_FragColor = vec4(0.18 * pow(saturated / 0.18, vec3(contrast)), color.a);
        }
      `,
    });
    const outputPass = new OutputPass();
    const passes = [renderPass, bloomPass, smaaPass, vignettePass, grainPass, gradingPass, outputPass];
    const passSettings = [CONFIG.render, CONFIG.bloom, CONFIG.smaa, CONFIG.vignette, CONFIG.grain, CONFIG.grading, CONFIG.output];
    passes.forEach((pass, i) => { pass.enabled = passSettings[i].enabled && (i !== 1 || quality.bloom); if (usePostProcessing && pass.enabled) composer.addPass(pass); });

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    // A deep horizon gradient is the fallback while the photographed night sky loads.
    if (timeOfDay === "night") {
      const skyCanvas = document.createElement("canvas"); skyCanvas.width = 512; skyCanvas.height = 256;
      const skyContext = skyCanvas.getContext("2d")!;
      const skyGradient = skyContext.createLinearGradient(0, 0, 0, 256);
      skyGradient.addColorStop(0, CONFIG.nightSky.zenith);
      skyGradient.addColorStop(0.5, CONFIG.nightSky.horizon);
      skyGradient.addColorStop(1, CONFIG.nightSky.horizon);
      skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 512, 256);
      const skyTexture = new THREE.CanvasTexture(skyCanvas);
      skyTexture.colorSpace = THREE.SRGBColorSpace; skyTexture.mapping = THREE.EquirectangularReflectionMapping;
      textures.push(skyTexture); scene.background = skyTexture;
    }
    // Indirect HDR fill keeps color in shaded foliage.
    let disposed = false;
    scene.environmentIntensity = look.environmentIntensity;
    new HDRLoader().load(NIGHT_HDR_URL, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      if (timeOfDay === "night") {
        // Use the real moonlit sky rather than a flat blue backdrop and geometric rays.
        scene.background = texture;
        scene.backgroundIntensity = CONFIG.nightSky.intensity;
        scene.backgroundBlurriness = CONFIG.nightSky.blurriness;
        // Aim the panorama's open sky at canopy gaps, rather than its photographed treeline.
        scene.backgroundRotation.x = CONFIG.nightSky.rotationX;
      }
      textures.push(texture);
    }, undefined, error => {
      if (!disposed) console.warn("Night HDR unavailable; continuing with moon and torch lighting.", error);
    });
    function mat(color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...options }); materials.push(m); return m;
    }
    const cube = new THREE.BoxGeometry(1, 1, 1); geometries.push(cube);
    const trunkMat = mat(CONFIG.materials.bark[1], { roughness: 0.94 });
    const leafMat = mat(CONFIG.materials.leaves[1], { roughness: CONFIG.materials.leafRoughness });
    const paleLeafMat = mat(CONFIG.materials.paleLeaves[1], { roughness: CONFIG.materials.leafRoughness });
    const stoneMat = mat("#566963");
    const grassMat = mat(CONFIG.materials.grass[1], { roughness: 0.92 });
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
    // Near-white albedo detail avoids multiplying two dark colors together.
    const groundTex = pixelTexture([238, 238, 238], 28); groundTex.repeat.set(16, 50);
    const groundMat = mat(CONFIG.materials.moss, { map: groundTex });
    const groundGeometry = new THREE.PlaneGeometry(100, 220); geometries.push(groundGeometry);
    const ground = new THREE.Mesh(groundGeometry, groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.025, -65); scene.add(ground);
    ground.receiveShadow = true;

    const pathTex = pixelTexture([230, 230, 230], 40); pathTex.repeat.set(1, 34);
    const pathMat = mat(CONFIG.materials.path, { map: pathTex, roughness: 0.96 });
    // Surface detail uses its own seed, so tree placement and all later geometry stay identical.
    const barkCanvas = document.createElement("canvas"); barkCanvas.width = barkCanvas.height = 64;
    const barkContext = barkCanvas.getContext("2d")!, barkRandom = randomGenerator(9041);
    barkContext.fillStyle = "#f7f7f7"; barkContext.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 110; i++) {
      const shade = Math.round(185 + barkRandom() * 60);
      barkContext.fillStyle = `rgb(${shade},${shade},${shade})`;
      barkContext.fillRect(Math.floor(barkRandom() * 64), Math.floor(barkRandom() * 64), 1 + Math.floor(barkRandom() * 2), 3 + Math.floor(barkRandom() * 15));
    }
    const barkTexture = new THREE.CanvasTexture(barkCanvas); barkTexture.colorSpace = THREE.SRGBColorSpace;
    barkTexture.magFilter = THREE.NearestFilter; textures.push(barkTexture); trunkMat.map = barkTexture;
    const pathPositions: number[] = [], pathUVs: number[] = [], pathIndices: number[] = [];
    for (let i = 0; i <= 210; i++) {
      const z = 24 - i;
      const w = 1.7 + Math.sin(i * .7) * .13;
      pathPositions.push(pathX(z) - w, 0, z, pathX(z) + w, 0, z);
      pathUVs.push(0, i / 210, 1, i / 210);
      if (i < 210) { const a = i * 2; pathIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const pathGeo = new THREE.BufferGeometry(); pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(pathPositions, 3)); pathGeo.setAttribute("uv", new THREE.Float32BufferAttribute(pathUVs, 2)); pathGeo.setIndex(pathIndices); pathGeo.computeVertexNormals(); geometries.push(pathGeo);
    const trail = new THREE.Mesh(pathGeo, pathMat); trail.receiveShadow = true; scene.add(trail);

    type Block = { x: number; y: number; z: number; w: number; h: number; d: number; r?: number };
    const trunks: Block[] = [], leaves: Block[] = [], paleLeaves: Block[] = [], grasses: Block[] = [], rocks: Block[] = [];
    function instances(blocks: Block[], material: THREE.MeshStandardMaterial, foliage = false, palette?: string[]) {
      // Subsample the same seeded layout without shifting trunks, landmarks, or the trail.
      if (foliage) blocks = blocks.filter((_, i) => Math.floor((i + 1) * quality.foliageDensity) > Math.floor(i * quality.foliageDensity));
      const inst = new THREE.InstancedMesh(cube, material, blocks.length);
      inst.castShadow = quality.shadows && material !== grassMat; inst.receiveShadow = quality.shadows;
      const obj = new THREE.Object3D();
      const colorRandom = randomGenerator(5183), instanceColor = new THREE.Color();
      const low = new THREE.Color(palette?.[0]), high = new THREE.Color(palette?.[1]);
      blocks.forEach((b, i) => {
        obj.position.set(b.x, b.y, b.z); obj.scale.set(b.w, b.h, b.d); obj.rotation.set(0, b.r || 0, 0); obj.updateMatrix(); inst.setMatrixAt(i, obj.matrix);
        if (palette) {
          instanceColor.copy(low).lerp(high, colorRandom());
          // Instance colors multiply the material in linear space; normalize to its base tint.
          instanceColor.r /= material.color.r; instanceColor.g /= material.color.g; instanceColor.b /= material.color.b;
          inst.setColorAt(i, instanceColor);
        }
      });
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
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
      for (let b = 0; b < 3; b++) {
        const bark = { x: x + w * .45, y: 1 + rnd() * h, z, w: .12, h: .3 + rnd() * .8, d: w * 1.06 };
        if (quality.lod === 0) trunks.push(bark);
      }
      for (let tier = 0; tier < 5; tier++) {
        const size = 5.6 - tier * .77 + rnd() * .7;
        const block = { x: x + (rnd() - .5) * .9, y: h * .59 + tier * 1.2, z, w: size, h: 1.4 + rnd() * .5, d: size * (.7 + rnd() * .3) };
        // LOD1 keeps three broad canopy tiers and omits bark protrusions/side branches.
        if (quality.lod === 0 || tier % 2 === 0) {
          if (quality.lod === 1) block.h *= 1.5;
          (tier % 3 === 0 ? paleLeaves : leaves).push(block);
        }
      }
      if (rnd() > .45 && quality.lod === 0) trunks.push({ x: x + side * 1.1, y: h * .6, z, w: 2.6, h: .35, d: .4 });
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
    instances(trunks, trunkMat, false, CONFIG.materials.bark); instances(leaves, leafMat, true, CONFIG.materials.leaves); instances(paleLeaves, paleLeafMat, true, CONFIG.materials.paleLeaves); instances(grasses, grassMat, true, CONFIG.materials.grass); instances(rocks, stoneMat);

    const hemi = new THREE.HemisphereLight(look.hemisphere.sky, look.hemisphere.ground, look.hemisphere.intensity); scene.add(hemi);
    const moonLight = new THREE.DirectionalLight(look.main.color, look.main.intensity);
    const fill = new THREE.DirectionalLight(look.fill.color, look.fill.intensity);
    fill.position.set(24, 16, 18); scene.add(fill);
    moonLight.castShadow = quality.shadows;
    moonLight.shadow.mapSize.set(quality.moonShadowSize, quality.moonShadowSize);
    moonLight.shadow.autoUpdate = false;
    moonLight.shadow.bias = -0.0002; moonLight.shadow.normalBias = 0.06;
    scene.add(moonLight, moonLight.target);
    // Fit the light-space bounds to the nearby path and its canopy, not all 220m.
    const shadowCamera = moonLight.shadow.camera, lightSpace = new THREE.Vector3();
    function fitMoonShadow(z: number) {
      const x = pathX(z - 12), centerZ = z - 12;
      moonLight.target.position.set(x, 0, centerZ);
      const [lightX, lightY, lightZ] = look.main.offset;
      moonLight.position.set(x + lightX, lightY, centerZ + lightZ);
      shadowCamera.position.copy(moonLight.position);
      shadowCamera.lookAt(moonLight.target.position); shadowCamera.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let near = Infinity, far = -Infinity;
      for (const dx of [-10, 10]) for (const y of [-0.1, 21]) for (const dz of [-22, 22]) {
        lightSpace.set(x + dx, y, centerZ + dz).applyMatrix4(shadowCamera.matrixWorldInverse);
        minX = Math.min(minX, lightSpace.x); maxX = Math.max(maxX, lightSpace.x);
        minY = Math.min(minY, lightSpace.y); maxY = Math.max(maxY, lightSpace.y);
        near = Math.min(near, -lightSpace.z); far = Math.max(far, -lightSpace.z);
      }
      shadowCamera.left = minX - 1; shadowCamera.right = maxX + 1;
      shadowCamera.bottom = minY - 1; shadowCamera.top = maxY + 1;
      shadowCamera.near = Math.max(0.1, near - 2); shadowCamera.far = far + 2;
      shadowCamera.updateProjectionMatrix();
    }
    // Also initialize the light direction on tiers that render without shadow maps.
    fitMoonShadow(camera.position.z);
    const directionalTorch = timeOfDay === "night";
    const torchIntensity = directionalTorch ? CONFIG.lights.torchBeam.intensity : CONFIG.lights.torch.intensity;
    // The unseen held torch follows the view with a broad, feathered pool of light.
    const torch = directionalTorch
      ? new THREE.SpotLight(CONFIG.lights.torchBeam.color, torchIntensity, CONFIG.lights.torch.distance, CONFIG.lights.torchBeam.angle, CONFIG.lights.torchBeam.penumbra, CONFIG.lights.torch.decay)
      : new THREE.PointLight(CONFIG.lights.torch.color, torchIntensity, CONFIG.lights.torch.distance, CONFIG.lights.torch.decay);
    torch.position.set(0.32, -0.55, -0.6); torch.castShadow = quality.shadows;
    torch.shadow.mapSize.set(quality.torchShadowSize, quality.torchShadowSize);
    torch.shadow.camera.near = 0.1; torch.shadow.camera.far = CONFIG.lights.torch.distance;
    torch.shadow.bias = -0.0005; torch.shadow.normalBias = 0.025;
    if (torch instanceof THREE.SpotLight) {
      torch.target.position.set(...CONFIG.lights.torchBeam.target);
      // Both nodes inherit the existing camera look/movement; no extra camera controls.
      camera.add(torch.target);
    }
    camera.add(torch); scene.add(camera);
    // Continuous seeded value noise, interpolated between fixed knots; never random per frame.
    function flickerNoise(time: number) {
      const knot = Math.floor(time), t = time - knot, smooth = t * t * (3 - 2 * t);
      const value = (n: number) => randomGenerator(7319 ^ Math.imul(n, 374761393))() * 2 - 1;
      return THREE.MathUtils.lerp(value(knot), value(knot + 1), smooth);
    }

    // Four low, feathered mist sheets with seamless seeded multi-scale canvas noise.
    const mistCanvas = document.createElement("canvas"); mistCanvas.width = mistCanvas.height = 128;
    const mistContext = mistCanvas.getContext("2d")!;
    const mistPixels = mistContext.createImageData(128, 128), mistRandom = randomGenerator(5821);
    const fields = [4, 8, 16].map(size => ({ size, values: Array.from({ length: size * size }, () => mistRandom()) }));
    const smoothNoise = (u: number, v: number) => fields.reduce((sum, field, octave) => {
      const x = u * field.size, y = v * field.size, ix = Math.floor(x), iy = Math.floor(y);
      const tx = x - ix, ty = y - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (dx: number, dy: number) => field.values[((iy + dy) % field.size) * field.size + (ix + dx) % field.size];
      return sum + THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0, 0), at(1, 0), sx), THREE.MathUtils.lerp(at(0, 1), at(1, 1), sx), sy) / 2 ** (octave + 1);
    }, 0);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, u = x / 128, v = y / 128;
      // A separate stationary alpha mask feathers the geometry's perimeter as UVs drift.
      mistPixels.data.set([255, 255, 255, Math.round(smoothNoise(u, v) ** 2 * 255)], i);
    }
    mistContext.putImageData(mistPixels, 0, 0);
    const mistSource = new THREE.CanvasTexture(mistCanvas);
    mistSource.colorSpace = THREE.SRGBColorSpace;
    mistSource.wrapS = mistSource.wrapT = THREE.RepeatWrapping; textures.push(mistSource);
    const edgeCanvas = document.createElement("canvas"); edgeCanvas.width = edgeCanvas.height = 128;
    const edgeContext = edgeCanvas.getContext("2d")!, edgePixels = edgeContext.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const edge = Math.min(1, Math.min(x, y, 127 - x, 127 - y) / 22);
      const alpha = Math.round(edge * edge * (3 - 2 * edge) * 255);
      edgePixels.data.set([alpha, alpha, alpha, 255], (y * 128 + x) * 4);
    }
    edgeContext.putImageData(edgePixels, 0, 0);
    const mistEdge = new THREE.CanvasTexture(edgeCanvas); textures.push(mistEdge);
    const mistGeo = new THREE.PlaneGeometry(34, 64); geometries.push(mistGeo);
    const mistLayers = Array.from({ length: 4 }, (_, i) => {
      const texture = mistSource.clone(); texture.repeat.set(2, 3); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ color: look.mist.color, map: texture, alphaMap: mistEdge,
        transparent: true, opacity: look.mist.opacity, depthWrite: false, side: THREE.DoubleSide });
      materials.push(material);
      const mesh = new THREE.Mesh(mistGeo, material); mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((i % 2 ? 1 : -1) * 2, 0.18 + i * 0.13, 8 - i * 48);
      scene.add(mesh); return texture;
    });

    // Four feathered light sheets; existing trees, path and landmarks are untouched.
    if (CONFIG.shafts.enabled && look.shafts.opacity > 0) {
      const shaftGeometry = new THREE.PlaneGeometry(3.2, 26); geometries.push(shaftGeometry);
      const shaftMaterial = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(look.shafts.color) }, opacity: { value: look.shafts.opacity } },
        vertexShader,
        fragmentShader: `
          uniform vec3 color;
          uniform float opacity;
          varying vec2 vUv;
          void main() {
            float crossFade = pow(max(0.0, sin(vUv.x * 3.14159265)), 2.0);
            float endFade = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
            gl_FragColor = vec4(color, opacity * crossFade * endFade);
          }
        `,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      materials.push(shaftMaterial);
      for (let i = 0; i < CONFIG.shafts.count; i++) {
        const z = 1 - i * 37, shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.position.set(pathX(z) - 2, 10, z); shaft.rotation.set(0, -0.25, -0.78); scene.add(shaft);
      }
    }

    // A square moon and sparse stars, kept distant so the trail remains the focus.
    const moonMat = new THREE.MeshBasicMaterial({ color: "#9fb8ff", fog: false, transparent: true, opacity: timeOfDay === "night" ? 0 : 1 }); materials.push(moonMat);
    const moonGeo = new THREE.PlaneGeometry(2.6, 2.6); geometries.push(moonGeo);
    const moon = new THREE.Mesh(moonGeo, moonMat); moon.position.set(10, 21, -75); scene.add(moon);
    const starGeo = new THREE.BufferGeometry(); const starPositions = [];
    for (let i = 0; i < 85; i++) starPositions.push((rnd() - .5) * 150, 22 + rnd() * 35, -35 - rnd() * 100);
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3)); geometries.push(starGeo);
    const starMat = new THREE.PointsMaterial({ color: "#b7c9bd", size: .075, fog: false, transparent: true, opacity: timeOfDay === "night" ? 0 : 1 }); materials.push(starMat); scene.add(new THREE.Points(starGeo, starMat));

    function block(group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
      const mesh = new THREE.Mesh(cube, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = quality.shadows; mesh.receiveShadow = quality.shadows; group.add(mesh); return mesh;
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
      const beacon = new THREE.PointLight(CONFIG.lights.beacon.color, CONFIG.lights.beacon.intensity, CONFIG.lights.beacon.distance, CONFIG.lights.beacon.decay); beacon.position.set(x, 1.6, stop.z); scene.add(beacon); beacons.push(beacon);
      const crystal = block(group, crystalMat, index === 3 ? -.7 : .8, .7, .25, .13, .38, .13); crystal.rotation.z = -.16;
      group.userData.stop = stop.id; interactables.push(group);
      markerPositions.push(new THREE.Vector3(x, index === 3 ? 2.6 : 2.5, stop.z));
    });

    // Fireflies are a single draw call, rather than a light for every particle.
    const flyCount = CONFIG.fireflies.count; const flyGeo = new THREE.BufferGeometry(); const flyBase = new Float32Array(flyCount * 3); const flyPos = new Float32Array(flyCount * 3);
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
      const scale = CONFIG.pixelate.enabled ? (width < CONFIG.pixelate.mobileBreakpoint ? CONFIG.pixelate.mobileScale : CONFIG.pixelate.desktopScale) : 1;
      const renderWidth = Math.max(1, Math.ceil(width / scale)), renderHeight = Math.max(1, Math.ceil(height / scale));
      renderer.setSize(renderWidth, renderHeight, false);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
      renderer.setPixelRatio(pixelRatio);
      if (usePostProcessing) { composer.setPixelRatio(pixelRatio); composer.setSize(renderWidth, renderHeight); }
      camera.aspect = width / height; camera.updateProjectionMatrix();
      stops.forEach((stop, i) => {
        const x = pathX(stop.z) + stop.side * (width < 640 ? 1.5 : 2.5);
        artifacts[i].position.x = x; markerPositions[i].x = x; beacons[i].position.x = x;
      });
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let previousTime = 0, elapsed = 0, lastMoonZ = Infinity;
    let statsStart = performance.now(), statsFrames = 0, peakCalls = 0;
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
      torch.intensity = torchIntensity * (1 + CONFIG.lights.torch.flicker * (0.7 * flickerNoise(elapsed * 3) + 0.3 * flickerNoise(elapsed * 7 + 41)));
      // The moon and trees are static: reuse the shadow until the camera moves 2m.
      if (quality.shadows && Math.abs(z - lastMoonZ) >= 2) {
        fitMoonShadow(z); moonLight.shadow.needsUpdate = true; lastMoonZ = z;
      }
      mistLayers.forEach((texture, i) => texture.offset.set(elapsed * (0.003 + i * 0.0004), elapsed * 0.0015));
      moon.position.z = z - 78;
      if (moving) {
        for (let i = 0; i < flyCount; i++) { flyPos[i * 3] = flyBase[i * 3] + Math.sin(elapsed * .36 + i) * .45; flyPos[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(elapsed * .7 + i * 2) * .22; }
        flyGeo.attributes.position.needsUpdate = true;
      }
      grainPass.uniforms.time.value = elapsed;
      // Disabling the source pass bypasses post-processing rather than displaying stale buffers.
      renderer.info.reset();
      if (usePostProcessing) composer.render(delta);
      else renderer.render(scene, camera);
      statsFrames++; peakCalls = Math.max(peakCalls, renderer.info.render.calls);
      if (time - statsStart >= 1000) {
        const stats = {
          quality: qualityName, lod: quality.lod, pixelRatio: renderer.getPixelRatio(),
          calls: renderer.info.render.calls, peakCalls, triangles: renderer.info.render.triangles,
          fps: Math.round(statsFrames * 10000 / (time - statsStart)) / 10,
        };
        console.info("[forest performance]", stats);
        statsStart = time; statsFrames = 0; peakCalls = 0;
      }
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
    const onVisibility = () => { if (document.hidden) renderer.setAnimationLoop(null); else { previousTime = statsStart = performance.now(); statsFrames = 0; renderer.setAnimationLoop(animate); } };
    document.addEventListener("visibilitychange", onVisibility);
    renderer.setAnimationLoop(animate); onReady(true);
    return () => {
      disposed = true; scene.environment = null; scene.background = null;
      renderer.setAnimationLoop(null); observer.disconnect();
      window.removeEventListener("pointermove", onPointer); document.removeEventListener("pointerleave", onLeave); document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerup", onClick);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      moonLight.shadow.dispose(); torch.shadow.dispose();
      passes.forEach(pass => pass.dispose()); composer.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [controls, onReady, markerRoot]);

  return <div ref={host} className="forest-canvas" role="img" aria-label="A moonlit pixel forest with green trees and a winding brown trail. A warm torch illuminates the nearby path as you scroll forward." />;
}
