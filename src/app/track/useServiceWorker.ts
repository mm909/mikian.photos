import { useEffect, useState } from "react";

/**
 * Registers public/track-sw.js once per page load, browser only, scoped to
 * /track/ so it never touches the rest of the site. The worker caches the
 * crew and van page shells so the crew page opens in a dead zone and the
 * queued taps (offlineQueue.ts) can be seen and sent later.
 *
 * Once the worker is ready the page asks it to cache THIS url as a shell
 * ({ type: "cache-shell" }). The review found the worker "caches the shell
 * only when a navigation passes through the fetch handler, so after a
 * single visit the crew/van shell is NOT available offline": on the first
 * visit the navigation happened before the worker controlled the page.
 * The ask is repeated when a new worker version takes over, so its fresh
 * cache gets the shell too.
 *
 * Registration needs a secure context: https, or localhost in dev. A plain
 * http LAN address (phone → laptop) reports "unsupported" — the page still
 * works, it just is not installable there.
 */

export type SwState = "unsupported" | "registering" | "ready" | "error";

let started = false;
let lastState: SwState = "registering";
const listeners = new Set<(s: SwState) => void>();

function setState(s: SwState) {
  lastState = s;
  listeners.forEach((l) => l(s));
}

/** Ask the active worker to cache this page (and what it references) as an offline shell. */
function askCacheShell() {
  navigator.serviceWorker.ready
    .then((reg) => {
      const worker = reg.active ?? navigator.serviceWorker.controller;
      worker?.postMessage({ type: "cache-shell", url: window.location.href });
    })
    .catch(() => {});
}

function start(url: string, scope: string) {
  if (started) return;
  started = true;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
    setState("unsupported");
    return;
  }
  navigator.serviceWorker
    .register(url, { scope })
    .then((reg) => {
      setState("ready");
      // A new worker version takes over as soon as it is installed (the
      // worker calls skipWaiting + clients.claim); nothing to do here.
      void reg.update().catch(() => {});
      askCacheShell();
    })
    .catch((err) => {
      console.warn("track-sw: registration failed", err);
      setState("error");
    });
  // A new version just took over (its activate dropped the old caches): fill the new one.
  navigator.serviceWorker.addEventListener("controllerchange", askCacheShell);
}

export function useServiceWorker(url = "/track-sw.js", scope = "/track/"): SwState {
  const [state, set] = useState<SwState>(lastState);
  useEffect(() => {
    listeners.add(set);
    start(url, scope);
    set(lastState);
    return () => {
      listeners.delete(set);
    };
  }, [url, scope]);
  return state;
}
