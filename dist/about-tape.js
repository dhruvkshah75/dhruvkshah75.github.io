import { createTimeline } from './assets/anime.esm.min.js';

const entrance = .42;
const settle = .48;

export function aboutLandingOffset(viewportHeight) {
  return Math.ceil(settle * viewportHeight);
}

export function createAboutTape(section, reducedMotion) {
  const stage = section.querySelector('.about-stage');
  const state = {length:0, curlIn:0, curlOut:0, reveal:0};
  const timeline = createTimeline({autoplay:false})
    .add(state, {length:[0,1], duration:705, ease:'inOutSine'}, 0)
    .add(state, {curlIn:[0,1], duration:80}, 100)
    .add(state, {curlOut:[0,1], duration:85}, 620)
    .add(state, {reveal:[0,1], duration:315, ease:'inOutSine'}, 745);
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
    stage.style.setProperty('--tape',state.length);
    stage.style.setProperty('--tape-curl',state.curlIn*(1-state.curlOut));
    stage.style.setProperty('--curl-width',.84 + .16 * Math.cos(state.length * 25));
    // The chip follows the layout's translated bounds and uses this same opacity.
    stage.style.setProperty('--bio-opacity',state.reveal);
    stage.style.setProperty('--bio-shift',(1-state.reveal)*32 + 'px');
  };
}
