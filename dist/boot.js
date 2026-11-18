// Reset scroll restoration on an explicit refresh while preserving incoming deep links.
const root = document.documentElement;
const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
if (isReload) {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  window.scrollTo(0, 0);
}
root.classList.add('booting');

const checks = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let percent = 0;
let target = 16;
let frame = 0;
let previous = performance.now();

function drawBoot(now) {
  const dt = Math.min(now - previous, 65);
  previous = now;
  percent = Math.min(target, percent + dt * (reduceMotion.matches ? .30 : .057));
  root.style.setProperty('--boot-progress', String(percent / 100));
  const label = document.getElementById('boot-percent');
  if (label) label.textContent = Math.floor(percent) + '%';
  document.querySelectorAll('[data-boot-check]').forEach((check, index) => {
    const state = checks.get(check.dataset.bootCheck);
    const threshold = [24,50,77][index];
    if (percent >= threshold && state) {
      check.textContent = state;
      check.dataset.ready = 'true';
    } else if (percent >= threshold - 18) {
      check.textContent = 'Checking';
    }
  });
  if (percent === 100) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (isReload) window.scrollTo(0, 0);
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
  if (target === 100) return;
  target = Math.max(target, value);
  if (target === 100) clearTimeout(deadline);
  if (!frame) {
    previous = performance.now();
    frame = requestAnimationFrame(drawBoot);
  }
}
const deadline = setTimeout(() => {
  root.classList.add('static-intro');
  for (const check of ['interface','field','scene']) {
    if (!checks.has(check)) checks.set(check, 'Fallback');
  }
  advance(100);
}, 9000);
document.addEventListener('portfolio:load', event => {
  const {progress, check, state} = event.detail;
  if (check) checks.set(check, state);
  advance(progress);
});
advance(16);
