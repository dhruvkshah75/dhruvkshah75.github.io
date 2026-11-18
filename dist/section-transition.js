// Move the document only after the title screen covers the viewport.
export function createSectionTransition(switchSection) {
  const overlay = document.querySelector('.route-screen');
  const title = overlay.querySelector('.route-title');
  const panelRow = overlay.querySelector('.route-panels');
  const panels = Array.from({length:7}, () => panelRow.appendChild(document.createElement('i')));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false;
  return async function visit(id, label) {
    if (active) return;
    active = true;
    overlay.dataset.section = id;
    title.textContent = label;
    overlay.hidden = false;
    document.documentElement.classList.add('routing');
    const page = document.querySelector('main'), nav = document.querySelector('.nav');
    page.inert = nav.inert = true;
    const play = (el,frames,options) => el.animate(frames,{fill:'both',...options}).finished;
    const unfold = (panel,i) => play(panel,[
      {transform:'translateY(108%) rotateX(-12deg)'},
      {transform:'translateY(0) rotateX(0deg)'}
    ],{duration:340,delay:i*19,easing:'cubic-bezier(.24,.75,.24,1)'});
    const fold = (panel,i) => play(panel,[
      {transform:'translateY(0) rotateX(0deg)'},
      {transform:'translateY(-110%) rotateX(9deg)'}
    ],{duration:340,delay:i*15,easing:'cubic-bezier(.6,0,.8,.35)'});
    try {
      if (reduced.matches) {
        title.style.opacity = '1';
        await play(overlay,[{opacity:0},{opacity:1}],{duration:100});
      } else {
        await Promise.all([...panels.map(unfold),play(title,[
          {opacity:0,transform:'translateY(13px)'},{opacity:1,transform:'translateY(0)'}
        ],{duration:195,delay:300})]);
      }
      await Promise.all([
        switchSection(id),
        play(title,[{opacity:1},{opacity:1}],{duration:reduced.matches?220:390})
      ]);
      if(reduced.matches) await play(overlay,[{opacity:1},{opacity:0}],{duration:110});
      else await Promise.all([...panels.map(fold),play(title,[{opacity:1},{opacity:0,transform:'translateY(-10px)'}],{duration:110})]);
    } finally {
      overlay.hidden=true;
      overlay.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
      title.style.opacity='';
      document.documentElement.classList.remove('routing');
      nav.inert=page.inert=false;
      const heading=document.querySelector('#'+id+' :is(h1,h2)');
      if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}
      active=false;
    }
  };
}
