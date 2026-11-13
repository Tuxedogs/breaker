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

test("keeps ranked location method shares accessible without visible method text", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await openMining(page, 1920, 1080);

  const shell = page.locator(".mining-shell");
  const toggle = page.getByRole("button", { name: /ranked locations method availability/i });
  const firstRecord = page.locator(".mlist-item").first();

  await expect(toggle).toHaveCount(0);
  await expect(firstRecord.locator(".mlist-item-thumb")).toBeVisible();
  await expect(firstRecord.locator(".mlist-item-body")).toBeVisible();
  // With nothing selected the coverage slot stays in place but renders no chips.
  await expect(firstRecord.locator(".mlist-item-coverage")).toHaveCount(1);
  await expect(firstRecord.locator(".mining-coverage-chip")).toHaveCount(0);
  await expect(firstRecord.locator(".mlist-method-availability")).toHaveCount(0);
  await expect(page.locator(".mlist-system-badge").first()).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize ranked locations panel" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "expanded-unfiltered-1920x1080.png") });

  await page.getByRole("button", { name: "Stanton", exact: true }).click();
  await expect(page.locator(".mlist-system-badge")).toHaveCount(0);

  await expect(shell).not.toHaveClass(/mining-shell--locations-collapsed/);
  await expect(firstRecord.locator(".mlist-method-availability")).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "system-selected-1920x1080.png") });
});

test("keeps the V31 responsive section navigation free of the desktop divider", async ({ page }) => {
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
    const toggle = page.getByRole("button", { name: /ranked locations method availability/i });
    await expect(toggle).toHaveCount(0);
    await expect(page.locator(".mining-mobile-filter-trigger")).toHaveCount(0);
    if (viewport.width <= 699) {
      await expect(page.getByRole("tab", { name: "Locations section" })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".breaker-rail")).toHaveCSS("position", "fixed");
    }
    await expect(page.locator(".mining-location-panel")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `refined-${viewport.width}x${viewport.height}.png`) });
  }
});

test("phone tabs show one Mining panel and keep filters and selection between tabs", async ({ page }) => {
  await openMining(page, 390, 844);
  const filters = page.locator(".mining-filter-panel");
  const locations = page.locator(".mining-location-panel");
  const profile = page.locator(".mining-detail-column");

  await expect(page.locator(".breaker-rail__item").filter({ visible: true })).toHaveCount(6);
  await expect(locations).toBeVisible();
  await expect(profile).toBeHidden();

  await page.getByRole("tab", { name: /^Filters section/ }).click();
  await expect(filters).toBeVisible();
  await expect(locations).toBeHidden();
  const firstMaterial = page.locator(".mining-filter-chip--material:not(:disabled)").first();
  await firstMaterial.click();
  await expect(firstMaterial).toHaveClass(/is-active/);

  await page.getByRole("tab", { name: "Locations section" }).click();
  await expect(profile).toBeHidden();
  const firstLocation = page.locator(".mlist-item").first();
  const locationName = (await firstLocation.locator(".mlist-item-name").innerText()).trim();
  await firstLocation.click();
  await expect(page.getByRole("tab", { name: "Profile section" })).toHaveAttribute("aria-selected", "true");
  await expect(profile).toBeVisible();
  const mobileMaterial = profile.locator(".mdet-mobile-material-card").first();
  await expect(mobileMaterial).toBeVisible();
  const mobileTypography = await mobileMaterial.evaluate((node) => {
    const select = (query: string) => {
      const element = node.querySelector(query);
      if (!element) return null;
      const css = getComputedStyle(element);
      return [css.fontSize, css.fontWeight, css.letterSpacing];
    };
    return {
      name: select(".mdet-mobile-material-title .mining-material-name-text"),
      method: select(".mdet-mobile-source-chip"),
      encounter: select(".mdet-mobile-status-pill"),
      label: select(".mdet-mobile-stat-label"),
      value: select(".mdet-mobile-stat strong"),
    };
  });
  expect(mobileTypography).toMatchObject({
    name: ["10.5px", "650", "normal"],
    method: ["10.5px", "400", "normal"],
    encounter: ["10.5px", "650", "normal"],
    label: ["9px", "650", "0.36px"],
    value: ["10.5px", "650", "normal"],
  });
  await expect(page.locator(".breaker-topbar__crumb-detail")).toHaveText(locationName);

  await page.getByRole("tab", { name: /^Filters section/ }).click();
  await expect(firstMaterial).toHaveClass(/is-active/);
  await page.getByRole("tab", { name: "Locations section" }).click();
  await expect(page.locator(".mlist-item--selected .mlist-item-name")).toHaveText(locationName);
  await expectNoDocumentOverflow(page);
});

test("shared V31 top bar uses route-specific labels and a fading accent hairline", async ({ page }) => {
  const routes = [
    { path: "/industry/mining", label: "Mining", module: "mine", color: "rgb(91, 214, 237)" },
    { path: "/industry/crafting", label: "Craft", module: "craft", color: "rgb(255, 171, 107)" },
    { path: "/logistics/build-queue", label: "Build", module: "build", color: "rgb(173, 186, 223)" },
    { path: "/logistics/inventory", label: "Inventory", module: "inventory", color: "rgb(157, 220, 164)" },
    { path: "/fitting-v2", label: "Fitting", module: "fitting", color: "rgb(67, 212, 244)" },
  ] as const;

  for (const route of routes) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    const header = page.locator(".breaker-topbar");
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute("data-module", route.module);
    await expect(header.locator(".breaker-topbar__crumb-page")).toHaveText(route.label);

    const accent = await header.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { color: style.color, gradient: style.backgroundImage, height: style.height };
    });
    expect(accent.color).toBe(route.color);
    expect(accent.gradient).toContain("linear-gradient(90deg");
    expect(accent.height).toBe("2px");
  }
  await expect(page.locator(".breaker-topbar")).toHaveCount(1);
});


test("material profile and selected tables share grouped headers and source-backed signatures", async ({ page }) => {
  await openMining(page, 1920, 1080);
  // First visit asks what to mine instead of auto-opening a tied location.
  await expect(page.getByRole("heading", { name: "What do you want to mine?" })).toBeVisible();
  await expect(page.locator(".mining-start-pick")).toHaveCount(6);
  await page.locator(".mlist-item").first().click();
  // Simple view (default) hides composition, trace lines and percentages.
  await expect(page.locator(".mining-resource-index-table").first().locator("thead th")).toHaveText([
    "Quality", "Material", "Encounter", "800+", "900+", "Signature",
  ]);
  await expect(page.locator(".mining-resource-index-table .mining-selected-traces")).toHaveCount(0);
  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  const table = page.locator(".mining-resource-index-table").first();
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveText([
    "Quality", "Material", "Encounter", "800+", "900+", "Signature", "Composition",
  ]);
  const row = table.locator(".mining-resource-row").first();
  await expect(row.locator("td")).toHaveCount(6);
  await expect(table.locator(".mining-selected-group")).toHaveText(["Ship"]);
  await expect(row.locator(".mining-selected-encounter > span:last-child")).toHaveText(/^\d+\.\d%$/);
  await expect(table.locator(".mdet-signatures-cell").first()).toHaveText(/^(—|\d{1,3}(,\d{3})*)$/);
  const metrics = await table.evaluate((node) => {
    const th = node.querySelector("thead th");
    const td = node.querySelector("tbody td");
    const signature = node.querySelector("tbody td:last-child");
    const material = node.querySelector(".mining-material-name-text");
    const trace = node.querySelector(".mining-selected-traces");
    const percentage = node.querySelector(".mining-selected-encounter > span:last-child");
    const quality = node.querySelector(".mining-resource-row td:nth-child(3)");
    return {
      headerSize: th ? getComputedStyle(th).fontSize : null,
      headerWeight: th ? getComputedStyle(th).fontWeight : null,
      bodySize: td ? getComputedStyle(td).fontSize : null,
      materialSize: material ? getComputedStyle(material).fontSize : null,
      materialWeight: material ? getComputedStyle(material).fontWeight : null,
      traceSize: trace ? getComputedStyle(trace).fontSize : null,
      traceWeight: trace ? getComputedStyle(trace).fontWeight : null,
      percentageSize: percentage ? getComputedStyle(percentage).fontSize : null,
      percentageWeight: percentage ? getComputedStyle(percentage).fontWeight : null,
      qualitySize: quality ? getComputedStyle(quality).fontSize : null,
      qualityWeight: quality ? getComputedStyle(quality).fontWeight : null,
      signatureBorder: signature ? getComputedStyle(signature).borderLeftWidth : null,
    };
  });
  expect(metrics).toEqual({
    headerSize: "11px",
    headerWeight: "600",
    bodySize: "11px",
    materialSize: "13px",
    materialWeight: "600",
    traceSize: "11px",
    traceWeight: "400",
    percentageSize: "13px",
    percentageWeight: "400",
    qualitySize: "13px",
    qualityWeight: "400",
    signatureBorder: "0px",
  });
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "material-table-signatures-empty-1920x1080.png") });

  await page.setViewportSize({ width: 1300, height: 900 });
  await expect(table).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "material-table-signatures-empty-1300x900.png") });
  await page.locator(".mining-filter-chip--material").filter({ hasText: /^Beryl$/ }).click();
  const selectedTable = page.locator(".mining-demand-breakdown .mining-resource-index-table");
  await expect(selectedTable).toBeVisible();
  await expect(selectedTable.locator("thead th")).toHaveText([
    "Quality", "Material", "Encounter", "800+", "900+", "Signature · ×2 · ×3", "Location rank",
  ]);
  const selectedRow = selectedTable.locator(".mining-resource-row").first();
  await expect(selectedRow.locator("td")).toHaveCount(6);
  await expect(selectedTable.locator(".mdet-signature-badges")).toHaveCount(0);
  await expect(selectedTable.locator(".mining-selected-group")).toHaveCount(0);
  await expect(selectedRow.locator(".mining-materials-method-tag")).toHaveCount(0);
  await expect(selectedRow.locator(".mining-materials-signature-base")).toHaveText(/^\d{1,3}(,\d{3})*$/);
  await expect(selectedRow.locator(".mining-materials-signature-multiples")).toContainText("×2");
  await expect(selectedRow.locator("td").nth(1)).toHaveText(/^(Very low|Low|Average|High|Very high|None|Not rated|Unknown)?\d+\.\d%$/);
  await expect(selectedRow.locator("td").nth(2)).toHaveText(/^\d+\.\d%$/);
  for (const column of [1, 2]) await expect(selectedRow.locator("td").nth(column)).toHaveCSS("text-align", "right");
  await expect(selectedRow.locator("td").nth(3)).toHaveText(/^\d+\.\d{2}%$/);
  await expect(selectedRow.locator("td").nth(3)).toHaveCSS("font-family", /IBM Plex Sans Condensed/);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, "selected-materials-signatures-empty-1300x900.png") });

  await openMining(page, 390, 844);
  await page.locator(".mlist-item").first().click();
  await expect(page.getByRole("tab", { name: "Profile section" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mdet-mobile-signatures").first()).toBeVisible();
  await expect(page.locator(".mdet-mobile-signatures .mdet-signature-badges").first()).toBeEmpty();
  await expectNoDocumentOverflow(page);
});

test("V31 typography uses the mockup rendered face and measures across all Mining panels", async ({ page }) => {
  const audit = async (selector: string, expected: {
    size: string;
    weight: string;
    spacing?: string;
    family?: string;
  }) => {
    const result = await page.locator(selector).first().evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        family: css.fontFamily,
        size: css.fontSize,
        weight: css.fontWeight,
        spacing: css.letterSpacing,
      };
    });
    expect(result.family).toContain(expected.family ?? "Segoe UI");
    expect(result.size, selector).toBe(expected.size);
    expect(result.weight, selector).toBe(expected.weight);
    if (expected.spacing) expect(result.spacing, selector).toBe(expected.spacing);
  };

  await openMining(page, 1920, 1080);
  await audit(".mining-region-label", { size: "10px", weight: "700", spacing: "1.35px" });
  await audit(".mine-system-button", { size: "11px", weight: "400" });
  await audit(".mining-filter-chip--material", { size: "11px", weight: "400" });
  await audit(".mlist-item-name", { size: "12.3px", weight: "640" });
  await audit(".mlist-item-sub", { size: "10px", weight: "400" });
  await audit(".mdet-name", { size: "24px", weight: "600", spacing: "0.6px" });
  await audit(".mdet-method-label", { size: "10px", weight: "400", spacing: "0.8px" });
  await audit(".mdet-section-label", { size: "11.5px", weight: "650", spacing: "1.495px" });
  await audit(".mining-resource-index-table thead th", { size: "11px", weight: "600" });
  await audit(".mining-resource-index-table .mining-material-name-text", { size: "13px", weight: "600" });
  await audit(".mining-resource-index-table .mining-selected-traces", { size: "11px", weight: "400" });
  await audit(".mining-resource-index-table .mining-resource-row td:nth-child(3)", { size: "13px", weight: "400", family: "IBM Plex Sans Condensed" });
  await expectNoDocumentOverflow(page);

  await openMining(page, 1300, 900);
  await audit(".mlist-item-name", { size: "11.8px", weight: "640" });
  await audit(".mdet-name", { size: "18.2px", weight: "600" });
  await expectNoDocumentOverflow(page);

  await openMining(page, 390, 844);
  await audit(".mining-region-label", { size: "10px", weight: "700", spacing: "0.8px" });
  await audit(".mlist-item-name", { size: "11.8px", weight: "640" });
  await audit(".mdet-name", { size: "16px", weight: "600" });
  await expectNoDocumentOverflow(page);
});

// Populated V31 comparison fixture. Materials come from the tracked
// server-data/mining indexes served by vite.local-fixtures.config.ts; the
// ranking algorithm and source data are untouched.
const POPULATED_FIXTURE_MATERIALS = ["Beryl", "Quantanium", "Taranite", "Stileron"];

async function openPopulatedMining(page: Page, width: number, height: number) {
  await openMining(page, 1920, 1080);
  for (const material of POPULATED_FIXTURE_MATERIALS) {
    const chip = page.locator(".mining-filter-chip--material").filter({ hasText: new RegExp(`^${material}$`) }).first();
    await chip.click();
    await expect(chip).toHaveClass(/is-active/);
  }
  await page.setViewportSize({ width, height });
}

test("populated fixture exercises selected materials, compact competition and coverage without ranked method text", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await openPopulatedMining(page, 1920, 1080);

  // Simple view (default) shows selected materials as cards; Detailed keeps the table.
  await expect(page.locator(".mining-demand-breakdown .mdet-section-label > span").first()).toContainText("Your materials here");
  await expect(page.locator(".mining-demand-breakdown .mining-material-card").first()).toBeVisible();
  await expect(page.locator(".mining-demand-breakdown .mining-material-card-occ-word b").first()).toHaveText(/^(Very low|Low|Average|High|Very high|None|Not rated|Unknown)$/);
  await expect(page.locator(".mdet-hero-plates .mdet-plate--equipment")).toBeVisible();
  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  await expect(page.locator(".mining-demand-breakdown .mdet-section-label > span").first()).toContainText("Selected materials");
  await expect(page.locator(".mining-demand-breakdown tbody tr").first()).toBeVisible();
  await expect(page.locator(".mdet-competition .mdet-competition-bar").first()).toBeVisible();
  await expect(page.locator(".mdet-competition-heading")).toHaveText("What else spawns in the same pool");
  // The coverage bar is gone; found/missing selections read in the section heading.
  await expect(page.locator(".mdet-coverage-metrics")).toHaveCount(0);
  await expect(page.locator(".mining-demand-breakdown .mining-materials-section-meta")).toContainText(/\d+ of \d+ found/);

  await expect(page.locator(".mlist-item-coverage-value, .mlist-item-coverage-track, .mdet-metric-track")).toHaveCount(0);
  await expect(page.locator(".mlist-item-coverage").first()).not.toContainText(/\bof\s+\d/);

  // Ranked cards no longer display method text; shares remain in the
  // accessible row label and in the Location Profile.
  await expect(page.locator(".mlist-method-availability")).toHaveCount(0);
  await expect(page.locator(".mlist-item").first()).toHaveAttribute("aria-label", /Modeled method shares: .*\d/);
  const pool = page.locator(".mdet-competition-pool").first();
  await expect(pool).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(pool).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".mdet-competition .mdet-section-label")).toHaveCount(0);
  await expect(page.locator(".mdet-competition-bar").first()).toHaveCSS("height", "12px");
  await expect(page.locator(".mdet-method-rack-value").first()).toHaveText(/\d/);

  for (const [width, height] of [[1920, 1080], [2560, 1440], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `populated-fixture-${width}x${height}.png`) });
  }
});

test("coverage chips wrap and replace legacy coverage metrics", async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await openPopulatedMining(page, 1920, 1080);
  await expect(page.locator(".mlist-item-coverage-value, .mlist-item-coverage-track, .mdet-metric-track")).toHaveCount(0);
  await expect(page.locator(".mlist-item-coverage .mining-coverage-chip").first()).toBeVisible();
  await expect(page.locator(".mlist-item-coverage .mining-coverage-chip.is-not-covered")).toHaveCount(0);
  for (const [width, height] of [[1920, 1080], [2560, 1440], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expectNoDocumentOverflow(page);
    const clipped = await page.locator(".mlist-item-coverage .mining-coverage-chip").evaluateAll(nodes => nodes.some(node => {
      const chip = node.getBoundingClientRect();
      const parent = node.closest(".mlist-item")!.getBoundingClientRect();
      return chip.left < parent.left || chip.right > parent.right || chip.top < parent.top || chip.bottom > parent.bottom;
    }));
    expect(clipped).toBe(false);
    await page.screenshot({ path: path.join(screenshotDir, `coverage-${width}x${height}.png`) });
  }
});

test("V31 parity typography holds for tables, location names, tabs and region labels", async ({ page }) => {
  const style = (selector: string) => page.locator(selector).first().evaluate((node) => {
    const css = getComputedStyle(node);
    return { size: css.fontSize, weight: css.fontWeight, color: css.color, height: Math.round(node.getBoundingClientRect().height) };
  });

  await openPopulatedMining(page, 1920, 1080);
  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  expect(await style(".mining-demand-breakdown .mdet-mat-name")).toMatchObject({ size: "11px", weight: "650", color: "rgb(213, 234, 242)" });
  for (const name of await page.locator(".mlist-item-name").evaluateAll((nodes) => nodes.slice(0, 3).map((node) => getComputedStyle(node).color))) {
    expect(name).toBe("rgb(217, 232, 239)");
  }
  for (const height of await page.locator(".mining-region-label").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)))) {
    expect(height).toBe(16);
  }

  await page.setViewportSize({ width: 900, height: 1100 });
  await page.getByRole("tab", { name: /^Profile section/ }).click();
  expect(await style(".mining-demand-breakdown thead th")).toMatchObject({ size: "11px" });
  expect(await style(".mining-demand-breakdown .mining-material-name-text")).toMatchObject({ size: "15px", weight: "600" });
  expect(await style(".mining-demand-breakdown .mining-selected-encounter > span:last-child")).toMatchObject({ size: "14px" });
  expect(await style(".mining-section-tabs button")).toMatchObject({ size: "10px", weight: "400" });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await style(".mining-section-tabs button")).toMatchObject({ size: "11px", weight: "650" });
  expect(await style(".mining-section-tabs button small")).toMatchObject({ size: "8px", weight: "500" });
});


test("manual selections preserve coverage without rendering absent materials as location resources", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("scintel:mining:msb-sidebar:v1", JSON.stringify({ buildQueueActive: false, systems: [], miningTypes: [], resources: ["gold", "copper", "hadanite"] }));
  });
  await openMining(page, 1920, 1080);
  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  const selectedSection = page.locator(".mining-demand-breakdown");
  const desktopNames = selectedSection.locator("tbody .mining-material-name-text");
  const foundMeta = selectedSection.locator(".mining-materials-section-meta");
  await expect(foundMeta).toContainText(/of 3 found/);
  await expect(selectedSection.locator("tbody .mining-resource-row--missing")).toHaveCount(0);
  const desktopRows = await selectedSection.locator("tbody tr").allTextContents();
  expect(desktopRows.join(" ")).not.toContain("Not present");
  const mobileNames = selectedSection.locator(".mdet-mobile-material-title .mining-material-name-text");
  expect(await mobileNames.allTextContents()).toEqual(await desktopNames.allTextContents());
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("selected-materials-desktop.png") });
  await page.setViewportSize({ width: 2560, height: 1440 });
  await expectNoDocumentOverflow(page);
  expect(await selectedSection.locator("tbody tr").allTextContents()).toEqual(desktopRows);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Profile section" }).click();
  await expect(foundMeta).toContainText(/of 3 found/);
  expect(await selectedSection.locator("tbody tr").allTextContents()).toEqual(desktopRows);
  expect(await mobileNames.allTextContents()).toEqual(await desktopNames.allTextContents());
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("selected-materials-mobile.png"), fullPage: true });
});
