"use client";

import { Children, cloneElement, isValidElement, type MouseEvent, type ReactElement } from "react";

/* Click tracking for the handful of links the owner wants counted (the
 * PARTNERS rail item, the Grizzly outbound links). One beacon per click to
 * /api/row100k/click with the link name, the page it was clicked on and the
 * referrer the page loaded with; sendBeacon so the ping survives the page
 * unloading under it, fetch keepalive where sendBeacon is missing. Every
 * error is swallowed and nothing here ever preventDefaults — the navigation
 * is never delayed, and a dead endpoint is invisible to the clicker. */

export type TrackedLinkName = "partners" | "grizzly" | "grizzly-code";

const ENDPOINT = "/api/row100k/click";

export function trackClick(link: TrackedLinkName): void {
  try {
    if (typeof window === "undefined") return;
    const body = JSON.stringify({
      link,
      path: window.location.pathname,
      referrer: document.referrer,
    });
    /* A plain string goes out as text/plain, which keeps sendBeacon off the
     * CORS-preflight path; the route parses the text itself. */
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, body)) return;
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    /* analytics never break a link */
  }
}

type Clickable = {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onAuxClick?: (e: MouseEvent<HTMLElement>) => void;
};

/* Wraps exactly one anchor-like child (an <a> or a next/link) and reports
 * `link` on click and middle-click, then hands the event on to whatever
 * handler the child already had. Renders no element of its own, so the
 * page's markup and CSS are untouched. */
export function TrackedLink({ link, children }: { link: TrackedLinkName; children: ReactElement<Clickable> }) {
  const child = Children.only(children);
  if (!isValidElement<Clickable>(child)) return child;
  const own = child.props;
  return cloneElement(child, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      trackClick(link);
      own.onClick?.(e);
    },
    onAuxClick: (e: MouseEvent<HTMLElement>) => {
      if (e.button === 1) trackClick(link);
      own.onAuxClick?.(e);
    },
  });
}
