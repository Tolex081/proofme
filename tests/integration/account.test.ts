import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import {
  countUnreadNotifications,
  exportAccountData,
  listNotifications,
  markAllNotificationsRead,
  notify,
  requestAccountDeletion,
} from "@/server/services/account";
import { completeOnboarding, updatePrivacy } from "@/server/services/profile";
import { createTestDatabase } from "./database";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDatabase();
  db = created.db as unknown as Database;
  close = created.close;
});

afterAll(async () => {
  await close();
});

async function person() {
  const userId = `user_${randomUUID()}`;
  const username = `p-${randomUUID().slice(0, 8)}`;
  await db.insert(s.users).values({ id: userId, name: "Person", email: `${userId}@example.test` });
  await db.insert(s.accounts).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: "salted-hash-value",
  });
  await db.insert(s.sessions).values({
    id: randomUUID(),
    userId,
    token: `token-${randomUUID()}`,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const result = await completeOnboarding(db, userId, {
    intent: "contributor",
    displayName: "Person",
    username,
    bio: "",
    roles: [],
  });
  if (!result.ok) throw new Error("onboarding failed");
  return { userId, username };
}

describe("data export", () => {
  it("includes the person's own data and no secrets", async () => {
    const { userId, username } = await person();
    const other = await person();
    await notify(db, { userId, type: "welcome", title: "Welcome" });
    await notify(db, { userId: other.userId, type: "welcome", title: "Someone else's" });

    const data = await exportAccountData(db, userId);
    expect(data?.format).toBe("proofme.account-export.v1");
    expect(data?.account.id).toBe(userId);
    expect(data?.profile?.username).toBe(username);
    expect(data?.notifications.map((n) => n.title)).toEqual(["Welcome"]);

    const text = JSON.stringify(data);
    expect(text).not.toContain("salted-hash-value");
    expect(text).not.toContain("token-");
    expect(text).not.toContain(other.userId);
  });

  it("returns nothing for an unknown account", async () => {
    expect(await exportAccountData(db, "no-such-user")).toBeNull();
  });
});

describe("deletion request", () => {
  it("requires the username, then deactivates the account, hides the profile and ends sessions", async () => {
    const { userId, username } = await person();
    await updatePrivacy(db, userId, {
      visibility: "public",
      sections: { bio: true, location: true, links: true, skills: true, nearAccount: true },
    });

    expect(await requestAccountDeletion(db, userId, "wrong-name")).toEqual({
      ok: false,
      error: `Type your username, ${username}, to confirm.`,
    });
    expect(await requestAccountDeletion(db, userId, undefined)).toMatchObject({ ok: false });

    expect(await requestAccountDeletion(db, userId, `  ${username.toUpperCase()} `)).toEqual({
      ok: true,
    });

    const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
    expect(user.status).toBe("deletion_requested");
    const [profile] = await db
      .select()
      .from(s.userProfiles)
      .where(eq(s.userProfiles.userId, userId));
    expect(profile.visibility).toBe("private");
    expect(await db.select().from(s.sessions).where(eq(s.sessions.userId, userId))).toHaveLength(0);
    const events = await db.select().from(s.auditEvents).where(eq(s.auditEvents.entityId, userId));
    expect(events.map((e) => e.action)).toContain("account.deletion_requested");
  });

  it("leaves other people's accounts untouched", async () => {
    const first = await person();
    const second = await person();
    await requestAccountDeletion(db, first.userId, first.username);
    const [other] = await db.select().from(s.users).where(eq(s.users.id, second.userId));
    expect(other.status).toBe("active");
    expect(
      await db.select().from(s.sessions).where(eq(s.sessions.userId, second.userId)),
    ).toHaveLength(1);
  });
});

describe("notifications", () => {
  it("lists newest first, counts unread, and marks only the owner's as read", async () => {
    const { userId } = await person();
    const other = await person();
    await notify(db, { userId, type: "a", title: "First", href: "/dashboard" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await notify(db, { userId, type: "b", title: "Second" });
    await notify(db, { userId: other.userId, type: "c", title: "Not yours" });

    expect((await listNotifications(db, userId)).map((n) => n.title)).toEqual(["Second", "First"]);
    expect(await countUnreadNotifications(db, userId)).toBe(2);

    expect(await markAllNotificationsRead(db, userId)).toBe(2);
    expect(await countUnreadNotifications(db, userId)).toBe(0);
    expect(await countUnreadNotifications(db, other.userId)).toBe(1);
    expect(await markAllNotificationsRead(db, userId)).toBe(0);
  });

  it("refuses links to other websites", async () => {
    const { userId } = await person();
    await expect(
      notify(db, { userId, type: "x", title: "Bad", href: "https://evil.example" }),
    ).rejects.toThrow(/same-site/);
    await expect(
      notify(db, { userId, type: "x", title: "Bad", href: "//evil.example" }),
    ).rejects.toThrow(/same-site/);
  });
});
