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
      await page.goto("/dashboard/contributions/new");
      await page
        .getByRole("textbox", { name: "Title", exact: true })
        .fill("Proposal review interface");
      await page
        .getByRole("textbox", { name: /One-line summary/ })
        .fill("Built the reviewer-facing proposal screen for the grants round.");
      await page.getByRole("textbox", { name: /Your role/ }).fill("Frontend engineer");
      await page.getByRole("button", { name: "Add a link" }).click();
      await page
        .getByLabel("Link 1: address")
        .fill("https://github.com/northstar-demo/portal/pull/42");
      await page.getByLabel("Link 1: description").fill("Pull request #42");
      await shot("contribution-form");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page).toHaveURL(/saved=1$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Proposal review interface" }),
      ).toBeVisible();
      await shot("contribution-detail");
      await page.goto("/dashboard/contributions");
      await expect(page.getByRole("heading", { level: 1, name: "Contributions" })).toBeVisible();
      await shot("contributions");
      const orgSlug = `northstar-${size.name}-${theme}`;
      await page.goto("/organisations/new");
      await page
        .getByRole("textbox", { name: "Organisation name" })
        .fill("Northstar Protocol (demo)");
      await page.getByRole("textbox", { name: "Address" }).fill(orgSlug);
      await page
        .getByRole("textbox", { name: /About the organisation/ })
        .fill("A fictional protocol used to demonstrate ProofMe.");
      await page.getByRole("textbox", { name: /Website/ }).fill("https://northstar.example.org");
      await page.getByRole("button", { name: "Create organisation" }).click();
      await expect(page).toHaveURL(/created=1$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Northstar Protocol (demo)" }),
      ).toBeVisible();
      await shot("org-dashboard");
      await page.goto(`/org/${orgSlug}/team`);
      await page.getByRole("textbox", { name: "Their email" }).fill("reviewer@example.test");
      await page.getByRole("button", { name: "Create invitation" }).click();
      await expect(page.getByRole("textbox", { name: "Invitation link" })).toBeVisible();
      await shot("org-team");
      await page.goto(`/org/${orgSlug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shot("org-public");
      await context.close();
    }
  }
});
