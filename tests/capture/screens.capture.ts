import { expect, test } from "@playwright/test";

import { newPerson, onboard, register } from "../e2e/helpers";

const OUT = ".impeccable/review";

const SIZES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("capture public and workspace screens in both themes", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const theme of ["light", "dark"] as const) {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const shot = async (name: string) => {
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `${OUT}/${name}-${size.name}-${theme}.png`, fullPage: true });
      };

      for (const [name, path] of [
        ["landing", "/"],
        ["how-it-works", "/how-it-works"],
        ["register", "/register"],
      ] as const) {
        await page.goto(path);
        await shot(name);
      }

      const person = newPerson("Daniel Okafor");
      await register(page, person);
      await shot("onboarding");
      await onboard(page, person, "Frontend engineer building review tools for grant programmes.");
      await shot("dashboard");
      for (const [name, path] of [
        ["settings", "/dashboard/settings"],
        ["identity", "/dashboard/identity"],
        ["portfolio", "/dashboard/portfolio"],
        ["notifications", "/dashboard/notifications"],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await shot(name);
      }
      await context.close();
    }
  }
});
