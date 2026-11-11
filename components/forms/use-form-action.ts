"use client";

import { useActionState, useTransition } from "react";

import type { FormState } from "@/server/actions/account";

const IDLE: FormState = { status: "idle" };

/**
 * Runs a server action from a form WITHOUT React's automatic form reset.
 *
 * Every form with fields must use this rather than `<form action={...}>`.
 * React 19 resets a form after its action finishes, restoring every field to
 * its default. After a validation error that silently changes what the next
 * submission says: typed text vanishes and radios and selects jump back to
 * their defaults while the person believes their choice still stands. (Found
 * in testing: a reviewer who chose "ask for more", hit a validation error and
 * submitted again had the claim approved.)
 */
export function useFormAction<S extends FormState = FormState>(
  action: (previous: S, form: FormData) => Promise<S>,
  initial: S = IDLE as S,
) {
  // S is a plain object, so Awaited<S> is S; the cast only bridges React's generic types.
  const [state, dispatch, pending] = useActionState<S, FormData>(
    action as (previous: Awaited<S>, form: FormData) => Promise<S>,
    initial as Awaited<S>,
  );
  const [, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return { state, pending, onSubmit };
}
