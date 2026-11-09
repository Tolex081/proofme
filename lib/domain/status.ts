/**
 * Lifecycle rules. Pure functions with no I/O: services call these inside a
 * database transaction and refuse the write when a transition is not allowed.
 *
 * Three separate state machines, kept separate on purpose:
 *   - the contribution (what the contributor and public see),
 *   - the attestation's validity (active, revoked, superseded),
 *   - the NEAR anchor (whether a confirmed transaction exists).
 * "Organisation approved" and "anchored on NEAR" are different facts.
 */

// ── Contribution ─────────────────────────────────────────────────────────────

export const CONTRIBUTION_STATUSES = [
  "draft",
  "self_reported",
  "pending",
  "needs_information",
  "approved_pending_anchor",
  "verified",
  "rejected",
  "revoked",
  "superseded",
] as const;

export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export type ContributionEvent =
  | "publish_self_reported"
  | "submit"
  | "withdraw"
  | "request_information"
  | "respond"
  | "approve"
  | "reject"
  | "revise"
  | "anchor_confirmed"
  | "revoke"
  | "supersede";

/** Who is allowed to cause an event. Services check the actor separately. */
export type ActorKind = "contributor" | "reviewer" | "issuer" | "system";

export const CONTRIBUTION_EVENT_ACTOR: Record<ContributionEvent, ActorKind> = {
  publish_self_reported: "contributor",
  submit: "contributor",
  withdraw: "contributor",
  respond: "contributor",
  revise: "contributor",
  request_information: "reviewer",
  approve: "reviewer",
  reject: "reviewer",
  // Recorded by the server only after it has confirmed the transaction on NEAR.
  anchor_confirmed: "system",
  revoke: "issuer",
  supersede: "issuer",
};

const CONTRIBUTION_TRANSITIONS: Record<
  ContributionStatus,
  Partial<Record<ContributionEvent, ContributionStatus>>
> = {
  draft: { publish_self_reported: "self_reported", submit: "pending" },
  self_reported: { submit: "pending" },
  pending: {
    withdraw: "self_reported",
    request_information: "needs_information",
    approve: "approved_pending_anchor",
    reject: "rejected",
  },
  needs_information: {
    respond: "pending",
    withdraw: "self_reported",
    reject: "rejected",
  },
  approved_pending_anchor: { anchor_confirmed: "verified", revoke: "revoked" },
  verified: { revoke: "revoked", supersede: "superseded" },
  // A rejected claim can be reworked and submitted again as a new request.
  rejected: { revise: "draft" },
  revoked: {},
  superseded: {},
};

export type TransitionResult<S> = { ok: true; status: S } | { ok: false; reason: string };

export function transitionContribution(
  current: ContributionStatus,
  event: ContributionEvent,
): TransitionResult<ContributionStatus> {
  const next = CONTRIBUTION_TRANSITIONS[current][event];
  if (next === undefined) {
    return { ok: false, reason: `A ${current} contribution cannot ${event}.` };
  }
  return { ok: true, status: next };
}

/** The contributor may change the claim text and evidence only in these states. */
export function isContributionEditable(status: ContributionStatus): boolean {
  return status === "draft" || status === "self_reported" || status === "needs_information";
}

/** True only when an organisation's approval currently stands. */
export function isContributionOrganisationApproved(status: ContributionStatus): boolean {
  return status === "approved_pending_anchor" || status === "verified";
}

/**
 * Statuses that may appear on a public profile at all (subject also to the
 * contribution's own visibility setting and the profile's visibility).
 * Drafts, pending, needs-information and rejected claims are always private.
 */
export function isContributionPubliclyListable(status: ContributionStatus): boolean {
  return (
    status === "self_reported" ||
    status === "approved_pending_anchor" ||
    status === "verified" ||
    status === "revoked" ||
    status === "superseded"
  );
}

// ── Verification request ─────────────────────────────────────────────────────

export const VERIFICATION_REQUEST_STATUSES = [
  "pending",
  "needs_information",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type VerificationRequestStatus = (typeof VERIFICATION_REQUEST_STATUSES)[number];

export type VerificationRequestEvent =
  "request_information" | "respond" | "approve" | "reject" | "withdraw";

const VERIFICATION_REQUEST_TRANSITIONS: Record<
  VerificationRequestStatus,
  Partial<Record<VerificationRequestEvent, VerificationRequestStatus>>
> = {
  pending: {
    request_information: "needs_information",
    approve: "approved",
    reject: "rejected",
    withdraw: "withdrawn",
  },
  needs_information: { respond: "pending", reject: "rejected", withdraw: "withdrawn" },
  approved: {},
  rejected: {},
  withdrawn: {},
};

export function transitionVerificationRequest(
  current: VerificationRequestStatus,
  event: VerificationRequestEvent,
): TransitionResult<VerificationRequestStatus> {
  const next = VERIFICATION_REQUEST_TRANSITIONS[current][event];
  if (next === undefined) {
    return { ok: false, reason: `A ${current} request cannot ${event}.` };
  }
  return { ok: true, status: next };
}

export function isVerificationRequestOpen(status: VerificationRequestStatus): boolean {
  return status === "pending" || status === "needs_information";
}

/** Events that must carry a written explanation from the person causing them. */
export function verificationEventRequiresMessage(event: VerificationRequestEvent): boolean {
  return event === "reject" || event === "request_information" || event === "respond";
}

// ── Attestation validity ─────────────────────────────────────────────────────

export const ATTESTATION_STATUSES = ["active", "revoked", "superseded"] as const;
export type AttestationStatus = (typeof ATTESTATION_STATUSES)[number];
export type AttestationEvent = "revoke" | "supersede";

export function transitionAttestation(
  current: AttestationStatus,
  event: AttestationEvent,
): TransitionResult<AttestationStatus> {
  if (current !== "active") {
    return { ok: false, reason: `A ${current} attestation cannot ${event}.` };
  }
  return { ok: true, status: event === "revoke" ? "revoked" : "superseded" };
}

// ── NEAR anchor ──────────────────────────────────────────────────────────────

export const ANCHOR_STATUSES = ["awaiting", "submitted", "confirmed", "failed"] as const;
export type AnchorStatus = (typeof ANCHOR_STATUSES)[number];
export type AnchorEvent = "submit" | "confirm" | "fail";

const ANCHOR_TRANSITIONS: Record<AnchorStatus, Partial<Record<AnchorEvent, AnchorStatus>>> = {
  // `confirm` from awaiting covers reconciliation: the chain already holds the
  // record but the server never learned the transaction was sent.
  awaiting: { submit: "submitted", confirm: "confirmed" },
  submitted: { confirm: "confirmed", fail: "failed" },
  // A failed attempt can be retried; reconciliation may also find it succeeded.
  failed: { submit: "submitted", confirm: "confirmed" },
  confirmed: {},
};

export function transitionAnchor(
  current: AnchorStatus,
  event: AnchorEvent,
): TransitionResult<AnchorStatus> {
  const next = ANCHOR_TRANSITIONS[current][event];
  if (next === undefined) {
    return { ok: false, reason: `A ${current} anchor cannot ${event}.` };
  }
  return { ok: true, status: next };
}

/**
 * The single rule for showing an attestation as valid and anchored on NEAR.
 * Nothing else in the application may decide this.
 */
export function isAnchoredAndActive(attestation: {
  status: AttestationStatus;
  anchorStatus: AnchorStatus;
  transactionHash: string | null;
}): boolean {
  return (
    attestation.status === "active" &&
    attestation.anchorStatus === "confirmed" &&
    attestation.transactionHash !== null &&
    attestation.transactionHash.length > 0
  );
}
