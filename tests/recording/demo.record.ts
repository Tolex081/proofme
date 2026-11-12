import { expect, test } from "@playwright/test";

import { ACCOUNTS, Recorder } from "./recorder";

/** Video A: the 90–150 second product demo. Narration is in narration.ts. */

const TITLE = "Built the proposal scoring dashboard";

test("record the product demo", async ({ page }) => {
  const r = new Recorder(page, "demo");
  await r.start();
  let contributionPath = "";
  let attestationPath = "";

  await r.scene(
    "problem",
    async () => {
      await r.pause(2.5);
      await r.point(page.getByRole("link", { name: "Check a sample record" }));
    },
    () => page.goto("/").then(() => undefined),
  );

  await r.scene(
    "profile",
    async () => {
      await r.pause(2);
      await r.point(page.getByRole("heading", { name: "Verified contributions" }));
      await r.scroll(350);
      await r.point(page.getByRole("link", { name: /Check the record/ }).first());
      await r.pause(1.5);
      await r.scroll(250);
    },
    () => page.goto("/u/daniel-okafor").then(() => undefined),
  );

  await r.scene(
    "claim",
    async () => {
      await r.type(page.getByRole("textbox", { name: "Title", exact: true }), TITLE);
      await r.type(
        page.getByRole("textbox", { name: /One-line summary/ }),
        "Scores, comments and status for every proposal in one view.",
        14,
      );
      await page
        .getByRole("textbox", { name: /What you did/ })
        .fill(
          "Designed and built the dashboard reviewers use to compare proposal scores. Demo record.",
        );
      await r.type(page.getByRole("textbox", { name: /Your role/ }), "Frontend engineer", 14);
      await r.click(page.getByRole("button", { name: "Add a link" }));
      await r.type(
        page.getByLabel("Link 1: address"),
        "https://example.org/northstar-demo/portal/pull/57",
        10,
      );
      await r.type(page.getByLabel("Link 1: description"), "Demo pull request #57", 14);
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
  });

  await r.scene(
    "queue",
    async () => {
      await r.pause(1);
      await r.click(page.getByRole("link", { name: new RegExp(TITLE) }));
      await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
      await r.pause(1);
      await r.scroll(500);
    },
    async () => {
      await r.signIn(ACCOUNTS.priya);
      await page.goto("/org/northstar-protocol/verifications");
    },
  );

  await r.scene("approve", async () => {
    await r.point(page.getByRole("radio", { name: /Approve/ }));
    await r.type(
      page.getByRole("textbox", { name: /Message to the contributor/ }),
      "Thanks, Daniel. Checked against the demo pull request.",
      14,
    );
    await r.click(page.getByRole("button", { name: "Record decision" }));
    await expect(page.getByRole("status").first()).toBeVisible();
  });

  await r.scene(
    "verify",
    async () => {
      await r.pause(2.5);
      await r.scroll(400);
      await r.pause(1.5);
      await r.scroll(400);
    },
    async () => {
      // The contributor's own page links to the new public record.
      await r.signIn(ACCOUNTS.daniel);
      await page.goto(contributionPath);
      const link = page.getByRole("link", { name: "Public verification page" }).first();
      attestationPath = (await link.getAttribute("href")) ?? "";
      expect(attestationPath).toMatch(/^\/verify\//);
      await page.context().clearCookies();
      await page.goto(attestationPath);
    },
  );

  await r.scene(
    "close",
    async () => {
      await r.pause(1);
      await r.point(page.getByText(TITLE).first());
    },
    () => page.goto("/u/daniel-okafor").then(() => undefined),
  );

  r.save();
});
