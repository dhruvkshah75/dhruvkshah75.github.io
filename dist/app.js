import * as THREE from './assets/three.module.js';
import { showProjectBackground, hideProjectBackground } from './project-background.js';

const projects = [
  {name:'taskflow',category:'SYSTEMS',tags:['systems','distributed-systems','job-scheduler','task queue'],description:'Distributed background task processing, built for scalable asynchronous workloads.',stack:'Python · Docker · Kubernetes · FastAPI',github:'https://github.com/dhruvkshah75/TaskFlow',live:'https://taskflow-io.vercel.app'},
  {name:'oxidrop',category:'TOOLS',tags:['tools','file sharing','file server','self-hosted'],description:'Fast wireless file sync between Linux and mobile devices.',stack:'Rust · WebDAV',github:'https://github.com/dhruvkshah75/oxidrop'},
  {name:'gamesync',category:'GAMES · IN PROGRESS',tags:['websockets','2d-game','concurrency'],description:'A real-time multiplayer game server for state synchronisation and concurrent player communication.',stack:'Go · Sockets',github:'https://github.com/dhruvkshah75/gamesync'},
  {name:'groundtruth',category:'AI',tags:['AI','ai-agents','knowledge-graph','belief-revision'],description:'An AI agent that checks beliefs against reality, detects conflicts, and reasons across perspectives.',stack:'Python · SQLite · NetworkX',github:'https://github.com/dhruvkshah75/groundtruth'},
  {name:'cfast',category:'TOOLS',tags:['cli','test-runner','competitve-companion'],description:'Import Codeforces samples, compile C++ solutions, and check outputs, time, and memory.',stack:'Python · CLI',github:'https://github.com/dhruvkshah75/cfast',live:'https://cfast.vercel.app'}
];
const stage = document.querySelector('#project-stage');
const section = document.querySelector('#projects');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector('#project-dialog');

let current = 0;
let lastFocus;
projects.forEach((project,index)=>{
  const card = document.createElement('button');
  card.type='button'; card.className='project-card'; card.dataset.project=project.name.toLowerCase();
  card.setAttribute('aria-label',`Open ${project.name} project details`);
  card.innerHTML=`<span class="card-content">${project.tags ? '' : `<span class="card-top">${project.category}</span>`}<span class="card-title">${project.name}</span>${project.tags ? `<span class="project-tags">${project.tags.map(tag=>`<span>${tag}</span>`).join('')}</span>` : ''}<span class="card-description">${project.description}</span><span class="project-visual project-visual-${index}" aria-hidden="true"><canvas class="project-canvas" width="600" height="480"></canvas></span></span>`;
  card.addEventListener('click',()=>openProject(index));
  stage.append(card);
});
const cards=[...document.querySelectorAll('.project-card')];
let heroCubeProgress = null;
document.addEventListener('hero-transition-progress', event => {
  heroCubeProgress = event.detail;
  updateProjects();
});
function updateProjects(){
  const aboutElement=document.querySelector('#about');
  aboutElement.style.setProperty('--about-pin-top', `${Math.min(0,innerHeight-aboutElement.offsetHeight)}px`);
  const about=document.querySelector('#about').getBoundingClientRect();
  const experienceElement=document.querySelector('#experience');
  experienceElement.style.setProperty('--experience-pin-top', `${Math.min(0,innerHeight-experienceElement.offsetHeight)}px`);
  const experience=experienceElement.getBoundingClientRect();
  const contact=document.querySelector('#contact').getBoundingClientRect();
  const homeGap=document.querySelector('#home-transition').getBoundingClientRect();
  const projectGap=document.querySelector('#project-transition').getBoundingClientRect();
  const rect=section.getBoundingClientRect();
  const vh=window.innerHeight;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const visibility=bounds=>clamp((vh-bounds.top)/(vh*.85))*clamp(bounds.bottom/(vh*.85));
  const projectPresence=visibility(rect);
  // Hold the full grid while a section occupies the screen, then ease it out
  // over the entire departure instead of switching to the edge texture midway.
  const smooth=value=>{const x=clamp(value);return x*x*(3-2*x)};
  const gridPresence=(bounds,departure=.65)=>smooth((vh-bounds.top)/(vh*.65))*smooth(bounds.bottom/(vh*departure));
  const homeArrival=reducedMotion.matches||heroCubeProgress===null?1:smooth((heroCubeProgress-.76)/.15);
  const sectionGrid=Math.max(gridPresence(about)*homeArrival,gridPresence(experience,.75));
  // First clear the current screen, then draw the pixel front inward across a dedicated gap.
  const transition=(bounds,fillStart=.25,clock=null)=>{
    if(bounds.top>vh || bounds.bottom<=0 || reducedMotion.matches)return {exit:0,fill:0,hold:0};
    const span=Math.max(1,bounds.height);
    const progress=clock===null?clamp((vh-bounds.top)/span):clock;
    const exit=clamp(progress/.6);
    const fill=clamp((progress-fillStart)/(1-fillStart));
    return {exit,fill,hold:fill*clamp(bounds.bottom/span)};
  };
  const home=transition(homeGap,.40,heroCubeProgress),project=transition(projectGap);
  const fill=Math.max(heroCubeProgress===null?home.fill:0,project.fill);
  const homeWash=heroCubeProgress===null?home.hold:home.hold*smooth((heroCubeProgress-.72)/.18);
  const wash=Math.max(sectionGrid,homeWash,project.hold);
  // About owns a stable sticky reading stage; no fixed/flow positioning switches.
  document.documentElement.style.setProperty('--about-reveal',String(clamp((vh-about.top)/(vh*.45))*homeArrival));
  document.documentElement.style.setProperty('--experience-reveal',String(clamp((vh-experience.top)/(vh*.3))));
  document.documentElement.style.setProperty('--experience-departure',String(reducedMotion.matches?1:smooth(experience.bottom/(vh*.85))));
  document.documentElement.style.setProperty('--exit-home',String(home.exit));
  // Use the same exit timing as the hero while the pixel border fills inward.
  document.documentElement.style.setProperty('--exit-project',String(project.exit));
  document.documentElement.style.setProperty('--pixel-fill',String(fill));
  document.documentElement.style.setProperty('--pixel-transition',String(Math.sin(Math.PI*fill)));
  document.documentElement.style.setProperty('--wash',String(wash));
  document.documentElement.style.setProperty('--section-grid',String(sectionGrid));
  document.documentElement.style.setProperty('--project-presence',String(projectPresence));
  document.documentElement.style.setProperty('--contact-presence',String(visibility(contact)));
  document.documentElement.style.setProperty('--hero-presence',String(Math.max(clamp(1-window.scrollY/(vh*.85)),homeGap.top<=vh&&homeGap.bottom>0?1-home.fill:0)));
  if(reducedMotion.matches){cards.forEach(card=>{card.removeAttribute('aria-hidden');card.tabIndex=0});return}
  // Reserve the end of the pinned section for cfast to settle before its exit.
  const range=Math.max(1,section.offsetHeight-window.innerHeight*1.8);
  const progress=Math.min(4,Math.max(0,(-rect.top/range)*4));
  current=Math.round(progress);
  cards.forEach((card,index)=>{
    const delta=progress-index;
    card.style.transform=`translateX(calc(-50% + ${-delta*112}%))`;
    card.style.filter=`blur(${Math.min(9,Math.max(0,Math.abs(delta)-.32)*12)}px)`;
    card.style.opacity=String(Math.max(.25,1-Math.max(0,Math.abs(delta)-.2)*.5));
    card.style.zIndex=String(10-Math.round(Math.abs(delta)));
    card.setAttribute('aria-hidden',index===current?'false':'true');
    card.tabIndex=index===current?0:-1;
  });
}
function openProject(index){
  const p=projects[index];lastFocus=document.activeElement;dialog.dataset.project=p.name.toLowerCase();

  document.querySelector('#dialog-title').textContent=p.name;
  document.querySelector('#dialog-description').textContent=p.description;
  document.querySelector('#dialog-stack').textContent=p.stack;
  document.querySelector('#dialog-github').href=p.github;
  const live=document.querySelector('#dialog-live');live.hidden=!p.live;if(p.live)live.href=p.live;
  showProjectBackground(index);
  dialog.showModal();document.body.style.overflow='hidden';
}
function navigationTop(id){
  if(id==='home')return 0;
  if(id==='about'){
    const intro=document.querySelector('.intro-sequence');
    return scrollY+intro.getBoundingClientRect().top
      +document.querySelector('.hero-frame').offsetHeight-innerHeight;
  }
  // Sticky sections move inside their frames; the frames retain stable anchors.
  const target=id==='experience'?document.querySelector('.experience-frame'):document.getElementById(id);
  return scrollY+target.getBoundingClientRect().top;
}
function navigateTo(id,{behavior=reducedMotion.matches?'instant':'smooth',replaceHash=true}={}){
  const top=Math.max(0,navigationTop(id));
  if(replaceHash)history.replaceState(null,'',`#${id}`);
  document.dispatchEvent(new CustomEvent('portfolio:navigate',{detail:{section:id,top}}));
  window.scrollTo({top,behavior});
  updateProjects();
  updateActiveNav();
}
document.querySelectorAll('.nav a').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  navigateTo(link.hash.slice(1));
}));
document.querySelector('footer a[href="#home"]').addEventListener('click',event=>{
  event.preventDefault();
  navigateTo('home');
});
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{hideProjectBackground();document.body.style.overflow='';lastFocus?.focus({preventScroll:true})});
window.addEventListener('scroll',updateProjects,{passive:true});window.addEventListener('resize',updateProjects);reducedMotion.addEventListener('change',updateProjects);updateProjects();
const navLinks=[...document.querySelectorAll('.nav a')];
function updateActiveNav(){
  const threshold=window.innerHeight*.55;
  const contact=document.querySelector('#contact').getBoundingClientRect();
  const experience=document.querySelector('#experience').getBoundingClientRect();
  const projects=section.getBoundingClientRect();
  const nearBottom=window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-4;
  let active='about';
  if(projects.top<=threshold)active='projects';
  if(experience.top<=threshold)active='experience';
  if(contact.top<=threshold||nearBottom)active='contact';
  navLinks.forEach(link=>{
    const selected=link.hash===`#${active}`;
    link.classList.toggle('active',selected);
    if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  });
}
window.addEventListener('scroll',updateActiveNav,{passive:true});
window.addEventListener('resize',updateActiveNav);
updateActiveNav();

// Resolve direct section links after fonts have settled the section heights.
const initialSection=location.hash.slice(1);
if(['about','projects','experience','contact'].includes(initialSection)){
  document.fonts.ready.then(()=>{
    if(location.hash===`#${initialSection}`)navigateTo(initialSection,{behavior:'instant',replaceHash:false});
  });
}
window.addEventListener('hashchange',()=>{
  const id=location.hash.slice(1);
  if(['home','about','projects','experience','contact'].includes(id))navigateTo(id,{replaceHash:false});
});

import('./visuals.js');
import('./hero-transition.js');
