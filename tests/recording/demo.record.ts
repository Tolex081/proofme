import { expect, test } from "@playwright/test";

import { Recorder } from "./recorder";

/** Record a short judge demo from the live, already-minted Atesta credential. */

const CREDENTIAL_URL =
  "https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca";
test("record the public credential verification demo", async ({ page }) => {
  const r = new Recorder(page, "demo");
  await r.start(false);

  await r.scene(
    "open",
    async () => {
      await expect(page.getByRole("heading", { name: "VitaRecall" })).toBeVisible();
      await r.point(page.getByRole("heading", { name: "VitaRecall" }));
      await r.pause(1);
    },
    () => page.goto(CREDENTIAL_URL, { waitUntil: "domcontentloaded" }).then(() => undefined),
  );

  await r.scene("checks", async () => {
    const recordCheck = page.getByText("The record hashes to its digest: yes");
    const contractCheck = page.getByText("The contract on NEAR holds the same digest: yes");
    await expect(recordCheck).toBeVisible();
    await expect(contractCheck).toBeVisible();
    await r.point(recordCheck, { x: -65 });
    await r.pause(1);
    await r.point(contractCheck, { x: -65 });
    await r.pause(1);
  });

  await r.scene(
    "chain",
    async () => {
      const txLink = page.getByRole("link", { name: "Issuing transaction" });
      await expect(txLink).toBeVisible();
      await r.point(page.getByText("crewpass-creator.testnet", { exact: true }));
      await r.pause(1);
      // Keep the link readable while leaving the pointer in the right gutter.
      await page.mouse.move(1430, 720, { steps: 16 });
      await r.pause(1);
    },
    async () => {
      await page.goto(CREDENTIAL_URL, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: "Issuing transaction" }).scrollIntoViewIfNeeded();
    },
  );

  await r.scene("close", async () => {
    const contractCheck = page.getByText("The contract on NEAR holds the same digest: yes");
    await r.point(contractCheck, { x: -65 });
    await r.pause(1);
  });

  r.save();
});
