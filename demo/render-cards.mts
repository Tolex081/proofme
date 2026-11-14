import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.cwd(), "demo");
const output = resolve(root, "assets");
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  for (const card of ["problem", "specificity", "steps", "closing"]) {
    await page.goto(pathToFileURL(resolve(root, "visuals", `${card}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, `${card}.png`) });
  }
} finally {
  await browser.close();
}
