import { expect, test } from "@playwright/test";

import { newPerson, onboard, register } from "./helpers";

test.describe("phone layout", () => {
  test("the public menu opens, navigates and closes", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "How it works" })
      .click();
    await expect(page).toHaveURL("/how-it-works");
  });

  test("no page scrolls sideways", async ({ page }) => {
    for (const path of [
      "/",
      "/how-it-works",
      "/for-contributors",
      "/for-organisations",
      "/register",
      "/login",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("the workspace is usable on a phone", async ({ page }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("link", { name: "Settings" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
