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

async function expectScrollOwner(page: Page, requireMovement = true) {
  const scrollOwner = page.locator(".crb2-results:visible, .craft-detail-page:visible");
  await expect(scrollOwner).toHaveCount(1);
  const metrics = await scrollOwner.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(metrics.overflowY).toBe("auto");
  if (!requireMovement) return;
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(420, element.scrollHeight - element.clientHeight);
  });
  await expect.poll(() => scrollOwner.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await scrollOwner.evaluate((element) => { element.scrollTop = 0; });
  await expect.poll(() => scrollOwner.evaluate((element) => element.scrollTop)).toBe(0);
}

async function captureStableDetailHeader(page: Page) {
  return page.locator(".craft-detail-stage").evaluate((stage) => {
    const selectors = [
      ".craft-detail-back-link",
      ".craft-detail-title",
      ".craft-detail-mobile-family",
      ".craft-detail-mobile-tabs",
    ];
    return selectors.map((selector) => {
      const box = stage.querySelector(selector)?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
    });
  });
}

async function expectActionsClearOfNavigation(page: Page) {
  const actionBox = await page.locator(".craft-detail-mobile-overview-actions:visible, .craft-detail-actions:visible").boundingBox();
  const fixtureBox = await page.locator('[data-fixture-mode="active"]').boundingBox();
  expect(actionBox).not.toBeNull();
  expect(fixtureBox).not.toBeNull();
  if (!actionBox || !fixtureBox) return;
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(fixtureBox.y + 1);
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
    const menuTrigger = page.getByRole("button", { name: "Open primary navigation" });
    await expect(menuTrigger).toBeVisible();
    await expect(page.locator(".dash-mobile-shell-brand")).toHaveText("SCINTEL");
    await expect(page.locator(".dash-mobile-auth-bar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Discord account|Sign in with Discord/ })).toHaveCount(0);
    await expect(page.locator(".dash-mobile-nav")).toHaveCount(0);
    await expect(page.locator(".crb2-mobile-card").first()).toBeVisible();
    await expect(page.locator(".crb2-table").first()).toBeHidden();
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `browse-${viewport.name}.png`) });

    await menuTrigger.click();
    const navigationDialog = page.getByRole("dialog", { name: "Primary navigation" });
    await expect(navigationDialog).toBeVisible();
    await expect(navigationDialog.getByRole("button", { name: "Close primary navigation" })).toBeFocused();
    await expect(navigationDialog.getByRole("link")).toHaveCount(7);
    expect(await navigationDialog.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
      "/dashboard",
      "/industry/crafting",
      "/industry/mining",
      "/fitting",
      "/logistics/build-queue",
      "/logistics/inventory",
      "/industry/blueprint-tracker",
    ]);
    await expect(navigationDialog.getByRole("link", { name: "Crafting" })).toHaveAttribute("aria-current", "page");
    await expect(navigationDialog.getByRole("button", { name: /Sign in with Discord|Open Discord account details/ })).toBeVisible();
    await expect(navigationDialog.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(navigationDialog.getByText("Thresholds", { exact: true })).toHaveCount(0);
    await expect(navigationDialog.getByText("Doctrine", { exact: true })).toHaveCount(0);
    await expect(navigationDialog.getByText("Component Viewer", { exact: true })).toHaveCount(0);
    if (viewport.width === 393) {
      await page.screenshot({ path: path.join(screenshotDir, "navigation-menu-open-393x852.png") });
    }
    await page.keyboard.press("Shift+Tab");
    await expect(navigationDialog.getByRole("button", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(navigationDialog.getByRole("button", { name: "Close primary navigation" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(navigationDialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveClass(/mobile-navigation-open/);

    await menuTrigger.click();
    await page.mouse.click(viewport.width - 8, Math.round(viewport.height / 2));
    await expect(navigationDialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveClass(/mobile-navigation-open/);
    await expectScrollOwner(page);

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
    await expect(page.locator("body")).not.toHaveClass(/mobile-filter-sheet-open/);
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
      await atlasCard.focus();
      await expect(atlasCard).toBeFocused();
      await page.screenshot({ path: path.join(screenshotDir, "selected-result-card-393x852.png") });
    }
    await atlasCard.click();
    await expect(page).toHaveURL(/\/industry\/crafting\/17b29a33-88fe-484f-bb9b-fbf780273ff5/);
    await expect(page.locator(".craft-detail-title")).toContainText("Atlas");
    await expect(page.locator(".craft-detail-hero-icon")).toHaveAttribute(
      "src",
      "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp",
    );
    await expect(page.getByRole("button", { name: /Save Atlas/ })).toBeVisible();
    await expect(page.locator(".craft-summary-queue-btn:visible")).toBeVisible();
    await expectActionsClearOfNavigation(page);
    const detailTabs = page.getByRole("tablist", { name: "Component detail sections" });
    await expect(detailTabs.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".craft-detail-mobile-overview")).toBeVisible();
    await expect(page.locator(".craft-detail-hero-card.crafting-component-art")).toBeHidden();
    const overviewArt = page.locator(".craft-detail-mobile-overview-art img");
    await expect(overviewArt).toHaveAttribute(
      "src",
      "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp",
    );
    expect((await overviewArt.boundingBox())?.width).toBeGreaterThan(180);
    await expect(page.locator(".craft-detail-mobile-overview-facts")).toContainText("Component Type");
    await expect(page.locator(".craft-detail-mobile-overview-facts")).toContainText("Family");
    await expect(page.locator(".craft-detail-mobile-overview-facts")).toContainText("Size");
    await expect(page.locator(".craft-detail-mobile-overview-facts")).toContainText("Grade");
    await expect(page.locator(".craft-detail-mobile-overview-facts")).toContainText("Class");
    await expect(page.locator(".craft-detail-mobile-overview-time")).toContainText("Craft Time");
    const overviewActions = await page.locator(".craft-detail-mobile-overview-actions .craft-summary-action-btn").evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    expect(overviewActions[1].top).toBeGreaterThan(overviewActions[0].bottom);
    const overviewHeader = await captureStableDetailHeader(page);
    await expectScrollOwner(page, false);
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `detail-overview-${viewport.name}.png`) });

    await detailTabs.getByRole("tab", { name: "Materials" }).click();
    expect(await captureStableDetailHeader(page)).toEqual(overviewHeader);
    await expect(page.locator(".craft-detail-title")).toBeInViewport();
    await expect(page.locator(".craft-detail-material-row").first()).toBeVisible();
    await expect(page.getByText(/Quality Required/i)).toHaveCount(0);
    await expect(page.locator(".craft-detail-material-row").first().locator(".bq-target-slider-marker").first()).toBeVisible();
    await expectScrollOwner(page);
    await page.screenshot({ path: path.join(screenshotDir, `detail-materials-${viewport.name}.png`) });

    await detailTabs.getByRole("tab", { name: "Statistics" }).click();
    expect(await captureStableDetailHeader(page)).toEqual(overviewHeader);
    await expect(page.locator(".craft-detail-title")).toBeInViewport();
    await expect(page.locator(".detail-stat-groups--scannable")).toBeVisible();
    await expectScrollOwner(page);
    await page.screenshot({ path: path.join(screenshotDir, `detail-statistics-${viewport.name}.png`) });

    if (viewport.width === 393) {
      await detailTabs.getByRole("tab", { name: "Sources" }).click();
      expect(await captureStableDetailHeader(page)).toEqual(overviewHeader);
      await expect(page.locator(".craft-detail-title")).toBeInViewport();
      await expect(page.locator(".craft-detail-sources-section")).toBeVisible();
      await expectScrollOwner(page, false);
      await page.screenshot({ path: path.join(screenshotDir, "detail-sources-mobile-nav-393x852.png") });
    }
  }
});

test("uses compact mobile model names without changing the canonical title", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/industry/crafting/ba842720-ad32-4d53-8f56-992bacb1fc45", { waitUntil: "domcontentloaded" });
  const title = page.locator(".craft-detail-title");
  await expect(title.locator(".craft-detail-mobile-title")).toHaveText("AD5B");
  const canonicalTitle = await title.getAttribute("title");
  expect(canonicalTitle).toContain("AD5B Ballistic Gatling");
  await expect(title).toHaveAttribute("aria-label", canonicalTitle ?? "AD5B Ballistic Gatling");
  await expect(page.locator(".craft-detail-mobile-overview-art img")).toHaveAttribute(
    "src",
    "/images/component-thumbnails/behr-ballistic-gatling-s5.webp",
  );
  await page.screenshot({ path: path.join(screenshotDir, "weapon-detail-mobile-393x852.png") });
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
    await expect(page.locator(".dash-mobile-shell-header")).toBeHidden();
    await expect(page.locator(".crb2-table").first()).toBeVisible();
    await expect(page.locator(".crb2-mobile-results").first()).toBeHidden();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `stable-${viewport.name}.png`) });

    await page.goto("/industry/crafting/17b29a33-88fe-484f-bb9b-fbf780273ff5", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".craft-detail-hero")).toBeVisible();
    await expect(page.locator(".craft-detail-mobile-tabs")).toBeHidden();
    await expect(page.locator(".craft-detail-material-row").first()).toBeVisible();
    await expect(page.locator(".craft-detail-summary-section")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `stable-detail-${viewport.name}.png`) });

    await page.goto("/industry/crafting/ba842720-ad32-4d53-8f56-992bacb1fc45", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".craft-detail-hero-card img")).toHaveAttribute(
      "src",
      "/images/component-thumbnails/behr-ballistic-gatling-s5.webp",
    );
    await page.screenshot({ path: path.join(screenshotDir, `weapon-detail-desktop-${viewport.name}.png`) });
  }
});
