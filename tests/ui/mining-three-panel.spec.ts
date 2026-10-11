import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const browserPath = "/industry/mining";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "mining-three-panel");

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openMining(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => localStorage.removeItem("moonbreaker:mining-location-panel-v1"));
  await page.goto(browserPath, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
}

test("keeps the desktop Mining list on truthful persisted notches without page overflow", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await openMining(page, 1920, 1080);

  const shell = page.locator(".mining-shell");
  const spine = page.getByRole("separator", { name: "Resize ranked locations panel" });
  const diamond = page.getByRole("button", { name: /Collapse ranked locations|Restore ranked locations/ });
  await expect(spine).toBeVisible();
  await expect(shell).toHaveClass(/mining-shell--location-standard/);
  await expect(page.locator(".mlist-item").first()).toHaveClass(/mlist-item--standard/);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "after-standard-1920x1080.png") });

  await diamond.click();
  await expect(shell).toHaveClass(/mining-shell--location-collapsed/);
  await expect(page.locator(".mlist-item").first()).toHaveClass(/mlist-item--collapsed/);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "after-collapsed-1920x1080.png") });

  await diamond.click();
  await expect(shell).toHaveClass(/mining-shell--location-standard/);
  await spine.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(shell).toHaveClass(/mining-shell--location-compact/);
  await page.screenshot({ path: path.join(screenshotDir, "after-compact-1920x1080.png") });
  await page.keyboard.press("ArrowRight");
  await expect(shell).toHaveClass(/mining-shell--location-standard/);
  await page.keyboard.press("ArrowRight");
  await expect(shell).toHaveClass(/mining-shell--location-expanded/);
  await page.screenshot({ path: path.join(screenshotDir, "after-expanded-1920x1080.png") });
  await page.keyboard.press("ArrowLeft");
  await expect(shell).toHaveClass(/mining-shell--location-standard/);

  const box = await spine.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const dragY = box.y + 64;
  await page.mouse.move(box.x + (box.width / 2), dragY);
  await page.mouse.down();
  await page.mouse.move(box.x + 190, dragY);
  await page.mouse.up();
  await expect(shell).toHaveClass(/mining-shell--location-expanded/);
  const collapsedBox = await spine.boundingBox();
  expect(collapsedBox).not.toBeNull();
  if (!collapsedBox) return;
  await page.mouse.move(collapsedBox.x + (collapsedBox.width / 2), collapsedBox.y + 64);
  await page.mouse.down();
  await page.mouse.move(collapsedBox.x - 500, collapsedBox.y + 64);
  await page.mouse.up();
  await expect(shell).toHaveClass(/mining-shell--location-collapsed/);

  const resetBox = await spine.boundingBox();
  expect(resetBox).not.toBeNull();
  if (!resetBox) return;
  await page.mouse.dblclick(resetBox.x + (resetBox.width / 2), resetBox.y + 64);
  await expect(shell).toHaveClass(/mining-shell--location-standard/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(shell).toHaveClass(/mining-shell--location-standard/);
  await expectNoDocumentOverflow(page);
});

test("keeps the mobile filter sheet and location detail flow free of the desktop spine", async ({ page }) => {
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
    if (isThreePanelDesktop) {
      await expect(page.getByRole("separator", { name: "Resize ranked locations panel" })).toBeVisible();
    } else {
      await expect(page.getByRole("separator", { name: "Resize ranked locations panel" })).toBeHidden();
    }
    if (viewport.width <= 760) await expect(page.locator(".mining-mobile-filter-trigger")).toBeVisible();
    await expect(page.locator(".mining-location-panel")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `after-${viewport.width}x${viewport.height}.png`) });
  }
});
