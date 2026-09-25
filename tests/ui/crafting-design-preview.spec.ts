import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const previewPath = "/industry/crafting/design-preview";
const productionPath = "/industry/crafting";
const screenshotDir = path.resolve(process.cwd(), "artifacts", "crafting-design-preview");

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
    if (/ERR_ABORTED/i.test(request.failure()?.errorText ?? "")) return;
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

test.describe("Crafting coded design preview", () => {
  test("renders selected and empty inspection states at all review viewports", async ({ page }) => {
    const failures = installFailureGuards(page);
    await mkdir(screenshotDir, { recursive: true });

    for (const viewport of [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "1680x945", width: 1680, height: 945 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1280x720", width: 1280, height: 720 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(previewPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
      await expect(page.getByTestId("crafting-design-preview")).toBeVisible();
      await expect(page.locator(".craft-detail-drawer-shell")).toBeVisible();
      await expect(page.locator(".craft-detail-drawer-title")).toHaveAttribute(
        "aria-label",
        /AD5B Ballistic Gatling/,
      );
      await expectNoDocumentOverflow(page);

      if (viewport.width >= 1600) {
        await expect(page.locator('.crb2-table-row--selected[aria-selected="true"]')).toContainText(
          "AD5B Ballistic Gatling",
        );
        await expect(page.locator(".cdp-spine")).toHaveClass(/is-active/);
        await expect.poll(() => page.evaluate(() => {
          const row = document.querySelector<HTMLElement>(".crb2-table-row--selected")?.getBoundingClientRect();
          const trace = document.querySelector<HTMLElement>(".cdp-spine-trace")?.getBoundingClientRect();
          if (!row || !trace) return Number.POSITIVE_INFINITY;
          return Math.abs((row.top + row.height / 2) - (trace.top + trace.height / 2));
        })).toBeLessThanOrEqual(2);

        const relationship = await page.evaluate(() => {
          const workspace = document.querySelector<HTMLElement>(".cdp-workspace")?.getBoundingClientRect();
          const browser = document.querySelector<HTMLElement>(".cdp-browser")?.getBoundingClientRect();
          const detail = document.querySelector<HTMLElement>(".cdp-detail")?.getBoundingClientRect();
          return {
            browserWidth: browser?.width ?? 0,
            detailWidth: detail?.width ?? 0,
            workspaceWidth: workspace?.width ?? 0,
          };
        });
        expect(relationship.browserWidth).toBeGreaterThan(relationship.detailWidth);
        expect(relationship.workspaceWidth).toBeGreaterThan(viewport.width * 0.85);
      } else {
        await expect(page.locator(".cdp-browser")).toBeHidden();
        await expect(page.locator(".cdp-spine")).toBeHidden();
      }

      await page.screenshot({
        path: path.join(screenshotDir, `selected-${viewport.name}.png`),
        fullPage: true,
      });

      await page.getByRole("button", { name: /Close AD5B Ballistic Gatling.*detail/ }).click();
      if (viewport.width >= 1600) {
        await expect(page.locator(".cdp-inspection-bay")).toBeVisible();
        await expect(page.locator(".cdp-inspection-component")).toHaveAttribute(
          "src",
          /behr-ballistic-gatling-s4\.webp$/,
        );
        await expect(page.getByRole("heading", { name: "Select a component" })).toBeVisible();
        await expect(page.locator(".cdp-spine")).not.toHaveClass(/is-active/);
        await expect(page.locator('.crb2-table-row--selected[aria-selected="true"]')).toHaveCount(0);
      } else {
        await expect(page.locator(".cdp-browser")).toBeVisible();
        await expect(page.locator(".cdp-detail")).toBeHidden();
        await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();
      }
      await expectNoDocumentOverflow(page);

      await page.screenshot({
        path: path.join(screenshotDir, `empty-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failures).toEqual([]);
  });

  test("keeps prototype controls interactive and leaves production routing intact", async ({ page }) => {
    const failures = installFailureGuards(page);
    await page.setViewportSize({ width: 1680, height: 945 });
    await page.goto(previewPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".craft-detail-drawer-shell")).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(previewPath);

    const search = page.getByRole("searchbox", { name: "Search components" });
    await search.fill("CQ7");
    await expect(page).toHaveURL(/\/industry\/crafting\/design-preview\?search=CQ7/);
    const cq7 = page.locator(".crb2-table tbody tr", { hasText: "CQ7" });
    await expect(cq7).toBeVisible();
    await cq7.click();
    await expect(page.locator(".craft-detail-drawer-title")).toHaveAttribute(
      "aria-label",
      /CQ7/,
    );
    await expect(page.locator(".cdp-spine")).toHaveClass(/is-active/);

    await page.getByRole("tab", { name: "Statistics" }).click();
    await expect(page.locator(".craft-detail-drawer-stats")).toBeVisible();

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(previewPath);
    const sizeFive = page.getByRole("button", { name: "5", exact: true }).first();
    await sizeFive.click();
    await expect(sizeFive).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/(?:\?|&)sz=5(?:&|$)/);

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/(?:\?|&)pg=2(?:&|$)/);
    await expect(page.locator(".crb2-pager")).toContainText("Page 2");

    await page.goto(`${productionPath}?preview=ba842720-ad32-4d53-8f56-992bacb1fc45`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".craft-detail-drawer-shell")).toBeVisible();
    await expect(page.getByTestId("crafting-design-preview")).toHaveCount(0);
    expect(failures).toEqual([]);
  });
});
