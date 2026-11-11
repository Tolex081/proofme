"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False until the page has hydrated. Submit buttons stay disabled until then:
 * a form submitted before its script runs is sent by the browser itself, and
 * what people type must never end up in a URL.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
