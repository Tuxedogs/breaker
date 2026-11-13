import { expect, test } from "@playwright/test";

test("V31 homepage replaces the old statistics dashboard without changing module routes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle("Breaker");

  const home = page.getByRole("main", { name: "Breaker workspaces" });
  await expect(home).toBeVisible();
  await expect(home.locator(".slice")).toHaveCount(5);
  await expect(home.locator("a.slice")).toHaveCount(4);
  await expect(home.locator(".slice[data-name='fitting']")).toHaveAttribute("aria-disabled", "true");
  await expect(home.locator(".slice[data-name='fitting']")).not.toHaveAttribute("href");
  await expect(page.locator(".dash-page")).toHaveCount(0);

  const destinations = await home.locator("a.slice").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  expect(destinations).toEqual([
    "/industry/mining",
    "/industry/crafting",
    "/logistics/build-queue",
    "/logistics/inventory",
  ]);

  for (const [name, asset] of [
    ["mine", "mine-v31.png"],
    ["craft", "craft-refinery-384x870.webp"],
    ["build", "build-v31.jpg"],
    ["inventory", "inventory-v31.jpg"],
    ["fitting", "fitting-v31.jpg"],
  ]) {
    const artwork = home.locator(".slice[data-name='" + name + "'] .slice-art");
    const image = await artwork.evaluate(async (element) => {
      const background = getComputedStyle(element).backgroundImage;
      const path = background.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? "";
      const img = new Image();
      img.src = path;
      await img.decode();
      return { path, width: img.naturalWidth, height: img.naturalHeight };
    });
    expect(image.path).toContain(asset);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 820, 1920]) {
  test("V31 homepage matches the responsive layout and navigates at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1080 });
    await page.goto("/dashboard");

    const home = page.getByRole("main", { name: "Breaker workspaces" });
    await expect(home.locator(".slice")).toHaveCount(5);
    const layout = await home.evaluate((main) => {
      const panels = Array.from(main.querySelectorAll<HTMLElement>(".slice"));
      const rects = panels.map((panel) => {
        const r = panel.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
      return {
        headerHeight: document.querySelector(".breaker-home .breaker-topbar")?.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth - innerWidth,
        rects,
      };
    });

    expect(layout.headerHeight).toBe(48);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    if (width === 390) {
      expect(layout.rects[0].y).toBe(layout.rects[1].y);
      expect(layout.rects[2].y).toBeGreaterThan(layout.rects[0].y);
      expect(layout.rects[4].width).toBeGreaterThan(layout.rects[0].width);
      expect(layout.rects[4].height).toBe(232);
    } else if (width === 820) {
      expect(layout.rects[0].y).toBe(layout.rects[1].y);
      expect(layout.rects[0].y).toBe(layout.rects[2].y);
      expect(layout.rects[3].y).toBeGreaterThan(layout.rects[0].y);
      expect(layout.rects[4].y).toBe(layout.rects[3].y);
    } else {
      expect(new Set(layout.rects.map((rect) => rect.y)).size).toBe(1);
    }

    await home.locator(".slice[data-name='craft']").click();
    await expect(page).toHaveURL(/\/industry\/crafting$/);
    await expect(page.locator(".dash-page")).toBeVisible();

    const mobileMenu = page.getByRole("button", { name: "Open primary navigation" });
    if (await mobileMenu.isVisible()) await mobileMenu.click();
    await page.locator('a[href="/dashboard"]:visible').first().click();
    await expect(home).toBeVisible();
  });
}

test("reduced motion removes animated navigation transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  const animation = await page.evaluate(
    () => getComputedStyle(document.documentElement, "::view-transition-new(root)").animationName,
  );
  expect(animation).toBe("none");
});
