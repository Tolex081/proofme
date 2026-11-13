"use client";

import { GitBranch, ScanSearch } from "lucide-react";
import { useState } from "react";

import { FormMessage } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import { disconnectGitHubAction, investigateAction } from "@/server/actions/evidence";

type Notice = { tone: "error" | "success"; text: string } | null;

export function GitHubIdentityPanel({
  identities,
  configured,
  outcome,
}: {
  identities: { githubUserId: number; login: string; status: string }[];
  configured: boolean;
  outcome: string | null;
}) {
  const hydrated = useHydrated();
  const [notice, setNotice] = useState<Notice>(() => {
    const messages: Record<string, Notice> = {
      linked: {
        tone: "success",
        text: "GitHub account linked. It now belongs to this ProofMe account.",
      },
      reconnected: { tone: "success", text: "GitHub account reconnected." },
      taken: {
        tone: "error",
        text: "That GitHub account is already linked to another ProofMe account, so it cannot be linked here.",
      },
      invalid_state: {
        tone: "error",
        text: "That GitHub sign-in expired or was already used. Try again.",
      },
      cancelled: { tone: "error", text: "GitHub sign-in was cancelled. Nothing changed." },
      failed: { tone: "error", text: "GitHub could not confirm the account. Nothing changed." },
      not_configured: { tone: "error", text: "GitHub linking is not set up on this site yet." },
    };
    return outcome ? (messages[outcome] ?? null) : null;
  });
  const connected = identities.filter((identity) => identity.status === "connected");
  const disconnected = identities.filter((identity) => identity.status === "disconnected");

  async function disconnect(githubUserId: number) {
    const result = await disconnectGitHubAction(githubUserId);
    setNotice(
      result.ok
        ? {
            tone: "success",
            text: "Disconnected. The account stays reserved for you; nobody else can link it.",
          }
        : { tone: "error", text: result.message },
    );
  }

  return (
    <div className="grid gap-4">
      {connected.length > 0 ? (
        <ul className="grid gap-2">
          {connected.map((identity) => (
            <li key={identity.githubUserId} className="flex flex-wrap items-center gap-3">
              <GitBranch aria-hidden="true" size={18} />
              <a
                href={`https://github.com/${identity.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link font-semibold"
              >
                @{identity.login}
              </a>
              <span className="chip chip-ok">Verified by GitHub sign-in</span>
              <button
                type="button"
                className="action action-secondary"
                disabled={!hydrated}
                onClick={() => disconnect(identity.githubUserId)}
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No GitHub account linked.</p>
      )}
      {disconnected.length > 0 ? (
        <p className="text-[0.9rem] text-muted">
          Disconnected but still yours:{" "}
          {disconnected.map((identity) => `@${identity.login}`).join(", ")}. Link again to
          reconnect.
        </p>
      ) : null}
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
      {configured ? (
        <div>
          <a href="/api/github/start" className="action action-primary">
            <GitBranch aria-hidden="true" size={17} />
            {connected.length > 0 ? "Link another GitHub account" : "Link GitHub"}
          </a>
        </div>
      ) : (
        <p className="text-[0.9rem] text-wait-ink">
          GitHub linking is not set up on this site yet.
        </p>
      )}
    </div>
  );
}

export function InvestigateButton({ contributionId }: { contributionId: string }) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function run() {
    setBusy(true);
    setNotice(null);
    const result = await investigateAction(contributionId);
    setNotice(
      result.ok
        ? {
            tone: "success",
            text: `Investigation ${result.value.version} finished. The report is below.`,
          }
        : { tone: "error", text: result.message },
    );
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <div>
        <button
          type="button"
          onClick={run}
          disabled={!hydrated || busy}
          className="action action-primary"
        >
          <ScanSearch aria-hidden="true" size={17} />
          {busy ? "Investigating…" : "Investigate with ProofMe"}
        </button>
      </div>
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
    </div>
  );
}
