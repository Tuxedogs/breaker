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
  test("keeps the selected detail single-pane below 1600px and makes it a 52.5% comparison peer at wide desktop", async ({ page }) => {
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

      const results = page.locator(".craft-browser-workspace > .crb2-results");
      if (viewport.width < 1600) {
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
        const resultList = document.querySelector<HTMLElement>(".craft-browser-workspace > .crb2-results")?.getBoundingClientRect();
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
      expect(geometry.resultsTop).toBeGreaterThanOrEqual(geometry.toolbarBottom + 8);
      expect(geometry.drawerTop).toBeLessThanOrEqual(geometry.toolbarBottom);
      expect(geometry.drawerLeft).toBeGreaterThan(geometry.toolbarLeft + geometry.toolbarWidth);
      const leftShare = geometry.toolbarWidth / (geometry.toolbarWidth + geometry.drawerWidth);
      expect(leftShare).toBeGreaterThan(0.51);
      expect(leftShare).toBeLessThan(0.54);

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
    await expect(drawer.locator(".craft-detail-hero-artwork")).toHaveAttribute(
      "src",
      /behr-ballistic-gatling-s5\.webp$/,
    );

    await page.getByRole("tab", { name: "Materials" }).click();
    const materialRow = drawer.locator(".craft-detail-material-row").first();
    await expect(materialRow.locator(".craft-detail-material-slot")).not.toHaveText("");
    await expect(materialRow.locator(".craft-detail-material-id strong")).not.toHaveText("");
    await expect(materialRow.locator(".bq-target-quality")).toBeVisible();
    await expect(materialRow.locator(".bq-target-slider-marker")).not.toHaveCount(0);
    await expect(materialRow.locator(".craft-detail-material-required")).toContainText("Required qty");
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
      await expect(page.locator(".recipe-browser-command-header")).toBeVisible();
      await expect(page.locator(".recipe-browser-command-copy h1")).toHaveText("Crafting Intelligence");
      await expect(page.locator(".recipe-browser-command-copy p")).toHaveText(
        "Search components, compare recipes, materials, and crafting requirements.",
      );

      const shellGeometry = await page.evaluate(() => {
        const pageBody = document.querySelector<HTMLElement>(".recipe-browser-page-body");
        const header = document.querySelector<HTMLElement>(".recipe-browser-command-header");
        const content = document.querySelector<HTMLElement>(".recipe-browser-content-shell");
        const pageBodyRect = pageBody?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();
        return {
          headerLeftInset: Math.round((headerRect?.left ?? 0) - (pageBodyRect?.left ?? 0)),
          headerTopInset: Math.round((headerRect?.top ?? 0) - (pageBodyRect?.top ?? 0)),
          contentLeftInset: Math.round((contentRect?.left ?? 0) - (pageBodyRect?.left ?? 0)),
          headerToContentGap: Math.round((contentRect?.top ?? 0) - (headerRect?.bottom ?? 0)),
        };
      });
      expect(shellGeometry).toEqual({
        headerLeftInset: viewport.width <= 900 ? 10 : 4,
        headerTopInset: 8,
        contentLeftInset: viewport.width <= 900 ? 10 : 4,
        headerToContentGap: 8,
      });
      if (viewport.width >= 1600) {
        await expect(page.locator(".craft-detail-drawer-region")).toBeVisible();
      }
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

      await page.getByRole("button", { name: /^Materials/ }).click();
      await expect(page.getByRole("searchbox", { name: "Search materials" })).toBeVisible();
      expect(await page.locator(".crb2-material-option").count()).toBeGreaterThanOrEqual(30);
      await page.screenshot({
        path: path.join(screenshotDir, `recipe-browser-materials-${viewport.name}.png`),
        fullPage: true,
      });
      await page.getByRole("searchbox", { name: "Search materials" }).fill("iron");
      await expect(page.locator(".crb2-material-option")).toHaveCount(1);
      await expect(page.locator(".crb2-material-option").first()).toContainText("Iron");
      await page.keyboard.press("Escape");

      const selectedWeaponRow = page.locator(".crb2-table tbody tr").filter({
        hasText: "AD5B Ballistic Gatling",
      });
      await expect(selectedWeaponRow).toBeVisible();
      await selectedWeaponRow.click();
      if (viewport.width >= 1600) {
        await expect(page.locator(".craft-detail-drawer-title")).toHaveText("AD5B");
        await expect(page.locator(".craft-detail-drawer-title")).toHaveAttribute(
          "aria-label",
          "AD5B Ballistic Gatling",
        );
      } else {
        await expect(selectedWeaponRow).toHaveAttribute("aria-selected", "true");
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
    await page.goto(`${browserPath}?f=weapons&search=C54`, { waitUntil: "domcontentloaded" });
    const preferredSearchRow = page.locator('.crb2-table tbody tr[aria-selected="true"]');
    await expect(preferredSearchRow).toContainText("C54 SMG");
    await expect(preferredSearchRow).not.toContainText("Magazine");

    await page.goto(browserPath, { waitUntil: "domcontentloaded" });
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

  test("renders raw quality controls, extracted ticks, and a realistic FPS chart window", async ({ page }) => {
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
      await expect(page.locator(".craft-detail-title")).toContainText("CQ7");
      if (viewport.width <= 430) {
        await page.getByRole("tab", { name: "Materials" }).click();
      }

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
      await expect(firstMaterialCard).toContainText("Required qty");
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
      await expect(page.locator(".craft-detail-material-table-head")).not.toContainText("Quality");
      await expect(page.locator(".craft-detail-material-row").first()).not.toContainText("Band");
      await expect(page.locator(".craft-detail-material-id").filter({ hasText: "Hephaestanite" })).toBeVisible();
      if (viewport.width > 430) {
        await expect(page.locator(".craft-detail-graph-panel")).toBeVisible();
        await expect(page.locator(".craft-detail-graph-head")).toContainText(/chart window/i);
        await expect(page.locator(".craft-detail-graph-x-axis")).toContainText("250m");
        await expect(page.locator(".craft-detail-graph-readouts")).toContainText("Projectile Travel (context)");
        const chartPlacement = await page.evaluate(() => {
          const materials = document.querySelector(".craft-detail-material-section");
          const chart = document.querySelector(".craft-detail-chart-section");
          return {
            materialBottom: materials?.getBoundingClientRect().bottom ?? 0,
            chartTop: chart?.getBoundingClientRect().top ?? 0,
          };
        });
        expect(chartPlacement.chartTop).toBeGreaterThanOrEqual(chartPlacement.materialBottom);
        const modifierColor = await page.locator(".craft-detail-stat-modifier.craft-ok").first().evaluate((element) => ({
          rendered: getComputedStyle(element).color,
          token: getComputedStyle(element).getPropertyValue("--stat-beneficial").trim(),
        }));
        expect(modifierColor.rendered).toBe("rgb(69, 216, 157)");
        expect(modifierColor.token.toLowerCase()).toBe("#45d89d");
      }

      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-cq7-${viewport.name}.png`),
        fullPage: true,
      });

      if (viewport.width > 430) {
        await page.locator(".craft-detail-graph-panel").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(screenshotDir, `crafting-detail-cq7-chart-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  test("keeps the material target bubble, thumb travel, and direct editor synchronized", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".craft-detail-title")).toContainText("CQ7");

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
    await expect(card).toContainText("Required qty");
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
      await expect(card.getByText("Required qty")).toBeVisible();
      await expect(card.locator(".craft-detail-effect-chip").first()).toBeVisible();
      await expectNoDocumentOverflow(page);
    }
    expect(failures).toEqual([]);
  });

  test("renders Insulative Liner's Aslarite requirement as an editable material-quality row", async ({ page }) => {
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
      await expect(page.locator(".craft-detail-title")).toContainText("ADP-mk4 Arms Woodland");
      await expect(page.locator(".craft-detail-header-facts")).toContainText("Materials Required");

      const aslariteRow = page.locator(".craft-detail-material-row", { hasText: "Aslarite" });
      await expect(aslariteRow).toHaveCount(1);
      await expect(aslariteRow).toContainText("INSULATIVE LINER");
      await expect(aslariteRow.locator('input[type="range"]')).toHaveCount(1);
      const qualityEditor = aslariteRow.getByRole("button", { name: "Edit target quality for Aslarite" });
      await expect(qualityEditor).toHaveCount(1);
      await qualityEditor.click();
      const qualityInput = aslariteRow.getByRole("spinbutton", { name: "Edit target quality for Aslarite" });
      await expect(qualityInput).toHaveCount(1);
      await qualityInput.press("Escape");
      await expect(page.locator('[data-requirement-kind="part"]')).toHaveCount(0);

      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-insulative-liner-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });

  test("organizes representative item families into Build Queue-style statistic groups", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    const itemFamilies = [
      {
        slug: "fps-weapon-cq7",
        id: "1a85280e-7b8f-4486-a563-17cd2549d268",
        title: "CQ7",
        groups: ["Damage Output", "Firing", "Projectile", "Accuracy / Spread", "Penetration", "Thermal and Power"],
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
        await expect(page.locator(".craft-detail-title")).toContainText(item.title);
        if (viewport.width <= 900) {
          await page.getByRole("tab", { name: "Statistics" }).click();
        }

        const statisticsPanel = page.locator(".craft-statistics-cards");
        await expect(statisticsPanel).toBeVisible();
        await expect(page.locator(".detail-stat-groups--scannable")).toHaveCount(0);

        for (const group of item.groups) {
          await expect(page.getByRole("region", { name: `${group} end product statistics`, exact: true })).toBeAttached();
        }

        const renderedColumns = await statisticsPanel.evaluate((element) => (
          getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
        ));
        expect(renderedColumns).toBeGreaterThanOrEqual(1);
        const expectedShipColumns = viewport.width <= 520 ? 1 : viewport.width <= 900 ? 2 : 3;
        expect(renderedColumns).toBeLessThanOrEqual(item.slug === "ship-weapon-ad5b" ? expectedShipColumns : viewport.width <= 900 ? 1 : 3);
        if (item.slug === "ship-weapon-ad5b") {
          expect(renderedColumns).toBe(expectedShipColumns);
          if (expectedShipColumns === 3) {
            const positions = await statisticsPanel.locator(":scope > .craft-stat-section").evaluateAll((cards) => cards.map((card) => {
              const bounds = card.getBoundingClientRect();
              return { left: Math.round(bounds.left), top: Math.round(bounds.top) };
            }));
            expect(positions).toHaveLength(7);
            expect(positions[3].left).toBe(positions[0].left);
            expect(positions[3].top).toBeGreaterThan(positions[0].top);
            expect(positions[4].left).toBe(positions[1].left);
            expect(positions[4].top).toBeGreaterThan(positions[1].top);
            expect(positions[5].left).toBe(positions[2].left);
            expect(positions[5].top).toBeGreaterThan(positions[2].top);
            expect(positions[6].left).toBe(positions[0].left);
            expect(positions[6].top).toBeGreaterThan(positions[3].top);
          }
        }

        await page.locator(".craft-detail-summary-section").evaluate((element) => {
          element.scrollIntoView({ block: "start" });
        });
        await expectNoDocumentOverflow(page);
        await page.screenshot({
          path: path.join(screenshotDir, `crafting-stats-${item.slug}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  test("uses the shared statistics cards in the wide drawer", async ({ page }) => {
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
      await page.getByRole("tab", { name: "Statistics" }).click();

      const statisticsPanel = page.locator(".craft-detail-drawer-stats .craft-statistics-cards");
      await expect(statisticsPanel).toBeVisible();
      await expect(page.locator(".craft-detail-drawer-stats .detail-stat-groups--scannable")).toHaveCount(0);
      const layout = await statisticsPanel.evaluate((element) => ({
        columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
        overflow: element.scrollWidth - element.clientWidth,
      }));
      expect(layout.columns).toBeGreaterThanOrEqual(1);
      expect(layout.columns).toBeLessThanOrEqual(3);
      expect(layout.overflow).toBeLessThanOrEqual(1);

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
      await expect(drawer.locator(".craft-detail-drawer-title")).toContainText("CQ7");
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

  test("shows source-backed weapon columns and places linked blueprint sources after estimated effects", async ({ page }) => {
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
      await expect(table.getByRole("button", { name: /^Pen\. Dist\./ })).toBeVisible();
      const m5aRow = table.locator("tbody tr").filter({ hasText: "M5A Cannon" });
      await expect(m5aRow).toContainText("0.07m");
      await expect(m5aRow).toContainText("25");

      await page.getByRole("searchbox", { name: "Search components" }).fill("Greatsword");
      const ballisticRow = table.locator("tbody tr").filter({ hasText: "10-Series Greatsword Cannon" });
      await expect(ballisticRow).toContainText("492");

      await page.goto(`${browserPath}?preview=db3f4c97-8d40-4b36-b397-452dea1594fc`, {
        waitUntil: "domcontentloaded",
      });
      const drawer = page.locator(".craft-detail-drawer-region");
      await expect(drawer).toBeVisible();
      await drawer.getByRole("tab", { name: "Overview" }).click();
      await expect(drawer.locator(".craft-detail-sources-section")).toHaveCount(0);
      await drawer.getByRole("tab", { name: "Materials" }).click();

      const effects = drawer.locator(".craft-detail-effects-panel");
      const sources = drawer.locator(".craft-detail-sources-section");
      await expect(effects).toBeVisible();
      await expect(sources).toBeVisible();
      await expect(sources.locator(".craft-mission-source-link")).toHaveAttribute(
        "href",
        "/industry/missions?concept=xenothreat-2-85-01",
      );
      const sourceStyling = await drawer.evaluate((root) => {
        const missionLink = root.querySelector<HTMLElement>(".craft-mission-source-link");
        const fullLink = root.querySelector<HTMLElement>(".craft-detail-drawer-header-actions .craft-detail-drawer-full-link");
        const sourceCard = root.querySelector<HTMLElement>(".craft-mission-source");
        const materialCard = root.querySelector<HTMLElement>(".craft-detail-material-row");
        const effectCell = root.querySelector<HTMLElement>(".craft-detail-material-effects");
        const style = (element: HTMLElement | null) => element ? getComputedStyle(element) : null;
        return {
          missionLinkColor: style(missionLink)?.color,
          fullLinkColor: style(fullLink)?.color,
          missionLinkWeight: style(missionLink)?.fontWeight,
          fullLinkWeight: style(fullLink)?.fontWeight,
          sourceBackground: style(sourceCard)?.backgroundColor,
          materialBackground: style(materialCard)?.backgroundColor,
          sourceRadius: style(sourceCard)?.borderRadius,
          materialRadius: style(materialCard)?.borderRadius,
          effectPaddingLeft: style(effectCell)?.paddingLeft,
        };
      });
      expect(sourceStyling.missionLinkColor).toBe(sourceStyling.fullLinkColor);
      expect(sourceStyling.missionLinkWeight).toBe(sourceStyling.fullLinkWeight);
      expect(sourceStyling.sourceBackground).toBe(sourceStyling.materialBackground);
      expect(sourceStyling.sourceRadius).toBe(sourceStyling.materialRadius);
      expect(sourceStyling.effectPaddingLeft).toBe("12px");
      const panelOrder = await drawer.locator(".craft-detail-crafting-section").evaluate((section) => ({
        effects: Array.from(section.children).findIndex((child) => child.classList.contains("craft-detail-effects-panel")),
        sources: Array.from(section.children).findIndex((child) => child.classList.contains("craft-detail-sources-section")),
      }));
      expect(panelOrder.sources).toBeGreaterThan(panelOrder.effects);

      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-blueprint-sources-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });
});
