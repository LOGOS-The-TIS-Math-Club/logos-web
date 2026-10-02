import { expect, test } from "@playwright/test";

test("explicit animation choice overrides reduced motion and survives refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Enable animations", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Enable animations", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  expect(
    await page
      .locator("a")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).not.toBe("0s");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".ascii-field").first()).toHaveAttribute(
    "data-ascii-status",
    "live",
  );

  const canvas = page.locator(".ascii-canvas-front").first();
  const firstFrame = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL(),
  );
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(firstFrame);
  expect(
    await page
      .locator(".scroll-cue")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).not.toBe("none");

  await page
    .getByRole("button", { name: "Disable animations", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  expect(
    await page
      .locator(".scroll-cue")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});
