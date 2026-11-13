// Run: node scripts/qa/nonmining-v31-smoke.cjs (with fixtures Vite on port 5173).
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.BREAKER_URL || "http://127.0.0.1:5173";
const out = path.join(process.cwd(),"tmp","v31-smoke");
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  async function visit(name,route,check,options={}){
    const context=await browser.newContext({viewport:{width:options.mobile?390:1600,height:options.mobile?844:980}});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    if(options.sourceStub)await page.addInitScript(() => {
      const realFetch=window.fetch.bind(window);
      window.fetch=(input,init)=>{
        const url=typeof input==="string"?input:input.url;
        if(url.includes("/api/crafting/blueprint-sources/index")){
          return Promise.resolve(new Response(JSON.stringify({blueprintGuids:["fake-verified-blueprint-id"]}),{
            status:200,headers:{"content-type":"application/json"}
          }));
        }
        return realFetch(input,init);
      };
    });
    await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForTimeout(800);
    if(check)await check(page);
    await page.screenshot({path:path.join(out,name+".png")});
    assert.deepEqual(errors,[],name+" JS errors");
    console.log("PASS "+name);
    await context.close();
  }
  await visit("crafting","/industry/crafting",async p=>{
    assert.equal(await p.locator(".craft-v31-pane-heading").count(),0);
    assert.equal(await p.locator(".craft-v31-filter-pane, .craft-browser-production-pane, .craft-browser-detail-pane").count(),3);
    const row=p.locator(".craft-v31-recipe-row").filter({hasText:"JS-300"}).first();
    assert.ok(await row.count());
    await row.click(); await p.waitForTimeout(500);
    assert.match(p.url(),/preview=/);
    const button=p.locator(".craft-v31-hero-queue").first();
    assert.ok(await button.count());
    // The local fixture Service Worker has no source API, so availability stays unknown.
    if (await button.isDisabled()) {
      assert.match(await button.innerText(), /Preview Only/i);
      assert.ok(await p.locator(".craft-blueprint-availability").count());
    }
  },{sourceStub:true});
  await visit("inventory","/logistics/inventory",async p=>{
    assert.equal(await p.locator(".logi-inv-v31-pane-heading").count(),0);
    assert.equal(await p.locator(".logi-inv-workspace-location-rail, .logi-inv-workspace-lots, .logi-inv-workspace-inspector").count(),3);
    assert.ok(await p.locator(".logi-inv-v31-location-art").count());
    assert.ok(await p.locator('[data-testid="inventory-warehouse-overview"]').count());
    await p.getByRole("button",{name:/Pyro Gateway \(Nyx\)/}).first().click();
    assert.match(await p.locator(".logi-inv-workspace-lots-heading").innerText(),/Pyro Gateway/);
  });
  await visit("build","/logistics/build-queue",async p=>{
    assert.equal(await p.locator(".bq-v31-panel-heading, .bq-summary-head").count(),0);
    assert.ok(await p.locator(".bq-queue-selector").count());
    assert.ok(await p.getByRole("button",{name:/Collapse queue ledger|Close queue ledger/}).count());
    assert.ok(await p.locator(".bq-craft-card-drop-slot").count());
  });
  await visit("fitting","/fitting",async p=>{
    assert.equal(await p.locator(".fm-v31-heading").count(),0);
    assert.ok(await p.locator(".fit-v31-offline-workspace, .fm-v31-shell").count());
    assert.ok(await p.locator(".breaker-topbar").count());
    assert.equal(await p.locator(".fm-v31-appbar, .fit-v31-offline-rail").count(), 0);
  });
  for(const [name,route] of [["crafting-mobile","/industry/crafting"],["inventory-mobile","/logistics/inventory"],["build-mobile","/logistics/build-queue"],["fitting-mobile","/fitting"]]){
    await visit(name,route,null,{mobile:true});
  }
  await visit("home","/dashboard");
  await browser.close();
  console.log("ALL_SMOKE_CHECKS_PASSED");
})().catch(e=>{console.error(e);process.exit(1)});
