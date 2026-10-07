/* Live tracker service worker — scope /track/ (registered by
 * src/app/track/useServiceWorker.ts). Its one job: the crew and van pages
 * open with no signal, so queued handoff taps can be seen and sent later.
 *
 *  - "cache-shell" message      → the page asks, once the worker is ready,
 *                                 for its own URL to be cached as a shell,
 *                                 with the /_next/static files it references
 *                                 and /track/icon.svg. The first visit's own
 *                                 navigation happened before this worker
 *                                 controlled the page, so without the ask
 *                                 nothing would be cached after one visit.
 *  - navigations under /track/  → network first, raced against the cache:
 *                                 after NAV_RACE_MS without an answer a
 *                                 cached shell is served, and the network
 *                                 answer, when it comes, still refreshes it
 *  - /_next/static/* and /track/*.svg → cache, refreshed in the background
 *  - /api/                      → never cached, never touched
 *
 * Bump VERSION when the strategy changes; activate drops the older caches. */

const VERSION = "trk-v2";
const SHELLS = VERSION + ":shells";
const ASSETS = VERSION + ":assets";
const NAV_RACE_MS = 4000;
const ICON = "/track/icon.svg";
/** How many /_next/static references of one shell to cache (a page lists ~20). */
const SHELL_ASSET_MAX = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("trk-") && !k.startsWith(VERSION + ":")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "cache-shell" && typeof data.url === "string") event.waitUntil(cacheShell(data.url));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate" && url.pathname.startsWith("/track/")) {
    event.respondWith(networkFirst(event, req, SHELLS));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || (url.pathname.startsWith("/track/") && url.pathname.endsWith(".svg"))) {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
  }
});

/**
 * Cache one page as a shell, plus what it needs to run: the scripts,
 * styles and preloaded fonts under /_next/static that its HTML references
 * (a shell that cannot hydrate is a picture of the crew page, not the crew
 * page), and the icon. Same origin, under /track/, GET only.
 */
async function cacheShell(href) {
  let url;
  try {
    url = new URL(href, self.location.origin);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/track/") || url.pathname.startsWith("/api/")) return;
  const shells = await caches.open(SHELLS);
  let html = "";
  try {
    const res = await fetch(url.href, { credentials: "same-origin" });
    if (!res || !res.ok) return;
    html = await res.clone().text();
    await shells.put(url.href, res);
  } catch (err) {
    return; // offline already; the next load will ask again
  }

  const assets = await caches.open(ASSETS);
  const refs = new Set([ICON]);
  // Script src, stylesheet href, font preload href — also inside the inline
  // RSC payload, where quotes are escaped (hence the backslash in the class).
  const re = /\/_next\/static\/[^"'\\\s<>(),]+/g;
  let m;
  while ((m = re.exec(html)) !== null && refs.size < SHELL_ASSET_MAX) refs.add(m[0].replace(/&amp;/g, "&"));
  await Promise.all(
    Array.from(refs).map(async (path) => {
      try {
        if (await assets.match(path)) return;
        const r = await fetch(path, { credentials: "same-origin" });
        if (r && r.ok) await assets.put(path, r);
      } catch (err) {
        /* the page's own loads may have cached it; otherwise next time */
      }
    })
  );
}

/**
 * Network first for a navigation, with a race: with a cached shell on hand,
 * NAV_RACE_MS without an answer (or a 5xx) serves the shell. The network
 * request keeps running and refreshes the cache when it answers; the
 * worker is kept alive for that through waitUntil, registered up front
 * because it may not be called once respondWith has settled.
 */
async function networkFirst(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  let settled;
  event.waitUntil(
    new Promise((resolve) => {
      settled = resolve;
    })
  );
  const network = fetch(req).then(
    (res) => {
      if (res && res.ok) {
        cache
          .put(req, res.clone())
          .catch(() => {})
          .then(settled);
      } else {
        settled();
      }
      return res;
    },
    (err) => {
      settled();
      throw err;
    }
  );

  const cached = await cache.match(req, { ignoreVary: true });
  if (!cached) return network; // nothing to fall back on: the network's answer, or its error, is the truth

  const first = await Promise.race([network.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), NAV_RACE_MS))]);
  if (first && first.status < 500) return first;
  network.catch(() => {});
  return cached;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    refresh.catch(() => {});
    return hit;
  }
  const res = await refresh;
  if (res) return res;
  return new Response("", { status: 504, statusText: "offline" });
}
