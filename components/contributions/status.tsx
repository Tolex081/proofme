import {
  Ban,
  CircleDashed,
  Clock,
  FilePen,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import type { ContributionStatus } from "@/lib/domain/status";

interface StatusInfo {
  label: string;
  tone: "chip-ok" | "chip-wait" | "chip-bad" | "chip-neutral";
  icon: LucideIcon;
  /** One sentence, for the person who owns the contribution. */
  meaning: string;
}

/**
 * The only place statuses get their words, symbols and colours. Every status
 * has a symbol and a label, so none depends on colour.
 */
export const STATUS_INFO: Record<ContributionStatus, StatusInfo> = {
  draft: {
    label: "Draft",
    tone: "chip-neutral",
    icon: FilePen,
    meaning: "Only you can see this. Nobody has reviewed it.",
  },
  self_reported: {
    label: "Self-reported",
    tone: "chip-neutral",
    icon: UserRound,
    meaning:
      "Your own account of the work. It can appear on your public profile, always labelled self-reported. No organisation has confirmed it.",
  },
  pending: {
    label: "Awaiting review",
    tone: "chip-wait",
    icon: Clock,
    meaning: "Sent to the organisation. Only you and its reviewers can see it.",
  },
  needs_information: {
    label: "Information requested",
    tone: "chip-wait",
    icon: CircleDashed,
    meaning: "The organisation has asked you for more before it decides.",
  },
  approved_pending_anchor: {
    label: "Approved, awaiting NEAR anchor",
    tone: "chip-wait",
    icon: Clock,
    meaning: "The organisation approved it. It is not anchored on NEAR yet.",
  },
  verified: {
    label: "Verified",
    tone: "chip-ok",
    icon: ShieldCheck,
    meaning: "Approved by the organisation and anchored on NEAR testnet.",
  },
  rejected: {
    label: "Not approved",
    tone: "chip-bad",
    icon: X,
    meaning: "The organisation declined it and gave a reason.",
  },
  revoked: {
    label: "Revoked",
    tone: "chip-bad",
    icon: Ban,
    meaning: "The organisation withdrew it. It stays visible, marked as revoked.",
  },
  superseded: {
    label: "Superseded",
    tone: "chip-neutral",
    icon: RefreshCw,
    meaning: "Replaced by a corrected record.",
  },
};

export function StatusChip({ status }: { status: ContributionStatus }) {
  const info = STATUS_INFO[status];
  return (
    <span className={`chip ${info.tone}`}>
      <info.icon aria-hidden="true" size={13} strokeWidth={2.5} />
      {info.label}
    </span>
  );
}
