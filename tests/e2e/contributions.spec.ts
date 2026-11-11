import { expect, test, type Page } from "@playwright/test";

import { expectNotFound, newPerson, onboard, register, signOut } from "./helpers";

async function addLink(page: Page, index: number, url: string, label: string) {
  await page.getByRole("button", { name: index === 1 ? "Add a link" : "Add another link" }).click();
  await page.getByLabel(`Link ${index}: address`).fill(url);
  await page.getByLabel(`Link ${index}: description`).fill(label);
}

async function startContribution(page: Page, title: string) {
  await page.goto("/dashboard/contributions/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.getByLabel("One-line summary").fill("Built the reviewer-facing proposal screen.");
  await page.getByLabel("Your role").fill("Frontend engineer");
  await page
    .getByRole("textbox", { name: /What you did/ })
    .fill("Designed and built the screen reviewers use.");
}

async function makeProfilePublic(page: Page) {
  await page.goto("/dashboard/settings#privacy");
  await page.getByLabel("Anyone with the link").check();
  await page.getByRole("button", { name: "Save privacy settings" }).click();
  await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();
}

test.describe("contributions and evidence", () => {
  test("create a draft with several links, fix a bad link, edit and reload", async ({ page }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);

    await startContribution(page, "Proposal review interface");
    await addLink(page, 1, "https://github.com/northstar-demo/portal/pull/42", "Pull request #42");
    await addLink(page, 2, "javascript:alert(1)", "Demo");
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(page.getByText("Only https:// links are accepted.")).toBeVisible();
    await expect(page.getByLabel("Link 2: address")).toHaveAttribute("aria-invalid", "true");
    // Nothing typed was lost.
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Proposal review interface",
    );
    await expect(page.getByLabel("Link 1: kind")).toHaveValue("github_pr");

    await page.getByLabel("Link 2: address").fill("https://demo.example.org/review");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/dashboard\/contributions\/[0-9a-f-]+\?saved=1$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Proposal review interface" }),
    ).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    // Role queries see only what is visible on the current page.
    await expect(page.getByRole("link", { name: /^Open/ })).toHaveCount(2);

    await page.getByRole("link", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Proposal review interface, v2");
    await page.getByRole("button", { name: "Remove link 2" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Proposal review interface, v2" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Proposal review interface, v2" }),
    ).toBeVisible();
    await expect(page.getByText("Demo", { exact: true })).toBeHidden();

    await page.goto("/dashboard/contributions");
    await expect(page.getByRole("link", { name: /Proposal review interface, v2/ })).toBeVisible();
    await page.getByRole("link", { name: "Self-reported" }).click();
    await expect(page.getByText("Nothing with this status")).toBeVisible();
  });

  test("drafts never appear publicly; self-reported work is labelled, never verified", async ({
    page,
    browser,
  }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await makeProfilePublic(page);

    await startContribution(page, "Public draft");
    await addLink(page, 1, "https://github.com/northstar-demo/portal/pull/7", "Pull request #7");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/saved=1$/);
    const detailUrl = page.url().replace("?saved=1", "");

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/u/${person.username}`);
    await expect(visitor.getByText("Public draft")).toBeHidden();

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Mark as self-reported" }).click();
    await expect(page.getByText("Self-reported", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

    await visitor.reload();
    await expect(visitor.getByRole("heading", { name: "Self-reported" })).toBeVisible();
    await expect(visitor.getByText("Public draft")).toBeVisible();
    await expect(visitor.getByText("Verified contributions")).toBeVisible();
    await expect(visitor.getByText(/None yet\. Contributions appear here once/)).toBeVisible();

    // A private contribution never appears, whatever its status.
    await startContribution(page, "Private record");
    await addLink(page, 1, "https://example.org/private", "Private link");
    await page.getByLabel("Keep it private").check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/saved=1$/);
    await page.getByRole("button", { name: "Mark as self-reported" }).click();
    await expect(page.getByText("Self-reported", { exact: true }).first()).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByText("Private record")).toBeHidden();
    await visitor.context().close();
  });

  test("one person cannot open or edit another's contribution", async ({ page }) => {
    const owner = newPerson();
    await register(page, owner);
    await onboard(page, owner);
    await startContribution(page, "Owner's private work");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/saved=1$/);
    const detailUrl = new URL(page.url()).pathname;
    await signOut(page);

    const intruder = newPerson("Ivan Intruder");
    await register(page, intruder);
    await onboard(page, intruder);
    await page.goto(detailUrl);
    await expectNotFound(page);
    await expect(page.getByText("Owner's private work")).toBeHidden();
    await page.goto(`${detailUrl}/edit`);
    await expectNotFound(page);
  });

  test("a draft can be deleted after confirming", async ({ page }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await startContribution(page, "Short-lived draft");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/saved=1$/);

    await page.getByRole("button", { name: "Delete draft" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page).toHaveURL(/\/dashboard\/contributions\?deleted=1$/);
    await expect(page.getByText("Draft deleted.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Short-lived draft/ })).toHaveCount(0);
  });
});
