import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";

import { scenesFor, type VideoName } from "./narration";

/**
 * Helpers for recording the submission videos from the real running app.
 *
 * Playwright records the page; this adds a visible pointer (headless
 * recordings have none), paced typing, and scene timing. Each scene lasts at
 * least as long as its narration, which `npm run video:narrate` measured
 * first. The timeline written at the end tells the assembler where each scene
 * starts and ends in the raw recording; time between scenes (signing in,
 * page loads) is cut out.
 */

export const WITH_NEAR = process.env.WITH_NEAR === "1";
export const BUILD = "submission/build";

/** Fictional demo accounts from `npm run db:seed`. Local, test-only password. */
export const PASSWORD = "recording-only-password-0000";
export const ACCOUNTS = {
  daniel: "daniel.okafor@demo.proofme.test",
  sam: "sam.adeyemi@demo.proofme.test",
  priya: "priya.raman@demo.proofme.test",
  admin: "admin@demo.proofme.test",
} as const;

/** Seconds of silence before the first sentence and after the last, per scene. */
const LEAD = 0.5;
const TAIL = 0.8;
const GAP = 0.35;

const CURSOR = `
(() => {
  if (window.__cursor) return;
  window.__cursor = true;
  const draw = () => {
    const el = document.createElement("div");
    el.id = "__recording-cursor";
    el.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.5-7.5L4 19z" fill="#1b1a2e" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(el.style, {
      position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none",
      transform: "translate(-3px,-2px)", transition: "none",
    });
    const saved = JSON.parse(sessionStorage.getItem("__cursor") || "[768,432]");
    el.style.left = saved[0] + "px";
    el.style.top = saved[1] + "px";
    document.documentElement.appendChild(el);
    addEventListener("mousemove", (e) => {
      el.style.left = e.clientX + "px";
      el.style.top = e.clientY + "px";
      sessionStorage.setItem("__cursor", JSON.stringify([e.clientX, e.clientY]));
    }, { passive: true });
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", draw);
  else draw();
})();
`;

interface Mark {
  id: string;
  start: number;
  end: number;
}

export class Recorder {
  private t0 = 0;
  private marks: Mark[] = [];
  private durations: Record<string, number[]>;
  private x = 768;
  private y = 432;

  constructor(
    readonly page: Page,
    readonly video: VideoName,
  ) {
    const file = `${BUILD}/${video}/narration.json`;
    this.durations = JSON.parse(readFileSync(file, "utf8")).durations;
  }

  async start() {
    // A failed run must never leave an old timeline for the assembler to use.
    rmSync(`${BUILD}/${this.video}/timeline.json`, { force: true });
    // Warm the server so the first recorded page load is not a cold start.
    await this.page.request.get("/", { timeout: 120_000 });
    this.t0 = Date.now();
    await this.page.addInitScript(CURSOR);
  }

  private now() {
    return (Date.now() - this.t0) / 1000;
  }

  /** How long a scene must last for its narration to be spoken in full. */
  sceneLength(id: string) {
    const sentences = this.durations[id];
    if (!sentences) throw new Error(`No narration measured for scene "${id}". Run video:narrate.`);
    return LEAD + sentences.reduce((sum, d) => sum + d, 0) + GAP * (sentences.length - 1) + TAIL;
  }

  /**
   * Runs one scene. Anything before it (signing in, opening a page) is cut
   * from the final video. The scene lasts at least as long as its narration.
   */
  async scene(id: string, run: () => Promise<void>, before?: () => Promise<void>) {
    const wanted = scenesFor(this.video, WITH_NEAR).some((scene) => scene.id === id);
    if (!wanted) return;
    if (before) await before();
    await this.settle();
    const start = this.now();
    await run();
    await this.settle();
    const left = start + this.sceneLength(id) - this.now();
    if (left > 0) await this.page.waitForTimeout(left * 1000);
    this.marks.push({ id, start, end: this.now() });
  }

  async settle() {
    await this.page.waitForLoadState("networkidle").catch(() => {});
    await this.page.evaluate(CURSOR).catch(() => {});
  }

  /** Moves the visible pointer smoothly to the middle of `target`. */
  async point(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + Math.min(box.height / 2, 22);
    const steps = Math.max(8, Math.round(Math.hypot(x - this.x, y - this.y) / 25));
    await this.page.mouse.move(x, y, { steps });
    this.x = x;
    this.y = y;
    await this.page.waitForTimeout(180);
  }

  async click(target: Locator) {
    await this.point(target);
    await target.click();
  }

  async type(target: Locator, text: string, delay = 22) {
    await this.click(target);
    // Some fields arrive prefilled (onboarding copies the sign-up name).
    await target.fill("");
    await target.pressSequentially(text, { delay });
  }

  async pause(seconds: number) {
    await this.page.waitForTimeout(seconds * 1000);
  }

  /** Scrolls the page gently by `pixels`. */
  async scroll(pixels: number, seconds = 1.2) {
    const steps = Math.max(1, Math.round(seconds * 30));
    for (let i = 0; i < steps; i += 1) {
      await this.page.mouse.wheel(0, pixels / steps);
      await this.page.waitForTimeout(1000 / 30);
    }
  }

  async signIn(email: string) {
    await this.page.context().clearCookies();
    await this.page.goto("/login");
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(PASSWORD);
    await this.page.getByRole("button", { name: "Sign in" }).click();
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  save() {
    mkdirSync(`${BUILD}/${this.video}`, { recursive: true });
    writeFileSync(
      `${BUILD}/${this.video}/timeline.json`,
      JSON.stringify({ withNear: WITH_NEAR, scenes: this.marks }, null, 2),
    );
  }
}
