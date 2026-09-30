import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const fixturePath = "/logistics/inventory/__fixture/layout";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "inventory-redesign");

function installFailureGuards(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return failures;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth - dimensions.clientWidth).toBeLessThanOrEqual(1);
}

function location(page: Page, locationId: string) {
  return page.locator(`.logi-inv-workspace-location[data-location-id="${locationId}"]`);
}

function lot(page: Page, lotId: string) {
  return page.locator(`[data-lot-id="${lotId}"]`);
}

async function armAndDrop(source: Locator, target: Locator) {
  const dataTransfer = await source.page().evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
}

test.describe("Inventory workspace acceptance", () => {
  test("captures the responsive workspace without horizontal overflow", async ({ page }) => {
    test.setTimeout(120_000);
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "375x812", width: 375, height: 812 },
      { name: "390x844", width: 390, height: 844 },
      { name: "393x852", width: 393, height: 852 },
      { name: "430x932", width: 430, height: 932 },
      { name: "768x900", width: 768, height: 900 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("inventory-workspace")).toBeVisible();
      await expect(page.getByTestId("inventory-lot-grid")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(screenshotDir, `inventory-workspace-${viewport.name}.png`),
        fullPage: true,
      });
      if (viewport.name === "768x900") {
        const selectedLot = page.locator("[data-testid='inventory-lot-grid'] [data-lot-id]").first();
        await selectedLot.getByRole("button").click();
        await expect(page.getByRole("complementary", { name: "Selected inventory box" })).not.toContainText("Select a physical box");
        await page.screenshot({
          path: path.join(screenshotDir, "inventory-workspace-selected-lot-768x900.png"),
          fullPage: true,
        });
      }
      if (viewport.name === "390x844") {
        await page.locator("[data-testid='inventory-lot-grid'] [data-lot-id]").first().getByRole("button").click();
        const mobileInspector = page.getByRole("complementary", { name: "Selected inventory box" });
        await expect(mobileInspector).toHaveClass(/has-selection/);
        await expect(mobileInspector.getByRole("button", { name: "Close inventory box inspector" })).toBeVisible();
        await page.screenshot({
          path: path.join(screenshotDir, "inventory-workspace-selected-lot-390x844.png"),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  test("exposes physical lots directly and preserves transfer, reservation, and recovery behavior", async ({ page }) => {
    test.setTimeout(120_000);
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(fixturePath, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("inventory-workspace")).toBeVisible();
    await expect(location(page, "levski")).toHaveClass(/is-selected/);
    await expect(page.getByRole("heading", { name: "Levski", exact: true })).toBeVisible();
    const lots = page.locator("[data-testid='inventory-lot-grid'] [data-lot-id]");
    await expect(lots).toHaveCount(11);
    for (let index = 0; index < await lots.count(); index += 1) {
      const tile = lots.nth(index);
      await expect(tile.locator(".logi-inv-workspace-lot-name")).not.toBeEmpty();
      await expect(tile.locator(".logi-inv-workspace-lot-facts dd").nth(0)).toBeVisible();
      await expect(tile.locator(".logi-inv-workspace-lot-facts dd").nth(1)).toContainText("Quality");
    }

    const activelyReserved = lot(page, "fixture-levski-savrilium-a");
    const completedReservation = lot(page, "fixture-levski-savrilium-b");
    await expect(activelyReserved).toHaveAttribute("data-reservation-state", "reserved");
    await expect(activelyReserved).toContainText("12 SCU reserved by Industrial Fabrication Test");
    await expect(completedReservation).toHaveAttribute("data-reservation-state", "available");
    await expect(completedReservation).toContainText("Available");

    await completedReservation.getByRole("button").click();
    const inspector = page.getByRole("complementary", { name: "Selected inventory box" });
    await expect(inspector).toContainText("Savrilium");
    await expect(inspector).toContainText("32 SCU");
    await expect(inspector).toContainText("Quality 942");
    await expect(inspector).toContainText("Levski");
    await page.screenshot({ path: path.join(screenshotDir, "inventory-workspace-selected-lot-1920x1080.png"), fullPage: true });

    await location(page, "orison").click();
    await expect(location(page, "orison")).toHaveClass(/is-selected/);
    await expect(page.getByRole("heading", { name: "Orison", exact: true })).toBeVisible();
    await expect(page.getByTestId("inventory-lot-grid")).toHaveCount(1);
    await expect(page.getByTestId("inventory-lot-grid").locator("[data-lot-id]")).toHaveCount(1);
    await page.screenshot({ path: path.join(screenshotDir, "inventory-workspace-sparse-location-1920x1080.png"), fullPage: true });

    await location(page, "arc-l1").click();
    await expect(page.getByTestId("inventory-empty-location")).toContainText("No physical inventory boxes are recorded here.");
    await expectNoHorizontalOverflow(page);

    await location(page, "levski").click();
    const globalSearch = page.getByRole("searchbox", { name: "Search all inventory locations and items" });
    await globalSearch.fill("900");
    await expect(page.getByText("Quality ≥ 900", { exact: true })).toBeVisible();
    const visibleQualityValues = await page.locator("[data-testid='inventory-lot-grid'] [data-quality]").evaluateAll((tiles) =>
      tiles.map((tile) => Number(tile.getAttribute("data-quality"))),
    );
    expect(visibleQualityValues.every((quality) => quality >= 900)).toBe(true);
    await expect(location(page, "levski")).toHaveAttribute("data-search-match", "true");
    await globalSearch.fill("no-matching-inventory-record");
    await expect(page.getByTestId("inventory-empty-location")).toContainText("No physical inventory boxes match the current search or filters.");
    await page.screenshot({ path: path.join(screenshotDir, "inventory-workspace-empty-results-1920x1080.png"), fullPage: true });
    await globalSearch.fill("");
    await expect(lots).toHaveCount(11);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.getByTestId("inventory-lot-grid")).toHaveAttribute("data-view-mode", "list");
    await page.getByRole("button", { name: "Grouped", exact: true }).click();
    await expect(page.getByTestId("inventory-lot-grid")).toHaveAttribute("data-view-mode", "grouped");
    await expect(page.locator("[data-testid='inventory-lot-grid'] [data-lot-id]")).toHaveCount(11);
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await expect(page.getByTestId("inventory-lot-grid")).toHaveAttribute("data-view-mode", "grid");

    await activelyReserved.getByRole("button").click();
    const moveButton = inspector.getByRole("button", { name: "Move", exact: true });
    await moveButton.focus();
    await page.keyboard.press("Enter");
    const moveDialog = page.getByRole("dialog", { name: "Move physical boxes" });
    await expect(moveDialog).toBeVisible();
    await moveDialog.getByRole("button", { name: "Cancel", exact: true }).click();

    const orison = location(page, "orison");
    const dragData = await page.evaluateHandle(() => new DataTransfer());
    await activelyReserved.dispatchEvent("dragstart", { dataTransfer: dragData });
    await orison.dispatchEvent("dragover", { dataTransfer: dragData });
    await expect(orison).toHaveAttribute("data-drop-valid", "true");
    await expect(orison).toHaveAttribute("data-drop-armed", "true");
    await page.screenshot({ path: path.join(screenshotDir, "inventory-workspace-armed-drag-1920x1080.png"), fullPage: true });
    await orison.dispatchEvent("drop", { dataTransfer: dragData });
    await activelyReserved.dispatchEvent("dragend", { dataTransfer: dragData });
    await expect(page.getByRole("status")).toContainText("Moved one physical box to Orison.");
    await expect(location(page, "orison")).toHaveClass(/is-selected/);
    await expect(lot(page, "fixture-levski-savrilium-a")).toHaveAttribute("data-location-id", "orison");

    await location(page, "levski").click();
    const failureLot = lot(page, "fixture-transfer-failure");
    const portTressler = location(page, "port-tressler");
    await armAndDrop(failureLot, portTressler);
    await expect(failureLot).toHaveAttribute("data-location-id", "levski");
    await expect(portTressler.getByRole("alert")).toContainText("Transfer failed. The source location is unchanged.");
    await page.screenshot({ path: path.join(screenshotDir, "inventory-workspace-transfer-failure-1920x1080.png"), fullPage: true });
    await expectNoHorizontalOverflow(page);
    expect(failures).toEqual([]);
  });

  test("keeps the mobile transfer dialog and far-end location destination legible", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath, { waitUntil: "domcontentloaded" });

    const firstLot = page.locator("[data-testid='inventory-lot-grid'] [data-lot-id]").first();
    await firstLot.getByRole("button").click();
    const inspector = page.getByRole("complementary", { name: "Selected inventory box" });
    const moveButton = inspector.getByRole("button", { name: "Move", exact: true });
    await moveButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Move physical boxes" });
    await expect(dialog).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(screenshotDir, "inventory-workspace-transfer-dialog-390x844.png"),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    const strip = page.locator(".logi-inv-workspace-location-groups");
    await strip.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(location(page, "port-tressler")).toBeInViewport();
    await expect(location(page, "port-tressler")).toContainText("0 records");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(screenshotDir, "inventory-workspace-location-rail-end-390x844.png"),
      fullPage: true,
    });
    expect(failures).toEqual([]);
  });
});
