import { createSectionTransition } from './section-transition.js?v=revision';
import { createAboutTape, aboutLandingOffset } from './about-tape.js?v=chip-dock';
import { drawExperienceSignal } from './experience-transition.js?v=blue';
import { showProjectBackground, hideProjectBackground } from './project-background.js?v=blue';

const projects = [
  {
    steps:['Queue', 'Dispatch', 'Complete'], topics:['Distributed systems', 'Job scheduler', 'Task queue'],
    name:'taskflow', category:'Distributed systems',
    description:'Distributed background task processing, built for scalable asynchronous workloads.',
    features:[
      ['Dynamic execution','Workers run uploaded Python scripts on demand without rebuilding their containers.'],
      ['Queue-driven scaling','Worker capacity follows the queue depth. Active jobs finish before a worker shuts down.'],
      ['Fault tolerance','Leader election and crash recovery support at-least-once delivery.']
    ],
    stack:'Python · Docker · Kubernetes · FastAPI', caption:'Queued jobs move through the worker pool.',
    github:'https://github.com/dhruvkshah75/TaskFlow', live:'https://taskflow-io.vercel.app'
  },
  {
    steps:['Select file', 'Transfer', 'Receive'], topics:['File sharing', 'File server', 'Self-hosted'],
    name:'oxidrop', category:'Developer tools',
    description:'Fast wireless file sync between Linux and mobile devices.',
    features:[
      ['Local transfers','A Linux machine serves files over Wi-Fi or a mobile hotspot. The transfer stays on the local network.'],
      ['Mobile access','A WebDAV client on a phone or tablet connects directly to the server.']
    ],
    stack:'Rust · WebDAV', caption:'A file travels from a Linux host to a mobile client.',
    github:'https://github.com/dhruvkshah75/oxidrop'
  },
  {
    steps:['Socket input', 'Server tick', 'State broadcast'], topics:['WebSockets', '2D game', 'Concurrency'],
    name:'gamesync', category:'Multiplayer networking · In progress',
    description:'A Go multiplayer server in development for real-time state synchronisation.',
    features:[
      ['Current build','The health endpoint is runnable. The game simulation, clients, and gateway are planned.'],
      ['Planned architecture','Players send inputs to an authoritative server that resolves positions, hits, and scores.']
    ],
    stack:'Go · Sockets', caption:'Two clients send concurrent socket inputs. The server resolves each tick and broadcasts one shared arena state.',
    github:'https://github.com/dhruvkshah75/gamesync'
  },
  {
    steps:['Observe', 'Compare', 'Revise'], topics:['AI agents', 'Knowledge graph', 'Belief revision'],
    name:'groundtruth', category:'Artificial intelligence',
    description:'An agent that checks its beliefs against evidence and records what changes.',
    features:[
      ['Conflicting evidence','When a simulated sensor disagrees with the stored map, the agent records a belief revision.'],
      ['Inspectable reasoning','The belief graph, evidence, and execution trace make the decision visible to the reader.']
    ],
    stack:'Python · SQLite · NetworkX', caption:'Signals propagate between beliefs in a graph.',
    github:'https://github.com/dhruvkshah75/groundtruth'
  },
  {
    steps:['Compile', 'Run samples', 'Report'], topics:['CLI', 'Test runner', 'Competitive Companion'],
    name:'cfast', category:'Developer tools',
    description:'Import Codeforces samples, compile a C++ solution, and check its output from the terminal.',
    features:[
      ['Sample import','Competitive Companion sends the problem’s samples and resource limits to a local listener.'],
      ['Test runs','One command compiles the solution and reports each verdict, execution time, and peak memory usage.']
    ],
    stack:'Python · CLI', caption:'A sample run moves from compilation to verdict.',
    github:'https://github.com/dhruvkshah75/cfast', live:'https://cfast.vercel.app'
  }
];

const get = selector => document.querySelector(selector);
const stage = get('#project-stage'), section = get('#projects'), dialog = get('#project-dialog');
const root = document.documentElement, reduced = matchMedia('(prefers-reduced-motion: reduce)');
const navLinks = [...document.querySelectorAll('.nav a')];
const destinations = navLinks.map(link => document.querySelector(link.hash));
const stackPanel=get('.stack-panel');
const gap = get('#home-transition'), projectGap = get('#project-transition');
const counter = get('#project-counter'), prev = get('#prev-project'), next = get('#next-project');
const experience = get('#experience'), about = get('#about'), contact = get('#contact');
const renderAboutTape = createAboutTape(about,reduced);
const clamp = x => Math.max(0,Math.min(1,x));
const smooth = x => {x=clamp(x);return x*x*(3-2*x)};
const boot = detail => document.dispatchEvent(new CustomEvent('portfolio:load',{detail}));
const visit = createSectionTransition();
let current = 0, lastFocus, projectArt, projectArtLoad;
function sequenceLabels(steps) {
  return steps.map(text=>{
    const label=document.createElement('span');label.textContent=text;return label;
  });
}
const cards = projects.map((project,index) => {
  const card=document.createElement('button');
  card.type='button';card.className='project-card';card.dataset.project=project.name;
  card.setAttribute('aria-label','Open '+project.name+' project details');
  card.innerHTML='<span class="card-content"><span class="card-top"></span><span class="card-title"></span><span class="card-description"></span><span class="card-stack"></span><span class="card-action">Project details <span aria-hidden="true">↗</span></span></span><span class="project-visual" aria-hidden="true"><canvas class="project-canvas" width="800" height="600"></canvas><span class="model-steps"></span></span>';
  card.querySelector('.card-top').textContent=project.category;
  card.querySelector('.model-steps').append(...sequenceLabels(project.steps));
  card.querySelector('.card-title').textContent=project.name;
  card.querySelector('.card-description').textContent=project.description;
  card.querySelector('.card-stack').textContent=project.stack;
  card.addEventListener('click',()=>visit({
    id:'project',label:project.name,project:project.name,
    preview:card.querySelector('canvas'),reveal:()=>openProject(index)
  }));
  stage.append(card);
  return card;
});
function loadProjectArt() {
  projectArtLoad ??= import('./project-visuals.js?v=revision').then(module=>{
    projectArt=module.startProjectIllustrations();
    if(dialog.open)projectArt?.show(Number(dialog.dataset.index));
  }).catch(error=>console.warn('Project illustrations unavailable',error));
  return projectArtLoad;
}
let stackLoad;
function loadStack() {
  return stackLoad ??= import('./processor.js?v=about-balance').then(module=>module.startProcessor()).catch(error=>{
    console.warn('Processor illustration unavailable',error);
  });
}
const nearChip=new IntersectionObserver(entries=>{
  if(entries.some(entry=>entry.isIntersecting)){nearChip.disconnect();loadStack()}
},{rootMargin:'320px 0px'});
nearChip.observe(about);
nearChip.observe(get('#stack'));
async function prepareDestination(id) {
  if(id==='projects') await loadProjectArt();
  if(id==='about'||id==='stack') await loadStack();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
const nearProjects = new IntersectionObserver(([entry])=>{
  if(entry.isIntersecting){nearProjects.disconnect();loadProjectArt()}
},{rootMargin:'140% 0px'});
nearProjects.observe(section);

function openProject(index) {
  const p=projects[index];
  lastFocus=cards[index];
  dialog.dataset.project=p.name;dialog.dataset.index=index;
  get('.dialog-figure').dataset.project=p.name;
  get('#dialog-category').textContent=p.category;
  get('#dialog-title').textContent=p.name;
  get('#dialog-description').textContent=p.description;
  get('#dialog-caption').textContent=p.caption;
  get('#dialog-steps').replaceChildren(...sequenceLabels(p.steps));
  get('#dialog-topics').textContent=p.topics.join(' · ');
  get('#dialog-features').replaceChildren(...p.features.map(([name,detail])=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=name;dd.textContent=detail;row.append(dt,dd);return row;
  }));
  get('#dialog-stack').textContent=p.stack;
  get('#dialog-github').href=p.github;
  const live=get('#dialog-live');
  live.href=p.live || p.github+'#readme';
  live.textContent=p.live?'Visit website ↗':'Project overview ↗';
  const canvas=get('#dialog-canvas');
  const context=canvas.getContext('2d');
  context.clearRect(0,0,canvas.width,canvas.height);
  context.drawImage(cards[index].querySelector('canvas'),0,0,canvas.width,canvas.height);
  dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';
  showProjectBackground(index);
  if(projectArt)projectArt.show(index);else loadProjectArt();
}
get('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{
  projectArt?.hide();hideProjectBackground();document.body.style.overflow='';lastFocus?.focus({preventScroll:true});
});

function projectRange(){return Math.max(1,section.offsetHeight-innerHeight*1.3)}
function navigateProject(index) {
  const top=scrollY+section.getBoundingClientRect().top+index*projectRange()/(projects.length-1);
  window.scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
}
prev.addEventListener('click',()=>navigateProject(current-1));
next.addEventListener('click',()=>navigateProject(current+1));
function update() {
  const vh=innerHeight;
  const aboutRect=about.getBoundingClientRect(),exp=experience.getBoundingClientRect();
  const projectsRect=section.getBoundingClientRect(),contactRect=contact.getBoundingClientRect();
  const home=clamp((vh-gap.getBoundingClientRect().top)/Math.max(1,gap.offsetHeight));
  const presence=r=>smooth((vh-r.top)/(vh*.65))*smooth(r.bottom/(vh*.75));
  const aboutReveal=reduced.matches?1:smooth((home-.68)/.27);
  renderAboutTape(aboutRect.top,vh);
  const stackPresence=presence(stackPanel.getBoundingClientRect());
  const contactHandoff=clamp((vh-contactRect.top)/(vh*.94));
  const contactArrival=smooth(contactHandoff);
  const grid=Math.max(presence(aboutRect)*aboutReveal,presence(exp),stackPresence*.73,
    .31*contactArrival*(1-contactHandoff));
  const handoff=reduced.matches?0:clamp((vh*.86-projectGap.getBoundingClientRect().top)/(vh*.91));
  const exit=smooth(handoff/.64);
  drawExperienceSignal(handoff);
  root.style.setProperty('--wash',grid);
  root.style.setProperty('--stack-presence',stackPresence);
  root.style.setProperty('--section-grid',grid);
  root.style.setProperty('--pixel-fill',Math.sin(handoff*Math.PI)*.52);
  root.style.setProperty('--pixel-transition',Math.sin(handoff*Math.PI)*.52);
  root.style.setProperty('--exit-project',exit);
  root.style.setProperty('--hero-presence',1-home);
  root.style.setProperty('--project-presence',presence(projectsRect));
  root.style.setProperty('--contact-presence',contactArrival);
  root.style.setProperty('--experience-reveal',smooth((vh-exp.top)/(vh*.56)));
  contact.style.setProperty('--contact-arrival',reduced.matches?1:contactArrival);
  experience.style.setProperty('--experience-pin-top',Math.min(0,vh-experience.offsetHeight)+'px');
  const position=clamp(-projectsRect.top/projectRange())*(projects.length-1);
  current=Math.round(position);
  cards.forEach((card,index)=>{
    const offset=index-position, distance=Math.abs(offset);
    const selected=reduced.matches||index===current;
    card.tabIndex=selected?0:-1;card.setAttribute('aria-hidden',String(!selected));
    if(reduced.matches){card.style.filter='';return}
    card.style.transform='translate(-50%,-50%) translateX('+offset*105+'%) translateZ('+(-Math.min(distance,1.5)*130)+'px) rotateY('+(-Math.max(-1,Math.min(offset,1))*17)+'deg)';
    card.style.opacity=String(1-Math.min(.62,distance*.42));
    card.style.filter='blur('+Math.min(2.2,Math.max(0,distance-.28)*2.6)+'px)';
    card.style.zIndex=String(8-Math.round(distance));
  });
  counter.textContent=String(current+1).padStart(2,'0')+' / '+String(projects.length).padStart(2,'0');
  prev.disabled=current===0;next.disabled=current===projects.length-1;
  let active='home';
  for (const dest of destinations) if(dest.getBoundingClientRect().top<vh*.55)active=dest.id;
  navLinks.forEach(link=>{
    const selected=link.hash==='#'+active;
    link.classList.toggle('active',selected);
    if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  });
  if(!root.classList.contains('has-fracture')) {
    get('.hero-copy').style.opacity=reduced.matches?'1':String(1-smooth(home/.48));

  }
}
let updateFrame=0;
function requestUpdate(){if(!updateFrame)updateFrame=requestAnimationFrame(()=>{updateFrame=0;update()})}
window.addEventListener('scroll',requestUpdate,{passive:true});
window.addEventListener('resize',requestUpdate);reduced.addEventListener('change',requestUpdate);

function navigate(id,behavior) {
  const target=id==='experience'?get('.experience-frame'):document.getElementById(id);
  if(!target)return;
  const aboutOffset=id==='about'&&!reduced.matches?aboutLandingOffset(innerHeight):0;
  const top=id==='home'?0:scrollY+target.getBoundingClientRect().top+aboutOffset;
  window.scrollTo({top,behavior});
}
const sectionIds=['stack',...destinations.map(dest=>dest.id)];
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.classList.contains('skip'))return;
  event.preventDefault();
  const id=link.hash.slice(1);
  visit({id,label:id==='home'?'Dhruv Shah':link.textContent.trim(),reveal:async ()=>{
    history.replaceState(null,'',id==='home'?location.pathname+location.search:link.hash);
    navigate(id,'instant');
    update();
    await prepareDestination(id);
  }});
}));
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),'instant'));
update();
async function prepareIntro() {
  let settled=0;
  function track(check, job, state) {
    return job.then(()=>{
      boot({progress:24+ ++settled*22,check,state:state()});
    },()=>{
      boot({progress:24+ ++settled*22,check,state:'Fallback'});
    });
  }
  await Promise.all([
    track('interface',Promise.all([
      document.fonts.load('500 24px "DM Sans"'),
      document.fonts.load('570 24px Geist')
    ]),()=> 'Ready'),
    track('field',import('./visuals.js?v=about-balance'),()=> root.classList.contains('has-field')?'Online':'Fallback'),
    track('scene',import('./hero-transition.js?v=blue').then(module=>module.ready),
      ()=> root.classList.contains('has-fracture')?'Online':'Static')
  ]);
  const id=location.hash.slice(1);
  if(sectionIds.includes(id)){
    navigate(id,'instant');
    await prepareDestination(id);
  }
  update();
  requestAnimationFrame(()=>boot({progress:100}));
}
prepareIntro();
