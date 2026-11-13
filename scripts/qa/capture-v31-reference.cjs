const { chromium } = require('playwright');
const path=require('path'); const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out=path.join(process.cwd(),'tmp','v31-reference');fs.mkdirSync(out,{recursive:true});
 const source='file:///'+path.join(process.cwd(),'Breaker_V31b_Responsive_Motion.html').replace(/\\/g,'/');
 for(const name of ['craft','build','inventory','fitting']){
   const page=await browser.newPage({viewport:{width:1600,height:980},deviceScaleFactor:1});
   page.on('pageerror',e=>console.log('JSERROR',name,e.message.slice(0,150)));
   await page.goto(source,{waitUntil:'load'});
   await page.locator('[data-open="'+name+'"]').click();
   await page.waitForTimeout(450);
   const stats=await page.evaluate(()=>({
     page:document.body.dataset.reviewPage,
     hero:document.querySelector('.hero')?.getBoundingClientRect().toJSON(),
     panels:Array.from(document.querySelectorAll('#feature-workspace > .feature-panel')).map(e=>({box:e.getBoundingClientRect().toJSON(),title:e.querySelector('.f-title,.region-label')?.textContent?.trim()?.slice(0,110),text:e.innerText.slice(0,180)})),
     body:document.body.innerText.slice(0,350)
   }));
   console.log('REFERENCE',name,JSON.stringify(stats).slice(0,2200));
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});
   await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});