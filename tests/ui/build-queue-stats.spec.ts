import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  BUILD_QUEUE_STATS_FIXTURE_PATH,
  FIXTURE_ITEM_IDS,
} from "../../src/pages/logistics/buildQueueStatsFixture";

const screenshotDir = path.resolve(process.cwd(), "artifacts/bq-craft-header/gate6");

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
  const listCard = page.locator(".bq-craft-card").filter({ hasText: itemName }).first();
  await expect(listCard).toBeVisible();
  await listCard.click();
  await expect(page.locator(".bq-item-name")).toHaveText(itemName);
  await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
}

test.describe("Build Queue stats fixture", () => {
  test("renders identity-only headers + consolidated component statistics for FR-66, AD5B, FPS weapon, and FPS armor", async ({ page }) => {
    const failures = installFailureGuards(page);
    const externalApiRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/") && url.origin !== "http://127.0.0.1:5175") {
        externalApiRequests.push(request.url());
      }
    });
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BUILD_QUEUE_STATS_FIXTURE_PATH, { waitUntil: "domcontentloaded" });

      await expect(page.locator('[data-bq-fixture="stats"]')).toBeVisible();
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(4);
      await expect(page.locator(".bq-center-col")).toBeVisible();

      if (viewport.name === "1920x1080") {
        const missionLink = page.locator(".bq-item-blueprint-link").first();
        await expect(missionLink).toHaveText("Xenothreat 2 85 01");
        await expect(missionLink).toHaveAttribute("href", "/industry/missions?concept=xenothreat-2-85-01");

        await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
        await expect(page.locator(".bq-item-header .bq-stat-compare-row")).toHaveCount(0);
        await expect(page.locator(".bq-item-identity .bq-stats-meta--header")).toBeVisible();
        await expect(page.locator(".bq-component-statistics .bq-stat-compare-group")).toHaveCount(4);
        await expect(page.locator(".bq-component-statistics .bq-stat-compact-row").first()).toBeVisible();
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Not modified");

        const alignment = await page.locator(".bq-stat-compare-row").first().evaluate((row) => {
          const slots = Array.from(row.querySelectorAll(".bq-stat-compare-slot"));
          return slots.map((slot) => {
            const rect = slot.getBoundingClientRect();
            return { width: rect.width, top: rect.top };
          });
        });
        expect(alignment).toHaveLength(3);
        expect(Math.max(...alignment.map((slot) => slot.width)) - Math.min(...alignment.map((slot) => slot.width))).toBeLessThan(1);
        expect(Math.max(...alignment.map((slot) => slot.top)) - Math.min(...alignment.map((slot) => slot.top))).toBeLessThan(1);

        const slider = page.getByRole("slider", { name: "Target quality for Stileron" }).first();
        const targetValues = page.locator(".bq-component-statistics .bq-stat-compare-target");
        const before = await targetValues.allTextContents();
        const previousQuality = Number(await slider.inputValue());
        const nextQuality = Math.max(1, previousQuality - 75);
        await slider.evaluate((element, value) => {
          const input = element as HTMLInputElement;
          const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setValue?.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, nextQuality);
        await expect(slider).toHaveValue(String(nextQuality));
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).not.toBe(before.join("|"));

        await slider.evaluate((element, value) => {
          const input = element as HTMLInputElement;
          const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setValue?.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, previousQuality);
        await expect(slider).toHaveValue(String(previousQuality));
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).toBe(before.join("|"));

        await expect(page.locator(".bq-mat-head")).not.toContainText("Allocated");
      }

      for (const item of fixtureItems) {
        await selectFixtureItem(page, item.id, item.name);
        await expect(page.locator(".bq-materials-section")).toBeVisible();
        await expect(page.locator(".bq-mat-table")).toBeVisible();

        if (item.expectGroupedStats) {
          await expect(page.locator(".bq-item-stats")).toHaveCount(0);
          await expect(page.locator(".bq-item-identity .bq-stats-meta")).toBeVisible();
          await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
          await expect(page.locator(".bq-component-statistics .bq-stat-compare-group").first()).toBeVisible();
          await expect(page.locator(".bq-component-statistics .bq-stat-compare").first()).toBeVisible();
        } else {
          await expect(page.locator(".bq-component-statistics")).toBeVisible();
        }

        if (item.id === FIXTURE_ITEM_IDS.ad5b) {
          const compactLabels = await page.locator(".bq-component-statistics .bq-stat-compact-label").allTextContents();
          expect(compactLabels).toEqual(expect.arrayContaining([
            "Physical Damage",
            "Fire Rate",
            "Ammo Capacity",
            "Projectile Speed",
            "Projectile Range / Max Travel",
            "Heat Per Shot",
            "Power",
            "Mass",
          ]));
          const modifiedLabels = await page.locator(".bq-component-statistics .bq-stat-compare-row .bq-stat-compare-label").allTextContents();
          expect(modifiedLabels).toEqual(["Alpha Damage", "Health"]);
          const compactText = (await page.locator(".bq-stat-compact-list").allTextContents()).join("|");
          expect(compactText).not.toContain("0%");

          const allocationColors = await page.evaluate(() => {
            const allocationValue = document.querySelector(".bq-stat-compare-allocation .bq-stat-compare-value");
            const qualityValue = document.querySelector(".bq-quality-chip strong");
            const targetValue = document.querySelector(".bq-stat-compare-target .bq-stat-compare-value");
            return {
              allocation: allocationValue ? getComputedStyle(allocationValue).color : "",
              quality: qualityValue ? getComputedStyle(qualityValue).color : "",
              target: targetValue ? getComputedStyle(targetValue).color : "",
            };
          });
          expect(allocationColors.allocation).toBe(allocationColors.quality);
          expect(allocationColors.allocation).not.toBe(allocationColors.target);
        }

        await page.screenshot({
          path: path.join(screenshotDir, `bq-stats-${item.id}-${viewport.name}.png`),
          fullPage: true,
        });
      }

      const horizontalOverflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      ));
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }

    expect(failures).toEqual([]);
    expect(externalApiRequests).toEqual([]);
  });
});
