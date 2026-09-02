import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const expectedHeaders = {
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

test("serves the neutral application without browser errors and with security protections", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Mathematics/i,
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  expect(browserErrors).toEqual([]);

  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["permissions-policy"]).toBe(
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  expect(headers["x-correlation-id"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(headers).toMatchObject(expectedHeaders);
});

test("serves a minimal dynamic health response", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-correlation-id"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(response.headers()).toMatchObject(expectedHeaders);
});

test("renders primary semantic landmarks and heading hierarchy", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  await expect(main).toHaveAttribute("id", "main-content");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Mathematics/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /What we did|Where we|Announcements|Want to join/i,
    }).first(),
  ).toBeVisible();
});

test("shifts keyboard focus to #main-content via skip link", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  const mainContent = page.locator("#main-content");
  await expect(mainContent).toBeFocused();
});

test("handles 404 with meaningful not-found content and returns home", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const response = await page.goto("/non-existent-route");

  expect(response?.status()).toBe(404);
  expect(browserErrors).toEqual([]);
  await expect(page).toHaveTitle(/Page Not Found/i);

  const headers = response?.headers() ?? {};
  expect(headers).toMatchObject(expectedHeaders);
  expect(headers["content-security-policy"]).toContain("default-src 'self'");

  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByText("The requested page does not exist or has been moved."),
  ).toBeVisible();

  const returnHomeLink = page.getByRole("link", { name: "Return home" });
  await expect(returnHomeLink).toBeVisible();
  await returnHomeLink.click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Mathematics/i,
    }),
  ).toBeVisible();
});

test("prevents horizontal overflow across mobile (320px) and desktop viewports", async ({
  page,
}) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow, `Viewport ${viewport.width}x${viewport.height} had horizontal overflow`).toBe(false);
  }
});

test("respects prefers-reduced-motion media query", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const prefersReduced = await page.evaluate(() => {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  expect(prefersReduced).toBe(true);

  const transitionDuration = await page.evaluate(() => {
    const link = document.querySelector("a");
    return link ? window.getComputedStyle(link).transitionDuration : "0s";
  });
  expect(transitionDuration).toBe("0s");
});

test("passes AxeBuilder automated WCAG scan with zero violations on public routes", async ({
  page,
}) => {
  await page.goto("/");
  const homeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const homeCriticalOrSerious = homeResults.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(homeCriticalOrSerious).toEqual([]);
  expect(homeResults.violations).toEqual([]);

  await page.goto("/apply");
  const applyResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(applyResults.violations).toEqual([]);

  await page.goto("/apply/confirmation");
  const confirmResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(confirmResults.violations).toEqual([]);

  await page.goto("/non-existent-route");
  const notFoundResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const notFoundCriticalOrSerious = notFoundResults.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(notFoundCriticalOrSerious).toEqual([]);
  expect(notFoundResults.violations).toEqual([]);
});

test("renders safe auth states when the live provider is not configured", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to LOGOS" }),
  ).toBeVisible();
  await expect(
    page.getByText("Non-production sign-in is not configured yet."),
  ).toBeVisible();

  const signInResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(signInResults.violations).toEqual([]);

  await page.goto("/auth/status?state=failed");
  await expect(
    page.getByRole("heading", { level: 1, name: "Identity status" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").getByText("could not be verified"),
  ).toBeVisible();
});

test("renders 403 access denied on protected admin routes without session", async ({
  page,
}) => {
  const protectedAdminRoutes = [
    "/admin/applications",
    "/admin/members",
    "/admin/sessions",
    "/admin/attendance",
    "/admin/warnings",
  ];

  for (const route of protectedAdminRoutes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { level: 1, name: /403 • Access Denied/i }),
    ).toBeVisible();
  }
});

test("renders unauthenticated member hub with informational fallback and zero WCAG violations", async ({
  page,
}) => {
  await page.goto("/members");
  await expect(
    page.getByRole("heading", { level: 1, name: "LOGOS Member Portal" }),
  ).toBeVisible();
  await expect(
    page.getByText("The member hub provides meeting schedules"),
  ).toBeVisible();

  const memberResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(memberResults.violations).toEqual([]);
});
