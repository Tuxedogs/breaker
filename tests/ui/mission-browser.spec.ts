import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.describe("Mission Browser mission modal", () => {
  test("opens the complete mission workspace directly in a modal", async ({ page }) => {
    await page.goto("/industry/missions?search=Bit%20Zeros%20Black%20Box%20Recovery%20Nyx%20Easy");

    const missionCard = page.locator(".mission-group-card").first();
    await expect(missionCard.locator(".mission-rep-scope-badge")).toBeVisible();
    await expect(missionCard.locator(".mission-card-legal")).toContainText("Legal classification:");
    await expect(missionCard.locator(".mb-badge").filter({ hasText: /lawful/i })).toHaveCount(0);
    await missionCard.click();
    await expect(page).toHaveURL(/\/industry\/missions\/bit-zeros-black-box-recovery-nyx-easy--70d0a94a8a837e887b3c\?/);
    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    const modal = page.getByRole("dialog", { name: /Bit Zeros Black Box Recovery Nyx Easy mission details/i });
    await expect(modal).toBeVisible();
    await expect(workspace).toBeVisible();
    await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
    await expect(workspace.locator(".mission-concept-dossier")).toBeVisible();
    await expect(page.locator(".mission-inline-drawer")).toHaveCount(0);
    const headerBadgeCount = await workspace.locator(".mission-dossier-header__identity > div > .mb-badges .mb-badge").count();
    expect(headerBadgeCount).toBeLessThanOrEqual(4);
    const canonSurface = await modal.evaluate((element) => ({
      borderRadius: getComputedStyle(element).borderRadius,
      backgroundColor: getComputedStyle(element).backgroundColor,
    }));
    expect(canonSurface.borderRadius).toBe("7px");
    expect(canonSurface.backgroundColor).toBe("rgb(10, 17, 25)");

    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
  });

  test("upgrades legacy mission links and repairs stale readable names", async ({ page }) => {
    const canonicalPath = "/industry/missions/bit-zeros-black-box-recovery-nyx-easy--70d0a94a8a837e887b3c";

    await page.goto("/industry/missions?selected=70d0a94a8a837e887b3c");
    await expect(page).toHaveURL(new RegExp(`${canonicalPath}$`));
    await expect(page.getByRole("region", { name: /selected mission workspace/i })).toBeVisible();

    await page.goto("/industry/missions/old-mission-name--70d0a94a8a837e887b3c");
    await expect(page).toHaveURL(new RegExp(`${canonicalPath}$`));
  });

  test("keeps a large exact-variant comparison bounded and sortable", async ({ page }) => {
    await page.goto("/industry/missions?selected=9cab64c0aa3664d21d3c");

    const workspace = page.getByRole("region", { name: /Hauler Needed for .*Shipment selected mission workspace/i });
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
    await expect(path.getByText(/Generation [a-f0-9]{24}/)).toBeVisible();
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
    const bookmark = workspace.getByRole("button", { name: "Remove Bit Zeros Black Box Recovery Nyx Easy bookmark" });
    await expect(bookmark).toBeVisible();
    await bookmark.click();
    await workspace.getByRole("button", { name: /Bookmark Bit Zeros Black Box Recovery Nyx Easy/ }).click();

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

  test("shows a source-backed Rayari collection requirement", async ({ page }) => {
    await page.goto("/industry/missions?search=Additional%20Resources%20For%20Research");
    await page.locator(".mission-group-card").filter({ hasText: "Additional Resources For Research" }).first().click();
    const workspace = page.getByRole("region", { name: /Additional Resources For Research selected mission workspace/i });
    const requiredItems = workspace.locator(".mission-dossier-required-items");
    await expect(requiredItems.getByRole("heading", { name: "Items to Collect or Deliver" })).toBeVisible();
    await expect(requiredItems.getByText("Sunset Berries", { exact: true })).toBeVisible();
    await expect(requiredItems.getByText("At least 15 required", { exact: true })).toBeVisible();
    await expect(requiredItems.getByText("Collect / deliver", { exact: true })).toBeVisible();
  });

  test("shows readable Wikelo blueprint rewards", async ({ page }) => {
    await page.goto("/industry/missions?concept=bb820f376f648ce1b071");

    const workspace = page.getByRole("region", { name: /Heavy and Bright selected mission workspace/i });
    const blueprintPanel = workspace.locator(".mission-dossier-blueprint-panel");
    await expect(blueprintPanel.getByRole("heading", { name: "Blueprint Rewards" })).toBeVisible();
    await expect(blueprintPanel.locator(".mb-blueprint-item span").filter({ hasText: "Cds Combat Superheavy Backpack 01 03 01" })).toBeVisible();
    await expect(blueprintPanel.getByText(/100% chance to award pool/).first()).toBeVisible();
  });

  test("preserves source-backed runtime slots in mission titles", async ({ page }) => {
    await page.goto("/industry/missions?concept=4ef1fb7075669edcf82f");
    await expect(
      page.getByRole("region", { name: /Shut Off Power at \[Location\] selected mission workspace/i }),
    ).toBeVisible();
  });

  test("keeps the mission modal readable at supported review sizes", async ({ page }) => {
    const artifactRoot = "artifacts/mission-browser-modal";
    await mkdir(artifactRoot, { recursive: true });
    for (const viewport of [
      { width: 768, height: 900 },
      { width: 1680, height: 925 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/industry/missions?search=Bit%20Zeros%20Black%20Box%20Recovery%20Nyx%20Easy");
      const missionCard = page.locator(".mission-group-card").first();
      await expect(missionCard).toBeVisible();
      const cardStyle = await missionCard.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
        };
      });
      expect(cardStyle.borderRadius).toBe("4px");
      expect(cardStyle.boxShadow).toBe("none");
      await page.screenshot({
        path: `${artifactRoot}/mission-cards-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });

      await page.goto("/industry/missions?concept=bb820f376f648ce1b071");
      const workspace = page.getByRole("region", { name: /Heavy and Bright selected mission workspace/i });
      await expect(workspace).toBeVisible();
      await expect(workspace.locator(".mission-required-item-row strong").first()).toBeVisible();
      await expect(workspace.locator(".mb-blueprint-pool-copy > span").first()).toBeVisible();
      if (viewport.width === 1680) {
        await workspace.getByRole("button", { name: "All variants" }).click();
        await expect(workspace.locator("tbody tr")).toHaveCount(1);
      }
      const measurements = await workspace.evaluate((element) => {
        const item = element.querySelector<HTMLElement>(".mission-required-item-row strong");
        const blueprint = element.querySelector<HTMLElement>(".mb-blueprint-pool-copy > span");
        const title = element.querySelector<HTMLElement>(".mission-dossier-header__identity h2");
        const body = element.querySelector<HTMLElement>(".mission-dossier-body-grid");
        const rightRail = element.querySelector<HTMLElement>(".mission-dossier-right-rail");
        const footer = element.querySelector<HTMLElement>(".mission-dossier-footer");
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          itemFontSize: Number.parseFloat(getComputedStyle(item!).fontSize),
          blueprintFontSize: Number.parseFloat(getComputedStyle(blueprint!).fontSize),
          titleFontSize: Number.parseFloat(getComputedStyle(title!).fontSize),
          bodyBottom: body!.getBoundingClientRect().bottom,
          rightRailBottom: rightRail!.getBoundingClientRect().bottom,
          footerTop: footer!.getBoundingClientRect().top,
        };
      });
      expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.clientWidth + 1);
      expect(measurements.itemFontSize).toBeGreaterThanOrEqual(14);
      expect(measurements.blueprintFontSize).toBeGreaterThanOrEqual(12);
      expect(measurements.titleFontSize).toBeGreaterThanOrEqual(22);
      if (viewport.width >= 2200) {
        expect(measurements.itemFontSize).toBeGreaterThanOrEqual(15);
        expect(measurements.blueprintFontSize).toBeGreaterThanOrEqual(13);
        expect(measurements.titleFontSize).toBeGreaterThanOrEqual(30);
      }
      expect(measurements.footerTop).toBeGreaterThanOrEqual(measurements.bodyBottom);
      expect(measurements.footerTop).toBeGreaterThanOrEqual(measurements.rightRailBottom);
      await page.screenshot({
        path: `${artifactRoot}/wikelo-heavy-and-bright-modal-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
      await workspace.locator(".mission-dossier-header").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${artifactRoot}/wikelo-heavy-and-bright-modal-top-${viewport.width}x${viewport.height}.png`,
      });
      await workspace.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${artifactRoot}/wikelo-heavy-and-bright-modal-content-${viewport.width}x${viewport.height}.png`,
      });
    }
  });

  test("keeps certification buy-in separate from base payout", async ({ page }) => {
    await page.goto("/industry/missions?concept=1cf7b7218006719074f0");

    const workspace = page.getByRole("region", { name: /Advanced Tracker License Certification selected mission workspace/i });
    await expect(workspace.locator(".mission-dossier-reward-status strong").filter({ hasText: "91,000 aUEC base / solo" })).toBeVisible();
    await expect(workspace.getByText("Certification buy-in", { exact: true })).toBeVisible();
    await expect(workspace.getByText("10,000 aUEC", { exact: true })).toBeVisible();
    await expect(workspace.getByText("Separate from the base/solo payout.", { exact: true })).toBeVisible();
  });

  test("preserves a resolved calculated zero", async ({ page }) => {
    await page.goto("/industry/missions?concept=c870e1aef43e6d02bcd9");

    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await expect(workspace.getByText("0 aUEC base / solo", { exact: true }).first()).toBeVisible();
  });

  test("offers a recoverable zero-results state", async ({ page }) => {
    const artifactRoot = "artifacts/mission-browser-modal";
    await mkdir(artifactRoot, { recursive: true });
    for (const viewport of [
      { width: 768, height: 900 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/industry/missions?search=__no_mission_matches__");
      await expect(page.getByText("No missions match these filters", { exact: true })).toBeVisible();
      await page.screenshot({
        path: `${artifactRoot}/mission-zero-results-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/search=/);
    await expect(page.locator(".mission-group-card").first()).toBeVisible();
  });

  test("keeps the selected workspace stable while exact variants load", async ({ page }) => {
    let releaseVariants: () => void = () => undefined;
    const variantGate = new Promise<void>((resolve) => {
      releaseVariants = resolve;
    });
    await page.route("**/api/missions/family/*/variants", async (route) => {
      await variantGate;
      await route.continue();
    });

    await page.goto("/industry/missions?selected=70d0a94a8a837e887b3c");
    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await expect(workspace.getByText("Loading exact variants...", { exact: true })).toBeVisible();
    releaseVariants();
    await expect(workspace.getByText("Exact mission comparison", { exact: true })).toBeVisible();
  });

  test("surfaces deterministic eligibility request errors", async ({ page }) => {
    await page.route("**/eligibility", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Eligibility fixture unavailable." }),
    }));
    await page.goto("/industry/missions?selected=70d0a94a8a837e887b3c");

    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await workspace.getByRole("button", { name: "Check" }).click();
    const eligibility = page.getByRole("region", { name: /eligibility/i });
    await eligibility.getByRole("button", { name: "Evaluate eligibility" }).click();
    await expect(eligibility.getByText("Eligibility fixture unavailable.", { exact: true })).toBeVisible();
  });

  test("preserves an unresolved prerequisite path without inventing steps", async ({ page }) => {
    await page.route("**/prerequisite-path", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generationId: "fixture-generation",
        result: {
          generationId: "fixture-generation",
          goal: { type: "variant_eligibility", variantId: "fixture-target" },
          costModel: { type: "mission_count", unit: "mission_completion" },
          status: "unresolved",
          minimumMissionCount: null,
          primaryPlan: null,
          alternatePlans: [],
          alternatePlansTruncated: false,
          exploredStateCount: 1,
          failures: [{ code: "dangling_completion_tag", message: "No source-backed producer is published for this required completion tag." }],
          relevantCycles: [],
        },
      }),
    }));
    await page.goto("/industry/missions?selected=70d0a94a8a837e887b3c");

    const workspace = page.getByRole("region", { name: /selected mission workspace/i });
    await workspace.getByRole("button", { name: "Check" }).click();
    const eligibility = page.getByRole("region", { name: /eligibility/i });
    await eligibility.getByRole("button", { name: "Find prerequisite path" }).click();
    const path = eligibility.locator(".mission-path-result");
    await expect(path.locator(".mission-eligibility-status strong")).toHaveText("unresolved");
    await expect(path.getByText("No source-backed producer is published for this required completion tag.", { exact: true })).toBeVisible();
    await expect(path.locator("ol li")).toHaveCount(0);
  });
});
