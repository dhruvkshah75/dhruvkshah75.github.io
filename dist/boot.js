// Run before the page is parsed, so slow module downloads never expose a partial hero.
const root = document.documentElement;
root.classList.add('booting');
let percent = 0;
let target = 12;
let finished = false;
let frame = 0;
let previous = performance.now();
function drawBoot(now) {
  const dt = Math.min(now - previous, 65);
  previous = now;
  percent = Math.min(target, percent + dt * (target === 100 ? .26 : .09));
  root.style.setProperty('--boot-progress', String(percent / 100));
  const label = document.getElementById('boot-percent');
  if (label) label.textContent = Math.floor(percent) + '%';
  if (percent === 100) {
    // Give the completed bar a paint before uncovering the prepared scene.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove('booting');
      root.classList.add('boot-complete');
    }));
  } else if (percent < target) {
    frame = requestAnimationFrame(drawBoot);
  } else {
    frame = 0;
  }
}
function advance(value) {
  if (finished) return;
  target = Math.max(target, value);
  finished = target === 100;
  if (finished) clearTimeout(deadline);
  if (!frame) {
    previous = performance.now();
    frame = requestAnimationFrame(drawBoot);
  }
}
const deadline = setTimeout(() => {
  root.classList.add('static-intro');
  advance(100);
}, 9000);
document.addEventListener('portfolio:load', event => advance(event.detail));
advance(12);
