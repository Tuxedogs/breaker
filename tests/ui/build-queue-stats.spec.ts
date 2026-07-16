import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  BUILD_QUEUE_STATS_FIXTURE_PATH,
  FIXTURE_ITEM_IDS,
} from "../../src/pages/logistics/buildQueueStatsFixture";

const screenshotDir = path.resolve(process.cwd(), "artifacts/bq-craft-header/gate6");

const fixtureItems = [
  { id: FIXTURE_ITEM_IDS.fr66, name: "FR-66", queue: "Pyro Defense Refit", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.ad5b, name: "AD5B Ballistic Gatling", queue: "Pyro Defense Refit", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsWeapon, name: 'P6-LR "Archangel" Sniper Rifle', queue: "Ground Team Loadout", expectGroupedStats: true },
  { id: FIXTURE_ITEM_IDS.fpsArmor, name: "ADP-mk4 Arms Woodland", queue: "Expedition Spares", expectGroupedStats: true },
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
      await expect(page.locator(".bq-craft-card")).toHaveCount(2);
      await expect(page.locator(".bq-craft-card").nth(0)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(1)).toContainText("AD5B Ballistic Gatling");
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
        await expect(page.locator(".bq-component-statistics .bq-stat-modified-card")).toBeVisible();
        await expect(page.locator(".bq-component-statistics .bq-stat-compact-row").first()).toBeVisible();
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Not modified");
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Thermal / Power");
        await expect(page.locator(".bq-component-statistics")).not.toContainText("Projectile Range / Max Travel");
        await expect(page.locator(".bq-stat-legend")).toContainText("Beneficial");
        await expect(page.locator(".bq-stat-legend")).toContainText("Detrimental");

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
        const sliderEditor = slider.locator("xpath=ancestor::*[contains(@class, 'bq-target-editor--slider')]");
        const sliderShell = slider.locator("xpath=ancestor::*[contains(@class, 'bq-target-slider-shell')]");
        const targetBadge = sliderEditor.locator(":scope > .bq-target-quality");
        const sliderGeometry = await sliderEditor.evaluate((editor) => {
          const badge = editor.querySelector(":scope > .bq-target-quality")?.getBoundingClientRect();
          const shell = editor.querySelector(".bq-target-slider-shell")?.getBoundingClientRect();
          const input = editor.querySelector(".bq-target-quality-slider")?.getBoundingClientRect();
          const card = editor.closest(".bq-center-shell")?.getBoundingClientRect();
          return {
            badgeWidth: badge?.width ?? 0,
            badgeCenter: badge ? badge.left + badge.width / 2 : 0,
            shellWidth: shell?.width ?? 0,
            shellCenter: shell ? shell.left + shell.width / 2 : 0,
            inputWidth: input?.width ?? 0,
            inputCenter: input ? input.left + input.width / 2 : 0,
            cardWidth: card?.width ?? 1,
          };
        });
        expect(sliderGeometry.badgeWidth).toBeLessThanOrEqual(80);
        expect(sliderGeometry.shellWidth).toBeGreaterThan(sliderGeometry.badgeWidth);
        expect(sliderGeometry.shellWidth).toBeLessThanOrEqual(100);
        expect((sliderGeometry.shellWidth - sliderGeometry.badgeWidth) / 2).toBeGreaterThanOrEqual(8);
        expect(Math.abs(sliderGeometry.shellCenter - sliderGeometry.badgeCenter)).toBeLessThan(1);
        expect(Math.abs(sliderGeometry.inputCenter - sliderGeometry.badgeCenter)).toBeLessThan(1);
        expect(sliderGeometry.inputWidth).toBe(sliderGeometry.shellWidth);
        expect(sliderGeometry.shellWidth / sliderGeometry.cardWidth).toBeLessThan(0.2);

        await expect(sliderShell).toHaveCSS("opacity", "0");
        await sliderEditor.hover();
        await expect(sliderShell).toHaveCSS("opacity", "1");
        await page.screenshot({
          path: path.join(screenshotDir, `bq-target-slider-hover-${viewport.name}.png`),
          fullPage: true,
        });
        await slider.focus();
        await expect(slider).toBeFocused();
        await expect(sliderShell).toHaveCSS("opacity", "1");
        await expect(targetBadge).toHaveCSS("opacity", "0");
        await expect(targetBadge).toHaveCSS("pointer-events", "none");
        await expect(slider).toHaveCSS("pointer-events", "auto");
        const targetValues = page.locator(".bq-component-statistics .bq-stat-compare-target");
        const before = (await targetValues.allTextContents()).join("|");
        const previousQuality = Number(await slider.inputValue());
        const sliderBox = await slider.boundingBox();
        expect(sliderBox).not.toBeNull();
        if (!sliderBox) throw new Error("Target slider has no pointer geometry.");

        // A real track click must update the controlled value and projected modifier stats.
        await page.mouse.click(sliderBox.x + sliderBox.width * 0.28, sliderBox.y + sliderBox.height / 2);
        await expect.poll(async () => Number(await slider.inputValue())).not.toBe(previousQuality);
        const clickedQuality = Number(await slider.inputValue());
        expect(clickedQuality).toBeGreaterThan(150);
        expect(clickedQuality).toBeLessThan(450);
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).not.toBe(before);
        const afterClick = (await targetValues.allTextContents()).join("|");

        // Drag from the native thumb to the right using actual pointer events.
        const thumbRadius = 7;
        const usableWidth = sliderBox.width - thumbRadius * 2;
        const dragStartX = sliderBox.x + thumbRadius + usableWidth * ((clickedQuality - 1) / 999);
        const dragEndX = sliderBox.x + thumbRadius + usableWidth * 0.68;
        const sliderY = sliderBox.y + sliderBox.height / 2;
        await page.mouse.move(dragStartX, sliderY);
        await page.mouse.down();
        await page.mouse.move(dragEndX, sliderY, { steps: 10 });
        await page.mouse.up();
        await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(clickedQuality + 150);
        const draggedQuality = Number(await slider.inputValue());
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).not.toBe(afterClick);
        const afterDrag = (await targetValues.allTextContents()).join("|");

        // Native keyboard control must also recalculate immediately.
        await slider.focus();
        await page.keyboard.press("ArrowRight");
        await expect(slider).toHaveValue(String(Math.min(1000, draggedQuality + 1)));
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).not.toBe(afterDrag);

        // Restore the deterministic starting value for the remaining fixture screenshots.
        await slider.evaluate((element, value) => {
          const input = element as HTMLInputElement;
          const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setValue?.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, previousQuality);
        await expect(slider).toHaveValue(String(previousQuality));
        await expect.poll(async () => (await targetValues.allTextContents()).join("|")).toBe(before);

        await page.locator(".bq-component-statistics-title").click();
        await page.mouse.move(10, 10);
        await expect(slider).not.toBeFocused();
        await expect(sliderShell).toHaveCSS("opacity", "0");

        await expect(page.locator(".bq-mat-head")).not.toContainText("Allocated");
      }

      for (const item of fixtureItems) {
        await selectQueue(page, item.queue);
        await selectFixtureItem(page, item.id, item.name);
        await expect(page.locator(".bq-materials-section")).toBeVisible();
        await expect(page.locator(".bq-mat-table")).toBeVisible();

        if (item.expectGroupedStats) {
          await expect(page.locator(".bq-item-stats")).toHaveCount(0);
          await expect(page.locator(".bq-item-identity .bq-stats-meta")).toBeVisible();
          await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible({ timeout: 60_000 });
          await expect(page.locator(".bq-component-statistics .bq-stat-unmodified-group").first()).toBeVisible();
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
            "Projectile Range and Max Travel",
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

      await selectQueue(page, "Pyro Defense Refit");
      await page.locator(".bq-queue-selector-trigger").click();
      await expect(page.getByRole("option")).toHaveCount(3);
      const selectorPosition = await page.locator(".bq-queue-selector-popover").evaluate((popover) => {
        const trigger = popover.parentElement?.querySelector(".bq-queue-selector-trigger")?.getBoundingClientRect();
        const menu = popover.getBoundingClientRect();
        return { triggerBottom: trigger?.bottom ?? 0, menuTop: menu.top, menuBottom: menu.bottom, viewportHeight: window.innerHeight };
      });
      expect(selectorPosition.menuTop).toBeGreaterThanOrEqual(selectorPosition.triggerBottom);
      expect(selectorPosition.menuBottom).toBeLessThanOrEqual(selectorPosition.viewportHeight);
      await page.screenshot({ path: path.join(screenshotDir, `bq-queue-selector-${viewport.name}.png`), fullPage: true });

      await page.getByRole("button", { name: "+ New" }).click();
      await expect(page.getByRole("form", { name: "Create queue" })).toBeVisible();
      await page.getByLabel("New queue name").fill("Carrier Refit Batch");
      await page.screenshot({ path: path.join(screenshotDir, `bq-queue-create-${viewport.name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Carrier Refit Batch");
      await expect(page.locator(".bq-craft-card")).toHaveCount(0);

      await page.locator(".bq-queue-selector-trigger").click();
      await page.getByRole("button", { name: "Rename" }).click();
      await page.getByLabel("Queue name").fill("Carrier Refit Priority");
      await page.screenshot({ path: path.join(screenshotDir, `bq-queue-rename-${viewport.name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("Carrier Refit Priority");

      await selectQueue(page, "Ground Team Loadout");
      await expect(page.locator(".bq-craft-card")).toHaveCount(1);
      await expect(page.locator(".bq-craft-card")).toContainText('P6-LR "Archangel" Sniper Rifle');
      await expect(page.getByRole("slider", { name: "Target quality for Taranite" })).toHaveValue("820");
      await expect(page.locator(".bq-quality-chip").first()).toContainText("820");
      await page.screenshot({ path: path.join(screenshotDir, `bq-distinct-queues-${viewport.name}.png`), fullPage: true });

      await selectQueue(page, "Pyro Defense Refit");
      await expect(page.locator(".bq-craft-card").nth(0)).toContainText("FR-66");
      await expect(page.locator(".bq-craft-card").nth(1)).toContainText("AD5B Ballistic Gatling");

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
});
