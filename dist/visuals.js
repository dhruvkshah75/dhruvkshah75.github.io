import * as THREE from './assets/three.module.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('#home');
const pointer = new THREE.Vector2(-10000, -10000);
window.addEventListener('pointermove', event => pointer.set(event.clientX, innerHeight - event.clientY), {passive:true});
window.addEventListener('pointerleave', () => pointer.set(-10000, -10000));
new IntersectionObserver(([entry]) => document.body.classList.toggle('at-home', entry.isIntersecting), {threshold:.1}).observe(hero);

// One transparent WebGL field draws small, individually breathing squares around the viewport.
try {
  const canvas = document.querySelector('#pixel-field');
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:false, powerPreference:'high-performance'});
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,10); camera.position.z=1;
  const uniforms = {uTime:{value:0}, uResolution:{value:new THREE.Vector2()}, uMouse:{value:pointer}, uDpr:{value:1}, uHome:{value:1}, uProject:{value:0}, uContact:{value:0}, uFill:{value:0}, uSection:{value:0}, uCell:{value:15}};
  const material = new THREE.ShaderMaterial({transparent:true, depthWrite:false, uniforms,
    vertexShader:`
      attribute float seed;
      uniform float uTime; uniform vec2 uResolution; uniform vec2 uMouse; uniform float uDpr; uniform float uHome; uniform float uProject; uniform float uContact; uniform float uFill; uniform float uSection; uniform float uCell;
      varying float vAlpha; varying float vSeed;
      void main(){
        vec2 px=(position.xy*.5+.5)*uResolution;
        float edge=min(min(px.x,uResolution.x-px.x),min(px.y,uResolution.y-px.y));
        float contour=85.0 + 58.0*uHome + 22.0*sin(px.x*.009+px.y*.013) + 36.0*sin(px.x*.018-px.y*.011);
        contour=mix(contour,contour*.55,max(uProject,uContact));
        float mobile=1.0-smoothstep(380.0,700.0,uResolution.x);
        contour=mix(contour,min(contour,50.0),mobile);
        contour=mix(contour,max(uResolution.x,uResolution.y)*.8,uFill);
        float band=1.0-smoothstep(contour*.45,contour+mix(mix(90.0,48.0,max(uProject,uContact)),45.0,mobile),edge);
        float activeEdge=smoothstep(contour*.35,contour+20.0,edge);
        float twinkle=mix(.5+.5*sin(uTime*1.9+seed*12.0+px.x*.025+px.y*.018),.5,uSection);
        float nearMouse=1.0-smoothstep(0.0,170.0,distance(px,uMouse));
        float density=smoothstep(.04,.36,seed+band*.65);
        vAlpha=band*density*(.29+activeEdge*twinkle*.25+nearMouse*.44);
        vAlpha=mix(vAlpha,.18+seed*.16+nearMouse*.38,uSection);
        vSeed=seed;
        gl_PointSize=uCell*uDpr*mix(mix(1.01,.65+twinkle*.46,activeEdge)*(1.0+nearMouse*.08),1.01,uSection);
        gl_Position=vec4(position,1.0);
      }`,
    fragmentShader:`varying float vAlpha; varying float vSeed;
      void main(){
        vec3 sea=vec3(.35,.65,.65);vec3 sky=vec3(.48,.69,.76);vec3 sage=vec3(.59,.75,.66);
        vec3 color=mix(mix(sea,sky,step(.48,vSeed)),sage,step(.76,vSeed));
        gl_FragColor=vec4(color,vAlpha);
      }`
  });
  let geometry, points;
  function resize(){
    const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio,1.5),cell=w<600?12:15;
    renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);uniforms.uResolution.value.set(w,h);uniforms.uDpr.value=dpr;uniforms.uCell.value=cell;
    const positions=[],seeds=[];
    for(let y=cell/2;y<h;y+=cell) for(let x=cell/2;x<w;x+=cell){
      positions.push(x/w*2-1,y/h*2-1,0);
      const gx=Math.floor(x/cell),gy=Math.floor(y/cell);
      const n=Math.sin((Math.floor(gx/3)+1)*127.1+(Math.floor(gy/3)+1)*311.7)*43758.5453;
      const local=Math.sin((gx+1)*42.7+(gy+1)*83.2)*15431.73;
      seeds.push((n-Math.floor(n))*.8+(local-Math.floor(local))*.2);
    }
    if(points){scene.remove(points);geometry.dispose()}
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
    points=new THREE.Points(geometry,material);scene.add(points);
  }
  resize();window.addEventListener('resize',resize);
  renderer.setAnimationLoop(now=>{uniforms.uTime.value=reduceMotion.matches?0:now*.001;uniforms.uHome.value=document.body.classList.contains('at-home')?1:0;uniforms.uProject.value=Number.parseFloat(document.documentElement.style.getPropertyValue('--project-presence'))||0;uniforms.uContact.value=Number.parseFloat(document.documentElement.style.getPropertyValue('--contact-presence'))||0;const sectionTarget=Number.parseFloat(document.documentElement.style.getPropertyValue('--section-grid'))||0;uniforms.uSection.value=reduceMotion.matches?sectionTarget:THREE.MathUtils.lerp(uniforms.uSection.value,sectionTarget,.08);uniforms.uFill.value=Math.max(reduceMotion.matches?0:Number.parseFloat(document.documentElement.style.getPropertyValue('--pixel-fill'))||0,uniforms.uSection.value);renderer.render(scene,camera)});
}catch(error){console.warn('Pixel field unavailable:',error)}

// A single shared WebGL renderer paints five small, distinct scenes into card canvases.
try {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setSize(600,480,false);renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-4,4,3.2,-3.2,.1,100);camera.position.set(6,5,8);camera.lookAt(0,0,0);
  const makeScene=()=>{const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xd8f8f4,3);light.position.set(2,6,7);scene.add(light);return scene};
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.12,...extra});
  const colors={light:mat(0x658e81),mint:mat(0x568b7b),blue:mat(0x689aa0),dark:mat(0x254541),ink:mat(0x142d2c),accent:mat(0x3f715f),metal:mat(0x80a99b)};
  function box(parent,x,y,z,w,h,d,material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);parent.add(o);return o}
  function sphere(parent,x,y,z,r,material){const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),material);o.position.set(x,y,z);parent.add(o);return o}
  function cylinder(parent,x,y,z,r,h,material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);o.position.set(x,y,z);parent.add(o);return o}
  function line(parent,points,color=0x91bdb0,opacity=.7){const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity}));parent.add(o);return o}
  const scenes=[], updates=[];
  // TaskFlow: packets enter a stepped, three-slot processing queue and leave at the far end.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    box(group,0,-.85,0,6.1,.18,1.6,colors.dark);
    box(group,0,-.73,0,5.7,.08,1.3,colors.metal);
    [-1.6,0,1.6].forEach(x=>{box(group,x,-.46,-.55,1.38,.5,.1,colors.dark);box(group,x,-.46,.55,1.38,.5,.1,colors.dark);box(group,x,-.15,-.55,1.38,.1,.1,colors.mint);});
    for(let x=-2;x<=2;x+=2){box(group,x,-.71,0,.045,.03,1.25,colors.light)}
    const packets=[];for(let i=0;i<4;i++){const p=box(group,0,-.28,0,.6,.5,.65,i===1?colors.blue:colors.light);box(p,0,.26,0,.38,.025,.43,colors.mint);packets.push(p)}
    const arrow=box(group,3.15,-.63,0,.45,.09,.07,colors.accent);arrow.rotation.y=0;
    scenes.push(scene);updates.push(t=>{packets.forEach((p,i)=>{p.position.x=((t*.48+i*1.55+3.1)%6.2)-3.1;p.position.y=-.26+Math.sin(t*2+i)*.045;p.rotation.y=Math.sin(t*.7+i)*.08})});
  }
  // oxidrop: a laptop sends a document to a phone, with progress feedback.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    box(group,-1.75,-.05,-.1,2.5,1.65,.16,colors.ink);
    box(group,-1.75,-.05,.005,2.25,1.4,.04,colors.blue);
    box(group,-1.75,.46,.04,2.05,.12,.03,colors.dark);
    box(group,-1.75,-.94,.35,2.8,.12,.95,colors.metal);
    for(let i=0;i<5;i++)for(let j=0;j<2;j++)box(group,-2.6+i*.43,-.86,.12+j*.25,.3,.02,.13,colors.dark);
    box(group,1.75,-.1,.05,1.1,2.05,.22,colors.ink);
    box(group,1.75,-.1,.18,.91,1.78,.03,colors.blue);
    box(group,1.75,.66,.2,.3,.04,.02,colors.dark);
    box(group,1.75,-.61,.21,.52,.08,.02,colors.light);
    line(group,[[-.45,-.05,.4],[.95,-.05,.4]],0x668d7f,.75);
    const file=new THREE.Group();group.add(file);
    box(file,0,0,.4,.47,.62,.055,colors.light);
    box(file,0,.1,.44,.27,.035,.02,colors.dark);box(file,0,-.03,.44,.27,.035,.02,colors.dark);box(file,-.04,-.16,.44,.19,.035,.02,colors.dark);
    const pulse=sphere(group,0,-.05,.43,.08,colors.accent);
    scenes.push(scene);updates.push(t=>{let phase=(t*.38)%1;file.position.x=-.95+phase*1.9;file.position.y=.1+Math.sin(phase*Math.PI)*.32;file.rotation.y=Math.sin(t)*.08;file.scale.setScalar(.85+Math.sin(phase*Math.PI)*.15);pulse.position.x=-.45+phase*1.4;pulse.scale.setScalar(.7+.3*Math.sin(phase*Math.PI))});
  }
  // gamesync: a softly floating controller with responsive-looking controls.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const shape=new THREE.Shape();shape.moveTo(-1.8,-.25);shape.bezierCurveTo(-2.05,.05,-1.9,.8,-1.35,.95);shape.lineTo(1.35,.95);shape.bezierCurveTo(1.9,.8,2.05,.05,1.8,-.25);shape.lineTo(1.5,-1.05);shape.bezierCurveTo(1.35,-1.4,.95,-1.35,.7,-1.02);shape.lineTo(.4,-.7);shape.lineTo(-.4,-.7);shape.lineTo(-.7,-1.02);shape.bezierCurveTo(-.95,-1.35,-1.35,-1.4,-1.5,-1.05);shape.closePath();
    const pad=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.12,bevelThickness:.12}),colors.light);group.add(pad);
    box(group,-1,.15,.52,.55,.14,.09,colors.dark);box(group,-1,.15,.53,.14,.55,.09,colors.dark);
    const buttons=[[.9,.36],[1.18,.1],[.9,-.16],[.62,.1]].map(([x,y],i)=>sphere(group,x,y,.56,.10,i===0?colors.mint:colors.dark));
    cylinder(group,-.35,-.35,.52,.18,.1,colors.dark).rotation.x=Math.PI/2;cylinder(group,.35,-.35,.52,.18,.1,colors.dark).rotation.x=Math.PI/2;
    scenes.push(scene);updates.push(t=>{group.rotation.y=Math.sin(t*1.1)*.22;group.rotation.x=Math.sin(t*.8)*.1;group.rotation.z=Math.sin(t*1.3)*.09;group.position.y=Math.sin(t*1.5)*.15;buttons.forEach((button,i)=>{button.position.z=.56-Math.max(0,Math.sin(t*2.7-i*1.7))*.09})});
  }
  // groundtruth: a layered network with multiple paths and traveling signals.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const nodes=[[-2.5,-1,0],[-2.5,0,0],[-2.5,1,0],[-.85,-1.3,0],[-.85,-.43,0],[-.85,.43,0],[-.85,1.3,0],[.85,-1.3,0],[.85,-.43,0],[.85,.43,0],[.85,1.3,0],[2.5,-.75,0],[2.5,.75,0]];
    const edges=[];
    for(let a=0;a<3;a++)for(let b=3;b<7;b++)if((a+b)%4!==0)edges.push([a,b]);
    for(let a=3;a<7;a++)for(let b=7;b<11;b++)if((a+b)%3!==0)edges.push([a,b]);
    for(let a=7;a<11;a++)for(let b=11;b<13;b++)edges.push([a,b]);
    edges.forEach(([a,b])=>line(group,[nodes[a],nodes[b]],0x4d8174,.45));
    const dots=nodes.map((p,i)=>sphere(group,...p,i>=11?.15:.10,i>=11?colors.accent:colors.mint));
    const pulses=edges.filter((_,i)=>i%3===0).map(()=>sphere(group,0,0,.08,.055,colors.dark));
    const targets=edges.filter((_,i)=>i%3===0);
    scenes.push(scene);updates.push(t=>{group.rotation.y=Math.sin(t*.5)*.13;dots.forEach((d,i)=>d.scale.setScalar(.9+.15*Math.sin(t*1.7+i)));pulses.forEach((p,i)=>{const [a,b]=targets[i];const phase=(t*.3+i*.13)%1;p.position.set(...nodes[a]).lerp(new THREE.Vector3(...nodes[b]),phase);p.position.z=.12})});
  }
  // cfast: a standalone terminal window with a typed command and response.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const tc=document.createElement('canvas');tc.width=640;tc.height=320;const cx=tc.getContext('2d');const texture=new THREE.CanvasTexture(tc);texture.colorSpace=THREE.SRGBColorSpace;
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(5.1,2.55),new THREE.MeshBasicMaterial({map:texture,transparent:true}));group.add(screen);group.quaternion.copy(camera.quaternion);
    const command='cfast run solution.cpp';
    scenes.push(scene);updates.push(t=>{
      const cycle=t%8;const typed=Math.min(command.length,Math.floor(cycle*7));
      cx.clearRect(0,0,640,320);cx.fillStyle='#202b4c';cx.beginPath();cx.roundRect(0,0,640,320,16);cx.fill();
      cx.fillStyle='#3d527e';cx.fillRect(0,0,640,45);cx.fillStyle='#b5c7ee';for(let i=0;i<3;i++){cx.beginPath();cx.arc(24+i*19,23,5,0,7);cx.fill()}
      cx.font='24px monospace';cx.fillStyle='#edf1ff';cx.fillText('$ '+command.slice(0,typed),32,105);
      if(cycle>3.5){cx.fillStyle='#b9c9e9';cx.fillText('compiling...',32,159)}
      if(cycle>4.4){cx.fillStyle='#f0ca82';cx.fillText('✓ samples passed',32,207)}
      if(Math.floor(cycle*2)%2===0){const cursorX=typed<command.length?32+cx.measureText('$ '+command.slice(0,typed)).width:32;const cursorY=typed<command.length?84:244;cx.fillStyle='#edf1ff';cx.fillRect(cursorX,cursorY,12,25)}
      texture.needsUpdate=true;
    });
  }
  // Give each illustration a distinct palette while keeping the page itself quiet.
  const palettes=[
    {light:0xf2b35f,mint:0xd9874b,blue:0xe7c383,dark:0x714b42,ink:0x3e3943,accent:0xe79b57,metal:0xb77e68},
    {light:0xf1bf74,mint:0x628bb9,blue:0x7da8d3,dark:0x395577,ink:0x263854,accent:0xe89b68,metal:0x8ba4be},
    {light:0xc590ad,mint:0xd8a66b,blue:0x86a0c9,dark:0x493d59,ink:0x342d45,accent:0xe0a35c,metal:0x9e89a3},
    {light:0xd39c7c,mint:0x7b7eb8,blue:0x8d9bd4,dark:0x393b78,ink:0x292d57,accent:0xe09662,metal:0xa1a3cb},
    {light:0xc7c9e9,mint:0x8e9dcd,blue:0x7f97c7,dark:0x394b71,ink:0x202b4c,accent:0xe4ba71,metal:0x8092b7}
  ];
  scenes.forEach((scene,index)=>{
    const materials=new Map();
    Object.entries(colors).forEach(([key,original])=>{const copy=original.clone();copy.color.setHex(palettes[index][key]);materials.set(original,copy)});
    scene.traverse(object=>{
      if(object.isMesh && materials.has(object.material))object.material=materials.get(object.material);
      if(object.isLine){object.material=object.material.clone();object.material.color.setHex(index===3?0x7373b6:0x8c93a6);object.material.opacity=.72}
    });
  });
  const cameras=scenes.map((_,index)=>{const view=camera.clone();view.zoom=index===3?1.55:1.35;view.updateProjectionMatrix();return view});
  const canvases=[...document.querySelectorAll('.project-canvas')];
  let last=0, renderedStatic=false;
  renderer.setAnimationLoop(now=>{
    if(document.hidden)return;
    if(reduceMotion.matches && renderedStatic)return;
    if(now-last<40)return;last=now;
    const time=reduceMotion.matches?0:now*.001;
    canvases.forEach((canvas,index)=>{
      const rect=canvas.getBoundingClientRect();
      if(!reduceMotion.matches && (rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth))return;
      updates[index](time);renderer.render(scenes[index],cameras[index]);
      const context=canvas.getContext('2d');context.clearRect(0,0,600,480);context.drawImage(renderer.domElement,0,0);
    });
    if(reduceMotion.matches)renderedStatic=true;
  });
  reduceMotion.addEventListener('change',()=>{renderedStatic=false});
}catch(error){console.warn('Project illustrations unavailable:',error)}
