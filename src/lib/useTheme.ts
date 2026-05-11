"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Theme hook — light / dark / system.
 *
 * Persists choice to localStorage. On mount, applies the resolved theme as a
 * `dark` class on <html>. Falls back to system preference when no manual
 * choice has been made.
 *
 * Used by ThemeToggle in the navbar. The root layout no longer hardcodes
 * `dark`; this hook owns it.
 */

export type Theme = "light" | "dark" | "system";

const KEY = "shopier:theme";

function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycle: () => void;
  resolved: "light" | "dark";
} {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    let initial: Theme = "system";
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        initial = saved;
      }
    } catch {
      /* swallow */
    }
    setThemeState(initial);
    applyTheme(initial);

    // Reflect the resolved theme so the toggle button shows the right icon
    const reflectResolved = (t: Theme) => {
      const r =
        t === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : t;
      setResolved(r);
    };
    reflectResolved(initial);

    // If the user picked "system", listen for OS-level changes
    if (initial === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        applyTheme("system");
        reflectResolved("system");
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* swallow */
    }
    applyTheme(t);
    const r =
      t === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    setResolved(r);
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }, [theme, setTheme]);

  return { theme, setTheme, cycle, resolved };
}
