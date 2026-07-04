"use client";

import { useEffect, useState } from "react";

/**
 * True only after the component has hydrated on the client.
 *
 * Every RELATIVE or LOCALE-dependent time string ("45m ago", "Fri 03:13 PM")
 * must be gated on this in SSR'd components: the server renders at a different
 * moment (and, in production, in UTC) than the client, so the strings differ
 * and React throws a hydration mismatch ("45m ago" vs "46m ago" — the exact
 * error the owner hit twice). Render a stable placeholder until mounted.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
