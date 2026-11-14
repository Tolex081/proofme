import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import {
  expectNotFound,
  newPerson,
  onboard,
  register,
  signIn,
  signOut,
  type TestPerson,
} from "./helpers";

async function createOrganisation(page: Page, name: string, slug: string) {
  await page.goto("/organisations/new");
  await page.getByRole("textbox", { name: "Organisation name" }).fill(name);
  await page.getByRole("textbox", { name: "Address" }).fill(slug);
  await page
    .getByRole("textbox", { name: /About the organisation/ })
    .fill("A fictional organisation used in tests.");
  await page.getByRole("textbox", { name: /Website/ }).fill("https://example.org");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard\\?created=1$`));
}

async function invite(page: Page, slug: string, email: string, role: string) {
  await page.goto(`/org/${slug}/team`);
  await page.getByRole("textbox", { name: "Their email" }).fill(email);
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = page.getByRole("textbox", { name: "Invitation link" });
  await expect(link).toBeVisible();
  return link.inputValue();
}

async function newMember(page: Page): Promise<TestPerson> {
  const person = newPerson("Rita Reviewer");
  await register(page, person);
  await onboard(page, person);
  await signOut(page);
  return person;
}

test.describe("organisations, projects and teams", () => {
  test("an owner creates an organisation, a project, asks for review, and the public page shows it honestly", async ({
    page,
  }) => {
    const owner = newPerson("Olu Owner");
    await register(page, owner);
    await onboard(page, owner);
    const slug = `north-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Northstar Test", slug);

    await expect(page.getByText("Not reviewed by Atesta").first()).toBeVisible();
    await expect(page.getByText("No NEAR issuer yet").first()).toBeVisible();

    await page.getByRole("button", { name: "Ask Atesta to review us" }).click();
    // The page refreshes and the request button gives way to the pending badge.
    await expect(page.getByText("Atesta review pending").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Atesta review pending").first()).toBeVisible();

    await page.goto(`/org/${slug}/projects/new`);
    await page.getByRole("textbox", { name: "Project name" }).fill("Open Grants Portal");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Open Grants Portal" })).toBeVisible();

    // The same account holds both roles: it still has its personal workspace.
    await page.goto("/dashboard/organisations");
    await expect(page.getByRole("link", { name: /Northstar Test/ })).toBeVisible();

    const visitor = await (await page.context().browser()!.newContext()).newPage();
    await visitor.goto(`/org/${slug}`);
    await expect(visitor.getByRole("heading", { level: 1, name: "Northstar Test" })).toBeVisible();
    await expect(visitor.getByText("Atesta review pending").first()).toBeVisible();
    await expect(visitor.getByText("No NEAR issuer yet").first()).toBeVisible();
    await expect(visitor.getByRole("link", { name: /Open Grants Portal/ })).toBeVisible();
    await visitor.getByRole("link", { name: /Open Grants Portal/ }).click();
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Open Grants Portal" }),
    ).toBeVisible();
    await visitor.context().close();
  });

  test("an invited person joins by link with their own account, and their role limits them", async ({
    page,
  }) => {
    const reviewer = await newMember(page);
    const stranger = await newMember(page);

    const owner = newPerson("Olu Owner");
    await register(page, owner);
    await onboard(page, owner);
    const slug = `team-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Team Test", slug);
    const link = await invite(page, slug, reviewer.email, "reviewer");
    expect(link).toMatch(/\/invitations\/[A-Za-z0-9_-]{40,}$/);
    await signOut(page);

    // Someone else holding the link cannot use it.
    await signIn(page, stranger);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(new URL(link).pathname);
    await page.getByRole("button", { name: "Accept and join" }).click();
    await expect(page.getByText(`This invitation was sent to ${reviewer.email}`)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await signIn(page, reviewer);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(new URL(link).pathname);
    await expect(page.getByRole("heading", { level: 1, name: "Team Test" })).toBeVisible();
    await page.getByRole("button", { name: "Accept and join" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard\\?joined=1$`));
    await expect(page.getByText("You joined Team Test as reviewer.")).toBeVisible();

    // A reviewer cannot change settings, add projects or invite people.
    await expect(
      page
        .getByRole("navigation", { name: /Team Test workspace/ })
        .getByRole("link", { name: "Settings" }),
    ).toHaveCount(0);
    await page.goto(`/org/${slug}/settings`);
    await expect(
      page.getByRole("heading", { name: /Your role cannot change the organisation/ }),
    ).toBeVisible();
    await page.goto(`/org/${slug}/projects/new`);
    await expect(
      page.getByRole("heading", { name: /Your role cannot add projects/ }),
    ).toBeVisible();
    await page.goto(`/org/${slug}/team`);
    await expect(page.getByRole("button", { name: "Create invitation" })).toHaveCount(0);

    // The link is single use.
    await page.goto(new URL(link).pathname);
    await expect(
      page.getByRole("heading", { name: "This invitation cannot be used" }),
    ).toBeVisible();
  });

  test("members of one organisation cannot reach another's workspace", async ({ page }) => {
    const ownerB = newPerson("Bea Other");
    await register(page, ownerB);
    await onboard(page, ownerB);
    const slugB = `other-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Other Org", slugB);
    await page.goto(`/org/${slugB}/projects/new`);
    await page.getByRole("textbox", { name: "Project name" }).fill("Private draft project");
    await page.getByRole("combobox", { name: "Status" }).selectOption("draft");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Private draft project" }),
    ).toBeVisible();
    const projectPath = new URL(page.url()).pathname;
    await signOut(page);

    const ownerA = newPerson("Ade Owner");
    await register(page, ownerA);
    await onboard(page, ownerA);
    const slugA = `mine-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "My Org", slugA);

    for (const path of [
      `/org/${slugB}/dashboard`,
      `/org/${slugB}/team`,
      `/org/${slugB}/settings`,
      `/org/${slugB}/projects`,
      projectPath,
      // B's project ID asked for through A's own organisation.
      projectPath.replace(slugB, slugA),
    ]) {
      await page.goto(path);
      await expectNotFound(page);
    }
    // A draft project is not public either.
    const visitor = await (await page.context().browser()!.newContext()).newPage();
    await visitor.goto(`/org/${slugB}`);
    await expect(visitor.getByText("Private draft project")).toBeHidden();
    await visitor.context().close();
  });

  test("the last owner cannot leave or demote themselves", async ({ page }) => {
    const owner = newPerson("Solo Owner");
    await register(page, owner);
    await onboard(page, owner);
    const slug = `solo-${randomUUID().slice(0, 6)}`;
    await createOrganisation(page, "Solo Org", slug);
    await page.goto(`/org/${slug}/team`);
    await page.getByRole("combobox", { name: /Role for/ }).selectOption("remove");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("An organisation must keep at least one owner")).toBeVisible();
  });
});
