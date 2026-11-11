"use client";

import { useActionState, useTransition } from "react";

import type { FormState } from "@/server/actions/account";

const IDLE: FormState = { status: "idle" };

/**
 * Runs a server action from a form without React's automatic form reset, so
 * a failed submission keeps everything the person typed.
 */
export function useFormAction(action: (previous: FormState, form: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  const [, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return { state, pending, onSubmit };
}
