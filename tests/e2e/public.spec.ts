import { expect, test } from "@playwright/test";

import { expectNotFound } from "./helpers";

test.describe("public website", () => {
  test("landing page explains the product and every main link works", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Your work, confirmed by the people who saw it/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Sample profile")).toBeVisible();

    for (const [name, path, heading] of [
      ["How it works", "/how-it-works", /From a claim to a record/],
      ["For contributors", "/for-contributors", /Your work, credited/],
      ["For organisations", "/for-organisations", /Give credit you are willing to sign/],
    ] as const) {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    for (const path of ["/privacy", "/terms", "/login", "/register"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
    }
  });

  test("the sample record matches until a word is changed", async ({ page }) => {
    await page.goto("/#check");
    const check = page.locator("#check form");
    const status = check.getByRole("status");

    await check.getByRole("button", { name: "Recompute the digest" }).click();
    await expect(status).toContainText("Match. This is exactly the record that was approved.");

    await check.getByLabel(/Role/).fill("Lead engineer");
    await check.getByRole("button", { name: "Recompute the digest" }).click();
    await expect(status).toContainText("No match.");

    await check.getByRole("button", { name: "Restore the original" }).click();
    await check.getByRole("button", { name: "Recompute the digest" }).click();
    await expect(status).toContainText("Match.");
  });

  test("the theme switch changes theme and remembers it", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(18, 18, 31)");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("an unknown profile shows the not-found page and is not indexed", async ({ page }) => {
    await page.goto("/u/nobody-here-123");
    await expectNotFound(page);
  });
});
