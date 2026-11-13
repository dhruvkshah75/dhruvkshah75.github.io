import * as THREE from './assets/three.module.js';
import { animate } from './assets/anime.esm.min.js';

const canvas = document.querySelector('#hero-cubes');
const gap = document.querySelector('#home-transition');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (canvas && gap && !reducedMotion.matches) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
    const count = 560;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const dummy = new THREE.Object3D();
    const shards = [];
    const colors = [0x365b55, 0x6faca6, 0x8ab8bc, 0xb1d1c6];
    const playhead = { value: 0 };
    const motion = animate(playhead, { value: 1, duration: 1000, ease: 'inOutCubic', autoplay: false });
    const clamp = value => Math.max(0, Math.min(1, value));
    const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
    let width = 0, height = 0, lastProgress = -1;

    function sampleText() {
      const bitmap = document.createElement('canvas');
      bitmap.width = width; bitmap.height = height;
      const context = bitmap.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#000';
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      for (const selector of ['.hero-copy h1', '.hero-copy .eyebrow', '.hero-heading', '.hero-description']) {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const lines = element.innerText.split('\n').filter(Boolean);
        const lineHeight = rect.height / Math.max(1, lines.length);
        lines.forEach((line, index) => context.fillText(line.trim(), rect.left + rect.width / 2, rect.top + lineHeight * (index + .5)));
      }
      const pixels = context.getImageData(0, 0, width, height).data;
      const points = [];
      const step = width < 700 ? 6 : 8;
      for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
        if (pixels[(y * width + x) * 4 + 3] > 70) points.push({ x, y });
      }
      return points;
    }

    function resize() {
      width = innerWidth; height = innerHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(width, height, false);
      camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = height;
      camera.near = -1000; camera.far = 1000; camera.position.z = 100;
      camera.updateProjectionMatrix();
      const points = sampleText();
      shards.length = 0;
      for (let i = 0; i < count; i++) {
        const seed = (i * 0.61803398875) % 1;
        const source = points[Math.floor(seed * points.length)] || { x: width / 2, y: height / 2 };
        const column = i % 28, row = Math.floor(i / 28);
        const targetX = (column + .5) / 28 * width;
        const targetY = (row + .5) / 20 * height;
        const angle = i * 2.399963;
        shards.push({
          x: source.x, y: source.y,
          breakX: source.x + Math.cos(angle) * (32 + seed * 90),
          breakY: source.y + Math.sin(angle) * (32 + seed * 90),
          targetX, targetY, angle, seed
        });
        mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
      }
      mesh.instanceColor.needsUpdate = true;
      lastProgress = -1;
      update();
    }

    function update() {
      const rect = gap.getBoundingClientRect();
      const progress = clamp((height - rect.top) / Math.max(1, rect.height));
      if (Math.abs(progress - lastProgress) < .001) return;
      lastProgress = progress;
      if (progress <= .01 || progress >= .99) { canvas.style.opacity = '0'; return; }
      motion.seek(progress * 1000);
      const time = playhead.value;
      const breakPhase = ease(time / .44);
      const assemblePhase = ease((time - .27) / .73);
      const sourceScale = 1 - clamp(progress / .6) * .55;
      const visibility = ease(time / .14) * (1 - ease((time - .8) / .2));
      canvas.style.opacity = String(visibility * .85);
      material.opacity = .88;
      for (let i = 0; i < count; i++) {
        const shard = shards[i];
        const sourceX = width / 2 + (shard.x - width / 2) * sourceScale;
        const sourceY = height / 2 + (shard.y - height / 2) * sourceScale;
        const brokenX = sourceX + (shard.breakX - shard.x) * breakPhase;
        const brokenY = sourceY + (shard.breakY - shard.y) * breakPhase;
        const x = brokenX + (shard.targetX - brokenX) * assemblePhase;
        const y = brokenY + (shard.targetY - brokenY) * assemblePhase;
        const size = (width < 700 ? 5 : 7) + assemblePhase * (width < 700 ? 7 : 8);
        dummy.position.set(x, y, Math.sin(shard.angle) * 24 * breakPhase * (1 - assemblePhase));
        dummy.rotation.set(shard.angle * breakPhase * (1 - assemblePhase), shard.seed * 3 * breakPhase * (1 - assemblePhase), 0);
        dummy.scale.set(size, size, size * .48);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    }

    addEventListener('resize', resize);
    addEventListener('scroll', update, { passive: true });
    document.fonts.ready.then(resize);
    resize();
  } catch (error) {
    canvas.style.display = 'none';
    console.warn('Hero cube transition unavailable:', error);
  }
}
