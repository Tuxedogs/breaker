import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const browserPath = "/industry/crafting";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "crafting-mobile-approved");

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test("matches the approved phone browse, filter, material, art, and detail flow", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });

  for (const viewport of [
    { name: "375x812", width: 375, height: 812 },
    { name: "393x852", width: 393, height: 852 },
    { name: "430x932", width: 430, height: 932 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
    await expect(page.locator(".crb2-mobile-card").first()).toBeVisible();
    await expect(page.locator(".crb2-table").first()).toBeHidden();
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `browse-${viewport.name}.png`) });

    const filterTrigger = page.getByRole("button", { name: /^Filters/ });
    await filterTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Recipe filters" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Category" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Materials" })).toBeVisible();
    if (viewport.width === 393) {
      await page.screenshot({ path: path.join(screenshotDir, "filters-open-393x852.png") });
    }

    const materialSearch = dialog.getByRole("searchbox", { name: "Search materials" });
    await materialSearch.fill("Tungsten");
    await dialog.locator(".crb2-material-option", { hasText: "Tungsten" }).click();
    await dialog.getByRole("button", { name: /Show .* results/ }).click();
    await expect(page).toHaveURL(/(?:\?|&)mt=/);
    await expect(page.locator(".crb2-mobile-card").first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    if (viewport.width === 393) {
      await page.screenshot({ path: path.join(screenshotDir, "material-filter-active-393x852.png") });
    }

    await filterTrigger.click();
    await dialog.getByRole("button", { name: "Clear filters" }).click();
    await dialog.getByRole("button", { name: "QT", exact: true }).click();
    await dialog.getByRole("button", { name: "1", exact: true }).click();
    await dialog.getByRole("button", { name: "Civilian", exact: true }).click();
    await dialog.getByRole("button", { name: /Show .* results/ }).click();

    const atlasCard = page.locator(".crb2-mobile-card", { hasText: "Atlas" });
    await expect(atlasCard).toBeVisible();
    await expect(atlasCard.locator("img")).toHaveAttribute(
      "src",
      "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp",
    );
    if (viewport.width === 393) {
      await page.screenshot({ path: path.join(screenshotDir, "representative-art-results-393x852.png") });
    }
    await atlasCard.click();
    await expect(page).toHaveURL(/\/industry\/crafting\/17b29a33-88fe-484f-bb9b-fbf780273ff5/);
    await expect(page.locator(".craft-detail-title")).toContainText("Atlas");
    await expect(page.locator(".craft-detail-hero-icon")).toHaveAttribute(
      "src",
      "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp",
    );
    await expect(page.getByRole("button", { name: /Save Atlas/ })).toBeVisible();
    await expect(page.locator(".craft-summary-queue-btn")).toBeVisible();
    await expect(page.locator(".craft-detail-material-row").first()).toBeAttached();
    await expect(page.locator(".detail-stat-groups--scannable")).toBeAttached();
    await expect(page.locator(".craft-detail-sources-section")).toBeAttached();

    const mobileOrder = await page.evaluate(() => {
      const materials = document.querySelector(".craft-detail-crafting")?.getBoundingClientRect().top ?? 0;
      const stats = document.querySelector(".craft-detail-summary-section")?.getBoundingClientRect().top ?? 0;
      return { materials, stats };
    });
    expect(mobileOrder.materials).toBeLessThan(mobileOrder.stats);
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `detail-atlas-${viewport.name}.png`) });

    if (viewport.width === 393) {
      await page.locator(".craft-detail-sources-section").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(screenshotDir, "detail-sources-393x852.png") });
    }
  }
});

test("keeps the table presentation at tablet and desktop widths", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  for (const viewport of [
    { name: "768x900", width: 768, height: 900 },
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "3840x2160", width: 3840, height: 2160 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".crb2-table").first()).toBeVisible();
    await expect(page.locator(".crb2-mobile-results").first()).toBeHidden();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `stable-${viewport.name}.png`) });
  }
});
