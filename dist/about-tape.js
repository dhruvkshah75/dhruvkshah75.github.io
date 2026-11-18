import { createTimeline } from './assets/anime.esm.min.js';

const entrance = .42;
const settle = .42;

export function aboutLandingOffset(viewportHeight) {
  return Math.ceil(settle * viewportHeight);
}

export function createAboutTape(section, reducedMotion) {
  const stage = section.querySelector('.about-stage');
  const state = {thread:0, length:0, curl:0, copy:0, rise:22};
  const timeline = createTimeline({autoplay:false})
    .add(state, {thread:[0,1], duration:190, ease:'outQuad'}, 0)
    .add(state, {length:[0,1], duration:615, ease:'inOutSine'}, 90)
    .add(state, {curl:[0,1], duration:80}, 100)
    .add(state, {curl:[1,0], duration:85}, 620)
    .add(state, {copy:[0,1], rise:[22,0], duration:275, ease:'outCubic'}, 725);
  let previous;

  return function renderAboutTape(top, viewportHeight) {
    const still = reducedMotion.matches;
    const progress = still ? 1 : Math.min(1,Math.max(0,
      (entrance * viewportHeight - top) / ((entrance + settle) * viewportHeight)
    ));
    section.classList.toggle('has-about-motion',!still);
    if (previous === progress) return;
    previous = progress;

    timeline.seek(progress * timeline.duration);
    stage.style.setProperty('--thread',state.thread);
    stage.style.setProperty('--tape',state.length);
    stage.style.setProperty('--tape-curl',state.curl);
    stage.style.setProperty('--curl-width',.84 + .16 * Math.cos(state.length * 25));
    stage.style.setProperty('--bio-opacity',state.copy);
    stage.style.setProperty('--bio-shift',state.rise + 'px');
  };
}
