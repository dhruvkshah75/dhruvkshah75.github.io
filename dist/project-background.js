// A softly animated field of connected pixel forms behind the project dialog.
const overlay=document.querySelector('#project-background');
const canvas=document.querySelector('#project-background-canvas');
const context=canvas.getContext('2d');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const palettes=[
  ['#fae5d6','#f3c5ae','#e99b7e','#cf755d'], // taskflow: warm coral
  ['#e0f2f8','#b7ddeb','#79b7d3','#568eb9'], // oxidrop: clear blue
  ['#f9e4e9','#edbdd2','#d992b3','#b46b96'], // gamesync: rose
  ['#ebe9fa','#ccc7ee','#a59bdb','#796dbd'], // groundtruth: indigo
  ['#f9edcf','#eddaa4','#d6b875','#b48e4d']  // cfast: amber
];
let frame=0,lastTime=0,palette=palettes[0],patterns=[],width=0,height=0,startTime=0;
const tile=24;
function makePattern(color,dense=false){
  const sample=document.createElement('canvas');sample.width=8;sample.height=8;
  const pen=sample.getContext('2d');pen.fillStyle=color;
  if(dense){pen.fillRect(0,0,8,8);pen.clearRect(0,0,2,2);pen.clearRect(4,4,2,2)}
  else{pen.fillRect(0,0,2,2);pen.fillRect(4,4,2,2)}
  return context.createPattern(sample,'repeat');
}
function setPalette(index){
  palette=palettes[index]||palettes[0];
  patterns=palette.map(color=>({fine:makePattern(color),dense:makePattern(color,true)}));
}
function resize(){
  width=innerWidth;height=innerHeight;
  const ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
  context.setTransform(ratio,0,0,ratio,0,0);
  setPalette(palettes.indexOf(palette));
}
function draw(elapsed){
  context.clearRect(0,0,width,height);
  const t=reducedMotion.matches?0:elapsed*.00062;
  const cols=Math.ceil(width/tile),rows=Math.ceil(height/tile);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const nx=x/cols,ny=y/rows;
    const edge=Math.min(nx,1-nx,ny,1-ny);
    // Overlapping waves move coherent islands at different speeds and scales.
    const broad=Math.sin(x*.135+y*.055+t*.8)+Math.cos(y*.17-x*.065-t*.65);
    const current=Math.sin(x*.085-y*.16-t*1.05)+Math.cos(x*.2+y*.11+t*.43);
    const islands=Math.sin(x*.3+y*.22+t*1.3)*Math.cos(y*.18-x*.11-t*.7);
    const border=Math.max(0,1-edge*3.4);
    const field=broad*.46+current*.28+islands*.12+border*.95;
    if(field<-.32)continue;
    const pulse=.5+.5*Math.sin(t*1.8+x*.31+y*.23);
    if(field<.12){context.fillStyle=patterns[1].fine;context.globalAlpha=.78}
    else if(field<.53){context.fillStyle=patterns[2].fine;context.globalAlpha=.85}
    else if(field<.95){context.fillStyle=palette[0];context.globalAlpha=.9}
    else if(field<1.35){context.fillStyle=patterns[2].dense;context.globalAlpha=.73}
    else if(field<1.8){context.fillStyle=palette[1];context.globalAlpha=.82}
    else{context.fillStyle=palette[pulse>.82?3:2];context.globalAlpha=.78}
    context.fillRect(x*tile,y*tile,tile+.5,tile+.5);
    // A few isolated pixels pulse at the edges of the moving shapes.
    if(field>.18&&field<.8&&pulse>.91){context.fillStyle=palette[3];context.globalAlpha=.45;context.fillRect(x*tile+8,y*tile+8,8,8)}
  }
  context.globalAlpha=1;
}
function animate(now){
  if(overlay.hidden)return;
  if(now-lastTime>40){draw(now-startTime);lastTime=now}
  if(!reducedMotion.matches)frame=requestAnimationFrame(animate);
}
export function showProjectBackground(index){
  setPalette(index);overlay.hidden=false;resize();startTime=performance.now();lastTime=0;
  cancelAnimationFrame(frame);draw(0);if(!reducedMotion.matches)frame=requestAnimationFrame(animate);
}
export function hideProjectBackground(){cancelAnimationFrame(frame);frame=0;overlay.hidden=true}
window.addEventListener('resize',()=>{if(!overlay.hidden){resize();draw(performance.now()-startTime)}});
reducedMotion.addEventListener('change',()=>{if(!overlay.hidden){cancelAnimationFrame(frame);draw(0);if(!reducedMotion.matches){startTime=performance.now();frame=requestAnimationFrame(animate)}}});
