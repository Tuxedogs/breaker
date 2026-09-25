import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const browserPath = "/industry/crafting";
const AD5B_ID = "ba842720-ad32-4d53-8f56-992bacb1fc45";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "crafting-production-migration");

function installFailureGuards(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/Download the React DevTools|favicon\.ico/i.test(message.text())) return;
    failures.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  return failures;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function selectAd5b(page: Page) {
  await page.getByRole("searchbox", { name: "Search components" }).fill("AD5B");
  const row = page.locator(".crb2-table tbody tr", { hasText: "AD5B Ballistic Gatling" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`preview=${AD5B_ID}`));
  await expect(page.locator(".craft-detail-drawer-title")).toHaveAttribute(
    "aria-label",
    /AD5B Ballistic Gatling/,
  );
}

test.describe("Crafting production browser migration", () => {
  test("uses explicit faceted state and preserves filters through detail lifecycle", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();

    const vehicleWeapons = page.getByRole("button", { name: "Vehicle Weapons", exact: true }).first();
    await expect(vehicleWeapons).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("No Results", { exact: true })).toHaveCount(0);

    await page.goto(`${browserPath}?v=not-a-category&sz=99`, { waitUntil: "domcontentloaded" });
    await expect(vehicleWeapons).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("No Results", { exact: true })).toHaveCount(0);

    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
    await vehicleWeapons.click();
    await page.getByRole("button", { name: "FPS Weapons", exact: true }).first().click();
    await expect(vehicleWeapons).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "FPS Weapons", exact: true }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(new RegExp(`${browserPath}$`));
    await selectAd5b(page);
    await page.getByRole("button", { name: "5", exact: true }).first().click();
    await expect(page).toHaveURL(/(?:\?|&)sz=5(?:&|$)/);

    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/preview=/);
    await expect(page).toHaveURL(/(?:\?|&)sz=5(?:&|$)/);

    await page.getByRole("searchbox", { name: "Search components" }).fill("AD5B");
    await expect(page).not.toHaveURL(/(?:\?|&)pg=/);
    await selectAd5b(page);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(new RegExp(`preview=${AD5B_ID}`));
    await expect(page).not.toHaveURL(/(?:\?|&)(?:search|v|f|sz|gr|cl|mt|bk|pg)=/);
    expect(failures).toEqual([]);
  });

  test("renders the wide spine, dynamic trace, and Inspection Bay", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(browserPath, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("crafting-inspection-bay")).toBeVisible();
    await expect(page.getByTestId("crafting-center-spine")).toHaveAttribute("data-trace-active", "false");
    await selectAd5b(page);
    await expect(page.getByTestId("crafting-center-spine")).toHaveAttribute("data-trace-active", "true");
    await expect.poll(() => page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".crb2-table-row--selected")?.getBoundingClientRect();
      const trace = document.querySelector<HTMLElement>(".craft-browser-spine-trace")?.getBoundingClientRect();
      if (!row || !trace) return Number.POSITIVE_INFINITY;
      return Math.abs((row.top + row.height / 2) - (trace.top + trace.height / 2));
    })).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "Shield", exact: true }).first().click();
    await expect(page.locator(".craft-detail-drawer-title")).toHaveAttribute("aria-label", /AD5B/);
    await expect(page.getByTestId("crafting-center-spine")).toHaveAttribute("data-trace-active", "false");

    await page.getByRole("button", { name: /Close AD5B Ballistic Gatling.*detail/ }).click();
    await expect(page.getByTestId("crafting-inspection-bay")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select a component" })).toBeVisible();
    await expectNoDocumentOverflow(page);
    expect(failures).toEqual([]);
  });

  test("keeps the canonical detail tabs, sliders, sources, and queue action intact", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${browserPath}?search=AD5B&preview=${AD5B_ID}`, { waitUntil: "domcontentloaded" });

    const drawer = page.locator(".craft-detail-drawer-shell");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".craft-detail-hero-artwork")).toHaveAttribute(
      "src",
      /behr-ballistic-gatling-s5\.webp$/,
    );

    await page.getByRole("tab", { name: "Materials", exact: true }).click();
    const materialRow = drawer.locator(".craft-detail-material-row").first();
    await expect(materialRow).toBeVisible();
    await expect(materialRow.locator(".bq-target-quality")).toBeVisible();
    await expect(materialRow.locator(".bq-target-quality-slider")).toBeVisible();

    await page.getByRole("tab", { name: "Statistics", exact: true }).click();
    await expect(drawer.locator(".craft-statistics-cards")).toBeVisible();

    await page.getByRole("tab", { name: "Sources", exact: true }).click();
    await expect(drawer.locator(".craft-detail-drawer-sources")).toBeVisible();

    const queueButton = drawer.getByRole("button", { name: "Add to Queue", exact: true });
    await expect(queueButton).toBeVisible();
    await queueButton.click();
    await expect(drawer.locator(".craft-summary-queue-btn.is-active")).toBeVisible();
    expect(failures).toEqual([]);
  });

  test("uses classification columns and the existing filter sheet in the compact split", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${browserPath}?search=AD5B&preview=${AD5B_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.locator(".craft-browser-production-pane")).toBeVisible();
    await expect(page.locator(".craft-browser-detail-pane")).toBeVisible();
    await expect(page.getByTestId("crafting-center-spine")).toBeHidden();
    await expect(page.getByTestId("crafting-production-workspace")).toHaveClass(/compact-split/);
    await expect.poll(() => page.locator(".dash-sidebar").evaluate((sidebar) => (
      Math.round(sidebar.getBoundingClientRect().width)
    ))).toBe(40);
    await expect(page.locator(".crb2-table--compact")).toBeVisible();
    expect(await page.locator(".crb2-table--compact thead th").allTextContents()).toEqual([
      "Component↕",
      "Size↕",
      "Grade / Class↕",
    ]);
    await expect(page.locator(".crb2-table--compact")).not.toContainText("Projectile Speed");
    const compactGeometry = await page.locator(".craft-browser-production-workspace--compact-split").evaluate((workspace) => {
      const browser = workspace.querySelector<HTMLElement>(".craft-browser-production-pane");
      const detail = workspace.querySelector<HTMLElement>(".craft-browser-detail-pane");
      const componentColumn = workspace.querySelector<HTMLElement>(".crb2-table--compact thead th:first-child");
      const sizeColumn = workspace.querySelector<HTMLElement>(".crb2-table--compact thead th:nth-child(2)");
      const gradeClassColumn = workspace.querySelector<HTMLElement>(".crb2-table--compact thead th:nth-child(3)");
      const table = workspace.querySelector<HTMLElement>(".crb2-table--compact");
      const tableViewport = table?.parentElement;
      const selectedName = workspace.querySelector<HTMLElement>(".crb2-table-row--selected .crb2-row-name");
      if (!browser || !detail || !componentColumn || !sizeColumn || !gradeClassColumn || !table || !tableViewport || !selectedName) throw new Error("Compact split geometry is incomplete");
      return {
        browserWidth: browser.getBoundingClientRect().width,
        detailWidth: detail.getBoundingClientRect().width,
        tableWidth: table.getBoundingClientRect().width,
        tableViewportWidth: tableViewport.getBoundingClientRect().width,
        componentWidth: componentColumn.getBoundingClientRect().width,
        selectedNameFits: selectedName.scrollWidth <= selectedName.clientWidth,
        sizeStartsAfterComponent: Math.round(sizeColumn.getBoundingClientRect().left - componentColumn.getBoundingClientRect().right),
        gradeClassEndsInsideBrowser: Math.round(gradeClassColumn.getBoundingClientRect().right - browser.getBoundingClientRect().right),
      };
    });
    expect(compactGeometry.detailWidth / compactGeometry.browserWidth).toBeGreaterThanOrEqual(1.8);
    expect(Math.round(compactGeometry.tableWidth)).toBe(Math.round(compactGeometry.tableViewportWidth));
    expect(compactGeometry.selectedNameFits).toBe(true);
    expect(compactGeometry.sizeStartsAfterComponent).toBeLessThanOrEqual(1);
    expect(compactGeometry.gradeClassEndsInsideBrowser).toBeLessThanOrEqual(0);

    const filterTrigger = page.getByRole("button", { name: /^Filters/ });
    await expect(filterTrigger).toBeVisible();
    await filterTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Recipe filters" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Materials" })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "compact-split-filters-1024x768.png") });
    await dialog.getByRole("button", { name: /Show .* results/ }).click();
    await expect(dialog).toBeHidden();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, "compact-split-1024x768.png") });

    await page.setViewportSize({ width: 1180, height: 768 });
    const wideCompactGeometry = await page.locator(".craft-browser-production-workspace--compact-split").evaluate((workspace) => {
      const browser = workspace.querySelector<HTMLElement>(".craft-browser-production-pane");
      const detail = workspace.querySelector<HTMLElement>(".craft-browser-detail-pane");
      if (!browser || !detail) throw new Error("Compact split panes are incomplete");
      return detail.getBoundingClientRect().width / browser.getBoundingClientRect().width;
    });
    expect(wideCompactGeometry).toBeGreaterThanOrEqual(2.2);
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, "compact-split-1180x768.png") });

    expect(failures).toEqual([]);
  });

  test("preserves the recovered mobile detail and returns to the filtered browser", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto(`${browserPath}?search=AD5B&preview=${AD5B_ID}`, { waitUntil: "domcontentloaded" });

    const detail = page.locator(".craft-detail-drawer-shell");
    await expect(detail).toBeVisible();
    await expect(page.locator(".craft-detail-drawer-mobile-back")).toBeVisible();
    await expect(detail.getByRole("tab")).toHaveCount(4);

    await detail.getByRole("tab", { name: "Materials", exact: true }).click();
    await expect(detail.locator(".craft-detail-material-row").first()).toBeVisible();
    await expect(detail.locator(".bq-target-quality-slider").first()).toBeVisible();
    await detail.getByRole("tab", { name: "Statistics", exact: true }).click();
    await expect(detail.locator(".craft-statistics-cards")).toBeVisible();
    await detail.getByRole("tab", { name: "Sources", exact: true }).click();
    await expect(detail.locator(".craft-detail-sources-section")).toBeVisible();

    await page.locator(".craft-detail-drawer-mobile-back").click();
    await expect(page.locator(".craft-browser-production-pane")).toBeVisible();
    await expect(page.locator(".craft-browser-detail-pane")).toBeHidden();
    await expect(page).toHaveURL(/(?:\?|&)search=AD5B(?:&|$)/);
    await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
    expect(failures).toEqual([]);
  });

  test("keeps the phone, compact split, and wide split modes at their boundaries", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "980x900", width: 980, height: 900 },
      { name: "981x900", width: 981, height: 900 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "1180x900", width: 1180, height: 900 },
      { name: "1599x1000", width: 1599, height: 1000 },
      { name: "1600x1000", width: 1600, height: 1000 },
      { name: "1680x945", width: 1680, height: 945 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "390x844", width: 390, height: 844 },
      { name: "430x932", width: 430, height: 932 },
      { name: "760x900", width: 760, height: 900 },
      { name: "761x900", width: 761, height: 900 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(browserPath, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("crafting-production-workspace")).toBeVisible();
      await expectNoDocumentOverflow(page);

      if (viewport.width <= 760) {
        await expect(page.locator(".crb2-mobile-results").first()).toBeVisible();
        await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
      } else {
        await expect(page.locator(".crb2-table").first()).toBeVisible();
      }

      await page.goto(`${browserPath}?search=AD5B&preview=${AD5B_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".craft-detail-drawer-shell")).toBeVisible();
      if (viewport.width >= 1600) {
        await expect(page.locator(".craft-browser-production-pane")).toBeVisible();
        await expect(page.getByTestId("crafting-center-spine")).toBeVisible();
      } else if (viewport.width >= 981) {
        await expect(page.locator(".craft-browser-production-pane")).toBeVisible();
        await expect(page.locator(".craft-browser-detail-pane")).toBeVisible();
        await expect(page.getByTestId("crafting-center-spine")).toBeHidden();
        await expect(page.getByTestId("crafting-production-workspace")).toHaveClass(/compact-split/);
      } else {
        await expect(page.locator(".craft-browser-production-pane")).toBeHidden();
        await expect(page.getByTestId("crafting-center-spine")).toBeHidden();
      }
      await expectNoDocumentOverflow(page);

      await page.screenshot({
        path: path.join(screenshotDir, `selected-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });
});
