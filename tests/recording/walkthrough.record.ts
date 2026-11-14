import { expect, test } from "@playwright/test";

import { ACCOUNTS, PASSWORD, Recorder } from "./recorder";

/** Video B: the 5–8 minute walkthrough. Narration is in narration.ts. */

const TITLE = "Added keyboard shortcuts to the review screen";
const OLD_TITLE = "Implemented the proposal review interface";

test("record the full walkthrough", async ({ page }) => {
  const r = new Recorder(page, "walkthrough");
  await r.start();
  let contributionPath = "";

  await r.scene(
    "overview",
    async () => {
      await r.pause(3);
      await r.click(page.getByRole("link", { name: "How it works" }).first());
      await r.pause(2);
      await r.scroll(500, 2);
      await r.pause(2);
      await r.scroll(500, 2);
    },
    () => page.goto("/").then(() => undefined),
  );

  await r.scene(
    "register",
    async () => {
      await r.type(page.getByLabel("Your name"), "Grace Mensah", 30);
      await r.type(page.getByLabel("Email"), "grace.mensah@demo.proofme.test", 18);
      await r.type(page.getByLabel("Password"), PASSWORD, 10);
      await r.click(page.getByRole("button", { name: "Create account" }));
      await expect(page).toHaveURL(/\/onboarding$/);
      await r.type(page.getByLabel("Name on your profile"), "Grace Mensah", 20);
      await r.type(page.getByLabel("Username"), "grace-mensah", 20);
      await r.type(page.getByLabel("Short bio"), "Sample account for the Atesta demo.", 14);
      await r.click(page.getByRole("button", { name: "Finish setting up" }));
      await expect(page).toHaveURL(/\/dashboard\?welcome=1$/);
      await page.goto("/dashboard/settings#privacy");
      await r.settle();
      await r.point(page.getByLabel("Anyone with the link"));
      await r.pause(1.5);
    },
    () => page.goto("/register").then(() => undefined),
  );

  await r.scene(
    "profile",
    async () => {
      await r.pause(2);
      await r.point(page.getByRole("heading", { name: "Verified contributions" }));
      await r.scroll(400, 1.5);
      await r.pause(1.5);
      await r.scroll(500, 1.5);
    },
    async () => {
      await page.context().clearCookies();
      await page.goto("/u/daniel-okafor");
    },
  );

  await r.scene(
    "claim",
    async () => {
      await r.type(page.getByRole("textbox", { name: "Title", exact: true }), TITLE);
      await r.type(
        page.getByRole("textbox", { name: /One-line summary/ }),
        "Reviewers can score and move between proposals without a mouse.",
        14,
      );
      await page
        .getByRole("textbox", { name: /What you did/ })
        .fill(
          "Added keyboard shortcuts and visible focus to the proposal review screen, with a help panel listing them. Demo record.",
        );
      await r.type(page.getByRole("textbox", { name: /Your role/ }), "Frontend engineer", 14);
      await r.scroll(400);
      await r.click(page.getByRole("button", { name: "Add a link" }));
      await r.type(
        page.getByLabel("Link 1: address"),
        "https://example.org/northstar-demo/portal/pull/63",
        10,
      );
      await r.type(page.getByLabel("Link 1: description"), "Demo pull request #63", 14);
      await r.click(page.getByRole("button", { name: "Save draft" }));
      await expect(page).toHaveURL(/saved=1$/);
      contributionPath = new URL(page.url()).pathname;
    },
    async () => {
      await r.signIn(ACCOUNTS.daniel);
      await page.goto("/dashboard/contributions/new");
    },
  );

  await r.scene("send", async () => {
    const target = page.getByRole("combobox", { name: "Who should confirm it?" });
    await r.point(target);
    await target.selectOption({ label: "Northstar Protocol, Open Grants Portal" });
    await r.click(page.getByRole("button", { name: "Send for review" }));
    await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();
    await r.pause(1);
  });

  await r.scene(
    "org",
    async () => {
      await r.pause(2.5);
      await r.click(page.getByRole("link", { name: "Projects" }).first());
      await r.pause(3);
      await r.click(page.getByRole("link", { name: "Team" }).first());
      await r.pause(3);
      await r.scroll(500, 2);
      await r.pause(2);
      await page.goto("/org/northstar-protocol");
      await r.settle();
      await r.scroll(350, 1.5);
    },
    async () => {
      await r.signIn(ACCOUNTS.sam);
      await page.goto("/org/northstar-protocol/dashboard");
    },
  );

  await r.scene(
    "queue",
    async () => {
      await r.pause(1.5);
      await r.click(page.getByRole("link", { name: new RegExp(TITLE) }));
      await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
      await r.pause(1.5);
      await r.scroll(450, 2);
      await r.pause(1);
      await r.point(page.getByRole("radio", { name: /Ask for more/ }));
      await r.point(page.getByRole("radio", { name: /Do not approve/ }));
      await r.point(page.getByRole("textbox", { name: /Internal note/ }));
    },
    async () => {
      await r.signIn(ACCOUNTS.priya);
      await page.goto("/org/northstar-protocol/verifications");
    },
  );

  await r.scene("approve", async () => {
    await r.click(page.getByRole("radio", { name: /Approve/ }));
    await r.type(
      page.getByRole("textbox", { name: /Message to the contributor/ }),
      "Thanks, Daniel. Checked the shortcuts in the demo pull request.",
      14,
    );
    await r.click(page.getByRole("button", { name: "Record decision" }));
    await expect(page.getByRole("status").first()).toBeVisible();
    await r.pause(1.5);
  });

  await r.scene(
    "issuer",
    async () => {
      await r.pause(2);
      await r.point(page.getByRole("button", { name: "Connect NEAR wallet" }));
      await r.pause(3);
      await r.scroll(450, 2);
      await r.point(page.getByText(TITLE).first());
    },
    async () => {
      await r.signIn(ACCOUNTS.sam);
      await page.goto("/org/northstar-protocol/attestations");
    },
  );

  await r.scene(
    "verify",
    async () => {
      await r.pause(3);
      await r.scroll(450, 2);
      await r.pause(2);
      await r.scroll(450, 2);
      await r.pause(2);
      await r.scroll(450, 2);
    },
    async () => {
      await r.signIn(ACCOUNTS.daniel);
      await page.goto(contributionPath);
      const link = page.getByRole("link", { name: "Public verification page" }).first();
      const href = (await link.getAttribute("href")) ?? "";
      expect(href).toMatch(/^\/verify\//);
      await page.context().clearCookies();
      await page.goto(href);
    },
  );

  let oldRecord = "";
  await r.scene(
    "revoke",
    async () => {
      const row = page.getByRole("listitem").filter({ hasText: OLD_TITLE });
      oldRecord =
        (await row.getByRole("link", { name: "Public verification page" }).getAttribute("href")) ??
        "";
      await r.click(row.getByRole("button", { name: "Revoke" }));
      await r.type(
        row.getByRole("textbox", { name: "Why is it being revoked?" }),
        "Demo: replaced by a more precise record of the same work.",
        14,
      );
      await r.click(row.getByRole("button", { name: "Revoke for good" }));
      await expect(row.getByText("Revoked", { exact: true })).toBeVisible();
      await r.pause(1);
      await page.goto(oldRecord);
      await r.settle();
      await r.pause(3);
    },
    async () => {
      await r.signIn(ACCOUNTS.sam);
      await page.goto("/org/northstar-protocol/attestations");
    },
  );

  await r.scene(
    "admin",
    async () => {
      await r.pause(2);
      await r.click(page.getByRole("link", { name: "Organisations" }).first());
      await r.pause(1.5);
      await r.click(page.getByRole("link", { name: /Northstar Protocol/ }).first());
      await r.pause(2);
      await r.scroll(500, 2);
      await page.goto("/admin/audit");
      await r.settle();
      await r.pause(3);
    },
    async () => {
      await r.signIn(ACCOUNTS.admin);
      await page.goto("/admin");
    },
  );

  await r.scene(
    "limits",
    async () => {
      await r.pause(2);
      await r.type(page.getByRole("searchbox", { name: "Name or username" }), "Okafor", 40);
      await page.keyboard.press("Enter");
      await r.settle();
      await r.pause(2.5);
      await page.goto("/privacy");
      await r.settle();
      await r.pause(2);
      await r.scroll(500, 2);
    },
    async () => {
      await page.context().clearCookies();
      await page.goto("/explore");
    },
  );

  await r.scene(
    "future",
    async () => {
      await r.pause(3);
      await r.point(page.getByRole("link", { name: "Start your record" }).first());
    },
    () => page.goto("/").then(() => undefined),
  );

  r.save();
});
