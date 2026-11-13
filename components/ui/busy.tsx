"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** A small spinner that inherits the text colour. Decorative: the label says what is happening. */
export function Spinner() {
  return <span aria-hidden="true" className="spinner" />;
}

/**
 * A thin bar at the top of the window, shown the moment someone clicks a link
 * to another page in the app and finished when the new page arrives, so a
 * click always gets an immediate response even while the server works.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const started = useRef<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      if (url.pathname.startsWith("/api/")) return;
      started.current = window.location.pathname;
      setState("loading");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Never stay stuck: a click that does not lead anywhere (an error, a
  // redirect back here) resets the bar.
  useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(() => {
      started.current = null;
      setState("idle");
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (started.current === null || started.current === pathname) return;
    started.current = null;
    setState("done");
    const timer = window.setTimeout(() => setState("idle"), 450);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
