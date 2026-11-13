import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Phase 3 gate: the Missions routes are real (no redirect to Crafting), survive
// direct navigation and refresh, and search, filters, detail, variant
// selection and deep links work against the published mission data.

const SHOTS = "artifacts/fixture-captures/missions";

async function offerCount(page: Page): Promise<number> {
  const summary = page.locator(".mission-category-block__header > strong");
  await expect(summary).toContainText("offers /");
  return Number((await summary.innerText()).match(/^(\d+) offers/)?.[1] ?? Number.NaN);
}

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test("the browser route is a mission page, not a Crafting redirect, and survives refresh", async ({ page }) => {
  await page.goto("/industry/missions");
  await expect(page).toHaveURL(/\/industry\/missions$/);
  await expect(page).toHaveTitle(/Missions/);
  const all = await offerCount(page);
  expect(all).toBeGreaterThan(0);
  await page.reload();
  await expect(page).toHaveURL(/\/industry\/missions$/);
  expect(await offerCount(page)).toBe(all);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: `${SHOTS}/missions-browser-1920.png` });
});

test("the full catalog includes non-blueprint offers; the blueprint filter narrows it", async ({ page }) => {
  await page.goto("/industry/missions");
  const all = await offerCount(page);
  await page.getByLabel("Filter by blueprint rewards").selectOption("blueprint");
  await expect(page).toHaveURL(/scope=blueprint/);
  const blueprintOnly = await offerCount(page);
  expect(blueprintOnly).toBeGreaterThan(0);
  expect(blueprintOnly).toBeLessThan(all);
  await page.reload();
  await expect(page.getByLabel("Filter by blueprint rewards")).toHaveValue("blueprint");
  expect(await offerCount(page)).toBe(blueprintOnly);
});

test("search and provider filters narrow results and persist in the URL", async ({ page }) => {
  await page.goto("/industry/missions?search=Primo%20Target");
  await expect(page.locator(".mission-group-card")).toHaveCount(1);
  await page.goto("/industry/missions");
  const all = await offerCount(page);
  const provider = page.getByLabel("Filter by provider");
  const firstProvider = await provider.locator("option").nth(1).getAttribute("value");
  expect(firstProvider).toBeTruthy();
  await provider.selectOption(firstProvider ?? "");
  await expect(page).toHaveURL(/provider=/);
  expect(await offerCount(page)).toBeLessThan(all);
});

test("offer detail, variant selection and deep links round-trip", async ({ page }) => {
  await page.goto("/industry/missions?offer=headhunters%3Aprimo-target");
  const workspace = page.getByRole("region", { name: /Primo Target selected mission workspace/i });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
  const variants = workspace.locator(".mission-dossier-variant-row");
  await expect(variants).toHaveCount(4);
  await variants.nth(1).click();
  await expect(page).toHaveURL(/offer=headhunters%3Aprimo-target.*variant=/);
  const deepLink = page.url();
  await page.screenshot({ path: `${SHOTS}/missions-offer-detail-1920.png` });

  await page.goto("about:blank");
  await page.goto(deepLink);
  await expect(page.getByRole("region", { name: /Primo Target selected mission workspace/i })).toBeVisible();
  await expect(page).toHaveURL(/variant=/);
});

test("a stale or unknown offer link is reported instead of rendering nothing", async ({ page }) => {
  await page.goto("/industry/missions?offer=retired-provider%3Ano-such-offer");
  await expect(page.getByTestId("mission-offer-link-unresolved")).toContainText("is not in the published mission data");
});

test("a non-blueprint offer opened under the blueprint filter explains why it is hidden", async ({ page }) => {
  await page.goto("/industry/missions?scope=blueprint");
  await offerCount(page);
  // Find an offer key that exists only in the full catalog.
  const response = await page.request.get("/api/missions/browser");
  expect(response.ok()).toBeTruthy();
  const catalog = (await response.json()) as { offersByKey?: Record<string, unknown> };
  const rewards = await page.request.get("/api/crafting/blueprint-rewards/missions");
  expect(rewards.ok()).toBeTruthy();
  const blueprintOffers = new Set(
    ((await rewards.json()) as { missions?: Array<{ offerKey?: string }> }).missions?.map((m) => m.offerKey) ?? [],
  );
  const nonBlueprintKey = Object.keys(catalog.offersByKey ?? {}).find((key) => !blueprintOffers.has(key) && !key.startsWith("wikelo:"));
  expect(nonBlueprintKey).toBeTruthy();
  await page.goto(`/industry/missions?scope=blueprint&offer=${encodeURIComponent(nonBlueprintKey ?? "")}`);
  await expect(page.getByTestId("mission-offer-link-unresolved")).toContainText("outside the Blueprint rewards filter");
});

test("mission API routes answer from published data", async ({ request }) => {
  const browser = await request.get("/api/missions/browser");
  expect(browser.status()).toBe(200);
  const offer = await request.get("/api/missions/offer/headhunters%3Aprimo-target");
  expect(offer.status()).toBe(200);
  const variants = await request.get("/api/missions/offer/headhunters%3Aprimo-target/variants");
  expect(variants.status()).toBe(200);
  const missing = await request.get("/api/missions/offer/retired-provider%3Ano-such-offer");
  expect(missing.status()).toBe(404);
});
