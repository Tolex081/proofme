import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { demoSeed } from "./seed";

const RAW_DIR = resolve(process.cwd(), "demo/raw");
const RAW_VIDEO = resolve(RAW_DIR, "atesta-walkthrough.webm");
const CHECKS_IMAGE = resolve(process.cwd(), "demo/assets/checks-state.png");

test("record the public Atesta credential verification", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(resolve(process.cwd(), "demo/assets"), { recursive: true });

  const video = page.video();
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.waitForTimeout(2500);
  await page.goto(demoSeed.verificationUrl, { waitUntil: "domcontentloaded" });

  const projectTitle = page.getByRole("heading", { name: demoSeed.project });
  await expect(projectTitle).toBeVisible();
  await expect(
    page.getByText("Approved by Northstar Protocol and confirmed on NEAR"),
  ).toBeVisible();
  await page.mouse.move(1210, 165, { steps: 24 });
  await page.waitForTimeout(3500);

  const claimHeading = page.getByRole("heading", {
    name: "What Northstar Protocol approved",
  });
  await claimHeading.scrollIntoViewIfNeeded();
  await page.mouse.move(930, 380, { steps: 24 });
  await page.waitForTimeout(3500);

  const evidenceHeading = page.getByText("Evidence the reviewer was shown", { exact: true });
  await evidenceHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);

  const checksHeading = page.getByRole("heading", { name: "How this was checked" });
  await checksHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);

  const recordCheck = page.getByText("The record hashes to its digest: yes");
  const contractCheck = page.getByText("The contract on NEAR holds the same digest: yes");
  await expect(recordCheck).toBeVisible();
  await expect(contractCheck).toBeVisible();
  await page.mouse.move(530, 300, { steps: 24 });
  await page.waitForTimeout(3500);
  await page.mouse.move(530, 470, { steps: 18 });
  await page.waitForTimeout(3500);

  await page.screenshot({ path: CHECKS_IMAGE, fullPage: false });

  const tokenStatus = page.getByText("active", { exact: true });
  const transaction = page.getByRole("link", { name: "Issuing transaction" });
  await expect(tokenStatus).toBeVisible();
  await expect(transaction).toBeVisible();
  await transaction.scrollIntoViewIfNeeded();
  await page.mouse.move(1290, 650, { steps: 18 });
  await page.waitForTimeout(3500);

  const independentCheck = page.getByRole("heading", { name: "Check it without Atesta" });
  await independentCheck.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);

  await checksHeading.scrollIntoViewIfNeeded();
  await page.mouse.move(1300, 170, { steps: 16 });
  await page.waitForTimeout(3000);

  if (video) {
    await page.close();
    await video.saveAs(RAW_VIDEO);
  }
});
