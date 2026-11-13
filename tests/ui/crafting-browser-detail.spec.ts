import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const browserPath = "/industry/crafting";
const detailPath = "/industry/crafting/1a85280e-7b8f-4486-a563-17cd2549d268";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "crafting-browser-refactor");

function isIgnorableUrl(url: string): boolean {
  return /supabase\.co|vercel|speed-insights|\/api\/user\/|favicon\.ico/i.test(url);
}

function installFailureGuards(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Download the React DevTools|favicon\.ico/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (isIgnorableUrl(request.url())) return;
    if (/ERR_ABORTED/i.test(request.failure()?.errorText ?? "")) return;
    failures.push(
      `request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim(),
    );
  });
  page.on("response", (response) => {
    if (response.status() < 400 || isIgnorableUrl(response.url())) return;
    failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return failures;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Crafting browser and detail refactor", () => {
  test("keeps compact and wide selected detail panes as comparison peers", async ({ page }) => {
    await mkdir(screenshotDir, { recursive: true });
    const previewId = "ba842720-ad32-4d53-8f56-992bacb1fc45";

    for (const viewport of [
      { name: "1599x1000", width: 1599, height: 1000 },
      { name: "1600x1000", width: 1600, height: 1000 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${browserPath}?preview=${previewId}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
      await expect(page.locator(".craft-detail-drawer-region")).toBeVisible();
      await expectNoDocumentOverflow(page);

      const results = page.locator(".craft-browser-production-pane .crb2-results");
      if (viewport.width <= 980) {
        await expect(results).toBeHidden();
        await page.screenshot({
          path: path.join(screenshotDir, `single-detail-boundary-${viewport.name}.png`),
          fullPage: true,
        });
        continue;
      }

      await expect(results).toBeVisible();
      const geometry = await page.evaluate(() => {
        const toolbar = document.querySelector<HTMLElement>(".crb2-toolbar")?.getBoundingClientRect();
        const resultList = document.querySelector<HTMLElement>(".craft-browser-production-pane .crb2-results")?.getBoundingClientRect();
        const drawer = document.querySelector<HTMLElement>(".craft-detail-drawer-region")?.getBoundingClientRect();
        return {
          toolbarLeft: Math.round(toolbar?.left ?? 0),
          toolbarWidth: Math.round(toolbar?.width ?? 0),
          toolbarBottom: Math.round(toolbar?.bottom ?? 0),
          resultsLeft: Math.round(resultList?.left ?? 0),
          resultsTop: Math.round(resultList?.top ?? 0),
          drawerLeft: Math.round(drawer?.left ?? 0),
          drawerTop: Math.round(drawer?.top ?? 0),
          drawerWidth: Math.round(drawer?.width ?? 0),
        };
      });

      expect(geometry.resultsLeft).toBe(geometry.toolbarLeft);
      expect(geometry.resultsTop).toBeGreaterThanOrEqual(geometry.toolbarBottom);
      expect(geometry.drawerTop).toBeLessThanOrEqual(geometry.resultsTop);
      expect(geometry.drawerLeft).toBeGreaterThanOrEqual(geometry.toolbarLeft + geometry.toolbarWidth);
      const leftShare = geometry.toolbarWidth / (geometry.toolbarWidth + geometry.drawerWidth);
      expect(leftShare).toBeGreaterThan(viewport.width < 1600 ? 0.2 : 0.51);
      expect(leftShare).toBeLessThan(viewport.width < 1600 ? 0.4 : 0.54);

      await page.screenshot({
        path: path.join(screenshotDir, `peer-detail-${viewport.name}.png`),
        fullPage: true,
      });
    }
  });

  test("presents the premium drawer header and preserves every source-backed detail tab", async ({ page }) => {
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${browserPath}?preview=ba842720-ad32-4d53-8f56-992bacb1fc45`, { waitUntil: "domcontentloaded" });

    const drawer = page.locator(".craft-detail-drawer-shell");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".craft-v31-lab-art img")).toHaveAttribute(
      "src",
      /behr-ballistic-gatling-s5\.webp$/,
    );

    await page.getByRole("tab", { name: "Materials" }).click();
    const materialRow = drawer.locator(".craft-detail-material-row").first();
    await expect(materialRow.locator(".craft-detail-material-slot")).not.toHaveText("");
    await expect(materialRow.locator(".craft-detail-material-id strong")).not.toHaveText("");
    await expect(materialRow.locator(".bq-target-quality")).toBeVisible();
    await expect(materialRow.locator(".bq-target-slider-marker")).not.toHaveCount(0);
    await expect(materialRow.locator(".craft-detail-material-required")).toHaveText(/\d/);
    await expect(materialRow.locator(".craft-detail-effect-chip").first()).toBeVisible();

    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(drawer.locator(".craft-detail-drawer-overview")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "crafting-drawer-overview-1920x1080.png"), fullPage: true });

    await page.getByRole("tab", { name: "Statistics" }).click();
    await expect(drawer.locator(".craft-detail-drawer-stats")).toBeVisible();
    await expect(drawer.locator(".craft-statistics-cards")).toBeVisible();

    await page.getByRole("tab", { name: "Sources" }).click();
    await expect(drawer.locator(".craft-detail-drawer-sources")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "crafting-drawer-sources-1920x1080.png"), fullPage: true });
  });

  test("keeps Vehicle Weapons and table columns constrained to their canonical data", async ({ page }) => {
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${browserPath}?v=weaponGun`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".crb2-table-section").filter({ hasText: "Vehicle Weapons" })).toBeVisible();
    await expect(page.locator(".crb2-table tbody tr").filter({ hasText: "AD5B Ballistic Gatling" })).toBeVisible();
    await expect(page.locator(".crb2-table tbody tr").filter({ hasText: "Arbor MHV Mining Laser" })).toHaveCount(0);

    const tableGeometry = await page.locator(".crb2-table").evaluate((table) => {
      const headerCells = Array.from(table.querySelectorAll("thead th"));
      const rowCells = Array.from(table.querySelectorAll("tbody tr:first-child > *"));
      const header = headerCells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { left: Math.round(rect.left), width: Math.round(rect.width) };
      });
      const row = rowCells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { left: Math.round(rect.left), width: Math.round(rect.width) };
      });
      return { header, row };
    });
    expect(tableGeometry.header).toEqual(tableGeometry.row);
    expect(tableGeometry.header[0].width).toBeGreaterThan(tableGeometry.header[1].width * 2);
    expect(tableGeometry.header[4].width).toBeLessThan(tableGeometry.header[0].width);

    await page.screenshot({
      path: path.join(screenshotDir, "recipe-browser-table-filter-polish-1920x1080.png"),
      fullPage: true,
    });

    await page.goto(`${browserPath}?v=weaponGun&search=arbor`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("No craftable components match the current search and filters.")).toBeVisible();

    await page.goto(`${browserPath}?v=weaponGun&sz=2`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();
    const sizes = await page.locator(".crb2-table tbody tr > td:first-of-type").allTextContents();
    expect(sizes).not.toHaveLength(0);
    expect(sizes.every((size) => size.trim() === "2")).toBe(true);

    await page.goto(`${browserPath}?v=weaponGun&search=greatsword`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.locator(".crb2-table tbody tr").filter({ hasText: "AD5B Ballistic Gatling" })).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
  });

  test("renders the permanent filter rail, stable selection, dense tables, and empty state", async ({ page }) => {
    const failures = installFailureGuards(page);
    const measurements: Array<Record<string, string | number>> = [];
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "1180x900", width: 1180, height: 900 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(browserPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
      // No page header: the shell supplies a visually hidden h1 and the browser fills the height.
      await expect(page.getByRole("heading", { level: 1, name: "Crafting" })).toHaveCount(1);
      await expect(page.locator(".recipe-browser-command-header")).toHaveCount(0);
      await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();
      const usesFilterSheet = await page.getByRole("button", { name: /^Filters/ }).isVisible();
      if (usesFilterSheet) await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(page.locator(".crb2-hero")).toHaveCount(0);
      await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();

      const filterText = (await page.locator(".crb2-filter-rail").innerText()).toLowerCase();
      for (const label of [
        "Materials",
        "Vehicle Weapons",
        "Size",
        "Grade",
        "Class",
        "Competition",
        "Power Plant",
        "Shield",
        "Cooler",
        "Radar",
        "QT",
        "Mining",
        "Salvage",
        "Other",
        "FPS Weapons",
        "Armor",
        "Utility",
      ]) {
        expect(filterText).toContain(label.toLowerCase());
      }
      await expect(page.getByRole("button", { name: /Utility 0/, exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "5", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "6", exact: true })).toBeVisible();

      if (!usesFilterSheet) await page.getByRole("button", { name: /^Materials/ }).click();
      await expect(page.getByRole("searchbox", { name: "Search materials" })).toBeVisible();
      expect(await page.locator(".crb2-material-option").count()).toBeGreaterThanOrEqual(30);
      await page.screenshot({
        path: path.join(screenshotDir, `recipe-browser-materials-${viewport.name}.png`),
        fullPage: true,
      });
      await page.getByRole("searchbox", { name: "Search materials" }).fill("iron");
      await expect(page.locator(".crb2-material-option")).toHaveCount(1);
      await expect(page.locator(".crb2-material-option").first()).toContainText("Iron");
      if (!usesFilterSheet) await page.keyboard.press("Escape");

      if (usesFilterSheet) await page.getByRole("dialog", { name: "Recipe filters" }).getByRole("button", { name: /Show .* results/ }).click();
      await page.getByRole("searchbox", { name: "Search components" }).fill("AD5B");
      const selectedWeaponRow = page.locator(".crb2-table tbody tr").filter({
        hasText: /AD5B Ballistic Gatling/,
      });
      await expect(selectedWeaponRow).toBeVisible();
      await selectedWeaponRow.click();
      if (viewport.width >= 1600) {
        await expect(page.locator(".craft-v31-lab-title")).toHaveText("AD5B");
        await expect(page.locator(".craft-v31-lab-title")).toHaveAttribute(
          "aria-label",
          /AD5B Ballistic Gatling/,
        );
      } else {
        await expect(page.locator(".craft-v31-lab-title")).toHaveAttribute("aria-label", /AD5B Ballistic Gatling/);
      }

      await expectNoDocumentOverflow(page);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        const results = document.querySelector<HTMLElement>(".crb2-results");
        const table = document.querySelector<HTMLElement>(".crb2-table-scroll");
        if (results) results.scrollTop = 0;
        if (table) table.scrollLeft = 0;
      });
      const geometry = await page.evaluate(() => {
        const hero = document.querySelector(".crb2-hero");
        const table = document.querySelector(".crb2-table-scroll");
        return {
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          heroWidth: Math.round(hero?.getBoundingClientRect().width ?? 0),
          tableOverflow: Math.max(0, (table?.scrollWidth ?? 0) - (table?.clientWidth ?? 0)),
          resultRows: document.querySelectorAll(".crb2-table tbody tr").length,
        };
      });
      measurements.push(geometry);

      await page.screenshot({
        path: path.join(screenshotDir, `recipe-browser-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${browserPath}?f=weapons&search=CQ7`, { waitUntil: "domcontentloaded" });
    const preferredSearchRow = page.locator(".crb2-table tbody tr").first();
    await expect(preferredSearchRow).toContainText("CQ7 Rifle");
    await expect(preferredSearchRow).not.toContainText("Magazine");

    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Vehicle Weapons", exact: true }).first().click();
    const dpsSort = page.getByRole("button", { name: /^DPS/ }).first();
    await dpsSort.click();
    await expect(dpsSort).toContainText("↓");
    await dpsSort.click();
    await expect(dpsSort).toContainText("↑");

    await page.evaluate(() => {
      const results = document.querySelector<HTMLElement>(".crb2-results");
      if (results) results.scrollTop = 520;
    });
    const stickyHeaderGeometry = await page.evaluate(() => {
      const tableScroll = document.querySelector(".crb2-table-scroll");
      const header = document.querySelector(".crb2-table thead th");
      return {
        tableTop: tableScroll?.getBoundingClientRect().top ?? 0,
        headerTop: header?.getBoundingClientRect().top ?? 0,
      };
    });
    expect(Math.abs(stickyHeaderGeometry.headerTop - stickyHeaderGeometry.tableTop)).toBeLessThanOrEqual(2);

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "1180x900", width: 1180, height: 900 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(browserPath, { waitUntil: "domcontentloaded" });
      await page.getByRole("searchbox", { name: "Search components" }).fill("no-matching-component-record");
      await expect(page.locator(".crb2-browser-state")).toContainText("No Results");
      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `recipe-browser-empty-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await writeFile(
      path.join(screenshotDir, "crafting-browser-measurements.json"),
      `${JSON.stringify(measurements, null, 2)}\n`,
      "utf8",
    );
    expect(failures).toEqual([]);
  });

  test("renders raw quality controls, extracted ticks, and source-backed estimated FPS effects", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "768x900", width: 768, height: 900 },
      { name: "430x932", width: 430, height: 932 },
      { name: "375x812", width: 375, height: 812 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(detailPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".craft-detail-stage")).toBeVisible();
      await expect(page.locator(".craft-v31-lab-title")).toContainText("CQ7");
      await page.getByRole("tab", { name: "Materials" }).click();

      const firstSlider = page.locator(".craft-detail-material-target-input input[type='range']").first();
      await expect(firstSlider).toHaveAttribute("min", "1");
      await expect(firstSlider).toHaveAttribute("max", "1000");
      await expect(firstSlider).not.toHaveAttribute("step", /^(?!1$).+/);
      expect(await page.locator(".craft-detail-material-row").first().locator(".bq-target-slider-marker").count())
        .toBeGreaterThanOrEqual(8);

      await firstSlider.fill("723");
      await expect(page.locator(".craft-detail-material-target-input .bq-target-quality").first()).toHaveText("723");
      const firstMaterialCard = page.locator(".craft-detail-material-row").first();
      await expect(firstMaterialCard).not.toContainText("Target quality");
      await expect(firstMaterialCard.locator(".bq-material-icon, .craft-detail-material-icon")).toHaveCount(0);
      await expect(firstMaterialCard.locator(".craft-detail-material-required")).toHaveText(/\d/);
      await expect(firstMaterialCard).not.toContainText(/Available Quality|Available/);
      const sliderAlignment = await firstMaterialCard.evaluate((card) => {
        const slider = card.querySelector<HTMLInputElement>(".bq-target-quality-slider");
        const bubble = card.querySelector<HTMLElement>(".bq-target-quality");
        const geometry = card.querySelector<HTMLElement>("[data-slider-geometry='true']");
        if (!slider || !bubble || !geometry) return null;
        const sliderBox = slider.getBoundingClientRect();
        const bubbleBox = bubble.getBoundingClientRect();
        const geometryBox = geometry.getBoundingClientRect();
        const thumbSize = Number.parseFloat(getComputedStyle(slider).getPropertyValue("--slider-thumb-size"));
        const min = Number(slider.min);
        const max = Number(slider.max);
        const range = Math.max(1, max - min);
        const positionFor = (value: number) => geometryBox.left + ((value - min) / range) * geometryBox.width;
        return {
          bubbleDelta: Math.abs((bubbleBox.left + bubbleBox.width / 2) - positionFor(Number(slider.value))),
          inputStartDelta: Math.abs((sliderBox.left + thumbSize / 2) - geometryBox.left),
          inputEndDelta: Math.abs((sliderBox.right - thumbSize / 2) - geometryBox.right),
          markerDeltas: Array.from(card.querySelectorAll<HTMLElement>(".bq-target-slider-marker")).map((marker) => {
            const value = Number(marker.textContent);
            const markerBox = marker.getBoundingClientRect();
            return Math.abs((markerBox.left + markerBox.width / 2) - positionFor(value));
          }),
        };
      });
      expect(sliderAlignment).not.toBeNull();
      expect(sliderAlignment?.bubbleDelta).toBeLessThanOrEqual(2);
      expect(sliderAlignment?.inputStartDelta).toBeLessThanOrEqual(1);
      expect(sliderAlignment?.inputEndDelta).toBeLessThanOrEqual(1);
      expect(Math.max(...(sliderAlignment?.markerDeltas ?? []))).toBeLessThanOrEqual(2);
      await expect(page.locator(".craft-detail-material-table-head")).toContainText("Material");
      await expect(page.locator(".craft-detail-material-row").first()).not.toContainText("Band");
      await expect(page.locator('.craft-detail-material-id strong[title="Hephaestanite"]')).toBeVisible();
      const effects = page.locator(".craft-detail-effects-panel");
      await expect(effects).toContainText("Alpha Damage");
      await expect(effects).toContainText("Fire Rate");
      await expect(effects.locator(".craft-detail-effect-row").first()).toBeVisible();
      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-cq7-${viewport.name}.png`),
        fullPage: true,
      });


    }

    expect(failures).toEqual([]);
  });

  test("keeps the material target bubble, thumb travel, and direct editor synchronized", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".craft-v31-lab-title")).toContainText("CQ7");

    const card = page.locator(".craft-detail-material-row").first();
    const slider = card.locator(".bq-target-quality-slider");
    const bubble = card.getByRole("button", { name: /Edit target quality/ });
    const geometry = card.locator("[data-slider-geometry='true']");
    await expect.poll(() => card.locator(".bq-target-slider-marker").count()).toBeGreaterThanOrEqual(8);

    await slider.fill("500");
    await expect(bubble).toHaveText("500");

    await bubble.click();
    const editor = card.getByRole("spinbutton", { name: /Edit target quality/ });
    await editor.fill("723");
    await editor.press("Enter");
    await expect(slider).toHaveValue("723");

    await card.getByRole("button", { name: /Edit target quality/ }).click();
    await editor.fill("5000");
    await editor.press("Enter");
    await expect(slider).toHaveValue("1000");

    await slider.fill("500");
    const bubbleBox = await card.getByRole("button", { name: /Edit target quality/ }).boundingBox();
    const geometryBox = await geometry.boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(geometryBox).not.toBeNull();
    if (bubbleBox && geometryBox) {
      await page.mouse.move(bubbleBox.x + bubbleBox.width / 2, bubbleBox.y + bubbleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(geometryBox.x + geometryBox.width, bubbleBox.y + bubbleBox.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await expect(slider).toHaveValue("1000");
    await expect(card.getByRole("spinbutton", { name: /Edit target quality/ })).toHaveCount(0);

    await slider.fill("500");
    const touchBubbleBox = await card.getByRole("button", { name: /Edit target quality/ }).boundingBox();
    const touchGeometryBox = await geometry.boundingBox();
    expect(touchBubbleBox).not.toBeNull();
    expect(touchGeometryBox).not.toBeNull();
    if (touchBubbleBox && touchGeometryBox) {
      const touchX = touchBubbleBox.x + touchBubbleBox.width / 2;
      const touchY = touchBubbleBox.y + touchBubbleBox.height / 2;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: touchX, y: touchY }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: touchGeometryBox.x, y: touchY }],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }
    await expect(slider).toHaveValue("1");
    await expect(card.getByRole("spinbutton", { name: /Edit target quality/ })).toHaveCount(0);
    await expect(card.locator(".craft-detail-material-required")).toHaveText(/\d/);
    await expect(card.locator(".craft-detail-effect-chip").first()).toBeVisible();
    await expectNoDocumentOverflow(page);

    for (const width of [700, 600, 500, 430, 375]) {
      await page.setViewportSize({ width, height: 900 });
      if (!(await card.isVisible())) {
        await page.getByRole("tab", { name: "Materials" }).click();
      }
      for (const target of [1, 500, 1000]) {
        await slider.fill(String(target));
        const delta = await card.evaluate((element) => {
          const currentBubble = element.querySelector<HTMLElement>(".bq-target-quality");
          const currentSlider = element.querySelector<HTMLInputElement>(".bq-target-quality-slider");
          const currentGeometry = element.querySelector<HTMLElement>("[data-slider-geometry='true']");
          if (!currentBubble || !currentSlider || !currentGeometry) return Number.POSITIVE_INFINITY;
          const bubbleRect = currentBubble.getBoundingClientRect();
          const geometryRect = currentGeometry.getBoundingClientRect();
          const min = Number(currentSlider.min);
          const max = Number(currentSlider.max);
          const ratio = (Number(currentSlider.value) - min) / Math.max(1, max - min);
          const expectedCenter = geometryRect.left + geometryRect.width * ratio;
          return Math.abs(bubbleRect.left + bubbleRect.width / 2 - expectedCenter);
        });
        expect(delta).toBeLessThanOrEqual(2);
      }
      await expect(card.locator(".craft-detail-material-required")).toBeVisible();
      await expect(card.locator(".craft-detail-effect-chip").first()).toBeVisible();
      await expectNoDocumentOverflow(page);
    }
    expect(failures).toEqual([]);
  });

  test("renders Insulative Liner's Aslarite requirement as an editable laboratory material card", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/industry/crafting/005d95db-96ca-45b7-9647-7e7537b8fac8", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".craft-detail-stage")).toBeVisible();
      await expect(page.locator(".craft-v31-lab-title")).toContainText("ADP-mk4 Arms Woodland");

      const aslarite = page.locator(".craft-v31-material", { hasText: "Aslarite" });
      await expect(aslarite).toHaveCount(1);
      await expect(aslarite).toContainText("INSULATIVE LINER");
      const slider = aslarite.getByRole("slider", { name: "Quality for Aslarite" });
      await expect(slider).toHaveCount(1);
      // Continuous domain: the delivered start of Band 1 (never a substituted 1) through 1000.
      const bandOneStart = (await aslarite.locator(".craft-v31-band-ticks button span").first().innerText()).trim();
      await expect(slider).toHaveAttribute("min", bandOneStart);
      await expect(slider).toHaveAttribute("max", "1000");
      await expect(aslarite.locator(".craft-v31-band-ticks button")).toHaveCount(8);
      await slider.focus();
      await slider.press("Home");
      await expect(slider).toHaveValue(bandOneStart);
      await slider.press("ArrowRight");
      await expect(slider).toHaveValue(String(Number(bandOneStart) + 1));
      await slider.press("End");
      await expect(slider).toHaveValue("1000");
      await slider.press("ArrowLeft");
      await expect(slider).toHaveValue("999");
      const exactQuality = aslarite.getByRole("spinbutton", { name: "Exact quality for Aslarite" });
      await exactQuality.fill("975");
      await exactQuality.press("Enter");
      await expect(exactQuality).toHaveValue("975");
      await expect(aslarite.locator(".craft-v31-band-ticks button[aria-pressed='true']")).toHaveCount(1);
      await expect(page.locator('[data-requirement-kind="part"]')).toHaveCount(0);

      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-insulative-liner-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });

  test("drags the material quality slider continuously across quantization markers", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/industry/crafting/005d95db-96ca-45b7-9647-7e7537b8fac8", { waitUntil: "domcontentloaded" });
    const aslarite = page.locator(".craft-v31-material", { hasText: "Aslarite" });
    const slider = aslarite.getByRole("slider", { name: "Quality for Aslarite" });
    const track = aslarite.locator(".craft-v31-quality-track");
    await expect(slider).toBeVisible();
    await track.scrollIntoViewIfNeeded();
    const box = await track.boundingBox();
    if (!box) throw new Error("quality track has no layout box");
    const min = Number(await slider.getAttribute("min"));
    const travel = box.width - 16;
    const xAt = (quality: number) => box.x + 8 + ((quality - min) / (1000 - min)) * travel;
    const y = box.y + box.height / 2;
    const qualityPerPx = (1000 - min) / travel;

    // Sweep through an interior quantization marker one pixel at a time
    // without releasing (markers come from the delivered band data).
    const markers = (await aslarite.locator(".craft-v31-band-ticks button span").allInnerTexts()).map(Number);
    const marker = markers[Math.floor(markers.length / 2)];
    const values: number[] = [];
    await page.mouse.move(xAt(marker - 40), y);
    await page.mouse.down();
    for (let x = xAt(marker - 40); x <= xAt(marker + 35); x += 1) {
      await page.mouse.move(x, y);
      values.push(Number(await slider.inputValue()));
    }
    await page.mouse.up();

    expect(values).toContain(marker);
    expect(values.some((value) => value > marker && value < marker + 10)).toBe(true);
    expect(values.some((value) => value < marker && value > marker - 10)).toBe(true);
    // The handle lingers on the marker (subtle magnet) but leaves it while dragging.
    expect(values.filter((value) => value === marker).length).toBeGreaterThan(1);
    expect(values.at(-1)).toBeGreaterThan(marker + 25);
    for (let index = 1; index < values.length; index += 1) {
      // Never moves backwards (no trap) and never leaps (no snap): the steepest
      // magnet slope is below 2 qualities per quality of pointer travel.
      expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]);
      expect(values[index] - values[index - 1]).toBeLessThanOrEqual(Math.ceil(qualityPerPx * 2) + 1);
    }
    // Releasing keeps the dragged value and the exact quality box follows it.
    await expect(aslarite.getByRole("spinbutton", { name: "Exact quality for Aslarite" })).toHaveValue(String(values.at(-1)));

    // Both ends of the continuous domain are reachable by pointer.
    const endBox = await track.boundingBox();
    if (!endBox) throw new Error("quality track has no layout box");
    await page.mouse.move(endBox.x + 1, endBox.y + endBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(slider).toHaveValue(String(min));
    await page.mouse.move(endBox.x + endBox.width - 1, endBox.y + endBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(slider).toHaveValue("1000");

    // 800 and Max use exact qualities; magnetic tick behavior remains separate.
    await page.getByRole("group", { name: "Material quality presets" }).getByRole("button", { name: "800" }).click();
    await expect(slider).toHaveValue("800");
    await page.getByRole("group", { name: "Material quality presets" }).getByRole("button", { name: "Max" }).click();
    await expect(slider).toHaveValue("1000");
  });

  test("organizes representative item families into Build Queue-style statistic groups", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    const itemFamilies = [
      {
        slug: "fps-weapon-cq7",
        id: "1a85280e-7b8f-4486-a563-17cd2549d268",
        title: "CQ7",
        groups: ["Damage Output", "Firing", "Projectile", "Accuracy and Spread", "Penetration", "Thermal and Power"],
      },
      {
        slug: "ship-weapon-ad5b",
        id: "ba842720-ad32-4d53-8f56-992bacb1fc45",
        title: "AD5B",
        groups: ["Damage Output", "Firing & Ammunition", "Ballistics", "Accuracy and Spread", "Thermal & Power", "Signature", "Durability & Repair"],
      },
      {
        slug: "shield-fr66",
        id: "db3f4c97-8d40-4b36-b397-452dea1594fc",
        title: "FR-66",
        groups: ["Shield Performance"],
      },
      {
        slug: "fps-armor-adp",
        id: "005d95db-96ca-45b7-9647-7e7537b8fac8",
        title: "ADP-mk4",
        groups: ["Environment"],
      },
      {
        slug: "quantum-atlas",
        id: "17b29a33-88fe-484f-bb9b-fbf780273ff5",
        title: "Atlas",
        groups: ["Quantum Travel"],
      },
      {
        slug: "cooler-snowblind",
        id: "9b4499d4-b54c-4eb9-b661-e65f3d0f501d",
        title: "SnowBlind",
        groups: ["Output"],
      },
      {
        slug: "power-js300",
        id: "9585b0dc-b660-4e2a-9136-0092af1e72c1",
        title: "JS-300",
        groups: ["Output"],
      },
    ];

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const item of itemFamilies) {
        await page.goto(`/industry/crafting/${item.id}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".craft-v31-lab-title")).toContainText(item.title);

        // All component stats render immediately in thin, noncollapsible groups.
        await expect(page.locator(".craft-detail-drawer-stats").getByRole("button", { name: /Show all statistics/ })).toHaveCount(0);
        const bands = page.locator(".craft-detail-drawer-stats .craft-v31-spec-bands");
        await expect(bands).toBeVisible();
        await expect(page.locator(".detail-stat-groups--scannable")).toHaveCount(0);
        await expect(bands.locator(".craft-v31-spec-metric").first()).toBeVisible();

        const groupTitles = await bands.locator(".craft-v31-spec-band h4").allTextContents();
        expect(groupTitles).toEqual(expect.arrayContaining(item.groups));
        if (item.slug === "ship-weapon-ad5b") expect(groupTitles.length).toBeGreaterThanOrEqual(7);

        const bandsOverflow = await bands.evaluate((element) => element.scrollWidth - element.clientWidth);
        expect(bandsOverflow).toBeLessThanOrEqual(1);
        await bands.evaluate((element) => element.scrollIntoView({ block: "start" }));
        await expectNoDocumentOverflow(page);
        await page.screenshot({
          path: path.join(screenshotDir, `crafting-stats-${item.slug}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  test("shows visible performance bands and modifier investigation in the wide drawer", async ({ page }) => {
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${browserPath}?preview=1a85280e-7b8f-4486-a563-17cd2549d268`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator(".craft-detail-drawer-region")).toBeVisible();

      const stats = page.locator(".craft-detail-drawer-stats");
      // Preserve the darker framed containers from the V31b Crafting mockup.
      await expect(page.locator(".craft-v31-material-list")).toHaveCSS("background-color", "rgb(12, 27, 40)");
      await expect(page.locator(".craft-v31-material-list")).toHaveCSS("border-top-width", "1px");
      await expect(stats.locator(".craft-v31-spec-bands")).toHaveCSS("background-color", "rgb(11, 26, 39)");
      await expect(stats.locator(".craft-v31-spec-bands")).toHaveCSS("border-top-width", "1px");
      // All rows visible by default. No show/hide buttons or accordion categories.
      await expect(stats.locator(".craft-v31-spec-bands")).toBeVisible();
      await expect(stats.getByRole("button", { name: /Show all statistics|Hide all statistics/ })).toHaveCount(0);
      await expect(stats.locator(".craft-v31-change-list")).toHaveCount(0);
      // Technical details sit in the collapsed details panel after acquisition.
      const details = page.locator(".craft-detail-drawer-overview");
      await expect(details.locator(".craft-v31-modifier-table")).toBeHidden();
      await details.getByText("Modifier details").click();
      await expect(details.locator(".craft-v31-modifier-table")).toBeVisible();
      await details.getByText("Component description").click();
      await expect(details.locator(".craft-detail-effects-panel")).toBeVisible();
      await expect(stats.locator(".craft-statistics-cards")).toHaveCount(0);
      await expect(stats.locator(".detail-stat-groups--scannable")).toHaveCount(0);
      const categories = stats.locator(".craft-v31-spec-band h4");
      expect(await categories.count()).toBeGreaterThanOrEqual(1);
      await expect(stats.locator(".craft-v31-spec-metric").first()).toBeVisible();
      const overflow = await stats.locator(".craft-v31-spec-bands").evaluateAll((wraps) =>
        wraps.map((wrap) => wrap.scrollWidth - wrap.clientWidth));
      expect(overflow.every((value) => value <= 1)).toBe(true);

      await page.screenshot({
        path: path.join(screenshotDir, `crafting-drawer-statistics-${viewport.name}.png`),
        fullPage: true,
      });
    }
  });

  test("reserves stable wide-screen drawer geometry and reveals completed detail without visible loading copy", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(browserPath, { waitUntil: "domcontentloaded" });

      const drawer = page.locator(".craft-detail-drawer-region");
      const results = page.locator(".crb2-results");
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveAttribute("aria-busy", "false");
      await expect(drawer.locator(".craft-detail-page")).toHaveCount(0);

      const initialGeometry = await page.evaluate(() => {
        const resultRegion = document.querySelector(".crb2-results")?.getBoundingClientRect();
        const drawerRegion = document.querySelector(".craft-detail-drawer-region")?.getBoundingClientRect();
        return {
          resultsLeft: resultRegion?.left ?? 0,
          resultsWidth: resultRegion?.width ?? 0,
          drawerLeft: drawerRegion?.left ?? 0,
          drawerWidth: drawerRegion?.width ?? 0,
        };
      });

      await page.screenshot({
        path: path.join(screenshotDir, `crafting-drawer-reserved-${viewport.name}.png`),
        fullPage: true,
      });

      await page.evaluate(() => {
        const observedLoadingCopy: string[] = [];
        const observer = new MutationObserver(() => {
          const bodyText = document.body.innerText;
          for (const copy of [
            "Loading component detail…",
            "Loading local quality quantization bands...",
          ]) {
            if (bodyText.includes(copy) && !observedLoadingCopy.includes(copy)) {
              observedLoadingCopy.push(copy);
            }
          }
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
        Object.assign(window, { __craftObservedLoadingCopy: observedLoadingCopy, __craftLoadingObserver: observer });
      });

      await page.getByRole("searchbox", { name: "Search components" }).fill("CQ7");
      const cq7Row = page.locator(".crb2-table tbody tr").filter({ hasText: "CQ7" }).first();
      await expect(cq7Row).toBeVisible();
      await cq7Row.click();
      await expect(drawer.locator(".craft-v31-lab-title")).toContainText("CQ7");
      await expect(drawer.getByRole("tab", { name: "Materials" })).toHaveAttribute("aria-selected", "true");
      await expect(drawer.locator(".craft-detail-material-row").first()).toBeVisible();
      await expect(drawer).toHaveAttribute("aria-busy", "false");
      await expect(page.getByText("Loading component detail…", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Loading local quality quantization bands...", { exact: true })).toHaveCount(0);

      const completedGeometry = await page.evaluate(() => {
        const resultRegion = document.querySelector(".crb2-results")?.getBoundingClientRect();
        const drawerRegion = document.querySelector(".craft-detail-drawer-region")?.getBoundingClientRect();
        return {
          resultsLeft: resultRegion?.left ?? 0,
          resultsWidth: resultRegion?.width ?? 0,
          drawerLeft: drawerRegion?.left ?? 0,
          drawerWidth: drawerRegion?.width ?? 0,
        };
      });
      for (const key of Object.keys(initialGeometry) as Array<keyof typeof initialGeometry>) {
        expect(Math.abs(completedGeometry[key] - initialGeometry[key])).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => {
        const state = window as typeof window & {
          __craftObservedLoadingCopy?: string[];
          __craftLoadingObserver?: MutationObserver;
        };
        state.__craftLoadingObserver?.disconnect();
        return state.__craftObservedLoadingCopy ?? [];
      })).toEqual([]);

      await expect(results).toBeVisible();
      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-drawer-completed-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });

  test("shows sortable source-backed weapon columns and linked blueprint sources in their dedicated tab", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${browserPath}?search=M5A`, { waitUntil: "domcontentloaded" });

      const table = page.locator(".crb2-table");
      for (const column of ["Alpha", "DPS", "Fire Rate", "Projectile Speed", "Capacity"]) {
        const sort = table.getByRole("button", { name: new RegExp(`^${column}`) });
        await expect(sort).toBeVisible();
        await sort.click();
        await expect(sort).toContainText("↓");
        await sort.click();
        await expect(sort).toContainText("↑");
      }
      const m5aRow = table.locator("tbody tr").filter({ hasText: "M5A Cannon" });
      await expect(m5aRow).toContainText("410");
      await expect(m5aRow).toContainText("684");
      await expect(m5aRow).toContainText("1,184 m/s");
      await expect(m5aRow).toContainText("25");
      await page.getByRole("searchbox", { name: "Search components" }).fill("AD5B");
      const ballisticRow = table.locator("tbody tr").filter({ hasText: "AD5B Ballistic Gatling" });
      await expect(ballisticRow).toContainText("5,004");
      await expect(ballisticRow).toContainText("1,538");
      await page.goto(`${browserPath}?preview=1a85280e-7b8f-4486-a563-17cd2549d268`, { waitUntil: "domcontentloaded" });
      const drawer = page.locator(".craft-detail-drawer-region");
      await expect(drawer).toBeVisible();
      await drawer.getByRole("tab", { name: "Materials" }).click();
      await expect(drawer.locator(".craft-detail-effects-panel")).toBeVisible();
      await expect(drawer.locator(".craft-detail-sources-section")).toHaveCount(0);
      await drawer.getByRole("tab", { name: "Sources" }).click();
      const sources = drawer.locator(".craft-detail-sources-section");
      await expect(sources).toBeVisible();
      const mission = sources.getByRole("button", { name: "Blackbox Retrieval Very Dangerous", exact: true });
      await expect(mission).toBeVisible();
      await mission.click();
      const briefing = page.getByRole("dialog", { name: "Mission Briefing" });
      await expect(briefing).toBeVisible();
      await expect(briefing).toContainText("Blackbox Retrieval Very Dangerous");
      for (const label of ["Reputation Reward", "Blueprint Reward Pool", "Payout", "Systems", "Items to Collect or Deliver"]) {
        await expect(briefing).toContainText(label);
      }
      await briefing.getByRole("button", { name: "Close Mission Briefing" }).click();
      await expect(briefing).toHaveCount(0);
      await expect(drawer.locator(".craft-detail-effects-panel")).toHaveCount(0);
      await expect(drawer.getByRole("button", { name: "Add to Queue", exact: true })).toBeVisible();
      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-blueprint-sources-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });
});
