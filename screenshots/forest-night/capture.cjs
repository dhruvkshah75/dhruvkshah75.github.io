const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = __dirname;
const baseUrl = process.env.FOREST_URL || 'http://127.0.0.1:3000/';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROME_BINARY || '/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const report = { captures: [], errors: [], failures: [], warnings: [] };
 try {
  const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror', e=>report.errors.push(e.message));
  page.on('console', msg=>{if(msg.type()==='error')report.errors.push(msg.text());if(msg.type()==='warning')report.warnings.push(msg.text());});
  page.on('requestfailed', req=>report.failures.push({url:req.url(),error:req.failure()?.errorText}));
  const ready = async()=>{await page.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&document.fonts.status==='loaded'); await page.waitForTimeout(2200);};
  const shot=async(name)=>{await page.waitForTimeout(1000);await page.screenshot({path:`${out}/${name}.png`});report.captures.push({name,preset:await page.locator('canvas').getAttribute('data-time-of-day'),scroll:await page.evaluate(()=>scrollY/(document.documentElement.scrollHeight-innerHeight))});};
  for(const time of ['night','dusk','day']) {
   await page.goto(`${baseUrl}?time=${time}`,{waitUntil:'networkidle',timeout:90000});await ready();
   assert.equal(await page.locator('canvas').getAttribute('data-time-of-day'),time);
   await shot(`${time}-start`);
   await page.evaluate(()=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.5));await shot(`${time}-middle`);
   await page.locator('.trail-nav button').nth(1).click();await page.locator('[data-stop=projects]').waitFor({state:'visible'});await shot(`${time}-projects`);
   if(time==='night') {
    await page.locator('[data-stop=projects]').click();await page.waitForFunction(()=>document.querySelector('dialog').open);
    assert.equal(await page.locator('.project').count(),5);await shot('night-projects-panel');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog').open);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.stop),'projects');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
  }
  await page.goto(baseUrl,{waitUntil:'networkidle'});await ready();assert.equal(await page.locator('canvas').getAttribute('data-time-of-day'),'night');
  await page.goto(`${baseUrl}?time=invalid`,{waitUntil:'networkidle'});await ready();assert.equal(await page.locator('canvas').getAttribute('data-time-of-day'),'night');
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseUrl}?time=night`,{waitUntil:'networkidle'});await ready();
  assert.equal(await page.locator('canvas').getAttribute('data-quality'),'low');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('night-mobile');
  report.interactions='All three presets, default/invalid URL fallback to night, Projects marker and five cards, Escape and focus restoration, mobile low tier, no horizontal overflow: passed';
  fs.writeFileSync(`${out}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  assert.equal(report.errors.length,0,'No browser exceptions or console errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
