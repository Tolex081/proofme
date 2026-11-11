import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { newPerson, onboard, register, signIn, signOut, type TestPerson } from "./helpers";

async function createOrganisation(page: Page, name: string, slug: string) {
  await page.goto("/organisations/new");
  await page.getByRole("textbox", { name: "Organisation name" }).fill(name);
  await page.getByRole("textbox", { name: "Address" }).fill(slug);
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard\\?created=1$`));
}

async function readyContribution(page: Page, title: string) {
  await page.goto("/dashboard/contributions/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: /One-line summary/ })
    .fill("Built the reviewer-facing proposal screen.");
  await page
    .getByRole("textbox", { name: /What you did/ })
    .fill("Designed and built the screen reviewers use to score proposals.");
  await page.getByRole("textbox", { name: /Your role/ }).fill("Frontend engineer");
  await page.getByRole("button", { name: "Add a link" }).click();
  await page.getByLabel("Link 1: address").fill("https://github.com/northstar-demo/portal/pull/42");
  await page.getByLabel("Link 1: description").fill("Pull request #42");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/saved=1$/);
  return new URL(page.url()).pathname;
}

async function account(page: Page, name: string): Promise<TestPerson> {
  const person = newPerson(name);
  await register(page, person);
  await onboard(page, person);
  return person;
}

test.describe("the review workflow", () => {
  test("send, ask, answer, approve: the claim is frozen into an attestation", async ({ page }) => {
    test.setTimeout(180_000);
    const contributor = await account(page, "Daniel Contributor");
    await signOut(page);
    const reviewer = await account(page, "Rita Reviewer");
    await signOut(page);

    // The owner sets up the organisation and invites a reviewer.
    await account(page, "Olu Owner");
    const slug = `review-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Review Org", slug);
    await page.goto(`/org/${slug}/projects/new`);
    await page.getByRole("textbox", { name: "Project name" }).fill("Open Grants Portal");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Open Grants Portal" })).toBeVisible();
    await page.goto(`/org/${slug}/team`);
    await page.getByRole("textbox", { name: "Their email" }).fill(reviewer.email);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const link = await page.getByRole("textbox", { name: "Invitation link" }).inputValue();
    await signOut(page);
    await signIn(page, reviewer);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(new URL(link).pathname);
    await page.getByRole("button", { name: "Accept and join" }).click();
    await expect(page).toHaveURL(/joined=1$/);
    await signOut(page);

    // The contributor sends a complete claim to the organisation's project.
    await signIn(page, contributor);
    await expect(page).toHaveURL(/\/dashboard$/);
    const contributionPath = await readyContribution(page, "Proposal review interface");
    await page
      .getByRole("combobox", { name: "Who should confirm it?" })
      .selectOption({ label: "Review Org, Open Grants Portal" });
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/With Review Org.s reviewers since/)).toBeVisible();
    await signOut(page);

    // The reviewer is notified, finds it in the queue, and asks a question.
    await signIn(page, reviewer);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/dashboard/notifications");
    await expect(
      page.getByRole("link", { name: "New contribution to review: Proposal review interface" }),
    ).toBeVisible();
    await page.goto(`/org/${slug}/verifications`);
    await page.getByRole("link", { name: /Proposal review interface/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Proposal review interface" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Ask for more/ }).check();
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Say what you need from the contributor.").first()).toBeVisible();
    await page
      .getByRole("textbox", { name: /Message to the contributor/ })
      .fill("Which commits were yours?");
    await page.getByRole("textbox", { name: /Internal note/ }).fill("Check with the lead.");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Question sent to the contributor.")).toBeVisible();
    await signOut(page);

    // The contributor sees the question (not the internal note) and answers.
    await signIn(page, contributor);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(contributionPath);
    await expect(page.getByText("Which commits were yours?").first()).toBeVisible();
    await expect(page.getByText("Check with the lead.")).toBeHidden();
    await page.getByRole("textbox", { name: "Your answer" }).fill("Commits 3 to 9.");
    await page.getByRole("button", { name: "Send answer" }).click();
    await expect(page.getByText("Answer sent.")).toBeVisible();
    await signOut(page);

    // The reviewer approves.
    await signIn(page, reviewer);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/org/${slug}/verifications`);
    await page.getByRole("link", { name: /Proposal review interface/ }).click();
    await expect(page.getByText("Commits 3 to 9.")).toBeVisible();
    await expect(page.getByText("Check with the lead.")).toBeVisible();
    await page.getByRole("radio", { name: /^Approve/ }).check();
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(
      page.getByText("Approved. The attestation is recorded and waiting to be anchored on NEAR."),
    ).toBeVisible();
    await page.goto(`/org/${slug}/attestations`);
    await expect(page.getByText("Organisation approved")).toBeVisible();
    await expect(page.getByText("Awaiting NEAR anchor")).toBeVisible();
    await signOut(page);

    // The contributor sees the frozen record; it can no longer be edited.
    await signIn(page, contributor);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(contributionPath);
    await expect(page.getByText("Approved, awaiting NEAR anchor").first()).toBeVisible();
    await expect(page.getByText(/^[0-9a-f]{64}$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit" })).toBeHidden();
    await page.goto(`${contributionPath}/edit`);
    await expect(page).toHaveURL(new RegExp(`${contributionPath}$`));
  });

  test("nobody can approve their own claim, even an organisation's owner", async ({ page }) => {
    await account(page, "Self Owner");
    const slug = `self-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Self Org", slug);
    await readyContribution(page, "My own work");
    await page
      .getByRole("combobox", { name: "Who should confirm it?" })
      .selectOption({ label: "Self Org, no specific project" });
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();

    await page.goto(`/org/${slug}/verifications`);
    await expect(page.getByText("Your own claim")).toBeVisible();
    await page.getByRole("link", { name: /My own work/ }).click();
    await expect(page.getByText("You cannot review your own contribution.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Record decision" })).toBeHidden();
  });

  test("a rejection needs a reason, which the contributor sees, and the claim can be reworked", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const contributor = await account(page, "Rejected Person");
    const contributionPath = await readyContribution(page, "Disputed work");
    await signOut(page);

    const owner = await account(page, "Strict Owner");
    const slug = `strict-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Strict Org", slug);
    await signOut(page);

    await signIn(page, contributor);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(contributionPath);
    await page
      .getByRole("combobox", { name: "Who should confirm it?" })
      .selectOption({ label: "Strict Org, no specific project" });
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();
    await signOut(page);

    await signIn(page, owner);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/org/${slug}/verifications`);
    await page.getByRole("link", { name: /Disputed work/ }).click();
    await page.getByRole("radio", { name: /Do not approve/ }).check();
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Say why you are not approving it.").first()).toBeVisible();
    await page
      .getByRole("textbox", { name: /Message to the contributor/ })
      .fill("We could not match this to your account.");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Not approved. The contributor has been told why.")).toBeVisible();
    await signOut(page);

    await signIn(page, contributor);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(contributionPath);
    await expect(page.getByText("Not approved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("We could not match this to your account.").first()).toBeVisible();
    await page.getByRole("button", { name: "Rework and send again" }).click();
    await expect(page).toHaveURL(new RegExp(`${contributionPath}/edit$`));
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Disputed work",
    );
  });
});
