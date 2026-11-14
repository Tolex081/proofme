import { BadgeCheck, Ban, Clock, KeyRound, ShieldOff, X } from "lucide-react";

import type { Organisation } from "@/server/services/organisations";

/**
 * Platform review and NEAR issuer registration are separate facts, so they
 * get separate badges. Neither is ever implied by the other.
 */
const PLATFORM: Record<
  Organisation["platformVerificationStatus"],
  { label: string; tone: string; icon: typeof BadgeCheck; meaning: string }
> = {
  unverified: {
    label: "Not reviewed by Atesta",
    tone: "chip-neutral",
    icon: ShieldOff,
    meaning: "Atesta has not checked who runs this organisation.",
  },
  pending: {
    label: "Atesta review pending",
    tone: "chip-wait",
    icon: Clock,
    meaning: "The organisation has asked Atesta to review it. No decision yet.",
  },
  verified: {
    label: "Reviewed by Atesta",
    tone: "chip-ok",
    icon: BadgeCheck,
    meaning: "A Atesta administrator reviewed who runs this organisation.",
  },
  rejected: {
    label: "Atesta review declined",
    tone: "chip-bad",
    icon: X,
    meaning: "A Atesta administrator reviewed this organisation and declined it.",
  },
  suspended: {
    label: "Suspended",
    tone: "chip-bad",
    icon: Ban,
    meaning: "Atesta has suspended this organisation.",
  },
};

export function PlatformBadge({ status }: { status: Organisation["platformVerificationStatus"] }) {
  const info = PLATFORM[status];
  return (
    <span className={`chip ${info.tone}`} title={info.meaning}>
      <info.icon aria-hidden="true" size={13} strokeWidth={2.5} />
      {info.label}
    </span>
  );
}

export function platformMeaning(status: Organisation["platformVerificationStatus"]) {
  return PLATFORM[status].meaning;
}

export function IssuerBadge({ status }: { status: Organisation["nearIssuerStatus"] }) {
  if (status === "registered") {
    return (
      <span className="chip chip-ok">
        <KeyRound aria-hidden="true" size={13} strokeWidth={2.5} />
        NEAR issuer registered
      </span>
    );
  }
  return (
    <span className="chip chip-neutral">
      <KeyRound aria-hidden="true" size={13} strokeWidth={2.5} />
      {status === "suspended" ? "NEAR issuer suspended" : "No NEAR issuer yet"}
    </span>
  );
}
