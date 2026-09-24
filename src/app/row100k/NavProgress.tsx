"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* THE LINE THAT SAYS THE TAP LANDED (owner, 2026-09-24: "it takes a couple
 * of clicks to click on the same link"). Every Rowtember page is rendered
 * on the server per request, so a tap on a link is followed by up to a
 * second of nothing on a phone — long enough to tap again. This is a thin
 * water-blue line along the top edge of the bar that starts the instant a
 * same-site link is pressed and runs until the next page is on screen.
 *
 * It listens at the document for any left click on a same-origin anchor,
 * whatever the anchor is: a next/link (which then routes on the client) or
 * a plain href (which unloads the page, taking the line with it). Links
 * that swap a view in place without leaving the page opt out with
 * data-inplace, because there is no page coming.
 *
 * Off again when the pathname or the query changes, and after a long
 * fallback for a route that never answers. Reduced motion gets a plain
 * line with no sweep. */

const FALLBACK_MS = 12_000;

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(false);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const t = ev.target as Element | null;
      const a = t && typeof t.closest === "function" ? (t.closest("a[href]") as HTMLAnchorElement | null) : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-inplace")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setOn(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setOn(false), FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [on]);

  return <div className={on ? "bar-go on" : "bar-go"} aria-hidden="true" />;
}
