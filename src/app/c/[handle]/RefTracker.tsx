"use client";

import { useEffect, useRef } from "react";

// Sets the shopier_ref cookie + records a referral landing.
// Done client-side because Next.js 16 forbids cookie writes from server components.
export default function RefTracker({ handle }: { handle: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const existing = document.cookie.match(/(?:^|;\s*)shopier_ref=([^;]+)/)?.[1];
    if (existing === handle) return;
    // 30 days
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `shopier_ref=${encodeURIComponent(handle)};Max-Age=${maxAge};Path=/;SameSite=Lax`;
    fetch("/api/creators/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    }).catch(() => {});
  }, [handle]);
  return null;
}
