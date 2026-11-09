import { describe, expect, it } from "vitest";

import {
  ANCHOR_STATUSES,
  CONTRIBUTION_EVENT_ACTOR,
  CONTRIBUTION_STATUSES,
  VERIFICATION_REQUEST_STATUSES,
  isAnchoredAndActive,
  isContributionEditable,
  isContributionOrganisationApproved,
  isContributionPubliclyListable,
  isVerificationRequestOpen,
  transitionAnchor,
  transitionAttestation,
  transitionContribution,
  transitionVerificationRequest,
  verificationEventRequiresMessage,
  type AnchorEvent,
  type ContributionEvent,
  type ContributionStatus,
  type VerificationRequestEvent,
} from "@/lib/domain/status";

const CONTRIBUTION_EVENTS = Object.keys(CONTRIBUTION_EVENT_ACTOR) as ContributionEvent[];

// The complete set of allowed moves. Anything not listed here must be refused.
const ALLOWED: [ContributionStatus, ContributionEvent, ContributionStatus][] = [
  ["draft", "publish_self_reported", "self_reported"],
  ["draft", "submit", "pending"],
  ["self_reported", "submit", "pending"],
  ["pending", "withdraw", "self_reported"],
  ["pending", "request_information", "needs_information"],
  ["pending", "approve", "approved_pending_anchor"],
  ["pending", "reject", "rejected"],
  ["needs_information", "respond", "pending"],
  ["needs_information", "withdraw", "self_reported"],
  ["needs_information", "reject", "rejected"],
  ["approved_pending_anchor", "anchor_confirmed", "verified"],
  ["approved_pending_anchor", "revoke", "revoked"],
  ["verified", "revoke", "revoked"],
  ["verified", "supersede", "superseded"],
  ["rejected", "revise", "draft"],
];

describe("contribution lifecycle", () => {
  it.each(ALLOWED)("%s + %s → %s", (from, event, to) => {
    expect(transitionContribution(from, event)).toEqual({ ok: true, status: to });
  });

  it("refuses every move that is not explicitly allowed", () => {
    const allowed = new Set(ALLOWED.map(([from, event]) => `${from}:${event}`));
    let refused = 0;
    for (const from of CONTRIBUTION_STATUSES) {
      for (const event of CONTRIBUTION_EVENTS) {
        if (allowed.has(`${from}:${event}`)) continue;
        const result = transitionContribution(from, event);
        expect(result.ok, `${from} + ${event} should be refused`).toBe(false);
        refused += 1;
      }
    }
    expect(refused).toBe(
      CONTRIBUTION_STATUSES.length * CONTRIBUTION_EVENTS.length - ALLOWED.length,
    );
  });

  it("cannot reach verified without an approval and a confirmed anchor", () => {
    // The only edge into `verified` is anchor_confirmed from approved_pending_anchor,
    // and the only edge into approved_pending_anchor is a reviewer's approve.
    const intoVerified = ALLOWED.filter(([, , to]) => to === "verified");
    expect(intoVerified).toEqual([["approved_pending_anchor", "anchor_confirmed", "verified"]]);
    const intoApproved = ALLOWED.filter(([, , to]) => to === "approved_pending_anchor");
    expect(intoApproved).toEqual([["pending", "approve", "approved_pending_anchor"]]);
  });

  it("never lets the contributor cause approval, anchoring or revocation", () => {
    for (const event of ["approve", "reject", "request_information"] as const) {
      expect(CONTRIBUTION_EVENT_ACTOR[event]).toBe("reviewer");
    }
    expect(CONTRIBUTION_EVENT_ACTOR.anchor_confirmed).toBe("system");
    expect(CONTRIBUTION_EVENT_ACTOR.revoke).toBe("issuer");
    expect(CONTRIBUTION_EVENT_ACTOR.supersede).toBe("issuer");
  });

  it("treats revoked and superseded as final", () => {
    for (const status of ["revoked", "superseded"] as const) {
      for (const event of CONTRIBUTION_EVENTS) {
        expect(transitionContribution(status, event).ok).toBe(false);
      }
    }
  });

  it("allows editing only before review or while information is requested", () => {
    const editable = CONTRIBUTION_STATUSES.filter(isContributionEditable);
    expect(editable).toEqual(["draft", "self_reported", "needs_information"]);
  });

  it("counts only approved_pending_anchor and verified as organisation-approved", () => {
    const approved = CONTRIBUTION_STATUSES.filter(isContributionOrganisationApproved);
    expect(approved).toEqual(["approved_pending_anchor", "verified"]);
  });

  it("keeps drafts, pending, needs-information and rejected claims off public pages", () => {
    const hidden = CONTRIBUTION_STATUSES.filter(
      (status) => !isContributionPubliclyListable(status),
    );
    expect(hidden).toEqual(["draft", "pending", "needs_information", "rejected"]);
  });
});

describe("verification request lifecycle", () => {
  const EVENTS: VerificationRequestEvent[] = [
    "request_information",
    "respond",
    "approve",
    "reject",
    "withdraw",
  ];

  it("follows the review flow", () => {
    expect(transitionVerificationRequest("pending", "request_information")).toEqual({
      ok: true,
      status: "needs_information",
    });
    expect(transitionVerificationRequest("needs_information", "respond")).toEqual({
      ok: true,
      status: "pending",
    });
    expect(transitionVerificationRequest("pending", "approve")).toEqual({
      ok: true,
      status: "approved",
    });
    expect(transitionVerificationRequest("pending", "reject")).toEqual({
      ok: true,
      status: "rejected",
    });
    expect(transitionVerificationRequest("pending", "withdraw")).toEqual({
      ok: true,
      status: "withdrawn",
    });
  });

  it("does not allow approving while information is still outstanding", () => {
    expect(transitionVerificationRequest("needs_information", "approve").ok).toBe(false);
  });

  it("makes every resolved request final, so a second decision cannot apply", () => {
    for (const status of ["approved", "rejected", "withdrawn"] as const) {
      for (const event of EVENTS) {
        expect(transitionVerificationRequest(status, event).ok).toBe(false);
      }
    }
  });

  it("knows which requests are open", () => {
    expect(VERIFICATION_REQUEST_STATUSES.filter(isVerificationRequestOpen)).toEqual([
      "pending",
      "needs_information",
    ]);
  });

  it("requires a written message for rejection, information requests and responses", () => {
    expect(EVENTS.filter(verificationEventRequiresMessage)).toEqual([
      "request_information",
      "respond",
      "reject",
    ]);
  });
});

describe("attestation validity", () => {
  it("can be revoked or superseded once, from active only", () => {
    expect(transitionAttestation("active", "revoke")).toEqual({ ok: true, status: "revoked" });
    expect(transitionAttestation("active", "supersede")).toEqual({
      ok: true,
      status: "superseded",
    });
    for (const status of ["revoked", "superseded"] as const) {
      expect(transitionAttestation(status, "revoke").ok).toBe(false);
      expect(transitionAttestation(status, "supersede").ok).toBe(false);
    }
  });
});

describe("NEAR anchor state", () => {
  const EVENTS: AnchorEvent[] = ["submit", "confirm", "fail"];

  it("moves through submit and confirm", () => {
    expect(transitionAnchor("awaiting", "submit")).toEqual({ ok: true, status: "submitted" });
    expect(transitionAnchor("submitted", "confirm")).toEqual({ ok: true, status: "confirmed" });
    expect(transitionAnchor("submitted", "fail")).toEqual({ ok: true, status: "failed" });
  });

  it("allows retry after failure and reconciliation without a recorded submit", () => {
    expect(transitionAnchor("failed", "submit")).toEqual({ ok: true, status: "submitted" });
    expect(transitionAnchor("failed", "confirm")).toEqual({ ok: true, status: "confirmed" });
    expect(transitionAnchor("awaiting", "confirm")).toEqual({ ok: true, status: "confirmed" });
  });

  it("cannot fail before anything was submitted, and confirmed is final", () => {
    expect(transitionAnchor("awaiting", "fail").ok).toBe(false);
    for (const event of EVENTS) {
      expect(transitionAnchor("confirmed", event).ok).toBe(false);
    }
  });

  it("shows 'anchored and active' only with an active record, a confirmed anchor and a transaction hash", () => {
    expect(
      isAnchoredAndActive({ status: "active", anchorStatus: "confirmed", transactionHash: "9xQ" }),
    ).toBe(true);

    for (const anchorStatus of ANCHOR_STATUSES.filter((status) => status !== "confirmed")) {
      expect(isAnchoredAndActive({ status: "active", anchorStatus, transactionHash: "9xQ" })).toBe(
        false,
      );
    }
    for (const status of ["revoked", "superseded"] as const) {
      expect(
        isAnchoredAndActive({ status, anchorStatus: "confirmed", transactionHash: "9xQ" }),
      ).toBe(false);
    }
    for (const transactionHash of [null, ""]) {
      expect(
        isAnchoredAndActive({ status: "active", anchorStatus: "confirmed", transactionHash }),
      ).toBe(false);
    }
  });
});
