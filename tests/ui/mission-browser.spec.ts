import { expect, test } from "@playwright/test";

test.describe("Mission Browser exact dossier", () => {
  test("selects a concept into a persistent workspace before opening its dossier", async ({ page }) => {
    await page.goto("/industry/missions?search=Bit%20Zeros%20Black%20Box%20Recovery%20Nyx%20Easy");

    await page.locator(".mission-group-card").first().click();
    await expect(page).toHaveURL(/selected=70d0a94a8a837e887b3c/);
    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await expect(workspace).toBeVisible();
    await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await workspace.getByRole("button", { name: "Open dossier" }).click();
    await expect(page).toHaveURL(/concept=70d0a94a8a837e887b3c/);
    await expect(page.getByRole("dialog", { name: /Bit Zeros Black Box Recovery Nyx Easy mission dossier/i })).toBeVisible();
  });

  test("keeps a large exact-variant comparison bounded and sortable", async ({ page }) => {
    await page.goto("/industry/missions?selected=9cab64c0aa3664d21d3c");

    const workspace = page.getByRole("region", { name: /Hauler Needed for Shipment selected mission workspace/i });
    await expect(workspace.getByText("204", { exact: true }).first()).toBeVisible();
    await expect(workspace.getByText("207", { exact: true }).first()).toBeVisible();
    await expect(workspace.locator("tbody tr")).toHaveCount(204);
    await workspace.getByRole("button", { name: "All variants" }).click();
    await expect(workspace.locator("tbody tr")).toHaveCount(207);
    await workspace.getByRole("button", { name: "Sort by Base / solo" }).click();
    await expect(workspace.getByRole("button", { name: "Sort by Base / solo" })).toContainText("↑");
    await workspace.getByRole("button", { name: "Sort by Base / solo" }).click();
    await expect(workspace.getByRole("button", { name: "Sort by Base / solo" })).toContainText("↓");
  });

  test("shows persisted base payout and distinguishes required-item evidence", async ({ page }) => {
    await page.goto("/industry/missions?concept=70d0a94a8a837e887b3c");

    const dossier = page.getByRole("dialog", { name: /Bit Zeros Black Box Recovery Nyx Easy mission dossier/i });
    await expect(dossier).toBeVisible();
    await expect(dossier.locator(".mission-dossier-reward-status strong").filter({ hasText: "39,750 aUEC base / solo" })).toBeVisible();

    const requiredItems = dossier.locator(".mission-dossier-required-items");
    await expect(requiredItems.getByRole("heading", { name: "Required Mission Items" })).toBeVisible();
    await expect(requiredItems.getByText("Required mission cargo", { exact: true })).toBeVisible();
    await expect(requiredItems.getByText("Source-backed order", { exact: true })).toBeVisible();
    await expect(requiredItems.getByText("Mission item selector", { exact: true })).toBeVisible();
    await expect(requiredItems.getByText("Turn-in role not proven", { exact: true })).toBeVisible();
  });

  test("keeps certification buy-in separate from base payout", async ({ page }) => {
    await page.goto("/industry/missions?concept=1cf7b7218006719074f0");

    const dossier = page.getByRole("dialog", { name: /Advanced Tracker License Certification mission dossier/i });
    await expect(dossier.locator(".mission-dossier-reward-status strong").filter({ hasText: "91,000 aUEC base / solo" })).toBeVisible();
    await expect(dossier.getByText("Certification buy-in", { exact: true })).toBeVisible();
    await expect(dossier.getByText("10,000 aUEC", { exact: true })).toBeVisible();
    await expect(dossier.getByText("Separate from the base/solo payout.", { exact: true })).toBeVisible();
  });

  test("preserves a resolved calculated zero", async ({ page }) => {
    await page.goto("/industry/missions?concept=c870e1aef43e6d02bcd9");

    const dossier = page.getByRole("dialog");
    await expect(dossier.getByText("0 aUEC base / solo", { exact: true }).first()).toBeVisible();
  });

  test("offers a recoverable zero-results state", async ({ page }) => {
    await page.goto("/industry/missions?search=__no_mission_matches__");

    await expect(page.getByText("No missions match these filters", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/search=/);
    await expect(page.locator(".mission-group-card").first()).toBeVisible();
  });
});
