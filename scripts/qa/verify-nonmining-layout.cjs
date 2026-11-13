const { chromium }=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true});
for(const [name,route,selector] of [['craft','/industry/crafting','.craft-v31-pane-heading'],['inventory','/logistics/inventory','.logi-inv-v31-pane-heading'],['queue','/logistics/build-queue','.bq-v31-panel-heading'],['fitting','/fitting','.fm-v31-heading']]){
 const page=await browser.newPage({viewport:{width:1600,height:980}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173'+route,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(1200);
 const found=await page.locator(selector).count();
 const headers=await page.locator(selector).allInnerTexts();
 await page.screenshot({path:'tmp/v31-smoke/verified-'+name+'.png',fullPage:true});
 console.log(JSON.stringify({name,route,found,headers,errors,title:await page.title(),bodyText:(await page.locator('body').innerText()).slice(0,150)}));
 await page.close();
}
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});