"use client";

import { Trash2, UserRound } from "lucide-react";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  deleteContributionAction,
  publishContributionAction,
} from "@/server/actions/contributions";
import type { FormState } from "@/server/actions/account";

const IDLE: FormState = { status: "idle" };

export function PublishButton({ contributionId }: { contributionId: string }) {
  const [state, action, pending] = useActionState(
    publishContributionAction.bind(null, contributionId),
    IDLE,
  );
  const hydrated = useHydrated();
  return (
    <form action={action} className="grid gap-3">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          <UserRound aria-hidden="true" size={17} />
          {pending ? "Saving…" : "Mark as self-reported"}
        </button>
      </div>
    </form>
  );
}

export function DeleteDraftButton({ contributionId }: { contributionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    deleteContributionAction.bind(null, contributionId),
    IDLE,
  );
  const hydrated = useHydrated();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="action action-secondary">
        <Trash2 aria-hidden="true" size={16} /> Delete draft
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      <p className="font-semibold">Delete this draft for good?</p>
      <button
        type="submit"
        disabled={pending || !hydrated}
        className="action border-[1.5px] border-bad-ink bg-bad text-bad-ink hover:bg-bad-ink hover:text-surface"
      >
        {pending ? "Deleting…" : "Yes, delete it"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="action action-secondary"
      >
        Keep it
      </button>
    </form>
  );
}
