// Regression: operational pages share the Mining full-bleed Breaker shell.
// Run with the local fixtures server listening on BREAKER_URL (default :5173).
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.BREAKER_URL || "http://127.0.0.1:5173";
const routes = [
  ["Mining", "/industry/mining"],
  ["Crafting", "/industry/crafting"],
  ["Inventory", "/logistics/inventory"],
  ["Build Queue", "/logistics/build-queue"],
  ["Fitting", "/fitting"],
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1600, 390]) {
      const height = width === 390 ? 844 : 980;
      for (const [name, route] of routes) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForSelector(".app-page-shell--workspace", { timeout: 30000 });
          await page.waitForTimeout(450);
          const geometry = await page.evaluate(() => {
            const bounds = (selector) => {
              const element = document.querySelector(selector);
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            };
            const shell = document.querySelector(".app-page-shell--workspace");
            return {
              topBar: bounds(".breaker-topbar"),
              shell: bounds(".app-page-shell--workspace"),
              padding: shell && getComputedStyle(shell).padding,
              numberedHeaders: document.querySelectorAll(".ws-region-heading, .craft-v31-pane-heading, .logi-inv-v31-pane-heading, .bq-v31-panel-heading, .bq-summary-head, .fm-v31-heading").length,
              fittingExtraNav: document.querySelectorAll(".fm-v31-appbar, .fit-v31-offline-rail").length,
              documentWidth: document.documentElement.scrollWidth,
              mobileQueue: bounds(".bq-queue-col"),
            };
          });
          assert.deepEqual(errors, [], name + " JavaScript errors");
          assert.ok(geometry.topBar, name + " missing Breaker topbar");
          assert.equal(Math.round(geometry.topBar.height), 48, name + " topbar height");
          assert.equal(Math.round(geometry.shell.x), width > 699 ? 66 : 0, name + " shell left edge");
          assert.equal(Math.round(geometry.shell.y), 48, name + " shell top edge");
          assert.equal(Math.round(geometry.shell.width), width > 699 ? width - 66 : width, name + " shell width");
          assert.equal(geometry.padding, "0px", name + " outer gutter");
          assert.ok(geometry.documentWidth <= width, name + " horizontal document overflow");
          if (name === "Fitting") {
            assert.equal(geometry.fittingExtraNav, 0, "Fitting duplicate navigation");
          }
          assert.equal(geometry.numberedHeaders, 0, name + " redundant numbered panel headers");
          if (name === "Build Queue" && width === 390) {
            assert.ok(geometry.mobileQueue.x + geometry.mobileQueue.width <= 390,
              "Queue header exceeds mobile viewport");
          }
          console.log("PASS shell " + name + " " + width);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log("ALL_UNIFIED_SHELL_CHECKS_PASSED");
})().catch(error => { console.error(error); process.exitCode = 1; });
