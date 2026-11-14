import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { expectNotFound, newPerson, onboard, register, signIn, signOut } from "./helpers";

/**
 * The web server is started with PROOFME_LOCAL_ADMIN_EMAIL set to this
 * address (see playwright.config.ts), so this account becomes a platform
 * administrator when it signs up. Test-only values in an in-memory database.
 */
const ADMIN = {
  name: "Ade Admin",
  email: "e2e-admin@example.test",
  password: `e2e-admin-pw-${randomUUID()}`,
  username: `admin-${randomUUID().slice(0, 6)}`,
};

async function makePublic(page: Page) {
  await page.goto("/dashboard/settings#privacy");
  await page.getByLabel("Anyone with the link").check();
  await page.getByRole("button", { name: "Save privacy settings" }).click();
  await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();
}

test.describe("platform administration, reports and explore", () => {
  test("a report and an organisation review go through the admin area; others cannot see it", async ({
    page,
    browser,
  }) => {
    // An owner with a public profile creates an organisation and asks for review.
    const owner = newPerson("Olu Explorable");
    await register(page, owner);
    await onboard(page, owner, "Runs a fictional organisation.");
    await makePublic(page);
    const slug = `review-${randomUUID().slice(0, 6)}`;
    await page.goto("/organisations/new");
    await page.getByRole("textbox", { name: "Organisation name" }).fill("Review Me Collective");
    await page.getByRole("textbox", { name: "Address" }).fill(slug);
    await page
      .getByRole("textbox", { name: /About the organisation/ })
      .fill("A fictional organisation used in tests.");
    await page.getByRole("textbox", { name: /Website/ }).fill("https://example.org");
    await page.getByRole("button", { name: "Create organisation" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard\\?created=1$`));
    await page.getByRole("button", { name: "Ask Atesta to review us" }).click();
    await expect(page.getByText("Atesta review pending").first()).toBeVisible();

    // The admin area does not exist for ordinary accounts.
    await page.goto("/admin");
    await expectNotFound(page);
    await page.goto("/dashboard");
    await signOut(page);

    // Signed-out visitors are asked to sign in before reporting.
    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/u/${owner.username}`);
    await visitor.getByText("Report this profile").click();
    await expect(visitor.getByRole("link", { name: "Sign in" }).last()).toBeVisible();

    // Explore finds the public profile and the organisation.
    await visitor.goto("/explore?q=Explorable");
    await expect(visitor.getByRole("link", { name: /Olu Explorable/ })).toBeVisible();
    await visitor.goto("/explore?kind=organisations&q=Review+Me");
    await expect(visitor.getByRole("link", { name: /Review Me Collective/ })).toBeVisible();
    await visitorContext.close();

    // A signed-in person reports the profile.
    const reporter = newPerson("Rae Reporter");
    await register(page, reporter);
    await onboard(page, reporter);
    await page.goto(`/u/${owner.username}`);
    await page.getByText("Report this profile").click();
    await page.getByRole("combobox", { name: "What is wrong?" }).selectOption("impersonation");
    await page.getByRole("textbox", { name: /Details/ }).fill("Test report, not a real concern.");
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText(/A Atesta administrator will look at this/)).toBeVisible();
    await page.goto("/dashboard");
    await signOut(page);

    // The administrator signs up.
    await page.goto("/register");
    await page.getByLabel("Your name").fill(ADMIN.name);
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await onboard(page, ADMIN);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Administration" })).toBeVisible();

    // Handle the report.
    await page.getByRole("link", { name: "Reports" }).first().click();
    const report = page.getByRole("listitem").filter({ hasText: owner.username });
    await expect(
      report.getByRole("heading", { name: "Pretends to be someone else" }),
    ).toBeVisible();
    await report.getByRole("textbox", { name: /What you did/ }).fill("Checked: no action.");
    await report.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Report dismissed.")).toBeVisible();

    // Review the organisation: a reason is required to send it back.
    await page.goto("/admin/organisations");
    await page.getByRole("link", { name: /Review Me Collective/ }).click();
    await page.getByRole("radio", { name: /Ask for more/ }).check();
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText(/Give a reason/).first()).toBeVisible();
    // The choice survives the error (no silent reset to "Approve").
    await expect(page.getByRole("radio", { name: /Ask for more/ })).toBeChecked();

    await page.getByRole("radio", { name: /Approve/ }).check();
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Approved. The owners have been told.")).toBeVisible();
    await expect(page.getByText("Reviewed by Atesta").first()).toBeVisible();

    await page.goto("/admin/audit?action=admin.");
    await expect(page.getByRole("cell", { name: "admin.organisation.approve" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "admin.report.dismissed" })).toBeVisible();
    await signOut(page);

    // The owner is told, and the public page shows the review.
    await signIn(page, owner);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/dashboard/notifications");
    await expect(
      page.getByText("Review Me Collective was reviewed and approved by Atesta"),
    ).toBeVisible();
    await page.goto(`/org/${slug}`);
    await expect(page.getByText("Reviewed by Atesta").first()).toBeVisible();
  });
});
