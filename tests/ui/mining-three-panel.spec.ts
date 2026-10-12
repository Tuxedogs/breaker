import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const browserPath = "/industry/mining";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "mining-ranked-list-refinement");

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openMining(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    const key = "mining-ranked-list-refinement:cleared";
    if (sessionStorage.getItem(key)) return;
    localStorage.removeItem("moonbreaker:mining-location-panel-v1");
    sessionStorage.setItem(key, "true");
  });
  await page.goto(browserPath, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
  await expect(page.locator(".mlist-item-thumb-img").first()).toBeVisible();
}

test("collapses only the method availability area and persists the chosen list state", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await openMining(page, 1920, 1080);

  const shell = page.locator(".mining-shell");
  const locations = page.locator(".mining-location-panel");
  const toggle = page.getByRole("button", { name: "Collapse ranked locations method availability" });
  const firstRecord = page.locator(".mlist-item").first();

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(firstRecord.locator(".mlist-item-thumb")).toBeVisible();
  await expect(firstRecord.locator(".mlist-item-body")).toBeVisible();
  await expect(firstRecord.locator(".mlist-item-coverage")).toBeVisible();
  await expect(firstRecord.locator(".mlist-method-availability")).toBeVisible();
  await expect(page.locator(".mlist-system-badge").first()).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize ranked locations panel" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "expanded-unfiltered-1920x1080.png") });

  await page.getByRole("button", { name: "Stanton", exact: true }).click();
  await expect(page.locator(".mlist-system-badge")).toHaveCount(0);

  await locations.locator(".mlist-items").evaluate((element) => {
    element.scrollTop = 84;
  });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(shell).toHaveClass(/mining-shell--locations-collapsed/);
  await expect(page.getByRole("button", { name: "Expand ranked locations method availability" })).toHaveAttribute("aria-expanded", "false");
  await expect(firstRecord.locator(".mlist-item-thumb")).toBeVisible();
  await expect(firstRecord.locator(".mlist-item-body")).toBeVisible();
  await expect(firstRecord.locator(".mlist-item-coverage")).toBeVisible();
  await expect(firstRecord.locator(".mlist-method-availability")).toBeHidden();
  expect(await locations.locator(".mlist-items").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "collapsed-system-selected-1920x1080.png") });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(shell).toHaveClass(/mining-shell--locations-collapsed/);
  await expect(page.getByRole("button", { name: "Expand ranked locations method availability" })).toHaveAttribute("aria-expanded", "false");
  await expectNoDocumentOverflow(page);
});

test("keeps the mobile filter sheet and location detail flow free of the desktop divider", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  for (const viewport of [
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 960 },
    { width: 768, height: 900 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 375, height: 812 },
  ]) {
    await openMining(page, viewport.width, viewport.height);
    const isThreePanelDesktop = viewport.width >= 1321;
    const toggle = page.getByRole("button", { name: "Collapse ranked locations method availability" });
    if (isThreePanelDesktop) await expect(toggle).toBeVisible();
    else await expect(toggle).toBeHidden();
    if (viewport.width <= 760) await expect(page.locator(".mining-mobile-filter-trigger")).toBeVisible();
    await expect(page.locator(".mining-location-panel")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `refined-${viewport.width}x${viewport.height}.png`) });
  }
});
