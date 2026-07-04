"use client";

import { useEffect, useState } from "react";

/**
 * Renders an order/receipt timestamp in the *viewer's* local timezone.
 *
 * Why a client component: the order page is server-rendered, and on Vercel the
 * server's timezone is UTC — so a plain server-side `toLocaleString` printed
 * e.g. "8:17 PM" (UTC) while the client-rendered admin table showed the same
 * order as "1:17 PM" (Pacific). Formatting on the client fixes the mismatch and
 * shows every buyer their own local time.
 *
 * To avoid a hydration mismatch we render a deterministic UTC string on the
 * server and first client paint, then swap to local time after mount.
 */
function fmt(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function LocalDateTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => fmt(iso, "UTC"));
  useEffect(() => setText(fmt(iso)), [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}
