// Real-browser smoke checks for the scroll → 3D scene → detail panel journey.
// No browser automation dependencies; Chrome's DevTools protocol is built in.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const url = process.argv[2] || "http://127.0.0.1:3000";
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "forest-browser-"));
const shots = process.env.FOREST_SCREENSHOTS || "/tmp/forest-qa";
await fs.mkdir(shots, { recursive: true });
const browser = spawn(process.env.CHROME_BINARY || "/usr/bin/google-chrome", ["--headless=new", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = parseInt(await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")); } catch { await sleep(100); } }
  assert(port, "Chrome must start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0; const pending = new Map(); const errors = [];
  socket.addEventListener("message", event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const p = pending.get(msg.id); if (p) { clearTimeout(p.timer); pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result); } }
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => { const n = ++id; const timer = setTimeout(() => { pending.delete(n); reject(new Error(`${method} timed out`)); }, 20000); pending.set(n, { resolve, reject, timer }); socket.send(JSON.stringify({ id: n, method, params, sessionId })); });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => { const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  async function until(expression, label) { for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await sleep(150); } throw new Error(`Timed out: ${label}`); }
  async function click(selector) {
    const point = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    assert(point, `Element exists: ${selector}`);
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    await sleep(200);
  }
  async function screenshot(name) { const { data } = await call("Page.captureScreenshot", { format: "png" }); await fs.writeFile(path.join(shots, `${name}.png`), Buffer.from(data, "base64")); }
  const metrics = (width, height) => call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 640 });
  await call("Runtime.enable"); await call("Page.enable");
  await metrics(1440, 900); await call("Page.navigate", { url });
  await until("document.documentElement.dataset.ready === 'true' && document.fonts.status === 'loaded'", "forest and fonts load");
  assert.equal(await evaluate("!!document.querySelector('.forest-canvas canvas') && !document.querySelector('.scene-fallback')"), true, "WebGL forest renders");
  await sleep(500); await screenshot("desktop-entrance");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "Desktop has no horizontal overflow");
  assert.equal(await evaluate("parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) > parseFloat(getComputedStyle(document.querySelector('.intro-eyebrow')).fontSize) && parseFloat(getComputedStyle(document.querySelector('.intro-eyebrow')).fontSize) > parseFloat(getComputedStyle(document.querySelector('.intro-subtitle')).fontSize)"), true, "Name, role and tagline follow the requested size hierarchy");
  assert.equal(await evaluate("document.querySelectorAll('.site-header,.index-button,.begin-button,.motion-button,.trail-location').length"), 0, "The forest has no header, index, extra controls, or start button");
  await call("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 500, deltaX: 0, deltaY: 600 });
  await until("document.querySelector('.forest-experience').classList.contains('on-trail')", "Scrolling alone moves along the trail");
  console.log("PASS: Minimal entrance and scroll-driven movement");
  await sleep(1400);
  const stopIds = ["about", "projects", "journey", "contact"];
  let headingTop;
  for (let i = 0; i < stopIds.length; i++) {
    await click(`.trail-nav button:nth-of-type(${i + 1})`); await sleep(1600);
    const selector = `[data-stop='${stopIds[i]}']`;
    await until(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).visibility === 'visible'`, `Visible marker for ${stopIds[i]}`);
    await screenshot(`desktop-trail-${i + 1}`);
    await click(selector);
    await until("document.querySelector('dialog').open", `Marker opens ${stopIds[i]} panel`);
    assert.equal(await evaluate("document.body.style.overflow"), "hidden", "Background scrolling is locked in the panel");
    assert(await evaluate("!!document.querySelector('dialog h2')"), "Panel contains readable details");
    const currentHeadingTop = await evaluate("document.querySelector('dialog h2').getBoundingClientRect().top");
    if (i === 0) headingTop = currentHeadingTop;
    else assert.equal(currentHeadingTop, headingTop, "Every detail page uses the same heading position");
    assert.equal(await evaluate("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight})()"), true, "Details fill the whole viewport");
    assert.equal(await evaluate("document.querySelectorAll('.panel-header,.panel-footer,.skill-list').length"), 0, "Detail views have no extra header, footer or skill boxes");
    if (i === 0) await screenshot("desktop-about");
    if (i === 0) assert.equal(await evaluate("document.querySelectorAll('.skill-group').length"), 4, "About Me includes all four technology groups");
    if (i === 0) {
      assert.equal(await evaluate("document.querySelectorAll('.about-page .contact-links').length"), 0, "Contact links are absent from About Me");
      assert.equal(await evaluate("document.querySelector('.skills-grid').textContent.includes('AWS')"), false, "AWS is absent from the skills list");
    }
    if (i === 2) {
      assert.equal(await evaluate("document.querySelector('.timeline article h3').textContent"), "Undergraduate Research Intern", "Research internship appears before education");
      assert.equal(await evaluate("document.querySelector('.timeline article h4').textContent"), "GenQuery Technologies Pvt. Ltd.", "Internship employer matches the supplied details");
      assert.equal(await evaluate("['Operating Systems','Data Structures and Algorithms','Computer Programming','Database Systems','Distributed Systems','Backend Architecture'].every(subject=>document.querySelector('.timeline').textContent.includes(subject))"), true, "Education lists all requested subjects");
      await screenshot("desktop-experience");
    }
    if (i === 3) {
      assert.equal(await evaluate("[...document.querySelectorAll('.contact-links > a')].map(a=>a.querySelector('.contact-link-title').textContent).join(',')"), "Email,GitHub,LinkedIn", "Contact offers all three equal-priority channels");
      assert.equal(await evaluate("(()=>{const links=[...document.querySelectorAll('.contact-links > a')];return links.every(a=>Math.abs(a.getBoundingClientRect().width-links[0].getBoundingClientRect().width)<1&&a.getBoundingClientRect().height===links[0].getBoundingClientRect().height&&getComputedStyle(a.querySelector('.contact-link-title')).fontSize===getComputedStyle(links[0].querySelector('.contact-link-title')).fontSize)})()"), true, "Contact links use equal dimensions and typography");
      await screenshot("desktop-contact");
    }
    if (i === 1) {
      assert.equal(await evaluate("document.querySelectorAll('.project').length"), 5, "Exactly five pinned projects");
      assert.equal(await evaluate("document.querySelectorAll('.project-filters,.projects-intro a').length"), 0, "Projects have no filters or all-repositories link");
      await screenshot("desktop-projects");
      const card = await evaluate("(()=>{const r=document.querySelector('.project').getBoundingClientRect();return {x:r.x+50,y:r.y+50}})()");
      await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...card }); await sleep(450);
      assert.equal(await evaluate("Number(getComputedStyle(document.querySelector('.project .project-source-hint')).opacity) > .9"), true, "Hover reveals the project source action");
      await screenshot("desktop-project-hover");
    }
    await click(".close-panel");
    await until("!document.querySelector('dialog').open", "Panel closes");
    console.log(`PASS: Desktop stop ${i + 1}`);
  }
  await click(".trail-nav button:nth-of-type(1)"); await sleep(1600);
  await until("getComputedStyle(document.querySelector('[data-stop=about]')).visibility === 'visible'", "Return walk reaches the About Me stop");
  await click("[data-stop='about']");
  await until("document.querySelector('dialog').open", "About detail view opens before Escape check");
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until("!document.querySelector('dialog').open", "Escape closes the detail page");
  await until("document.activeElement.dataset.stop === 'about'", "Focus is restored to the forest marker");

  for (const [width, height] of [[1024, 768], [768, 1024], [390, 844]]) {
    await metrics(width, height); await evaluate("window.scrollTo(0,0)"); await sleep(500);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `No overflow at ${width}px`);
    assert.equal(await evaluate("parseFloat(getComputedStyle(document.querySelector('.intro-eyebrow')).fontSize) > parseFloat(getComputedStyle(document.querySelector('.intro-subtitle')).fontSize)"), true, `Role remains larger than tagline at ${width}px`);
    await screenshot(`entrance-${width}`);
    if (width === 390) {
      for (let i = 0; i < 4; i++) {
        await click(`.trail-nav button:nth-of-type(${i + 1})`); await sleep(1600);
        const selector = `[data-stop='${stopIds[i]}']`;
        await until(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).visibility === 'visible'`, `Mobile marker ${stopIds[i]} visible`);
        assert.equal(await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`), true, "Mobile marker fits the viewport");
        await click(selector); await until("document.querySelector('dialog').open", "Mobile tap opens detail panel");
        assert.equal(await evaluate("document.querySelector('.panel-scroll').scrollWidth <= document.querySelector('.panel-scroll').clientWidth"), true, "Mobile detail panel has no horizontal overflow");
        if (i === 1) await screenshot("mobile-projects");
        if (i === 0) await screenshot("mobile-about");
        if (i === 2) await screenshot("mobile-experience");
        if (i === 3) await screenshot("mobile-contact");
        await click(".close-panel");
        console.log(`PASS: Mobile stop ${i + 1}`);
      }
    }
  }
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await until("document.querySelector('.forest-experience').classList.contains('motion-paused')", "Reduced motion preference is respected");
  await click(".trail-nav button:nth-of-type(1)"); await sleep(500);
  await click("[data-stop='about']");
  await until("document.querySelector('dialog').open", "Reduced-motion detail page opens");
  assert.equal(await evaluate("document.querySelectorAll('.skill-group').length"), 4, "All four skill groups remain accessible with reduced motion");
  await click(".close-panel");
  assert.equal(errors.length, 0, `No uncaught browser exceptions: ${errors.join("; ")}`);
  console.log("PASS: WebGL forest; all four desktop and mobile stops; five pinned repositories; project hover reveals; full-page dialogs; Escape; focus restoration; reduced motion; responsive layout at 1440, 1024, 768, and 390px; no browser exceptions.");
  console.log(`Screenshots: ${shots}`);
} finally {
  socket?.close(); browser.kill();
}
