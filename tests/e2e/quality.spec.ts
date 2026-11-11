import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { newPerson, onboard, register } from "./helpers";

/**
 * Release checks for core screens: no automatically detectable WCAG 2.2 A/AA
 * problems in light or dark theme, no sideways scrolling on a 320-pixel
 * phone, and no Content Security Policy violations.
 *
 * Automated checks find only part of what matters; keyboard and
 * screen-reader passes are recorded in BUILD_STATUS.md.
 */

const PUBLIC = [
  "/",
  "/how-it-works",
  "/for-contributors",
  "/for-organisations",
  "/explore",
  "/explore?kind=organisations",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/no-such-page",
];

function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });
  return violations;
}

async function audit(page: Page, path: string) {
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => localStorage.setItem("proofme-theme", value), theme);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    );
    expect(summary, `${path} in ${theme} theme`).toEqual([]);
  }
}

async function noSidewaysScroll(page: Page, path: string) {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${path} scrolls sideways at 320px`).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.describe("release quality", () => {
  test("public pages are accessible, fit a small phone, and keep to the security policy", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const csp = watchCsp(page);
    await page.goto("/");
    for (const path of PUBLIC) {
      await audit(page, path);
      await noSidewaysScroll(page, path);
    }
    expect(csp).toEqual([]);
  });

  test("the keyboard reaches the skip link, the sign-in form and the explore search", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // Sign-in form: fields in reading order, then the submit button.
    await page.goto("/login");
    await page.getByLabel("Email").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();

    // Focus is visible: the focused control draws an outline.
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).not.toBe("none");

    // The explore filters work without a mouse.
    await page.goto("/explore");
    await page.getByRole("searchbox", { name: "Name or username" }).focus();
    await page.keyboard.type("nobody-matches-this");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=nobody-matches-this/);
    await expect(page.getByText("Nothing found")).toBeVisible();
  });

  test("signed-in, organisation and admin pages are accessible and fit a small phone", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    const csp = watchCsp(page);
    // An administrator (see PROOFME_LOCAL_ADMIN_EMAIL in playwright.config.ts) who
    // also owns an organisation, so one account reaches every area.
    const person = { ...newPerson("Quinn Quality"), email: "e2e-quality@example.test" };
    await register(page, person);
    await onboard(page, person, "Checks every screen.");
    await page.goto("/dashboard/settings#privacy");
    await page.getByLabel("Anyone with the link").check();
    await page.getByRole("button", { name: "Save privacy settings" }).click();
    await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();
    const slug = `quality-${randomUUID().slice(0, 6)}`;
    await page.goto("/organisations/new");
    await page.getByRole("textbox", { name: "Organisation name" }).fill("Quality Check Org");
    await page.getByRole("textbox", { name: "Address" }).fill(slug);
    await page.getByRole("button", { name: "Create organisation" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard`));

    const pages = [
      "/dashboard",
      "/dashboard/contributions",
      "/dashboard/contributions/new",
      "/dashboard/organisations",
      "/dashboard/portfolio",
      "/dashboard/identity",
      "/dashboard/notifications",
      "/dashboard/settings",
      `/org/${slug}/dashboard`,
      `/org/${slug}/verifications`,
      `/org/${slug}/attestations`,
      `/org/${slug}/projects`,
      `/org/${slug}/projects/new`,
      `/org/${slug}/team`,
      `/org/${slug}/contributors`,
      `/org/${slug}/settings`,
      `/org/${slug}`,
      `/u/${person.username}`,
      "/admin",
      "/admin/organisations?status=all",
      "/admin/reports",
      "/admin/users",
      "/admin/issuers",
      "/admin/audit",
    ];
    for (const path of pages) {
      await audit(page, path);
      await noSidewaysScroll(page, path);
    }
    expect(csp).toEqual([]);
  });
});
