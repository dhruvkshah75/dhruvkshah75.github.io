import * as THREE from './assets/three.module.js';

const smooth = (low, high, value) => THREE.MathUtils.smoothstep(value, low, high);
const mix = THREE.MathUtils.lerp;
const metal = (color, metalness, roughness, map = null) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, map });

function paintedSurface(paint, size = 768) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size / 768, size / 768);
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawSubstrate(ctx) {
  ctx.fillStyle = '#225449';
  ctx.fillRect(0, 0, 768, 768);
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.translate(384, 384);
    ctx.rotate(side * Math.PI / 2);
    for (let i = 0; i < 38; i++) {
      const x = (i - 18.5) * 15;
      const bend = Math.sign(x) * (10 + Math.abs(x) * .14);
      const end = 324 + (i % 4) * 9;
      ctx.strokeStyle = i % 4 === 0 ? '#b7b579' : '#678f73';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x * .70, 165); ctx.lineTo(x * .70, 207 + i % 5 * 11);
      ctx.lineTo(x + bend, 258 + i % 5 * 11); ctx.lineTo(x + bend, end); ctx.stroke();
      ctx.fillStyle = '#dac99c';ctx.beginPath();ctx.arc(x + bend, end, 3, 0, Math.PI * 2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.strokeStyle = '#b9c5a4';ctx.lineWidth = 2;ctx.strokeRect(27, 27, 714, 714);
  ctx.font = '16px monospace';ctx.fillStyle = '#dce2c6';ctx.fillText('DS   /   REV 01', 62, 53);
}

function drawLid(ctx) {
  const satin = ctx.createLinearGradient(0, 0, 768, 640);
  satin.addColorStop(0, '#c1c9c5');satin.addColorStop(.48, '#e7ebe8');satin.addColorStop(1, '#a5afab');
  ctx.fillStyle = satin;ctx.fillRect(0, 0, 768, 768);
  for (let y = 0; y < 768; y += 2) {
    ctx.fillStyle = 'rgba(65,92,76,' + (.012 + .036 * (1 + Math.sin(y * 718.3)) / 2) + ')';
    ctx.fillRect(0, y, 768, 1);
  }
  ctx.fillStyle = '#344d44';
  ctx.font = '600 146px Arial,sans-serif';ctx.fillText('DS–01', 70, 408);
  ctx.font = '25px monospace';ctx.fillText('SYSTEM PROCESSOR', 78, 459);
  ctx.fillRect(78, 491, 595, 2);
  ctx.font = '19px monospace';ctx.fillText('DHRUV SHAH', 78, 542);
  for (let i = 0, x = 508; x < 674; i++) {
    const width = [3, 6, 2, 4, 2, 7, 3][i % 7];
    ctx.fillRect(x, 519, width, 24);x += width + 3;
  }
  // Pin-one triangle and coordinate marks are etched into the lid.
  ctx.beginPath();ctx.moveTo(55, 70);ctx.lineTo(82, 70);ctx.lineTo(55, 97);ctx.fill();
  ctx.strokeStyle = '#70867a';ctx.lineWidth = 2;
  for (const x of [85, 683]) for (const y of [138, 636]) {
    ctx.beginPath();ctx.moveTo(x - 8, y);ctx.lineTo(x + 8, y);ctx.moveTo(x, y - 8);ctx.lineTo(x, y + 8);ctx.stroke();
  }
}

function drawDie(ctx) {
  ctx.fillStyle = '#203535';ctx.fillRect(0, 0, 768, 768);
  const tones = ['#687e78', '#8ca79c', '#a8a695', '#5a7976', '#b1aa8e'];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
    const x = 19 + col * 184, y = 18 + row * 147;
    ctx.fillStyle = tones[(row * 3 + col) % tones.length];ctx.fillRect(x, y, 174, 135);
    ctx.fillStyle = '#213c39';
    for (let i = 8; i < 170; i += 10) ctx.fillRect(x + i, y + 5, 2, 124);
    for (let j = 12; j < 131; j += 23) ctx.fillRect(x + 3, y + j, 168, 2);
  }
}

// Chamfered packages use separate face and edge materials. UVs follow the machined face.
function plate(parent, width, depth, thickness, bevel, materials) {
  const shape = new THREE.Shape();
  const x = width / 2, y = depth / 2, c = Math.min(width, depth) * .07;
  const outline = [[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]];
  outline.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {depth:thickness,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / width + .5, pos.getY(i) / depth + .5);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, materials);
  parent.add(mesh);
  return mesh;
}

function instances(parent, geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const object = new THREE.Object3D();
  transforms.forEach(([x,y,z,yaw = 0], index) => {
    object.position.set(x,y,z);object.rotation.y = yaw;object.updateMatrix();mesh.setMatrixAt(index, object.matrix);
  });
  parent.add(mesh);
}

function buildProcessor() {
  const assembly = new THREE.Group();
  const layers = Array.from({length:6}, () => { const layer = new THREE.Group();assembly.add(layer);return layer; });
  const [socket, substrate, interposer, die, thermal, lid] = layers;
  const graphite = metal(0x374d45,.48,.36);
  const nickel = metal(0xb2c1b6,.73,.26);
  const gold = metal(0xd3b575,.68,.33);
  const board = metal(0xffffff,.22,.50,paintedSurface(drawSubstrate));
  const green = metal(0x265a4a,.2,.48);
  const base = plate(socket,4.3,4.05,.17,.045,[graphite,graphite]);
  const rim = plate(socket,4.18,3.93,.065,.025,[nickel,nickel]);rim.position.y = .18;
  const seat = plate(socket,3.88,3.65,.11,.035,[graphite,graphite]);seat.position.y = .26;
  const pins = [];
  for (let i = -11; i <= 11; i++) for (const sign of [-1,1]) {
    pins.push([i*.15,.02,sign*2.07], [sign*2.18,.02,i*.146,Math.PI/2]);
  }
  instances(base,new THREE.BoxGeometry(.065,.10,.27),gold,pins);
  const screws = [];
  for (const x of [-1.88,1.88]) for (const z of [-1.77,1.77]) screws.push([x,.27,z]);
  instances(socket,new THREE.CylinderGeometry(.105,.10,.045,18),nickel,screws);
  instances(socket,new THREE.BoxGeometry(.14,.008,.022),graphite,screws.map(([x,y,z]) => [x,y+.025,z,.52]));
  // The exposed socket has a keyed recess and a field of individually angled contacts.
  const recess=plate(socket,3.18,2.92,.025,.025,[green,graphite]);recess.position.y=.38;
  const lands=[];
  for(let row=0;row<17;row++) for(let col=0;col<19;col++){
    if(row>4&&row<12&&col>5&&col<13)continue;
    lands.push([(col-9)*.15,.43,(row-8)*.157,.26]);
  }
  instances(socket,new THREE.BoxGeometry(.054,.035,.104),gold,lands);
  const latch=new THREE.Mesh(new THREE.CylinderGeometry(.044,.044,3.2,12),nickel);
  latch.rotation.x=Math.PI/2;latch.position.set(2.12,.37,0);socket.add(latch);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.135,.044,8,20,Math.PI),nickel);
  handle.rotation.x=Math.PI/2;handle.position.set(1.99,.37,1.60);socket.add(handle);
  // Rows of gold land pads are visible on the underside during the teardown.
  plate(substrate,3.82,3.52,.095,.017,[board,green]);
  instances(substrate,new THREE.BoxGeometry(.092,.009,.122),gold,lands.map(([x,,z])=>[x,-.018,z]));
  const contacts = [];
  for (let i = -9; i <= 9; i++) for (const sign of [-1,1]) {
    contacts.push([i*.159,-.036,sign*1.61],[sign*1.74,-.036,i*.145]);
  }
  instances(substrate,new THREE.SphereGeometry(.047,8,5),gold,contacts);
  const caps = [];
  for (let i = 0; i < 7; i++) for (const sign of [-1,1]) {
    caps.push([sign*1.57,.132,(i-3)*.24],[ (i-3)*.24,.132,sign*1.47,Math.PI/2]);
  }
  instances(substrate,new THREE.BoxGeometry(.23,.09,.105),nickel,caps);
  instances(substrate,new THREE.BoxGeometry(.124,.092,.108),graphite,caps);
  // The ceramic interposer carries finer traces and a dense array of microbumps.
  const interposerSurface = paintedSurface(ctx => {
    ctx.fillStyle = '#263f46';
    ctx.fillRect(0,0,768,768);
    for (let i=0;i<24;i++) {
      const x=30+i*30;
      ctx.strokeStyle=i%3===0?'#ccc092':'#637f77';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x,52);ctx.lineTo(x,148+i%5*15);
      ctx.lineTo(x+(i<12?25:-25),224+i%5*15);ctx.lineTo(x+(i<12?25:-25),692);ctx.stroke();
    }
    for (let row=0;row<12;row++) for(let col=0;col<13;col++) {
      ctx.fillStyle=(col+row)%4===0?'#e5c88a':'#a89c70';
      ctx.fillRect(108+col*46,112+row*49,10,9);
    }
  });
  const ceramic=metal(0x263b43,.25,.42);
  plate(interposer,2.88,2.58,.064,.012,[metal(0xffffff,.28,.42,interposerSurface),ceramic]);
  const microbumps=[];
  for(let i=-7;i<=7;i++) for(const sign of [-1,1]) microbumps.push([i*.155,.079,sign*1.04],[sign*1.16,.079,i*.14]);
  instances(interposer,new THREE.SphereGeometry(.037,8,5),gold,microbumps);
  plate(die,2.25,1.97,.08,.012,[gold,gold]);
  const silicon = plate(die,2.18,1.9,.085,.014,[metal(0xe4efe8,.41,.32,paintedSurface(drawDie)),graphite]);silicon.position.y = .08;
  const copper=metal(0xb98053,.71,.3);
  const groove=metal(0x8b6750,.53,.44);
  plate(thermal,2.32,2.09,.061,.012,[copper,copper]);
  const ribs=Array.from({length:18},(_,i)=>[(i-8.5)*.123,.069,0]);
  instances(thermal,new THREE.BoxGeometry(.032,.016,1.95),groove,ribs);
  plate(lid,3.04,2.82,.072,.045,[nickel,nickel]);
  const cap = plate(lid,2.89,2.67,.205,.085,[metal(0xffffff,.49,.37,paintedSurface(drawLid)),nickel]);
  cap.position.y = .075;
  return {assembly,layers};
}

export async function startProcessor() {
  const response = await fetch(new URL('./processor-motion.json',import.meta.url));
  if (!response.ok) throw new Error('Could not load processor keyframes');
  const {stages} = await response.json();
  const stack = document.getElementById('stack-chip'), sequence = document.getElementById('stack');
  const panel = sequence.querySelector('.stack-panel');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const display = document.createElement('div');display.className = 'chip-display';display.ariaHidden = 'true';
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setClearColor(0,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  display.append(renderer.domElement);
  stack.append(display);
  const scene = new THREE.Scene();
  const studio = paintedSurface(ctx => {
    ctx.fillStyle = '#8c9994';ctx.fillRect(0,0,768,768);ctx.fillStyle = '#eff5eb';ctx.fillRect(0,0,768,330);
    ctx.fillStyle = '#ffffff';ctx.fillRect(68,240,200,320);ctx.fillRect(500,230,100,280);
    ctx.fillStyle = '#344c43';ctx.fillRect(275,398,215,176);
  },256);
  studio.mapping = THREE.EquirectangularReflectionMapping;scene.environment = studio;scene.environmentIntensity = .8;
  scene.add(new THREE.HemisphereLight(0xfffdf1,0x728b7f,1.35));
  const light = new THREE.DirectionalLight(0xfffaea,2.0);light.position.set(-4,8,5);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);
  Object.assign(light.shadow.camera,{left:-6,right:6,top:7,bottom:-7,near:.1,far:26});
  light.shadow.normalBias=.012;light.shadow.bias=-.0003;scene.add(light);
  const camera = new THREE.OrthographicCamera(-4,4,3,-3,.1,65);
  const {assembly,layers} = buildProcessor();
  assembly.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true}});
  scene.add(assembly);
  const labels=['Socket','Package substrate','Ceramic interposer','Silicon die','Thermal interface','Heat spreader'].map(name=>{
    const label=document.createElement('span');
    label.className='chip-layer-label';
    label.textContent=name;
    display.append(label);
    return label;
  });
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,stages.at(-1).height[0],0),new THREE.Vector3(0,5.0,0)]),
    new THREE.LineDashedMaterial({color:0x537e6e,dashSize:.08,gapSize:.09,transparent:true,opacity:0})
  );
  axis.computeLineDistances();
  scene.add(axis);
  const anchor = new THREE.Vector3();
  const partWidths = [2.95,2.55,1.91,1.51,1.55,2.14];

  const shadowTexture = paintedSurface(ctx => {
    const wash=ctx.createRadialGradient(384,384,20,384,384,375);wash.addColorStop(0,'rgba(41,69,52,.41)');wash.addColorStop(.55,'rgba(57,82,63,.17)');wash.addColorStop(1,'rgba(71,87,72,0)');ctx.fillStyle=wash;ctx.fillRect(0,0,768,768);
  },128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8,6.3),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const orbit = new THREE.Spherical();
  const defaultYaw = -.55;
  const elevation = .435; // Keep the top surfaces visible throughout the horizontal orbit.
  let yaw=defaultYaw,goalYaw=defaultYaw;
  let frame=0,last=0,width=0,height=0,lost=false,layoutDirty=true,progress=0,targetProgress=0,visible=false;
  let touch;
  const angle = Math.PI * 2;
  const maxRadiansPerSecond = Math.PI * .58;
  stack.tabIndex=0;
  stack.setAttribute('aria-label','Processor model. Scroll to separate the layers. Move horizontally or use the Left and Right arrow keys to rotate.');
  stack.setAttribute('role','group');

  function measure() {
    const rect=stack.getBoundingClientRect(), bounds=sequence.getBoundingClientRect();
    visible=rect.bottom>0 && rect.top<innerHeight;
    const travel=sequence.offsetHeight-panel.offsetHeight;
    // Hold the intact package after it enters the viewport, then unpack it while pinned.
    targetProgress=reduced.matches?1:smooth(.16,.78,-bounds.top/Math.max(1,travel));
    if(!visible||reduced.matches)progress=targetProgress;
    const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false)}
    layoutDirty=false;
  }
  function draw(now) {
    frame=0;
    if(lost||document.hidden){display.hidden=true;return}
    const changed=layoutDirty;
    if(changed)measure();
    display.hidden=!visible;
    if(!visible||document.querySelector('dialog[open]'))return;
    if(changed||reduced.matches||now-last>=1000/32) {
      const dt=Math.min(80,now-last);last=now;
      progress=mix(progress,targetProgress,reduced.matches?1:1-Math.exp(-dt*.021));
      if(Math.abs(progress-targetProgress)<.002)progress=targetProgress;
      const span=Math.max(mix(5.2,13.15,progress),6.9*height/width);
      const showLabels=width>505 ? smooth(.76,1,progress) : 0;
      const shift=showLabels*.64;
      camera.left=-span*width/height/2+shift;camera.right=span*width/height/2+shift;
      camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
      const yawDelta=goalYaw-yaw;
      const maxStep=maxRadiansPerSecond*dt/1000;
      const step=yawDelta*(1-Math.exp(-dt*.008));
      yaw+=reduced.matches?yawDelta:THREE.MathUtils.clamp(step,-maxStep,maxStep);
      orbit.set(14,Math.PI/2-elevation,yaw);
      camera.position.setFromSpherical(orbit);
      camera.lookAt(0,0,0);
      const index=stages.findLastIndex(stage=>stage.at<=progress);
      const from=stages[index],to=stages[Math.min(index+1,stages.length-1)];
      const fraction=to===from?0:(progress-from.at)/(to.at-from.at);
      layers.forEach((layer,i)=>{layer.position.y=mix(from.height[i],to.height[i],fraction)});
      shadow.position.y=layers[0].position.y-.21;
      axis.visible=progress>.84;
      axis.material.opacity=smooth(.84,1,progress)*.45;
      for (const [i,label] of labels.entries()) {
        label.hidden=showLabels===0;
        if(label.hidden)continue;
        anchor.set(partWidths[i]*Math.cos(yaw),layers[i].position.y+.055,-partWidths[i]*Math.sin(yaw));
        anchor.project(camera);
        const edge=(anchor.x+1)*width/2;
        const labelLeft=width*.72;
        label.style.top=(1-anchor.y)*height/2+'px';
        label.style.setProperty('--leader-length',Math.max(12,labelLeft-edge-4)+'px');
        label.style.opacity=showLabels;
      }
      renderer.render(scene,camera);
      document.documentElement.classList.add('has-chip');
    }
    if(!reduced.matches&&(progress!==targetProgress||Math.abs(yaw-goalYaw)>.002))frame=requestAnimationFrame(draw);
  }
  function queueDraw(){if(!frame)frame=requestAnimationFrame(draw)}
  function invalidate(){layoutDirty=true;queueDraw()}
  stack.addEventListener('pointermove',event=>{
    if (event.pointerType==='touch') {
      if(!touch||touch.id!==event.pointerId)return;
      goalYaw=touch.yaw+(event.clientX-touch.x)*.013;
    } else {
      const rect=stack.getBoundingClientRect();
      goalYaw=defaultYaw+((event.clientX-rect.left)/rect.width-.5)*angle;
    }
    queueDraw();
  },{passive:true});
  stack.addEventListener('pointerleave',()=>{
    if(touch)return;
    goalYaw=defaultYaw;queueDraw();
  });
  stack.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'){
      touch={x:event.clientX,yaw:goalYaw,id:event.pointerId};
      stack.setPointerCapture(event.pointerId);
    }
  });
  for(const type of ['pointercancel','pointerup'])stack.addEventListener(type,()=>{touch=null});
  stack.addEventListener('keydown',event=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();
    goalYaw+=event.key==='ArrowLeft'?-.18:.18;
    queueDraw();
  });
  window.addEventListener('scroll',invalidate,{passive:true});window.addEventListener('resize',invalidate);
  reduced.addEventListener('change',invalidate);
  document.addEventListener('visibilitychange',invalidate);
  document.getElementById('project-dialog').addEventListener('close',invalidate);
  renderer.domElement.addEventListener('webglcontextlost',()=>{lost=true;display.hidden=true;document.documentElement.classList.remove('has-chip')});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;invalidate()});
  new ResizeObserver(invalidate).observe(stack);
  draw(performance.now());
}
