// The gallery's horizontal paths converge on the first node of the experience timeline.
const canvas = document.getElementById('experience-signal');
const context = canvas.getContext('2d');
const timeline = document.querySelector('.timeline');
const firstNode = timeline.querySelector('.timeline-dot');
const clamp = value => Math.max(0,Math.min(1,value));
let active = false;

export function drawExperienceSignal(progress) {
  if (!context) return;
  const showing = progress > 0 && progress < 1;
  if (!showing && !active) return;
  active = showing;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const ratio = Math.min(devicePixelRatio,1.6);
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;canvas.height = pixelHeight;
  }
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,width,height);
  if (!active) return;

  const node = firstNode.getBoundingClientRect();
  const railX = node.left + node.width/2;
  const nodeY = node.top + node.height/2;
  const fade = Math.sin(progress*Math.PI);
  const direction=railX>width*.43?-1:1;
  context.lineWidth = 1.35;
  context.lineJoin = 'round';

  for (let lane=0;lane<3;lane++) {
    const x = railX + direction*(Math.min(132,width*.22)-lane*12);
    const y = height*(.84-progress*.48)+lane*19;
    const bend = nodeY<y ? -24 : 24;
    const start = x + direction*(Math.min(250,width*.26)+lane*9);
    const path = [[start,y],[x,y],[x-direction*24,y+bend],[railX+direction*22,y+bend],[railX,y+bend*1.9],[railX,nodeY]];
    const lengths = path.slice(1).map(([px,py],i)=>Math.hypot(px-path[i][0],py-path[i][1]));
    const total = lengths.reduce((sum,length)=>sum+length,0);
    let remaining = total * clamp((progress-lane*.07)*1.96);
    let tip = path[0];
    context.beginPath();
    context.moveTo(...tip);
    for (let i=0;i<lengths.length && remaining>0;i++) {
      const from=path[i],to=path[i+1],fraction=clamp(remaining/lengths[i]);
      tip=[from[0]+(to[0]-from[0])*fraction,from[1]+(to[1]-from[1])*fraction];
      context.lineTo(...tip);
      remaining-=lengths[i];
    }
    context.strokeStyle=lane===1?'#c49f74':'#93ad91';
    context.globalAlpha=fade*.68;
    context.stroke();
    context.fillStyle=lane===1?'#d0ad86':'#b4c4aa';
    for(const dot of [path[0],tip]){
      context.beginPath();context.arc(...dot,3+lane*.45,0,Math.PI*2);context.fill();
    }
  }
  context.globalAlpha=1;
}
