import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixturePath = "/logistics/inventory/__fixture/layout";
const screenshotDir = path.resolve(process.cwd(), "test-results", "inventory-layout");

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

async function openSavriliumBoxes(page: Page) {
  const location = page.getByRole("button", { name: /Levski.*197 SCU.*6 items/i });
  await expect(location).toHaveAttribute("aria-expanded", "true");

  const item = page.getByRole("button", { name: /Savrilium.*92 SCU.*5 records/i });
  if (await item.getAttribute("aria-expanded") !== "true") await item.click();
  await expect(item).toHaveAttribute("aria-expanded", "true");

  const quality = page.getByRole("button", { name: /Quality 942.*5 records.*92 SCU/i });
  if (await quality.getAttribute("aria-expanded") !== "true") await quality.click();
  await expect(quality).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".logi-inv-tree-box")).toHaveCount(5);
}

test.describe("Inventory hierarchy layout", () => {
  test("renders Location, Item, and grouped List views at desktop review sizes", async ({ page }) => {
    test.setTimeout(90_000);
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });
    const measurements: Array<Record<string, string | number>> = [];

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "768x900", width: 768, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-inventory-fixture="layout"]')).toBeVisible();
      await expect(page.locator(".logi-inv-tree-primary")).toHaveCount(1);
      await expect(page.locator(".logi-inv-tree-secondary")).toHaveCount(6);

      await openSavriliumBoxes(page);

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        folderWidth: Math.round(document.querySelector(".logi-inv-tree-primary")?.getBoundingClientRect().width ?? 0),
        boxRows: document.querySelectorAll(".logi-inv-tree-box").length,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(1);
      expect(layout.boxRows).toBe(5);
      measurements.push({ viewport: viewport.name, ...layout });

      await page.getByRole("button", { name: "Item", exact: true }).click();
      await expect(page.locator(".logi-inv-tree-primary")).toHaveCount(6);

      await page.getByRole("button", { name: "List", exact: true }).click();
      await expect(page.getByRole("group", { name: "Group list by" })).toBeVisible();
      await page.getByRole("button", { name: "Item", exact: true }).last().click();
      await expect(page.locator(".logi-inv-list-folder")).toHaveCount(6);

      await page.getByRole("button", { name: "Location", exact: true }).first().click();
      await openSavriliumBoxes(page);
      await page.screenshot({
        path: path.join(screenshotDir, `inventory-hierarchy-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await writeFile(
      path.join(screenshotDir, "inventory-hierarchy-measurements.json"),
      `${JSON.stringify(measurements, null, 2)}\n`,
      "utf8",
    );
    expect(failures).toEqual([]);
  });
});
