// Cover the viewport before swapping either a section or a project detail view.
export function createSectionTransition() {
  const overlay = document.querySelector('.route-screen');
  const caption = overlay.querySelector('.route-caption');
  const title = overlay.querySelector('.route-title');
  const circuit = overlay.querySelector('.route-circuit');
  const art = overlay.querySelector('.route-art');
  const artContext = art.getContext('2d');
  const panelRow = overlay.querySelector('.route-panels');
  const panels = Array.from({length:7}, () => panelRow.appendChild(document.createElement('i')));
  const page = document.querySelector('main'), nav = document.querySelector('.nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const popover = typeof overlay.showPopover === 'function';
  let active = false;

  return async function visit({id,label,project,preview,reveal}) {
    if (active) return;
    active = true;
    overlay.dataset.section = id;
    if (project) overlay.dataset.project = project;
    else delete overlay.dataset.project;
    title.textContent = label;
    art.hidden = !preview;
    if (preview && artContext) {
      artContext.clearRect(0,0,art.width,art.height);
      artContext.drawImage(preview,0,0,art.width,art.height);
    }
    overlay.hidden = false;
    if (popover) overlay.showPopover();
    document.documentElement.classList.add('routing');
    page.inert = nav.inert = true;
    const play = (el,frames,options) => el.animate(frames,{fill:'both',...options}).finished;
    const enter = (panel,i) => play(panel,[
      {transform:'translateY(108%) rotateX(-12deg)'},
      {transform:'translateY(0) rotateX(0deg)'}
    ],{duration:340,delay:i*19,easing:'cubic-bezier(.24,.75,.24,1)'});
    const leave = (panel,i) => play(panel,[
      {transform:'translateY(0) rotateX(0deg)'},
      {transform:'translateY(-110%) rotateX(9deg)'}
    ],{duration:325,delay:i*15,easing:'cubic-bezier(.6,0,.8,.35)'});
    const canRevealUnderCover = !project || popover;
    try {
      if (reduced.matches) {
        await play(overlay,[{opacity:0},{opacity:1}],{duration:95});
      } else {
        await Promise.all([...panels.map(enter),
          play(caption,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],
            {duration:220,delay:270}),
          play(circuit,[{opacity:0,transform:'scale(.93)'},{opacity:1,transform:'scale(1)'}],
            {duration:300,delay:175})
        ]);
      }
      // A modal enters the top layer. Move the cover above it in the same turn.
      const work = canRevealUnderCover ? reveal() : undefined;
      if (project && popover) {
        overlay.hidePopover();
        overlay.showPopover();
      }
      await Promise.all([work,play(title,[{opacity:1},{opacity:1}],{duration:reduced.matches?180:330})]);
      if (reduced.matches) await play(overlay,[{opacity:1},{opacity:0}],{duration:95});
      else await Promise.all([...panels.map(leave), ...[caption,circuit].map(element=>
        play(element,[{opacity:1},{opacity:0,transform:'translateY(-12px)'}],{duration:140}))]);
    } finally {
      if (popover) overlay.hidePopover();
      overlay.hidden=true;
      overlay.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
      document.documentElement.classList.remove('routing');
      nav.inert=page.inert=false;
      active=false;
    }
    if (project) {
      if (!canRevealUnderCover) reveal();
      document.getElementById('close-dialog').focus({preventScroll:true});
    } else {
      const heading=document.querySelector('#'+id+' :is(h1,h2)');
      if (heading) { heading.tabIndex=-1;heading.focus({preventScroll:true}); }
    }
  };
}
