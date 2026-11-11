import { expect, test } from "@playwright/test";

import { expectNotFound, newPerson, onboard, register, signIn, signOut } from "./helpers";

test.describe("accounts and profiles", () => {
  test("signed-out visitors are sent to sign in, then returned", async ({ page }) => {
    for (const path of [
      "/dashboard",
      "/dashboard/settings",
      "/dashboard/portfolio",
      "/dashboard/identity",
      "/dashboard/notifications",
      "/onboarding",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    }

    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await signOut(page);

    await signIn(page, person, "/dashboard/identity");
    await expect(page).toHaveURL(/\/dashboard\/identity$/);
  });

  test("a new contributor signs up, onboards without a wallet, and reaches the dashboard", async ({
    page,
  }) => {
    const person = newPerson("Daniel Test");
    await register(page, person);
    await onboard(page, person, "Builds review tools.");

    await expect(page.getByText("Your profile is set up.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Daniel." })).toBeVisible();
    await expect(page.getByText("2 steps left to finish your profile.")).toBeVisible();

    // Onboarding is done once; returning to it goes to the dashboard.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("registration rejects duplicates and short passwords with clear messages", async ({
    page,
  }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await signOut(page);

    await page.goto("/register");
    await page.getByLabel("Your name").fill("Someone Else");
    await page.getByLabel("Email").fill(person.email);
    await page.getByLabel("Password").fill("another-long-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator(".form-message-error")).toContainText(
      "An account with that email already exists",
    );

    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator(".form-message-error")).toContainText("at least 10 characters");

    await signIn(page, { ...person, password: "wrong-password-0000" });
    await expect(page.locator(".form-message-error")).toContainText("do not match an account");
  });

  test("onboarding errors keep what was typed and point at the field", async ({ page }) => {
    const first = newPerson();
    await register(page, first);
    await onboard(page, first);
    await signOut(page);

    const second = newPerson();
    await register(page, second);
    await page.getByLabel("Short bio").fill("Kept after the error.");
    await page.getByLabel("Username").fill(first.username);
    await page.getByRole("button", { name: "Finish setting up" }).click();

    await expect(page.getByText("That username is taken. Choose another.")).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Short bio")).toHaveValue("Kept after the error.");
  });

  test("profile changes persist across reloads and new sessions", async ({ page }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);

    await page.goto("/dashboard/settings");
    await page.getByLabel("Short bio").fill("Designs and builds grant tooling.");
    await page.getByRole("textbox", { name: "Location" }).fill("Lagos");
    await page.getByRole("textbox", { name: /^Skills/ }).fill("TypeScript, React");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Short bio")).toHaveValue("Designs and builds grant tooling.");

    await signOut(page);
    await signIn(page, person);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("textbox", { name: "Location" })).toHaveValue("Lagos");
    await expect(page.getByRole("textbox", { name: /^Skills/ })).toHaveValue("TypeScript, React");
  });

  test("invalid links are refused on the server with a reason", async ({ page }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);

    await page.goto("/dashboard/identity");
    await page.getByLabel("GitHub").fill("https://github.com.evil.example/me");
    await page.getByLabel("NEAR testnet account").fill("not a near account");
    await page.getByRole("button", { name: "Save links" }).click();
    await expect(page.getByText("must be a link on github.com")).toBeVisible();
    await expect(page.getByText("Enter a NEAR testnet account")).toBeVisible();

    await page.getByLabel("GitHub").fill("https://github.com/ada");
    await page.getByLabel("NEAR testnet account").fill("ada.testnet");
    await page.getByRole("button", { name: "Save links" }).click();
    await expect(page.getByText("Links saved.")).toBeVisible();
  });

  test("a profile is private until its owner makes it public", async ({ page, browser }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person, "Visible once public.");

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/u/${person.username}`);
    await expectNotFound(visitorPage);

    await page.goto("/dashboard/settings#privacy");
    await page.getByLabel("Anyone with the link").check();
    await page.getByRole("button", { name: "Save privacy settings" }).click();
    await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();

    const publicResponse = await visitorPage.goto(`/u/${person.username}`);
    expect(publicResponse?.status()).toBe(200);
    await expect(visitorPage.getByRole("heading", { level: 1, name: person.name })).toBeVisible();
    await expect(visitorPage.getByText("Visible once public.")).toBeVisible();
    await expect(visitorPage.getByText(person.email)).toHaveCount(0);

    // Hiding one section removes it from the public page.
    await page.goto("/dashboard/settings#privacy");
    await page.getByLabel("Bio", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Save privacy settings" }).click();
    await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();
    await visitorPage.reload();
    await expect(visitorPage.getByText("Visible once public.")).toHaveCount(0);

    await visitor.close();
  });

  test("data export downloads the person's data without secrets", async ({ page, browser }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);

    const response = await page.request.get("/api/account/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");
    const body = await response.text();
    const data = JSON.parse(body);
    expect(data.account.email).toBe(person.email);
    expect(data.profile.username).toBe(person.username);
    expect(body).not.toContain(person.password);
    expect(body).not.toMatch(/"password"|"token"/);

    const signedOut = await browser.newContext();
    const anonymous = await signedOut.request.get("/api/account/export");
    expect(anonymous.status()).toBe(401);
    await signedOut.close();
  });

  test("closing an account needs the username, then signs out and hides the profile", async ({
    page,
  }) => {
    const person = newPerson();
    await register(page, person);
    await onboard(page, person);
    await page.goto("/dashboard/settings#privacy");
    await page.getByLabel("Anyone with the link").check();
    await page.getByRole("button", { name: "Save privacy settings" }).click();
    await expect(page.getByText("Saved. Your profile is public.")).toBeVisible();

    await page.getByLabel(/Type your username/).fill("wrong-name");
    await page.getByRole("button", { name: "Close my account" }).click();
    await expect(
      page.getByText(`Type your username, ${person.username}, to confirm.`).first(),
    ).toBeVisible();

    await page.getByLabel(/Type your username/).fill(person.username);
    await page.getByRole("button", { name: "Close my account" }).click();
    await expect(page).toHaveURL(/\/\?account=closed$/);

    await page.goto(`/u/${person.username}`);
    await expectNotFound(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
