import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { newPerson, onboard, register } from "./helpers";

/**
 * The NEAR wallet picker loads its wallet list and each wallet's code from
 * the internet and runs them in a sandboxed frame that inherits the site's
 * Content Security Policy. This checks the policy does not break it.
 *
 * Needs internet access, so it is skipped unless PROOFME_NETWORK_TESTS=1.
 * It opens the picker only: nothing is connected or signed.
 */
test.skip(process.env.PROOFME_NETWORK_TESTS !== "1", "needs internet access");

test("the wallet picker opens under the Content Security Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });

  const owner = newPerson("Wally Wallet");
  await register(page, owner);
  await onboard(page, owner);
  const slug = `wallet-${randomUUID().slice(0, 6)}`;
  await page.goto("/organisations/new");
  await page.getByRole("textbox", { name: "Organisation name" }).fill("Wallet Check Org");
  await page.getByRole("textbox", { name: "Address" }).fill(slug);
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(new RegExp(`/org/${slug}/dashboard`));

  await page.goto(`/org/${slug}/attestations`);
  await page.getByRole("button", { name: "Connect NEAR wallet" }).click();
  // The picker lists wallets from the remote manifest.
  await expect(page.getByText(/Meteor/i).first()).toBeVisible({ timeout: 30_000 });
  await page
    .getByText(/Meteor/i)
    .first()
    .click();
  // Selecting a wallet loads its code into the sandboxed frame.
  await page.waitForTimeout(5_000);
  expect(violations).toEqual([]);
});
