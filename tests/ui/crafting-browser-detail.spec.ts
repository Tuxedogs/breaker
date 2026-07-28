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
  test("renders the permanent filter rail, selected hero, dense tables, and empty state", async ({ page }) => {
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
      await expect(page.locator(".crb2-hero")).toBeVisible();
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

      const hazardZoneRow = page.locator(".crb2-table tbody tr").filter({
        hasText: 'CF-117 Bulldog "Hazard-Zone" Repeater',
      });
      await expect(hazardZoneRow).toBeVisible();
      await hazardZoneRow.click();
      await expect(page.locator(".crb2-hero h2")).toHaveText('CF-117 Bulldog "Hazard-Zone" Repeater');

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
    await expect(page.locator(".crb2-hero h2")).toContainText("C54 SMG");
    await expect(page.locator(".crb2-hero h2")).not.toContainText("Magazine");
    await expect(page.locator(".crb2-hero .crb2-non-filter-match")).toBeVisible();

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
      const results = document.querySelector(".crb2-results");
      const header = document.querySelector(".crb2-table thead th");
      return {
        resultsTop: results?.getBoundingClientRect().top ?? 0,
        headerTop: header?.getBoundingClientRect().top ?? 0,
      };
    });
    expect(Math.abs(stickyHeaderGeometry.headerTop - stickyHeaderGeometry.resultsTop)).toBeLessThanOrEqual(2);

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
      await expect(page.locator(".craft-detail-material-target-input .bq-target-quality").first()).toHaveText("Target 723");
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
        token: getComputedStyle(document.documentElement).getPropertyValue("--stat-beneficial").trim(),
      }));
      expect(modifierColor.rendered).toBe("rgb(110, 231, 160)");
      expect(modifierColor.token.toLowerCase()).toBe("#6ee7a0");

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

  test("organizes representative item families into Build Queue-style statistic groups", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    const itemFamilies = [
      {
        slug: "fps-weapon-cq7",
        id: "1a85280e-7b8f-4486-a563-17cd2549d268",
        title: "CQ7",
        groups: ["Damage Output", "Projectile", "Penetration", "Spread", "Handling"],
      },
      {
        slug: "ship-weapon-ad5b",
        id: "ba842720-ad32-4d53-8f56-992bacb1fc45",
        title: "AD5B",
        groups: ["Damage Output", "Projectile"],
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
        expect(renderedColumns).toBe(viewport.width <= 900 ? 1 : 2);

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
});
