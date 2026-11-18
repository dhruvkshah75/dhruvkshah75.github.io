import * as THREE from './assets/three.module.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('#home');
const pointer = new THREE.Vector2(-10000, -10000);
window.addEventListener('pointermove',event=>{
  if(event.pointerType!=='touch')pointer.set(event.clientX,innerHeight-event.clientY);
},{passive:true});
window.addEventListener('pointerleave', () => pointer.set(-10000, -10000));
new IntersectionObserver(([entry]) => document.body.classList.toggle('at-home', entry.isIntersecting), {threshold:.1}).observe(hero);

// One transparent WebGL field draws small, individually breathing squares around the viewport.
try {
  const canvas = document.querySelector('#pixel-field');
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:false, powerPreference:'high-performance'});
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,10); camera.position.z=1;
  const uniforms = {uTime:{value:0}, uResolution:{value:new THREE.Vector2()}, uMouse:{value:pointer}, uDpr:{value:1}, uHome:{value:1}, uProject:{value:0}, uContact:{value:0}, uFill:{value:0}, uStack:{value:0}, uSection:{value:0}, uCell:{value:15}, uHeroFlight:{value:0}, uHeroArrival:{value:0}};
  const material = new THREE.ShaderMaterial({transparent:true, depthWrite:false, uniforms,
    vertexShader:`
      attribute float seed;
      uniform float uTime; uniform vec2 uResolution; uniform vec2 uMouse; uniform float uDpr; uniform float uHome; uniform float uProject; uniform float uContact; uniform float uFill; uniform float uSection; uniform float uStack; uniform float uCell; uniform float uHeroFlight; uniform float uHeroArrival;
      varying float vAlpha; varying float vSeed; varying float vCursor;
      void main(){
        vec2 px=(position.xy*.5+.5)*uResolution;
        float edge=min(min(px.x,uResolution.x-px.x),min(px.y,uResolution.y-px.y));
        float variation=22.0*sin(px.x*.009+px.y*.013) + 36.0*sin(px.x*.018-px.y*.011);
        float contour=85.0 + 58.0*uHome + variation;
        contour=mix(contour,contour*.55,uProject)+70.0*uStack;
        float mobile=1.0-smoothstep(380.0,700.0,uResolution.x);
        contour=mix(contour,min(contour,50.0),mobile);
        // Let Contact's border reach inward while keeping a clear center on narrow screens.
        float contactDepth=clamp(min(uResolution.x,uResolution.y)*.24,82.0,228.0);
        contour=mix(contour,contactDepth+variation*.45,uContact);
        contour=mix(contour,max(uResolution.x,uResolution.y)*.8,uFill);
        float feather=mix(mix(90.0,48.0,uProject),108.0,uContact);
        float band=1.0-smoothstep(contour*.45,contour+mix(feather,45.0,mobile),edge);
        float activeEdge=smoothstep(contour*.35,contour+20.0,edge);
        float twinkle=mix(.5+.5*sin(uTime*1.9+seed*12.0+px.x*.025+px.y*.018),.5,uSection);
        float nearMouse=1.0-smoothstep(20.0,145.0,distance(px,uMouse));
        float density=smoothstep(.04,.36,seed+band*.65);
        vAlpha=band*density*(.29+activeEdge*twinkle*.25+nearMouse*.44);
        vAlpha*=1.-smoothstep(.12,.48,uHeroFlight);
        float arrivalCell=smoothstep(seed*.55,seed*.55+.45,uHeroArrival);
        vAlpha=mix(vAlpha,.18+seed*.16+nearMouse*.38,max(uSection,arrivalCell));
        vAlpha+=uStack*(band*.17+nearMouse*.28);
        vAlpha=max(vAlpha,nearMouse*.56);
        vCursor=nearMouse;
        vSeed=seed;
        gl_PointSize=uCell*uDpr*mix(mix(1.01,.65+twinkle*.46,activeEdge)*(1.0+nearMouse*.08),1.01,uSection);
        gl_Position=vec4(position,1.0);
      }`,
    fragmentShader:`varying float vAlpha; varying float vSeed; varying float vCursor;
      void main(){
        vec3 sea=vec3(.35,.65,.65);vec3 sky=vec3(.48,.69,.76);vec3 sage=vec3(.59,.75,.66);
        vec3 color=mix(mix(sea,sky,step(.48,vSeed)),sage,step(.76,vSeed));
        color=mix(color,vec3(.19,.61,.70),vCursor*.65);
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
  resize();renderer.render(scene,camera);document.documentElement.classList.add('has-field');window.addEventListener('resize',resize);
  const style=document.documentElement.style;
  const setting=name=>Number.parseFloat(style.getPropertyValue(name))||0;
  let lastPaint=0,dirty=true;
  const invalidate=()=>{dirty=true};
  window.addEventListener('resize',invalidate);
  window.addEventListener('scroll',invalidate,{passive:true});
  reduceMotion.addEventListener('change',invalidate);
  canvas.addEventListener('webglcontextlost',()=>document.documentElement.classList.remove('has-field'));
  canvas.addEventListener('webglcontextrestored',()=>{dirty=true;document.documentElement.classList.add('has-field')});
  renderer.setAnimationLoop(now=>{
    if(document.hidden||document.querySelector('dialog[open]'))return;
    if(reduceMotion.matches?!dirty:now-lastPaint<32)return;
    dirty=false;lastPaint=now;
    uniforms.uHeroArrival.value=reduceMotion.matches?0:setting('--hero-pixel-arrival');
    uniforms.uHeroFlight.value=reduceMotion.matches?0:setting('--hero-pixel-flight');
    uniforms.uTime.value=reduceMotion.matches?0:now*.001;
    uniforms.uHome.value=document.body.classList.contains('at-home')?1:0;
    uniforms.uProject.value=setting('--project-presence');
    uniforms.uContact.value=setting('--contact-presence');
    uniforms.uStack.value=setting('--stack-presence');
    const section=setting('--section-grid');
    uniforms.uSection.value=reduceMotion.matches?section:THREE.MathUtils.lerp(uniforms.uSection.value,section,.16);
    uniforms.uFill.value=reduceMotion.matches?0:setting('--pixel-fill');
    renderer.render(scene,camera);
  });
}catch(error){console.warn('Pixel field unavailable:',error)}
