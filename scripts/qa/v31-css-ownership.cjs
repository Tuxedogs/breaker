// Prevent future decorative override stacks from becoming a migration strategy.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const postcss=require('postcss');
const surfaces=[
'src/components/industry/crafting/craft-v31-layout.css',
'src/components/logistics/build-v31-layout.css',
'src/components/logistics/inventory-v31-layout.css',
'src/components/fitting/mockup/fitting-v31-layout.css',
];
const parse=name=>postcss.parse(fs.readFileSync(name,'utf8'),{from:name});
for(const name of surfaces){
 const root=parse(name);const owners=new Map(),duplicate=[];
 let important=0,rules=0;
 root.walkRules(rule=>{
   rules++;
   let ctx=[];for(let p=rule.parent;p&&p.type!=='root';p=p.parent){if(p.type==='atrule')ctx.push(p.name+' '+p.params)}
   const key=ctx.reverse().join('|')+'|'+rule.selector;
   if(owners.has(key))duplicate.push(key+' lines '+owners.get(key)+','+rule.source.start.line);
   owners.set(key,rule.source.start.line);
   rule.walkDecls(decl=>{if(decl.important)important++});
 });
 assert.deepEqual(duplicate,[],name+' must not repeat selectors within the same breakpoint');
 assert.equal(important,0,name+' must not rely on important overrides');
 console.log('PASS unique V31 CSS ownership',name,rules+' rules');
}
// Shared mobile view logic is an explicit shell state, never an important cascade fight.
const mobileRules=parse('src/components/shared/workspace-mobile-nav.css');
let mobileImportant=0;
mobileRules.walkDecls(decl=>{if(decl.important)mobileImportant++});
assert.equal(mobileImportant,0,'Mobile navigation must not add important overrides');
console.log('PASS mobile shell views have no important overrides');

// Legacy controls can retain their internal styling, but not a chain of
// overridden duplicate declarations for the same selector and breakpoint.
for(const legacyFile of [
 'src/components/industry/crafting/recipe-browser.css',
 'src/components/industry/crafting/components/crafting-detail-refactor.css',
 'src/components/logistics/build-queue.css',
 'src/components/logistics/inventory.css',
]){
 const root=parse(legacyFile);
 const seen=new Map(),dupes=[];
 root.walkRules(rule=>{
  const ctx=[];for(let n=rule.parent;n&&n.type!=='root';n=n.parent)if(n.type==='atrule')ctx.push(n.name+' '+n.params);
  const key=ctx.reverse().join('|')+'|'+rule.selector;
  const previouslySeen=seen.get(key)||new Set();
  const next=new Set(previouslySeen);
  for(const decl of rule.nodes){
   if(decl.type!=='decl')continue;
   // The same-rule fallback declaration is intentional; check only later rules.
   if(previouslySeen.has(decl.prop))dupes.push(rule.selector+' / '+decl.prop);
   next.add(decl.prop);
  }
  seen.set(key,next);
 });
 assert.deepEqual(dupes,[],legacyFile+' has shadowed declarations from later presentation passes');
 console.log('PASS legacy control CSS has no duplicate property declarations',legacyFile);
}
const craft=fs.readFileSync('src/components/industry/crafting/components/ComponentRecipeTable.tsx','utf8');
assert.ok(craft.includes('className="craft-v31-workbench-hero"'));
assert.ok(craft.includes('className="craft-v31-workbench-content"'));
assert.ok(!craft.includes('className="craft-detail-drawer-header"'));
assert.ok(!craft.includes('className="craft-detail-drawer-body"'));
console.log('PASS Crafting structural components use V31-only classes');
const craftFilter=fs.readFileSync('src/components/industry/crafting/components/CraftingFilterBar.tsx','utf8');
const v31Styles=fs.readFileSync('src/components/industry/crafting/craft-v31-layout.css','utf8');
assert.ok(craftFilter.includes('className="craft-v31-material-filter-panel"'));
assert.ok(v31Styles.includes('.craft-v31-material-filter-panel'));
assert.ok(!v31Styles.includes('.crb2-toolbar--sidebar'),'Retired sidebar styling must not return in V31 CSS');
assert.ok(craftFilter.includes('craft-v31-primary-filters'),'Additional filters must remain the visible primary facet UI');
assert.ok(craftFilter.includes('craft-v31-material-disclosure'),'Materials must be collapsible');
assert.ok(craftFilter.includes('mining-filter-chip--material source-index-chip'),'Crafting must use Mining chip classes');
const miningCss=fs.readFileSync('src/components/industry/mining/mining-source-chips.css','utf8');
const sharedChipCss=fs.readFileSync('src/components/shared/resource-filter-chip.css','utf8');
assert.ok(!miningCss.includes('.mining-filter-chip--material.source-index-chip{'),'Mining must not duplicate shared chip CSS');
assert.ok(sharedChipCss.includes('.mining-filter-chip--material.source-index-chip'),'Shared chip CSS missing');
assert.ok(fs.readFileSync('src/components/industry/mining/MiningPage.tsx','utf8').includes('resource-filter-chip.css'),'Mining must load shared chip CSS');
console.log('PASS Crafting sidebar markup and CSS use V31-only ownership');
const craftList=fs.readFileSync('src/components/industry/crafting/components/ComponentResultsBrowser.tsx','utf8');
assert.ok(craftList.includes('craft-v31-material-chips'));
assert.ok(!craftList.includes('RankedMaterialCoverageChip'),'Custom ranked chips should not be rendered in Crafting');
assert.ok(!craftList.includes('RECIPE_SUPPLEMENTAL_MATERIAL_ACCENTS'),'Remove invented material palette');
assert.ok(!craftList.includes('--craft-material-accent'),'Remove CSS property invented for badges');
assert.ok(!v31Styles.includes('--craft-material-accent'),'Remove color-mixed material accents');
assert.ok(!v31Styles.includes('.craft-v31-material-chip.has-accent'),'Remove bespoke accent badges');
console.log('PASS Crafting pre-accent badges restored; no custom ranking or supplemental palette');


const build=fs.readFileSync('src/pages/logistics/BuildQueuePage.tsx','utf8');
assert.ok(build.includes('bq-v31-workspace'));
assert.ok(!build.includes('bq-layout'));
const legacy=parse('src/components/logistics/build-queue.css');
let oldLayoutRules=0;
legacy.walkRules(rule=>{if(rule.selectors.some(sel=>/\.bq-layout(?:\b|--)/.test(sel)))oldLayoutRules++});
assert.equal(oldLayoutRules,0,'Legacy Build Queue stylesheet must not define active V31 layout');
console.log('PASS Build Queue layout owned by V31 stylesheet; obsolete layout selectors removed');
const oldInventory=parse('src/components/logistics/inventory.css');
let legacyInventoryRoots=0;
oldInventory.walkRules(rule=>{
 if(rule.selector.trim()==='.logi-inv-page .logi-inv-workspace')legacyInventoryRoots++;
});
assert.equal(legacyInventoryRoots,0,'Inventory root layout must not remain in legacy stylesheet');
const inventoryV31=parse('src/components/logistics/inventory-v31-layout.css');
let newInventoryRoots=0;
inventoryV31.walkRules(rule=>{
 if(rule.selector.trim()==='.logi-inv-page .logi-inv-workspace')newInventoryRoots++;
});
assert.ok(newInventoryRoots>=1);
console.log('PASS Inventory core workspace layout has V31-only CSS ownership');
console.log('ALL_CSS_OWNERSHIP_CHECKS_PASSED');
