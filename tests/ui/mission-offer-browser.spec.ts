import { expect, test } from "@playwright/test";

test.describe("Mission Browser offer-first schema 3", () => {
  test("keeps exact-title search offer-local and exact variant selection canonical", async ({ page }) => {
    await page.goto("/industry/missions?search=Primo%20Target");

    const cards = page.locator(".mission-group-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Primo Target");
    await expect(cards.first()).toContainText("Headhunters");
    await expect(cards.first()).toContainText("Verification unknown");
    await expect(page.getByText("Deep Space Hit", { exact: true })).toHaveCount(0);

    await cards.first().click();
    await expect(page).toHaveURL(/offer=headhunters%3Aprimo-target/);
    const workspace = page.getByRole("region", { name: /Primo Target selected mission workspace/i });
    await expect(workspace).toBeVisible();
    await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
    await expect(workspace.getByText("Verification: Verification unknown", { exact: true })).toBeVisible();
    await expect(workspace.locator("tbody tr")).toHaveCount(4);
    await expect(workspace.locator(".mission-dossier-blueprint-panel")).toBeVisible();

    const exactVariants = workspace.locator(".mission-dossier-variant-row");
    await expect(exactVariants).toHaveCount(4);
    await exactVariants.nth(1).click();
    await expect(page).toHaveURL(/offer=headhunters%3Aprimo-target.*variant=/);
  });

  test("opens one-to-many legacy concepts as a chooser", async ({ page }) => {
    await page.goto("/industry/missions?concept=53d174fed535c0a8c4bc");

    await expect(page).not.toHaveURL(/offer=/);
    const chooser = page.getByRole("dialog", { name: "Choose a mission offer from this legacy series" });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole("heading", { name: "Choose a player-facing mission title" })).toBeVisible();
    await chooser.locator(".mission-group-card").filter({ hasText: "Primo Target" }).click();
    await expect(page).toHaveURL(/offer=headhunters%3Aprimo-target/);
  });

  test("writes new bookmarks with offer identity", async ({ page }) => {
    await page.goto("/industry/missions?offer=headhunters%3Aprimo-target");
    const workspace = page.getByRole("region", { name: /Primo Target selected mission workspace/i });
    await workspace.getByRole("button", { name: "Bookmark Primo Target" }).click();

    const stored = await page.evaluate((storageKey) => (
      JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[]
    ), "scintel:recipe:mission-bookmarks:v1");
    expect(stored).toContain("offer:headhunters:primo-target");
  });
});
