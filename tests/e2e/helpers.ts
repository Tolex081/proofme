import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export interface TestPerson {
  name: string;
  email: string;
  password: string;
  username: string;
}

/** A fresh, unique test account. Values exist only in the in-memory test database. */
export function newPerson(name = "Ada Test"): TestPerson {
  const id = randomUUID().slice(0, 8);
  return {
    name,
    email: `e2e-${id}@example.test`,
    password: `e2e-pw-${randomUUID()}`,
    username: `ada-${id}`,
  };
}

export async function register(page: Page, person: TestPerson) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(person.name);
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function onboard(page: Page, person: TestPerson, bio = "") {
  await expect(page.getByRole("heading", { name: /Set up your profile/ })).toBeVisible();
  await page.getByLabel("Name on your profile").fill(person.name);
  await page.getByLabel("Username").fill(person.username);
  if (bio) await page.getByLabel("Short bio").fill(bio);
  await page.getByRole("button", { name: "Finish setting up" }).click();
  await expect(page).toHaveURL(/\/dashboard\?welcome=1$/);
}

export async function signIn(page: Page, person: TestPerson, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * With Cache Components, a page that discovers at request time that it does
 * not exist has already started a 200 response; Next.js then renders the
 * not-found page and marks it noindex. That is the documented behaviour.
 */
export async function expectNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: "There is nothing to see here." })).toBeVisible();
  // Next.js may write the tag more than once; one is enough.
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
}
