import { expect, test } from "@playwright/test";

const redirects = [
  ["/industry/blueprint-tracker", "/industry/crafting"],
  ["/industry/missions", "/industry/crafting"],
  ["/industry/missions/old-name--concept-id", "/industry/crafting"],
  ["/dashboard/doctrine/armor-threshold", "/dashboard"],
  ["/doctrine/armor-threshold", "/dashboard"],
  ["/tools/alpha-threshold", "/dashboard"],
  ["/combat/component-mapping", "/fitting"],
  ["/tools/component-mapping", "/fitting"],
  ["/tools/gunnery", "/fitting"],
] as const;

for (const [from, to] of redirects) {
  test(`${from} redirects to ${to} and replaces history`, async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate((href) => {
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, `${from}?channel=LIVE&retirementProbe=1`);
    await expect(page).toHaveURL(`${to}?channel=LIVE&retirementProbe=1`);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 768, height: 900 }, { width: 393, height: 852 }]) {
  test(`retired navigation is absent at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/industry/crafting");
    const menu = page.getByRole("button", { name: "Open primary navigation" });
    if (await menu.isVisible()) await menu.click();
    for (const [from] of redirects) {
      await expect(page.locator(`a[href="${from}"]`)).toHaveCount(0);
    }
    await page.screenshot({ path: `artifacts/legacy-retirement/navigation-${viewport.width}.png`, fullPage: true });
  });
}
