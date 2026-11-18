import * as THREE from './assets/three.module.js';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// A single shared WebGL renderer paints five small, distinct scenes into card canvases.
export function startProjectIllustrations() {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setSize(800,600,false);renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);camera.position.set(6,5,8);camera.lookAt(0,0,0);
  const makeScene=()=>{const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xd8f8f4,3);light.position.set(2,6,7);scene.add(light);return scene};
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.12,...extra});
  const colors={light:mat(0x658e81),mint:mat(0x568b7b),blue:mat(0x689aa0),dark:mat(0x254541),ink:mat(0x142d2c),accent:mat(0x3f715f),metal:mat(0x80a99b)};
  function box(parent,x,y,z,w,h,d,material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);parent.add(o);return o}
  function label(parent,text,x,y,z,size) {
    const ink=document.createElement('canvas');ink.width=256;ink.height=64;
    const ctx=ink.getContext('2d');ctx.fillStyle='#ece8d8';ctx.fillRect(0,0,256,64);
    ctx.fillStyle='#37443c';ctx.font='bold 36px monospace';ctx.textAlign='center';ctx.fillText(text,128,46);
    const texture=new THREE.CanvasTexture(ink);texture.colorSpace=THREE.SRGBColorSpace;
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(size,size/4),new THREE.MeshBasicMaterial({map:texture}));
    plate.position.set(x,y,z);parent.add(plate);
  }
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
    // Rollers, optical gates, service feet, and station lamps read as one machine.
    for(let i=0;i<16;i++)cylinder(group,-2.55+i*.34,-.57,0,.105,1.02,colors.metal).rotation.x=Math.PI/2;
    const lamps=[];
    for(const [i,x] of [-1.65,0,1.65].entries()){
      for(const z of [-.67,.67])box(group,x,.02,z,.12,1.13,.13,colors.dark);
      box(group,x,.61,0,.25,.16,1.49,colors.mint);
      lamps.push(sphere(group,x,.71,.45,.105,colors.accent));
      label(group,'W0'+(i+1),x,-.51,.61,.75);
    }
    for(const x of [-2.28,2.28])for(const z of [-.56,.56])box(group,x,-1,z,.29,.33,.31,colors.dark);
    scenes.push(scene);updates.push(t=>{
      packets.forEach((p,i)=>{
        p.position.x=((t*.74+i*1.55)%6.2)-3.1;
        const end=Math.min(1,Math.min(p.position.x+3.1,3.1-p.position.x)*3);
        p.scale.setScalar(Math.max(.025,end));p.position.y=-.19;
      });
      lamps.forEach((lamp,i)=>lamp.scale.setScalar(.82+.30*Math.max(0,Math.sin(t*2.95-i*2))));
      group.rotation.y=.07*Math.sin(t*.45);
    });
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
    for(let i=0;i<4;i++){
      box(group,-2.40,.19-i*.19,.05,.12,.12,.025,colors.light);
      box(group,-1.77,.19-i*.19,.05,.81-i*.08,.045,.035,colors.metal);
    }
    const track=box(group,1.73,-.35,.215,.67,.055,.023,colors.dark);
    const fill=box(group,1.73,-.35,.234,.65,.052,.016,colors.light);
    const hinge=cylinder(group,-1.75,-.80,.04,.07,2.23,colors.dark);hinge.rotation.z=Math.PI/2;
    const route=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.60,-.18,.38),new THREE.Vector3(.19,1.12,.83),new THREE.Vector3(1.33,-.03,.36));
    line(group,route.getPoints(28).map(v=>v.toArray()),0x627c8b,.48);
    scenes.push(scene);updates.push(t=>{
      const phase=(t*.25)%1,progress=THREE.MathUtils.smoothstep(phase,.12,.88);
      route.getPointAt(progress,file.position);file.rotation.y=Math.sin(progress*Math.PI)*.48;
      file.scale.setScalar(.40+.58*Math.sin(progress*Math.PI));
      fill.scale.x=Math.max(.015,progress);fill.position.x=track.position.x-.325*(1-progress);
      group.rotation.y=-.12+.055*Math.sin(t*.5);
    });
  }
  // gamesync: a softly floating controller with responsive-looking controls.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const shape=new THREE.Shape();shape.moveTo(-1.8,-.25);shape.bezierCurveTo(-2.05,.05,-1.9,.8,-1.35,.95);shape.lineTo(1.35,.95);shape.bezierCurveTo(1.9,.8,2.05,.05,1.8,-.25);shape.lineTo(1.5,-1.05);shape.bezierCurveTo(1.35,-1.4,.95,-1.35,.7,-1.02);shape.lineTo(.4,-.7);shape.lineTo(-.4,-.7);shape.lineTo(-.7,-1.02);shape.bezierCurveTo(-.95,-1.35,-1.35,-1.4,-1.5,-1.05);shape.closePath();
    const pad=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.12,bevelThickness:.12}),colors.light);group.add(pad);
    box(group,-1,.15,.52,.55,.14,.09,colors.dark);box(group,-1,.15,.53,.14,.55,.09,colors.dark);
    const buttons=[[.9,.36],[1.18,.1],[.9,-.16],[.62,.1]].map(([x,y],i)=>sphere(group,x,y,.56,.10,i===0?colors.mint:colors.dark));
    cylinder(group,-.35,-.35,.52,.18,.1,colors.dark).rotation.x=Math.PI/2;cylinder(group,.35,-.35,.52,.18,.1,colors.dark).rotation.x=Math.PI/2;
    // Add face seams, thumb caps, shoulder triggers and the pairing indicators.
    for(const x of [-1.17,1.17])box(group,x,.96,.13,.69,.18,.29,colors.dark);
    for(const x of [-.35,.35]){
      const cap=cylinder(group,x,-.35,.61,.145,.09,colors.ink);cap.rotation.x=Math.PI/2;
    }
    for(let i=0;i<4;i++)box(group,-.18+i*.12,.57,.48,.069,.036,.04,i===0?colors.accent:colors.dark);
    for(const x of [-.17,.17])box(group,x,.19,.49,.17,.08,.06,colors.dark);
    scenes.push(scene);updates.push(t=>{group.rotation.y=Math.sin(t*1.1)*.22;group.rotation.x=Math.sin(t*.8)*.1;group.rotation.z=Math.sin(t*1.3)*.09;group.position.y=Math.sin(t*1.5)*.15;buttons.forEach((button,i)=>{button.position.z=.56-Math.max(0,Math.sin(t*2.7-i*1.7))*.09})});
  }
  // groundtruth: a layered network with multiple paths and traveling signals.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const nodes=[[-2.5,-1,0],[-2.5,0,0],[-2.5,1,0],[-.85,-1.3,0],[-.85,-.43,0],[-.85,.43,0],[-.85,1.3,0],[.85,-1.3,0],[.85,-.43,0],[.85,.43,0],[.85,1.3,0],[2.5,-.75,0],[2.5,.75,0]];
    nodes.forEach((p,i)=>{p[2]=Math.sin(i*1.8)*.64});
    const nodeVectors=nodes.map(p=>new THREE.Vector3(...p));
    const edges=[];
    for(let a=0;a<3;a++)for(let b=3;b<7;b++)if((a+b)%4!==0)edges.push([a,b]);
    for(let a=3;a<7;a++)for(let b=7;b<11;b++)if((a+b)%3!==0)edges.push([a,b]);
    for(let a=7;a<11;a++)for(let b=11;b<13;b++)edges.push([a,b]);
    edges.forEach(([a,b])=>line(group,[nodes[a],nodes[b]],0x4d8174,.45));
    const dots=nodes.map((p,i)=>sphere(group,...p,i>=11?.20:.145,i>=11?colors.accent:colors.mint));
    const pulses=edges.filter((_,i)=>i%3===0).map(()=>sphere(group,0,0,.08,.055,colors.dark));
    const targets=edges.filter((_,i)=>i%3===0);
    scenes.push(scene);updates.push(t=>{group.rotation.y=Math.sin(t*.5)*.13;dots.forEach((d,i)=>d.scale.setScalar(.9+.15*Math.sin(t*1.7+i)));pulses.forEach((p,i)=>{const [a,b]=targets[i];const phase=(t*.3+i*.13)%1;p.position.lerpVectors(nodeVectors[a],nodeVectors[b],phase);p.position.z+=.035})});
  }
  // cfast: a standalone terminal window with a typed command and response.
  {
    const scene=makeScene(), group=new THREE.Group();scene.add(group);
    const tc=document.createElement('canvas');tc.width=640;tc.height=320;const cx=tc.getContext('2d');const texture=new THREE.CanvasTexture(tc);texture.colorSpace=THREE.SRGBColorSpace;
    box(group,0,0,-.17,4.96,2.67,.31,colors.ink);
    box(group,0,-1.51,-.17,.62,.39,.22,colors.dark);box(group,0,-1.74,0,1.75,.13,.76,colors.metal);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(4.76,2.38),new THREE.MeshBasicMaterial({map:texture}));
    screen.position.z=.003;group.add(screen);group.rotation.y=.35;group.rotation.x=-.04;
    const command='cfast 1032D';
    scenes.push(scene);updates.push(t=>{
      const cycle=t%8;const typed=Math.min(command.length,Math.floor(cycle*7));
      cx.clearRect(0,0,640,320);cx.fillStyle='#202b4c';cx.beginPath();cx.roundRect(0,0,640,320,16);cx.fill();
      cx.fillStyle='#3d527e';cx.fillRect(0,0,640,45);cx.fillStyle='#b5c7ee';for(let i=0;i<3;i++){cx.beginPath();cx.arc(24+i*19,23,5,0,7);cx.fill()}
      cx.font='24px monospace';cx.fillStyle='#edf1ff';cx.fillText('$ '+command.slice(0,typed),32,105);
      if(cycle>3.5){cx.fillStyle='#b9c9e9';cx.fillText('compiling...',32,159)}
      if(cycle>4.4){cx.fillStyle='#bce4b3';cx.fillText('sample 1   PASSED',32,207)}
      if(cycle>5.4){cx.fillText('sample 2   PASSED',32,250)}
      group.rotation.y=.36+Math.sin(t*.45)*.12;
      if(Math.floor(cycle*2)%2===0){const cursorX=typed<command.length?32+cx.measureText('$ '+command.slice(0,typed)).width:32;const cursorY=typed<command.length?84:270;cx.fillStyle='#edf1ff';cx.fillRect(cursorX,cursorY,12,25)}
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
  const cameras=scenes.map((_,index)=>{
    const view=camera.clone();
    view.zoom=[1.34,1.23,1.30,1.30,1.21][index];view.updateProjectionMatrix();return view;
  });
  const canvases=[...document.querySelectorAll('.project-canvas')], modal=document.querySelector('#dialog-canvas');
  const visible=new Set(), staticFrames=new Set();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const i=canvases.indexOf(entry.target);
      if(entry.isIntersecting)visible.add(i);else visible.delete(i);
    }
    schedule();
  });
  let opened=null,frame=0,last=0;
  function paint(index,canvas,now) {
    updates[index](reduceMotion.matches?5.6:now*.001);
    renderer.render(scenes[index],cameras[index]);
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
    staticFrames.add(canvas);
  }
  function tick(now) {
    frame=0;
    if(document.hidden)return;
    if(now-last>=32||reduceMotion.matches){
      last=now;
      if(opened!==null)paint(opened,modal,now);
      else for(const i of visible){
        if(!reduceMotion.matches||!staticFrames.has(canvases[i]))paint(i,canvases[i],now);
      }
    }
    if(!reduceMotion.matches&&(opened!==null||visible.size))schedule();
  }
  function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick)}
  canvases.forEach(canvas=>observer.observe(canvas));
  reduceMotion.addEventListener('change',()=>{staticFrames.clear();schedule()});
  document.addEventListener('visibilitychange',schedule);
  return {
    show(index){opened=index;paint(index,modal,performance.now());schedule()},
    hide(){opened=null;schedule()}
  };
}
