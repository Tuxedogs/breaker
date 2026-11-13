import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Phase 4 gate: List / Cards show identical results and selection, the choice
// survives navigation, and sorting is a URL contract applied before pagination.

const browserPath = "/industry/crafting";
const SHOTS = "artifacts/fixture-captures/crafting";

async function listIds(page: Page): Promise<string[]> {
  return page.locator(".crb2-table tbody tr").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-crafting-record-id") ?? ""));
}

async function cardIds(page: Page): Promise<string[]> {
  return page.locator(".crb2-mobile-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-crafting-record-id") ?? ""));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test("List and Cards show the same results and keep the selection", async ({ page }) => {
  await mkdir(SHOTS, { recursive: true });
  await page.goto(`${browserPath}?v=weaponGun`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();
  const list = await listIds(page);
  await page.locator(".crb2-table tbody tr").nth(1).click();
  const selectedId = list[1];

  const cardsButton = page.getByRole("button", { name: "Cards", exact: true });
  await cardsButton.click();
  await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".crb2-table")).toBeHidden();
  await expect(page.locator(".crb2-mobile-card").first()).toBeVisible();
  expect(await cardIds(page)).toEqual(list);
  await expect(page.locator(`.crb2-mobile-card[data-crafting-record-id="${selectedId}"]`)).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: `${SHOTS}/crafting-cards-1920.png` });

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".crb2-table")).toBeVisible();
  expect(await listIds(page)).toEqual(list);
  await expect(page.locator(".crb2-table tbody tr[aria-selected=\"true\"]")).toHaveAttribute("data-crafting-record-id", selectedId ?? "");
});

test("the layout choice persists across navigation and reload", async ({ page }) => {
  await page.goto(browserPath, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await page.goto("/industry/missions");
  await page.goto(browserPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".crb2-mobile-card").first()).toBeVisible();
});

test("sorting writes the URL contract, resets to page one and orders both views identically", async ({ page }) => {
  await page.goto(`${browserPath}?v=weaponGun&pg=2`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".crb2-table tbody tr").first()).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.locator(".crb2-table th").filter({ hasText: "DPS" }).getByRole("button").click();
  await expect(page).toHaveURL(/sort=dps&dir=desc/);
  await expect(page).not.toHaveURL(/pg=2/);
  const sortedList = await listIds(page);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.getByLabel("Sort by")).toHaveValue("dps");
  await expect.poll(() => cardIds(page)).toEqual(sortedList);

  await page.reload();
  await expect(page).toHaveURL(/sort=dps&dir=desc/);
  await expect.poll(() => cardIds(page)).toEqual(sortedList);

  await page.getByRole("button", { name: /Sort direction/ }).click();
  await expect(page).toHaveURL(/sort=dps&dir=asc/);
});

test("the layout control and cards are keyboard operable", async ({ page }) => {
  await page.goto(`${browserPath}?v=weaponGun`, { waitUntil: "domcontentloaded" });
  const cardsButton = page.getByRole("button", { name: "Cards", exact: true });
  await cardsButton.focus();
  await page.keyboard.press("Enter");
  await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
  const secondCard = page.locator(".crb2-mobile-card").nth(1);
  await secondCard.focus();
  await page.keyboard.press("Enter");
  await expect(secondCard).toHaveAttribute("aria-current", "true");
});
