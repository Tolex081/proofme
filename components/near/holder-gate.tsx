"use client";

import { BadgeCheck, CircleAlert, KeyRound, Lock } from "lucide-react";
import { useState } from "react";

import { useHydrated } from "@/components/forms/use-hydrated";
import { holderAccessAction, holderChallengeAction, type HolderView } from "@/server/actions/near";
import { proveAccountWithWallet, walletErrorMessage } from "./wallet";
import { Spinner } from "@/components/ui/busy";

/**
 * Opens the gated page with a ProofMe credential held in the visitor's wallet.
 * The browser only relays the signature; the server decides.
 */
export function HolderGate() {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<HolderView | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    setView(null);
    try {
      const signed = await proveAccountWithWallet(holderChallengeAction);
      if (!signed.ok) {
        setError(signed.message);
        return;
      }
      setView(await holderAccessAction(signed.proof));
    } catch (failure) {
      setError(walletErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {!view?.granted ? (
        <section className="card grid gap-4 p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Lock aria-hidden="true" size={22} />
          </span>
          <p className="max-w-[60ch]">
            Connect the NEAR wallet that holds your ProofMe credential and sign a one-time message.
            Signing proves you control the account; it is not a transaction and moves no funds.
          </p>
          <div>
            <button
              type="button"
              onClick={open}
              disabled={!hydrated || busy}
              className="action action-primary"
            >
              {busy ? <Spinner /> : <KeyRound aria-hidden="true" size={17} />}
              {busy ? "Checking…" : "Connect wallet and sign"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-bad-ink">
              {error}
            </p>
          ) : null}
          {view && !view.granted ? (
            <div role="alert" className="rounded-2xl bg-bad p-4 text-bad-ink">
              <p className="font-semibold">Access not granted.</p>
              <p>{view.reason}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {view && view.credentials.length > 0 ? (
        <section className="card p-6 sm:p-8" aria-labelledby="checked">
          <h2 id="checked" className="text-[1.15rem]">
            Credentials checked in {view.accountId}
          </h2>
          <ul className="mt-3 grid gap-2">
            {view.credentials.map((credential) => (
              <li key={credential.tokenId} className="flex items-start gap-2">
                {credential.accepted ? (
                  <BadgeCheck aria-hidden="true" size={18} className="mt-0.5 text-ok-ink" />
                ) : (
                  <CircleAlert aria-hidden="true" size={18} className="mt-0.5 text-bad-ink" />
                )}
                <span>
                  <span className="font-semibold">{credential.title ?? credential.tokenId}</span>
                  {" · "}
                  {credential.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view?.granted && view.content ? (
        <section className="card p-6 sm:p-8" aria-labelledby="unlocked">
          <p className="chip chip-ok w-fit">Unlocked for {view.accountId}</p>
          <h2 id="unlocked" className="mt-3 text-[1.4rem]">
            {view.content.title}
          </h2>
          <p className="mt-1 text-[0.9rem] text-muted">{view.content.note}</p>
          <ul className="mt-5 grid gap-3">
            {view.content.opportunities.map((item) => (
              <li key={item.role} className="well p-4">
                <p className="font-semibold">{item.role}</p>
                <p className="text-[0.9rem] text-muted">{item.organisation}</p>
                <p className="mt-1">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
