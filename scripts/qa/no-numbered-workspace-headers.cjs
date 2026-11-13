const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const root=process.env.BREAKER_URL||"http://127.0.0.1:5173";
const routes=[
["Mining","/industry/mining"],
["Crafting","/industry/crafting"],
["Inventory","/logistics/inventory"],
["Build Queue","/logistics/build-queue"],
["Fitting","/fitting"],
["Legacy Fitting Terminal","/fitting-v2"],
["Refinery Planner","/industry/refinery"]
];
(async()=>{
let b=await chromium.launch({headless:true});
try{
for(let width of [1600,390]){
for(let [name,route] of routes){
 let p=await b.newPage({viewport:{width,height:width===390?844:980}}),errors=[];
 p.on("pageerror",e=>errors.push(e.message));
 await p.goto(root+route,{waitUntil:"domcontentloaded",timeout:30000});
 await p.waitForTimeout(750);
 let x=await p.evaluate(()=>({headers:document.querySelectorAll(".craft-v31-pane-heading,.logi-inv-v31-pane-heading,.bq-v31-panel-heading,.bq-summary-head,.fm-v31-heading,.fit-v31-pane-heading,.rp-panel-heading,.ws-region-heading").length,title:document.title,refineryControls:document.querySelectorAll(".rp-target-actions button").length,refineryYield:document.querySelectorAll(".rp-yield-callout--standalone").length}));
 assert.equal(x.headers,0,name+" "+width+" still renders numbered headers");
 assert.deepEqual(errors,[],name+" JS errors");
 console.log("PASS "+name+" no numbered workspace headers at "+width);
 if(name==="Build Queue"&&width===1600){
   let btn=p.getByRole("button",{name:"Collapse queue ledger"});
   assert.equal(await btn.count(),1,"Ledger collapse still available");
   await btn.click();
   assert.equal(await p.getByRole("button",{name:"Open queue ledger"}).count(),1,"Ledger can reopen");
   await p.getByRole("button",{name:"Open queue ledger"}).click();
   assert.equal(await p.getByRole("button",{name:"Collapse queue ledger"}).count(),1,"Ledger can collapse again");
   console.log("PASS ledger collapse/reopen");
 }
 if(name==="Refinery Planner"&&x.refineryControls){
   assert.equal(x.refineryYield,1,"Refinery yield formula preserved");
   console.log("PASS refinery context and control");
 }
 await p.close();
}
}
}finally{await b.close()}
console.log("ALL_NUMBERED_HEADER_REMOVAL_CHECKS_PASSED");
})().catch(e=>{console.error(e);process.exitCode=1});
