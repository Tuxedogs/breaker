const assert=require("node:assert/strict");
const{chromium}=require("playwright");
const base=process.env.BREAKER_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [kind,width,height]of [["desktop",1440,900],["mobile",390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base+"/industry/crafting",{waitUntil:"domcontentloaded"});
   await page.locator(".craft-v31-recipe-row").first().waitFor({state:"attached",timeout:25000});
   if(kind==="mobile")await page.locator(".workspace-mobile-nav__tabs button").nth(1).click();
   await page.waitForTimeout(750);
   const metrics=await page.evaluate(()=>{
    const list=document.querySelector(".craft-v31-recipe-list");
    const rows=[...document.querySelectorAll(".craft-v31-recipe-row")];
    const marks=[...document.querySelectorAll(".craft-v31-recipe-mark")];
    const images=[...document.querySelectorAll(".craft-v31-recipe-mark img")];
    const badges=[...document.querySelectorAll(".craft-v31-material-chips > span")];
    const listStyle=getComputedStyle(list),rowStyle=getComputedStyle(rows[0]),firstBadge=getComputedStyle(badges[0]),thumbStyle=getComputedStyle(marks[0]);
    const imageFit=images.every(i=>{const a=i.getBoundingClientRect(),b=i.parentElement.getBoundingClientRect();return a.left>=b.left-.5&&a.right<=b.right+.5&&a.top>=b.top-.5&&a.bottom<=b.bottom+.5});
    return{
     rows:rows.length,badges:badges.length,badgeNames:badges.slice(0,9).map(b=>b.innerText),
     rankedBadges:document.querySelectorAll(".craft-v31-recipe-row .mining-coverage-chip").length,
     customAccent:document.querySelectorAll(".craft-v31-material-chip,.craft-v31-material-chip.has-accent").length,
     badgeStyle:{font:firstBadge.font,padding:firstBadge.padding,color:firstBadge.color,background:firstBadge.backgroundColor,border:firstBadge.borderColor},
     thumbnailStage:[marks[0].getBoundingClientRect().width,marks[0].getBoundingClientRect().height],thumbnailBg:thumbStyle.backgroundColor,thumbnailBorder:thumbStyle.borderTopWidth,
     images:images.length,loaded:images.filter(i=>i.complete&&i.naturalWidth>0).length,failed:images.filter(i=>i.complete&&!i.naturalWidth).length,
     imageFit,
     listPadding:listStyle.padding,rowPadding:rowStyle.padding,
     listBackground:listStyle.backgroundColor,rowBackground:rowStyle.backgroundColor,
     overflow:document.documentElement.scrollWidth-innerWidth,
    };
   });
   assert.ok(metrics.rows>=8);
   assert.ok(metrics.badges>=30);
   assert.ok(metrics.badgeNames.some(n=>n.length>=6),"Original full material names should return");
   assert.equal(metrics.rankedBadges,0,"No Mining ranking badges in Crafting");
   assert.equal(metrics.customAccent,0,"No new custom-color badges in Crafting");
   assert.equal(metrics.listPadding,"8px 5px 12px","Less horizontal list padding");
   assert.equal(metrics.rowPadding,"8px 7px","Less row horizontal padding");
   assert.deepEqual(metrics.thumbnailStage,[64,64],"64x64 component images");
   assert.equal(metrics.thumbnailBg,"rgba(0, 0, 0, 0)","No orange thumbnail background");
   assert.equal(metrics.thumbnailBorder,"0px","No thumbnail border");
   assert.ok(metrics.images>=15&&metrics.loaded>=12&&metrics.failed===0&&metrics.imageFit,"Actual component images render inside larger frames");
   assert.equal(metrics.listBackground,"rgb(9, 23, 35)");
   assert.equal(metrics.rowBackground,"rgb(14, 32, 46)");
   assert.ok(metrics.overflow<=0,"No page horizontal overflow");
   assert.deepEqual(errors,[],"No browser errors");
   await page.screenshot({path:"tmp/pass10-crafting-"+kind+".jpg",type:"jpeg",quality:89});
   console.log("PASS "+kind+" old material labels, 64×64 transparent thumbs, tighter 5px list gutters",JSON.stringify(metrics));
   if(kind==="desktop"){
    await page.locator(".craft-v31-material-disclosure summary").click();
    await page.locator(".craft-v31-material-options .source-index-chip").filter({hasText:"Beryl"}).first().click();
    await page.waitForTimeout(450);
    const matches=page.locator(".craft-v31-recipe-row .craft-v31-material-chips .is-matching");
    assert.ok(await matches.count()>0,"Subtle original selected-material highlight preserved");
    const selectedStyle=await matches.first().evaluate(e=>getComputedStyle(e).backgroundColor);
    assert.equal(selectedStyle,"rgb(24, 64, 82)","Original selected chip background");
    assert.ok(new URL(page.url()).searchParams.has("mt"));
    console.log("PASS original selected-material highlight and recipe filtering",selectedStyle);
   }
   await page.close();
  }
  const mining=await browser.newPage({viewport:{width:1440,height:900}});
  await mining.goto(base+"/industry/mining",{waitUntil:"domcontentloaded"});
  await mining.locator(".mlist-panel").waitFor({state:"attached",timeout:25000});
  const selected=mining.locator("button.mining-filter-chip--material.source-index-chip").filter({hasText:"Stileron"});
  await selected.first().waitFor({state:"visible",timeout:25000});
  await selected.first().click();
  const chip=mining.locator(".mlist-item-coverage .mining-coverage-chip").filter({hasText:"Sti"}).first();
  await chip.waitFor({state:"attached",timeout:25000});
  assert.equal((await chip.innerText()).trim(),"Sti","Mining ranking list retains original abbreviations");
  console.log("PASS Mining ranking chips remain unchanged");
  await mining.close();
 }finally{await browser.close()}
 console.log("ALL_PASS10_BADGE_REVERT_THUMBNAIL_GUTTER_CHECKS_PASSED");
})().catch(e=>{console.error(e);process.exitCode=1});
