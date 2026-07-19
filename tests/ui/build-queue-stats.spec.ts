import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  BUILD_QUEUE_STATS_FIXTURE_PATH,
  FIXTURE_ITEM_IDS,
  INVENTORY_ADD_MODAL_FIXTURE_PATH,
} from "../../src/pages/logistics/buildQueueStatsFixture";

const screenshotDir = path.resolve(process.cwd(), "artifacts/bq-craft-header/gate6");
const craftingSliderScreenshotDir = path.resolve(process.cwd(), "artifacts/crafting-target-slider");
const CRAFTING_TARGET_SLIDER_FIXTURE_PATH = "/industry/crafting/__fixture/target-slider";

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
      expect(Math.abs(geometry.shellCenter - geometry.badgeCenter)).toBeLessThan(1);

      await expect(shell).toHaveCSS("opacity", "0");
      await editor.hover();
      await expect(shell).toHaveCSS("opacity", "1");
      await slider.focus();
      await expect(badge).toHaveCSS("pointer-events", "none");
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
    const modalScreenshotDir = path.resolve(process.cwd(), "artifacts/inventory-add-modal");
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
      await expect(dialog.getByText("Box Qualities (0-1000)")).toBeVisible();
      await expect(dialog.getByText("Add up to 5 different quality levels.")).toBeVisible();
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
      expect(fieldOrder.locationTop).toBeLessThan(fieldOrder.materialTop);
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
      await expect(page.locator(".bq-craft-card")).toHaveCount(2);

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
      await expect(page.locator(".bq-materials-section-summary")).toContainText("covered");
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
      const newQueueHandleBox = await newQueueHandle.boundingBox();
      if (!newQueueHandleBox) throw new Error("New queue drag handle has no pointer geometry.");
      await page.mouse.move(newQueueHandleBox.x + newQueueHandleBox.width / 2, newQueueHandleBox.y + newQueueHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(newQueueHandleBox.x + 16, newQueueHandleBox.y + 16, { steps: 4 });
      const newQueueDestination = page.locator(".bq-drag-destination--new-queue");
      await expect(newQueueDestination).toBeVisible();
      const newQueueBox = await newQueueDestination.boundingBox();
      if (!newQueueBox) throw new Error("New queue destination has no pointer geometry.");
      await page.mouse.move(newQueueBox.x + newQueueBox.width / 2, newQueueBox.y + newQueueBox.height / 2, { steps: 8 });
      await expect(newQueueDestination).toHaveClass(/is-over/);
      await page.mouse.up();

      await expect(page.locator(".bq-queue-selector-trigger")).toContainText("New Queue");
      await expect(page.locator('form[aria-label="Rename queue"]')).toBeVisible();
      await expect(page.locator(`[data-bq-entry-id="${FIXTURE_ITEM_IDS.ad5b}"]`)).toBeVisible();
      await expect(page.locator(".bq-craft-card")).toHaveCount(1);
    }
  });

  test("integrates decorative SVG frames without intercepting the live workspace", async ({ page }) => {
    const failures = installFailureGuards(page);
    const frameScreenshotDir = path.resolve(process.cwd(), "artifacts/build-queue-frames");
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
      await expect(page.locator('.bq-queue-col-head > img[src$="queue-header-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-center-shell > img[src$="content-shell-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-item-header > img[src$="detail-panel-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-item-visual > img[src$="item-preview-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-component-statistics > img[src$="stats-band-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-materials-section > img[src$="material-panel-frame.svg"]')).toHaveCount(1);
      await expect(page.locator('.bq-mat-row > img[src$="material-row-frame.svg"]')).toHaveCount(await page.locator('.bq-mat-row').count());

      const frames = page.locator(".bq-decorative-frame");
      expect(await frames.count()).toBeGreaterThanOrEqual(8);
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
});
