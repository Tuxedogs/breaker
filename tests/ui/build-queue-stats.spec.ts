import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  BUILD_QUEUE_STATS_FIXTURE_PATH,
  FIXTURE_ITEM_IDS,
  INVENTORY_ADD_MODAL_FIXTURE_PATH,
} from "../../src/pages/logistics/buildQueueStatsFixture";

const buildQueueArtifactRoot = process.env.BQ_UI_ARTIFACT_ROOT
  ? path.resolve(process.env.BQ_UI_ARTIFACT_ROOT)
  : path.resolve(process.cwd(), "artifacts");
const cq7ScreenshotDir = path.join(buildQueueArtifactRoot, "bq-component-stats-cq7");
const sharedStatsScreenshotDir = path.join(buildQueueArtifactRoot, "bq-component-stats-shared");
const craftingSliderScreenshotDir = path.join(buildQueueArtifactRoot, "crafting-target-slider");
const CRAFTING_TARGET_SLIDER_FIXTURE_PATH = "/industry/crafting/__fixture/target-slider";

const fixtureItems = [
  { id: FIXTURE_ITEM_IDS.fr66, name: "FR-66", queue: "Pyro Defense Refit", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.ad5b, name: "AD5B Ballistic Gatling", queue: "Pyro Defense Refit", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsWeapon, name: 'P6-LR "Archangel" Sniper Rifle', queue: "Ground Team Loadout", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.cq7, name: "CQ7 Rifle", queue: "Ground Team Loadout", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsArmor, name: "ADP-mk4 Arms Woodland", queue: "Expedition Spares", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.atlas, name: "Atlas", queue: "Ship Systems", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.snowBlind, name: "SnowBlind", queue: "Ship Systems", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.js300, name: "JS-300", queue: "Ship Systems", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.m5a, name: "M5A Cannon", queue: "Ship Systems", expectGroupedStats: true },
] as const;

function isIgnorableUrl(url: string): boolean {
  return /supabase\.co|vercel|speed-insights|\/api\/user\/|discord\.com|google-analytics/i.test(url);
}

function installFailureGuards(page: Page) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Download the React DevTools|favicon\.ico/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (isIgnorableUrl(url)) return;
    failures.push(`request failed: ${request.method()} ${url} ${request.failure()?.errorText ?? ""}`.trim());
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 400 || isIgnorableUrl(url)) return;
    failures.push(`HTTP ${status}: ${url}`);
  });

  return failures;
}

async function selectFixtureItem(page: Page, itemId: string, itemName: string) {
  const listCard = page.locator(".bq-craft-card").filter({ hasText: itemName }).first();
  await expect(listCard).toBeVisible();
  await listCard.click();
  await expect(page.locator(".bq-item-name")).toHaveText(itemName);
  await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
}

async function selectQueue(page: Page, queueName: string) {
  const trigger = page.locator(".bq-queue-selector-trigger");
  if ((await trigger.textContent())?.includes(queueName)) return;
  await trigger.click();
  await page.getByRole("option", { name: new RegExp(queueName) }).click();
  await expect(trigger).toContainText(queueName);
}

test.describe("Build Queue stats fixture", () => {
  test("keeps desktop typography and statistics stable across transition widths", async ({ page }) => {
    const failures = installFailureGuards(page);
    const samples = [];

    for (const viewport of [
      { width: 1099 },
      { width: 1100 },
      { width: 1101 },
      { width: 1199 },
      { width: 1200 },
      { width: 1201 },
      { width: 1280 },
      { width: 1499 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: 900 });
      await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?mockup=1`, { waitUntil: "domcontentloaded" });
      const panel = page.locator('.bq-component-statistics[data-bq-stats-status="ready"]');
      await expect(panel).toBeVisible({ timeout: 60_000 });

      const sample = await page.locator(".bq-page").evaluate((root) => {
        const query = (selector: string) => root.querySelector<HTMLElement>(selector);
        const statColumn = query(".bq-stat-unmodified-column");
        const selectedCraft = query(".bq-selected-craft-card");
        const statistics = query(".bq-component-statistics");
        const columns = statColumn
          ? getComputedStyle(statColumn).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
          : 0;
        return {
          columns,
          headerHeight: selectedCraft?.getBoundingClientRect().height ?? 0,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          statsOverflow: (statistics?.scrollHeight ?? 0) - (statistics?.clientHeight ?? 0),
          statsOverflowY: statistics ? getComputedStyle(statistics).overflowY : "",
          fonts: {
            queueTitle: query(".bq-queue-col-title") ? getComputedStyle(query(".bq-queue-col-title")!).fontSize : "",
            selectedName: query(".bq-item-name") ? getComputedStyle(query(".bq-item-name")!).fontSize : "",
            sectionTitle: query(".bq-component-statistics-title") ? getComputedStyle(query(".bq-component-statistics-title")!).fontSize : "",
            statLabel: query(".craft-stat-compact-label") ? getComputedStyle(query(".craft-stat-compact-label")!).fontSize : "",
            statValue: query(".craft-stat-compact-value") ? getComputedStyle(query(".craft-stat-compact-value")!).fontSize : "",
          },
        };
      });

      expect(sample.columns).toBeGreaterThanOrEqual(2);
      expect(sample.columns).toBeLessThanOrEqual(5);
      expect(sample.documentOverflow).toBeLessThanOrEqual(0);
      expect(sample.statsOverflow).toBeLessThanOrEqual(1);
      expect(sample.statsOverflowY).toBe("visible");
      samples.push({ width: viewport.width, ...sample });
    }

    const referenceFonts = samples[0].fonts;
    expect(referenceFonts).toEqual({
      queueTitle: "14px",
      selectedName: "20px",
      sectionTitle: "13px",
      statLabel: "10px",
      statValue: "12.5px",
    });
    expect(samples.every((sample) => sample.fonts.queueTitle === referenceFonts.queueTitle)).toBe(true);
    expect(samples.every((sample) => sample.fonts.sectionTitle === referenceFonts.sectionTitle)).toBe(true);
    expect(samples.every((sample) => sample.fonts.statLabel === referenceFonts.statLabel)).toBe(true);
    expect(samples.every((sample) => Number.parseFloat(sample.fonts.selectedName) >= 20 && Number.parseFloat(sample.fonts.selectedName) <= 23)).toBe(true);
    expect(samples.every((sample) => Number.parseFloat(sample.fonts.statValue) >= 10 && Number.parseFloat(sample.fonts.statValue) <= 12.5)).toBe(true);
    const before1200 = samples.find((sample) => sample.width === 1199);
    const at1200 = samples.find((sample) => sample.width === 1200);
    expect(Math.abs((before1200?.headerHeight ?? 0) - (at1200?.headerHeight ?? 0))).toBeLessThanOrEqual(2);
    expect(failures).toEqual([]);
  });

  test("renders CQ7 extracted statistics without clipping at desktop review sizes", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(cq7ScreenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BUILD_QUEUE_STATS_FIXTURE_PATH, { waitUntil: "domcontentloaded" });
      await selectQueue(page, "Ground Team Loadout");
      await selectFixtureItem(page, FIXTURE_ITEM_IDS.cq7, "CQ7 Rifle");

      const labels = await page.locator(".bq-component-statistics .bq-stat-compact-label").allTextContents();
      expect(labels).toEqual(expect.arrayContaining([
        "Alpha",
        "DPS",
        "Fire Rate",
        "Burst Size",
        "Ammo Count",
        "Speed",
        "Lifetime",
        "Damage Falloff Start",
        "Damage Drop Per Meter",
        "Minimum Damage After Falloff",
        "Min–Max",
        "First Attack",
        "Per Attack",
        "Decay",
      ]));

      const traitLayout = await page.locator(".bq-component-statistics").evaluate((panel) => {
        const statColumn = panel.querySelector(".bq-stat-unmodified-column");
        const firstRow = panel.querySelector(".bq-stat-compact-row");
        const firstGroup = panel.querySelector(".bq-stat-unmodified-group");
        const firstGroupHeading = firstGroup?.querySelector(":scope > .craft-stat-section-surface > .craft-stat-section-title");
        const firstGroupCard = firstGroup?.querySelector(":scope > .bq-stat-unmodified-card");
        const label = firstRow?.querySelector(".bq-stat-compact-label");
        const value = firstRow?.querySelector(".bq-stat-compact-value");
        const headingRect = firstGroupHeading?.getBoundingClientRect();
        const cardRect = firstGroupCard?.getBoundingClientRect();
        return {
          groupTitles: Array.from(panel.querySelectorAll(".bq-stat-unmodified-group .craft-stat-section-title"))
            .map((heading) => heading.textContent?.trim() ?? ""),
          columnCount: statColumn
            ? getComputedStyle(statColumn).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
            : 0,
          rowHeight: firstRow?.getBoundingClientRect().height ?? 0,
          labelColor: label ? getComputedStyle(label).color : "",
          valueColor: value ? getComputedStyle(value).color : "",
          headingWeight: firstGroupHeading ? Number.parseInt(getComputedStyle(firstGroupHeading).fontWeight, 10) : 0,
          labelWeight: label ? Number.parseInt(getComputedStyle(label).fontWeight, 10) : Number.POSITIVE_INFINITY,
          valueWeight: value ? Number.parseInt(getComputedStyle(value).fontWeight, 10) : Number.POSITIVE_INFINITY,
          headingInsideCard: Boolean(
            firstGroupHeading
            && firstGroupCard
            && firstGroupCard.contains(firstGroupHeading)
            && headingRect
            && cardRect
            && headingRect.top >= cardRect.top
            && headingRect.bottom <= cardRect.bottom,
          ),
        };
      });
      expect(traitLayout.groupTitles).toEqual(expect.arrayContaining([
        "Damage Output",
        "Projectile",
        "Penetration",
        "Falloff",
        "Spread",
        "Handling",
      ]));
      expect(traitLayout.groupTitles).not.toContain("Ammunition");
      expect(traitLayout.columnCount).toBeGreaterThanOrEqual(4);
      expect(traitLayout.rowHeight).toBeGreaterThanOrEqual(20);
      expect(traitLayout.rowHeight).toBeLessThanOrEqual(30);
      expect(traitLayout.labelWeight).toBeLessThanOrEqual(500);
      expect(traitLayout.valueWeight).toBeGreaterThan(traitLayout.labelWeight);
      expect(traitLayout.headingWeight).toBeGreaterThan(traitLayout.labelWeight);
      expect(traitLayout.valueColor).not.toBe(traitLayout.labelColor);
      expect(traitLayout.headingInsideCard).toBe(true);

      await page.getByRole("tab", { name: "Engineering" }).click();
      await expect(page.locator(".bq-component-statistics")).toContainText("Thermal and Power");
      await page.getByRole("tab", { name: "Performance" }).click();

      const geometry = await page.locator(".bq-component-statistics").evaluate((panel) => {
        const panelRect = panel.getBoundingClientRect();
        const rows = Array.from(panel.querySelectorAll(".bq-stat-compact-row, .bq-stat-compare-row"));
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          panelOverflow: panel.scrollWidth - panel.clientWidth,
          clippedRows: rows.filter((row) => {
            const rect = row.getBoundingClientRect();
            return rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1;
          }).length,
        };
      });
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.panelOverflow).toBeLessThanOrEqual(1);
      expect(geometry.clippedRows).toBe(0);

      await page.screenshot({
        path: path.join(cq7ScreenshotDir, `cq7-component-statistics-${viewport.name}.png`),
        fullPage: true,
      });
      await page.locator(".bq-component-statistics").screenshot({
        path: path.join(cq7ScreenshotDir, `cq7-component-statistics-panel-${viewport.name}.png`),
      });
    }

    expect(failures).toEqual([]);
  });

  test("renders the populated mockup target at desktop review sizes", async ({ page }) => {
    const failures = installFailureGuards(page);
    const visualTargetDir = path.join(buildQueueArtifactRoot, "build-queue-visual-target");
    await mkdir(visualTargetDir, { recursive: true });

    for (const viewport of [
      { name: "1680x945", width: 1680, height: 945 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?mockup=1`, { waitUntil: "domcontentloaded" });

      await expect(page.locator(".bq-item-name")).toHaveText("M5A Cannon");
      await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Add Craft" })).toHaveCount(0);
      await expect(page.locator(".bq-craft-card-drag-handle")).toHaveCount(2);
      await expect(page.locator(".bq-inventory-toggle")).toBeVisible();
      const autoReserve = page.getByRole("button", { name: "Auto reserve inventory for M5A Cannon" });
      await expect(autoReserve).toBeVisible();
      const craftCardControls = await page.locator(".bq-craft-card-shell").first().evaluate((card) => {
        const progress = card.querySelector(".bq-craft-card-ring")?.getBoundingClientRect();
        const dragHandle = card.querySelector(".bq-craft-card-drag-handle")?.getBoundingClientRect();
        return {
          progressRight: progress?.right ?? Number.POSITIVE_INFINITY,
          dragHandleLeft: dragHandle?.left ?? Number.NEGATIVE_INFINITY,
        };
      });
      expect(craftCardControls.progressRight).toBeLessThan(craftCardControls.dragHandleLeft);
      const damageLabels = await page.locator(".bq-component-statistics .bq-stat-compact-label").allTextContents();
      expect(damageLabels).toContain("Alpha");
      expect(damageLabels).not.toEqual(expect.arrayContaining([
        "Ballistic Damage",
        "Physical Damage",
        "Energy Damage",
      ]));
      const sectionTransition = await page.locator(".bq-item").evaluate((craft) => {
        const allocation = craft.querySelector(".bq-materials-section")?.getBoundingClientRect();
        const statistics = craft.querySelector(".bq-component-statistics")?.getBoundingClientRect();
        const centerShell = craft.closest(".bq-center-shell");
        const pageRoot = craft.closest(".bq-page");
        const materialCard = craft.querySelector(".bq-mat-group");
        const statColumn = craft.querySelector(".bq-stat-trait-column");
        const statCard = craft.querySelector(".craft-stat-section-surface");
        const centerHighlight = centerShell ? getComputedStyle(centerShell, "::after") : null;
        return {
          gap: allocation && statistics ? statistics.top - allocation.bottom : Number.POSITIVE_INFINITY,
          centerBackgroundColor: centerShell ? getComputedStyle(centerShell).backgroundColor : "",
          centerBackgroundImage: centerShell ? getComputedStyle(centerShell).backgroundImage : "",
          centerHighlightImage: centerHighlight?.backgroundImage ?? "",
          materialBackgroundColor: materialCard ? getComputedStyle(materialCard).backgroundColor : "",
          materialBackgroundImage: materialCard ? getComputedStyle(materialCard).backgroundImage : "",
          statColumnBackgroundColor: statColumn ? getComputedStyle(statColumn).backgroundColor : "",
          statBackgroundColor: statCard ? getComputedStyle(statCard).backgroundColor : "",
          statBackgroundImage: statCard ? getComputedStyle(statCard).backgroundImage : "",
          materialSurfaceToken: pageRoot ? getComputedStyle(pageRoot).getPropertyValue("--bq-r-surface-row").trim() : "",
        };
      });
      expect(sectionTransition.gap).toBeGreaterThanOrEqual(10);
      expect(sectionTransition.gap).toBeLessThanOrEqual(18);
      expect(sectionTransition.centerBackgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(sectionTransition.centerBackgroundImage).toBe("none");
      expect(sectionTransition.centerHighlightImage).toBe("none");
      expect(sectionTransition.materialBackgroundImage).not.toBe("none");
      expect(sectionTransition.statBackgroundImage).not.toBe("none");
      const materialActionOrder = await page.locator(".bq-materials-section-actions").evaluate((actions) => (
        Array.from(actions.children).map((child) => child.className)
      ));
      expect(materialActionOrder).toHaveLength(1);
      expect(materialActionOrder[0]).toContain("bq-inventory-toggle");
      await expect(page.locator(".bq-workspace-card-head.bq-selected-craft-head")).toHaveCount(0);
      await expect(page.locator(".bq-selected-summary-strip")).toBeVisible();
      await expect(page.locator(".bq-materials-section-heading")).toHaveCount(0);
      const collapsedMaterials = await page.locator(".bq-materials-section").evaluate((section) => {
        const table = section.querySelector(".bq-mat-table");
        const cards = Array.from(section.querySelectorAll(".bq-mat-group"));
        const tableRect = table?.getBoundingClientRect();
        const cardBottom = Math.max(...cards.map((card) => card.getBoundingClientRect().bottom));
        const shortfall = cards.find((card) => card.textContent?.includes("Agricium"))
          ?.querySelector(".bq-balance--short strong");
        const balanced = cards.find((card) => card.textContent?.includes("Dolivine"))
          ?.querySelector(".bq-balance--met strong");
        const colorProbe = document.createElement("span");
        section.appendChild(colorProbe);
        colorProbe.style.color = "var(--alloc-danger)";
        const detrimentalColor = getComputedStyle(colorProbe).color;
        colorProbe.style.color = "var(--alloc-success)";
        const beneficialColor = getComputedStyle(colorProbe).color;
        colorProbe.remove();
        return {
          tableBottom: tableRect?.bottom ?? 0,
          cardBottom,
          shortfallColor: shortfall ? getComputedStyle(shortfall).color : "",
          balancedColor: balanced ? getComputedStyle(balanced).color : "",
          detrimentalColor,
          beneficialColor,
          balancedText: balanced?.textContent ?? "",
        };
      });
      expect(collapsedMaterials.tableBottom).toBeGreaterThan(collapsedMaterials.cardBottom);
      expect(collapsedMaterials.tableBottom - collapsedMaterials.cardBottom).toBeLessThanOrEqual(20);
      expect(collapsedMaterials.shortfallColor).not.toBe("");
      expect(collapsedMaterials.balancedColor).not.toBe("");
      expect(collapsedMaterials.shortfallColor).not.toBe(collapsedMaterials.balancedColor);
      expect(collapsedMaterials.balancedText).toMatch(/^x?0(?:\sSCU)?$/);
      const collapsedQualityAllocations = await page.locator(".bq-mat-card-quality").evaluateAll((allocations) => (
        allocations.map((allocation) => ({
          overflowX: getComputedStyle(allocation).overflowX,
          chipRows: new Set(
            Array.from(allocation.querySelectorAll(".bq-quality-chip"))
              .map((chip) => Math.round(chip.getBoundingClientRect().top)),
          ).size,
        }))
      ));
      expect(collapsedQualityAllocations.every(({ overflowX }) => overflowX === "visible")).toBe(true);
      expect(collapsedQualityAllocations.every(({ chipRows }) => chipRows <= 1)).toBe(true);

      await page.locator(".bq-inventory-toggle").click();
      await expect(page.locator(".bq-inventory-toggle")).toHaveAttribute("aria-pressed", "false");
      await expect(autoReserve).toBeDisabled();
      await page.screenshot({
        path: path.join(visualTargetDir, `build-queue-inventory-off-${viewport.name}.png`),
        fullPage: false,
      });
      await page.locator(".bq-inventory-toggle").click();
      await expect(page.locator(".bq-inventory-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect(autoReserve).toBeEnabled();
      if (viewport.name === "1920x1080") {
        await page.getByRole("button", { name: "Add inventory for Agricium" }).click();
        await expect(page.locator(".bq-inv-quick-modal")).toBeVisible();
        await page.screenshot({ path: path.join(visualTargetDir, "build-queue-add-inventory-1920x1080.png"), fullPage: false });
        await page.getByRole("button", { name: "Close add inventory" }).click();
        await autoReserve.click();
        await expect(page.locator(".bq-solve-modal")).toBeVisible();
        await page.screenshot({ path: path.join(visualTargetDir, "build-queue-auto-reserve-1920x1080.png"), fullPage: false });
        await page.getByRole("button", { name: "Close auto reserve preview" }).click();
      }
      await expect(page.locator(".bq-item-header > .bq-decorative-frame")).toHaveCount(0);
      await expect(page.locator(".bq-craft-card > .bq-decorative-frame")).toHaveCount(2);
      await expect(page.locator(".bq-component-statistics > .bq-decorative-frame, .bq-materials-section > .bq-decorative-frame, .bq-mat-row > .bq-decorative-frame")).toHaveCount(0);

      const targetAverageGeometry = await page.locator(".bq-mat-group").nth(1).evaluate((card) => {
        const identity = card.querySelector(".bq-mat-name")?.getBoundingClientRect();
        const inventory = card.querySelector(".bq-mat-available")?.getBoundingClientRect();
        const highest = card.querySelector(".bq-avg-quality")?.getBoundingClientRect();
        const allocated = card.querySelector(".bq-mat-reserved")?.getBoundingClientRect();
        const allocationBar = card.querySelector(".bq-mat-card-allocation-bar")?.getBoundingClientRect();
        const need = card.querySelector(".bq-mat-card-total-need")?.getBoundingClientRect();
        return {
          identityLeft: identity?.left ?? 0,
          inventoryLeft: inventory?.left ?? 0,
          highestLeft: highest?.left ?? 0,
          allocatedLeft: allocated?.left ?? 0,
          identityBottom: identity?.bottom ?? 0,
          allocationBarTop: allocationBar?.top ?? 0,
          allocationBarWidth: allocationBar?.width ?? 0,
          cardWidth: card.getBoundingClientRect().width,
          needTop: need?.top ?? 0,
        };
      });
      expect(targetAverageGeometry.identityLeft).toBeLessThan(targetAverageGeometry.inventoryLeft);
      expect(targetAverageGeometry.inventoryLeft).toBeLessThan(targetAverageGeometry.highestLeft);
      expect(targetAverageGeometry.highestLeft).toBeLessThan(targetAverageGeometry.allocatedLeft);
      expect(targetAverageGeometry.allocationBarTop).toBeGreaterThanOrEqual(targetAverageGeometry.identityBottom - 1);
      expect(targetAverageGeometry.allocationBarWidth / targetAverageGeometry.cardWidth).toBeGreaterThan(0.9);
      expect(targetAverageGeometry.needTop).toBe(0);

      const targetEditor = page.locator(".bq-mat-card-head .bq-target-editor").first();
      const targetInput = targetEditor.locator(".bq-target-quality-input");
      await expect(targetEditor.locator(".bq-target-slider-shell")).toHaveCount(0);
      await expect(targetInput).toBeVisible();
      const originalTarget = await targetInput.inputValue();
      expect(originalTarget).not.toBe("");
      await targetInput.focus();
      await expect(targetInput).toHaveValue("");
      await page.locator(".bq-component-statistics-title").click();
      await expect(targetInput).toHaveValue(originalTarget);

      const statValues = await page.locator(".bq-component-statistics").evaluate((panel) => {
        const compactRows = Array.from(panel.querySelectorAll(".bq-stat-compact-row"));
        const compact = compactRows.find((row) => row.querySelector(".craft-stat-compact-arrow"));
        const label = compact?.querySelector(".bq-stat-compact-label")?.textContent?.trim() ?? "";
        const compactValue = compact?.querySelector(".bq-stat-compact-value");
        const compactBase = compact?.querySelector(".craft-stat-compact-base-value");
        const compactArrow = compact?.querySelector(".craft-stat-compact-arrow");
        const compactDelta = compact?.querySelector(".craft-stat-compact-delta");
        const unchanged = compactRows.find((row) => row.querySelector(".bq-stat-compact-label")?.textContent?.trim() === "Ammo Per Shot");
        const unchangedValue = unchanged?.querySelector(".bq-stat-compact-value");
        const defaultValue = compactRows
          .find((row) => row.querySelector(".bq-stat-compact-label")?.textContent?.trim() === "DPS")
          ?.querySelector(".bq-stat-compact-value");
        return {
          label,
          compact: compactValue?.textContent?.trim() ?? "",
          compactBase: compactBase?.textContent?.trim() ?? "",
          compactBaseOpacity: compactBase?.parentElement ? getComputedStyle(compactBase.parentElement).opacity : "",
          compactArrow: compactArrow?.textContent?.trim() ?? "",
          compactDelta: compactDelta?.textContent?.trim() ?? "",
          compactFont: compactValue ? getComputedStyle(compactValue).fontFamily : "",
          compactColor: compactValue ? getComputedStyle(compactValue).color : "",
          unchangedHasTransition: Boolean(unchanged?.querySelector(".craft-stat-compact-arrow")),
          unchangedColor: unchangedValue ? getComputedStyle(unchangedValue).color : "",
          unchangedFont: unchangedValue ? getComputedStyle(unchangedValue).fontFamily : "",
          defaultColor: defaultValue ? getComputedStyle(defaultValue).color : "",
        };
      });
      expect(statValues.label).not.toBe("");
      expect(statValues.compactBase).not.toBe("");
      expect(statValues.compactBase).not.toBe(statValues.compact);
      expect(statValues.compactBaseOpacity).toBe("0.5");
      expect(statValues.compactArrow).toBe("→");
      expect(statValues.compactDelta).toMatch(/^[+-]/);
      expect(statValues.compactFont).toMatch(/Roboto Mono|Courier New|monospace/i);
      expect(statValues.compactColor).not.toBe("");
      expect(statValues.unchangedHasTransition).toBe(false);
      expect(statValues.unchangedColor).toBe(statValues.defaultColor);
      expect(statValues.unchangedFont).toMatch(/Roboto Mono|Courier New|monospace/i);

      if (viewport.height <= 1100) {
        const hierarchy = await page.locator(".bq-item").evaluate((craft) => {
          const selectedCard = craft.querySelector(".bq-selected-craft-card");
          const materialHeader = craft.querySelector(".bq-materials-section-header");
          const statisticsHeader = craft.querySelector(".bq-component-statistics-header");
          const statisticsTitle = craft.querySelector(".bq-component-statistics-title");
          const firstStatLabel = craft.querySelector(".bq-stat-compact-label");
          return {
            selectedCardHeight: selectedCard?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
            materialHeaderHeight: materialHeader?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
            statisticsHeaderHeight: statisticsHeader?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
            statisticsTitleSize: statisticsTitle ? Number.parseFloat(getComputedStyle(statisticsTitle).fontSize) : Number.POSITIVE_INFINITY,
            statLabelSize: firstStatLabel ? Number.parseFloat(getComputedStyle(firstStatLabel).fontSize) : 0,
          };
        });
        expect(hierarchy.selectedCardHeight).toBeLessThanOrEqual(210);
        expect(hierarchy.materialHeaderHeight).toBeLessThanOrEqual(44);
        expect(hierarchy.statisticsHeaderHeight).toBeLessThanOrEqual(50);
        expect(hierarchy.statisticsTitleSize).toBeGreaterThanOrEqual(hierarchy.statLabelSize * 1.15);
        expect(hierarchy.statisticsTitleSize).toBeLessThanOrEqual(hierarchy.statLabelSize * 1.4);
      }

      const horizontalOverflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      ));
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: path.join(visualTargetDir, `build-queue-target-${viewport.name}.png`),
        fullPage: false,
      });
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?mockup=1`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.locator(".bq-inventory-toggle").click();
    await page.screenshot({
      path: path.join(visualTargetDir, "build-queue-inventory-off-768x900.png"),
      fullPage: false,
    });

    expect(failures).toEqual([]);
  });

  test("overlays reservation drawers in their material column without reflowing the workspace", async ({ page }) => {
    const failures = installFailureGuards(page);
    const visualTargetDir = path.join(buildQueueArtifactRoot, "build-queue-visual-target");
    await mkdir(visualTargetDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?mockup=1`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });

      const materialCard = page.locator(".bq-mat-group").filter({ hasText: "Hadanite" }).first();
      const expandButton = materialCard.getByRole("button", { name: "Expand reserve drawer for Hadanite" });
      const before = await page.locator(".bq-item").evaluate((craft) => {
        const card = Array.from(craft.querySelectorAll(".bq-mat-group"))
          .find((candidate) => candidate.textContent?.includes("Hadanite"));
        const allocation = craft.querySelector(".bq-materials-card");
        const section = craft.querySelector(".bq-materials-section");
        const table = craft.querySelector(".bq-mat-table");
        const statistics = craft.querySelector(".bq-component-statistics");
        return {
          cardWidth: card?.getBoundingClientRect().width ?? 0,
          allocationHeight: allocation?.getBoundingClientRect().height ?? 0,
          statisticsTop: statistics?.getBoundingClientRect().top ?? 0,
          allocationOverflow: allocation ? getComputedStyle(allocation).overflow : "",
          sectionOverflow: section ? getComputedStyle(section).overflow : "",
          tableOverflow: table ? getComputedStyle(table).overflow : "",
          cardOverflow: card ? getComputedStyle(card).overflow : "",
        };
      });
      expect(before.allocationOverflow).toBe("hidden");
      expect(before.sectionOverflow).toBe("hidden");
      expect(before.tableOverflow).toBe("visible");
      expect(before.cardOverflow).toBe("visible");

      await expandButton.click();
      await expect(materialCard.locator(".bq-reserve-panel")).toBeVisible();
      await expect(materialCard.getByRole("button", { name: "Collapse reserve drawer for Hadanite", exact: true })).toBeVisible();
      const locationFolder = materialCard.locator(".bq-reserve-location-folder").first();
      await expect(locationFolder).toHaveAttribute("open", "");
      await expect(locationFolder.locator(".bq-reserve-quality-folder")).toHaveCount(2);
      await expect(locationFolder.locator(".bq-reserve-stack-row")).toHaveCount(2);
      await expect(locationFolder.locator(".bq-reserve-stack-row").first()).not.toBeVisible();
      await locationFolder.locator(".bq-reserve-quality-folder > summary").first().click();
      await expect(locationFolder.locator(".bq-reserve-stack-row").first()).toBeVisible();

      const after = await page.locator(".bq-item").evaluate((craft) => {
        const card = Array.from(craft.querySelectorAll(".bq-mat-group"))
          .find((candidate) => candidate.textContent?.includes("Hadanite"));
        const drawer = card?.querySelector(".bq-reserve-panel");
        const allocation = craft.querySelector(".bq-materials-card");
        const section = craft.querySelector(".bq-materials-section");
        const table = craft.querySelector(".bq-mat-table");
        const statistics = craft.querySelector(".bq-component-statistics");
        const cardRect = card?.getBoundingClientRect();
        const drawerRect = drawer?.getBoundingClientRect();
        const allocationRect = allocation?.getBoundingClientRect();
        const statisticsRect = statistics?.getBoundingClientRect();
        const allocationZIndex = allocation ? Number.parseInt(getComputedStyle(allocation).zIndex, 10) : 0;
        const statisticsZIndex = statistics ? Number.parseInt(getComputedStyle(statistics).zIndex, 10) : 0;
        return {
          cardWidth: cardRect?.width ?? 0,
          drawerRight: drawerRect?.right ?? 0,
          cardRight: cardRect?.right ?? 0,
          drawerBottom: drawerRect?.bottom ?? 0,
          allocationBottom: allocationRect?.bottom ?? 0,
          allocationHeight: allocationRect?.height ?? 0,
          statisticsTop: statisticsRect?.top ?? 0,
          allocationZIndex,
          statisticsZIndex,
          allocationOverflow: allocation ? getComputedStyle(allocation).overflow : "",
          sectionOverflow: section ? getComputedStyle(section).overflow : "",
          tableOverflow: table ? getComputedStyle(table).overflow : "",
          cardOverflow: card ? getComputedStyle(card).overflow : "",
        };
      });

      expect(Math.abs(after.cardWidth - before.cardWidth)).toBeLessThanOrEqual(1);
      expect(after.drawerRight).toBeLessThanOrEqual(viewport.width);
      expect(after.drawerRight).toBeGreaterThan(after.cardRight);
      expect(Math.abs(after.allocationHeight - before.allocationHeight)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.statisticsTop - before.statisticsTop)).toBeLessThanOrEqual(1);
      expect(after.drawerBottom).toBeGreaterThanOrEqual(1080);
      expect(after.drawerBottom).toBeGreaterThan(after.statisticsTop);
      expect(after.allocationZIndex).toBeGreaterThanOrEqual(after.statisticsZIndex);
      expect(after.allocationOverflow).toBe("visible");
      expect(after.sectionOverflow).toBe("visible");
      expect(after.tableOverflow).toBe("visible");
      expect(after.cardOverflow).toBe("visible");

      const horizontalOverflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      ));
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: path.join(visualTargetDir, `build-queue-drawer-expanded-${viewport.name}.png`),
        fullPage: false,
      });
    }

    expect(failures).toEqual([]);
  });

  test("Crafting Detail uses the shared target slider and recalculates modifiers", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(craftingSliderScreenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(CRAFTING_TARGET_SLIDER_FIXTURE_PATH, { waitUntil: "domcontentloaded" });

      await expect(page.locator('[data-crafting-target-slider-fixture="true"]')).toBeVisible();
      const slider = page.getByRole("slider", { name: "Target quality for Stileron" });
      const editor = slider.locator("xpath=ancestor::*[contains(@class, 'bq-target-editor--slider')]");
      const shell = slider.locator("xpath=ancestor::*[contains(@class, 'bq-target-slider-shell')]");
      const badge = editor.locator(":scope > .bq-target-quality");
      await expect(slider).toHaveValue("860");

      const geometry = await editor.evaluate((element) => {
        const badgeRect = element.querySelector(":scope > .bq-target-quality")?.getBoundingClientRect();
        const shellRect = element.querySelector(".bq-target-slider-shell")?.getBoundingClientRect();
        return {
          badgeWidth: badgeRect?.width ?? 0,
          badgeCenter: badgeRect ? badgeRect.left + badgeRect.width / 2 : 0,
          shellWidth: shellRect?.width ?? 0,
          shellCenter: shellRect ? shellRect.left + shellRect.width / 2 : 0,
        };
      });
      expect(geometry.badgeWidth).toBeLessThanOrEqual(80);
      expect(geometry.shellWidth).toBeGreaterThan(geometry.badgeWidth);
      expect(geometry.shellCenter).toBeGreaterThan(geometry.badgeCenter);

      await expect(shell).toHaveCSS("opacity", "1");
      await editor.hover();
      await expect(shell).toHaveCSS("opacity", "1");
      await slider.focus();
      await expect(badge).toHaveCSS("pointer-events", "auto");
      await expect(slider).toHaveCSS("pointer-events", "auto");

      const modifier = page.locator(".craft-detail-effect-chip strong");
      const beforeModifier = await modifier.textContent();
      const sliderBox = await slider.boundingBox();
      expect(sliderBox).not.toBeNull();
      if (!sliderBox) throw new Error("Crafting Detail target slider has no pointer geometry.");

      await page.mouse.click(sliderBox.x + sliderBox.width - 2, sliderBox.y + sliderBox.height / 2);
      await expect(slider).toHaveValue("937");
      await expect.poll(() => modifier.textContent()).not.toBe(beforeModifier);
      const clickedModifier = await modifier.textContent();

      await slider.focus();
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("500");
      await expect.poll(() => modifier.textContent()).not.toBe(clickedModifier);

      await page.screenshot({
        path: path.join(craftingSliderScreenshotDir, `crafting-detail-target-slider-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });

  test("nested Add Inventory keeps same-quality boxes discrete through emitted and reloaded records", async ({ page }) => {
    const failures = installFailureGuards(page);
    const modalScreenshotDir = path.join(buildQueueArtifactRoot, "inventory-add-modal");
    await mkdir(modalScreenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(INVENTORY_ADD_MODAL_FIXTURE_PATH, { waitUntil: "domcontentloaded" });
      const dialog = page.getByRole("dialog", { name: "Add Inventory" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Number of boxes")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveCount(1);
      await expect(dialog.getByRole("region", { name: /Quality group/ })).toHaveCount(2);
      await expect(dialog.getByRole("spinbutton", { name: /^Quality/ })).toHaveCount(2);
      await expect(dialog.getByRole("spinbutton", { name: "Quality group 1 value" })).toHaveAttribute("placeholder", "500");
      await expect(dialog.getByRole("spinbutton", { name: "Quality group 1 value" })).toHaveCSS("appearance", "textfield");
      await expect(dialog.getByText("Individual Boxes", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Group physical boxes by quality. Each amount creates a separate inventory record.")).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Add Quality/ })).toHaveCount(1);
      await expect(dialog.getByRole("button", { name: /Add Box/ })).toHaveCount(2);
      await expect(dialog.locator(".bq-inv-quick-box-label")).toHaveCount(0);
      await expect(dialog.locator(".bq-inv-quick-box-marker")).toHaveCount(6);
      await expect(dialog.locator(".bq-inv-quick-material-value")).toContainText("Iron");
      await expect(dialog.locator(".bq-inv-quick-material-value")).toContainText("Locked");
      await expect(dialog.getByText("Add other materials from the Inventory page.")).toBeVisible();
      await expect(dialog.locator(".bq-inv-quick-material-value input, .bq-inv-quick-material-value select")).toHaveCount(0);
      const fieldOrder = await dialog.evaluate((element) => {
        const location = element.querySelector("#bq-inv-quick-location")?.getBoundingClientRect();
        const material = element.querySelector(".bq-inv-quick-material-value")?.getBoundingClientRect();
        return { locationTop: location?.top ?? 0, materialTop: material?.top ?? 0 };
      });
      expect(Math.abs(fieldOrder.locationTop - fieldOrder.materialTop)).toBeLessThanOrEqual(16);
      await expect(dialog.getByRole("region", { name: "Quality group 1" }).getByRole("spinbutton", { name: /^Box/ })).toHaveCount(3);
      await expect(dialog.getByRole("region", { name: "Quality group 2" }).getByRole("spinbutton", { name: /^Box/ })).toHaveCount(3);
      await expect(dialog.getByRole("region", { name: "Quality group 1" }).getByRole("spinbutton", { name: /^Box/ }).first()).toHaveCSS("appearance", "textfield");
      for (const groupName of ["Quality group 1", "Quality group 2"]) {
        const group = dialog.getByRole("region", { name: groupName });
        const placement = await group.evaluate((element) => {
          const lastRow = element.querySelector(".bq-inv-quick-box-row:last-of-type")?.getBoundingClientRect();
          const addBox = element.querySelector(".bq-inv-quick-add-box")?.getBoundingClientRect();
          return { lastRowBottom: lastRow?.bottom ?? 0, addBoxTop: addBox?.top ?? 0 };
        });
        expect(placement.addBoxTop).toBeGreaterThanOrEqual(placement.lastRowBottom);
      }

      await page.screenshot({
        path: path.join(modalScreenshotDir, `nested-add-inventory-${viewport.name}.png`),
        fullPage: true,
      });

      if (viewport.name === "1920x1080") {
        const firstGroup = dialog.getByRole("region", { name: "Quality group 1" });
        await firstGroup.getByRole("button", { name: "Add box" }).click();
        await expect(firstGroup.getByRole("spinbutton", { name: /^Box/ })).toHaveCount(4);
        await firstGroup.getByRole("button", { name: "Remove box 4" }).click();
        await expect(firstGroup.getByRole("spinbutton", { name: /^Box/ })).toHaveCount(3);

        await dialog.getByRole("button", { name: "Add quality" }).click();
        await dialog.getByRole("button", { name: "Add quality" }).click();
        await dialog.getByRole("button", { name: "Add quality" }).click();
        await expect(dialog.getByRole("region", { name: /Quality group/ })).toHaveCount(5);
        await expect(dialog.getByRole("button", { name: "Add quality" })).toBeDisabled();

        await page.reload({ waitUntil: "domcontentloaded" });
        const resetDialog = page.getByRole("dialog", { name: "Add Inventory" });
        const firstQuantity = resetDialog.getByRole("region", { name: "Quality group 1" }).getByRole("spinbutton", { name: "Box 1" });
        await firstQuantity.fill("0");
        await resetDialog.getByRole("button", { name: "Add to inventory" }).click();
        await expect(resetDialog.getByText("Enter a valid quality and a quantity greater than zero for every box.").first()).toBeVisible();
        await firstQuantity.fill("1.00");

        await resetDialog.getByRole("button", { name: "Remove quality group 2" }).click();
        await expect(resetDialog.getByRole("region", { name: /Quality group/ })).toHaveCount(1);
        await resetDialog.getByRole("button", { name: "Add quality" }).click();
        await expect(resetDialog.getByRole("region", { name: "Quality group 2" }).getByRole("spinbutton", { name: /^Box/ })).toHaveCount(1);

        await page.reload({ waitUntil: "domcontentloaded" });
        const payloadDialog = page.getByRole("dialog", { name: "Add Inventory" });
        await payloadDialog.getByRole("button", { name: "Add to inventory" }).click();
        const output = page.locator("[data-fixture-emitted]");
        await expect.poll(async () => output.getAttribute("data-fixture-emitted")).not.toBe("[]");
        const emitted = JSON.parse((await output.getAttribute("data-fixture-emitted")) ?? "[]") as Array<{
          id: string;
          recordKind?: string;
          materialType?: string;
          quality?: number;
          quantity: number;
        }>;
        const reloaded = JSON.parse((await output.getAttribute("data-fixture-reloaded")) ?? "[]") as typeof emitted;

        expect(emitted).toHaveLength(6);
        expect(new Set(emitted.map((entry) => entry.id)).size).toBe(6);
        expect(emitted.every((entry) => entry.recordKind === "box")).toBe(true);
        expect(emitted.every((entry) => entry.materialType === "refined")).toBe(true);
        expect(emitted.filter((entry) => entry.quality === 937).reduce((sum, entry) => sum + entry.quantity, 0)).toBe(2.06);
        expect(emitted.filter((entry) => entry.quality === 860).reduce((sum, entry) => sum + entry.quantity, 0)).toBe(1.5);
        expect(reloaded.map((entry) => entry.id)).toEqual(emitted.map((entry) => entry.id));
        expect(reloaded.map((entry) => entry.quantity)).toEqual(emitted.map((entry) => entry.quantity));
        await writeFile(
          path.join(modalScreenshotDir, "emitted-and-reloaded-records.json"),
          `${JSON.stringify({ emitted, reloaded }, null, 2)}\n`,
          "utf8",
        );
      }
    }

    expect(failures).toEqual([]);
  });

  test("Add Inventory preserves the form and stable box ids when a confirmed save must be retried", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${INVENTORY_ADD_MODAL_FIXTURE_PATH}?fail-first=1`, { waitUntil: "domcontentloaded" });

    const dialog = page.getByRole("dialog", { name: "Add Inventory" });
    const submit = dialog.getByRole("button", { name: "Add to inventory" });
    await submit.click();
    await expect(dialog.getByText("Simulated inventory save failure.")).toBeVisible();
    await expect(dialog.getByRole("region", { name: /Quality group/ })).toHaveCount(2);
    await expect(dialog.getByRole("spinbutton", { name: /^Box/ })).toHaveCount(6);

    const output = page.locator("[data-fixture-attempts]");
    const firstAttempts = JSON.parse((await output.getAttribute("data-fixture-attempts")) ?? "[]") as Array<Array<{ id: string }>>;
    expect(firstAttempts).toHaveLength(1);

    await submit.click();
    await expect.poll(async () => page.locator("[data-fixture-emitted]").getAttribute("data-fixture-emitted")).not.toBe("[]");
    const finalAttempts = JSON.parse((await output.getAttribute("data-fixture-attempts")) ?? "[]") as Array<Array<{ id: string }>>;
    expect(finalAttempts).toHaveLength(2);
    expect(finalAttempts[1].map((entry) => entry.id)).toEqual(finalAttempts[0].map((entry) => entry.id));
    expect(failures).toEqual([]);
  });

  test("renders identity-only headers + consolidated component statistics for ship and FPS components", async ({ page }) => {
    const failures = installFailureGuards(page);
    const externalApiRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/") && url.origin !== "http://127.0.0.1:5175") {
        externalApiRequests.push(request.url());
      }
    });
    await mkdir(sharedStatsScreenshotDir, { recursive: true });

    const readAllStatContent = async () => {
      const panel = page.locator(".bq-component-statistics");
      const performanceTab = page.getByRole("tab", { name: "Performance" });
      const engineeringTab = page.getByRole("tab", { name: "Engineering" });
      await performanceTab.click();
      const performanceLabels = await panel.locator(".bq-stat-compact-label").allTextContents();
      const performanceGroups = await panel.locator(".craft-stat-section-title").allTextContents();
      await engineeringTab.click();
      const engineeringLabels = await panel.locator(".bq-stat-compact-label").allTextContents();
      const engineeringGroups = await panel.locator(".craft-stat-section-title").allTextContents();
      await performanceTab.click();
      return {
        labels: [...performanceLabels, ...engineeringLabels],
        groups: [...performanceGroups, ...engineeringGroups],
      };
    };

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BUILD_QUEUE_STATS_FIXTURE_PATH, { waitUntil: "domcontentloaded" });

      await expect(page.locator('[data-bq-fixture="stats"]')).toBeVisible();
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(4);
      await expect(page.locator(".bq-craft-card").nth(0)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(1)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(2)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(3)).toContainText("AD5B Ballistic Gatling");
      await expect(page.locator(".bq-center-col")).toBeVisible();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Pyro Defense Refit");

      if (viewport.name === "1920x1080") {
        const missionLink = page.locator(".bq-item-blueprint-link").first();
        await expect(missionLink).toHaveText("Xenothreat 2 85 01");
        await expect(missionLink).toHaveAttribute("href", "/industry/missions?concept=xenothreat-2-85-01");

        await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
        await expect(page.locator(".bq-item-header .bq-stat-compare-row")).toHaveCount(0);
        await expect(page.locator(".bq-item-identity .bq-stats-meta--header")).toBeVisible();
        await expect(page.locator(".bq-component-statistics .bq-stat-unmodified-column")).toBeVisible();
        await expect(page.locator(".bq-component-statistics .bq-stat-modified-card")).toHaveCount(0);
        await expect(page.locator(".bq-craft-outcome")).toBeVisible();
        await expect(page.locator(".bq-component-statistics .bq-stat-compact-row").first()).toBeVisible();
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Not modified");
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Thermal / Power");
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Projectile Range / Max Travel");
        await expect(page.locator(".bq-craft-outcome .craft-stat-compact-row").first()).toBeVisible();

        const targetInput = page.getByRole("spinbutton", { name: "Target quality for Stileron" }).first();
        const targetEditor = targetInput.locator("xpath=ancestor::*[contains(@class, 'bq-target-editor--input')]");
        await expect(targetEditor.locator(".bq-target-editor-label")).toHaveText("Target");
        await expect(targetEditor.locator(".bq-target-slider-shell")).toHaveCount(0);
        await expect(page.getByRole("slider", { name: "Target quality for Stileron" })).toHaveCount(0);
        const inputGeometry = await targetEditor.evaluate((editor) => {
          const input = editor.querySelector(".bq-target-quality-input")?.getBoundingClientRect();
          const header = editor.closest(".bq-mat-card-head")?.getBoundingClientRect();
          const identity = editor.closest(".bq-mat-row")?.querySelector(".bq-mat-identity")?.getBoundingClientRect();
          return {
            inputWidth: input?.width ?? 0,
            headerTop: header?.top ?? 0,
            identityTop: identity?.top ?? 0,
          };
        });
        expect(inputGeometry.inputWidth).toBeLessThanOrEqual(90);
        expect(inputGeometry.headerTop).toBe(0);
        expect(inputGeometry.identityTop).toBeGreaterThan(0);

        const previousQuality = await targetInput.inputValue();
        expect(previousQuality).not.toBe("");
        await targetInput.focus();
        await expect(targetInput).toHaveValue("");
        await page.locator(".bq-component-statistics-title").click();
        await expect(targetInput).toHaveValue(previousQuality);
        await targetInput.focus();
        await targetInput.fill("640");
        await targetInput.blur();
        await expect(targetInput).toHaveValue("640");
        await targetInput.fill(previousQuality);
        await targetInput.blur();
        await expect(targetInput).toHaveValue(previousQuality);

        await page.locator(".bq-craft-card").filter({ hasText: "Missing" }).first().click();
        await expect(page.locator('[data-bq-outcome-state="unallocated"]')).toContainText("No materials allocated");
        await expect(page.locator(".bq-craft-outcome-empty--centered")).toBeVisible();
        await page.locator(".bq-craft-card").nth(0).click();
        await expect(page.locator(".bq-item-name")).toHaveText("FR-66");

        await page.screenshot({
          path: path.join(sharedStatsScreenshotDir, `bq-target-slider-hover-${viewport.name}.png`),
          fullPage: true,
        });

        await expect(page.locator(".bq-mat-head")).toHaveCount(0);
        const allocationLayout = await page.locator(".bq-item").evaluate((craft) => {
          const allocation = craft.querySelector(".bq-materials-section");
          const statistics = craft.querySelector(".bq-component-statistics");
          const cards = Array.from(craft.querySelectorAll(".bq-mat-group"));
          return {
            allocationTop: allocation?.getBoundingClientRect().top ?? 0,
            statisticsTop: statistics?.getBoundingClientRect().top ?? 0,
            cardCount: cards.length,
            cardTops: cards.map((card) => card.getBoundingClientRect().top),
          };
        });
        expect(allocationLayout.allocationTop).toBeLessThan(allocationLayout.statisticsTop);
        expect(allocationLayout.cardCount).toBeGreaterThan(1);
        expect(new Set(allocationLayout.cardTops.map((top) => Math.round(top))).size).toBe(allocationLayout.cardCount);

        const inventoryToggle = page.locator(".bq-inventory-toggle");
        const materialCards = page.locator(".bq-mat-group");
        await expect(inventoryToggle).toBeVisible();
        await expect(inventoryToggle).toHaveAttribute("aria-pressed", "true");
        await inventoryToggle.click();
        await expect(inventoryToggle).toHaveAttribute("aria-pressed", "false");
        await expect(materialCards.locator(".bq-target-editor")).toHaveCount(allocationLayout.cardCount);
        await expect(materialCards.locator(".bq-mat-card-total-need")).toHaveCount(allocationLayout.cardCount);
        await expect(materialCards.locator(".bq-avg-quality")).toHaveCount(0);
        await expect(materialCards.locator(".bq-mat-card-status")).toHaveCount(0);
        await expect(materialCards.locator(".bq-mat-card-quality")).toHaveCount(0);
        await expect(materialCards.locator(".bq-mat-actions")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Auto reserve inventory for/ })).toBeDisabled();
        await inventoryToggle.click();
        await expect(inventoryToggle).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: /Auto reserve inventory for/ })).toBeDisabled();
      }

      for (const item of fixtureItems) {
        await selectQueue(page, item.queue);
        await selectFixtureItem(page, item.id, item.name);
        await expect(page.locator(".bq-materials-section")).toBeVisible();
        await expect(page.locator(".bq-mat-table")).toBeVisible();
        let statContent = { labels: [] as string[], groups: [] as string[] };

        if (item.expectGroupedStats) {
          await expect(page.locator(".bq-item-stats")).toHaveCount(0);
          await expect(page.locator(".bq-item-identity .bq-stats-meta")).toBeVisible();
          await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
          statContent = await readAllStatContent();
          expect(statContent.labels.length).toBeGreaterThan(0);
          const visibleGroups = page.locator(".bq-component-statistics .bq-stat-unmodified-group");
          if (await visibleGroups.count() === 0) {
            await page.getByRole("tab", { name: "Engineering" }).click();
          }
          await expect(visibleGroups.first()).toBeVisible();
          const sharedStatLayout = await page.locator(".bq-component-statistics").evaluate((panel) => {
            const groups = Array.from(panel.querySelectorAll(".bq-stat-unmodified-group"));
            const traitColumns = panel.querySelectorAll(".bq-stat-unmodified-column > .bq-stat-trait-column");
            const groupHeadings = Array.from(panel.querySelectorAll(".craft-stat-section-title"));
            const firstGroup = groups[0];
            const heading = firstGroup?.querySelector(":scope > .craft-stat-section-surface > .craft-stat-section-title");
            const card = firstGroup?.querySelector(":scope > .bq-stat-unmodified-card");
            const headingRect = heading?.getBoundingClientRect();
            const cardRect = card?.getBoundingClientRect();
            const icons = Array.from(panel.querySelectorAll(".bq-stat-group-icon"));
            return {
              groupCount: groups.length,
              traitColumnCount: traitColumns.length,
              missingIconTitles: groupHeadings
                .filter((heading) => !heading.querySelector(".bq-stat-group-icon"))
                .map((heading) => heading.textContent?.trim() ?? ""),
              iconSources: icons.map((icon) => ({
                tag: icon.tagName,
                src: icon instanceof HTMLImageElement ? (icon.currentSrc || icon.getAttribute("src") || "") : "",
                spriteClass: Array.from(icon.classList).some((className) => /^bq-stat-group-icon--\d{2}$/.test(className)),
                backgroundImage: getComputedStyle(icon).backgroundImage,
              })),
              headingInsideCard: Boolean(
                heading
                && card
                && card.contains(heading)
                && headingRect
                && cardRect
                && headingRect.top >= cardRect.top
                && headingRect.bottom <= cardRect.bottom,
              ),
              clippedGroups: groups.filter((group) => {
                const groupRect = group.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                return groupRect.left < panelRect.left - 1 || groupRect.right > panelRect.right + 1;
              }).length,
            };
          });
          expect(sharedStatLayout.groupCount).toBeGreaterThan(0);
          expect(sharedStatLayout.traitColumnCount).toBe(0);
          expect(sharedStatLayout.missingIconTitles).toEqual([]);
          expect(sharedStatLayout.iconSources.length).toBeGreaterThan(0);
          expect(sharedStatLayout.iconSources.every((icon) => (
            icon.tag === "IMG"
            && /component-stat-icons\//.test(icon.src)
            && icon.spriteClass === false
            && (icon.backgroundImage === "none" || icon.backgroundImage === "")
          ))).toBe(true);
          expect(sharedStatLayout.headingInsideCard).toBe(true);
          expect(sharedStatLayout.clippedGroups).toBe(0);
          await page.getByRole("tab", { name: "Performance" }).click();
        } else {
          await expect(page.locator(".bq-component-statistics")).toBeVisible();
        }

        if (item.id === FIXTURE_ITEM_IDS.ad5b) {
          const compactLabels = statContent.labels;
          expect(statContent.groups).toContain("Ammunition");
          expect(statContent.groups).not.toContain("Falloff");
          expect(compactLabels[0]).toBe("Alpha");
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Fire Rate",
            "Speed",
            "Alpha",
            "Heat Per Shot",
            "Min–Max",
            "Near Radius",
            "Far Radius",
            "Overheat Recovery",
            "Mass",
            "Health",
          ]));
          expect(compactLabels).not.toEqual(expect.arrayContaining([
            "Ballistic Damage",
            "Physical Damage",
            "Energy Damage",
          ]));
          const modifiedLabels = await page.locator(".bq-craft-outcome .bq-stat-compact-label").allTextContents();
          expect(modifiedLabels).toEqual(["Alpha", "Health"]);
          const compactValues = await page.locator(".bq-stat-compact-value").allTextContents();
          expect(compactValues).not.toContain("0%");

          const allocationColors = await page.evaluate(() => {
            const beneficialValue = document.querySelector(".bq-craft-outcome .craft-stat-compact-value.craft-ok");
            return {
              beneficial: beneficialValue ? getComputedStyle(beneficialValue).color : "",
            };
          });
          expect(allocationColors.beneficial).not.toBe("");
        }

        if (item.id === FIXTURE_ITEM_IDS.cq7) {
          const compactLabels = statContent.labels;
          expect(statContent.groups).toContain("Falloff");
          expect(statContent.groups).not.toContain("Ammunition");
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Alpha",
            "DPS",
            "Fire Rate",
            "Burst Size",
            "Ammo Count",
            "Speed",
            "Lifetime",
            "Damage Falloff Start",
            "Min–Max",
            "First Attack",
            "Per Attack",
            "Decay",
          ]));
        }

        if (item.id === FIXTURE_ITEM_IDS.fpsArmor) {
          const compactLabels = statContent.labels;
          const groupTitles = statContent.groups;
          expect(compactLabels).toContain("Damage Mitigation");
          expect(compactLabels).not.toEqual(expect.arrayContaining([
            "Armor Temperature Min",
            "Armor Temperature Max",
          ]));
          expect(groupTitles).not.toContain("Additional");
        }

        if (item.id === FIXTURE_ITEM_IDS.fr66) {
          const compactLabels = statContent.labels;
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Downed Regen Delay",
            "Regen by Power",
            "Repair Restore Ratio",
          ]));
        }

        if (item.id === FIXTURE_ITEM_IDS.atlas) {
          const compactLabels = statContent.labels;
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Fuel Requirement",
            "Calibration Delay",
            "Calibration Time (derived)",
            "Stage One Acceleration",
            "Stage Two Acceleration",
          ]));
        }

        if (item.id === FIXTURE_ITEM_IDS.snowBlind) {
          const compactLabels = statContent.labels;
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Coolant Generation",
            "Thermal Equalization Rate",
            "Cooling by Power",
            "Distortion Maximum",
            "Repair Restore Ratio",
          ]));
        }

        if (item.id === FIXTURE_ITEM_IDS.js300) {
          const compactLabels = statContent.labels;
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Power Generation",
            "Distortion Maximum",
            "Repair Restore Ratio",
          ]));
        }

        if (item.id === FIXTURE_ITEM_IDS.m5a) {
          const compactLabels = statContent.labels;
          expect(statContent.groups).toContain("Ammunition");
          expect(statContent.groups).not.toContain("Falloff");
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Energy Maximum Load",
            "Energy Recharge Rate",
            "Recharge Cooldown",
            "Ammo Per Shot",
            "Min–Max",
            "Near Radius",
            "Far Radius",
          ]));
          expect(compactLabels).not.toContain("Ballistic Reserve");
          expect(compactLabels).not.toContain("Ammo Count");
        }

        await page.screenshot({
          path: path.join(sharedStatsScreenshotDir, `bq-stats-${item.id}-${viewport.name}.png`),
          fullPage: true,
        });
      }

      await selectQueue(page, "Pyro Defense Refit");
      await page.locator(".bq-queue-selector-trigger").click();
      await expect(page.getByRole("option")).toHaveCount(4);
      const selectorPosition = await page.locator(".bq-queue-selector-popover").evaluate((popover) => {
        const trigger = popover.parentElement?.querySelector(".bq-queue-selector-trigger")?.getBoundingClientRect();
        const menu = popover.getBoundingClientRect();
        return { triggerBottom: trigger?.bottom ?? 0, menuTop: menu.top, menuBottom: menu.bottom, viewportHeight: window.innerHeight };
      });
      expect(selectorPosition.menuTop).toBeGreaterThanOrEqual(selectorPosition.triggerBottom);
      expect(selectorPosition.menuBottom).toBeLessThanOrEqual(selectorPosition.viewportHeight);
      await page.screenshot({ path: path.join(sharedStatsScreenshotDir, `bq-queue-selector-${viewport.name}.png`), fullPage: true });

      await page.getByRole("button", { name: "+ New" }).click();
      await expect(page.getByRole("form", { name: "Create queue" })).toBeVisible();
      await page.getByLabel("New queue name").fill("Carrier Refit Batch");
      await page.screenshot({ path: path.join(sharedStatsScreenshotDir, `bq-queue-create-${viewport.name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Carrier Refit Batch");
      await expect(page.locator(".bq-craft-card")).toHaveCount(0);

      await page.locator(".bq-queue-selector-trigger").click();
      await page.getByRole("button", { name: "Rename" }).click();
      await page.getByLabel("Queue name").fill("Carrier Refit Priority");
      await page.screenshot({ path: path.join(sharedStatsScreenshotDir, `bq-queue-rename-${viewport.name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Carrier Refit Priority");

      await selectQueue(page, "Ground Team Loadout");
      await expect(page.locator(".bq-craft-card")).toHaveCount(2);
      await expect(page.locator(".bq-craft-card").first()).toContainText('P6-LR "Archangel" Sniper Rifle');
      await expect(page.getByRole("spinbutton", { name: "Target quality for Taranite" })).toHaveValue("820");
      await expect(page.locator(".bq-quality-chip").first()).toContainText("820");
      await page.screenshot({ path: path.join(sharedStatsScreenshotDir, `bq-distinct-queues-${viewport.name}.png`), fullPage: true });

      await selectQueue(page, "Pyro Defense Refit");
      await expect(page.locator(".bq-craft-card").nth(0)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(3)).toContainText("AD5B Ballistic Gatling");

      await selectQueue(page, "Carrier Refit Priority");
      await page.locator(".bq-queue-selector-trigger").click();
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("alertdialog", { name: "Delete queue confirmation" })).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Expedition Spares");
      await expect(page.locator(".bq-craft-card")).toHaveCount(1);

      const horizontalOverflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      ));
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }

    expect(failures).toEqual([]);
    expect(externalApiRequests).toEqual([]);
  });

  test("projects stable drag destinations, moves queues, completes crafts, and creates a new queue", async ({ page }) => {
    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
    ]) {
      const persistenceKey = `ordering-${viewport.name}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?persist=${persistenceKey}`, { waitUntil: "domcontentloaded" });
      await page.evaluate((key) => localStorage.removeItem(`bq-fixture:${key}`), persistenceKey);
      await page.reload({ waitUntil: "domcontentloaded" });

      const entryIds = () => page.locator(".bq-craft-card-shell").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-bq-entry-id")));
      await expect(page.locator(".bq-craft-card")).toHaveCount(4);
      expect(await entryIds()).toEqual([
        FIXTURE_ITEM_IDS.fr66,
        FIXTURE_ITEM_IDS.fr66High,
        FIXTURE_ITEM_IDS.fr66Precision,
        FIXTURE_ITEM_IDS.ad5b,
      ]);

      const firstHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66}"] .bq-craft-card-drag-handle`);
      const firstHandleBox = await firstHandle.boundingBox();
      if (!firstHandleBox) throw new Error("First drag handle has no pointer geometry.");
      await page.mouse.move(firstHandleBox.x + firstHandleBox.width / 2, firstHandleBox.y + firstHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(firstHandleBox.x + firstHandleBox.width / 2 + 14, firstHandleBox.y + firstHandleBox.height / 2 + 14, { steps: 4 });
      await expect(page.locator(".bq-drag-destinations")).toBeVisible();
      await expect(page.locator(".bq-craft-card-drop-placeholder")).toHaveCount(1);
      await expect(page.locator(".bq-craft-card-shell.is-dragging")).toBeVisible();
      await expect(page.locator(".bq-craft-card-shell.is-drag-context:not(.is-dragging)").first()).toHaveCSS("opacity", "0.68");
      const secondCard = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66High}"] .bq-craft-card`);
      const secondCardBox = await secondCard.boundingBox();
      if (!secondCardBox) throw new Error("Second card has no pointer geometry.");
      // This remains a one-position move until the cursor passes the next card midpoint.
      await page.mouse.move(secondCardBox.x + secondCardBox.width / 2, secondCardBox.y + secondCardBox.height / 2 + 4, { steps: 8 });
      await expect(page.locator(".bq-craft-card-drop-placeholder")).toBeVisible();
      await page.mouse.up();
      expect(await entryIds()).toEqual([
        FIXTURE_ITEM_IDS.fr66High,
        FIXTURE_ITEM_IDS.fr66,
        FIXTURE_ITEM_IDS.fr66Precision,
        FIXTURE_ITEM_IDS.ad5b,
      ]);

      const keyboardHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66High}"] .bq-craft-card-drag-handle`);
      await keyboardHandle.focus();
      await page.keyboard.press("ArrowDown");
      expect(await entryIds()).toEqual([
        FIXTURE_ITEM_IDS.fr66,
        FIXTURE_ITEM_IDS.fr66High,
        FIXTURE_ITEM_IDS.fr66Precision,
        FIXTURE_ITEM_IDS.ad5b,
      ]);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".bq-craft-card")).toHaveCount(4);
      expect(await entryIds()).toEqual([
        FIXTURE_ITEM_IDS.fr66,
        FIXTURE_ITEM_IDS.fr66High,
        FIXTURE_ITEM_IDS.fr66Precision,
        FIXTURE_ITEM_IDS.ad5b,
      ]);

      const moveHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66High}"] .bq-craft-card-drag-handle`);
      const moveHandleBox = await moveHandle.boundingBox();
      if (!moveHandleBox) throw new Error("Move drag handle has no pointer geometry.");
      await page.mouse.move(moveHandleBox.x + moveHandleBox.width / 2, moveHandleBox.y + moveHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(moveHandleBox.x + moveHandleBox.width / 2 + 14, moveHandleBox.y + moveHandleBox.height / 2 + 14, { steps: 4 });
      const groundDestination = page.locator(".bq-drag-destination").filter({ hasText: "Ground Team Loadout" });
      await expect(groundDestination).toBeVisible();
      const groundBox = await groundDestination.boundingBox();
      if (!groundBox) throw new Error("Ground destination has no pointer geometry.");
      await page.mouse.move(groundBox.x + groundBox.width / 2, groundBox.y + groundBox.height / 2, { steps: 8 });
      await expect(groundDestination).toHaveClass(/is-over/);
      await expect(groundDestination).toHaveCSS("background-color", "rgba(40, 137, 179, 0.28)");
      await page.mouse.up();
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66High}"]`)).toHaveCount(0);
      await selectQueue(page, "Ground Team Loadout");
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66High}"]`)).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(3);

      await selectQueue(page, "Pyro Defense Refit");
      const completeHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66Precision}"] .bq-craft-card-drag-handle`);
      const completeHandleBox = await completeHandle.boundingBox();
      if (!completeHandleBox) throw new Error("Complete drag handle has no pointer geometry.");
      await page.mouse.move(completeHandleBox.x + completeHandleBox.width / 2, completeHandleBox.y + completeHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(completeHandleBox.x + completeHandleBox.width / 2 + 14, completeHandleBox.y + completeHandleBox.height / 2 + 14, { steps: 4 });
      const completedDestination = page.locator(".bq-drag-destination--completed");
      await expect(completedDestination).toBeVisible();
      const completedBox = await completedDestination.boundingBox();
      if (!completedBox) throw new Error("Completed destination has no pointer geometry.");
      await page.mouse.move(completedBox.x + completedBox.width / 2, completedBox.y + completedBox.height / 2, { steps: 8 });
      await expect(completedDestination).toHaveClass(/is-over/);
      await expect(completedDestination).toContainText("Move to Completed");
      await page.mouse.up();

      await expect(page.getByRole("tab", { name: /Completed/ })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66Precision}"] .bq-craft-card-check`)).toBeVisible();
      await page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66Completed}"] .bq-craft-card`).click();
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66Completed}"] .bq-craft-card-check`)).toBeVisible();
      await expect(page.locator(".bq-quality-chip")).toHaveCount(3);
      await expect(page.locator(".bq-balance--short")).toHaveCount(0);
      await expect(page.locator(".bq-stale-line")).toHaveCount(0);
      await expect(page.locator(".bq-materials-section")).not.toContainText("below target");

      await page.getByRole("tab", { name: /Active/ }).click();
      const activeOrderBeforeCancel = await entryIds();
      const cancelHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.fr66}"] .bq-craft-card-drag-handle`);
      const cancelHandleBox = await cancelHandle.boundingBox();
      if (!cancelHandleBox) throw new Error("Cancel drag handle has no pointer geometry.");
      await page.mouse.move(cancelHandleBox.x + cancelHandleBox.width / 2, cancelHandleBox.y + cancelHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(cancelHandleBox.x + 16, cancelHandleBox.y + 16, { steps: 4 });
      await expect(page.locator(".bq-drag-destinations")).toBeVisible();
      await page.mouse.up();
      await expect(page.locator(".bq-drag-destinations")).toHaveCount(0);
      expect(await entryIds()).toEqual(activeOrderBeforeCancel);

      const newQueueHandle = page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.ad5b}"] .bq-craft-card-drag-handle`);
      const newQueueTransfer = await page.evaluateHandle(() => new DataTransfer());
      await newQueueHandle.dispatchEvent("dragstart", { dataTransfer: newQueueTransfer });
      const newQueueDestination = page.locator(".bq-drag-destination--new-queue");
      await expect(newQueueDestination).toBeVisible();
      await newQueueDestination.dispatchEvent("dragenter", { dataTransfer: newQueueTransfer });
      await newQueueDestination.dispatchEvent("dragover", { dataTransfer: newQueueTransfer });
      await expect(newQueueDestination).toHaveClass(/is-over/);
      await newQueueDestination.dispatchEvent("drop", { dataTransfer: newQueueTransfer });
      await newQueueHandle.dispatchEvent("dragend", { dataTransfer: newQueueTransfer });

      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("New Queue");
      await expect(page.locator('form[aria-label="Rename queue"]')).toBeVisible();
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.ad5b}"]`)).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(1);
    }
  });

  test("keeps decorative SVG frames on queue items without intercepting the live workspace", async ({ page }) => {
    const failures = installFailureGuards(page);
    const frameScreenshotDir = path.join(buildQueueArtifactRoot, "build-queue-frames");
    await mkdir(frameScreenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080, screenshot: true },
      { name: "1440x900", width: 1440, height: 900, screenshot: false },
      { name: "1024x768", width: 1024, height: 768, screenshot: false },
      { name: "768x900", width: 768, height: 900, screenshot: true },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BUILD_QUEUE_STATS_FIXTURE_PATH, { waitUntil: "domcontentloaded" });

      await expect(page.locator('[data-bq-fixture="stats"]')).toBeVisible();
      await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.bq-item-header > img[src$="detail-panel-frame.svg"]')).toHaveCount(0);
      await expect(page.locator('.bq-queue-col-head > .bq-decorative-frame, .bq-center-shell > .bq-decorative-frame, .bq-item-visual > .bq-decorative-frame, .bq-component-statistics > .bq-decorative-frame, .bq-materials-section > .bq-decorative-frame, .bq-mat-row > .bq-decorative-frame')).toHaveCount(0);

      const frames = page.locator(".bq-decorative-frame");
      if (viewport.width > 768) {
        expect(await frames.count()).toBeGreaterThanOrEqual(1);
      } else {
        await expect(frames).toHaveCount(0);
      }
      for (const frame of await frames.all()) {
        await expect(frame).toHaveAttribute("alt", "");
        await expect(frame).toHaveAttribute("aria-hidden", "true");
        await expect(frame).toHaveCSS("pointer-events", "none");
      }

      const frameGeometry = await frames.evaluateAll((images) => images.map((image) => {
        const frame = image.getBoundingClientRect();
        const host = image.parentElement?.getBoundingClientRect();
        return {
          src: image.getAttribute("src"),
          hostClass: image.parentElement?.className,
          loaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          widthDelta: host ? Math.abs(frame.width - host.width) : Number.POSITIVE_INFINITY,
          heightDelta: host ? Math.abs(frame.height - host.height) : Number.POSITIVE_INFINITY,
          tabIndex: (image as HTMLElement).tabIndex,
        };
      }));
      expect(frameGeometry.every((frame) => frame.loaded)).toBe(true);
      expect(frameGeometry.every((frame) => frame.widthDelta <= 1 && frame.heightDelta <= 1), JSON.stringify(frameGeometry, null, 2)).toBe(true);
      expect(frameGeometry.every((frame) => frame.tabIndex === -1)).toBe(true);

      if (viewport.width > 768) {
        await expect(page.locator('.bq-craft-card.is-selected > img[src$="queue-item-frame-active.svg"]')).toHaveCount(1);
        await expect(page.locator('.bq-craft-card:not(.is-selected) > img[src$="queue-item-frame.svg"]')).toHaveCount(3);
      } else {
        await expect(page.locator(".bq-queue-pill")).toHaveCount(4);
        const mobileFlow = await page.locator(".bq-layout").evaluate((layout) => {
          const queue = layout.querySelector(".bq-queue-col")?.getBoundingClientRect();
          const workspace = layout.querySelector(".bq-center-col")?.getBoundingClientRect();
          return { queueBottom: queue?.bottom ?? 0, workspaceTop: workspace?.top ?? 0 };
        });
        expect(mobileFlow.workspaceTop).toBeGreaterThanOrEqual(mobileFlow.queueBottom - 1);
      }

      await expect(page.getByRole("button", { name: /Complete FR-66/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Auto reserve inventory for FR-66/ })).toBeVisible();
      await expect(page.locator(".bq-item-visual .bq-product-icon")).toBeVisible();

      const horizontalOverflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      ));
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      if (viewport.screenshot) {
        await page.screenshot({
          path: path.join(frameScreenshotDir, `build-queue-frames-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  test("renders the allocation-first target workspace and updates the craft outcome", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1560, height: 1008 });
    await page.goto(`${BUILD_QUEUE_STATS_FIXTURE_PATH}?target=1`, { waitUntil: "domcontentloaded" });

    await expect(page.locator(".bq-item-name")).toHaveText("AD5B Ballistic Gatling");
    await expect(page.locator('.bq-item-visual img[src$="/component-thumbnails/ad5b.png"]')).toBeVisible();
    await expect(page.locator(".bq-mat-group")).toHaveCount(3);
    await expect(page.locator(".bq-craft-outcome")).toBeVisible();
    await expect(page.locator(".bq-stat-modified-card")).toHaveCount(0);
    await expect(page.locator(".bq-craft-outcome .craft-ok").first()).toBeVisible();
    await expect(page.locator(".bq-craft-outcome .craft-shortage").first()).toBeVisible();
    await expect(page.locator(".bq-selected-summary-strip")).toContainText("67%");

    const primaryGeometry = await page.locator(".bq-primary-workspace-grid").evaluate((workspace) => {
      const allocation = workspace.querySelector(".bq-materials-card")?.getBoundingClientRect();
      const outcome = workspace.querySelector(".bq-craft-outcome")?.getBoundingClientRect();
      return {
        allocationWidth: allocation?.width ?? 0,
        outcomeWidth: outcome?.width ?? 0,
        allocationTop: allocation?.top ?? 0,
        outcomeTop: outcome?.top ?? 0,
      };
    });
    expect(primaryGeometry.allocationWidth).toBeGreaterThan(primaryGeometry.outcomeWidth * 1.5);
    expect(Math.abs(primaryGeometry.allocationTop - primaryGeometry.outcomeTop)).toBeLessThanOrEqual(1);

    const statistics = page.locator(".bq-component-statistics");
    await expect(statistics).toContainText("Damage Output");
    await expect(statistics).not.toContainText("Thermal and Power");
    await page.getByRole("tab", { name: "Engineering" }).click();
    await expect(statistics).toContainText("Thermal and Power");
    await expect(statistics).toContainText("Signature and Detection");
    await expect(statistics).toContainText("Durability and Physical");
    await expect(statistics).toContainText("Repair");
    await expect(statistics).not.toContainText("Damage Output");

    await page.getByRole("button", { name: "Auto reserve inventory for AD5B Ballistic Gatling" }).click();
    await expect(page.getByRole("dialog", { name: "Auto Reserve Preview" })).toBeVisible();
    await page.getByRole("button", { name: "Reserve These" }).click();
    await expect(page.locator(".bq-selected-summary-strip")).toContainText("100%");
    await expect(page.locator(".bq-craft-outcome-quality-grid")).not.toContainText("Predicted Quality—");

    await page.setViewportSize({ width: 1100, height: 900 });
    const compactGeometry = await page.locator(".bq-primary-workspace-grid").evaluate((workspace) => {
      const allocation = workspace.querySelector(".bq-materials-card")?.getBoundingClientRect();
      const outcome = workspace.querySelector(".bq-craft-outcome")?.getBoundingClientRect();
      return {
        allocationBottom: allocation?.bottom ?? 0,
        outcomeTop: outcome?.top ?? 0,
      };
    });
    expect(compactGeometry.outcomeTop).toBeGreaterThanOrEqual(compactGeometry.allocationBottom - 1);
    expect(failures).toEqual([]);
  });
});
