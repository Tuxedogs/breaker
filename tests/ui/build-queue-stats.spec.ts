import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  BUILD_QUEUE_STATS_FIXTURE_PATH,
  FIXTURE_ITEM_IDS,
} from "../../src/pages/logistics/buildQueueStatsFixture";

const screenshotDir = path.resolve(process.cwd(), "test-results", "build-queue-stats");

const fixtureItems = [
  { id: FIXTURE_ITEM_IDS.fr66, name: "FR-66", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.ad5b, name: "AD5B Ballistic Gatling", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsWeapon, name: 'P6-LR "Archangel" Sniper Rifle', expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsArmor, name: "ADP-mk4 Arms Woodland", expectGroupedStats: true },
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
  const card = page.locator(`[data-bq-item-id="${itemId}"]`).or(
    page.locator(".bq-craft-card").filter({ hasText: itemName }),
  );
  // Queue list cards do not carry data-bq-item-id; selected craft body does.
  const listCard = page.locator(".bq-craft-card").filter({ hasText: itemName }).first();
  await expect(listCard).toBeVisible();
  await listCard.click();
  await expect(page.locator(".bq-item-name")).toHaveText(itemName);
  await expect(page.locator(".bq-item-stats .bq-stats-panel")).toBeVisible();
  void card;
}

test.describe("Build Queue stats fixture", () => {
  test("renders real Build Queue components for FR-66, AD5B, FPS weapon, and FPS armor", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BUILD_QUEUE_STATS_FIXTURE_PATH, { waitUntil: "domcontentloaded" });

      await expect(page.locator('[data-bq-fixture="stats"]')).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(4);
      await expect(page.locator(".bq-center-col")).toBeVisible();

      for (const item of fixtureItems) {
        await selectFixtureItem(page, item.id, item.name);
        await expect(page.locator(".bq-materials-section")).toBeVisible();
        await expect(page.locator(".bq-mat-table")).toBeVisible();

        if (item.expectGroupedStats) {
          await expect(page.locator(".bq-item-stats .bq-stat-groups")).toBeVisible({ timeout: 60_000 });
          await expect(page.locator(".bq-item-stats .bq-stat-group").first()).toBeVisible();
        } else {
          await expect(page.locator(".bq-item-stats .bq-stats-panel")).toBeVisible();
        }

        await page.screenshot({
          path: path.join(screenshotDir, `bq-stats-${item.id}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    expect(failures).toEqual([]);
  });
});
