const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const root=process.env.BREAKER_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(root+"/industry/crafting",{waitUntil:"domcontentloaded"});
  await page.locator(".craft-v31-hero-queue").waitFor({state:"visible",timeout:20000});
  await page.waitForTimeout(400);
  const art=await page.locator(".craft-v31-lab-hero > .craft-v31-lab-art").boundingBox();
  assert.ok(art&&art.width>=230&&art.height>=150,"Crafting V31b reference artwork occupies full hero slot");
  const artBackground=await page.locator(".craft-v31-lab-art").evaluate(e=>getComputedStyle(e).backgroundImage);
  assert.ok(artBackground.includes("v31b-crafting-workbench.avif"),"Original V31b crafting art is visible");
  assert.equal(await page.locator(".craft-v31-acquisition-columns > section").count(),2,"Reward and store regions separate");
  assert.equal(await page.locator(".craft-v31-lab-snapshot > div").count(),4,"Four compact summary metrics");
  assert.equal(await page.locator(".craft-v31-performance-table thead th").count(),4,"Compared stat columns");
  const slider=await page.locator(".craft-detail-drawer-materials .craft-v31-band-range").first().boundingBox();
  assert.ok(slider&&slider.width>=250&&slider.y<800,"First functional material quality slider visible in first viewport");
  const qty=page.locator(".craft-v31-queue-quantity input");
  await qty.fill("3");await page.locator(".craft-v31-hero-queue").click();await page.waitForTimeout(250);
  const stored=await page.evaluate(async()=>{const {useLogisticsStore}=await import("/src/stores/logisticsStore.ts");return useLogisticsStore.getState().buildQueue.filter(x=>String(x.itemName).toLowerCase().replace("-","").includes("js300")).map(x=>x.quantity)});
  assert.ok(stored.includes(3),"Qty 3 creates a real three-unit queue entry");
  assert.deepEqual(errors,[],"Crafting JavaScript errors");
  console.log("PASS Crafting hero/reference art, first-fold sliders, acquisition and real queue quantity 3");
  await page.close();
  const build=await browser.newPage({viewport:{width:1440,height:900}});
  const buildErrors=[];build.on("pageerror",e=>buildErrors.push(e.message));
  await build.goto(root+"/logistics/build-queue",{waitUntil:"domcontentloaded"});
  await build.locator(".bq-v31-potential-sources").waitFor({state:"visible",timeout:18000});
  assert.equal(await build.locator(".bq-v31-potential-head").count(),1,"Potential sources heading visible");
  assert.equal(await build.locator(".bq-v31-potential-inventory-link").count(),1,"Inventory source navigation present");
  assert.ok(await build.locator(".bq-v31-location-source, .bq-v31-potential-sources .bq-ledger-empty").count()>0,"True physical sources or explicitly empty");
  assert.deepEqual(buildErrors,[],"Build Queue JavaScript errors");
  console.log("PASS Build Queue inventory-backed potential sourcing panel and no fabricated physical stock");
  await build.close();
  for(const name of ["craft","build"]){
    const path=name==="craft"?"/industry/crafting":"/logistics/build-queue";
    const mobile=await browser.newPage({viewport:{width:390,height:844}});
    await mobile.goto(root+path,{waitUntil:"domcontentloaded"});
    const tabs=mobile.locator(".workspace-mobile-nav__tabs button");await tabs.first().waitFor({state:"visible",timeout:15000});
    assert.equal(await tabs.count(),3);
    await tabs.nth(2).click();
    assert.equal(await mobile.locator(".workspace-mobile-nav [aria-selected=true]").count(),1);
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mobile.close();
  }
  console.log("PASS mobile Crafting/Build Queue nav retained");
 }finally{await browser.close();}
 console.log("ALL_PASS5_UI_CHECKS_PASSED");
})().catch(err=>{console.error(err);process.exitCode=1});
