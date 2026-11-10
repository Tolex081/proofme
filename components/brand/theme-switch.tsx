"use client";

import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "proofme-theme";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Switches between light and dark and remembers the choice on this device.
 * Which icon shows is decided by CSS from the same attribute, so the button
 * is correct from the first paint.
 */
export function ThemeSwitch() {
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private windows, blocked site data).
      // The theme still changes for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Moon className="theme-moon" aria-hidden="true" size={19} strokeWidth={2} />
      <Sun className="theme-sun" aria-hidden="true" size={19} strokeWidth={2} />
    </button>
  );
}
