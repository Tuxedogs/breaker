import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type InventoryGridMeasurement = {
  viewport: string;
  cardCount: number;
  maxCardsOnSameRow: number;
  collectionWidth: number;
  locationPanelWidth: number;
  collectionToPanelRatio: number;
  pageClientWidth: number;
  pageScrollWidth: number;
  horizontalOverflow: number;
  gridTemplateColumns: string;
  columnCount: number;
  gap: string;
  cardWidths: number[];
};

const fixturePath = "/logistics/inventory/__fixture/layout";
const screenshotDir = path.resolve(process.cwd(), "test-results", "inventory-layout");

function installFailureGuards(page: Page) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console error: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    failures.push(`request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      failures.push(`HTTP ${status}: ${response.url()}`);
    }
  });

  return failures;
}

async function measureInventoryGrid(page: Page, viewport: string): Promise<InventoryGridMeasurement> {
  await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-inventory-fixture="layout"]')).toBeVisible();
  await expect(page.locator(".logi-location-detail")).toBeVisible();
  await expect(page.locator(".logi-location-detail .logi-location-material-card")).toHaveCount(6);

  return page.evaluate((viewport) => {
    const collection = document.querySelector<HTMLElement>(
      ".logi-location-detail .logi-location-window-block--cards",
    );
    const panel = document.querySelector<HTMLElement>(".logi-location-detail");
    const cards = Array.from(document.querySelectorAll<HTMLElement>(
      ".logi-location-detail .logi-location-material-card",
    ));

    if (!collection || !panel || cards.length === 0) {
      throw new Error("Inventory fixture material grid did not render.");
    }

    const cardRects = cards.map((card) => card.getBoundingClientRect());
    const rows = new Map<number, number>();
    for (const rect of cardRects) {
      const rowTop = Math.round(rect.top);
      rows.set(rowTop, (rows.get(rowTop) ?? 0) + 1);
    }

    const collectionRect = collection.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const styles = window.getComputedStyle(collection);
    const columns = styles.gridTemplateColumns
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      viewport,
      cardCount: cards.length,
      maxCardsOnSameRow: Math.max(...rows.values()),
      collectionWidth: Math.round(collectionRect.width),
      locationPanelWidth: Math.round(panelRect.width),
      collectionToPanelRatio: collectionRect.width / panelRect.width,
      pageClientWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      gridTemplateColumns: styles.gridTemplateColumns,
      columnCount: columns.length,
      gap: styles.gap,
      cardWidths: cardRects.map((rect) => Math.round(rect.width)),
    };
  }, viewport);
}

test.describe("Inventory location material layout", () => {
  test("renders expanded Levski materials as a responsive grid at desktop and 2K", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    const measurements: InventoryGridMeasurement[] = [];

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const measurement = await measureInventoryGrid(page, viewport.name);
      measurements.push(measurement);

      expect(measurement.cardCount, `${viewport.name} card count`).toBeGreaterThanOrEqual(6);
      expect(measurement.maxCardsOnSameRow, `${viewport.name} cards on same row`).toBeGreaterThanOrEqual(3);
      expect(measurement.collectionToPanelRatio, `${viewport.name} collection width ratio`).toBeGreaterThan(0.94);
      expect(measurement.horizontalOverflow, `${viewport.name} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(Math.max(...measurement.cardWidths), `${viewport.name} material card max width`).toBeLessThanOrEqual(462);
      expect(measurement.columnCount, `${viewport.name} grid columns`).toBeGreaterThanOrEqual(3);

      await page.screenshot({
        path: path.join(screenshotDir, `inventory-layout-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await writeFile(
      path.join(screenshotDir, "inventory-layout-measurements.json"),
      `${JSON.stringify(measurements, null, 2)}\n`,
      "utf8",
    );

    expect(failures).toEqual([]);
  });
});
