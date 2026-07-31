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

  test("evaluates explicit player knowledge on the server", async ({ page }) => {
    await page.goto("/industry/missions?selected=70d0a94a8a837e887b3c");

    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await workspace.getByRole("button", { name: "Check" }).click();
    const eligibility = page.getByRole("region", { name: /eligibility/i });
    await eligibility.getByLabel("CrimeStat").selectOption("0");
    await eligibility.getByRole("button", { name: "Evaluate eligibility" }).click();

    await expect(eligibility.locator(".mission-eligibility-status strong")).toHaveText("unresolved");
    await expect(eligibility.getByText(/Evaluated against mission generation/)).toBeVisible();
    await expect(eligibility.locator(".mission-eligibility-result li").first()).toBeVisible();
  });

  test("shows a proven mission-count unlock path for an exact variant", async ({ page }) => {
    await page.goto("/industry/missions?selected=0c5a45e58399ed06bd30");

    const workspace = page.getByRole("region", { name: /Additional Resources For Research selected mission workspace/i });
    await workspace.locator('tr[data-variant-key="1136e707-15cb-49b9-9943-c3a2de91d3f2"]').getByRole("button", { name: "Check" }).click();

    const solver = page.getByRole("region", { name: /Additional Resources For Research eligibility/i });
    await solver.getByLabel("CrimeStat").selectOption("0");
    await solver.getByLabel("Contract history").selectOption("complete");
    await solver.getByLabel("Mission-tag history").selectOption("complete");
    await solver.getByRole("button", { name: "Find prerequisite path" }).click();

    const path = solver.locator(".mission-path-result");
    await expect(path.locator(".mission-eligibility-status strong")).toHaveText("path found");
    await expect(path.getByText(/1 prerequisite mission/)).toBeVisible();
    await expect(path.getByText("Target mission is not included.", { exact: false })).toBeVisible();
    await expect(path.getByText("Interested in Building a Better Future?", { exact: true })).toBeVisible();
    await expect(path.getByText(/Generation b42621a47bf58653e0ec17c3/)).toBeVisible();
  });

  test("preserves legacy concept favorites and writes typed concept bookmarks", async ({ page }) => {
    const conceptKey = "70d0a94a8a837e887b3c";
    await page.addInitScript(({ storageKey, legacyConceptKey }) => {
      window.localStorage.setItem(storageKey, JSON.stringify([legacyConceptKey]));
    }, {
      storageKey: "scintel:recipe:mission-bookmarks:v1",
      legacyConceptKey: conceptKey,
    });
    await page.goto(`/industry/missions?selected=${conceptKey}`);

    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    const bookmark = workspace.getByRole("button", { name: "Bookmarked" });
    await expect(bookmark).toBeVisible();
    await bookmark.click();
    await workspace.getByRole("button", { name: "Bookmark" }).click();

    const stored = await page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[], "scintel:recipe:mission-bookmarks:v1");
    expect(stored).toContain(`concept:${conceptKey}`);
    expect(stored).not.toContain(conceptKey);
  });

  test("tracks exact blueprint reward sources with Blueprint Tracker identities", async ({ page }) => {
    await page.goto("/industry/missions?selected=0c5a45e58399ed06bd30");

    const workspace = page.getByRole("region", { name: /Additional Resources For Research selected mission workspace/i });
    const row = workspace.locator('tr[data-variant-key="115dab47-1987-4317-8a8f-b9466976a7b6"]');
    await row.getByRole("button", { name: "Track blueprint rewards" }).click();

    const expectedBookmark = "mission:115dab47-1987-4317-8a8f-b9466976a7b6:0f03e098-cc68-4a14-abe8-7b17a8bec97e";
    const stored = await page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[], "scintel:recipe:mission-bookmarks:v1");
    expect(stored).toContain(expectedBookmark);
    await expect(row.getByRole("button", { name: "Rewards tracked" })).toBeVisible();

    await page.goto("/industry/blueprint-tracker");
    await expect(page.getByText("Additional Resources For Research", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Tracking", { exact: true }).first()).toBeVisible();
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
