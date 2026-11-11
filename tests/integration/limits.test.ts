import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { LIMITS, withinLimit } from "@/server/services/limits";
import { createOrganisation } from "@/server/services/organisations";
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
  const id = `user_${randomUUID()}`;
  await db.insert(s.users).values({ id, name: "Limited", email: `${id}@example.test` });
  return id;
}

const organisationInput = () => ({
  name: `Limited Org ${randomUUID().slice(0, 6)}`,
  slug: `limited-${randomUUID().slice(0, 8)}`,
  category: "dao",
  description: "",
  websiteUrl: "",
});

describe("per-person action limits", () => {
  it("stops the sixth organisation in a day, for that person only", async () => {
    const busy = await person();
    for (let i = 0; i < LIMITS.organisation.max; i += 1) {
      expect((await createOrganisation(db, busy, organisationInput())).ok).toBe(true);
    }
    const refused = await createOrganisation(db, busy, organisationInput());
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors.form).toMatch(/try again/);

    const other = await person();
    expect((await createOrganisation(db, other, organisationInput())).ok).toBe(true);
  });

  it("forgets events older than the window", async () => {
    const user = await person();
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await db.insert(s.auditEvents).values(
      Array.from({ length: LIMITS.organisation.max }, () => ({
        actorUserId: user,
        action: "organisation.created",
        entityType: "organisation",
        entityId: randomUUID(),
        createdAt: old,
      })),
    );
    expect(await withinLimit(db, user, "organisation")).toBe(true);
  });
});
