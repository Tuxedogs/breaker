import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Phase 6 gate: Crafting → Blueprint Source → Mission → prerequisites/faction,
// by stable contract ID, with return navigation and explicit missing-record states.

const BLUEPRINT = "1a85280e-7b8f-4486-a563-17cd2549d268";
const SOURCE_TITLE = "Blackbox Retrieval Very Dangerous";
const SHOTS = "artifacts/fixture-captures/missions";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test("a blueprint source opens its exact mission and returns to the same Crafting view", async ({ page }) => {
  await mkdir(SHOTS, { recursive: true });
  const craftingUrl = `/industry/crafting?preview=${BLUEPRINT}`;
  await page.goto(craftingUrl, { waitUntil: "domcontentloaded" });
  const drawer = page.locator(".craft-detail-drawer-region");
  await drawer.getByRole("tab", { name: "Sources" }).click();
  await drawer.locator(".craft-detail-sources-section").getByRole("button", { name: SOURCE_TITLE, exact: true }).click();
  const briefing = page.getByRole("dialog", { name: "Mission Briefing" });
  const open = briefing.getByTestId("craft-mission-open-in-missions");
  await expect(open).toBeVisible();
  const href = await open.getAttribute("href");
  const target = new URL(href ?? "", "http://local");
  const contractId = target.searchParams.get("variant");
  expect(contractId).toMatch(/^[0-9a-f-]{36}$/);
  expect(target.searchParams.get("return")).toBe(craftingUrl);

  await open.click();
  await expect(page).toHaveURL(/\/industry\/missions\?/);
  const workspace = page.getByRole("region", { name: /selected mission workspace/i });
  await expect(workspace).toBeVisible();
  // The exact variant is the one the blueprint source named, and its offer is selected.
  await expect(page).toHaveURL(new RegExp(`variant=${contractId}`));
  await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
  // Faction / reputation context is present for the selected offer.
  await expect(workspace).toContainText("Recco Battaglia");
  await page.screenshot({ path: `${SHOTS}/crafting-to-mission-1920.png` });

  // Reload keeps the deep link.
  await page.reload();
  await expect(page.getByRole("region", { name: /selected mission workspace/i })).toBeVisible();

  await page.getByRole("button", { name: "Close selected mission details" }).click();
  const back = page.getByTestId("mission-return-link");
  await expect(back).toHaveText(/Back to Crafting/);
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/industry/crafting\\?preview=${BLUEPRINT}$`));
  await expect(page.locator(".craft-detail-drawer-region")).toBeVisible();
});

test("a contract missing from the published data is reported, with the way back intact", async ({ page }) => {
  await page.goto(`/industry/missions?variant=00000000-0000-4000-8000-000000000000&return=${encodeURIComponent("/industry/crafting")}`);
  await expect(page.getByTestId("mission-variant-link-unresolved")).toContainText("is not in the published mission data");
  await expect(page.getByTestId("mission-return-link")).toHaveAttribute("href", "/industry/crafting");
});

test("an off-site return target is ignored", async ({ page }) => {
  await page.goto(`/industry/missions?return=${encodeURIComponent("https://example.com/")}`);
  await expect(page.locator(".mission-category-block__header > strong")).toContainText("offers /");
  await expect(page.getByTestId("mission-return-link")).toHaveCount(0);
});
