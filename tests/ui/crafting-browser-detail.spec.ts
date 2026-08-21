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
  test("renders the permanent filter rail, stable selection, dense tables, and empty state", async ({ page }) => {
    const failures = installFailureGuards(page);
    const measurements: Array<Record<string, string | number>> = [];
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(browserPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
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
        await expect(page.locator(".craft-detail-drawer-title")).toContainText(
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
    await page.goto(`${browserPath}?v=shield&search=C54`, { waitUntil: "domcontentloaded" });
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
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(detailPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".craft-detail-stage")).toBeVisible();
      await expect(page.locator(".craft-detail-title")).toContainText("CQ7");

      const firstSlider = page.locator(".craft-detail-material-target-input input[type='range']").first();
      await expect(firstSlider).toHaveAttribute("min", "1");
      await expect(firstSlider).toHaveAttribute("max", "1000");
      await expect(firstSlider).not.toHaveAttribute("step", /^(?!1$).+/);
      expect(await page.locator(".craft-detail-material-row").first().locator(".bq-target-slider-marker").count())
        .toBeGreaterThanOrEqual(8);

      await firstSlider.fill("723");
      await expect(page.locator(".craft-detail-material-target-input .bq-target-quality").first()).toHaveText("723");
      await expect(page.locator(".craft-detail-material-target-input .bq-target-quality")).toHaveCount(3);
      for (const target of await page.locator(".craft-detail-material-target-input .bq-target-quality").all()) {
        await expect(target).toBeVisible();
      }
      await expect(page.locator(".craft-detail-material-table-head")).not.toContainText("Quality");
      await expect(page.locator(".craft-detail-material-row").first()).not.toContainText("Band");
      await expect(page.locator(".craft-detail-material-id").filter({ hasText: "Hephaestanite" })).toBeVisible();
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

      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-cq7-${viewport.name}.png`),
        fullPage: true,
      });

      await page.locator(".craft-detail-graph-panel").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(screenshotDir, `crafting-detail-cq7-chart-${viewport.name}.png`),
        fullPage: true,
      });
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
        groups: ["Damage Output", "Projectile", "Penetration", "Falloff", "Spread", "Handling"],
      },
      {
        slug: "ship-weapon-ad5b",
        id: "ba842720-ad32-4d53-8f56-992bacb1fc45",
        title: "AD5B",
        groups: ["Damage Output", "Ammunition", "Projectile"],
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
        await expect(page.locator(".detail-stat-groups--scannable")).toBeVisible();

        for (const group of item.groups) {
          await expect(page.getByRole("region", { name: group, exact: true })).toBeAttached();
        }

        const renderedColumns = await page.locator(".detail-stat-groups--scannable").evaluate((element) => (
          getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
        ));
        expect(renderedColumns).toBe(viewport.width <= 900 ? 1 : 3);

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

  test("lays out drawer statistics in three columns", async ({ page }) => {
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

      const statColumns = page.locator(
        ".craft-detail-drawer-stats .detail-stat-groups--scannable",
      );
      await expect(statColumns).toBeVisible();
      const layout = await statColumns.evaluate((element) => ({
        columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
        overflow: element.scrollWidth - element.clientWidth,
      }));
      expect(layout.columns).toBe(3);
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
