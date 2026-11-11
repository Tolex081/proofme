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

/**
 * The NEAR steps as far as a browser test can take them. The test server has
 * no contract configured and no wallet, so this covers what everyone sees
 * before a record is on NEAR, the public verification page, and revoking a
 * record that was never minted. Minting itself needs a real wallet signature
 * and is checked by hand on testnet.
 */

async function account(page: Page, name: string): Promise<TestPerson> {
  const person = newPerson(name);
  await register(page, person);
  await onboard(page, person);
  return person;
}

test("an approved record has a public verification page, and revoking shows there", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const contributor = await account(page, "Daniel Contributor");
  await signOut(page);

  const owner = await account(page, "Olu Owner");
  const slug = `near-${randomUUID().slice(0, 6)}`;
  await page.goto("/organisations/new");
  await page.getByRole("textbox", { name: "Organisation name" }).fill("Near Org");
  await page.getByRole("textbox", { name: "Address" }).fill(slug);
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard\\?created=1$`));
  await signOut(page);

  // The contributor sends a public claim.
  await signIn(page, contributor);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/contributions/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Grant portal search");
  await page.getByRole("textbox", { name: /One-line summary/ }).fill("Built the search screen.");
  await page
    .getByRole("textbox", { name: /What you did/ })
    .fill("Designed and built the search screen for the grant portal.");
  await page.getByRole("textbox", { name: /Your role/ }).fill("Frontend engineer");
  await page.getByRole("button", { name: "Add a link" }).click();
  await page.getByLabel("Link 1: address").fill("https://github.com/northstar-demo/portal/pull/7");
  await page.getByLabel("Link 1: description").fill("Pull request #7");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/saved=1$/);
  const contributionPath = new URL(page.url()).pathname;
  await page
    .getByRole("combobox", { name: "Who should confirm it?" })
    .selectOption({ label: "Near Org, no specific project" });
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();
  await signOut(page);

  // The owner approves it.
  await signIn(page, owner);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/org/${slug}/verifications`);
  await page.getByRole("link", { name: /Grant portal search/ }).click();
  await page.getByRole("radio", { name: /^Approve/ }).check();
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Approved\./ })).toBeVisible();

  // Attestations: the issuer account panel, and no minting without a registered issuer.
  await page.goto(`/org/${slug}/attestations`);
  await expect(page.getByRole("heading", { name: "NEAR issuer account" })).toBeVisible();
  await expect(page.getByText("No NEAR account", { exact: true })).toBeVisible();
  await expect(page.getByText(/NEAR is not set up on this site yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect NEAR wallet" })).toBeVisible();
  await expect(page.getByText("Not on NEAR yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue on NEAR" })).toBeHidden();

  // The public page says exactly how far it has got.
  await page.getByRole("link", { name: "Public verification page" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Grant portal search" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Approved by Near Org, not on NEAR yet" }),
  ).toBeVisible();
  await expect(page.getByText(/The record hashes to its digest:\s*yes/)).toBeVisible();
  await expect(page.getByText(/holds the same digest:\s*not on NEAR/)).toBeVisible();
  await expect(page.getByText("Pull request #7", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").getByText(/^[0-9a-f]{64}$/)).toBeVisible();
  const verifyPath = new URL(page.url()).pathname;

  // The owner revokes it, with a reason.
  await page.goto(`/org/${slug}/attestations`);
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await page.getByRole("textbox", { name: "Why is it being revoked?" }).fill("Issued in error.");
  await page.getByRole("button", { name: "Revoke for good" }).click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke" })).toBeHidden();
  await signOut(page);

  // Anyone, signed out, sees that it was revoked.
  await page.goto(verifyPath);
  await expect(page.getByRole("heading", { name: "Revoked by Near Org" })).toBeVisible();
  await page.goto(`/verify/${randomUUID()}`);
  await expectNotFound(page);

  // The contributor is told, with the reason.
  await signIn(page, contributor);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/notifications");
  await expect(page.getByText("Near Org revoked an attestation")).toBeVisible();
  await expect(page.getByText("Issued in error.")).toBeVisible();
  await page.goto(contributionPath);
  await expect(page.getByText("Revoked", { exact: true }).first()).toBeVisible();
});
