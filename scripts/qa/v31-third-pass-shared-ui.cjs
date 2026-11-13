const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.BREAKER_URL||"http://127.0.0.1:5173";
const routes=[
 ["Crafting","/industry/crafting", ".craft-browser-v31-workspace"],
 ["Inventory","/logistics/inventory",".logi-inv-workspace"],
 ["Build Queue","/logistics/build-queue",".bq-v31-workspace"],
 ["Fitting","/fitting",".fit-v31-offline-workspace"],
];
(async()=>{
 const browser=await chromium.launch({headless:true});
 let cases=0;
 try {
 for (const width of [1440,1600,1200,390]) {
   const height=width===390?844:900;
   for(const [name,route,rootSelector] of routes) {
     const page=await browser.newPage({viewport:{width,height}}),errors=[];
     page.on("pageerror",e=>errors.push(e.message));
     try {
      await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForSelector(rootSelector,{timeout:30000});
      await page.waitForTimeout(700);
      const x=await page.evaluate(sel=>{
       const rect=(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
       return {
        root:rect(sel),top:rect(".breaker-topbar"),documentWidth:document.documentElement.scrollWidth,
        panels:document.querySelectorAll("[data-workspace-panel]").length,
        tabs:document.querySelectorAll("[data-workspace-tabs]").length,
        metrics:document.querySelectorAll("[data-workspace-metrics]").length,
        craftFilter:rect(".craft-v31-filter-pane"),craftIndex:rect(".craft-browser-production-pane"),craftLab:rect(".craft-browser-detail-pane"),
        inventoryLeft:rect(".logi-inv-workspace-location-rail"),inventoryRight:rect(".logi-inv-workspace-inspector"),
        queueLeft:rect(".bq-queue-col"),queueRight:rect(".bq-summary-col"),
        fittingLeft:rect(".fit-v31-offline-left"),fittingRight:rect(".fit-v31-offline-right"),
        heading:document.querySelectorAll(".ws-region-heading,.bq-v31-panel-heading,.craft-v31-pane-heading,.logi-inv-v31-pane-heading,.fm-v31-heading").length,
        statGrid:(()=>{const e=document.querySelector(".craft-detail-drawer-stats .craft-statistics-cards");return e?getComputedStyle(e).gridTemplateColumns:null})()
       };
      },rootSelector);
      assert.deepEqual(errors,[],name+" page errors");
      assert.equal(x.heading,0,name+" numbered headings");
      assert.ok(x.panels>=1,name+" needs shared panel");
      assert.ok(x.documentWidth<=width,name+" horizontal page overflow");
      if(name==="Crafting"&&width===1440) {
       assert.ok(Math.abs(x.craftFilter.w-260)<=1,"Crafting sidebar V31b width");
       assert.ok(Math.abs(x.craftIndex.w-325)<=1,"Crafting index V31b width");
       assert.ok(x.craftLab.w>=780,"Quality Laboratory must have room");
      }
      if(name==="Crafting"&&width===1200) {
       assert.ok(x.craftLab.y>=x.craftIndex.y+x.craftIndex.h-2,"Laptop laboratory stacks underneath index");
      }
      if(name==="Inventory"&&width>=1440) {
       assert.equal(x.inventoryRight.y,x.inventoryLeft.y,"Inventory inspector same desktop row");
       assert.ok(Math.abs(x.inventoryRight.w-315)<=2,"Inventory inspector V31b width");
      }
      if(name==="Build Queue"&&width>=1440) {
       assert.ok(Math.abs(x.queueLeft.w-280)<=2,"Queue left V31b width");
       assert.ok(x.queueRight.w>=450,"Sourcing column wide enough");
      }
      if(name==="Fitting"&&width>=1440){
       assert.ok(Math.abs(x.fittingLeft.w-210)<=2,"Fitting left side width");
       assert.ok(Math.abs(x.fittingRight.w-315)<=2,"Fitting inspector width");
      }
      console.log("PASS "+name+" "+width+" : panels="+x.panels+" tabs="+x.tabs+" metrics="+x.metrics);
      cases++;
     }finally{await page.close();}
   }
 }
 }finally{await browser.close();}
 console.log("ALL_THIRD_PASS_CASES_PASSED "+cases);
})().catch(e=>{console.error(e);process.exitCode=1});
