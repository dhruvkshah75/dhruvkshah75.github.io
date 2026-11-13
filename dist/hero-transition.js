import * as THREE from './assets/three.module.js';
import { animate, getInstances } from './assets/anime-three.esm.js';

const canvas = document.querySelector('#hero-cubes');
const gap = document.querySelector('#home-transition');
const copy = document.querySelector('.hero-copy');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (canvas && gap && copy && !reducedMotion.matches) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, .5, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x607080, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4);
    keyLight.position.set(-400, 700, 1000); scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xb6d6ed, 2.5);
    rimLight.position.set(600, -100, -200); scene.add(rimLight);
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // Real lit cube surfaces, retaining glyph fragments only at the moment of release.
    const material = new THREE.MeshStandardMaterial({
      color: 0x30353b, roughness: .36, metalness: .16,
      transparent: true, depthWrite: true,
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.glyphs = { value: texture };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `
        #include <common>
        attribute vec4 tile; attribute float released; attribute float flightAlpha;
        varying vec2 glyphUV; varying float birth; varying float frontFace; varying float travelAlpha;
      `).replace('#include <begin_vertex>', `
        #include <begin_vertex>
        glyphUV=tile.xy+uv*tile.zw; birth=released; frontFace=step(.9,normal.z); travelAlpha=flightAlpha;
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        #include <common>
        uniform sampler2D glyphs;
        varying vec2 glyphUV; varying float birth; varying float frontFace; varying float travelAlpha;
      `).replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 glyph=texture2D(glyphs,glyphUV);
        float solid=smoothstep(.04,.20,birth);
        diffuseColor.rgb=mix(glyph.rgb,diffuseColor.rgb,solid);
        diffuseColor.a*=mix(glyph.a*frontFace,1.,solid)*smoothstep(0.,.055,birth)*travelAlpha;
        if(diffuseColor.a<.005) discard;
      `);
    };
    let mesh, instances, motion, shards = [], patches = [];
    let cameraDistance = 0;
    let width = 0, height = 0, cell = 0, bounds;
    let progress = location.hash && location.hash !== '#home' ? 1 : 0;
    let target = progress, frame = 0, previousTime = 0;
    let arrivalReleased = false, arrivalReadyAt = 0, touchY = null;
    let previousScroll = scrollY, lastHash = location.hash;
    let navigationDestination = null, navigationUntil = 0, navigationSection = null;
    let navigationSkip = Boolean(lastHash && lastHash !== '#home');
    const arrivalOffset = () => Math.min(48, innerHeight * .065);
    const arrivalAnchor = () => scrollY + gap.getBoundingClientRect().bottom - innerHeight - arrivalOffset();
    const clamp = x => Math.max(0, Math.min(1, x));
    const random = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

    function sampleText() {
      bounds = copy.getBoundingClientRect();
      const bitmap = document.createElement('canvas');
      bitmap.width = Math.ceil(bounds.width); bitmap.height = Math.ceil(bounds.height);
      const context = bitmap.getContext('2d', { willReadFrequently: true });
      context.textBaseline = 'alphabetic';
      // Measure each rendered character rather than guessing line breaks or kerning.
      const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const style = getComputedStyle(node.parentElement);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.fillStyle = style.color;
        for (let i = 0; i < node.length; i++) {
          const char = node.data[i];
          if (!char.trim()) continue;
          range.setStart(node, i); range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect();
          const metrics = context.measureText(char);
          const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
          const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
          context.fillText(char, rect.left - bounds.left,
            rect.top - bounds.top + (rect.height - ascent - descent) / 2 + ascent);
        }
      }
      texture.image = bitmap;
      texture.needsUpdate = true;
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const collect = size => {
        const points = [];
        for (let y = 0; y < bitmap.height; y += size) for (let x = 0; x < bitmap.width; x += size) {
          let occupied = false;
          for (let dy = 0; dy < size && !occupied; dy++) for (let dx = 0; dx < size; dx++) {
            if (x + dx < bitmap.width && y + dy < bitmap.height && pixels[((y + dy) * bitmap.width + x + dx) * 4 + 3] > 40) { occupied = true; break; }
          }
          if (occupied) points.push({ x, y });
        }
        return points;
      };
      let points = collect(cell);
      const budget = Math.max(1, Math.floor(points.length * .30));
      // Keep every glyph covered while merging small fragments into larger cubes.
      while (points.length > budget) { cell += 2; points = collect(cell); }
      // Keep fragment size unchanged while thinning the existing cube population.
      const allPoints = points;
      const previousCount = Math.max(1, Math.floor(allPoints.length * 2 / 3));
      const count = Math.max(1, Math.floor(previousCount * 2 / 3));
      points = Array.from({ length: count },
        (_, i) => allPoints[Math.floor(i * allPoints.length / count)]);
      return { points, allPoints, bitmap };
    }

    function resize() {
      width = innerWidth; height = innerHeight; cell = width < 700 ? 6 : 8;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = 48;
      cameraDistance = height / (2 * Math.tan(THREE.MathUtils.degToRad(24)));
      camera.position.set(width / 2, height * .5, cameraDistance);
      camera.rotation.set(0, 0, 0);
      camera.updateProjectionMatrix();
      const { points, allPoints, bitmap } = sampleText();
      const heroTop = document.querySelector('.hero').getBoundingClientRect().top;
      motion?.cancel();
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      mesh = new THREE.InstancedMesh(geometry, material, points.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      instances = getInstances(mesh);
      const tiles = new Float32Array(points.length * 4);
      const release = new Float32Array(points.length);
      shards = points.map((point, i) => {
        const x = bounds.left + point.x + cell / 2;
        const y = bounds.top - heroTop + point.y + cell / 2;
        // A staggered volume around an open camera corridor, never a shared sink.
        const angle = i * 2.399963 + (random(i + 201) - .5) * .3;
        const cohort = i % 3;
        const depth = cohort === 0 ? -1800 - random(i + 202) * 1600
          : cohort === 1 ? -450 - random(i + 202) * 1300
          : 200 - random(i + 202) * 650;
        const spread = cohort === 0 ? .16 + random(i + 203) * .32
          : .55 + random(i + 203) * .55;
        const radius = (cameraDistance - depth) * Math.tan(THREE.MathUtils.degToRad(24))
          * spread;
        const shard = {
          ...point, sourceX: x, sourceY: y, delay: random(i + 77) * 500,
          burstX: width / 2 + Math.cos(angle) * radius * Math.min(camera.aspect, 1.7),
          burstY: height / 2 + Math.sin(angle) * radius,
          burstZ: depth,
        };
        const instance = instances[i];
        instance.x = x; instance.y = height - y; instance.z = 0;
        instance.scaleX = instance.scaleY = cell; instance.scaleZ = .05;
        instance.rotateX = instance.rotateY = instance.rotateZ = 0;
        tiles.set([point.x / bitmap.width, 1 - (point.y + cell) / bitmap.height, cell / bitmap.width, cell / bitmap.height], i * 4);
        return shard;
      });
      patches = allPoints.map(point => {
        let nearest = shards[0], distance = Infinity;
        for (const shard of shards) {
          const d = (shard.x - point.x) ** 2 + (shard.y - point.y) ** 2;
          if (d < distance) { nearest = shard; distance = d; }
        }
        return { ...point, delay: nearest.delay };
      });
      geometry.setAttribute('tile', new THREE.InstancedBufferAttribute(tiles, 4));
      geometry.setAttribute('flightAlpha', new THREE.InstancedBufferAttribute(new Float32Array(points.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('released', new THREE.InstancedBufferAttribute(release, 1).setUsage(THREE.DynamicDrawUsage));
      // Fracture outward into a deep volume, then drift onward as the camera passes.
      motion = animate(instances, {
        keyframes: [
          { x: (_, i) => shards[i].burstX, y: (_, i) => height - shards[i].burstY,
            z: (_, i) => shards[i].burstZ,
            rotateX: (_, i) => 30 + random(i + 4) * 27,
            rotateY: (_, i) => -28 - random(i + 5) * 30,
            rotateZ: (_, i) => (random(i + 6) - .5) * 35,
            scaleX: (_, i) => cell * 1.08 * Math.max(.8, (cameraDistance - shards[i].burstZ) / cameraDistance),
            scaleY: (_, i) => cell * 1.08 * Math.max(.8, (cameraDistance - shards[i].burstZ) / cameraDistance),
            scaleZ: (_, i) => cell * 1.08 * Math.max(.8, (cameraDistance - shards[i].burstZ) / cameraDistance),
            duration: 1250, ease: 'outCubic' },
          { x: (_, i) => width / 2 + (shards[i].burstX - width / 2) * 1.12,
            y: (_, i) => height / 2 + (height / 2 - shards[i].burstY) * 1.12,
            z: (_, i) => shards[i].burstZ - 1100,
            rotateX: (_, i) => 38 + random(i + 4) * 28,
            rotateY: (_, i) => -42 - random(i + 5) * 32,
            duration: 2250, ease: 'linear' },
        ],
        delay: (_, i) => shards[i].delay,
        autoplay: false,
      });
      // Cache the first camera crossing. Further forward acceleration must never
      // make an already-passed cube pop back into view.
      for (const shard of shards) {
        shard.passedAt = 1.1;
        for (let step = 1; step <= 240; step++) {
          const p = step / 240;
          const state = travelState(p, shard);
          if (state.age > 0 && state.distance < 100) { shard.passedAt = p; break; }
        }
      }
      update();
    }

    function cameraDepth(p) {
      // One forward acceleration curve: the viewer overtakes the slower cubes.
      const flight = clamp((p - .18) / .68);
      return cameraDistance - flight * flight * (cameraDistance + 5200);
    }

    function travelState(p, shard) {
      const time = clamp((p - .015) / .91) * motion.duration;
      const age = Math.max(0, time - shard.delay);
      const scatter = 1 - (1 - clamp(age / 1250)) ** 3;
      const drift = clamp((age - 1250) / 2250);
      const cubeZ = shard.burstZ * scatter - drift * 1100;
      const cameraZ = cameraDepth(p);
      return { age, distance: cameraZ - cubeZ };
    }

    function draw(now) {
      frame = 0;
      const dt = Math.min(64, previousTime ? now - previousTime : 16);
      previousTime = now;
      const catchup = (target - progress) * (1 - Math.exp(-dt / 440));
      // Even a large wheel gesture gets a continuous, readable flight.
      progress += Math.sign(catchup) * Math.min(Math.abs(catchup), dt / 3200);
      if (Math.abs(target - progress) < .0001) progress = target;
      const time = clamp((progress - .015) / .91) * motion.duration;
      motion.seek(time);
      copy.style.opacity = reducedMotion.matches ? '1' : String(1 - smooth((time - 530) / 90));
      const root = document.documentElement.style;
      const cameraZ = cameraDepth(progress);
      const alpha = geometry.getAttribute('flightAlpha');
      for (let i = 0; i < shards.length; i++) {
        const state = travelState(progress, shards[i]);
        alpha.array[i] = smooth((state.distance - 100) / 240)
          * clamp((shards[i].passedAt - progress) / .06)
          * (1 - smooth((state.distance - 4400) / 2400))
          * (1 - smooth((progress - .84) / .09));
      }
      alpha.needsUpdate = true;
      const aboutRect = document.querySelector('#about').getBoundingClientRect();
      root.setProperty('--hero-pixel-flight', String(aboutRect.top > 0 ? progress : 0));
      root.setProperty('--hero-pixel-arrival', String(aboutRect.top > 0 ? smooth((progress - .64) / .28) : 0));
      // The About content is fully revealed by .91. Release the scroll gate at
      // that point instead of waiting for the easing tail to approach 1.
      if (progress >= .91 && !arrivalReadyAt) arrivalReadyAt = performance.now();
      if (progress < .4) { arrivalReadyAt = 0; arrivalReleased = false; }
      canvas.style.opacity = !reducedMotion.matches && progress > 0 && progress < .94 ? '1' : '0';
      document.dispatchEvent(new CustomEvent('hero-transition-progress', { detail: progress }));
      const release = geometry.getAttribute('released');
      const cutouts = [];
      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        const age = Math.max(0, time - shard.delay);
        release.array[i] = age / 1250;
      }
      for (const patch of patches) {
        const removed = smooth(Math.max(0, time - patch.delay) / 65);
        if (removed > 0 && time < 620) cutouts.push(`<rect x="${patch.x}" y="${patch.y}" width="${cell + .4}" height="${cell + .4}" fill="black" opacity="${removed.toFixed(3)}"/>`);
      }
      release.needsUpdate = true;
      // Erase only the exact patch whose cube has detached; no whole-text crossfade.
      if (progress === 0 || time >= 620 || reducedMotion.matches) copy.style.maskImage = 'none';
      else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}"><rect width="100%" height="100%" fill="white"/>${cutouts.join('')}</svg>`;
        copy.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        copy.style.maskMode = 'luminance';
      }
      camera.position.z = cameraZ;
      camera.position.y = height * .5;
      camera.fov = 48;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      if (progress !== target) frame = requestAnimationFrame(draw);
      else previousTime = 0;
    }
    function update() {
      if (!motion) return;
      if(navigationDestination!==null){
        if(Math.abs(scrollY-navigationDestination)<2||performance.now()>navigationUntil){
          navigationDestination=null;
        }else{
          progress=target=navigationSection==='home'?0:1;
          previousScroll=scrollY;
          if(!frame)frame=requestAnimationFrame(draw);
          return;
        }
      }
      if (location.hash !== lastHash) {
        lastHash = location.hash;
        navigationSkip = Boolean(lastHash && lastHash !== '#home');
      }
      const anchor = arrivalAnchor();
      const crossedArrival = previousScroll <= anchor + 2 && scrollY > anchor + 2;
      if (crossedArrival && !reducedMotion.matches && !arrivalReleased && !navigationSkip) {
        if (arrivalReadyAt) arrivalReleased = true;
        else window.scrollTo({ top: anchor, behavior: 'instant' });
      }
      previousScroll = scrollY;
      if (scrollY < innerHeight * .1 && (!location.hash || location.hash === '#home')) navigationSkip = false;
      const rect = gap.getBoundingClientRect();
      target = reducedMotion.matches ? 0 : clamp((height - rect.top) / Math.max(1, rect.height - arrivalOffset()));
      if (document.querySelector('#about').getBoundingClientRect().bottom <= 0) progress = target;
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function protectArrival(event, delta) {
      if (reducedMotion.matches || arrivalReleased || navigationSkip || delta <= 0 || event.ctrlKey || document.querySelector('dialog[open]')) return;
      if (arrivalReadyAt) {
        arrivalReleased = true;
        return;
      }
      const anchor = arrivalAnchor();
      if (scrollY <= anchor + 2 && scrollY + delta >= anchor) {
        event.preventDefault();
        window.scrollTo({ top: anchor, behavior: 'instant' });
        update();
      }
    }
    document.addEventListener('portfolio:navigate',event=>{
      navigationSection=event.detail.section;
      navigationDestination=event.detail.top;
      navigationUntil=performance.now()+1500;
      navigationSkip=navigationSection!=='home';
      arrivalReleased=navigationSkip;
      arrivalReadyAt=navigationSkip?performance.now():0;
      lastHash=location.hash;
      progress=target=navigationSkip?1:0;
      if(!frame)frame=requestAnimationFrame(draw);
    });
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href^="#"]');
      if (link && link.hash !== '#home') navigationSkip = true;
    });
    addEventListener('keydown', event => {
      if (event.key === 'End' || event.key === 'Home') navigationSkip = true;
    });
    addEventListener('wheel', event => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      protectArrival(event, event.deltaY * unit);
    }, { passive: false });
    addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY ?? null; }, { passive: true });
    addEventListener('touchmove', event => {
      const y = event.touches[0]?.clientY;
      if (touchY !== null && y !== undefined) protectArrival(event, touchY - y);
      touchY = y ?? null;
    }, { passive: false });
    addEventListener('resize', resize);
    addEventListener('scroll', update, { passive: true });
    reducedMotion.addEventListener('change', update);
    document.fonts.ready.then(resize);
  } catch (error) {
    canvas.style.display = 'none';
    copy.style.maskImage = 'none';
    console.warn('Hero cube transition unavailable:', error);
  }
}
